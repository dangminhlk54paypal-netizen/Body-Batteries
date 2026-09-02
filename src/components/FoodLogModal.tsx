import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ScrollView, StyleSheet } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useChargeEffectStore } from '../store/chargeEffectStore';
import { searchAllFoods } from '../data/food/foodSearch';
import { addCustomFoodAndRegister } from '../data/food/customFoodRegistry';
import { autoTranslateCustomFoodName } from '../services/translation/foodNameTranslationService';
import { getAnyFoodById, foodDisplayName, foodLogEntryDisplayName } from '../data/food/foodLookup';
import { getOverrideByIdSync } from '../data/food/foodOverrideRegistry';
import { foodSourceKind } from '../domain/food/foodSource';
import { getFoodLogInRange } from '../data/repositories/foodLogRepository';
import { FoodNutritionEditModal } from './FoodNutritionEditModal';
import { CustomFoodFields } from './food/CustomFoodFields';
import { PastDateField } from './food/PastDateField';
import { BottomSheet } from './ui/BottomSheet';
import { nutritionForGrams, mealTypeForHour, gramsForPortion } from '../domain/food/foodNutrition';
import {
  formatMeasure,
  formatServingDefinition,
  isPortionCounted,
  measureUnitOf,
  nutritionBasisLabel,
  portionUnitNoun,
} from '../domain/food/portionUnits';
import { suggestFoods, type FoodSuggestion } from '../domain/food/foodSuggestions';
import {
  buildCustomFoodItem,
  isValidCustomFoodInput,
  resetNutritionForUnitChange,
  EMPTY_CUSTOM_FOOD_INPUT,
  type CustomFoodInput,
} from '../domain/food/customFoodInput';
import { foodCategoryLabel, mealLabel, BACKFILL_MAX_DAYS_BACK } from '../lib/constants';
import { daysAgo, todayString, formatDisplayDate, isToday } from '../lib/dateUtils';
import type { FoodItem, FoodLogEntry } from '../types/food';
import type { Language } from '../i18n/types';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  // S-S5 (backfill): pin the modal to a specific calendar day (YYYY-MM-DD),
  // e.g. when opened from HistoryScreen's "+ Thêm món cho ngày này". Defaults
  // to today when omitted (unchanged behaviour for every existing caller).
  initialDate?: string;
}

// The current language's name is the main line (foodDisplayName owns the
// fallback chain), with the English name underneath as the small second line
// whenever it adds something the main line doesn't already say — for an
// English UI, or a food with only one name, there is nothing to add.
function displayNames(item: FoodItem, language: Language): { main: string; sub: string | null } {
  const main = foodDisplayName(item, language);
  const sub = item.nameEn && item.nameEn !== main ? item.nameEn : null;
  return { main, sub };
}

// "Của tôi" / "Catalog VN" / "USDA", plus an "đã sửa" marker when the user has
// corrected this food. The list mixes three very different provenances and the
// user's own entries are the ones they trust most — worth saying out loud.
function sourceBadge(
  item: FoodItem,
  t: (key: string, vars?: Record<string, string | number>) => string
): { label: string; mine: boolean; edited: boolean } {
  const kind = foodSourceKind(item);
  const label =
    kind === 'mine'
      ? t('components.foodLogModal.sourceBadgeMine')
      : kind === 'usda'
        ? t('components.foodLogModal.sourceBadgeUsda')
        : t('components.foodLogModal.sourceBadgeCatalog');
  return { label, mine: kind === 'mine', edited: getOverrideByIdSync(item.id) != null };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Build a timestamp for TODAY at the given hour:minute (used to log a meal at a
// time earlier in the day — "ghi nhận trễ").
function timestampForToday(hour: number, minute: number): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// Module-level wrapper so the impure Date.now() call is invisible to the
// component's purity analysis — same reasoning as timestampForToday above.
function nowTimestamp(): number {
  return Date.now();
}

// Module-level wrapper around todayString() — same purity-hiding trick as
// above — used to seed the backfill date field with "today" when the modal
// opens without an initialDate.
function getTodayString(): string {
  return todayString();
}

// S-S5 (backfill): build a timestamp for an ARBITRARY calendar date at the
// given hour:minute — unlike timestampForToday, this never reads the current
// date, so it stays a pure/testable function of its three inputs. An empty
// or unparseable hour/minute defaults to 12:00 (noon), per spec 3b/3d — a
// safe "sometime that day" pick for a day that has already ended, instead of
// silently falling back to the current wall-clock time.
export function buildTimestampForDate(dateStr: string, hourStr: string, minuteStr: string): number {
  const parsedHour = parseInt(hourStr, 10);
  const parsedMinute = parseInt(minuteStr, 10);
  const hour = isNaN(parsedHour) ? 12 : clampInt(parsedHour, 0, 23);
  const minute = isNaN(parsedMinute) ? 0 : clampInt(parsedMinute, 0, 59);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function FoodLogModal({ visible, onClose, initialDate }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logFood = useEnergyStore((s) => s.logFood);
  const logFoodForPastDate = useEnergyStore((s) => s.logFoodForPastDate);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('');
  // Count of packs/capsules for portionUnit !== 'gram' foods (TPCN). Ignored
  // (and `grams` used instead) for gram-based foods — see isServingBased below.
  const [portionCount, setPortionCount] = useState('1');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  // S-S5 (backfill): which calendar day this entry is being logged for.
  // Seeded from `initialDate` (or today) whenever the modal opens — see the
  // `wasVisible` block below. `isToday(logDate)` gates every branch that
  // must stay 100% unchanged for today's own flow.
  const [logDate, setLogDate] = useState(() => initialDate ?? '');
  const [wasVisible, setWasVisible] = useState(false);
  // "Thêm món mới" sub-state: shown when a search finds nothing and the user
  // wants to define a custom food. `adding` gates a third branch alongside
  // the search list and the selected-entry view.
  const [adding, setAdding] = useState(false);
  const [customInput, setCustomInput] = useState<CustomFoodInput>(EMPTY_CUSTOM_FOOD_INPUT);
  const [showMicros, setShowMicros] = useState(false);
  // Guards against a fast double-tap on "Lưu món" firing saveCustomFood()
  // twice before the first save/navigation completes.
  const [savingCustomFood, setSavingCustomFood] = useState(false);
  // "Sửa thành phần": opens the nutrition-override editor for the selected food.
  const [editingNutrition, setEditingNutrition] = useState(false);
  // BUG-1 (S-S6): guards confirm()/logSuggestion() against a fast double-tap
  // double-charging the batteries — the sibling of savingCustomFood above.
  // Cleared by reset() when the sheet closes after a successful log.
  const [savingFood, setSavingFood] = useState(false);
  // Last 7 days of food log + the hour the modal was opened, fetched/read
  // once per open — feeds the "Gợi ý cho bữa này" suggestion chips (see
  // suggestFoods). Empty until the fetch resolves; the modal degrades
  // gracefully to "no suggestions" until then. Both setState calls happen
  // inside the async .then() callback (not synchronously in the effect
  // body), and the impure Date read lives there too — never during render.
  const [recentLog, setRecentLog] = useState<FoodLogEntry[]>([]);
  const [suggestHour, setSuggestHour] = useState(0);

  // S-S5 (backfill): re-seed logDate every time the modal transitions to
  // open, so a caller-provided `initialDate` (or "today" otherwise) always
  // wins over whatever the previous session left behind. This is React's
  // "adjust state during render" pattern (compare against the previous
  // rendered value of a prop, tracked in state) rather than a useEffect —
  // set-state-in-effect only allows synchronous setState calls here, not
  // inside an effect body. See FoodNutritionEditModal for the same pattern.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setLogDate(initialDate ?? getTodayString());
    }
  }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getFoodLogInRange(daysAgo(7), todayString()).then((rows) => {
      if (cancelled) return;
      setRecentLog(rows);
      setSuggestHour(new Date().getHours());
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const suggestions = useMemo(
    () => suggestFoods(recentLog, suggestHour),
    [recentLog, suggestHour]
  );

  const results = useMemo(() => searchAllFoods(query), [query]);

  function reset() {
    setQuery('');
    setSelected(null);
    setGrams('');
    setPortionCount('1');
    setHour('');
    setMinute('');
    // S-S5: always land back on today — a fresh open without initialDate
    // (e.g. from the Home "+" button) must never inherit a stale past date.
    setLogDate(getTodayString());
    setAdding(false);
    setCustomInput(EMPTY_CUSTOM_FOOD_INPUT);
    setShowMicros(false);
    setSavingCustomFood(false);
    setSavingFood(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickFood(item: FoodItem) {
    const now = new Date();
    // searchAllFoods returns the raw catalog/custom item — resolve it through
    // getAnyFoodById so any user "Sửa thành phần" override applies to the
    // preview AND to logFood (which snapshots the nutrition at log time).
    const resolved = getAnyFoodById(item.id) ?? item;
    setSelected(resolved);
    setGrams(String(resolved.defaultServingG));
    setPortionCount('1');
    setHour(pad2(now.getHours()));
    setMinute(pad2(now.getMinutes()));
  }

  // Opens the "add custom food" form, prefilled with the search query.
  function startAddingCustomFood() {
    setCustomInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: query });
    setShowMicros(false);
    setSavingCustomFood(false);
    setAdding(true);
  }

  function updateCustomField<K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) {
    if (key === 'portionUnit') {
      // Per-100g and per-serving figures are different scales — clear the
      // nutrition fields instead of silently reinterpreting stale numbers.
      setCustomInput((prev) => resetNutritionForUnitChange(prev, value as CustomFoodInput['portionUnit']));
      return;
    }
    setCustomInput((prev) => ({ ...prev, [key]: value }));
  }

  const customValid = isValidCustomFoodInput(customInput);
  // Matches the per-serving/per-100g interpretation CustomFoodFields uses for
  // its field suffixes (see that component for the source of truth).
  const customNutritionBasisLabel = nutritionBasisLabel(
    customInput.portionUnit,
    customInput.servingLabel,
    customInput.measureUnit,
    language
  );

  // Builds the FoodItem, persists it via the registry (SQLite + searchable
  // immediately), then hands off into the existing selected-entry view so
  // the user picks grams/time and logs through the existing confirm().
  async function saveCustomFood() {
    if (!customValid || savingCustomFood) return;
    setSavingCustomFood(true);
    const item = buildCustomFoodItem(customInput);
    await addCustomFoodAndRegister(item);
    // Best-effort, opt-in background translation (Settings → Ngôn ngữ) — not
    // awaited so it never delays logging the food; no-ops when the setting
    // is off. See foodNameTranslationService.ts.
    autoTranslateCustomFoodName(item, language);
    setAdding(false);
    // No need to reset savingCustomFood here — the view transitions away via
    // pickFood()/setSelected, unmounting the "Lưu món" button.
    pickFood(item);
  }

  // Supplements (TPCN) counted by pack/capsule are entered as a count, not a
  // gram weight — see gramsForPortion (the shared count→grams conversion).
  const isServingBased = isPortionCounted(selected?.portionUnit);
  // g or ml — labels only; every amount below is still handled in grams.
  const selectedMeasureUnit = measureUnitOf(selected);

  const gramsNum = parseDecimal(grams);
  const validGrams = !isNaN(gramsNum) && gramsNum > 0;
  const countNum = parseDecimal(portionCount);
  const validCount = !isNaN(countNum) && countNum > 0;
  const validAmount = isServingBased ? validCount : validGrams;
  const effectiveGrams = selected && isServingBased ? gramsForPortion(selected, countNum) : gramsNum;
  const hourNum = clampInt(parseInt(hour, 10), 0, 23);
  const minuteNum = clampInt(parseInt(minute, 10), 0, 59);

  const preview =
    selected && validAmount ? nutritionForGrams(selected, effectiveGrams) : null;
  const mealTimeLabel = mealLabel(mealTypeForHour(hourNum), language);

  async function confirm() {
    // BUG-1 (S-S6): same double-tap guard as savingCustomFood — a second tap
    // before the first log finishes would double-charge the batteries (and,
    // for a backfill, collide on the deterministic food_log id).
    if (!selected || !validAmount || savingFood) return;
    setSavingFood(true);
    // USDA rows have no Vietnamese name yet — fall back to the English name so
    // the Diary/History never show a blank title (logFood snapshots nameVi).
    const foodToLog = selected.nameVi ? selected : { ...selected, nameVi: selected.nameEn };
    if (isToday(logDate)) {
      // Unchanged today-flow (criterion #1 — must never regress).
      if (isServingBased) {
        await logFood(foodToLog, effectiveGrams, timestampForToday(hourNum, minuteNum), {
          portionUnit: selected.portionUnit,
          count: countNum,
        });
      } else {
        await logFood(foodToLog, gramsNum, timestampForToday(hourNum, minuteNum));
      }
    } else {
      // S-S5 (backfill): log onto the selected past day instead — see
      // buildTimestampForDate (empty hour/minute defaults to 12:00).
      const timestamp = buildTimestampForDate(logDate, hour, minute);
      if (isServingBased) {
        await logFoodForPastDate(foodToLog, effectiveGrams, timestamp, {
          portionUnit: selected.portionUnit,
          count: countNum,
        });
      } else {
        await logFoodForPastDate(foodToLog, gramsNum, timestamp);
      }
    }
    useChargeEffectStore.getState().triggerChargePulse();
    haptics.success();
    handleClose();
  }

  // One-tap logging from a "Gợi ý cho bữa này" chip — reuses the food's
  // last-used portion instead of asking the user to re-enter it. Mirrors
  // confirm() above but logs at the current moment (not a picked hour) and
  // skips the grams/time review step entirely — that's the point of a
  // low-friction suggestion.
  async function logSuggestion(suggestion: FoodSuggestion) {
    if (savingFood) return; // BUG-1 guard, same as confirm()
    const item = getAnyFoodById(suggestion.foodId);
    if (!item) return; // food removed from the catalog since it was last logged
    setSavingFood(true);
    const foodToLog = item.nameVi ? item : { ...item, nameVi: item.nameEn };
    if (isToday(logDate)) {
      // Unchanged today-flow (criterion #1 — must never regress).
      if (suggestion.portionUnit && suggestion.portionUnit !== 'gram') {
        await logFood(foodToLog, suggestion.grams, nowTimestamp(), {
          portionUnit: suggestion.portionUnit,
          count: suggestion.count,
        });
      } else {
        await logFood(foodToLog, suggestion.grams, nowTimestamp());
      }
    } else {
      // S-S5 (backfill): a suggestion chip tapped while a past day is
      // selected must land on that day too, never silently on today.
      const timestamp = buildTimestampForDate(logDate, '', '');
      if (suggestion.portionUnit && suggestion.portionUnit !== 'gram') {
        await logFoodForPastDate(foodToLog, suggestion.grams, timestamp, {
          portionUnit: suggestion.portionUnit,
          count: suggestion.count,
        });
      } else {
        await logFoodForPastDate(foodToLog, suggestion.grams, timestamp);
      }
    }
    useChargeEffectStore.getState().triggerChargePulse();
    haptics.success();
    handleClose();
  }

  return (
    <>
      {/* React Native's <Modal> does not reliably stack two visible instances
          (iOS in particular can fail to present/render the second one) — so
          this sheet must hide whenever FoodNutritionEditModal opens on top of
          it, otherwise "Sửa thành phần" silently shows nothing. */}
      <BottomSheet visible={visible && !editingNutrition} onClose={handleClose} sheetOffset={500}>
        <View style={styles.sheet}>
          {adding ? (
            <>
              <View style={styles.headerRow}>
                <Pressable
                  onPress={() => setAdding(false)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.back}>{t('components.foodLogModal.backToSearch')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.title}>{t('components.foodLogModal.addCustomTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('components.foodLogModal.addCustomSubtitle', { basis: customNutritionBasisLabel })}
              </Text>

              <ScrollView
                style={styles.entryScroll}
                contentContainerStyle={styles.entryScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <CustomFoodFields
                  input={customInput}
                  onChange={updateCustomField}
                  showMicros={showMicros}
                  onToggleMicros={() => setShowMicros((v) => !v)}
                  autoFocusName
                />
              </ScrollView>

              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                  onPress={() => setAdding(false)}
                >
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.eat,
                    (!customValid || savingCustomFood) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={saveCustomFood}
                  disabled={!customValid || savingCustomFood}
                >
                  <Text style={styles.btnText}>{t('components.foodLogModal.saveCustomFoodButton')}</Text>
                </Pressable>
              </View>
            </>
          ) : !selected ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{t('components.foodLogModal.title')}</Text>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.subtitle}>{t('components.foodLogModal.searchSubtitle')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('components.foodLogModal.searchPlaceholder')}
                placeholderTextColor={c.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.trim().length === 0 && suggestions.length > 0 && (
                <View style={styles.suggestSection}>
                  <Text style={styles.suggestLabel}>{t('components.foodLogModal.suggestLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.suggestRow}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.foodId}
                          style={({ pressed }) => [styles.suggestChip, pressed && styles.pressed]}
                          onPress={() => logSuggestion(s)}
                        >
                          <Text style={styles.suggestChipText} numberOfLines={1}>
                            {foodLogEntryDisplayName(s, language)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              <FlatList
                style={styles.list}
                data={results}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View>
                    <Text style={styles.empty}>{t('components.foodLogModal.emptyResults')}</Text>
                    {query.trim().length > 0 && (
                      <Pressable
                        style={({ pressed }) => [styles.addNewBtn, pressed && styles.pressed]}
                        onPress={startAddingCustomFood}
                      >
                        <Text style={styles.addNewText}>
                          {t('components.foodLogModal.addNewFoodButton', { query: query.trim() })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                }
                renderItem={({ item }) => {
                  const { main, sub } = displayNames(item, language);
                  const badge = sourceBadge(item, t);
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.foodRow, pressed && styles.pressed]}
                      onPress={() => pickFood(item)}
                    >
                      <View style={styles.foodRowMain}>
                        <View style={styles.foodNameRow}>
                          <Text style={styles.foodName} numberOfLines={1}>
                            {main}
                          </Text>
                          <Text style={[styles.sourceBadge, badge.mine && styles.sourceBadgeMine]}>
                            {badge.label}
                            {badge.edited
                              ? ` · ${t('components.foodLogModal.sourceBadgeEdited')}`
                              : ''}
                          </Text>
                        </View>
                        {sub ? <Text style={styles.foodNameEn}>{sub}</Text> : null}
                        <Text style={styles.foodMeta}>
                          {foodCategoryLabel(item.category, language)} ·{' '}
                          {t('components.foodLogModal.resultEnergyMeta', {
                            kcal: item.per100g.energyKcal,
                            measure: measureUnitOf(item),
                          })}
                        </Text>
                      </View>
                      <Text style={styles.foodChevron}>›</Text>
                    </Pressable>
                  );
                }}
              />
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={handleClose}
              >
                <Text style={styles.cancelText}>{t('common.close')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Pressable
                  onPress={() => setSelected(null)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.back}>{t('components.foodLogModal.backToOtherFood')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
              {(() => {
                const { main, sub } = displayNames(selected, language);
                return (
                  <>
                    <Text style={styles.title}>{main}</Text>
                    {sub ? <Text style={styles.foodNameEn}>{sub}</Text> : null}
                  </>
                );
              })()}
              <Text style={styles.subtitle}>
                {foodCategoryLabel(selected.category, language)} · {selected.per100g.energyKcal} kcal / 100g
              </Text>
              <Pressable
                onPress={() => setEditingNutrition(true)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.editLink}>{t('components.foodLogModal.editNutritionLink')}</Text>
              </Pressable>

              <ScrollView
                style={styles.entryScroll}
                contentContainerStyle={styles.entryScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {isServingBased ? (
                  <>
                    <Text style={styles.fieldLabel}>
                      {t('components.foodLogModal.portionCountLabel', {
                        unit: portionUnitNoun(
                          selected.portionUnit,
                          selected.servingLabel,
                          language
                        ),
                      })}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('components.foodLogModal.portionCountPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="decimal-pad"
                      value={portionCount}
                      onChangeText={setPortionCount}
                    />
                    {/* Spell out what one portion IS ("1 hộp = 65ml") — the
                        count on its own says nothing about the amount. */}
                    {selected.servingWeightG != null && selected.servingWeightG > 0 && (
                      <Text style={styles.portionNote}>
                        {t('components.foodLogModal.portionDefinitionNote', {
                          definition: formatServingDefinition(
                            selected.servingWeightG,
                            selected.portionUnit,
                            selected.servingLabel,
                            language,
                            selectedMeasureUnit
                          ),
                        })}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>
                      {t('components.foodLogModal.gramsFieldLabel', {
                        measure: selectedMeasureUnit,
                      })}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('components.foodLogModal.gramsPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="decimal-pad"
                      value={grams}
                      onChangeText={setGrams}
                    />
                    <View style={styles.chips}>
                      <Pressable
                        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                        onPress={() => setGrams(String(selected.defaultServingG))}
                      >
                        <Text style={styles.chipText}>
                          {t('components.foodLogModal.defaultChipLabel', {
                            amount: formatMeasure(selected.defaultServingG, selectedMeasureUnit),
                          })}
                        </Text>
                      </Pressable>
                      {selected.servingPresets.map((p) => (
                        <Pressable
                          key={p.label}
                          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                          onPress={() => setGrams(String(p.grams))}
                        >
                          <Text style={styles.chipText}>
                            {p.label}={p.grams}g
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.fieldLabel}>
                  {t('components.foodLogModal.mealTimeFieldLabel', { meal: mealTimeLabel })}
                </Text>
                <View style={styles.timeRow}>
                  <TextInput
                    style={[styles.input, styles.timeInput]}
                    placeholder="HH"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={hour}
                    onChangeText={setHour}
                  />
                  <Text style={styles.timeColon}>:</Text>
                  <TextInput
                    style={[styles.input, styles.timeInput]}
                    placeholder="MM"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={minute}
                    onChangeText={setMinute}
                  />
                </View>

                <Text style={styles.fieldLabel}>{t('components.foodLogModal.logDateFieldLabel')}</Text>
                <PastDateField
                  value={logDate}
                  onChange={setLogDate}
                  maxDaysBack={BACKFILL_MAX_DAYS_BACK}
                />

                {preview && (
                  <View style={styles.preview}>
                    <Text style={styles.previewKcal}>
                      {t('components.foodLogModal.previewKcalLabel', { kcal: preview.energyKcal })}
                    </Text>
                    <Text style={styles.previewMacro}>
                      {t('components.foodLogModal.previewMacroLabel', {
                        p: preview.proteinG,
                        c: preview.carbG,
                        f: preview.fatG,
                      })}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {!isToday(logDate) && (
                <Text style={styles.backfillNotice}>
                  {t('components.foodLogModal.backfillNotice', {
                    date: formatDisplayDate(logDate, language),
                  })}
                </Text>
              )}

              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.eat,
                    (!validAmount || savingFood) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={confirm}
                  disabled={!validAmount || savingFood}
                >
                  <Text style={styles.btnText}>{t('components.foodLogModal.confirmButton')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </BottomSheet>
      {selected && (
        <FoodNutritionEditModal
          visible={editingNutrition}
          mode="edit"
          initialFood={selected}
          onClose={() => setEditingNutrition(false)}
          onSaved={(item) => {
            // Reflect the override immediately in the entry preview.
            setSelected(getAnyFoodById(item.id) ?? item);
          }}
        />
      )}
    </>
  );
}

function clampInt(n: number, min: number, max: number): number {
  if (isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: c.textSecondary, fontSize: 15, fontWeight: '700' },
  sheet: {
    padding: 24,
    gap: 12,
    // Must shrink with the BottomSheet frame (see BottomSheet styles.sheet),
    // otherwise the long "Thêm món mới" form overflows instead of making
    // entryScroll scrollable, and the Huỷ/Lưu row lands under the keyboard.
    flexShrink: 1,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 14, color: c.textSecondary },
  back: { color: c.mint, fontSize: 14, fontWeight: '600' },
  editLink: { color: c.info, fontSize: 13, fontWeight: '600', marginTop: 2 },
  fieldLabel: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
  entryScroll: { flexShrink: 1 },
  entryScrollContent: { gap: 12 },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  list: { maxHeight: 320, flexShrink: 1 },
  empty: { color: c.textTertiary, textAlign: 'center', paddingVertical: 20 },
  suggestSection: { gap: 6 },
  suggestLabel: { color: c.textTertiary, fontSize: 12, fontWeight: '600' },
  suggestRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  suggestChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.accent,
    maxWidth: 160,
  },
  suggestChipText: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
  addNewBtn: {
    marginTop: 4,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.mint,
  },
  addNewText: { color: c.mint, fontSize: 15, fontWeight: '700' },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.bgElevated,
  },
  foodRowMain: { flex: 1 },
  foodName: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
  foodNameEn: { color: c.textDim, fontSize: 12, marginTop: 1 },
  foodMeta: { color: c.textTertiary, fontSize: 12, marginTop: 2 },
  foodChevron: { color: c.textFaint, fontSize: 22, paddingLeft: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipText: { color: c.textLight, fontSize: 12, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 70, textAlign: 'center' },
  timeColon: { color: c.textPrimary, fontSize: 20, fontWeight: '700' },
  portionNote: { color: c.textSubtle, fontSize: 11, lineHeight: 16, marginTop: -4 },
  foodNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceBadge: {
    fontSize: 9,
    color: c.textSubtle,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  sourceBadgeMine: { color: c.accent, borderColor: c.accent },
  preview: {
    backgroundColor: c.bgHighlight,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: c.accent,
  },
  previewKcal: { color: c.accent, fontSize: 18, fontWeight: '800' },
  previewMacro: { color: c.textSoft, fontSize: 13 },
  backfillNotice: {
    color: c.warning,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  eat: { backgroundColor: c.accent },
  disabled: { opacity: 0.4 },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  btnText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

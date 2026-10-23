import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, FlatList, StyleSheet, Keyboard, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useEnergyStore } from '../../store/energyStore';
import { useChargeEffectStore } from '../../store/chargeEffectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useMealTextDraftStore } from '../../store/mealTextDraftStore';
import { loadLibraryCandidates, searchForMealText } from '../../data/food/mealTextSearch';
import { useLibrarySearch } from '../../hooks/useLibrarySearch';
import { getAnyFoodById, foodDisplayName, foodLogEntryDisplayName } from '../../data/food/foodLookup';
import { parseMealText } from '../../domain/food/mealText/parseMealText';
import {
  atLocalTime,
  buildMealDraft,
  draftTotals,
  isBlocked,
  manualRow,
  rowKcal,
  stepAmount,
  toggleRow,
  withAmount,
  withFood,
  withTimestamp,
  type MealDraftIssue,
  type MealDraftRow,
  type MealTextContext,
} from '../../domain/food/mealText/mapMealText';
import { isDraftFresh } from '../../domain/energy/activityDraft';
import { mealTypeForTimestamp } from '../../domain/food/foodNutrition';
import {
  formatLoggedPortion,
  formatMeasure,
  formatPortionCount,
  measureUnitOf,
  portionUnitNoun,
} from '../../domain/food/portionUnits';
import { BACKFILL_MAX_DAYS_BACK, mealLabel } from '../../lib/constants';
import { addDaysToDateString, dateString, todayString } from '../../lib/dateUtils';
import { parseDecimal } from '../../lib/units';
import * as haptics from '../../lib/haptics';
import type { FoodItem, FoodLogEntry } from '../../types/food';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';
import { LOCALE_TAGS } from '../../i18n';

// "Nạp bằng chữ" — one box for typed, dictated (the keyboard's 🎤) or pasted
// text, read by domain/food/mealText (Parsing → Decoding → Mapping &
// Validation) into rows the user ticks, fixes and only then logs (Insert,
// through the same logFood / logFoodForPastDate as the ⚡ Nạp list).
//
// Lives INSIDE FoodLogModal's sheet: the row editor, the food picker and the
// whole-list time editor replace the list in place — a second Modal on top of
// a BottomSheet does not show on iOS (mobile-ui-density §3).

interface Props {
  // The day the sheet is logging for (today, or a past day from History).
  baseDate: string;
  recentLog: FoodLogEntry[];
  onBack: () => void;
  onClose: () => void;
  onLogged: () => void;
}

type Screen =
  | { kind: 'list' }
  | { kind: 'edit'; id: string }
  | { kind: 'pick'; id: string | null } // null = add a new row
  | { kind: 'batchTime' };

const LIST_HEIGHT = 300;
const PICK_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Impure reads live in module-level helpers so the components' purity
// analysis never sees them (same pattern as FoodLogModal).
function nowTimestamp(): number {
  return Date.now();
}

function restoreDraftText(): string {
  const { text, savedAt } = useMealTextDraftStore.getState();
  return isDraftFresh(savedAt, Date.now()) ? text : '';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Whole days from `today` to the day of `timestamp` (0 today, -1 yesterday…).
function dayOffsetOf(timestamp: number, today: string): number {
  return Math.round((atLocalTime(dateString(new Date(timestamp)), 0, 0) - atLocalTime(today, 0, 0)) / DAY_MS);
}

export function TextMealEntry({ baseDate, recentLog, onBack, onClose, onLogged }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logFood = useEnergyStore((s) => s.logFood);
  const logFoodForPastDate = useEnergyStore((s) => s.logFoodForPastDate);
  const mealWindows = useSettingsStore((s) => s.mealWindows);

  const [text, setText] = useState(restoreDraftText);
  const [showHint, setShowHint] = useState(false);
  const [rows, setRows] = useState<MealDraftRow[] | null>(null);
  // "Today" as of the last analysis — labels in render read this, never the clock.
  const [today, setToday] = useState('');
  const [view, setView] = useState<Screen>({ kind: 'list' });
  const [saving, setSaving] = useState(false);
  // Row editor / time editor fields (strings while typing).
  const [editAmount, setEditAmount] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [editDay, setEditDay] = useState(0);
  const [pickQuery, setPickQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  // "📋 Dán" found nothing to paste — say so instead of doing nothing.
  const [pasteEmpty, setPasteEmpty] = useState(false);
  const manualIds = useRef(0);

  const preferIds = useMemo(() => new Set(recentLog.map((e) => e.foodId)), [recentLog]);
  // "Nguồn của tôi" rows for the food picker (searched in SQLite as you type).
  const pickLibrary = useLibrarySearch(view.kind === 'pick' ? pickQuery : '');

  function context(library: FoodItem[] = []): MealTextContext {
    return {
      now: nowTimestamp(),
      today: todayString(),
      baseDate,
      maxDaysBack: BACKFILL_MAX_DAYS_BACK,
      mealWindows,
      recentLog,
      search: (q) => searchForMealText(q, preferIds, library),
      resolve: getAnyFoodById,
    };
  }

  function updateText(next: string) {
    setText(next);
    setPasteEmpty(false);
    useMealTextDraftStore.getState().save(next);
  }

  async function analyze(source: string = text) {
    if (!source.trim() || analyzing) return;
    Keyboard.dismiss();
    setAnalyzing(true);
    const decoded = parseMealText(source);
    // The user's imported tables are searched in SQLite first, then the
    // mapping itself runs synchronously over catalog + those candidates.
    const library = await loadLibraryCandidates(decoded);
    const ctx = context(library);
    setToday(ctx.today);
    setRows(buildMealDraft(decoded, ctx));
    setView({ kind: 'list' });
    setAnalyzing(false);
  }

  // "📤 Hỏi AI": the ready-made prompt goes to the share sheet — the user
  // picks ChatGPT / Gemini / Claude, attaches the meal photo there, and
  // copies the JSON answer back. Nothing is sent by the app itself.
  function askAi() {
    Share.share({ message: t('components.textMealEntry.aiPrompt') }).catch(() => {});
  }

  async function paste() {
    const pasted = await Clipboard.getStringAsync().catch(() => '');
    if (!pasted.trim()) {
      setPasteEmpty(true);
      return;
    }
    updateText(pasted);
    await analyze(pasted);
  }

  function replaceRow(id: string, update: (row: MealDraftRow) => MealDraftRow | null) {
    setRows((prev) => {
      if (!prev) return prev;
      const next: MealDraftRow[] = [];
      for (const row of prev) {
        if (row.id !== id) next.push(row);
        else {
          const changed = update(row);
          if (changed) next.push(changed);
        }
      }
      return next;
    });
  }

  function openEdit(row: MealDraftRow) {
    if (!row.food) {
      setPickQuery(row.decoded.foodQuery || row.decoded.raw);
      setView({ kind: 'pick', id: row.id });
      return;
    }
    const at = new Date(row.timestamp);
    setEditAmount(String(row.count ?? Math.round(row.grams)));
    setEditHour(pad2(at.getHours()));
    setEditMinute(pad2(at.getMinutes()));
    setEditDay(dayOffsetOf(row.timestamp, today));
    setView({ kind: 'edit', id: row.id });
  }

  function openBatchTime() {
    const first = rows?.[0];
    const at = new Date(first ? first.timestamp : nowTimestamp());
    setEditHour(pad2(at.getHours()));
    setEditMinute(pad2(at.getMinutes()));
    setEditDay(first ? dayOffsetOf(first.timestamp, today) : 0);
    setView({ kind: 'batchTime' });
  }

  function editedTimestamp(): number | null {
    const hour = parseInt(editHour, 10);
    const minute = parseInt(editMinute, 10);
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return atLocalTime(addDaysToDateString(today, editDay), hour, minute);
  }

  function saveEdit(id: string) {
    const ctx = context();
    const amount = parseDecimal(editAmount);
    const timestamp = editedTimestamp();
    replaceRow(id, (row) => {
      let next = row;
      if (!isNaN(amount) && amount > 0 && amount !== (row.count ?? Math.round(row.grams))) {
        next = withAmount(next, amount, ctx);
      }
      if (timestamp != null && timestamp !== row.timestamp) next = withTimestamp(next, timestamp, ctx);
      return next;
    });
    setView({ kind: 'list' });
  }

  function applyBatchTime() {
    const timestamp = editedTimestamp();
    if (timestamp != null) {
      const ctx = context();
      setRows((prev) => prev && prev.map((row) => withTimestamp(row, timestamp, ctx)));
    }
    setView({ kind: 'list' });
  }

  function pick(food: FoodItem, id: string | null) {
    const ctx = context();
    const resolved = getAnyFoodById(food.id) ?? food;
    if (id) {
      replaceRow(id, (row) => withFood(row, resolved, ctx));
    } else {
      manualIds.current += 1;
      const at = rows?.[0]?.timestamp ?? ctx.now;
      const row = manualRow(`m${manualIds.current}`, resolved, at, ctx);
      setRows((prev) => [...(prev ?? []), row]);
    }
    setView({ kind: 'list' });
  }

  async function commit() {
    if (!rows || saving) return;
    const chosen = rows.filter((row) => row.selected && !isBlocked(row));
    if (chosen.length === 0) return;
    setSaving(true);
    const todayNow = todayString();
    try {
      for (const row of chosen) {
        if (!row.food) continue;
        const item = getAnyFoodById(row.food.id) ?? row.food;
        // USDA rows have no Vietnamese name — logFood snapshots nameVi.
        const food = item.nameVi ? item : { ...item, nameVi: item.nameEn };
        const portion = row.count != null ? { portionUnit: item.portionUnit, count: row.count } : undefined;
        if (dateString(new Date(row.timestamp)) === todayNow) {
          await logFood(food, row.grams, row.timestamp, portion);
        } else {
          await logFoodForPastDate(food, row.grams, row.timestamp, portion);
        }
      }
    } catch {
      // Whatever was logged stays; unlock so the sheet isn't stuck.
      setSaving(false);
      return;
    }
    useMealTextDraftStore.getState().clear();
    useChargeEffectStore.getState().triggerChargePulse();
    haptics.success();
    onLogged();
  }

  function cancel() {
    useMealTextDraftStore.getState().clear();
    onClose();
  }

  // ── Labels ─────────────────────────────────────────────────────────────

  function timeLabel(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(LOCALE_TAGS[language], { hour: '2-digit', minute: '2-digit' });
  }

  function dayLabel(offset: number): string {
    if (offset === 0) return t('common.today');
    if (offset === -1) return t('common.yesterday');
    return new Date(atLocalTime(addDaysToDateString(today, offset), 12, 0)).toLocaleDateString(
      LOCALE_TAGS[language],
      { day: '2-digit', month: '2-digit' }
    );
  }

  function whenLabel(timestamp: number): string {
    const offset = dayOffsetOf(timestamp, today);
    return offset === 0 ? timeLabel(timestamp) : `${timeLabel(timestamp)} · ${dayLabel(offset)}`;
  }

  function rowName(row: MealDraftRow): string {
    return row.food
      ? foodDisplayName(row.food, language)
      : t('components.textMealEntry.unknownFood', { text: row.decoded.raw });
  }

  function amountLabel(row: MealDraftRow, food: FoodItem): string {
    return row.count != null
      ? formatPortionCount(row.count, food.portionUnit, food.servingLabel, language)
      : formatMeasure(Math.round(row.grams), measureUnitOf(food));
  }

  function mealLabelFor(timestamp: number | null): string {
    return timestamp == null ? '–' : mealLabel(mealTypeForTimestamp(timestamp, mealWindows), language);
  }

  function noteFor(row: MealDraftRow, issue: MealDraftIssue): string {
    const key = `components.textMealEntry.notes.${issue}`;
    switch (issue) {
      case 'duplicate': {
        const dup = row.duplicate;
        if (!dup) return '';
        return t(key, {
          name: foodLogEntryDisplayName(dup, language),
          amount: formatLoggedPortion(dup, getAnyFoodById(dup.foodId), language),
          when: whenLabel(dup.timestamp),
        });
      }
      case 'fuzzyMatch':
        return t(key, { text: row.decoded.foodQuery || row.decoded.raw });
      case 'unitGuess':
        return t(key, { unit: row.decoded.unit?.word ?? '' });
      case 'tooOld':
        return t(key, { days: BACKFILL_MAX_DAYS_BACK });
      default:
        return t(key);
    }
  }

  // The duplicate (always — the user asked to see what it collides with)
  // plus the most important other note; one line each.
  function notesFor(row: MealDraftRow): string[] {
    const notes: string[] = [];
    if (row.duplicate) notes.push(noteFor(row, 'duplicate'));
    const other = row.issues.find((issue) => issue !== 'duplicate');
    if (other) notes.push(noteFor(row, other));
    return notes;
  }

  function status(row: MealDraftRow): { glyph: string; color: string } {
    if (isBlocked(row)) return { glyph: '✗', color: c.statusLow };
    if (row.issues.some((issue) => issue !== 'usualAmount')) return { glyph: '⚠', color: c.statusMid };
    return { glyph: '✓', color: c.statusGood };
  }

  const totals = rows ? draftTotals(rows) : { count: 0, kcal: 0 };
  const sameTime = rows && rows.length > 0 && rows.every((row) => row.timestamp === rows[0].timestamp);
  const batchWhen = rows && rows.length > 0
    ? sameTime
      ? `${dayLabel(dayOffsetOf(rows[0].timestamp, today))} ${timeLabel(rows[0].timestamp)}`
      : t('components.textMealEntry.timeMixed')
    : '';

  // ── Sub-views ─────────────────────────────────────────────────────────

  const dayChips = (
    <View style={styles.dayChips}>
      {Array.from({ length: BACKFILL_MAX_DAYS_BACK + 1 }, (_, i) => -BACKFILL_MAX_DAYS_BACK + i).map((offset) => (
        <Pressable
          key={offset}
          onPress={() => setEditDay(offset)}
          style={({ pressed }) => [styles.dayChip, editDay === offset && styles.dayChipOn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ selected: editDay === offset }}
        >
          <Text style={[styles.dayChipText, editDay === offset && styles.dayChipTextOn]} numberOfLines={1}>
            {dayLabel(offset)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const timeInputs = (label: string) => (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="HH"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={editHour}
          onChangeText={setEditHour}
        />
        <Text style={styles.timeColon}>:</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="MM"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={editMinute}
          onChangeText={setEditMinute}
        />
      </View>
      <Text style={styles.fieldLabel}>{t('components.foodLogModal.logDateFieldLabel')}</Text>
      {dayChips}
    </>
  );

  const footer = (left: () => void, right: () => void, rightLabel: string, disabled = false) => (
    <View style={styles.footer}>
      <Pressable style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]} onPress={left}>
        <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnMain, disabled && styles.disabled, pressed && styles.pressed]}
        onPress={right}
        disabled={disabled}
      >
        <Text style={styles.btnMainText} numberOfLines={1}>
          {rightLabel}
        </Text>
      </Pressable>
    </View>
  );

  const backToList = () => setView({ kind: 'list' });

  if (view.kind === 'pick') {
    const found = searchForMealText(pickQuery, preferIds, pickLibrary);
    const results = [...found.matches, ...found.similar].slice(0, PICK_LIMIT);
    return (
      <>
        <Text style={styles.title}>{t('components.textMealEntry.pickTitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('components.foodLogModal.searchPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={pickQuery}
          onChangeText={setPickQuery}
          autoFocus
        />
        <FlatList
          style={styles.pickList}
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>{t('components.foodLogModal.emptyResults')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
              onPress={() => pick(item, view.id)}
            >
              <Text style={styles.pickName} numberOfLines={1}>
                {foodDisplayName(item, language)}
              </Text>
              <Text style={styles.pickMeta}>
                {t('components.foodLogModal.resultEnergyMeta', {
                  kcal: item.per100g.energyKcal,
                  measure: measureUnitOf(item),
                })}
              </Text>
            </Pressable>
          )}
        />
        <Pressable style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]} onPress={backToList}>
          <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </>
    );
  }

  if (view.kind === 'batchTime') {
    return (
      <>
        <Text style={styles.title}>{t('components.textMealEntry.batchTimeTitle')}</Text>
        {timeInputs(t('components.foodLogModal.mealTimeFieldLabel', { meal: mealLabelFor(editedTimestamp()) }))}
        {footer(backToList, applyBatchTime, t('components.textMealEntry.applyAll'), editedTimestamp() == null)}
      </>
    );
  }

  const editing = view.kind === 'edit' ? rows?.find((row) => row.id === view.id) : undefined;
  if (view.kind === 'edit' && editing?.food) {
    const food = editing.food;
    const counted = editing.count != null;
    return (
      <>
        <Text style={styles.title} numberOfLines={2}>
          {rowName(editing)}
        </Text>
        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>
            {counted
              ? t('components.foodLogModal.portionCountLabel', {
                  unit: portionUnitNoun(food.portionUnit, food.servingLabel, language),
                })
              : t('components.foodLogModal.gramsFieldLabel', { measure: measureUnitOf(food) })}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={editAmount}
            onChangeText={setEditAmount}
          />
          {!counted && food.servingPresets.length > 0 && (
            <View style={styles.dayChips}>
              {food.servingPresets.map((p) => (
                <Pressable
                  key={p.label}
                  style={({ pressed }) => [styles.dayChip, pressed && styles.pressed]}
                  onPress={() => setEditAmount(String(p.grams))}
                >
                  <Text style={styles.dayChipText}>
                    {p.label}={p.grams}g
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {timeInputs(t('components.foodLogModal.mealTimeFieldLabel', { meal: mealLabelFor(editedTimestamp()) }))}
          <View style={styles.editActions}>
            <Pressable
              style={({ pressed }) => [styles.editAction, pressed && styles.pressed]}
              onPress={() => {
                setPickQuery(editing.decoded.foodQuery || foodDisplayName(food, language));
                setView({ kind: 'pick', id: editing.id });
              }}
            >
              <Text style={styles.editActionText}>{t('components.textMealEntry.changeFood')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.editAction, styles.editActionDanger, pressed && styles.pressed]}
              onPress={() => {
                replaceRow(editing.id, () => null);
                backToList();
              }}
            >
              <Text style={styles.editActionDangerText}>{t('components.textMealEntry.removeRow')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {footer(backToList, () => saveEdit(editing.id), t('components.textMealEntry.done'))}
      </>
    );
  }

  // ── The list ──────────────────────────────────────────────────────────

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>{t('components.foodLogModal.backToSearch')}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('components.textMealEntry.title')}</Text>
        <Pressable
          onPress={() => setShowHint((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('components.textMealEntry.infoA11y')}
          accessibilityState={{ expanded: showHint }}
        >
          <Text style={[styles.info, showHint && styles.infoOn]}>ⓘ</Text>
        </Pressable>
      </View>
      {showHint && <Text style={styles.hint}>{t('components.textMealEntry.hint')}</Text>}
      <TextInput
        style={[styles.input, styles.textBox]}
        placeholder={t('components.textMealEntry.placeholder')}
        placeholderTextColor={c.textMuted}
        value={text}
        onChangeText={updateText}
        multiline
        autoFocus={rows == null}
        textAlignVertical="top"
      />
      <View style={styles.inputActions}>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]} onPress={askAi}>
          <Text style={styles.sideText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.askAiButton')}
          </Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]} onPress={paste}>
          <Text style={styles.sideText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.pasteButton')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.analyzeBtn,
            (!text.trim() || analyzing) && styles.disabled,
            pressed && styles.pressed,
          ]}
          onPress={() => analyze()}
          disabled={!text.trim() || analyzing}
        >
          <Text style={styles.analyzeText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.analyzeButton')}
          </Text>
        </Pressable>
      </View>
      {pasteEmpty && <Text style={styles.pasteNote}>{t('components.textMealEntry.pasteEmpty')}</Text>}

      {rows && rows.length === 0 && <Text style={styles.empty}>{t('components.textMealEntry.nothingFound')}</Text>}

      {rows && rows.length > 0 && (
        <>
          <View style={styles.summaryRow}>
            <Pressable onPress={openBatchTime} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
              <Text style={styles.timeChip} numberOfLines={1}>
                {t('components.textMealEntry.timeChip', { when: batchWhen })}
              </Text>
            </Pressable>
            <Text style={styles.summary} numberOfLines={1}>
              {t('components.textMealEntry.summary', {
                count: totals.count,
                kcal: totals.kcal.toLocaleString(LOCALE_TAGS[language]),
              })}
            </Text>
          </View>
          <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {rows.map((row) => {
              const blocked = isBlocked(row);
              const { glyph, color } = status(row);
              const name = rowName(row);
              const food = row.food;
              return (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Pressable
                      onPress={() => replaceRow(row.id, toggleRow)}
                      disabled={blocked}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t('components.textMealEntry.rowCheckboxA11y', { name })}
                      accessibilityState={{ checked: row.selected, disabled: blocked }}
                    >
                      <Text style={[styles.check, row.selected && styles.checkOn, blocked && styles.checkBlocked]}>
                        {row.selected ? '☑' : '☐'}
                      </Text>
                    </Pressable>
                    <Text style={[styles.statusGlyph, { color }]}>{glyph}</Text>
                    <Text style={[styles.rowName, !food && styles.rowNameUnknown]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Pressable
                      onPress={() => openEdit(row)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t('components.textMealEntry.editRowA11y', { name })}
                    >
                      <Text style={styles.editGlyph}>✎</Text>
                    </Pressable>
                  </View>
                  {food && (
                    <View style={styles.rowBottom}>
                      <Text style={styles.rowTime} numberOfLines={1}>
                        {whenLabel(row.timestamp)} · {mealLabelFor(row.timestamp)}
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => replaceRow(row.id, (r) => stepAmount(r, -1, context()))}
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={t('components.textMealEntry.stepDownA11y')}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                          {amountLabel(row, food)}
                        </Text>
                        <Pressable
                          onPress={() => replaceRow(row.id, (r) => stepAmount(r, 1, context()))}
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={t('components.textMealEntry.stepUpA11y')}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.kcal}>{rowKcal(row)}</Text>
                    </View>
                  )}
                  {notesFor(row).map((note, i) => (
                    <Text
                      key={i}
                      style={[styles.note, { color: i === 0 && (row.duplicate || blocked) ? color : c.textTertiary }]}
                      numberOfLines={2}
                    >
                      {note}
                    </Text>
                  ))}
                </View>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
              onPress={() => {
                setPickQuery('');
                setView({ kind: 'pick', id: null });
              }}
            >
              <Text style={styles.addRowText}>{t('components.textMealEntry.addRow')}</Text>
            </Pressable>
          </ScrollView>
        </>
      )}

      {footer(
        cancel,
        commit,
        t('components.textMealEntry.commitButton', { count: totals.count }),
        totals.count === 0 || saving
      )}
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    back: { color: c.mint, fontSize: 14, fontWeight: '600' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeX: { color: c.textSecondary, fontSize: 15, fontWeight: '700' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    info: { color: c.textTertiary, fontSize: 18 },
    infoOn: { color: c.accent },
    hint: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    textBox: { minHeight: 64, maxHeight: 110 },
    inputActions: { flexDirection: 'row', gap: 8 },
    sideBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    sideText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    analyzeBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.bgElevated,
    },
    analyzeText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    pasteNote: { color: c.statusMid, fontSize: 12 },
    empty: { color: c.textTertiary, textAlign: 'center', paddingVertical: 12 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    timeChip: { color: c.info, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    summary: { color: c.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
    list: { maxHeight: LIST_HEIGHT, flexShrink: 1 },
    row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider, gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    check: { color: c.textTertiary, fontSize: 20, width: 22, textAlign: 'center' },
    checkOn: { color: c.accent },
    checkBlocked: { opacity: 0.35 },
    statusGlyph: { fontSize: 14, fontWeight: '800', width: 14, textAlign: 'center' },
    rowName: { flex: 1, color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    rowNameUnknown: { color: c.textTertiary, fontStyle: 'italic' },
    editBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editGlyph: { color: c.textSecondary, fontSize: 14 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 52 },
    rowTime: { flex: 1, color: c.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
    amount: {
      width: 64,
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    kcal: { width: 40, textAlign: 'right', color: c.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
    note: { fontSize: 11, lineHeight: 15, paddingLeft: 52 },
    addRow: { paddingVertical: 12, alignItems: 'center' },
    addRowText: { color: c.mint, fontSize: 14, fontWeight: '700' },
    footer: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    btnCancel: { backgroundColor: c.bgElevated },
    btnCancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    btnMain: { backgroundColor: c.accent },
    btnMainText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.6 },
    fieldLabel: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { width: 70, textAlign: 'center' },
    timeColon: { color: c.textPrimary, fontSize: 20, fontWeight: '700' },
    dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: {
      flexGrow: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    dayChipOn: { borderColor: c.accent, backgroundColor: c.accent },
    dayChipText: { color: c.textLight, fontSize: 12, fontWeight: '600' },
    dayChipTextOn: { color: c.onAccent },
    editScroll: { flexShrink: 1 },
    editContent: { gap: 10 },
    editActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
    editAction: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    editActionText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    editActionDanger: { borderColor: c.dangerStrong },
    editActionDangerText: { color: c.dangerStrong, fontSize: 14, fontWeight: '600' },
    pickList: { maxHeight: LIST_HEIGHT, flexShrink: 1 },
    pickRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider },
    pickName: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    pickMeta: { color: c.textTertiary, fontSize: 12, marginTop: 2 },
  });

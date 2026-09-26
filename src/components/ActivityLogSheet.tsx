import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { useActivityDraftStore } from '../store/activityDraftStore';
import { buildTimestampForDate } from './FoodLogModal';
import { PastDateField } from './food/PastDateField';
import {
  parseTimeHHmmToday,
  parseTimeHHmmForDate,
  todayString,
  daysAgo,
  isToday,
  formatDisplayDate,
} from '../lib/dateUtils';
import { BACKFILL_MAX_DAYS_BACK } from '../lib/constants';
import { ACTIVITY_CATEGORIES, categoryOfActivity } from '../lib/activityCategories';
import { getActivityLogInRange } from '../data/repositories/activityLogRepository';
import { suggestActivityPrefill, LOOKBACK_DAYS } from '../domain/energy/activityHabit';
import {
  blankDraft,
  draftFromPrefill,
  isDraftBlank,
  isDraftFresh,
  withTimes,
  type ActivityDraft,
} from '../domain/energy/activityDraft';
import type { ActivityType, CustomActivity, WorkoutSession } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';

// "🔥 Xả" → log an activity. Compact by design (.ai/skills/mobile-ui-density.md):
// short labels that shrink instead of wrapping in long languages, the body
// scrolls inside the sheet, and Cancel / Log stay pinned at the bottom.
//
// Two helpers for real use (docs/nghien-cuu/2026-09-26-ghi-van-dong-gon-va-dien-san.md):
// - Draft: every edit is kept on the device. Closing by accident (backdrop,
//   Android back, opening Powerlifting) and reopening within 5 minutes
//   continues where the user was; Cancel really discards; older than
//   5 minutes → a fresh form.
// - "As usual": a fresh form is prefilled with the activity the user usually
//   does around this time (their own last 4 weeks), shown as one 💡 line with
//   an ✕ to clear it. Every field stays editable.

// Module-level wrappers: impure clock reads stay out of the component body.
function getTodayString(): string {
  return todayString();
}
function nowMs(): number {
  return Date.now();
}

function initialState(): { draft: ActivityDraft; restored: boolean } {
  const today = getTodayString();
  const { draft, savedAt } = useActivityDraftStore.getState();
  if (draft && isDraftFresh(savedAt, nowMs()) && !isDraftBlank(draft, today)) {
    return { draft, restored: true };
  }
  return { draft: blankDraft(today), restored: false };
}

// Rough MET presets for a user-defined activity ("how hard it feels").
const CUSTOM_MET_PRESETS: { met: number; labelKey: 'light' | 'moderate' | 'high' | 'veryHigh' }[] = [
  { met: 3, labelKey: 'light' },
  { met: 5, labelKey: 'moderate' },
  { met: 8, labelKey: 'high' },
  { met: 10, labelKey: 'veryHigh' },
];

// Upper bound for a hand-typed MET (Compendium 2024 tops out ~23; above 20 is
// almost surely a typo like "65" for "6.5", and it feeds the eating goal).
const CUSTOM_MET_MAX = 20;
const SHEET_OFFSET = 400;
// Cap "larger text" scaling on the one-line labels so they still fit.
const LABEL_FONT_SCALE_CAP = 1.3;

interface Props {
  visible: boolean;
  // Close WITHOUT discarding (backdrop, Android back, handing over to the
  // Powerlifting/Bodybuilding sheets) — the draft is kept.
  onClose: () => void;
  onOpenPowerlifting: () => void;
  onOpenBodybuilding: () => void;
}

// The parent remounts this (via `key`) on every open, so the lazy initial
// state re-reads the saved draft each time.
export function ActivityLogSheet({ visible, onClose, onOpenPowerlifting, onOpenBodybuilding }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();
  const logActivity = useEnergyStore((s) => s.logActivity);
  const logActivityForPastDate = useEnergyStore((s) => s.logActivityForPastDate);
  const customActivities = useSettingsStore((s) => s.customActivities);
  const addCustomActivity = useSettingsStore((s) => s.addCustomActivity);
  const removeCustomActivity = useSettingsStore((s) => s.removeCustomActivity);
  const saveDraft = useActivityDraftStore((s) => s.save);
  const clearDraft = useActivityDraftStore((s) => s.clear);

  const [init] = useState(initialState);
  const [draft, setDraft] = useState<ActivityDraft>(init.draft);
  const [touched, setTouched] = useState(false);

  // "＋ Thêm môn" inline form state.
  const [addingCustom, setAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('cardio');
  const [newCustomMet, setNewCustomMet] = useState('');

  const translateY = useSharedValue(SHEET_OFFSET);
  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SHEET_OFFSET, { duration: 280 });
  }, [visible, translateY]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  // "As usual" prefill for a fresh form: the user's own last 4 weeks. Applied
  // only while the form is untouched — typing always wins.
  useEffect(() => {
    if (!visible || init.restored) return;
    let cancelled = false;
    getActivityLogInRange(daysAgo(LOOKBACK_DAYS), getTodayString()).then((history) => {
      if (cancelled) return;
      const p = suggestActivityPrefill(history, nowMs());
      if (!p) return;
      const next = draftFromPrefill(blankDraft(getTodayString()), p, customActivities, categoryOfActivity);
      if (next) setDraft((cur) => (isDraftBlank(cur, getTodayString()) && !cur.prefilled ? next : cur));
    });
    return () => {
      cancelled = true;
    };
    // customActivities is read once per open on purpose (no refetch per edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, init.restored]);

  function update(patch: Partial<ActivityDraft>) {
    // A hand edit makes it the user's own form (no longer "as usual").
    const next = { ...draft, ...patch, prefilled: false };
    setDraft(next);
    setTouched(true);
    saveDraft(next);
  }

  function switchCategory(key: string) {
    const types = ACTIVITY_CATEGORIES.find((cat) => cat.key === key)?.types ?? [];
    update({
      category: key,
      activity: types.length > 0 && !types.includes(draft.activity) ? types[0] : draft.activity,
      customId: null,
    });
  }

  function clearPrefill() {
    const fresh = blankDraft(getTodayString());
    setDraft(fresh);
    setTouched(true);
    clearDraft();
  }

  function cancel() {
    clearDraft();
    onClose();
  }

  function openAddCustom() {
    setNewCustomCategory(draft.category);
    setNewCustomName('');
    setNewCustomMet('');
    setAddingCustom(true);
  }

  function saveCustomActivity() {
    const name = newCustomName.trim();
    const met = parseDecimal(newCustomMet);
    if (!name || isNaN(met) || met <= 0 || met > CUSTOM_MET_MAX) return;
    addCustomActivity({ nameVi: name, category: newCustomCategory as CustomActivity['category'], met });
    // The store appends synchronously — read it fresh to get the new id.
    const created = useSettingsStore.getState().customActivities.at(-1);
    update({ category: newCustomCategory, customId: created?.id ?? null });
    setAddingCustom(false);
  }

  function confirmDeleteCustom(ca: CustomActivity) {
    Alert.alert(
      t('components.energyActionsBar.deleteCustomTitle'),
      t('components.energyActionsBar.deleteCustomMessage', { name: ca.nameVi }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            removeCustomActivity(ca.id);
            if (draft.customId === ca.id) update({ customId: null });
          },
        },
      ]
    );
  }

  function confirmActivity() {
    const mins = parseDecimal(draft.minutes);
    const stepCount = parseDecimal(draft.steps);
    let workouts: WorkoutSession[] = [];
    if (!isNaN(mins) && mins > 0) {
      const custom = draft.customId ? customActivities.find((ca) => ca.id === draft.customId) : undefined;
      workouts = custom
        ? [{ type: 'custom', minutes: mins, customName: custom.nameVi, customMet: custom.met }]
        : [{ type: draft.activity, minutes: mins }];
    }
    const steps = !isNaN(stepCount) && stepCount > 0 ? stepCount : 0;

    if (isToday(draft.date)) {
      logActivity({
        steps,
        workouts,
        startAt: parseTimeHHmmToday(draft.startTime),
        endAt: parseTimeHHmmToday(draft.endTime),
      });
    } else {
      // Backfill: times anchored to that day; log timestamp = start, else noon.
      const startAt = parseTimeHHmmForDate(draft.startTime, draft.date);
      const endAt = parseTimeHHmmForDate(draft.endTime, draft.date);
      const timestamp = startAt ?? buildTimestampForDate(draft.date, '', '');
      logActivityForPastDate({ steps, workouts, startAt, endAt }, timestamp);
    }
    clearDraft();
    onClose();
  }

  const selectedCustom = draft.customId ? customActivities.find((ca) => ca.id === draft.customId) : undefined;
  const activityName = selectedCustom ? selectedCustom.nameVi : t(`activities.${draft.activity}`);
  const showPrefill = draft.prefilled && !touched;
  const types = ACTIVITY_CATEGORIES.find((cat) => cat.key === draft.category)?.types ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        {/* Tapping outside closes but keeps the draft (reopen continues it). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.energyActionsBar.activitySheetTitle')}
          </Text>

          {showPrefill && (
            <View style={styles.hintRow}>
              <Text style={styles.hintText} numberOfLines={2}>
                {t('components.energyActionsBar.habitPrefill', {
                  activity: activityName,
                  minutes: draft.minutes,
                  time:
                    draft.startTime && draft.endTime
                      ? t('components.energyActionsBar.habitPrefillTime', {
                          start: draft.startTime,
                          end: draft.endTime,
                        })
                      : '',
                })}
              </Text>
              <Pressable
                onPress={clearPrefill}
                hitSlop={10}
                style={({ pressed }) => [styles.hintClear, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('components.energyActionsBar.habitClear')}
              >
                <Text style={styles.hintClearText}>✕</Text>
              </Pressable>
            </View>
          )}
          {init.restored && !showPrefill && (
            <Text style={styles.restoredText} numberOfLines={1} adjustsFontSizeToFit>
              {t('components.energyActionsBar.draftRestored')}
            </Text>
          )}

          <ScrollView
            style={{ maxHeight: height * 0.58 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.categoryRow}>
              {ACTIVITY_CATEGORIES.map((cat) => {
                const active = (addingCustom ? newCustomCategory : draft.category) === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => (addingCustom ? setNewCustomCategory(cat.key) : switchCategory(cat.key))}
                    style={({ pressed }) => [styles.categoryTab, active && styles.categoryTabActive, pressed && styles.pressed]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(`activityCategories.${cat.key}`)}
                  >
                    <Text
                      style={[styles.categoryText, active && styles.categoryTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      maxFontSizeMultiplier={LABEL_FONT_SCALE_CAP}
                    >
                      {t(`components.energyActionsBar.categoryTabs.${cat.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {addingCustom ? (
              <View style={styles.addCustomForm}>
                <Text style={styles.fieldLabel}>{t('components.energyActionsBar.customNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('components.energyActionsBar.customNamePlaceholder')}
                  placeholderTextColor={c.textMuted}
                  value={newCustomName}
                  onChangeText={setNewCustomName}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>{t('components.energyActionsBar.intensityLabel')}</Text>
                <View style={styles.chips}>
                  {CUSTOM_MET_PRESETS.map((p) => (
                    <Pressable
                      key={p.met}
                      onPress={() => setNewCustomMet(String(p.met))}
                      style={({ pressed }) => [
                        styles.chip,
                        newCustomMet === String(p.met) && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[styles.chipText, newCustomMet === String(p.met) && styles.chipTextActive]}
                        numberOfLines={1}
                      >
                        {t(`components.energyActionsBar.metPresets.${p.labelKey}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('components.energyActionsBar.metManualPlaceholder')}
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  value={newCustomMet}
                  onChangeText={setNewCustomMet}
                />
                <Text style={styles.explainer}>
                  {t('components.energyActionsBar.metExplainer', { max: CUSTOM_MET_MAX })}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.chips}>
                  {/* Set-based lifting (S-PL) and muscle-group bodybuilding
                      (S-BB) hand over to their own sheets (draft is kept). */}
                  {draft.category === 'gym' && (
                    <>
                      <Pressable
                        onPress={onOpenPowerlifting}
                        style={({ pressed }) => [styles.chip, styles.chipLifting, pressed && styles.pressed]}
                      >
                        <Text style={styles.chipLiftingText} numberOfLines={1}>
                          {t('components.energyActionsBar.powerliftingChip')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={onOpenBodybuilding}
                        style={({ pressed }) => [styles.chip, styles.chipLifting, pressed && styles.pressed]}
                      >
                        <Text style={styles.chipLiftingText} numberOfLines={1}>
                          {t('components.energyActionsBar.bodybuildingChip')}
                        </Text>
                      </Pressable>
                    </>
                  )}
                  {types.map((actType: ActivityType) => {
                    const active = draft.customId === null && draft.activity === actType;
                    return (
                      <Pressable
                        key={actType}
                        onPress={() => update({ activity: actType, customId: null })}
                        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                          {t(`activities.${actType}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {customActivities
                    .filter((ca) => ca.category === draft.category)
                    .map((ca) => (
                      <View key={ca.id} style={styles.customChipWrap}>
                        <Pressable
                          onPress={() => update({ customId: ca.id })}
                          style={({ pressed }) => [
                            styles.chip,
                            draft.customId === ca.id && styles.chipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[styles.chipText, draft.customId === ca.id && styles.chipTextActive]}
                            numberOfLines={1}
                          >
                            {ca.nameVi}
                          </Text>
                        </Pressable>
                        <Pressable
                          hitSlop={8}
                          onPress={() => confirmDeleteCustom(ca)}
                          style={({ pressed }) => [styles.customChipDelete, pressed && styles.pressed]}
                          accessibilityLabel={t('common.delete')}
                        >
                          <Text style={styles.customChipDeleteText}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  <Pressable
                    onPress={openAddCustom}
                    style={({ pressed }) => [styles.chip, styles.chipAdd, pressed && styles.pressed]}
                  >
                    <Text style={styles.chipAddText} numberOfLines={1}>
                      {t('components.energyActionsBar.addActivityChip')}
                    </Text>
                  </Pressable>
                </View>

                {/* Minutes | Steps — short labels above two equal inputs. */}
                <View style={styles.pairRow}>
                  <View style={styles.pairCol}>
                    <Text style={styles.fieldLabel} numberOfLines={1} adjustsFontSizeToFit>
                      {t('components.energyActionsBar.minutesLabel')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('components.energyActionsBar.minutesPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="decimal-pad"
                      value={draft.minutes}
                      onChangeText={(v) => update({ minutes: v, minutesAuto: false })}
                    />
                  </View>
                  <View style={styles.pairCol}>
                    <Text style={styles.fieldLabel} numberOfLines={1} adjustsFontSizeToFit>
                      {t('components.energyActionsBar.stepsLabel')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('components.energyActionsBar.stepsPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="decimal-pad"
                      value={draft.steps}
                      onChangeText={(v) => update({ steps: v })}
                    />
                  </View>
                </View>

                {/* From | To — filling both fills Minutes (unless typed). */}
                <Text style={styles.fieldLabel} numberOfLines={1} adjustsFontSizeToFit>
                  {t('components.energyActionsBar.timeLabel')}
                </Text>
                <View style={styles.pairRow}>
                  <TextInput
                    style={[styles.input, styles.pairCol, styles.timeInput]}
                    placeholder={t('components.energyActionsBar.fromTimePlaceholder')}
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    value={draft.startTime}
                    onChangeText={(v) => {
                      const next = withTimes(draft, v, draft.endTime);
                      update(next);
                    }}
                  />
                  <TextInput
                    style={[styles.input, styles.pairCol, styles.timeInput]}
                    placeholder={t('components.energyActionsBar.toTimePlaceholder')}
                    placeholderTextColor={c.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    value={draft.endTime}
                    onChangeText={(v) => {
                      const next = withTimes(draft, draft.startTime, v);
                      update(next);
                    }}
                  />
                </View>

                <Text style={styles.fieldLabel} numberOfLines={1}>
                  {t('components.energyActionsBar.logDateFieldLabel')}
                </Text>
                <PastDateField
                  value={draft.date}
                  onChange={(date) => update({ date })}
                  maxDaysBack={BACKFILL_MAX_DAYS_BACK}
                />
                {!isToday(draft.date) && (
                  <Text style={styles.backfillNotice}>
                    {t('components.energyActionsBar.backfillNotice', {
                      date: formatDisplayDate(draft.date, language),
                    })}
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          {/* Pinned footer: always reachable, even with the keyboard up. */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.footerBtn, styles.cancel, pressed && styles.pressed]}
              onPress={addingCustom ? () => setAddingCustom(false) : cancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText} numberOfLines={1} adjustsFontSizeToFit>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.footerBtn, styles.move, pressed && styles.pressed]}
              onPress={addingCustom ? saveCustomActivity : confirmActivity}
              accessibilityRole="button"
            >
              <Text style={styles.btnText} numberOfLines={1} adjustsFontSizeToFit>
                {addingCustom
                  ? t('components.energyActionsBar.saveActivityButton')
                  : t('components.energyActionsBar.logActivityButton')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      gap: 10,
    },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
    },
    hintText: { flex: 1, fontSize: 12, color: c.textSecondary, lineHeight: 16 },
    hintClear: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
    },
    hintClearText: { fontSize: 12, fontWeight: '700', color: c.textTertiary },
    restoredText: { fontSize: 12, color: c.textTertiary },
    body: { gap: 10, paddingBottom: 4 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    timeInput: { textAlign: 'center' },
    pairRow: { flexDirection: 'row', gap: 10 },
    pairCol: { flex: 1, gap: 4 },
    categoryRow: { flexDirection: 'row', gap: 6 },
    categoryTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    categoryTabActive: { backgroundColor: c.accentAltBg, borderColor: c.accentAlt },
    categoryText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    categoryTextActive: { color: c.textPrimary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipLifting: { borderColor: c.danger, borderWidth: 1 },
    chipLiftingText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: '100%',
    },
    chipActive: { backgroundColor: c.danger, borderColor: c.danger },
    chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: c.textPrimary },
    chipAdd: { borderColor: c.accentAlt, borderStyle: 'dashed' },
    chipAddText: { color: c.accentAlt, fontSize: 12, fontWeight: '700' },
    customChipWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    customChipDelete: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customChipDeleteText: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    addCustomForm: { gap: 10 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    backfillNotice: { color: c.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    explainer: { fontSize: 11, color: c.textSubtle, lineHeight: 15 },
    footer: { flexDirection: 'row', gap: 12, paddingTop: 4 },
    footerBtn: { flex: 1, minHeight: 48, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    move: { backgroundColor: c.danger },
    btnText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    pressed: { opacity: 0.6 },
  });

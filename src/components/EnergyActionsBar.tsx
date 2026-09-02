import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { MET_TABLE } from '../lib/metabolicConstants';
import { FoodLogModal, buildTimestampForDate } from './FoodLogModal';
import { PowerliftingSheet } from './PowerliftingSheet';
import { BodybuildingSheet } from './BodybuildingSheet';
import { PastDateField } from './food/PastDateField';
import { parseTimeHHmmToday, parseTimeHHmmForDate, todayString, isToday, formatDisplayDate } from '../lib/dateUtils';
import { BACKFILL_MAX_DAYS_BACK } from '../lib/constants';
import type { ActivityType, CustomActivity, WorkoutSession } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

// Module-level wrapper so the impure todayString() call is invisible to the
// component's purity analysis — same trick as FoodLogModal's getTodayString.
function getTodayString(): string {
  return todayString();
}

// Display label for a MET-based activity type, following the current app
// language. Exported so the activity-history edit form (TodayActivities) and
// BatterySourceSheet can reuse the same lookup instead of duplicating it.
export function activityLabel(type: ActivityType, language: Language): string {
  return translate(language, `activities.${type}`);
}
// Excludes 'custom' (rate travels on the session, see CustomActivity) AND
// 'bodybuilding' (S-BB — rate travels on WorkoutSession.bbMet, see S-BB
// exercises logged only through BodybuildingSheet's own muscle-group picker,
// never this generic minutes-based chip list).
export const ACTIVITY_TYPES = Object.keys(MET_TABLE).filter(
  (t) => t !== 'custom' && t !== 'bodybuilding'
) as ActivityType[];

// The activity picker's top-level groups. Squat/bench/deadlift are absent on
// purpose: they're logged set-based through the Powerlifting sheet (S-PL),
// which the Gym/Tạ group opens. `gym_strength` keeps its id but now reads
// "Weight training (by minutes)" — its old "Bodybuilding" label was renamed
// to make room for the S-BB muscle-group feature's own "Bodybuilding" chip in
// the same group (they'd otherwise collide); `gym_strength` itself stays
// minutes-based/MET-table-driven, unrelated to S-BB. Group labels are looked
// up at render time via `t(\`activityCategories.${key}\`)` — no separate
// helper needed since every call site already has the `t` function in scope.
export const ACTIVITY_CATEGORIES: { key: string; types: ActivityType[] }[] = [
  { key: 'cardio', types: ['walking', 'brisk_walking', 'running', 'cycling', 'elliptical'] },
  { key: 'sports', types: ['swimming', 'football', 'basketball', 'badminton', 'tennis'] },
  { key: 'gym', types: ['gym_strength', 'hiit'] },
  { key: 'other', types: ['yoga'] },
];

// Rough MET presets offered when adding a user-defined activity — the user
// picks by "how hard it feels" instead of researching an exact MET number.
// The numeric TextInput below them still allows a direct value.
const CUSTOM_MET_PRESETS: { met: number; labelKey: 'light' | 'moderate' | 'high' | 'veryHigh' }[] = [
  { met: 3, labelKey: 'light' },
  { met: 5, labelKey: 'moderate' },
  { met: 8, labelKey: 'high' },
  { met: 10, labelKey: 'veryHigh' },
];

// Upper bound for a hand-typed MET. The Compendium 2024's most intense
// entries top out around 23 (running 22.5 km/h) — anything above that is a
// typo (e.g. "65" for "6.5"), and since a custom MET feeds straight into the
// eating goal (growGoalFromActivity), one slip could inflate the goal wildly.
const CUSTOM_MET_MAX = 20;

// How far below its resting position a bottom sheet starts before sliding
// up. Kept local to this file since both inline modals below use it.
const SHEET_OFFSET = 400;

function useSheetSlide(visible: boolean) {
  const translateY = useSharedValue(SHEET_OFFSET);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SHEET_OFFSET, { duration: 280 });
  }, [visible, translateY]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}

export function EnergyActionsBar() {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logActivity = useEnergyStore((s) => s.logActivity);
  const logActivityForPastDate = useEnergyStore((s) => s.logActivityForPastDate);
  const customActivities = useSettingsStore((s) => s.customActivities);
  const addCustomActivity = useSettingsStore((s) => s.addCustomActivity);
  const removeCustomActivity = useSettingsStore((s) => s.removeCustomActivity);

  const [foodOpen, setFoodOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [powerliftingOpen, setPowerliftingOpen] = useState(false);
  const [bodybuildingOpen, setBodybuildingOpen] = useState(false);
  const activitySheetStyle = useSheetSlide(activityOpen);

  // Tactile press feedback (same pattern as ModeSelector's ModeChip) for the
  // two primary entry-point buttons — onPressIn/onPressOut only flip React
  // state; the actual shared-value mutation happens in the effects below,
  // since react-hooks/immutability rejects assigning `.value` directly
  // inside an inline JSX event-handler closure.
  const [foodBtnPressed, setFoodBtnPressed] = useState(false);
  const [activityBtnPressed, setActivityBtnPressed] = useState(false);
  const foodBtnScale = useSharedValue(1);
  const activityBtnScale = useSharedValue(1);

  useEffect(() => {
    foodBtnScale.value = withTiming(foodBtnPressed ? 0.96 : 1, {
      duration: foodBtnPressed ? 100 : 150,
    });
  }, [foodBtnPressed, foodBtnScale]);

  useEffect(() => {
    activityBtnScale.value = withTiming(activityBtnPressed ? 0.96 : 1, {
      duration: activityBtnPressed ? 100 : 150,
    });
  }, [activityBtnPressed, activityBtnScale]);

  const foodBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: foodBtnScale.value }],
  }));
  const activityBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activityBtnScale.value }],
  }));

  const [category, setCategory] = useState('cardio');
  const [activity, setActivity] = useState<ActivityType>('running');
  // A user-defined activity (types/energy.ts CustomActivity), selected via
  // its own chip instead of the built-in ActivityType list above — the two
  // selections are mutually exclusive (picking one clears the other).
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [steps, setSteps] = useState('');
  // "HH:mm" text fields for when the activity actually happened. Left blank
  // = "now" (backward-compatible: startAt/endAt stay undefined, same as
  // before this field existed).
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  // T2.2 (backfill): which calendar day this activity is being logged for.
  // Defaults to today — isToday(activityDate) gates the branch in
  // confirmActivity that must stay 100% unchanged for today's own flow.
  const [activityDate, setActivityDate] = useState(() => getTodayString());

  // "＋ Thêm môn" inline form state — swaps in for the chip row while open.
  const [addingCustom, setAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('cardio');
  const [newCustomMet, setNewCustomMet] = useState('');

  // Switching groups keeps the selected activity valid: if the current pick
  // isn't in the new group, fall to that group's first activity. A custom
  // pick from a different group is no longer visible as a chip once we
  // switch away, so clear it too — otherwise logging would silently use an
  // invisible selection.
  function switchCategory(key: string) {
    setCategory(key);
    const types = ACTIVITY_CATEGORIES.find((c) => c.key === key)?.types ?? [];
    if (types.length > 0 && !types.includes(activity)) setActivity(types[0]);
    setSelectedCustomId(null);
  }

  function openPowerlifting() {
    setActivityOpen(false);
    setPowerliftingOpen(true);
  }

  function openBodybuilding() {
    setActivityOpen(false);
    setBodybuildingOpen(true);
  }

  function selectBuiltIn(t: ActivityType) {
    setActivity(t);
    setSelectedCustomId(null);
  }

  function selectCustom(id: string) {
    setSelectedCustomId(id);
  }

  function openAddCustom() {
    setNewCustomCategory(category);
    setNewCustomName('');
    setNewCustomMet('');
    setAddingCustom(true);
  }

  function cancelAddCustom() {
    setAddingCustom(false);
    setNewCustomName('');
    setNewCustomMet('');
  }

  function saveCustomActivity() {
    const name = newCustomName.trim();
    const met = parseDecimal(newCustomMet);
    if (!name || isNaN(met) || met <= 0 || met > CUSTOM_MET_MAX) return;
    addCustomActivity({
      nameVi: name,
      category: newCustomCategory as CustomActivity['category'],
      met,
    });
    // The store appends synchronously — read it fresh (not the stale closure
    // value from the hook above) to find the just-created activity's id.
    const created = useSettingsStore.getState().customActivities.at(-1);
    setCategory(newCustomCategory);
    if (created) setSelectedCustomId(created.id);
    setAddingCustom(false);
    setNewCustomName('');
    setNewCustomMet('');
  }

  function confirmDeleteCustom(c: CustomActivity) {
    Alert.alert(
      t('components.energyActionsBar.deleteCustomTitle'),
      t('components.energyActionsBar.deleteCustomMessage', { name: c.nameVi }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            removeCustomActivity(c.id);
            if (selectedCustomId === c.id) setSelectedCustomId(null);
          },
        },
      ]
    );
  }

  function confirmActivity() {
    const mins = parseDecimal(minutes);
    const stepCount = parseDecimal(steps);
    const hasMinutes = !isNaN(mins) && mins > 0;
    let workouts: WorkoutSession[] = [];
    if (hasMinutes) {
      const custom = selectedCustomId
        ? customActivities.find((c) => c.id === selectedCustomId)
        : undefined;
      workouts = custom
        ? [{ type: 'custom', minutes: mins, customName: custom.nameVi, customMet: custom.met }]
        : [{ type: activity, minutes: mins }];
    }
    const stepsValue = !isNaN(stepCount) && stepCount > 0 ? stepCount : 0;

    if (isToday(activityDate)) {
      // Unchanged today-flow (must never regress) — the one true same-day path.
      logActivity({
        steps: stepsValue,
        workouts,
        startAt: parseTimeHHmmToday(startTime),
        endAt: parseTimeHHmmToday(endTime),
      });
    } else {
      // T2.2 (backfill): log onto the selected past day instead. startAt/endAt
      // respect the entered HH:mm fields, anchored to that day rather than
      // today; the log-time timestamp defaults to the start time when given,
      // else noon (mirrors FoodLogModal's buildTimestampForDate fallback).
      const startAt = parseTimeHHmmForDate(startTime, activityDate);
      const endAt = parseTimeHHmmForDate(endTime, activityDate);
      const timestamp = startAt ?? buildTimestampForDate(activityDate, '', '');
      logActivityForPastDate({ steps: stepsValue, workouts, startAt, endAt }, timestamp);
    }

    setMinutes('');
    setSteps('');
    setStartTime('');
    setEndTime('');
    // Always land back on today — a fresh open must never inherit a stale
    // past date (same reasoning as FoodLogModal's reset()).
    setActivityDate(getTodayString());
    setActivityOpen(false);
  }

  return (
    <View style={styles.container}>
      {/* Two equal-width entry points: log food (charge) / log activity (burn).
          The manual "add calories" entry point (calorie-typed shortcut) was
          removed — logging a food from the list is the only charge path now.
          useEnergyStore.addCalories itself is left in place (unused by any
          UI as of this change) so historical entries it already wrote to
          intake_events keep reading back correctly. */}
      <View style={styles.bar}>
        <Animated.View style={[styles.btnWrap, foodBtnAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.food, pressed && styles.pressed]}
            onPress={() => setFoodOpen(true)}
            onPressIn={() => setFoodBtnPressed(true)}
            onPressOut={() => setFoodBtnPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={t('components.energyActionsBar.logFoodButton')}
          >
            <Text style={styles.btnText}>{t('components.energyActionsBar.logFoodButton')}</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={[styles.btnWrap, activityBtnAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.move, pressed && styles.pressed]}
            onPress={() => setActivityOpen(true)}
            onPressIn={() => setActivityBtnPressed(true)}
            onPressOut={() => setActivityBtnPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={t('components.energyActionsBar.activityButton')}
          >
            <Text style={styles.btnText}>{t('components.energyActionsBar.activityButton')}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <FoodLogModal visible={foodOpen} onClose={() => setFoodOpen(false)} />

      {/* Activity / workout */}
      <Modal visible={activityOpen} transparent animationType="fade" onRequestClose={() => setActivityOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <Animated.View style={[styles.sheet, activitySheetStyle]}>
            <Text style={styles.title}>{t('components.energyActionsBar.activitySheetTitle')}</Text>
            <Text style={styles.subtitle}>{t('components.energyActionsBar.activitySheetSubtitle')}</Text>
            <View style={styles.categoryRow}>
              {ACTIVITY_CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => switchCategory(c.key)}
                  style={({ pressed }) => [
                    styles.categoryTab,
                    category === c.key && styles.categoryTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.categoryText, category === c.key && styles.categoryTextActive]}
                  >
                    {t(`activityCategories.${c.key}`)}
                  </Text>
                </Pressable>
              ))}
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
                <Text style={styles.fieldLabel}>{t('components.energyActionsBar.groupLabel')}</Text>
                <View style={styles.categoryRow}>
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => setNewCustomCategory(c.key)}
                      style={({ pressed }) => [
                        styles.categoryTab,
                        newCustomCategory === c.key && styles.categoryTabActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          newCustomCategory === c.key && styles.categoryTextActive,
                        ]}
                      >
                        {t(`activityCategories.${c.key}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                        style={[
                          styles.chipText,
                          newCustomMet === String(p.met) && styles.chipTextActive,
                        ]}
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
                <View style={styles.row}>
                  <Pressable
                    style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                    onPress={cancelAddCustom}
                  >
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.modalBtn, styles.move, pressed && styles.pressed]}
                    onPress={saveCustomActivity}
                  >
                    <Text style={styles.btnText}>{t('components.energyActionsBar.saveActivityButton')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.chips}>
                {/* Set-based powerlifting (S-PL) and bodybuilding-by-muscle-group
                    (S-BB) each live in their own sheet — these chips hand over
                    instead of picking a minutes-based type. */}
                {category === 'gym' && (
                  <>
                    <Pressable
                      onPress={openPowerlifting}
                      style={({ pressed }) => [styles.chip, styles.chipLifting, pressed && styles.pressed]}
                    >
                      <Text style={styles.chipLiftingText}>
                        {t('components.energyActionsBar.powerliftingChip')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={openBodybuilding}
                      style={({ pressed }) => [styles.chip, styles.chipLifting, pressed && styles.pressed]}
                    >
                      <Text style={styles.chipLiftingText}>
                        {t('components.energyActionsBar.bodybuildingChip')}
                      </Text>
                    </Pressable>
                  </>
                )}
                {(ACTIVITY_CATEGORIES.find((c) => c.key === category)?.types ?? []).map((actType) => (
                  <Pressable
                    key={actType}
                    onPress={() => selectBuiltIn(actType)}
                    style={({ pressed }) => [
                      styles.chip,
                      selectedCustomId === null && activity === actType && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCustomId === null && activity === actType && styles.chipTextActive,
                      ]}
                    >
                      {t(`activities.${actType}`)}
                    </Text>
                  </Pressable>
                ))}
                {customActivities
                  .filter((c) => c.category === category)
                  .map((c) => (
                    <View key={c.id} style={styles.customChipWrap}>
                      <Pressable
                        onPress={() => selectCustom(c.id)}
                        style={({ pressed }) => [
                          styles.chip,
                          selectedCustomId === c.id && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedCustomId === c.id && styles.chipTextActive,
                          ]}
                        >
                          {c.nameVi}
                        </Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => confirmDeleteCustom(c)}
                        style={({ pressed }) => [styles.customChipDelete, pressed && styles.pressed]}
                      >
                        <Text style={styles.customChipDeleteText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                <Pressable
                  onPress={openAddCustom}
                  style={({ pressed }) => [styles.chip, styles.chipAdd, pressed && styles.pressed]}
                >
                  <Text style={styles.chipAddText}>{t('components.energyActionsBar.addActivityChip')}</Text>
                </Pressable>
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder={t('components.energyActionsBar.minutesPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={minutes}
              onChangeText={setMinutes}
            />
            <TextInput
              style={styles.input}
              placeholder={t('components.energyActionsBar.stepsPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={steps}
              onChangeText={setSteps}
            />
            <Text style={styles.subtitle}>{t('components.energyActionsBar.timeRangeSubtitle')}</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.energyActionsBar.fromTimePlaceholder')}
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={startTime}
                onChangeText={setStartTime}
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.energyActionsBar.toTimePlaceholder')}
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>

            <Text style={styles.fieldLabel}>{t('components.energyActionsBar.logDateFieldLabel')}</Text>
            <PastDateField
              value={activityDate}
              onChange={setActivityDate}
              maxDaysBack={BACKFILL_MAX_DAYS_BACK}
            />
            {!isToday(activityDate) && (
              <Text style={styles.backfillNotice}>
                {t('components.energyActionsBar.backfillNotice', {
                  date: formatDisplayDate(activityDate, language),
                })}
              </Text>
            )}

            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setActivityOpen(false)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.move, pressed && styles.pressed]}
                onPress={confirmActivity}
              >
                <Text style={styles.btnText}>{t('components.energyActionsBar.logActivityButton')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* S-PL: set-based powerlifting logging (squat/bench/deadlift) */}
      <PowerliftingSheet visible={powerliftingOpen} onClose={() => setPowerliftingOpen(false)} />

      {/* S-BB: set-based bodybuilding logging, browsed by muscle group */}
      <BodybuildingSheet visible={bodybuildingOpen} onClose={() => setBodybuildingOpen(false)} />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  bar: { flexDirection: 'row', gap: 10 },
  btnWrap: { flex: 1 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  food: { backgroundColor: c.infoAlt },
  move: { backgroundColor: c.danger },
  btnText: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 14, color: c.textSecondary },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  timeInput: { flex: 1, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryTab: {
    flex: 1,
    paddingVertical: 8,
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
  fieldLabel: { fontSize: 13, color: c.textSecondary },
  backfillNotice: { color: c.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  explainer: { fontSize: 11, color: c.textSubtle, lineHeight: 15 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

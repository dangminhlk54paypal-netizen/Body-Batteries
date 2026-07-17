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
import { FoodLogModal } from './FoodLogModal';
import { PowerliftingSheet } from './PowerliftingSheet';
import { BodybuildingSheet } from './BodybuildingSheet';
import { parseTimeHHmmToday } from '../lib/dateUtils';
import type { ActivityType, CustomActivity, WorkoutSession } from '../types/energy';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

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
  const { t } = useT();
  const addCalories = useEnergyStore((s) => s.addCalories);
  const logActivity = useEnergyStore((s) => s.logActivity);
  const customActivities = useSettingsStore((s) => s.customActivities);
  const addCustomActivity = useSettingsStore((s) => s.addCustomActivity);
  const removeCustomActivity = useSettingsStore((s) => s.removeCustomActivity);

  const [foodOpen, setFoodOpen] = useState(false);
  const [calorieOpen, setCalorieOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [powerliftingOpen, setPowerliftingOpen] = useState(false);
  const [bodybuildingOpen, setBodybuildingOpen] = useState(false);
  const calorieSheetStyle = useSheetSlide(calorieOpen);
  const activitySheetStyle = useSheetSlide(activityOpen);

  const [kcal, setKcal] = useState('');
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

  // "＋ Thêm môn" inline form state — swaps in for the chip row while open.
  const [addingCustom, setAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('cardio');
  const [newCustomMet, setNewCustomMet] = useState('');

  function confirmCalories() {
    const v = parseFloat(kcal);
    if (!isNaN(v) && v > 0) addCalories(v);
    setKcal('');
    setCalorieOpen(false);
  }

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
    const met = parseFloat(newCustomMet);
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
    const mins = parseFloat(minutes);
    const stepCount = parseFloat(steps);
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
    logActivity({
      steps: !isNaN(stepCount) && stepCount > 0 ? stepCount : 0,
      workouts,
      startAt: parseTimeHHmmToday(startTime),
      endAt: parseTimeHHmmToday(endTime),
    });
    setMinutes('');
    setSteps('');
    setStartTime('');
    setEndTime('');
    setActivityOpen(false);
  }

  return (
    <View style={styles.container}>
      {/* Primary: log a food from the database (food_items.csv) */}
      <Pressable
        style={({ pressed }) => [styles.btn, styles.food, pressed && styles.pressed]}
        onPress={() => setFoodOpen(true)}
      >
        <Text style={styles.btnText}>{t('components.energyActionsBar.logFoodButton')}</Text>
      </Pressable>

      {/* Manual fallbacks: kept as supplementary inputs */}
      <View style={styles.bar}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.eat, pressed && styles.pressed]}
          onPress={() => setCalorieOpen(true)}
        >
          <Text style={styles.btnText}>{t('components.energyActionsBar.addCaloriesButton')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.move, pressed && styles.pressed]}
          onPress={() => setActivityOpen(true)}
        >
          <Text style={styles.btnText}>{t('components.energyActionsBar.activityButton')}</Text>
        </Pressable>
      </View>

      <FoodLogModal visible={foodOpen} onClose={() => setFoodOpen(false)} />

      {/* Manual calories */}
      <Modal visible={calorieOpen} transparent animationType="fade" onRequestClose={() => setCalorieOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <Animated.View style={[styles.sheet, calorieSheetStyle]}>
            <Text style={styles.title}>{t('components.energyActionsBar.calorieSheetTitle')}</Text>
            <Text style={styles.subtitle}>{t('components.energyActionsBar.calorieSheetSubtitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('components.energyActionsBar.kcalPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={kcal}
              onChangeText={setKcal}
              autoFocus
            />
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setCalorieOpen(false)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.eat, pressed && styles.pressed]}
                onPress={confirmCalories}
              >
                <Text style={styles.btnText}>{t('components.energyActionsBar.chargeButton')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

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
                  placeholderTextColor={colors.textMuted}
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
                  placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={minutes}
              onChangeText={setMinutes}
            />
            <TextInput
              style={styles.input}
              placeholder={t('components.energyActionsBar.stepsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={steps}
              onChangeText={setSteps}
            />
            <Text style={styles.subtitle}>{t('components.energyActionsBar.timeRangeSubtitle')}</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.energyActionsBar.fromTimePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={startTime}
                onChangeText={setStartTime}
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.energyActionsBar.toTimePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  bar: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  food: { backgroundColor: colors.infoAlt },
  eat: { backgroundColor: colors.accent },
  move: { backgroundColor: colors.danger },
  btnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeInput: { flex: 1, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryTabActive: { backgroundColor: colors.accentAltBg, borderColor: colors.accentAlt },
  categoryText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipLifting: { borderColor: colors.danger, borderWidth: 1 },
  chipLiftingText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.textPrimary },
  chipAdd: { borderColor: colors.accentAlt, borderStyle: 'dashed' },
  chipAddText: { color: colors.accentAlt, fontSize: 12, fontWeight: '700' },
  customChipWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customChipDelete: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customChipDeleteText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  addCustomForm: { gap: 10 },
  fieldLabel: { fontSize: 13, color: colors.textSecondary },
  explainer: { fontSize: 11, color: colors.textSubtle, lineHeight: 15 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.bgElevated },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

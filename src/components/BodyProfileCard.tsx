import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { useEnergyStore } from '../store/energyStore';
import { passiveDailyBurn } from '../domain/energy/metabolismEngine';
import { validateUserProfile } from '../domain/energy/profileValidation';
import { dailyCalorieTarget } from '../domain/energy/weightGoal';
import { PROFILE_LIMITS } from '../lib/metabolicConstants';
import { GOAL_WEIGHT_LIMITS, GOAL_WEEKS_LIMITS } from '../lib/weightGoalConstants';
import type { OccupationLevel, Sex, UserProfile } from '../types/energy';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';

const SEX_OPTIONS: { value: Sex; labelKey: string }[] = [
  { value: 'male', labelKey: 'components.bodyProfileCard.sexMale' },
  { value: 'female', labelKey: 'components.bodyProfileCard.sexFemale' },
];
const OCCUPATION_OPTIONS: { value: OccupationLevel; labelKey: string }[] = [
  { value: 'sedentary', labelKey: 'components.bodyProfileCard.occupationSedentary' },
  { value: 'light', labelKey: 'components.bodyProfileCard.occupationLight' },
  { value: 'active', labelKey: 'components.bodyProfileCard.occupationActive' },
];

// Lets the user enter their body profile (used to size the energy battery).
export function BodyProfileCard() {
  const { t } = useT();
  const { userProfile, setUserProfile, currentMode } = useSettingsStore();

  const [weight, setWeight] = useState(String(userProfile.weightKg));
  const [height, setHeight] = useState(String(userProfile.heightCm));
  const [age, setAge] = useState(String(userProfile.age));
  const [sex, setSex] = useState<Sex>(userProfile.sex);
  const [occupation, setOccupation] = useState<OccupationLevel>(userProfile.occupation);
  const [averageDailySteps, setAverageDailySteps] = useState(String(userProfile.averageDailySteps ?? 0));
  const [goalWeightKg, setGoalWeightKg] = useState(
    userProfile.goalWeightKg !== undefined ? String(userProfile.goalWeightKg) : ''
  );
  const [goalWeeks, setGoalWeeks] = useState(
    userProfile.goalWeeks !== undefined ? String(userProfile.goalWeeks) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Live preview of the daily passive energy need from the current inputs.
  const preview: UserProfile = {
    weightKg: parseFloat(weight) || userProfile.weightKg,
    heightCm: parseFloat(height) || userProfile.heightCm,
    age: parseFloat(age) || userProfile.age,
    sex,
    occupation,
    averageDailySteps: parseFloat(averageDailySteps) || 0,
    goalWeightKg: goalWeightKg.trim() === '' ? undefined : parseFloat(goalWeightKg),
    goalWeeks: goalWeeks.trim() === '' ? undefined : parseFloat(goalWeeks),
  };
  const tdee = passiveDailyBurn(preview);
  const calorieGoal = dailyCalorieTarget(preview);
  const hasGoal = preview.goalWeightKg !== undefined;

  // Any edit invalidates the last save/error feedback so it doesn't go stale.
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setError(null);
      setSaved(false);
    };
  }

  function handleSave() {
    const validationError = validateUserProfile(preview);
    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }
    setError(null);
    setUserProfile(preview);
    // Apply the new capacity to today's energy battery right away.
    useEnergyStore.getState().loadToday(currentMode);
    setSaved(true);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.explainer}>{t('components.bodyProfileCard.explainer')}</Text>

      <View style={styles.fieldRow}>
        <Field
          label={t('components.bodyProfileCard.weightLabel', {
            min: PROFILE_LIMITS.weightKg.min,
            max: PROFILE_LIMITS.weightKg.max,
          })}
          value={weight}
          onChange={withReset(setWeight)}
        />
        <Field
          label={t('components.bodyProfileCard.heightLabel', {
            min: PROFILE_LIMITS.heightCm.min,
            max: PROFILE_LIMITS.heightCm.max,
          })}
          value={height}
          onChange={withReset(setHeight)}
        />
        <Field
          label={t('components.bodyProfileCard.ageLabel', {
            min: PROFILE_LIMITS.age.min,
            max: PROFILE_LIMITS.age.max,
          })}
          value={age}
          onChange={withReset(setAge)}
        />
      </View>

      <Field
        label={t('components.bodyProfileCard.stepsLabel', {
          max: PROFILE_LIMITS.averageDailySteps.max,
        })}
        value={averageDailySteps}
        onChange={withReset(setAverageDailySteps)}
      />

      <Text style={styles.fieldLabel}>{t('components.bodyProfileCard.sexSectionLabel')}</Text>
      <View style={styles.chipRow}>
        {SEX_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => withReset(setSex)(o.value)}
            style={({ pressed }) => [
              styles.chip,
              sex === o.value && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, sex === o.value && styles.chipTextActive]}>{t(o.labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{t('components.bodyProfileCard.occupationSectionLabel')}</Text>
      <View style={styles.chipRow}>
        {OCCUPATION_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => withReset(setOccupation)(o.value)}
            style={({ pressed }) => [
              styles.chip,
              occupation === o.value && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, occupation === o.value && styles.chipTextActive]}>
              {t(o.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.tdee}>
        {t('components.bodyProfileCard.tdeeLabel')}{' '}
        <Text style={styles.tdeeValue}>{t('components.bodyProfileCard.kcalPerDayValue', { value: tdee })}</Text>
      </Text>

      <View style={styles.divider} />

      <Text style={styles.fieldLabel}>{t('components.bodyProfileCard.goalSectionLabel')}</Text>
      <View style={styles.fieldRow}>
        <Field
          label={t('components.bodyProfileCard.goalWeightLabel', {
            min: GOAL_WEIGHT_LIMITS.min,
            max: GOAL_WEIGHT_LIMITS.max,
          })}
          value={goalWeightKg}
          onChange={withReset(setGoalWeightKg)}
        />
        <Field
          label={t('components.bodyProfileCard.goalWeeksLabel', {
            min: GOAL_WEEKS_LIMITS.min,
            max: GOAL_WEEKS_LIMITS.max,
          })}
          value={goalWeeks}
          onChange={withReset(setGoalWeeks)}
        />
      </View>

      {hasGoal && (
        <View>
          <Text style={styles.tdee}>
            {t('components.bodyProfileCard.goalCalorieLabel')}{' '}
            <Text style={styles.tdeeValue}>
              {t('components.bodyProfileCard.kcalValue', { value: calorieGoal.targetKcal })}
            </Text>
          </Text>
          {calorieGoal.wasClamped && (
            <Text style={styles.noteText}>{t('components.bodyProfileCard.clampedNote')}</Text>
          )}
          <Text style={styles.disclaimerText}>{t('components.bodyProfileCard.medicalDisclaimer')}</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
      {saved && !error && (
        <Text style={styles.savedText}>{t('components.bodyProfileCard.savedText')}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
        onPress={handleSave}
      >
        <Text style={styles.saveText}>{t('components.bodyProfileCard.saveButton')}</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, gap: 12 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, color: colors.textTertiary },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.bgAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.textPrimary },
  tdee: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  tdeeValue: { color: colors.accent, fontWeight: '700' },
  explainer: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 },
  noteText: { color: colors.amber, fontSize: 12, marginTop: 2 },
  disclaimerText: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  errorText: { color: colors.dangerStrong, fontSize: 13 },
  savedText: { color: colors.accent, fontSize: 13 },
  saveBtn: { backgroundColor: colors.accent, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

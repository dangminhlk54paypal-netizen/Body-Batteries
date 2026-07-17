import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { useEnergyStore } from '../store/energyStore';
import { basalMetabolicRate, passiveDailyBurn, stepsKcal } from '../domain/energy/metabolismEngine';
import { validateUserProfile } from '../domain/energy/profileValidation';
import { dailyCalorieTarget } from '../domain/energy/weightGoal';
import { PROFILE_LIMITS, OCCUPATION_FACTORS, KCAL_PER_STEP_PER_KG } from '../lib/metabolicConstants';
import {
  GOAL_WEIGHT_LIMITS,
  GOAL_WEEKS_LIMITS,
  MAX_DEFICIT_PCT,
  MAX_DEFICIT_KCAL,
  KCAL_PER_KG_BODY_FAT,
} from '../lib/weightGoalConstants';
import type { OccupationLevel, Sex, UserProfile } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
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
  const styles = useThemedStyles(createStyles);
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
  // Which "how is this number computed?" popup is open (tap on a kcal value).
  const [infoPopup, setInfoPopup] = useState<'tdee' | 'goal' | null>(null);

  // Live preview of the daily passive energy need from the current inputs.
  const preview: UserProfile = {
    weightKg: parseDecimal(weight) || userProfile.weightKg,
    heightCm: parseDecimal(height) || userProfile.heightCm,
    age: parseDecimal(age) || userProfile.age,
    sex,
    occupation,
    averageDailySteps: parseDecimal(averageDailySteps) || 0,
    goalWeightKg: goalWeightKg.trim() === '' ? undefined : parseDecimal(goalWeightKg),
    goalWeeks: goalWeeks.trim() === '' ? undefined : parseDecimal(goalWeeks),
  };
  const tdee = passiveDailyBurn(preview);
  const calorieGoal = dailyCalorieTarget(preview);
  const hasGoal = preview.goalWeightKg !== undefined;

  // Intermediate numbers shown in the breakdown popups. Same functions/
  // constants the engines use, so the displayed math always matches tdee /
  // calorieGoal above (tdee = baseBurn + avgStepsBurn by construction).
  const bmr = basalMetabolicRate(preview);
  const occupationFactor = OCCUPATION_FACTORS[occupation];
  const baseBurn = Math.round(bmr * occupationFactor);
  const avgStepsBurn = stepsKcal(preview.averageDailySteps ?? 0, preview.weightKg);
  const occupationLabel = t(
    (OCCUPATION_OPTIONS.find((o) => o.value === occupation) ?? OCCUPATION_OPTIONS[0]).labelKey
  );
  // Goal-popup numbers (mirror dailyCalorieTarget's own steps).
  const isLoss = calorieGoal.appliedDeltaKcal > 0;
  const deltaAbs =
    Math.round(Math.abs(preview.weightKg - (preview.goalWeightKg ?? preview.weightKg)) * 10) / 10;
  const goalTotalKcal = Math.round(deltaAbs * KCAL_PER_KG_BODY_FAT);
  const goalDays =
    Number.isFinite(preview.goalWeeks) && (preview.goalWeeks as number) > 0
      ? (preview.goalWeeks as number) * 7
      : undefined;
  const requestedPerDay = goalDays !== undefined ? Math.round(goalTotalKcal / goalDays) : undefined;
  const safeCap = Math.round(Math.min(calorieGoal.maintenanceKcal * MAX_DEFICIT_PCT, MAX_DEFICIT_KCAL));
  const appliedAbs = Math.abs(calorieGoal.appliedDeltaKcal);

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

      <View style={styles.tdeeRow}>
        <Text style={styles.tdee}>{t('components.bodyProfileCard.tdeeLabel')}</Text>
        <Pressable
          onPress={() => setInfoPopup('tdee')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('components.bodyProfileCard.tdeeInfoA11y')}
        >
          <Text style={[styles.tdeeValue, styles.tdeeValueTap]}>
            {t('components.bodyProfileCard.kcalPerDayValue', { value: tdee })}
          </Text>
        </Pressable>
      </View>

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
          <View style={styles.tdeeRow}>
            <Text style={styles.tdee}>{t('components.bodyProfileCard.goalCalorieLabel')}</Text>
            <Pressable
              onPress={() => setInfoPopup('goal')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('components.bodyProfileCard.goalInfoA11y')}
            >
              <Text style={[styles.tdeeValue, styles.tdeeValueTap]}>
                {t('components.bodyProfileCard.kcalValue', { value: calorieGoal.targetKcal })}
              </Text>
            </Pressable>
          </View>
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

      <InfoPopup
        visible={infoPopup === 'tdee'}
        onClose={() => setInfoPopup(null)}
        title={t('components.bodyProfileCard.tdeeBreakdown.title')}
        closeLabel={t('components.bodyProfileCard.tdeeBreakdown.closeButton')}
      >
        <Text style={styles.infoIntro}>{t('components.bodyProfileCard.tdeeBreakdown.intro')}</Text>
        <InfoStep
          label={t('components.bodyProfileCard.tdeeBreakdown.bmrLabel')}
          formula={t(
            sex === 'male'
              ? 'components.bodyProfileCard.tdeeBreakdown.bmrFormulaMale'
              : 'components.bodyProfileCard.tdeeBreakdown.bmrFormulaFemale',
            { weight: preview.weightKg, height: preview.heightCm, age: preview.age }
          )}
          result={t('components.bodyProfileCard.tdeeBreakdown.resultPerDay', { value: bmr })}
        />
        <InfoStep
          label={t('components.bodyProfileCard.tdeeBreakdown.occupationLabel')}
          formula={t('components.bodyProfileCard.tdeeBreakdown.occupationFormula', {
            bmr,
            factor: occupationFactor,
            occupation: occupationLabel,
          })}
          result={t('components.bodyProfileCard.tdeeBreakdown.resultPerDay', { value: baseBurn })}
        />
        <InfoStep
          label={t('components.bodyProfileCard.tdeeBreakdown.stepsLabel')}
          formula={t('components.bodyProfileCard.tdeeBreakdown.stepsFormula', {
            steps: preview.averageDailySteps ?? 0,
            rate: KCAL_PER_STEP_PER_KG,
            weight: preview.weightKg,
          })}
          result={t('components.bodyProfileCard.tdeeBreakdown.stepsResult', { value: avgStepsBurn })}
        />
        <View style={styles.infoTotalRow}>
          <Text style={styles.infoTotalLabel}>
            {t('components.bodyProfileCard.tdeeBreakdown.totalLabel')}
          </Text>
          <Text style={styles.infoTotalValue}>
            {t('components.bodyProfileCard.tdeeBreakdown.totalValue', { value: tdee })}
          </Text>
        </View>
      </InfoPopup>

      <InfoPopup
        visible={infoPopup === 'goal'}
        onClose={() => setInfoPopup(null)}
        title={t('components.bodyProfileCard.goalBreakdown.title')}
        closeLabel={t('components.bodyProfileCard.goalBreakdown.closeButton')}
      >
        <InfoStep
          label={t('components.bodyProfileCard.goalBreakdown.maintenanceLabel')}
          result={t('components.bodyProfileCard.goalBreakdown.maintenanceValue', {
            value: calorieGoal.maintenanceKcal,
          })}
        />
        {calorieGoal.appliedDeltaKcal === 0 ? (
          <Text style={styles.infoNote}>
            {t('components.bodyProfileCard.goalBreakdown.noDeltaNote')}
          </Text>
        ) : (
          <>
            <InfoStep
              label={t(
                isLoss
                  ? 'components.bodyProfileCard.goalBreakdown.deltaLoseLabel'
                  : 'components.bodyProfileCard.goalBreakdown.deltaGainLabel',
                { delta: deltaAbs }
              )}
              formula={t('components.bodyProfileCard.goalBreakdown.deltaFormula', {
                delta: deltaAbs,
                kcalPerKg: KCAL_PER_KG_BODY_FAT,
                total: goalTotalKcal,
              })}
            />
            {goalDays !== undefined ? (
              <InfoStep
                label={t('components.bodyProfileCard.goalBreakdown.paceWeeksLabel', {
                  weeks: preview.goalWeeks ?? 0,
                  days: goalDays,
                })}
                formula={t('components.bodyProfileCard.goalBreakdown.paceWeeksFormula', {
                  total: goalTotalKcal,
                  days: goalDays,
                  perDay: requestedPerDay ?? 0,
                })}
              />
            ) : (
              <InfoStep
                label={t('components.bodyProfileCard.goalBreakdown.paceNoWeeksLabel')}
                result={t('components.bodyProfileCard.goalBreakdown.paceNoWeeksValue')}
              />
            )}
            <InfoStep
              label={t('components.bodyProfileCard.goalBreakdown.safetyLabel', {
                pct: MAX_DEFICIT_PCT * 100,
                maxAbs: MAX_DEFICIT_KCAL,
              })}
              result={t('components.bodyProfileCard.goalBreakdown.safetyValue', {
                applied: appliedAbs,
                cap: safeCap,
              })}
            />
            <View style={styles.infoTotalRow}>
              <Text style={styles.infoTotalLabel}>
                {t('components.bodyProfileCard.goalBreakdown.totalLabel')}
              </Text>
              <Text style={styles.infoFormula}>
                {t(
                  isLoss
                    ? 'components.bodyProfileCard.goalBreakdown.totalLoseFormula'
                    : 'components.bodyProfileCard.goalBreakdown.totalGainFormula',
                  { maintenance: calorieGoal.maintenanceKcal, applied: appliedAbs }
                )}
              </Text>
              <Text style={styles.infoTotalValue}>
                {t('components.bodyProfileCard.goalBreakdown.totalValue', {
                  value: calorieGoal.targetKcal,
                })}
              </Text>
            </View>
          </>
        )}
        <Text style={styles.infoNote}>
          {t('components.bodyProfileCard.goalBreakdown.bmrFloorNote', { bmr })}
        </Text>
        <Text style={styles.disclaimerText}>
          {t('components.bodyProfileCard.medicalDisclaimer')}
        </Text>
      </InfoPopup>
    </View>
  );
}

// Small centered popup explaining how a displayed number was computed.
// Tapping the dimmed backdrop or the close button dismisses it; the inner
// Pressable swallows taps on the card itself so they don't bubble to the
// backdrop.
function InfoPopup({
  visible,
  onClose,
  title,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.infoOverlay} onPress={onClose}>
        <Pressable style={styles.infoCard} onPress={() => {}}>
          <Text style={styles.infoTitle}>{title}</Text>
          <ScrollView style={styles.infoScroll} contentContainerStyle={styles.infoScrollContent}>
            {children}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [styles.infoCloseBtn, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.infoCloseText}>{closeLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// One numbered step of a breakdown: label + (optional) formula + result.
function InfoStep({ label, formula, result }: { label: string; formula?: string; result?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.infoStep}>
      <Text style={styles.infoStepLabel}>{label}</Text>
      {formula !== undefined && <Text style={styles.infoFormula}>{formula}</Text>}
      {result !== undefined && <Text style={styles.infoResult}>{result}</Text>}
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholderTextColor={c.textMuted} />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: c.bgCard, borderRadius: 12, padding: 14, gap: 12 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, color: c.textTertiary },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: c.bgAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: c.textPrimary },
  tdee: { color: c.textSecondary, fontSize: 13 },
  tdeeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 5, marginTop: 4 },
  tdeeValue: { color: c.accent, fontWeight: '700', fontSize: 13 },
  tdeeValueTap: { textDecorationLine: 'underline' },
  infoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 24,
  },
  infoCard: {
    backgroundColor: c.bgCard,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    alignSelf: 'stretch',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: c.border,
  },
  infoTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoScrollContent: { gap: 12 },
  infoIntro: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  infoStep: { gap: 2 },
  infoStepLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  infoFormula: { color: c.textTertiary, fontSize: 13, fontVariant: ['tabular-nums'] },
  infoResult: { color: c.accent, fontSize: 13, fontWeight: '600' },
  infoTotalRow: {
    borderTopWidth: 1,
    borderTopColor: c.borderSubtle,
    paddingTop: 10,
    gap: 2,
  },
  infoTotalLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  infoTotalValue: { color: c.accent, fontSize: 16, fontWeight: '800' },
  infoNote: { color: c.textMuted, fontSize: 11, lineHeight: 15, fontStyle: 'italic' },
  infoCloseBtn: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  infoCloseText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
  explainer: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  divider: { height: 1, backgroundColor: c.borderSubtle, marginVertical: 2 },
  noteText: { color: c.amber, fontSize: 12, marginTop: 2 },
  disclaimerText: { color: c.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  errorText: { color: c.dangerStrong, fontSize: 13 },
  savedText: { color: c.accent, fontSize: 13 },
  saveBtn: { backgroundColor: c.accent, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { useSettingsStore } from '../store/settingsStore';
import { useBlockStore } from '../store/blockStore';
import { estimateBeginnerOneRepMax } from '../domain/energy/blockEngine';
import { variationsForExercise } from '../lib/powerliftingVariations';
import { weekdayLabel } from '../lib/dateUtils';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';
import * as haptics from '../lib/haptics';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import type { LiftingExercise } from '../types/energy';
import { LIFTING_EXERCISES } from '../types/energy';
import type {
  AccessoryLineItem,
  BlockDayPlan,
  BlockDayVariation,
  GeneratedBlockPlan,
  NewTrainingBlockConfig,
  OneRepMaxInput,
  TrainingFocus,
} from '../types/powerliftingBlock';

const STEPS = ['length', 'profile', 'focus', 'schedule', 'deficit', 'summary'] as const;
type Step = (typeof STEPS)[number];

const WEEKDAYS: (0 | 1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, more natural for a training week

function newDay(): BlockDayPlan {
  return { dayOfWeek: 1, variations: [], accessories: [] };
}

function newVariation(exercise: LiftingExercise, isFirst: boolean): BlockDayVariation {
  const first = variationsForExercise(exercise)[0];
  return { exercise, variationId: first.id, role: isFirst ? 'main' : 'secondary' };
}

function newAccessory(): AccessoryLineItem {
  return { customName: '', sets: 3, reps: '8-12' };
}

interface OneRmInputs {
  squat: string;
  bench_press: string;
  deadlift: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (plan: GeneratedBlockPlan) => void;
}

export function BlockBuilderWizard({ visible, onClose, onCreated }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const profile = useSettingsStore((s) => s.userProfile);
  const createBlock = useBlockStore((s) => s.createBlock);

  const [stepIndex, setStepIndex] = useState(0);
  const [progressiveWeeksInput, setProgressiveWeeksInput] = useState('5');
  const [hasDeload, setHasDeload] = useState(true);
  const [bodyWeightInput, setBodyWeightInput] = useState(String(profile.weightKg));
  const [oneRm, setOneRm] = useState<OneRmInputs>({ squat: '', bench_press: '', deadlift: '' });
  const [focus, setFocus] = useState<TrainingFocus>('normal');
  const [days, setDays] = useState<BlockDayPlan[]>([]);
  const [deficitModeEnabled, setDeficitModeEnabled] = useState(
    profile.goalWeightKg != null && profile.goalWeightKg < profile.weightKg
  );
  const [submitting, setSubmitting] = useState(false);

  const step: Step = STEPS[stepIndex];
  const bodyWeightKg = parseDecimal(bodyWeightInput) || 0;
  const progressiveWeeks = Math.max(1, Math.round(parseDecimal(progressiveWeeksInput)) || 1);

  function resetAndClose() {
    setStepIndex(0);
    setProgressiveWeeksInput('5');
    setHasDeload(true);
    setBodyWeightInput(String(profile.weightKg));
    setOneRm({ squat: '', bench_press: '', deadlift: '' });
    setFocus('normal');
    setDays([]);
    onClose();
  }

  function goNext() {
    if (step === 'schedule' && (days.length === 0 || days.some((d) => d.variations.length === 0))) {
      haptics.warning();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function updateDay(index: number, patch: Partial<BlockDayPlan>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function addDay() {
    setDays((prev) => [...prev, newDay()]);
  }
  function removeDay(index: number) {
    setDays((prev) => prev.filter((_, i) => i !== index));
  }

  function addVariation(dayIndex: number) {
    const day = days[dayIndex];
    updateDay(dayIndex, { variations: [...day.variations, newVariation('squat', day.variations.length === 0)] });
  }
  function updateVariation(dayIndex: number, varIndex: number, patch: Partial<BlockDayVariation>) {
    const day = days[dayIndex];
    updateDay(dayIndex, {
      variations: day.variations.map((v, i) => (i === varIndex ? { ...v, ...patch } : v)),
    });
  }
  function removeVariation(dayIndex: number, varIndex: number) {
    const day = days[dayIndex];
    updateDay(dayIndex, { variations: day.variations.filter((_, i) => i !== varIndex) });
  }

  function addAccessory(dayIndex: number) {
    const day = days[dayIndex];
    updateDay(dayIndex, { accessories: [...day.accessories, newAccessory()] });
  }
  function updateAccessory(dayIndex: number, accIndex: number, patch: Partial<AccessoryLineItem>) {
    const day = days[dayIndex];
    updateDay(dayIndex, {
      accessories: day.accessories.map((a, i) => (i === accIndex ? { ...a, ...patch } : a)),
    });
  }
  function removeAccessory(dayIndex: number, accIndex: number) {
    const day = days[dayIndex];
    updateDay(dayIndex, { accessories: day.accessories.filter((_, i) => i !== accIndex) });
  }

  async function handleCreate() {
    setSubmitting(true);
    const oneRepMax: OneRepMaxInput = {
      squat: parseDecimal(oneRm.squat) || undefined,
      bench_press: parseDecimal(oneRm.bench_press) || undefined,
      deadlift: parseDecimal(oneRm.deadlift) || undefined,
    };
    const config: NewTrainingBlockConfig = {
      progressiveWeeks,
      hasDeload,
      focus,
      schedule: days,
      oneRepMax,
      isBeginnerEstimated: {
        squat: !oneRepMax.squat,
        bench_press: !oneRepMax.bench_press,
        deadlift: !oneRepMax.deadlift,
      },
      bodyWeightKg,
      deficitModeEnabled,
    };
    const plan = await createBlock(config, { ...profile, weightKg: bodyWeightKg });
    haptics.success();
    setSubmitting(false);
    onCreated?.(plan);
    resetAndClose();
  }

  function renderChip(label: string, active: boolean, onPress: () => void, key?: string) {
    return (
      <Pressable
        key={key ?? label}
        onPress={onPress}
        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  function renderLengthStep() {
    return (
      <View style={styles.stepBody}>
        <Text style={styles.fieldLabel}>{t('blockBuilder.progressiveWeeksLabel')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={progressiveWeeksInput}
          onChangeText={setProgressiveWeeksInput}
        />
        <Pressable
          style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          onPress={() => setHasDeload((v) => !v)}
        >
          <Text style={styles.fieldLabel}>{t('blockBuilder.hasDeloadLabel')}</Text>
          <View style={[styles.switch, hasDeload && styles.switchOn]}>
            <View style={[styles.switchKnob, hasDeload && styles.switchKnobOn]} />
          </View>
        </Pressable>
      </View>
    );
  }

  function renderProfileStep() {
    return (
      <View style={styles.stepBody}>
        <Text style={styles.fieldLabel}>{t('blockBuilder.bodyWeightLabel')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={bodyWeightInput}
          onChangeText={setBodyWeightInput}
        />
        <Text style={styles.sectionTitle}>{t('blockBuilder.oneRmSectionTitle')}</Text>
        {LIFTING_EXERCISES.map((exercise) => {
          const key = exercise === 'squat' ? 'squat' : exercise === 'bench_press' ? 'bench_press' : 'deadlift';
          const labelKey =
            exercise === 'squat'
              ? 'blockBuilder.oneRmSquatLabel'
              : exercise === 'bench_press'
                ? 'blockBuilder.oneRmBenchLabel'
                : 'blockBuilder.oneRmDeadliftLabel';
          const raw = oneRm[key];
          const showEstimate = parseDecimal(raw) <= 0 && bodyWeightKg > 0;
          return (
            <View key={exercise} style={styles.oneRmRow}>
              <Text style={styles.fieldLabel}>{t(labelKey)}</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={raw}
                onChangeText={(v) => setOneRm((prev) => ({ ...prev, [key]: v }))}
              />
              {showEstimate && (
                <Text style={styles.estimateNote}>
                  {t('blockBuilder.beginnerEstimateNote', {
                    value: estimateBeginnerOneRepMax(exercise, bodyWeightKg),
                  })}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  function renderFocusStep() {
    const cards: { key: TrainingFocus; labelKey: string; descKey: string }[] = [
      { key: 'volume', labelKey: 'blockBuilder.focusVolumeLabel', descKey: 'blockBuilder.focusVolumeDescription' },
      {
        key: 'intensity',
        labelKey: 'blockBuilder.focusIntensityLabel',
        descKey: 'blockBuilder.focusIntensityDescription',
      },
      { key: 'normal', labelKey: 'blockBuilder.focusNormalLabel', descKey: 'blockBuilder.focusNormalDescription' },
      { key: 'peaking', labelKey: 'blockBuilder.focusPeakingLabel', descKey: 'blockBuilder.focusPeakingDescription' },
    ];
    return (
      <View style={styles.stepBody}>
        {cards.map((card) => {
          const active = focus === card.key;
          return (
            <Pressable
              key={card.key}
              onPress={() => setFocus(card.key)}
              style={({ pressed }) => [styles.focusCard, active && styles.focusCardActive, pressed && styles.pressed]}
            >
              <Text style={[styles.focusCardTitle, active && styles.focusCardTitleActive]}>{t(card.labelKey)}</Text>
              <Text style={styles.focusCardDesc}>{t(card.descKey)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderScheduleStep() {
    return (
      <View style={styles.stepBody}>
        {days.length === 0 && <Text style={styles.emptyText}>{t('blockBuilder.scheduleEmptyText')}</Text>}
        {days.map((day, dayIndex) => (
          <View key={dayIndex} style={styles.dayCard}>
            <View style={styles.dayHeaderRow}>
              <Text style={styles.fieldLabel}>{t('blockBuilder.scheduleDayLabel')}</Text>
              <Pressable hitSlop={8} onPress={() => removeDay(dayIndex)}>
                <Text style={styles.removeText}>{t('blockBuilder.scheduleRemoveDayButton')}</Text>
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              {WEEKDAYS.map((dow) =>
                renderChip(
                  weekdayLabel(dow, language, 'short'),
                  day.dayOfWeek === dow,
                  () => updateDay(dayIndex, { dayOfWeek: dow }),
                  String(dow)
                )
              )}
            </View>

            <Text style={styles.sectionTitle}>{t('blockBuilder.scheduleVariationSectionTitle')}</Text>
            {day.variations.map((variation, varIndex) => (
              <View key={varIndex} style={styles.variationRow}>
                <View style={styles.chipRow}>
                  {LIFTING_EXERCISES.map((ex) =>
                    renderChip(
                      t(`activities.${ex}`),
                      variation.exercise === ex,
                      () => {
                        const firstVariation = variationsForExercise(ex)[0];
                        updateVariation(dayIndex, varIndex, { exercise: ex, variationId: firstVariation.id });
                      },
                      ex
                    )
                  )}
                </View>
                <View style={styles.chipRow}>
                  {variationsForExercise(variation.exercise).map((v) =>
                    renderChip(
                      t(`blockVariations.${v.id}.label`),
                      variation.variationId === v.id,
                      () => updateVariation(dayIndex, varIndex, { variationId: v.id }),
                      v.id
                    )
                  )}
                </View>
                <View style={styles.chipRow}>
                  {renderChip(
                    t('blockBuilder.scheduleRoleMain'),
                    variation.role === 'main',
                    () => updateVariation(dayIndex, varIndex, { role: 'main' })
                  )}
                  {renderChip(
                    t('blockBuilder.scheduleRoleSecondary'),
                    variation.role === 'secondary',
                    () => updateVariation(dayIndex, varIndex, { role: 'secondary' })
                  )}
                  <Pressable hitSlop={8} onPress={() => removeVariation(dayIndex, varIndex)}>
                    <Text style={styles.removeText}>{t('blockBuilder.scheduleRemoveVariationButton')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              onPress={() => addVariation(dayIndex)}
            >
              <Text style={styles.addText}>{t('blockBuilder.scheduleAddVariationButton')}</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>{t('blockBuilder.scheduleAccessorySectionTitle')}</Text>
            {day.accessories.map((acc, accIndex) => (
              <View key={accIndex} style={styles.accessoryRow}>
                <TextInput
                  style={[styles.input, styles.accessoryNameInput]}
                  placeholder={t('blockBuilder.accessoryNamePlaceholder')}
                  placeholderTextColor={c.textMuted}
                  value={acc.customName}
                  onChangeText={(v) => updateAccessory(dayIndex, accIndex, { customName: v })}
                />
                <TextInput
                  style={[styles.input, styles.accessorySmallInput]}
                  placeholder={t('blockBuilder.accessorySetsPlaceholder')}
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  value={String(acc.sets)}
                  onChangeText={(v) => updateAccessory(dayIndex, accIndex, { sets: Math.max(1, Math.round(parseDecimal(v)) || 1) })}
                />
                <TextInput
                  style={[styles.input, styles.accessorySmallInput]}
                  placeholder={t('blockBuilder.accessoryRepsPlaceholder')}
                  placeholderTextColor={c.textMuted}
                  value={acc.reps}
                  onChangeText={(v) => updateAccessory(dayIndex, accIndex, { reps: v })}
                />
                <Pressable hitSlop={8} onPress={() => removeAccessory(dayIndex, accIndex)}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              onPress={() => addAccessory(dayIndex)}
            >
              <Text style={styles.addText}>{t('blockBuilder.scheduleAddAccessoryButton')}</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} onPress={addDay}>
          <Text style={styles.addText}>{t('blockBuilder.scheduleAddDayButton')}</Text>
        </Pressable>
        {(days.length === 0 || days.some((d) => d.variations.length === 0)) && (
          <Text style={styles.validationText}>
            {days.length === 0 ? t('blockBuilder.validationNeedDay') : t('blockBuilder.validationNeedVariation')}
          </Text>
        )}
      </View>
    );
  }

  function renderDeficitStep() {
    const hasGoal = profile.goalWeightKg != null && profile.goalWeightKg < bodyWeightKg;
    return (
      <View style={styles.stepBody}>
        {hasGoal ? (
          <Text style={styles.estimateNote}>{t('blockBuilder.deficitAutoOnNote')}</Text>
        ) : (
          <Text style={styles.estimateNote}>{t('blockBuilder.deficitNoGoalNote')}</Text>
        )}
        <Pressable
          style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          onPress={() => setDeficitModeEnabled((v) => !v)}
        >
          <Text style={styles.fieldLabel}>{t('blockBuilder.deficitToggleLabel')}</Text>
          <View style={[styles.switch, deficitModeEnabled && styles.switchOn]}>
            <View style={[styles.switchKnob, deficitModeEnabled && styles.switchKnobOn]} />
          </View>
        </Pressable>
        {deficitModeEnabled && <Text style={styles.description}>{t('blockBuilder.deficitExplanation')}</Text>}
      </View>
    );
  }

  function renderSummaryStep() {
    return (
      <View style={styles.stepBody}>
        <Text style={styles.summaryLine}>
          {t('blockBuilder.summaryWeeksLine', {
            weeks: progressiveWeeks,
            deload: hasDeload ? t('blockBuilder.summaryDeloadSuffix') : '',
          })}
        </Text>
        <Text style={styles.summaryLine}>
          {t('blockBuilder.summaryFocusLine', { focus: t(`blockBuilder.focus${capitalize(focus)}Label`) })}
        </Text>
        <Text style={styles.summaryLine}>{t('blockBuilder.summaryDayCountLine', { count: days.length })}</Text>
        <Text style={styles.summaryLine}>
          {deficitModeEnabled ? t('blockBuilder.summaryDeficitOnLine') : t('blockBuilder.summaryDeficitOffLine')}
        </Text>
      </View>
    );
  }

  const stepRenderers: Record<Step, () => React.ReactNode> = {
    length: renderLengthStep,
    profile: renderProfileStep,
    focus: renderFocusStep,
    schedule: renderScheduleStep,
    deficit: renderDeficitStep,
    summary: renderSummaryStep,
  };

  const stepTitleKeys: Record<Step, string> = {
    length: 'blockBuilder.stepLength',
    profile: 'blockBuilder.stepProfile',
    focus: 'blockBuilder.stepFocus',
    schedule: 'blockBuilder.stepSchedule',
    deficit: 'blockBuilder.stepDeficit',
    summary: 'blockBuilder.stepSummary',
  };

  const isLastStep = stepIndex === STEPS.length - 1;
  const scheduleInvalid = days.length === 0 || days.some((d) => d.variations.length === 0);

  return (
    <BottomSheet visible={visible} onClose={resetAndClose} sheetOffset={700}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('blockBuilder.title')}</Text>
        <Text style={styles.subtitle}>{t(stepTitleKeys[step])}</Text>

        {stepRenderers[step]()}

        <View style={styles.row}>
          {stepIndex > 0 && (
            <Pressable style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]} onPress={goBack}>
              <Text style={styles.cancelText}>{t('blockBuilder.backButton')}</Text>
            </Pressable>
          )}
          {!isLastStep ? (
            <Pressable
              disabled={step === 'schedule' && scheduleInvalid}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.confirm,
                step === 'schedule' && scheduleInvalid && styles.confirmDisabled,
                pressed && styles.pressed,
              ]}
              onPress={goNext}
            >
              <Text style={styles.btnText}>{t('blockBuilder.nextButton')}</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={submitting}
              style={({ pressed }) => [styles.modalBtn, styles.confirm, pressed && styles.pressed]}
              onPress={handleCreate}
            >
              <Text style={styles.btnText}>{t('blockBuilder.createButton')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scroll: { flexShrink: 1 },
    content: { padding: 24, paddingTop: 12, gap: 12 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    subtitle: { fontSize: 14, fontWeight: '600', color: c.accent },
    stepBody: { gap: 10 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.textSoft },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textBright, marginTop: 6 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      paddingVertical: 9,
      paddingHorizontal: 10,
      fontSize: 15,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    oneRmRow: { gap: 4 },
    estimateNote: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    description: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switch: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      padding: 2,
    },
    switchOn: { backgroundColor: c.accent, borderColor: c.accent },
    switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.bgCard },
    switchKnobOn: { alignSelf: 'flex-end' },
    focusCard: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      gap: 4,
    },
    focusCardActive: { borderColor: c.accent, backgroundColor: c.bgHighlight },
    focusCardTitle: { fontSize: 15, fontWeight: '700', color: c.textBright },
    focusCardTitleActive: { color: c.accent },
    focusCardDesc: { fontSize: 12, color: c.textTertiary, lineHeight: 16 },
    emptyText: { color: c.textMuted, fontSize: 13 },
    dayCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
      gap: 8,
      marginBottom: 4,
    },
    dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: c.bg },
    variationRow: { gap: 6, paddingTop: 4 },
    removeText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    addBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
    },
    addText: { color: c.infoAlt, fontSize: 12, fontWeight: '700' },
    accessoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    accessoryNameInput: { flex: 2 },
    accessorySmallInput: { flex: 1, textAlign: 'center' },
    validationText: { color: c.dangerStrong, fontSize: 12, marginTop: 4 },
    summaryLine: { color: c.textBright, fontSize: 14, fontWeight: '600' },
    row: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.danger },
    confirmDisabled: { opacity: 0.5 },
    btnText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

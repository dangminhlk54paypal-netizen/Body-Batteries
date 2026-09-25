import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { useSettingsStore } from '../store/settingsStore';
import { useBlockStore } from '../store/blockStore';
import { estimateBeginnerOneRepMax } from '../domain/energy/blockEngine';
import { blockStartForCurrentWeek, nextBlockNumber } from '../domain/energy/blockStart';
import { blockWeekDates, mergeSameWeekday } from '../domain/energy/blockSchedule';
import { formatDisplayDate, upcomingMondays } from '../lib/dateUtils';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';
import * as haptics from '../lib/haptics';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { LIFTING_EXERCISES } from '../types/energy';
import { BlockScheduleEditor } from './training/BlockScheduleEditor';
import type {
  BlockDayPlan,
  GeneratedBlockPlan,
  NewTrainingBlockConfig,
  OneRepMaxInput,
  TrainingFocus,
} from '../types/powerliftingBlock';
import { listTrainingBlocks } from '../data/repositories/trainingBlockRepository';

const STEPS = ['length', 'profile', 'focus', 'schedule', 'deficit', 'summary'] as const;
type Step = (typeof STEPS)[number];

// How many upcoming Mondays to offer as quick-picks for "which week does
// this block start" — people typically plan 1-2 weeks ahead, so a handful
// of choices past that covers the realistic range without a full calendar.
const MONDAY_QUICK_PICK_COUNT = 5;

// The user's own SBD split (Mon paused bench+incline / Wed main squat+paused
// deadlift / Fri touch-and-go bench+low grip / Sun main deadlift+paused
// squat) — offered as a one-tap starting point in the schedule step.
function suggestedTemplateDays(): BlockDayPlan[] {
  return [
    {
      dayOfWeek: 1,
      variations: [
        { exercise: 'bench_press', variationId: 'bench_paused', role: 'main' },
        { exercise: 'bench_press', variationId: 'bench_incline', role: 'secondary' },
      ],
      accessories: [],
    },
    {
      dayOfWeek: 3,
      variations: [
        { exercise: 'squat', variationId: 'squat_standard', role: 'main' },
        { exercise: 'deadlift', variationId: 'deadlift_paused', role: 'secondary' },
      ],
      accessories: [],
    },
    {
      dayOfWeek: 5,
      variations: [
        { exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' },
        { exercise: 'bench_press', variationId: 'bench_low_grip', role: 'secondary' },
      ],
      accessories: [],
    },
    {
      dayOfWeek: 0,
      variations: [
        { exercise: 'deadlift', variationId: 'deadlift_standard', role: 'main' },
        { exercise: 'squat', variationId: 'squat_paused', role: 'secondary' },
      ],
      accessories: [],
    },
  ];
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
  const styles = useThemedStyles(createStyles);
  const profile = useSettingsStore((s) => s.userProfile);
  const createBlock = useBlockStore((s) => s.createBlock);

  const mondayChoices = useState(() => upcomingMondays(MONDAY_QUICK_PICK_COUNT))[0];

  const [stepIndex, setStepIndex] = useState(0);
  const [pickedStartDate, setWeekStartDate] = useState(mondayChoices[1] ?? mondayChoices[0]); // default: next Monday
  // "Block số 3, đang ở tuần 4": a lifter joining mid-block. Week 1 = a new
  // block starting on the picked Monday; week k > 1 = it began k-1 weeks ago.
  const [blockNumberInput, setBlockNumberInput] = useState('1');
  const [currentWeekPick, setCurrentWeek] = useState(1);
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

  // Most recent past block, fetched on open — offered as a one-tap "reuse
  // last setup" so the user doesn't retype 1RM/bodyweight/schedule every
  // block. Same promise + cancelled-flag pattern as PowerliftingSheet's
  // "Dùng làm mẫu" history fetch.
  const [prevBlock, setPrevBlock] = useState<GeneratedBlockPlan | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listTrainingBlocks().then((blocks) => {
      if (cancelled) return;
      setPrevBlock(blocks[0] ?? null);
      setBlockNumberInput(String(nextBlockNumber(blocks)));
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const step: Step = STEPS[stepIndex];
  const bodyWeightKg = parseDecimal(bodyWeightInput) || 0;
  const progressiveWeeks = Math.max(1, Math.round(parseDecimal(progressiveWeeksInput)) || 1);
  const totalWeeks = progressiveWeeks + (hasDeload ? 1 : 0);
  const blockNumber = Math.round(parseDecimal(blockNumberInput));
  const currentWeek = Math.min(currentWeekPick, totalWeeks); // a shorter block pulls the pick back
  const blockNumberValid = Number.isFinite(blockNumber) && blockNumber >= 1 && blockNumber <= 999;
  // Mid-block: week 1 began (currentWeek - 1) Mondays before this one.
  const weekStartDate = currentWeek > 1 ? blockStartForCurrentWeek(mondayChoices[0], currentWeek) : pickedStartDate;
  const scheduleInvalid = days.length === 0 || days.some((d) => d.variations.length === 0);
  const weekDates = blockWeekDates(weekStartDate, progressiveWeeks, hasDeload);
  const weekName = (w: { week: number; isDeload: boolean }) =>
    w.isDeload ? t('trainingLog.deloadLabel', { b: blockNumber }) : t('trainingLog.weekLabel', { b: blockNumber, n: w.week });

  function resetAndClose() {
    setStepIndex(0);
    setWeekStartDate(mondayChoices[1] ?? mondayChoices[0]);
    setCurrentWeek(1);
    setProgressiveWeeksInput('5');
    setHasDeload(true);
    setBodyWeightInput(String(profile.weightKg));
    setOneRm({ squat: '', bench_press: '', deadlift: '' });
    setFocus('normal');
    setDays([]);
    onClose();
  }

  // Copies the previous block's bodyweight/1RM/schedule as a starting point
  // — deliberately does NOT copy focus/Deficit Mode, since those are the
  // knobs a user most often changes block-to-block (cutting, pushing
  // intensity harder, etc.) rather than the physical numbers.
  function applyPrevBlockConfig() {
    if (!prevBlock) return;
    const prev = prevBlock.config;
    setBodyWeightInput(String(prev.bodyWeightKg));
    setOneRm({
      squat: prev.oneRepMax.squat ? String(prev.oneRepMax.squat) : '',
      bench_press: prev.oneRepMax.bench_press ? String(prev.oneRepMax.bench_press) : '',
      deadlift: prev.oneRepMax.deadlift ? String(prev.oneRepMax.deadlift) : '',
    });
    setDays(mergeSameWeekday(prev.schedule));
  }

  function goNext() {
    if (step === 'length' && !blockNumberValid) {
      haptics.warning();
      return;
    }
    if (step === 'schedule' && scheduleInvalid) {
      haptics.warning();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleCreate() {
    setSubmitting(true);
    const oneRepMax: OneRepMaxInput = {
      squat: parseDecimal(oneRm.squat) || undefined,
      bench_press: parseDecimal(oneRm.bench_press) || undefined,
      deadlift: parseDecimal(oneRm.deadlift) || undefined,
    };
    const config: NewTrainingBlockConfig = {
      blockNumber,
      weekStartDate,
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
        {prevBlock && (
          <Pressable
            style={({ pressed }) => [styles.templateBtn, pressed && styles.pressed]}
            onPress={applyPrevBlockConfig}
          >
            <Text style={styles.templateBtnText}>{t('blockBuilder.usePrevBlockButton')}</Text>
          </Pressable>
        )}

        <View style={styles.inlineRow}>
          <Text style={[styles.fieldLabel, styles.inlineLabel]}>{t('blockBuilder.blockNumberLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            keyboardType="number-pad"
            value={blockNumberInput}
            onChangeText={setBlockNumberInput}
            accessibilityLabel={t('blockBuilder.blockNumberLabel')}
          />
        </View>
        {!blockNumberValid && <Text style={styles.errorText}>{t('blockBuilder.blockNumberInvalid')}</Text>}

        <View style={styles.inlineRow}>
          <Text style={[styles.fieldLabel, styles.inlineLabel]}>{t('blockBuilder.progressiveWeeksLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            keyboardType="number-pad"
            value={progressiveWeeksInput}
            onChangeText={setProgressiveWeeksInput}
            accessibilityLabel={t('blockBuilder.progressiveWeeksLabel')}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          onPress={() => setHasDeload((v) => !v)}
        >
          <Text style={styles.fieldLabel}>{t('blockBuilder.hasDeloadLabel')}</Text>
          <View style={[styles.switch, hasDeload && styles.switchOn]}>
            <View style={[styles.switchKnob, hasDeload && styles.switchKnobOn]} />
          </View>
        </Pressable>

        {/* "Which week are you in?" as one tap per week; the table below
            shows each week's real dates as you pick, this week marked. */}
        <Text style={styles.fieldLabel}>{t('blockBuilder.currentWeekLabel')}</Text>
        <View style={styles.chipRow}>
          {weekDates.map((w) =>
            renderChip(
              w.isDeload ? t('trainingLog.deloadShort') : t('trainingLog.weekShort', { n: w.week }),
              currentWeek === w.week,
              () => setCurrentWeek(w.week),
              `w${w.week}`
            )
          )}
        </View>
        {currentWeek === 1 && (
          <>
            <Text style={styles.fieldLabel}>{t('blockBuilder.weekStartDateLabel')}</Text>
            <View style={styles.chipRow}>
              {mondayChoices.map((monday, i) =>
                renderChip(
                  i === 0
                    ? t('blockBuilder.weekStartThisWeek', { date: formatDisplayDate(monday, language) })
                    : formatDisplayDate(monday, language),
                  weekStartDate === monday,
                  () => setWeekStartDate(monday),
                  monday
                )
              )}
            </View>
          </>
        )}

        <View style={styles.weekTable}>
          {weekDates.map((w) => {
            const now = w.start === mondayChoices[0];
            return (
              <View key={w.week} style={[styles.weekRow, now && styles.weekRowNow]}>
                <Text style={[styles.weekRowLabel, now && styles.weekRowTextNow]}>{weekName(w)}</Text>
                <Text style={[styles.weekRowDates, now && styles.weekRowTextNow]}>
                  {formatDisplayDate(w.start, language)} – {formatDisplayDate(w.end, language)}
                </Text>
                {now && <Text style={styles.nowBadge}>{t('planAppendix.thisWeekBadge')}</Text>}
              </View>
            );
          })}
        </View>
        <Text style={styles.description}>{t('blockBuilder.currentWeekHint')}</Text>
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
        <BlockScheduleEditor days={days} onChange={setDays} onUseTemplate={() => setDays(suggestedTemplateDays())} />
        {scheduleInvalid && (
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
        <Text style={styles.summaryLine}>{t('blockBuilder.summaryBlockNumberLine', { n: blockNumber })}</Text>
        <Text style={styles.summaryLine}>
          {t('blockBuilder.summaryStartDateLine', { date: formatDisplayDate(weekStartDate, language) })}
        </Text>
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

        {/* Every week's real dates up front; each one can be moved later in
            the plan, and the weeks after it follow. */}
        <Text style={styles.description}>{t('blockBuilder.summaryWeekDatesTitle')}</Text>
        {weekDates.map((w) => (
          <Text key={w.week} style={styles.description}>
            {t('blockBuilder.summaryWeekDatesLine', {
              week: weekName(w),
              start: formatDisplayDate(w.start, language),
              end: formatDisplayDate(w.end, language),
            })}
          </Text>
        ))}
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
    errorText: { color: c.danger, fontSize: 12, lineHeight: 17 },
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
    templateBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.accentAltBg,
      borderWidth: 1,
      borderColor: c.accentAlt,
    },
    templateBtnText: { color: c.accentAltLight, fontSize: 12, fontWeight: '700' },
    validationText: { color: c.dangerStrong, fontSize: 12, marginTop: 4 },
    inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    inlineLabel: { flex: 1 },
    inlineInput: { width: 72, textAlign: 'center' },
    weekTable: { borderRadius: 10, backgroundColor: c.bgElevated, paddingVertical: 4 },
    weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, paddingHorizontal: 10 },
    weekRowNow: { backgroundColor: c.bgHighlight },
    weekRowLabel: { width: 84, fontSize: 12, fontWeight: '700', color: c.textSoft },
    weekRowDates: { flex: 1, fontSize: 12, color: c.textTertiary },
    weekRowTextNow: { color: c.accent },
    nowBadge: { fontSize: 11, fontWeight: '700', fontStyle: 'italic', color: c.accent },
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

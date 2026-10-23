import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { InfoPopover } from '../ui/InfoPopover';
import { BlockBuilderWizard } from '../BlockBuilderWizard';
import { BlockVariationEditSheet } from './BlockVariationEditSheet';
import { BlockWeekDatesSheet } from './BlockWeekDatesSheet';
import { BlockSessionDateSheet } from './BlockSessionDateSheet';
import { BlockAccessoriesSheet } from './BlockAccessoriesSheet';
import { BlockLiftGrid } from './BlockLiftGrid';
import { BlockFormView } from './BlockFormView';
import { RpeChips } from './RpeChips';
import { RpeCoachCard } from './RpeCoachCard';
import { coachAdvice } from '../../domain/energy/rpeCoach';
import { useBlockStore } from '../../store/blockStore';
import { usePlanFoldStore } from '../../store/planFoldStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { exportTrainingBlockToExcel } from '../../services/export/trainingBlockExportService';
import { dateForWeekday, hasLegacySuggestions, hasMissingPrimes, referenceOf } from '../../domain/energy/blockPlanEdits';
import type { VariationAddress } from '../../domain/energy/blockPlanEdits';
import { confirmTiming, daySessionStatus, liftingDates, planDayState, SESSION_HOUR } from '../../domain/energy/blockSessions';
import type { DayAddress, DaySessionStatus } from '../../domain/energy/blockSessions';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import * as haptics from '../../lib/haptics';
import { formatSetSequence, movementLabel } from '../../domain/training/trainingLogFormatter';
import { blockNumberOf } from '../../domain/energy/blockStart';
import { sectionsScrolledPast } from '../../domain/training/scrollFold';
import type { SectionLayout } from '../../domain/training/scrollFold';
import { weekdayLabel, formatDisplayDate, todayString } from '../../lib/dateUtils';
import { useT } from '../../i18n/useT';
import { LOCALE_TAGS } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useScreenBackground } from '../../hooks/useScreenBackground';
import type { LiftingSet } from '../../types/energy';
import type {
  ResolvedDayPlan,
  ResolvedVariationPlan,
  BlockWeekPlan,
  VariationReference,
} from '../../types/powerliftingBlock';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// A week's plan scrolls inside a window this tall instead of stretching the page.
const WEEK_WINDOW_HEIGHT = 380;

// Module-level wrapper so the impure clock read stays out of the component body.
function getTodayString(): string {
  return todayString();
}

// "How the app calculated it": the arithmetic behind one suggestion, in words.
function explainReference(ref: VariationReference, t: TFn): string {
  if (ref.method === 'legacy') return t('planAppendix.calcLegacy');
  if (ref.method === 'deload') return t('planAppendix.calcDeload', { pct: ref.pct1rm });
  if (ref.method === 'linear') {
    const first = ref.sets[0];
    return t('planAppendix.calcLinear', {
      pct: ref.pct1rm,
      oneRm: ref.oneRepMaxKg,
      weight: first?.weightKg ?? 0,
      rpe: ref.targetRpe,
    });
  }
  const working = ref.sets.filter((s) => s.kind === 'working');
  const first = working[0];
  const prime = ref.sets.find((s) => s.kind === 'warmup');
  const primeLine =
    prime && ref.primePct != null ? ' ' + t('planAppendix.calcPrime', { pct: ref.primePct, weight: prime.weightKg }) : '';
  return t('planAppendix.calcRpe', {
    reps: first?.reps ?? 0,
    rpe: ref.targetRpe,
    rir: Math.round((10 - ref.targetRpe) * 10) / 10,
    sets: working.length,
    fatigue: ref.fatigueRir,
    extra: ref.extraRir > 0 ? t('planAppendix.calcExtra', { extra: ref.extraRir }) : '',
    rtf: ref.repsToFailure,
    pct: ref.pct1rm,
    oneRm: ref.oneRepMaxKg,
    factor: ref.loadFactor !== 1 ? t('planAppendix.calcFactor', { factor: ref.loadFactor }) : '',
    weight: first?.weightKg ?? 0,
  }) + primeLine;
}

// S-PL Block Builder's plan view — the "Kế hoạch block" mode of the Tập luyện
// tab (moved out of TrainingScreen unchanged when the training log became the
// tab's default mode). See docs/08-powerlifting-engine.md for the engine this
// displays.
export function BlockPlanView() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const screenBg = useScreenBackground();
  const c = useThemeColors();
  const activeBlock = useBlockStore((s) => s.activeBlock);
  const allBlocks = useBlockStore((s) => s.blocks);
  const loadActiveBlock = useBlockStore((s) => s.loadActiveBlock);
  const loadAllBlocks = useBlockStore((s) => s.loadAllBlocks);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);
  const editVariationSets = useBlockStore((s) => s.editVariationSets);
  const editWeekDates = useBlockStore((s) => s.editWeekDates);
  const refreshActiveSuggestions = useBlockStore((s) => s.refreshActiveSuggestions);
  const confirmSession = useBlockStore((s) => s.confirmSession);
  const rescheduleSession = useBlockStore((s) => s.rescheduleSession);
  const cancelSession = useBlockStore((s) => s.cancelSession);
  const runDueSessions = useBlockStore((s) => s.runDueSessions);
  const setDaySkipped = useBlockStore((s) => s.setDaySkipped);
  const setWeekSkipped = useBlockStore((s) => s.setWeekSkipped);
  const pauseAtWeek = useBlockStore((s) => s.pauseAtWeek);
  const removeBreak = useBlockStore((s) => s.removeBreak);
  const editDayAccessories = useBlockStore((s) => s.editDayAccessories);
  const rateVariation = useBlockStore((s) => s.rateVariation);
  const applyCoach = useBlockStore((s) => s.applyCoach);
  const dismissCoach = useBlockStore((s) => s.dismissCoach);
  const editFormRows = useBlockStore((s) => s.editFormRows);
  const setTrainingMax = useBlockStore((s) => s.setTrainingMax);
  const profile = useSettingsStore((s) => s.userProfile);
  // The plan always shows its prime ("95 + 4x6x72.5"), never the warm-up ramp.
  const userFormat = useTrainingLogFormat();
  const format = useMemo(() => ({ ...userFormat, showPrime: true, showWarmups: false }), [userFormat]);
  const foldKey = usePlanFoldStore((s) => s.key);
  const foldWeeks = usePlanFoldStore((s) => s.weeks);
  const setFoldWeek = usePlanFoldStore((s) => s.setWeek);

  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // `key` bumps per opening so each sheet starts from fresh values.
  const [editing, setEditing] = useState<{ key: number; visible: boolean; at: VariationAddress } | null>(null);
  const [datesFor, setDatesFor] = useState<{ key: number; visible: boolean; weekIndex: number } | null>(null);
  const [movingSession, setMovingSession] = useState<{ key: number; visible: boolean; at: DayAddress; date: string } | null>(
    null
  );
  // The variation whose RPE chips are open in the week view ("w.d.v").
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  // "Theo tuần" (week cards), "Theo bài" (one lift across the block, BlockLiftGrid)
  // or "Form" (one lift's TM + a row per session, BlockFormView).
  const [viewMode, setViewMode] = useState<'week' | 'lift' | 'form'>('week');
  const [accessoriesFor, setAccessoriesFor] = useState<{ key: number; visible: boolean; at: DayAddress } | null>(null);
  // Days that already hold a lifting Xả — what "logged" is checked against.
  const [lifted, setLifted] = useState<Set<string>>(() => new Set());

  // Weeks fold like a water slide: open while you scroll through them, folded
  // once they have slid out above. A week the user opened or folded by hand
  // stays that way (remembered until a new week begins — planFoldStore).
  const weekLayouts = useRef<(SectionLayout | undefined)[]>([]);
  const [scrolledPast, setScrolledPast] = useState<number[]>([]);

  function onPlanScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const past = sectionsScrolledPast(weekLayouts.current, e.nativeEvent.contentOffset.y);
    if (past.join(',') !== scrolledPast.join(',')) setScrolledPast(past);
  }

  const firstDate = activeBlock?.weeks[0]?.startDate;
  const lastDate = activeBlock?.weeks[activeBlock.weeks.length - 1]?.endDate;
  const loadLifted = useCallback(() => {
    if (!firstDate || !lastDate) return;
    getActivityLogInRange(firstDate, lastDate)
      .then((entries) => setLifted(liftingDates(entries)))
      .catch((e) => console.warn('BlockPlanView: loading the log failed', e));
  }, [firstDate, lastDate]);
  // The block changes after every confirm/log, so this also refreshes then.
  useEffect(() => {
    loadLifted();
  }, [loadLifted, activeBlock]);

  // Reload every time the tab gains focus (bottom-tab screens stay mounted,
  // so a one-shot mount effect would miss a block just created in the
  // wizard) — same pattern as HistoryScreen.
  useFocusEffect(
    useCallback(() => {
      loadActiveBlock()
        .then(() => runDueSessions())
        .finally(() => setLoading(false));
      loadAllBlocks();
    }, [loadActiveBlock, loadAllBlocks, runDueSessions])
  );

  function handleDelete() {
    if (!activeBlock) return;
    const id = activeBlock.config.id;
    Alert.alert(t('planAppendix.deleteConfirmTitle'), t('planAppendix.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteBlock(id) },
    ]);
  }

  async function handleExport() {
    if (!activeBlock) return;
    setExporting(true);
    try {
      await exportTrainingBlockToExcel(activeBlock, language);
    } catch {
      Alert.alert(t('common.error'), t('planAppendix.exportError'));
    } finally {
      setExporting(false);
    }
  }

  // "B3W4" — the block's number (the user's own, else creation order, as in
  // the training log) and the week; the deload keeps its log label.
  function weekLabelOf(weekIndex: number): string {
    const week = activeBlock?.weeks[weekIndex];
    if (!activeBlock || !week) return '';
    const b = blockNumberOf(activeBlock, allBlocks);
    return week.isDeload ? t('trainingLog.deloadLabel', { b }) : t('trainingLog.weekLabel', { b, n: week.weekNumber });
  }

  function renderSets(sets: LiftingSet[]) {
    const prime = sets.find((s) => s.kind === 'warmup');
    const working = formatSetSequence(
      sets.filter((s) => s.kind === 'working'),
      format,
      language
    );
    if (!prime) return working;
    return (
      <>
        <Text style={styles.primeText}>{formatSetSequence([prime], format, language)}</Text>
        {` + ${working}`}
      </>
    );
  }

  // Real life first: the user picks how the plan bends around a week away.
  function weekOffMenu(weekIndex: number) {
    const label = weekLabelOf(weekIndex);
    Alert.alert(t('planAppendix.weekOff.title', { week: label }), t('planAppendix.weekOff.message'), [
      {
        text: t('planAppendix.weekOff.pause'),
        onPress: async () => {
          const error = await pauseAtWeek(weekIndex);
          if (error) Alert.alert(label, t('planAppendix.weekOff.pauseBlocked'));
          else haptics.success();
        },
      },
      { text: t('planAppendix.weekOff.skip'), onPress: () => setWeekSkipped(weekIndex, true).then(haptics.success) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function breakMenu(breakIndex: number) {
    Alert.alert(t('planAppendix.weekOff.removeTitle'), t('planAppendix.weekOff.removeMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('planAppendix.weekOff.removeConfirm'), onPress: () => removeBreak(breakIndex) },
    ]);
  }

  // Confirming a day: behind you → straight into Xả; today → trained already
  // or at 18:00?; ahead → remembered and logged when the day comes.
  function confirmDay(at: DayAddress, date: string) {
    const timing = confirmTiming(date, getTodayString());
    if (timing === 'today') {
      Alert.alert(t('planAppendix.session.todayTitle'), t('planAppendix.session.todayMessage', { hour: SESSION_HOUR }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('planAppendix.session.logNow'), onPress: () => confirmSession(at, date, 'now').then(haptics.success) },
        {
          text: t('planAppendix.session.logEvening', { hour: SESSION_HOUR }),
          onPress: () => confirmSession(at, date, 'evening').then(haptics.success),
        },
      ]);
      return;
    }
    confirmSession(at, date, timing === 'past' ? 'now' : 'evening').then(haptics.success);
  }

  function sessionMenu(at: DayAddress, status: DaySessionStatus, title: string) {
    const move = { text: t('planAppendix.session.move'), onPress: () => openMove(at, status) };
    const cancel = {
      text: t('planAppendix.session.cancel'),
      style: 'destructive' as const,
      onPress: () => {
        cancelSession(at);
      },
    };
    const close = { text: t('common.close'), style: 'cancel' as const };
    if (status.kind === 'planned') {
      Alert.alert(title, t('planAppendix.session.plannedMessage', { date: formatDisplayDate(status.date, language), hour: SESSION_HOUR }), [
        { text: t('planAppendix.session.logNow'), onPress: () => confirmSession(at, status.date, 'now').then(haptics.success) },
        move,
        { text: t('planAppendix.dayOff.skip'), onPress: () => setDaySkipped(at, true) },
        cancel,
        close,
      ]);
    } else if (status.kind === 'logged' && !status.present) {
      Alert.alert(title, t('planAppendix.session.missingMessage'), [
        {
          text: t('planAppendix.session.relog'),
          onPress: () => confirmSession(at, status.date, 'now').then(haptics.success),
        },
        cancel,
        close,
      ]);
    }
  }

  function openMove(at: DayAddress, status: DaySessionStatus) {
    const date = status.kind === 'planned' || status.kind === 'logged' ? status.date : getTodayString();
    setMovingSession((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, at, date }));
  }

  function renderSessionControl(week: BlockWeekPlan, day: ResolvedDayPlan, at: DayAddress, date: string | null) {
    if (!date || day.variations.length === 0) return null;
    const status = daySessionStatus(week, day, lifted);
    const title = `${weekLabelOf(at.weekIndex)} · ${formatDisplayDate(date, language)}`;
    switch (status.kind) {
      case 'open':
        return (
          <View style={styles.sessionPair}>
            <Pressable
              hitSlop={6}
              onPress={() => setDaySkipped(at, true)}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('planAppendix.dayOff.skipA11y', { day: title })}
            >
              <Text style={styles.skipBtnText}>{t('planAppendix.dayOff.skip')}</Text>
            </Pressable>
            <Pressable
              hitSlop={6}
              onPress={() => confirmDay(at, date)}
              style={({ pressed }) => [styles.sessionBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.sessionBtnText}>
                {date < getTodayString() ? t('planAppendix.session.confirmPast') : t('planAppendix.session.confirm')}
              </Text>
            </Pressable>
          </View>
        );
      case 'inLog':
        return <Text style={styles.sessionDone}>{t('planAppendix.session.inLog')}</Text>;
      case 'planned':
        return (
          <Pressable
            hitSlop={6}
            onPress={() => sessionMenu(at, status, title)}
            style={({ pressed }) => [styles.sessionPlanned, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.sessionPlannedText}>
              {status.moved
                ? t('planAppendix.session.plannedMoved', { date: formatDisplayDate(status.date, language), hour: SESSION_HOUR })
                : t('planAppendix.session.planned', { hour: SESSION_HOUR })}
            </Text>
          </Pressable>
        );
      case 'logged':
        return status.present ? (
          <Text style={styles.sessionDone}>{t('planAppendix.session.logged')}</Text>
        ) : (
          <Pressable hitSlop={6} onPress={() => sessionMenu(at, status, title)} accessibilityRole="button">
            <Text style={styles.sessionMissing}>{t('planAppendix.session.missing')}</Text>
          </Pressable>
        );
    }
  }

  // One table row: lift (the notebook's abbreviation) | sets | ⓘ | ✎.
  function renderVariation(variation: ResolvedVariationPlan, at: VariationAddress, done: boolean) {
    if (!activeBlock || variation.sets.length === 0) return null;
    const { exercise, variationId } = variation.variation;
    const label = t(`blockVariations.${variationId}.label`);
    const short = movementLabel({ type: exercise, minutes: 0, variationId }, format, language);
    const ref = referenceOf(activeBlock, variation);
    const refSets = formatSetSequence(ref.sets, format, language);
    const refLine =
      ref.method === 'rpe'
        ? t('planAppendix.referenceLineRpe', { sets: refSets, pct: ref.pct1rm, rpe: ref.targetRpe })
        : ref.method === 'deload'
          ? t('planAppendix.referenceLineDeload', { sets: refSets, pct: ref.pct1rm })
          : ref.method === 'linear'
            ? t('planAppendix.referenceLineLinear', { sets: refSets, pct: ref.pct1rm })
          : t('planAppendix.referenceLineLegacy', { sets: refSets, pct: ref.pct1rm });
    const rateKey = `${at.weekIndex}.${at.dayIndex}.${at.variationIndex}`;
    return (
      <View key={`v${at.variationIndex}`} style={styles.variationBlock}>
        <View style={styles.tableRow}>
          <Text style={styles.cellLift} numberOfLines={1}>
            {short}
          </Text>
          {/* The plan — the user's own sets once edited, else the suggestion —
              its prime in italics first, like the training log. */}
          <Text style={styles.cellSets}>
            {renderSets(variation.sets)}
            {variation.userEdited ? <Text style={styles.editedMark}> ✎</Text> : null}
          </Text>
          {/* One ⓘ holds everything secondary: the full name and what it is,
              the app's suggestion, how it was calculated, and the kcal. */}
          <InfoPopover
            title={label}
            sections={[
              { body: t(`blockVariations.${variationId}.rationale`) },
              { body: refLine },
              { heading: t('planAppendix.howCalcTitle'), body: explainReference(ref, t) },
              { body: t('planAppendix.kcalLine', { kcal: variation.estimatedKcal }) },
              ...(variation.userEdited ? [{ body: t('planAppendix.editedBadge') }] : []),
            ]}
          />
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('planAppendix.editA11y', { label })}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={() => setEditing((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, at }))}
          >
            <Text style={styles.iconBtnText}>{t('planAppendix.editButton')}</Text>
          </Pressable>
        </View>
        {/* A trained day: how hard did it feel? (the RPE coach reads it) */}
        {done && (
          <Pressable
            hitSlop={6}
            onPress={() => setRatingFor((cur) => (cur === rateKey ? null : rateKey))}
            style={({ pressed }) => [styles.rpeChip, variation.actualRpe != null && styles.rpeChipSet, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.rpeChipText, variation.actualRpe != null && styles.rpeChipTextSet]}>
              {variation.actualRpe != null
                ? t('planAppendix.rpe.value', { rpe: variation.actualRpe.toLocaleString(LOCALE_TAGS[language]) })
                : t('planAppendix.rpe.ask')}
            </Text>
          </Pressable>
        )}
        {done && ratingFor === rateKey && (
          <RpeChips
            label={t('planAppendix.rpe.label', { lift: label })}
            value={variation.actualRpe}
            onChange={(rpe) => {
              rateVariation(at, rpe);
              setRatingFor(null);
            }}
          />
        )}
      </View>
    );
  }

  function renderDay(week: BlockWeekPlan, weekIndex: number, day: ResolvedDayPlan, dayIndex: number) {
    const date = dateForWeekday(week, day.dayOfWeek);
    const at = { weekIndex, dayIndex };
    const off = week.skipped || day.skipped;
    const state = planDayState(week, day, lifted);
    return (
      <View key={dayIndex} style={[styles.dayCard, state === 'done' && styles.dayDone, off && styles.dayOff]}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {date ? formatDisplayDate(date, language) : weekdayLabel(day.dayOfWeek, language, 'long')}
          </Text>
          <Text style={styles.dayKcal}>{t('planAppendix.kcalLine', { kcal: day.totalKcal })}</Text>
          <View style={styles.flex} />
          {week.skipped ? null : day.skipped ? (
            <Pressable
              hitSlop={6}
              onPress={() => setDaySkipped(at, false)}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.skipBtnText}>{t('planAppendix.dayOff.skipped')}</Text>
            </Pressable>
          ) : (
            renderSessionControl(week, day, at, date)
          )}
        </View>
        {day.variations.map((v, variationIndex) =>
          renderVariation(v, { weekIndex, dayIndex, variationIndex }, state === 'done')
        )}
        {day.accessories.map((acc, i) => (
          <View key={`a${i}`} style={styles.tableRow}>
            <Text style={[styles.cellLift, styles.cellAccessory]} numberOfLines={1}>
              {acc.customName}
            </Text>
            <Text style={[styles.cellSets, styles.cellAccessory]}>
              {acc.reps
                ? t('planAppendix.accessorySets', { sets: acc.sets, reps: acc.reps })
                : t('planAppendix.accessories.sets', { n: acc.sets })}
            </Text>
          </View>
        ))}
        {!off && (
          <Pressable
            hitSlop={6}
            onPress={() => setAccessoriesFor((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, at }))}
            style={({ pressed }) => [styles.accessoryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.accessoryBtnText}>
              {day.accessories.length > 0 ? t('planAppendix.accessories.editButton') : t('planAppendix.accessories.addButton')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Weeks off the user put into the block, shown in the gap before `weekIndex`.
  function renderBreaksBefore(weekIndex: number) {
    if (!activeBlock) return null;
    const week = activeBlock.weeks[weekIndex];
    const prev = activeBlock.weeks[weekIndex - 1];
    return (activeBlock.config.breaks ?? []).map((brk, i) =>
      brk.endDate < week.startDate && (!prev || brk.startDate > prev.endDate) ? (
        <Pressable
          key={`break-${brk.startDate}`}
          onPress={() => breakMenu(i)}
          style={({ pressed }) => [styles.breakRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.breakText}>
            {t('planAppendix.weekOff.breakRow', {
              start: formatDisplayDate(brk.startDate, language),
              end: formatDisplayDate(brk.endDate, language),
            })}
          </Text>
          <Text style={styles.breakUndo}>↺</Text>
        </Pressable>
      ) : null
    );
  }

  function renderWeek(week: BlockWeekPlan, weekIndex: number) {
    const isCurrent = weekIndex === currentWeekIndex;
    // Weeks already behind you start folded; otherwise open until scrolled
    // past. The user's own open/fold wins until a new week begins.
    const autoOpen = weekIndex >= currentWeekIndex && !scrolledPast.includes(weekIndex);
    const open = (foldKey === foldKeyNow ? foldWeeks[weekIndex] : undefined) ?? autoOpen;
    const label = weekLabelOf(weekIndex);
    return (
      <View
        key={week.weekNumber}
        style={styles.weekCard}
        onLayout={(e: LayoutChangeEvent) => {
          weekLayouts.current[weekIndex] = { top: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
        }}
      >
        <Pressable
          onPress={() => foldKeyNow && setFoldWeek(foldKeyNow, weekIndex, !open)}
          style={({ pressed }) => [styles.weekHeader, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={label}
        >
          <Text style={[styles.weekTitle, isCurrent && styles.weekTitleCurrent]}>{label}</Text>
          {isCurrent && <View style={styles.currentDot} />}
          {week.skipped && <Text style={styles.offBadge}>{t('planAppendix.weekOff.badge')}</Text>}
          <View style={styles.flex} />
          {!open && !week.skipped && (
            <Text style={styles.weekFoldedInfo}>
              {t('planAppendix.sessionsCount', { count: week.days.filter((d) => !d.skipped).length })}
            </Text>
          )}
          <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
        </Pressable>
        {open && (
          <ScrollView style={styles.weekWindow} contentContainerStyle={styles.weekBody} nestedScrollEnabled>
            <View style={styles.weekToolbar}>
              <Text style={styles.weekRange}>
                {t('planAppendix.dateRangeSuffix', {
                  start: formatDisplayDate(week.startDate, language),
                  end: formatDisplayDate(week.endDate, language),
                })}
              </Text>
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                onPress={() => setDatesFor((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, weekIndex }))}
              >
                <Text style={styles.editBtnText}>{t('planAppendix.weekDatesButton')}</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                onPress={() => (week.skipped ? setWeekSkipped(weekIndex, false) : weekOffMenu(weekIndex))}
              >
                <Text style={styles.editBtnText}>
                  {week.skipped ? t('planAppendix.weekOff.resume') : t('planAppendix.weekOff.button')}
                </Text>
              </Pressable>
            </View>
            {week.skipped && <Text style={styles.offNote}>{t('planAppendix.weekOff.skippedNote')}</Text>}
            {week.days.map((day, dayIndex) => renderDay(week, weekIndex, day, dayIndex))}
            <Text style={styles.weekTotal}>
              {t('planAppendix.weekTotalLabel', { kcal: week.totalKcal })}
              {week.weeklyDeficitTargetKcal != null
                ? `  ·  ${t('planAppendix.weeklyDeficitTargetLabel', { kcal: week.weeklyDeficitTargetKcal })}`
                : ''}
            </Text>
          </ScrollView>
        )}
      </View>
    );
  }

  // The week containing today, else week 1 (a block that has not started).
  const today = getTodayString();
  const todayIndex = activeBlock?.weeks.findIndex((w) => w.startDate <= today && today <= w.endDate) ?? -1;
  const currentWeekIndex = todayIndex >= 0 ? todayIndex : 0;
  // Hand folds belong to this block and this week; a new week starts fresh.
  const foldKeyNow = activeBlock ? `${activeBlock.config.id}|${activeBlock.weeks[currentWeekIndex]?.startDate}` : null;

  const editingVariation =
    editing && activeBlock
      ? activeBlock.weeks[editing.at.weekIndex]?.days[editing.at.dayIndex]?.variations[editing.at.variationIndex]
      : undefined;

  if (loading) {
    return (
      <View style={[styles.container, screenBg]}>
        <ActivityIndicator color={c.textPrimary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const config = activeBlock?.config;
  const anyBeginnerEstimated = config
    ? config.isBeginnerEstimated.squat || config.isBeginnerEstimated.bench_press || config.isBeginnerEstimated.deadlift
    : false;

  return (
    <View style={[styles.container, screenBg]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        onScroll={onPlanScroll}
        scrollEventThrottle={48}
        // Folding a week above the screen must not yank what you are reading.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('planAppendix.title')}</Text>
          {activeBlock && (
            <InfoPopover
              title={t('planAppendix.title')}
              sections={[
                { body: t('planAppendix.epocNote') },
                ...(config?.deficitModeEnabled ? [{ body: t('planAppendix.proteinRecommendationNote') }] : []),
              ]}
            />
          )}
        </View>

        {!activeBlock ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{t('planAppendix.emptyState')}</Text>
            <Pressable style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]} onPress={() => setWizardOpen(true)}>
              <Text style={styles.createBtnText}>{t('planAppendix.createBlockButton')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {anyBeginnerEstimated && <Text style={styles.badgeText}>{t('planAppendix.beginnerEstimateBadge')}</Text>}

            <View style={styles.actionRow}>
              <Pressable
                disabled={exporting}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={handleExport}
              >
                <Text style={styles.actionBtnText}>{t('planAppendix.exportExcelButton')}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]} onPress={() => setWizardOpen(true)}>
                <Text style={styles.actionBtnText}>{t('planAppendix.createBlockButton')}</Text>
              </Pressable>
            </View>

            {(hasLegacySuggestions(activeBlock) || hasMissingPrimes(activeBlock)) && (
              <View style={styles.legacyBanner}>
                <Text style={styles.legacyText}>
                  {hasLegacySuggestions(activeBlock) ? t('planAppendix.legacyBanner') : t('planAppendix.primeBanner')}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  onPress={() => refreshActiveSuggestions(profile)}
                >
                  <Text style={styles.editBtnText}>
                    {hasLegacySuggestions(activeBlock) ? t('planAppendix.refreshButton') : t('planAppendix.primeButton')}
                  </Text>
                </Pressable>
              </View>
            )}

            <RpeCoachCard
              advice={coachAdvice(activeBlock)}
              weekLabel={weekLabelOf}
              onApply={(a, change) =>
                applyCoach(a.variationId, a.fromWeekIndex, change, profile.heightCm).then(() => {
                  haptics.success();
                  return dismissCoach(a.key);
                })
              }
              onDismiss={(a) => dismissCoach(a.key)}
            />

            <View style={styles.viewToggle}>
              {(['week', 'lift', 'form'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    style={({ pressed }) => [styles.viewTab, active && styles.viewTabActive, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>
                      {mode === 'week'
                        ? t('planAppendix.viewByWeek')
                        : mode === 'lift'
                          ? t('planAppendix.viewByLift')
                          : t('planAppendix.viewForm')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {viewMode === 'form' ? (
              <BlockFormView
                plan={activeBlock}
                currentWeekIndex={currentWeekIndex}
                weekLabel={weekLabelOf}
                lifted={lifted}
                onSaveRows={(edits) => editFormRows(edits, profile.heightCm).then(() => haptics.success())}
                onSetTrainingMax={(lift, kg) => setTrainingMax(lift, kg, profile.heightCm, lifted).then(() => haptics.success())}
              />
            ) : viewMode === 'lift' ? (
              <BlockLiftGrid
                plan={activeBlock}
                format={format}
                currentWeekIndex={currentWeekIndex}
                weekLabel={weekLabelOf}
                heightCm={profile.heightCm}
                lifted={lifted}
                onRate={rateVariation}
                onEdit={(at, sets) => editVariationSets(at, sets, profile.heightCm)}
              />
            ) : (
              activeBlock.weeks.map((week, weekIndex) => (
                <React.Fragment key={week.weekNumber}>
                  {renderBreaksBefore(weekIndex)}
                  {renderWeek(week, weekIndex)}
                </React.Fragment>
              ))
            )}
            <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('planAppendix.deleteBlockButton')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {editing && editingVariation && activeBlock && (
        <BlockVariationEditSheet
          key={`variation-${editing.key}`}
          visible={editing.visible}
          title={t('planAppendix.editSheet.title', {
            label: t(`blockVariations.${editingVariation.variation.variationId}.label`),
            week: weekLabelOf(editing.at.weekIndex),
          })}
          variation={editingVariation}
          reference={referenceOf(activeBlock, editingVariation)}
          bodyWeightKg={activeBlock.config.bodyWeightKg}
          heightCm={profile.heightCm}
          onSave={(sets) => editVariationSets(editing.at, sets, profile.heightCm)}
          onRestore={() => editVariationSets(editing.at, null, profile.heightCm)}
          onClose={() => setEditing((e) => (e ? { ...e, visible: false } : e))}
        />
      )}

      {datesFor && activeBlock && activeBlock.weeks[datesFor.weekIndex] && (
        <BlockWeekDatesSheet
          key={`dates-${datesFor.key}`}
          visible={datesFor.visible}
          plan={activeBlock}
          weekIndex={datesFor.weekIndex}
          weekLabel={weekLabelOf}
          onSave={(start, end) => editWeekDates(datesFor.weekIndex, start, end)}
          onClose={() => setDatesFor((d) => (d ? { ...d, visible: false } : d))}
        />
      )}

      {accessoriesFor && activeBlock && activeBlock.weeks[accessoriesFor.at.weekIndex]?.days[accessoriesFor.at.dayIndex] && (
        <BlockAccessoriesSheet
          key={`acc-${accessoriesFor.key}`}
          visible={accessoriesFor.visible}
          title={t('planAppendix.accessories.title', {
            week: weekLabelOf(accessoriesFor.at.weekIndex),
            day: weekdayLabel(
              activeBlock.weeks[accessoriesFor.at.weekIndex].days[accessoriesFor.at.dayIndex].dayOfWeek,
              language,
              'long'
            ),
          })}
          weekdayName={weekdayLabel(
            activeBlock.weeks[accessoriesFor.at.weekIndex].days[accessoriesFor.at.dayIndex].dayOfWeek,
            language,
            'long'
          )}
          initial={activeBlock.weeks[accessoriesFor.at.weekIndex].days[accessoriesFor.at.dayIndex].accessories}
          hasLaterWeeks={accessoriesFor.at.weekIndex < activeBlock.weeks.length - 1}
          onSave={(list, laterWeeksToo) => editDayAccessories(accessoriesFor.at, list, laterWeeksToo)}
          onClose={() => setAccessoriesFor((a) => (a ? { ...a, visible: false } : a))}
        />
      )}

      {movingSession && activeBlock && (
        <BlockSessionDateSheet
          key={`move-${movingSession.key}`}
          visible={movingSession.visible}
          title={t('planAppendix.session.moveTitle', { week: weekLabelOf(movingSession.at.weekIndex) })}
          date={movingSession.date}
          onSave={(date) => rescheduleSession(movingSession.at, date)}
          onClose={() => setMovingSession((m) => (m ? { ...m, visible: false } : m))}
        />
      )}

      <BlockBuilderWizard
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setWizardOpen(false)}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 24, paddingTop: 12, gap: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    emptyBlock: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
    createBtn: { backgroundColor: c.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    createBtnText: { color: c.bg, fontSize: 14, fontWeight: '700' },
    badgeText: { color: c.warning, fontSize: 12, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 10, marginVertical: 4 },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    weekCard: { borderRadius: 14, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.borderSubtle, overflow: 'hidden' },
    weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
    weekTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '800' },
    weekTitleCurrent: { color: c.accent },
    currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent },
    flex: { flex: 1 },
    variationBlock: { gap: 4 },
    rpeChip: {
      alignSelf: 'flex-start',
      marginLeft: '26%',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 9,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    rpeChipSet: { borderColor: c.planDoneBorder },
    rpeChipText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
    rpeChipTextSet: { color: c.textPrimary },
    dayDone: { backgroundColor: c.planDoneBg, borderWidth: 1, borderColor: c.planDoneBorder },
    dayOff: { backgroundColor: c.planSkippedBg, opacity: 0.75 },
    viewToggle: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: c.bgElevated },
    viewTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
    viewTabActive: { backgroundColor: c.accent },
    viewTabText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    viewTabTextActive: { color: c.onAccent },
    sessionPair: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    skipBtn: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    skipBtnText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
    accessoryBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    accessoryBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    offBadge: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: c.bgElevated,
    },
    offNote: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    breakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.border,
    },
    breakText: { flex: 1, color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    breakUndo: { color: c.accent, fontSize: 16, fontWeight: '700' },
    weekFoldedInfo: { color: c.textMuted, fontSize: 12 },
    chevron: { color: c.textTertiary, fontSize: 16, width: 16, textAlign: 'center' },
    weekWindow: { maxHeight: WEEK_WINDOW_HEIGHT },
    weekBody: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
    weekToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    weekRange: { color: c.textTertiary, fontSize: 12 },
    dayCard: { backgroundColor: c.bgHighlight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
    dayTitle: { color: c.textBright, fontSize: 13, fontWeight: '700' },
    dayKcal: { color: c.mint, fontSize: 11, fontWeight: '600' },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 5,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    cellLift: { width: '26%', color: c.notebookLift, fontSize: 13, fontWeight: '700' },
    cellSets: { flex: 1, color: c.textPrimary, fontSize: 13 },
    cellAccessory: { color: c.textTertiary, fontWeight: '500' },
    editedMark: { color: c.accent, fontSize: 12, fontWeight: '700' },
    primeText: { fontStyle: 'italic', color: c.textSecondary },
    sessionBtn: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.accent,
    },
    sessionBtnText: { color: c.accent, fontSize: 11, fontWeight: '700' },
    sessionPlanned: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: c.accent },
    sessionPlannedText: { color: c.bg, fontSize: 11, fontWeight: '700' },
    sessionDone: { color: c.mint, fontSize: 11, fontWeight: '700' },
    sessionMissing: { color: c.warning, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
    editBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    editBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    iconBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    iconBtnText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    legacyBanner: {
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
    },
    legacyText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
    weekTotal: { color: c.textTertiary, fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
    deleteBtn: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.dangerBgSoft,
      marginTop: 8,
      marginBottom: 24,
    },
    deleteBtnText: { color: c.dangerStrong, fontSize: 13, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

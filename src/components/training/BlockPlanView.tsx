import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { InfoPopover } from '../ui/InfoPopover';
import { BlockBuilderWizard } from '../BlockBuilderWizard';
import { BlockVariationEditSheet } from './BlockVariationEditSheet';
import { BlockWeekDatesSheet } from './BlockWeekDatesSheet';
import { BlockSessionDateSheet } from './BlockSessionDateSheet';
import { useBlockStore } from '../../store/blockStore';
import { usePlanFoldStore } from '../../store/planFoldStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { exportTrainingBlockToExcel } from '../../services/export/trainingBlockExportService';
import { dateForWeekday, hasLegacySuggestions, hasMissingPrimes, referenceOf } from '../../domain/energy/blockPlanEdits';
import type { VariationAddress } from '../../domain/energy/blockPlanEdits';
import { confirmTiming, daySessionStatus, liftingDates, SESSION_HOUR } from '../../domain/energy/blockSessions';
import type { DayAddress, DaySessionStatus } from '../../domain/energy/blockSessions';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import * as haptics from '../../lib/haptics';
import { formatSetSequence, movementLabel } from '../../domain/training/trainingLogFormatter';
import { blockNumberOf } from '../../domain/energy/blockStart';
import { sectionsScrolledPast } from '../../domain/training/scrollFold';
import type { SectionLayout } from '../../domain/training/scrollFold';
import { weekdayLabel, formatDisplayDate, todayString } from '../../lib/dateUtils';
import { useT } from '../../i18n/useT';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
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
  function renderVariation(variation: ResolvedVariationPlan, at: VariationAddress) {
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
          : t('planAppendix.referenceLineLegacy', { sets: refSets, pct: ref.pct1rm });
    return (
      <View key={`v${at.variationIndex}`} style={styles.tableRow}>
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
    );
  }

  function renderDay(week: BlockWeekPlan, weekIndex: number, day: ResolvedDayPlan, dayIndex: number) {
    const date = dateForWeekday(week, day.dayOfWeek);
    return (
      <View key={dayIndex} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {date ? formatDisplayDate(date, language) : weekdayLabel(day.dayOfWeek, language, 'long')}
          </Text>
          <Text style={styles.dayKcal}>{t('planAppendix.kcalLine', { kcal: day.totalKcal })}</Text>
          <View style={styles.flex} />
          {renderSessionControl(week, day, { weekIndex, dayIndex }, date)}
        </View>
        {day.variations.map((v, variationIndex) => renderVariation(v, { weekIndex, dayIndex, variationIndex }))}
        {day.accessories.map((acc, i) => (
          <View key={`a${i}`} style={styles.tableRow}>
            <Text style={[styles.cellLift, styles.cellAccessory]} numberOfLines={1}>
              {acc.customName}
            </Text>
            <Text style={[styles.cellSets, styles.cellAccessory]}>
              {t('planAppendix.accessorySets', { sets: acc.sets, reps: acc.reps })}
            </Text>
          </View>
        ))}
      </View>
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
          <View style={styles.flex} />
          {!open && <Text style={styles.weekFoldedInfo}>{t('planAppendix.sessionsCount', { count: week.days.length })}</Text>}
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
            </View>
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
      <View style={styles.container}>
        <ActivityIndicator color={c.textPrimary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const config = activeBlock?.config;
  const anyBeginnerEstimated = config
    ? config.isBeginnerEstimated.squat || config.isBeginnerEstimated.bench_press || config.isBeginnerEstimated.deadlift
    : false;

  return (
    <View style={styles.container}>
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

            {activeBlock.weeks.map(renderWeek)}
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

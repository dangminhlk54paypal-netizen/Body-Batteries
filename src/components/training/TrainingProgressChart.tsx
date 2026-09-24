import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { ProgressChartSvg, liftColor } from './ProgressChartSvg';
import { ShareProgressCard, SHARE_CHART_LAYOUT } from './ShareProgressCard';
import { LiftMaxSheet } from './LiftMaxSheet';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import { getTrainingLogDaysInRange } from '../../data/repositories/trainingLogRepository';
import { bodyWeightOn, buildLiftProgress } from '../../domain/training/trainingLogProgress';
import type { LiftProgressWeek } from '../../domain/training/trainingLogProgress';
import type { WeightPoint } from '../../domain/training/trainingLogWeights';
import { bestLiftMaxes, buildProgressChartModel, formatChartValue, liftChanges } from '../../domain/training/progressChartModel';
import type { ChartLayout, ProgressMode } from '../../domain/training/progressChartModel';
import { formatDayDate, formatWeekLabel, formatWeekRange } from '../../domain/training/trainingLogFormatter';
import { shareViewAsImage } from '../../services/share/imageShareService';
import { activityLabel } from '../../lib/activityLabels';
import { addDaysToDateString, mondayOfWeek, todayString } from '../../lib/dateUtils';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  format: TrainingLogFormat;
}

const WEEKS = 26;
const LAYOUT: ChartLayout = { width: 320, height: 170, padLeft: 34, padRight: 22, padTop: 12, padBottom: 22 };

// Module-level wrapper so the impure clock read stays out of the component body.
function getTodayString(): string {
  return todayString();
}

function windowStart(today: string): string {
  return addDaysToDateString(mondayOfWeek(today), -7 * (WEEKS - 1));
}

interface Loaded {
  weeks: LiftProgressWeek[];
  weights: WeightPoint[];
  from: string;
  today: string;
}

// Under the notebook: the heaviest competition squat / bench / deadlift of
// each week, in kg or as a multiple of that week's body weight — one axis at a
// time (a toggle), never two scales on one chart. ⭐ stars are the one-rep
// maxes the user recorded ("⭐ Ghi 1RM"): milestones on their own day, not part
// of the weekly line. Tapping picks a week; "📤" shares the chart as an image.
export function TrainingProgressChart({ format }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const periods = useTrainingLogStore((s) => s.periods);
  const liftMaxes = useTrainingLogStore((s) => s.liftMaxes);
  const profileWeight = useSettingsStore((s) => s.userProfile.weightKg);
  const [data, setData] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<ProgressMode>('kg');
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [maxSheet, setMaxSheet] = useState<{ key: number; visible: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    const today = getTodayString();
    const from = windowStart(today);
    Promise.all([
      getActivityLogInRange(from, today),
      getTrainingLogDaysInRange(from, today),
      // A year earlier too, so the first weeks can carry a weigh-in forward.
      getWeightsInRange(addDaysToDateString(from, -365), today),
    ]).then(([entries, dayRecords, weights]) => {
      if (cancelled) return;
      const weeks = buildLiftProgress({ entries, dayRecords, weights, fallbackBodyWeightKg: profileWeight, format, language });
      setData({ weeks, weights, from, today });
    });
    return () => {
      cancelled = true;
    };
  }, [revision, format, language, profileWeight]);

  const weeks = data?.weeks ?? null;
  // Only the 1RMs inside the chart's window are drawn; the sheet lists them all.
  const windowMaxes = useMemo(
    () => (data ? liftMaxes.filter((m) => m.date >= data.from && m.date <= data.today) : []),
    [data, liftMaxes]
  );
  const bodyWeightOf = useMemo(
    () => (date: string) => bodyWeightOn(date, data?.weights ?? [], profileWeight),
    [data, profileWeight]
  );

  const model = useMemo(
    () => (weeks ? buildProgressChartModel({ weeks, maxes: windowMaxes, bodyWeightOf, mode, layout: LAYOUT }) : null),
    [weeks, windowMaxes, bodyWeightOf, mode]
  );
  const shareModel = useMemo(
    () =>
      weeks ? buildProgressChartModel({ weeks, maxes: windowMaxes, bodyWeightOf, mode, layout: SHARE_CHART_LAYOUT }) : null,
    [weeks, windowMaxes, bodyWeightOf, mode]
  );

  const hasAnyWeight = !!weeks?.some((w) => w.bodyWeightKg);
  const changes = useMemo(() => (weeks ? liftChanges(weeks, mode) : []), [weeks, mode]);
  const best = bestLiftMaxes(liftMaxes);

  function pick(e: GestureResponderEvent) {
    if (!weeks || weeks.length === 0 || !model || width === 0) return;
    const vx = (e.nativeEvent.locationX * LAYOUT.width) / width;
    let bestIdx = 0;
    weeks.forEach((w, i) => {
      if (Math.abs(model.xOfDate(w.weekStart) - vx) < Math.abs(model.xOfDate(weeks[bestIdx].weekStart) - vx)) bestIdx = i;
    });
    setSelected(bestIdx);
  }

  async function share() {
    setSharing(true);
    try {
      await shareViewAsImage(shareRef, t('trainingLog.progress.shareDialogTitle'));
    } finally {
      setSharing(false);
    }
  }

  const weekTitle = (w: LiftProgressWeek): string => {
    const period = periods.find((p) => p.kind === 'block' && p.weeks.some((pw) => pw.weekStart === w.weekStart));
    const pw = period?.weeks.find((x) => x.weekStart === w.weekStart);
    const range = formatWeekRange({ weekStart: w.weekStart, weekEnd: w.weekEnd, sessions: 0, dates: [] }, language);
    return period && pw ? `${formatWeekLabel(pw, period, language)} · ${range}` : range;
  };

  const kgText = (kg: number) => t('trainingLog.progress.valueKg', { kg: formatChartValue(kg, 1, format, language) });
  const ratioText = (r: number) => t('trainingLog.progress.valueRatio', { ratio: formatChartValue(r, 2, format, language) });

  const current = weeks && weeks.length > 0 ? weeks[Math.min(selected ?? weeks.length - 1, weeks.length - 1)] : null;
  const currentIndex = current && weeks ? weeks.indexOf(current) : -1;
  const abbr = (ex: LiftingExercise) => t(`trainingLog.abbr.${ex}`);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('trainingLog.progress.title')}</Text>
      <Text style={styles.subtitle}>{t('trainingLog.progress.subtitle', { weeks: WEEKS })}</Text>

      <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel={t('trainingLog.progress.modeLabel')}>
        {(['kg', 'ratio'] as ProgressMode[]).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            style={({ pressed }) => [styles.chip, mode === m && styles.chipActive, pressed && styles.pressed]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>
              {m === 'kg' ? t('trainingLog.progress.modeKg') : t('trainingLog.progress.modeRatio')}
            </Text>
          </Pressable>
        ))}
      </View>

      {!weeks ? null : !model ? (
        <Text style={styles.empty}>
          {mode === 'ratio' && weeks.length >= 2 && !hasAnyWeight
            ? t('trainingLog.progress.noBodyWeight')
            : t('trainingLog.progress.empty')}
        </Text>
      ) : (
        <>
          <Pressable
            onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
            onPress={pick}
            accessibilityRole="adjustable"
            accessibilityLabel={t('trainingLog.progress.chartLabel')}
          >
            <ProgressChartSvg
              model={model}
              layout={LAYOUT}
              mode={mode}
              format={format}
              language={language}
              colors={c}
              highlightWeek={current?.weekStart ?? null}
            />
          </Pressable>
          {windowMaxes.length > 0 && <Text style={styles.hint}>{t('trainingLog.progress.maxLegend')}</Text>}
          {changes.length > 0 && (
            <Text style={styles.changeLine}>
              {t('trainingLog.progress.changeTitle')}{' '}
              {changes.map((ch, i) => (
                <Text key={ch.lift}>
                  {i > 0 ? ' · ' : ''}
                  <Text style={{ color: liftColor(c, ch.lift), fontWeight: '700' }}>{abbr(ch.lift)}</Text>{' '}
                  {t('trainingLog.progress.changeValue', {
                    sign: ch.pct >= 0 ? '+' : '−',
                    pct: formatChartValue(Math.abs(ch.pct), 1, format, language),
                  })}
                </Text>
              ))}
            </Text>
          )}

          {current && (
            <View style={styles.readout}>
              <Text style={styles.readoutTitle}>{weekTitle(current)}</Text>
              {current.bodyWeightKg && current.bodyWeightSource ? (
                <Text style={styles.readoutSub}>
                  {t('trainingLog.progress.bodyWeight', { kg: formatChartValue(current.bodyWeightKg, 1, format, language) })}
                  {' · '}
                  {/* A guessed weight is flagged: the ratio can't be better than it. */}
                  <Text
                    style={
                      current.bodyWeightSource === 'earliest' || current.bodyWeightSource === 'profile'
                        ? styles.weightGuess
                        : undefined
                    }
                  >
                    {t(`trainingLog.progress.bodyWeightSource.${current.bodyWeightSource}`)}
                  </Text>
                </Text>
              ) : null}
              {LIFTING_EXERCISES.map((ex) => {
                const kg = current.top[ex];
                const weekBest = Math.max(...weeks.slice(0, currentIndex + 1).map((w) => w.top[ex] ?? -Infinity));
                return (
                  <View key={ex} style={styles.readoutRow}>
                    <View style={[styles.dot, { backgroundColor: liftColor(c, ex) }]} />
                    <Text style={styles.readoutLift}>
                      {abbr(ex)} · {activityLabel(ex, language)}
                    </Text>
                    <Text style={styles.readoutValue}>
                      {kg == null
                        ? t('trainingLog.emptyWeek')
                        : [kgText(kg), current.bodyWeightKg ? ratioText(kg / current.bodyWeightKg) : null]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                    {Number.isFinite(weekBest) ? (
                      <Text style={styles.readoutBest}>{t('trainingLog.progress.best', { value: kgText(weekBest) })}</Text>
                    ) : null}
                  </View>
                );
              })}
              <Text style={styles.hint}>{t('trainingLog.progress.tapHint')}</Text>
            </View>
          )}
        </>
      )}

      {LIFTING_EXERCISES.some((ex) => best[ex]) && (
        <View style={styles.maxBox}>
          {LIFTING_EXERCISES.map((ex) => {
            const m = best[ex];
            if (!m) return null;
            return (
              <Text key={ex} style={styles.maxText}>
                <Text style={{ color: liftColor(c, ex) }}>★ </Text>
                {abbr(ex)} ·{' '}
                {t('trainingLog.progress.maxBest', { value: kgText(m.weightKg), date: formatDayDate(m.date, language) })}
              </Text>
            );
          })}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={() => setMaxSheet((s) => ({ key: (s?.key ?? 0) + 1, visible: true }))}
        >
          <Text style={styles.actionText}>{t('trainingLog.progress.maxButton')}</Text>
        </Pressable>
        {shareModel && (
          <Pressable
            disabled={sharing}
            style={({ pressed }) => [styles.actionBtn, (pressed || sharing) && styles.pressed]}
            onPress={share}
          >
            {sharing ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text style={styles.actionText}>{t('trainingLog.progress.shareButton')}</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Never on screen: laid out far off-canvas so shareViewAsImage has a real
          native view to capture (same trick as TodayMeals' ShareDayFoodCard). */}
      {shareModel && weeks && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareProgressCard ref={shareRef} model={shareModel} mode={mode} weeks={weeks} maxes={liftMaxes} format={format} />
        </View>
      )}

      {maxSheet && (
        <LiftMaxSheet
          key={`max-${maxSheet.key}`}
          visible={maxSheet.visible}
          format={format}
          onClose={() => setMaxSheet((s) => (s ? { ...s, visible: false } : s))}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.bgCard, borderRadius: 16, padding: 16, gap: 8 },
    title: { color: c.textPrimary, fontSize: 17, fontWeight: '800' },
    subtitle: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    modeRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgElevated,
    },
    chipActive: { borderColor: c.accent, backgroundColor: c.bgHighlight },
    chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: c.textPrimary },
    empty: { color: c.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
    readout: { gap: 4, paddingTop: 4 },
    changeLine: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
    weightGuess: { color: c.warning },
    readoutTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    readoutSub: { color: c.textTertiary, fontSize: 12 },
    readoutRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    readoutLift: { color: c.textSecondary, fontSize: 13, minWidth: 110 },
    readoutValue: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
    readoutBest: { color: c.textMuted, fontSize: 12 },
    hint: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    maxBox: { gap: 3, padding: 10, borderRadius: 12, backgroundColor: c.bgHighlight },
    maxText: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      minWidth: 44,
      alignItems: 'center',
    },
    actionText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    offscreen: { position: 'absolute', top: -100000, left: 0 },
    pressed: { opacity: 0.6 },
  });

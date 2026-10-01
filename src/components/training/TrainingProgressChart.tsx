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
import {
  bestLiftMaxes,
  buildProgressChartModel,
  formatChartValue,
  liftDeltaAt,
} from '../../domain/training/progressChartModel';
import type { ChartLayout, ProgressMode } from '../../domain/training/progressChartModel';
import { formatWeekLabel, formatWeekRange } from '../../domain/training/trainingLogFormatter';
import { shareViewAsImage } from '../../services/share/imageShareService';
import { InfoPopover } from '../ui/InfoPopover';
import * as haptics from '../../lib/haptics';
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
// each week in kg, or the powerlifting ratio (that week's estimated 1RM ÷ its
// body weight) — one axis at a time (a toggle), never two scales on one chart. ⭐ stars are the one-rep
// maxes the user recorded ("⭐ Ghi 1RM"): milestones on their own day, not part
// of the weekly line. Under the chart, compact by design: the picked week on
// one line, then one tile per lift — the value in big type, ▲/▼ change since
// its first week (green / coral), e1RM and the best ⭐ small; every
// explanation lives behind ⓘ. ⤴ or holding the chart shares the poster.
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
    if (sharing) return;
    setSharing(true);
    try {
      await shareViewAsImage(shareRef, t('trainingLog.progress.shareDialogTitle'));
    } finally {
      setSharing(false);
    }
  }

  const weekTitle = (w: LiftProgressWeek): string => {
    // A block week ("B3W2") or a week the user labelled reads by its label too.
    const pw = periods.flatMap((p) => p.weeks).find((x) => x.weekStart === w.weekStart);
    const range = formatWeekRange({ weekStart: w.weekStart, weekEnd: w.weekEnd, sessions: 0, dates: [] }, language);
    return pw && (pw.block || pw.customLabel) ? `${formatWeekLabel(pw, language)} · ${range}` : range;
  };

  const kgText = (kg: number) => t('trainingLog.progress.valueKg', { kg: formatChartValue(kg, 1, format, language) });
  const ratioText = (r: number) => t('trainingLog.progress.valueRatio', { ratio: formatChartValue(r, 2, format, language) });

  const current = weeks && weeks.length > 0 ? weeks[Math.min(selected ?? weeks.length - 1, weeks.length - 1)] : null;
  const currentIndex = current && weeks ? weeks.indexOf(current) : -1;
  const abbr = (ex: LiftingExercise) => t(`trainingLog.abbr.${ex}`);

  // The selected week's body-weight line: "≈" when it is not a weigh-in of
  // that week (interpolated / carried / guessed) — the ratio is only as
  // good as that number; a pure guess is tinted.
  const weightLine = (w: LiftProgressWeek): { text: string; guess: boolean } | null => {
    if (!w.bodyWeightKg || !w.bodyWeightSource) return null;
    const kg = formatChartValue(w.bodyWeightKg, 1, format, language);
    return {
      text: w.bodyWeightSource === 'measured' ? kgText(w.bodyWeightKg) : `≈${t('trainingLog.progress.valueKg', { kg })}`,
      guess: w.bodyWeightSource === 'earliest' || w.bodyWeightSource === 'profile',
    };
  };

  return (
    <View style={styles.card}>
      {/* Header: title + ⓘ (what the numbers mean, how to use the chart) | kg/Ratio */}
      <View style={styles.headRow}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t('trainingLog.progress.title')}
        </Text>
        <InfoPopover
          title={t('trainingLog.progress.title')}
          sections={[
            {
              body:
                mode === 'kg'
                  ? t('trainingLog.progress.subtitle', { weeks: WEEKS })
                  : t('trainingLog.progress.subtitleRatio', { weeks: WEEKS }),
            },
            { body: t('trainingLog.progress.ratioInfo') },
            { body: t('trainingLog.progress.ratioInfoE1rm') },
            { body: t('trainingLog.progress.ratioInfoWeight') },
            { body: `${t('trainingLog.progress.tapHint')} ${t('trainingLog.progress.maxLegend')}` },
          ]}
        />
        <View style={styles.flex} />
        <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={t('trainingLog.progress.modeLabel')}>
          {(['kg', 'ratio'] as ProgressMode[]).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === m }}
              style={({ pressed }) => [styles.segmentItem, mode === m && styles.segmentItemOn, pressed && styles.pressed]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                {m === 'kg' ? t('trainingLog.progress.modeKg') : t('trainingLog.progress.modeRatio')}
              </Text>
            </Pressable>
          ))}
        </View>
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
            onLongPress={
              shareModel
                ? () => {
                    haptics.tapLight();
                    void share();
                  }
                : undefined
            }
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

          {current && (
            <>
              {/* The picked week (latest by default) · its body weight | ⭐ 1RM · ⤴ */}
              <View style={styles.weekRow}>
                <Text style={styles.weekTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {weekTitle(current)}
                  {(() => {
                    const wl = weightLine(current);
                    return wl ? <Text style={wl.guess ? styles.weightGuess : styles.weekWeight}>{`  ${wl.text}`}</Text> : null;
                  })()}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  onPress={() => setMaxSheet((s) => ({ key: (s?.key ?? 0) + 1, visible: true }))}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('trainingLog.progress.maxButton')}
                >
                  <Text style={styles.iconBtnText}>⭐</Text>
                </Pressable>
                {shareModel && (
                  <Pressable
                    disabled={sharing}
                    style={({ pressed }) => [styles.iconBtn, (pressed || sharing) && styles.pressed]}
                    onPress={share}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('trainingLog.progress.shareButton')}
                  >
                    {sharing ? (
                      <ActivityIndicator size="small" color={c.accent} />
                    ) : (
                      <Text style={[styles.iconBtnText, styles.shareIcon]}>⤴</Text>
                    )}
                  </Pressable>
                )}
              </View>

              {/* One tile per lift: the number that matters big, the change
                  since its first week as ▲/▼ in green / coral, the rest small. */}
              <View style={styles.tiles}>
                {LIFTING_EXERCISES.map((ex) => {
                  const { value, pct } = liftDeltaAt(weeks, ex, mode, currentIndex);
                  const e1rm = current.e1rm[ex];
                  const kg = current.top[ex];
                  const bestMax = best[ex];
                  const big = value == null ? '–' : mode === 'kg' ? kgText(value) : ratioText(value);
                  const sub =
                    mode === 'kg'
                      ? e1rm != null && e1rm !== kg
                        ? t('trainingLog.progress.e1rmValue', { kg: formatChartValue(e1rm, 1, format, language) })
                        : null
                      : e1rm != null
                        ? t('trainingLog.progress.e1rmValue', { kg: formatChartValue(e1rm, 1, format, language) })
                        : null;
                  const up = pct != null && pct >= 0.05;
                  const down = pct != null && pct <= -0.05;
                  const delta =
                    pct == null
                      ? null
                      : t('trainingLog.progress.deltaValue', {
                          arrow: up ? '▲' : down ? '▼' : '=',
                          pct: formatChartValue(Math.abs(pct), 1, format, language),
                        });
                  return (
                    <View
                      key={ex}
                      style={[styles.tile, { borderTopColor: liftColor(c, ex) }]}
                      accessible
                      accessibilityLabel={[activityLabel(ex, language), big, delta, sub].filter(Boolean).join(', ')}
                    >
                      <Text style={[styles.tileLift, { color: liftColor(c, ex) }]} numberOfLines={1}>
                        {abbr(ex)}
                      </Text>
                      <Text
                        style={[styles.tileValue, value == null && styles.tileValueEmpty]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {big}
                      </Text>
                      <Text
                        style={[styles.tileDelta, up ? styles.deltaUp : down ? styles.deltaDown : styles.deltaFlat]}
                        numberOfLines={1}
                      >
                        {delta ?? ' '}
                      </Text>
                      <Text style={styles.tileSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {sub ?? ' '}
                      </Text>
                      <Text style={styles.tileMax} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {bestMax ? `★ ${kgText(bestMax.weightKg)}` : ' '}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {/* No chart yet: the 1RM button still has to be reachable. */}
      {(!model || !current) && (
        <Pressable
          style={({ pressed }) => [styles.maxLink, pressed && styles.pressed]}
          onPress={() => setMaxSheet((s) => ({ key: (s?.key ?? 0) + 1, visible: true }))}
        >
          <Text style={styles.maxLinkText}>{t('trainingLog.progress.maxButton')}</Text>
        </Pressable>
      )}

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
    card: { backgroundColor: c.bgCard, borderRadius: 16, padding: 14, gap: 10 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { flexShrink: 1, color: c.textPrimary, fontSize: 17, fontWeight: '800' },
    flex: { flex: 1 },
    // kg | Ratio: two equal segments, the active one on the accent colour.
    segment: {
      flexDirection: 'row',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgElevated,
      overflow: 'hidden',
    },
    segmentItem: { minWidth: 54, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
    segmentItemOn: { backgroundColor: c.accent },
    segmentText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    segmentTextOn: { color: c.onAccent },
    empty: { color: c.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
    weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    weekTitle: { flex: 1, color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    weekWeight: { color: c.textTertiary, fontWeight: '500' },
    weightGuess: { color: c.warning, fontWeight: '500' },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    iconBtnText: { fontSize: 13 },
    shareIcon: { color: c.infoAlt, fontWeight: '700' },
    tiles: { flexDirection: 'row', gap: 8 },
    tile: {
      flex: 1,
      borderTopWidth: 3,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 1,
    },
    tileLift: { fontSize: 12, fontWeight: '800' },
    tileValue: { color: c.textPrimary, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
    tileValueEmpty: { color: c.textMuted },
    tileDelta: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    deltaUp: { color: c.statusGood },
    deltaDown: { color: c.statusLow },
    deltaFlat: { color: c.textMuted },
    tileSub: { color: c.textTertiary, fontSize: 11, fontVariant: ['tabular-nums'] },
    tileMax: { color: c.textSecondary, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
    maxLink: { alignSelf: 'flex-start', paddingVertical: 4 },
    maxLinkText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    offscreen: { position: 'absolute', top: -100000, left: 0 },
    pressed: { opacity: 0.6 },
  });

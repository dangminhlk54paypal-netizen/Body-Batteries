import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import { getTrainingLogDaysInRange } from '../../data/repositories/trainingLogRepository';
import { buildLiftProgress } from '../../domain/training/trainingLogProgress';
import type { LiftProgressWeek } from '../../domain/training/trainingLogProgress';
import { formatDayDate, formatWeekLabel, formatWeekRange } from '../../domain/training/trainingLogFormatter';
import { activityLabel } from '../../lib/activityLabels';
import { addDaysToDateString, mondayOfWeek, todayString } from '../../lib/dateUtils';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import { LOCALE_TAGS } from '../../i18n/types';
import type { Language } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  format: TrainingLogFormat;
}

type Mode = 'kg' | 'ratio';

const WEEKS = 26;
const VIEW_W = 320;
const VIEW_H = 170;
const PAD_LEFT = 34;
const PAD_RIGHT = 22;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

// Module-level wrapper so the impure clock read stays out of the component body.
function getTodayString(): string {
  return todayString();
}

function seriesColor(c: ThemeColors, ex: LiftingExercise): string {
  return ex === 'squat' ? c.liftSquat : ex === 'bench_press' ? c.liftBench : c.liftDeadlift;
}

// "72.5" with the notebook's decimal choice (dot, or the language's own).
function formatValue(n: number, digits: number, format: TrainingLogFormat, language: Language): string {
  if (format.decimal === 'locale') {
    return new Intl.NumberFormat(LOCALE_TAGS[language], {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits === 2 ? 2 : 0,
      useGrouping: false,
    }).format(n);
  }
  return digits === 2 ? n.toFixed(2) : String(Math.round(n * 10 ** digits) / 10 ** digits);
}

// 3–5 round gridline values covering [min, max].
function niceTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1e-6);
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// The plotted value: kg, or kg ÷ that week's body weight (null without one).
function valueOf(w: LiftProgressWeek, ex: LiftingExercise, mode: Mode): number | null {
  const kg = w.top[ex];
  if (kg == null) return null;
  if (mode === 'kg') return kg;
  return w.bodyWeightKg ? kg / w.bodyWeightKg : null;
}

function weekOffset(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 604_800_000);
}

// Under the notebook: the heaviest competition squat / bench / deadlift of
// each week, in kg or as a multiple of that week's body weight. One axis at a
// time (a toggle), never two scales on one chart. Tapping picks a week, whose
// numbers show below the plot.
export function TrainingProgressChart({ format }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const periods = useTrainingLogStore((s) => s.periods);
  const profileWeight = useSettingsStore((s) => s.userProfile.weightKg);
  const [weeks, setWeeks] = useState<LiftProgressWeek[] | null>(null);
  const [mode, setMode] = useState<Mode>('kg');
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const today = getTodayString();
    const from = addDaysToDateString(mondayOfWeek(today), -7 * (WEEKS - 1));
    Promise.all([
      getActivityLogInRange(from, today),
      getTrainingLogDaysInRange(from, today),
      // A year earlier too, so the first weeks can carry a weigh-in forward.
      getWeightsInRange(addDaysToDateString(from, -365), today),
    ]).then(([entries, dayRecords, weights]) => {
      if (cancelled) return;
      setWeeks(
        buildLiftProgress({ entries, dayRecords, weights, fallbackBodyWeightKg: profileWeight, format, language })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [revision, format, language, profileWeight]);

  const plot = useMemo(() => {
    if (!weeks || weeks.length < 2) return null;
    const values = weeks.flatMap((w) =>
      LIFTING_EXERCISES.map((ex) => valueOf(w, ex, mode)).filter((v): v is number => v != null)
    );
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || (mode === 'kg' ? 5 : 0.05);
    const ticks = niceTicks(Math.max(0, min - pad), max + pad);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const span = Math.max(1, weekOffset(weeks[0].weekStart, weeks[weeks.length - 1].weekStart));
    const x = (weekStart: string) =>
      PAD_LEFT + ((VIEW_W - PAD_LEFT - PAD_RIGHT) * weekOffset(weeks[0].weekStart, weekStart)) / span;
    const y = (v: number) => PAD_TOP + (VIEW_H - PAD_TOP - PAD_BOTTOM) * (1 - (v - lo) / (hi - lo || 1));
    return { ticks, x, y };
  }, [weeks, mode]);

  const hasAnyWeight = !!weeks?.some((w) => w.bodyWeightKg);

  function pick(e: GestureResponderEvent) {
    if (!weeks || !plot || width === 0) return;
    const vx = (e.nativeEvent.locationX * VIEW_W) / width;
    let best = 0;
    weeks.forEach((w, i) => {
      if (Math.abs(plot.x(w.weekStart) - vx) < Math.abs(plot.x(weeks[best].weekStart) - vx)) best = i;
    });
    setSelected(best);
  }

  const weekTitle = (w: LiftProgressWeek): string => {
    const period = periods.find((p) => p.kind === 'block' && p.weeks.some((pw) => pw.weekStart === w.weekStart));
    const pw = period?.weeks.find((x) => x.weekStart === w.weekStart);
    const range = formatWeekRange({ weekStart: w.weekStart, weekEnd: w.weekEnd, sessions: 0, dates: [] }, language);
    return period && pw ? `${formatWeekLabel(pw, period, language)} · ${range}` : range;
  };

  const kgText = (kg: number) => t('trainingLog.progress.valueKg', { kg: formatValue(kg, 1, format, language) });
  const ratioText = (r: number) => t('trainingLog.progress.valueRatio', { ratio: formatValue(r, 2, format, language) });

  const current = weeks && weeks.length > 0 ? weeks[Math.min(selected ?? weeks.length - 1, weeks.length - 1)] : null;
  const currentIndex = current && weeks ? weeks.indexOf(current) : -1;

  // Direct labels at each line's end, nudged apart so they never overlap.
  const endLabels = useMemo(() => {
    if (!weeks || !plot) return [];
    const labels = LIFTING_EXERCISES.flatMap((ex) => {
      for (let i = weeks.length - 1; i >= 0; i--) {
        const v = valueOf(weeks[i], ex, mode);
        if (v != null) return [{ ex, x: plot.x(weeks[i].weekStart), y: plot.y(v) }];
      }
      return [];
    }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < 11) labels[i].y = labels[i - 1].y + 11;
    }
    return labels;
  }, [weeks, plot, mode]);

  const abbr = (ex: LiftingExercise) => t(`trainingLog.abbr.${ex}`);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('trainingLog.progress.title')}</Text>
      <Text style={styles.subtitle}>{t('trainingLog.progress.subtitle', { weeks: WEEKS })}</Text>

      <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel={t('trainingLog.progress.modeLabel')}>
        {(['kg', 'ratio'] as Mode[]).map((m) => (
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

      {!weeks ? null : !plot ? (
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
            <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
              {plot.ticks.map((v) => (
                <React.Fragment key={v}>
                  <Line x1={PAD_LEFT} y1={plot.y(v)} x2={VIEW_W - PAD_RIGHT} y2={plot.y(v)} stroke={c.bgElevated} strokeWidth={1} />
                  <SvgText x={PAD_LEFT - 5} y={plot.y(v) + 3} fontSize={9} fill={c.textMuted} textAnchor="end">
                    {mode === 'kg' ? formatValue(v, 1, format, language) : formatValue(v, 2, format, language)}
                  </SvgText>
                </React.Fragment>
              ))}
              {[weeks[0], weeks[weeks.length - 1]].map((w, i) => (
                <SvgText
                  key={`x${i}`}
                  x={plot.x(w.weekStart)}
                  y={VIEW_H - 6}
                  fontSize={9}
                  fill={c.textMuted}
                  textAnchor={i === 0 ? 'start' : 'end'}
                >
                  {formatDayDate(w.weekStart, language)}
                </SvgText>
              ))}
              {current && (
                <Line
                  x1={plot.x(current.weekStart)}
                  y1={PAD_TOP}
                  x2={plot.x(current.weekStart)}
                  y2={VIEW_H - PAD_BOTTOM}
                  stroke={c.textFaint}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
              )}
              {LIFTING_EXERCISES.map((ex) => {
                const pts = weeks.flatMap((w) => {
                  const v = valueOf(w, ex, mode);
                  return v == null ? [] : [{ x: plot.x(w.weekStart), y: plot.y(v), week: w }];
                });
                if (pts.length === 0) return null;
                const color = seriesColor(c, ex);
                return (
                  <React.Fragment key={ex}>
                    {pts.length > 1 && (
                      <Polyline
                        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                      />
                    )}
                    {pts.map((p) => (
                      <Circle
                        key={p.week.weekStart}
                        cx={p.x}
                        cy={p.y}
                        r={p.week === current ? 5 : 3.5}
                        fill={color}
                        stroke={c.bgCard}
                        strokeWidth={1.5}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
              {endLabels.map((l) => (
                <SvgText key={l.ex} x={l.x + 7} y={l.y + 3} fontSize={10} fontWeight="700" fill={c.textSecondary}>
                  {abbr(l.ex)}
                </SvgText>
              ))}
            </Svg>
          </Pressable>

          {current && (
            <View style={styles.readout}>
              <Text style={styles.readoutTitle}>{weekTitle(current)}</Text>
              {current.bodyWeightKg ? (
                <Text style={styles.readoutSub}>
                  {t('trainingLog.progress.bodyWeight', { kg: formatValue(current.bodyWeightKg, 1, format, language) })}
                </Text>
              ) : null}
              {LIFTING_EXERCISES.map((ex) => {
                const kg = current.top[ex];
                const best = Math.max(
                  ...weeks.slice(0, currentIndex + 1).map((w) => w.top[ex] ?? -Infinity)
                );
                return (
                  <View key={ex} style={styles.readoutRow}>
                    <View style={[styles.dot, { backgroundColor: seriesColor(c, ex) }]} />
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
                    {Number.isFinite(best) ? (
                      <Text style={styles.readoutBest}>{t('trainingLog.progress.best', { value: kgText(best) })}</Text>
                    ) : null}
                  </View>
                );
              })}
              <Text style={styles.hint}>{t('trainingLog.progress.tapHint')}</Text>
            </View>
          )}
        </>
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
    readoutTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    readoutSub: { color: c.textTertiary, fontSize: 12 },
    readoutRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    readoutLift: { color: c.textSecondary, fontSize: 13, minWidth: 110 },
    readoutValue: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
    readoutBest: { color: c.textMuted, fontSize: 12 },
    hint: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    pressed: { opacity: 0.6 },
  });

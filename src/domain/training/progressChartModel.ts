import { LOCALE_TAGS } from '../../i18n/types';
import type { Language } from '../../i18n/types';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise } from '../../types/energy';
import type { LiftMaxRecord, TrainingLogFormat } from '../../types/trainingLog';
import type { LiftProgressWeek } from './trainingLogProgress';

// Geometry of the strength chart, shared by the on-screen chart and the
// "share as image" card so both draw exactly the same picture. Pure: data in,
// coordinates out; the components only paint.
//
// Two kinds of marks:
//   - weekly dots + lines: the heaviest working set of S / B / D each week;
//   - ⭐ stars: one-rep maxes the user recorded — milestones, never joined to
//     the weekly line, placed on their own day.

export type ProgressMode = 'kg' | 'ratio';

export interface ChartLayout {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  week: LiftProgressWeek;
}

export interface ChartStar {
  x: number;
  y: number;
  max: LiftMaxRecord;
  value: number; // kg, or kg ÷ body weight
}

export interface ProgressChartModel {
  ticks: number[];
  y: (v: number) => number;
  xOfDate: (date: string) => number;
  series: { lift: LiftingExercise; points: ChartPoint[] }[];
  stars: ChartStar[];
  endLabels: { lift: LiftingExercise; x: number; y: number }[];
  firstDate: string;
  lastDate: string;
}

const DAY_MS = 86_400_000;

// "72.5" with the notebook's decimal choice (dot, or the language's own).
export function formatChartValue(n: number, digits: number, format: TrainingLogFormat, language: Language): string {
  if (format.decimal === 'locale') {
    return new Intl.NumberFormat(LOCALE_TAGS[language], {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits === 2 ? 2 : 0,
      useGrouping: false,
    }).format(n);
  }
  return digits === 2 ? n.toFixed(2) : String(Math.round(n * 10 ** digits) / 10 ** digits);
}

function dayNumber(date: string): number {
  return Math.round(new Date(`${date}T00:00:00`).getTime() / DAY_MS);
}

// 3–5 round gridline values covering [min, max].
export function niceTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 1e-6);
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// The plotted weekly value: kg, or kg ÷ that week's body weight (null without one).
export function weekValue(w: LiftProgressWeek, lift: LiftingExercise, mode: ProgressMode): number | null {
  const kg = w.top[lift];
  if (kg == null) return null;
  if (mode === 'kg') return kg;
  return w.bodyWeightKg ? kg / w.bodyWeightKg : null;
}

// How far each lift moved over the chart in the mode shown, from its first
// plotted week to its last (lifts with fewer than two values are left out).
// Each mode's chart scales its own axis, so the lines alone can look alike;
// this is what shows a cut: +5% on the bar is +10% × body weight at −4 kg.
export function liftChanges(
  weeks: LiftProgressWeek[],
  mode: ProgressMode
): { lift: LiftingExercise; first: number; last: number; pct: number }[] {
  return LIFTING_EXERCISES.flatMap((lift) => {
    const values = weeks.map((w) => weekValue(w, lift, mode)).filter((v): v is number => v != null);
    if (values.length < 2 || values[0] <= 0) return [];
    const first = values[0];
    const last = values[values.length - 1];
    return [{ lift, first, last, pct: ((last - first) / first) * 100 }];
  });
}

// Highest recorded 1RM per lift (the latest one wins a tie).
export function bestLiftMaxes(maxes: LiftMaxRecord[]): Partial<Record<LiftingExercise, LiftMaxRecord>> {
  const best: Partial<Record<LiftingExercise, LiftMaxRecord>> = {};
  for (const m of maxes) {
    const cur = best[m.lift];
    if (!cur || m.weightKg > cur.weightKg || (m.weightKg === cur.weightKg && m.date > cur.date)) best[m.lift] = m;
  }
  return best;
}

// Five-pointed star centred on (cx, cy), as an SVG polygon `points` string.
export function starPoints(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// null = nothing worth a chart (fewer than two marks, or no value in this mode).
export function buildProgressChartModel(input: {
  weeks: LiftProgressWeek[];
  // Only the maxes inside the chart's window; `bodyWeightOf` gives the ratio.
  maxes: LiftMaxRecord[];
  bodyWeightOf: (date: string) => number | null;
  mode: ProgressMode;
  layout: ChartLayout;
}): ProgressChartModel | null {
  const { weeks, maxes, bodyWeightOf, mode, layout } = input;

  const starValues = maxes.flatMap((max) => {
    if (mode === 'kg') return [{ max, value: max.weightKg }];
    const bw = bodyWeightOf(max.date);
    return bw ? [{ max, value: max.weightKg / bw }] : [];
  });
  const weekValues = weeks.flatMap((w) =>
    LIFTING_EXERCISES.map((lift) => weekValue(w, lift, mode)).filter((v): v is number => v != null)
  );
  const values = [...weekValues, ...starValues.map((s) => s.value)];
  const marks = weeks.length + starValues.length;
  if (values.length === 0 || marks < 2) return null;

  const dates = [...weeks.map((w) => w.weekStart), ...starValues.map((s) => s.max.date)].sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || (mode === 'kg' ? 5 : 0.05);
  const ticks = niceTicks(Math.max(0, min - pad), max + pad);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];

  const { width, height, padLeft, padRight, padTop, padBottom } = layout;
  const span = Math.max(1, dayNumber(lastDate) - dayNumber(firstDate));
  const xOfDate = (date: string) => padLeft + ((width - padLeft - padRight) * (dayNumber(date) - dayNumber(firstDate))) / span;
  const y = (v: number) => padTop + (height - padTop - padBottom) * (1 - (v - lo) / (hi - lo || 1));

  const series = LIFTING_EXERCISES.map((lift) => ({
    lift,
    points: weeks.flatMap((w) => {
      const v = weekValue(w, lift, mode);
      return v == null ? [] : [{ x: xOfDate(w.weekStart), y: y(v), week: w }];
    }),
  }));

  const stars = starValues.map(({ max: m, value }) => ({ x: xOfDate(m.date), y: y(value), max: m, value }));

  // Direct labels at each line's end, nudged apart so they never overlap.
  const endLabels = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({ lift: s.lift, x: s.points[s.points.length - 1].x, y: s.points[s.points.length - 1].y }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < 11) endLabels[i].y = endLabels[i - 1].y + 11;
  }

  return { ticks, y, xOfDate, series, stars, endLabels, firstDate, lastDate };
}

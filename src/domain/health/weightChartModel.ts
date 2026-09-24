// Geometry for the weight-over-time chart (History → "Cân nặng theo thời
// gian"): the weight line plus background reference lines derived from the
// user's HEIGHT via the WHO healthy-BMI range (18.5–24.9):
//   • healthy — the upper bound of that range (BMI 24.9), drawn green, with
//     the whole healthy range shaded behind it;
//   • plus10 / plus20 / plus35 — that bound + 10 / 20 / 35 kg (yellow /
//     orange / red dashed lines).
// Pure — no store/DB/theme access; the component supplies colours + labels.

import { healthyWeightRangeKgRaw } from '../nutrition/dailyRecommendations';

export type WeightRefKind = 'healthy' | 'plus10' | 'plus20' | 'plus35';

// kg above the healthy upper bound for each reference line.
export const WEIGHT_REF_OFFSETS_KG: Record<WeightRefKind, number> = {
  healthy: 0,
  plus10: 10,
  plus20: 20,
  plus35: 35,
};
const REF_KINDS: WeightRefKind[] = ['healthy', 'plus10', 'plus20', 'plus35'];

export type WeightChartRange = '1m' | '3m' | '1y' | 'all';
export const WEIGHT_CHART_RANGES: WeightChartRange[] = ['1m', '3m', '1y', 'all'];
const RANGE_DAYS: Record<Exclude<WeightChartRange, 'all'>, number> = {
  '1m': 30,
  '3m': 91,
  '1y': 365,
};
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeightChartEntry {
  timestamp: number;
  value: number;
}

export interface WeightChartLayout {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

export interface WeightChartPoint {
  x: number;
  y: number;
  value: number;
  timestamp: number;
}

export interface WeightChartModel {
  points: WeightChartPoint[]; // oldest → newest
  // Only the reference lines that fall inside the plotted kg range.
  refLines: { kind: WeightRefKind; kg: number; y: number }[];
  // Healthy range (BMI 18.5–24.9) clipped to the plotted range; null when it
  // lies entirely outside it.
  healthyBand: { yTop: number; yBottom: number } | null;
  ticks: { kg: number; y: number }[];
  firstTimestamp: number;
  lastTimestamp: number;
}

// Keeps the entries within the range, measured back from the NEWEST entry
// (not from today) so a chosen range never shows an empty chart just
// because the user hasn't weighed in for a while.
export function filterWeightEntriesByRange<T extends WeightChartEntry>(
  entries: T[],
  range: WeightChartRange
): T[] {
  if (range === 'all' || entries.length === 0) return entries;
  const newest = Math.max(...entries.map((e) => e.timestamp));
  const from = newest - RANGE_DAYS[range] * DAY_MS;
  return entries.filter((e) => e.timestamp >= from);
}

const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50];
const MAX_TICKS = 6;

function tickStep(span: number): number {
  return TICK_STEPS.find((s) => span / s <= MAX_TICKS - 1) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

export function buildWeightChartModel(
  entries: WeightChartEntry[],
  heightCm: number,
  layout: WeightChartLayout
): WeightChartModel | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((e) => e.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  const healthy = heightCm > 0 ? healthyWeightRangeKgRaw(heightCm) : null;
  const refKgs = healthy
    ? REF_KINDS.map((kind) => ({ kind, kg: healthy.max + WEIGHT_REF_OFFSETS_KG[kind] }))
    : [];

  // Plotted kg range: the data, always the healthy line, and the NEXT
  // reference line above the highest reading (the threshold the data is
  // approaching) — but not every line, so a 35 kg jump doesn't flatten a
  // small real-life fluctuation into a straight line.
  let lo = dataMin;
  let hi = dataMax;
  if (healthy) {
    lo = Math.min(lo, healthy.max);
    hi = Math.max(hi, healthy.max);
    const nextAbove = refKgs.find((r) => r.kg > dataMax);
    if (nextAbove) hi = Math.max(hi, nextAbove.kg);
  }
  const pad = Math.max(1, (hi - lo) * 0.08);
  lo -= pad;
  hi += pad;

  const { width, height, padLeft, padRight, padTop, padBottom } = layout;
  const plotTop = padTop;
  const plotBottom = height - padBottom;
  const y = (kg: number) => plotBottom - ((kg - lo) / (hi - lo)) * (plotBottom - plotTop);

  const firstTimestamp = sorted[0].timestamp;
  const lastTimestamp = sorted[sorted.length - 1].timestamp;
  const plotLeft = padLeft;
  const plotRight = width - padRight;
  const x = (ts: number) =>
    lastTimestamp === firstTimestamp
      ? (plotLeft + plotRight) / 2
      : plotLeft + ((ts - firstTimestamp) / (lastTimestamp - firstTimestamp)) * (plotRight - plotLeft);

  const step = tickStep(hi - lo);
  const ticks: { kg: number; y: number }[] = [];
  for (let kg = Math.ceil(lo / step) * step; kg <= hi; kg += step) {
    ticks.push({ kg: Math.round(kg * 10) / 10, y: y(kg) });
  }

  const refLines = refKgs
    .filter((r) => r.kg >= lo && r.kg <= hi)
    .map((r) => ({ ...r, y: y(r.kg) }));

  let healthyBand: WeightChartModel['healthyBand'] = null;
  if (healthy) {
    const top = Math.min(healthy.max, hi);
    const bottom = Math.max(healthy.min, lo);
    if (top > bottom) healthyBand = { yTop: y(top), yBottom: y(bottom) };
  }

  return {
    points: sorted.map((e) => ({ x: x(e.timestamp), y: y(e.value), value: e.value, timestamp: e.timestamp })),
    refLines,
    healthyBand,
    ticks,
    firstTimestamp,
    lastTimestamp,
  };
}

// What a tap on the chart points at — drives the one-line caption shown
// under it (the chart itself stays label-free to keep the card clean).
export type WeightChartTarget =
  | { kind: 'point'; index: number }
  | { kind: 'ref'; ref: WeightRefKind }
  | { kind: 'band' };

// Generous hit radii (viewBox units ≈ points): thin SVG lines are hard to hit
// with a finger.
const POINT_HIT = 18;
const LINE_HIT = 12;

// (x, y) in viewBox coordinates. Nearest reading wins over a reference line
// at equal distance; a tap inside the green healthy area with nothing closer
// selects the area; anything else selects nothing.
export function pickWeightChartTarget(
  model: WeightChartModel,
  x: number,
  y: number
): WeightChartTarget | null {
  let best: { target: WeightChartTarget; dist: number } | null = null;

  model.points.forEach((p, index) => {
    if (Math.abs(p.x - x) > POINT_HIT || Math.abs(p.y - y) > POINT_HIT) return;
    const dist = Math.hypot(p.x - x, p.y - y);
    if (!best || dist < best.dist) best = { target: { kind: 'point', index }, dist };
  });
  for (const r of model.refLines) {
    const dist = Math.abs(r.y - y);
    if (dist <= LINE_HIT && (!best || dist < best.dist)) {
      best = { target: { kind: 'ref', ref: r.kind }, dist };
    }
  }
  if (best) return (best as { target: WeightChartTarget }).target;
  if (model.healthyBand && y >= model.healthyBand.yTop && y <= model.healthyBand.yBottom) {
    return { kind: 'band' };
  }
  return null;
}

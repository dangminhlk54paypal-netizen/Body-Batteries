// Which metrics the Home "pin nhỏ" ring shows. By default the 6 sub-batteries
// (as always); the user can trim it ("protein · carbs · fat · sugar") or add
// micronutrients, and the ring simply splits into that many equal arcs. Pure:
// ids/totals in, display items out — the component paints and handles taps.

import type { BatteryState } from '../../types/battery';
import type { MicroBatteryState, MicronutrientId } from '../../types/nutrition';
import { dailyBatteryRatio } from './batteryRingModel';
import type { DailyBatteryTotals } from './dailyBatteryTotals';

export type RingBatteryId = 'protein' | 'carbs' | 'water' | 'minerals' | 'sleep' | 'movement';
export type RingMetricId = RingBatteryId | MicronutrientId;

// Canonical order: the ring always draws in this order, whatever order the
// user ticked things in, so a metric keeps its place when another is added.
export const RING_BATTERY_IDS: RingBatteryId[] = ['protein', 'carbs', 'water', 'minerals', 'sleep', 'movement'];
export const RING_MICRO_IDS: MicronutrientId[] = [
  'fat',
  'sugar',
  'fiber',
  'salt',
  'sodium',
  'calcium',
  'iron',
  'potassium',
  'magnesium',
  'zinc',
  'omega3',
];
const ORDER: RingMetricId[] = [...RING_BATTERY_IDS, ...RING_MICRO_IDS];

export const DEFAULT_RING_METRICS: RingMetricId[] = RING_BATTERY_IDS;
// Fewer than 2 is not a ring. There is no upper bound: past
// MINI_RING_MICRO_THRESHOLD micronutrients they move to their own small ring
// (splitRing), so neither ring gets too crowded to read.
export const RING_MIN_METRICS = 2;
export const MINI_RING_MICRO_THRESHOLD = 3;

export function isRingBatteryId(id: RingMetricId): id is RingBatteryId {
  return (RING_BATTERY_IDS as string[]).includes(id);
}

// The saved choice made safe: null/garbage → the default 6; unknown ids and
// duplicates dropped; canonical order; never fewer than the minimum.
export function resolveRingMetrics(saved: readonly string[] | null | undefined): RingMetricId[] {
  if (!saved) return DEFAULT_RING_METRICS;
  const picked = ORDER.filter((id) => saved.includes(id));
  return picked.length >= RING_MIN_METRICS ? picked : DEFAULT_RING_METRICS;
}

// Tick/untick one metric; unticking below the minimum is a no-op (the same
// array comes back, so the caller can tell).
export function toggleRingMetric(current: RingMetricId[], id: RingMetricId): RingMetricId[] {
  if (current.includes(id)) {
    return current.length > RING_MIN_METRICS ? current.filter((x) => x !== id) : current;
  }
  return ORDER.filter((x) => x === id || current.includes(x));
}

export function isDefaultRingMetrics(ids: RingMetricId[]): boolean {
  return ids.length === DEFAULT_RING_METRICS.length && DEFAULT_RING_METRICS.every((id) => ids.includes(id));
}

// Legend columns that keep rows even: 4 → 2×2, 8 → 4×2, otherwise rows of 3.
export function ringLegendColumns(count: number): number {
  if (count <= 3) return count;
  if (count === 4) return 2;
  if (count === 8) return 4;
  return 3;
}

// Several micronutrients share a colour with a sub-battery (carbs and fat are
// both yellow…). A sub-battery keeps its own colour; a micronutrient whose
// colour is already on the ring takes the next free one from this list.
const SPARE_COLORS = ['#FD79A8', '#FF9F43', '#54A0FF', '#E17055', '#00CEC9', '#B8E994', '#FFEAA7', '#C8D6E5'];

export interface RingItem {
  id: RingMetricId;
  kind: 'battery' | 'micro';
  color: string;
  // today's amount ÷ daily target (goal) or cap (limit); 1 = 100 %
  ratio: number;
  // 'limit' (sugar, salt, sodium): staying under is the aim, so it never
  // counts towards "reached"; going over is drawn neutrally, like any overflow.
  target: 'goal' | 'limit';
  battery?: BatteryState;
  micro?: MicroBatteryState;
}

export function buildRingItems(
  ids: RingMetricId[],
  batteries: BatteryState[],
  totals: DailyBatteryTotals,
  micro: MicroBatteryState[]
): RingItem[] {
  const items: RingItem[] = [];
  for (const id of ids) {
    if (isRingBatteryId(id)) {
      const b = batteries.find((x) => x.type.id === id);
      if (!b) continue;
      items.push({
        id,
        kind: 'battery',
        color: b.type.color,
        ratio: dailyBatteryRatio(id, totals, b.capacity),
        target: 'goal',
        battery: b,
      });
    } else {
      const m = micro.find((x) => x.id === id);
      if (!m) continue;
      items.push({
        id,
        kind: 'micro',
        color: m.color,
        ratio: m.target > 0 ? Math.max(0, m.current / m.target) : 0,
        target: m.kind,
        micro: m,
      });
    }
  }
  const used = new Set(items.filter((it) => it.kind === 'battery').map((it) => it.color.toUpperCase()));
  for (const it of items) {
    if (it.kind === 'battery') continue;
    if (used.has(it.color.toUpperCase())) {
      it.color = SPARE_COLORS.find((c) => !used.has(c.toUpperCase())) ?? it.color;
    }
    used.add(it.color.toUpperCase());
  }
  return items;
}

// The centre count "x/y on target", over EVERY metric on the ring — each one
// is something the user chose to watch. A goal is on target at 100 %; a limit
// (sugar, salt, sodium) while today's amount is still within its cap — but
// only once something has been eaten today, so an empty morning reads 0/6,
// not "sugar ✓".
export function ringReached(items: RingItem[], hasEatenToday: boolean): { done: number; total: number } {
  const done = items.filter((it) =>
    it.target === 'goal' ? it.ratio >= 1 : hasEatenToday && it.ratio <= 1
  ).length;
  return { done, total: items.length };
}

// Past MINI_RING_MICRO_THRESHOLD micronutrients, they get their own small ring
// in the corner of the big one; the big ring keeps the sub-batteries. With no
// sub-battery chosen there is nothing to split off, so everything stays on
// one ring.
export function splitRing(items: RingItem[]): { main: RingItem[]; mini: RingItem[] | null } {
  const batteries = items.filter((it) => it.kind === 'battery');
  const micro = items.filter((it) => it.kind === 'micro');
  if (micro.length <= MINI_RING_MICRO_THRESHOLD || batteries.length === 0) return { main: items, mini: null };
  return { main: batteries, mini: micro };
}

// Groups the weight log (History → "Cân nặng theo thời gian") into calendar
// months for the card's scrollable in-frame list: one sticky header per
// month (average + count) and, per row, the weekly direction (▲/▼) versus
// the reading from ~7 days earlier. Pure — no store/DB access, local dates.

import { addDaysToDateString, dateString, mondayOfWeek } from '../../lib/dateUtils';
import { healthyWeightRangeKgRaw } from '../nutrition/dailyRecommendations';

export interface WeightEntryWithId {
  id: number;
  timestamp: number;
  value: number;
}

export type WeightTrend = 'up' | 'down' | 'same';

// Which way is "toward the healthy range" for this user: above the WHO
// healthy upper bound → losing is the goal; below the lower bound → gaining
// is; inside the range → neither (the list stays neutral, never nudging a
// healthy-weight user to lose more).
export type WeightGoalDirection = 'lose' | 'gain' | 'maintain';

export interface WeightHistoryRow {
  entry: WeightEntryWithId;
  dayKey: string; // YYYY-MM-DD
  // Versus the latest reading dated at least WEEK_COMPARE_DAYS earlier —
  // i.e. "7 days ago", or, after a longer gap, the last reading before the
  // gap. null when no such reading exists yet.
  trend: WeightTrend | null;
  // This row belongs to an older Mon–Sun week than the row above it in the
  // same month — the list draws a light dashed line above it (i.e. below
  // that week's Monday side, above the previous week's Sunday side).
  weekBreakAbove: boolean;
}

export interface WeightMonthGroup {
  monthKey: string; // YYYY-MM
  rows: WeightHistoryRow[]; // newest first
  average: number; // rounded to 0.1 kg
}

export const WEEK_COMPARE_DAYS = 7;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weightGoalDirection(weightKg: number, heightCm: number): WeightGoalDirection {
  if (!(heightCm > 0)) return 'maintain';
  const { min, max } = healthyWeightRangeKgRaw(heightCm);
  if (weightKg > max) return 'lose';
  if (weightKg < min) return 'gain';
  return 'maintain';
}

// true = this trend moves toward the healthy range (shown green), false =
// away from it (red), null = neutral (no goal, no change, or no comparison).
export function isTrendTowardGoal(
  trend: WeightTrend | null,
  goal: WeightGoalDirection
): boolean | null {
  if (trend == null || trend === 'same' || goal === 'maintain') return null;
  return (trend === 'down') === (goal === 'lose');
}

// `entries` may come in any order; output is newest month first, newest row
// first within each month.
export function groupWeightHistoryByMonth(entries: WeightEntryWithId[]): WeightMonthGroup[] {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const dayKeys = sorted.map((e) => dateString(new Date(e.timestamp)));
  const groups: WeightMonthGroup[] = [];
  let current: WeightMonthGroup | undefined;
  let sum = 0;

  const closeGroup = () => {
    if (current) current.average = round1(sum / current.rows.length);
  };

  sorted.forEach((entry, i) => {
    const dayKey = dayKeys[i];
    const monthKey = dayKey.slice(0, 7);
    // Newest-first order → the first later index on/before the cutoff is the
    // latest reading at least a week older.
    const cutoff = addDaysToDateString(dayKey, -WEEK_COMPARE_DAYS);
    const refIndex = dayKeys.findIndex((d, j) => j > i && d <= cutoff);
    const diff = refIndex >= 0 ? round1(entry.value - sorted[refIndex].value) : null;
    const trend: WeightTrend | null = diff == null ? null : diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';

    if (!current || current.monthKey !== monthKey) {
      closeGroup();
      current = { monthKey, rows: [], average: 0 };
      sum = 0;
      groups.push(current);
    }
    // The first row of a month sits under the month header — no line needed.
    const above = current.rows[current.rows.length - 1];
    const weekBreakAbove = !!above && mondayOfWeek(above.dayKey) !== mondayOfWeek(dayKey);
    current.rows.push({ entry, dayKey, trend, weekBreakAbove });
    sum += entry.value;
  });
  closeGroup();

  return groups;
}

import { dateString } from '../../lib/dateUtils';

// Which body-weight reading the training log prints. A DAY line only shows a
// weight when the user actually weighed in that day, like "26.08(77.7kg)". A
// WEEK heading carries the last known weight forward (weekHeadingWeight) so
// "B3W2: 14.09–20.09 75.5kg" never goes blank just because the user skipped
// the scale that week.

export interface WeightPoint {
  timestamp: number;
  value: number;
}

const byTime = (a: WeightPoint, b: WeightPoint) => a.timestamp - b.timestamp;

// The FIRST reading of that calendar day (a morning weigh-in), or null.
export function weightRecordedOn(date: string, weights: WeightPoint[]): number | null {
  const hit = [...weights].sort(byTime).find((w) => dateString(new Date(w.timestamp)) === date);
  return hit ? hit.value : null;
}

// The first reading in [fromDate, toDate] (inclusive calendar days), or null —
// what a week heading like "W4: 77.5kg" shows.
export function firstWeightInRange(
  fromDate: string,
  toDate: string,
  weights: WeightPoint[]
): number | null {
  const hit = [...weights].sort(byTime).find((w) => {
    const d = dateString(new Date(w.timestamp));
    return d >= fromDate && d <= toDate;
  });
  return hit ? hit.value : null;
}

// What a week heading prints: the week's first weigh-in; with none that week,
// the most recent reading BEFORE the week (carried forward until the user
// weighs in again); null only when no earlier reading exists at all.
export function weekHeadingWeight(
  fromDate: string,
  toDate: string,
  weights: WeightPoint[]
): number | null {
  const inWeek = firstWeightInRange(fromDate, toDate, weights);
  if (inWeek != null) return inWeek;
  const before = [...weights]
    .sort(byTime)
    .filter((w) => dateString(new Date(w.timestamp)) < fromDate)
    .pop();
  return before ? before.value : null;
}

// How far back the notebook fetches weigh-ins before a period so its first
// week heading can carry a weight forward from the previous period.
export const WEEK_WEIGHT_LOOKBACK_DAYS = 365;

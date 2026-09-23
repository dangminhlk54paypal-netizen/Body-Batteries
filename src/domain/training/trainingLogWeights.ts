import { dateString } from '../../lib/dateUtils';

// Which body-weight reading the training log prints. Deliberately NOT
// weightOnOrBefore's carry-forward: the notebook only shows a weight on a day
// (or heading a week) when the user actually weighed in then, like "26.08(77.7kg)".

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

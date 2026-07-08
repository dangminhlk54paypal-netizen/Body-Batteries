import type { FoodLogEntry } from '../../types/food';
import { dateString, formatDMY } from '../../lib/dateUtils';

// Pure row builders for the "Daily Totals" and "Food Entries" Excel sheets
// (see src/services/export/excelExportService.ts). No DB/store import — the
// service layer fetches the food log + weight history and passes them in,
// so this stays fully unit-testable.

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface DailyTotalsRow {
  Date: string; // D-MMM-YYYY
  'Calories (kcal)': number;
  'Fat (g)': number;
  'Carbs (g)': number;
  'Protein (g)': number;
  'Weight (kg)': number | string; // '' when no weight was ever logged on/before that day
}

export interface FoodEntryRow {
  Date: string; // D-MMM-YYYY
  Brand: string;
  Food: string;
  Qty: string;
  'Calories (kcal)': number;
  'Fat (g)': number;
  'Carbs (g)': number;
  'Protein (g)': number;
}

interface WeightEntryLike {
  timestamp: number;
  value: number;
}

function groupByLocalDay(entries: FoodLogEntry[]): Map<string, FoodLogEntry[]> {
  const map = new Map<string, FoodLogEntry[]>();
  for (const entry of entries) {
    const key = dateString(new Date(entry.timestamp));
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}

// End-of-day boundary (23:59:59.999 local time) for a YYYY-MM-DD key.
function endOfDayMs(dayKey: string): number {
  return new Date(dayKey + 'T23:59:59.999').getTime();
}

// Weight the user carried on `dayKey`: the most recent weight entry logged
// on or before that day (carry-forward). '' if none exists yet.
function weightOnOrBefore(dayKey: string, weights: WeightEntryLike[]): number | string {
  const boundary = endOfDayMs(dayKey);
  let latest: WeightEntryLike | undefined;
  for (const w of weights) {
    if (w.timestamp <= boundary && (!latest || w.timestamp > latest.timestamp)) {
      latest = w;
    }
  }
  return latest ? latest.value : '';
}

// One row per day that has ≥1 food entry, sorted ascending by date.
export function buildDailyTotals(
  entries: FoodLogEntry[],
  weights: WeightEntryLike[]
): DailyTotalsRow[] {
  const grouped = groupByLocalDay(entries);
  const dayKeys = Array.from(grouped.keys()).sort();

  return dayKeys.map((dayKey) => {
    const dayEntries = grouped.get(dayKey)!;
    const kcal = round1(dayEntries.reduce((sum, e) => sum + e.energyKcal, 0));
    const fatG = round1(dayEntries.reduce((sum, e) => sum + e.fatG, 0));
    const carbG = round1(dayEntries.reduce((sum, e) => sum + e.carbG, 0));
    const proteinG = round1(dayEntries.reduce((sum, e) => sum + e.proteinG, 0));

    return {
      Date: formatDMY(dayKey),
      'Calories (kcal)': kcal,
      'Fat (g)': fatG,
      'Carbs (g)': carbG,
      'Protein (g)': proteinG,
      'Weight (kg)': weightOnOrBefore(dayKey, weights),
    };
  });
}

// One row per logged food, sorted ascending by timestamp, with a blank
// separator row ({}) inserted between entries whose calendar day differs —
// the `xlsx` community edition can't set cell fills/borders, so a blank row
// is the only available way to visually group days.
export function buildFoodEntryRows(entries: FoodLogEntry[]): (FoodEntryRow | Record<string, never>)[] {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const rows: (FoodEntryRow | Record<string, never>)[] = [];
  let previousDayKey: string | null = null;

  for (const e of sorted) {
    const dayKey = dateString(new Date(e.timestamp));
    if (previousDayKey !== null && dayKey !== previousDayKey) {
      rows.push({});
    }
    rows.push({
      Date: formatDMY(dayKey),
      // The food-log schema has no brand field yet — always blank until one
      // is added (e.g. for packaged/branded foods).
      Brand: '',
      Food: e.foodNameVi,
      Qty: `${e.grams} g`,
      'Calories (kcal)': e.energyKcal,
      'Fat (g)': e.fatG,
      'Carbs (g)': e.carbG,
      'Protein (g)': e.proteinG,
    });
    previousDayKey = dayKey;
  }

  return rows;
}

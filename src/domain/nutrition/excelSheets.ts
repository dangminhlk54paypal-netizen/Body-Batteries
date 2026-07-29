import type { FoodItem, FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry } from '../../types/energy';
import type { BatteryReading } from '../../types/battery';
import { dateString, formatDMY } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { per100gValue } from './microBatteryEngine';
import { weightOnOrBefore, type WeightEntryLike } from '../health/weightOnDay';

// Pure row builders for the "Daily Totals" and "Food Entries" Excel sheets
// (see src/services/export/excelExportService.ts). No DB/store import — the
// service layer fetches the food log + weight history and passes them in,
// so this stays fully unit-testable. Row keys become column headers when
// xlsx's json_to_sheet renders them, so they're built per-language via
// `columns()` below rather than being fixed string literals.
export type DailyTotalsRow = Record<string, string | number>;
export type FoodEntryRow = Record<string, string | number>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function columns(language: Language) {
  const c = (key: string) => translate(language, `export.columns.${key}`);
  return {
    date: c('date'),
    calories: c('calories'),
    fat: c('fat'),
    carbs: c('carbs'),
    protein: c('protein'),
    weight: c('weight'),
    burnedKcal: c('burnedKcal'),
    estimatedEnergyNeed: c('estimatedEnergyNeed'),
    energyBalance: c('energyBalance'),
    brand: c('brand'),
    food: c('food'),
    qty: c('qty'),
    sugar: c('sugar'),
    fiber: c('fiber'),
    iron: c('iron'),
    salt: c('salt'),
  };
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

// Same "which calendar day does this activity belong to" rule as
// getActivityLogInRange's own SQL (COALESCE(start_at, timestamp)) — keeps
// the Excel view agreeing with History's grouping for backdated entries.
function groupActivityByDisplayDay(entries: ActivityLogEntry[]): Map<string, ActivityLogEntry[]> {
  const map = new Map<string, ActivityLogEntry[]>();
  for (const entry of entries) {
    const key = dateString(new Date(entry.startAt ?? entry.timestamp));
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}

// One row per day that has ≥1 food entry, sorted ascending by date, plus a
// trailing disclaimer row reusing `assessment.disclaimer` — every export
// (weekly or monthly) funnels through this builder, so the caution note
// always ships with the file.
export function buildDailyTotals(
  entries: FoodLogEntry[],
  weights: WeightEntryLike[],
  activityLog: ActivityLogEntry[],
  energyReadings: BatteryReading[],
  language: Language
): DailyTotalsRow[] {
  const grouped = groupByLocalDay(entries);
  const groupedActivity = groupActivityByDisplayDay(activityLog);
  const dayKeys = Array.from(grouped.keys()).sort();
  const col = columns(language);

  const rows: DailyTotalsRow[] = dayKeys.map((dayKey) => {
    const dayEntries = grouped.get(dayKey)!;
    const kcal = round1(dayEntries.reduce((sum, e) => sum + e.energyKcal, 0));
    const fatG = round1(dayEntries.reduce((sum, e) => sum + e.fatG, 0));
    const carbG = round1(dayEntries.reduce((sum, e) => sum + e.carbG, 0));
    const proteinG = round1(dayEntries.reduce((sum, e) => sum + e.proteinG, 0));

    const dayActivity = groupedActivity.get(dayKey) ?? [];
    const burnedKcal = round1(dayActivity.reduce((sum, a) => sum + a.energyKcal, 0));

    const energyReading = energyReadings.find((r) => r.date === dayKey);
    const estimatedEnergyNeed = energyReading ? round1(energyReading.capacity) : '';
    const energyBalance = energyReading ? round1(kcal - energyReading.capacity) : '';

    return {
      [col.date]: formatDMY(dayKey),
      [col.calories]: kcal,
      [col.fat]: fatG,
      [col.carbs]: carbG,
      [col.protein]: proteinG,
      [col.weight]: weightOnOrBefore(dayKey, weights),
      [col.burnedKcal]: burnedKcal,
      [col.estimatedEnergyNeed]: estimatedEnergyNeed,
      [col.energyBalance]: energyBalance,
    };
  });

  if (rows.length > 0) {
    rows.push({});
    rows.push({ [col.date]: translate(language, 'assessment.disclaimer') });
  }

  return rows;
}

// One row per logged food, sorted ascending by timestamp, with a blank
// separator row ({}) inserted between entries whose calendar day differs —
// the `xlsx` community edition can't set cell fills/borders, so a blank row
// is the only available way to visually group days.
export function buildFoodEntryRows(
  entries: FoodLogEntry[],
  lookup: (foodId: string) => FoodItem | undefined,
  language: Language
): (FoodEntryRow | Record<string, never>)[] {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const rows: (FoodEntryRow | Record<string, never>)[] = [];
  const col = columns(language);
  let previousDayKey: string | null = null;

  for (const e of sorted) {
    const dayKey = dateString(new Date(e.timestamp));
    if (previousDayKey !== null && dayKey !== previousDayKey) {
      rows.push({});
    }
    // Micronutrients aren't stored on the log entry itself (only
    // energy/macros are) — scale them from the food's per-100g figures the
    // same way the "sugar/fiber/iron/sodium" micro-battery breakdown does
    // (per100gValue), so this can never drift from that calculation. Blank
    // (not 0) when the food can't be found, since 0 would misleadingly read
    // as "this food has none" rather than "unknown".
    const item = lookup(e.foodId);
    const factor = e.grams / 100;
    const sugarG = item ? round1(per100gValue(item.per100g, 'sugar') * factor) : '';
    const fiberG = item ? round1(per100gValue(item.per100g, 'fiber') * factor) : '';
    const ironMg = item ? round1(per100gValue(item.per100g, 'iron') * factor) : '';
    const saltG = item ? round1(per100gValue(item.per100g, 'salt') * factor) : '';

    rows.push({
      [col.date]: formatDMY(dayKey),
      // The food-log schema has no brand field yet — always blank until one
      // is added (e.g. for packaged/branded foods). Food name stays the
      // Vietnamese snapshot taken at log time (see FoodLogEntry.foodNameVi)
      // regardless of export language — it's a historical record, not a
      // live lookup, so it can't follow a later language switch.
      [col.brand]: '',
      [col.food]: e.foodNameVi,
      [col.qty]: `${e.grams} g`,
      [col.calories]: e.energyKcal,
      [col.fat]: e.fatG,
      [col.carbs]: e.carbG,
      [col.protein]: e.proteinG,
      [col.sugar]: sugarG,
      [col.fiber]: fiberG,
      [col.iron]: ironMg,
      [col.salt]: saltG,
    });
    previousDayKey = dayKey;
  }

  return rows;
}

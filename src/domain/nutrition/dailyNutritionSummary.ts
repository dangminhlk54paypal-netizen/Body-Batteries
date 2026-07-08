import type { FoodItem, FoodLogEntry } from '../../types/food';
import type { MicroBatteryState, NutrientTarget } from '../../types/nutrition';
import { dateString } from '../../lib/dateUtils';
import { computeMicroBatteries, type LoggedPortion } from './microBatteryEngine';
import { assessDay, assessState } from './nutritionAssessment';

// Pure aggregation layer for the weekly Excel export: groups a food log range
// by CALENDAR day (dateString — NOT the 6am energyDayString reset used only
// by the calorie ledger; see lib/dateUtils.ts), totals macro + micronutrients
// per day, and rolls the whole range up into a 7-day-average view per
// nutrient. No DB/store import — the service layer fetches entries/targets
// and passes them in, so this stays fully unit-testable.

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface DayNutritionSummary {
  date: string; // YYYY-MM-DD, local calendar day
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  micros: MicroBatteryState[];
  assessment: string;
}

export interface WeeklyNutrientRollup {
  id: MicroBatteryState['id'];
  kind: MicroBatteryState['kind'];
  nameVi: string;
  unit: MicroBatteryState['unit'];
  avgPerDay: number;
  target: number;
  pctOfTarget: number; // avgPerDay / target * 100, rounded, uncapped-ish (see below)
  assessment: string;
}

export interface WeeklyNutritionSummary {
  days: DayNutritionSummary[];
  weekly: WeeklyNutrientRollup[];
  overallAssessment: string;
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.round((100 * current) / target));
}

function groupByDate(entries: FoodLogEntry[]): Map<string, FoodLogEntry[]> {
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

// Builds one row per day that actually has logged food (days with nothing
// logged simply don't appear — there is nothing to total or assess).
// `numDays` is the denominator for the weekly average (default 7, matching
// the "weekly" export range) so days without any log still count as 0
// toward the week's adequacy — a day you forgot to log is not the same as
// a day that truly had zero fiber.
export function summarizeWeeklyNutrition(
  entries: FoodLogEntry[],
  targets: NutrientTarget[],
  lookup: (foodId: string) => FoodItem | undefined,
  numDays = 7
): WeeklyNutritionSummary {
  const grouped = groupByDate(entries);
  const dates = Array.from(grouped.keys()).sort();

  const days: DayNutritionSummary[] = dates.map((date) => {
    const dayEntries = grouped.get(date)!;
    const portions: LoggedPortion[] = dayEntries.map((e) => ({
      foodId: e.foodId,
      grams: e.grams,
    }));
    const micros = computeMicroBatteries(portions, lookup, targets);

    const kcal = round1(dayEntries.reduce((sum, e) => sum + e.energyKcal, 0));
    const proteinG = round1(dayEntries.reduce((sum, e) => sum + e.proteinG, 0));
    const fatG = round1(dayEntries.reduce((sum, e) => sum + e.fatG, 0));
    const carbG = round1(dayEntries.reduce((sum, e) => sum + e.carbG, 0));

    return {
      date,
      kcal,
      proteinG,
      fatG,
      carbG,
      micros,
      assessment: assessDay(micros),
    };
  });

  const weekly: WeeklyNutrientRollup[] = targets.map((target) => {
    const totalAcrossDays = days.reduce((sum, day) => {
      const state = day.micros.find((m) => m.id === target.id);
      return sum + (state?.current ?? 0);
    }, 0);
    const avgPerDay = round1(totalAcrossDays / Math.max(1, numDays));
    const virtualState: MicroBatteryState = {
      id: target.id,
      kind: target.kind,
      nameVi: target.nameVi,
      unit: target.unit,
      color: target.color,
      current: avgPerDay,
      target: target.value,
      percentage: pct(avgPerDay, target.value),
      over: avgPerDay > target.value,
    };
    return {
      id: target.id,
      kind: target.kind,
      nameVi: target.nameVi,
      unit: target.unit,
      avgPerDay,
      target: target.value,
      pctOfTarget: virtualState.percentage,
      assessment: assessState(virtualState) ?? 'Ổn 👍',
    };
  });

  const overallAssessment = assessDay(
    weekly.map((w) => ({
      id: w.id,
      kind: w.kind,
      nameVi: w.nameVi,
      unit: w.unit,
      color: '', // unused by assessDay/assessState
      current: w.avgPerDay,
      target: w.target,
      percentage: w.pctOfTarget,
      over: w.avgPerDay > w.target,
    }))
  );

  return { days, weekly, overallAssessment };
}

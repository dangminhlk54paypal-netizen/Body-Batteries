import type { FoodLogEntry, MealType } from '../../types/food';

// Pure summary of a day's food log: daily totals + per-meal grouping. No I/O —
// unit-tested. Used by the "Hôm nay đã ăn" section on Home.

// Canonical display order for meals.
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface MealGroup {
  mealType: MealType;
  totalKcal: number;
  entries: FoodLogEntry[];
}

export interface FoodLogSummary {
  totalKcal: number;
  totalProteinG: number;
  totalCarbG: number;
  totalFatG: number;
  groups: MealGroup[]; // only non-empty meals, in canonical order
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function summarizeFoodLog(entries: FoodLogEntry[]): FoodLogSummary {
  const byMeal = new Map<MealType, FoodLogEntry[]>();
  let totalKcal = 0;
  let totalProteinG = 0;
  let totalCarbG = 0;
  let totalFatG = 0;

  for (const e of entries) {
    totalKcal += e.energyKcal;
    totalProteinG += e.proteinG;
    totalCarbG += e.carbG;
    totalFatG += e.fatG;
    const list = byMeal.get(e.mealType);
    if (list) list.push(e);
    else byMeal.set(e.mealType, [e]);
  }

  const groups: MealGroup[] = [];
  for (const mealType of MEAL_ORDER) {
    const mealEntries = byMeal.get(mealType);
    if (!mealEntries || mealEntries.length === 0) continue;
    // Keep each meal's entries in chronological order.
    mealEntries.sort((a, b) => a.timestamp - b.timestamp);
    groups.push({
      mealType,
      totalKcal: mealEntries.reduce((s, e) => s + e.energyKcal, 0),
      entries: mealEntries,
    });
  }

  return {
    totalKcal,
    totalProteinG: round1(totalProteinG),
    totalCarbG: round1(totalCarbG),
    totalFatG: round1(totalFatG),
    groups,
  };
}

import { dateString } from '../../lib/dateUtils';
import type { FoodItem, FoodLogEntry } from '../../types/food';

// Kho 🥗 "Thói quen ăn": one compact row per calendar day, written from the
// food log before the detailed entries are trimmed — so a chart can still
// show years of eating patterns (how much, which food groups) after the
// individual foods are gone.
export interface EatingDaySummary {
  date: string; // YYYY-MM-DD
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  foodCount: number;
  mealCount: number; // distinct meal types that day
  // kcal per food-database category (grain, vegetable, dish…); a food the
  // catalog can no longer resolve is counted under 'other'.
  categoryKcal: Record<string, number>;
}

export const UNKNOWN_CATEGORY = 'other';

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeEatingDays(
  entries: FoodLogEntry[],
  lookup: (foodId: string) => FoodItem | undefined
): EatingDaySummary[] {
  const byDay = new Map<string, FoodLogEntry[]>();
  for (const e of entries) {
    const day = dateString(new Date(e.timestamp));
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const categoryKcal: Record<string, number> = {};
      for (const e of list) {
        const category = lookup(e.foodId)?.category || UNKNOWN_CATEGORY;
        categoryKcal[category] = round1((categoryKcal[category] ?? 0) + e.energyKcal);
      }
      const sum = (pick: (e: FoodLogEntry) => number) => round1(list.reduce((acc, e) => acc + pick(e), 0));
      return {
        date,
        kcal: sum((e) => e.energyKcal),
        proteinG: sum((e) => e.proteinG),
        carbG: sum((e) => e.carbG),
        fatG: sum((e) => e.fatG),
        foodCount: list.length,
        mealCount: new Set(list.map((e) => e.mealType)).size,
        categoryKcal,
      };
    });
}

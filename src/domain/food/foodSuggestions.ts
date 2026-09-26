import type { FoodLogEntry, MealType, PortionUnit } from '../../types/food';
import { mealTypeForHour } from './foodNutrition';
import { addDaysToDateString, dateString } from '../../lib/dateUtils';

// Pure suggestion logic. No I/O, no state — unit-tested.

export interface FoodSuggestion {
  foodId: string;
  foodNameVi: string;
  grams: number;
  portionUnit?: PortionUnit;
  count?: number;
  // When the original entry was eaten (unix ms) — set by previousDayMeal so a
  // repeat on a backfill day lands at the same time of day (= same meal).
  eatenAt?: number;
  // The original entry's kcal — lets the repeat row re-total after dropping
  // foods that no longer resolve.
  energyKcal?: number;
}

const DEFAULT_MAX_SUGGESTIONS = 6;

// Suggests foods to log next, from what the user actually ate recently —
// favors entries logged in the same meal window (breakfast/lunch/dinner/
// snack) as `hour` so "gợi ý cho bữa này" stays relevant, falling back to
// the full recent log when nothing matches yet (e.g. first log of a new
// meal type this week). One suggestion per distinct food — its most
// recently logged portion — ranked by recency, capped at `maxCount`.
export function suggestFoods(
  recentLog: FoodLogEntry[],
  hour: number,
  maxCount: number = DEFAULT_MAX_SUGGESTIONS
): FoodSuggestion[] {
  const currentMealType = mealTypeForHour(hour);
  const sameMeal = recentLog.filter((entry) => entry.mealType === currentMealType);
  const pool = sameMeal.length > 0 ? sameMeal : recentLog;
  const byRecency = [...pool].sort((a, b) => b.timestamp - a.timestamp);

  const seenFoodIds = new Set<string>();
  const suggestions: FoodSuggestion[] = [];
  for (const entry of byRecency) {
    if (seenFoodIds.has(entry.foodId)) continue;
    seenFoodIds.add(entry.foodId);
    suggestions.push({
      foodId: entry.foodId,
      foodNameVi: entry.foodNameVi,
      grams: entry.grams,
      portionUnit: entry.portionUnit,
      count: entry.count,
    });
    if (suggestions.length >= maxCount) break;
  }
  return suggestions;
}

export interface RepeatMeal {
  items: FoodSuggestion[];
  kcal: number;
}

// "Lặp lại bữa hôm qua": everything logged for `mealType` on the calendar day
// before `day` (YYYY-MM-DD), in the order it was eaten, each with its logged
// portion. Duplicates stay (two separate eggs = two rows) so repeating gives
// exactly yesterday's meal. Empty = nothing to repeat, the UI hides the row.
export function previousDayMeal(recentLog: FoodLogEntry[], day: string, mealType: MealType): RepeatMeal {
  const previous = addDaysToDateString(day, -1);
  const entries = recentLog
    .filter((e) => e.mealType === mealType && dateString(new Date(e.timestamp)) === previous)
    .sort((a, b) => a.timestamp - b.timestamp);
  return {
    items: entries.map((e) => ({
      foodId: e.foodId,
      foodNameVi: e.foodNameVi,
      grams: e.grams,
      portionUnit: e.portionUnit,
      count: e.count,
      eatenAt: e.timestamp,
      energyKcal: e.energyKcal,
    })),
    kcal: Math.round(entries.reduce((sum, e) => sum + e.energyKcal, 0)),
  };
}

// What the "repeat" row offers: yesterday's meal, but nothing once `day`
// already has that meal logged — so reopening the sheet can't log it twice.
export function repeatableMeal(recentLog: FoodLogEntry[], day: string, mealType: MealType): RepeatMeal {
  const alreadyLogged = recentLog.some(
    (e) => e.mealType === mealType && dateString(new Date(e.timestamp)) === day
  );
  return alreadyLogged ? { items: [], kcal: 0 } : previousDayMeal(recentLog, day, mealType);
}

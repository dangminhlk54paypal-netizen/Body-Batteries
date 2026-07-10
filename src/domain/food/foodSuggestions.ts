import type { FoodLogEntry, PortionUnit } from '../../types/food';
import { mealTypeForHour } from './foodNutrition';

// Pure suggestion logic. No I/O, no state — unit-tested.

export interface FoodSuggestion {
  foodId: string;
  foodNameVi: string;
  grams: number;
  portionUnit?: PortionUnit;
  count?: number;
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

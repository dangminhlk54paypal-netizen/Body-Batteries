import type { FoodItem, MealType } from '../../types/food';
import { DEFAULT_MEAL_WINDOWS, type MealWindow } from '../../lib/constants';

// Pure nutrition + meal-classification logic. No I/O, no state — unit-tested.

// Round to one decimal place (display-friendly, avoids float noise like 8.400001).
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// The portion's macro/energy totals, scaled from the food's per-100 g figures.
// `mineralsMg` is a coarse rollup of the mineral micros — a rough estimate for
// the "Khoáng chất" battery, not a clinical figure.
export interface PortionNutrition {
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  waterG: number;
  mineralsMg: number;
}

// Converts a logged count (packs/capsules, or grams) into the grams the
// gram-based engine (nutritionForGrams) needs. For pack/capsule foods with a
// valid servingWeightG, count * servingWeightG. Otherwise the food is
// gram-based (or missing a usable servingWeightG), so `count` IS the grams —
// this mirrors the buildCustomFoodItem fallback ("no servingWeightG → treat
// as gram") so the two stay consistent.
export function gramsForPortion(item: FoodItem, count: number): number {
  const isServingBased = item.portionUnit != null && item.portionUnit !== 'gram';
  const servingWeightG = item.servingWeightG ?? 0;
  if (isServingBased && servingWeightG > 0) {
    return Math.max(0, count) * servingWeightG;
  }
  return Math.max(0, count);
}

export function nutritionForGrams(item: FoodItem, grams: number): PortionNutrition {
  const factor = Math.max(0, grams) / 100;
  const p = item.per100g;
  const mineralsPer100 =
    p.calciumMg + p.ironMg + p.sodiumMg + p.potassiumMg + p.magnesiumMg + p.zincMg;
  return {
    energyKcal: Math.round(p.energyKcal * factor),
    proteinG: round1(p.proteinG * factor),
    fatG: round1(p.fatG * factor),
    carbG: round1(p.carbG * factor),
    waterG: round1(p.waterG * factor),
    mineralsMg: Math.round(mineralsPer100 * factor),
  };
}

// Classify an eating hour (0–23) into a meal type using the given (or default)
// windows. Anything outside breakfast/lunch/dinner is a snack.
// The optional `windows` param lets Settings override the hard-coded defaults.
// Callers that omit it (FoodLogModal, tests) continue to use DEFAULT_MEAL_WINDOWS.
export function mealTypeForHour(
  hour: number,
  windows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow> = DEFAULT_MEAL_WINDOWS
): MealType {
  const inWindow = (w: MealWindow) => hour >= w.startHour && hour < w.endHour;
  if (inWindow(windows.breakfast)) return 'breakfast';
  if (inWindow(windows.lunch)) return 'lunch';
  if (inWindow(windows.dinner)) return 'dinner';
  return 'snack';
}

export function mealTypeForTimestamp(
  timestamp: number,
  windows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow> = DEFAULT_MEAL_WINDOWS
): MealType {
  return mealTypeForHour(new Date(timestamp).getHours(), windows);
}

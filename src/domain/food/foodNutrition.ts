import type { FoodItem, MealType } from '../../types/food';
import { DEFAULT_MEAL_WINDOWS } from '../../lib/constants';

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

// Classify an eating hour (0–23) into a meal type using the default windows.
// Anything outside breakfast/lunch/dinner is a snack.
export function mealTypeForHour(hour: number): MealType {
  const inWindow = (w: { startHour: number; endHour: number }) =>
    hour >= w.startHour && hour < w.endHour;
  if (inWindow(DEFAULT_MEAL_WINDOWS.breakfast)) return 'breakfast';
  if (inWindow(DEFAULT_MEAL_WINDOWS.lunch)) return 'lunch';
  if (inWindow(DEFAULT_MEAL_WINDOWS.dinner)) return 'dinner';
  return 'snack';
}

export function mealTypeForTimestamp(timestamp: number): MealType {
  return mealTypeForHour(new Date(timestamp).getHours());
}

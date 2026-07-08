import type { FoodItem } from '../../types/food';
import { getFoodById } from './foodDatabase';
import { getUsdaFoodById } from './usdaFoods';

// Resolves a logged foodId no matter which catalog it came from: the
// Vietnamese CSV ("rice_white_cooked") or the USDA lookup ("usda_2727589").
// Anything that aggregates over the food log (e.g. the micronutrient battery
// engine) must use this, not getFoodById alone — otherwise USDA-logged meals
// silently drop out of the totals.
export function getAnyFoodById(id: string): FoodItem | undefined {
  return getFoodById(id) ?? getUsdaFoodById(id);
}

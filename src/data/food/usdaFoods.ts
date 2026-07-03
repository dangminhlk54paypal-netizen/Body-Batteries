import type { FoodItem } from '../../types/food';
import { parseFoodCsv } from './foodCsv';
import { USDA_FOOD_CSV_RAW } from './usdaFoods.generated';

// A SEPARATE, ADDITIONAL lookup list of US ingredients from USDA FoodData
// Central (Foundation Foods) — English names, offline bulk data. This is NOT
// merged into FOOD_ITEMS (the Vietnamese-dish source of truth in
// foodDatabase.ts); it exists for future ingredient lookup only. Regenerate
// via `npm run gen:usda` (see database/README.md).
export const USDA_FOODS: FoodItem[] = parseFoodCsv(USDA_FOOD_CSV_RAW);

const BY_ID = new Map(USDA_FOODS.map((f) => [f.id, f]));

export function getUsdaFoodById(id: string): FoodItem | undefined {
  return BY_ID.get(id);
}

// Case-insensitive search over the English name + category, plus the
// Vietnamese name for the (growing) subset of rows translated via
// database/usda_names_vi.csv — see scripts/generate-usda-db.js. Empty query
// returns the whole list.
export function searchUsdaFoods(query: string): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return USDA_FOODS;
  return USDA_FOODS.filter(
    (f) =>
      f.nameEn.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      (f.nameVi && f.nameVi.toLowerCase().includes(q))
  );
}

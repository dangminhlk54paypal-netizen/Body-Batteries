import type { FoodItem } from '../../types/food';
import { parseFoodCsv } from './foodCsv';
import { FOOD_CSV_RAW } from './foodDatabase.generated';

// The full food database, parsed once at module load from the CSV embedded by
// `scripts/generate-food-db.js`. The CSV (`food_items.csv`) is the source of
// truth; add rows there and run `npm run gen:food`.
export const FOOD_ITEMS: FoodItem[] = parseFoodCsv(FOOD_CSV_RAW);

const BY_ID = new Map(FOOD_ITEMS.map((f) => [f.id, f]));

export function getFoodById(id: string): FoodItem | undefined {
  return BY_ID.get(id);
}

// Case-insensitive, accent-tolerant-ish search over Vietnamese name + English
// name + category. Empty query returns the whole list (so the picker shows
// everything before the user types).
export function searchFoods(query: string): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_ITEMS;
  return FOOD_ITEMS.filter(
    (f) =>
      f.nameVi.toLowerCase().includes(q) ||
      f.nameEn.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
  );
}

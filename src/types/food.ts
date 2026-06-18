// Food database & food-log types.
//
// The food database is sourced from `food_items.csv` at the project root (the
// single editable source of truth — add rows there, then `npm run gen:food`).
// Every nutrition value in the CSV is expressed *per 100 g*; portions are scaled
// from those by `nutritionForGrams` in `src/domain/food/foodNutrition.ts`.

// Which meal a logged food belongs to. Derived from the eating time via
// `mealTypeForTimestamp` (default windows in `src/lib/constants.ts`).
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// A quick-pick portion parsed from the CSV `serving_presets` column
// (e.g. "chén=150|bát=250" → [{ label: 'chén', grams: 150 }, …]).
export interface ServingPreset {
  label: string;
  grams: number;
}

// Nutrition figures. In the CSV these are per 100 g; on a FoodLogEntry they are
// the computed totals for the eaten portion. `mineralsMg` is a crude rollup of
// the electrolyte/mineral micros (a coarse estimate — this is a self-tracking
// tool, not a medical device; see docs/01-vision-and-features.md §health).
export interface Nutrition {
  energyKcal: number;
  waterG: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberG: number;
  sugarG: number;
  calciumMg: number;
  ironMg: number;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  zincMg: number;
}

// One row of the food database (one dish/ingredient).
export interface FoodItem {
  id: string;
  nameVi: string;
  nameEn: string;
  category: string;
  defaultServingG: number;
  servingPresets: ServingPreset[];
  per100g: Nutrition; // every value is per 100 g
  source: string;
  note: string;
}

// One logged meal/snack: a food eaten at a time, with the portion's computed
// nutrition snapshotted so history/Excel stay correct even if the CSV changes.
export interface FoodLogEntry {
  id: string;
  timestamp: number; // unix ms — when it was eaten (user-editable)
  mealType: MealType;
  foodId: string;
  foodNameVi: string;
  grams: number;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  waterG: number;
  mineralsMg: number;
}

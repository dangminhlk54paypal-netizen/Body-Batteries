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

// How a food's portion is naturally counted. Most foods are weighed in grams;
// supplements (TPCN) are usually taken as whole packs/capsules, so forcing a
// 100g conversion on the user is unnatural. Absent/undefined means 'gram'
// (the pre-existing behaviour — every food before this field existed).
export type PortionUnit = 'gram' | 'pack' | 'capsule';

// Nutrition figures. In the CSV these are per 100 g; on a FoodLogEntry they are
// the computed totals for the eaten portion. `mineralsMg` is a crude rollup of
// the electrolyte/mineral micros (a coarse estimate — this is a self-tracking
// tool, not a medical device; see docs/01-vision-and-features.md §health).
//
// UNIT CONVENTION — carbG: TOTAL carbohydrate (= Kohlenhydrate on EU labels),
// which CONTAINS sugarG + fiberG; sugar/fiber are a breakdown OF carbG, never
// an addition to it. Invariant carbG >= sugarG + fiberG is enforced at every
// data entry point (parseFoodCsv, buildCustomFoodItem, generate-usda-db.js)
// so the Carbs battery can never under-charge relative to its own parts.
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
  // Omega-3 fatty acids (CSV columns epa_mg/dha_mg). Optional: only fatty
  // fish and fish-oil supplements declare them; absent means "not tracked".
  epaMg?: number;
  dhaMg?: number;
}

// One row of the food database (one dish/ingredient).
export interface FoodItem {
  id: string;
  nameVi: string;
  nameEn: string;
  // German name — used for both search AND display (see foodDisplayName() in
  // foodLookup.ts) when language === 'de'. Optional: not every catalog row
  // has a translation yet; foodDisplayName falls back to nameEn then nameVi.
  nameDe?: string;
  category: string;
  defaultServingG: number;
  servingPresets: ServingPreset[];
  per100g: Nutrition; // every value is per 100 g — always the canonical storage unit
  source: string;
  note: string;
  // Optional "natural" counting unit for supplements (TPCN): when set to
  // 'pack'/'capsule', the food is logged/edited by count (e.g. "2 viên")
  // instead of grams, and servingWeightG is the real gram weight of ONE
  // pack/capsule (used to convert count <-> grams and to convert the user's
  // per-serving nutrition entry <-> the canonical per100g storage above).
  // Undefined/'gram' preserves the original gram-based behaviour untouched.
  portionUnit?: PortionUnit;
  servingWeightG?: number;
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
  // Present when the logged food is a pack/capsule (TPCN): the unit + how
  // many packs/capsules were logged, purely for display (e.g. "2 viên").
  // `grams` above still holds the converted gram total used for nutrition.
  portionUnit?: PortionUnit;
  count?: number;
  // FIX #1 (mirrors ActivityLogEntry.energyDayApplied): which 6am-reset
  // "energy day" the food's kcal charge actually landed on at log time. The
  // energy battery is keyed by energyDayString(timestamp), NOT the calendar
  // day, so a 2am snack charges YESTERDAY's ledger even though the entry still
  // lists under "today" after 6am. removeFood reads this to reverse the charge
  // on the right day. Absent on rows logged before this field existed — treated
  // as same-day for backward compatibility.
  energyDayApplied?: string;
}

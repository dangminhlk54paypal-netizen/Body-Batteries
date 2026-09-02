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
//
// 'serving' is the open-ended member: the portion is counted in whatever the
// label on the product says — hộp, chai, lon, ly, muỗng, khẩu phần — and the
// noun itself lives in FoodItem.servingLabel. 'pack'/'capsule' are kept as
// their own members (not folded into 'serving' with a label) so every food
// saved before servingLabel existed keeps its translated noun in all three
// languages instead of freezing whichever one was on screen at save time.
export type PortionUnit = 'gram' | 'pack' | 'capsule' | 'serving';

// The unit a food's amount is naturally MEASURED in — distinct from how its
// portions are COUNTED (PortionUnit). A carton of yoghurt drink is sold as
// "1 hộp 65ml", not "1 hộp 65g", and its label prints the nutrition for that
// 65ml. Absent/undefined means 'g' (every food before this field existed).
//
// The engine stores and computes in grams throughout, using the standard
// 1 ml ≈ 1 g equivalence for the drinkable foods this covers (water, juice,
// milk, yoghurt drinks — all within a few percent of 1 g/ml). So this field
// changes what the user reads and types, never what is computed: a food with
// measureUnit 'ml' still keeps per-100 g nutrition in `per100g` and a real
// gram figure in `servingWeightG`, they are just labelled in ml.
export type MeasureUnit = 'g' | 'ml';

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
  // Optional "natural" counting unit for supplements (TPCN) and packaged
  // products: when set to anything but 'gram', the food is logged/edited by
  // count (e.g. "2 viên", "1 hộp") instead of grams, and servingWeightG is
  // the size of ONE portion (used to convert count <-> grams and to convert
  // the user's per-portion nutrition entry <-> the canonical per100g storage
  // above). Undefined/'gram' preserves the original gram-based behaviour.
  portionUnit?: PortionUnit;
  // Size of one portion, always as a gram figure so the engine needs no
  // special case — but READ IN `measureUnit`: with measureUnit 'ml' a value
  // of 65 means "65 ml" (≈ 65 g). See MeasureUnit for why that is safe.
  servingWeightG?: number;
  // The portion noun for portionUnit === 'serving' — 'hộp', 'chai', 'lon',
  // 'ly', 'muỗng', 'khẩu phần'… Typed by the user, so it has one spelling in
  // whatever language they typed it in; portionUnitNoun() falls back to the
  // translated generic "portion" noun when it is absent.
  servingLabel?: string;
  // How the food's amounts are measured/displayed. Undefined means 'g'.
  measureUnit?: MeasureUnit;
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

import type { FoodItem, MeasureUnit, Nutrition, PortionUnit } from '../../types/food';
import { parseDecimal } from '../../lib/units';
import { isPortionCounted } from './portionUnits';

// Pure form-state → domain-object logic for the "add a custom food" flow in
// FoodLogModal. No I/O, no state — unit-tested. The modal only calls
// buildCustomFoodItem/isValidCustomFoodInput; it never constructs a FoodItem
// or parses numbers itself (repo rule: logic stays out of view files).

// All fields are the raw strings typed into the form's TextInputs (numeric
// keyboards still yield strings in React Native). Optional micros are hidden
// behind the "Thêm vi chất" toggle in the UI but always present here.
export interface CustomFoodInput {
  name: string;
  category: string;
  defaultServingG: string;
  // How the user counts this food: 'gram' (default, weighed) or one of the
  // counted units — 'pack'/'capsule' (supplements) and 'serving' (anything
  // sold by the box/bottle/glass, named freely in servingLabel). When not
  // 'gram', servingWeightG must be set and every macro/micro field below is
  // entered PER PORTION rather than per 100 g — buildCustomFoodItem converts.
  portionUnit: PortionUnit;
  // The user's own noun for one portion — 'hộp', 'chai', 'ly', 'khẩu phần'.
  // Only read when portionUnit is 'serving'; blank falls back to the
  // translated generic "portion" noun (see portionUnitNoun).
  servingLabel: string;
  // Whether this food's amounts are measured in grams or millilitres. Only
  // changes what the numbers are LABELLED as — the engine keeps computing in
  // grams via the 1 ml ≈ 1 g equivalence (see types/food.ts MeasureUnit).
  measureUnit: MeasureUnit;
  // Size of ONE portion, in `measureUnit` (65 for a 65ml carton). Only
  // meaningful when portionUnit is not 'gram'; ignored (may be blank) for it.
  servingWeightG: string;
  // Per-100g macros (always visible in the form) — or per-serving when
  // portionUnit is pack/capsule (see portionUnit doc above).
  energyKcal: string;
  proteinG: string;
  fatG: string;
  carbG: string;
  waterG: string;
  // Per-100g micros (behind the "Thêm vi chất" toggle)
  fiberG: string;
  sugarG: string;
  calciumMg: string;
  ironMg: string;
  sodiumMg: string;
  potassiumMg: string;
  magnesiumMg: string;
  zincMg: string;
  epaMg: string;
  dhaMg: string;
}

export const EMPTY_CUSTOM_FOOD_INPUT: CustomFoodInput = {
  name: '',
  category: 'custom',
  defaultServingG: '100',
  portionUnit: 'gram',
  servingLabel: '',
  measureUnit: 'g',
  servingWeightG: '',
  energyKcal: '',
  proteinG: '',
  fatG: '',
  carbG: '',
  waterG: '',
  fiberG: '',
  sugarG: '',
  calciumMg: '',
  ironMg: '',
  sodiumMg: '',
  potassiumMg: '',
  magnesiumMg: '',
  zincMg: '',
  epaMg: '',
  dhaMg: '',
};

// FIX #1: switching the unit chip (Gram/Gói/Viên) must not let the numbers
// already typed under the OLD unit get silently reinterpreted under the NEW
// one (per-100g vs per-serving are different scales — a "9" kcal typed while
// on Gram becomes a wildly wrong per-100g value if reused verbatim after
// switching to Viên) — clearing the fields and asking the user to re-enter
// them is safer than guessing a conversion.
export function resetNutritionForUnitChange(
  input: CustomFoodInput,
  newUnit: PortionUnit
): CustomFoodInput {
  return {
    ...input,
    portionUnit: newUnit,
    // The label only means something for 'serving'; clearing it on every
    // other switch stops a stale 'hộp' from riding along on a capsule food.
    servingLabel: newUnit === 'serving' ? input.servingLabel : '',
    servingWeightG: '',
    energyKcal: '',
    waterG: '',
    proteinG: '',
    fatG: '',
    carbG: '',
    fiberG: '',
    sugarG: '',
    calciumMg: '',
    ironMg: '',
    sodiumMg: '',
    potassiumMg: '',
    magnesiumMg: '',
    zincMg: '',
    epaMg: '',
    dhaMg: '',
  };
}

// Tolerant numeric parse: blank/whitespace/NaN → 0 (never throws, never
// produces NaN downstream — the form must stay usable even half-filled).
// Uses parseDecimal (not raw parseFloat) so a comma-decimal keyboard (VI/DE
// locale, e.g. "12,5") isn't silently truncated to "12" — same fix as the
// weight-input bug from Wave 1.
function parseNum(s: string): number {
  const n = parseDecimal(s);
  return isNaN(n) ? 0 : n;
}

// Same as parseNum but floors the result at 0 — nutrition amounts can never
// be negative, regardless of what the user typed (e.g. "-5").
function parseNonNegative(s: string): number {
  return Math.max(0, parseNum(s));
}

// Converts a per-serving (per pack/capsule) Nutrition into the canonical
// per-100g storage form: per100gValue = perServingValue / servingWeightG * 100.
// Caller must guard servingWeightG > 0.
function scalePerServingToPer100g(n: Nutrition, servingWeightG: number): Nutrition {
  const factor = 100 / servingWeightG;
  return {
    energyKcal: n.energyKcal * factor,
    waterG: n.waterG * factor,
    proteinG: n.proteinG * factor,
    fatG: n.fatG * factor,
    carbG: n.carbG * factor,
    fiberG: n.fiberG * factor,
    sugarG: n.sugarG * factor,
    calciumMg: n.calciumMg * factor,
    ironMg: n.ironMg * factor,
    sodiumMg: n.sodiumMg * factor,
    potassiumMg: n.potassiumMg * factor,
    magnesiumMg: n.magnesiumMg * factor,
    zincMg: n.zincMg * factor,
    epaMg: (n.epaMg ?? 0) * factor,
    dhaMg: (n.dhaMg ?? 0) * factor,
  };
}

// Inverse of scalePerServingToPer100g — used by inputFromFoodItem to prefill
// the per-serving form fields from the canonical per-100g storage.
function scalePer100gToPerServing(n: Nutrition, servingWeightG: number): Nutrition {
  const factor = servingWeightG / 100;
  return {
    energyKcal: n.energyKcal * factor,
    waterG: n.waterG * factor,
    proteinG: n.proteinG * factor,
    fatG: n.fatG * factor,
    carbG: n.carbG * factor,
    fiberG: n.fiberG * factor,
    sugarG: n.sugarG * factor,
    calciumMg: n.calciumMg * factor,
    ironMg: n.ironMg * factor,
    sodiumMg: n.sodiumMg * factor,
    potassiumMg: n.potassiumMg * factor,
    magnesiumMg: n.magnesiumMg * factor,
    zincMg: n.zincMg * factor,
    epaMg: (n.epaMg ?? 0) * factor,
    dhaMg: (n.dhaMg ?? 0) * factor,
  };
}

// name required (non-blank after trim), kcal must parse to a number ≥ 0, and
// — for supplement-style foods ('pack'/'capsule') — servingWeightG must parse
// to a positive number (buildCustomFoodItem divides by it when converting
// per-serving values to per-100g; a blank/0/negative value there would either
// throw or silently mis-scale every macro/micro). Used to gate the save button.
export function isValidCustomFoodInput(input: CustomFoodInput): boolean {
  if (input.name.trim().length === 0) return false;
  const kcal = parseDecimal(input.energyKcal);
  if (isNaN(kcal) || kcal < 0) return false;
  if (isPortionCounted(input.portionUnit)) {
    const servingWeightG = parseNum(input.servingWeightG);
    if (servingWeightG <= 0) return false;
  }
  return true;
}

// Inverse of buildCustomFoodItem: fill the form-state strings from an existing
// FoodItem so the "edit nutrition" flow (FoodNutritionEditModal) can prefill.
// Numbers render as their String() form (a real 0 shows "0" — honest for an
// edit form); optional micros (epaMg/dhaMg) fall back to 0. The id is NOT
// carried here — edit-mode restores the original id after buildCustomFoodItem
// so the save becomes an override of that food, not a new custom food.
export function inputFromFoodItem(item: FoodItem): CustomFoodInput {
  const portionUnit = item.portionUnit ?? 'gram';
  const isServingBased = portionUnit !== 'gram' && (item.servingWeightG ?? 0) > 0;
  // For pack/capsule foods, convert the stored per-100g values back to
  // per-serving so the form shows the same numbers the user originally typed
  // (e.g. "610" mg omega-3 per capsule, not the per-100g-scaled figure).
  const p = isServingBased
    ? scalePer100gToPerServing(item.per100g, item.servingWeightG as number)
    : item.per100g;
  const s = (n: number): string => String(n);
  return {
    name: item.nameVi,
    category: item.category,
    defaultServingG: s(item.defaultServingG),
    portionUnit,
    servingLabel: item.servingLabel ?? '',
    measureUnit: item.measureUnit ?? 'g',
    servingWeightG: item.servingWeightG != null ? s(item.servingWeightG) : '',
    energyKcal: s(p.energyKcal),
    proteinG: s(p.proteinG),
    fatG: s(p.fatG),
    carbG: s(p.carbG),
    waterG: s(p.waterG),
    fiberG: s(p.fiberG),
    sugarG: s(p.sugarG),
    calciumMg: s(p.calciumMg),
    ironMg: s(p.ironMg),
    sodiumMg: s(p.sodiumMg),
    potassiumMg: s(p.potassiumMg),
    magnesiumMg: s(p.magnesiumMg),
    zincMg: s(p.zincMg),
    epaMg: s(p.epaMg ?? 0),
    dhaMg: s(p.dhaMg ?? 0),
  };
}

// Builds a full FoodItem from the form input, ready for
// addCustomFoodAndRegister(). Caller (the modal) is responsible for
// validating first via isValidCustomFoodInput.
export function buildCustomFoodItem(input: CustomFoodInput): FoodItem {
  const name = input.name.trim();
  // Floored at 1 (not 0) so a blank/negative/zero serving never produces a
  // FoodItem that silently disables the "Ghi món" button downstream.
  const defaultServingG = Math.max(1, parseNum(input.defaultServingG) || 100);

  const servingWeightG = parseNonNegative(input.servingWeightG);
  // Only treat as pack/capsule when a usable (positive) serving weight was
  // given; otherwise fall back to the original gram behaviour untouched
  // (guards against a division by 0 when converting to per-100g below).
  const useServingConversion = input.portionUnit !== 'gram' && servingWeightG > 0;

  const sugarG = parseNonNegative(input.sugarG);
  const fiberG = parseNonNegative(input.fiberG);
  // Unit convention (same as parseFoodCsv): carbG is TOTAL carbohydrate and
  // CONTAINS sugar + fiber, so it can never be below their sum. This both
  // infers carbs when the user only filled sugar/fiber (supplement labels
  // often list just those) and corrects an inconsistent entry (carb 3 but
  // sugar+fiber 10) — otherwise the Carbs battery under-charges. Computed on
  // the as-entered (per-serving or per-100g) values, before unit conversion.
  const carbG = Math.max(parseNonNegative(input.carbG), sugarG + fiberG);

  // kcal is already validated ≥ 0 by isValidCustomFoodInput before this is
  // called, but every other field is clamped at 0 here too — the form has no
  // per-field validation, so this is the only guarantee. When useServingConversion
  // is true, these are per-serving values (per 1 pack/capsule); otherwise
  // they're already per-100g, matching the pre-existing behaviour.
  const enteredNutrition: Nutrition = {
    energyKcal: parseNonNegative(input.energyKcal),
    waterG: parseNonNegative(input.waterG),
    proteinG: parseNonNegative(input.proteinG),
    fatG: parseNonNegative(input.fatG),
    carbG,
    fiberG,
    sugarG,
    calciumMg: parseNonNegative(input.calciumMg),
    ironMg: parseNonNegative(input.ironMg),
    sodiumMg: parseNonNegative(input.sodiumMg),
    potassiumMg: parseNonNegative(input.potassiumMg),
    magnesiumMg: parseNonNegative(input.magnesiumMg),
    zincMg: parseNonNegative(input.zincMg),
    epaMg: parseNonNegative(input.epaMg),
    dhaMg: parseNonNegative(input.dhaMg),
  };

  const per100g = useServingConversion
    ? scalePerServingToPer100g(enteredNutrition, servingWeightG)
    : enteredNutrition;

  return {
    // Date.now() alone can collide on a fast double-tap of "Lưu món" (both
    // calls landing in the same millisecond), which would let the second
    // INSERT OR REPLACE silently overwrite the first custom food. The random
    // suffix makes collisions practically impossible.
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nameVi: name,
    nameEn: '',
    category: input.category.trim() || 'custom',
    defaultServingG,
    servingPresets: [],
    per100g,
    source: 'custom',
    note: '',
    portionUnit: useServingConversion ? input.portionUnit : 'gram',
    servingWeightG: useServingConversion ? servingWeightG : undefined,
    // Only a 'serving' carries a user-typed noun; 'pack'/'capsule' keep their
    // translated ones, and a gram food has no portion noun at all.
    servingLabel:
      useServingConversion && input.portionUnit === 'serving' && input.servingLabel.trim()
        ? input.servingLabel.trim()
        : undefined,
    measureUnit: input.measureUnit,
  };
}

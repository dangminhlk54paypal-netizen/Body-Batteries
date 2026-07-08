import type { FoodItem } from '../../types/food';

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
  // Per-100g macros (always visible in the form)
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

// Tolerant numeric parse: blank/whitespace/NaN → 0 (never throws, never
// produces NaN downstream — the form must stay usable even half-filled).
function parseNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Same as parseNum but floors the result at 0 — nutrition amounts can never
// be negative, regardless of what the user typed (e.g. "-5").
function parseNonNegative(s: string): number {
  return Math.max(0, parseNum(s));
}

// name required (non-blank after trim) and kcal must parse to a number ≥ 0.
// Used to gate the save button.
export function isValidCustomFoodInput(input: CustomFoodInput): boolean {
  if (input.name.trim().length === 0) return false;
  const kcal = parseFloat(input.energyKcal);
  if (isNaN(kcal) || kcal < 0) return false;
  return true;
}

// Inverse of buildCustomFoodItem: fill the form-state strings from an existing
// FoodItem so the "edit nutrition" flow (FoodNutritionEditModal) can prefill.
// Numbers render as their String() form (a real 0 shows "0" — honest for an
// edit form); optional micros (epaMg/dhaMg) fall back to 0. The id is NOT
// carried here — edit-mode restores the original id after buildCustomFoodItem
// so the save becomes an override of that food, not a new custom food.
export function inputFromFoodItem(item: FoodItem): CustomFoodInput {
  const p = item.per100g;
  const s = (n: number): string => String(n);
  return {
    name: item.nameVi,
    category: item.category,
    defaultServingG: s(item.defaultServingG),
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
    per100g: {
      // kcal is already validated ≥ 0 by isValidCustomFoodInput before this
      // is called, but every other field is clamped at 0 here too — the
      // form has no per-field validation, so this is the only guarantee.
      energyKcal: parseNonNegative(input.energyKcal),
      waterG: parseNonNegative(input.waterG),
      proteinG: parseNonNegative(input.proteinG),
      fatG: parseNonNegative(input.fatG),
      carbG: parseNonNegative(input.carbG),
      fiberG: parseNonNegative(input.fiberG),
      sugarG: parseNonNegative(input.sugarG),
      calciumMg: parseNonNegative(input.calciumMg),
      ironMg: parseNonNegative(input.ironMg),
      sodiumMg: parseNonNegative(input.sodiumMg),
      potassiumMg: parseNonNegative(input.potassiumMg),
      magnesiumMg: parseNonNegative(input.magnesiumMg),
      zincMg: parseNonNegative(input.zincMg),
      epaMg: parseNonNegative(input.epaMg),
      dhaMg: parseNonNegative(input.dhaMg),
    },
    source: 'custom',
    note: '',
  };
}

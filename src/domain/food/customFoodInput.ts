import type { FoodItem, MeasureUnit, Nutrition, PortionUnit } from '../../types/food';
import type { Language } from '../../i18n/types';
import { parseDecimal } from '../../lib/units';
import { formatPortionCount, isPortionCounted } from './portionUnits';

// Pure form-state → domain-object logic for the "add a custom food" flow in
// FoodLogModal. No I/O, no state — unit-tested. The modal only calls
// buildCustomFoodItem/isValidCustomFoodInput; it never constructs a FoodItem
// or parses numbers itself (repo rule: logic stays out of view files).

// Which scale the nutrition numbers typed into the form are on: printed per
// 100 g/ml (most labels) or per ONE serving (a bowl of phở, a yoghurt carton).
// Form-only — never stored: a FoodItem always keeps canonical `per100g`, and
// buildCustomFoodItem converts on the way in. It is independent of
// `portionUnit` (how a portion is COUNTED), so a weighed food can be entered
// per serving and a boxed food per 100 g.
export type NutritionBasis = 'per100' | 'perServing';

// All fields are the raw strings typed into the form's TextInputs (numeric
// keyboards still yield strings in React Native). Optional micros are hidden
// behind the "Thêm vi chất" toggle in the UI but always present here.
export interface CustomFoodInput {
  name: string;
  category: string;
  // Size of one serving of a WEIGHED food (portionUnit 'gram'); also the
  // default amount pre-filled when the food is logged. Counted foods define
  // their serving in servingWeightG instead — see servingSizeOf.
  defaultServingG: string;
  // How the user counts this food: 'gram' (default, weighed) or one of the
  // counted units — 'pack'/'capsule' (supplements) and 'serving' (anything
  // sold by the box/bottle/glass, named freely in servingLabel). When not
  // 'gram', servingWeightG must be set (it turns a logged count back into
  // grams). It says nothing about the scale of the nutrition numbers — that
  // is `nutritionBasis`.
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
  // The scale every nutrition field below is typed on (see NutritionBasis).
  nutritionBasis: NutritionBasis;
  // Macros (always visible in the form), on the `nutritionBasis` scale.
  energyKcal: string;
  proteinG: string;
  fatG: string;
  carbG: string;
  waterG: string;
  // Micros (behind the "Thêm vi chất" toggle), same scale
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
  nutritionBasis: 'per100',
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

// Every form field that holds a nutrition number — the ones a basis change
// converts (or wipes). One list so a new nutrient can't be forgotten in one of
// several hand-written copies.
export const NUTRITION_KEYS = [
  'energyKcal',
  'waterG',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarG',
  'calciumMg',
  'ironMg',
  'sodiumMg',
  'potassiumMg',
  'magnesiumMg',
  'zincMg',
  'epaMg',
  'dhaMg',
] as const satisfies readonly (keyof CustomFoodInput)[];

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

// Renders a computed number back into a form field: 6 significant digits is
// far beyond any nutrition label and strips floating-point tails
// (609.9999999999 → "610", 128.5714285 → "128.571") that a plain String()
// would show to the user.
function formatInputNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(Number(n.toPrecision(6)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// The size of ONE serving, in the food's measure unit — the anchor every
// per-100 ↔ per-serving conversion scales by. A counted food defines it in
// servingWeightG; a weighed food in defaultServingG. Returns 0 when the field
// is blank/zero/garbage: unlike buildCustomFoodItem's "default to 100" display
// fallback, a conversion must never guess a size the user didn't give.
export function servingSizeOf(input: CustomFoodInput): number {
  return isPortionCounted(input.portionUnit)
    ? parseNonNegative(input.servingWeightG)
    : parseNonNegative(input.defaultServingG);
}

// Re-expresses one typed number on the other scale. Blank or unparseable text
// is left exactly as typed (never turned into "NaN" or a fake 0).
function convertField(text: string, factor: number): string {
  const n = parseDecimal(text);
  return isNaN(n) ? text : formatInputNumber(n * factor);
}

// Switches the scale the nutrition numbers are typed on, CONVERTING what is
// already there so the user never has to retype: per100 → perServing scales by
// size/100, the reverse by 100/size. With no serving size there is nothing to
// convert with, so the fields are cleared rather than reinterpreted — the same
// "don't silently misread stale numbers" rule the unit chip used to enforce.
export function changeNutritionBasis(
  input: CustomFoodInput,
  next: NutritionBasis
): CustomFoodInput {
  if (next === input.nutritionBasis) return input;
  const size = servingSizeOf(input);
  const factor = next === 'perServing' ? size / 100 : 100 / size;
  const out: CustomFoodInput = { ...input, nutritionBasis: next };
  for (const key of NUTRITION_KEYS) {
    out[key] = size > 0 ? convertField(input[key], factor) : '';
  }
  return out;
}

// Switches how a portion is COUNTED (gram / gói / viên / khẩu phần…). This does
// not touch the nutrition numbers: their scale is `nutritionBasis`, which a
// unit change leaves alone. (It used to wipe them — the old FIX #1 — back when
// the unit implicitly decided the scale, so a "9 kcal" typed per 100 g could be
// silently reread as per capsule.) What it DOES carry over is the serving
// size, so a food entered "per serving" keeps its anchor when the field that
// holds it moves between defaultServingG and servingWeightG.
//
// One default follows the unit: supplement/packaged labels print numbers per
// capsule/carton, which is how a counted unit used to be read. So while NO
// nutrition number has been typed yet, crossing weighed ↔ counted also picks
// the matching basis (counted → perServing, weighed → per100). Once anything is
// typed the basis is left alone — silently rereading typed numbers on another
// scale (a "9 kcal" per capsule taken as per 100 g is an ~80x error) is exactly
// what the split exists to prevent.
export function changePortionUnit(input: CustomFoodInput, next: PortionUnit): CustomFoodInput {
  const wasCounted = isPortionCounted(input.portionUnit);
  const willBeCounted = isPortionCounted(next);
  let servingWeightG = input.servingWeightG;
  let defaultServingG = input.defaultServingG;
  let nutritionBasis = input.nutritionBasis;
  if (!wasCounted && willBeCounted) {
    if (parseNonNegative(servingWeightG) <= 0 && parseNonNegative(defaultServingG) > 0) {
      servingWeightG = defaultServingG;
    }
  } else if (wasCounted && !willBeCounted) {
    if (parseNonNegative(servingWeightG) > 0) defaultServingG = servingWeightG;
  }
  if (wasCounted !== willBeCounted && NUTRITION_KEYS.every((k) => input[k].trim() === '')) {
    nutritionBasis = willBeCounted ? 'perServing' : 'per100';
  }
  return {
    ...input,
    portionUnit: next,
    nutritionBasis,
    // The label only means something for 'serving'; clearing it on every
    // other switch stops a stale 'hộp' from riding along on a capsule food.
    servingLabel: next === 'serving' ? input.servingLabel : '',
    servingWeightG,
    defaultServingG,
  };
}

// The single entry point both modals route every form edit through: the two
// fields that have side effects on others go through their converters, every
// other field is a plain set.
export function applyCustomFoodChange<K extends keyof CustomFoodInput>(
  prev: CustomFoodInput,
  key: K,
  value: CustomFoodInput[K]
): CustomFoodInput {
  if (key === 'portionUnit') return changePortionUnit(prev, value as PortionUnit);
  if (key === 'nutritionBasis') return changeNutritionBasis(prev, value as NutritionBasis);
  return { ...prev, [key]: value };
}

// Converts a per-serving Nutrition into the canonical per-100g storage form:
// per100gValue = perServingValue / servingSize * 100. Caller must guard
// servingSize > 0.
function scalePerServingToPer100g(n: Nutrition, servingSize: number): Nutrition {
  const factor = 100 / servingSize;
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

// The numbers as typed (still on the `nutritionBasis` scale, before any
// conversion), clamped ≥ 0. Shared by buildCustomFoodItem and nutritionPreview
// so what the user is shown is exactly what would be saved.
//
// Unit convention (same as parseFoodCsv): carbG is TOTAL carbohydrate and
// CONTAINS sugar + fiber, so it can never be below their sum. This both
// infers carbs when the user only filled sugar/fiber (supplement labels
// often list just those) and corrects an inconsistent entry (carb 3 but
// sugar+fiber 10) — otherwise the Carbs battery under-charges. Applied on the
// as-entered values, before any basis conversion.
//
// kcal is already validated ≥ 0 by isValidCustomFoodInput before this is
// called, but every other field is clamped at 0 here too — the form has no
// per-field validation, so this is the only guarantee.
function enteredNutritionOf(input: CustomFoodInput): Nutrition {
  const sugarG = parseNonNegative(input.sugarG);
  const fiberG = parseNonNegative(input.fiberG);
  return {
    energyKcal: parseNonNegative(input.energyKcal),
    waterG: parseNonNegative(input.waterG),
    proteinG: parseNonNegative(input.proteinG),
    fatG: parseNonNegative(input.fatG),
    carbG: Math.max(parseNonNegative(input.carbG), sugarG + fiberG),
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
}

// What the form shows under the nutrition fields: the SAME food expressed on
// the OTHER scale ("you typed per 100 g → one serving is 450 kcal"), so the
// user can sanity-check the numbers before saving. Rounded to 1 decimal.
export interface NutritionPreview {
  target: NutritionBasis; // the scale being shown — the opposite of input.nutritionBasis
  servingSize: number; // in the food's measure unit
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

// null when there is nothing meaningful to show yet: no serving size to scale
// by, or kcal blank/invalid (the same condition isValidCustomFoodInput gates on).
export function nutritionPreview(input: CustomFoodInput): NutritionPreview | null {
  const size = servingSizeOf(input);
  if (size <= 0) return null;
  const kcal = parseDecimal(input.energyKcal);
  if (isNaN(kcal) || kcal < 0) return null;
  const typed = enteredNutritionOf(input);
  const fromPer100 = input.nutritionBasis === 'per100';
  const factor = fromPer100 ? size / 100 : 100 / size;
  return {
    target: fromPer100 ? 'perServing' : 'per100',
    servingSize: size,
    energyKcal: round1(typed.energyKcal * factor),
    proteinG: round1(typed.proteinG * factor),
    fatG: round1(typed.fatG * factor),
    carbG: round1(typed.carbG * factor),
  };
}

// What the typed nutrition numbers are per, as short text: "100g" / "100ml",
// "1 hộp" / "1 viên" for a counted food, or the generic "1 khẩu phần" for a
// weighed food entered per serving. Used for the field suffixes and both
// modals' subtitles so one choice is never described two ways on one screen.
// (The stored-food equivalent is nutritionBasisLabel in portionUnits.ts.)
export function formBasisLabel(input: CustomFoodInput, language: Language): string {
  if (input.nutritionBasis === 'per100') return `100${input.measureUnit}`;
  if (isPortionCounted(input.portionUnit)) {
    return formatPortionCount(1, input.portionUnit, input.servingLabel, language);
  }
  return formatPortionCount(1, 'serving', undefined, language);
}

// name required (non-blank after trim), kcal must parse to a number ≥ 0, and:
//  - a counted food ('pack'/'capsule'/'serving') needs a positive
//    servingWeightG — it is the divisor that turns a logged count into grams,
//    so blank/0/negative would mis-scale every log of it;
//  - nutrition typed PER SERVING needs a real positive serving size — the
//    conversion to per-100g divides by it, and (unlike per-100g entry) must
//    not fall back to a guessed 100.
// Used to gate the save button.
export function isValidCustomFoodInput(input: CustomFoodInput): boolean {
  if (input.name.trim().length === 0) return false;
  const kcal = parseDecimal(input.energyKcal);
  if (isNaN(kcal) || kcal < 0) return false;
  if (isPortionCounted(input.portionUnit)) {
    const servingWeightG = parseNum(input.servingWeightG);
    if (servingWeightG <= 0) return false;
  }
  if (input.nutritionBasis === 'perServing' && servingSizeOf(input) <= 0) return false;
  return true;
}

// Inverse of buildCustomFoodItem: fill the form-state strings from an existing
// FoodItem so the "edit nutrition" flow (FoodNutritionEditModal) can prefill.
// The basis is not stored, so it is inferred: a counted food reopens on
// "per serving" (the numbers the user originally typed for a capsule/carton),
// a weighed food on "per 100 g" — and either is one tap away from the other
// since a basis change converts rather than wipes. Numbers go through
// formatInputNumber so a converted value doesn't show a floating-point tail
// (a real 0 still shows "0" — honest for an edit form); optional micros
// (epaMg/dhaMg) fall back to 0. The id is NOT carried here — edit-mode
// restores the original id after buildCustomFoodItem so the save becomes an
// override of that food, not a new custom food.
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
  const f = formatInputNumber;
  return {
    name: item.nameVi,
    category: item.category,
    defaultServingG: s(item.defaultServingG),
    portionUnit,
    servingLabel: item.servingLabel ?? '',
    measureUnit: item.measureUnit ?? 'g',
    servingWeightG: item.servingWeightG != null ? s(item.servingWeightG) : '',
    nutritionBasis: isServingBased ? 'perServing' : 'per100',
    energyKcal: f(p.energyKcal),
    proteinG: f(p.proteinG),
    fatG: f(p.fatG),
    carbG: f(p.carbG),
    waterG: f(p.waterG),
    fiberG: f(p.fiberG),
    sugarG: f(p.sugarG),
    calciumMg: f(p.calciumMg),
    ironMg: f(p.ironMg),
    sodiumMg: f(p.sodiumMg),
    potassiumMg: f(p.potassiumMg),
    magnesiumMg: f(p.magnesiumMg),
    zincMg: f(p.zincMg),
    epaMg: f(p.epaMg ?? 0),
    dhaMg: f(p.dhaMg ?? 0),
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
  // Only treat as pack/capsule/serving when a usable (positive) serving weight
  // was given; otherwise fall back to the original gram behaviour untouched.
  // This is purely the COUNTING metadata — it no longer decides how the typed
  // numbers are scaled (that is nutritionBasis, below).
  const portionCounted = input.portionUnit !== 'gram' && servingWeightG > 0;

  const enteredNutrition = enteredNutritionOf(input);

  // Typed per serving → divide by that serving's size to reach the canonical
  // per-100g storage. The size is the same servingSizeOf the form's preview
  // and validation use, so what was shown is what is saved. Typed per 100 g
  // (or no usable size to scale by) → already canonical.
  const servingSize = servingSizeOf(input);
  const per100g =
    input.nutritionBasis === 'perServing' && servingSize > 0
      ? scalePerServingToPer100g(enteredNutrition, servingSize)
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
    portionUnit: portionCounted ? input.portionUnit : 'gram',
    servingWeightG: portionCounted ? servingWeightG : undefined,
    // Only a 'serving' carries a user-typed noun; 'pack'/'capsule' keep their
    // translated ones, and a gram food has no portion noun at all.
    servingLabel:
      portionCounted && input.portionUnit === 'serving' && input.servingLabel.trim()
        ? input.servingLabel.trim()
        : undefined,
    measureUnit: input.measureUnit,
  };
}

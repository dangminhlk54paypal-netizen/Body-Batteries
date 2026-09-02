import type { FoodItem, MeasureUnit, PortionUnit } from '../../types/food';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Pure naming/formatting for a food's portion + measure units. No I/O, no
// state — takes `language` explicitly (AGENTS.md §3: domain code never reads
// the settings store).
//
// This is the single source of truth for turning the (portionUnit,
// servingLabel, measureUnit) triple into text. Before it existed, four
// separate views each open-coded `portionUnit === 'pack' ? … : 'capsule' ? …`,
// which is why adding a fifth unit meant editing four files and why none of
// them could show a user-typed noun like "hộp".

// Round to one decimal place, then drop a trailing ".0" — "65ml" reads better
// than "65.0ml", but "62.5ml" must keep its half.
function formatAmount(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function measureUnitOf(item: Pick<FoodItem, 'measureUnit'> | undefined | null): MeasureUnit {
  return item?.measureUnit ?? 'g';
}

// Is this food counted in whole portions (packs/capsules/boxes) rather than
// weighed out? Everything that used to be spelled
// `portionUnit != null && portionUnit !== 'gram'`.
export function isPortionCounted(portionUnit: PortionUnit | undefined): boolean {
  return portionUnit != null && portionUnit !== 'gram';
}

// The noun for ONE portion: 'gói' / 'viên' for the two built-in units, the
// user's own `servingLabel` for a 'serving', and the generic translated
// "portion" noun when a 'serving' has no label. '' for gram-based foods,
// which have no portion noun at all.
export function portionUnitNoun(
  portionUnit: PortionUnit | undefined,
  servingLabel: string | undefined,
  language: Language
): string {
  if (portionUnit === 'pack') return translate(language, 'units.portion.pack');
  if (portionUnit === 'capsule') return translate(language, 'units.portion.capsule');
  if (portionUnit === 'serving') {
    const label = servingLabel?.trim();
    return label ? label : translate(language, 'units.portion.serving');
  }
  return '';
}

// "65ml" / "150g" — the raw amount in the food's measure unit. `g` and `ml`
// are the same token in all three languages, so nothing is translated here.
export function formatMeasure(amount: number, measureUnit: MeasureUnit | undefined): string {
  return `${formatAmount(amount)}${measureUnit ?? 'g'}`;
}

// "2 hộp" / "1 viên" / "3 khẩu phần".
export function formatPortionCount(
  count: number,
  portionUnit: PortionUnit | undefined,
  servingLabel: string | undefined,
  language: Language
): string {
  return translate(language, 'units.portion.countFormat', {
    count: formatAmount(count),
    unit: portionUnitNoun(portionUnit, servingLabel, language),
  });
}

// The amount label for one logged portion, used by every list/sheet that
// shows a logged food: "2 hộp (130ml)" for a counted portion, "150g" for a
// weighed one. `food` is the resolved FoodItem (getAnyFoodById) — pass
// undefined when the catalog can no longer resolve it, and the generic
// "portion" noun plus a gram amount are used instead.
export function formatLoggedPortion(
  entry: { portionUnit?: PortionUnit; count?: number; grams: number },
  food: Pick<FoodItem, 'servingLabel' | 'measureUnit'> | undefined | null,
  language: Language
): string {
  const measureUnit = measureUnitOf(food);
  if (isPortionCounted(entry.portionUnit) && entry.count != null) {
    return translate(language, 'units.portion.countWithMeasure', {
      portion: formatPortionCount(entry.count, entry.portionUnit, food?.servingLabel, language),
      measure: formatMeasure(entry.grams, measureUnit),
    });
  }
  return formatMeasure(entry.grams, measureUnit);
}

// "1 hộp = 65ml" — how one portion is defined, for the food-entry forms and
// the nutrition-basis captions.
export function formatServingDefinition(
  servingWeightG: number,
  portionUnit: PortionUnit | undefined,
  servingLabel: string | undefined,
  language: Language,
  measureUnit: MeasureUnit | undefined
): string {
  return translate(language, 'units.portion.servingDefinition', {
    unit: portionUnitNoun(portionUnit, servingLabel, language),
    measure: formatMeasure(servingWeightG, measureUnit),
  });
}

// What ONE set of nutrition numbers in the custom-food form is expressed per:
// "1 hộp" / "1 viên" for a counted food, "100ml" / "100g" for a weighed one.
// Shared by the form's field suffixes and both modals' intro subtitles so a
// single unit choice can never be described two different ways on one screen.
export function nutritionBasisLabel(
  portionUnit: PortionUnit | undefined,
  servingLabel: string | undefined,
  measureUnit: MeasureUnit | undefined,
  language: Language
): string {
  if (isPortionCounted(portionUnit)) {
    return formatPortionCount(1, portionUnit, servingLabel, language);
  }
  return `100${measureUnit ?? 'g'}`;
}

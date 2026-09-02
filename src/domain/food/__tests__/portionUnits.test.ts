import {
  formatLoggedPortion,
  formatMeasure,
  formatPortionCount,
  formatServingDefinition,
  isPortionCounted,
  measureUnitOf,
  nutritionBasisLabel,
  portionUnitNoun,
} from '../portionUnits';

describe('measureUnitOf', () => {
  it('defaults to grams for a food saved before the field existed', () => {
    expect(measureUnitOf(undefined)).toBe('g');
    expect(measureUnitOf({ measureUnit: undefined })).toBe('g');
  });

  it('honours an explicit ml food', () => {
    expect(measureUnitOf({ measureUnit: 'ml' })).toBe('ml');
  });
});

describe('isPortionCounted', () => {
  it('is false for gram-based / legacy foods and true for every counted unit', () => {
    expect(isPortionCounted(undefined)).toBe(false);
    expect(isPortionCounted('gram')).toBe(false);
    expect(isPortionCounted('pack')).toBe(true);
    expect(isPortionCounted('capsule')).toBe(true);
    expect(isPortionCounted('serving')).toBe(true);
  });
});

describe('portionUnitNoun', () => {
  it('translates the two built-in units per language', () => {
    expect(portionUnitNoun('capsule', undefined, 'vi')).toBe('viên');
    expect(portionUnitNoun('capsule', undefined, 'en')).toBe('capsule');
    expect(portionUnitNoun('capsule', undefined, 'de')).toBe('Kapsel');
  });

  it("uses the user's own noun for a 'serving'", () => {
    expect(portionUnitNoun('serving', 'hộp', 'vi')).toBe('hộp');
    // The typed noun is the SAME in every language — it is user data, not a
    // translatable string.
    expect(portionUnitNoun('serving', 'hộp', 'de')).toBe('hộp');
  });

  it("falls back to the translated generic noun when a 'serving' has no label", () => {
    expect(portionUnitNoun('serving', '', 'vi')).toBe('khẩu phần');
    expect(portionUnitNoun('serving', '   ', 'en')).toBe('serving');
  });

  it('has no noun at all for a weighed food', () => {
    expect(portionUnitNoun('gram', 'hộp', 'vi')).toBe('');
    expect(portionUnitNoun(undefined, undefined, 'vi')).toBe('');
  });
});

describe('formatMeasure', () => {
  it('labels grams by default and millilitres when asked', () => {
    expect(formatMeasure(150, undefined)).toBe('150g');
    expect(formatMeasure(65, 'ml')).toBe('65ml');
  });

  it('drops a trailing .0 but keeps a real decimal', () => {
    expect(formatMeasure(65.04, 'ml')).toBe('65ml');
    expect(formatMeasure(62.5, 'ml')).toBe('62.5ml');
  });
});

describe('formatPortionCount / formatServingDefinition', () => {
  it('counts portions with the right noun', () => {
    expect(formatPortionCount(2, 'serving', 'hộp', 'vi')).toBe('2 hộp');
    expect(formatPortionCount(3, 'capsule', undefined, 'en')).toBe('3 capsule');
  });

  it('spells out what one portion is', () => {
    expect(formatServingDefinition(65, 'serving', 'hộp', 'vi', 'ml')).toBe('1 hộp = 65ml');
    expect(formatServingDefinition(1.22, 'capsule', undefined, 'vi', 'g')).toBe('1 viên = 1.2g');
  });
});

describe('formatLoggedPortion', () => {
  // The reported case: a 65ml carton logged as 2 boxes must read as boxes AND
  // millilitres, never as a bare gram figure the label never mentions.
  it('shows a counted portion as count + the measured amount', () => {
    const entry = { portionUnit: 'serving' as const, count: 2, grams: 130 };
    const food = { servingLabel: 'hộp', measureUnit: 'ml' as const };
    expect(formatLoggedPortion(entry, food, 'vi')).toBe('2 hộp (130ml)');
  });

  it('shows a weighed food as a plain amount in its own measure unit', () => {
    expect(formatLoggedPortion({ grams: 150 }, { measureUnit: 'g' }, 'vi')).toBe('150g');
    expect(formatLoggedPortion({ grams: 250 }, { measureUnit: 'ml' }, 'vi')).toBe('250ml');
  });

  it('degrades to grams + the generic noun when the food is gone from every catalog', () => {
    const entry = { portionUnit: 'serving' as const, count: 2, grams: 130 };
    expect(formatLoggedPortion(entry, undefined, 'vi')).toBe('2 khẩu phần (130g)');
  });

  it('ignores the count when a counted entry has none (legacy row)', () => {
    const entry = { portionUnit: 'pack' as const, grams: 30 };
    expect(formatLoggedPortion(entry, undefined, 'vi')).toBe('30g');
  });
});

describe('nutritionBasisLabel', () => {
  it('is one portion for a counted food and 100 units for a weighed one', () => {
    expect(nutritionBasisLabel('serving', 'hộp', 'ml', 'vi')).toBe('1 hộp');
    expect(nutritionBasisLabel('gram', '', 'ml', 'vi')).toBe('100ml');
    expect(nutritionBasisLabel(undefined, undefined, undefined, 'vi')).toBe('100g');
  });
});

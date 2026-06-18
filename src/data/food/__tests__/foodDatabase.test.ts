import { FOOD_ITEMS, getFoodById, searchFoods } from '../foodDatabase';

// Smoke test over the real food_items.csv → foodDatabase.generated.ts pipeline.
// If the CSV or generator breaks, this fails before the app ever bundles.
describe('food database (real CSV)', () => {
  it('parses a non-trivial number of foods', () => {
    expect(FOOD_ITEMS.length).toBeGreaterThan(50);
  });

  it('every item has an id, a Vietnamese name and positive energy data', () => {
    for (const f of FOOD_ITEMS) {
      expect(f.id).toBeTruthy();
      expect(f.nameVi).toBeTruthy();
      expect(f.defaultServingG).toBeGreaterThan(0);
      expect(f.per100g.energyKcal).toBeGreaterThanOrEqual(0);
    }
  });

  it('looks up a known item with parsed presets', () => {
    const rice = getFoodById('rice_white_cooked');
    expect(rice).toBeDefined();
    expect(rice!.category).toBe('grain');
    expect(rice!.servingPresets.length).toBeGreaterThan(0);
  });

  it('search matches by Vietnamese name', () => {
    expect(searchFoods('cơm').some((f) => f.id === 'rice_white_cooked')).toBe(true);
  });
});

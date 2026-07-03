import { USDA_FOODS, getUsdaFoodById, searchUsdaFoods } from '../usdaFoods';

// Smoke test over the USDA FoodData Central bulk pipeline
// (database/raw/*.json -> scripts/generate-usda-db.js -> usdaFoods.generated.ts).
// This is a SEPARATE lookup list — see spec in
// .ai/parallel-reports/S-N-food-data-usda-spec.md. Does not touch food_items.csv.
describe('USDA foods database (generated CSV)', () => {
  it('parses all 363 Foundation Foods (32 null entries filtered out)', () => {
    expect(USDA_FOODS.length).toBe(363);
  });

  it('every item has a usda_-prefixed id, English name and non-negative energy', () => {
    for (const f of USDA_FOODS) {
      expect(f.id.startsWith('usda_')).toBe(true);
      expect(f.nameEn).toBeTruthy();
      expect(f.defaultServingG).toBe(100);
      expect(f.per100g.energyKcal).toBeGreaterThanOrEqual(0);
      expect(f.source).toBe('USDA-FDC');
    }
  });

  it('uses the USDA #208 energy value directly when present (no Atwater note)', () => {
    const hummus = getUsdaFoodById('usda_321358');
    expect(hummus).toBeDefined();
    expect(hummus!.nameEn).toBe('Hummus, commercial');
    expect(hummus!.per100g.energyKcal).toBe(229);
    expect(hummus!.note).toBe('');
  });

  it('computes energy via Atwater when #208 is missing, and flags it in note', () => {
    const beans = getUsdaFoodById('usda_747430');
    expect(beans).toBeDefined();
    // protein 25.5*4 + carb 0*4 + fat 1.04*9 = 111.36 -> rounded 111
    expect(beans!.per100g.energyKcal).toBe(111);
    expect(beans!.note).toBe('kcal computed (Atwater)');
  });

  it('search matches by English name', () => {
    expect(searchUsdaFoods('hummus').some((f) => f.id === 'usda_321358')).toBe(true);
  });

  it('fills name_vi from database/usda_names_vi.csv via build-time left-join', () => {
    const hummus = getUsdaFoodById('usda_321358');
    expect(hummus!.nameVi).toBe('Hummus (đậu gà nghiền)');
  });

  it('leaves name_vi blank for foods not listed in usda_names_vi.csv', () => {
    const beans = getUsdaFoodById('usda_747430');
    expect(beans!.nameVi).toBe('');
  });

  it('search also matches by the translated Vietnamese name', () => {
    expect(searchUsdaFoods('đậu gà').some((f) => f.id === 'usda_321358')).toBe(true);
  });

  it('does not mix into the Vietnamese food_items.csv database', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FOOD_ITEMS } = require('../foodDatabase');
    const overlap = FOOD_ITEMS.filter((f: { id: string }) => f.id.startsWith('usda_'));
    expect(overlap.length).toBe(0);
  });
});

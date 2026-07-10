import { USDA_FOODS, getUsdaFoodById, searchUsdaFoods } from '../usdaFoods';
import { FOOD_ITEMS } from '../foodDatabase';

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
    // carb lifted 0 → 4.3 by the carbG >= sugar+fiber convention (fiber 4.3),
    // so: protein 25.5*4 + carb 4.3*4 + fat 1.04*9 = 128.56 -> rounded 129
    expect(beans!.per100g.energyKcal).toBe(129);
    expect(beans!.note).toBe('kcal computed (Atwater)');
  });

  it('search matches by English name', () => {
    expect(searchUsdaFoods('hummus').some((f) => f.id === 'usda_321358')).toBe(true);
  });

  it('fills name_vi from database/usda_names_vi.csv via build-time left-join', () => {
    const hummus = getUsdaFoodById('usda_321358');
    expect(hummus!.nameVi).toBe('Hummus (đậu gà nghiền)');
  });

  it('search also matches by the translated Vietnamese name', () => {
    expect(searchUsdaFoods('đậu gà').some((f) => f.id === 'usda_321358')).toBe(true);
  });

  it('has a non-empty name_vi for every one of the 363 rows (full cover file)', () => {
    // database/usda_names_vi.csv now translates all 363 ids (see
    // scripts/generate-usda-db.js's left-join) — no row should be blank.
    for (const f of USDA_FOODS) {
      expect(f.nameVi.trim().length).toBeGreaterThan(0);
    }
  });

  // The 2026 Foundation release reports sugar/fiber under new analysis-method
  // nutrient numbers (269.3 / 293) for most rows; mapping only the classic
  // numbers zeroed those columns and the sugar/fiber micro batteries never
  // charged when eating USDA foods (S-A device-test bug).
  it('maps "Sugars, Total" (number 269.3) into sugar_g', () => {
    const grapefruitJuice = getUsdaFoodById('usda_325287');
    expect(grapefruitJuice!.per100g.sugarG).toBeCloseTo(7.72);
  });

  it('maps "Total dietary fiber (AOAC 2011.25)" (number 293) into fiber_g', () => {
    const soyFlour = getUsdaFoodById('usda_1104705');
    expect(soyFlour!.per100g.fiberG).toBeCloseTo(24.3);
  });

  it('clamps negative "by difference" macros to 0 (raw drumstick carb is -0.475)', () => {
    const drumstick = getUsdaFoodById('usda_2727566');
    expect(drumstick!.per100g.carbG).toBe(0);
  });

  it('holds the unit convention carbG >= sugarG + fiberG on every row', () => {
    for (const f of USDA_FOODS) {
      expect(f.per100g.carbG).toBeGreaterThanOrEqual(
        f.per100g.sugarG + f.per100g.fiberG - 0.001
      );
    }
  });

  it('never emits a negative per-100g value in any row', () => {
    for (const f of USDA_FOODS) {
      const p = f.per100g;
      for (const v of [p.energyKcal, p.waterG, p.proteinG, p.fatG, p.carbG, p.fiberG, p.sugarG, p.calciumMg, p.ironMg, p.sodiumMg, p.potassiumMg, p.magnesiumMg, p.zincMg]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('does not mix into the Vietnamese food_items.csv database', () => {
    const overlap = FOOD_ITEMS.filter((f) => f.id.startsWith('usda_'));
    expect(overlap.length).toBe(0);
  });

  it('fills name_de from database/usda_names_de.csv via build-time left-join', () => {
    const hummus = getUsdaFoodById('usda_321358');
    expect(hummus!.nameDe).toBe('Hummus');
  });

  it('has a non-empty name_de for every one of the 363 rows (full cover file)', () => {
    // database/usda_names_de.csv now translates all 363 ids (see
    // scripts/generate-usda-db.js's left-join) — no row should be blank.
    for (const f of USDA_FOODS) {
      expect((f.nameDe ?? '').trim().length).toBeGreaterThan(0);
    }
  });
});

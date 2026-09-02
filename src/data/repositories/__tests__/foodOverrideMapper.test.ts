import { rowToOverrideItem } from '../foodOverrideMapper';

// Pure row <-> FoodItem mapping — no DB needed (rowToOverrideItem takes a
// plain object matching the `food_overrides` table shape).
describe('rowToOverrideItem', () => {
  it('maps every column to the matching FoodItem/Nutrition field', () => {
    const row = {
      food_id: 'rice_white_cooked',
      name_vi: 'Cơm trắng (đã sửa)',
      name_en: 'White rice (corrected)',
      category: 'grains',
      default_serving_g: 150,
      energy_kcal: 130,
      water_g: 68,
      protein_g: 2.7,
      fat_g: 0.3,
      carb_g: 28,
      fiber_g: 0.4,
      sugar_g: 0.1,
      calcium_mg: 10,
      iron_mg: 0.2,
      sodium_mg: 1,
      potassium_mg: 35,
      magnesium_mg: 12,
      zinc_mg: 0.5,
      epa_mg: 5,
      dha_mg: 8,
      portion_unit: null,
      serving_weight_g: null,
      serving_label: null,
      measure_unit: null,
      updated_at: 1700000000000,
    };

    const item = rowToOverrideItem(row);

    expect(item.id).toBe('rice_white_cooked');
    expect(item.nameVi).toBe('Cơm trắng (đã sửa)');
    expect(item.nameEn).toBe('White rice (corrected)');
    expect(item.nameDe).toBe('');
    expect(item.category).toBe('grains');
    expect(item.defaultServingG).toBe(150);
    expect(item.servingPresets).toEqual([]);
    expect(item.source).toBe('override');
    expect(item.note).toBe('');
    expect(item.per100g).toEqual({
      energyKcal: 130,
      waterG: 68,
      proteinG: 2.7,
      fatG: 0.3,
      carbG: 28,
      fiberG: 0.4,
      sugarG: 0.1,
      calciumMg: 10,
      ironMg: 0.2,
      sodiumMg: 1,
      potassiumMg: 35,
      magnesiumMg: 12,
      zincMg: 0.5,
      epaMg: 5,
      dhaMg: 8,
    });
  });

  it('maps NULL epa_mg/dha_mg to undefined (not tracked, matching the catalog convention)', () => {
    const row = {
      food_id: 'usda_123',
      name_vi: 'Táo',
      name_en: 'Apple',
      category: 'fruit',
      default_serving_g: 100,
      energy_kcal: 52,
      water_g: 86,
      protein_g: 0.3,
      fat_g: 0.2,
      carb_g: 14,
      fiber_g: 2.4,
      sugar_g: 10,
      calcium_mg: 6,
      iron_mg: 0.1,
      sodium_mg: 1,
      potassium_mg: 107,
      magnesium_mg: 5,
      zinc_mg: 0,
      epa_mg: null,
      dha_mg: null,
      portion_unit: null,
      serving_weight_g: null,
      serving_label: null,
      measure_unit: null,
      updated_at: 1700000000000,
    };

    const item = rowToOverrideItem(row);

    expect(item.per100g.epaMg).toBeUndefined();
    expect(item.per100g.dhaMg).toBeUndefined();
  });

  it('maps portion_unit/serving_weight_g when the override is for a pack/capsule food', () => {
    const row = {
      food_id: 'custom_vitc',
      name_vi: 'Vitamin C gói',
      name_en: 'Vitamin C sachet',
      category: 'supplement',
      default_serving_g: 5,
      energy_kcal: 4,
      water_g: 0,
      protein_g: 0,
      fat_g: 0,
      carb_g: 1,
      fiber_g: 0,
      sugar_g: 1,
      calcium_mg: 0,
      iron_mg: 0,
      sodium_mg: 0,
      potassium_mg: 0,
      magnesium_mg: 0,
      zinc_mg: 0,
      epa_mg: null,
      dha_mg: null,
      portion_unit: 'pack',
      serving_weight_g: 5,
      serving_label: null,
      measure_unit: null,
      updated_at: 1700000000000,
    };

    const item = rowToOverrideItem(row);
    expect(item.portionUnit).toBe('pack');
    expect(item.servingWeightG).toBe(5);
  });
});

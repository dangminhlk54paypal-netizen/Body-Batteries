import { rowToCustomFoodItem } from '../customFoodMapper';

// Pure row <-> FoodItem mapping — no DB needed (rowToCustomFoodItem takes a
// plain object matching the `custom_foods` table shape).
describe('rowToCustomFoodItem', () => {
  it('maps every column to the matching FoodItem/Nutrition field', () => {
    const row = {
      id: 'custom_1',
      name_vi: 'Bánh mì tự làm',
      name_en: 'Homemade bread',
      category: 'custom',
      default_serving_g: 80,
      energy_kcal: 250,
      water_g: 35,
      protein_g: 8,
      fat_g: 3,
      carb_g: 45,
      fiber_g: 2,
      sugar_g: 1,
      calcium_mg: 20,
      iron_mg: 1.5,
      sodium_mg: 400,
      potassium_mg: 100,
      magnesium_mg: 15,
      zinc_mg: 0.8,
      epa_mg: 10,
      dha_mg: 20,
      portion_unit: null,
      serving_weight_g: null,
      created_at: 1700000000000,
    };

    const item = rowToCustomFoodItem(row);

    expect(item.id).toBe('custom_1');
    expect(item.nameVi).toBe('Bánh mì tự làm');
    expect(item.nameEn).toBe('Homemade bread');
    expect(item.nameDe).toBe('');
    expect(item.category).toBe('custom');
    expect(item.defaultServingG).toBe(80);
    expect(item.servingPresets).toEqual([]);
    expect(item.source).toBe('custom');
    expect(item.note).toBe('');
    expect(item.per100g).toEqual({
      energyKcal: 250,
      waterG: 35,
      proteinG: 8,
      fatG: 3,
      carbG: 45,
      fiberG: 2,
      sugarG: 1,
      calciumMg: 20,
      ironMg: 1.5,
      sodiumMg: 400,
      potassiumMg: 100,
      magnesiumMg: 15,
      zincMg: 0.8,
      epaMg: 10,
      dhaMg: 20,
    });
  });

  it('maps NULL epa_mg/dha_mg to undefined (not tracked, matching the built-in catalog convention)', () => {
    const row = {
      id: 'custom_2',
      name_vi: 'Rau muống luộc',
      name_en: 'Boiled water spinach',
      category: 'custom',
      default_serving_g: 100,
      energy_kcal: 20,
      water_g: 90,
      protein_g: 2,
      fat_g: 0.2,
      carb_g: 3,
      fiber_g: 2,
      sugar_g: 0.5,
      calcium_mg: 70,
      iron_mg: 1.2,
      sodium_mg: 30,
      potassium_mg: 300,
      magnesium_mg: 60,
      zinc_mg: 0.3,
      epa_mg: null,
      dha_mg: null,
      portion_unit: null,
      serving_weight_g: null,
      created_at: 1700000000000,
    };

    const item = rowToCustomFoodItem(row);

    expect(item.per100g.epaMg).toBeUndefined();
    expect(item.per100g.dhaMg).toBeUndefined();
  });

  it('maps portion_unit/serving_weight_g for a capsule supplement, and NULL to undefined for a gram-based food', () => {
    const capsuleRow = {
      id: 'custom_omega3',
      name_vi: 'Omega-3 viên',
      name_en: 'Omega-3 capsule',
      category: 'supplement',
      default_serving_g: 1.22,
      energy_kcal: 9,
      water_g: 0,
      protein_g: 0,
      fat_g: 1,
      carb_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      calcium_mg: 0,
      iron_mg: 0,
      sodium_mg: 0,
      potassium_mg: 0,
      magnesium_mg: 0,
      zinc_mg: 0,
      epa_mg: 24590.16,
      dha_mg: 24590.16,
      portion_unit: 'capsule',
      serving_weight_g: 1.22,
      created_at: 1700000000000,
    };

    const item = rowToCustomFoodItem(capsuleRow);
    expect(item.portionUnit).toBe('capsule');
    expect(item.servingWeightG).toBe(1.22);

    const gramRow = { ...capsuleRow, portion_unit: null, serving_weight_g: null };
    const gramItem = rowToCustomFoodItem(gramRow);
    expect(gramItem.portionUnit).toBeUndefined();
    expect(gramItem.servingWeightG).toBeUndefined();
  });
});

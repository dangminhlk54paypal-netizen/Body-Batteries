import { buildNutritionDetail } from '../nutritionDetail';
import type { FoodItem, FoodLogEntry } from '../../../types/food';

const salmon: FoodItem = {
  id: 'salmon_grilled',
  nameVi: 'Cá hồi nướng',
  nameEn: 'Grilled salmon',
  category: 'protein',
  defaultServingG: 150,
  servingPresets: [],
  per100g: {
    energyKcal: 208,
    waterG: 63,
    proteinG: 20,
    fatG: 13,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    calciumMg: 9,
    ironMg: 0.3,
    sodiumMg: 59,
    potassiumMg: 384,
    magnesiumMg: 27,
    zincMg: 0.4,
    epaMg: 690,
    dhaMg: 1100,
  },
  source: 'USDA',
  note: '',
};

const rice: FoodItem = {
  id: 'rice_white_cooked',
  nameVi: 'Cơm trắng',
  nameEn: 'White rice, cooked',
  category: 'grain',
  defaultServingG: 150,
  servingPresets: [],
  per100g: {
    energyKcal: 130,
    waterG: 68.4,
    proteinG: 2.7,
    fatG: 0.3,
    carbG: 28.2,
    fiberG: 0.4,
    sugarG: 0.1,
    calciumMg: 10,
    ironMg: 0.2,
    sodiumMg: 1,
    potassiumMg: 35,
    magnesiumMg: 12,
    zincMg: 0.5,
  },
  source: 'USDA',
  note: '',
};

function makeEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'e1',
    timestamp: Date.now(),
    mealType: 'lunch',
    foodId: 'salmon_grilled',
    foodNameVi: 'Cá hồi nướng',
    grams: 150,
    energyKcal: 312,
    proteinG: 30,
    fatG: 19.5,
    carbG: 0,
    waterG: 94.5,
    mineralsMg: 100,
    ...overrides,
  };
}

describe('buildNutritionDetail — item resolved (full breakdown)', () => {
  it('scales kcal + the 4 macros + water to the logged grams', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), salmon);
    expect(rows).toEqual(
      expect.arrayContaining([
        { label: 'Năng lượng', value: 312, unit: 'kcal' }, // 208 * 1.5
        { label: 'Đạm', value: 30, unit: 'g' },
        { label: 'Béo', value: 19.5, unit: 'g' },
        { label: 'Carbs', value: 0, unit: 'g' },
        { label: 'Nước', value: 94.5, unit: 'g' },
      ])
    );
  });

  it('always shows Carbs even when it is 0 for this food', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), salmon);
    expect(rows.find((r) => r.label === 'Carbs')).toEqual({
      label: 'Carbs',
      value: 0,
      unit: 'g',
    });
  });

  it('includes individual minerals scaled to the portion', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), salmon);
    expect(rows.find((r) => r.label === 'Canxi')).toEqual({
      label: 'Canxi',
      value: 13.5, // 9 * 1.5
      unit: 'mg',
    });
    expect(rows.find((r) => r.label === 'Kali')).toEqual({
      label: 'Kali',
      value: 576, // 384 * 1.5
      unit: 'mg',
    });
  });

  it('shows a combined EPA/DHA row when the food declares it', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), salmon);
    // (690 + 1100) * 1.5 = 2685
    expect(rows.find((r) => r.label === 'EPA/DHA')).toEqual({
      label: 'EPA/DHA',
      value: 2685,
      unit: 'mg',
    });
  });

  it('omits EPA/DHA entirely when the food does not declare it', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150, foodId: rice.id }), rice);
    expect(rows.find((r) => r.label === 'EPA/DHA')).toBeUndefined();
  });

  it('skips zero-valued micro rows (fiber/sugar) to keep the sheet compact', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), salmon);
    expect(rows.find((r) => r.label === 'Chất xơ')).toBeUndefined();
    expect(rows.find((r) => r.label === 'Đường')).toBeUndefined();
  });

  it('includes non-zero fiber/sugar rows for foods that declare them', () => {
    const rows = buildNutritionDetail(makeEntry({ grams: 150, foodId: rice.id }), rice);
    expect(rows.find((r) => r.label === 'Chất xơ')).toEqual({
      label: 'Chất xơ',
      value: 0.6, // 0.4 * 1.5
      unit: 'g',
    });
    expect(rows.find((r) => r.label === 'Đường')).toEqual({
      label: 'Đường',
      value: 0.2, // 0.1 * 1.5 = 0.15 → rounds to 0.2
      unit: 'g',
    });
  });

  it('is zero for a zero-gram portion and never negative', () => {
    const zeroEntry = makeEntry({
      grams: 0,
      energyKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
      waterG: 0,
      mineralsMg: 0,
    });
    const rows = buildNutritionDetail(zeroEntry, salmon);
    expect(rows.find((r) => r.label === 'Năng lượng')).toEqual({
      label: 'Năng lượng',
      value: 0,
      unit: 'kcal',
    });
  });

  it('headline rows come from the entry snapshot, NOT the item current per100g (QA B1)', () => {
    // Simulates the user editing the food's per100g via an override AFTER
    // logging: what was eaten (and charged to the batteries) must not be
    // rewritten by later catalog edits — same rule the rest of the app
    // follows via the FoodLogEntry snapshot.
    const editedSalmon: FoodItem = {
      ...salmon,
      per100g: { ...salmon.per100g, energyKcal: 300, proteinG: 40 },
    };
    const rows = buildNutritionDetail(makeEntry({ grams: 150 }), editedSalmon);
    expect(rows.find((r) => r.label === 'Năng lượng')).toEqual({
      label: 'Năng lượng',
      value: 312, // the snapshot, not 300 * 1.5 = 450
      unit: 'kcal',
    });
    expect(rows.find((r) => r.label === 'Đạm')).toEqual({
      label: 'Đạm',
      value: 30, // the snapshot, not 40 * 1.5 = 60
      unit: 'g',
    });
  });
});

describe('buildNutritionDetail — item is null (food deleted from catalog)', () => {
  it('falls back to the entry snapshot fields, rolling minerals into one row', () => {
    const entry = makeEntry({
      grams: 150,
      energyKcal: 312,
      proteinG: 30,
      fatG: 19.5,
      carbG: 0,
      waterG: 94.5,
      mineralsMg: 150.5,
    });
    const rows = buildNutritionDetail(entry, null);
    expect(rows).toEqual([
      { label: 'Năng lượng', value: 312, unit: 'kcal' },
      { label: 'Đạm', value: 30, unit: 'g' },
      { label: 'Béo', value: 19.5, unit: 'g' },
      { label: 'Carbs', value: 0, unit: 'g' },
      { label: 'Nước', value: 94.5, unit: 'g' },
      { label: 'Khoáng chất (tổng)', value: 150.5, unit: 'mg' },
    ]);
  });
});

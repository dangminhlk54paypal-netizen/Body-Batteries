import { suggestFoods } from '../foodSuggestions';
import type { FoodLogEntry } from '../../../types/food';

function entry(overrides: Partial<FoodLogEntry> & Pick<FoodLogEntry, 'foodId' | 'timestamp' | 'mealType'>): FoodLogEntry {
  return {
    id: `log_${overrides.foodId}_${overrides.timestamp}`,
    foodNameVi: overrides.foodId,
    grams: 150,
    energyKcal: 200,
    proteinG: 5,
    fatG: 3,
    carbG: 30,
    waterG: 100,
    mineralsMg: 20,
    energyDayApplied: '2026-07-01',
    ...overrides,
  } as FoodLogEntry;
}

// Hour 8 → breakfast, hour 12 → lunch, hour 19 → dinner, hour 23 → snack
// (see DEFAULT_MEAL_WINDOWS in lib/constants.ts).

describe('suggestFoods', () => {
  it('returns nothing for an empty log', () => {
    expect(suggestFoods([], 8)).toEqual([]);
  });

  it('prefers entries from the same meal window as the given hour', () => {
    const log = [
      entry({ foodId: 'rice', mealType: 'lunch', timestamp: 1 }),
      entry({ foodId: 'pho', mealType: 'breakfast', timestamp: 2 }),
      entry({ foodId: 'banh_mi', mealType: 'breakfast', timestamp: 3 }),
    ];
    const result = suggestFoods(log, 8); // breakfast hour
    expect(result.map((s) => s.foodId)).toEqual(['banh_mi', 'pho']);
  });

  it('falls back to the full recent log when nothing matches the meal window', () => {
    const log = [
      entry({ foodId: 'rice', mealType: 'lunch', timestamp: 1 }),
      entry({ foodId: 'pho', mealType: 'lunch', timestamp: 2 }),
    ];
    const result = suggestFoods(log, 19); // dinner hour — no dinner entries logged
    expect(result.map((s) => s.foodId)).toEqual(['pho', 'rice']);
  });

  it('dedupes by food, keeping only the most recently logged portion', () => {
    const log = [
      entry({ foodId: 'rice', mealType: 'lunch', timestamp: 1, grams: 100 }),
      entry({ foodId: 'rice', mealType: 'lunch', timestamp: 5, grams: 250 }),
    ];
    const result = suggestFoods(log, 12);
    expect(result).toHaveLength(1);
    expect(result[0].grams).toBe(250);
  });

  it('orders suggestions most-recent-first', () => {
    const log = [
      entry({ foodId: 'a', mealType: 'lunch', timestamp: 10 }),
      entry({ foodId: 'b', mealType: 'lunch', timestamp: 30 }),
      entry({ foodId: 'c', mealType: 'lunch', timestamp: 20 }),
    ];
    const result = suggestFoods(log, 12);
    expect(result.map((s) => s.foodId)).toEqual(['b', 'c', 'a']);
  });

  it('caps the result at maxCount', () => {
    const log = Array.from({ length: 10 }, (_, i) =>
      entry({ foodId: `food_${i}`, mealType: 'lunch', timestamp: i })
    );
    expect(suggestFoods(log, 12)).toHaveLength(6);
    expect(suggestFoods(log, 12, 3)).toHaveLength(3);
  });

  it('carries portionUnit and count through for serving-based foods (TPCN)', () => {
    const log = [
      entry({
        foodId: 'fish_oil',
        mealType: 'snack',
        timestamp: 1,
        portionUnit: 'capsule',
        count: 2,
        grams: 2,
      }),
    ];
    const result = suggestFoods(log, 23);
    expect(result[0]).toMatchObject({ portionUnit: 'capsule', count: 2, grams: 2 });
  });
});

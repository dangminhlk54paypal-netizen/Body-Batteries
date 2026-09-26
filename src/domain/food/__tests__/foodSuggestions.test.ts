import { previousDayMeal, repeatableMeal, suggestFoods } from '../foodSuggestions';
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

describe('previousDayMeal', () => {
  const at = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();

  it("returns yesterday's entries of that meal, in eating order, with portions and total kcal", () => {
    const log = [
      entry({ foodId: 'rice', timestamp: at('2026-09-25', 12, 30), mealType: 'lunch', grams: 200, energyKcal: 260 }),
      entry({ foodId: 'pho', timestamp: at('2026-09-25', 12, 0), mealType: 'lunch', energyKcal: 400 }),
      entry({ foodId: 'caps', timestamp: at('2026-09-25', 12, 40), mealType: 'lunch', portionUnit: 'capsule', count: 2, energyKcal: 5.4 }),
      entry({ foodId: 'egg', timestamp: at('2026-09-25', 8, 0), mealType: 'breakfast' }),
      entry({ foodId: 'bun', timestamp: at('2026-09-24', 12, 0), mealType: 'lunch' }),
      entry({ foodId: 'today', timestamp: at('2026-09-26', 12, 0), mealType: 'lunch' }),
    ];
    const r = previousDayMeal(log, '2026-09-26', 'lunch');
    expect(r.items.map((i) => i.foodId)).toEqual(['pho', 'rice', 'caps']);
    expect(r.items[1].grams).toBe(200);
    expect(r.items[2]).toMatchObject({ portionUnit: 'capsule', count: 2 });
    expect(r.kcal).toBe(665);
  });

  it('keeps repeated foods so the meal is repeated exactly', () => {
    const log = [
      entry({ foodId: 'egg', timestamp: at('2026-09-25', 8, 0), mealType: 'breakfast' }),
      entry({ foodId: 'egg', timestamp: at('2026-09-25', 8, 5), mealType: 'breakfast' }),
    ];
    expect(previousDayMeal(log, '2026-09-26', 'breakfast').items).toHaveLength(2);
  });

  it('works relative to a backfill day and is empty when nothing matches', () => {
    const log = [entry({ foodId: 'pho', timestamp: at('2026-09-23', 19, 0), mealType: 'dinner' })];
    expect(previousDayMeal(log, '2026-09-24', 'dinner').items).toHaveLength(1);
    expect(previousDayMeal(log, '2026-09-26', 'dinner')).toEqual({ items: [], kcal: 0 });
  });
});

describe('repeatableMeal', () => {
  const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  const yesterdayLunch = entry({ foodId: 'pho', timestamp: at('2026-09-25', 12), mealType: 'lunch' });

  it("offers yesterday's meal with the original eating time", () => {
    const r = repeatableMeal([yesterdayLunch], '2026-09-26', 'lunch');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].eatenAt).toBe(yesterdayLunch.timestamp);
  });

  it('offers nothing once that meal is already logged on the day', () => {
    const todayLunch = entry({ foodId: 'rice', timestamp: at('2026-09-26', 12), mealType: 'lunch' });
    expect(repeatableMeal([yesterdayLunch, todayLunch], '2026-09-26', 'lunch').items).toEqual([]);
  });
});

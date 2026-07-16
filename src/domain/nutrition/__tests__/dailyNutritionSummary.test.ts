import { summarizeWeeklyNutrition } from '../dailyNutritionSummary';
import type { FoodItem, FoodLogEntry, Nutrition } from '../../../types/food';
import type { NutrientTarget } from '../../../types/nutrition';

function nutrition(overrides: Partial<Nutrition> = {}): Nutrition {
  return {
    energyKcal: 0,
    waterG: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    calciumMg: 0,
    ironMg: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 0,
    zincMg: 0,
    ...overrides,
  };
}

function food(id: string, per100g: Nutrition): FoodItem {
  return {
    id,
    nameVi: id,
    nameEn: id,
    category: 'test',
    defaultServingG: 100,
    servingPresets: [],
    per100g,
    source: 'test',
    note: '',
  };
}

const FOODS: Record<string, FoodItem> = {
  spinach: food('spinach', nutrition({ fiberG: 10, ironMg: 3 })),
  instant_noodles: food('instant_noodles', nutrition({ sodiumMg: 1800 })),
};

function lookup(id: string): FoodItem | undefined {
  return FOODS[id];
}

function entry(overrides: Partial<FoodLogEntry>): FoodLogEntry {
  return {
    id: 'e1',
    timestamp: new Date('2026-07-01T08:00:00').getTime(),
    mealType: 'breakfast',
    foodId: 'spinach',
    foodNameVi: 'Rau bina',
    grams: 100,
    energyKcal: 23,
    proteinG: 2.9,
    fatG: 0.4,
    carbG: 3.6,
    waterG: 91,
    mineralsMg: 500,
    ...overrides,
  };
}

const FIBER_GOAL: NutrientTarget = {
  id: 'fiber',
  kind: 'goal',
  nameVi: 'Chất xơ',
  unit: 'g',
  color: '#000',
  value: 25,
};

const SODIUM_LIMIT: NutrientTarget = {
  id: 'sodium',
  kind: 'limit',
  nameVi: 'Natri (muối)',
  unit: 'mg',
  color: '#000',
  value: 2300,
};

describe('summarizeWeeklyNutrition', () => {
  it('does not crash on an empty log and returns zeroed weekly averages', () => {
    const result = summarizeWeeklyNutrition([], [FIBER_GOAL, SODIUM_LIMIT], lookup, 'vi');
    expect(result.days).toEqual([]);
    expect(result.weekly).toHaveLength(2);
    expect(result.weekly[0].avgPerDay).toBe(0);
    expect(result.weekly[1].avgPerDay).toBe(0);
    // Empty log → 0% of a goal target → gentle "under" advice, not a crash/blank.
    expect(result.weekly[0].assessment).not.toBe('');
    expect(result.overallAssessment).not.toBe('');
  });

  it('groups entries by local calendar day and totals macros per day', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'a', timestamp: new Date('2026-07-01T08:00:00').getTime(), grams: 100, energyKcal: 23, proteinG: 2.9, fatG: 0.4, carbG: 3.6 }),
      entry({ id: 'b', timestamp: new Date('2026-07-01T19:00:00').getTime(), grams: 100, energyKcal: 23, proteinG: 2.9, fatG: 0.4, carbG: 3.6 }),
      entry({ id: 'c', timestamp: new Date('2026-07-02T08:00:00').getTime(), grams: 200, energyKcal: 46, proteinG: 5.8, fatG: 0.8, carbG: 7.2 }),
    ];
    const result = summarizeWeeklyNutrition(entries, [FIBER_GOAL], lookup, 'vi');
    expect(result.days).toHaveLength(2);
    expect(result.days[0].date).toBe('2026-07-01');
    expect(result.days[0].kcal).toBe(46);
    expect(result.days[0].proteinG).toBeCloseTo(5.8, 5);
    expect(result.days[1].date).toBe('2026-07-02');
    expect(result.days[1].kcal).toBe(46);
  });

  it('computes each day\'s micronutrient totals and per-day assessment', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'a', foodId: 'spinach', grams: 100 }), // 10g fiber vs 25g goal → 40%, under
    ];
    const result = summarizeWeeklyNutrition(entries, [FIBER_GOAL], lookup, 'vi');
    const fiberState = result.days[0].micros.find((m) => m.id === 'fiber')!;
    expect(fiberState.current).toBe(10);
    expect(result.days[0].assessment).not.toBe('Ổn 👍');
  });

  it('divides the weekly average by numDays (7 by default), not by days actually logged', () => {
    // Only one day logged, but the weekly average should still be totals/7.
    const entries: FoodLogEntry[] = [entry({ foodId: 'spinach', grams: 250 })]; // 25g fiber
    const result = summarizeWeeklyNutrition(entries, [FIBER_GOAL], lookup, 'vi');
    const fiberRollup = result.weekly.find((w) => w.id === 'fiber')!;
    // avgPerDay is rounded to 1 decimal (25 / 7 ≈ 3.571 → 3.6), but the key
    // behavior under test is the /7 denominator, not the exact fraction.
    expect(fiberRollup.avgPerDay).toBeCloseTo(3.6, 5);
    expect(fiberRollup.avgPerDay).toBeLessThan(25); // clearly not totals/1
  });

  it('respects a custom numDays denominator', () => {
    const entries: FoodLogEntry[] = [entry({ foodId: 'spinach', grams: 250 })]; // 25g fiber
    const result = summarizeWeeklyNutrition(entries, [FIBER_GOAL], lookup, 'vi', 2);
    const fiberRollup = result.weekly.find((w) => w.id === 'fiber')!;
    expect(fiberRollup.avgPerDay).toBe(12.5);
  });

  it('flags a weekly sodium average over the cap with the gentle limit advice', () => {
    const entries: FoodLogEntry[] = [
      entry({ foodId: 'instant_noodles', grams: 1000 }), // 18000mg sodium in one day
    ];
    const result = summarizeWeeklyNutrition(entries, [SODIUM_LIMIT], lookup, 'vi');
    const sodiumRollup = result.weekly.find((w) => w.id === 'sodium')!;
    // 18000 / 7 ≈ 2571mg, over the 2300mg cap
    expect(sodiumRollup.avgPerDay).toBeGreaterThan(SODIUM_LIMIT.value);
    expect(sodiumRollup.assessment).not.toBe('Ổn 👍');
  });

  it('safely skips an unknown/deleted foodId without breaking daily totals', () => {
    const entries: FoodLogEntry[] = [
      entry({ foodId: 'spinach', grams: 100 }),
      entry({ foodId: 'does_not_exist', grams: 500 }),
    ];
    const result = summarizeWeeklyNutrition(entries, [FIBER_GOAL], lookup, 'vi');
    expect(result.days[0].micros.find((m) => m.id === 'fiber')!.current).toBe(10);
  });
});

import { computeMicroBatteries, type LoggedPortion } from '../microBatteryEngine';
import type { FoodItem, Nutrition } from '../../../types/food';
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
  spinach: food('spinach', nutrition({ fiberG: 2, ironMg: 3 })),
  bread: food('bread', nutrition({ fiberG: 3, sodiumMg: 400 })),
};

function lookup(foodId: string): FoodItem | undefined {
  return FOODS[foodId];
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

describe('computeMicroBatteries', () => {
  it('sums per-100g nutrients across multiple logged foods', () => {
    const entries: LoggedPortion[] = [
      { foodId: 'spinach', grams: 200 }, // 4g fiber
      { foodId: 'bread', grams: 100 }, // 3g fiber
    ];
    const [fiber] = computeMicroBatteries(entries, lookup, [FIBER_GOAL]);
    expect(fiber.current).toBe(7);
    expect(fiber.percentage).toBe(Math.round((100 * 7) / 25));
    expect(fiber.over).toBe(false);
  });

  it('clamps a goal-type battery at 100% without setting over', () => {
    const entries: LoggedPortion[] = [{ foodId: 'spinach', grams: 5000 }]; // 100g fiber, way over target
    const [fiber] = computeMicroBatteries(entries, lookup, [FIBER_GOAL]);
    expect(fiber.percentage).toBe(100);
    expect(fiber.over).toBe(false);
  });

  it('flags a limit-type battery as over when it exceeds the cap', () => {
    const entries: LoggedPortion[] = [{ foodId: 'bread', grams: 1000 }]; // 4000mg sodium
    const [sodium] = computeMicroBatteries(entries, lookup, [SODIUM_LIMIT]);
    expect(sodium.current).toBe(4000);
    expect(sodium.percentage).toBe(100);
    expect(sodium.over).toBe(true);
  });

  it('keeps a limit-type battery under 100% and not over when within the cap', () => {
    const entries: LoggedPortion[] = [{ foodId: 'bread', grams: 100 }]; // 400mg sodium
    const [sodium] = computeMicroBatteries(entries, lookup, [SODIUM_LIMIT]);
    expect(sodium.over).toBe(false);
    expect(sodium.percentage).toBe(Math.round((100 * 400) / 2300));
  });

  it('returns 0 for every battery when the log is empty', () => {
    const [fiber, sodium] = computeMicroBatteries([], lookup, [FIBER_GOAL, SODIUM_LIMIT]);
    expect(fiber.current).toBe(0);
    expect(fiber.percentage).toBe(0);
    expect(sodium.current).toBe(0);
    expect(sodium.over).toBe(false);
  });

  it('safely skips an unknown/deleted foodId without breaking the total', () => {
    const entries: LoggedPortion[] = [
      { foodId: 'spinach', grams: 100 }, // 2g fiber
      { foodId: 'does_not_exist', grams: 500 },
    ];
    const [fiber] = computeMicroBatteries(entries, lookup, [FIBER_GOAL]);
    expect(fiber.current).toBe(2);
  });
});

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

  it('lets a goal-type battery exceed 100% and flags it as over', () => {
    const entries: LoggedPortion[] = [{ foodId: 'spinach', grams: 2000 }]; // 40g fiber vs 25g goal
    const [fiber] = computeMicroBatteries(entries, lookup, [FIBER_GOAL]);
    expect(fiber.percentage).toBe(160);
    expect(fiber.over).toBe(true);
  });

  it('caps the displayed percentage at 999 for extreme entries', () => {
    const entries: LoggedPortion[] = [{ foodId: 'spinach', grams: 50000 }]; // 1000g fiber
    const [fiber] = computeMicroBatteries(entries, lookup, [FIBER_GOAL]);
    expect(fiber.percentage).toBe(999);
    expect(fiber.over).toBe(true);
  });

  it('flags a limit-type battery as over with its real ratio when it exceeds the cap', () => {
    const entries: LoggedPortion[] = [{ foodId: 'bread', grams: 1000 }]; // 4000mg sodium
    const [sodium] = computeMicroBatteries(entries, lookup, [SODIUM_LIMIT]);
    expect(sodium.current).toBe(4000);
    expect(sodium.percentage).toBe(Math.round((100 * 4000) / 2300));
    expect(sodium.over).toBe(true);
  });

  it('sums omega-3 as EPA+DHA and treats foods without the columns as 0', () => {
    const fishOil = food('fish_oil', nutrition({ epaMg: 49180, dhaMg: 32787 }));
    const omegaLookup = (id: string) => (id === 'fish_oil' ? fishOil : FOODS[id]);
    const OMEGA_GOAL: NutrientTarget = {
      id: 'omega3',
      kind: 'goal',
      nameVi: 'Omega-3 (EPA+DHA)',
      unit: 'mg',
      color: '#000',
      value: 500,
    };
    const entries: LoggedPortion[] = [
      { foodId: 'fish_oil', grams: 1.22 }, // 1 capsule ≈ 600 EPA + 400 DHA
      { foodId: 'spinach', grams: 100 }, // no epa/dha columns → contributes 0
    ];
    const [omega] = computeMicroBatteries(entries, omegaLookup, [OMEGA_GOAL]);
    expect(omega.current).toBeCloseTo(1000, 0);
    expect(omega.percentage).toBe(200);
    expect(omega.over).toBe(true);
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

  it('derives salt from sodium (salt g = sodium mg × 2.5 / 1000), never a stored field', () => {
    // bread declares 400mg sodium/100g → 100g bread has 400mg sodium.
    const entries: LoggedPortion[] = [{ foodId: 'bread', grams: 100 }];
    const SALT_LIMIT: NutrientTarget = {
      id: 'salt',
      kind: 'limit',
      nameVi: 'Muối (NaCl)',
      unit: 'g',
      color: '#000',
      value: 5,
    };
    const [salt] = computeMicroBatteries(entries, lookup, [SALT_LIMIT]);
    expect(salt.current).toBeCloseTo((400 * 2.5) / 1000, 3); // 1 g salt
    expect(salt.over).toBe(false);
  });

  it('salt pin appears automatically whenever sodium is logged, with no separate data entry', () => {
    // 1000g bread → 4000mg sodium → 10g salt, over the 5g reference cap.
    const entries: LoggedPortion[] = [{ foodId: 'bread', grams: 1000 }];
    const SALT_LIMIT: NutrientTarget = {
      id: 'salt',
      kind: 'limit',
      nameVi: 'Muối (NaCl)',
      unit: 'g',
      color: '#000',
      value: 5,
    };
    const [salt] = computeMicroBatteries(entries, lookup, [SALT_LIMIT]);
    expect(salt.current).toBe(10);
    expect(salt.over).toBe(true);
  });
});

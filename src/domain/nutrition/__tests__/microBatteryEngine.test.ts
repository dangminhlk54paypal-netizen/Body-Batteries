import {
  computeMicroBatteries,
  microBatterySourceBreakdown,
  type LoggedPortion,
} from '../microBatteryEngine';
import { gramsForPortion } from '../../food/foodNutrition';
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

  it('logging 2 capsules (pack/capsule TPCN portion) via gramsForPortion doubles the omega-3 battery vs 1 capsule', () => {
    // A capsule declaring 610mg combined omega-3 per capsule (610mg / 1.22g
    // serving weight), stored per-100g as the buildCustomFoodItem conversion
    // would produce: per100gValue = perServing / servingWeightG * 100.
    const servingWeightG = 1.22;
    const perCapsuleOmega3Mg = 610;
    const omegaCapsule: FoodItem = {
      ...food(
        'omega3_capsule',
        nutrition({
          epaMg: ((perCapsuleOmega3Mg / 2) / servingWeightG) * 100,
          dhaMg: ((perCapsuleOmega3Mg / 2) / servingWeightG) * 100,
        })
      ),
      portionUnit: 'capsule',
      servingWeightG,
    };
    const omegaLookup = (id: string) => (id === 'omega3_capsule' ? omegaCapsule : FOODS[id]);
    const OMEGA_GOAL: NutrientTarget = {
      id: 'omega3',
      kind: 'goal',
      nameVi: 'Omega-3 (EPA+DHA)',
      unit: 'mg',
      color: '#000',
      value: 500,
    };

    const oneCapsuleGrams = gramsForPortion(omegaCapsule, 1);
    const twoCapsuleGrams = gramsForPortion(omegaCapsule, 2);
    expect(twoCapsuleGrams).toBeCloseTo(oneCapsuleGrams * 2, 6);

    const [oneCapsule] = computeMicroBatteries(
      [{ foodId: 'omega3_capsule', grams: oneCapsuleGrams }],
      omegaLookup,
      [OMEGA_GOAL]
    );
    const [twoCapsules] = computeMicroBatteries(
      [{ foodId: 'omega3_capsule', grams: twoCapsuleGrams }],
      omegaLookup,
      [OMEGA_GOAL]
    );

    expect(oneCapsule.current).toBeCloseTo(perCapsuleOmega3Mg, 1);
    expect(twoCapsules.current).toBeCloseTo(perCapsuleOmega3Mg * 2, 1);
    expect(twoCapsules.current).toBeCloseTo(oneCapsule.current * 2, 1);
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

describe('microBatterySourceBreakdown', () => {
  const foodLog = [
    { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 200 }, // 4g fiber
    { foodId: 'bread', foodNameVi: 'Bánh mì', grams: 100 }, // 3g fiber, 400mg sodium
  ];

  it('returns one row per food that contributed a nonzero amount of the nutrient', () => {
    const { rows, total } = microBatterySourceBreakdown(foodLog, 'fiber', lookup);
    expect(rows).toEqual([
      {
        id: 'spinach',
        foodId: 'spinach',
        foodNameVi: 'Rau bina',
        amount: 4,
        grams: 200,
        entryCount: 1,
        portionUnit: undefined,
        count: undefined,
        per100g: 2,
      },
      {
        id: 'bread',
        foodId: 'bread',
        foodNameVi: 'Bánh mì',
        amount: 3,
        grams: 100,
        entryCount: 1,
        portionUnit: undefined,
        count: undefined,
        per100g: 3,
      },
    ]);
    expect(total).toBe(7);
  });

  it('omits foods that contributed 0 of the nutrient', () => {
    const { rows } = microBatterySourceBreakdown(foodLog, 'sodium', lookup);
    expect(rows.map((r) => [r.foodId, r.amount])).toEqual([['bread', 400]]);
  });

  it('safely skips an unknown/deleted foodId without breaking the other rows', () => {
    const withMissing = [...foodLog, { foodId: 'does_not_exist', foodNameVi: 'Ghost', grams: 500 }];
    const { rows } = microBatterySourceBreakdown(withMissing, 'fiber', lookup);
    expect(rows).toHaveLength(2);
  });

  it('returns an empty list when the log is empty', () => {
    expect(microBatterySourceBreakdown([], 'fiber', lookup)).toEqual({ rows: [], total: 0 });
  });

  // The reported bug: the same food logged several times used to render as
  // several identical rows, which reads as several different foods.
  it('groups repeat logs of the same food into ONE row carrying the totals', () => {
    const repeated = [
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 100 },
      { foodId: 'bread', foodNameVi: 'Bánh mì', grams: 100 },
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 50 },
    ];
    const { rows } = microBatterySourceBreakdown(repeated, 'fiber', lookup);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ foodId: 'spinach', grams: 150, entryCount: 2, amount: 3 });
    expect(rows[1]).toMatchObject({ foodId: 'bread', grams: 100, entryCount: 1, amount: 3 });
  });

  // The formula lines in the breakdown sheet multiply this figure by the
  // grams — it has to be the food's real per-100 value, not a derived one.
  it("carries each food's own per-100 figure for the nutrient", () => {
    const { rows } = microBatterySourceBreakdown(foodLog, 'fiber', lookup);
    expect(rows.map((r) => [r.foodId, r.per100g])).toEqual([
      ['spinach', 2],
      ['bread', 3],
    ]);
  });

  it('sums the counts of repeat logs that share one portion unit', () => {
    const repeated = [
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 100, portionUnit: 'pack' as const, count: 2 },
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 50, portionUnit: 'pack' as const, count: 1 },
    ];
    const { rows } = microBatterySourceBreakdown(repeated, 'fiber', lookup);
    expect(rows[0]).toMatchObject({ portionUnit: 'pack', count: 3, entryCount: 2 });
  });

  it('drops the count label when grouped logs disagree on the portion unit', () => {
    const mixed = [
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 100, portionUnit: 'pack' as const, count: 2 },
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 50 },
    ];
    const { rows } = microBatterySourceBreakdown(mixed, 'fiber', lookup);
    expect(rows[0].portionUnit).toBeUndefined();
    expect(rows[0].count).toBeUndefined();
  });

  // The other half of the reported bug: the rows have to add up to the footer.
  it('makes the displayed row amounts sum EXACTLY to the displayed total', () => {
    // 87.5g spinach = 1.75g fiber each; naive per-row rounding gives
    // 1.8 + 1.8 = 3.6 against a real total of 3.5.
    const halves = [
      { foodId: 'spinach', foodNameVi: 'Rau bina', grams: 87.5 },
      { foodId: 'bread', foodNameVi: 'Bánh mì', grams: 58.33 },
    ];
    const { rows, total } = microBatterySourceBreakdown(halves, 'fiber', lookup);
    const summed = rows.reduce((sum, r) => sum + r.amount, 0);
    expect(Math.round(summed * 10) / 10).toBe(total);
  });

  it('reports a total identical to the matching computeMicroBatteries figure', () => {
    const target: NutrientTarget[] = [
      { id: 'fiber', kind: 'goal', nameVi: 'Chất xơ', unit: 'g', color: '#000', value: 25 },
    ];
    const portions: LoggedPortion[] = [
      { foodId: 'spinach', grams: 87.5 },
      { foodId: 'bread', grams: 58.33 },
    ];
    const [state] = computeMicroBatteries(portions, lookup, target);
    const { total } = microBatterySourceBreakdown(
      portions.map((p) => ({ ...p, foodNameVi: p.foodId })),
      'fiber',
      lookup
    );
    expect(total).toBe(state.current);
  });
});

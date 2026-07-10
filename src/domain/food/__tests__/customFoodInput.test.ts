import {
  buildCustomFoodItem,
  inputFromFoodItem,
  isValidCustomFoodInput,
  resetNutritionForUnitChange,
  EMPTY_CUSTOM_FOOD_INPUT,
  type CustomFoodInput,
} from '../customFoodInput';
import type { FoodItem } from '../../../types/food';

const filled: CustomFoodInput = {
  ...EMPTY_CUSTOM_FOOD_INPUT,
  name: '  Bánh mì chảo  ',
  category: 'dish',
  defaultServingG: '250',
  energyKcal: '280',
  proteinG: '12.5',
  fatG: '9',
  carbG: '35',
  waterG: '40',
  fiberG: '2',
  sugarG: '3',
  calciumMg: '50',
  ironMg: '2',
  sodiumMg: '600',
  potassiumMg: '150',
  magnesiumMg: '20',
  zincMg: '1.5',
  epaMg: '5',
  dhaMg: '10',
};

describe('buildCustomFoodItem', () => {
  it('maps every field correctly, trims the name, and prefixes the id', () => {
    const item = buildCustomFoodItem(filled);
    expect(item.id).toMatch(/^custom_\d+_[a-z0-9]+$/);
    expect(item.nameVi).toBe('Bánh mì chảo');
    expect(item.nameEn).toBe('');
    expect(item.category).toBe('dish');
    expect(item.defaultServingG).toBe(250);
    expect(item.servingPresets).toEqual([]);
    expect(item.source).toBe('custom');
    expect(item.note).toBe('');
    expect(item.per100g).toEqual({
      energyKcal: 280,
      waterG: 40,
      proteinG: 12.5,
      fatG: 9,
      carbG: 35,
      fiberG: 2,
      sugarG: 3,
      calciumMg: 50,
      ironMg: 2,
      sodiumMg: 600,
      potassiumMg: 150,
      magnesiumMg: 20,
      zincMg: 1.5,
      epaMg: 5,
      dhaMg: 10,
    });
  });

  it('maps blank/NaN numeric fields to 0', () => {
    const item = buildCustomFoodItem({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Món trống', energyKcal: '100' });
    expect(item.per100g.proteinG).toBe(0);
    expect(item.per100g.fatG).toBe(0);
    expect(item.per100g.carbG).toBe(0);
    expect(item.per100g.waterG).toBe(0);
    expect(item.per100g.fiberG).toBe(0);
    expect(item.per100g.calciumMg).toBe(0);
    expect(item.per100g.epaMg).toBe(0);
    expect(item.per100g.dhaMg).toBe(0);
  });

  it('falls back to 100g default serving and "custom" category when blank', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'X',
      category: '  ',
      defaultServingG: '',
      energyKcal: '10',
    });
    expect(item.defaultServingG).toBe(100);
    expect(item.category).toBe('custom');
  });

  it('clamps negative nutrition fields to 0', () => {
    const item = buildCustomFoodItem({
      ...filled,
      proteinG: '-12.5',
      fatG: '-9',
      carbG: '-35',
      waterG: '-40',
      fiberG: '-2',
      sugarG: '-3',
      calciumMg: '-50',
      ironMg: '-2',
      sodiumMg: '-600',
      potassiumMg: '-150',
      magnesiumMg: '-20',
      zincMg: '-1.5',
      epaMg: '-5',
      dhaMg: '-10',
    });
    expect(item.per100g).toEqual({
      energyKcal: 280,
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
      epaMg: 0,
      dhaMg: 0,
    });
  });

  it('clamps a negative defaultServingG to a minimum of 1', () => {
    const item = buildCustomFoodItem({ ...filled, defaultServingG: '-30' });
    expect(item.defaultServingG).toBe(1);
  });

  it('falls back to the 100g default when defaultServingG is "0" (falsy, same as blank)', () => {
    const item = buildCustomFoodItem({ ...filled, defaultServingG: '0' });
    expect(item.defaultServingG).toBe(100);
  });

  it('never produces the same id twice, even when Date.now() collides', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const first = buildCustomFoodItem(filled);
      const second = buildCustomFoodItem(filled);
      expect(first.id).not.toBe(second.id);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe('inputFromFoodItem', () => {
  const item: FoodItem = {
    id: 'usda_123',
    nameVi: 'Cá hồi',
    nameEn: 'Salmon',
    category: 'fish',
    defaultServingG: 150,
    servingPresets: [],
    per100g: {
      energyKcal: 208,
      waterG: 64,
      proteinG: 20,
      fatG: 13,
      carbG: 0,
      fiberG: 0,
      sugarG: 0,
      calciumMg: 9,
      ironMg: 0.3,
      sodiumMg: 59,
      potassiumMg: 363,
      magnesiumMg: 27,
      zincMg: 0.4,
      epaMg: 690,
      dhaMg: 1457,
    },
    source: 'usda',
    note: '',
  };

  it('fills form strings from a FoodItem, including name/category/serving', () => {
    const input = inputFromFoodItem(item);
    expect(input.name).toBe('Cá hồi');
    expect(input.category).toBe('fish');
    expect(input.defaultServingG).toBe('150');
    expect(input.energyKcal).toBe('208');
    expect(input.ironMg).toBe('0.3');
    expect(input.epaMg).toBe('690');
    expect(input.dhaMg).toBe('1457');
  });

  it('defaults optional omega-3 fields to "0" when absent', () => {
    const noOmega: FoodItem = { ...item, per100g: { ...item.per100g, epaMg: undefined, dhaMg: undefined } };
    const input = inputFromFoodItem(noOmega);
    expect(input.epaMg).toBe('0');
    expect(input.dhaMg).toBe('0');
  });

  it('round-trips: buildCustomFoodItem(inputFromFoodItem(item)) preserves per100g', () => {
    const rebuilt = buildCustomFoodItem(inputFromFoodItem(item));
    expect(rebuilt.per100g).toEqual(item.per100g);
    expect(rebuilt.nameVi).toBe(item.nameVi);
    expect(rebuilt.category).toBe(item.category);
    expect(rebuilt.defaultServingG).toBe(item.defaultServingG);
  });
});

describe('buildCustomFoodItem — carb inference from sugar+fiber', () => {
  it('infers carbG = sugarG + fiberG when carbG is left blank', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Thanh protein',
      energyKcal: '200',
      carbG: '',
      sugarG: '15',
      fiberG: '5',
    });
    expect(item.per100g.carbG).toBe(20);
  });

  it('infers carbG = sugarG + fiberG when carbG is explicitly "0"', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Thanh protein',
      energyKcal: '200',
      carbG: '0',
      sugarG: '8',
      fiberG: '2',
    });
    expect(item.per100g.carbG).toBe(10);
  });

  it('does NOT override an explicitly entered carbG that already covers sugar+fiber', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Thanh protein',
      energyKcal: '200',
      carbG: '30',
      sugarG: '8',
      fiberG: '2',
    });
    expect(item.per100g.carbG).toBe(30);
  });

  // Unit convention: carbG is TOTAL carbohydrate and CONTAINS sugar+fiber —
  // an entry where carb < sugar+fiber is internally inconsistent and would
  // under-charge the Carbs battery, so it is lifted to the sum.
  it('lifts an entered carbG that is below sugarG + fiberG up to their sum', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Chicken nuggets',
      energyKcal: '296',
      carbG: '3',
      sugarG: '1',
      fiberG: '8',
    });
    expect(item.per100g.carbG).toBe(9);
  });

  it('leaves carbG at 0 when sugar and fiber are also both blank', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Nước lọc',
      energyKcal: '0',
    });
    expect(item.per100g.carbG).toBe(0);
  });
});

describe('buildCustomFoodItem — pack/capsule (TPCN) portion conversion', () => {
  // A fish-oil capsule: 1.22 g each, declaring 610 mg combined omega-3 and
  // 9 kcal PER CAPSULE (the numbers on a real supplement label).
  const capsuleInput: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    name: 'Omega-3 viên',
    category: 'supplement',
    portionUnit: 'capsule',
    servingWeightG: '1.22',
    energyKcal: '9',
    fatG: '1',
    epaMg: '300',
    dhaMg: '310',
  };

  it('converts per-serving values to per-100g storage using servingWeightG', () => {
    const item = buildCustomFoodItem(capsuleInput);
    expect(item.portionUnit).toBe('capsule');
    expect(item.servingWeightG).toBe(1.22);
    // per100gValue = perServingValue / servingWeightG * 100
    expect(item.per100g.energyKcal).toBeCloseTo((9 / 1.22) * 100, 5);
    expect(item.per100g.epaMg).toBeCloseTo((300 / 1.22) * 100, 5);
    expect(item.per100g.dhaMg).toBeCloseTo((310 / 1.22) * 100, 5);
  });

  it('falls back to gram behaviour (no conversion) when servingWeightG is blank/0', () => {
    const item = buildCustomFoodItem({ ...capsuleInput, servingWeightG: '' });
    expect(item.portionUnit).toBe('gram');
    expect(item.servingWeightG).toBeUndefined();
    expect(item.per100g.energyKcal).toBe(9);
    expect(item.per100g.epaMg).toBe(300);
  });

  it('round-trips: inputFromFoodItem(buildCustomFoodItem(input)) restores the per-serving numbers', () => {
    const item = buildCustomFoodItem(capsuleInput);
    const roundTripped = inputFromFoodItem(item);
    expect(roundTripped.portionUnit).toBe('capsule');
    expect(roundTripped.servingWeightG).toBe('1.22');
    expect(Number(roundTripped.energyKcal)).toBeCloseTo(9, 5);
    expect(Number(roundTripped.epaMg)).toBeCloseTo(300, 5);
    expect(Number(roundTripped.dhaMg)).toBeCloseTo(310, 5);
  });

  it('a gram-based food round-trips with portionUnit "gram" and no servingWeightG', () => {
    const item = buildCustomFoodItem({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Cơm', energyKcal: '130' });
    expect(item.portionUnit).toBe('gram');
    expect(item.servingWeightG).toBeUndefined();
    const input = inputFromFoodItem(item);
    expect(input.portionUnit).toBe('gram');
    expect(input.servingWeightG).toBe('');
  });
});

describe('resetNutritionForUnitChange', () => {
  // FIX #1 regression: switching Gram -> Viên/Gói must not let a number typed
  // under the old unit get reinterpreted under the new scale (per-100g vs
  // per-serving); the safe behaviour is to wipe the numeric fields instead.
  it('switching gram -> capsule clears every nutrition field and servingWeightG, but keeps name/category', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'gram' };
    const result = resetNutritionForUnitChange(input, 'capsule');
    expect(result.portionUnit).toBe('capsule');
    expect(result.name).toBe(filled.name);
    expect(result.category).toBe(filled.category);
    expect(result.servingWeightG).toBe('');
    expect(result.energyKcal).toBe('');
    expect(result.waterG).toBe('');
    expect(result.proteinG).toBe('');
    expect(result.fatG).toBe('');
    expect(result.carbG).toBe('');
    expect(result.fiberG).toBe('');
    expect(result.sugarG).toBe('');
    expect(result.calciumMg).toBe('');
    expect(result.ironMg).toBe('');
    expect(result.sodiumMg).toBe('');
    expect(result.potassiumMg).toBe('');
    expect(result.magnesiumMg).toBe('');
    expect(result.zincMg).toBe('');
    expect(result.epaMg).toBe('');
    expect(result.dhaMg).toBe('');
  });

  it('switching capsule -> gram clears every nutrition field and servingWeightG, but keeps name/category', () => {
    const input: CustomFoodInput = {
      ...filled,
      portionUnit: 'capsule',
      servingWeightG: '1.22',
    };
    const result = resetNutritionForUnitChange(input, 'gram');
    expect(result.portionUnit).toBe('gram');
    expect(result.name).toBe(filled.name);
    expect(result.category).toBe(filled.category);
    expect(result.servingWeightG).toBe('');
    expect(result.energyKcal).toBe('');
    expect(result.epaMg).toBe('');
    expect(result.dhaMg).toBe('');
  });

  it('resets nutrition fields even when the "new" unit equals the current one (simpler than adding a no-op branch)', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'gram' };
    const result = resetNutritionForUnitChange(input, 'gram');
    expect(result.portionUnit).toBe('gram');
    expect(result.name).toBe(filled.name);
    expect(result.category).toBe(filled.category);
    expect(result.energyKcal).toBe('');
    expect(result.sodiumMg).toBe('');
  });
});

describe('isValidCustomFoodInput', () => {
  it('requires a non-blank name', () => {
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: '', energyKcal: '100' })).toBe(false);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: '   ', energyKcal: '100' })).toBe(false);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: '100' })).toBe(true);
  });

  it('requires kcal to parse as a number ≥ 0', () => {
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: '' })).toBe(false);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: 'abc' })).toBe(false);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: '-5' })).toBe(false);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: '0' })).toBe(true);
    expect(isValidCustomFoodInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Phở', energyKcal: '350' })).toBe(true);
  });

  // FIX #4: pack/capsule foods MUST have a positive servingWeightG — it's the
  // divisor buildCustomFoodItem uses to convert per-serving values to
  // per-100g; a blank/0 value there is a data-corruption trap, not just a
  // display nicety.
  it('requires a positive servingWeightG when portionUnit is pack or capsule', () => {
    expect(
      isValidCustomFoodInput({
        ...EMPTY_CUSTOM_FOOD_INPUT,
        name: 'Vitamin C',
        energyKcal: '5',
        portionUnit: 'pack',
        servingWeightG: '',
      })
    ).toBe(false);
    expect(
      isValidCustomFoodInput({
        ...EMPTY_CUSTOM_FOOD_INPUT,
        name: 'Vitamin C',
        energyKcal: '5',
        portionUnit: 'capsule',
        servingWeightG: '0',
      })
    ).toBe(false);
    expect(
      isValidCustomFoodInput({
        ...EMPTY_CUSTOM_FOOD_INPUT,
        name: 'Vitamin C',
        energyKcal: '5',
        portionUnit: 'pack',
        servingWeightG: '1.5',
      })
    ).toBe(true);
  });

  it('does not require servingWeightG when portionUnit is gram', () => {
    expect(
      isValidCustomFoodInput({
        ...EMPTY_CUSTOM_FOOD_INPUT,
        name: 'Cơm trắng',
        energyKcal: '130',
        portionUnit: 'gram',
        servingWeightG: '',
      })
    ).toBe(true);
  });
});

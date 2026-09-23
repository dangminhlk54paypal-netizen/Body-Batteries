import {
  applyCustomFoodChange,
  buildCustomFoodItem,
  changeNutritionBasis,
  changePortionUnit,
  formBasisLabel,
  inputFromFoodItem,
  isValidCustomFoodInput,
  nutritionPreview,
  servingSizeOf,
  EMPTY_CUSTOM_FOOD_INPUT,
  NUTRITION_KEYS,
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
    nutritionBasis: 'perServing',
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

describe('changePortionUnit', () => {
  // The unit chip only decides how a portion is COUNTED now; the scale of the
  // typed nutrition numbers belongs to nutritionBasis, so switching the unit
  // must never wipe (or reinterpret) what the user already typed.
  it('keeps every nutrition number when switching gram -> capsule', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'gram' };
    const result = changePortionUnit(input, 'capsule');
    expect(result.portionUnit).toBe('capsule');
    expect(result.name).toBe(filled.name);
    expect(result.category).toBe(filled.category);
    for (const key of NUTRITION_KEYS) {
      expect(result[key]).toBe(filled[key]);
    }
    expect(result.nutritionBasis).toBe(filled.nutritionBasis);
  });

  it('keeps every nutrition number when switching capsule -> gram', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'capsule', servingWeightG: '1.22' };
    const result = changePortionUnit(input, 'gram');
    expect(result.portionUnit).toBe('gram');
    for (const key of NUTRITION_KEYS) {
      expect(result[key]).toBe(filled[key]);
    }
  });

  it('carries the gram serving size into servingWeightG when it was blank (gram -> counted)', () => {
    const input: CustomFoodInput = { ...filled, defaultServingG: '350', servingWeightG: '' };
    expect(changePortionUnit(input, 'serving').servingWeightG).toBe('350');
  });

  it('does not overwrite an existing servingWeightG (gram -> counted)', () => {
    const input: CustomFoodInput = { ...filled, defaultServingG: '350', servingWeightG: '180' };
    expect(changePortionUnit(input, 'serving').servingWeightG).toBe('180');
  });

  it('carries servingWeightG into defaultServingG (counted -> gram) when it is positive', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'serving', servingWeightG: '180' };
    expect(changePortionUnit(input, 'gram').defaultServingG).toBe('180');
  });

  it('leaves defaultServingG alone (counted -> gram) when servingWeightG is blank or 0', () => {
    const blank: CustomFoodInput = { ...filled, portionUnit: 'serving', servingWeightG: '' };
    expect(changePortionUnit(blank, 'gram').defaultServingG).toBe(filled.defaultServingG);
    const zero: CustomFoodInput = { ...filled, portionUnit: 'serving', servingWeightG: '0' };
    expect(changePortionUnit(zero, 'gram').defaultServingG).toBe(filled.defaultServingG);
  });

  it('keeps servingWeightG when switching between counted units (pack -> capsule)', () => {
    const input: CustomFoodInput = { ...filled, portionUnit: 'pack', servingWeightG: '5' };
    expect(changePortionUnit(input, 'capsule').servingWeightG).toBe('5');
  });

  // Supplement/packaged labels print numbers per capsule/carton, and the old
  // form always read a counted unit that way. Now that the scale is its own
  // chip, an UNTOUCHED form follows the unit so a habitual "9 kcal per
  // capsule" is not silently read as 9 kcal per 100 g (an ~80x error).
  describe('default basis follows weighed <-> counted while nothing is typed', () => {
    const blank: CustomFoodInput = { ...EMPTY_CUSTOM_FOOD_INPUT, name: 'Omega-3' };

    it('gram -> counted defaults an empty form to perServing', () => {
      for (const unit of ['pack', 'capsule', 'serving'] as const) {
        expect(changePortionUnit(blank, unit).nutritionBasis).toBe('perServing');
      }
    });

    it('counted -> gram defaults an empty form back to per100', () => {
      const counted: CustomFoodInput = { ...blank, portionUnit: 'capsule', nutritionBasis: 'perServing' };
      expect(changePortionUnit(counted, 'gram').nutritionBasis).toBe('per100');
    });

    it('never reinterprets numbers already typed: the basis stays put', () => {
      expect(changePortionUnit({ ...blank, energyKcal: '9' }, 'capsule').nutritionBasis).toBe('per100');
      const counted: CustomFoodInput = {
        ...blank,
        portionUnit: 'capsule',
        nutritionBasis: 'perServing',
        servingWeightG: '1.22',
        epaMg: '300',
      };
      expect(changePortionUnit(counted, 'gram').nutritionBasis).toBe('perServing');
    });

    it('a whitespace-only field counts as empty', () => {
      expect(changePortionUnit({ ...blank, energyKcal: '  ' }, 'capsule').nutritionBasis).toBe('perServing');
    });

    it('leaves the basis alone when the unit stays on the same side (weighed->weighed, counted->counted)', () => {
      expect(changePortionUnit(blank, 'gram').nutritionBasis).toBe('per100');
      const counted: CustomFoodInput = { ...blank, portionUnit: 'pack', nutritionBasis: 'per100' };
      expect(changePortionUnit(counted, 'capsule').nutritionBasis).toBe('per100');
    });
  });
});

describe('servingSizeOf', () => {
  it('reads defaultServingG for a weighed food', () => {
    expect(servingSizeOf({ ...EMPTY_CUSTOM_FOOD_INPUT, defaultServingG: '350' })).toBe(350);
  });

  it('reads servingWeightG for a counted food, ignoring defaultServingG', () => {
    expect(
      servingSizeOf({
        ...EMPTY_CUSTOM_FOOD_INPUT,
        portionUnit: 'serving',
        defaultServingG: '999',
        servingWeightG: '180',
      })
    ).toBe(180);
  });

  it('returns 0 for blank / zero / negative / garbage — never falls back to 100', () => {
    for (const bad of ['', '   ', '0', '-5', 'abc']) {
      expect(servingSizeOf({ ...EMPTY_CUSTOM_FOOD_INPUT, defaultServingG: bad })).toBe(0);
    }
    expect(
      servingSizeOf({ ...EMPTY_CUSTOM_FOOD_INPUT, portionUnit: 'pack', servingWeightG: '' })
    ).toBe(0);
  });

  it('accepts a comma decimal (VI/DE keyboards)', () => {
    expect(servingSizeOf({ ...EMPTY_CUSTOM_FOOD_INPUT, defaultServingG: '62,5' })).toBe(62.5);
  });
});

describe('changeNutritionBasis', () => {
  const per100: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    name: 'Phở bò',
    defaultServingG: '350',
    nutritionBasis: 'per100',
    energyKcal: '100',
    proteinG: '5',
    fatG: '',
    carbG: '12,5',
  };

  it('per100 -> perServing multiplies every filled field by size/100 and leaves blanks blank', () => {
    const r = changeNutritionBasis(per100, 'perServing');
    expect(r.nutritionBasis).toBe('perServing');
    expect(r.energyKcal).toBe('350');
    expect(r.proteinG).toBe('17.5');
    expect(r.fatG).toBe('');
    expect(r.waterG).toBe('');
    // "12,5" (comma keyboard) is parsed, not truncated to 12.
    expect(r.carbG).toBe('43.75');
  });

  it('perServing -> per100 divides by size/100 and strips floating-point noise', () => {
    const perServing: CustomFoodInput = {
      ...per100,
      nutritionBasis: 'perServing',
      energyKcal: '450',
      proteinG: '',
      carbG: '',
    };
    const r = changeNutritionBasis(perServing, 'per100');
    expect(r.nutritionBasis).toBe('per100');
    // 450 / 350 * 100 = 128.5714285… — shown to 6 significant digits.
    expect(r.energyKcal).toBe('128.571');
  });

  it('round-trips per100 -> perServing -> per100 back to the typed numbers', () => {
    const back = changeNutritionBasis(changeNutritionBasis(per100, 'perServing'), 'per100');
    expect(back.nutritionBasis).toBe('per100');
    expect(Number(back.energyKcal)).toBeCloseTo(100, 3);
    expect(Number(back.proteinG)).toBeCloseTo(5, 3);
    expect(back.fatG).toBe('');
    expect(Number(back.carbG)).toBeCloseTo(12.5, 3);
  });

  it('uses servingWeightG (not defaultServingG) for a counted food', () => {
    const counted: CustomFoodInput = {
      ...per100,
      portionUnit: 'serving',
      defaultServingG: '999',
      servingWeightG: '180',
      energyKcal: '70',
    };
    expect(changeNutritionBasis(counted, 'perServing').energyKcal).toBe('126');
  });

  it('wipes every nutrition field when there is no serving size to convert with (basis still changes)', () => {
    for (const blank of ['', '0']) {
      const r = changeNutritionBasis({ ...filled, defaultServingG: blank }, 'perServing');
      expect(r.nutritionBasis).toBe('perServing');
      for (const key of NUTRITION_KEYS) {
        expect(r[key]).toBe('');
      }
      // Non-nutrition fields survive.
      expect(r.name).toBe(filled.name);
    }
  });

  it('returns the very same object when the basis does not change', () => {
    expect(changeNutritionBasis(per100, 'per100')).toBe(per100);
  });

  it('leaves unparseable text untouched instead of turning it into "NaN"', () => {
    const r = changeNutritionBasis({ ...per100, proteinG: 'abc' }, 'perServing');
    expect(r.proteinG).toBe('abc');
  });
});

describe('applyCustomFoodChange', () => {
  it("routes 'portionUnit' through changePortionUnit", () => {
    const r = applyCustomFoodChange(
      { ...filled, defaultServingG: '350', servingWeightG: '' },
      'portionUnit',
      'serving'
    );
    expect(r.portionUnit).toBe('serving');
    expect(r.servingWeightG).toBe('350');
    expect(r.energyKcal).toBe(filled.energyKcal);
  });

  it("routes 'nutritionBasis' through changeNutritionBasis", () => {
    const r = applyCustomFoodChange(
      { ...EMPTY_CUSTOM_FOOD_INPUT, defaultServingG: '200', energyKcal: '50' },
      'nutritionBasis',
      'perServing'
    );
    expect(r.nutritionBasis).toBe('perServing');
    expect(r.energyKcal).toBe('100');
  });

  it('sets any other field verbatim', () => {
    const r = applyCustomFoodChange(filled, 'name', 'Món mới');
    expect(r.name).toBe('Món mới');
    expect(r.energyKcal).toBe(filled.energyKcal);
  });
});

describe('buildCustomFoodItem — nutritionBasis', () => {
  it('gram food typed per serving (350 g, 450 kcal) is stored as per-100g', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Phở bò',
      defaultServingG: '350',
      nutritionBasis: 'perServing',
      energyKcal: '450',
      proteinG: '20',
    });
    expect(item.portionUnit).toBe('gram');
    expect(item.servingWeightG).toBeUndefined();
    expect(item.defaultServingG).toBe(350);
    expect(item.per100g.energyKcal).toBeCloseTo((450 / 350) * 100, 6);
    expect(item.per100g.proteinG).toBeCloseTo((20 / 350) * 100, 6);
  });

  it('counted food typed per 100 g is stored as-is, with the counting metadata kept', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Sữa chua uống',
      portionUnit: 'serving',
      servingLabel: 'hộp',
      measureUnit: 'ml',
      servingWeightG: '180',
      nutritionBasis: 'per100',
      energyKcal: '70',
    });
    expect(item.per100g.energyKcal).toBe(70); // no conversion
    expect(item.portionUnit).toBe('serving');
    expect(item.servingWeightG).toBe(180);
    expect(item.servingLabel).toBe('hộp');
    expect(item.measureUnit).toBe('ml');
  });

  it('per100 on a gram food never rescales, whatever the serving size', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Cơm',
      defaultServingG: '250',
      nutritionBasis: 'per100',
      energyKcal: '130',
    });
    expect(item.per100g.energyKcal).toBe(130);
  });

  it('applies the carb >= sugar + fiber rule on the typed (per-serving) numbers, before scaling', () => {
    const item = buildCustomFoodItem({
      ...EMPTY_CUSTOM_FOOD_INPUT,
      name: 'Thanh ngũ cốc',
      defaultServingG: '50',
      nutritionBasis: 'perServing',
      energyKcal: '200',
      carbG: '3',
      sugarG: '10',
      fiberG: '5',
    });
    // carb lifted to 15 per serving, then x100/50 → 30 per 100 g.
    expect(item.per100g.carbG).toBeCloseTo(30, 6);
  });
});

describe('isValidCustomFoodInput — nutritionBasis', () => {
  const base: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    name: 'Phở bò',
    energyKcal: '450',
  };

  it('perServing on a gram food needs a real positive serving size', () => {
    expect(isValidCustomFoodInput({ ...base, nutritionBasis: 'perServing', defaultServingG: '' })).toBe(false);
    expect(isValidCustomFoodInput({ ...base, nutritionBasis: 'perServing', defaultServingG: '0' })).toBe(false);
    expect(isValidCustomFoodInput({ ...base, nutritionBasis: 'perServing', defaultServingG: '350' })).toBe(true);
  });

  it('per100 on a gram food still tolerates a blank serving size (falls back to 100 on save)', () => {
    expect(isValidCustomFoodInput({ ...base, nutritionBasis: 'per100', defaultServingG: '' })).toBe(true);
  });

  it('a counted food needs servingWeightG under either basis', () => {
    const counted: CustomFoodInput = { ...base, portionUnit: 'serving', servingWeightG: '' };
    expect(isValidCustomFoodInput({ ...counted, nutritionBasis: 'per100' })).toBe(false);
    expect(isValidCustomFoodInput({ ...counted, nutritionBasis: 'perServing' })).toBe(false);
    expect(isValidCustomFoodInput({ ...counted, servingWeightG: '180', nutritionBasis: 'per100' })).toBe(true);
    expect(isValidCustomFoodInput({ ...counted, servingWeightG: '180', nutritionBasis: 'perServing' })).toBe(true);
  });
});

describe('inputFromFoodItem — nutritionBasis + number formatting', () => {
  const gramItem: FoodItem = {
    id: 'custom_x',
    nameVi: 'Cơm',
    nameEn: '',
    category: 'grain',
    defaultServingG: 200,
    servingPresets: [],
    per100g: {
      energyKcal: 130,
      waterG: 68,
      proteinG: 2.7,
      fatG: 0.3,
      carbG: 28,
      fiberG: 0.4,
      sugarG: 0,
      calciumMg: 10,
      ironMg: 0.2,
      sodiumMg: 1,
      potassiumMg: 35,
      magnesiumMg: 12,
      zincMg: 0.5,
    },
    source: 'custom',
    note: '',
  };

  it('opens a gram food in per100 mode', () => {
    expect(inputFromFoodItem(gramItem).nutritionBasis).toBe('per100');
  });

  it('opens a counted food in perServing mode', () => {
    const counted: FoodItem = { ...gramItem, portionUnit: 'capsule', servingWeightG: 1.22 };
    expect(inputFromFoodItem(counted).nutritionBasis).toBe('perServing');
  });

  it('a counted item without a usable servingWeightG falls back to per100 (nothing to scale by)', () => {
    const broken: FoodItem = { ...gramItem, portionUnit: 'capsule', servingWeightG: 0 };
    expect(inputFromFoodItem(broken).nutritionBasis).toBe('per100');
  });

  it('shows no floating-point tail after converting per-100g back to per-capsule', () => {
    // Stored the way buildCustomFoodItem would: 610 mg per 1.22 g capsule.
    const counted: FoodItem = {
      ...gramItem,
      portionUnit: 'capsule',
      servingWeightG: 1.22,
      per100g: { ...gramItem.per100g, epaMg: (300 / 1.22) * 100, dhaMg: (310 / 1.22) * 100 },
    };
    const input = inputFromFoodItem(counted);
    expect(input.epaMg).toBe('300');
    expect(input.dhaMg).toBe('310');
  });
});

describe('nutritionPreview', () => {
  const base: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    name: 'Phở bò',
    defaultServingG: '250',
    nutritionBasis: 'per100',
    energyKcal: '100',
    proteinG: '10',
    fatG: '4',
    carbG: '20',
  };

  it('per100 input previews one serving (target perServing)', () => {
    const p = nutritionPreview(base);
    expect(p).toEqual({
      target: 'perServing',
      servingSize: 250,
      energyKcal: 250,
      proteinG: 25,
      fatG: 10,
      carbG: 50,
    });
  });

  it('perServing input previews per-100 (target per100)', () => {
    const p = nutritionPreview({ ...base, nutritionBasis: 'perServing', energyKcal: '450', proteinG: '20' });
    expect(p?.target).toBe('per100');
    expect(p?.servingSize).toBe(250);
    expect(p?.energyKcal).toBe(180);
    expect(p?.proteinG).toBe(8);
  });

  it('rounds to one decimal place', () => {
    const p = nutritionPreview({
      ...base,
      defaultServingG: '350',
      nutritionBasis: 'perServing',
      energyKcal: '450',
    });
    // 450 / 350 * 100 = 128.5714… → 128.6
    expect(p?.energyKcal).toBe(128.6);
  });

  it('is null when there is no serving size', () => {
    expect(nutritionPreview({ ...base, defaultServingG: '' })).toBeNull();
    expect(nutritionPreview({ ...base, defaultServingG: '0' })).toBeNull();
  });

  it('is null when kcal is blank or invalid', () => {
    expect(nutritionPreview({ ...base, energyKcal: '' })).toBeNull();
    expect(nutritionPreview({ ...base, energyKcal: 'abc' })).toBeNull();
    expect(nutritionPreview({ ...base, energyKcal: '-1' })).toBeNull();
  });

  it('lifts carbs to sugar + fiber exactly like buildCustomFoodItem, so the preview matches what is saved', () => {
    const input: CustomFoodInput = { ...base, carbG: '3', sugarG: '10', fiberG: '5' };
    const p = nutritionPreview(input);
    expect(p?.carbG).toBe(37.5); // (10 + 5) per 100 g × 250/100
  });

  it('uses servingWeightG for a counted food', () => {
    const p = nutritionPreview({
      ...base,
      portionUnit: 'serving',
      defaultServingG: '999',
      servingWeightG: '180',
      energyKcal: '70',
    });
    expect(p?.servingSize).toBe(180);
    expect(p?.energyKcal).toBe(126);
  });
});

describe('formBasisLabel', () => {
  const base = EMPTY_CUSTOM_FOOD_INPUT;

  it('per100 reads 100g or 100ml by measure unit', () => {
    expect(formBasisLabel({ ...base, nutritionBasis: 'per100', measureUnit: 'g' }, 'vi')).toBe('100g');
    expect(formBasisLabel({ ...base, nutritionBasis: 'per100', measureUnit: 'ml' }, 'vi')).toBe('100ml');
  });

  it('perServing on a counted food reads "1 <noun>"', () => {
    expect(
      formBasisLabel(
        { ...base, nutritionBasis: 'perServing', portionUnit: 'serving', servingLabel: 'hộp' },
        'vi'
      )
    ).toBe('1 hộp');
    expect(
      formBasisLabel({ ...base, nutritionBasis: 'perServing', portionUnit: 'capsule' }, 'vi')
    ).toBe('1 viên');
  });

  it('perServing on a gram food reads the generic "1 khẩu phần" and follows the language', () => {
    expect(formBasisLabel({ ...base, nutritionBasis: 'perServing' }, 'vi')).toBe('1 khẩu phần');
    expect(formBasisLabel({ ...base, nutritionBasis: 'perServing' }, 'en')).toBe('1 serving');
    expect(formBasisLabel({ ...base, nutritionBasis: 'perServing' }, 'de')).toBe('1 Portion');
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

// The reported case: a 65ml carton of yoghurt drink whose label prints the
// nutrition for exactly one 65ml carton, not per 100g/100ml.
describe("buildCustomFoodItem — 'serving' portions measured in ml", () => {
  const yakult: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    name: 'Yakult',
    category: 'drink',
    portionUnit: 'serving',
    servingLabel: '  hộp  ',
    measureUnit: 'ml',
    servingWeightG: '65', // 65 ml ≈ 65 g
    nutritionBasis: 'perServing',
    // Values printed on ONE 65ml carton.
    energyKcal: '50',
    carbG: '12',
    sugarG: '11',
    proteinG: '0.8',
    fatG: '0',
    waterG: '52',
    calciumMg: '30',
  };

  it('stores the entered per-carton figures as per-100g and keeps the unit metadata', () => {
    const item = buildCustomFoodItem(yakult);
    expect(item.portionUnit).toBe('serving');
    expect(item.servingLabel).toBe('hộp'); // trimmed
    expect(item.measureUnit).toBe('ml');
    expect(item.servingWeightG).toBe(65);
    // 50 kcal per 65 ml -> 50 / 65 * 100 per 100 ml.
    expect(item.per100g.energyKcal).toBeCloseTo((50 / 65) * 100, 6);
    expect(item.per100g.sugarG).toBeCloseTo((11 / 65) * 100, 6);
    expect(item.per100g.calciumMg).toBeCloseTo((30 / 65) * 100, 6);
  });

  it('round-trips back through inputFromFoodItem to the numbers the user typed', () => {
    const restored = inputFromFoodItem(buildCustomFoodItem(yakult));
    expect(restored.portionUnit).toBe('serving');
    expect(restored.servingLabel).toBe('hộp');
    expect(restored.measureUnit).toBe('ml');
    expect(restored.servingWeightG).toBe('65');
    expect(Number(restored.energyKcal)).toBeCloseTo(50, 6);
    expect(Number(restored.sugarG)).toBeCloseTo(11, 6);
    expect(Number(restored.calciumMg)).toBeCloseTo(30, 6);
  });

  it('requires a positive serving size before it can be saved', () => {
    expect(isValidCustomFoodInput(yakult)).toBe(true);
    expect(isValidCustomFoodInput({ ...yakult, servingWeightG: '' })).toBe(false);
    expect(isValidCustomFoodInput({ ...yakult, servingWeightG: '0' })).toBe(false);
  });

  it('drops the label when the unit is not a free-named serving', () => {
    const asCapsule = buildCustomFoodItem({ ...yakult, portionUnit: 'capsule' });
    expect(asCapsule.portionUnit).toBe('capsule');
    expect(asCapsule.servingLabel).toBeUndefined();
  });

  it('keeps the measure unit but drops label/serving weight for a weighed food', () => {
    const weighed = buildCustomFoodItem({
      ...yakult,
      portionUnit: 'gram',
      servingWeightG: '',
    });
    expect(weighed.portionUnit).toBe('gram');
    expect(weighed.servingLabel).toBeUndefined();
    expect(weighed.servingWeightG).toBeUndefined();
    // A liquid weighed by volume is still read in ml.
    expect(weighed.measureUnit).toBe('ml');
    // The gram food's serving is defaultServingG ('100' here), so the
    // per-serving figures scale by 100/100 — the numbers come out unchanged.
    expect(weighed.per100g.energyKcal).toBe(50);
  });
});

describe('changePortionUnit — servingLabel handling', () => {
  const withLabel: CustomFoodInput = {
    ...EMPTY_CUSTOM_FOOD_INPUT,
    portionUnit: 'serving',
    servingLabel: 'hộp',
    energyKcal: '50',
  };

  it("keeps the typed noun while staying on 'serving'", () => {
    expect(changePortionUnit(withLabel, 'serving').servingLabel).toBe('hộp');
  });

  it('clears it when switching to a unit that has its own noun', () => {
    expect(changePortionUnit(withLabel, 'capsule').servingLabel).toBe('');
    expect(changePortionUnit(withLabel, 'gram').servingLabel).toBe('');
  });
});

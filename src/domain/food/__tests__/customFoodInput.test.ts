import {
  buildCustomFoodItem,
  inputFromFoodItem,
  isValidCustomFoodInput,
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
});

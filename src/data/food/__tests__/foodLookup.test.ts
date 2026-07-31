import { getAnyFoodById, foodDisplayName, foodLogEntryDisplayName } from '../foodLookup';
import { USDA_FOODS } from '../usdaFoods';
import { setCustomFoods } from '../customFoodRegistry';
import type { FoodItem, FoodLogEntry } from '../../../types/food';

const EMPTY_NUTRITION = {
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
};

// Regression for the "700g cherries didn't move the micro batteries" bug: the
// micro engine's lookup must resolve USDA-logged ids, not just the VN CSV.
describe('getAnyFoodById', () => {
  afterEach(() => {
    setCustomFoods([]); // don't leak custom-food state into other tests
  });

  it('resolves an id from the Vietnamese food CSV', () => {
    expect(getAnyFoodById('rice_white_cooked')).toBeDefined();
  });

  it('resolves a usda_* id from the USDA catalog', () => {
    const usdaId = USDA_FOODS[0].id;
    expect(usdaId.startsWith('usda_')).toBe(true);
    expect(getAnyFoodById(usdaId)?.id).toBe(usdaId);
  });

  it('returns undefined for an unknown id', () => {
    expect(getAnyFoodById('does_not_exist')).toBeUndefined();
  });

  it('resolves a custom food registered via the runtime registry (no real DB)', () => {
    const custom: FoodItem = {
      id: 'custom_homemade_soup',
      nameVi: 'Súp tự nấu',
      nameEn: 'Homemade soup',
      category: 'custom',
      defaultServingG: 250,
      servingPresets: [],
      per100g: { ...EMPTY_NUTRITION, energyKcal: 45 },
      source: 'custom',
      note: '',
    };
    setCustomFoods([custom]);

    const resolved = getAnyFoodById('custom_homemade_soup');
    expect(resolved).toBeDefined();
    expect(resolved?.nameVi).toBe('Súp tự nấu');
  });
});

describe('foodDisplayName', () => {
  const item: FoodItem = {
    id: 'rice_white_cooked',
    nameVi: 'Cơm trắng',
    nameEn: 'White rice',
    nameDe: 'Reis (gekocht)',
    category: 'grain',
    defaultServingG: 150,
    servingPresets: [],
    per100g: { ...EMPTY_NUTRITION, energyKcal: 130 },
    source: 'USDA',
    note: '',
  };

  it('returns nameVi for vi', () => {
    expect(foodDisplayName(item, 'vi')).toBe('Cơm trắng');
  });

  it('returns nameEn for en', () => {
    expect(foodDisplayName(item, 'en')).toBe('White rice');
  });

  it('returns nameDe for de', () => {
    expect(foodDisplayName(item, 'de')).toBe('Reis (gekocht)');
  });

  it('falls back en -> vi when nameEn is blank', () => {
    expect(foodDisplayName({ ...item, nameEn: '' }, 'en')).toBe('Cơm trắng');
  });

  it('falls back de -> en -> vi when nameDe is missing', () => {
    expect(foodDisplayName({ ...item, nameDe: undefined }, 'de')).toBe('White rice');
  });

  it('falls back de -> vi when both nameDe and nameEn are blank', () => {
    expect(foodDisplayName({ ...item, nameDe: undefined, nameEn: '' }, 'de')).toBe('Cơm trắng');
  });
});

describe('foodLogEntryDisplayName', () => {
  const baseEntry: FoodLogEntry = {
    id: 'log1',
    timestamp: 0,
    mealType: 'lunch',
    foodId: 'rice_white_cooked',
    foodNameVi: 'stale snapshot name',
    grams: 100,
    energyKcal: 130,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    waterG: 0,
    mineralsMg: 0,
  };

  it('resolves the live catalog name for a known foodId, ignoring the stale snapshot', () => {
    expect(foodLogEntryDisplayName(baseEntry, 'en')).toBe('White rice, cooked');
  });

  it('falls back to the frozen snapshot when the foodId no longer resolves', () => {
    const entry = { ...baseEntry, foodId: 'deleted_food_id', foodNameVi: 'Món đã xoá' };
    expect(foodLogEntryDisplayName(entry, 'en')).toBe('Món đã xoá');
  });
});

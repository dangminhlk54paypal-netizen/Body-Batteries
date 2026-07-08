import { getAnyFoodById } from '../foodLookup';
import { USDA_FOODS } from '../usdaFoods';
import { setCustomFoods } from '../customFoodRegistry';
import type { FoodItem } from '../../../types/food';

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

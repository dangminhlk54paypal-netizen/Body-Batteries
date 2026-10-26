import type { FoodItem } from '../../../types/food';
import { setCustomFoods } from '../customFoodRegistry';
import { setOverrides } from '../foodOverrideRegistry';
import { foodDisplayName, getAnyFoodById } from '../foodLookup';

const PER100 = {
  energyKcal: 120, waterG: 0, proteinG: 12, fatG: 6, carbG: 4, fiberG: 0, sugarG: 0,
  calciumMg: 0, ironMg: 0, sodiumMg: 0, potassiumMg: 0, magnesiumMg: 0, zincMg: 0,
};

const GOULASH: FoodItem = {
  id: 'custom_goulash',
  nameVi: 'Rindergulasch',
  nameEn: 'Beef goulash',
  nameDe: 'Rindergulasch',
  category: 'custom',
  defaultServingG: 300,
  servingPresets: [],
  per100g: PER100,
  source: 'custom',
  note: '',
};

// The override row has no name_de column (foodOverrideMapper fills '').
function override(nameVi: string, nameEn: string): FoodItem {
  return { ...GOULASH, nameVi, nameEn, nameDe: '', source: 'override', per100g: { ...PER100, energyKcal: 130 } };
}

afterEach(() => {
  setCustomFoods([]);
  setOverrides([]);
});

describe('getAnyFoodById — German name of an edited custom food', () => {
  it('keeps the German name when the edit only changed numbers', () => {
    setCustomFoods([GOULASH]);
    setOverrides([override('Rindergulasch', 'Beef goulash')]);
    const food = getAnyFoodById(GOULASH.id)!;
    expect(foodDisplayName(food, 'de')).toBe('Rindergulasch');
    expect(food.per100g.energyKcal).toBe(130);
  });

  it('shows the new name in German after a rename', () => {
    setCustomFoods([GOULASH]);
    setOverrides([override('Gulasch vom Rind', '')]);
    expect(foodDisplayName(getAnyFoodById(GOULASH.id)!, 'de')).toBe('Gulasch vom Rind');
  });
});

import { getAnyFoodById } from '../foodLookup';
import { USDA_FOODS } from '../usdaFoods';

// Regression for the "700g cherries didn't move the micro batteries" bug: the
// micro engine's lookup must resolve USDA-logged ids, not just the VN CSV.
describe('getAnyFoodById', () => {
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
});

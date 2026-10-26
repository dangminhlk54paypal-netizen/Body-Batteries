import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { DOUBT_LIMITS } from '../../domain/food/mealText/aiNutrition';

// TextMealEntry builds `nutrients.${nutrient}.name` for the aiDoubt note at
// run time, which usedKeys.test.ts can't see.
describe('"aiDoubt" nutrient names', () => {
  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('exist in %s for every doubted mineral', (_lang, dict) => {
    const nutrients = dict.nutrients as Record<string, { name?: string }>;
    for (const { nutrient } of DOUBT_LIMITS) expect(typeof nutrients[nutrient]?.name).toBe('string');
  });
});

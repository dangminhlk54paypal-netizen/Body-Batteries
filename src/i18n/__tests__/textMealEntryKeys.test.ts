import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { de } from '../locales/de';
import { ISSUE_ORDER } from '../../domain/food/mealText/mapMealText';
import { ACTIVITY_ISSUE_ORDER } from '../../domain/energy/activityText/mapActivityText';

// TextMealEntry builds `components.textMealEntry.notes.${issue}` at run time,
// which usedKeys.test.ts can't see — so every draft issue is checked here.
describe('"Nạp bằng chữ" note texts', () => {
  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('exist in %s for every issue', (_lang, dict) => {
    const notes = dict.components.textMealEntry.notes as Record<string, string>;
    for (const issue of ISSUE_ORDER) expect(typeof notes[issue]).toBe('string');
  });

  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('exist in %s for every workout issue ("Kể cả ngày")', (_lang, dict) => {
    const notes = dict.components.textMealEntry.activity.notes as Record<string, string>;
    for (const issue of ACTIVITY_ISSUE_ORDER) expect(typeof notes[issue]).toBe('string');
  });
});

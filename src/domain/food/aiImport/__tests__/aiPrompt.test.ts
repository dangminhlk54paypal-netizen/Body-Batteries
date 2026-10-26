import { vi } from '../../../../i18n/locales/vi';
import { en } from '../../../../i18n/locales/en';
import { de } from '../../../../i18n/locales/de';
import { translate } from '../../../../i18n/translate';
import { LANGUAGES } from '../../../../i18n/types';
import { parseMealText } from '../../mealText/parseMealText';
import { AI_MEAL_JSON_SHAPE, buildAiPrompt, PROMPT_KEYS } from '../aiPrompt';

function promptIn(language: (typeof LANGUAGES)[number]): string {
  return buildAiPrompt(
    translate(language, 'components.textMealEntry.aiPromptIntro'),
    translate(language, 'components.textMealEntry.aiPromptOutro', PROMPT_KEYS)
  );
}

describe('"📤 Hỏi AI" prompt', () => {
  it.each(LANGUAGES)('carries the JSON shape from code, unchanged, in %s', (language) => {
    const prompt = promptIn(language);
    const jsonLine = prompt.split('\n').find((line) => line.startsWith('{'));
    expect(JSON.parse(jsonLine!)).toEqual(AI_MEAL_JSON_SHAPE);
    // The instructions name every key the answer may add, untranslated.
    for (const key of Object.values(PROMPT_KEYS)) expect(prompt).toContain(key);
  });

  it.each([
    ['vi', vi],
    ['en', en],
    ['de', de],
  ])('keeps JSON out of the %s translation (only {{placeholders}} for keys)', (_lang, dict) => {
    const { aiPromptIntro, aiPromptOutro } = dict.components.textMealEntry;
    for (const text of [aiPromptIntro, aiPromptOutro]) {
      expect(text).not.toMatch(/\{"|"\w+"\s*:/);
    }
    for (const placeholder of Object.keys(PROMPT_KEYS)) expect(aiPromptOutro).toContain(`{{${placeholder}}}`);
  });

  it('is read back by the app when an AI fills the shape in', () => {
    const answer = JSON.stringify({
      items: [{ ...AI_MEAL_JSON_SHAPE.items[0], name: 'Phở bò', name_en: 'Beef pho', grams: 500, time: '12:30' }],
    });
    const [item] = parseMealText(answer);
    expect(item).toMatchObject({ raw: 'Phở bò', nameEn: 'Beef pho' });
    expect(item.ai?.per100g).toMatchObject({ energyKcal: 0, proteinG: 0, sodiumMg: 0 });
  });
});

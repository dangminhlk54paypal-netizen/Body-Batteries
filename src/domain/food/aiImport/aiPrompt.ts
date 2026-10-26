// The "📤 Hỏi AI" prompt: instructions in the app's language + the JSON shape
// the answer must follow. The shape lives here in code, never in the
// translation files — a translator rewording the instructions can't rename a
// key the parser reads (parseMealJson / jsonNutrition). The instructions
// name the keys only through {{placeholders}} filled from PROMPT_KEYS.

export const AI_MEAL_JSON_SHAPE = {
  items: [
    {
      name: '…',
      name_en: '…',
      grams: 150,
      per_100g: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 },
    },
  ],
};

// The keys the instructions talk about, as they appear in the answer.
export const PROMPT_KEYS = { name: '"name"', nameEn: '"name_en"', time: '"time":"HH:MM"' };

// `intro` / `outro`: the translated text before and after the JSON block.
export function buildAiPrompt(intro: string, outro: string): string {
  return `${intro}\n${JSON.stringify(AI_MEAL_JSON_SHAPE)}\n${outro}`;
}

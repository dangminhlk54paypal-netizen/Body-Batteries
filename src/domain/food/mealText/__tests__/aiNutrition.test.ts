import {
  aiNutritionDiffers,
  aiNutritionLooksOff,
  completeNutrition,
  halfWidth,
  jsonNutrition,
  normaliseLabel,
  parseNutritionText,
} from '../aiNutrition';

describe('jsonNutrition', () => {
  it('reads per_100g as is, with the unit suffixes the prompt asks for', () => {
    const ai = jsonNutrition(
      { name: 'Phở bò', grams: 500, per_100g: { kcal: 110, protein_g: 7, carbs_g: 14, fat_g: 3, sodium_mg: 380 } },
      500,
      'g'
    );
    expect(ai).toEqual({
      per100g: { energyKcal: 110, proteinG: 7, carbG: 14, fatG: 3, sodiumMg: 380 },
      basisGuessed: false,
      measure: 'g',
    });
  });

  it('scales totals for the item to per 100 g', () => {
    const ai = jsonNutrition({ grams: 200, nutrition: { calories: 300, protein: 20, fat: 10 } }, 200, 'g');
    expect(ai?.per100g).toEqual({ energyKcal: 150, proteinG: 10, fatG: 5 });
    expect(ai?.basisGuessed).toBe(false);
  });

  it('reads flat keys on the item as totals; kJ, g of sodium and salt are converted', () => {
    const ai = jsonNutrition({ grams: 100, energy_kj: 418.4, sodium_g: 0.5, carbs: 10 }, 100, 'g');
    expect(ai?.per100g).toEqual({ energyKcal: 100, sodiumMg: 500, carbG: 10 });
    expect(jsonNutrition({ per_100g: { kcal: 50, salt_g: 1 } }, null, 'g')?.per100g.sodiumMg).toBe(400);
  });

  it('flags totals without an amount as a guessed basis, and returns null without any number', () => {
    expect(jsonNutrition({ nutrition: { kcal: 400, protein: 30 } }, null, 'g')?.basisGuessed).toBe(true);
    expect(jsonNutrition({ name: 'Phở', grams: 500 }, 500, 'g')).toBeNull();
  });

  it('ignores saturated fat and other unknown keys', () => {
    const ai = jsonNutrition({ per_100g: { kcal: 200, fat_g: 10, saturated_fat_g: 4, cholesterol_mg: 20 } }, null, 'g');
    expect(ai?.per100g).toEqual({ energyKcal: 200, fatG: 10 });
  });
});

describe('parseNutritionText', () => {
  it('reads a Vietnamese analysis with a name and a portion', () => {
    const r = parseNutritionText(
      'Tên món: Cơm gà xối mỡ\nKhối lượng: 400 g\nNăng lượng: 720 kcal\nChất đạm: 32 g\nTinh bột: 80 g\nChất béo: 30 g\nChất xơ: 2 g'
    );
    expect(r?.name).toBe('Cơm gà xối mỡ');
    expect(r?.grams).toBe(400);
    expect(r?.nutrition).toEqual({
      per100g: { energyKcal: 180, proteinG: 8, carbG: 20, fatG: 7.5, fiberG: 0.5 },
      basisGuessed: false,
      measure: 'g',
    });
  });

  it('reads an English label "per 100 g" — numbers kept, kJ and saturates skipped', () => {
    const r = parseNutritionText(
      'Greek yogurt\nNutrition per 100 g:\n- Energy: 406 kJ / 97 kcal\n- Fat: 5 g\n- of which saturates: 3.5 g\n' +
        '- Carbohydrate: 3.6 g\n- of which sugars: 3.6 g\n- Protein: 9 g\n- Salt: 0.1 g'
    );
    expect(r?.name).toBe('Greek yogurt');
    expect(r?.grams).toBeNull();
    expect(r?.nutrition.basisGuessed).toBe(false);
    expect(r?.nutrition.per100g).toEqual({
      energyKcal: 97,
      fatG: 5,
      carbG: 3.6,
      sugarG: 3.6,
      proteinG: 9,
      sodiumMg: 40,
    });
  });

  it('reads one line with commas, German labels and decimal commas', () => {
    const r = parseNutritionText('Magerquark je 100 g: Brennwert 67 kcal, Eiweiß 12,4 g, Kohlenhydrate 4 g, Fett 0,2 g');
    expect(r?.name).toBe('Magerquark');
    expect(r?.nutrition.per100g).toEqual({ energyKcal: 67, proteinG: 12.4, carbG: 4, fatG: 0.2 });
  });

  it('reads markdown bold, tables and ranges', () => {
    const r = parseNutritionText(
      '**Bánh mì thịt (khoảng 250 g)**\n| Chỉ số | Giá trị |\n|---|---|\n| Calories | 500–600 kcal |\n| Protein | 20–25 g |\n| Carbs | 60 g |\n| Fat | 20 g |'
    );
    expect(r?.name).toBe('Bánh mì thịt');
    expect(r?.grams).toBe(250);
    expect(r?.nutrition.per100g).toEqual({ energyKcal: 220, proteinG: 9, carbG: 24, fatG: 8 });
  });

  it('skips an intro line ending in ":" when looking for the name', () => {
    const r = parseNutritionText('Dưới đây là ước tính:\nPhở bò\nCalories: 450 kcal\nProtein: 25 g');
    expect(r?.name).toBe('Phở bò');
    expect(r?.nutrition.basisGuessed).toBe(true);
  });

  it('is not a nutrition answer without energy and a macro', () => {
    expect(parseNutritionText('2 chén cơm, 200g ức gà')).toBeNull();
    expect(parseNutritionText('đường 10g, cà phê 200ml')).toBeNull();
    expect(parseNutritionText('Calories: 300 kcal')).toBeNull();
  });
});

describe('checks', () => {
  it('flags energy that does not fit the macros, and impossible amounts', () => {
    expect(aiNutritionLooksOff({ energyKcal: 180, proteinG: 8, carbG: 20, fatG: 7.5 })).toBe(false);
    expect(aiNutritionLooksOff({ energyKcal: 500, proteinG: 8, carbG: 20, fatG: 7.5 })).toBe(true);
    expect(aiNutritionLooksOff({ energyKcal: 950 })).toBe(true);
    expect(aiNutritionLooksOff({ proteinG: 60, carbG: 50 })).toBe(true);
  });

  it('tells when the AI says something the app does not', () => {
    const app = completeNutrition({ energyKcal: 110, proteinG: 7, carbG: 14, fatG: 3 });
    expect(aiNutritionDiffers(app, { energyKcal: 113, proteinG: 8 })).toBe(false);
    expect(aiNutritionDiffers(app, { energyKcal: 135 })).toBe(true);
    expect(aiNutritionDiffers(app, { fatG: 6 })).toBe(true);
  });

  it('completes a new food with zeros, optional nutrients left out', () => {
    const full = completeNutrition({ energyKcal: 50, caffeineMg: 30 });
    expect(full).toMatchObject({ energyKcal: 50, proteinG: 0, sodiumMg: 0, caffeineMg: 30 });
    expect('epaMg' in full).toBe(false);
  });
});

describe('thousands separators', () => {
  it('reads "1.046 kJ" (de) and "1,046 kJ" (en) as one thousand, not 1.046', () => {
    const de = parseNutritionText('Brennwert 1.046 kJ\nEiweiß 10 g\nKohlenhydrate 30 g\nFett 2 g\npro 100 g');
    expect(de?.nutrition.per100g.energyKcal).toBe(250);
    const en = parseNutritionText('Energy 1,046 kJ\nProtein 10 g\nCarbohydrate 30 g\nFat 2 g\nper 100 g');
    expect(en?.nutrition.per100g.energyKcal).toBe(250);
  });

  it('reads "Natrium 1.200 mg" as 1200 mg and keeps decimal commas', () => {
    const r = parseNutritionText('je 100 g: Brennwert 120 kcal, Fett 0,125 g, Eiweiß 12,4 g, Natrium 1.200 mg');
    expect(r?.nutrition.per100g).toEqual({ energyKcal: 120, fatG: 0.1, proteinG: 12.4, sodiumMg: 1200 });
  });

  it('reads a range of thousands', () => {
    const r = parseNutritionText('Calories 250 kcal\nProtein 10 g\nSodium 1,000–1,200 mg\nper 100 g');
    expect(r?.nutrition.per100g.sodiumMg).toBe(1100);
  });

  it('reads thousands in JSON string values, from the key unit or the value unit', () => {
    const ai = jsonNutrition({ per_100g: { energy_kj: '1.046', sodium_mg: '1,200', protein_g: '12,4' } }, null, 'g');
    expect(ai?.per100g).toEqual({ energyKcal: 250, sodiumMg: 1200, proteinG: 12.4 });
    expect(jsonNutrition({ per_100g: { energy: '1.046 kJ' } }, null, 'g')?.per100g.energyKcal).toBe(250);
  });

  it('turns on the aiCheck warning once kJ is read right (250 kcal from macros of 600)', () => {
    const r = parseNutritionText('Energie 1.046 kJ\nEiweiß 50 g\nKohlenhydrate 50 g\nFett 22 g\npro 100 g');
    expect(aiNutritionLooksOff(r!.nutrition.per100g)).toBe(true);
  });
});

describe('Unicode labels', () => {
  it('splits full-width punctuation like its plain form', () => {
    const r = parseNutritionText('Protein：30 g，Fat：10 g，Calories：250 kcal（per 100 g）');
    expect(r?.nutrition.per100g).toEqual({ energyKcal: 250, proteinG: 30, fatG: 10 });
    expect(r?.nutrition.basisGuessed).toBe(false);
  });

  it('keeps letters of every script in a label instead of erasing them', () => {
    expect(normaliseLabel('蛋白质 (g)')).toBe('蛋白质 g');
    expect(normaliseLabel('Énergie_kJ')).toBe('energie kj');
    expect(halfWidth('３０ｇ')).toBe('30g');
  });
});

describe('doubtful thousands', () => {
  it('flags "Eisen 1,500 mg" (1500 mg iron is far above any food) with the decimal reading', () => {
    const r = parseNutritionText('pro 100 g: Brennwert 120 kcal, Eiweiß 10 g, Eisen 1,500 mg');
    expect(r?.nutrition.per100g.ironMg).toBe(1500);
    expect(r?.nutrition.doubtful).toEqual([{ key: 'ironMg', value: 1500, alt: 1.5 }]);
  });

  it('does not doubt a mineral that really reaches thousands (calcium in cheese, sodium)', () => {
    const r = parseNutritionText('per 100 g: Calories 330 kcal, Protein 18 g, Calcium 1,500 mg, Sodium 1,200 mg');
    expect(r?.nutrition.per100g).toMatchObject({ calciumMg: 1500, sodiumMg: 1200 });
    expect(r?.nutrition.doubtful).toBeUndefined();
  });

  it('does not doubt a value written without a separator', () => {
    const r = parseNutritionText('per 100 g: Calories 120 kcal, Protein 10 g, Iron 1500 mg');
    expect(r?.nutrition.doubtful).toBeUndefined();
  });

  it('flags a doubtful JSON string value too', () => {
    const ai = jsonNutrition({ per_100g: { kcal: 120, zinc_mg: '2.500' } }, null, 'g');
    expect(ai?.doubtful).toEqual([{ key: 'zincMg', value: 2500, alt: 2.5 }]);
  });
});

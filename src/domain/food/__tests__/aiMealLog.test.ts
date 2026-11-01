import { parseAiMealLog, aiLineToFoodItem, timestampForLine } from '../aiMealLog';
import { nutritionForGrams } from '../foodNutrition';

const SAMPLE = `\`\`\`text
BB-LOG v1
07:00 | Bánh mì trứng | 150 | 380 | 14 | 45 | 15 | 40
07:00 | Cà phê sữa đá | 250 | 120 | 2 | 20 | 4 | 220
12:00 | Phở bò tái (tô lớn) | 600 | 550 | 30 | 70 | 15 | 450
\`\`\``;

describe('parseAiMealLog', () => {
  it('parses a fenced BB-LOG v1 block', () => {
    const { items, errors } = parseAiMealLog(SAMPLE);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({
      hour: 12, minute: 0, name: 'Phở bò tái (tô lớn)', grams: 600,
      energyKcal: 550, proteinG: 30, carbG: 70, fatG: 15, waterG: 450,
    });
  });

  it('tolerates markdown tables, units, decimal commas and missing macros', () => {
    const { items, errors } = parseAiMealLog(
      '| HH:MM | Tên món | gram | kcal |\n| 19:30 | Chè đậu | 200g | 250,5 kcal |'
    );
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ hour: 19, minute: 30, grams: 200, energyKcal: 250.5, proteinG: 0 });
  });

  it('ignores prose and reports bad lines', () => {
    const { items, errors } = parseAiMealLog(
      'Đây là kết quả:\n25:00 | Cơm | 150 | 200\n08:00 | Trứng | 0 | 70\n08:00 | Sữa | 200 | 120'
    );
    expect(items.map((i) => i.name)).toEqual(['Sữa']);
    expect(errors).toHaveLength(2);
  });
});

describe('aiLineToFoodItem', () => {
  it('reproduces the line totals through nutritionForGrams', () => {
    const [line] = parseAiMealLog('12:00 | Phở bò | 600 | 550 | 30 | 70 | 15 | 450').items;
    const item = aiLineToFoodItem(line);
    expect(item.id).toBe('ai_pho_bo');
    const n = nutritionForGrams(item, line.grams);
    expect(n).toMatchObject({ energyKcal: 550, proteinG: 30, carbG: 70, fatG: 15, waterG: 450 });
  });

  it('builds a same-day timestamp at HH:MM', () => {
    const [line] = parseAiMealLog('07:45 | Xôi | 200 | 350').items;
    const d = new Date(timestampForLine(line, new Date(2026, 10, 1, 15, 0)));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 1, 7, 45]);
  });
});

import { looksLikeBbLog, parseBbLog } from '../bbLog';
import { parseMealAnswer } from '../../mealText/parseMealText';

const SAMPLE = `\`\`\`text
BB-LOG v1
07:00 | Bánh mì trứng | 150 | 380 | 14 | 45 | 15 | 40
12:00 | Phở bò tái (tô lớn) | 600 | 550 | 30 | 70 | 15 | 450
\`\`\``;

describe('parseBbLog', () => {
  it('reads a fenced block', () => {
    const { items, rejected } = parseBbLog(SAMPLE);
    expect(rejected).toEqual([]);
    expect(items[1]).toEqual({
      hour: 12, minute: 0, name: 'Phở bò tái (tô lớn)', grams: 600,
      energyKcal: 550, proteinG: 30, carbG: 70, fatG: 15, waterG: 450,
    });
  });

  it('tolerates markdown tables, units, decimal commas and missing macros', () => {
    const { items, rejected } = parseBbLog(
      '| HH:MM | Tên món | gram | kcal |\n|---|---|---|---|\n| 19:30 | Chè đậu | 200g | 250,5 kcal |'
    );
    expect(rejected).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ hour: 19, minute: 30, grams: 200, energyKcal: 250.5, proteinG: 0 });
  });

  it('ignores prose and reports lines it cannot read', () => {
    const { items, rejected } = parseBbLog(
      'Đây là kết quả:\n25:00 | Cơm | 150 | 200\n08:00 | Trứng | 0 | 70\n08:00 | Sữa | 200 | 120'
    );
    expect(items.map((i) => i.name)).toEqual(['Sữa']);
    expect(rejected).toHaveLength(2);
  });
});

describe('looksLikeBbLog', () => {
  it('needs the header or a clock-time line', () => {
    expect(looksLikeBbLog(SAMPLE)).toBe(true);
    expect(looksLikeBbLog('12:00 | Phở | 600 | 550')).toBe(true);
    expect(looksLikeBbLog('trưa ăn phở 12:00')).toBe(false);
    expect(looksLikeBbLog('Calories | 520')).toBe(false);
  });
});

describe('parseMealAnswer with BB-LOG', () => {
  it('gives rows with the time and per-100 g numbers a JSON answer would', () => {
    const [row] = parseMealAnswer('BB-LOG v1\n12:15 | Phở bò | 600 | 600 | 30 | 60 | 12 | 450')!;
    expect(row).toMatchObject({
      foodQuery: 'phở bò',
      quantity: 600,
      time: { dayOffset: null, hour: 12, minute: 15, meal: null },
    });
    expect(row.ai?.per100g).toMatchObject({ energyKcal: 100, proteinG: 5, carbG: 10, fatG: 2, waterG: 75 });
    expect(row.ai?.basisGuessed).toBe(false);
  });

  it('falls through to the other readers when nothing could be read', () => {
    expect(parseMealAnswer('BB-LOG v1\n')).toBeNull();
  });
});

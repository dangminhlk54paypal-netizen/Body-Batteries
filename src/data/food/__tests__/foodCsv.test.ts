import { parseFoodCsv, splitCsvLine, parseServingPresets } from '../foodCsv';

const HEADER =
  'id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note';

describe('splitCsvLine', () => {
  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('a,"White rice, cooked",b')).toEqual([
      'a',
      'White rice, cooked',
      'b',
    ]);
  });

  it('produces empty strings for trailing empty cells', () => {
    expect(splitCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });
});

describe('parseServingPresets', () => {
  it('parses multiple presets', () => {
    expect(parseServingPresets('chén=150|bát=250')).toEqual([
      { label: 'chén', grams: 150 },
      { label: 'bát', grams: 250 },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(parseServingPresets('')).toEqual([]);
    expect(parseServingPresets(undefined)).toEqual([]);
  });
});

describe('parseFoodCsv', () => {
  it('parses a row with a quoted name and per-100g nutrition', () => {
    const csv = `${HEADER}
rice_white_cooked,Cơm trắng,"White rice, cooked",grain,150,chén=150|bát=250,130,68.4,2.7,0.3,28.2,0.4,0.1,10,0.2,1,35,12,0.5,USDA,Cơm tẻ`;
    const items = parseFoodCsv(csv);
    expect(items).toHaveLength(1);
    const r = items[0];
    expect(r.id).toBe('rice_white_cooked');
    expect(r.nameEn).toBe('White rice, cooked');
    expect(r.category).toBe('grain');
    expect(r.defaultServingG).toBe(150);
    expect(r.servingPresets).toEqual([
      { label: 'chén', grams: 150 },
      { label: 'bát', grams: 250 },
    ]);
    expect(r.per100g.energyKcal).toBe(130);
    expect(r.per100g.proteinG).toBe(2.7);
    expect(r.per100g.zincMg).toBe(0.5);
  });

  it('defaults blank numeric cells to 0', () => {
    const csv = `${HEADER}
fish_basa,Cá basa,Basa fish,fish,100,,166,70,23,7,0,0,0,12,0.3,50,300,,,estimate,`;
    const r = parseFoodCsv(csv)[0];
    expect(r.per100g.magnesiumMg).toBe(0);
    expect(r.per100g.zincMg).toBe(0);
    expect(r.per100g.potassiumMg).toBe(300);
    expect(r.servingPresets).toEqual([]);
  });

  it('skips rows without an id and ignores blank lines', () => {
    const csv = `${HEADER}\n\n,no id here,,,,,,,,,,,,,,,,,,,\n`;
    expect(parseFoodCsv(csv)).toHaveLength(0);
  });
});

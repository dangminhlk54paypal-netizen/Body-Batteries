import {
  DEFAULT_LIBRARY_OPTIONS,
  estimateRowCount,
  guessDecimal,
  guessMapping,
  libraryFileKind,
  libraryFoodId,
  libraryHardMaxMb,
  libraryRowToFood,
  librarySizeCheck,
  librarySourceIdOf,
  parseLibraryNumber,
  remapColumns,
} from '../libraryMapping';
import type { ColumnMapping, LibraryImportOptions, LibraryMappingConfig } from '../../../../types/foodLibrary';

describe('guessMapping', () => {
  it('maps a USDA FoodData Central style header', () => {
    const header = [
      'fdc_id',
      'description',
      'Energy (kcal)',
      'Protein (g)',
      'Total lipid (fat) (g)',
      'Carbohydrate, by difference (g)',
      'Fiber, total dietary (g)',
      'Sugars, total (g)',
      'Sodium, Na (mg)',
      'Calcium, Ca (mg)',
    ];
    const g = guessMapping(header);
    expect(g.columns).toEqual({
      key: 0,
      name: 1,
      energy: 2,
      protein: 3,
      fat: 4,
      carb: 5,
      fiber: 6,
      sugar: 7,
      sodium: 8,
      calcium: 9,
    });
    expect(g.energyUnit).toBe('kcal');
    expect(g.mineralUnit).toBe('mg');
  });

  it('maps a German label table and detects kJ when there is no kcal column', () => {
    const g = guessMapping(['Lebensmittel', 'Energie (kJ)', 'Fett', 'Kohlenhydrate', 'davon Zucker', 'Eiweiß', 'Salz']);
    expect(g.columns).toEqual({ name: 0, energy: 1, fat: 2, carb: 3, sugar: 4, protein: 5, salt: 6 });
    expect(g.energyUnit).toBe('kj');
  });

  it('prefers the kcal column when the table has both kJ and kcal', () => {
    const g = guessMapping(['Name', 'Energie kJ', 'Energie kcal']);
    expect(g.columns.energy).toBe(2);
    expect(g.energyUnit).toBe('kcal');
  });

  it('maps a Vietnamese header and keeps "bột đường" as carb, "đường" as sugar', () => {
    const g = guessMapping(['Tên món', 'Năng lượng (kcal)', 'Đạm', 'Béo', 'Bột đường', 'Đường', 'Chất xơ', 'Khẩu phần (g)']);
    expect(g.columns).toEqual({ name: 0, energy: 1, protein: 2, fat: 3, carb: 4, sugar: 5, fiber: 6, servingG: 7 });
  });

  it('never maps one column to two fields and leaves unknown columns out', () => {
    const g = guessMapping(['Name', 'Brand', 'kcal']);
    expect(g.columns).toEqual({ name: 0, energy: 2 });
  });

  it('reads minerals in grams when their headers say g', () => {
    expect(guessMapping(['name', 'kcal', 'Sodium (g)']).mineralUnit).toBe('g');
  });
});

describe('guessDecimal', () => {
  const columns: ColumnMapping = { name: 0, energy: 1, fat: 2 };
  it('detects the comma decimal mark from the sample cells', () => {
    expect(guessDecimal([['Käse', '350', '27,5'], ['Brot', '250', '1,2']], columns, ';')).toBe(',');
    expect(guessDecimal([['Cheese', '350', '27.5']], columns, ',')).toBe('.');
  });
  it('falls back on the separator when the sample has only whole numbers', () => {
    expect(guessDecimal([['Brot', '250', '1']], columns, ';')).toBe(',');
    expect(guessDecimal([['Bread', '250', '1']], columns, ',')).toBe('.');
  });
});

describe('parseLibraryNumber', () => {
  it.each([
    ['12.5', '.', 12.5],
    ['1,234.5', '.', 1234.5],
    ['12,5', ',', 12.5],
    ['1.234,5', ',', 1234.5],
    ['12 g', '.', 12],
    ['<0.1', '.', 0.1],
    ['-3', '.', -3],
    ['1e2', '.', 100],
  ] as const)('%s with "%s" → %d', (raw, decimal, expected) => {
    expect(parseLibraryNumber(raw, decimal)).toBe(expected);
  });

  it.each(['', '  ', '-', 'n/a', 'tr'])('"%s" has no value', (raw) => {
    expect(parseLibraryNumber(raw, '.')).toBeNull();
  });
});

describe('libraryRowToFood', () => {
  const columns: ColumnMapping = { name: 0, energy: 1, protein: 2, fat: 3, carb: 4, sugar: 5, fiber: 6 };
  const opts = (patch: Partial<LibraryImportOptions> = {}) => ({ ...DEFAULT_LIBRARY_OPTIONS, ...patch });

  it('builds a per-100 g FoodItem from a per-100 g row', () => {
    const r = libraryRowToFood(['Apple', '52', '0.3', '0.2', '14', '10', '2.4'], columns, opts(), 'src1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adjusted).toBe(false);
    expect(r.item).toMatchObject({
      nameVi: 'Apple',
      nameEn: '',
      source: 'library',
      defaultServingG: 100,
      category: '',
    });
    expect(r.item.per100g).toMatchObject({ energyKcal: 52, proteinG: 0.3, fatG: 0.2, carbG: 14, sugarG: 10, fiberG: 2.4 });
    expect(r.item.id.startsWith('lib_src1_apple-')).toBe(true);
  });

  it('scales per-serving values to 100 g and keeps the serving as the default portion', () => {
    const r = libraryRowToFood(
      ['Yoghurt drink', '50', '1', '', '', '', '', '65'],
      { ...columns, servingG: 7 },
      opts({ basis: 'perServing' }),
      's'
    );
    expect(r.ok && r.item.per100g.energyKcal).toBeCloseTo(76.923, 3);
    expect(r.ok && r.item.per100g.proteinG).toBeCloseTo(1.538, 3);
    expect(r.ok && r.item.defaultServingG).toBe(65);
  });

  it('converts kJ to kcal, mineral grams to mg, and salt to sodium', () => {
    const r = libraryRowToFood(
      ['Käse', '1464', '1,5', '0,4'],
      { name: 0, energy: 1, salt: 2, calcium: 3 },
      opts({ energyUnit: 'kj', decimal: ',', mineralUnit: 'g' }),
      's'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.item.per100g.energyKcal).toBeCloseTo(349.904, 3);
    expect(r.item.per100g.sodiumMg).toBe(600);
    expect(r.item.per100g.calciumMg).toBe(400);
  });

  it('uses the sodium column over salt when both are there', () => {
    const r = libraryRowToFood(['x', '1', '2', '300'], { name: 0, energy: 1, salt: 2, sodium: 3 }, opts(), 's');
    expect(r.ok && r.item.per100g.sodiumMg).toBe(300);
  });

  it('raises carb to sugar + fibre and reports it as adjusted', () => {
    const r = libraryRowToFood(['Dates', '280', '2', '0.4', '60', '63', '8'], columns, opts(), 's');
    expect(r.ok && r.item.per100g.carbG).toBe(71);
    expect(r.ok && r.adjusted).toBe(true);
  });

  it('keeps omega-3 absent unless the file has those columns', () => {
    const plain = libraryRowToFood(['x', '1'], { name: 0, energy: 1 }, opts(), 's');
    expect(plain.ok && 'epaMg' in plain.item.per100g).toBe(false);
    const fish = libraryRowToFood(['Salmon', '208', '0.9'], { name: 0, energy: 1, epa: 2 }, opts({ mineralUnit: 'g' }), 's');
    expect(fish.ok && fish.item.per100g.epaMg).toBe(900);
  });

  it.each([
    [['', '52'], 'missingName'],
    [['Apple', ''], 'missingEnergy'],
    [['Apple', '-5'], 'negative'],
  ] as const)('rejects %j: %s', (cells, issue) => {
    expect(libraryRowToFood([...cells], { name: 0, energy: 1 }, opts(), 's')).toEqual({ ok: false, issue });
  });

  it('rejects a per-serving row without a serving size', () => {
    const r = libraryRowToFood(['x', '50', ''], { name: 0, energy: 1, servingG: 2 }, opts({ basis: 'perServing' }), 's');
    expect(r).toEqual({ ok: false, issue: 'missingServing' });
  });

  it('takes the id from the key column, so re-importing gives the same id', () => {
    const a = libraryRowToFood(['Apple', '52', '170567'], { name: 0, energy: 1, key: 2 }, opts(), 's');
    const b = libraryRowToFood(['Apple (renamed)', '53', '170567'], { name: 0, energy: 1, key: 2 }, opts(), 's');
    expect(a.ok && b.ok && a.item.id === b.item.id).toBe(true);
  });
});

describe('library ids', () => {
  it('is stable, readable and tied to its source', () => {
    const id = libraryFoodId('k3x9ab', 'Cơm trắng');
    expect(id).toBe(libraryFoodId('k3x9ab', ' Cơm trắng '));
    expect(id.startsWith('lib_k3x9ab_com-trang-')).toBe(true);
    expect(librarySourceIdOf(id)).toBe('k3x9ab');
  });

  it('tells names that fold the same apart by their hash', () => {
    expect(libraryFoodId('s', 'Apple, raw')).not.toBe(libraryFoodId('s', 'Apple raw'));
  });

  it('gives a key without latin letters an id too', () => {
    expect(libraryFoodId('s', '米饭')).toMatch(/^lib_s_[0-9a-z]+$/);
  });

  it('returns no source for other foods', () => {
    expect(librarySourceIdOf('custom_1')).toBeNull();
    expect(librarySourceIdOf('usda_2727589')).toBeNull();
  });
});

describe('file checks', () => {
  const MB = 1024 * 1024;
  it('asks above the user limit and refuses above the hard cap', () => {
    expect(librarySizeCheck(9 * MB, 10)).toBe('ok');
    expect(librarySizeCheck(11 * MB, 10)).toBe('ask');
    expect(librarySizeCheck(11 * MB, 50)).toBe('ok');
    expect(librarySizeCheck(501 * MB, 500)).toBe('tooBig');
    expect(librarySizeCheck(1024 * MB, 500)).toBe('tooBig');
  });

  it('estimates the row count from the sample', () => {
    expect(estimateRowCount(1000 * 1024, 1024, 11)).toBe(10_999);
    expect(estimateRowCount(1000, 0, 0)).toBe(0);
  });

  it('recognises CSV and Excel files by extension', () => {
    expect(libraryFileKind('foods.CSV')).toBe('csv');
    expect(libraryFileKind('export.tsv')).toBe('csv');
    expect(libraryFileKind('Tabelle.xlsx')).toBe('xlsx');
    expect(libraryFileKind('notes.pdf')).toBe('other');
  });
});

describe('spreadsheet cells', () => {
  it('takes a number cell as it is, whatever the decimal option says', () => {
    expect(parseLibraryNumber(12.5, ',')).toBe(12.5);
    expect(parseLibraryNumber(Number.NaN, '.')).toBeNull();
    const r = libraryRowToFood(['Quark', 67, 12.6, 1001], { name: 0, energy: 1, protein: 2, key: 3 }, { ...DEFAULT_LIBRARY_OPTIONS, decimal: ',' }, 's');
    expect(r.ok && r.item.per100g.proteinG).toBe(12.6);
    expect(r.ok && r.item.id).toBe(libraryFoodId('s', '1001'));
  });

  it('guesses the decimal mark from text cells only', () => {
    expect(guessDecimal([['a', 12.5, '1,5']], { name: 0, energy: 1, fat: 2 }, ',')).toBe(',');
    expect(guessDecimal([['a', 12.5]], { name: 0, energy: 1 }, ',')).toBe('.');
  });

  it('caps a spreadsheet far below a CSV', () => {
    const MB = 1024 * 1024;
    expect(librarySizeCheck(40 * MB, 500, 'csv')).toBe('ok');
    expect(librarySizeCheck(40 * MB, 500, 'xlsx')).toBe('tooBig');
    expect(libraryHardMaxMb('xlsx')).toBeLessThan(libraryHardMaxMb('csv'));
  });
});

describe('remapColumns', () => {
  const saved: LibraryMappingConfig = {
    delimiter: ';',
    header: ['Name', 'Energie (kcal)', 'Eiweiß', 'Fett'],
    columns: { name: 0, energy: 1, protein: 2, fat: 3 },
    options: DEFAULT_LIBRARY_OPTIONS,
  };

  it('follows columns that moved, matching names regardless of accents and case', () => {
    expect(remapColumns(saved, ['ID', 'FETT', 'name', 'Eiweiss', 'Energie kcal'])).toEqual({
      fat: 1,
      name: 2,
      protein: 3,
      energy: 4,
    });
  });

  it('leaves a field unmapped when its column is gone', () => {
    expect(remapColumns(saved, ['Name', 'Energie (kcal)'])).toEqual({ name: 0, energy: 1 });
  });
});

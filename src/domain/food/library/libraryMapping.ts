import type { FoodItem, Nutrition } from '../../../types/food';
import type { ColumnMapping, LibraryCell, LibraryField, LibraryImportOptions, LibraryMappingConfig } from '../../../types/foodLibrary';
import { normalize, wordsOf } from '../searchNormalize';

// "Nguồn của tôi": turning one row of the user's own food table into the
// app's FoodItem. The engine computes everything from per-100 g values
// (types/food.ts), so this module's whole job is to CONVERT the user's
// columns into that shape — never to correct their numbers. The only change
// made to the data is the carb ≥ sugar + fiber invariant every other entry
// point enforces too, and it is reported back as "adjusted".
// Research and decisions: docs/nghien-cuu/2026-10-23-nhap-kho-mon-an-tu-file.md.

export const LIBRARY_MAIN_FIELDS: LibraryField[] = [
  'name',
  'energy',
  'protein',
  'fat',
  'carb',
  'fiber',
  'sugar',
  'water',
  'servingG',
  'key',
  'category',
];

// Folded under "＋" on the mapping screen.
export const LIBRARY_EXTRA_FIELDS: LibraryField[] = [
  'nameEn',
  'nameDe',
  'salt',
  'sodium',
  'calcium',
  'iron',
  'potassium',
  'magnesium',
  'zinc',
  'epa',
  'dha',
];

export const LIBRARY_REQUIRED_FIELDS: LibraryField[] = ['name', 'energy'];

export const DEFAULT_LIBRARY_OPTIONS: LibraryImportOptions = {
  basis: 'per100g',
  energyUnit: 'kcal',
  decimal: '.',
  mineralUnit: 'mg',
};

// ---------------------------------------------------------------------------
// Guessing the mapping from the header

// Header words that only name a unit — dropped before comparing a header to
// a field's names, so "Protein (g)" and "Protein pro 100 g" both read "protein".
const UNIT_WORDS = new Set(['g', 'mg', 'mcg', 'ug', 'kcal', 'kj', 'ml', 'per', 'pro', 'je', '100', '100g', 'trong']);

// Column names per field, already folded (normalize + words joined by one
// space), in Vietnamese / English / German plus the spellings of common
// exports (USDA FoodData Central, Open Food Facts, BLS-style German tables).
const FIELD_NAMES: Record<LibraryField, string[]> = {
  name: [
    'name', 'food name', 'food', 'description', 'product name', 'product', 'ten', 'ten mon', 'mon',
    'ten mon an', 'mon an', 'thuc pham', 'ten thuc pham', 'lebensmittel', 'bezeichnung', 'produkt',
    'produktname', 'name vi', 'name_vi',
  ],
  nameEn: ['name en', 'english name', 'name english', 'ten tieng anh', 'englischer name'],
  nameDe: ['name de', 'german name', 'name german', 'ten tieng duc', 'deutscher name'],
  key: ['id', 'fdc id', 'food id', 'code', 'barcode', 'ean', 'ma', 'ma mon', 'nummer', 'schluessel', 'sbls'],
  category: [
    'category', 'food category', 'group', 'food group', 'nhom', 'loai', 'danh muc', 'nhom thuc pham',
    'kategorie', 'gruppe', 'warengruppe', 'categories',
  ],
  servingG: [
    'serving', 'serving size', 'serving g', 'portion', 'portion size', 'khau phan', 'khoi luong khau phan',
    'portionsgroesse', 'portionsgrosse', 'portion g', 'serving quantity',
  ],
  energy: [
    'energy', 'kcal', 'calories', 'calorie', 'energie', 'brennwert', 'nang luong', 'calo', 'energy kcal',
    'energy kj', 'kj',
  ],
  protein: ['protein', 'proteins', 'eiweiss', 'dam', 'chat dam', 'protein total'],
  fat: ['fat', 'total fat', 'lipid', 'total lipid', 'total lipid fat', 'fett', 'beo', 'chat beo', 'lipid fat'],
  carb: [
    'carbohydrate', 'carbohydrates', 'carbs', 'carb', 'kohlenhydrate', 'tinh bot', 'carbohydrate by difference',
    'glucid', 'bot duong', 'chat bot duong',
  ],
  fiber: ['fiber', 'fibre', 'dietary fiber', 'fiber total dietary', 'ballaststoffe', 'chat xo', 'xo'],
  sugar: ['sugar', 'sugars', 'total sugars', 'sugars total', 'zucker', 'davon zucker', 'duong'],
  water: ['water', 'moisture', 'wasser', 'nuoc', 'do am'],
  salt: ['salt', 'salz', 'muoi'],
  sodium: ['sodium', 'natri', 'natrium', 'sodium na'],
  calcium: ['calcium', 'canxi', 'kalzium', 'calcium ca'],
  iron: ['iron', 'sat', 'eisen', 'iron fe'],
  potassium: ['potassium', 'kali', 'kalium', 'potassium k'],
  magnesium: ['magnesium', 'magie', 'magnesium mg'],
  zinc: ['zinc', 'kem', 'zink', 'zinc zn'],
  epa: ['epa', '20 5 n 3 epa'],
  dha: ['dha', '22 6 n 3 dha'],
};

// Ties between equally good guesses go to the field listed first, so a lone
// "duong" header becomes sugar only if no carb header claimed it as better.
const GUESS_ORDER: LibraryField[] = [...LIBRARY_MAIN_FIELDS, ...LIBRARY_EXTRA_FIELDS];

function headerWords(header: string): string[] {
  return wordsOf(normalize(header));
}

function scoreHeader(words: string[], names: string[]): number {
  const core = words.filter((w) => !UNIT_WORDS.has(w)).join(' ');
  const all = words.join(' ');
  let best = 0;
  for (const name of names) {
    if (core === name || all === name) best = Math.max(best, 3);
    else if (core.startsWith(`${name} `) || all.startsWith(`${name} `)) best = Math.max(best, 2);
    else if (` ${all} `.includes(` ${name} `)) best = Math.max(best, 1);
  }
  return best;
}

export interface MappingGuess {
  columns: ColumnMapping;
  energyUnit: LibraryImportOptions['energyUnit'];
  mineralUnit: LibraryImportOptions['mineralUnit'];
}

// Best-effort guess from the header row: each field takes the column whose
// name matches it best, and no column is used twice. The user confirms or
// changes every choice on the mapping screen.
export function guessMapping(header: string[]): MappingGuess {
  const words = header.map(headerWords);
  const candidates: { field: LibraryField; col: number; score: number }[] = [];
  GUESS_ORDER.forEach((field) => {
    words.forEach((w, col) => {
      let score = scoreHeader(w, FIELD_NAMES[field]);
      if (score === 0) return;
      // When a table has both, prefer the kcal energy column over the kJ one.
      if (field === 'energy' && (w.includes('kcal') || w.includes('calories') || w.includes('calo'))) score += 0.5;
      candidates.push({ field, col, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score || GUESS_ORDER.indexOf(a.field) - GUESS_ORDER.indexOf(b.field));

  const columns: ColumnMapping = {};
  const usedCols = new Set<number>();
  for (const c of candidates) {
    if (columns[c.field] !== undefined || usedCols.has(c.col)) continue;
    columns[c.field] = c.col;
    usedCols.add(c.col);
  }

  const energyWords = columns.energy !== undefined ? words[columns.energy] : [];
  const energyUnit = energyWords.includes('kj') && !energyWords.includes('kcal') ? 'kj' : 'kcal';

  const mineralCols = (['sodium', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc'] as LibraryField[])
    .map((f) => columns[f])
    .filter((col): col is number => col !== undefined);
  const saysGrams = mineralCols.some((col) => words[col].includes('g') && !words[col].includes('mg'));
  const saysMg = mineralCols.some((col) => words[col].includes('mg'));
  const mineralUnit = saysGrams && !saysMg ? 'g' : 'mg';

  return { columns, energyUnit, mineralUnit };
}

// "12,5" with a comma decimal mark vs "12.5" — looks at the mapped numeric
// cells of a few sample rows. With no evidence, a ";"-separated file
// (European Excel) is assumed to use the comma.
export function guessDecimal(
  rows: LibraryCell[][],
  columns: ColumnMapping,
  delimiter: string
): LibraryImportOptions['decimal'] {
  const numericCols = Object.entries(columns)
    .filter(([field]) => !['name', 'nameEn', 'nameDe', 'key', 'category'].includes(field))
    .map(([, col]) => col as number);
  let comma = 0;
  let dot = 0;
  for (const row of rows) {
    for (const col of numericCols) {
      const cell = row[col];
      if (typeof cell !== 'string') continue; // a spreadsheet number has no decimal mark to guess
      const v = cell.trim();
      if (/^-?\d+,\d+$/.test(v)) comma++;
      else if (/^-?\d+\.\d+$/.test(v)) dot++;
    }
  }
  if (comma > dot) return ',';
  if (dot > comma) return '.';
  return delimiter === ';' ? ',' : '.';
}

// ---------------------------------------------------------------------------
// Numbers

// A table cell → number, or null when there is no value. Tolerates what
// nutrition tables really contain: thousands separators, a unit after the
// number ("12 g"), "<0.1", and markers for "no value" ("-", "n/a", "tr").
// A number cell (from a spreadsheet) is taken as it is.
export function parseLibraryNumber(raw: LibraryCell | undefined, decimal: LibraryImportOptions['decimal']): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let v = (raw ?? '').trim().replace(/[\s ]/g, '');
  if (v === '') return null;
  v = v.replace(/^[<>~≈]+/, '');
  v = decimal === ',' ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  const m = /^-?\d*\.?\d+(e-?\d+)?/i.exec(v);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// Ids

// Short, stable hash of a string (djb2, base 36).
function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export const LIBRARY_ID_PREFIX = 'lib_';

// lib_<sourceId>_<readable part>-<hash>. Built from the row's own id column
// when the file has one, else from the name — so importing a newer version
// of the same file gives every food the SAME id again, and meals already
// logged keep resolving to it. sourceId must not contain "_".
export function libraryFoodId(sourceId: string, key: string): string {
  const trimmed = key.trim();
  const readable = wordsOf(normalize(trimmed)).join('-').slice(0, 40);
  return `${LIBRARY_ID_PREFIX}${sourceId}_${readable ? `${readable}-` : ''}${hashKey(trimmed)}`;
}

// The source a library food id belongs to, or null for any other food.
export function librarySourceIdOf(foodId: string): string | null {
  if (!foodId.startsWith(LIBRARY_ID_PREFIX)) return null;
  const end = foodId.indexOf('_', LIBRARY_ID_PREFIX.length);
  return end > LIBRARY_ID_PREFIX.length ? foodId.slice(LIBRARY_ID_PREFIX.length, end) : null;
}

// ---------------------------------------------------------------------------
// Row → FoodItem

export type LibraryRowIssue = 'missingName' | 'missingEnergy' | 'negative' | 'missingServing';

export type LibraryRowResult =
  | { ok: true; item: FoodItem; adjusted: boolean }
  | { ok: false; issue: LibraryRowIssue };

const MINERAL_FIELDS = ['sodium', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc', 'epa', 'dha'] as const;

// Grams of salt → mg of sodium (salt is 40 % sodium by weight).
const SODIUM_MG_PER_G_SALT = 400;
const KJ_PER_KCAL = 4.184;

export function libraryRowToFood(
  cells: LibraryCell[],
  columns: ColumnMapping,
  options: LibraryImportOptions,
  sourceId: string
): LibraryRowResult {
  const text = (field: LibraryField) => {
    const col = columns[field];
    return col === undefined ? '' : String(cells[col] ?? '').trim();
  };
  const num = (field: LibraryField) => (columns[field] === undefined ? null : parseLibraryNumber(cells[columns[field]!], options.decimal));

  const name = text('name');
  if (!name) return { ok: false, issue: 'missingName' };

  const energyRaw = num('energy');
  if (energyRaw === null) return { ok: false, issue: 'missingEnergy' };

  const servingG = num('servingG');
  let factor = 1;
  if (options.basis === 'perServing') {
    if (servingG === null || servingG <= 0) return { ok: false, issue: 'missingServing' };
    factor = 100 / servingG;
  }

  const raw: Record<string, number | null> = {
    energy: energyRaw,
    protein: num('protein'),
    fat: num('fat'),
    carb: num('carb'),
    fiber: num('fiber'),
    sugar: num('sugar'),
    water: num('water'),
    salt: num('salt'),
  };
  for (const f of MINERAL_FIELDS) raw[f] = num(f);
  if (Object.values(raw).some((v) => v !== null && v < 0) || (servingG !== null && servingG < 0)) {
    return { ok: false, issue: 'negative' };
  }

  const per100 = (v: number | null) => round3((v ?? 0) * factor);
  const mineral = (v: number | null) => per100(v === null ? null : options.mineralUnit === 'g' ? v * 1000 : v);

  const energyKcal = options.energyUnit === 'kj' ? energyRaw / KJ_PER_KCAL : energyRaw;
  const fiberG = per100(raw.fiber);
  const sugarG = per100(raw.sugar);
  const typedCarb = per100(raw.carb);
  const carbG = Math.max(typedCarb, round3(sugarG + fiberG));
  const sodiumMg =
    raw.sodium !== null ? mineral(raw.sodium) : per100(raw.salt === null ? null : raw.salt * SODIUM_MG_PER_G_SALT);

  const per100g: Nutrition = {
    energyKcal: per100(energyKcal),
    waterG: per100(raw.water),
    proteinG: per100(raw.protein),
    fatG: per100(raw.fat),
    carbG,
    fiberG,
    sugarG,
    calciumMg: mineral(raw.calcium),
    ironMg: mineral(raw.iron),
    sodiumMg,
    potassiumMg: mineral(raw.potassium),
    magnesiumMg: mineral(raw.magnesium),
    zincMg: mineral(raw.zinc),
    ...(raw.epa !== null ? { epaMg: mineral(raw.epa) } : {}),
    ...(raw.dha !== null ? { dhaMg: mineral(raw.dha) } : {}),
  };

  const item: FoodItem = {
    id: libraryFoodId(sourceId, text('key') || name),
    nameVi: name,
    nameEn: text('nameEn'),
    nameDe: text('nameDe'),
    category: text('category'),
    defaultServingG: servingG !== null && servingG > 0 ? round3(servingG) : 100,
    servingPresets: [],
    per100g,
    source: 'library',
    note: '',
  };
  return { ok: true, item, adjusted: carbG > typedCarb };
}

// ---------------------------------------------------------------------------
// File size

// Choices for "ask me above …" (Settings in the import panel). The owner's
// decision (2026-10-23): 10 MB by default, a few hundred MB at most, never GB.
export const LIBRARY_LIMIT_OPTIONS_MB = [10, 50, 100, 300, 500] as const;
export const DEFAULT_LIBRARY_LIMIT_MB = 10;
export const LIBRARY_HARD_MAX_MB = 500;
// An .xlsx is unzipped and read whole into memory (SheetJS has no streaming
// read), so it gets a much lower ceiling than a streamed CSV. 💡 A guess to
// confirm on the phone; bigger sheets can still go in as CSV.
export const LIBRARY_XLSX_HARD_MAX_MB = 30;

const MB = 1024 * 1024;

export function libraryHardMaxMb(kind: 'csv' | 'xlsx'): number {
  return kind === 'xlsx' ? LIBRARY_XLSX_HARD_MAX_MB : LIBRARY_HARD_MAX_MB;
}

export function librarySizeCheck(sizeBytes: number, limitMb: number, kind: 'csv' | 'xlsx' = 'csv'): 'ok' | 'ask' | 'tooBig' {
  if (sizeBytes > libraryHardMaxMb(kind) * MB) return 'tooBig';
  if (sizeBytes > limitMb * MB) return 'ask';
  return 'ok';
}

// Rough row count for a whole file from how many bytes the sample's records
// took — shown before importing ("≈ 48 000 món").
export function estimateRowCount(sizeBytes: number, sampleBytes: number, sampleRecords: number): number {
  if (sampleRecords <= 0 || sampleBytes <= 0) return 0;
  return Math.max(0, Math.round((sizeBytes / sampleBytes) * sampleRecords) - 1);
}

export function bytesToMb(sizeBytes: number): number {
  return Math.round((sizeBytes / MB) * 10) / 10;
}

// CSV-like text (.csv / .tsv / .txt) is streamed; a spreadsheet is read with
// SheetJS 0.20.3 from the SheetJS CDN (the npm build 0.18.5 has read-side
// CVEs — see the research report).
export function libraryFileKind(fileName: string): 'csv' | 'xlsx' | 'other' {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return 'csv';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') return 'xlsx';
  return 'other';
}

// ---------------------------------------------------------------------------
// Re-import ("↻ cập nhật nguồn")

function headerKey(h: string): string {
  return wordsOf(normalize(h)).join(' ');
}

// Carries a source's saved mapping over to a newer version of its file:
// each field goes to the column whose header reads the same (accents, case
// and punctuation aside), wherever it moved to. A field whose column is gone
// stays unmapped and the mapping screen shows it, so the user decides.
export function remapColumns(saved: LibraryMappingConfig, header: string[]): ColumnMapping {
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const k = headerKey(h);
    if (k && !index.has(k)) index.set(k, i);
  });
  const columns: ColumnMapping = {};
  for (const [field, col] of Object.entries(saved.columns) as [LibraryField, number][]) {
    const name = saved.header[col];
    const found = name === undefined ? undefined : index.get(headerKey(name));
    if (found !== undefined) columns[field] = found;
  }
  return columns;
}

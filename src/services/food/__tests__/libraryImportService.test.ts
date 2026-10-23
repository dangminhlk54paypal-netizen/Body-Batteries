import { utils, write } from 'xlsx';
import { importLibraryFile, readLibraryPreview } from '../libraryImportService';
import { getLibrarySources, resetLibraryRegistry } from '../../../data/food/libraryFoodRegistry';
import { DEFAULT_LIBRARY_OPTIONS } from '../../../domain/food/library/libraryMapping';
import type { FoodItem } from '../../../types/food';
import type { LibraryMappingConfig, LibrarySource } from '../../../types/foodLibrary';

// In-memory "files": uri → bytes. The handle hands them out a few bytes at a
// time (readBytes may return fewer bytes than asked), so every chunk-boundary
// case of the streaming readers is exercised end to end.
const mockFiles = new Map<string, Uint8Array>();
jest.mock('expo-file-system', () => ({
  FileMode: { ReadOnly: 'r' },
  File: class {
    mockUri: string;
    constructor(mockUri: string) {
      this.mockUri = mockUri;
    }
    get size() {
      return mockFiles.get(this.mockUri)?.length ?? 0;
    }
    open() {
      const bytes = mockFiles.get(this.mockUri) ?? new Uint8Array(0);
      let offset = 0;
      return {
        readBytes: async (length: number) => {
          const n = Math.min(length, 7);
          const chunk = bytes.slice(offset, offset + n);
          offset += chunk.length;
          return chunk;
        },
        close: () => undefined,
      };
    }
  },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const mockDb = { sources: new Map<string, LibrarySource>(), foods: new Map<string, FoodItem & { sourceId: string }>() };
jest.mock('../../../data/repositories/libraryFoodsRepository', () => ({
  upsertLibrarySource: async (s: LibrarySource) => {
    mockDb.sources.set(s.id, s);
  },
  insertLibraryFoods: async (sourceId: string, items: FoodItem[]) => {
    for (const item of items) mockDb.foods.set(item.id, { ...item, sourceId });
  },
  countLibraryFoods: async (sourceId: string) => [...mockDb.foods.values()].filter((f) => f.sourceId === sourceId).length,
  deleteLibrarySource: async (id: string) => {
    mockDb.sources.delete(id);
    for (const [k, f] of mockDb.foods) if (f.sourceId === id) mockDb.foods.delete(k);
  },
  // Mirrors the SQL: drop the target's rows, re-key the temp rows to it.
  replaceLibrarySourceFoods: async (targetId: string, fromId: string) => {
    for (const [k, f] of mockDb.foods) if (f.sourceId === targetId) mockDb.foods.delete(k);
    for (const [k, f] of [...mockDb.foods]) {
      if (f.sourceId !== fromId) continue;
      mockDb.foods.delete(k);
      const id = `lib_${targetId}${k.slice(`lib_${fromId}`.length)}`;
      mockDb.foods.set(id, { ...f, id, sourceId: targetId });
    }
    mockDb.sources.delete(fromId);
  },
  getLoggedLibraryFoods: async () => [],
}));

function addBytes(uri: string, bytes: Uint8Array) {
  mockFiles.set(uri, bytes);
  return { uri, name: uri.split('/').pop()!, size: bytes.length };
}

function addFile(uri: string, text: string) {
  return addBytes(uri, new Uint8Array(Buffer.from(text, 'utf8')));
}

function addWorkbook(uri: string, sheets: Record<string, unknown[][]>) {
  const wb = utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) utils.book_append_sheet(wb, utils.aoa_to_sheet(aoa), name);
  return addBytes(uri, new Uint8Array(write(wb, { type: 'array', bookType: 'xlsx' })));
}

const CSV =
  'Lebensmittel;Energie (kcal);Eiweiß;Fett;Kohlenhydrate;davon Zucker;Ballaststoffe\n' +
  'Magerquark;67;12,6;0,2;4;4;0\n' +
  '"Brötchen; Weizen";270;9;1,5;55;2;3\n' +
  ';100;1;1;1;1;1\n' +
  'Datteln;280;2;0,4;60;63;8\n' +
  'Magerquark;68;12,7;0,2;4;4;0\n';

const MAPPING: LibraryMappingConfig = {
  delimiter: ';',
  header: [],
  columns: { name: 0, energy: 1, protein: 2, fat: 3, carb: 4, sugar: 5, fiber: 6 },
  options: { ...DEFAULT_LIBRARY_OPTIONS, decimal: ',' },
};

beforeEach(() => {
  mockFiles.clear();
  mockDb.sources.clear();
  mockDb.foods.clear();
  resetLibraryRegistry();
});

describe('readLibraryPreview', () => {
  it('detects the separator, guesses the columns and the comma decimal mark', async () => {
    const preview = await readLibraryPreview(addFile('cache/bls.csv', CSV));
    expect(preview).not.toBeNull();
    expect(preview!.delimiter).toBe(';');
    expect(preview!.header[0]).toBe('Lebensmittel');
    expect(preview!.sampleRows).toHaveLength(5);
    expect(preview!.guess.columns).toEqual(MAPPING.columns);
    expect(preview!.decimal).toBe(',');
    expect(preview!.estimatedRows).toBe(5);
  });

  it('returns null for an empty file', async () => {
    expect(await readLibraryPreview(addFile('cache/empty.csv', ''))).toBeNull();
  });
});

describe('importLibraryFile', () => {
  it('streams the rows in, counts what it skipped, and switches the source on at the end', async () => {
    const file = addFile('cache/bls.csv', CSV);
    const progress: number[] = [];
    const result = await importLibraryFile({
      file,
      sourceName: ' BLS ',
      mapping: MAPPING,
      onProgress: (p) => progress.push(p.bytesRead),
    });
    if (result === 'cancelled') throw new Error('unexpected cancel');

    // Magerquark twice in the file → one food (same id), the later row wins.
    expect(result.stored).toBe(3);
    expect(result.skipped).toEqual({ missingName: 1, missingEnergy: 0, negative: 0, missingServing: 0 });
    expect(result.adjusted).toBe(1); // Datteln: carb 60 < sugar 63 + fibre 8
    expect(result.source).toMatchObject({ name: 'BLS', fileName: 'bls.csv', enabled: true, foodCount: 3 });
    expect(mockDb.sources.get(result.source.id)?.enabled).toBe(true);
    expect(getLibrarySources().map((s) => s.id)).toEqual([result.source.id]);

    const names = [...mockDb.foods.values()].map((f) => f.nameVi).sort();
    expect(names).toEqual(['Brötchen; Weizen', 'Datteln', 'Magerquark']);
    const quark = [...mockDb.foods.values()].find((f) => f.nameVi === 'Magerquark')!;
    expect(quark.per100g.proteinG).toBe(12.7);
    expect(progress[progress.length - 1]).toBe(file.size);
  });

  it('removes everything written so far when cancelled', async () => {
    const file = addFile('cache/bls.csv', CSV);
    let calls = 0;
    const result = await importLibraryFile({ file, sourceName: 'x', mapping: MAPPING, isCancelled: () => ++calls > 3 });
    expect(result).toBe('cancelled');
    expect(mockDb.sources.size).toBe(0);
    expect(mockDb.foods.size).toBe(0);
    expect(getLibrarySources()).toEqual([]);
  });

  it('keeps no source when not a single row could be imported', async () => {
    const file = addFile('cache/bad.csv', 'Name;kcal\n;1\nApfel;\n');
    const result = await importLibraryFile({ file, sourceName: 'x', mapping: { ...MAPPING, columns: { name: 0, energy: 1 } } });
    if (result === 'cancelled') throw new Error('unexpected cancel');
    expect(result.stored).toBe(0);
    expect(result.skipped.missingName + result.skipped.missingEnergy).toBe(2);
    expect(mockDb.sources.size).toBe(0);
    expect(getLibrarySources()).toEqual([]);
  });
});

describe('spreadsheets', () => {
  const sheets = {
    Info: [['Diese Tabelle …']],
    Lebensmittel: [
      ['Name', 'Energie (kcal)', 'Eiweiß', 'Fett'],
      ['Magerquark', 67, 12.6, 0.2],
      ['Apfel', 52, 0.3, 0.2],
    ],
  };

  it('previews a chosen worksheet of an .xlsx', async () => {
    const file = addWorkbook('cache/tabelle.xlsx', sheets);
    const first = await readLibraryPreview(file);
    expect(first).toMatchObject({ format: 'xlsx', sheetNames: ['Info', 'Lebensmittel'], sheetName: 'Info' });
    const preview = await readLibraryPreview(file, 'Lebensmittel');
    expect(preview).toMatchObject({ sheetName: 'Lebensmittel', estimatedRows: 2, decimal: '.' });
    expect(preview!.guess.columns).toEqual({ name: 0, energy: 1, protein: 2, fat: 3 });
  });

  it('imports the rows of that worksheet', async () => {
    const file = addWorkbook('cache/tabelle.xlsx', sheets);
    const result = await importLibraryFile({
      file,
      sourceName: 'Tabelle',
      mapping: {
        format: 'xlsx',
        sheetName: 'Lebensmittel',
        delimiter: ',',
        header: sheets.Lebensmittel[0] as string[],
        columns: { name: 0, energy: 1, protein: 2, fat: 3 },
        options: DEFAULT_LIBRARY_OPTIONS,
      },
    });
    if (result === 'cancelled') throw new Error('unexpected cancel');
    expect(result.stored).toBe(2);
    expect([...mockDb.foods.values()].map((f) => f.per100g.proteinG).sort()).toEqual([0.3, 12.6]);
  });
});

describe('updating a source (↻)', () => {
  const MAP2: LibraryMappingConfig = { ...MAPPING, columns: { name: 0, energy: 1, protein: 2 } };

  async function importFirst() {
    const first = await importLibraryFile({
      file: addFile('cache/v1.csv', 'Name;kcal;Eiweiß\nQuark;67;12\nApfel;52;0,3\n'),
      sourceName: 'Meine',
      mapping: MAP2,
    });
    if (first === 'cancelled') throw new Error('unexpected cancel');
    return first.source;
  }

  it('replaces the rows in the same source, keeping ids of foods still in the file', async () => {
    const before = await importFirst();
    const quarkId = [...mockDb.foods.values()].find((f) => f.nameVi === 'Quark')!.id;

    const result = await importLibraryFile({
      file: addFile('cache/v2.csv', 'Name;kcal;Eiweiß\nQuark;68;12,7\nBirne;57;0,4\n'),
      sourceName: 'Meine',
      mapping: MAP2,
      replace: before,
    });
    if (result === 'cancelled') throw new Error('unexpected cancel');

    expect(result.previousCount).toBe(2);
    expect(result.stored).toBe(2);
    expect(result.source).toMatchObject({ id: before.id, enabled: true, fileName: 'v2.csv', foodCount: 2, createdAt: before.createdAt });
    expect([...mockDb.sources.keys()]).toEqual([before.id]);
    const foods = [...mockDb.foods.values()];
    expect(foods.every((f) => f.sourceId === before.id && f.id.startsWith(`lib_${before.id}_`))).toBe(true);
    expect(foods.map((f) => f.nameVi).sort()).toEqual(['Birne', 'Quark']); // Apfel is gone
    const quark = mockDb.foods.get(quarkId)!;
    expect(quark.per100g.proteinG).toBe(12.7);
    expect(getLibrarySources()).toEqual([result.source]);
  });

  it('leaves the source untouched when the update is cancelled or yields nothing', async () => {
    const before = await importFirst();
    const snapshot = [...mockDb.foods.keys()].sort();

    const cancelled = await importLibraryFile({
      file: addFile('cache/v2.csv', 'Name;kcal;Eiweiß\nBirne;57;0,4\n'),
      sourceName: 'Meine',
      mapping: MAP2,
      replace: before,
      isCancelled: () => true,
    });
    expect(cancelled).toBe('cancelled');

    const empty = await importLibraryFile({
      file: addFile('cache/v3.csv', 'Name;kcal;Eiweiß\n;57;0,4\n'),
      sourceName: 'Meine',
      mapping: MAP2,
      replace: before,
    });
    expect(empty !== 'cancelled' && empty.stored).toBe(0);
    expect([...mockDb.sources.keys()]).toEqual([before.id]);
    expect([...mockDb.foods.keys()].sort()).toEqual(snapshot);
  });
});

import * as DocumentPicker from 'expo-document-picker';
import { File, FileMode, type FileHandle } from 'expo-file-system';
import type { FoodItem } from '../../types/food';
import type { LibraryCell, LibraryMappingConfig, LibrarySource } from '../../types/foodLibrary';
import { createCsvRecordReader, createUtf8Decoder, detectDelimiter, type CsvDelimiter } from '../../domain/food/library/libraryCsv';
import {
  estimateRowCount,
  guessDecimal,
  guessMapping,
  libraryFileKind,
  libraryRowToFood,
  type LibraryRowIssue,
  type MappingGuess,
} from '../../domain/food/library/libraryMapping';
import { registerLibrarySource, refreshLibrarySourceInRegistry } from '../../data/food/libraryFoodRegistry';
import { readSpreadsheetTable } from './libraryXlsx';

// "Nguồn của tôi" import: pick a file, peek at it to guess the columns, then
// write it into SQLite. A CSV can be a few hundred MB, so it is never read
// whole: FileHandle.readBytes in a loop (Expo SDK 58 FileSystem docs). A
// spreadsheet has to be read whole (SheetJS) and is capped lower. The pure
// parts (UTF-8, CSV, column guess, row conversion) live in
// domain/food/library/, the spreadsheet reading in libraryXlsx.ts.

export interface PickedLibraryFile {
  uri: string;
  name: string;
  size: number;
}

// The system file picker. Any type is allowed: iOS greys out ".csv" for
// some MIME filters, so the extension is checked afterwards instead
// (libraryFileKind). The picked file is copied to the app cache.
export async function pickLibraryFile(): Promise<PickedLibraryFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, size: asset.size ?? new File(asset.uri).size };
}

export interface LibraryPreview {
  format: 'csv' | 'xlsx';
  delimiter: CsvDelimiter;
  // Worksheets of a spreadsheet ([] for a CSV) and the one previewed.
  sheetNames: string[];
  sheetName?: string;
  header: string[];
  sampleRows: LibraryCell[][];
  guess: MappingGuess;
  decimal: '.' | ',';
  estimatedRows: number;
}

const PREVIEW_BYTES = 256 * 1024;
const PREVIEW_SAMPLE_ROWS = 20;

// Reads up to `limit` bytes from the handle's offset. readBytes may return
// fewer bytes than asked, so it loops until `limit` or until a read comes
// back empty (end of file → `ended`).
async function readUpTo(handle: FileHandle, limit: number): Promise<{ bytes: Uint8Array; ended: boolean }> {
  const parts: Uint8Array[] = [];
  let total = 0;
  let ended = false;
  while (total < limit) {
    const part = await handle.readBytes(Math.min(limit - total, CHUNK_BYTES));
    if (part.length === 0) {
      ended = true;
      break;
    }
    parts.push(part);
    total += part.length;
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return { bytes, ended };
}

async function readWholeFile(uri: string): Promise<Uint8Array> {
  const handle = new File(uri).open(FileMode.ReadOnly);
  try {
    return (await readUpTo(handle, Number.MAX_SAFE_INTEGER)).bytes;
  } finally {
    handle.close();
  }
}

function previewFromTable(
  format: 'csv' | 'xlsx',
  delimiter: CsvDelimiter,
  header: string[],
  sampleRows: LibraryCell[][],
  estimatedRows: number,
  sheets: { sheetNames: string[]; sheetName?: string } = { sheetNames: [] }
): LibraryPreview {
  const guess = guessMapping(header);
  return {
    format,
    delimiter,
    ...sheets,
    header,
    sampleRows,
    guess,
    decimal: guessDecimal(sampleRows, guess.columns, delimiter),
    estimatedRows,
  };
}

// For a CSV only the first 256 KB is read: enough for the header and a
// sample to guess the mapping from and to preview with. A spreadsheet is
// read whole (`sheetName` picks the worksheet). null = nothing readable.
export async function readLibraryPreview(file: PickedLibraryFile, sheetName?: string): Promise<LibraryPreview | null> {
  if (libraryFileKind(file.name) === 'xlsx') {
    const table = readSpreadsheetTable(await readWholeFile(file.uri), sheetName);
    if (!table) return null;
    return previewFromTable('xlsx', ',', table.header, table.rows.slice(0, PREVIEW_SAMPLE_ROWS), table.rows.length, {
      sheetNames: table.sheetNames,
      sheetName: table.sheetName,
    });
  }

  const handle = new File(file.uri).open(FileMode.ReadOnly);
  try {
    const { bytes, ended } = await readUpTo(handle, PREVIEW_BYTES);
    const decoder = createUtf8Decoder();
    const text = decoder.decode(bytes) + (ended ? decoder.flush() : '');
    const delimiter = detectDelimiter(text);
    const reader = createCsvRecordReader(delimiter);
    const records = [...reader.push(text), ...(ended ? reader.end() : [])];
    if (records.length === 0) return null;
    return previewFromTable(
      'csv',
      delimiter,
      records[0].map((h) => h.trim()),
      records.slice(1, 1 + PREVIEW_SAMPLE_ROWS),
      ended ? records.length - 1 : estimateRowCount(file.size, bytes.length, records.length)
    );
  } finally {
    handle.close();
  }
}

export interface LibraryImportProgress {
  bytesRead: number;
  totalBytes: number;
  rows: number;
}

export interface LibraryImportSummary {
  source: LibrarySource;
  // Distinct foods now in the source (a key repeated in the file counts once).
  stored: number;
  // For an update: how many foods the source had before.
  previousCount?: number;
  skipped: Record<LibraryRowIssue, number>;
  // Rows whose carb was raised to sugar + fiber (the app-wide invariant).
  adjusted: number;
}

const CHUNK_BYTES = 1024 * 1024;
const BATCH_ROWS = 500;
// A spreadsheet's rows are already in memory; report progress every so often.
const XLSX_PROGRESS_EVERY = 2000;

// Base-36 time + random: short, unique enough on one device, and free of
// "_" (it sits inside every food id, lib_<id>_<key>).
function newSourceId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Writes the file into a new source. That source stays switched off while
// rows are written, so search never shows a half-imported table; on cancel or
// error everything written so far is removed again.
//
// `replace` = "↻ cập nhật nguồn": the new version goes into a temporary
// source first, and only when it is complete do its rows take over the old
// source's id in one transaction (replaceLibrarySourceFoods). Until then the
// old source stays searchable as it was; a cancel leaves it untouched. Same
// key in the file → same food id, so logged meals and the user's corrections
// (overrides) keep pointing at it; foods missing from the new file are gone.
export async function importLibraryFile(request: {
  file: PickedLibraryFile;
  sourceName: string;
  mapping: LibraryMappingConfig;
  replace?: LibrarySource;
  onProgress?: (progress: LibraryImportProgress) => void;
  isCancelled?: () => boolean;
}): Promise<LibraryImportSummary | 'cancelled'> {
  const { file, mapping, replace } = request;
  // Lazy, like libraryFoodRegistry.ts: expo-sqlite loads only once an import runs.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const repo: typeof import('../../data/repositories/libraryFoodsRepository') = require('../../data/repositories/libraryFoodsRepository');
  const now = Date.now();
  const name = request.sourceName.trim() || file.name;
  const target: LibrarySource = {
    id: newSourceId(),
    name,
    fileName: file.name,
    enabled: false,
    foodCount: 0,
    mapping,
    createdAt: now,
    updatedAt: now,
  };
  await repo.upsertLibrarySource(target);

  const skipped: Record<LibraryRowIssue, number> = { missingName: 0, missingEnergy: 0, negative: 0, missingServing: 0 };
  let adjusted = 0;
  let rows = 0;
  let batch: FoodItem[] = [];

  const takeRows = async (records: LibraryCell[][]) => {
    for (const cells of records) {
      rows++;
      const result = libraryRowToFood(cells, mapping.columns, mapping.options, target.id);
      if (!result.ok) {
        skipped[result.issue]++;
        continue;
      }
      if (result.adjusted) adjusted++;
      batch.push(result.item);
      if (batch.length >= BATCH_ROWS) {
        await repo.insertLibraryFoods(target.id, batch);
        batch = [];
      }
    }
  };

  const discard = async () => {
    await repo.deleteLibrarySource(target.id).catch(() => undefined);
  };

  try {
    if (mapping.format === 'xlsx') {
      const table = readSpreadsheetTable(await readWholeFile(file.uri), mapping.sheetName);
      const all = table?.rows ?? [];
      for (let i = 0; i < all.length; i += XLSX_PROGRESS_EVERY) {
        if (request.isCancelled?.()) {
          await discard();
          return 'cancelled';
        }
        await takeRows(all.slice(i, i + XLSX_PROGRESS_EVERY));
        const done = Math.min(all.length, i + XLSX_PROGRESS_EVERY);
        request.onProgress?.({ bytesRead: Math.round((file.size * done) / all.length), totalBytes: file.size, rows });
      }
    } else {
      const handle = new File(file.uri).open(FileMode.ReadOnly);
      try {
        const decoder = createUtf8Decoder();
        const reader = createCsvRecordReader(mapping.delimiter);
        let headerSeen = false;
        const takeRecords = async (records: string[][]) => {
          if (!headerSeen && records.length > 0) {
            headerSeen = true;
            records = records.slice(1);
          }
          await takeRows(records);
        };
        let bytesRead = 0;
        for (;;) {
          if (request.isCancelled?.()) {
            await discard();
            return 'cancelled';
          }
          const bytes = await handle.readBytes(CHUNK_BYTES);
          if (bytes.length === 0) break;
          bytesRead += bytes.length;
          await takeRecords(reader.push(decoder.decode(bytes)));
          request.onProgress?.({ bytesRead, totalBytes: file.size, rows });
        }
        await takeRecords(reader.push(decoder.flush()));
        await takeRecords(reader.end());
      } finally {
        handle.close();
      }
    }
    await repo.insertLibraryFoods(target.id, batch);
  } catch (e) {
    await discard();
    throw e;
  }

  const stored = await repo.countLibraryFoods(target.id);
  if (stored === 0) {
    // Nothing usable: drop the new rows; an updated source stays as it was.
    await discard();
    return { source: replace ?? { ...target, foodCount: 0 }, stored, previousCount: replace?.foodCount, skipped, adjusted };
  }

  if (replace) {
    await repo.replaceLibrarySourceFoods(replace.id, target.id);
    const updated: LibrarySource = {
      ...replace,
      name,
      fileName: file.name,
      foodCount: stored,
      mapping,
      updatedAt: Date.now(),
    };
    await repo.upsertLibrarySource(updated);
    await refreshLibrarySourceInRegistry(updated);
    return { source: updated, stored, previousCount: replace.foodCount, skipped, adjusted };
  }

  const finished: LibrarySource = { ...target, enabled: true, foodCount: stored, updatedAt: Date.now() };
  await repo.upsertLibrarySource(finished);
  registerLibrarySource(finished);
  return { source: finished, stored, skipped, adjusted };
}

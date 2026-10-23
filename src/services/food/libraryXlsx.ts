import { read, utils } from 'xlsx';
import type { LibraryCell } from '../../types/foodLibrary';

// "Nguồn của tôi" from a spreadsheet (.xlsx / .xls / .ods). SheetJS 0.20.3,
// installed from the SheetJS CDN — the npm registry stops at 0.18.5, which
// has read-side CVEs (prototype pollution, ReDoS); see
// docs/nghien-cuu/2026-10-23-nhap-kho-mon-an-tu-file.md. SheetJS reads the
// whole workbook into memory (no streaming read), which is why .xlsx files
// get a lower size ceiling than CSV (LIBRARY_XLSX_HARD_MAX_MB).

export interface SpreadsheetTable {
  sheetNames: string[];
  sheetName: string;
  // The first non-empty row.
  header: string[];
  // Every row after the header; a number cell stays a number.
  rows: LibraryCell[][];
}

function toCell(v: unknown): LibraryCell {
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (v === null || v === undefined) return '';
  return String(v);
}

// The table of one worksheet (the first one unless `sheetName` names
// another), or null when the workbook has no non-empty sheet row.
export function readSpreadsheetTable(bytes: Uint8Array, sheetName?: string): SpreadsheetTable | null {
  const workbook = read(bytes, { type: 'array', dense: true, cellDates: false, cellFormula: false, cellHTML: false });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) return null;
  const name = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const aoa = utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
  const rows = aoa.map((r) => r.map(toCell));
  const headerAt = rows.findIndex((r) => r.some((c) => String(c).trim() !== ''));
  if (headerAt === -1) return null;
  return {
    sheetNames,
    sheetName: name,
    header: rows[headerAt].map((c) => String(c).trim()),
    rows: rows.slice(headerAt + 1),
  };
}

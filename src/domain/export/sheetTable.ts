import type { Language } from '../../i18n/types';

// A worksheet as plain data — columns + rows of typed cells — so every sheet
// of the export is built (and unit-tested) without touching `xlsx`. The
// service layer (xlsxWriteUtils.tableToSheet) turns it into a real sheet.
//
// The rules every data sheet follows, so the user can sort / filter / pivot
// the file later without cleaning it first:
//   - one header row, then one record per row — no blank or note rows inside;
//   - a date is a real Excel date, a time a real time (never "21-Sep-2026"
//     text, which sorts alphabetically);
//   - a number is a bare number, its unit lives in the header ("Đạm (g)");
//   - an unknown value is an empty cell, never 0.

export interface DateCell {
  kind: 'date';
  date: string; // YYYY-MM-DD
}

export interface TimeCell {
  kind: 'time';
  hours: number;
  minutes: number;
}

export type SheetValue = string | number | null | DateCell | TimeCell;

export interface SheetTable {
  name: string;
  columns: string[];
  rows: SheetValue[][];
}

export function dateCell(date: string): DateCell {
  return { kind: 'date', date };
}

// Local wall-clock time of a timestamp (the time the user saw in the app).
export function timeCell(timestamp: number): TimeCell {
  const d = new Date(timestamp);
  return { kind: 'time', hours: d.getHours(), minutes: d.getMinutes() };
}

// How dates are shown in the file, per export language. The cell holds a
// real date either way, so Excel can re-format it in one click.
export const EXCEL_DATE_FORMATS: Record<Language, string> = {
  vi: 'dd/mm/yyyy',
  en: 'yyyy-mm-dd',
  de: 'dd.mm.yyyy',
};
export const EXCEL_TIME_FORMAT = 'hh:mm';

// Excel's day number: days since 1899-12-30 (the "1900 system" with its
// historic leap-year quirk already folded in for every date after 1900-03-01).
export function excelSerialDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

export function excelSerialTime(cell: TimeCell): number {
  return (cell.hours * 60 + cell.minutes) / 1440;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Test helper / debugging aid: rows as { header: value } objects.
export function tableAsObjects(table: SheetTable): Record<string, SheetValue>[] {
  return table.rows.map((row) => Object.fromEntries(table.columns.map((c, i) => [c, row[i] ?? null])));
}

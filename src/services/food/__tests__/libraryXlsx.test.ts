import { utils, write } from 'xlsx';
import { readSpreadsheetTable } from '../libraryXlsx';

function workbook(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) utils.book_append_sheet(wb, utils.aoa_to_sheet(aoa), name);
  return new Uint8Array(write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('readSpreadsheetTable', () => {
  it('reads the first sheet, keeping number cells as numbers', () => {
    const bytes = workbook({
      Foods: [
        ['Name', 'kcal', 'Protein'],
        ['Quark', 67, 12.6],
        ['Brötchen', 270, '9'],
      ],
      Notes: [['hello']],
    });
    const table = readSpreadsheetTable(bytes);
    expect(table).toEqual({
      sheetNames: ['Foods', 'Notes'],
      sheetName: 'Foods',
      header: ['Name', 'kcal', 'Protein'],
      rows: [
        ['Quark', 67, 12.6],
        ['Brötchen', 270, '9'],
      ],
    });
  });

  it('reads the sheet asked for, skips leading blank rows, and fills empty cells', () => {
    const bytes = workbook({ A: [['x']], B: [[], ['Name', 'kcal', 'Fett'], ['Apfel', 52]] });
    const table = readSpreadsheetTable(bytes, 'B');
    expect(table?.sheetName).toBe('B');
    expect(table?.header).toEqual(['Name', 'kcal', 'Fett']);
    expect(table?.rows).toEqual([['Apfel', 52, '']]);
  });

  it('falls back to the first sheet for an unknown name and returns null for an empty sheet', () => {
    expect(readSpreadsheetTable(workbook({ A: [['Name']] }), 'Gone')?.sheetName).toBe('A');
    expect(readSpreadsheetTable(workbook({ A: [] }))).toBeNull();
  });
});

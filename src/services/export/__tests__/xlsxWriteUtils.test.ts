import { utils, read } from 'xlsx';
import { unzipSync, strFromU8 } from 'fflate';
import { workbookToBase64WithFrozenHeaders } from '../xlsxWriteUtils';
import type { StyledCell } from '../xlsxWriteUtils';

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function buildBase64(styledCells: StyledCell[]) {
  const ws = utils.aoa_to_sheet([
    ['Title', ''],
    ['Header A', 'Header B'],
    ['data', 'data'],
  ]);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  return workbookToBase64WithFrozenHeaders(wb, styledCells);
}

// The free `xlsx` build silently drops any `cell.s` set before write() (no
// public API for custom fonts/bold), so workbookToBase64WithFrozenHeaders
// patches styles.xml + the sheet XML directly after write() — see the
// comment above BOLD_STYLE_TIER_SIZES in excelExportService.ts. This test
// exercises that raw-XML patch end to end (decode → unzip → inspect),
// because a row/column indexing bug here would silently mis-style cells
// without tsc or eslint ever catching it.
describe('workbookToBase64WithFrozenHeaders — bold style injection', () => {
  it('with no styled cells, behaves exactly like before (header frozen, no extra fonts)', () => {
    const entries = unzipSync(base64ToBytes(buildBase64([])));
    expect(strFromU8(entries['xl/styles.xml'])).toMatch(/<fonts count="1">/);
    expect(strFromU8(entries['xl/worksheets/sheet1.xml'])).toContain('<pane ySplit="1"');
  });

  it('adds exactly 3 bold fonts (title/header/label tiers) and references them by index', () => {
    const styledCells: StyledCell[] = [
      { sheet: 1, ref: 'A1', tier: 1 },
      { sheet: 1, ref: 'A2', tier: 2 },
      { sheet: 1, ref: 'B2', tier: 2 },
    ];
    const entries = unzipSync(base64ToBytes(buildBase64(styledCells)));
    const stylesXml = strFromU8(entries['xl/styles.xml']);

    expect(stylesXml).toMatch(/<fonts count="4">/); // 1 default + 3 injected
    expect((stylesXml.match(/<font><b\/>/g) ?? []).length).toBe(3);
    expect(stylesXml).toContain('<sz val="20"/>');
    expect(stylesXml).toContain('<sz val="14"/>');
    expect(stylesXml).toContain('<sz val="12"/>');
    expect(stylesXml).toMatch(/<cellXfs count="4">/); // 1 default + 3 injected

    const sheetXml = strFromU8(entries['xl/worksheets/sheet1.xml']);
    // tier 1 -> cellXfs index 1 (base count was 1 before injection)
    expect(sheetXml).toMatch(/<c r="A1" s="1"/);
    // tier 2 -> cellXfs index 2, applied to both header cells
    expect(sheetXml).toMatch(/<c r="A2" s="2"/);
    expect(sheetXml).toMatch(/<c r="B2" s="2"/);
    // untouched cell keeps no style attribute
    expect(sheetXml).toMatch(/<c r="A3"(?! s=)[^>]*>/);
  });

  it('preserves cell values regardless of styling (round-trips through a real reader)', () => {
    const wb = read(base64ToBytes(buildBase64([{ sheet: 1, ref: 'A1', tier: 1 }])), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    expect(sheet.A1.v).toBe('Title');
    expect(sheet.A2.v).toBe('Header A');
    expect(sheet.B3.v).toBe('data');
  });
});

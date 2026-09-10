import { utils, write } from 'xlsx';
import type { WorkSheet } from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// Pure xlsx/zip helpers, deliberately split out of excelExportService.ts:
// that file also imports repositories/settingsStore transitively (native
// AsyncStorage etc.), which makes it unimportable from a plain Jest test.
// These functions touch nothing but `xlsx`/`fflate`, so they stay testable
// in isolation — see __tests__/xlsxWriteUtils.test.ts.

// The free `xlsx` package always writes an empty `<sheetView/>` and has no
// public API for freeze panes (that's a paid-tier feature upstream). So we
// patch the raw sheet XML inside the already-built .xlsx zip: turn the empty
// self-closing tag into one that freezes row 1, on every worksheet.
function freezeHeaderRow(sheetXml: string): string {
  return sheetXml.replace(
    /<sheetView([^/>]*)\/>/,
    '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'
  );
}

// Excel's `wch` column-width unit is roughly chars-in-Calibri-11: pixel
// width ≈ wch * 7 + 5, and at 96dpi 12cm ≈ 454px, so 12cm caps out around
// (454 - 5) / 7 ≈ 64.1 → 64 chars. MIN keeps narrow columns (e.g. "STT")
// from collapsing to unreadable widths.
const AUTO_FIT_MAX_WCH = 64;
const AUTO_FIT_MIN_WCH = 8;
const AUTO_FIT_PADDING = 2;

// Auto-fit every column of a worksheet to its actual content (header +
// all cell values), capped at ~6cm (see AUTO_FIT_MAX_WCH above) so long
// text (food names, advice strings, source URLs) wraps/truncates instead
// of blowing the sheet out to full-page width.
export function autoFitColumns(sheet: WorkSheet): void {
  const ref = sheet['!ref'];
  if (!ref) return;
  const range = utils.decode_range(ref);
  const widths: { wch: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = AUTO_FIT_MIN_WCH;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[utils.encode_cell({ r, c })];
      if (cell == null || cell.v == null) continue;
      maxLen = Math.max(maxLen, String(cell.v).length);
    }
    widths.push({ wch: Math.min(maxLen + AUTO_FIT_PADDING, AUTO_FIT_MAX_WCH) });
  }
  sheet['!cols'] = widths;
}

// btoa() needs a Latin1 "binary string" (one char per byte); chunk the
// conversion so String.fromCharCode's arg spread never blows the call stack
// on multi-hundred-KB workbooks.
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Same story as freeze panes above: the free `xlsx` build silently drops
// any `cell.s` you set before write() — there is no public API for writing
// custom fonts/bold. So a print-focused sheet (S-PL Block crosstab) that
// needs visual hierarchy (title/header/row-label bold+larger) gets it by
// patching 3 fixed font/xf pairs into styles.xml after write(), then
// pointing specific cells at them via `s="N"` — same "unzip → patch →
// re-zip" technique as freezeHeaderRow. Three tiers only (not a general
// styling API) because that's all any caller currently needs.
const BOLD_STYLE_TIER_SIZES = [20, 14, 12] as const;
export type BoldStyleTier = 1 | 2 | 3;

export interface StyledCell {
  sheet: number; // 1-based — matches xl/worksheets/sheetN.xml
  ref: string; // e.g. 'A1'
  tier: BoldStyleTier;
}

function injectBoldStyles(stylesXml: string): { xml: string; tierToIndex: (tier: BoldStyleTier) => number } {
  const fontsBase = Number(stylesXml.match(/<fonts count="(\d+)">/)?.[1] ?? 0);
  const fontsXml = BOLD_STYLE_TIER_SIZES.map((sz) => `<font><b/><sz val="${sz}"/><name val="Calibri"/></font>`).join(
    ''
  );
  let out = stylesXml
    .replace(/<fonts count="\d+">/, `<fonts count="${fontsBase + BOLD_STYLE_TIER_SIZES.length}">`)
    .replace('</fonts>', `${fontsXml}</fonts>`);

  const cellXfsBase = Number(out.match(/<cellXfs count="(\d+)">/)?.[1] ?? 0);
  const xfsXml = BOLD_STYLE_TIER_SIZES.map(
    (_sz, i) =>
      `<xf numFmtId="0" fontId="${fontsBase + i}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">` +
      '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  ).join('');
  out = out
    .replace(/<cellXfs count="\d+">/, `<cellXfs count="${cellXfsBase + BOLD_STYLE_TIER_SIZES.length}">`)
    .replace('</cellXfs>', `${xfsXml}</cellXfs>`);

  return { xml: out, tierToIndex: (tier) => cellXfsBase + (tier - 1) };
}

function applyCellStyle(sheetXml: string, ref: string, styleIdx: number): string {
  const re = new RegExp(`<c r="${ref}"([^>]*)>`);
  return sheetXml.replace(re, (_m, attrs: string) =>
    / s="\d+"/.test(attrs)
      ? `<c r="${ref}"${attrs.replace(/ s="\d+"/, ` s="${styleIdx}"`)}>`
      : `<c r="${ref}" s="${styleIdx}"${attrs}>`
  );
}

// Freeze the header row on every sheet, and optionally bold/enlarge specific
// cells (see injectBoldStyles above), by unzipping the .xlsx, patching
// styles.xml + each xl/worksheets/sheetN.xml, and re-zipping.
export function workbookToBase64WithFrozenHeaders(
  wb: ReturnType<typeof utils.book_new>,
  styledCells: StyledCell[] = []
): string {
  const zipBytes = new Uint8Array(write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  const entries = unzipSync(zipBytes);

  let tierToIndex: (tier: BoldStyleTier) => number = () => 0;
  if (styledCells.length > 0) {
    const patched = injectBoldStyles(strFromU8(entries['xl/styles.xml']));
    entries['xl/styles.xml'] = strToU8(patched.xml);
    tierToIndex = patched.tierToIndex;
  }

  for (const path of Object.keys(entries)) {
    const match = path.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if (!match) continue;
    const sheetNum = Number(match[1]);
    let xml = freezeHeaderRow(strFromU8(entries[path]));
    for (const cell of styledCells) {
      if (cell.sheet === sheetNum) xml = applyCellStyle(xml, cell.ref, tierToIndex(cell.tier));
    }
    entries[path] = strToU8(xml);
  }
  return uint8ToBase64(zipSync(entries));
}

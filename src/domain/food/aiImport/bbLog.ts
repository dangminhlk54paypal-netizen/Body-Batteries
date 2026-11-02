// "BB-LOG v1" — the plain-text meal format an external AI chat answers with
// (prompt in components.aiMealGuide). One line per food; only time, name, grams
// and kcal are required, missing macro columns read as 0:
//
//   BB-LOG v1
//   HH:MM | Name | grams | kcal | protein_g | carbs_g | fat_g | water_ml
//
// Pure parsing. parseMealAnswer turns the lines into the same rows a JSON
// answer gives, so they share one review list and one way into the log.

export const BB_LOG_HEADER = 'BB-LOG v1';

export interface BbLogLine {
  hour: number;
  minute: number;
  name: string;
  grams: number;
  energyKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  waterG: number;
}

export interface BbLogResult {
  items: BbLogLine[];
  rejected: string[]; // the lines that look like data but can't be read, as written
}

const TIME_RE = /^(\d{1,2})[:hH.](\d{2})?$/;

function num(value: string | undefined): number {
  const cleaned = (value ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseBbLog(raw: string): BbLogResult {
  const items: BbLogLine[] = [];
  const rejected: string[] = [];

  for (const untrimmed of raw.split(/\r?\n/)) {
    const line = untrimmed.trim();
    if (!line.includes('|') || /^BB-LOG/i.test(line)) continue; // prose around the block

    const cells = line.split('|').map((c) => c.trim());
    if (cells[0] === '') cells.shift(); // markdown-table style "| a | b |"
    if (cells[cells.length - 1] === '') cells.pop();
    if (cells.every((c) => /^[-:\s]*$/.test(c))) continue; // markdown "|---|---|" row
    if (/^hh/i.test(cells[0] ?? '')) continue; // the column titles

    const time = TIME_RE.exec(cells[0] ?? '');
    const hour = time ? parseInt(time[1], 10) : NaN;
    const minute = time?.[2] ? parseInt(time[2], 10) : 0;
    const name = cells[1] ?? '';
    const grams = num(cells[2]);
    const energyKcal = num(cells[3]);
    if (!time || hour > 23 || minute > 59 || !name || grams <= 0 || energyKcal <= 0) {
      rejected.push(line);
      continue;
    }
    items.push({
      hour,
      minute,
      name,
      grams,
      energyKcal,
      proteinG: num(cells[4]),
      carbG: num(cells[5]),
      fatG: num(cells[6]),
      waterG: num(cells[7]),
    });
  }
  return { items, rejected };
}

// An answer counts as BB-LOG with its header, or when it is a bare list whose
// lines start with a clock time — never for a sentence or a nutrition analysis.
export function looksLikeBbLog(text: string): boolean {
  return /^\s*`*\s*BB-LOG\b/im.test(text) || /^\s*\|?\s*\d{1,2}[:hH.]\d{0,2}\s*\|/m.test(text);
}

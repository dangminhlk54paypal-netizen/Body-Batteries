import type { FoodItem } from '../../types/food';

// "BB-LOG v1" — the plain-text meal format an external AI chat produces from a
// user's free-form description (see docs/08-ai-prompt-guide.md). Pure parsing,
// no I/O — unit-tested.
//
//   BB-LOG v1
//   HH:MM | Tên món | gram | kcal | đạm_g | tinh_bột_g | béo_g | nước_ml
//
// Only time, name, grams and kcal are required; trailing macro columns may be
// missing (treated as 0). The header line is optional so a bare list pastes too.

export interface AiMealLine {
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

export interface AiMealParseResult {
  items: AiMealLine[];
  errors: string[]; // one human-readable message per rejected line (Vietnamese)
}

function num(value: string | undefined): number {
  // Accept "1,5" (Vietnamese decimal comma) as well as "1.5"; strip units.
  const cleaned = (value ?? '').trim().replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const TIME_RE = /^(\d{1,2})[:hH.](\d{2})?$/;

export function parseAiMealLog(raw: string): AiMealParseResult {
  const items: AiMealLine[] = [];
  const errors: string[] = [];

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('```'));

  for (const line of lines) {
    if (/^BB-LOG/i.test(line)) continue;
    if (!line.includes('|')) continue; // stray prose from the AI — ignore

    const cells = line.split('|').map((c) => c.trim());
    if (cells[0] === '') cells.shift(); // tolerate markdown-table style "| a | b |"
    if (cells[cells.length - 1] === '') cells.pop();

    if (cells.every((c) => /^[-:\s]*$/.test(c))) continue; // markdown "|---|---|" row

    const m = TIME_RE.exec(cells[0] ?? '');
    if (!m) {
      // Header rows like "HH:MM | Tên món | …" land here quietly.
      if (!/^hh/i.test(cells[0] ?? '')) errors.push(`Sai giờ: "${line}"`);
      continue;
    }
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour > 23 || minute > 59) {
      errors.push(`Sai giờ: "${line}"`);
      continue;
    }

    const name = cells[1] ?? '';
    const grams = num(cells[2]);
    const energyKcal = num(cells[3]);
    if (!name || grams <= 0 || energyKcal <= 0) {
      errors.push(`Thiếu tên/gram/kcal: "${line}"`);
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

  return { items, errors };
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

// Turn an AI line into an ad-hoc FoodItem whose per-100 g figures reproduce the
// line's totals at its gram amount, so it flows through the normal `logFood`
// path (batteries, "Hôm nay đã ăn", history) unchanged.
export function aiLineToFoodItem(line: AiMealLine): FoodItem {
  const per100 = (v: number) => (v * 100) / line.grams;
  return {
    id: `ai_${slug(line.name) || 'mon'}`,
    nameVi: line.name,
    nameEn: line.name,
    category: 'dish',
    defaultServingG: line.grams,
    servingPresets: [],
    per100g: {
      energyKcal: per100(line.energyKcal),
      waterG: per100(line.waterG),
      proteinG: per100(line.proteinG),
      fatG: per100(line.fatG),
      carbG: per100(line.carbG),
      fiberG: 0,
      sugarG: 0,
      calciumMg: 0,
      ironMg: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
      zincMg: 0,
    },
    source: 'AI-estimate',
    note: '',
  };
}

// Today's timestamp at the line's HH:MM (local time).
export function timestampForLine(line: AiMealLine, now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(line.hour, line.minute, 0, 0);
  return d.getTime();
}

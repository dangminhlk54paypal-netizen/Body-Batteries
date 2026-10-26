import type { MeasureUnit, Nutrition } from '../../../types/food';
import { foldWord } from './mealTextLexicon';

// "Nạp bằng chữ" — the nutrition numbers an AI answer gives for a food, so a
// pasted analysis can become (or update) a food instead of only naming one.
// Two shapes are read:
//   • JSON from the "📤 Hỏi AI" prompt: "per_100g":{"kcal":…,"protein_g":…}
//     (or totals for the item's "grams": "nutrition", "total", flat keys);
//   • a plain-text answer the user got by asking an AI their own way:
//     "Calories: 520 kcal · Protein: 30 g · Fat 20 g…" in vi / en / de, one
//     food per paste.
// Everything is normalised to per 100 g (or ml) — the unit every FoodItem
// stores — and only what the AI actually stated is kept: an unstated
// nutrient stays undefined, so it never overwrites the app's own value.

export type StatedNutrition = Partial<Nutrition>;

export interface AiNutrition {
  per100g: StatedNutrition;
  // No "per 100 g" and no portion weight to scale by — read as per 100 g.
  basisGuessed: boolean;
  measure: MeasureUnit;
}

// The food a plain-text answer describes.
export interface AiNutritionText {
  name: string;
  grams: number | null;
  nutrition: AiNutrition;
}

type Unit = 'kcal' | 'kj' | 'g' | 'mg' | 'mcg';
type NutrientKey = keyof Nutrition;

interface NutrientWords {
  key: NutrientKey;
  unit: Unit;
  words: string[];
}

// Folded labels (no accents, lower case). Longer names first where one
// contains another ("bot duong" is carbs, "duong" is sugar).
const NUTRIENTS: NutrientWords[] = [
  {
    key: 'energyKcal',
    unit: 'kcal',
    words: ['kcal', 'calories', 'calorie', 'calo', 'energy', 'nang luong', 'energie', 'brennwert', 'kalorien'],
  },
  { key: 'proteinG', unit: 'g', words: ['protein', 'proteins', 'chat dam', 'dam', 'eiweiss', 'proteine'] },
  {
    key: 'carbG',
    unit: 'g',
    words: [
      'carbohydrates',
      'carbohydrate',
      'total carbohydrate',
      'total carbohydrates',
      'carbs',
      'carb',
      'tinh bot',
      'bot duong',
      'glucid',
      'carbohydrat',
      'kohlenhydrate',
      'kohlenhydrat',
    ],
  },
  { key: 'fatG', unit: 'g', words: ['fat', 'fats', 'total fat', 'chat beo', 'beo', 'lipid', 'fett'] },
  {
    key: 'fiberG',
    unit: 'g',
    words: ['fiber', 'fibre', 'dietary fiber', 'dietary fibre', 'chat xo', 'xo', 'ballaststoffe'],
  },
  { key: 'sugarG', unit: 'g', words: ['sugar', 'sugars', 'of which sugars', 'duong', 'zucker', 'davon zucker'] },
  { key: 'sodiumMg', unit: 'mg', words: ['sodium', 'natri', 'natrium'] },
  { key: 'waterG', unit: 'g', words: ['water', 'nuoc', 'wasser'] },
  { key: 'calciumMg', unit: 'mg', words: ['calcium', 'canxi', 'kalzium'] },
  { key: 'ironMg', unit: 'mg', words: ['iron', 'sat', 'eisen'] },
  { key: 'potassiumMg', unit: 'mg', words: ['potassium', 'kali', 'kalium'] },
  { key: 'magnesiumMg', unit: 'mg', words: ['magnesium', 'magie'] },
  { key: 'zincMg', unit: 'mg', words: ['zinc', 'kem', 'zink'] },
  { key: 'caffeineMg', unit: 'mg', words: ['caffeine', 'cafein', 'koffein'] },
];

const NUTRIENT_BY_WORD = new Map<string, NutrientWords>(
  NUTRIENTS.flatMap((n) => n.words.map((w) => [w, n] as const))
);
// Salt on EU labels — sodium = salt × 0.4 (1 g salt = 400 mg sodium).
const SALT_WORDS = new Set(['salt', 'muoi', 'salz']);
const SODIUM_MG_PER_SALT_G = 400;
// "Fat 20 g, of which saturates 5 g" — never read these as the main nutrient.
const SKIP_WORDS = ['saturate', 'bao hoa', 'gesattigt', 'trans', 'unsaturate', 'khong bao hoa', 'cholesterol'];

const KJ_PER_KCAL = 4.184;

// ── JSON ─────────────────────────────────────────────────────────────────

const PER100_KEYS = ['per_100g', 'per100g', 'per_100', 'per100', 'per_100ml', 'nutrition_per_100g'];
const TOTAL_KEYS = ['nutrition', 'nutrients', 'total', 'totals', 'per_portion', 'per_serving', 'macros'];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

// The nutrition of one JSON item. `grams` is the item's amount (what the
// totals belong to); null when the answer gave none.
export function jsonNutrition(entry: JsonObject, grams: number | null, measure: MeasureUnit): AiNutrition | null {
  const per100 = PER100_KEYS.map((k) => entry[k]).find(isObject);
  if (per100) {
    const values = nutrientsOfObject(per100);
    return hasNutrition(values) ? { per100g: values, basisGuessed: false, measure } : null;
  }
  const totalsObject = TOTAL_KEYS.map((k) => entry[k]).find(isObject);
  const totals = nutrientsOfObject(totalsObject ?? entry);
  if (!hasNutrition(totals)) return null;
  if (grams != null && grams > 0) return { per100g: scale(totals, 100 / grams), basisGuessed: false, measure };
  return { per100g: totals, basisGuessed: true, measure };
}

function nutrientsOfObject(obj: JsonObject): StatedNutrition {
  const out: StatedNutrition = {};
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const value = typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' ? numberIn(rawValue) : null;
    if (value == null || !(value >= 0)) continue;
    const { label, unit } = splitUnitSuffix(normaliseLabel(rawKey));
    put(out, label, value, unit);
  }
  return out;
}

// ── Plain text ───────────────────────────────────────────────────────────

const NAME_LABELS = new Set(['ten mon', 'ten', 'mon', 'mon an', 'name', 'dish', 'food', 'gericht', 'speise']);
const AMOUNT_LABELS = new Set([
  'khoi luong',
  'tong khoi luong',
  'khau phan',
  'phan an',
  'luong',
  'portion',
  'portion size',
  'serving',
  'serving size',
  'weight',
  'total weight',
  'amount',
  'gewicht',
  'portionsgrosse',
  'menge',
]);
const PER100_PATTERN = /(?:per|\/|moi|trong|cho|pro|je)\s*100\s*(?:g|ml)\b/;
// The same phrase inside one chunk, unfolded, with its ":" — what is left
// after it is still read ("Magerquark je 100 g: Brennwert 67 kcal").
const PER100_IN_CHUNK = /(?:per|\/|mỗi|moi|trong|cho|pro|je)\s*100\s*(?:g|ml)\b\s*:?/i;
// Table headers that are never the dish's name.
const HEADER_LABELS = new Set([
  'nutrition',
  'nutrition facts',
  'nutritional values',
  'gia tri dinh duong',
  'thanh phan dinh duong',
  'dinh duong',
  'nahrwerte',
  'durchschnittliche nahrwerte',
  'chi so',
  'gia tri',
  'value',
  'nutrient',
]);
// A chunk the text answer can be read in: one line, or one ", "-separated
// part of a line ("Protein 30g, Fat 20g"). A comma between digits is a
// decimal comma and never splits.
const CHUNK_SPLIT = /\n|;|•|·|,(?!\d)/;

export function parseNutritionText(text: string): AiNutritionText | null {
  const folded = foldWord(text);
  const per100 = PER100_PATTERN.test(folded);
  const values: StatedNutrition = {};
  let name: string | null = null;
  let nameLabelled = false;
  let grams: number | null = null;
  let measure: MeasureUnit = 'g';

  const chunks = text.split(CHUNK_SPLIT);
  for (let i = 0; i < chunks.length; i += 1) {
    // Markdown tables / bold / bullets → plain "label value".
    const chunk = chunks[i].replace(/[|*#_`>]/g, ' ').replace(/^\s*[-–—]\s*/, '').trim();
    if (!chunk) continue;
    const digit = chunk.search(/\d/);
    // The label ends at a ":" ("Tên món: Phở bò") or at the first number.
    const colon = chunk.indexOf(':');
    const labelEnd = colon >= 0 && (digit < 0 || colon < digit) ? colon : digit;
    const labelPart = labelEnd < 0 ? chunk : chunk.slice(0, labelEnd);
    const label = normaliseLabel(labelPart.replace(/\([^)]*\)?/g, ' '));
    const valuePart = digit < 0 ? '' : chunk.slice(digit);

    const nutrientLabel = isNutrientLabel(label);
    if (HEADER_LABELS.has(label) && digit < 0) continue;
    // "Giá trị dinh dưỡng trên 100 g:" is a header, not a dish of 100 g —
    // but what comes before it may name the dish, and after it a nutrient.
    const header = nutrientLabel ? null : PER100_IN_CHUNK.exec(chunk);
    if (header) {
      const before = chunk.slice(0, header.index).trim();
      const beforeLabel = normaliseLabel(before);
      if (name == null && before && !HEADER_LABELS.has(beforeLabel)) name = nameFrom(before, beforeLabel)?.name ?? null;
      const after = chunk.slice(header.index + header[0].length).trim();
      if (after) chunks.splice(i + 1, 0, after);
      continue;
    }

    const labelled = NAME_LABELS.has(label);
    // An unlabelled line without numbers is the dish's name — unless it is an
    // intro ("Dưới đây là ước tính:"). "Phở bò 500 g" — an unlabelled line
    // with a weight — is the dish too.
    const isNameLine = labelled || (digit < 0 && !nutrientLabel && !chunk.endsWith(':'));
    const isDishLine = !nutrientLabel && digit >= 0 && grams == null && amountIn(chunk) != null;
    if (isNameLine || isDishLine) {
      const named: NamedLine | null = name == null || (labelled && !nameLabelled) ? nameFrom(chunk, label) : null;
      if (named) {
        name = named.name;
        nameLabelled = labelled;
        if (grams == null && named.grams != null) {
          grams = named.grams;
          measure = named.measure;
        }
      }
      continue;
    }
    if (!valuePart || SKIP_WORDS.some((w) => label.includes(w))) continue;
    if (AMOUNT_LABELS.has(label)) {
      const amount = amountIn(valuePart);
      if (amount && grams == null) {
        grams = amount.grams;
        measure = amount.measure;
      }
      continue;
    }
    const { label: bare, unit: keyUnit } = splitUnitSuffix(label);
    const found: StatedNutrition = {};
    if (NUTRIENT_BY_WORD.get(bare)?.key === 'energyKcal') {
      const kcal = energyIn(valuePart);
      if (kcal != null) found.energyKcal = kcal;
    } else {
      const value = numberIn(valuePart);
      if (value != null) put(found, bare, value, unitAfterNumber(valuePart) ?? keyUnit);
    }
    // The first mention wins ("Fat 20 g … Fat (per portion) 45 g").
    for (const [k, v] of Object.entries(found) as [NutrientKey, number][]) {
      if (values[k] == null) values[k] = v;
    }
  }

  // A sentence like "đường 10g, cà phê 200ml" names one nutrient at most —
  // only an answer with energy AND a macro is a nutrition analysis.
  const hasMacro = values.proteinG != null || values.carbG != null || values.fatG != null;
  if (values.energyKcal == null || !hasMacro) return null;

  const nutrition: AiNutrition =
    per100 || grams == null
      ? { per100g: values, basisGuessed: !per100, measure }
      : { per100g: scale(values, 100 / grams), basisGuessed: false, measure };
  return { name: name ?? '', grams, nutrition };
}

function isNutrientLabel(label: string): boolean {
  const bare = splitUnitSuffix(label).label;
  return NUTRIENT_BY_WORD.has(bare) || SALT_WORDS.has(bare) || AMOUNT_LABELS.has(bare);
}

// "Tên món: Phở bò (khoảng 500 g)" / "Phở bò 500g" → name + its weight.
interface NamedLine {
  name: string;
  grams: number | null;
  measure: MeasureUnit;
}

function nameFrom(chunk: string, label: string): NamedLine | null {
  const afterLabel = NAME_LABELS.has(label) ? chunk.replace(/^[^:]*:\s*/, '') : chunk;
  const amount = amountIn(afterLabel);
  const name = afterLabel
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(?:khoảng|khoang|about|approx\.?|ca\.?|~)?\s*\d+(?:[.,]\d+)?\s*(?:g|gram|grams|gr|ml)\b/gi, ' ')
    .replace(/[:–—-]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || name.length > 80) return null;
  return { name, grams: amount?.grams ?? null, measure: amount?.measure ?? 'g' };
}

function amountIn(text: string): { grams: number; measure: MeasureUnit } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(g|gram|grams|gr|ml)\b/i.exec(text);
  if (!m) return null;
  const grams = Number(m[1].replace(',', '.'));
  return grams > 0 ? { grams, measure: m[2].toLowerCase() === 'ml' ? 'ml' : 'g' } : null;
}

// "520 kcal (2176 kJ)", "2176 kJ / 520 kcal", "520" — kcal preferred.
function energyIn(text: string): number | null {
  const kcal = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|~|to|đến|bis)\s*(\d+(?:[.,]\d+)?))?\s*(?:kcal|cal|calo)\b/i.exec(text);
  if (kcal) {
    const low = Number(kcal[1].replace(',', '.'));
    return kcal[2] ? round1((low + Number(kcal[2].replace(',', '.'))) / 2) : low;
  }
  const kj = /(\d+(?:[.,]\d+)?)\s*kj\b/i.exec(text);
  if (kj) return round1(Number(kj[1].replace(',', '.')) / KJ_PER_KCAL);
  return numberIn(text);
}

// The first number; a range "25–30" is read as its middle.
function numberIn(text: string): number | null {
  const range = /(\d+(?:[.,]\d+)?)\s*(?:-|–|~|to|đến|den|bis)\s*(\d+(?:[.,]\d+)?)/i.exec(text);
  if (range && range.index === text.search(/\d/)) {
    return round1((Number(range[1].replace(',', '.')) + Number(range[2].replace(',', '.'))) / 2);
  }
  const m = /(\d+(?:[.,]\d+)?)/.exec(text);
  return m ? Number(m[1].replace(',', '.')) : null;
}

function unitAfterNumber(text: string): Unit | null {
  const m = /\d(?:[\d.,\s–~-]|to|bis)*\s*(kcal|kj|mg|mcg|µg|μg|g)\b/i.exec(text);
  if (!m) return null;
  const unit = m[1].toLowerCase();
  return unit === 'µg' || unit === 'μg' ? 'mcg' : (unit as Unit);
}

// ── Shared ───────────────────────────────────────────────────────────────

function normaliseLabel(raw: string): string {
  return foldWord(raw)
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9/ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "protein g" → protein (g); "energy kj" → energy (kJ); "sodium mg" → sodium.
function splitUnitSuffix(label: string): { label: string; unit: Unit | null } {
  const m = /^(.*?)\s+(kcal|kj|mg|mcg|ug|g)$/.exec(label);
  if (!m || !m[1]) return { label, unit: null };
  return { label: m[1], unit: m[2] === 'ug' ? 'mcg' : (m[2] as Unit) };
}

function put(out: StatedNutrition, label: string, value: number, unit: Unit | null) {
  if (SALT_WORDS.has(label)) {
    const saltG = unit === 'mg' ? value / 1000 : value;
    out.sodiumMg = round1(saltG * SODIUM_MG_PER_SALT_G);
    return;
  }
  const entry = NUTRIENT_BY_WORD.get(label);
  if (!entry) return;
  out[entry.key] = round1(convert(value, unit ?? entry.unit, entry.unit));
}

function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  if (to === 'kcal') return from === 'kj' ? value / KJ_PER_KCAL : value;
  const inMg = from === 'g' ? value * 1000 : from === 'mcg' ? value / 1000 : value;
  return to === 'g' ? inMg / 1000 : inMg;
}

function hasNutrition(values: StatedNutrition): boolean {
  return Object.keys(values).length > 0;
}

function scale(values: StatedNutrition, factor: number): StatedNutrition {
  const out: StatedNutrition = {};
  for (const [k, v] of Object.entries(values) as [NutrientKey, number][]) out[k] = round1(v * factor);
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Checks and comparison ────────────────────────────────────────────────

const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 };

// Numbers that can't be right per 100 g: energy that doesn't fit the macros
// (alcohol aside, kcal ≈ 4·P + 4·C + 9·F), more than 900 kcal or more than
// 100 g of macros in 100 g. A warning, never a block — the user decides.
export function aiNutritionLooksOff(values: StatedNutrition): boolean {
  const { energyKcal, proteinG, carbG, fatG } = values;
  if (energyKcal != null && energyKcal > 900) return true;
  const macroGrams = (proteinG ?? 0) + (carbG ?? 0) + (fatG ?? 0);
  if (macroGrams > 100) return true;
  if (energyKcal == null || proteinG == null || carbG == null || fatG == null) return false;
  const fromMacros = KCAL_PER_G.protein * proteinG + KCAL_PER_G.carb * carbG + KCAL_PER_G.fat * fatG;
  return Math.abs(energyKcal - fromMacros) > Math.max(40, 0.25 * energyKcal);
}

// Whether the AI's numbers say something the app's food doesn't: energy off
// by more than 5 % (10 kcal at least) or a macro by more than 2 g per 100 g.
export function aiNutritionDiffers(app: Nutrition, ai: StatedNutrition): boolean {
  if (ai.energyKcal != null && Math.abs(ai.energyKcal - app.energyKcal) > Math.max(10, 0.05 * app.energyKcal)) {
    return true;
  }
  return (['proteinG', 'carbG', 'fatG'] as const).some((k) => ai[k] != null && Math.abs(ai[k] - app[k]) > 2);
}

const REQUIRED_ZERO: Omit<Nutrition, 'epaMg' | 'dhaMg' | 'caffeineMg' | 'taurineMg' | 'carnitineMg' | 'creatineMg'> = {
  energyKcal: 0,
  waterG: 0,
  proteinG: 0,
  fatG: 0,
  carbG: 0,
  fiberG: 0,
  sugarG: 0,
  calciumMg: 0,
  ironMg: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
  zincMg: 0,
};

// A complete per-100 g record for a brand-new food: what the AI didn't state
// is 0 (a custom food left blank behaves the same), optional fields absent.
export function completeNutrition(values: StatedNutrition): Nutrition {
  return { ...REQUIRED_ZERO, ...values };
}

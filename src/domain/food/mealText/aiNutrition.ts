import type { Language } from '../../../i18n/types';
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
  // Set only when some value is doubtful (see withDoubts).
  doubtful?: DoubtfulValue[];
}

// A mineral whose "1.500 mg" / "1,500 mg" was read as thousands
// (ungroupThousands) although that is far above any food — `alt` is the
// decimal reading (1.5). Shown as a warning; the user decides.
export interface DoubtfulValue {
  key: NutrientKey;
  value: number; // per 100 g, as read
  alt: number; // per 100 g, the decimal reading
}

// The food a plain-text answer describes.
export interface AiNutritionText {
  name: string;
  grams: number | null;
  nutrition: AiNutrition;
}

type Unit = 'kcal' | 'kj' | 'g' | 'mg' | 'mcg';
type NutrientKey = keyof Nutrition;

// Every word list is kept per language, so adding a language to `Language`
// makes tsc point at each list that still needs its words. An answer is
// read against the words of ALL languages at once — the AI may reply in any.
type Words = Record<Language, string[]>;

function allWords(words: Words): string[] {
  return Object.values(words).flat();
}

interface NutrientWords {
  key: NutrientKey;
  unit: Unit;
  words: Words;
}

// Folded labels (no accents, lower case), matched whole, so "bot duong"
// (carbs) and "duong" (sugar) never collide.
const NUTRIENTS: NutrientWords[] = [
  {
    key: 'energyKcal',
    unit: 'kcal',
    words: {
      vi: ['kcal', 'calo', 'nang luong'],
      en: ['kcal', 'calories', 'calorie', 'energy'],
      de: ['kcal', 'energie', 'brennwert', 'kalorien'],
    },
  },
  {
    key: 'proteinG',
    unit: 'g',
    words: { vi: ['chat dam', 'dam', 'protein'], en: ['protein', 'proteins'], de: ['eiweiss', 'protein', 'proteine'] },
  },
  {
    key: 'carbG',
    unit: 'g',
    words: {
      vi: ['tinh bot', 'bot duong', 'glucid', 'carbohydrat', 'carb'],
      en: ['carbohydrates', 'carbohydrate', 'total carbohydrate', 'total carbohydrates', 'carbs', 'carb'],
      de: ['kohlenhydrate', 'kohlenhydrat'],
    },
  },
  {
    key: 'fatG',
    unit: 'g',
    words: { vi: ['chat beo', 'beo', 'lipid'], en: ['fat', 'fats', 'total fat'], de: ['fett'] },
  },
  {
    key: 'fiberG',
    unit: 'g',
    words: { vi: ['chat xo', 'xo'], en: ['fiber', 'fibre', 'dietary fiber', 'dietary fibre'], de: ['ballaststoffe'] },
  },
  {
    key: 'sugarG',
    unit: 'g',
    words: { vi: ['duong'], en: ['sugar', 'sugars', 'of which sugars'], de: ['zucker', 'davon zucker'] },
  },
  { key: 'sodiumMg', unit: 'mg', words: { vi: ['natri'], en: ['sodium'], de: ['natrium'] } },
  { key: 'waterG', unit: 'g', words: { vi: ['nuoc'], en: ['water'], de: ['wasser'] } },
  { key: 'calciumMg', unit: 'mg', words: { vi: ['canxi'], en: ['calcium'], de: ['kalzium', 'calcium'] } },
  { key: 'ironMg', unit: 'mg', words: { vi: ['sat'], en: ['iron'], de: ['eisen'] } },
  { key: 'potassiumMg', unit: 'mg', words: { vi: ['kali'], en: ['potassium'], de: ['kalium'] } },
  { key: 'magnesiumMg', unit: 'mg', words: { vi: ['magie'], en: ['magnesium'], de: ['magnesium'] } },
  { key: 'zincMg', unit: 'mg', words: { vi: ['kem'], en: ['zinc'], de: ['zink'] } },
  { key: 'caffeineMg', unit: 'mg', words: { vi: ['cafein'], en: ['caffeine'], de: ['koffein'] } },
];

const NUTRIENT_BY_WORD = new Map<string, NutrientWords>(
  NUTRIENTS.flatMap((n) => allWords(n.words).map((w) => [w, n] as const))
);
// Salt on EU labels — sodium = salt × 0.4 (1 g salt = 400 mg sodium).
const SALT_WORDS = new Set(allWords({ vi: ['muoi'], en: ['salt'], de: ['salz'] }));
const SODIUM_MG_PER_SALT_G = 400;
// "Fat 20 g, of which saturates 5 g" — never read these as the main nutrient.
const SKIP_WORDS = allWords({
  vi: ['bao hoa', 'khong bao hoa', 'cholesterol', 'trans'],
  en: ['saturate', 'unsaturate', 'trans', 'cholesterol'],
  de: ['gesattigt', 'trans', 'cholesterin'],
});

const KJ_PER_KCAL = 4.184;

// Ceiling per 100 g above which a thousands reading is doubted: 3 × the
// highest value in the app's own food data (food_items.csv + the USDA subset,
// 460 rows, checked 2026-10-26) — soybean iron 15.7, dried egg yolk zinc 7.11,
// pumpkin seeds magnesium 500, process cheese calcium 1500, instant coffee
// potassium 3540, table salt sodium 38 700 mg. Only doubted when the decimal
// reading was possible too, so "Calcium 1,500 mg" (cheese) passes but
// "Eisen 1,500 mg" (1.5 mg) is flagged. `nutrient`: its i18n `nutrients.*` id.
export const DOUBT_LIMITS: { key: NutrientKey; ceilingMg: number; nutrient: string }[] = [
  { key: 'ironMg', ceilingMg: 47, nutrient: 'iron' },
  { key: 'zincMg', ceilingMg: 22, nutrient: 'zinc' },
  { key: 'magnesiumMg', ceilingMg: 1500, nutrient: 'magnesium' },
  { key: 'calciumMg', ceilingMg: 4500, nutrient: 'calcium' },
  { key: 'potassiumMg', ceilingMg: 10620, nutrient: 'potassium' },
  { key: 'sodiumMg', ceilingMg: 116100, nutrient: 'sodium' },
];

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
  const read = readJsonNutrition(entry, grams, measure, true);
  return read && withDoubts(read, readJsonNutrition(entry, grams, measure, false));
}

// `ungroup` false = the decimal reading of "1.500" (only to spot doubts).
function readJsonNutrition(
  entry: JsonObject,
  grams: number | null,
  measure: MeasureUnit,
  ungroup: boolean
): AiNutrition | null {
  const per100 = PER100_KEYS.map((k) => entry[k]).find(isObject);
  if (per100) {
    const values = nutrientsOfObject(per100, ungroup);
    return hasNutrition(values) ? { per100g: values, basisGuessed: false, measure } : null;
  }
  const totalsObject = TOTAL_KEYS.map((k) => entry[k]).find(isObject);
  const totals = nutrientsOfObject(totalsObject ?? entry, ungroup);
  if (!hasNutrition(totals)) return null;
  if (grams != null && grams > 0) return { per100g: scale(totals, 100 / grams), basisGuessed: false, measure };
  return { per100g: totals, basisGuessed: true, measure };
}

function nutrientsOfObject(obj: JsonObject, ungroup: boolean): StatedNutrition {
  const out: StatedNutrition = {};
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const { label, unit: keyUnit } = splitUnitSuffix(normaliseLabel(rawKey));
    const plain = typeof rawValue === 'string' ? halfWidth(rawValue) : null;
    const text = plain != null && ungroup ? ungroupThousands(plain, keyUnit) : plain;
    const value = typeof rawValue === 'number' ? rawValue : text != null ? numberIn(text) : null;
    if (value == null || !(value >= 0)) continue;
    // "energy": "2176 kJ" — a unit written in the value beats the key's.
    put(out, label, value, (text != null ? unitAfterNumber(text) : null) ?? keyUnit);
  }
  return out;
}

// ── Plain text ───────────────────────────────────────────────────────────

const NAME_LABELS = new Set(
  allWords({ vi: ['ten mon', 'ten', 'mon', 'mon an'], en: ['name', 'dish', 'food'], de: ['name', 'gericht', 'speise'] })
);
const AMOUNT_LABELS = new Set(
  allWords({
    vi: ['khoi luong', 'tong khoi luong', 'khau phan', 'phan an', 'luong'],
    en: ['portion', 'portion size', 'serving', 'serving size', 'weight', 'total weight', 'amount'],
    de: ['gewicht', 'portion', 'portionsgrosse', 'menge'],
  })
);
// "per 100 g" / "mỗi 100 g" / "je 100 g" — the words before the 100.
const PER100_WORDS: Words = { vi: ['mỗi', 'moi', 'trong', 'cho'], en: ['per'], de: ['pro', 'je'] };
const PER100_LEAD = `(?:\\/|${allWords(PER100_WORDS).join('|')})`;
const PER100_PATTERN = new RegExp(`${PER100_LEAD}\\s*100\\s*(?:g|ml)\\b`);
// The same phrase inside one chunk, unfolded, with its ":" — what is left
// after it is still read ("Magerquark je 100 g: Brennwert 67 kcal").
const PER100_IN_CHUNK = new RegExp(`${PER100_LEAD}\\s*100\\s*(?:g|ml)\\b\\s*:?`, 'i');
// Table headers that are never the dish's name.
const HEADER_LABELS = new Set(
  allWords({
    vi: ['gia tri dinh duong', 'thanh phan dinh duong', 'dinh duong', 'chi so', 'gia tri'],
    en: ['nutrition', 'nutrition facts', 'nutritional values', 'value', 'nutrient'],
    de: ['nahrwerte', 'durchschnittliche nahrwerte'],
  })
);
// A chunk the text answer can be read in: one line, or one ", "-separated
// part of a line ("Protein 30g, Fat 20g"). A comma between digits is a
// decimal comma and never splits.
const CHUNK_SPLIT = /\n|;|•|·|,(?!\d)/;

export function parseNutritionText(answer: string): AiNutritionText | null {
  const read = readNutritionText(answer, true);
  if (!read) return null;
  return { ...read, nutrition: withDoubts(read.nutrition, readNutritionText(answer, false)?.nutrition ?? null) };
}

// `ungroup` false = the decimal reading of "1.500" (only to spot doubts).
function readNutritionText(answer: string, ungroup: boolean): AiNutritionText | null {
  const text = ungroup ? ungroupThousands(halfWidth(answer)) : halfWidth(answer);
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

// Full-width forms (Chinese / Japanese input: "蛋白质：30ｇ", "（每100克）")
// become their plain ones (NFKC), and the ideographic comma and full stop
// split like ", " and a line break do.
export function halfWidth(text: string): string {
  return text.normalize('NFKC').replace(/、/g, ', ').replace(/。/g, '\n');
}

// Units whose amounts run into the thousands on a label.
const THOUSANDS_UNITS = new Set<Unit>(['kj', 'kcal', 'mg']);
// "1.046 kJ" (de) / "1,046 kJ" (en) / "Natrium 1.200 mg": 1–3 digits (not
// starting with 0), a separator, then exactly 3 digits right before an
// energy / mg / ml unit is a thousands separator — never a decimal one.
// "0,125 g" and "12,4 g" stay decimals. A range keeps its unit at the end
// ("1.000–1.200 mg").
const THOUSANDS = new RegExp(
  String.raw`(^|[^\d.,])([1-9]\d{0,2})[.,](\d{3})` +
    String.raw`(?=(?:\s*(?:-|–|~|to|bis|đến|den)\s*\d[\d.,]*)?\s*(?:kj|kcal|cal|calo|mg|ml)\b)`,
  'gi'
);

// `unit`: the unit a JSON key gives a bare value ("sodium_mg": "1.200").
export function ungroupThousands(text: string, unit: Unit | null = null): string {
  const tagged = unit && THOUSANDS_UNITS.has(unit) && !/\p{L}/u.test(text) ? `${text} ${unit}` : text;
  return tagged.replace(THOUSANDS, '$1$2$3');
}

// Letters of every script are kept ("蛋白质", "énergie"); only punctuation
// and symbols become spaces.
export function normaliseLabel(raw: string): string {
  return foldWord(halfWidth(raw))
    .replace(/[_-]/g, ' ')
    .replace(/[^\p{L}\p{N}/ ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "protein g" → protein (g); "energy kj" → energy (kJ); "sodium mg" → sodium.
function splitUnitSuffix(label: string): { label: string; unit: Unit | null } {
  const m = /^(.*?)\s+(kcal|kj|mg|mcg|ug|µg|μg|g)$/.exec(label);
  if (!m || !m[1]) return { label, unit: null };
  return { label: m[1], unit: m[2] === 'ug' || m[2] === 'µg' || m[2] === 'μg' ? 'mcg' : (m[2] as Unit) };
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

// Marks the minerals whose thousands reading is above DOUBT_LIMITS while the
// decimal reading of the same text gave something else.
function withDoubts(read: AiNutrition, decimal: AiNutrition | null): AiNutrition {
  if (!decimal) return read;
  const doubtful = DOUBT_LIMITS.flatMap(({ key, ceilingMg }) => {
    const value = read.per100g[key];
    const alt = decimal.per100g[key];
    return value != null && alt != null && value !== alt && value > ceilingMg ? [{ key, value, alt }] : [];
  });
  return doubtful.length > 0 ? { ...read, doubtful } : read;
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

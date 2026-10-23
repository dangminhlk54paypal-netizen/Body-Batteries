import type { MealType } from '../../../types/food';
import {
  FILLER_WORDS_ACCENTED,
  FILLER_WORDS_FOLDED,
  HALF_MORE_WORDS,
  ITEM_CONNECTORS,
  LEADING_UNIT_WORDS,
  MULTI_WORD_UNITS,
  NUMBER_WORDS,
  SIZE_WORDS,
  TIME_PHRASES,
  foldWord,
  unitWordFor,
  type TimePhrase,
  type UnitWord,
} from './mealTextLexicon';

// "Nạp bằng chữ", steps 1–2 of Parsing → Decoding → Mapping & Validation →
// Insert. Pure: text in, decoded rows out — no catalog, no clock, no store.
// Step 3 (which food, how many grams, which timestamp) is mapMealText.ts.
//
//   "Sáng: 2 chén cơm, phở bò và 200g ức gà lúc 12h"
//     → 1. Parsing  — pieces: "sáng: 2 chén cơm" · "phở bò" · "200g ức gà lúc 12h"
//     → 2. Decoding — {2, chén, "cơm", breakfast} · {–, –, "phở bò"} · {200, g, "ức gà", 12:00}
//
// Time words carry over to the pieces after them ("hôm qua: sáng trứng, trưa
// cơm" → both yesterday); when the text names a time only once, it applies to
// every row ("2 chén cơm, phở bò lúc 12h" → both at 12:00).

export interface MealTimeHint {
  dayOffset: number | null; // 0 = today, -1 = yesterday… null = not said
  hour: number | null; // 0–23, already turned to 24h ("tối 7h" → 19)
  minute: number | null;
  meal: MealType | null;
}

export interface DecodedUnit {
  word: string; // as typed, lower-cased ("chén", "g", "tô")
  unit: UnitWord;
}

export interface DecodedMealItem {
  raw: string; // the piece of text this row came from, trimmed, as typed
  foodQuery: string; // what is left to look up in the catalog
  // Set when the amount came from a NUMBER WORD — "ba chỉ" / "cá ba sa" read
  // "ba" as 3. The same phrase with that word kept, tried by the mapper when
  // foodQuery finds no exact food.
  fallbackQuery: string | null;
  // A second name for the same food — the English name an AI answer gives
  // next to the Vietnamese/German one. Tried when foodQuery finds no exact food.
  altQuery: string | null;
  quantity: number | null;
  unit: DecodedUnit | null;
  time: MealTimeHint | null;
}

interface PieceTime {
  dayOffset: number | null;
  meal: MealType | null;
  phraseHour: number | null;
  phraseMinute: number | null;
  clockHour: number | null;
  clockMinute: number | null;
  ampm: 'am' | 'pm' | null;
}

interface DecodedPiece {
  item: Omit<DecodedMealItem, 'time'> | null;
  time: MealTimeHint | null;
}

const PHRASES_LONGEST_FIRST: TimePhrase[] = [...TIME_PHRASES].sort(
  (a, b) => b.tokens.length - a.tokens.length
);

export function parseMealText(text: string): DecodedMealItem[] {
  // An AI answer to the "📤 Hỏi AI" prompt is JSON; anything else (or JSON
  // that doesn't parse) is read as a sentence.
  const fromJson = parseMealJson(text);
  if (fromJson) return fromJson;
  const pieces = splitPieces(text).map(decodePiece);
  const hinted = pieces.filter((p) => p.time != null);

  let carried: MealTimeHint | null = hinted.length > 0 ? hinted[0].time : null;
  const items: DecodedMealItem[] = [];
  for (const piece of pieces) {
    if (hinted.length > 1 && piece.time) carried = mergeHint(carried, piece.time);
    if (!piece.item) continue;
    const time = hinted.length === 1 ? hinted[0].time : carried;
    items.push({ ...piece.item, time });
  }
  return items;
}

// A later hint replaces the day only when it names one, and replaces the meal
// and clock together ("hôm qua: sáng trứng, trưa cơm" keeps "yesterday" for
// the lunch row but not "breakfast").
function mergeHint(base: MealTimeHint | null, next: MealTimeHint): MealTimeHint {
  if (!base) return next;
  const namesMoment = next.meal != null || next.hour != null;
  return {
    dayOffset: next.dayOffset ?? base.dayOffset,
    hour: namesMoment ? next.hour : base.hour,
    minute: namesMoment ? next.minute : base.minute,
    meal: namesMoment ? next.meal : base.meal,
  };
}

// ── 1. Parsing ───────────────────────────────────────────────────────────

const CONNECTOR_SPLIT = new RegExp(`\\s(?:${ITEM_CONNECTORS.join('|')})\\s`, 'i');

function splitPieces(text: string): string[] {
  const prepared = text
    .normalize('NFC')
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    // "1,5 chén" is a decimal, not two foods.
    .replace(/(\d),(\d)/g, '$1.$2');
  return prepared
    .split(/\r?\n|[;,+&•·]|\.(?=\s|$)/)
    .flatMap((part) => ` ${part} `.split(CONNECTOR_SPLIT))
    .map((part) => part.trim())
    .filter(Boolean);
}

// ── 2. Decoding ──────────────────────────────────────────────────────────

const AMPM_TIME = /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i;
const CLOCK_TIME = /(\d{1,2})\s*[:h]\s*(\d{2})(?!\d)/i;
const HOUR_TIME = /(\d{1,2})\s*(?:h|giờ|gio|uhr|o'clock)(?![a-zà-ỹäöüß0-9])/i;
const RANGE = /(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)/g;
const FRACTION = /(\d+)\s*\/\s*(\d+)/g;
const TOKEN_SPLIT = /[\s()[\]{}"'“”‘’!?:…*_\-–—/~]+/;
const NUMBER = /^\d+(?:\.\d+)?$/;

function decodePiece(raw: string): DecodedPiece {
  const time: PieceTime = {
    dayOffset: null,
    meal: null,
    phraseHour: null,
    phraseMinute: null,
    clockHour: null,
    clockMinute: null,
    ampm: null,
  };

  let s = ` ${raw.toLowerCase()} `;
  s = takeClock(s, time);
  s = s
    // "2-3 quả" → 2.5 — the middle of what was said.
    .replace(RANGE, (_, a: string, b: string) => String((Number(a) + Number(b)) / 2))
    .replace(FRACTION, (_, a: string, b: string) => (Number(b) > 0 ? String(Number(a) / Number(b)) : a))
    // "200g" → "200 g", "x2" → "x 2" (decimal points stay inside numbers).
    .replace(/(\d)(?=[^\d\s.])/g, '$1 ')
    .replace(/([^\d\s.])(?=\d)/g, '$1 ');

  let tokens = s
    .split(TOKEN_SPLIT)
    .map((tok) => tok.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

  tokens = takeTimePhrases(tokens, time);
  tokens = tokens.filter((tok) => !isFiller(tok));

  const item = takeAmount(tokens);
  return {
    item: item && item.foodQuery ? { raw: raw.trim(), ...item } : null,
    time: toHint(time),
  };
}

function takeClock(s: string, time: PieceTime): string {
  const ampm = AMPM_TIME.exec(s);
  if (ampm) {
    time.clockHour = Number(ampm[1]);
    time.clockMinute = ampm[2] ? Number(ampm[2]) : 0;
    time.ampm = ampm[3].startsWith('p') ? 'pm' : 'am';
    return s.replace(ampm[0], ' ');
  }
  const clock = CLOCK_TIME.exec(s);
  if (clock && Number(clock[1]) <= 23 && Number(clock[2]) <= 59) {
    time.clockHour = Number(clock[1]);
    time.clockMinute = Number(clock[2]);
    return s.replace(clock[0], ' ');
  }
  const hour = HOUR_TIME.exec(s);
  if (hour && Number(hour[1]) <= 23) {
    time.clockHour = Number(hour[1]);
    time.clockMinute = 0;
    return s.replace(hour[0], ' ');
  }
  return s;
}

function takeTimePhrases(tokens: string[], time: PieceTime): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const phrase = PHRASES_LONGEST_FIRST.find((p) => phraseAt(tokens, i, p));
    if (!phrase) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    if (phrase.dayOffset != null) time.dayOffset = phrase.dayOffset;
    if (phrase.meal) time.meal = phrase.meal;
    if (phrase.hour != null) {
      time.phraseHour = phrase.hour;
      time.phraseMinute = phrase.minute ?? 0;
    }
    i += phrase.tokens.length;
  }
  return out;
}

function phraseAt(tokens: string[], at: number, phrase: TimePhrase): boolean {
  return phrase.tokens.every((word, k) => {
    const tok = tokens[at + k];
    if (tok == null) return false;
    if (!phrase.folded) return tok === word;
    // An accent-free phrase only matches words typed without Vietnamese
    // accents — "ăn tỏi" (garlic) must not read as "an toi" (dinner).
    return !hasVietnameseMarks(tok) && foldWord(tok) === word;
  });
}

// Any letter beyond ASCII other than the German umlauts/ß.
function hasVietnameseMarks(tok: string): boolean {
  return /[^ -~äöüß]/.test(tok);
}

function isFiller(tok: string): boolean {
  if (FILLER_WORDS_ACCENTED.has(tok)) return true;
  // Folded fillers only for tokens typed WITHOUT accents: "cá" (fish) must not
  // become the German filler "ca", nor "tỏi" (garlic) the pronoun "toi".
  if (foldWord(tok) !== tok) return false;
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tok)) return false; // "a"/"an" = 1
  return FILLER_WORDS_FOLDED.has(tok) || tok === 'x';
}

function numberAt(tokens: string[], i: number): number | null {
  const tok = tokens[i];
  if (tok == null) return null;
  if (NUMBER.test(tok)) return Number(tok);
  return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tok) ? NUMBER_WORDS[tok] : null;
}

function takeAmount(
  tokens: string[]
): Omit<DecodedMealItem, 'raw' | 'time'> | null {
  if (tokens.length === 0) return null;

  // A digit wins over a number word anywhere in the piece.
  let at = tokens.findIndex((tok) => NUMBER.test(tok));
  const fromWord = at < 0;
  if (fromWord) at = tokens.findIndex((_, i) => numberAt(tokens, i) != null);

  let quantity: number | null = null;
  let unit: DecodedUnit | null = null;
  const used = new Set<number>();

  if (at >= 0) {
    quantity = numberAt(tokens, at);
    used.add(at);
    let next = at + 1;
    // "một nửa" = 1 × 0.5, "half a" = 0.5 × 1.
    while (numberAt(tokens, next) != null && !NUMBER.test(tokens[next])) {
      quantity = (quantity ?? 1) * (numberAt(tokens, next) ?? 1);
      used.add(next);
      next += 1;
    }
    const found = unitAt(tokens, next);
    if (found) {
      unit = found.unit;
      for (let k = next; k < next + found.length; k += 1) used.add(k);
      next += found.length;
    }
    next = skipAfterUnit(tokens, next, used, () => {
      quantity = (quantity ?? 0) + 0.5;
    });
  } else {
    // "tô phở", "bowl of rice" — a container word on its own means one.
    const first = tokens[0];
    const found = LEADING_UNIT_WORDS.has(first) ? unitAt(tokens, 0) : null;
    if (found) {
      quantity = 1;
      unit = found.unit;
      for (let k = 0; k < found.length; k += 1) used.add(k);
      skipAfterUnit(tokens, found.length, used, () => {
        quantity = (quantity ?? 0) + 0.5;
      });
    }
  }

  const rest = tokens.filter((_, i) => !used.has(i));
  return {
    foodQuery: rest.join(' '),
    fallbackQuery: at >= 0 && fromWord && !unit ? tokens.join(' ') : null,
    altQuery: null,
    quantity,
    unit,
  };
}

// ── JSON from an AI answer ───────────────────────────────────────────────
// The prompt (i18n components.textMealEntry.aiPrompt) asks for
//   {"items":[{"name":"…","name_en":"…","grams":150,"time":"12:30"}]}
// but answers drift: a bare array, ```json fences, "quantity"+"unit" instead
// of grams, "meal" instead of a clock time. Everything optional except a name;
// an item without one is skipped, a reply with no usable item falls back to
// sentence parsing.

type JsonObject = Record<string, unknown>;

const JSON_LIST_KEYS = ['items', 'foods', 'food', 'meal', 'meals'];
const JSON_NAME_KEYS = ['name', 'name_vi', 'nameVi', 'name_de', 'nameDe', 'food', 'dish'];
const JSON_EN_KEYS = ['name_en', 'nameEn', 'english'];
const JSON_GRAM_KEYS = ['grams', 'gram', 'g', 'weight_g', 'weightG', 'weight', 'ml', 'amount_g'];
const JSON_MEALS: Record<string, MealType> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

export function parseMealJson(text: string): DecodedMealItem[] | null {
  const body = jsonBody(text);
  if (!body) return null;
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const top = isObject(data) ? data : null;
  const list = Array.isArray(data) ? data : top ? JSON_LIST_KEYS.map((k) => top[k]).find(Array.isArray) : null;
  if (!Array.isArray(list)) return null;
  const shared = top ? jsonTime(top) : null;
  const items = list
    .filter(isObject)
    .map((entry) => jsonItem(entry, shared))
    .filter((item): item is DecodedMealItem => item != null);
  return items.length > 0 ? items : null;
}

function jsonBody(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const source = (fenced ? fenced[1] : text).trim();
  const start = source.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(source.lastIndexOf('}'), source.lastIndexOf(']'));
  return end > start ? source.slice(start, end + 1) : null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function firstString(entry: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(entry: JsonObject, keys: string[]): number | null {
  for (const key of keys) {
    const value = entry[key];
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function jsonItem(entry: JsonObject, shared: MealTimeHint | null): DecodedMealItem | null {
  const english = firstString(entry, JSON_EN_KEYS);
  const name = firstString(entry, JSON_NAME_KEYS) ?? english;
  if (!name) return null;

  let quantity: number | null = null;
  let unit: DecodedUnit | null = null;
  const grams = firstNumber(entry, JSON_GRAM_KEYS);
  if (grams != null) {
    quantity = grams;
    unit = { word: 'g', unit: { kind: 'mass', gramsPer: 1 } };
  } else {
    quantity = firstNumber(entry, ['quantity', 'count', 'amount', 'qty']);
    const unitWord = firstString(entry, ['unit', 'units']);
    const known = unitWord ? unitWordFor(unitWord) : undefined;
    if (quantity != null && unitWord && known) unit = { word: unitWord.toLowerCase(), unit: known };
  }

  const own = jsonTime(entry);
  return {
    raw: name,
    foodQuery: name.toLowerCase(),
    fallbackQuery: null,
    altQuery: english && english !== name ? english.toLowerCase() : null,
    quantity,
    unit,
    time: own ?? shared,
  };
}

function jsonTime(entry: JsonObject): MealTimeHint | null {
  const clock = firstString(entry, ['time', 'eaten_at', 'eatenAt']);
  const match = clock ? /^(\d{1,2})[:h.](\d{2})/.exec(clock) : null;
  const mealWord = firstString(entry, ['meal', 'meal_type', 'mealType']);
  const meal = mealWord ? (JSON_MEALS[mealWord.toLowerCase()] ?? null) : null;
  const offset = typeof entry.day_offset === 'number' ? entry.day_offset : null;
  const hour = match && Number(match[1]) <= 23 ? Number(match[1]) : null;
  if (hour == null && meal == null && offset == null) return null;
  return {
    dayOffset: offset != null && offset <= 0 ? Math.round(offset) : null,
    hour,
    minute: hour != null && match ? Math.min(59, Number(match[2])) : null,
    meal,
  };
}

function unitAt(tokens: string[], i: number): { unit: DecodedUnit; length: number } | null {
  const multi = MULTI_WORD_UNITS.find((m) => m.tokens.every((w, k) => tokens[i + k] === w));
  if (multi) {
    return { unit: { word: multi.tokens.join(' '), unit: multi.unit }, length: multi.tokens.length };
  }
  const tok = tokens[i];
  if (tok == null) return null;
  const unit = unitWordFor(tok);
  return unit ? { unit: { word: tok, unit }, length: 1 } : null;
}

// Drops "rưỡi" (adds half) and size words ("lớn", "large") right after a unit.
function skipAfterUnit(tokens: string[], from: number, used: Set<number>, addHalf: () => void): number {
  let i = from;
  while (i < tokens.length && (HALF_MORE_WORDS.has(tokens[i]) || SIZE_WORDS.has(tokens[i]))) {
    if (HALF_MORE_WORDS.has(tokens[i])) addHalf();
    used.add(i);
    i += 1;
  }
  return i;
}

function toHint(time: PieceTime): MealTimeHint | null {
  const { dayOffset, meal, phraseHour, phraseMinute, clockHour, clockMinute, ampm } = time;
  if (dayOffset == null && meal == null && phraseHour == null && clockHour == null) return null;

  let hour: number | null = null;
  let minute: number | null = null;
  if (clockHour != null) {
    hour = clockHour;
    minute = clockMinute ?? 0;
    const night = phraseHour != null && phraseHour >= 21;
    const evening = meal === 'dinner' || (phraseHour != null && phraseHour >= 12);
    if (ampm === 'pm' && hour < 12) hour += 12;
    else if (ampm === 'am' && hour === 12) hour = 0;
    else if (ampm == null && evening && hour < 12 && !(night && hour <= 4)) hour += 12;
    else if (ampm == null && meal === 'lunch' && hour <= 5) hour += 12;
  } else if (phraseHour != null) {
    hour = phraseHour;
    minute = phraseMinute ?? 0;
  }
  return { dayOffset, hour, minute, meal };
}

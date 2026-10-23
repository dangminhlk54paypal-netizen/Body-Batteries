import type { FoodItem, FoodLogEntry, MealType, ServingPreset } from '../../../types/food';
import type { MealWindow } from '../../../lib/constants';
import { addDaysToDateString, dateString } from '../../../lib/dateUtils';
import { gramsForPortion, nutritionForGrams } from '../foodNutrition';
import { isPortionCounted } from '../portionUnits';
import { validateBackfillDate } from '../backfillEngine';
import { foldWord, unitWordFor } from './mealTextLexicon';
import type { DecodedMealItem, DecodedUnit, MealTimeHint } from './parseMealText';

// "Nạp bằng chữ", step 3 — Mapping & Validation. Turns decoded rows into
// draft rows the user reviews before anything is logged: which catalog food,
// how many grams, eaten when, and what deserves a second look. Pure: the food
// search, the override lookup and the clock come in through MealTextContext,
// so the domain never reads the store (AGENTS.md §3) and every rule is
// unit-tested.
//
// Logging is always an INSERT: two bowls of phở are two bowls. A food already
// logged around the same time is flagged 'duplicate' and starts unticked,
// with the earlier entry attached so the UI can say what it collides with —
// the user decides, nothing is merged or overwritten.

export type MealDraftIssue =
  | 'noMatch' // no catalog food for this text
  | 'futureTime' // eaten "later today"
  | 'tooOld' // further back than the backfill window
  | 'invalidAmount' // 0 g
  | 'duplicate' // the same food is already logged around that time
  | 'fuzzyMatch' // matched only with typos / some of the words
  | 'unitGuess' // a unit the food has no preset for — one serving each
  | 'largeAmount' // more than LARGE_AMOUNT_G
  | 'defaultAmount' // no amount said, never eaten before — default serving
  | 'usualAmount'; // no amount said — the user's last portion of this food

// The order the UI explains them in (most important first).
export const ISSUE_ORDER: MealDraftIssue[] = [
  'noMatch',
  'futureTime',
  'tooOld',
  'invalidAmount',
  'duplicate',
  'fuzzyMatch',
  'unitGuess',
  'largeAmount',
  'defaultAmount',
  'usualAmount',
];

// A row with one of these can't be logged until it is fixed.
const BLOCKING: ReadonlySet<MealDraftIssue> = new Set<MealDraftIssue>([
  'noMatch',
  'futureTime',
  'tooOld',
  'invalidAmount',
]);

export type AmountSource =
  | 'explicit' // "200g"
  | 'preset' // "2 chén" → the food's chén preset
  | 'count' // "2 hộp" of a food counted in hộp
  | 'perServing' // "2 trứng" → 2 × default serving
  | 'unitGuess' // "1 ly" of a food with no ly preset → 1 × default serving
  | 'usual' // nothing said → last logged portion
  | 'default' // nothing said, never logged → default serving
  | 'manual'; // edited by the user

export interface MealDraftRow {
  id: string;
  decoded: DecodedMealItem;
  food: FoodItem | null;
  match: 'exact' | 'fuzzy' | 'none' | 'manual';
  grams: number;
  // Set for foods counted in packs/capsules/servings ("2 hộp"); grams above
  // is then the converted total, exactly like FoodLogEntry.count.
  count: number | null;
  amountSource: AmountSource;
  timestamp: number; // when it was eaten (unix ms)
  duplicate: FoodLogEntry | null;
  issues: MealDraftIssue[];
  selected: boolean;
}

export interface MealTextContext {
  now: number;
  today: string; // YYYY-MM-DD
  // The day the sheet is logging for — today, or a past day opened from
  // History. Rows that name no day land here.
  baseDate: string;
  maxDaysBack: number;
  mealWindows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow>;
  // Recent food log: the "usual portion" source and the duplicate check.
  recentLog: FoodLogEntry[];
  search: (query: string) => { matches: FoodItem[]; similar: FoodItem[] };
  // The live FoodItem with the user's nutrition override applied.
  resolve: (id: string) => FoodItem | undefined;
}

export const LARGE_AMOUNT_G = 2000;
export const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;
// A clock time a minute ahead still counts as "now" (the minute rolls over
// while the user reviews the list).
const FUTURE_GRACE_MS = 60 * 1000;
const SNACK_TIME = { hour: 15, minute: 30 };

const BLANK_DECODED: DecodedMealItem = {
  raw: '',
  foodQuery: '',
  fallbackQuery: null,
  altQuery: null,
  quantity: null,
  unit: null,
  time: null,
};

export function buildMealDraft(items: DecodedMealItem[], ctx: MealTextContext): MealDraftRow[] {
  return items.map((item, index) => {
    const { food, match, decoded } = findFood(item, ctx);
    return validate(
      {
        id: `t${index}`,
        decoded,
        food,
        match,
        ...amountFor(decoded, food, ctx),
        timestamp: timestampFor(decoded.time, ctx),
        duplicate: null,
        issues: [],
        selected: true,
      },
      ctx,
      true
    );
  });
}

// A row added by hand ("＋ Thêm món") at the given moment.
export function manualRow(id: string, food: FoodItem, timestamp: number, ctx: MealTextContext): MealDraftRow {
  return validate(
    {
      id,
      decoded: BLANK_DECODED,
      food,
      match: 'manual',
      ...amountFor(BLANK_DECODED, food, ctx),
      timestamp,
      duplicate: null,
      issues: [],
      selected: true,
    },
    ctx,
    true
  );
}

// ── Edits from the review list ───────────────────────────────────────────

export function withFood(row: MealDraftRow, food: FoodItem, ctx: MealTextContext): MealDraftRow {
  return validate({ ...row, food, match: 'manual', ...amountFor(row.decoded, food, ctx) }, ctx);
}

// `value` is a count for counted foods, grams otherwise.
export function withAmount(row: MealDraftRow, value: number, ctx: MealTextContext): MealDraftRow {
  if (!row.food) return row;
  const amount =
    row.count != null
      ? { count: value, grams: gramsForPortion(row.food, value) }
      : { count: null, grams: value };
  return validate({ ...row, ...amount, amountSource: 'manual' }, ctx);
}

export function withTimestamp(row: MealDraftRow, timestamp: number, ctx: MealTextContext): MealDraftRow {
  return validate({ ...row, timestamp }, ctx);
}

// The −/+ step: half a portion below one, then whole portions; grams in
// steps that make sense for the size (a 30 g sauce vs a 600 g bowl).
export function amountStep(row: MealDraftRow): number {
  if (row.count != null) return row.count <= 1 ? 0.5 : 1;
  if (row.grams < 100) return 10;
  if (row.grams < 500) return 25;
  return 50;
}

export function stepAmount(row: MealDraftRow, direction: 1 | -1, ctx: MealTextContext): MealDraftRow {
  const current = row.count ?? row.grams;
  // Stepping down uses the band just below, so 100 g → 90 g and 1 → 0.5.
  const below = row.count != null ? { count: current - 0.01 } : { grams: current - 1 };
  const step = amountStep(direction === 1 ? row : { ...row, ...below });
  const next = round2(current + direction * step);
  if (next <= 0) return row;
  return withAmount(row, next, ctx);
}

export function isBlocked(row: MealDraftRow): boolean {
  return row.issues.some((issue) => BLOCKING.has(issue));
}

export function toggleRow(row: MealDraftRow): MealDraftRow {
  return isBlocked(row) ? row : { ...row, selected: !row.selected };
}

export function rowKcal(row: MealDraftRow): number {
  return row.food ? nutritionForGrams(row.food, row.grams).energyKcal : 0;
}

// What "Nạp n món" will log.
export function draftTotals(rows: MealDraftRow[]): { count: number; kcal: number } {
  const chosen = rows.filter((row) => row.selected && !isBlocked(row));
  return { count: chosen.length, kcal: chosen.reduce((sum, row) => sum + rowKcal(row), 0) };
}

// The local moment `day` (YYYY-MM-DD) at hour:minute.
export function atLocalTime(day: string, hour: number, minute: number): number {
  const d = new Date(`${day}T00:00:00`);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// ── Mapping ──────────────────────────────────────────────────────────────

function findFood(
  decoded: DecodedMealItem,
  ctx: MealTextContext
): { food: FoodItem | null; match: MealDraftRow['match']; decoded: DecodedMealItem } {
  const resolve = (item: FoodItem) => ctx.resolve(item.id) ?? item;
  // "ba chỉ nướng", "cá ba sa" — when the phrase WITH the number word names a
  // food, that word was part of the name ("hai trứng" names none).
  const asName = decoded.fallbackQuery
    ? { ...decoded, foodQuery: decoded.fallbackQuery, fallbackQuery: null, quantity: null }
    : null;
  if (asName) {
    const whole = ctx.search(asName.foodQuery).matches[0];
    if (whole) return { food: resolve(whole), match: 'exact', decoded: asName };
    // "ba chỉ nướng" → "ba chỉ" (two words at least, so a lone "hai" never
    // turns into a name). Tried before the number reading, whose leftover
    // "chỉ nướng" can still hit an unrelated food through typo tolerance.
    const shorterName = shrinkingMatch(asName.foodQuery, 2, ctx);
    if (shorterName) return { food: resolve(shorterName), match: 'fuzzy', decoded: asName };
  }
  const primary = ctx.search(decoded.foodQuery);
  if (primary.matches.length > 0) return { food: resolve(primary.matches[0]), match: 'exact', decoded };
  // The English name an AI answer gave alongside ("name_en").
  const alt = decoded.altQuery ? ctx.search(decoded.altQuery) : null;
  if (alt && alt.matches.length > 0) return { food: resolve(alt.matches[0]), match: 'exact', decoded };
  // Nothing has every word — drop words from the end: "bánh mì trứng" →
  // "bánh mì", "ức gà nướng mật ong" → "ức gà". Closer than a typo match.
  const shorter =
    shrinkingMatch(decoded.foodQuery, 1, ctx) ?? (decoded.altQuery ? shrinkingMatch(decoded.altQuery, 1, ctx) : null);
  if (shorter) return { food: resolve(shorter), match: 'fuzzy', decoded };
  const near = primary.similar[0] ?? alt?.similar[0];
  if (near) return { food: resolve(near), match: 'fuzzy', decoded };
  return { food: null, match: 'none', decoded };
}

function shrinkingMatch(query: string, minWords: number, ctx: MealTextContext): FoodItem | null {
  const words = query.split(/\s+/).filter(Boolean);
  for (let n = words.length - 1; n >= minWords; n -= 1) {
    const found = ctx.search(words.slice(0, n).join(' ')).matches[0];
    if (found) return found;
  }
  return null;
}

function amountFor(
  decoded: DecodedMealItem,
  food: FoodItem | null,
  ctx: MealTextContext
): { grams: number; count: number | null; amountSource: AmountSource } {
  const { quantity, unit } = decoded;
  const massGrams = quantity != null && unit?.unit.kind === 'mass' ? quantity * unit.unit.gramsPer : null;
  if (!food) return { grams: massGrams ?? 0, count: null, amountSource: 'default' };

  const counted = isPortionCounted(food.portionUnit);
  const servingWeight = food.servingWeightG ?? 0;
  if (massGrams != null) {
    return {
      grams: massGrams,
      count: counted && servingWeight > 0 ? round2(massGrams / servingWeight) : null,
      amountSource: 'explicit',
    };
  }
  if (quantity != null) {
    const preset = unit ? matchPreset(food.servingPresets, unit) : null;
    if (preset) return { grams: quantity * preset.grams, count: null, amountSource: 'preset' };
    if (counted) return { grams: gramsForPortion(food, quantity), count: quantity, amountSource: 'count' };
    return {
      grams: quantity * food.defaultServingG,
      count: null,
      amountSource: unit ? 'unitGuess' : 'perServing',
    };
  }
  const usual = latestEntry(ctx.recentLog, food.id);
  if (usual) {
    return {
      grams: usual.grams,
      count: counted ? (usual.count ?? null) : null,
      amountSource: 'usual',
    };
  }
  return counted
    ? { grams: gramsForPortion(food, 1), count: 1, amountSource: 'default' }
    : { grams: food.defaultServingG, count: null, amountSource: 'default' };
}

// "2 chén" → the food's "chén" preset; "1 tô" → any bowl-type preset.
function matchPreset(presets: ServingPreset[], unit: DecodedUnit): ServingPreset | null {
  const firstWord = (label: string) => label.trim().split(/\s+/)[0] ?? '';
  const word = foldWord(unit.word);
  const same = presets.find((p) => foldWord(firstWord(p.label)) === word);
  if (same) return same;
  if (unit.unit.kind !== 'portion') return null;
  const group = unit.unit.group;
  return (
    presets.find((p) => {
      const presetUnit = unitWordFor(firstWord(p.label));
      return presetUnit?.kind === 'portion' && presetUnit.group === group;
    }) ?? null
  );
}

function latestEntry(log: FoodLogEntry[], foodId: string): FoodLogEntry | null {
  let latest: FoodLogEntry | null = null;
  for (const entry of log) {
    if (entry.foodId === foodId && (!latest || entry.timestamp > latest.timestamp)) latest = entry;
  }
  return latest;
}

function timestampFor(hint: MealTimeHint | null, ctx: MealTextContext): number {
  const day = hint?.dayOffset != null ? addDaysToDateString(ctx.today, hint.dayOffset) : ctx.baseDate;
  if (hint?.hour != null) return atLocalTime(day, hint.hour, hint.minute ?? 0);
  if (hint?.meal) {
    const { hour, minute } = mealTime(hint.meal, ctx.mealWindows);
    return atLocalTime(day, hour, minute);
  }
  // Nothing said: now for today, noon for a past day (FoodLogModal's rule).
  return day === ctx.today ? ctx.now : atLocalTime(day, 12, 0);
}

// The middle of the user's own meal window ("sáng" with 5–10h → 7:30).
function mealTime(
  meal: MealType,
  windows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow>
): { hour: number; minute: number } {
  if (meal === 'snack') return SNACK_TIME;
  const w = windows[meal];
  const middle = (w.startHour + w.endHour) / 2;
  return { hour: Math.floor(middle), minute: Math.round((middle % 1) * 60) };
}

// ── Validation ───────────────────────────────────────────────────────────

function validate(row: MealDraftRow, ctx: MealTextContext, initial = false): MealDraftRow {
  const issues = new Set<MealDraftIssue>();
  if (!row.food) issues.add('noMatch');
  else if (row.match === 'fuzzy') issues.add('fuzzyMatch');

  if (row.food) {
    if (row.amountSource === 'usual') issues.add('usualAmount');
    if (row.amountSource === 'default') issues.add('defaultAmount');
    if (row.amountSource === 'unitGuess') issues.add('unitGuess');
    if (!(row.grams > 0)) issues.add('invalidAmount');
    else if (row.grams > LARGE_AMOUNT_G) issues.add('largeAmount');
  }

  const day = validateBackfillDate(dateString(new Date(row.timestamp)), ctx.today, ctx.maxDaysBack);
  if (!day.ok) issues.add(day.reason === 'future' ? 'futureTime' : 'tooOld');
  else if (row.timestamp > ctx.now + FUTURE_GRACE_MS) issues.add('futureTime');

  const duplicate = row.food ? closestEntry(ctx.recentLog, row.food.id, row.timestamp) : null;
  if (duplicate) issues.add('duplicate');

  const next: MealDraftRow = {
    ...row,
    duplicate,
    issues: ISSUE_ORDER.filter((issue) => issues.has(issue)),
  };
  const blocked = isBlocked(next);
  const wasBlocked = !initial && isBlocked(row);
  // A row starts ticked unless it is blocked or a duplicate. An edit never
  // re-ticks a row the user unticked — only one that edit just unblocked.
  next.selected = blocked ? false : initial || wasBlocked ? duplicate == null : row.selected;
  return next;
}

function closestEntry(log: FoodLogEntry[], foodId: string, timestamp: number): FoodLogEntry | null {
  let best: FoodLogEntry | null = null;
  for (const entry of log) {
    if (entry.foodId !== foodId) continue;
    const gap = Math.abs(entry.timestamp - timestamp);
    if (gap > DUPLICATE_WINDOW_MS) continue;
    if (!best || gap < Math.abs(best.timestamp - timestamp)) best = entry;
  }
  return best;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

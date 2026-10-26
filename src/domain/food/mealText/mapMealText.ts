import type { Language } from '../../../i18n/types';
import type { FoodItem, FoodLogEntry, MealType, MeasureUnit, ServingPreset } from '../../../types/food';
import type { MealWindow } from '../../../lib/constants';
import { addDaysToDateString, dateString } from '../../../lib/dateUtils';
import { gramsForPortion, nutritionForGrams } from '../foodNutrition';
import { isPortionCounted } from '../portionUnits';
import { validateBackfillDate } from '../backfillEngine';
import { withLocalName } from '../foodNameText';
import { foldWord, unitWordFor } from './mealTextLexicon';
import type { DecodedMealItem, DecodedUnit, MealTimeHint } from './parseMealText';
import {
  aiNutritionDiffers,
  aiNutritionLooksOff,
  completeNutrition,
  type DoubtfulValue,
  type StatedNutrition,
} from './aiNutrition';

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
//
// A row whose text came with nutrition numbers (an AI analysis, see
// aiNutrition.ts) carries an AiRow: the app's own food is kept by default and
// the user can switch to the AI's numbers — updating that food — or save the
// answer as a new "Món của tôi". Nothing is written until aiSavePlan runs.

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
  | 'aiCheck' // the AI's numbers don't add up (kcal vs macros, > 900 kcal/100 g)
  | 'aiDoubt' // a mineral read as thousands ("1.500 mg") is far above any food
  | 'aiBasis' // the AI didn't say what amount its numbers are for — read as /100 g
  | 'aiCompare' // the AI's numbers differ from the app's food
  | 'aiNew' // saved as a new "Món của tôi" on logging
  | 'usualAmount'; // no amount said — the user's last portion of this food

// The order the UI explains them in (most important first).
export const ISSUE_ORDER: MealDraftIssue[] = [
  'noMatch',
  'futureTime',
  'tooOld',
  'invalidAmount',
  'duplicate',
  'aiCheck',
  'aiDoubt',
  'aiBasis',
  'fuzzyMatch',
  'unitGuess',
  'largeAmount',
  'defaultAmount',
  'aiCompare',
  'aiNew',
  'usualAmount',
];

// Notes that only inform — the row still shows ✓.
export const INFO_ISSUES: ReadonlySet<MealDraftIssue> = new Set<MealDraftIssue>(['usualAmount', 'aiCompare', 'aiNew']);

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

// What a row does with the nutrition an AI answer gave:
//   'app' — log the app's food as it is (the AI's numbers are only shown);
//   'ai'  — update the app's food with them, saved as a ✎ override the user
//           can restore like any hand edit (only the stated fields change);
//   'new' — save the answer as a new "Món của tôi".
export type AiChoice = 'app' | 'ai' | 'new';

export interface AiRow {
  stated: StatedNutrition; // per 100 g, only what the AI stated
  choice: AiChoice;
  base: FoodItem | null; // the app's food the answer names (found or picked)
  name: string; // the new food's name
  nameEn: string;
  measure: MeasureUnit;
  basisGuessed: boolean;
  doubtful: DoubtfulValue[];
}

// Id of the not-yet-saved food of an 'new' row (replaced by aiSavePlan).
export const AI_DRAFT_PREFIX = 'ai_draft_';

export interface MealDraftRow {
  id: string;
  decoded: DecodedMealItem;
  // The food that will be logged — for an AI row, the one its choice gives.
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
  ai: AiRow | null;
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
  // The app language — the AI answers the prompt in it, so a new food's name
  // is filed under that language (withLocalName).
  language: Language;
}

export const LARGE_AMOUNT_G = 2000;
export const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;
// A clock time a minute ahead still counts as "now" (the minute rolls over
// while the user reviews the list).
export const FUTURE_GRACE_MS = 60 * 1000;
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
    const id = `t${index}`;
    const found = findFood(item, ctx);
    const { match, decoded } = found;
    const ai = decoded.ai ? aiRowFor(decoded, found.food, match) : null;
    const food = ai ? aiFood(id, ai, massGramsOf(decoded) ?? 0, ctx.language) : found.food;
    return validate(
      {
        id,
        decoded,
        food,
        match,
        ...amountFor(decoded, food, ctx),
        timestamp: timestampFor(decoded.time, ctx),
        duplicate: null,
        issues: [],
        selected: true,
        ai,
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
      ai: null,
    },
    ctx,
    true
  );
}

// A food with this exact name (all its words) is in the catalog — how the
// whole-day parser tells "gà chạy bộ" (a dish) from "chạy bộ" (a run).
export function hasExactFood(decoded: DecodedMealItem, ctx: MealTextContext): boolean {
  return findFood(decoded, ctx).match === 'exact';
}

// ── Edits from the review list ───────────────────────────────────────────

// Picking another food: an AI row compares its numbers with that food now.
export function withFood(row: MealDraftRow, food: FoodItem, ctx: MealTextContext): MealDraftRow {
  const ai: AiRow | null = row.ai ? { ...row.ai, base: food, choice: 'app' } : null;
  return validate({ ...row, ai, food, match: 'manual', ...amountFor(row.decoded, food, ctx) }, ctx);
}

export function withAiChoice(row: MealDraftRow, choice: AiChoice, ctx: MealTextContext): MealDraftRow {
  if (!row.ai || row.ai.choice === choice) return row;
  const ai = { ...row.ai, choice };
  const food = aiFood(row.id, ai, row.grams, ctx.language);
  if (!food) return row;
  return validate({ ...row, ai, food, ...sameGrams(row.grams, food) }, ctx);
}

// The name a new food from AI numbers is saved under.
export function withAiName(row: MealDraftRow, name: string, ctx: MealTextContext): MealDraftRow {
  const trimmed = name.trim();
  if (!row.ai || row.ai.choice !== 'new' || !trimmed || trimmed === row.ai.name) return row;
  const ai = { ...row.ai, name: trimmed };
  return validate({ ...row, ai, food: aiFood(row.id, ai, row.grams, ctx.language) }, ctx);
}

// After aiSavePlan's foods are written: the row logs the saved food.
export function withSavedFood(row: MealDraftRow, food: FoodItem, ctx: MealTextContext): MealDraftRow {
  return validate({ ...row, ai: null, food }, ctx);
}

export interface AiSaveStep {
  kind: 'add' | 'update';
  food: FoodItem;
  rowIds: string[];
}

// What saving these rows' AI numbers writes: one new "Món của tôi" per
// distinct name (two rows of the same new dish share it), one update per app
// food. `newId` makes a real custom-food id — impure, so the caller passes it.
export function aiSavePlan(rows: MealDraftRow[], newId: () => string): AiSaveStep[] {
  const steps = new Map<string, AiSaveStep>();
  for (const row of rows) {
    if (!row.ai || row.ai.choice === 'app' || !row.food) continue;
    const key =
      row.ai.choice === 'new'
        ? `new:${foldWord(row.ai.name) || row.id}`
        : `update:${row.food.id}`;
    const step = steps.get(key);
    if (step) step.rowIds.push(row.id);
    else if (row.ai.choice === 'new') steps.set(key, { kind: 'add', food: { ...row.food, id: newId() }, rowIds: [row.id] });
    else steps.set(key, { kind: 'update', food: row.food, rowIds: [row.id] });
  }
  return [...steps.values()];
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

// The app's food is kept when the answer names it exactly; a near match
// ("bánh mì" for "bánh mì trứng") or none means the AI described something
// the app doesn't have — saved as new, the near match still one tap away.
function aiRowFor(decoded: DecodedMealItem, found: FoodItem | null, match: MealDraftRow['match']): AiRow {
  const ai = decoded.ai!;
  return {
    stated: ai.per100g,
    choice: found && match === 'exact' ? 'app' : 'new',
    base: found,
    name: decoded.raw.trim(),
    nameEn: decoded.nameEn ?? '',
    measure: ai.measure,
    basisGuessed: ai.basisGuessed,
    doubtful: ai.doubtful ?? [],
  };
}

function aiFood(rowId: string, ai: AiRow, grams: number, language: Language): FoodItem | null {
  if (ai.choice === 'app') return ai.base;
  if (ai.choice === 'ai') return ai.base && { ...ai.base, per100g: { ...ai.base.per100g, ...ai.stated } };
  const food: FoodItem = {
    id: `${AI_DRAFT_PREFIX}${rowId}`,
    nameVi: '',
    nameEn: ai.nameEn,
    category: 'custom',
    defaultServingG: grams > 0 ? Math.round(grams) : 100,
    servingPresets: [],
    per100g: completeNutrition(ai.stated),
    source: 'custom',
    note: '',
    portionUnit: 'gram',
    measureUnit: ai.measure,
  };
  return withLocalName(food, language, ai.name);
}

// Switching food keeps the amount the user sees, in grams.
function sameGrams(grams: number, food: FoodItem): { grams: number; count: number | null } {
  const weight = food.servingWeightG ?? 0;
  return {
    grams,
    count: isPortionCounted(food.portionUnit) && weight > 0 ? round2(grams / weight) : null,
  };
}

function massGramsOf(decoded: DecodedMealItem): number | null {
  const { quantity, unit } = decoded;
  return quantity != null && unit?.unit.kind === 'mass' ? quantity * unit.unit.gramsPer : null;
}

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
  const massGrams = massGramsOf(decoded);
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
  const clock = hintClock(hint, ctx.mealWindows);
  if (clock) return atLocalTime(day, clock.hour, clock.minute);
  // Nothing said: now for today, noon for a past day (FoodLogModal's rule).
  return day === ctx.today ? ctx.now : atLocalTime(day, 12, 0);
}

// The time of day a hint names: its clock, else the middle of its meal
// window. Shared with workouts said in the same text (activityText).
export function hintClock(
  hint: MealTimeHint | null,
  windows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow>
): { hour: number; minute: number } | null {
  if (hint?.hour != null) return { hour: hint.hour, minute: hint.minute ?? 0 };
  return hint?.meal ? mealTime(hint.meal, windows) : null;
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
  else if (row.match === 'fuzzy' && row.ai?.choice !== 'new') issues.add('fuzzyMatch');

  if (row.ai) {
    if (aiNutritionLooksOff(row.ai.stated)) issues.add('aiCheck');
    // Only when the AI's numbers are the ones logged.
    if (row.ai.choice !== 'app' && row.ai.doubtful.length > 0) issues.add('aiDoubt');
    if (row.ai.basisGuessed) issues.add('aiBasis');
    if (row.ai.choice === 'new') issues.add('aiNew');
    else if (row.ai.base && aiNutritionDiffers(row.ai.base.per100g, row.ai.stated)) issues.add('aiCompare');
  }

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

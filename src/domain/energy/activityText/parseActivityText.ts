import { translate } from '../../../i18n/translate';
import type { Language } from '../../../i18n/types';
import { BODYBUILDING_EXERCISES } from '../../../lib/bodybuildingExercises';
import type { ActivityType, CustomActivity, CustomExercise, LiftingExercise, LiftingSet } from '../../../types/energy';
import { foldWord, NUMBER_WORDS } from '../../food/mealText/mealTextLexicon';
import { isFiller, readPieceTime, type MealTimeHint } from '../../food/mealText/parseMealText';
import { parseSetNotation } from '../../training/setNotation';
import {
  ACTIVITY_FILLER_WORDS,
  ACTIVITY_PHRASES,
  AND_A_HALF_WORDS,
  CLOCK_MARKERS,
  CLOCK_OR_HOUR_WORDS,
  DAY_PART_WORDS,
  HOUR_WORDS,
  KG_WORDS,
  KM_PHRASES,
  KM_WORDS,
  LIFT_PHRASES,
  MINUTE_WORDS,
  ONE_AND_A_HALF_WORDS,
  RANGE_JOINERS,
  REP_WORDS,
  SET_WORDS,
  STEP_WORDS,
  THOUSAND_WORDS,
} from './activityTextLexicon';

// "Kể cả ngày", the workout half of Decoding: one piece of text that names a
// workout ("sáng 6h chạy bộ 30 phút", "squat 5x5 100kg", "đi bộ 8000 bước")
// → what was done, for how long, how many steps / which sets, and when.
// Pure: no store, no clock. Which activity row it becomes (and its kcal) is
// mapActivityText.ts; how a whole day's text is cut into food and workout
// pieces is dayText/parseDayText.ts.
//
// The amounts are taken out BEFORE the time words are read
// (food/mealText readPieceTime), so "chạy 1 giờ" is one hour of running, not
// a run at 1 o'clock — "lúc 6 giờ", "6h sáng" and "từ 6h đến 7h" stay clock
// times.

export type ActivityMatch =
  | { kind: 'type'; type: ActivityType }
  | { kind: 'lift'; exercise: LiftingExercise }
  | { kind: 'bodybuilding'; exerciseId: string } // built-in id or a custom exercise's id
  | { kind: 'custom'; id: string }; // a CustomActivity

export interface ActivityName {
  tokens: string[];
  match: ActivityMatch;
}

export interface DecodedActivity {
  raw: string; // the piece as typed, trimmed
  name: string; // the words left once amounts and times are out ("leo núi")
  // Of those, the ones that are not the activity's name ("gà" in "gà chạy
  // bộ") — with nothing but a name said, the day parser checks them against
  // the food catalog.
  extra: string;
  match: ActivityMatch | null;
  // Only a name was said — no duration, steps, sets or range — so the day
  // parser lets an exact food name win ("gà chạy bộ", "bơ").
  keywordOnly: boolean;
  minutes: number | null;
  fromRange: boolean; // minutes came from "6h–7h"
  steps: number | null;
  distanceKm: number | null;
  sets: LiftingSet[] | null;
  time: MealTimeHint | null;
}

// Every name a workout can be said by: the built-in keywords, the
// bodybuilding library in all three languages ("Kéo xô (Lat Pulldown)" →
// "kéo xô" and "lat pulldown"), and the user's own activities / exercises.
// Longest first, so "đẩy ngực tạ đơn" (an exercise) wins over "đẩy ngực"
// (bench press) and "đi bộ nhanh" over "đi bộ".
export function buildActivityNames(
  customActivities: CustomActivity[] = [],
  customExercises: CustomExercise[] = []
): ActivityName[] {
  const names: ActivityName[] = [];
  for (const a of customActivities) names.push({ tokens: tokenizeName(a.nameVi), match: { kind: 'custom', id: a.id } });
  for (const e of customExercises) {
    names.push({ tokens: tokenizeName(e.nameVi), match: { kind: 'bodybuilding', exerciseId: e.id } });
  }
  const languages: Language[] = ['vi', 'en', 'de'];
  for (const ex of BODYBUILDING_EXERCISES) {
    for (const language of languages) {
      for (const part of translate(language, `bbExercises.${ex.id}`).split(/[()]/)) {
        names.push({ tokens: tokenizeName(part), match: { kind: 'bodybuilding', exerciseId: ex.id } });
      }
    }
  }
  for (const l of LIFT_PHRASES) names.push({ tokens: l.tokens, match: { kind: 'lift', exercise: l.exercise } });
  for (const a of ACTIVITY_PHRASES) {
    names.push({ tokens: a.tokens, match: { kind: 'type', type: a.type } });
  }
  // Custom names first among equals: the user's own words win a tie.
  return names
    .filter((n) => n.tokens.length > 0)
    .map((n, order) => ({ n, order }))
    .sort((a, b) => b.n.tokens.length - a.n.tokens.length || a.order - b.order)
    .map(({ n }) => n);
}

function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// ── Tokens ───────────────────────────────────────────────────────────────

const NUMBER = /^\d+(?:\.\d+)?$/;
const THOUSANDS = /^\d{1,3}(?:\.\d{3})+$/; // "8.000" (a "8,000" was made "8.000" by splitPieces)
const CLOCK_TOKEN = /^(\d{1,2}):(\d{2})$/;
const SET_TOKEN = /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)+(?:@\d+(?:\.\d+)?)?$/;
const MAX_REPS_IN_PAIR = 30; // "3x100" is 3 reps at 100 kg, "3x10" is 3 sets of 10

function tokenize(raw: string): string[] {
  const s = raw
    .toLowerCase()
    .normalize('NFC')
    .replace(/½/g, ' 0.5 ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[×*]/g, 'x')
    .replace(/(\d)\s*x\s*(?=\d)/g, '$1x')
    .replace(/(\d)\s*@\s*(?=\d)/g, '$1@');
  const tokens: string[] = [];
  for (const chunk of s.split(/[\s;!?()[\]{}"“”‘’…]+/)) {
    for (const piece of chunk.replace(/\.+$/, '').split(/([-–~])/)) {
      if (!piece) continue;
      if (CLOCK_TOKEN.test(piece) || SET_TOKEN.test(piece)) {
        tokens.push(piece);
        continue;
      }
      const set = /^(.+?)(kgs?)$/.exec(piece);
      if (set && SET_TOKEN.test(set[1])) {
        tokens.push(set[1], set[2]);
        continue;
      }
      // "30p" → "30" "p", "1h30" → "1" "h" "30", "100kg" → "100" "kg".
      tokens.push(...(piece.match(/\d+(?:\.\d+)?|[^\d]+/g) ?? []));
    }
  }
  return tokens.filter(Boolean);
}

function numberAt(tokens: string[], i: number): { value: number; length: number } | null {
  const tok = tokens[i];
  if (tok == null) return null;
  if (NUMBER.test(tok)) return { value: Number(tok), length: 1 };
  if (!Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tok)) return null;
  // Number words multiply: "nửa" 0.5, "half an" 0.5 × 1, "một tiếng".
  let value = NUMBER_WORDS[tok];
  let length = 1;
  while (tokens[i + length] != null && Object.prototype.hasOwnProperty.call(NUMBER_WORDS, tokens[i + length])) {
    value *= NUMBER_WORDS[tokens[i + length]];
    length += 1;
  }
  return { value, length };
}

// ── Decoding ─────────────────────────────────────────────────────────────

interface Clock {
  hour: number;
  minute: number;
  length: number;
  marked: boolean; // said with h / giờ / ":" / am / pm — clearly a time of day
  ampm: 'am' | 'pm' | null;
}

function clockAt(tokens: string[], i: number): Clock | null {
  const tok = tokens[i];
  if (tok == null) return null;
  const colon = CLOCK_TOKEN.exec(tok);
  let hour: number;
  let minute = 0;
  let length = 1;
  let marked = false;
  if (colon) {
    hour = Number(colon[1]);
    minute = Number(colon[2]);
    marked = true;
  } else if (/^\d{1,2}$/.test(tok)) {
    hour = Number(tok);
    const unit = tokens[i + 1];
    if (unit != null && (CLOCK_OR_HOUR_WORDS.has(unit) || unit === 'uhr')) {
      marked = true;
      length = 2;
      const mins = tokens[i + 2];
      if (mins != null && /^\d{2}$/.test(mins) && Number(mins) <= 59) {
        minute = Number(mins);
        length = 3;
      }
    }
  } else return null;
  if (hour > 23 || minute > 59) return null;
  let ampm: Clock['ampm'] = null;
  const after = tokens[i + length];
  if (after === 'am' || after === 'pm') {
    ampm = after;
    marked = true;
    length += 1;
  }
  return { hour, minute, length, marked, ampm };
}

function clockText(clock: Clock): string {
  return `${clock.hour}:${String(clock.minute).padStart(2, '0')}${clock.ampm ? ` ${clock.ampm}` : ''}`;
}

export function decodeActivityPiece(raw: string, names: ActivityName[]): DecodedActivity | null {
  const tokens = tokenize(raw);
  const used = new Set<number>();
  const take = (from: number, length: number) => {
    for (let k = from; k < from + length; k += 1) used.add(k);
  };
  // Text put back for the time reader in place of what was taken out.
  const replaced = new Map<number, string>();

  // 1. A clock range: "6h đến 7h", "6-7h", "từ 17h đến 18h30", "from 6 to 7".
  let minutes: number | null = null;
  let fromRange = false;
  for (let i = 0; i < tokens.length && !fromRange; i += 1) {
    const opener = ['từ', 'tu', 'from', 'von'].includes(tokens[i]);
    const at = opener ? i + 1 : i;
    const start = clockAt(tokens, at);
    if (!start) continue;
    const joiner = at + start.length;
    if (!RANGE_JOINERS.has(tokens[joiner] ?? '')) continue;
    const end = clockAt(tokens, joiner + 1);
    if (!end || !(opener || start.marked || end.marked)) continue;
    const ampm = start.ampm ?? end.ampm;
    const startClock = { ...start, ampm };
    const a = start.hour * 60 + start.minute;
    const b = end.hour * 60 + end.minute;
    // "11h–1h" is two hours; "6h–18h" (24-hour clock) is twelve.
    const cycle = start.hour > 12 || end.hour > 12 ? 1440 : 720;
    const span = (((b - a) % cycle) + cycle) % cycle;
    if (span === 0) continue;
    minutes = span;
    fromRange = true;
    take(i, joiner + 1 + end.length - i);
    replaced.set(i, clockText(startClock));
  }

  // 2. Steps, distance, a length of time.
  let steps: number | null = null;
  let distanceKm: number | null = null;
  // Where a length of time is said with a word that only means that.
  const durationAt = tokens.flatMap((tok, i) =>
    (MINUTE_WORDS.has(tok) || HOUR_WORDS.has(tok)) && i > 0 && numberAt(tokens, i - 1) != null ? [i] : []
  );
  for (let i = 0; i < tokens.length; i += 1) {
    if (used.has(i)) continue;
    if (ONE_AND_A_HALF_WORDS.has(tokens[i]) && isHourWord(tokens[i + 1])) {
      if (minutes == null) minutes = 90;
      take(i, 2);
      continue;
    }
    const n = THOUSANDS.test(tokens[i]) ? { value: Number(tokens[i].replace(/\./g, '')), length: 1 } : numberAt(tokens, i);
    if (!n) continue;
    let next = i + n.length;
    // Steps — "8000 bước", "8k bước", "8 nghìn bước".
    const thousand = THOUSAND_WORDS.has(tokens[next] ?? '');
    if (STEP_WORDS.has(tokens[next + (thousand ? 1 : 0)] ?? '')) {
      steps = Math.round(n.value * (thousand ? 1000 : 1));
      take(i, next + (thousand ? 2 : 1) - i);
      continue;
    }
    // Distance — "5km", "3 cây số", a runner's "5k".
    if (KM_WORDS.has(tokens[next] ?? '') || thousand) {
      distanceKm = n.value;
      take(i, next + 1 - i);
      continue;
    }
    const kmPhrase = KM_PHRASES.find((ph) => ph.every((w, k) => tokens[next + k] === w));
    if (kmPhrase) {
      distanceKm = n.value;
      take(i, next + kmPhrase.length - i);
      continue;
    }
    const unit = tokens[next];
    if (unit == null) continue;
    if (MINUTE_WORDS.has(unit)) {
      if (minutes == null) minutes = n.value;
      take(i, next + 1 - i);
      continue;
    }
    const hourWord = HOUR_WORDS.has(unit);
    if (!hourWord && !(CLOCK_OR_HOUR_WORDS.has(unit) && !isClockHour(tokens, i, n.value, next, durationAt))) {
      continue;
    }
    let total = n.value * 60;
    next += 1;
    if (AND_A_HALF_WORDS.has(tokens[next] ?? '')) {
      total += 30;
      next += 1;
    } else {
      // "1 tiếng 20 phút", "1h30".
      const extra = tokens[next] != null && NUMBER.test(tokens[next]) ? Number(tokens[next]) : null;
      if (extra != null && extra < 60 && (MINUTE_WORDS.has(tokens[next + 1] ?? '') || unit === 'h')) {
        total += extra;
        next += MINUTE_WORDS.has(tokens[next + 1] ?? '') ? 2 : 1;
      }
    }
    if (minutes == null) minutes = total;
    take(i, next - i);
  }

  // 3. Sets — "5x5 100kg", "5x5x100", "4 hiệp 12 cái 30kg", "deadlift 180kg".
  const sets = takeSets(tokens, used, take);

  // 4. What is left: time words, then the activity's name.
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const put = replaced.get(i);
    if (put != null) rest.push(put);
    else if (!used.has(i)) rest.push(tokens[i]);
  }
  const { tokens: words, time } = readPieceTime(rest.join(' '));
  // With sets said, a lift or exercise is what was done — "tập gym: squat
  // 5x5" is a squat, not a session by minutes.
  const found = (sets ? findName(words, names.filter((n) => isSetName(n.match))) : null) ?? findName(words, names);
  const inName = (i: number) => found != null && i >= found.at && i < found.at + found.name.tokens.length;
  const nameWords = words.filter((tok, i) => !inName(i) && !isAmountWord(tok));
  const matchedWords = found ? words.slice(found.at, found.at + found.name.tokens.length) : [];
  const said = minutes != null || steps != null || distanceKm != null || sets != null;
  if (!found && !said) return null;
  return {
    raw: raw.trim(),
    name: [...matchedWords, ...nameWords].join(' '),
    extra: found ? nameWords.join(' ') : '',
    match: found?.name.match ?? null,
    keywordOnly: !said && !fromRange,
    minutes,
    fromRange,
    steps,
    distanceKm,
    sets,
    time,
  };
}

// Words that only said an amount or joined two times — not a name.
function isAmountWord(tok: string): boolean {
  return (
    isFiller(tok) ||
    ACTIVITY_FILLER_WORDS.has(tok) ||
    NUMBER.test(tok) ||
    RANGE_JOINERS.has(tok) ||
    KG_WORDS.has(tok) ||
    SET_WORDS.has(tok) ||
    REP_WORDS.has(tok) ||
    MINUTE_WORDS.has(tok)
  );
}

function isHourWord(tok: string | undefined): boolean {
  return tok != null && (HOUR_WORDS.has(tok) || CLOCK_OR_HOUR_WORDS.has(tok));
}

// "N giờ" / "Nh" is a time of day when something says so — "lúc 6 giờ",
// "6h sáng", "sáng 6h", another length of time in the same piece ("6h chạy
// 30 phút") — or when it is too long to be a workout (> 4 hours).
function isClockHour(tokens: string[], at: number, value: number, unitAt: number, durationAt: number[]): boolean {
  if (!Number.isInteger(value)) return false; // "1.5h"
  // The minutes of this same amount ("1 giờ 20 phút") are not another one.
  const ownMinutes = unitAt + 2;
  if (value > 4 || durationAt.some((d) => d !== ownMinutes)) return true;
  const before = tokens[at - 1];
  if (before != null && (CLOCK_MARKERS.has(before) || DAY_PART_WORDS.has(before))) return true;
  let after = unitAt + 1;
  if (tokens[after] != null && /^\d{2}$/.test(tokens[after])) after += 1;
  return DAY_PART_WORDS.has(tokens[after] ?? '');
}

function takeSets(
  tokens: string[],
  used: Set<number>,
  take: (from: number, length: number) => void
): LiftingSet[] | null {
  // Weights said with a unit: "100kg", "30 kí".
  const weights: { at: number; kg: number }[] = [];
  tokens.forEach((tok, i) => {
    if (!used.has(i) && NUMBER.test(tok) && KG_WORDS.has(tokens[i + 1] ?? '')) weights.push({ at: i, kg: Number(tok) });
  });
  const weightNear = (at: number): number | null => {
    const after = weights.find((w) => w.at > at && !used.has(w.at));
    const pick = after ?? [...weights].reverse().find((w) => w.at < at && !used.has(w.at));
    if (!pick) return null;
    take(pick.at, 2);
    return pick.kg;
  };

  const out: LiftingSet[] = [];
  // Set notation tokens.
  tokens.forEach((tok, i) => {
    if (used.has(i) || !SET_TOKEN.test(tok)) return;
    take(i, 1);
    const parts = tok.split(/[x@]/).map(Number);
    if (parts.length === 2 && !tok.includes('@')) {
      // A bare number right after "5x5" is its weight too ("5x5 100").
      let kg = weightNear(i);
      if (kg == null && tokens[i + 1] != null && NUMBER.test(tokens[i + 1]) && !used.has(i + 1)) {
        kg = Number(tokens[i + 1]);
        take(i + 1, 1);
      }
      const [a, b] = parts;
      if (kg != null || b <= MAX_REPS_IN_PAIR) {
        for (let k = 0; k < a; k += 1) out.push({ kind: 'working', reps: b, weightKg: kg ?? 0 });
        return;
      }
    }
    const parsed = parseSetNotation(tok);
    if (parsed.ok) out.push(...parsed.sets);
  });
  if (out.length > 0) return out;

  // Words: "4 hiệp 12 cái 30kg", "3 sets of 10", "12 cái".
  let count: number | null = null;
  let reps: number | null = null;
  tokens.forEach((tok, i) => {
    if (used.has(i) || !NUMBER.test(tok)) return;
    const unit = tokens[i + 1] ?? '';
    if (SET_WORDS.has(unit) && count == null) {
      count = Number(tok);
      take(i, 2);
    } else if (REP_WORDS.has(unit) && reps == null) {
      reps = Number(tok);
      take(i, 2);
    }
  });
  // "3 sets of 10": the reps come right after.
  if (count != null && reps == null) {
    const at = tokens.findIndex((tok, i) => !used.has(i) && NUMBER.test(tok) && !KG_WORDS.has(tokens[i + 1] ?? ''));
    if (at >= 0) {
      reps = Number(tokens[at]);
      take(at, 1);
    }
  }
  const kg = weightNear(-1);
  if (reps != null) {
    for (let k = 0; k < (count ?? 1); k += 1) out.push({ kind: 'working', reps, weightKg: kg ?? 0 });
    return out;
  }
  // Just a weight — a single ("deadlift 180kg").
  if (kg != null) return [{ kind: 'working', reps: 1, weightKg: kg }];
  return null;
}

function isSetName(match: ActivityMatch): boolean {
  return match.kind === 'lift' || match.kind === 'bodybuilding';
}

// The longest name found as consecutive words. A word typed without
// Vietnamese accents matches the accented keyword ("chay bo" → "chạy bộ").
function findName(words: string[], names: ActivityName[]): { at: number; name: ActivityName } | null {
  for (const name of names) {
    const n = name.tokens.length;
    for (let at = 0; at + n <= words.length; at += 1) {
      if (name.tokens.every((w, k) => sameWord(words[at + k], w))) return { at, name };
    }
  }
  return null;
}

function sameWord(tok: string, word: string): boolean {
  if (tok === word) return true;
  return !/[^ -~äöüß]/.test(tok) && foldWord(tok) === foldWord(word);
}

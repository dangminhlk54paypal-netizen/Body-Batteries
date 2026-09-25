import { translate } from '../../i18n/translate';
import { LOCALE_TAGS } from '../../i18n/types';
import type { Language } from '../../i18n/types';
import { findVariation } from '../../lib/powerliftingVariations';
import { bbExerciseName, isLiftingExercise, workoutLabel } from '../../lib/activityLabels';
import { weekdayLabel } from '../../lib/dateUtils';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../types/energy';
import type {
  DayConflict,
  TrainingLogDayRecord,
  TrainingLogFormat,
  TrainingLogPeriod,
  TrainingLogWeek,
} from '../../types/trainingLog';

// Pure text generation for the "Sổ tập luyện" (training log). Turns logged
// activity into the user's own Notes shorthand, e.g.
//   26.08(77.7kg): S 130 4x3x115+3x100 PD 4x3x100
// Grammar (from the user's real notes, plan §2.2):
//   top single      → 90            (1 rep: just the weight)
//   1 set, N reps   → 3x100         (reps x weight)
//   even sets       → 5x5x72.5      (sets x reps x weight)
//   last set +extra → 6x4(+3)x75    (last set did 3 more reps than the rest)
//   anything else   → 110x(4+5+5+4+8)
//   prime + volume  → 95 + 4x6x72.5 (heaviest warm-up, then the working sets)
// The symbols x + ( ) are notation, not UI words, so they are written inline
// (same as describeLiftingSets). Every WORD goes through translate().
//
// No store access: everything the caller knows (language, format, body
// weight) arrives as a parameter.

const t = (language: Language, key: string, vars?: Record<string, string | number>) =>
  translate(language, key, vars);

// 72.5 → "72.5" ('dot') or the language's own separator ('locale'); never
// "72.0". At most 2 decimals so float noise (72.49999) can't leak into text.
function formatNumber(n: number, format: TrainingLogFormat, language: Language): string {
  if (format.decimal === 'locale') {
    return new Intl.NumberFormat(LOCALE_TAGS[language], {
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(n);
  }
  return String(Math.round(n * 100) / 100);
}

// One cluster = a run of consecutive sets at the same weight.
interface Cluster {
  text: string;
  isTopSingle: boolean; // exactly one set of one rep
}

function clusterRuns(sets: LiftingSet[]): LiftingSet[][] {
  const runs: LiftingSet[][] = [];
  for (const s of sets) {
    const last = runs[runs.length - 1];
    if (last && last[0].weightKg === s.weightKg) last.push(s);
    else runs.push([s]);
  }
  return runs;
}

function clusterOf(run: LiftingSet[], weight: (kg: number) => string): Cluster {
  const w = weight(run[0].weightKg);
  const reps = run.map((s) => s.reps);
  const n = reps.length;
  if (n === 1) {
    return reps[0] === 1
      ? { text: w, isTopSingle: true }
      : { text: `${reps[0]}x${w}`, isTopSingle: false };
  }
  const r = reps[0];
  const head = reps.slice(0, -1);
  const last = reps[n - 1];
  if (head.every((x) => x === r)) {
    if (last === r) return { text: `${n}x${r}x${w}`, isTopSingle: false };
    if (last > r) return { text: `${n}x${r}(+${last - r})x${w}`, isTopSingle: false };
  }
  return { text: `${w}x(${reps.join('+')})`, isTopSingle: false };
}

// Working sets in entry order, optionally preceded by the warm-up ramp. With
// only warm-up sets the ramp is printed regardless of `showWarmups` (an empty
// movement would read as a bug).
export function formatSetSequence(
  sets: LiftingSet[],
  format: TrainingLogFormat,
  language: Language
): string {
  const unit = format.showUnit ? t(language, 'trainingLog.format.weightUnit') : '';
  const weight = (kg: number) => `${formatNumber(kg, format, language)}${unit}`;

  const working = sets.filter((s) => s.kind === 'working' && s.reps > 0);
  const warmups = sets.filter((s) => s.kind === 'warmup' && s.reps > 0);

  const warmupText = warmups
    .map((s) => (s.reps === 1 ? weight(s.weightKg) : `${s.reps}x${weight(s.weightKg)}`))
    .join('+');

  const clusters = clusterRuns(working).map((run) => clusterOf(run, weight));
  let workingText = '';
  clusters.forEach((c, i) => {
    if (i > 0) {
      // A top single reads as its own token: "130 4x3x115", not "130+4x3x115".
      // Consecutive singles ("90+97.5+100") and later clusters still join with +.
      workingText += clusters[i - 1].isTopSingle && !c.isTopSingle ? ' ' : '+';
    }
    workingText += c.text;
  });

  if (working.length === 0) return warmupText;
  if (format.showWarmups && warmupText) return `${warmupText} ${workingText}`;
  const prime = format.showPrime ? primeSet(sets) : null;
  if (prime) {
    const primeText = prime.reps === 1 ? weight(prime.weightKg) : `${prime.reps}x${weight(prime.weightKg)}`;
    return `${primeText}${PRIME_JOIN}${workingText}`;
  }
  return workingText;
}

// Between the prime and the working sets. The spaced "+" is what tells the
// prime apart from a top single ("130 4x3x115") and from clusters
// ("4x3x115+3x100") — splitDayBody and the parser both read it that way.
export const PRIME_JOIN = ' + ';

// The prime: the heaviest warm-up set (the last one when several tie), or null
// without warm-ups.
export function primeSet(sets: LiftingSet[]): LiftingSet | null {
  let best: LiftingSet | null = null;
  for (const s of sets) {
    if (s.kind === 'warmup' && s.reps > 0 && (!best || s.weightKg >= best.weightKg)) best = s;
  }
  return best;
}

// Default abbreviation for a lift / variation id, or null when the locale has
// none (translate() returns the key itself on a miss).
function defaultAbbr(id: string, language: Language): string | null {
  const key = `trainingLog.abbr.${id}`;
  const value = t(language, key);
  return value === key ? null : value;
}

function userAbbr(key: string, format: TrainingLogFormat): string | null {
  const v = format.abbreviations[key];
  return v && v.trim() !== '' ? v.trim() : null;
}

// The stable key a session's abbreviation is stored/overridden under
// (`lift:` / `var:` / `cvar:` / `bb:`), or null when the session has no
// abbreviation concept (custom / plain MET activities). Exported for the
// settings sheet, which lists the overridable keys.
export function abbreviationKeyOf(session: WorkoutSession): string | null {
  if (session.bbMet != null) return session.bbExerciseId ? `bb:${session.bbExerciseId}` : null;
  if (!isLiftingExercise(session.type)) return null;
  if (session.variationName) return `cvar:${session.variationName}`;
  const variation = session.variationId ? findVariation(session.variationId) : undefined;
  // A loadFactor-1 variation IS the standard lift, so it shares the lift's key.
  if (variation && variation.loadFactor !== 1) return `var:${variation.id}`;
  return `lift:${session.type}`;
}

// The label a movement shows: the user's override, else the default
// abbreviation, else the full name (a free-text variation or a bodybuilding
// exercise has no default abbreviation — it prints its own name).
export function movementLabel(
  session: WorkoutSession,
  format: TrainingLogFormat,
  language: Language
): string {
  if (format.labelStyle === 'full') return workoutLabel(session, language);
  const key = abbreviationKeyOf(session);
  if (key) {
    const override = userAbbr(key, format);
    if (override) return override;
    if (session.bbMet == null && isLiftingExercise(session.type)) {
      const id = key.startsWith('var:') ? key.slice(4) : session.type;
      const abbr = key.startsWith('cvar:') ? null : defaultAbbr(id, language);
      if (abbr) return abbr;
    }
  }
  if (session.bbMet != null) return bbExerciseName(session, language);
  return workoutLabel(session, language);
}

export function formatMovement(
  session: WorkoutSession,
  format: TrainingLogFormat,
  language: Language
): string {
  const label = movementLabel(session, format, language);
  const detail = session.sets?.length
    ? formatSetSequence(session.sets, format, language)
    : t(language, 'trainingLog.format.minutes', { n: formatNumber(session.minutes, format, language) });
  return detail ? `${label} ${detail}` : label;
}

function hasWorkouts(entry: ActivityLogEntry): boolean {
  return entry.workouts.length > 0;
}

function whenOf(entry: ActivityLogEntry): number {
  return entry.startAt ?? entry.timestamp;
}

function sortedWorkoutEntries(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  return entries
    .filter(hasWorkouts)
    .sort((a, b) => whenOf(a) - whenOf(b) || a.id.localeCompare(b.id));
}

// "26.08" (vi/de) / "08/26" (en) for a YYYY-MM-DD — the notebook's day label,
// also used for a free week's "07.09–13.09" heading.
export function formatDayDate(date: string, language: Language): string {
  const [, mm, dd] = date.split('-');
  return t(language, 'trainingLog.format.dayDate', { dd, mm });
}

// "77.5kg" for a week heading ("W4: 77.5kg"), decimals per the user's format.
export function formatBodyWeight(kg: number, format: TrainingLogFormat, language: Language): string {
  return t(language, 'trainingLog.format.weightPlain', { kg: formatNumber(kg, format, language) });
}

// A week's label: "B2W4" / "B2 DELOAD" for a week of a block plan (block number
// + week, so the week reads on its own), "07.09–13.09" for any other week.
export function formatWeekLabel(week: TrainingLogWeek, language: Language): string {
  if (week.customLabel) return week.customLabel;
  return formatDefaultWeekLabel(week, language);
}

// The label the app gives a week on its own, ignoring the user's customLabel:
// "B2W1" / "B2 DELOAD" in a block, the dates otherwise. The page editor
// compares against it to tell "the user typed the default back" from a label.
export function formatDefaultWeekLabel(week: TrainingLogWeek, language: Language): string {
  if (week.block) {
    const b = week.block.number;
    return week.isDeload
      ? t(language, 'trainingLog.deloadLabel', { b })
      : t(language, 'trainingLog.weekLabel', { b, n: week.weekNumber ?? 0 });
  }
  return formatWeekRange(week, language);
}

// "07.09–13.09" (vi/de) / "09/07–09/13" (en).
export function formatWeekRange(week: TrainingLogWeek, language: Language): string {
  return `${formatDayDate(week.weekStart, language)}–${formatDayDate(week.weekEnd, language)}`;
}

// The week heading: "B2W1: 07.09–13.09 76.3kg" inside a block — which block
// and week, its dates, and the week's first weigh-in — or "07.09–13.09 76.3kg"
// for a free week. A label the user gave the week ("B3W3") takes the label's
// place in either kind: "B3W3: 21.09–27.09 75kg". The weight is only there
// when the user weighed in that week and `showBodyWeight` is on.
export function formatWeekHeading(
  week: TrainingLogWeek,
  weekWeightKg: number | null,
  format: TrainingLogFormat,
  language: Language
): string {
  const { lead, range, weight } = formatWeekHeadingParts(week, weekWeightKg, format, language);
  const rest = weight ? `${range} ${weight}` : range;
  return lead ? `${lead}: ${rest}` : rest;
}

// The same heading split where the notebook styles each part differently:
// `lead` the label ("B2W1", bold) — null for an unlabelled free week —,
// `range` the dates ("07.09–13.09", plain) and `weight` ("76.3kg", green
// italic) — null when there is none or `showBodyWeight` is off.
export function formatWeekHeadingParts(
  week: TrainingLogWeek,
  weekWeightKg: number | null,
  format: TrainingLogFormat,
  language: Language
): { lead: string | null; range: string; weight: string | null } {
  return {
    lead: week.block || week.customLabel ? formatWeekLabel(week, language) : null,
    range: formatWeekRange(week, language),
    weight: format.showBodyWeight && weekWeightKg != null ? formatBodyWeight(weekWeightKg, format, language) : null,
  };
}

// Letters only (any Latin script incl. Vietnamese/German diacritics) — a
// movement label such as "S", "PD", "iC" or "Bench press".
const LABEL_WORD = /^[A-Za-zÀ-ỹ]+$/;
// One bare cluster: a weight ("95") or reps x weight ("3x80"), unit optional.
const BARE_CLUSTER = /^\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?(?:kg)?$/i;
const STARTS_SETS = /^[\d(]/;

export type DayBodyPart = { text: string; kind: 'label' | 'prime' | 'text' };

// A day line's body cut into what the notebook styles: movement labels (bold
// grey), primes (italic) and the rest — "B 95 + 4x6x72.5" → "B" | " " |
// "95" | " + 4x6x72.5". A label is a run of letter-only words directly
// followed by a number or a bracket (trailing words like "kcal", "phút" and
// notes stay plain). A prime is the first cluster after a label when a "+"
// set apart by a space follows it — "95 + 4x6x72.5" or the hand-written
// "95+ 4x6x72.5" — never "4x3x115+3x100" or a top single "130 4x3x115".
// Joining every `text` gives back the body unchanged.
export function splitDayBody(body: string): DayBodyPart[] {
  // "95+" (a prime glued to its "+") becomes two words so it can be styled apart.
  const parts = body
    .split(/(\s+)/)
    .flatMap((p) => (/\S\+$/.test(p) && BARE_CLUSTER.test(p.slice(0, -1)) ? [p.slice(0, -1), '+'] : [p]))
    .filter((p) => p !== '');
  const words = parts.map((p, i) => i).filter((i) => !/^\s+$/.test(parts[i]));
  const kinds = parts.map((): DayBodyPart['kind'] => 'text');

  for (let w = 0; w < words.length; w++) {
    if (!LABEL_WORD.test(parts[words[w]])) continue;
    let end = w;
    while (end + 1 < words.length && LABEL_WORD.test(parts[words[end + 1]])) end++;
    const first = words[end + 1];
    if (first !== undefined && STARTS_SETS.test(parts[first])) {
      for (let k = words[w]; k <= words[end]; k++) kinds[k] = 'label'; // incl. the spaces inside
      const plus = words[end + 2];
      const after = words[end + 3];
      if (
        BARE_CLUSTER.test(parts[first]) &&
        plus !== undefined &&
        parts[plus] === '+' &&
        after !== undefined &&
        STARTS_SETS.test(parts[after])
      ) {
        kinds[first] = 'prime';
      }
    }
    w = end;
  }

  const out: DayBodyPart[] = [];
  parts.forEach((text, i) => {
    const last = out[out.length - 1];
    if (last && last.kind === kinds[i]) last.text += text;
    else out.push({ text, kind: kinds[i] });
  });
  return out;
}

// "Tháng 9 năm 2026", or the user's own name for that month ("Power Lifting").
export function formatPeriodTitle(period: TrainingLogPeriod, language: Language): string {
  return period.monthName ?? formatDefaultMonthTitle(period, language);
}

// "Tháng 9 năm 2026" / "September 2026" — a month's title when it has no name.
export function formatDefaultMonthTitle(period: Pick<TrainingLogPeriod, 'monthKey'>, language: Language): string {
  const month = new Date(`${period.monthKey}-01T00:00:00`).toLocaleDateString(LOCALE_TAGS[language], {
    month: 'long',
    year: 'numeric',
  });
  const title = t(language, 'trainingLog.monthTitle', { month });
  return title.charAt(0).toLocaleUpperCase(LOCALE_TAGS[language]) + title.slice(1);
}

// What a month holds of each block plan: "Block 3 · W1–W4", "Accumulation ·
// W5–Deload" (a named block shows its name).
export function formatPeriodBlocks(period: TrainingLogPeriod, language: Language): string[] {
  return period.blocks.map((b) => {
    const name = b.name ?? t(language, 'trainingLog.blockTitle', { n: b.number });
    const last = b.lastIsDeload ? t(language, 'trainingLog.deloadShort') : t(language, 'trainingLog.weekShort', { n: b.lastWeek });
    const weeks =
      b.firstWeek === b.lastWeek ? last : `${t(language, 'trainingLog.weekShort', { n: b.firstWeek })}–${last}`;
    return t(language, 'trainingLog.blockSpan', { block: name, weeks });
  });
}

export interface DayLine {
  // "26.08(77.7kg):" — always machine-generated, never overridden.
  prefix: string;
  // The movements ("S 130 4x3x115+3x100 PD 4x3x100"), the part an override replaces.
  body: string;
}

export function formatDayLine(input: {
  date: string; // YYYY-MM-DD
  entries: ActivityLogEntry[];
  bodyWeightKg?: number | null;
  format: TrainingLogFormat;
  language: Language;
}): DayLine {
  const { date, entries, bodyWeightKg, format, language } = input;
  let prefix = formatDayDate(date, language);
  if (format.showWeekday) {
    const dow = new Date(date + 'T00:00:00').getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    prefix = `${weekdayLabel(dow, language, 'short')} ${prefix}`;
  }
  if (format.showBodyWeight && bodyWeightKg != null && bodyWeightKg > 0) {
    prefix += t(language, 'trainingLog.format.weightSuffix', {
      kg: formatNumber(bodyWeightKg, format, language),
    });
  }
  prefix += ':';

  const workoutEntries = sortedWorkoutEntries(entries);
  const movements = workoutEntries.flatMap((e) =>
    e.workouts.map((w) => formatMovement(w, format, language))
  );
  let body = movements.join(format.labelStyle === 'full' ? ' · ' : ' ');
  if (format.showKcal && workoutEntries.length > 0) {
    const kcal = Math.round(workoutEntries.reduce((sum, e) => sum + e.energyKcal, 0));
    body += ` · ${t(language, 'trainingLog.format.kcalSuffix', { kcal })}`;
  }
  return { prefix, body };
}

// Fingerprint of what a day's Xả entries looked like, so a hand-edited line
// can tell when the entries behind it changed. Deliberately EXCLUDES `id`
// (energyStore.updateActivity re-logs an edit under a fresh id but the same
// timestamp — an id-based signature would cry "changed" for identical content)
// and steps-only entries (they never appear in the log). djb2 → base36.
export function trainingDaySignature(entries: ActivityLogEntry[]): string {
  const parts = entries
    .filter(hasWorkouts)
    .map((e) => `${e.timestamp}|${e.startAt ?? ''}|${JSON.stringify(e.workouts)}`)
    .sort();
  const text = parts.join('\n');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// What (if anything) the user must be asked about a day whose line they
// wrote/edited. Never resolves anything itself — the UI shows a banner.
export function detectDayConflict(input: {
  record: TrainingLogDayRecord | null | undefined;
  entries: ActivityLogEntry[];
}): DayConflict {
  const { record, entries } = input;
  if (!record || record.overrideText == null) return 'none';
  const hasEntries = entries.some(hasWorkouts);
  // Hand-written line (never tied to an entry): only a LATER Xả is news.
  if (record.sourceSignature == null) return hasEntries ? 'xaAddedToManual' : 'none';
  if (!hasEntries) return 'sourceGone';
  return record.sourceSignature === trainingDaySignature(entries) ? 'none' : 'sourceChanged';
}

// Phone decimal keypads (vi/de) only have a comma, so a user typing a line
// by hand writes "72,5". Turns a comma BETWEEN TWO DIGITS into a dot; every
// other comma ("B 90, then S 100") is left alone. Known limit: "1,2,3" →
// "1.2,3" — harmless, because reps are joined with "+" in this notation, so
// digit,digit,digit never occurs in a real line.
export function normalizeDecimalCommas(text: string): string {
  return text.replace(/(\d),(\d)/g, '$1.$2');
}

// Applies the comma fix only when the user displays dots (the default). With
// decimal: 'locale' the user chose their own separator, so keep what they typed.
export function normalizeManualBody(text: string, format: TrainingLogFormat): string {
  return format.decimal === 'dot' ? normalizeDecimalCommas(text) : text;
}

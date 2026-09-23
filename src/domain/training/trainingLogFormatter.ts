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
  return workingText;
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

// A week's label: "W4" / "DELOAD" inside a block, "07.09–13.09" for a free week.
export function formatWeekLabel(
  week: TrainingLogWeek,
  kind: 'block' | 'free',
  language: Language
): string {
  if (kind === 'block') {
    return week.isDeload
      ? t(language, 'trainingLog.deloadLabel')
      : t(language, 'trainingLog.weekLabel', { n: week.weekNumber ?? 0 });
  }
  return `${formatDayDate(week.weekStart, language)}–${formatDayDate(week.weekEnd, language)}`;
}

// The week heading as the notebook writes it: "W4: 77.5kg" (Notes puts a colon
// after a block week's label; a date range has none). The weight is only there
// when the user weighed in that week and `showBodyWeight` is on.
export function formatWeekHeading(
  week: TrainingLogWeek,
  kind: 'block' | 'free',
  weekWeightKg: number | null,
  format: TrainingLogFormat,
  language: Language
): string {
  const label = formatWeekLabel(week, kind, language);
  const heading = kind === 'block' ? `${label}:` : label;
  return format.showBodyWeight && weekWeightKg != null
    ? `${heading} ${formatBodyWeight(weekWeightKg, format, language)}`
    : heading;
}

// "Block 2" / the user's own name, or "Free training · September 2026".
export function formatPeriodTitle(period: TrainingLogPeriod, language: Language): string {
  if (period.kind === 'block') {
    return period.blockName ?? t(language, 'trainingLog.blockTitle', { n: period.blockNumber ?? 0 });
  }
  const month = new Date(`${period.monthKey}-01T00:00:00`).toLocaleDateString(LOCALE_TAGS[language], {
    month: 'long',
    year: 'numeric',
  });
  return t(language, 'trainingLog.freePeriodTitle', { month });
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

import type { MealWindow } from '../../../lib/constants';
import { BODYBUILDING_EXERCISES } from '../../../lib/bodybuildingExercises';
import { addDaysToDateString, dateString } from '../../../lib/dateUtils';
import type {
  ActivityLogEntry,
  ActivityType,
  CustomActivity,
  CustomExercise,
  LiftingSet,
  WorkoutSession,
} from '../../../types/energy';
import { validateBackfillDate } from '../../food/backfillEngine';
import { atLocalTime, FUTURE_GRACE_MS, hintClock } from '../../food/mealText/mapMealText';
import { bbEffectiveMet, estimateBbMinutes } from '../bodybuildingEngine';
import { estimateLiftingMinutes } from '../liftingEngine';
import { stepsKcal, workoutKcal } from '../metabolismEngine';
import type { ActivityMatch, DecodedActivity } from './parseActivityText';

// "Kể cả ngày", step 3 for workouts — Mapping & Validation. Turns decoded
// workout pieces into draft rows the user reviews before anything is logged
// to 🔥 Xả: which activity, how long / which sets, which day and time, and
// what is wrong with it. Pure — the caller gives the clock, the user's
// custom activities and recent Xả entries in the context. Same rules as the
// food rows (mapMealText): a blocking issue locks the row, a near-duplicate
// of something already logged starts unticked and says what it collides
// with, nothing is merged or overwritten.

export type ActivityDraftIssue =
  | 'noMatch' // no activity has this name — pick one
  | 'noMinutes' // a minutes-based activity with no length said, none logged before
  | 'noSets' // a lift / exercise with no sets said
  | 'noWeight' // a barbell lift without its weight
  | 'futureTime'
  | 'tooOld'
  | 'duplicate' // the same activity is already in Xả around that time
  | 'longSession' // more than LONG_SESSION_MIN
  | 'usualMinutes'; // no length said — the user's last session of it

export const ACTIVITY_ISSUE_ORDER: ActivityDraftIssue[] = [
  'noMatch',
  'futureTime',
  'tooOld',
  'noMinutes',
  'noSets',
  'noWeight',
  'duplicate',
  'longSession',
  'usualMinutes',
];

export const ACTIVITY_INFO_ISSUES: ReadonlySet<ActivityDraftIssue> = new Set<ActivityDraftIssue>(['usualMinutes']);

const BLOCKING: ReadonlySet<ActivityDraftIssue> = new Set<ActivityDraftIssue>([
  'noMatch',
  'noMinutes',
  'noSets',
  'noWeight',
  'futureTime',
  'tooOld',
]);

export const LONG_SESSION_MIN = 300;
export const ACTIVITY_DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;

export type MinutesSource = 'said' | 'range' | 'usual' | 'sets' | 'manual';

export interface ActivityDraftRow {
  id: string;
  decoded: DecodedActivity;
  match: ActivityMatch | null;
  minutes: number | null; // for a lift / exercise: the estimate from its sets
  minutesSource: MinutesSource | null;
  steps: number; // 0 = none
  sets: LiftingSet[] | null;
  day: string; // YYYY-MM-DD it happened on
  startAt: number | null; // when it began, if said (unix ms)
  duplicate: ActivityLogEntry | null;
  issues: ActivityDraftIssue[];
  selected: boolean;
}

export interface ActivityTextContext {
  now: number;
  today: string;
  baseDate: string; // the day a row with no day said goes to
  maxDaysBack: number;
  mealWindows: Record<'breakfast' | 'lunch' | 'dinner', MealWindow>;
  weightKg: number;
  heightCm: number;
  customActivities: CustomActivity[];
  customExercises: CustomExercise[];
  // Recent Xả entries, newest or oldest first: "as usual" lengths and duplicates.
  recentActivities: ActivityLogEntry[];
}

// What building a session and its kcal needs — no clock, so a render can
// price rows without one.
export type ActivityKcalContext = Pick<
  ActivityTextContext,
  'weightKg' | 'heightCm' | 'customActivities' | 'customExercises'
>;

// Walking with a step count logs the steps, not minutes on top of them — the
// minutes would count the same walk twice.
const STEP_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>(['walking', 'brisk_walking']);

export function buildActivityDraft(items: DecodedActivity[], ctx: ActivityTextContext): ActivityDraftRow[] {
  return items.map((decoded, index) => {
    const { day, startAt } = whenOf(decoded, ctx);
    // "tập ngực 1 tiếng", "squat 45 phút": a length but no sets — a gym
    // session by minutes, not an exercise without its sets.
    const match: ActivityMatch | null =
      isSetBased(decoded.match) && !decoded.sets && decoded.minutes != null
        ? { kind: 'type', type: 'gym_strength' }
        : decoded.match;
    return validate(
      {
        id: `a${index}`,
        decoded,
        match,
        steps: decoded.steps ?? 0,
        sets: decoded.sets,
        day,
        startAt,
        duplicate: null,
        issues: [],
        selected: true,
        ...lengthFor(match, decoded, ctx),
      },
      ctx,
      true
    );
  });
}

// ── Edits from the review list ───────────────────────────────────────────

// Picking an activity for the row (from ✎, or for one no name matched).
export function withActivityMatch(row: ActivityDraftRow, match: ActivityMatch, ctx: ActivityTextContext): ActivityDraftRow {
  const kept = row.minutesSource === 'manual' ? { minutes: row.minutes, minutesSource: row.minutesSource } : null;
  return validate({ ...row, match, ...lengthFor(match, row.decoded, ctx), ...(kept ?? {}) }, ctx);
}

export function withActivityMinutes(row: ActivityDraftRow, minutes: number, ctx: ActivityTextContext): ActivityDraftRow {
  if (!(minutes > 0) || isSetBased(row.match)) return row;
  return validate({ ...row, minutes, minutesSource: 'manual' }, ctx);
}

export function withActivitySteps(row: ActivityDraftRow, steps: number, ctx: ActivityTextContext): ActivityDraftRow {
  return validate({ ...row, steps: Math.max(0, Math.round(steps)) }, ctx);
}

export function withActivitySets(row: ActivityDraftRow, sets: LiftingSet[], ctx: ActivityTextContext): ActivityDraftRow {
  if (!isSetBased(row.match)) return row;
  return validate({ ...row, sets, minutes: setMinutes(row.match, sets), minutesSource: 'sets' }, ctx);
}

// `startAt` null = no time (logged now for today, at noon for a past day).
export function withActivityTime(
  row: ActivityDraftRow,
  day: string,
  startAt: number | null,
  ctx: ActivityTextContext
): ActivityDraftRow {
  return validate({ ...row, day, startAt }, ctx);
}

export function toggleActivityRow(row: ActivityDraftRow): ActivityDraftRow {
  return isActivityBlocked(row) ? row : { ...row, selected: !row.selected };
}

export function isActivityBlocked(row: ActivityDraftRow): boolean {
  return row.issues.some((issue) => BLOCKING.has(issue));
}

export function isSetBased(match: ActivityMatch | null): boolean {
  return match?.kind === 'lift' || match?.kind === 'bodybuilding';
}

// ── What gets logged ─────────────────────────────────────────────────────

// The Xả session this row logs (null for a steps-only row or one not ready).
export function rowWorkout(
  row: ActivityDraftRow,
  ctx: Pick<ActivityTextContext, 'customActivities' | 'customExercises'>
): WorkoutSession | null {
  const { match } = row;
  if (!match) return null;
  if (match.kind === 'lift') {
    if (!row.sets || row.sets.length === 0) return null;
    return { type: match.exercise, minutes: estimateLiftingMinutes(row.sets), sets: row.sets };
  }
  if (match.kind === 'bodybuilding') {
    if (!row.sets || row.sets.length === 0) return null;
    const custom = ctx.customExercises.find((e) => e.id === match.exerciseId);
    const builtIn = BODYBUILDING_EXERCISES.find((e) => e.id === match.exerciseId);
    const ex = custom ?? builtIn;
    if (!ex) return null;
    return {
      type: 'bodybuilding',
      minutes: estimateBbMinutes(row.sets),
      sets: row.sets,
      bbExerciseId: ex.id,
      bbMuscle: ex.muscle,
      bbTier: ex.tier,
      bbMet: bbEffectiveMet(ex.tier, 'moderate'),
      ...(custom ? { bbName: custom.nameVi } : {}),
    };
  }
  if (match.kind === 'type' && STEP_TYPES.has(match.type) && row.steps > 0) return null;
  if (row.minutes == null || !(row.minutes > 0)) return null;
  if (match.kind === 'custom') {
    const custom = ctx.customActivities.find((a) => a.id === match.id);
    return custom ? { type: 'custom', minutes: row.minutes, customName: custom.nameVi, customMet: custom.met } : null;
  }
  return { type: match.type, minutes: row.minutes };
}

// Steps this row logs: a walk's step count, or steps said on their own.
export function rowSteps(row: ActivityDraftRow): number {
  if (row.steps <= 0) return 0;
  if (!row.match) return row.steps;
  return row.match.kind === 'type' && STEP_TYPES.has(row.match.type) ? row.steps : 0;
}

export function rowActivityKcal(row: ActivityDraftRow, ctx: ActivityKcalContext): number {
  const workout = rowWorkout(row, ctx);
  return (workout ? workoutKcal(workout, ctx.weightKg, ctx.heightCm) : 0) + stepsKcal(rowSteps(row), ctx.weightKg);
}

export function activityDraftTotals(rows: ActivityDraftRow[], ctx: ActivityKcalContext): { count: number; kcal: number } {
  const chosen = rows.filter((row) => row.selected && !isActivityBlocked(row));
  return { count: chosen.length, kcal: chosen.reduce((sum, row) => sum + rowActivityKcal(row, ctx), 0) };
}

export interface ActivityLogStep {
  today: boolean; // logActivity (today) or logActivityForPastDate
  timestamp: number; // the past-day log time (start, else noon)
  startAt?: number;
  endAt?: number;
  steps: number;
  workouts: WorkoutSession[];
  rowIds: string[];
}

// One Xả entry per row, except that lifts and exercises said at the same
// time of the same day form one gym session — the way the Powerlifting /
// Bodybuilding sheets log them.
export function activityLogPlan(rows: ActivityDraftRow[], ctx: ActivityTextContext): ActivityLogStep[] {
  const steps: ActivityLogStep[] = [];
  const gym = new Map<string, ActivityLogStep>();
  for (const row of rows) {
    if (!row.selected || isActivityBlocked(row)) continue;
    const workout = rowWorkout(row, ctx);
    const stepCount = rowSteps(row);
    if (!workout && stepCount === 0) continue;
    const startAt = row.startAt ?? undefined;
    const minutes = workout?.minutes ?? row.minutes ?? 0;
    const endAt = startAt != null && minutes > 0 ? startAt + Math.round(minutes * 60_000) : undefined;
    if (workout && isSetBased(row.match)) {
      const key = `${row.day}|${startAt ?? ''}`;
      const open = gym.get(key);
      if (open) {
        open.workouts.push(workout);
        open.rowIds.push(row.id);
        if (open.startAt != null) open.endAt = (open.endAt ?? open.startAt) + Math.round(workout.minutes * 60_000);
        continue;
      }
      const step = logStep(row, ctx, startAt, endAt, 0, [workout]);
      gym.set(key, step);
      steps.push(step);
      continue;
    }
    steps.push(logStep(row, ctx, startAt, endAt, stepCount, workout ? [workout] : []));
  }
  return steps;
}

function logStep(
  row: ActivityDraftRow,
  ctx: ActivityTextContext,
  startAt: number | undefined,
  endAt: number | undefined,
  steps: number,
  workouts: WorkoutSession[]
): ActivityLogStep {
  return {
    today: row.day === ctx.today,
    timestamp: startAt ?? atLocalTime(row.day, 12, 0),
    ...(startAt != null ? { startAt } : {}),
    ...(endAt != null ? { endAt } : {}),
    steps,
    workouts,
    rowIds: [row.id],
  };
}

// ── Mapping ──────────────────────────────────────────────────────────────

function whenOf(decoded: DecodedActivity, ctx: ActivityTextContext): { day: string; startAt: number | null } {
  const hint = decoded.time;
  const day = hint?.dayOffset != null ? addDaysToDateString(ctx.today, hint.dayOffset) : ctx.baseDate;
  const clock = hintClock(hint, ctx.mealWindows);
  return { day, startAt: clock ? atLocalTime(day, clock.hour, clock.minute) : null };
}

function setMinutes(match: ActivityMatch | null, sets: LiftingSet[]): number {
  return match?.kind === 'lift' ? estimateLiftingMinutes(sets) : estimateBbMinutes(sets);
}

function lengthFor(
  match: ActivityMatch | null,
  decoded: DecodedActivity,
  ctx: ActivityTextContext
): { minutes: number | null; minutesSource: MinutesSource | null } {
  if (isSetBased(match)) {
    return decoded.sets ? { minutes: setMinutes(match, decoded.sets), minutesSource: 'sets' } : { minutes: null, minutesSource: null };
  }
  if (decoded.minutes != null) return { minutes: decoded.minutes, minutesSource: decoded.fromRange ? 'range' : 'said' };
  const usual = match ? usualMinutes(match, ctx) : null;
  return usual != null ? { minutes: usual, minutesSource: 'usual' } : { minutes: null, minutesSource: null };
}

// The length of the user's latest session of this activity.
function usualMinutes(match: ActivityMatch, ctx: ActivityTextContext): number | null {
  let best: { at: number; minutes: number } | null = null;
  for (const entry of ctx.recentActivities) {
    for (const w of entry.workouts) {
      if (!sameActivity(w, match, ctx) || !(w.minutes > 0)) continue;
      const at = entry.startAt ?? entry.timestamp;
      if (!best || at > best.at) best = { at, minutes: w.minutes };
    }
  }
  return best?.minutes ?? null;
}

function sameActivity(w: WorkoutSession, match: ActivityMatch, ctx: ActivityTextContext): boolean {
  switch (match.kind) {
    case 'type':
      return w.type === match.type;
    case 'lift':
      return w.type === match.exercise && w.bbMet == null;
    case 'bodybuilding':
      return w.type === 'bodybuilding' && w.bbExerciseId === match.exerciseId;
    case 'custom': {
      const custom = ctx.customActivities.find((a) => a.id === match.id);
      return w.type === 'custom' && custom != null && w.customName === custom.nameVi;
    }
  }
}

// ── Validation ───────────────────────────────────────────────────────────

function validate(row: ActivityDraftRow, ctx: ActivityTextContext, initial = false): ActivityDraftRow {
  const issues = new Set<ActivityDraftIssue>();
  const stepsOnly = rowSteps(row) > 0;
  if (!row.match && !stepsOnly) issues.add('noMatch');
  if (row.match && isSetBased(row.match)) {
    if (!row.sets || row.sets.length === 0) issues.add('noSets');
    else if (row.match.kind === 'lift' && row.sets.some((s) => !(s.weightKg > 0))) issues.add('noWeight');
  } else if (row.match && !stepsOnly) {
    if (row.minutes == null || !(row.minutes > 0)) issues.add('noMinutes');
    else if (row.minutes > LONG_SESSION_MIN) issues.add('longSession');
    if (row.minutesSource === 'usual') issues.add('usualMinutes');
  }

  const day = validateBackfillDate(row.day, ctx.today, ctx.maxDaysBack);
  if (!day.ok) issues.add(day.reason === 'future' ? 'futureTime' : 'tooOld');
  else if (row.startAt != null && row.startAt > ctx.now + FUTURE_GRACE_MS) issues.add('futureTime');

  const duplicate = closestEntry(row, ctx);
  if (duplicate) issues.add('duplicate');

  const next: ActivityDraftRow = {
    ...row,
    duplicate,
    issues: ACTIVITY_ISSUE_ORDER.filter((issue) => issues.has(issue)),
  };
  const blocked = isActivityBlocked(next);
  const wasBlocked = !initial && isActivityBlocked(row);
  // Same rule as the food rows: a row starts ticked unless it is blocked or a
  // duplicate, and an edit re-ticks only a row it just unblocked.
  next.selected = blocked ? false : initial || wasBlocked ? duplicate == null : row.selected;
  return next;
}

// The Xả entry of the same day closest in time that already has this
// activity (or, for a steps-only row, steps).
function closestEntry(row: ActivityDraftRow, ctx: ActivityTextContext): ActivityLogEntry | null {
  const at = row.startAt ?? (row.day === ctx.today ? ctx.now : atLocalTime(row.day, 12, 0));
  const stepsOnly = rowSteps(row) > 0 && !rowWorkout(row, ctx);
  let best: { entry: ActivityLogEntry; gap: number } | null = null;
  for (const entry of ctx.recentActivities) {
    const when = entry.startAt ?? entry.timestamp;
    if (dateString(new Date(when)) !== row.day) continue;
    const same = stepsOnly
      ? entry.steps > 0
      : row.match != null && entry.workouts.some((w) => sameActivity(w, row.match as ActivityMatch, ctx));
    const gap = Math.abs(when - at);
    if (same && gap <= ACTIVITY_DUPLICATE_WINDOW_MS && (!best || gap < best.gap)) best = { entry, gap };
  }
  return best?.entry ?? null;
}

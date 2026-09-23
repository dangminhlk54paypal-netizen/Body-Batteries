import { estimateLiftingMinutes } from './liftingEngine';
import { findVariation, variationsForExercise } from '../../lib/powerliftingVariations';
import { parseDecimal } from '../../lib/units';
import { LIFTING_EXERCISES } from '../../types/energy';
import type {
  ActivityLogEntry,
  LiftingExercise,
  LiftingSet,
  WorkoutSession,
} from '../../types/energy';

// Pure model behind PowerliftingSheet. A "movement" is one lift done in one
// technique variation (squat, paused squat, bench, incline bench…): the sheet
// used to hold exactly one set-list per lift, which made a day like
// "B 90 5x5x72.5 iC 5x5x62.5" (two bench variations) impossible to enter.
// Each movement becomes its own WorkoutSession on save. Kcal is unchanged —
// it is still computed per session from the sets (liftingSessionKcal).

// Raw text while the user types (same convention as every numeric form in the
// app); parsed only on preview/confirm.
export interface SetRowInput {
  weight: string;
  reps: string;
}

export interface MovementDraft {
  key: string; // stable React key, unique within a sheet
  exercise: LiftingExercise;
  // A library id (POWERLIFTING_VARIATIONS). Absent = the standard lift.
  variationId?: string;
  // Free-text variation. `''` = the "type my own name" chip is selected but
  // nothing is typed yet; movementsToWorkouts treats that as standard.
  variationName?: string;
  warmup: SetRowInput[];
  working: SetRowInput[];
}

export function emptyMovement(exercise: LiftingExercise, key: string): MovementDraft {
  return { key, exercise, warmup: [], working: [{ weight: '', reps: '' }] };
}

export function setToRow(s: LiftingSet): SetRowInput {
  return { weight: String(s.weightKg), reps: String(s.reps) };
}

// Parse one section's rows into real sets, silently skipping incomplete rows
// (empty weight OR reps). Weight 0 is a valid bodyweight/empty-bar set.
export function parseSetRows(rows: SetRowInput[], kind: LiftingSet['kind']): LiftingSet[] {
  const sets: LiftingSet[] = [];
  for (const r of rows) {
    const weightKg = parseDecimal(r.weight);
    const reps = parseDecimal(r.reps);
    if (isNaN(weightKg) || weightKg < 0 || isNaN(reps) || reps <= 0) continue;
    sets.push({ kind, weightKg, reps: Math.round(reps) });
  }
  return sets;
}

export function movementSets(m: MovementDraft): LiftingSet[] {
  return [...parseSetRows(m.warmup, 'warmup'), ...parseSetRows(m.working, 'working')];
}

// Key for a movement the sheet is about to add: the next free `m<n>`.
export function nextMovementKey(movements: MovementDraft[]): string {
  let max = -1;
  for (const m of movements) {
    const n = Number(m.key.slice(1));
    if (m.key.startsWith('m') && Number.isInteger(n) && n > max) max = n;
  }
  return `m${max + 1}`;
}

// A movement starts from an entry's workouts: each lift workout that has sets
// (and is not a bodybuilding session) becomes one movement. No qualifying
// workout → a single empty standard squat, the sheet's usual starting point.
export function movementsFromEntry(entry: ActivityLogEntry | null | undefined): MovementDraft[] {
  const out: MovementDraft[] = [];
  for (const w of entry?.workouts ?? []) {
    if (!w.sets?.length || w.bbMet != null) continue;
    const exercise = w.type as LiftingExercise;
    if (!LIFTING_EXERCISES.includes(exercise)) continue;
    out.push({
      key: `m${out.length}`,
      exercise,
      variationId: w.variationId,
      variationName: w.variationName,
      warmup: w.sets.filter((s) => s.kind === 'warmup').map(setToRow),
      working: w.sets.filter((s) => s.kind === 'working').map(setToRow),
    });
  }
  return out.length > 0 ? out : [emptyMovement('squat', 'm0')];
}

// One WorkoutSession per movement that has at least one valid set. Sessions
// are ordered squat → bench → deadlift (the tab order, what the sheet always
// saved), keeping the order the user added movements in within each lift.
export function movementsToWorkouts(movements: MovementDraft[]): WorkoutSession[] {
  const order = (m: MovementDraft) => LIFTING_EXERCISES.indexOf(m.exercise);
  const sorted = [...movements].sort((a, b) => order(a) - order(b));
  const workouts: WorkoutSession[] = [];
  for (const m of sorted) {
    const sets = movementSets(m);
    if (sets.length === 0) continue;
    const session: WorkoutSession = {
      type: m.exercise,
      minutes: estimateLiftingMinutes(sets),
      sets,
    };
    const name = m.variationName?.trim();
    if (name) session.variationName = name;
    else if (m.variationId) session.variationId = m.variationId;
    workouts.push(session);
  }
  return workouts;
}

// Identity of a movement's variation, for "same variation as last time"
// matching. '' = standard (no variation, or a loadFactor-1 library entry such
// as bench_touch_and_go, which IS the standard lift); a free-text name is
// matched case-insensitively.
export function variationIdentity(v: {
  variationId?: string;
  variationName?: string;
}): string {
  const name = v.variationName?.trim().toLowerCase();
  if (name) return `n:${name}`;
  if (v.variationId) {
    const lib = findVariation(v.variationId);
    if (lib && lib.loadFactor === 1) return '';
    return `v:${v.variationId}`;
  }
  return '';
}

export interface PrevMovementMatch {
  entry: ActivityLogEntry;
  workout: WorkoutSession;
}

// Latest earlier session of the same lift in the same variation. `history` is
// ascending by time (getActivityLogInRange). With no same-variation session it
// falls back to the latest STANDARD session of that lift, so a first-ever
// "incline" still shows some reference (the summary line carries the date, so
// it reads as "your last bench", not as an incline record).
export function findPrevSessionForMovement(
  history: ActivityLogEntry[],
  movement: Pick<MovementDraft, 'exercise' | 'variationId' | 'variationName'>,
  excludeId?: string
): PrevMovementMatch | null {
  const wanted = variationIdentity(movement);
  let fallback: PrevMovementMatch | null = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.id === excludeId) continue;
    for (const workout of entry.workouts) {
      if (workout.type !== movement.exercise || !workout.sets?.length || workout.bbMet != null) continue;
      const identity = variationIdentity(workout);
      if (identity === wanted) return { entry, workout };
      if (!fallback && identity === '') fallback = { entry, workout };
    }
  }
  return wanted === '' ? null : fallback;
}

// The library variations a user can pick for a lift, minus the ones that are
// just the standard lift under another id (those are the "Chuẩn" chip).
export function selectableVariationIds(exercise: LiftingExercise): string[] {
  return variationsForExercise(exercise)
    .filter((v) => v.loadFactor !== 1)
    .map((v) => v.id);
}

// What a newly added movement of `exercise` should start as: the first library
// variation not already used in this sheet, else standard. (Adding a second
// standard bench next to the first would be pointless.)
export function suggestNextVariationId(
  exercise: LiftingExercise,
  movements: MovementDraft[]
): string | undefined {
  const used = new Set(
    movements.filter((m) => m.exercise === exercise).map((m) => variationIdentity(m))
  );
  return selectableVariationIds(exercise).find((id) => !used.has(`v:${id}`));
}

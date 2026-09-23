import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';
import type { ActivityLogEntry, ActivityType, LiftingExercise, WorkoutSession } from '../types/energy';
import { LIFTING_EXERCISES } from '../types/energy';

// Display labels + entry classifiers for logged activity. Lives in lib/ (not
// in a component file) so domain code — e.g. the training-log formatter — can
// reuse them without importing from components/.

// Display label for a MET-based activity type, following the current app
// language.
export function activityLabel(type: ActivityType, language: Language): string {
  return translate(language, `activities.${type}`);
}

// Display name for an S-BB session: a custom exercise's own free-text name,
// else the built-in library entry looked up live (never stored — the library
// itself is bundled data, not user history).
export function bbExerciseName(session: WorkoutSession, language: Language): string {
  if (session.bbName) return session.bbName;
  if (session.bbExerciseId) return translate(language, `bbExercises.${session.bbExerciseId}`);
  return translate(language, 'activities.bodybuilding');
}

// Full (non-abbreviated) name of a powerlifting movement: the technique
// variation when one was logged (a library id, or the user's own free text),
// otherwise the plain lift. No variation = the standard/competition lift.
export function liftingMovementLabel(session: WorkoutSession, language: Language): string {
  if (session.variationName) return session.variationName;
  if (session.variationId) return translate(language, `blockVariations.${session.variationId}.label`);
  return activityLabel(session.type, language);
}

export function isLiftingExercise(type: ActivityType): type is LiftingExercise {
  return (LIFTING_EXERCISES as ActivityType[]).includes(type);
}

// The label one workout shows in history lists. An S-BB session shows its
// specific exercise name (checked FIRST: it also has `sets`, so it must not
// fall through to the generic paths below); a custom activity's own name
// takes priority over the generic "custom activity" entry.
export function workoutLabel(w: WorkoutSession, language: Language): string {
  if (w.bbMet != null) return bbExerciseName(w, language);
  if (w.type === 'custom') return w.customName || activityLabel('custom', language);
  if (isLiftingExercise(w.type)) return liftingMovementLabel(w, language);
  return activityLabel(w.type, language);
}

// Entries logged through the Bodybuilding sheet (S-BB) are edited there too.
// MUST be checked BEFORE isLiftingEntry below: an S-BB session also carries
// `sets`, so isLiftingEntry would otherwise misclassify it as a Powerlifting
// entry — opening the wrong sheet, which would then silently DROP the
// bodybuilding workouts on save (PowerliftingSheet only knows squat/bench/
// deadlift and replaces the entry's entire `workouts` array).
export function isBodybuildingEntry(entry: ActivityLogEntry): boolean {
  return entry.workouts.some((w) => w.bbMet != null);
}

// Entries logged through the Powerlifting sheet are edited there too — the
// minutes form can't represent sets and would silently flatten them.
export function isLiftingEntry(entry: ActivityLogEntry): boolean {
  return entry.workouts.some((w) => (w.sets?.length ?? 0) > 0);
}

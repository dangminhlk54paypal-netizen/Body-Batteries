import { isLiftingExercise } from '../../lib/activityLabels';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';

// The lifting / bodybuilding sheets edit an entry by handing back a NEW
// `workouts` array, and the store replaces the whole array with it. An entry
// can hold sessions such a sheet does not manage (a run logged alongside the
// lifts, or the other kind of lifting), so those are carried over instead of
// being silently dropped by the edit.
export type EntryEditKind = 'lifting' | 'bodybuilding';

// Does the `kind` of sheet own this session?
function managedBy(kind: EntryEditKind, w: WorkoutSession): boolean {
  if (kind === 'bodybuilding') return w.bbMet != null;
  return w.bbMet == null && isLiftingExercise(w.type) && (w.sets?.length ?? 0) > 0;
}

// Sessions the sheet edited, followed by the ones it does not manage.
export function mergeEditedWorkouts(
  entry: ActivityLogEntry,
  kind: EntryEditKind,
  edited: WorkoutSession[]
): WorkoutSession[] {
  return [...edited, ...entry.workouts.filter((w) => !managedBy(kind, w))];
}

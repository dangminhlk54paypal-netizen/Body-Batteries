// What the day editor (History › a day › ✎) lets the user change, as plain data
// transforms. All battery effects live in energyStore's ...ForPastDate actions.

import type { IntakeEvent } from '../../types/battery';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import { isManualQuickTapIntake } from '../battery/intakeClassification';
import { BACKFILL_MAX_DAYS_BACK } from '../../lib/constants';
import { addDaysToDateString } from '../../lib/dateUtils';

// Matches the Home form: water and sleep are the only pins still charged by
// hand, the rest come from foods and activities.
export const ADDABLE_KINDS = ['water', 'sleep', 'steps', 'walkMinutes', 'weight'] as const;
export type AddableKind = (typeof ADDABLE_KINDS)[number];

export function isEditableDay(date: string, today: string): boolean {
  return date <= today && date >= addDaysToDateString(today, -BACKFILL_MAX_DAYS_BACK);
}

// A past-day entry without a real time is stamped at noon; today's is "now".
export function entryTimestampFor(date: string, today: string, now: number): number {
  return date === today ? now : new Date(`${date}T12:00:00`).getTime();
}

export function editableIntakes(events: IntakeEvent[]): IntakeEvent[] {
  return events.filter((e) => isManualQuickTapIntake(e) && e.amount > 0);
}

export type ActivityField =
  | { kind: 'steps'; value: number }
  | { kind: 'minutes'; value: number; session: WorkoutSession };

// The one number a row can edit in place. Set-based or multi-part entries have
// null: they can be deleted here but are edited in the training log.
export function activityEditField(entry: ActivityLogEntry): ActivityField | null {
  if (entry.workouts.length === 0) return entry.steps > 0 ? { kind: 'steps', value: entry.steps } : null;
  if (entry.workouts.length > 1 || entry.steps > 0) return null;
  const [session] = entry.workouts;
  return session.sets?.length ? null : { kind: 'minutes', value: session.minutes, session };
}

export function activityPatchFor(field: ActivityField, value: number) {
  return field.kind === 'steps'
    ? { steps: value }
    : { workouts: [{ ...field.session, minutes: value }] };
}

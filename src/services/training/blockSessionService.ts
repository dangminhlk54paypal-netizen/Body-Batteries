import {
  dueSessions,
  liftingDates,
  sessionTimestamp,
  setDaySession,
  workoutsForDay,
} from '../../domain/energy/blockSessions';
import type { DayAddress } from '../../domain/energy/blockSessions';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

// Puts confirmed plan days into Xả (kcal, batteries, the training log). The
// writers are injected so this stays testable; blockStore wires the real ones
// (energyStore.logActivityForPastDate, the activity-log repository).

export interface BlockSessionDeps {
  entriesInRange: (from: string, to: string) => Promise<ActivityLogEntry[]>;
  logWorkouts: (workouts: WorkoutSession[], timestamp: number) => Promise<void>;
}

// Logs one day now — at 18:00 of `date`, or `now` if that is still ahead
// (the user trained earlier today) — unless that day already holds lifts the
// user logged by hand. Returns the plan with the day marked logged.
export async function logPlanDay(
  plan: GeneratedBlockPlan,
  at: DayAddress,
  date: string,
  now: number,
  deps: BlockSessionDeps
): Promise<GeneratedBlockPlan> {
  const day = plan.weeks[at.weekIndex]?.days[at.dayIndex];
  if (!day) return plan;
  const lifted = liftingDates(await deps.entriesInRange(date, date));
  if (!lifted.has(date)) await deps.logWorkouts(workoutsForDay(day), Math.min(sessionTimestamp(date), now));
  return setDaySession(plan, at, {
    status: 'logged',
    date,
    confirmedAt: day.session?.confirmedAt ?? now,
    loggedAt: now,
  });
}

// Every confirmed session whose time has come goes into Xả. Returns the
// updated plan, or null when nothing was due.
export async function logDueSessions(
  plan: GeneratedBlockPlan,
  now: number,
  deps: BlockSessionDeps
): Promise<GeneratedBlockPlan | null> {
  const due = dueSessions(plan, now);
  if (due.length === 0) return null;
  let next = plan;
  for (const d of due) next = await logPlanDay(next, d.at, d.date, now, deps);
  return next;
}

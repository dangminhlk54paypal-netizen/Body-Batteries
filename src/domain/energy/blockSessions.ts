import { dateString } from '../../lib/dateUtils';
import { isLiftingExercise } from '../../lib/activityLabels';
import { dateForWeekday } from './blockPlanEdits';
import { estimateLiftingMinutes } from './liftingEngine';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import type {
  BlockWeekPlan,
  GeneratedBlockPlan,
  PlannedSessionConfirmation,
  ResolvedDayPlan,
} from '../../types/powerliftingBlock';

// A planned day the lifter confirmed ("I'll train this") goes into Xả by
// itself: on its day at 18:00 — the evening, when most people train — or right
// away for a day already behind them. After that the Xả entry is an ordinary
// one: moved or deleted from the training log like anything else, and the plan
// just notices. Pure; blockSessionService does the I/O.

// When a confirmed session is logged, unless the user logs it right away.
export const SESSION_HOUR = 18;

export interface DayAddress {
  weekIndex: number;
  dayIndex: number;
}

export function sessionTimestamp(date: string): number {
  return new Date(`${date}T${String(SESSION_HOUR).padStart(2, '0')}:00:00`).getTime();
}

// The day's date in the plan (its weekday inside its week), or null when the
// week is too short to hold that weekday.
export function planDateOf(week: BlockWeekPlan, day: ResolvedDayPlan): string | null {
  return dateForWeekday(week, day.dayOfWeek);
}

// What goes into Xả: every main/secondary lift with its planned sets (the
// prime as a warm-up). Accessories are free text with no kcal model, so they
// stay in the plan only.
export function workoutsForDay(day: ResolvedDayPlan): WorkoutSession[] {
  return day.variations
    .filter((v) => v.sets.length > 0)
    .map((v) => ({
      type: v.variation.exercise,
      minutes: estimateLiftingMinutes(v.sets),
      variationId: v.variation.variationId,
      sets: v.sets,
    }));
}

// Calendar days that already hold a lifting Xả — a day the user logged by
// hand is never logged twice.
export function liftingDates(entries: ActivityLogEntry[]): Set<string> {
  return new Set(
    entries.filter((e) => e.workouts.some((w) => isLiftingExercise(w.type))).map((e) => dateString(new Date(e.timestamp)))
  );
}

export function setDaySession(
  plan: GeneratedBlockPlan,
  at: DayAddress,
  session: PlannedSessionConfirmation | null
): GeneratedBlockPlan {
  return {
    ...plan,
    weeks: plan.weeks.map((week, wi) =>
      wi !== at.weekIndex
        ? week
        : {
            ...week,
            days: week.days.map((day, di) => {
              if (di !== at.dayIndex) return day;
              if (session) return { ...day, session };
              // Dropping the confirmation: rebuild without the key.
              const { session: _dropped, ...rest } = day;
              void _dropped;
              return rest;
            }),
          }
    ),
  };
}

export interface DueSession {
  at: DayAddress;
  date: string;
  timestamp: number;
}

// Confirmed sessions whose time has come (18:00 of their day, at or before `now`).
export function dueSessions(plan: GeneratedBlockPlan, now: number): DueSession[] {
  const due: DueSession[] = [];
  plan.weeks.forEach((week, weekIndex) =>
    week.days.forEach((day, dayIndex) => {
      const s = day.session;
      if (s?.status !== 'planned') return;
      const timestamp = sessionTimestamp(s.date);
      if (timestamp <= now) due.push({ at: { weekIndex, dayIndex }, date: s.date, timestamp });
    })
  );
  return due;
}

// How confirming a day on `date` plays out at `today`:
//   past   → logged now, on that day at 18:00
//   today  → the user picks: log now (trained already) or at 18:00
//   future → remembered, logged when its day comes
export function confirmTiming(date: string, today: string): 'past' | 'today' | 'future' {
  return date < today ? 'past' : date === today ? 'today' : 'future';
}

export type DaySessionStatus =
  | { kind: 'open' } // nothing confirmed and nothing logged that day
  | { kind: 'inLog' } // not confirmed, but the log already holds lifts that day
  | { kind: 'planned'; date: string; moved: boolean } // confirmed, waiting for its day
  // In Xả; `present` = false once the user moved or deleted it in the log.
  | { kind: 'logged'; date: string; present: boolean };

export function daySessionStatus(
  week: BlockWeekPlan,
  day: ResolvedDayPlan,
  lifted: Set<string>
): DaySessionStatus {
  const planDate = planDateOf(week, day);
  const s = day.session;
  if (s?.status === 'planned') return { kind: 'planned', date: s.date, moved: s.date !== planDate };
  if (s?.status === 'logged') return { kind: 'logged', date: s.date, present: lifted.has(s.date) };
  return planDate && lifted.has(planDate) ? { kind: 'inLog' } : { kind: 'open' };
}

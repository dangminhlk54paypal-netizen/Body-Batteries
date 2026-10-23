import type { WalkSession, DailyWalkTotal } from '../../types/walk';

// Pure helpers for "ra khỏi nhà" walk sessions. No I/O — unit-tested.

// Pedometer counts can come back as floats or negative noise; keep whole,
// non-negative step counts.
export function normalizeSteps(steps: number): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.round(steps);
}

// Whole minutes an outing lasted (or has lasted so far, if still active).
export function sessionMinutes(session: WalkSession, now: number = Date.now()): number {
  const end = session.endedAt ?? now;
  return Math.max(0, Math.round((end - session.startedAt) / 60_000));
}

// Sum of steps from finished outings on a given day.
export function totalStepsForDate(sessions: WalkSession[], date: string): number {
  return sessions
    .filter((s) => s.date === date && s.endedAt !== null)
    .reduce((sum, s) => sum + normalizeSteps(s.steps), 0);
}

// Per-day accumulated totals of finished outings, newest day first.
export function dailyWalkTotals(sessions: WalkSession[]): DailyWalkTotal[] {
  const byDate = new Map<string, DailyWalkTotal>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    const t = byDate.get(s.date) ?? { date: s.date, steps: 0, outings: 0 };
    t.steps += normalizeSteps(s.steps);
    t.outings += 1;
    byDate.set(s.date, t);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

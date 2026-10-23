import {
  normalizeSteps,
  sessionMinutes,
  totalStepsForDate,
  dailyWalkTotals,
} from '../walkSessions';
import type { WalkSession } from '../../../types/walk';

function walk(over: Partial<WalkSession>): WalkSession {
  return { id: 'w', date: '2026-10-23', startedAt: 0, endedAt: 60_000, steps: 0, ...over };
}

describe('normalizeSteps', () => {
  it('rounds and clamps to non-negative', () => {
    expect(normalizeSteps(1234.6)).toBe(1235);
    expect(normalizeSteps(-5)).toBe(0);
    expect(normalizeSteps(NaN)).toBe(0);
  });
});

describe('sessionMinutes', () => {
  it('uses endedAt for finished outings', () => {
    expect(sessionMinutes(walk({ startedAt: 0, endedAt: 30 * 60_000 }))).toBe(30);
  });
  it('uses now for an active outing', () => {
    expect(sessionMinutes(walk({ startedAt: 0, endedAt: null }), 12 * 60_000)).toBe(12);
  });
});

describe('totalStepsForDate', () => {
  it('sums only finished outings of that day', () => {
    const sessions = [
      walk({ id: 'a', steps: 1000 }),
      walk({ id: 'b', steps: 2500 }),
      walk({ id: 'c', steps: 900, endedAt: null }), // still outside
      walk({ id: 'd', steps: 4000, date: '2026-10-22' }),
    ];
    expect(totalStepsForDate(sessions, '2026-10-23')).toBe(3500);
    expect(totalStepsForDate(sessions, '2026-10-22')).toBe(4000);
    expect(totalStepsForDate(sessions, '2026-10-21')).toBe(0);
  });
});

describe('dailyWalkTotals', () => {
  it('accumulates per day, newest first, counting outings', () => {
    const totals = dailyWalkTotals([
      walk({ id: 'a', date: '2026-10-22', steps: 4000 }),
      walk({ id: 'b', steps: 1000 }),
      walk({ id: 'c', steps: 2000 }),
      walk({ id: 'd', steps: 500, endedAt: null }),
    ]);
    expect(totals).toEqual([
      { date: '2026-10-23', steps: 3000, outings: 2 },
      { date: '2026-10-22', steps: 4000, outings: 1 },
    ]);
  });
});

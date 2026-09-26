import { suggestActivityPrefill, formatHHmm } from '../activityHabit';
import type { ActivityLogEntry, WorkoutSession } from '../../../types/energy';

const DAY = 24 * 60 * 60 * 1000;
// "Now": Friday 2026-09-25 07:10 local time.
const NOW = new Date(2026, 8, 25, 7, 10).getTime();

function at(daysBack: number, h: number, m: number): number {
  const d = new Date(NOW - daysBack * DAY);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function entry(start: number, w: WorkoutSession, withTimes = true): ActivityLogEntry {
  return {
    id: `a${start}`,
    timestamp: start + w.minutes * 60_000,
    startAt: withTimes ? start : undefined,
    endAt: withTimes ? start + w.minutes * 60_000 : undefined,
    steps: 0,
    workouts: [w],
    energyKcal: 300,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-09-20',
  };
}

describe('suggestActivityPrefill', () => {
  it('suggests the activity usually done around this time, with its usual length and start', () => {
    const history = [
      entry(at(1, 6, 30), { type: 'running', minutes: 30 }),
      entry(at(2, 6, 40), { type: 'running', minutes: 35 }),
      entry(at(4, 6, 25), { type: 'running', minutes: 28 }),
      entry(at(3, 18, 0), { type: 'swimming', minutes: 45 }), // evening: not now
    ];
    const p = suggestActivityPrefill(history, NOW);
    expect(p).toMatchObject({ type: 'running', minutes: 30, startTime: '06:30', endTime: '07:00', days: 3 });
  });

  it('needs at least two different days — once is not a habit', () => {
    const history = [entry(at(1, 6, 30), { type: 'running', minutes: 30 })];
    expect(suggestActivityPrefill(history, NOW)).toBeNull();
  });

  it('ignores today (already logged), old entries and other times of day', () => {
    const history = [
      entry(at(0, 6, 30), { type: 'running', minutes: 30 }),
      entry(at(40, 6, 30), { type: 'running', minutes: 30 }),
      entry(at(2, 20, 0), { type: 'cycling', minutes: 30 }),
      entry(at(3, 20, 0), { type: 'cycling', minutes: 30 }),
    ];
    expect(suggestActivityPrefill(history, NOW)).toBeNull();
  });

  it('keeps custom activities by name and leaves times empty when never recorded', () => {
    const w: WorkoutSession = { type: 'custom', minutes: 60, customName: 'Pickleball', customMet: 6 };
    const history = [entry(at(1, 7, 0), w, false), entry(at(8, 7, 5), w, false)];
    const p = suggestActivityPrefill(history, NOW);
    expect(p).toMatchObject({ type: 'custom', customName: 'Pickleball', customMet: 6, minutes: 60 });
    expect(p?.startTime).toBeUndefined();
  });

  it('skips set-based lifting (it has its own sheet)', () => {
    const lift: WorkoutSession = { type: 'squat', minutes: 40, sets: [] };
    const history = [entry(at(1, 6, 30), lift), entry(at(2, 6, 30), lift)];
    expect(suggestActivityPrefill(history, NOW)).toBeNull();
  });
});

describe('formatHHmm', () => {
  it('wraps past midnight', () => {
    expect(formatHHmm(1440 + 15)).toBe('00:15');
    expect(formatHHmm(390)).toBe('06:30');
  });
});

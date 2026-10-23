import { inferBlockSetup } from '../blockFromHistory';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';
import type { LiftMaxRecord } from '../../../types/trainingLog';

const sets = (weightKg: number, reps: number, n = 3): LiftingSet[] =>
  Array.from({ length: n }, () => ({ kind: 'working' as const, weightKg, reps }));

let id = 0;
// A session at 18:00 local time on `date`.
function session(date: string, workouts: Partial<WorkoutSession>[]): ActivityLogEntry {
  const [y, m, d] = date.split('-').map(Number);
  return {
    id: `e${id++}`,
    timestamp: new Date(y, m - 1, d, 18).getTime(),
    steps: 0,
    energyKcal: 200,
    satietyDrainKcal: 0,
    energyDayApplied: date,
    workouts: workouts.map((w) => ({ minutes: 40, ...w }) as WorkoutSession),
  };
}

// Three weeks of Mon bench / Wed squat (+ paused deadlift) / Fri bench.
const MONDAYS = ['2026-09-28', '2026-10-05', '2026-10-12'];
const add = (monday: string, days: number) => {
  const d = new Date(monday + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const habit: ActivityLogEntry[] = MONDAYS.flatMap((mon) => [
  session(mon, [{ type: 'bench_press', sets: sets(100, 3) }]),
  session(add(mon, 2), [
    { type: 'squat', sets: sets(140, 3) },
    { type: 'deadlift', variationId: 'deadlift_paused', sets: sets(150, 3) },
  ]),
  session(add(mon, 4), [{ type: 'bench_press', variationId: 'bench_paused', sets: sets(90, 5) }]),
]);

describe('inferBlockSetup', () => {
  it('returns null without lifting history', () => {
    expect(inferBlockSetup({ entries: [], liftMaxes: [], today: '2026-10-23' })).toBeNull();
  });

  it('reads the weekly pattern, Monday first, with the first lift of a day as its main', () => {
    const setup = inferBlockSetup({ entries: habit, liftMaxes: [], today: '2026-10-23' })!;
    expect(setup.sessions).toBe(9);
    expect(setup.weeks).toBe(3);
    expect(setup.schedule.map((d) => d.dayOfWeek)).toEqual([1, 3, 5]);
    expect(setup.schedule[1].variations).toEqual([
      { exercise: 'squat', variationId: 'squat_standard', role: 'main' },
      { exercise: 'deadlift', variationId: 'deadlift_paused', role: 'secondary' },
    ]);
    expect(setup.schedule[2].variations[0].variationId).toBe('bench_paused');
  });

  it('leaves out a one-off weekday when there is a clear habit', () => {
    const setup = inferBlockSetup({
      entries: [...habit, session('2026-10-17', [{ type: 'squat', sets: sets(100, 5) }])],
      liftMaxes: [],
      today: '2026-10-23',
    })!;
    expect(setup.schedule.map((d) => d.dayOfWeek)).toEqual([1, 3, 5]);
  });

  it('estimates 1RM from the straight lift, rounded down to 2.5 kg', () => {
    const setup = inferBlockSetup({ entries: habit, liftMaxes: [], today: '2026-10-23' })!;
    // 140 × 3 (Epley) ≈ 154 → 152.5; bench straight 100 × 3 → 110.
    expect(setup.oneRepMax.squat).toEqual({ kg: 152.5, source: 'estimate' });
    expect(setup.oneRepMax.bench_press).toEqual({ kg: 110, source: 'estimate' });
    // Only paused deadlifts: 150 × 3 ≈ 165, ÷ 0.9 ≈ 183.3 → 182.5.
    expect(setup.oneRepMax.deadlift).toEqual({ kg: 182.5, source: 'estimate' });
  });

  it('prefers a recent recorded max that is at least the estimate; ignores an old one', () => {
    const rec = (lift: LiftMaxRecord['lift'], weightKg: number, date: string): LiftMaxRecord => ({
      id: `${lift}${date}`,
      lift,
      weightKg,
      date,
      note: null,
      createdAt: 0,
    });
    const setup = inferBlockSetup({
      entries: habit,
      liftMaxes: [rec('squat', 160, '2026-10-01'), rec('bench_press', 130, '2025-01-01')],
      today: '2026-10-23',
    })!;
    expect(setup.oneRepMax.squat).toEqual({ kg: 160, source: 'record' });
    expect(setup.oneRepMax.bench_press?.source).toBe('estimate');
  });

  it('skips bodybuilding sessions and free-text variations', () => {
    const setup = inferBlockSetup({
      entries: [
        session('2026-10-05', [{ type: 'bodybuilding', bbMet: 5, sets: sets(20, 10) }]),
        session('2026-10-07', [{ type: 'squat', variationName: 'Pin squat', sets: sets(120, 3) }]),
      ],
      liftMaxes: [],
      today: '2026-10-23',
    });
    expect(setup?.schedule).toEqual([]);
    expect(setup?.oneRepMax.squat).toBeUndefined();
  });
});

import { buildLiftProgress } from '../trainingLogProgress';
import { addDaysToDateString as addDays } from '../../../lib/dateUtils';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

const at = (date: string, h = 18) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();
const working = (weightKg: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const entry = (date: string, workouts: WorkoutSession[]): ActivityLogEntry => ({
  id: date,
  timestamp: at(date),
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: date,
});
const build = (over: Partial<Parameters<typeof buildLiftProgress>[0]>) =>
  buildLiftProgress({
    entries: [],
    dayRecords: [],
    weights: [],
    format: DEFAULT_TRAINING_LOG_FORMAT,
    language: 'vi',
    ...over,
  });

describe('buildLiftProgress — weekly top sets for the chart', () => {
  it('takes the heaviest working set of each competition lift per week, ignoring variations and warm-ups', () => {
    const weeks = build({
      entries: [
        entry('2026-09-08', [
          { type: 'squat', minutes: 30, sets: [{ kind: 'warmup', weightKg: 140, reps: 1 }, ...working(130, [1]), ...working(115, [3, 3])] },
          { type: 'squat', minutes: 20, variationId: 'squat_paused', sets: working(135, [1]) },
        ]),
        entry('2026-09-10', [{ type: 'squat', minutes: 30, sets: working(132.5, [1]) }]),
        entry('2026-09-16', [{ type: 'bench_press', minutes: 30, sets: working(95, [1]) }]),
      ],
    });
    expect(weeks.map((w) => [w.weekStart, w.top])).toEqual([
      ['2026-09-07', { squat: 132.5 }],
      ['2026-09-14', { bench_press: 95 }],
    ]);
  });

  it('the notebook line wins over Xả for a day (hand-written or edited)', () => {
    const weeks = build({
      entries: [entry('2026-09-08', [{ type: 'deadlift', minutes: 30, sets: working(150, [1]) }])],
      dayRecords: [
        { date: '2026-09-08', overrideText: 'D 155 (160 ❌) 5x3x130', note: null, sourceSignature: 'x', updatedAt: 1 },
        { date: '2026-09-09', overrideText: 'B 97.5 PB 90', note: null, sourceSignature: null, updatedAt: 1 },
      ],
    });
    expect(weeks[0].top).toEqual({ deadlift: 155, bench_press: 97.5 });
  });

  it('counts days written only in the notebook, in the user’s own shorthand (prime left out)', () => {
    const day = (date: string, overrideText: string) => ({ date, overrideText, note: null, sourceSignature: null, updatedAt: 0 });
    const weeks = build({
      dayRecords: [
        day('2026-09-14', 'B 95+ 4x6x72.5  iC 3x6x60'),
        day('2026-09-16', 'S 135 + 4x6x100  pd 140+2x3x100+3x105'),
        day('2026-09-18', 'D 3x180 5x5x160'),
      ],
    });
    expect(weeks.map((w) => [w.weekStart, w.top])).toEqual([
      ['2026-09-14', { bench_press: 72.5, squat: 100, deadlift: 180 }],
    ]);
  });

  it('body weight per week: average of the week, interpolated between weigh-ins, carried after the last', () => {
    const weeks = build({
      entries: [
        entry('2026-08-31', [{ type: 'squat', minutes: 30, sets: working(120, [1]) }]),
        entry('2026-09-08', [{ type: 'squat', minutes: 30, sets: working(125, [1]) }]),
        entry('2026-09-15', [{ type: 'squat', minutes: 30, sets: working(127.5, [1]) }]),
        entry('2026-09-22', [{ type: 'squat', minutes: 30, sets: working(127.5, [1]) }]),
      ],
      weights: [
        { timestamp: at('2026-08-27', 7), value: 80 },
        { timestamp: at('2026-09-09', 7), value: 76.3 },
        { timestamp: at('2026-09-11', 7), value: 76.9 },
      ],
      fallbackBodyWeightKg: 70,
    });
    expect(weeks.map((w) => w.bodyWeightSource)).toEqual(['interpolated', 'measured', 'carried', 'carried']);
    const [w1, w2, w3] = weeks.map((w) => w.bodyWeightKg!);
    expect(w1).toBeGreaterThan(76.3); // between 80 (27.08) and 76.3 (09.09), not 80 and not the profile's 70
    expect(w1).toBeLessThan(80);
    expect(w2).toBeCloseTo(76.6, 5); // (76.3 + 76.9) / 2
    expect(w3).toBe(76.9);
  });

  it('before the first weigh-in: that first reading (flagged), never the profile weight', () => {
    const weeks = build({
      entries: [entry('2026-08-03', [{ type: 'squat', minutes: 30, sets: working(100, [1]) }])],
      weights: [{ timestamp: at('2026-09-09', 7), value: 76 }],
      fallbackBodyWeightKg: 70,
    });
    expect(weeks.map((w) => [w.bodyWeightKg, w.bodyWeightSource])).toEqual([[76, 'earliest']]);
    const none = build({ entries: [entry('2026-08-03', [{ type: 'squat', minutes: 30, sets: working(100, [1]) }])], fallbackBodyWeightKg: 70 });
    expect(none.map((w) => [w.bodyWeightKg, w.bodyWeightSource])).toEqual([[70, 'profile']]);
  });

  it('a cut shows in the ratio: 100 → 105 kg lifted (+5%) at 80 → 76 kg body weight is +10.5%', () => {
    const weights = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
      timestamp: at(addDays('2026-07-27', i * 7), 7),
      value: 80 - (4 * i) / 8,
    }));
    const weeks = build({
      entries: [0, 8].map((i) =>
        entry(addDays('2026-07-28', i * 7), [{ type: 'squat', minutes: 30, sets: working(i === 0 ? 100 : 105, [1]) }])
      ),
      weights,
    });
    const ratios = weeks.map((w) => w.top.squat! / w.bodyWeightKg!);
    expect(ratios[0]).toBeCloseTo(1.25, 5);
    expect(ratios[1]).toBeCloseTo(105 / 76, 5);
    expect(ratios[1] / ratios[0] - 1).toBeGreaterThan(0.1);
  });

});

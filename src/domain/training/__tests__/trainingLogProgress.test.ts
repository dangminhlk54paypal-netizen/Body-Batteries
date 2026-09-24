import { buildLiftProgress } from '../trainingLogProgress';
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

  it('body weight: first weigh-in of the week, else carried forward, else the fallback', () => {
    const weeks = build({
      entries: [
        entry('2026-08-31', [{ type: 'squat', minutes: 30, sets: working(120, [1]) }]),
        entry('2026-09-08', [{ type: 'squat', minutes: 30, sets: working(125, [1]) }]),
        entry('2026-09-15', [{ type: 'squat', minutes: 30, sets: working(127.5, [1]) }]),
      ],
      weights: [
        { timestamp: at('2026-09-09', 7), value: 76.3 },
        { timestamp: at('2026-09-11', 7), value: 76.9 },
      ],
      fallbackBodyWeightKg: 78,
    });
    expect(weeks.map((w) => w.bodyWeightKg)).toEqual([78, 76.3, 76.9]);
  });
});

import {
  addVolume,
  defaultLinearProgression,
  defaultLinearWeeks,
  linearWeekPct,
  nextBlockOneRepMax,
  nextBlockTrainingMax,
  suggestTrainingMax,
  resizeLinearWeeks,
} from '../linearProgression';
import { generateBlockPlan } from '../blockEngine';
import type { UserProfile } from '../../../types/energy';
import type { TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };

describe('linear progression frame', () => {
  it('the default 6-week table: 4×5, 4×4, 3×4, 3×3, 3×2, then a test single', () => {
    expect(defaultLinearWeeks(6)).toEqual([
      { sets: 4, reps: 5 },
      { sets: 4, reps: 4 },
      { sets: 3, reps: 4 },
      { sets: 3, reps: 3 },
      { sets: 3, reps: 2 },
      { sets: 1, reps: 1, test: true },
    ]);
    expect(defaultLinearWeeks(4).map((w) => `${w.sets}x${w.reps}`)).toEqual(['4x5', '4x4', '3x4', '1x1']);
    expect(defaultLinearWeeks(8)[5]).toEqual({ sets: 3, reps: 2 }); // longer: repeats the last working week
  });

  it('+5 %1RM a week from 70: W1 70 … W6 95; kg mode keeps the % (the kg goes on the bar)', () => {
    const p = defaultLinearProgression(6);
    expect([0, 1, 2, 3, 4, 5].map((w) => linearWeekPct(p, w))).toEqual([70, 75, 80, 85, 90, 95]);
    expect(linearWeekPct({ ...p, stepMode: 'kg', step: 2.5 }, 5)).toBe(70);
    expect(linearWeekPct({ ...p, startPct: 90, step: 5 }, 5)).toBe(100); // never above 100
  });

  it('resizing keeps the user’s rows and the test week last', () => {
    const mine = [{ sets: 5, reps: 5 }, { sets: 5, reps: 3 }, { sets: 1, reps: 1, test: true }];
    expect(resizeLinearWeeks(mine, 4)).toEqual([
      { sets: 5, reps: 5, test: undefined },
      { sets: 5, reps: 3, test: undefined },
      { sets: 5, reps: 3, test: undefined },
      { sets: 1, reps: 1, test: true },
    ]);
    expect(resizeLinearWeeks(mine, 2).map((w) => w.test ?? false)).toEqual([false, true]);
  });

  it('"keep the loads, more volume": +1 set on every working week, the test stays a single', () => {
    const more = addVolume(defaultLinearWeeks(6), 1);
    expect(more.map((w) => w.sets)).toEqual([5, 5, 4, 4, 4, 1]);
  });

  it('next block 1RM: same, +5% (down to 2.5 kg), or +5 kg', () => {
    const prev = { squat: 150, bench_press: 107.5 };
    expect(nextBlockOneRepMax(prev, 'same')).toEqual(prev);
    expect(nextBlockOneRepMax(prev, 'pct5')).toEqual({ squat: 157.5, bench_press: 112.5 }); // 112.875 → 112.5
    expect(nextBlockOneRepMax(prev, 'kg5')).toEqual({ squat: 155, bench_press: 112.5 });
  });
});

describe('generateBlockPlan with focus "linear"', () => {
  const config: TrainingBlockConfig = {
    id: 'l',
    createdAt: 1,
    weekStartDate: '2026-09-07',
    progressiveWeeks: 6,
    hasDeload: false,
    focus: 'linear',
    progression: defaultLinearProgression(6),
    schedule: [
      {
        dayOfWeek: 1,
        variations: [
          { exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' },
          { exercise: 'bench_press', variationId: 'bench_paused', role: 'secondary' },
        ],
        accessories: [],
      },
    ],
    oneRepMax: { squat: 140, bench_press: 100, deadlift: 180 },
    isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
    bodyWeightKg: 80,
    deficitModeEnabled: false,
  };

  it('touch-and-go 70% 4×5 beside paused 65% in W1; W5 90% / 85% 3×2; W6 a 95% test single', () => {
    const plan = generateBlockPlan(config, profile);
    const [tng, paused] = plan.weeks[0].days[0].variations;
    expect(tng.sets).toEqual(Array(4).fill({ kind: 'working', weightKg: 70, reps: 5 }));
    expect(paused.sets[0].weightKg).toBe(65);
    expect(tng.reference?.method).toBe('linear');
    const w5 = plan.weeks[4].days[0].variations;
    expect(w5.map((v) => `${v.sets.length}x${v.sets[0].reps}x${v.sets[0].weightKg}`)).toEqual(['3x2x90', '3x2x85']);
    const w6 = plan.weeks[5].days[0].variations[0];
    expect(w6.sets).toEqual([{ kind: 'working', weightKg: 95, reps: 1 }]);
  });

  it('kg mode: +2.5 kg on the bar every week', () => {
    const plan = generateBlockPlan(
      { ...config, progression: { ...config.progression!, stepMode: 'kg', step: 2.5 } },
      profile
    );
    expect(plan.weeks.map((w) => w.days[0].variations[0].sets[0].weightKg)).toEqual([70, 72.5, 75, 77.5, 80, 82.5]);
  });

  it('a deload after it: the last working week −10 points at half the sets', () => {
    const plan = generateBlockPlan({ ...config, hasDeload: true }, profile);
    const deload = plan.weeks[6].days[0].variations[0];
    expect(plan.weeks[6].isDeload).toBe(true);
    expect(deload.sets).toEqual(Array(2).fill({ kind: 'working', weightKg: 80, reps: 2 })); // 90 − 10, 3 → 2 sets
  });

  it('falls back to the default frame when a linear block has none, fitted to its length', () => {
    const plan = generateBlockPlan({ ...config, progression: undefined, progressiveWeeks: 3 }, profile);
    expect(plan.weeks.map((w) => w.days[0].variations[0].sets.length)).toEqual([4, 4, 1]);
  });

  it('with a Training Max per variation, each runs the full week % of its own TM (no offset)', () => {
    const plan = generateBlockPlan(
      { ...config, trainingMax: { bench_touch_and_go: 122.5, bench_paused: 117.5 } },
      profile
    );
    const [tng, comp] = plan.weeks[0].days[0].variations;
    expect(tng.sets[0].weightKg).toBe(85); // 70% of 122.5 = 85.75 → 85
    expect(comp.sets[0].weightKg).toBe(82.5); // 70% of 117.5 = 82.25 → 82.5
    expect(comp.reference?.oneRepMaxKg).toBe(117.5); // "% of TM"
    expect(comp.pct1rm).toBe(70);
    expect(plan.weeks[4].days[0].variations[1].sets[0].weightKg).toBe(105); // 90% of 117.5 = 105.75 → 105
  });
});

describe('Training Max', () => {
  it('suggests 90% of the lift 1RM × the variation load factor, rounded down to 2.5 kg', () => {
    expect(suggestTrainingMax('bench_touch_and_go', 130)).toBe(115); // 117 → down to 115
    expect(suggestTrainingMax('bench_paused', 130)).toBe(105); // 130 × 0.9 × 0.9 = 105.3
    expect(suggestTrainingMax('squat_standard', 0)).toBe(0);
  });

  it('carries the TMs into the next block (+5% or +5 kg)', () => {
    expect(nextBlockTrainingMax({ bench_paused: 117.5, squat_standard: 200 }, 'pct5')).toEqual({
      bench_paused: 122.5, // 123.375
      squat_standard: 210,
    });
    expect(nextBlockTrainingMax({ bench_paused: 117.5 }, 'kg5')).toEqual({ bench_paused: 122.5 });
  });
});

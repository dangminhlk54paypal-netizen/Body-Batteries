import {
  estimateBeginnerOneRepMax,
  resolveOneRepMax,
  focusCurvePoint,
  deloadCurvePoint,
  applyDeficitMode,
  generateBlockPlan,
} from '../blockEngine';
import type { UserProfile } from '../../../types/energy';
import type { BlockDayPlan, BlockWeekPlan, TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = {
  weightKg: 80,
  heightCm: 175,
  age: 28,
  sex: 'male',
  occupation: 'sedentary',
};

describe('estimateBeginnerOneRepMax', () => {
  it('applies the %BW multiplier per lift plus the 0.85 safety factor', () => {
    // squat: 1.0 × 0.85 × 80 = 68
    expect(estimateBeginnerOneRepMax('squat', 80)).toBe(68);
    // bench: 0.75 × 0.85 × 80 = 51
    expect(estimateBeginnerOneRepMax('bench_press', 80)).toBe(51);
    // deadlift: 1.25 × 0.85 × 80 = 85
    expect(estimateBeginnerOneRepMax('deadlift', 80)).toBe(85);
  });

  it('is 0 for a non-positive body weight', () => {
    expect(estimateBeginnerOneRepMax('squat', 0)).toBe(0);
  });
});

describe('resolveOneRepMax', () => {
  it('keeps a declared 1RM as-is and flags it not estimated', () => {
    const result = resolveOneRepMax({ squat: 120 }, 80);
    expect(result.squat).toEqual({ value: 120, isEstimated: false });
  });

  it('falls back to the beginner estimate for a missing/zero 1RM and flags it', () => {
    const result = resolveOneRepMax({ squat: 0, bench_press: undefined }, 80);
    expect(result.squat).toEqual({ value: 68, isEstimated: true });
    expect(result.bench_press).toEqual({ value: 51, isEstimated: true });
  });
});

describe('focusCurvePoint', () => {
  it('volume: ramps from the early anchor to the late anchor across the block', () => {
    expect(focusCurvePoint('volume', 0, 5, 0)).toEqual({ pct: 68, sets: 5, reps: 9 });
    expect(focusCurvePoint('volume', 4, 5, 0)).toEqual({ pct: 78, sets: 4, reps: 5 });
    // week 2 of 5 (0-based index 2) sits exactly at t=0.5 → the mid anchor
    expect(focusCurvePoint('volume', 2, 5, 0)).toEqual({ pct: 73, sets: 4, reps: 7 });
  });

  it('peaking: ends near a single near-max rep with very low volume', () => {
    const last = focusCurvePoint('peaking', 4, 5, 0);
    expect(last.pct).toBeGreaterThanOrEqual(90);
    expect(last.reps).toBe(1);
    expect(last.sets).toBeLessThanOrEqual(2);
  });

  it('normal: cycles day role by index and only nudges the heavy day over the block', () => {
    const heavyEarly = focusCurvePoint('normal', 0, 5, 0);
    const moderate = focusCurvePoint('normal', 0, 5, 1);
    const light = focusCurvePoint('normal', 0, 5, 2);
    const heavyLate = focusCurvePoint('normal', 4, 5, 0);
    expect(heavyEarly.pct).toBeGreaterThan(moderate.pct);
    expect(moderate.pct).toBeGreaterThan(light.pct);
    expect(heavyLate.pct).toBeGreaterThan(heavyEarly.pct);
    // moderate/light days don't drift across weeks
    expect(focusCurvePoint('normal', 4, 5, 1)).toEqual(moderate);
  });

  it('a single-week block (no ramp room) resolves to the late anchor', () => {
    expect(focusCurvePoint('intensity', 0, 1, 0)).toEqual({ pct: 88, sets: 3, reps: 3 });
  });
});

describe('deloadCurvePoint', () => {
  it('drops %1RM by 10 points and roughly halves the sets, keeping reps', () => {
    expect(deloadCurvePoint({ pct: 78, sets: 4, reps: 5 })).toEqual({ pct: 68, sets: 2, reps: 5 });
  });

  it('never drops below 1 set or a negative %1RM', () => {
    expect(deloadCurvePoint({ pct: 5, sets: 1, reps: 5 })).toEqual({ pct: 0, sets: 1, reps: 5 });
  });
});

describe('applyDeficitMode', () => {
  const baseWeek: BlockWeekPlan = {
    weekNumber: 1,
    isDeload: false,
    totalKcal: 100,
    weeklyDeficitTargetKcal: null,
    startDate: '2026-09-07',
    endDate: '2026-09-13',
    days: [
      {
        dayOfWeek: 1,
        variations: [],
        accessories: [
          { customName: 'Row', sets: 4, reps: '10' },
          { customName: 'Curl', sets: 1, reps: '12' },
        ],
        totalKcal: 0,
        totalMinutes: 0,
      },
    ],
  };

  it('cuts accessory sets ~15-20%, never below 1, and leaves everything else untouched', () => {
    const result = applyDeficitMode(baseWeek);
    expect(result.days[0].accessories[0].sets).toBe(3); // round(4 * 0.825) = 3
    expect(result.days[0].accessories[1].sets).toBe(1); // floor guard, not 0
    expect(result.weekNumber).toBe(baseWeek.weekNumber);
  });
});

describe('generateBlockPlan (integration)', () => {
  const schedule: BlockDayPlan[] = [
    {
      dayOfWeek: 3, // Wednesday
      variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }],
      accessories: [{ customName: 'Leg press', sets: 3, reps: '10' }],
    },
  ];

  const config: TrainingBlockConfig = {
    id: 'block-1',
    createdAt: Date.now(),
    weekStartDate: '2026-09-07', // a Monday
    progressiveWeeks: 3,
    hasDeload: true,
    focus: 'intensity',
    schedule,
    oneRepMax: { squat: 140 },
    isBeginnerEstimated: { squat: false, bench_press: true, deadlift: true },
    bodyWeightKg: 80,
    deficitModeEnabled: false,
  };

  it('produces progressiveWeeks + 1 weeks, the last one flagged as deload', () => {
    const plan = generateBlockPlan(config, profile);
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(plan.weeks[3].isDeload).toBe(true);
    expect(plan.weeks.slice(0, 3).every((w) => !w.isDeload)).toBe(true);
  });

  it('resolves concrete sets with positive kcal, reusing liftingSessionKcal', () => {
    const plan = generateBlockPlan(config, profile);
    const week1Squat = plan.weeks[0].days[0].variations[0];
    expect(week1Squat.sets.length).toBeGreaterThan(0);
    expect(week1Squat.sets[0].weightKg).toBeGreaterThan(0);
    expect(week1Squat.estimatedKcal).toBeGreaterThan(0);
    expect(plan.weeks[0].totalKcal).toBe(week1Squat.estimatedKcal);
  });

  it('the deload week loads noticeably lighter than the last progressive week', () => {
    const plan = generateBlockPlan(config, profile);
    const lastProgressive = plan.weeks[2].days[0].variations[0];
    const deload = plan.weeks[3].days[0].variations[0];
    expect(deload.pct1rm).toBeLessThan(lastProgressive.pct1rm);
    expect(deload.sets.length).toBeLessThan(lastProgressive.sets.length);
  });

  it('without a weight goal, weeklyDeficitTargetKcal is null even off Deficit Mode', () => {
    const plan = generateBlockPlan(config, profile);
    expect(plan.weeks[0].weeklyDeficitTargetKcal).toBeNull();
  });

  it('Deficit Mode cuts accessory sets but leaves main-lift %1RM alone', () => {
    const cutConfig: TrainingBlockConfig = { ...config, deficitModeEnabled: true };
    const cutProfile: UserProfile = { ...profile, goalWeightKg: profile.weightKg - 5, goalWeeks: 10 };
    const withDeficit = generateBlockPlan(cutConfig, cutProfile);
    const without = generateBlockPlan(config, profile);

    expect(withDeficit.weeks[0].days[0].accessories[0].sets).toBeLessThan(
      without.weeks[0].days[0].accessories[0].sets
    );
    expect(withDeficit.weeks[0].days[0].variations[0].pct1rm).toBe(
      without.weeks[0].days[0].variations[0].pct1rm
    );
    expect(withDeficit.weeks[0].weeklyDeficitTargetKcal).not.toBeNull();
    expect(withDeficit.weeks[0].weeklyDeficitTargetKcal as number).toBeGreaterThan(0);
  });

  it('each week carries its real Monday-Sunday calendar dates, derived from weekStartDate', () => {
    const plan = generateBlockPlan(config, profile);
    expect(plan.weeks[0].startDate).toBe('2026-09-07');
    expect(plan.weeks[0].endDate).toBe('2026-09-13');
    expect(plan.weeks[1].startDate).toBe('2026-09-14'); // +7 days
    expect(plan.weeks[3].startDate).toBe('2026-09-28'); // deload = progressiveWeeks(3) * 7 later
  });
});

describe('generateBlockPlan — Monday-first day ordering', () => {
  it('sorts a Sunday + Monday schedule as Monday first, Sunday last', () => {
    const schedule: BlockDayPlan[] = [
      { dayOfWeek: 0, variations: [{ exercise: 'deadlift', variationId: 'deadlift_standard', role: 'main' }], accessories: [] },
      { dayOfWeek: 1, variations: [{ exercise: 'bench_press', variationId: 'bench_paused', role: 'main' }], accessories: [] },
    ];
    const config: TrainingBlockConfig = {
      id: 'block-2',
      createdAt: Date.now(),
      weekStartDate: '2026-09-07',
      progressiveWeeks: 1,
      hasDeload: false,
      focus: 'normal',
      schedule,
      oneRepMax: { squat: 100, bench_press: 80, deadlift: 120 },
      isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
      bodyWeightKg: 80,
      deficitModeEnabled: false,
    };
    const plan = generateBlockPlan(config, profile);
    expect(plan.weeks[0].days[0].dayOfWeek).toBe(1); // Monday first
    expect(plan.weeks[0].days[1].dayOfWeek).toBe(0); // Sunday last
  });
});

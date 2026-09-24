import {
  estimateBeginnerOneRepMax,
  resolveOneRepMax,
  focusCurvePoint,
  secondaryCurvePoint,
  deloadCurvePoint,
  loadPct,
  pctForRepsToFailure,
  repsToFailureFor,
  fatigueRir,
  rpeForLoad,
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

describe('load model (reps + target RPE + per-set fatigue → %1RM)', () => {
  it('reads %1RM from reps-to-failure with the inverse of the app’s Epley e1RM', () => {
    expect(pctForRepsToFailure(1)).toBe(100);
    expect(pctForRepsToFailure(10)).toBeCloseTo(75, 5); // Epley: 10 reps to failure = 75%
    expect(pctForRepsToFailure(30)).toBeCloseTo(50, 5);
  });

  it('adds fatigue per extra set, more for higher-rep sets (0.15 × reps, 0.5..1.5)', () => {
    expect(fatigueRir(1, 5)).toBe(0); // a single set carries no across-set fatigue
    expect(fatigueRir(4, 5)).toBeCloseTo(2.3, 5); // 3 × 0.75
    expect(fatigueRir(5, 10)).toBe(6); // 4 × 1.5
    expect(fatigueRir(3, 1)).toBe(1); // 2 × floor 0.5
  });

  it('4 × 7 at RPE 7 is loaded well below the old fixed 73%', () => {
    // 7 reps + 3 RIR + 3 × 1.05 fatigue (→ 3.2) = 13.2 → 1/(1+13.2/30) ≈ 69%
    expect(repsToFailureFor({ sets: 4, reps: 7, rpe: 7 })).toBeCloseTo(13.2, 5);
    expect(loadPct({ sets: 4, reps: 7, rpe: 7 })).toBe(69);
    expect(loadPct({ sets: 4, reps: 7, rpe: 7 })).toBeLessThan(73);
  });

  it('more sets at the same reps/RPE means a lighter load', () => {
    expect(loadPct({ sets: 6, reps: 8, rpe: 7.5 })).toBeLessThan(loadPct({ sets: 3, reps: 8, rpe: 7.5 }));
  });

  it('rpeForLoad is the inverse (display only), never below 5', () => {
    const p = { sets: 4, reps: 5, rpe: 8 };
    expect(rpeForLoad(loadPct(p), p.sets, p.reps)).toBeCloseTo(8, 0);
    expect(rpeForLoad(40, 3, 5)).toBe(5);
  });
});

describe('focusCurvePoint', () => {
  it('volume = hypertrophy/endurance: moderate loads, sets added over the block, last set ≤ RPE 7.5', () => {
    const weeks = [0, 1, 2, 3, 4].map((w) => focusCurvePoint('volume', w, 5, 0));
    expect(weeks[0]).toMatchObject({ sets: 4, reps: 10, rpe: 6.5 });
    expect(weeks[4]).toMatchObject({ sets: 6, reps: 8, rpe: 7.5 });
    for (const w of weeks) {
      expect(w.pct).toBeGreaterThanOrEqual(58);
      expect(w.pct).toBeLessThanOrEqual(70);
      expect(w.rpe).toBeLessThanOrEqual(7.5);
    }
    // weekly volume (sets × reps) never goes down
    const volume = weeks.map((w) => w.sets * w.reps);
    for (let i = 1; i < volume.length; i++) expect(volume[i]).toBeGreaterThanOrEqual(volume[i - 1] - 6);
    expect(volume[4]).toBeGreaterThan(volume[0]);
  });

  it('week 2 of 5 (t = 0.5) sits exactly on the middle anchor', () => {
    expect(focusCurvePoint('volume', 2, 5, 0)).toMatchObject({ sets: 5, reps: 10, rpe: 7 });
  });

  it('intensity climbs in load as reps drop, and stays inside docs/08 §2.1 (75-90%)', () => {
    const early = focusCurvePoint('intensity', 0, 5, 0);
    const late = focusCurvePoint('intensity', 4, 5, 0);
    expect(late.pct).toBeGreaterThan(early.pct);
    expect(early.pct).toBeGreaterThanOrEqual(75);
    expect(late.pct).toBeLessThanOrEqual(90);
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
    expect(heavyLate.rpe).toBe(heavyEarly.rpe + 1);
    // moderate/light days don't drift across weeks
    expect(focusCurvePoint('normal', 4, 5, 1)).toEqual(moderate);
  });

  it('a single-week block (no ramp room) resolves to the late anchor', () => {
    expect(focusCurvePoint('intensity', 0, 1, 0)).toMatchObject({ sets: 3, reps: 3, rpe: 8.5 });
  });
});

describe('secondaryCurvePoint', () => {
  it('one set fewer, one RPE easier, and lighter than the main movement', () => {
    const main = focusCurvePoint('intensity', 2, 5, 0);
    const sec = secondaryCurvePoint(main);
    expect(sec.sets).toBe(main.sets - 1);
    expect(sec.rpe).toBe(main.rpe - 1);
    expect(sec.pct).toBeLessThan(main.pct);
  });

  it('keeps at least 2 sets', () => {
    expect(secondaryCurvePoint(focusCurvePoint('peaking', 4, 5, 0)).sets).toBe(2);
  });
});

describe('deloadCurvePoint', () => {
  it('drops %1RM by 10 points and roughly halves the sets, keeping reps', () => {
    expect(deloadCurvePoint({ pct: 78, sets: 4, reps: 5, rpe: 8 })).toMatchObject({ pct: 68, sets: 2, reps: 5 });
  });

  it('never drops below 1 set or a negative %1RM', () => {
    expect(deloadCurvePoint({ pct: 5, sets: 1, reps: 5, rpe: 8 })).toMatchObject({ pct: 0, sets: 1, reps: 5 });
  });

  it('reads as light (RPE ≤ 6)', () => {
    const d = deloadCurvePoint(focusCurvePoint('intensity', 4, 5, 0));
    expect(d.rpe).toBeLessThanOrEqual(6);
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

  it('every variation carries the app suggestion + its arithmetic as `reference`', () => {
    const plan = generateBlockPlan(config, profile);
    const v = plan.weeks[0].days[0].variations[0];
    expect(v.reference).toMatchObject({ method: 'rpe', oneRepMaxKg: 140, loadFactor: 1 });
    expect(v.reference?.sets).toEqual(v.sets);
    expect(v.reference?.pct1rm).toBe(v.pct1rm);
    expect(v.reference?.repsToFailure).toBeGreaterThan(v.sets[0].reps);
    expect(v.userEdited).toBeUndefined();
    expect(plan.weeks[3].days[0].variations[0].reference?.method).toBe('deload');
  });

  it('a secondary movement is resolved lighter and with fewer sets than the main one', () => {
    const twoLiftConfig: TrainingBlockConfig = {
      ...config,
      oneRepMax: { squat: 140, deadlift: 180 },
      schedule: [
        {
          dayOfWeek: 3,
          variations: [
            { exercise: 'deadlift', variationId: 'deadlift_standard', role: 'main' },
            { exercise: 'squat', variationId: 'squat_standard', role: 'secondary' },
          ],
          accessories: [],
        },
      ],
    };
    const [main, secondary] = generateBlockPlan(twoLiftConfig, profile).weeks[0].days[0].variations;
    expect(secondary.sets.length).toBe(main.sets.length - 1);
    expect(secondary.pct1rm).toBeLessThan(main.pct1rm);
    expect(secondary.reference?.extraRir).toBeGreaterThan(0);
    expect(main.reference?.extraRir).toBe(0);
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

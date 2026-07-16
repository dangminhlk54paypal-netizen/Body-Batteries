import {
  basalMetabolicRate,
  passiveDailyBurn,
  stepsKcal,
  workoutKcal,
  totalWorkoutKcal,
  dailyExpenditure,
  passiveBurnPerHour,
  workoutStepEquivalent,
  totalStepEquivalent,
} from '../metabolismEngine';
import { MET_TABLE } from '../../../lib/metabolicConstants';
import { liftingSessionKcal } from '../liftingEngine';
import type { UserProfile } from '../../../types/energy';

// The user's own example profile: 78 kg, 168 cm.
const profile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

describe('basalMetabolicRate (Mifflin-St Jeor)', () => {
  it('computes male BMR', () => {
    // 10*78 + 6.25*168 - 5*30 + 5 = 780 + 1050 - 150 + 5 = 1685
    expect(basalMetabolicRate(profile)).toBe(1685);
  });

  it('female is 166 kcal lower than male (same body)', () => {
    expect(basalMetabolicRate({ ...profile, sex: 'female' })).toBe(1685 - 166);
  });
});

describe('passiveDailyBurn', () => {
  it('applies the sedentary occupation factor (≈ the ~2k2 maintenance estimate)', () => {
    // 1685 * 1.2 = 2022
    expect(passiveDailyBurn(profile)).toBe(2022);
    // a lighter-vs-active lifestyle burns more passively
    expect(passiveDailyBurn({ ...profile, occupation: 'light' })).toBe(2275);
    expect(passiveDailyBurn({ ...profile, occupation: 'active' })).toBe(2528);
  });

  it('adds kcal from average daily steps', () => {
    // 2022 (passive base) + stepsKcal(8000, 78) = 2022 + 312 = 2334
    expect(passiveDailyBurn({ ...profile, averageDailySteps: 8000 })).toBe(2022 + 312);
  });

  it('defaults to zero steps if not provided', () => {
    expect(passiveDailyBurn(profile)).toBe(2022);
    expect(passiveDailyBurn({ ...profile, averageDailySteps: undefined })).toBe(2022);
  });
});

describe('stepsKcal', () => {
  it('scales with steps and weight; 8000 steps ≈ 312 kcal at 78 kg', () => {
    expect(stepsKcal(8000, 78)).toBe(312);
  });
  it('is 0 for non-positive step counts', () => {
    expect(stepsKcal(0, 78)).toBe(0);
    expect(stepsKcal(-100, 78)).toBe(0);
  });
});

// BUG A fix: stepsKcal now accepts a StepActivityType so movement-pin syncing
// (movementCharge → kcal via growGoalFromActivity) can use a research-backed
// per-type rate instead of always the walking rate. Values from
// STEP_KCAL_PER_KG (Compendium of Physical Activities 2024 codes
// 17170/12050/17080): walking 0.0005, running 0.00096, hiking 0.0011 kcal/step/kg.
describe('stepsKcal by step type (research-backed rates)', () => {
  it('walking (default, backward compatible) — 5000 steps @ 70kg', () => {
    expect(stepsKcal(5000, 70)).toBe(175);
    expect(stepsKcal(5000, 70, 'walking')).toBe(175);
  });
  it('running burns more per step than walking', () => {
    expect(stepsKcal(5000, 70, 'running')).toBe(336);
  });
  it('hiking burns the most per step', () => {
    expect(stepsKcal(5000, 70, 'hiking')).toBe(385);
  });
});

// BUG A fix: workout minutes → movement-pin step equivalents (Marshall et al.
// 2009 / Tudor-Locke et al. 2019 CADENCE-adults cadence bands): 100 steps/min
// for moderate activities (MET < 6), 130 steps/min for vigorous (MET >= 6).
describe('workoutStepEquivalent / totalStepEquivalent (movement-pin cadence equivalence)', () => {
  it('moderate activity (MET < 6) uses the 100 steps/min cadence', () => {
    // yoga MET 2.5 -> moderate
    expect(workoutStepEquivalent({ type: 'yoga', minutes: 30 })).toBe(3000);
  });
  it('vigorous activity (MET >= 6) uses the 130 steps/min cadence', () => {
    // running MET 9.8 -> vigorous
    expect(workoutStepEquivalent({ type: 'running', minutes: 30 })).toBe(3900);
  });
  it('new powerlifting types (MET 5.0, moderate) use the 100 steps/min cadence', () => {
    expect(workoutStepEquivalent({ type: 'squat', minutes: 45 })).toBe(4500);
  });
  it('totalStepEquivalent sums multiple sessions', () => {
    const sessions = [
      { type: 'yoga' as const, minutes: 30 }, // 3000
      { type: 'running' as const, minutes: 30 }, // 3900
    ];
    expect(totalStepEquivalent(sessions)).toBe(6900);
  });
  it('is 0 for an empty session list', () => {
    expect(totalStepEquivalent([])).toBe(0);
  });
});

// New powerlifting activity types (Compendium of Physical Activities 2024 code
// 02052 — squat/deadlift; bench_press reasoned between codes 02054=3.5 and
// 02050=6.0, see Robergs 2007 / Reis 2017).
describe('new powerlifting MET entries', () => {
  it('squat / bench_press / deadlift are defined in MET_TABLE', () => {
    expect(MET_TABLE.squat).toBe(5.0);
    expect(MET_TABLE.bench_press).toBe(4.0);
    expect(MET_TABLE.deadlift).toBe(5.0);
  });
});

describe('workoutKcal (MET × kg × hours)', () => {
  it('1h football at 78 kg', () => {
    expect(workoutKcal({ type: 'football', minutes: 60 }, 78)).toBe(624);
  });
  it('30 min running at 78 kg', () => {
    // 9.8 * 78 * 0.5 = 382.2 -> 382
    expect(workoutKcal({ type: 'running', minutes: 30 }, 78)).toBe(382);
  });
  it('sums multiple sessions', () => {
    const sessions = [
      { type: 'football' as const, minutes: 60 },
      { type: 'gym_strength' as const, minutes: 45 },
    ];
    // 624 + round(5*78*0.75=292.5)=293 -> 917
    expect(totalWorkoutKcal(sessions, 78)).toBe(917);
  });
});

// S-PL: a session carrying `sets` switches to the tonnage hybrid model
// (liftingEngine) when the caller provides heightCm; without heightCm — or
// for pre-S-PL rows that have no `sets` — it stays on the MET path.
describe('workoutKcal set-based powerlifting path (S-PL)', () => {
  const sets = [
    { kind: 'warmup' as const, weightKg: 20, reps: 10 },
    { kind: 'working' as const, weightKg: 100, reps: 5 },
    { kind: 'working' as const, weightKg: 100, reps: 5 },
  ];
  // estimateLiftingMinutes(sets) = 1.5 + 3 + 3 = 7.5 → minutes stores 8
  const session = { type: 'squat' as const, minutes: 8, sets };

  it('uses the lifting model when heightCm is provided', () => {
    expect(workoutKcal(session, 78, 168)).toBe(
      liftingSessionKcal('squat', sets, 78, 168)
    );
    // and it responds to bar weight: heavier sets → more kcal
    const heavier = sets.map((s) => ({ ...s, weightKg: s.weightKg + 40 }));
    expect(workoutKcal({ ...session, sets: heavier }, 78, 168)).toBeGreaterThan(
      workoutKcal(session, 78, 168)
    );
  });

  it('falls back to MET × minutes without heightCm (pre-S-PL call sites)', () => {
    // 5.0 MET × 78 × (8/60) = 52
    expect(workoutKcal(session, 78)).toBe(52);
  });

  it('MET path is unchanged for sessions without sets (old rows)', () => {
    expect(workoutKcal({ type: 'squat', minutes: 30 }, 78, 168)).toBe(
      workoutKcal({ type: 'squat', minutes: 30 }, 78)
    );
  });
});

// Custom activities (not in MET_TABLE) carry their own rate via
// WorkoutSession.customMet — both workoutKcal and workoutStepEquivalent must
// prefer it over the MET_TABLE lookup (which only has a `custom: 0`
// placeholder entry).
describe('workoutKcal / workoutStepEquivalent for custom activities', () => {
  it('workoutKcal uses customMet when the type is custom', () => {
    // round(6.0 * 78 * 0.5) = 234
    expect(workoutKcal({ type: 'custom', minutes: 30, customMet: 6.0 }, 78)).toBe(234);
  });

  it('workoutStepEquivalent uses customMet against the vigorous threshold', () => {
    // 6.0 >= VIGOROUS_MET_THRESHOLD (6) -> 130 steps/min * 30 = 3900
    expect(workoutStepEquivalent({ type: 'custom', minutes: 30, customMet: 6.0 })).toBe(3900);
  });

  it('falls back to 0 kcal when customMet is missing for a custom type', () => {
    expect(workoutKcal({ type: 'custom', minutes: 30 }, 78)).toBe(0);
  });
});

describe('dailyExpenditure breakdown', () => {
  it('sums passive + steps + workouts', () => {
    const b = dailyExpenditure(profile, 8000, [{ type: 'football', minutes: 60 }]);
    expect(b.bmr).toBe(1685);
    expect(b.passive).toBe(2022);
    expect(b.steps).toBe(312);
    expect(b.workouts).toBe(624);
    expect(b.total).toBe(2022 + 312 + 624);
  });
  it('defaults to passive-only with no activity', () => {
    expect(dailyExpenditure(profile).total).toBe(2022);
  });
});

describe('passiveBurnPerHour', () => {
  it('spreads passive burn evenly over 24h', () => {
    expect(passiveBurnPerHour(profile)).toBeCloseTo(2022 / 24, 5);
  });
});

// The Mifflin-St Jeor formula is plain algebra over weight/height/age/sex — it
// is not specific to the project's own example profile. These cases cover
// different bodies (not just 78 kg/168 cm) to confirm it generalizes for
// anyone who fills in the body-profile form.
describe('basalMetabolicRate generalizes to other bodies', () => {
  it('young female, light frame', () => {
    // 10*55 + 6.25*160 - 5*25 - 161 = 550 + 1000 - 125 - 161 = 1264
    expect(
      basalMetabolicRate({ weightKg: 55, heightCm: 160, age: 25, sex: 'female', occupation: 'sedentary' })
    ).toBe(1264);
  });

  it('older male, active job', () => {
    // 10*90 + 6.25*180 - 5*60 + 5 = 900 + 1125 - 300 + 5 = 1730
    const p: UserProfile = { weightKg: 90, heightCm: 180, age: 60, sex: 'male', occupation: 'active' };
    expect(basalMetabolicRate(p)).toBe(1730);
    expect(passiveDailyBurn(p)).toBe(Math.round(1730 * 1.5));
  });

  it('teenager, average build', () => {
    // 10*45 + 6.25*150 - 5*15 - 161 = 450 + 937.5 - 75 - 161 = 1151.5 -> 1152
    expect(
      basalMetabolicRate({ weightKg: 45, heightCm: 150, age: 15, sex: 'female', occupation: 'light' })
    ).toBe(1152);
  });
});

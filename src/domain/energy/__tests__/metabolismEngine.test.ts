import {
  basalMetabolicRate,
  passiveDailyBurn,
  stepsKcal,
  workoutKcal,
  totalWorkoutKcal,
  dailyExpenditure,
  passiveBurnPerHour,
} from '../metabolismEngine';
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

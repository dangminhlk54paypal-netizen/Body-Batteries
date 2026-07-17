import { dailyRecommendations } from '../dailyRecommendations';
import type { UserProfile } from '../../../types/energy';

// Hand-calculated expectations (see the tool output that derived them):
// male profile — BMR 1685, maintenance/target 2022 kcal.
const maleProfile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

// female profile — BMR 1349, maintenance/target 1821 kcal.
const femaleProfile: UserProfile = {
  weightKg: 65,
  heightCm: 160,
  age: 28,
  sex: 'female',
  occupation: 'light',
};

describe('dailyRecommendations — male profile', () => {
  const result = dailyRecommendations(maleProfile);

  it('reuses dailyCalorieTarget for calorie/maintenance figures', () => {
    expect(result.calorieTargetKcal).toBe(2022);
    expect(result.maintenanceKcal).toBe(2022);
  });

  it('computes protein range as 0.8-1.6 g/kg body weight', () => {
    expect(result.proteinG).toEqual({ min: 62, max: 125 });
  });

  it('computes carbs range as 45-65% of target kcal / 4', () => {
    expect(result.carbsG).toEqual({ min: 227, max: 329 });
  });

  it('computes free-sugar limits at 10% and 5% of target kcal / 4', () => {
    expect(result.freeSugarLimitG).toBe(51);
    expect(result.freeSugarStricterG).toBe(25);
  });

  it('fixes the salt limit at 5g/day regardless of profile', () => {
    expect(result.saltLimitG).toBe(5);
  });

  it('delegates water to the shared 30-40ml/kg rules engine', () => {
    expect(result.waterMl).toEqual({ min: 2350, max: 3100 });
  });

  it('fixes the weekly activity range and derives a rounded daily range', () => {
    expect(result.activityMinutesPerWeek).toEqual({ min: 150, max: 300 });
    expect(result.activityMinutesPerDay).toEqual({ min: 21, max: 43 });
  });

  it('uses the 7-9h sleep bracket under age 65', () => {
    expect(result.sleepHours).toEqual({ min: 7, max: 9 });
  });

  it('computes the healthy-weight range from BMI 18.5-24.9', () => {
    expect(result.healthyWeightKg).toEqual({ min: 52.2, max: 70.3 });
  });

  it('flags current weight as above the healthy range for this profile', () => {
    expect(result.healthyWeightStatus).toBe('above');
  });
});

describe('dailyRecommendations — female profile', () => {
  const result = dailyRecommendations(femaleProfile);

  it('reuses dailyCalorieTarget for calorie/maintenance figures', () => {
    expect(result.calorieTargetKcal).toBe(1821);
    expect(result.maintenanceKcal).toBe(1821);
  });

  it('computes protein range as 0.8-1.6 g/kg body weight', () => {
    expect(result.proteinG).toEqual({ min: 52, max: 104 });
  });

  it('computes carbs range as 45-65% of target kcal / 4', () => {
    expect(result.carbsG).toEqual({ min: 205, max: 296 });
  });

  it('computes free-sugar limits at 10% and 5% of target kcal / 4', () => {
    expect(result.freeSugarLimitG).toBe(46);
    expect(result.freeSugarStricterG).toBe(23);
  });

  it('delegates water to the shared 30-40ml/kg rules engine', () => {
    expect(result.waterMl).toEqual({ min: 1950, max: 2600 });
  });

  it('computes the healthy-weight range from BMI 18.5-24.9', () => {
    expect(result.healthyWeightKg).toEqual({ min: 47.4, max: 63.7 });
  });
});

describe('dailyRecommendations — sleep bracket by age', () => {
  it('narrows to 7-8h for age 65+', () => {
    const result = dailyRecommendations({ ...maleProfile, age: 65 });
    expect(result.sleepHours).toEqual({ min: 7, max: 8 });
  });

  it('stays at 7-9h just under the threshold (age 64)', () => {
    const result = dailyRecommendations({ ...maleProfile, age: 64 });
    expect(result.sleepHours).toEqual({ min: 7, max: 9 });
  });
});

describe('dailyRecommendations — healthy weight status', () => {
  // Fixed height 170cm → BMI-healthy range ≈ [53.5, 72.0] kg.
  const heightProfile: UserProfile = {
    weightKg: 70,
    heightCm: 170,
    age: 40,
    sex: 'male',
    occupation: 'sedentary',
  };

  it('flags below when current weight sits under the healthy range', () => {
    const result = dailyRecommendations({ ...heightProfile, weightKg: 50 });
    expect(result.healthyWeightStatus).toBe('below');
  });

  it('flags within when current weight sits inside the healthy range', () => {
    const result = dailyRecommendations({ ...heightProfile, weightKg: 60 });
    expect(result.healthyWeightStatus).toBe('within');
  });

  it('flags above when current weight sits over the healthy range', () => {
    const result = dailyRecommendations({ ...heightProfile, weightKg: 90 });
    expect(result.healthyWeightStatus).toBe('above');
  });
});

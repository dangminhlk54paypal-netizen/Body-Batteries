import { waterRecommendationMl, sleepRecommendationH } from '../dailyRecommendations';
import type { UserProfile } from '../../../types/energy';

const profile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

describe('waterRecommendationMl', () => {
  it('computes a 30-40 ml/kg range, rounded to the nearest 50 ml', () => {
    // 78 * 30 = 2340 -> 2350; 78 * 40 = 3120 -> 3100
    const r = waterRecommendationMl(profile, false);
    expect(r.minMl).toBe(2350);
    expect(r.maxMl).toBe(3100);
  });

  it('adds no workout extra on a rest day', () => {
    const r = waterRecommendationMl(profile, false);
    expect(r.workoutExtraMinMl).toBe(0);
    expect(r.workoutExtraMaxMl).toBe(0);
  });

  it('adds the ACSM 500-1000 ml extra range on a workout day', () => {
    const r = waterRecommendationMl(profile, true);
    expect(r.workoutExtraMinMl).toBe(500);
    expect(r.workoutExtraMaxMl).toBe(1000);
  });

  it('scales with a different body weight', () => {
    // 55 * 30 = 1650 -> 1650; 55 * 40 = 2200 -> 2200
    const r = waterRecommendationMl({ ...profile, weightKg: 55 }, false);
    expect(r.minMl).toBe(1650);
    expect(r.maxMl).toBe(2200);
  });
});

describe('sleepRecommendationH', () => {
  it('6-13y bracket: 9-11h', () => {
    expect(sleepRecommendationH(10, false)).toEqual({ minH: 9, maxH: 11, trainingRecovery: false });
  });

  it('clamps ages under 6 to the 6-13y bracket', () => {
    expect(sleepRecommendationH(3, false)).toEqual({ minH: 9, maxH: 11, trainingRecovery: false });
  });

  it('14-17y bracket: 8-10h', () => {
    expect(sleepRecommendationH(15, false)).toEqual({ minH: 8, maxH: 10, trainingRecovery: false });
  });

  it('18-64y bracket: 7-9h', () => {
    expect(sleepRecommendationH(30, false)).toEqual({ minH: 7, maxH: 9, trainingRecovery: false });
    expect(sleepRecommendationH(64, false)).toEqual({ minH: 7, maxH: 9, trainingRecovery: false });
  });

  it('65y+ bracket: 7-8h', () => {
    expect(sleepRecommendationH(65, false)).toEqual({ minH: 7, maxH: 8, trainingRecovery: false });
    expect(sleepRecommendationH(90, false)).toEqual({ minH: 7, maxH: 8, trainingRecovery: false });
  });

  it('sets trainingRecovery true on a workout day without changing the range', () => {
    expect(sleepRecommendationH(30, true)).toEqual({ minH: 7, maxH: 9, trainingRecovery: true });
  });
});

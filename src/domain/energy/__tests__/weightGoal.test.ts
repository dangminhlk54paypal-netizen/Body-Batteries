import { dailyCalorieTarget } from '../weightGoal';
import { passiveDailyBurn, basalMetabolicRate } from '../metabolismEngine';
import type { UserProfile } from '../../../types/energy';

const profile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

describe('dailyCalorieTarget', () => {
  it('returns maintenance when no goal is set', () => {
    const result = dailyCalorieTarget(profile);
    const maintenance = passiveDailyBurn(profile);
    expect(result.targetKcal).toBe(maintenance);
    expect(result.maintenanceKcal).toBe(maintenance);
    expect(result.appliedDeltaKcal).toBe(0);
    expect(result.wasClamped).toBe(false);
  });

  it('returns maintenance when goal weight equals current weight', () => {
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg, goalWeeks: 8 });
    expect(result.targetKcal).toBe(passiveDailyBurn(profile));
    expect(result.wasClamped).toBe(false);
  });

  it('applies an unclamped deficit for a moderate, slow goal', () => {
    // Lose 2kg over 10 weeks: 2 * 7700 / 70 = 220 kcal/day deficit — well under
    // the 20%/750 safety cap for this profile (maintenance ~2022 kcal).
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg - 2, goalWeeks: 10 });
    const maintenance = passiveDailyBurn(profile);
    expect(result.wasClamped).toBe(false);
    expect(result.appliedDeltaKcal).toBe(220);
    expect(result.targetKcal).toBe(maintenance - 220);
  });

  it('clamps an aggressive deficit goal down to the safe cap', () => {
    // Lose 5kg over 2 weeks would require 2750 kcal/day deficit — must be
    // clamped to the smaller of 20% maintenance and 750 kcal/day.
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg - 5, goalWeeks: 2 });
    expect(result.wasClamped).toBe(true);
    const maxSafeDelta = Math.min(passiveDailyBurn(profile) * 0.2, 750);
    expect(Math.abs(result.appliedDeltaKcal)).toBeLessThanOrEqual(Math.round(maxSafeDelta) + 1);
  });

  it('never targets below BMR, even for an extreme goal', () => {
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg - 30, goalWeeks: 4 });
    const bmr = basalMetabolicRate(profile);
    expect(result.targetKcal).toBeGreaterThanOrEqual(bmr);
    expect(result.wasClamped).toBe(true);
  });

  it('picks the fastest safe pace automatically when goalWeeks is omitted', () => {
    const withWeeks = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg - 8, goalWeeks: 1 });
    const withoutWeeks = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg - 8 });
    // Both request more than the safety cap allows, so they should land on the
    // same clamped (and BMR-floored) target.
    expect(withoutWeeks.targetKcal).toBe(withWeeks.targetKcal);
    expect(withoutWeeks.wasClamped).toBe(true);
  });

  it('applies a surplus (not a deficit) for a weight-GAIN goal', () => {
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg + 5, goalWeeks: 20 });
    const maintenance = passiveDailyBurn(profile);
    expect(result.targetKcal).toBeGreaterThan(maintenance);
    expect(result.appliedDeltaKcal).toBeLessThan(0);
  });

  it('clamps an aggressive surplus goal down to the safe cap too', () => {
    const result = dailyCalorieTarget({ ...profile, goalWeightKg: profile.weightKg + 7, goalWeeks: 10 });
    expect(result.wasClamped).toBe(true);
    const maxSafeDelta = Math.min(passiveDailyBurn(profile) * 0.2, 750);
    expect(Math.abs(result.appliedDeltaKcal)).toBeLessThanOrEqual(Math.round(maxSafeDelta) + 1);
  });
});

import type { UserProfile } from '../../types/energy';
import { basalMetabolicRate, passiveDailyBurn } from './metabolismEngine';
import { MAX_DEFICIT_PCT, MAX_DEFICIT_KCAL, KCAL_PER_KG_BODY_FAT } from '../../lib/weightGoalConstants';

// Pure logic for turning a weight goal into a safe daily calorie target — see
// .ai/parallel-reports/S-O-satiety-battery-spec.md section 1C. This is a
// self-tracking estimate, NOT medical advice (.ai/CONTEXT.md section 5): the
// result is ALWAYS clamped to a safe range, never below BMR.

export interface CalorieTargetResult {
  targetKcal: number; // the final, safe daily calorie target
  maintenanceKcal: number; // passiveDailyBurn(profile) — target when no goal is set
  appliedDeltaKcal: number; // signed deficit(+)/surplus(-) actually applied per day
  wasClamped: boolean; // true if the requested pace had to be slowed down for safety
}

// No goal set → the target is just maintenance (eat to stay the same weight).
function maintenanceOnlyResult(maintenanceKcal: number): CalorieTargetResult {
  return { targetKcal: maintenanceKcal, maintenanceKcal, appliedDeltaKcal: 0, wasClamped: false };
}

// Computes today's safe daily calorie target from a weight goal.
// - `profile.goalWeightKg` below `profile.weightKg` → deficit (weight loss).
// - `profile.goalWeightKg` above `profile.weightKg` → surplus (weight gain).
// - `profile.goalWeeks` is optional: if omitted, the app uses the fastest
//   SAFE pace (the maximum allowed deficit/surplus per day) automatically.
// Hard safety clamps (always applied, cannot be overridden by the caller):
//   - |appliedDeltaKcal| <= min(MAX_DEFICIT_PCT * maintenance, MAX_DEFICIT_KCAL)
//   - targetKcal is never below BMR (basal metabolic rate)
export function dailyCalorieTarget(profile: UserProfile): CalorieTargetResult {
  const maintenanceKcal = passiveDailyBurn(profile);
  const { goalWeightKg, goalWeeks } = profile;

  if (goalWeightKg === undefined || !Number.isFinite(goalWeightKg)) {
    return maintenanceOnlyResult(maintenanceKcal);
  }

  const weightDeltaKg = profile.weightKg - goalWeightKg; // >0 = lose, <0 = gain
  const maxSafeDeltaPerDay = Math.min(maintenanceKcal * MAX_DEFICIT_PCT, MAX_DEFICIT_KCAL);

  if (weightDeltaKg === 0) {
    return maintenanceOnlyResult(maintenanceKcal);
  }

  const direction = Math.sign(weightDeltaKg);
  let requestedMagnitude: number;

  if (Number.isFinite(goalWeeks) && (goalWeeks as number) > 0) {
    const totalKcalNeeded = Math.abs(weightDeltaKg) * KCAL_PER_KG_BODY_FAT;
    const days = (goalWeeks as number) * 7;
    requestedMagnitude = totalKcalNeeded / days;
  } else {
    // No timeframe given: default to the fastest SAFE pace.
    requestedMagnitude = maxSafeDeltaPerDay;
  }

  const clampedMagnitude = Math.min(requestedMagnitude, maxSafeDeltaPerDay);
  const appliedDeltaKcal = direction * clampedMagnitude;

  const bmr = basalMetabolicRate(profile);
  const unflooredTarget = maintenanceKcal - appliedDeltaKcal;
  const targetKcal = Math.max(unflooredTarget, bmr);

  const wasClamped = clampedMagnitude < requestedMagnitude || targetKcal !== unflooredTarget;

  return {
    targetKcal: Math.round(targetKcal),
    maintenanceKcal,
    appliedDeltaKcal: Math.round(maintenanceKcal - targetKcal),
    wasClamped,
  };
}

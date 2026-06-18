import type {
  UserProfile,
  WorkoutSession,
  ExpenditureBreakdown,
} from '../../types/energy';
import {
  MET_TABLE,
  OCCUPATION_FACTORS,
  KCAL_PER_STEP_PER_KG,
} from '../../lib/metabolicConstants';

// Pure functions modelling the body's energy expenditure (its "self-discharge").
// All outputs are kcal unless noted. v1 / general — see docs/06-energy-expenditure.md.

// Basal Metabolic Rate via the Mifflin-St Jeor equation (kcal/day).
// Men:   10·kg + 6.25·cm − 5·age + 5
// Women: 10·kg + 6.25·cm − 5·age − 161
export function basalMetabolicRate(p: UserProfile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'male' ? 5 : -161));
}

// Passive daily burn = BMR × occupation factor. This is the continuous
// background expenditure (spread over 24h). It excludes logged steps/workouts
// to avoid double-counting them.
export function passiveDailyBurn(p: UserProfile): number {
  return Math.round(basalMetabolicRate(p) * OCCUPATION_FACTORS[p.occupation]);
}

// Kcal from a step count, scaled by body weight. Negative/zero → 0.
export function stepsKcal(steps: number, weightKg: number): number {
  if (steps <= 0) return 0;
  return Math.round(steps * KCAL_PER_STEP_PER_KG * weightKg);
}

// Kcal for one workout session: MET × weight(kg) × duration(hours).
export function workoutKcal(session: WorkoutSession, weightKg: number): number {
  const met = MET_TABLE[session.type] ?? 0;
  return Math.round(met * weightKg * (session.minutes / 60));
}

export function totalWorkoutKcal(
  sessions: WorkoutSession[],
  weightKg: number
): number {
  return sessions.reduce((sum, s) => sum + workoutKcal(s, weightKg), 0);
}

// Full breakdown of a day's expenditure given the profile + logged activity.
export function dailyExpenditure(
  profile: UserProfile,
  steps = 0,
  workouts: WorkoutSession[] = []
): ExpenditureBreakdown {
  const bmr = basalMetabolicRate(profile);
  const passive = passiveDailyBurn(profile);
  const stepsBurn = stepsKcal(steps, profile.weightKg);
  const workoutsBurn = totalWorkoutKcal(workouts, profile.weightKg);
  return {
    bmr,
    passive,
    steps: stepsBurn,
    workouts: workoutsBurn,
    total: passive + stepsBurn + workoutsBurn,
  };
}

// Continuous "self-discharge" rate (kcal/hour) from passive metabolism, spread
// evenly over 24h. Steps & workouts are applied as discrete events when logged,
// not through this rate. (v1: even spread. A later version can weight by
// circadian rhythm — higher while awake, lower during sleep.)
export function passiveBurnPerHour(profile: UserProfile): number {
  return passiveDailyBurn(profile) / 24;
}

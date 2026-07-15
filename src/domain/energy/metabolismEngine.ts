import type {
  UserProfile,
  WorkoutSession,
  ExpenditureBreakdown,
  StepActivityType,
} from '../../types/energy';
import {
  MET_TABLE,
  OCCUPATION_FACTORS,
  STEP_KCAL_PER_KG,
  STEP_EQUIV_MODERATE_PER_MIN,
  STEP_EQUIV_VIGOROUS_PER_MIN,
  VIGOROUS_MET_THRESHOLD,
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

// Passive daily burn = BMR × occupation factor + kcal from average daily steps.
// This is the continuous background expenditure (spread over 24h) plus the
// steady-state step contribution. It excludes logged steps/workouts beyond
// the average to avoid double-counting them.
export function passiveDailyBurn(p: UserProfile): number {
  const baseBurn = Math.round(basalMetabolicRate(p) * OCCUPATION_FACTORS[p.occupation]);
  const avgStepsBurn = stepsKcal(p.averageDailySteps ?? 0, p.weightKg);
  return baseBurn + avgStepsBurn;
}

// Kcal from a step count, scaled by body weight and step type. Negative/zero
// → 0. `stepType` defaults to 'walking' — keeps every existing call site's
// behavior identical (research validated the legacy 0.0005 rate — see
// STEP_KCAL_PER_KG doc).
export function stepsKcal(
  steps: number,
  weightKg: number,
  stepType: StepActivityType = 'walking'
): number {
  if (steps <= 0) return 0;
  return Math.round(steps * STEP_KCAL_PER_KG[stepType] * weightKg);
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

// Translates one workout's minutes into movement-pin step equivalents —
// research-backed cadence equivalence (Marshall et al. 2009; Tudor-Locke et
// al. 2019 CADENCE-adults): 100 steps/min for moderate activities
// (MET < VIGOROUS_MET_THRESHOLD), 130 steps/min for vigorous ones. Lets a
// workout-only log (type + minutes, no steps) still charge the movement pin
// (BUG A fix), which has no other unit for exercise minutes.
export function workoutStepEquivalent(session: WorkoutSession): number {
  const met = MET_TABLE[session.type] ?? 0;
  const cadence =
    met >= VIGOROUS_MET_THRESHOLD ? STEP_EQUIV_VIGOROUS_PER_MIN : STEP_EQUIV_MODERATE_PER_MIN;
  return Math.round(session.minutes * cadence);
}

export function totalStepEquivalent(sessions: WorkoutSession[]): number {
  return sessions.reduce((sum, s) => sum + workoutStepEquivalent(s), 0);
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

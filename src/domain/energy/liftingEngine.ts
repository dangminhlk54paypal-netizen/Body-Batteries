import type { LiftingExercise, LiftingSet } from '../../types/energy';
import {
  BARBELL_WEIGHT_KG,
  GRAVITY_MS2,
  JOULES_PER_KCAL,
  LIFTING_ECCENTRIC_FACTOR,
  LIFTING_EFFICIENCY,
  LIFTING_PARAMS,
  LIFTING_REST_MET,
  LIFTING_SET_CYCLE_MIN,
} from '../../lib/metabolicConstants';

// Pure functions for the set-based powerlifting energy model (S-PL).
// docs/06-energy-expenditure.md section 1B has the derivation + sources.
//
// The model is a HYBRID of two terms:
//   1. lifting work — actual physics: (bar + a share of body mass) × g × bar
//      path (a fraction of body height) × reps, divided by ~20% muscle
//      efficiency, plus ~1/3 extra for lowering the bar. This is the part
//      that responds to what was actually lifted (the user's request: kcal
//      from sets × reps × weight + body weight/height, not minutes).
//   2. rest overhead — standing/pacing between sets at ~2 MET over the
//      session's estimated duration. Whole-session VO2 studies (João 2021)
//      show this recovery term dominates; work alone under-counts 3–5×.
// All numbers are population-average v1 estimates, NOT medical measurements.

// Metabolic kcal of ONE set. weightKg/heightCm are the lifter's body
// measurements (the set's own bar weight lives in `set.weightKg`). A zero
// bar weight is a valid bodyweight-only set; non-positive reps mean "not a
// set" and cost nothing.
export function liftingSetKcal(
  exercise: LiftingExercise,
  set: LiftingSet,
  weightKg: number,
  heightCm: number
): number {
  if (set.reps <= 0 || set.weightKg < 0) return 0;
  const { bodyMassFactor, romOfHeight } = LIFTING_PARAMS[exercise];
  const effectiveMassKg = set.weightKg + bodyMassFactor * weightKg;
  const romMeters = romOfHeight * (heightCm / 100);
  const concentricJoules = effectiveMassKg * GRAVITY_MS2 * romMeters * set.reps;
  const totalJoules = concentricJoules * (1 + LIFTING_ECCENTRIC_FACTOR);
  return totalJoules / LIFTING_EFFICIENCY / JOULES_PER_KCAL;
}

// Estimated wall-clock minutes a list of sets occupies (each set + its rest)
// — this is what gets stored as the WorkoutSession's `minutes`, so the
// movement pin's step-equivalent charge and history display keep working
// without asking the user for a duration.
export function estimateLiftingMinutes(sets: LiftingSet[]): number {
  return Math.round(sets.reduce((min, s) => min + LIFTING_SET_CYCLE_MIN[s.kind], 0));
}

// Full kcal for one exercise's sets: lifting work + rest overhead.
export function liftingSessionKcal(
  exercise: LiftingExercise,
  sets: LiftingSet[],
  weightKg: number,
  heightCm: number
): number {
  const workKcal = sets.reduce(
    (sum, s) => sum + liftingSetKcal(exercise, s, weightKg, heightCm),
    0
  );
  const restKcal = LIFTING_REST_MET * weightKg * (estimateLiftingMinutes(sets) / 60);
  return Math.round(workKcal + restKcal);
}

// Total bar-weight volume (kg lifted) — the strength-progress number block
// analysis will chart per week.
export function liftingTonnageKg(sets: LiftingSet[]): number {
  return sets.reduce((total, s) => total + s.weightKg * s.reps, 0);
}

// Estimated 1-rep max via the Epley formula: w × (1 + reps/30). Standard
// strength-tracking estimate — good in the 1–10 rep range that powerlifting
// programming lives in.
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// Best e1RM across the WORKING sets only — warm-up rungs are submaximal by
// design and would only add noise to a strength trend.
export function bestOneRepMax(sets: LiftingSet[]): number {
  return sets
    .filter((s) => s.kind === 'working')
    .reduce((best, s) => Math.max(best, estimatedOneRepMax(s.weightKg, s.reps)), 0);
}

// Suggested warm-up ramp toward a working weight: empty bar × 10, then
// 50% × 6, 70% × 4, 85% × 2 — a standard powerlifting ramp ("mức tạ lên dần"
// until the main sets). Rungs are rounded to 2.5 kg plates; rungs that
// round to at/below the bar or at/above the working weight are dropped, so
// light working weights get a shorter ramp instead of duplicate sets.
export function warmupRamp(workingWeightKg: number): LiftingSet[] {
  const ramp: LiftingSet[] = [{ kind: 'warmup', weightKg: BARBELL_WEIGHT_KG, reps: 10 }];
  if (workingWeightKg <= BARBELL_WEIGHT_KG) return ramp;
  const rungs = [
    { pct: 0.5, reps: 6 },
    { pct: 0.7, reps: 4 },
    { pct: 0.85, reps: 2 },
  ];
  for (const rung of rungs) {
    const weight = roundToPlate(workingWeightKg * rung.pct);
    if (weight > BARBELL_WEIGHT_KG && weight < workingWeightKg) {
      ramp.push({ kind: 'warmup', weightKg: weight, reps: rung.reps });
    }
  }
  return ramp;
}

function roundToPlate(weightKg: number): number {
  return Math.round(weightKg / 2.5) * 2.5;
}

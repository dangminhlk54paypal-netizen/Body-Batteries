import type { UserProfile } from '../../types/energy';

// Pure daily water & sleep recommendation rules. v1 / general population
// heuristics — a self-tracking aid, NOT medical advice (see .ai/CONTEXT.md
// section 5). Neither function reads or writes any battery — the UI decides
// how (or whether) to compare these against the actual water/sleep pins.

// --- Water --------------------------------------------------------------

// Widely used adult total-fluid heuristic: 30-40 ml per kg of body weight per
// day. Sanity-anchored against EFSA (2010) "Scientific Opinion on Dietary
// Reference Values for water" total-water adequate intake: ~2.0 L/day for
// women, ~2.5 L/day for men (a ~65-83 kg adult at 30-40 ml/kg lands in that
// same 2.0-2.5 L band).
export const WATER_ML_PER_KG_MIN = 30;
export const WATER_ML_PER_KG_MAX = 40;

// ACSM fluid-replacement guidance for exercise: roughly 0.4-0.8 L extra per
// hour of activity. Modelled here as a flat per-day add-on (v1 has no
// exercise-duration input at the recommendation layer) rather than scaled by
// logged workout minutes.
export const WORKOUT_EXTRA_WATER_MIN_ML = 500;
export const WORKOUT_EXTRA_WATER_MAX_ML = 1000;

const WATER_ROUND_STEP_ML = 50;

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface WaterRecommendation {
  minMl: number;
  maxMl: number;
  workoutExtraMinMl: number;
  workoutExtraMaxMl: number;
}

// Daily water recommendation (ml) from body weight, plus an optional
// exercise-day extra range. Base range is rounded to the nearest 50 ml for a
// display-friendly number; the workout extra is a fixed ACSM-derived band, so
// it is not rounded further.
export function waterRecommendationMl(
  profile: UserProfile,
  hasWorkoutToday: boolean
): WaterRecommendation {
  const minMl = roundToStep(profile.weightKg * WATER_ML_PER_KG_MIN, WATER_ROUND_STEP_ML);
  const maxMl = roundToStep(profile.weightKg * WATER_ML_PER_KG_MAX, WATER_ROUND_STEP_ML);
  return {
    minMl,
    maxMl,
    workoutExtraMinMl: hasWorkoutToday ? WORKOUT_EXTRA_WATER_MIN_ML : 0,
    workoutExtraMaxMl: hasWorkoutToday ? WORKOUT_EXTRA_WATER_MAX_ML : 0,
  };
}

// --- Sleep ----------------------------------------------------------------

// National Sleep Foundation (2015, Hirshkowitz et al., "National Sleep
// Foundation's sleep time duration recommendations: methodology and results
// summary") age-bracket ranges, in hours per night.
interface SleepBracket {
  maxAge: number; // inclusive upper bound of this bracket
  minH: number;
  maxH: number;
}

// Ordered youngest → oldest; the first bracket whose maxAge the (clamped) age
// falls under wins. There is no dedicated bracket below 6y — ages under 6 are
// clamped up to 6 so they read the 6-13y bracket (see sleepRecommendationH).
const SLEEP_BRACKETS: SleepBracket[] = [
  { maxAge: 13, minH: 9, maxH: 11 }, // 6-13y
  { maxAge: 17, minH: 8, maxH: 10 }, // 14-17y
  { maxAge: 64, minH: 7, maxH: 9 }, // 18-64y
  { maxAge: Infinity, minH: 7, maxH: 8 }, // 65y+
];

const SLEEP_MIN_BRACKET_AGE = 6;

export interface SleepRecommendation {
  minH: number;
  maxH: number;
  // True when the caller worked out today — the UI uses this to nudge
  // wording toward "aim near the top of the range to recover" rather than
  // changing the numeric range itself (no research-backed extra-hours figure
  // exists for a single training day).
  trainingRecovery: boolean;
}

// Daily sleep recommendation (hours) from age, per the National Sleep
// Foundation 2015 brackets. Ages under 6 are clamped to the 6-13y bracket (no
// dedicated younger bracket in this app's scope).
export function sleepRecommendationH(age: number, hasWorkoutToday: boolean): SleepRecommendation {
  const clampedAge = Math.max(age, SLEEP_MIN_BRACKET_AGE);
  const bracket = SLEEP_BRACKETS.find((b) => clampedAge <= b.maxAge) ?? SLEEP_BRACKETS[SLEEP_BRACKETS.length - 1];
  return {
    minH: bracket.minH,
    maxH: bracket.maxH,
    trainingRecovery: hasWorkoutToday,
  };
}

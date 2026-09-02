import type { LiftingExercise } from '../types/energy';

// Built-in S-PL Block technique-variation library. Display names/rationale
// are NEVER stored here: each `id` is looked up via
// `t('blockVariations.' + id + '.label')` / `.rationale` at render time —
// same convention as BODYBUILDING_EXERCISES (src/lib/bodybuildingExercises.ts).
//
// `loadFactor` is a coaching heuristic (NOT an RCT-measured constant): how
// much lighter this variation typically loads compared to the SAME lift's
// straight 1RM, because it removes some of the stretch-shortening-cycle
// assist (paused work) or changes leverage (grip/incline/deficit). Treat it
// as a directionally-correct v1 estimate — docs/08-powerlifting-engine.md §7
// flags the whole engine as population-average, not personalized.
export interface PowerliftingVariation {
  id: string;
  exercise: LiftingExercise;
  loadFactor: number; // 1.0 = same as a straight 1RM of that lift
}

export const POWERLIFTING_VARIATIONS: PowerliftingVariation[] = [
  // Squat
  { id: 'squat_standard', exercise: 'squat', loadFactor: 1.0 },
  // Dead-stop pause at the bottom removes the stretch-shortening-cycle
  // assist out of the hole — same rationale as deadlift_paused below.
  { id: 'squat_paused', exercise: 'squat', loadFactor: 0.9 },

  // Bench press — touch-and-go (touch chest, no pause) IS the standard
  // competition-legal technique, so it doubles as this lift's "straight 1RM"
  // entry; there is no separate bench_standard.
  { id: 'bench_touch_and_go', exercise: 'bench_press', loadFactor: 1.0 },
  // 1s dead-stop pause on the chest before pressing — removes the SSC assist,
  // trains starting strength from a true dead position (competition-judging
  // standard for a valid bench press).
  { id: 'bench_paused', exercise: 'bench_press', loadFactor: 0.9 },
  // Narrower grip shifts more work to the triceps, away from pec/lat
  // leverage — lowers achievable load at the same effort.
  { id: 'bench_low_grip', exercise: 'bench_press', loadFactor: 0.85 },
  // Incline angle reduces pec involvement vs flat bench.
  { id: 'bench_incline', exercise: 'bench_press', loadFactor: 0.8 },

  // Deadlift
  { id: 'deadlift_standard', exercise: 'deadlift', loadFactor: 1.0 },
  // Pause below/above the knee removes the stretch reflex off the floor.
  { id: 'deadlift_paused', exercise: 'deadlift', loadFactor: 0.9 },
  // Standing on a deficit increases range of motion off the floor.
  { id: 'deadlift_deficit', exercise: 'deadlift', loadFactor: 0.85 },
];

export function variationsForExercise(exercise: LiftingExercise): PowerliftingVariation[] {
  return POWERLIFTING_VARIATIONS.filter((v) => v.exercise === exercise);
}

export function findVariation(variationId: string): PowerliftingVariation | undefined {
  return POWERLIFTING_VARIATIONS.find((v) => v.id === variationId);
}

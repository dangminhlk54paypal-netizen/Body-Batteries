import type { BodybuildingExercise, MuscleGroup } from '../types/energy';

// Built-in S-BB exercise library (~45 exercises / 8 muscle groups) — see
// docs/06-energy-expenditure.md §1C. Display names are NEVER stored here:
// each `id` is looked up via `t('bbExercises.' + id)` at render time (see
// bbExerciseName in BodybuildingSheet.tsx), same convention as
// LIFTING_EXERCISES/activities.*. Deliberately excludes squat/bench_press/
// deadlift — those stay on the physics-based Powerlifting sheet (S-PL); this
// library is the MET-tier model for everything else (docs/06 §1C explains
// why the two use different math).
//
// `tier` picks the Compendium 2024 anchor (see BB_MET_TIER in
// metabolicConstants.ts): `isolation` for single-joint/small-muscle moves,
// `compound` for standard multi-joint lifts, `big_compound` for the largest
// multi-joint/large-muscle-mass moves (legs/back/glutes compounds that come
// closest to the Compendium's "vigorous" bodybuilding code).
export const BODYBUILDING_EXERCISES: BodybuildingExercise[] = [
  // Chest (5)
  { id: 'dumbbell_bench_press', muscle: 'chest', tier: 'compound' },
  { id: 'incline_dumbbell_press', muscle: 'chest', tier: 'compound' },
  { id: 'chest_press_machine', muscle: 'chest', tier: 'compound' },
  { id: 'dumbbell_fly', muscle: 'chest', tier: 'isolation' },
  { id: 'cable_crossover', muscle: 'chest', tier: 'isolation' },

  // Back (7)
  { id: 'lat_pulldown', muscle: 'back', tier: 'compound' },
  { id: 'seated_cable_row', muscle: 'back', tier: 'compound' },
  { id: 'barbell_row', muscle: 'back', tier: 'compound' },
  { id: 'pull_up', muscle: 'back', tier: 'big_compound' },
  { id: 'one_arm_dumbbell_row', muscle: 'back', tier: 'compound' },
  { id: 'straight_arm_pulldown', muscle: 'back', tier: 'isolation' },
  { id: 'face_pull', muscle: 'back', tier: 'isolation' },

  // Legs (7)
  { id: 'leg_press', muscle: 'legs', tier: 'big_compound' },
  { id: 'walking_lunge', muscle: 'legs', tier: 'compound' },
  { id: 'leg_extension', muscle: 'legs', tier: 'isolation' },
  { id: 'leg_curl', muscle: 'legs', tier: 'isolation' },
  { id: 'bulgarian_split_squat', muscle: 'legs', tier: 'compound' },
  { id: 'calf_raise', muscle: 'legs', tier: 'isolation' },
  { id: 'goblet_squat', muscle: 'legs', tier: 'compound' },

  // Shoulders (6)
  { id: 'overhead_press', muscle: 'shoulders', tier: 'compound' },
  { id: 'lateral_raise', muscle: 'shoulders', tier: 'isolation' },
  { id: 'cable_lateral_raise', muscle: 'shoulders', tier: 'isolation' },
  { id: 'front_raise', muscle: 'shoulders', tier: 'isolation' },
  { id: 'rear_delt_fly', muscle: 'shoulders', tier: 'isolation' },
  { id: 'arnold_press', muscle: 'shoulders', tier: 'compound' },

  // Biceps (4)
  { id: 'barbell_curl', muscle: 'biceps', tier: 'isolation' },
  { id: 'dumbbell_curl', muscle: 'biceps', tier: 'isolation' },
  { id: 'hammer_curl', muscle: 'biceps', tier: 'isolation' },
  { id: 'cable_curl', muscle: 'biceps', tier: 'isolation' },

  // Triceps (6)
  { id: 'triceps_pushdown', muscle: 'triceps', tier: 'isolation' },
  { id: 'skull_crusher', muscle: 'triceps', tier: 'isolation' },
  { id: 'overhead_triceps_extension', muscle: 'triceps', tier: 'isolation' },
  { id: 'close_grip_bench_press', muscle: 'triceps', tier: 'compound' },
  { id: 'dips', muscle: 'triceps', tier: 'compound' },
  { id: 'dumbbell_kickback', muscle: 'triceps', tier: 'isolation' },

  // Core (6)
  { id: 'crunch', muscle: 'core', tier: 'isolation' },
  { id: 'plank', muscle: 'core', tier: 'isolation' },
  { id: 'hanging_leg_raise', muscle: 'core', tier: 'compound' },
  { id: 'russian_twist', muscle: 'core', tier: 'isolation' },
  { id: 'cable_woodchop', muscle: 'core', tier: 'isolation' },
  { id: 'ab_wheel_rollout', muscle: 'core', tier: 'compound' },

  // Glutes (4)
  { id: 'hip_thrust', muscle: 'glutes', tier: 'big_compound' },
  { id: 'glute_bridge', muscle: 'glutes', tier: 'compound' },
  { id: 'cable_kickback', muscle: 'glutes', tier: 'isolation' },
  { id: 'romanian_deadlift_dumbbell', muscle: 'glutes', tier: 'compound' },
];

export function exercisesByMuscle(muscle: MuscleGroup): BodybuildingExercise[] {
  return BODYBUILDING_EXERCISES.filter((e) => e.muscle === muscle);
}

export function getBuiltInExercise(id: string): BodybuildingExercise | undefined {
  return BODYBUILDING_EXERCISES.find((e) => e.id === id);
}

import type { ActivityType, OccupationLevel } from '../types/energy';

// --- v1 GENERAL constants ---------------------------------------------------
// These are rough, population-average values chosen to make the model
// "directionally correct", not precise. They are meant to be refined later with
// research or personal calibration. This is a self-tracking aid, NOT medical
// advice (see .ai/CONTEXT.md section 5).

// Multiplier applied to BMR to estimate the *passive* daily burn — basal
// metabolism plus the incidental movement typical of that lifestyle — BEFORE
// adding logged steps and workouts on top. (Textbook Mifflin activity factors.)
export const OCCUPATION_FACTORS: Record<OccupationLevel, number> = {
  sedentary: 1.2, // desk job / studying, little walking
  light: 1.35, // on feet part of the day (teacher, shop, light commute)
  active: 1.5, // physically active job (waiter, warehouse, trades)
};

// Kcal burned per step, scaled by body weight. ~0.0005 kcal/step/kg ≈
// 0.04 kcal/step at 78 kg (≈ 312 kcal for 8000 steps).
export const KCAL_PER_STEP_PER_KG = 0.0005;

// MET (Metabolic Equivalent of Task) per activity. kcal = MET × weightKg × hours.
export const MET_TABLE: Record<ActivityType, number> = {
  walking: 3.5,
  brisk_walking: 4.3,
  running: 9.8, // ~9–10 km/h; refine later by pace
  cycling: 7.5,
  swimming: 7.0,
  football: 8.0,
  basketball: 6.5,
  badminton: 5.5,
  tennis: 7.3,
  gym_strength: 5.0,
  hiit: 8.0,
  yoga: 2.5,
};

// Plausible human-body ranges for the body-profile form. These bound the
// Mifflin-St Jeor inputs (which is a linear formula — outside these ranges it
// keeps "computing" a number, but the number stops representing a real person).
export const PROFILE_LIMITS = {
  weightKg: { min: 20, max: 300 },
  heightCm: { min: 50, max: 250 },
  age: { min: 1, max: 120 },
};

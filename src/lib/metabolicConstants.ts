import type { ActivityType, OccupationLevel, StepActivityType } from '../types/energy';

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

// Kcal burned per step, scaled by body weight, PER STEP TYPE (research-backed —
// Compendium of Physical Activities 2024 codes 17170 walking / 12050 running /
// 17080 hiking; derivation C = MET × 0.0175 / cadence). Used by stepsKcal so
// the movement pin's charge and the energy goal it grows (see
// energyStore.addIntake/logActivity, energyBalanceEngine.growGoalFromActivity)
// agree on the same per-type rate instead of always assuming walking.
export const STEP_KCAL_PER_KG: Record<StepActivityType, number> = {
  walking: 0.0005, // ~0.04 kcal/step at 78 kg (≈ 312 kcal for 8000 steps)
  running: 0.00096,
  hiking: 0.0011,
};

// Kcal burned per step, scaled by body weight. Kept for existing call sites —
// equals STEP_KCAL_PER_KG.walking (the legacy/default rate).
export const KCAL_PER_STEP_PER_KG = STEP_KCAL_PER_KG.walking;

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
  // Compendium of Physical Activities 2024 code 02052 — the only code that
  // explicitly names squat/deadlift.
  squat: 5.0,
  deadlift: 5.0,
  // Reasoned between codes 02054 (3.5, general resistance training) and 02050
  // (6.0, vigorous effort) — Robergs 2007 / Reis 2017 show bench press has a
  // lower energy cost than squat (fewer/smaller muscle groups involved).
  bench_press: 4.0,
};

// Cadence used to translate workout minutes into movement-pin step
// equivalents (see metabolismEngine.workoutStepEquivalent) — Marshall et al.
// 2009 and Tudor-Locke et al. 2019 (CADENCE-adults) cadence bands.
export const STEP_EQUIV_MODERATE_PER_MIN = 100; // MET < VIGOROUS_MET_THRESHOLD
export const STEP_EQUIV_VIGOROUS_PER_MIN = 130; // MET >= VIGOROUS_MET_THRESHOLD
export const VIGOROUS_MET_THRESHOLD = 6;

// Plausible human-body ranges for the body-profile form. These bound the
// Mifflin-St Jeor inputs (which is a linear formula — outside these ranges it
// keeps "computing" a number, but the number stops representing a real person).
export const PROFILE_LIMITS = {
  weightKg: { min: 20, max: 300 },
  heightCm: { min: 50, max: 250 },
  age: { min: 1, max: 120 },
  averageDailySteps: { min: 0, max: 30000 },
};

// --- S-O: "satiety" (fullness/hunger) battery constants ---------------------
// Fixed awake/asleep window used to shape the reserve's passive drain across
// the day (higher while awake, lower while asleep) — see satietyEngine.ts.
// Same v1 assumption as S-K: a fixed schedule for everyone, not read from a
// logged sleep battery.
export const CIRCADIAN_WINDOW = {
  wakeHour: 6, // 06:00 — start of the "awake" burn rate
  sleepHour: 23, // 23:00 — start of the "asleep" burn rate (until wakeHour next day)
};

// Metabolism runs ~10-15% slower during sleep (lower body temperature, resting
// muscle) than while awake — general population estimate, not a personal
// measurement (Ultrahuman/Healthline/Cleveland Clinic, checked 2026-07-04).
export const SLEEP_BURN_MULTIPLIER = 0.85;

// Capacity of the satiety reserve — roughly "one full meal" in kcal. Eating
// this much from empty fills the reserve to 100%.
export const FULLNESS_CAPACITY_KCAL = 1000;

// The satiety % never drops below this floor, even at reserve = 0 — the body
// always keeps some reserve; this is a gauge floor, not a claim about biology.
export const SATIETY_FLOOR_PCT = 20;

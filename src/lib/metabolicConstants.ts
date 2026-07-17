import type {
  ActivityType,
  BbIntensity,
  BbMetTier,
  LiftingExercise,
  OccupationLevel,
  StepActivityType,
} from '../types/energy';

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
  elliptical: 5.0, // Compendium 2024 code 02048 — elliptical trainer, moderate effort
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
  // Placeholder — 'custom' activities carry their own rate on the session
  // itself (WorkoutSession.customMet), never looked up here. Present only so
  // MET_TABLE stays a total Record<ActivityType, number>.
  custom: 0,
  // Placeholder — same reason as 'custom': S-BB sessions carry their own
  // effective rate on WorkoutSession.bbMet (see bodybuildingEngine.ts),
  // computed from BB_MET_TIER × BB_INTENSITY_FACTOR, never looked up here.
  // MUST stay excluded from EnergyActionsBar's ACTIVITY_TYPES picker (it has
  // no minutes-based meaning) — see the filter there.
  bodybuilding: 0,
};

// --- S-BB: bodybuilding-by-muscle-group energy model (MET-tier) -------------
// kcal = effMET × weightKg × (sessionMinutes / 60), where effMET is derived
// from the exercise's tier and the user's chosen intensity/rest style — NOT
// from mechanical work like liftingEngine.ts. Research (Compendium 2024,
// MyFitnessPal, Hevy/Strong) agrees per-exercise physics isn't reliable for
// isolation movements; a MET tier anchored to the Compendium's own resistance
// training codes is the honest, industry-standard estimate. See
// docs/06-energy-expenditure.md §1C for the full derivation + sources.

// Per-exercise MET tier (Compendium of Physical Activities 2024):
//   isolation    — code 02054, 3.5 MET, "multiple exercises, 8-15 reps,
//                  varied resistance" — single-joint/small-muscle moves
//                  (curls, raises, extensions, flys).
//   compound     — code 02052, 5.0 MET, squat/deadlift-class effort —
//                  standard multi-joint lifts (presses, rows, lunges).
//   big_compound — code 02050, 6.0 MET, "power lifting or body building,
//                  vigorous effort" — the largest multi-joint/large-muscle
//                  moves (leg press, pull-ups, hip thrust).
export const BB_MET_TIER: Record<BbMetTier, number> = {
  isolation: 3.5,
  compound: 5.0,
  big_compound: 6.0,
};

// Rest-style multiplier the user picks per exercise (default 'moderate').
// Short-rest circuits keep the heart rate elevated relative to plain
// moderate resistance training — the Compendium's own circuit/superset code
// (02055 = 5.8 MET) sits ~1.15× above the plain compound tier (5.0), which
// is where the 'superset' factor below is anchored.
export const BB_INTENSITY_FACTOR: Record<BbIntensity, number> = {
  light: 0.9,
  moderate: 1.0,
  superset: 1.15,
};

// Nominal seconds "under tension" per rep, and nominal rest seconds after
// each set — used to derive a session's minutes from sets×reps alone (the
// user never types a duration for S-BB, same UX as S-PL). Population-average
// v1 estimates, not a personal cadence measurement.
export const BB_SEC_PER_REP = 3;
export const BB_REST_SEC = 60;

// --- S-PL: set-based powerlifting energy model (tonnage hybrid) -------------
// kcal per SET = mechanical lifting work / muscle efficiency, plus a separate
// rest-overhead term per session (see liftingEngine.ts). All factors are
// population-average v1 estimates, documented in docs/06 section 1B.

// Per-exercise biomechanics: how much of the lifter's own body mass moves
// with the bar, and how far the bar travels as a fraction of body height.
// Body-segment masses from de Leva (1996) anthropometry tables:
//   squat    — whole body minus shanks+feet (~12%) rides the bar → 0.88;
//              bar drops/rises ~25% of stature in a parallel-to-deep squat.
//   bench    — both upper limbs ≈ 10% of body mass move with the bar;
//              ROM ≈ arm length − chest depth ≈ 19% of stature.
//   deadlift — trunk+head+arms (~60% of mass) rise roughly HALF the bar's
//              path (torso pivots up, hips rise less than shoulders), folded
//              into an effective 0.25 factor at full bar ROM; bar travels
//              floor (plate radius 22.5cm) → lockout ≈ 30% of stature.
export const LIFTING_PARAMS: Record<
  LiftingExercise,
  { bodyMassFactor: number; romOfHeight: number }
> = {
  squat: { bodyMassFactor: 0.88, romOfHeight: 0.25 },
  bench_press: { bodyMassFactor: 0.1, romOfHeight: 0.19 },
  deadlift: { bodyMassFactor: 0.25, romOfHeight: 0.3 },
};

// Gross mechanical efficiency of concentric muscle work (~20%, exercise
// physiology textbook range 15–25%): metabolic kcal = mechanical work / 0.20.
export const LIFTING_EFFICIENCY = 0.2;

// Lowering the bar (eccentric phase) costs roughly a third of the lifting
// (concentric) phase — Abbott et al. 1952 classic estimate, still the
// standard first-order factor. Total per rep = concentric × (1 + 0.33).
export const LIFTING_ECCENTRIC_FACTOR = 0.33;

// Between-set recovery is NOT free: standing/pacing/re-racking between sets
// runs ~2.0 MET (Compendium 2024 standing-light codes). Research measuring
// whole sessions (João 2021: 5.3–6.5 kcal/min session average) shows this
// recovery overhead dominates the pure lifting work — omitting it would
// under-count a powerlifting session 3–5×.
export const LIFTING_REST_MET = 2.0;

// Estimated wall-clock minutes one set occupies (set itself + the rest after
// it): powerlifting working sets rest 2–5 min → 3 min average; warm-up ramp
// sets rest much shorter → 1.5 min. Used to derive session `minutes` when
// the user logs sets instead of a duration (estimateLiftingMinutes).
export const LIFTING_SET_CYCLE_MIN: Record<'warmup' | 'working', number> = {
  warmup: 1.5,
  working: 3,
};

// Standard Olympic barbell — the floor for warm-up ramp suggestions.
export const BARBELL_WEIGHT_KG = 20;

// Physics constants for the lifting-work formula.
export const GRAVITY_MS2 = 9.81;
export const JOULES_PER_KCAL = 4184;

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

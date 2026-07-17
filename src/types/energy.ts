// Types for the metabolic energy-expenditure model (the "self-discharge" of the
// body). v1 / general — see docs/06-energy-expenditure.md. NOT medical advice.

export type Sex = 'male' | 'female';

// Lifestyle / occupation activity level. This captures the *passive* daily
// movement of a person's job or routine (desk vs. on-feet vs. physical labour).
// Deliberate workouts are logged separately so they are NOT double-counted here.
export type OccupationLevel = 'sedentary' | 'light' | 'active';

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  occupation: OccupationLevel;
  averageDailySteps?: number;
  // Optional weight goal (S-P): desired body weight and, optionally, the
  // timeframe to reach it. When goalWeeks is omitted, the app picks the
  // fastest SAFE pace on its own — see domain/energy/weightGoal.ts.
  goalWeightKg?: number;
  goalWeeks?: number;
}

// Deliberate exercise types, each mapped to a MET value in metabolicConstants.
// 'custom' is the escape hatch for a user-defined activity (see
// CustomActivity below) — it has no fixed MET_TABLE rate; the rate travels
// with the individual WorkoutSession/CustomActivity instead.
// 'bodybuilding' is the S-BB set-based muscle-group model (see below) — its
// MET_TABLE entry is a 0 placeholder for the same reason as 'custom': the
// real effective MET travels on the session itself (WorkoutSession.bbMet).
export type ActivityType =
  | 'walking'
  | 'brisk_walking'
  | 'running'
  | 'cycling'
  | 'elliptical'
  | 'swimming'
  | 'football'
  | 'basketball'
  | 'badminton'
  | 'tennis'
  | 'gym_strength'
  | 'hiit'
  | 'yoga'
  | 'squat'
  | 'bench_press'
  | 'deadlift'
  | 'bodybuilding'
  | 'custom';

// A user-defined activity (not in MET_TABLE), persisted in settingsStore so
// it can be re-picked from the activity list. `category` mirrors the
// EnergyActionsBar top-level groups (cardio/sports/gym/other) so a custom
// activity can slot into the same picker UI. `met` is the user (or a
// reasonable default) estimate — there is no research table lookup for an
// arbitrary custom activity.
export interface CustomActivity {
  id: string;
  nameVi: string;
  category: 'cardio' | 'sports' | 'gym' | 'other';
  met: number;
}

// The three powerlifting movements that support set-based logging (S-PL).
// Their kcal comes from the tonnage model in liftingEngine.ts, not MET ×
// minutes — the MET_TABLE entries for these remain only as a fallback for
// rows logged before S-PL (minutes-based, no `sets`).
export type LiftingExercise = 'squat' | 'bench_press' | 'deadlift';

export const LIFTING_EXERCISES: LiftingExercise[] = ['squat', 'bench_press', 'deadlift'];

// One barbell set. `warmup` sets are the ramp-up (bar → % of working weight);
// `working` sets are the main lift. Both count toward kcal; the distinction
// exists for the warm-up/main UI sections and future block analysis (e1RM
// trends should read `working` sets only).
export interface LiftingSet {
  kind: 'warmup' | 'working';
  weightKg: number; // barbell + plates, NOT including body weight
  reps: number;
}

// The subset of ActivityType that stepsKcal / growGoalFromActivity can rate
// per-step (Compendium of Physical Activities 2024) — used to sync the
// movement pin's charge with the energy goal it grows (see
// energyStore.addIntake/logActivity), instead of always assuming walking.
export type StepActivityType = 'walking' | 'running' | 'hiking';

// --- S-BB: bodybuilding-by-muscle-group energy model -----------------------
// A self-built workout browsed by muscle group (chest/back/legs/...), logged
// set-based like S-PL but priced via a MET-tier model instead of physics —
// see docs/06-energy-expenditure.md §1C. Deliberately NOT the same model as
// liftingEngine.ts: research (Compendium 2024, MyFitnessPal, Hevy/Strong) is
// unanimous that per-exercise mechanical work isn't reliable for isolation
// movements — a MET tier anchored to the Compendium's own resistance-training
// codes is the honest estimate here.
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'glutes';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'glutes',
];

// How metabolically demanding the exercise itself is (Compendium 2024 codes:
// 02054=3.5 isolation/multi-exercise, 02052=5.0 squat/deadlift-class compound,
// 02050=6.0 vigorous bodybuilding/powerlifting-class) — see BB_MET_TIER.
export type BbMetTier = 'isolation' | 'compound' | 'big_compound';

// Rest-style / pacing the user picks per exercise when logging — the
// Compendium's own circuit/superset code (02055=5.8) sits ABOVE plain
// moderate resistance training because short rest keeps heart rate elevated
// (see BB_INTENSITY_FACTOR).
export type BbIntensity = 'light' | 'moderate' | 'superset';

// One built-in library entry (src/lib/bodybuildingExercises.ts). `id` is the
// i18n key suffix (`bbExercises.<id>`) — never a display string itself.
export interface BodybuildingExercise {
  id: string;
  muscle: MuscleGroup;
  tier: BbMetTier;
}

// A user-defined bodybuilding exercise, mirroring CustomActivity — persisted
// in settingsStore.customExercises so it can be re-picked from the
// muscle-group browser. `nameVi` is free text (same convention as
// CustomActivity.nameVi) regardless of the app's current display language.
export interface CustomExercise {
  id: string;
  nameVi: string;
  muscle: MuscleGroup;
  tier: BbMetTier;
}

export interface WorkoutSession {
  type: ActivityType;
  minutes: number;
  // Optional real-world time window this workout happened in (unix ms).
  // Display-only (history/Excel) — burn is still computed from `minutes`
  // alone. See B2: no replay engine, battery effects apply once at log time.
  startAt?: number;
  endAt?: number;
  // S-PL: set-based powerlifting detail (squat/bench/deadlift only). When
  // present, kcal is computed from the sets via liftingEngine (tonnage ×
  // ROM-from-height + rest overhead), NOT from MET × minutes — `minutes` is
  // then the estimateLiftingMinutes() value, kept so minute-based consumers
  // (movement-pin step equivalent, history display, Excel notes) keep
  // working. Stored inside the activity_log.workouts JSON column — rows
  // logged before S-PL simply lack this field and stay on the MET path.
  sets?: LiftingSet[];
  // Custom-activity fields: set ONLY when type === 'custom'. `customName` is
  // the free-text Vietnamese label (falls back to a generic "Môn tự thêm" in
  // the UI when absent); `customMet` is the MET rate metabolismEngine uses
  // instead of MET_TABLE for this one session. Both live inside the same
  // activity_log.workouts JSON column as every other WorkoutSession field, so
  // no DB migration is needed.
  customName?: string;
  customMet?: number;
  // S-BB: set-based bodybuilding-by-muscle-group fields. Present ONLY when
  // type === 'bodybuilding'. `bbExerciseId` is the built-in library id
  // (BODYBUILDING_EXERCISES) or a custom exercise id (`bbx_*`); `bbMuscle`,
  // `bbTier`, and `bbMet` are snapshotted at log time (bbMet = the effective
  // MET — tier × intensity factor — see bodybuildingEngine.bbEffectiveMet) so
  // a later change to the constants or a deleted custom exercise never
  // rewrites history. `bbTier` specifically exists so re-opening an entry for
  // editing can reconstruct the intensity that produced `bbMet` (see
  // BodybuildingSheet.deriveIntensity) WITHOUT needing to look the exercise
  // back up — a custom exercise's tier is otherwise unrecoverable once the
  // user deletes it from settingsStore.customExercises, which would silently
  // drift a re-saved historical session's kcal. `bbName` is set ONLY for a
  // custom exercise (its free-text name, same convention as customName); a
  // built-in exercise's display name is always looked up live via
  // `t('bbExercises.' + bbExerciseId)`, never stored, since the library
  // itself is bundled data, not user history. `sets` (LiftingSet[], reused)
  // carries the logged sets — reps drive kcal, weightKg is recorded for
  // tonnage/volume display only (see docs/06 §1C).
  bbExerciseId?: string;
  bbMuscle?: MuscleGroup;
  bbTier?: BbMetTier;
  bbMet?: number;
  bbName?: string;
}

// Breakdown of one day's energy expenditure, all in kcal.
export interface ExpenditureBreakdown {
  bmr: number; // basal metabolic rate (Mifflin-St Jeor)
  passive: number; // bmr × occupation factor — burned continuously over 24h
  steps: number; // kcal from logged steps
  workouts: number; // kcal from logged exercise sessions
  total: number; // passive + steps + workouts
}

// One logged "Vận động" (activity) event — steps and/or workout sessions —
// stored as its own record (id) so it can be edited/undone (B2), unlike the
// old fire-and-forget intake_events write. Battery effects (energy goal
// growth, satiety drain, movement pin charge) are applied ONCE, at log time
// (`timestamp`) — by design there is no replay engine, so `startAt`/`endAt`
// are display-only fields for history/Excel and do NOT change what already
// happened to the batteries.
export interface ActivityLogEntry {
  id: string;
  timestamp: number; // when this was logged — drives the actual battery effect
  startAt?: number; // when the activity actually took place (display only)
  endAt?: number;
  steps: number;
  workouts: WorkoutSession[];
  energyKcal: number; // total kcal burned, snapshotted (steps + all workouts)
  // The portion of energyKcal that also drained satietyReserveKcal (workouts
  // only — see energyStore.logActivity). Snapshotted so removeActivity can
  // undo the satiety drain exactly, without recomputing from live workouts.
  satietyDrainKcal: number;
  // The "energy day" (see lib/dateUtils.energyDayString, 6am reset) whose
  // energy-battery reading this entry's battery effect was actually applied
  // to, snapshotted at log time. activityLog itself is grouped by ordinary
  // calendar day (see activityLogRepository), which can disagree with this
  // for activity logged between midnight and 6am — removeActivity uses this
  // field to reverse the effect on the CORRECT day's reading, even if that's
  // no longer the day currently loaded in the store (FIX #5).
  energyDayApplied: string;
  // BUG A fix: exactly how much the movement pin was charged at log time —
  // steps + workout step-equivalents (see metabolismEngine.totalStepEquivalent).
  // Snapshotted so removeActivity can reverse the EXACT charge instead of
  // recomputing it (the workout-step-equivalent rate could change later).
  // Rows logged BEFORE this field existed only ever charged the pin by
  // `steps` (workouts never touched it) — consumers must fall back to
  // `entry.steps` when this is undefined (see energyStore.movementChargeOf).
  movementStepsApplied?: number;
}

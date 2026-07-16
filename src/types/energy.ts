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

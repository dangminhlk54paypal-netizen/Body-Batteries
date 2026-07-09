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
export type ActivityType =
  | 'walking'
  | 'brisk_walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'football'
  | 'basketball'
  | 'badminton'
  | 'tennis'
  | 'gym_strength'
  | 'hiit'
  | 'yoga';

export interface WorkoutSession {
  type: ActivityType;
  minutes: number;
  // Optional real-world time window this workout happened in (unix ms).
  // Display-only (history/Excel) — burn is still computed from `minutes`
  // alone. See B2: no replay engine, battery effects apply once at log time.
  startAt?: number;
  endAt?: number;
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
}

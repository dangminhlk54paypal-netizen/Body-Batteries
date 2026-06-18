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
}

// Breakdown of one day's energy expenditure, all in kcal.
export interface ExpenditureBreakdown {
  bmr: number; // basal metabolic rate (Mifflin-St Jeor)
  passive: number; // bmr × occupation factor — burned continuously over 24h
  steps: number; // kcal from logged steps
  workouts: number; // kcal from logged exercise sessions
  total: number; // passive + steps + workouts
}

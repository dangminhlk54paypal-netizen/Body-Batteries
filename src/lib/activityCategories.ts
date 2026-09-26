import { MET_TABLE } from './metabolicConstants';
import type { ActivityType } from '../types/energy';

// Minutes-based activity types offered in the activity sheet. Excludes
// 'custom' (rate travels on the session, see CustomActivity) AND
// 'bodybuilding' (S-BB — rate travels on WorkoutSession.bbMet; logged only
// through BodybuildingSheet's muscle-group picker, never this chip list).
export const ACTIVITY_TYPES = Object.keys(MET_TABLE).filter(
  (t) => t !== 'custom' && t !== 'bodybuilding'
) as ActivityType[];

// The activity picker's top-level groups. Squat/bench/deadlift are absent on
// purpose: they're logged set-based through the Powerlifting sheet (S-PL),
// which the Gym group opens. `gym_strength` stays minutes-based/MET-driven.
export const ACTIVITY_CATEGORIES: { key: string; types: ActivityType[] }[] = [
  { key: 'cardio', types: ['walking', 'brisk_walking', 'running', 'cycling', 'elliptical'] },
  { key: 'sports', types: ['swimming', 'football', 'basketball', 'badminton', 'tennis'] },
  { key: 'gym', types: ['gym_strength', 'hiit'] },
  { key: 'other', types: ['yoga'] },
];

export function categoryOfActivity(type: ActivityType): string | null {
  return ACTIVITY_CATEGORIES.find((c) => c.types.includes(type))?.key ?? null;
}

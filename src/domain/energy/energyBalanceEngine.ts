import type { BatteryReading } from '../../types/battery';
import type { UserProfile, WorkoutSession } from '../../types/energy';
import {
  passiveDailyBurn,
  passiveBurnPerHour,
  stepsKcal,
  totalWorkoutKcal,
} from './metabolismEngine';
import { KCAL_PER_GRAM } from '../../lib/constants';

// The energy battery (S-M "eaten / goal" model): level = kcal eaten today
// (starts at 0), capacity = today's kcal goal (passive metabolism + any
// activity logged today). The bar fills as you eat; it does NOT drain over
// time on its own — only the separate "can eat now" number (see canEatNow)
// moves with the clock. See .ai/parallel-reports/S-M-energy-redesign-spec.md.

// Today's baseline kcal goal from the profile alone (before any activity
// logged today grows it further via growGoalFromActivity).
export function energyCapacity(profile: UserProfile): number {
  return passiveDailyBurn(profile);
}

// A fresh energy reading for the day: empty (nothing eaten yet), goal set
// from the profile. Waking up empty is normal — it fills up as you eat.
export function createEnergyReading(date: string, profile: UserProfile): BatteryReading {
  return {
    date,
    batteryTypeId: 'energy',
    level: 0,
    capacity: energyCapacity(profile),
    activityBonusKcal: 0,
  };
}

// Re-apply the current profile's baseline goal to an existing energy reading
// (e.g. the user edited their profile mid-day). Preserves both the kcal
// already eaten (level) and any goal growth from activity logged earlier
// today (activityBonusKcal) — only the profile-derived baseline is redone.
export function reconcileEnergyCapacity(
  reading: BatteryReading,
  profile: UserProfile
): BatteryReading {
  return {
    ...reading,
    capacity: energyCapacity(profile) + (reading.activityBonusKcal ?? 0),
  };
}

// Convert a logged macro intake (protein/carbs grams) to kcal. Other batteries
// (water, sleep, ...) contribute 0 kcal.
export function kcalFromMacro(batteryId: BatteryReading['batteryTypeId'], grams: number): number {
  const perGram = KCAL_PER_GRAM[batteryId] ?? 0;
  return Math.round(grams * perGram);
}

// Add eaten kcal to the energy battery. No upper clamp: eating past the goal
// is allowed and shown as a surplus ("ăn dư"), never silently capped away.
export function chargeEnergy(reading: BatteryReading, kcal: number): BatteryReading {
  if (kcal <= 0) return reading;
  return { ...reading, level: Math.round((reading.level + kcal) * 10) / 10 };
}

// Subtract kcal from the energy battery (e.g. undoing a logged food entry).
// Floors at 0 — kcal eaten today can't go negative.
export function burnEnergy(reading: BatteryReading, kcal: number): BatteryReading {
  if (kcal <= 0) return reading;
  return { ...reading, level: Math.max(0, Math.round((reading.level - kcal) * 10) / 10) };
}

// Logged activity (steps + workouts) grows today's goal — moving more means
// more room to eat. It does NOT touch level (eaten stays exactly as logged).
export function growGoalFromActivity(
  reading: BatteryReading,
  profile: UserProfile,
  steps: number,
  workouts: WorkoutSession[]
): BatteryReading {
  const kcal = stepsKcal(steps, profile.weightKg) + totalWorkoutKcal(workouts, profile.weightKg);
  if (kcal <= 0) return reading;
  return {
    ...reading,
    capacity: reading.capacity + kcal,
    activityBonusKcal: (reading.activityBonusKcal ?? 0) + kcal,
  };
}

// Kcal the body has burned since local midnight: passive metabolism spread
// evenly over the elapsed hours, plus any activity bonus logged today.
export function burnedSoFar(
  profile: UserProfile,
  elapsedHoursSinceMidnight: number,
  activityBonusKcal: number
): number {
  return passiveBurnPerHour(profile) * Math.max(0, elapsedHoursSinceMidnight) + activityBonusKcal;
}

// The live "còn được ăn ngay" number: burned-so-far minus eaten-so-far.
// Positive = still room before catching up with what the body has burned;
// negative = already ate more than burned so far (very normal right after a
// meal — the day's goal accounts for the full 24h, this is just a pace hint).
export function canEatNow(
  reading: BatteryReading,
  profile: UserProfile,
  elapsedHoursSinceMidnight: number
): number {
  const burned = burnedSoFar(profile, elapsedHoursSinceMidnight, reading.activityBonusKcal ?? 0);
  return Math.round((burned - reading.level) * 10) / 10;
}

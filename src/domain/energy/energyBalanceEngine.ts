import type { BatteryReading } from '../../types/battery';
import type { UserProfile, WorkoutSession } from '../../types/energy';
import { clampLevel } from '../battery/batteryEngine';
import {
  passiveDailyBurn,
  passiveBurnPerHour,
  stepsKcal,
  totalWorkoutKcal,
} from './metabolismEngine';
import { KCAL_PER_GRAM } from '../../lib/constants';

// The energy battery (Hướng B): a BatteryReading whose level/capacity are in
// kcal. Capacity = the day's passive energy need (TDEE baseline). It charges
// when the user eats and drains as the body burns energy (metabolism + activity).
// v1 / general — see docs/06-energy-expenditure.md.

// Daily capacity (kcal) for the energy battery, from the user's metabolism.
export function energyCapacity(profile: UserProfile): number {
  return passiveDailyBurn(profile);
}

// A fresh energy reading for the day. Starts "full" (100%): you wake up fuelled,
// then metabolism drains it while eating tops it back up.
export function createEnergyReading(date: string, profile: UserProfile): BatteryReading {
  const capacity = energyCapacity(profile);
  return { date, batteryTypeId: 'energy', level: capacity, capacity };
}

// Re-apply the current profile's capacity to an existing energy reading (e.g.
// the user changed weight). Keeps the level, re-clamped to the new capacity.
export function reconcileEnergyCapacity(
  reading: BatteryReading,
  profile: UserProfile
): BatteryReading {
  const capacity = energyCapacity(profile);
  return { ...reading, capacity, level: clampLevel(reading.level, capacity) };
}

// Convert a logged macro intake (protein/carbs grams) to kcal. Other batteries
// (water, sleep, ...) contribute 0 kcal.
export function kcalFromMacro(batteryId: BatteryReading['batteryTypeId'], grams: number): number {
  const perGram = KCAL_PER_GRAM[batteryId] ?? 0;
  return Math.round(grams * perGram);
}

// Add eaten kcal to the energy battery (clamped at capacity — no overflow).
export function chargeEnergy(reading: BatteryReading, kcal: number): BatteryReading {
  if (kcal <= 0) return reading;
  return { ...reading, level: clampLevel(reading.level + kcal, reading.capacity) };
}

// Subtract burned kcal from the energy battery (clamped at 0).
export function burnEnergy(reading: BatteryReading, kcal: number): BatteryReading {
  if (kcal <= 0) return reading;
  return {
    ...reading,
    level: Math.round(clampLevel(reading.level - kcal, reading.capacity) * 10) / 10,
  };
}

// Burn the passive metabolic energy for a stretch of elapsed time.
export function burnPassive(
  reading: BatteryReading,
  profile: UserProfile,
  elapsedHours: number
): BatteryReading {
  return burnEnergy(reading, passiveBurnPerHour(profile) * elapsedHours);
}

// Burn the energy of logged activity (steps + workout sessions).
export function burnActivity(
  reading: BatteryReading,
  profile: UserProfile,
  steps: number,
  workouts: WorkoutSession[]
): BatteryReading {
  const kcal = stepsKcal(steps, profile.weightKg) + totalWorkoutKcal(workouts, profile.weightKg);
  return burnEnergy(reading, kcal);
}

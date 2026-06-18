import type { BatteryReading, BatteryId } from '../../types/battery';
import type { ModeDefinition } from '../../types/modes';
import { DEFAULT_BATTERIES } from '../../lib/constants';

// Returns capacity for a battery in a given mode
export function capacityForMode(batteryId: BatteryId, mode: ModeDefinition): number {
  const base = DEFAULT_BATTERIES.find((b) => b.id === batteryId);
  if (!base) return 0;
  const multiplier = mode.capacityMultipliers[batteryId] ?? 1.0;
  return Math.round(base.defaultCapacity * multiplier);
}

// Clamps level between 0 and capacity
export function clampLevel(level: number, capacity: number): number {
  return Math.min(Math.max(0, level), capacity);
}

// Calculate percentage 0–100
export function toPercentage(level: number, capacity: number): number {
  if (capacity === 0) return 0;
  return Math.round((level / capacity) * 100);
}

// Apply one intake event to a reading
export function applyIntake(reading: BatteryReading, amount: number): BatteryReading {
  const newLevel = clampLevel(reading.level + amount, reading.capacity);
  return { ...reading, level: newLevel };
}

// Apply time-based drain to a reading
export function applyDrain(
  reading: BatteryReading,
  elapsedHours: number,
  drainRatePerHour: number
): BatteryReading {
  const drainAmount = reading.capacity * drainRatePerHour * elapsedHours;
  const newLevel = clampLevel(reading.level - drainAmount, reading.capacity);
  return { ...reading, level: Math.round(newLevel * 10) / 10 };
}

// Compute master battery level from sub-batteries (weighted average)
export function computeMasterLevel(readings: BatteryReading[]): number {
  const active = readings.filter((r) => r.batteryTypeId !== 'master');
  if (active.length === 0) return 0;
  const total = active.reduce((sum, r) => sum + toPercentage(r.level, r.capacity), 0);
  return Math.round(total / active.length);
}

// Create a fresh daily reading (reset to 0 or carry-over)
export function createDailyReading(
  date: string,
  batteryId: BatteryId,
  mode: ModeDefinition,
  carryOverLevel = 0
): BatteryReading {
  const capacity = capacityForMode(batteryId, mode);
  return {
    date,
    batteryTypeId: batteryId,
    level: clampLevel(carryOverLevel, capacity),
    capacity,
  };
}

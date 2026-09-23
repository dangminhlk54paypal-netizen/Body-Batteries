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

const HOUR_MS = 60 * 60 * 1000;

export interface PinChargeEvent {
  atMs: number;
  amount: number; // always positive
}

// Level of a linearly-draining pin (protein/carbs/water/minerals) that starts
// the day at 0 at `dayStartMs`: it loses capacity x drainRatePerHour every hour
// (floor 0), and each event adds `amount` at the moment it HAPPENED (cap =
// capacity). Events outside [dayStartMs, nowMs] are ignored; input order does
// not matter. Rounded once at the end (0.1, like applyDrain).
//
// A pure function of the timestamped logs, so a meal logged late gives the
// same level as the same meal logged on time (the incremental applyIntake +
// tickDrain path only drains the time AFTER the log was written).
export function replayDrainingPin(
  capacity: number,
  drainRatePerHour: number,
  dayStartMs: number,
  events: readonly PinChargeEvent[],
  nowMs: number
): number {
  if (capacity <= 0) return 0;
  const ordered = events
    .filter((e) => e.amount > 0 && e.atMs >= dayStartMs && e.atMs <= nowMs)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.atMs - b.e.atMs || a.i - b.i)
    .map(({ e }) => e);

  const drainOver = (fromMs: number, toMs: number) =>
    capacity * drainRatePerHour * ((toMs - fromMs) / HOUR_MS);

  let level = 0;
  let cursor = dayStartMs;
  for (const ev of ordered) {
    level = Math.max(0, level - drainOver(cursor, ev.atMs));
    level = Math.min(capacity, level + ev.amount);
    cursor = ev.atMs;
  }
  level = Math.max(0, level - drainOver(cursor, nowMs));
  return Math.round(level * 10) / 10;
}

// Caps an elapsed-drain interval [fromMs, toMs) so it never crosses a local
// midnight boundary. Nutrient batteries (protein/carbs/water/...) are keyed
// by calendar day and only get a fresh row once `loadToday` notices the day
// rolled over (checked every ~15 min, see App.tsx). Until then the in-memory
// `readings` still carry yesterday's `date`, so a drain tick that spans
// midnight (e.g. fired at 00:05 for a tick that started at 23:50) must only
// drain the portion that actually happened before midnight -- otherwise the
// extra minutes get persisted onto yesterday's stored reading, corrupting
// its final level. The portion after midnight is intentionally dropped here:
// once `loadToday` refreshes to the new day, that day's reading starts fresh
// and the next drain tick picks up from there.
export function clampElapsedHoursAtMidnight(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  const from = new Date(fromMs);
  const nextMidnight = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    0,
    0,
    0,
    0
  ).getTime();
  const cappedToMs = Math.min(toMs, nextMidnight);
  return (cappedToMs - fromMs) / HOUR_MS;
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

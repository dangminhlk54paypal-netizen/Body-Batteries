import type { BatteryId, BatteryReading, IntakeEvent } from '../../types/battery';
import type { FoodLogEntry } from '../../types/food';
import { replayDrainingPin, type PinChargeEvent } from './batteryEngine';

// The four sub-batteries fed by food (and, for water, the manual quick-tap).
// They reset to 0 at local midnight and drain linearly, so their level is a
// pure replay of today's timestamped logs — see replayDrainingPin. Movement
// and sleep are NOT in this set (different sources; out of scope).
export const FOOD_PIN_IDS: readonly BatteryId[] = ['protein', 'carbs', 'water', 'minerals'];

export function isFoodPin(id: BatteryId): boolean {
  return FOOD_PIN_IDS.includes(id);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function foodAmount(entry: FoodLogEntry, id: BatteryId): number {
  switch (id) {
    case 'protein':
      return entry.proteinG;
    case 'carbs':
      return entry.carbG;
    case 'water':
      return entry.waterG;
    case 'minerals':
      return entry.mineralsMg;
    default:
      return 0;
  }
}

// Charge events for one pin: every logged food's contribution at its MEAL
// time, plus the manual quick-taps of exactly that battery at their tap time.
export function foodPinEvents(
  id: BatteryId,
  foodLog: readonly FoodLogEntry[],
  intakeLog: readonly IntakeEvent[]
): PinChargeEvent[] {
  const events: PinChargeEvent[] = [];
  for (const f of foodLog) {
    const amount = foodAmount(f, id);
    if (amount > 0) events.push({ atMs: f.timestamp, amount });
  }
  for (const e of intakeLog) {
    if (e.batteryTypeId === id && e.amount > 0) events.push({ atMs: e.timestamp, amount: e.amount });
  }
  return events;
}

// Local midnight at the start of a 'YYYY-MM-DD' reading date.
function dayStartOf(date: string): number {
  return new Date(date + 'T00:00:00').getTime();
}

// Returns `readings` with protein/carbs/water/minerals replaced by the replay
// of today's logs. Each pin is replayed over ITS OWN row's calendar day, and
// never past that day's end — so a row that hasn't rolled over yet (still
// carrying yesterday's date until loadToday refreshes) keeps meaning
// "yesterday", matching clampElapsedHoursAtMidnight in the drain tick.
export function recomputeFoodPinLevels(
  readings: readonly BatteryReading[],
  input: {
    foodLog: readonly FoodLogEntry[];
    intakeLog: readonly IntakeEvent[];
    drainRatePerHour: number;
    nowMs: number;
  }
): BatteryReading[] {
  return readings.map((r) => {
    if (!isFoodPin(r.batteryTypeId)) return r;
    const dayStartMs = dayStartOf(r.date);
    const dayEndMs = dayStartMs + DAY_MS;
    const events = foodPinEvents(r.batteryTypeId, input.foodLog, input.intakeLog).filter(
      (e) => e.atMs < dayEndMs
    );
    const level = replayDrainingPin(
      r.capacity,
      input.drainRatePerHour,
      dayStartMs,
      events,
      Math.min(input.nowMs, dayEndMs)
    );
    return { ...r, level };
  });
}

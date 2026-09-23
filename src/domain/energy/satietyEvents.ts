import type { FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry } from '../../types/energy';
import type { IntakeEvent } from '../../types/battery';
import { kcalFromMacro } from './energyBalanceEngine';
import { isManualCalorieIntake, isManualQuickTapIntake } from '../battery/intakeClassification';
import type { SatietyEvent } from './satietyEngine';

// Turns the timestamped logs into the event list replaySatietyReserve
// consumes. Pure: callers fetch the rows (DB and/or in-memory) and pass them
// in. Each event sits at the moment it HAPPENED — meal time, workout end —
// never at the moment it was logged (see the satiety-timing plan,
// .ai/plans/2026-09-23-battery-late-logging-timing.md).
//
// Rows may be passed from more than one source (DB + the store's in-memory
// today logs); they are de-duplicated by id here.
export function buildSatietyEvents(input: {
  foodLog: readonly FoodLogEntry[];
  intakeEvents: readonly IntakeEvent[];
  activityLog: readonly ActivityLogEntry[];
}): SatietyEvent[] {
  const events: SatietyEvent[] = [];

  const seenFood = new Set<string>();
  for (const f of input.foodLog) {
    if (seenFood.has(f.id)) continue;
    seenFood.add(f.id);
    if (f.energyKcal > 0) events.push({ atMs: f.timestamp, kind: 'eat', kcal: f.energyKcal });
  }

  // intake_events also holds derived rows written only for the Excel export
  // (`workout_*` energy rows, `movement_*` steps). Those must NOT count: the
  // workout is already in activity_log and steps never drain satiety.
  const seenIntake = new Set<string>();
  for (const e of input.intakeEvents) {
    if (seenIntake.has(e.id)) continue;
    seenIntake.add(e.id);
    if (isManualCalorieIntake(e)) {
      if (e.amount > 0) events.push({ atMs: e.timestamp, kind: 'eat', kcal: e.amount });
    } else if (isManualQuickTapIntake(e)) {
      const kcal = kcalFromMacro(e.batteryTypeId, e.amount);
      if (kcal > 0) events.push({ atMs: e.timestamp, kind: 'eat', kcal });
    }
  }

  const seenActivity = new Set<string>();
  for (const a of input.activityLog) {
    if (seenActivity.has(a.id)) continue;
    seenActivity.add(a.id);
    if (a.satietyDrainKcal > 0) {
      const atMs = a.endAt != null ? Math.min(a.endAt, a.timestamp) : a.timestamp;
      events.push({ atMs, kind: 'workout', kcal: a.satietyDrainKcal });
    }
  }

  return events;
}

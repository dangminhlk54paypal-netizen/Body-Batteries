import { getDb } from '../db/database';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import { energyDayString } from '../../lib/dateUtils';

interface ActivityLogRow {
  id: string;
  timestamp: number;
  start_at: number | null;
  end_at: number | null;
  steps: number;
  workouts: string;
  energy_kcal: number;
  satiety_drain_kcal: number;
  energy_day_applied: string | null;
  movement_steps_applied: number | null;
}

function rowToEntry(r: ActivityLogRow): ActivityLogEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    startAt: r.start_at ?? undefined,
    endAt: r.end_at ?? undefined,
    steps: r.steps,
    workouts: JSON.parse(r.workouts) as WorkoutSession[],
    energyKcal: r.energy_kcal,
    satietyDrainKcal: r.satiety_drain_kcal,
    // Rows written before FIX #5 (or by installs pending the migration) have
    // no energy_day_applied — best-effort fallback: derive it from the
    // timestamp the same way logActivity would have at the time.
    energyDayApplied: r.energy_day_applied ?? energyDayString(new Date(r.timestamp)),
    // Rows written before the BUG A migration have no movement_steps_applied
    // — leave it undefined so consumers (energyStore.movementChargeOf) fall
    // back to `steps`, matching what those rows actually charged the pin.
    movementStepsApplied: r.movement_steps_applied ?? undefined,
  };
}

export async function addActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO activity_log
       (id, timestamp, start_at, end_at, steps, workouts, energy_kcal, satiety_drain_kcal, energy_day_applied, movement_steps_applied)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.timestamp,
    entry.startAt ?? null,
    entry.endAt ?? null,
    entry.steps,
    JSON.stringify(entry.workouts),
    entry.energyKcal,
    entry.satietyDrainKcal,
    entry.energyDayApplied,
    entry.movementStepsApplied ?? null
  );
}

// Entries "for a date" are grouped by when the activity actually happened
// (`startAt`) when known, falling back to the log timestamp otherwise — this
// keeps history/Excel views showing an activity under the day it really took
// place, mirroring getFoodLogForDate's calendar-day windowing.
//
// IMPORTANT: battery effects (energy goal growth, satiety drain, movement
// charge) are always applied at LOG time (see energyStore.logActivity — no
// replay engine, by design). So a backdated entry's battery impact lands on
// the day it was logged, not the day returned by this grouping. Callers that
// need "what changed today's battery" should filter by `timestamp`, not this
// date grouping (which is for history/Excel display only).
export async function getActivityLogForDate(date: string): Promise<ActivityLogEntry[]> {
  const db = getDb();
  const startMs = new Date(date + 'T00:00:00').getTime();
  const endMs = startMs + 86_400_000;
  const rows = await db.getAllAsync<ActivityLogRow>(
    `SELECT * FROM activity_log
     WHERE COALESCE(start_at, timestamp) >= ? AND COALESCE(start_at, timestamp) < ?
     ORDER BY COALESCE(start_at, timestamp) ASC`,
    startMs,
    endMs
  );
  return rows.map(rowToEntry);
}

// Same grouping rule as getActivityLogForDate, over an inclusive date range —
// for history browsing / weekly-monthly Excel export.
export async function getActivityLogInRange(
  fromDate: string,
  toDate: string
): Promise<ActivityLogEntry[]> {
  const db = getDb();
  const startMs = new Date(fromDate + 'T00:00:00').getTime();
  const endMs = new Date(toDate + 'T23:59:59').getTime();
  const rows = await db.getAllAsync<ActivityLogRow>(
    `SELECT * FROM activity_log
     WHERE COALESCE(start_at, timestamp) >= ? AND COALESCE(start_at, timestamp) <= ?
     ORDER BY COALESCE(start_at, timestamp) ASC`,
    startMs,
    endMs
  );
  return rows.map(rowToEntry);
}

// Unlike food_log (append-only), activity entries can be edited in place —
// used by callers that want to keep the same id/history position instead of
// the store's default remove+re-add strategy (see energyStore.updateActivity).
export async function updateActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE activity_log
     SET timestamp = ?, start_at = ?, end_at = ?, steps = ?, workouts = ?,
         energy_kcal = ?, satiety_drain_kcal = ?, energy_day_applied = ?, movement_steps_applied = ?
     WHERE id = ?`,
    entry.timestamp,
    entry.startAt ?? null,
    entry.endAt ?? null,
    entry.steps,
    JSON.stringify(entry.workouts),
    entry.energyKcal,
    entry.satietyDrainKcal,
    entry.energyDayApplied,
    entry.movementStepsApplied ?? null,
    entry.id
  );
}

export async function deleteActivityLogEntry(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM activity_log WHERE id = ?', id);
}

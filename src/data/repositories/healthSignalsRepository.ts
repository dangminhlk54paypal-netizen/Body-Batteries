import { getDb } from '../db/database';

export interface WeightEntry {
  id: number;
  timestamp: number;
  value: number;
}

const DEFAULT_WEIGHT_HISTORY_LIMIT = 10;

export async function logWeight(kg: number): Promise<void> {
  await logWeightAt(Date.now(), kg);
}

// A reading at a chosen moment — how a weight is logged for an earlier day
// (the Weight card's date field; see weighInTimestamp). Several readings on a
// day stay separate rows, exactly like logWeight.
export async function logWeightAt(timestamp: number, kg: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO health_signals (timestamp, source, type, value) VALUES (?, ?, ?, ?)`,
    timestamp,
    'manual',
    'weight_kg',
    kg
  );
}

// The weight the notebook page gives a day ("14.09(79.5kg): …"): that day's
// first manual reading takes the value, else one is added at `timestamp` —
// so applying the same page twice never logs the day twice.
export async function setWeightForDay(date: string, kg: number, timestamp: number): Promise<void> {
  await setFirstWeightInRange(date, date, kg, timestamp);
}

// The same for a whole week — the weight a week heading shows is the week's
// first reading ("07.09–13.09 80kg").
export async function setFirstWeightInRange(
  fromDate: string,
  toDate: string,
  kg: number,
  timestamp: number
): Promise<void> {
  const db = getDb();
  const startMs = new Date(fromDate + 'T00:00:00').getTime();
  const endMs = new Date(toDate + 'T23:59:59.999').getTime();
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM health_signals
     WHERE source = 'manual' AND type = 'weight_kg' AND timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC LIMIT 1`,
    startMs,
    endMs
  );
  if (existing) await updateWeight(existing.id, kg);
  else await logWeightAt(timestamp, kg);
}

export async function getWeightHistory(
  limit: number = DEFAULT_WEIGHT_HISTORY_LIMIT
): Promise<WeightEntry[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: number; timestamp: number; value: number }>(
    `SELECT id, timestamp, value FROM health_signals
     WHERE source = 'manual' AND type = 'weight_kg'
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit
  );
  return rows.map((r) => ({ id: r.id, timestamp: r.timestamp, value: r.value }));
}

// Manual weight readings on the calendar days [fromDate, toDate] (YYYY-MM-DD,
// inclusive), OLDEST first — the training log prints the day's/week's weight
// next to its lines, and reads a whole block of weeks in one query.
export async function getWeightsInRange(fromDate: string, toDate: string): Promise<WeightEntry[]> {
  const db = getDb();
  const startMs = new Date(fromDate + 'T00:00:00').getTime();
  const endMs = new Date(toDate + 'T23:59:59.999').getTime();
  const rows = await db.getAllAsync<{ id: number; timestamp: number; value: number }>(
    `SELECT id, timestamp, value FROM health_signals
     WHERE source = 'manual' AND type = 'weight_kg' AND timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC`,
    startMs,
    endMs
  );
  return rows.map((r) => ({ id: r.id, timestamp: r.timestamp, value: r.value }));
}

// Corrects a manually-logged weight entry in place (e.g. a mistyped value) —
// the row's own `timestamp`/day stays untouched, only `value` changes. Any
// reading can be corrected: a typo from weeks ago skews the strength chart's
// × body weight as much as yesterday's.
export async function updateWeight(id: number, kg: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE health_signals SET value = ? WHERE id = ? AND source = 'manual' AND type = 'weight_kg'`,
    kg,
    id
  );
}

// Removes a manually-logged weight reading (one logged by mistake).
export async function deleteWeight(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM health_signals WHERE id = ? AND source = 'manual' AND type = 'weight_kg'`, id);
}

// --- Apple Health burned-kcal sync (Phases 1-3) ---
// Reuses the generic `health_signals` table (source/type/value columns
// already exist — no migration needed): source='apple_health',
// type='total_burned:<syncDate>' (the calendar day the reading belongs to is
// folded into `type` since there's no dedicated date column), value=kcal.
// Callers pass `syncDate` as a "YYYY-MM-DD" string (see lib/dateUtils
// .dateString) — this repository stays DB-only and doesn't compute it.

// Persists one synced total-burned kcal reading for `syncDate`. Stored as a
// single 'total_burned' row (active+resting already summed by the caller via
// calculateTotalBurned) — the per-source active/resting breakdown is
// display-only and not needed for the day lookup below, so it isn't
// separately persisted to avoid extra rows/complexity.
export async function logAppleHealthBurned(
  kcal: number,
  timestamp: number,
  syncDate: string
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO health_signals (timestamp, source, type, value) VALUES (?, ?, ?, ?)`,
    timestamp,
    'apple_health',
    `total_burned:${syncDate}`,
    kcal
  );
}

// Most recent synced total-burned kcal for `date` (a "YYYY-MM-DD" calendar
// day), or null if nothing has been synced for it yet.
export async function getAppleHealthBurnedForDate(date: string): Promise<number | null> {
  const db = getDb();
  const row = await db.getAllAsync<{ value: number }>(
    `SELECT value FROM health_signals
     WHERE source = 'apple_health' AND type = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    `total_burned:${date}`
  );
  return row.length > 0 ? row[0].value : null;
}

// Most recent synced total-burned kcal per calendar day within [fromDate,
// toDate], keyed by date. Fetches every matching row ordered oldest-first and
// lets a later timestamp overwrite an earlier one for the same date in the
// Map, so a day re-synced multiple times resolves to its latest value —
// same "most recent wins" rule as getAppleHealthBurnedForDate's single-day
// query, just batched for a whole export range instead of one query per day.
export async function getAppleHealthBurnedInRange(
  fromDate: string,
  toDate: string
): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db.getAllAsync<{ date: string; value: number }>(
    `SELECT SUBSTR(type, 14) AS date, value FROM health_signals
     WHERE source = 'apple_health' AND type LIKE 'total_burned:%'
       AND SUBSTR(type, 14) >= ? AND SUBSTR(type, 14) <= ?
     ORDER BY timestamp ASC`,
    fromDate,
    toDate
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, r.value);
  return map;
}

// When did the last sync attempt of a given outcome ('synced' = real
// HealthKit data, 'estimated' = fell back to the BMR estimate) happen — used
// by the store's 2-hour cache check. Stored as its own 'sync_event' row
// (value = 1, a placeholder — only the timestamp/type matter).
export async function recordSyncTimestamp(status: 'synced' | 'estimated'): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO health_signals (timestamp, source, type, value) VALUES (?, ?, ?, ?)`,
    Date.now(),
    'apple_health',
    `sync_event:${status}`,
    1
  );
}

// Most recent sync attempt timestamp (either outcome), or null if never
// synced. Used to decide whether the 2-hour cache window has elapsed.
export async function getLastSyncTimestamp(): Promise<number | null> {
  const db = getDb();
  const rows = await db.getAllAsync<{ timestamp: number }>(
    `SELECT timestamp FROM health_signals
     WHERE source = 'apple_health' AND type LIKE 'sync_event:%'
     ORDER BY timestamp DESC
     LIMIT 1`
  );
  return rows.length > 0 ? rows[0].timestamp : null;
}

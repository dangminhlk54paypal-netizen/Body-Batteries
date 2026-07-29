import { getDb } from '../db/database';

export interface WeightEntry {
  id: number;
  timestamp: number;
  value: number;
}

const DEFAULT_WEIGHT_HISTORY_LIMIT = 10;

export async function logWeight(kg: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO health_signals (timestamp, source, type, value) VALUES (?, ?, ?, ?)`,
    Date.now(),
    'manual',
    'weight_kg',
    kg
  );
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

// Corrects a manually-logged weight entry in place (e.g. a mistyped value) —
// the row's own `timestamp`/day stays untouched, only `value` changes.
// Callers (WeightLogCard) restrict this to entries within the last few days
// (WEIGHT_EDIT_MAX_DAYS_BACK) so older history stays an untouched record.
export async function updateWeight(id: number, kg: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE health_signals SET value = ? WHERE id = ? AND source = 'manual' AND type = 'weight_kg'`,
    kg,
    id
  );
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

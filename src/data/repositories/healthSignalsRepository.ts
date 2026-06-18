import { getDb } from '../db/database';

export interface WeightEntry {
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
  const rows = await db.getAllAsync<{ timestamp: number; value: number }>(
    `SELECT timestamp, value FROM health_signals
     WHERE source = 'manual' AND type = 'weight_kg'
     ORDER BY timestamp DESC
     LIMIT ?`,
    limit
  );
  return rows.map((r) => ({ timestamp: r.timestamp, value: r.value }));
}

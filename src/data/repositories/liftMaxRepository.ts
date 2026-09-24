import { getDb } from '../db/database';
import { cleanText, rowToLiftMax } from './trainingLogMapper';
import type { LiftMaxRow } from './trainingLogMapper';
import type { LiftMaxRecord } from '../../types/trainingLog';

// The user's recorded one-rep maxes (⭐ on the strength chart). Callers go
// through trainingLogStore so the chart reloads after every write.

// Oldest first — the order they are drawn and exported in.
export async function listLiftMaxes(): Promise<LiftMaxRecord[]> {
  const db = getDb();
  const rows = await db.getAllAsync<LiftMaxRow>('SELECT * FROM lift_maxes ORDER BY date ASC, created_at ASC');
  return rows.map(rowToLiftMax).filter((r): r is LiftMaxRecord => r != null);
}

export async function insertLiftMax(rec: LiftMaxRecord): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO lift_maxes (id, lift, weight_kg, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    rec.id,
    rec.lift,
    rec.weightKg,
    rec.date,
    cleanText(rec.note),
    rec.createdAt
  );
}

export async function deleteLiftMax(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM lift_maxes WHERE id = ?', id);
}

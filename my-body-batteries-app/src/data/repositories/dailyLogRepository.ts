import { getDb } from '../db/database';
import type { DailyLog } from '../../types/battery';
import type { ModeId } from '../../types/modes';

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ date: string; mode_id: string }>(
    'SELECT * FROM daily_log WHERE date = ?',
    date
  );
  if (!row) return null;
  return { date: row.date, modeId: row.mode_id as ModeId };
}

export async function upsertDailyLog(log: DailyLog): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO daily_log (date, mode_id) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET mode_id = excluded.mode_id`,
    log.date,
    log.modeId
  );
}

export async function getLogsInRange(fromDate: string, toDate: string): Promise<DailyLog[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ date: string; mode_id: string }>(
    'SELECT * FROM daily_log WHERE date >= ? AND date <= ? ORDER BY date ASC',
    fromDate,
    toDate
  );
  return rows.map((r) => ({ date: r.date, modeId: r.mode_id as ModeId }));
}

export async function deleteLogsBefore(date: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM daily_log WHERE date < ?', date);
}

export async function saveDiaryEntry(date: string, encryptedContent: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO diary_entries (date, encrypted_content) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET encrypted_content = excluded.encrypted_content`,
    date,
    encryptedContent
  );
}

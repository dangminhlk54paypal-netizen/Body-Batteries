import { getDb } from '../db/database';
import {
  cleanText,
  isEmptyDayRecord,
  isEmptyWeekRecord,
  rowToDayRecord,
  rowToWeekRecord,
} from './trainingLogMapper';
import type { TrainingLogDayRow, TrainingLogWeekRow } from './trainingLogMapper';
import type { TrainingLogDayRecord, TrainingLogWeekRecord } from '../../types/trainingLog';

// The user's own additions to the training log (hand-written lines, edits,
// notes). Everything auto-generated lives in activity_log, not here.

export async function getTrainingLogDay(date: string): Promise<TrainingLogDayRecord | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TrainingLogDayRow>(
    'SELECT * FROM training_log_days WHERE date = ?',
    date
  );
  return row ? rowToDayRecord(row) : null;
}

// Inclusive date range, ascending.
export async function getTrainingLogDaysInRange(
  fromDate: string,
  toDate: string
): Promise<TrainingLogDayRecord[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TrainingLogDayRow>(
    'SELECT * FROM training_log_days WHERE date >= ? AND date <= ? ORDER BY date ASC',
    fromDate,
    toDate
  );
  return rows.map(rowToDayRecord);
}

// Every day the user has a line or note for — the index's "days that exist
// without a Xả entry".
export async function listTrainingLogDates(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM training_log_days ORDER BY date ASC'
  );
  return rows.map((r) => r.date);
}

// Latest day strictly before `date` that has a hand-written / overridden line
// (feeds the editor's "copy latest session").
export async function getLatestTrainingLogDayBefore(
  date: string
): Promise<TrainingLogDayRecord | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TrainingLogDayRow>(
    `SELECT * FROM training_log_days
     WHERE date < ? AND override_text IS NOT NULL AND TRIM(override_text) != ''
     ORDER BY date DESC LIMIT 1`,
    date
  );
  return row ? rowToDayRecord(row) : null;
}

// Writes the record — or deletes the row when it has neither a line nor a
// note (a day with nothing in it is "untouched", not an empty row).
export async function upsertTrainingLogDay(rec: TrainingLogDayRecord): Promise<void> {
  const db = getDb();
  if (isEmptyDayRecord(rec)) {
    await db.runAsync('DELETE FROM training_log_days WHERE date = ?', rec.date);
    return;
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO training_log_days
       (date, override_text, note, source_signature, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    rec.date,
    cleanText(rec.overrideText),
    cleanText(rec.note),
    // A signature only means something next to a line.
    cleanText(rec.overrideText) == null ? null : rec.sourceSignature,
    rec.updatedAt
  );
}

export async function deleteTrainingLogDay(date: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM training_log_days WHERE date = ?', date);
}

export async function getTrainingLogWeek(weekStart: string): Promise<TrainingLogWeekRecord | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TrainingLogWeekRow>(
    'SELECT * FROM training_log_weeks WHERE week_start = ?',
    weekStart
  );
  return row ? rowToWeekRecord(row) : null;
}

// Inclusive range of week-start Mondays, ascending.
export async function getTrainingLogWeeksInRange(
  fromWeekStart: string,
  toWeekStart: string
): Promise<TrainingLogWeekRecord[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TrainingLogWeekRow>(
    'SELECT * FROM training_log_weeks WHERE week_start >= ? AND week_start <= ? ORDER BY week_start ASC',
    fromWeekStart,
    toWeekStart
  );
  return rows.map(rowToWeekRecord);
}

export async function listTrainingLogWeekStarts(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ week_start: string }>(
    'SELECT week_start FROM training_log_weeks ORDER BY week_start ASC'
  );
  return rows.map((r) => r.week_start);
}

export async function upsertTrainingLogWeek(rec: TrainingLogWeekRecord): Promise<void> {
  const db = getDb();
  if (isEmptyWeekRecord(rec)) {
    await db.runAsync('DELETE FROM training_log_weeks WHERE week_start = ?', rec.weekStart);
    return;
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO training_log_weeks (week_start, note, updated_at) VALUES (?, ?, ?)',
    rec.weekStart,
    cleanText(rec.note),
    rec.updatedAt
  );
}

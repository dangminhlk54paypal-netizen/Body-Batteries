import { dateString } from '../../lib/dateUtils';
import type { TrainingLogDayRecord, TrainingLogWeekRecord } from '../../types/trainingLog';

// Pure row <-> record mapping for the training-log tables (see
// src/data/db/schema.ts) plus the small pure rules the repositories share —
// kept out of the repository files so they can be unit tested without SQLite,
// like customFoodMapper / trainingBlockMapper.

export interface TrainingLogDayRow {
  date: string;
  override_text: string | null;
  note: string | null;
  source_signature: string | null;
  updated_at: number;
}

export interface TrainingLogWeekRow {
  week_start: string;
  note: string | null;
  updated_at: number;
}

export function rowToDayRecord(r: TrainingLogDayRow): TrainingLogDayRecord {
  return {
    date: r.date,
    overrideText: r.override_text,
    note: r.note,
    sourceSignature: r.source_signature,
    updatedAt: r.updated_at,
  };
}

export function rowToWeekRecord(r: TrainingLogWeekRow): TrainingLogWeekRecord {
  return { weekStart: r.week_start, note: r.note, updatedAt: r.updated_at };
}

// Blank (null / whitespace) counts as "nothing there".
export function isBlank(text: string | null | undefined): boolean {
  return text == null || text.trim() === '';
}

// A day row with neither a line nor a note carries no information: the
// repository deletes it instead of storing it, so "no row" is the only way a
// day is "untouched" (listTrainingLogDates would otherwise list ghosts).
export function isEmptyDayRecord(rec: Pick<TrainingLogDayRecord, 'overrideText' | 'note'>): boolean {
  return isBlank(rec.overrideText) && isBlank(rec.note);
}

export function isEmptyWeekRecord(rec: Pick<TrainingLogWeekRecord, 'note'>): boolean {
  return isBlank(rec.note);
}

// Trailing/leading whitespace is never meaningful in a line or note; store
// null for "nothing" so the two columns have one empty representation.
export function cleanText(text: string | null | undefined): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

// Groups raw entry timestamps (COALESCE(start_at, timestamp) of every
// activity_log row that has workouts) into calendar days, ascending. The day
// is computed in JS with the same dateString() the rest of the app uses (not
// SQLite's date(..., 'localtime')), so it can never disagree with History.
export function countSessionsByDay(timestamps: number[]): { date: string; sessions: number }[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const date = dateString(new Date(ts));
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts]
    .map(([date, sessions]) => ({ date, sessions }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

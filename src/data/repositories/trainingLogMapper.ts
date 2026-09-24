import { dateString } from '../../lib/dateUtils';
import type { LiftMaxRecord, TrainingLogDayRecord, TrainingLogWeekRecord } from '../../types/trainingLog';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise } from '../../types/energy';

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
  label?: string | null; // column added later — absent on rows read before the ALTER
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

export interface LiftMaxRow {
  id: string;
  lift: string;
  weight_kg: number;
  date: string;
  note: string | null;
  created_at: number;
}

// null for a row whose lift is not one the app knows (never written by the
// app, but the column is plain TEXT).
export function rowToLiftMax(r: LiftMaxRow): LiftMaxRecord | null {
  if (!LIFTING_EXERCISES.includes(r.lift as LiftingExercise)) return null;
  return {
    id: r.id,
    lift: r.lift as LiftingExercise,
    weightKg: r.weight_kg,
    date: r.date,
    note: r.note,
    createdAt: r.created_at,
  };
}

export function rowToWeekRecord(r: TrainingLogWeekRow): TrainingLogWeekRecord {
  return { weekStart: r.week_start, note: r.note, label: r.label ?? null, updatedAt: r.updated_at };
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

export function isEmptyWeekRecord(rec: Pick<TrainingLogWeekRecord, 'note' | 'label'>): boolean {
  return isBlank(rec.note) && isBlank(rec.label);
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

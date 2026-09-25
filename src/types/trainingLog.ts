import type { LiftingExercise } from './energy';

// Types for the "Sổ tập luyện" (training log): a Notes-style notebook derived
// from activity_log, plus the few things only the user can add (hand-written
// lines, notes). See .ai/plans/2026-09-23-training-log-notebook.md.

// How a day line is rendered. Persisted in settingsStore.trainingLogFormat;
// always read through `{ ...DEFAULT_TRAINING_LOG_FORMAT, ...stored }` because
// the persist middleware has no version/migrate, so a device that saved an
// older shape must still get defaults for options added later.
export interface TrainingLogFormat {
  // 'short' = the user's own shorthand ("PS", "iC"); 'full' = full names.
  labelStyle: 'short' | 'full';
  // 'dot' = always 72.5 (matches the user's Notes); 'locale' = follow the
  // app language (72,5 in vi/de).
  decimal: 'dot' | 'locale';
  showWarmups: boolean;
  // The prime — the heaviest warm-up set — written in front of the working
  // sets: "B 95 + 4x6x72.5" (drawn italic). Ignored while showWarmups prints
  // the whole ramp anyway.
  showPrime: boolean;
  showUnit: boolean;
  showBodyWeight: boolean;
  showWeekday: boolean;
  showKcal: boolean;
  // Per-key overrides of the default abbreviations. Keys: `lift:<exercise>`,
  // `var:<variationId>`, `cvar:<free-text variation name>`, `bb:<bbExerciseId>`.
  // An empty string means "no override".
  abbreviations: Record<string, string>;
}

export const DEFAULT_TRAINING_LOG_FORMAT: TrainingLogFormat = {
  labelStyle: 'short',
  decimal: 'dot',
  showWarmups: false,
  showPrime: true,
  showUnit: false,
  showBodyWeight: true,
  showWeekday: false,
  showKcal: false,
  abbreviations: {},
};

// Merges whatever is persisted over the defaults. The persist middleware has
// no version/migrate and its default merge is shallow, so a device that saved
// the format before an option existed would otherwise read it as undefined.
export function resolveTrainingLogFormat(stored?: Partial<TrainingLogFormat> | null): TrainingLogFormat {
  return {
    ...DEFAULT_TRAINING_LOG_FORMAT,
    ...stored,
    abbreviations: { ...DEFAULT_TRAINING_LOG_FORMAT.abbreviations, ...(stored?.abbreviations ?? {}) },
  };
}

// One row of training_log_days. A day exists only when the user touched it.
// `overrideText` null = show the auto-generated line. With a value it is the
// line's body (the part after "26.08(77.7kg):"). `sourceSignature` null +
// `overrideText` set = a HAND-WRITTEN line (no Xả entry was ever behind it);
// with a signature it is an edit of an auto line, and the signature is what
// the auto line looked like when the user edited it (conflict detection).
export interface TrainingLogDayRecord {
  date: string; // YYYY-MM-DD, calendar day (same grouping rule as activity_log)
  overrideText: string | null;
  note: string | null; // free-text lines shown under the day
  sourceSignature: string | null;
  updatedAt: number;
}

export interface TrainingLogWeekRecord {
  weekStart: string; // Monday, YYYY-MM-DD
  note: string | null;
  // The user's own name for the week ("B3W3", "Deload") typed in front of the
  // dates on the 📄 page. Replaces the default label in the heading; null /
  // absent = the default ("B2W1" in a block, just the dates in a free week).
  label?: string | null;
  updatedAt: number;
}

// One row of training_log_months: the user's own name for a free-training
// month ("Power Lifting") shown instead of "Tập tự do · tháng 9 năm 2026".
export interface TrainingLogMonthRecord {
  monthKey: string; // YYYY-MM
  name: string;
}

export type DayConflict = 'none' | 'sourceChanged' | 'xaAddedToManual' | 'sourceGone';

// --- Index (month → week → day) ------------------------------------------
// Data only; every label is built by the UI with t() (see trainingLogIndex.ts).

// The block plan a week belongs to. Blocks do not group the notebook — months
// do; a block only labels its weeks ("B3W2") and is summed up under the month.
export interface TrainingLogWeekBlock {
  id: string;
  number: number; // the user's own block number, else creation order
  name?: string; // user-chosen title
}

export interface TrainingLogWeek {
  weekStart: string; // Monday (block weeks: the block week's own start)
  weekEnd: string; // Sunday
  block?: TrainingLogWeekBlock; // set = a week of a block plan
  weekNumber?: number; // block weeks only (1-based; deload is the last number)
  isDeload?: boolean;
  sessions: number;
  dates: string[]; // content days of this week, ascending
  customLabel?: string; // the user's label (TrainingLogWeekRecord.label)
}

// A block's part of one month: "Block 3 · W1–W4".
export interface TrainingLogPeriodBlock extends TrainingLogWeekBlock {
  firstWeek: number;
  lastWeek: number;
  lastIsDeload: boolean;
}

// One calendar month of the notebook (weeks by the month of their start).
export interface TrainingLogPeriod {
  key: string; // `month:<YYYY-MM>`
  monthKey: string; // YYYY-MM
  monthName?: string; // user-chosen name; absent = "Tháng 9 năm 2026"
  blocks: TrainingLogPeriodBlock[]; // block plans with weeks in this month, in order
  startDate: string;
  endDate: string;
  sessions: number;
  weeks: TrainingLogWeek[]; // ascending — read like a notebook
}

// One row of lift_maxes: a one-rep max the user hit on a day ("S 180 kg on
// 12.08"). Shown as a star on the strength chart — a milestone, not part of
// the weekly training line — and listed in the Excel export.
export interface LiftMaxRecord {
  id: string;
  lift: LiftingExercise;
  weightKg: number;
  date: string; // YYYY-MM-DD
  note: string | null;
  createdAt: number;
}

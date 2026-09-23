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
  updatedAt: number;
}

export type DayConflict = 'none' | 'sourceChanged' | 'xaAddedToManual' | 'sourceGone';

// --- Index (block → week → day) ------------------------------------------
// Data only; every label is built by the UI with t() (see trainingLogIndex.ts).

export interface TrainingLogWeek {
  weekStart: string; // Monday (block weeks: the block week's own start)
  weekEnd: string; // Sunday
  weekNumber?: number; // block weeks only (1-based; deload is the last number)
  isDeload?: boolean;
  sessions: number;
  dates: string[]; // content days of this week, ascending
}

export interface TrainingLogPeriod {
  key: string; // `block:<id>` | `free:<YYYY-MM>`
  kind: 'block' | 'free';
  blockId?: string;
  blockNumber?: number; // 1-based by createdAt among the blocks that still exist
  blockName?: string; // user-chosen name; absent = "Block <n>"
  focus?: string; // TrainingFocus, for the subtitle
  monthKey?: string; // free periods: YYYY-MM of the Monday that starts the week
  startDate: string;
  endDate: string;
  sessions: number;
  weeks: TrainingLogWeek[]; // ascending — read like a notebook
}

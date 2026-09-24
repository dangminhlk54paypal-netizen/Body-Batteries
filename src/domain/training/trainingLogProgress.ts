import { addDaysToDateString, dateString, mondayOfWeek } from '../../lib/dateUtils';
import type { Language } from '../../i18n/types';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { ActivityLogEntry, LiftingExercise, LiftingSet } from '../../types/energy';
import type { TrainingLogDayRecord, TrainingLogFormat } from '../../types/trainingLog';
import { identityOfWorkout, isStandardIdentity, parseDayBody } from './trainingLogParser';
import { firstWeightInRange } from './trainingLogWeights';
import type { WeightPoint } from './trainingLogWeights';

// Week-by-week strength progress for the chart under the notebook: the
// heaviest working set of each competition lift (S / B / D, variations such as
// paused squat left out so a lighter technique day never reads as a drop),
// next to the body weight of that week, so the UI can plot kg or kg ÷ body
// weight. Reads the same two sources the notebook shows: Xả sessions, and the
// user's own line for a day (hand-written or edited) — that line wins, because
// it is what the notebook says happened. Pure: no store, no clock.

export interface LiftProgressWeek {
  weekStart: string; // Monday
  weekEnd: string;
  bodyWeightKg: number | null; // first weigh-in that week, else the latest before it, else the fallback
  top: Partial<Record<LiftingExercise, number>>;
}

function heaviestWorking(sets: { kind: LiftingSet['kind']; weightKg: number; reps: number }[]): number | null {
  let top: number | null = null;
  for (const s of sets) {
    if (s.kind !== 'working' || s.reps < 1) continue;
    if (top == null || s.weightKg > top) top = s.weightKg;
  }
  return top;
}

function latestOnOrBefore(date: string, weights: WeightPoint[]): number | null {
  let best: WeightPoint | null = null;
  for (const w of weights) {
    if (dateString(new Date(w.timestamp)) > date) continue;
    if (!best || w.timestamp > best.timestamp) best = w;
  }
  return best ? best.value : null;
}

export function buildLiftProgress(input: {
  entries: ActivityLogEntry[];
  dayRecords: TrainingLogDayRecord[];
  weights: WeightPoint[]; // may start before the range, for the carry-forward
  // Used when no weigh-in exists on or before a week (the profile's weight).
  fallbackBodyWeightKg?: number | null;
  format: TrainingLogFormat;
  language: Language;
}): LiftProgressWeek[] {
  const { entries, dayRecords, weights, fallbackBodyWeightKg, format, language } = input;

  const entriesByDate = new Map<string, ActivityLogEntry[]>();
  for (const e of entries) {
    const date = dateString(new Date(e.startAt ?? e.timestamp));
    entriesByDate.set(date, [...(entriesByDate.get(date) ?? []), e]);
  }
  const overrides = new Map(
    dayRecords.filter((r) => r.overrideText != null && r.overrideText.trim() !== '').map((r) => [r.date, r.overrideText!])
  );

  const weeks = new Map<string, LiftProgressWeek>();
  const record = (date: string, exercise: LiftingExercise, kg: number | null) => {
    if (kg == null) return;
    const monday = mondayOfWeek(date);
    let week = weeks.get(monday);
    if (!week) {
      week = { weekStart: monday, weekEnd: addDaysToDateString(monday, 6), bodyWeightKg: null, top: {} };
      weeks.set(monday, week);
    }
    const prev = week.top[exercise];
    if (prev == null || kg > prev) week.top[exercise] = kg;
  };

  const dates = new Set([...entriesByDate.keys(), ...overrides.keys()]);
  for (const date of dates) {
    const dayEntries = entriesByDate.get(date) ?? [];
    const override = overrides.get(date);
    if (override != null) {
      const known = dayEntries.flatMap((e) => e.workouts);
      for (const m of parseDayBody(override, { format, language, known }).movements) {
        if (m.identity && isStandardIdentity(m.identity)) record(date, m.identity.exercise, heaviestWorking(m.sets));
      }
      continue;
    }
    for (const e of dayEntries) {
      for (const w of e.workouts) {
        const identity = identityOfWorkout(w);
        if (identity && isStandardIdentity(identity) && w.sets) {
          record(date, identity.exercise, heaviestWorking(w.sets));
        }
      }
    }
  }

  const out = [...weeks.values()]
    .filter((w) => LIFTING_EXERCISES.some((ex) => w.top[ex] != null))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const w of out) {
    w.bodyWeightKg =
      firstWeightInRange(w.weekStart, w.weekEnd, weights) ??
      latestOnOrBefore(w.weekEnd, weights) ??
      (fallbackBodyWeightKg && fallbackBodyWeightKg > 0 ? fallbackBodyWeightKg : null);
  }
  return out;
}

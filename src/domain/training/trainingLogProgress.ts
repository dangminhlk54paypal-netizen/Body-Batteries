import { addDaysToDateString, dateString, mondayOfWeek } from '../../lib/dateUtils';
import type { Language } from '../../i18n/types';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { ActivityLogEntry, LiftingExercise, LiftingSet } from '../../types/energy';
import type { TrainingLogDayRecord, TrainingLogFormat } from '../../types/trainingLog';
import { identityOfWorkout, isStandardIdentity, parseDayBody } from './trainingLogParser';
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
  bodyWeightKg: number | null; // see weekBodyWeight
  bodyWeightSource: BodyWeightSource | null;
  top: Partial<Record<LiftingExercise, number>>;
}

// Where a week's body weight came from — the chart says so, because a ratio
// is only as right as the weight under it:
//   measured     — the average of that week's weigh-ins
//   interpolated — no weigh-in that week: on the straight line between the
//                  last reading before and the first after (a lifter cutting
//                  80 → 76 kg over two months is ~78 kg halfway, not 80)
//   carried      — after the latest weigh-in: that reading
//   earliest     — before the first weigh-in: that first reading, the closest
//                  real number there is (only a guess — the chart says so)
//   profile      — no weigh-in at all: the profile's weight
export type BodyWeightSource = 'measured' | 'interpolated' | 'carried' | 'earliest' | 'profile';

function heaviestWorking(sets: { kind: LiftingSet['kind']; weightKg: number; reps: number }[]): number | null {
  let top: number | null = null;
  for (const s of sets) {
    if (s.kind !== 'working' || s.reps < 1) continue;
    if (top == null || s.weightKg > top) top = s.weightKg;
  }
  return top;
}

const dayOf = (w: WeightPoint) => dateString(new Date(w.timestamp));

// The body weight the week starting `monday` is measured against (see
// BodyWeightSource), or null with no weigh-in and no usable fallback.
export function weekBodyWeight(
  monday: string,
  weights: WeightPoint[],
  fallbackBodyWeightKg?: number | null
): { kg: number; source: BodyWeightSource } | null {
  const sunday = addDaysToDateString(monday, 6);
  const sorted = [...weights].filter((w) => w.value > 0).sort((a, b) => a.timestamp - b.timestamp);
  const inWeek = sorted.filter((w) => dayOf(w) >= monday && dayOf(w) <= sunday);
  if (inWeek.length > 0) {
    return { kg: inWeek.reduce((sum, w) => sum + w.value, 0) / inWeek.length, source: 'measured' };
  }
  const before = sorted.filter((w) => dayOf(w) < monday).pop();
  const after = sorted.find((w) => dayOf(w) > sunday);
  if (before && after) {
    // At the middle of the week (Thursday noon).
    const mid = new Date(`${addDaysToDateString(monday, 3)}T12:00:00`).getTime();
    const f = (mid - before.timestamp) / (after.timestamp - before.timestamp);
    return { kg: before.value + f * (after.value - before.value), source: 'interpolated' };
  }
  if (before) return { kg: before.value, source: 'carried' };
  if (after) return { kg: after.value, source: 'earliest' };
  if (fallbackBodyWeightKg && fallbackBodyWeightKg > 0) return { kg: fallbackBodyWeightKg, source: 'profile' };
  return null;
}

// The body weight a day is measured against: its week's (weekBodyWeight), so
// a ⭐ and a dot on the same week share one ratio.
export function bodyWeightOn(
  date: string,
  weights: WeightPoint[],
  fallbackBodyWeightKg?: number | null
): number | null {
  return weekBodyWeight(mondayOfWeek(date), weights, fallbackBodyWeightKg)?.kg ?? null;
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
      week = { weekStart: monday, weekEnd: addDaysToDateString(monday, 6), bodyWeightKg: null, bodyWeightSource: null, top: {} };
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
    const bw = weekBodyWeight(w.weekStart, weights, fallbackBodyWeightKg);
    w.bodyWeightKg = bw?.kg ?? null;
    w.bodyWeightSource = bw?.source ?? null;
  }
  return out;
}

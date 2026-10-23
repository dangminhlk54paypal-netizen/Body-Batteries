import { bestEstimatedMax } from '../training/trainingLogProgress';
import { findVariation, variationsForExercise } from '../../lib/powerliftingVariations';
import { isBodybuildingEntry, isLiftingEntry } from '../../lib/activityLabels';
import { dateString, daysBetween, mondayOfWeek } from '../../lib/dateUtils';
import { mergeSameWeekday } from './blockSchedule';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { ActivityLogEntry, LiftingExercise } from '../../types/energy';
import type { LiftMaxRecord } from '../../types/trainingLog';
import type { BlockDayPlan, BlockDayVariation } from '../../types/powerliftingBlock';

// "Tạo tự động": a starting block setup read from what the lifter actually
// did lately — which weekdays they train, which lifts/variations on each, and
// a 1RM per lift. Only a suggestion: the wizard fills its steps with it and
// the user changes anything before (or after) creating the block.

// How far back the habits are read (also what the wizard loads).
export const HISTORY_LOOKBACK_DAYS = 42;
// A recorded 1RM older than this no longer says much about today's strength.
const RECORD_MAX_AGE_DAYS = 84;
// A weekday counts as a habit when trained in at least this share of the
// weeks that had any session, and at least twice.
const WEEKDAY_SHARE = 0.4;
const MIN_WEEKDAY_SESSIONS = 2;
// A variation joins a day's template when done in at least half of that
// weekday's sessions; at most this many per day (the main lift first).
const VARIATION_SHARE = 0.5;
const MAX_VARIATIONS_PER_DAY = 3;

export type OneRepMaxSource = 'record' | 'estimate';

export interface HistoryBlockSetup {
  sessions: number; // lifting sessions read
  weeks: number; // calendar weeks they spread over
  schedule: BlockDayPlan[];
  oneRepMax: Partial<Record<LiftingExercise, { kg: number; source: OneRepMaxSource }>>;
}

type Weekday = BlockDayPlan['dayOfWeek'];

function standardVariationId(exercise: LiftingExercise): string {
  return variationsForExercise(exercise).find((v) => v.loadFactor === 1)!.id;
}

// The catalog variation a logged workout was; a free-text variation (the
// user's own name) has no catalog entry and is left out of the template.
function variationOf(w: { type: string; variationId?: string; variationName?: string }): BlockDayVariation | null {
  if (!LIFTING_EXERCISES.includes(w.type as LiftingExercise)) return null;
  const exercise = w.type as LiftingExercise;
  if (w.variationName) return null;
  const id = w.variationId && findVariation(w.variationId)?.exercise === exercise ? w.variationId : standardVariationId(exercise);
  return { exercise, variationId: id, role: 'secondary' };
}

const keyOf = (v: BlockDayVariation) => v.variationId;
const roundDown = (kg: number) => Math.floor(kg / 2.5) * 2.5;

export function inferBlockSetup(input: {
  entries: ActivityLogEntry[];
  liftMaxes: LiftMaxRecord[];
  today: string; // YYYY-MM-DD
}): HistoryBlockSetup | null {
  const sessions = input.entries.filter((e) => !isBodybuildingEntry(e) && isLiftingEntry(e));
  if (sessions.length === 0) return null;

  // --- Schedule -------------------------------------------------------------
  const byWeekday = new Map<Weekday, ActivityLogEntry[]>();
  const weeks = new Set<string>(); // Mondays
  for (const e of sessions) {
    const d = new Date(e.timestamp);
    const dow = d.getDay() as Weekday;
    weeks.add(mondayOfWeek(dateString(d)));
    byWeekday.set(dow, [...(byWeekday.get(dow) ?? []), e]);
  }
  const needed = Math.max(MIN_WEEKDAY_SESSIONS, Math.ceil(weeks.size * WEEKDAY_SHARE));
  let habitDays = [...byWeekday.keys()].filter((dow) => byWeekday.get(dow)!.length >= needed);
  // Too little history for a pattern: every weekday trained at all.
  if (habitDays.length === 0) habitDays = [...byWeekday.keys()];

  const schedule: BlockDayPlan[] = habitDays.map((dow) => {
    const daySessions = byWeekday.get(dow)!;
    const counts = new Map<string, { v: BlockDayVariation; n: number; firsts: number }>();
    for (const e of daySessions) {
      const seen = new Set<string>();
      e.workouts.forEach((w) => {
        const v = variationOf(w);
        if (!v || seen.has(keyOf(v))) return;
        const first = seen.size === 0;
        seen.add(keyOf(v));
        const cur = counts.get(keyOf(v)) ?? { v, n: 0, firsts: 0 };
        counts.set(keyOf(v), { v, n: cur.n + 1, firsts: cur.firsts + (first ? 1 : 0) });
      });
    }
    const ranked = [...counts.values()]
      .filter((c) => c.n >= daySessions.length * VARIATION_SHARE)
      .sort((a, b) => b.firsts - a.firsts || b.n - a.n)
      .slice(0, MAX_VARIATIONS_PER_DAY);
    // The lift usually done first that day is its main one.
    const variations = ranked.map((c, i) => ({ ...c.v, role: i === 0 ? ('main' as const) : ('secondary' as const) }));
    return { dayOfWeek: dow, variations, accessories: [] };
  });

  // --- 1RM ------------------------------------------------------------------
  const oneRepMax: HistoryBlockSetup['oneRepMax'] = {};
  for (const exercise of LIFTING_EXERCISES) {
    // Estimate from the straight lift; a variation's best scaled back up by
    // its load factor only when the straight lift was never done.
    let straight: number | null = null;
    let scaled: number | null = null;
    for (const e of sessions) {
      for (const w of e.workouts) {
        if (w.type !== exercise || !w.sets || w.variationName) continue;
        const best = bestEstimatedMax(w.sets);
        if (best == null) continue;
        const factor = (w.variationId && findVariation(w.variationId)?.loadFactor) || 1;
        if (factor === 1) straight = Math.max(straight ?? 0, best);
        else scaled = Math.max(scaled ?? 0, best / factor);
      }
    }
    const estimate = straight ?? scaled;
    const record = input.liftMaxes
      .filter((m) => m.lift === exercise && daysBetween(m.date, input.today) <= RECORD_MAX_AGE_DAYS)
      .reduce<LiftMaxRecord | null>((top, m) => (!top || m.weightKg > top.weightKg ? m : top), null);
    if (record && (estimate == null || record.weightKg >= estimate)) {
      oneRepMax[exercise] = { kg: record.weightKg, source: 'record' };
    } else if (estimate != null) {
      oneRepMax[exercise] = { kg: roundDown(estimate), source: 'estimate' };
    }
  }

  return {
    sessions: sessions.length,
    weeks: weeks.size,
    schedule: mergeSameWeekday(schedule.filter((d) => d.variations.length > 0)),
    oneRepMax,
  };
}

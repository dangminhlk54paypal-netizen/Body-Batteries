import { addDaysToDateString, daysBetween } from '../../lib/dateUtils';
import { estimateLiftingMinutes, liftingSessionKcal } from './liftingEngine';
import { generateBlockPlan, resolveOneRepMax } from './blockEngine';
import { findVariation } from '../../lib/powerliftingVariations';
import type { LiftingSet, UserProfile } from '../../types/energy';
import type {
  BlockWeekPlan,
  GeneratedBlockPlan,
  ResolvedDayPlan,
  ResolvedVariationPlan,
  VariationReference,
} from '../../types/powerliftingBlock';

// Pure edits the user makes to a generated block, straight in the plan view:
// their own sets for a variation-week (the app's suggestion stays alongside as
// `reference`), and real dates for a week (later weeks follow). No I/O —
// blockStore persists the result.

// ---- Variation sets -------------------------------------------------------

// The suggestion a variation carries; a block from before the RPE model has
// none, so its current sets become a 'legacy' reference the first time it is
// edited (and "restore" then brings those back).
export function referenceOf(plan: GeneratedBlockPlan, v: ResolvedVariationPlan): VariationReference {
  if (v.reference) return v.reference;
  const oneRepMax = resolveOneRepMax(plan.config.oneRepMax, plan.config.bodyWeightKg)[v.variation.exercise].value;
  return {
    sets: v.sets,
    pct1rm: v.pct1rm,
    estimatedKcal: v.estimatedKcal,
    method: 'legacy',
    targetRpe: 0,
    fatigueRir: 0,
    extraRir: 0,
    repsToFailure: 0,
    oneRepMaxKg: oneRepMax,
    loadFactor: findVariation(v.variation.variationId)?.loadFactor ?? 1,
  };
}

// Heaviest working weight as % of (1RM × loadFactor) — the same meaning
// `pct1rm` has for an engine suggestion, so edited and suggested compare.
function pctOfMax(sets: LiftingSet[], ref: VariationReference): number {
  const heaviest = Math.max(0, ...sets.filter((s) => s.kind === 'working').map((s) => s.weightKg));
  const max = ref.oneRepMaxKg * ref.loadFactor;
  return max > 0 ? Math.round((heaviest / max) * 100) : 0;
}

function withDayTotals(day: ResolvedDayPlan): ResolvedDayPlan {
  return {
    ...day,
    totalKcal: day.variations.reduce((sum, v) => sum + v.estimatedKcal, 0),
    totalMinutes: estimateLiftingMinutes(day.variations.flatMap((v) => v.sets)),
  };
}

function withWeekTotals(week: BlockWeekPlan): BlockWeekPlan {
  return { ...week, totalKcal: week.days.reduce((sum, d) => sum + d.totalKcal, 0) };
}

export interface VariationAddress {
  weekIndex: number;
  dayIndex: number;
  variationIndex: number;
}

// Replaces one variation-week's sets with the user's own (`sets`), or restores
// the app's suggestion (`sets` = null). kcal and the day/week totals follow.
export function setVariationSets(
  plan: GeneratedBlockPlan,
  at: VariationAddress,
  sets: LiftingSet[] | null,
  heightCm: number
): GeneratedBlockPlan {
  const weeks = plan.weeks.map((week, wi) => {
    if (wi !== at.weekIndex) return week;
    const days = week.days.map((day, di) => {
      if (di !== at.dayIndex) return day;
      const variations = day.variations.map((v, vi) => {
        if (vi !== at.variationIndex) return v;
        const reference = referenceOf(plan, v);
        if (sets == null) {
          return { ...v, sets: reference.sets, pct1rm: reference.pct1rm, estimatedKcal: reference.estimatedKcal, reference, userEdited: false };
        }
        const working = sets.map((s) => ({ ...s, kind: 'working' as const }));
        return {
          ...v,
          sets: working,
          pct1rm: pctOfMax(working, reference),
          estimatedKcal: liftingSessionKcal(v.variation.exercise, working, plan.config.bodyWeightKg, heightCm),
          reference,
          userEdited: true,
        };
      });
      return withDayTotals({ ...day, variations });
    });
    return withWeekTotals({ ...week, days });
  });
  return { ...plan, weeks };
}

// ---- Week dates -----------------------------------------------------------

export const MAX_WEEK_DAYS = 14;

export type WeekDatesError = 'endBeforeStart' | 'overlapsPrevious' | 'tooLong';

function lengthInDays(start: string, end: string): number {
  return Math.round(daysBetween(start, end)) + 1;
}

// Sets week `weekIndex` to run from `start` to `end` (both YYYY-MM-DD,
// inclusive); every LATER week then follows on straight after the one before
// it, keeping its own length. Earlier weeks do not move. A gap before the
// edited week is allowed (a holiday week); an overlap is not.
export function setWeekDates(
  plan: GeneratedBlockPlan,
  weekIndex: number,
  start: string,
  end: string
): { ok: true; plan: GeneratedBlockPlan } | { ok: false; error: WeekDatesError } {
  if (end < start) return { ok: false, error: 'endBeforeStart' };
  if (lengthInDays(start, end) > MAX_WEEK_DAYS) return { ok: false, error: 'tooLong' };
  const previous = plan.weeks[weekIndex - 1];
  if (previous && start <= previous.endDate) return { ok: false, error: 'overlapsPrevious' };

  const weeks = [...plan.weeks];
  weeks[weekIndex] = { ...weeks[weekIndex], startDate: start, endDate: end };
  for (let i = weekIndex + 1; i < weeks.length; i++) {
    const length = lengthInDays(weeks[i].startDate, weeks[i].endDate);
    const nextStart = addDaysToDateString(weeks[i - 1].endDate, 1);
    weeks[i] = { ...weeks[i], startDate: nextStart, endDate: addDaysToDateString(nextStart, length - 1) };
  }
  const config = weekIndex === 0 ? { ...plan.config, weekStartDate: start } : plan.config;
  return { ok: true, plan: { config, weeks } };
}

// The real date a scheduled weekday falls on inside a week (a week can start
// on any day after the user moves it), or null if the week is too short to
// contain that weekday.
export function dateForWeekday(week: BlockWeekPlan, dayOfWeek: number): string | null {
  const length = lengthInDays(week.startDate, week.endDate);
  for (let i = 0; i < length; i++) {
    const date = addDaysToDateString(week.startDate, i);
    if (new Date(date + 'T00:00:00').getDay() === dayOfWeek) return date;
  }
  return null;
}

// ---- Refreshing suggestions -----------------------------------------------

// True when any variation still carries an old-model suggestion (made before
// the RPE model) — the plan view offers to recalculate.
export function hasLegacySuggestions(plan: GeneratedBlockPlan): boolean {
  return plan.weeks.some((w) => w.days.some((d) => d.variations.some((v) => !v.reference || v.reference.method === 'legacy')));
}

// Recalculates every suggestion with the current engine. What the user wrote
// stays: an edited variation keeps its sets (only its reference is replaced),
// and every week keeps its dates. Untouched variations take the new suggestion.
export function refreshSuggestions(plan: GeneratedBlockPlan, profile: UserProfile): GeneratedBlockPlan {
  const fresh = generateBlockPlan(plan.config, profile);
  const weeks = plan.weeks.map((week, wi) => {
    const freshWeek = fresh.weeks[wi];
    if (!freshWeek) return week;
    const days = week.days.map((day, di) => {
      const freshDay = freshWeek.days[di];
      if (!freshDay) return day;
      const variations = day.variations.map((v, vi) => {
        const next = freshDay.variations[vi];
        if (!next) return v;
        return v.userEdited ? { ...v, reference: next.reference } : next;
      });
      return withDayTotals({ ...day, variations, accessories: freshDay.accessories });
    });
    return withWeekTotals({ ...week, days });
  });
  return { ...plan, weeks };
}

import { addDaysToDateString, daysBetween } from '../../lib/dateUtils';
import { estimateLiftingMinutes, liftingSessionKcal } from './liftingEngine';
import { generateBlockPlan, resolveOneRepMax } from './blockEngine';
import { findVariation } from '../../lib/powerliftingVariations';
import type { LiftingSet, UserProfile } from '../../types/energy';
import type {
  AccessoryLineItem,
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
        // The prime stays a warm-up; everything else is a working set.
        const planned = sets.map((s) => ({ ...s, kind: s.kind === 'warmup' ? ('warmup' as const) : ('working' as const) }));
        return {
          ...v,
          sets: planned,
          pct1rm: pctOfMax(planned, reference),
          estimatedKcal: liftingSessionKcal(v.variation.exercise, planned, plan.config.bodyWeightKg, heightCm),
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

// True when a main lift of a progressive week has no prime suggestion yet (a
// block made before primes existed) — the plan view offers to add them.
export function hasMissingPrimes(plan: GeneratedBlockPlan): boolean {
  return plan.weeks.some(
    (w) =>
      !w.isDeload &&
      w.days.some((d) =>
        d.variations.some((v) => v.variation.role === 'main' && v.reference?.method === 'rpe' && v.reference.primePct == null)
      )
  );
}

// Recalculates every suggestion with the current engine. What the user wrote
// stays: an edited variation keeps its sets (only its reference is replaced;
// it gains the suggested prime if it had none), and every week keeps its
// dates. Untouched variations take the new suggestion.
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
        if (!v.userEdited) return next;
        const prime = next.sets[0]?.kind === 'warmup' ? next.sets[0] : null;
        if (!prime || v.sets.some((s) => s.kind === 'warmup')) return { ...v, reference: next.reference };
        const sets = [prime, ...v.sets];
        const estimatedKcal = liftingSessionKcal(v.variation.exercise, sets, plan.config.bodyWeightKg, profile.heightCm);
        return { ...v, sets, estimatedKcal, reference: next.reference };
      });
      // Accessories the user changed in the plan stay theirs.
      const accessories = day.accessoriesEdited ? day.accessories : freshDay.accessories;
      return withDayTotals({ ...day, variations, accessories });
    });
    return withWeekTotals({ ...week, days });
  });
  return { ...plan, weeks };
}

// ---- Weeks off, days off ----------------------------------------------------
// The user decides how the plan bends around real life (a holiday, a trip, a
// busy day): drop one day, drop a whole week, or put a week off INTO the block
// so everything after it moves later. Every one of these can be undone. A
// confirmed-but-not-yet-logged session in what is dropped or moved is cleared
// (its date no longer means anything); a session already in Xả is the user's
// to delete from the log and is never touched here.

const BREAK_DAYS = 7;

export interface DayAt {
  weekIndex: number;
  dayIndex: number;
}

function withoutPlannedSession(day: ResolvedDayPlan): ResolvedDayPlan {
  return day.session?.status === 'planned' ? { ...day, session: undefined } : day;
}

function mapWeek(plan: GeneratedBlockPlan, weekIndex: number, fn: (w: BlockWeekPlan) => BlockWeekPlan): GeneratedBlockPlan {
  return { ...plan, weeks: plan.weeks.map((w, i) => (i === weekIndex ? fn(w) : w)) };
}

export function setDaySkipped(plan: GeneratedBlockPlan, at: DayAt, skipped: boolean): GeneratedBlockPlan {
  return mapWeek(plan, at.weekIndex, (week) => ({
    ...week,
    days: week.days.map((d, i) => {
      if (i !== at.dayIndex) return d;
      return skipped ? { ...withoutPlannedSession(d), skipped: true } : { ...d, skipped: undefined };
    }),
  }));
}

// "Bỏ tuần này": the week stays where it is, empty. The block ends as before.
export function setWeekSkipped(plan: GeneratedBlockPlan, weekIndex: number, skipped: boolean): GeneratedBlockPlan {
  return mapWeek(plan, weekIndex, (week) =>
    skipped ? { ...week, skipped: true, days: week.days.map(withoutPlannedSession) } : { ...week, skipped: undefined }
  );
}

function hasLoggedSession(week: BlockWeekPlan): boolean {
  return week.days.some((d) => d.session?.status === 'logged');
}

function shiftFrom(plan: GeneratedBlockPlan, weekIndex: number, days: number): GeneratedBlockPlan | null {
  const week = plan.weeks[weekIndex];
  const moved = setWeekDates(
    plan,
    weekIndex,
    addDaysToDateString(week.startDate, days),
    addDaysToDateString(week.endDate, days)
  );
  if (!moved.ok) return null;
  return {
    ...moved.plan,
    weeks: moved.plan.weeks.map((w, i) => (i >= weekIndex ? { ...w, days: w.days.map(withoutPlannedSession) } : w)),
  };
}

export type PauseWeekError = 'hasLoggedSession';

// "Dời các tuần sau": a calendar week off where this week was; this week and
// every later one move one week later, so no planned training is lost. Not for
// a week the user already trained in (move its dates instead).
export function pauseAtWeek(
  plan: GeneratedBlockPlan,
  weekIndex: number
): { ok: true; plan: GeneratedBlockPlan } | { ok: false; error: PauseWeekError } {
  const week = plan.weeks[weekIndex];
  if (plan.weeks.slice(weekIndex).some(hasLoggedSession)) return { ok: false, error: 'hasLoggedSession' };
  const brk = { startDate: week.startDate, endDate: addDaysToDateString(week.startDate, BREAK_DAYS - 1) };
  const shifted = shiftFrom(plan, weekIndex, BREAK_DAYS)!; // moving later never overlaps
  const breaks = [...(plan.config.breaks ?? []), brk].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { ok: true, plan: { ...shifted, config: { ...shifted.config, breaks } } };
}

// Takes a week off back out: the weeks after it move back to close the gap.
export function removeBreak(plan: GeneratedBlockPlan, breakIndex: number): GeneratedBlockPlan {
  const breaks = plan.config.breaks ?? [];
  const brk = breaks[breakIndex];
  if (!brk) return plan;
  const rest = breaks.filter((_, i) => i !== breakIndex);
  const after = plan.weeks.findIndex((w) => w.startDate > brk.endDate);
  const lengthDays = lengthInDays(brk.startDate, brk.endDate);
  const shifted = after >= 0 ? (shiftFrom(plan, after, -lengthDays) ?? plan) : plan;
  return { ...shifted, config: { ...shifted.config, breaks: rest.length > 0 ? rest : undefined } };
}

// ---- Accessories in a running plan -------------------------------------------

// The user's own extra lines for one day (free text — "Face pull 3x15 @12.5kg";
// nothing the app has to know or calculate). With `laterWeeksToo`, every later
// week's session on the same weekday gets the same list.
export function setDayAccessories(
  plan: GeneratedBlockPlan,
  at: DayAt,
  accessories: AccessoryLineItem[],
  laterWeeksToo: boolean
): GeneratedBlockPlan {
  const weekday = plan.weeks[at.weekIndex]?.days[at.dayIndex]?.dayOfWeek;
  if (weekday == null) return plan;
  const clean = accessories
    .map((a) => ({ ...a, customName: a.customName.trim(), reps: a.reps.trim() }))
    .filter((a) => a.customName !== '');
  return {
    ...plan,
    weeks: plan.weeks.map((week, wi) => {
      if (wi < at.weekIndex || (wi > at.weekIndex && !laterWeeksToo)) return week;
      return {
        ...week,
        days: week.days.map((d, di) =>
          (wi === at.weekIndex ? di === at.dayIndex : d.dayOfWeek === weekday)
            ? { ...d, accessories: clean, accessoriesEdited: true }
            : d
        ),
      };
    }),
  };
}

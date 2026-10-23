import { mondayFirstRank } from '../../lib/dateUtils';
import { dateForWeekday } from './blockPlanEdits';
import { planDayState, type PlanDayState } from './blockSessions';
import type { LiftingExercise } from '../../types/energy';
import type { GeneratedBlockPlan, ResolvedVariationPlan } from '../../types/powerliftingBlock';

// "Theo bài": one lift across the whole block as a grid — a row per week, a
// column per weekday that lift is trained on — so the user can read how its
// load moves week to week and tap any one session to change it. Pure; the
// plan view draws it (BlockLiftGrid.tsx).

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface LiftGridItem {
  variationIndex: number;
  variation: ResolvedVariationPlan;
}

export interface LiftGridCell {
  weekIndex: number;
  dayIndex: number;
  date: string | null; // null when the (moved) week is too short to hold that weekday
  skipped: boolean; // the day or its whole week was taken off
  state: PlanDayState; // the square's colour: trained / not yet / taken off
  items: LiftGridItem[]; // this lift's variations that day, in plan order
}

export interface LiftGrid {
  weekdays: Weekday[]; // columns, Monday first
  rows: { weekIndex: number; cells: (LiftGridCell | null)[] }[]; // null = not trained that weekday that week
}

// The lifts that appear anywhere in the block, in the app's usual order.
export function liftsInPlan(plan: GeneratedBlockPlan, order: readonly LiftingExercise[]): LiftingExercise[] {
  const present = new Set(plan.weeks.flatMap((w) => w.days.flatMap((d) => d.variations.map((v) => v.variation.exercise))));
  return order.filter((e) => present.has(e));
}

// `lifted` = calendar days that hold a lifting Xả (what "trained" is checked against).
export function buildLiftGrid(
  plan: GeneratedBlockPlan,
  exercise: LiftingExercise,
  lifted: Set<string> = new Set()
): LiftGrid {
  const days = new Set<Weekday>();
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.variations.some((v) => v.variation.exercise === exercise && v.sets.length > 0)) days.add(day.dayOfWeek);
    }
  }
  const weekdays = [...days].sort((a, b) => mondayFirstRank(a) - mondayFirstRank(b));

  const rows = plan.weeks.map((week, weekIndex) => ({
    weekIndex,
    cells: weekdays.map((weekday): LiftGridCell | null => {
      const dayIndex = week.days.findIndex((d) => d.dayOfWeek === weekday);
      if (dayIndex < 0) return null;
      const day = week.days[dayIndex];
      const items = day.variations
        .map((variation, variationIndex) => ({ variation, variationIndex }))
        .filter((it) => it.variation.variation.exercise === exercise && it.variation.sets.length > 0);
      if (items.length === 0) return null;
      return {
        weekIndex,
        dayIndex,
        date: dateForWeekday(week, weekday),
        skipped: Boolean(week.skipped || day.skipped),
        state: planDayState(week, day, lifted),
        items,
      };
    }),
  }));
  return { weekdays, rows };
}

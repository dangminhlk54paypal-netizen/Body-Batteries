import { addDaysToDateString, dateString, mondayOfWeek } from '../../lib/dateUtils';
import type { GeneratedBlockPlan, TrainingBlockConfig, BlockWeekPlan } from '../../types/powerliftingBlock';

// Row shape of the `training_blocks` table (see src/data/db/schema.ts).
export interface TrainingBlockRow {
  id: string;
  created_at: number;
  progressive_weeks: number;
  has_deload: number;
  focus: string;
  body_weight_kg: number;
  deficit_mode_enabled: number;
  is_active: number;
  config: string;
  weeks: string;
}

export function rowToPlan(r: TrainingBlockRow): GeneratedBlockPlan {
  const config = JSON.parse(r.config) as TrainingBlockConfig;
  const weeks = JSON.parse(r.weeks) as BlockWeekPlan[];
  // Blocks created before the calendar-date feature (Session 27) have no
  // `weekStartDate` in their stored config JSON — backfill from the first
  // resolved week, else the Monday of the week the block was created, so
  // every consumer (export filename, future block-extend logic) can rely on
  // the field the type promises.
  if (!config.weekStartDate) {
    config.weekStartDate = weeks[0]?.startDate ?? mondayOfWeek(dateString(new Date(r.created_at)));
  }
  // Those same old blocks stored their weeks without startDate/endDate —
  // the plan then showed "Week 1 (Invalid Date - Invalid Date)" and days
  // without a date. Fill each missing week as consecutive Mon–Sun weeks from
  // the anchor (the engine's own rule, blockEngine.ts); weeks that already
  // carry dates (possibly user-edited) are left untouched.
  const filledWeeks = weeks.map((w, i) => {
    if (w.startDate && w.endDate) return w;
    const startDate = addDaysToDateString(config.weekStartDate, i * 7);
    return { ...w, startDate, endDate: addDaysToDateString(startDate, 6) };
  });
  return { config, weeks: filledWeeks };
}

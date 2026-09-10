import { todayString } from '../../lib/dateUtils';
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
  // resolved week so every consumer (export filename, future block-extend
  // logic) can rely on the field the type promises.
  if (!config.weekStartDate) {
    config.weekStartDate = weeks[0]?.startDate ?? todayString();
  }
  return { config, weeks };
}

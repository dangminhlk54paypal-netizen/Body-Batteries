import type { FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry } from '../../types/energy';
import type { IntakeEvent } from '../../types/battery';
import type { MicroBatteryState } from '../../types/nutrition';
import { isOverReference } from '../nutrition/overdoseWarning';

// The key number(s) shown on each folded "Chi tiết hôm nay" row on Home, so a
// row still says something useful while closed. Pure — the screen formats
// these with t() and passes the supplement check in (it needs a food lookup).

export interface HomeDetailsSummary {
  mealsKcal: number;
  mealCount: number;
  activityKcal: number;
  activityCount: number;
  // eaten − burned, rounded (positive = surplus)
  balanceKcal: number;
  microCount: number;
  microWarnCount: number;
  supplementDoses: number;
  intakeCount: number;
}

export interface HomeDetailsInput {
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  intakeLog: IntakeEvent[];
  microStates: MicroBatteryState[];
  burnedKcal: number;
  isSupplement: (foodId: string) => boolean;
}

export function summarizeHomeDetails(input: HomeDetailsInput): HomeDetailsSummary {
  const mealsKcal = input.foodLog.reduce((sum, e) => sum + e.energyKcal, 0);
  const activityKcal = input.activityLog.reduce((sum, e) => sum + e.energyKcal, 0);
  // Doses, not rows: "2 viên" is one row with count 2 (same rule as
  // SupplementQuickLog's per-chip counter).
  const supplementDoses = input.foodLog
    .filter((e) => input.isSupplement(e.foodId))
    .reduce((sum, e) => sum + (e.count ?? 1), 0);
  return {
    mealsKcal: Math.round(mealsKcal),
    mealCount: input.foodLog.length,
    activityKcal: Math.round(activityKcal),
    activityCount: input.activityLog.length,
    balanceKcal: Math.round(mealsKcal - input.burnedKcal),
    microCount: input.microStates.length,
    microWarnCount: input.microStates.filter(isOverReference).length,
    supplementDoses,
    intakeCount: input.intakeLog.length,
  };
}

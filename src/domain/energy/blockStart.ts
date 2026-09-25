import { addDaysToDateString } from '../../lib/dateUtils';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

// Setting up a block the lifter is ALREADY in: most people join the app mid-
// block, after training for years. They say which block it is and which week
// they are in; the plan (and the training log's "B3W2" labels) then lines up
// with the weeks already behind them. Pure.

// The Monday week 1 began on, for someone in week `currentWeek` this week.
export function blockStartForCurrentWeek(thisMonday: string, currentWeek: number): string {
  return addDaysToDateString(thisMonday, -7 * (currentWeek - 1));
}

// The number a new block gets by default: one past the highest the log shows
// (the user's own numbers, else creation order — same rule as the log).
export function nextBlockNumber(blocks: GeneratedBlockPlan[]): number {
  return (
    [...blocks]
      .sort((a, b) => a.config.createdAt - b.config.createdAt)
      .reduce((max, b, i) => Math.max(max, b.config.blockNumber ?? i + 1), 0) + 1
  );
}

// The number a block goes by ("B3" in B3W4): the user's own, else its place in
// creation order among the blocks that still exist — the training log's rule.
export function blockNumberOf(plan: GeneratedBlockPlan, blocks: GeneratedBlockPlan[]): number {
  if (plan.config.blockNumber != null) return plan.config.blockNumber;
  const order = [...blocks]
    .filter((b) => b.weeks.length > 0)
    .sort((a, b) => a.config.createdAt - b.config.createdAt)
    .findIndex((b) => b.config.id === plan.config.id);
  return order >= 0 ? order + 1 : 1;
}

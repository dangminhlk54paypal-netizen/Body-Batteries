// A meal acts on the batteries at the time it was EATEN (satiety and the
// nutrient pins are replayed from the food log by meal time). The log form uses
// this to block a time that hasn't happened yet and to explain, for a meal
// logged well after the fact, why the pin will not jump to full.
export type MealTimeStatus = 'future' | 'late' | 'ontime';

// Minutes before "now" from which a meal counts as logged late.
export const LATE_LOG_HINT_MINUTES = 30;

export function mealTimeStatus(mealMs: number, nowMs: number): MealTimeStatus {
  const minutesBeforeNow = (nowMs - mealMs) / 60_000;
  if (minutesBeforeNow < 0) return 'future';
  if (minutesBeforeNow >= LATE_LOG_HINT_MINUTES) return 'late';
  return 'ontime';
}

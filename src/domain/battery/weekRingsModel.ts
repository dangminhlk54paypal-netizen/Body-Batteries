// Data for History's "7 ngày" card: one small 6-segment ring per day (the
// same ring as Home — see batteryRingModel.ts), the day's kcal balance, and
// how many of the 7 days hit each sub-battery's target. Everything is based
// on what was actually TAKEN IN that day versus that day's target — not on
// battery_readings.level, which drains hour by hour (the pin metaphor) and
// so reads as a misleading "how did I do" number.
// Pure — the screen fetches the logs and passes them in.

import type { FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry } from '../../types/energy';
import type { BatteryReading, IntakeEvent } from '../../types/battery';
import { dateString } from '../../lib/dateUtils';
import { computeDailyBatteryTotals } from './dailyBatteryTotals';
import { dailyBatteryRatio } from './batteryRingModel';

// Ring order = Home ring order.
export const WEEK_RING_BATTERY_IDS = ['protein', 'carbs', 'water', 'minerals', 'sleep', 'movement'] as const;
export type WeekRingBatteryId = (typeof WEEK_RING_BATTERY_IDS)[number];

// Standard approximation used for the "≈ kg" hint (1 kg of body fat ≈ 7700 kcal).
export const KCAL_PER_KG_FAT = 7700;

export interface WeekRingDay {
  date: string; // YYYY-MM-DD
  // intake / target per battery (1 = 100 %); null when that day has no
  // target on record (no battery reading) — the segment is drawn empty.
  ratios: Record<WeekRingBatteryId, number | null>;
  metCount: number; // batteries at ≥ 100 %
  eatenKcal: number;
  // eaten − burned (Apple Health sync, else the energy battery's estimated
  // need — the Excel "Daily Totals" rule); null on a day with no food logged,
  // where a full-day "deficit" would be meaningless.
  balanceKcal: number | null;
}

export interface WeekRingsSummary {
  days: WeekRingDay[]; // oldest → newest
  // Days each battery reached its target, out of days.length.
  hitCounts: Record<WeekRingBatteryId, number>;
  // Sum of balanceKcal over FINISHED days only (today is still running).
  finishedBalanceKcal: number;
  finishedDaysWithFood: number;
}

function byDay<T>(items: T[], dayOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayOf(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

export function buildWeekRings(input: {
  dates: string[]; // oldest → newest, last one = today
  today: string;
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  intakeLog: IntakeEvent[];
  readings: BatteryReading[];
  appleHealthBurned: Map<string, number>;
}): WeekRingsSummary {
  const { dates, today, foodLog, activityLog, intakeLog, readings, appleHealthBurned } = input;
  const food = byDay(foodLog, (f) => dateString(new Date(f.timestamp)));
  // Same day rule as the activity repository / History: COALESCE(start_at, timestamp).
  const activity = byDay(activityLog, (a) => dateString(new Date(a.startAt ?? a.timestamp)));
  const intake = byDay(intakeLog, (e) => dateString(new Date(e.timestamp)));

  const hitCounts = Object.fromEntries(WEEK_RING_BATTERY_IDS.map((id) => [id, 0])) as Record<
    WeekRingBatteryId,
    number
  >;
  let finishedBalanceKcal = 0;
  let finishedDaysWithFood = 0;

  const days = dates.map((date): WeekRingDay => {
    const dayFood = food.get(date) ?? [];
    const totals = computeDailyBatteryTotals(dayFood, activity.get(date) ?? [], intake.get(date) ?? []);
    const dayReadings = readings.filter((r) => r.date === date);

    const ratios = {} as Record<WeekRingBatteryId, number | null>;
    let metCount = 0;
    for (const id of WEEK_RING_BATTERY_IDS) {
      const capacity = dayReadings.find((r) => r.batteryTypeId === id)?.capacity;
      const ratio = capacity ? dailyBatteryRatio(id, totals, capacity) : null;
      ratios[id] = ratio;
      if (ratio != null && ratio >= 1) {
        metCount++;
        hitCounts[id]++;
      }
    }

    const eatenKcal = Math.round(dayFood.reduce((s, f) => s + f.energyKcal, 0));
    const burned =
      appleHealthBurned.get(date) ?? dayReadings.find((r) => r.batteryTypeId === 'energy')?.capacity;
    const balanceKcal = dayFood.length > 0 && burned !== undefined ? Math.round(eatenKcal - burned) : null;
    if (balanceKcal != null && date < today) {
      finishedBalanceKcal += balanceKcal;
      finishedDaysWithFood++;
    }

    return { date, ratios, metCount, eatenKcal, balanceKcal };
  });

  return { days, hitCounts, finishedBalanceKcal, finishedDaysWithFood };
}

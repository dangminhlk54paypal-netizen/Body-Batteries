import { useEffect, useMemo, useState } from 'react';
import { getFoodLogInRange } from '../data/repositories/foodLogRepository';
import { getAnyFoodById } from '../data/food/foodLookup';
import {
  evaluateSubstanceDays,
  summarizeSubstanceHabits,
  type SubstanceDay,
  type SubstanceHabits,
} from '../domain/nutrition/substanceEngine';
import { daysAgo, todayString } from '../lib/dateUtils';
import { resolveBedtimeHour, useSettingsStore } from '../store/settingsStore';
import type { FoodLogEntry } from '../types/food';

const JOURNAL_DAYS = 7;

export interface SubstanceJournal {
  days: SubstanceDay[]; // oldest first, today last
  today: SubstanceDay;
  habits: SubstanceHabits;
  bedtimeHour: number;
}

// The ☕ panel's diary: the last 7 days of active substances, recomputed from
// the food log (today from the already-loaded store log, the 6 days before
// read-only from SQLite). Past days are re-read whenever today's log changes,
// so a backfilled entry shows up without leaving the screen.
export function useSubstanceJournal(todayLog: FoodLogEntry[]): SubstanceJournal {
  const [pastEntries, setPastEntries] = useState<FoodLogEntry[]>([]);
  const bedtimeHour = resolveBedtimeHour(useSettingsStore((s) => s.bedtimeHour));

  useEffect(() => {
    let cancelled = false;
    getFoodLogInRange(daysAgo(JOURNAL_DAYS - 1), daysAgo(1)).then((rows) => {
      if (!cancelled) setPastEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [todayLog]);

  return useMemo(() => {
    const dates = Array.from({ length: JOURNAL_DAYS }, (_, i) =>
      i === JOURNAL_DAYS - 1 ? todayString() : daysAgo(JOURNAL_DAYS - 1 - i)
    );
    const days = evaluateSubstanceDays(dates, [...pastEntries, ...todayLog], getAnyFoodById, bedtimeHour);
    return {
      days,
      today: days[days.length - 1],
      habits: summarizeSubstanceHabits(days),
      bedtimeHour,
    };
  }, [pastEntries, todayLog, bedtimeHour]);
}

import { useEffect, useMemo, useState } from 'react';
import { getFoodLogInRange } from '../data/repositories/foodLogRepository';
import { getAnyFoodById } from '../data/food/foodLookup';
import { computeMicroBatteries } from '../domain/nutrition/microBatteryEngine';
import { nutrientTargetsForProfile } from '../lib/nutrientTargets';
import { daysAgo, formatDisplayDate, isToday, todayString } from '../lib/dateUtils';
import type { FoodLogEntry } from '../types/food';
import type { UserProfile } from '../types/energy';
import type { MicroBatteryState } from '../types/nutrition';
import { translate } from '../i18n/translate';
import { useLanguage } from '../i18n/useT';
import type { Language } from '../i18n/types';

export interface DateOption {
  value: string; // YYYY-MM-DD
  label: string;
}

const HISTORY_DAYS = 7; // matches DATA_RETENTION_DAYS — food_log doesn't keep more anyway

function buildDateOptions(language: Language): DateOption[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const value = i === 0 ? todayString() : daysAgo(i);
    const label =
      i === 0
        ? translate(language, 'common.today')
        : i === 1
          ? translate(language, 'common.yesterday')
          : formatDisplayDate(value, language);
    return { value, label };
  });
}

// Derives the micronutrient battery stack for a chosen day (today or one of
// the last 6 days still inside the food_log retention window). Today reuses
// the already-loaded energyStore log; past days are fetched read-only via
// getFoodLogInRange — no schema/DB change, no persisted micronutrient snapshot.
export function useMicroBatteryHistory(todayFoodLog: FoodLogEntry[], profile: UserProfile) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [pastEntries, setPastEntries] = useState<FoodLogEntry[]>([]);
  const language = useLanguage();

  const dates = useMemo(() => buildDateOptions(language), [language]);

  useEffect(() => {
    if (isToday(selectedDate)) return; // today comes from todayFoodLog, no fetch needed

    let cancelled = false;
    getFoodLogInRange(selectedDate, selectedDate).then((rows) => {
      if (!cancelled) setPastEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const entries = isToday(selectedDate) ? todayFoodLog : pastEntries;

  const targets = useMemo(() => nutrientTargetsForProfile(profile), [profile]);

  const states: MicroBatteryState[] = useMemo(
    () => computeMicroBatteries(entries, getAnyFoodById, targets),
    [entries, targets]
  );

  return { selectedDate, setSelectedDate, dates, states };
}

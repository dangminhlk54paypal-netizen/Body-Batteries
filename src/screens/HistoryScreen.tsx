import React, { useCallback, useState } from 'react';
import {
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getReadingsInRange } from '../data/repositories/batteryRepository';
import { getFoodLogForDate, getFoodLogInRange } from '../data/repositories/foodLogRepository';
import { getActivityLogForDate, getActivityLogInRange } from '../data/repositories/activityLogRepository';
import { getIntakeEventsInRange } from '../data/repositories/intakeRepository';
import {
  getAppleHealthBurnedInRange,
  getWeightHistory,
  type WeightEntry,
} from '../data/repositories/healthSignalsRepository';
import { weightOnOrBefore } from '../domain/health/weightOnDay';
import { weightGoalDirection } from '../domain/health/weightHistoryGroups';
import { buildWeekRings, type WeekRingsSummary } from '../domain/battery/weekRingsModel';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import type { BatteryReading } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import { todayString, daysAgo, daysBetween, addDaysToDateString } from '../lib/dateUtils';
import { BACKFILL_MAX_DAYS_BACK } from '../lib/constants';
import { formatWaterAmount } from '../lib/units';
import { WeekRingsCard } from '../components/WeekRingsCard';
import { WeightLogCard } from '../components/WeightLogCard';
import { DayDetailSheet } from '../components/DayDetailSheet';
import { FoodLogModal } from '../components/FoodLogModal';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

// The week card covers today + the 6 days before it.
const WEEK_DAYS = 7;

export function HistoryScreen() {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  // Battery readings of the week — the day sheet's sleep/water come from here.
  const [readings, setReadings] = useState<BatteryReading[]>([]);
  const [week, setWeek] = useState<WeekRingsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // S-S5: backfill day-detail sheet — which date's card was tapped, its
  // entries (fetched on open, not derived from `days`), and a loading flag
  // for the fetch. `sheetDate` also doubles as the pinned date passed to
  // FoodLogModal when adding a past-date meal from this screen.
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetEntries, setSheetEntries] = useState<FoodLogEntry[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetBurnedKcal, setSheetBurnedKcal] = useState(0);
  const [addFoodVisible, setAddFoodVisible] = useState(false);
  // Bumped when the user starts scrolling — collapses the weight chart's tap caption.
  const [scrollKey, setScrollKey] = useState(0);
  // Carried-forward weight for the day-detail sheet — fetched once here (not
  // by WeightLogCard, which keeps its own independent copy for its own list).
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const waterDisplayUnit = useSettingsStore((s) => s.waterDisplayUnit);
  const userProfile = useSettingsStore((s) => s.userProfile);

  async function loadHistory() {
    const toDate = todayString();
    const fromDate = daysAgo(WEEK_DAYS - 1);
    const dates = Array.from({ length: WEEK_DAYS }, (_, i) => addDaysToDateString(fromDate, i));

    try {
      const [weekReadings, foodLog, activityLog, intakeLog, appleHealthBurned, weightRows] = await Promise.all([
        getReadingsInRange(fromDate, toDate),
        getFoodLogInRange(fromDate, toDate),
        getActivityLogInRange(fromDate, toDate),
        getIntakeEventsInRange(fromDate, toDate),
        getAppleHealthBurnedInRange(fromDate, toDate),
        getWeightHistory(1000),
      ]);
      setReadings(weekReadings);
      setWeights(weightRows);
      setWeek(
        buildWeekRings({
          dates,
          today: toDate,
          foodLog,
          activityLog,
          intakeLog,
          readings: weekReadings,
          appleHealthBurned,
        })
      );
    } catch (e) {
      console.warn('loadHistory failed:', e);
    }
    setLoading(false);
  }

  // Fetches (or re-fetches) the food log + activity log for one calendar day
  // into the day-detail sheet. Called both when the sheet opens and after any
  // add/delete so the sheet's list reflects the store.
  async function fetchDayEntries(date: string) {
    setSheetLoading(true);
    try {
      const [entries, activity] = await Promise.all([
        getFoodLogForDate(date),
        getActivityLogForDate(date),
      ]);
      setSheetEntries(entries);
      setSheetBurnedKcal(Math.round(activity.reduce((sum, a) => sum + a.energyKcal, 0)));
    } catch (e) {
      console.warn('fetchDayEntries failed:', e);
      setSheetEntries([]);
      setSheetBurnedKcal(0);
    } finally {
      setSheetLoading(false);
    }
  }

  function openDaySheet(date: string) {
    setSheetDate(date);
    setSheetVisible(true);
    fetchDayEntries(date);
  }

  function closeDaySheet() {
    setSheetVisible(false);
  }

  // Undo a backfilled (or today's, if the user tapped a today card) entry,
  // then refresh both the sheet's own list and the day cards' percentages.
  async function handleDeleteEntry(entry: FoodLogEntry) {
    await useEnergyStore.getState().removeFoodForPastDate(entry);
    if (sheetDate) await fetchDayEntries(sheetDate);
    await loadHistory();
  }

  // Close the day-detail sheet and open FoodLogModal pinned to that date.
  function handleAddFood() {
    setSheetVisible(false);
    setAddFoodVisible(true);
  }

  // FoodLogModal closed (cancelled or logged) — refresh the day's entries
  // and the day cards' percentages either way, cheap and always correct.
  async function handleAddFoodModalClose() {
    setAddFoodVisible(false);
    if (sheetDate) await fetchDayEntries(sheetDate);
    await loadHistory();
  }

  // Reload every time the tab gains focus so today's new intake shows up
  // (bottom-tab screens stay mounted, so a one-shot mount effect is not enough).
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={c.textPrimary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // Sleep/water for the open sheet's day are already in `days` (fetched once
  // for the whole 7-day range in loadHistory) — no extra fetch needed, unlike
  // burnedKcal above which genuinely requires its own per-day query.
  const sheetDayReadings = readings.filter((r) => r.date === sheetDate);
  const sheetSleepHours = sheetDayReadings.find((r) => r.batteryTypeId === 'sleep')?.level ?? null;
  const sheetWaterMl = sheetDayReadings.find((r) => r.batteryTypeId === 'water')?.level ?? null;
  const sheetWaterDisplay = sheetWaterMl !== null ? formatWaterAmount(sheetWaterMl, waterDisplayUnit) : null;
  const sheetWeightKg = sheetDate ? weightOnOrBefore(sheetDate, weights) : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        onScrollBeginDrag={() => setScrollKey((k) => k + 1)}
      >
        <Text style={styles.title}>{t('screens.history.title')}</Text>

        {week ? (
          <WeekRingsCard
            summary={week}
            today={todayString()}
            goal={weightGoalDirection(weights[0]?.value ?? userProfile.weightKg, userProfile.heightCm)}
            onPressDay={openDaySheet}
          />
        ) : (
          <Text style={styles.empty}>{t('screens.history.empty')}</Text>
        )}

        <WeightLogCard onChanged={loadHistory} dismissKey={scrollKey} />
      </ScrollView>

      <DayDetailSheet
        visible={sheetVisible}
        date={sheetDate ?? todayString()}
        entries={sheetEntries}
        loading={sheetLoading}
        canAddFood={daysBetween(sheetDate ?? todayString(), todayString()) <= BACKFILL_MAX_DAYS_BACK}
        burnedKcal={sheetBurnedKcal}
        sleepHours={sheetSleepHours}
        waterDisplay={sheetWaterDisplay}
        weightKg={sheetWeightKg}
        onClose={closeDaySheet}
        onAddFood={handleAddFood}
        onDeleteEntry={handleDeleteEntry}
      />
      <FoodLogModal
        visible={addFoodVisible}
        onClose={handleAddFoodModalClose}
        initialDate={sheetDate ?? undefined}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: c.textPrimary },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', marginTop: 40 },
});

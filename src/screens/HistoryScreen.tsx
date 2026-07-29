import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getReadingsInRange } from '../data/repositories/batteryRepository';
import { getLogsInRange } from '../data/repositories/dailyLogRepository';
import { getFoodLogForDate } from '../data/repositories/foodLogRepository';
import { getActivityLogForDate } from '../data/repositories/activityLogRepository';
import { getWeightHistory, type WeightEntry } from '../data/repositories/healthSignalsRepository';
import { weightOnOrBefore } from '../domain/health/weightOnDay';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import type { BatteryReading, DailyLog, BatteryType } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import { todayString, daysAgo, daysBetween, formatDisplayDate } from '../lib/dateUtils';
import { toPercentage } from '../domain/battery/batteryEngine';
import { DEFAULT_BATTERIES, batteryTypeName, BACKFILL_MAX_DAYS_BACK } from '../lib/constants';
import { formatWaterAmount } from '../lib/units';
import { TrendChart } from '../components/TrendChart';
import { WeightLogCard } from '../components/WeightLogCard';
import { DayDetailSheet } from '../components/DayDetailSheet';
import { FoodLogModal } from '../components/FoodLogModal';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

// Short labels for the mini bars in each day card — a hand-picked short
// label per battery id (rather than a fixed-length name.slice(), which can
// cut mid-word — e.g. "Khoáng chất" -> "Khoá", which reads as the unrelated
// word "lock"). Falls back to the full battery name for any id outside the
// known set (defensive — every current battery id is covered above).
const KNOWN_SHORT_LABEL_IDS = ['protein', 'carbs', 'water', 'minerals', 'sleep', 'movement'];

function batteryShortLabel(id: string, language: Language): string {
  if (!KNOWN_SHORT_LABEL_IDS.includes(id)) {
    return batteryTypeName(id as BatteryType['id'], language);
  }
  return translate(language, `screens.history.batteryShortLabels.${id}`);
}

interface DayData {
  date: string;
  modeId: string;
  readings: BatteryReading[];
  averagePercentage: number;
  /** Energy battery % for the day, or null when no energy reading exists (e.g. older data). */
  energyPercentage: number | null;
}

export function HistoryScreen() {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [days, setDays] = useState<DayData[]>([]);
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
  // Carried-forward weight for the day-detail sheet — fetched once here (not
  // by WeightLogCard, which keeps its own independent copy for its own list).
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const waterDisplayUnit = useSettingsStore((s) => s.waterDisplayUnit);

  async function loadHistory() {
    const toDate = todayString();
    const fromDate = daysAgo(7);

    let readings: BatteryReading[] = [];
    let logs: DailyLog[] = [];
    try {
      [readings, logs] = await Promise.all([
        getReadingsInRange(fromDate, toDate),
        getLogsInRange(fromDate, toDate),
      ]);
      setWeights(await getWeightHistory(1000));
    } catch (e) {
      console.warn('loadHistory failed:', e);
    }

    const logMap: Record<string, DailyLog> = {};
    logs.forEach((l) => (logMap[l.date] = l));

    const dateSet = [...new Set(readings.map((r) => r.date))].sort().reverse();

    const dayData: DayData[] = dateSet.map((date) => {
      const dayReadings = readings.filter(
        (r) => r.date === date && r.batteryTypeId !== 'master' && r.batteryTypeId !== 'energy'
      );
      const avg =
        dayReadings.length > 0
          ? Math.round(
              dayReadings.reduce((s, r) => s + toPercentage(r.level, r.capacity), 0) /
                dayReadings.length
            )
          : 0;

      const energyReading = readings.find((r) => r.date === date && r.batteryTypeId === 'energy');
      const energyPercentage = energyReading
        ? Math.round(toPercentage(energyReading.level, energyReading.capacity))
        : null;

      return {
        date,
        modeId: logMap[date]?.modeId ?? 'maintain',
        readings: dayReadings,
        averagePercentage: avg,
        energyPercentage,
      };
    });

    setDays(dayData);
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
  const sheetDayReadings = days.find((d) => d.date === sheetDate)?.readings ?? [];
  const sheetSleepHours = sheetDayReadings.find((r) => r.batteryTypeId === 'sleep')?.level ?? null;
  const sheetWaterMl = sheetDayReadings.find((r) => r.batteryTypeId === 'water')?.level ?? null;
  const sheetWaterDisplay = sheetWaterMl !== null ? formatWaterAmount(sheetWaterMl, waterDisplayUnit) : null;
  const sheetWeightKg = sheetDate ? weightOnOrBefore(sheetDate, weights) : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('screens.history.title')}</Text>

        <TrendChart data={chronologicalTrend(days)} energyData={chronologicalEnergyTrend(days)} />

        <WeightLogCard onChanged={loadHistory} />

        {days.length === 0 && <Text style={styles.empty}>{t('screens.history.empty')}</Text>}

        {days.map((day) => (
          <Pressable
            key={day.date}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => openDaySheet(day.date)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDisplayDate(day.date, language)}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.avgBadge, styles.nutritionBadge, avgColor(day.averagePercentage, c)]}>
                  <Text style={styles.avgText}>
                    {t('screens.history.nutritionBadge', { pct: day.averagePercentage })}
                  </Text>
                </View>
                {day.energyPercentage !== null && (
                  <View style={[styles.avgBadge, styles.energyBadge, avgColor(day.energyPercentage, c)]}>
                    <Text style={styles.avgText}>
                      {t('screens.history.energyBadge', { pct: day.energyPercentage })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.batteryRow}>
              {day.readings.map((r) => {
                const type = DEFAULT_BATTERIES.find((b) => b.id === r.batteryTypeId);
                if (!type) return null;
                const pct = toPercentage(r.level, r.capacity);
                return (
                  <View key={r.batteryTypeId} style={styles.miniCell}>
                    <View
                      style={[
                        styles.miniBar,
                        { height: (pct / 100) * 32, backgroundColor: type.color },
                      ]}
                    />
                    <Text style={styles.miniLabel}>{batteryShortLabel(type.id, language)}</Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        ))}
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

// `days` is sorted newest-first for the card list; the chart reads left-to-right
// as oldest-to-newest, so reverse it here rather than re-sorting in state.
function chronologicalTrend(days: DayData[]) {
  return [...days].reverse().map((d) => ({ date: d.date, averagePercentage: d.averagePercentage }));
}

// Same ordering as chronologicalTrend, but only includes days that actually
// have an energy reading (older data may not have one).
function chronologicalEnergyTrend(days: DayData[]) {
  return [...days]
    .reverse()
    .filter((d) => d.energyPercentage !== null)
    .map((d) => ({ date: d.date, averagePercentage: d.energyPercentage as number }));
}

function avgColor(pct: number, c: ThemeColors) {
  if (pct >= 60) return { backgroundColor: c.successBgSoft };
  if (pct >= 30) return { backgroundColor: c.warningBgSoft };
  return { backgroundColor: c.dangerBgSoft };
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: c.textPrimary },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.bgElevated,
  },
  cardPressed: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  badgeRow: { flexDirection: 'row', gap: 6 },
  avgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  // Border-only distinction between the two badges — background/text stay
  // driven by avgColor(pct) (the score-based semantic color), unchanged.
  nutritionBadge: { borderColor: c.trendNutrition },
  energyBadge: { borderColor: c.trendEnergy },
  avgText: { color: c.textPrimary, fontWeight: '700', fontSize: 13 },
  batteryRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 48 },
  miniCell: { alignItems: 'center', flex: 1 },
  miniBar: {
    width: 20,
    borderRadius: 3,
    minHeight: 2,
  },
  miniLabel: { fontSize: 8, color: c.textMuted, marginTop: 2 },
});

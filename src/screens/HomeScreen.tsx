import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  Pressable,
} from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { LiveMasterBattery } from '../components/LiveMasterBattery';
import { BatteryRing } from '../components/BatteryRing';
import { ModeSelector } from '../components/ModeSelector';
import { IntakeModal } from '../components/IntakeModal';
import { BatterySourceSheet } from '../components/BatterySourceSheet';
import { EnergyActionsBar } from '../components/EnergyActionsBar';
import { TodayMeals } from '../components/TodayMeals';
import { TodayActivities } from '../components/TodayActivities';
import { TodayIntakes } from '../components/TodayIntakes';
import { EnergyBalanceCard } from '../components/EnergyBalanceCard';
import { HomeKeywordChips } from '../components/HomeKeywordChips';
import { computeDailyBatteryTotals } from '../domain/battery/dailyBatteryTotals';
import { pickHomeKeywords, type KeywordTargets } from '../domain/battery/homeKeywords';
import { useCurrentHour } from '../hooks/useCurrentHour';
import { MicroBatteryStack } from '../components/MicroBatteryStack';
import { SupplementQuickLog } from '../components/SupplementQuickLog';
import { FoldRow } from '../components/ui/FoldRow';
import { DetailsViewSuggestion } from '../components/DetailsViewSuggestion';
import { useHomeDetailsStore } from '../store/homeDetailsStore';
import { openLimit, toggleOpen } from '../domain/habits/detailViewHabit';
import { InfoPopover } from '../components/ui/InfoPopover';
import { DEFAULT_BATTERIES } from '../lib/constants';
import { sendLowBatteryAlerts } from '../services/notifications/notificationService';
import { useLowEnergyWatch } from '../hooks/useLowEnergyWatch';
import { useMicroBatteryHistory } from '../hooks/useMicroBatteryHistory';
import type { BatteryState, BatteryId, BatteryType } from '../types/battery';
import type { UserProfile } from '../types/energy';
import type { ModeId } from '../types/modes';
import { toPercentage } from '../domain/battery/batteryEngine';
import { waterRecommendationMl, sleepRecommendationH } from '../domain/rules/dailyRecommendations';
import { formatDisplayDate, todayString } from '../lib/dateUtils';
import { nextWaterDisplayUnit, nextMovementDisplayUnit } from '../lib/units';
import type { ThemeColors } from '../lib/theme';
import { useResolvedThemeMode, useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';
import { foodLogEntryDisplayName, getAnyFoodById } from '../data/food/foodLookup';
import { summarizeHomeDetails } from '../domain/battery/homeDetailsSummary';
import { LOCALE_TAGS } from '../i18n/types';

// Matches the TFn convention used across other components (e.g.
// BatterySourceSheet.tsx) — lets plain helper functions outside the
// component take the translator as an explicit parameter.
type TFn = (key: string, vars?: Record<string, string | number>) => string;

// Gentle, referential water/sleep recommendation line for IntakeModal (CHANGE
// 3) — a plain derivation from the daily-recommendation rules + today's
// activity, never a prescriptive target. Returns undefined for every other
// battery (they don't show this hint).
function buildRecommendation(
  t: TFn,
  battery: BatteryType | null,
  profile: UserProfile,
  hasWorkoutToday: boolean
): string | undefined {
  if (!battery) return undefined;
  if (battery.id === 'water') {
    const rec = waterRecommendationMl(profile, hasWorkoutToday);
    const minL = (rec.minMl / 1000).toFixed(1);
    const maxL = (rec.maxMl / 1000).toFixed(1);
    const workoutExtra = rec.workoutExtraMinMl > 0 ? t('screens.home.waterWorkoutExtra') : '';
    return t('screens.home.waterRecommendation', {
      minL,
      maxL,
      weight: profile.weightKg,
      workoutExtra,
    });
  }
  if (battery.id === 'sleep') {
    const rec = sleepRecommendationH(profile.age, hasWorkoutToday);
    const recoveryExtra = rec.trainingRecovery ? t('screens.home.sleepRecoveryExtra') : '';
    return t('screens.home.sleepRecommendation', {
      minH: rec.minH,
      maxH: rec.maxH,
      age: profile.age,
      recoveryExtra,
    });
  }
  return undefined;
}

// The folded rows under "Chi tiết hôm nay" — one open at a time.
type DetailId = 'meals' | 'activities' | 'balance' | 'micro' | 'supplements' | 'intakes';

// With 2–3 rows open, each scroll box shrinks to this so they share one screen.
const COMPACT_BODY_H = 220;

function isSupplementFood(foodId: string): boolean {
  return getAnyFoodById(foodId)?.category === 'supplement';
}

export function HomeScreen() {
  const { t, language } = useT();
  const {
    readings,
    foodLog,
    activityLog,
    intakeLog,
    isLoaded,
    loadToday,
    addIntake,
    removeFood,
    updateFood,
    removeIntake,
    removeActivity,
    updateActivity,
    appleHealthBurnedKcal,
    lastAppleHealthSync,
    appleHealthStatus,
  } = useEnergyStore();
  const {
    currentMode,
    setMode,
    notificationsEnabled,
    userProfile,
    waterDisplayUnit,
    setWaterDisplayUnit,
    movementDisplayUnit,
    setMovementDisplayUnit,
  } = useSettingsStore();
  const themeMode = useResolvedThemeMode();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBattery, setSelectedBattery] = useState<BatteryType | null>(null);
  // water/sleep: manual charge form (unchanged input, now with a recommendation hint)
  const [modalVisible, setModalVisible] = useState(false);
  // protein/carbs/minerals/movement: these auto-charge from logged food/activity,
  // so a tap opens a read-only "where did this come from" sheet instead (CHANGE 1).
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);
  // All detail rows start folded; open rows stay open while the user moves
  // between tabs (the screen stays mounted). One row at a time by default, up
  // to three in "view several" mode (⧉) — oldest first.
  const [openDetails, setOpenDetails] = useState<DetailId[]>([]);
  const viewMode = useHomeDetailsStore((s) => s.mode);
  const viewSuggestion = useHomeDetailsStore((s) => s.suggestion);
  const recordDetailOpen = useHomeDetailsStore((s) => s.recordOpen);
  const setViewMode = useHomeDetailsStore((s) => s.setMode);
  const dismissViewSuggestion = useHomeDetailsStore((s) => s.dismissSuggestion);
  const hour = useCurrentHour();

  useLowEnergyWatch();
  const microBattery = useMicroBatteryHistory(foodLog, userProfile);

  useEffect(() => {
    loadToday(currentMode);
    // loadToday is a zustand store action — its identity is stable across
    // renders (defined once in the store creator), so including it here is
    // safe and doesn't change when this effect re-runs (only currentMode
    // changing does).
  }, [currentMode, loadToday]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadToday(currentMode);
    setRefreshing(false);
  }

  function handleToggleWaterUnit() {
    setWaterDisplayUnit(nextWaterDisplayUnit(waterDisplayUnit));
  }

  function handleToggleMovementUnit() {
    setMovementDisplayUnit(nextMovementDisplayUnit(movementDisplayUnit));
  }

  function handleCellPress(id: string) {
    const bt = DEFAULT_BATTERIES.find((b) => b.id === id) ?? null;
    setSelectedBattery(bt);
    if (id === 'water' || id === 'sleep') {
      setModalVisible(true);
    } else {
      // protein/carbs/minerals/movement: manual charge is retired for these —
      // show their auto-charge sources instead.
      setSourceSheetVisible(true);
    }
  }

  // Only water/sleep still confirm through this form — the movement quick-tap
  // (and its stepType option) is retired along with the other auto-charged
  // pins' manual path, so no opts are forwarded to addIntake anymore.
  async function handleIntakeConfirm(amount: number, note: string) {
    if (!selectedBattery) return;
    // addIntake updates state and returns alerts computed from the fresh data.
    const alerts = await addIntake(selectedBattery.id as BatteryId, amount, note);
    if (notificationsEnabled && alerts.length > 0) {
      await sendLowBatteryAlerts(alerts);
    }
  }

  function handleModeChange(mode: ModeId) {
    setMode(mode);
  }

  function handleDeleteFood(id: string) {
    const entry = foodLog.find((f) => f.id === id);
    Alert.alert(
      t('screens.home.deleteFoodTitle'),
      entry
        ? t('screens.home.deleteFoodMessage', { name: foodLogEntryDisplayName(entry, language) })
        : undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => {
          haptics.warning();
          removeFood(id);
        } },
      ]
    );
  }

  function handleDeleteActivity(id: string) {
    Alert.alert(
      t('screens.home.deleteActivityTitle'),
      t('screens.home.deleteActivityMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => {
          haptics.warning();
          removeActivity(id);
        } },
      ]
    );
  }

  function handleEditFood(id: string, patch: { grams?: number; count?: number }) {
    updateFood(id, patch);
  }

  function handleDeleteIntake(id: string) {
    const entry = intakeLog.find((e) => e.id === id);
    Alert.alert(
      t('screens.home.deleteIntakeTitle'),
      entry ? t('screens.home.deleteIntakeMessage', { amount: entry.amount }) : undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('screens.home.undoButton'), style: 'destructive', onPress: () => {
          haptics.warning();
          removeIntake(id);
        } },
      ]
    );
  }

  // The 6 nutrient sub-batteries (exclude master + the energy battery, which is
  // shown as the headline MasterBattery in Hướng B).
  const batteryStates: BatteryState[] = readings
    .filter((r) => r.batteryTypeId !== 'master' && r.batteryTypeId !== 'energy')
    .map((r) => {
      const type = DEFAULT_BATTERIES.find((b) => b.id === r.batteryTypeId)!;
      return {
        type,
        level: r.level,
        capacity: r.capacity,
        percentage: toPercentage(r.level, r.capacity),
      };
    });

  // Keyword chips: the (at most) three sub-batteries most in need right now,
  // paced by the hour. Targets = each battery's daily capacity, the same
  // denominator the ring uses.
  const keywordTargets: KeywordTargets = {};
  for (const b of batteryStates) {
    if (b.type.id === 'protein' || b.type.id === 'water' || b.type.id === 'sleep' || b.type.id === 'movement') {
      keywordTargets[b.type.id] = b.capacity;
    }
  }
  const keywords = pickHomeKeywords(computeDailyBatteryTotals(foodLog, activityLog, intakeLog), keywordTargets, hour);

  // Plain render-time derivations for the two sheets below — no effects.
  const hasWorkoutToday = activityLog.some((e) => e.workouts.length > 0 || e.steps > 0);
  const recommendation = buildRecommendation(t, selectedBattery, userProfile, hasWorkoutToday);
  const selectedBatteryLevel =
    readings.find((r) => r.batteryTypeId === selectedBattery?.id)?.level ?? 0;

  const details = summarizeHomeDetails({
    foodLog,
    activityLog,
    intakeLog,
    microStates: microBattery.states,
    burnedKcal: appleHealthBurnedKcal,
    isSupplement: isSupplementFood,
  });
  const num = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);
  const empty = t('screens.home.details.empty');
  const openLimitNow = openLimit(viewMode);
  const openNow = openDetails.slice(-openLimitNow); // switching back to one row keeps the latest
  const isOpen = (id: DetailId) => openNow.includes(id);
  const bodyH = (full?: number) => (openNow.length > 1 ? COMPACT_BODY_H : full);
  function toggleDetail(id: DetailId) {
    const next = toggleOpen(openNow, id, openLimitNow) as DetailId[];
    if (!openNow.includes(id)) recordDetailOpen(id, next.length);
    setOpenDetails(next);
  }

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('screens.home.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.textPrimary} />
        }
      >
        {/* Header — title and date share one line */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Body Batteries</Text>
          <Text style={styles.headerDate} numberOfLines={1}>
            {formatDisplayDate(todayString(), language)}
          </Text>
        </View>

        {/* Mode selector */}
        <ModeSelector currentMode={currentMode} onChange={handleModeChange} />

        {/* Master battery = energy / calorie balance (Hướng B), ticking live per second */}
        <View style={styles.masterContainer}>
          <LiveMasterBattery />
        </View>

        {/* Eat / move quick actions feeding the energy battery */}
        <EnergyActionsBar />

        {/* Sub-batteries — how-to text lives behind ⓘ */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>{t('screens.home.subBatteriesTitle')}</Text>
          <InfoPopover
            title={t('screens.home.subBatteriesTitle')}
            sections={[{ body: t('screens.home.hint') }]}
          />
        </View>
        <HomeKeywordChips keywords={keywords} onPress={handleCellPress} />
        <BatteryRing
          batteries={batteryStates}
          onPressCell={handleCellPress}
          waterDisplayUnit={waterDisplayUnit}
          onToggleWaterUnit={handleToggleWaterUnit}
          movementDisplayUnit={movementDisplayUnit}
          onToggleMovementUnit={handleToggleMovementUnit}
          foodLog={foodLog}
          activityLog={activityLog}
          intakeLog={intakeLog}
        />

        {/* Details: one folded row per block — keyword + key number, the
            block opens on tap (one at a time, or up to three with ⧉), long
            lists scroll inside. */}
        <View>
          <View style={styles.detailsHead}>
            <Text style={[styles.sectionLabel, styles.detailsTitle]}>{t('screens.home.detailsSectionTitle')}</Text>
            <Pressable
              onPress={() => setViewMode(viewMode === 'multi' ? 'single' : 'multi')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.modePill,
                viewMode === 'multi' && styles.modePillOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: viewMode === 'multi' }}
              accessibilityLabel={t(
                viewMode === 'multi' ? 'screens.home.details.modeMultiA11y' : 'screens.home.details.modeSingleA11y'
              )}
            >
              <Text style={[styles.modePillText, viewMode === 'multi' && styles.modePillTextOn]}>
                ⧉ {openLimitNow}
              </Text>
            </Pressable>
            <InfoPopover
              title={t('screens.home.details.modeInfoTitle')}
              sections={[
                { body: t('screens.home.details.modeInfo') },
                { body: t('screens.home.details.modeLearnInfo') },
              ]}
            />
          </View>
          {viewSuggestion != null && viewSuggestion !== viewMode && (
            <DetailsViewSuggestion
              suggestion={viewSuggestion}
              onAccept={() => setViewMode(viewSuggestion)}
              onLater={() => dismissViewSuggestion()}
            />
          )}

          <FoldRow
            icon="🍽"
            title={t('screens.home.details.meals')}
            value={
              details.mealCount > 0
                ? t('screens.home.details.mealsSummary', { kcal: num(details.mealsKcal), count: details.mealCount })
                : empty
            }
            open={isOpen('meals')}
            onToggle={() => toggleDetail('meals')}
            maxBodyHeight={bodyH(360)}
          >
            {/* Today's logged meals (grouped by meal + macro line) */}
            <TodayMeals entries={foodLog} onDelete={handleDeleteFood} onEdit={handleEditFood} embedded />
          </FoldRow>

          <FoldRow
            icon="🔥"
            title={t('screens.home.details.activities')}
            value={
              details.activityCount > 0
                ? t('screens.home.details.activitiesSummary', {
                    kcal: num(details.activityKcal),
                    count: details.activityCount,
                  })
                : empty
            }
            open={isOpen('activities')}
            onToggle={() => toggleDetail('activities')}
            maxBodyHeight={bodyH(300)}
          >
            <TodayActivities
              entries={activityLog}
              onDelete={handleDeleteActivity}
              onEdit={(id, patch) => updateActivity(id, patch)}
              embedded
            />
          </FoldRow>

          <FoldRow
            icon="⚖️"
            title={t('screens.home.details.balance')}
            value={
              details.balanceKcal >= 0
                ? t('components.energyBalanceCard.balanceSurplusLine', { amount: num(details.balanceKcal) })
                : t('components.energyBalanceCard.balanceDeficitLine', { amount: num(details.balanceKcal) })
            }
            info={[{ body: t('screens.home.details.balanceInfo') }]}
            open={isOpen('balance')}
            onToggle={() => toggleDetail('balance')}
            maxBodyHeight={bodyH()}
          >
            {/* Apple Health burned vs. eaten */}
            <EnergyBalanceCard
              foodLog={foodLog}
              burnedKcal={appleHealthBurnedKcal}
              status={appleHealthStatus}
              lastSyncAt={lastAppleHealthSync}
              embedded
            />
          </FoldRow>

          <FoldRow
            icon="🧪"
            title={t('screens.home.details.micro')}
            value={
              t('screens.home.details.microSummary', { count: details.microCount }) +
              (details.microWarnCount > 0
                ? t('screens.home.details.microWarnSuffix', { count: details.microWarnCount })
                : '')
            }
            info={[
              {
                body: t(
                  userProfile.sex === 'male'
                    ? 'screens.home.recommendNoteMale'
                    : 'screens.home.recommendNoteFemale',
                  { age: userProfile.age }
                ),
              },
              { body: t('components.microBatteryStack.disclaimer') },
            ]}
            open={isOpen('micro')}
            onToggle={() => toggleDetail('micro')}
            maxBodyHeight={bodyH()}
          >
            {/* Micronutrient batteries derived from today's (or a past 7-day) food log */}
            <MicroBatteryStack
              states={microBattery.states}
              dates={microBattery.dates}
              selectedDate={microBattery.selectedDate}
              onSelectDate={microBattery.setSelectedDate}
              foodLog={microBattery.entries}
              embedded
            />
          </FoldRow>

          <FoldRow
            icon="💊"
            title={t('screens.home.details.supplements')}
            value={
              details.supplementDoses > 0
                ? t('screens.home.details.supplementsSummary', { count: details.supplementDoses })
                : empty
            }
            info={[{ body: t('components.supplementQuickLog.hintText') }]}
            open={isOpen('supplements')}
            onToggle={() => toggleDetail('supplements')}
            maxBodyHeight={bodyH()}
          >
            {/* One-tap supplement dosing (fish oil, whey, vitamins…) */}
            <SupplementQuickLog todayLog={foodLog} embedded />
          </FoldRow>

          <FoldRow
            icon="💧"
            title={t('screens.home.details.intakes')}
            value={
              details.intakeCount > 0
                ? t('screens.home.details.intakesSummary', { count: details.intakeCount })
                : empty
            }
            open={isOpen('intakes')}
            onToggle={() => toggleDetail('intakes')}
            maxBodyHeight={bodyH(300)}
          >
            {/* Quick-tap intake history with one-tap undo */}
            <TodayIntakes entries={intakeLog} onDelete={handleDeleteIntake} embedded />
          </FoldRow>
        </View>
      </ScrollView>

      <IntakeModal
        battery={selectedBattery}
        visible={modalVisible}
        onConfirm={handleIntakeConfirm}
        onClose={() => setModalVisible(false)}
        waterDisplayUnit={waterDisplayUnit}
        onToggleWaterUnit={handleToggleWaterUnit}
        recommendationVi={recommendation}
      />

      <BatterySourceSheet
        battery={selectedBattery}
        visible={sourceSheetVisible}
        onClose={() => setSourceSheetVisible(false)}
        foodLog={foodLog}
        activityLog={activityLog}
        intakeLog={intakeLog}
        level={selectedBatteryLevel}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: c.textSecondary,
    fontSize: 16,
  },
  scroll: {
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: c.textPrimary,
  },
  headerDate: {
    flexShrink: 1,
    fontSize: 13,
    color: c.textTertiary,
  },
  masterContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: -12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textTertiary,
  },
  detailsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  detailsTitle: { flex: 1 },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.bgElevated,
  },
  modePillOn: { borderColor: c.accent },
  modePillText: { fontSize: 12, fontWeight: '700', color: c.textTertiary, fontVariant: ['tabular-nums'] },
  modePillTextOn: { color: c.accent },
  pressed: { opacity: 0.6 },
});

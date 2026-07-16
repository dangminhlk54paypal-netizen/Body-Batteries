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
} from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { LiveMasterBattery } from '../components/LiveMasterBattery';
import { BatteryStack } from '../components/BatteryStack';
import { ModeSelector } from '../components/ModeSelector';
import { IntakeModal } from '../components/IntakeModal';
import { BatterySourceSheet } from '../components/BatterySourceSheet';
import { EnergyActionsBar } from '../components/EnergyActionsBar';
import { TodayMeals } from '../components/TodayMeals';
import { TodayActivities } from '../components/TodayActivities';
import { TodayIntakes } from '../components/TodayIntakes';
import { EnergyBalanceCard } from '../components/EnergyBalanceCard';
import { MicroBatteryStack } from '../components/MicroBatteryStack';
import { SupplementQuickLog } from '../components/SupplementQuickLog';
import { DEFAULT_BATTERIES } from '../lib/constants';
import { sendLowBatteryAlerts } from '../services/notifications/notificationService';
import { useLowEnergyWatch } from '../hooks/useLowEnergyWatch';
import { useMicroBatteryHistory } from '../hooks/useMicroBatteryHistory';
import type { BatteryState, BatteryId, BatteryType } from '../types/battery';
import type { UserProfile } from '../types/energy';
import type { ModeId } from '../types/modes';
import { toPercentage } from '../domain/battery/batteryEngine';
import { stepsKcal } from '../domain/energy/metabolismEngine';
import { waterRecommendationMl, sleepRecommendationH } from '../domain/rules/dailyRecommendations';
import { formatDisplayDate, todayString } from '../lib/dateUtils';
import { nextWaterDisplayUnit, nextMovementDisplayUnit } from '../lib/units';
import { colors } from '../lib/theme';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBattery, setSelectedBattery] = useState<BatteryType | null>(null);
  // water/sleep: manual charge form (unchanged input, now with a recommendation hint)
  const [modalVisible, setModalVisible] = useState(false);
  // protein/carbs/minerals/movement: these auto-charge from logged food/activity,
  // so a tap opens a read-only "where did this come from" sheet instead (CHANGE 1).
  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);

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
      entry ? t('screens.home.deleteFoodMessage', { name: entry.foodNameVi }) : undefined,
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

  // Plain render-time derivations for the two sheets below — no effects.
  const hasWorkoutToday = activityLog.some((e) => e.workouts.length > 0 || e.steps > 0);
  const recommendation = buildRecommendation(t, selectedBattery, userProfile, hasWorkoutToday);
  const selectedBatteryLevel =
    readings.find((r) => r.batteryTypeId === selectedBattery?.id)?.level ?? 0;
  // Kcal estimate of the movement pin's step level (walking rate — the v1
  // display conversion). Computed here so lib/units.formatMovementAmount can
  // stay a pure formatter with no domain import.
  const movementLevel = readings.find((r) => r.batteryTypeId === 'movement')?.level ?? 0;
  const movementKcalEquivalent = stepsKcal(movementLevel, userProfile.weightKg);

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
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textPrimary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Body Batteries</Text>
          <Text style={styles.headerDate}>{formatDisplayDate(todayString(), language)}</Text>
        </View>

        {/* Mode selector */}
        <ModeSelector currentMode={currentMode} onChange={handleModeChange} />

        {/* Master battery = energy / calorie balance (Hướng B), ticking live per second */}
        <View style={styles.masterContainer}>
          <LiveMasterBattery />
        </View>

        {/* Eat / move quick actions feeding the energy battery */}
        <EnergyActionsBar />

        {/* Sub-batteries */}
        <Text style={styles.sectionLabel}>{t('screens.home.subBatteriesLabel')}</Text>
        <BatteryStack
          batteries={batteryStates}
          onPressCell={handleCellPress}
          waterDisplayUnit={waterDisplayUnit}
          onToggleWaterUnit={handleToggleWaterUnit}
          movementDisplayUnit={movementDisplayUnit}
          onToggleMovementUnit={handleToggleMovementUnit}
          movementKcal={movementKcalEquivalent}
        />

        {/* Apple Health energy balance — secondary info below the battery display */}
        <EnergyBalanceCard
          foodLog={foodLog}
          burnedKcal={appleHealthBurnedKcal}
          status={appleHealthStatus}
          lastSyncAt={lastAppleHealthSync}
        />

        {/* Micronutrient batteries derived from today's (or a past 7-day) food log */}
        <MicroBatteryStack
          states={microBattery.states}
          dates={microBattery.dates}
          selectedDate={microBattery.selectedDate}
          onSelectDate={microBattery.setSelectedDate}
          recommendNote={t(
            userProfile.sex === 'male'
              ? 'screens.home.recommendNoteMale'
              : 'screens.home.recommendNoteFemale',
            { age: userProfile.age }
          )}
        />

        {/* One-tap supplement dosing (fish oil, whey, vitamins…) */}
        <SupplementQuickLog todayLog={foodLog} />

        {/* Quick-tap intake history with one-tap undo */}
        <TodayIntakes entries={intakeLog} onDelete={handleDeleteIntake} />

        {/* Today's logged meals (grouped by meal + daily kcal total) */}
        <TodayMeals entries={foodLog} onDelete={handleDeleteFood} onEdit={handleEditFood} />

        {/* Today's logged activity (steps/workouts) with Sửa/Xoá */}
        <TodayActivities
          entries={activityLog}
          onDelete={handleDeleteActivity}
          onEdit={(id, patch) => updateActivity(id, patch)}
        />

        {/* Hint */}
        <Text style={styles.hint}>{t('screens.home.hint')}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  scroll: {
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerDate: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  masterContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textTertiary,
    paddingHorizontal: 20,
    marginBottom: -12,
  },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

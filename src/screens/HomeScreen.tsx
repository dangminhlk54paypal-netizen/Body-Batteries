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
import { EnergyActionsBar } from '../components/EnergyActionsBar';
import { TodayMeals } from '../components/TodayMeals';
import { TodayActivities } from '../components/TodayActivities';
import { TodayIntakes } from '../components/TodayIntakes';
import { MicroBatteryStack } from '../components/MicroBatteryStack';
import { SupplementQuickLog } from '../components/SupplementQuickLog';
import { DEFAULT_BATTERIES } from '../lib/constants';
import { sendLowBatteryAlerts } from '../services/notifications/notificationService';
import { useLowEnergyWatch } from '../hooks/useLowEnergyWatch';
import { useMicroBatteryHistory } from '../hooks/useMicroBatteryHistory';
import type { BatteryState, BatteryId, BatteryType } from '../types/battery';
import type { ModeId } from '../types/modes';
import { toPercentage } from '../domain/battery/batteryEngine';
import { formatDisplayDate, todayString } from '../lib/dateUtils';
import { colors } from '../lib/theme';

export function HomeScreen() {
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
  } = useEnergyStore();
  const { currentMode, setMode, notificationsEnabled, userProfile } = useSettingsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBattery, setSelectedBattery] = useState<BatteryType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  function handleCellPress(id: string) {
    const bt = DEFAULT_BATTERIES.find((b) => b.id === id) ?? null;
    setSelectedBattery(bt);
    setModalVisible(true);
  }

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
      'Xoá món đã ghi?',
      entry ? `“${entry.foodNameVi}” sẽ bị xoá và pin được hoàn lại.` : undefined,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => removeFood(id) },
      ]
    );
  }

  function handleDeleteActivity(id: string) {
    Alert.alert(
      'Xoá vận động đã ghi?',
      'Mục này sẽ bị xoá và pin được hoàn lại.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => removeActivity(id) },
      ]
    );
  }

  function handleEditFood(id: string, patch: { grams?: number; count?: number }) {
    updateFood(id, patch);
  }

  function handleDeleteIntake(id: string) {
    const entry = intakeLog.find((e) => e.id === id);
    Alert.alert(
      'Hoàn tác lần nạp này?',
      entry ? `Sẽ hoàn tác lần nạp ${entry.amount} và trừ lại pin tương ứng.` : undefined,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Hoàn tác', style: 'destructive', onPress: () => removeIntake(id) },
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

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang khởi động pin...</Text>
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
          <Text style={styles.headerDate}>{formatDisplayDate(todayString())}</Text>
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
        <Text style={styles.sectionLabel}>Các pin nhỏ — bấm để nạp ⚡</Text>
        <BatteryStack batteries={batteryStates} onPressCell={handleCellPress} />

        {/* Micronutrient batteries derived from today's (or a past 7-day) food log */}
        <MicroBatteryStack
          states={microBattery.states}
          dates={microBattery.dates}
          selectedDate={microBattery.selectedDate}
          onSelectDate={microBattery.setSelectedDate}
          recommendNote={`KN = mức khuyến nghị chung cho ${
            userProfile.sex === 'male' ? 'nam' : 'nữ'
          } ${userProfile.age} tuổi — không phải chỉ định y tế.`}
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
        <Text style={styles.hint}>Kéo xuống để làm mới • Bấm vào pin để nạp</Text>
      </ScrollView>

      <IntakeModal
        battery={selectedBattery}
        visible={modalVisible}
        onConfirm={handleIntakeConfirm}
        onClose={() => setModalVisible(false)}
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

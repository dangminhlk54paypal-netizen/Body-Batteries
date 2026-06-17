import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { MasterBattery } from '../components/MasterBattery';
import { BatteryStack } from '../components/BatteryStack';
import { ModeSelector } from '../components/ModeSelector';
import { IntakeModal } from '../components/IntakeModal';
import { DEFAULT_BATTERIES } from '../lib/constants';
import { checkLowBattery } from '../domain/rules/lowBatteryRules';
import { sendLowBatteryAlerts } from '../services/notifications/notificationService';
import type { BatteryState, BatteryId } from '../types/battery';
import type { BatteryType } from '../types/battery';
import type { ModeId } from '../types/modes';
import { toPercentage } from '../domain/battery/batteryEngine';
import { formatDisplayDate, todayString } from '../lib/dateUtils';

export function HomeScreen() {
  const { readings, masterPercentage, isLoaded, loadToday, addIntake } = useEnergyStore();
  const { currentMode, setMode } = useSettingsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBattery, setSelectedBattery] = useState<BatteryType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadToday(currentMode);
  }, [currentMode]);

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
    await addIntake(selectedBattery.id as BatteryId, amount, note);

    const alerts = checkLowBattery(readings);
    if (alerts.length > 0) {
      await sendLowBatteryAlerts(alerts);
    }
  }

  function handleModeChange(mode: ModeId) {
    setMode(mode);
  }

  const batteryStates: BatteryState[] = readings
    .filter((r) => r.batteryTypeId !== 'master')
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
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Body Batteries</Text>
          <Text style={styles.headerDate}>{formatDisplayDate(todayString())}</Text>
        </View>

        {/* Mode selector */}
        <ModeSelector currentMode={currentMode} onChange={handleModeChange} />

        {/* Master battery */}
        <View style={styles.masterContainer}>
          <MasterBattery percentage={masterPercentage} />
        </View>

        {/* Sub-batteries */}
        <Text style={styles.sectionLabel}>Các pin nhỏ — bấm để nạp ⚡</Text>
        <BatteryStack batteries={batteryStates} onPressCell={handleCellPress} />

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
    backgroundColor: '#0d0d1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
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
    color: '#fff',
  },
  headerDate: {
    fontSize: 14,
    color: '#888',
  },
  masterContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: -12,
  },
  hint: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

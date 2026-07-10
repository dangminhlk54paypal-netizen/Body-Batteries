import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { summarizeFoodLog } from '../domain/food/foodLogSummary';
import type { FoodLogEntry } from '../types/food';
import { AppleHealthStatusBadge, type AppleHealthStatus } from './AppleHealthStatusBadge';

interface Props {
  foodLog: FoodLogEntry[]; // today's meals — "Eaten Today" is derived from this, same source TodayMeals uses
  burnedKcal: number; // appleHealthBurnedKcal from energyStore (real sync or BMR estimate)
  status: AppleHealthStatus;
  lastSyncAt: number | null;
}

// "Energy Balance" section — secondary display below the main battery
// visualization, showing burned (Apple Health) vs. eaten (food log) kcal and
// their balance. Purely presentational: reads already-computed store state,
// derives "eaten" via the same summarizeFoodLog domain function TodayMeals
// uses (no new business logic here).
export function EnergyBalanceCard({ foodLog, burnedKcal, status, lastSyncAt }: Props) {
  // Lazy initializer, not a bare Date.now() call during render — matches the
  // pattern useLiveEnergyReading.ts already uses to stay clear of
  // react-hooks/purity. Doesn't need a ticking interval: the badge only shows
  // minute-granularity relative time, and this re-renders naturally whenever
  // the store updates (loadToday, syncAppleHealthBurned, food log changes).
  const [nowMs] = useState(() => Date.now());

  const eatenKcal = summarizeFoodLog(foodLog).totalKcal;
  const balance = Math.round(eatenKcal - burnedKcal);
  const isSurplus = balance >= 0;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Cân bằng năng lượng</Text>

      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>Đã đốt hôm nay</Text>
          <AppleHealthStatusBadge status={status} lastSyncAt={lastSyncAt} nowMs={nowMs} />
        </View>
        <Text style={styles.rowValue}>{Math.round(burnedKcal)} kcal</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Đã ăn hôm nay</Text>
        <Text style={styles.rowValue}>{Math.round(eatenKcal)} kcal</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.balanceLabel}>Chênh lệch</Text>
        <Text style={[styles.balanceValue, { color: isSurplus ? colors.mint : colors.danger }]}>
          {isSurplus ? '+' : ''}
          {balance} kcal ({isSurplus ? 'dư' : 'thiếu'})
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    padding: 14,
    gap: 10,
  },
  sectionLabel: { fontSize: 13, color: colors.textTertiary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowLabel: { fontSize: 14, color: colors.textSoft },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.divider },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: colors.textSoft },
  balanceValue: { fontSize: 16, fontWeight: '800' },
});

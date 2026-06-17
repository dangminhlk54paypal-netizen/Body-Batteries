import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getReadingsInRange } from '../data/repositories/batteryRepository';
import { getLogsInRange } from '../data/repositories/dailyLogRepository';
import type { BatteryReading } from '../types/battery';
import type { DailyLog } from '../types/battery';
import { todayString, daysAgo, formatDisplayDate } from '../lib/dateUtils';
import { toPercentage } from '../domain/battery/batteryEngine';
import { DEFAULT_BATTERIES } from '../lib/constants';

interface DayData {
  date: string;
  modeId: string;
  readings: BatteryReading[];
  averagePercentage: number;
}

export function HistoryScreen() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const toDate = todayString();
    const fromDate = daysAgo(7);

    const [readings, logs] = await Promise.all([
      getReadingsInRange(fromDate, toDate),
      getLogsInRange(fromDate, toDate),
    ]);

    const logMap: Record<string, DailyLog> = {};
    logs.forEach((l) => (logMap[l.date] = l));

    const dateSet = [...new Set(readings.map((r) => r.date))].sort().reverse();

    const dayData: DayData[] = dateSet.map((date) => {
      const dayReadings = readings.filter((r) => r.date === date && r.batteryTypeId !== 'master');
      const avg =
        dayReadings.length > 0
          ? Math.round(
              dayReadings.reduce((s, r) => s + toPercentage(r.level, r.capacity), 0) /
                dayReadings.length
            )
          : 0;
      return {
        date,
        modeId: logMap[date]?.modeId ?? 'maintain',
        readings: dayReadings,
        averagePercentage: avg,
      };
    });

    setDays(dayData);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Lịch sử 7 ngày</Text>

        {days.length === 0 && (
          <Text style={styles.empty}>Chưa có dữ liệu nào. Hãy nạp pin đầu tiên!</Text>
        )}

        {days.map((day) => (
          <View key={day.date} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDisplayDate(day.date)}</Text>
              <View style={[styles.avgBadge, avgColor(day.averagePercentage)]}>
                <Text style={styles.avgText}>{day.averagePercentage}%</Text>
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
                    <Text style={styles.miniLabel}>{type.name.slice(0, 4)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function avgColor(pct: number) {
  if (pct >= 60) return { backgroundColor: '#00B89422' };
  if (pct >= 30) return { backgroundColor: '#FFD93D22' };
  return { backgroundColor: '#FF475722' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  empty: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: { fontSize: 15, fontWeight: '600', color: '#fff' },
  avgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  avgText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  batteryRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 48 },
  miniCell: { alignItems: 'center', flex: 1 },
  miniBar: {
    width: 20,
    borderRadius: 3,
    minHeight: 2,
  },
  miniLabel: { fontSize: 8, color: '#666', marginTop: 2 },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { summarizeFoodLog } from '../domain/food/foodLogSummary';
import { MEAL_LABELS } from '../lib/constants';
import type { FoodLogEntry } from '../types/food';

interface Props {
  entries: FoodLogEntry[];
  onDelete: (id: string) => void;
}

function timeLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TodayMeals({ entries, onDelete }: Props) {
  const summary = summarizeFoodLog(entries);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Hôm nay đã ăn</Text>
        <Text style={styles.totalKcal}>⚡ {summary.totalKcal} kcal</Text>
      </View>

      {summary.groups.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Chưa ghi món nào hôm nay. Bấm “🍱 Ghi món ăn” để bắt đầu.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.macroLine}>
            Đạm {summary.totalProteinG}g · Tinh bột {summary.totalCarbG}g · Béo{' '}
            {summary.totalFatG}g
          </Text>
          {summary.groups.map((group) => (
            <View key={group.mealType} style={styles.card}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{MEAL_LABELS[group.mealType]}</Text>
                <Text style={styles.mealKcal}>{group.totalKcal} kcal</Text>
              </View>
              {group.entries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryMain}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.foodNameVi}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {timeLabel(e.timestamp)} · {e.grams}g · {e.energyKcal} kcal
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                    onPress={() => onDelete(e.id)}
                  >
                    <Text style={styles.deleteText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: { fontSize: 13, color: '#888' },
  totalKcal: { fontSize: 15, fontWeight: '800', color: '#00B894' },
  macroLine: { fontSize: 12, color: '#777', marginTop: -4 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: '#888', fontSize: 13, lineHeight: 19 },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
    paddingBottom: 6,
  },
  mealTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  mealKcal: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryMain: { flex: 1 },
  entryName: { color: '#eee', fontSize: 14, fontWeight: '500' },
  entryMeta: { color: '#888', fontSize: 12, marginTop: 1 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.5 },
});

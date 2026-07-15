import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { buildNutritionDetail } from '../../domain/food/nutritionDetail';
import { getAnyFoodById } from '../../data/food/foodLookup';
import type { FoodLogEntry } from '../../types/food';
import { colors } from '../../lib/theme';

interface Props {
  // The logged entry to show the breakdown for. null/undefined means "closed"
  // — the sheet still needs `visible` too so it can slide out smoothly
  // instead of popping its content away mid-animation.
  entry: FoodLogEntry | null;
  visible: boolean;
  onClose: () => void;
}

function timeLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Mirrors TodayMeals.amountLabel: packs/capsules (TPCN) are shown by count
// ("2 viên"), everything else by gram weight.
function portionLabel(entry: FoodLogEntry): string {
  if (entry.portionUnit === 'pack' && entry.count != null) {
    return `${entry.count} gói`;
  }
  if (entry.portionUnit === 'capsule' && entry.count != null) {
    return `${entry.count} viên`;
  }
  return `${entry.grams}g`;
}

const MAX_TABLE_HEIGHT = Dimensions.get('window').height * 0.6;

// Read-only breakdown of a single logged food entry — display only, no
// editing. Resolves the FoodItem via getAnyFoodById (the mandatory lookup for
// logged foods, merging any user override) and hands it to the pure domain
// helper buildNutritionDetail for the actual row derivation.
export function NutritionDetailSheet({ entry, visible, onClose }: Props) {
  // Both calls below are plain, synchronous, deterministic lookups/derivations
  // (in-memory map/registry reads + pure math) — safe to run directly during
  // render, same pattern as TodayMeals' summarizeFoodLog(entries) call.
  const item = entry ? (getAnyFoodById(entry.foodId) ?? null) : null;
  const rows = entry ? buildNutritionDetail(entry, item) : [];

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={500}>
      {entry && (
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {entry.foodNameVi}
          </Text>
          <Text style={styles.subtitle}>
            {portionLabel(entry)} · {timeLabel(entry.timestamp)}
          </Text>

          <ScrollView
            style={[styles.table, { maxHeight: MAX_TABLE_HEIGHT }]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>
                  {row.value} {row.unit}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  table: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

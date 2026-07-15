import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SectionList,
} from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { NutritionDetailSheet } from './food/NutritionDetailSheet';
import { MEAL_LABELS } from '../lib/constants';
import { formatDisplayDate } from '../lib/dateUtils';
import type { FoodLogEntry, MealType } from '../types/food';
import { colors } from '../lib/theme';

interface DayDetailSheetProps {
  visible: boolean;
  date: string; // YYYY-MM-DD
  entries: FoodLogEntry[];
  loading?: boolean;
  onClose: () => void;
  onAddFood: () => void;
  onDeleteEntry: (entry: FoodLogEntry) => void;
}

// Helper to group entries by mealType
function groupEntriesByMeal(entries: FoodLogEntry[]): Record<MealType, FoodLogEntry[]> {
  const grouped: Record<MealType, FoodLogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  entries.forEach((entry) => {
    grouped[entry.mealType].push(entry);
  });

  return grouped;
}

// Format portion display: "X viên" or "Yg g"
function formatPortion(entry: FoodLogEntry): string {
  if (entry.portionUnit && entry.count !== undefined) {
    const unitLabel = entry.portionUnit === 'pack' ? 'gói' : 'viên';
    return `${entry.count} ${unitLabel}`;
  }
  return `${entry.grams}g`;
}

// One SectionList section: a meal's label + its entries.
interface MealSection {
  title: string;
  mealType: MealType;
  data: FoodLogEntry[];
}

// Build SectionList data from grouped meals
function buildSectionData(grouped: Record<MealType, FoodLogEntry[]>): MealSection[] {
  const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sections: MealSection[] = [];

  for (const mealType of mealOrder) {
    const items = grouped[mealType];
    if (items.length > 0) {
      sections.push({
        title: MEAL_LABELS[mealType],
        mealType,
        data: items,
      });
    }
  }

  return sections;
}

export function DayDetailSheet({
  visible,
  date,
  entries,
  loading = false,
  onClose,
  onAddFood,
  onDeleteEntry,
}: DayDetailSheetProps) {
  const grouped = useMemo(() => groupEntriesByMeal(entries), [entries]);

  // The entry whose full nutrition breakdown is shown in the read-only
  // detail sheet (tap an entry's name/portion area to open it).
  const [detailEntry, setDetailEntry] = useState<FoodLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const summary = useMemo(() => {
    const totalKcal = entries.reduce((sum, e) => sum + e.energyKcal, 0);
    const totalProtein = entries.reduce((sum, e) => sum + e.proteinG, 0);
    return { totalKcal: Math.round(totalKcal), totalProtein: Math.round(totalProtein * 10) / 10 };
  }, [entries]);

  const sectionData = useMemo(() => buildSectionData(grouped), [grouped]);

  const handleDelete = (entry: FoodLogEntry) => {
    Alert.alert('Xoá món ăn', `Bạn chắc chắn muốn xoá "${entry.foodNameVi}"?`, [
      { text: 'Huỷ', onPress: () => {}, style: 'cancel' },
      {
        text: 'Xoá',
        onPress: () => onDeleteEntry(entry),
        style: 'destructive',
      },
    ]);
  };

  const renderEntry = ({ item: entry }: { item: FoodLogEntry }) => (
    <View style={styles.entryRow}>
      <Pressable
        style={({ pressed }) => [styles.entryLeft, pressed && { opacity: 0.6 }]}
        onPress={() => {
          setDetailEntry(entry);
          setDetailVisible(true);
        }}
      >
        <Text style={styles.foodName} numberOfLines={2}>
          {entry.foodNameVi}
        </Text>
        <Text style={styles.portion}>{formatPortion(entry)}</Text>
      </Pressable>
      <View style={styles.entryRight}>
        <Text style={styles.energyLabel}>{entry.energyKcal} kcal</Text>
        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={() => handleDelete(entry)}
        >
          <Text style={styles.deleteIcon}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: MealSection }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Chưa ghi món nào cho ngày này</Text>
    </View>
  );

  return (
    <>
      {/* Hide the outer sheet while the nested detail sheet is open — two RN
          <Modal visible> at once causes the second one to not render on iOS
          (same fix as FoodLogModal's editingNutrition guard). */}
      <BottomSheet visible={visible && !detailVisible} onClose={onClose} sheetOffset={600}>
        <ScrollView
          scrollEnabled={false}
          style={styles.sheetContent}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Header: Date title */}
          <Text style={styles.sheetTitle}>{formatDisplayDate(date)}</Text>

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}

          {/* Summary line: total kcal & protein */}
          {!loading && entries.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                Tổng: {summary.totalKcal} kcal · Đạm {summary.totalProtein}g
              </Text>
            </View>
          )}

          {/* Entries list grouped by meal type */}
          {!loading && entries.length > 0 ? (
            <View style={styles.entriesContainer}>
              <SectionList
                sections={sectionData}
                keyExtractor={(item) => item.id}
                renderItem={renderEntry}
                renderSectionHeader={renderSectionHeader}
                scrollEnabled={false}
              />
            </View>
          ) : !loading ? (
            renderEmptyState()
          ) : null}

          {/* Add food button */}
          {!loading && (
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={onAddFood}
            >
              <Text style={styles.addButtonText}>＋ Thêm món cho ngày này</Text>
            </Pressable>
          )}
        </ScrollView>
      </BottomSheet>

      <NutritionDetailSheet
        entry={detailEntry}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  summaryRow: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textBright,
  },
  entriesContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    marginBottom: 8,
  },
  entryLeft: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  portion: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  energyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: colors.accentAltBg,
    borderWidth: 1.5,
    borderColor: colors.accentAlt,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentAlt,
  },
});

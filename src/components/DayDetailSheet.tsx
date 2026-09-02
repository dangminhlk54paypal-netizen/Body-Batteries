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
import { mealLabel } from '../lib/constants';
import { formatDisplayDate } from '../lib/dateUtils';
import { foodLogEntryDisplayName, getAnyFoodById } from '../data/food/foodLookup';
import { formatLoggedPortion } from '../domain/food/portionUnits';
import type { FoodLogEntry, MealType } from '../types/food';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import type { Language } from '../i18n/types';


interface DayDetailSheetProps {
  visible: boolean;
  date: string; // YYYY-MM-DD
  entries: FoodLogEntry[];
  loading?: boolean;
  // T2.1: whether this day is still within the backfill window
  // ([today - BACKFILL_MAX_DAYS_BACK, today]) — hides the "add food" button
  // for older days, where FoodLogModal's own PastDateField would reject the
  // date anyway. Deleting an entry stays allowed regardless (unchanged).
  canAddFood: boolean;
  // kcal burned that day via logged activity (steps/workouts) — always shown,
  // 0 is a real "no activity logged" value, not missing data.
  burnedKcal: number;
  // The rest are null/blank when that day has no reading/log for it yet
  // (e.g. very old data, or a day the user never logged) — hidden, not
  // shown as 0, so it doesn't misread as "you slept/drank/weighed nothing".
  sleepHours: number | null;
  waterDisplay: string | null; // already formatted with the user's ml/L preference
  weightKg: number | string; // '' when no weight has ever been logged up to this day
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

// Format portion display: "2 hộp (130ml)" or "150g" — the shared formatter, so
// every list that shows a logged food words its amount identically.
function formatPortion(entry: FoodLogEntry, language: Language): string {
  return formatLoggedPortion(entry, getAnyFoodById(entry.foodId), language);
}

// One SectionList section: a meal's label + its entries.
interface MealSection {
  title: string;
  mealType: MealType;
  data: FoodLogEntry[];
}

// Build SectionList data from grouped meals
function buildSectionData(
  grouped: Record<MealType, FoodLogEntry[]>,
  language: Language
): MealSection[] {
  const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sections: MealSection[] = [];

  for (const mealType of mealOrder) {
    const items = grouped[mealType];
    if (items.length > 0) {
      sections.push({
        title: mealLabel(mealType, language),
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
  canAddFood,
  burnedKcal,
  sleepHours,
  waterDisplay,
  weightKg,
  onClose,
  onAddFood,
  onDeleteEntry,
}: DayDetailSheetProps) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
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

  const sectionData = useMemo(() => buildSectionData(grouped, language), [grouped, language]);

  const handleDelete = (entry: FoodLogEntry) => {
    Alert.alert(
      t('components.dayDetailSheet.deleteConfirmTitle'),
      t('components.dayDetailSheet.deleteConfirmMessage', {
        name: foodLogEntryDisplayName(entry, language),
      }),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'cancel' },
        {
          text: t('common.delete'),
          onPress: () => onDeleteEntry(entry),
          style: 'destructive',
        },
      ]
    );
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
          {foodLogEntryDisplayName(entry, language)}
        </Text>
        <Text style={styles.portion}>{formatPortion(entry, language)}</Text>
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
      <Text style={styles.emptyText}>{t('components.dayDetailSheet.emptyText')}</Text>
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
          <Text style={styles.sheetTitle}>{formatDisplayDate(date, language)}</Text>

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={c.accent} />
            </View>
          )}

          {/* Summary line: total kcal & protein */}
          {!loading && entries.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {t('components.dayDetailSheet.summaryLabel', {
                  kcal: summary.totalKcal,
                  protein: summary.totalProtein,
                })}
              </Text>
            </View>
          )}

          {/* Extra day-level stats — burned kcal always shown (0 is a real
              value); sleep/water/weight only when that day actually has one,
              so a missing reading never misreads as "zero". */}
          {!loading && (
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {t('components.dayDetailSheet.burnedLabel', { kcal: burnedKcal })}
              </Text>
              {sleepHours !== null && (
                <Text style={styles.statText}>
                  {t('components.dayDetailSheet.sleepLabel', { hours: sleepHours })}
                </Text>
              )}
              {waterDisplay !== null && (
                <Text style={styles.statText}>
                  {t('components.dayDetailSheet.waterLabel', { amount: waterDisplay })}
                </Text>
              )}
              {weightKg !== '' && (
                <Text style={styles.statText}>
                  {t('components.dayDetailSheet.weightLabel', { weight: weightKg })}
                </Text>
              )}
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

          {/* Add food button — hidden past the backfill window (T2.1) */}
          {!loading && canAddFood && (
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={onAddFood}
            >
              <Text style={styles.addButtonText}>
                {t('components.dayDetailSheet.addButtonLabel')}
              </Text>
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.textPrimary,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  summaryRow: {
    backgroundColor: c.bgHighlight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textBright,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textSecondary,
    backgroundColor: c.bgElevated,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  entriesContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: c.bgCard,
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
    color: c.textPrimary,
    marginBottom: 4,
  },
  portion: {
    fontSize: 13,
    color: c.textSecondary,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  energyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: c.accent,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 16,
    color: c.danger,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: c.textSecondary,
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: c.accentAltBg,
    borderWidth: 1.5,
    borderColor: c.accentAlt,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.accentAlt,
  },
});

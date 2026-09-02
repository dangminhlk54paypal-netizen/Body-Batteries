import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { summarizeFoodLog } from '../../domain/food/foodLogSummary';
import { foodLogEntryDisplayName, getAnyFoodById } from '../../data/food/foodLookup';
import { formatLoggedPortion } from '../../domain/food/portionUnits';
import { mealLabel } from '../../lib/constants';
import { formatDisplayDate, todayString } from '../../lib/dateUtils';
import { darkColors } from '../../lib/theme';
import type { FoodLogEntry } from '../../types/food';
import { useT } from '../../i18n/useT';

// The "share my day" poster — a dedicated, never-clipped layout captured by
// dayFoodShareService.shareTodayFoodCard and handed to the OS share sheet.
// NOT a screenshot of TodayMeals: it is mounted off-screen (see the caller)
// with its own full auto-height, so a day with 15 logged foods renders every
// one of them instead of only whatever fit above the fold when the user
// tapped the button — that gap is exactly what this component exists to close.
//
// Colors are the fixed `darkColors` brand palette, not the live theme
// (useThemeColors) — a shared-to-social-media image should look like "Body
// Batteries" the same way regardless of whether the sharer has the app's
// light or dark mode on, the same reasoning lib/constants.ts already applies
// to per-battery identity colors.
interface Props {
  entries: FoodLogEntry[];
}

// Fixed rather than Dimensions.get('window').width: every shared image should
// look like the same "poster" regardless of which phone it was made on.
const CARD_WIDTH = 390;

export const ShareDayFoodCard = forwardRef<View, Props>(function ShareDayFoodCard(
  { entries },
  ref
) {
  const { t, language } = useT();
  const summary = summarizeFoodLog(entries);

  return (
    // collapsable={false}: without it, Android's view-flattening optimizer can
    // drop this node from the native tree since it has no interaction/on-screen
    // purpose of its own — and a dropped node is a node captureRef can't find.
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        {/* "Body Batteries" is the app's proper name, not translated content —
            same treatment HomeScreen's own header already gives it. */}
        <Text style={styles.brand}>⚡ Body Batteries</Text>
        <Text style={styles.date}>{formatDisplayDate(todayString(), language)}</Text>
      </View>

      <View style={styles.overview}>
        <Text style={styles.kcal}>{summary.totalKcal} kcal</Text>
        <Text style={styles.macroLine}>
          {t('components.todayMeals.macroLine', {
            protein: summary.totalProteinG,
            carb: summary.totalCarbG,
            fat: summary.totalFatG,
          })}
        </Text>
      </View>

      {summary.groups.map((group) => (
        <View key={group.mealType} style={styles.mealBlock}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealTitle}>{mealLabel(group.mealType, language)}</Text>
            <Text style={styles.mealKcal}>{group.totalKcal} kcal</Text>
          </View>
          {group.entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              {/* No numberOfLines cap on the name — the point of this card is
                  showing everything, so a long name wraps instead of being
                  cut with an ellipsis. */}
              <Text style={styles.entryName}>{foodLogEntryDisplayName(entry, language)}</Text>
              <Text style={styles.entryMeta}>
                {formatLoggedPortion(entry, getAnyFoodById(entry.foodId), language)} ·{' '}
                {entry.energyKcal} kcal
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.tagline}>{t('components.shareDayFoodCard.tagline')}</Text>
    </View>
  );
});

const c = darkColors;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: c.bg,
    padding: 24,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  brand: { color: c.accent, fontSize: 16, fontWeight: '800' },
  date: { color: c.textTertiary, fontSize: 13 },
  overview: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  kcal: { color: c.textPrimary, fontSize: 40, fontWeight: '800' },
  macroLine: { color: c.textSecondary, fontSize: 14 },
  mealBlock: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.bgElevated,
    paddingBottom: 6,
  },
  mealTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  mealKcal: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  entryRow: { gap: 1 },
  entryName: { color: c.textBright, fontSize: 14, fontWeight: '500' },
  entryMeta: { color: c.textTertiary, fontSize: 12 },
  tagline: { color: c.textSubtle, fontSize: 11, textAlign: 'center', marginTop: 6 },
});

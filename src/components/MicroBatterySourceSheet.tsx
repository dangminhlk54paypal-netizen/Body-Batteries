import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Pressable } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { getAnyFoodById, foodLogEntryDisplayName } from '../data/food/foodLookup';
import {
  microBatterySourceBreakdown,
  type MicroSourceRow,
} from '../domain/nutrition/microBatteryEngine';
import { formatLoggedPortion, measureUnitOf } from '../domain/food/portionUnits';
import type { MicroBatteryState } from '../types/nutrition';
import type { Language } from '../i18n/types';
import type { FoodLogEntry } from '../types/food';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

interface Props {
  nutrient: MicroBatteryState | null;
  visible: boolean;
  onClose: () => void;
  // The logged foods for whichever day is currently selected in
  // MicroBatteryStack's date picker — NOT always today.
  foodLog: FoodLogEntry[];
  dateLabel: string;
}

const MAX_ROWS_HEIGHT = Dimensions.get('window').height * 0.45;

// What was actually eaten, per row — the portion the nutrient amount came
// from. Without it a food logged twice looks like two unrelated entries, so
// there is no way to tell a genuine second helping from a stray duplicate.
// Uses the same formatLoggedPortion every other logged-food list uses, so
// "2 hộp (130ml)" reads identically here and in TodayMeals; a food logged
// more than once also says how many times.
function portionLabel(
  row: MicroSourceRow,
  language: Language,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const base = formatLoggedPortion(row, getAnyFoodById(row.foodId), language);
  return row.entryCount > 1
    ? base +
        t('components.microBatterySourceSheet.rowEntryCountSuffix', { count: row.entryCount })
    : base;
}

// Round for display the same way the engine does, so a formula line never
// shows a figure the row above it disagrees with.
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// A nutrient the user cannot enter directly, or whose bookkeeping surprises
// people. Returned as a translation key so this stays free of literal text.
function derivationNoteKey(id: MicroBatteryState['id']): string | null {
  if (id === 'salt') return 'components.microBatterySourceSheet.derivationSalt';
  if (id === 'omega3') return 'components.microBatterySourceSheet.derivationOmega3';
  if (id === 'sugar') return 'components.microBatterySourceSheet.derivationSugar';
  return null;
}

// Read-only "which foods contributed this micronutrient" breakdown — the
// MicroBatteryStack equivalent of BatterySourceSheet. Amounts are recomputed
// live from each food's per-100g nutrition (microBatterySourceBreakdown) since
// FoodLogEntry never snapshots individual micronutrient values.
export function MicroBatterySourceSheet({ nutrient, visible, onClose, foodLog, dateLabel }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  // "Show me the arithmetic" — collapsed by default so the sheet stays a
  // quick glance, expandable for anyone who wants to check the number.
  const [explaining, setExplaining] = useState(false);
  if (!nutrient) return null;

  const name = t(`nutrients.${nutrient.id}.name`);
  // `total` is the same figure the battery cell shows AND the exact sum of the
  // rounded row amounts below, so the breakdown can never fail to add up.
  const { rows, total } = microBatterySourceBreakdown(foodLog, nutrient.id, getAnyFoodById);

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={450}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('components.microBatterySourceSheet.title', { name })}</Text>
        <Text style={styles.caption}>
          {t('components.microBatterySourceSheet.dateCaption', { date: dateLabel })}
        </Text>

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {t('components.microBatterySourceSheet.emptyText', { name })}
          </Text>
        ) : (
          <ScrollView
            style={[styles.table, { maxHeight: MAX_ROWS_HEIGHT }]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {foodLogEntryDisplayName(row, language)}
                  </Text>
                  <Text style={styles.rowPortion} numberOfLines={1}>
                    {portionLabel(row, language, t)}
                  </Text>
                </View>
                <Text style={styles.rowValue}>
                  {row.amount}
                  {nutrient.unit}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Text style={styles.totalText}>
            {t('components.microBatterySourceSheet.totalText', {
              value: total,
              target: nutrient.target,
              unit: nutrient.unit,
            })}
          </Text>
          {rows.length > 1 && (
            <Text style={styles.footerNote}>
              {t('components.microBatterySourceSheet.sumNote')}
            </Text>
          )}
          <Text style={styles.footerNote}>{t('components.microBatterySourceSheet.footerNote')}</Text>

          <Pressable
            onPress={() => setExplaining((e) => !e)}
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.explainToggle}>
              {explaining
                ? t('components.microBatterySourceSheet.explainToggleHide')
                : t('components.microBatterySourceSheet.explainToggleShow')}
            </Text>
          </Pressable>

          {explaining && (
            <View style={styles.explainBox}>
              <Text style={styles.explainIntro}>
                {t('components.microBatterySourceSheet.formulaIntro')}
              </Text>
              {rows.map((row) => {
                const measure = measureUnitOf(getAnyFoodById(row.foodId));
                return (
                  <Text key={row.id} style={styles.formulaLine}>
                    {foodLogEntryDisplayName(row, language)}:{' '}
                    {t('components.microBatterySourceSheet.formulaRow', {
                      per100: round1(row.per100g),
                      unit: nutrient.unit,
                      measure,
                      amount: round1(row.grams),
                      result: row.amount,
                    })}
                  </Text>
                );
              })}
              <Text style={styles.formulaSum}>
                {rows.length > 1
                  ? t('components.microBatterySourceSheet.formulaSum', {
                      parts: rows.map((r) => r.amount).join(' + '),
                      total,
                      unit: nutrient.unit,
                    })
                  : t('components.microBatterySourceSheet.formulaSingle', {
                      total,
                      unit: nutrient.unit,
                    })}
              </Text>
              <Text style={styles.formulaSum}>
                {t(
                  nutrient.kind === 'limit'
                    ? 'components.microBatterySourceSheet.formulaTargetLimit'
                    : 'components.microBatterySourceSheet.formulaTargetGoal',
                  {
                    target: nutrient.target,
                    unit: nutrient.unit,
                    percentage: nutrient.percentage,
                  }
                )}
              </Text>
              {derivationNoteKey(nutrient.id) && (
                <Text style={styles.explainNote}>{t(derivationNoteKey(nutrient.id) as string)}</Text>
              )}
              <Text style={styles.explainNote}>
                {t('components.microBatterySourceSheet.liveNote')}
              </Text>
              <Text style={styles.explainNote}>
                {t('components.microBatterySourceSheet.dayScopeNote')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.textPrimary,
  },
  caption: {
    fontSize: 12,
    color: c.textSubtle,
    marginTop: -8,
  },
  empty: {
    fontSize: 13,
    color: c.textTertiary,
    lineHeight: 19,
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
    borderBottomColor: c.divider,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: 14,
    color: c.textSecondary,
  },
  rowPortion: {
    fontSize: 11,
    color: c.textSubtle,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textPrimary,
  },
  footer: {
    marginTop: 4,
    gap: 4,
  },
  totalText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
  },
  footerNote: {
    fontSize: 12,
    color: c.textSubtle,
    lineHeight: 17,
  },
  explainToggle: {
    fontSize: 12,
    color: c.accentAlt,
    fontWeight: '600',
    marginTop: 6,
  },
  explainBox: {
    gap: 6,
    marginTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: c.divider,
  },
  explainIntro: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  formulaLine: { fontSize: 11, color: c.textTertiary, lineHeight: 16 },
  formulaSum: { fontSize: 12, color: c.textPrimary, fontWeight: '600', lineHeight: 17 },
  explainNote: { fontSize: 11, color: c.textSubtle, lineHeight: 16 },
  pressed: { opacity: 0.6 },
});

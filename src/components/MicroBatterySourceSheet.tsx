import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { getAnyFoodById } from '../data/food/foodLookup';
import { microBatterySourceRows } from '../domain/nutrition/microBatteryEngine';
import type { MicroBatteryState } from '../types/nutrition';
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

// Read-only "which foods contributed this micronutrient" breakdown — the
// MicroBatteryStack equivalent of BatterySourceSheet. Amounts are recomputed
// live from each food's per-100g nutrition (microBatterySourceRows) since
// FoodLogEntry never snapshots individual micronutrient values.
export function MicroBatterySourceSheet({ nutrient, visible, onClose, foodLog, dateLabel }: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  if (!nutrient) return null;

  const name = t(`nutrients.${nutrient.id}.name`);
  const rows = microBatterySourceRows(foodLog, nutrient.id, getAnyFoodById);

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
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {row.label}
                </Text>
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
              value: nutrient.current,
              target: nutrient.target,
              unit: nutrient.unit,
            })}
          </Text>
          <Text style={styles.footerNote}>{t('components.microBatterySourceSheet.footerNote')}</Text>
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
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: c.textSecondary,
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
});

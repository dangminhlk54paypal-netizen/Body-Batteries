import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useChargeEffectStore } from '../store/chargeEffectStore';
import { FOOD_ITEMS } from '../data/food/foodDatabase';
import { getCustomFoods } from '../data/food/customFoodRegistry';
import { getAnyFoodById, foodDisplayName } from '../data/food/foodLookup';
import { FoodNutritionEditModal } from './FoodNutritionEditModal';
import { gramsForPortion } from '../domain/food/foodNutrition';
import type { FoodItem, FoodLogEntry } from '../types/food';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

// One-tap logging for supplement-category foods (fish oil, whey, vitamins…).
// Each tap logs one default serving through the normal logFood flow, so the
// dose lands in the food log (deletable in TodayMeals) and its minerals/
// omega-3 feed the micronutrient batteries above — going past 100% there is
// how "đã nạp thừa" shows up.
//
// The list now includes user-added custom supplements, and a "➕" chip opens
// the nutrition editor to add a new one. Each chip also has a discreet "✎" to
// edit that supplement's nutrition (saved as an override so the correction
// applies everywhere). Logging is override-aware via getAnyFoodById.

interface Props {
  todayLog: FoodLogEntry[];
}

const BUILT_IN_SUPPLEMENTS = FOOD_ITEMS.filter((f) => f.category === 'supplement');

export function SupplementQuickLog({ todayLog }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const logFood = useEnergyStore((s) => s.logFood);

  // Bumped after add/edit so the memoised list re-reads the custom registry.
  const [refreshTick, setRefreshTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  // Guards a fast double-tap on a chip from logging the same dose twice —
  // the sibling of FoodLogModal's `savingFood`, which this component was
  // missing. Without it one long press could land two food_log rows, which
  // then read as two separate doses everywhere (micro-battery sources
  // included, since those are recomputed live from the log).
  const [logging, setLogging] = useState(false);

  const supplements = useMemo(() => {
    const custom = getCustomFoods().filter((f) => f.category === 'supplement');
    const byId = new Map<string, FoodItem>();
    for (const item of [...BUILT_IN_SUPPLEMENTS, ...custom]) byId.set(item.id, item);
    // Reflect any override (edited name/nutrition) in what we display + log.
    return [...byId.values()].map((item) => getAnyFoodById(item.id) ?? item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // Doses, not log rows: an entry logged as "2 viên" carries count: 2, so
  // counting rows would report it as a single dose. Entries with no count
  // (a gram-based supplement, or one chip tap) are one dose each.
  function dosesToday(foodId: string): number {
    return todayLog
      .filter((e) => e.foodId === foodId)
      .reduce((sum, e) => sum + (e.count ?? 1), 0);
  }

  async function logOneDose(item: FoodItem) {
    if (logging) return;
    setLogging(true);
    try {
      // Log the override-aware item so edited nutrition applies.
      const resolved = getAnyFoodById(item.id) ?? item;
      if (resolved.portionUnit != null && resolved.portionUnit !== 'gram') {
        // One tap = one pack/capsule — convert to grams for the nutrition
        // engine, but keep the count for display ("1 viên").
        await logFood(resolved, gramsForPortion(resolved, 1), Date.now(), {
          portionUnit: resolved.portionUnit,
          count: 1,
        });
      } else {
        await logFood(resolved, resolved.defaultServingG, Date.now());
      }
      useChargeEffectStore.getState().triggerChargePulse();
      haptics.tapLight();
    } finally {
      setLogging(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('components.supplementQuickLog.title')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {supplements.map((item) => {
          const count = dosesToday(item.id);
          return (
            <Pressable
              key={item.id}
              disabled={logging}
              onPress={() => logOneDose(item)}
              style={({ pressed }) => [
                styles.chip,
                count > 0 && styles.chipLogged,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.chipHeader}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {foodDisplayName(item, language)}
                </Text>
                <Pressable
                  onPress={() => setEditingFood(item)}
                  hitSlop={10}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.chipEdit}>✎</Text>
                </Pressable>
              </View>
              <Text style={[styles.chipMeta, count > 0 && styles.chipMetaLogged]}>
                {count > 0
                  ? t('components.supplementQuickLog.loggedCountLabel', { count })
                  : t('components.supplementQuickLog.notLoggedLabel')}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.chip, styles.chipAdd, pressed && styles.pressed]}
        >
          <Text style={styles.chipAddText}>{t('components.supplementQuickLog.addSupplementLabel')}</Text>
        </Pressable>
      </ScrollView>
      <Text style={styles.hint}>{t('components.supplementQuickLog.hintText')}</Text>

      <FoodNutritionEditModal
        visible={adding}
        mode="add"
        presetCategory="supplement"
        onClose={() => setAdding(false)}
        onSaved={() => setRefreshTick((t) => t + 1)}
      />
      <FoodNutritionEditModal
        visible={editingFood !== null}
        mode="edit"
        initialFood={editingFood ?? undefined}
        onClose={() => setEditingFood(null)}
        onSaved={() => setRefreshTick((t) => t + 1)}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: c.textTertiary,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    gap: 2,
    minWidth: 120,
  },
  chipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chipLogged: {
    borderColor: c.info,
  },
  chipAdd: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderColor: c.info,
    minWidth: 90,
  },
  chipAddText: {
    color: c.info,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipName: {
    color: c.textLight,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipEdit: {
    color: c.textTertiary,
    fontSize: 13,
  },
  chipMeta: {
    color: c.textMuted,
    fontSize: 10,
  },
  chipMetaLogged: {
    color: c.info,
  },
  hint: {
    fontSize: 10,
    color: c.textFaint,
    lineHeight: 15,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});

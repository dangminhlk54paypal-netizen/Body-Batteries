import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { FOOD_ITEMS } from '../data/food/foodDatabase';
import { getCustomFoods } from '../data/food/customFoodRegistry';
import { getAnyFoodById } from '../data/food/foodLookup';
import { FoodNutritionEditModal } from './FoodNutritionEditModal';
import { gramsForPortion } from '../domain/food/foodNutrition';
import type { FoodItem, FoodLogEntry } from '../types/food';
import { colors } from '../lib/theme';

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
  const logFood = useEnergyStore((s) => s.logFood);

  // Bumped after add/edit so the memoised list re-reads the custom registry.
  const [refreshTick, setRefreshTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

  const supplements = useMemo(() => {
    const custom = getCustomFoods().filter((f) => f.category === 'supplement');
    const byId = new Map<string, FoodItem>();
    for (const item of [...BUILT_IN_SUPPLEMENTS, ...custom]) byId.set(item.id, item);
    // Reflect any override (edited name/nutrition) in what we display + log.
    return [...byId.values()].map((item) => getAnyFoodById(item.id) ?? item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  function countToday(foodId: string): number {
    return todayLog.filter((e) => e.foodId === foodId).length;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💊 Thực phẩm chức năng — bấm để nạp 1 liều</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {supplements.map((item) => {
          const count = countToday(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                // Log the override-aware item so edited nutrition applies.
                const resolved = getAnyFoodById(item.id) ?? item;
                if (resolved.portionUnit != null && resolved.portionUnit !== 'gram') {
                  // One tap = one pack/capsule — convert to grams for the
                  // nutrition engine, but keep the count for display ("1 viên").
                  logFood(resolved, gramsForPortion(resolved, 1), Date.now(), {
                    portionUnit: resolved.portionUnit,
                    count: 1,
                  });
                } else {
                  logFood(resolved, resolved.defaultServingG, Date.now());
                }
              }}
              style={({ pressed }) => [
                styles.chip,
                count > 0 && styles.chipLogged,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.chipHeader}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {item.nameVi}
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
                {count > 0 ? `hôm nay ×${count}` : 'chưa nạp hôm nay'}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.chip, styles.chipAdd, pressed && styles.pressed]}
        >
          <Text style={styles.chipAddText}>➕ Thêm{'\n'}TPCN</Text>
        </Pressable>
      </ScrollView>
      <Text style={styles.hint}>
        Mỗi lần bấm = 1 liều mặc định (VD: 1 viên dầu cá 1220mg = 600mg EPA + 400mg DHA).
        Liều nạp cộng thẳng vào pin vi chất ở trên — pin vượt 100% nghĩa là đã quá mức
        khuyến nghị. Bấm nhầm thì xoá trong danh sách bữa ăn bên dưới.
      </Text>

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

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: colors.textTertiary,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    borderColor: colors.info,
  },
  chipAdd: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderColor: colors.info,
    minWidth: 90,
  },
  chipAddText: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipName: {
    color: colors.textLight,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipEdit: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  chipMeta: {
    color: colors.textMuted,
    fontSize: 10,
  },
  chipMetaLogged: {
    color: colors.info,
  },
  hint: {
    fontSize: 10,
    color: colors.textFaint,
    lineHeight: 15,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});

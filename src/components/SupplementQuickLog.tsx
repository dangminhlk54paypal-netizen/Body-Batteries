import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { FOOD_ITEMS } from '../data/food/foodDatabase';
import type { FoodLogEntry } from '../types/food';

// One-tap logging for supplement-category foods (fish oil, whey, vitamins…).
// Each tap logs one default serving through the normal logFood flow, so the
// dose lands in the food log (deletable in TodayMeals) and its minerals/
// omega-3 feed the micronutrient batteries above — going past 100% there is
// how "đã nạp thừa" shows up.

interface Props {
  todayLog: FoodLogEntry[];
}

const SUPPLEMENTS = FOOD_ITEMS.filter((f) => f.category === 'supplement');

export function SupplementQuickLog({ todayLog }: Props) {
  const logFood = useEnergyStore((s) => s.logFood);

  if (SUPPLEMENTS.length === 0) return null;

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
        {SUPPLEMENTS.map((item) => {
          const count = countToday(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => logFood(item, item.defaultServingG, Date.now())}
              style={({ pressed }) => [
                styles.chip,
                count > 0 && styles.chipLogged,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipName}>{item.nameVi}</Text>
              <Text style={[styles.chipMeta, count > 0 && styles.chipMetaLogged]}>
                {count > 0 ? `hôm nay ×${count}` : 'chưa nạp hôm nay'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>
        Mỗi lần bấm = 1 liều mặc định (VD: 1 viên dầu cá 1220mg = 600mg EPA + 400mg DHA).
        Liều nạp cộng thẳng vào pin vi chất ở trên — pin vượt 100% nghĩa là đã quá mức
        khuyến nghị. Bấm nhầm thì xoá trong danh sách bữa ăn bên dưới.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
    gap: 2,
  },
  chipLogged: {
    borderColor: '#54A0FF',
  },
  chipName: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '600',
  },
  chipMeta: {
    color: '#666',
    fontSize: 10,
  },
  chipMetaLogged: {
    color: '#54A0FF',
  },
  hint: {
    fontSize: 10,
    color: '#555',
    lineHeight: 15,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});

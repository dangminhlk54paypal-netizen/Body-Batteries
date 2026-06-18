import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useEnergyStore } from '../store/energyStore';
import { searchFoods } from '../data/food/foodDatabase';
import { nutritionForGrams, mealTypeForHour } from '../domain/food/foodNutrition';
import { FOOD_CATEGORY_LABELS, MEAL_LABELS } from '../lib/constants';
import type { FoodItem } from '../types/food';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function categoryLabel(category: string): string {
  return FOOD_CATEGORY_LABELS[category] ?? category;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Build a timestamp for TODAY at the given hour:minute (used to log a meal at a
// time earlier in the day — "ghi nhận trễ").
function timestampForToday(hour: number, minute: number): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// How far below its resting position the sheet starts before sliding up.
const SHEET_OFFSET = 500;

export function FoodLogModal({ visible, onClose }: Props) {
  const logFood = useEnergyStore((s) => s.logFood);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const translateY = useSharedValue(SHEET_OFFSET);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280 });
    } else {
      translateY.value = SHEET_OFFSET;
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const results = useMemo(() => searchFoods(query), [query]);

  function reset() {
    setQuery('');
    setSelected(null);
    setGrams('');
    setHour('');
    setMinute('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickFood(item: FoodItem) {
    const now = new Date();
    setSelected(item);
    setGrams(String(item.defaultServingG));
    setHour(pad2(now.getHours()));
    setMinute(pad2(now.getMinutes()));
  }

  const gramsNum = parseFloat(grams);
  const validGrams = !isNaN(gramsNum) && gramsNum > 0;
  const hourNum = clampInt(parseInt(hour, 10), 0, 23);
  const minuteNum = clampInt(parseInt(minute, 10), 0, 59);

  const preview =
    selected && validGrams ? nutritionForGrams(selected, gramsNum) : null;
  const mealLabel = MEAL_LABELS[mealTypeForHour(hourNum)];

  async function confirm() {
    if (!selected || !validGrams) return;
    await logFood(selected, gramsNum, timestampForToday(hourNum, minuteNum));
    handleClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {!selected ? (
            <>
              <Text style={styles.title}>Ghi món ăn</Text>
              <Text style={styles.subtitle}>Tìm món trong danh sách rồi chọn</Text>
              <TextInput
                style={styles.input}
                placeholder="Tìm món (ví dụ: cơm, gà, cá...)"
                placeholderTextColor="#666"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              <FlatList
                style={styles.list}
                data={results}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.empty}>Không tìm thấy món nào.</Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.foodRow, pressed && styles.pressed]}
                    onPress={() => pickFood(item)}
                  >
                    <View style={styles.foodRowMain}>
                      <Text style={styles.foodName}>{item.nameVi}</Text>
                      <Text style={styles.foodMeta}>
                        {categoryLabel(item.category)} · {item.per100g.energyKcal} kcal/100g
                      </Text>
                    </View>
                    <Text style={styles.foodChevron}>›</Text>
                  </Pressable>
                )}
              />
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={handleClose}
              >
                <Text style={styles.cancelText}>Đóng</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setSelected(null)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.back}>‹ Chọn món khác</Text>
              </Pressable>
              <Text style={styles.title}>{selected.nameVi}</Text>
              <Text style={styles.subtitle}>
                {categoryLabel(selected.category)} · {selected.per100g.energyKcal} kcal / 100g
              </Text>

              <ScrollView
                style={styles.entryScroll}
                contentContainerStyle={styles.entryScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.fieldLabel}>Khối lượng (gram)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 150"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={grams}
                  onChangeText={setGrams}
                />
                <View style={styles.chips}>
                  <Pressable
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    onPress={() => setGrams(String(selected.defaultServingG))}
                  >
                    <Text style={styles.chipText}>mặc định={selected.defaultServingG}g</Text>
                  </Pressable>
                  {selected.servingPresets.map((p) => (
                    <Pressable
                      key={p.label}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => setGrams(String(p.grams))}
                    >
                      <Text style={styles.chipText}>
                        {p.label}={p.grams}g
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Giờ ăn → {mealLabel}</Text>
                <View style={styles.timeRow}>
                  <TextInput
                    style={[styles.input, styles.timeInput]}
                    placeholder="HH"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={hour}
                    onChangeText={setHour}
                  />
                  <Text style={styles.timeColon}>:</Text>
                  <TextInput
                    style={[styles.input, styles.timeInput]}
                    placeholder="MM"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={minute}
                    onChangeText={setMinute}
                  />
                </View>

                {preview && (
                  <View style={styles.preview}>
                    <Text style={styles.previewKcal}>⚡ {preview.energyKcal} kcal</Text>
                    <Text style={styles.previewMacro}>
                      P {preview.proteinG}g · C {preview.carbG}g · F {preview.fatG}g
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelText}>Huỷ</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.eat,
                    !validGrams && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={confirm}
                  disabled={!validGrams}
                >
                  <Text style={styles.btnText}>Ghi món 🍽️</Text>
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function clampInt(n: number, min: number, max: number): number {
  if (isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 14, color: '#aaa' },
  back: { color: '#4ECDC4', fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 13, color: '#aaa', marginTop: 4 },
  entryScroll: { flexShrink: 1 },
  entryScrollContent: { gap: 12 },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  list: { maxHeight: 320, flexShrink: 1 },
  empty: { color: '#888', textAlign: 'center', paddingVertical: 20 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  foodRowMain: { flex: 1 },
  foodName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  foodMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  foodChevron: { color: '#555', fontSize: 22, paddingLeft: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipText: { color: '#ddd', fontSize: 12, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 70, textAlign: 'center' },
  timeColon: { color: '#fff', fontSize: 20, fontWeight: '700' },
  preview: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#00B894',
  },
  previewKcal: { color: '#00B894', fontSize: 18, fontWeight: '800' },
  previewMacro: { color: '#ccc', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  eat: { backgroundColor: '#00B894' },
  disabled: { opacity: 0.4 },
  cancel: { backgroundColor: '#2d2d44' },
  cancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

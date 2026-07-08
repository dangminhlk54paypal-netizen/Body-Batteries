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
import { searchAllFoods } from '../data/food/foodSearch';
import { addCustomFoodAndRegister } from '../data/food/customFoodRegistry';
import { getAnyFoodById } from '../data/food/foodLookup';
import { FoodNutritionEditModal } from './FoodNutritionEditModal';
import { nutritionForGrams, mealTypeForHour } from '../domain/food/foodNutrition';
import {
  buildCustomFoodItem,
  isValidCustomFoodInput,
  EMPTY_CUSTOM_FOOD_INPUT,
  type CustomFoodInput,
} from '../domain/food/customFoodInput';
import { FOOD_CATEGORY_LABELS, MEAL_LABELS } from '../lib/constants';
import type { FoodItem } from '../types/food';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function categoryLabel(category: string): string {
  return FOOD_CATEGORY_LABELS[category] ?? category;
}

// Vietnamese name is the main line, English name the small second line.
// Falls back to the English name as the main line for the rare item still
// missing a Vietnamese translation (sub is then omitted — nothing to add).
function displayNames(item: FoodItem): { main: string; sub: string | null } {
  if (item.nameVi) return { main: item.nameVi, sub: item.nameEn || null };
  return { main: item.nameEn, sub: null };
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
  // "Thêm món mới" sub-state: shown when a search finds nothing and the user
  // wants to define a custom food. `adding` gates a third branch alongside
  // the search list and the selected-entry view.
  const [adding, setAdding] = useState(false);
  const [customInput, setCustomInput] = useState<CustomFoodInput>(EMPTY_CUSTOM_FOOD_INPUT);
  const [showMicros, setShowMicros] = useState(false);
  // Guards against a fast double-tap on "Lưu món" firing saveCustomFood()
  // twice before the first save/navigation completes.
  const [savingCustomFood, setSavingCustomFood] = useState(false);
  // "Sửa thành phần": opens the nutrition-override editor for the selected food.
  const [editingNutrition, setEditingNutrition] = useState(false);
  const translateY = useSharedValue(SHEET_OFFSET);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280 });
    } else {
      translateY.value = SHEET_OFFSET;
    }
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const results = useMemo(() => searchAllFoods(query), [query]);

  function reset() {
    setQuery('');
    setSelected(null);
    setGrams('');
    setHour('');
    setMinute('');
    setAdding(false);
    setCustomInput(EMPTY_CUSTOM_FOOD_INPUT);
    setShowMicros(false);
    setSavingCustomFood(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickFood(item: FoodItem) {
    const now = new Date();
    // searchAllFoods returns the raw catalog/custom item — resolve it through
    // getAnyFoodById so any user "Sửa thành phần" override applies to the
    // preview AND to logFood (which snapshots the nutrition at log time).
    const resolved = getAnyFoodById(item.id) ?? item;
    setSelected(resolved);
    setGrams(String(resolved.defaultServingG));
    setHour(pad2(now.getHours()));
    setMinute(pad2(now.getMinutes()));
  }

  // Opens the "add custom food" form, prefilled with the search query.
  function startAddingCustomFood() {
    setCustomInput({ ...EMPTY_CUSTOM_FOOD_INPUT, name: query });
    setShowMicros(false);
    setSavingCustomFood(false);
    setAdding(true);
  }

  function updateCustomField<K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) {
    setCustomInput((prev) => ({ ...prev, [key]: value }));
  }

  const customValid = isValidCustomFoodInput(customInput);

  // Builds the FoodItem, persists it via the registry (SQLite + searchable
  // immediately), then hands off into the existing selected-entry view so
  // the user picks grams/time and logs through the existing confirm().
  async function saveCustomFood() {
    if (!customValid || savingCustomFood) return;
    setSavingCustomFood(true);
    const item = buildCustomFoodItem(customInput);
    await addCustomFoodAndRegister(item);
    setAdding(false);
    // No need to reset savingCustomFood here — the view transitions away via
    // pickFood()/setSelected, unmounting the "Lưu món" button.
    pickFood(item);
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
    // USDA rows have no Vietnamese name yet — fall back to the English name so
    // the Diary/History never show a blank title (logFood snapshots nameVi).
    const foodToLog = selected.nameVi ? selected : { ...selected, nameVi: selected.nameEn };
    await logFood(foodToLog, gramsNum, timestampForToday(hourNum, minuteNum));
    handleClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {/* Tapping the dark area above the sheet also closes it — the user must
            never be trapped in this modal. */}
        <Pressable style={styles.overlayDismiss} onPress={handleClose} />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {adding ? (
            <>
              <View style={styles.headerRow}>
                <Pressable
                  onPress={() => setAdding(false)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.back}>‹ Quay lại</Text>
                </Pressable>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.title}>Thêm món mới</Text>
              <Text style={styles.subtitle}>Nhập dinh dưỡng tính cho mỗi 100g</Text>

              <ScrollView
                style={styles.entryScroll}
                contentContainerStyle={styles.entryScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.fieldLabel}>Tên món</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: Canh chua cá lóc"
                  placeholderTextColor="#666"
                  value={customInput.name}
                  onChangeText={(v) => updateCustomField('name', v)}
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Nhóm</Text>
                <TextInput
                  style={styles.input}
                  placeholder="dish, snack, drink..."
                  placeholderTextColor="#666"
                  value={customInput.category}
                  onChangeText={(v) => updateCustomField('category', v)}
                />

                <Text style={styles.fieldLabel}>Khẩu phần mặc định (gram)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.defaultServingG}
                  onChangeText={(v) => updateCustomField('defaultServingG', v)}
                />

                <Text style={styles.fieldLabel}>Kcal / 100g</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 150"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.energyKcal}
                  onChangeText={(v) => updateCustomField('energyKcal', v)}
                />

                <Text style={styles.fieldLabel}>Đạm (g) / 100g</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.proteinG}
                  onChangeText={(v) => updateCustomField('proteinG', v)}
                />

                <Text style={styles.fieldLabel}>Béo (g) / 100g</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.fatG}
                  onChangeText={(v) => updateCustomField('fatG', v)}
                />

                <Text style={styles.fieldLabel}>Carbs (Carbohydrate) / 100g</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.carbG}
                  onChangeText={(v) => updateCustomField('carbG', v)}
                />

                {/* Sugar/fiber are a breakdown OF carbG above, not an addition
                    to it — buildCustomFoodItem stores them as separate
                    informational micros and never adds them into carbG. */}
                <View style={styles.carbBreakdown}>
                  <Text style={styles.carbBreakdownNote}>
                    Đường và chất xơ đã nằm TRONG Carbs — nhập để theo dõi chi
                    tiết, không cộng thêm.
                  </Text>

                  <Text style={styles.fieldLabelNested}>Đường (g) / 100g</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    value={customInput.sugarG}
                    onChangeText={(v) => updateCustomField('sugarG', v)}
                  />

                  <Text style={styles.fieldLabelNested}>Chất xơ (g) / 100g</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    value={customInput.fiberG}
                    onChangeText={(v) => updateCustomField('fiberG', v)}
                  />
                </View>

                <Text style={styles.fieldLabel}>Nước (ml) / 100g</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={customInput.waterG}
                  onChangeText={(v) => updateCustomField('waterG', v)}
                />

                <Pressable
                  style={({ pressed }) => [styles.chip, styles.microsToggle, pressed && styles.pressed]}
                  onPress={() => setShowMicros((v) => !v)}
                >
                  <Text style={styles.chipText}>
                    {showMicros ? '▾ Ẩn vi chất' : '▸ Thêm vi chất'}
                  </Text>
                </Pressable>
                <Text style={styles.microsHint}>
                  Bỏ trống vi chất → món này không đóng góp vào các pin vi chất.
                </Text>

                {showMicros && (
                  <>
                    <Text style={styles.fieldLabel}>Canxi (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.calciumMg}
                      onChangeText={(v) => updateCustomField('calciumMg', v)}
                    />

                    <Text style={styles.fieldLabel}>Sắt (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.ironMg}
                      onChangeText={(v) => updateCustomField('ironMg', v)}
                    />

                    <Text style={styles.fieldLabel}>Natri (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.sodiumMg}
                      onChangeText={(v) => updateCustomField('sodiumMg', v)}
                    />

                    <Text style={styles.fieldLabel}>Kali (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.potassiumMg}
                      onChangeText={(v) => updateCustomField('potassiumMg', v)}
                    />

                    <Text style={styles.fieldLabel}>Magie (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.magnesiumMg}
                      onChangeText={(v) => updateCustomField('magnesiumMg', v)}
                    />

                    <Text style={styles.fieldLabel}>Kẽm (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.zincMg}
                      onChangeText={(v) => updateCustomField('zincMg', v)}
                    />

                    <Text style={styles.fieldLabel}>EPA (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.epaMg}
                      onChangeText={(v) => updateCustomField('epaMg', v)}
                    />

                    <Text style={styles.fieldLabel}>DHA (mg) / 100g</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      value={customInput.dhaMg}
                      onChangeText={(v) => updateCustomField('dhaMg', v)}
                    />
                  </>
                )}
              </ScrollView>

              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                  onPress={() => setAdding(false)}
                >
                  <Text style={styles.cancelText}>Huỷ</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.eat,
                    (!customValid || savingCustomFood) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={saveCustomFood}
                  disabled={!customValid || savingCustomFood}
                >
                  <Text style={styles.btnText}>Lưu món</Text>
                </Pressable>
              </View>
            </>
          ) : !selected ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Ghi món ăn</Text>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
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
                  <View>
                    <Text style={styles.empty}>Không tìm thấy món nào.</Text>
                    {query.trim().length > 0 && (
                      <Pressable
                        style={({ pressed }) => [styles.addNewBtn, pressed && styles.pressed]}
                        onPress={startAddingCustomFood}
                      >
                        <Text style={styles.addNewText}>➕ Thêm món mới: &apos;{query.trim()}&apos;</Text>
                      </Pressable>
                    )}
                  </View>
                }
                renderItem={({ item }) => {
                  const { main, sub } = displayNames(item);
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.foodRow, pressed && styles.pressed]}
                      onPress={() => pickFood(item)}
                    >
                      <View style={styles.foodRowMain}>
                        <Text style={styles.foodName}>{main}</Text>
                        {sub ? <Text style={styles.foodNameEn}>{sub}</Text> : null}
                        <Text style={styles.foodMeta}>
                          {categoryLabel(item.category)} · {item.per100g.energyKcal} kcal/100g
                        </Text>
                      </View>
                      <Text style={styles.foodChevron}>›</Text>
                    </Pressable>
                  );
                }}
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
              <View style={styles.headerRow}>
                <Pressable
                  onPress={() => setSelected(null)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.back}>‹ Chọn món khác</Text>
                </Pressable>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeX}>✕</Text>
                </Pressable>
              </View>
              {(() => {
                const { main, sub } = displayNames(selected);
                return (
                  <>
                    <Text style={styles.title}>{main}</Text>
                    {sub ? <Text style={styles.foodNameEn}>{sub}</Text> : null}
                  </>
                );
              })()}
              <Text style={styles.subtitle}>
                {categoryLabel(selected.category)} · {selected.per100g.energyKcal} kcal / 100g
              </Text>
              <Pressable
                onPress={() => setEditingNutrition(true)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.editLink}>✎ Sửa thành phần</Text>
              </Pressable>

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
      {selected && (
        <FoodNutritionEditModal
          visible={editingNutrition}
          mode="edit"
          initialFood={selected}
          onClose={() => setEditingNutrition(false)}
          onSaved={(item) => {
            // Reflect the override immediately in the entry preview.
            setSelected(getAnyFoodById(item.id) ?? item);
          }}
        />
      )}
    </Modal>
  );
}

function clampInt(n: number, min: number, max: number): number {
  if (isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayDismiss: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: '#aaa', fontSize: 15, fontWeight: '700' },
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
  editLink: { color: '#54A0FF', fontSize: 13, fontWeight: '600', marginTop: 2 },
  fieldLabel: { fontSize: 13, color: '#aaa', marginTop: 4 },
  fieldLabelNested: { fontSize: 12, color: '#999', marginTop: 4 },
  carbBreakdown: {
    marginTop: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#2d2d44',
    gap: 8,
  },
  carbBreakdownNote: { fontSize: 11, color: '#777', lineHeight: 15 },
  microsHint: { fontSize: 11, color: '#777', marginTop: -4 },
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
  addNewBtn: {
    marginTop: 4,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  addNewText: { color: '#4ECDC4', fontSize: 15, fontWeight: '700' },
  microsToggle: { alignSelf: 'flex-start' },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  foodRowMain: { flex: 1 },
  foodName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  foodNameEn: { color: '#999', fontSize: 12, marginTop: 1 },
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

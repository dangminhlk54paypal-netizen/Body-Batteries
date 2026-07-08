import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  type CustomFoodInput,
  EMPTY_CUSTOM_FOOD_INPUT,
  buildCustomFoodItem,
  inputFromFoodItem,
  isValidCustomFoodInput,
} from '../domain/food/customFoodInput';
import { addCustomFoodAndRegister } from '../data/food/customFoodRegistry';
import { upsertOverrideAndRegister } from '../data/food/foodOverrideRegistry';
import type { FoodItem } from '../types/food';

// Reusable modal for two flows:
//  - mode 'edit': correct an existing food's nutrition. Saved as a food OVERRIDE
//    (upsertOverrideAndRegister) keyed by the SAME id, so getAnyFoodById shadows
//    the catalog value everywhere (micro batteries, daily summary, Excel).
//  - mode 'add': create a brand-new food/supplement (addCustomFoodAndRegister).
// Self-contained: does NOT reuse FoodLogModal's form (which was recently
// restructured) — only calls the shared pure helpers in customFoodInput.
interface Props {
  visible: boolean;
  mode: 'edit' | 'add';
  initialFood?: FoodItem;
  presetCategory?: string;
  onClose: () => void;
  onSaved?: (item: FoodItem) => void;
}

// The macro fields shown above the carb breakdown, in render order.
const MACRO_FIELDS: { key: keyof CustomFoodInput; label: string }[] = [
  { key: 'energyKcal', label: 'Kcal / 100g' },
  { key: 'proteinG', label: 'Đạm (g) / 100g' },
  { key: 'fatG', label: 'Béo (g) / 100g' },
];

const MICRO_FIELDS: { key: keyof CustomFoodInput; label: string }[] = [
  { key: 'calciumMg', label: 'Canxi (mg) / 100g' },
  { key: 'ironMg', label: 'Sắt (mg) / 100g' },
  { key: 'sodiumMg', label: 'Natri (mg) / 100g' },
  { key: 'potassiumMg', label: 'Kali (mg) / 100g' },
  { key: 'magnesiumMg', label: 'Magie (mg) / 100g' },
  { key: 'zincMg', label: 'Kẽm (mg) / 100g' },
  { key: 'epaMg', label: 'EPA (mg) / 100g' },
  { key: 'dhaMg', label: 'DHA (mg) / 100g' },
];

export function FoodNutritionEditModal({
  visible,
  mode,
  initialFood,
  presetCategory,
  onClose,
  onSaved,
}: Props) {
  const [input, setInput] = useState<CustomFoodInput>(EMPTY_CUSTOM_FOOD_INPUT);
  const [showMicros, setShowMicros] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed the form each time the modal opens (or its target food changes),
  // using the React "adjust state during render when a prop changes" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // rather than an effect — a fresh open must start from the target's values.
  const openKey = visible
    ? `${mode}:${initialFood?.id ?? 'add'}:${presetCategory ?? ''}`
    : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (openKey !== null && openKey !== seededKey) {
    setSeededKey(openKey);
    if (mode === 'edit' && initialFood) {
      setInput(inputFromFoodItem(initialFood));
      setShowMicros(true); // editing existing data — show the micros up front
    } else {
      setInput({ ...EMPTY_CUSTOM_FOOD_INPUT, category: presetCategory ?? 'custom' });
      setShowMicros(false);
    }
    setSaving(false);
  }

  const valid = useMemo(() => isValidCustomFoodInput(input), [input]);

  function set<K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const built = buildCustomFoodItem(input);
      if (mode === 'edit' && initialFood) {
        // Keep the ORIGINAL id (so this becomes an override of that food) plus
        // the base's non-nutrition identity (nameEn/nameDe/presets/note); only
        // the edited nameVi/category/serving/per100g take effect.
        const edited: FoodItem = {
          ...initialFood,
          nameVi: built.nameVi,
          category: built.category,
          defaultServingG: built.defaultServingG,
          per100g: built.per100g,
        };
        await upsertOverrideAndRegister(edited);
        onSaved?.(edited);
      } else {
        await addCustomFoodAndRegister(built);
        onSaved?.(built);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {mode === 'edit' ? 'Sửa thành phần' : 'Thêm món mới'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {mode === 'edit'
              ? 'Chỉ để tham khảo — giá trị bạn sửa sẽ được ưu tiên hiển thị.'
              : 'Nhập dinh dưỡng tính cho mỗi 100g.'}
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Tên món</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Canh chua cá lóc"
              placeholderTextColor="#666"
              value={input.name}
              onChangeText={(v) => set('name', v)}
            />

            <Text style={styles.fieldLabel}>Nhóm</Text>
            <TextInput
              style={styles.input}
              placeholder="dish, snack, supplement..."
              placeholderTextColor="#666"
              value={input.category}
              onChangeText={(v) => set('category', v)}
            />

            <Text style={styles.fieldLabel}>Khẩu phần mặc định (gram)</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={input.defaultServingG}
              onChangeText={(v) => set('defaultServingG', v)}
            />

            {MACRO_FIELDS.map((f) => (
              <React.Fragment key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={input[f.key]}
                  onChangeText={(v) => set(f.key, v)}
                />
              </React.Fragment>
            ))}

            <Text style={styles.fieldLabel}>Carbs (Carbohydrate) / 100g</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={input.carbG}
              onChangeText={(v) => set('carbG', v)}
            />

            {/* Sugar/fiber are a breakdown OF carbG, not an addition to it. */}
            <View style={styles.carbBreakdown}>
              <Text style={styles.carbBreakdownNote}>
                Đường và chất xơ đã nằm TRONG Carbs — nhập để theo dõi chi tiết,
                không cộng thêm.
              </Text>
              <Text style={styles.fieldLabelNested}>Đường (g) / 100g</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
                value={input.sugarG}
                onChangeText={(v) => set('sugarG', v)}
              />
              <Text style={styles.fieldLabelNested}>Chất xơ (g) / 100g</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
                value={input.fiberG}
                onChangeText={(v) => set('fiberG', v)}
              />
            </View>

            <Text style={styles.fieldLabel}>Nước (ml) / 100g</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={input.waterG}
              onChangeText={(v) => set('waterG', v)}
            />

            <Pressable
              style={({ pressed }) => [styles.microsToggle, pressed && styles.pressed]}
              onPress={() => setShowMicros((v) => !v)}
            >
              <Text style={styles.chipText}>
                {showMicros ? '▾ Ẩn vi chất' : '▸ Thêm vi chất'}
              </Text>
            </Pressable>
            <Text style={styles.microsHint}>
              Bỏ trống vi chất → món này không đóng góp vào các pin vi chất.
            </Text>

            {showMicros &&
              MICRO_FIELDS.map((f) => (
                <React.Fragment key={f.key}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    value={input[f.key]}
                    onChangeText={(v) => set(f.key, v)}
                  />
                </React.Fragment>
              ))}
          </ScrollView>

          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Huỷ</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.save,
                (!valid || saving) && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSave}
              disabled={!valid || saving}
            >
              <Text style={styles.btnText}>{mode === 'edit' ? 'Lưu sửa' : 'Lưu món'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
    maxHeight: '88%',
  },
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
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#aaa' },
  scroll: { flexShrink: 1 },
  scrollContent: { gap: 10 },
  fieldLabel: { fontSize: 13, color: '#aaa', marginTop: 4 },
  fieldLabelNested: { fontSize: 12, color: '#999', marginTop: 4 },
  carbBreakdown: {
    borderLeftWidth: 2,
    borderLeftColor: '#2d2d44',
    paddingLeft: 12,
    gap: 8,
  },
  carbBreakdownNote: { fontSize: 11, color: '#777', lineHeight: 15 },
  microsHint: { fontSize: 11, color: '#777', marginTop: -4 },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  microsToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
    marginTop: 4,
  },
  chipText: { color: '#ddd', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  save: { backgroundColor: '#00B894' },
  disabled: { opacity: 0.4 },
  cancel: { backgroundColor: '#2d2d44' },
  cancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

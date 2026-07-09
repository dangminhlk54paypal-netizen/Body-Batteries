import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import type { CustomFoodInput } from '../../domain/food/customFoodInput';
import type { PortionUnit } from '../../types/food';

// Shared field-rendering body for the "add/edit a custom food" form, used by
// both FoodLogModal's inline "Thêm món mới" branch and FoodNutritionEditModal
// (which also covers "Sửa thành phần" and SupplementQuickLog's add flow).
// Presentational only — save/navigation/header logic stays in each caller,
// since those genuinely differ (see FoodNutritionEditModal.tsx header comment).
interface Props {
  input: CustomFoodInput;
  onChange: <K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) => void;
  showMicros: boolean;
  onToggleMicros: () => void;
  autoFocusName?: boolean;
}

// Short unit label used in the nutrition field suffixes below — matches how
// buildCustomFoodItem interprets the entered numbers (per 100g vs per serving).
function unitSuffix(portionUnit: PortionUnit): string {
  if (portionUnit === 'pack') return '/ gói';
  if (portionUnit === 'capsule') return '/ viên';
  return '/ 100g';
}

const PORTION_UNIT_OPTIONS: { key: PortionUnit; label: string }[] = [
  { key: 'gram', label: 'Gram' },
  { key: 'pack', label: 'Gói' },
  { key: 'capsule', label: 'Viên' },
];

const MACRO_FIELD_BASE: { key: keyof CustomFoodInput; label: string }[] = [
  { key: 'energyKcal', label: 'Kcal' },
  { key: 'proteinG', label: 'Đạm (g)' },
  { key: 'fatG', label: 'Béo (g)' },
];

const MICRO_FIELD_BASE: { key: keyof CustomFoodInput; label: string }[] = [
  { key: 'calciumMg', label: 'Canxi (mg)' },
  { key: 'ironMg', label: 'Sắt (mg)' },
  { key: 'sodiumMg', label: 'Natri (mg)' },
  { key: 'potassiumMg', label: 'Kali (mg)' },
  { key: 'magnesiumMg', label: 'Magie (mg)' },
  { key: 'zincMg', label: 'Kẽm (mg)' },
  { key: 'epaMg', label: 'EPA (mg)' },
  { key: 'dhaMg', label: 'DHA (mg)' },
];

export function CustomFoodFields({
  input,
  onChange,
  showMicros,
  onToggleMicros,
  autoFocusName,
}: Props) {
  const suffix = unitSuffix(input.portionUnit);
  const isServingBased = input.portionUnit !== 'gram';

  return (
    <>
      <Text style={styles.fieldLabel}>Tên món</Text>
      <TextInput
        style={styles.input}
        placeholder="Ví dụ: Canh chua cá lóc"
        placeholderTextColor="#666"
        value={input.name}
        onChangeText={(v) => onChange('name', v)}
        autoFocus={autoFocusName}
      />

      <Text style={styles.fieldLabel}>Nhóm</Text>
      <TextInput
        style={styles.input}
        placeholder="dish, snack, supplement..."
        placeholderTextColor="#666"
        value={input.category}
        onChangeText={(v) => onChange('category', v)}
      />

      <Text style={styles.fieldLabel}>Đơn vị tính</Text>
      <View style={styles.unitRow}>
        {PORTION_UNIT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={({ pressed }) => [
              styles.unitChip,
              input.portionUnit === opt.key && styles.unitChipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange('portionUnit', opt.key)}
          >
            <Text
              style={[
                styles.unitChipText,
                input.portionUnit === opt.key && styles.unitChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isServingBased ? (
        <>
          <Text style={styles.fieldLabel}>Khối lượng 1 {input.portionUnit === 'pack' ? 'gói' : 'viên'} (g)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: 5"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            value={input.servingWeightG}
            onChangeText={(v) => onChange('servingWeightG', v)}
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Khẩu phần mặc định (gram)</Text>
          <TextInput
            style={styles.input}
            placeholder="100"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            value={input.defaultServingG}
            onChangeText={(v) => onChange('defaultServingG', v)}
          />
        </>
      )}

      {MACRO_FIELD_BASE.map((f) => (
        <React.Fragment key={f.key}>
          <Text style={styles.fieldLabel}>
            {f.label} {suffix}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            value={input[f.key]}
            onChangeText={(v) => onChange(f.key, v)}
          />
        </React.Fragment>
      ))}

      <Text style={styles.fieldLabel}>Carbs (Carbohydrate) {suffix}</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
        value={input.carbG}
        onChangeText={(v) => onChange('carbG', v)}
      />

      {/* Sugar/fiber are a breakdown OF carbG above, not an addition to it —
          buildCustomFoodItem stores them as separate informational micros
          and never adds them into carbG. */}
      <View style={styles.carbBreakdown}>
        <Text style={styles.carbBreakdownNote}>
          Đường và chất xơ đã nằm TRONG Carbs — nhập để theo dõi chi tiết, không cộng thêm.
        </Text>
        <Text style={styles.fieldLabelNested}>Đường (g) {suffix}</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          value={input.sugarG}
          onChangeText={(v) => onChange('sugarG', v)}
        />
        <Text style={styles.fieldLabelNested}>Chất xơ (g) {suffix}</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          value={input.fiberG}
          onChangeText={(v) => onChange('fiberG', v)}
        />
      </View>

      <Text style={styles.fieldLabel}>Nước (ml) {suffix}</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
        value={input.waterG}
        onChangeText={(v) => onChange('waterG', v)}
      />

      <Pressable
        style={({ pressed }) => [styles.microsToggle, pressed && styles.pressed]}
        onPress={onToggleMicros}
      >
        <Text style={styles.chipText}>{showMicros ? '▾ Ẩn vi chất' : '▸ Thêm vi chất'}</Text>
      </Pressable>
      <Text style={styles.microsHint}>
        Bỏ trống vi chất → món này không đóng góp vào các pin vi chất.
      </Text>

      {showMicros &&
        MICRO_FIELD_BASE.map((f) => (
          <React.Fragment key={f.key}>
            <Text style={styles.fieldLabel}>
              {f.label} {suffix}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={input[f.key]}
              onChangeText={(v) => onChange(f.key, v)}
            />
          </React.Fragment>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, color: '#aaa', marginTop: 4 },
  fieldLabelNested: { fontSize: 12, color: '#999', marginTop: 4 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: '#16213e',
    borderColor: '#00B894',
  },
  unitChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  unitChipTextActive: { color: '#00B894' },
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
  pressed: { opacity: 0.6 },
});

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { BatteryType } from '../types/battery';
import { colors } from '../lib/theme';
import * as haptics from '../lib/haptics';
import { BottomSheet } from './ui/BottomSheet';
import { toMl, type WaterDisplayUnit } from '../lib/units';

interface Props {
  battery: BatteryType | null;
  visible: boolean;
  onConfirm: (amount: number, note: string) => void;
  onClose: () => void;
  // Water-only: lets the amount be typed in ml or L (see src/lib/units.ts).
  // onConfirm always receives ml regardless of which unit was picked here.
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
}

const WATER_UNIT_OPTIONS: { key: WaterDisplayUnit; label: string }[] = [
  { key: 'ml', label: 'ml' },
  { key: 'l', label: 'L' },
];

export function IntakeModal({
  battery,
  visible,
  onConfirm,
  onClose,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
}: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const isWater = battery?.id === 'water';

  function handleConfirm() {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(isWater ? toMl(parsed, waterDisplayUnit) : parsed, note.trim());
      haptics.success();
      setAmount('');
      setNote('');
      onClose();
    }
  }

  if (!battery) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={400}>
      <View style={styles.content}>
        <Text style={styles.title}>Nạp {battery.name}</Text>
        <Text style={styles.subtitle}>
          Nhập lượng bạn đã nạp ({isWater ? waterDisplayUnit : battery.unit})
        </Text>

        {isWater && onToggleWaterUnit && (
          <View style={styles.unitRow}>
            {WATER_UNIT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  styles.unitChip,
                  waterDisplayUnit === opt.key && styles.unitChipActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (waterDisplayUnit !== opt.key) onToggleWaterUnit();
                }}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    waterDisplayUnit === opt.key && styles.unitChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={`Ví dụ: 30`}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          autoFocus
        />

        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Ghi chú (tuỳ chọn)"
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
        />

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Huỷ</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.confirmBtn,
              { backgroundColor: battery.color },
              pressed && styles.pressed,
            ]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>Nạp ⚡</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteInput: {
    fontSize: 14,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: colors.bgHighlight,
    borderColor: colors.accent,
  },
  unitChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: colors.accent,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.bgElevated,
  },
  confirmBtn: {},
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});

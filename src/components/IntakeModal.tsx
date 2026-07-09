import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { BatteryType } from '../types/battery';
import { colors } from '../lib/theme';
import * as haptics from '../lib/haptics';
import { BottomSheet } from './ui/BottomSheet';

interface Props {
  battery: BatteryType | null;
  visible: boolean;
  onConfirm: (amount: number, note: string) => void;
  onClose: () => void;
}

export function IntakeModal({ battery, visible, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function handleConfirm() {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(parsed, note.trim());
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
        <Text style={styles.subtitle}>Nhập lượng bạn đã nạp ({battery.unit})</Text>

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

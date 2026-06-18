import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { BatteryType } from '../types/battery';

interface Props {
  battery: BatteryType | null;
  visible: boolean;
  onConfirm: (amount: number, note: string) => void;
  onClose: () => void;
}

// How far below its resting position the sheet starts before sliding up.
const SHEET_OFFSET = 400;

export function IntakeModal({ battery, visible, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
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

  function handleConfirm() {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(parsed, note.trim());
      setAmount('');
      setNote('');
      onClose();
    }
  }

  if (!battery) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Text style={styles.title}>Nạp {battery.name}</Text>
          <Text style={styles.subtitle}>Nhập lượng bạn đã nạp ({battery.unit})</Text>

          <TextInput
            style={styles.input}
            placeholder={`Ví dụ: 30`}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />

          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Ghi chú (tuỳ chọn)"
            placeholderTextColor="#666"
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
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
    backgroundColor: '#2d2d44',
  },
  confirmBtn: {},
  cancelText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});

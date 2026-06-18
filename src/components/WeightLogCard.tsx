import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  logWeight,
  getWeightHistory,
  type WeightEntry,
} from '../data/repositories/healthSignalsRepository';
import { dateString, formatDisplayDate } from '../lib/dateUtils';
import { PROFILE_LIMITS } from '../lib/metabolicConstants';

export function WeightLogCard() {
  const [weightText, setWeightText] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    setEntries(await getWeightHistory());
  }

  async function handleLog() {
    const parsed = parseFloat(weightText);
    const { min, max } = PROFILE_LIMITS.weightKg;
    if (isNaN(parsed) || parsed < min || parsed > max) return;
    await logWeight(parsed);
    setWeightText('');
    await loadEntries();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cân nặng theo thời gian</Text>
      <Text style={styles.subtitle}>
        Ghi nhận tự nguyện, không bắt buộc — chỉ để xem xu hướng theo thời gian, không đánh giá.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ví dụ: 65"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          value={weightText}
          onChangeText={setWeightText}
        />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={handleLog}
        >
          <Text style={styles.btnText}>Ghi nhận hôm nay</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>Chưa ghi cân nặng nào.</Text>
      ) : (
        entries.map((e, i) => (
          <View key={`${e.timestamp}-${i}`} style={styles.entryRow}>
            <Text style={styles.entryDate}>
              {formatDisplayDate(dateString(new Date(e.timestamp)))}
            </Text>
            <Text style={styles.entryValue}>{e.value} kg</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: '#888', lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  btn: {
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.6 },
  empty: { color: '#555', fontSize: 13 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  entryDate: { color: '#ccc', fontSize: 13 },
  entryValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

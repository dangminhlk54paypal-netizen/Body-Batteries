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
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';

export function WeightLogCard() {
  const { t, language } = useT();
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
    const rounded = Math.round(parsed * 10) / 10;
    await logWeight(rounded);
    setWeightText('');
    await loadEntries();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('components.weightLogCard.title')}</Text>
      <Text style={styles.subtitle}>{t('components.weightLogCard.subtitle')}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('components.weightLogCard.weightPlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={weightText}
          onChangeText={setWeightText}
        />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={handleLog}
        >
          <Text style={styles.btnText}>{t('components.weightLogCard.logButton')}</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t('components.weightLogCard.emptyText')}</Text>
      ) : (
        entries.map((e, i) => (
          <View key={`${e.timestamp}-${i}`} style={styles.entryRow}>
            <Text style={styles.entryDate}>
              {formatDisplayDate(dateString(new Date(e.timestamp)), language)}
            </Text>
            <Text style={styles.entryValue}>{e.value.toFixed(1)} kg</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bgElevated,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.accentAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  btnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.6 },
  empty: { color: colors.textFaint, fontSize: 13 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.bgElevated,
  },
  entryDate: { color: colors.textSoft, fontSize: 13 },
  entryValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
});

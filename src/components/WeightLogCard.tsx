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
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';

export function WeightLogCard() {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
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
    const parsed = parseDecimal(weightText);
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
          placeholderTextColor={c.textMuted}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.bgElevated,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  btn: {
    backgroundColor: c.accentAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  btnText: { color: c.textPrimary, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.6 },
  empty: { color: c.textFaint, fontSize: 13 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.bgElevated,
  },
  entryDate: { color: c.textSoft, fontSize: 13 },
  entryValue: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
});

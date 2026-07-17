import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MicroBatteryState } from '../types/nutrition';
import { computeOverdoseWarnings } from '../domain/nutrition/overdoseWarning';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

interface Props {
  // Reuse the same micronutrient states MicroBatteryStack already computed —
  // no separate data path. Warnings are derived here, purely, via
  // computeOverdoseWarnings.
  states: MicroBatteryState[];
}

// Small, non-alarmist notice card: lists any nutrient whose today total
// crossed its reference upper limit. Renders nothing when the list is
// empty (see .ai/CONTEXT.md §5 — gentle, referential wording only).
export function OverdoseNotice({ states }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const warnings = computeOverdoseWarnings(states, language);
  if (warnings.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('overdose.title')}</Text>
      {warnings.map((w) => (
        <Text key={w.id} style={styles.message}>
          {w.message}
        </Text>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 10,
    backgroundColor: c.overdoseBg,
    borderWidth: 1,
    borderColor: c.overdoseBorder,
    gap: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: c.overdoseTitle,
  },
  message: {
    fontSize: 10,
    color: c.overdoseText,
    lineHeight: 14,
  },
});

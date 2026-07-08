import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MicroBatteryState } from '../types/nutrition';
import { computeOverdoseWarnings } from '../domain/nutrition/overdoseWarning';

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
  const warnings = computeOverdoseWarnings(states);
  if (warnings.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vượt mức dung nạp tối đa tham khảo</Text>
      {warnings.map((w) => (
        <Text key={w.id} style={styles.message}>
          {w.messageVi}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#2a1f1a',
    borderWidth: 1,
    borderColor: '#5a4030',
    gap: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E17055',
  },
  message: {
    fontSize: 10,
    color: '#c9a892',
    lineHeight: 14,
  },
});

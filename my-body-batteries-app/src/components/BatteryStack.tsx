import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BatteryCell } from './BatteryCell';
import type { BatteryState } from '../types/battery';

interface Props {
  batteries: BatteryState[];
  onPressCell?: (id: string) => void;
}

export function BatteryStack({ batteries, onPressCell }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {batteries.map((b) => (
        <BatteryCell
          key={b.type.id}
          id={b.type.id}
          name={b.type.name}
          unit={b.type.unit}
          level={b.level}
          capacity={b.capacity}
          percentage={b.percentage}
          color={b.type.color}
          onPress={() => onPressCell?.(b.type.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'flex-end',
  },
});

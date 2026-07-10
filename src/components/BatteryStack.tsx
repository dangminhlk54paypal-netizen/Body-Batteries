import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BatteryCell } from './BatteryCell';
import { formatWaterAmount, type WaterDisplayUnit } from '../lib/units';
import type { BatteryState } from '../types/battery';

interface Props {
  batteries: BatteryState[];
  onPressCell?: (id: string) => void;
  // Water-only display preference (ml or L) — see src/lib/units.ts. Optional
  // so any other caller/test can omit it and get the plain ml label.
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
}

export function BatteryStack({
  batteries,
  onPressCell,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {batteries.map((b) => {
        const isWater = b.type.id === 'water';
        return (
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
            levelLabel={isWater ? formatWaterAmount(b.level, waterDisplayUnit) : undefined}
            onToggleUnit={isWater ? onToggleWaterUnit : undefined}
          />
        );
      })}
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

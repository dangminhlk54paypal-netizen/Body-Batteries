import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BatteryCell } from './BatteryCell';
import {
  formatWaterAmount,
  formatMovementAmount,
  type WaterDisplayUnit,
  type MovementDisplayUnit,
} from '../lib/units';
import type { BatteryState } from '../types/battery';

interface Props {
  batteries: BatteryState[];
  onPressCell?: (id: string) => void;
  // Water-only display preference (ml or L) — see src/lib/units.ts. Optional
  // so any other caller/test can omit it and get the plain ml label.
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
  // Movement-only display preference (kcal or steps), mirrors the water
  // pattern above — see src/lib/units.ts.
  movementDisplayUnit?: MovementDisplayUnit;
  onToggleMovementUnit?: () => void;
  // Caller-computed kcal estimate of the movement pin's current step level
  // (HomeScreen derives it via metabolismEngine.stepsKcal) — passed as a
  // plain number so lib/units stays free of domain imports.
  movementKcal?: number;
}

export function BatteryStack({
  batteries,
  onPressCell,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
  movementDisplayUnit = 'kcal',
  onToggleMovementUnit,
  movementKcal,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {batteries.map((b) => {
        const isWater = b.type.id === 'water';
        const isMovement = b.type.id === 'movement';
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
            levelLabel={
              isWater
                ? formatWaterAmount(b.level, waterDisplayUnit)
                : isMovement && movementKcal != null
                  ? formatMovementAmount(b.level, movementKcal, movementDisplayUnit)
                  : undefined
            }
            onToggleUnit={isWater ? onToggleWaterUnit : isMovement ? onToggleMovementUnit : undefined}
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

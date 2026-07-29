import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BatteryCell } from './BatteryCell';
import {
  formatWaterRange,
  formatMovementAmount,
  type WaterDisplayUnit,
  type MovementDisplayUnit,
} from '../lib/units';
import { computeDailyBatteryTotals } from '../domain/battery/dailyBatteryTotals';
import type { BatteryState, IntakeEvent } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import type { ActivityLogEntry } from '../types/energy';

interface Props {
  batteries: BatteryState[];
  onPressCell?: (id: string) => void;
  // Today's logs — used to show each sub-battery's real "logged today" total
  // instead of its drained reading level (readings.level decays hour-by-hour
  // like the energy battery — see dailyBatteryTotals.ts — which is correct
  // for the "reserve remaining" pin metaphor, but reads as a confusing wrong
  // number under a label that looks like "eaten/drunk/walked today").
  // All three optional together so other callers/tests can omit them and
  // fall back to the plain drained-level label.
  foodLog?: FoodLogEntry[];
  activityLog?: ActivityLogEntry[];
  intakeLog?: IntakeEvent[];
  // Water-only display preference (ml or L) — see src/lib/units.ts. Optional
  // so any other caller/test can omit it and get the plain ml label.
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
  // Movement-only display preference (kcal or steps), mirrors the water
  // pattern above — see src/lib/units.ts.
  movementDisplayUnit?: MovementDisplayUnit;
  onToggleMovementUnit?: () => void;
}

export function BatteryStack({
  batteries,
  onPressCell,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
  movementDisplayUnit = 'kcal',
  onToggleMovementUnit,
  foodLog,
  activityLog,
  intakeLog,
}: Props) {
  const totals =
    foodLog && activityLog && intakeLog
      ? computeDailyBatteryTotals(foodLog, activityLog, intakeLog)
      : undefined;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {batteries.map((b) => {
        const isWater = b.type.id === 'water';
        const isMovement = b.type.id === 'movement';
        const capacity = Math.round(b.capacity);

        let levelLabel: string | undefined;
        if (totals) {
          switch (b.type.id) {
            case 'water':
              levelLabel = formatWaterRange(totals.water, b.capacity, waterDisplayUnit);
              break;
            case 'movement':
              levelLabel = formatMovementAmount(
                totals.movementSteps,
                capacity,
                totals.movementKcal,
                movementDisplayUnit
              );
              break;
            case 'protein':
              levelLabel = `${totals.protein}/${capacity}${b.type.unit}`;
              break;
            case 'carbs':
              levelLabel = `${totals.carbs}/${capacity}${b.type.unit}`;
              break;
            case 'minerals':
              levelLabel = `${totals.minerals}/${capacity}${b.type.unit}`;
              break;
            case 'sleep':
              levelLabel = `${totals.sleep}/${capacity}${b.type.unit}`;
              break;
          }
        }

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
            levelLabel={levelLabel}
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

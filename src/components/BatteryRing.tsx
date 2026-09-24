import React from 'react';
import { View, Text, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import {
  formatWaterRange,
  formatMovementAmount,
  type WaterDisplayUnit,
  type MovementDisplayUnit,
} from '../lib/units';
import { batteryTypeName } from '../lib/constants';
import { computeDailyBatteryTotals, type DailyBatteryTotals } from '../domain/battery/dailyBatteryTotals';
import {
  RING_GEOMETRY,
  arcPath,
  dailyBatteryRatio,
  ringSlots,
  slotArcs,
  slotAtPoint,
} from '../domain/battery/batteryRingModel';
import type { BatteryState, IntakeEvent } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import type { ActivityLogEntry } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

// Cap for "larger text" accessibility settings on the compact legend grid.
const LEGEND_FONT_SCALE_CAP = 1.4;

interface Props {
  batteries: BatteryState[];
  onPressCell?: (id: string) => void;
  // Today's logs — the ring shows today's intake against each daily target.
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  intakeLog: IntakeEvent[];
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
  movementDisplayUnit?: MovementDisplayUnit;
  onToggleMovementUnit?: () => void;
}

function amountLabel(
  b: BatteryState,
  totals: DailyBatteryTotals,
  waterUnit: WaterDisplayUnit,
  movementUnit: MovementDisplayUnit
): string {
  const capacity = Math.round(b.capacity);
  switch (b.type.id) {
    case 'water':
      return formatWaterRange(totals.water, b.capacity, waterUnit);
    case 'movement':
      return formatMovementAmount(totals.movementSteps, capacity, totals.movementKcal, movementUnit);
    case 'protein':
      return `${totals.protein}/${capacity}${b.type.unit}`;
    case 'carbs':
      return `${totals.carbs}/${capacity}${b.type.unit}`;
    case 'minerals':
      return `${totals.minerals}/${capacity}${b.type.unit}`;
    case 'sleep':
      return `${totals.sleep}/${capacity}${b.type.unit}`;
    default:
      return '';
  }
}

// The 6 sub-batteries as one segmented ring (see batteryRingModel.ts): each
// coloured arc = today's intake / daily target; past 100 % a thin arc pokes
// out beyond the ring. Tapping a segment or its legend item opens the same
// charge form / sources sheet the old battery cells did.
export function BatteryRing({
  batteries,
  onPressCell,
  foodLog,
  activityLog,
  intakeLog,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
  movementDisplayUnit = 'kcal',
  onToggleMovementUnit,
}: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const totals = computeDailyBatteryTotals(foodLog, activityLog, intakeLog);
  const g = RING_GEOMETRY;
  const center = g.size / 2;
  const slots = ringSlots(batteries.length, g.gapDeg);
  const overflowRadius = g.radius + g.thickness / 2 + g.overflowGap + g.overflowThickness / 2;

  const items = batteries.map((b, i) => {
    const ratio = dailyBatteryRatio(b.type.id, totals, b.capacity);
    return {
      b,
      ratio,
      slot: slots[i],
      name: batteryTypeName(b.type.id, language),
      percentage: Math.round(ratio * 100),
      amount: amountLabel(b, totals, waterDisplayUnit, movementDisplayUnit),
    };
  });
  const done = items.filter((it) => it.ratio >= 1).length;

  function handleRingPress(e: GestureResponderEvent) {
    const index = slotAtPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, batteries.length);
    if (index != null) onPressCell?.(batteries[index].type.id);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={handleRingPress} style={styles.ringBox}>
        <Svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`}>
          {items.map(({ b, ratio, slot }) => {
            const { fill, overflow } = slotArcs(slot, ratio);
            return (
              <React.Fragment key={b.type.id}>
                <Path
                  d={arcPath(center, center, g.radius, slot)}
                  stroke={b.type.color}
                  strokeOpacity={0.18}
                  strokeWidth={g.thickness}
                  fill="none"
                />
                {fill && (
                  <Path
                    d={arcPath(center, center, g.radius, fill)}
                    stroke={b.type.color}
                    strokeWidth={g.thickness}
                    fill="none"
                  />
                )}
                {overflow && (
                  <Path
                    d={arcPath(center, center, overflowRadius, overflow)}
                    stroke={b.type.color}
                    strokeWidth={g.overflowThickness}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </React.Fragment>
            );
          })}
          <SvgText
            x={center}
            y={center + 4}
            fontSize={26}
            fontWeight="700"
            fill={c.textPrimary}
            textAnchor="middle"
          >
            {t('components.batteryRing.centerValue', { done, total: batteries.length })}
          </SvgText>
          <SvgText x={center} y={center + 22} fontSize={11} fill={c.textTertiary} textAnchor="middle">
            {t('components.batteryRing.centerLabel')}
          </SvgText>
        </Svg>
      </Pressable>

      <View style={styles.legend}>
        {items.map(({ b, name, percentage, amount }) => {
          const onToggle =
            b.type.id === 'water' ? onToggleWaterUnit : b.type.id === 'movement' ? onToggleMovementUnit : undefined;
          return (
            <Pressable
              key={b.type.id}
              onPress={() => onPressCell?.(b.type.id)}
              accessibilityRole="button"
              accessibilityLabel={t('components.batteryCell.a11yLabel', { name, percentage, amount })}
              style={({ pressed }) => [styles.legendItem, pressed && styles.pressed]}
            >
              <View style={styles.legendHead}>
                <View style={[styles.dot, { backgroundColor: b.type.color }]} />
                <Text style={styles.legendName} numberOfLines={1} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
                  {name}
                </Text>
              </View>
              <Text style={styles.legendPct} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
                {percentage}%
              </Text>
              {onToggle ? (
                <Pressable
                  onPress={onToggle}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityHint={t('components.batteryCell.a11yToggleUnitHint')}
                >
                  <Text
                    style={[styles.legendAmount, styles.legendAmountToggle]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}
                  >
                    {amount}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.legendAmount} numberOfLines={1} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
                  {amount}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 12 },
  ringBox: { alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  legendItem: { width: '33.33%', paddingHorizontal: 4, gap: 1 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { color: c.textSecondary, fontSize: 12, flexShrink: 1 },
  legendPct: { color: c.textPrimary, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  legendAmount: { color: c.textTertiary, fontSize: 11, fontVariant: ['tabular-nums'] },
  legendAmountToggle: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});

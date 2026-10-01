import React, { useState } from 'react';
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
  MINI_RING_GEOMETRY,
  RING_GEOMETRY,
  arcPath,
  ringSlots,
  slotArcs,
  slotAtPoint,
  type RingGeometry,
} from '../domain/battery/batteryRingModel';
import {
  buildRingItems,
  ringLegendColumns,
  ringReached,
  splitRing,
  type RingItem,
  type RingMetricId,
} from '../domain/battery/ringMetrics';
import type { BatteryState, IntakeEvent } from '../types/battery';
import type { MicroBatteryState } from '../types/nutrition';
import { useHoldToShare } from '../hooks/useHoldToShare';
import type { FoodLogEntry } from '../types/food';
import type { ActivityLogEntry } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

// Cap for "larger text" accessibility settings on the compact legend grid.
const LEGEND_FONT_SCALE_CAP = 1.4;

interface Props {
  batteries: BatteryState[];
  // Which metrics the ring shows (resolveRingMetrics): sub-battery ids and/or
  // micronutrient ids, already in display order.
  metricIds: RingMetricId[];
  // Today's micronutrient states — feeds the micronutrient metrics.
  microStates: MicroBatteryState[];
  // A sub-battery id or a micronutrient id, whichever segment was tapped.
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

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function microAmountLabel(m: MicroBatteryState, t: TFn): string {
  return m.kind === 'limit'
    ? t('components.batteryRing.limitAmount', { current: m.current, target: m.target, unit: m.unit })
    : `${m.current}/${m.target}${m.unit}`;
}

function batteryAmountLabel(
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

// One segmented ring: a faint track per slot, the filled part, and past 100 %
// a thin arc just outside. The centre shows "on target x/y" (the label only
// on the big ring — the small one has its group name underneath).
function RingArcs({
  items,
  geometry: g,
  reached,
  label,
}: {
  items: RingItem[];
  geometry: RingGeometry;
  reached: { done: number; total: number };
  label?: string;
}) {
  const { t } = useT();
  const c = useThemeColors();
  const center = g.size / 2;
  const slots = ringSlots(items.length, g.gapDeg);
  const overflowRadius = g.radius + g.thickness / 2 + g.overflowGap + g.overflowThickness / 2;
  const valueSize = label ? 26 : 15;
  return (
    <Svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`}>
      {items.map((it, i) => {
        const slot = slots[i];
        const { fill, overflow } = slotArcs(slot, it.ratio);
        return (
          <React.Fragment key={it.id}>
            <Path
              d={arcPath(center, center, g.radius, slot)}
              stroke={it.color}
              strokeOpacity={0.18}
              strokeWidth={g.thickness}
              fill="none"
            />
            {fill && (
              <Path d={arcPath(center, center, g.radius, fill)} stroke={it.color} strokeWidth={g.thickness} fill="none" />
            )}
            {overflow && (
              <Path
                d={arcPath(center, center, overflowRadius, overflow)}
                stroke={it.color}
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
        y={center + (label ? 4 : 5)}
        fontSize={valueSize}
        fontWeight="700"
        fill={c.textPrimary}
        textAnchor="middle"
      >
        {reached.total > 0
          ? t('components.batteryRing.centerValue', { done: reached.done, total: reached.total })
          : t('components.batteryRing.centerNone')}
      </SvgText>
      {label ? (
        <SvgText x={center} y={center + 22} fontSize={11} fill={c.textTertiary} textAnchor="middle">
          {label}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// The chosen metrics as one segmented ring (see batteryRingModel.ts and
// ringMetrics.ts) — the 6 sub-batteries by default, or e.g. protein · carbs ·
// fat · sugar: each coloured arc = today's intake / daily target (or cap);
// past 100 % a thin arc pokes out beyond the ring. Tapping a segment or its
// legend item opens its charge form / sources sheet; holding the ring or the
// legend saves/shares the whole block as an image. More than 3 micronutrients
// move to a small ring in the corner (splitRing); tapping it swaps the two.
export function BatteryRing({
  batteries,
  metricIds,
  microStates,
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
  const styles = useThemedStyles(createStyles);
  const totals = computeDailyBatteryTotals(foodLog, activityLog, intakeLog);
  const { ref: shareRef, onLongPress: holdToShare } = useHoldToShare(t('components.batteryRing.shareDialogTitle'));
  // With a small ring in the corner, tapping it swaps which group is big.
  const [microBig, setMicroBig] = useState(false);

  const { main, mini } = splitRing(buildRingItems(metricIds, batteries, totals, microStates));
  const big = mini && microBig ? mini : main;
  const small = mini ? (microBig ? main : mini) : null;
  const hasEatenToday = foodLog.length > 0;
  const columns = ringLegendColumns(big.length);

  const legend = big.map((it: RingItem) => ({
    it,
    name:
      it.kind === 'battery' ? batteryTypeName(it.battery!.type.id, language) : t(`nutrients.${it.id}.short`),
    fullName: it.kind === 'battery' ? batteryTypeName(it.battery!.type.id, language) : t(`nutrients.${it.id}.name`),
    percentage: Math.round(it.ratio * 100),
    amount:
      it.kind === 'battery'
        ? batteryAmountLabel(it.battery!, totals, waterDisplayUnit, movementDisplayUnit)
        : microAmountLabel(it.micro!, t),
  }));
  const groupLabel = (items: RingItem[]) =>
    t(items[0]?.kind === 'micro' ? 'components.batteryRing.groupMicro' : 'components.batteryRing.groupBatteries');

  function handleRingPress(e: GestureResponderEvent) {
    const index = slotAtPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, big.length);
    if (index != null) onPressCell?.(big[index].id);
  }

  return (
    // collapsable={false} + solid background: what the hold-to-share capture needs.
    <View ref={shareRef} collapsable={false} style={styles.container}>
      <View style={styles.ringRow}>
        <Pressable
          onPress={handleRingPress}
          onLongPress={holdToShare}
          accessibilityHint={t('common.holdToShareHint')}
        >
          <RingArcs
            items={big}
            geometry={RING_GEOMETRY}
            reached={ringReached(big, hasEatenToday)}
            label={t('components.batteryRing.centerLabel')}
          />
        </Pressable>
        {small && (
          <Pressable
            onPress={() => setMicroBig((v) => !v)}
            onLongPress={holdToShare}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('components.batteryRing.miniA11y', {
              group: groupLabel(small),
              done: ringReached(small, hasEatenToday).done,
              total: small.length,
            })}
            style={({ pressed }) => [styles.miniBox, pressed && styles.pressed]}
          >
            <RingArcs items={small} geometry={MINI_RING_GEOMETRY} reached={ringReached(small, hasEatenToday)} />
            <Text style={styles.miniLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {`${groupLabel(small)} ⇄`}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.legend}>
        {legend.map(({ it, name, fullName, percentage, amount }) => {
          const onToggle =
            it.id === 'water' ? onToggleWaterUnit : it.id === 'movement' ? onToggleMovementUnit : undefined;
          return (
            <Pressable
              key={it.id}
              onPress={() => onPressCell?.(it.id)}
              onLongPress={holdToShare}
              accessibilityRole="button"
              accessibilityLabel={t('components.batteryCell.a11yLabel', { name: fullName, percentage, amount })}
              accessibilityHint={t('common.holdToShareHint')}
              style={({ pressed }) => [styles.legendItem, { width: `${100 / columns}%` }, pressed && styles.pressed]}
            >
              <View style={styles.legendHead}>
                <View style={[styles.dot, { backgroundColor: it.color }]} />
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
  container: { paddingHorizontal: 16, paddingVertical: 6, gap: 12, backgroundColor: c.bg },
  // The big ring stays centred; the small one sits in the top-right corner,
  // where the big ring's square leaves empty space.
  ringRow: { alignItems: 'center' },
  miniBox: { position: 'absolute', top: 0, right: 0, alignItems: 'center', width: MINI_RING_GEOMETRY.size + 8 },
  miniLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '600', marginTop: -2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  legendItem: { paddingHorizontal: 4, gap: 1 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { color: c.textSecondary, fontSize: 12, flexShrink: 1 },
  legendPct: { color: c.textPrimary, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  legendAmount: { color: c.textTertiary, fontSize: 11, fontVariant: ['tabular-nums'] },
  legendAmountToggle: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});

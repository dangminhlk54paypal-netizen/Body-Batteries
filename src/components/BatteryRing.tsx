import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  type SharedValue,
} from 'react-native-reanimated';
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
  calloutBox,
  calloutLayout,
  calloutWire,
  ringSlots,
  slotArcs,
  slotAtPoint,
  slotMidDeg,
  type CalloutLayout,
  type RingGeometry,
} from '../domain/battery/batteryRingModel';
import {
  buildRingItems,
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
import { useScreenBackground } from '../hooks/useScreenBackground';
import { useT } from '../i18n/useT';

// Cap for "larger text" accessibility settings on the wired labels.
const LEGEND_FONT_SCALE_CAP = 1.3;
// Container side padding (styles.container) — the stage is this much narrower
// than the window until its real width is measured.
const SIDE_PADDING = 16;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  displaySize = g.size,
}: {
  items: RingItem[];
  geometry: RingGeometry;
  // null = arcs only (the big ring draws its centre text unrotated on top).
  reached: { done: number; total: number } | null;
  label?: string;
  displaySize?: number;
}) {
  const { t } = useT();
  const c = useThemeColors();
  const center = g.size / 2;
  const slots = ringSlots(items.length, g.gapDeg);
  const overflowRadius = g.radius + g.thickness / 2 + g.overflowGap + g.overflowThickness / 2;
  const valueSize = label ? 26 : 15;
  return (
    <Svg width={displaySize} height={displaySize} viewBox={`0 0 ${g.size} ${g.size}`}>
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
      {reached && (
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
      )}
      {reached && label ? (
        <SvgText x={center} y={center + 22} fontSize={11} fill={c.textTertiary} textAnchor="middle">
          {label}
        </SvgText>
      ) : null}
    </Svg>
  );
}

interface SpinValues {
  rotation: SharedValue<number>; // degrees, clockwise, unbounded
  start: SharedValue<number>;
  direction: SharedValue<number>; // +1 finger above the centre, -1 below
  centerY: SharedValue<number>; // the stage's centre line
}

// A drag along the ring's rim this many px turns it by about that much arc.
const SPIN_DEG_PER_PX = 180 / (Math.PI * RING_GEOMETRY.radius);

// Spin the ring with a sideways drag: dragging right above the centre turns
// it clockwise, below the centre anticlockwise (like turning a wheel), and on
// release it coasts to a stop. A touch stops it. It activates after 10 px
// sideways — before the 25 px tab swipe (TabSwipe) — and fails on vertical
// movement, so page scrolling is untouched. Outside the component: its
// callbacks write shared values (react-hooks lint).
function buildSpinGesture(v: SpinValues, reduceMotion: boolean) {
  return Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      cancelAnimation(v.rotation);
      v.start.value = v.rotation.value;
      v.direction.value = e.y < v.centerY.value ? 1 : -1;
    })
    .onUpdate((e) => {
      v.rotation.value = v.start.value + v.direction.value * e.translationX * SPIN_DEG_PER_PX;
    })
    .onFinalize((e, success) => {
      if (!success || reduceMotion) return;
      v.rotation.value = withDecay({ velocity: v.direction.value * e.velocityX * SPIN_DEG_PER_PX, deceleration: 0.995 });
    });
}

// Outside the component: the react-hooks lint forbids writing .value of a
// shared value that a hook depends on (same helper as BubbleTabBar).
function setShared(v: SharedValue<number>, value: number): void {
  v.value = value;
}

// One metric's wire: a plug on the ring, a thin line out, a dot at the label.
function CalloutWire({
  layout,
  index,
  count,
  color,
  rotation,
}: {
  layout: CalloutLayout;
  index: number;
  count: number;
  color: string;
  rotation: SharedValue<number>;
}) {
  // Each updater reads rotation.value itself (see .ai/skills/learned/
  // animated-style-must-read-shared-values-directly.md).
  const lineProps = useAnimatedProps(() => {
    const [x0, y0, x1, y1] = calloutWire(slotMidDeg(index, count) + rotation.value, layout);
    return { d: `M ${x0} ${y0} L ${x1} ${y1}` };
  });
  const plugProps = useAnimatedProps(() => {
    const [x0, y0] = calloutWire(slotMidDeg(index, count) + rotation.value, layout);
    return { cx: x0, cy: y0 };
  });
  const tipProps = useAnimatedProps(() => {
    const [, , x1, y1] = calloutWire(slotMidDeg(index, count) + rotation.value, layout);
    return { cx: x1, cy: y1 };
  });
  return (
    <>
      <AnimatedPath animatedProps={lineProps} stroke={color} strokeOpacity={0.55} strokeWidth={1.5} fill="none" />
      <AnimatedCircle animatedProps={plugProps} r={2.5} fill={color} />
      <AnimatedCircle animatedProps={tipProps} r={3.5} fill={color} />
    </>
  );
}

// One metric's label, kept upright, gliding with its wire as the ring spins.
function CalloutLabel({
  layout,
  index,
  count,
  rotation,
  children,
}: {
  layout: CalloutLayout;
  index: number;
  count: number;
  rotation: SharedValue<number>;
  children: React.ReactNode;
}) {
  const position = useAnimatedStyle(() => {
    const [left, top] = calloutBox(slotMidDeg(index, count) + rotation.value, layout);
    return { transform: [{ translateX: left }, { translateY: top }] };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, width: layout.labelWidth, height: layout.labelHeight }, position]}
    >
      {children}
    </Animated.View>
  );
}

// The chosen metrics as one segmented ring (see batteryRingModel.ts and
// ringMetrics.ts) — the 6 sub-batteries by default, or e.g. protein · carbs ·
// fat · sugar: each coloured arc = today's intake / daily target (or cap);
// past 100 % a thin arc pokes out beyond the ring. Each metric's name · % ·
// amount hangs off its arc on a thin wire, and a sideways drag spins the
// ring — the labels glide round with it, always upright. Tapping a segment or
// its label opens its charge form / sources sheet; holding the ring or a
// label saves/shares the whole block as an image. More than 3 micronutrients
// move to a small ring above; tapping it swaps the two.
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
  // See-through over the ambient glow, but the saved PNG needs a solid
  // background: go solid, wait two frames for it to be on screen, capture.
  const screenBg = useScreenBackground();
  const [capturing, setCapturing] = useState(false);
  function handleHoldToShare() {
    if (!screenBg) {
      holdToShare();
      return;
    }
    setCapturing(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        holdToShare().finally(() => setCapturing(false));
      })
    );
  }
  // With a small ring in the corner, tapping it swaps which group is big.
  const [microBig, setMicroBig] = useState(false);

  const { main, mini } = splitRing(buildRingItems(metricIds, batteries, totals, microStates));
  const big = mini && microBig ? mini : main;
  const small = mini ? (microBig ? main : mini) : null;
  const hasEatenToday = foodLog.length > 0;
  const reached = ringReached(big, hasEatenToday);

  // The stage is the full content width; until measured, assume the window.
  const screen = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const stageWidth = measuredWidth > 0 ? measuredWidth : screen.width - 2 * SIDE_PADDING;
  const layout = calloutLayout(stageWidth, big.length);
  const ringSize = RING_GEOMETRY.size * layout.scale;
  const ringBox = { left: layout.cx - ringSize / 2, top: layout.cy - ringSize / 2, width: ringSize, height: ringSize };

  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const spinStart = useSharedValue(0);
  const spinDirection = useSharedValue(1);
  // The stage's centre line, kept up to date by onLayout.
  const spinCenterY = useSharedValue(layout.cy);
  // Built once, so a re-render mid-drag never swaps the gesture
  // (.ai/skills/learned/gesture-rebuilt-each-render-drops-release.md).
  const spinGesture = useMemo(
    () => buildSpinGesture({ rotation, start: spinStart, direction: spinDirection, centerY: spinCenterY }, reduceMotion),
    [rotation, spinStart, spinDirection, spinCenterY, reduceMotion]
  );
  const ringSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

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

  // The ring under the finger is spun; turn the tap back before looking up
  // its slot (viewBox units, so undo the scale too). A press that ends a
  // spin (the ring turned since the finger went down) is not a tap.
  const [pressStartRotation, setPressStartRotation] = useState(0);
  function handleRingPress(e: GestureResponderEvent) {
    if (Math.abs(rotation.value - pressStartRotation) > 2) return;
    const index = slotAtPoint(
      e.nativeEvent.locationX / layout.scale,
      e.nativeEvent.locationY / layout.scale,
      big.length,
      RING_GEOMETRY,
      rotation.value
    );
    if (index != null) onPressCell?.(big[index].id);
  }

  return (
    // collapsable={false} + solid background: what the hold-to-share capture needs.
    <View ref={shareRef} collapsable={false} style={[styles.container, !capturing && screenBg]}>
      {small && (
        <Pressable
          onPress={() => setMicroBig((v) => !v)}
          onLongPress={handleHoldToShare}
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

      <GestureDetector gesture={spinGesture}>
        <View
          style={[styles.stage, { height: layout.height }]}
          onLayout={(e: LayoutChangeEvent) => {
            setMeasuredWidth(e.nativeEvent.layout.width);
            setShared(spinCenterY, e.nativeEvent.layout.height / 2);
          }}
        >
          <Animated.View style={[styles.abs, ringBox, ringSpin]} pointerEvents="none">
            <RingArcs items={big} geometry={RING_GEOMETRY} reached={null} displaySize={ringSize} />
          </Animated.View>
          <Svg style={styles.abs} width={layout.width} height={layout.height} pointerEvents="none">
            {big.map((it, i) => (
              <CalloutWire key={it.id} layout={layout} index={i} count={big.length} color={it.color} rotation={rotation} />
            ))}
          </Svg>
          <Pressable
            onPressIn={() => setPressStartRotation(rotation.value)}
            onPress={handleRingPress}
            onLongPress={handleHoldToShare}
            accessibilityHint={t('common.holdToShareHint')}
            style={[styles.abs, styles.ringCenter, ringBox]}
          >
            <Text style={styles.centerValue} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
              {reached.total > 0
                ? t('components.batteryRing.centerValue', { done: reached.done, total: reached.total })
                : t('components.batteryRing.centerNone')}
            </Text>
            <Text style={styles.centerLabel} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
              {t('components.batteryRing.centerLabel')}
            </Text>
          </Pressable>

          {legend.map(({ it, name, fullName, percentage, amount }, i) => {
            const onToggle =
              it.id === 'water' ? onToggleWaterUnit : it.id === 'movement' ? onToggleMovementUnit : undefined;
            return (
              <CalloutLabel key={it.id} layout={layout} index={i} count={big.length} rotation={rotation}>
                <Pressable
                  onPress={() => onPressCell?.(it.id)}
                  onLongPress={handleHoldToShare}
                  accessibilityRole="button"
                  accessibilityLabel={t('components.batteryCell.a11yLabel', { name: fullName, percentage, amount })}
                  accessibilityHint={t('common.holdToShareHint')}
                  style={({ pressed }) => [styles.callout, pressed && styles.pressed]}
                >
                  <Text
                    style={styles.calloutName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}
                  >
                    {name}
                  </Text>
                  <Text style={styles.calloutPct} numberOfLines={1} maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}>
                    {percentage}%
                  </Text>
                  {layout.compact ? null : onToggle ? (
                    <Pressable
                      onPress={onToggle}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityHint={t('components.batteryCell.a11yToggleUnitHint')}
                    >
                      <Text
                        style={[styles.calloutAmount, styles.legendAmountToggle]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}
                      >
                        {amount}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text
                      style={styles.calloutAmount}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      maxFontSizeMultiplier={LEGEND_FONT_SCALE_CAP}
                    >
                      {amount}
                    </Text>
                  )}
                </Pressable>
              </CalloutLabel>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: SIDE_PADDING, paddingVertical: 6, gap: 4, backgroundColor: c.bg },
  // Shown only with 4+ micronutrients: the small ring sits above the stage,
  // right-aligned, clear of the labels that orbit the big ring.
  miniBox: { alignSelf: 'flex-end', alignItems: 'center', width: MINI_RING_GEOMETRY.size + 8 },
  miniLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '600', marginTop: -2 },
  stage: { alignSelf: 'stretch' },
  abs: { position: 'absolute', left: 0, top: 0 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  centerValue: { color: c.textPrimary, fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  centerLabel: { color: c.textTertiary, fontSize: 11 },
  callout: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  calloutName: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  calloutPct: { color: c.textPrimary, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  calloutAmount: { color: c.textTertiary, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  legendAmountToggle: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});

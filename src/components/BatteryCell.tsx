import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { colors } from '../lib/theme';

interface Props {
  id: string;
  name: string;
  unit: string;
  level: number;
  capacity: number;
  percentage: number; // 0–100
  color: string;
  onPress?: () => void;
  // Water-only: overrides the plain "{level}{unit}" label with an
  // already-formatted string (e.g. "1.5L" instead of "1500ml") — formatting
  // stays in the caller (BatteryStack), which owns the ml<->L conversion.
  levelLabel?: string;
  // Water-only: when provided, the level label becomes tappable and cycles
  // its display unit (ml <-> L) without touching the underlying ml value.
  onToggleUnit?: () => void;
}

const CELL_WIDTH = 60;
const CELL_HEIGHT = 100;
const TERMINAL_H = 6;
const BORDER_R = 6;

// Animating SVG rect props (not RN styles) via Reanimated keeps the fill
// transition on the UI thread — no extra dependency (already used elsewhere
// in the app) and no per-frame JS cost.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function BatteryCell({
  id,
  name,
  unit,
  level,
  percentage,
  color,
  onPress,
  levelLabel,
  onToggleUnit,
}: Props) {
  const progress = useSharedValue(percentage);

  useEffect(() => {
    progress.value = withTiming(percentage, { duration: 500 });
  }, [percentage, progress]);

  const animatedFillProps = useAnimatedProps(() => {
    const fillHeight = CELL_HEIGHT * (progress.value / 100);
    return {
      height: fillHeight,
      y: TERMINAL_H + (CELL_HEIGHT - fillHeight) - 2,
    };
  });

  const levelColor =
    percentage > 50 ? color : percentage > 20 ? colors.warning : colors.dangerStrong;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Svg width={CELL_WIDTH} height={CELL_HEIGHT + TERMINAL_H}>
        <Defs>
          <LinearGradient id={`grad_${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={levelColor} stopOpacity="1" />
            <Stop offset="1" stopColor={levelColor} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>

        {/* Terminal nub */}
        <Rect
          x={CELL_WIDTH * 0.3}
          y={0}
          width={CELL_WIDTH * 0.4}
          height={TERMINAL_H}
          rx={2}
          fill={colors.textFaint}
        />

        {/* Body outline */}
        <Rect
          x={0}
          y={TERMINAL_H}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          rx={BORDER_R}
          fill={colors.bgCard}
          stroke={colors.borderSubtle}
          strokeWidth={2}
        />

        {/* Fill level — animates smoothly between percentage changes */}
        <G>
          <AnimatedRect
            x={2}
            width={CELL_WIDTH - 4}
            rx={BORDER_R - 2}
            fill={`url(#grad_${id})`}
            animatedProps={animatedFillProps}
          />
        </G>

        {/* Percentage text */}
        <Rect x={0} y={TERMINAL_H} width={CELL_WIDTH} height={CELL_HEIGHT} rx={BORDER_R} fill="transparent" />
      </Svg>

      <Text style={styles.percentage}>{percentage}%</Text>
      <Text style={styles.name}>{name}</Text>
      {onToggleUnit ? (
        <Pressable onPress={onToggleUnit} hitSlop={6}>
          <Text style={[styles.level, styles.levelToggle]}>
            {levelLabel ?? `${Math.round(level)}${unit}`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.level}>{levelLabel ?? `${Math.round(level)}${unit}`}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  percentage: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  name: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  level: {
    fontSize: 10,
    color: colors.textMuted,
  },
  levelToggle: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
});

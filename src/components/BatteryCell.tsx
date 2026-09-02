import React, { useEffect } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

// Cap for iOS/Android "larger text" accessibility settings on the labels
// glued to the fixed 60×100 SVG graphic below — lets low-vision users get
// meaningfully bigger text (up to 1.5×) without the fixed-width card
// clipping or overlapping neighbors in the horizontal battery row.
const CARD_LABEL_FONT_SCALE_CAP = 1.5;

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
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(percentage);
  const displayAmount = levelLabel ?? `${Math.round(level)}${unit}`;

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
    percentage > 50 ? color : percentage > 20 ? c.warning : c.dangerStrong;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('components.batteryCell.a11yLabel', {
        name,
        percentage,
        amount: displayAmount,
      })}
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
          fill={c.textFaint}
        />

        {/* Body outline */}
        <Rect
          x={0}
          y={TERMINAL_H}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          rx={BORDER_R}
          fill={c.bgCard}
          stroke={c.borderSubtle}
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

      <Text style={styles.percentage} maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}>
        {percentage}%
      </Text>
      <Text style={styles.name} maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}>
        {name}
      </Text>
      {onToggleUnit ? (
        <Pressable
          onPress={onToggleUnit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityHint={t('components.batteryCell.a11yToggleUnitHint')}
        >
          <Text
            style={[styles.level, styles.levelToggle]}
            maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}
          >
            {displayAmount}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.level} maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}>
          {displayAmount}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.textPrimary,
  },
  name: {
    fontSize: 11,
    color: c.textSecondary,
    textAlign: 'center',
  },
  level: {
    fontSize: 12,
    // textDim, not textMuted: textMuted only clears ~2.9:1 against bgCard
    // (below WCAG AA) — textDim clears ~5.6-6:1 in both themes. This is a
    // real number (grams/ml/steps remaining) a user needs to read, not
    // decorative caption text.
    color: c.textDim,
  },
  levelToggle: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
});

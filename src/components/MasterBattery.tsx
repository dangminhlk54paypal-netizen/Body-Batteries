import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';

interface Props {
  percentage: number; // 0–100
  levelKcal?: number; // current energy reserve (kcal) — Hướng B
  capacityKcal?: number; // daily energy capacity (kcal) — Hướng B
}

const W = 120;
const H = 200;
const TERMINAL_H = 10;
const R = 10;

// Animating SVG rect props (not RN styles) via Reanimated keeps the fill
// transition on the UI thread — no extra dependency, no per-frame JS cost.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function MasterBattery({ percentage, levelKcal, capacityKcal }: Props) {
  const progress = useSharedValue(percentage);

  useEffect(() => {
    progress.value = withTiming(percentage, { duration: 500 });
  }, [percentage]);

  const animatedFillProps = useAnimatedProps(() => {
    const fillHeight = H * (progress.value / 100);
    return {
      height: fillHeight,
      y: TERMINAL_H + (H - fillHeight) - 3,
    };
  });

  const color =
    percentage > 60 ? '#00B894' : percentage > 30 ? '#FFD93D' : '#FF4757';

  return (
    <View style={styles.container}>
      <Svg width={W} height={H + TERMINAL_H}>
        <Defs>
          <LinearGradient id="masterGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="1" stopColor={color} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>

        {/* Terminal */}
        <Rect x={W * 0.35} y={0} width={W * 0.3} height={TERMINAL_H} rx={3} fill="#555" />

        {/* Body */}
        <Rect x={0} y={TERMINAL_H} width={W} height={H} rx={R} fill="#1a1a2e" stroke="#333" strokeWidth={2.5} />

        {/* Fill — animates smoothly between percentage changes */}
        <AnimatedRect
          x={3}
          width={W - 6}
          rx={R - 2}
          fill="url(#masterGrad)"
          animatedProps={animatedFillProps}
        />
      </Svg>

      <Text style={styles.pct}>{percentage}%</Text>
      <Text style={styles.label}>Năng lượng tổng</Text>
      {capacityKcal != null && levelKcal != null && (
        <Text style={styles.kcal}>
          {levelKcal.toFixed(1)} / {Math.round(capacityKcal)} kcal
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  pct: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  label: {
    fontSize: 13,
    color: '#aaa',
  },
  kcal: {
    fontSize: 12,
    color: '#00B894',
    fontWeight: '600',
  },
});

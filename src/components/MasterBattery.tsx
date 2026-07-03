import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';

interface Props {
  percentage: number; // eaten / goal, 0–100+ (can exceed 100 when eating past the goal)
  levelKcal?: number; // kcal eaten so far today
  capacityKcal?: number; // today's kcal goal
  canEatKcal?: number; // live "còn được ăn ngay" — positive = room left, negative = ahead of pace
}

const W = 120;
const H = 200;
const TERMINAL_H = 10;
const R = 10;

// Animating SVG rect props (not RN styles) via Reanimated keeps the fill
// transition on the UI thread — no extra dependency, no per-frame JS cost.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function formatKcal(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

export function MasterBattery({ percentage, levelKcal, capacityKcal, canEatKcal }: Props) {
  // The bar itself always caps at 100% — a surplus past the goal is called
  // out as text ("Ăn dư"), not by overflowing the shape.
  const fillPercentage = Math.min(100, Math.max(0, percentage));
  const isOver = levelKcal != null && capacityKcal != null && levelKcal > capacityKcal;

  const progress = useSharedValue(fillPercentage);

  useEffect(() => {
    progress.value = withTiming(fillPercentage, { duration: 500 });
  }, [fillPercentage]);

  const animatedFillProps = useAnimatedProps(() => {
    const fillHeight = H * (progress.value / 100);
    return {
      height: fillHeight,
      y: TERMINAL_H + (H - fillHeight) - 3,
    };
  });

  // An empty battery in the morning is normal, not a warning (CONTEXT mục 5)
  // — no red for low. Amber only marks "ăn dư" (eating past today's goal), a
  // neutral flag, never a moralizing color.
  const color = isOver ? '#FFD93D' : '#00B894';

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

      <Text style={styles.pct}>{Math.round(fillPercentage)}%</Text>
      <Text style={styles.label}>Đã ăn hôm nay</Text>
      {capacityKcal != null && levelKcal != null && (
        <Text style={styles.kcal}>
          {formatKcal(levelKcal)} / {formatKcal(capacityKcal)} kcal
        </Text>
      )}
      {isOver && levelKcal != null && capacityKcal != null && (
        <Text style={styles.overText}>Ăn dư {formatKcal(levelKcal - capacityKcal)} kcal</Text>
      )}

      {canEatKcal != null && (
        <View style={styles.liveSection}>
          <View style={styles.divider} />
          {canEatKcal >= 0 ? (
            <Text style={styles.livePositive}>Còn được ăn ngay: +{formatKcal(canEatKcal)} kcal</Text>
          ) : (
            <Text style={styles.liveOver}>Đang dư: {formatKcal(-canEatKcal)} kcal</Text>
          )}
          <Text style={styles.disclaimer}>* Chỉ để tham khảo.</Text>
        </View>
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
  overText: {
    fontSize: 12,
    color: '#FFD93D',
    fontWeight: '600',
  },
  liveSection: {
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    width: '100%',
  },
  divider: {
    width: '80%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
    marginBottom: 4,
  },
  livePositive: {
    fontSize: 13,
    color: '#00B894',
    fontWeight: '600',
  },
  liveOver: {
    fontSize: 13,
    color: '#FFD93D',
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
});

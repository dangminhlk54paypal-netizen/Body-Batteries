import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { colors } from '../lib/theme';
import { useChargeEffectStore } from '../store/chargeEffectStore';

interface Props {
  // Headline fullness battery (S-Q): drains with the clock, engine floors it
  // at SATIETY_FLOOR_PCT so it never reads fully empty.
  satietyPct: number;
  // Calorie ledger line (S-M engine): eaten / goal for this energy day.
  levelKcal?: number;
  capacityKcal?: number;
  // Optional weight-goal line, e.g. "Mục tiêu: giảm về 72 kg (an toàn)".
  goalLabel?: string;
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

export function MasterBattery({ satietyPct, levelKcal, capacityKcal, goalLabel }: Props) {
  const fillPercentage = Math.min(100, Math.max(0, satietyPct));
  const isOver = levelKcal != null && capacityKcal != null && levelKcal > capacityKcal;

  const progress = useSharedValue(fillPercentage);

  useEffect(() => {
    progress.value = withTiming(fillPercentage, { duration: 500 });
  }, [fillPercentage, progress]);

  const animatedFillProps = useAnimatedProps(() => {
    const fillHeight = H * (progress.value / 100);
    return {
      height: fillHeight,
      y: TERMINAL_H + (H - fillHeight) - 3,
    };
  });

  // "Charging" pulse (P4): a short pop + amber glow that plays whenever a
  // food/supplement log succeeds, driven by an explicit trigger from the
  // event handler (pulseId), never inferred from watching levelKcal change.
  const pulseId = useChargeEffectStore((s) => s.pulseId);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const seenFirstPulse = useRef(false);

  useEffect(() => {
    // Skip the pulse on initial mount (pulseId starts at 0, no real trigger).
    if (!seenFirstPulse.current) {
      seenFirstPulse.current = true;
      return;
    }
    pulseScale.value = withSequence(
      withTiming(1.06, { duration: 150 }),
      withTiming(1, { duration: 200 })
    );
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 250 })
    );
  }, [pulseId, pulseScale, glowOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.4,
    shadowOpacity: glowOpacity.value * 0.8,
  }));

  // A low fullness battery is normal (mornings, between meals) — the fill is
  // always the same calm green, never red, at any % (CONTEXT mục 5). Amber is
  // only used for the neutral "ăn dư" ledger text below, never for the bar.
  const color = colors.accent;

  return (
    <View style={styles.container}>
      <View style={styles.batteryWrap}>
        {/* Charging glow (P4): amber backdrop that fades in/out on a food
            log — real backgroundColor opacity so it also reads on Android,
            plus an iOS shadow for extra softness. */}
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
        <Animated.View style={pulseStyle}>
          <Svg width={W} height={H + TERMINAL_H}>
            <Defs>
              <LinearGradient id="masterGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.9" />
                <Stop offset="1" stopColor={color} stopOpacity="0.6" />
              </LinearGradient>
            </Defs>

            {/* Terminal */}
            <Rect x={W * 0.35} y={0} width={W * 0.3} height={TERMINAL_H} rx={3} fill={colors.textFaint} />

            {/* Body */}
            <Rect x={0} y={TERMINAL_H} width={W} height={H} rx={R} fill={colors.bgCard} stroke={colors.borderSubtle} strokeWidth={2.5} />

            {/* Fill — animates smoothly between percentage changes */}
            <AnimatedRect
              x={3}
              width={W - 6}
              rx={R - 2}
              fill="url(#masterGrad)"
              animatedProps={animatedFillProps}
            />
          </Svg>
        </Animated.View>
      </View>

      <Text style={styles.pct}>{Math.round(fillPercentage)}%</Text>
      <Text style={styles.label}>Năng lượng cơ thể</Text>

      <View style={styles.ledgerSection}>
        <View style={styles.divider} />
        {capacityKcal != null && levelKcal != null && (
          <Text style={styles.ledger}>
            Sổ calo hôm nay: {formatKcal(levelKcal)} / {formatKcal(capacityKcal)} kcal
          </Text>
        )}
        {isOver && levelKcal != null && capacityKcal != null && (
          <Text style={styles.overText}>Ăn dư {formatKcal(levelKcal - capacityKcal)} kcal</Text>
        )}
        {goalLabel != null && <Text style={styles.goal}>{goalLabel}</Text>}
        <Text style={styles.disclaimer}>* Chỉ để tham khảo.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  batteryWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: colors.accent,
    borderRadius: 40,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
  },
  pct: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ledgerSection: {
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    width: '100%',
  },
  divider: {
    width: '80%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginBottom: 4,
  },
  ledger: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  overText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
  },
  goal: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disclaimer: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

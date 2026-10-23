import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSettingsStore } from '../store/settingsStore';
import { useChargeEffectStore } from '../store/chargeEffectStore';
import { useLiveEnergyReading } from '../hooks/useLiveEnergyReading';
import { useResolvedThemeMode, useThemeColors } from '../hooks/useThemeColors';
import { ambientTint } from '../lib/ambientBackground';

// App-wide ambient glow (Gemini-style, see docs/nghien-cuu/
// 2026-10-23-hinh-nen-doi-mau-kieu-gemini.md): a few soft radial blobs drift
// slowly behind every tab. The main blob is tinted by the fullness battery
// (coral → amber → mint), so the colour itself says how full you are; an
// amber bloom swells once each time food is logged (same pulseId trigger as
// MasterBattery), then settles. Rendered once behind the tab navigator, so it
// stays put while pages slide past it. Purely decorative — no text, hidden
// from screen readers, still (no drift) under iOS Reduce Motion.

const DRIFT_MS = 14000;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function AmbientBackground() {
  const enabled = useSettingsStore((s) => s.ambientBackgroundEnabled);
  return enabled ? <AmbientGlow /> : null;
}

// Reads the live battery (re-renders every second) but hands the canvas only
// the rounded tint, so the SVG redraws just when the colour actually moves.
function AmbientGlow() {
  const { satietyPct } = useLiveEnergyReading();
  return <AmbientCanvas tint={ambientTint(Math.round(satietyPct))} />;
}

const AmbientCanvas = React.memo(function AmbientCanvas({ tint }: { tint: string }) {
  const { width, height } = useWindowDimensions();
  const c = useThemeColors();
  // Softer on the light theme, where a coloured haze reads stronger.
  const peak = useResolvedThemeMode() === 'light' ? 0.22 : 0.3;
  const reduceMotion = useReducedMotion();

  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(drift);
  }, [reduceMotion, drift]);

  const pulseId = useChargeEffectStore((s) => s.pulseId);
  const bloom = useSharedValue(0);
  const seenFirstPulse = useRef(false);
  useEffect(() => {
    // pulseId starts at 0 on mount — not a real food log.
    if (!seenFirstPulse.current) {
      seenFirstPulse.current = true;
      return;
    }
    bloom.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
    );
  }, [pulseId, bloom]);

  const tintProps = useAnimatedProps(() => ({
    cx: width * (0.18 + 0.2 * drift.value),
    cy: height * (0.16 + 0.1 * drift.value),
  }));
  const altProps = useAnimatedProps(() => ({
    cx: width * (0.9 - 0.25 * drift.value),
    cy: height * (0.7 - 0.12 * drift.value),
  }));
  const bloomProps = useAnimatedProps(() => ({ opacity: bloom.value }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="ambientTint" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={peak} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ambientAlt" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.accentAlt} stopOpacity={peak * 0.8} />
            <Stop offset="1" stopColor={c.accentAlt} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ambientBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={peak} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <AnimatedCircle animatedProps={tintProps} r={width * 0.9} fill="url(#ambientTint)" />
        <AnimatedCircle animatedProps={altProps} r={width * 0.8} fill="url(#ambientAlt)" />
        <AnimatedCircle
          animatedProps={bloomProps}
          cx={width * 0.5}
          cy={height * 0.3}
          r={width}
          fill="url(#ambientBloom)"
        />
      </Svg>
    </View>
  );
});

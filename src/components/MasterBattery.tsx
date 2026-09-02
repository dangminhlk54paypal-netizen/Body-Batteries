import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  type SharedValue,
} from 'react-native-reanimated';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useChargeEffectStore } from '../store/chargeEffectStore';
import { useSettingsStore } from '../store/settingsStore';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';
import type { Language } from '../i18n/types';

interface Props {
  // Headline fullness battery (S-Q): drains with the clock, engine floors it
  // at SATIETY_FLOOR_PCT so it never reads fully empty.
  satietyPct: number;
  // Calorie ledger line (S-M engine): eaten / goal for this energy day.
  levelKcal?: number;
  capacityKcal?: number;
  // Optional weight-goal line, e.g. "Mục tiêu: giảm về 72 kg (an toàn)".
  goalLabel?: string;
  // Today's workout/steps kcal that grew the goal (energyBalanceEngine) —
  // rendered as a small "🏃 Vận động hôm nay: +N kcal..." line.
  activityBonusKcal?: number;
  // Optional estimated daily target line, e.g.
  // "Cần ~1800 kcal/ngày để đạt 65 kg · BMR ~1500", rendered under goalLabel.
  targetLine?: string;
}

const W = 120;
const H = 200;
const TERMINAL_H = 10;
const R = 10;

// Cap for iOS/Android "larger text" accessibility settings on the pct/label
// captions glued to the fixed W×H SVG graphic above — same reasoning as
// BatteryCell's identical constant: lets low-vision users get meaningfully
// bigger text without the graphic's fixed width clipping it.
const CARD_LABEL_FONT_SCALE_CAP = 1.5;

// Animating SVG rect props (not RN styles) via Reanimated keeps the fill
// transition on the UI thread — no extra dependency, no per-frame JS cost.
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function formatKcal(n: number, language: Language): string {
  return Math.round(n).toLocaleString(LOCALE_TAGS[language]);
}

// ── Charge particle burst (P7) ──────────────────────────────────────────────
// A handful of dots fly a gentle curved path into the battery's fill top,
// timed with the P4 charge pulse. Every geometry value below is a fixed,
// deterministic preset computed once at module load (no Math.random()/
// Date.now(), so this stays clear of react-hooks/purity) — varied start
// angle + curvature per particle is enough to read as "converging" without
// any randomness at render time.
const PARTICLE_LANDING_X = W / 2;
const PARTICLE_LANDING_Y = TERMINAL_H + 18;

interface ParticlePreset {
  angleDeg: number;
  radius: number;
  curveDeg: number;
  delayMs: number;
}

const PARTICLE_PRESETS: ParticlePreset[] = [
  { angleDeg: 200, radius: 95, curveDeg: 230, delayMs: 0 },
  { angleDeg: 250, radius: 105, curveDeg: 275, delayMs: 40 },
  { angleDeg: 300, radius: 90, curveDeg: 325, delayMs: 15 },
  { angleDeg: 340, radius: 100, curveDeg: 5, delayMs: 60 },
  { angleDeg: 15, radius: 100, curveDeg: 45, delayMs: 30 },
  { angleDeg: 65, radius: 90, curveDeg: 100, delayMs: 75 },
  { angleDeg: 115, radius: 105, curveDeg: 150, delayMs: 10 },
];

interface ParticleGeometry {
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  delayMs: number;
}

const PARTICLE_GEOMETRY: ParticleGeometry[] = PARTICLE_PRESETS.map((preset) => {
  const startRad = (preset.angleDeg * Math.PI) / 180;
  const curveRad = (preset.curveDeg * Math.PI) / 180;
  const curveRadius = preset.radius * 0.7;
  return {
    startX: PARTICLE_LANDING_X + Math.cos(startRad) * preset.radius,
    startY: PARTICLE_LANDING_Y + Math.sin(startRad) * preset.radius,
    ctrlX: PARTICLE_LANDING_X + Math.cos(curveRad) * curveRadius,
    ctrlY: PARTICLE_LANDING_Y + Math.sin(curveRad) * curveRadius,
    delayMs: preset.delayMs,
  };
});

// Quadratic-bezier interpolation, runs on the UI thread inside the particles'
// useAnimatedProps worklets below.
function bezierPoint(p0: number, c: number, p1: number, t: number): number {
  'worklet';
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * c + t * t * p1;
}

// Custom hook (name starts with "use" so react-hooks/rules-of-hooks treats
// it as a hook) — derives one particle's cx/cy/opacity from its own progress
// shared value each frame. Called a fixed number of times below, never in a
// loop, so hook call order stays stable across renders.
function useParticleAnimatedProps(progress: SharedValue<number>, geom: ParticleGeometry) {
  return useAnimatedProps(() => {
    const t = progress.value;
    const cx = bezierPoint(geom.startX, geom.ctrlX, PARTICLE_LANDING_X, t);
    const cy = bezierPoint(geom.startY, geom.ctrlY, PARTICLE_LANDING_Y, t);
    const opacity = t < 0.06 ? 0 : t > 0.8 ? Math.max(0, (1 - t) / 0.2) : 1;
    return { cx, cy, opacity };
  });
}

export function MasterBattery({
  satietyPct,
  levelKcal,
  capacityKcal,
  goalLabel,
  activityBonusKcal,
  targetLine,
}: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
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

  // Particle burst (P7): toggleable in Settings, gates only the extra dots —
  // the pulse/glow above always plays regardless of this flag.
  const particleEffectsEnabled = useSettingsStore((s) => s.particleEffectsEnabled);
  const particleProgress0 = useSharedValue(0);
  const particleProgress1 = useSharedValue(0);
  const particleProgress2 = useSharedValue(0);
  const particleProgress3 = useSharedValue(0);
  const particleProgress4 = useSharedValue(0);
  const particleProgress5 = useSharedValue(0);
  const particleProgress6 = useSharedValue(0);

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

    if (particleEffectsEnabled) {
      const progressValues = [
        particleProgress0,
        particleProgress1,
        particleProgress2,
        particleProgress3,
        particleProgress4,
        particleProgress5,
        particleProgress6,
      ];
      progressValues.forEach((pv, i) => {
        // Snap back to 0 first (duration 0), then fly to 1 after this
        // particle's stagger delay — a single .value assignment via
        // withSequence, same shape as the pulse/glow assignments above.
        pv.value = withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(PARTICLE_GEOMETRY[i].delayMs, withTiming(1, { duration: 320 }))
        );
      });
    }
  }, [
    pulseId,
    pulseScale,
    glowOpacity,
    particleEffectsEnabled,
    particleProgress0,
    particleProgress1,
    particleProgress2,
    particleProgress3,
    particleProgress4,
    particleProgress5,
    particleProgress6,
  ]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.4,
    shadowOpacity: glowOpacity.value * 0.8,
  }));

  const particleProps0 = useParticleAnimatedProps(particleProgress0, PARTICLE_GEOMETRY[0]);
  const particleProps1 = useParticleAnimatedProps(particleProgress1, PARTICLE_GEOMETRY[1]);
  const particleProps2 = useParticleAnimatedProps(particleProgress2, PARTICLE_GEOMETRY[2]);
  const particleProps3 = useParticleAnimatedProps(particleProgress3, PARTICLE_GEOMETRY[3]);
  const particleProps4 = useParticleAnimatedProps(particleProgress4, PARTICLE_GEOMETRY[4]);
  const particleProps5 = useParticleAnimatedProps(particleProgress5, PARTICLE_GEOMETRY[5]);
  const particleProps6 = useParticleAnimatedProps(particleProgress6, PARTICLE_GEOMETRY[6]);

  // A low fullness battery is normal (mornings, between meals) — the fill is
  // always the same calm green, never red, at any % (CONTEXT mục 5). Amber is
  // only used for the neutral "ăn dư" ledger text below, never for the bar.
  const color = c.accent;

  return (
    <View style={styles.container}>
      <View
        style={styles.batteryWrap}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('components.masterBattery.a11yLabel', {
          percentage: Math.round(fillPercentage),
        })}
      >
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
            <Rect x={W * 0.35} y={0} width={W * 0.3} height={TERMINAL_H} rx={3} fill={c.textFaint} />

            {/* Body */}
            <Rect x={0} y={TERMINAL_H} width={W} height={H} rx={R} fill={c.bgCard} stroke={c.borderSubtle} strokeWidth={2.5} />

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

        {/* Charge particle burst (P7): dots fly a curved path into the fill
            top, timed with the pulse/glow above. Toggleable in Settings. */}
        {particleEffectsEnabled && (
          <View pointerEvents="none" style={styles.particleLayer}>
            <Svg width={W} height={H + TERMINAL_H}>
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps0} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps1} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps2} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps3} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps4} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps5} />
              <AnimatedCircle r={3} fill={c.accent} animatedProps={particleProps6} />
            </Svg>
          </View>
        )}
      </View>

      <Text style={styles.pct} maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}>
        {Math.round(fillPercentage)}%
      </Text>
      <Text style={styles.label} maxFontSizeMultiplier={CARD_LABEL_FONT_SCALE_CAP}>
        {t('components.masterBattery.label')}
      </Text>

      <View style={styles.ledgerSection}>
        <View style={styles.divider} />
        {capacityKcal != null && levelKcal != null && (
          <Text style={styles.ledger}>
            {t('components.masterBattery.ledgerLine', {
              eaten: formatKcal(levelKcal, language),
              goal: formatKcal(capacityKcal, language),
            })}
          </Text>
        )}
        {isOver && levelKcal != null && capacityKcal != null && (
          <Text style={styles.overText}>
            {t('components.masterBattery.overAmount', {
              amount: formatKcal(levelKcal - capacityKcal, language),
            })}
          </Text>
        )}
        {activityBonusKcal != null && activityBonusKcal > 0 && (
          <Text style={styles.activityBonus}>
            {t('components.masterBattery.activityBonusLine', {
              amount: formatKcal(activityBonusKcal, language),
            })}
          </Text>
        )}
        {goalLabel != null && <Text style={styles.goal}>{goalLabel}</Text>}
        {targetLine != null && <Text style={styles.targetLine}>{targetLine}</Text>}
        <Text style={styles.disclaimer}>{t('components.masterBattery.disclaimer')}</Text>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  batteryWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  glow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: c.accent,
    borderRadius: 40,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
  },
  pct: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
  },
  label: {
    fontSize: 13,
    color: c.textSecondary,
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
    backgroundColor: c.borderSubtle,
    marginBottom: 4,
  },
  ledger: {
    fontSize: 13,
    color: c.accent,
    fontWeight: '600',
  },
  overText: {
    fontSize: 12,
    color: c.warning,
    fontWeight: '600',
  },
  activityBonus: {
    fontSize: 12,
    color: c.mint,
  },
  goal: {
    fontSize: 12,
    color: c.textSecondary,
  },
  targetLine: {
    fontSize: 12,
    color: c.textSecondary,
  },
  disclaimer: {
    fontSize: 12,
    // textDim, not textMuted: textMuted only clears ~2.9:1 against bgCard
    // (below WCAG AA 4.5:1) — textDim clears ~5.6-6:1 in both themes.
    color: c.textDim,
    fontStyle: 'italic',
  },
});

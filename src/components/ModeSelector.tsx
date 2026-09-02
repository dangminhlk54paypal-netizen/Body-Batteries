import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { MODES, modeName } from '../domain/modes/modeDefinitions';
import type { ModeId, ModeDefinition } from '../types/modes';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { useLanguage } from '../i18n/useT';

interface Props {
  currentMode: ModeId;
  onChange: (mode: ModeId) => void;
}

export function ModeSelector({ currentMode, onChange }: Props) {
  const language = useLanguage();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      {Object.values(MODES).map((mode) => (
        <ModeChip
          key={mode.id}
          mode={mode}
          label={modeName(mode.id, language)}
          active={mode.id === currentMode}
          onPress={() => onChange(mode.id as ModeId)}
        />
      ))}
    </View>
  );
}

// Crossfades the chip background between the inactive grey and the mode's
// color on the UI thread, instead of snapping instantly on selection.
function ModeChip({
  mode,
  label,
  active,
  onPress,
}: {
  mode: ModeDefinition;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(active ? 1 : 0);
  const inactiveBg = c.bgElevated;
  // Tactile press feedback (neo-skeuomorphism affordance): a small scale-down
  // while held, springing back on release. onPressIn/onPressOut only flip a
  // plain bit of React state (always safe in an event handler) — the actual
  // shared-value mutation happens in the useEffect below, the same place
  // `progress` above is mutated, since react-hooks/immutability rejects
  // assigning `.value` directly inside an inline JSX event-handler closure.
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 250 });
  }, [active, progress]);

  useEffect(() => {
    scale.value = withTiming(pressed ? 0.94 : 1, { duration: pressed ? 100 : 150 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [inactiveBg, mode.color]),
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.chip, animatedStyle]}>
      <Pressable
        onPress={() => {
          haptics.tapLight();
          onPress();
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={({ pressed: isPressed }) => [styles.chipInner, isPressed && styles.pressed]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  chipInner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  chipText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: c.textPrimary,
  },
});

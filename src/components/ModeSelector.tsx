import React, { useEffect } from 'react';
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

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 250 });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [inactiveBg, mode.color]),
  }));

  return (
    <Animated.View style={[styles.chip, animatedStyle]}>
      <Pressable
        onPress={() => {
          haptics.tapLight();
          onPress();
        }}
        style={({ pressed }) => [styles.chipInner, pressed && styles.pressed]}
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

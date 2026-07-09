import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { MODES } from '../domain/modes/modeDefinitions';
import type { ModeId, ModeDefinition } from '../types/modes';
import { colors } from '../lib/theme';

interface Props {
  currentMode: ModeId;
  onChange: (mode: ModeId) => void;
}

const INACTIVE_BG = colors.bgElevated;

export function ModeSelector({ currentMode, onChange }: Props) {
  return (
    <View style={styles.row}>
      {Object.values(MODES).map((mode) => (
        <ModeChip
          key={mode.id}
          mode={mode}
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
  active,
  onPress,
}: {
  mode: ModeDefinition;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 250 });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [INACTIVE_BG, mode.color]),
  }));

  return (
    <Animated.View style={[styles.chip, animatedStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.chipInner, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{mode.name}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
});

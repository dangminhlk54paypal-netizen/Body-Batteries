import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  // Already-translated title (caller passes t('...')) — this component has
  // no strings of its own to add to the locale files.
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

// Generic collapsible wrapper for grouping several already-titled blocks
// under one umbrella heading, so a long screen can read as "glance zone" +
// one expandable "details zone" instead of one flat, equally-weighted
// stack. Expanded by default — collapsing is an opt-in decluttering tool,
// never a way data goes missing for existing users.
export function CollapsibleSection({ title, children, defaultExpanded = true }: Props) {
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(defaultExpanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
      >
        <Text style={styles.title}>{title}</Text>
        <Animated.View style={chevronStyle}>
          <Text style={styles.chevron}>⌄</Text>
        </Animated.View>
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 12 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    pressed: { opacity: 0.6 },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textSoft,
    },
    chevron: {
      fontSize: 18,
      color: c.textTertiary,
    },
    content: { gap: 24 },
  });

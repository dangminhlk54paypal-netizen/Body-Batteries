import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  // Already-translated text (the caller uses t()); no strings of its own.
  title: string;
  subtitle?: string;
  // 'block' = the big underlined heading of a whole block ("Block 2"),
  // 'week' = the bold "W4: 77.5kg" line.
  variant: 'block' | 'week';
  // Grey the heading out (a week with nothing in it).
  dimmed?: boolean;
  defaultExpanded?: boolean;
  // Long-press on the heading (rename a block / edit a week's note).
  onLongPress?: () => void;
  children: React.ReactNode;
}

// A collapsible heading styled like the headings in the user's Notes. Like
// CollapsibleSection it mounts `children` only while open — so a week's data
// is fetched only when the user actually opens it. Separate from
// CollapsibleSection (whose look is a screen-level card header) rather than
// bending that shared component into a second style.
export function TrainingNotebookSection({
  title,
  subtitle,
  variant,
  dimmed,
  defaultExpanded = false,
  onLongPress,
  children,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={variant === 'block' ? styles.blockContainer : styles.weekContainer}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        <View style={styles.headerText}>
          <Text
            style={[
              variant === 'block' ? styles.blockTitle : styles.weekTitle,
              dimmed && styles.dimmed,
            ]}
          >
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    blockContainer: { gap: 6, marginBottom: 14 },
    weekContainer: { gap: 4, marginTop: 4 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
    headerText: { flex: 1, gap: 2 },
    chevron: { width: 14, color: c.textTertiary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
    blockTitle: {
      color: c.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
      textDecorationLine: 'underline',
    },
    weekTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '700', lineHeight: 24 },
    dimmed: { color: c.textMuted },
    subtitle: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    content: { paddingLeft: 20, gap: 6 },
    pressed: { opacity: 0.6 },
  });

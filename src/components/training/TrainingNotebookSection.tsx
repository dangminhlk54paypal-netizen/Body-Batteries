import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  // Already-translated text (the caller uses t()); no strings of its own.
  title: string;
  // Week headings only: `titleLead` ("B3W1") bold, `title` (the dates)
  // plain, `titleTail` (the weight) green italic — "B3W1: 21.09–27.09 75kg".
  titleLead?: string | null;
  titleTail?: string | null;
  subtitle?: string;
  // 'block' = the big underlined blue italic heading of a block or month,
  // 'week' = the "B2W4: 07.09–13.09 77.5kg" line (label bold, rest plain).
  variant: 'block' | 'week';
  // Grey the heading out (a week with nothing in it).
  dimmed?: boolean;
  defaultExpanded?: boolean;
  // Controlled open/closed (the period section closes itself when idle).
  // Omitted = the section keeps its own state, starting at defaultExpanded.
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  // Show the open content in a window of at most this height that scrolls on
  // its own, instead of growing the whole screen.
  bodyMaxHeight?: number;
  // Long-press on the heading (rename a block / edit a week's note).
  onLongPress?: () => void;
  // A small ✎ at the end of the heading row, with its accessibility label.
  onEdit?: () => void;
  editLabel?: string;
  children: React.ReactNode;
}

// A collapsible heading styled like the headings in the user's Notes. Like
// CollapsibleSection it mounts `children` only while open — so a week's data
// is fetched only when the user actually opens it. Separate from
// CollapsibleSection (whose look is a screen-level card header) rather than
// bending that shared component into a second style.
export function TrainingNotebookSection({
  title,
  titleLead,
  titleTail,
  subtitle,
  variant,
  dimmed,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  bodyMaxHeight,
  onLongPress,
  onEdit,
  editLabel,
  children,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [ownExpanded, setOwnExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? ownExpanded;
  const toggle = () => {
    if (controlledExpanded === undefined) setOwnExpanded(!expanded);
    onExpandedChange?.(!expanded);
  };

  return (
    <View style={variant === 'block' ? styles.blockContainer : styles.weekContainer}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={toggle}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={[titleLead ? `${titleLead}:` : null, title, titleTail].filter(Boolean).join(' ')}
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
              {titleLead ? <Text style={styles.weekLead}>{titleLead}: </Text> : null}
              {title}
              {titleTail ? <Text style={styles.weekTail}> {titleTail}</Text> : null}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </Pressable>
        {onEdit ? (
          <Pressable
            hitSlop={8}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <Text style={styles.editText}>✎</Text>
          </Pressable>
        ) : null}
      </View>
      {expanded &&
        (bodyMaxHeight ? (
          <ScrollView
            style={[styles.scrollBox, { maxHeight: bodyMaxHeight }]}
            contentContainerStyle={[styles.content, styles.scrollContent]}
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.content}>{children}</View>
        ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    blockContainer: { gap: 6, marginBottom: 14 },
    weekContainer: { gap: 4, marginTop: 4 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    header: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
    headerText: { flex: 1, gap: 2 },
    chevron: { width: 14, color: c.textTertiary, fontSize: 16, lineHeight: 24, textAlign: 'center' },
    blockTitle: {
      color: c.notebookPeriod,
      fontSize: 19,
      fontWeight: '800',
      fontStyle: 'italic',
      lineHeight: 24,
      textDecorationLine: 'underline',
    },
    weekTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '400', lineHeight: 24 },
    weekLead: { fontWeight: '700' },
    weekTail: { color: c.notebookWeight, fontStyle: 'italic' },
    editBtn: {
      width: 26,
      height: 26,
      marginTop: 3,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    editText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    dimmed: { color: c.textMuted },
    subtitle: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    content: { paddingLeft: 20, gap: 6 },
    scrollBox: {
      marginLeft: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgCard,
    },
    scrollContent: { paddingLeft: 8, paddingRight: 8, paddingVertical: 6 },
    pressed: { opacity: 0.6 },
  });

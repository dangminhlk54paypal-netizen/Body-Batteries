import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { InfoPopover } from './InfoPopover';
import type { InfoSection } from './InfoPopover';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  icon: string;
  title: string; // already translated keyword ("Đã ăn")
  // The key number(s) on the right, so a closed row still tells you
  // something ("1.450 kcal · 5 món").
  value: string;
  info?: InfoSection[]; // long explanations, behind ⓘ
  open: boolean;
  onToggle: () => void;
  // Lists that can grow long scroll inside a window this tall instead of
  // pushing the page down forever.
  maxBodyHeight?: number;
  children: React.ReactNode;
}

// One flat, full-width folded row of Home's "Chi tiết hôm nay" list:
// icon · keyword · value · ⓘ · ⌄. Flat (no card) so the blocks inside keep
// their own 20-px gutters. The screen keeps one row open at a time.
export function FoldRow({ icon, title, value, info, open, onToggle, maxBodyHeight, children }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.header, open && styles.headerOpen, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${value}`}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        {info && info.length > 0 ? <InfoPopover title={title} sections={info} /> : <View style={styles.infoSpacer} />}
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open &&
        (maxBodyHeight ? (
          <ScrollView
            style={{ maxHeight: maxBodyHeight }}
            contentContainerStyle={styles.body}
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.body}>{children}</View>
        ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      minHeight: 52,
    },
    headerOpen: { backgroundColor: c.bgCard },
    pressed: { opacity: 0.6 },
    icon: { fontSize: 17, width: 24, textAlign: 'center' },
    title: { fontSize: 14, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
    value: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    infoSpacer: { width: 20 },
    chevron: { width: 16, textAlign: 'center', fontSize: 16, color: c.textTertiary },
    body: { paddingVertical: 12, gap: 12 },
  });

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { InfoPopover } from './InfoPopover';
import type { InfoSection } from './InfoPopover';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  icon: string;
  title: string; // already translated
  // One line under the title with the current values ("Nhắc 20:00 · pin < 20%"),
  // so a folded section still tells you what is set.
  summary: string;
  info?: InfoSection[]; // the long explanations, behind a small ⓘ
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// One folded card of the Settings screen: a heading you tap to open, the
// current values in one line, long text behind ⓘ. The screen keeps one card
// open at a time so the phone never shows a wall of settings.
export function SettingsSection({ icon, title, summary, info, open, onToggle, children }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {info && info.length > 0 && <InfoPopover title={title} sections={info} />}
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      overflow: 'hidden',
    },
    cardOpen: { borderColor: c.accent },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 18 },
    titleWrap: { flex: 1, gap: 2 },
    title: { fontSize: 14, fontWeight: '800', color: c.textPrimary, letterSpacing: 0.4 },
    summary: { fontSize: 12, color: c.textMuted },
    chevron: { width: 18, textAlign: 'center', fontSize: 16, color: c.textTertiary },
    body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
    pressed: { opacity: 0.6 },
  });

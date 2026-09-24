import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

export interface InfoSection {
  heading?: string;
  body: string;
}

interface Props {
  // Already-resolved strings (callers pass t('...')) — this component has
  // no locale keys of its own besides the badge/close chrome.
  title: string;
  sections: InfoSection[];
}

// Small "ⓘ" badge that opens its explanation in a centered popup — the same
// pattern as BodyProfileCard's InfoPopup. It used to expand inline, relying on
// `flexBasis: '100%'` inside a `flexWrap` row to push the panel onto its own
// line; on device the panel never became visible, so tapping ⓘ showed
// nothing. A Modal doesn't depend on the host row's layout at all.
// Only safe where no other Modal is open at the same moment (two stacked RN
// <Modal>s hide the top one on iOS) — so don't place it inside a BottomSheet.
export function InfoPopover({ title, sections }: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('planAppendix.infoAbout', { title })}
      >
        <Text style={styles.badgeText}>i</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          {/* Swallows taps on the card so they don't reach the backdrop. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {sections.map((s, i) => (
                <View key={i} style={styles.section}>
                  {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
                  <Text style={styles.body}>{s.body}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    badge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    pressed: { opacity: 0.6 },
    badgeText: { color: c.accent, fontSize: 12, fontWeight: '700', fontStyle: 'italic' },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: c.bgElevated,
      borderRadius: 16,
      padding: 18,
      gap: 10,
      maxHeight: '80%',
    },
    title: { color: c.textBright, fontSize: 16, fontWeight: '700' },
    scroll: { flexGrow: 0 },
    scrollContent: { gap: 12 },
    section: { gap: 4 },
    heading: { color: c.textSoft, fontSize: 13, fontWeight: '700' },
    body: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
    closeBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.accent,
    },
    closeText: { color: c.bg, fontSize: 13, fontWeight: '700' },
  });

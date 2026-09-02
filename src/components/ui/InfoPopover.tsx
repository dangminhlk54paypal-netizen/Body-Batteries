import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  // Already-resolved strings (callers pass t('...')) — this component has
  // no locale keys of its own besides the show/hide toggle chrome.
  title: string;
  body: string;
}

// Small "ⓘ" affordance that expands its explanation INLINE, never as a
// second <Modal>/<BottomSheet> — every screen that will host this
// (BlockBuilderWizard, PlanAppendixSheet) is already itself rendered inside
// one BottomSheet Modal, and this app has a documented real bug (Session 18
// roadmap entry) where two RN <Modal>s stacked hide the top one on iOS.
// Toggle-in-place is the only interaction that's safe everywhere this is used.
export function InfoPopover({ title, body }: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <Pressable
        hitSlop={8}
        onPress={() => setExpanded((e) => !e)}
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? t('planAppendix.infoToggleHide') : t('planAppendix.infoToggleShow')}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.badgeText}>ⓘ</Text>
      </Pressable>
      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      )}
    </View>
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
    badgeText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    panel: {
      marginTop: 6,
      padding: 10,
      borderRadius: 10,
      backgroundColor: c.bgHighlight,
      gap: 4,
    },
    title: { color: c.textBright, fontSize: 12, fontWeight: '700' },
    body: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  });

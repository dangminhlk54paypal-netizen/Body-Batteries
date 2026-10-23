import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { DataRetentionPanel } from './DataRetentionPanel';
import { useSettingsStore } from '../../store/settingsStore';
import { resolveDataRetention } from '../../types/dataRetention';
import { syncRetentionReminders } from '../../services/retention/retentionService';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

// Asked once (first launch after onboarding, or after this feature shipped):
// how long to keep data and what goes into the Kho. Swiping it away only
// hides it until the next launch — it is answered by "Lưu lựa chọn".
export function DataRetentionSetupSheet() {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const setupDone = useSettingsStore((s) => resolveDataRetention(s.dataRetention).setupDone);
  const setDataRetention = useSettingsStore((s) => s.setDataRetention);
  const [hidden, setHidden] = useState(false);

  function save() {
    setDataRetention({ setupDone: true });
    void syncRetentionReminders();
  }

  return (
    <BottomSheet visible={!setupDone && !hidden} onClose={() => setHidden(true)} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('dataRetention.setup.title')}</Text>
        <Text style={styles.caption}>{t('dataRetention.setup.intro')}</Text>
        <DataRetentionPanel />
        <View style={styles.footer}>
          <Pressable
            onPress={save}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.saveText}>{t('dataRetention.setup.save')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, gap: 12 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    caption: { fontSize: 13, color: c.textTertiary, lineHeight: 19 },
    footer: { marginTop: 4 },
    saveBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    saveText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

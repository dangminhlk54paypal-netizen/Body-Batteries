import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { TrainingLogView } from '../components/training/TrainingLogView';
import { BlockPlanView } from '../components/training/BlockPlanView';
import { useT } from '../i18n/useT';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';

type Mode = 'log' | 'plan';

// The Tập luyện tab: the training log ("Sổ tập", the default) and the S-PL
// Block Builder's plan ("Kế hoạch block"). Each view owns its own scrolling and
// data loading; this screen only switches between them.
export function TrainingScreen() {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const [mode, setMode] = useState<Mode>('log');

  const tabs: { key: Mode; label: string }[] = [
    { key: 'log', label: t('trainingLog.tabLog') },
    { key: 'plan', label: t('trainingLog.tabPlan') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const active = mode === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setMode(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {mode === 'log' ? <TrainingLogView /> : <BlockPlanView />}
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabActive: { backgroundColor: c.accent, borderColor: c.accent },
    tabText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: c.bg },
    pressed: { opacity: 0.6 },
  });

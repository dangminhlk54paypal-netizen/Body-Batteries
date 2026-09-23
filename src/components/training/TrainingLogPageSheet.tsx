import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import {
  getTrainingLogDaysInRange,
  getTrainingLogWeeksInRange,
} from '../../data/repositories/trainingLogRepository';
import { formatPeriodTitle } from '../../domain/training/trainingLogFormatter';
import { buildPeriodText } from '../../domain/training/trainingLogPage';
import type { TrainingLogFormat, TrainingLogPeriod } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  period: TrainingLogPeriod;
  format: TrainingLogFormat;
}

// A whole block (or month) as one plain-text page — the same lines the notebook
// shows, laid out like the user's Apple Notes — to read as a single piece or
// share (the OS share sheet has "Notes" and "Copy"), so it can go straight back
// into Notes. The parent remounts it (via `key`) for every opening.
export function TrainingLogPageSheet({ visible, onClose, period, format }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const { startDate, endDate } = period;
    Promise.all([
      getActivityLogInRange(startDate, endDate),
      getTrainingLogDaysInRange(startDate, endDate),
      getTrainingLogWeeksInRange(startDate, endDate),
      getWeightsInRange(startDate, endDate),
    ]).then(([entries, dayRecords, weekRecords, weights]) => {
      if (!cancelled) {
        setText(buildPeriodText({ period, entries, dayRecords, weekRecords, weights, format, language }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, period, format, language, revision]);

  function share() {
    if (!text) return;
    // React Native's own Share: no extra dependency, and on iOS the sheet offers
    // Notes / Copy directly. `title` is only used by Android.
    Share.share({ message: text, title: t('trainingLog.pageShareTitle') });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{formatPeriodTitle(period, language)}</Text>
        {text == null ? (
          <ActivityIndicator color={c.textMuted} />
        ) : text.trim() === '' ? (
          <Text style={styles.empty}>{t('trainingLog.pageEmpty')}</Text>
        ) : (
          <Text selectable style={styles.page}>
            {text}
          </Text>
        )}
        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.close')}</Text>
          </Pressable>
          <Pressable
            disabled={!text}
            style={({ pressed }) => [styles.btn, styles.confirm, !text && styles.disabled, pressed && styles.pressed]}
            onPress={share}
          >
            <Text style={styles.confirmText}>{t('trainingLog.pageShare')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    page: {
      color: c.textPrimary,
      fontSize: 15,
      lineHeight: 22,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
    },
    empty: { color: c.textMuted, fontSize: 14 },
    row: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });

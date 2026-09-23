import React from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import {
  detectDayConflict,
  formatDayLine,
  trainingDaySignature,
} from '../../domain/training/trainingLogFormatter';
import type { ActivityLogEntry } from '../../types/energy';
import type { TrainingLogDayRecord, TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  date: string; // YYYY-MM-DD
  entries: ActivityLogEntry[]; // that day's Xả entries
  record: TrainingLogDayRecord | undefined; // the user's own line / note, if any
  weightKg: number | null;
  format: TrainingLogFormat;
  // Tap on the line (opens the editor). Omitted = plain, non-tappable text.
  onPress?: () => void;
}

// One day of the notebook: "26.08(77.7kg): S 130 4x3x115+3x100 PD 4x3x100".
// The text is either the auto-generated line (from Xả) or what the user wrote
// over it / by hand — shown identically, with a faint ✎ (edited) or ✍ (hand-
// written) at the end. If the Xả entries behind a user-written line changed
// since, a small banner asks what to do; nothing is ever overwritten silently.
export function TrainingLogDayLine({ date, entries, record, weightKg, format, onPress }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const clearDayOverride = useTrainingLogStore((s) => s.clearDayOverride);
  const acceptCurrentSignature = useTrainingLogStore((s) => s.acceptCurrentSignature);
  const mergeAutoIntoOverride = useTrainingLogStore((s) => s.mergeAutoIntoOverride);

  const line = formatDayLine({ date, entries, bodyWeightKg: weightKg, format, language });
  const override = record?.overrideText ?? null;
  const body = override ?? line.body;
  const conflict = detectDayConflict({ record, entries });

  // ✍ = no Xả entry ever stood behind this line (or none is left); ✎ = the
  // user rewrote an auto line.
  const marker =
    override == null ? null : record?.sourceSignature == null || conflict === 'sourceGone' ? 'manual' : 'edited';

  function confirmUseAuto() {
    Alert.alert(t('trainingLog.useAutoConfirmTitle'), t('trainingLog.useAutoConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('trainingLog.useAuto'), style: 'destructive', onPress: () => clearDayOverride(date) },
    ]);
  }

  const signature = trainingDaySignature(entries);
  const conflictMessage =
    conflict === 'sourceChanged'
      ? t('trainingLog.conflictSourceChanged')
      : conflict === 'xaAddedToManual'
        ? t('trainingLog.conflictXaAdded')
        : conflict === 'sourceGone'
          ? t('trainingLog.conflictSourceGone')
          : null;

  return (
    <View style={styles.container}>
      <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
        <Text selectable style={styles.line}>
          <Text style={styles.prefix}>{line.prefix}</Text>
          {body ? ` ${body}` : ''}
          {marker ? (
            <Text
              style={styles.marker}
              accessibilityLabel={marker === 'manual' ? t('trainingLog.markManual') : t('trainingLog.markEdited')}
            >
              {marker === 'manual' ? ' ✍' : ' ✎'}
            </Text>
          ) : null}
        </Text>
      </Pressable>

      {record?.note ? (
        <Text selectable style={styles.note}>
          {record.note}
        </Text>
      ) : null}

      {conflictMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{conflictMessage}</Text>
          {conflict !== 'sourceGone' && (
            <View style={styles.bannerRow}>
              <Pressable style={({ pressed }) => [styles.bannerBtn, pressed && styles.pressed]} onPress={confirmUseAuto}>
                <Text style={styles.bannerBtnText}>{t('trainingLog.useAuto')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.bannerBtn, pressed && styles.pressed]}
                onPress={() => acceptCurrentSignature(date, signature)}
              >
                <Text style={styles.bannerBtnText}>{t('trainingLog.keepMine')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.bannerBtn, pressed && styles.pressed]}
                onPress={() => mergeAutoIntoOverride(date, line.body, signature)}
              >
                <Text style={styles.bannerBtnText}>{t('trainingLog.merge')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 2, paddingVertical: 3 },
    line: { color: c.textPrimary, fontSize: 15, lineHeight: 22 },
    prefix: { fontWeight: '700' },
    marker: { color: c.textMuted, fontSize: 13 },
    note: { color: c.textTertiary, fontSize: 14, lineHeight: 20 },
    banner: {
      marginTop: 4,
      gap: 6,
      padding: 8,
      borderRadius: 8,
      backgroundColor: c.bgHighlight,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
    },
    bannerText: { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
    bannerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    bannerBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    bannerBtnText: { color: c.accent, fontSize: 11, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

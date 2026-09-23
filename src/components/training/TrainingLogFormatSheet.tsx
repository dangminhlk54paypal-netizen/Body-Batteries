import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Switch, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { abbreviationKeyOf, formatDayLine } from '../../domain/training/trainingLogFormatter';
import { POWERLIFTING_VARIATIONS } from '../../lib/powerliftingVariations';
import { workoutLabel } from '../../lib/activityLabels';
import { daysAgo, todayString } from '../../lib/dateUtils';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { ActivityLogEntry } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// How far back to look for the user's own exercises/variations to offer an
// abbreviation box for (custom variations and bodybuilding exercises have no
// fixed list).
const ABBREVIATION_LOOKBACK_DAYS = 90;

// A fixed sample day, so the preview line shows what the current options do
// without depending on the user's real data (or the clock).
const SAMPLE_DATE = '2026-08-28';
const SAMPLE_ENTRY: ActivityLogEntry = {
  id: 'sample',
  timestamp: new Date(2026, 7, 28, 18).getTime(),
  steps: 0,
  energyKcal: 245,
  satietyDrainKcal: 0,
  energyDayApplied: SAMPLE_DATE,
  workouts: [
    {
      type: 'bench_press',
      minutes: 40,
      sets: [
        { kind: 'warmup', weightKg: 20, reps: 8 },
        { kind: 'warmup', weightKg: 60, reps: 6 },
        { kind: 'warmup', weightKg: 80, reps: 3 },
        { kind: 'working', weightKg: 90, reps: 1 },
        { kind: 'working', weightKg: 97.5, reps: 1 },
        { kind: 'working', weightKg: 100, reps: 1 },
        ...[2, 2, 2, 2, 5].map((reps) => ({ kind: 'working' as const, weightKg: 90, reps })),
      ],
    },
    {
      type: 'bench_press',
      minutes: 15,
      variationId: 'bench_low_grip',
      sets: [6, 6, 6].map((reps) => ({ kind: 'working' as const, weightKg: 70, reps })),
    },
  ],
};

// Module-level wrappers keep the clock reads out of the component body.
function getLookbackRange(): { from: string; to: string } {
  return { from: daysAgo(ABBREVIATION_LOOKBACK_DAYS), to: todayString() };
}

interface AbbrRow {
  key: string;
  label: string;
  placeholder: string;
}

type BooleanOption = 'showWarmups' | 'showUnit' | 'showBodyWeight' | 'showWeekday' | 'showKcal';
const BOOLEAN_OPTIONS: BooleanOption[] = ['showWarmups', 'showUnit', 'showBodyWeight', 'showWeekday', 'showKcal'];

// The ⚙︎ sheet: how the log writes its lines. Every option applies to the whole
// notebook at once (lines are re-generated on display, never stored), and the
// preview at the top shows the effect immediately.
export function TrainingLogFormatSheet({ visible, onClose }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const format = useTrainingLogFormat();
  const setTrainingLogFormat = useSettingsStore((s) => s.setTrainingLogFormat);
  const setTrainingLogAbbreviation = useSettingsStore((s) => s.setTrainingLogAbbreviation);
  const [seenRows, setSeenRows] = useState<AbbrRow[]>([]);

  // The user's own variations / bodybuilding exercises from recent history.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const { from, to } = getLookbackRange();
    getActivityLogInRange(from, to).then((entries) => {
      if (cancelled) return;
      const rows = new Map<string, AbbrRow>();
      for (const entry of entries) {
        for (const w of entry.workouts) {
          const key = abbreviationKeyOf(w);
          if (!key || !(key.startsWith('cvar:') || key.startsWith('bb:'))) continue;
          const label = workoutLabel(w, language);
          rows.set(key, { key, label, placeholder: label });
        }
      }
      setSeenRows([...rows.values()]);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, language]);

  const fixedRows: AbbrRow[] = [
    ...LIFTING_EXERCISES.map((ex) => ({
      key: `lift:${ex}`,
      label: t(`activities.${ex}`),
      placeholder: t(`trainingLog.abbr.${ex}`),
    })),
    ...POWERLIFTING_VARIATIONS.filter((v) => v.loadFactor !== 1).map((v) => ({
      key: `var:${v.id}`,
      label: t(`blockVariations.${v.id}.label`),
      placeholder: t(`trainingLog.abbr.${v.id}`),
    })),
  ];

  const sample = formatDayLine({
    date: SAMPLE_DATE,
    entries: [SAMPLE_ENTRY],
    bodyWeightKg: 77.7,
    format,
    language,
  });

  function chip<K extends 'labelStyle' | 'decimal'>(option: K, value: TrainingLogFormat[K], label: string) {
    const active = format[option] === value;
    return (
      <Pressable
        key={String(value)}
        onPress={() => setTrainingLogFormat({ [option]: value })}
        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('trainingLog.formatSheet.title')}</Text>

        <View style={styles.previewCard}>
          <Text style={styles.label}>{t('trainingLog.formatSheet.preview')}</Text>
          <Text selectable style={styles.previewText}>
            <Text style={styles.previewPrefix}>{sample.prefix}</Text> {sample.body}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('trainingLog.formatSheet.labelStyle')}</Text>
          <View style={styles.chipRow}>
            {chip('labelStyle', 'short', t('trainingLog.formatSheet.labelShort'))}
            {chip('labelStyle', 'full', t('trainingLog.formatSheet.labelFull'))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('trainingLog.formatSheet.decimal')}</Text>
          <View style={styles.chipRow}>
            {chip('decimal', 'dot', t('trainingLog.formatSheet.decimalDot'))}
            {chip('decimal', 'locale', t('trainingLog.formatSheet.decimalLocale'))}
          </View>
        </View>

        <View style={styles.field}>
          {BOOLEAN_OPTIONS.map((option) => (
            <View key={option} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t(`trainingLog.formatSheet.${option}`)}</Text>
              <Switch
                value={format[option]}
                onValueChange={(v) => setTrainingLogFormat({ [option]: v })}
                accessibilityLabel={t(`trainingLog.formatSheet.${option}`)}
              />
            </View>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('trainingLog.formatSheet.abbreviations')}</Text>
          <Text style={styles.hint}>{t('trainingLog.formatSheet.abbreviationsHint')}</Text>
          {[...fixedRows, ...seenRows].map((row) => (
            <View key={row.key} style={styles.abbrRow}>
              <Text style={styles.abbrLabel} numberOfLines={2}>
                {row.label}
              </Text>
              <TextInput
                style={styles.abbrInput}
                placeholder={row.placeholder}
                placeholderTextColor={c.textMuted}
                accessibilityLabel={row.label}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                maxLength={16}
                value={format.abbreviations[row.key] ?? ''}
                onChangeText={(v) => setTrainingLogAbbreviation(row.key, v)}
              />
            </View>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={onClose}>
          <Text style={styles.doneText}>{t('common.close')}</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 16 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    label: { fontSize: 13, fontWeight: '700', color: c.textBright },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
    field: { gap: 8 },
    previewCard: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: c.bgHighlight },
    previewText: { color: c.textPrimary, fontSize: 15, lineHeight: 22 },
    previewPrefix: { fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: c.bg },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    switchLabel: { flex: 1, color: c.textPrimary, fontSize: 14 },
    abbrRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    abbrLabel: { flex: 1, color: c.textSecondary, fontSize: 13 },
    abbrInput: {
      width: 96,
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 14,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
      textAlign: 'center',
    },
    doneBtn: { padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.bgElevated },
    doneText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    pressed: { opacity: 0.6 },
  });

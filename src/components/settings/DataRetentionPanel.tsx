import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import {
  ARCHIVE_KINDS,
  RETENTION_KEEP_OPTIONS,
  RETENTION_MONTH_OPTIONS,
  resolveDataRetention,
  type RetentionKeepFraction,
  type RetentionMonths,
} from '../../types/dataRetention';
import {
  loadRetentionOverview,
  syncRetentionReminders,
  type RetentionOverview,
} from '../../services/retention/retentionService';
import { formatBytes } from '../../lib/byteSize';
import { formatDisplayDate } from '../../lib/dateUtils';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

const KEEP_LABELS: Record<RetentionKeepFraction, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const ARCHIVE_ICONS = { weight: '⚖️', gym: '🏋️', eatingHabits: '🥗' } as const;

export function monthsKey(months: RetentionMonths): string {
  return months == null ? 'forever' : `m${months}`;
}

// How long data stays + the Kho, with a live size estimate. Changes apply at
// once (Settings → Dữ liệu, and the one-time setup sheet).
export function DataRetentionPanel() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const stored = useSettingsStore((s) => s.dataRetention);
  const setDataRetention = useSettingsStore((s) => s.setDataRetention);
  const settings = resolveDataRetention(stored);
  const [overview, setOverview] = useState<RetentionOverview | null>(null);

  const settingsKey = JSON.stringify([settings.months, settings.keepFraction, settings.archive]);
  useEffect(() => {
    let alive = true;
    // A new period / Kho choice moves the trim date, so the reminders follow.
    void syncRetentionReminders();
    loadRetentionOverview(resolveDataRetention(useSettingsStore.getState().dataRetention)).then(
      (o) => alive && setOverview(o),
      () => alive && setOverview(null)
    );
    return () => {
      alive = false;
    };
  }, [settingsKey]);

  const keepSpan = settings.months == null ? 0 : settings.months * settings.keepFraction;
  const keepSpanLabel = Number.isInteger(keepSpan)
    ? t('dataRetention.spanMonths', { n: keepSpan })
    : t('dataRetention.spanDays', { n: Math.round(keepSpan * 30.44) });

  let estimateLine = '';
  if (overview) {
    const current = formatBytes(overview.estimate.currentBytes, language);
    estimateLine =
      overview.estimate.peakBytes == null
        ? t('dataRetention.estimateForever', { perYear: formatBytes(overview.estimate.perYearBytes, language), current })
        : t('dataRetention.estimate', { peak: formatBytes(overview.estimate.peakBytes, language), current });
    if (overview.nextTrimDate) {
      estimateLine += ` · ${t('dataRetention.nextTrim', { date: formatDisplayDate(overview.nextTrimDate, language) })}`;
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('dataRetention.periodLabel')}</Text>
      <View style={styles.segmented}>
        {RETENTION_MONTH_OPTIONS.map((months) => {
          const active = months === settings.months;
          return (
            <Pressable
              key={monthsKey(months)}
              onPress={() => setDataRetention({ months })}
              style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t(`dataRetention.periodLong.${monthsKey(months)}`)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                {t(`dataRetention.periodShort.${monthsKey(months)}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {settings.months != null && (
        <View style={styles.row}>
          <Text style={styles.rowLabel} numberOfLines={2}>
            {t('dataRetention.keepLabel', { span: keepSpanLabel })}
          </Text>
          <View style={[styles.segmented, styles.segmentedCompact]}>
            {RETENTION_KEEP_OPTIONS.map((fraction) => {
              const active = fraction === settings.keepFraction;
              return (
                <Pressable
                  key={fraction}
                  onPress={() => setDataRetention({ keepFraction: fraction })}
                  style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{KEEP_LABELS[fraction]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {estimateLine !== '' && <Text style={styles.hint}>{estimateLine}</Text>}

      <Text style={styles.label}>{t('dataRetention.archiveTitle')}</Text>
      <View style={styles.chipRow}>
        {ARCHIVE_KINDS.map((kind) => {
          const on = settings.archive[kind];
          return (
            <Pressable
              key={kind}
              onPress={() => setDataRetention({ archive: { [kind]: !on } })}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
              accessibilityRole="switch"
              accessibilityLabel={t(`dataRetention.archive.${kind}`)}
              accessibilityState={{ checked: on }}
            >
              <Text style={styles.chipIcon}>{ARCHIVE_ICONS[kind]}</Text>
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {t(`dataRetention.archive.${kind}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    label: { fontSize: 12, color: c.textTertiary, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 52,
      borderRadius: 12,
    },
    rowLabel: { flexShrink: 1, fontSize: 14, color: c.textPrimary, fontWeight: '600' },
    hint: { fontSize: 12, color: c.textMuted, paddingHorizontal: 4 },
    segmented: { flexDirection: 'row', backgroundColor: c.bgElevated, borderRadius: 12, padding: 3, gap: 3 },
    segmentedCompact: { minWidth: 150 },
    segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4, borderRadius: 9 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
    segmentTextActive: { color: c.onAccent },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipOn: { borderColor: c.accent },
    chipIcon: { fontSize: 18 },
    chipText: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    chipTextOn: { color: c.textPrimary },
    pressed: { opacity: 0.6 },
  });

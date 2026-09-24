import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { TrainingNotebookSection } from './TrainingNotebookSection';
import { TrainingLogDayLine } from './TrainingLogDayLine';
import type { TrainingLogActions } from './trainingLogActions';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import {
  getTrainingLogDaysInRange,
  getTrainingLogWeeksInRange,
} from '../../data/repositories/trainingLogRepository';
import { formatWeekHeading, formatWeekLabel } from '../../domain/training/trainingLogFormatter';
import { suggestEntryDate } from '../../domain/training/trainingLogIndex';
import { firstWeightInRange, weightRecordedOn } from '../../domain/training/trainingLogWeights';
import type { WeightPoint } from '../../domain/training/trainingLogWeights';
import { dateString, todayString } from '../../lib/dateUtils';
import type { ActivityLogEntry } from '../../types/energy';
import type {
  TrainingLogDayRecord,
  TrainingLogFormat,
  TrainingLogPeriod,
  TrainingLogWeek,
} from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  week: TrainingLogWeek;
  period: TrainingLogPeriod;
  weights: WeightPoint[]; // manual weigh-ins of the whole period
  format: TrainingLogFormat;
  defaultExpanded: boolean;
  actions: TrainingLogActions;
}

// Module-level wrapper so the impure clock read is invisible to the component's
// purity analysis (same trick as EnergyActionsBar.getTodayString).
function getTodayString(): string {
  return todayString();
}

// "B2W4: 07.09–13.09 77.5kg" inside a block; "07.09–13.09 77.5kg" for a free week.
export function TrainingLogWeekSection({ week, period, weights, format, defaultExpanded, actions }: Props) {
  const { language } = useT();

  const weight = firstWeightInRange(week.weekStart, week.weekEnd, weights);
  const label = formatWeekLabel(week, period, language);
  const title = formatWeekHeading(week, period, weight, format, language);

  return (
    <TrainingNotebookSection
      title={title}
      variant="week"
      dimmed={week.dates.length === 0}
      defaultExpanded={defaultExpanded}
      onLongPress={() => actions.editWeekNote(week.weekStart, label)}
    >
      <TrainingLogWeekBody week={week} label={label} weights={weights} format={format} actions={actions} />
    </TrainingNotebookSection>
  );
}

interface WeekData {
  entries: ActivityLogEntry[];
  days: TrainingLogDayRecord[];
  weekNote: string | null;
}

// Mounted only while the week is open. Reloads whenever the store's revision
// changes (every write, and every time the tab regains focus), so an open week
// never shows text older than what is in the database.
function TrainingLogWeekBody({
  week,
  label,
  weights,
  format,
  actions,
}: {
  week: TrainingLogWeek;
  label: string;
  weights: WeightPoint[];
  format: TrainingLogFormat;
  actions: TrainingLogActions;
}) {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const [data, setData] = useState<WeekData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getActivityLogInRange(week.weekStart, week.weekEnd),
      getTrainingLogDaysInRange(week.weekStart, week.weekEnd),
      getTrainingLogWeeksInRange(week.weekStart, week.weekStart),
    ]).then(([entries, days, weeks]) => {
      if (!cancelled) setData({ entries, days, weekNote: weeks[0]?.note ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [week.weekStart, week.weekEnd, revision]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ActivityLogEntry[]>();
    for (const e of data?.entries ?? []) {
      // Same day rule as the index and History: COALESCE(start_at, timestamp).
      const date = dateString(new Date(e.startAt ?? e.timestamp));
      map.set(date, [...(map.get(date) ?? []), e]);
    }
    return map;
  }, [data]);

  const recordsByDate = useMemo(
    () => new Map((data?.days ?? []).map((d) => [d.date, d])),
    [data]
  );

  if (!data) return <ActivityIndicator color={c.textMuted} style={styles.loading} />;

  return (
    <View style={styles.body}>
      {data.weekNote ? (
        <Text selectable style={styles.weekNote}>
          {data.weekNote}
        </Text>
      ) : null}
      {week.dates.length === 0 && !data.weekNote ? (
        <Text style={styles.empty}>{t('trainingLog.emptyWeek')}</Text>
      ) : null}
      {week.dates.map((date) => (
        <TrainingLogDayLine
          key={date}
          date={date}
          entries={entriesByDate.get(date) ?? []}
          record={recordsByDate.get(date)}
          weightKg={format.showBodyWeight ? weightRecordedOn(date, weights) : null}
          format={format}
          onPress={() => actions.editDay(date)}
        />
      ))}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={() => actions.addDay(suggestEntryDate(week, getTodayString()))}
        >
          <Text style={styles.actionText}>{t('trainingLog.addEntryButton')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={() => actions.editWeekNote(week.weekStart, label)}
        >
          <Text style={styles.actionText}>{t('trainingLog.editWeekNoteButton')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { gap: 2 },
    loading: { alignSelf: 'flex-start', marginVertical: 8 },
    weekNote: { color: c.textTertiary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
    empty: { color: c.textMuted, fontSize: 15, lineHeight: 22 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    actionText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

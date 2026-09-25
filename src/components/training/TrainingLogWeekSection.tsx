import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { TrainingNotebookSection } from './TrainingNotebookSection';
import { TrainingLogDayLine } from './TrainingLogDayLine';
import type { TrainingLogActions } from './trainingLogActions';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import {
  getTrainingLogDaysInRange,
  getTrainingLogWeeksInRange,
} from '../../data/repositories/trainingLogRepository';
import { formatWeekHeadingParts, formatWeekLabel } from '../../domain/training/trainingLogFormatter';
import { suggestEntryDate } from '../../domain/training/trainingLogIndex';
import { weekHeadingWeight } from '../../domain/training/trainingLogWeights';
import type { WeightPoint } from '../../domain/training/trainingLogWeights';
import { dateString, todayString } from '../../lib/dateUtils';
import type { ActivityLogEntry } from '../../types/energy';
import type {
  TrainingLogDayRecord,
  TrainingLogFormat,
  TrainingLogWeek,
} from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  week: TrainingLogWeek;
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
// The ✎ beside the heading replaces the old "+ Ghi buổi" / "✎ Ghi chú tuần"
// buttons under every week: one tap asks which of the two to do.
export function TrainingLogWeekSection({ week, weights, format, defaultExpanded, actions }: Props) {
  const { t, language } = useT();

  const weight = weekHeadingWeight(week.weekStart, week.weekEnd, weights);
  const label = formatWeekLabel(week, language);
  const heading = formatWeekHeadingParts(week, weight, format, language);

  function openEditMenu() {
    Alert.alert(label, undefined, [
      { text: t('trainingLog.addEntryButton'), onPress: () => actions.addDay(suggestEntryDate(week, getTodayString())) },
      { text: t('trainingLog.editWeekNoteButton'), onPress: () => actions.editWeekNote(week.weekStart, label) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <TrainingNotebookSection
      title={heading.range}
      titleLead={heading.lead}
      titleTail={heading.weight}
      variant="week"
      dimmed={week.dates.length === 0}
      defaultExpanded={defaultExpanded}
      onLongPress={() => actions.editWeekNote(week.weekStart, label)}
      onEdit={openEditMenu}
      editLabel={t('trainingLog.weekEditA11y', { label })}
    >
      <TrainingLogWeekBody week={week} format={format} actions={actions} />
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
  format,
  actions,
}: {
  week: TrainingLogWeek;
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
          format={format}
          onPress={() => actions.editDay(date)}
        />
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { gap: 2 },
    loading: { alignSelf: 'flex-start', marginVertical: 8 },
    weekNote: { color: c.textTertiary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
    empty: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
  });

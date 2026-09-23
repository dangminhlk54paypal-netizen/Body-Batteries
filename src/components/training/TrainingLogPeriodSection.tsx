import React, { useEffect, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { TrainingNotebookSection } from './TrainingNotebookSection';
import { TrainingLogWeekSection } from './TrainingLogWeekSection';
import type { TrainingLogActions } from './trainingLogActions';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import { formatDayDate, formatPeriodTitle } from '../../domain/training/trainingLogFormatter';
import type { WeightPoint } from '../../domain/training/trainingLogWeights';
import type { TrainingLogFormat, TrainingLogPeriod } from '../../types/trainingLog';
import { useT } from '../../i18n/useT';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  period: TrainingLogPeriod;
  format: TrainingLogFormat;
  // Only the newest period opens on its own (with its newest week open too).
  isLatest: boolean;
  actions: TrainingLogActions;
}

// One block ("Block 2") or one month of free training. Collapsed it is a
// heading + a one-line summary; open it lists its weeks (W1 → W5).
export function TrainingLogPeriodSection({ period, format, isLatest, actions }: Props) {
  const { t, language } = useT();

  const title = formatPeriodTitle(period, language);

  const parts: string[] = [];
  if (period.kind === 'block') {
    if (period.focus) {
      parts.push(t(`blockBuilder.focus${period.focus.charAt(0).toUpperCase()}${period.focus.slice(1)}Label`));
    }
    parts.push(`${formatDayDate(period.startDate, language)}–${formatDayDate(period.endDate, language)}`);
  }
  parts.push(t('trainingLog.sessionsCount', { count: period.sessions }));

  return (
    <TrainingNotebookSection
      title={title}
      subtitle={parts.join(' · ')}
      variant="block"
      defaultExpanded={isLatest}
      onLongPress={period.kind === 'block' ? () => actions.renameBlock(period) : undefined}
    >
      <TrainingLogPeriodBody period={period} format={format} isLatest={isLatest} actions={actions} />
    </TrainingNotebookSection>
  );
}

// Mounted only while the period is open: one query for the period's weigh-ins
// (week headings and day prefixes show them), and the week sections, which
// each fetch their own lines only when opened.
function TrainingLogPeriodBody({ period, format, isLatest, actions }: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const [weights, setWeights] = useState<WeightPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    getWeightsInRange(period.startDate, period.endDate).then((rows) => {
      if (!cancelled) setWeights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [period.startDate, period.endDate, revision]);

  const lastIndex = period.weeks.length - 1;
  return (
    <>
      <Pressable style={({ pressed }) => [styles.pageBtn, pressed && styles.pressed]} onPress={() => actions.openPage(period)}>
        <Text style={styles.pageBtnText}>{t('trainingLog.pageButton')}</Text>
      </Pressable>
      {period.weeks.map((week, i) => (
        <TrainingLogWeekSection
          key={week.weekStart}
          week={week}
          kind={period.kind}
          weights={weights}
          format={format}
          defaultExpanded={isLatest && i === lastIndex}
          actions={actions}
        />
      ))}
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    pageBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    pageBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

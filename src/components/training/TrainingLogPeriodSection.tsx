import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { TrainingNotebookSection } from './TrainingNotebookSection';
import { TrainingLogWeekSection } from './TrainingLogWeekSection';
import type { TrainingLogActions } from './trainingLogActions';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import { formatDayDate, formatPeriodTitle } from '../../domain/training/trainingLogFormatter';
import { WEEK_WEIGHT_LOOKBACK_DAYS, type WeightPoint } from '../../domain/training/trainingLogWeights';
import { addDaysToDateString } from '../../lib/dateUtils';
import type { TrainingLogFormat, TrainingLogPeriod } from '../../types/trainingLog';
import { useT } from '../../i18n/useT';

interface Props {
  period: TrainingLogPeriod;
  format: TrainingLogFormat;
  // Only the newest period opens on its own. Its weeks open with it, so
  // opening any month/block shows its days straight away.
  isLatest: boolean;
  actions: TrainingLogActions;
}

// An open period shows about two weeks at a time and scrolls inside that
// window, so opening a month never stretches the screen without end.
const BODY_MAX_HEIGHT = 320;
// A period other than the newest closes itself after this long untouched.
const IDLE_COLLAPSE_MS = 2 * 60 * 1000;

// One block ("Block 2") or one month of free training. Collapsed it is a
// heading + a one-line summary; open it lists its weeks (W1 → W5). The ✎ at
// the heading opens the period's 📄 page — edit every line at once, or share.
export function TrainingLogPeriodSection({ period, format, isLatest, actions }: Props) {
  const { t, language } = useT();

  const title = formatPeriodTitle(period, language);
  const [expanded, setExpanded] = useState(isLatest);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearIdleTimer() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }
  // (Re)starts the countdown; every touch inside the open section calls it.
  // The newest period stays open.
  function armIdleCollapse() {
    clearIdleTimer();
    if (isLatest) return;
    idleTimer.current = setTimeout(() => setExpanded(false), IDLE_COLLAPSE_MS);
  }
  useEffect(() => clearIdleTimer, []);

  function onExpandedChange(next: boolean) {
    setExpanded(next);
    if (next) armIdleCollapse();
    else clearIdleTimer();
  }

  const parts: string[] = [];
  if (period.kind === 'block' && period.focus) {
    parts.push(t(`blockBuilder.focus${period.focus.charAt(0).toUpperCase()}${period.focus.slice(1)}Label`));
  }
  // A renamed free month ("Power Lifting") no longer says which month it is in
  // its title, so the dates move to the subtitle — same as a block.
  if (period.kind === 'block' || period.monthName) {
    parts.push(`${formatDayDate(period.startDate, language)}–${formatDayDate(period.endDate, language)}`);
  }
  parts.push(t('trainingLog.sessionsCount', { count: period.sessions }));

  return (
    <View onTouchStart={expanded ? armIdleCollapse : undefined}>
      <TrainingNotebookSection
        title={title}
        subtitle={parts.join(' · ')}
        variant="block"
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        bodyMaxHeight={BODY_MAX_HEIGHT}
        onLongPress={() => actions.periodMenu(period)}
        onEdit={() => actions.openPage(period)}
        editLabel={t('trainingLog.periodEditA11y', { title })}
      >
        <TrainingLogPeriodBody period={period} format={format} actions={actions} />
      </TrainingNotebookSection>
    </View>
  );
}

// Mounted only while the period is open: one query for the period's weigh-ins
// (the week headings show them), and the week sections, which
// each fetch their own lines only when opened.
function TrainingLogPeriodBody({ period, format, actions }: Omit<Props, 'isLatest'>) {
  const revision = useTrainingLogStore((s) => s.revision);
  const [weights, setWeights] = useState<WeightPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Reach back before the period so its first week heading can carry the
    // previous period's weight forward (weekHeadingWeight).
    getWeightsInRange(
      addDaysToDateString(period.startDate, -WEEK_WEIGHT_LOOKBACK_DAYS),
      period.endDate
    ).then((rows) => {
      if (!cancelled) setWeights(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [period.startDate, period.endDate, revision]);

  return (
    <>
      {period.weeks.map((week) => (
        <TrainingLogWeekSection
          key={week.weekStart}
          week={week}
          period={period}
          weights={weights}
          format={format}
          defaultExpanded
          actions={actions}
        />
      ))}
    </>
  );
}

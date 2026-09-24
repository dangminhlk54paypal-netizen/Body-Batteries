import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressChartSvg, liftColor } from './ProgressChartSvg';
import { formatDisplayDate, todayString } from '../../lib/dateUtils';
import { formatDayDate } from '../../domain/training/trainingLogFormatter';
import { bestLiftMaxes, formatChartValue } from '../../domain/training/progressChartModel';
import type { ChartLayout, ProgressChartModel, ProgressMode } from '../../domain/training/progressChartModel';
import type { LiftProgressWeek } from '../../domain/training/trainingLogProgress';
import { activityLabel } from '../../lib/activityLabels';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftMaxRecord, TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

// The "share my strength chart" poster — captured off-screen by
// shareViewAsImage, like ShareDayFoodCard: the chart exactly as drawn on screen
// (same ProgressChartSvg + model), then each lift's latest and best week and
// its ⭐ best one-rep max. Colors follow the app's theme (light app → light image).
interface Props {
  model: ProgressChartModel;
  mode: ProgressMode;
  weeks: LiftProgressWeek[];
  maxes: LiftMaxRecord[]; // every recorded 1RM (the best per lift is listed)
  format: TrainingLogFormat;
}

// Fixed width, like ShareDayFoodCard: every image is the same poster on any phone.
const CARD_WIDTH = 390;
const PADDING = 24;
export const SHARE_CHART_LAYOUT: ChartLayout = {
  width: CARD_WIDTH - PADDING * 2,
  height: 220,
  padLeft: 34,
  padRight: 22,
  padTop: 14,
  padBottom: 22,
};

export const ShareProgressCard = forwardRef<View, Props>(function ShareProgressCard(
  { model, mode, weeks, maxes, format },
  ref
) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const best = bestLiftMaxes(maxes);
  const kg = (v: number) => t('trainingLog.progress.valueKg', { kg: formatChartValue(v, 1, format, language) });

  return (
    // collapsable={false}: Android may otherwise flatten this node away, and a
    // dropped node is one captureRef can't find (same as ShareDayFoodCard).
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        {/* The app's proper name, not translated content. */}
        <Text style={styles.brand}>⚡ Body Batteries</Text>
        <Text style={styles.date}>{formatDisplayDate(todayString(), language)}</Text>
      </View>

      <View>
        <Text style={styles.title}>{t('trainingLog.progress.title')}</Text>
        <Text style={styles.subtitle}>
          {mode === 'kg' ? t('trainingLog.progress.shareSubtitleKg') : t('trainingLog.progress.shareSubtitleRatio')}
        </Text>
      </View>

      <ProgressChartSvg
        model={model}
        layout={SHARE_CHART_LAYOUT}
        mode={mode}
        format={format}
        language={language}
        colors={c}
        width={SHARE_CHART_LAYOUT.width}
      />

      <View style={styles.legend}>
        {LIFTING_EXERCISES.map((lift) => {
          const tops = weeks.map((w) => w.top[lift]).filter((v): v is number => v != null);
          const max = best[lift];
          if (tops.length === 0 && !max) return null;
          return (
            <View key={lift} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: liftColor(c, lift) }]} />
              <Text style={styles.liftName}>
                {t(`trainingLog.abbr.${lift}`)} · {activityLabel(lift, language)}
              </Text>
              {tops.length > 0 && (
                <Text style={styles.value}>
                  {kg(tops[tops.length - 1])}
                  <Text style={styles.muted}> · {t('trainingLog.progress.best', { value: kg(Math.max(...tops)) })}</Text>
                </Text>
              )}
              {max && (
                <Text style={styles.maxLine}>
                  <Text style={{ color: liftColor(c, lift) }}>★ </Text>
                  {t('trainingLog.progress.maxBest', { value: kg(max.weightKg), date: formatDayDate(max.date, language) })}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {maxes.length > 0 && <Text style={styles.muted}>{t('trainingLog.progress.maxLegend')}</Text>}
      <Text style={styles.tagline}>{t('trainingLog.progress.shareTagline')}</Text>
    </View>
  );
});

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { width: CARD_WIDTH, backgroundColor: c.bg, padding: PADDING, gap: 14 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    brand: { color: c.accent, fontSize: 16, fontWeight: '800' },
    date: { color: c.textTertiary, fontSize: 13 },
    title: { color: c.textPrimary, fontSize: 22, fontWeight: '800' },
    subtitle: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
    legend: { backgroundColor: c.bgCard, borderRadius: 14, padding: 14, gap: 10 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    liftName: { color: c.textPrimary, fontSize: 14, fontWeight: '700', minWidth: 120 },
    value: { color: c.textBright, fontSize: 14, fontWeight: '600' },
    maxLine: { color: c.textSecondary, fontSize: 13, width: '100%', paddingLeft: 16 },
    muted: { color: c.textTertiary, fontSize: 12, fontWeight: '400' },
    tagline: { color: c.textSubtle, fontSize: 11, textAlign: 'center', marginTop: 4 },
  });

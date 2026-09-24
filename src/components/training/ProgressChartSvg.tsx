import React from 'react';
import Svg, { Line, Polyline, Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { formatDayDate } from '../../domain/training/trainingLogFormatter';
import { formatChartValue, starPoints } from '../../domain/training/progressChartModel';
import type { ChartLayout, ProgressChartModel, ProgressMode } from '../../domain/training/progressChartModel';
import type { LiftingExercise } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import type { Language } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useT } from '../../i18n/useT';

export function liftColor(c: ThemeColors, lift: LiftingExercise): string {
  return lift === 'squat' ? c.liftSquat : lift === 'bench_press' ? c.liftBench : c.liftDeadlift;
}

interface Props {
  model: ProgressChartModel;
  layout: ChartLayout;
  mode: ProgressMode;
  format: TrainingLogFormat;
  language: Language;
  colors: ThemeColors;
  // Only the on-screen chart highlights a picked week; the share card doesn't.
  highlightWeek?: string | null;
  width?: number | string; // rendered width (the viewBox keeps the geometry)
}

// The strength chart itself — gridlines, weekly S/B/D lines, ⭐ one-rep maxes,
// end labels. Paints a ProgressChartModel; used on screen and in the image.
export function ProgressChartSvg({ model, layout, mode, format, language, colors: c, highlightWeek, width = '100%' }: Props) {
  const { t } = useT();
  const { width: W, height: H, padLeft, padRight, padTop, padBottom } = layout;
  const digits = mode === 'kg' ? 1 : 2;

  return (
    <Svg width={width} height={H} viewBox={`0 0 ${W} ${H}`}>
      {model.ticks.map((v) => (
        <React.Fragment key={v}>
          <Line x1={padLeft} y1={model.y(v)} x2={W - padRight} y2={model.y(v)} stroke={c.bgElevated} strokeWidth={1} />
          <SvgText x={padLeft - 5} y={model.y(v) + 3} fontSize={9} fill={c.textMuted} textAnchor="end">
            {formatChartValue(v, digits, format, language)}
          </SvgText>
        </React.Fragment>
      ))}
      {[model.firstDate, model.lastDate].map((d, i) => (
        <SvgText
          key={`x${i}`}
          x={model.xOfDate(d)}
          y={H - 6}
          fontSize={9}
          fill={c.textMuted}
          textAnchor={i === 0 ? 'start' : 'end'}
        >
          {formatDayDate(d, language)}
        </SvgText>
      ))}
      {highlightWeek && (
        <Line
          x1={model.xOfDate(highlightWeek)}
          y1={padTop}
          x2={model.xOfDate(highlightWeek)}
          y2={H - padBottom}
          stroke={c.textFaint}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
      {model.series.map(({ lift, points }) => {
        if (points.length === 0) return null;
        const color = liftColor(c, lift);
        return (
          <React.Fragment key={lift}>
            {points.length > 1 && (
              <Polyline
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {points.map((p) => (
              <Circle
                key={p.week.weekStart}
                cx={p.x}
                cy={p.y}
                r={p.week.weekStart === highlightWeek ? 5 : 3.5}
                fill={color}
                stroke={c.bgCard}
                strokeWidth={1.5}
              />
            ))}
          </React.Fragment>
        );
      })}
      {/* ⭐ one-rep maxes: drawn last so they sit on top, never joined to a line. */}
      {model.stars.map((s) => (
        <Polygon
          key={s.max.id}
          points={starPoints(s.x, s.y, 9)}
          fill={liftColor(c, s.max.lift)}
          stroke={c.bgCard}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}
      {model.endLabels.map((l) => (
        <SvgText key={l.lift} x={l.x + 7} y={l.y + 3} fontSize={10} fontWeight="700" fill={c.textSecondary}>
          {t(`trainingLog.abbr.${l.lift}`)}
        </SvgText>
      ))}
    </Svg>
  );
}

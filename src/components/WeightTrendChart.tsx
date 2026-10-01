import React, { forwardRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line, Polyline, Circle, Rect, Text as SvgText } from 'react-native-svg';
import {
  buildWeightChartModel,
  filterWeightEntriesByRange,
  pickWeightChartTarget,
  WEIGHT_CHART_RANGES,
  WEIGHT_REF_OFFSETS_KG,
  type WeightChartEntry,
  type WeightChartLayout,
  type WeightChartModel,
  type WeightChartRange,
  type WeightChartTarget,
  type WeightRefKind,
} from '../domain/health/weightChartModel';
import { healthyWeightRangeKgRaw } from '../domain/nutrition/dailyRecommendations';
import { dateString, formatDisplayDate, formatShortDate, todayString } from '../lib/dateUtils';
import { profileGoalDirection } from '../domain/health/weightHistoryGroups';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useSettingsStore } from '../store/settingsStore';
import { useT } from '../i18n/useT';
import { useHoldToShare } from '../hooks/useHoldToShare';
import type { Language } from '../i18n/types';

// viewBox geometry — the SVG scales to the card width, like TrendChart.
const LAYOUT: WeightChartLayout = {
  width: 320,
  height: 180,
  padLeft: 30,
  padRight: 34,
  padTop: 10,
  padBottom: 20,
};
// Beyond this many readings the per-point dots turn into clutter — the line
// alone carries the trend.
const MAX_DOTS = 40;

const RANGE_LABEL_KEYS = {
  '1m': 'components.weightLogCard.range1m',
  '3m': 'components.weightLogCard.range3m',
  '1y': 'components.weightLogCard.range1y',
  all: 'components.weightLogCard.rangeAll',
} as const satisfies Record<WeightChartRange, string>;

function refColor(c: ThemeColors, kind: WeightRefKind): string {
  switch (kind) {
    case 'healthy':
      return c.weightRefHealthy;
    case 'plus10':
      return c.weightRefPlus10;
    case 'plus20':
      return c.weightRefPlus20;
    case 'plus35':
      return c.weightRefPlus35;
  }
}

// Green = dotted (the healthy bound), the "+N kg" lines = dashed.
const refDash = (kind: WeightRefKind) => (kind === 'healthy' ? '1,4' : '6,4');

type TFn = ReturnType<typeof useT>['t'];

// The caption shown under the chart for the tapped element.
function captionFor(
  target: WeightChartTarget,
  model: WeightChartModel,
  heightCm: number,
  t: TFn,
  language: Language
): { color: string | null; lines: string[] } | null {
  const healthyMax = healthyWeightRangeKgRaw(heightCm).max;
  const disclaimer = t('components.weightLogCard.chartDisclaimer');
  switch (target.kind) {
    case 'point': {
      const p = model.points[target.index];
      if (!p) return null;
      return {
        color: null,
        lines: [
          t('components.weightLogCard.pointInfo', {
            date: formatDisplayDate(dateString(new Date(p.timestamp)), language),
            kg: p.value.toFixed(1),
          }),
        ],
      };
    }
    case 'ref': {
      const kg = (healthyMax + WEIGHT_REF_OFFSETS_KG[target.ref]).toFixed(1);
      return target.ref === 'healthy'
        ? {
            color: 'healthy',
            lines: [
              t('components.weightLogCard.legendHealthy', { kg }),
              t('components.weightLogCard.healthyInfoDetail', { height: heightCm }),
              disclaimer,
            ],
          }
        : {
            color: target.ref,
            lines: [
              t('components.weightLogCard.legendOver', { over: WEIGHT_REF_OFFSETS_KG[target.ref], kg }),
              disclaimer,
            ],
          };
    }
    case 'band':
      return {
        color: 'healthy',
        lines: [t('components.weightLogCard.healthyBandNote', { height: heightCm }), disclaimer],
      };
  }
}

// The chart drawing itself — shared by the on-screen chart and the share
// poster (ShareWeightCard), so the saved image is exactly what the user sees.
function WeightChartSvg({
  model,
  selectedRef = null,
  selectedPoint = null,
  width = '100%',
}: {
  model: WeightChartModel;
  selectedRef?: WeightRefKind | null;
  selectedPoint?: WeightChartModel['points'][number] | null;
  width?: number | `${number}%`;
}) {
  const { language } = useT();
  const c = useThemeColors();
  const { width: W, height: H, padLeft, padRight } = LAYOUT;
  const plotRight = W - padRight;
  return (
    <Svg width={width} height={H} viewBox={`0 0 ${W} ${H}`}>
      {model.healthyBand && (
        <Rect
          x={padLeft}
          y={model.healthyBand.yTop}
          width={plotRight - padLeft}
          height={model.healthyBand.yBottom - model.healthyBand.yTop}
          fill={c.weightHealthyBand}
        />
      )}
      {model.ticks.map(({ kg, y }) => (
        <React.Fragment key={kg}>
          <Line x1={padLeft} y1={y} x2={plotRight} y2={y} stroke={c.bgElevated} strokeWidth={1} />
          <SvgText x={padLeft - 5} y={y + 3} fontSize={9} fill={c.textMuted} textAnchor="end">
            {kg}
          </SvgText>
        </React.Fragment>
      ))}
      {model.refLines.map(({ kind, kg, y }) => {
        const active = kind === selectedRef;
        return (
          <React.Fragment key={kind}>
            <Line
              x1={padLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke={refColor(c, kind)}
              strokeWidth={(kind === 'healthy' ? 2 : 1.5) + (active ? 1.5 : 0)}
              strokeDasharray={refDash(kind)}
              strokeLinecap={kind === 'healthy' ? 'round' : 'butt'}
            />
            <SvgText x={plotRight + 4} y={y + 3} fontSize={9} fontWeight="600" fill={refColor(c, kind)}>
              {kg.toFixed(1)}
            </SvgText>
          </React.Fragment>
        );
      })}
      {[model.firstTimestamp, model.lastTimestamp].map((ts, i) =>
        i === 1 && ts === model.firstTimestamp ? null : (
          <SvgText
            key={`x${i}`}
            x={i === 0 ? padLeft : plotRight}
            y={H - 5}
            fontSize={9}
            fill={c.textMuted}
            textAnchor={i === 0 ? 'start' : 'end'}
          >
            {formatShortDate(ts, language)}
          </SvgText>
        )
      )}
      {selectedPoint && (
        <Line
          x1={selectedPoint.x}
          y1={LAYOUT.padTop}
          x2={selectedPoint.x}
          y2={H - LAYOUT.padBottom}
          stroke={c.textFaint}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
      {model.points.length > 1 && (
        <Polyline
          points={model.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={c.weightLine}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {model.points.map((p, i) => {
        const isLast = i === model.points.length - 1;
        const isSelected = p === selectedPoint;
        if (!isLast && !isSelected && model.points.length > MAX_DOTS) return null;
        return (
          <Circle
            key={p.timestamp}
            cx={p.x}
            cy={p.y}
            r={isSelected ? 4.5 : isLast ? 3.5 : 2.5}
            fill={isLast || isSelected ? c.weightLine : c.bgCard}
            stroke={c.weightLine}
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}

interface Props {
  entries: WeightChartEntry[];
  // Changes whenever the parent screen is scrolled: a caption opened under
  // an older key is hidden, so scrolling away collapses it with no effect.
  dismissKey?: number;
}

// Weight-over-time line drawn over height-based reference lines (see
// domain/health/weightChartModel.ts). Kept label-free: tapping a line, a
// reading or the green area shows a one-off caption right below it, which
// collapses on scroll, on leaving the screen, on a range change or a tap
// on empty space. ⤴ (or holding the chart) saves/shares it as an image —
// the ShareWeightCard poster below, never a crop of the screen.
export function WeightTrendChart({ entries, dismissKey = 0 }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const heightCm = useSettingsStore((s) => s.userProfile.heightCm);
  const goalWeightKg = useSettingsStore((s) => s.userProfile.goalWeightKg);
  const [range, setRange] = useState<WeightChartRange>('all');
  const [selection, setSelection] = useState<{ target: WeightChartTarget; key: number } | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const {
    ref: shareRef,
    onLongPress: share,
    sharing,
  } = useHoldToShare(t('components.weightLogCard.shareDialogTitle'));

  // Leaving the tab (blur) closes the caption.
  useFocusEffect(
    useCallback(() => {
      return () => setSelection(null);
    }, [])
  );

  const model = buildWeightChartModel(filterWeightEntriesByRange(entries, range), heightCm, LAYOUT);
  if (!model) return null;

  const { width: W, height: H } = LAYOUT;
  const selected = selection && selection.key === dismissKey ? selection.target : null;
  const caption = selected ? captionFor(selected, model, heightCm, t, language) : null;
  const selectedRef = selected?.kind === 'ref' ? selected.ref : null;
  const selectedPoint = selected?.kind === 'point' ? model.points[selected.index] : null;

  function handleLayout(e: LayoutChangeEvent) {
    setBoxWidth(e.nativeEvent.layout.width);
  }

  // Touch position → viewBox units. The SVG keeps its aspect ratio
  // (xMidYMid meet), so it is scaled by s and centred inside the box.
  function handlePress(e: GestureResponderEvent) {
    if (!model || boxWidth <= 0) return;
    const s = Math.min(boxWidth / W, 1);
    const vx = (e.nativeEvent.locationX - (boxWidth - W * s) / 2) / s;
    const vy = (e.nativeEvent.locationY - (H - H * s) / 2) / s;
    const target = pickWeightChartTarget(model, vx, vy);
    const same = selected && target && JSON.stringify(selected) === JSON.stringify(target);
    setSelection(target && !same ? { target, key: dismissKey } : null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.capture}>
        <View style={styles.rangeRow}>
          {WEIGHT_CHART_RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                setRange(r);
                setSelection(null);
              }}
              style={({ pressed }) => [
                styles.rangeChip,
                r === range && styles.rangeChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.rangeText, r === range && styles.rangeTextActive]}>
                {t(RANGE_LABEL_KEYS[r])}
              </Text>
            </Pressable>
          ))}
          <View style={styles.flex} />
          <Pressable
            onPress={share}
            disabled={sharing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('components.weightLogCard.shareButtonA11y')}
            style={({ pressed }) => [styles.shareBtn, (pressed || sharing) && styles.pressed]}
          >
            {sharing ? <ActivityIndicator size="small" color={c.accent} /> : <Text style={styles.shareIcon}>⤴</Text>}
          </Pressable>
        </View>

        <Pressable
          onLayout={handleLayout}
          onPress={handlePress}
          onLongPress={share}
          accessibilityRole="image"
          accessibilityLabel={t('components.weightLogCard.chartA11y')}
          accessibilityHint={t('components.weightLogCard.chartHint')}
        >
          <WeightChartSvg model={model} selectedRef={selectedRef} selectedPoint={selectedPoint} />
        </Pressable>

        {caption ? (
          <View
            style={[
              styles.caption,
              caption.color && {
                borderLeftColor: refColor(c, caption.color as WeightRefKind),
              },
            ]}
          >
            {caption.lines.map((line, i) => (
              <Text key={i} style={i === 0 ? styles.captionMain : styles.captionNote}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {caption ? null : <Text style={styles.hint}>{t('components.weightLogCard.chartHint')}</Text>}

      {/* Never on screen: laid out far off-canvas so the share has a real view
          to capture (same trick as the strength chart / day-food poster). */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareWeightCard
          ref={shareRef}
          model={model}
          rangeLabel={t(RANGE_LABEL_KEYS[range])}
          heightCm={heightCm}
          goalWeightKg={goalWeightKg}
        />
      </View>
    </View>
  );
}

// Fixed width so every saved image is the same poster on any phone.
const POSTER_WIDTH = 390;
const POSTER_PADDING = 16;

// The "share my weight" poster: brand + date, the current weight in big type,
// the change over the shown range (green toward the user's goal, red away —
// the same colours as the weight list), then the chart exactly as on screen.
const ShareWeightCard = forwardRef<
  View,
  { model: WeightChartModel; rangeLabel: string; heightCm: number; goalWeightKg?: number }
>(function ShareWeightCard({ model, rangeLabel, heightCm, goalWeightKg }, ref) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const first = model.points[0];
  const last = model.points[model.points.length - 1];
  const change = Math.round((last.value - first.value) * 10) / 10;
  const goal = profileGoalDirection(last.value, heightCm, goalWeightKg);
  const toward = change === 0 || goal === 'maintain' ? null : (change < 0) === (goal === 'lose');
  const changeColor = toward == null ? c.textSecondary : toward ? c.weightTrendToward : c.weightTrendAway;
  return (
    // collapsable={false}: Android may otherwise flatten this node away.
    <View ref={ref} collapsable={false} style={styles.poster}>
      <View style={styles.posterHeader}>
        {/* The app's proper name, not translated content. */}
        <Text style={styles.posterBrand}>⚡ Body Batteries</Text>
        <Text style={styles.posterDate}>{formatDisplayDate(todayString(), language)}</Text>
      </View>
      <Text style={styles.posterTitle}>
        {t('components.weightLogCard.title')} · {rangeLabel}
      </Text>
      <View style={styles.posterStats}>
        <Text style={styles.posterBig}>{t('components.weightLogCard.posterKg', { kg: last.value.toFixed(1) })}</Text>
        {model.points.length > 1 && (
          <Text style={[styles.posterChange, { color: changeColor }]}>
            {t('components.weightLogCard.posterChange', {
              sign: change > 0 ? '+' : change < 0 ? '−' : '±',
              kg: Math.abs(change).toFixed(1),
              date: formatShortDate(first.timestamp, language),
            })}
          </Text>
        )}
      </View>
      <WeightChartSvg model={model} width={POSTER_WIDTH - POSTER_PADDING * 2} />
      <Text style={styles.posterNote}>{t('components.weightLogCard.healthyBandNote', { height: heightCm })}</Text>
    </View>
  );
});

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { gap: 8 },
  capture: { gap: 8 },
  flex: { flex: 1 },
  shareBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  shareIcon: { color: c.infoAlt, fontSize: 14, fontWeight: '700' },
  offscreen: { position: 'absolute', top: -100000, left: 0 },
  poster: { width: POSTER_WIDTH, padding: POSTER_PADDING, gap: 10, backgroundColor: c.bg },
  posterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  posterBrand: { color: c.accent, fontSize: 16, fontWeight: '800' },
  posterDate: { color: c.textTertiary, fontSize: 13 },
  posterTitle: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  posterStats: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  posterBig: { color: c.textPrimary, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  posterChange: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  posterNote: { color: c.textTertiary, fontSize: 11 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.bgElevated,
  },
  rangeChipActive: { backgroundColor: c.accentAltBg, borderColor: c.accentAlt },
  rangeText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  rangeTextActive: { color: c.textPrimary },
  pressed: { opacity: 0.6 },
  hint: { color: c.textFaint, fontSize: 11, textAlign: 'center' },
  caption: {
    borderLeftWidth: 3,
    borderLeftColor: c.weightLine,
    backgroundColor: c.bgElevated,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  captionMain: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
  captionNote: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
});

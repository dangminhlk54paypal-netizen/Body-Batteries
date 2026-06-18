import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { formatDisplayDate } from '../lib/dateUtils';

export interface TrendPoint {
  date: string;
  averagePercentage: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  /** Optional second series (e.g. energy battery %) drawn as a second line. */
  energyData?: TrendPoint[];
}

const CHART_HEIGHT = 140;
const CHART_PADDING_X = 24;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 28;
const GRID_LINES = [0, 25, 50, 75, 100];
const NUTRIENT_COLOR = '#00B894';
const ENERGY_COLOR = '#FFD93D';

export function TrendChart({ data, energyData }: TrendChartProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>Chưa đủ dữ liệu để vẽ biểu đồ</Text>
      </View>
    );
  }

  // Only draw the energy line if it has at least as many usable points as
  // the nutrient series (defensive — older data may lack energy readings).
  const hasEnergyLine = !!energyData && energyData.length >= 2;

  return (
    <View style={styles.container}>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 320 ${CHART_HEIGHT}`}>
        {GRID_LINES.map((value) => {
          const y = yForValue(value);
          return (
            <Line
              key={value}
              x1={CHART_PADDING_X}
              y1={y}
              x2={320 - CHART_PADDING_X}
              y2={y}
              stroke="#2d2d44"
              strokeWidth={1}
            />
          );
        })}

        <Polyline
          points={data
            .map((point, index) => `${xForIndex(index, data.length)},${yForValue(point.averagePercentage)}`)
            .join(' ')}
          fill="none"
          stroke={NUTRIENT_COLOR}
          strokeWidth={2}
        />

        {data.map((point, index) => {
          const x = xForIndex(index, data.length);
          const y = yForValue(point.averagePercentage);
          return (
            <React.Fragment key={point.date}>
              <Circle cx={x} cy={y} r={4} fill={NUTRIENT_COLOR} />
              <SvgText x={x} y={CHART_HEIGHT - 6} fontSize={9} fill="#666" textAnchor="middle">
                {formatDisplayDate(point.date).slice(0, 6)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {hasEnergyLine && (
          <Polyline
            points={energyData!
              .map(
                (point, index) =>
                  `${xForIndex(index, energyData!.length)},${yForValue(point.averagePercentage)}`
              )
              .join(' ')}
            fill="none"
            stroke={ENERGY_COLOR}
            strokeWidth={2}
          />
        )}

        {hasEnergyLine &&
          energyData!.map((point, index) => {
            const x = xForIndex(index, energyData!.length);
            const y = yForValue(point.averagePercentage);
            return <Circle key={point.date} cx={x} cy={y} r={4} fill={ENERGY_COLOR} />;
          })}
      </Svg>

      {hasEnergyLine && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: NUTRIENT_COLOR }]} />
            <Text style={styles.legendLabel}>Dinh dưỡng</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ENERGY_COLOR }]} />
            <Text style={styles.legendLabel}>Năng lượng</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function xForIndex(index: number, total: number): number {
  const usableWidth = 320 - CHART_PADDING_X * 2;
  if (total === 1) return CHART_PADDING_X + usableWidth / 2;
  return CHART_PADDING_X + (usableWidth * index) / (total - 1);
}

function yForValue(value: number): number {
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const clamped = Math.max(0, Math.min(100, value));
  return CHART_PADDING_TOP + usableHeight * (1 - clamped / 100);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    paddingVertical: 8,
  },
  emptyContainer: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#555', fontSize: 13 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#999', fontSize: 11 },
});
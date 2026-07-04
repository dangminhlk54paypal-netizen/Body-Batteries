import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { MicroBatteryState } from '../types/nutrition';
import { PROMINENT_GOAL_IDS, MORE_GOAL_IDS, LIMIT_IDS } from '../lib/nutrientTargets';
import type { DateOption } from '../hooks/useMicroBatteryHistory';

interface Props {
  states: MicroBatteryState[];
  dates: DateOption[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const CELL_WIDTH = 56;
const CELL_HEIGHT = 84;
const BORDER_R = 6;

function byIds(states: MicroBatteryState[], ids: string[]): MicroBatteryState[] {
  return ids
    .map((id) => states.find((s) => s.id === id))
    .filter((s): s is MicroBatteryState => !!s);
}

// A static (non-animated) pin cell dedicated to micronutrients — deliberately
// NOT the shared BatteryCell, which auto-tints red/yellow at low percentage.
// Goal-type "under target" and limit-type "over cap" must both stay neutral
// (see CONTEXT.md §5 + S-R spec §6), so this cell always renders the
// nutrient's own fixed color regardless of level.
function MicroCell({ state }: { state: MicroBatteryState }) {
  const fillHeight = CELL_HEIGHT * (state.percentage / 100);
  return (
    <View style={styles.cell}>
      <Svg width={CELL_WIDTH} height={CELL_HEIGHT}>
        <Rect
          x={0}
          y={0}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          rx={BORDER_R}
          fill="#1a1a2e"
          stroke="#333"
          strokeWidth={2}
        />
        {fillHeight > 0 && (
          <Rect
            x={2}
            y={CELL_HEIGHT - fillHeight}
            width={CELL_WIDTH - 4}
            height={Math.max(0, fillHeight - 2)}
            rx={BORDER_R - 2}
            fill={state.color}
          />
        )}
      </Svg>
      <Text style={styles.cellPct}>{state.percentage}%</Text>
      <Text style={styles.cellName}>{state.nameVi}</Text>
      <Text style={styles.cellAmount}>
        {state.current}
        {state.unit}
      </Text>
      {state.kind === 'limit' && (
        <Text style={styles.cellCaption}>{state.over ? 'vượt ngưỡng gợi ý' : 'trong ngưỡng'}</Text>
      )}
    </View>
  );
}

export function MicroBatteryStack({ states, dates, selectedDate, onSelectDate }: Props) {
  const [expanded, setExpanded] = useState(false);

  const prominent = byIds(states, PROMINENT_GOAL_IDS);
  const more = byIds(states, MORE_GOAL_IDS);
  const limits = byIds(states, LIMIT_IDS);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vi chất đã nạp</Text>
        <Text style={styles.disclaimer}>Chỉ để tham khảo.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {dates.map((d) => {
          const active = d.value === selectedDate;
          return (
            <Pressable
              key={d.value}
              onPress={() => onSelectDate(d.value)}
              style={[styles.dateChip, active && styles.dateChipActive]}
            >
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {prominent.map((s) => (
          <MicroCell key={s.id} state={s} />
        ))}
      </ScrollView>

      {more.length > 0 && (
        <Pressable onPress={() => setExpanded((e) => !e)} style={styles.moreToggle}>
          <Text style={styles.moreToggleText}>
            {expanded ? '▾ Ẩn bớt' : `▸ Xem thêm: ${more.map((s) => s.nameVi).join(' · ')}`}
          </Text>
        </Pressable>
      )}
      {expanded && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {more.map((s) => (
            <MicroCell key={s.id} state={s} />
          ))}
        </ScrollView>
      )}

      {limits.length > 0 && (
        <View style={styles.limitSection}>
          <Text style={styles.limitLabel}>Nên giữ dưới mốc</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {limits.map((s) => (
              <MicroCell key={s.id} state={s} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 13,
    color: '#888',
  },
  disclaimer: {
    fontSize: 11,
    color: '#555',
  },
  dateRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
  },
  dateChipActive: {
    backgroundColor: '#2d2d5e',
    borderColor: '#6C5CE7',
  },
  dateChipText: {
    fontSize: 11,
    color: '#888',
  },
  dateChipTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'flex-end',
  },
  cell: {
    alignItems: 'center',
    gap: 4,
    width: CELL_WIDTH + 8,
  },
  cellPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  cellName: {
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center',
  },
  cellAmount: {
    fontSize: 9,
    color: '#666',
  },
  cellCaption: {
    fontSize: 8,
    color: '#777',
    textAlign: 'center',
  },
  moreToggle: {
    paddingHorizontal: 20,
  },
  moreToggleText: {
    fontSize: 11,
    color: '#6C5CE7',
  },
  limitSection: {
    gap: 4,
  },
  limitLabel: {
    fontSize: 11,
    color: '#888',
    paddingHorizontal: 20,
  },
});

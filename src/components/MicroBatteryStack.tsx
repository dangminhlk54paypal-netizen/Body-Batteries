import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { MicroBatteryState } from '../types/nutrition';
import { PROMINENT_GOAL_IDS, MORE_GOAL_IDS, LIMIT_IDS, ELECTROLYTE_IDS } from '../lib/nutrientTargets';
import { UPPER_LIMITS } from '../lib/upperLimits';
import type { DateOption } from '../hooks/useMicroBatteryHistory';
import { OverdoseNotice } from './OverdoseNotice';
import { useSettingsStore } from '../store/settingsStore';
import { colors } from '../lib/theme';

interface Props {
  states: MicroBatteryState[];
  dates: DateOption[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  // e.g. "Khuyến nghị chung cho nam ~30 tuổi" — derived from the user profile.
  recommendNote?: string;
}

const CELL_WIDTH = 56;
const CELL_HEIGHT = 84;
const BORDER_R = 6;

function byIds(states: MicroBatteryState[], ids: string[]): MicroBatteryState[] {
  return ids
    .map((id) => states.find((s) => s.id === id))
    .filter((s): s is MicroBatteryState => !!s);
}

// Gentle "past a reference ceiling" flag — deliberately narrower than the
// existing caption logic (kind==='goal' && over just means "past the daily
// recommendation", which is fine/neutral and must NOT warn, see CONTEXT.md
// §5). A goal-type nutrient only warns once it clears the separate Upper
// Limit table; a limit-type nutrient (sodium/sugar/salt) warns as soon as
// it's over its own cap, same as `state.over`.
function isOverReference(state: MicroBatteryState): boolean {
  if (state.kind === 'limit') return state.over;
  return state.current > (UPPER_LIMITS[state.id]?.value ?? Infinity);
}

// A static (non-animated) pin cell dedicated to micronutrients — deliberately
// NOT the shared BatteryCell, which auto-tints red/yellow at low percentage.
// Goal-type "under target" and limit-type "over cap" must both stay neutral
// (see CONTEXT.md §5 + S-R spec §6), so this cell always renders the
// nutrient's own fixed color regardless of level.
function MicroCell({ state }: { state: MicroBatteryState }) {
  // The tank drawing tops out at 100%; anything past that is conveyed by the
  // real percentage figure (e.g. 134%) plus the caption below.
  const fillHeight = CELL_HEIGHT * (Math.min(state.percentage, 100) / 100);
  const caption =
    state.kind === 'limit'
      ? state.over
        ? 'vượt ngưỡng gợi ý'
        : 'trong ngưỡng'
      : state.over
        ? 'vượt khuyến nghị'
        : null;
  // A small ⚠️ glyph next to the percentage — colors stay neutral (no red),
  // the glyph itself is the only extra emphasis. See isOverReference for the
  // exact rule (goal-type "over target" alone never warns).
  const warn = isOverReference(state);
  return (
    <View style={styles.cell}>
      <Svg width={CELL_WIDTH} height={CELL_HEIGHT}>
        <Rect
          x={0}
          y={0}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          rx={BORDER_R}
          fill={colors.bgCard}
          stroke={state.over ? state.color : colors.borderSubtle}
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
      <Text style={styles.cellPct}>
        {state.percentage}%{warn ? ' ⚠️' : ''}
      </Text>
      <Text style={styles.cellName}>{state.nameVi}</Text>
      <Text style={styles.cellAmount}>
        {state.current}
        {state.unit}
      </Text>
      <Text style={styles.cellTarget}>
        KN {state.target}
        {state.unit}/ngày
      </Text>
      {caption && <Text style={styles.cellCaption}>{caption}</Text>}
    </View>
  );
}

export function MicroBatteryStack({
  states,
  dates,
  selectedDate,
  onSelectDate,
  recommendNote,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  // Persisted collapse state for this whole section — same read-the-store-
  // directly pattern MasterBattery uses for particleEffectsEnabled.
  const microCollapsed = useSettingsStore((s) => s.microCollapsed);
  const setMicroCollapsed = useSettingsStore((s) => s.setMicroCollapsed);

  const prominent = byIds(states, PROMINENT_GOAL_IDS);
  const more = byIds(states, MORE_GOAL_IDS);
  const limits = byIds(states, LIMIT_IDS);
  const electrolytes = byIds(states, ELECTROLYTE_IDS);
  const warnCount = states.filter(isOverReference).length;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setMicroCollapsed(!microCollapsed)}
        style={styles.headerRow}
        hitSlop={6}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.chevron}>{microCollapsed ? '▸' : '▾'}</Text>
          <Text style={styles.title}>Vi chất đã nạp</Text>
        </View>
        <Text style={styles.disclaimer}>Chỉ để tham khảo.</Text>
      </Pressable>

      {microCollapsed ? (
        <Pressable onPress={() => setMicroCollapsed(false)}>
          <Text style={styles.collapsedLine}>
            {`▸ Đang thu gọn — bấm để xem ${states.length} vi chất${
              warnCount > 0 ? ` · ⚠️ ${warnCount} vượt ngưỡng` : ''
            }`}
          </Text>
        </Pressable>
      ) : (
        <>
          {recommendNote && <Text style={styles.recommendNote}>{recommendNote}</Text>}

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

          {electrolytes.length > 0 && (
            <View style={styles.limitSection}>
              <Text style={styles.limitLabel}>Muối & điện giải</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {electrolytes.map((s) => (
                  <MicroCell key={s.id} state={s} />
                ))}
              </ScrollView>
            </View>
          )}

          <OverdoseNotice states={states} />
        </>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  chevron: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  title: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.textFaint,
  },
  collapsedLine: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: 20,
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
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dateChipActive: {
    backgroundColor: colors.accentAltBg,
    borderColor: colors.accentAlt,
  },
  dateChipText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  dateChipTextActive: {
    color: colors.textPrimary,
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
    color: colors.textPrimary,
  },
  cellName: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cellAmount: {
    fontSize: 9,
    color: colors.textMuted,
  },
  cellTarget: {
    fontSize: 8,
    color: colors.textCool,
    textAlign: 'center',
  },
  recommendNote: {
    fontSize: 10,
    color: colors.textMuted,
    paddingHorizontal: 20,
  },
  cellCaption: {
    fontSize: 8,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  moreToggle: {
    paddingHorizontal: 20,
  },
  moreToggleText: {
    fontSize: 11,
    color: colors.accentAlt,
  },
  limitSection: {
    gap: 4,
  },
  limitLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    paddingHorizontal: 20,
  },
});

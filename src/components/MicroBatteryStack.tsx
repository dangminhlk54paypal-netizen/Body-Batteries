import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { MicroBatteryState } from '../types/nutrition';
import type { FoodLogEntry } from '../types/food';
import { PROMINENT_GOAL_IDS, MORE_GOAL_IDS, LIMIT_IDS, ELECTROLYTE_IDS } from '../lib/nutrientTargets';
import { UPPER_LIMITS } from '../lib/upperLimits';
import type { DateOption } from '../hooks/useMicroBatteryHistory';
import { OverdoseNotice } from './OverdoseNotice';
import { MicroBatterySourceSheet } from './MicroBatterySourceSheet';
import { useSettingsStore } from '../store/settingsStore';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

interface Props {
  states: MicroBatteryState[];
  dates: DateOption[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  // The logged foods for `selectedDate` — feeds the tap-to-see-sources sheet.
  foodLog: FoodLogEntry[];
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
function MicroCell({ state, onPress }: { state: MicroBatteryState; onPress: () => void }) {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  // The tank drawing tops out at 100%; anything past that is conveyed by the
  // real percentage figure (e.g. 134%) plus the caption below.
  const fillHeight = CELL_HEIGHT * (Math.min(state.percentage, 100) / 100);
  const caption =
    state.kind === 'limit'
      ? state.over
        ? t('components.microBatteryStack.overThreshold')
        : t('components.microBatteryStack.withinThreshold')
      : state.over
        ? t('components.microBatteryStack.overRecommended')
        : null;
  // A small ⚠️ glyph next to the percentage — colors stay neutral (no red),
  // the glyph itself is the only extra emphasis. See isOverReference for the
  // exact rule (goal-type "over target" alone never warns).
  const warn = isOverReference(state);
  const name = t(`nutrients.${state.id}.name`);
  return (
    <Pressable
      style={styles.cell}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={t('components.microBatteryStack.cellA11y', {
        name,
        percentage: state.percentage,
      })}
    >
      <Svg width={CELL_WIDTH} height={CELL_HEIGHT}>
        <Rect
          x={0}
          y={0}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          rx={BORDER_R}
          fill={c.bgCard}
          stroke={state.over ? state.color : c.borderSubtle}
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
      <Text style={styles.cellName}>{name}</Text>
      {/* The ⓘ says the number is explainable, not just displayed — tapping
          the cell opens the source + formula breakdown. */}
      <Text style={styles.cellAmount}>
        {state.current}
        {state.unit} ⓘ
      </Text>
      <Text style={styles.cellTarget}>
        {t('components.microBatteryStack.recommendedPerDay', { target: state.target, unit: state.unit })}
      </Text>
      {caption && <Text style={styles.cellCaption}>{caption}</Text>}
    </Pressable>
  );
}

export function MicroBatteryStack({
  states,
  dates,
  selectedDate,
  onSelectDate,
  foodLog,
  recommendNote,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  // Which micronutrient's "where did this come from" sheet is open, if any —
  // mirrors HomeScreen's selectedBattery/sourceSheetVisible pair for
  // BatteryStack, but kept local since this stack owns its own date picker.
  const [selectedId, setSelectedId] = useState<MicroBatteryState['id'] | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  // Persisted collapse state for this whole section — same read-the-store-
  // directly pattern MasterBattery uses for particleEffectsEnabled.
  const microCollapsed = useSettingsStore((s) => s.microCollapsed);
  const setMicroCollapsed = useSettingsStore((s) => s.setMicroCollapsed);

  const prominent = byIds(states, PROMINENT_GOAL_IDS);
  const more = byIds(states, MORE_GOAL_IDS);
  const limits = byIds(states, LIMIT_IDS);
  const electrolytes = byIds(states, ELECTROLYTE_IDS);
  const warnCount = states.filter(isOverReference).length;
  const selectedState = states.find((s) => s.id === selectedId) ?? null;
  const dateLabel = dates.find((d) => d.value === selectedDate)?.label ?? selectedDate;

  function handleCellPress(id: MicroBatteryState['id']) {
    setSelectedId(id);
    setSheetVisible(true);
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setMicroCollapsed(!microCollapsed)}
        style={styles.headerRow}
        hitSlop={6}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.chevron}>{microCollapsed ? '▸' : '▾'}</Text>
          <Text style={styles.title}>{t('components.microBatteryStack.title')}</Text>
        </View>
        <Text style={styles.disclaimer}>{t('components.microBatteryStack.disclaimer')}</Text>
      </Pressable>

      {microCollapsed ? (
        <Pressable onPress={() => setMicroCollapsed(false)}>
          <Text style={styles.collapsedLine}>
            {t('components.microBatteryStack.collapsedLine', { count: states.length }) +
              (warnCount > 0
                ? t('components.microBatteryStack.collapsedWarnSuffix', { count: warnCount })
                : '')}
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
              <MicroCell key={s.id} state={s} onPress={() => handleCellPress(s.id)} />
            ))}
          </ScrollView>

          {more.length > 0 && (
            <Pressable onPress={() => setExpanded((e) => !e)} style={styles.moreToggle}>
              <Text style={styles.moreToggleText}>
                {expanded
                  ? t('components.microBatteryStack.hideMore')
                  : t('components.microBatteryStack.seeMoreList', {
                      list: more.map((s) => t(`nutrients.${s.id}.name`)).join(' · '),
                    })}
              </Text>
            </Pressable>
          )}
          {expanded && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {more.map((s) => (
                <MicroCell key={s.id} state={s} onPress={() => handleCellPress(s.id)} />
              ))}
            </ScrollView>
          )}

          {limits.length > 0 && (
            <View style={styles.limitSection}>
              <Text style={styles.limitLabel}>{t('components.microBatteryStack.limitSectionLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {limits.map((s) => (
                  <MicroCell key={s.id} state={s} onPress={() => handleCellPress(s.id)} />
                ))}
              </ScrollView>
            </View>
          )}

          {electrolytes.length > 0 && (
            <View style={styles.limitSection}>
              <Text style={styles.limitLabel}>{t('components.microBatteryStack.electrolyteSectionLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {electrolytes.map((s) => (
                  <MicroCell key={s.id} state={s} onPress={() => handleCellPress(s.id)} />
                ))}
              </ScrollView>
            </View>
          )}

          <OverdoseNotice states={states} />
        </>
      )}

      <MicroBatterySourceSheet
        nutrient={selectedState}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        foodLog={foodLog}
        dateLabel={dateLabel}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
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
    color: c.textTertiary,
  },
  title: {
    fontSize: 13,
    color: c.textTertiary,
  },
  disclaimer: {
    fontSize: 11,
    color: c.textFaint,
  },
  collapsedLine: {
    fontSize: 12,
    color: c.textMuted,
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
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  dateChipActive: {
    backgroundColor: c.accentAltBg,
    borderColor: c.accentAlt,
  },
  dateChipText: {
    fontSize: 11,
    color: c.textTertiary,
  },
  dateChipTextActive: {
    color: c.textPrimary,
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
    color: c.textPrimary,
  },
  cellName: {
    fontSize: 10,
    color: c.textSecondary,
    textAlign: 'center',
  },
  cellAmount: {
    fontSize: 9,
    color: c.textMuted,
  },
  cellTarget: {
    fontSize: 8,
    color: c.textCool,
    textAlign: 'center',
  },
  recommendNote: {
    fontSize: 10,
    color: c.textMuted,
    paddingHorizontal: 20,
  },
  cellCaption: {
    fontSize: 8,
    color: c.textSubtle,
    textAlign: 'center',
  },
  moreToggle: {
    paddingHorizontal: 20,
  },
  moreToggleText: {
    fontSize: 11,
    color: c.accentAlt,
  },
  limitSection: {
    gap: 4,
  },
  limitLabel: {
    fontSize: 11,
    color: c.textTertiary,
    paddingHorizontal: 20,
  },
});

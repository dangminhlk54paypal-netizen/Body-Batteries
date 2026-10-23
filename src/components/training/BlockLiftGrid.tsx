import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { VariationSetsEditor } from './VariationSetsEditor';
import { RpeChips } from './RpeChips';
import { LOCALE_TAGS } from '../../i18n/types';
import { buildLiftGrid, liftsInPlan } from '../../domain/energy/liftGrid';
import type { LiftGridCell, LiftGridItem } from '../../domain/energy/liftGrid';
import { referenceOf } from '../../domain/energy/blockPlanEdits';
import type { VariationAddress } from '../../domain/energy/blockPlanEdits';
import { formatSetSequence, movementLabel } from '../../domain/training/trainingLogFormatter';
import { formatDisplayDate, weekdayLabel } from '../../lib/dateUtils';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise, LiftingSet } from '../../types/energy';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';
import type { TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  plan: GeneratedBlockPlan;
  format: TrainingLogFormat; // the plan's format (prime shown, no ramp)
  currentWeekIndex: number;
  weekLabel: (weekIndex: number) => string; // "B3W2"
  heightCm: number;
  lifted: Set<string>; // days that hold a lifting Xả — trained squares go green
  onRate: (at: VariationAddress, rpe: number | null) => Promise<void>;
  onEdit: (at: VariationAddress, sets: LiftingSet[] | null) => Promise<void>;
}

// The grid scrolls inside a window this tall; narrow columns scroll sideways.
const GRID_MAX_HEIGHT = 360;
const LABEL_W = 52;
const MIN_CELL_W = 104;
const GAP = 6;

const keyOf = (at: VariationAddress) => `${at.weekIndex}.${at.dayIndex}.${at.variationIndex}`;

// "Theo bài": pick a lift, see it across the whole block — a row per week, a
// square per training day — and tap one square to change that session right
// under the grid, without opening week after week.
export function BlockLiftGrid({
  plan,
  format,
  currentWeekIndex,
  weekLabel,
  heightCm,
  lifted,
  onRate,
  onEdit,
}: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const lifts = liftsInPlan(plan, LIFTING_EXERCISES);
  const [lift, setLift] = useState<LiftingExercise | null>(null);
  const shown = lift && lifts.includes(lift) ? lift : (lifts[0] ?? null);
  const [selected, setSelected] = useState<VariationAddress | null>(null);
  // Bumped after "restore", so the editor re-reads the restored sets.
  const [editorRev, setEditorRev] = useState(0);
  const [width, setWidth] = useState(0);

  if (!shown) return <Text style={styles.hint}>{t('planAppendix.liftGrid.empty')}</Text>;

  const grid = buildLiftGrid(plan, shown, lifted);
  const cols = grid.weekdays.length;
  const cellW = Math.max(MIN_CELL_W, cols > 0 ? (width - LABEL_W - GAP * cols) / cols : MIN_CELL_W);
  const selectedVariation = selected
    ? plan.weeks[selected.weekIndex]?.days[selected.dayIndex]?.variations[selected.variationIndex]
    : undefined;
  const selectedCell = selected
    ? grid.rows[selected.weekIndex]?.cells.find((c) => c?.dayIndex === selected.dayIndex)
    : undefined;
  const selectedDate = selectedCell?.date;

  const shortOf = (it: LiftGridItem) =>
    movementLabel({ type: shown, minutes: 0, variationId: it.variation.variation.variationId }, format, language);

  function renderItem(cell: LiftGridCell, it: LiftGridItem) {
    const at = { weekIndex: cell.weekIndex, dayIndex: cell.dayIndex, variationIndex: it.variationIndex };
    const active = selected != null && keyOf(selected) === keyOf(at);
    return (
      <Pressable
        key={it.variationIndex}
        onPress={() => setSelected(active ? null : at)}
        style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t('planAppendix.liftGrid.cellA11y', {
          lift: t(`blockVariations.${it.variation.variation.variationId}.label`),
          week: weekLabel(cell.weekIndex),
          date: cell.date ? formatDisplayDate(cell.date, language) : '',
        })}
      >
        <Text style={styles.itemText}>
          <Text style={styles.itemLabel}>{shortOf(it)} </Text>
          {formatSetSequence(it.variation.sets, format, language)}
          {it.variation.userEdited ? <Text style={styles.edited}> ✎</Text> : null}
        </Text>
        <Text style={styles.itemPct}>
          {t('planAppendix.liftGrid.pct', { pct: it.variation.pct1rm })}
          {it.variation.actualRpe != null
            ? ` · ${t('planAppendix.rpe.value', { rpe: it.variation.actualRpe.toLocaleString(LOCALE_TAGS[language]) })}`
            : ''}
        </Text>
      </Pressable>
    );
  }

  function renderCell(cell: LiftGridCell | null, i: number) {
    if (!cell) return <View key={i} style={[styles.cell, styles.cellEmpty, { width: cellW }]} />;
    return (
      <View
        key={i}
        style={[styles.cell, { width: cellW }, cell.state === 'done' && styles.cellDone, cell.state === 'skipped' && styles.cellOff]}
      >
        {cell.date ? <Text style={styles.cellDate}>{formatDisplayDate(cell.date, language)}</Text> : null}
        {cell.skipped ? (
          <Text style={styles.offText}>{t('planAppendix.liftGrid.off')}</Text>
        ) : (
          cell.items.map((it) => renderItem(cell, it))
        )}
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.chipRow}>
        {lifts.map((e) => {
          const active = e === shown;
          return (
            <Pressable
              key={e}
              onPress={() => {
                setLift(e);
                setSelected(null);
              }}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`activities.${e}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{t('planAppendix.liftGrid.hint')}</Text>

      <ScrollView style={styles.window} nestedScrollEnabled>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            <View style={styles.row}>
              <View style={{ width: LABEL_W }} />
              {grid.weekdays.map((dow) => (
                <Text key={dow} style={[styles.colHead, { width: cellW }]}>
                  {weekdayLabel(dow, language, 'short')}
                </Text>
              ))}
            </View>
            {grid.rows.map((row) => (
              <View key={row.weekIndex} style={styles.row}>
                <Text style={[styles.rowHead, row.weekIndex === currentWeekIndex && styles.rowHeadNow]}>
                  {weekLabel(row.weekIndex)}
                </Text>
                {row.cells.map(renderCell)}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {selected && selectedVariation && (
        <View style={styles.editorBox}>
          <Text style={styles.editorTitle}>
            {t('planAppendix.liftGrid.editTitle', {
              lift: t(`blockVariations.${selectedVariation.variation.variationId}.label`),
              week: weekLabel(selected.weekIndex),
              date: selectedDate ? formatDisplayDate(selectedDate, language) : '',
            })}
          </Text>
          {selectedCell?.state === 'done' && (
            <RpeChips
              label={t('planAppendix.rpe.label', {
                lift: t(`blockVariations.${selectedVariation.variation.variationId}.label`),
              })}
              value={selectedVariation.actualRpe}
              onChange={(rpe) => {
                onRate(selected, rpe);
              }}
            />
          )}
          <VariationSetsEditor
            key={`${keyOf(selected)}.${editorRev}`}
            variation={selectedVariation}
            reference={referenceOf(plan, selectedVariation)}
            bodyWeightKg={plan.config.bodyWeightKg}
            heightCm={heightCm}
            onSave={(sets) => {
              onEdit(selected, sets).then(() => setSelected(null));
            }}
            onRestore={() => {
              onEdit(selected, null).then(() => setEditorRev((r) => r + 1));
            }}
            onCancel={() => setSelected(null)}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 10 },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: c.onAccent },
    hint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    window: { maxHeight: GRID_MAX_HEIGHT },
    table: { gap: GAP },
    row: { flexDirection: 'row', gap: GAP, alignItems: 'stretch' },
    colHead: { color: c.textTertiary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    rowHead: { width: LABEL_W, color: c.textSecondary, fontSize: 12, fontWeight: '800', paddingTop: 8 },
    rowHeadNow: { color: c.accent },
    cell: {
      minHeight: 84,
      padding: 6,
      gap: 4,
      borderRadius: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    cellEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed' },
    cellDone: { backgroundColor: c.planDoneBg, borderColor: c.planDoneBorder },
    cellOff: { backgroundColor: c.planSkippedBg, borderColor: c.planSkippedBg, opacity: 0.75 },
    cellDate: { color: c.notebookDate, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
    offText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    item: { padding: 4, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', gap: 1 },
    itemActive: { borderColor: c.accent, backgroundColor: c.bgHighlight },
    itemText: { color: c.textPrimary, fontSize: 12, lineHeight: 16 },
    itemLabel: { color: c.notebookLift, fontWeight: '700' },
    itemPct: { color: c.textMuted, fontSize: 10 },
    edited: { color: c.accent },
    editorBox: { gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.accent },
    editorTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

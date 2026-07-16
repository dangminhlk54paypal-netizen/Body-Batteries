import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { ACTIVITY_LABELS } from './EnergyActionsBar';
import { describeLiftingSets } from './PowerliftingSheet';
import type { BatteryType, IntakeEvent } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import type { ActivityLogEntry, WorkoutSession } from '../types/energy';
import { colors } from '../lib/theme';

interface Props {
  battery: BatteryType | null;
  visible: boolean;
  onClose: () => void;
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  intakeLog: IntakeEvent[];
  // Current reading level for `battery`, used for the footer total — passed
  // in rather than read from a store, keeping this sheet a dumb display.
  level: number;
}

interface SourceRow {
  id: string;
  label: string;
  value: string;
}

// Caption shown under the title only for the "Khoáng chất" battery — its
// value is a rollup of several micros, unlike protein/carbs which are a
// single macro straight off the food database.
const MINERALS_CAPTION =
  'Tổng khoáng ước tính (canxi + sắt + natri + kali + magiê + kẽm) từ món đã ghi.';

// One workout's display label — mirrors TodayActivities.summaryLabel's
// per-workout piece: set-based lifts show what was lifted (describeLiftingSets),
// a free-text custom activity shows its own name, everything else shows the
// fixed MET label.
function workoutLabel(w: WorkoutSession): string {
  if (w.sets?.length) return `${ACTIVITY_LABELS[w.type]} ${describeLiftingSets(w.sets)}`;
  if (w.type === 'custom') return w.customName || ACTIVITY_LABELS.custom;
  return ACTIVITY_LABELS[w.type];
}

function movementEntryLabel(entry: ActivityLogEntry): string {
  if (entry.workouts.length > 0) {
    return entry.workouts.map(workoutLabel).join(' · ');
  }
  return 'Đi bộ/bước chân';
}

// Manual quick-tap rows (intakeLog) for one battery. The tap-to-charge path
// for protein/carbs/minerals is retired (these pins are display-only now)
// but old entries can still exist in today's intakeLog. Movement is NOT
// listed here at all: energyStore.isManualQuickTapIntake has always filtered
// movement rows out of intakeLog, so its only sources are activityLog
// entries.
function intakeRows(intakeLog: IntakeEvent[], batteryId: string, unit: string): SourceRow[] {
  return intakeLog
    .filter((e) => e.batteryTypeId === batteryId)
    .map((e) => ({
      id: e.id,
      label: `Nạp nhanh${e.note ? ` (${e.note})` : ''}`,
      value: `${e.amount} ${unit}`,
    }));
}

// One row per logged food that contributed a nonzero amount of `key`. The
// stored values are already display-rounded at log time (nutritionForGrams:
// proteinG/carbG to 1 decimal, mineralsMg to a whole number) — no further
// rounding needed here.
function foodRows(
  foodLog: FoodLogEntry[],
  key: 'proteinG' | 'carbG' | 'mineralsMg',
  unit: string
): SourceRow[] {
  return foodLog
    .filter((f) => f[key] > 0)
    .map((f) => ({ id: f.id, label: f.foodNameVi, value: `${f[key]} ${unit}` }));
}

function buildRows(
  battery: BatteryType,
  foodLog: FoodLogEntry[],
  activityLog: ActivityLogEntry[],
  intakeLog: IntakeEvent[]
): SourceRow[] {
  switch (battery.id) {
    case 'protein':
      return [...foodRows(foodLog, 'proteinG', 'g'), ...intakeRows(intakeLog, 'protein', 'g')];
    case 'carbs':
      return [...foodRows(foodLog, 'carbG', 'g'), ...intakeRows(intakeLog, 'carbs', 'g')];
    case 'minerals':
      return [
        ...foodRows(foodLog, 'mineralsMg', 'mg'),
        ...intakeRows(intakeLog, 'minerals', 'mg'),
      ];
    case 'movement':
      return activityLog.map((e) => ({
        id: e.id,
        label: movementEntryLabel(e),
        value: `${Math.round(e.movementStepsApplied ?? e.steps)} bước · ${Math.round(e.energyKcal)} kcal`,
      }));
    default:
      return [];
  }
}

const MAX_ROWS_HEIGHT = Dimensions.get('window').height * 0.45;

// Read-only "where did this pin's charge come from today" breakdown — shown
// instead of IntakeModal for the 4 auto-charged sub-batteries (protein/carbs/
// minerals/movement); water/sleep keep the manual IntakeModal input (see
// HomeScreen.handleCellPress).
export function BatterySourceSheet({
  battery,
  visible,
  onClose,
  foodLog,
  activityLog,
  intakeLog,
  level,
}: Props) {
  if (!battery) return null;

  const rows = buildRows(battery, foodLog, activityLog, intakeLog);

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={450}>
      <View style={styles.content}>
        <Text style={styles.title}>Nguồn nạp {battery.name} hôm nay</Text>
        {battery.id === 'minerals' && <Text style={styles.caption}>{MINERALS_CAPTION}</Text>}

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            Chưa có nguồn nào hôm nay — hãy ghi món ăn hoặc vận động.
          </Text>
        ) : (
          <ScrollView
            style={[styles.table, { maxHeight: MAX_ROWS_HEIGHT }]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Text style={styles.totalText}>
            Tổng hôm nay: {Math.round(level)}{battery.unit}
          </Text>
          <Text style={styles.footerNote}>
            Pin này tự nạp khi bạn ghi món ăn / vận động ở trên — không cần nạp tay.
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: -8,
  },
  empty: {
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 19,
  },
  table: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footer: {
    marginTop: 4,
    gap: 4,
  },
  totalText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  footerNote: {
    fontSize: 12,
    color: colors.textSubtle,
    lineHeight: 17,
  },
});

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { activityLabel } from './EnergyActionsBar';
import { describeLiftingSets } from './PowerliftingSheet';
import { bbExerciseName } from './BodybuildingSheet';
import type { BatteryType, IntakeEvent } from '../types/battery';
import type { FoodLogEntry } from '../types/food';
import type { ActivityLogEntry, WorkoutSession } from '../types/energy';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

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

// One workout's display label — mirrors TodayActivities.summaryLabel's
// per-workout piece: an S-BB session shows its specific exercise name
// (checked FIRST — it also has `sets`, so it must not fall into the generic
// set-based branch below), set-based powerlifting shows what was lifted
// (describeLiftingSets), a free-text custom activity shows its own name,
// everything else shows the fixed MET label.
function workoutLabel(w: WorkoutSession, language: Language): string {
  if (w.bbMet != null && w.sets?.length) {
    return `${bbExerciseName(w, language)} ${describeLiftingSets(w.sets, language)}`;
  }
  if (w.sets?.length) return `${activityLabel(w.type, language)} ${describeLiftingSets(w.sets, language)}`;
  if (w.type === 'custom') return w.customName || activityLabel('custom', language);
  return activityLabel(w.type, language);
}

function movementEntryLabel(entry: ActivityLogEntry, t: TFn, language: Language): string {
  if (entry.workouts.length > 0) {
    return entry.workouts.map((w) => workoutLabel(w, language)).join(' · ');
  }
  return t('components.batterySourceSheet.walkingFallback');
}

// Manual quick-tap rows (intakeLog) for one battery. The tap-to-charge path
// for protein/carbs/minerals is retired (these pins are display-only now)
// but old entries can still exist in today's intakeLog. Movement is NOT
// listed here at all: energyStore.isManualQuickTapIntake has always filtered
// movement rows out of intakeLog, so its only sources are activityLog
// entries.
function intakeRows(intakeLog: IntakeEvent[], batteryId: string, unit: string, t: TFn): SourceRow[] {
  return intakeLog
    .filter((e) => e.batteryTypeId === batteryId)
    .map((e) => ({
      id: e.id,
      label: e.note
        ? t('components.batterySourceSheet.quickChargeLabelWithNote', { note: e.note })
        : t('components.batterySourceSheet.quickChargeLabel'),
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
  intakeLog: IntakeEvent[],
  t: TFn,
  language: Language
): SourceRow[] {
  switch (battery.id) {
    case 'protein':
      return [...foodRows(foodLog, 'proteinG', 'g'), ...intakeRows(intakeLog, 'protein', 'g', t)];
    case 'carbs':
      return [...foodRows(foodLog, 'carbG', 'g'), ...intakeRows(intakeLog, 'carbs', 'g', t)];
    case 'minerals':
      return [
        ...foodRows(foodLog, 'mineralsMg', 'mg'),
        ...intakeRows(intakeLog, 'minerals', 'mg', t),
      ];
    case 'movement':
      return activityLog.map((e) => ({
        id: e.id,
        label: movementEntryLabel(e, t, language),
        value: t('components.batterySourceSheet.stepsKcalValue', {
          steps: Math.round(e.movementStepsApplied ?? e.steps),
          kcal: Math.round(e.energyKcal),
        }),
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
  const { t, language } = useT();
  if (!battery) return null;

  const rows = buildRows(battery, foodLog, activityLog, intakeLog, t, language);

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={450}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('components.batterySourceSheet.title', { name: battery.name })}
        </Text>
        {battery.id === 'minerals' && (
          <Text style={styles.caption}>{t('components.batterySourceSheet.mineralsCaption')}</Text>
        )}

        {rows.length === 0 ? (
          <Text style={styles.empty}>{t('components.batterySourceSheet.emptyText')}</Text>
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
            {t('components.batterySourceSheet.totalText', {
              value: Math.round(level),
              unit: battery.unit,
            })}
          </Text>
          <Text style={styles.footerNote}>{t('components.batterySourceSheet.footerNote')}</Text>
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

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  liftingSessionKcal,
  estimateLiftingMinutes,
  liftingTonnageKg,
  bestOneRepMax,
  warmupRamp,
} from '../domain/energy/liftingEngine';
import { getActivityLogInRange } from '../data/repositories/activityLogRepository';
import { todayString, daysAgo, formatDMY, dateString } from '../lib/dateUtils';
import type {
  ActivityLogEntry,
  LiftingExercise,
  LiftingSet,
  WorkoutSession,
} from '../types/energy';
import { LIFTING_EXERCISES } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// Exercise display label, keyed off the shared `activities.*` locale
// namespace (same names TodayActivities/BatterySourceSheet already use).
function liftingLabel(exercise: LiftingExercise, t: TFn): string {
  return t(`activities.${exercise}`);
}

// How far back to look for the "buổi trước" (previous session) reference
// shown under each exercise tab.
const HISTORY_LOOKBACK_DAYS = 60;

// One editable set row. Kept as raw strings while typing (same convention as
// the other numeric forms in this app) and parsed only on preview/confirm.
interface SetRowInput {
  weight: string;
  reps: string;
}

type ExerciseRows = { warmup: SetRowInput[]; working: SetRowInput[] };
type AllRows = Record<LiftingExercise, ExerciseRows>;

function emptyRows(): AllRows {
  return {
    squat: { warmup: [], working: [{ weight: '', reps: '' }] },
    bench_press: { warmup: [], working: [{ weight: '', reps: '' }] },
    deadlift: { warmup: [], working: [{ weight: '', reps: '' }] },
  };
}

function setToRow(s: LiftingSet): SetRowInput {
  return { weight: String(s.weightKg), reps: String(s.reps) };
}

// Prefill for edit mode — parents remount the sheet via `key` when the
// edited entry changes, so a plain useState initializer is enough (no
// setState-in-effect needed).
function rowsFromEntry(entry: ActivityLogEntry | null | undefined): AllRows {
  const rows = emptyRows();
  if (!entry) return rows;
  for (const w of entry.workouts) {
    if (!w.sets?.length) continue;
    const exercise = w.type as LiftingExercise;
    if (!LIFTING_EXERCISES.includes(exercise)) continue;
    rows[exercise] = {
      warmup: w.sets.filter((s) => s.kind === 'warmup').map(setToRow),
      working: w.sets.filter((s) => s.kind === 'working').map(setToRow),
    };
  }
  return rows;
}

// Parse one section's rows into real sets, silently skipping incomplete rows
// (empty weight OR reps). Weight 0 is a valid bodyweight/empty-bar set.
function parseRows(rows: SetRowInput[], kind: LiftingSet['kind']): LiftingSet[] {
  const sets: LiftingSet[] = [];
  for (const r of rows) {
    const weightKg = parseDecimal(r.weight);
    const reps = parseDecimal(r.reps);
    if (isNaN(weightKg) || weightKg < 0 || isNaN(reps) || reps <= 0) continue;
    sets.push({ kind, weightKg, reps: Math.round(reps) });
  }
  return sets;
}

function parseExercise(rows: ExerciseRows): LiftingSet[] {
  return [...parseRows(rows.warmup, 'warmup'), ...parseRows(rows.working, 'working')];
}

// "5×5@100kg" when the working sets are uniform, otherwise "8 sets · 3450kg".
// `language` defaults to 'vi' so existing call sites that don't pass it
// (BatterySourceSheet.tsx, TodayActivities.tsx) keep their current behavior;
// PowerliftingSheet itself always passes the live language explicitly.
export function describeLiftingSets(sets: LiftingSet[], language: Language = 'vi'): string {
  const working = sets.filter((s) => s.kind === 'working');
  const warmups = sets.length - working.length;
  if (working.length === 0) {
    return translate(language, 'components.powerliftingSheet.warmupSetsOnly', { count: sets.length });
  }
  const uniform = working.every(
    (s) => s.weightKg === working[0].weightKg && s.reps === working[0].reps
  );
  const main = uniform
    ? `${working.length}×${working[0].reps}@${working[0].weightKg}kg`
    : translate(language, 'components.powerliftingSheet.setsTonnage', {
        count: working.length,
        tonnage: liftingTonnageKg(working),
      });
  return warmups > 0
    ? translate(language, 'components.powerliftingSheet.plusWarmups', { main, count: warmups })
    : main;
}

interface PrevSessionInfo {
  dateLabel: string;
  summary: string;
  e1rm: number;
}

// Latest logged session of `exercise` (excluding the entry being edited).
function findPrevSession(
  history: ActivityLogEntry[],
  exercise: LiftingExercise,
  language: Language,
  excludeId?: string
): PrevSessionInfo | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.id === excludeId) continue;
    const workout = entry.workouts.find((w) => w.type === exercise && w.sets?.length);
    if (!workout?.sets) continue;
    const when = entry.startAt ?? entry.timestamp;
    return {
      dateLabel: formatDMY(dateString(new Date(when))),
      summary: describeLiftingSets(workout.sets, language),
      e1rm: bestOneRepMax(workout.sets),
    };
  }
  return null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  // Edit mode: prefill from this entry and save through onSaveEdit instead
  // of logging a new activity. Parents should remount via key={entry.id} so
  // the prefill initializer re-runs per entry.
  editingEntry?: ActivityLogEntry | null;
  onSaveEdit?: (id: string, workouts: WorkoutSession[]) => void;
}

export function PowerliftingSheet({ visible, onClose, editingEntry, onSaveEdit }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logActivity = useEnergyStore((s) => s.logActivity);
  const profile = useSettingsStore((s) => s.userProfile);

  const [exercise, setExercise] = useState<LiftingExercise>('squat');
  const [rows, setRows] = useState<AllRows>(() => rowsFromEntry(editingEntry));
  const [history, setHistory] = useState<ActivityLogEntry[]>([]);

  // Previous-session reference, read-only from the repository (same
  // promise + cancelled-flag pattern as useMicroBatteryHistory).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getActivityLogInRange(daysAgo(HISTORY_LOOKBACK_DAYS), todayString()).then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const parsedByExercise = useMemo(() => {
    const out = {} as Record<LiftingExercise, LiftingSet[]>;
    for (const ex of LIFTING_EXERCISES) out[ex] = parseExercise(rows[ex]);
    return out;
  }, [rows]);

  const preview = useMemo(() => {
    let kcal = 0;
    let minutes = 0;
    for (const ex of LIFTING_EXERCISES) {
      const sets = parsedByExercise[ex];
      if (sets.length === 0) continue;
      kcal += liftingSessionKcal(ex, sets, profile.weightKg, profile.heightCm);
      minutes += estimateLiftingMinutes(sets);
    }
    return { kcal, minutes };
  }, [parsedByExercise, profile.weightKg, profile.heightCm]);

  const prev = useMemo(
    () => findPrevSession(history, exercise, language, editingEntry?.id),
    [history, exercise, language, editingEntry?.id]
  );

  const current = rows[exercise];
  const currentSets = parsedByExercise[exercise];
  const currentE1rm = bestOneRepMax(currentSets);

  function patchSection(kind: keyof ExerciseRows, next: SetRowInput[]) {
    setRows({ ...rows, [exercise]: { ...current, [kind]: next } });
  }

  function updateRow(kind: keyof ExerciseRows, index: number, patch: Partial<SetRowInput>) {
    patchSection(
      kind,
      current[kind].map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function addRow(kind: keyof ExerciseRows) {
    const section = current[kind];
    // Duplicate the last row — the common case is "same weight, same reps,
    // next set" (straight sets).
    const last = section[section.length - 1];
    patchSection(kind, [...section, last ? { ...last } : { weight: '', reps: '' }]);
  }

  function removeRow(kind: keyof ExerciseRows, index: number) {
    patchSection(
      kind,
      current[kind].filter((_, i) => i !== index)
    );
  }

  // Fill the warm-up section with the standard ramp toward the first working
  // set's weight (bar ×10 → 50%×6 → 70%×4 → 85%×2).
  function suggestWarmup() {
    const firstWorking = parseRows(current.working, 'working')[0];
    if (!firstWorking || firstWorking.weightKg <= 0) return;
    patchSection('warmup', warmupRamp(firstWorking.weightKg).map(setToRow));
  }

  function confirm() {
    const workouts: WorkoutSession[] = [];
    for (const ex of LIFTING_EXERCISES) {
      const sets = parsedByExercise[ex];
      if (sets.length === 0) continue;
      workouts.push({ type: ex, minutes: estimateLiftingMinutes(sets), sets });
    }
    if (workouts.length === 0) return;
    if (editingEntry && onSaveEdit) {
      onSaveEdit(editingEntry.id, workouts);
    } else {
      logActivity({ steps: 0, workouts });
      setRows(emptyRows());
    }
    onClose();
  }

  function renderSection(kind: keyof ExerciseRows, title: string) {
    const section = current[kind];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {kind === 'warmup' && (
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
              onPress={suggestWarmup}
            >
              <Text style={styles.suggestText}>
                {t('components.powerliftingSheet.suggestWarmupButton')}
              </Text>
            </Pressable>
          )}
        </View>
        {section.length === 0 && (
          <Text style={styles.emptySection}>
            {kind === 'warmup'
              ? t('components.powerliftingSheet.emptyWarmup')
              : t('components.powerliftingSheet.emptyWorking')}
          </Text>
        )}
        {section.map((row, i) => (
          <View key={`${kind}-${i}`} style={styles.setRow}>
            <Text style={styles.setIndex}>{i + 1}</Text>
            <TextInput
              style={styles.setInput}
              placeholder={t('components.powerliftingSheet.weightPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={row.weight}
              onChangeText={(v) => updateRow(kind, i, { weight: v })}
            />
            <Text style={styles.setUnit}>{t('components.powerliftingSheet.weightUnitLabel')}</Text>
            <TextInput
              style={styles.setInput}
              placeholder={t('components.powerliftingSheet.repsPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              value={row.reps}
              onChangeText={(v) => updateRow(kind, i, { reps: v })}
            />
            <Text style={styles.setUnit}>{t('components.powerliftingSheet.repsUnitLabel')}</Text>
            <Pressable
              hitSlop={10}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              onPress={() => removeRow(kind, i)}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => addRow(kind)}
        >
          <Text style={styles.addText}>{t('components.powerliftingSheet.addSetButton')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {t('components.powerliftingSheet.titleNew')}
          {editingEntry ? t('components.powerliftingSheet.titleEditSuffix') : ''}
        </Text>
        <Text style={styles.subtitle}>{t('components.powerliftingSheet.subtitle')}</Text>

        {/* Exercise tabs */}
        <View style={styles.tabs}>
          {LIFTING_EXERCISES.map((ex) => {
            const count = parsedByExercise[ex].length;
            const active = exercise === ex;
            return (
              <Pressable
                key={ex}
                onPress={() => setExercise(ex)}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {liftingLabel(ex, t)}
                  {count > 0 ? ` · ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Previous session of this exercise — progressive-overload reference */}
        <View style={styles.prevCard}>
          {prev ? (
            <Text style={styles.prevText}>
              {t('components.powerliftingSheet.prevSessionLine', {
                date: prev.dateLabel,
                summary: prev.summary,
              })}
              {prev.e1rm > 0
                ? t('components.powerliftingSheet.prevSessionE1rmSuffix', { value: prev.e1rm })
                : ''}
            </Text>
          ) : (
            <Text style={styles.prevText}>
              {t('components.powerliftingSheet.noPrevSession', {
                exercise: liftingLabel(exercise, t),
                days: HISTORY_LOOKBACK_DAYS,
              })}
            </Text>
          )}
        </View>

        {renderSection('warmup', t('components.powerliftingSheet.warmupSectionTitle'))}
        {renderSection('working', t('components.powerliftingSheet.workingSectionTitle'))}

        {currentE1rm > 0 && (
          <Text style={styles.e1rmText}>
            {t('components.powerliftingSheet.e1rmToday', {
              exercise: liftingLabel(exercise, t),
              value: currentE1rm,
            })}
          </Text>
        )}

        <View style={styles.previewCard}>
          <Text style={styles.previewText}>
            {preview.kcal > 0
              ? t('components.powerliftingSheet.previewSummary', {
                  kcal: preview.kcal,
                  minutes: preview.minutes,
                })
              : t('components.powerliftingSheet.previewEmpty')}
          </Text>
        </View>

        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            // Truly disabled (not just dimmed) with no sets — otherwise the
            // tap silently no-ops in confirm() and the button feels broken.
            disabled={preview.kcal <= 0}
            style={({ pressed }) => [
              styles.modalBtn,
              styles.confirm,
              preview.kcal <= 0 && styles.confirmDisabled,
              pressed && styles.pressed,
            ]}
            onPress={confirm}
          >
            <Text style={styles.btnText}>
              {editingEntry ? t('common.save') : t('components.powerliftingSheet.confirmNewButton')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { padding: 24, paddingTop: 12, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabActive: { backgroundColor: c.danger, borderColor: c.danger },
  tabText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: c.textPrimary },
  prevCard: {
    backgroundColor: c.bgHighlight,
    borderRadius: 10,
    padding: 10,
  },
  prevText: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.textBright },
  suggestBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  suggestText: { color: c.accent, fontSize: 11, fontWeight: '600' },
  emptySection: { color: c.textMuted, fontSize: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { width: 16, color: c.textMuted, fontSize: 12, textAlign: 'center' },
  setInput: {
    flex: 1,
    backgroundColor: c.bgElevated,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 15,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
    textAlign: 'center',
  },
  setUnit: { color: c.textTertiary, fontSize: 12 },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: c.danger, fontSize: 13, fontWeight: '700' },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
  },
  addText: { color: c.infoAlt, fontSize: 12, fontWeight: '700' },
  e1rmText: { color: c.mint, fontSize: 12, fontWeight: '600' },
  previewCard: {
    backgroundColor: c.bgHighlight,
    borderRadius: 10,
    padding: 12,
  },
  previewText: { color: c.textBright, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  confirm: { backgroundColor: c.danger },
  confirmDisabled: { opacity: 0.5 },
  btnText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

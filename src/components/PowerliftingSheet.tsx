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
import { colors } from '../lib/theme';

export const LIFTING_LABELS: Record<LiftingExercise, string> = {
  squat: 'Squat',
  bench_press: 'Bench',
  deadlift: 'Deadlift',
};

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
    const weightKg = parseFloat(r.weight);
    const reps = parseFloat(r.reps);
    if (isNaN(weightKg) || weightKg < 0 || isNaN(reps) || reps <= 0) continue;
    sets.push({ kind, weightKg, reps: Math.round(reps) });
  }
  return sets;
}

function parseExercise(rows: ExerciseRows): LiftingSet[] {
  return [...parseRows(rows.warmup, 'warmup'), ...parseRows(rows.working, 'working')];
}

// "5×5@100kg" when the working sets are uniform, otherwise "8 set · 3450kg".
export function describeLiftingSets(sets: LiftingSet[]): string {
  const working = sets.filter((s) => s.kind === 'working');
  const warmups = sets.length - working.length;
  if (working.length === 0) return `${sets.length} set khởi động`;
  const uniform = working.every(
    (s) => s.weightKg === working[0].weightKg && s.reps === working[0].reps
  );
  const main = uniform
    ? `${working.length}×${working[0].reps}@${working[0].weightKg}kg`
    : `${working.length} set · ${liftingTonnageKg(working)}kg`;
  return warmups > 0 ? `${main} (+${warmups} khởi động)` : main;
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
      summary: describeLiftingSets(workout.sets),
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
    () => findPrevSession(history, exercise, editingEntry?.id),
    [history, exercise, editingEntry?.id]
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
              <Text style={styles.suggestText}>⚡ Gợi ý từ mức tạ chính</Text>
            </Pressable>
          )}
        </View>
        {section.length === 0 && (
          <Text style={styles.emptySection}>
            {kind === 'warmup' ? 'Chưa có set khởi động.' : 'Chưa có set chính.'}
          </Text>
        )}
        {section.map((row, i) => (
          <View key={`${kind}-${i}`} style={styles.setRow}>
            <Text style={styles.setIndex}>{i + 1}</Text>
            <TextInput
              style={styles.setInput}
              placeholder="kg"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={row.weight}
              onChangeText={(t) => updateRow(kind, i, { weight: t })}
            />
            <Text style={styles.setUnit}>kg ×</Text>
            <TextInput
              style={styles.setInput}
              placeholder="rep"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={row.reps}
              onChangeText={(t) => updateRow(kind, i, { reps: t })}
            />
            <Text style={styles.setUnit}>rep</Text>
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
          <Text style={styles.addText}>＋ Thêm set</Text>
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
          🏋️ Powerlifting{editingEntry ? ' — sửa buổi tập' : ''}
        </Text>
        <Text style={styles.subtitle}>
          Ghi theo set × rep × tạ — kcal tính từ khối lượng nâng thật, không cần bấm giờ.
        </Text>

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
                  {LIFTING_LABELS[ex]}
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
              Buổi trước ({prev.dateLabel}): {prev.summary}
              {prev.e1rm > 0 ? ` · e1RM ~${prev.e1rm}kg` : ''}
            </Text>
          ) : (
            <Text style={styles.prevText}>
              Chưa có buổi {LIFTING_LABELS[exercise]} nào trong {HISTORY_LOOKBACK_DAYS} ngày qua.
            </Text>
          )}
        </View>

        {renderSection('warmup', 'Khởi động (tạ lên dần)')}
        {renderSection('working', 'Bài chính')}

        {currentE1rm > 0 && (
          <Text style={styles.e1rmText}>
            e1RM hôm nay ({LIFTING_LABELS[exercise]}): ~{currentE1rm}kg
          </Text>
        )}

        <View style={styles.previewCard}>
          <Text style={styles.previewText}>
            {preview.kcal > 0
              ? `Ước tính cả buổi: 🔥 ~${preview.kcal} kcal · ~${preview.minutes} phút`
              : 'Nhập ít nhất một set (kg × rep) để tính kcal.'}
          </Text>
        </View>

        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Huỷ</Text>
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
            <Text style={styles.btnText}>{editingEntry ? 'Lưu' : 'Ghi buổi tập 🏋️'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { padding: 24, paddingTop: 12, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.textPrimary },
  prevCard: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 10,
    padding: 10,
  },
  prevText: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textBright },
  suggestBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  suggestText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  emptySection: { color: colors.textMuted, fontSize: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { width: 16, color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  setInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  setUnit: { color: colors.textTertiary, fontSize: 12 },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
  },
  addText: { color: colors.infoAlt, fontSize: 12, fontWeight: '700' },
  e1rmText: { color: colors.mint, fontSize: 12, fontWeight: '600' },
  previewCard: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 10,
    padding: 12,
  },
  previewText: { color: colors.textBright, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.bgElevated },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  confirm: { backgroundColor: colors.danger },
  confirmDisabled: { opacity: 0.5 },
  btnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ACTIVITY_TYPES, activityLabel } from './EnergyActionsBar';
import { PowerliftingSheet, describeLiftingSets } from './PowerliftingSheet';
import { BodybuildingSheet, bbExerciseName } from './BodybuildingSheet';
import { formatTimeHHmm, parseTimeHHmmToday } from '../lib/dateUtils';
import type { ActivityLogEntry, ActivityType, WorkoutSession } from '../types/energy';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface Props {
  entries: ActivityLogEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: {
    steps?: number;
    workouts?: WorkoutSession[];
    // undefined = leave the existing time unchanged; null = the user
    // explicitly cleared the field, so drop the stored time entirely.
    startAt?: number | null;
    endAt?: number | null;
  }) => void;
}

// Blank input = user explicitly cleared the field (→ null, drop the stored
// time). Non-blank but unparseable ("25:99") is more likely a typo than an
// intentional clear, so it falls back to `undefined` (keep the old value)
// rather than silently wiping it.
function timeFieldPatch(raw: string): number | null | undefined {
  if (raw.trim() === '') return null;
  return parseTimeHHmmToday(raw);
}

function timeRangeLabel(entry: ActivityLogEntry, t: TFn): string {
  if (entry.startAt && entry.endAt) {
    return `${formatTimeHHmm(entry.startAt)}–${formatTimeHHmm(entry.endAt)}`;
  }
  if (entry.startAt) {
    return t('components.todayActivities.fromTimePrefix', { time: formatTimeHHmm(entry.startAt) });
  }
  return formatTimeHHmm(entry.timestamp);
}

// The label a workout shows in the history list — an S-BB session shows its
// specific exercise name (checked FIRST: it also has `sets`, so it must not
// fall through to the generic paths below); a custom activity's own nameVi
// takes priority over the generic "custom activity" activityLabel entry.
function workoutLabel(w: WorkoutSession, language: Language): string {
  if (w.bbMet != null) return bbExerciseName(w, language);
  return w.customName ?? activityLabel(w.type, language);
}

function summaryLabel(entry: ActivityLogEntry, t: TFn, language: Language): string {
  const parts: string[] = [];
  for (const w of entry.workouts) {
    // Set-based powerlifting sessions (S-PL) show what was lifted, not the
    // estimated minutes — "Squat 5×5@100kg (+4 khởi động)".
    parts.push(
      w.sets?.length
        ? `${workoutLabel(w, language)} ${describeLiftingSets(w.sets, language)}`
        : `${workoutLabel(w, language)} ${t('components.todayActivities.minutesSuffix', { minutes: w.minutes })}`
    );
  }
  if (entry.steps > 0) {
    parts.push(t('components.todayActivities.stepsSuffix', { steps: entry.steps }));
  }
  return parts.length > 0 ? parts.join(' · ') : t('components.todayActivities.fallbackLabel');
}

// Entries logged through the Bodybuilding sheet (S-BB) are edited there too.
// MUST be checked BEFORE isLiftingEntry below: an S-BB session also carries
// `sets`, so isLiftingEntry would otherwise misclassify it as a Powerlifting
// entry — opening the wrong sheet, which would then silently DROP the
// bodybuilding workouts on save (PowerliftingSheet only knows squat/bench/
// deadlift and replaces the entry's entire `workouts` array).
function isBodybuildingEntry(entry: ActivityLogEntry): boolean {
  return entry.workouts.some((w) => w.bbMet != null);
}

// Entries logged through the Powerlifting sheet are edited there too — the
// minutes form below can't represent sets and would silently flatten them.
function isLiftingEntry(entry: ActivityLogEntry): boolean {
  return entry.workouts.some((w) => (w.sets?.length ?? 0) > 0);
}

// Custom-activity entries (type === 'custom') keep their type/customName/
// customMet fixed in v1 — only minutes/steps/time are editable, since there
// is no MET_TABLE row to re-pick from (see EnergyActionsBar's chip picker).
function isCustomEntry(entry: ActivityLogEntry): boolean {
  return entry.workouts.some((w) => w.type === 'custom');
}

export function TodayActivities({ entries, onDelete, onEdit }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [editingEntry, setEditingEntry] = useState<ActivityLogEntry | null>(null);
  const [liftingEntry, setLiftingEntry] = useState<ActivityLogEntry | null>(null);
  const [bodybuildingEntry, setBodybuildingEntry] = useState<ActivityLogEntry | null>(null);
  const [editActivity, setEditActivity] = useState<ActivityType>('running');
  const [editMinutes, setEditMinutes] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const totalKcal = entries.reduce((sum, e) => sum + e.energyKcal, 0);

  function startEdit(entry: ActivityLogEntry) {
    // MUST check isBodybuildingEntry first — see its comment above.
    if (isBodybuildingEntry(entry)) {
      setBodybuildingEntry(entry);
      return;
    }
    if (isLiftingEntry(entry)) {
      setLiftingEntry(entry);
      return;
    }
    const workout = entry.workouts[0];
    setEditingEntry(entry);
    setEditActivity(workout?.type ?? 'running');
    setEditMinutes(workout ? String(workout.minutes) : '');
    setEditSteps(entry.steps > 0 ? String(entry.steps) : '');
    setEditStart(entry.startAt ? formatTimeHHmm(entry.startAt) : '');
    setEditEnd(entry.endAt ? formatTimeHHmm(entry.endAt) : '');
  }

  function confirmEdit() {
    if (!editingEntry) return;
    const mins = parseDecimal(editMinutes);
    const stepCount = parseDecimal(editSteps);
    const hasMinutes = !isNaN(mins) && mins > 0;
    // Custom entries keep their type/customName/customMet untouched — only
    // minutes/steps/time are editable in v1 (see isCustomEntry comment).
    const originalWorkout = editingEntry.workouts[0];
    const workouts: WorkoutSession[] = hasMinutes
      ? originalWorkout?.type === 'custom'
        ? [
            {
              type: 'custom',
              minutes: mins,
              customName: originalWorkout.customName,
              customMet: originalWorkout.customMet,
            },
          ]
        : [{ type: editActivity, minutes: mins }]
      : [];
    onEdit(editingEntry.id, {
      steps: !isNaN(stepCount) && stepCount > 0 ? stepCount : 0,
      workouts,
      startAt: timeFieldPatch(editStart),
      endAt: timeFieldPatch(editEnd),
    });
    setEditingEntry(null);
  }

  function confirmDelete(entry: ActivityLogEntry) {
    onDelete(entry.id);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{t('components.todayActivities.sectionLabel')}</Text>
        {entries.length > 0 && <Text style={styles.totalKcal}>🔥 {Math.round(totalKcal)} kcal</Text>}
      </View>

      {entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>{t('components.todayActivities.emptyText')}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {entries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View style={styles.entryMain}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {summaryLabel(e, t, language)}
                </Text>
                <Text style={styles.entryMeta}>
                  {timeRangeLabel(e, t)} · {Math.round(e.energyKcal)} kcal
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                onPress={() => startEdit(e)}
              >
                <Text style={styles.editText}>✎</Text>
              </Pressable>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                onPress={() => confirmDelete(e)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Edit modal — prefilled with the tapped entry, saved via updateActivity */}
      <Modal visible={editingEntry !== null} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('components.todayActivities.editTitle')}</Text>
            <View style={styles.chips}>
              {editingEntry && isCustomEntry(editingEntry) ? (
                // Custom activities have no MET_TABLE entry to re-pick from —
                // show a fixed, non-interactive chip instead of chip churn.
                <View style={[styles.chip, styles.chipActive]}>
                  <Text style={[styles.chipText, styles.chipTextActive]}>
                    {editingEntry.workouts[0]?.customName ?? t('activities.custom')}
                  </Text>
                </View>
              ) : (
                ACTIVITY_TYPES.map((actType) => (
                  <Pressable
                    key={actType}
                    onPress={() => setEditActivity(actType)}
                    style={({ pressed }) => [
                      styles.chip,
                      editActivity === actType && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, editActivity === actType && styles.chipTextActive]}>
                      {t(`activities.${actType}`)}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('components.todayActivities.minutesPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={editMinutes}
              onChangeText={setEditMinutes}
            />
            <TextInput
              style={styles.input}
              placeholder={t('components.todayActivities.stepsPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={editSteps}
              onChangeText={setEditSteps}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.todayActivities.fromTimePlaceholder')}
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={editStart}
                onChangeText={setEditStart}
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder={t('components.todayActivities.toTimePlaceholder')}
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={editEnd}
                onChangeText={setEditEnd}
              />
            </View>
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setEditingEntry(null)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.save, pressed && styles.pressed]}
                onPress={confirmEdit}
              >
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* S-PL: set-based entries reopen the Powerlifting sheet prefilled.
          key remounts the sheet per entry so its useState initializer
          re-reads the sets (no setState-in-effect). */}
      <PowerliftingSheet
        key={liftingEntry?.id ?? 'lifting-edit'}
        visible={liftingEntry !== null}
        onClose={() => setLiftingEntry(null)}
        editingEntry={liftingEntry}
        onSaveEdit={(id, workouts) => {
          onEdit(id, { workouts });
          setLiftingEntry(null);
        }}
      />

      {/* S-BB: set-based bodybuilding entries reopen the Bodybuilding sheet
          prefilled — same remount-by-key convention as PowerliftingSheet. */}
      <BodybuildingSheet
        key={bodybuildingEntry?.id ?? 'bodybuilding-edit'}
        visible={bodybuildingEntry !== null}
        onClose={() => setBodybuildingEntry(null)}
        editingEntry={bodybuildingEntry}
        onSaveEdit={(id, workouts) => {
          onEdit(id, { workouts });
          setBodybuildingEntry(null);
        }}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: { fontSize: 13, color: c.textTertiary },
  totalKcal: { fontSize: 15, fontWeight: '800', color: c.danger },
  card: {
    backgroundColor: c.bgHighlight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: c.textTertiary, fontSize: 13, lineHeight: 19 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryMain: { flex: 1 },
  entryName: { color: c.textBright, fontSize: 14, fontWeight: '500' },
  entryMeta: { color: c.textTertiary, fontSize: 12, marginTop: 1 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: c.infoAlt, fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.5 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  timeInput: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.danger, borderColor: c.danger },
  chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: c.textPrimary },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  save: { backgroundColor: c.infoAlt },
  saveText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
});

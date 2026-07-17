import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  bbEffectiveMet,
  estimateBbMinutes,
  bodybuildingSessionKcal,
} from '../domain/energy/bodybuildingEngine';
import { exercisesByMuscle, getBuiltInExercise } from '../lib/bodybuildingExercises';
import { BB_MET_TIER, BB_INTENSITY_FACTOR } from '../lib/metabolicConstants';
import type {
  ActivityLogEntry,
  BbIntensity,
  BbMetTier,
  CustomExercise,
  LiftingSet,
  MuscleGroup,
  WorkoutSession,
} from '../types/energy';
import { MUSCLE_GROUPS } from '../types/energy';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const BB_INTENSITIES: BbIntensity[] = ['light', 'moderate', 'superset'];
const BB_TIERS: BbMetTier[] = ['isolation', 'compound', 'big_compound'];

// Display name for a LOGGED bodybuilding session — a custom exercise's own
// snapshotted `bbName` takes priority (its library entry may since have been
// deleted), otherwise the built-in exercise's i18n label. Exported for
// TodayActivities/BatterySourceSheet, same convention as
// PowerliftingSheet.describeLiftingSets.
export function bbExerciseName(session: WorkoutSession, language: Language): string {
  if (session.bbName) return session.bbName;
  if (session.bbExerciseId) return translate(language, `bbExercises.${session.bbExerciseId}`);
  return translate(language, 'activities.bodybuilding');
}

// One editable set row. Kept as raw strings while typing (same convention as
// PowerliftingSheet) and parsed only on preview/confirm.
interface SetRowInput {
  weight: string;
  reps: string;
}

// One exercise added to the session being built. `name` is set ONLY for a
// custom exercise (its free-text name) — a built-in exercise's display name
// is always looked up live via i18n, never stored here.
interface AddedExercise {
  exerciseId: string;
  muscle: MuscleGroup;
  tier: BbMetTier;
  name?: string;
  intensity: BbIntensity;
  rows: SetRowInput[];
}

function setToRow(s: LiftingSet): SetRowInput {
  return { weight: String(s.weightKg), reps: String(s.reps) };
}

// Parse rows into sets, silently skipping incomplete rows (empty weight OR
// reps). Weight 0 is a valid bodyweight-only set. S-BB sets are always
// `kind: 'working'` — there is no warm-up/working split like S-PL.
function parseRows(rows: SetRowInput[]): LiftingSet[] {
  const sets: LiftingSet[] = [];
  for (const r of rows) {
    const weightKg = parseFloat(r.weight);
    const reps = parseFloat(r.reps);
    if (isNaN(weightKg) || weightKg < 0 || isNaN(reps) || reps <= 0) continue;
    sets.push({ kind: 'working', weightKg, reps: Math.round(reps) });
  }
  return sets;
}

// Reverse-derive which intensity a snapshotted `bbMet` came from, given the
// exercise's tier — bbMet = BB_MET_TIER[tier] × BB_INTENSITY_FACTOR[intensity]
// with no rounding at write time, so the closest-match is exact (the three
// factors are far enough apart that there's no real ambiguity). Needed for
// edit mode: WorkoutSession only stores the final effective MET, not which
// intensity produced it.
function deriveIntensity(tier: BbMetTier, bbMet: number): BbIntensity {
  const base = BB_MET_TIER[tier];
  let best: BbIntensity = 'moderate';
  let bestDiff = Infinity;
  for (const intensity of BB_INTENSITIES) {
    const diff = Math.abs(base * BB_INTENSITY_FACTOR[intensity] - bbMet);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = intensity;
    }
  }
  return best;
}

interface ExerciseMeta {
  muscle: MuscleGroup;
  tier: BbMetTier;
  name?: string;
}

// Looks up an exercise's muscle/tier from the built-in library first, then
// the user's custom exercises. Returns null if neither has it (e.g. a custom
// exercise the user has since deleted) — callers fall back to a reasonable
// default so a historical entry stays editable.
function resolveExercise(id: string, customExercises: CustomExercise[]): ExerciseMeta | null {
  const builtIn = getBuiltInExercise(id);
  if (builtIn) return { muscle: builtIn.muscle, tier: builtIn.tier };
  const custom = customExercises.find((c) => c.id === id);
  if (custom) return { muscle: custom.muscle, tier: custom.tier, name: custom.nameVi };
  return null;
}

// Prefill for edit mode — parents remount the sheet via `key` when the
// edited entry changes, so a plain useState initializer is enough (no
// setState-in-effect needed).
function exercisesFromEntry(
  entry: ActivityLogEntry | null | undefined,
  customExercises: CustomExercise[]
): AddedExercise[] {
  if (!entry) return [];
  const out: AddedExercise[] = [];
  for (const w of entry.workouts) {
    if (w.bbMet == null || !w.sets?.length || !w.bbExerciseId) continue;
    const meta = resolveExercise(w.bbExerciseId, customExercises);
    const muscle = w.bbMuscle ?? meta?.muscle ?? 'chest';
    // Prefer the snapshotted tier (present on every session logged after
    // bbTier was added) over a live library lookup — the lookup fails for a
    // custom exercise the user has since deleted, which would otherwise
    // guess a wrong tier and silently drift this historical session's kcal
    // if the user re-saves it (see AGENTS.md / QA note on this bug).
    const tier = w.bbTier ?? meta?.tier ?? 'compound';
    out.push({
      exerciseId: w.bbExerciseId,
      muscle,
      tier,
      name: w.bbName,
      intensity: deriveIntensity(tier, w.bbMet),
      rows: w.sets.map(setToRow),
    });
  }
  return out;
}

// Builds the actual WorkoutSession for one added exercise, or null if it has
// no valid sets yet (nothing typed, or only incomplete rows).
function buildSession(ex: AddedExercise): WorkoutSession | null {
  const sets = parseRows(ex.rows);
  if (sets.length === 0) return null;
  const bbMet = bbEffectiveMet(ex.tier, ex.intensity);
  const minutes = estimateBbMinutes(sets);
  return {
    type: 'bodybuilding',
    minutes,
    sets,
    bbExerciseId: ex.exerciseId,
    bbMuscle: ex.muscle,
    bbTier: ex.tier,
    bbMet,
    ...(ex.name ? { bbName: ex.name } : {}),
  };
}

function addedExerciseName(ex: AddedExercise, t: TFn): string {
  return ex.name ?? t(`bbExercises.${ex.exerciseId}`);
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

export function BodybuildingSheet({ visible, onClose, editingEntry, onSaveEdit }: Props) {
  const { t } = useT();
  const logActivity = useEnergyStore((s) => s.logActivity);
  const profile = useSettingsStore((s) => s.userProfile);
  const customExercises = useSettingsStore((s) => s.customExercises);
  const addCustomExercise = useSettingsStore((s) => s.addCustomExercise);
  const removeCustomExercise = useSettingsStore((s) => s.removeCustomExercise);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>('chest');
  const [addedExercises, setAddedExercises] = useState<AddedExercise[]>(() =>
    exercisesFromEntry(editingEntry, customExercises)
  );

  const [addingCustom, setAddingCustom] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState<MuscleGroup>('chest');
  const [newExerciseTier, setNewExerciseTier] = useState<BbMetTier>('isolation');

  const builtInsForMuscle = useMemo(() => exercisesByMuscle(selectedMuscle), [selectedMuscle]);
  const customsForMuscle = useMemo(
    () => customExercises.filter((c) => c.muscle === selectedMuscle),
    [customExercises, selectedMuscle]
  );

  const sessionsPreview = useMemo(
    () => addedExercises.map(buildSession).filter((s): s is WorkoutSession => s !== null),
    [addedExercises]
  );

  const preview = useMemo(() => {
    let kcal = 0;
    let minutes = 0;
    for (const s of sessionsPreview) {
      kcal += bodybuildingSessionKcal(s, profile.weightKg);
      minutes += s.minutes;
    }
    return { kcal, minutes };
  }, [sessionsPreview, profile.weightKg]);

  function isAdded(exerciseId: string) {
    return addedExercises.some((e) => e.exerciseId === exerciseId);
  }

  function addExercise(exerciseId: string, muscle: MuscleGroup, tier: BbMetTier, name?: string) {
    if (isAdded(exerciseId)) return;
    setAddedExercises([
      ...addedExercises,
      // Weight defaults to '0' (not blank) — a blank weight field parses the
      // same as an incomplete row (parseRows drops it silently), which would
      // otherwise make a bodyweight-only exercise (pull-up, dips, plank...)
      // vanish from the session the instant a user leaves the field empty,
      // the instinctive thing to do for "no added weight".
      { exerciseId, muscle, tier, name, intensity: 'moderate', rows: [{ weight: '0', reps: '' }] },
    ]);
  }

  function removeExercise(exerciseId: string) {
    setAddedExercises(addedExercises.filter((e) => e.exerciseId !== exerciseId));
  }

  function patchExercise(exerciseId: string, patch: Partial<AddedExercise>) {
    setAddedExercises(
      addedExercises.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e))
    );
  }

  function updateRow(exerciseId: string, rows: SetRowInput[], index: number, patch: Partial<SetRowInput>) {
    patchExercise(exerciseId, { rows: rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  function addRow(exerciseId: string, rows: SetRowInput[]) {
    const last = rows[rows.length - 1];
    // Same '0' default as addExercise — a blank weight silently drops the
    // row (see comment there); duplicating the previous row's weight (the
    // common case) already avoids that, this only covers the empty-rows edge
    // case (shouldn't normally happen since every exercise starts with one
    // row, but stays consistent if it ever does).
    patchExercise(exerciseId, { rows: [...rows, last ? { ...last } : { weight: '0', reps: '' }] });
  }

  function removeRow(exerciseId: string, rows: SetRowInput[], index: number) {
    patchExercise(exerciseId, { rows: rows.filter((_, i) => i !== index) });
  }

  function openAddCustom() {
    setNewExerciseName('');
    setNewExerciseMuscle(selectedMuscle);
    setNewExerciseTier('isolation');
    setAddingCustom(true);
  }

  function cancelAddCustom() {
    setAddingCustom(false);
    setNewExerciseName('');
  }

  function saveCustomExercise() {
    const name = newExerciseName.trim();
    if (!name) return;
    addCustomExercise({ nameVi: name, muscle: newExerciseMuscle, tier: newExerciseTier });
    // The store appends synchronously — read it fresh (not the stale closure
    // value from the hook above) to find the just-created exercise's id.
    const created = useSettingsStore.getState().customExercises.at(-1);
    setSelectedMuscle(newExerciseMuscle);
    if (created) addExercise(created.id, created.muscle, created.tier, created.nameVi);
    setAddingCustom(false);
    setNewExerciseName('');
  }

  function confirmDeleteCustom(c: CustomExercise) {
    Alert.alert(
      t('components.bodybuildingSheet.deleteCustomExerciseTitle'),
      t('components.bodybuildingSheet.deleteCustomExerciseMessage', { name: c.nameVi }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            removeCustomExercise(c.id);
            removeExercise(c.id);
          },
        },
      ]
    );
  }

  function confirm() {
    if (sessionsPreview.length === 0) return;
    if (editingEntry && onSaveEdit) {
      onSaveEdit(editingEntry.id, sessionsPreview);
    } else {
      logActivity({ steps: 0, workouts: sessionsPreview });
      setAddedExercises([]);
    }
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {t('components.bodybuildingSheet.titleNew')}
          {editingEntry ? t('components.bodybuildingSheet.titleEditSuffix') : ''}
        </Text>
        <Text style={styles.subtitle}>{t('components.bodybuildingSheet.subtitle')}</Text>

        <Text style={styles.sectionTitle}>{t('components.bodybuildingSheet.muscleSectionTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.muscleTabs}>
            {MUSCLE_GROUPS.map((m) => {
              const active = selectedMuscle === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setSelectedMuscle(m)}
                  style={({ pressed }) => [
                    styles.muscleTab,
                    active && styles.muscleTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.muscleTabText, active && styles.muscleTabTextActive]}>
                    {t(`muscleGroups.${m}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {addingCustom ? (
          <View style={styles.addCustomForm}>
            <Text style={styles.fieldLabel}>
              {t('components.bodybuildingSheet.customExerciseNameLabel')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('components.bodybuildingSheet.customExerciseNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
            />
            <Text style={styles.fieldLabel}>
              {t('components.bodybuildingSheet.customExerciseMuscleLabel')}
            </Text>
            <View style={styles.chips}>
              {MUSCLE_GROUPS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setNewExerciseMuscle(m)}
                  style={({ pressed }) => [
                    styles.chip,
                    newExerciseMuscle === m && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.chipText, newExerciseMuscle === m && styles.chipTextActive]}
                  >
                    {t(`muscleGroups.${m}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>
              {t('components.bodybuildingSheet.customExerciseTierLabel')}
            </Text>
            <View style={styles.chips}>
              {BB_TIERS.map((tier) => (
                <Pressable
                  key={tier}
                  onPress={() => setNewExerciseTier(tier)}
                  style={({ pressed }) => [
                    styles.chip,
                    newExerciseTier === tier && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, newExerciseTier === tier && styles.chipTextActive]}>
                    {t(`bbTiers.${tier}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={cancelAddCustom}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.confirm, pressed && styles.pressed]}
                onPress={saveCustomExercise}
              >
                <Text style={styles.btnText}>
                  {t('components.bodybuildingSheet.saveExerciseButton')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.hintText}>{t('components.bodybuildingSheet.addExerciseHint')}</Text>
            {builtInsForMuscle.length + customsForMuscle.length === 0 ? (
              <Text style={styles.emptySection}>
                {t('components.bodybuildingSheet.noExercisesInMuscle')}
              </Text>
            ) : (
              <View style={styles.chips}>
                {builtInsForMuscle.map((ex) => {
                  const added = isAdded(ex.id);
                  return (
                    <Pressable
                      key={ex.id}
                      onPress={() => addExercise(ex.id, ex.muscle, ex.tier)}
                      style={({ pressed }) => [
                        styles.chip,
                        added && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, added && styles.chipTextActive]}>
                        {added ? '✓ ' : ''}
                        {t(`bbExercises.${ex.id}`)}
                      </Text>
                    </Pressable>
                  );
                })}
                {customsForMuscle.map((c) => {
                  const added = isAdded(c.id);
                  return (
                    <View key={c.id} style={styles.customChipWrap}>
                      <Pressable
                        onPress={() => addExercise(c.id, c.muscle, c.tier, c.nameVi)}
                        style={({ pressed }) => [
                          styles.chip,
                          added && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.chipText, added && styles.chipTextActive]}>
                          {added ? '✓ ' : ''}
                          {c.nameVi}
                        </Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => confirmDeleteCustom(c)}
                        style={({ pressed }) => [styles.customChipDelete, pressed && styles.pressed]}
                      >
                        <Text style={styles.customChipDeleteText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.addCustomBtn, pressed && styles.pressed]}
              onPress={openAddCustom}
            >
              <Text style={styles.addCustomText}>
                {t('components.bodybuildingSheet.addCustomExerciseButton')}
              </Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>
          {t('components.bodybuildingSheet.selectedSectionTitle')}
        </Text>
        {addedExercises.length === 0 ? (
          <Text style={styles.emptySection}>{t('components.bodybuildingSheet.noExercisesYet')}</Text>
        ) : (
          addedExercises.map((ex) => (
            <View key={ex.exerciseId} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {addedExerciseName(ex, t)}
                </Text>
                <Pressable
                  hitSlop={10}
                  style={({ pressed }) => [styles.removeExerciseBtn, pressed && styles.pressed]}
                  onPress={() => removeExercise(ex.exerciseId)}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.intensityRow}>
                {BB_INTENSITIES.map((intensity) => (
                  <Pressable
                    key={intensity}
                    onPress={() => patchExercise(ex.exerciseId, { intensity })}
                    style={({ pressed }) => [
                      styles.intensityChip,
                      ex.intensity === intensity && styles.intensityChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.intensityChipText,
                        ex.intensity === intensity && styles.intensityChipTextActive,
                      ]}
                    >
                      {t(`bbIntensity.${intensity}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {ex.rows.map((row, i) => (
                <View key={`${ex.exerciseId}-${i}`} style={styles.setRow}>
                  <Text style={styles.setIndex}>{i + 1}</Text>
                  <TextInput
                    style={styles.setInput}
                    placeholder={t('components.bodybuildingSheet.weightPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={row.weight}
                    onChangeText={(v) => updateRow(ex.exerciseId, ex.rows, i, { weight: v })}
                  />
                  <Text style={styles.setUnit}>
                    {t('components.bodybuildingSheet.weightUnitLabel')}
                  </Text>
                  <TextInput
                    style={styles.setInput}
                    placeholder={t('components.bodybuildingSheet.repsPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    value={row.reps}
                    onChangeText={(v) => updateRow(ex.exerciseId, ex.rows, i, { reps: v })}
                  />
                  <Text style={styles.setUnit}>{t('components.bodybuildingSheet.repsUnitLabel')}</Text>
                  <Pressable
                    hitSlop={10}
                    style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                    onPress={() => removeRow(ex.exerciseId, ex.rows, i)}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => addRow(ex.exerciseId, ex.rows)}
              >
                <Text style={styles.addText}>{t('components.bodybuildingSheet.addSetButton')}</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.previewCard}>
          <Text style={styles.previewText}>
            {preview.kcal > 0
              ? t('components.bodybuildingSheet.previewSummary', {
                  kcal: preview.kcal,
                  minutes: preview.minutes,
                })
              : t('components.bodybuildingSheet.previewEmpty')}
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
            disabled={sessionsPreview.length === 0}
            style={({ pressed }) => [
              styles.modalBtn,
              styles.confirm,
              sessionsPreview.length === 0 && styles.confirmDisabled,
              pressed && styles.pressed,
            ]}
            onPress={confirm}
          >
            <Text style={styles.btnText}>
              {editingEntry ? t('common.save') : t('components.bodybuildingSheet.confirmNewButton')}
            </Text>
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textBright, marginTop: 4 },
  hintText: { fontSize: 12, color: colors.textTertiary, marginTop: -6 },
  muscleTabs: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  muscleTab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleTabActive: { backgroundColor: colors.accentAlt, borderColor: colors.accentAlt },
  muscleTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  muscleTabTextActive: { color: colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentAlt, borderColor: colors.accentAlt },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.textPrimary },
  customChipWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customChipDelete: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customChipDeleteText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  emptySection: { color: colors.textMuted, fontSize: 12 },
  addCustomBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentAlt,
    borderStyle: 'dashed',
  },
  addCustomText: { color: colors.accentAlt, fontSize: 12, fontWeight: '700' },
  addCustomForm: { gap: 10 },
  fieldLabel: { fontSize: 13, color: colors.textSecondary },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseCard: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseName: { flex: 1, color: colors.textBright, fontSize: 14, fontWeight: '700' },
  removeExerciseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  intensityChipActive: { backgroundColor: colors.mint, borderColor: colors.mint },
  intensityChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  intensityChipTextActive: { color: colors.bg },
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
  confirm: { backgroundColor: colors.accentAlt },
  confirmDisabled: { opacity: 0.5 },
  btnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

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
import {
  emptyMovement,
  findPrevSessionForMovement,
  movementSets,
  movementsFromEntry,
  movementsToWorkouts,
  nextMovementKey,
  parseSetRows,
  selectableVariationIds,
  setToRow,
  suggestNextVariationId,
  variationIdentity,
} from '../domain/energy/liftingMovements';
import type { MovementDraft, SetRowInput } from '../domain/energy/liftingMovements';
import { getActivityLogInRange } from '../data/repositories/activityLogRepository';
import { liftingMovementLabel } from '../lib/activityLabels';
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
// shown under each movement.
const HISTORY_LOOKBACK_DAYS = 60;

type SectionKind = 'warmup' | 'working';

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
  sets: LiftingSet[];
}

// Latest logged session of this movement (same lift + same variation, else
// the plain lift — see findPrevSessionForMovement), excluding the entry being
// edited.
function prevInfoFor(
  history: ActivityLogEntry[],
  movement: MovementDraft,
  language: Language,
  excludeId?: string
): PrevSessionInfo | null {
  const match = findPrevSessionForMovement(history, movement, excludeId);
  if (!match?.workout.sets) return null;
  const when = match.entry.startAt ?? match.entry.timestamp;
  return {
    dateLabel: formatDMY(dateString(new Date(when))),
    summary: describeLiftingSets(match.workout.sets, language),
    e1rm: bestOneRepMax(match.workout.sets),
    sets: match.workout.sets,
  };
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

  // Lazy initializers: the prefill runs once per mount (parents remount via
  // `key` when the edited entry changes). Starts on the first movement's lift
  // so editing a bench-only entry doesn't open on an empty squat tab.
  const [initial] = useState(() => movementsFromEntry(editingEntry));
  const [exercise, setExercise] = useState<LiftingExercise>(initial[0].exercise);
  const [movements, setMovements] = useState<MovementDraft[]>(initial);
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

  const setsByKey = useMemo(() => {
    const out: Record<string, LiftingSet[]> = {};
    for (const m of movements) out[m.key] = movementSets(m);
    return out;
  }, [movements]);

  // Tab badge: total sets of the lift across all its movements.
  const countByExercise = useMemo(() => {
    const out: Record<LiftingExercise, number> = { squat: 0, bench_press: 0, deadlift: 0 };
    for (const m of movements) out[m.exercise] += setsByKey[m.key].length;
    return out;
  }, [movements, setsByKey]);

  const preview = useMemo(() => {
    let kcal = 0;
    let minutes = 0;
    for (const m of movements) {
      const sets = setsByKey[m.key];
      if (sets.length === 0) continue;
      kcal += liftingSessionKcal(m.exercise, sets, profile.weightKg, profile.heightCm);
      minutes += estimateLiftingMinutes(sets);
    }
    return { kcal, minutes };
  }, [movements, setsByKey, profile.weightKg, profile.heightCm]);

  const visibleMovements = movements.filter((m) => m.exercise === exercise);

  function patchMovement(key: string, patch: Partial<MovementDraft>) {
    setMovements((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  function patchSection(key: string, kind: SectionKind, next: SetRowInput[]) {
    patchMovement(key, kind === 'warmup' ? { warmup: next } : { working: next });
  }

  function selectExercise(ex: LiftingExercise) {
    setExercise(ex);
    // Every visible tab needs at least one movement card to type into.
    setMovements((prev) =>
      prev.some((m) => m.exercise === ex) ? prev : [...prev, emptyMovement(ex, nextMovementKey(prev))]
    );
  }

  function addMovement() {
    setMovements((prev) => [
      ...prev,
      {
        ...emptyMovement(exercise, nextMovementKey(prev)),
        variationId: suggestNextVariationId(exercise, prev),
      },
    ]);
  }

  function removeMovement(key: string) {
    setMovements((prev) => prev.filter((m) => m.key !== key));
  }

  function updateRow(m: MovementDraft, kind: SectionKind, index: number, patch: Partial<SetRowInput>) {
    patchSection(
      m.key,
      kind,
      m[kind].map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function addRow(m: MovementDraft, kind: SectionKind) {
    const section = m[kind];
    // Duplicate the last row — the common case is "same weight, same reps,
    // next set" (straight sets).
    const last = section[section.length - 1];
    patchSection(m.key, kind, [...section, last ? { ...last } : { weight: '', reps: '' }]);
  }

  function removeRow(m: MovementDraft, kind: SectionKind, index: number) {
    patchSection(
      m.key,
      kind,
      m[kind].filter((_, i) => i !== index)
    );
  }

  // Load the previous session's warm-up + working sets as a starting point
  // for today — most sessions only need a small weight/rep tweak, not a
  // full re-entry. Explicit tap, one movement only, so it never pulls in an
  // exercise the user isn't training today.
  function applyTemplate(m: MovementDraft, prev: PrevSessionInfo) {
    patchMovement(m.key, {
      warmup: prev.sets.filter((s) => s.kind === 'warmup').map(setToRow),
      working: prev.sets.filter((s) => s.kind === 'working').map(setToRow),
    });
  }

  // Fill the warm-up section with the standard ramp toward the first working
  // set's weight (bar ×10 → 50%×6 → 70%×4 → 85%×2).
  function suggestWarmup(m: MovementDraft) {
    const firstWorking = parseSetRows(m.working, 'working')[0];
    if (!firstWorking || firstWorking.weightKg <= 0) return;
    patchSection(m.key, 'warmup', warmupRamp(firstWorking.weightKg).map(setToRow));
  }

  function confirm() {
    const workouts = movementsToWorkouts(movements);
    if (workouts.length === 0) return;
    if (editingEntry && onSaveEdit) {
      onSaveEdit(editingEntry.id, workouts);
    } else {
      logActivity({ steps: 0, workouts });
      setMovements([emptyMovement(exercise, 'm0')]);
    }
    onClose();
  }

  // Display name of a movement: its variation when set, else the plain lift.
  function movementName(m: MovementDraft): string {
    return liftingMovementLabel(
      { type: m.exercise, minutes: 0, variationId: m.variationId, variationName: m.variationName?.trim() },
      language
    );
  }

  function renderVariationPicker(m: MovementDraft) {
    const custom = m.variationName !== undefined;
    const standardActive = !custom && variationIdentity(m) === '';
    const chips: { id: string | null; label: string; active: boolean; onPress: () => void }[] = [
      {
        id: null,
        label: t('components.powerliftingSheet.variationStandard'),
        active: standardActive,
        onPress: () => patchMovement(m.key, { variationId: undefined, variationName: undefined }),
      },
      ...selectableVariationIds(m.exercise).map((id) => ({
        id,
        label: t(`blockVariations.${id}.label`),
        active: !custom && m.variationId === id,
        onPress: () => patchMovement(m.key, { variationId: id, variationName: undefined }),
      })),
      {
        id: '__custom',
        label: t('components.powerliftingSheet.customVariationChip'),
        active: custom,
        onPress: () => patchMovement(m.key, { variationId: undefined, variationName: m.variationName ?? '' }),
      },
    ];
    return (
      <View style={styles.variationBlock}>
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <Pressable
              key={chip.id ?? '__standard'}
              onPress={chip.onPress}
              style={({ pressed }) => [styles.chip, chip.active && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, chip.active && styles.chipTextActive]}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
        {custom && (
          <TextInput
            style={styles.variationInput}
            placeholder={t('components.powerliftingSheet.customVariationPlaceholder')}
            placeholderTextColor={c.textMuted}
            accessibilityLabel={t('components.powerliftingSheet.customVariationPlaceholder')}
            maxLength={40}
            value={m.variationName ?? ''}
            onChangeText={(v) => patchMovement(m.key, { variationName: v })}
          />
        )}
      </View>
    );
  }

  function renderSection(m: MovementDraft, kind: SectionKind, title: string) {
    const section = m[kind];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {kind === 'warmup' && (
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
              onPress={() => suggestWarmup(m)}
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
              onChangeText={(v) => updateRow(m, kind, i, { weight: v })}
            />
            <Text style={styles.setUnit}>{t('components.powerliftingSheet.weightUnitLabel')}</Text>
            <TextInput
              style={styles.setInput}
              placeholder={t('components.powerliftingSheet.repsPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              value={row.reps}
              onChangeText={(v) => updateRow(m, kind, i, { reps: v })}
            />
            <Text style={styles.setUnit}>{t('components.powerliftingSheet.repsUnitLabel')}</Text>
            <Pressable
              hitSlop={10}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              onPress={() => removeRow(m, kind, i)}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => addRow(m, kind)}
        >
          <Text style={styles.addText}>{t('components.powerliftingSheet.addSetButton')}</Text>
        </Pressable>
      </View>
    );
  }

  function renderMovement(m: MovementDraft) {
    // Previous-session reference for THIS movement — progressive-overload cue.
    const prev = prevInfoFor(history, m, language, editingEntry?.id);
    const e1rm = bestOneRepMax(setsByKey[m.key]);
    return (
      <View key={m.key} style={styles.movementCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('components.powerliftingSheet.variationSectionTitle')}</Text>
          {visibleMovements.length > 1 && (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('components.powerliftingSheet.removeMovement')}
              style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
              onPress={() => removeMovement(m.key)}
            >
              <Text style={styles.removeText}>✕ {t('components.powerliftingSheet.removeMovement')}</Text>
            </Pressable>
          )}
        </View>
        {renderVariationPicker(m)}

        <View style={styles.prevCard}>
          {prev ? (
            <View style={styles.prevRow}>
              <Text style={[styles.prevText, styles.prevTextFlex]}>
                {t('components.powerliftingSheet.prevSessionLine', {
                  date: prev.dateLabel,
                  summary: prev.summary,
                })}
                {prev.e1rm > 0
                  ? t('components.powerliftingSheet.prevSessionE1rmSuffix', { value: prev.e1rm })
                  : ''}
              </Text>
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
                onPress={() => applyTemplate(m, prev)}
              >
                <Text style={styles.suggestText}>
                  {t('components.powerliftingSheet.useTemplateButton')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.prevText}>
              {t('components.powerliftingSheet.noPrevSession', {
                exercise: movementName(m),
                days: HISTORY_LOOKBACK_DAYS,
              })}
            </Text>
          )}
        </View>

        {renderSection(m, 'warmup', t('components.powerliftingSheet.warmupSectionTitle'))}
        {renderSection(m, 'working', t('components.powerliftingSheet.workingSectionTitle'))}

        {e1rm > 0 && (
          <Text style={styles.e1rmText}>
            {t('components.powerliftingSheet.e1rmToday', {
              exercise: movementName(m),
              value: e1rm,
            })}
          </Text>
        )}
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
            const count = countByExercise[ex];
            const active = exercise === ex;
            return (
              <Pressable
                key={ex}
                onPress={() => selectExercise(ex)}
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

        {visibleMovements.map(renderMovement)}

        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={addMovement}
        >
          <Text style={styles.addText}>{t('components.powerliftingSheet.addVariation')}</Text>
        </Pressable>

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
  prevRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prevTextFlex: { flex: 1 },
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
  movementCard: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  variationBlock: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.danger, borderColor: c.danger },
  chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: c.textPrimary },
  variationInput: {
    backgroundColor: c.bgElevated,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 14,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  pressed: { opacity: 0.6 },
});

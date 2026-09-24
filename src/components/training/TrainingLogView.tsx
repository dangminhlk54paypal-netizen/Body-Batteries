import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TrainingLogPeriodSection } from './TrainingLogPeriodSection';
import { TrainingLogLineEditor } from './TrainingLogLineEditor';
import { TrainingLogTextSheet } from './TrainingLogTextSheet';
import { TrainingLogFormatSheet } from './TrainingLogFormatSheet';
import { TrainingLogPageSheet } from './TrainingLogPageSheet';
import { TrainingProgressChart } from './TrainingProgressChart';
import { PowerliftingSheet } from '../PowerliftingSheet';
import { BodybuildingSheet } from '../BodybuildingSheet';
import type { TrainingLogActions } from './trainingLogActions';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { useBlockStore } from '../../store/blockStore';
import { useEnergyStore } from '../../store/energyStore';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { getTrainingLogWeek } from '../../data/repositories/trainingLogRepository';
import { isBodybuildingEntry } from '../../lib/activityLabels';
import { mergeEditedWorkouts } from '../../domain/training/entryEdit';
import { formatDayDate, formatDefaultFreeTitle, formatPeriodTitle } from '../../domain/training/trainingLogFormatter';
import { todayString } from '../../lib/dateUtils';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import type { TrainingLogPeriod } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

// Module-level wrapper so the impure clock read stays out of the component body.
function getTodayString(): string {
  return todayString();
}

// Each sheet's `key` bumps on every opening so its fields start fresh (the
// sheets read their initial values once, on mount); `visible` toggles
// separately so the slide-down animation still plays on close.
interface EditorState {
  key: number;
  visible: boolean;
  mode: 'add' | 'edit';
  date: string;
}
interface TextSheetState {
  key: number;
  visible: boolean;
  kind: 'week' | 'block' | 'month';
  id: string; // week start (Monday), block id, or free month (YYYY-MM)
  title: string;
  hint?: string;
  placeholder: string;
  initialValue: string;
  multiline: boolean;
}
interface PageState {
  key: number;
  visible: boolean;
  period: TrainingLogPeriod;
}
interface EntryEditState {
  kind: 'lifting' | 'bodybuilding';
  entry: ActivityLogEntry;
  visible: boolean;
}

// The "Sổ tập" mode of the Tập luyện tab: the workouts logged in Xả (plus what
// the user wrote by hand) laid out like their Notes — block → week → day, all
// collapsed except the newest, so a long history stays short to scroll. This
// component owns every sheet; the rows below only report taps (see
// trainingLogActions.ts).
export function TrainingLogView() {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const format = useTrainingLogFormat();
  const periods = useTrainingLogStore((s) => s.periods);
  const loaded = useTrainingLogStore((s) => s.loaded);
  const loadIndex = useTrainingLogStore((s) => s.loadIndex);
  const saveWeekNote = useTrainingLogStore((s) => s.saveWeekNote);
  const renameBlock = useBlockStore((s) => s.renameBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);
  const renameMonth = useTrainingLogStore((s) => s.renameMonth);
  const updateActivityForPastDate = useEnergyStore((s) => s.updateActivityForPastDate);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [textSheet, setTextSheet] = useState<TextSheetState | null>(null);
  const [entryEdit, setEntryEdit] = useState<EntryEditState | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [page, setPage] = useState<PageState | null>(null);

  // Bottom-tab screens stay mounted, so a one-shot mount effect would miss a
  // workout logged in Xả since — reload the index whenever the tab is focused
  // (also bumps the store's revision, which reloads any week already open).
  useFocusEffect(
    useCallback(() => {
      loadIndex();
    }, [loadIndex])
  );

  function openEditor(mode: 'add' | 'edit', date: string) {
    setEditor((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, mode, date }));
  }

  function openTextSheet(sheet: Omit<TextSheetState, 'key' | 'visible'>) {
    setTextSheet((prev) => ({ ...sheet, key: (prev?.key ?? 0) + 1, visible: true }));
  }

  const actions: TrainingLogActions = {
    openPage: (period) => setPage((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, period })),
    editDay: (date) => openEditor('edit', date),
    addDay: (suggestedDate) => openEditor('add', suggestedDate),
    editWeekNote: async (weekStart, label) => {
      const existing = await getTrainingLogWeek(weekStart);
      openTextSheet({
        kind: 'week',
        id: weekStart,
        title: t('trainingLog.textSheet.weekNoteTitle', { label }),
        placeholder: t('trainingLog.textSheet.weekNotePlaceholder'),
        initialValue: existing?.note ?? '',
        multiline: true,
      });
    },
    periodMenu: (period) => {
      if (period.kind === 'free') {
        if (!period.monthKey) return;
        openTextSheet({
          kind: 'month',
          id: period.monthKey,
          title: t('trainingLog.textSheet.monthNameTitle'),
          hint: t('trainingLog.textSheet.monthNameHint', { title: formatDefaultFreeTitle(period, language) }),
          placeholder: t('trainingLog.textSheet.monthNamePlaceholder'),
          initialValue: period.monthName ?? '',
          multiline: false,
        });
        return;
      }
      const blockId = period.blockId;
      if (!blockId) return;
      Alert.alert(formatPeriodTitle(period, language), undefined, [
        {
          text: t('trainingLog.blockMenu.rename'),
          onPress: () =>
            openTextSheet({
              kind: 'block',
              id: blockId,
              title: t('trainingLog.textSheet.blockNameTitle'),
              hint: t('trainingLog.textSheet.blockNameHint', { n: period.blockNumber ?? 0 }),
              placeholder: t('trainingLog.textSheet.blockNamePlaceholder'),
              initialValue: period.blockName ?? '',
              multiline: false,
            }),
        },
        { text: t('trainingLog.blockMenu.delete'), style: 'destructive', onPress: () => confirmDeleteBlock(period, blockId) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
  };

  // Deletes the block PLAN only: the days logged in it stay and fall back into
  // their free months (the index places them by date).
  function confirmDeleteBlock(period: TrainingLogPeriod, blockId: string) {
    Alert.alert(
      t('trainingLog.blockMenu.deleteConfirmTitle', { title: formatPeriodTitle(period, language) }),
      t('trainingLog.blockMenu.deleteConfirmMessage', {
        start: formatDayDate(period.startDate, language),
        end: formatDayDate(period.endDate, language),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteBlock(blockId);
            await loadIndex();
          },
        },
      ]
    );
  }

  async function saveTextSheet(sheet: TextSheetState, text: string) {
    if (sheet.kind === 'week') {
      await saveWeekNote(sheet.id, text);
    } else if (sheet.kind === 'month') {
      await renameMonth(sheet.id, text); // reloads the index itself
    } else {
      await renameBlock(sheet.id, text);
      await loadIndex(); // block names come from the index
    }
  }

  // "Sửa số liệu": recalculates through the energy store, keeping whatever the
  // sheet does not manage (see mergeEditedWorkouts).
  async function saveEntryEdit(edit: EntryEditState, edited: WorkoutSession[]) {
    await updateActivityForPastDate(edit.entry, {
      workouts: mergeEditedWorkouts(edit.entry, edit.kind, edited),
    });
    await loadIndex(); // reload any open week and the session counts
  }

  if (!loaded) return <ActivityIndicator color={c.textPrimary} style={styles.loading} />;

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('trainingLog.title')}</Text>
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('trainingLog.formatButtonLabel')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={() => setFormatOpen(true)}
          >
            <Text style={styles.iconText}>⚙︎</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => openEditor('add', getTodayString())}
        >
          <Text style={styles.addText}>{t('trainingLog.addEntryButton')}</Text>
        </Pressable>

        {periods.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('trainingLog.emptyState')}</Text>
          </View>
        ) : (
          <View style={styles.page}>
            {periods.map((period, i) => (
              <TrainingLogPeriodSection
                key={period.key}
                period={period}
                format={format}
                isLatest={i === 0}
                actions={actions}
              />
            ))}
          </View>
        )}

        {/* Right under the notebook: weekly top sets + ratio to body weight. */}
        {periods.length > 0 && <TrainingProgressChart format={format} />}
      </ScrollView>

      {editor && (
        <TrainingLogLineEditor
          key={`editor-${editor.key}`}
          visible={editor.visible}
          mode={editor.mode}
          initialDate={editor.date}
          onClose={() => setEditor((e) => (e ? { ...e, visible: false } : e))}
          onEditEntry={(entry) => {
            setEditor((e) => (e ? { ...e, visible: false } : e));
            // Bodybuilding first: an S-BB session also carries `sets`.
            setEntryEdit({ kind: isBodybuildingEntry(entry) ? 'bodybuilding' : 'lifting', entry, visible: true });
          }}
        />
      )}

      {textSheet && (
        <TrainingLogTextSheet
          key={`text-${textSheet.key}`}
          visible={textSheet.visible}
          title={textSheet.title}
          hint={textSheet.hint}
          placeholder={textSheet.placeholder}
          initialValue={textSheet.initialValue}
          multiline={textSheet.multiline}
          maxLength={textSheet.multiline ? undefined : 40}
          onSave={(text) => saveTextSheet(textSheet, text)}
          onClose={() => setTextSheet((s) => (s ? { ...s, visible: false } : s))}
        />
      )}

      {entryEdit && entryEdit.kind === 'lifting' && (
        <PowerliftingSheet
          key={entryEdit.entry.id}
          visible={entryEdit.visible}
          editingEntry={entryEdit.entry}
          onSaveEdit={(_id, workouts) => saveEntryEdit(entryEdit, workouts)}
          onClose={() => setEntryEdit((e) => (e ? { ...e, visible: false } : e))}
        />
      )}
      {entryEdit && entryEdit.kind === 'bodybuilding' && (
        <BodybuildingSheet
          key={entryEdit.entry.id}
          visible={entryEdit.visible}
          editingEntry={entryEdit.entry}
          onSaveEdit={(_id, workouts) => saveEntryEdit(entryEdit, workouts)}
          onClose={() => setEntryEdit((e) => (e ? { ...e, visible: false } : e))}
        />
      )}

      {page && (
        <TrainingLogPageSheet
          key={`page-${page.key}`}
          visible={page.visible}
          // The live copy: an edit made from the page can rename the block or
          // add days, and the page should show the index as it is now.
          period={periods.find((p) => p.key === page.period.key) ?? page.period}
          format={format}
          onClose={() => setPage((p) => (p ? { ...p, visible: false } : p))}
        />
      )}

      <TrainingLogFormatSheet visible={formatOpen} onClose={() => setFormatOpen(false)} />
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    loading: { marginTop: 40 },
    scroll: { padding: 24, paddingTop: 12, gap: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
    },
    iconText: { color: c.textSecondary, fontSize: 18 },
    addBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    addText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    // The notebook page: no card per day, just text on one sheet.
    page: { backgroundColor: c.bgCard, borderRadius: 16, padding: 16 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    pressed: { opacity: 0.6 },
  });

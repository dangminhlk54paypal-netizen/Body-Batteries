import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { useEnergyStore } from '../../store/energyStore';
import { backfillTimestamp, planDaySync } from '../../domain/training/trainingLogDaySync';
import { saveLineAsXa } from '../../services/training/trainingLogPageSync';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { getActivityLogForDate } from '../../data/repositories/activityLogRepository';
import { getTrainingLogDay } from '../../data/repositories/trainingLogRepository';
import {
  formatDayLine,
  formatMovement,
  trainingDaySignature,
} from '../../domain/training/trainingLogFormatter';
import { formatDayMonthInput, parseDayMonthInput } from '../../lib/dateInput';
import { isBodybuildingEntry, isLiftingEntry } from '../../lib/activityLabels';
import { daysAgo, todayString } from '../../lib/dateUtils';
import { TRAINING_LOG_MAX_DAYS_BACK } from '../../lib/constants';
import { LOCALE_TAGS } from '../../i18n/types';
import type { ActivityLogEntry } from '../../types/energy';
import type { TrainingLogDayRecord } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  // 'add' = "＋ Ghi buổi" (the date is typed); 'edit' = a tapped day (date fixed).
  mode: 'add' | 'edit';
  initialDate: string; // YYYY-MM-DD
  // "Sửa số liệu": the parent closes this sheet and opens the lifting /
  // bodybuilding sheet for the entry.
  onEditEntry: (entry: ActivityLogEntry) => void;
}

interface DayData {
  date: string;
  entries: ActivityLogEntry[];
  record: TrainingLogDayRecord | null;
}

// Module-level wrappers so the impure clock reads stay out of the component
// body (react-hooks/purity) — same trick as EnergyActionsBar.getTodayString.
function getTodayString(): string {
  return todayString();
}
function getEarliestDate(): string {
  return daysAgo(TRAINING_LOG_MAX_DAYS_BACK);
}

// Adds a hand-written entry (a workout the user forgot to Xả) or edits one
// day's line and note. On a day WITHOUT Xả, a line that reads fully as lifts
// and sets becomes a real Xả session of that day (kcal & batteries — the
// "⚡ Tạo buổi Xả" switch, on by default, with a preview); anything else stays
// notebook text. On a day WITH Xả, edits here only change text; changing its
// numbers goes through "Sửa số liệu" (the lifting/bodybuilding sheet).
// The parent remounts this sheet (via `key`) for every opening, so its fields
// always start fresh.
export function TrainingLogLineEditor({ visible, onClose, mode, initialDate, onEditEntry }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const format = useTrainingLogFormat();
  const revision = useTrainingLogStore((s) => s.revision);
  const saveManualDay = useTrainingLogStore((s) => s.saveManualDay);
  const saveDayOverride = useTrainingLogStore((s) => s.saveDayOverride);
  const clearDayOverride = useTrainingLogStore((s) => s.clearDayOverride);
  const saveDayNote = useTrainingLogStore((s) => s.saveDayNote);
  const deleteDay = useTrainingLogStore((s) => s.deleteDay);
  const findPreviousDayBody = useTrainingLogStore((s) => s.findPreviousDayBody);
  const writeNotebook = useTrainingLogStore((s) => s.writeNotebook);
  const logActivityForPastDate = useEnergyStore((s) => s.logActivityForPastDate);
  const [createXa, setCreateXa] = useState(true);

  // English reads dates month-first, everything else day-first — the same
  // order the log itself prints them in.
  const order = language === 'en' ? 'md' : 'dm';
  const [dateText, setDateText] = useState(() => formatDayMonthInput(initialDate, order));
  // `null` = the user has not typed yet, so the field shows what the day already
  // holds (derived below) instead of copying it into state from an effect.
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DayData | null>(null);

  const bounds = useMemo(() => ({ today: getTodayString(), earliest: getEarliestDate() }), []);

  const date = mode === 'edit' ? initialDate : parseDayMonthInput(dateText, bounds.today, order);
  const dateError =
    mode === 'edit'
      ? null
      : date == null
        ? t('trainingLog.editor.dateInvalid')
        : date < bounds.earliest
          ? t('components.pastDateField.errorTooOld', { max: TRAINING_LOG_MAX_DAYS_BACK })
          : null;
  const validDate = dateError == null ? date : null;

  useEffect(() => {
    if (!visible || !validDate) return;
    let cancelled = false;
    Promise.all([getActivityLogForDate(validDate), getTrainingLogDay(validDate)]).then(
      ([entries, record]) => {
        if (!cancelled) setData({ date: validDate, entries, record });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [visible, validDate, revision]);

  const ready = data != null && data.date === validDate;
  const entries = useMemo(() => (ready ? data.entries.filter((e) => e.workouts.length > 0) : []), [ready, data]);
  const record = ready ? data.record : null;
  const hasEntries = entries.length > 0;

  const autoBody = useMemo(
    () =>
      validDate && hasEntries
        ? formatDayLine({ date: validDate, entries, bodyWeightKg: null, format, language }).body
        : '',
    [validDate, hasEntries, entries, format, language]
  );
  const initialBody = record?.overrideText ?? autoBody;
  const body = bodyEdit ?? initialBody;
  const note = noteEdit ?? record?.note ?? '';
  const signature = useMemo(() => trainingDaySignature(entries), [entries]);
  // A day without Xả: what the line would become (a session, or text only).
  const backfill = useMemo(
    () =>
      ready && validDate && !hasEntries
        ? planDaySync({ date: validDate, entries: [], newBody: body, format, language })
        : null,
    [ready, validDate, hasEntries, body, format, language]
  );
  const willCreate = createXa && backfill?.kind === 'create';

  const bodyBlank = body.trim() === '';
  const noteBlank = note.trim() === '';
  const canSave = ready && validDate != null && !saving && (!bodyBlank || !noteBlank || record != null);
  // "The day already has content" in add mode: the sheet is really editing it.
  const addingOntoExisting = mode === 'add' && ready && (hasEntries || record != null);

  async function save() {
    if (!validDate || !ready) return;
    setSaving(true);
    try {
      if (willCreate && backfill?.kind === 'create') {
        await saveLineAsXa(
          { date: validDate, plan: backfill, note },
          {
            createEntry: (d, workouts) => logActivityForPastDate({ workouts }, backfillTimestamp(d, Date.now())),
            writeNotebook,
          }
        );
      } else if (!hasEntries) {
        // A hand-written line (new, or an existing one — a line whose Xả entries
        // are gone reads as hand-written too).
        if (bodyBlank && noteBlank) await deleteDay(validDate);
        else await saveManualDay(validDate, body, note);
      } else {
        const changed = body.trim() !== initialBody.trim();
        const isAuto = bodyBlank || body.trim() === autoBody.trim();
        if (isAuto) {
          // Blank or identical to the automatic line = no override needed.
          if (record?.overrideText != null) await clearDayOverride(validDate);
        } else if (changed) {
          await saveDayOverride(validDate, body, signature);
        }
        if (note.trim() !== (record?.note ?? '').trim()) await saveDayNote(validDate, note);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function copyLatest() {
    if (!validDate) return;
    const previous = await findPreviousDayBody(validDate);
    if (previous) {
      setBodyEdit(previous);
      setCopyMessage(null);
    } else {
      setCopyMessage(t('trainingLog.editor.copyNone'));
    }
  }

  function confirmRestore() {
    if (!validDate) return;
    Alert.alert(t('trainingLog.useAutoConfirmTitle'), t('trainingLog.useAutoConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('trainingLog.editor.restoreAuto'),
        style: 'destructive',
        onPress: async () => {
          await clearDayOverride(validDate);
          onClose();
        },
      },
    ]);
  }

  function confirmDelete() {
    if (!validDate) return;
    Alert.alert(t('trainingLog.editor.deleteConfirmTitle'), t('trainingLog.editor.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteDay(validDate);
          onClose();
        },
      },
    ]);
  }

  const dateLabel = validDate
    ? new Date(validDate + 'T00:00:00').toLocaleDateString(LOCALE_TAGS[language], {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {mode === 'add'
            ? t('trainingLog.editor.titleAdd')
            : t('trainingLog.editor.titleEdit', { date: dateLabel ?? '' })}
        </Text>

        {mode === 'add' && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('trainingLog.editor.dateLabel')}</Text>
            <TextInput
              style={[styles.input, dateError != null && styles.inputError]}
              placeholder={t('trainingLog.editor.datePlaceholder')}
              placeholderTextColor={c.textMuted}
              // A number keyboard with . , / - (decimal-pad has no slash).
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={dateText}
              onChangeText={setDateText}
            />
            {dateError ? <Text style={styles.errorText}>{dateError}</Text> : <Text style={styles.hint}>{dateLabel}</Text>}
          </View>
        )}

        {!ready ? (
          validDate ? <ActivityIndicator color={c.textMuted} /> : null
        ) : (
          <>
            {addingOntoExisting && <Text style={styles.notice}>{t('trainingLog.editor.dayHasContent')}</Text>}

            <View style={styles.field}>
              <Text style={styles.label}>{t('trainingLog.editor.lineLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('trainingLog.editor.linePlaceholder')}
                placeholderTextColor={c.textMuted}
                accessibilityLabel={t('trainingLog.editor.lineLabel')}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                value={body}
                onChangeText={setBodyEdit}
              />
              {!hasEntries && (
                <View style={styles.rowWrap}>
                  <Pressable style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]} onPress={copyLatest}>
                    <Text style={styles.chipBtnText}>{t('trainingLog.editor.copyLatest')}</Text>
                  </Pressable>
                </View>
              )}
              {copyMessage ? <Text style={styles.hint}>{copyMessage}</Text> : null}
              {hasEntries && body.trim() !== autoBody.trim() && (
                <View style={styles.autoBox}>
                  <Text style={styles.hint}>{t('trainingLog.editor.autoNow')}</Text>
                  <Text selectable style={styles.autoText}>
                    {autoBody}
                  </Text>
                  <Pressable style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]} onPress={() => setBodyEdit(autoBody)}>
                    <Text style={styles.chipBtnText}>{t('trainingLog.editor.useAutoText')}</Text>
                  </Pressable>
                </View>
              )}
              {backfill?.kind === 'create' && (
                <View style={styles.autoBox}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{t('trainingLog.editor.createXaLabel')}</Text>
                    <Switch
                      value={createXa}
                      onValueChange={setCreateXa}
                      accessibilityLabel={t('trainingLog.editor.createXaLabel')}
                    />
                  </View>
                  {createXa && (
                    <>
                      <Text style={styles.hint}>{t('trainingLog.editor.createXaPreview')}</Text>
                      {backfill.workouts.map((w, i) => (
                        <Text key={i} style={styles.autoText}>
                          • {formatMovement(w, format, language)}
                        </Text>
                      ))}
                    </>
                  )}
                </View>
              )}
              {backfill?.kind === 'manual' && backfill.unparsed.length > 0 && (
                <Text style={styles.notice}>
                  {t('trainingLog.editor.createXaUnparsed', { detail: backfill.unparsed.join(' · ') })}
                </Text>
              )}
              <Text style={styles.hint}>
                {hasEntries
                  ? t('trainingLog.editor.editHint')
                  : willCreate
                    ? t('trainingLog.editor.createXaHint')
                    : t('trainingLog.editor.manualHint')}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('trainingLog.editor.noteLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('trainingLog.editor.notePlaceholder')}
                placeholderTextColor={c.textMuted}
                accessibilityLabel={t('trainingLog.editor.noteLabel')}
                multiline
                value={note}
                onChangeText={setNoteEdit}
              />
            </View>

            {hasEntries && (
              <View style={styles.field}>
                <Text style={styles.label}>{t('trainingLog.editor.sessionsTitle')}</Text>
                {entries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text selectable style={styles.entryText}>
                      {entry.workouts.map((w) => formatMovement(w, format, language)).join(' ')}
                    </Text>
                    {/* Bodybuilding first: an S-BB session also carries `sets` (see activityLabels). */}
                    {isBodybuildingEntry(entry) || isLiftingEntry(entry) ? (
                      <Pressable
                        style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]}
                        onPress={() => onEditEntry(entry)}
                      >
                        <Text style={styles.chipBtnText}>{t('trainingLog.editor.editData')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {entries.some((e) => !isBodybuildingEntry(e) && !isLiftingEntry(e)) && (
                  <Text style={styles.hint}>{t('trainingLog.editor.minutesOnlyHint')}</Text>
                )}
              </View>
            )}

            {record && (
              <View style={styles.dangerRow}>
                {hasEntries && record.overrideText != null && (
                  <Pressable style={({ pressed }) => [styles.chipBtn, pressed && styles.pressed]} onPress={confirmRestore}>
                    <Text style={styles.chipBtnText}>{t('trainingLog.editor.restoreAuto')}</Text>
                  </Pressable>
                )}
                <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]} onPress={confirmDelete}>
                  <Text style={styles.dangerText}>{t('trainingLog.editor.deleteLine')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            style={({ pressed }) => [styles.btn, styles.confirm, !canSave && styles.disabled, pressed && styles.pressed]}
            onPress={save}
          >
            <Text style={styles.confirmText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '700', color: c.textBright },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
    notice: { fontSize: 12, color: c.warning, lineHeight: 17 },
    errorText: { fontSize: 12, color: c.danger, lineHeight: 17 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 15,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    inputError: { borderColor: c.danger },
    inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    autoBox: { gap: 4, padding: 8, borderRadius: 8, backgroundColor: c.bgHighlight },
    autoText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    switchLabel: { flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    entryRow: { gap: 6, paddingVertical: 4 },
    entryText: { color: c.textPrimary, fontSize: 14, lineHeight: 20 },
    dangerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    dangerBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.dangerBgSoft,
    },
    dangerText: { color: c.dangerStrong, fontSize: 12, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Share, TextInput, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { useEnergyStore } from '../../store/energyStore';
import { useBlockStore } from '../../store/blockStore';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import {
  getWeightsInRange,
  setFirstWeightInRange,
  setWeightForDay,
} from '../../data/repositories/healthSignalsRepository';
import {
  getTrainingLogDaysInRange,
  getTrainingLogWeeksInRange,
} from '../../data/repositories/trainingLogRepository';
import { formatDayDate, formatPeriodTitle } from '../../domain/training/trainingLogFormatter';
import { buildPeriodPage } from '../../domain/training/trainingLogPage';
import { backfillTimestamp } from '../../domain/training/trainingLogDaySync';
import type { PeriodPage } from '../../domain/training/trainingLogPage';
import { applyPageEdit, planHasWrites, planPageEdit } from '../../services/training/trainingLogPageSync';
import type { PageChange, PageEditPlan } from '../../services/training/trainingLogPageSync';
import { addDaysToDateString, todayString } from '../../lib/dateUtils';
import { WEEK_WEIGHT_LOOKBACK_DAYS } from '../../domain/training/trainingLogWeights';
import { weighInTimestamp } from '../../domain/health/weighIn';
import type { TrainingLogFormat, TrainingLogPeriod } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  period: TrainingLogPeriod;
  format: TrainingLogFormat;
}

// view → edit (the page as one text box) → review (every change, and whether it
// recalculates a Xả session or only touches the notebook) → done (what was
// changed, with the workout kcal before → after).
type Mode = 'view' | 'edit' | 'review' | 'done';

// Module-level wrapper so the impure clock read stays out of the component body.
function getTodayString(): string {
  return todayString();
}

// A whole block (or month) as one plain-text page — the same lines the notebook
// shows, laid out like the user's Apple Notes — to read as a single piece or
// share (the OS share sheet has "Notes" and "Copy"), so it can go straight back
// into Notes. It can also be EDITED as text: corrections flow back into the
// Xả sessions (see services/training/trainingLogPageSync.ts), and the sheet
// then lists exactly what was updated where. The parent remounts it (via
// `key`) for every opening.
export function TrainingLogPageSheet({ visible, onClose, period, format }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const revision = useTrainingLogStore((s) => s.revision);
  const writeNotebook = useTrainingLogStore((s) => s.writeNotebook);
  const renameMonth = useTrainingLogStore((s) => s.renameMonth);
  const updateActivityForPastDate = useEnergyStore((s) => s.updateActivityForPastDate);
  const logActivityForPastDate = useEnergyStore((s) => s.logActivityForPastDate);
  const renameBlock = useBlockStore((s) => s.renameBlock);

  const [page, setPage] = useState<PeriodPage | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [base, setBase] = useState<PeriodPage | null>(null); // the page the edit started from
  const [draft, setDraft] = useState('');
  const [plan, setPlan] = useState<PageEditPlan | null>(null);
  const [result, setResult] = useState<PageChange[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The review came from "Ghi dòng tay vào Xả" (not from an edit): going back
  // returns to the page, not to a text box.
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const { startDate, endDate } = period;
    Promise.all([
      getActivityLogInRange(startDate, endDate),
      getTrainingLogDaysInRange(startDate, endDate),
      getTrainingLogWeeksInRange(startDate, endDate),
      // Lookback → the first week heading can carry an earlier weight forward.
      getWeightsInRange(addDaysToDateString(startDate, -WEEK_WEIGHT_LOOKBACK_DAYS), endDate),
    ]).then(([entries, dayRecords, weekRecords, weights]) => {
      if (!cancelled) {
        setPage(buildPeriodPage({ period, entries, dayRecords, weekRecords, weights, format, language }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, period, format, language, revision]);

  const text = page?.text ?? null;

  function share() {
    if (!text) return;
    // React Native's own Share: no extra dependency, and on iOS the sheet offers
    // Notes / Copy directly. `title` is only used by Android.
    Share.share({ message: text, title: t('trainingLog.pageShareTitle') });
  }

  function startEdit() {
    if (!page) return;
    setBase(page);
    setDraft(page.text);
    setMode('edit');
  }

  async function review() {
    if (!base) return;
    setBusy(true);
    try {
      setPlan(await planPageEdit({ period, page: base, text: draft, format, language, today: getTodayString() }));
      setBackfilling(false);
      setMode('review');
    } finally {
      setBusy(false);
    }
  }

  // Every hand-written line of the period → a Xả session, previewed first.
  async function reviewBackfill() {
    if (!page) return;
    setBusy(true);
    try {
      setBase(page);
      setPlan(
        await planPageEdit({
          period,
          page,
          text: page.text,
          format,
          language,
          today: getTodayString(),
          backfillManual: true,
        })
      );
      setBackfilling(true);
      setMode('review');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    try {
      const done = await applyPageEdit(plan, {
        updateEntry: (entry, workouts) => updateActivityForPastDate(entry, { workouts }),
        createEntry: (date, workouts) => logActivityForPastDate({ workouts }, backfillTimestamp(date, Date.now())),
        writeNotebook,
        renameBlock: async (blockId, name) => {
          await renameBlock(blockId, name);
        },
        renameMonth,
        setDayWeight: (date, kg) => setWeightForDay(date, kg, weighInTimestamp(date, Date.now())),
        // No reading that week yet → one on its Monday morning.
        setWeekWeight: (weekStart, weekEnd, kg) =>
          setFirstWeightInRange(weekStart, weekEnd, kg, weighInTimestamp(weekStart, Date.now())),
      });
      setResult(done);
      setMode('done');
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    setPlan(null);
    setResult(null);
    setBase(null);
    setBackfilling(false);
    setMode('view');
  }

  const changes = mode === 'done' ? result : plan?.changes;
  const applied = (changes ?? []).filter((ch) => ch.target !== 'skipped').length;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{formatPeriodTitle(period, language)}</Text>

        {mode === 'view' && (
          <>
            {text == null ? (
              <ActivityIndicator color={c.textMuted} />
            ) : text.trim() === '' ? (
              <Text style={styles.empty}>{t('trainingLog.pageEmpty')}</Text>
            ) : (
              <Text selectable style={styles.page}>
                {text}
              </Text>
            )}
            {page && page.manualDates.length > 0 && (
              <View style={styles.backfillBox}>
                <Text style={styles.hint}>{t('trainingLog.pageEdit.backfillExplain')}</Text>
                <Pressable
                  disabled={busy}
                  style={({ pressed }) => [styles.backfillBtn, pressed && styles.pressed]}
                  onPress={reviewBackfill}
                >
                  {busy ? (
                    <ActivityIndicator color={c.accent} />
                  ) : (
                    <Text style={styles.editText}>
                      {t('trainingLog.pageEdit.backfillButton', { count: page.manualDates.length })}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
            <View style={styles.row}>
              <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
                <Text style={styles.cancelText}>{t('common.close')}</Text>
              </Pressable>
              <Pressable
                disabled={!page}
                style={({ pressed }) => [styles.btn, styles.cancel, !page && styles.disabled, pressed && styles.pressed]}
                onPress={startEdit}
              >
                <Text style={styles.editText}>{t('trainingLog.pageEdit.editButton')}</Text>
              </Pressable>
              <Pressable
                disabled={!text}
                style={({ pressed }) => [styles.btn, styles.confirm, !text && styles.disabled, pressed && styles.pressed]}
                onPress={share}
              >
                <Text style={styles.confirmText}>{t('trainingLog.pageShare')}</Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === 'edit' && (
          <>
            <Text style={styles.hint}>{t('trainingLog.pageEdit.hint')}</Text>
            <TextInput
              style={[styles.page, styles.input]}
              accessibilityLabel={t('trainingLog.pageEdit.inputLabel')}
              multiline
              scrollEnabled={false}
              autoCorrect={false}
              autoCapitalize="none"
              value={draft}
              onChangeText={setDraft}
            />
            <View style={styles.row}>
              <Pressable
                disabled={busy}
                style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
                onPress={finish}
              >
                <Text style={styles.cancelText}>{t('trainingLog.pageEdit.cancel')}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                style={({ pressed }) => [styles.btn, styles.confirm, busy && styles.disabled, pressed && styles.pressed]}
                onPress={review}
              >
                {busy ? <ActivityIndicator color={c.bg} /> : <Text style={styles.confirmText}>{t('trainingLog.pageEdit.review')}</Text>}
              </Pressable>
            </View>
          </>
        )}

        {(mode === 'review' || mode === 'done') && changes && (
          <>
            {changes.length === 0 ? (
              <Text style={styles.empty}>{t('trainingLog.pageEdit.noChanges')}</Text>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  {mode === 'done'
                    ? t('trainingLog.pageEdit.doneTitle', { count: applied })
                    : t('trainingLog.pageEdit.reviewTitle', { count: applied })}
                </Text>
                {mode === 'review' && (
                  <Text style={styles.hint}>
                    {backfilling ? t('trainingLog.pageEdit.backfillHint') : t('trainingLog.pageEdit.reviewHint')}
                  </Text>
                )}
                {changes.map((ch) => (
                  <ChangeRow key={ch.key} change={ch} done={mode === 'done'} />
                ))}
              </>
            )}
            <View style={styles.row}>
              {mode === 'review' ? (
                <>
                  <Pressable
                    disabled={busy}
                    style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
                    onPress={() => (backfilling ? finish() : setMode('edit'))}
                  >
                    <Text style={styles.cancelText}>
                      {backfilling ? t('trainingLog.pageEdit.cancel') : t('trainingLog.pageEdit.backToEdit')}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy || !planHasWrites(plan!)}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.confirm,
                      (busy || !planHasWrites(plan!)) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                    onPress={apply}
                  >
                    {busy ? <ActivityIndicator color={c.bg} /> : <Text style={styles.confirmText}>{t('trainingLog.pageEdit.apply')}</Text>}
                  </Pressable>
                </>
              ) : (
                <Pressable style={({ pressed }) => [styles.btn, styles.confirm, pressed && styles.pressed]} onPress={finish}>
                  <Text style={styles.confirmText}>{t('trainingLog.pageEdit.done')}</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// One change: where it lands ("26.08 · Buổi Xả · tính lại kcal & pin"), the
// line before → after, why it was (not) applied, and the kcal effect.
function ChangeRow({ change, done }: { change: PageChange; done: boolean }) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const where = change.date ? formatDayDate(change.date, language) : null;
  const target = t(`trainingLog.pageEdit.target.${change.target}`, { label: change.weekLabel ?? '' });
  const isWeight =
    change.target === 'weight' ||
    change.target === 'weekWeight' ||
    change.reason === 'weightNotSynced' ||
    change.reason === 'weightInvalid';
  const show = (v: string) =>
    v.trim() === ''
      ? t('trainingLog.pageEdit.emptyValue')
      : isWeight
        ? t('trainingLog.format.weightPlain', { kg: v })
        : v;

  return (
    <View
      style={[
        styles.change,
        (change.target === 'xa' || change.target === 'xaCreate') && styles.changeXa,
        (change.target === 'skipped' || change.reason === 'failed') && styles.changeSkipped,
      ]}
    >
      <Text style={styles.changeTitle}>{where ? `${where} · ${target}` : target}</Text>
      {change.target !== 'manualRemoved' || change.before ? (
        <Text selectable style={styles.changeLine}>
          <Text style={styles.changeLabel}>{t('trainingLog.pageEdit.before')}: </Text>
          {show(change.before)}
        </Text>
      ) : null}
      {change.target !== 'manualRemoved' && change.reason !== 'xaLineRemoved' ? (
        <Text selectable style={styles.changeLine}>
          <Text style={styles.changeLabel}>{t('trainingLog.pageEdit.after')}: </Text>
          {show(change.after)}
        </Text>
      ) : null}
      {(change.target === 'xa' || change.target === 'xaCreate') && change.kcalBefore != null && change.reason !== 'failed' ? (
        <Text style={styles.changeKcal}>
          {done && change.kcalAfter != null
            ? t('trainingLog.pageEdit.kcal', { before: change.kcalBefore, after: change.kcalAfter })
            : change.target === 'xaCreate'
              ? t('trainingLog.pageEdit.kcalCreatePending')
              : t('trainingLog.pageEdit.kcalPending', { before: change.kcalBefore })}
        </Text>
      ) : null}
      {change.reason ? (
        <Text style={styles.changeReason}>
          {t(`trainingLog.pageEdit.reason.${change.reason}`, { detail: change.detail ?? '' })}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    page: {
      color: c.textPrimary,
      fontSize: 15,
      lineHeight: 22,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
    },
    input: { borderWidth: 1, borderColor: c.accent, textAlignVertical: 'top', minHeight: 200 },
    hint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    sectionTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    empty: { color: c.textMuted, fontSize: 14 },
    row: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    editText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
    change: {
      gap: 3,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderLeftWidth: 3,
      borderLeftColor: c.borderSubtle,
    },
    changeXa: { borderLeftColor: c.accent },
    backfillBox: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: c.bgElevated },
    backfillBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.accent,
    },
    changeSkipped: { opacity: 0.75 },
    changeTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
    changeLine: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
    changeLabel: { color: c.textTertiary, fontWeight: '600' },
    changeKcal: { color: c.accent, fontSize: 12, fontWeight: '700' },
    changeReason: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  });

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { liftColor } from './ProgressChartSvg';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { formatDayDate } from '../../domain/training/trainingLogFormatter';
import { formatChartValue } from '../../domain/training/progressChartModel';
import { formatDayMonthInput, parseDayMonthInput } from '../../lib/dateInput';
import { parseDecimal } from '../../lib/units';
import { daysAgo, todayString } from '../../lib/dateUtils';
import { TRAINING_LOG_MAX_DAYS_BACK } from '../../lib/constants';
import { activityLabel } from '../../lib/activityLabels';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftingExercise } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  format: TrainingLogFormat;
}

// Module-level wrappers so the impure clock reads stay out of the component body.
function getTodayString(): string {
  return todayString();
}
function getEarliestDate(): string {
  return daysAgo(TRAINING_LOG_MAX_DAYS_BACK);
}

// "⭐ Ghi 1RM": record a one-rep max (lift, kg, day) and see / delete the ones
// already recorded. Each one is a ⭐ on the strength chart. The parent remounts
// this sheet (via `key`) for every opening, so the fields start fresh.
export function LiftMaxSheet({ visible, onClose, format }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const maxes = useTrainingLogStore((s) => s.liftMaxes);
  const addLiftMax = useTrainingLogStore((s) => s.addLiftMax);
  const deleteLiftMax = useTrainingLogStore((s) => s.deleteLiftMax);

  const order = language === 'en' ? 'md' : 'dm';
  const bounds = useMemo(() => ({ today: getTodayString(), earliest: getEarliestDate() }), []);
  const [lift, setLift] = useState<LiftingExercise>('squat');
  const [kgText, setKgText] = useState('');
  const [dateText, setDateText] = useState(() => formatDayMonthInput(bounds.today, order));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const kg = parseDecimal(kgText);
  const kgValid = Number.isFinite(kg) && kg > 0 && kg < 1000;
  const date = parseDayMonthInput(dateText, bounds.today, order);
  const dateError =
    date == null
      ? t('trainingLog.editor.dateInvalid')
      : date < bounds.earliest
        ? t('components.pastDateField.errorTooOld', { max: TRAINING_LOG_MAX_DAYS_BACK })
        : null;
  const canSave = kgValid && dateError == null && !saving;

  const kgLabel = (v: number) => t('trainingLog.progress.valueKg', { kg: formatChartValue(v, 1, format, language) });
  const liftName = (l: LiftingExercise) => `${t(`trainingLog.abbr.${l}`)} · ${activityLabel(l, language)}`;

  async function save() {
    if (!canSave || date == null) return;
    setSaving(true);
    try {
      await addLiftMax({ lift, weightKg: kg, date, note });
      setKgText('');
      setNote('');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: string, l: LiftingExercise, weightKg: number, d: string) {
    Alert.alert(
      t('trainingLog.maxSheet.deleteConfirmTitle'),
      t('trainingLog.maxSheet.deleteConfirmMessage', {
        lift: liftName(l),
        kg: kgLabel(weightKg),
        date: formatDayDate(d, language),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteLiftMax(id) },
      ]
    );
  }

  const newestFirst = [...maxes].reverse();

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={650}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('trainingLog.maxSheet.title')}</Text>
        <Text style={styles.hint}>{t('trainingLog.maxSheet.hint')}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('trainingLog.maxSheet.liftLabel')}</Text>
          <View style={styles.chipRow} accessibilityRole="radiogroup">
            {LIFTING_EXERCISES.map((l) => (
              <Pressable
                key={l}
                accessibilityRole="radio"
                accessibilityState={{ selected: lift === l }}
                style={({ pressed }) => [
                  styles.chip,
                  lift === l && { borderColor: liftColor(c, l), backgroundColor: c.bgHighlight },
                  pressed && styles.pressed,
                ]}
                onPress={() => setLift(l)}
              >
                <Text style={[styles.chipText, lift === l && styles.chipTextActive]}>
                  <Text style={{ color: liftColor(c, l) }}>★ </Text>
                  {liftName(l)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>{t('trainingLog.maxSheet.weightLabel')}</Text>
            <TextInput
              style={[styles.input, kgText !== '' && !kgValid && styles.inputError]}
              placeholder={t('trainingLog.maxSheet.weightPlaceholder')}
              placeholderTextColor={c.textMuted}
              accessibilityLabel={t('trainingLog.maxSheet.weightLabel')}
              keyboardType="decimal-pad"
              value={kgText}
              onChangeText={setKgText}
            />
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>{t('trainingLog.editor.dateLabel')}</Text>
            <TextInput
              style={[styles.input, dateError != null && styles.inputError]}
              placeholder={t('trainingLog.editor.datePlaceholder')}
              placeholderTextColor={c.textMuted}
              accessibilityLabel={t('trainingLog.editor.dateLabel')}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={dateText}
              onChangeText={setDateText}
            />
          </View>
        </View>
        {kgText !== '' && !kgValid ? <Text style={styles.error}>{t('trainingLog.maxSheet.weightInvalid')}</Text> : null}
        {dateError ? <Text style={styles.error}>{dateError}</Text> : null}

        <View style={styles.field}>
          <Text style={styles.label}>{t('trainingLog.maxSheet.noteLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('trainingLog.maxSheet.notePlaceholder')}
            placeholderTextColor={c.textMuted}
            accessibilityLabel={t('trainingLog.maxSheet.noteLabel')}
            maxLength={60}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.close')}</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            style={({ pressed }) => [styles.btn, styles.confirm, !canSave && styles.disabled, pressed && styles.pressed]}
            onPress={save}
          >
            <Text style={styles.confirmText}>{t('trainingLog.maxSheet.save')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('trainingLog.maxSheet.listTitle')}</Text>
        {newestFirst.length === 0 ? (
          <Text style={styles.hint}>{t('trainingLog.maxSheet.empty')}</Text>
        ) : (
          newestFirst.map((m) => (
            <View key={m.id} style={styles.maxRow}>
              <Text style={[styles.star, { color: liftColor(c, m.lift) }]}>★</Text>
              <View style={styles.flex}>
                <Text style={styles.maxMain}>
                  {liftName(m.lift)} · {kgLabel(m.weightKg)}
                </Text>
                <Text style={styles.hint}>
                  {formatDayDate(m.date, language)}
                  {m.note ? ` · ${m.note}` : ''}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('trainingLog.maxSheet.deleteLabel')}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                onPress={() => confirmDelete(m.id, m.lift, m.weightKg, m.date)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 12 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
    error: { fontSize: 12, color: c.danger, lineHeight: 17 },
    field: { gap: 6 },
    flex: { flex: 1 },
    label: { fontSize: 13, fontWeight: '700', color: c.textBright },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgElevated,
    },
    chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: c.textPrimary },
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
    row: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
    maxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    star: { fontSize: 22 },
    maxMain: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    deleteBtn: { padding: 6, borderRadius: 12, backgroundColor: c.dangerBgSoft },
    deleteText: { color: c.dangerStrong, fontSize: 12, fontWeight: '700' },
  });

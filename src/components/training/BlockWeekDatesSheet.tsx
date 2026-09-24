import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { MAX_WEEK_DAYS, setWeekDates } from '../../domain/energy/blockPlanEdits';
import type { WeekDatesError } from '../../domain/energy/blockPlanEdits';
import { formatDayMonthInput, parseDayMonthNear } from '../../lib/dateInput';
import { formatDisplayDate } from '../../lib/dateUtils';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  plan: GeneratedBlockPlan;
  weekIndex: number;
  weekLabel: (weekIndex: number) => string; // "Tuần 2" / "Deload"
  // Resolves to the validation error, or null once saved.
  onSave: (start: string, end: string) => Promise<WeekDatesError | null>;
}

// Real dates for one week of the block: typed as dd.mm (or dd.mm.yyyy); the
// preview shows where every later week lands before anything is saved. The
// parent remounts it (via `key`) for every opening.
export function BlockWeekDatesSheet({ visible, onClose, plan, weekIndex, weekLabel, onSave }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const order = language === 'en' ? 'md' : 'dm';
  const week = plan.weeks[weekIndex];
  const [startText, setStartText] = useState(() => formatDayMonthInput(week.startDate, order));
  const [endText, setEndText] = useState(() => formatDayMonthInput(week.endDate, order));
  const [saving, setSaving] = useState(false);

  // A plan's dates may be in the future: "21.09" is the 21 September closest
  // to the date the field showed before.
  const start = parseDayMonthNear(startText, week.startDate, order);
  const end = parseDayMonthNear(endText, week.endDate, order);

  const result = start && end ? setWeekDates(plan, weekIndex, start, end) : null;
  const errorText = (() => {
    if (!start || !end) return t('trainingLog.editor.dateInvalid');
    if (!result || result.ok) return null;
    switch (result.error) {
      case 'endBeforeStart':
        return t('planAppendix.weekDates.errorEndBeforeStart');
      case 'overlapsPrevious':
        return t('planAppendix.weekDates.errorOverlapsPrevious', {
          date: formatDisplayDate(plan.weeks[weekIndex - 1].endDate, language),
        });
      case 'tooLong':
        return t('planAppendix.weekDates.errorTooLong', { max: MAX_WEEK_DAYS });
    }
  })();

  async function save() {
    if (!start || !end || !result?.ok) return;
    setSaving(true);
    try {
      const error = await onSave(start, end);
      if (error == null) onClose();
    } finally {
      setSaving(false);
    }
  }

  const laterWeeks = result?.ok ? result.plan.weeks.slice(weekIndex + 1) : [];

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={560}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('planAppendix.weekDates.title', { week: weekLabel(weekIndex) })}</Text>
        <Text style={styles.hint}>{t('planAppendix.weekDates.hint')}</Text>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>{t('planAppendix.weekDates.startLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('trainingLog.editor.datePlaceholder')}
              placeholderTextColor={c.textMuted}
              accessibilityLabel={t('planAppendix.weekDates.startLabel')}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={startText}
              onChangeText={setStartText}
            />
            <Text style={styles.hint}>{start ? formatDisplayDate(start, language) : ' '}</Text>
          </View>
          <View style={styles.dateField}>
            <Text style={styles.label}>{t('planAppendix.weekDates.endLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('trainingLog.editor.datePlaceholder')}
              placeholderTextColor={c.textMuted}
              accessibilityLabel={t('planAppendix.weekDates.endLabel')}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={endText}
              onChangeText={setEndText}
            />
            <Text style={styles.hint}>{end ? formatDisplayDate(end, language) : ' '}</Text>
          </View>
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {laterWeeks.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.label}>{t('planAppendix.weekDates.laterWeeks')}</Text>
            {laterWeeks.map((w, i) => (
              <Text key={w.weekNumber} style={styles.previewLine}>
                {weekLabel(weekIndex + 1 + i)}: {formatDisplayDate(w.startDate, language)} –{' '}
                {formatDisplayDate(w.endDate, language)}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            disabled={errorText != null || saving}
            style={({ pressed }) => [
              styles.btn,
              styles.confirm,
              (errorText != null || saving) && styles.disabled,
              pressed && styles.pressed,
            ]}
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
    label: { fontSize: 13, fontWeight: '700', color: c.textBright },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
    errorText: { fontSize: 12, color: c.danger, lineHeight: 17 },
    dateRow: { flexDirection: 'row', gap: 12 },
    dateField: { flex: 1, gap: 6 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    previewBox: { gap: 4, padding: 10, borderRadius: 10, backgroundColor: c.bgHighlight },
    previewLine: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
    row: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });

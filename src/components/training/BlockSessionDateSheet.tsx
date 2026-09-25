import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { formatDayMonthInput, parseDayMonthNear } from '../../lib/dateInput';
import { formatDisplayDate } from '../../lib/dateUtils';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string; // already translated ("B3W4 · T7 27/09")
  date: string; // the day it is confirmed for now
  onSave: (date: string) => Promise<void>;
}

// Moves a confirmed session to another day (training delayed by work): typed
// as dd.mm like every date field of the plan. It goes into Xả at 18:00 of the
// new day — at once if that day is already behind. The parent remounts it
// (via `key`) for every opening.
export function BlockSessionDateSheet({ visible, onClose, title, date, onSave }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const order = language === 'en' ? 'md' : 'dm';
  const [text, setText] = useState(() => formatDayMonthInput(date, order));
  const [saving, setSaving] = useState(false);
  const parsed = parseDayMonthNear(text, date, order);

  async function save() {
    if (!parsed) return;
    setSaving(true);
    try {
      await onSave(parsed);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={420}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{t('planAppendix.session.moveHint')}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>{t('planAppendix.session.moveLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('trainingLog.editor.datePlaceholder')}
            placeholderTextColor={c.textMuted}
            accessibilityLabel={t('planAppendix.session.moveLabel')}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            value={text}
            onChangeText={setText}
          />
          <Text style={parsed ? styles.hint : styles.errorText}>
            {parsed ? formatDisplayDate(parsed, language) : t('trainingLog.editor.dateInvalid')}
          </Text>
        </View>
        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            disabled={!parsed || saving}
            style={({ pressed }) => [styles.btn, styles.confirm, (!parsed || saving) && styles.disabled, pressed && styles.pressed]}
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
    errorText: { fontSize: 12, color: c.danger, lineHeight: 17 },
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
    row: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.6 },
  });

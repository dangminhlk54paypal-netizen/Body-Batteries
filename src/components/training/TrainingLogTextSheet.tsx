import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  // Already-translated text (the caller uses t()).
  title: string;
  hint?: string;
  placeholder: string;
  // Read once on mount — the parent remounts the sheet (via `key`) per opening.
  initialValue: string;
  multiline?: boolean;
  maxLength?: number;
  // Empty text is allowed: it clears whatever was there.
  onSave: (text: string) => void;
}

// One text box in a sheet — used for a week's note and a block's name. Kept
// generic because both are "type a short text, save or cancel".
export function TrainingLogTextSheet({
  visible,
  onClose,
  title,
  hint,
  placeholder,
  initialValue,
  multiline,
  maxLength,
  onSave,
}: Props) {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [value, setValue] = useState(initialValue);

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={420}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={title}
          multiline={multiline}
          maxLength={maxLength}
          value={value}
          onChangeText={setValue}
        />
        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.confirm, pressed && styles.pressed]}
            onPress={() => {
              onSave(value);
              onClose();
            }}
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
    content: { padding: 24, paddingTop: 12, gap: 12 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    hint: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
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
    inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.bg, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

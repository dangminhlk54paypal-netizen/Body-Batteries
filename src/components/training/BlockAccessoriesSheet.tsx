import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Switch, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { BODYBUILDING_EXERCISES } from '../../lib/bodybuildingExercises';
import { matchesSearch } from '../../domain/energy/blockSchedule';
import { useSettingsStore } from '../../store/settingsStore';
import type { AccessoryLineItem } from '../../types/powerliftingBlock';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string; // already translated ("Bài phụ · Thứ Hai 12.10")
  weekdayName: string; // "Thứ Hai" — for "every later Monday too"
  initial: AccessoryLineItem[];
  hasLaterWeeks: boolean;
  onSave: (accessories: AccessoryLineItem[], laterWeeksToo: boolean) => void;
}

const MAX_SUGGESTIONS = 4;
const MAX_SETS = 20;

// The user's own extra exercises for one planned day, written their way —
// any name, a set count, and free reps/notes ("15 @12.5kg", "đến mỏi"). The
// app's exercise library only offers name suggestions while typing; nothing
// here has to match it or be calculated. The parent remounts it per opening.
export function BlockAccessoriesSheet({ visible, onClose, title, weekdayName, initial, hasLaterWeeks, onSave }: Props) {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const customExercises = useSettingsStore((s) => s.customExercises);
  const [rows, setRows] = useState<AccessoryLineItem[]>(() =>
    initial.length > 0 ? initial.map((a) => ({ ...a })) : [{ customName: '', sets: 3, reps: '' }]
  );
  const [focused, setFocused] = useState<number | null>(null);
  const [laterWeeksToo, setLaterWeeksToo] = useState(true);

  const libraryNames = [
    ...customExercises.map((e) => e.nameVi),
    ...BODYBUILDING_EXERCISES.map((e) => t(`bbExercises.${e.id}`)),
  ];
  function suggestionsFor(query: string): string[] {
    if (query.trim().length < 2) return [];
    return libraryNames
      .filter((name) => name !== query && matchesSearch(query, [name]))
      .slice(0, MAX_SUGGESTIONS);
  }

  function patch(i: number, next: Partial<AccessoryLineItem>) {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...next } : r)));
  }

  function save() {
    onSave(rows, hasLaterWeeks && laterWeeksToo);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={620}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{t('planAppendix.accessories.hint')}</Text>

        {rows.map((row, i) => {
          const suggestions = focused === i ? suggestionsFor(row.customName) : [];
          return (
            <View key={i} style={styles.rowBox}>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder={t('planAppendix.accessories.namePlaceholder')}
                  placeholderTextColor={c.textMuted}
                  accessibilityLabel={t('planAppendix.accessories.namePlaceholder')}
                  value={row.customName}
                  onFocus={() => setFocused(i)}
                  onChangeText={(v) => patch(i, { customName: v })}
                  maxLength={40}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setRows((cur) => cur.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={t('planAppendix.accessories.removeA11y')}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
              {suggestions.length > 0 && (
                <View style={styles.chipRow}>
                  {suggestions.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => patch(i, { customName: name })}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    >
                      <Text style={styles.chipText}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.row}>
                <View style={styles.stepper}>
                  <Pressable
                    hitSlop={6}
                    onPress={() => patch(i, { sets: Math.max(1, row.sets - 1) })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.setsText} accessibilityLabel={t('planAppendix.accessories.setsA11y', { n: row.sets })}>
                    {t('planAppendix.accessories.sets', { n: row.sets })}
                  </Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() => patch(i, { sets: Math.min(MAX_SETS, row.sets + 1) })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.stepText}>＋</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, styles.repsInput]}
                  placeholder={t('planAppendix.accessories.repsPlaceholder')}
                  placeholderTextColor={c.textMuted}
                  accessibilityLabel={t('planAppendix.accessories.repsPlaceholder')}
                  value={row.reps}
                  onChangeText={(v) => patch(i, { reps: v })}
                  maxLength={30}
                />
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => {
            setRows((cur) => [...cur, { customName: '', sets: 3, reps: '' }]);
            setFocused(rows.length);
          }}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Text style={styles.addText}>{t('planAppendix.accessories.add')}</Text>
        </Pressable>

        {hasLaterWeeks && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('planAppendix.accessories.laterWeeks', { day: weekdayName })}</Text>
            <Switch value={laterWeeksToo} onValueChange={setLaterWeeksToo} trackColor={{ true: c.accent }} />
          </View>
        )}

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.btn, styles.confirm, pressed && styles.pressed]} onPress={save}>
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
    rowBox: { gap: 6, padding: 10, borderRadius: 12, backgroundColor: c.bgHighlight },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
      fontSize: 15,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    nameInput: { flex: 1 },
    repsInput: { flex: 1 },
    removeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgElevated },
    removeText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipText: { color: c.textSoft, fontSize: 12 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgElevated },
    stepText: { color: c.accent, fontSize: 16, fontWeight: '700' },
    setsText: { minWidth: 52, textAlign: 'center', color: c.textPrimary, fontSize: 14, fontWeight: '600' },
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
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchLabel: { flex: 1, color: c.textPrimary, fontSize: 14 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancel: { backgroundColor: c.bgElevated },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    confirm: { backgroundColor: c.accent },
    confirmText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

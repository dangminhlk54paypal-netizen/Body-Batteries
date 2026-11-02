// History › a day › "✎ Sửa số liệu": correct, delete or add what was logged on
// that day. Changes go through energyStore's ...ForPastDate actions; foods are
// edited on their own rows in DayDetailSheet. Lives inside the sheet, in a small
// scroll window (a second Modal would not show on iOS).
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEnergyStore } from '../../store/energyStore';
import { getIntakeEventsForDate } from '../../data/repositories/intakeRepository';
import { getActivityLogForDate } from '../../data/repositories/activityLogRepository';
import { setWeightForDay } from '../../data/repositories/healthSignalsRepository';
import {
  ADDABLE_KINDS,
  activityEditField,
  activityPatchFor,
  editableIntakes,
  entryTimestampFor,
  type AddableKind,
} from '../../domain/editing/dayLogEdit';
import { batteryTypeName, DEFAULT_BATTERIES } from '../../lib/constants';
import { activityLabel } from '../../lib/activityLabels';
import { PROFILE_LIMITS } from '../../lib/metabolicConstants';
import { todayString } from '../../lib/dateUtils';
import { parseDecimal } from '../../lib/units';
import type { IntakeEvent } from '../../types/battery';
import type { ActivityLogEntry } from '../../types/energy';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';
import { LOCALE_TAGS } from '../../i18n/types';

const LIST_HEIGHT = 170;

interface Props {
  date: string;
  onChanged: () => void; // refresh the sheet's numbers and the day cards
}

async function fetchDay(date: string) {
  const [events, logged] = await Promise.all([getIntakeEventsForDate(date), getActivityLogForDate(date)]);
  return { events, logged };
}

export function DayLogEditor({ date, onChanged }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [intakes, setIntakes] = useState<IntakeEvent[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addKind, setAddKind] = useState<AddableKind>('water');
  const [addValue, setAddValue] = useState('');
  const [busy, setBusy] = useState(false);

  const show = useCallback(({ events, logged }: Awaited<ReturnType<typeof fetchDay>>) => {
    setIntakes(editableIntakes(events));
    setActivities(logged);
  }, []);

  useEffect(() => {
    fetchDay(date)
      .then(show)
      .catch((e) => console.warn('DayLogEditor load failed:', e));
  }, [date, show]);

  async function run(change: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await change();
      setEditingId(null);
      show(await fetchDay(date));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, value: number) {
    setEditingId(id);
    setEditValue(String(value));
  }

  function confirmDelete(name: string, remove: () => Promise<void>) {
    Alert.alert(
      t('components.dayDetailSheet.deleteConfirmTitle'),
      t('components.dayDetailSheet.deleteConfirmMessage', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => run(remove) },
      ]
    );
  }

  function saveIntake(event: IntakeEvent) {
    const value = parseDecimal(editValue);
    if (isNaN(value) || value <= 0) return;
    run(() => useEnergyStore.getState().updateIntakeForPastDate(event, value));
  }

  function saveActivity(entry: ActivityLogEntry) {
    const field = activityEditField(entry);
    const value = parseDecimal(editValue);
    if (!field || isNaN(value) || value <= 0) return;
    run(() => useEnergyStore.getState().updateActivityForPastDate(entry, activityPatchFor(field, value)));
  }

  function add() {
    const value = parseDecimal(addValue);
    if (isNaN(value) || value <= 0) return;
    const today = todayString();
    const timestamp = entryTimestampFor(date, today, Date.now());
    const energy = useEnergyStore.getState();
    if (addKind === 'weight' && (value < PROFILE_LIMITS.weightKg.min || value > PROFILE_LIMITS.weightKg.max)) return;
    setAddValue('');
    run(async () => {
      if (addKind === 'water' || addKind === 'sleep') {
        await energy.addIntakeForPastDate(addKind, value, timestamp);
      } else if (addKind === 'steps') {
        await energy.logActivityForPastDate({ steps: value }, timestamp);
      } else if (addKind === 'walkMinutes') {
        await energy.logActivityForPastDate({ workouts: [{ type: 'walking', minutes: value }] }, timestamp);
      } else {
        await setWeightForDay(date, value, timestamp);
      }
    });
  }

  const number = (value: number) => value.toLocaleString(LOCALE_TAGS[language]);

  function row(id: string, name: string, amount: string, onSave: (() => void) | null, value: number, remove: () => Promise<void>) {
    const editing = editingId === id;
    return (
      <View key={id} style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {editing ? (
          <>
            <TextInput
              style={styles.input}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="decimal-pad"
              autoFocus
              accessibilityLabel={name}
            />
            <IconButton symbol="✓" label={t('common.save')} onPress={() => onSave?.()} />
          </>
        ) : (
          <>
            <Text style={styles.amount}>{amount}</Text>
            {onSave ? (
              <IconButton symbol="✎" label={t('common.edit')} onPress={() => startEdit(id, value)} />
            ) : (
              <View style={styles.iconSpace} />
            )}
            <IconButton symbol="✕" label={t('common.delete')} onPress={() => confirmDelete(name, remove)} />
          </>
        )}
      </View>
    );
  }

  const energy = useEnergyStore.getState();
  const empty = intakes.length === 0 && activities.length === 0;

  return (
    <View style={styles.box}>
      {empty ? (
        <Text style={styles.empty}>{t('components.dayLogEditor.empty')}</Text>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {intakes.map((event) =>
            row(
              event.id,
              batteryTypeName(event.batteryTypeId, language),
              `${number(event.amount)} ${t(`components.dayLogEditor.unit.${DEFAULT_BATTERIES.find((b) => b.id === event.batteryTypeId)?.unit ?? 'g'}`)}`,
              () => saveIntake(event),
              event.amount,
              () => energy.removeIntakeForPastDate(event)
            )
          )}
          {activities.map((entry) => {
            const field = activityEditField(entry);
            const name =
              entry.workouts.length > 0
                ? entry.workouts.map((w) => w.bbName ?? activityLabel(w.type, language)).join(' + ')
                : t('components.routine.metric.steps');
            const amount = !field
              ? `${Math.round(entry.energyKcal)} kcal`
              : field.kind === 'steps'
                ? `${number(field.value)} ${t('components.routine.unit.steps')}`
                : `${number(field.value)} ${t('components.routine.unit.walkMinutes')}`;
            return row(
              entry.id,
              name,
              amount,
              field ? () => saveActivity(entry) : null,
              field?.value ?? 0,
              () => energy.removeActivityForPastDate(entry)
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {ADDABLE_KINDS.map((kind) => (
          <Pressable
            key={kind}
            style={[styles.chip, addKind === kind && styles.chipOn]}
            onPress={() => setAddKind(kind)}
          >
            <Text style={[styles.chipText, addKind === kind && styles.chipTextOn]}>
              {t(`components.dayLogEditor.add.${kind}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.addInput]}
          value={addValue}
          onChangeText={setAddValue}
          keyboardType="decimal-pad"
          placeholder={t(`components.dayLogEditor.unitFor.${addKind}`)}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={t(`components.dayLogEditor.add.${addKind}`)}
        />
        <IconButton symbol="＋" label={t('components.dayLogEditor.addA11y')} onPress={add} />
      </View>
    </View>
  );
}

function IconButton({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
      hitSlop={6}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.iconText}>{symbol}</Text>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: { gap: 8, marginTop: 8 },
    list: { maxHeight: LIST_HEIGHT },
    empty: { fontSize: 13, color: c.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38 },
    name: { flex: 1, fontSize: 14, color: c.textPrimary },
    amount: { fontSize: 13, color: c.textSecondary },
    input: {
      minWidth: 84,
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      color: c.textPrimary,
      textAlign: 'right',
    },
    addInput: { flex: 1, textAlign: 'left' },
    icon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    iconSpace: { width: 30 },
    iconText: { fontSize: 15, color: c.textSecondary },
    chips: { gap: 6 },
    chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: c.bgElevated },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTextOn: { color: c.onAccent },
    pressed: { opacity: 0.6 },
  });

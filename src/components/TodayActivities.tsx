import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from './EnergyActionsBar';
import { formatTimeHHmm, parseTimeHHmmToday } from '../lib/dateUtils';
import type { ActivityLogEntry, ActivityType } from '../types/energy';
import { colors } from '../lib/theme';

interface Props {
  entries: ActivityLogEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: {
    steps?: number;
    workouts?: { type: ActivityType; minutes: number }[];
    // undefined = leave the existing time unchanged; null = the user
    // explicitly cleared the field, so drop the stored time entirely.
    startAt?: number | null;
    endAt?: number | null;
  }) => void;
}

// Blank input = user explicitly cleared the field (→ null, drop the stored
// time). Non-blank but unparseable ("25:99") is more likely a typo than an
// intentional clear, so it falls back to `undefined` (keep the old value)
// rather than silently wiping it.
function timeFieldPatch(raw: string): number | null | undefined {
  if (raw.trim() === '') return null;
  return parseTimeHHmmToday(raw);
}

function timeRangeLabel(entry: ActivityLogEntry): string {
  if (entry.startAt && entry.endAt) {
    return `${formatTimeHHmm(entry.startAt)}–${formatTimeHHmm(entry.endAt)}`;
  }
  if (entry.startAt) return `từ ${formatTimeHHmm(entry.startAt)}`;
  return formatTimeHHmm(entry.timestamp);
}

function summaryLabel(entry: ActivityLogEntry): string {
  const parts: string[] = [];
  for (const w of entry.workouts) {
    parts.push(`${ACTIVITY_LABELS[w.type]} ${w.minutes}p`);
  }
  if (entry.steps > 0) parts.push(`${entry.steps} bước`);
  return parts.length > 0 ? parts.join(' · ') : 'Vận động';
}

export function TodayActivities({ entries, onDelete, onEdit }: Props) {
  const [editingEntry, setEditingEntry] = useState<ActivityLogEntry | null>(null);
  const [editActivity, setEditActivity] = useState<ActivityType>('running');
  const [editMinutes, setEditMinutes] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const totalKcal = entries.reduce((sum, e) => sum + e.energyKcal, 0);

  function startEdit(entry: ActivityLogEntry) {
    const workout = entry.workouts[0];
    setEditingEntry(entry);
    setEditActivity(workout?.type ?? 'running');
    setEditMinutes(workout ? String(workout.minutes) : '');
    setEditSteps(entry.steps > 0 ? String(entry.steps) : '');
    setEditStart(entry.startAt ? formatTimeHHmm(entry.startAt) : '');
    setEditEnd(entry.endAt ? formatTimeHHmm(entry.endAt) : '');
  }

  function confirmEdit() {
    if (!editingEntry) return;
    const mins = parseFloat(editMinutes);
    const stepCount = parseFloat(editSteps);
    onEdit(editingEntry.id, {
      steps: !isNaN(stepCount) && stepCount > 0 ? stepCount : 0,
      workouts: !isNaN(mins) && mins > 0 ? [{ type: editActivity, minutes: mins }] : [],
      startAt: timeFieldPatch(editStart),
      endAt: timeFieldPatch(editEnd),
    });
    setEditingEntry(null);
  }

  function confirmDelete(entry: ActivityLogEntry) {
    onDelete(entry.id);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Hôm nay đã vận động</Text>
        {entries.length > 0 && <Text style={styles.totalKcal}>🔥 {Math.round(totalKcal)} kcal</Text>}
      </View>

      {entries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Chưa ghi vận động nào hôm nay. Bấm “🏃 Vận động” để bắt đầu.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {entries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View style={styles.entryMain}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {summaryLabel(e)}
                </Text>
                <Text style={styles.entryMeta}>
                  {timeRangeLabel(e)} · {Math.round(e.energyKcal)} kcal
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                onPress={() => startEdit(e)}
              >
                <Text style={styles.editText}>✎</Text>
              </Pressable>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                onPress={() => confirmDelete(e)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Edit modal — prefilled with the tapped entry, saved via updateActivity */}
      <Modal visible={editingEntry !== null} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Sửa vận động</Text>
            <View style={styles.chips}>
              {ACTIVITY_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEditActivity(t)}
                  style={({ pressed }) => [
                    styles.chip,
                    editActivity === t && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, editActivity === t && styles.chipTextActive]}>
                    {ACTIVITY_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Số phút tập (ví dụ: 45)"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={editMinutes}
              onChangeText={setEditMinutes}
            />
            <TextInput
              style={styles.input}
              placeholder="Số bước chân (tuỳ chọn)"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={editSteps}
              onChangeText={setEditSteps}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="Từ HH:mm"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={editStart}
                onChangeText={setEditStart}
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="Đến HH:mm"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                value={editEnd}
                onChangeText={setEditEnd}
              />
            </View>
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setEditingEntry(null)}
              >
                <Text style={styles.cancelText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.save, pressed && styles.pressed]}
                onPress={confirmEdit}
              >
                <Text style={styles.saveText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: { fontSize: 13, color: colors.textTertiary },
  totalKcal: { fontSize: 15, fontWeight: '800', color: colors.danger },
  card: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: colors.textTertiary, fontSize: 13, lineHeight: 19 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryMain: { flex: 1 },
  entryName: { color: colors.textBright, fontSize: 14, fontWeight: '500' },
  entryMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: colors.infoAlt, fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.5 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeInput: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.bgElevated },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  save: { backgroundColor: colors.infoAlt },
  saveText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
});

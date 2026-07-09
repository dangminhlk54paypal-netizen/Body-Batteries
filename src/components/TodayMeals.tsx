import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { summarizeFoodLog } from '../domain/food/foodLogSummary';
import { MEAL_LABELS } from '../lib/constants';
import type { FoodLogEntry } from '../types/food';
import { colors } from '../lib/theme';

interface Props {
  entries: FoodLogEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: { grams?: number; count?: number }) => void;
}

function timeLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Packs/capsules (TPCN) are displayed by count ("2 viên") rather than the
// converted gram weight — matches how the user actually thinks about a dose.
function amountLabel(entry: FoodLogEntry): string {
  if (entry.portionUnit === 'pack' && entry.count != null) {
    return `${entry.count} gói`;
  }
  if (entry.portionUnit === 'capsule' && entry.count != null) {
    return `${entry.count} viên`;
  }
  return `${entry.grams}g`;
}

// Portion-based entries (TPCN) are edited by count with a unit-matching label;
// everything else is edited by gram weight (the common "fix a typo" case).
function isPortionEntry(entry: FoodLogEntry): boolean {
  return entry.portionUnit === 'pack' || entry.portionUnit === 'capsule';
}

function countFieldLabel(entry: FoodLogEntry): string {
  return entry.portionUnit === 'capsule' ? 'Số viên' : 'Số gói';
}

export function TodayMeals({ entries, onDelete, onEdit }: Props) {
  const summary = summarizeFoodLog(entries);

  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const editingIsPortion = editingEntry != null && isPortionEntry(editingEntry);

  function startEdit(entry: FoodLogEntry) {
    setEditingEntry(entry);
    setEditAmount(isPortionEntry(entry) ? String(entry.count ?? '') : String(entry.grams));
  }

  function confirmEdit() {
    if (!editingEntry) return;
    const value = parseFloat(editAmount);
    if (isNaN(value) || value <= 0) {
      setEditingEntry(null);
      return;
    }
    onEdit(editingEntry.id, isPortionEntry(editingEntry) ? { count: value } : { grams: value });
    setEditingEntry(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Hôm nay đã ăn</Text>
        <Text style={styles.totalKcal}>⚡ {summary.totalKcal} kcal</Text>
      </View>

      {summary.groups.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Chưa có món nào được ghi hôm nay. Bấm “🍱 Ghi món ăn” để bắt đầu.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.macroLine}>
            Đạm {summary.totalProteinG}g · Carbs {summary.totalCarbG}g · Béo{' '}
            {summary.totalFatG}g
          </Text>
          {summary.groups.map((group) => (
            <View key={group.mealType} style={styles.card}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{MEAL_LABELS[group.mealType]}</Text>
                <Text style={styles.mealKcal}>{group.totalKcal} kcal</Text>
              </View>
              {group.entries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryMain}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.foodNameVi}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {timeLabel(e.timestamp)} · {amountLabel(e)} · {e.energyKcal} kcal
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
                    onPress={() => onDelete(e.id)}
                  >
                    <Text style={styles.deleteText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </>
      )}

      {/* Edit modal — prefilled with the tapped entry, saved via onEdit */}
      <Modal visible={editingEntry !== null} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Sửa món ăn</Text>
            {editingEntry && <Text style={styles.editingName}>{editingEntry.foodNameVi}</Text>}
            <TextInput
              style={styles.input}
              placeholder={editingIsPortion && editingEntry ? countFieldLabel(editingEntry) : 'Khối lượng (g)'}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
            />
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
  totalKcal: { fontSize: 15, fontWeight: '800', color: colors.accent },
  macroLine: { fontSize: 12, color: colors.textSubtle, marginTop: -4 },
  card: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: colors.textTertiary, fontSize: 13, lineHeight: 19 },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgElevated,
    paddingBottom: 6,
  },
  mealTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  mealKcal: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
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
  editingName: { fontSize: 14, color: colors.textSecondary, marginTop: -6 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.bgElevated },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  save: { backgroundColor: colors.infoAlt },
  saveText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
});

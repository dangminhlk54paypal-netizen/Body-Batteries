import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { summarizeFoodLog } from '../domain/food/foodLogSummary';
import { mealLabel } from '../lib/constants';
import type { FoodLogEntry } from '../types/food';
import { colors } from '../lib/theme';
import { NutritionDetailSheet } from './food/NutritionDetailSheet';
import { useT } from '../i18n/useT';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

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
function amountLabel(entry: FoodLogEntry, t: TFn): string {
  if (entry.portionUnit === 'pack' && entry.count != null) {
    return t('components.todayMeals.packCount', { count: entry.count });
  }
  if (entry.portionUnit === 'capsule' && entry.count != null) {
    return t('components.todayMeals.capsuleCount', { count: entry.count });
  }
  return `${entry.grams}g`;
}

// Portion-based entries (TPCN) are edited by count with a unit-matching label;
// everything else is edited by gram weight (the common "fix a typo" case).
function isPortionEntry(entry: FoodLogEntry): boolean {
  return entry.portionUnit === 'pack' || entry.portionUnit === 'capsule';
}

function countFieldLabel(entry: FoodLogEntry, t: TFn): string {
  return entry.portionUnit === 'capsule'
    ? t('components.todayMeals.countFieldLabelCapsule')
    : t('components.todayMeals.countFieldLabelPack');
}

export function TodayMeals({ entries, onDelete, onEdit }: Props) {
  const { t, language } = useT();
  const summary = summarizeFoodLog(entries);

  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  // The entry whose full nutrition breakdown is currently shown in the
  // read-only detail sheet (tap the row's main text area to open it).
  const [detailEntry, setDetailEntry] = useState<FoodLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const editingIsPortion = editingEntry != null && isPortionEntry(editingEntry);

  function startEdit(entry: FoodLogEntry) {
    setEditingEntry(entry);
    setEditAmount(isPortionEntry(entry) ? String(entry.count ?? '') : String(entry.grams));
  }

  function openDetail(entry: FoodLogEntry) {
    setDetailEntry(entry);
    setDetailVisible(true);
  }

  function closeDetail() {
    setDetailVisible(false);
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
        <Text style={styles.sectionLabel}>{t('components.todayMeals.sectionLabel')}</Text>
        <Text style={styles.totalKcal}>⚡ {summary.totalKcal} kcal</Text>
      </View>

      {summary.groups.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>{t('components.todayMeals.emptyText')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.macroLine}>
            {t('components.todayMeals.macroLine', {
              protein: summary.totalProteinG,
              carb: summary.totalCarbG,
              fat: summary.totalFatG,
            })}
          </Text>
          {summary.groups.map((group) => (
            <View key={group.mealType} style={styles.card}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{mealLabel(group.mealType, language)}</Text>
                <Text style={styles.mealKcal}>{group.totalKcal} kcal</Text>
              </View>
              {group.entries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <Pressable
                    style={({ pressed }) => [styles.entryMain, pressed && styles.pressed]}
                    onPress={() => openDetail(e)}
                  >
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.foodNameVi}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {timeLabel(e.timestamp)} · {amountLabel(e, t)} · {e.energyKcal} kcal
                    </Text>
                  </Pressable>
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

      {/* Edit modal — prefilled with the tapped entry, saved via onEdit.
          `!detailVisible` guard: two RN <Modal visible> at once make the
          second one not render on iOS (same fix as DayDetailSheet / the
          FoodLogModal editingNutrition guard). */}
      <Modal visible={editingEntry !== null && !detailVisible} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('components.todayMeals.editModalTitle')}</Text>
            {editingEntry && <Text style={styles.editingName}>{editingEntry.foodNameVi}</Text>}
            <TextInput
              style={styles.input}
              placeholder={
                editingIsPortion && editingEntry
                  ? countFieldLabel(editingEntry, t)
                  : t('components.todayMeals.gramsFieldLabel')
              }
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
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.save, pressed && styles.pressed]}
                onPress={confirmEdit}
              >
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Read-only nutrition breakdown for the tapped entry */}
      <NutritionDetailSheet entry={detailEntry} visible={detailVisible} onClose={closeDetail} />
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

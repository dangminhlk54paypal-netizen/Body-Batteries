import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  logWeight,
  getWeightHistory,
  updateWeight,
  type WeightEntry,
} from '../data/repositories/healthSignalsRepository';
import { dateString, todayString, daysBetween, formatDisplayDate } from '../lib/dateUtils';
import { PROFILE_LIMITS } from '../lib/metabolicConstants';
import { WEIGHT_EDIT_MAX_DAYS_BACK } from '../lib/constants';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { useT } from '../i18n/useT';

// Recent history fetched so "Xem thêm" has older rows to reveal beyond the
// always-visible window below — well past DATA_RETENTION_DAYS's typical use.
const FETCH_LIMIT = 60;
// Always-visible rows before the "Xem thêm"/"Ẩn bớt" toggle appears.
const VISIBLE_COUNT = 7;

interface Props {
  // Called after a successful log OR edit — lets HistoryScreen refresh the
  // day-detail weight it fetches independently, without waiting for this
  // card's own next focus-driven reload.
  onChanged?: () => void;
}

export function WeightLogCard({ onChanged }: Props = {}) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [weightText, setWeightText] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [editValueText, setEditValueText] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    setEntries(await getWeightHistory(FETCH_LIMIT));
  }

  async function handleLog() {
    const parsed = parseDecimal(weightText);
    const { min, max } = PROFILE_LIMITS.weightKg;
    if (isNaN(parsed) || parsed < min || parsed > max) return;
    const rounded = Math.round(parsed * 10) / 10;
    await logWeight(rounded);
    setWeightText('');
    await loadEntries();
    onChanged?.();
  }

  function startEdit(entry: WeightEntry) {
    setEditingEntry(entry);
    setEditValueText(entry.value.toFixed(1));
  }

  async function confirmEdit() {
    if (!editingEntry) return;
    const parsed = parseDecimal(editValueText);
    const { min, max } = PROFILE_LIMITS.weightKg;
    if (isNaN(parsed) || parsed < min || parsed > max) return;
    const rounded = Math.round(parsed * 10) / 10;
    await updateWeight(editingEntry.id, rounded);
    setEditingEntry(null);
    await loadEntries();
    onChanged?.();
  }

  const visibleEntries = expanded ? entries : entries.slice(0, VISIBLE_COUNT);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('components.weightLogCard.title')}</Text>
      <Text style={styles.subtitle}>{t('components.weightLogCard.subtitle')}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('components.weightLogCard.weightPlaceholder')}
          placeholderTextColor={c.textMuted}
          keyboardType="decimal-pad"
          value={weightText}
          onChangeText={setWeightText}
        />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={handleLog}
        >
          <Text style={styles.btnText}>{t('components.weightLogCard.logButton')}</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t('components.weightLogCard.emptyText')}</Text>
      ) : (
        <>
          {visibleEntries.map((e) => {
            const dayKey = dateString(new Date(e.timestamp));
            const canEdit = daysBetween(dayKey, todayString()) <= WEIGHT_EDIT_MAX_DAYS_BACK;
            return (
              <View key={e.id} style={styles.entryRow}>
                <Text style={styles.entryDate}>{formatDisplayDate(dayKey, language)}</Text>
                <View style={styles.entryRight}>
                  <Text style={styles.entryValue}>{e.value.toFixed(1)} kg</Text>
                  {canEdit && (
                    <Pressable
                      hitSlop={10}
                      style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                      onPress={() => startEdit(e)}
                      accessibilityLabel={t('common.edit')}
                    >
                      <Text style={styles.editText}>✎</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {entries.length > VISIBLE_COUNT && (
            <Pressable
              style={({ pressed }) => [styles.seeMoreBtn, pressed && styles.pressed]}
              onPress={() => setExpanded((v) => !v)}
            >
              <Text style={styles.seeMoreText}>
                {expanded ? t('common.seeLess') : t('common.seeMore')}
              </Text>
            </Pressable>
          )}
        </>
      )}

      <Modal
        visible={editingEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingEntry(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>{t('components.weightLogCard.editModalTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('components.weightLogCard.weightPlaceholder')}
              placeholderTextColor={c.textMuted}
              keyboardType="decimal-pad"
              value={editValueText}
              onChangeText={setEditValueText}
              autoFocus
            />
            <View style={styles.modalRow}>
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
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.bgElevated,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 12, color: c.textTertiary, lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  btn: {
    backgroundColor: c.accentAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  btnText: { color: c.textPrimary, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.6 },
  empty: { color: c.textFaint, fontSize: 13 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.bgElevated,
  },
  entryDate: { color: c.textSoft, fontSize: 13 },
  entryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryValue: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: c.infoAlt, fontSize: 12, fontWeight: '700' },
  seeMoreBtn: { alignItems: 'center', paddingVertical: 8 },
  seeMoreText: { color: c.infoAlt, fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  save: { backgroundColor: c.infoAlt },
  saveText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
});

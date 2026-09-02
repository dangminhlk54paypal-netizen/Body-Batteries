import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { summarizeFoodLog } from '../domain/food/foodLogSummary';
import { mealLabel } from '../lib/constants';
import { foodLogEntryDisplayName, getAnyFoodById } from '../data/food/foodLookup';
import {
  formatLoggedPortion,
  isPortionCounted,
  measureUnitOf,
  portionUnitNoun,
} from '../domain/food/portionUnits';
import { ShareDayFoodCard } from './food/ShareDayFoodCard';
import { shareTodayFoodCard } from '../services/share/dayFoodShareService';
import type { FoodLogEntry } from '../types/food';
import type { Language } from '../i18n/types';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
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

// Counted portions (TPCN packs/capsules, boxes, bottles) are displayed by
// count — "2 hộp (130ml)" — rather than only the converted gram weight, which
// is how the user actually thinks about a dose. Shared formatter, so this
// wording matches DayDetailSheet / NutritionDetailSheet / the micro sources.
function amountLabel(entry: FoodLogEntry, language: Language): string {
  return formatLoggedPortion(entry, getAnyFoodById(entry.foodId), language);
}

// Portion-based entries are edited by count with a unit-matching label;
// everything else is edited by weight/volume (the common "fix a typo" case).
function isPortionEntry(entry: FoodLogEntry): boolean {
  return isPortionCounted(entry.portionUnit);
}

function countFieldLabel(entry: FoodLogEntry, language: Language, t: TFn): string {
  const food = getAnyFoodById(entry.foodId);
  return t('components.todayMeals.countFieldLabel', {
    unit: portionUnitNoun(entry.portionUnit, food?.servingLabel, language),
  });
}

export function TodayMeals({ entries, onDelete, onEdit }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const summary = summarizeFoodLog(entries);

  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  // The entry whose full nutrition breakdown is currently shown in the
  // read-only detail sheet (tap the row's main text area to open it).
  const [detailEntry, setDetailEntry] = useState<FoodLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // "Share as image" (Session 25): a full, never-clipped copy of today's food
  // list rendered off-screen (see the hidden <ShareDayFoodCard> mount below)
  // purely so shareTodayFoodCard has a real native view to snapshot — this
  // component never shows it to the user directly.
  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

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

  async function handleShare() {
    if (sharing) return; // guard against a fast double-tap firing two captures
    setSharing(true);
    try {
      await shareTodayFoodCard(shareCardRef, language);
    } catch (e) {
      console.warn('shareTodayFoodCard failed:', e);
      Alert.alert(t('common.error'), t('components.todayMeals.shareErrorMessage'));
    } finally {
      setSharing(false);
    }
  }

  function confirmEdit() {
    if (!editingEntry) return;
    const value = parseDecimal(editAmount);
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
        <View style={styles.headerRight}>
          <Text style={styles.totalKcal}>⚡ {summary.totalKcal} kcal</Text>
          {entries.length > 0 && (
            <Pressable
              onPress={handleShare}
              disabled={sharing}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('components.todayMeals.shareButtonA11y')}
              style={({ pressed }) => [
                styles.shareBtn,
                (pressed || sharing) && styles.pressed,
              ]}
            >
              <Text style={styles.shareIcon}>⤴</Text>
            </Pressable>
          )}
        </View>
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
                      {foodLogEntryDisplayName(e, language)}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {timeLabel(e.timestamp)} · {amountLabel(e, language)} · {e.energyKcal} kcal
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
            {editingEntry && (
              <Text style={styles.editingName}>{foodLogEntryDisplayName(editingEntry, language)}</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder={
                editingIsPortion && editingEntry
                  ? countFieldLabel(editingEntry, language, t)
                  : t('components.todayMeals.gramsFieldLabel', {
                      measure: measureUnitOf(
                        editingEntry ? getAnyFoodById(editingEntry.foodId) : undefined
                      ),
                    })
              }
              placeholderTextColor={c.textMuted}
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

      {/* Never rendered on screen — positioned far off-canvas so it still
          lays out (and can be captured) without ever being visible or
          intercepting touches. Mounted only when there's something to
          share, matching the share button's own visibility above. */}
      {entries.length > 0 && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareDayFoodCard ref={shareCardRef} entries={entries} />
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: { fontSize: 13, color: c.textTertiary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalKcal: { fontSize: 15, fontWeight: '800', color: c.accent },
  shareBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: { color: c.infoAlt, fontSize: 13, fontWeight: '700' },
  // Far enough off-canvas that it can never intrude, at any screen size.
  offscreen: { position: 'absolute', top: -100000, left: 0 },
  macroLine: { fontSize: 12, color: c.textSubtle, marginTop: -4 },
  card: {
    backgroundColor: c.bgHighlight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: c.textTertiary, fontSize: 13, lineHeight: 19 },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.bgElevated,
    paddingBottom: 6,
  },
  mealTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  mealKcal: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryMain: { flex: 1 },
  entryName: { color: c.textBright, fontSize: 14, fontWeight: '500' },
  entryMeta: { color: c.textTertiary, fontSize: 12, marginTop: 1 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: c.infoAlt, fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: c.danger, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.5 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  editingName: { fontSize: 14, color: c.textSecondary, marginTop: -6 },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: c.bgElevated },
  cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  save: { backgroundColor: c.infoAlt },
  saveText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
});

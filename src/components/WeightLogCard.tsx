import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Alert,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line } from 'react-native-svg';
import {
  logWeightAt,
  getWeightHistory,
  updateWeight,
  deleteWeight,
  type WeightEntry,
} from '../data/repositories/healthSignalsRepository';
import { todayString, dateString, formatDisplayDate, formatMonthYear } from '../lib/dateUtils';
import {
  groupWeightHistoryByMonth,
  isTrendTowardGoal,
  weightGoalDirection,
  type WeightTrend,
} from '../domain/health/weightHistoryGroups';
import { useSettingsStore } from '../store/settingsStore';
import { WeightTrendChart } from './WeightTrendChart';
import { PROFILE_LIMITS } from '../lib/metabolicConstants';
import { suspiciousWeightIds } from '../domain/health/weightOutliers';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { parseDecimal } from '../lib/units';
import { parseDayMonthInput } from '../lib/dateInput';
import { weighInTimestamp } from '../domain/health/weighIn';
import { useT } from '../i18n/useT';

// Weight readings are never pruned by the retention cleanup, so the log can
// span many months — ~3 years of daily readings is plenty for the list.
const FETCH_LIMIT = 1000;
// The history list scrolls INSIDE a fixed-height frame (instead of a
// "Xem thêm" toggle that stretched the whole History page), so a long log
// never pushes the rest of the screen down. ≈ 1 month header + 7 rows.
const LIST_MAX_HEIGHT = 300;
// Past this many readings the list overflows the frame — show the hint.
const HINT_THRESHOLD = 7;

const TREND_ARROW: Record<WeightTrend, string> = { up: '▲', down: '▼', same: '' };

interface Props {
  // Bumped by the parent screen when the user scrolls it — collapses the
  // chart's tap caption (see WeightTrendChart).
  dismissKey?: number;
  // Called after a successful log OR edit — lets HistoryScreen refresh the
  // day-detail weight it fetches independently, without waiting for this
  // card's own next focus-driven reload.
  onChanged?: () => void;
}

export function WeightLogCard({ onChanged, dismissKey = 0 }: Props = {}) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [weightText, setWeightText] = useState('');
  // Blank = today. "14.09" logs the reading for that earlier day (a weight
  // from old notes), so the strength chart's ratio has it.
  const [dateText, setDateText] = useState('');
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [editValueText, setEditValueText] = useState('');
  const heightCm = useSettingsStore((s) => s.userProfile.heightCm);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    setEntries(await getWeightHistory(FETCH_LIMIT));
  }

  // Day-first like the notebook ("14.09"); month-first in English.
  const dateOrder = language === 'en' ? 'md' : 'dm';
  const today = todayString();
  const logDate = dateText.trim() === '' ? today : parseDayMonthInput(dateText, today, dateOrder);

  async function handleLog() {
    const parsed = parseDecimal(weightText);
    const { min, max } = PROFILE_LIMITS.weightKg;
    if (isNaN(parsed) || parsed < min || parsed > max || !logDate) return;
    const rounded = Math.round(parsed * 10) / 10;
    await logWeightAt(weighInTimestamp(logDate, Date.now()), rounded);
    setWeightText('');
    setDateText('');
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

  function confirmDelete() {
    const entry = editingEntry;
    if (!entry) return;
    Alert.alert(
      t('components.weightLogCard.deleteConfirmTitle'),
      t('components.weightLogCard.deleteConfirmMessage', {
        kg: entry.value.toFixed(1),
        date: formatDisplayDate(dateString(new Date(entry.timestamp)), language),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteWeight(entry.id);
            setEditingEntry(null);
            await loadEntries();
            onChanged?.();
          },
        },
      ]
    );
  }

  const groups = groupWeightHistoryByMonth(entries);
  // Readings that jump away from both neighbours — likely typos, worth a look.
  const suspicious = suspiciousWeightIds(entries);
  // One direction for the whole list, from the NEWEST reading: above the
  // healthy range losing is green, below it gaining is, inside it neutral.
  const goal = entries.length > 0 ? weightGoalDirection(entries[0].value, heightCm) : 'maintain';
  const trendColor = (trend: WeightTrend | null) => {
    const toward = isTrendTowardGoal(trend, goal);
    return toward == null ? c.textTertiary : toward ? c.weightTrendToward : c.weightTrendAway;
  };
  // Month headers stick to the top of the frame while their rows scroll;
  // ScrollView needs the child index of each header among its flat children.
  const stickyHeaderIndices: number[] = [];
  let childIndex = 0;
  for (const g of groups) {
    stickyHeaderIndices.push(childIndex);
    childIndex += 1 + g.rows.length;
  }

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
        <TextInput
          style={[styles.input, styles.dateInput]}
          placeholder={t('components.weightLogCard.datePlaceholder')}
          placeholderTextColor={c.textMuted}
          keyboardType="numbers-and-punctuation"
          value={dateText}
          onChangeText={setDateText}
          accessibilityLabel={t('components.weightLogCard.dateLabel')}
        />
        <Pressable
          disabled={!logDate}
          style={({ pressed }) => [styles.btn, !logDate && styles.btnDisabled, pressed && styles.pressed]}
          onPress={handleLog}
        >
          <Text style={styles.btnText}>
            {logDate && logDate !== today
              ? t('components.weightLogCard.logForDate', { date: formatDisplayDate(logDate, language) })
              : t('components.weightLogCard.logButton')}
          </Text>
        </Pressable>
      </View>
      {!logDate ? <Text style={styles.dateError}>{t('components.weightLogCard.dateInvalid')}</Text> : null}

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t('components.weightLogCard.emptyText')}</Text>
      ) : (
        <>
          <WeightTrendChart entries={entries} dismissKey={dismissKey} />
          <Text style={styles.listMeta}>
            {t('components.weightLogCard.entryCount', { count: entries.length })}
            {entries.length > HINT_THRESHOLD
              ? ` · ${t('components.weightLogCard.scrollHint')}`
              : ''}
          </Text>
          <ScrollView
            style={styles.listFrame}
            nestedScrollEnabled
            persistentScrollbar
            stickyHeaderIndices={stickyHeaderIndices}
          >
            {groups.flatMap((g) => [
              <View key={`m-${g.monthKey}`} style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{formatMonthYear(g.monthKey, language)}</Text>
                <Text style={styles.monthSummary}>
                  {t('components.weightLogCard.monthSummary', {
                    avg: g.average.toFixed(1),
                    count: g.rows.length,
                  })}
                </Text>
              </View>,
              ...g.rows.map(({ entry: e, dayKey, trend, weekBreakAbove }) => {
                const isSuspicious = suspicious.has(e.id);
                return (
                  <View key={e.id} style={styles.entryRow}>
                    {/* Light dashed line between Mon–Sun weeks (an SVG line:
                        RN's one-sided dashed border is unreliable on iOS). */}
                    {weekBreakAbove && (
                      <Svg style={styles.weekBreak}>
                        <Line
                          x1="0"
                          y1="0.5"
                          x2="100%"
                          y2="0.5"
                          stroke={c.textFaint}
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                      </Svg>
                    )}
                    <Text style={styles.entryDate}>
                      {formatDisplayDate(dayKey, language)}
                      {isSuspicious ? (
                        <Text style={styles.suspicious} accessibilityLabel={t('components.weightLogCard.suspiciousA11y')}>
                          {'  '}
                          {t('components.weightLogCard.suspiciousBadge')}
                        </Text>
                      ) : null}
                    </Text>
                    <View style={styles.entryRight}>
                      <Text style={[styles.entryArrow, { color: trendColor(trend) }]}>
                        {trend ? TREND_ARROW[trend] : ''}
                      </Text>
                      <Text
                        style={[
                          styles.entryValue,
                          isTrendTowardGoal(trend, goal) != null && { color: trendColor(trend) },
                          isSuspicious && styles.suspicious,
                        ]}
                      >
                        {e.value.toFixed(1)} kg
                      </Text>
                      <Pressable
                        hitSlop={10}
                        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                        onPress={() => startEdit(e)}
                        accessibilityLabel={t('common.edit')}
                      >
                        <Text style={styles.editText}>✎</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }),
            ])}
          </ScrollView>
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
            <Text style={styles.modalTitle}>
              {editingEntry
                ? t('components.weightLogCard.editModalTitleDate', {
                    date: formatDisplayDate(dateString(new Date(editingEntry.timestamp)), language),
                  })
                : t('components.weightLogCard.editModalTitle')}
            </Text>
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
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={confirmDelete}
            >
              <Text style={styles.deleteText}>{t('components.weightLogCard.deleteButton')}</Text>
            </Pressable>
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
  btnDisabled: { opacity: 0.4 },
  dateInput: { flex: 0, width: 84 },
  dateError: { color: c.danger, fontSize: 12 },
  pressed: { opacity: 0.6 },
  empty: { color: c.textFaint, fontSize: 13 },
  listMeta: { color: c.textTertiary, fontSize: 12 },
  listFrame: {
    maxHeight: LIST_MAX_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.bgElevated,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 12,
    paddingVertical: 7,
    // Opaque so rows scrolling underneath the sticky header don't show through.
    backgroundColor: c.bgElevated,
  },
  monthTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
  monthSummary: { color: c.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  weekBreak: { position: 'absolute', top: 0, left: 12, right: 12, height: 1 },
  entryDate: { color: c.textSoft, fontSize: 13 },
  entryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryArrow: { fontSize: 10, minWidth: 12, textAlign: 'right' },
  entryValue: {
    color: c.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  suspicious: { color: c.warning },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: c.infoAlt, fontSize: 12, fontWeight: '700' },
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
  deleteBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  deleteText: { color: c.dangerStrong, fontSize: 14, fontWeight: '600' },
});

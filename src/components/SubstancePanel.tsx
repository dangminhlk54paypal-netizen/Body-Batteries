import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { useChargeEffectStore } from '../store/chargeEffectStore';
import { FOOD_ITEMS } from '../data/food/foodDatabase';
import { getCustomFoods } from '../data/food/customFoodRegistry';
import { getAnyFoodById, foodDisplayName, foodLogEntryDisplayName } from '../data/food/foodLookup';
import { gramsForPortion } from '../domain/food/foodNutrition';
import type { SubstanceFlag } from '../domain/nutrition/substanceEngine';
import type { SubstanceJournal } from '../hooks/useSubstanceJournal';
import {
  CAFFEINE_DAILY_LIMIT_MG,
  CAFFEINE_SLEEP_GAP_H,
  SUBSTANCE_DAILY_MARK_MG,
  type SubstanceId,
} from '../lib/substanceLimits';
import { formatTimeHHmm, isToday, weekdayLabel } from '../lib/dateUtils';
import { LOCALE_TAGS } from '../i18n/types';
import type { FoodItem } from '../types/food';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

// ☕ Caffeine & hoạt chất — body of the Home fold row. Everything shown is
// derived by domain/nutrition/substanceEngine.ts from the food log (the log
// IS the diary); this view only lays it out:
//   caffeine bar vs 400 mg · flag chips · taurine/L-carnitine/creatine cells
//   · 7-day strip (tap a day) · that day's caffeine diary · habit note
//   · one-tap chips for caffeinated drinks · bedtime stepper.
// Sources, long-term notes and the training dose live behind the row's ⓘ.

interface Props {
  journal: SubstanceJournal;
}

const OTHER_SUBSTANCES: SubstanceId[] = ['taurine', 'carnitine', 'creatine'];
const STRIP_BAR_H = 34;

const CAFFEINATED_CATALOG = FOOD_ITEMS.filter((f) => (f.per100g.caffeineMg ?? 0) > 0);

function defaultGrams(item: FoodItem): number {
  return item.portionUnit != null && item.portionUnit !== 'gram'
    ? gramsForPortion(item, 1)
    : item.defaultServingG;
}

export function SubstancePanel({ journal }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logFood = useEnergyStore((s) => s.logFood);
  const setBedtimeHour = useSettingsStore((s) => s.setBedtimeHour);
  const [selectedDate, setSelectedDate] = useState(journal.today.date);
  const [logging, setLogging] = useState(false);

  const day = journal.days.find((d) => d.date === selectedDate) ?? journal.today;
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(LOCALE_TAGS[language], { maximumFractionDigits: digits });

  // Caffeinated drinks for one-tap logging: the catalog's plus the user's own
  // foods that declare caffeine — override-aware like SupplementQuickLog.
  const quickItems = useMemo(() => {
    const custom = getCustomFoods().filter((f) => (f.per100g.caffeineMg ?? 0) > 0);
    return [...CAFFEINATED_CATALOG, ...custom].map((f) => getAnyFoodById(f.id) ?? f);
  }, []);

  async function logOne(item: FoodItem) {
    if (logging) return;
    setLogging(true);
    try {
      const counted = item.portionUnit != null && item.portionUnit !== 'gram';
      await logFood(
        item,
        defaultGrams(item),
        Date.now(),
        counted ? { portionUnit: item.portionUnit, count: 1 } : undefined
      );
      useChargeEffectStore.getState().triggerChargePulse();
      haptics.tapLight();
      setSelectedDate(journal.today.date);
    } finally {
      setLogging(false);
    }
  }

  const caffeine = day.totals.caffeine;
  const caffeinePct = Math.min(100, (100 * caffeine) / CAFFEINE_DAILY_LIMIT_MG);
  const barColor =
    caffeine > CAFFEINE_DAILY_LIMIT_MG ? c.statusLow : caffeinePct >= 75 ? c.statusMid : c.statusGood;
  const stripMax = Math.max(CAFFEINE_DAILY_LIMIT_MG, ...journal.days.map((d) => d.totals.caffeine));
  const lateFrom = String((journal.bedtimeHour - CAFFEINE_SLEEP_GAP_H + 24) % 24).padStart(2, '0');

  function flagLabel(f: SubstanceFlag): string {
    switch (f.id) {
      case 'caffeineDaily':
        return t('components.substancePanel.flagDaily', { value: fmt(f.value), mark: fmt(f.mark) });
      case 'caffeineDose':
        return t('components.substancePanel.flagDose', { value: fmt(f.value), mark: fmt(f.mark) });
      case 'caffeineLate':
        return t('components.substancePanel.flagLate', { value: fmt(f.value), from: `${lateFrom}:00` });
      case 'taurineDaily':
        return t('components.substancePanel.flagTaurine', {
          value: fmt(f.value / 1000, 1),
          mark: fmt(f.mark / 1000, 1),
        });
      case 'carnitineDaily':
        return t('components.substancePanel.flagCarnitine', { value: fmt(f.value), mark: fmt(f.mark) });
      case 'creatineHigh':
        return t('components.substancePanel.flagCreatine', {
          value: fmt(f.value / 1000, 1),
          mark: fmt(f.mark / 1000),
        });
    }
  }

  function cellValue(id: SubstanceId, mg: number): string {
    const mark = SUBSTANCE_DAILY_MARK_MG[id];
    // Taurine/creatine read naturally in g, L-carnitine in mg.
    if (id === 'carnitine') return `${fmt(mg)} / ${fmt(mark)} mg`;
    return `${fmt(mg / 1000, 1)} / ${fmt(mark / 1000)} g`;
  }

  const dayLabel = isToday(day.date)
    ? t('common.today')
    : weekdayLabel(new Date(`${day.date}T00:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6, language);

  return (
    <View style={styles.container}>
      {/* Caffeine vs the EFSA 400 mg/day mark */}
      <View style={styles.meterHeader}>
        <Text style={styles.meterTitle}>
          {t('substances.caffeine.name')} · {dayLabel}
        </Text>
        <Text style={styles.meterValue}>
          {fmt(caffeine)} / {fmt(CAFFEINE_DAILY_LIMIT_MG)} mg
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${caffeinePct}%`, backgroundColor: barColor }]} />
      </View>

      {day.flags.length > 0 && (
        <View style={styles.flagRow}>
          {day.flags.map((f) => (
            <View key={f.id} style={styles.flagChip}>
              <Text style={styles.flagText} numberOfLines={1}>
                {flagLabel(f)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* The other three substances, equal cells */}
      <View style={styles.cellRow}>
        {OTHER_SUBSTANCES.map((id) => {
          const mg = day.totals[id];
          return (
            <View key={id} style={[styles.cell, mg <= 0 && styles.cellEmpty]}>
              <Text style={styles.cellName} numberOfLines={1} adjustsFontSizeToFit>
                {t(`substances.${id}.short`)}
              </Text>
              <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>
                {cellValue(id, mg)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 7-day strip: tap a day to read its diary below */}
      <View style={styles.strip}>
        {journal.days.map((d) => {
          const h = Math.round((STRIP_BAR_H * d.totals.caffeine) / stripMax);
          const over = d.flags.some((f) => f.id === 'caffeineDaily');
          const late = d.flags.some((f) => f.id === 'caffeineLate');
          const selected = d.date === day.date;
          const dow = new Date(`${d.date}T00:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          return (
            <Pressable
              key={d.date}
              onPress={() => setSelectedDate(d.date)}
              style={[styles.stripCol, selected && styles.stripColSelected]}
              accessibilityRole="button"
              accessibilityLabel={t('components.substancePanel.stripA11y', {
                day: weekdayLabel(dow, language),
                mg: fmt(d.totals.caffeine),
              })}
            >
              <View style={styles.stripBarBox}>
                <View
                  style={[
                    styles.stripBar,
                    { height: Math.max(d.totals.caffeine > 0 ? 2 : 0, h) },
                    { backgroundColor: over ? c.statusLow : c.info },
                  ]}
                />
              </View>
              <Text style={[styles.stripDay, selected && styles.stripDaySelected]} numberOfLines={1}>
                {weekdayLabel(dow, language, 'short')}
              </Text>
              <Text style={styles.stripMoon}>{late ? '🌙' : ' '}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* That day's caffeine diary */}
      <ScrollView style={styles.diary} nestedScrollEnabled>
        {day.caffeineIntakes.length === 0 ? (
          <Text style={styles.diaryEmpty}>{t('components.substancePanel.diaryEmpty')}</Text>
        ) : (
          day.caffeineIntakes.map((i) => (
            <View key={i.entry.id} style={styles.diaryRow}>
              <Text style={styles.diaryTime}>{formatTimeHHmm(i.entry.timestamp)}</Text>
              <Text style={styles.diaryName} numberOfLines={1}>
                {foodLogEntryDisplayName(i.entry, language)}
              </Text>
              <Text style={styles.diaryMg}>
                {i.late ? '🌙 ' : ''}
                {fmt(i.mg)} mg
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Long-term view over the 7 days */}
      <Text style={styles.weekLine}>
        {t('components.substancePanel.weekAverage', {
          mg: fmt(journal.habits.averageCaffeineMg),
          days: journal.habits.caffeineDays,
        })}
      </Text>
      {journal.habits.habits.map((h) => (
        <Text key={h} style={styles.habitLine}>
          {h === 'caffeineDailyHabit'
            ? t('components.substancePanel.habitDaily', { days: journal.habits.daysOverDaily })
            : t('components.substancePanel.habitLate', { days: journal.habits.lateDays })}
        </Text>
      ))}

      {/* One-tap caffeinated drinks */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {quickItems.map((item) => {
          const mg = ((item.per100g.caffeineMg ?? 0) * defaultGrams(item)) / 100;
          return (
            <Pressable
              key={item.id}
              disabled={logging}
              onPress={() => logOne(item)}
              style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
              accessibilityLabel={t('components.substancePanel.quickA11y', {
                name: foodDisplayName(item, language),
                mg: fmt(mg),
              })}
            >
              <Text style={styles.quickName} numberOfLines={1}>
                ＋ {foodDisplayName(item, language)}
              </Text>
              <Text style={styles.quickMeta}>≈ {fmt(mg)} mg</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Bedtime — drives the 🌙 "late" flag */}
      <View style={styles.bedtimeRow}>
        <Text style={styles.bedtimeLabel}>{t('components.substancePanel.bedtimeLabel')}</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setBedtimeHour(journal.bedtimeHour - 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            hitSlop={6}
            accessibilityLabel={t('components.substancePanel.bedtimeEarlier')}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.bedtimeValue}>{String(journal.bedtimeHour).padStart(2, '0')}:00</Text>
          <Pressable
            onPress={() => setBedtimeHour(journal.bedtimeHour + 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            hitSlop={6}
            accessibilityLabel={t('components.substancePanel.bedtimeLater')}
          >
            <Text style={styles.stepText}>＋</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
    meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    meterTitle: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
    meterValue: { fontSize: 15, color: c.textPrimary, fontWeight: '700' },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: c.bgElevated, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4 },
    flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    flagChip: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.overdoseBorder,
      backgroundColor: c.overdoseBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    flagText: { fontSize: 11, color: c.overdoseText },
    cellRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    cell: {
      flex: 1,
      backgroundColor: c.bgCard,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      paddingVertical: 6,
      paddingHorizontal: 6,
      alignItems: 'center',
      gap: 2,
    },
    cellEmpty: { opacity: 0.55 },
    cellName: { fontSize: 11, color: c.textTertiary },
    cellValue: { fontSize: 12, color: c.textPrimary, fontWeight: '600' },
    strip: { flexDirection: 'row', gap: 4 },
    stripCol: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    stripColSelected: { borderColor: c.accent, backgroundColor: c.bgCard },
    stripBarBox: { height: STRIP_BAR_H, width: 12, justifyContent: 'flex-end' },
    stripBar: { width: 12, borderRadius: 3 },
    stripDay: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    stripDaySelected: { color: c.textPrimary, fontWeight: '700' },
    stripMoon: { fontSize: 9, lineHeight: 12 },
    diary: { maxHeight: 130 },
    diaryEmpty: { fontSize: 12, color: c.textMuted, paddingVertical: 4 },
    diaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    diaryTime: { fontSize: 12, color: c.textMuted, width: 42 },
    diaryName: { flex: 1, fontSize: 12, color: c.textLight },
    diaryMg: { fontSize: 12, color: c.textPrimary, fontWeight: '600' },
    weekLine: { fontSize: 11, color: c.textTertiary },
    habitLine: { fontSize: 11, color: c.statusMid, fontWeight: '600' },
    quickRow: { gap: 8 },
    quickChip: {
      backgroundColor: c.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: 170,
    },
    quickName: { fontSize: 12, color: c.textLight, fontWeight: '600' },
    quickMeta: { fontSize: 10, color: c.textMuted },
    bedtimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 40,
    },
    bedtimeLabel: { fontSize: 13, color: c.textSecondary },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { fontSize: 15, color: c.textPrimary },
    bedtimeValue: { fontSize: 14, color: c.textPrimary, fontWeight: '700', minWidth: 46, textAlign: 'center' },
    pressed: { opacity: 0.6 },
  });

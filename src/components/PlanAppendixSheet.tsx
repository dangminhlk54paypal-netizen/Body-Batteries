import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { InfoPopover } from './ui/InfoPopover';
import { useBlockStore } from '../store/blockStore';
import { weekdayLabel } from '../lib/dateUtils';
import { useT } from '../i18n/useT';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import type { ResolvedDayPlan, ResolvedVariationPlan, BlockWeekPlan } from '../types/powerliftingBlock';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreateNew?: () => void;
}

export function PlanAppendixSheet({ visible, onClose, onCreateNew }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const activeBlock = useBlockStore((s) => s.activeBlock);
  const loadActiveBlock = useBlockStore((s) => s.loadActiveBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);

  // Same promise-based load-on-open pattern as PowerliftingSheet's history
  // fetch — the store's own `set()` inside loadActiveBlock, not a local
  // setState call, so there's nothing here for the set-state-in-effect rule
  // to flag.
  useEffect(() => {
    if (!visible) return;
    loadActiveBlock();
  }, [visible, loadActiveBlock]);

  function handleDelete() {
    if (!activeBlock) return;
    const id = activeBlock.config.id;
    Alert.alert(t('planAppendix.deleteConfirmTitle'), t('planAppendix.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteBlock(id) },
    ]);
  }

  function renderVariation(variation: ResolvedVariationPlan, index: number) {
    const working = variation.sets[0];
    if (!working) return null;
    return (
      <View key={index} style={styles.variationRow}>
        <View style={styles.variationHeaderRow}>
          <Text style={styles.variationLabel}>{t(`blockVariations.${variation.variation.variationId}.label`)}</Text>
          <InfoPopover
            title={t(`blockVariations.${variation.variation.variationId}.label`)}
            body={t(`blockVariations.${variation.variation.variationId}.rationale`)}
          />
        </View>
        <Text style={styles.variationDetail}>
          {t('planAppendix.variationSetsLine', {
            sets: variation.sets.length,
            reps: working.reps,
            weight: working.weightKg,
            pct: variation.pct1rm,
          })}
        </Text>
        <Text style={styles.variationKcal}>{t('planAppendix.kcalLine', { kcal: variation.estimatedKcal })}</Text>
      </View>
    );
  }

  function renderDay(day: ResolvedDayPlan, index: number) {
    return (
      <View key={index} style={styles.dayCard}>
        <Text style={styles.dayTitle}>{weekdayLabel(day.dayOfWeek, language, 'long')}</Text>
        {day.variations.map(renderVariation)}
        {day.accessories.length > 0 && (
          <View style={styles.accessoriesBlock}>
            <Text style={styles.sectionTitle}>{t('planAppendix.accessoriesSectionTitle')}</Text>
            {day.accessories.map((acc, i) => (
              <Text key={i} style={styles.accessoryLine}>
                {t('planAppendix.accessoryLine', { name: acc.customName, sets: acc.sets, reps: acc.reps })}
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.dayTotal}>{t('planAppendix.dayTotalLabel', { kcal: day.totalKcal })}</Text>
      </View>
    );
  }

  function renderWeek(week: BlockWeekPlan) {
    const title = week.isDeload
      ? `${t('planAppendix.weekLabel', { number: week.weekNumber })} · ${t('planAppendix.deloadBadge')}`
      : t('planAppendix.weekLabel', { number: week.weekNumber });
    return (
      <CollapsibleSection key={week.weekNumber} title={title} defaultExpanded={week.weekNumber === 1}>
        {week.days.map(renderDay)}
        <Text style={styles.weekTotal}>{t('planAppendix.weekTotalLabel', { kcal: week.totalKcal })}</Text>
        {week.weeklyDeficitTargetKcal != null && (
          <Text style={styles.weekTotal}>
            {t('planAppendix.weeklyDeficitTargetLabel', { kcal: week.weeklyDeficitTargetKcal })}
          </Text>
        )}
      </CollapsibleSection>
    );
  }

  const config = activeBlock?.config;
  const anyBeginnerEstimated = config
    ? config.isBeginnerEstimated.squat || config.isBeginnerEstimated.bench_press || config.isBeginnerEstimated.deadlift
    : false;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={700}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('planAppendix.title')}</Text>

        {!activeBlock ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{t('planAppendix.emptyState')}</Text>
            {onCreateNew && (
              <Pressable style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]} onPress={onCreateNew}>
                <Text style={styles.createBtnText}>{t('planAppendix.createBlockButton')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {anyBeginnerEstimated && <Text style={styles.badgeText}>{t('planAppendix.beginnerEstimateBadge')}</Text>}
            <Text style={styles.epocNote}>{t('planAppendix.epocNote')}</Text>
            {config?.deficitModeEnabled && (
              <Text style={styles.epocNote}>{t('planAppendix.proteinRecommendationNote')}</Text>
            )}
            {activeBlock.weeks.map(renderWeek)}
            <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('planAppendix.deleteBlockButton')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scroll: { flexShrink: 1 },
    content: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    emptyBlock: { alignItems: 'center', gap: 12, paddingVertical: 24 },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
    createBtn: { backgroundColor: c.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    createBtnText: { color: c.bg, fontSize: 14, fontWeight: '700' },
    badgeText: { color: c.warning, fontSize: 12, fontWeight: '700' },
    epocNote: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    dayCard: {
      backgroundColor: c.bgHighlight,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      marginBottom: 8,
    },
    dayTitle: { color: c.textBright, fontSize: 14, fontWeight: '700' },
    sectionTitle: { color: c.textBright, fontSize: 12, fontWeight: '700', marginTop: 4 },
    variationRow: { gap: 2 },
    variationHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    variationLabel: { color: c.textSoft, fontSize: 13, fontWeight: '600' },
    variationDetail: { color: c.textSecondary, fontSize: 12 },
    variationKcal: { color: c.mint, fontSize: 12, fontWeight: '600' },
    accessoriesBlock: { gap: 2 },
    accessoryLine: { color: c.textTertiary, fontSize: 12 },
    dayTotal: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
    weekTotal: { color: c.textBright, fontSize: 13, fontWeight: '700' },
    deleteBtn: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.dangerBgSoft,
      marginTop: 8,
    },
    deleteBtnText: { color: c.dangerStrong, fontSize: 13, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

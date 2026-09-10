import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { InfoPopover } from '../components/ui/InfoPopover';
import { BlockBuilderWizard } from '../components/BlockBuilderWizard';
import { useBlockStore } from '../store/blockStore';
import { exportTrainingBlockToExcel } from '../services/export/trainingBlockExportService';
import { weekdayLabel, formatDisplayDate } from '../lib/dateUtils';
import { useT } from '../i18n/useT';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import type { ResolvedDayPlan, ResolvedVariationPlan, BlockWeekPlan } from '../types/powerliftingBlock';

// S-PL Block Builder's home screen — its own bottom tab rather than a chip
// tucked inside the energy-discharge action bar, so the feature reads as a
// real, discoverable part of the app (not a supplement to logging a workout).
// See docs/08-powerlifting-engine.md for the engine this displays.
export function TrainingScreen() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const c = useThemeColors();
  const activeBlock = useBlockStore((s) => s.activeBlock);
  const loadActiveBlock = useBlockStore((s) => s.loadActiveBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);

  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reload every time the tab gains focus (bottom-tab screens stay mounted,
  // so a one-shot mount effect would miss a block just created in the
  // wizard) — same pattern as HistoryScreen.
  useFocusEffect(
    useCallback(() => {
      loadActiveBlock().finally(() => setLoading(false));
    }, [loadActiveBlock])
  );

  function handleDelete() {
    if (!activeBlock) return;
    const id = activeBlock.config.id;
    Alert.alert(t('planAppendix.deleteConfirmTitle'), t('planAppendix.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteBlock(id) },
    ]);
  }

  async function handleExport() {
    if (!activeBlock) return;
    setExporting(true);
    try {
      await exportTrainingBlockToExcel(activeBlock, language);
    } catch {
      Alert.alert(t('common.error'), t('planAppendix.exportError'));
    } finally {
      setExporting(false);
    }
  }

  function renderVariation(variation: ResolvedVariationPlan, index: number) {
    const working = variation.sets[0];
    if (!working) return null;
    return (
      <View key={index} style={[styles.variationRow, index > 0 && styles.rowDivider]}>
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
    const dateRange = t('planAppendix.dateRangeSuffix', {
      start: formatDisplayDate(week.startDate, language),
      end: formatDisplayDate(week.endDate, language),
    });
    const title = week.isDeload
      ? `${t('planAppendix.weekLabel', { number: week.weekNumber })} (${dateRange}) · ${t('planAppendix.deloadBadge')}`
      : `${t('planAppendix.weekLabel', { number: week.weekNumber })} (${dateRange})`;
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={c.textPrimary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const config = activeBlock?.config;
  const anyBeginnerEstimated = config
    ? config.isBeginnerEstimated.squat || config.isBeginnerEstimated.bench_press || config.isBeginnerEstimated.deadlift
    : false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('planAppendix.title')}</Text>

        {!activeBlock ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{t('planAppendix.emptyState')}</Text>
            <Pressable style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]} onPress={() => setWizardOpen(true)}>
              <Text style={styles.createBtnText}>{t('planAppendix.createBlockButton')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {anyBeginnerEstimated && <Text style={styles.badgeText}>{t('planAppendix.beginnerEstimateBadge')}</Text>}
            <Text style={styles.epocNote}>{t('planAppendix.epocNote')}</Text>
            {config?.deficitModeEnabled && (
              <Text style={styles.epocNote}>{t('planAppendix.proteinRecommendationNote')}</Text>
            )}

            <View style={styles.actionRow}>
              <Pressable
                disabled={exporting}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                onPress={handleExport}
              >
                <Text style={styles.actionBtnText}>{t('planAppendix.exportExcelButton')}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]} onPress={() => setWizardOpen(true)}>
                <Text style={styles.actionBtnText}>{t('planAppendix.createBlockButton')}</Text>
              </Pressable>
            </View>

            {activeBlock.weeks.map(renderWeek)}
            <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('planAppendix.deleteBlockButton')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <BlockBuilderWizard
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setWizardOpen(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    emptyBlock: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
    createBtn: { backgroundColor: c.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    createBtnText: { color: c.bg, fontSize: 14, fontWeight: '700' },
    badgeText: { color: c.warning, fontSize: 12, fontWeight: '700' },
    epocNote: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    actionRow: { flexDirection: 'row', gap: 10, marginVertical: 4 },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
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
    rowDivider: { borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 6, marginTop: 4 },
    variationHeaderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    variationLabel: { color: c.textSoft, fontSize: 13, fontWeight: '600', flexShrink: 1 },
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
      marginBottom: 24,
    },
    deleteBtnText: { color: c.dangerStrong, fontSize: 13, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

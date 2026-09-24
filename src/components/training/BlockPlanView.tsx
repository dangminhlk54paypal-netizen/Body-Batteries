import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { InfoPopover } from '../ui/InfoPopover';
import { BlockBuilderWizard } from '../BlockBuilderWizard';
import { BlockVariationEditSheet } from './BlockVariationEditSheet';
import { BlockWeekDatesSheet } from './BlockWeekDatesSheet';
import { useBlockStore } from '../../store/blockStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingLogFormat } from '../../hooks/useTrainingLogFormat';
import { exportTrainingBlockToExcel } from '../../services/export/trainingBlockExportService';
import { dateForWeekday, hasLegacySuggestions, referenceOf } from '../../domain/energy/blockPlanEdits';
import type { VariationAddress } from '../../domain/energy/blockPlanEdits';
import { formatSetSequence } from '../../domain/training/trainingLogFormatter';
import { weekdayLabel, formatDisplayDate } from '../../lib/dateUtils';
import { useT } from '../../i18n/useT';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import type {
  ResolvedDayPlan,
  ResolvedVariationPlan,
  BlockWeekPlan,
  VariationReference,
} from '../../types/powerliftingBlock';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// "How the app calculated it": the arithmetic behind one suggestion, in words.
function explainReference(ref: VariationReference, t: TFn): string {
  if (ref.method === 'legacy') return t('planAppendix.calcLegacy');
  if (ref.method === 'deload') return t('planAppendix.calcDeload', { pct: ref.pct1rm });
  const first = ref.sets[0];
  return t('planAppendix.calcRpe', {
    reps: first?.reps ?? 0,
    rpe: ref.targetRpe,
    rir: Math.round((10 - ref.targetRpe) * 10) / 10,
    sets: ref.sets.length,
    fatigue: ref.fatigueRir,
    extra: ref.extraRir > 0 ? t('planAppendix.calcExtra', { extra: ref.extraRir }) : '',
    rtf: ref.repsToFailure,
    pct: ref.pct1rm,
    oneRm: ref.oneRepMaxKg,
    factor: ref.loadFactor !== 1 ? t('planAppendix.calcFactor', { factor: ref.loadFactor }) : '',
    weight: first?.weightKg ?? 0,
  });
}

// S-PL Block Builder's plan view — the "Kế hoạch block" mode of the Tập luyện
// tab (moved out of TrainingScreen unchanged when the training log became the
// tab's default mode). See docs/08-powerlifting-engine.md for the engine this
// displays.
export function BlockPlanView() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const c = useThemeColors();
  const activeBlock = useBlockStore((s) => s.activeBlock);
  const loadActiveBlock = useBlockStore((s) => s.loadActiveBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);
  const editVariationSets = useBlockStore((s) => s.editVariationSets);
  const editWeekDates = useBlockStore((s) => s.editWeekDates);
  const refreshActiveSuggestions = useBlockStore((s) => s.refreshActiveSuggestions);
  const profile = useSettingsStore((s) => s.userProfile);
  const format = useTrainingLogFormat();

  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // `key` bumps per opening so each sheet starts from fresh values.
  const [editing, setEditing] = useState<{ key: number; visible: boolean; at: VariationAddress } | null>(null);
  const [datesFor, setDatesFor] = useState<{ key: number; visible: boolean; weekIndex: number } | null>(null);

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

  function weekLabelOf(weekIndex: number): string {
    const week = activeBlock?.weeks[weekIndex];
    if (!week) return '';
    return week.isDeload ? t('planAppendix.deloadBadge') : t('planAppendix.weekLabel', { number: week.weekNumber });
  }

  function renderVariation(variation: ResolvedVariationPlan, at: VariationAddress) {
    if (!activeBlock || variation.sets.length === 0) return null;
    const label = t(`blockVariations.${variation.variation.variationId}.label`);
    const ref = referenceOf(activeBlock, variation);
    const refSets = formatSetSequence(ref.sets, format, language);
    const refLine =
      ref.method === 'rpe'
        ? t('planAppendix.referenceLineRpe', { sets: refSets, pct: ref.pct1rm, rpe: ref.targetRpe })
        : ref.method === 'deload'
          ? t('planAppendix.referenceLineDeload', { sets: refSets, pct: ref.pct1rm })
          : t('planAppendix.referenceLineLegacy', { sets: refSets, pct: ref.pct1rm });
    return (
      <View key={at.variationIndex} style={[styles.variationRow, at.variationIndex > 0 && styles.rowDivider]}>
        <View style={styles.variationHeaderRow}>
          <Text style={styles.variationLabel}>{label}</Text>
          <InfoPopover title={label} body={t(`blockVariations.${variation.variation.variationId}.rationale`)} />
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            onPress={() => setEditing((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, at }))}
          >
            <Text style={styles.editBtnText}>{t('planAppendix.editButton')}</Text>
          </Pressable>
        </View>
        {/* The plan — the user's own sets once edited, else the suggestion. */}
        <Text style={styles.planLine}>
          <Text style={styles.planLabel}>{t('planAppendix.planLabel')}: </Text>
          {formatSetSequence(variation.sets, format, language)}
          {variation.userEdited ? <Text style={styles.editedBadge}>  {t('planAppendix.editedBadge')}</Text> : null}
        </Text>
        {/* The info column: the app's suggestion and how it was calculated. */}
        <View style={styles.variationHeaderRow}>
          <Text style={styles.referenceLine}>{refLine}</Text>
          <InfoPopover title={t('planAppendix.howCalcTitle')} body={explainReference(ref, t)} />
        </View>
        <Text style={styles.variationKcal}>{t('planAppendix.kcalLine', { kcal: variation.estimatedKcal })}</Text>
      </View>
    );
  }

  function renderDay(week: BlockWeekPlan, weekIndex: number, day: ResolvedDayPlan, dayIndex: number) {
    const date = dateForWeekday(week, day.dayOfWeek);
    const weekday = weekdayLabel(day.dayOfWeek, language, 'long');
    return (
      <View key={dayIndex} style={styles.dayCard}>
        <Text style={styles.dayTitle}>
          {date ? t('planAppendix.dayWithDate', { weekday, date: formatDisplayDate(date, language) }) : weekday}
        </Text>
        {day.variations.map((v, variationIndex) => renderVariation(v, { weekIndex, dayIndex, variationIndex }))}
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

  function renderWeek(week: BlockWeekPlan, weekIndex: number) {
    const dateRange = t('planAppendix.dateRangeSuffix', {
      start: formatDisplayDate(week.startDate, language),
      end: formatDisplayDate(week.endDate, language),
    });
    const title = week.isDeload
      ? `${t('planAppendix.weekLabel', { number: week.weekNumber })} (${dateRange}) · ${t('planAppendix.deloadBadge')}`
      : `${t('planAppendix.weekLabel', { number: week.weekNumber })} (${dateRange})`;
    return (
      <CollapsibleSection key={week.weekNumber} title={title} defaultExpanded={week.weekNumber === 1}>
        <Pressable
          style={({ pressed }) => [styles.editBtn, styles.datesBtn, pressed && styles.pressed]}
          onPress={() => setDatesFor((prev) => ({ key: (prev?.key ?? 0) + 1, visible: true, weekIndex }))}
        >
          <Text style={styles.editBtnText}>{t('planAppendix.weekDatesButton')}</Text>
        </Pressable>
        {week.days.map((day, dayIndex) => renderDay(week, weekIndex, day, dayIndex))}
        <Text style={styles.weekTotal}>{t('planAppendix.weekTotalLabel', { kcal: week.totalKcal })}</Text>
        {week.weeklyDeficitTargetKcal != null && (
          <Text style={styles.weekTotal}>
            {t('planAppendix.weeklyDeficitTargetLabel', { kcal: week.weeklyDeficitTargetKcal })}
          </Text>
        )}
      </CollapsibleSection>
    );
  }

  const editingVariation =
    editing && activeBlock
      ? activeBlock.weeks[editing.at.weekIndex]?.days[editing.at.dayIndex]?.variations[editing.at.variationIndex]
      : undefined;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={c.textPrimary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const config = activeBlock?.config;
  const anyBeginnerEstimated = config
    ? config.isBeginnerEstimated.squat || config.isBeginnerEstimated.bench_press || config.isBeginnerEstimated.deadlift
    : false;

  return (
    <View style={styles.container}>
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

            {hasLegacySuggestions(activeBlock) && (
              <View style={styles.legacyBanner}>
                <Text style={styles.legacyText}>{t('planAppendix.legacyBanner')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  onPress={() => refreshActiveSuggestions(profile)}
                >
                  <Text style={styles.editBtnText}>{t('planAppendix.refreshButton')}</Text>
                </Pressable>
              </View>
            )}

            {activeBlock.weeks.map(renderWeek)}
            <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('planAppendix.deleteBlockButton')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {editing && editingVariation && activeBlock && (
        <BlockVariationEditSheet
          key={`variation-${editing.key}`}
          visible={editing.visible}
          title={t('planAppendix.editSheet.title', {
            label: t(`blockVariations.${editingVariation.variation.variationId}.label`),
            week: weekLabelOf(editing.at.weekIndex),
          })}
          variation={editingVariation}
          reference={referenceOf(activeBlock, editingVariation)}
          bodyWeightKg={activeBlock.config.bodyWeightKg}
          heightCm={profile.heightCm}
          onSave={(sets) => editVariationSets(editing.at, sets, profile.heightCm)}
          onRestore={() => editVariationSets(editing.at, null, profile.heightCm)}
          onClose={() => setEditing((e) => (e ? { ...e, visible: false } : e))}
        />
      )}

      {datesFor && activeBlock && activeBlock.weeks[datesFor.weekIndex] && (
        <BlockWeekDatesSheet
          key={`dates-${datesFor.key}`}
          visible={datesFor.visible}
          plan={activeBlock}
          weekIndex={datesFor.weekIndex}
          weekLabel={weekLabelOf}
          onSave={(start, end) => editWeekDates(datesFor.weekIndex, start, end)}
          onClose={() => setDatesFor((d) => (d ? { ...d, visible: false } : d))}
        />
      )}

      <BlockBuilderWizard
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setWizardOpen(false)}
      />
    </View>
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
    planLine: { color: c.textPrimary, fontSize: 14, lineHeight: 20 },
    planLabel: { color: c.textSecondary, fontWeight: '600' },
    editedBadge: { color: c.accent, fontSize: 12, fontWeight: '700' },
    referenceLine: { color: c.textTertiary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
    editBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    editBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    datesBtn: { alignSelf: 'flex-start' },
    legacyBanner: {
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.bgHighlight,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
    },
    legacyText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
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

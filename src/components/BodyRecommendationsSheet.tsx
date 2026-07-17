import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { dailyRecommendations } from '../domain/nutrition/dailyRecommendations';
import type { HealthyWeightStatus } from '../domain/nutrition/dailyRecommendations';
import { useSettingsStore } from '../store/settingsStore';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';
import type { Language } from '../i18n/types';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatInt(n: number, language: Language): string {
  return Math.round(n).toLocaleString(LOCALE_TAGS[language]);
}

function formatDecimal1(n: number, language: Language): string {
  return n.toLocaleString(LOCALE_TAGS[language], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function healthyWeightStatusKey(status: HealthyWeightStatus): string {
  switch (status) {
    case 'below':
      return 'components.bodyRecommendations.healthyWeightBelow';
    case 'above':
      return 'components.bodyRecommendations.healthyWeightAbove';
    default:
      return 'components.bodyRecommendations.healthyWeightWithin';
  }
}

const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.55;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// One data row: label + value on top, an optional gentle note line, then a
// small muted "source" caption. `noteColor` lets the healthy-weight row tint
// its status sentence (mint = within range, amber = below/above) without a
// separate component.
function Row({
  label,
  value,
  note,
  noteColor,
  source,
}: {
  label: string;
  value: string;
  note?: string;
  noteColor?: string;
  source: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {note != null && <Text style={[styles.rowNote, noteColor ? { color: noteColor } : null]}>{note}</Text>}
      <Text style={styles.rowSource}>{source}</Text>
    </View>
  );
}

// Bottom sheet opened by tapping the master battery (see LiveMasterBattery) —
// a general "daily recommendations" overview (calories, healthy weight,
// protein/carbs, sugar/salt limits, water, activity, sleep) derived from the
// user's profile via the pure domain/nutrition/dailyRecommendations engine.
// Display-only: every number here is computed elsewhere, this file only
// formats + translates it. Self-tracking reference only — NOT medical advice
// (see the disclaimer footer and .ai/CONTEXT.md §5).
export function BodyRecommendationsSheet({ visible, onClose }: Props) {
  const profile = useSettingsStore((s) => s.userProfile);
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const rec = dailyRecommendations(profile);
  const goalWeightKg = profile.goalWeightKg;
  const hasDifferentGoal = goalWeightKg != null && goalWeightKg !== profile.weightKg;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={550}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('components.bodyRecommendations.title')}</Text>

        <ScrollView
          style={[styles.list, { maxHeight: MAX_LIST_HEIGHT }]}
          showsVerticalScrollIndicator={false}
        >
          <Section title={t('components.bodyRecommendations.sectionCalorieWeight')}>
            <Row
              label={t('components.bodyRecommendations.calorieLabel')}
              value={t('components.bodyRecommendations.calorieValue', {
                value: formatInt(rec.calorieTargetKcal, language),
              })}
              source={t('components.bodyRecommendations.sourceMifflin')}
            />
            <Row
              label={t('components.bodyRecommendations.healthyWeightLabel')}
              value={t('components.bodyRecommendations.healthyWeightValue', {
                min: formatDecimal1(rec.healthyWeightKg.min, language),
                max: formatDecimal1(rec.healthyWeightKg.max, language),
              })}
              note={t(healthyWeightStatusKey(rec.healthyWeightStatus))}
              noteColor={rec.healthyWeightStatus === 'within' ? c.mint : c.warning}
              source={t('components.bodyRecommendations.sourceWhoBmi')}
            />
            {hasDifferentGoal && goalWeightKg != null && (
              <Text style={styles.goalNote}>
                {t('components.bodyRecommendations.goalWeightNote', { weight: goalWeightKg })}
              </Text>
            )}
          </Section>

          <Section title={t('components.bodyRecommendations.sectionProteinCarbs')}>
            <Row
              label={t('components.bodyRecommendations.proteinLabel')}
              value={t('components.bodyRecommendations.proteinValue', {
                min: formatInt(rec.proteinG.min, language),
                max: formatInt(rec.proteinG.max, language),
              })}
              source={t('components.bodyRecommendations.sourceIomProtein')}
            />
            <Row
              label={t('components.bodyRecommendations.carbsLabel')}
              value={t('components.bodyRecommendations.carbsValue', {
                min: formatInt(rec.carbsG.min, language),
                max: formatInt(rec.carbsG.max, language),
              })}
              source={t('components.bodyRecommendations.sourceIomCarbs')}
            />
          </Section>

          <Section title={t('components.bodyRecommendations.sectionLimits')}>
            <Row
              label={t('components.bodyRecommendations.sugarLabel')}
              value={t('components.bodyRecommendations.sugarValue', {
                limit: formatInt(rec.freeSugarLimitG, language),
                stricter: formatInt(rec.freeSugarStricterG, language),
              })}
              source={t('components.bodyRecommendations.sourceWhoSugar')}
            />
            <Row
              label={t('components.bodyRecommendations.saltLabel')}
              value={t('components.bodyRecommendations.saltValue', {
                limit: formatInt(rec.saltLimitG, language),
              })}
              source={t('components.bodyRecommendations.sourceWhoSalt')}
            />
          </Section>

          <Section title={t('components.bodyRecommendations.sectionWater')}>
            <Row
              label={t('components.bodyRecommendations.waterLabel')}
              value={t('components.bodyRecommendations.waterValue', {
                minMl: formatInt(rec.waterMl.min, language),
                maxMl: formatInt(rec.waterMl.max, language),
                minLiters: formatDecimal1(rec.waterMl.min / 1000, language),
                maxLiters: formatDecimal1(rec.waterMl.max / 1000, language),
              })}
              source={t('components.bodyRecommendations.sourceEfsaWater')}
            />
          </Section>

          <Section title={t('components.bodyRecommendations.sectionActivity')}>
            <Row
              label={t('components.bodyRecommendations.activityLabel')}
              value={t('components.bodyRecommendations.activityValue', {
                minWeek: formatInt(rec.activityMinutesPerWeek.min, language),
                maxWeek: formatInt(rec.activityMinutesPerWeek.max, language),
                minDay: formatInt(rec.activityMinutesPerDay.min, language),
                maxDay: formatInt(rec.activityMinutesPerDay.max, language),
              })}
              note={t('components.bodyRecommendations.activityNote')}
              source={t('components.bodyRecommendations.sourceWhoActivity')}
            />
          </Section>

          <Section title={t('components.bodyRecommendations.sectionSleep')}>
            <Row
              label={t('components.bodyRecommendations.sleepLabel')}
              value={t('components.bodyRecommendations.sleepValue', {
                min: formatInt(rec.sleepHours.min, language),
                max: formatInt(rec.sleepHours.max, language),
              })}
              source={t('components.bodyRecommendations.sourceSleep')}
            />
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.disclaimer}>{t('common.disclaimerShort')}</Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  content: {
    padding: 24,
    paddingTop: 16,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: 6,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: c.textLight,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'right',
  },
  rowNote: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 3,
  },
  rowSource: {
    fontSize: 10,
    color: c.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  goalNote: {
    fontSize: 12,
    color: c.accentAltLight,
    marginTop: 2,
  },
  footer: {
    marginTop: 6,
  },
  disclaimer: {
    fontSize: 11,
    color: c.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

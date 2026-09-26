import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
} from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { useEnergyStore } from '../store/energyStore';
import { BodyProfileCard } from '../components/BodyProfileCard';
import { SettingsSection } from '../components/ui/SettingsSection';
import { sortByLabel } from '../lib/sortByLabel';
import { InfoPopover } from '../components/ui/InfoPopover';
import { appleHealthStatusMeta } from '../components/AppleHealthStatusBadge';
import { exportWeeklyData, exportMonthlyData } from '../services/export/excelExportService';
import { runWeeklyCleanup } from '../services/cleanup/cleanupService';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../services/notifications/notificationService';
import type { ThemeColors, ThemeMode } from '../lib/theme';
import { useReduceMotionSetting } from '../hooks/useReduceMotionSetting';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { formatRelativeTime } from '../lib/relativeTime';
import { useT } from '../i18n/useT';
import { MyFoodsSheet } from '../components/food/MyFoodsSheet';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n/types';
import type { Language } from '../i18n/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Small building blocks ─────────────────────────────────────────────────────
// Every control sits in the same row shape — label left, control right, same
// height — so the cards read as one even grid.
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={2}>
        {label}
      </Text>
      {children}
    </View>
  );
}

// Equal-width segments (language, theme, threshold) instead of ragged chips.
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stepperGroup}>
      <Pressable
        hitSlop={4}
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
        onPress={() => onChange(-1)}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </Pressable>
      <Text style={styles.timeValue}>{pad(value)}</Text>
      <Pressable
        hitSlop={4}
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
        onPress={() => onChange(1)}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

// A square tile of the data grid: icon over a short label.
function Tile({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.tile, danger && styles.tileDanger, (pressed || disabled) && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={[styles.tileLabel, danger && styles.dangerText]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

type SectionKey = 'language' | 'body' | 'health' | 'notifications' | 'meals' | 'data' | 'interface';

const THEME_LABEL_KEYS: Record<ThemeMode, string> = {
  dark: 'settings.interface.themeDark',
  light: 'settings.interface.themeLight',
  system: 'settings.interface.themeSystem',
};

// ─── Main screen ───────────────────────────────────────────────────────────────
export function SettingsScreen() {
  const { t, language } = useT();
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    lowBatteryThreshold,
    setLowBatteryThreshold,
    reminderHour,
    reminderMinute,
    setReminderTime,
    mealWindows,
    setMealWindow,
    particleEffectsEnabled,
    setParticleEffectsEnabled,
    setLanguage,
    themeMode,
    setThemeMode,
    autoTranslateCustomFoodNames,
    setAutoTranslateCustomFoodNames,
    userProfile,
  } = useSettingsStore();
  const { appleHealthStatus, lastAppleHealthSync, syncAppleHealthBurned } = useEnergyStore();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const [exporting, setExporting] = useState(false);
  // One card open at a time — the screen stays a short list of headings.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  // iOS "Reduce Motion" → cards open/close instantly (LayoutAnimation, unlike
  // Reanimated, doesn't honor that setting on its own).
  const reduceMotion = useReduceMotionSetting();
  function toggle(key: SectionKey) {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((cur) => (cur === key ? null : key));
  }

  // "Món của tôi" — the manage/export/import sheet for the user's own food list.

  const [myFoodsVisible, setMyFoodsVisible] = useState(false);
  // Lazy initializer (not a bare Date.now() call during render) — same
  // purity-safe pattern as EnergyBalanceCard/useLiveEnergyReading.ts.
  const [nowMs] = useState(() => Date.now());

  // Keep the OS-scheduled reminder in sync with the persisted setting,
  // since the reminder is registered with the OS and survives across
  // app restarts until explicitly cancelled.
  useEffect(() => {
    if (notificationsEnabled) {
      applyReminderSchedule(reminderHour, reminderMinute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyReminderSchedule(hour: number, minute: number) {
    await cancelAllNotifications();
    await scheduleDailyReminder(hour, minute);
  }

  async function handleToggleNotifications(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          t('settings.notifications.permissionMissingTitle'),
          t('settings.notifications.permissionMissingMessage')
        );
        return;
      }
      setNotificationsEnabled(true);
      await applyReminderSchedule(reminderHour, reminderMinute);
    } else {
      setNotificationsEnabled(false);
      await cancelAllNotifications();
    }
  }

  async function handleReminderHourChange(delta: number) {
    const newHour = (reminderHour + delta + 24) % 24;
    setReminderTime(newHour, reminderMinute);
    if (notificationsEnabled) {
      await applyReminderSchedule(newHour, reminderMinute);
    }
  }

  // The minute stepper moves in quarter hours.
  async function handleReminderMinuteChange(step: number) {
    const newMinute = (reminderMinute + step * 15 + 60) % 60;
    setReminderTime(reminderHour, newMinute);
    if (notificationsEnabled) {
      await applyReminderSchedule(reminderHour, newMinute);
    }
  }

  function handleMealWindowChange(
    meal: 'breakfast' | 'lunch' | 'dinner',
    field: 'startHour' | 'endHour',
    delta: number
  ) {
    const current = mealWindows[meal];
    const newVal = (current[field] + delta + 24) % 24;
    setMealWindow(meal, { ...current, [field]: newVal });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportWeeklyData(language);
    } catch {
      Alert.alert(t('common.error'), t('settings.data.exportError'));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportMonthly() {
    setExporting(true);
    try {
      await exportMonthlyData(language);
    } catch {
      Alert.alert(t('common.error'), t('settings.data.exportError'));
    } finally {
      setExporting(false);
    }
  }

  function handleRefreshHealth() {
    syncAppleHealthBurned();
  }

  function handleCleanup() {
    Alert.alert(t('settings.data.cleanupTitle'), t('settings.data.cleanupMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.deletePermanently'),
        style: 'destructive',
        onPress: () => runWeeklyCleanup(),
      },
    ]);
  }

  const thresholdOptions = [0.1, 0.2, 0.3];

  const mealConfig: {
    key: 'breakfast' | 'lunch' | 'dinner';
    label: string;
    color: string;
  }[] = [
    { key: 'breakfast', label: t('meals.breakfast'), color: c.mealBreakfast },
    { key: 'lunch', label: t('meals.lunch'), color: c.accent },
    { key: 'dinner', label: t('meals.dinner'), color: c.accentAlt },
  ];

  const onOff = (v: boolean) => (v ? t('settings.summary.on') : t('settings.summary.off'));
  const healthMeta = appleHealthStatusMeta(appleHealthStatus, language, c);
  const healthStatusText = {
    synced: t('settings.health.statusSynced'),
    estimated: t('settings.health.statusEstimated'),
    syncing: t('settings.health.statusSyncing'),
    idle: t('settings.health.statusIdle'),
  }[appleHealthStatus];
  const lastSyncText =
    lastAppleHealthSync != null ? formatRelativeTime(lastAppleHealthSync, nowMs, language) : t('settings.health.neverSynced');

  // What each folded card says about itself.
  const summaries: Record<SectionKey, string> = {
    language: t('settings.summary.language', {
      name: LANGUAGE_NAMES[language],
      auto: onOff(autoTranslateCustomFoodNames),
    }),
    body:
      t('settings.summary.body', { weight: userProfile.weightKg, height: userProfile.heightCm, age: userProfile.age }) +
      (userProfile.goalWeightKg != null ? t('settings.summary.bodyGoal', { goal: userProfile.goalWeightKg }) : ''),
    health: `${healthStatusText} · ${lastSyncText}`,
    notifications: notificationsEnabled
      ? t('settings.summary.notificationsOn', {
          time: `${pad(reminderHour)}:${pad(reminderMinute)}`,
          pct: Math.round(lowBatteryThreshold * 100),
        })
      : t('settings.summary.notificationsOff'),
    meals: mealConfig
      .map((m) =>
        t('settings.summary.mealRange', {
          label: m.label,
          start: mealWindows[m.key].startHour,
          end: mealWindows[m.key].endHour,
        })
      )
      .join(' · '),
    data: t('settings.summary.data'),
    interface: t('settings.summary.interface', {
      theme: t(THEME_LABEL_KEYS[themeMode]),
      fx: onOff(particleEffectsEnabled),
    }),
  };

  // Cards A–Z by their title in the current language (re-sorted when the
  // language changes), so a heading is easy to find in the list.
  const cards: { key: SectionKey; title: string; node: React.ReactNode }[] = [
    {
      key: 'language',
      title: t('settings.language.sectionTitle'),
      node: (
        <SettingsSection
          key="language"
          icon="🌐"
          title={t('settings.language.sectionTitle')}
          summary={summaries.language}
          info={[
            { body: t('settings.language.sectionDesc') },
            { heading: t('settings.language.autoTranslateLabel'), body: t('settings.language.autoTranslateDesc') },
          ]}
          open={openSection === 'language'}
          onToggle={() => toggle('language')}
        >
          <Segmented
            options={LANGUAGES.map((lang: Language) => ({ value: lang, label: LANGUAGE_NAMES[lang] }))}
            value={language}
            onChange={setLanguage}
          />
          <SettingRow label={t('settings.language.autoTranslateLabel')}>
            <Switch
              value={autoTranslateCustomFoodNames}
              onValueChange={setAutoTranslateCustomFoodNames}
              trackColor={{ true: c.accent }}
            />
          </SettingRow>
        </SettingsSection>
      ),
    },
    {
      key: 'body',
      title: t('settings.bodyProfile.sectionTitle'),
      node: (
        <SettingsSection
          key="body"
          icon="🧬"
          title={t('settings.bodyProfile.sectionTitle')}
          summary={summaries.body}
          info={[
            { body: t('settings.bodyProfile.sectionDesc') },
            { body: t('components.bodyProfileCard.explainer') },
          ]}
          open={openSection === 'body'}
          onToggle={() => toggle('body')}
        >
          <BodyProfileCard embedded />
        </SettingsSection>
      ),
    },
    {
      key: 'health',
      title: t('settings.health.sectionTitle'),
      node: (
        <SettingsSection
          key="health"
          icon="🏥"
          title={t('settings.health.sectionTitle')}
          summary={summaries.health}
          info={[{ body: t('settings.health.sectionDesc') }]}
          open={openSection === 'health'}
          onToggle={() => toggle('health')}
        >
          <View style={styles.row}>
            <View style={styles.healthStatus}>
              <Text style={[styles.healthStatusText, { color: healthMeta.color }]} numberOfLines={2}>
                {healthStatusText}
              </Text>
              <Text style={styles.rowHint}>{t('settings.health.lastSync', { time: lastSyncText })}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
              onPress={handleRefreshHealth}
              disabled={appleHealthStatus === 'syncing'}
              accessibilityLabel={t('settings.health.refreshButton')}
            >
              {appleHealthStatus === 'syncing' ? (
                <ActivityIndicator size="small" color={c.textPrimary} />
              ) : (
                <Text style={styles.smallBtnText}>{t('settings.health.refreshShort')}</Text>
              )}
            </Pressable>
          </View>
        </SettingsSection>
      ),
    },
    {
      key: 'notifications',
      title: t('settings.notifications.sectionTitle'),
      node: (
        <SettingsSection
          key="notifications"
          icon="🔔"
          title={t('settings.notifications.sectionTitle')}
          summary={summaries.notifications}
          info={[
            { heading: t('settings.notifications.reminderLabel'), body: t('settings.notifications.reminderDesc') },
            { heading: t('settings.notifications.thresholdLabel'), body: t('settings.notifications.thresholdDesc') },
          ]}
          open={openSection === 'notifications'}
          onToggle={() => toggle('notifications')}
        >
          <SettingRow label={t('settings.notifications.enableLabel')}>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ true: c.accent }} />
          </SettingRow>
          <SettingRow label={t('settings.notifications.reminderLabel')}>
            <View style={styles.timeGroup}>
              <Stepper value={reminderHour} onChange={handleReminderHourChange} />
              <Text style={styles.timeColon}>:</Text>
              <Stepper value={reminderMinute} onChange={handleReminderMinuteChange} />
            </View>
          </SettingRow>
          <SettingRow label={t('settings.notifications.thresholdLabel')}>
            <Segmented
              compact
              options={thresholdOptions.map((th) => ({ value: th, label: `${Math.round(th * 100)}%` }))}
              value={lowBatteryThreshold}
              onChange={setLowBatteryThreshold}
            />
          </SettingRow>
        </SettingsSection>
      ),
    },
    {
      key: 'meals',
      title: t('settings.mealWindows.sectionTitle'),
      node: (
        <SettingsSection
          key="meals"
          icon="🕐"
          title={t('settings.mealWindows.sectionTitle')}
          summary={summaries.meals}
          info={[{ body: t('settings.mealWindows.sectionDesc') }]}
          open={openSection === 'meals'}
          onToggle={() => toggle('meals')}
        >
          {mealConfig.map(({ key, label, color }) => {
            const w = mealWindows[key];
            return (
              <View key={key} style={styles.row}>
                <View style={styles.mealLabelWrap}>
                  <View style={[styles.mealDot, { backgroundColor: color }]} />
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                <View style={styles.timeGroup}>
                  <Stepper value={w.startHour} onChange={(d) => handleMealWindowChange(key, 'startHour', d)} />
                  <Text style={styles.mealArrow}>→</Text>
                  <Stepper value={w.endHour} onChange={(d) => handleMealWindowChange(key, 'endHour', d)} />
                </View>
                {w.startHour >= w.endHour && (
                  <Text style={styles.mealWarning}>{t('settings.mealWindows.overlapWarning')}</Text>
                )}
              </View>
            );
          })}
        </SettingsSection>
      ),
    },
    {
      key: 'data',
      title: t('settings.data.sectionTitle'),
      node: (
        <SettingsSection
          key="data"
          icon="💾"
          title={t('settings.data.sectionTitle')}
          summary={summaries.data}
          info={[
            { heading: t('myFoods.openButton'), body: t('myFoods.subtitle') },
            { heading: t('settings.data.cleanupTitle'), body: t('settings.data.cleanupInfo') },
          ]}
          open={openSection === 'data'}
          onToggle={() => toggle('data')}
        >
          <View style={styles.tileGrid}>
            <Tile icon="🍽️" label={t('myFoods.openButton')} onPress={() => setMyFoodsVisible(true)} />
            <Tile
              icon="📊"
              label={exporting ? t('settings.data.exporting') : t('settings.data.tileWeekly')}
              onPress={handleExport}
              disabled={exporting}
            />
            <Tile
              icon="📊"
              label={exporting ? t('settings.data.exporting') : t('settings.data.tileMonthly')}
              onPress={handleExportMonthly}
              disabled={exporting}
            />
            <Tile icon="🗑️" label={t('settings.data.tileCleanup')} onPress={handleCleanup} danger />
          </View>
        </SettingsSection>
      ),
    },
    {
      key: 'interface',
      title: t('settings.interface.sectionTitle'),
      node: (
        <SettingsSection
          key="interface"
          icon="✨"
          title={t('settings.interface.sectionTitle')}
          summary={summaries.interface}
          info={[{ heading: t('settings.interface.particleEffectsLabel'), body: t('settings.interface.particleEffectsDesc') }]}
          open={openSection === 'interface'}
          onToggle={() => toggle('interface')}
        >
          <SettingRow label={t('settings.interface.themeSectionLabel')}>
            <Segmented
              compact
              options={[
                { value: 'dark' as const, label: `🌙 ${t('settings.interface.themeDark')}` },
                { value: 'light' as const, label: `☀️ ${t('settings.interface.themeLight')}` },
                { value: 'system' as const, label: `📱 ${t('settings.interface.themeSystem')}` },
              ]}
              value={themeMode}
              onChange={setThemeMode}
            />
          </SettingRow>
          <SettingRow label={t('settings.interface.particleEffectsLabel')}>
            <Switch value={particleEffectsEnabled} onValueChange={setParticleEffectsEnabled} trackColor={{ true: c.accent }} />
          </SettingRow>
        </SettingsSection>
      ),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Page title */}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
        </View>

        {sortByLabel(cards, (card) => card.title, language).map((card) => card.node)}

        <View style={styles.disclaimerRow}>
          <Text style={styles.disclaimer}>{t('settings.disclaimerShort')}</Text>
          <InfoPopover title={t('settings.title')} sections={[{ body: t('settings.disclaimer') }]} />
        </View>
      </ScrollView>

      <MyFoodsSheet visible={myFoodsVisible} onClose={() => setMyFoodsVisible(false)} />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 16, paddingBottom: 48, gap: 10 },

  // ── Title ──────────────────────────────────────────────────────────────────
  titleWrap: { marginBottom: 6, paddingHorizontal: 4 },
  title: { fontSize: 26, fontWeight: '800', color: c.textPrimary },
  subtitle: { fontSize: 13, color: c.textFaint, marginTop: 2 },

  // ── Rows (label left, control right, one height) ──────────────────────────
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
    borderRadius: 12,
  },
  rowLabel: { flexShrink: 1, fontSize: 14, color: c.textPrimary, fontWeight: '600' },
  rowHint: { fontSize: 12, color: c.textMuted },

  // ── Segmented control ──────────────────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.bgElevated,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segmentedCompact: { minWidth: 150 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 9 },
  segmentActive: { backgroundColor: c.accent },
  segmentText: { color: c.textSecondary, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: c.onAccent },

  // ── Steppers ───────────────────────────────────────────────────────────────
  timeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeColon: { color: c.textPrimary, fontSize: 17, fontWeight: '700' },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
  timeValue: { color: c.textPrimary, fontSize: 17, fontWeight: '700', minWidth: 24, textAlign: 'center' },

  // ── Meal windows ───────────────────────────────────────────────────────────
  mealLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  mealDot: { width: 8, height: 8, borderRadius: 4 },
  mealArrow: { color: c.textFaint, fontSize: 14 },
  mealWarning: { width: '100%', fontSize: 11, color: c.danger },

  // ── Health ─────────────────────────────────────────────────────────────────
  healthStatus: { flex: 1, gap: 2 },
  healthStatusText: { fontSize: 13, fontWeight: '700' },
  smallBtn: {
    minWidth: 96,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  smallBtnText: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },

  // ── Data tiles (2 × 2) ─────────────────────────────────────────────────────
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  tileDanger: { borderColor: c.dangerStrong },
  tileIcon: { fontSize: 22 },
  tileLabel: { color: c.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  dangerText: { color: c.dangerStrong },

  // ── Disclaimer ────────────────────────────────────────────────────────────
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 4 },
  disclaimer: { flex: 1, fontSize: 12, color: c.textFaint, lineHeight: 17 },

  pressed: { opacity: 0.6 },
});

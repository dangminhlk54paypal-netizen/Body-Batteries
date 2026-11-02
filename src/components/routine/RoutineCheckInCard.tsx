// Home card for routine auto-fill. Shows at most one of: what auto mode filled
// (with undo), the morning/evening check-in (ask mode), or the one-time
// question whether to turn this on.
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRoutineStore } from '../../store/routineStore';
import {
  defaultSleepTimes,
  ROUTINE_METRICS,
  SLOT_METRICS,
  sleepHoursBetween,
  slotForHour,
  type RoutineInsights,
  type RoutineMetric,
  type RoutineMode,
} from '../../domain/routine/routineEngine';
import { todayString } from '../../lib/dateUtils';
import { parseDecimal } from '../../lib/units';
import { routineAmount } from '../../lib/routineLabels';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

const EVENING_METRICS: RoutineMetric[] = ['water', 'steps', 'walkMinutes'];

export function RoutineCheckInCard({ hour }: { hour: number }) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const mode = useRoutineStore((s) => s.mode);
  const optInAnswered = useRoutineStore((s) => s.optInAnswered);
  const insights = useRoutineStore((s) => s.insights);
  const insightsLoaded = useRoutineStore((s) => s.insightsLoaded);
  const storedDay = useRoutineStore((s) => s.day);
  const { setMode, snoozeOptIn, undoAutoFill, dismissAutoBanner } = useRoutineStore.getState();

  const today = todayString();
  const day = storedDay.date === today ? storedDay : null;
  const slot = slotForHour(hour);

  const filled = Object.entries(day?.autoFilled ?? {}).filter(([, f]) => f.amount > 0);
  if (mode === 'auto' && filled.length > 0 && !day?.autoBannerDismissed) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('components.routine.autoTitle')}</Text>
        <Text style={styles.line}>
          {filled
            .map(([m, f]) => {
              const metric = m as RoutineMetric;
              return `${t(`components.routine.metric.${metric}`)} ${routineAmount(metric, f.amount, t, language)}`;
            })
            .join(' · ')}
        </Text>
        <CardButtons
          left={t('components.routine.undo')}
          right={t('common.ok')}
          onLeft={undoAutoFill}
          onRight={dismissAutoBanner}
        />
      </View>
    );
  }

  const pending = slot !== null && insightsLoaded && SLOT_METRICS[slot].some((m) => insights[m].loggedToday === 0);
  if (mode === 'prompt' && slot !== null && pending && !day?.handledSlots[slot]) {
    return slot === 'morning' ? (
      <MorningForm key={`${today}-morning`} insights={insights} />
    ) : (
      <EveningForm key={`${today}-evening`} insights={insights} />
    );
  }

  const routines = ROUTINE_METRICS.filter((m) => insights[m].isRoutine);
  if (mode === 'off' && !optInAnswered && !day?.optInSnoozed && routines.length > 0) {
    const days = Math.max(...routines.map((m) => insights[m].streakDays));
    const options: { label: string; mode: RoutineMode }[] = [
      { label: t('components.routine.optInAsk'), mode: 'prompt' },
      { label: t('components.routine.optInAuto'), mode: 'auto' },
    ];
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('components.routine.optInTitle', { days })}</Text>
        <Text style={styles.line}>
          {routines.map((m) => t(`components.routine.metric.${m}`)).join(' · ')}
        </Text>
        <View style={styles.row}>
          {options.map((o) => (
            <Pressable
              key={o.mode}
              style={({ pressed }) => [styles.btn, styles.btnMain, pressed && styles.pressed]}
              onPress={() => setMode(o.mode)}
            >
              <Text style={styles.btnMainText} numberOfLines={1} adjustsFontSizeToFit>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <CardButtons
          left={t('components.routine.optInLater')}
          right={t('components.routine.optInNo')}
          onLeft={snoozeOptIn}
          onRight={() => setMode('off')}
          bothPlain
        />
      </View>
    );
  }
  return null;
}

function MorningForm({ insights }: { insights: RoutineInsights }) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { lastBedtime, lastWakeTime, markSlotHandled, setSleepTimes, logMetric } = useRoutineStore.getState();
  const [initial] = useState(() =>
    defaultSleepTimes({ bedtime: lastBedtime, wakeTime: lastWakeTime }, insights.sleep.suggested)
  );
  const [bedtime, setBedtime] = useState(initial.bedtime);
  const [wakeTime, setWakeTime] = useState(initial.wakeTime);
  const [saving, setSaving] = useState(false);
  const hours = useMemo(() => sleepHoursBetween(bedtime, wakeTime), [bedtime, wakeTime]);

  async function save() {
    if (hours === null) return;
    setSaving(true);
    await logMetric('sleep', hours);
    setSleepTimes(bedtime.trim(), wakeTime.trim());
    markSlotHandled('morning');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('components.routine.morningTitle')}</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('components.routine.bedtime')}</Text>
          <TextInput
            style={styles.input}
            value={bedtime}
            onChangeText={setBedtime}
            placeholderTextColor={c.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('components.routine.wakeTime')}</Text>
          <TextInput
            style={styles.input}
            value={wakeTime}
            onChangeText={setWakeTime}
            placeholderTextColor={c.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <Text style={styles.line}>
        {hours !== null
          ? t('components.routine.sleptAbout', { amount: routineAmount('sleep', hours, t, language) })
          : t('components.routine.badTime')}
      </Text>
      <CardButtons
        left={t('components.routine.skip')}
        right={t('common.save')}
        onLeft={() => markSlotHandled('morning')}
        onRight={save}
        rightDisabled={saving || hours === null}
      />
    </View>
  );
}

function EveningForm({ insights }: { insights: RoutineInsights }) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { markSlotHandled, logMetric } = useRoutineStore.getState();
  // Pre-filled with what is still missing to the usual daily amount.
  const [fields, setFields] = useState<Partial<Record<RoutineMetric, string>>>(() => {
    const next: Partial<Record<RoutineMetric, string>> = {};
    for (const metric of EVENING_METRICS) {
      const { suggested, loggedToday } = insights[metric];
      const remaining = suggested !== null ? suggested - loggedToday : 0;
      next[metric] = remaining > 0 ? String(remaining) : '';
    }
    return next;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    for (const metric of EVENING_METRICS) {
      const value = parseDecimal(fields[metric] ?? '');
      if (!isNaN(value) && value > 0) await logMetric(metric, value);
    }
    markSlotHandled('evening');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('components.routine.eveningTitle')}</Text>
      {EVENING_METRICS.map((metric) => (
        <View key={metric} style={styles.eveningRow}>
          <View style={styles.eveningLabel}>
            <Text style={styles.label}>
              {t(`components.routine.metric.${metric}`)} ({t(`components.routine.unit.${metric}`)})
            </Text>
            {insights[metric].loggedToday > 0 && (
              <Text style={styles.small}>
                {t('components.routine.loggedToday', {
                  amount: routineAmount(metric, insights[metric].loggedToday, t, language),
                })}
              </Text>
            )}
          </View>
          <TextInput
            style={[styles.input, styles.eveningInput]}
            value={fields[metric] ?? ''}
            onChangeText={(text) => setFields((f) => ({ ...f, [metric]: text }))}
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel={t(`components.routine.metric.${metric}`)}
          />
        </View>
      ))}
      <CardButtons
        left={t('components.routine.skip')}
        right={t('common.save')}
        onLeft={() => markSlotHandled('evening')}
        onRight={save}
        rightDisabled={saving}
      />
    </View>
  );
}

function CardButtons({
  left,
  right,
  onLeft,
  onRight,
  rightDisabled = false,
  bothPlain = false,
}: {
  left: string;
  right: string;
  onLeft: () => void;
  onRight: () => void;
  rightDisabled?: boolean;
  bothPlain?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Pressable style={({ pressed }) => [styles.btn, styles.btnPlain, pressed && styles.pressed]} onPress={onLeft}>
        <Text style={styles.btnPlainText} numberOfLines={1} adjustsFontSizeToFit>
          {left}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          bothPlain ? styles.btnPlain : styles.btnMain,
          rightDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
        disabled={rightDisabled}
        onPress={onRight}
      >
        <Text style={bothPlain ? styles.btnPlainText : styles.btnMainText} numberOfLines={1} adjustsFontSizeToFit>
          {right}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.bgCard, borderRadius: 14, padding: 14, gap: 10 },
    title: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    line: { fontSize: 13, color: c.textSecondary },
    small: { fontSize: 11, color: c.textMuted },
    label: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    row: { flexDirection: 'row', gap: 10 },
    field: { flex: 1, gap: 4 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 15,
      color: c.textPrimary,
    },
    eveningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    eveningLabel: { flex: 1 },
    eveningInput: { width: 96, textAlign: 'right' },
    btn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
    btnPlain: { backgroundColor: c.bgElevated },
    btnMain: { backgroundColor: c.accent },
    btnPlainText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    btnMainText: { fontSize: 14, fontWeight: '700', color: c.onAccent },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 },
  });

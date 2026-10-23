import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  LINEAR_DEFAULTS,
  LINEAR_LIMITS,
  addVolume,
  defaultLinearProgression,
  linearWeekPct,
} from '../../domain/energy/linearProgression';
import type { LinearProgression, LinearWeekStep } from '../../types/powerliftingBlock';
import { LOCALE_TAGS } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  value: LinearProgression; // already fitted to the block's length
  onChange: (next: LinearProgression) => void;
}

const PCT_STEP = 2.5;
const KG_STEP = 2.5;
const MAX_WEEK_STEP = 10; // % points or kg per week
const MAX_OFFSET = 20;

// The "Tịnh tiến" set-up in the wizard's focus step: where week 1 starts, what
// is added each week (%1RM points or kg on the bar), how much lighter a
// variation runs, and the sets × reps of every week — the last one optionally
// a test single. Every number is the user's; the frame is only a start.
export function LinearProgressionEditor({ value, onChange }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const fmt = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const set = (patch: Partial<LinearProgression>) => onChange({ ...value, ...patch });
  const setWeek = (i: number, patch: Partial<LinearWeekStep>) =>
    set({ weeks: value.weeks.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  function stepper(label: string, display: string, onMinus: () => void, onPlus: () => void, a11y: string) {
    return (
      <View style={styles.stepper}>
        <Pressable
          hitSlop={6}
          onPress={onMinus}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${a11y} −`}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue} accessibilityLabel={`${label} ${display}`}>
          {display}
        </Text>
        <Pressable
          hitSlop={6}
          onPress={onPlus}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${a11y} ＋`}
        >
          <Text style={styles.stepText}>＋</Text>
        </Pressable>
      </View>
    );
  }

  const pick = (w: LinearWeekStep) => ({ sets: w.sets, reps: w.reps });
  const unit = value.stepMode === 'pct' ? '%' : ' kg';
  const stepSize = value.stepMode === 'pct' ? PCT_STEP : KG_STEP;
  const lastIndex = value.weeks.length - 1;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('blockBuilder.linear.title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('blockBuilder.linear.startLabel')}</Text>
        {stepper(
          t('blockBuilder.linear.startLabel'),
          `${fmt(value.startPct)}%`,
          () => set({ startPct: clamp(value.startPct - PCT_STEP, LINEAR_LIMITS.minPct, LINEAR_LIMITS.maxPct) }),
          () => set({ startPct: clamp(value.startPct + PCT_STEP, LINEAR_LIMITS.minPct, LINEAR_LIMITS.maxPct) }),
          t('blockBuilder.linear.startLabel')
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('blockBuilder.linear.stepLabel')}</Text>
        <View style={styles.modeRow}>
          {(['pct', 'kg'] as const).map((mode) => {
            const active = value.stepMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() =>
                  set({ stepMode: mode, step: mode === 'pct' ? LINEAR_DEFAULTS.step : LINEAR_DEFAULTS.stepKg })
                }
                style={({ pressed }) => [styles.modeChip, active && styles.modeChipActive, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode === 'pct' ? '%' : 'kg'}</Text>
              </Pressable>
            );
          })}
        </View>
        {stepper(
          t('blockBuilder.linear.stepLabel'),
          `+${fmt(value.step)}${unit}`,
          () => set({ step: clamp(value.step - stepSize, 0, MAX_WEEK_STEP) }),
          () => set({ step: clamp(value.step + stepSize, 0, MAX_WEEK_STEP) }),
          t('blockBuilder.linear.stepLabel')
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('blockBuilder.linear.offsetLabel')}</Text>
        {stepper(
          t('blockBuilder.linear.offsetLabel'),
          `−${fmt(value.variationOffsetPct)}%`,
          () => set({ variationOffsetPct: clamp(value.variationOffsetPct - PCT_STEP, 0, MAX_OFFSET) }),
          () => set({ variationOffsetPct: clamp(value.variationOffsetPct + PCT_STEP, 0, MAX_OFFSET) }),
          t('blockBuilder.linear.offsetLabel')
        )}
      </View>

      {/* One row per week: W1 | sets | × | reps | the straight lift's load. */}
      <View style={styles.table}>
        {value.weeks.map((w, i) => {
          const load =
            value.stepMode === 'pct'
              ? `${fmt(linearWeekPct(value, i))}%`
              : `${fmt(value.startPct)}% +${fmt(value.step * i)} kg`;
          return (
            <View key={i} style={styles.weekRow}>
              <Text style={styles.weekLabel}>{t('trainingLog.weekShort', { n: i + 1 })}</Text>
              {w.test ? (
                <Text style={styles.testText}>{t('blockBuilder.linear.testRow')}</Text>
              ) : (
                <>
                  {stepper(
                    t('blockBuilder.linear.setsA11y', { n: i + 1 }),
                    String(w.sets),
                    () => setWeek(i, { sets: clamp(w.sets - 1, 1, LINEAR_LIMITS.maxSets) }),
                    () => setWeek(i, { sets: clamp(w.sets + 1, 1, LINEAR_LIMITS.maxSets) }),
                    t('blockBuilder.linear.setsA11y', { n: i + 1 })
                  )}
                  <Text style={styles.times}>×</Text>
                  {stepper(
                    t('blockBuilder.linear.repsA11y', { n: i + 1 }),
                    String(w.reps),
                    () => setWeek(i, { reps: clamp(w.reps - 1, 1, LINEAR_LIMITS.maxReps) }),
                    () => setWeek(i, { reps: clamp(w.reps + 1, 1, LINEAR_LIMITS.maxReps) }),
                    t('blockBuilder.linear.repsA11y', { n: i + 1 })
                  )}
                </>
              )}
              <View style={styles.flex} />
              <Text style={styles.load}>{load}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() =>
            setWeek(
              lastIndex,
              value.weeks[lastIndex]?.test
                ? { test: undefined, ...pick(value.weeks[lastIndex - 1] ?? { sets: 3, reps: 2 }) }
                : { test: true, sets: 1, reps: 1 }
            )
          }
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.chipText}>
            {value.weeks[lastIndex]?.test ? t('blockBuilder.linear.testOff') : t('blockBuilder.linear.testOn')}
          </Text>
        </Pressable>
        <Pressable onPress={() => set({ weeks: addVolume(value.weeks, 1) })} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
          <Text style={styles.chipText}>{t('blockBuilder.linear.moreVolume')}</Text>
        </Pressable>
        <Pressable onPress={() => set({ weeks: addVolume(value.weeks, -1) })} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
          <Text style={styles.chipText}>{t('blockBuilder.linear.lessVolume')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(defaultLinearProgression(value.weeks.length))}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.chipText}>{t('blockBuilder.linear.reset')}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('blockBuilder.linear.hint')}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.bgHighlight },
    title: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '600' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgElevated },
    stepText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    stepValue: { minWidth: 46, textAlign: 'center', color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    modeRow: { flexDirection: 'row', gap: 4 },
    modeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: c.bgElevated },
    modeChipActive: { backgroundColor: c.accent },
    modeText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    modeTextActive: { color: c.onAccent },
    table: { gap: 6 },
    weekRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
    weekLabel: { width: 30, color: c.textSecondary, fontSize: 12, fontWeight: '800' },
    times: { color: c.textTertiary, fontSize: 13 },
    testText: { color: c.warning, fontSize: 13, fontWeight: '700' },
    load: { color: c.accent, fontSize: 12, fontWeight: '700' },
    flex: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    hint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    pressed: { opacity: 0.6 },
  });

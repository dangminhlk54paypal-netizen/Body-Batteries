import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import {
  RING_BATTERY_IDS,
  MINI_RING_MICRO_THRESHOLD,
  RING_MICRO_IDS,
  RING_MIN_METRICS,
  isDefaultRingMetrics,
  toggleRingMetric,
  type RingMetricId,
} from '../domain/battery/ringMetrics';
import { DEFAULT_BATTERIES, batteryTypeName } from '../lib/constants';
import { nutrientColor } from '../lib/nutrientTargets';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

interface Props {
  visible: boolean;
  onClose: () => void;
  selected: RingMetricId[];
  // null = back to the default 6 sub-batteries.
  onChange: (ids: RingMetricId[] | null) => void;
}

const COLUMNS = 3;

const BATTERY_COLORS = new Map(DEFAULT_BATTERIES.map((b) => [b.id, b.color]));

// ✎ next to "Pin nhỏ": pick which metrics the ring shows — an even grid of
// toggle chips in two groups, applied live (the ring behind updates as you
// tap). Pinned footer: back to the default 6 | done.
export function RingMetricsSheet({ visible, onClose, selected, onChange }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();
  // Set when an untick was refused at the minimum — the hint turns into a
  // visible "keep at least 2" instead of a silent buzz.
  const [atMin, setAtMin] = useState(false);
  const microCount = selected.filter((id) => (RING_MICRO_IDS as string[]).includes(id)).length;

  function toggle(id: RingMetricId) {
    const next = toggleRingMetric(selected, id);
    if (next === selected) {
      haptics.warning(); // unticking below the minimum
      setAtMin(true);
      return;
    }
    setAtMin(false);
    haptics.selection();
    onChange(isDefaultRingMetrics(next) ? null : next);
  }

  function renderChip(id: RingMetricId, name: string, color: string | undefined) {
    const on = selected.includes(id);
    return (
      <View key={id} style={styles.cell}>
        <Pressable
          onPress={() => toggle(id)}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel={t('components.batteryRing.toggleA11y', {
            name,
            state: t(on ? 'components.batteryRing.stateOn' : 'components.batteryRing.stateOff'),
          })}
          style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
        >
          <View style={[styles.dot, { backgroundColor: color }, !on && styles.dotOff]} />
          <Text
            style={[styles.chipText, on && styles.chipTextOn]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {name}
          </Text>
          <Text style={[styles.check, !on && styles.checkOff]}>✓</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.headRow}>
          <Text style={styles.title} numberOfLines={1}>
            {t('components.batteryRing.editTitle')}
          </Text>
          <Text style={styles.count}>
            {t('components.batteryRing.editCount', { count: selected.length })}
          </Text>
        </View>
        <Text style={[styles.hint, atMin && styles.hintWarn]}>
          {atMin
            ? t('components.batteryRing.editMinWarn', { min: RING_MIN_METRICS })
            : t('components.batteryRing.editHint', { min: RING_MIN_METRICS, micro: MINI_RING_MICRO_THRESHOLD })}
        </Text>
        {microCount > MINI_RING_MICRO_THRESHOLD && (
          <Text style={styles.miniNote}>{t('components.batteryRing.editMiniNote', { count: microCount })}</Text>
        )}

        <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerStyle={styles.body}>
          <Text style={styles.group}>{t('components.batteryRing.groupBatteries')}</Text>
          <View style={styles.grid}>
            {RING_BATTERY_IDS.map((id) => renderChip(id, batteryTypeName(id, language), BATTERY_COLORS.get(id)))}
          </View>
          <Text style={styles.group}>{t('components.batteryRing.groupMicro')}</Text>
          <View style={styles.grid}>
            {RING_MICRO_IDS.map((id) => renderChip(id, t(`nutrients.${id}.short`), nutrientColor(id)))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => onChange(null)}
            disabled={isDefaultRingMetrics(selected)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.footerBtn,
              styles.reset,
              (pressed || isDefaultRingMetrics(selected)) && styles.pressed,
            ]}
          >
            <Text style={styles.resetText} numberOfLines={1} adjustsFontSizeToFit>
              {t('components.batteryRing.reset')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerBtn, styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneText} numberOfLines={1} adjustsFontSizeToFit>
              {t('components.batteryRing.done')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 8, flexShrink: 1 },
    headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    title: { flexShrink: 1, color: c.textPrimary, fontSize: 17, fontWeight: '800' },
    count: { color: c.accent, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    hint: { color: c.textTertiary, fontSize: 12, lineHeight: 16 },
    hintWarn: { color: c.warning, fontWeight: '600' },
    miniNote: { color: c.accent, fontSize: 12, fontWeight: '600' },
    body: { gap: 8, paddingBottom: 4 },
    group: { color: c.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 },
    cell: { width: `${100 / COLUMNS}%`, paddingHorizontal: 4 },
    chip: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgElevated,
    },
    chipOn: { borderColor: c.accent, backgroundColor: c.bgHighlight },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotOff: { opacity: 0.35 },
    chipText: { flex: 1, color: c.textTertiary, fontSize: 13, fontWeight: '600' },
    chipTextOn: { color: c.textPrimary },
    check: { color: c.accent, fontSize: 13, fontWeight: '800' },
    checkOff: { opacity: 0 },
    footer: { flexDirection: 'row', gap: 12, paddingTop: 6 },
    footerBtn: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 10,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reset: { backgroundColor: c.bgElevated },
    resetText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    done: { backgroundColor: c.accent },
    doneText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

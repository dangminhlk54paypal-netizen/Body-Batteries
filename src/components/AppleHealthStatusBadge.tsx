import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { formatRelativeTime } from '../lib/relativeTime';
import type { useEnergyStore } from '../store/energyStore';
import { translate } from '../i18n/translate';
import { useT } from '../i18n/useT';
import type { Language } from '../i18n/types';

// energyStore doesn't export a named type for this union (out of scope to
// add — energyStore.ts is off-limits, see task constraints), so derive it
// structurally from the store's own state shape instead of hand-duplicating
// the 4 string literals.
export type AppleHealthStatus = ReturnType<typeof useEnergyStore.getState>['appleHealthStatus'];

// Shared icon/color/label mapping for the 4 appleHealthStatus states — used by
// both the compact badge below (Home) and the "Health Settings" status line
// (Settings), so the two screens never drift on what each state means.
export function appleHealthStatusMeta(
  status: AppleHealthStatus,
  language: Language,
  c: ThemeColors
): {
  icon: string;
  color: string;
  bg: string;
  label: string;
} {
  const t = (key: string) => translate(language, key);
  switch (status) {
    case 'synced':
      return {
        icon: '✓',
        color: c.mint,
        bg: c.successBgSoft,
        label: t('components.appleHealthStatusBadge.labelSynced'),
      };
    case 'estimated':
      return {
        icon: 'ℹ️',
        color: c.warning,
        bg: c.warningBgSoft,
        label: t('components.appleHealthStatusBadge.labelEstimated'),
      };
    case 'syncing':
      return {
        icon: '',
        color: c.textTertiary,
        bg: 'transparent',
        label: t('components.appleHealthStatusBadge.labelSyncing'),
      };
    case 'idle':
    default:
      return {
        icon: '—',
        color: c.textFaint,
        bg: 'transparent',
        label: t('components.appleHealthStatusBadge.labelIdle'),
      };
  }
}

interface Props {
  status: AppleHealthStatus;
  lastSyncAt: number | null;
  // Required (no Date.now() default) — calling Date.now() during render is an
  // impure call the project's react-hooks/purity lint rule rejects. The
  // caller supplies "now" from a useState(() => Date.now()) (see
  // EnergyBalanceCard), matching the pattern already used by
  // useLiveEnergyReading.ts.
  nowMs: number;
}

// Compact status pill shown next to "Đã đốt hôm nay" on Home. Purely
// presentational — reads its icon/color/label from appleHealthStatusMeta and
// (for the synced state) the relative sync time.
export function AppleHealthStatusBadge({ status, lastSyncAt, nowMs }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);

  if (status === 'idle') {
    return (
      <View style={styles.badge}>
        <Text style={styles.idleText}>—</Text>
      </View>
    );
  }

  const meta = appleHealthStatusMeta(status, language, c);

  if (status === 'syncing') {
    return (
      <View style={styles.badge}>
        <ActivityIndicator size="small" color={meta.color} />
        <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
      </View>
    );
  }

  const relLabel = lastSyncAt != null ? formatRelativeTime(lastSyncAt, nowMs, language) : null;
  const detail =
    status === 'synced'
      ? relLabel
        ? t('components.appleHealthStatusBadge.detailWithSync', { time: relLabel })
        : t('components.appleHealthStatusBadge.detailNoSync')
      : meta.label;

  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.icon, { color: meta.color }]}>{meta.icon}</Text>
      <Text style={[styles.text, { color: meta.color }]} numberOfLines={2}>
        {detail}
      </Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  icon: { fontSize: 12, fontWeight: '700' },
  text: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  idleText: { fontSize: 12, color: c.textFaint },
});

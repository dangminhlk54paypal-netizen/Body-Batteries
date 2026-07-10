import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { formatRelativeTime } from '../lib/relativeTime';
import type { useEnergyStore } from '../store/energyStore';

// energyStore doesn't export a named type for this union (out of scope to
// add — energyStore.ts is off-limits, see task constraints), so derive it
// structurally from the store's own state shape instead of hand-duplicating
// the 4 string literals.
export type AppleHealthStatus = ReturnType<typeof useEnergyStore.getState>['appleHealthStatus'];

// Shared icon/color/label mapping for the 4 appleHealthStatus states — used by
// both the compact badge below (Home) and the "Health Settings" status line
// (Settings), so the two screens never drift on what each state means.
export function appleHealthStatusMeta(status: AppleHealthStatus): {
  icon: string;
  color: string;
  bg: string;
  label: string;
} {
  switch (status) {
    case 'synced':
      return { icon: '✓', color: colors.mint, bg: colors.successBgSoft, label: 'Đã kết nối Apple Health' };
    case 'estimated':
      return {
        icon: 'ℹ️',
        color: colors.warning,
        bg: colors.warningBgSoft,
        label: 'Ước tính (BMR) — Apple Health không khả dụng',
      };
    case 'syncing':
      return { icon: '', color: colors.textTertiary, bg: 'transparent', label: 'Đang cập nhật…' };
    case 'idle':
    default:
      return { icon: '—', color: colors.textFaint, bg: 'transparent', label: 'Chưa đồng bộ' };
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
  if (status === 'idle') {
    return (
      <View style={styles.badge}>
        <Text style={styles.idleText}>—</Text>
      </View>
    );
  }

  const meta = appleHealthStatusMeta(status);

  if (status === 'syncing') {
    return (
      <View style={styles.badge}>
        <ActivityIndicator size="small" color={meta.color} />
        <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
      </View>
    );
  }

  const relLabel = lastSyncAt != null ? formatRelativeTime(lastSyncAt, nowMs) : null;
  const detail =
    status === 'synced'
      ? relLabel
        ? `Apple Health, đồng bộ ${relLabel}`
        : 'Apple Health'
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

const styles = StyleSheet.create({
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
  idleText: { fontSize: 12, color: colors.textFaint },
});

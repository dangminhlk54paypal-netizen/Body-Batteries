import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { normalizeSteps, sessionMinutes } from '../domain/steps/walkSessions';
import { formatDisplayDate, formatTimeHHmm } from '../lib/dateUtils';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';
import type { WalkTracker } from '../hooks/useWalkTracker';

interface Props {
  walk: WalkTracker;
}

// Body of Home's "Ra ngoài" tile (BrickFoldGrid): the tile already shows the
// title + today's total, and the explanation sits behind its ⓘ.
export function WalkTrackerPanel({ walk }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const steps = (n: number) =>
    t('components.walkTracker.steps', { steps: normalizeSteps(n).toLocaleString(LOCALE_TAGS[language]) });
  const { active } = walk;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>
            {t('components.walkTracker.outingsToday', { count: walk.todayOutings.length })}
          </Text>
          <Text style={[styles.statValue, styles.accent]}>{steps(walk.todayTotal)}</Text>
        </View>
        {walk.healthToday !== null && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('components.walkTracker.healthToday')}</Text>
            <Text style={styles.statValue}>{steps(walk.healthToday)}</Text>
          </View>
        )}
      </View>

      {active ? (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>
            {t('components.walkTracker.activeSince', {
              time: formatTimeHHmm(active.startedAt),
              min: sessionMinutes(active),
            })}
          </Text>
          <Text style={styles.liveSteps}>{steps(walk.liveSteps)}</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.home, pressed && styles.pressed]}
            onPress={walk.backHome}
            disabled={walk.busy}
          >
            <Text style={styles.btnText}>{t('components.walkTracker.backHome')}</Text>
          </Pressable>
          <Pressable onPress={walk.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>{t('components.walkTracker.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.btn, styles.leave, pressed && styles.pressed]}
          onPress={walk.leaveHome}
          disabled={walk.busy}
        >
          <Text style={styles.btnText}>{t('components.walkTracker.leaveHome')}</Text>
        </Pressable>
      )}

      {walk.todayOutings.map((s) => (
        <View key={s.id} style={styles.entryRow}>
          <Text style={styles.entryLabel}>
            {t('components.walkTracker.outingRow', {
              from: formatTimeHHmm(s.startedAt),
              to: formatTimeHHmm(s.endedAt ?? s.startedAt),
              min: sessionMinutes(s),
            })}
          </Text>
          <Text style={styles.entryValue}>{steps(s.steps)}</Text>
        </View>
      ))}

      {walk.pastDays.length > 0 && <Text style={styles.sectionLabel}>{t('components.walkTracker.pastDays')}</Text>}
      {walk.pastDays.map((d) => (
        <View key={d.date} style={styles.entryRow}>
          <Text style={styles.entryLabel}>
            {t('components.walkTracker.pastDayRow', { date: formatDisplayDate(d.date, language), count: d.outings })}
          </Text>
          <Text style={styles.entryValue}>{steps(d.steps)}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 10 },
    statsRow: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, backgroundColor: c.bgHighlight, borderRadius: 12, padding: 10, gap: 2 },
    statLabel: { color: c.textTertiary, fontSize: 12 },
    statValue: { color: c.textBright, fontSize: 15, fontWeight: '700' },
    accent: { color: c.mint },
    activeBox: { backgroundColor: c.bgElevated, borderRadius: 12, padding: 12, gap: 8, alignItems: 'center' },
    activeText: { color: c.textSoft, fontSize: 13 },
    liveSteps: { color: c.mint, fontSize: 28, fontWeight: '800' },
    btn: { alignSelf: 'stretch', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    leave: { backgroundColor: c.mint },
    home: { backgroundColor: c.infoAlt },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    cancelText: { color: c.textTertiary, fontSize: 12, textDecorationLine: 'underline' },
    pressed: { opacity: 0.6 },
    sectionLabel: { color: c.textTertiary, fontSize: 12, marginTop: 4 },
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    entryLabel: { color: c.textSoft, fontSize: 13 },
    entryValue: { color: c.textBright, fontSize: 13, fontWeight: '600' },
  });

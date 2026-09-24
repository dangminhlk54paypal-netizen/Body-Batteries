import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import {
  WEEK_RING_BATTERY_IDS,
  KCAL_PER_KG_FAT,
  type WeekRingBatteryId,
  type WeekRingDay,
  type WeekRingsSummary,
} from '../domain/battery/weekRingsModel';
import { arcPath, ringSlots, slotArcs, type RingGeometry } from '../domain/battery/batteryRingModel';
import type { WeightGoalDirection } from '../domain/health/weightHistoryGroups';
import { DEFAULT_BATTERIES } from '../lib/constants';
import { formatDisplayDate, weekdayLabel } from '../lib/dateUtils';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS, type Language } from '../i18n/types';

// A pocket-size version of the Home ring (same slots / overflow rule).
const MINI_RING: RingGeometry = {
  size: 42,
  radius: 14,
  thickness: 6,
  overflowGap: 1.5,
  overflowThickness: 2.5,
  gapDeg: 10,
};
const SLOTS = ringSlots(WEEK_RING_BATTERY_IDS.length, MINI_RING.gapDeg);

const COLOR_BY_ID = Object.fromEntries(DEFAULT_BATTERIES.map((b) => [b.id, b.color])) as Record<
  WeekRingBatteryId,
  string
>;

const SHORT_LABEL_KEYS = {
  protein: 'screens.history.batteryShortLabels.protein',
  carbs: 'screens.history.batteryShortLabels.carbs',
  water: 'screens.history.batteryShortLabels.water',
  minerals: 'screens.history.batteryShortLabels.minerals',
  sleep: 'screens.history.batteryShortLabels.sleep',
  movement: 'screens.history.batteryShortLabels.movement',
} as const satisfies Record<WeekRingBatteryId, string>;

// "−2.940" / "+180" with the locale's grouping and a real minus sign.
function formatSignedKcal(kcal: number, language: Language): string {
  const abs = Math.abs(kcal).toLocaleString(LOCALE_TAGS[language]);
  return kcal > 0 ? `+${abs}` : kcal < 0 ? `−${abs}` : '0';
}

function MiniRing({ day, textColor }: { day: WeekRingDay; textColor: string }) {
  const g = MINI_RING;
  const c = g.size / 2;
  const overflowRadius = g.radius + g.thickness / 2 + g.overflowGap + g.overflowThickness / 2;
  return (
    <Svg width={g.size} height={g.size}>
      {WEEK_RING_BATTERY_IDS.map((id, i) => {
        const ratio = day.ratios[id] ?? 0;
        const { fill, overflow } = slotArcs(SLOTS[i], ratio);
        const color = COLOR_BY_ID[id];
        return (
          <React.Fragment key={id}>
            <Path d={arcPath(c, c, g.radius, SLOTS[i])} stroke={color} strokeOpacity={0.18} strokeWidth={g.thickness} fill="none" />
            {fill && <Path d={arcPath(c, c, g.radius, fill)} stroke={color} strokeWidth={g.thickness} fill="none" />}
            {overflow && (
              <Path
                d={arcPath(c, c, overflowRadius, overflow)}
                stroke={color}
                strokeWidth={g.overflowThickness}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </React.Fragment>
        );
      })}
      <SvgText x={c} y={c + 3.5} fontSize={10} fontWeight="700" fill={textColor} textAnchor="middle">
        {day.metCount}
      </SvgText>
    </Svg>
  );
}

interface Props {
  summary: WeekRingsSummary;
  today: string;
  // Colours the kcal balance toward/away from the user's healthy-weight
  // direction (same rule as the weight list): deficit is green when losing.
  goal: WeightGoalDirection;
  onPressDay: (date: string) => void;
}

// History's week at a glance: one 6-colour ring per day (today's intake vs
// target, same as Home), the day's kcal balance under it, and how many days
// each battery hit its target. Tapping a day opens its detail sheet.
export function WeekRingsCard({ summary, today, goal, onPressDay }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const total = summary.days.length;

  const balanceColor = (kcal: number | null) => {
    if (kcal == null || kcal === 0 || goal === 'maintain') return c.textTertiary;
    return (kcal < 0) === (goal === 'lose') ? c.weightTrendToward : c.weightTrendAway;
  };

  const { finishedBalanceKcal: weekKcal, finishedDaysWithFood } = summary;

  return (
    <View style={styles.card}>
      <Text style={styles.summary}>
        {finishedDaysWithFood > 0 ? (
          <>
            {t('screens.history.weekBalanceLabel', { days: finishedDaysWithFood })}{' '}
            <Text style={[styles.summaryValue, { color: balanceColor(weekKcal) }]}>
              {t('screens.history.weekBalanceValue', {
                kcal: formatSignedKcal(weekKcal, language),
                kg: formatSignedKcal(Math.round((weekKcal / KCAL_PER_KG_FAT) * 10) / 10, language),
              })}
            </Text>
          </>
        ) : (
          t('screens.history.weekBalanceNone')
        )}
      </Text>

      <View style={styles.daysRow}>
        {summary.days.map((day) => {
          const isToday = day.date === today;
          const dow = new Date(`${day.date}T00:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          const balance = day.balanceKcal == null ? '·' : formatSignedKcal(day.balanceKcal, language);
          return (
            <Pressable
              key={day.date}
              onPress={() => onPressDay(day.date)}
              accessibilityRole="button"
              accessibilityLabel={t('screens.history.dayA11y', {
                date: formatDisplayDate(day.date, language),
                met: day.metCount,
                total: WEEK_RING_BATTERY_IDS.length,
                balance: day.balanceKcal == null ? '—' : `${balance} kcal`,
              })}
              style={({ pressed }) => [styles.dayCol, isToday && styles.todayCol, pressed && styles.pressed]}
            >
              <Text style={[styles.dayLabel, isToday && styles.todayLabel]} numberOfLines={1}>
                {weekdayLabel(dow, language, 'short')}
              </Text>
              <MiniRing day={day} textColor={c.textPrimary} />
              <Text style={[styles.dayBalance, { color: balanceColor(day.balanceKcal) }]} numberOfLines={1}>
                {balance}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        {WEEK_RING_BATTERY_IDS.map((id) => (
          <View key={id} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLOR_BY_ID[id] }]} />
            <Text style={styles.legendText}>
              {t(SHORT_LABEL_KEYS[id])}{' '}
              <Text style={styles.legendCount}>
                {summary.hitCounts[id]}/{total}
              </Text>
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>{t('screens.history.weekHint')}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.bgElevated,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 12,
  },
  summary: { color: c.textSecondary, fontSize: 13, paddingHorizontal: 4 },
  summaryValue: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, borderRadius: 10 },
  todayCol: { backgroundColor: c.bgElevated },
  pressed: { opacity: 0.6 },
  dayLabel: { color: c.textTertiary, fontSize: 11 },
  todayLabel: { color: c.textPrimary, fontWeight: '700' },
  dayBalance: { fontSize: 10, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { color: c.textSecondary, fontSize: 11 },
  legendCount: { color: c.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { color: c.textFaint, fontSize: 11, textAlign: 'center' },
});

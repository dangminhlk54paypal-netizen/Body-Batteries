import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { CoachAdvice } from '../../domain/energy/rpeCoach';
import { LOCALE_TAGS } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  advice: CoachAdvice[];
  weekLabel: (weekIndex: number) => string;
  onApply: (a: CoachAdvice, change: { kg?: number; sets?: number }) => void;
  onDismiss: (a: CoachAdvice) => void;
}

// What the RPE coach noticed (rpeCoach.ts), one short card per lift, with the
// choice left to the lifter: apply a change to the weeks ahead, or not.
export function RpeCoachCard({ advice, weekLabel, onApply, onDismiss }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  if (advice.length === 0) return null;
  const num = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('planAppendix.coach.title')}</Text>
      {advice.map((a) => {
        const [first, second] = a.logs;
        const targets = a.logs.map((l) => l.target).filter((x): x is number => x != null);
        const vars = {
          lift: t(`blockVariations.${a.variationId}.label`),
          a: num(first.actual),
          b: num(second.actual),
          target: targets.length > 0 ? num(Math.round((targets.reduce((s, x) => s + x, 0) / targets.length) * 2) / 2) : '',
          week: weekLabel(a.fromWeekIndex),
        };
        const body =
          a.direction === 'easier'
            ? t('planAppendix.coach.easier', vars)
            : targets.length > 0
              ? t('planAppendix.coach.harder', vars)
              : t('planAppendix.coach.veryHard', vars);
        return (
          <View key={a.key} style={styles.card}>
            <Text style={styles.body}>{body}</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => onApply(a, { kg: a.loadKg })}
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>
                  {a.loadKg > 0 ? `＋${num(a.loadKg)} kg` : `−${num(-a.loadKg)} kg`}
                </Text>
              </Pressable>
              {a.offerSet && (
                <Pressable
                  onPress={() => onApply(a, { sets: 1 })}
                  style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
                >
                  <Text style={styles.btnText}>{t('planAppendix.coach.plusSet')}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => onDismiss(a)} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
                <Text style={styles.skipText}>{t('planAppendix.coach.dismiss')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Text style={styles.hint}>{t('planAppendix.coach.hint')}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.accentAlt },
    title: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    card: { gap: 8, padding: 10, borderRadius: 10, backgroundColor: c.bgHighlight },
    body: { color: c.textPrimary, fontSize: 13, lineHeight: 19 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: c.accent },
    btnText: { color: c.onAccent, fontSize: 12, fontWeight: '800' },
    skip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: c.bgElevated },
    skipText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    hint: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
    pressed: { opacity: 0.6 },
  });

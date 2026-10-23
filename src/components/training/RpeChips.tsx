import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RPE_CHOICES } from '../../domain/energy/rpeCoach';
import { LOCALE_TAGS } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

interface Props {
  value: number | undefined;
  onChange: (rpe: number | null) => void; // tapping the chosen one again clears it
  label: string; // already translated ("RPE · Comp Bench")
}

// "How hard did the last set feel?" — one tap on the reps-in-reserve RPE scale
// (10 = nothing left, 8 = two reps left), with the scale spelled out under it
// for lifters who are new to rating.
export function RpeChips({ value, onChange, label }: Props) {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {RPE_CHOICES.map((rpe) => {
          const active = value === rpe;
          return (
            <Pressable
              key={rpe}
              onPress={() => onChange(active ? null : rpe)}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`RPE ${rpe}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {rpe.toLocaleString(LOCALE_TAGS[language])}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{t('planAppendix.rpe.scaleHint')}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { gap: 6 },
    label: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    chip: {
      minWidth: 36,
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    chipTextActive: { color: c.onAccent },
    hint: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
    pressed: { opacity: 0.6 },
  });

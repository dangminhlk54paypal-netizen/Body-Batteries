import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';
import type { HomeKeyword, KeywordBattery, KeywordTone } from '../domain/battery/homeKeywords';

interface Props {
  keywords: HomeKeyword[];
  // Same action as tapping that battery on the ring (log water/sleep, or see
  // where protein/movement came from).
  onPress: (battery: KeywordBattery) => void;
}

// Up to three short "state + next step" chips under the sub-battery title.
// Same chip shape as MasterBattery's stat chips; the text color carries the
// tone (enough / partway / low — never alarm red) and the words carry the
// meaning, so color is never the only signal.
export function HomeKeywordChips({ keywords, onPress }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  if (keywords.length === 0) return null;

  const toneColor: Record<KeywordTone, string> = {
    good: c.statusGood,
    mid: c.statusMid,
    low: c.statusLow,
  };
  const num = (n: number) => n.toLocaleString(LOCALE_TAGS[language]);

  return (
    <View style={styles.row}>
      {keywords.map((k) => {
        const label =
          k.kind === 'done'
            ? t(`screens.home.keywords.${k.battery}Done`)
            : t(`screens.home.keywords.${k.battery}Short`, { amount: num(k.amount) });
        return (
          <Pressable
            key={k.battery}
            onPress={() => onPress(k.battery)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={4}
          >
            <Text style={[styles.chipText, { color: toneColor[k.tone] }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 10,
    },
    chip: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    pressed: { opacity: 0.6 },
  });

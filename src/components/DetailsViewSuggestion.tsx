import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { DetailViewMode } from '../domain/habits/detailViewHabit';
import type { ThemeColors } from '../lib/theme';
import { useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';

interface Props {
  suggestion: DetailViewMode; // the mode the app suggests switching to
  onAccept: () => void;
  onLater: () => void;
}

// One quiet line under "Chi tiết hôm nay" when the app has noticed a reading
// habit (domain/habits/detailViewHabit.ts): 💡 text · [Đổi] · ✕. Nothing
// changes until the user taps "Đổi".
export function DetailsViewSuggestion({ suggestion, onAccept, onLater }: Props) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>💡</Text>
      <Text style={styles.text} numberOfLines={2}>
        {t(suggestion === 'multi' ? 'screens.home.details.suggestMulti' : 'screens.home.details.suggestSingle')}
      </Text>
      <Pressable
        onPress={onAccept}
        style={({ pressed }) => [styles.accept, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.acceptText}>{t('screens.home.details.suggestAccept')}</Text>
      </Pressable>
      <Pressable
        onPress={onLater}
        hitSlop={10}
        style={({ pressed }) => [styles.later, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('screens.home.details.suggestLater')}
      >
        <Text style={styles.laterText}>✕</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    icon: { fontSize: 14 },
    text: { flex: 1, fontSize: 12, color: c.textSecondary, lineHeight: 16 },
    accept: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: c.accent },
    acceptText: { fontSize: 12, fontWeight: '700', color: c.bg },
    later: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
    },
    laterText: { fontSize: 12, color: c.textTertiary, fontWeight: '700' },
    pressed: { opacity: 0.6 },
  });

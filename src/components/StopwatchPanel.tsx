import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStopwatchStore } from '../store/stopwatchStore';
import {
  bestWorstLaps,
  currentLapMs,
  elapsedMs,
  formatStopwatch,
  lapDurations,
} from '../domain/stopwatch/stopwatch';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import { useT } from '../i18n/useT';
import type { Language } from '../i18n/types';

// Display refresh rate while running (~30 fps is smooth for centiseconds).
const TICK_MS = 33;

// Centisecond separator as the iPhone Clock app shows it in each language.
export function stopwatchDecimalSep(language: Language): string {
  return language === 'en' ? '.' : ',';
}

interface RoundButtonProps {
  label: string;
  color: string;
  textColor: string;
  disabled?: boolean;
  onPress: () => void;
}

// Apple Clock-style round button: a filled circle inside a thin same-colour ring.
function RoundButton({ label, color, textColor, disabled, onPress }: RoundButtonProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.ring, { borderColor: color }, (pressed || disabled) && styles.dimmed]}
    >
      <View style={[styles.roundBtn, { backgroundColor: color }]}>
        <Text style={[styles.roundBtnText, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// Body of Home's "Bấm giờ" tile, modelled on the iPhone Clock stopwatch:
// Start / Stop, Lap / Reset, and a lap list with the fastest lap green and the
// slowest red.
export function StopwatchPanel() {
  const { t, language } = useT();
  const styles = useThemedStyles(createStyles);
  const c = useThemeColors();
  const sw = useStopwatchStore();
  const running = sw.startedAt !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const sep = stopwatchDecimalSep(language);
  const total = elapsedMs(sw, now);
  const durations = lapDurations(sw);
  const highlight = bestWorstLaps(durations);
  const hasTime = total > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatStopwatch(total, sep)}</Text>

      <View style={styles.buttons}>
        {running || !hasTime ? (
          <RoundButton
            label={t('components.stopwatch.lap')}
            color={c.bgElevated}
            textColor={c.textBright}
            disabled={!running}
            onPress={() => sw.lap()}
          />
        ) : (
          <RoundButton
            label={t('components.stopwatch.reset')}
            color={c.bgElevated}
            textColor={c.textBright}
            onPress={() => sw.reset()}
          />
        )}
        {running ? (
          <RoundButton label={t('components.stopwatch.stop')} color="#3a1514" textColor="#FF453A" onPress={() => sw.stop()} />
        ) : (
          <RoundButton label={t('components.stopwatch.start')} color="#0a2a12" textColor="#30D158" onPress={() => sw.start()} />
        )}
      </View>

      {hasTime && (
        <View>
          <View style={styles.lapRow}>
            <Text style={styles.lapText}>{t('components.stopwatch.lapRow', { n: durations.length + 1 })}</Text>
            <Text style={styles.lapText}>{formatStopwatch(currentLapMs(sw, now), sep)}</Text>
          </View>
          {durations
            .map((d, i) => ({ d, i }))
            .reverse()
            .map(({ d, i }) => {
              const color = highlight?.best === i ? '#30D158' : highlight?.worst === i ? '#FF453A' : undefined;
              return (
                <View key={i} style={styles.lapRow}>
                  <Text style={[styles.lapText, color != null && { color }]}>
                    {t('components.stopwatch.lapRow', { n: i + 1 })}
                  </Text>
                  <Text style={[styles.lapText, color != null && { color }]}>{formatStopwatch(d, sep)}</Text>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 12 },
    time: {
      color: c.textPrimary,
      fontSize: 56,
      fontWeight: '200',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      paddingVertical: 4,
    },
    buttons: { flexDirection: 'row', justifyContent: 'space-between' },
    ring: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, padding: 3 },
    roundBtn: { flex: 1, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    roundBtnText: { fontSize: 15, fontWeight: '500' },
    dimmed: { opacity: 0.5 },
    lapRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    lapText: { color: c.textBright, fontSize: 15, fontVariant: ['tabular-nums'] },
  });

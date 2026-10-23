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

// Display refresh rate while running (~30 fps is smooth for centiseconds).
const TICK_MS = 33;

interface RoundButtonProps {
  label: string;
  color: string;
  textColor: string;
  disabled?: boolean;
  onPress: () => void;
}

// Apple Clock-style round button: a filled circle inside a thin same-colour ring.
function RoundButton({ label, color, textColor, disabled, onPress }: RoundButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ring,
        { borderColor: color },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <View style={[styles.roundBtn, { backgroundColor: color }]}>
        <Text style={[styles.roundBtnText, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// Stopwatch modelled on the iPhone Clock app: Bắt đầu / Dừng, Vòng / Đặt lại,
// and a lap list with the fastest lap in green and the slowest in red.
export function StopwatchCard() {
  const sw = useStopwatchStore();
  const running = sw.startedAt !== null;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const total = elapsedMs(sw, now);
  const durations = lapDurations(sw);
  const highlight = bestWorstLaps(durations);
  const hasTime = total > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⏱ Bấm giờ</Text>

      <Text style={styles.time}>{formatStopwatch(total)}</Text>

      <View style={styles.buttons}>
        {running || !hasTime ? (
          <RoundButton
            label="Vòng"
            color="#333"
            textColor="#fff"
            disabled={!running}
            onPress={sw.lap}
          />
        ) : (
          <RoundButton label="Đặt lại" color="#333" textColor="#fff" onPress={sw.reset} />
        )}
        {running ? (
          <RoundButton label="Dừng" color="#3a1514" textColor="#FF453A" onPress={sw.stop} />
        ) : (
          <RoundButton label="Bắt đầu" color="#0a2a12" textColor="#30D158" onPress={sw.start} />
        )}
      </View>

      {hasTime && (
        <View>
          <View style={styles.lapRow}>
            <Text style={styles.lapText}>Vòng {durations.length + 1}</Text>
            <Text style={styles.lapText}>{formatStopwatch(currentLapMs(sw, now))}</Text>
          </View>
          {durations
            .map((d, i) => ({ d, i }))
            .reverse()
            .map(({ d, i }) => {
              const color =
                highlight?.best === i ? '#30D158' : highlight?.worst === i ? '#FF453A' : '#fff';
              return (
                <View key={i} style={styles.lapRow}>
                  <Text style={[styles.lapText, { color }]}>Vòng {i + 1}</Text>
                  <Text style={[styles.lapText, { color }]}>{formatStopwatch(d)}</Text>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    backgroundColor: '#000',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  time: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '200',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 8,
  },
  buttons: { flexDirection: 'row', justifyContent: 'space-between' },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    padding: 3,
  },
  roundBtn: { flex: 1, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  roundBtnText: { fontSize: 16, fontWeight: '500' },
  dimmed: { opacity: 0.5 },
  lapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  lapText: { color: '#fff', fontSize: 16, fontVariant: ['tabular-nums'] },
});

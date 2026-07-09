import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DEFAULT_BATTERIES } from '../lib/constants';
import type { IntakeEvent } from '../types/battery';
import { colors } from '../lib/theme';

interface Props {
  entries: IntakeEvent[];
  onDelete: (id: string) => void;
}

function timeLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Turn a raw battery id into a friendly "Name amount unit" label, e.g.
// "Nước 300 ml". Falls back to the raw id when the battery isn't known.
function intakeLabel(entry: IntakeEvent): string {
  const battery = DEFAULT_BATTERIES.find((b) => b.id === entry.batteryTypeId);
  if (!battery) {
    return `${entry.batteryTypeId} ${entry.amount}`;
  }
  return `${battery.name} ${entry.amount} ${battery.unit}`;
}

export function TodayIntakes({ entries, onDelete }: Props) {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Nạp nhanh hôm nay</Text>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>Chưa nạp nhanh gì hôm nay.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {sorted.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryMain}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {intakeLabel(entry)}
                </Text>
                <Text style={styles.entryMeta}>
                  {timeLabel(entry.timestamp)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                onPress={() => onDelete(entry.id)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: { fontSize: 13, color: colors.textTertiary },
  card: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  empty: { color: colors.textTertiary, fontSize: 13, lineHeight: 19 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryMain: { flex: 1 },
  entryName: { color: colors.textBright, fontSize: 14, fontWeight: '500' },
  entryMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.5 },
});

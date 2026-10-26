import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { InfoPopover } from './InfoPopover';
import type { InfoSection } from './InfoPopover';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { brickCapacity, brickCost, packBrickRows } from '../../lib/brickLayout';

export interface BrickItem {
  id: string;
  icon: string;
  title: string; // already translated keyword ("Đã ăn")
  // The key number(s), so a closed tile still tells you something.
  value: string;
  info?: InfoSection[]; // long explanations, behind ⓘ on the open panel
  // Lists that can grow long scroll inside a window this tall.
  maxBodyHeight?: number;
  body: React.ReactNode;
}

interface Props {
  items: BrickItem[];
  openIds: string[]; // oldest first — panels stack in the order opened
  onToggle: (id: string) => void;
}

// Home's "Chi tiết hôm nay" as a brick wall of tiles (rows of 1–3, counts
// alternating so the seams never line up; width follows the keyword). Tap a
// tile to open its block in a panel under the wall; tap the tile or the
// panel head again to fold it.
export function BrickFoldGrid({ items, openIds, onToggle }: Props) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const costs = items.map((it) => brickCost(it.title));
  const rows = packBrickRows(costs, brickCapacity(width));

  const starts: number[] = [];
  for (let i = 0, at = 0; i < rows.length; at += rows[i], i++) starts.push(at);
  const wall = rows.map((count, r) => {
    const rowItems = items.slice(starts[r], starts[r] + count);
    const rowCosts = costs.slice(starts[r], starts[r] + count);
    return (
      <View key={rowItems[0].id} style={styles.row}>
        {rowItems.map((it, i) => {
          const open = openIds.includes(it.id);
          return (
            <Pressable
              key={it.id}
              onPress={() => onToggle(it.id)}
              style={({ pressed }) => [
                styles.tile,
                { flexGrow: rowCosts[i] },
                open && styles.tileOpen,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${it.title}, ${it.value}`}
            >
              <View style={styles.tileHead}>
                <Text style={styles.icon}>{it.icon}</Text>
                <Text style={[styles.title, open && styles.titleOpen]} numberOfLines={1}>
                  {it.title}
                </Text>
              </View>
              <Text style={styles.value} numberOfLines={2}>
                {it.value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  });

  const openItems = openIds
    .map((id) => items.find((it) => it.id === id))
    .filter((it): it is BrickItem => it != null);

  return (
    <View style={styles.container}>
      <View style={styles.wall}>{wall}</View>
      {openItems.map((it) => (
        <View key={it.id} style={styles.panel}>
          <Pressable
            onPress={() => onToggle(it.id)}
            style={({ pressed }) => [styles.panelHead, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: true }}
            accessibilityLabel={`${it.title}, ${it.value}`}
          >
            <Text style={styles.icon}>{it.icon}</Text>
            <Text style={styles.panelTitle} numberOfLines={1}>
              {it.title}
            </Text>
            {it.info && it.info.length > 0 ? <InfoPopover title={it.title} sections={it.info} /> : null}
            <Text style={styles.chevron}>⌃</Text>
          </Pressable>
          {it.maxBodyHeight ? (
            <ScrollView
              style={{ maxHeight: it.maxBodyHeight }}
              contentContainerStyle={styles.body}
              nestedScrollEnabled
            >
              {it.body}
            </ScrollView>
          ) : (
            <View style={styles.body}>{it.body}</View>
          )}
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 12 },
    wall: { gap: 8, paddingHorizontal: 20 },
    row: { flexDirection: 'row', gap: 8 },
    tile: {
      flexBasis: 0,
      minHeight: 64,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgElevated,
      justifyContent: 'space-between',
      gap: 4,
    },
    tileOpen: { borderColor: c.accent, backgroundColor: c.bgCard },
    pressed: { opacity: 0.6 },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    icon: { fontSize: 16, width: 22, textAlign: 'center' },
    title: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: c.textPrimary },
    titleOpen: { color: c.accent },
    value: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    panel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      minHeight: 44,
      backgroundColor: c.bgCard,
    },
    panelTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: c.textPrimary },
    chevron: { width: 16, textAlign: 'center', fontSize: 16, color: c.textTertiary },
    body: { paddingVertical: 12, gap: 12 },
  });

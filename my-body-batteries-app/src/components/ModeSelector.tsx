import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MODES } from '../domain/modes/modeDefinitions';
import type { ModeId } from '../types/modes';

interface Props {
  currentMode: ModeId;
  onChange: (mode: ModeId) => void;
}

export function ModeSelector({ currentMode, onChange }: Props) {
  return (
    <View style={styles.row}>
      {Object.values(MODES).map((mode) => {
        const active = mode.id === currentMode;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onChange(mode.id as ModeId)}
            style={[styles.chip, active && { backgroundColor: mode.color }]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {mode.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
});

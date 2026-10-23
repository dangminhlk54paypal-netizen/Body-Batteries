import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { VariationSetsEditor } from './VariationSetsEditor';
import type { LiftingSet } from '../../types/energy';
import type { ResolvedVariationPlan, VariationReference } from '../../types/powerliftingBlock';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string; // already translated ("Squat có dừng · Tuần 2")
  variation: ResolvedVariationPlan;
  reference: VariationReference;
  bodyWeightKg: number;
  heightCm: number;
  onSave: (sets: LiftingSet[]) => void;
  onRestore: () => void; // back to the app's suggestion
}

// The ✎ sheet of the plan's week view: VariationSetsEditor in a bottom sheet.
// The parent remounts the sheet (via `key`) for every opening.
export function BlockVariationEditSheet({ visible, onClose, title, onSave, onRestore, ...editor }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={600}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        <VariationSetsEditor
          {...editor}
          onSave={(sets) => {
            onSave(sets);
            onClose();
          }}
          onRestore={() => {
            onRestore();
            onClose();
          }}
          onCancel={onClose}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: 24, paddingTop: 12, gap: 14 },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  });

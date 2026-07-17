import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { BatteryType } from '../types/battery';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';
import { BottomSheet } from './ui/BottomSheet';
import { toMl, parseDecimal, type WaterDisplayUnit } from '../lib/units';
import { useT } from '../i18n/useT';

// Manual charge form. Since the small-battery tap overhaul, only water and
// sleep route here (see HomeScreen.handleCellPress) — the auto-charged pins
// (protein/carbs/minerals/movement) open the read-only BatterySourceSheet
// instead, so the old movement step-type selector/preview is gone from this
// modal along with its onConfirm `stepType` option.
interface Props {
  battery: BatteryType | null;
  visible: boolean;
  onConfirm: (amount: number, note: string) => void;
  onClose: () => void;
  // Water-only: lets the amount be typed in ml or L (see src/lib/units.ts).
  // onConfirm always receives ml regardless of which unit was picked here.
  waterDisplayUnit?: WaterDisplayUnit;
  onToggleWaterUnit?: () => void;
  // Optional gentle, referential hint line (water/sleep only) — see
  // domain/rules/dailyRecommendations.ts. Never prescriptive; HomeScreen
  // derives the text and always appends "Chỉ để tham khảo."
  recommendationVi?: string;
}

const WATER_UNIT_OPTIONS: { key: WaterDisplayUnit; label: string }[] = [
  { key: 'ml', label: 'ml' },
  { key: 'l', label: 'L' },
];

export function IntakeModal({
  battery,
  visible,
  onConfirm,
  onClose,
  waterDisplayUnit = 'ml',
  onToggleWaterUnit,
  recommendationVi,
}: Props) {
  const { t } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const isWater = battery?.id === 'water';

  function handleConfirm() {
    const parsed = parseDecimal(amount);
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(isWater ? toMl(parsed, waterDisplayUnit) : parsed, note.trim());
      haptics.success();
      setAmount('');
      setNote('');
      onClose();
    }
  }

  if (!battery) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetOffset={400}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('components.intakeModal.titleLabel', { name: battery.name })}
        </Text>
        <Text style={styles.subtitle}>
          {t('components.intakeModal.subtitleLabel', {
            unit: isWater ? waterDisplayUnit : battery.unit,
          })}
        </Text>

        {recommendationVi && <Text style={styles.kcalHint}>{recommendationVi}</Text>}

        {isWater && onToggleWaterUnit && (
          <View style={styles.unitRow}>
            {WATER_UNIT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  styles.unitChip,
                  waterDisplayUnit === opt.key && styles.unitChipActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  if (waterDisplayUnit !== opt.key) onToggleWaterUnit();
                }}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    waterDisplayUnit === opt.key && styles.unitChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={t('components.intakeModal.amountPlaceholder')}
          placeholderTextColor={c.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          autoFocus
        />

        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder={t('components.intakeModal.notePlaceholder')}
          placeholderTextColor={c.textMuted}
          value={note}
          onChangeText={setNote}
        />

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.confirmBtn,
              { backgroundColor: battery.color },
              pressed && styles.pressed,
            ]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>{t('components.intakeModal.confirmButton')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: c.textSecondary,
  },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  noteInput: {
    fontSize: 14,
  },
  kcalHint: {
    fontSize: 12,
    color: c.textSubtle,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: c.bgHighlight,
    borderColor: c.accent,
  },
  unitChipText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: c.accent,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: c.bgElevated,
  },
  confirmBtn: {},
  cancelText: {
    color: c.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});

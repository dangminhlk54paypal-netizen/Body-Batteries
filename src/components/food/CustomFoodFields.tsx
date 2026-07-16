import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import type { CustomFoodInput } from '../../domain/food/customFoodInput';
import type { PortionUnit } from '../../types/food';
import { colors } from '../../lib/theme';
import { useT } from '../../i18n/useT';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// Shared field-rendering body for the "add/edit a custom food" form, used by
// both FoodLogModal's inline "Thêm món mới" branch and FoodNutritionEditModal
// (which also covers "Sửa thành phần" and SupplementQuickLog's add flow).
// Presentational only — save/navigation/header logic stays in each caller,
// since those genuinely differ (see FoodNutritionEditModal.tsx header comment).
interface Props {
  input: CustomFoodInput;
  onChange: <K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) => void;
  showMicros: boolean;
  onToggleMicros: () => void;
  autoFocusName?: boolean;
}

// Short unit label used in the nutrition field suffixes below — matches how
// buildCustomFoodItem interprets the entered numbers (per 100g vs per serving).
function unitSuffix(portionUnit: PortionUnit, t: TFn): string {
  if (portionUnit === 'pack') return t('components.customFoodFields.suffixPack');
  if (portionUnit === 'capsule') return t('components.customFoodFields.suffixCapsule');
  return t('components.customFoodFields.suffixGram');
}

function portionUnitOptions(t: TFn): { key: PortionUnit; label: string }[] {
  return [
    { key: 'gram', label: t('components.customFoodFields.unitOptionGram') },
    { key: 'pack', label: t('components.customFoodFields.unitOptionPack') },
    { key: 'capsule', label: t('components.customFoodFields.unitOptionCapsule') },
  ];
}

function macroFieldBase(t: TFn): { key: keyof CustomFoodInput; label: string }[] {
  return [
    { key: 'energyKcal', label: t('components.customFoodFields.macroKcal') },
    { key: 'proteinG', label: t('components.customFoodFields.macroProtein') },
    { key: 'fatG', label: t('components.customFoodFields.macroFat') },
  ];
}

function microFieldBase(t: TFn): { key: keyof CustomFoodInput; label: string }[] {
  return [
    { key: 'calciumMg', label: t('components.customFoodFields.microCalcium') },
    { key: 'ironMg', label: t('components.customFoodFields.microIron') },
    { key: 'zincMg', label: t('components.customFoodFields.microZinc') },
    { key: 'epaMg', label: t('components.customFoodFields.microEpa') },
    { key: 'dhaMg', label: t('components.customFoodFields.microDha') },
  ];
}

// Rendered separately under a "Muối & điện giải" sub-heading, right after the
// macro/micro split, so salt-adjacent nutrients aren't scattered among the
// other micros. Salt (NaCl) itself is NEVER a stored field — it's derived
// from sodium below (see microBatteryEngine.per100gValue's 'salt' case:
// sodium_mg × 2.5 / 1000), so this list only holds real CustomFoodInput keys.
function electrolyteFieldBase(t: TFn): { key: keyof CustomFoodInput; label: string }[] {
  return [
    { key: 'sodiumMg', label: t('components.customFoodFields.electrolyteSodium') },
    { key: 'potassiumMg', label: t('components.customFoodFields.electrolytePotassium') },
    { key: 'magnesiumMg', label: t('components.customFoodFields.electrolyteMagnesium') },
  ];
}

// Same conversion microBatteryEngine uses for the derived "salt" micro-battery
// (2.5 g NaCl per 1 g sodium) — pure display-only preview, nothing is stored.
function saltGramsFromSodiumMg(sodiumMg: number): number {
  return Math.round(((sodiumMg * 2.5) / 1000) * 10) / 10;
}

export function CustomFoodFields({
  input,
  onChange,
  showMicros,
  onToggleMicros,
  autoFocusName,
}: Props) {
  const { t } = useT();
  const suffix = unitSuffix(input.portionUnit, t);
  const isServingBased = input.portionUnit !== 'gram';

  const sodiumValue = parseFloat(input.sodiumMg);
  const hasValidSodium = input.sodiumMg.trim() !== '' && !isNaN(sodiumValue);

  const servingUnitNoun =
    input.portionUnit === 'pack'
      ? t('components.customFoodFields.unitPackNoun')
      : t('components.customFoodFields.unitCapsuleNoun');

  return (
    <>
      <Text style={styles.fieldLabel}>{t('components.customFoodFields.nameLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('components.customFoodFields.namePlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={input.name}
        onChangeText={(v) => onChange('name', v)}
        autoFocus={autoFocusName}
      />

      <Text style={styles.fieldLabel}>{t('components.customFoodFields.categoryLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('components.customFoodFields.categoryPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={input.category}
        onChangeText={(v) => onChange('category', v)}
      />

      <Text style={styles.fieldLabel}>{t('components.customFoodFields.portionUnitLabel')}</Text>
      <View style={styles.unitRow}>
        {portionUnitOptions(t).map((opt) => (
          <Pressable
            key={opt.key}
            style={({ pressed }) => [
              styles.unitChip,
              input.portionUnit === opt.key && styles.unitChipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange('portionUnit', opt.key)}
          >
            <Text
              style={[
                styles.unitChipText,
                input.portionUnit === opt.key && styles.unitChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isServingBased ? (
        <>
          <Text style={styles.fieldLabel}>
            {t('components.customFoodFields.servingWeightLabel', { unit: servingUnitNoun })}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('components.customFoodFields.servingWeightPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={input.servingWeightG}
            onChangeText={(v) => onChange('servingWeightG', v)}
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>{t('components.customFoodFields.defaultServingLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('components.customFoodFields.defaultServingPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={input.defaultServingG}
            onChangeText={(v) => onChange('defaultServingG', v)}
          />
        </>
      )}

      {macroFieldBase(t).map((f) => (
        <React.Fragment key={f.key}>
          <Text style={styles.fieldLabel}>
            {f.label} {suffix}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={input[f.key]}
            onChangeText={(v) => onChange(f.key, v)}
          />
        </React.Fragment>
      ))}

      <Text style={styles.fieldLabel}>
        {t('components.customFoodFields.carbsLabel', { suffix })}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={input.carbG}
        onChangeText={(v) => onChange('carbG', v)}
      />

      {/* Sugar/fiber are a breakdown OF carbG above, not an addition to it —
          buildCustomFoodItem stores them as separate informational micros
          and never adds them into carbG. */}
      <View style={styles.carbBreakdown}>
        <Text style={styles.carbBreakdownNote}>
          {t('components.customFoodFields.carbBreakdownNote')}
        </Text>
        <Text style={styles.fieldLabelNested}>
          {t('components.customFoodFields.sugarLabel', { suffix })}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={input.sugarG}
          onChangeText={(v) => onChange('sugarG', v)}
        />
        <Text style={styles.fieldLabelNested}>
          {t('components.customFoodFields.fiberLabel', { suffix })}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={input.fiberG}
          onChangeText={(v) => onChange('fiberG', v)}
        />
      </View>

      <Text style={styles.fieldLabel}>
        {t('components.customFoodFields.waterLabel', { suffix })}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={input.waterG}
        onChangeText={(v) => onChange('waterG', v)}
      />

      <Pressable
        style={({ pressed }) => [styles.microsToggle, pressed && styles.pressed]}
        onPress={onToggleMicros}
      >
        <Text style={styles.chipText}>
          {showMicros
            ? t('components.customFoodFields.hideMicrosToggle')
            : t('components.customFoodFields.showMicrosToggle')}
        </Text>
      </Pressable>
      <Text style={styles.microsHint}>{t('components.customFoodFields.microsHint')}</Text>

      {showMicros && (
        <>
          {microFieldBase(t).map((f) => (
            <React.Fragment key={f.key}>
              <Text style={styles.fieldLabel}>
                {f.label} {suffix}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={input[f.key]}
                onChangeText={(v) => onChange(f.key, v)}
              />
            </React.Fragment>
          ))}

          <Text style={styles.subHeading}>
            {t('components.customFoodFields.electrolyteSectionLabel')}
          </Text>
          {electrolyteFieldBase(t).map((f) => (
            <React.Fragment key={f.key}>
              <Text style={styles.fieldLabel}>
                {f.label} {suffix}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={input[f.key]}
                onChangeText={(v) => onChange(f.key, v)}
              />
              {/* Salt (NaCl) is derived, never stored — see
                  electrolyteFieldBase comment above. */}
              {f.key === 'sodiumMg' && hasValidSodium && (
                <Text style={styles.saltDerived}>
                  {t('components.customFoodFields.saltDerivedLabel', {
                    grams: saltGramsFromSodiumMg(sodiumValue).toFixed(1),
                  })}
                </Text>
              )}
            </React.Fragment>
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  fieldLabelNested: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: colors.bgHighlight,
    borderColor: colors.accent,
  },
  unitChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  unitChipTextActive: { color: colors.accent },
  carbBreakdown: {
    borderLeftWidth: 2,
    borderLeftColor: colors.bgElevated,
    paddingLeft: 12,
    gap: 8,
  },
  carbBreakdownNote: { fontSize: 11, color: colors.textSubtle, lineHeight: 15 },
  subHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDim,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  saltDerived: { fontSize: 11, color: colors.textSubtle, marginTop: -2 },
  microsHint: { fontSize: 11, color: colors.textSubtle, marginTop: -4 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  microsToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  chipText: { color: colors.textLight, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

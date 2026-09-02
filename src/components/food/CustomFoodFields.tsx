import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import type { CustomFoodInput } from '../../domain/food/customFoodInput';
import {
  isPortionCounted,
  nutritionBasisLabel,
  portionUnitNoun,
} from '../../domain/food/portionUnits';
import type { MeasureUnit, PortionUnit } from '../../types/food';
import type { Language } from '../../i18n/types';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { parseDecimal } from '../../lib/units';
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
// buildCustomFoodItem interprets the entered numbers (per 100g/100ml vs per
// portion), via the same helper both modals use for their intro subtitles.
function unitSuffix(input: CustomFoodInput, language: Language, t: TFn): string {
  return t('components.customFoodFields.nutritionSuffix', {
    basis: nutritionBasisLabel(input.portionUnit, input.servingLabel, input.measureUnit, language),
  });
}

const MEASURE_UNITS: MeasureUnit[] = ['g', 'ml'];

function measureUnitLabel(unit: MeasureUnit, t: TFn): string {
  return unit === 'ml' ? t('units.measure.milliliter') : t('units.measure.gram');
}

// "Theo g" / "Theo ml" for the weighed option, then the counted ones. The
// gram option's label follows the chosen measure unit so a liquid food reads
// "Theo ml" rather than the misleading "Gram".
function portionUnitOptions(measureUnit: MeasureUnit, t: TFn): { key: PortionUnit; label: string }[] {
  return [
    { key: 'gram', label: t('components.customFoodFields.unitOptionGram', { measure: measureUnit }) },
    { key: 'pack', label: t('components.customFoodFields.unitOptionPack') },
    { key: 'capsule', label: t('components.customFoodFields.unitOptionCapsule') },
    { key: 'serving', label: t('components.customFoodFields.unitOptionServing') },
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
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const suffix = unitSuffix(input, language, t);
  const isServingBased = isPortionCounted(input.portionUnit);

  const sodiumValue = parseDecimal(input.sodiumMg);
  const hasValidSodium = input.sodiumMg.trim() !== '' && !isNaN(sodiumValue);

  const servingUnitNoun = portionUnitNoun(input.portionUnit, input.servingLabel, language);

  return (
    <>
      <Text style={styles.fieldLabel}>{t('components.customFoodFields.nameLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('components.customFoodFields.namePlaceholder')}
        placeholderTextColor={c.textMuted}
        value={input.name}
        onChangeText={(v) => onChange('name', v)}
        autoFocus={autoFocusName}
      />

      <Text style={styles.fieldLabel}>{t('components.customFoodFields.categoryLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('components.customFoodFields.categoryPlaceholder')}
        placeholderTextColor={c.textMuted}
        value={input.category}
        onChangeText={(v) => onChange('category', v)}
      />

      {/* How the food is MEASURED (g/ml) is a separate question from how its
          portions are COUNTED (below) — a 65ml carton is measured in ml and
          counted in boxes. */}
      <Text style={styles.fieldLabel}>{t('components.customFoodFields.measureUnitLabel')}</Text>
      <View style={styles.unitRow}>
        {MEASURE_UNITS.map((unit) => (
          <Pressable
            key={unit}
            style={({ pressed }) => [
              styles.unitChip,
              input.measureUnit === unit && styles.unitChipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange('measureUnit', unit)}
          >
            <Text
              style={[styles.unitChipText, input.measureUnit === unit && styles.unitChipTextActive]}
            >
              {measureUnitLabel(unit, t)}
            </Text>
          </Pressable>
        ))}
      </View>
      {input.measureUnit === 'ml' && (
        <Text style={styles.unitNote}>{t('components.customFoodFields.measureNoteMl')}</Text>
      )}

      <Text style={styles.fieldLabel}>{t('components.customFoodFields.portionUnitLabel')}</Text>
      <View style={styles.unitRowWrap}>
        {portionUnitOptions(input.measureUnit, t).map((opt) => (
          <Pressable
            key={opt.key}
            style={({ pressed }) => [
              styles.unitChip,
              styles.unitChipFlexible,
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

      {input.portionUnit === 'serving' && (
        <>
          <Text style={styles.fieldLabel}>
            {t('components.customFoodFields.servingLabelLabel')}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('components.customFoodFields.servingLabelPlaceholder')}
            placeholderTextColor={c.textMuted}
            value={input.servingLabel}
            onChangeText={(v) => onChange('servingLabel', v)}
          />
          <Text style={styles.unitNote}>{t('components.customFoodFields.servingLabelHint')}</Text>
        </>
      )}

      {isServingBased ? (
        <>
          <Text style={styles.fieldLabel}>
            {t('components.customFoodFields.servingSizeLabel', {
              unit: servingUnitNoun,
              measure: input.measureUnit,
            })}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('components.customFoodFields.servingWeightPlaceholder')}
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            value={input.servingWeightG}
            onChangeText={(v) => onChange('servingWeightG', v)}
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>
            {t('components.customFoodFields.defaultServingLabel', { measure: input.measureUnit })}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('components.customFoodFields.defaultServingPlaceholder')}
            placeholderTextColor={c.textMuted}
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
            placeholderTextColor={c.textMuted}
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
        placeholderTextColor={c.textMuted}
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
          placeholderTextColor={c.textMuted}
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
          placeholderTextColor={c.textMuted}
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
        placeholderTextColor={c.textMuted}
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
                placeholderTextColor={c.textMuted}
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
                placeholderTextColor={c.textMuted}
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  fieldLabel: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
  fieldLabelNested: { fontSize: 12, color: c.textDim, marginTop: 4 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitNote: { fontSize: 11, color: c.textSubtle, lineHeight: 16, marginTop: -2 },
  unitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  // Inside the wrapping row the chips size to their own label instead of
  // splitting the row evenly — four chips at flex:1 are too narrow to read.
  unitChipFlexible: { flex: 0, flexGrow: 1, flexBasis: '46%', paddingHorizontal: 10 },
  unitChipActive: {
    backgroundColor: c.bgHighlight,
    borderColor: c.accent,
  },
  unitChipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  unitChipTextActive: { color: c.accent },
  carbBreakdown: {
    borderLeftWidth: 2,
    borderLeftColor: c.bgElevated,
    paddingLeft: 12,
    gap: 8,
  },
  carbBreakdownNote: { fontSize: 11, color: c.textSubtle, lineHeight: 15 },
  subHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textDim,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  saltDerived: { fontSize: 11, color: c.textSubtle, marginTop: -2 },
  microsHint: { fontSize: 11, color: c.textSubtle, marginTop: -4 },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  microsToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: 4,
  },
  chipText: { color: c.textLight, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  type CustomFoodInput,
  EMPTY_CUSTOM_FOOD_INPUT,
  buildCustomFoodItem,
  inputFromFoodItem,
  isValidCustomFoodInput,
  resetNutritionForUnitChange,
} from '../domain/food/customFoodInput';
import { addCustomFoodAndRegister } from '../data/food/customFoodRegistry';
import { upsertOverrideAndRegister } from '../data/food/foodOverrideRegistry';
import { CustomFoodFields } from './food/CustomFoodFields';
import type { FoodItem } from '../types/food';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';

// Reusable modal for two flows:
//  - mode 'edit': correct an existing food's nutrition. Saved as a food OVERRIDE
//    (upsertOverrideAndRegister) keyed by the SAME id, so getAnyFoodById shadows
//    the catalog value everywhere (micro batteries, daily summary, Excel).
//  - mode 'add': create a brand-new food/supplement (addCustomFoodAndRegister).
// Shares its field markup with FoodLogModal's inline "adding" branch via
// CustomFoodFields — but keeps its own save/navigation logic (edit-vs-add
// dispatch, close-on-save) since those genuinely differ between the two.
interface Props {
  visible: boolean;
  mode: 'edit' | 'add';
  initialFood?: FoodItem;
  presetCategory?: string;
  onClose: () => void;
  onSaved?: (item: FoodItem) => void;
}

export function FoodNutritionEditModal({
  visible,
  mode,
  initialFood,
  presetCategory,
  onClose,
  onSaved,
}: Props) {
  const { t } = useT();
  const [input, setInput] = useState<CustomFoodInput>(EMPTY_CUSTOM_FOOD_INPUT);
  const [showMicros, setShowMicros] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed the form each time the modal opens (or its target food changes),
  // using the React "adjust state during render when a prop changes" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // rather than an effect — a fresh open must start from the target's values.
  const openKey = visible
    ? `${mode}:${initialFood?.id ?? 'add'}:${presetCategory ?? ''}`
    : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (openKey !== null && openKey !== seededKey) {
    setSeededKey(openKey);
    if (mode === 'edit' && initialFood) {
      setInput(inputFromFoodItem(initialFood));
      setShowMicros(true); // editing existing data — show the micros up front
    } else {
      setInput({ ...EMPTY_CUSTOM_FOOD_INPUT, category: presetCategory ?? 'custom' });
      setShowMicros(false);
    }
    setSaving(false);
  }

  const valid = useMemo(() => isValidCustomFoodInput(input), [input]);

  // Matches the per-serving/per-100g interpretation CustomFoodFields uses for
  // its field suffixes, so the intro subtitle always says the same thing.
  const nutritionBasisLabel =
    input.portionUnit === 'pack'
      ? t('components.foodNutritionEditModal.basisPack')
      : input.portionUnit === 'capsule'
        ? t('components.foodNutritionEditModal.basisCapsule')
        : t('components.foodNutritionEditModal.basisGram');

  function set<K extends keyof CustomFoodInput>(key: K, value: CustomFoodInput[K]) {
    if (key === 'portionUnit') {
      // Per-100g and per-serving figures are different scales — clear the
      // nutrition fields instead of silently reinterpreting stale numbers.
      setInput((prev) => resetNutritionForUnitChange(prev, value as CustomFoodInput['portionUnit']));
      return;
    }
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const built = buildCustomFoodItem(input);
      if (mode === 'edit' && initialFood) {
        // Keep the ORIGINAL id (so this becomes an override of that food) plus
        // the base's non-nutrition identity (nameEn/nameDe/presets/note); only
        // the edited nameVi/category/serving/per100g take effect.
        const edited: FoodItem = {
          ...initialFood,
          nameVi: built.nameVi,
          category: built.category,
          defaultServingG: built.defaultServingG,
          per100g: built.per100g,
          portionUnit: built.portionUnit,
          servingWeightG: built.servingWeightG,
        };
        await upsertOverrideAndRegister(edited);
        onSaved?.(edited);
      } else {
        await addCustomFoodAndRegister(built);
        onSaved?.(built);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {mode === 'edit'
                ? t('components.foodNutritionEditModal.titleEdit')
                : t('components.foodNutritionEditModal.titleAdd')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {mode === 'edit'
              ? t('components.foodNutritionEditModal.subtitleEdit')
              : t('components.foodNutritionEditModal.subtitleAdd', { basis: nutritionBasisLabel })}
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <CustomFoodFields
              input={input}
              onChange={set}
              showMicros={showMicros}
              onToggleMicros={() => setShowMicros((v) => !v)}
            />
          </ScrollView>

          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.save,
                (!valid || saving) && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSave}
              disabled={!valid || saving}
            >
              <Text style={styles.btnText}>
                {mode === 'edit'
                  ? t('components.foodNutritionEditModal.saveEditButton')
                  : t('components.foodNutritionEditModal.saveAddButton')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 10,
    maxHeight: '88%',
    // Shrink below maxHeight when the keyboard eats the overlay's space, so
    // the scroll area compresses and the Huỷ/Lưu row stays visible (same
    // reasoning as BottomSheet styles.sheet).
    flexShrink: 1,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  scroll: { flexShrink: 1 },
  scrollContent: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  save: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  cancel: { backgroundColor: colors.bgElevated },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  btnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});

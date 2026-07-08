import type { FoodItem } from '../../types/food';
import { getFoodById } from './foodDatabase';
import { getUsdaFoodById } from './usdaFoods';
import { getCustomFoodByIdSync } from './customFoodRegistry';
import { getOverrideByIdSync } from './foodOverrideRegistry';

// Resolves a logged foodId no matter which catalog it came from: the
// Vietnamese CSV ("rice_white_cooked"), the USDA lookup ("usda_2727589"), or
// a user-saved custom food (runtime SQLite-backed registry). Anything that
// aggregates over the food log (e.g. the micronutrient battery engine, the
// Excel export) must use this, not getFoodById alone — otherwise
// USDA-logged or custom-logged meals silently drop out of the totals.
//
// User-edited overrides SHADOW the catalog here: if the user corrected a
// food's nutrition (food_overrides table -> foodOverrideRegistry), the
// override is merged on TOP of the base food so the corrected per-100g values
// + name/category win, while any field the user didn't touch falls back to
// the base. Because EVERY aggregation path goes through this one function,
// overrides automatically flow everywhere (micro batteries, daily summary,
// Excel) with no other changes needed.
export function getAnyFoodById(id: string): FoodItem | undefined {
  const base = getFoodById(id) ?? getUsdaFoodById(id) ?? getCustomFoodByIdSync(id);
  const override = getOverrideByIdSync(id);

  if (!override) return base;
  // No base (override of a since-removed catalog id): use the override alone.
  if (!base) return override;

  // Merge ONLY the fields an override actually owns (name/category/serving +
  // per100g). The override row has no columns for servingPresets/nameDe/note,
  // so foodOverrideMapper fills them with ''/[] — spreading the whole override
  // would WIPE the base's real presets/nameDe after an app restart (once the
  // override is rehydrated from DB). Keep those from the base.
  return {
    ...base,
    nameVi: override.nameVi,
    nameEn: override.nameEn,
    category: override.category,
    defaultServingG: override.defaultServingG,
    per100g: { ...base.per100g, ...override.per100g },
  };
}

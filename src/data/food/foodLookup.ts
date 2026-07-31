import type { FoodItem, FoodLogEntry } from '../../types/food';
import type { Language } from '../../i18n/types';
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
  //
  // Fix #9 (altitude note): FoodItem has exactly 3 join points that must be
  // kept in sync whenever a new field is added to it — forgetting one is how
  // fields silently stop flowing through overrides/edits:
  //   (1) HERE — this merge;
  //   (2) src/components/FoodNutritionEditModal.tsx, the mode === 'edit'
  //       branch (copies fields from `built` onto `edited`);
  //   (3) the repository mappers + src/data/db/schema.ts + database.ts
  //       migrations.
  // This is a lightweight reminder, not a proposal to build a generic merge
  // mechanism — a handful of fields doesn't warrant that.
  const portionUnit = override.portionUnit ?? base.portionUnit;
  // Fix #7: a 'gram' unit means "weighed by grams", so any servingWeightG
  // (the real gram weight of ONE pack/capsule) must NOT leak through from
  // either the override or the base catalog — buildCustomFoodItem never sets
  // servingWeightG for a 'gram' override, so `??` would otherwise fall back
  // to the base's stale pack/capsule weight (e.g. an outdated 1.22 g/capsule
  // figure) and that value would silently resurface if the user later
  // switches the unit back to pack/capsule.
  const servingWeightG =
    portionUnit === 'gram' ? undefined : override.servingWeightG ?? base.servingWeightG;

  return {
    ...base,
    nameVi: override.nameVi,
    nameEn: override.nameEn,
    category: override.category,
    defaultServingG: override.defaultServingG,
    per100g: { ...base.per100g, ...override.per100g },
    portionUnit,
    servingWeightG,
  };
}

// The display name for a FoodItem in the current UI language. Falls back
// toward 'vi' (the app's original/default language — see i18n/types.ts)
// whenever a translation is missing, e.g. a custom food (nameEn: '') or a
// catalog row not yet covered by database/usda_names_de.csv.
export function foodDisplayName(item: FoodItem, language: Language): string {
  if (language === 'de') return item.nameDe || item.nameEn || item.nameVi;
  if (language === 'en') return item.nameEn || item.nameVi;
  return item.nameVi;
}

// The display name for anything carrying a foodId + a frozen foodNameVi
// snapshot — a logged FoodLogEntry, or a FoodSuggestion (foodSuggestions.ts)
// built from one. Resolves the live FoodItem via foodId so catalog-backed
// entries follow a later language switch, and only falls back to the
// snapshot when the catalog no longer has that id (custom food deleted by
// the user, or an override removed) — the one case AGENTS.md's "historical
// snapshot, never retro-translate" rule still applies to.
export function foodLogEntryDisplayName(
  entry: Pick<FoodLogEntry, 'foodId' | 'foodNameVi'>,
  language: Language
): string {
  const item = getAnyFoodById(entry.foodId);
  return item ? foodDisplayName(item, language) : entry.foodNameVi;
}

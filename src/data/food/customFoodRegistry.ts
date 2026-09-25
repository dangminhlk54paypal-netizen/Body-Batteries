import type { FoodItem } from '../../types/food';
import { repairEncodedFoodNames, repairStoredTranslations } from '../../domain/food/foodNameText';

// In-memory mirror of the `custom_foods` table.
//
// The built-in catalog's search index (SEARCH_INDEX in foodSearch.ts) is
// precomputed synchronously at module load, but SQLite reads are async — so
// a user-added food can't just be "added to the DB" and expected to show up
// in search immediately. This module is the sync bridge: it holds the
// current list of custom foods in memory, hydrated from the DB at startup
// and kept up to date on every write, so foodSearch.ts / foodLookup.ts can
// read it synchronously.
//
// customFoodsRepository.ts (and everything it imports, including
// expo-sqlite) is loaded LAZILY inside the two functions below rather than
// with a static top-level import. This keeps this module — and therefore
// foodSearch.ts / foodLookup.ts, which import it — free of any expo-sqlite
// dependency, so they stay unit-testable under plain Jest (expo-sqlite's
// native module can't load outside the app runtime; mirrors the dynamic
// `import()` pattern already used for native-only modules in App.tsx).
let customFoods: FoodItem[] = [];

export function setCustomFoods(items: FoodItem[]): void {
  customFoods = items;
}

export function getCustomFoods(): FoodItem[] {
  return customFoods;
}

export function getCustomFoodByIdSync(id: string): FoodItem | undefined {
  return customFoods.find((f) => f.id === id);
}

// The single public entry point the UI should call to save a custom food.
// Persists it to SQLite, then appends/replaces it in the in-memory registry
// so it's searchable (searchAllFoods) and resolvable (getAnyFoodById)
// immediately — no app reload needed. The UI must never call
// addCustomFood/getDb directly; only this function.
export async function addCustomFoodAndRegister(item: FoodItem): Promise<void> {
  const { addCustomFood } = await import('../repositories/customFoodsRepository');
  await addCustomFood(item);
  // Replace an existing entry with the same id (edit) instead of duplicating.
  customFoods = [...customFoods.filter((f) => f.id !== item.id), item];
}

// Removes a custom food from SQLite and from the in-memory registry, so it
// disappears from search immediately. The single public entry point for
// deleting a user-saved food — the UI must never call the repository directly.
export async function deleteCustomFoodAndUnregister(id: string): Promise<void> {
  const { deleteCustomFood } = await import('../repositories/customFoodsRepository');
  await deleteCustomFood(id);
  customFoods = customFoods.filter((f) => f.id !== id);
}

// Rewrites only a custom food's two stored names (no created_at reset, so the
// "Mine" list keeps its order) and updates the registry in place.
export async function updateCustomFoodNamesAndRegister(id: string, nameVi: string, nameEn: string): Promise<void> {
  const { updateCustomFoodNames } = await import('../repositories/customFoodsRepository');
  await updateCustomFoodNames(id, nameVi, nameEn);
  customFoods = customFoods.map((f) => (f.id === id ? { ...f, nameVi, nameEn, nameDe: undefined } : f));
}

// Hydrates the registry from the DB. Call once at app startup, right after
// initDatabase(). Defensive: custom foods are an enhancement, not core data —
// a failure here must not block startup, so it just leaves the registry
// empty and logs a warning.
//
// Also self-heals names the auto-translate feature stored badly (see
// foodNameText.ts): URL-encoded ones ("Fischst%C3%A4bchen%20Berida"), and
// machine translations of a dish known by its own name ("Bánh nướng tàu" →
// "Train pies") or full of Vietnamese letters — those go back to the one typed
// name. The registry gets the fixed names right away, and the fix is written
// back to SQLite so it only ever happens once per food.
export async function loadCustomFoodsIntoRegistry(): Promise<void> {
  try {
    const { getAllCustomFoods, updateCustomFoodNames } = await import(
      '../repositories/customFoodsRepository'
    );
    const repaired: FoodItem[] = [];
    const items = (await getAllCustomFoods()).map((item) => {
      const decoded = repairEncodedFoodNames(item) ?? item;
      const fixed = repairStoredTranslations(decoded) ?? (decoded === item ? null : decoded);
      if (!fixed) return item;
      repaired.push(fixed);
      return fixed;
    });
    setCustomFoods(items);
    for (const item of repaired) {
      try {
        await updateCustomFoodNames(item.id, item.nameVi, item.nameEn);
      } catch (e) {
        // Registry already shows the decoded name; next startup retries.
        console.warn('Failed to persist repaired custom food name:', e);
      }
    }
  } catch (e) {
    console.warn('Failed to load custom foods into registry:', e);
  }
}

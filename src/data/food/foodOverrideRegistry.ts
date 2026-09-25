import type { FoodItem } from '../../types/food';
import { getCustomFoodByIdSync } from './customFoodRegistry';
import { repairStoredTranslations } from '../../domain/food/foodNameText';

// In-memory mirror of the `food_overrides` table.
//
// A food override SHADOWS the build-time-generated catalog (or a custom food)
// at lookup time — the user's corrected nutrition wins without touching the
// generated files. Catalog lookups (getAnyFoodById in foodLookup.ts) are
// synchronous, but SQLite reads are async — so this module is the sync
// bridge: it holds the current overrides in memory, hydrated from the DB at
// startup and kept up to date on every write, so foodLookup.ts can read it
// synchronously via getOverrideByIdSync.
//
// foodOverridesRepository.ts (and everything it imports, including
// expo-sqlite) is loaded LAZILY inside the two async functions below rather
// than with a static top-level import. This keeps this module — and therefore
// foodLookup.ts, which imports it — free of any expo-sqlite dependency, so it
// stays unit-testable under plain Jest (mirrors customFoodRegistry.ts).
let overrides: Map<string, FoodItem> = new Map();

export function setOverrides(items: FoodItem[]): void {
  overrides = new Map(items.map((it) => [it.id, it]));
}

export function getOverrideByIdSync(id: string): FoodItem | undefined {
  return overrides.get(id);
}

export function getAllOverridesSync(): FoodItem[] {
  return [...overrides.values()];
}

// The single public entry point the UI should call to save a food override.
// Persists it to SQLite, then updates the in-memory registry immediately so
// the corrected values take effect everywhere getAnyFoodById flows (micro
// batteries, daily summary, Excel) without an app reload. The UI must never
// call upsertOverride/getDb directly; only this function.
export async function upsertOverrideAndRegister(item: FoodItem): Promise<void> {
  const { upsertOverride } = await import('../repositories/foodOverridesRepository');
  await upsertOverride(item);
  overrides.set(item.id, item);
}

// Drops a user's nutrition correction, so the food reverts to whatever the
// built-in catalog says. Mirrors upsertOverrideAndRegister: persist, then
// update the in-memory registry so getAnyFoodById stops merging it right away.
export async function deleteOverrideAndUnregister(id: string): Promise<void> {
  const { deleteOverride } = await import('../repositories/foodOverridesRepository');
  await deleteOverride(id);
  overrides.delete(id);
}

// Hydrates the registry from the DB. Call once at app startup, right after
// loadCustomFoodsIntoRegistry(). Defensive: overrides are an enhancement, not
// core data — a failure here must not block startup, so it just leaves the
// registry empty and logs a warning.
//
// An override of a CUSTOM food copied that food's machine-translated nameEn
// when it was edited, and the override's name wins at lookup — so the same
// clean-up loadCustomFoodsIntoRegistry does runs here too (never for catalog
// foods, whose English names are real). Needs the custom registry loaded first.
export async function loadOverridesIntoRegistry(): Promise<void> {
  try {
    const { getAllOverrides, upsertOverride } = await import('../repositories/foodOverridesRepository');
    const repaired: FoodItem[] = [];
    const items = (await getAllOverrides()).map((item) => {
      if (!getCustomFoodByIdSync(item.id)) return item;
      const fixed = repairStoredTranslations(item);
      if (!fixed) return item;
      repaired.push(fixed);
      return fixed;
    });
    setOverrides(items);
    for (const item of repaired) {
      try {
        await upsertOverride(item);
      } catch (e) {
        // Registry already shows the fixed name; next startup retries.
        console.warn('Failed to persist repaired override name:', e);
      }
    }
  } catch (e) {
    console.warn('Failed to load food overrides into registry:', e);
  }
}

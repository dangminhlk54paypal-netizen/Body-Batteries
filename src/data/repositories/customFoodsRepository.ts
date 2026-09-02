import { getDb } from '../db/database';
import type { FoodItem } from '../../types/food';
import { rowToCustomFoodItem, type CustomFoodRow } from './customFoodMapper';

export { rowToCustomFoodItem } from './customFoodMapper';

// Adds (or replaces, by id) one user-saved food. Callers should go through
// `addCustomFoodAndRegister` in src/data/food/customFoodRegistry.ts instead
// of calling this directly — that also keeps the in-memory search index in
// sync so the new food is searchable without an app reload.
export async function addCustomFood(item: FoodItem): Promise<void> {
  const db = getDb();
  const n = item.per100g;
  await db.runAsync(
    `INSERT OR REPLACE INTO custom_foods
       (id, name_vi, name_en, category, default_serving_g,
        energy_kcal, water_g, protein_g, fat_g, carb_g, fiber_g, sugar_g,
        calcium_mg, iron_mg, sodium_mg, potassium_mg, magnesium_mg, zinc_mg,
        epa_mg, dha_mg, portion_unit, serving_weight_g, serving_label,
        measure_unit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.nameVi,
    item.nameEn,
    item.category,
    item.defaultServingG,
    n.energyKcal,
    n.waterG,
    n.proteinG,
    n.fatG,
    n.carbG,
    n.fiberG,
    n.sugarG,
    n.calciumMg,
    n.ironMg,
    n.sodiumMg,
    n.potassiumMg,
    n.magnesiumMg,
    n.zincMg,
    n.epaMg ?? null,
    n.dhaMg ?? null,
    item.portionUnit ?? null,
    item.servingWeightG ?? null,
    item.servingLabel ?? null,
    item.measureUnit ?? null,
    Date.now()
  );
}

export async function getAllCustomFoods(): Promise<FoodItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<CustomFoodRow>(
    'SELECT * FROM custom_foods ORDER BY created_at DESC'
  );
  return rows.map(rowToCustomFoodItem);
}

export async function getCustomFoodById(id: string): Promise<FoodItem | undefined> {
  const db = getDb();
  const row = await db.getFirstAsync<CustomFoodRow>(
    'SELECT * FROM custom_foods WHERE id = ?',
    id
  );
  return row ? rowToCustomFoodItem(row) : undefined;
}

// Permanently removes one user-saved food. Callers go through
// `deleteCustomFoodAndUnregister` in customFoodRegistry.ts, which also drops
// it from the in-memory search index. Food-log rows that referenced it are
// NOT touched: they keep their own snapshotted nutrition and fall back to the
// frozen `foodNameVi` for display (see foodLogEntryDisplayName), so deleting a
// food never rewrites history.
export async function deleteCustomFood(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM custom_foods WHERE id = ?', id);
}

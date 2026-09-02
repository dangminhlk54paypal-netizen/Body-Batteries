import { getDb } from '../db/database';
import type { FoodItem } from '../../types/food';
import { rowToOverrideItem, type FoodOverrideRow } from './foodOverrideMapper';

export { rowToOverrideItem } from './foodOverrideMapper';

// Adds (or replaces, keyed by food_id) one food-nutrition override. Callers
// should go through `upsertOverrideAndRegister` in
// src/data/food/foodOverrideRegistry.ts instead of calling this directly —
// that also keeps the in-memory registry in sync so the corrected values
// take effect everywhere (lookup/aggregation) without an app reload.
export async function upsertOverride(item: FoodItem): Promise<void> {
  const db = getDb();
  const n = item.per100g;
  await db.runAsync(
    `INSERT OR REPLACE INTO food_overrides
       (food_id, name_vi, name_en, category, default_serving_g,
        energy_kcal, water_g, protein_g, fat_g, carb_g, fiber_g, sugar_g,
        calcium_mg, iron_mg, sodium_mg, potassium_mg, magnesium_mg, zinc_mg,
        epa_mg, dha_mg, portion_unit, serving_weight_g, serving_label,
        measure_unit, updated_at)
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

export async function getAllOverrides(): Promise<FoodItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FoodOverrideRow>(
    'SELECT * FROM food_overrides ORDER BY updated_at DESC'
  );
  return rows.map(rowToOverrideItem);
}

export async function getOverrideById(id: string): Promise<FoodItem | undefined> {
  const db = getDb();
  const row = await db.getFirstAsync<FoodOverrideRow>(
    'SELECT * FROM food_overrides WHERE food_id = ?',
    id
  );
  return row ? rowToOverrideItem(row) : undefined;
}

export async function deleteOverride(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM food_overrides WHERE food_id = ?', id);
}

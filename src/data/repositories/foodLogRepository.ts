import { getDb } from '../db/database';
import type { FoodLogEntry, MealType } from '../../types/food';

interface FoodLogRow {
  id: string;
  timestamp: number;
  meal_type: string;
  food_id: string;
  food_name_vi: string;
  grams: number;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  water_g: number;
  minerals_mg: number;
}

function rowToEntry(r: FoodLogRow): FoodLogEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    mealType: r.meal_type as MealType,
    foodId: r.food_id,
    foodNameVi: r.food_name_vi,
    grams: r.grams,
    energyKcal: r.energy_kcal,
    proteinG: r.protein_g,
    fatG: r.fat_g,
    carbG: r.carb_g,
    waterG: r.water_g,
    mineralsMg: r.minerals_mg,
  };
}

export async function addFoodLogEntry(entry: FoodLogEntry): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO food_log
       (id, timestamp, meal_type, food_id, food_name_vi, grams,
        energy_kcal, protein_g, fat_g, carb_g, water_g, minerals_mg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.timestamp,
    entry.mealType,
    entry.foodId,
    entry.foodNameVi,
    entry.grams,
    entry.energyKcal,
    entry.proteinG,
    entry.fatG,
    entry.carbG,
    entry.waterG,
    entry.mineralsMg
  );
}

export async function getFoodLogForDate(date: string): Promise<FoodLogEntry[]> {
  const db = getDb();
  const startMs = new Date(date + 'T00:00:00').getTime();
  const endMs = startMs + 86_400_000;
  const rows = await db.getAllAsync<FoodLogRow>(
    'SELECT * FROM food_log WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC',
    startMs,
    endMs
  );
  return rows.map(rowToEntry);
}

export async function getFoodLogInRange(
  fromDate: string,
  toDate: string
): Promise<FoodLogEntry[]> {
  const db = getDb();
  const startMs = new Date(fromDate + 'T00:00:00').getTime();
  const endMs = new Date(toDate + 'T23:59:59').getTime();
  const rows = await db.getAllAsync<FoodLogRow>(
    'SELECT * FROM food_log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    startMs,
    endMs
  );
  return rows.map(rowToEntry);
}

export async function deleteFoodLogBefore(date: string): Promise<void> {
  const db = getDb();
  const cutoffMs = new Date(date + 'T00:00:00').getTime();
  await db.runAsync('DELETE FROM food_log WHERE timestamp < ?', cutoffMs);
}

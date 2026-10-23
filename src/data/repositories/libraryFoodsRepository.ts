import { getDb } from '../db/database';
import type { FoodItem } from '../../types/food';
import type { LibrarySource } from '../../types/foodLibrary';
import {
  libraryFoodBindValues,
  rowToLibraryFood,
  rowToLibrarySource,
  type LibraryFoodRow,
  type LibrarySourceRow,
} from './libraryFoodMapper';

// SQLite access for "Nguồn của tôi" (library_sources / library_foods). The
// UI never calls this directly — it goes through libraryFoodRegistry.ts
// (search, lookup, toggle, delete) or libraryImportService.ts (import), which
// also keep the in-memory caches in step.

const LIBRARY_FOOD_COLUMNS = `id, source_id, name_vi, name_en, name_de, name_norm, category, default_serving_g,
  energy_kcal, water_g, protein_g, fat_g, carb_g, fiber_g, sugar_g,
  calcium_mg, iron_mg, sodium_mg, potassium_mg, magnesium_mg, zinc_mg, epa_mg, dha_mg`;
const LIBRARY_FOOD_PLACEHOLDERS = Array.from({ length: 23 }, () => '?').join(', ');

export async function getAllLibrarySources(): Promise<LibrarySource[]> {
  const rows = await getDb().getAllAsync<LibrarySourceRow>(
    'SELECT * FROM library_sources ORDER BY created_at DESC'
  );
  return rows.map(rowToLibrarySource);
}

export async function upsertLibrarySource(source: LibrarySource): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO library_sources
       (id, name, file_name, enabled, food_count, mapping, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    source.id,
    source.name,
    source.fileName,
    source.enabled ? 1 : 0,
    source.foodCount,
    source.mapping ? JSON.stringify(source.mapping) : null,
    source.createdAt,
    source.updatedAt
  );
}

export async function setLibrarySourceEnabled(id: string, enabled: boolean, updatedAt: number): Promise<void> {
  await getDb().runAsync(
    'UPDATE library_sources SET enabled = ?, updated_at = ? WHERE id = ?',
    enabled ? 1 : 0,
    updatedAt,
    id
  );
}

// Removes a source and every food in it. Meals already logged from it keep
// their own snapshotted nutrition and frozen name (foodLogEntryDisplayName).
export async function deleteLibrarySource(id: string): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM library_foods WHERE source_id = ?', id);
    await db.runAsync('DELETE FROM library_sources WHERE id = ?', id);
  });
}

export async function countLibraryFoods(sourceId: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM library_foods WHERE source_id = ?',
    sourceId
  );
  return row?.n ?? 0;
}

// Writes one batch of converted rows in a single transaction with one
// prepared statement — the import calls this every few hundred rows. A row
// whose id is already there (same key in the file twice, or re-importing)
// replaces it.
export async function insertLibraryFoods(sourceId: string, items: FoodItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `INSERT OR REPLACE INTO library_foods (${LIBRARY_FOOD_COLUMNS}) VALUES (${LIBRARY_FOOD_PLACEHOLDERS})`
    );
    try {
      for (const item of items) await statement.executeAsync(libraryFoodBindValues(item, sourceId));
    } finally {
      await statement.finalizeAsync();
    }
  });
}

// Foods of ENABLED sources whose folded names contain every typed word.
// `words` come from searchNormalize.wordsOf, so they are [a-z0-9]+ and need
// no LIKE escaping. A plain substring scan: fast enough for the sizes the
// owner allows (≤ a few hundred MB), and the in-memory ranker re-orders the
// handful of rows it returns.
export async function searchLibraryFoods(words: string[], limit: number): Promise<FoodItem[]> {
  if (words.length === 0) return [];
  const conditions = words.map(() => 'f.name_norm LIKE ?').join(' AND ');
  const rows = await getDb().getAllAsync<LibraryFoodRow>(
    `SELECT f.* FROM library_foods f
       JOIN library_sources s ON s.id = f.source_id
      WHERE s.enabled = 1 AND ${conditions}
      LIMIT ?`,
    ...words.map((w) => `%${w}%`),
    limit
  );
  return rows.map(rowToLibraryFood);
}

// Library foods that meals in the food log still point at — loaded at
// startup so getAnyFoodById resolves them synchronously (micro batteries,
// Excel, display names) without holding whole tables in memory.
export async function getLoggedLibraryFoods(): Promise<FoodItem[]> {
  const rows = await getDb().getAllAsync<LibraryFoodRow>(
    `SELECT * FROM library_foods
      WHERE id IN (SELECT DISTINCT food_id FROM food_log WHERE substr(food_id, 1, 4) = 'lib_')`
  );
  return rows.map(rowToLibraryFood);
}

// "↻ cập nhật nguồn": the new version of a file was imported into the
// temporary source `fromId`; in one transaction its rows replace every row of
// `targetId`, re-keyed to the target's id (lib_<from>_<key> → lib_<target>_<key>)
// so a food keeps its id across versions, and the temporary source row goes.
export async function replaceLibrarySourceFoods(targetId: string, fromId: string): Promise<void> {
  const db = getDb();
  const keyStart = `lib_${fromId}`.length + 1; // substr() is 1-based; keeps the "_<key>" part
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM library_foods WHERE source_id = ?', targetId);
    await db.runAsync(
      "UPDATE library_foods SET id = 'lib_' || ? || substr(id, ?), source_id = ? WHERE source_id = ?",
      targetId,
      keyStart,
      targetId,
      fromId
    );
    await db.runAsync('DELETE FROM library_sources WHERE id = ?', fromId);
  });
}

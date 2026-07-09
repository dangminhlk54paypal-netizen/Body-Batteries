import * as SQLite from 'expo-sqlite';
import {
  ALL_SCHEMAS,
  BATTERY_READINGS_MIGRATION_COLUMNS,
  CUSTOM_FOODS_MIGRATION_COLUMNS,
  FOOD_OVERRIDES_MIGRATION_COLUMNS,
  FOOD_LOG_MIGRATION_COLUMNS,
  ACTIVITY_LOG_MIGRATION_COLUMNS,
} from './schema';
import { DEFAULT_BATTERIES } from '../../lib/constants';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('body_batteries.db');

  await _db.execAsync('PRAGMA journal_mode = WAL;');

  for (const sql of ALL_SCHEMAS) {
    await _db.execAsync(sql);
  }

  await migrateColumns(_db, 'battery_readings', BATTERY_READINGS_MIGRATION_COLUMNS);
  await migrateColumns(_db, 'custom_foods', CUSTOM_FOODS_MIGRATION_COLUMNS);
  await migrateColumns(_db, 'food_overrides', FOOD_OVERRIDES_MIGRATION_COLUMNS);
  await migrateColumns(_db, 'food_log', FOOD_LOG_MIGRATION_COLUMNS);
  await migrateColumns(_db, 'activity_log', ACTIVITY_LOG_MIGRATION_COLUMNS);
  await seedDefaultBatteries(_db);
}

// Adds columns introduced after the first release to tables created by older
// installs (CREATE TABLE IF NOT EXISTS never alters an existing table).
async function migrateColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: { name: string; ddl: string }[]
): Promise<void> {
  const existingRows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const existing = new Set(existingRows.map((c) => c.name));
  for (const col of columns) {
    if (!existing.has(col.name)) {
      await db.execAsync(col.ddl);
    }
  }
}

async function seedDefaultBatteries(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const battery of DEFAULT_BATTERIES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO battery_types
        (id, name, unit, default_capacity, color, icon, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      battery.id,
      battery.name,
      battery.unit,
      battery.defaultCapacity,
      battery.color,
      battery.icon,
      battery.isActive ? 1 : 0
    );
  }
}

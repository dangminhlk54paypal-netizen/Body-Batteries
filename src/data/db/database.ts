import * as SQLite from 'expo-sqlite';
import { ALL_SCHEMAS, BATTERY_READINGS_MIGRATION_COLUMNS } from './schema';
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

  await migrateBatteryReadings(_db);
  await seedDefaultBatteries(_db);
}

// Adds columns introduced after the first release to tables created by older
// installs (CREATE TABLE IF NOT EXISTS never alters an existing table).
async function migrateBatteryReadings(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(battery_readings)'
  );
  const existing = new Set(columns.map((c) => c.name));
  for (const col of BATTERY_READINGS_MIGRATION_COLUMNS) {
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

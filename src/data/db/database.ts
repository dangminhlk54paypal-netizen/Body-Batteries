import * as SQLite from 'expo-sqlite';
import { ALL_SCHEMAS } from './schema';
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

  await seedDefaultBatteries(_db);
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

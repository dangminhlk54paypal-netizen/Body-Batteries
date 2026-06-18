// Web stub: expo-sqlite không hỗ trợ trên trình duyệt web.
// File này được Metro tự động chọn thay cho database.ts khi build cho web.

import type { SQLiteDatabase } from 'expo-sqlite';

let _db: any = null;

export function getDb(): any {
  console.warn('SQLite is not available on web');
  return _db;
}

export async function initDatabase(): Promise<void> {
  console.warn('SQLite is not available on web. Skipping database initialization.');
}

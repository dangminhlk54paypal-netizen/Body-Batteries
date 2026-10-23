import { getDb } from '../db/database';
import { dateString } from '../../lib/dateUtils';
import type { ArchiveKind } from '../../types/dataRetention';
import type { BackupRow } from '../../domain/retention/dataBackup';
import type { EatingDaySummary } from '../../domain/retention/eatingHabits';

// Which tables the retention cycle (services/retention/retentionService.ts)
// may back up and trim, and how each one is dated. `archive`: the whole table
// is kept while that Kho is on. `keepIf`: only the matching rows are kept
// while that Kho is on (a steps-only activity row is still trimmed). Tables
// not listed here — custom foods, food corrections, the encrypted diary,
// battery types — are never trimmed.
type DateUnit = 'date' | 'ms' | 'month';
interface RetentionTable {
  table: string;
  column: string;
  unit: DateUnit;
  archive?: ArchiveKind;
  keepIf?: { archive: ArchiveKind; where: string };
  onlyWhere?: string; // rows outside this are never trimmed
}

const RETENTION_TABLES: RetentionTable[] = [
  { table: 'food_log', column: 'timestamp', unit: 'ms' },
  { table: 'battery_readings', column: 'date', unit: 'date' },
  { table: 'intake_events', column: 'timestamp', unit: 'ms' },
  { table: 'daily_log', column: 'date', unit: 'date' },
  { table: 'activity_log', column: 'timestamp', unit: 'ms', keepIf: { archive: 'gym', where: "workouts != '[]'" } },
  {
    table: 'health_signals',
    column: 'timestamp',
    unit: 'ms',
    keepIf: { archive: 'weight', where: "source = 'manual' AND type = 'weight_kg'" },
  },
  { table: 'training_log_days', column: 'date', unit: 'date', archive: 'gym' },
  { table: 'training_log_weeks', column: 'week_start', unit: 'date', archive: 'gym' },
  { table: 'training_log_months', column: 'month_key', unit: 'month', archive: 'gym' },
  { table: 'lift_maxes', column: 'date', unit: 'date', archive: 'gym' },
  { table: 'training_blocks', column: 'created_at', unit: 'ms', archive: 'gym', onlyWhere: 'is_active = 0' },
  { table: 'eating_daily_summary', column: 'date', unit: 'date', archive: 'eatingHabits' },
];

export const RETENTION_TABLE_NAMES = RETENTION_TABLES.map((t) => t.table);

export type ArchiveFlags = Record<ArchiveKind, boolean>;

function cutoffValue(unit: DateUnit, cutoff: string): string | number {
  if (unit === 'ms') return new Date(cutoff + 'T00:00:00').getTime();
  if (unit === 'month') return cutoff.slice(0, 7);
  return cutoff;
}

function toDateString(unit: DateUnit, value: string | number): string {
  if (unit === 'ms') return dateString(new Date(Number(value)));
  if (unit === 'month') return `${value}-01`;
  return String(value);
}

// WHERE clause for the rows the cycle may remove (before `cutoff` when given).
// null = the whole table is in the Kho.
function trimmableWhere(spec: RetentionTable, archive: ArchiveFlags | null, withCutoff: boolean): string | null {
  if (archive && spec.archive && archive[spec.archive]) return null;
  const parts: string[] = [];
  if (withCutoff) parts.push(`${spec.column} < ?`);
  if (spec.onlyWhere) parts.push(spec.onlyWhere);
  if (archive && spec.keepIf && archive[spec.keepIf.archive]) parts.push(`NOT (${spec.keepIf.where})`);
  return parts.length > 0 ? parts.join(' AND ') : '1 = 1';
}

// Oldest day the cycle could trim under these Kho choices — what the next
// trim date counts from. `archive` null = every row counts (the storage
// estimate's "days with data"). null = nothing at all.
export async function getOldestTrimmableDate(archive: ArchiveFlags | null): Promise<string | null> {
  const db = getDb();
  let oldest: string | null = null;
  for (const spec of RETENTION_TABLES) {
    const where = trimmableWhere(spec, archive, false);
    if (where == null) continue;
    const row = await db.getFirstAsync<{ v: string | number | null }>(
      `SELECT MIN(${spec.column}) AS v FROM ${spec.table} WHERE ${where}`
    );
    if (row?.v == null) continue;
    const date = toDateString(spec.unit, row.v);
    if (oldest == null || date < oldest) oldest = date;
  }
  return oldest;
}

// Every row the cycle would remove before `cutoff` — the content of the
// restorable backup file.
export async function getTrimmableRows(cutoff: string, archive: ArchiveFlags): Promise<Record<string, BackupRow[]>> {
  const db = getDb();
  const tables: Record<string, BackupRow[]> = {};
  for (const spec of RETENTION_TABLES) {
    const where = trimmableWhere(spec, archive, true);
    if (where == null) continue;
    const rows = await db.getAllAsync<BackupRow>(
      `SELECT * FROM ${spec.table} WHERE ${where}`,
      cutoffValue(spec.unit, cutoff)
    );
    if (rows.length > 0) tables[spec.table] = rows;
  }
  return tables;
}

// Removes exactly what getTrimmableRows returned, in one transaction.
export async function deleteTrimmableRows(cutoff: string, archive: ArchiveFlags): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const spec of RETENTION_TABLES) {
      const where = trimmableWhere(spec, archive, true);
      if (where == null) continue;
      await db.runAsync(`DELETE FROM ${spec.table} WHERE ${where}`, cutoffValue(spec.unit, cutoff));
    }
  });
}

// Puts backed-up rows back. Only known tables, only columns this install has
// (an older file may lack newer columns), and never over an existing row.
// Returns how many rows were actually added.
export async function restoreRows(tables: Record<string, BackupRow[]>): Promise<number> {
  const db = getDb();
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const [table, rows] of Object.entries(tables)) {
      if (!RETENTION_TABLE_NAMES.includes(table) || rows.length === 0) continue;
      const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const known = new Set(info.map((c) => c.name));
      for (const row of rows) {
        const columns = Object.keys(row).filter((c) => known.has(c));
        if (columns.length === 0) continue;
        const result = await db.runAsync(
          `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map((c) => row[c])
        );
        added += result.changes;
      }
    }
  });
  return added;
}

export async function upsertEatingSummaries(days: EatingDaySummary[]): Promise<void> {
  if (days.length === 0) return;
  const db = getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const d of days) {
      await db.runAsync(
        `INSERT OR REPLACE INTO eating_daily_summary
           (date, kcal, protein_g, carb_g, fat_g, food_count, meal_count, category_kcal, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.date,
        d.kcal,
        d.proteinG,
        d.carbG,
        d.fatG,
        d.foodCount,
        d.mealCount,
        JSON.stringify(d.categoryKcal),
        now
      );
    }
  });
}

// Size of the main database file (the WAL side file is not counted).
export async function getDatabaseSizeBytes(): Promise<number> {
  const db = getDb();
  const count = await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count');
  const size = await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
  return (count?.page_count ?? 0) * (size?.page_size ?? 0);
}

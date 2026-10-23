// Pure serialize/parse for the restorable data backup the retention cycle
// writes next to its Excel file before anything is trimmed (Settings → Dữ
// liệu → Khôi phục). The Excel copy is for reading; this one carries the raw
// SQLite rows so the same data can be put back into the app — on this phone
// or a new one. No I/O here: services/retention/ owns the files and the DB.

export const DATA_BACKUP_FORMAT = 'bodybatteries-data-backup';
// Bumped only on a BREAKING shape change; a newer file is rejected, not guessed.
export const DATA_BACKUP_VERSION = 1;

export type BackupCell = string | number | null;
export type BackupRow = Record<string, BackupCell>;

export interface DataBackup {
  format: typeof DATA_BACKUP_FORMAT;
  version: number;
  exportedAt: number; // unix ms
  fromDate: string; // YYYY-MM-DD, first day the file covers
  toDate: string; // last day the file covers
  // table name → its rows, column names as in SQLite.
  tables: Record<string, BackupRow[]>;
}

export interface ParsedDataBackup {
  ok: true;
  backup: DataBackup;
}
export interface RejectedDataBackup {
  ok: false;
  // A key under `dataRetention.restore.reasons.*`, rendered by the caller.
  reasonKey: 'unreadable' | 'notBackup' | 'newerVersion';
}

export function serializeDataBackup(
  tables: Record<string, BackupRow[]>,
  range: { fromDate: string; toDate: string },
  exportedAt: number
): string {
  const backup: DataBackup = {
    format: DATA_BACKUP_FORMAT,
    version: DATA_BACKUP_VERSION,
    exportedAt,
    fromDate: range.fromDate,
    toDate: range.toDate,
    tables,
  };
  return JSON.stringify(backup);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanRow(raw: unknown): BackupRow | null {
  if (!isRecord(raw)) return null;
  const row: BackupRow = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value === 'string' || (typeof value === 'number' && isFinite(value))) {
      row[key] = value;
    }
  }
  return row;
}

export function countBackupRows(backup: Pick<DataBackup, 'tables'>): number {
  return Object.values(backup.tables).reduce((n, rows) => n + rows.length, 0);
}

export function parseDataBackup(text: string): ParsedDataBackup | RejectedDataBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reasonKey: 'unreadable' };
  }
  if (!isRecord(raw) || raw.format !== DATA_BACKUP_FORMAT || !isRecord(raw.tables)) {
    return { ok: false, reasonKey: 'notBackup' };
  }
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > DATA_BACKUP_VERSION) return { ok: false, reasonKey: 'newerVersion' };

  const tables: Record<string, BackupRow[]> = {};
  for (const [name, rows] of Object.entries(raw.tables)) {
    if (!Array.isArray(rows)) continue;
    tables[name] = rows.map(cleanRow).filter((r): r is BackupRow => r !== null);
  }
  return {
    ok: true,
    backup: {
      format: DATA_BACKUP_FORMAT,
      version,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      fromDate: typeof raw.fromDate === 'string' ? raw.fromDate : '',
      toDate: typeof raw.toDate === 'string' ? raw.toDate : '',
      tables,
    },
  };
}

export const CREATE_BATTERY_TYPES = `
  CREATE TABLE IF NOT EXISTS battery_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    default_capacity REAL NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
`;

export const CREATE_DAILY_LOG = `
  CREATE TABLE IF NOT EXISTS daily_log (
    date TEXT PRIMARY KEY,
    mode_id TEXT NOT NULL DEFAULT 'maintain'
  );
`;

export const CREATE_BATTERY_READINGS = `
  CREATE TABLE IF NOT EXISTS battery_readings (
    date TEXT NOT NULL,
    battery_type_id TEXT NOT NULL,
    level REAL NOT NULL DEFAULT 0,
    capacity REAL NOT NULL,
    PRIMARY KEY (date, battery_type_id)
  );
`;

export const CREATE_INTAKE_EVENTS = `
  CREATE TABLE IF NOT EXISTS intake_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    battery_type_id TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT DEFAULT ''
  );
`;

export const CREATE_HEALTH_SIGNALS = `
  CREATE TABLE IF NOT EXISTS health_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL
  );
`;

export const CREATE_DIARY_ENTRIES = `
  CREATE TABLE IF NOT EXISTS diary_entries (
    date TEXT PRIMARY KEY,
    encrypted_content TEXT NOT NULL
  );
`;

export const ALL_SCHEMAS = [
  CREATE_BATTERY_TYPES,
  CREATE_DAILY_LOG,
  CREATE_BATTERY_READINGS,
  CREATE_INTAKE_EVENTS,
  CREATE_HEALTH_SIGNALS,
  CREATE_DIARY_ENTRIES,
];

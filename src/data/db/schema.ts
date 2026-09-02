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
    activity_bonus_kcal REAL,
    satiety_reserve_kcal REAL,
    last_satiety_sync_at INTEGER,
    PRIMARY KEY (date, battery_type_id)
  );
`;

// Columns added after the first release (S-Q). Existing installs created the
// table without them, so initDatabase() ALTERs them in one by one if missing.
export const BATTERY_READINGS_MIGRATION_COLUMNS = [
  { name: 'activity_bonus_kcal', ddl: 'ALTER TABLE battery_readings ADD COLUMN activity_bonus_kcal REAL' },
  { name: 'satiety_reserve_kcal', ddl: 'ALTER TABLE battery_readings ADD COLUMN satiety_reserve_kcal REAL' },
  { name: 'last_satiety_sync_at', ddl: 'ALTER TABLE battery_readings ADD COLUMN last_satiety_sync_at INTEGER' },
];

// Columns added for pack/capsule (TPCN) portion support. Existing installs
// created these tables without them, so initDatabase() ALTERs them in one by
// one if missing — same pattern as BATTERY_READINGS_MIGRATION_COLUMNS above.
export const CUSTOM_FOODS_MIGRATION_COLUMNS = [
  { name: 'portion_unit', ddl: "ALTER TABLE custom_foods ADD COLUMN portion_unit TEXT" },
  { name: 'serving_weight_g', ddl: 'ALTER TABLE custom_foods ADD COLUMN serving_weight_g REAL' },
  // Free-text portion noun ('hộp', 'chai'…) + the g/ml the amounts are read
  // in — see types/food.ts PortionUnit 'serving' and MeasureUnit. NULL on
  // every row written before these existed, which maps back to
  // undefined/'g' (the original gram-only behaviour).
  { name: 'serving_label', ddl: 'ALTER TABLE custom_foods ADD COLUMN serving_label TEXT' },
  { name: 'measure_unit', ddl: 'ALTER TABLE custom_foods ADD COLUMN measure_unit TEXT' },
];

export const FOOD_OVERRIDES_MIGRATION_COLUMNS = [
  { name: 'portion_unit', ddl: "ALTER TABLE food_overrides ADD COLUMN portion_unit TEXT" },
  { name: 'serving_weight_g', ddl: 'ALTER TABLE food_overrides ADD COLUMN serving_weight_g REAL' },
  { name: 'serving_label', ddl: 'ALTER TABLE food_overrides ADD COLUMN serving_label TEXT' },
  { name: 'measure_unit', ddl: 'ALTER TABLE food_overrides ADD COLUMN measure_unit TEXT' },
];

export const FOOD_LOG_MIGRATION_COLUMNS = [
  { name: 'portion_unit', ddl: "ALTER TABLE food_log ADD COLUMN portion_unit TEXT" },
  { name: 'count', ddl: 'ALTER TABLE food_log ADD COLUMN count REAL' },
  // FIX #1: the 6am-reset energy day the food's kcal charge landed on, so
  // removeFood can reverse it on the right day. Old rows have no value and are
  // treated as same-day. Same ALTER-if-missing pattern as above.
  { name: 'energy_day_applied', ddl: 'ALTER TABLE food_log ADD COLUMN energy_day_applied TEXT' },
];

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

// Rich per-meal food log: one row per food eaten, with the portion's computed
// nutrition snapshotted (so history stays correct if the CSV later changes).
export const CREATE_FOOD_LOG = `
  CREATE TABLE IF NOT EXISTS food_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    meal_type TEXT NOT NULL,
    food_id TEXT NOT NULL,
    food_name_vi TEXT NOT NULL,
    grams REAL NOT NULL,
    energy_kcal REAL NOT NULL,
    protein_g REAL NOT NULL,
    fat_g REAL NOT NULL,
    carb_g REAL NOT NULL,
    water_g REAL NOT NULL DEFAULT 0,
    minerals_mg REAL NOT NULL DEFAULT 0,
    portion_unit TEXT,
    count REAL,
    energy_day_applied TEXT
  );
`;

// User-added foods that aren't in the build-time-generated catalog
// (foodDatabase.generated.ts / usdaFoods.generated.ts). One row per food,
// per-100g nutrition mirroring the `Nutrition` type. See
// src/data/repositories/customFoodsRepository.ts for the row<->FoodItem
// mapping and src/data/food/customFoodRegistry.ts for the runtime search
// index that makes these searchable without an app reload.
export const CREATE_CUSTOM_FOODS = `
  CREATE TABLE IF NOT EXISTS custom_foods (
    id TEXT PRIMARY KEY,
    name_vi TEXT,
    name_en TEXT,
    category TEXT,
    default_serving_g REAL,
    energy_kcal REAL,
    water_g REAL,
    protein_g REAL,
    fat_g REAL,
    carb_g REAL,
    fiber_g REAL,
    sugar_g REAL,
    calcium_mg REAL,
    iron_mg REAL,
    sodium_mg REAL,
    potassium_mg REAL,
    magnesium_mg REAL,
    zinc_mg REAL,
    epa_mg REAL,
    dha_mg REAL,
    portion_unit TEXT,
    serving_weight_g REAL,
    serving_label TEXT,
    measure_unit TEXT,
    created_at INTEGER
  );
`;

// User edits to a food's nutrition that SHADOW the build-time-generated
// catalog (foodDatabase.generated.ts / usdaFoods.generated.ts) or a custom
// food, WITHOUT modifying those generated files. One row per overridden food,
// keyed by the id of the food being corrected (food_id). Per-100g nutrition
// mirroring the `Nutrition` type. At lookup time getAnyFoodById() merges an
// override on top of the base food so the user's corrected values win. See
// src/data/repositories/foodOverrideMapper.ts for the row<->FoodItem mapping
// and src/data/food/foodOverrideRegistry.ts for the runtime sync registry.
export const CREATE_FOOD_OVERRIDES = `
  CREATE TABLE IF NOT EXISTS food_overrides (
    food_id TEXT PRIMARY KEY,
    name_vi TEXT,
    name_en TEXT,
    category TEXT,
    default_serving_g REAL,
    energy_kcal REAL,
    water_g REAL,
    protein_g REAL,
    fat_g REAL,
    carb_g REAL,
    fiber_g REAL,
    sugar_g REAL,
    calcium_mg REAL,
    iron_mg REAL,
    sodium_mg REAL,
    potassium_mg REAL,
    magnesium_mg REAL,
    zinc_mg REAL,
    epa_mg REAL,
    dha_mg REAL,
    portion_unit TEXT,
    serving_weight_g REAL,
    serving_label TEXT,
    measure_unit TEXT,
    updated_at INTEGER
  );
`;

// Independent per-event "Vận động" (activity) log — one row per logged event
// (steps and/or workout sessions), so it can be individually edited/undone
// (B2), unlike the old fire-and-forget intake_events write. `start_at`/
// `end_at` are the optional real-world time window the activity happened in
// (display-only — see types/energy.ts ActivityLogEntry doc). `energy_kcal`/
// `satiety_drain_kcal` snapshot the battery effect already applied at log
// time, so removeActivity can undo it exactly without recomputing.
export const CREATE_ACTIVITY_LOG = `
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    start_at INTEGER,
    end_at INTEGER,
    steps REAL NOT NULL DEFAULT 0,
    workouts TEXT NOT NULL DEFAULT '[]',
    energy_kcal REAL NOT NULL DEFAULT 0,
    satiety_drain_kcal REAL NOT NULL DEFAULT 0,
    energy_day_applied TEXT
  );
`;

// Column added for FIX #5 (energy-day vs calendar-day mismatch for activity
// logged 0h-6am). Existing installs created activity_log without it, so
// initDatabase() ALTERs it in if missing — same pattern as the other
// *_MIGRATION_COLUMNS above.
export const ACTIVITY_LOG_MIGRATION_COLUMNS = [
  { name: 'energy_day_applied', ddl: 'ALTER TABLE activity_log ADD COLUMN energy_day_applied TEXT' },
  // BUG A: snapshot of exactly how much the movement pin was charged at log
  // time (steps + workout step-equivalents) — see types/energy.ts
  // ActivityLogEntry.movementStepsApplied doc. Rows written before this
  // migration have NULL here; consumers fall back to `steps`.
  { name: 'movement_steps_applied', ddl: 'ALTER TABLE activity_log ADD COLUMN movement_steps_applied REAL' },
];

// S-PL Block Builder (docs/08-powerlifting-engine.md): one row per training
// block. `config`/`weeks` are JSON blobs (TrainingBlockConfig /
// BlockWeekPlan[], src/types/powerliftingBlock.ts) — same "whole-object JSON
// column" convention as activity_log.workouts, chosen because a block is
// always read/written as a whole for the Plan Appendix screen, never queried
// per-day at the SQL level. The handful of top-level columns exist only so a
// block list screen can query/sort without parsing every blob.
export const CREATE_TRAINING_BLOCKS = `
  CREATE TABLE IF NOT EXISTS training_blocks (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    progressive_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 1,
    focus TEXT NOT NULL,
    body_weight_kg REAL NOT NULL,
    deficit_mode_enabled INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL,
    weeks TEXT NOT NULL
  );
`;

export const ALL_SCHEMAS = [
  CREATE_BATTERY_TYPES,
  CREATE_DAILY_LOG,
  CREATE_BATTERY_READINGS,
  CREATE_INTAKE_EVENTS,
  CREATE_HEALTH_SIGNALS,
  CREATE_DIARY_ENTRIES,
  CREATE_FOOD_LOG,
  CREATE_CUSTOM_FOODS,
  CREATE_FOOD_OVERRIDES,
  CREATE_ACTIVITY_LOG,
  CREATE_TRAINING_BLOCKS,
];

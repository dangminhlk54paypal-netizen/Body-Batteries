# Skill: sqlite-expo-patterns

## Khi nào dùng skill này?
Kích hoạt khi:
- Thêm bảng mới vào database
- Viết query mới
- Làm migration schema
- Debug lỗi database
- Tích hợp dữ liệu mới (cân nặng, steps, sleep...)

---

## 🗄️ Schema Hiện Tại (2026-06-18)

### Các bảng chính

```sql
-- Nguồn năng lượng / pin
CREATE TABLE battery_state (
  id INTEGER PRIMARY KEY,
  battery_type TEXT NOT NULL,   -- 'protein', 'carbs', 'water', 'minerals', 'sleep', 'exercise', 'energy'
  current_level REAL NOT NULL,  -- 0.0 → 1.0 (%)
  capacity REAL NOT NULL,       -- gram hoặc đơn vị tuỳ loại
  updated_at TEXT NOT NULL      -- ISO timestamp
);

-- Lịch sử nạp (intake log)
CREATE TABLE intake_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  battery_type TEXT NOT NULL,
  amount REAL NOT NULL,
  unit TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  food_item_id INTEGER,         -- FK → food_items (nullable)
  meal_type TEXT                -- 'breakfast', 'lunch', 'dinner', 'snack'
);

-- Food items (từ food_items.csv)
CREATE TABLE food_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  protein_per_100g REAL,
  carbs_per_100g REAL,
  calories_per_100g REAL,
  category TEXT
);

-- Nhật ký riêng tư (mã hoá)
CREATE TABLE diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  encrypted_content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Cân nặng theo thời gian (S-L)
CREATE TABLE weight_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg REAL NOT NULL,
  logged_at TEXT NOT NULL
);

-- Settings người dùng
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 🔧 Pattern Khởi Tạo DB Chuẩn

```typescript
// src/data/db/database.ts
import * as SQLite from 'expo-sqlite/legacy'; // Dùng legacy API

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabase('bodybatteries.db');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: SQLite.SQLiteDatabase): void {
  db.transaction((tx) => {
    // Bật WAL mode — LUÔN làm đầu tiên
    tx.executeSql('PRAGMA journal_mode = WAL;');
    
    // Tạo bảng nếu chưa có
    tx.executeSql(`CREATE TABLE IF NOT EXISTS ...`);
  });
}
```

---

## 📝 Pattern Query Chuẩn

### SELECT
```typescript
export function getBatteryState(batteryType: string): Promise<BatteryState | null> {
  return new Promise((resolve, reject) => {
    getDatabase().transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM battery_state WHERE battery_type = ?',
        [batteryType],
        (_, result) => {
          if (result.rows.length > 0) {
            resolve(result.rows.item(0) as BatteryState);
          } else {
            resolve(null);
          }
        },
        (_, error) => { reject(error); return false; }
      );
    });
  });
}
```

### INSERT / UPDATE
```typescript
export function upsertBatteryState(
  batteryType: string,
  level: number,
  capacity: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    getDatabase().transaction((tx) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO battery_state 
         (battery_type, current_level, capacity, updated_at) 
         VALUES (?, ?, ?, ?)`,
        [batteryType, level, capacity, new Date().toISOString()],
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
}
```

---

## 🔄 Migration Pattern (Thêm Bảng Mới)

**Nguyên tắc:** KHÔNG DROP bảng cũ. Chỉ thêm, không xoá.

```typescript
// Kiểm tra version schema
const SCHEMA_VERSION = 3; // tăng mỗi lần migrate

function runMigrations(db: SQLite.SQLiteDatabase): void {
  db.transaction((tx) => {
    // Lấy version hiện tại
    tx.executeSql(
      "SELECT value FROM settings WHERE key = 'schema_version'",
      [],
      (_, result) => {
        const currentVersion = result.rows.length > 0 
          ? parseInt(result.rows.item(0).value) 
          : 0;
        
        // Chạy migrations tuần tự
        if (currentVersion < 2) migrate_v2(tx);
        if (currentVersion < 3) migrate_v3(tx);
        
        // Lưu version mới
        tx.executeSql(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)",
          [SCHEMA_VERSION.toString()]
        );
      }
    );
  });
}

function migrate_v2(tx: SQLite.SQLiteTransactionCallback): void {
  // Ví dụ: thêm cột mới
  tx.executeSql('ALTER TABLE intake_log ADD COLUMN meal_type TEXT');
}

function migrate_v3(tx: SQLite.SQLiteTransactionCallback): void {
  // Ví dụ: thêm bảng cân nặng
  tx.executeSql(`
    CREATE TABLE IF NOT EXISTS weight_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      logged_at TEXT NOT NULL
    )
  `);
}
```

---

## 🗑️ Pattern Dọn Dẹp 7 Ngày

```typescript
// cleanupService.ts — xoá data > 7 ngày
export async function cleanupOldData(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();
  
  return new Promise((resolve, reject) => {
    getDatabase().transaction((tx) => {
      tx.executeSql(
        'DELETE FROM intake_log WHERE logged_at < ?',
        [cutoff]
      );
      // KHÔNG xoá diary (write-only, user owns it)
      // KHÔNG xoá weight_log (long-term trend)
    }, reject, resolve);
  });
}
```

---

## ⚠️ Gotchas Thường Gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `db.transaction is not a function` | Dùng main expo-sqlite entry | Chuyển sang `expo-sqlite/legacy` |
| Data không persist sau hot reload | WAL chưa được flush | Luôn bật WAL khi init |
| Migration lỗi "column already exists" | Chạy migration 2 lần | Wrap trong `try/catch` hoặc kiểm tra trước |
| `SQLITE_CONSTRAINT` | Unique constraint vi phạm | Dùng `INSERT OR REPLACE` hoặc `INSERT OR IGNORE` |

---

## 🔗 Tham khảo

- expo-sqlite legacy API: https://docs.expo.dev/versions/v54.0.0/sdk/sqlite-legacy/
- SQLite WAL mode: https://www.sqlite.org/wal.html
- File dữ liệu dự án: `src/data/db/` (schema, init, queries)

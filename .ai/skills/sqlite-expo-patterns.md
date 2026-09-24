# Skill: sqlite-expo-patterns

## Khi nào dùng skill này?
Kích hoạt khi:
- Thêm bảng mới vào database
- Viết query mới
- Làm migration schema
- Debug lỗi database
- Tích hợp dữ liệu mới (cân nặng, steps, sleep...)

> Cập nhật 2026-09-24 theo code thật (Expo SDK 57, `expo-sqlite` API async).
> `expo-sqlite/legacy` (`openDatabase`, `db.transaction(tx => tx.executeSql…)`) **đã bị xoá** —
> đừng chép mẫu code cũ trên mạng dùng API đó.

---

## 🗄️ Schema hiện tại

**Nguồn sự thật duy nhất: `src/data/db/schema.ts`** — đọc file đó để biết cột chính xác, đừng
dựa vào tài liệu (dễ lỗi thời). Danh sách bảng (theo `ALL_SCHEMAS`):

| Bảng | Dùng cho |
|------|----------|
| `battery_types` | Loại pin (seed từ `DEFAULT_BATTERIES`). Tên hiển thị lấy qua `batteryTypeName` (i18n), KHÔNG hiển thị cột `name` |
| `daily_log` | Nhật ký theo ngày |
| `battery_readings` | Mức pin theo ngày |
| `intake_events` | Sự kiện nạp |
| `health_signals` | Dữ liệu Apple Health (kcal đốt…) |
| `diary_entries` | Nhật ký riêng tư (mã hoá, khoá ở `expo-secure-store`) |
| `food_log` | Món đã ăn |
| `custom_foods` | "Món của tôi" |
| `food_overrides` | Chỉnh dinh dưỡng món catalog |
| `activity_log` | Hoạt động / buổi tập |
| `training_blocks` | S-PL Block Builder (cột `config`/`weeks` là JSON blob) |
| `training_log_days`, `training_log_weeks` | Sổ tập luyện |

Catalog món ăn KHÔNG nằm trong SQLite — là file sinh ra `src/data/food/foodDatabase.generated.ts`
(`npm run gen:food` từ `food_items.csv`) + dữ liệu USDA; tra cứu qua `src/data/food/foodLookup.ts`.

---

## 🔧 Pattern khởi tạo DB (đang dùng)

```typescript
// src/data/db/database.ts
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('body_batteries.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');   // LUÔN làm đầu tiên
  for (const sql of ALL_SCHEMAS) await _db.execAsync(sql); // CREATE TABLE IF NOT EXISTS
  await migrateColumns(_db, 'food_log', FOOD_LOG_MIGRATION_COLUMNS); // … mỗi bảng có cột mới
  await seedDefaultBatteries(_db);                     // INSERT OR IGNORE
}
```

---

## 📝 Pattern query (trong `src/data/repositories/*Repository.ts`)

```typescript
// SELECT nhiều dòng
const rows = await getDb().getAllAsync<BatteryReadingRow>(
  'SELECT * FROM battery_readings WHERE date >= ? AND date <= ? ORDER BY date ASC',
  fromDate,
  toDate
);
return rows.map(rowToReading);   // row (snake_case) → model (camelCase) qua mapper

// SELECT 1 dòng
const row = await getDb().getFirstAsync<Row>('SELECT * FROM x WHERE id = ?', id); // null nếu không có

// INSERT / UPDATE
await getDb().runAsync(UPSERT_SQL, ...upsertParams(reading));

// Nhiều lệnh ghi liền nhau → 1 transaction
const db = getDb();
await db.withTransactionAsync(async () => {
  for (const r of readings) await db.runAsync(UPSERT_SQL, ...upsertParams(r));
});
```

Quy tắc: SQL chỉ nằm trong `src/data/`. Domain (`src/domain/`) là hàm thuần, không import DB.

---

## 🔄 Migration pattern

**Nguyên tắc:** KHÔNG DROP bảng/cột cũ — dữ liệu người dùng nằm trên điện thoại, mất là mất hẳn.
Dự án **không** dùng số version schema; dùng 2 cơ chế:

1. **Bảng mới:** thêm hằng `CREATE_<TÊN>` (`CREATE TABLE IF NOT EXISTS …`) trong `schema.ts`
   và thêm vào `ALL_SCHEMAS`.
2. **Cột mới cho bảng đã có:** `CREATE TABLE IF NOT EXISTS` không sửa bảng cũ trên máy đã cài,
   nên thêm cột vào câu CREATE (cho máy mới) **và** vào mảng `<BẢNG>_MIGRATION_COLUMNS`:
   ```typescript
   export const FOOD_LOG_MIGRATION_COLUMNS = [
     { name: 'portion_unit', ddl: 'ALTER TABLE food_log ADD COLUMN portion_unit TEXT' },
   ];
   ```
   `migrateColumns()` đọc `PRAGMA table_info(<bảng>)` và chỉ `ALTER` cột còn thiếu → chạy lại
   bao nhiêu lần cũng an toàn. Bảng mới có mảng migration thì gọi thêm `migrateColumns` trong
   `initDatabase()`.
3. Cột mới phải cho phép NULL (hoặc có DEFAULT) — dòng cũ sẽ không có giá trị; mapper phải xử lý.

⚠️ Thêm field cho `FoodItem`: xem thêm các điểm nối bắt buộc (merge trong `getAnyFoodById`,
nhánh sửa trong `FoodNutritionEditModal`, mapper/schema/migration) — thiếu 1 chỗ là âm thầm hỏng dữ liệu.

---

## 🧪 Test

Repository/store dùng DB được test bằng mock `getDb()` (xem
`src/store/__tests__/energyStore.backfill.test.ts`: mock `getAllAsync`, `runAsync`,
`withTransactionAsync: jest.fn(async (cb) => cb())`). Logic nên đẩy xuống domain thuần để test không cần DB.

---

## ⚠️ Gotchas thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `db.transaction is not a function` / `openDatabase is not a function` | Chép mẫu API legacy (đã bị xoá) | Dùng `openDatabaseAsync` + `withTransactionAsync` |
| `Database not initialized` | Gọi repository trước khi `initDatabase()` xong | Đợi init ở App trước khi render màn hình dùng DB |
| "no such column" trên máy thật dù test xanh | Thêm cột vào CREATE nhưng quên `*_MIGRATION_COLUMNS` | Thêm vào mảng migration (máy cũ đã có bảng) |
| Migration lỗi "duplicate column name" | ALTER chạy không kiểm tra | Luôn đi qua `migrateColumns` (kiểm tra `PRAGMA table_info`) |
| `SQLITE_CONSTRAINT` | Vi phạm unique constraint | `INSERT OR REPLACE` / `INSERT OR IGNORE` / `ON CONFLICT … DO UPDATE` |

---

## 🔗 Tham khảo

- expo-sqlite SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- SQLite WAL mode: https://www.sqlite.org/wal.html
- Code dự án: `src/data/db/` (schema, init), `src/data/repositories/` (query)

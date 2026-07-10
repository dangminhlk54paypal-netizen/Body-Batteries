# S-S · SPEC — "Cập nhật lịch sử" (backfill): ghi món ăn cho ngày đã qua

> Soạn: 2026-07-10 (Fable — phiên thiết kế). Trạng thái: **đề xuất, chưa code**.
> Đây là spec đầy đủ cho cụm gói S-S1…S-S6 trong `.ai/NEXT_SESSIONS.md`.

## 1. Bài toán (lời người dùng)

"Những ngày tôi quên không vào app để ghi lại quá trình ăn uống, tôi vẫn muốn dùng
sức mạnh tính toán của app để lưu lại — để tiện quan sát, không để ăn uống mất kiểm soát."

→ Tính năng: **ghi lùi (backfill)** món ăn cho một ngày đã qua, để Lịch sử / biểu đồ /
Excel export đầy đủ, không bị "lỗ hổng" những ngày quên mở app.

## 2. Hiện trạng kỹ thuật (đọc trước khi code)

- `energyStore.logFood(item, grams, timestamp)` **nạp thẳng vào `readings` đang load
  trong store** (= pin của HÔM NAY). Dùng nó cho ngày quá khứ sẽ **làm hỏng pin hôm nay**.
  → Không được tái dùng trực tiếp; phải có đường đi riêng.
- Pattern "ngày lịch sử" ĐÃ TỒN TẠI ở chiều ngược lại: `removeFood`/`removeActivity`
  (energyStore.ts) khi `entry.energyDayApplied !== energyDayString()` sẽ
  `getReadingsForDate(ngày cũ)` → đảo charge bằng hàm thuần
  (`reverseFoodOnEnergyReading`) → `upsertReadings` riêng, **không đụng `readings`
  trong store**. Backfill chính là **chiều xuôi** của pattern này.
- Ngày dữ liệu có 2 loại khóa (xem `src/lib/dateUtils.ts`):
  - **Ngày lịch (calendar day, `dateString`)** — khóa pin vi chất (protein/carbs/
    water/minerals/…), food_log, History, export.
  - **Ngày năng lượng (energy day, `energyDayString`, reset 6h sáng)** — CHỈ khóa sổ
    calo (pin `energy`). Món ăn lúc 0h–6h thuộc sổ calo của NGÀY HÔM TRƯỚC.
- `food_log` khóa theo `timestamp` (ms) → `getFoodLogForDate(date)` lọc theo khoảng
  ms của ngày đó. Ghi entry với timestamp quá khứ là đủ để nó "thuộc" ngày đó.
- Cột `energy_day_applied` đã có (FIX #1) — snapshot ngày-năng-lượng đã nhận kcal,
  để undo đảo đúng ngày.
- Dọn dẹp: `DATA_RETENTION_DAYS = 35` (constants.ts) — dữ liệu cũ hơn bị xoá
  (cleanupService). → **Không cho backfill xa hơn 35 ngày** (ghi xong cũng sắp bị xoá).
- Pin no/đói (`satietyReserveKcal`) là đại lượng **liên tục theo thời gian thực**
  (S-O/S-Q): bữa ăn quá khứ đã "tiêu hoá xong" → backfill **TUYỆT ĐỐI không đụng**
  `satietyReserveKcal` / `lastSatietySyncAt`, kể cả trên row lịch sử.

## 3. Thiết kế

### 3a. Luồng người dùng (2 lối vào)

1. **Từ tab Lịch sử** (lối chính): chạm vào 1 thẻ ngày → mở **DayDetailSheet**
   (bottom sheet) hiện danh sách món đã ghi của ngày đó (nhóm theo bữa, tổng kcal),
   nút **"+ Thêm món cho ngày này"** → mở FoodLogModal đã ghim sẵn ngày đó,
   và nút xoá từng món (undo lịch sử).
2. **Từ FoodLogModal** (lối phụ): thêm hàng chọn ngày **PastDateField** cạnh ô
   giờ:phút hiện có — mặc định "Hôm nay", chip nhanh "Hôm qua", "2 ngày trước",
   + ô nhập `dd/mm`. Khi chọn ngày ≠ hôm nay, modal hiện rõ dòng cảnh
   "🕓 Ghi cho ngày <thứ, dd/mm>" để không ghi nhầm.

### 3b. Ngữ nghĩa dữ liệu (quyết định thiết kế)

Khi backfill món X (grams) vào ngày D, timestamp T (giờ do người dùng chọn, mặc
định 12:00 nếu bỏ trống):

| Thứ | Việc | Ghi chú |
|---|---|---|
| 1 | Validate D | không tương lai, không xa hơn `DATA_RETENTION_DAYS`; D = hôm nay → uỷ quyền `logFood` thường |
| 2 | Pin vi chất của ngày lịch D | `getReadingsForDate(D)`; nếu chưa có (ngày quên mở app) → **tạo mới** bằng `createDailyReading(D, …, mode)` với mode lấy từ `daily_logs` của D, fallback mode hiện tại; rồi nạp protein/carb/water/minerals như logFood |
| 3 | Sổ calo của ngày-năng-lượng E = `energyDayString(new Date(T))` | nếu chưa có row `energy` của E → tạo bằng `createEnergyReading(E, profile)` + `dailyCalorieTarget` (profile HIỆN TẠI — chấp nhận sai số, app là ước tính); rồi `chargeEnergy` kcal. **KHÔNG** đụng satietyReserveKcal |
| 4 | `daily_logs` | `upsertDailyLog({ date: D, modeId })` để History hiện ngày đó |
| 5 | `food_log` | `addFoodLogEntry` với timestamp T, `energyDayApplied = E` (id theo scheme sẵn `food_${T}_${item.id}`) |
| 6 | Store trong RAM | **KHÔNG đổi `readings`/`foodLog`/`masterPercentage`** — trừ trường hợp chồng ngày ở 3c |

**Bất biến quan trọng nhất:** backfill cho ngày quá khứ **không được làm thay đổi
bất kỳ con số nào của hôm nay** (store readings, satiety, master %).

### 3c. Cạnh khó: chồng ngày lúc 0h–6h (PHẢI có test)

Ví dụ bây giờ là 2h sáng ngày 11/07 → energy-day hiện tại = **10/07**. Người dùng
backfill món cho 10/07 lúc 23:00:
- Ngày lịch của entry = 10/07 = quá khứ → vi chất nạp vào **row lịch sử** 10/07.
- Ngày-năng-lượng của entry = 10/07 = **energy-day ĐANG load trong store** → kcal
  phải nạp vào reading `energy` **trong store** (rồi persist), không phải row DB rời —
  nếu không, con số "đã ăn hôm nay" trên Home sẽ sai.

→ Quy tắc tổng quát (mirror đúng logic `removeFood` FIX #1): với TỪNG đích
(vi-chất-theo-ngày-lịch, calo-theo-energy-day), so ngày đích với ngày đang load
trong store; **trùng → áp vào store + persist, khác → áp vào row DB rời**.

Tương tự cho chiều xoá (`removeFoodForPastDate`).

### 3d. API mới (hợp đồng giữa các gói — CHỐT trước, các phiên code theo đúng chữ ký)

**Domain thuần — TẠO `src/domain/food/backfillEngine.ts`** (gói S-S1):

```ts
export type BackfillDateError = 'future' | 'too-old' | 'invalid';
// today/dateStr dạng YYYY-MM-DD; maxDays mặc định DATA_RETENTION_DAYS
export function validateBackfillDate(dateStr: string, today: string, maxDays?: number):
  { ok: true } | { ok: false; reason: BackfillDateError };

// Nạp dinh dưỡng 1 món vào bộ readings của MỘT ngày (thuần, không side-effect).
// KHÔNG đụng satietyReserveKcal/lastSatietySyncAt (xem spec mục 2).
export function applyFoodToDayReadings(
  readings: BatteryReading[], n: FoodNutrition /* kết quả nutritionForGrams */
): BatteryReading[];

// Chiều đảo chính xác của applyFoodToDayReadings (round-trip trong test).
export function reverseFoodOnDayReadings(
  readings: BatteryReading[], entry: FoodLogEntry
): BatteryReading[];

// Dựng bộ readings tươi cho ngày quên mở app: vi chất theo calendarDate + mode,
// energy theo energyDay + profile (capacity = dailyCalorieTarget). satietyReserve = giữ nguyên/không set.
export function buildReadingsForMissedDay(
  calendarDate: string, energyDay: string, profile: UserProfile, mode: Mode
): { nutrients: BatteryReading[]; energy: BatteryReading };
```

**Store — SỬA `src/store/energyStore.ts`** (gói S-S4, MỘT MÌNH):

```ts
logFoodForPastDate: (item: FoodItem, grams: number, timestamp: number,
  portion?: { portionUnit?: PortionUnit; count?: number }) => Promise<void>;
// entry lấy từ getFoodLogForDate(D) — không nằm trong store.foodLog
removeFoodForPastDate: (entry: FoodLogEntry) => Promise<void>;
```

- `logFoodForPastDate` với timestamp thuộc HÔM NAY (cả ngày lịch lẫn energy-day) →
  gọi thẳng `get().logFood(...)` rồi return (một đường nạp duy nhất, không trùng code).
- Xử lý chồng ngày theo 3c.

**UI components (props-driven, KHÔNG import store/DB)** — gói S-S2/S-S3:

```ts
// src/components/food/PastDateField.tsx  (S-S2)
interface PastDateFieldProps {
  value: string;                    // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDaysBack: number;              // truyền DATA_RETENTION_DAYS từ ngoài vào
}

// src/components/DayDetailSheet.tsx  (S-S3)
interface DayDetailSheetProps {
  visible: boolean;
  date: string;                     // YYYY-MM-DD
  entries: FoodLogEntry[];          // caller tự fetch getFoodLogForDate
  loading?: boolean;
  onClose: () => void;
  onAddFood: () => void;            // caller mở FoodLogModal ghim ngày
  onDeleteEntry: (entry: FoodLogEntry) => void; // caller gọi removeFoodForPastDate
}
```

### 3e. Ngoài phạm vi (đừng làm trong đợt này)

- Backfill **hoạt động/bước chân** cho ngày cũ (chỉ món ăn trước; activity để gói sau
  nếu người dùng cần).
- Sửa (edit) món của ngày cũ — v1 chỉ **thêm + xoá** (xoá rồi thêm lại = sửa).
- Badge "(bổ sung)" trên History / cột `backfilled` trong schema — nice-to-have P2,
  cần migration, không đáng độ phức tạp v1.
- Không notification, không thay đổi cleanup/export (export đọc food_log theo ngày
  nên tự nhiên có dữ liệu backfill — kiểm tra lại trong QA là đủ).

## 4. Bất biến & test bắt buộc (tiêu chí "xong")

Jest (S-S1 + S-S4):
1. **Hôm nay bất khả xâm phạm:** sau `logFoodForPastDate(D quá khứ)`, mọi reading
   trong store (level/capacity/satietyReserveKcal) và `masterPercentage` **giữ nguyên
   từng số**.
2. **Round-trip:** `applyFoodToDayReadings` rồi `reverseFoodOnDayReadings` (cùng entry)
   → trả về đúng level ban đầu (trong sai số clamp, như removeFood hiện tại).
3. **Ngày quên mở app:** `buildReadingsForMissedDay` cho capacity vi chất đúng theo
   mode và capacity energy = `dailyCalorieTarget(profile).targetKcal`.
4. **Chồng ngày 0h–6h (3c):** mock "bây giờ = 2h sáng", backfill 23:00 hôm trước →
   kcal vào reading energy đang load, vi chất vào row lịch sử.
5. **Validate:** ngày mai → `future`; hôm nay − 36 ngày → `too-old`; chuỗi rác → `invalid`.
6. **Satiety:** row energy lịch sử sau backfill có `satietyReserveKcal` y nguyên như trước.

Kiểm thử tay (S-S6 viết checklist tiếng Việt), tối thiểu:
- Lịch sử → chạm ngày hôm qua → thêm 1 món → thẻ ngày & TrendChart đổi %; Home hôm nay KHÔNG đổi.
- Backfill vào ngày trống (3 ngày trước, chưa từng mở app) → ngày xuất hiện trong Lịch sử.
- Xoá món vừa backfill → % ngày đó quay về như cũ.
- FoodLogModal chọn "Hôm qua" → dòng "Ghi cho ngày…" hiện rõ; ghi xong mở Lịch sử thấy món.
- Excel export tuần có dòng của món backfill đúng ngày.

## 5. Phân rã gói song song (chi tiết ở `.ai/NEXT_SESSIONS.md` mục S-S)

| Gói | Việc | Model đề xuất | Agent | Đợt |
|---|---|---|---|---|
| S-S1 | backfillEngine thuần + test | **Sonnet** | logic-backend | 1 (song song) |
| S-S2 | PastDateField (component rời) | **Haiku** | mobile-frontend | 1 (song song) |
| S-S3 | DayDetailSheet (component rời) | **Haiku** | mobile-frontend | 1 (song song) |
| S-S4 | energyStore: logFoodForPastDate/removeFoodForPastDate + test | **Sonnet** | logic-backend | 2 (MỘT MÌNH) |
| S-S5 | Nối UI: FoodLogModal + HistoryScreen | **Sonnet** | mobile-frontend | 3 (MỘT MÌNH) |
| S-S6 | QA review + checklist test máy | Sonnet (hoặc Haiku nếu chỉ checklist) | qa-reviewer | 4 |

Đợt 1 an toàn song song vì 3 gói **chỉ TẠO file mới**, không sửa file chung nào.
S-S4/S-S5 đụng file lõi dùng chung (`energyStore.ts`, `FoodLogModal.tsx`,
`HistoryScreen.tsx`) nên bắt buộc chạy đơn, sau khi đợt trước đã **commit**.

⚠️ **Trước đợt 1:** branch `ui-upgrade` đang có thay đổi CHƯA COMMIT (trong đó có
`FoodLogModal.tsx`). Commit/đẩy xong xuôi rồi mới mở các phiên S-S, kẻo phiên song
song đè mất (xem bài học `.ai` về parallel-subagent-file-conflicts).

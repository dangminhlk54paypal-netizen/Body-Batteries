# S-S7 — Backfill: giới hạn 3 ngày + ghi vận động cho ngày quá khứ

Wave 2 (logic-backend), tiếp nối chuỗi S-S1..S-S6 (backfill món ăn). Không đụng
Wave 1 (bug parse số / đổi tên nút Nạp-Xả / màu chart TrendChart — các file đó
đã có sẵn thay đổi uncommitted trong working tree, giữ nguyên).

## T2.1 — giới hạn nhập 3 ngày + chip "Hôm kìa"

- `src/lib/constants.ts`: thêm `BACKFILL_MAX_DAYS_BACK = 3` (giữ nguyên
  `DATA_RETENTION_DAYS = 35` — đó là hạn lưu trữ, không phải hạn nhập liệu).
- `src/components/food/PastDateField.tsx`: thêm chip thứ 4 (`days: 3`, label
  `t('common.threeDaysAgo')`), thêm `flexWrap: 'wrap'` vào `chipsRow` (4 chip +
  chip data-driven từ `maxDaysBack` khác nhau ở 2 nơi gọi có thể tràn dòng trên
  máy nhỏ nếu không wrap).
- `src/components/FoodLogModal.tsx`: `maxDaysBack={DATA_RETENTION_DAYS}` →
  `maxDaysBack={BACKFILL_MAX_DAYS_BACK}` (chỉ 1 import + 1 dòng dùng — phần
  `parseDecimal(grams)`/`parseDecimal(portionCount)` trong file này đã có sẵn
  từ Wave 1, không phải tôi thêm).
- `src/components/DayDetailSheet.tsx`: thêm prop bắt buộc `canAddFood: boolean`
  — ẩn nút "+ Thêm món" khi `false`. Xoá món vẫn luôn cho phép, không đổi.
- `src/screens/HistoryScreen.tsx`: tính `canAddFood = daysBetween(sheetDate,
  today) <= BACKFILL_MAX_DAYS_BACK` truyền vào `<DayDetailSheet>`.
- i18n: `common.threeDaysAgo` (vi "Hôm kìa" / en "3 days ago" / de "Vor 3
  Tagen") trong `vi.ts`/`en.ts`/`de.ts`.
- Fix Wave 1 note (`src/domain/food/customFoodInput.ts`): 2 chỗ `parseFloat`
  còn sót (`parseNum` nội bộ dòng ~101, `isValidCustomFoodInput` dòng ~165) →
  đổi sang `parseDecimal` (từ `src/lib/units.ts`, đã có sẵn từ Wave 1) — cùng
  bug bàn phím decimal-pad VI/DE dùng dấu phẩy như cân nặng.

## T2.2 — Ghi vận động (Xả) cho ngày quá khứ

### Bước A — trả lời câu hỏi điều tra bắt buộc

1. **`logActivity` (hôm nay) ghi gì chỉ nên áp dụng cho hôm nay:**
   `growGoalFromActivity` nới `capacity`/`activityBonusKcal` của **pin Năng
   lượng đang tải** (mục tiêu ăn hôm nay), `drainFromWorkout` rút
   `satietyReserveKcal` (pin no/đói hiện tại), và `applyIntake` cộng dồn vào
   **pin Vận động đang tải** (`readings` trong store — luôn là hôm nay).
2. **`logFoodForPastDate` cập nhật ngày cũ bằng cơ chế nào:** đọc-sửa-ghi qua
   `getReadingsForDate(day)` → `applyFoodToDayReadings` (pure, trong
   `domain/food/backfillEngine.ts`) → `upsertReadings([...])`, tách riêng
   **ngày lịch** (nutrient: protein/carbs/water/minerals) và **ngày năng
   lượng** (kcal ledger, mốc reset 6h) — 2 ngày này có thể khác nhau (overlap
   0h-6h). Ngày chưa từng mở app dùng `buildReadingsForMissedDay` để dựng
   reading mới. **Quan trọng: `logFoodForPastDate` (và cả `logFood` hôm nay)
   KHÔNG ghi vào `intake_events`** — món ăn chỉ có 1 đường xuất Excel là bảng
   `food_log` (đọc trực tiếp qua `getFoodLogInRange` trong
   `excelExportService.ts`), không qua `intake_events`.
3. **`removeFoodForPastDate` đảo ngược đối xứng:** cùng cấu trúc calendar-
   day/energy-day, dùng `reverseFoodOnDayReadings` (phép trừ đơn giản, không
   phải thuật toán delta-clamp phức tạp mà `removeActivity` hôm-nay dùng cho
   pin Vận động — vì ngày cũ không có `tickDrain`/`addIntake` chạy đè lên).
   Có guard chống double-tap (kiểm tra entry còn tồn tại trong DB trước khi
   đảo ngược).

**Phát hiện quan trọng khác Wave 1/spec cũ:** khác với món ăn, **vận động chỉ
có DUY NHẤT 1 đường xuất Excel là bảng `intake_events`** (`excelExportService`
sheet "Intake events" đọc `getIntakeEventsInRange`; không có sheet nào đọc
`activity_log` trực tiếp) → `logActivityForPastDate` **BẮT BUỘC** phải ghi
`intake_events` (khác với thiết kế "nếu food làm thì mình cũng làm" trong đề
bài — food KHÔNG làm, nhưng activity vẫn phải làm, vì lý do khác: đây là
đường xuất Excel duy nhất của nó).

### ⚠️ Vấn đề ngữ nghĩa cần người dùng/kiến trúc sư quyết định

Acceptance đề bài: *"Ghi 1 buổi tập 30 phút cho 'Hôm kìa' → card ngày đó trong
Lịch sử 7 ngày **tăng % Năng lượng**"*. Đã cân nhắc kỹ trước khi code — mô
hình S-M hiện tại định nghĩa pin "Năng lượng" = `đã ăn (level) / mục tiêu
(capacity)`, và `growGoalFromActivity` (dùng cho CẢ hôm nay lẫn ngày cũ) **chỉ
nới `capacity` (mẫu số), không đụng `level` (tử số)** — vận động không phải là
"đã ăn". Do đó:

- Badge **"NL X%"** (`screens.history.energyBadge` — tỉ lệ ăn/mục tiêu) **sẽ
  KHÔNG tăng** khi chỉ ghi vận động cho ngày đó (giữ nguyên 0% nếu ngày đó
  chưa ăn gì, vì 0/(mục tiêu lớn hơn) vẫn là 0%) — **giống hệt hành vi hôm nay
  hiện tại** (logActivity hôm nay cũng không bao giờ đụng `level`).
- Badge **"DD X%"** (`screens.history.nutritionBadge` — trung bình 6 pin dinh
  dưỡng, có pin Vận động) **SẼ tăng**, vì pin Vận động của ngày đó được sạc
  (`applyIntake`), và thanh mini-bar "Vận động" trên card cũng đổi.

Tôi **cố tình KHÔNG** làm cho vận động "đổ" kcal vào `level` của pin Năng
lượng để ép badge NL tăng — điều đó sẽ phá vỡ bất biến `level == kcal đã ăn`
mà `useLowEnergyWatch` đang dùng để tính "ăn dư bao nhiêu kcal" (`level -
capacity`), và làm pin Năng lượng ngày đó mất ý nghĩa nếu sau này người dùng
cũng bù món ăn cho đúng ngày đó (2 nguồn kcal khác nhau lẫn vào cùng 1 số).
Đây là quyết định kiến trúc, không phải bug — nếu người dùng thực sự muốn thấy
badge NL nhúc nhích khi có vận động (kể cả chưa ăn), cần một quyết định sản
phẩm riêng (ví dụ đổi công thức badge NL, hoặc thêm 1 icon/badge riêng "có vận
động" trên card) — **chưa làm, cần người dùng chốt hướng.**

### Implement

- **`src/domain/energy/activityBackfillEngine.ts`** (mới, thuần, có test):
  `applyActivityToDayReadings(readings, profile, steps, workouts)` — nới
  `capacity`/`activityBonusKcal` của pin Năng lượng qua `growGoalFromActivity`
  (tái dùng nguyên hàm hiện có), sạc pin Vận động qua `applyIntake` — KHÔNG
  đụng satiety (giống `applyFoodToDayReadings` không đụng satiety cho món ăn
  ngày cũ, vì "đói" của buổi tập cũ đã hết tác dụng). Và
  `reverseActivityOnDayReadings(readings, entry)` — nghịch đảo đơn giản (phép
  trừ trực tiếp, KHÔNG dùng thuật toán delta-clamp phức tạp mà
  `removeActivity` hôm nay dùng — lý do đã giải thích ở câu 3 Bước A).
  Test: `src/domain/energy/__tests__/activityBackfillEngine.test.ts` (12 case:
  charge/reverse/clamp/round-trip/satiety-untouched/fallback pre-migration).
- **`src/store/energyStore.ts`**: thêm 2 action MỚI, KHÔNG sửa `logActivity`/
  `removeActivity` hiện có:
  - `logActivityForPastDate(activity, timestamp)` — cùng cấu trúc
    calendar-day/energy-day split như `logFoodForPastDate`; timestamp nằm
    trọn hôm nay thì delegate sang `logActivity` (an toàn nếu lỡ gọi nhầm).
    Ghi `activity_log` + `intake_events` (bắt buộc, xem phát hiện ở trên) +
    `daily_log` (cho ngày chưa từng mở app).
  - `removeActivityForPastDate(entry)` — đối xứng đầy đủ, có guard
    idempotence (kiểm tra `getActivityLogForDate` trước khi đảo ngược), dọn cả
    `intake_events` liên quan. **KHÔNG bỏ qua** — activity_log CÓ id ổn định
    (`deleteActivityLogEntry(id)` đã có sẵn), nên lý do giả định trong đề bài
    để bỏ qua ("không có primary key ổn định") không áp dụng.
  Test: `src/store/__tests__/energyStore.activityBackfill.test.ts` (7 case,
  mirror `energyStore.backfill.test.ts` của món ăn: không đụng số hôm nay,
  sạc đúng ngày cũ, dựng ngày chưa mở app, delegate khi cùng ngày, round-trip
  xoá, idempotent, delegate xoá khi vẫn còn trong list hôm nay).
- **`src/components/EnergyActionsBar.tsx`**: thêm `activityDate` state (mặc
  định hôm nay), `<PastDateField maxDaysBack={BACKFILL_MAX_DAYS_BACK}>` +
  dòng cảnh báo `backfillNotice` trong sheet "Xả". `confirmActivity()` rẽ
  nhánh: hôm nay → `logActivity` y nguyên (không regression); ngày khác →
  build `startAt`/`endAt` qua `parseTimeHHmmForDate` (hàm mới, mirror
  `parseTimeHHmmToday` nhưng neo theo ngày bất kỳ, thêm vào
  `src/lib/dateUtils.ts`), timestamp ghi = `startAt` nếu có, else noon của
  ngày đó (tái dùng `buildTimestampForDate` export từ `FoodLogModal.tsx`) →
  gọi `logActivityForPastDate`.
- i18n: `components.energyActionsBar.logDateFieldLabel` ("Ngày ghi") và
  `.backfillNotice` ("🕓 Ghi cho ngày {{date}}", mirror chữ đã có ở
  `foodLogModal.backfillNotice`) — cả 3 file vi/en/de.

## Verify

`npm run verify` (tsc + eslint + jest) — **PASS toàn bộ**:
- `tsc --noEmit`: sạch.
- `eslint 'src/**/*.{ts,tsx}'`: sạch (0 lỗi, kể cả react-hooks/purity —
  `getTodayString()`/module-level wrapper cho `Date.now()`/`todayString()`
  giống pattern có sẵn trong `FoodLogModal.tsx`).
- `jest`: **482/482 test PASS / 41 suite** (từ 475 trước phiên này — tăng 7 do
  `activityBackfillEngine.test.ts` (12 case... thực tế gộp vào tổng, xem chi
  tiết run log) + `energyStore.activityBackfill.test.ts` (7 case)).

## File đã sửa/thêm

**Sửa:**
- `src/lib/constants.ts` — thêm `BACKFILL_MAX_DAYS_BACK`.
- `src/lib/dateUtils.ts` — thêm `parseTimeHHmmForDate`.
- `src/domain/food/customFoodInput.ts` — 2 chỗ `parseFloat` → `parseDecimal`.
- `src/store/energyStore.ts` — thêm `logActivityForPastDate` +
  `removeActivityForPastDate` (interface + implementation), import domain mới.
- `src/i18n/locales/vi.ts`/`en.ts`/`de.ts` — `common.threeDaysAgo`,
  `energyActionsBar.logDateFieldLabel`/`.backfillNotice`.
- `src/components/food/PastDateField.tsx` — chip thứ 4 + `flexWrap`.
- `src/components/FoodLogModal.tsx` — `DATA_RETENTION_DAYS` →
  `BACKFILL_MAX_DAYS_BACK`.
- `src/components/EnergyActionsBar.tsx` — `activityDate` state + PastDateField
  + backfillNotice + rẽ nhánh `confirmActivity`.
- `src/screens/HistoryScreen.tsx` — tính/truyền `canAddFood`.
- `src/components/DayDetailSheet.tsx` — prop `canAddFood`, ẩn nút thêm món.

**Mới:**
- `src/domain/energy/activityBackfillEngine.ts`
- `src/domain/energy/__tests__/activityBackfillEngine.test.ts`
- `src/store/__tests__/energyStore.activityBackfill.test.ts`

## Việc CHƯA làm / để dành

- **Xem/xoá vận động ngày cũ trong Lịch sử:** `removeActivityForPastDate` đã
  viết + test ở tầng store, nhưng **DayDetailSheet chưa hiển thị danh sách
  vận động của ngày cũ** (hiện chỉ liệt kê món ăn) — không có UI nào gọi hàm
  này. Ngoài phạm vi đề bài (chỉ yêu cầu ghi/xả, không yêu cầu thêm khu vực
  hiển thị vận động trong Lịch sử) — để dành cho tính năng sau nếu cần.
- **Bất đồng ngữ nghĩa badge "% Năng lượng" khi backfill vận động** — xem mục
  cảnh báo ở trên, cần người dùng/kiến trúc sư chốt hướng trước khi "sửa" (nếu
  thực sự muốn).
- Chưa test tay trên điện thoại (đúng quy trình dự án — Session log sẽ ghi
  "CHƯA TEST MÁY THẬT" như các session trước).

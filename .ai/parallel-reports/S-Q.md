# S-Q — Lắp ráp 2 đồng hồ: Pin no/đói (headline) + Sổ calo (reset 6h) + nhắc nhẹ

**Trạng thái:** ✅ XONG CODE (2026-07-04) — ⏳ chưa test máy cùng người dùng (đặc biệt mốc 6h,
xem checklist cuối file). Spec gốc: `.ai/parallel-reports/S-O-satiety-battery-spec.md`.

## Điều kiện & các điểm đã chốt với người dùng trước khi code
- ✅ S-O + S-P (và S-M) đã commit tách 3 gói trước khi mở S-Q (người dùng chọn phương án
  "commit tách gói": `136fd23` S-M · `3efee07` S-O · `139f10c` S-P · `0aeb1c8` docs/spec).
- ✅ **Hình UI:** theo đúng spec mục 2 — **BỎ dòng "Còn được ăn ngay"** của S-M (pin no/đói
  tụt sống đã thay vai trò đó). Pin chính = %, nhãn "Năng lượng cơ thể"; dưới gạch ngang:
  "Sổ calo hôm nay: X / Y kcal" (+ "Ăn dư Z kcal" khi vượt) + dòng "Mục tiêu: giảm về NN kg
  (an toàn)" khi có goal + "* Chỉ để tham khảo."
- ✅ **Reset 6h:** CHỈ áp cho Sổ calo (`energyDayString`). Pin dinh dưỡng / History / export
  giữ mốc nửa đêm (`todayString` KHÔNG bị sửa).
- ✅ **Nhắc nhẹ:** chỉ **1 lần/ngày năng lượng** khi reserve chạm sàn 0 (pin hiện 20%),
  **chỉ trong giờ thức (6h-23h)**, giọng nhẹ ("Bụng có vẻ đói một lúc rồi — nên ăn chút gì
  nhé. Chỉ để tham khảo."). Nhắc ăn-dư của S-M giữ nguyên.

## ⚠️ Mở rộng phạm vi (đã xin phép, người dùng duyệt "Thêm cột DB")
Bảng `battery_readings` chỉ có 4 cột cố định → không thể lưu bền reserve. Đã sửa thêm
3 file ngoài danh sách gốc:
- `src/data/db/schema.ts` — thêm 3 cột `activity_bonus_kcal`, `satiety_reserve_kcal`,
  `last_satiety_sync_at` vào CREATE TABLE + danh sách migration.
- `src/data/db/database.ts` — `migrateBatteryReadings()`: PRAGMA table_info rồi ALTER TABLE
  từng cột còn thiếu (an toàn cho DB cũ lẫn cài mới).
- `src/data/repositories/batteryRepository.ts` — đọc/ghi 3 cột mới; thêm
  `getLatestEnergyReadingBefore(date)` để mang reserve qua mốc 6h.
- **Tiện thể sửa luôn lỗi tồn đọng S-M:** `activityBonusKcal` trước đây KHÔNG được lưu DB —
  tắt app giữa ngày là mất phần mục tiêu đã cộng do vận động. Nay đã lưu bền.

## Cách hoạt động (mô hình đã lắp)
### Pin no/đói (headline)
- Trạng thái sống trên reading pin `energy`: `satietyReserveKcal` (0..1000) +
  `lastSatietySyncAt` (mốc neo). **Liên tục, không reset ngày** — qua mốc 6h chỉ Sổ calo về
  0, reserve được mang nguyên sang (`getLatestEnergyReadingBefore`).
- Drain LUÔN tính từ mốc neo lưu bền → không bao giờ cộng dồn tick nhỏ bị làm tròn về 0
  (đúng lưu ý số 1 của S-O). Ghi bền mỗi ~20 phút (`tickDrain`, `useDrainTick` đổi 30→20
  phút) + khi mở app; giữa 2 lần ghi, `useLiveEnergyReading` tự nội suy mỗi giây từ mốc neo
  để pin tụt nhìn thấy được.
- Ăn (logFood / addCalories / addIntake macro) → `eatIntoReserve`. Xoá món → trừ lại (sàn 0).
  Ghi buổi tập → `drainFromWorkout` (bước chân KHÔNG trừ — đã nằm trong passive burn từ S-F).
- Lần cài đầu tiên chưa có dữ liệu: reserve khởi tạo 0 → pin hiện sàn 20% (đói) — ăn bữa
  đầu là nhảy lên ngay.

### Sổ calo (dòng phụ, engine S-M giữ nguyên)
- `capacity` = `dailyCalorieTarget(profile).targetKcal` (S-P, đã kẹp an toàn)
  `+ activityBonusKcal`. KHÔNG còn = TDEE thô.
- Key ngày theo `energyDayString(date, 6)` (hàm mới trong `lib/dateUtils.ts`, có test TDD):
  0h-6h sáng vẫn tính là "ngày hôm qua" → ăn khuya 1h sáng vào sổ hôm trước; đúng 6h sổ về
  0/mục tiêu mới. `App.tsx` theo dõi cả 2 mốc (nửa đêm cho pin dinh dưỡng, 6h cho sổ) mỗi
  15 phút + khi mở app lại.
- `masterPercentage` trong store vẫn là % sổ (đã ăn/mục tiêu) — nhắc ăn-dư 130% dùng nó.

## File đã sửa (ngoài 3 file DB ở trên)
- `src/types/battery.ts` — thêm `satietyReserveKcal?`, `lastSatietySyncAt?`.
- `src/lib/dateUtils.ts` — thêm `energyDayString` (TDD: test RED→GREEN trong
  `src/lib/__tests__/dateUtils.test.ts`, +5 test). `todayString` không đổi.
- `src/store/energyStore.ts` — như mô tả trên (helpers `applySafeCalorieTarget`,
  `syncSatietyReserve`, `mapEnergy`; loadToday tách nutrient/energy theo 2 mốc ngày).
- `src/hooks/useLiveEnergyReading.ts` — trả `satietyPct` (sống) + `ledgerPct`/kcal; bỏ
  `canEatKcal` (theo lựa chọn UI). Giữ nguyên cơ chế tick giây + AppState.
- `src/hooks/useDrainTick.ts` — 30→20 phút; sửa luôn lint error L-1 (`useRef(Date.now())`
  → `useRef(0)` + stamp trong effect).
- `src/hooks/useLowEnergyWatch.ts` — thêm nhánh nhắc "nên ăn" (1 lần/ngày năng lượng, giờ
  thức, chạm sàn); nhánh ăn-dư giữ nguyên.
- `src/components/MasterBattery.tsx` — layout 2 đồng hồ; thanh pin = satiety %, **luôn màu
  xanh** mọi mức (thấp = bình thường, không đỏ — CONTEXT mục 5); vàng hổ phách chỉ cho chữ
  "Ăn dư". `LiveMasterBattery.tsx` — truyền satietyPct + dòng mục tiêu cân nặng từ profile.
- `src/services/notifications/notificationService.ts`(+`.web.ts`) — thêm `sendEatReminder`
  (additive).
- `App.tsx` — theo dõi thêm mốc energy day 6h.

## KHÔNG đụng (đúng cam kết)
`satietyEngine.ts`, `metabolicConstants.ts` (S-O — chỉ gọi), `weightGoal.ts`,
`weightGoalConstants.ts`, `BodyProfileCard.tsx` (S-P — chỉ gọi), `FoodLogModal.tsx`,
`settingsStore.ts`, `SettingsScreen.tsx`, `foodDatabase.ts`/`usdaFoods.ts`,
`energyBalanceEngine.ts` (capacity override làm ở store, không sửa engine S-M).

## Kiểm tra (trước khi báo xong)
- `npx tsc --noEmit` → sạch.
- `npx jest` → **149 test PASS / 14 suite** (+5 test `energyDayString`).
- `npx expo export --platform ios` → OK, **1431 module**.
- `npm run verify` → chỉ còn đúng **1 lint error tồn đọng L-1** ở `HistoryScreen.tsx:50`
  (ngoài phạm vi S-Q, không sửa tự tiện; lỗi L-1 thứ hai ở `useDrainTick.ts` đã sửa nhân
  tiện trong gói này).

## Lưu ý / hạn chế đã biết (chuyển cho S-A + phiên sau)
1. **Danh sách "Hôm nay đã ăn" (`foodLog`) vẫn theo ngày lịch** (foodLogRepository ngoài
   phạm vi) — món ăn lúc 0h-6h hiện trong danh sách của ngày lịch mới dù kcal đã vào sổ hôm
   trước. Lệch hiển thị nhỏ, chỉ trong khung 0h-6h. Muốn khớp hẳn thì sửa
   `getFoodLogForDate` theo energy day (gói sau).
2. Nhắc "nên ăn" chống lặp bằng ref trong bộ nhớ — **restart app trong cùng ngày có thể
   nhắc lại 1 lần nữa** nếu reserve vẫn 0. Chấp nhận được (nhắc nhẹ, tối đa thêm 1 lần).
3. Fallback không-DB (web) không lưu bền reserve — mỗi lần mở về 0 (web vốn không có SQLite).
4. History/TrendChart đọc reading theo ngày lịch; row pin energy giờ key theo energy day —
   với ngày quá khứ 2 mốc trùng nhau gần hết, chỉ lệch phần 0h-6h. Theo dõi thêm ở S-A.

## ✅ Checklist test máy cùng người dùng (S-A — BẮT BUỘC trước khi đánh dấu xong hẳn)
1. Mở app buổi sáng: pin hiện thấp (~20-40%) màu XANH, không đỏ, không chữ hù.
2. Ghi 1 bữa ~600-900 kcal: pin nhảy lên (~68-92%), Sổ calo tăng đúng số kcal.
3. Để app mở 30-60 phút: pin tụt dần từ từ (mỗi ~40 giây nhích ~1 kcal nội suy).
4. Ghi 1 buổi tập: pin no TỤT thêm một cục; mục tiêu Sổ calo TĂNG thêm đúng kcal buổi tập.
5. Đặt cân nặng mong muốn trong Hồ sơ: dòng "Mục tiêu: giảm về NN kg (an toàn)" hiện ra,
   mục tiêu Sổ calo đổi theo (bị kẹp nếu đặt quá gấp).
6. **Mốc 6h (đổi giờ điện thoại để thử):** chỉnh giờ máy 5:55 → đợi qua 6:01 (hoặc tắt/mở
   app qua mốc): Sổ calo về 0 / mục tiêu mới, **pin no KHÔNG nhảy** (giữ nguyên mức đang
   tụt). Chỉnh giờ 23:50 → qua 0:01: pin dinh dưỡng reset, Sổ calo GIỮ NGUYÊN (chưa 6h).
7. Tắt hẳn app 1-2 tiếng rồi mở lại: pin no thấp hơn đúng khoảng thời gian đã trôi.
8. Reserve chạm sàn trong giờ thức: nhận đúng 1 thông báo "🍽️ Nên ăn chút gì nhé" (giọng
   nhẹ), không lặp trong ngày.

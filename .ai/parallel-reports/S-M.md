# Báo cáo gói S-M — Lật pin Năng lượng sang "đã ăn / mục tiêu" (đếm lên)

## Mục tiêu
Đổi pin Năng lượng từ "xả dần từ đầy" sang "đã ăn hôm nay / mục tiêu ngày"
(đếm LÊN, đầy dần khi ăn), theo đúng
`.ai/parallel-reports/S-M-energy-redesign-spec.md` đã chốt với người dùng
2026-06-18. Thêm 1 con số sống "còn được ăn ngay" tăng dần theo thời gian, tái
dùng cơ chế tick/giây của Session 5 (đổi mục đích, không xoá).

## 3 điểm đã xác nhận với người dùng trước khi code (spec mục 7)
1. **Vị trí UI** "còn được ăn ngay": đúng theo hình mẫu trong spec — dưới
   thanh pin, có gạch ngang phân cách, cuối cùng là dòng "Chỉ để tham khảo."
2. **Cảnh báo "pin thấp"**: bỏ hẳn kiểu cũ (nhắc khi % thấp — rỗng sáng là
   bình thường), thay bằng cảnh báo MỚI: nhắc khi ăn dư khá nhiều so với mục
   tiêu (>130%), từ ngữ trung tính.
3. **Vận động cộng vào mục tiêu**: xác nhận đúng — đi bộ/tập ghi qua
   `EnergyActionsBar` cộng thẳng vào `capacity` (mục tiêu ngày), không trừ
   vào `level` (đã ăn).

## ⚠️ Mở rộng phạm vi file (đã xin phép trước khi code)
Phát hiện `masterPercentage` trong `energyStore.ts` **chỉ phục vụ duy nhất**
`src/hooks/useLowEnergyWatch.ts` (bắn thông báo đẩy) — file này KHÔNG nằm
trong danh sách được giao ban đầu, nhưng nếu không sửa thì mỗi sáng pin rỗng
(0% ăn) sẽ bị coi là "tụt qua ngưỡng thấp" và bắn thông báo "hãy nạp thêm
ngay" — đúng thứ CONTEXT mục 5 cấm. Người dùng đã duyệt phương án "Bỏ hẳn,
thay bằng nhắc ăn-dư", nên đã mở rộng sửa thêm:
- `src/hooks/useLowEnergyWatch.ts` — viết lại logic (xem dưới).
- `src/services/notifications/notificationService.ts` +
  `notificationService.web.ts` — chỉ **thêm** 1 hàm mới
  `sendOvereatingAlert()` (additive, không đổi hàm nào đang có).

## File đã sửa

### `src/domain/energy/energyBalanceEngine.ts` (đổi semantics hoàn toàn)
- `createEnergyReading`: `level` bắt đầu **0** (rỗng), `capacity` =
  `energyCapacity(profile)` (= `passiveDailyBurn`, đã gồm bước chân trung bình
  từ S-F).
- `chargeEnergy`/`burnEnergy`: bỏ clamp trần ở `capacity` — ăn vượt mục tiêu
  được phép, để hiện đúng số "ăn dư" thay vì bị cắt mất. `burnEnergy` (dùng
  khi xoá món ăn) vẫn floor ở 0.
- `reconcileEnergyCapacity`: tính lại `capacity` từ hồ sơ + giữ nguyên phần
  mục tiêu đã tăng do vận động hôm đó (`activityBonusKcal`) — KHÔNG còn clamp
  `level` xuống theo capacity mới (đã ăn thì giữ nguyên, không co lại chỉ vì
  đổi hồ sơ).
- `burnActivity` → đổi tên **`growGoalFromActivity`**: cộng kcal
  bước/tập vào `capacity` (mục tiêu), KHÔNG đụng `level`. Theo dõi cộng dồn
  qua field mới `activityBonusKcal` (xem types bên dưới) để sống sót qua lần
  `reconcileEnergyCapacity` kế tiếp trong ngày (vd. app bị đóng/mở lại sau khi
  đã log 1 buổi tập).
- Bỏ `burnPassive` (bản trừ-theo-giờ cũ) — pin Năng lượng không còn tự xả
  theo thời gian. Thay bằng 2 hàm thuần mới phục vụ con số sống:
  - `burnedSoFar(profile, elapsedHoursSinceMidnight, activityBonusKcal)`:
    kcal cơ thể đã đốt từ 0h, rải đều theo giờ + phần vận động đã ghi.
  - `canEatNow(reading, profile, elapsedHoursSinceMidnight)`: `burnedSoFar −
    đã ăn`. Dương = "Còn được ăn"; âm = "Đang dư" (ăn trước, cơ thể đốt sau —
    rất bình thường sau 1 bữa, không phải "ăn dư cả ngày").

### `src/domain/energy/__tests__/energyBalanceEngine.test.ts`
Viết lại toàn bộ theo semantics mới: pin bắt đầu rỗng, `chargeEnergy` không
clamp trần, `growGoalFromActivity` cộng dồn đúng `activityBonusKcal` qua
nhiều lần gọi, `reconcileEnergyCapacity` giữ nguyên `level` + bảo toàn
`activityBonusKcal`, `burnedSoFar`/`canEatNow` đúng công thức cả 2 chiều
dương/âm.

### `src/types/battery.ts`
Thêm field tuỳ chọn `activityBonusKcal?: number` vào `BatteryReading` (chỉ
pin Năng lượng dùng, các pin khác bỏ qua) — lý do ở trên.

### `src/store/energyStore.ts`
- `tickDrain`: bỏ hẳn nhánh gọi `burnPassive` cho pin `energy` — pin Năng
  lượng giờ được trả nguyên (`return r`) trong tick, chỉ các pin dinh dưỡng
  còn xả theo mode như cũ.
- `logActivity`: gọi `growGoalFromActivity` thay vì `burnActivity`.
- `addIntake`: bỏ pin `energy` ra khỏi danh sách kiểm tra "pin thấp" trả về
  cho `HomeScreen` (rỗng đầu ngày là bình thường, không còn cảnh báo kiểu
  này cho Năng lượng — pin dinh dưỡng khác không đổi).

### `src/hooks/useLiveEnergyReading.ts`
Đổi mục đích hoàn toàn: không còn nội suy xả mượt theo giây (vì không xả nữa)
— `percentage`/`levelKcal`/`capacityKcal` đọc thẳng từ reading (đã tự
re-render khi ăn/log hoạt động qua store). Cơ chế tick/giây (setInterval +
AppState, y nguyên code cũ) giờ chỉ dùng để tính lại `canEatKcal` = `canEatNow`
mỗi giây, dựa trên số giờ đã trôi từ **0h sáng** (parse `reading.date +
'T00:00:00'`, cùng quy ước với `formatDisplayDate` trong `dateUtils.ts`).

### `src/components/MasterBattery.tsx` + `LiveMasterBattery.tsx`
- Nhãn đổi thành "Đã ăn hôm nay", dòng kcal format có dấu chấm ngăn nghìn
  (`toLocaleString('vi-VN')`, khớp hình mẫu spec "1.750 / 2.200 kcal").
- Thanh pin (bar) luôn hiện tối đa 100% về mặt hình ảnh; khi ăn vượt mục
  tiêu, thêm dòng chữ riêng "Ăn dư {X} kcal" thay vì để thanh tràn ra ngoài.
- **Bỏ hẳn màu đỏ** cho % thấp (rỗng sáng = bình thường, không hù — CONTEXT
  mục 5). Màu xanh lá (`#00B894`) mặc định mọi mức đã ăn; màu vàng hổ phách
  (`#FFD93D`) CHỈ dùng khi ăn vượt mục tiêu — trung tính, không phải màu báo
  nguy hiểm.
- Thêm khối "con số sống" dưới gạch ngang: `Còn được ăn ngay: +X kcal` (xanh)
  hoặc `Đang dư: Y kcal` (vàng hổ phách) khi âm, cùng dòng nhỏ "* Chỉ để tham
  khảo." — đúng ranh giới sức khoẻ bắt buộc.
- `LiveMasterBattery` truyền thêm `canEatKcal` từ hook xuống.

### `src/hooks/useLowEnergyWatch.ts` (mở rộng phạm vi, đã xin phép)
Viết lại: không còn theo dõi "tụt xuống dưới ngưỡng thấp" (vô nghĩa với mô
hình mới) mà theo dõi **tụt lên trên ngưỡng ăn-dư** (130% mục tiêu, hằng số
`OVEREAT_ALERT_THRESHOLD_PCT` khai báo ngay trong file). Giữ nguyên cơ chế
"armed/disarm" chống spam của bản cũ, chỉ đổi chiều. Gọi `sendOvereatingAlert`
(hàm mới) thay vì `sendLowBatteryAlerts`. Không còn dùng
`checkLowBattery`/`lowBatteryThreshold` trong file này nữa (các pin dinh
dưỡng khác không bị ảnh hưởng — chúng vẫn cảnh báo thấp qua `addIntake` như
cũ, không đụng `lowBatteryRules.ts`).

### `src/services/notifications/notificationService.ts` + `.web.ts`
Thêm hàm mới `sendOvereatingAlert(message)` (title "🍽️ Ăn dư hôm nay") —
additive, không sửa `sendLowBatteryAlerts`/`scheduleDailyReminder` hiện có
(nutrient batteries vẫn dùng chúng y nguyên).

## Không đụng (đúng yêu cầu)
`App.tsx`, mọi `screens/`, `FoodLogModal.tsx`, `settingsStore.ts`,
`foodDatabase.ts`/`usdaFoods.ts`, `package.json`,
`domain/energy/metabolismEngine.ts` (chỉ đọc `passiveDailyBurn`/
`passiveBurnPerHour`/`stepsKcal`/`totalWorkoutKcal`), `domain/rules/
lowBatteryRules.ts` (không cần sửa — logic ăn-dư viết trực tiếp trong
`useLowEnergyWatch.ts`, không đi qua file này).

## Kiểm tra
- `npx tsc --noEmit` → sạch, không lỗi.
- `npx jest` → **109 test PASS / 12 suite** (thêm test mới cho
  `energyBalanceEngine`, xoá test 2 hàm bị đổi tên/xoá).
- `npx expo export --platform ios` → OK, **1428 module**.
- ⏳ **Chưa test trên điện thoại cùng người dùng** — đây là tiêu chí hoàn
  thành cuối cùng còn thiếu (ăn → bar lên; để lâu không ăn → "còn được ăn"
  tăng; ăn vượt mục tiêu → hiện "ăn dư"; sáng sớm/rỗng pin không bị tô đỏ hay
  nhắc phải ăn ngay).

## ⚠️ Ghi chú quan trọng cho người dùng
Trong lúc làm gói này, phát hiện **một phiên Claude Code song song khác**
(đang chạy trên máy, ngoài phạm vi S-M) đã sửa `package.json`,
`package-lock.json` và `.claude/settings.json` (thêm ESLint + 1 hook lint khi
sửa file + 1 hook nhắc "npm run verify" lúc kết phiên). Gói S-M **không đụng
tới 3 file này** — khi commit, chỉ nên `git add` đúng các file domain/store/
hooks/components liệt kê ở trên, tránh gộp nhầm thay đổi của phiên kia vào
cùng 1 commit.

## Lưu ý cho phiên sau
- `masterPercentage` trong store giờ có thể **vượt 100** (ăn dư) — nếu sau
  này màn History (U3, đã ghi trong spec mục 3) đọc lại % pin Năng lượng theo
  ngày, cần xử lý case >100% tương tự (không phải lỗi).
- Tiêu đề thông báo `sendLowBatteryAlerts` hiện vẫn hard-code "⚡ Pin năng
  lượng thấp" dù dùng chung cho mọi pin dinh dưỡng (bug nhỏ có từ trước, không
  liên quan S-M, chưa sửa).

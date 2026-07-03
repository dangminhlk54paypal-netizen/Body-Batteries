# S-O · Pin "no/đói" tụt dần theo nhịp sinh học — engine thuần

**Trạng thái:** ✅ XONG CODE (2026-07-04). Chưa lắp vào store/UI — đó là việc của gói **S-Q**
(chờ cả S-O + S-P xong). Engine này 100% thuần (không React, không DB, không side-effect).

## Số đã xác nhận với người dùng trước khi code
- `FULLNESS_CAPACITY_KCAL = 1000` (sức chứa "một bữa no")
- `SATIETY_FLOOR_PCT = 20` (sàn %, không bao giờ hiện 0%)
- `SLEEP_BURN_MULTIPLIER = 0.85` (đúng số đã websearch trong spec)
- Khung thức/ngủ: `CIRCADIAN_WINDOW = { wakeHour: 6, sleepHour: 23 }` (giữ nguyên từ spec/S-K cũ)

## File đã tạo/sửa (đúng phạm vi được giao)
- **TẠO** `src/types/satiety.ts` — `SatietyReading { reserveKcal }`.
- **TẠO** `src/domain/energy/satietyEngine.ts` — hàm thuần:
  - `circadianBurnKcal(profile, fromMs, toMs)` — kcal xả giữa 2 mốc thời gian bất kỳ, chia theo
    giờ thức/ngủ. Tự suy ra tốc độ kcal/giờ (`awake`/`asleep = awake × 0.85`) từ
    `passiveDailyBurn(profile)` sao cho một chu kỳ 24h liên tục **luôn** ra đúng
    `passiveDailyBurn` — đây là bất biến toán học (tích phân 1 hàm tuần hoàn chu kỳ 24h trên bất
    kỳ cửa sổ dài đúng 24h nào cũng ra cùng 1 giá trị, bất kể lệch pha), không phải trùng hợp số.
  - `applyCircadianDrain(reserveKcal, profile, fromMs, toMs)` — trừ reserve theo trên, sàn 0.
  - `eatIntoReserve(reserveKcal, kcalEaten)` — cộng, trần `FULLNESS_CAPACITY_KCAL`.
  - `drainFromWorkout(reserveKcal, workoutKcalBurned)` — trừ thẳng, sàn 0.
  - `satietyPercentage(reserveKcal)` — ánh xạ 0-100 có sàn `SATIETY_FLOOR_PCT`, clamp.
- **TẠO** `src/domain/energy/__tests__/satietyEngine.test.ts` — 24 test.
- **SỬA** `src/lib/metabolicConstants.ts` — thêm 4 hằng số trên (chỉ thêm, không đổi hằng số cũ).
- **CHỈ ĐỌC** `src/domain/energy/metabolismEngine.ts` (dùng `passiveDailyBurn`), không sửa gì.
- Không đụng `energyStore.ts`, `MasterBattery.tsx`, `useLiveEnergyReading.ts`,
  `types/battery.ts`, `types/energy.ts`, `App.tsx` — đúng ràng buộc được giao.

## Bất biến quan trọng nhất — đã test
`circadianBurnKcal` tích trên đúng 24h liên tục = `passiveDailyBurn(profile)`, kiểm tra với
**8 giờ bắt đầu khác nhau** (0, 3, 6, 9, 12, 17, 20, 23h) — tất cả bằng nhau và bằng
`passiveDailyBurn`. Thêm test 72h = 3× (nhiều ngày liên tiếp) và test cửa sổ cắt qua ranh giới
thức/ngủ (5h-7h = 1h ngủ + 1h thức, khớp tổng 2 đoạn tách riêng).

## Kết quả kiểm tra (bắt buộc trước khi báo xong)
- `npx tsc --noEmit` → sạch (exit 0).
- `npx jest` → **133 test PASS / 13 suite** (suite mới `satietyEngine.test.ts` đóng góp 24 test;
  phần chênh còn lại so với con số 103/12 ghi trong CONTEXT.md Session 10 là do các gói khác đã
  làm xong trong working tree nhưng chưa commit lúc ghi dòng đó, không phải do gói S-O).
- `npx expo export --platform ios` → OK, **1428 module** (tăng từ 1426 do 2 file mới:
  `satietyEngine.ts` + `types/satiety.ts`).

## Rà soát đóng phiên (2026-07-04)
- **Phạm vi file:** kiểm tra lại bằng `git diff` — phiên này chỉ tạo 3 file mới (satietyEngine.ts
  + test + types/satiety.ts) và thêm đúng 23 dòng (4 hằng số) vào `metabolicConstants.ts`. Các
  file khác đang modified trong working tree là của **S-M (chưa commit)** và **S-P (phiên song
  song, đã thấy `weightGoal.ts`/`weightGoalConstants.ts` xuất hiện)** — không phải của S-O.
- **Kiểm tra lại sau khi S-P đổ file vào cây:** `tsc` sạch · `jest` **144 PASS / 14 suite**
  (gồm cả suite weightGoal của S-P — cũng xanh) · `npm run verify` chỉ còn đúng **2 lint error
  tồn đọng của gói L-1** (`useDrainTick.ts`, `HistoryScreen.tsx`) — không lỗi nào trong file S-O.
- **Soát lỗi tiềm ẩn:** không thấy lỗi logic. Ba lưu ý chuyển cho S-Q ghi ở mục dưới.

## ⚠️ Lưu ý BẮT BUỘC cho người làm S-Q (tránh lỗi tích hợp)
1. **Đừng cộng dồn drain theo tick nhỏ.** `circadianBurnKcal` làm tròn ra kcal nguyên — gọi mỗi
   giây rồi trừ dần sẽ luôn ra 0 và pin không bao giờ tụt. Phải tính từ **mốc neo lưu bền**
   (`lastSatietySyncAt` → `Date.now()`) mỗi lần cập nhật, giống pattern `lastDrainSyncAt` trong
   `useLiveEnergyReading.ts` hiện tại.
2. **`satietyPercentage` trả số thập phân** (vd 46.64) — UI tự `Math.round` khi hiển thị.
3. Với bộ số đã chốt (CAP=1000, sàn=20%): ăn 900 kcal lúc đói → 92% (khớp "~90-95%" của spec);
   ăn 600 kcal → 68%. Minh hoạ "600-900 → 90-95%" trong spec chỉ đúng ở cận trên — hệ quả của
   bộ số người dùng chọn, không phải bug.
4. (Nhỏ) Khung thức/ngủ tính theo **giờ đồng hồ địa phương** của máy — Việt Nam không có DST nên
   không sao; nếu sau này hỗ trợ múi giờ có DST thì ngày chuyển giờ sẽ dài/ngắn hơn 1h (chấp nhận).

## Việc còn lại (không thuộc gói này)
- **S-P** (mục tiêu cân nặng → kcal an toàn) — song song, file rời, chưa đụng gì của S-O.
- **S-Q** (lắp ráp) sẽ cần: lưu `reserveKcal` bền (đề xuất thêm cột/kiểu mới trong
  `types/battery.ts`, KHÔNG tái dùng `BatteryReading.date`-scoped vì reserve liên tục không
  reset ngày), gọi `applyCircadianDrain` mỗi ~20 phút/khi mở app (tương tự cách `S-K` từng định
  gọi `burnPassive` trong `tickDrain`/`useLiveEnergyReading`), gọi `eatIntoReserve` khi log món ăn,
  `drainFromWorkout` khi ghi buổi tập, và `satietyPercentage` để hiển thị pin chính.
- Chưa test trên máy thật (không thuộc phạm vi S-O — S-O chỉ là engine thuần, không có UI).

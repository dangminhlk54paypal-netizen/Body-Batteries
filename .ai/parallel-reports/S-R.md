# S-R — Báo cáo: Pin vi chất (micronutrient batteries) từ nhật ký món

**Ngày:** 2026-07-04. **Agent:** logic-backend + mobile-frontend (1 phiên).

## Đã chốt với người dùng trước khi code (đổi so với spec gốc)

Spec gốc: `.ai/parallel-reports/S-R-micronutrient-batteries-spec.md`. Qua trao đổi trực tiếp (không
mở app cùng lúc — chỉ xác nhận qua mô tả/mockup), người dùng chốt 4 điểm khác spec:

1. **Mốc tham khảo theo giới/tuổi** (không dùng số cố định chung) — dùng `UserProfile.sex`/`age`
   đã có sẵn.
2. **Có lịch sử 7 ngày** — khả thi mà KHÔNG cần đổi schema/DB, vì `food_log` đã lưu vĩnh viễn
   `foodId+grams` trong đúng `DATA_RETENTION_DAYS=7` ngày và `getFoodLogInRange` đã có sẵn.
3. **Vitamin (A, B12, B9, C, D) HOÃN LẠI** — dữ liệu không tồn tại cho 73 món Việt (`food_items.csv`
   không có cột vitamin nào; chỉ 363 nguyên liệu thô Mỹ trong USDA JSON gốc mới có, nếu trích lại).
   Làm ngay sẽ khiến hầu hết pin hiện "chưa có dữ liệu" cho người dùng thật — cần một gói tra cứu
   dinh dưỡng thật cho món Việt trước (giống S-N), CHƯA làm ở đây.
4. **Bỏ Protein/Carbs/Calo khỏi dàn pin mới** — đã có pin riêng trên Home tính theo capacity-Mode
   (khác semantics RDA), tránh 2 con số khác nhau cho cùng 1 tên. Thay bằng **Chất béo** (mới).

Toàn bộ quá trình xác nhận (bao gồm phát hiện xung đột ranh giới file khi mở rộng phạm vi) ở trong
lịch sử chat của phiên — không lặp lại ở đây.

## Danh sách pin cuối cùng

- **Goal-type** (nạp cho đủ), nổi bật: Chất xơ, Sắt, Canxi, Chất béo. "Xem thêm": Kali, Magie, Kẽm.
- **Limit-type** (giữ ngưỡng): Natri (muối), Đường.
- Mốc lấy theo `sex` × 2 khung tuổi (19–50 / 51+) — bảng đầy đủ trong
  `src/lib/nutrientTargets.ts` (nguồn: DRI/IOM/WHO, làm tròn, ghi rõ "chỉ tham khảo").

## File đã tạo / sửa

**Mới:**
- `src/types/nutrition.ts` — `MicronutrientId`, `NutrientKind`, `NutrientTarget`, `MicroBatteryState`.
- `src/lib/nutrientTargets.ts` — bảng mốc theo giới/tuổi + `nutrientTargetsForProfile()` +
  `PROMINENT_GOAL_IDS`/`MORE_GOAL_IDS`/`LIMIT_IDS`.
- `src/domain/nutrition/microBatteryEngine.ts` (+ `__tests__/microBatteryEngine.test.ts`, 6 test) —
  hàm thuần `computeMicroBatteries(entries, lookup, targets)`.
- `src/hooks/useMicroBatteryHistory.ts` — quản lý ngày đang chọn (7 ngày gần nhất), đọc `foodLog`
  (hôm nay) hoặc gọi `getFoodLogInRange` (ngày cũ, chỉ ĐỌC), chạy qua engine.
- `src/components/MicroBatteryStack.tsx` — UI 2 nhóm (goal nổi bật + Xem thêm, limit riêng) + hàng
  chọn ngày + "Chỉ để tham khảo." Cell hiển thị RIÊNG (không dùng `BatteryCell.tsx` — xem lý do dưới).

**Sửa (1 chỗ chèn):**
- `src/screens/HomeScreen.tsx` — thêm `userProfile` vào destructure `useSettingsStore()`, gọi
  `useMicroBatteryHistory`, chèn `<MicroBatteryStack>` giữa `BatteryStack` và `TodayMeals`.

**Chỉ ĐỌC (không sửa):** `dateUtils.ts`, `settingsStore.ts`, `foodDatabase.ts` (`getFoodById`),
`data/repositories/foodLogRepository.ts` (`getFoodLogInRange`), `energyStore.ts` (`foodLog`).

**Không đụng:** `energyStore.ts`, `satietyEngine.ts`, `weightGoal.ts`, `MasterBattery`/
`LiveMasterBattery.tsx`, `types/battery.ts` (không mở rộng `BatteryId`), DB schema/repositories
(chỉ gọi hàm đọc có sẵn), `FoodLogModal.tsx`, `BatteryCell.tsx`.

## Phát hiện quan trọng — không tái dùng `BatteryCell.tsx` nguyên bản

`BatteryCell.tsx` tự tô đỏ/vàng khi % thấp (`percentage > 50 ? color : ... : '#FF4757'`) — vi phạm
ranh giới sức khoẻ bắt buộc ("dưới mốc = còn trống, trung tính, KHÔNG đỏ"). Sửa file đó sẽ đổi màu
cả 6 pin hiện có. Giải pháp: cell hiển thị riêng bên trong `MicroBatteryStack.tsx`, cùng hình dạng
SVG nhưng luôn dùng đúng 1 màu cố định theo chất (không auto-tint theo %); limit-type có thêm dòng
caption nhẹ "vượt ngưỡng gợi ý" / "trong ngưỡng" thay vì đổi màu.

## Xong khi (đã chạy được)

- `npx tsc --noEmit` → sạch (exit 0).
- `npx jest` → **155/155 PASS**, 15 suite (thêm 1 suite mới, 6 test).
- `npx expo export --platform ios` → OK, **1435 module** (tăng từ trước).
- **CHƯA test trên máy thật** — cần mở app cùng người dùng để xác nhận: ghi món → pin nạp đúng
  hướng; dưới mốc hiện % trung tính; vượt mốc muối/đường hiện "vượt ngưỡng gợi ý" trung tính; chọn
  lại ngày cũ (trong 7 ngày) → đúng dữ liệu ngày đó; sang ngày mới → hôm nay reset về 0.

## Việc còn treo cho phiên sau

- **Vitamin (A, B12, B9, C, D):** cần gói riêng — trước tiên phải tra cứu dinh dưỡng thật cho món
  Việt (không thể trích từ USDA JSON vì đó là nguyên liệu Mỹ, không phải món ăn Việt), rồi mới thêm
  cột vào `food_items.csv` + `Nutrition` type + engine. Không làm trong S-R.
- Cân nhắc bổ sung UI test/thao tác tay xác nhận màu sắc thực tế trên máy (chưa mở app cùng người
  dùng ở phiên này).

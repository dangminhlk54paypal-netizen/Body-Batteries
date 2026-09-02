# Kế hoạch — Phản hồi trải nghiệm thực tế (2026-09-01)

> **Trạng thái: W1–W4 ĐÃ LÀM XONG** (`npm run verify` 586/586 pass, bundle iOS OK).
> Còn lại: người dùng test trên máy thật — checklist ở `.ai/SESSION_LOG.md` Session 24.

Nguồn: 4 điểm người dùng phản ánh sau khi dùng app thật.
Nhánh: `ui-upgrade`. Stack cố định Expo SDK 54. Mọi text UI đi qua `useT()` + 3 locale.

---

## W1 — Bug pin vi chất đường/canxi (ưu tiên cao nhất)

### Chẩn đoán
Pin vi chất được tính LIVE từ `foodLog` (`useMicroBatteryHistory` → `computeMicroBatteries`),
không có snapshot → tổng chỉ sai khi CHÍNH `foodLog` có mục thừa. Hai nguồn sinh mục thừa:

1. **Trùng ID (gốc).** `energyStore.logFood` đặt `id = food_${timestamp}_${item.id}`, còn
   `FoodLogModal.timestampForToday()` cắt giây+ms → ghi cùng món 2 lần trong cùng 1 phút =
   trùng ID tuyệt đối. `addFoodLogEntry` dùng `INSERT INTO` (không OR REPLACE) trên
   `id TEXT PRIMARY KEY` → ném UNIQUE constraint, bị `console.warn` nuốt. Hệ quả: pin đã cộng
   2 lần VÀ đã `upsertReadings` (chạy trước khi insert ném), nhưng food_log chỉ có 1 dòng.
   Mở lại app → danh sách ít hơn số pin đã cộng.
2. **Chip TPCN không chống bấm kép.** `SupplementQuickLog` gọi `logFood` thẳng trong onPress,
   không có guard kiểu `savingFood` của FoodLogModal.

### Sửa
- `src/store/energyStore.ts` — id duy nhất: `food_${timestamp}_${item.id}_${rand}`
  (cùng cách `buildCustomFoodItem` đã chống va chạm). Áp cho cả `logFoodForPastDate`.
- `src/data/repositories/foodLogRepository.ts` — `INSERT OR REPLACE` để không còn ném âm thầm.
- `src/store/energyStore.ts` — nếu `addFoodLogEntry` thất bại thì HOÀN TÁC phần đã cộng pin
  thay vì để pin lệch so với nhật ký (hiện chỉ `console.warn`).
- `src/components/SupplementQuickLog.tsx` — guard chống bấm kép; `countToday` cộng `count`
  (số liều) chứ không đếm số dòng; thay `item.nameVi` cứng bằng `foodDisplayName(item, language)`.
- `src/domain/nutrition/microBatteryEngine.ts` — `microBatterySourceRows` gộp theo `foodId`,
  trả thêm khẩu phần (grams + count + đơn vị) và làm tròn sao cho **tổng các dòng = tổng footer**.
- `src/components/MicroBatterySourceSheet.tsx` — hiện khẩu phần trên mỗi dòng; dùng
  `foodLogEntryDisplayName` thay `entry.foodNameVi` (luật i18n).
- Test: `microBatteryEngine.test.ts` (gộp dòng, tổng khớp), test id duy nhất.

---

## W2 — Đơn vị đo (g/ml) + nhãn khẩu phần tự do  [phản ánh #1]

Ví dụ mục tiêu: Yakult 65ml, nhãn dinh dưỡng ghi cho ĐÚNG 1 hộp 65ml.

### Mô hình dữ liệu (mở rộng, không phá cái cũ)
`PortionUnit` hiện là `'gram' | 'pack' | 'capsule'` → giữ nguyên để tương thích ngược,
thêm `'serving'` cho khẩu phần đặt tên tự do. Thêm vào `FoodItem`:
- `measureUnit?: 'g' | 'ml'` — khuyết = `'g'` (hành vi cũ)
- `servingSize?: number` — kích cỡ 1 khẩu phần theo `measureUnit` (65)
- `servingLabel?: string` — nhãn người dùng gõ: hộp / gói / chai / lon / ly / muỗng / khẩu phần
- `servingWeightG` giữ nguyên vai trò: khối lượng quy đổi thật của 1 khẩu phần (canonical).
  Với ml dùng quy ước **1 ml ≈ 1 g**, nói rõ trong UI, cho ô ghi đè khối lượng thật.

### Điểm nối BẮT BUỘC vá cùng lúc (nếu quên 1 chỗ → override/sửa món hỏng âm thầm)
1. `src/data/food/foodLookup.ts` — nhánh merge override
2. `src/components/FoodNutritionEditModal.tsx` — nhánh `mode === 'edit'`
3. mappers + schema + migration: `customFoodMapper.ts`, `foodOverrideMapper.ts`,
   `foodLogRepository.ts`, `db/schema.ts` (`*_MIGRATION_COLUMNS`), `db/database.ts`

### Còn lại
- `src/domain/food/customFoodInput.ts` — field mới + quy đổi per-serving ↔ per-100g
- `src/components/food/CustomFoodFields.tsx` — chọn g/ml, gõ nhãn, nhập kích cỡ khẩu phần
- `src/components/FoodLogModal.tsx` — nhãn đếm theo `servingLabel`
- `src/components/TodayMeals.tsx` + `food/NutritionDetailSheet.tsx` — `amountLabel` theo nhãn
- 3 locale + test `customFoodInput.test.ts`, `foodNutrition.test.ts`

---

## W3 — "Món của tôi" trên thiết bị  [phản ánh #2]

Đã có sẵn: bảng `custom_foods` + `food_overrides` trong SQLite. Thiếu quyền kiểm soát.
- `customFoodsRepository.ts` + `customFoodRegistry.ts` — thêm `deleteCustomFood` (hiện KHÔNG có)
- Màn hình/sheet "Món của tôi": liệt kê món tự tạo + món đã sửa, sửa lại, xoá,
  cảnh báo khi món đang được nhật ký tham chiếu
- Xuất/nhập file JSON danh sách món (dùng lại `expo-file-system/legacy` + `expo-sharing`
  đã có trong `excelExportService`), có validate khi nhập
- `foodSearch.ts` / `FoodLogModal.tsx` — huy hiệu nguồn (Của tôi / VN / USDA), ưu tiên "Của tôi"

---

## W4 — Minh bạch công thức: nút ⓘ tại từng pin  [phản ánh #3]

Bám đúng pattern đã có (`bodyProfileCard.tdeeBreakdown` / `goalBreakdown`).
- Domain thuần mới `src/domain/nutrition/nutritionBreakdown.ts`: dựng từng bước
  `per-100g × gram ÷ 100 = đóng góp` cho mỗi món, rồi phép cộng dồn ra tổng, so mục tiêu.
- ⓘ trên `MicroBatteryStack.MicroCell` và `BatteryCell` → mở sheet giải thích.
- Nêu rõ cả quy ước ngầm: muối = natri × 2.5 ÷ 1000; carb TỔNG đã chứa đường + xơ;
  mốc reset 6h sáng của pin năng lượng vs ngày lịch của pin vi chất.
- 3 locale.

---

## Luật chung mọi wave
- Không hardcode text UI; thêm key vào `vi.ts` trước rồi mirror `en.ts` / `de.ts`.
- Domain nhận `language: Language` tường minh, không đọc store.
- Chốt mỗi wave bằng `npm run verify` (typecheck + lint + test) trước khi báo xong.

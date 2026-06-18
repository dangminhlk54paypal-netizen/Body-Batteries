# 07 — Nhật ký bữa ăn theo món (Food Log)

> Nạp năng lượng/dưỡng chất bằng cách **chọn món có sẵn** thay vì nhập tay kcal.
> Nguồn dữ liệu món ăn là `food_items.csv` (mọi giá trị tính trên **100 g**).
>
> ⚠️ Công cụ tự theo dõi, **không phải thiết bị y tế** — số liệu là ước lượng chung.

---

## 1. Luồng người dùng
Màn hình chính → nút **🍱 Ghi món ăn (từ danh sách)** → modal 2 bước:
1. **Tìm món**: ô search lọc theo `name_vi` / `name_en` / `category`.
2. **Nhập chi tiết**: số gram (gõ tay hoặc chọn nhanh theo `serving_presets` /
   "mặc định"), **giờ ăn** (mặc định = giờ hiện tại, sửa được để ghi nhận trễ).
   App tự suy **loại bữa** từ giờ và hiện trước **kcal + đạm/tinh bột/béo**.

Hai nút cũ (**🍽️ Ăn thêm kcal**, **🏃 Vận động**) **vẫn giữ** — Food Log là cách
nạp bổ sung khi món đã có trong CSV.

## 2. Khung giờ → loại bữa (v1, hard-code)
`DEFAULT_MEAL_WINDOWS` trong `src/lib/constants.ts`, cửa sổ nửa mở `[start, end)`:
- Bữa sáng `5–10h` · Bữa trưa `10–14h` · Bữa tối `17–21h` · ngoài ra = **Bữa phụ**.
- *Sau:* thêm form sửa khung giờ trong **Cài đặt** (chưa làm).

## 3. Tính dinh dưỡng & nạp pin
`nutritionForGrams(item, grams)` (`src/domain/food/foodNutrition.ts`, thuần, có test)
= `per100g × gram/100`. Khi ghi món (`energyStore.logFood`):
- **Pin Năng lượng** += `energy_kcal` thật của món (đã gồm chất béo 9 kcal/g) —
  **không** suy lại 4 kcal/g từ macro nên **không bị đếm trùng** (khác với
  `addIntake` của các pin nhỏ).
- **Pin dinh dưỡng**: Protein += đạm, Carbs += tinh bột, Nước += `water_g` (≈ ml),
  Khoáng chất += tổng thô các khoáng (mg) — ước lượng thô cho pin "Khoáng chất".

## 3b. Xem lại món đã ăn hôm nay ("Hôm nay đã ăn")
Khu vực trên Home (dưới các pin nhỏ) — `src/components/TodayMeals.tsx`:
- **Tổng kcal/ngày** + phân bổ đạm/tinh bột/béo ở đầu mục.
- Món **nhóm theo bữa** (sáng/trưa/tối/phụ), mỗi bữa có tổng kcal; từng món hiện
  giờ ăn · gram · kcal.
- Nút **✕** để xoá món ghi nhầm → có hộp xác nhận; khi xoá, store `removeFood`
  **hoàn lại** phần đã nạp cho pin Năng lượng + các pin dinh dưỡng.
- Logic gom nhóm/tổng là hàm thuần `summarizeFoodLog` (`src/domain/food/`, có test).
- State `foodLog` của hôm nay nằm trong `energyStore` (nạp trong `loadToday`, thêm
  khi `logFood`, xoá khi `removeFood`, làm rỗng khi `resetForNewDay`).
- *Giới hạn:* hoàn pin theo kiểu trừ-có-chặn (clamp), nên nếu lúc nạp đã tràn trần
  pin thì hoàn lại chỉ gần đúng — chấp nhận được với công cụ ước lượng.

## 3c. Pin Năng lượng xả mượt theo giây
`src/hooks/useLiveEnergyReading.ts` + `src/components/LiveMasterBattery.tsx`
(dùng ở `HomeScreen` thay cho `MasterBattery` render tĩnh):
- Mỗi giây tính lại `percentage`/`levelKcal` **chỉ để hiển thị**, bằng cách lấy
  reading đã lưu (`readings`) và ngoại suy thêm phần xả từ lúc `lastDrainSyncAt`
  (đồng hồ thật, dùng đúng `burnPassive` thuần — không thêm logic mới).
- **Không** ghi state/DB mỗi giây — `tickDrain` (`useDrainTick.ts`, 30 phút/khi
  resume) vẫn là nguồn xả thật duy nhất được lưu; `lastDrainSyncAt` cập nhật lại
  mỗi khi `loadToday` / `tickDrain` / `resetForNewDay` chạy nên không đếm trùng.
- Tạm dừng interval khi app ở background (`AppState`), giống `useDrainTick.ts`.

## 4. Lưu trữ & Excel
- Bảng `food_log` (`schema.ts` + `data/repositories/foodLogRepository.ts`) lưu
  từng bản ghi đầy đủ (món, gram, giờ, loại bữa, kcal, macro, nước, khoáng).
- Excel export thêm sheet **"Food Log"** (`excelExportService.ts`).
- Bị **xoá theo cơ chế giữ 7 ngày** như dữ liệu khác (`cleanupService.ts`).

## 5. Nguồn dữ liệu món ăn — `food_items.csv`
- CSV là **nguồn gốc duy nhất**; thêm món = thêm dòng vào CSV (không hard-code).
- `scripts/generate-food-db.js` nhúng CSV thô vào
  `src/data/food/foodDatabase.generated.ts`; `foodCsv.ts` (parser thuần, có test)
  dựng ra `FOOD_ITEMS`. Cách này chạy giống nhau trên native / web / jest, không
  cần `expo-asset` hay đọc file lúc chạy.
- **Sau khi sửa CSV**: chạy `npm run gen:food` (đã tự chạy trước `npm start` /
  `android` / `ios` / `web`). Đang chạy Metro thì **khởi động lại** để nạp lại.

## 6. File liên quan
- `src/types/food.ts` — `FoodItem`, `FoodLogEntry`, `MealType`, `Nutrition`.
- `src/data/food/` — `foodCsv.ts`, `foodDatabase.ts`, `foodDatabase.generated.ts`.
- `src/domain/food/foodNutrition.ts` — tính dinh dưỡng + suy loại bữa.
- `src/domain/food/foodLogSummary.ts` — gom nhóm theo bữa + tổng ngày.
- `src/components/FoodLogModal.tsx` — UI ghi món; `TodayMeals.tsx` — xem/xoá món.
  Nút "Ghi món ăn" trong `EnergyActionsBar.tsx`; "Hôm nay đã ăn" trong `HomeScreen.tsx`.
- `src/components/LiveMasterBattery.tsx` + `src/hooks/useLiveEnergyReading.ts` —
  hiển thị pin Năng lượng xả mượt theo giây (display-only).
- `src/store/energyStore.ts` — action `logFood` / `removeFood` + state `foodLog`,
  `lastDrainSyncAt` (mốc đồng bộ xả thật gần nhất).
- Test: `foodCsv.test.ts`, `foodDatabase.test.ts`, `foodNutrition.test.ts`,
  `foodLogSummary.test.ts`.

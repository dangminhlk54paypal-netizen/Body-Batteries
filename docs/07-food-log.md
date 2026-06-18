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
- `src/components/FoodLogModal.tsx` — UI; nút trong `EnergyActionsBar.tsx`.
- `src/store/energyStore.ts` — action `logFood`.
- Test: `foodCsv.test.ts`, `foodDatabase.test.ts`, `foodNutrition.test.ts`.

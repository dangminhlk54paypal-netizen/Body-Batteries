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

## 3a. Đơn vị đo & đơn vị khẩu phần (Session 24)
Nhãn dinh dưỡng thật không phải lúc nào cũng ghi cho 100 g: một hộp Yakult 65 ml ghi
cho **đúng 1 hộp 65 ml**. Nên `FoodItem` tách bạch **hai câu hỏi khác nhau**:

| Trường | Ý nghĩa | Giá trị |
|---|---|---|
| `measureUnit` | Món này **đo** bằng gì | `'g'` \| `'ml'` (khuyết = `'g'`) |
| `portionUnit` | Món này **đếm** theo gì | `'gram'` \| `'pack'` \| `'capsule'` \| `'serving'` |
| `servingLabel` | Tên 1 khẩu phần, chỉ khi `'serving'` | do người dùng gõ: hộp, chai, lon, ly… |
| `servingWeightG` | Kích cỡ 1 khẩu phần | số, **đọc theo `measureUnit`** |

- **Engine không đổi:** mọi tính toán vẫn chạy bằng gram và `per100g`. Quy ước
  **1 ml ≈ 1 g** (đúng trong vài % với nước/nước ép/sữa/sữa chua uống — đủ cho công
  cụ tự theo dõi), được nói rõ ngay trong form. `measureUnit` **chỉ đổi nhãn**.
- **`'pack'`/`'capsule'` giữ nguyên** thay vì gộp vào `'serving'` + nhãn: hai đơn vị
  này có bản dịch sẵn cho cả 3 ngôn ngữ, còn `servingLabel` là dữ liệu người dùng gõ
  nên chỉ có một cách viết duy nhất.
- **Nguồn duy nhất sinh nhãn:** `src/domain/food/portionUnits.ts` (thuần, có test) —
  `formatLoggedPortion` → "2 hộp (130ml)" / "150g"; `nutritionBasisLabel` → "1 hộp" /
  "100ml". Mọi màn hình hiện khẩu phần đều gọi qua đây, không tự viết lại.
- **⚠️ 3 điểm nối bắt buộc khi thêm field mới cho `FoodItem`** (quên 1 chỗ là
  override/sửa món hỏng âm thầm): merge trong `getAnyFoodById`; nhánh
  `mode === 'edit'` của `FoodNutritionEditModal`; mappers + `schema.ts` +
  migration ALTER trong `database.ts`.

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

## 3b-2. Chia sẻ nhật ký ăn uống dưới dạng ảnh (Session 25)
Nút ⤴ cạnh tổng kcal trong `TodayMeals.tsx` → xuất **toàn bộ** nhật ký hôm nay
(không chỉ phần đang hiện trên màn hình) thành 1 ảnh PNG rồi mở share sheet của
hệ điều hành.

- **Vì sao không dùng chụp màn hình thường:** `TodayMeals` nằm trong 1
  `ScrollView` — ăn nhiều món thì phải cuộn mới thấy hết, và ảnh chụp màn hình
  gốc chỉ lấy đúng phần đang hiển thị. Giải pháp: dựng riêng một bản sao
  **không cuộn, cao tự do** của cùng dữ liệu, đặt ở toạ độ âm ngoài canvas
  (`position: 'absolute', top: -100000`) để không ai nhìn thấy, rồi chụp
  NGUYÊN view đó bằng `captureRef` (thư viện `react-native-view-shot`,
  `captureRef` chụp full nội dung view bất kể có đang cuộn tới hay không —
  khác hẳn `captureScreen`, cái đó chỉ lấy đúng pixel đang hiện trên màn hình).
- **`react-native-view-shot@4.0.3`** — đúng bản được đóng gói sẵn trong chính
  Expo Go của SDK 54 (`npx expo install` tự chọn đúng bản này), nên chạy được
  ngay trên điện thoại test qua Expo Go, không cần dev-client/build lại.
- `src/components/food/ShareDayFoodCard.tsx` — layout riêng cho ảnh chia sẻ
  (không phải chụp lại `TodayMeals`): tổng quan (kcal + đạm/carbs/béo) rồi từng
  bữa/món đầy đủ. Dùng màu cố định `darkColors` (không theo theme sáng/tối
  người dùng đang chọn) để ảnh ra ngoài luôn đúng nhận diện thương hiệu.
- `src/services/share/dayFoodShareService.ts` — `shareTodayFoodCard(ref, language)`
  gọi `captureRef` rồi `Sharing.shareAsync` (cùng pattern `exportDataInRange`
  trong `excelExportService.ts` đã dùng).
- `collapsable={false}` trên view bị chụp — bắt buộc trên Android, nếu không
  RN có thể tối ưu bỏ hẳn node đó khỏi cây view gốc (không còn gì để chụp).

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

## 4b. "Món của tôi" — danh sách trên máy (Session 24)
CSV chỉ là **điểm khởi đầu**, không phải toàn bộ catalog. Phần làm app dùng được cho
một người là những món **chính họ nhập**, và phần đó chỉ sống trong SQLite của máy đó.

- Bảng `custom_foods` (món tự thêm) + `food_overrides` (sửa thành phần món catalog).
- **Cài đặt → Dữ liệu → "Món của tôi"** (`src/components/food/MyFoodsSheet.tsx`):
  xem / sửa / **xoá** — trước Session 24 hoàn toàn không có đường xoá món tự thêm.
- **Xoá không viết lại lịch sử:** dòng `food_log` giữ dinh dưỡng đã snapshot và tên
  `foodNameVi` đã đóng băng, nên bữa đã ghi không đổi.
- **Xuất/nhập JSON** — `src/domain/food/myFoodsBackup.ts` (thuần, có test: từ chối
  sai version, ép kiểu chống NaN, giữ bất biến carb ≥ đường + xơ) +
  `src/services/food/myFoodsBackupService.ts`.
  **Không thêm dependency:** xuất ghi vào `documentDirectory` + share sheet; nhập
  liệt kê file `.json` trong chính thư mục đó (người dùng chép file vào qua app
  Files) — thay vì thêm `expo-document-picker`.
- Kết quả tìm kiếm có huy hiệu nguồn: **Của tôi / Catalog VN / USDA** (+ "đã sửa"),
  phân loại bởi `src/domain/food/foodSource.ts`.

## 4c. Minh bạch công thức (Session 24)
Người dùng phải kiểm tra được mọi con số, không phải tin suông:
- **Pin vi chất** — chạm ô pin (có glyph ⓘ) → `MicroBatterySourceSheet`. Các dòng
  **gộp theo món** ("Whey protein ×3", kèm khẩu phần) chứ không phải mỗi lần ghi một
  dòng, và phần dư làm tròn được chia theo **largest-remainder** để **tổng các dòng
  luôn khớp đúng con số trên ô pin**. Mục gập "🧮 Xem cách tính" hiện từng phép
  `6g/100g × 60g ÷ 100 = 3.6g`, dòng cộng dồn, so với khuyến nghị, kèm ghi chú riêng
  (muối = natri × 2.5 ÷ 1000; omega-3 = EPA + DHA; đường nằm TRONG carbs).
- **Pin chính** — `BatterySourceSheet` có mục tương tự, nêu rõ khác biệt dễ tưởng là
  bug: số pin chính **chốt lúc ghi món**, còn pin vi chất **tính lại mỗi lần mở app**
  — nên sửa thành phần một món làm đổi pin vi chất mà không đổi bữa đã ghi.
- Mốc ngày cũng được nói rõ: pin vi chất theo **ngày lịch**, pin Năng lượng **reset
  6h sáng**.

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
- `src/domain/food/portionUnits.ts` — nguồn duy nhất sinh nhãn đơn vị/khẩu phần.
- `src/domain/food/myFoodsBackup.ts` + `src/services/food/myFoodsBackupService.ts` —
  xuất/nhập danh sách món của người dùng.
- `src/domain/food/foodSource.ts` — phân loại nguồn món (của tôi / catalog / USDA).
- `src/components/food/MyFoodsSheet.tsx` — quản lý "Món của tôi".
- `src/domain/food/foodLogSummary.ts` — gom nhóm theo bữa + tổng ngày.
- `src/components/food/ShareDayFoodCard.tsx` + `src/services/share/dayFoodShareService.ts` —
  xuất nhật ký ăn uống hôm nay thành ảnh PNG để chia sẻ (nút ⤴ trong `TodayMeals.tsx`).
- `src/components/FoodLogModal.tsx` — UI ghi món; `TodayMeals.tsx` — xem/xoá món.
  Nút "Ghi món ăn" trong `EnergyActionsBar.tsx`; "Hôm nay đã ăn" trong `HomeScreen.tsx`.
- `src/components/LiveMasterBattery.tsx` + `src/hooks/useLiveEnergyReading.ts` —
  hiển thị pin Năng lượng xả mượt theo giây (display-only).
- `src/store/energyStore.ts` — action `logFood` / `removeFood` + state `foodLog`,
  `lastDrainSyncAt` (mốc đồng bộ xả thật gần nhất).
- Test: `foodCsv.test.ts`, `foodDatabase.test.ts`, `foodNutrition.test.ts`,
  `foodLogSummary.test.ts`, `portionUnits.test.ts`, `myFoodsBackup.test.ts`,
  `foodSource.test.ts`, `customFoodInput.test.ts`.

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

## 3a-2. Nhập dinh dưỡng theo 100 g **hoặc** theo khẩu phần (Session 30)
Form "Thêm món mới" / "Sửa thành phần" (`CustomFoodFields.tsx`, dùng chung cho
`FoodLogModal` + `FoodNutritionEditModal`) từng gộp 2 câu hỏi thành 1: chip đơn vị
(gram/gói/viên/khẩu phần) **cũng ngầm quyết định** số gõ vào là /100 g hay /1 khẩu phần.
Nay tách riêng — thêm chip **"Nhập dinh dưỡng theo: [100g] [1 khẩu phần (350g)]"**:

- `NutritionBasis = 'per100' | 'perServing'` — **chỉ tồn tại trong form, KHÔNG lưu DB,
  KHÔNG thêm field vào `FoodItem`** (tránh 3 điểm nối ở mục 3a). Lưu trữ vẫn chỉ là
  `per100g`; `buildCustomFoodItem` quy đổi khi lưu. Trực giao với `portionUnit`: món cân
  gram nhập được theo khẩu phần ("1 tô phở 350 g = 450 kcal"), món đếm theo hộp nhập
  được theo /100 ml (đúng như nhãn).
- **Mốc khẩu phần** (`servingSizeOf`): món gram → `defaultServingG`; món đếm →
  `servingWeightG`. Trả 0 nếu trống — quy đổi **không bao giờ đoán** 100 (khác với
  fallback hiển thị của `buildCustomFoodItem`).
- **Đổi chế độ = quy đổi, không xoá** (`changeNutritionBasis`: ×size/100 hoặc ×100/size,
  làm tròn 6 chữ số có nghĩa để không hiện đuôi số thực). Chưa có mốc khẩu phần → xoá
  các ô (không đoán). **Đổi chip đơn vị cũng không xoá số nữa** (`changePortionUnit`,
  thay `resetNutritionForUnitChange` của FIX #1 cũ — vốn chỉ cần khi đơn vị ngầm quyết
  định thang đo); nó mang mốc khẩu phần sang ô tương ứng, và — **chỉ khi chưa gõ số nào**
  — đặt basis mặc định theo đơn vị (đếm → theo khẩu phần, cân → theo 100 g) để luồng TPCN
  cũ ("Viên = số theo viên") không đọc nhầm 9 kcal/viên thành 9 kcal/100 g. Đã gõ số thì
  basis giữ nguyên.
- **Ô xem trước** (`nutritionPreview`): cùng món trên thang đo còn lại — nhập /100 g thì
  hiện "≈ 1 khẩu phần (350g): 450 kcal · Đạm… · Béo… · Carbs…", nhập theo khẩu phần thì
  hiện "≈ Mỗi 100g: …". Dùng chung `enteredNutritionOf` với `buildCustomFoodItem` nên số
  xem trước = số sẽ lưu (kể cả luật carb ≥ đường + xơ, áp trên số gõ vào, TRƯỚC quy đổi).
- **Validate:** nhập theo khẩu phần bắt buộc mốc khẩu phần > 0 (nút Lưu mờ + dòng nhắc);
  luật cũ "món đếm cần `servingWeightG` > 0" giữ nguyên.
- **Mở lại để sửa:** chế độ được **suy ra** (`inputFromFoodItem`) — món đếm mở ở
  "theo khẩu phần" (đúng số người dùng gõ ban đầu, vd 610 mg/viên), món gram ở
  "theo 100 g" — vì không lưu basis. Đổi qua lại 1 chạm không mất dữ liệu.
- Mọi sửa form đi qua `applyCustomFoodChange` (cả 2 modal dùng chung, không tự viết lại).
- Chữ hiển thị: `components.customFoodFields.basis*` / `preview*` (vi/en/de); nhãn
  hậu tố/phụ đề dùng `formBasisLabel` ("100g" / "1 hộp" / "1 khẩu phần").
  Ngoài phạm vi: lưu basis vào `FoodItem` để món gram mở lại đúng chế độ đã nhập.

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
  bữa/món đầy đủ. Màu theo chủ đề sáng/tối người dùng đang chọn
  (`useThemedStyles`) — app sáng thì ảnh nền sáng, app tối thì ảnh nền tối
  (Session 35; trước đó cố định `darkColors`).
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

## 3d. Giờ ăn quyết định hiệu ứng lên pin (Session 31)
- Giờ bạn chọn ở ô **"Giờ ăn"** không chỉ để gắn nhãn bữa: pin no/đói và các pin đạm/tinh bột/nước/khoáng
  được tính theo **giờ đã ăn**, không phải giờ bấm ghi. Ghi bữa trưa lúc 22:30 (chọn giờ ăn 12:00) sẽ
  không làm pin nhảy lên đầy — nó đã "tiêu hao" từ 12:00.
- **Sổ kcal "đã ăn X / mục tiêu Y" vẫn cộng đủ** kcal của bữa ghi muộn (không phụ thuộc thời gian).
- **Chặn giờ ăn ở tương lai** (hôm nay): nút "Ghi món" tắt và hiện dòng lỗi. Ghi sớm hơn hiện tại ≥ 30
  phút thì hiện gợi ý "Pin no/đói sẽ tính từ lúc HH:MM, không phải lúc ghi." (i18n vi/en/de:
  `components.foodLogModal.futureTimeError` / `lateLogHint`).
- Xoá một bữa ăn cũ chỉ bớt đúng phần còn lại của nó trong pin (không trừ toàn bộ kcal).
- Bữa ghi bù cho đêm qua (trong 48h) cũng được tính vào pin no/đói theo giờ ăn của nó.
- Kỹ thuật: xem `docs/03-architecture.md` mục "Pin theo GIỜ ĂN".

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

## 4b-2. Tên món tự thêm & tự dịch (Session 38)

Bật "Tự dịch tên món tự chế" thì món tự thêm được dịch nền qua MyMemory (miễn phí, dịch máy). Dịch máy tên món
thường sai kiểu dịch từng chữ ("Bánh nướng tàu" → "Train pies", "Canh chua cá" → "howler sour soup"), nên
**một tên sai tệ hơn không dịch**: món tự thêm giữ **một tên thống nhất** (tên người dùng gõ) ở mọi ngôn ngữ, trừ
khi bản dịch qua được kiểm tra (`domain/food/foodNameText.ts`, `services/translation/foodNameTranslationService.ts`):
- **Nhận diện ngôn ngữ của chính tên gõ** (`detectNameLanguage`: chữ chỉ tiếng Việt có → vi, ä/ö/ü/ß → de, còn lại
  theo ngôn ngữ app), không lấy mù quáng ngôn ngữ app.
- **Món Việt gọi theo tên riêng** (`isKeepAsIsName`: bắt đầu bằng bánh, bún, phở, chè, xôi, nem, chả, gỏi, hủ tiếu,
  bò bía, cao lầu, mì quảng, bột chiên, cơm tấm) → không gửi dịch.
- **Dịch ngược** (`translateFoodName` + `acceptNameTranslation`): bản dịch được dịch lại về ngôn ngữ gốc, phải ra
  đúng tên cũ (bỏ qua hoa/thường, dấu câu, số); echo hoặc còn chữ tiếng Việt trong kết quả EN/DE → bỏ.
- **Sửa dữ liệu cũ**: lúc mở app, `repairStoredTranslations` (offline) xoá `nameEn` của món giữ tên riêng hoặc
  `nameEn` còn chữ tiếng Việt — cho cả món tự thêm và override của món tự thêm (không đụng món catalog).
  `recheckStoredFoodTranslations` (một lần, chỉ khi bật tự dịch, cờ `foodNameTranslationsCheckedV1`) dịch ngược
  từng `nameEn` đã lưu và xoá cái không khớp; mất mạng thì dừng, lần mở sau làm tiếp.
- **Đổi tên món tự thêm** (✎ sửa) → bỏ bản dịch cũ (`namesAfterRename`), tên mới hiện ở mọi ngôn ngữ.
Không thêm chữ UI mới (i18n không đổi).

## 4b-3. Tìm món thông minh (Session 39)

Ô tìm ở màn Nạp (`searchFoods` trong `src/data/food/foodSearch.ts`, so khớp ở `src/domain/food/fuzzyMatch.ts`)
chịu được cách gõ của người không nhớ đúng tên:
- **Chấm điểm theo từng chữ** của tên VI/EN/DE (bỏ dấu, không phân biệt hoa thường, không cần đúng thứ tự):
  trùng chữ 1.0 › đầu chữ 0.85–1 › nằm trong chữ (≥4 ký tự) 0.55 › **gõ sai** (khoảng cách OSA: thêm/bớt/sai/đảo
  hai chữ cạnh nhau; ≤3 ký tự không cho sai trừ gõ lặp chữ cuối "boo"; 4 ký tự 1 lỗi, 5–8 ký tự 2 lỗi; chỉ khi chữ
  đầu trùng) › gõ sai trong phần đầu 0.6.
- **Gõ dính liền / tách khác** (`scoreCompact`): "phobo" = "Phở bò", "banhmi" = "Bánh mì…".
- **Từ khoá mô tả chỉ để tìm** cho món Việt (`foodSearchAliases.ts`, không hiển thị): "beef noodle soup",
  "Frühlingsrolle", "sticky rice"…
- Hai nhóm kết quả: **khớp đúng** (mọi chữ gõ đều có, không cần sửa lỗi — y như trước; `searchAllFoods` vẫn chỉ trả
  nhóm này) rồi **Gần giống** (gõ sai, dính liền, hoặc chỉ một phần chữ khi không có gì khớp đúng), dưới một dòng
  tiêu đề nhỏ, tối đa 6 món, chỉ hiện khi khớp đúng < 5 món; khi đã có khớp đúng thì "gần giống" chỉ gồm món có đủ
  mọi chữ. Hoà điểm → món đã ghi gần đây (`preferIds`) › catalog VN › tên ngắn hơn ("pho" → Phở bò trước Phô mai).
- Nút **➕ Thêm món mới: '…'** luôn hiện dưới danh sách khi có chữ gõ (trước chỉ hiện khi 0 kết quả) — gợi ý gần
  giống không bao giờ che mất đường nhập món mới.
- Nhanh: trung bình ~2,7 ms/lần gõ trên máy dev (453 món + món tự thêm).
- i18n vi/en/de: `components.foodLogModal.similarHeader`, `similarHeaderNoExact`.

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
- `src/domain/food/customFoodInput.ts` — logic thuần của form thêm/sửa món: dựng
  `FoodItem`, validate, quy đổi /100 g ↔ /khẩu phần, xem trước (mục 3a-2).
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

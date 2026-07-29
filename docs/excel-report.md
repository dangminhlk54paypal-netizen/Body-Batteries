# Báo cáo Excel hàng tuần — hướng dẫn đọc từng sheet

> ⚠️ Toàn bộ cột **"Đánh giá"** trong file Excel này chỉ là gợi ý tự theo dõi,
> **không phải chẩn đoán hay tư vấn y tế**. Xem thêm mục 6 bên dưới.

## 0. Đa ngôn ngữ (Session 14, 2026-07-17)

Từ session 14, **tên sheet + toàn bộ tiêu đề cột đều đổi theo ngôn ngữ đang
chọn trong Cài đặt** (Tiếng Việt / English / Deutsch — mục "🌐 NGÔN NGỮ" đầu
màn Settings). `exportWeeklyData(language)`/`exportMonthlyData(language)`
nhận tham số `language` và truyền xuống toàn bộ chuỗi build sheet trong
`excelExportService.ts` + `domain/nutrition/excelSheets.ts`, tra cứu qua
`translate(language, 'export.sheets.xxx' | 'export.columns.xxx')` trong
`src/i18n/locales/{vi,en,de}.ts`.

**Cố ý KHÔNG đổi theo ngôn ngữ** (xem `src/types/food.ts` +
`domain/nutrition/excelSheets.ts` comment): cột **tên món ăn** luôn giữ
nguyên tiếng Việt (`FoodLogEntry.foodNameVi`) — đây là snapshot tại đúng thời
điểm ghi món, không phải dữ liệu tra cứu sống, nên không thể "dịch lại" theo
ngôn ngữ chọn sau này mà không viết lại lịch sử. Toàn bộ **nhãn cấu trúc**
xung quanh nó (tiêu đề cột, tên sheet, tên vi chất, câu gợi ý "Đánh giá",
dòng cảnh báo y tế) đều đổi ngôn ngữ đầy đủ.

Nút **"Xuất Excel"** trong Cài đặt (`SettingsScreen.tsx` →
`exportWeeklyData()` trong `src/services/export/excelExportService.ts`) xuất
dữ liệu 7 ngày gần nhất thành **8 sheet** (2 sheet "Daily Totals"/"Food
Entries" thêm từ Session 14 — xem `domain/nutrition/excelSheets.ts` — cộng 6
sheet gốc mô tả bên dưới; tên hiển thị dưới đây là bản tiếng Việt mặc định):

## A. Daily Totals (sheet 1)

Một dòng cho mỗi **ngày có ghi món ăn** trong khoảng xuất, cộng thêm 3 cột
năng lượng (Session 19, 2026-07-29):
- **Kcal đã đốt**: tổng `energyKcal` của các bản ghi Vận động (bước chân +
  bài tập) trong ngày đó, gom theo đúng ngày hiển thị (`startAt` nếu có, rồi
  mới đến `timestamp` — giống cách `getActivityLogInRange` tự nhóm, để một
  bản ghi lùi ngày không lẫn sang hôm sau).
- **Nhu cầu năng lượng ước tính (kcal)**: `capacity` của pin Năng lượng ngày
  đó (đã gồm cả mức tăng do vận động trong ngày) — để trống nếu ngày đó không
  có bản ghi pin Năng lượng (dữ liệu cũ).
- **Cân bằng calo (+/-)**: Kcal đã ăn − Nhu cầu năng lượng ước tính. Dương =
  ăn dư, âm = thiếu hụt. Để trống khi cột Nhu cầu bên trên trống.
- **Dòng cuối sheet** (sau 1 dòng trống ngăn cách): dòng cảnh báo tái dùng
  đúng câu `assessment.disclaimer` — *"Chỉ để tham khảo — không phải tư vấn y
  tế."* — nhắc người dùng nghiên cứu số liệu cẩn trọng, không tuân theo tuyệt
  đối.

## B. Food Entries (sheet 2)

Một dòng cho mỗi món ăn đã ghi, cộng thêm 4 cột vi chất (Session 19,
2026-07-29): **Đường (g), Chất xơ (g), Sắt (mg), Muối (g)**. `FoodLogEntry`
không snapshot các vi chất này (chỉ macro/kcal) nên được tính lại từ
`per100g` của món ăn (`getAnyFoodById` + `per100gValue` trong
`microBatteryEngine.ts`, scale theo đúng số gram đã ăn — Muối suy ra từ Natri
× 2.5/1000, cùng công thức pin vi chất "Muối" ở Trang chủ). Để trống (không
phải 0) nếu không tìm được món trong CSDL — 0 sẽ đọc nhầm thành "món này
không có", còn để trống đúng nghĩa "chưa rõ".

## 1. Battery Readings
Lịch sử các lần đọc pin (Năng lượng + các pin phụ): ngày, loại pin, mức hiện
tại, dung lượng, % đầy.

## 2. Intake Events
Từng lần nạp thủ công (không qua Food Log): ngày giờ, loại pin, lượng, ghi chú.

## 3. Food Log
Từng món đã ăn: ngày, giờ, bữa, tên món, gram, kcal, đạm/béo/tinh bột, nước,
khoáng chất.

## 4. Dinh dưỡng ngày (mới)
Một dòng cho mỗi **ngày có ghi món ăn** trong 7 ngày qua:
- **Ngày, Kcal, Đạm (g), Béo (g), Carbs (g)**: tổng trong ngày, cộng từ
  các dòng Food Log của ngày đó (dùng đúng số đã snapshot lúc ghi món, không
  tính lại).
- Một cột cho **mỗi vi chất** (chất xơ, sắt, canxi, chất béo, kali, magie,
  kẽm, omega-3, natri, đường) — dạng `hiện tại/mục tiêu đơn vị`, ví dụ
  `18/25 g`. Tính bằng `computeMicroBatteries` (đã dùng cho pin vi chất ở
  Trang chủ) trên đúng các món đã ăn ngày đó.
- Cột cuối **"Đánh giá"**: một câu tiếng Việt nhẹ nhàng ghép từ các gợi ý bị
  kích hoạt trong ngày (xem mục 6), hoặc **"Ổn 👍"** nếu mọi thứ ổn.
- Ngày không ghi món nào thì **không có dòng** — không có dữ liệu để tổng
  hợp/đánh giá.

## 5. Tổng kết tuần (mới)
Một dòng cho mỗi vi chất, tổng hợp cả 7 ngày:
- **TB/ngày**: tổng cả tuần chia cho **7** (không chia theo số ngày thực sự
  có ghi món — thiếu 1 ngày log thì trung bình tuần cũng giảm theo, phản ánh
  đúng việc "cả tuần đã ăn đủ chưa").
- **Khuyến nghị/ngày**: mục tiêu/ngày theo hồ sơ cơ thể (tuổi/giới tính) —
  `nutrientTargetsForProfile` (`src/lib/nutrientTargets.ts`).
- **% đạt**: TB/ngày ÷ khuyến nghị × 100.
- **Đánh giá**: áp cùng bộ quy tắc ở mục 6 lên số trung bình tuần.

## 6. Bảng ngưỡng tham chiếu (mới)
Bảng tra cứu đứng sau toàn bộ cột "Đánh giá" ở sheet 4 và 5 —
`ASSESSMENT_RULES` trong `src/domain/nutrition/nutritionAssessment.ts`:
- **Dòng đầu tiên** luôn là dòng cảnh báo:
  *"Chỉ để tham khảo — không phải tư vấn y tế."*
- Mỗi dòng sau: **Chất, Ngưỡng** (vd "Dưới 70% mục tiêu (17.5 g)"),
  **Lời góp ý** (câu tiếng Việt sẽ hiện ở cột Đánh giá), **Nguồn (URL)**.
- Quy tắc chung:
  - Nhóm **"goal"** (càng gần/đạt mục tiêu càng tốt: chất xơ, sắt, canxi,
    chất béo, kali, magie, kẽm, omega-3) — **dưới 70% mục tiêu** → gợi ý nhẹ
    "Hơi ít {chất} — thử thêm {2-3 món ví dụ}". **Trên 100%** → ghi nhận
    trung tính, không cảnh báo (vd "đã vượt mức khuyến nghị — thường ổn từ
    thực phẩm").
  - Nhóm **"limit"** (natri, đường) — chỉ có ngưỡng **trên 100% mục tiêu**
    (cap) → "vượt ngưỡng gợi ý — thử giảm {2-3 món/ thói quen ví dụ}".
  - Không bao giờ dùng chữ "thiếu chất" / "nguy cơ bệnh" — chỉ gợi ý ăn thêm
    món gì hoặc giảm bớt món gì.

### Nguồn tham khảo (đã tra cứu qua WebSearch ngày 2026-07-07 — cần người
### phát triển bấm vào xác nhận lại ở vòng 2 trước khi phát hành):

| Chất | Nguồn |
|---|---|
| Chất xơ, Chất béo | [Dietary Guidelines for Americans 2020-2025 (USDA/HHS)](https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf) |
| Sắt | [NIH ODS — Iron, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/) |
| Canxi | [NIH ODS — Calcium, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/) |
| Kali | [NIH ODS — Potassium, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/) |
| Magie | [NIH ODS — Magnesium, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/) |
| Kẽm | [NIH ODS — Zinc, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/) |
| Omega-3 (EPA+DHA) | [NIH ODS — Omega-3 Fatty Acids, Health Professional Fact Sheet](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/) |
| Natri (muối) | [WHO — Sodium reduction fact sheet](https://www.who.int/news-room/fact-sheets/detail/sodium-reduction) |
| Đường | [WHO — Sugars and dental caries fact sheet](https://www.who.int/news-room/fact-sheets/detail/sugars-and-dental-caries) |

## 7. File liên quan
- `src/domain/nutrition/nutritionAssessment.ts` — bảng quy tắc + `assessState`
  (1 vi chất) / `assessDay` (gộp cả ngày, có test).
- `src/domain/nutrition/dailyNutritionSummary.ts` — thuần, gom Food Log theo
  ngày (giờ địa phương, **không** dùng mốc reset 6h của Sổ calo) +
  `summarizeWeeklyNutrition` (có test).
- `src/services/export/excelExportService.ts` — lắp 8 sheet, lấy hồ sơ người
  dùng qua `useSettingsStore.getState()` rồi tính `nutrientTargetsForProfile`;
  nhận `language` để dịch toàn bộ tên sheet/tiêu đề cột (xem mục 0). Từ
  Session 19: thêm `getActivityLogInRange` (Kcal đã đốt) và lọc `readings`
  sẵn có theo `batteryTypeId === 'energy'` (Nhu cầu năng lượng ước tính).
- `src/domain/health/weightOnDay.ts` (mới, Session 19) — `weightOnOrBefore`
  dùng chung giữa Excel export và sheet chi tiết ngày ở màn History (tách ra
  khỏi `excelSheets.ts` để không viết trùng logic 2 nơi).
- `src/i18n/` (mới, Session 14/2026-07-17) — `translate.ts` + `locales/{vi,en,de}.ts`
  chứa toàn bộ chuỗi `export.sheets.*`/`export.columns.*` dùng ở đây.
- Test: `src/domain/nutrition/__tests__/nutritionAssessment.test.ts`,
  `src/domain/nutrition/__tests__/dailyNutritionSummary.test.ts`,
  `src/domain/nutrition/__tests__/excelSheets.test.ts`.

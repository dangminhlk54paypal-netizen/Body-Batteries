# File Excel xuất dữ liệu — cấu trúc từng sheet

> ⚠️ Mọi cột **"Đánh giá" / "Góp ý"** chỉ là gợi ý tự theo dõi, **không phải chẩn đoán hay tư vấn y tế**.
> Câu cảnh báo nằm ở sheet đầu tiên ("Đọc trước"), không chen vào bảng dữ liệu.

## 0. Nguyên tắc (Session 60, 2026-10-01 — làm lại toàn bộ)

Chủ dự án muốn mở file là biết cách xử lý/sắp xếp lại theo góc nhìn của mình về sau. Nên **mọi sheet dữ liệu là
một bảng sạch** (`domain/export/sheetTable.ts`):

1. **Một hàng tiêu đề** (in đậm, cố định khi cuộn, có nút lọc ▾ — AutoFilter), rồi **mỗi dòng một bản ghi**.
   Không có dòng trống ngăn cách hay dòng ghi chú chen giữa (chúng làm hỏng sắp xếp/lọc/PivotTable).
2. **Ngày là ngày thật, giờ là giờ thật** (số Excel + định dạng): sắp xếp đúng thứ tự thời gian, lọc theo
   tháng/tuần được. Định dạng theo ngôn ngữ: vi `dd/mm/yyyy`, de `dd.mm.yyyy`, en `yyyy-mm-dd`.
   Trước đây ngày là chữ với 5 kiểu khác nhau (`21-Sep-2026`, `2026-09-21`, `21/9/2026`, `Thứ 2, 21/09` không có năm…).
3. **Số là số trần, đơn vị nằm ở tiêu đề** (`Đạm (g)`, `Natri (mg)`). Trước đây có ô dạng `6.6/38 g`, `100 g` — không
   cộng/vẽ biểu đồ được.
4. **Ô trống = chưa có dữ liệu**, khác với 0 (vd cân nặng ngày không cân, vi chất của món đã bị xoá khỏi danh mục).
5. Cùng thứ tự macro ở mọi sheet: **Kcal · Đạm · Carbs · Béo**; cùng bộ cột vi chất ở "Theo ngày" và "Món ăn"
   (Pivot "Món ăn" theo Ngày ra đúng số của "Theo ngày").

Tên sheet + tiêu đề cột đổi theo ngôn ngữ trong Cài đặt (`export.sheets.*`, `export.columns.*`, `export.readMe.*`
trong `src/i18n/locales/{vi,en,de}.ts`). Tên món theo ngôn ngữ xuất (tra danh mục sống); chỉ món không còn trong danh
mục mới dùng tên đã lưu lúc ghi.

## 1. Thứ tự sheet

| # | Sheet (vi) | Mỗi dòng là | Dùng để |
|---|---|---|---|
| 1 | **Đọc trước** | thông tin file | khoảng thời gian, ngày xuất, hồ sơ, số ngày có ghi ăn, cách dùng, mô tả từng sheet (kèm số dòng), cảnh báo y tế. Không có bộ lọc; chữ dài tự xuống dòng. |
| 2 | **Theo ngày** | 1 ngày có ghi bất kỳ thứ gì | bảng chính để vẽ xu hướng: Ngày · Thứ · Cân nặng (đo hôm đó, TB nếu cân nhiều lần, **không** kéo từ hôm trước) · Kcal ăn · Đạm · Carbs · Béo · Bước · Kcal vận động · Tổng tiêu hao · Nguồn tiêu hao (Apple Health / Ước tính của app) · Cân bằng · Nước (ml, món + ghi nhanh) · Ngủ (giờ) · 10 vi chất. |
| 3 | **Món ăn** | 1 món đã ghi | Ngày · Giờ · Bữa · Món · Phần (chỉ khi ghi theo viên/hộp) · Gram · Kcal · macro · Nước · 10 vi chất (tính lại từ `per100g`). |
| 4 | **Vận động** | 1 lần ghi vận động | Ngày · Bắt đầu · Kết thúc · Hoạt động (các bài nối bằng " + ", hoặc "Bước chân") · Phút · Bước · Kcal. *(Mới — trước đây Excel không có danh sách vận động.)* |
| 5 | **Nước & ngủ** | 1 lần ghi nhanh | Ngày · Giờ · Loại · Lượng · Đơn vị · Ghi chú. |
| 6 | **Trung bình kỳ** | 1 chất | Đơn vị · Kiểu (Cần đủ / Mức trần) · TB/ngày · Khuyến nghị/ngày · % · **Số ngày tính** · Đánh giá. |
| 7 | **Góp ý theo ngày** | 1 cặp (ngày, chất) đáng chú ý | thay cột "Đánh giá" dài 8 câu trong một ô ngày trước — lọc cột Chất để xem chất nào hay thiếu/vượt. |
| 8 | **Ngưỡng tham chiếu** | 1 ngưỡng | Chất · Đơn vị · Khuyến nghị/ngày · Ngưỡng · Góp ý · Nguồn. |
| 9 | **Chỉ số pin** | 1 (ngày, pin) | dạng dài, Năng lượng trước rồi 6 pin; Pivot theo cột Pin để so sánh. Có cột Đơn vị. |
| 10 | **Tiến độ sức mạnh** | 1 tuần | Tuần từ · Đến (ngày thật) · Cân nặng · S/B/D nặng nhất · e1RM · ratio e1RM ÷ cân nặng. Chỉ có khi có dữ liệu tập. |
| 11 | **1RM** | 1 lần ghi 1RM | Ngày · Bài · Mức tạ · Cân nặng tuần · Ratio · Ghi chú. Chỉ có khi có 1RM trong kỳ. |

Đã bỏ (trùng lặp): "Tổng hợp ngày" + "Dinh dưỡng ngày" gộp thành **Theo ngày**; "Chi tiết món ăn" + "Nhật ký ăn uống"
gộp thành **Món ăn** (cột "Thương hiệu" luôn trống cũng bỏ).

## 2. Sửa lỗi số liệu

- **Trung bình vi chất chia sai:** sheet "Tổng kết tuần" cũ luôn chia cho **7**, kể cả bản xuất 30 ngày và bản sao lưu
  tháng → TB/ngày bị phóng to ~4 lần. Giờ chia cho **số ngày có ghi ăn** và in số đó ra cột "Số ngày tính" (sheet đổi
  tên thành "Trung bình kỳ").
- Số cân nặng kiểu `78.39999999999999` → làm tròn 1 chữ số.

## 3. Quy tắc góp ý (không đổi)

`ASSESSMENT_RULES` trong `src/domain/nutrition/nutritionAssessment.ts`:
- Nhóm **"goal"** (chất xơ, sắt, canxi, chất béo, kali, magie, kẽm, omega-3): **dưới 70% mục tiêu** → gợi ý nhẹ ăn thêm
  món gì; **trên 100%** → ghi nhận trung tính.
- Nhóm **"limit"** (natri, đường, muối): chỉ có ngưỡng **trên 100%** → gợi ý giảm bớt.
- Không bao giờ dùng chữ "thiếu chất" / "nguy cơ bệnh".

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

## 4. Kỹ thuật & file liên quan
- `src/domain/export/sheetTable.ts` — kiểu `SheetTable` (cột + dòng ô có kiểu), `dateCell`/`timeCell`, số ngày Excel
  (`excelSerialDate`), định dạng ngày theo ngôn ngữ.
- `src/domain/export/dataWorkbook.ts` — các hàm thuần dựng từng sheet (có test `__tests__/dataWorkbook.test.ts`, gồm
  test chống lỗi chia 7, tên sheet ≤ 31 ký tự, đủ khoá dịch động `export.readMe.guide.*`).
- `src/domain/training/strengthExcelRows.ts` — 2 sheet sức mạnh (`buildStrengthProgressSheet`, `buildLiftMaxSheet`).
- `src/services/export/xlsxWriteUtils.ts` — `tableToSheet` (ngày/giờ thật, AutoFilter, độ rộng cột theo nội dung/định
  dạng), `headerCells` (tiêu đề in đậm), `wrapColumnCells` (xuống dòng), `workbookToBase64WithFrozenHeaders` (cố định
  hàng 1 + chèn style vào `styles.xml` — bản `xlsx` miễn phí không ghi style nên vá XML sau khi ghi).
- `src/services/export/excelExportService.ts` — đọc DB, ráp sheet theo thứ tự trên. Dùng chung cho Excel 7 ngày,
  30 ngày và sao lưu tháng tự động.
- Xuất block tập (`trainingBlockExportService.ts`) là bảng in, không thuộc file dữ liệu này.

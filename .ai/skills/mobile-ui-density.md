# Skill: mobile-ui-density (Giao diện gọn — chống ngợp thông tin)

## Mục đích
Người dùng nhìn app trên màn hình điện thoại nhỏ. **Quá nhiều chữ trên một màn = choáng ngợp.** Skill này gom các
nguyên tắc giao diện người dùng (chủ app) đã yêu cầu và duyệt qua nhiều lần tinh chỉnh (Session 40–48), kèm component
mẫu đã có sẵn trong code để dùng lại, không viết lại từ đầu.

Gọi skill này **mỗi khi** tạo hoặc sửa bất kỳ thứ gì người dùng nhìn thấy: màn hình, thẻ, danh sách, sheet, form.
Đi cùng luật i18n trong `AGENTS.md` (không chữ cứng, đủ 3 ngôn ngữ vi/en/de).

---

## 1. Nội dung dài → gói vào một "cửa sổ" nhỏ, cuộn bên trong
Bấm mở một mục **không được** làm nội dung đổ ào xuống dài vô tận.
- Đặt nội dung trong `ScrollView` có `maxHeight` cố định (≈ 1/2 màn hình) + `nestedScrollEnabled`. Người dùng kéo
  bên trong khung đó.
- Mẫu có sẵn:
  - `TrainingLogPeriodSection` (Sổ tập): tháng mở ra cao tối đa 320, đủ cho khoảng 2 tuần.
  - `BlockPlanView` (Kế hoạch block): `WEEK_WINDOW_HEIGHT = 380` cho mỗi tuần.
  - `BlockScheduleEditor` (Lịch tuần): khung cao 300.

## 2. Thông tin nhiều tầng → gập theo từng tầng
Ví dụ **Tháng › Tuần › Ngày**: mở tháng mới thấy tuần, mở tuần mới thấy ngày.
- **Accordion:** màn nhiều mục ngang hàng thì chỉ mở **một mục một lúc**, mặc định gập hết. Mẫu:
  `SettingsSection` + `openSection` trong `SettingsScreen`.
- **Tiêu đề khi gập vẫn phải có ích:** thêm một dòng tóm tắt giá trị hiện tại, ví dụ "Nhắc 20:00 · báo pin < 20%".
- **Tự gập:**
  - Mục không phải hiện tại tự gập sau 2 phút không chạm (`TrainingLogPeriodSection`: `onTouchStart` đặt lại bộ đếm).
  - Mục đã cuộn qua khỏi màn tự gập kiểu "cầu trượt nước": `domain/training/scrollFold.ts` +
    `maintainVisibleContentPosition` để màn không giật.
- **Thao tác tay luôn thắng tự động:** người dùng tự mở hoặc gập thì **nhớ lại**, không để cuộn làm mở lại. Chỉ bỏ
  lựa chọn khi có mốc mới (tuần mới). Mẫu: `store/planFoldStore.ts`, lưu trên máy bằng `persist`.
- **Mục "hiện tại" mở sẵn:** tuần này, tháng này. Mục quá khứ gập sẵn.

## 3. Thông tin phụ → giấu sau một lớp biểu tượng
Chọn biểu tượng theo chức năng, không để chữ giải thích nằm sẵn trên màn:

| Biểu tượng | Dùng cho | Component / cách làm |
|---|---|---|
| **ⓘ** | giải thích, cách tính, lưu ý dài | `components/ui/InfoPopover` (popup Modal). ⚠ Không đặt trong `BottomSheet`: 2 Modal chồng nhau trên iOS sẽ ẩn cái trên. |
| **✎** | sửa | nút tròn nhỏ, chỉ có biểu tượng bút chì (không kèm chữ "Sửa trang/Chia sẻ") |
| **＋** | thêm | nút nhỏ, hoặc gộp vào menu của ✎ |
| **⌄ / ⌃** | mở / gập | cuối hàng tiêu đề |
| nhấn giữ | thao tác hiếm (đổi tên, xoá) | `Alert` menu |
| **⏰ ✓** | trạng thái (đã hẹn / đã ghi) | chip nhỏ màu; bấm vào để mở menu |

- Chữ in nhỏ (mô tả, công thức, disclaimer) để trong ⓘ. Trên màn chỉ còn một dòng ngắn, nếu thật cần.
- Chữ nào dài quá thì **viết ngắn lại trước**, ví dụ "Xuất Excel 7 ngày gần nhất" thành "Excel 7 ngày". Chỉ khi thật
  sự dài mới đưa vào ⓘ.

## 4. Mục giống nhau lặp lại → viết tắt / số, và trượt ngang
- Thứ trong tuần: dải **T2 T3 … CN** / **Mo Tue …**, lấy từ `weekdayLabel(dow, language, 'short')` (Intl, không cần
  từ điển). Có chấm màu = có dữ liệu.
- Tuần hoặc block: chỉ **B3W4** (số do người dùng nhập), không kèm ngày dài trong tiêu đề. Ngày đưa xuống thân mục.
- Tên bài tập: viết tắt như Sổ tập (`movementLabel`: B, S, PB, iC…), in đậm màu xám. Tên đầy đủ để trong ⓘ.
- Chuyển giữa các mục ngang hàng bằng **trượt**: `ScrollView horizontal pagingEnabled` + dải chọn phía trên (bấm dải →
  `scrollTo`). Mẫu: `BlockScheduleEditor`.
  - ⚠ Trong `BottomSheet`, gesture kéo sheet phải là `activeOffsetY([-10,10]).failOffsetX([-15,15])` (đã có sẵn), nếu
    không vuốt ngang sẽ kéo cả sheet.

## 5. Bảng / dòng thay vì đoạn văn
- Mỗi mục một dòng, theo cột: **tên | giá trị | ⓘ | ✎**. Mẫu: hàng bài tập trong `BlockPlanView` (`tableRow`).
- Không lặp nhãn trên mỗi dòng (bỏ "Kế hoạch:", "Tổng buổi:"…). Số phụ như kcal để nhỏ, bên phải.

## 6. Cân đối, đối xứng
- Mọi hàng cài đặt cùng một khuôn: **nhãn trái, điều khiển phải, cao tối thiểu 52** (`SettingRow` trong
  `SettingsScreen`).
- Lựa chọn 2–4 phương án thì dùng **segmented rộng bằng nhau** (`Segmented`), không dùng chip dài ngắn khác nhau.
- Nhóm nút hành động thì dùng **lưới ô vuông 2×2** (`Tile`), nút nguy hiểm viền đỏ.
- Hàng nhiều ô nhập có nhãn dài ngắn khác nhau: `justifyContent: 'flex-end'` để các ô nhập thẳng hàng ở đáy.
- Stepper nhỏ (nút 28) đặt cùng hàng với nhãn. Kiểm tra độ rộng với **tiếng Đức** (chữ dài nhất).

## 7. Chọn từ danh sách dài → vừa gõ vừa cuộn
- Ô tìm kiếm + danh sách chia nhóm, cuộn được, lọc **không dấu, không cần đúng thứ tự từ**:
  `matchesSearch` / `foldSearchText` (`domain/energy/blockSchedule.ts`).
- Picker hiện **thay chỗ** khung đang xem (không mở thêm Modal chồng lên), có nút Huỷ.

## 8. Màu & chủ đề
- Chỉ dùng token trong `lib/theme.ts` (`c.accent`, `c.textMuted`…). Màu mới thì thêm cho **cả dark lẫn light** và
  kiểm tra độ tương phản trong dark theme.
- Phân tầng bằng kiểu chữ trước khi thêm màu: tiêu đề đậm, ngày nghiêng, số phụ nhỏ mờ.

---

## Checklist trước khi báo "xong" một thay đổi UI
- [ ] Mở mục bất kỳ: nội dung có nằm trong khung cố định, không chảy dài vô tận?
- [ ] Có tầng nào nên gập mà đang mở hết? Mục hiện tại có mở sẵn không?
- [ ] Còn đoạn giải thích nào nằm sẵn trên màn mà nên vào ⓘ không?
- [ ] Nhãn lặp lại (thứ, tuần, bài) đã viết tắt chưa? Có cần trượt ngang không?
- [ ] Hàng/nút có cân đối (cùng chiều cao, cùng độ rộng)?
- [ ] Thao tác tay của người dùng có bị tự động ghi đè không?
- [ ] i18n: chữ mới có đủ vi/en/de. `src/i18n/__tests__/usedKeys.test.ts` xanh (bắt khoá đặt nhầm mục).
- [ ] `npm run verify` xanh → đẩy EAS preview + checklist test cho người dùng (xem `eas-preview-publish`).

## Cập nhật skill này
Mỗi khi người dùng duyệt hoặc tinh chỉnh một kiểu hiển thị mới, thêm nó vào mục tương ứng ở trên (kèm tên component
mẫu). Đây là bước bắt buộc của `session-wrapup` (Bước 5b).

# Skill: add-language (Thêm ngôn ngữ mới cho app)

## Mục đích
Thêm một ngôn ngữ hiển thị mới (vd: Tiếng Pháp, Tiếng Nhật) vào app —
giao diện + file Excel xuất ra — mà **không cần cài thêm thư viện nào**.
Hệ i18n của dự án là tự viết (`src/i18n/`, xem `docs/03-architecture.md`),
nên toàn bộ việc chỉ là sửa 3 file nhỏ + tạo 1 file dịch.

## Đầu vào cần (hỏi người dùng nếu thiếu)
- Ngôn ngữ muốn thêm (vd: Tiếng Pháp)
- Mã ngôn ngữ 2 chữ (vd: `fr`) và mã Intl locale (vd: `fr-FR`)
- Tên ngôn ngữ viết bằng CHÍNH ngôn ngữ đó (vd: `Français`) — để người
  không đọc được ngôn ngữ hiện tại vẫn tìm ra nút của mình

## Các bước
1. **`src/i18n/types.ts`** — thêm mã mới vào 4 chỗ:
   - union `Language` (vd: `'vi' | 'en' | 'de' | 'fr'`)
   - mảng `LANGUAGES`
   - `LANGUAGE_NAMES` (tên bản ngữ, vd: `fr: 'Français'`)
   - `LOCALE_TAGS` (vd: `fr: 'fr-FR'`)
2. **Tạo `src/i18n/locales/fr.ts`** — copy `en.ts` làm mẫu, đổi tên export
   thành `fr`, giữ nguyên khai báo kiểu `: TranslationSchema`, rồi dịch
   TOÀN BỘ giá trị chuỗi. KHÔNG đổi tên key, KHÔNG bỏ key nào —
   `TranslationSchema = typeof vi` nên `tsc` sẽ báo lỗi ngay nếu thiếu.
   Giữ nguyên các placeholder `{{ten_bien}}` trong chuỗi (chỉ dịch chữ
   xung quanh, không dịch tên biến bên trong `{{ }}`).
3. **`src/i18n/translate.ts`** — import locale mới và thêm vào
   `DICTIONARIES` (vd: `{ vi, en, de, fr }`).
4. **Không cần sửa UI:** nút chọn ngôn ngữ ở màn Cài đặt render tự động
   từ mảng `LANGUAGES`, nên ngôn ngữ mới tự xuất hiện.
5. Chạy `npm run verify` — tsc là lưới an toàn: mọi key thiếu/thừa trong
   file dịch mới đều chặn build.
6. Nhờ người dùng test trên điện thoại: chuyển sang ngôn ngữ mới, lướt đủ
   4 tab, xuất thử 1 file Excel.

## Kết quả mong đợi
- Ngôn ngữ mới xuất hiện trong mục "🌐 NGÔN NGỮ" ở Cài đặt, đổi ngay lập
  tức không giật, được lưu qua lần mở app sau.
- File Excel xuất ra dùng đúng ngôn ngữ mới (tên sheet, tiêu đề cột).
- `npm run verify` sạch.

## Lưu ý
- KHÔNG cài i18next / react-i18next / expo-localization — đây là quyết
  định kiến trúc có chủ đích (xem `docs/02-tech-stack.md` mục "Vì sao
  không chọn i18next").
- Fallback luôn là tiếng Việt (`vi` là ngôn ngữ gốc, đầy đủ nhất) — không
  đổi logic fallback trong `translate.ts`.
- Các câu về y tế/dinh dưỡng (`nutrients.*.underAdvice/overAdvice`,
  `overdose.*`) nên được người bản ngữ xem lại — AI dịch được nhưng chưa
  phải xác nhận cuối cùng.
- Các bước 1-6 ở trên chỉ phủ chữ giao diện (dictionary). Catalog món ăn
  (tên hiển thị khi xem lịch sử/xuất Excel) là một hệ dữ liệu RIÊNG, xem
  mục kế tiếp.

## Thêm ngôn ngữ mới cho catalog món ăn (riêng, tuỳ chọn)

Việc này KHÁC với 6 bước ở trên — món ăn không nằm trong dictionary mà
nằm trong `FoodItem.nameVi/nameEn/nameDe` (xem `src/types/food.ts`), lấy
từ `food_items.csv` (90 món tự soạn) + `database/usda_names_<lang>.csv`
(363 món USDA, cơ chế "cover file" — xem `database/README.md`). Tên hiển
thị khi xem lịch sử/xuất Excel đi qua `foodDisplayName`/
`foodLogEntryDisplayName` (`src/data/food/foodLookup.ts`), KHÔNG qua
`translate()`/dictionary.

Chỉ cần làm mục này nếu muốn tên món ăn cũng hiện đúng ngôn ngữ mới —
nếu không làm, tên món chỉ fallback về tiếng Việt/Anh cho ngôn ngữ đó
(không lỗi, chỉ là chưa dịch).

1. `src/types/food.ts` — thêm field tuỳ chọn `name<Lang>?: string` vào
   `FoodItem` (theo mẫu `nameDe`).
2. `src/data/food/foodCsv.ts` (`parseFoodCsv`) — thêm dòng
   `name<Lang>: at(c, 'name_<lang>').trim(),` vào object `FoodItem` được
   dựng. BẮT BUỘC — thiếu bước này thì cột CSV có tồn tại cũng bị bỏ qua
   khi parse (parser đọc theo tên cột đã khai báo cứng, không tự suy ra
   field mới). Đây là parser DÙNG CHUNG cho cả `food_items.csv` lẫn dữ
   liệu USDA generated, chỉ cần sửa 1 chỗ.
3. `food_items.csv` — thêm cột `name_<lang>` (thứ tự cột không quan trọng
   — parser đọc theo TÊN cột, xem `headerIndex()` trong `foodCsv.ts`),
   điền cho 90 món.
4. `database/usda_names_<lang>.csv` — tạo file cover mới (`id,name_<lang>`),
   ban đầu để trống, điền dần cho 363 món USDA (không cần điền hết ngay —
   dòng thiếu tự để trống, không lỗi).
5. `scripts/generate-usda-db.js` — thêm 1 phần tử vào mảng
   `TRAILING_LANGUAGES` ở đầu file (`{ lang, column: 'name_<lang>',
   coverPath: ... }`) — không cần sửa gì khác trong script này, cơ chế đã
   generic hoá. `scripts/generate-food-db.js` KHÔNG cần sửa — nó chỉ nhúng
   nguyên văn `food_items.csv` vào TS, không biết/không cần biết cột nào.
6. `src/data/food/foodLookup.ts` — thêm nhánh `<lang>` vào
   `foodDisplayName()` (fallback về `nameEn` rồi `nameVi` nếu thiếu, theo
   đúng thứ tự đã dùng cho `de`).
7. Chạy `npm run gen:food && npm run gen:usda` rồi `npm run verify`.
8. Dịch hàng loạt: dùng prompt tái sử dụng được trong `database/README.md`
   mục "Translating names in bulk" (đổi `{LANGUAGE}`) — dò 2 nguồn thiếu
   dịch (cột `name_<lang>` rỗng trong `food_items.csv`, id thiếu trong
   `database/usda_names_<lang>.csv`), dịch, ghi lại, không đụng file nào
   khác, không commit.

Tên món đã ghi vào lịch sử (`FoodLogEntry.foodNameVi`, một snapshot 1
ngôn ngữ) vẫn KHÔNG dịch lại — đó là chuyện khác, xem AGENTS.md.
`foodDisplayName`/`foodLogEntryDisplayName` chỉ áp dụng cho món còn tồn
tại trong catalog; món catalog đã xoá hoặc món tự nhập tay (custom, chỉ
có đúng 1 tên) vẫn fallback về snapshot đó, không đổi.

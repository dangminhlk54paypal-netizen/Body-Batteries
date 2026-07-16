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
- Tên món ăn đã ghi vào lịch sử (`FoodLogEntry.foodNameVi`) là snapshot,
  KHÔNG dịch lại — luật chung trong `AGENTS.md`.

# Trí nhớ dự án cho phiên cloud

Bản rút gọn những điều phiên trên Mac nhớ riêng trong `~/.claude`. Repo public: chỉ ghi quy tắc kỹ thuật.

## Cách chủ app làm việc
- Không chuyên kỹ thuật, đọc trên điện thoại, nói tiếng Việt. Trả lời bằng kết quả và việc cần làm, ít thuật ngữ.
- Luôn trả lời bằng tiếng Việt; code và tên biến bằng tiếng Anh. Mục tiêu: app miễn phí trên store, dữ liệu chỉ nằm trên máy.
- UI gọn: cửa sổ cuộn, gập theo tầng, ⓘ/✎/＋, viết tắt + vuốt ngang, đối xứng (`.ai/skills/mobile-ui-density.md`).
- Kế hoạch tập: engine chỉ gợi ý sau nút Áp dụng; mọi ô và TM sửa được.
- Học từ repo khác (openGym AGPL): lấy ý tưởng, không chép code/tài sản.

## Bẫy kỹ thuật
- ESLint chặn `react-hooks/purity` và `set-state-in-effect`: không setState trong effect, dùng component con có `key` + khởi tạo `useState`.
- Thêm field cho `FoodItem`: phải vá merge của `getAnyFoodById`, nhánh sửa của `FoodNutritionEditModal`, mapper/schema/migration.
- Tra món đã ghi bằng `getAnyFoodById`; không đọc trực tiếp file JSON 6,4 MB của USDA.
- `isBodybuildingEntry` phải kiểm tra trước `isLiftingEntry`.
- Hai Modal chồng nhau không hiện trên iOS: thay nội dung tại chỗ trong sheet.
- `xlsx` là SheetJS 0.20.3 trong `vendor/` (không dùng npm 0.18.5); require lười trong code có test Jest.
- Đổi pin: chỉ qua action của `energyStore` (độ no replay theo log, ngày năng lượng reset 6h, `activity_log` là gốc của vận động).
- Định dạng AI: JSON (`bb.food.v1` theo kế hoạch `.ai/plans/2026-10-26-ai-import-ke-lai-mon-ghep.md`) và `BB-LOG v1` cùng đi qua `parseMealAnswer`. Khi hợp nhất xong thì xoá phần dư.

## Không tự làm
- Không nâng Expo SDK. Không publish ngoài `preview`. Không đụng `main`.
- Mục "Test thật ✅" chỉ đánh khi chủ app đã báo lại từ điện thoại.

# Báo cáo gói S-L — Ghi nhận cân nặng theo thời gian

## Mục tiêu
Bước 1 cho hướng "hiệu chỉnh cá nhân hoá thật theo xu hướng cân nặng" (đã chốt
2026-06-18): app chưa ghi cân nặng theo thời gian ở đâu cả (chỉ có 1 số
`weightKg` hiện tại trong hồ sơ, bị ghi đè mỗi lần sửa). Gói này CHỈ làm việc
ghi nhận dữ liệu — không tính toán hiệu chỉnh gì (bước 2 đó gộp vào S-G, cần
vài tuần dữ liệu thật).

## File đã tạo

### `src/data/repositories/healthSignalsRepository.ts`
Dùng đúng bảng `health_signals` đã có sẵn trong `schema.ts` (cột
`id/timestamp/source/type/value`), KHÔNG đổi schema:
- `logWeight(kg: number)`: insert 1 dòng `source='manual'`, `type='weight_kg'`,
  `timestamp=Date.now()`.
- `getWeightHistory(limit = 10)`: trả về mảng `{timestamp, value}` sắp theo
  thời gian (mới nhất trước, `ORDER BY timestamp DESC`), giới hạn 10 dòng gần
  nhất theo mặc định.
- Theo đúng pattern các repository khác trong project (`getDb()` +
  `db.runAsync`/`db.getAllAsync` với SQL thuần, không ORM).

### `src/components/WeightLogCard.tsx`
- 1 ô nhập số (`decimal-pad`) + nút "Ghi nhận hôm nay".
- Validate biên độ bằng `PROFILE_LIMITS.weightKg` đã có sẵn trong
  `metabolicConstants.ts` (20–300 kg) — ngoài khoảng đó thì bấm nút không làm
  gì (giống pattern guard của `IntakeModal`), không cần báo lỗi riêng.
- Hiện danh sách text đơn giản các lần đã ghi (ngày + số kg), KHÔNG vẽ biểu đồ
  (đúng yêu cầu, để dành cho gói sau khi có đủ dữ liệu).
- Subtitle ghi rõ "Ghi nhận tự nguyện, không bắt buộc — chỉ để xem xu hướng
  theo thời gian, không đánh giá" — đáp ứng ranh giới sức khoẻ
  (`.ai/CONTEXT.md` mục 5: không gắn nhận xét/đánh giá về số cân nặng).
- Tự fetch dữ liệu khi tab được focus (`useFocusEffect`, cùng pattern với
  `HistoryScreen`) — component tự quản lý state của nó, không cần
  `HistoryScreen` truyền props xuống.
- Tái dùng `dateString`/`formatDisplayDate` có sẵn trong `lib/dateUtils.ts` để
  hiện ngày, không viết lại logic format ngày mới.

## File đã sửa
- `src/screens/HistoryScreen.tsx`: thêm import `WeightLogCard`, chèn
  `<WeightLogCard />` ngay dưới `<TrendChart>` (trước phần thẻ từng ngày).
  Không sửa gì khác trong file.

## Không đụng (đúng yêu cầu)
`schema.ts`, `BodyProfileCard.tsx`, `SettingsScreen.tsx`, `App.tsx`,
`energyStore.ts`, `package.json` — không file nào trong nhóm này bị sửa.

## Kiểm tra
- `npx tsc --noEmit` → sạch, không lỗi.
- `npx jest` → 92 test PASS / 11 suite (không thêm test mới — đây là I/O +
  component thuần UI, không có hàm tính toán domain cần unit test riêng).
- `npx expo export --platform ios` → OK, iOS bundle tăng từ 1424 → **1426
  module** (đúng kỳ vọng: +2 file mới).

## Lưu ý cho phiên sau
- Đây là nền tảng dữ liệu cho **S-G** (hiệu chỉnh cá nhân hoá MET/hệ số công
  việc theo xu hướng cân nặng thật) — S-G cần đợi vài tuần người dùng ghi đều
  để có đủ dữ liệu so sánh.
- `getWeightHistory()` hiện giới hạn 10 dòng gần nhất; nếu sau này cần biểu đồ
  xu hướng cân nặng dài hơn, tăng `limit` hoặc thêm tham số khoảng ngày — chưa
  cần thiết ở gói này.

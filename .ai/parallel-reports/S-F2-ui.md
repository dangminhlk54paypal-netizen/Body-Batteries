# S-F2 — Tích hợp Apple Health (HealthKit) — UI Phase 4-5

**Agent:** mobile-frontend · **Ngày:** 2026-07-10 · **Nhánh:** `ui-upgrade`

Tiếp nối `.ai/parallel-reports/S-F2.md` (backend Phase 1-3, đã xong). Gói này
làm phần người dùng NHÌN THẤY: hiển thị `appleHealthBurnedKcal`/
`appleHealthStatus` trên Home + nút đồng bộ tay trong Cài đặt. Không đụng
`src/store/energyStore.ts`, `src/services/health/`,
`src/data/repositories/healthSignalsRepository.ts` (đúng phạm vi giao).

## File mới

- `src/lib/relativeTime.ts` — hàm thuần `formatRelativeTime(ts, nowMs)` → chuỗi
  tiếng Việt "vừa xong" / "N phút trước" / "N giờ trước" / "N ngày trước".
  Nhận `nowMs` làm tham số bắt buộc (không tự gọi `Date.now()` bên trong) để
  giữ hàm thuần — tránh lỗi `react-hooks/purity` của hook ESLint tự động khi
  dùng trong component.
- `src/lib/__tests__/relativeTime.test.ts` — 5 test case (dưới 1 phút, phút,
  giờ, ngày, timestamp tương lai được kẹp về "vừa xong").
- `src/components/AppleHealthStatusBadge.tsx` — badge nhỏ hiển thị trạng thái
  4 giá trị của `appleHealthStatus`, dùng chung cho Home. Export thêm hàm
  thuần `appleHealthStatusMeta(status)` (icon/màu/nhãn) để `SettingsScreen`
  tái dùng đúng màu/nhãn thay vì viết lại. Vì `energyStore.ts` không export
  type `AppleHealthStatus` riêng (và không được sửa file đó), type được suy
  ra cấu trúc từ `ReturnType<typeof useEnergyStore.getState>['appleHealthStatus']`.
- `src/components/EnergyBalanceCard.tsx` — thẻ "Cân bằng năng lượng" mới cho
  Home: Đã đốt hôm nay (+ badge trạng thái) / Đã ăn hôm nay / Chênh lệch (màu
  xanh mint nếu dư, đỏ nếu thiếu — lấy từ `colors.mint`/`colors.danger` có sẵn
  trong `src/lib/theme.ts`, không bịa màu mới).

## File đã sửa

- `src/screens/HomeScreen.tsx` — thêm `EnergyBalanceCard` ngay dưới
  `BatteryStack` (pin phụ), trước `MicroBatteryStack` — đúng tinh thần "thông
  tin phụ, đặt DƯỚI phần hiển thị pin chính", không đụng
  `BatteryCell`/`BatteryStack` core math. Lấy thêm 3 field từ
  `useEnergyStore()`: `appleHealthBurnedKcal`, `lastAppleHealthSync`,
  `appleHealthStatus`.
- `src/screens/SettingsScreen.tsx` — thêm section mới "🏥 SỨC KHOẺ" (giữa Hồ sơ
  cơ thể và Thông báo): nút "🔄 Làm mới dữ liệu Apple Health" gọi
  `syncAppleHealthBurned()`, disable + spinner khi `appleHealthStatus ===
  'syncing'`, dòng "Lần đồng bộ gần nhất: Xm trước" + dòng trạng thái (✓ Đã kết
  nối / ⚠️ Ước tính — kiểm tra quyền Health / Đang đồng bộ…). Ghi thủ công vận
  động (`logActivity`/`TodayActivities`) giữ nguyên, có thêm 1 câu mô tả ngắn
  "Apple Health tự động theo dõi — chỉ cần ghi thủ công khi muốn bổ sung
  thêm".

## "Eaten Today" lấy từ đâu

**Tái dùng, không viết lại:** `summarizeFoodLog(foodLog).totalKcal` từ
`src/domain/food/foodLogSummary.ts` — đúng hàm `TodayMeals.tsx` đã dùng cho
dòng "Hôm nay đã ăn ⚡ N kcal". `EnergyBalanceCard` nhận `foodLog` (mảng thô,
`HomeScreen` đã có sẵn từ `useEnergyStore`) làm prop và tự gọi
`summarizeFoodLog` bên trong — giống hệt cách `TodayMeals` đã làm, để
`HomeScreen` không phải tính toán gì (đúng luật "giao diện ngu").

## Theme / dark mode

App chỉ có **một** theme tối duy nhất (`src/lib/theme.ts`, không có
Context/Provider chuyển sáng-tối — `app.json` set cứng
`userInterfaceStyle: "dark"`). Toàn bộ màu mới dùng đều lấy từ `colors` có
sẵn (`colors.mint`, `colors.danger`, `colors.warning`, `colors.successBgSoft`,
`colors.warningBgSoft`, `colors.textTertiary`...) — không thêm token màu mới,
không có nhánh light-mode nào cần xử lý.

## `Date.now()` / purity

Hook ESLint tự động (`react-hooks/purity`) chặn gọi `Date.now()` trực tiếp lúc
render (kể cả làm giá trị mặc định của tham số). Theo đúng khuôn mẫu sẵn có
của `useLiveEnergyReading.ts`: dùng `useState(() => Date.now())` (lazy
initializer) để lấy "now" một lần, truyền xuống làm prop bắt buộc
(`nowMs`) cho `AppleHealthStatusBadge`/`formatRelativeTime` — không cần
interval tick vì badge chỉ hiển thị độ chính xác theo phút.

## Xác nhận

- `npx tsc --noEmit` sạch
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`) — 0 error, 0 warning
- `npx jest` — **376 test PASS / 35 suite** (tăng từ 371/34 — thêm
  `relativeTime.test.ts` 5 test), toàn bộ test cũ (bao gồm 2 suite mới của
  backend agent, `appleHealthSync.test.ts` và `energyStore.appleHealth.test.ts`)
  vẫn xanh
- `npm run verify` (tsc+eslint+jest) — PASS toàn bộ, không có test/snapshot
  nào có sẵn cho `HomeScreen`/`SettingsScreen` (không có gì để cập nhật)
- 4 trạng thái `appleHealthStatus` đều có nhánh hiển thị riêng ở cả 2 màn
  hình (`idle`/`syncing`/`synced`/`estimated`) — xác nhận bằng đọc code, CHƯA
  test tay trên điện thoại thật (giống ghi chú của backend agent: Expo Go sẽ
  luôn rơi vào `'unavailable'` → `'estimated'`, cần dev client EAS mới thấy
  nhánh `'synced'` thật).

## Việc còn lại cho agent khác (Phase 6 — không phải việc của gói này)

- **Docs/QA agent:** hướng dẫn build dev client EAS để test nhánh 'synced'
  thật trên điện thoại (đã nêu trong `S-F2.md`), cập nhật `SESSION_LOG.md` /
  `docs/04-roadmap.md` cho toàn bộ S-F2 (backend + UI) — session này không tự
  sửa `SESSION_LOG.md` theo đúng luật gói song song.

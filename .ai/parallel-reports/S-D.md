# S-D · Tự xả pin theo thời gian + reset hàng ngày khi mở app

**Trạng thái:** ✅ Hoàn thành (chưa test thật trên điện thoại — chỉ verify `tsc` + `expo export`).

## File đã tạo / sửa

- **TẠO** `src/hooks/useDrainTick.ts` — hook `useDrainTick(modeId, enabled)`:
  - `setInterval` mỗi 30 phút: tính `elapsedHours` từ lần tick trước → gọi
    `useEnergyStore().tickDrain(elapsedHours, modeId)`.
  - Lắng nghe `AppState` 'change' → khi app quay lại `active` (mở lại từ nền),
    tính luôn phần thời gian đã trôi qua trong lúc app ở nền và gọi `tickDrain` ngay
    (bù phần xả pin trong lúc khoá màn hình / chuyển app khác).
  - Dọn `clearInterval` + `subscription.remove()` khi unmount (chống memory leak).
  - Dùng `useRef` cho `modeId` và mốc thời gian tick cuối để effect không bị tạo lại
    interval mỗi khi Mode đổi.

- **TẠO** `src/services/background/dailyResetCheck.ts` — hàm thuần
  `checkDateChanged(lastKnownDate: string): string | null`. So ngày hiện tại
  (`todayString()`) với `lastKnownDate`; trả về ngày mới nếu khác, `null` nếu chưa đổi.
  Không phụ thuộc React/DB, dễ test riêng nếu cần.

- **SỬA** `App.tsx`:
  - Thêm `useDrainTick(currentMode, ready)` ngay sau khi bootstrap xong (đọc
    `currentMode` từ `useSettingsStore`).
  - Thêm 1 effect riêng theo dõi đổi ngày: `setInterval` mỗi 15 phút **và** khi
    `AppState` chuyển sang `active`, gọi `checkDateChanged(lastDate)`; nếu phát
    hiện ngày mới → gọi `useEnergyStore.getState().loadToday(currentMode)` để
    nạp/tạo dữ liệu pin của ngày mới (dùng `loadToday` thay vì `resetForNewDay`
    vì nó đã tự kiểm tra DB trước khi tạo mặc định + có try/catch chống màn trống,
    giống cách `HomeScreen` đang dùng).
  - Không sửa `energyStore.ts` — chỉ gọi `tickDrain`/`loadToday` đã có sẵn.

## Ràng buộc đã tuân thủ

- Không dùng `expo-task-manager` — chỉ foreground (`setInterval` + `AppState`).
- Không đụng `package.json`, không thêm thư viện mới.
- Không sửa `src/store/energyStore.ts`, không sửa screen/component nào khác.
- Code + comment tiếng Anh; tên hàm/biến rõ nghĩa.

## Kiểm tra

```bash
npx tsc --noEmit
```
→ **Sạch với các file thuộc gói S-D** (`App.tsx`, `useDrainTick.ts`, `dailyResetCheck.ts`
không có lỗi nào). Lưu ý: lệnh này hiện báo lỗi ở các file `__tests__/*.test.ts` thuộc gói
**S-E** (thiếu type `jest`/`describe`/`expect` vì S-E chưa thêm devDependency `jest` vào
`package.json` — đây là việc của gói S-E, không thuộc phạm vi S-D nên không sửa).

```bash
npx expo export --platform ios --output-dir /tmp/check_S-D
```
→ **OK**: `iOS Bundled ... index.js (1406 modules)` (tăng 3 module so với baseline 1403
ở Session 4, đúng do 2 file mới + import thêm trong App.tsx).

## Chưa làm / cần test thật (giao cho gói S-A hoặc người dùng)

- Chưa test trên điện thoại thật: để app mở ~30 phút xem pin có giảm nhẹ không; khoá
  màn hình một lúc rồi mở lại xem có "bù" xả pin đúng không; chỉnh giờ máy sang ngày
  khác rồi mở lại app xem pin có reset cho ngày mới không.
- Khoảng thời gian tick (30 phút cho drain, 15 phút cho kiểm tra đổi ngày) là giá trị
  ước lượng hợp lý cho Phase 2 (foreground-only); có thể tinh chỉnh sau khi test thật
  nếu thấy pin xả quá nhanh/chậm so với `drainRatePerHour` của từng Mode.

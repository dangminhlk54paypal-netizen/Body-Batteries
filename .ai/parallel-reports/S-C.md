# S-C · Nhắc nhở hàng ngày + ngưỡng cảnh báo thật (Phase 2) — Báo cáo

**Trạng thái:** ✅ Hoàn thành phần bắt buộc · ⚠️ Phần tuỳ chọn chỉ chuẩn bị sẵn (xem mục cuối)

## File đã thay đổi
- SỬA `src/store/settingsStore.ts` — thêm `reminderHour` (mặc định 20), `reminderMinute`
  (mặc định 0), và setter `setReminderTime(hour, minute)`. Hai giá trị này được `persist`
  tự động như các field khác trong store.
- SỬA `src/screens/SettingsScreen.tsx`:
  - Nút "Bật thông báo" giờ gọi thật: bật → `requestNotificationPermission()` (nếu bị từ
    chối thì hiện Alert hướng dẫn vào Cài đặt máy, không bật switch), rồi
    `cancelAllNotifications()` + `scheduleDailyReminder(hour, minute)`. Tắt →
    `cancelAllNotifications()`.
  - Thêm UI chọn giờ nhắc: 2 bộ đếm +/− (giờ bước 1, phút bước 15) hiển thị dạng `HH : mm`,
    nằm ngay dưới nút bật/tắt thông báo. Đổi giờ lúc thông báo đang bật sẽ tự huỷ + đặt lại
    nhắc nhở với giờ mới.
  - `useEffect` chạy 1 lần khi mở màn hình: nếu `notificationsEnabled === true` thì đặt lại
    nhắc nhở theo giờ đã lưu — vì thông báo hẹn giờ được đăng ký ở cấp hệ điều hành, đề phòng
    trường hợp lịch hẹn ở OS bị mất (vd cài lại app) nhưng cờ trong AsyncStorage vẫn còn `true`.
- SỬA `src/domain/rules/lowBatteryRules.ts` — `checkLowBattery` nhận thêm tham số
  **optional** `threshold: number = LOW_BATTERY_THRESHOLD`. Không truyền thì hành vi y như cũ.

## Không đụng
Không sửa `App.tsx`, `HomeScreen.tsx`, `HistoryScreen.tsx`, `energyStore.ts`,
`package.json`, hay bất kỳ component pin nào. `notificationService.web.ts` (stub) giữ
nguyên, không đụng.

## ⚠️ Giới hạn của phần tuỳ chọn (ngưỡng cảnh báo thật)
Ngưỡng pin thấp (`lowBatteryThreshold`) **đã lưu được từ trước** (các chip 10/20/30% trong
Settings gọi `setLowBatteryThreshold` — phần này không phải lỗi mới, đã hoạt động đúng).

Cái còn thiếu là: `checkLowBattery` chưa thực sự *dùng* ngưỡng do người dùng chọn để cảnh
báo — nơi gọi nó (`src/store/energyStore.ts` dòng ~111, trong `addIntake`) vẫn gọi
`checkLowBattery(updated)` không kèm threshold, nên sẽ dùng mặc định cũ
(`LOW_BATTERY_THRESHOLD` từ `lib/constants.ts`). Tôi **không sửa được** chỗ này vì
`energyStore.ts` bị khoá cho gói S-C (tránh đụng gói khác).

**Việc cần làm thêm ở phiên sau (1 dòng, không rủi ro):** trong `energyStore.ts`, đổi
`return checkLowBattery(updated);` thành
`return checkLowBattery(updated, useSettingsStore.getState().lowBatteryThreshold);`
(import `useSettingsStore` từ `../store/settingsStore`). Đây đúng hướng kiến trúc (State
layer gọi xuống Domain layer, không phải Domain gọi lên State) nên không vi phạm
`docs/03-architecture.md`.

## Kiểm tra
- `npx tsc --noEmit` → sạch, exit 0.
- `npx expo export --platform ios` → `iOS Bundled ... (1404 modules)`. Không lỗi (số module
  giữ nguyên so với mốc S-B vì S-C chỉ sửa file có sẵn, không tạo file mới).

## Tiêu chí hoàn thành (đối chiếu)
- Tắt thông báo → huỷ nhắc nhở: ✅ (gọi `cancelAllNotifications`).
- Bật lại → đặt nhắc nhở hàng ngày: ✅ (xin quyền rồi `scheduleDailyReminder`).
- Đổi ngưỡng được lưu: ✅ (đã hoạt động từ trước, không phải việc mới của S-C).
- Đổi giờ nhắc được lưu và áp dụng lại nhắc nhở: ✅ (mới thêm).
- Ngưỡng người dùng chọn **thực sự** ảnh hưởng tới cảnh báo pin thấp khi nạp đồ: ⚠️ chưa,
  cần 1 dòng sửa ở `energyStore.ts` như trên (ngoài phạm vi gói này).

**Lưu ý:** chưa test thật trên điện thoại (xin quyền thông báo, lịch hàng ngày có bắn đúng
giờ không) — việc này thuộc gói S-A.

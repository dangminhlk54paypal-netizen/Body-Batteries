# 📋 Nhật ký tiến trình theo Session

> AI đọc file này để biết ngay chúng ta đã làm gì, lỗi gì đã xảy ra, và session tiếp theo cần bắt đầu từ đâu.
> Mỗi session kết thúc → AI thêm 1 mục vào đây.

---

## Session 1 — 2026-06-16

**Làm gì:** Viết toàn bộ source code app (Phase 0–3) không cần mạng.

**Kết quả:** 38 files TypeScript mới trong `src/` + config files.

**Files tạo ra:**
```
App.tsx, package.json, tsconfig.json, babel.config.js, app.json
src/types/battery.ts, modes.ts
src/lib/constants.ts, dateUtils.ts, encryption.ts
src/domain/battery/batteryEngine.ts
src/domain/modes/modeDefinitions.ts
src/domain/rules/lowBatteryRules.ts
src/data/db/schema.ts, database.ts
src/data/repositories/batteryRepository.ts, intakeRepository.ts, dailyLogRepository.ts
src/store/energyStore.ts, settingsStore.ts
src/services/notifications/notificationService.ts
src/services/export/excelExportService.ts
src/services/cleanup/cleanupService.ts
src/components/BatteryCell.tsx, MasterBattery.tsx, BatteryStack.tsx, ModeSelector.tsx, IntakeModal.tsx
src/screens/HomeScreen.tsx, HistoryScreen.tsx, DiaryScreen.tsx, SettingsScreen.tsx
src/navigation/AppNavigator.tsx
```

**Vấn đề gặp phải:** Node.js chưa cài → không thể chạy app thật.

**Lý do bỏ qua:** Tránh cài đặt qua mạng trong session không ổn định.

**Session tiếp theo phải làm:**
1. Cài Node.js LTS (nodejs.org) — cần wifi tốt ~5 phút
2. Mở terminal VS Code trong thư mục `my-body-batteries-app/`
3. Chạy: `npm install` (cần wifi ~3–5 phút lần đầu)
4. Chạy: `npx expo start`
5. Mở app Expo Go trên điện thoại → quét QR code
6. Kiểm tra màn hình Home có hiện viên pin không
7. Báo lỗi nếu có (thường gặp: thiếu thư viện, lỗi import)

---

## Session 2 — (chưa diễn ra)

> AI: sau khi làm xong session này, điền vào đây theo mẫu trên.

**Làm gì:**
**Kết quả:**
**Vấn đề gặp phải:**
**Session tiếp theo phải làm:**

---

## 📌 Hướng dẫn viết session log

Khi kết thúc một session, AI tự điền vào đây:
- **Làm gì:** mô tả 1–2 câu
- **Kết quả:** đạt được gì (files tạo, tính năng test thành công…)
- **Vấn đề gặp phải:** lỗi, cản trở, việc phải bỏ lại
- **Session tiếp theo phải làm:** danh sách cụ thể, theo thứ tự ưu tiên

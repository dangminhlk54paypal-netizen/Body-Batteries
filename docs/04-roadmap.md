# 04 — Lộ trình & Tiến độ (Roadmap)

> Nguyên tắc: **đi từng bước nhỏ, mỗi bước đều chạy được trên điện thoại**. Đừng làm tất cả cùng lúc. Mỗi Phase có "Tiêu chí hoàn thành" rõ ràng — xong mới sang Phase sau.

Cột "Agent phụ trách" trỏ tới các file trong `.ai/agents/`.

---

## 🔄 Phase 0 — Chuẩn bị môi trường (≈ 2–4 ngày)
**Mục tiêu:** máy tính & điện thoại sẵn sàng, app trống chạy được.

- [x] Cài Node.js LTS — **XONG** (v24.16.0)
- [x] Cài "Expo Go" trên điện thoại — **XONG** (đã kết nối thành công 1 lần)
- [x] AI tạo cấu trúc project TypeScript đầy đủ (`App.tsx`, `package.json`, `tsconfig.json`…)
- [x] Tạo cấu trúc thư mục theo `docs/03-architecture.md` — **XONG** (`src/` với 5 lớp)
- [ ] Chạy `npm install` rồi `npx expo start` — quét QR, thấy app trên điện thoại — **npm install xong. Session 4 tìm ra & vá nguyên nhân gốc khiến bundle luôn hỏng: `.watchmanconfig` bắt Watchman bỏ qua `node_modules`. Sau khi vá, `expo export` build thành công 1403 module (iOS) — app SẴN SÀNG hiện trên máy. Chỉ còn bước quét QR xác nhận.**

**Tiêu chí hoàn thành:** App hiện lên điện thoại (màn hình Home có viên pin), nạp được Protein rồi đóng/mở app vẫn còn dữ liệu.
**Agent phụ trách:** `architect`

> 🟢 **Trạng thái:** Bundle đã verify build OK (iOS + web). Tiếp theo: nối Personal Hotspot/tunnel → quét QR → xác nhận Home hiện 1 pin tổng + 6 pin nhỏ.

---

## 🔄 Phase 1 — MVP: Màn hình pin (≈ 2–3 tuần)
**Mục tiêu:** thấy được các viên pin và nạp/xả thủ công.

- [x] Vẽ `BatteryCell` + `MasterBattery` + `BatteryStack` — **XONG** (`src/components/`)
- [x] Màn hình Home hiển thị Master Battery + 6 pin nhỏ (Protein, Carbs, Nước, Khoáng, Ngủ, Vận động)
- [x] SQLite schema + database init + seed dữ liệu mặc định — **XONG** (`src/data/db/`)
- [x] Nút "Nạp" thủ công qua `IntakeModal` → pin tăng, lưu vào DB — **XONG**
- [ ] **Test thực tế:** nạp Protein, đóng app, mở lại vẫn thấy mức pin đúng

**Tiêu chí hoàn thành:** Bạn nạp Protein, đóng app, mở lại vẫn thấy mức pin đúng.
**Agent phụ trách:** `mobile-frontend` + `logic-backend`

> 🟡 **Trạng thái:** Code xong 100%. Chưa test trên điện thoại (chờ Node.js).

---

## 🔄 Phase 2 — Modes & Tự động hoá (≈ 2 tuần)
**Mục tiêu:** app bắt đầu "tự sống".

- [x] Định nghĩa Modes (Training / Maintain / Rest) — **XONG** (`src/domain/modes/modeDefinitions.ts`)
- [x] Mode thay đổi sức chứa (`capacityMultipliers`) & tốc độ xả (`drainRatePerHour`) — **XONG**
- [x] `ModeSelector` component + lưu vào `settingsStore` — **XONG**
- [x] Logic xả pin theo thời gian (`tickDrain` trong `energyStore`) — **XONG**
- [x] Thông báo "pin sắp cạn" (`notificationService.ts`) — **XONG**
- [x] Màn hình Settings: đặt ngưỡng cảnh báo — **XONG** (`src/screens/SettingsScreen.tsx`)
- [ ] **Test thực tế:** đổi Mode Training → thấy mục tiêu Protein tăng; nhận thông báo thật

**Tiêu chí hoàn thành:** Đổi sang Mode Training thấy mục tiêu Protein tăng; nhận được 1 thông báo nhắc nhở thật.
**Agent phụ trách:** `logic-backend`

> 🟡 **Trạng thái:** Code xong. Chưa test trên điện thoại.

---

## 🔄 Phase 3 — Excel, Diary & Dọn dẹp (≈ 1–2 tuần)
**Mục tiêu:** dữ liệu được lưu trữ và riêng tư.

- [x] Xuất Excel (`excelExportService.ts` dùng `xlsx` + `expo-file-system` + `expo-sharing`) — **XONG**
- [x] Tự xoá dữ liệu > 7 ngày (`cleanupService.ts`) — **XONG**
- [x] Màn hình Diary mã hoá write-only (`DiaryScreen.tsx` + `encryption.ts`) — **XONG**
- [ ] Biểu đồ xu hướng tuần (`victory-native`) — **CHƯA LÀM** (để khi test xong các màn kia)
- [ ] **Test thực tế:** xuất file Excel ra điện thoại; ghi nhật ký riêng tư

**Tiêu chí hoàn thành:** Bạn xuất được 1 file Excel ra điện thoại; ghi được nhật ký riêng tư.
**Agent phụ trách:** `logic-backend` + `mobile-frontend`

> 🟡 **Trạng thái:** 3/4 mục xong. Còn biểu đồ xu hướng.

---

## 🟠 Phase 4 — Tích hợp dữ liệu ngoài (≈ 2–3 tuần)
**Mục tiêu:** app nhận tín hiệu từ điện thoại/đồng hồ.

- [ ] Xin quyền & đọc số bước chân
- [ ] Tích hợp Health Connect (Android) / HealthKit (iOS): nhịp tim, giấc ngủ
- [ ] Đưa tín hiệu vào ảnh hưởng tốc độ xả pin

**Tiêu chí hoàn thành:** Đi bộ nhiều → pin năng lượng xả nhanh hơn tương ứng.
**Agent phụ trách:** `architect` + `logic-backend`

---

## 🔴 Phase 5 — Lớp thông minh (liên tục, làm sau cùng)
**Mục tiêu:** dự báo xu hướng (KHÔNG chẩn đoán bệnh).

- [ ] Thu thập ~1 tháng dữ liệu trước khi bật
- [ ] Phát hiện mẫu hình đơn giản (rule-based) trước
- [ ] Mô hình hồi quy / TensorFlow Lite chạy trên máy
- [ ] Gợi ý cá nhân hoá, kèm cảnh báo "chỉ tham khảo, hãy gặp bác sĩ"

**Tiêu chí hoàn thành:** App đưa ra 1 gợi ý xu hướng có ích, có disclaimer y tế đầy đủ.
**Agent phụ trách:** `data-ml`

> ⚠️ Phase này nhạy cảm về sức khoẻ. Đọc lại ranh giới trong `docs/01-vision-and-features.md` trước khi làm.

---

## 📊 Bảng tổng quan tiến độ

| Phase | Tên | Code | Test thật | Ghi chú |
|-------|-----|------|-----------|---------|
| 0 | Chuẩn bị | ✅ | 🟢 | **Bundle build OK (Session 4)** — chỉ còn quét QR xác nhận Home |
| 1 | MVP màn hình pin | ✅ | ⏳ | Code + bundle OK. Cần chạy thật: nạp pin + đóng/mở lại |
| 2 | Modes & tự động | ✅ | ⏳ | Đã vá lỗi đổi Mode không cập nhật sức chứa. Cần test thật |
| 3 | Excel, Diary, dọn dẹp | 🔄 | ⏳ | Còn thiếu biểu đồ xu hướng (victory-native) |
| 4 | Tích hợp dữ liệu | ⬜ | ⬜ | Chưa bắt đầu |
| 5 | Lớp thông minh | ⬜ | ⬜ | Chưa bắt đầu |

**Ký hiệu:** ✅ Xong | 🔄 Đang làm/chưa đủ | ⏳ Chờ môi trường | ⬜ Chưa bắt đầu

> 🚨 **Việc đầu tiên của session tiếp theo:** Nối Mac vào Personal Hotspot (hoặc dùng `--tunnel`), chạy `export PATH="/opt/homebrew/bin:$PATH"` rồi `npx expo start`, quét QR — **bundle đã verify OK nên Home phải hiện ra**. Chi tiết trong `.ai/SESSION_LOG.md` (Session 4).

> 💡 Cập nhật bảng này sau mỗi session để AI luôn biết đang ở đâu.

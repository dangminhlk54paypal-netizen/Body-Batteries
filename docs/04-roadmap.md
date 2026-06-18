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

> 🟢 **Trạng thái (2026-06-18, gói S-A):** Đã quét QR thật, app chạy được trên iPhone qua Expo Go
> (kể cả qua wifi trường có client isolation). Còn thiếu: xác nhận Home hiện đúng 1 pin tổng + 6
> pin nhỏ (việc này dừng giữa đường để bàn tính năng mới — xem `.ai/NEXT_SESSIONS.md` gói S-A).

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

> 🟡 **Trạng thái:** Code xong 100% (+92 unit test PASS, gói S-E). Chưa xác nhận đầy đủ test thật
> trên điện thoại (gói S-A đang dừng giữa đường, xem Phase 0).

---

## 🔄 Phase 2 — Modes & Tự động hoá (≈ 2 tuần)
**Mục tiêu:** app bắt đầu "tự sống".

- [x] Định nghĩa Modes (Training / Maintain / Rest) — **XONG** (`src/domain/modes/modeDefinitions.ts`)
- [x] Mode thay đổi sức chứa (`capacityMultipliers`) & tốc độ xả (`drainRatePerHour`) — **XONG**
- [x] `ModeSelector` component + lưu vào `settingsStore` — **XONG**
- [x] Logic xả pin theo thời gian (`tickDrain` trong `energyStore`) — **XONG**, và giờ được GỌI
  thật theo định kỳ qua `useDrainTick` (mỗi 30 phút + khi quay lại từ nền) — gói **S-D**.
- [x] Reset hàng ngày khi mở app sang ngày mới (`App.tsx` tự dò đổi ngày mỗi 15 phút +
  khi mở lại app, rồi gọi `loadToday` — **không phải** `resetForNewDay`, hàm đó hiện
  chưa được gọi ở đâu cả, xem ghi chú review tích hợp 2026-06-18) — **XONG** (S-D)
- [x] Thông báo "pin sắp cạn" (`notificationService.ts`) — **XONG**, nút bật/tắt trong Settings đặt
  & huỷ nhắc nhở hàng ngày thật, ngưỡng cảnh báo người dùng chọn được dùng thật — gói **S-C**.
- [x] Màn hình Settings: đặt ngưỡng cảnh báo — **XONG** (`src/screens/SettingsScreen.tsx`)
- [ ] **Test thực tế:** đổi Mode Training → thấy mục tiêu Protein tăng; nhận thông báo thật

**Tiêu chí hoàn thành:** Đổi sang Mode Training thấy mục tiêu Protein tăng; nhận được 1 thông báo nhắc nhở thật.
**Agent phụ trách:** `logic-backend`

> 🟡 **Trạng thái:** Code xong đầy đủ (gồm nhắc nhở thật + tự xả pin định kỳ thật, không còn là
> placeholder). Chưa xác nhận test thật trên điện thoại (gói S-A).

---

## 🔄 Phase 3 — Excel, Diary & Dọn dẹp (≈ 1–2 tuần)
**Mục tiêu:** dữ liệu được lưu trữ và riêng tư.

- [x] Xuất Excel (`excelExportService.ts` dùng `xlsx` + `expo-file-system` + `expo-sharing`) — **XONG**
- [x] Tự xoá dữ liệu > 7 ngày (`cleanupService.ts`) — **XONG**
- [x] Màn hình Diary mã hoá write-only (`DiaryScreen.tsx` + `encryption.ts`) — **XONG**
- [x] Biểu đồ xu hướng tuần — **XONG** (`TrendChart.tsx`, vẽ bằng `react-native-svg` đã có sẵn,
  KHÔNG dùng `victory-native` như dự kiến ban đầu — gói **S-B**; gói E3 nối thêm đường pin Năng
  lượng vào cùng biểu đồ)
- [ ] **Test thực tế:** xuất file Excel ra điện thoại; ghi nhật ký riêng tư

**Tiêu chí hoàn thành:** Bạn xuất được 1 file Excel ra điện thoại; ghi được nhật ký riêng tư.
**Agent phụ trách:** `logic-backend` + `mobile-frontend`

> 🟡 **Trạng thái:** Code xong đủ 4/4 mục. Chưa xác nhận test thật trên điện thoại (gói S-A).
>
> **Đã vượt phạm vi Phase 3 ban đầu (Session 5, chưa có mục riêng trong roadmap):** Food Log
> (ghi món ăn từ `food_items.csv`, xem/xoá "Hôm nay đã ăn" theo bữa) và pin Năng lượng hiển thị
> **xả mượt theo giây** (`LiveMasterBattery` + `useLiveEnergyReading`) — xem `docs/07-food-log.md`
> và `docs/06-energy-expenditure.md`.

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
| 0 | Chuẩn bị | ✅ | 🟡 | Đã quét QR thật trên iPhone qua Expo Go. Còn thiếu xác nhận Home đủ 7 pin |
| 1 | MVP màn hình pin | ✅ | ⏳ | Code + bundle OK (1424 module). Cần chạy thật: nạp pin + đóng/mở lại |
| 2 | Modes & tự động | ✅ | ⏳ | Nhắc nhở thật + tự xả pin định kỳ thật đã xong (S-C, S-D). Cần test thật |
| 3 | Excel, Diary, dọn dẹp | ✅ | ⏳ | Đủ 4/4 mục kể cả biểu đồ xu hướng (S-B). + Food Log/live drain (Session 5, ngoài phạm vi gốc) |
| 4 | Tích hợp dữ liệu | ⬜ | ⬜ | Chưa bắt đầu (xem S-F — v1 placeholder nhập tay, chưa phải Health thật) |
| 5 | Lớp thông minh | ⬜ | ⬜ | Chưa bắt đầu — cần dữ liệu cân nặng từ S-L trước (xem `.ai/NEXT_SESSIONS.md`) |

**Ký hiệu:** ✅ Xong | 🔄 Đang làm/chưa đủ | ⏳ Chờ môi trường | 🟡 Một phần | ⬜ Chưa bắt đầu

> 🚨 **Việc đầu tiên của session tiếp theo:** Xem `.ai/NEXT_SESSIONS.md` (file DUY NHẤT cho mọi
> gói) — đọc trước mục **S-M** (lật mô hình pin Năng lượng sang "đã ăn/mục tiêu", đã chốt với
> người dùng 2026-06-18, đụng lõi, **CHƯA code**, đề nghị làm MỘT MÌNH 1 đợt). Sẵn sàng làm song
> song ngay, không đụng ai: **S-A** (test máy, luôn ưu tiên), **U4/U5**. **S-K tạm dừng** (mâu
> thuẫn với S-M), **U1 đã gộp vào S-M** — đừng mở riêng. **S-F/U6** chờ S-M xong rồi làm tuần tự.
>
> 🟢 **(2026-06-18, Session 6)** Đã `git push` hết lên `origin/main` — không còn commit local nào
> treo lại. U2, U3 (đợt UX) đã xong.
>
> 🟢 **(2026-06-18, Session 7)** **S-L** (ghi cân nặng theo thời gian) đã xong. Quyết định lớn
> **S-M** đã chốt — xem trên.

> 💡 Cập nhật bảng này sau mỗi session để AI luôn biết đang ở đâu.

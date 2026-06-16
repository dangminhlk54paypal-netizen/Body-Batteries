# 04 — Lộ trình & Tiến độ (Roadmap)

> Nguyên tắc: **đi từng bước nhỏ, mỗi bước đều chạy được trên điện thoại**. Đừng làm tất cả cùng lúc. Mỗi Phase có "Tiêu chí hoàn thành" rõ ràng — xong mới sang Phase sau.

Cột "Agent phụ trách" trỏ tới các file trong `.ai/agents/`.

---

## 🟢 Phase 0 — Chuẩn bị môi trường (≈ 2–4 ngày)
**Mục tiêu:** máy tính & điện thoại sẵn sàng, app trống chạy được.

- [ ] Cài Node.js, Git, VS Code, extension AI
- [ ] Cài "Expo Go" trên điện thoại
- [ ] AI tạo project Expo trống (TypeScript)
- [ ] Tạo cấu trúc thư mục theo `docs/03-architecture.md`
- [ ] Chạy thử: quét QR code, thấy màn hình "Hello" trên điện thoại

**Tiêu chí hoàn thành:** App trống hiện lên điện thoại của bạn.
**Agent phụ trách:** `architect`

---

## 🟢 Phase 1 — MVP: Màn hình pin (≈ 2–3 tuần)
**Mục tiêu:** thấy được các viên pin và nạp/xả thủ công.

- [ ] Vẽ `BatteryCell` (1 viên pin) và `BatteryStack` (khối pin)
- [ ] Màn hình Home hiển thị Master Battery + vài pin nhỏ (Protein, Đường, Nước)
- [ ] Cài SQLite + tạo các bảng (`battery_types`, `battery_readings`, `intake_events`)
- [ ] Nút "Nạp" thủ công → pin tăng, lưu vào DB
- [ ] Dữ liệu còn nguyên sau khi đóng/mở lại app

**Tiêu chí hoàn thành:** Bạn nạp Protein, đóng app, mở lại vẫn thấy mức pin đúng.
**Agent phụ trách:** `mobile-frontend` + `logic-backend`

---

## 🟡 Phase 2 — Modes & Tự động hoá (≈ 2 tuần)
**Mục tiêu:** app bắt đầu "tự sống".

- [ ] Định nghĩa Modes (Training / Maintain / Rest) trong `domain/modes`
- [ ] Mode thay đổi sức chứa & tốc độ xả
- [ ] Daily reset đầu ngày
- [ ] Xả pin tự động theo thời gian
- [ ] Thông báo "pin sắp cạn" (`expo-notifications`)
- [ ] Màn hình Settings: đặt ngưỡng cảnh báo

**Tiêu chí hoàn thành:** Đổi sang Mode Training thấy mục tiêu Protein tăng; nhận được 1 thông báo nhắc nhở thật.
**Agent phụ trách:** `logic-backend`

---

## 🟡 Phase 3 — Excel, Diary & Dọn dẹp (≈ 1–2 tuần)
**Mục tiêu:** dữ liệu được lưu trữ và riêng tư.

- [ ] Xuất Excel hàng tuần (`xlsx` + `expo-file-system`)
- [ ] Tự xoá dữ liệu > 1 tuần khỏi app
- [ ] Màn hình Diary mã hoá (write-only)
- [ ] Biểu đồ xu hướng tuần (`victory-native`)

**Tiêu chí hoàn thành:** Bạn xuất được 1 file Excel ra điện thoại; ghi được nhật ký riêng tư.
**Agent phụ trách:** `logic-backend` + `mobile-frontend`

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

| Phase | Tên | Thời lượng ước tính | Trạng thái |
|-------|-----|---------------------|-----------|
| 0 | Chuẩn bị | 2–4 ngày | ⬜ Chưa bắt đầu |
| 1 | MVP màn hình pin | 2–3 tuần | ⬜ |
| 2 | Modes & tự động | 2 tuần | ⬜ |
| 3 | Excel, Diary, dọn dẹp | 1–2 tuần | ⬜ |
| 4 | Tích hợp dữ liệu | 2–3 tuần | ⬜ |
| 5 | Lớp thông minh | Liên tục | ⬜ |

> 💡 Cập nhật cột "Trạng thái" (⬜ → 🔄 → ✅) khi làm xong, để AI luôn biết bạn đang ở đâu.

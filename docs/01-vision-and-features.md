# 01 — Tầm nhìn & Tính năng

## 🎯 Ý tưởng cốt lõi

**My Body Batteries** biến cơ thể người thành một hệ thống pin thông minh — giống bảng điều khiển pin của xe điện. Người dùng nhìn vào là hiểu ngay "hôm nay mình còn bao nhiêu năng lượng, cần nạp gì, đang xả gì".

Triết lý thiết kế: *Cơ thể cũng như viên pin — có lúc sạc, có lúc xả, có tuổi thọ, có sức chứa, và mỗi người (trẻ em, thanh niên, người trưởng thành, người bệnh) có "đặc tính pin" khác nhau.*

---

## 📱 Màn hình chính (Home / Dashboard)

- Một **"khối pin lớn" (Master Battery)** thể hiện tổng năng lượng cơ thể trong ngày.
- Bên trong gồm các **"pin nhỏ" (Sub-batteries)** đại diện cho từng nhóm dưỡng chất / chỉ số:
  - 🥩 Protein (giảm dần mỗi ngày)
  - 🍬 Đường / Carb
  - 🧂 Khoáng chất & điện giải
  - 💧 Nước
  - 😴 (mở rộng sau) Giấc ngủ, tâm trạng, vận động...
- Mỗi pin nhỏ hiển thị: **mức hiện tại (%)**, **sức chứa tối đa**, **màu cảnh báo** (xanh → vàng → đỏ).
- Người dùng có thể **chọn hiển thị** loại pin nào (tuỳ Mode đang bật).

> Các loại pin nhỏ là **danh sách mở rộng được** — thêm loại mới phải dễ dàng (xem skill `add-battery-type`).

---

## ⚙️ Tính năng chính (Features)

### 1. Modes (Chế độ)
Mỗi Mode thay đổi *mục tiêu nạp* và *tốc độ xả* của từng pin.

| Mode | Mô tả | Ví dụ ảnh hưởng |
|------|-------|------------------|
| **Build cơ (Training)** | Tập luyện cường độ cao | Protein cần nạp nhiều hơn, xả nhanh hơn |
| **Duy trì (Maintain)** | Sinh hoạt bình thường | Mục tiêu cân bằng |
| **Nghỉ ngơi (Rest)** | Cuối tuần, ít vận động | Giảm mục tiêu, xả chậm |
| (mở rộng) Theo tháng / năm | Mục tiêu dài hạn | Tổng hợp xu hướng |

### 2. Nạp & Xả năng lượng
- **Nạp:** ghi lại bữa ăn / dưỡng chất → pin tăng.
- **Xả:** tự động giảm theo thời gian trong ngày + theo Mode + theo hoạt động.

### 3. Backend thông minh & tự động
- 🔄 **Reset mỗi ngày:** đầu ngày các pin nạp lại theo mục tiêu của Mode.
- 🔔 **Nhắc nhở trong ngày:** nếu một pin sắp cạn → gửi thông báo.
- 🚨 **Cảnh báo thiếu ăn nghiêm trọng:** theo ngưỡng người dùng tự thiết lập.
- 📊 **Tự lưu Excel:** dữ liệu năng lượng/ăn uống tự xuất ra file Excel lưu trên điện thoại, và **tự xoá khỏi app sau 1 tuần** (chỉ giữ bản Excel).

### 4. Diary (Nhật ký) — chế độ riêng tư
- Người dùng **ghi đè (write-only)** vào nhật ký.
- App **không có quyền đọc lại / truy xuất** nội dung này cho mục đích phân tích → đảm bảo riêng tư.
- Kỹ thuật: lưu mã hoá, chỉ giải mã khi chính người dùng mở (xem `docs/03-architecture.md`).

### 5. Lớp thông minh nâng cao (giai đoạn sau)
- Học dữ liệu ~1 tháng để **nhận diện xu hướng** (ăn uống, cảm xúc, stress, giấc ngủ).
- Gợi ý điều chỉnh ("dạo này bạn thường cạn pin Protein vào chiều thứ 3...").
- **"Neural net cá nhân"**: mô hình nhỏ chạy *trên máy* (on-device) để dự báo xu hướng năng lượng.

### 6. Tích hợp dữ liệu bên ngoài (tương lai)
- Đồng hồ thông minh: nhịp tim, giấc ngủ, calo.
- Điện thoại: số bước chân, vận động.
- Mục tiêu: càng nhiều tín hiệu, dự báo càng chính xác.

---

## ⚠️ Ranh giới về sức khoẻ (đọc kỹ)

Đây là phần **cực kỳ quan trọng** và phải được tôn trọng trong suốt quá trình phát triển:

1. App **KHÔNG phải thiết bị y tế** và không được tự nhận là chẩn đoán bệnh.
2. Tính năng "dự báo bệnh lý nền" phải được **diễn đạt lại** thành *"phát hiện xu hướng / mẫu hình bất thường để bạn cân nhắc đi khám"* — không bao giờ đưa ra chẩn đoán.
3. Mọi cảnh báo sức khoẻ phải kèm câu: *"Đây chỉ là tham khảo, hãy gặp chuyên gia y tế."*
4. Không tự đặt mục tiêu calo/dinh dưỡng cực đoan; tránh nội dung khuyến khích nhịn ăn hoặc rối loạn ăn uống.

> AI làm việc trong dự án này phải tuân thủ ranh giới trên (đã ghi lại trong `.ai/CONTEXT.md`).

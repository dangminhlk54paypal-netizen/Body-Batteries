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
- **Ghi tập luyện chi tiết:**
  - **S-PL (Powerlifting):** Squat/Bench/Deadlift theo set×rep×tạ, mô hình vật lý (công nâng + đốt lúc nghỉ).
  - **S-BB (Bodybuilding):** ~45 bài phụ trợ/cô lập theo 8 nhóm cơ, mô hình MET-tier×cường độ (isolate, compound, superset).
  - Các hoạt động khác: chạy, đạp xe, HIIT, yoga... (MET-based, theo phút hoặc bước chân).

### 2.1. Ghi Nạp/Xả cho ngày quá khứ (3 ngày gần nhất)
- **Món ăn (Nạp):** trước đây cho lùi tối đa 35 ngày, giờ SIẾT về tối đa 3 ngày (hôm qua/hôm kia/hôm kìa) để thống nhất.
- **Vận động (Xả):** giờ đã thêm khả năng ghi cho ngày quá khứ, cũng tối đa 3 ngày, có chip nhanh "Hôm kìa" và dòng cảnh báo hiển thị đang ghi cho ngày nào.
- **Cơ chế:** khi ghi vận động cho ngày cũ, pin Vận động/mục tiêu ăn của **NGÀY ĐÓ** được cập nhật, còn pin Năng lượng/Vận động của **HÔM NAY** không hề bị ảnh hưởng.
- **Giới hạn đã biết:** hiện chưa có màn hình xem lại hoặc xoá vận động đã ghi cho ngày quá khứ — nếu gõ nhầm số cho "Hôm kìa" thì chưa có cách sửa trong app ở bản này.

### 3. Backend thông minh & tự động
- 🔄 **Reset mỗi ngày:** đầu ngày các pin nạp lại theo mục tiêu của Mode.
- 🔔 **Nhắc nhở trong ngày:** nếu một pin sắp cạn → gửi thông báo.
- 🚨 **Cảnh báo thiếu ăn nghiêm trọng:** theo ngưỡng người dùng tự thiết lập.
- 📊 **Tự lưu Excel:** dữ liệu năng lượng/ăn uống tự xuất ra file Excel lưu trên điện thoại, và **tự xoá khỏi app sau 1 tuần** (chỉ giữ bản Excel).

### 3.1. Fix parse dấu phẩy thập phân
- Bàn phím decimal-pad trên iPhone locale VI/DE dùng dấu phẩy (vd gõ "79,4"), nhưng `parseFloat` cắt tại dấu phẩy.
- Đã thêm hàm `parseDecimal()` trong `src/lib/units.ts` (thay `,` thành `.` trước khi parse).
- Áp dụng ở TẤT CẢ các ô nhập số thập phân trong app: cân nặng, hồ sơ cơ thể, khối lượng món ăn, gram/khẩu phần, kcal thủ công, số phút/số bước vận động, tạa/reps, form thêm món tùy chỉnh.

### 3.2. Đổi tên nút dưới pin chính
- Bỏ nút "🍽️ Ăn thêm (kcal)" và modal nhập calo tay đi kèm.
- 2 nút còn lại đổi tên: "🍱 Ghi món ăn (từ danh sách)" → "⚡ Nạp", "🏃 Vận động" → "🔥 Xả".
- Đã dịch đủ 3 ngôn ngữ (VI/EN/DE) — i18n-covered.

### 3.3. Tiêu đề mục trong Cài đặt to/đậm hơn
- Các tiêu đề mục (NGÔN NGỮ, HỒ SƠ CƠ THỂ, SỨC KHOẺ, THÔNG BÁO, KHUNG GIỜ BỮA ĂN, DỮ LIỆU, GIAO DIỆN) tăng cỡ chữ và độ đậm để nổi bật hơn so với mô tả bên dưới.

### 3.4. Biểu đồ/badge "Lịch sử 7 ngày" đổi màu để dễ phân biệt
- Trước đây "Dinh dưỡng" và "Năng lượng" đều dùng tông vàng-cam khó phân biệt.
- Giờ Dinh dưỡng = xanh dương, Năng lượng = cam — áp dụng cho cả đường biểu đồ lẫn viền badge trên từng thẻ ngày.

### 3.5. Sheet "Khuyến nghị hàng ngày" khi bấm vào pin chính
- Bấm vào viên pin năng lượng chính ở màn Home giờ mở ra 1 bảng khuyến nghị dinh dưỡng/lối sống tổng quan dựa theo hồ sơ cơ thể (tuổi/giới/chiều cao/cân nặng).
- Nội dung: mục tiêu calo, cân nặng khỏe mạnh theo BMI, đạm, tinh bột, giới hạn đường và muối, nước, vận động, giấc ngủ.
- Mỗi mục có ghi chú nguồn tham khảo (WHO/EFSA/IOM/National Sleep Foundation...).
- Có dòng miễn trừ trách nhiệm "Chỉ để tham khảo — không phải tư vấn y tế" ở cuối.
- Đầy đủ 3 ngôn ngữ (VI/EN/DE) — i18n-covered.
- **Quyết định kỹ thuật:** tái sử dụng đúng công thức tính nước và giấc ngủ đã có sẵn trong app (dùng ở màn Home khi ghi nước/ngủ tay) thay vì tạo công thức riêng — để đảm bảo 2 nơi trong app luôn cho ra cùng 1 con số cho cùng 1 hồ sơ.

### 3.6. Giao diện Sáng/Tối (light/dark theme)
- Thêm lựa chọn chủ đề trong Cài đặt → mục GIAO DIỆN: 2 nút "🌙 Tối" / "☀️ Sáng".
- Chọn Sáng thì toàn bộ app (mọi màn hình, thanh tab, thanh trạng thái) đổi sang nền trắng ngay lập tức, không cần khởi động lại app.
- Chế độ Tối là mặc định và giữ nguyên y hệt giao diện cũ (không có gì đổi nếu không bấm sang Sáng).
- Lựa chọn được ghi nhớ qua lần mở app sau.
- Đầy đủ i18n — i18n-covered.

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

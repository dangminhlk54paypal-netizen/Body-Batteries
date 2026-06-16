# Skill: create-screen (Tạo màn hình mới)

## Mục đích
Tạo một màn hình mới đúng cấu trúc dự án, kết nối điều hướng (navigation), và sẵn sàng hiển thị trên điện thoại.

## Đầu vào cần (hỏi người dùng nếu thiếu)
- Tên màn hình (vd: "History", "Settings", "Diary")
- Màn hình này hiển thị gì, người dùng làm gì trên đó
- Có cần đọc/ghi dữ liệu không

## Các bước
1. Tạo file màn hình trong `src/screens/<TenManHinh>Screen.tsx`.
2. Đăng ký vào hệ thống điều hướng (navigation) để mở được từ menu/nút.
3. Nếu cần dữ liệu → kết nối tới store (Zustand), KHÔNG gọi DB trực tiếp.
4. Tách các khối UI tái sử dụng ra `src/components`.
5. Đặt nội dung tạm (placeholder) để xem bố cục trước, rồi hoàn thiện dần.
6. Chạy thử trên điện thoại: mở được màn hình, điều hướng qua lại mượt.

## Kết quả mong đợi
- Màn hình mới mở được trên thiết bị, đúng vị trí trong điều hướng.
- Logic (nếu có) nằm ở domain/store, không nằm trong file màn hình.

## Lưu ý
- Giữ màn hình "ngu" (chỉ hiển thị + phát sự kiện).
- Tên file/biến tiếng Anh; trao đổi với người dùng bằng tiếng Việt.

# Skill: add-battery-type (Thêm loại pin mới)

## Mục đích
Thêm một loại "pin nhỏ" mới vào app (vd: Magnesium, Vitamin C, Nước) một cách nhất quán, đúng mọi nơi cần thiết.

## Đầu vào cần (hỏi người dùng nếu thiếu)
- `id`: mã ngắn không dấu, chữ thường (vd: `magnesium`)
- `name`: tên hiển thị (vd: "Magnesium")
- `unit`: đơn vị (vd: `mg`)
- `default_capacity`: sức chứa mặc định mỗi ngày
- `color`: màu hiển thị
- `icon`: tên icon
- Tốc độ/quy tắc xả (nếu khác mặc định)

## Các bước
1. Thêm bản ghi mới vào nguồn định nghĩa pin (seed của bảng `battery_types`).
2. Nếu có quy tắc nạp/xả riêng → khai báo trong `src/domain/battery`.
3. Cập nhật mục tiêu của loại pin này trong từng Mode (`src/domain/modes`) nếu cần.
4. Đảm bảo `BatteryStack` tự render pin mới (không hard-code danh sách pin).
5. Thêm vào màn hình Settings để người dùng bật/tắt hiển thị.
6. Chạy thử trên điện thoại: pin mới hiện ra, nạp/xả đúng.

## Kết quả mong đợi
- Pin mới xuất hiện trên Home, nạp/xả đúng, lưu được vào DB, reset đúng theo Mode.
- Không phải sửa code rải rác — chỉ thêm dữ liệu định nghĩa + (nếu cần) quy tắc.

## Lưu ý
- Tránh tạo quá nhiều pin cùng lúc gây rối màn hình — gợi ý người dùng chọn lọc.
- Mọi tên kỹ thuật bằng tiếng Anh; giải thích cho người dùng bằng tiếng Việt.

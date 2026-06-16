# 🧩 Skills — Hướng dẫn sử dụng

## Skill là gì?

Một **skill** là một "công thức nấu ăn" cho việc bạn làm đi làm lại nhiều lần. Thay vì giải thích lại từ đầu mỗi lần, bạn chỉ cần gọi tên skill và AI làm theo các bước đã ghi sẵn — kết quả nhất quán.

Khác với **agent** (một *vai trò* rộng), **skill** là một *quy trình cụ thể, có các bước rõ ràng*.

Mỗi skill là một file `.md` trong thư mục này.

## Cách GỌI một skill

Gõ tự nhiên trong khung chat, ví dụ:

```
Chạy skill "add-battery-type" để thêm loại pin Magnesium, đơn vị mg.
```

AI mở file skill tương ứng và thực hiện đúng các bước trong đó.

## Danh sách skills hiện có

| Skill | Dùng để |
|-------|---------|
| [`add-battery-type`](add-battery-type.md) | Thêm một loại pin mới (vd: Magnesium, Vitamin C) |
| [`create-screen`](create-screen.md) | Tạo một màn hình mới đúng cấu trúc dự án |

## Cách TẠO skill mới

1. Nhận ra một việc bạn làm lặp lại → biến nó thành skill.
2. Copy một file skill có sẵn làm mẫu.
3. Ghi rõ: **Mục đích / Đầu vào cần / Các bước / Kết quả mong đợi**.
4. Thêm vào bảng "Danh sách skills" ở trên.
5. Hoặc nhờ AI: *"Tạo skill mới tên X để làm Y, theo mẫu trong thư mục này."*

> Skill phải đủ chi tiết để AI làm theo mà không cần hỏi lại nhiều. Mọi skill tuân theo `.ai/CONTEXT.md`.

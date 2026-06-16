# 🤖 Agents — Hướng dẫn sử dụng

## Agent là gì?

Một **agent** là một "vai trò" mà AI nhập vào để tập trung làm tốt một loại việc. Thay vì AI làm mọi thứ chung chung, bạn gọi đúng "chuyên gia" cho từng nhiệm vụ.

Mỗi agent là một file `.md` trong thư mục này, mô tả: vai trò, nhiệm vụ, nguyên tắc, và những gì nên/không nên làm.

## Cách GỌI một agent (trong khung chat AI)

Gõ tự nhiên bằng tiếng Việt, ví dụ:

```
Dùng agent "mobile-frontend": hãy làm màn hình Home với các viên pin.
```

hoặc

```
Đọc .ai/agents/logic-backend.md và áp dụng vai trò đó để viết phần reset pin hàng ngày.
```

AI sẽ mở file agent tương ứng, nhập vai, rồi làm việc theo đúng nguyên tắc của vai trò đó.

## Danh sách agents hiện có

| Agent | Khi nào dùng |
|-------|--------------|
| [`architect`](architect.md) | Lên cấu trúc, setup dự án, quyết định kỹ thuật lớn |
| [`mobile-frontend`](mobile-frontend.md) | Làm giao diện: màn hình, viên pin, biểu đồ, animation |
| [`logic-backend`](logic-backend.md) | Logic năng lượng, lưu trữ, thông báo, tác vụ nền |
| [`data-ml`](data-ml.md) | Phân tích dữ liệu & lớp dự báo thông minh (Phase 5) |
| [`qa-reviewer`](qa-reviewer.md) | Kiểm tra chất lượng, tìm lỗi, rà soát code |

## Cách TẠO agent mới

1. Copy một file agent có sẵn làm mẫu.
2. Đổi tên file thành vai trò mới (vd: `marketing-copy.md`).
3. Điền các mục: **Vai trò / Nhiệm vụ / Nguyên tắc / Nên / Không nên**.
4. Thêm vào bảng "Danh sách agents" ở trên.
5. (Nếu cần) Nhờ AI: *"Tạo giúp tôi một agent mới tên X làm việc Y theo mẫu trong thư mục này."*

> Mọi agent đều phải tuân theo luật chung trong `.ai/CONTEXT.md` (đặc biệt: nói tiếng Việt, code tiếng Anh).

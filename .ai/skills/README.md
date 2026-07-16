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

| Skill | Dùng để | Khi nào gọi |
|-------|---------|-------------|
| [`add-battery-type`](add-battery-type.md) | Thêm một loại pin mới (vd: Magnesium, Vitamin C) | Khi muốn theo dõi thêm chất dinh dưỡng |
| [`create-screen`](create-screen.md) | Tạo một màn hình mới đúng cấu trúc dự án | Khi cần thêm màn hình mới vào app |
| [`session-wrapup`](session-wrapup.md) | Tổng kết & ghi chép cuối session — tự đọc git, cập nhật SESSION_LOG + CONTEXT + roadmap | Cuối ngày, sau git push/merge, hoặc xong tính năng lớn |
| [`learn-pattern`](learn-pattern.md) | Ghi bài học từ bug lặp lại vào [`learned/`](learned/) | Khi một lỗi mất >2 lần thử mới sửa được |
| [`expo-react-native-dev`](expo-react-native-dev.md) | Mẹo & pattern Expo SDK 54 / React Native cho dự án này | Khi làm việc với API Expo/RN lạ |
| [`sqlite-expo-patterns`](sqlite-expo-patterns.md) | Pattern dùng expo-sqlite đúng cách trong dự án | Khi viết/sửa tầng data (db, repositories) |
| [`add-language`](add-language.md) | Thêm ngôn ngữ hiển thị mới (ngoài Việt/Anh/Đức) cho UI + Excel | Khi muốn app hỗ trợ thêm 1 ngôn ngữ |

## Skills native của Claude Code (có sẵn, không cần file)

Ngoài skills của dự án, Claude Code có sẵn các skill gọi bằng lệnh `/`:
`/code-review` (soát lỗi diff hiện tại), `/simplify` (dọn code thừa — đúng tinh thần "không viết
thừa"), cùng các skill tự kích hoạt như verify-trước-khi-báo-xong, test-driven-development,
systematic-debugging. Cổng kiểm tra tay: `npm run verify` (tsc + eslint + jest).

## Cách TẠO skill mới

1. Nhận ra một việc bạn làm lặp lại → biến nó thành skill.
2. Copy một file skill có sẵn làm mẫu.
3. Ghi rõ: **Mục đích / Đầu vào cần / Các bước / Kết quả mong đợi**.
4. Thêm vào bảng "Danh sách skills" ở trên.
5. Hoặc nhờ AI: *"Tạo skill mới tên X để làm Y, theo mẫu trong thư mục này."*

> Skill phải đủ chi tiết để AI làm theo mà không cần hỏi lại nhiều. Mọi skill tuân theo `.ai/CONTEXT.md`.

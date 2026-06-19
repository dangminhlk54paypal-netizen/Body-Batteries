# Skill: learn-pattern (Học hỏi & Ghi nhớ bản năng)

## Mục đích
Khi AI phát hiện một lỗi khó (bug lặp lại nhiều lần, lỗi đặc thù của thư viện, cấu hình sai) và giải quyết thành công, AI gọi skill này để lưu lại thành "Bản năng" (Instinct) cho các phiên sau.

Gọi skill này khi:
- Sửa xong một bug mà mất nhiều thời gian để tìm ra.
- Tìm ra một "công thức" viết code ổn định trong dự án mà nên tuân theo mãi mãi.

---

## Các bước thực hiện

### Bước 1 — Rút trích bài học
AI tóm tắt nội dung bài học theo cấu trúc sau:
1. **Triệu chứng (Symptom):** Lỗi hiện ra như thế nào? (Log, màn hình vỡ, v.v.)
2. **Nguyên nhân (Root Cause):** Tại sao xảy ra lỗi? (Do phiên bản thư viện, do gọi sai state, v.v.)
3. **Cách khắc phục (Resolution):** Đoạn code đúng là gì?

### Bước 2 — Lưu vào thư mục `learned`
- Nếu thư mục `.ai/skills/learned/` chưa tồn tại, hãy dùng lệnh tạo thư mục đó.
- Tạo một file `.md` với tên mang tính gợi nhớ (ví dụ: `fix-expo-router-cache.md` hoặc `reanimated-style-bug.md`).
- Lưu nội dung vừa tóm tắt vào file này.

### Bước 3 — Báo cáo cho người dùng
Thông báo: "🧠 Tôi đã học được một pattern mới và lưu vào `.ai/skills/learned/[tên-file].md`. Lần sau gặp lỗi này tôi sẽ biết cách tự xử lý ngay!"

---

## Lưu ý
- Các bài học nên cực kỳ ngắn gọn, tập trung vào code giải quyết vấn đề.
- Chỉ tạo bài học cho những lỗi "có giá trị tái sử dụng", không lưu lại những lỗi gõ sai chính tả (typo) cơ bản.

# Skill: learn-with-ai (Biến việc AI đã làm được thành bài giảng cho người học)

## Mục đích
Khi chủ dự án thấy một **tính năng hay** hoặc một **nghiên cứu** mà AI đã thực thi thành công trong app, họ muốn nó
thành tài liệu **con người đọc hiểu, học được và tự làm lại được**. Người đọc mặc định là **sinh viên năm nhất đại
học**: biết JavaScript cơ bản và từng viết một component React, chưa biết thư viện chuyên sâu.
Bài mẫu đã được duyệt: [`docs/LearnWithAI/2026-09-26-thanh-tab-song-bong-bong.md`](../../docs/LearnWithAI/2026-09-26-thanh-tab-song-bong-bong.md).

## Khi nào gọi
- Chủ dự án nói: "viết bài giảng", "dạy lại", "chuyển thành tài liệu học", "LearnWithAI", "cho người mới tự làm được".
- Chỉ viết về thứ **đã chạy được** trong app (đã qua `npm run verify`, tốt nhất là đã được chủ dự án xác nhận trên
  máy thật). Chưa chạy được thì nói rõ trạng thái ở đầu bài, không trình bày như đã thành công.

## Các bước

### 1. Thu thập từ chính dự án
- Code thật của tính năng: file, hàm, test. Link bằng đường dẫn tương đối (`../../src/...`).
- Lịch sử làm: `.ai/SESSION_LOG.md`, `.ai/skills/learned/`, báo cáo trong `docs/nghien-cuu/`.
- **Câu chuyện gỡ lỗi**: các giả thuyết sai, vì sao sai, manh mối nào dẫn tới đáp án. Đây thường là phần người học
  học được nhiều nhất. Không được giấu những lần AI đoán sai.

### 2. Minh bạch nguồn gốc (bắt buộc)
Bài phải có mục **"Ý tưởng đến từ đâu (và AI đã làm thế nào)"**, trả lời thẳng:
- **Ý tưởng** bắt nguồn từ đâu: yêu cầu của chủ dự án, sản phẩm có sẵn (vd. Dock macOS), bài báo, repo GitHub.
  Nếu **không** sao chép repo nào thì ghi rõ "không có repo nào được sao chép".
- **Kiến thức của AI** đến từ đâu, tách rõ:
  (a) dữ liệu huấn luyện, (b) tài liệu chính thức mở lại trong phiên, (c) đọc code thư viện trong `node_modules`
  hoặc trên GitHub, (d) con số do AI tự chọn rồi chỉnh theo phản hồi (đánh dấu 💡).
- **Quy trình** AI đã đi, dạng sơ đồ một dòng, để người học làm y hệt.

### 3. Kiểm chứng như `research-report`
Mọi câu nói về API, hành vi thư viện, công thức, con số đều phải có nguồn: mở trang gốc trong phiên, đúng **phiên bản
thư viện app đang dùng** (vd. Gesture Handler 2.x, Expo SDK 57). Dùng cùng bảng ký hiệu `[n]` / `[Mã: file]` / 💡 / ❓
như [`research-report`](research-report.md). Trang tài liệu là bản mới hơn bản app dùng → ghi rõ.

### 4. Cấu trúc bài giảng
1. Hộp đầu bài: dành cho ai, học xong làm được gì, thời gian tự học, link code thật.
2. Bảng ký hiệu trích dẫn + ngày truy cập.
3. Mục lục.
4. §0 Ý tưởng đến từ đâu + AI biết từ đâu + quy trình.
5. §1 Khái niệm nền: tối đa khoảng 4 khái niệm, mỗi cái một định nghĩa có nguồn và một ví dụ code 2–3 dòng.
6. §2 Phần toán/logic thuần, kèm **một ví dụ tính tay bằng số thật** (bảng).
7. §3 Làm từng bước (Bước 1…n): mỗi bước một đoạn code ngắn, chạy được, có chú thích tiếng Việt. Đánh dấu ⚠ chỗ dễ
   sai và đặt **cặp ĐÚNG / SAI** cạnh nhau.
8. §4 Mở rộng (nếu có).
9. §5 Câu chuyện gỡ lỗi: bảng "Lần · Giả thuyết · Đã làm · Kết quả", manh mối quyết định, bài học.
10. §6 Kiểm thử: unit test / render test / máy thật, mỗi loại kiểm tra được gì và giới hạn của nó.
11. §7 Bài tập: 4–6 bài từ Dễ → Khó, có gợi ý. Nên có một bài "cố tình tái hiện lỗi rồi sửa".
12. §8 Từ điển thuật ngữ.
13. §9 Nguồn tham khảo: nhóm theo loại (ý tưởng / tài liệu chính thức / mã nguồn), URL đầy đủ, "Dùng cho", ngày.
14. Lịch sử chỉnh sửa.

### 5. Văn phong
- Tiếng Việt, câu ngắn. Giải thích thuật ngữ **lần đầu xuất hiện**. Giữ tên API tiếng Anh trong `code`.
- Code trong bài là **bản rút gọn để học**, link tới file thật cho bản đầy đủ. Không dán nguyên file dài.
- Nói "chúng ta/bạn", không "tôi". Không khoe AI; ghi đúng cả những lần sai.

### 6. Lưu file
- Thư mục `docs/LearnWithAI/`, tên `YYYY-MM-DD-chu-de-khong-dau.md`.
- Thêm một dòng vào bảng trong [`docs/LearnWithAI/README.md`](../../docs/LearnWithAI/README.md).
- Nếu bài phát hiện bài học mới chưa có trong `.ai/skills/learned/`, tạo luôn file bài học (skill `learn-pattern`).

## Checklist trước khi báo xong
- [ ] Có mục §0 trả lời: ý tưởng từ đâu, AI biết từ đâu (4 loại), có/không repo GitHub.
- [ ] Mọi câu về API/con số có `[n]`, `[Mã: …]`, 💡 hoặc ❓; mọi `[n]` có trong danh sách nguồn và ngược lại.
- [ ] Nguồn khớp phiên bản thư viện app đang dùng (hoặc ghi rõ là bản khác).
- [ ] Có ví dụ tính tay bằng số, cặp ĐÚNG/SAI ở chỗ dễ sai, câu chuyện gỡ lỗi, bài tập.
- [ ] Mọi link code tương đối đều trỏ tới file có thật.
- [ ] Đã cập nhật `docs/LearnWithAI/README.md`.

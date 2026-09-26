# Skill: research-report (Báo cáo nghiên cứu có trích dẫn nguồn)

## Mục đích
Chủ dự án đọc lại báo cáo nhiều lần và cần **kiểm tra được từng thông tin**: câu nào lấy từ đâu, câu nào là
ý kiến của AI. Skill này là quy trình bắt buộc mỗi khi được nhờ **nghiên cứu, khảo sát, so sánh, lập kế hoạch
dựa trên thông tin bên ngoài** (chính sách App Store/Google Play, giá dịch vụ, thư viện, bảo mật, luật…).
Mẫu đã được duyệt: [`docs/nghien-cuu/2026-09-26-bao-mat-va-phat-hanh-store.md`](../../docs/nghien-cuu/2026-09-26-bao-mat-va-phat-hanh-store.md).

## Khi nào gọi
- Chủ dự án nói "nghiên cứu", "tìm hiểu", "khảo sát", "so sánh", "báo cáo", "lên kế hoạch" về chủ đề cần nguồn
  bên ngoài.
- Kể cả khi câu trả lời chỉ đưa ra trong chat: vẫn đánh dấu nguồn và cuối câu trả lời vẫn có danh sách link.

## Các bước

### 1. Khảo sát hiện trạng trong code trước
Đọc code/tài liệu nội bộ liên quan để kế hoạch bám thực tế. Ghi lại **file cụ thể** làm bằng chứng cho mỗi
phát hiện (ví dụ `src/lib/encryption.ts` dùng `Math.random`).

### 2. Kiểm chứng MỌI thông tin bên ngoài bằng nguồn gốc
- **Không viết từ trí nhớ** các con số, giá, giới hạn, điều khoản, số phiên bản. Mở trực tiếp trang nguồn
  (WebFetch/WebSearch) và đọc câu gốc.
- Thứ tự ưu tiên nguồn: (1) tài liệu chính thức của nhà cung cấp (developer.apple.com, support.google.com,
  docs.expo.dev đúng phiên bản SDK đang dùng, trang advisory của thư viện); (2) cơ sở dữ liệu lỗ hổng (NVD,
  GitHub Advisory); (3) blog/diễn đàn, chỉ khi không còn nguồn nào khác, và phải ghi rõ đó là nguồn phụ.
- Thông tin chỉ thấy trong đoạn tóm tắt kết quả tìm kiếm, chưa mở trang gốc: ghi rõ "(qua kết quả tìm kiếm)".
- Không tìm được nguồn chính thức: giữ lại nhưng đánh dấu **❓ chưa kiểm chứng**. Không được im lặng bỏ
  qua, cũng không được trình bày như sự thật.
- Nếu nguồn gốc **mâu thuẫn** với điều đã nói trước đó (trong chat, trong code comment, trong tài liệu cũ):
  đưa vào mục **"Đính chính"** của báo cáo và báo cho chủ dự án biết.

### 3. Đánh dấu trích dẫn ngay tại chỗ dùng thông tin
Đặt bảng chú giải ký hiệu ở đầu báo cáo:

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* trong mục Tài liệu tham khảo |
| `[Mã: link-file]` | Rút ra từ code của dự án |
| `[Nội bộ: link-file]` | Rút ra từ tài liệu nội bộ (AGENTS.md, docs/…) |
| 💡 | Nhận định/khuyến nghị của người viết, không phải trích dẫn |
| ❓ | Chưa kiểm chứng được |

Quy tắc đánh dấu:
- Mỗi câu có con số, điều khoản, giới hạn, giá, tên API: gắn `[n]` **ngay sau câu đó**, không gom một chỗ.
- Một nguồn dùng nhiều lần: giữ **cùng một số** ở mọi chỗ.
- Suy luận ghép từ nhiều nguồn: ghi đủ các số, kèm 💡 và chữ "suy luận", ví dụ `[16][22]` 💡.
- Ước tính thời gian/chi phí do AI đặt ra: luôn gắn 💡.

### 4. Cấu trúc báo cáo
1. Bảng thông tin: ngày, phạm vi, nhánh/commit đã khảo sát, mục tiêu.
2. Chú giải ký hiệu và ngày truy cập nguồn.
3. **Tóm tắt**, tối đa khoảng 5 ý.
4. **Đính chính** (nếu có): bảng "trước đây nói / nguồn gốc nói / nguồn".
5. Các mục nội dung (hiện trạng → phân tích → đề xuất → lộ trình).
6. **Các quyết định cần chủ dự án chốt**, kèm khuyến nghị 💡.
7. **Tài liệu tham khảo** ở cuối, nhóm theo nhà cung cấp. Mỗi dòng gồm: số `[n]`, tên tài liệu, **URL đầy đủ
   dạng chữ** (để copy/tìm lại được), "Dùng cho" (thông tin nào lấy từ đó), và ngày truy cập.
8. **Lịch sử chỉnh sửa**: ngày, bản, thay đổi.

### 5. Lưu file
- Thư mục: `docs/nghien-cuu/` (tên không dấu để tránh lỗi đường dẫn trên một số công cụ).
- Tên file: `YYYY-MM-DD-chu-de-khong-dau.md`.
- Link tới code dùng đường dẫn tương đối từ thư mục đó (`../../src/...`).
- Cập nhật bảng mục lục trong [`docs/nghien-cuu/README.md`](../../docs/nghien-cuu/README.md).
- Viết bằng tiếng Việt, câu ngắn, giải thích thuật ngữ cho người không chuyên. Bảng biểu gọn, theo tinh thần
  giao diện gọn của dự án.

## Checklist trước khi báo xong
- [ ] Mọi con số, giá, giới hạn, điều khoản đều có `[n]`, hoặc có ❓/💡.
- [ ] Mọi `[n]` trong bài đều có dòng tương ứng trong Tài liệu tham khảo, và ngược lại.
- [ ] Mọi URL đã được mở thật trong phiên (hoặc ghi "qua kết quả tìm kiếm").
- [ ] Có mục Đính chính nếu có điều gì mâu thuẫn với trước đó.
- [ ] Mục lục `docs/nghien-cuu/README.md` đã cập nhật.
- [ ] Trả lời trong chat: nói rõ những điểm quan trọng đã bị đính chính.

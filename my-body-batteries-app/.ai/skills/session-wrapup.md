# Skill: session-wrapup (Tổng kết & Ghi chép cuối session)

## Mục đích
Tự động thu thập những gì đã thay đổi trong session làm việc (qua git log + diff),
rồi cập nhật đồng bộ 3 file tài liệu: `SESSION_LOG.md`, `CONTEXT.md` (mục 8), và `docs/04-roadmap.md`.

Gọi skill này khi:
- Kết thúc một ngày làm việc
- Sau khi `git push` / `git merge` / hoàn thành một tính năng lớn
- Bất cứ lúc nào muốn "chốt lại" tiến độ

---

## Đầu vào (không cần hỏi — AI tự thu thập)
- Git log và diff kể từ lần commit cuối (hoặc từ đầu ngày)
- Nội dung hiện tại của `SESSION_LOG.md`, `CONTEXT.md`, `docs/04-roadmap.md`

---

## Các bước thực hiện

### Bước 1 — Thu thập dữ liệu git
Chạy các lệnh sau để hiểu chuyện gì vừa xảy ra:

```bash
# Commits gần nhất (tối đa 10)
git -C "my-body-batteries-app" log --oneline -10

# Files đã thay đổi so với commit trước
git -C "my-body-batteries-app" diff HEAD~1..HEAD --name-status

# Nếu chưa có commit nào → xem staged/unstaged
git -C "my-body-batteries-app" status --short

# Tóm tắt những gì thay đổi (số dòng thêm/xóa)
git -C "my-body-batteries-app" diff HEAD~1..HEAD --stat
```

Nếu repo chưa có commit: dùng `git status` và đọc thư mục `src/` để suy ra.

### Bước 2 — Đọc 3 file cần cập nhật
Đọc nội dung hiện tại của:
- `.ai/SESSION_LOG.md`
- `.ai/CONTEXT.md` (phần mục 8)
- `docs/04-roadmap.md`

### Bước 3 — Cập nhật SESSION_LOG.md
Thêm một mục mới theo mẫu ở cuối danh sách sessions. Điền đủ 4 trường:

```markdown
## Session N — YYYY-MM-DD

**Làm gì:** [1–2 câu mô tả công việc chính]

**Kết quả:** [những gì đã đạt được — files tạo, tính năng test thành công, bug sửa...]

**Vấn đề gặp phải:** [lỗi, cản trở, việc phải để lại]

**Session tiếp theo phải làm:**
1. [bước cụ thể nhất, theo thứ tự ưu tiên]
2. ...
```

Quy tắc:
- N = số thứ tự session (đếm từ session đã có)
- Ngày lấy từ hệ thống (today)
- Không xóa các session cũ — chỉ thêm mới bên dưới
- "Session tiếp theo" phải cụ thể đủ để người đọc làm ngay, không cần hỏi thêm

### Bước 4 — Cập nhật CONTEXT.md (Mục 8)
Cập nhật mục **"8. Trạng thái hiện tại"**:
- Đổi ngày "Cập nhật lần cuối" thành hôm nay
- Cập nhật "Tóm tắt 1 dòng" phản ánh đúng tiến độ hiện tại
- Cập nhật trạng thái môi trường (Node.js đã cài chưa, npm install chưa, etc.)
- Cập nhật "Việc phải làm KẾ TIẾP" khớp với session log
- Cập nhật danh sách "Những gì ĐÃ có" nếu có file mới
- Cập nhật "Việc còn thiếu" nếu có gì được hoàn thành

### Bước 5 — Cập nhật docs/04-roadmap.md
Dựa vào những gì vừa làm:
- Đổi `[ ]` → `[x]` cho các mục đã hoàn thành CODE
- Nếu đã **test thật trên điện thoại** và hoạt động → cập nhật dòng "Trạng thái" bên dưới Phase
- Cập nhật bảng tổng quan (cột "Code" và "Test thật")
- Đổi icon Phase header nếu xong: `🔄` → `✅`

### Bước 6 — Báo cáo cho người dùng
Sau khi cập nhật xong, tóm tắt ngắn gọn bằng tiếng Việt:

```
✅ Đã cập nhật 3 file tài liệu.

Session hôm nay: [1 câu]
Việc tiếp theo: [1–2 bước cụ thể nhất]
```

---

## Kết quả mong đợi
- `SESSION_LOG.md` có thêm 1 entry mới, đầy đủ 4 trường
- `CONTEXT.md` mục 8 phản ánh đúng trạng thái hiện tại của dự án
- `docs/04-roadmap.md` checklist chính xác (không đánh dấu xong cái chưa xong)
- Người dùng biết ngay việc tiếp theo phải làm

---

## Lưu ý quan trọng
- **Không tự đánh dấu "Test thật ✅"** trừ khi người dùng xác nhận đã chạy app thật trên điện thoại
- **Không đánh dấu `[x]`** cho mục chỉ mới viết code nhưng chưa test — ghi rõ "Code xong, chưa test"
- Nếu git log trống (không có commit) → dùng danh sách file trong `src/` để suy ra đã làm gì
- Luôn dùng ngày thực tế từ hệ thống, không dùng ngày giả định

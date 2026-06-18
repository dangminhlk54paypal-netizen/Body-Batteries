# 📂 parallel-reports

Mỗi phiên Sonnet 4.6 chạy **song song** (theo `.ai/NEXT_SESSIONS.md`) ghi báo cáo
kết thúc vào **một file riêng** ở đây — đặt tên theo mã gói:

- `S-A.md`, `S-B.md`, `S-C.md`, `S-D.md`, `S-E.md` …

Lý do tách file: để nhiều phiên cùng kết thúc mà **không sửa đè** lên
`.ai/SESSION_LOG.md` (file dùng chung). Sau khi các gói xong, chạy **phiên GỘP**
(mục cuối `.ai/NEXT_SESSIONS.md`) để dồn tất cả vào `SESSION_LOG.md` thành 1 entry.

**Mẫu mỗi report:**
```
# <Mã gói> — <tên việc> (ngày)
- Làm gì: …
- File đã tạo/sửa: …
- Kết quả: tsc OK? expo export OK? test OK?
- Bug phát hiện (nếu có, đừng tự sửa file gói khác): …
- Còn lại / bàn giao: …
```

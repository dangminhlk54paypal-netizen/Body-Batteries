# S-A — Test thật trên điện thoại + chốt Phase 0/1/2 (2026-06-18)

**Trạng thái: ⏸ TẠM DỪNG (chưa xong) — người dùng dừng phiên lần 2 để trao đổi & bổ sung tính năng mới (cùng phiên Opus khác) trước khi tiếp tục test.**

## Làm gì
- Hướng dẫn người dùng (qa-reviewer, từng bước, chờ xác nhận) chạy `npx expo start`
  để test app thật qua Expo Go theo đúng quy trình gói S-A.
- KHÔNG sửa code trong `src/` (đúng luật gói S-A).

## File đã tạo/sửa
- Chỉ tạo file báo cáo này (`.ai/parallel-reports/S-A.md`). Không đụng file nào khác.

## Tiến độ các bước (theo NEXT_SESSIONS.md mục S-A)
1. ✅ Khởi động `npx expo start` — chạy trong terminal tích hợp VS Code (không phải Terminal.app
   độc lập như gợi ý, nhưng vẫn chạy được). Dev server lên, có hiện QR, **vẫn còn sống** (đã xác
   nhận lại ở lần dừng thứ 2).
2. ✅ **Đã xác nhận**: app chạy tốt trên **iPhone thật qua Expo Go** (không phải bản web), dù wifi
   là `eduroam` của trường — vậy client isolation (lo ngại ở `.ai/CONTEXT.md` mục 10) **không**
   chặn kết nối lần này.
3. ⬜ Chưa làm: xác nhận Home hiện đúng 1 pin tổng + 6 pin nhỏ (Protein, Carbs, Nước, Khoáng, Ngủ, Vận động).
4. ⬜ Chưa làm: test Phase 1 — nạp Protein 30 → đóng hẳn app → mở lại → pin còn nguyên.
5. ⬜ Chưa làm: test Phase 2 — đổi Mode sang "Tập luyện" → mục tiêu/sức chứa Protein tăng.
6. ⬜ Chưa làm: test thông báo "pin thấp" khi 1 pin xuống <20%.

## Bug phát hiện
- Không phải bug code. Phát hiện môi trường: có ~10 process `expo start --web` còn sót lại từ
  các phiên trước (port 8082–8093, khởi động 17h45–18h02 cùng ngày), một số trỏ tới thư mục cũ
  đã xoá `Body Batteries/my-body-batteries-app` (đã consolidate ở Session 4). Không ảnh hưởng
  trực tiếp tới test này (port khác) nhưng nên dọn dẹp (`kill <pid>`) ở phiên sau để đỡ tốn tài nguyên.

## Còn lại / bàn giao cho phiên sau (tiếp tục S-A)
- Bước 1–2 (server sống + chạy đúng trên iPhone thật qua Expo Go) **đã xác nhận xong** — phiên sau
  có thể bỏ qua, đi thẳng vào bước 3.
- Tiếp tục các bước 3–6 ở trên (Home đủ 7 pin → Phase 1 lưu trạng thái → Phase 2 đổi Mode → thông báo pin thấp).
- Người dùng dừng phiên **lần 2** để trao đổi thêm về vài tính năng mới muốn bổ sung — sẽ bàn với
  cả phiên này và một phiên Opus khác để khớp logic trước khi quyết định. **Chưa có mô tả cụ thể
  tính năng gì trong phiên này** — phiên sau cần hỏi lại người dùng để ghi rõ yêu cầu mới. Lưu ý:
  thêm gói/tính năng mới vào `.ai/NEXT_SESSIONS.md` nằm ngoài phạm vi file được sửa của gói S-A
  (chỉ được sửa `S-A.md`) — KHÔNG tự sửa `NEXT_SESSIONS.md` từ gói này; việc đó nên làm ở phiên
  riêng có quyền, hoặc ở phiên gộp cuối cùng.

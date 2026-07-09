# Hoàn tác (undo) một bản ghi phải dùng DELTA tương đối, không phải recompute tuyệt đối

**Bối cảnh:** Session 16 (S-A), xây tính năng "Sửa/Xoá vận động" (`removeActivity`/`updateActivity`
trong `src/store/energyStore.ts`), nhân bản theo mẫu `removeFood` đã có.

**Triệu chứng:** Vòng vá đầu tiên (fix cho lỗi "xoá 1 mục sai kéo cả pin về 0") đổi cách hoàn tác
pin Vận động từ "trừ tăng dần" (`applyIntake(level, -steps)`) sang "**recompute tuyệt đối**":
`level = clampLevel(sum(steps của các entry còn lại), capacity)`. Cách này lại sinh ra 2 bug MỚI mà
`/code-review` phát hiện ngay sau đó:
1. Ghi đè mất phần pin đã bị `tickDrain` rút theo thời gian (xoá 1 entry không liên quan làm pin
   "hồi sinh" về mức chưa rút).
2. Xoá mất luôn phần nạp qua đường khác không nằm trong tập được recompute (VD: tap tay trực tiếp
   vào ô pin qua `IntakeModal`, không nằm trong `activityLog`).

**Nguyên nhân gốc:** "Recompute tuyệt đối từ một tập con nguồn dữ liệu" ngầm giả định tập con đó là
NGUỒN DUY NHẤT ảnh hưởng tới state — giả định này gần như luôn sai khi pin/state còn bị ảnh hưởng
bởi thời gian (drain) hoặc nguồn khác (nhập tay). Ghi đè tuyệt đối xoá sạch mọi thông tin không nằm
trong công thức recompute.

**Cách sửa đúng:** Tính DELTA — phần đóng góp CẬN BIÊN của riêng entry bị xoá, có tính đến hiệu ứng
kẹp trần (clamp) — rồi áp dụng như một khoản trừ TƯƠNG ĐỐI lên state HIỆN TẠI (đã bao gồm drain +
nguồn khác), không phải recompute từ 0:
```ts
const oldClampedTotal = clampLevel(sum(steps TẤT CẢ entry hôm nay, kể cả entry sắp xoá), capacity);
const newClampedTotal = clampLevel(sum(steps các entry CÒN LẠI), capacity);
const delta = oldClampedTotal - newClampedTotal;       // đóng góp cận biên của entry bị xoá
const newLevel = clampLevel(currentLevel - delta, capacity); // trừ tương đối lên level HIỆN TẠI
```
Khi không có kẹp trần, delta = đúng bằng steps của entry bị xoá (giống trừ tăng dần thông thường) —
nhưng khi CÓ kẹp trần, delta phản ánh đúng phần entry đó thực sự đóng góp vào tổng đã kẹp, nên vẫn
đúng trong cả 2 trường hợp.

**Dấu hiệu nhận biết lần sau:** Bất cứ khi nào viết hàm "hoàn tác/xoá 1 bản ghi ảnh hưởng tới 1 pin
đang bị mutate", nếu thấy code có dạng `level = tính_lại_từ_đầu(...)` (ghi đè tuyệt đối) — dừng lại
và tự hỏi: "state hiện tại có nguồn ảnh hưởng nào khác ngoài tập dữ liệu tôi đang recompute không?"
(thời gian/drain, nhập tay, nguồn khác). Nếu có — PHẢI dùng delta tương đối như trên, không recompute
tuyệt đối. Tham khảo thêm `removeFood` (mẫu hoàn tác gốc, chỉ trừ tăng dần vì food không bị drain
theo cùng cách) và `removeActivity` (mẫu delta đầy đủ, Session 16) trong `src/store/energyStore.ts`.

**Checklist liên quan khi thêm 1 domain "sửa/xoá được" mới (rút ra từ 5 lỗi khác cùng session này):**
- Hoàn tác pin: dùng delta tương đối (bài học trên), không ghi đè tuyệt đối.
- Dọn side-effect ở bảng phụ (VD `intake_events` chỉ để xuất Excel) — xoá bản ghi chính mà quên dọn
  bảng phụ liên quan sẽ để lại dữ liệu "ma" (đếm trùng/hiện mãi trong export).
- Nếu app có nhiều mốc "ngày" khác nhau cho các mục đích khác nhau (VD "energy day" lệch 6h sáng vs
  lịch ngày thường cho log) — hàm hoàn tác phải áp dụng lên ĐÚNG mốc ngày mà hiệu ứng gốc đã áp dụng,
  không phải mốc ngày đang hiển thị hiện tại.
- "Sửa" (update) không nên tự ý đổi timestamp gốc của bản ghi (nếu implement update = xoá + thêm lại,
  phải truyền lại timestamp cũ, không dùng `now()` mặc định).

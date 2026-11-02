# 09 · Tự điền theo thói quen và sửa ngày cũ

Đủ 3 ngôn ngữ. Mọi thay đổi pin đi qua action của `energyStore`.

## 🔁 Tự điền (Cài đặt › Tự điền theo thói quen)
- `domain/routine/routineEngine.ts`: thói quen = ghi đều ≥ 3 ngày liền, lệch ≤ ±30 % trung vị; số gợi ý = trung vị 7 ngày.
- **Tắt** (mặc định): nút 💡 trong form Nước/Ngủ. **Hỏi theo giờ**: thẻ trên Home 6–8h (giờ ngủ), 20–22h (nước, bước, phút đi bộ).
  **Tự điền**: ngủ từ 6h, nước và bước từ 20h; ↩ Hoàn tác xoá đúng dòng đã ghi, trong ngày không điền lại.
- Bước và đi bộ ghi qua `logActivity` nên mục tiêu năng lượng tăng như ghi tay. Hỏi bật một lần khi phát hiện thói quen.

## ✎ Sửa ngày cũ (Lịch sử › chọn ngày, hôm nay + 3 ngày trước)
- Món: ✎ gram/số phần trên dòng (`updateFoodForPastDate`). Nước, ngủ, vận động: mục gập `DayLogEditor`, sửa/xoá/thêm; cân nặng: thêm.
- Buổi tập nhiều phần hoặc theo set chỉ xoá ở đây, sửa ở nhật ký tập.
- Pin: `addIntakeForPastDate` / `removeIntakeForPastDate`: ngày lịch giữ pin, ngày năng lượng (reset 6h) giữ kcal, như món ăn.

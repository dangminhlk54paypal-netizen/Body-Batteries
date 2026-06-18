# U1 — Phát hiện trước khi làm: "con số năng lượng chưa hợp logic"

> Do phiên Opus (điều phối) chuẩn bị sẵn từ việc đọc code — KHÔNG phải report cuối của U1.
> Phiên U1 đọc file này trước, rồi xác nhận từng mục với người dùng trên máy trước khi sửa.
> Phân tích dựa trên: `metabolismEngine.ts`, `energyBalanceEngine.ts`, `useLiveEnergyReading.ts`,
> `MasterBattery.tsx` (đọc 2026-06-18).

## Mô hình hiện tại (để hiểu ngữ cảnh)

- Sức chứa (`capacity`) = `passiveDailyBurn` = BMR × hệ số nghề nghiệp (TDEE nền, **chưa gồm bước
  chân/buổi tập**). Đơn vị kcal.
- Pin **bắt đầu ngày ở 100% (đầy)** — "sáng ngủ dậy đầy năng lượng". Trao đổi chất xả dần;
  ăn → nạp lại; bước chân/tập → xả thêm.
- Hiển thị: `{level.toFixed(1)} / {round(capacity)} kcal`, `{percentage}%`, màu: >60 xanh,
  >30 vàng, còn lại đỏ (`MasterBattery.tsx:36-37, 65-71`).

---

## A. U1 SỬA ĐƯỢC (chỉ hiển thị — trong file của U1)

- **A1 · Số lẻ nhảy liên tục mỗi giây.** `levelKcal.toFixed(1)` (`MasterBattery.tsx:69`) hiện 1 chữ
  số thập phân, mà `useLiveEnergyReading` cập nhật mỗi giây → con số kiểu `1847.3 → 1847.2 → …`
  cứ rung phần thập phân (~4 giây đổi 0.1). Nhìn rối, "over-precise". → Đề xuất: hiển thị **kcal số
  nguyên** (`Math.round`), bỏ phần thập phân ở chế độ live. (sửa `MasterBattery.tsx`, hoặc làm tròn
  ngay trong `useLiveEnergyReading.ts`).
- **A2 · Không có chữ giải nghĩa con số → người dùng không biết "X / Y" là gì.** Hiện chỉ ghi
  `1847 / 2200 kcal` + nhãn "Năng lượng tổng". Người quen app đếm calo (ăn DỒN LÊN tới mục tiêu)
  sẽ hiểu ngược, vì ở đây là **"còn lại / sức chứa"** (xả DẦN từ đầy). → Đề xuất thêm chữ rõ ràng:
  vd "Còn lại trong ngày" cho số bên trái, và 1 dòng gợi ý nhỏ "Ăn để sạc • cơ thể tự xả theo
  thời gian". (sửa `MasterBattery.tsx`). **Đây nhiều khả năng là cốt lõi của 'chưa hợp góc nhìn'.**
- **A3 · Màu đỏ buổi tối gây hiểu nhầm "báo lỗi/phải ăn ngay".** Tối muộn pin cạn tự nhiên (đã đốt
  hết năng lượng ngày) → xuống đỏ. Với pin EV thì "gần cạn = xấu", nhưng cạn vào ban đêm là BÌNH
  THƯỜNG. → U1 cân nhắc lại ngưỡng/diễn giải màu (hoặc thêm chú thích theo giờ). *Lưu ý: phần
  THÔNG BÁO "pin thấp" là logic (mục B3), không sửa ở U1.*

---

## B. KHÔNG sửa ở U1 — GHI report, để gói engine xử lý (đụng file gói khác)

- **B1 · Ăn dư bị "nuốt mất" (clamp ở 100%).** `chargeEnergy` clamp tại `capacity`
  (`energyBalanceEngine.ts:47-50`). Ăn nhiều hơn phần còn trống → phần dư **biến mất**, pin không
  nhúc nhích. Người dùng ăn 800 kcal mà pin gần đầy sẽ thấy "ăn xong chẳng thay đổi" → vô lý, và
  che mất việc **ăn dư**. Cần quyết định sản phẩm: cho vượt 100% (hiện phần dư) hay hiện riêng
  "thừa/thiếu hôm nay". → thuộc engine + cần chốt với người dùng (liên quan **S-H/S-L**).
- **B2 · Mỗi sáng reset về 100%, không mang theo dư/thiếu hôm qua (no carry-over).**
  `createEnergyReading` đặt `level = capacity` (`energyBalanceEngine.ts:24-27`). Ăn thiếu hôm qua
  thì hôm nay vẫn đầy → mất ý nghĩa "theo dõi cân bằng năng lượng". → backlog **S-H/S-L**.
- **B3 · Thông báo "pin thấp → nên ăn" xung đột nhịp sinh học.** Pin thấp buổi tối là tự nhiên,
  nhắc ăn đêm là lời khuyên sức khoẻ xấu (xem ranh giới `.ai/CONTEXT.md` mục 5). → thuộc **E1/S-K**
  (rải xả theo nhịp thức/ngủ sẽ làm pin tối không tụt quá sâu).

---

## Gợi ý thứ tự cho phiên U1
1. Xác nhận với người dùng A2 (cách diễn giải con số) — quyết định nhãn/hướng hiển thị TRƯỚC, vì
   nó định hình mọi thứ còn lại.
2. Làm A1 (bỏ số lẻ rung) + A3 (màu) — nhẹ, thấy ngay trên máy.
3. B1–B3: chỉ GHI vào `.ai/parallel-reports/U1.md` để phiên engine (S-H/S-K/S-L) và người dùng
   chốt — đừng tự sửa engine (đụng file gói khác).

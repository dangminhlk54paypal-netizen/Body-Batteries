# Spec quyết định — B1: xử lý "ăn dư" / hiện cân bằng năng lượng

> ✅ **ĐÃ CHỐT (2026-06-18): chọn Hướng C — lật mô hình thành "đã ăn / mục tiêu" (đếm lên).**
> Hướng A/B bên dưới KHÔNG dùng nữa. Spec chi tiết của hướng đã chốt:
> **`.ai/parallel-reports/S-M-energy-redesign-spec.md`** (gói S-M). File này giữ lại để tham khảo
> lý do loại A/B.

> Tài liệu để **người dùng chốt hướng**, do phiên Opus (điều phối) soạn từ việc đọc engine
> (`energyBalanceEngine.ts`, `batteryEngine.ts`, `store/energyStore.ts` — 2026-06-18).
> Sau khi chốt → tách thành 1 gói riêng (đề xuất mã **S-M**), KHÔNG làm chung U1/U6/S-K vì đụng
> `energyStore.ts` + `energyBalanceEngine.ts` + `MasterBattery.tsx`.

---

## 1. Vấn đề (đúng cái "chưa hợp logic" gốc rễ)

Pin Năng lượng bắt đầu ngày ở **100% = đầy** (`createEnergyReading`, level = capacity = TDEE).
Ăn → `chargeEnergy` cộng kcal nhưng **clamp tại 100%** (`energyBalanceEngine.ts:47-50`). Hệ quả:

- **Ăn khi pin gần đầy → phần dư biến mất.** VD pin đang 92%, ăn 800 kcal → pin lên 100% rồi
  **dừng**, ~600 kcal "bốc hơi". Người dùng thấy *"ăn xong pin chẳng nhúc nhích"* → vô lý.
- **Không bao giờ thấy được mình ĂN DƯ.** Một app theo dõi mà giấu mất việc ăn vượt nhu cầu thì
  mất nửa giá trị.
- Đầu kia cũng bị clamp tại 0 (`burnEnergy`) → ăn quá thiếu cũng bị giấu, nhưng ít gặp hơn.

**Toán học mấu chốt:** mức pin "thật" (chưa clamp) = `capacity − đã_đốt + đã_ăn`. Suy ra
**cân bằng hôm nay = đã_ăn − đã_đốt = (mức thật) − capacity**. Dương = ăn dư, âm = đang thiếu.
Clamp 0–100% đang vứt bỏ đúng con số này.

---

## 2. Ba hướng xử lý

### Hướng A — Giữ pin 0–100% + thêm 1 dòng "cân bằng hôm nay"  ⭐ ĐỀ XUẤT
- Pin vẫn 0–100% (giữ nguyên ẩn dụ pin EV, không đổi hình ảnh xả mượt).
- Thêm **1 dòng dưới pin**: `Hôm nay: +250 kcal (ăn dư)` / `−180 kcal (đang thiếu)` / `≈ cân bằng`.
  Con số này **KHÔNG clamp** → luôn trung thực, hiện rõ ăn dư/thiếu.
- Ăn khi pin đầy: pin giữ 100% nhưng **dòng "ăn dư" tăng** → không còn cảm giác "mất hút".
- **Tác động code:** thêm theo dõi `đã_ăn`/`đã_đốt` (hoặc `balanceKcal` chưa clamp) trong
  `energyStore` + 1 hàm thuần ở `energyBalanceEngine`; thêm 1 dòng ở `MasterBattery.tsx`. Vừa phải.
- **Ưu:** giữ ẩn dụ pin sạch + nói thật về calo (đúng mô hình "đếm calo" người ta quen) + an toàn
  sức khoẻ (từ ngữ trung tính). **Nhược:** 2 con số (pin % và dòng cân bằng) — hơi nhiều hơn 1 chút.

### Hướng B — Cho pin VƯỢT 100% (overcharge)
- Bỏ clamp; pin hiện `118%`, `2.600 / 2.200 kcal`, có vạch/ánh sáng "quá đầy".
- **Ưu:** 1 con số duy nhất, vượt 100% = ăn dư rất trực quan.
- **Nhược:** pin 150% phi lý về mặt ẩn dụ; thanh pin **không vẽ được phần >đầy** (phải bịa hiệu
  ứng); dễ tạo cảm giác "quá đầy = xấu" → **đụng ranh giới sức khoẻ** (CONTEXT mục 5). Khó làm đẹp.

### Hướng C — Lật mô hình thành "đã ăn / mục tiêu" (đếm LÊN như MyFitnessPal)
- Pin = đã ăn dồn lên tới mục tiêu; vượt = ăn dư.
- **Ưu:** khớp app đếm calo phổ thông. **Nhược:** **đảo ngược toàn bộ Hướng B** — bỏ luôn bản sắc
  "pin cơ thể tự xả theo thời gian", phải viết lại xả mượt/giây, tick, History… **Tốn & rủi ro
  lớn — KHÔNG nên làm lúc này.**

---

## 3. Đề xuất: Hướng A

Giữ được thứ đang chạy tốt (pin xả mượt 0–100%), gỡ đúng cái vô lý (ăn dư mất hút), nói thật về
cân bằng, và an toàn về mặt sức khoẻ.

**Định nghĩa số (cho phiên làm S-M):**
- `eatenTodayKcal` += mỗi lần `chargeEnergy` (food CSV / nhập tay / macro→kcal). Reset ở
  `resetForNewDay`/`loadToday` ngày mới.
- `burnedTodayKcal` += mỗi `burnPassive`/`burnActivity`.
- `balanceKcal = eatenTodayKcal − burnedTodayKcal`. Hiển thị: dương "ăn dư", âm "đang thiếu",
  quanh 0 (vd |x| < 100) "≈ cân bằng".
- Pin % giữ y nguyên (clamp 0–100). Reverse khi `removeFood` trừ lại `eatenTodayKcal` tương ứng.

**Ràng buộc sức khoẻ (BẮT BUỘC — CONTEXT mục 5):**
- Từ ngữ **trung tính**: "ăn dư / đang thiếu", **không** "tốt/xấu/tệ", không emoji buồn, không tô đỏ
  hù doạ phần "thiếu".
- **Không** khuyến khích thâm hụt sâu; nếu "đang thiếu" rất lớn, đừng giục nhịn — chỉ nêu trung
  lập. Kèm câu "Chỉ để tham khảo." ở khu vực này.

---

## 4. Đóng gói & thứ tự (tránh đụng gói khác)

- Tạo gói **S-M** sở hữu: `domain/energy/energyBalanceEngine.ts` (+ hàm thuần + test),
  `store/energyStore.ts` (thêm tracking), `components/MasterBattery.tsx` +
  `hooks/useLiveEnergyReading.ts` (dòng cân bằng live), `types` nếu cần.
- **Đụng file chéo:** `MasterBattery.tsx`/`useLiveEnergyReading.ts` (U1), `energyStore.ts`
  (U6, S-K). → **Làm S-M xen kẽ, KHÔNG song song** với U1/U6/S-K. Gợi ý: làm **U1 trước** (đã
  chỉnh hiển thị/nhãn), rồi **S-M** chồng lên (thêm dòng cân bằng), vì S-M cần nền nhãn của U1.
- Trước khi xong: `tsc` + `jest` (thêm test cho `balanceKcal`) + `expo export`.

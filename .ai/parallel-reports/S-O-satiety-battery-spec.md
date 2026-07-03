# S-O/S-P/S-Q — Spec: Pin "no/đói" tụt dần + Sổ calo ngày + Mục tiêu cân nặng

> ✅ Hướng đã chốt với người dùng (2026-07-04). Đây là **bản nâng cấp lớn** kế thừa và
> **hoà giải** S-M (đếm lên "đã ăn/mục tiêu") với S-K (rải xả theo nhịp sinh học) — KHÔNG
> phải lật lại S-M. Đọc kỹ mục 1 (mô hình) và mục 6 (ranh giới sức khoẻ) trước khi code.
> Nguồn sự thật duy nhất cho 3 gói **S-O + S-P + S-Q**. Các mục trong `.ai/NEXT_SESSIONS.md`
> chỉ đóng gói/điều phối, trỏ về file này.

## 0. Người dùng đã chốt (2026-07-04)
1. **HAI đồng hồ song song** (không gộp làm một):
   - **Pin chính (headline) = "Pin no/đói"** = phần trăm, **tụt dần theo thời gian** + nhịp
     sinh học, ăn để nạp, có **sàn 15-20%** (không bao giờ về 0 — cơ thể luôn có dự trữ).
   - **Dòng phụ = "Sổ calo hôm nay"** = `đã ăn / mục tiêu` (kcal), đếm LÊN, **reset 6h sáng**.
     Đây CHÍNH LÀ engine S-M vừa làm — **giữ lại, đổi vai** thành lớp sổ calo.
2. **Mục tiêu kcal/ngày tính từ cân nặng mục tiêu** (vd 77→72kg → ~2250 kcal có thâm hụt an
   toàn), **có chặn cứng mức an toàn**. Thay cho "mục tiêu = TDEE duy trì" của S-M.
3. **Giữ engine S-M** làm lớp Sổ calo, **phủ thêm** lớp Pin no/đói lên trên.

## 1. Mô hình chốt (định nghĩa chính xác)

### 1A. Pin no/đói (satiety) — gói **S-O**
Một "bình dự trữ ngắn hạn" đo bằng kcal, ánh xạ ra %:
- **Trạng thái:** `satietyReserveKcal` (0 … `FULLNESS_CAPACITY_KCAL`), lưu bền, **KHÔNG reset
  6h** (nó liên tục — ngủ đêm nó tự tụt về sàn, sáng dậy thấp).
- **Ăn:** `reserve = min(FULLNESS_CAPACITY_KCAL, reserve + kcal_món_ăn)`. Ăn 600-900 kcal khi
  đang đói → nhảy lên ~90-95%.
- **Thời gian trôi (mỗi ~20 phút / khi mở lại app):** `reserve = max(0, reserve −
  circadianBurnKcal(fromMs, toMs))`. Đói quay lại dần giữa các bữa.
- **Tập luyện:** trừ thẳng một cục `workoutKcal` vào reserve khi ghi buổi tập (tập xong đói hơn).
- **Ánh xạ %:** `pct = SATIETY_FLOOR_PCT + (100 − SATIETY_FLOOR_PCT) × reserve /
  FULLNESS_CAPACITY_KCAL`, clamp 0-100. reserve=0 → sàn (15-20%); reserve=đầy → 100%.
- **Nhịp sinh học `circadianBurnKcal`** (số liệu đã tra cứu, mục 5): thức (6h-23h) đốt tốc độ
  bình thường, ngủ (23h-6h) × **0.85** (ngủ đốt ít hơn ~10-15%). Bất biến BẮT BUỘC (test):
  **tích phân đúng 24h liên tục = `passiveDailyBurn(profile)`** (không được lệch khỏi TDEE đã
  hiển thị). Đây là ý tưởng gốc của S-K, nay hồi sinh với số liệu.

### 1B. Sổ calo hôm nay — engine S-M giữ nguyên, đổi 2 chỗ (gói **S-Q** lắp)
- `level` = kcal đã ăn từ 6h sáng (đếm lên); `capacity` = **mục tiêu kcal/ngày** (mục 1C, thay
  vì `passiveDailyBurn`). Vận động vẫn cộng vào mục tiêu (giữ `growGoalFromActivity` của S-M).
- **Reset 6h sáng** thay vì nửa đêm (mục 3, `energyDayString`).
- Hiển thị dưới pin no: "Sổ calo hôm nay: 1.750 / 2.250 kcal" (+ "Ăn dư X" nếu vượt — giữ S-M).

### 1C. Mục tiêu kcal/ngày từ cân nặng mục tiêu — gói **S-P**
- Nhập `goalWeightKg` (± `goalWeeks?` thời gian mong muốn) trong Hồ sơ cơ thể.
- `maintenance = passiveDailyBurn(profile)` (đã gồm bước chân TB; buổi tập cộng động trong ngày).
- Giảm cân: `deficitPerDay = 7700 × (weightKg − goalWeightKg) / (goalWeeks × 7)` (1 kg mỡ ≈
  7700 kcal). Tăng cân → surplus (dấu ngược).
- **Chặn cứng an toàn (BẮT BUỘC):**
  - Thâm hụt/thặng dư mỗi ngày **≤ 20% maintenance** VÀ **≤ 750 kcal** (lấy mức nhỏ hơn).
  - `target` **KHÔNG bao giờ < BMR** (`basalMetabolicRate`) — không ăn dưới mức chuyển hoá cơ bản.
  - Nếu người dùng đặt mục tiêu vượt ngưỡng → app **tự kẹp về mức an toàn** và nói nhẹ ("để an
    toàn, app đề xuất mức vừa phải hơn"), KHÔNG chặn thao tác, KHÔNG chê.
- `target` này = `capacity` của Sổ calo (1B). Mặc định khi chưa đặt mục tiêu → `target = maintenance`.

## 2. Hình UI dự kiến (xác nhận trên máy khi làm S-Q)
```
      |   |
      |###|  62%          <- PIN NO/ĐÓI (tụt dần theo giờ)
      |###|  Năng lượng cơ thể
      |___|
  ------------------------------
   Sổ calo hôm nay: 1.750 / 2.250 kcal   <- đếm lên, reset 6h
   Mục tiêu: giảm về 72 kg (an toàn)
   * Chỉ để tham khảo.
```
- Sáng sớm/nhịn lâu: pin ~15-20% + lời nhắc nhẹ "nên ăn sáng nhé" (KHÔNG đỏ, KHÔNG "cạn kiệt").
- Ăn xong: pin nhảy lên 90-95%, xanh. Giữa bữa: tụt dần. Tập xong: tụt thêm.

## 3. Reset 6h sáng (thay nửa đêm) — gói **S-Q**
- Thêm hàm thuần `energyDayString(date, resetHour = 6)` vào `lib/dateUtils.ts` (**KHÔNG sửa**
  `todayString`/`dateString` — các pin dinh dưỡng/History/export giữ mốc lịch cũ để không vỡ).
  Trước 6h sáng → tính là "ngày hôm qua" cho Sổ calo.
- Sổ calo (level đã ăn) + mục tiêu key theo `energyDayString`. Pin no reserve **không** reset,
  chỉ tụt tự nhiên qua đêm.
- ⚠️ Đây là điểm tích hợp rủi ro nhất — người làm S-Q phải **test kỹ mốc 6h sáng trên máy cùng
  người dùng** (đổi giờ điện thoại để thử) trước khi báo xong.

## 4. Đóng gói & phân công (chi tiết trong `.ai/NEXT_SESSIONS.md`)

| Gói | Nội dung | Agent | File sở hữu | Song song? |
|-----|----------|-------|-------------|------------|
| **S-O** | Pin no/đói engine + nhịp xả sinh học (thuần) | logic-backend | `domain/energy/satietyEngine.ts`(+test), `types/satiety.ts` (mới), `lib/metabolicConstants.ts` (thêm hằng số circadian + fullness) | ✅ với S-P |
| **S-P** | Mục tiêu cân nặng → kcal an toàn | logic-backend | `domain/energy/weightGoal.ts`(+test), `lib/weightGoalConstants.ts` (mới), `types/energy.ts` (thêm goalWeightKg), `domain/energy/profileValidation.ts`, `components/BodyProfileCard.tsx` | ✅ với S-O |
| **S-Q** | Lắp ráp: store + 2 đồng hồ + reset 6h + UI + nhắc nhẹ | logic-backend + mobile-frontend | `types/battery.ts` (thêm satietyReserveKcal), `store/energyStore.ts`, `hooks/useLiveEnergyReading.ts`, `hooks/useDrainTick.ts`, `hooks/useLowEnergyWatch.ts`, `components/MasterBattery.tsx`+`LiveMasterBattery.tsx`, `lib/dateUtils.ts` (thêm energyDayString), `services/notifications/notificationService.ts`(+`.web.ts`), `App.tsx` (mốc 6h) | ⚠️ ĐƠN — sau khi S-O+S-P xong |

**Thứ tự:** Đợt 1 chạy **S-O ∥ S-P** (file rời nhau tuyệt đối). Đợt 2 chạy **S-Q một mình**
(cần satietyEngine + weightGoal đã có). Rồi **S-A** test máy.

## 5. Cơ sở sinh học (đã websearch 2026-07-04 — ghi để tránh tra lại)
- **Ngủ đốt ~85-90% BMR** (thân nhiệt hạ, cơ nghỉ). RMR trong ngày **đỉnh giữa trưa, thấp nhất
  đêm khuya** → hệ số ngủ **0.85** hợp lý cho v1. (Ultrahuman, Healthline, Cleveland Clinic.)
- **TEF (hiệu ứng nhiệt thức ăn) ~10% tổng năng lượng ngày**, khởi phát 5-20 phút sau ăn;
  protein 20-30% > carb 5-15% > mỡ 0-5%. v1 CHƯA mô hình riêng TEF (chỉ "ăn → nạp reserve");
  ghi lại để bản sau cho bữa nhiều protein "no lâu hơn". (Tandfonline, Cambridge, OUP JCEM.)
- **1 kg mỡ ≈ 7700 kcal** (dùng cho công thức thâm hụt mục 1C).
- Số liệu là **ước lượng chung, KHÔNG phải đo y tế** — luôn kèm "chỉ tham khảo" (CONTEXT mục 5).

## 6. Ranh giới sức khoẻ (BẮT BUỘC — CONTEXT mục 5)
- Pin no thấp buổi sáng = **bình thường**, có **sàn 15-20%**, KHÔNG hiện 0%/đỏ/"cạn kiệt". Lời
  nhắc **nhẹ nhàng** ("nên ăn sáng nhé"), KHÔNG hù, KHÔNG "bạn đang yếu".
- Mục tiêu giảm cân **luôn bị kẹp về mức an toàn** (không dưới BMR, thâm hụt ≤ ngưỡng). KHÔNG
  cổ vũ nhịn ăn để "giữ pin thấp"/"tiết kiệm calo". Ăn dư → từ trung tính ("ăn dư"), không "xấu".
- Mọi màn liên quan kèm **"Chỉ để tham khảo."**

## 7. Việc cần người dùng xác nhận trước khi code từng gói
- **S-O:** giá trị `FULLNESS_CAPACITY_KCAL` (≈ mức "một bữa no", gợi ý 900-1000) + `SATIETY_FLOOR_PCT`
  (15 hay 20) + hệ số ngủ 0.85 — chốt số cụ thể.
- **S-P:** ngưỡng thâm hụt an toàn (20% & 750 kcal & không dưới BMR — OK chưa) + có nhập "thời
  gian mong muốn" (`goalWeeks`) hay chỉ nhập cân mục tiêu và app tự chọn tốc độ an toàn.
- **S-Q:** hình UI mục 2 (vị trí Sổ calo/nhắc) + reset 6h áp cho toàn app hay chỉ Sổ calo (spec
  đề xuất chỉ Sổ calo) — test mốc 6h trên máy.

## 8. Xong khi (cả 3 gói)
`npx tsc --noEmit` sạch + `npx jest` xanh (test mới cho satietyEngine giữ bất biến 24h, và
weightGoal giữ chặn an toàn) + `npx expo export --platform ios` OK + **test trên máy cùng người
dùng**: sáng pin thấp có sàn + nhắc nhẹ; ăn → pin nhảy lên + Sổ calo tăng; để lâu → pin tụt;
tập → pin tụt thêm; đặt cân mục tiêu → mục tiêu kcal đổi và bị kẹp an toàn nếu quá đà; qua mốc
6h sáng → Sổ calo về 0, pin no KHÔNG nhảy.

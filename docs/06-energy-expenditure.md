# 06 — Mô hình "năng lượng tự xả" (Energy Expenditure)

> Ý tưởng bổ sung: cơ thể liên tục **đốt** năng lượng (trao đổi chất). Thay vì pin
> xả theo một tỉ lệ % phẳng như hiện tại, mức xả nên phản ánh **năng lượng thật sự
> tiêu hao** = trao đổi chất cơ bản + vận động + tập luyện.
>
> ⚠️ Đây là **công cụ tự theo dõi, KHÔNG phải thiết bị y tế** (xem `.ai/CONTEXT.md` mục 5).
> Mọi con số là **ước lượng chung (v1)**, sẽ tinh chỉnh sau bằng nghiên cứu / hiệu chỉnh cá nhân.

---

## 1. Công thức v1 (tổng quát)

Tổng năng lượng tiêu hao trong ngày (kcal):

```
E_ngày = E_thụ_động  +  E_bước_chân  +  E_tập_luyện
```

### a) E_thụ_động = BMR × hệ_số_công_việc
- **BMR** (trao đổi chất cơ bản) theo **Mifflin-St Jeor**:
  - Nam:  `10·kg + 6.25·cm − 5·tuổi + 5`
  - Nữ:   `10·kg + 6.25·cm − 5·tuổi − 161`
- **Hệ số công việc** (lối sống — đã gồm đi lại lặt vặt, CHƯA gồm tập luyện chủ đích):
  - `sedentary` (bàn giấy / đi học, ít đi lại) = **1.2**
  - `light` (đứng/đi lại một phần ngày) = **1.35**
  - `active` (lao động chân tay) = **1.5**

> Ví dụ của bạn: 78 kg, 168 cm, giả định 30 tuổi, nam, sedentary →
> BMR = 1685; E_thụ_động = 1685 × 1.2 = **2022 kcal** (≈ mức ~2200 bạn ước lượng).

### b) E_bước_chân = số_bước × 0.0005 × kg
- ~0.04 kcal/bước ở 78 kg → 8000 bước ≈ **312 kcal**.

### c) E_tập_luyện = Σ (MET × kg × giờ)
- Dùng chỉ số **MET** cho từng môn (bảng trong `src/lib/metabolicConstants.ts`):
  chạy 9.8 · đá bóng 8.0 · bơi 7.0 · đạp xe 7.5 · gym tạ 5.0 · HIIT 8.0 · yoga 2.5 …
- Ví dụ: đá bóng 1 giờ ở 78 kg = 8 × 78 × 1 = **624 kcal**.

### d) Tốc độ "tự xả" liên tục (kcal/giờ)
- `E_thụ_động / 24` được rải đều suốt 24h (v1).
- Bước chân & tập luyện được tính **theo sự kiện** khi người dùng ghi nhận (không rải đều).
- *Tinh chỉnh sau:* rải theo nhịp sinh học (thức nhiều hơn, ngủ ít hơn) thay vì đều tăm tắp.

---

## 2. Đã làm (foundation — Session review + Opus)

Phần **tính toán thuần** đã viết & test xong (không đụng tính năng cũ):
- `src/types/energy.ts` — `UserProfile`, `Sex`, `OccupationLevel`, `ActivityType`, `WorkoutSession`, `ExpenditureBreakdown`.
- `src/lib/metabolicConstants.ts` — `OCCUPATION_FACTORS`, `KCAL_PER_STEP_PER_KG`, `MET_TABLE`.
- `src/domain/energy/metabolismEngine.ts` — `basalMetabolicRate`, `passiveDailyBurn`, `stepsKcal`,
  `workoutKcal`, `totalWorkoutKcal`, `dailyExpenditure`, `passiveBurnPerHour`.
- `src/domain/energy/__tests__/metabolismEngine.test.ts` — 11 test, đã PASS.

---

## 3. Quyết định: **Hướng B** + nguồn nạp calo "**cả hai**" — ĐÃ TRIỂN KHAI (v1)

Người dùng chọn **Hướng B**: pin **TỔNG = pin "Năng lượng" (cân bằng calo)**.
- Sức chứa = `passiveDailyBurn(profile)` (nhu cầu thụ động/ngày, vd 2022 kcal). **Đầu ngày = đầy (100%)**:
  thức dậy "đầy pin", trao đổi chất xả dần, ăn để nạp lại (không tràn quá 100%).
- **Nạp (cả hai nguồn):** (a) tự suy từ Protein/Carbs đã ghi (4 kcal/g) + (b) nút "🍽️ Ăn thêm (kcal)" nhập tay.
- **Xả:** `passiveBurnPerHour` rải đều theo giờ (qua `tickDrain`) + nút "🏃 Vận động" (bước chân + buổi tập theo MET).
- 6 pin dinh dưỡng giữ nguyên (lớp phụ — chất lượng bữa ăn); màn Lịch sử vẫn tính trung bình 6 pin đó (loại trừ pin năng lượng).

### Đã code & test (✅ tsc sạch, +20 test, bundle OK)
- `src/types/battery.ts` — thêm `'energy'` vào `BatteryId`.
- `src/lib/constants.ts` — `ENERGY_BATTERY`, `KCAL_PER_GRAM`.
- `src/store/settingsStore.ts` — `userProfile` + `setUserProfile` (mặc định 78/168/30/nam/sedentary).
- `src/domain/energy/energyBalanceEngine.ts` (+ test) — capacity/charge/burn/reconcile.
- `src/store/energyStore.ts` — master = % pin năng lượng; auto-nạp từ macros; `addCalories`; `logActivity`; `tickDrain` xả năng lượng theo BMR.
- `src/components/MasterBattery.tsx` — hiện `kcal hiện tại / sức chứa`.
- `src/components/EnergyActionsBar.tsx` — nút "Ăn thêm (kcal)" + "Vận động" (chọn môn + phút + bước chân).
- `src/components/BodyProfileCard.tsx` + `SettingsScreen.tsx` — form "Hồ sơ cơ thể" (sửa cân nặng/cao/tuổi/giới tính/mức vận động, xem TDEE trực tiếp).
- `src/screens/HomeScreen.tsx` — pin năng lượng làm pin tổng; 6 pin nhỏ loại trừ 'energy'.

### ⚠️ Việc người dùng nên làm ngay
Vào **Cài đặt → Hồ sơ cơ thể**, sửa **tuổi + giới tính thật** (mặc định đang là 30/nam) để BMR đúng.

---

## 4. v1 — giới hạn & hướng tinh chỉnh sau
- Xả thụ động hiện **rải đều 24h**; sau có thể theo nhịp sinh học (thức/ngủ).
- Bước chân & buổi tập đang **nhập tay**; sau nối với Health/đồng hồ (gói S-F) để tự lấy.
- Hệ số công việc & MET là số **chung**; sau hiệu chỉnh theo dữ liệu cá nhân.
- `logActivity` chưa ghi vào lịch sử intake (chỉ trừ pin); có thể bổ sung để xuất Excel đầy đủ.
- Mô hình "đầu ngày đầy 100%" là 1 lựa chọn; có thể đổi sang "carry-over" từ hôm trước nếu muốn.

## 5. Công thức tổng quát cho MỌI người dùng — đã xác nhận + bảo vệ

Mifflin-St Jeor là phép tính đại số đơn giản trên 4 biến (cân nặng, chiều cao,
tuổi, giới tính) — **không hard-code riêng cho hồ sơ mẫu của một người**. Hồ sơ
mặc định 78kg/168cm/30 tuổi/nam (`DEFAULT_USER_PROFILE` trong `settingsStore.ts`)
chỉ là giá trị khởi tạo ban đầu; mỗi người dùng tự sửa đúng số của mình trong
**Cài đặt → Hồ sơ cơ thể** và công thức sẽ tính đúng cho họ.

- Đã thêm test với nhiều hồ sơ khác nhau (nữ trẻ, nam lớn tuổi, thiếu niên...)
  trong `metabolismEngine.test.ts` → xác nhận công thức cho ra số đúng cho bất
  kỳ ai, không chỉ hồ sơ mẫu.
- Đã thêm **giới hạn hợp lệ** (`PROFILE_LIMITS` trong `metabolicConstants.ts`)
  và hàm thuần `validateUserProfile()` (`domain/energy/profileValidation.ts`)
  để chặn số liệu vô lý (cân nặng/chiều cao/tuổi ngoài khoảng người thật) trước
  khi lưu — vì công thức là đại số nên với input rác nó vẫn "ra số", nhưng số
  đó không còn đại diện cho một người thật nữa.
  - Cân nặng: 20–300 kg · Chiều cao: 50–250 cm · Tuổi: 1–120.
- `BodyProfileCard.tsx` hiển thị khoảng hợp lệ ngay trên nhãn ô nhập, giải
  thích ngắn gọn ý nghĩa của BMR, và báo lỗi/thành công rõ ràng khi lưu.

---

## 6. Tiến hoá mô hình pin Năng lượng (mốc thời gian)

Ý nghĩa pin tổng đã đổi qua 3 mốc — ghi lại để không nhầm khi đọc code cũ:

1. **Hướng B (v1, Session 5):** pin = "còn lại", **đầu ngày đầy 100%**, trao đổi chất xả dần,
   ăn nạp lại. Vấn đề: ăn dư bị clamp mất, không bao giờ thấy "vượt nhu cầu".
2. **S-M (2026-07-03):** lật sang **"đã ăn / mục tiêu"**, đầu ngày **rỗng 0%**, đếm LÊN khi ăn;
   pin KHÔNG tự xả theo thời gian; vận động cộng vào mục tiêu; ăn vượt → "ăn dư". Xem
   `.ai/parallel-reports/S-M.md`.
3. **S-O/S-P/S-Q — "2 đồng hồ" (chốt 2026-07-04, đang triển khai):** tách làm hai thang đo bổ
   sung nhau (xem spec đầy đủ `.ai/parallel-reports/S-O-satiety-battery-spec.md`):

### 6A. Pin no/đói (headline) — gói S-O (hồi sinh S-K)
- Bình "dự trữ no" (kcal) → ánh xạ **%**, **tụt dần theo giờ** theo **nhịp sinh học** (thức
  6h-23h đốt bình thường, ngủ ×**0.85** — ngủ đốt ít hơn ~10-15%, có cơ sở nghiên cứu).
- Ăn → nạp reserve (bữa 600-900 kcal → ~90-95%); giữa bữa tụt (đói quay lại); tập → tụt thêm.
- Có **sàn 15-20%** (không về 0 — cơ thể luôn có mỡ/cơ dự trữ). Sáng dậy thấp = **bình thường**,
  chỉ nhắc **nhẹ** "nên ăn", KHÔNG hù/đỏ (ranh giới sức khoẻ — CONTEXT mục 5).
- **Bất biến:** tích phân xả đúng 24h = `passiveDailyBurn(profile)` (không lệch khỏi TDEE).

### 6B. Sổ calo hôm nay (dòng phụ) — engine S-M giữ lại
- `đã ăn / mục tiêu` (kcal), **đếm lên, reset 6h sáng** (`energyDayString`, không phải nửa đêm).
- Mục tiêu = **`dailyCalorieTarget`** từ cân nặng mong muốn (gói S-P), không còn = TDEE thô.

### 6C. Mục tiêu cân nặng → kcal an toàn — gói S-P
- `maintenance = passiveDailyBurn`; thâm hụt = `7700 × Δkg / (goalWeeks×7)` (1 kg mỡ ≈ 7700 kcal).
- **Chặn cứng an toàn:** thâm hụt ≤ 20% & ≤ 750 kcal/ngày, mục tiêu **không bao giờ < BMR**.
  Đặt mục tiêu quá đà → app tự kẹp về mức an toàn, nói nhẹ, không chê (CONTEXT mục 5).

### Cơ sở sinh học (websearch 2026-07-04)
- Ngủ đốt ~85-90% BMR; RMR đỉnh giữa trưa, thấp nhất đêm khuya.
- TEF (hiệu ứng nhiệt thức ăn) ~10% năng lượng ngày; protein 20-30% > carb 5-15% > mỡ 0-5%
  (v1 chưa mô hình riêng TEF — bản sau cho bữa nhiều protein "no lâu hơn").
- 1 kg mỡ ≈ 7700 kcal. Tất cả là **ước lượng chung, không phải đo y tế**.

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
  chạy 9.8 · đá bóng 8.0 · bơi 7.0 · đạp xe 7.5 · gym tạ 5.0 · HIIT 8.0 · yoga 2.5 · squat 5.0 · deadlift 5.0 · bench press 4.0 …
- Ví dụ: đá bóng 1 giờ ở 78 kg = 8 × 78 × 1 = **624 kcal**.
- **Powerlifting công thức:** kcal = MET × cân_nặng_kg × giờ (mức trung bình toàn buổi, gồm cả nghỉ giữa set).
  - Squat: 5.0 MET (Compendium 2024 code 02052)
  - Deadlift: 5.0 MET (Compendium 2024 code 02052)
  - Bench press: 4.0 MET (ước tính; Robergs 2007 + Reis 2017: bench nhỏ hơn squat/deadlift)

### d) Tốc độ "tự xả" liên tục (kcal/giờ)
- `E_thụ_động / 24` được rải đều suốt 24h (v1).
- Bước chân & tập luyện được tính **theo sự kiện** khi người dùng ghi nhận (không rải đều).
- *Tinh chỉnh sau:* rải theo nhịp sinh học (thức nhiều hơn, ngủ ít hơn) thay vì đều tăm tắp.

---

## 1A. Bước chân: công thức chuyển đổi từ số bước → kcal (Session này)

> ⚠️ **Công cụ tự theo dõi, KHÔNG phải thiết bị y tế** — tất cả là **ước lượng chung**, không phải số đo riêng.

### Bảng hằng số kcal/bước/kg theo hoạt động

| Hoạt động | kcal/bước/kg | MET | Nhịp (steps/min) | Nguồn gốc |
|-----------|--------------|-----|------------------|-----------|
| Đi bộ bình thường | 0.00053 | 3.0 | 100 | Marshall et al. 2009; Compendium 2024 code 17170 |
| Chạy bộ | 0.00096 | 9.3 | 169 | Compendium 2024 code 12050; Leacox et al. 2025 |
| Leo núi (chung) | 0.0011 | 6.0 | 95 | Compendium 2024 code 17080 |
| Leo núi dốc 6–10% | 0.0014 | 7.0 | 90 | Compendium 2024 code 17035 |

**Ví dụ:** 5,000 bước ở 70 kg → đi bộ ≈ 185 kcal; chạy ≈ 336 kcal; leo núi ≈ 385 kcal.

### Công thức chuyển đổi cơ bản

```
kcal/bước/kg  =  MET × 0.0175 / nhịp (steps/min)
```

Ví dụ: đi bộ (3.0 MET) @ 100 spm → 3.0 × 0.0175 / 100 = 0.000525 ≈ 0.00053 ✓

### Quy tắc "phút tập → bước tương đương" cho tập luyện (không nhập bước thật)

Khi người dùng ghi một buổi tập (ví dụ: squat 30 phút, không nhập số bước), app chuyển đổi:

```
bước_tương_đương  =  phút × nhịp_tương_đương
nhịp_tương_đương  =  100 steps/min (nếu MET < 6)
                      130 steps/min (nếu MET ≥ 6)
```

**Cơ sở:**
- MET < 6 = cường độ vừa phải: nhịp 100 spm (Marshall et al. 2009, Tudor-Locke et al. 2019)
- MET ≥ 6 = cường độ cao: nhịp 130 spm (Tudor-Locke 2019 — "CADENCE-adults" 6 MET ↔ 120–130 spm)

**Ví dụ:** squat 30 phút (MET 5.0 < 6) → 30 × 100 = 3.000 bước tương đương, dùng để **nạp pin Vận động** (đơn vị của pin là bước). Lưu ý: kcal của buổi tập KHÔNG tính từ bước tương đương — nó tính thẳng bằng công thức MET: `5.0 × 70 kg × 0.5 h = 175 kcal` (xem mục Powerlifting bên dưới). Hai con số phục vụ hai pin khác nhau: bước → pin Vận động, kcal → mục tiêu ăn của pin Năng lượng.

**Bất biến:** kết quả chuyển đổi **snapshot vào `movementStepsApplied`** trên lúc ghi nhật ký, để undo chính xác (xem _Giới hạn v1_ bên dưới).

---

## 1B. Powerlifting (squat, deadlift, bench press) — mô hình set × rep × tạ (S-PL)

> Từ S-PL (2026-07-16), 3 bài powerlifting được ghi **theo set** (khởi động +
> bài chính) qua sheet Powerlifting riêng, và kcal tính từ **khối lượng nâng
> thật** (tạ × rep × set + cân nặng/chiều cao người tập) thay vì MET × phút —
> theo yêu cầu người dùng: số phút phụ thuộc nhịp tim nên khó tin cậy, còn
> tạ/rep/set là số đo chính xác của buổi tập. Code: `src/domain/energy/liftingEngine.ts`.

### Công thức hybrid = công nâng tạ + đốt lúc nghỉ giữa set

**① Công nâng tạ (mỗi set, vật lý):**

```
khối_lượng_hiệu_dụng (kg) = tạ + k_bài × cân_nặng_cơ_thể
quãng_đường_thanh_đòn (m) = h_bài × chiều_cao
kcal_set = m_eff × 9.81 × ROM × reps × (1 + 0.33) / 0.20 / 4184
```

- `× (1 + 0.33)`: pha HẠ tạ (eccentric) tốn ~1/3 pha nâng (Abbott 1952).
- `/ 0.20`: hiệu suất cơ học của cơ (~20%, sách giáo khoa sinh lý 15–25%).

**Hệ số theo bài** (`LIFTING_PARAMS`, nhân trắc học de Leva 1996):

| Bài | k_bài (phần cơ thể di chuyển cùng tạ) | h_bài (ROM / chiều cao) |
|-----|----------------------------------------|--------------------------|
| Squat | 0.88 — cả người trừ cẳng chân+bàn chân (~12%) | 0.25 |
| Bench press | 0.10 — hai cánh tay | 0.19 |
| Deadlift | 0.25 — thân+đầu+tay (~60%) nhưng chỉ nâng ~nửa quãng đường thanh đòn | 0.30 |

**② Đốt lúc nghỉ giữa set (tự ước lượng, KHÔNG cần nhập phút):**

```
phút_buổi ≈ set_chính × 3 + set_khởi_động × 1.5   (LIFTING_SET_CYCLE_MIN)
kcal_nghỉ = 2.0 MET × cân_nặng × giờ                (LIFTING_REST_MET)
```

Nghiên cứu đo VO2 cả buổi (João 2021: 5.3–6.5 kcal/phút trung bình buổi) cho
thấy phần hồi phục giữa set chiếm ĐA SỐ năng lượng — chỉ tính công cơ học sẽ
thiếu 3–5 lần.

**Ví dụ (78 kg, 168 cm):** squat khởi động 20×10/50×6/70×4/85×2 + bài chính
5×5@100kg → công nâng ≈ 44 kcal + nghỉ (21 phút) ≈ 55 kcal ≈ **~100 kcal** cho
bài squat; buổi 3 bài đầy đủ ≈ **250–350 kcal** — khớp khoảng đo VO2.

**Số phút ước lượng** cũng được lưu vào `WorkoutSession.minutes` để pin Vận
động vẫn nhận step-equivalent (squat MET 5.0 < 6 → 100 spm) và lịch sử/Excel
hiển thị bình thường.

### Dữ liệu lưu cho phân tích block (6 tuần) sau này

Mỗi set (kind warmup/working, kg, reps) được lưu nguyên vẹn trong JSON
`activity_log.workouts` (không cần migration — hàng cũ chỉ thiếu field
`sets` và giữ nguyên đường MET). Từ đó tính được e1RM (Epley: `w × (1 +
reps/30)`, chỉ set working) và tổng tấn số theo tuần — nền tảng cho dashboard
"quan sát cơ thể & sức mạnh theo block 6 tuần" ở phiên sau.

### MET fallback (hàng cũ / không có sets)

| Bài tập | MET | Compendium code | Ghi chú |
|---------|-----|-----------------|---------|
| Squat | 5.0 | 02052 | Squats, deadlift, slow or explosive |
| Deadlift | 5.0 | 02052 | Cùng category squat |
| Bench press | 4.0 | — | Ước tính (Robergs 2007, Reis 2017: bench < squat) |

`kcal = MET × cân_nặng_kg × giờ` — vẫn dùng cho entry ghi trước S-PL (chỉ có
phút, không có sets) và khi caller không truyền chiều cao.

### Giới hạn v1
- Hệ số k_bài / h_bài là **trung bình dân số** (de Leva 1996) — chưa hiệu
  chỉnh theo tỷ lệ chi thể từng người; ROM thực tế phụ thuộc độ sâu squat,
  độ rộng tay cầm...
- Thời gian nghỉ ước lượng cố định (3 phút/set chính) — người nghỉ 5 phút
  giữa set nặng sẽ đốt phần nghỉ nhiều hơn con số này.
- **Không mô hình EPOC** (oxy tiêu hao sau tập) — phần nghỉ 2.0 MET đã gồm
  một phần hồi phục; EPOC sau buổi tập chưa tính.
- **Undo thủ công không chính xác:** một quick-tap trên pin Vận động ngay trong app chưa được hỗ trợ undo (movement event không lưu trong `intakeLog`, và `IntakeEvent` không lưu `stepType` để có thể đảo ngược goal growth một cách chính xác) — xem _Tính năng trì hoãn S-T3_ ở `.ai/NEXT_SESSIONS.md`.

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

---

## Sources (Tài liệu tham khảo)

### Bước chân & Cadence

1. **Marshall SJ et al. (2009).** "Translating physical activity recommendations into a pedometer-based step goal." _American Journal of Preventive Medicine_, 36(5):410-415.
   - URL: https://www.sciencedirect.com/science/article/abs/pii/S0749379709000877
   - Nguồn: walking 3.0 MET, cadence 100 spm (moderate).

2. **Compendium of Physical Activities (2024).** "2024 Adult Compendium of Physical Activities."
   - URL: https://pacompendium.com/ (full data: https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf)
   - Codes: 17170 (walking), 12050 (running), 17080 (hiking), 17035 (hiking steep), 02052 (squat/deadlift).

3. **Tudor-Locke C et al. (2019).** "Walking cadence and intensity in 21-40 year olds: CADENCE-adults study." _International Journal of Behavioral Nutrition and Physical Activity_, 16:8.
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC6337834/
   - Nguồn: cadence 100–102 spm (moderate), 120–130 spm (vigorous ≥6 MET).

4. **Leacox A et al. (2025).** "Effect of running speed on cadence and running kinetics." _International Journal of Sports Physical Therapy_, 20(7):957-963.
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12222555/
   - Nguồn: running 9.3 MET @ 169 spm.

### Powerlifting

5. **Robergs RA et al. (2007).** "Energy expenditure during bench press and squat exercises." _Journal of Strength and Conditioning Research_, 21(1):123-130.
   - URL: https://journals.lww.com/nsca-jscr/Abstract/2007/02000/ENERGY_EXPENDITURE_DURING_BENCH_PRESS_AND_SQUAT.23.aspx
   - Nguồn: bench press < squat (xác nhận).

6. **Reis VM et al. (2017).** "Energy cost of isolated resistance exercises across low- to high-intensities." _PLOS ONE_, 12(7):e0181311.
   - URL: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0181311
   - Nguồn: bench press interpolation, working-set cost comparison.

7. **Scott CB et al. (2011).** "Aerobic, anaerobic, and EPOC energy expenditure during and after bench press." _Journal of Strength and Conditioning Research_, 25(4):903-908.
   - URL: https://www.asep.org/asep/asep/JEPonlineFebruary2011ChristopherScott.pdf
   - Ghi chú: EPOC (excess post-exercise oxygen consumption) — không mô hình riêng v1.

8. **Adeel M et al. (2022).** "VO2 and sEMG during moderate-strength training exercises." _International Journal of Environmental Research and Public Health_, 19(4):2233.
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC8872100/
   - Nguồn: squat ≥ deadlift (VO2 so sánh).

9. **João GA et al. (2021).** "Acute behavior of oxygen consumption during resistance training." _Frontiers in Sports and Active Living_, 3:797604.
   - URL: https://doi.org/10.3389/fspor.2021.797604
   - Ghi chú: session-average 5.3–6.5 kcal/min (gồm EPOC).

### Mô hình set-based S-PL (bổ sung 2026-07-16)

11. **de Leva P (1996).** "Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters." _Journal of Biomechanics_, 29(9):1223-1230.
    - Nguồn: khối lượng phân đoạn cơ thể (thân, tay, cẳng chân...) → hệ số k_bài trong `LIFTING_PARAMS`.

12. **Abbott BC, Bigland B, Ritchie JM (1952).** "The physiological cost of negative work." _Journal of Physiology_, 117(3):380-390.
    - Nguồn: pha eccentric (hạ tạ) tốn ~1/3 pha concentric → hệ số 0.33.

### Tham khảo chéo (ACSM)

10. **ACSM Metabolic Equations (cross-check).** Walking/running/treadmill @ slopes.
    - URL: https://www.depts.ttu.edu/ksm/_documents/grad/acsm_comps/6c-23-2013_HFI_Metabolic_Calculations.pdf

---

**Lưu ý:** Tất cả giá trị trong tài liệu này là **ước lượng chung, dùng cho tự theo dõi**, không phải số đo y tế. Các hằng số MET và cadence có sai số tự nhiên giữa các cá nhân.

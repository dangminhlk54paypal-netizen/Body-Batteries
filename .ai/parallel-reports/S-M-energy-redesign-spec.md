# S-M — Spec: lật pin Năng lượng sang "đã ăn / mục tiêu" (đếm lên)

> ✅ Hướng đã chốt với người dùng (2026-06-18). Thay thế đề xuất Hướng A trong
> `B1-energy-balance-spec.md` và phần "hướng hiển thị" của `U1-FINDINGS.md`.
> Đây là **thay đổi lớn, đụng lõi** — đọc kỹ mục "Ảnh hưởng dây chuyền" trước khi giao việc.

## 0. Người dùng đã chốt
- **Thanh pin = đếm LÊN: "đã ăn / mục tiêu"** (đầy dần khi ăn; 100% = đạt mục tiêu ngày).
- **Giữ yếu tố thời gian:** có 1 con số sống "còn được ăn ngay" **tăng dần** khi cơ thể đốt
  trong ngày (tái dùng cơ chế tick/giây của Session 5, đổi mục đích).

## 1. Mô hình chốt (định nghĩa chính xác)

Tái dùng đúng `BatteryReading {level, capacity}` của pin `energy`, nhưng ĐỔI Ý NGHĨA:
- **`capacity` = mục tiêu ngày (goal)** = `dailyExpenditure.total` = `passiveDailyBurn(profile)`
  `+ stepsKcal + Σ workoutKcal` (hàm `dailyExpenditure` đã có sẵn). Vận động đã ghi → mục tiêu
  tăng (đi/tập nhiều → được ăn nhiều hơn).
- **`level` = tổng kcal ĐÃ ĂN hôm nay** (`eatenTodayKcal`). **Bắt đầu ngày = 0** (rỗng), đếm lên.
- **Thanh pin % (bar)** = `toPercentage(level, capacity)` = đã_ăn / mục_tiêu. Khi `level > capacity`
  → hiển thị "Ăn dư = level − capacity" (bar tối đa 100%, kèm chữ).
- **Con số sống (tick/giây) "Còn được ăn ngay"** = `burnedSoFar(t) − eatenToday`, với
  `burnedSoFar(t) = passiveBurnPerHour × (giờ đã trôi từ 00:00) + activityKcal đã ghi`.
  - Dương → "Còn được ăn: X kcal" (tăng dần theo thời gian).
  - Âm → "Đang dư: Y kcal".
  - Cuối ngày `burnedSoFar → goal`, nên số này hội tụ về `goal − eaten` (khớp "còn lại cả ngày").

**Hệ quả then chốt:** pin Năng lượng **KHÔNG còn tự xả theo thời gian** (level chỉ đổi khi ĂN).
Thời gian chỉ tác động vào con số phụ "còn được ăn". → cần gỡ `burnPassive` khỏi `tickDrain` cho
pin energy.

## 2. Hình UI dự kiến (để người dùng xác nhận)
```
      |   |
      |___|
      |###|  80%
      |###|  Da an hom nay
      |###|  1.750 / 2.200 kcal
      |___|
  ----------------------------
   Con duoc an ngay: +90 kcal   (tang dan theo thoi gian)
   * Chi de tham khao
```
(Khi ăn vượt: bar 100% + "Ăn dư 300 kcal". Khi nhịn lâu: "Còn được ăn" lớn dần.)

## 3. Thay đổi so với hiện tại

| Chỗ | Hiện tại (Hướng B cũ) | Sau (S-M) |
|-----|----------------------|-----------|
| `createEnergyReading` | level = capacity (đầy) | **level = 0** (rỗng) |
| `capacity` | = `passiveDailyBurn` | = `dailyExpenditure.total` (gồm vận động) |
| `chargeEnergy` (ăn) | level += kcal, clamp tại cap | level += kcal (cho vượt cap để hiện "ăn dư"; hoặc track surplus) |
| `burnActivity` (đi/tập) | trừ level | **cộng vào capacity (goal)**, không trừ level |
| `burnPassive`/`tickDrain` cho energy | trừ level mỗi tick | **bỏ** với energy (nutrient vẫn xả) |
| `useLiveEnergyReading` | xả mượt reserve/giây | tính "còn được ăn ngay" = burnedSoFar − eaten |
| `MasterBattery` hiển thị | "còn lại / sức chứa" | "đã ăn / mục tiêu" + dòng "còn được ăn ngay" |
| Cảnh báo "pin thấp" | pin < ngưỡng → nhắc ăn | định nghĩa lại: cảnh báo khi **ăn vượt mục tiêu**? hoặc bỏ nhắc-khi-thấp (vì rỗng buổi sáng là bình thường) |
| History (pin energy/ngày) | % reserve cuối ngày | % đã_ăn/mục_tiêu của ngày |

## 4. ⚠️ Ảnh hưởng dây chuyền (ĐIỀU PHỐI — đọc trước khi mở phiên)

- **S-K (rải xả pin theo nhịp thức/ngủ) → TẠM DỪNG.** Mô hình mới pin energy KHÔNG xả theo thời
  gian, nên S-K (chỉnh nhịp xả energy) **mất ý nghĩa / mâu thuẫn**. Báo phiên đang lập S-K dừng
  lại trước khi tốn công. (Nếu S-K chỉ đụng nutrient drain thì xem lại phạm vi.)
- **U1 (hiển thị con số) → GỘP vào S-M.** S-M định nghĩa lại toàn bộ hiển thị pin tổng; làm U1
  riêng sẽ bị S-M viết đè. Đừng mở U1 song song; coi U1 = phần "polish nhãn" bên trong S-M.
- **Tính năng "pin xả mượt/giây" (Session 5) → ĐỔI VAI**, không xoá: cơ chế tick/giây +
  `lastDrainSyncAt` được tái dùng để chạy con số "còn được ăn ngay".
- **U3 (History):** ngữ nghĩa pin energy/ngày đổi (đã_ăn/mục_tiêu). U3 chỉ chỉnh hiển thị — phối
  hợp đọc S-M, nhưng KHÔNG sửa engine.
- **U6 (logFood truyền mealWindows):** vẫn cần (ghi món vẫn cộng `eatenTodayKcal`). Không xung đột
  về ý nghĩa, chỉ là cùng file `energyStore.ts` → **S-M và U6 không chạy song song** (serialize).
- **U2 (modal nạp/ghi):** phần lớn không ảnh hưởng (vẫn gọi logFood/addCalories). An toàn.

## 5. Ranh giới sức khoẻ (BẮT BUỘC — CONTEXT mục 5)
- Buổi sáng pin rỗng (chưa ăn) là **bình thường** — KHÔNG tô đỏ/hù "pin yếu", KHÔNG nhắc "phải ăn ngay".
- Vượt mục tiêu: từ ngữ trung tính ("ăn dư"), không "xấu/tệ", không hù.
- Không khuyến khích nhịn để "giữ pin thấp". Kèm "Chỉ để tham khảo."

## 6. Đóng gói S-M
- **File sở hữu:** `domain/energy/energyBalanceEngine.ts` (đổi semantics + hàm `dailyTarget`,
  `canEatNow`; sửa test `energyBalanceEngine.test.ts`), `domain/energy/metabolismEngine.ts` (dùng
  `dailyExpenditure` — chỉ ĐỌC, đừng đụng nếu S-F đang làm), `store/energyStore.ts` (eaten counters,
  bỏ burnPassive energy trong tickDrain, burnActivity→goal), `hooks/useLiveEnergyReading.ts`,
  `components/MasterBattery.tsx` + `LiveMasterBattery.tsx`, `types/energy.ts`/`types/battery.ts` nếu cần.
- **Sequencing:** đụng `energyStore.ts` (U6/S-K), `metabolismEngine.ts` (S-F), `MasterBattery`
  (U1). → **Làm S-M MỘT MÌNH một đợt**, sau khi commit polish. Trong đợt đó tạm hoãn U1/U6/S-K/S-F.
  Các gói an toàn chạy cùng S-M: U2, U3 (chỉ hiển thị, đọc S-M), U4, U5, S-J, S-A.
- **Xong khi:** `tsc` sạch + `jest` xanh (cập nhật test energy) + `expo export` OK + test trên máy
  với người dùng (ăn → bar lên; để lâu → "còn được ăn" tăng; ăn vượt → "ăn dư").

## 7. Việc cần người dùng xác nhận trước khi code
1. Hình UI mục 2 ổn chưa? (vị trí "còn được ăn ngay").
2. Cảnh báo: bỏ hẳn "nhắc khi pin thấp", hay đổi thành "nhắc khi ăn vượt mục tiêu nhiều"?
3. Vận động cộng vào mục tiêu (đã giả định) — đúng ý chứ?

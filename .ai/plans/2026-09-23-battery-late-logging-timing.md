# Kế hoạch: pin phải tính theo GIỜ ĂN, không phải GIỜ GHI (2026-09-23)

> **Trạng thái: W1–W5 ĐÃ LÀM XONG (2026-09-23)** — `npm run verify` xanh 716/716. Còn lại: người dùng test máy
> thật theo §6. Kế hoạch do Opus lập, Sonnet triển khai. Nhật ký triển khai: §8.
> Nhánh: `ui-upgrade`. Stack: Expo SDK 57 (không nâng/hạ).
> Mọi text UI mới đi qua `useT()` + 3 locale (vi → en → de), xem `AGENTS.md`.
> **File này cũng là hồ sơ nghiên cứu của lỗi.** Sonnet PHẢI điền mục
> "§8 Nhật ký triển khai" ở cuối trong lúc sửa (xem yêu cầu ở §8).

---

## 1. Phản ánh của người dùng

> Cả ngày bận, không ghi được bữa ăn. Tối rảnh mới ghi lại, có chọn đúng giờ đã ăn
> (sáng/trưa). Nhưng lúc ghi (chuẩn bị đi ngủ, bữa cuối đã cách **3–4 tiếng**), pin
> lại **nhảy lên đầy 100%**. Đúng ra bữa ăn đã tiêu hao bớt từ lúc ăn đến lúc ghi,
> pin phải thấp hơn nhiều.

Người dùng đúng. Đây là lỗi mô hình, không phải lỗi hiển thị.

---

## 2. Chẩn đoán

### 2.1 Có 3 loại "pin" và chỉ 2 loại bị lỗi

| Pin | Ý nghĩa | Phụ thuộc thời gian? | Bị lỗi? |
|---|---|---|---|
| **Pin no/đói (satiety)** — pin lớn ở Home, `satietyPct` | Lượng kcal còn "trong bụng", tiêu hao theo đồng hồ sinh học | CÓ (drain liên tục) | **CÓ — lỗi chính** |
| **Pin dinh dưỡng** protein/carbs/water/minerals | Lượng còn lại, giảm `mode.drainRatePerHour` mỗi giờ, về 0 lúc 0h | CÓ (drain tuyến tính) | **CÓ — cùng loại lỗi** |
| **Sổ kcal (ledger)** — `energy.level/capacity`, `ledgerPct` | Tổng kcal ĐÃ ĂN trong ngày năng lượng so với mục tiêu | KHÔNG (cộng dồn) | Không. Ghi muộn vẫn phải cộng đủ. |

Không được sửa ledger: "đã ăn 1800/2000 kcal" đúng bất kể ghi lúc nào.

### 2.2 Nguyên nhân gốc

Pin no/đói được lưu dạng **một con số đang chạy**, không có lịch sử:
`satietyReserveKcal` + mốc `lastSatietySyncAt` trên dòng `energy` (`battery_readings`).

- Thời gian trôi → `syncSatietyReserve` / `tickDrain` / `useLiveEnergyReading` trừ dần
  từ mốc (`applyCircadianDrain`).
- Ghi bữa ăn → `energyStore.logFood` gọi
  `eatIntoReserve(reserve, n.energyKcal)`, tức là **cộng toàn bộ kcal vào thời điểm
  hiện tại**. Nó bỏ qua `timestamp` (giờ ăn) mà người dùng đã chọn. `timestamp` chỉ
  được dùng để gắn nhãn bữa (`mealTypeForTimestamp`) và lưu vào `food_log`.

Kịch bản của người dùng, từng bước:
1. Cả ngày không ghi gì → reserve tụt dần về **0** (sàn), hiển thị ~20% (`SATIETY_FLOOR_PCT`).
2. 22:30 ghi bữa trưa 12:00 (900 kcal) + bữa xế 16:00 (300 kcal) → `eatIntoReserve(0, 900)`
   rồi `+300` → chạm trần `FULLNESS_CAPACITY_KCAL = 1000` → **100%**.
3. Đúng ra (hồ sơ mẫu nam, 78 kg, 168 cm, 30 tuổi, ít vận động → tiêu hao thụ động
   ≈ 2022 kcal/ngày → ≈ 88 kcal/giờ lúc thức):
   - 12:00 ăn 900 → 900
   - 16:00 còn 900 − 4×88 ≈ 548, ăn 300 → ≈ 848
   - 22:30 còn 848 − 6,5×88 ≈ **275 kcal → ≈ 42%**

   Sai số: **100% so với ~42%**.

Các đường khác có cùng khiếm khuyết "cộng/trừ theo giờ hiện tại":
- `updateFood` (sửa giờ ăn) = `removeFood` + `logFood`, nên cùng lỗi.
- `removeFood` / `reverseFoodOnEnergyReading` trừ **toàn bộ** kcal khỏi reserve. Xoá một
  bữa từ 8 tiếng trước (phần no của nó đã tiêu gần hết) sẽ kéo pin xuống quá tay.
- `logActivity` với `timestampOverride` / `endAt` trong quá khứ: `drainFromWorkout` trừ
  ngay bây giờ.
- `addIntake` (chạm nhanh protein/carbs) và `addCalories`: luôn là "bây giờ", nên đúng.
  Nhưng khi đổi sang mô hình mới, chúng vẫn phải được đưa vào như một sự kiện.
- `logFoodForPastDate` hiện **không bao giờ** chạm satiety (bất biến S-S). Hệ quả: bữa
  tối 23:30 hôm qua ghi bù lúc 01:00 sáng nay bị bỏ qua hoàn toàn. Mô hình mới sửa luôn
  chỗ này.

Pin dinh dưỡng (protein/carbs/water/minerals): `logFood` gọi `applyIntake(r, charge)` ở
thời điểm hiện tại. Còn `tickDrain` chỉ trừ `capacity × drainRatePerHour × giờ` cho
khoảng thời gian **sau khi ghi**. Vì vậy bữa trưa ghi lúc 22:30 được "miễn" 10,5 giờ tiêu hao
(ở mode 5%/h là hơn nửa dung lượng).

Lỗi phụ phát hiện kèm: khi app bị **tắt hẳn** (không phải chạy nền) rồi mở lại,
`loadToday` không trừ phần thời gian đã trôi cho pin dinh dưỡng (`useDrainTick` đặt lại
`lastTickRef = Date.now()` lúc mount). Mô hình mới cũng sửa luôn lỗi này.

### 2.3 Vì sao không vá cục bộ trong `logFood`

Chèn một bữa ăn vào quá khứ làm thay đổi **cả quỹ đạo** của pin từ giờ ăn đến hiện tại.
Quỹ đạo này có **trần** (1000 kcal) và **sàn** (0), nên hiệu ứng không cộng tuyến tính.
Muốn biết pin còn bao nhiêu thì phải biết pin đã ở mức nào suốt khoảng đó, tức là cần lịch sử.
Công thức kiểu `kcal − burn(giờ ăn → bây giờ)` sẽ sai bất cứ khi nào pin từng chạm sàn/trần
(chính là kịch bản của người dùng: pin nằm ở sàn cả ngày).
Cách "hiệu của hai lần replay" (delta-replay) cũng hỏng với tập luyện khi baseline nằm ở sàn.

**Kết luận: pin phụ thuộc thời gian phải là HÀM THUẦN của nhật ký có dấu thời gian**
(event-sourced replay), còn giá trị lưu trong `battery_readings` chỉ là **cache**.

---

## 3. Thiết kế giải pháp

### 3.1 Nguyên tắc (ghi vào docs sau khi xong)

> Mỗi sự kiện tác động lên pin tại **thời điểm nó xảy ra** (giờ ăn / giờ tập kết thúc),
> không phải thời điểm được ghi. Giá trị pin hiện tại = phát lại (replay) mọi sự kiện
> theo thứ tự thời gian, trừ tiêu hao giữa các sự kiện. Ghi muộn và ghi đúng giờ phải
> cho **cùng một kết quả**.

Bất biến kiểm thử quan trọng nhất: **ghi đúng giờ ≡ ghi muộn** (cùng sự kiện, cùng giờ
ăn → cùng mức pin tại cùng thời điểm hiện tại).

### 3.2 Pin no/đói — replay 48 giờ từ DB

- Cửa sổ: `[now − SATIETY_REPLAY_LOOKBACK_HOURS, now]`, hằng số mới **48** trong
  `src/lib/metabolicConstants.ts`, kèm chú thích lý do:
  - Trần 1000 kcal cạn hẳn sau ≤ ~19 giờ kể cả với hồ sơ tiêu hao thấp (≈ 53 kcal/h lúc ngủ).
  - Hai quỹ đạo bắt đầu khác nhau chỉ hội tụ lại khi một trong hai chạm sàn/trần.
    48 giờ dư sức cho việc đó trong mọi kịch bản thực tế.
- Bắt đầu replay với reserve = **0** tại đầu cửa sổ (không cần checkpoint, không cần
  migration, dữ liệu cũ tự lành).
- Nguồn sự kiện (đọc từ DB qua các hàm `*InRange` đã có, rồi lọc theo ms):
  | Nguồn | Loại | kcal | Thời điểm |
  |---|---|---|---|
  | `food_log` | eat | `entry.energyKcal` | `entry.timestamp` |
  | `intake_events` với `batteryTypeId==='energy' && note==='calories'` (addCalories) | eat | `amount` | `timestamp` |
  | `intake_events` thỏa `isManualQuickTapIntake` và `kcalFromMacro(battery, amount) > 0` | eat | `kcalFromMacro(...)` | `timestamp` |
  | `activity_log` với `satietyDrainKcal > 0` | workout | `satietyDrainKcal` | `endAt` nếu có và `≤ timestamp`, ngược lại `timestamp` |

  ⚠️ `intake_events` có dòng `workout_*` (batteryTypeId `'energy'`, note bắt đầu bằng
  `workout`) và `movement_*` (steps). Đây là log phục vụ Excel. **KHÔNG** đếm chúng là
  sự kiện ăn: workout đã có trong `activity_log`, steps không làm tụt satiety.
  Dùng đúng bộ lọc ở bảng trên.
- Bỏ qua sự kiện có thời điểm `> now` (tương lai) và `< đầu cửa sổ`.
- Kết quả ghi vào dòng `energy` hiện tại: `satietyReserveKcal = replay`,
  `lastSatietySyncAt = now`. `tickDrain`, `useLiveEnergyReading` và `useLowEnergyWatch`
  **giữ nguyên**, vì trừ tiếp từ mốc này chính là replay khi không có sự kiện mới.

### 3.3 Pin dinh dưỡng — replay từ 0h với dữ liệu trong bộ nhớ

- Pin protein/carbs/water/minerals đã **reset về 0 lúc 0h** mỗi ngày (`createDailyReading`
  carry-over = 0). Vì vậy replay từ nửa đêm với level 0 là **chính xác**, không cần DB.
- Toàn bộ nguồn nạp cho 4 pin này đều nằm trong store: `foodLog` (hôm nay) và `intakeLog`
  (chạm nhanh thủ công). Đã rà: mọi đường ghi `applyIntake` cho 4 pin này đều đi qua
  `logFood`, `removeFood`, `addIntake`, `removeIntake`, `logFoodForPastDate` và
  `removeFoodForPastDate` (nhánh trùng ngày hiện tại đưa entry vào `foodLog`).
- Tiêu hao: `capacity × mode.drainRatePerHour` mỗi giờ, sàn 0, trần `capacity`.
  Dùng **mode hiện tại** cho cả ngày. Đây là xấp xỉ đã chấp nhận (đổi mode giữa ngày thì
  phần đã qua được tính lại theo mode mới). Ghi rõ trong docs.
- **Ngoài phạm vi:** pin `movement` và `sleep`. Chúng có nguồn khác (`activityLog`
  `movementStepsApplied`, các dòng intake dẫn xuất). Ghi lại thành việc tiếp theo ở §7,
  KHÔNG sửa trong đợt này.

---

## 4. Các đợt triển khai (tuần tự, `npm run verify` xanh sau MỖI đợt)

### W1 — Engine thuần cho pin no/đói (domain, không đụng store)

File: `src/domain/energy/satietyEngine.ts`

1. Tách hàm không làm tròn: `circadianBurnKcalExact(profile, fromMs, toMs): number`.
   `circadianBurnKcal` giữ nguyên hành vi (gọi hàm exact rồi `Math.round`) để test cũ không đổi.
2. Thêm kiểu và hàm:
   ```ts
   export interface SatietyEvent {
     atMs: number;
     kind: 'eat' | 'workout';
     kcal: number; // luôn dương
   }

   // Replays timestamped events in chronological order from a known start
   // state: drain (circadian, unrounded) between events, eat = +kcal capped at
   // FULLNESS_CAPACITY_KCAL, workout = −kcal floored at 0. Events outside
   // [startMs, nowMs] are ignored. Input order does not matter (sorted inside).
   export function replaySatietyReserve(
     profile: UserProfile,
     startReserveKcal: number,
     startMs: number,
     events: readonly SatietyEvent[],
     nowMs: number
   ): number; // làm tròn 1 lần ở cuối
   ```
   Không mutate mảng input (copy rồi sort). Sự kiện trùng `atMs` thì xử lý theo thứ tự ổn định
   (sort ổn định theo `atMs`).
3. Test mới trong `src/domain/energy/__tests__/satietyEngine.test.ts` (dùng
   `circadianBurnKcal` để tính kỳ vọng, KHÔNG hardcode số tiêu hao):
   - Không có sự kiện, start 0 → 0.
   - **Bất biến cốt lõi:** 1 bữa lúc 12:00, now = 22:30. Kết quả replay phải bằng đường
     "đúng giờ": `applyCircadianDrain(eatIntoReserve(0, kcal), profile, 12:00, 22:30)`.
   - **Kịch bản người dùng:** bữa 12:00 900 kcal + 16:00 300 kcal, now 22:30. Kết quả phải
     `< FULLNESS_CAPACITY_KCAL` và bằng phép tính tay theo từng bước. `satietyPercentage` < 100.
   - Thứ tự input không ảnh hưởng (truyền mảng xáo trộn → cùng kết quả).
   - Sự kiện tương lai (`atMs > nowMs`) bị bỏ qua. Sự kiện trước `startMs` bị bỏ qua.
   - Trần: 2 bữa sát nhau vượt 1000 thì bị chặn ở 1000, rồi mới trừ tiêu hao.
   - Workout làm reserve tụt, có sàn 0. Workout rồi ăn khác ăn rồi workout (thứ tự thời
     gian có ý nghĩa).
   - Ngang qua 23:00 → dùng hệ số ngủ (tái sử dụng `localTimeAt` trong test hiện có).
   - Không mutate mảng input.

### W2 — Thu thập sự kiện + nối vào store

1. **Hàm thuần dựng sự kiện** (domain, testable): `src/domain/energy/satietyEvents.ts`
   ```ts
   export function buildSatietyEvents(input: {
     foodLog: readonly FoodLogEntry[];
     intakeEvents: readonly IntakeEvent[];
     activityLog: readonly ActivityLogEntry[];
   }): SatietyEvent[];
   ```
   Áp dụng đúng bảng nguồn và bộ lọc ở §3.2. `isManualQuickTapIntake` đang là hàm private
   trong `energyStore.ts`: chuyển nó sang domain (vd. `src/domain/battery/intakeClassification.ts`),
   export, và cho store import lại. `kcalFromMacro` đã nằm sẵn ở `src/domain/energy/energyBalanceEngine.ts`, import thẳng.
   Test riêng: dòng `workout_*`/`movement_*` trong intake KHÔNG sinh sự kiện eat; `addCalories`
   sinh eat; chạm nhanh protein 50 g sinh eat 200 kcal; workout dùng `endAt` khi hợp lệ.

2. **Store**: `src/store/energyStore.ts`, thêm action nội bộ (có thể export để test):
   ```ts
   recomputeSatiety: () => Promise<void>;
   ```
   - `now = Date.now()`, `from = now − 48h`. Đọc `getFoodLogInRange`,
     `getIntakeEventsInRange`, `getActivityLogInRange` với `dateString(new Date(from))` → `todayString()`,
     rồi lọc `timestamp` trong `[from, now]` (các hàm range cắt theo ngày, rộng hơn cửa sổ).
     ⚠️ `getActivityLogInRange` lọc theo `COALESCE(start_at, timestamp)`. Hoạt động có
     `startAt` rất sớm vẫn được lấy về, sau đó hàm thuần lọc theo thời điểm sự kiện.
   - `replaySatietyReserve(profile, 0, from, buildSatietyEvents(...), now)`.
   - `set((s) => …)` **chỉ** cập nhật `satietyReserveKcal` + `lastSatietySyncAt` của dòng
     `energy` trên state MỚI NHẤT (không ghi đè ledger/nutrient bằng bản chụp cũ), rồi
     `upsertReadings([energyMới])`.
   - DB lỗi (bản web không SQLite) → `console.warn` và fallback replay bằng dữ liệu trong
     bộ nhớ (`foodLog`, `activityLog`, `intakeLog` của hôm nay). Không bao giờ throw.
3. **Thay mọi thao tác satiety trực tiếp bằng `await get().recomputeSatiety()`**, gọi SAU
   khi ghi/xoá DB xong (để DB đã có/đã mất dòng đó):
   | Action | Bỏ | Gọi recompute sau |
   |---|---|---|
   | `loadToday` | carry-over `prev?.satietyReserveKcal` + `syncSatietyReserve` (có thể giữ carry-over làm giá trị tạm) | sau `upsertReadings` / đọc log |
   | `logFood` | `eatIntoReserve` trong `chargeReadings` | sau `upsertReadings` |
   | `removeFood` | phần satiety trong `reverseFoodOnEnergyReading` (giữ `burnEnergy` cho ledger) | sau `deleteFoodLogEntry` |
   | `updateFood` | (tự đúng qua remove + log) | (đã có trong 2 action trên) |
   | `logFoodForPastDate` / `removeFoodForPastDate` | bất biến "không chạm satiety" (nay replay tự quyết theo giờ) | sau khi ghi/xoá log |
   | `addIntake` / `removeIntake` | `eatIntoReserve` / trừ reserve | sau `addIntakeEvent` / `deleteIntakeEventsByIds` |
   | `addCalories` | `eatIntoReserve` | sau `addIntakeEvent` |
   | `logActivity` / `removeActivity` / `updateActivity` | `drainFromWorkout` / phần satiety trong `reverseActivityOnEnergyReading` | sau ghi/xoá `activity_log` |
   | `resetForNewDay` | (có thể giữ carry-over làm giá trị tạm) | cuối hàm |
   - `tickDrain`: **giữ nguyên** `syncSatietyReserve` (drain gia tăng từ mốc).
   - Dòng `energy` của ngày lịch sử (nhánh `!sameEnergyDay`): trường satiety ở đó từ nay
     chỉ là cache chết. Đừng tính ngược satiety trên dòng lịch sử nữa, chỉ đảo ngược ledger.
   - `eatIntoReserve` / `drainFromWorkout` vẫn giữ trong engine (replay dùng lại chúng).
   - Cập nhật comment ở `backfillEngine.ts`, `activityBackfillEngine.ts` và các action trên:
     bất biến cũ "backfill không bao giờ chạm satiety" được thay bằng
     "satiety = replay của nhật ký 48 h".
4. **Chặn giờ tương lai trong store** (phòng thủ): `logFood` / `logFoodForPastDate` /
   `updateFood` dùng `Math.min(timestamp, Date.now())` làm giờ ăn. Chặn chính nằm ở UI (W4).
5. **Test store** (`src/store/__tests__/energyStore*.test.ts`): nhiều test hiện khẳng định
   số học satiety trực tiếp (vd. `1000 − 624` sau workout, `500 → 700` sau chạm protein).
   Các test này **phải được viết lại** để mock 3 hàm `*InRange` trả đúng các sự kiện tương
   ứng, rồi khẳng định giá trị replay. **KHÔNG** được làm yếu assertion hay xoá test để cho
   qua. Thêm test mới:
   - `logFood` với timestamp 12:00 khi now = 22:30 (dùng `jest.useFakeTimers().setSystemTime`)
     → reserve bằng giá trị replay, **không** phải 1000.
   - Ghi muộn ≡ ghi đúng giờ ở tầng store.
   - `removeFood` một bữa cũ chỉ bớt phần còn lại của bữa đó, không bớt toàn bộ kcal.
   - Ledger (`energy.level`) vẫn cộng đủ `energyKcal` khi ghi muộn (không hồi quy).

### W3 — Replay pin dinh dưỡng trong ngày

1. `src/domain/battery/batteryEngine.ts`, thêm hàm thuần:
   ```ts
   export interface PinChargeEvent { atMs: number; amount: number } // amount > 0
   // Level of a linearly-draining pin that starts at 0 at dayStartMs:
   // drain = capacity × drainRatePerHour × hours (floor 0) between events,
   // each event adds `amount` (cap = capacity). Rounded to 0.1 like applyDrain.
   export function replayDrainingPin(
     capacity: number,
     drainRatePerHour: number,
     dayStartMs: number,
     events: readonly PinChargeEvent[],
     nowMs: number
   ): number;
   ```
   Test: ghi muộn ≡ đúng giờ, sàn/trần, bỏ qua sự kiện ngoài `[dayStartMs, nowMs]`, thứ tự
   input không ảnh hưởng, không mutate.
2. Hàm thuần gom sự kiện cho 4 pin: `foodPinEvents(batteryId, foodLog, intakeLog)`
   (`foodLog` → protein `proteinG`, carbs `carbG`, water `waterG`, minerals `mineralsMg`;
   `intakeLog` → `amount` của đúng `batteryTypeId`).
3. Store: helper `recomputeFoodPins(readings, foodLog, intakeLog, mode, nowMs)` thay level của 4
   pin bằng kết quả replay (`dayStartMs` = 0h hôm nay theo giờ địa phương). Gọi ở:
   `loadToday` (sau khi có log, để sửa luôn lỗi mở lại app sau khi tắt hẳn), `logFood`, `removeFood`,
   `addIntake`, `removeIntake`, và nhánh trùng ngày của `logFoodForPastDate` / `removeFoodForPastDate`.
   Trong các action này, phần `applyIntake(r, ±charge)` cho 4 pin được thay bằng replay.
   Không đụng `movement`/`sleep`.
   - `tickDrain` giữ nguyên `applyDrain` + `clampElapsedHoursAtMidnight`.
4. Test store: nhiều test đang seed level protein/water không kèm log. Sửa chúng để seed qua
   `foodLog`/`intakeLog`. Thêm test "ghi bữa trưa lúc 22:30 → pin protein thấp hơn ghi lúc 12:05".

### W4 — UI: chặn giờ tương lai + gợi ý (i18n bắt buộc)

File: `src/components/FoodLogModal.tsx` (+ modal sửa món nếu cho sửa giờ, vd. đường
`updateFood` từ `HomeScreen.tsx:210`).

- Nếu ngày ghi là hôm nay và `timestampForToday(hour, minute) > Date.now()`: không cho xác
  nhận, hiện dòng lỗi dưới ô giờ. Gọi `Date.now()` qua wrapper module-level có sẵn
  (`nowTimestamp`) để qua lint `react-hooks/purity`.
- Nếu giờ ăn sớm hơn hiện tại > 30 phút: hiện 1 dòng gợi ý nhỏ, ví dụ
  "🕓 Pin no/đói sẽ tính từ lúc {{time}}, không phải lúc ghi."
- Key mới trong khối `foodLogModal` (`src/i18n/locales/vi.ts` ~dòng 705) **thêm vào vi.ts TRƯỚC**,
  rồi `en.ts`, `de.ts`. Ví dụ:
  - `futureTimeError`: vi "Giờ ăn không thể ở tương lai." / en "Meal time can't be in the future." /
    de "Die Essenszeit darf nicht in der Zukunft liegen."
  - `lateLogHint`: vi "🕓 Pin no/đói sẽ tính từ lúc {{time}}, không phải lúc ghi." /
    en "🕓 Fullness is counted from {{time}}, not from when you log it." /
    de "🕓 Die Sättigung zählt ab {{time}}, nicht ab dem Eintragen."
  - `{{time}}` định dạng bằng `LOCALE_TAGS[language]`, không hardcode `'vi-VN'`.
- Không hardcode chuỗi. `npx tsc --noEmit` phải bắt được locale nào thiếu key.

### W5 — Tài liệu + nhật ký nghiên cứu (tự làm, không cần hỏi)

Sau khi `npm run verify` xanh:
- `docs/06-energy-expenditure.md` (mục satiety) và `docs/03-architecture.md` (mục pin): thêm
  nguyên tắc §3.1, mô hình replay 48 h, cache vs nguồn sự thật, xấp xỉ "mode hiện tại" cho pin
  dinh dưỡng, và ghi rõ ledger cố ý KHÔNG phụ thuộc thời gian.
- `docs/07-food-log.md`: giờ ăn giờ quyết định hiệu ứng pin, có chặn giờ tương lai, có gợi ý
  ghi muộn (đã i18n 3 ngôn ngữ).
- `.ai/SESSION_LOG.md`: entry phiên mới theo `.ai/skills/session-wrapup.md`, kèm checklist test
  máy thật (§6).
- Điền **§8 Nhật ký triển khai** trong chính file này.

---

## 5. Không được làm

- Không sửa ledger (`energy.level`, `chargeEnergy`, `burnEnergy`, `energyDayApplied`).
- Không thêm cột DB / migration (thiết kế này không cần).
- Không đổi `FULLNESS_CAPACITY_KCAL`, `CIRCADIAN_WINDOW`, `SLEEP_BURN_MULTIPLIER`, `drainRatePerHour`.
- Không thêm thư viện. Không nâng SDK.
- Không làm yếu / xoá test cũ để cho qua (viết lại theo mô hình mới, giữ nguyên ý nghĩa).
- Không sửa pin `movement` / `sleep` trong đợt này.
- Chạy song song nhiều subagent trên cùng working tree thì phải `git diff` kiểm tra sau mỗi đợt
  (từng có sự cố ghi đè lẫn nhau).

---

## 6. Checklist test trên máy thật (cho người dùng)

1. Sáng không ghi gì. Tối (vd. 22:00) ghi bữa trưa lúc 12:00 khoảng 800–900 kcal
   → pin no/đói **không** lên 100%, chỉ ở mức vừa phải (khoảng 30–45%).
2. Cùng lúc đó, số "đã ăn X / mục tiêu Y kcal" vẫn cộng **đủ** kcal bữa trưa.
3. Ghi một món ngay bây giờ (giờ hiện tại) → pin tăng như trước đây.
4. Chọn giờ ăn ở tương lai → báo lỗi, không cho ghi. Thử cả 3 ngôn ngữ.
5. Chọn giờ ăn sớm hơn > 30 phút → thấy dòng gợi ý "tính từ lúc …".
6. Xoá một bữa ghi từ sáng → pin chỉ giảm chút ít, không tụt mạnh.
7. ~~Sửa giờ của một bữa từ 20:00 thành 12:00~~ — UI hiện **chưa có ô sửa giờ** (chỉ sửa lượng, giữ giờ gốc).
   Thay bằng: xoá bữa đó rồi ghi lại với giờ đúng → pin đổi theo giờ mới.
8. Ghi bù bữa tối hôm qua lúc 23:30 khi đang là 01:00 → pin no/đói tăng (trước đây không đổi).
9. Tắt hẳn app vài tiếng rồi mở lại → pin protein/nước đã giảm tương ứng (trước đây đứng yên).
10. Ghi buổi tập kết thúc 17:00 lúc 21:00 → pin no/đói phản ánh buổi tập ở 17:00.

---

## 7. Câu hỏi mở / hướng nghiên cứu sau này

- **Pin movement/sleep**: áp cùng mô hình replay (nguồn `activityLog.movementStepsApplied`
  và chạm nhanh). Cần rà riêng vì có dòng intake dẫn xuất.
- **Mode theo thời gian**: lưu lịch sử đổi mode trong ngày để replay dùng đúng drain rate
  của từng khoảng thay vì mode hiện tại.
- **Hấp thu theo thời gian**: hiện một bữa ăn "vào bụng" tức thì. Có thể mô hình hoá hấp
  thu dần (vd. 30–90 phút theo macro: đạm/béo chậm hơn tinh bột) bằng cách tách sự kiện eat
  thành nhiều lát nhỏ, không đổi kiến trúc replay.
- **Cửa sổ sinh học cá nhân**: `CIRCADIAN_WINDOW` đang cố định 6h–23h. Có thể lấy giờ ngủ
  thật (pin sleep / HealthKit).
- **Hiệu năng**: replay 48 h đọc 3 truy vấn nhỏ mỗi lần ghi. Nếu sau này chậm, thêm checkpoint
  (reserve lúc 0h lưu kèm dòng energy) để replay ngắn hơn.
- **Biểu đồ lịch sử pin no/đói**: vì replay là hàm thuần, có thể vẽ đường pin theo giờ cho
  bất kỳ ngày nào mà không cần lưu thêm dữ liệu.

---

## 8. Nhật ký triển khai (Sonnet ĐIỀN trong lúc làm)

> Mục đích: hồ sơ nghiên cứu cho tính năng pin về sau. Ghi ngắn gọn nhưng đủ để người sau
> hiểu **vì sao** code như vậy. Với mỗi đợt, ghi:
> - Đã sửa file/hàm nào (đường dẫn + tên hàm).
> - Quyết định nào lệch khỏi kế hoạch này và lý do.
> - Test cũ nào phải viết lại, trước khẳng định gì, sau khẳng định gì.
> - Số liệu trước/sau cho kịch bản người dùng (§2.2): % pin no/đói, level protein.
> - Kết quả `npm run verify` (số test pass).
> - Điều bất ngờ phát hiện thêm (bug phụ, giả định sai trong kế hoạch).

### W1
_(Sonnet, 2026-09-23)_ — **xong.**

- **File:** `src/domain/energy/satietyEngine.ts` — tách `circadianBurnKcalExact` (không làm tròn),
  `circadianBurnKcal` giờ chỉ là `Math.round` của nó (hành vi cũ giữ nguyên, 24 test cũ không đổi).
  Thêm `SatietyEvent` + `replaySatietyReserve(profile, startReserve, startMs, events, nowMs)`:
  lọc sự kiện ngoài `[startMs, nowMs]`, sort ổn định, trừ tiêu hao (không làm tròn) giữa các sự kiện,
  eat = cộng và chặn trần 1000, workout = trừ và chặn sàn 0, làm tròn **một lần** ở cuối.
- **Số liệu kịch bản người dùng** (hồ sơ mẫu 78 kg/168 cm/30 tuổi/nam/ít vận động; 900 kcal @12:00 +
  300 kcal @16:00, đọc lúc 22:30): **trước = 1000 kcal = 100%; sau = 275 kcal = 42%** (khớp tính tay ở §2.2).
- **Test mới (9):** replay rỗng → 0; ghi muộn ≡ đúng giờ; kịch bản người dùng; thứ tự input không đổi
  kết quả; bỏ sự kiện tương lai/trước cửa sổ; trần; workout + thứ tự eat/workout; vượt 23:00 dùng
  hệ số ngủ; không mutate input. `satietyEngine.test.ts` 33/33.
- **Lệch kế hoạch:** không. Một test của chính tôi viết sai kỳ vọng (đến 20:00 cả hai thứ tự eat/workout
  đều đã cạn về 0, nên không phân biệt được thứ tự) → đổi thời điểm đọc sang 13:30. Lỗi ở test, không ở engine.
- **Lưu ý môi trường:** `npm run verify` đỏ ngay từ baseline vì phiên khác trong cùng working tree
  đang viết dở `customFoodInput.test.ts` (test gọi hàm chưa tồn tại). Không phải do W1–W5. Tôi kiểm phần
  của mình bằng `tsc` (loại file đó) + `jest --testPathIgnorePatterns customFoodInput` + `eslint`.

### W2
_(Sonnet, 2026-09-23)_ — **xong.**

- **File mới:** `src/domain/battery/intakeClassification.ts` (chuyển `isManualQuickTapIntake` từ store,
  thêm `isManualCalorieIntake`), `src/domain/energy/satietyEvents.ts` (`buildSatietyEvents`, khử trùng
  theo id), `src/domain/energy/__tests__/satietyEvents.test.ts` (10 test). Hằng số
  `SATIETY_REPLAY_LOOKBACK_HOURS = 48` trong `src/lib/metabolicConstants.ts`.
- **Store (`src/store/energyStore.ts`):** thêm action `recomputeSatiety` + helper `loadSatietyEvents`.
  Bỏ mọi `eatIntoReserve` / `drainFromWorkout` / trừ-reserve trực tiếp trong `logFood`, `addIntake`,
  `addCalories`, `removeFood` (`reverseFoodOnEnergyReading` chỉ còn `burnEnergy` cho ledger),
  `removeIntake`, `logActivity`, `removeActivity` (`reverseActivityOnEnergyReading` không còn đảo satiety).
  Gọi `recomputeSatiety` sau ghi/xoá DB ở: `loadToday`, `logFood`, `removeFood`, `logFoodForPastDate`,
  `removeFoodForPastDate`, `addIntake`, `removeIntake`, `addCalories`, `logActivity`, `removeActivity`,
  `resetForNewDay`. `updateFood`/`updateActivity` tự đúng qua remove + log. `tickDrain` giữ nguyên.
  `logFood`/`logFoodForPastDate` chặn `timestamp` ở `Math.min(ts, Date.now())`.
- **Lệch kế hoạch (có lý do):**
  1. **Bộ lọc `addCalories` sai trong kế hoạch.** Kế hoạch ghi `note === 'calories'`, nhưng
     `addCalories` ghi `note: note || 'calories'` nên note có thể là chuỗi tự do (vd. "bánh mì") → sẽ
     bỏ sót. Đổi sang nhận diện bằng **id `energy_*` + `batteryTypeId==='energy'`** (workout dẫn xuất
     dùng `workout_*`, steps dùng `movement_*`).
  2. **Nguồn sự kiện = DB ∪ log hôm nay trong bộ nhớ (khử trùng theo id)**, thay vì "DB, lỗi mới
     fallback bộ nhớ". Lý do: cùng đạt yêu cầu "DB lỗi vẫn chạy" nhưng không phụ thuộc chuyện mock DB
     trả rỗng, và không vỡ khi một dòng chưa kịp flush. Trên máy thật DB ⊇ bộ nhớ nên union vô hại.
  3. **Chống chạy chồng:** thêm token tăng dần `satietyRecomputeSeq`; recompute nào bị recompute mới hơn
     vượt mặt thì không ghi (mỗi lần đọc DB là `await`, có thể hoàn thành sai thứ tự).
  4. **Ghi bù hoạt động quá khứ (`logActivityForPastDate`) vẫn `satietyDrainKcal: 0`** — kế hoạch không
     yêu cầu đổi, nên một buổi tập ghi bù 17:00 hôm qua lúc 01:00 sáng nay CHƯA làm tụt pin no/đói.
     Ghi vào §7 làm việc tiếp theo.
- **Test cũ phải viết lại (13 test, không xoá, không làm yếu):** mọi assertion số học satiety kiểu cũ
  (`1000 − 624`, `500 → 700`, `eatIntoReserve(200,150)=350`, "satiety pass through byte-identical"…) vỡ
  vì reserve giờ là replay, seed `satietyReserveKcal` chỉ còn là cache cũ. Cách sửa:
  - Đóng băng đồng hồ 14:00 (`jest.useFakeTimers().setSystemTime`) ở cấp file → giá trị replay và mốc
    `lastSatietySyncAt` tái lập chính xác.
  - Workout drain: seed 1 bữa 1000 kcal ăn 1 giờ trước, kỳ vọng
    `1000 − circadianBurnKcal(1h) − kcalWorkout` (±1). Trước: `1000 − 624`.
  - Round-trip (log→undo): so `toEqual` với **baseline đã replay** (gồm cả reserve + mốc) → phát biểu
    "khôi phục chính xác" vẫn giữ nguyên, thậm chí chặt hơn.
  - FIX #5/#1 "ngày năng lượng khác": dòng lịch sử **không còn đảo satiety** (cache chết) nên kỳ vọng
    upsert đổi từ `satiety: 350`/`200` sang **giữ nguyên giá trị đã lưu**; ledger hôm nay so bằng
    `ledgerOf()` (bỏ 2 trường cache satiety).
  - Backfill (2 test): "backfill quá khứ không đổi số hôm nay" → dựng baseline replay trước rồi so
    `toEqual` (bữa 3 ngày trước nằm ngoài cửa sổ nên phải giữ nguyên); test overlap 0h–6h đổi
    `satiety 500 (không top-up)` → `max(0, 200 − burn(23:00→02:00))`.
  - `seedReadings()` reset thêm `intakeLog: []` — trước đây lượt chạm protein 50 g còn sót từ test khác
    rò vào replay như 200 kcal đã ăn (làm 3 test mới đỏ với sai số 152/200 cho tới khi phát hiện).
- **Test mới ở tầng store (8):** kịch bản người dùng 22:30; ghi muộn ≡ đúng giờ (đổi đồng hồ 12:00 → 16:00 →
  22:30 so với ghi một lượt lúc 22:30 → `toBe` bằng nhau); ledger vẫn cộng đủ kcal khi ghi muộn; xoá bữa
  sáng đã tiêu hết không kéo pin tụt (reserve giữ nguyên, ledger giảm đúng); giờ ăn tương lai bị chặn;
  `addCalories` note tự do được đếm; dòng `workout_*`/`movement_*` không bao giờ bị đếm là ăn; backfill
  tối qua 23:30 (trong cửa sổ) **làm tăng** pin (trước đây bị bỏ qua hoàn toàn).
- **Kết quả kiểm:** `jest` (loại `customFoodInput`) **613/613**, 51 suite; `tsc` sạch (loại file đó);
  `eslint` sạch trên các file đã sửa.
- **Bất ngờ:** (a) bộ lọc `note==='calories'` của kế hoạch sai (mục 1 ở trên); (b) rò state `intakeLog`
  giữa các test (mục cuối phần test cũ); (c) có phiên khác đang sửa `FoodLogModal.tsx`, 3 file locale,
  docs và `SESSION_LOG.md` trong cùng working tree — W4/W5 phải sửa nhỏ, từng chỗ, và kiểm `git diff`.

### W3
_(Sonnet, 2026-09-23)_ — **xong.**

- **File:** `src/domain/battery/batteryEngine.ts` (`PinChargeEvent`, `replayDrainingPin`),
  `src/domain/battery/foodPinReplay.ts` mới (`FOOD_PIN_IDS`, `isFoodPin`, `foodPinEvents`,
  `recomputeFoodPinLevels`), test mới `foodPinReplay.test.ts` + 8 test trong `batteryEngine.test.ts`.
  Store: helper `recomputeFoodPins` gọi ở `loadToday`, `logFood`, `removeFood`, nhánh trùng ngày của
  `logFoodForPastDate`/`removeFoodForPastDate`, `addIntake`, `removeIntake`. `tickDrain` giữ nguyên
  (drain tuyến tính có sàn 0 là "không nhớ", nên tick tăng dần và replay cho cùng kết quả).
- **Số liệu (chế độ `maintain` = 3%/giờ, pin protein dung lượng 120 g → 3,6 g/giờ):**
  bữa trưa 50 g protein ăn 12:00, ghi lúc 22:30 → **trước 50 g; sau 12,2 g**.
  Bữa tối 50 g ăn 20:00, ghi 22:30 → trước 50 g; sau **41 g**.
- **Lệch kế hoạch (có lý do):**
  1. **Mốc 0h lấy theo `date` của chính dòng pin, không phải "hôm nay" theo đồng hồ.** Kế hoạch ghi
     `dayStartMs = 0h hôm nay`. Nhưng dòng pin có thể vẫn mang ngày hôm qua tới khi `loadToday` làm mới
     (≤ ~15 phút sau nửa đêm). Replay theo ngày của dòng, dừng ở hết ngày đó, đúng tinh thần
     `clampElapsedHoursAtMidnight`. Hệ quả chấp nhận: một lần chạm nước lúc 00:05 vào dòng chưa làm mới
     sẽ chưa hiện ngay; đến khi `loadToday` chạy thì replay lấy lại đúng (còn code cũ thì cộng nhầm vào
     dòng hôm qua rồi **mất** lượt chạm đó ở ngày mới).
  2. **UI hiện tại chỉ còn NƯỚC (và ngủ) là chạm nhanh thủ công**; protein/carbs/khoáng chỉ đến từ nhật
     ký ăn (HomeScreen.handleCellPress). `foodPinEvents` vẫn xử lý đủ 4 pin cho an toàn.
  3. `addIntake` với `amount <= 0` giữ đường `applyIntake` cũ (không phải "một lần nạp").
  4. `loadToday` nay đọc log TRƯỚC rồi mới `upsertReadings` (đổi thứ tự để dùng log cho replay).
- **Ngoài phạm vi (đúng kế hoạch):** `movement`, `sleep` vẫn tăng/giảm dần như cũ. Các dòng pin của
  NGÀY QUÁ KHỨ (backfill vào hàng lịch sử) vẫn cộng thẳng, không replay.
- **Test cũ phải sửa:** 3 test (`removeIntake` nước/protein, `addIntake water behaves as before`) seed
  dòng pin với `date: '2026-07-08'` cứng trong khi đồng hồ test đóng băng ở 2026-09-23 → replay theo ngày
  của dòng loại sự kiện ra. Sửa fixture dùng `todayString()` (như thiết bị thật). Ý nghĩa assertion không đổi.
- **Test mới ở tầng store (6):** bữa tối ghi muộn đã drain 2,5 giờ; ghi muộn ≡ ghi đúng giờ (đối chiếu
  với đường tăng dần `logFood` + `tickDrain(2.5h)` làm chuẩn độc lập); bữa trưa ghi 22:30 < ghi 12:05;
  xoá bữa → replay từ phần còn lại; chạm nước + undo về đúng mức cũ; `loadToday` drain cho các giờ đã tắt
  app (không tin mức đã lưu).
- **Kết quả kiểm:** `jest` (loại `customFoodInput`) **635/635**, 52 suite; `tsc` và `eslint` sạch.
- **Bất ngờ:** `cat` thừa trong lệnh debug của tôi làm treo shell (đọc stdin) — đã dừng, file test sạch;
  test `loadToday` ban đầu thiếu dòng `energy` nên đi nhánh "ngày mới" và chạm `db.getFirstAsync` mà mock
  DB không có → `loadToday` rơi vào nhánh `catch` (pin về 0). Lỗi ở fixture.

### W4
_(Sonnet, 2026-09-23)_ — **xong.**

- **File:** `src/components/FoodLogModal.tsx` — ô giờ: giờ ăn ở tương lai (chỉ khi ngày ghi là hôm nay, và đã
  điền cả HH lẫn MM) → hiện `futureTimeError` và **tắt nút "Ghi món"**; sớm hơn hiện tại ≥ 30 phút →
  hiện `lateLogHint` với giờ định dạng bằng `toLocaleTimeString(LOCALE_TAGS[language])`. Logic phân loại tách
  thành hàm thuần `src/domain/food/mealTimeStatus.ts` (`'future' | 'late' | 'ontime'`, ngưỡng
  `LATE_LOG_HINT_MINUTES = 30`) + `mealTimeStatus.test.ts` (4 test). Gọi "bây giờ" qua wrapper
  `nowTimestamp()` sẵn có của file để qua lint `react-hooks/purity`. Style mới: `timeError`, `timeHint`.
- **i18n:** 2 key mới `components.foodLogModal.futureTimeError` / `lateLogHint` ở `vi.ts` (trước) rồi `en.ts`,
  `de.ts`, đúng câu chữ của kế hoạch §4 W4. Không hardcode chuỗi; `tsc` không báo thiếu key.
- **Lệch kế hoạch:** kế hoạch nhắc "modal sửa món nếu cho sửa giờ" — kiểm tra thì **không có UI sửa giờ**:
  `HomeScreen.handleEditFood` chỉ nhận `{grams, count}` và `updateFood` giữ giờ gốc (luôn ≤ hiện tại). Nên
  W4 chỉ cần sửa `FoodLogModal`. Bước 7 của checklist §6 đã đổi tương ứng. Không thêm guard trong `confirm()`:
  thời gian chỉ trôi về phía trước nên "render nói hợp lệ nhưng confirm nói tương lai" không thể xảy ra, và
  store đã kẹp `Math.min(ts, Date.now())` làm chốt cuối.
- **Đụng phiên khác:** `FoodLogModal.tsx` và 3 file locale đang có sửa dở của phiên Session 30 (food-form).
  Chỉ dùng edit nhỏ đúng chỗ (locale của tôi ở khối `foodLogModal`, của họ ở `customFoodFields`) và kiểm lại
  marker sau đó — cả hai bộ sửa cùng tồn tại, `tsc` + `eslint` sạch.
- **Kiểm:** `mealTimeStatus` 4/4; `tsc` 0 lỗi; `eslint` sạch. Chưa có test component (repo không có harness
  render RN cho modal này); hành vi UI nằm trong checklist máy thật §6 bước 4–5.

### W5
_(Sonnet, 2026-09-23)_ — **xong.**

- `docs/06-energy-expenditure.md` §6A: mô hình replay 48h, nguồn sự kiện, cache vs nguồn sự thật, ví dụ 100% → 42%,
  ledger cố ý không phụ thuộc thời gian, hạn chế còn lại (backfill hoạt động quá khứ).
- `docs/03-architecture.md`: mục mới "Pin theo GIỜ ĂN, không phải giờ ghi" (nguyên tắc, bảng 4 loại pin, danh
  sách action gọi recompute, token chống chạy chồng, xấp xỉ "mode hiện tại").
- `docs/07-food-log.md`: mục 3d "Giờ ăn quyết định hiệu ứng lên pin" (chặn giờ tương lai, gợi ý ghi muộn, xoá bữa cũ).
- `.ai/SESSION_LOG.md`: Session 31. `.ai/CONTEXT.md` §10: trạng thái mới.
- **Không làm:** `docs/HUONG-DAN-SU-DUNG-APP.md` / `USER-GUIDE-DE.md` — hai file này đang có sửa dở của phiên
  food-form; thêm một dòng "giờ ăn quyết định pin" vào hướng dẫn người dùng là việc nhỏ cho lần sau.
- **Kết quả cuối:** `npm run verify` **xanh hoàn toàn — 54 suite, 716/716 test** (trước khi bắt đầu: 629 ở HEAD).

**Tổng kết số liệu trước/sau (§2.2, hồ sơ mẫu 78 kg/168 cm/30 tuổi/nam/ít vận động, chế độ `maintain`):**
| Kịch bản (ghi lúc 22:30) | Trước | Sau |
|---|---|---|
| Pin no/đói: 900 kcal @12:00 + 300 kcal @16:00 | 1000 kcal = **100%** | 275 kcal = **42%** |
| Pin protein: 50 g @12:00 | **50 g** | **12,2 g** |
| Pin protein: 50 g @20:00 | **50 g** | **41 g** |
| Sổ kcal "đã ăn" | cộng đủ | cộng đủ (không đổi, cố ý) |

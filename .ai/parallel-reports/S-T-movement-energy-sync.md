# S-T — Sync pin Vận động ↔ pin Năng lượng (2 bug) + 3 bài tập powerlifting (2026-07-15)

## Làm gì
Sửa 2 bug đồng bộ đã xác nhận sẵn giữa pin Vận động (movement) và pin Năng lượng (energy),
theo TDD nghiêm ngặt (viết test fail trước, rồi mới code). Thêm 3 bài tập powerlifting
(squat/bench_press/deadlift) vào hệ MET + nhãn tiếng Việt.

### Root cause → fix mapping
- **BUG A** — `energyStore.logActivity` chỉ nạp pin Vận động từ `steps`
  (`if (mi !== -1 && steps > 0) applyIntake(updated[mi], steps)`), nên một buổi tập
  chỉ có "loại bài + số phút" (không có bước chân — luồng chính của modal Vận động)
  KHÔNG BAO GIỜ nạp pin Vận động.
  → Fix: `metabolismEngine.workoutStepEquivalent`/`totalStepEquivalent` quy đổi số phút
  tập ra "bước chân tương đương" (100 bước/phút cho MET < 6, 130 bước/phút cho MET ≥ 6 —
  Marshall 2009 / Tudor-Locke 2019 CADENCE-adults). `logActivity` giờ nạp pin Vận động
  bằng `steps + totalStepEquivalent(workouts)`, snapshot lại thành
  `entry.movementStepsApplied` để `removeActivity` hoàn tác đúng số đã nạp (không phải
  recompute lại — công thức cadence có thể đổi sau này).
  `removeActivity` đổi từ dùng trực tiếp `a.steps` sang helper
  `movementChargeOf(entry) = entry.movementStepsApplied ?? entry.steps ?? 0` — dòng dữ
  liệu cũ (trước migration, không có field mới) fallback về `steps` đúng như hành vi cũ
  của chúng, không bị lệch.
  Dòng `intake_events` ghi cho xuất Excel **giữ nguyên chỉ tính theo `steps`** (không làm
  méo số bước chân xuất ra).

- **BUG B** — `energyStore.addIntake('movement', amount)` (bấm thẳng vào ô pin Vận động →
  IntakeModal) chỉ quy đổi kcal qua `kcalFromMacro`, mà hàm này trả về 0 cho `movement` —
  nên nạp trực tiếp vào pin Vận động KHÔNG BAO GIỜ làm lớn mục tiêu (goal) của pin Năng
  lượng, trong khi `logActivity` (nạp qua modal "Ghi vận động") thì có (`growGoalFromActivity`).
  → Fix: `addIntake` khi `batteryId === 'movement'` và `amount > 0`, sau khi nạp pin, GỌI
  THÊM `growGoalFromActivity(energyReading, profile, amount, [], opts?.stepType ?? 'walking')`
  để lớn `capacity`/`activityBonusKcal` của pin Năng lượng — y hệt cách `logActivity` làm
  với bước chân. KHÔNG đụng `level` (đã ăn) và KHÔNG đụng `satietyReserveKcal` (vận động
  không phải kcal đã ăn). `addIntake` có thêm tham số thứ 4 tuỳ chọn
  `opts?: { stepType?: StepActivityType }` để cho phép quy đổi theo loại vận động chính
  xác hơn (walking/running/hiking) thay vì luôn mặc định đi bộ.

### 3 bài tập powerlifting
`MET_TABLE` thêm `squat: 5.0`, `deadlift: 5.0` (Compendium of Physical Activities 2024, mã
02052 — mã DUY NHẤT gọi tên squat/deadlift), `bench_press: 4.0` (suy luận giữa mã 02054=3.5
và 02050=6.0; Robergs 2007/Reis 2017 cho thấy bench tốn năng lượng thấp hơn squat).
`EnergyActionsBar.ACTIVITY_LABELS` thêm nhãn tiếng Việt: `squat: 'Squat'`,
`bench_press: 'Bench press'`, `deadlift: 'Deadlift'` — 3 bài tự động hiện trong danh sách
chip chọn môn tập (vì `ACTIVITY_TYPES = Object.keys(MET_TABLE)`), không cần sửa gì khác
trong file này.

## File đã sửa (đúng phạm vi được giao)
- `src/types/energy.ts` — thêm `'squat' | 'bench_press' | 'deadlift'` vào `ActivityType`;
  thêm `StepActivityType`; thêm `movementStepsApplied?: number` vào `ActivityLogEntry`
  (kèm doc comment giải thích fallback cho dòng cũ).
- `src/lib/metabolicConstants.ts` — thêm `STEP_KCAL_PER_KG` (walking/running/hiking, trích
  dẫn Compendium 2024); `KCAL_PER_STEP_PER_KG` giờ = `STEP_KCAL_PER_KG.walking` (giữ
  nguyên giá trị cũ, không phá vỡ chỗ nào đang dùng); thêm 3 dòng MET mới; thêm
  `STEP_EQUIV_MODERATE_PER_MIN`/`STEP_EQUIV_VIGOROUS_PER_MIN`/`VIGOROUS_MET_THRESHOLD`.
- `src/domain/energy/metabolismEngine.ts` — `stepsKcal` nhận thêm tham số tuỳ chọn
  `stepType` (mặc định `'walking'` — mọi chỗ gọi cũ không đổi hành vi); thêm
  `workoutStepEquivalent`/`totalStepEquivalent`.
- `src/domain/energy/energyBalanceEngine.ts` — `growGoalFromActivity` nhận thêm tham số
  tuỳ chọn `stepType` (mặc định `'walking'`), truyền xuống `stepsKcal`.
- `src/store/energyStore.ts` — fix A (logActivity + removeActivity + helper
  `movementChargeOf`), fix B (addIntake + tham số `opts`).
- `src/data/db/schema.ts` — thêm cột migration `movement_steps_applied REAL` vào
  `ACTIVITY_LOG_MIGRATION_COLUMNS` (theo đúng pattern `{ name, ddl }` có sẵn).
- `src/data/repositories/activityLogRepository.ts` — map `movement_steps_applied` ở
  `rowToEntry`, `addActivityLogEntry`, `updateActivityLogEntry`.
- `src/components/EnergyActionsBar.tsx` — CHỈ thêm 3 dòng vào `ACTIVITY_LABELS` (bị
  TypeScript bắt buộc vì `Record<ActivityType, string>` giờ có 3 key mới).
- Test: `src/domain/energy/__tests__/metabolismEngine.test.ts`,
  `src/domain/energy/__tests__/energyBalanceEngine.test.ts`,
  `src/store/__tests__/energyStore.test.ts`.

Không đụng `src/data/db/database.ts` — file này đã tự động chạy migration cho MỌI cột
trong `ACTIVITY_LOG_MIGRATION_COLUMNS` (kể cả bản cài mới, `CREATE TABLE` không có cột
mới nhưng `migrateColumns()` luôn kiểm tra + ALTER nếu thiếu — đúng pattern cũ của
`activity_bonus_kcal` v.v., không cần sửa gì thêm ở đây).

## Kết quả (TDD — viết test trước, xác nhận fail, rồi mới code)
- Test mới viết trước: 9 test ở `metabolismEngine.test.ts`, 2 test ở
  `energyBalanceEngine.test.ts`, 9 test ở `energyStore.test.ts` (BUG A: 4 test, backward
  compat pre-migration: 1 test, BUG B: 4 test) = **20 test mới**.
  Chạy lần đầu: **14 test FAIL** (do hàm/tham số/field chưa tồn tại) — xác nhận đúng
  bước "red" của TDD trước khi viết code sản xuất.
- Sau khi code: `npm run verify` (tsc + eslint + jest) — **TẤT CẢ XANH**:
  - `tsc --noEmit`: sạch, không lỗi.
  - `npm run lint`: sạch, 0 lỗi.
  - `npx jest`: **407 test PASS / 36 suite** (trước khi bắt đầu phiên này, một agent song
    song khác đã commit riêng thêm test cho `lowBatteryRules` — số 407 bao gồm cả phần đó,
    không phải chỉ của gói này; riêng phần việc của gói này là +20 test có chủ đích).

## Không có sai lệch so với spec
Toàn bộ implementation bám sát đúng spec đã giao (constants/công thức/tên hàm/tham số/vị
trí sửa) — không cần deviate chỗ nào.

## Ghi chú vận hành (không phải bug, chỉ để minh bạch)
Giữa phiên làm việc, một agent song song khác đã tự `git commit` xong việc của họ
(`b380025 fix(S-A): tiêu đề cảnh báo pin yếu hiển thị đúng tên pin`, đụng
`src/domain/rules/lowBatteryRules.ts` + test + `src/services/notifications/
notificationService.ts`) — ngoài phạm vi gói này, không đụng tới. Xác nhận qua
`git reflog`/`git log` rằng đây là 1 commit hợp lệ từ tiến trình khác, không phải dữ liệu
bị mất. Các file uncommitted của agent khác nêu trong đề bài
(`TodayMeals.tsx`, `DayDetailSheet.tsx`, `NutritionDetailSheet.tsx`, `nutritionDetail.ts`
+ test) — KHÔNG bị đụng tới, vẫn còn nguyên trạng thái uncommitted như lúc bắt đầu.

## Còn lại / bàn giao
- Chưa test tay trên điện thoại (ngoài phạm vi gói logic-backend này).
- Chưa `git commit` — theo đúng luật "chỉ commit khi người dùng yêu cầu rõ".

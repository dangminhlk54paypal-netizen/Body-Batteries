# S-T (UI) — Chip chọn loại vận động trong IntakeModal + preview kcal (2026-07-15)

## Làm gì
Nối phần domain/store đã có sẵn (BUG B fix — `addIntake(batteryId, amount, note, opts?: {
stepType })`, `stepsKcal(steps, weightKg, stepType)`) vào giao diện: khi bấm thẳng vào pin
Vận động, người dùng giờ chọn được loại vận động (Đi bộ/Chạy bộ/Leo núi) và thấy trước ước
tính kcal sẽ được cộng vào mục tiêu ăn hôm nay.

## File đã sửa (đúng phạm vi được giao — chỉ 2 file)
- `src/components/IntakeModal.tsx`
  - Thêm state `stepType` (`StepActivityType`, mặc định `'walking'`), reset về `'walking'`
    cùng chỗ reset `amount`/`note` khi xác nhận xong.
  - Thêm hàng chip `STEP_TYPE_OPTIONS` (Đi bộ/Chạy bộ/Leo núi), chỉ hiện khi
    `battery?.id === 'movement'`, tái dùng nguyên style `unitRow`/`unitChip`/
    `unitChipActive`/`unitChipText`/`unitChipTextActive` đã có sẵn cho hàng chip ml/L của
    nước — không style mới nào bị nhân bản.
  - Mở rộng `Props.onConfirm` thành
    `(amount: number, note: string, opts?: { stepType?: StepActivityType }) => void`;
    `handleConfirm` chỉ truyền `{ stepType }` khi `isMovement`, `undefined` cho mọi pin
    khác (hành vi các pin khác không đổi).
  - Thêm dòng preview kcal (`movementKcalPreview`) — **giá trị suy ra thẳng từ render**
    (`parseFloat(amount)` + `stepsKcal(...)`), KHÔNG dùng `useEffect`/`setState` (tuân thủ
    rule `react-hooks/purity` + `set-state-in-effect` đang bị chặn bởi hook). Chỉ hiện khi
    số nhập > 0 và pin đang chọn là Vận động. Style `kcalHint`: `fontSize: 12`,
    `color: colors.textSubtle` (theme token có sẵn, không hardcode hex).
  - Lấy `weightKg` qua `useSettingsStore((s) => s.userProfile)`.
- `src/screens/HomeScreen.tsx`
  - `handleIntakeConfirm` nhận thêm tham số thứ 3 `opts?: { stepType?: StepActivityType }`
    và chuyển thẳng xuống `addIntake(selectedBattery.id as BatteryId, amount, note, opts)`
    — không thêm logic gì khác, đúng tinh thần UI "ngu" (dumb), logic vẫn ở store/domain.

Không đụng file nào khác (theo đúng scope giao — store/domain/types đã do gói S-T
logic-backend làm xong trước đó, không sửa lại).

## Kết quả xác minh
- `npm run typecheck` → sạch, không lỗi.
- `npm run lint` → sạch, 0 lỗi.
- `npm test` → **407/407 test PASS**, 36 suite (không thêm test mới — đây là UI pass-through
  thuần tuý, logic đã được test đầy đủ ở gói S-T logic-backend).

## Checklist test tay (tiếng Việt)
1. Bấm vào pin Vận động → chọn "Chạy bộ", gõ số bước (vd 2000) → thấy dòng
   "≈ N kcal — mục tiêu ăn hôm nay sẽ tăng thêm chừng này" hiện ra và đổi số khi đổi chip
   Đi bộ/Chạy bộ/Leo núi; bấm Nạp ⚡ xong mở lại modal thì chip phải quay về "Đi bộ".
2. Bấm vào pin khác (Nước, Đạm...) → không thấy hàng chip vận động và không thấy dòng
   preview kcal nào — giao diện các pin khác giữ nguyên như trước.

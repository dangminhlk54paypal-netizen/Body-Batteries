# QA Fix batch — #2, #3, #4 (logic-backend)

Agent: logic-backend. Scope: `src/data`, `src/domain`, `src/store` only (không đụng `src/components`).

## Fix #2 (nghiêm trọng) — `getAnyFoodById` không merge `portionUnit`/`servingWeightG` từ override

**File:** `src/data/food/foodLookup.ts`

Object merge trong `getAnyFoodById` chỉ mang `nameVi/nameEn/category/defaultServingG/per100g`
từ override lên base, bỏ sót `portionUnit`/`servingWeightG` — mọi chỉnh sửa đơn vị
viên/gói (TPCN) qua override bị bỏ qua ở toàn app (micro batteries, Excel export,
food log lookup...).

Sửa: thêm 2 dòng vào object return:
```ts
portionUnit: override.portionUnit ?? base.portionUnit,
servingWeightG: override.servingWeightG ?? base.servingWeightG,
```
(`override` ở đây là `FoodItem` đầy đủ do `rowToOverrideItem` map ra, đã có sẵn 2 field
này — xác nhận qua `src/data/repositories/foodOverrideMapper.ts`.)

Test mới trong `src/data/food/__tests__/foodOverrideRegistry.test.ts`:
- merge lấy `portionUnit`/`servingWeightG` từ override khi override có set.
- fallback về base khi override không set 2 field này.

## Fix #4 (vừa) — thiếu validate `servingWeightG` khi chọn Gói/Viên

**File:** `src/domain/food/customFoodInput.ts`, hàm `isValidCustomFoodInput`

Trước đó chỉ check tên (non-blank) + kcal (≥0, parse được). Thêm: nếu
`input.portionUnit` là `'pack'` hoặc `'capsule'`, `servingWeightG` phải parse ra số
> 0 (dùng `parseNum` sẵn có — blank/NaN → 0 → invalid), nếu không thì `false`
(chặn nút Lưu). Case `portionUnit === 'gram'` không bị ảnh hưởng.

Test mới trong `src/domain/food/__tests__/customFoodInput.test.ts`:
- `pack` + `servingWeightG: ''` → invalid.
- `capsule` + `servingWeightG: '0'` → invalid.
- `pack` + `servingWeightG: '1.5'` → valid.
- `gram` + `servingWeightG: ''` → vẫn valid (không bắt buộc).

## Fix #3 (vừa) — `removeActivity` đảo pin `movement` bằng phép trừ có clamp gây sai

**File:** `src/store/energyStore.ts`, hàm `removeActivity`

Vấn đề gốc: pin `movement` (capacity 8000 bước) được nạp CỘNG DỒN + kẹp trần qua
`applyIntake(reading, steps)` mỗi lần `logActivity`. `removeActivity` cũ đảo ngược
bằng `applyIntake(r, -entry.steps)` — một khi pin đã bị kẹp trần bởi entry đang xoá
(hoặc bởi tổng các entry), phép trừ trực tiếp làm sai lệch/xoá luôn đóng góp của
các entry hợp lệ khác trong ngày.

Sửa đúng bản chất: chỉ với pin `movement`, thay vì trừ incremental, RECOMPUTE level
từ tổng `steps` của các entry còn lại trong `activityLog` (store's `activityLog` đã
tự scope theo ngày — nạp qua `getActivityLogForDate(today)` ở `loadToday`, xoá sạch ở
`resetForNewDay`, nên filter theo id là đủ, không cần filter ngày thêm) rồi
`clampLevel(sum, r.capacity)`:
```ts
const remainingMovementSteps = activityLog
  .filter((a) => a.id !== id)
  .reduce((sum, a) => sum + (a.steps ?? 0), 0);
...
if (r.batteryTypeId === 'movement') {
  return { ...r, level: clampLevel(remainingMovementSteps, r.capacity) };
}
```
Vì `logActivity` chỉ CỘNG (không bao giờ trừ) vào pin `movement`, level cộng dồn có
kẹp trần sau n lần nạp luôn bằng `min(tổng steps đã nạp, capacity)` — nên recompute
từ tổng steps còn lại chính xác là nghịch đảo của `logActivity`, không phải xấp xỉ.

`energy` (capacity/`activityBonusKcal`/`satietyReserveKcal`) GIỮ NGUYÊN cách
incremental-reverse cũ — các pin đó còn nhận đóng góp từ food/passive drain nên
không thể recompute thuần từ activity log. Đã ghi comment giải thích trực tiếp
trong code.

`updateActivity` không cần sửa riêng — nó gọi `removeActivity` rồi `logActivity`,
nên tự động thừa hưởng fix.

Test mới trong `src/store/__tests__/energyStore.test.ts`:
- log A (5000 steps) → movement = 5000.
- log B (8100 steps) → movement = 8000 (kẹp trần).
- `removeActivity(B)` → movement = **5000** (không phải 0) — đúng theo yêu cầu QA.
- Test cũ "mistakenly huge step count... undo never goes negative" (entry duy nhất
  trong ngày, kẹp trần) vẫn PASS không đổi: recompute từ tập rỗng còn lại = 0, khớp
  hành vi cũ.

## Kiểm tra

```
npx tsc --noEmit     → sạch (no output)
npm run lint          → sạch (no errors)
npx jest              → 28 suites, 276/276 tests PASS (271 gốc + 5 test mới)
```

## Files đã đổi

- `src/data/food/foodLookup.ts` (fix)
- `src/domain/food/customFoodInput.ts` (fix)
- `src/store/energyStore.ts` (fix)
- `src/data/food/__tests__/foodOverrideRegistry.test.ts` (test mới, Fix #2)
- `src/domain/food/__tests__/customFoodInput.test.ts` (test mới, Fix #4)
- `src/store/__tests__/energyStore.test.ts` (test mới, Fix #3)

Không đụng `src/components`/`src/screens`.

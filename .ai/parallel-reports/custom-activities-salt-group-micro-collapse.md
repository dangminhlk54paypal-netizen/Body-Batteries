# mobile-frontend — 3 tính năng UI (môn tự thêm, nhóm muối, thu gọn vi chất)

Agent: `mobile-frontend`. Nhánh: `ui-upgrade` (không commit — để agent điều phối commit).
Foundation (Wave A) đã có sẵn trong `settingsStore.ts`/`types/energy.ts`/`upperLimits.ts`/
`types/nutrition.ts` trước khi phiên này bắt đầu — không đụng các file đó.

## File đã sửa

- `src/components/EnergyActionsBar.tsx`
- `src/components/TodayActivities.tsx`
- `src/components/food/CustomFoodFields.tsx`
- `src/components/MicroBatteryStack.tsx`

`FoodNutritionEditModal.tsx` **không cần sửa** — đã xác nhận nó tái dùng `CustomFoodFields`
trực tiếp (không có bản field copy riêng), nên nhóm "Muối & điện giải" tự động áp dụng ở cả
"Thêm món mới" và "Sửa thành phần".

## FEATURE 1 — Môn vận động tự thêm (EnergyActionsBar + TodayActivities)

- **Chip chọn**: sau các chip có sẵn của nhóm đang chọn, hiển thị thêm 1 chip cho mỗi
  `customActivities` thuộc đúng nhóm (`c.category === category`). Chọn built-in hay custom là
  2 trạng thái loại trừ nhau (`selectedCustomId: string | null` — chọn built-in gọi
  `selectBuiltIn()` xoá `selectedCustomId`; chọn custom gọi `selectCustom()`).
- **Ghi log**: khi có `selectedCustomId` và có phút hợp lệ, `confirmActivity()` log
  `workouts: [{ type: 'custom', minutes, customName: c.nameVi, customMet: c.met }]` thay vì
  dùng `activity` built-in.
- **"＋ Thêm môn"**: chip cuối chuỗi mở form nội tuyến (thay thế toàn bộ khu vực chip, không
  phải nested modal) — Tên môn (TextInput), 4 chip nhóm (mặc định = tab đang mở), 4 chip cường
  độ (Nhẹ~3/Vừa~5/Cao~8/Rất cao~10 MET, điền vào ô MET dùng chung) + TextInput MET nhập tay,
  dòng giải thích cố định. Lưu → `addCustomActivity` rồi đọc lại
  `useSettingsStore.getState().customActivities.at(-1)` để lấy id vừa tạo (state append đồng
  bộ nên an toàn) và tự chọn chip đó; đồng thời đổi `category` hiển thị sang nhóm vừa chọn
  trong form để chip mới thực sự hiện ra (quyết định thêm ngoài spec — nếu không, chip mới có
  thể "vô hình" khi người dùng chọn nhóm khác nhóm tab đang mở). Huỷ → quay lại chip, không lưu.
- **Xoá**: nút ✕ nhỏ cạnh mỗi chip custom (không nested trong cùng Pressable — 2 Pressable
  cạnh nhau trong 1 View để tránh xung đột responder của RN) → `Alert.alert` xác nhận →
  `removeCustomActivity`; nếu đang xoá đúng chip đang chọn thì xoá luôn `selectedCustomId`.
- **Đổi nhóm** (`switchCategory`) nay cũng xoá `selectedCustomId` — quyết định thêm ngoài spec
  để tránh trạng thái "đã chọn 1 custom activity vô hình" khi chip của nó không còn hiện dưới
  tab mới.
- **TodayActivities.tsx**: `summaryLabel` (danh sách hôm nay) dùng `workoutLabel()` mới =
  `w.customName ?? ACTIVITY_LABELS[w.type]`. Modal "Sửa vận động": khi mục đang sửa có
  `workouts[0].type === 'custom'` (`isCustomEntry()`), thay dãy chip built-in bằng 1 chip cố
  định không bấm được hiển thị `customName`; `confirmEdit()` đọc trực tiếp
  `editingEntry.workouts[0]` để giữ nguyên `type/customName/customMet`, chỉ áp dụng phút/bước
  chân/giờ mới nhập — không có state phụ nào khác cần thêm.

## FEATURE 2 — Nhóm "Muối & điện giải" (CustomFoodFields.tsx)

- Tách Natri/Kali/Magiê ra khỏi `MICRO_FIELD_BASE` thành `ELECTROLYTE_FIELD_BASE`, render sau
  các vi chất còn lại dưới tiêu đề phụ "Muối & điện giải". Không thêm/bớt field dữ liệu nào —
  Muối (NaCl) vẫn KHÔNG được lưu, đúng như comment sẵn có trong `microBatteryEngine.ts`.
- Ngay dưới ô Natri, khi `input.sodiumMg` là số hợp lệ (không rỗng, `parseFloat` không NaN),
  hiện dòng suy diễn thuần render: `≈ {sodium×2.5/1000 làm tròn 1 chữ số} g muối (NaCl) — quy
  đổi từ natri` — cùng công thức với `microBatteryEngine.per100gValue('salt')`. Không có state
  mới, không setState trong effect.
- `FoodNutritionEditModal.tsx`: không sửa (xem trên).

## FEATURE 3 — Thu gọn "Vi chất đã nạp" + badge cảnh báo (MicroBatteryStack.tsx)

- Header "Vi chất đã nạp" nay là `Pressable` (chevron ▸/▾ trước tiêu đề) toggle
  `settingsStore.microCollapsed` qua `setMicroCollapsed` — đọc/ghi store trực tiếp trong
  component, cùng pattern `MasterBattery.tsx` dùng cho `particleEffectsEnabled`.
- Khi `microCollapsed === true`: ẩn toàn bộ (ghi chú khuyến nghị, date chip, mọi hàng pin,
  `OverdoseNotice`), chỉ còn 1 dòng gọn bấm được: `▸ Đang thu gọn — bấm để xem {n} vi chất
  {· ⚠️ {warnCount} vượt ngưỡng nếu > 0}`. `n = states.length` (đúng bằng tổng 11 vi chất vì
  4 nhóm PROMINENT/MORE/LIMIT/ELECTROLYTE phủ đúng 1 lần mỗi vi chất — đã xác nhận qua
  `nutrientTargets.ts`).
- `MicroCell`: thêm hàm thuần `isOverReference(state)` — `kind==='limit'` → `state.over`
  (natri/đường/muối, đúng ngưỡng riêng của chúng); `kind==='goal'` → chỉ cảnh báo khi
  `state.current > UPPER_LIMITS[state.id]?.value` (bảng UL riêng, KHÔNG dùng target/khuyến
  nghị hàng ngày của goal — giữ đúng nguyên tắc "vượt khuyến nghị goal vẫn trung tính, không
  cảnh báo" đã có sẵn trong comment `MicroCell`). Khi `isOverReference` true, thêm `⚠️` ngay
  sau `{percentage}%` — không đổi màu, không đụng logic caption cũ.
- `warnCount` (dùng cho dòng thu gọn) = `states.filter(isOverReference).length`, tính trên
  toàn bộ `states` (không phải chỉ phần đang hiện), cùng rule với badge trên từng ô.

## Verify

`npx tsc --noEmit` sạch · `npm run lint` sạch · `npm run verify` (tsc + lint + jest) —
**440 test PASS / 38 suite**, không suite/test nào mới bị thêm hay xoá (3 tính năng này đều là
UI thuần, không đụng domain/store logic cần test riêng).

## Sai khác so với spec (đều là quyết định nhỏ bổ sung, không đổi hành vi cốt lõi)

1. `switchCategory` xoá `selectedCustomId` khi đổi nhóm (spec không nói rõ) — tránh chọn ẩn.
2. `saveCustomActivity` đổi luôn `category` hiển thị sang nhóm vừa lưu, để chip mới hiện ra
   ngay lập tức thay vì chỉ chọn ngầm.
3. Nút xoá chip custom dùng 2 `Pressable` cạnh nhau (không nested) thay vì đúng chữ "một ✕
   trên mỗi chip" về mặt cấu trúc cây — vẫn đúng về mặt hình ảnh/UX (✕ nằm sát cạnh chip).

Không tính năng nào cần sửa `stores`/`domain` — đúng phạm vi được giao.

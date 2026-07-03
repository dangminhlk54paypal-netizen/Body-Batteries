# S-P — Mục tiêu cân nặng → mục tiêu kcal/ngày an toàn

**Trạng thái:** ✅ XONG CODE (2026-07-03/04) — chưa test máy (S-A sẽ gồm cả luồng này).

## Ngưỡng an toàn đã xác nhận với người dùng trước khi code
1. Thâm hụt/thặng dư mỗi ngày bị kẹp ở **mức nhỏ hơn** giữa **20% mức duy trì** và **750 kcal**;
   mục tiêu **không bao giờ dưới BMR**.
2. Có ô nhập **"trong bao lâu" (`goalWeeks`) tuỳ chọn**. Nếu để trống, app tự chọn **tốc độ an
   toàn nhanh nhất** (đúng bằng mức thâm hụt/thặng dư an toàn tối đa mỗi ngày).

## File đã tạo
- `src/domain/energy/weightGoal.ts` — hàm thuần `dailyCalorieTarget(profile)`:
  - Không có `goalWeightKg` → trả về `maintenanceKcal` (giữ nguyên, không đổi hành vi cũ).
  - Có goal: `weightDeltaKg = weightKg - goalWeightKg` (dương = giảm cân, âm = tăng cân).
  - Có `goalWeeks` → deficit/day = `7700 × |Δkg| / (goalWeeks × 7)`; không có → dùng thẳng mức an
    toàn tối đa (`min(20% × maintenance, 750)`).
  - Kẹp độ lớn deficit/day về mức an toàn, rồi kẹp `targetKcal` không dưới BMR.
  - Trả về `{ targetKcal, maintenanceKcal, appliedDeltaKcal, wasClamped }`.
- `src/domain/energy/__tests__/weightGoal.test.ts` — 8 test: không goal, goal=cân hiện tại, giảm
  nhẹ (không kẹp), giảm gấp (kẹp về mức an toàn), giữ floor BMR ở goal cực đoan, bỏ trống
  `goalWeeks` dùng tốc độ an toàn nhanh nhất, tăng cân (surplus), tăng cân gấp (kẹp).
- `src/lib/weightGoalConstants.ts` — `MAX_DEFICIT_PCT` (0.2), `MAX_DEFICIT_KCAL` (750),
  `KCAL_PER_KG_BODY_FAT` (7700), `GOAL_WEIGHT_LIMITS` (20-300 kg), `GOAL_WEEKS_LIMITS` (1-104 tuần).
  File **riêng** với `metabolicConstants.ts` — không đụng file đó (dành cho S-O).

## File đã sửa
- `src/types/energy.ts` — thêm `goalWeightKg?: number`, `goalWeeks?: number` vào `UserProfile`
  (optional, không đổi hồ sơ cũ).
- `src/domain/energy/profileValidation.ts` — validate `goalWeightKg`/`goalWeeks` khi có mặt
  (dùng giới hạn từ `weightGoalConstants.ts`), giữ nguyên toàn bộ validate cũ. Thêm 3 test.
- `src/components/BodyProfileCard.tsx` — thêm 2 ô "Cân nặng mong muốn" + "Trong bao lâu (tuần, để
  trống = an toàn nhất)", hiện "Mục tiêu calo/ngày" tính ra khi có goal, ghi chú nhẹ nhàng nếu bị
  kẹp an toàn ("để an toàn, app đề xuất mức vừa phải hơn"), kèm "Chỉ để tham khảo, không thay thế
  tư vấn y tế." Không sửa `SettingsScreen.tsx` (cha) hay bất kỳ file nào khác ngoài danh sách này.

## Ranh giới sức khoẻ (CONTEXT mục 5)
- Không chặn thao tác khi người dùng nhập mục tiêu vượt ngưỡng — chỉ tự kẹp về mức an toàn và
  nói nhẹ, không chê trách.
- Không dùng từ ngữ hù doạ; ghi chú kẹp dùng giọng trung tính.
- Luôn kèm "Chỉ để tham khảo" cạnh mục tiêu calo.

## Không đụng (đúng cam kết)
`metabolicConstants.ts`, `types/satiety.ts`, `satietyEngine.ts` (của S-O), `energyStore.ts`,
`SettingsScreen.tsx`, `App.tsx`, `MasterBattery.tsx`.

## Kiểm tra trước khi báo xong
- `npx tsc --noEmit` → sạch (exit 0).
- `npx jest` → **144 test PASS / 14 suite** (8 test mới của `weightGoal`, +3 test mới của
  `profileValidation`).
- `npx expo export --platform ios` → **Bundled OK, 1430 module**.

## Việc còn lại (cho gói S-Q)
- S-Q sẽ dùng `dailyCalorieTarget(profile).targetKcal` làm `capacity` của "Sổ calo hôm nay" thay
  cho `passiveDailyBurn` hiện tại — chỉ cần gọi hàm này trong `energyStore.ts`, không cần sửa gì
  thêm ở đây.
- Chưa test trên máy thật (gộp vào S-A cùng luồng S-O/S-Q).

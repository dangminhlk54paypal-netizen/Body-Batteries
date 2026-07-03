# 📋 Gói S-F — Bước chân v1 (mức trung bình/ngày)

**Ngày:** 2026-06-19 (phiên này)
**Trạng thái:** ✅ **XONG**

---

## Mục tiêu

Thêm field "số bước trung bình/ngày" vào hồ sơ cơ thể. Người dùng nhập 1 lần, app dùng số đó tính hao năng lượng do đi lại (cộng vào `passiveDailyBurn`). Không cần HealthKit/Health Connect — chạy ngay trong Expo Go hiện tại.

**Tại sao:**
- App cần biết lượng bước để tính TDEE chính xác hơn
- Cách simple nhất: người dùng nhập 1 số "trung bình/ngày" cố định, không phải dữ liệu thật
- Sau này (S-F v2) có thể thay bằng HealthKit/Health Connect hoặc `expo-sensors` Pedometer

---

## Thay đổi code

### 1. `src/types/energy.ts`
- Thêm `averageDailySteps?: number` vào interface `UserProfile`

### 2. `src/lib/metabolicConstants.ts`
- Thêm `averageDailySteps: { min: 0, max: 30000 }` vào `PROFILE_LIMITS`

### 3. `src/domain/energy/profileValidation.ts`
- Thêm validate cho `averageDailySteps` — phải từ 0 đến 30000

### 4. `src/domain/energy/metabolismEngine.ts`
- Sửa `passiveDailyBurn()`:
  - Trước: chỉ tính `BMR × occupation factor`
  - Giờ: `baseBurn + stepsKcal(averageDailySteps ?? 0, weightKg)`
  - Lý do: số bước trung bình là phần "steady-state" luôn xảy ra, không phải vận động riêng lẻ

### 5. `src/components/BodyProfileCard.tsx`
- Thêm state `averageDailySteps` và field nhập vào form
- Label: "Số bước trung bình/ngày (0-30000 — tạm thời ước tính, sẽ cập nhật từ dữ liệu thật sau)"
- Cộng vào `preview` object để TDEE xem trước tính đúng

### 6. `src/domain/energy/__tests__/metabolismEngine.test.ts`
- Thêm 2 test case cho `passiveDailyBurn()`:
  - "adds kcal from average daily steps": 8000 bước tính thêm 312 kcal
  - "defaults to zero steps if not provided": nếu không set thì = 0

---

## Kiểm tra

```bash
npx tsc --noEmit       ✅ sạch
npx jest               ✅ 94 test PASS / 11 suite (2 test mới + 92 cũ)
npx expo export        ✅ Bundled 1426 modules
```

---

## Cách dùng

1. Mở **Cài đặt → Hồ sơ cơ thể**
2. Nhập "Số bước trung bình/ngày" (ví dụ: 8000)
3. TDEE xem trước sẽ tăng = 2022 (sedentary BMR × 1.2) + 312 (8000 steps) = 2334 kcal/ngày
4. Bấm "Lưu hồ sơ"
5. Mở app lại: hôm nay pin Năng lượng có sức chứa tính theo TDEE mới (2334 thay vì 2022)

---

## Ràng buộc tuân thủ

- ✅ Mặc định `averageDailySteps = 0` (không đổi hành vi hồ sơ cũ)
- ✅ Không sửa `App.tsx`, `energyStore.ts`, `SettingsScreen.tsx`
- ✅ Không sửa nút "🏃 Vận động" hay `EnergyActionsBar.tsx` (vẫn giữ cách nhập bước thêm lên đó)
- ✅ KHÔNG chạy song parallel với S-K hay U6 (không xen nhau)

---

## Ghi chú

- Field label ghi rõ "tạm thời ước tính, sẽ cập nhật từ dữ liệu thật sau" (S-F v2) — tránh nhầm lẫn
- Số bước này là **TRUNG BÌNH cố định** (không phải số bước thật hôm đó) — đúng ý tưởng pass-through vào `passiveDailyBurn`
- Có thể chạy **song parallel** với S-A (test máy) hoặc sau S-M (khi S-M xong)

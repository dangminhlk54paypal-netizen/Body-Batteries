# S-F2 — Tích hợp Apple Health (HealthKit) — Backend Phases 1-3

**Agent:** logic-backend · **Ngày:** 2026-07-10 · **Nhánh:** `ui-upgrade`

## Phạm vi đã làm (Phase 1-3/6 — service, storage, state; KHÔNG đụng UI)

Đọc kcal đã đốt hôm nay (active + resting energy) từ Apple HealthKit qua thư viện
`react-native-health`, hiển thị **song song, không trộn** vào pin Năng lượng/mục
tiêu hiện có (chỉ để hiển thị). Fallback ước tính BMR khi HealthKit không có/bị
từ chối/không có dữ liệu.

## File đã tạo

- `src/services/health/appleHealthSync.ts` — service thuần (KHÔNG phụ thuộc
  Zustand/SQLite/React), bọc `react-native-health`:
  - `requestHealthKitPermission(): Promise<boolean>`
  - `getTodayEnergyBurnedDetailed(): Promise<HealthSyncResult>` — union trạng thái
    `'success' | 'permission_denied' | 'unavailable' | 'no_data' | 'error'`
  - `getTodayEnergyBurned(): Promise<{active, resting} | null>` — wrapper tiện dụng
  - `calculateTotalBurned(active, resting): number` — tổng thuần, chống null/NaN
  - Tự phát hiện "chưa link native module" (`isHealthKitLinked()` kiểm tra các
    hàm trên object có tồn tại không) — quan trọng vì `react-native-health`
    không throw khi chưa link (Expo Go/Android/chưa build dev client), nó chỉ
    trả về object thiếu hết method → gọi trực tiếp sẽ crash "is not a function"
    nếu không guard.
- `src/services/health/__tests__/appleHealthSync.test.ts` — 12 test, mock toàn
  bộ `react-native-health`: permission granted+data, permission denied, chưa
  link, `isAvailable(false)` (iPad), no data (2 stream rỗng), tổng đúng khi 1
  stream = 0, lỗi callback → status `'error'`.
- `src/store/__tests__/energyStore.appleHealth.test.ts` — 8 test cho
  `syncAppleHealthBurned` + tích hợp `loadToday`.

## File đã sửa

- `src/data/repositories/healthSignalsRepository.ts` — **giữ nguyên**
  `logWeight`/`getWeightHistory`, thêm 4 hàm mới dùng lại đúng bảng
  `health_signals` sẵn có (cột `source/type/value`, KHÔNG cần cột mới):
  - `logAppleHealthBurned(kcal, timestamp, syncDate)` — `source='apple_health'`,
    `type='total_burned:<syncDate>'`
  - `getAppleHealthBurnedForDate(date)` — kcal gần nhất đã sync cho ngày đó
  - `recordSyncTimestamp('synced'|'estimated')` / `getLastSyncTimestamp()` —
    dấu thời gian lần sync gần nhất (mọi kết quả), phục vụ cache 2 giờ sống
    sót qua lần khởi động app mới.
- `src/store/energyStore.ts` — additive-only, KHÔNG đụng logic action nào cũ:
  - Thêm vào `EnergyState`: `appleHealthBurnedKcal: number`,
    `lastAppleHealthSync: number | null`,
    `appleHealthStatus: 'idle'|'syncing'|'synced'|'estimated'`,
    `syncAppleHealthBurned: () => Promise<void>`
  - `syncAppleHealthBurned`: kiểm tra cache 2h (ưu tiên state trong RAM, nếu
    `null` — ví dụ app vừa mở lại — mới hỏi `getLastSyncTimestamp()` từ DB để
    khỏi gọi lại HealthKit ngay sau khi mở app) → gọi
    `getTodayEnergyBurned()` → thành công thì `logAppleHealthBurned` +
    `recordSyncTimestamp('synced')` + status `'synced'`; bất kỳ thất bại nào
    (null hoặc throw) → `dailyExpenditure(currentProfile()).total` (BMR +
    passive, KHÔNG tái dùng logic BMR) + `recordSyncTimestamp('estimated')` +
    status `'estimated'`. Không bao giờ throw.
  - `loadToday`: gọi `get().syncAppleHealthBurned().catch(...)` **fire-and-
    forget** ở cuối hàm (ngoài try/catch chính) — không await, không thể làm
    vỡ luồng load pin/nhật ký hiện có dù HealthKit chậm/lỗi/bị từ chối.
- `package.json` — thêm dependency `react-native-health@^1.19.0` (đã
  `npm install` thật, không chỉ sửa tay JSON).
- `app.json` — thêm `expo.ios.infoPlist.NSHealthShareUsageDescription` (key
  `ios.infoPlist` trước đây CHƯA có, giữ nguyên `supportsTablet`/
  `bundleIdentifier`) + thêm plugin `react-native-health` vào mảng
  `expo.plugins` (thư viện có sẵn `app.plugin.js` — tự thêm entitlement
  `com.apple.developer.healthkit` + 2 dòng Info.plist share/update khi build
  qua EAS).

## Không cần migration schema

`health_signals` đã có sẵn cột `id, timestamp, source, type, value` — đủ
dùng, không phải `ALTER TABLE`. Không đụng `src/data/db/schema.ts`.

## Quyết định thiết kế đáng chú ý

- kcal đã đốt (Apple Health) là **chỉ để hiển thị** — không cộng/trừ vào
  `battery_readings.capacity`, không đụng `activityBonusKcal`/
  `satietyReserveKcal`/energy-day nào cả. Hoàn toàn tách biệt khỏi hệ pin
  Năng lượng hiện có (đúng yêu cầu, tránh đếm trùng).
- `'no_data'` chỉ kích hoạt khi **cả hai** mảng mẫu (active + resting) rỗng —
  không phải khi tổng = 0 (một luồng = 0 kcal vẫn hợp lệ nếu luồng kia có
  dữ liệu, ví dụ apple watch không đeo nhưng basal vẫn có).
- `react-native-health` không throw khi chưa link native module (Expo Go)
  — nó trả object rỗng chức năng. Đã tự viết `isHealthKitLinked()` guard
  thay vì dựa vào try/catch, để phân biệt đúng `'unavailable'` với `'error'`.

## Xác nhận

- `npx tsc --noEmit` sạch
- `npx eslint 'src/**/*.{ts,tsx}'` — 0 error, 0 warning
- `npx jest` — **371 test PASS / 34 suite** (tăng từ 351/32 — thêm 2 file
  test mới: `appleHealthSync.test.ts` 12 test,
  `energyStore.appleHealth.test.ts` 8 test), toàn bộ test cũ vẫn xanh
- `npm run verify` (tsc+eslint+jest) — PASS toàn bộ

## Việc còn lại cho agent khác (Phase 4-6 — KHÔNG phải việc của gói này)

- **UI agent (Phase 4-5):** hiển thị `appleHealthBurnedKcal`/
  `appleHealthStatus` trên Home (badge trạng thái 'synced' vs 'estimated'
  cho người dùng phân biệt "số thật từ Apple Health" với "số ước tính"), nút
  đồng bộ tay gọi `useEnergyStore.getState().syncAppleHealthBurned()`.
- **Docs agent (Phase 6):** hướng dẫn build dev client qua EAS
  (`eas build --profile development`) vì `react-native-health` cần link
  native — sẽ KHÔNG chạy trong Expo Go.
- Người dùng **chưa test máy thật** — cần dev client EAS mới test được
  luồng HealthKit thật (permission prompt, dữ liệu thật). Trong Expo Go,
  toàn bộ luồng sẽ tự rơi vào nhánh `'unavailable'` → fallback BMR ước tính
  (đã kiểm chứng bằng test, hành vi đúng như thiết kế).

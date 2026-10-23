# S-F (bản Pedometer) — Đi bộ ra ngoài + bộ đếm bước của iPhone / Apple Health

**Yêu cầu người dùng (2026-10-23):** "Tích hợp một phần đi bộ với bộ đếm của Apple Health vào
trong máy, và cộng dồn theo ngày, mỗi lần ra khỏi nhà."

## Cách làm
- Dùng `expo-sensors` (`Pedometer`, ~15.0.8 — bản đúng của SDK 54, cài bằng `npx expo install`).
  **Chạy được trong Expo Go**, không cần dev build. Trên iPhone, Pedometer đọc CoreMotion — chính
  là nguồn bước chân mà Apple Health ghi lại cho iPhone — nên số bước khớp với Health (trừ phần
  Apple Watch, vì HealthKit thật vẫn cần native module / dev build → để S-F v2).
- iOS hỏi được số bước cho bất kỳ khoảng thời gian nào trong 7 ngày gần nhất → bấm "Ra khỏi nhà",
  tắt app, đi bộ, mở lại bấm "Về nhà" vẫn đếm đúng.
- Android: chỉ đếm trực tiếp khi app đang mở (`watchStepCount`), lưu định kỳ vào DB.

## File
- MỚI `src/types/walk.ts`, `src/domain/steps/walkSessions.ts` (+ test),
  `src/data/repositories/walkSessionRepository.ts`, `src/services/steps/pedometerService.ts`,
  `src/components/WalkTrackerCard.tsx`.
- SỬA `src/data/db/schema.ts` — bảng mới `walk_sessions` (CREATE IF NOT EXISTS, không đụng bảng cũ).
- SỬA `src/screens/HomeScreen.tsx` — chèn `<WalkTrackerCard />` dưới `EnergyActionsBar`.
- SỬA `src/store/energyStore.ts` — `logActivity` khi có `steps` giờ nạp luôn pin "Vận động"
  (đơn vị bước, 8000/ngày); trước đây chỉ đốt pin Năng lượng.
- SỬA `app.json` — plugin `expo-sensors` (NSMotionUsageDescription) + quyền Android
  `ACTIVITY_RECOGNITION` (chỉ có tác dụng khi build riêng, Expo Go dùng quyền của chính nó).
- SỬA `package.json` / `package-lock.json` — thêm `expo-sensors`.

## Hành vi
- Thẻ "🚶 Đi bộ ra ngoài" trên Home: tổng bước cả ngày (Apple Health/iPhone), tổng cộng dồn các
  lần ra ngoài hôm nay + số lần, nút 🚪 Ra khỏi nhà / 🏠 Về nhà, số bước trực tiếp khi đang ở
  ngoài, danh sách từng lần hôm nay và tổng theo ngày 7 ngày gần nhất. Có "Huỷ lần này".
- Về nhà → lưu số bước của lần đó + gọi `logActivity({ steps })` (đốt kcal theo `stepsKcal` và nạp
  pin Vận động, ghi intake event cho export Excel).
- Lần ra ngoài tính vào ngày bắt đầu.

## Kiểm tra
`npx tsc --noEmit` sạch · `npx jest` 97 test / 12 suite PASS · `npx expo export --platform ios`
→ 1448 modules. **Chưa test trên điện thoại thật** (cần xác nhận quyền Motion & Fitness hiện ra
trong Expo Go và số bước khớp Apple Health).

## Bổ sung: Đồng hồ bấm giờ kiểu Apple (2026-10-23)
- MỚI `src/domain/stopwatch/stopwatch.ts` (+ test), `src/store/stopwatchStore.ts` (zustand persist
  AsyncStorage), `src/components/StopwatchCard.tsx`; SỬA `HomeScreen.tsx` (thẻ dưới WalkTrackerCard).
- Giống app Đồng hồ của iPhone: số lớn `mm:ss,cc`, nút tròn Bắt đầu (xanh) / Dừng (đỏ), Vòng /
  Đặt lại, danh sách vòng (vòng đang chạy ở trên cùng, vòng nhanh nhất xanh, chậm nhất đỏ khi có
  ≥2 vòng).
- Tính theo mốc thời gian thực (không đếm tick) + lưu trạng thái → vẫn chạy đúng khi tắt app.
- Kiểm tra: tsc sạch · jest 102 test / 13 suite PASS · expo export ios 1451 modules.
- Lưu ý: bản web (`expo start --web`) trắng trang do lỗi có sẵn `import.meta` trong zustand ESM —
  không do gói này gây ra, chưa sửa.

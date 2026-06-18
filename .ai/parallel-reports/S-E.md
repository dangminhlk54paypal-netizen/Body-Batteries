# S-E — Unit test cho domain logic (2026-06-18)

**Trạng thái: ✅ XONG**

## Làm gì
Viết unit test (jest-expo) cho toàn bộ hàm thuần trong `src/domain` và `src/lib` theo đúng
phạm vi gói S-E. Không sửa bất kỳ file code nguồn nào.

## File đã tạo/sửa
- TẠO `jest.config.js` (preset `jest-expo`).
- TẠO `src/domain/battery/__tests__/batteryEngine.test.ts`
- TẠO `src/domain/rules/__tests__/lowBatteryRules.test.ts`
- TẠO `src/domain/modes/__tests__/modeDefinitions.test.ts`
- TẠO `src/lib/__tests__/dateUtils.test.ts`
- SỬA `package.json`:
  - thêm script `"test": "jest"`
  - thêm devDeps `jest@^29.7.0`, `jest-expo@^54.0.0` (bản 54.x mới nhất khớp Expo SDK 54
    là `54.0.17`), `@types/jest@^29.5.14`
  - không cần `ts-jest`: `babel-preset-expo` (đã có trong `babel.config.js`) đủ để strip TS
    syntax cho jest, type-check vẫn do `tsc --noEmit` đảm nhiệm riêng.
- `package-lock.json` cũng đổi theo sau `npm install` (hệ quả tự nhiên, không sửa tay).

**KHÔNG đụng** file code nguồn nào khác — đã kiểm tra lại `git status` trước khi báo cáo.

## Phạm vi test (chỉ hàm thuần, không test component/DB)
- `batteryEngine.ts`: `capacityForMode`, `clampLevel`, `toPercentage`, `applyIntake`,
  `applyDrain`, `computeMasterLevel`, `createDailyReading`.
- `lowBatteryRules.ts`: `checkLowBattery` (gồm cả threshold tuỳ chỉnh — hàm này vừa được
  gói S-C thêm tham số `threshold`), `hasCriticalBattery`.
- `modeDefinitions.ts`: `getModeById`, và kiểm tra shape của `MODES` (mỗi mode có đủ 6 hệ số
  nhân battery + `drainRatePerHour` > 0).
- `dateUtils.ts`: `dateString`, `todayString`, `daysAgo`, `isToday`, `daysBetween` (dùng
  `jest.useFakeTimers().setSystemTime()` để cố định "hôm nay", test cả case lùi qua ranh giới
  tháng 31→01).
  - **Cố ý KHÔNG test** `formatDisplayDate` (phụ thuộc ICU/locale `vi-VN` của môi trường chạy
    test → dễ flaky giữa các máy) và `nowTimestamp` (chỉ là wrapper `Date.now()`, không có logic
    để test).

## Kết quả kiểm tra
```
npx jest        → 4 suites, 41 tests PASS
npx tsc --noEmit → sạch (exit 0)
npx expo export --platform ios --output-dir /tmp/check_S-E → "iOS Bundled ... (1406 modules)" OK
```

## Bug phát hiện trong code nguồn
**Không phát hiện bug nào** trong các hàm thuần đã test — toàn bộ hành vi khớp với tên hàm và
comment sẵn có (clamp, rounding, fallback khi capacity=0, v.v.).

Đã tranh thủ đối chiếu chéo với thay đổi của gói S-C (đang chạy song song, sửa cùng lúc
`lowBatteryRules.ts`/`settingsStore.ts`): `checkLowBattery` nhận `threshold` dạng phân số
0.0–1.0, và `settingsStore.lowBatteryThreshold` cũng lưu dạng phân số 0.0–1.0 (comment
`// 0.0 – 1.0` ngay trong code) → **nhất quán, không có lỗi đơn vị %/phân số**. Chỉ ghi chú lại
ở đây để phiên gộp biết đã verify, không cần action gì thêm.

## Còn lại / gợi ý cho phiên sau
- Không có việc còn thiếu trong phạm vi gói S-E.
- Gợi ý (không bắt buộc): khi `App.tsx` (gói S-D) khởi tạo xong, có thể thêm CI script chạy
  `npm test` trước khi `expo export` để bắt sớm regression — nhưng đó là quyết định ngoài
  phạm vi gói này, để phiên gộp/người dùng quyết định.

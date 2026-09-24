# Skill: expo-react-native-dev

## Khi nào dùng skill này?
Kích hoạt khi:
- Thêm package mới vào dự án
- Debug lỗi bundle / metro
- Test trên thiết bị thật qua Expo Go
- Fix lỗi liên quan đến SDK version
- Thắc mắc về cấu hình Expo

---

## 🔒 Ràng buộc không được vi phạm

| Ràng buộc | Chi tiết |
|-----------|---------|
| **SDK version** | Expo **SDK 57** (nâng từ 54 ngày 2026-09-09, Session 28) — KHÔNG nâng tiếp khi chưa có lý do rõ ràng + người dùng đồng ý |
| **React Native** | 0.86.3 |
| **React** | 19.2.3 |
| **TypeScript** | ~6.0 |
| **Kiến trúc** | New Architecture là bắt buộc từ SDK 55 — không còn `newArchEnabled`/legacy để lùi về |
| **Expo Go** | Phải khớp với bản Expo Go trên điện thoại người dùng (hiện SDK 57; Apple không cho cài lại bản cũ) |
| **expo-file-system** | Chỉ dùng API `File`/`Directory`/`Paths` — `expo-file-system/legacy` đã bị SDK 57 **xoá hẳn** |

---

## 📦 Cách thêm package an toàn

```bash
# Luôn dùng npx expo install — KHÔNG dùng npm install thẳng
npx expo install <package-name>

# Kiểm tra xem package có tương thích SDK 57 không trước
# https://docs.expo.dev/versions/v57.0.0/
```

Package có code native (không có sẵn trong Expo Go) → chỉ chạy được qua dev client
(`npx eas-cli build --profile development`), KHÔNG test được bằng EAS Update/Expo Go.

**Các package đã có trong dự án (KHÔNG cài lại):**
- `expo-sqlite` — database
- `expo-file-system` — file system (API `File`/`Directory`/`Paths`)
- `expo-sharing` — share file
- `expo-notifications` — thông báo cục bộ
- `expo-secure-store` — lưu khoá mã hoá diary (`src/lib/encryption.ts`)
- `expo-background-fetch` + `expo-task-manager` — tác vụ nền
- `expo-updates` — EAS Update (xem skill [`eas-preview-publish`](eas-preview-publish.md))
- `expo-dev-client` — build dev client (cần cho HealthKit)
- `expo-splash-screen` — splash (cấu hình qua plugin trong `app.json`)
- `react-native-health` — Apple HealthKit (tự no-op khi chạy trong Expo Go)
- `react-native-svg` — vẽ biểu đồ (dùng thay cho victory-native)
- `xlsx` — xuất Excel

---

## 🚀 Lệnh chạy chuẩn

```bash
# Chạy dev server (tự sinh lại foodDatabase.generated.ts trước)
npm start
npx expo start --tunnel   # khi wifi trường/công ty chặn / khác mạng

# Test trên iPhone không cần Mac bật → skill eas-preview-publish
npx eas-cli update --branch preview --environment preview --non-interactive --message "..."

# Build kiểm tra bundle (không cần EAS)
npx expo export

# Kiểm tra dependencies
npx expo-doctor           # báo lỗi version mismatch

# Cổng kiểm tra trước khi báo xong
npm run verify            # tsc + eslint + jest
```

---

## ⚠️ Gotchas đã gặp trong dự án

### 1. Watchman bỏ qua node_modules
**Vấn đề:** `.watchmanconfig` cấu hình sai → bundle hỏng
**Fix:** Giữ `.watchmanconfig` là `{}` — không được ignore `node_modules`

### 2. expo-file-system: chỉ còn API mới
```typescript
// ❌ Sai — /legacy không còn tồn tại từ SDK 57
import * as FileSystem from 'expo-file-system/legacy';

// ✅ Đúng — API File/Directory/Paths
import { File, Paths } from 'expo-file-system';
const file = new File(Paths.document, 'export.xlsx');
file.create({ overwrite: true });
file.write(data);
const text = await file.text();
```
Mẫu tham khảo: `src/services/food/myFoodsBackupService.ts`,
`src/services/export/excelExportService.ts`, `src/services/export/trainingBlockExportService.ts`.

### 3. SQLite WAL mode
```typescript
// Phải bật WAL ngay khi mở DB (xem src/data/db/database.ts)
await db.execAsync('PRAGMA journal_mode = WAL;');
```

### 4. Notification trên iOS simulator
- iOS Simulator KHÔNG nhận push notification thật
- Phải test trên thiết bị thật qua Expo Go

### 5. `eas update` bắt buộc `--environment` (SDK 55+)
Thiếu flag `--environment` → lệnh báo lỗi ngay. Không có `eas` cài toàn cục — dùng `npx eas-cli`.

### 6. "Cannot find module" dù `npm ls` báo có
Sau khi đổi SDK, `node_modules` có thể lệch (vd. `expo-modules-core` được liệt kê nhưng không có
trên đĩa). `rm -rf node_modules && npm install` chưa chắc sửa được — cài trực tiếp đúng version
package đó để npm resolve lại, rồi gỡ nó khỏi `package.json` nếu `expo-doctor` phàn nàn.

### 7. Splash screen
Key `"splash"` top-level trong `app.json` đã bị loại khỏi schema SDK 57 → cấu hình qua plugin
`expo-splash-screen` trong mảng `plugins`.

---

## 📁 Cấu trúc src/ chuẩn của dự án

```
src/
├── components/     ← UI thuần (BatteryCell, MasterBattery, TrendChart, training/...)
├── screens/        ← Màn hình app (HomeScreen, DiaryScreen, TrainingScreen, SettingsScreen...)
├── data/
│   ├── db/         ← SQLite schema, init, migrations
│   ├── food/       ← Catalog món ăn (foodDatabase.generated.ts, foodLookup...)
│   └── repositories/ ← Truy vấn theo bảng
├── domain/         ← Logic thuần, test được (battery, energy, food, health, modes,
│                     nutrition, rules, training)
├── hooks/          ← Custom hooks (useDrainTick, useLiveEnergyReading...)
├── i18n/           ← Đa ngôn ngữ VI/EN/DE (useT, locales/) — xem AGENTS.md
├── services/       ← Tác vụ có side-effect (notification, export Excel, food backup...)
├── store/          ← Zustand stores (energyStore, settingsStore, blockStore...)
├── lib/            ← Tiện ích (encryption, dateInput, theme...)
├── navigation/     ← React Navigation config
└── types/          ← Global TypeScript types
```

---

## 🔗 Tài liệu tham khảo

- Docs Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
- expo-sqlite: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- expo-file-system: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
- expo-notifications: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- EAS Update: https://docs.expo.dev/eas-update/introduction/

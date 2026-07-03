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
| **SDK version** | Expo **SDK 54** — KHÔNG nâng lên 55/56 mà không có lý do rõ ràng |
| **React Native** | 0.81.5 |
| **React** | 19.1.0 |
| **Expo Go** | Phải khớp với build trên điện thoại người dùng |
| **expo-file-system** | Dùng `expo-file-system/legacy` cho classic API; main entry là File/Directory API mới |

---

## 📦 Cách thêm package an toàn

```bash
# Luôn dùng npx expo install — KHÔNG dùng npm install thẳng
npx expo install <package-name>

# Kiểm tra xem package có tương thích SDK 54 không trước
# https://docs.expo.dev/versions/v54.0.0/
```

**Các package đã có trong dự án (KHÔNG cài lại):**
- `expo-sqlite` — database
- `expo-file-system` — file system (dùng `/legacy`)
- `expo-sharing` — share file
- `expo-notifications` — push notification
- `expo-crypto` — mã hoá diary
- `react-native-svg` — vẽ biểu đồ (dùng thay cho victory-native)
- `xlsx` — xuất Excel

---

## 🚀 Lệnh chạy chuẩn

```bash
# Chạy dev server (tunnel khi wifi có client isolation)
npx expo start
npx expo start --tunnel   # khi wifi trường/công ty chặn

# Build kiểm tra (không cần EAS)
npx expo export           # build static, kiểm tra 1403+ module load OK

# Kiểm tra dependencies
npx expo-doctor           # báo lỗi version mismatch
```

---

## ⚠️ Gotchas đã gặp trong dự án

### 1. Watchman bỏ qua node_modules
**Vấn đề:** `.watchmanconfig` cấu hình sai → bundle hỏng  
**Fix:** Kiểm tra `.watchmanconfig` — không được ignore `node_modules`

### 2. expo-file-system API mới vs legacy
```typescript
// ❌ Sai — dùng main entry (API mới) khi cần classic
import * as FileSystem from 'expo-file-system';

// ✅ Đúng — dùng legacy cho classic API
import * as FileSystem from 'expo-file-system/legacy';
```

### 3. SQLite WAL mode
```typescript
// Phải bật WAL ngay khi mở DB
db.execSync('PRAGMA journal_mode = WAL;');
```

### 4. Notification trên iOS simulator
- iOS Simulator KHÔNG nhận push notification thật
- Phải test trên thiết bị thật qua Expo Go

---

## 📁 Cấu trúc src/ chuẩn của dự án

```
src/
├── components/     ← UI thuần (BatteryCell, MasterBattery, TrendChart...)
├── screens/        ← Màn hình app (HomeScreen, DiaryScreen, SettingsScreen...)
├── data/
│   ├── db/         ← SQLite schema, init, queries
│   └── models/     ← TypeScript types
├── domain/
│   ├── modes/      ← Training/Maintain/Rest definitions
│   └── batteries/  ← Battery logic
├── hooks/          ← Custom hooks (useDrainTick, useLiveEnergyReading...)
├── services/       ← Business logic (notificationService, excelExportService...)
├── store/          ← State management (energyStore, settingsStore...)
├── lib/            ← Utilities (encryption, helpers...)
├── navigation/     ← React Navigation config
└── types/          ← Global TypeScript types
```

---

## 🔗 Tài liệu tham khảo

- Docs Expo SDK 54: https://docs.expo.dev/versions/v54.0.0/
- expo-sqlite SDK 54: https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/
- expo-file-system SDK 54: https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/
- expo-notifications SDK 54: https://docs.expo.dev/versions/v54.0.0/sdk/notifications/

# 📋 Nhật ký tiến trình theo Session

> AI đọc file này để biết ngay chúng ta đã làm gì, lỗi gì đã xảy ra, và session tiếp theo cần bắt đầu từ đâu.
> Mỗi session kết thúc → AI thêm 1 mục vào đây.

---

## Session 1 — 2026-06-16

**Làm gì:** Viết toàn bộ source code app (Phase 0–3) không cần mạng.

**Kết quả:** 38 files TypeScript mới trong `src/` + config files.

**Files tạo ra:**
```
App.tsx, package.json, tsconfig.json, babel.config.js, app.json
src/types/battery.ts, modes.ts
src/lib/constants.ts, dateUtils.ts, encryption.ts
src/domain/battery/batteryEngine.ts
src/domain/modes/modeDefinitions.ts
src/domain/rules/lowBatteryRules.ts
src/data/db/schema.ts, database.ts
src/data/repositories/batteryRepository.ts, intakeRepository.ts, dailyLogRepository.ts
src/store/energyStore.ts, settingsStore.ts
src/services/notifications/notificationService.ts
src/services/export/excelExportService.ts
src/services/cleanup/cleanupService.ts
src/components/BatteryCell.tsx, MasterBattery.tsx, BatteryStack.tsx, ModeSelector.tsx, IntakeModal.tsx
src/screens/HomeScreen.tsx, HistoryScreen.tsx, DiaryScreen.tsx, SettingsScreen.tsx
src/navigation/AppNavigator.tsx
```

**Vấn đề gặp phải:** Node.js chưa cài → không thể chạy app thật.

**Lý do bỏ qua:** Tránh cài đặt qua mạng trong session không ổn định.

**Session tiếp theo phải làm:**
1. Cài Node.js LTS (nodejs.org) — cần wifi tốt ~5 phút
2. Mở terminal VS Code trong thư mục `my-body-batteries-app/`
3. Chạy: `npm install` (cần wifi ~3–5 phút lần đầu)
4. Chạy: `npx expo start`
5. Mở app Expo Go trên điện thoại → quét QR code
6. Kiểm tra màn hình Home có hiện viên pin không
7. Báo lỗi nếu có (thường gặp: thiếu thư viện, lỗi import)

---

## Session 2 — 2026-06-17

**Làm gì:** Cài môi trường thật (Node.js, Homebrew, Watchman) và sửa lỗi để chạy được `npx expo start` trên máy người dùng; nâng cấp Expo SDK 51 → 54 để khớp với Expo Go đã cài trên iPhone.

**Kết quả:**
- Node.js, Git đã cài xong (người dùng tự cài). Xác nhận v24.16.0 / npm 11.13.0.
- Sửa lỗi `EMFILE: too many open files, watch` (chặn mọi lần chạy `expo start` trước đó). Nguyên nhân gốc: giới hạn `launchd maxfiles` của macOS chỉ 256, và máy chưa có Watchman thật.
  - Nâng giới hạn: `sudo launchctl limit maxfiles 65536 524288` (người dùng tự chạy)
  - Cài Homebrew, rồi cài Watchman thật qua `brew install watchman` → hết lỗi EMFILE hoàn toàn.
- Phát hiện app Expo Go trên iPhone đã tự cập nhật lên SDK 54, không tương thích với project (SDK 51) → nâng cấp project:
  - `npm install expo@^54.0.0` rồi `npx expo install --fix`
  - Cập nhật thủ công `react` → 19.1.0, `react-native` → 0.81.5, `@types/react` → ~19.1.0, và toàn bộ các gói `expo-*` sang bản khớp SDK 54
  - `expo-sqlite` giờ là `~16.0.10` (bản thật, không còn cần stub) — `src/data/db/database.ts` vẫn dùng đúng API thật, không bị mất code.
- Xác nhận **toàn bộ 38 file kiến trúc gốc (`src/`) còn nguyên vẹn**, không bị mất trong quá trình troubleshooting (kiểm tra qua `git status`/`git diff` — chỉ có `app.json` và `package.json` thay đổi).
- Expo Go đã **kết nối thành công** vào app (đúng tên "Body Batteries", SDK 54.0.0 khớp) — xác nhận qua ảnh chụp màn hình điện thoại.

**Vấn đề gặp phải:**
1. Mạng Wi-Fi "eduroam" của trường (TU Darmstadt) bật "client isolation" → điện thoại và Mac không thấy nhau qua IP nội bộ. Phải dùng `npx expo start --tunnel` (qua ngrok) hoặc Personal Hotspot của iPhone để vượt qua.
2. Sau khi nâng cấp gói, Metro/Watchman bị lỗi cache cũ (`Unable to resolve module ./node_modules/expo/AppEntry`) — đã chạy `watchman watch-del` + `watchman watch-project` + `expo start --clear` để sửa, nhưng **chưa kiểm tra lại xem màn hình Home đã hiện ra chưa** vì bước tiếp đó tunnel bị lỗi.
3. Tunnel qua ngrok miễn phí bị lỗi liên tục (`CommandError: failed to start tunnel` / `TypeError: Cannot read properties of undefined (reading 'body')`) — có vẻ là lỗi từ dịch vụ ngrok lúc đó, không phải lỗi code của mình. Đã chuyển hướng sang Personal Hotspot nhưng người dùng phải tạm dừng (đi có việc) trước khi xác nhận Mac đã nối vào hotspot.

**Session tiếp theo phải làm:**
1. Hỏi người dùng đã bật Personal Hotspot trên iPhone và nối Mac vào Wi-Fi đó chưa — nếu chưa, hướng dẫn lại (Settings → Personal Hotspot trên iPhone; chọn đúng Wi-Fi đó trên Mac).
2. Lấy IP mới của Mac trên mạng hotspot: `ipconfig getifaddr en0` (thử cả `en1` nếu rỗng).
3. Chạy `npx expo start --clear` (KHÔNG cần `--tunnel` vì hotspot là mạng riêng, không bị cách ly) — nhớ thêm `export PATH="/opt/homebrew/bin:$PATH"` trước khi chạy để Watchman được nhận diện.
4. Gửi người dùng link `exp://<IP-mới>:8081` để mở qua Safari (vào address bar, gõ, bấm Go, chọn "Open in Expo Go").
5. Xác nhận màn hình Home (có viên pin) hiện ra đúng — nếu vẫn lỗi `Unable to resolve module .../AppEntry`, thử xoá cache triệt để hơn: `rm -rf .expo node_modules/.cache` rồi chạy lại.
6. Nếu xong và chạy được thật trên điện thoại → đánh dấu Phase 0 hoàn thành trong `docs/04-roadmap.md`, rồi bắt đầu test Phase 1 (nạp Protein, đóng/mở lại app, kiểm tra dữ liệu còn không).
7. (Việc nhỏ, không gấp) `app.json` đang thiếu 2 plugin `expo-sqlite` và `expo-secure-store` trong mảng `plugins` (bị xoá lúc debug SDK 51 cũ) — không ảnh hưởng khi test qua Expo Go, nhưng cần thêm lại trước khi build bản thật (EAS build) ở Phase sau.

---

---

## Session 3 — 2026-06-17

**Làm gì:** Rà soát toàn bộ code (28 files kiến trúc) để tìm rủi ro & debug; kiểm chứng lỗi bằng cách đọc trực tiếp `node_modules` (không phải đoán); vá 3 lỗi chắc chắn gây crash khi dùng thật trên SDK 54.

**Kết quả:**
1. ✅ Xác nhận code bám sát yêu cầu ban đầu — đủ Phase 0–3, chỉ thiếu biểu đồ xu hướng (đúng kế hoạch).
2. ✅ Tìm & vá **3 lỗi crash** (không thêm thư viện):
   - **excelExportService.ts**: Expo SDK 54 dời `expo-file-system` → đổi import sang `expo-file-system/legacy` (gọi hàm cũ ở chính xác đúng tên module).
   - **encryption.ts**: React Native không có `crypto.getRandomValues` → thay bằng key `Math.random` (obfuscation, key vẫn cất SecureStore an toàn); thêm mã hoá UTF-8 để chữ tiếng Việt có dấu không làm `btoa` crash.
   - **AGENTS.md**: Ghi sai "SDK 56" → sửa về **54** (tránh nâng cấp nhầm làm hỏng môi trường đang chạy được).
3. ✅ Tăng cảnh báo nút "Xoá dữ liệu cũ" (SettingsScreen.tsx): ghi rõ "xoá VĨNH VIỄN", nhắc xuất Excel trước.

**2 lỗi nhỏ còn tồn (không crash, để đúng lúc test Phase 2–3):**
- `energyStore.tickDrain` hard-code mode `'maintain'` → Mode chưa ảnh hưởng tốc độ xả thật (nhưng hàm chưa gọi ở đâu).
- `HomeScreen.handleIntakeConfirm` tính cảnh báo bằng `readings` cũ (stale) → cảnh báo trễ 1 nhịp.

**Files thay đổi:**
- `src/services/export/excelExportService.ts` — đổi import
- `src/lib/encryption.ts` — sửa crypto + UTF-8
- `AGENTS.md` — sửa version & hướng dẫn
- `src/screens/SettingsScreen.tsx` — tăng cảnh báo xoá

**Session tiếp theo phải làm:**
1. Xác nhận Mac đã nối Personal Hotspot của iPhone (chưa rõ ở Session 2).
2. Chạy `npx expo start --clear` trong `my-body-batteries-app/` (với PATH Watchman).
3. Mở Safari trên iPhone → `exp://<IP>:8081` → chọn "Open in Expo Go".
4. Xác nhận màn hình Home (viên pin) hiện ra **đúng lần này** (không còn lỗi cache).
5. Test: nạp Protein → đóng app → mở lại → xác nhận dữ liệu còn nguyên ✅ = Phase 0 done.
6. Bắt đầu test Phase 1 nếu thành công.

---

## Session 4 — 2026-06-18

**Làm gì:** Rà soát toàn bộ dự án, tìm ra **nguyên nhân gốc khiến app chưa bao giờ chạy được**, vá nó cùng 5 lỗi logic khác, và xác nhận app build thành công lần đầu tiên (cả iOS lẫn web) bằng `expo export`.

**🎯 Phát hiện lớn nhất — nguyên nhân gốc của mọi lỗi "Unable to resolve module":**
- File `.watchmanconfig` ghi `"ignore_dirs": ["node_modules", ".git", ".expo"]`. Watchman là bộ "quét file" mà Metro dựa vào để dựng bản đồ module. Khi bảo Watchman **bỏ qua `node_modules`**, Metro không thấy bất kỳ thư viện nào → fail ngay ở dòng import đầu tiên (`expo`, `react-native`, …), bundle hỏng sau ~240ms.
- Đây chính là lý do mọi lần `expo start` ở Session 2–3 đều báo "Unable to resolve module .../AppEntry" / "Unable to resolve expo" — **không phải lỗi cache, không phải ngrok, mà là cấu hình watchman**. App chưa bao giờ bundle xong → màn hình điện thoại trống.
- **Vá:** đổi `.watchmanconfig` về `{}` (mặc định của Expo). Sau đó `expo export --platform ios` chạy xong: **Bundled 1403 modules (5.14 MB)**; web: 852 modules. ✅

**Các lỗi khác đã vá (kèm kiểm chứng `tsc` sạch + bundle thành công):**
1. **Đổi Mode không cập nhật sức chứa pin** (`energyStore.loadToday`): trước đây nếu ngày đã có dữ liệu, đổi Mode không đổi mục tiêu pin → **vỡ tiêu chí hoàn thành Phase 2**. Giờ mỗi lần load sẽ tính lại `capacity` theo Mode hiện tại (giữ `level`, clamp lại) và lưu `daily_log`.
2. **Cảnh báo pin thấp dùng dữ liệu cũ** (`HomeScreen` + `energyStore.addIntake`): `addIntake` giờ trả về `BatteryAlert[]` (đúng kiểu), cập nhật UI lạc quan trước rồi mới lưu; Home dùng đúng kết quả mới + tôn trọng nút bật/tắt thông báo.
3. **Sai ngày do múi giờ** (`dateUtils`): `todayString` dùng `toISOString()` (giờ UTC) → ở Đức (UTC+1/+2) buổi tối có thể nhảy sang "ngày mai". Đổi sang lấy ngày theo giờ **địa phương**; `formatDisplayDate` parse local.
4. **Chống màn hình trống:** mọi truy cập DB trong store bọc `try/catch`, fallback pin mặc định trong RAM → UI không bao giờ trắng kể cả khi DB lỗi/web.
5. **Lịch sử tự refresh** (`HistoryScreen`): dùng `useFocusEffect` để mỗi lần mở tab Lịch sử là nạp lại (tab cũ giữ mount nên `useEffect` 1 lần là chưa đủ).
6. **`index.js`** đưa về chuẩn Expo (`registerRootComponent`) — đã resolve được sau khi vá watchman.
7. **`app.json`** thêm lại 2 plugin `expo-sqlite`, `expo-secure-store` (Session 2 ghi thiếu, cần cho EAS build).
8. **`tickDrain`** nhận `modeId` thay vì hard-code `'maintain'`.

**⚠️ Vấn đề cấu trúc cần xử lý:** Có **2 bản sao y hệt** của dự án:
- `/Users/minh/VSCode_Repo/BodyBatteries` (bản chính, đã vá & verify)
- `/Users/minh/VSCode_Repo/Body Batteries/my-body-batteries-app` (symlink `BodyBatteriesApp` trỏ vào đây; Session 2–3 chạy từ đây)
Mỗi bản có `node_modules` riêng. Đã **đồng bộ 7 file đã sửa sang cả 2 bản** (gồm `.watchmanconfig`) nên chạy ở đâu cũng được. **Nên gộp về 1 bản** (đề xuất: bản `BodyBatteries` không dấu cách) để tránh sửa nhầm chỗ.

**Vấn đề chưa làm (không chặn demo):** tickDrain/daily-reset chưa được gọi định kỳ (pin chưa tự xả theo thời gian — Phase 2/4); biểu đồ xu hướng (Phase 3); tích hợp Health (Phase 4).

**Cập nhật (cuối Session 4):** Đã **gộp 2 thư mục về 1** — chỉ còn `/Users/minh/VSCode_Repo/BodyBatteries`
(giữ nguyên git history 3 commit cũ + commit "Consolidate..." mới, **chưa push**). Bản trùng
`Body Batteries/` và symlink `BodyBatteriesApp` đã xoá; ghi chú/ảnh cũ giữ ở `docs/_reference/`.

**Session tiếp theo phải làm:** Xem **`.ai/NEXT_SESSIONS.md`** — đã chia việc còn lại thành các
gói độc lập (S-A test thật, S-B biểu đồ, S-C nhắc nhở, S-D tự xả pin, S-E unit test) để chạy
**nhiều phiên Sonnet 4.6 song song** mà không đụng file của nhau. Mỗi gói có sẵn prompt copy-paste
và danh sách "file được sửa / không đụng". Việc cấp bách nhất: **S-A — quét QR test thật trên iPhone**
(bundle đã verify build OK nên Home phải hiện ra).

---

## 📌 Hướng dẫn viết session log

Khi kết thúc một session, AI tự điền vào đây:
- **Làm gì:** mô tả 1–2 câu
- **Kết quả:** đạt được gì (files tạo, tính năng test thành công…)
- **Vấn đề gặp phải:** lỗi, cản trở, việc phải bỏ lại
- **Session tiếp theo phải làm:** danh sách cụ thể, theo thứ tự ưu tiên

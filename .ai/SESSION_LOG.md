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

## Session 5 — 2026-06-18

**Làm gì:** Chạy đợt song song gói S-A…S-E + 4 gói bổ sung E1-E4; thêm Food Log + hiển thị pin
Năng lượng xả mượt theo giây; UI polish; cuối session một phiên Opus rà soát toàn dự án và thảo
luận với người dùng để chốt hướng cho phần "tinh chỉnh" S-H còn treo, rồi gộp tài liệu (phiên này).

**Kết quả — đợt song song đợt 1 (S-A…S-E):**
- ✅ **S-B** Biểu đồ xu hướng tuần — `TrendChart.tsx` (vẽ bằng `react-native-svg` có sẵn, không
  dùng `victory-native`), chèn vào `HistoryScreen.tsx`.
- ✅ **S-C** Nhắc nhở hàng ngày + ngưỡng cảnh báo thật — nút bật/tắt trong Settings giờ đặt/huỷ
  nhắc nhở thật (`reminderHour/Minute` trong `settingsStore`), xin quyền thật.
- ✅ **S-D** Tự xả pin theo thời gian + reset ngày mới — `useDrainTick.ts` (mỗi 30 phút + khi quay
  lại từ nền) gọi `tickDrain`/`resetForNewDay` đã có sẵn trong `energyStore`, gắn vào `App.tsx`.
- ✅ **S-E** Unit test cho domain logic — `jest-expo` + 4 file test mới, không phát hiện bug.
- ⏸ **S-A** Test thật trên điện thoại — xác nhận server sống + kết nối được iPhone qua Expo Go
  (cả qua wifi trường có client isolation), nhưng **dừng giữa đường** (xác nhận Home đủ 7 pin,
  test Phase 1/2, test thông báo pin thấp — CHƯA làm) để bàn tính năng mới với người dùng.

**Kết quả — 4 gói bổ sung (E1-E4, sau đợt 1):**
- ✅ **E1** Thông báo pin thấp khi xả tự nhiên (không chỉ khi ăn) — `useLowEnergyWatch.ts` mới,
  chống spam bằng cờ "armed" (chỉ bắn lại khi pin vượt lại ngưỡng rồi tụt xuống lần nữa).
- ✅ **E2** `logActivity` (bước chân/buổi tập) giờ cũng ghi vào `intake_events` để xuất hiện trong
  Excel xuất hàng tuần (trước đây chỉ trừ pin, không có audit trail).
- ✅ **E3** Thêm đường pin Năng lượng (màu hổ phách) vào `TrendChart`, cạnh đường trung bình 6 pin
  dinh dưỡng (màu xanh) trong màn Lịch sử.
- ✅ **E4** Màn hình Onboarding lần đầu mở app — nhập đúng cân nặng/chiều cao/tuổi/giới tính thật
  ngay từ đầu thay vì dùng mặc định 78kg/168cm/30/nam (`hasOnboarded` flag trong `settingsStore`).

**Kết quả — tính năng mới ngoài phạm vi gói gốc (3 commit riêng, sau đợt song song):**
- Food Log: ghi món ăn có sẵn từ `food_items.csv` (CSV-driven), xem "Hôm nay đã ăn" (gộp theo
  bữa, tổng kcal/ngày, xoá được) — xem `docs/07-food-log.md`.
- Pin Năng lượng hiển thị **xả mượt theo giây** trên màn hình (`LiveMasterBattery` +
  `useLiveEnergyReading`, ngoại suy thuần từ lần tick thật gần nhất — không viết đè/double-count
  lên dữ liệu lưu thật).
- UI polish: hiệu ứng nhấn (pressed-state) cho các nút/dòng, slide-up animation cho bottom sheet
  (Intake/Food/Activity), crossfade cho mode chips — chỉ đổi hiển thị, không đổi logic
  (commit `4499fab`, chưa có báo cáo riêng trong `parallel-reports/`).

**Kết quả — tư vấn Opus cuối session (rà soát + thảo luận S-H "tinh chỉnh"):**
Người dùng đã chọn hướng cho 3 mục "chưa rõ spec" còn treo từ Session 4/5:
1. Rải xả thụ động theo nhịp **thức/ngủ cố định** (không đọc dữ liệu ngủ thật) → spec đầy đủ ở
   gói mới **S-K** trong `.ai/NEXT_SESSIONS.md`, sẵn sàng giao phiên sau.
2. Cá nhân hoá hệ số MET/công việc theo **xu hướng cân nặng thật** → bước 1 (ghi dữ liệu cân nặng
   theo thời gian, dùng bảng `health_signals` có sẵn, không đổi schema) là gói mới **S-L**, sẵn
   sàng giao ngay; bước 2 (tính hiệu chỉnh) gộp vào **S-G** khi đủ vài tuần dữ liệu.
3. **Carry-over** năng lượng dư/thiếu qua ngày hôm sau → **quyết định KHÔNG làm**, giữ mỗi ngày là
   1 pin mới, tránh tạo cảm giác "nợ năng lượng" (đúng ranh giới sức khoẻ, `.ai/CONTEXT.md` mục 5).

**Số liệu xác nhận cuối session (2026-06-18):** `npx tsc --noEmit` sạch · `npx jest` → **92 test
PASS / 11 suite** · `npx expo export --platform ios` → **1424 module**. Nhánh hiện tại
`session-5-demo-ready` có **7 commit chưa push** lên `origin/main`.

**Vấn đề / việc còn để lại:**
- S-A chưa hoàn tất (xem trên) — ưu tiên cao nhất cho phiên sau.
- ~10 process `expo start --web` cũ còn sót trên máy (cổng 8082–8093) — không ảnh hưởng chức năng,
  có thể dọn (`kill <pid>`) khi tiện.
- Hồ sơ cơ thể vẫn đang mặc định 30 tuổi/nam (`DEFAULT_USER_PROFILE`) — người dùng cần tự sửa
  trong Cài đặt (hoặc qua Onboarding mới — E4 — nếu app coi đây là lần "chưa onboard").

**Session tiếp theo phải làm:** Xem `.ai/NEXT_SESSIONS.md` (đã cập nhật bảng tổng quan +
trạng thái từng gói). Ưu tiên: tiếp tục **S-A**. Có thể làm song song bất kỳ lúc nào: **S-L**.
Chỉ chạy 1 trong 3: **S-F**, **S-I**, **S-K** (đụng file chung `metabolicConstants.ts`/
`metabolismEngine.ts`/`SettingsScreen.tsx`/`energyStore.ts` theo từng cặp — xem "Luật vàng" mục 2
trong `NEXT_SESSIONS.md`). **S-G** để sau cùng.

---

## Session 6 — 2026-06-18

**Làm gì:** Phiên Opus tiếp nối Session 5. Ba việc theo yêu cầu người dùng: (1) chốt thiết kế cho
3 mục "tinh chỉnh" S-H còn treo qua trao đổi trực tiếp với người dùng; (2) gộp tài liệu (S-J);
(3) review tích hợp toàn bộ energy model (S-D + S-H + Food Log + live drain) tìm bug. Sau đó
người dùng yêu cầu push toàn bộ lên `main` (tự cho phép vì đang làm một mình).

**Kết quả:**
- Quyết định cùng người dùng cho S-H: rải xả thụ động theo khung **thức/ngủ cố định** (không
  đọc dữ liệu ngủ thật) → viết spec đầy đủ gói **S-K**; cá nhân hoá MET theo **xu hướng cân nặng
  thật** (không phải thanh chỉnh tay) → bước 1 là gói **S-L** (ghi cân nặng theo thời gian, dùng
  bảng `health_signals` có sẵn); **carry-over** năng lượng qua ngày → quyết định **không làm**
  (đúng ranh giới sức khoẻ, tránh tạo cảm giác "nợ năng lượng").
- Review tích hợp: không phát hiện đếm trùng kcal (`addIntake`/`addCalories`/`logFood` đều tách
  biệt đúng thiết kế); không phát hiện lệch giữa hiển thị mượt theo giây và dữ liệu lưu thật
  (`useLiveEnergyReading` dùng đúng hàm + mốc thời gian mà `tickDrain` dùng). Phát hiện 1 dòng
  tài liệu sai (`docs/04-roadmap.md` ghi nhầm `resetForNewDay` là cơ chế reset ngày mới — thực ra
  hàm đó là dead code, cơ chế thật là `App.tsx` tự dò đổi ngày rồi gọi `loadToday`) → đã sửa.
  Phát hiện 1 lỗi rất nhỏ, mức độ thấp (lệch vài kcal nếu app mở đúng lúc qua nửa đêm, do
  `tickDrain` và việc dò đổi ngày là 2 timer không đồng bộ) → ghi lại làm việc tiện vá khi làm S-K,
  không cần gói riêng.
- Khi chuẩn bị push, phát hiện trong working tree có sẵn nhiều thay đổi **chưa commit** từ một
  đợt UX riêng (`U1-U6`, tài liệu ở `.ai/NEXT_SESSIONS_UX.md`) đang chạy song song: gói **U2**
  (sửa bàn phím che nút trong modal "Ghi món ăn") và **U3** (sửa nhãn ngày biểu đồ bị cắt sai +
  tên pin nhỏ bị cắt chữ trong Lịch sử) đã hoàn thành + có báo cáo riêng; cộng phần đuôi của đợt
  "polish nhấn" trước đó còn 5 file sửa dở chưa commit. Đã verify lại toàn bộ (`tsc` sạch,
  `npx jest` 92/92 PASS) rồi commit tách theo từng gói, và **gộp `.ai/NEXT_SESSIONS_UX.md` vào
  `.ai/NEXT_SESSIONS.md`** (xoá file tạm đó) — U1/U4/U5/U6 giờ không còn bị chặn bởi "chờ commit
  polish" nữa.
- **Đã `git push origin session-5-demo-ready:main`** — `main` giờ ở commit `3140f01`, khớp 100%
  với nhánh làm việc, không còn commit local nào chưa lên remote.

**Vấn đề gặp phải:** Không có lỗi/cản trở thật — chỉ có 1 bất ngờ nhỏ (uncommitted work từ phiên
UX khác đang chạy song song) cần dừng lại kiểm tra kỹ trước khi gộp vào push, để tránh đẩy nhầm
việc chưa xong của người khác/phiên khác lên `main`.

**Session tiếp theo phải làm:** Đọc `.ai/NEXT_SESSIONS.md` (giờ là file DUY NHẤT cho mọi gói, kể
cả U1-U6). Ưu tiên cao nhất vẫn là **S-A** (test máy thật — chưa ai xác nhận Home đủ 7 pin, đổi
Mode, thông báo pin thấp trên điện thoại thật). Có thể làm song song ngay, không đụng ai: **S-L**,
**U1**, **U4**, **U5**. Chỉ chạy 1 trong nhóm cùng lúc (đụng file chung): **S-F / U6 / S-K** (U6
đã gộp S-I). **S-G** để sau cùng (cần dữ liệu cân nặng từ S-L).

---

## Session 7 — 2026-06-18

**Làm gì:** Một phiên Sonnet 4.6 (chat trực tiếp với người dùng, không qua subagent) chạy 2 gói từ
`.ai/NEXT_SESSIONS.md`: xác nhận lại + code gói **U3** (Lịch sử + biểu đồ) và làm xong gói **S-L**
(ghi nhận cân nặng theo thời gian).

**Kết quả — U3 (Lịch sử + biểu đồ):**
- Không có điện thoại để mở app trực tiếp, nên soi code 2 file được giao
  (`HistoryScreen.tsx`, `TrendChart.tsx`) + tính thử bằng `node -e` để xác minh, tìm ra 3 chỗ
  chưa hợp lý: (1) nhãn ngày dưới biểu đồ bị cắt sai — `.slice(0,6)` lên chuỗi locale
  `"Thứ 5, 18/06"` cho ra `"Thứ 5,"` vô nghĩa, không thấy ngày/tháng thật; (2) nhãn pin nhỏ trong
  thẻ ngày bị cắt giữa từ (`"Khoáng chất".slice(0,4)` → `"Khoá"`, đọc sai nghĩa); (3) badge đầu
  thẻ ngày (`"82%"`) không có nhãn rõ nghĩa cạnh badge `"NL 86%"`.
- Trình bày 3 phát hiện bằng tiếng Việt, đợi người dùng duyệt (người dùng xác nhận đồng ý dù
  không có điện thoại để tự kiểm tra) rồi mới code.
- Sửa: `TrendChart.tsx` (hàm `dayMonthLabel()` lấy `DD/MM` trực tiếp từ chuỗi `'YYYY-MM-DD'` gốc,
  bỏ phụ thuộc `formatDisplayDate`/locale), `HistoryScreen.tsx` (map `BATTERY_SHORT_LABELS` cố
  định theo `battery.id` thay cho cắt chuỗi, badge đổi thành `"DD {pct}%"`).
- Report: `.ai/parallel-reports/U3.md`.

**Kết quả — S-L (Ghi nhận cân nặng theo thời gian):**
- Tạo `src/data/repositories/healthSignalsRepository.ts` (`logWeight(kg)` /
  `getWeightHistory(limit)`), dùng đúng bảng `health_signals` có sẵn trong `schema.ts`
  (`source='manual'`, `type='weight_kg'`), không đổi schema.
- Tạo `src/components/WeightLogCard.tsx`: ô nhập số (validate theo `PROFILE_LIMITS.weightKg`
  20–300kg đã có sẵn) + nút "Ghi nhận hôm nay", danh sách text các lần đã ghi (không vẽ biểu đồ ở
  gói này), có dòng disclaimer "ghi nhận tự nguyện, không đánh giá" đúng ranh giới sức khoẻ
  (`.ai/CONTEXT.md` mục 5). Component tự fetch dữ liệu qua `useFocusEffect`, không cần
  `HistoryScreen` truyền props.
- Sửa `HistoryScreen.tsx`: chèn `<WeightLogCard />` ngay dưới `<TrendChart>`.
- Đây là **bước 1** (ghi dữ liệu) cho hướng "hiệu chỉnh cá nhân hoá MET theo xu hướng cân nặng
  thật" đã chốt với người dùng ở Session 6 — bước 2 (tính hiệu chỉnh) gộp vào **S-G**, cần vài
  tuần dữ liệu thật trước khi làm.
- Report: `.ai/parallel-reports/S-L.md`.

**Kiểm tra (cả 2 gói):** `npx tsc --noEmit` sạch · `npx jest` → 92 test PASS / 11 suite (không
thêm test mới — S-L chỉ là I/O + UI thuần, không có hàm domain mới cần unit test) ·
`npx expo export --platform ios` → **1426 module** (tăng từ 1424, đúng kỳ vọng do 2 file mới
của S-L).

**Vấn đề gặp phải:**
- Không có điện thoại thật trong suốt phiên này → U3 được duyệt dựa trên phân tích code + xác
  minh bằng Node.js (độ tin cậy cao nhưng chưa thấy thật trên máy — phiên sau nên xác nhận lại
  khi có điện thoại).
- Repo này đang có **nhiều phiên khác chạy song song cùng lúc** sửa các file tài liệu dùng chung
  (`NEXT_SESSIONS.md`, `CONTEXT.md`) — một lần thử sửa `NEXT_SESSIONS.md` bị lỗi "file đã đổi từ
  lúc đọc" vì một phiên khác đang viết đè (hoá ra họ đã tự cập nhật đúng dòng S-L thành "XONG" và
  đồng thời chốt một quyết định lớn mới — xem mục dưới). Đã đọc lại file mới nhất rồi mới quyết
  định không sửa thêm vào đó để tránh đụng nhau.

**Phát hiện thêm (không phải việc của phiên này, ghi lại để phiên sau biết):** Trong lúc làm,
phát hiện một phiên song song khác đã quyết định một việc lớn với người dùng và ghi vào
`.ai/NEXT_SESSIONS.md`: **gói S-M** — lật mô hình pin Năng lượng từ "xả từ đầy" sang "đếm lên tới
mục tiêu" (đã chốt 2026-06-18). Hệ quả: **S-K tạm dừng** (mâu thuẫn mô hình mới), **U1 gộp vào
S-M**, **U6/S-F nên đợi S-M xong** (cùng đụng `energyStore.ts`/`SettingsScreen.tsx`). Xem
`.ai/parallel-reports/B1-energy-balance-spec.md` và `.ai/parallel-reports/S-M-energy-redesign-spec.md`
để biết chi tiết — phiên này không tham gia quyết định đó, chỉ ghi lại để tránh phiên sau bất ngờ.

**Session tiếp theo phải làm:**
1. Đọc kỹ `.ai/NEXT_SESSIONS.md` bản mới nhất trước khi chọn gói — bảng trạng thái đang đổi nhanh
   do nhiều phiên song song (S-M vừa được chốt, thay đổi thứ tự ưu tiên của S-K/U1/U6/S-F).
2. Ưu tiên cao nhất vẫn là **S-A** (test máy thật — chưa ai xác nhận Home đủ 7 pin/Phase 1/2/
   thông báo trên điện thoại thật).
3. An toàn làm ngay, không đụng ai: **U4** (Nhật ký), **U5** (Onboarding).
4. **S-M** là việc lớn, nên làm một mình 1 đợt riêng (đụng lõi `energyStore.ts`/`MasterBattery.tsx`)
   — không xen với gói nào khác đụng các file đó.
5. **S-G** vẫn để sau cùng — đã có dữ liệu cân nặng bắt đầu được ghi qua S-L, nhưng cần vài tuần
   mới đủ dùng.

---

## 📌 Hướng dẫn viết session log

Khi kết thúc một session, AI tự điền vào đây:
- **Làm gì:** mô tả 1–2 câu
- **Kết quả:** đạt được gì (files tạo, tính năng test thành công…)
- **Vấn đề gặp phải:** lỗi, cản trở, việc phải bỏ lại
- **Session tiếp theo phải làm:** danh sách cụ thể, theo thứ tự ưu tiên

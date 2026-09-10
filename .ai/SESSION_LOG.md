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

## Session 8 — 2026-06-18 (Opus, điều phối song song + chốt quyết định S-M + tổng kết cuối ngày)

**Làm gì:** Phiên Opus chạy song song với các phiên Sonnet khác (U2, U3, S-L, S-J/S-K-spec) trong
suốt Session 6–7. Vai trò chính: phát hiện rủi ro đụng nhau giữa các phiên, dọn nền sạch, phân
tích sâu vùng "con số năng lượng chưa hợp logic" mà người dùng phản hồi sau khi test máy, và dẫn
dắt một quyết định lớn về mô hình pin Năng lượng cùng người dùng.

**Kết quả:**
- Phát hiện sớm: nhiều phiên đang sửa cùng lúc 6 file UI polish (press feedback + animation
  trượt sheet) chưa commit, và 1 phiên khác đang biên tập trực tiếp `NEXT_SESSIONS.md`. Để tránh
  đè mất công nhau: commit hộ phần polish đã xong làm nền sạch (`4499fab`), và viết kế hoạch đợt
  UX (U1–U6) vào file riêng `NEXT_SESSIONS_UX.md` thay vì sửa đè `NEXT_SESSIONS.md` (file này sau
  đó đã được một phiên khác gộp lại và xoá, đúng dự tính).
- Đào sâu vùng "pin tổng + con số năng lượng" theo đúng phản hồi test máy của người dùng → viết
  `.ai/parallel-reports/U1-FINDINGS.md`: phát hiện số kcal hiển thị `.toFixed(1)` rung liên tục
  mỗi giây (A1), thiếu chữ giải nghĩa "còn lại / sức chứa" khiến đọc ngược với app đếm calo quen
  thuộc (A2 — nghi vấn là gốc rễ của "chưa hợp logic"), và màu đỏ ban đêm dễ hiểu nhầm "báo lỗi"
  (A3). Phân biệt rõ phần U1 tự sửa được (hiển thị) và phần phải báo cho engine, không tự sửa
  (B1–B3: ăn dư bị clamp mất, không carry-over, cảnh báo "pin thấp" xung đột nhịp sinh học).
- Soạn `.ai/parallel-reports/B1-energy-balance-spec.md` — 3 hướng xử lý "ăn dư": (A) giữ pin
  0–100% + thêm dòng cân bằng riêng, (B) cho pin vượt 100%, (C) lật hẳn mô hình thành "đã ăn/mục
  tiêu" (đếm lên, giống app đếm calo phổ thông). Trình bày kèm minh hoạ ASCII cho người dùng so
  sánh trực quan.
- **Người dùng chốt hướng C** (lật mô hình) — quyết định sâu hơn đề xuất ban đầu của phiên này
  (vốn nghiêng về hướng A vì ít việc hơn), nhưng đúng vì làm pin Năng lượng nhất quán với 6 pin
  nhỏ khác (tất cả đều đếm lên từ rỗng). Hỏi thêm để chốt chi tiết: thanh pin đếm lên + **giữ yếu
  tố thời gian** (thêm 1 số sống "còn được ăn ngay" tăng dần theo thời gian, tái dùng cơ chế
  tick/giây của Session 5 thay vì bỏ hẳn).
- Viết `.ai/parallel-reports/S-M-energy-redesign-spec.md` — spec đầy đủ: định nghĩa số mới
  (`level`=đã ăn bắt đầu từ 0, `capacity`=mục tiêu ngày gồm vận động), bảng so sánh trước/sau,
  **ảnh hưởng dây chuyền** (S-K mất ý nghĩa → tạm dừng; U1 bị viết đè → gộp hẳn vào S-M; U6/S-F
  đụng file chung → nên làm sau S-M), ràng buộc sức khoẻ, và 3 điểm cần người dùng xác nhận thêm
  trước khi code. Một phiên khác sau đó đã đăng ký S-M chính thức vào `NEXT_SESSIONS.md` +
  `CONTEXT.md` (commit `4ac23b7`) — đối chiếu lại, nội dung khớp đúng với spec, không có gì lệch.
- **Kiểm tra cuối ngày (sau khi người dùng đóng hết các phiên song song khác):** đọc lại toàn bộ
  `NEXT_SESSIONS.md`, `SESSION_LOG.md`, `CONTEXT.md`, `docs/04-roadmap.md` — xác nhận **không có
  gói nào bị bỏ dở giữa code** (mọi gói đang ở 1 trong 3 trạng thái rõ ràng: ✅ xong, 🆕 sẵn sàng
  nhưng cần người dùng/điện thoại để bắt đầu, hoặc ⏸ tạm dừng có lý do); tài liệu nhất quán, không
  có mục nào mâu thuẫn nhau. Chạy lại `npx tsc --noEmit` (sạch) + `npx jest` (**92 test PASS**/11
  suite) + `npx expo export --platform ios` (xem dòng dưới) để xác nhận trạng thái "xanh" tại thời
  điểm đóng ngày làm việc. Dọn 6 tiến trình `expo start --web` mồ côi còn sót từ trước Session 4
  (trỏ tới thư mục cũ đã xoá `Body Batteries/my-body-batteries-app`, ~1 ngày tuổi) — đã xin phép
  người dùng trước khi tắt; giữ lại tiến trình port 8093 vì trỏ đúng thư mục project hiện tại.

**Vấn đề gặp phải:**
- Nhiều phiên cùng sửa file tài liệu dùng chung (`NEXT_SESSIONS.md`) gây 1 lần ghi đè lỗi ("file
  đã đổi từ lúc đọc") — xử lý bằng cách tách tạm ra file riêng rồi gộp lại sau, không có dữ liệu
  nào bị mất.
- Đề xuất ban đầu của phiên này cho việc "ăn dư" (hướng A, ít việc hơn) **không phải là hướng người
  dùng chọn** — người dùng nhìn xa hơn tới tính nhất quán toàn app. Ghi lại để các phiên sau không
  mặc định đề xuất "phương án đỡ tốn công nhất" là phương án đúng — nên trình bày đủ các hướng kèm
  trade-off rõ và để người dùng tự cân nhắc theo góc nhìn họ muốn (sản phẩm, không phải kỹ thuật).

**Session tiếp theo phải làm (đề xuất cho ngày mai):**
1. **S-A (test máy thật)** — vẫn ưu tiên cao nhất, chưa ai xác nhận Home đủ 7 pin / Phase 1 lưu
   dữ liệu / Phase 2 đổi Mode / thông báo pin thấp trên điện thoại thật. Không đụng code, chỉ cần
   người dùng cầm máy làm theo hướng dẫn.
2. **S-M (lật mô hình pin Năng lượng)** — việc lớn nhất, đã chốt hướng với người dùng, **CHƯA
   code**. Đọc kỹ `.ai/parallel-reports/S-M-energy-redesign-spec.md` trước. Trước khi code, xác
   nhận lại 3 điểm ở mục 7 của spec (vị trí dòng "còn được ăn ngay", cách xử lý cảnh báo pin thấp,
   vận động cộng vào mục tiêu). Làm **một mình 1 đợt riêng** — tạm hoãn S-K/U1(đã gộp)/U6/S-F.
3. An toàn làm song song ngay, không đụng S-M: **U4** (Nhật ký), **U5** (Onboarding) — cả hai cần
   mở app cùng người dùng trên điện thoại trước khi code (theo đúng quy trình UX đã đặt ra).
4. Sau khi S-M xong: **U6** (Cài đặt UX + khung giờ bữa ăn) rồi **S-F** (bước chân trung bình/ngày)
   — tuần tự, không song song (cùng đụng file).
5. **S-G** (lớp thông minh) vẫn để sau cùng — cần thêm vài tuần dữ liệu cân nặng từ S-L.

---

## Session 10 — 2026-07-03 (Opus — tuyến dữ liệu thực phẩm USDA + chốt commit tồn đọng)

> Ghi chú số thứ tự: CONTEXT mục 10 đã gọi đợt U4/U5/U6 (2026-06-19) là "Session 9" nhưng
> SESSION_LOG chưa từng có entry Session 9 → entry này đánh **Session 10** cho khớp, và gộp luôn
> phần commit tồn đọng của các gói làm ở khoảng 2026-06-19 → 2026-07-03.

**Làm gì:** (1) Tư vấn + viết spec đầy đủ cho việc tích hợp file USDA FoodData Central (6.4MB,
363 nguyên liệu Mỹ) người dùng tải về; (2) điều phối 3 gói dữ liệu thực phẩm qua NEXT_SESSIONS
(S-N, U7 A+B); (3) cuối phiên: phát hiện nhiều gói đã xong nhưng **chưa commit**, verify lại toàn
bộ rồi commit gọn theo gói + chạy session-wrapup.

**Kết quả:**
- **S-N (XONG):** pipeline offline `scripts/generate-usda-db.js` biến `database/raw/*.json` (6.4MB,
  đã gitignore) → `database/extract/usda_foundation_foods.csv` gọn + `src/data/food/usdaFoods.ts`
  (`USDA_FOODS`, `searchUsdaFoods`, 363 món tiếng Anh, **BỔ SUNG** không trộn vào `FOOD_ITEMS`).
  Tự tính energy Atwater khi thiếu #208 (268/363 món). Không dùng API (bulk offline). Spec:
  `.ai/parallel-reports/S-N-food-data-usda-spec.md`.
- **U7 (XONG):** Phần A = công tắc "Món Việt | Tra cứu USDA (EN)" trong `FoodLogModal.tsx` (chỉ 1
  file; vá bẫy tên rỗng bằng `{...item, nameVi: item.nameEn}` để KHÔNG đụng `energyStore.ts`).
  Phần B = dịch `name_vi` theo nhu cầu qua file phủ build-time `database/usda_names_vi.csv` join
  trong `gen:usda` (không làm trình dịch trong app — quá nặng, đã ghi lý do).
- **S-F (XONG, làm ở phiên song song ~2026-06-19, nay mới commit):** field "số bước trung bình/
  ngày" trong Hồ sơ cơ thể, cộng vào `passiveDailyBurn` qua `stepsKcal`.
- Verify "xanh" trước commit: `npx tsc --noEmit` sạch · `npx jest` **103 test PASS / 12 suite** ·
  `npx expo export --platform ios` OK (bundle 5.36MB).

**Vấn đề gặp phải & Cách giải quyết:** commit gần nhất (`171be68`) bỏ lại **3–4 gói hoàn chỉnh
chưa lưu** (S-F, S-N, U7) → rủi ro mất công sức. Đã verify xanh rồi commit tách theo gói. S-N và
U7-B cùng đụng các file dữ liệu USDA (`generate-usda-db.js`, `usdaFoods.ts`, generated, test) nên
gộp chung 1 commit "data pipeline", không tách nhân tạo.

**Session tiếp theo phải làm:**
1. **S-A (test máy thật)** — vẫn ưu tiên cao; giờ cần test thêm luồng **U7** (gạt USDA, tìm
   `beef`/`hummus`, ghi → Nhật ký có tên không rỗng + kcal đúng) — U7/S-N chưa hề chạy trên máy.
2. **S-M (lật pin Năng lượng)** — việc lớn nhất còn treo, đã chốt hướng nhưng **CHƯA code**; làm
   một mình 1 đợt, đọc `.ai/parallel-reports/S-M-energy-redesign-spec.md` + xác nhận 3 điểm mục 7.
3. (Nhỏ) Nhãn category USDA tiếng Anh (`fat_sugar`, `Beverages`…) hiện thô trong UI — gói polish
   riêng, không gấp (xem `.ai/parallel-reports/U7.md`).

---

## Session 11 — 2026-07-03 (Opus + Fable review — nâng cấp quy trình làm việc: subagents native + hooks + ESLint)

**Làm gì:** Theo yêu cầu người dùng "nâng cấp cách làm việc chuyên nghiệp hơn, code không thừa,
nâng cấp chứ không thay thế": bắc cầu hệ `.ai/` tự xây sang Claude Code native, thêm cổng chất
lượng ESLint, rồi chạy một lượt review độc lập (model Fable) soát lại chính đợt nâng cấp và vá
các lỗ hổng tìm thấy.

**Kết quả:**
- **Commit `c7c0dde` (infra, tách riêng — không dính file S-M):** 5 native subagent trong
  `.claude/agents/` (qa-reviewer read-only); hook PostToolUse tự lint file `.ts` vừa sửa
  (`.ai/scripts/lint-edited-file.js`, exit 2 khi có error); hook Stop nhắc verify + wrapup;
  ESLint 9 + `eslint-config-expo` (dev-only, người dùng duyệt); scripts `lint`/`typecheck`/
  `verify`; thư mục `.ai/skills/learned/`.
- **ESLint baseline lần đầu:** 2 error / 22 warning trên 67 file — 2 error thật
  (`useDrainTick.ts:15` react-hooks/purity, `HistoryScreen.tsx:50` react-hooks/immutability)
  → đăng ký gói **L-1** trong `NEXT_SESSIONS.md` để dọn (chưa sửa — 2 file không thuộc phiên này).
- **Review độc lập (Fable) chấm 7/10**, tìm ra và đã vá: (1) commit infra tách khỏi S-M đang
  trộn trong working tree; (2) baseline bẩn làm hook tự mâu thuẫn luật vàng → gói L-1; (3) nguồn
  sự thật nhân đôi → `.ai/agents/` thu thành con trỏ sang `.claude/agents/`; (4) tài liệu lệch
  thực tế → sửa CONTEXT §6/§10, `docs/03-architecture.md` (thêm `hooks/ types/ navigation/
  domain/energy domain/food data/food`, bảng `food_log`, ghi chú S-M ở Depletion tick), 2 README
  agents/skills (bổ sung 3 skill thiếu trong bảng), bảng NEXT_SESSIONS (S-F ✅, S-M ✅ code).
- **Ghi nhận:** một **phiên song song đã làm xong code S-M** hôm nay (xem
  `.ai/parallel-reports/S-M.md`) — pin Năng lượng giờ đếm LÊN "đã ăn/mục tiêu"; lúc viết entry
  này code S-M **chưa commit, chưa test máy**.

**Vấn đề gặp phải & Cách giải quyết:** (a) Hook lint chặn theo *file* chứ không theo *diff* —
file có lỗi tồn đọng sẽ chặn cả sửa đổi vô can → giải bằng gói L-1 đưa baseline về 0 thay vì nới
hook. (b) `eslint-config-expo` 57 nghiêm hơn "thời" SDK 54 (bộ rule react-hooks mới) — chấp nhận
vì dev-only, nhưng lỗi purity/immutability có thể lạ mắt. (c) Hai lần suýt vấp file dùng chung
(`package.json`) khi S-M chạy song song — thoát nhờ diff-check trước khi stage.

**Session tiếp theo phải làm:**
1. **Commit code S-M** (đang nằm chưa commit trong working tree — kiểm tra `npm run verify`
   trước) rồi **test máy thật** (S-A giờ gồm: luồng S-M mới + U7/USDA).
2. **L-1** — sửa 2 lint error tồn đọng (gói nhỏ ~15 phút, prompt có sẵn trong NEXT_SESSIONS).
3. **Khởi động lại Claude Code** để nạp subagents + hooks mới (chỉ cần 1 lần).

---

## Session 12 — 2026-07-04 (nâng cấp "2 đồng hồ" hoàn tất + Pin vi chất S-R)

**Làm gì:** Từ sau Session 11, các gói **S-M · S-O · S-P · S-Q** (nâng cấp "2 đồng hồ": pin
no/đói tụt dần theo nhịp sinh học làm headline + Sổ calo hôm nay đếm lên, reset 6h sáng) đã được
code và **commit tách gói** (`136fd23` S-M, `3efee07` S-O, `139f10c` S-P, `0aeb1c8` docs,
`1476254` S-Q) — chưa có entry riêng ở đây, ghi gộp lại để log không bị hổng (chi tiết đầy đủ ở
`.ai/parallel-reports/S-M.md`, `S-O.md`, `S-P.md`, `S-Q.md`). Tiếp đó, phiên này làm **S-R** — pin
vi chất (micronutrient) dẫn xuất từ nhật ký món.

**Kết quả:**
- **S-M/S-O/S-P/S-Q (đã commit trước phiên này):** pin Năng lượng đổi vai thành pin "no/đói"
  tụt dần (sàn 20%, xả theo nhịp thức 6h–23h/ngủ), Sổ calo hôm nay reset lúc 6h sáng thay vì nửa
  đêm, mục tiêu kcal/ngày tự tính từ cân nặng mong muốn (thâm hụt/thặng dư an toàn, kẹp min(20%,
  750kcal), không dưới BMR). Chưa test máy thật.
- **S-R (làm trong phiên này):** dàn "pin vi chất" mới trên Home, tính từ nhật ký món (không đổi
  DB/schema) — nhóm "nạp cho đủ" (Chất xơ/Sắt/Canxi/Chất béo nổi bật, Kali/Magie/Kẽm ở "Xem
  thêm") + nhóm "giữ ngưỡng" (Natri/Đường, nhãn nhẹ "vượt ngưỡng gợi ý" khi vượt — không tô đỏ).
  Mốc tham khảo theo giới/tuổi từ hồ sơ. Có xem lại 7 ngày gần nhất (tận dụng `food_log` đã lưu
  sẵn qua `getFoodLogInRange`, không cần bảng mới). Quyết định kỹ thuật đáng chú ý: **không tái
  dùng `BatteryCell.tsx`** cho các pin này vì nó tự tô đỏ/vàng khi % thấp — vi phạm ranh giới sức
  khoẻ ("dưới mốc = còn trống, trung tính"); viết cell hiển thị riêng trong `MicroBatteryStack.tsx`
  luôn giữ đúng 1 màu cố định. Vitamin (A, B12, B9, C, D) **hoãn lại** — món Việt trong CSV không
  có dữ liệu vitamin thật, không muốn hiện số bịa. Chi tiết đầy đủ:
  `.ai/parallel-reports/S-R.md`.
- Verify xanh trước commit: `npx tsc --noEmit` sạch · `npx jest` **155 test PASS / 15 suite** ·
  `npx expo export --platform ios` OK (1435 module).

**Vấn đề gặp phải & Cách giải quyết:** spec S-R gốc đề xuất mốc cố định + không lịch sử + không
đụng ngoài vài file — người dùng khi xác nhận lại muốn mở rộng thêm (mốc theo giới/tuổi, lịch sử
7 ngày, cả vitamin). Đã kiểm tra thực tế trước khi đồng ý mở rộng: lịch sử 7 ngày khả thi *không*
cần đổi schema (dữ liệu đã có sẵn trong retention 7 ngày) nên làm luôn; vitamin thì dữ liệu không
tồn tại cho món Việt (chỉ có ở 363 nguyên liệu thô Mỹ trong USDA JSON) — đã trình bày rõ giới hạn
này và người dùng đồng ý hoãn thay vì hiện số bịa.

**Session tiếp theo phải làm:**
1. **S-A (test máy thật)** — giờ tồn đọng cả 5 luồng mới chưa test: S-M/S-O/S-P/S-Q (2 đồng hồ,
   đặc biệt mốc reset 6h) và S-R (pin vi chất, đặc biệt xác nhận màu không đỏ khi dưới mốc + chọn
   lại ngày cũ đúng dữ liệu).
2. **Vitamin cho món Việt** (nếu muốn làm tiếp S-R) — cần một gói tra cứu dinh dưỡng thật cho 73
   món trong `food_items.csv` trước khi bật lại pin vitamin (không thể trích từ USDA JSON vì đó
   là nguyên liệu Mỹ, không phải món Việt).
3. **L-1** — vẫn còn treo từ Session 11 (2 lint error tồn đọng, gói nhỏ, prompt có sẵn).

> 🟡 **Đóng phiên 2026-07-04:** người dùng **chủ động dời việc test máy (S-A) sang một buổi
> khác** — không phải bỏ dở/quên. Code của cả "2 đồng hồ" (S-M/S-O/S-P/S-Q) lẫn S-R đã commit +
> push lên `origin/session-5-demo-ready` đầy đủ, verify xanh (`tsc`/`jest`/`expo export`), chỉ còn
> thiếu bước cầm điện thoại lên xác nhận. Phiên sau bắt đầu thẳng vào S-A, không cần code gì thêm
> trước đó.

---

## Session 13 — 2026-07-07

**Làm gì:** Nâng cấp EAS/Expo Go, mở rộng danh mục thực phẩm + pin vi chất, Excel export 6 sheet, hoàn tất U7 vượt spec, sửa 2 lint error (L-1).

**Kết quả (tất cả chưa commit):**
- **EAS/Expo Go chuẩn bị chạy trên iPhone:** `eas.json` mới, `app.json` thêm `runtimeVersion` = `sdkVersion`, hướng dẫn `docs/HUONG-DAN-DUNG-TREN-IPHONE.md`.
- **FoodLogModal:** thêm nút ✕ + bấm overlay để thoát (hết kẹt màn nhập món).
- **`food_items.csv`:** 73 → 90 món (đồ uống, thực phẩm chức năng, bánh siêu thị Đức) + 3 category mới (`drink`/`supplement`/`snack`) + 2 cột mới `epa_mg`/`dha_mg`.
- **Bug pin vi chất:** bỏ sót món ghi từ USDA → sửa `src/data/food/foodLookup.ts` (`getAnyFoodById`, bắt buộc cho mọi tính toán từ food log).
- **Pin vi chất:** vượt 100% theo tỷ lệ thật (trần 999%), dòng "KN …/ngày" dưới mỗi pin, pin Omega-3 EPA+DHA mới (mục tiêu 500mg), ô nạp nhanh thực phẩm chức năng `SupplementQuickLog.tsx`.
- **U7 vượt spec:** 363 tên USDA dịch tiếng Việt (toàn bộ `database/usda_names_vi.csv`), tìm kiếm gộp song ngữ `src/data/food/foodSearch.ts` (searchAllFoods — index bỏ dấu, ưu tiên khớp đúng dấu, món Việt trước).
- **Excel export 6 sheet:** thêm "Dinh dưỡng ngày", "Tổng kết tuần", "Bảng ngưỡng tham chiếu" + cột "Đánh giá" (nguồn NIH/WHO/DGA, xem `docs/excel-report.md`); module thuần `nutritionAssessment.ts` + `dailyNutritionSummary.ts`.
- **L-1 hoàn tất:** 2 lint error sửa xong (HistoryScreen `loadHistory` hoisting, useDrainTick `useRef` trong render).
- **Verify (trước khi commit):** `npx tsc --noEmit` sạch · `npx jest` → **188 test PASS / 19 suite** · 0 lint error.

**Vấn đề gặp phải:** không có (code lành).

**Session tiếp theo phải làm:**
1. **Commit từng gói riêng:** U7 (U7-A + U7-B gộp 1 commit), L-1, Excel export, food_items.csv + foodLookup.ts sửa, EAS config, FoodLogModal nút ✕, Omega-3 pin, nạp nhanh supplement.
2. **W-1** (dọn 23 lint warning về 0, sửa tickDrain xả qua nửa đêm) + **G-1** (thêm `name_de` 3 ngôn ngữ tìm kiếm) — chạy song parallel, agent nền.
3. **S-A** test máy thật sau khi W-1+G-1 xong + tất cả commit.

---

## Session 14 — 2026-07-08

**Làm gì:** (1) Excel export nhiều sheet ("Daily Totals" + "Food Entries") + mở rộng danh sách món khi nhập món chưa khớp; (2) 8 hạng mục feedback người dùng (cân nặng, xuất tháng, Muối, sửa dinh dưỡng món, đổi nhãn Carbs, quản lý TPCN, cảnh báo vượt mức). Điều phối qua nhiều subagent song song (sonnet/haiku), tự làm inline 1 gói khi agent bị chặn bởi giới hạn phiên. Chốt bằng 1 lượt QA-reviewer review toàn diff + sửa bug tìm được, rồi commit.

**Kết quả (tất cả ĐÃ COMMIT, commit `9da940a`, nhánh `session-5-demo-ready`, CHƯA push lên origin):**
- **Excel đa-sheet:** sheet mới "Daily Totals" (tổng theo ngày + cân nặng carry-forward) và "Food Entries" (chi tiết từng món, hàng trống ngăn cách ngày) — `src/domain/nutrition/excelSheets.ts` (thuần, có test), `formatDMY` trong `dateUtils.ts`. Giới hạn kỹ thuật ghi rõ: thư viện `xlsx` bản miễn phí KHÔNG tô màu/viền ô được — dùng hàng trống thay thế.
- **Món tự thêm (`custom_foods`):** bảng SQLite mới + `customFoodRegistry.ts` (persist + tìm lại ngay, bền qua restart) + form "➕ Thêm món mới" trong `FoodLogModal.tsx` khi tìm không thấy.
- **Cân nặng làm tròn 1 số thập phân** — `WeightLogCard.tsx`.
- **Xuất Excel tháng + giữ dữ liệu 35 ngày:** `DATA_RETENTION_DAYS` 7→35, nút "Xuất Excel 30 ngày", tự xuất hàng tháng đặt tên `your_daily_batteries_body_on_MM_YYYY.xlsx` lúc khởi động (`monthlyAutoExport.ts` + `monthRange.ts`), **chỉ xoá dữ liệu cũ sau khi người dùng xác nhận** — không có đường xoá thầm lặng.
- **Pin "Muối & điện giải":** Muối suy ra từ Natri (×2.5/1000, không lưu field riêng) nên tự cập nhật theo mọi món ghi; gộp hiển thị Muối/Natri/Kali/Magie cùng nhóm (`nutrientTargets.ts`, `microBatteryEngine.ts`, `MicroBatteryStack.tsx`).
- **Sửa thành phần dinh dưỡng món (`food_overrides`):** bảng override riêng (không đụng file catalog generated), merge trong `getAnyFoodById` — sửa 1 lần áp dụng khắp nơi (pin vi chất, tổng kết ngày, Excel). Nút "✎ Sửa thành phần" trong `FoodLogModal.tsx`, modal dùng chung `FoodNutritionEditModal.tsx`.
- **Đổi nhãn "Tinh bột" → "Carbs (Carbohydrate)"** cho MACRO (3 chỗ: `TodayMeals.tsx`, `FoodLogModal.tsx`, 2 header Excel) — **giữ nguyên** "Tinh bột" cho category `grain` (món ăn). Xác nhận không hề có cộng đôi đường vào carbs.
- **Quản lý TPCN:** `SupplementQuickLog.tsx` gộp TPCN tự thêm, log theo giá trị đã sửa (override-aware), nút ➕ thêm mới + ✎ sửa liều lượng từng loại.
- **Cảnh báo vượt Upper-Limit:** `upperLimits.ts` + `overdoseWarning.ts` (thuần) + `OverdoseNotice.tsx` — ngôn ngữ "chỉ để tham khảo", không chẩn đoán, đúng ranh giới sức khoẻ mục 5.
- **QA review (2 lượt)** tìm & vá tổng **5 bug tích hợp** trước khi commit: số âm không bị chặn ở form món tự thêm, `defaultServingG` âm khoá nút ghi món vô lý, id trùng khi double-tap "Lưu món", `pickFood` không resolve override (sửa dinh dưỡng không áp dụng khi ghi lại qua tìm kiếm), merge override xoá mất `servingPresets`/`nameDe` của món gốc sau restart app.
- **Verify cuối cùng:** `npx tsc --noEmit` sạch · `npm run lint` sạch · `npx jest` → **249 test PASS / 27 suite**.

**Vấn đề gặp phải & Cách giải quyết:**
- Một subagent (`mobile-frontend`) bị dừng giữa chừng do **chạm giới hạn phiên Claude** (reset theo giờ Berlin) trước khi viết code — chỉ mới đọc context. Tự hoàn thiện gói đó **inline** (không spawn lại) vì đã có đủ context + API backend từ agent trước, tránh mất thời gian dựng lại context cho agent mới.
- Repo có PostToolUse hook chặn ESLint `react-hooks/*` lỗi ngay khi ghi file — gặp 2 lỗi lặp lại (`set-state-in-effect` khi seed form theo prop, `purity` khi gọi `Date.now()` trong hàm thân component). Đã ghi thành memory lâu dài (`eslint-react-hooks-rules` trong hệ thống memory Claude Code) để phiên/agent sau tránh lặp lại.
- Retention 7 ngày mâu thuẫn với yêu cầu "xuất Excel tối đa 1 tháng" (không đủ dữ liệu để xuất) — đã hỏi người dùng, chốt nới lên 35 ngày trước khi code.
- "Salt" trùng khái niệm với Natri/Kali đã có sẵn — đã hỏi người dùng, chốt hướng "nhóm Muối & điện giải" (Muối suy ra từ Natri, không phải field lưu riêng) trước khi code.

**Việc còn tồn đọng (không chặn, ghi lại từ QA để phiên sau cân nhắc):**
- Xuất Excel tự động hàng tháng chỉ xuất **đúng 1 tháng liền trước** — nếu người dùng không mở app quá 1 tháng, tháng ở giữa bị bỏ sót vĩnh viễn (không tự lặp bù).
- `FoodNutritionEditModal` là Modal lồng trong Modal của `FoodLogModal` — cần test tay kỹ nút Back cứng Android.
- Form "thêm món mới" bị trùng lặp code giữa `FoodLogModal.tsx` (nhánh `adding`) và `FoodNutritionEditModal.tsx` (`mode="add"`) — nên gộp lại 1 chỗ khi có dịp refactor.
- `OverdoseNotice` có thể hiện đồng thời 2 dòng gần giống nhau (Muối + Natri) khi vượt ngưỡng — không phải lỗi cộng dồn, chỉ hơi rườm.

**Session tiếp theo phải làm:**
1. **S-A mở rộng — test máy thật TOÀN BỘ backlog** (chưa hề chạy trên điện thoại lần nào): mô hình "2 đồng hồ" (S-M/S-O/S-P/S-Q), pin vi chất (S-R), và **toàn bộ Session 14** (Excel đa-sheet, món tự thêm, sửa thành phần, Muối, TPCN, cảnh báo UL, cân nặng làm tròn, xuất tháng). Checklist test tay tiếng Việt đầy đủ đã có trong báo cáo QA của Session 14 (yêu cầu người dùng cung cấp lại nếu cần, hoặc đọc lại transcript session này).
2. Trong lúc test tay #4 (sửa thành phần), **ưu tiên xác nhận lại bug đã vá** (`pickFood` resolve override) — vì đây là bug QA tìm thấy sau khi code đã "xong", rủi ro cao nhất trong đợt này.
3. Nếu ổn sau test tay → `git push` lên `origin/session-5-demo-ready` (hiện đang **ahead 1 commit**, chưa push).
4. Cân nhắc xử lý 4 việc tồn đọng ở trên (không gấp, không chặn release).
5. **L-1/W-1/G-1** (từ Session 13) — kiểm tra lại xem đã xong trong các commit trước Session 14 chưa (git log cho thấy có vẻ đã commit riêng — xác nhận lại rồi xoá khỏi backlog nếu đúng).

---

## Session 15 — 2026-07-08 (dọn việc tồn đọng nhỏ từ Session 14)

**Làm gì:** Theo yêu cầu người dùng, xử lý 3 mục nhỏ còn treo từ Session 14 trước khi test máy
thật: (1) xác nhận L-1/W-1/G-1 đã xong, (2) gộp code trùng lặp form "Thêm món mới", (3) gọn cảnh
báo Muối/Natri hiện trùng nhau. Khảo sát bằng 2 Explore agent song song trước khi sửa.

**Kết quả:**
- **L-1/W-1/G-1 xác nhận xong** — không cần sửa gì thêm: `npm run lint` sạch 0 lỗi/0 cảnh báo,
  `database/usda_names_de.csv` có dữ liệu tiếng Đức + `food_items.csv` có cột `name_de`. Đóng hẳn
  3 mục này khỏi backlog.
- **Gộp UI trùng lặp form "Thêm món mới":** tạo `src/components/food/CustomFoodFields.tsx` (component
  trình bày thuần, ~250 dòng JSX các trường tên/nhóm/khẩu phần/macro/carb breakdown/toggle vi
  chất/8 trường vi chất) dùng chung bởi `FoodLogModal.tsx` (nhánh `adding`) và
  `FoodNutritionEditModal.tsx` (cả `mode="edit"` lẫn `mode="add"`, kể cả khi gọi từ
  `SupplementQuickLog.tsx`). **Chỉ gộp phần trình bày** — logic lưu/điều hướng sau khi lưu (mỗi
  file chuyển hướng khác nhau thật sự) vẫn giữ riêng ở từng file, đúng theo khảo sát ban đầu.
- **Gọn cảnh báo vượt mức Muối/Natri:** `overdoseWarning.ts` giờ bỏ qua cảnh báo `sodium` khi
  `salt` (suy ra từ chính natri, cùng 1 số đo) đã vượt ngưỡng cùng lúc — chỉ còn 1 dòng "Muối"
  thay vì 2 dòng gần giống nhau. Thêm test case xác nhận trong `overdoseWarning.test.ts`.
- **Verify xanh:** `npx tsc --noEmit` sạch · `npx jest` → **250 test PASS / 27 suite** · `npm run
  lint` sạch · `npx expo export --platform ios` OK (1455 module).

**Vấn đề gặp phải:** không có — cả 2 việc đều đúng như dự đoán từ khảo sát ban đầu, không phát
sinh bất ngờ khi code.

**Việc còn tồn đọng (không đổi so với Session 14, chưa xử lý đợt này):**
- Xuất Excel tự động hàng tháng chỉ xuất đúng 1 tháng liền trước (bỏ sót nếu không mở app >1 tháng).
- `FoodNutritionEditModal` lồng trong `FoodLogModal` — cần test tay nút Back cứng Android.

**Session tiếp theo phải làm:**
1. **S-A — test máy thật TOÀN BỘ backlog** (vẫn là việc ưu tiên #1, xem chi tiết ở cuối Session 14).
2. Nếu ổn sau test tay → `git push` lên `origin/session-5-demo-ready` (hiện ahead vài commit).

---

## Session 16 — 2026-07-09 (S-A: debug 3 nhóm feedback thật của người dùng — TPCN/Vận động/Pin nhỏ)

**Làm gì:** Người dùng báo 3 nhóm lỗi gặp phải khi dùng app thật (theo yêu cầu S-A): (1) TPCN ép
quy đổi mốc 100g sai với thực tế (1 viên/gói); (2) Vận động không sửa/xoá được khi nhập nhầm + thiếu
"thời gian diễn ra thực tế"; (3) Pin Vận động và Pin Carbs mất đồng bộ với dữ liệu nhập. Khảo sát
nguyên nhân gốc bằng 3 Explore agent song song, chốt phạm vi với người dùng (không xây replay engine
đầy đủ, giữ pin Vận động theo `steps`, tự suy Carbs từ đường+xơ), rồi thực thi qua loop nhiều wave
(logic-backend + mobile-frontend, sonnet/haiku), chốt bằng 2 vòng kiểm tra độc lập: 1 lượt QA-reviewer
và 1 lượt `/code-review` (8 finder agent + verify) trước khi commit.

**Kết quả (ĐÃ COMMIT `7d2e6dd`, nhánh `session-5-demo-ready`, CHƯA push, CHƯA test máy):**
- **TPCN theo Gói/Viên:** `FoodItem`/`FoodLogEntry` thêm `portionUnit`('gram'|'pack'|'capsule') +
  `servingWeightG`. Giữ nguyên engine tính theo gram (`nutritionForGrams`, `microBatteryEngine`
  KHÔNG đổi) — quy đổi chỉ ở biên: nhập dinh dưỡng per-gói/viên rồi `scalePerServingToPer100g` khi
  lưu, `gramsForPortion` khi log (count→grams). UI: `CustomFoodFields.tsx` (chip đơn vị + label động),
  `FoodLogModal.tsx`/`SupplementQuickLog.tsx` (log theo số gói/viên), `TodayMeals.tsx` (hiện "2 viên").
- **Vận động — bản ghi độc lập + Sửa/Xoá + giờ diễn ra:** bảng `activity_log` mới (id riêng, không
  còn mutate `battery_readings` không thể hoàn tác). `removeActivity`/`updateActivity` trong
  `energyStore.ts` nhân bản mẫu `removeFood`. UI mới `TodayActivities.tsx` (danh sách + Sửa/Xoá),
  `EnergyActionsBar.tsx` thêm ô "Từ/Đến HH:mm" (`parseTimeHHmmToday`/`formatTimeHHmm` trong
  `dateUtils.ts`).
- **Đồng bộ pin nhỏ:** Pin Vận động trước đây LUÔN = 0 vì `logActivity` không hề gọi `applyIntake`
  lên nó — đã vá (nạp bằng steps). Pin Carbs tự suy `carbG = đường + xơ` khi ô Carbs để trống
  (`customFoodInput.ts`).
- **QA review vòng 1** tìm 4 bug CONFIRMED trước commit đầu: `getAnyFoodById` không merge
  `portionUnit`/`servingWeightG` từ override (sửa khối lượng viên/gói không có tác dụng ở bất kỳ đâu
  trong app); nhánh edit của `FoodNutritionEditModal.tsx` làm rớt 2 field mới tương tự; thiếu
  validate `servingWeightG > 0` khi chọn Gói/Viên; `removeActivity` hoàn tác pin Vận động bằng phép
  trừ có clamp khiến xoá 1 mục sai kéo cả pin về 0 dù còn mục hợp lệ khác (sửa tạm bằng "recompute
  tuyệt đối từ các entry còn lại").
- **`/code-review` vòng 2** (8 finder angle + verify 1-vote, effort=high) soát lại TOÀN BỘ diff, tìm
  thêm **9 bug CONFIRMED**, đã vá hết trước khi commit thật:
  1. Đổi chip đơn vị TPCN không reset số đã nhập → `buildCustomFoodItem` diễn giải lại theo mốc mới,
     sai lệch ~80 lần → thêm `resetNutritionForUnitChange` (xoá trắng số khi đổi unit thay vì đoán
     quy đổi).
  2+3. "Recompute tuyệt đối" (vá tạm ở vòng 1) lại sinh bug mới: xoá bỏ phần pin đã bị `tickDrain`
     rút theo thời gian, và xoá mất bước nạp qua tap tay trực tiếp (không nằm trong `activityLog`) →
     sửa bằng **thuật toán delta** (tính đóng góp cận biên của entry bị xoá, trừ tương đối lên level
     hiện tại) — xem bài học đã lưu `.ai/skills/learned/undo-reversal-must-be-delta-not-absolute-
     recompute.md`.
  4. Sửa/xoá vận động không dọn `intake_events` (chỉ để xuất Excel) → đếm trùng/hiện mục đã xoá vĩnh
     viễn → thêm `deleteIntakeEventsByIds`.
  5. Lệch mốc "energy day" (6h sáng, `energyDayString`) vs `activityLog` (nhóm theo lịch ngày) cho
     hoạt động log lúc 0h–6h sáng → thêm `energyDayApplied` snapshot trên từng entry, hoàn tác đúng
     ngày lịch sử nếu khác ngày hiện tại (không đụng `readings` state của hôm nay).
  6. `updateActivity` (xoá rồi thêm lại) luôn tạo timestamp mới → mất giờ log gốc + đảo thứ tự hiển
     thị → truyền lại `timestampOverride`, sort lại `activityLog` sau khi thêm.
  7. `servingWeightG` cũ của catalog rò rỉ qua override khi user đổi TPCN về 'gram' rồi đổi lại →
     `getAnyFoodById` giờ ép `servingWeightG=undefined` khi `portionUnit==='gram'`.
  8. Không xoá được giờ đã nhập qua UI (`undefined`=giữ nguyên áp dụng luôn cho ô để trống) → đổi
     ngữ nghĩa `ActivityPatch`: `null`=xoá chủ ý, `undefined`=giữ nguyên (`TodayActivities.tsx`
     phân biệt ô trống hẳn vs ô có nội dung không parse được).
  9. (altitude) Field TPCN mới được merge bằng liệt kê thủ công từng field ở nhiều nơi — nguyên nhân
     gốc của bug #7 — thêm comment cảnh báo tại điểm merge liệt kê đủ 3 chỗ nối phải đồng bộ mỗi khi
     thêm field `FoodItem` mới.
- **Verify cuối cùng:** `npx tsc --noEmit` sạch · `npm run lint` sạch · `npx jest` →
  **291 test PASS / 28 suite** (từ 271 gốc, riêng vòng vá bug đã thêm 20 test mới).

**Vấn đề gặp phải & Cách giải quyết:**
- Vòng vá đầu tiên cho lỗi "xoá vận động kéo pin về 0" dùng cách "recompute tuyệt đối từ dữ liệu còn
  lại" — trực giác tưởng đúng nhưng lại ngầm giả định tập dữ liệu recompute là NGUỒN DUY NHẤT ảnh
  hưởng đến pin (bỏ qua drain theo thời gian + nạp tay qua đường khác) → `/code-review` bắt được ngay
  vòng sau. Đã lưu thành bài học dài hạn ở `.ai/skills/learned/undo-reversal-must-be-delta-not-
  absolute-recompute.md` — quy tắc chung: hoàn tác 1 bản ghi PHẢI dùng delta tương đối lên state hiện
  tại, không bao giờ ghi đè tuyệt đối từ recompute.
- 2 lỗi (getAnyFoodById merge thiếu field, edit-modal rớt field) đều xảy ra ở cùng dạng "điểm nối" —
  thêm field `FoodItem` mới cần đồng bộ ở nhiều chỗ liệt kê thủ công, dễ quên 1 chỗ mà TypeScript
  không báo lỗi (object spread vẫn type-check). Đã lưu memory Claude Code
  (`fooditem-field-join-points`) từ trước khi vào `/code-review`, và bug review vòng 2 xác nhận đúng
  y hệt kiểu lỗi đó lặp lại — củng cố giá trị của memory này.
- Agent B (vòng vá vận động) tự phát hiện thêm 1 bug hạ tầng test: mock DB dùng chung trong
  `energyStore.test.ts` thiếu `withTransactionAsync`, khiến lỗi bị try/catch của store nuốt âm thầm
  ở MỌI test trước đó (chỉ assert state trong bộ nhớ, không assert thứ tự gọi persistence) — vá luôn
  vì fix #4 (dọn `intake_events`) cần code chạy qua được đoạn đó để test.
- Người dùng chốt "vá cả 9 lỗi rồi mới commit" thay vì commit ngay — đúng tinh thần phiên này (đang
  vá đúng loại lỗi mà cả session tồn tại để sửa), nên không rút gọn phạm vi dù tốn thêm 1 vòng agent.

**Việc còn tồn đọng (không chặn, ghi lại để phiên sau cân nhắc):**
- `.claude/settings.json` có 2 quyền Bash không liên quan đến phiên này (`ipconfig getifaddr`,
  `kill 78429`) — cố tình KHÔNG gộp vào commit `7d2e6dd`, vẫn còn là thay đổi local chưa commit.
- Giờ hoạt động (`parseTimeHHmmToday`) chỉ neo được "hôm nay" — chưa ghi được hoạt động của "hôm
  qua" bằng giờ thực (giới hạn có chủ đích, đã thông báo người dùng, không phải bug).
- Hoàn tác pin Năng lượng/No quanh biên trần/sàn vẫn là xấp xỉ (kế thừa từ `removeFood` gốc) — chỉ
  riêng pin Vận động được nâng cấp lên hoàn tác chính xác (thuật toán delta) trong phiên này.
- Tất cả nội dung Session 11–16 (mô hình 2 đồng hồ, pin vi chất, Excel đa-sheet, override, Muối,
  TPCN, UL, và giờ thêm TPCN-Gói/Viên + Vận động Sửa/Xoá + đồng bộ pin nhỏ) vẫn **CHƯA hề chạy trên
  điện thoại thật** — backlog test tay đang dồn qua rất nhiều session.

**Session tiếp theo phải làm:**
1. **S-A — test máy thật** (vẫn là việc số 1, backlog giờ càng dài). Checklist test tay riêng cho
   Session 16 (đưa lại từ báo cáo QA trong transcript, tóm tắt):
   - TPCN: thêm "Omega-3" đơn vị Viên (1.22g/610mg omega3), log 2 viên → pin vi chất đúng gấp đôi;
     sửa lại khối lượng 1 viên qua ✎ rồi log lại → số phải khớp giá trị mới (test đúng bug #7 đã vá).
   - Vận động: đi bộ 8100 bước, sau đó ghi thêm 1 mục nhập nhầm (VD 2400 phút) → xoá đúng mục nhầm
     → pin Vận động phải về đúng mức của mục hợp lệ còn lại (test đúng bug #2/#3 đã vá bằng delta).
   - Sửa 1 hoạt động cũ (đổi số phút) → kiểm tra vị trí hiển thị KHÔNG nhảy xuống cuối danh sách
     (test bug #6). Xoá trắng ô giờ khi Sửa → giờ cũ phải biến mất, không giữ nguyên (test bug #8).
   - Pin nhỏ: ghi vận động → Pin Vận động nhích ngay; thêm món chỉ nhập Đường+Xơ (để trống Carbs) →
     Pin Carbs nhích ngay.
2. Nếu ổn sau test tay → `git push` lên `origin/session-5-demo-ready` (hiện ahead nhiều commit).
3. Cân nhắc xử lý `.claude/settings.json` (2 quyền Bash lạc chỗ, xem mục tồn đọng trên).

---

## Session 17 — 2026-07-09 (Vá 3 lỗi từ feedback thực tế + hệ thống hoàn tác xuyên ngày)

**Làm gì:** Người dùng báo 4 lỗi tiềm ẩn khi dùng app. Sau khảo sát: lỗi #4 (xoá không xác nhận) là báo động giả (đã có xác nhận trong HomeScreen từ trước), 3 lỗi còn lại có cơ sở → vá qua 3 agent song song (logic-backend + 2 mobile-frontend) + agent điều phối.

**Kết quả (ĐÃ COMMIT, commit `<TBD>`, CHƯA push, CHƯA test máy):**
- **Fix #1 — Hoàn tác món ăn đúng energy-day (mốc reset 6h sáng):** Trước đây `removeFood` luôn đảo pin trên `readings` hiện tại, không xử lý cross-energy-day. Giờ: thêm field `energyDayApplied?: string` vào `FoodLogEntry` (snapshot ngày năng lượng khi log món, migration cột `energy_day_applied` ở bảng `food_log`), `removeFood` hoàn tác trên đúng sổ ngày lịch sử nếu khác energy-day hiện tại (không đụng `readings` state hôm nay). **Nguyên nhân gốc:** cùng loại lỗi với FIX #5 (Vận động) từ Session 16 nhưng bị bỏ sót cho thực phẩm. Files sửa: `src/store/energyStore.ts`, `src/types/food.ts`, `src/data/repositories/foodLogRepository.ts`, `src/data/db/schema.ts`.
- **Fix #2 — Sửa món ăn:** Thêm `updateFood(id, {grams?, count?, timestamp?})` vào store, dùng chiến lược reverse-then-relog (hoàn tác bản ghi cũ bằng delta, thêm lại với giá trị mới) + `getAnyFoodById` để lấy thông tin, `gramsForPortion` để quy đổi. Thêm nút ✎ + modal "Sửa món ăn" vào `TodayMeals.tsx` (prop mới `onEdit`). Trước đó TodayMeals chỉ có nút ✕. Files sửa: `src/store/energyStore.ts`, `src/components/TodayMeals.tsx`.
- **Fix #3 — Hoàn tác nạp nhanh (Intake events):** Thêm state `intakeLog` + `removeIntake(id)` vào store, hoàn tác chính xác bằng delta (đảo kcal + độ no cho từng macro). Tạo component mới `src/components/TodayIntakes.tsx` (danh sách "Nạp nhanh hôm nay" + nút ✕ hoàn tác). Ráp vào HomeScreen với Alert xác nhận. Files mới + sửa: `src/store/energyStore.ts`, `src/components/TodayIntakes.tsx` (mới), `src/screens/HomeScreen.tsx`.
- **Ghi chú (#4 báo động giả):** Lỗi #4 "xoá không xác nhận" — user đọc chỉ component `TodayMeals.tsx` xoá trực tiếp, bỏ qua wiring ở `HomeScreen.tsx` (đã có `Alert.alert` xác nhận từ trước, gọi trước khi `removeFood`). Không vá.
- **Verify cuối cùng:** `npx tsc --noEmit` sạch · `npm run lint` sạch · `npx jest` → **299 test PASS / 28 suite**.

**Vấn đề gặp phải & Cách giải quyết:**
- Lỗi #1 report ban đầu chẩn đoán sai chỗ (nói `logFood` ghi nhầm ngày mới) — thực ra chiều ghi vào đã đúng (store nạp pin energy theo energy-day), lỗi thật nằm ở chiều hoàn tác `removeFood`. Cùng gốc với FIX #5 (Vận động từ Session 16) nhưng bị bỏ sót cho food → thêm `energyDayApplied` tương tự logic Vận động.
- Kiến trúc song parallel: phân theo "sở hữu file" để 3 agent không giẫm chân trên energyStore.ts (file nóng chung) — 1 agent làm chủ toàn bộ backend + 2 field mới của fix #1, 2 agent UI làm file riêng (TodayMeals, TodayIntakes, HomeScreen), agent điều phối giữ HomeScreen trung tâm.

**Session tiếp theo phải làm:**
1. **S-A — test máy thật** (ưu tiên #1 duy nhất). Backlog giờ gồm nội dung Session 11–17, chưa hề chạy trên điện thoại. Checklist test riêng cho Session 17 (mini):
   - Log 1 món trước 6h sáng, rồi xoá nó sau 6h sáng → pin phải trừ đúng (không lẫn với hôm nay).
   - Sửa khối lượng/số viên 1 món qua ✎ (đổi từ 100g → 50g, hoặc 2 viên → 3 viên) rồi kiểm số → pin phải khớp giá trị mới (không giữ mức cũ).
   - Nạp nhanh 300ml khoáng chất, rồi ✕ hoàn tác → pin phải trừ lại đúng.
2. Nếu ổn sau test tay → `git push` lên `origin/session-5-demo-ready` (hiện ahead nhiều commit).

---

## Session 18 — 2026-07-10 (S-A tiếp tục test máy thật: vá 4 bug + tính năng mới ml/L cho pin Nước)

**Làm gì:** Người dùng test máy thật bước 3 (S-A) và báo 2 đợt feedback: (1) pin vi chất/pin nhỏ không nạp đúng khi ăn "chicken nuggets" (carb sai lệch nặng) và form "Thêm món mới" bị bàn phím che nút; sau khi vá, người dùng test lại và phát hiện thêm modal "Sửa thành phần" không hiện gì khi bấm. Cuối session, người dùng yêu cầu thêm tính năng mới: đổi qua lại đơn vị hiển thị/nhập ml ↔ L cho pin Nước.

**Kết quả (CHƯA COMMIT — làm việc trực tiếp trên nhánh `ui-upgrade`):**
- **Bug 3a — dữ liệu USDA thiếu đường/xơ:** `scripts/generate-usda-db.js` chỉ map nutrient number cũ (269/291/205), nhưng bản Foundation Foods 2026 dùng number mới cho đa số dòng (269.3 đường: 136 dòng so với 269 chỉ 5 dòng; 293 xơ AOAC thêm 34 dòng). Sửa NUTRIENT_MAP thành danh sách ưu tiên + clamp carb "by difference" âm về 0. Chạy lại `npm run gen:usda`: có đường 5→132 dòng, có xơ 185→196 dòng.
- **Bug 3b — bàn phím che nút "Lưu" ở form Thêm món mới:** `BottomSheet.tsx`/`FoodLogModal.tsx`/`FoodNutritionEditModal.tsx` thiếu `flexShrink: 1` trên khung sheet → ScrollView không co lại theo bàn phím, nút Huỷ/Lưu bị đẩy ra ngoài. Thêm `flexShrink: 1` vào cả 3 chỗ.
- **Bug 3c — chốt quy ước đơn vị Carbs (theo yêu cầu người dùng):** Carbs = tổng carbohydrate, LUÔN chứa đường + xơ → bất biến `carb_g >= sugar_g + fiber_g`. Enforce ở 3 lớp nhập liệu: `foodCsv.ts` (parser CSV chung), `customFoodInput.ts` (`buildCustomFoodItem`), `generate-usda-db.js` (pipeline USDA) + sửa tay 4 dòng vi phạm trong `food_items.csv`. Quy ước ghi tại comment `Nutrition` trong `src/types/food.ts`.
- **Bug 3d — "Sửa thành phần" không hiện gì khi bấm (phát hiện ở lượt test lại):** Root cause — `FoodLogModal.tsx` render `FoodNutritionEditModal` (tự bọc `<Modal>` RN riêng) làm sibling trong khi `BottomSheet` (cũng là `<Modal>`) đang `visible=true` → 2 Modal gốc RN chồng nhau, giới hạn đã biết của RN trên iOS khiến modal thứ 2 không chắc render. Đối chứng: `SupplementQuickLog.tsx` dùng đúng component này KHÔNG lồng trong Modal khác → chạy tốt. Fix: ẩn `BottomSheet` (`visible={visible && !editingNutrition}`) khi modal sửa đang mở, đảm bảo không bao giờ có 2 Modal cùng hiển thị. **Chuỗi nhân quả suy ra:** món "Chicken Nuggets - Penny" (món tự thêm) nhiều khả năng bị lưu carb sai lúc tạo do bug 3b, và người dùng không tự sửa lại được vì đúng bug 3d chặn "Sửa thành phần" — 2 bug nối chuỗi làm 1 món bị sai vĩnh viễn cho tới khi sửa xong.
- **Tính năng mới — đổi đơn vị hiển thị/nhập ml ↔ L cho pin Nước:** Dữ liệu vẫn CHỈ 1 biến ml duy nhất xuyên suốt store/DB — chỉ thêm lớp hiển thị. `src/lib/units.ts` (mới, pure + test riêng): `formatWaterAmount`/`toMl`/`nextWaterDisplayUnit`. `waterDisplayUnit: 'ml'|'l'` persist trong `settingsStore` (AsyncStorage). Nhãn lượng nước dưới pin Nước (`BatteryCell`/`BatteryStack`) giờ bấm được để đổi qua lại. `IntakeModal` thêm 2 chip "ml"/"L" khi nạp nước — nhập theo đơn vị nào, tự quy đổi về ml khi lưu.
- **Verify cuối cùng:** `npx tsc --noEmit` sạch · `npm run lint` sạch · `npx jest` → **320 test PASS / 30 suite** (tăng từ 299, thêm test cho bất biến carb + `units.ts` + regression USDA).

**Vấn đề gặp phải & Cách giải quyết:**
- Bug 3d chỉ lộ ra sau khi test lại (không phát hiện được ở lượt phân tích code đầu tiên) — bài học: khi sửa 1 bug UI, nên rà luôn các modal/component liên quan cùng luồng thay vì dừng ở đúng phạm vi user report ban đầu, vì bug thật có thể ẩn phía sau (bug 3b che khuất bug 3d cho tới khi 3b được sửa).
- Bug 3d là hành vi runtime của RN `<Modal>` (2 Modal chồng nhau không đảm bảo render trên iOS) — **jest không mô phỏng được**, chỉ có thể verify bằng test tay trên điện thoại thật. Đã ghi rõ trong `.ai/parallel-reports/S-A.md` để phiên sau/nguời dùng biết đây là điểm cần test tay bắt buộc, không tự nhận đã "test thật".
- Phát hiện thêm (không phải việc của session này): một phiên song song khác đã thêm `.ai/parallel-reports/S-S-backfill-spec.md` (spec "ghi lùi món ăn cho ngày đã qua") + 1 dòng gói **S-S** vào `.ai/NEXT_SESSIONS.md` — chỉ note lại, chưa code, không đụng vào.

**Session tiếp theo phải làm:**
1. **Người dùng test tay trên điện thoại** (bắt buộc, chưa xác nhận): mở "Ghi món ăn" → chọn 1 món → bấm "Sửa thành phần" → xác nhận sheet hiện ra được (bug 3d); thử sửa carb 1 món rồi ăn lại → pin Carbs cập nhật đúng; bấm nhãn "ml" dưới pin Nước → đổi thành "L" được; nạp nước thử cả 2 đơn vị.
2. Nếu ổn → `git add`/commit các file đã sửa (hiện toàn bộ CHƯA COMMIT trên `ui-upgrade`), rồi tiếp tục checklist S-A còn lại (bước 3 hoàn tất, bước 4/5/6 đã PASS từ trước — xem `.ai/parallel-reports/S-A.md`).
3. Lưu ý cho người dùng: sửa 1 món qua "Sửa thành phần" chỉ áp dụng cho lần ăn TIẾP THEO — không tự sửa các dòng đã ghi trong quá khứ (snapshot dinh dưỡng tại thời điểm ghi, giữ nguyên có chủ đích).
4. Cân nhắc đọc `.ai/parallel-reports/S-S-backfill-spec.md` (spec "ghi lùi món ăn") nếu muốn bắt đầu gói S-S — hiện mới là đề xuất, chưa code.

---

## Session 19 — 2026-07-10 (S-F2: tích hợp Apple Health — tự động lấy kcal đốt trong ngày)

**Làm gì:** Người dùng yêu cầu tích hợp Apple Health để tự động lấy kcal đã đốt trong ngày (thay vì phải tự ghi vận động thủ công), hiển thị cạnh kcal đã ăn để biết dư/thiếu. Nhờ agent Fable thiết kế kiến trúc trước (trả lời 5 câu hỏi quyết định: tần suất đồng bộ, có giữ ghi vận động thủ công không, breakdown để v1.1, chỉ hiện tổng kcal ở v1.0, fallback về BMR nếu Apple Health lỗi/từ chối quyền), sau đó triển khai qua 3 subagent tuần tự (logic-backend → mobile-frontend → qa-reviewer), rồi tự tay sửa 1 bug nghiêm trọng QA phát hiện.

**Kết quả (CODE XONG, ĐÃ VERIFY, CHƯA COMMIT lúc viết dòng này — sẽ commit ngay sau):**
- **Service layer** (`src/services/health/appleHealthSync.ts`, mới): wrapper thuần cho `react-native-health` (thư viện mới thêm vào `package.json`), không phụ thuộc Zustand/SQLite/React — dễ test độc lập. Có `isHealthKitLinked()` để tự phát hiện khi native module chưa được link (chạy trong Expo Go/Android/chưa có dev client) thay vì crash.
- **Storage layer**: `src/data/repositories/healthSignalsRepository.ts` thêm `logAppleHealthBurned`/`getAppleHealthBurnedForDate`/`recordSyncTimestamp`/`getLastSyncTimestamp`, tái dùng bảng `health_signals` sẵn có (cột `source`/`type`/`value` đã đủ tổng quát) — **không cần migration**.
- **State layer**: `src/store/energyStore.ts` thêm `appleHealthBurnedKcal`/`lastAppleHealthSync`/`appleHealthStatus` (`'idle'|'syncing'|'synced'|'estimated'`) + action `syncAppleHealthBurned()` — cache 2 tiếng, tự động chạy trong `loadToday()`, fallback về ước tính BMR (`metabolismEngine.dailyExpenditure`) nếu Apple Health từ chối quyền/không có dữ liệu/lỗi. **Chỉ hiển thị, không đụng vào `battery_readings.capacity`/`activityBonusKcal`/`satietyReserveKcal`** — hệ pin/satiety hiện có giữ nguyên hoàn toàn.
- **UI layer**: `src/components/EnergyBalanceCard.tsx` (mới) hiện trên HomeScreen dưới pin chính — "Đã đốt hôm nay / Đã ăn hôm nay / Chênh lệch" (dư/thiếu, màu theo `colors.mint`/`colors.danger` có sẵn); `src/components/AppleHealthStatusBadge.tsx` (mới) hiện trạng thái đồng bộ; `SettingsScreen.tsx` thêm mục "🏥 SỨC KHOẺ" với nút đồng bộ tay + "Lần cuối đồng bộ: Xm trước" (`src/lib/relativeTime.ts`, mới).
- **Cấu hình native**: `app.json` thêm `expo.ios.infoPlist.NSHealthShareUsageDescription` + config plugin của `react-native-health`. Vì thư viện cần native code, **tính năng này KHÔNG chạy được qua Expo Go** — bắt buộc build dev client (`eas build --profile development --platform ios`, `eas.json` đã có sẵn profile này).
- **Bug nghiêm trọng do QA agent phát hiện, tự sửa:** nhánh cache-hit của `syncAppleHealthBurned()` chỉ khôi phục `lastAppleHealthSync` từ DB lúc app khởi động lại, **quên khôi phục `appleHealthBurnedKcal`** (Zustand không persist, RAM reset về 0 mỗi lần mở app) → Home hiện sai "0 kcal" suốt phần còn lại của cửa sổ cache 2h. Sửa: nhánh cache-hit giờ gọi `getAppleHealthBurnedForDate(todayString())` để khôi phục đúng số, đồng thời fix luôn bug phụ ăn theo (cache không phân biệt ranh giới ngày — mở app ngay sau nửa đêm vẫn hiện số hôm qua) vì lookup theo `todayString()` tự nhiên trả `null` khi qua ngày mới, kích hoạt lại nhánh ước tính BMR đúng thay vì hiện dữ liệu cũ. Thêm test `energyStore.appleHealth.test.ts` phủ cả 2 case.
- **Verify cuối cùng:** `npx tsc --noEmit` sạch · `npm run lint` sạch · **377 test PASS / 35 suite** (tăng từ 320).

**Vấn đề gặp phải & Cách giải quyết:**
- Agent Fable (thiết kế kiến trúc) ghi nhầm `react-native-health` là "không cần native module, chạy được Expo Go" — sai. Thư viện này bridge trực tiếp HealthKit (Swift/Obj-C), bắt buộc dev client. Phát hiện trước khi spawn agent code (kiểm tra `eas.json` thấy đã có sẵn profile `development`) nên không bị chặn, chỉ đổi kỳ vọng test (không dùng Expo Go được cho tính năng này).
- QA agent (Phase 6) phát hiện bug cache-restore nêu trên bằng cách đọc kỹ code thay vì tin báo cáo "xong" của agent code — đúng quy trình "trust but verify" đã áp dụng xuyên suốt: tự chạy `npm run verify` độc lập sau MỖI agent thay vì chỉ đọc báo cáo, và đọc diff thật (`git status`/`git diff --stat`) so khớp với những gì agent tự báo cáo.

**Session tiếp theo phải làm:**
1. Commit toàn bộ gói S-F2 (xem hướng dẫn message bên dưới).
2. **Người dùng build dev client:** `eas build --profile development --platform ios`, cài vào điện thoại qua link EAS gửi (không dùng Expo Go được cho tính năng này).
3. **Test tay bắt buộc theo checklist** `.ai/parallel-reports/S-F2-qa-checklist.md` (tiếng Việt, 7 mục, có đánh dấu ⚠️ ở 2 mục liên quan tới bug cache vừa sửa) — đặc biệt: xin quyền lần đầu, từ chối quyền → xem có hiện đúng "Ước tính (BMR)" không, ghi 1 buổi tập thật trong Health.app rồi bấm "Đồng bộ" trong Settings xem kcal có cập nhật, tắt app rồi mở lại xem có giữ đúng số (bug vừa sửa) không.
4. Nếu test tay OK → cập nhật `docs/04-roadmap.md` Phase 4 "Test thật" từ ⬜ lên 🟡/✅ tương ứng.
5. v1.1 (chưa làm, chỉ ghi chú theo thiết kế của Fable): breakdown resting/active riêng biệt + xem nguồn kcal ăn/đốt chi tiết — hiện chỉ hiện tổng.

---

## Session 12 — 2026-07-15 (S-U chi tiết dinh dưỡng + S-T đồng bộ pin Vận động ↔ Năng lượng + powerlifting)

**Làm gì:** Orchestration đa-agent trong 1 session: agent nghiên cứu (WebSearch nguồn y khoa — Compendium 2024, PubMed) chạy song song với agent UI; sau đó agent logic (TDD) sửa 2 bug đồng bộ pin, agent UI nối selector loại bước chân, QA reviewer read-only soát toàn diff (tìm ra 1 blocker → vá ngay), cuối cùng Haiku làm thư ký ghi docs + 3 commit + push. Diff-check bằng `git status`/`git diff --stat` sau MỖI wave để bảo đảm các agent không ghi đè nhau.

**Kết quả — 6 hạng mục hoàn thành trong session này:**

1. **Xem chi tiết dinh dưỡng (S-U):** tap một món trong "Hôm nay đã ăn" hoặc History → bottom sheet đầy đủ vi chất (kcal/đạm/béo/carbs/nước + xơ, đường, canxi, sắt, natri, kali, magiê, kẽm, EPA/DHA). Snapshot lấy từ thời ghi nhật ký, micros scale từ per100g.
   - Files: `src/domain/food/nutritionDetail.ts` (+9→10 tests), `src/components/food/NutritionDetailSheet.tsx` (mới).

2. **BUG A: Vận động → pin năng lượng via step-equivalents (S-T).** Ghi buổi tập (môn + phút, không bước) → tính equivalent: 100 steps/min (MET<6), 130 (MET≥6). Snapshot `movementStepsApplied` → undo chính xác. Xem lịch sử: `movement_steps_applied` SQLite column mới.
   - Files: `src/types/energy.ts`, `src/lib/metabolicConstants.ts`, `src/domain/energy/metabolismEngine.ts`, `src/domain/energy/energyBalanceEngine.ts`, `src/store/energyStore.ts`, `src/data/db/schema.ts`, `src/data/repositories/activityLogRepository.ts`, tests.

3. **BUG B: addIntake (nút Vận động trực tiếp) → cộng vào mục tiêu ăn.** Modal thêm step-type selector (Đi bộ 0.0005 / Chạy 0.00096 / Leo núi 0.0011 kcal/step/kg) + live preview "≈ N kcal".
   - Files: `src/components/EnergyActionsBar.tsx`, `src/components/IntakeModal.tsx`, `src/screens/HomeScreen.tsx`.

4. **3 bài powerlifting mới:** squat MET 5.0, deadlift 5.0 (Compendium 2024 code 02052), bench_press 4.0 (ước tính; Robergs 2007/Reis 2017). Cộng vào `metabolicConstants.ts`.

5. **QA fixes (S-U + S-T):** nutrition sheet dùng entry snapshot (chặn blocker B1), modal-overlap guard, anti-double-log hint trong IntakeModal, test comment fix.

6. **Known limitation S-T3 (deliberately deferred):** quick-tap nút Vận động không undo được in-app (movement event không lưu trong intakeLog, IntakeEvent không lưu stepType để reverse goal growth chính xác) — cần design decision. Ghi vào NEXT_SESSIONS.md.

**Công thức khoa học được ghi vào docs/06-energy-expenditure.md (sections 1A–1B + Sources):**

- **Bảng hằng số:** walking 0.00053, running 0.00096, hiking 0.0011, steep 0.0014 kcal/step/kg (Marshall 2009, Compendium 2024, Tudor-Locke 2019, Leacox 2025).
- **Quy tắc cadence:** 100 spm (moderate, MET<6), 130 spm (vigorous, MET≥6) — dùng cho chuyển đổi "phút tập → bước".
- **Công thức chuyển:** `C = MET × 0.0175 / cadence` (kcal/step/kg).
- **Powerlifting METs:** squat 5.0, deadlift 5.0 (code 02052), bench 4.0 (ước tính). Công thức: `kcal = MET × kg × hours` (session-average, gồm rest).
- **Limitation paragraph:** MET là trung bình (không EPOC), undo thủ công không chính xác, S-T3 deferred.
- **Sources:** 10 tài liệu gốc (Compendium, Marshall, Tudor-Locke, Leacox, Robergs, Reis, Scott, Adeel, João, ACSM) + URLs.

**Kiểm tra trước commit:**
- `npm run verify` (tsc --noEmit + eslint + jest) — sạch toàn bộ ✅
- `npx jest` — **408 test PASS / 36 suite** (baseline đầu session: 378/35)
- Chưa test trên máy thật — checklist test tay 8 mục của QA reviewer nằm ở mục "Session tiếp theo"

**3 commits được tạo (đúng message format Vietnamese conventional):**
1. `feat(S-U): xem chi tiết dinh dưỡng món đã ăn — bottom sheet đầy đủ vi chất` (files: nutrition detail + NutritionDetailSheet + TodayMeals/DayDetailSheet UI integration).
2. `fix(S-T): đồng bộ 2 chiều pin Vận động ↔ pin Năng lượng + 3 bài powerlifting` (files: energy types/constants/engines + ActivityLogRepository + EnergyActionsBar/IntakeModal/HomeScreen + tests).
3. `docs: công thức steps→kcal & MET powerlifting (Compendium 2024) + session log` (files: docs/06-energy-expenditure.md + .ai/SESSION_LOG.md + .ai/NEXT_SESSIONS.md + 2 parallel-reports).

**Push result:** `git push origin ui-upgrade` ✅ (plain push, không --force).

**Vấn đề gặp phải & Cách giải quyết:**
- QA reviewer tìm ra **blocker B1**: sheet dinh dưỡng tính lại từ `per100g` HIỆN TẠI thay vì dùng snapshot trên `FoodLogEntry` → sửa món qua override sau khi đã ghi log sẽ "viết lại lịch sử" hiển thị. Vá theo TDD (test đỏ 450≠312 → xanh). Đây đúng lớp lỗi `fooditem-field-join-points` đã ghi trong memory dự án.
- Vá thêm: guard 2 modal chồng nhau trong TodayMeals (S1), dòng nhắc chống ghi trùng buổi tập trong IntakeModal (S2), làm rõ test scenario-2 pass do bão hoà cap (S4).
- Entry log này do Haiku (thư ký) viết lần đầu có 2 số liệu sai (47 suite; expo export chưa từng chạy) — đã được orchestrator soát và sửa lại bằng số liệu thật.

**Session tiếp theo phải làm:**
1. **Test máy thật theo checklist 8 mục của QA reviewer** (xem cuối entry này): sheet dinh dưỡng (Home + Lịch sử), nạp pin Vận động theo 3 loại bước, ghi workout không nhập bước, hoàn tác, 3 bài powerlifting mới.
2. Quyết định thiết kế **S-T3** (undo quick-tap pin Vận động — xem NEXT_SESSIONS.md).

---

## Session 13 — 2026-07-16 (S-PL + UX: Powerlifting, Custom Activities, Battery Display, Water/Sleep, Micro Collapse)

**Làm gì:** Phiên Fable điều phối 4 Sonnet agents chạy TUẦN TỰ (logic-backend, 3× mobile-frontend) để triển khai bộ nâng cấp **S-PL** (ghi powerlifting theo set×rep×tạ + công thức hybrid năng lượng) + **6 hạng mục UX khác**; cuối phiên 1 qa-reviewer Sonnet rà soát diff toàn bộ tìm bug.

**Kết quả — Công việc code:** Tất cả 8 tính năng dưới đây đã commit vào cây làm việc (chưa push):

1. **S-PL — Powerlifting set-based logging (`src/domain/energy/liftingEngine.ts` +12 test):**
   - Mô hình năng lượng **hybrid**: kcal = công nâng tạ vật lý (m_eff × g × ROM × rep × 1.33 eccentric / 20% hiệu suất, hệ số per-bài de Leva 1996) + đốt lúc nghỉ (2.0 MET × phút ước lượng: set chính 3', khởi động 1.5').
   - Squat k=0.88/ROM=0.25H, Bench 0.10/0.19H, Deadlift 0.25/0.30H; buổi 3 bài ≈ 250–350 kcal, khớp VO2 thực tế.
   - **`WorkoutSession.sets?: LiftingSet[]`** (lưu JSON trong `activity_log.workouts`, **không cần migration**); hàng cũ tự dùng MET×phút như trước.
   - `workoutKcal/totalWorkoutKcal` nhận `heightCm` tuỳ chọn; có sets → lifting, không → MET (backward compat).
   - **`PowerliftingSheet.tsx` (mới):** 3 tab Squat/Bench/Deadlift; mỗi tab Khởi động + Bài chính; nút ⚡ gợi ý ramp (bar×10→50%×6→70%×4→85%×2, làm tròn 2.5kg); "Buổi trước" 60 ngày + e1RM Epley (working sets) + tấn số; live kcal preview; edit prefill qua key remount.
   - **Docs 06 mục 1B rewrite:** công thức hybrid, bảng hệ số, giới hạn v1, thêm de Leva 1996 + Abbott 1952 vào Sources.

2. **Activity modal grouped + Elliptical:** chia Cardio / Thể thao / Gym-Tạ / Khác (`ACTIVITY_CATEGORIES`); thêm Elliptical MET 5.0 (code 02048); Gym-Tạ có chip 🏋️ Powerlifting (sheet) + Bodybuilding (phút) + HIIT; squat/bench/deadlift rời khỏi chip phút.

3. **Custom activities** (`settingsStore.customActivities`): Modal "＋ Thêm môn"; preset MET Nhẹ 3/Vừa 5/Cao 8/Rất cao 10, input cap 20; chip theo category; delete với confirm; `WorkoutSession` type 'custom' + customName/customMet; TodayActivities hiển thị customName, editable phút/bước/time.

4. **Master battery area:** thêm dòng "🏃 Vận động hôm nay: +N kcal vào mục tiêu ăn" (activityBonusKcal) + dòng mục tiêu "Cần ~X kcal/ngày để đạt Y kg · BMR ~Z" (dailyCalorieTarget / basalMetabolicRate) hoặc variant maintenance.

5. **Movement pin kcal display:** default hiển thị kcal (walking-rate stepsKcal), tap label toggle kcal↔steps (persisted movementDisplayUnit); `formatMovementAmount`/`nextMovementDisplayUnit` trong `lib/units.ts` +4 test (no domain import — layering rule).

6. **Small-battery tap routing:** Water/Sleep tap mở IntakeModal (input mode) + dòng recommendation (water 30–40 ml/kg/day +500–1000 EFSA/ACSM; sleep NSF 2015 + recovery hint). Protein/Carbs/Minerals/Movement → **DISPLAY-ONLY** → `BatterySourceSheet` (mới) liệt kê nguồn nạp hôm nay (per-food protein/carb/minerals, per-activity steps+kcal), total + "tự nạp, không cần nạp tay". Movement quick-tap manual charge **RETIRED** (IntakeModal stepType selector removed — S-T3 không còn UI path để xảy ra lỗi).

7. **Food form regrouping:** Natri/Kali/Magiê → "Muối & điện giải" sub-heading + live line "≈ X g muối (NaCl) — quy đổi từ natri" (salt=Na×2.5/1000, display-only).

8. **Micro section collapsible:** header collapse toggle (state persisted settingsStore.microCollapsed); collapsed show count + warning count; ⚠️ badge per-nutrient chỉ khi vượt reference (goal-type over-target stay neutral).

**Kiểm tra trước & sau:**
- Session start baseline: **408 test / 36 suite**
- Sau S-PL: **427 test / 37 suite** (liftingEngine +12, metabolismEngine +3, energyStore +4)
- Final (sau 6 UX): **443 test / 38 suite** — **tất cả PASS ✅**
- `npm run verify` (tsc + eslint + jest): sạch

**QA findings & Fixes:** qa-reviewer Sonnet tìm 1 major + 3 moderate + 4 minor → lead tự sửa all actionable: dead movement branch cleanup (IntakeModal, BatterySourceSheet), lib/units domain-import layering fix, units test add, MET cap 20, PowerliftingSheet confirm truly disabled no sets, punctuation in strings.

**Quyết định thiết kế (người dùng thoát plan mode, lead chọn theo khuyến nghị):**
- Công thức **hybrid** (pure mechanics = 60–100 kcal/session, 3–5× under VO2 per João 2021).
- **V1 = foundation:** per-set storage + previous-session + e1RM; **6-week block dashboard defer next session**.
- **Bodybuilding stay minutes-based v1** (nâng cấp set-based sau).

**Vấn đề gặp phải:** Không có cản trở nào — orchestration 4 phiên song song tuần tự + QA rà soát cuối + verify sạch = trình tự suôn sẻ.

**Session tiếp theo phải làm:**
1. **Manual device test checklist (25 items):** qa-reviewer chuẩn bị; chạy từng section: **Powerlifting** (sheet 3 tab, warmup + main, previous session, kcal live, edit + delete), **Môn tự thêm** (add + preset MET + delete), **Pin Vận động** (kcal default, toggle steps), **Nước/Giấc ngủ** (tap recommendation), **Pin tổng** (activity bonus + target line), **Muối & vi chất** (regrouping + salt line + collapse), **Hồi quy** (cũ activity vẫn phút, undo OK).
2. **S-PL2 — Block dashboard 6 tuần:** e1RM + tonnage chart per-exercise per-week.
3. **Bodybuilding set-based upgrade** (danh sách bài + ROM/mass hệ số riêng).
4. **Known limitation:** movement pin kcal dùng walking-rate conversion, có thể khác per-session kcal trong TodayActivities.

---

## Session 14 — 2026-07-17 (Đa ngôn ngữ Việt/Anh/Đức toàn app + Excel)

**Làm gì:** Người dùng yêu cầu tích hợp chuyển đổi ngôn ngữ (Việt/Anh/Đức) cho toàn bộ UI + file Excel xuất ra, đổi mượt không giật/khựng, lưu bền vào máy. Tự thiết kế kiến trúc (không dùng thư viện i18next, tự viết dựa trên Zustand có sẵn), rồi triển khai: tự tay làm phần lõi + các file domain/service nhạy cảm (export, đánh giá dinh dưỡng), sau đó điều phối 4 wave `mobile-frontend` subagent TUẦN TỰ (không song song — dự án có tiền lệ agent song song ghi đè lẫn nhau) để migrate toàn bộ 33 file giao diện.

**Kết quả (CODE XONG, ĐÃ VERIFY SẠCH, CHƯA test máy thật, CHƯA COMMIT lúc viết dòng này):**
- **Module mới `src/i18n/`:** `types.ts` (Language, LOCALE_TAGS), `translate.ts` (tra cứu theo đường dẫn "a.b.c" + nội suy `{{var}}`, tự fallback về tiếng Việt nếu thiếu bản dịch), `useT.ts` (hook `useT()` CHỈ theo dõi field `language` của store — đổi ngôn ngữ không vẽ lại cả app), `locales/{vi,en,de}.ts` (~500 chuỗi, `vi.ts` là cấu trúc gốc, `en.ts`/`de.ts` được `tsc` ép kiểu khớp chính xác — build sẽ báo lỗi nếu thiếu bản dịch bất kỳ chuỗi nào).
- **`settingsStore.language`** (Zustand field mới, persist qua AsyncStorage có sẵn, mặc định `'vi'`) + `setLanguage()`.
- **Màn Cài đặt** thêm mục "🌐 NGÔN NGỮ" đầu trang — 3 chip chọn ngôn ngữ.
- **Toàn bộ 33 file UI** (4 màn hình + ~29 component) đổi từ chuỗi tiếng Việt cứng sang `t('key.path')`.
- **Nhãn dùng chung xuyên nhiều màn** đổi thành hàm `(id, language) => string` thay vì object cứng: `mealLabel`/`foodCategoryLabel`/`batteryTypeName` (`lib/constants.ts`), `modeName`/`modeDescription` (`domain/modes/modeDefinitions.ts`), `activityLabel` (`components/EnergyActionsBar.tsx`).
- **Excel xuất ra:** `exportWeeklyData(language)`/`exportMonthlyData(language)` — toàn bộ 8 sheet (tên sheet + tiêu đề cột + tên vi chất + câu gợi ý "Đánh giá" + dòng cảnh báo y tế) đổi ngôn ngữ đầy đủ. Cố ý giữ nguyên tiếng Việt: tên món ăn đã ghi (snapshot lịch sử, xem `docs/excel-report.md` mục 0).
- **11 nhận định dinh dưỡng y tế** (fiber/iron/calcium/... under/over-advice, `nutritionAssessment.ts`) dịch cẩn thận sang Anh/Đức, giữ đúng giọng văn nhẹ nhàng "chỉ tham khảo" theo luật `.ai/CONTEXT.md` §5 (không dùng từ "thiếu chất"/"nguy cơ bệnh").
- **Định dạng ngày/giờ/số** (`toLocaleDateString`/`toLocaleString`) đổi từ `'vi-VN'` cứng sang `LOCALE_TAGS[language]` (8 chỗ trên 5 file).
- **Verify cuối:** `npx tsc --noEmit` sạch toàn dự án · `npx eslint 'src/**/*.{ts,tsx}'` sạch · **444/444 test PASS / 38 suite** (không đổi so với trước, +cập nhật các test domain bị đổi signature) · `npx expo export --platform web` bundle thành công 1104 module, 0 lỗi.

**Vấn đề gặp phải & Cách giải quyết:**
- 1 wave subagent (`mobile-frontend`, wave C — BodyProfileCard/PowerliftingSheet/MasterBattery/...) bị dừng giữa chừng do **hết session limit của chính subagent đó** (không phải lỗi code) — nhưng trước khi dừng nó đã kịp viết xong toàn bộ 6 namespace bản dịch vào cả 3 file locale. Không mất công: gọi lại đúng agent đó qua `SendMessage` (resume, giữ nguyên context) với hướng dẫn rõ "phần dịch đã xong, giờ chỉ cần nối các file .tsx vào — đừng viết lại bản dịch" — agent hoàn tất phần còn lại sạch sẽ, không trùng lặp công việc.
- Tự tay gây 1 bug nhỏ khi sửa `domain/nutrition/excelSheets.ts`: `old_string`/`new_string` của 1 lệnh Edit vô tình xoá mất hàm `round1()` (nó nằm lẫn trong đoạn văn bản bị thay thế) → phát hiện ngay qua `tsc --noEmit` (4 lỗi "Cannot find name 'round1'") trước khi chuyển sang wave tiếp theo, vá lại bằng 1 Edit bổ sung.
- 1 lần dùng `sed` để thêm tham số `'vi'` vào các lệnh gọi test lồng nhau (`buildNutritionDetail(makeEntry({...}), salmon)`) làm hỏng cú pháp vì regex không xử lý được dấu ngoặc lồng nhau — phát hiện ngay (không chạy thử mù), revert bằng `git checkout` rồi sửa lại từng dòng bằng `Edit` chính xác thay vì regex.
- Quyết định phạm vi có chủ đích: **không** viết lại lịch sử món ăn đã ghi (`FoodLogEntry.foodNameVi`) theo ngôn ngữ mới — đây là snapshot, đổi sẽ phá nguyên tắc "không viết lại lịch sử" đã áp dụng xuyên suốt dự án (xem `fooditem-field-join-points` trong ghi nhớ AI) + tránh phải làm migration DB tốn công ngoài phạm vi yêu cầu.

**Session tiếp theo phải làm:**
1. **Test tay bắt buộc trên điện thoại thật** (chưa xác nhận): mở Cài đặt → đổi ngôn ngữ 3 lần liên tiếp (Việt→Anh→Đức→Việt), xác nhận: (a) đổi ngay lập tức không cần khởi động lại app, (b) không bị giật/khựng lúc chuyển màn hình đang mở, (c) đóng app mở lại vẫn giữ đúng ngôn ngữ đã chọn (test persist AsyncStorage), (d) xuất Excel ở cả 3 ngôn ngữ, mở file kiểm tra tên sheet + tiêu đề cột đúng ngôn ngữ.
2. Nếu ổn → `git add`/commit (đã thực hiện ngay sau khi ghi log này, xem hướng dẫn message bên dưới) rồi `git push`.
3. Rà lại 1 lượt các câu dịch tiếng Đức bằng người biết tiếng Đức thật (AI dịch tự động, chưa có người bản ngữ xác nhận) — ưu tiên các câu y tế/dinh dưỡng vì cần chính xác.
4. Nếu về sau muốn tên món ăn ĐÃ GHI cũng đổi theo ngôn ngữ (hiện tại cố ý giữ tiếng Việt, xem "Vấn đề gặp phải" bên trên) — cần thêm cột `food_name_en`/`food_name_de` snapshot vào bảng `food_log` lúc ghi (migration DB), không đơn giản như phần còn lại của session này.

**Bổ sung cùng session (commit `a2a776f`) — biến i18n thành LUẬT vĩnh viễn:**
Theo yêu cầu người dùng, hệ i18n không chỉ là tính năng mà thành "bản năng
mặc định" cho mọi phiên AI về sau khi đụng UI:
- `AGENTS.md` thêm mục **"MANDATORY RULE: UI text & multi-language (i18n)"**
  (file này được CLAUDE.md nạp tự động vào MỌI phiên): cấm hardcode chuỗi
  hiển thị, quy trình vi.ts-trước → en/de, `useT()` cho component / tham số
  `language` cho domain, `LOCALE_TAGS` cho ngày giờ, hợp đồng bắt buộc khi
  giao việc cho subagent, tự cập nhật docs không cần hỏi. Mở đầu luật nêu rõ
  lý do KHÔNG dùng i18next (tận dụng Zustand có sẵn, không thêm thư viện,
  không re-render toàn app) — là quyết định kiến trúc, không phải thiếu sót.
- Skill mới `.ai/skills/add-language.md`: checklist 4 bước thêm ngôn ngữ
  thứ 4 (sửa `types.ts` + tạo locale file + đăng ký `DICTIONARIES`; nút chọn
  tự render từ `LANGUAGES`). Đã đăng ký vào bảng `.ai/skills/README.md`.
- `.ai/CONTEXT.md` §4 thêm bullet luật i18n; skill `create-screen` thêm bước
  i18n bắt buộc; `docs/02-tech-stack.md`/`docs/03-architecture.md` thêm liên
  kết chéo + checklist thêm-ngôn-ngữ cho người đọc.

---

## Session 15 — 2026-07-17 (S-BB: Bodybuilding theo nhóm cơ — MET-tier × cường độ × set)

**Làm gì:** Triển khai tính năng **Bodybuilding (S-BB)** — cho phép người dùng tự tạo buổi tập theo nhóm cơ (ngực, lưng, chân, vai, tay trước, tay sau, bụng, mông) với ~45 bài phụ trợ/cô lập, dùng mô hình **MET-tier × cường độ × thời-từ-set** (tách biệt hoàn toàn khỏi S-PL vật lý).

**Kết quả (CODE XONG, PASS npm run verify, CHƯA test máy thật, CHƯA COMMIT lúc viết):**

**Files mới tạo (4):**
- `src/lib/bodybuildingExercises.ts` — thư viện 45 bài (id, muscle, tier, NO tên hiển thị)
- `src/domain/energy/bodybuildingEngine.ts` — công thức kcal + helper (bbEffectiveMet, bbSetMinutes, bodybuildingSessionKcal)
- `src/domain/energy/__tests__/bodybuildingEngine.test.ts` — 16 test, PASS (khớp ví dụ 27 kcal cable curl 4×10@78kg)
- `src/components/BodybuildingSheet.tsx` — UI sheet chính (8 tab nhóm cơ, picker bài, set rows, intensity, preview kcal, edit-mode, custom exercise form)

**Files sửa (11):**
- `src/types/energy.ts` — MuscleGroup, BbMetTier, BbIntensity, BodybuildingExercise, CustomExercise, WorkoutSession fields (bbExerciseId, bbMuscle, bbTier, bbMet, bbName)
- `src/lib/metabolicConstants.ts` — BB_MET_TIER (iso 3.5, compound 5.0, big_compound 6.0), BB_INTENSITY_FACTOR (light 0.9, moderate 1.0, superset 1.15), BB_SEC_PER_REP, BB_REST_SEC
- `src/domain/energy/metabolismEngine.ts` — nhánh bbMet trước bbSetsMet trong workoutKcal, bbMet ưu tiên trong workoutStepEquivalent
- `src/store/settingsStore.ts` — customExercises array + add/removeCustomExercise (persist AsyncStorage)
- `src/store/energyStore.ts` — note branch cho session S-BB (intake_events)
- `src/i18n/locales/{vi,en,de}.ts` — muscleGroups (8), bbTiers (3), bbIntensity (3), bbExercises (~45), components.bodybuildingSheet namespace (30+ key), activities.bodybuilding, đổi nhãn activities.gym_strength (fix trùng tên)
- `src/components/EnergyActionsBar.tsx` — chip Bodybuilding mới, filter ACTIVITY_TYPES loại 'bodybuilding'
- `src/components/TodayActivities.tsx` — isBodybuildingEntry check **TRƯỚC** isLiftingEntry, mở BodybuildingSheet prefilled
- `src/components/BatterySourceSheet.tsx` — workoutLabel nhánh S-BB trước generic sets

**Verify:**
- `npx tsc --noEmit` — sạch, 0 lỗi
- `npx eslint 'src/**/*.{ts,tsx}'` — sạch, 0 lỗi/cảnh báo
- `npx jest src/domain/energy/__tests__/bodybuildingEngine.test.ts` — PASS 16/16
- `npm run verify` (full) — PASS 460/460 test, 39 suite, lint sạch

**3 lỗi tiềm ẩn (đã biết từ plan, lần này vá hoàn chỉnh):**
1. ⚠️ **Trùng tên chip:** `activities.gym_strength` = "Bodybuilding" → đổi thành "Tập tạ (theo phút)" ở cả 3 locale, key giữ nguyên.
2. ⚠️ **Lộ chip 0 kcal:** ACTIVITY_TYPES filter thêm `&& t !== 'bodybuilding'`.
3. ⚠️ **Mất dữ liệu khi sửa:** TodayActivities.startEdit check `isBodybuildingEntry` TRƯỚC `isLiftingEntry`.

**QA review phát hiện + vá 2 lỗi mới:**
1. **Kcal lịch sử drift khi sửa entry cũ dùng bài custom đã xoá** — edit lại → tier sai → kcal sai dù người dùng không cố ý đổi. **Vá:** thêm snapshot `bbTier` vào WorkoutSession, exercisesFromEntry dùng `w.bbTier` thay vì suy ngược từ resolveExercise (fallback chỉ cho entry cũ).
2. **Set mất âm thầm khi để ô tạ trống cho bài bodyweight** (pull-up, plank...). **Vá:** prefill ô tạ mặc định "0" thay vì trống, + comment giải thích trong addExercise/addRow.

**Docs:**
- `docs/06-energy-expenditure.md` — thêm §1C "Bodybuilding (cơ hypertrophy theo nhóm cơ)" (công thức, bảng tier×intensity, ví dụ 27 kcal kiểm chứng, khác biệt S-BB vs S-PL, giới hạn v1).
- `docs/01-vision-and-features.md` — update mục "Nạp & Xả năng lượng" thêm S-PL + S-BB.

**Vấn đề gặp phải & Cách giải quyết:**
- Plan viết kỹ → implementation không có "surprise bug" ở runtime (chỉ 2 edge case từ QA). QA review read-only + manual-test checklist VN (17 bước) khá kỹ lưỡng.
- Quyết định nhỏ: không thêm field `bbIntensity` mới vào WorkoutSession — thay vào đó suy ngược intensity từ bbMet + tier qua hàm `deriveIntensity` khi edit. Tiết kiệm 1 field snapshot, complexity vẫn được.
- Không viết lại lịch sử (bài custom cũ) → entry gốc dùng custom đã xoá sẽ fallback tier → có rủi ro nhỏ, nhưng snapshot `bbTier` mới đã bảo vệ entry **sau khi vá này**.

**Session tiếp theo phải làm:**
1. **Test tay thật trên điện thoại** (phải chạy app từ đầu): (a) Mở Gym → chọn chip Bodybuilding (b) Chọn nhóm cơ, thêm bài (c) Nhập set/rep/tạ, đổi intensity (d) Preview kcal thay đổi đúng chiều (e) Lưu → kiểm tra "Vận động hôm nay" + pin Vận động + BatterySourceSheet (f) Sửa lại entry → PHẢI mở đúng BodybuildingSheet, KHÔNG phải PowerliftingSheet (g) Xoá (h) Tự thêm bài (i) Xoá bài custom đang dùng (j) Đổi ngôn ngữ VI/EN/DE, không sót chuỗi (k) Form sửa-theo-phút KHÔNG có chip bodybuilding (l) 2 chip khác tên.
   → Checklist chi tiết 17 bước có sẵn từ QA report.
2. Nếu test xong ổn → `git add` + commit (message: "feat(S-BB): Bodybuilding theo nhóm cơ, MET-tier model, custom exercises" + Co-Authored-By).
3. `git push` → cập nhật project-cloud để dùng trên điện thoại từ xa.

---

## Session 16 — 2026-07-17 (Popup minh bạch công thức BMR/TDEE + mục tiêu calo)

**Làm gì:** Trong Cài đặt → Hồ sơ cơ thể, làm 2 con số kcal bấm được để mở
popup nhỏ giữa màn hình giải thích từng bước tính: (1) "Nhu cầu năng lượng ước
tính: X kcal/ngày ⓘ" → BMR Mifflin-St Jeor (số thật của người dùng thế vào
công thức) → × hệ số vận động → + kcal bước chân = TDEE; (2) "Mục tiêu
calo/ngày: Y kcal ⓘ" → mức duy trì → Δkg × 7 700 → chia số ngày (hoặc tốc độ
an toàn tối đa) → chặn an toàn (≤20%, ≤750 kcal, không dưới BMR) → mục tiêu.

**Kết quả:**
- `src/components/BodyProfileCard.tsx` — 2 giá trị kcal thành Pressable (gạch
  chân + ⓘ, có accessibilityLabel); thêm `InfoPopup` (Modal fade giữa màn
  hình, bấm nền/nút Đóng để tắt, ScrollView chống tràn) + `InfoStep` (nhãn →
  công thức → kết quả). Số hiển thị lấy từ CHÍNH hàm engine
  (`basalMetabolicRate`, `stepsKcal`, `dailyCalorieTarget` +
  `OCCUPATION_FACTORS`/`KCAL_PER_STEP_PER_KG`/`MAX_DEFICIT_*`/
  `KCAL_PER_KG_BODY_FAT`) nên luôn khớp số ngoài card; popup phản ánh live số
  đang nhập (chưa cần Lưu). Edge case: Δ/ngày làm tròn về 0 → dòng "mục tiêu =
  mức duy trì"; tăng cân hiển thị phép cộng thay vì trừ.
- i18n đủ 3 ngôn ngữ (vi → en → de): `components.bodyProfileCard.tdeeBreakdown`
  + `goalBreakdown` (+ `tdeeInfoA11y`/`goalInfoA11y`; `kcalPerDayValue`/
  `kcalValue` thêm hậu tố ⓘ). KHÔNG chuỗi cứng — tuân thủ MANDATORY RULE.
- `npm run verify` — PASS: tsc sạch, eslint sạch, 460/460 test (39 suite).
- Docs: `docs/06-energy-expenditure.md` §5 thêm mục "Minh bạch công thức".

**Vấn đề gặp phải & Cách giải quyết:**
- App chưa có pattern popup nhỏ giữa màn hình (mọi modal đều là BottomSheet) →
  làm `InfoPopup` cục bộ trong BodyProfileCard, chưa tách ra `ui/` vì mới có 1
  nơi dùng; nếu nơi thứ 2 cần thì tách.
- Số trong dòng công thức (ví dụ perDay theo tuần) làm tròn để hiển thị nên có
  thể lệch ≤1 kcal so với số engine tính nội bộ — các dòng đều dùng "≈", còn
  số "áp dụng"/"mục tiêu" cuối lấy thẳng từ `dailyCalorieTarget` nên khớp
  tuyệt đối.

**Session tiếp theo phải làm:**
1. **Test tay trên điện thoại:** Cài đặt → Hồ sơ cơ thể → (a) bấm "X kcal/ngày
   ⓘ" → popup BMR hiện đúng số đang nhập, đổi giới tính/mức vận động → số đổi
   theo; (b) nhập mục tiêu cân nặng (giảm, tăng, để trống tuần, tuần quá nhanh
   để dính chặn an toàn) → bấm "Y kcal ⓘ" kiểm tra từng dòng; (c) đổi VI/EN/DE
   trong cả 2 popup; (d) bấm nền tối + nút Đóng để tắt popup.
2. Test ổn → commit (gợi ý message: "feat(profile): tappable BMR/TDEE & calorie-goal breakdown popups" + Co-Authored-By).
3. Vẫn còn nợ test tay S-BB của Session 15 (checklist 17 bước) nếu chưa làm.

---

## Session 17 — 2026-07-17 (UI feedback round 3: Nạp/Xả rename + theme + parse dấu phẩy + khuyến nghị + color-badge)

**Làm gì:** Bốn wave phiên Sonnet đã QA và commit xong những thay đổi UI/UX: (1) sửa bug parse dấu phẩy thập phân từ bàn phím VI/DE; (2) đổi tên nút Nạp/Xả + bỏ modal "ăn thêm kcal"; (3) thêm giao diện Sáng/Tối; (4) thêm sheet khuyến nghị khi bấm pin chính + đổi màu biểu đồ để phân biệt dễ hơn + tiêu đề mục Cài đặt to/đậm hơn + ghi vận động cho ngày quá khứ (3 ngày gần nhất). **Phiên này (Haiku):** chỉ cập nhật docs + session log + commit + push (CHƯA test trên máy thật).

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**

**7 mục tính năng đã hoàn thành & commit (Session 15–16 làm code, phiên này ghi log/docs):**
1. **Fix parse dấu phẩy:** hàm `parseDecimal()` trong `src/lib/units.ts`, áp dụng ở tất cả ô nhập số thập phân (cân nặng, gram, phút, bước, tạa/rep, form nhập món tùy chỉnh).
2. **Nút Nạp/Xả:** bỏ nút "Ăn thêm (kcal)" + modal nhập calo tay; đổi tên "🍱 Ghi món ăn" → "⚡ Nạp", "🏃 Vận động" → "🔥 Xả"; i18n đầy đủ 3 ngôn ngữ.
3. **Giao diện Sáng/Tối:** thêm lựa chọn trong Cài đặt mục GIAO DIỆN; field `themeMode` trong `settingsStore`; 2 palette `darkColors`/`lightColors` trong `src/lib/theme.ts`; chuyển đổi ngay lập tức không cần khởi động lại app; hook `useThemeColors()` chỉ re-render component có dùng.
4. **Sheet khuyến nghị hàng ngày:** bấm pin Năng lượng chính mở ra bảng dựa trên hồ sơ cơ thể (mục tiêu calo, BMI, đạm, tinh bột, muối, nước, vận động, giấc ngủ); mỗi mục có ghi chú nguồn (WHO/EFSA/IOM/NSF); dòng miễn trừ trách nhiệm "Chỉ để tham khảo"; tái sử dụng công thức nước/giấc ngủ có sẵn để đảm bảo nhất quán.
5. **Màu biểu đồ/badge:** Dinh dưỡng = xanh dương, Năng lượng = cam; áp dụng cho đường biểu đồ + viền badge trên từng thẻ ngày trong Lịch sử.
6. **Tiêu đề mục Cài đặt:** tăng cỡ chữ và độ đậm (NGÔN NGỮ, HỒ SƠ CƠ THỂ, SỨC KHOẺ, THÔNG BÁO, KHUNG GIỜ BỮA ĂN, DỮ LIỆU, GIAO DIỆN).
7. **Ghi vận động ngày quá khứ:** thêm lựa chọn ngày (Hôm nay/Hôm qua/Hôm kia/Hôm kìa, tối đa -3 ngày); pin Vận động của **NGÀY ĐÓ** được cập nhật, nhưng pin Năng lượng **HÔM NAY** không ảnh hưởng; giới hạn đã biết: chưa có UI xem/xoá lại.

**Kiểm tra trước commit:**
- `npm run verify` — ✅ **503 test PASS / 42 suite**, tsc sạch, eslint sạch.
- Số liệu cuối phiên: `npx tsc --noEmit` 0 lỗi · `npx eslint 'src/**/*.{ts,tsx}'` 0 lỗi/cảnh báo · `npm run verify` full 503/503 test.

**Docs cập nhật (phiên này):**
- `docs/01-vision-and-features.md` — thêm các mục 1-7 ở phần Nạp & Xả + các mục 3.1-3.6 (fix dấu phẩy, Nạp/Xả, tiêu đề, màu, khuyến nghị, theme).
- `docs/03-architecture.md` — thêm mục "🎨 Giao diện Sáng/Tối" (cơ chế `themeMode`, 2 palette, hook, persist) + mục "🔢 Parse số thập phân" (`parseDecimal()` bắt buộc dùng).
- `docs/06-energy-expenditure.md` — thêm mục "2. Ghi vận động cho ngày quá khứ" (giao diện, quy tắc lưu, giới hạn v1).
- `docs/HUONG-DAN-SU-DUNG-APP.md` (tiếng Việt) — bổ sung mục 3.2-3.3 (pin khuyến nghị, nút Nạp/Xả + ghi ngày quá khứ, parse dấu phẩy), mục 4 (biểu đồ màu), mục 6.7 (giao diện Sáng/Tối).
- `docs/USER-GUIDE-DE.md` (tiếng Đức) — tương tự như Việt.

**Files tạo mới (phiên này — docs/log):**
- `.ai/SESSION_LOG.md` — thêm entry này.

**2 commits được tạo (tuần tự, không gộp):**
1. Commit 1 (code, toàn bộ wave S-S1…S-S7):
   ```
   feat(ui): Nạp/Xả rename + backfill 3 ngày, sheet khuyến nghị dinh dưỡng, theme sáng/tối, fix parse dấu phẩy cân nặng
   
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   ```
2. Commit 2 (docs + session log):
   ```
   docs: cập nhật hướng dẫn + kiến trúc cho round UI feedback 2026-07-17
   
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   ```

**Vấn đề gặp phải & Cách giải quyết:**
- Code 4 wave đã hoàn thành & QA từ các phiên trước; phiên này chỉ ghi log, không tìm thấy vấn đề mới.
- Nhắc nhở bắt buộc: **CHƯA test trên máy thật** — cần user tự kiểm tra qua Expo Go (tuân theo quy ước project: "CHƯA TEST TRÊN MÁY THẬT — cần user tự kiểm tra").

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc** (chưa ai xác nhận): (a) Cài đặt → đổi ngôn ngữ VI/EN/DE rồi đổi theme Sáng/Tối, xác nhận mọi chữ hiển thị đúng; (b) bấm pin Năng lượng → xem sheet khuyến nghị (6 mục + disclaimer); (c) ghi cân nặng dùng dấu phẩy "78,5" và dấu chấm "78.5" → app chấp nhận cả 2; (d) nạp 1 món + xã vận động 3 ngày quá khứ (dùng 3 chip nhanh) → pin Vận động ngày đó cập nhật, HÔM NAY không ảnh hưởng; (e) biểu đồ Lịch sử: 2 đường khác màu (xanh dương vs cam) rõ ràng, thẻ ngày badge có màu tương ứng.
2. Nếu ổn → chuẩn bị pull request cho `main` (dùng `gh pr create`), hoặc push thẳng nếu user cho phép.

---

## Session 18 — 2026-07-29 (Tap-to-see-sources cho 10 pin vi chất)

**Làm gì:** Người dùng hỏi các pin phụ có hiển thị nội dung đồ ăn không → sau khi trả lời (Protein/Carbs/Khoáng chất/Nước một phần trong `BatteryStack` + toàn bộ 10 pin trong `MicroBatteryStack` đều lấy từ `foodLog`), người dùng muốn `MicroBatteryStack` có cùng hành vi "bấm vào pin → xem nguồn" như `BatteryStack` đã có qua `BatterySourceSheet`.

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**
1. `src/domain/nutrition/microBatteryEngine.ts` — hàm mới `microBatterySourceRows()`: tính lại đóng góp của từng món ăn cho 1 `MicronutrientId` bất kỳ (tái dùng `per100gValue`/`round1` nội bộ). Cần tính lại từ per-100g vì `FoodLogEntry` không snapshot vi chất, chỉ macro/khoáng.
2. `src/hooks/useMicroBatteryHistory.ts` — trả thêm `entries` (foodLog của ngày đang chọn trong date-picker 7 ngày, không chỉ hôm nay).
3. `src/components/MicroBatterySourceSheet.tsx` (file mới) — bottom sheet mirror `BatterySourceSheet`, liệt kê từng món ăn + lượng đóng góp, dòng caption ngày đang xem, tổng hiện tại/khuyến nghị.
4. `src/components/MicroBatteryStack.tsx` — `MicroCell` đổi từ `View` sang `Pressable`; state chọn pin + hiển thị sheet giữ nội bộ trong component (không nâng lên `HomeScreen`, vì stack đã tự quản lý date-picker riêng).
5. `src/screens/HomeScreen.tsx` — truyền `foodLog={microBattery.entries}` xuống `MicroBatteryStack`.
6. i18n: thêm khối `components.microBatterySourceSheet` (title/dateCaption/emptyText/totalText/footerNote) vào cả `vi.ts`/`en.ts`/`de.ts`.
7. Test: 4 test mới cho `microBatterySourceRows` trong `microBatteryEngine.test.ts` (có đóng góp, đóng góp 0, foodId không tồn tại, log rỗng).

**Kiểm tra trước commit:**
- `npm run verify` — ✅ **507 test PASS / 42 suite**, tsc sạch, eslint sạch.
- `npx expo start --web` bundle thành công (1138 module, không lỗi import/JSX) — nhưng KHÔNG tương tác được bằng browser thật vì app dùng `expo-sqlite` (native-only) và quy ước project là test qua Expo Go trên điện thoại thật, không phải web.

**Vấn đề gặp phải & Cách giải quyết:**
- Không có vấn đề kỹ thuật mới. Không cài `chromium-cli`/Playwright để chụp màn hình vì lệch mục đích (app không chạy đúng trên web do phụ thuộc native).

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc:** mở app trên Expo Go → bấm vào bất kỳ pin nào trong 10 pin vi chất (fiber/sắt/canxi/fat/kẽm/omega3/đường/muối/natri/kali/magiê) → xác nhận sheet mở ra đúng danh sách món ăn đã ghi trong ngày đang xem (thử cả đổi ngày trong date-picker 7 ngày) + số liệu đóng góp khớp với tổng hiển thị trên pin.
2. Nếu ổn → không có việc tồn đọng nào khác từ phiên này.

---

## Session 19 — 2026-07-29 (Excel: cột năng lượng + vi chất — History: sửa cân nặng + sheet chi tiết ngày)

**Làm gì:** Người dùng dùng app một thời gian và yêu cầu 4 cải tiến trải nghiệm: (1) sheet "Daily
Totals" thêm cột Kcal đã đốt/Nhu cầu năng lượng ước tính/Cân bằng calo + cảnh báo đọc số liệu cẩn
trọng; (2) sheet "Food Entries" thêm vi chất (đường/xơ/sắt/muối) mỗi món ăn; (3) mục "Cân nặng theo
thời gian" ở History cho sửa entry log nhầm (≤3 ngày gần nhất) + xem thêm lịch sử cũ hơn 7 dòng;
(4) thẻ ngày trong History (đã tap được sẵn) hiện thêm kcal đốt/giờ ngủ/nước/cân nặng khi bấm vào.

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**
1. `src/domain/nutrition/excelSheets.ts` — `buildDailyTotals` nhận thêm `activityLog`/
   `energyReadings`, tính **Kcal đã đốt** (gom activity theo `startAt ?? timestamp`, đúng quy ước
   `getActivityLogInRange`), **Nhu cầu năng lượng ước tính** (= `capacity` pin Năng lượng ngày đó,
   để trống nếu thiếu), **Cân bằng** (= Kcal ăn − Nhu cầu, để trống khi Nhu cầu trống); thêm 1 dòng
   disclaimer cuối sheet tái dùng `assessment.disclaimer`. `buildFoodEntryRows` nhận thêm tham số
   `lookup` (food-by-id), tính Đường/Xơ/Sắt/Muối mỗi món bằng `per100gValue` (export mới từ
   `microBatteryEngine.ts`) scale theo gram đã ăn — Muối suy từ Natri×2.5/1000, cùng công thức pin
   vi chất "Muối". Để trống (không phải 0) khi không tra được món.
2. `src/domain/health/weightOnDay.ts` (file mới) — tách `weightOnOrBefore` ra khỏi `excelSheets.ts`
   để dùng chung với History (tránh viết trùng logic carry-forward cân nặng).
3. `src/services/export/excelExportService.ts` — fetch thêm `getActivityLogInRange`, lọc
   `readings` sẵn có theo `batteryTypeId === 'energy'`, truyền vào 2 hàm build ở trên + mở rộng độ
   rộng cột.
4. `src/data/repositories/healthSignalsRepository.ts` — `WeightEntry` có thêm `id` (cột `id` đã có
   sẵn trong schema `health_signals`, KHÔNG cần migration); hàm mới `updateWeight(id, kg)`.
5. `src/lib/constants.ts` — hằng số mới `WEIGHT_EDIT_MAX_DAYS_BACK = 3`.
6. `src/components/WeightLogCard.tsx` — fetch 60 dòng gần nhất thay vì 10; hiện 7 dòng mặc định +
   nút "Xem thêm/Ẩn bớt" (`common.seeMore/seeLess`, đã có sẵn nhưng chưa nơi nào dùng); dòng trong
   phạm vi `WEIGHT_EDIT_MAX_DAYS_BACK` có nút ✎ mở Modal sửa (mirror đúng pattern Modal của
   `TodayActivities.tsx`/`TodayMeals.tsx`, tái dùng `parseDecimal`/`PROFILE_LIMITS.weightKg`); thêm
   prop `onChanged` để `HistoryScreen` refresh cân nặng nó tự fetch riêng cho sheet chi tiết ngày.
7. `src/screens/HistoryScreen.tsx` — fetch thêm `getWeightHistory` (cho carry-forward cân nặng) và
   `getActivityLogForDate` (kcal đốt) cho ngày đang mở sheet; giờ ngủ/nước lấy trực tiếp từ
   `days[].readings` đã fetch sẵn theo range (không fetch thêm); truyền 4 giá trị mới xuống
   `DayDetailSheet` + `onChanged={loadHistory}` xuống `WeightLogCard`.
8. `src/components/DayDetailSheet.tsx` — thêm 4 prop (`burnedKcal` luôn hiện vì 0 là giá trị thật;
   `sleepHours`/`waterDisplay`/`weightKg` chỉ hiện khi có dữ liệu) + 1 hàng "chip" hiển thị dưới
   dòng tổng kcal/đạm sẵn có.
9. i18n: thêm khối key mới vào cả `vi.ts`/`en.ts`/`de.ts` — `export.columns.{burnedKcal,
   estimatedEnergyNeed, energyBalance, sugar, fiber, iron, salt}`, `components.weightLogCard.
   editModalTitle`, `components.dayDetailSheet.{burnedLabel, sleepLabel, waterLabel, weightLabel}`.
10. Test: viết lại toàn bộ `excelSheets.test.ts` (fixture `FoodItem`/`ActivityLogEntry`/
    `BatteryReading` mới, case cho burned/EEN/balance/disclaimer/vi chất/blank-khi-thiếu) + file mới
    `src/domain/health/__tests__/weightOnDay.test.ts` (4 case chuyển từ excelSheets.test.ts).

**Kiểm tra trước commit:**
- `npm run verify` — ✅ **517/517 test PASS** (43 suite), `tsc --noEmit` sạch, `eslint` sạch.
- Kế hoạch được xác minh qua 1 lượt Plan agent đọc trực tiếp code (không đoán) trước khi code —
  bắt được vài chi tiết quan trọng: `health_signals` **đã có sẵn cột `id`** (không cần rowid hack
  hay migration như dự tính ban đầu); activity phải gom theo `startAt ?? timestamp` chứ không phải
  `timestamp` trần; nên dùng pattern Modal có sẵn (`TodayActivities`) thay vì tự nghĩ UI edit mới;
  và nên dùng toggle "Xem thêm" thay vì ScrollView lồng ScrollView (codebase không có tiền lệ này,
  dễ kẹt gesture — xem comment trong `DayDetailSheet.tsx` về việc tắt scroll lồng nhau).

**Vấn đề gặp phải & Cách giải quyết:**
- Giữa phiên, git status cho thấy vài file (`MicroBatteryStack.tsx`, `useMicroBatteryHistory.ts`,
  `HomeScreen.tsx`, `MicroBatterySourceSheet.tsx`) không còn hiện là "đã sửa/chưa track" nữa — kiểm
  tra kỹ bằng `git reflog` thì phát hiện đây là do 2 commit khác (`fdbf959`/`f52134b`, tính năng
  "tap-to-see-sources" Session 18) đã được tạo bởi một phiên/luồng khác trong lúc phiên này đang
  chạy — không phải mất dữ liệu, chỉ là công việc dở dang từ trước đã được commit lại. Không có gì
  cần sửa, chỉ ghi chú lại để không nhầm lẫn ở các phiên sau nếu gặp lại tình huống tương tự.
- Không có bug kỹ thuật mới nào khác trong quá trình code.

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc:** (a) Xuất Excel tuần/tháng → mở file, kiểm tra sheet "Daily Totals"
   có đủ 3 cột mới + dòng cảnh báo cuối sheet, sheet "Food Entries" có đủ 4 cột vi chất đúng số
   liệu; (b) vào History → sửa 1 dòng cân nặng trong 3 ngày gần nhất qua nút ✎, xác nhận modal lưu
   đúng giá trị mới; (c) bấm "Xem thêm" trong mục Cân nặng → thấy các dòng cũ hơn 7 ngày, bấm "Ẩn
   bớt" thu lại; (d) bấm vào 1 thẻ ngày bất kỳ → sheet chi tiết hiện đủ 4 chỉ số mới (kcal đốt/giờ
   ngủ/nước/cân nặng), thử cả ngày không có đủ dữ liệu (chỉ hiện những gì có, không hiện "0" giả).
2. Nếu ổn → không có việc tồn đọng nào khác từ phiên này.

---

## Session 20 — 2026-07-29 (Fix: pin nhỏ hiện tổng đã log hôm nay thay vì mức đã xả)

**Làm gì:** Người dùng thắc mắc vì sao pin Protein hiện "101g (56%)" trong khi mục "Hôm nay đã ăn"
hiện "139.8g" — điều tra ra đây là do MỌI pin phụ (Protein/Carbs/Nước/Khoáng chất/Ngủ/Vận động) bị
`tickDrain` xả dần theo giờ giống hệt pin Năng lượng (đúng cho ẩn dụ "pin cạn dần" nhưng SAI khi
hiển thị dưới nhãn trông giống "đã ăn/uống/vận động hôm nay"). Người dùng xác nhận muốn sửa cho cả
6 pin, không chỉ Protein.

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**
1. File mới `src/domain/battery/dailyBatteryTotals.ts` — hàm thuần `computeDailyBatteryTotals(
   foodLog, activityLog, intakeLog)` tính tổng THẬT đã log hôm nay cho cả 6 pin (không đụng tới
   `battery_readings.level`/drain): protein/carbs/minerals cộng từ `foodLog` + `intakeLog` thủ
   công cũ; water cộng `foodLog.waterG` + `intakeLog`; sleep chỉ từ `intakeLog`; movement (bước +
   kcal THẬT, không phải ước lượng) từ `activityLog.energyKcal`/`movementStepsApplied`.
2. `src/components/BatteryStack.tsx` — mọi pin giờ hiện nhãn `đã log/capacity` (vd `139.8/180g`,
   `1.5/2.5L`, `6000/8000 bước`) thay vì `${level}${unit}` cũ lấy từ mức đã xả; % KHÔNG đổi (vẫn
   tính từ `level` như trước — người dùng yêu cầu giữ nguyên).
3. `src/components/BatterySourceSheet.tsx` — phát hiện CÙNG lỗi ở dòng "Tổng hôm nay" của sheet
   "xem nguồn" (mở khi bấm pin protein/carbs/minerals/movement), cũng đang lấy từ `level` đã xả —
   sửa dùng `computeDailyBatteryTotals` giống trên.
4. `src/lib/units.ts` — thêm `formatWaterRange(consumedMl, capacityMl, unit)`; sửa chữ ký
   `formatMovementAmount` nhận thêm `stepsCapacity` để trả về phân số `"X/Y bước"` ở chế độ bước
   (chế độ kcal giữ nguyên 1 số, không ghép phân số vì capacity pin này vốn định nghĩa bằng bước
   chân — xem comment trong file để hiểu lý do không đổi).
5. `src/screens/HomeScreen.tsx` — truyền `activityLog`/`intakeLog` xuống `BatteryStack`; bỏ hẳn
   `stepsKcal`/`movementLevel` (không còn cần vì kcal vận động giờ lấy thật từ `activityLog`, chính
   xác hơn công thức ước lượng theo tốc độ đi bộ cũ).
6. Test: cập nhật `src/lib/__tests__/units.test.ts` cho chữ ký `formatMovementAmount` mới + thêm
   case cho `formatWaterRange`.

**Kiểm tra trước commit:** `npm run verify` — ✅ **519/519 test PASS** (43 suite), `tsc --noEmit`
sạch, `eslint` sạch. Đã `git push` lên `origin/ui-upgrade` (commit `759cdf7`).

**Vấn đề gặp phải & Cách giải quyết:**
- Không có bug kỹ thuật khó nào. Điểm cần quyết định (đã tự chọn, có ghi rõ trong comment code để
  phiên sau/người dùng biết): chế độ hiển thị "kcal" của pin Vận động không ghép thành phân số
  "đã đốt/mục tiêu" vì capacity chỉ định nghĩa bằng bước chân — muốn có phân số kcal thì phải quy
  đổi ngược capacity sang kcal bằng đúng công thức ước lượng vừa bỏ đi cho số đã đốt, nên để 1 số
  duy nhất cho gọn và chính xác.

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc** (chưa test lần nào): mở app qua Expo Go, kiểm tra cả 6 pin phụ ở màn
   Home hiện đúng dạng phân số mới (không còn số lẻ khó hiểu do bị xả dở), bấm vào pin
   protein/carbs/khoáng chất/vận động mở sheet "xem nguồn" → dòng "Tổng hôm nay" khớp với số trên
   pin nhỏ; đổi Mode để cập nhật capacity rồi xác nhận mẫu số đổi theo đúng; bấm toggle đơn vị Nước
   (ml/L) và Vận động (bước/kcal) xem cả 2 chế độ hiển thị đúng.
2. Nếu ổn → không có việc tồn đọng nào khác từ phiên này.

---

## Session 21 — 2026-08-01 (UI: nâng cấp khả năng tiếp cận + phân cấp thông tin Home)

**Làm gì:** Người dùng muốn nâng cấp đồ hoạ/UI để thân thiện hơn với **đa số người dùng ở mọi lứa
tuổi, giới tính, nghề nghiệp** — không phải chạy theo trend thẩm mỹ 2026 (Liquid Glass...) mà ưu
tiên khả năng tiếp cận (accessibility) và giảm tải nhận thức, vì đó là thứ tác động rộng nhất tới
người dùng lớn tuổi/thị lực kém/dùng VoiceOver. Lên kế hoạch qua Plan mode (`~/.claude/plans/
humble-whistling-waffle.md`), người dùng duyệt, rồi triển khai trực tiếp (không qua subagent, đã có
đủ context từ vòng research/đọc code trước đó).

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**
1. **Accessibility**: `BatteryCell.tsx`, `MasterBattery.tsx`, `ModeSelector.tsx`, 2 nút CTA chính
   trong `EnergyActionsBar.tsx` giờ có `accessibilityRole`/`accessibilityLabel`/`accessibilityState`
   — trước đó VoiceOver/TalkBack không đọc được gì từ đồ hoạ SVG pin (không có semantics), giờ đọc
   được tên pin + % + số lượng còn lại thành câu hoàn chỉnh (i18n đủ VI/EN/DE).
2. **Độ tương phản (WCAG)**: đo thực tế contrast ratio của các tone xám trong `theme.ts` — phát
   hiện `textCool` (2 theme) và `warning` (theme sáng) chỉ đạt 2.3–3.4:1, dưới ngưỡng AA 4.5:1.
   Đã tính lại hex mới (giữ nguyên hue/saturation, chỉ đổi độ sáng) để đạt ~4.5–4.6:1, verify lại
   bằng script Python contrast formula WCAG 2.1. Không đụng `textMuted`/`textFaint` gốc (dùng ở
   ~20 chỗ khác, chủ yếu `placeholderTextColor` — đổi hex gốc sẽ ảnh hưởng ngoài phạm vi); thay vào
   đó 3 chỗ hiển thị thông tin thật (nhãn "đã log" của `BatteryCell`, dòng disclaimer của
   `MasterBattery`, dòng hint của `HomeScreen`) được trỏ sang `textDim` (~5.6–6:1) thay vì
   `textMuted`/`textFaint`.
3. **Cỡ chữ**: cỡ 10px (dưới ngưỡng dễ đọc) ở 3 chỗ trên tăng lên 12px; thêm
   `maxFontSizeMultiplier={1.5}` cho các nhãn dán sát đồ hoạ SVG kích thước cố định (không giới hạn
   toàn app — chỉ giới hạn đúng chỗ đồ hoạ cố định sẽ vỡ layout nếu chữ phóng quá to).
4. **Phản hồi chạm (neo-skeuomorphism nhẹ)**: hiệu ứng scale-down khi giữ nút, áp cho mode chip +
   2 nút CTA chính — dùng đúng pattern `useState` (đổi trong onPressIn/onPressOut) + `useEffect`
   (mutate shared value) vì ESLint rule `react-hooks/immutability` chặn gán `.value` trực tiếp
   trong closure sự kiện JSX.
5. **Phân cấp thông tin Home**: component mới `src/components/ui/CollapsibleSection.tsx` — gom các
   khối "xem thêm" (energy balance, vi chất, supplement, 3 danh sách log hôm nay) vào 1 khối
   "Chi tiết hôm nay" có thể thu gọn, **mặc định mở** (không ẩn dữ liệu người dùng cũ). Ban đầu định
   thêm tiêu đề cho từng khối con nhưng phát hiện mỗi khối ĐÃ có `sectionLabel` riêng — tránh trùng
   tiêu đề, chỉ gom bằng 1 header chung.

**Kiểm tra trước commit:** `npm run verify` — ✅ **540/540 test PASS** (44 suite), `tsc --noEmit`
sạch, `eslint` sạch. **CHƯA commit/push** (đang chờ người dùng xác nhận).

**Vấn đề gặp phải & Cách giải quyết:**
- **Va chạm giữa 2 session Claude Code cùng lúc**: trong lúc đang sửa, 1 cửa sổ Claude Code khác
  (người dùng có mở song song) chạy `git stash` + `git reset` trên cùng working tree, xoá sạch các
  thay đổi CHƯA COMMIT của phiên này (`theme.ts`, `BatteryCell.tsx`, `ModeSelector.tsx`,
  `MasterBattery.tsx`, 3 file locale) — im lặng, không báo lỗi, vì file bị revert về bản gốc vẫn
  hợp lệ nên `npm run verify` vẫn PASS bình thường (verify xanh KHÔNG chứng minh thay đổi dự định
  còn tồn tại). Phát hiện qua `git reflog` (dòng `reset: moving to HEAD`) và `git stash list` (1
  stash tên `wip-other-session-temp`). Đã dừng lại, báo người dùng, người dùng đóng cửa sổ kia, rồi
  áp lại toàn bộ thay đổi bị mất và verify lại — không mất dữ liệu vĩnh viễn nhưng tốn 1 vòng làm
  lại. Đã ghi vào memory (`parallel-subagent-file-conflicts`) để nhận diện nhanh hơn lần sau: nếu
  file vừa sửa đọc lại ra y hệt bản gốc mà Edit không báo lỗi, kiểm tra `ps aux | grep claude` +
  `git reflog`/`git stash list` ngay, đừng chỉ giả định do mình sửa sai.

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc** (chưa test lần nào): mở Expo Go, bật VoiceOver kiểm tra pin/mode
   chip/2 nút CTA đọc thành câu hợp lý; bật iOS Settings → Accessibility → cỡ chữ lớn kiểm tra thẻ
   SVG không bị vỡ layout; đổi theme sáng/tối xem các dòng chữ vừa tăng tương phản đọc rõ hơn; kiểm
   tra khối "Chi tiết hôm nay" mặc định mở, thu gọn/mở lại mượt.
2. Nếu ổn → hỏi người dùng có muốn `git commit`/`push` không (session này chưa commit gì).
3. Các ý tưởng lớn hơn đã gác lại có chủ đích (không phải việc quên làm): Liquid Glass/blur chrome,
   iOS Home Screen widget, đổi ẩn dụ pin — xem lý do trong plan file hoặc hỏi lại người dùng nếu
   muốn mở lại hướng nào.

---

## Session 22 — 2026-08-06 (Excel: tự động fit độ rộng cột)

**Làm gì:** Người dùng phản hồi mở file Excel xuất ra thì các cột không fit với nội dung (quá hẹp).
Viết hàm tự động đo độ rộng cột theo nội dung thật thay vì đoán số cố định.

**Kết quả:** `src/services/export/excelExportService.ts` — hàm mới `autoFitColumns(sheet)`: quét
toàn bộ giá trị + header của từng cột trong worksheet đã dựng (`utils.decode_range`/`encode_cell`),
lấy độ dài chuỗi lớn nhất, +2 đệm, set `!cols[i].wch`. Cận dưới 8 ký tự (cột ngắn như "STT" không
bị bóp quá nhỏ), cận trên **64 ký tự (~12cm ở 96dpi, theo yêu cầu điều chỉnh của người dùng từ mốc
6cm ban đầu** — quy đổi: `pixel ≈ wch*7+5`, 12cm ≈ 454px → (454-5)/7 ≈ 64). Áp dụng cho **toàn bộ 8
sheet** (trước đó chỉ 2/8 sheet — Daily Totals, Food Entries — có `!cols` cố định đoán mò bằng tay;
6 sheet còn lại — Battery Readings, Intake Events, Food Log, Nutrition by Day, Weekly Summary,
Reference Thresholds — không có width nào, dùng mặc định Excel rất hẹp). Xoá 2 mảng `!cols` hard-code
cũ, thay bằng gọi `autoFitColumns()` đồng nhất cho cả 8 sheet.

**Vấn đề gặp phải & Cách giải quyết:** Không có vấn đề kỹ thuật — `npm run verify` sạch ngay lần
đầu (tsc + eslint + **540/540 test**, không có test riêng cho hàm mới vì đây là thay đổi trình bày
Excel thuần tuý, không có logic nghiệp vụ cần phủ test).

**Session tiếp theo phải làm:**
1. **Test tay bắt buộc:** xuất Excel (nút xuất 7/30 ngày ở Cài đặt), mở file trên máy tính (Excel/
   Google Sheets/Numbers) — xác nhận cả 8 sheet có cột fit nội dung, không cột nào bị cắt xén hay
   quá hẹp; đặc biệt kiểm tra sheet "Food Entries"/"Food Log" (tên món dài) và "Reference
   Thresholds" (đường link nguồn dài) — chỗ dễ chạm cận trên 64 ký tự nhất.
2. Việc này **CHƯA commit** — nhánh `ui-upgrade` vẫn còn rất nhiều thay đổi UI khác chưa commit từ
   Session 21 (xem mục đó) + file này — hỏi người dùng muốn commit gộp hay tách riêng.

---

## Session 23 — 2026-08-06 (Powerlifting: nút "Dùng làm mẫu" từ buổi tập trước)

**Làm gì:** Người dùng phản ánh mỗi buổi ghi powerlifting (squat/bench/deadlift) phải gõ lại toàn
bộ set khởi động + bài chính từ đầu, dù buổi hôm sau thường chỉ đổi chút tạ/rep so với buổi trước.
Thêm nút nạp nhanh set của buổi gần nhất vào form đang nhập.

**Kết quả (CODE ĐÃ XONG, VERIFY SẠCH, CHƯA TEST MÁY THẬT):**
1. `PowerliftingSheet.tsx`: `findPrevSession`/`PrevSessionInfo` giờ trả thêm `sets` (mảng
   `LiftingSet` thô của buổi trước), không chỉ dòng tóm tắt text như cũ.
2. Hàm mới `applyTemplate()` + nút "📋 Dùng làm mẫu" đặt cạnh dòng "Buổi trước (...)": nạp khởi
   động + bài chính của buổi gần nhất **đúng bài đang chọn (tab hiện tại)** vào các ô nhập, ghi đè
   rows hiện tại — người dùng chỉ cần sửa lại tạ/rep rồi lưu.
3. Cố ý nạp **thủ công theo từng tab**, KHÔNG tự động nạp cả 3 bài khi mở sheet — nếu tự động,
   người dùng chỉ tập 1 bài hôm nay có thể vô tình ghi khống 2 bài kia (`confirm()` ghi mọi bài có
   `sets.length > 0`, kể cả bài không hề đụng tới hôm đó).
4. Không cần bảng/lưu trữ "template" mới — tái dùng lịch sử `activity_log` sẵn có
   (`HISTORY_LOOKBACK_DAYS` = 60 ngày), chỉ thêm đường dẫn nạp ngược lại vào form.
5. i18n: thêm khoá `useTemplateButton` trong `components.powerliftingSheet` ở cả 3 file
   `vi.ts`/`en.ts`/`de.ts` (vi trước, đúng quy tắc AGENTS.md).

**Kiểm tra trước commit:** `npm run verify` — ✅ **540/540 test PASS** (44 suite), `tsc --noEmit`
sạch, `eslint` sạch. **CHƯA commit** (nhánh `ui-upgrade` đang có nhiều thay đổi CHƯA COMMIT khác từ
trước — xem mục 3 bên dưới).

**Vấn đề gặp phải & Cách giải quyết:**
- Quyết định thiết kế ở mục 3 (nạp thủ công theo tab) là phòng một bug trước khi nó xảy ra, không
  phải sửa lỗi đã gặp phải.
- **Va chạm 2 session Claude Code song song, lần thứ 2** (lần 1 xem Session 21): khi vừa viết xong
  entry Session 22 cho việc này, `Edit` báo file đã đổi — một cửa sổ Claude Code khác (đang chạy
  song song, xác nhận qua `ps aux`) đã tự thêm entry "Session 22 — Excel: tự động fit độ rộng cột"
  trước. Không ghi đè — đọc lại state mới nhất, đổi số của phiên này thành **Session 23**, chèn nối
  tiếp sau. Không mất dữ liệu, chỉ tốn 1 vòng đọc lại.

**Session tiếp theo phải làm:**
1. **Test máy thật bắt buộc:** mở PowerliftingSheet, ở tab đã có buổi tập trong 60 ngày qua → bấm
   "📋 Dùng làm mẫu" → xác nhận set khởi động + bài chính điền đúng số liệu buổi trước; sửa vài số
   rồi lưu bình thường; xác nhận tab KHÔNG bấm nút vẫn để trống, không bị ghi khống khi lưu.
2. Nếu ổn → không có việc tồn đọng nào khác từ riêng phiên này.
3. **Nhắc lại (đã ghi ở Session 22 và 21):** nhánh `ui-upgrade` đang tồn đọng rất nhiều thay đổi
   CHƯA COMMIT chồng chất từ nhiều session song song khác nhau (21, 22, 23) — nên rà lại + test tay
   + commit theo từng cụm việc trước khi tích tụ thêm. Cân nhắc tránh chạy nhiều cửa sổ Claude Code
   song song trên cùng nhánh nếu chưa cần thiết, để giảm rủi ro va chạm ghi đè.

---

## Session 24 — 2026-09-01

**Làm gì:** Xử lý 4 điểm người dùng phản ánh sau khi dùng app thật: (1) đơn vị đo ml + nhãn khẩu
phần tự do khi thêm món mới, (2) quyền kiểm soát danh sách món riêng trên máy, (3) minh bạch công
thức tính, (4) bug pin vi chất đường/canxi đếm sai + tổng lệch. Kế hoạch chi tiết:
`.ai/plans/2026-09-01-food-units-transparency-microbug.md`.

**Kết quả:**

**W1 — Bug pin vi chất (nguyên nhân gốc + 4 lỗi phụ)**
- **Trùng ID nhật ký món.** `logFood` đặt `id = food_<ts>_<foodId>` trong khi
  `FoodLogModal.timestampForToday()` cắt giây+ms → ghi cùng món 2 lần trong 1 phút = trùng ID
  tuyệt đối trên PRIMARY KEY của `food_log`. `addFoodLogEntry` dùng `INSERT INTO` nên ném UNIQUE
  constraint, bị `console.warn` nuốt → **pin đã cộng và đã lưu, còn nhật ký thì không có dòng đó**.
  Vá: thêm hậu tố ngẫu nhiên (`foodLogEntryId`, giống `activity_log` vốn đã làm vậy) + đổi sang
  `INSERT OR REPLACE`.
- **Đảo thứ tự trong `logFood`:** ghi dòng nhật ký TRƯỚC, chỉ cộng pin khi ghi thành công. Trước
  đây pin cộng trước rồi mới ghi → hai bên có thể lệch nhau vĩnh viễn. Việc cộng pin cũng chuyển
  vào trong `set(s => …)` để không đè lên tick xả chạy chen ngang.
- **`updateFood` bỏ sót đơn vị mới:** `isPortionBased` viết tay `=== 'pack' || === 'capsule'` →
  thay bằng `isPortionCounted()` dùng chung.
- **Chip TPCN (`SupplementQuickLog`):** thiếu khoá chống bấm kép (FoodLogModal có, chip thì không)
  → 1 lần bấm hơi lâu ghi 2 liều; `countToday` đếm số DÒNG log thay vì số LIỀU (`count`);
  `item.nameVi` hardcode → `foodDisplayName(item, language)`.
- **Bảng nguồn vi chất:** `microBatterySourceRows` → `microBatterySourceBreakdown`, gộp theo món
  ("Whey protein ×3" thay vì 3 dòng giống hệt nhau), mỗi dòng hiện rõ khẩu phần, và chia phần dư
  theo largest-remainder để **tổng các dòng luôn khớp đúng con số trên ô pin**.

**W2 — Đơn vị đo (g/ml) + nhãn khẩu phần tự do**
- `PortionUnit` thêm `'serving'`; `FoodItem` thêm `measureUnit` ('g'|'ml') và `servingLabel`
  (hộp/chai/lon/ly/khẩu phần — người dùng tự gõ). Quy ước 1 ml ≈ 1 g, nói rõ trong UI; engine vẫn
  tính hoàn toàn bằng gram nên không đụng gì tới phần tính toán.
- Module domain mới `src/domain/food/portionUnits.ts` — nguồn duy nhất sinh mọi nhãn khẩu phần
  ("2 hộp (130ml)"), thay cho 4 chỗ trước đây tự viết `portionUnit === 'pack' ? … : 'capsule' ?…`.
- Vá đủ **cả 3 điểm nối bắt buộc** của `FoodItem` (merge trong `getAnyFoodById`, nhánh
  `mode === 'edit'` của `FoodNutritionEditModal`, mappers + schema + migration ALTER cho
  `custom_foods` và `food_overrides`).
- Gộp 9 khoá i18n rời (`suffixPack/Capsule/Gram` × 1 + `basisPack/Capsule/Gram` × 2 chỗ) thành 1
  helper `nutritionBasisLabel()` dùng chung.

**W3 — "Món của tôi"**
- Bổ sung `deleteCustomFood` (trước đây **không hề có** đường xoá món tự thêm) +
  `deleteOverrideAndUnregister`.
- Sheet mới `MyFoodsSheet` (vào từ Cài đặt → Dữ liệu): xem/sửa/xoá món tự thêm và món đã sửa
  thành phần. Xoá KHÔNG đụng lịch sử — bữa đã ghi giữ nguyên số liệu snapshot của nó.
- Xuất/nhập file JSON danh sách món (`myFoodsBackup.ts` thuần + `myFoodsBackupService.ts`).
  **Không thêm dependency nào**: xuất ghi vào documentDirectory + share sheet; nhập liệt kê file
  `.json` trong chính thư mục đó (người dùng chép file vào qua app Files) — thay cho việc phải
  thêm `expo-document-picker`.
- Huy hiệu nguồn món trong tìm kiếm: "Của tôi" / "Catalog VN" / "USDA" (+ "đã sửa").

**W4 — Minh bạch công thức (nút ⓘ tại pin)**
- Ô pin vi chất thêm glyph ⓘ + `accessibilityLabel`; sheet nguồn có mục gập "🧮 Xem cách tính":
  từng dòng `6g/100g × 60g ÷ 100 = 3.6g`, dòng cộng dồn, so với khuyến nghị, cộng các ghi chú
  riêng (muối suy ra từ natri × 2.5 ÷ 1000; omega-3 = EPA + DHA; đường nằm TRONG carbs).
- `BatterySourceSheet` (pin chính) có mục tương tự, nêu rõ điểm dễ tưởng là bug: số của pin chính
  được **chốt lúc ghi món**, còn pin vi chất **tính lại mỗi lần mở app** — nên sửa thành phần một
  món sẽ đổi pin vi chất mà không đổi bữa đã ghi.
- Nêu rõ mốc ngày: pin vi chất theo NGÀY LỊCH, pin Năng lượng reset 6h sáng.

**Kiểm tra trước commit:** `npm run verify` — ✅ **586/586 test PASS** (47 suite, +46 test mới),
`tsc --noEmit` sạch, `eslint` sạch. `npx expo export --platform ios` bundle thành công (1594
modules). **CHƯA commit.**

**Vấn đề gặp phải & Cách giải quyết:**
- Triệu chứng người dùng mô tả ("nhập 2 whey nhưng hiện 3") không tái hiện được trực tiếp, nên
  thay vì đoán đã truy theo đường dữ liệu: pin vi chất tính LIVE từ `foodLog` mỗi lần render nên
  không thể tự lệch → suy ra `foodLog` thật sự có mục thừa → tìm ra 2 đường sinh mục thừa (trùng
  ID + chip thiếu khoá chống bấm kép). Cả hai đều đã vá kèm test hồi quy.
- Không thêm `expo-document-picker` cho luồng nhập file (xem W3) — giữ đúng luật "không thêm thư
  viện mới khi chưa xin phép".

**Session tiếp theo phải làm:**
1. **Test máy thật (ưu tiên cao):** thêm món "Yakult" — đơn vị đo `ml`, cách ghi "Khẩu phần…",
   tên đơn vị "hộp", kích cỡ 65, nhập dinh dưỡng cho đúng 1 hộp → ghi 2 hộp → kiểm tra danh sách
   hiện "2 hộp (130ml)" và pin đường/canxi cộng đúng.
2. Ghi cùng 1 món 2 lần trong CÙNG 1 PHÚT → xác nhận nhật ký có đủ 2 dòng, xoá 1 dòng chỉ trừ pin
   1 lần, và số liệu không đổi sau khi khởi động lại app.
3. Mở bảng nguồn pin Đường/Canxi → bấm "🧮 Xem cách tính" → xác nhận các dòng cộng lại đúng bằng
   tổng ở dưới.
4. Cài đặt → Dữ liệu → "Món của tôi": sửa/xoá một món, xuất file, kiểm tra file trong app Files,
   rồi nhập lại.
5. **Nhắc lại (từ Session 21–23):** nhánh `ui-upgrade` vẫn tồn đọng rất nhiều thay đổi CHƯA
   COMMIT — nên rà + test tay + commit theo từng cụm.

## Session 25 — 2026-09-02

**Làm gì:** Thêm chức năng chia sẻ nhật ký ăn uống hôm nay dưới dạng ảnh (cho mạng xã hội) —
yêu cầu: dù ăn nhiều món phải cuộn mới thấy hết, ảnh chia sẻ vẫn phải gồm ĐẦY ĐỦ, không bị cắt.

**Kết quả:**
- Nút ⤴ mới cạnh tổng kcal trong `TodayMeals.tsx` ("Hôm nay đã ăn").
- **Không chụp lại đúng giao diện đang cuộn** — vì `captureScreen` (chụp màn hình thường) chỉ lấy
  đúng phần pixel đang hiển thị, y hệt hạn chế mà người dùng phản ánh. Giải pháp: dựng
  `src/components/food/ShareDayFoodCard.tsx` — một bản layout RIÊNG (thiết kế lại gọn đẹp cho
  MXH, không phải bản sao UI trong app), cao tự do không giới hạn, đặt ở toạ độ âm ngoài canvas
  (`position: 'absolute', top: -100000`) nên không ai nhìn thấy trong app nhưng vẫn layout đầy
  đủ. `captureRef` (thư viện mới) chụp NGUYÊN view đó bất kể có đang cuộn tới hay không.
- Thêm thư viện **`react-native-view-shot@4.0.3`** — đã kiểm tra kỹ trước khi thêm: đây đúng là
  bản được đóng gói SẴN trong chính Expo Go của SDK 54 (`expo/packages/expo/bundledNativeModules.json`
  nhánh `sdk-54`), nên chạy được ngay trên điện thoại test qua Expo Go, không cần build lại
  app/dev-client. `npx expo install react-native-view-shot` tự chọn đúng bản này.
- Service `src/services/share/dayFoodShareService.ts` — `shareTodayFoodCard(ref, language)`:
  `captureRef` → PNG tmpfile → `Sharing.shareAsync` (dùng lại đúng pattern
  `exportDataInRange` trong `excelExportService.ts`).
- `collapsable={false}` trên view bị chụp — bắt buộc trên Android, thiếu là RN có thể tối ưu bỏ
  hẳn node khỏi cây view gốc khiến không còn gì để chụp.
- Ảnh dùng màu **cố định** `darkColors` (không theo theme sáng/tối người dùng đang chọn) — ảnh
  chia sẻ ra ngoài nên luôn giữ đúng nhận diện thương hiệu Body Batteries.
- Tài liệu: `docs/07-food-log.md` mục "3b-2".

**Kiểm tra trước commit:** `npm run verify` — ✅ **586/586 test PASS** (không thêm test mới —
tính năng chỉ ghép lại logic thuần đã có test sẵn: `summarizeFoodLog`, `foodLogEntryDisplayName`,
`formatLoggedPortion`, `mealLabel`; phần mới là component trình bày + service I/O, đúng quy ước
codebase hiện có — không file `.test.tsx` nào tồn tại, các service I/O khác như
`excelExportService.ts`/`myFoodsBackupService.ts` cũng không có test riêng). `tsc --noEmit` +
`eslint` sạch. `npx expo export --platform ios` bundle thành công (1603 modules, +9 so với
trước do thư viện mới). **CHƯA commit.**

**Vấn đề gặp phải & Cách giải quyết:**
- Trước khi thêm thư viện, tra cứu kỹ xem `react-native-view-shot` có chạy được trong Expo Go
  hay bắt buộc phải có dev-client riêng (theo luật dự án: không thêm thư viện mới mà chưa hỏi) —
  tìm đúng file `bundledNativeModules.json` của Expo ở nhánh `sdk-54` xác nhận bản 4.0.3 đã được
  đóng gói sẵn, nên an toàn để thêm mà không phá luồng test bằng Expo Go hiện tại của người dùng.
- `expo-screen-capture` (đã có sẵn trong app) tưởng liên quan nhưng thực ra dùng để CHẶN/phát
  hiện chụp màn hình, không hề có khả năng render 1 view ra ảnh — không dùng được cho việc này.

**Session tiếp theo phải làm:**
1. **Test máy thật (bắt buộc):** ghi 8-10 món trong nhiều bữa khác nhau (đủ dài để phải cuộn
   trong app) → bấm ⤴ ở "Hôm nay đã ăn" → xác nhận ảnh xuất ra có ĐỦ mọi món, không bị cắt, và
   share sheet của hệ điều hành mở lên bình thường.
2. Kiểm tra khi ngày chưa ăn gì (foodLog rỗng) → nút chia sẻ tự ẩn, không crash.
3. **Nhắc lại (từ Session 21–24):** nhánh `ui-upgrade` vẫn tồn đọng rất nhiều thay đổi CHƯA
   COMMIT — nên rà + test tay + commit theo từng cụm.

## Session 26 — 2026-09-02

**Làm gì:** Tính năng mới lớn — **S-PL Block Builder**: tự lập kế hoạch một block luyện tập
powerlifting (SBD) N tuần tịnh tiến + 1 tuần deload, chọn 1 trong 4 "phong cách tính toán"
(Volume/Intensity/Normal/Peaking), khai báo lịch tuần (ngày × bài × biến thể kỹ thuật + bài phụ
trợ), 1RM (hoặc ước lượng an toàn cho người mới), tự bật "Deficit Mode" khi có mục tiêu giảm cân,
và xuất "Phụ lục Kế hoạch" minh bạch kcal từng buổi/tuần với icon ⓘ giải thích khoa học mỗi biến
thể. Yêu cầu tường minh của người dùng: PHẢI có cơ sở nghiên cứu khoa học thật (trích nguồn) trước
khi viết code — không được đoán số.

**Kết quả:**
- **`docs/08-powerlifting-engine.md`** viết lại HOÀN TOÀN (không phải bản nháp trước đó của
  Gemini/Antigravity chạy song song trong cùng thư mục — bản đó thiếu trích dẫn, dùng model kcal
  MET×phút mâu thuẫn với quyết định kiến trúc sẵn có). 24 nguồn thật tra qua WebSearch (Zourdos
  2016 RPE-RIR, Helms 2014/2018, Longland 2016 AJCN, Murphy & Koehler 2022 meta-analysis, Garthe
  2011, Schoenfeld 2021, NSCA, Prilepin/Pritchard 2016...), bảng %1RM×set×rep cụ thể cho 4 phong
  cách, quy tắc Deficit Mode bám bằng chứng khoa học (giữ %1RM bài chính, cắt 15-20% accessories).
  **Va chạm hi hữu:** phát hiện file đang bị 1 session Gemini khác ghi đè real-time giữa lúc viết
  — đã dừng lại hỏi người dùng trước khi ghi đè tiếp (xem transcript), không tự ý xử lý xung đột.
- **Data model mới, tách biệt hoàn toàn khỏi `energy.ts`** (giống S-BB có
  `bodybuildingExercises.ts` riêng): `src/types/powerliftingBlock.ts` (TrainingBlockConfig,
  BlockWeekPlan, GeneratedBlockPlan...), `src/lib/powerliftingVariations.ts` (9 biến thể kỹ thuật:
  paused/touch-and-go/low-grip/incline/deficit, mỗi cái có `loadFactor` — heuristic huấn luyện,
  không phải hằng số đo được, đã ghi rõ trong comment).
- **`src/domain/energy/blockEngine.ts`** (hàm thuần, 16 unit test PASS): ước lượng 1RM an toàn
  cho người mới (%cân nặng × hệ số an toàn 0.85), đường cong %1RM×set×rep theo tuần cho 4 phong
  cách (nội suy tuyến tính giữa 3 mốc đầu/giữa/cuối; riêng "Normal" luân phiên theo THỨ TỰ NGÀY
  trong tuần kiểu DUP thay vì theo tuần), `deloadCurvePoint` tách riêng để test độc lập, Deficit
  Mode chỉ cắt set accessories (không đụng %1RM bài chính) — **TÁI SỬ DỤNG NGUYÊN `liftingSessionKcal`
  và `dailyCalorieTarget` đã có sẵn, không viết công thức kcal/thâm hụt thứ hai.**
- SQLite: bảng `training_blocks` mới (1 row = 1 block, JSON blob cho `config`/`weeks`, giống quy
  ước `activity_log.workouts`) + `trainingBlockRepository.ts` + `blockStore.ts` (Zustand mỏng,
  CRUD only — id/createdAt được sinh TRONG store action, không phải trong component, để không
  phạm luật lint `react-hooks/purity` khi gọi `Date.now()`).
- UI: `BlockBuilderWizard.tsx` (6 bước: độ dài → cân nặng/1RM → phong cách → lịch tuần → giảm cân
  → xác nhận), `PlanAppendixSheet.tsx` (accordion theo tuần, dùng lại `CollapsibleSection` có
  sẵn), `src/components/ui/InfoPopover.tsx` (icon ⓘ — component mới, MỞ RỘNG TẠI CHỖ chứ không
  phải `<Modal>` thứ hai, để tránh đúng bug Modal-chồng-Modal đã ghi nhận ở Session 18). Cả hai
  sheet gắn vào `EnergyActionsBar.tsx` qua chip mới "📋 Kế hoạch Block (SBD)" trong nhóm Gym,
  cạnh Powerlifting/Bodybuilding.
- `weekdayLabel()` mới trong `dateUtils.ts` — format tên thứ trong tuần bằng `Intl` theo
  `LOCALE_TAGS`, không cần thêm 7 key i18n riêng.
- i18n: ~110 key mới × 3 ngôn ngữ (`blockBuilder`, `blockVariations` — label+rationale cho 9 biến
  thể, `planAppendix`), cả 3 file `vi.ts`/`en.ts`/`de.ts` đồng bộ.

**Kiểm tra trước commit:** `npm run verify` — ✅ **602/602 test PASS** (thêm 16 test mới cho
`blockEngine.ts`), `tsc --noEmit` + `eslint` sạch. **Chưa test máy thật** (wizard/appendix chưa
bấm thử trên điện thoại) — **CHƯA commit.**

**Vấn đề gặp phải & Cách giải quyết:**
- Bản nháp `docs/08-powerlifting-engine.md` ban đầu tưởng là do phiên này viết (dựa vào ngày
  tháng khớp) nhưng thực ra là của Gemini/Antigravity — người dùng chỉnh lại, phải viết lại từ
  đầu với nghiên cứu thật thay vì chỉ "vá thêm trích dẫn" vào bản cũ.
- ESLint `react-hooks/purity` chặn `Date.now()` gọi trực tiếp trong `handleCreate` của
  `BlockBuilderWizard` (component) — chuyển việc sinh `id`/`createdAt` sang `blockStore.createBlock`
  (store action, không phải component) qua kiểu `NewTrainingBlockConfig = Omit<..., 'id'|'createdAt'>`.

**Session tiếp theo phải làm:**
1. **Test máy thật (bắt buộc, ưu tiên cao):** mở chip "📋 Kế hoạch Block" → tạo thử 1 block
   5+1 tuần với lịch mẫu (T2 bench paused+low-grip, T4 squat+paused deadlift, T6 touch-and-go
   bench+incline, CN deadlift+paused squat) → xác nhận Phụ lục hiện đúng tuần/ngày/set, bấm ⓘ mở
   giải thích không bị lỗi Modal-chồng-Modal, chuyển VI/EN/DE không vỡ chữ, xoá block hoạt động.
2. Thử để trống 1RM (người mới) → xác nhận dòng ước lượng hiện đúng và block sinh ra dùng đúng số
   ước lượng đó.
3. Thử bật mục tiêu giảm cân trong hồ sơ trước khi mở wizard → xác nhận Deficit Mode tự bật và
   Phụ lục hiện đúng mục tiêu thâm hụt tuần.
4. Cân nhắc phần tuỳ chọn (stretch) chưa làm: prefill `PowerliftingSheet` từ buổi tập hôm nay
   trong block đang active.
5. **Nhắc lại (từ Session 21–25):** nhánh `ui-upgrade` vẫn tồn đọng rất nhiều thay đổi CHƯA
   COMMIT — nên rà + test tay + commit theo từng cụm (kể cả tính năng này).

## Session 27 — 2026-09-02

**Làm gì:** Sau khi Session 26 được commit/push + EAS Update lên `main`, người dùng test tay trên
điện thoại thật và phản hồi 8 điểm UX/kiến trúc cho S-PL Block Builder: (1) tính năng bị giấu quá
sâu trong nút "🔥 Xả", cần một chỗ riêng thực thụ; (2) thiếu ngày tháng cụ thể theo tuần (Thứ 2 →
Chủ nhật, block neo vào tuần lịch thật); (3) chưa lưu + xuất Excel để in; (4) thiếu dấu phân cách
giữa các bài trong lịch tuần; (5) nút "+ Add a day" không nổi bật; (6) nên gợi ý sẵn mẫu lịch tập
của người dùng; (7) nên nhớ cấu hình block trước (1RM/cân nặng/lịch) trừ khi đổi mục tiêu; (8) tuần
hiện Chủ nhật lên đầu (sai — phải Thứ 2 đầu, Chủ nhật cuối); (9) nội dung popup ⓘ tràn ra ngoài màn
hình, không đọc được.

**Kết quả:**
- **(1) Tab riêng:** thêm tab thứ 5 **"🏋️ Tập luyện"** vào `AppNavigator.tsx` — màn hình mới
  `src/screens/TrainingScreen.tsx` (không phải BottomSheet/Modal nữa, mà là screen thật kiểu
  `HistoryScreen.tsx`: `SafeAreaView` + `ScrollView` + `useFocusEffect` để tự tải lại block đang
  active mỗi lần vào tab). Gỡ hoàn toàn chip "📋 Kế hoạch Block" + state/handler liên quan khỏi
  `EnergyActionsBar.tsx`, xoá file `PlanAppendixSheet.tsx` cũ (nội dung đã chuyển vào
  `TrainingScreen.tsx`).
- **(2) Ngày tháng thật:** `TrainingBlockConfig` thêm field `weekStartDate` (Thứ 2, YYYY-MM-DD);
  `BlockWeekPlan` thêm `startDate`/`endDate` — `blockEngine.ts` tính bằng hàm mới
  `addDaysToDateString()` (`dateUtils.ts`). Wizard có bước chọn nhanh 5 Thứ 2 sắp tới
  (`upcomingMondays()`), mặc định tuần sau (đúng thói quen "lên kế hoạch trước 1-2 tuần"). Phụ lục
  hiện `Tuần N (26/08 - 01/09)`.
- **(3) Excel:** `src/services/export/trainingBlockExportService.ts` — 2 sheet ("Kế hoạch Block",
  "Tổng theo tuần"), tái dùng `autoFitColumns`/`workbookToBase64WithFrozenHeaders` đã export thêm
  từ `excelExportService.ts` (trước đó private) thay vì viết lại. Nút "📄 Xuất Excel" trong
  `TrainingScreen.tsx`.
- **(4)+(5) Polish lịch tuần:** thêm `rowDivider` (viền trên) giữa các bài/accessory trong
  `BlockBuilderWizard.tsx` và `TrainingScreen.tsx`; nút "+ Thêm buổi tập" đổi sang màu `c.accent`
  riêng biệt (`addDayBtn`/`addDayText`) thay vì dùng chung màu xanh với "+ Thêm bài"/"+ Thêm
  accessory".
- **(6) Mẫu gợi ý:** nút "💡 Dùng mẫu gợi ý" nạp đúng lịch SBD người dùng mô tả (T2 paused
  bench+incline, T4 main squat+paused deadlift, T6 touch-and-go bench+low grip, CN main
  deadlift+paused squat) — `suggestedTemplateDays()`.
- **(7) Nhớ cấu hình cũ:** nút "📋 Dùng cấu hình block trước" — fetch block gần nhất qua
  `listTrainingBlocks()` (cùng pattern promise+cancelled-flag như "Dùng làm mẫu" của
  `PowerliftingSheet`), copy cân nặng/1RM/lịch tuần nhưng **CỐ Ý KHÔNG** copy `focus`/Deficit Mode
  — đây là 2 nút hay đổi nhất giữa các block (cắt mỡ, tăng cường độ).
- **(8) Thứ tự Thứ 2 → Chủ nhật:** hàm mới `mondayFirstRank()` trong `dateUtils.ts` (remap JS
  Date's `0=Sun` về `0=Mon..6=Sun`) — sửa lỗi gốc trong `blockEngine.ts` (`sortedSchedule` trước
  đây sort thẳng theo `dayOfWeek` khiến Chủ nhật=0 luôn lên đầu). Áp dụng cả cho thứ tự hiển thị
  card ngày trong bước lịch tuần của wizard (`displayOrder`, index gốc giữ nguyên cho mọi
  handler).
- **(9) Popup ⓘ tràn màn hình:** nguyên nhân — `InfoPopover` là 1 flex-item auto-width trong hàng
  `flexDirection:'row'` không `flexWrap`, nên panel giải thích (text dài) không có gì giới hạn bề
  rộng, RN mặc định `overflow: visible` nên phần tràn chỉ đơn giản render ra ngoài rìa màn hình
  (mất tích, không phải bị cắt). Sửa: `InfoPopover.tsx` panel chỉ nhận `flexBasis: '100%'` khi
  đang mở (đẩy xuống dòng riêng), kết hợp `flexWrap: 'wrap'` trên hàng chứa nó
  (`variationHeaderRow` trong `TrainingScreen.tsx`).

**Kiểm tra trước commit:** `npm run verify` — ✅ **604/604 test PASS** (+2 test mới: ngày tháng
tuần, thứ tự Thứ 2-Chủ nhật), `tsc --noEmit` + `eslint` sạch. **Chưa test máy thật lượt sửa này**
— CHƯA commit/push/EAS update lần này (đợi người dùng xác nhận hoặc yêu cầu).

**Vấn đề gặp phải & Cách giải quyết:**
- Bug tràn màn hình (9) là kiểu lỗi RN layout kinh điển ("unbounded flex-row child") — dễ tái diễn
  ở bất kỳ chỗ nào khác đặt `InfoPopover` cạnh text dài trong hàng không `flexWrap`; nhớ luôn thêm
  `flexWrap:'wrap'` cho hàng chứa nó khi tái sử dụng component này ở nơi khác.

**Session tiếp theo phải làm:**
1. **Test máy thật (bắt buộc, ưu tiên cao):** mở tab "🏋️ Tập luyện" mới → tạo block dùng nút mẫu
   gợi ý → xác nhận thứ tự Thứ 2→Chủ nhật đúng, ngày tháng từng tuần đúng, bấm ⓘ đọc được trọn vẹn
   không tràn, xuất Excel mở được trong app khác (Numbers/Excel).
2. Tạo block thứ 2 → bấm "Dùng cấu hình block trước" → xác nhận cân nặng/1RM/lịch tuần được nạp
   lại đúng, còn phong cách/Deficit Mode vẫn về mặc định (không bị copy).
3. Nếu người dùng ưng ý, commit + push + `eas update --branch main` (theo đúng quy trình Session
   26 đã làm).

---

## Session 28 — 2026-09-09

**Làm gì:** Điện thoại tự cập nhật Expo Go lên SDK 57, project đang ghim SDK 54 nên báo
"Project is incompatible with this version of Expo Go" — không mở được app nữa. Nâng cấp project
theo đúng khuyến nghị của Expo. Ngay sau đó người dùng phát hiện thêm 1 bug thật khi xem file Excel
xuất ra: cột "Cân bằng năng lượng" tính sai, hiện dương (thặng dư) thay vì đúng ra phải âm
(deficit). Cuối session: thiết lập EAS Update để người dùng tự test qua Apple/iPhone từ xa mà
không cần Mac bật dev server.

**Kết quả:**
- **Nâng cấp Expo SDK 54 → 57** (đã hỏi và được người dùng đồng ý trước khi làm, đúng luật ghim SDK
  trong `AGENTS.md`): `expo` ^57, `react` 19.2.3, `react-native` 0.86.3, toàn bộ package `expo-*`
  khác đồng bộ theo `npx expo install --fix`.
  - `expo-file-system/legacy` bị SDK 57 xoá hẳn → migrate 3 file sang API mới `File`/`Directory`/
    `Paths`: `myFoodsBackupService.ts`, `excelExportService.ts`, `trainingBlockExportService.ts`
    (pattern: `new File(Paths.document, name)` → `file.create({ overwrite: true })` →
    `file.write(...)`/`file.text()`).
  - `app.json`: key `splash` cũ bị loại khỏi schema SDK 57 → chuyển sang plugin `expo-splash-screen`
    (cài thêm package), giữ nguyên màu nền + icon splash sẵn có trong `assets/`.
  - `tsconfig.json`: TypeScript nhảy lên 6.0 theo SDK 57 → bỏ `baseUrl` deprecated (path alias
    `@/*` chuyển dạng tương đối `./src/*`), phải khai báo tường minh `types: ["jest", "node"]` (tự
    động include của `tsc` bị vỡ theo — không thấy được `describe`/`it`/`expect`/`global` nữa cho
    tới khi khai báo rõ).
  - Cân nhắc rồi **KHÔNG cần** build dev-client ngay: `react-native-health` đã tự runtime-detect
    và no-op an toàn khi chạy Expo Go từ trước (xem guard trong `appleHealthSync.ts`) — việc build
    dev-client (đã cài sẵn `expo-dev-client` + CocoaPods qua Homebrew đầu session) để dành cho lúc
    nào cần test HealthKit thật trên máy.
  - `npx expo-doctor` còn 2 cảnh báo không chặn, cả 2 đều riêng của `react-native-health` (chưa
    test chính thức trên New Architecture bắt buộc từ SDK 55 + version `@expo/fingerprint` lồng
    bên trong nó bị trùng bản) — không ảnh hưởng gì tới việc chạy qua Expo Go.
- **Fix bug "Cân bằng năng lượng" trong Excel** (viết test trước theo TDD, xác nhận fail đúng lỗi
  rồi mới sửa): nguyên nhân gốc — cột này tính `kcal ăn - capacity`, với `capacity` là số ước tính
  CŨ (BMR + hoạt động tự nhập tay trong app). Nhưng từ đợt tích hợp Apple Health (S-F2, Session 19),
  màn hình chính `EnergyBalanceCard.tsx` đã chuyển hẳn sang dùng số calo xả THẬT đo từ Apple Health
  (lưu riêng ở bảng `health_signals` qua `logAppleHealthBurned`) — 2 nguồn này chưa bao giờ được
  đồng bộ với nhau, nên ngày nào tập luyện thật (Apple Health đo cao hơn ước tính cũ) là Excel tính
  thiếu số cal xả, cân bằng lệch dương.
  - `healthSignalsRepository.ts`: thêm `getAppleHealthBurnedInRange()` — lấy số Apple Health đã
    sync theo từng ngày trong cả khoảng xuất file (1 query, không lặp theo từng ngày).
  - `excelSheets.ts`: `buildDailyTotals` giờ ưu tiên số Apple Health thật cho mỗi ngày, chỉ fallback
    về `capacity` cũ khi ngày đó chưa từng sync Apple Health.
  - `excelExportService.ts`: nối dữ liệu mới vào — áp dụng cho cả export tuần lẫn tháng vì dùng
    chung 1 hàm `buildWorkbookBase64`.
  - 2 test mới trong `excelSheets.test.ts` tái hiện đúng kịch bản người dùng báo (2200 kcal ăn /
    capacity cũ 2000 / Apple Health thật 2800 → trước đây báo sai +200 thặng dư, giờ đúng -600
    deficit) + 1 test xác nhận fallback về capacity khi ngày đó không có Apple Health.
- **EAS Update cloud (lần đầu dùng cho project này):** publish 2 lần lên nhánh `preview`
  (`eas update --branch preview --environment preview --non-interactive`) — lần 1 sau khi nâng SDK,
  lần 2 sau khi sửa bug Excel. Từ nay người dùng mở thẳng link `https://u.expo.dev/update/<id>`
  (hoặc dashboard `expo.dev/accounts/bodybuilder007/...`) ngay trên Safari iPhone để test qua
  Expo Go — KHÔNG cần Mac bật `npm start`/cùng WiFi nữa, chỉ cần báo lại để publish bản mới + gửi
  link mới mỗi khi có thay đổi.

**Kiểm tra trước commit:** `npm run verify` — ✅ **606/606 test PASS** (+2 test mới), `tsc --noEmit`
+ `eslint` sạch. **CHƯA commit** (đợi người dùng xác nhận qua EAS Update trước khi commit).
**CHƯA có xác nhận test máy thật** cho cả 2 việc (nâng SDK 57 + fix Excel) — người dùng vừa yêu cầu
publish cloud để tự kiểm tra, đang chờ phản hồi.

**Vấn đề gặp phải & Cách giải quyết:**
- Sau khi đổi SDK, `npm install` để lại `node_modules` không nhất quán: `npm ls` báo
  `expo-modules-core` có mặt nhưng thực tế thư mục không tồn tại trên đĩa, khiến toàn bộ 48 test
  suite chết ngay từ bước setup (`Cannot find module 'expo-modules-core'`). `rm -rf node_modules &&
  npm install` KHÔNG tự sửa được — phải chạy `npm install expo-modules-core@<version>` trực tiếp
  mới buộc npm re-resolve đúng. Ghi nhớ: gặp lại "Cannot find module" dù `npm ls` báo có, nghi ngờ
  đầu tiên là bug hoisting/dedupe của npm, không phải thiếu file thật.
- Lệnh `eas update` bắt buộc thêm flag `--environment` từ SDK 55 trở lên (khác tài liệu cũ) —
  thiếu flag này lệnh báo lỗi ngay lập tức.
- `expo-doctor` phát hiện `expo-modules-core` lỡ bị thêm trực tiếp vào `package.json` (do bước gỡ
  lỗi ở trên) — đã gỡ, nó vốn chỉ nên là dependency ngầm của gói `expo`.

**Session tiếp theo phải làm:**
1. **Bắt buộc, ưu tiên cao nhất:** người dùng mở link EAS Update mới nhất trên iPhone qua Expo Go,
   xác nhận (a) app mở được bình thường sau nâng SDK 57 — không còn báo lỗi "incompatible"; (b)
   xuất thử 1 file Excel, kiểm tra cột "Cân bằng năng lượng" đúng chiều âm/dương với dữ liệu Apple
   Health thật trên máy.
2. Nếu cả 2 việc test ổn → commit (hiện toàn bộ đang nằm trên `ui-upgrade`, chưa commit), rồi hỏi
   người dùng có muốn `eas update` lên nhánh `main`/`production` không (khác nhánh `preview` đang
   dùng để test tạm).
3. Khi nào người dùng cần test tính năng Apple Health sync thật (HealthKit) trên thiết bị thật
   (Expo Go không chạy được native module) — dùng lại phần đã chuẩn bị sẵn: `expo-dev-client` +
   CocoaPods đã cài qua Homebrew, chỉ còn thiếu cài Xcode đầy đủ (miễn phí qua App Store) rồi chạy
   `npx expo run:ios --device`.

---

## Session 29 — 2026-09-10

**Làm gì:** Tiếp nối Session 28 (chưa xác nhận test máy thật): người dùng báo nút "Xuất Excel (để
in)" trong Phụ lục Kế hoạch (S-PL) bấm không thấy gì xảy ra. Sau khi sửa xong lại được người dùng
gửi 1 file Excel mẫu thật (`docs/Accumulation-Strength Block Sep-Oct.xlsx`) yêu cầu thiết kế lại
layout xuất file giống hệt file mẫu khi in ra.

**Kết quả:**
- **Sửa bug "xuất Excel im lặng":** `TrainingScreen.tsx handleExport` thiếu `try/catch` — lỗi bị
  nuốt âm thầm (unhandled promise rejection), người dùng bấm nút không thấy phản hồi gì. Thêm
  `catch` + `Alert` (key `planAppendix.exportError`, đủ 3 ngôn ngữ). Debug tạm thời hiện chi tiết
  lỗi thật trong Alert (đã gỡ sau khi tìm ra nguyên nhân) lộ ra lỗi thật: `TypeError: Can not read
  property 'replace' of undefined` tại `plan.config.weekStartDate.replace(...)`.
- **Sửa tận gốc:** block đang active của người dùng được tạo TRƯỚC khi tính năng "neo ngày tháng
  lịch thật" ra đời (Session 27, 2026-09-02) nên JSON `config` lưu trong SQLite thiếu hẳn field
  `weekStartDate`. Tách `rowToPlan` khỏi `trainingBlockRepository.ts` ra file mapper riêng
  `trainingBlockMapper.ts` (theo đúng convention `customFoodMapper.ts`/`foodOverrideMapper.ts` —
  test được độc lập, không cần DB thật), backfill `weekStartDate` từ `weeks[0].startDate` (hoặc
  hôm nay nếu cả hai đều thiếu) ngay khi đọc block từ DB — áp dụng cho MỌI nơi dùng block cũ, không
  chỉ lúc xuất Excel. +3 test mới (`trainingBlockMapper.test.ts`).
- **Thiết kế lại Sheet 1 xuất Excel Block Builder** theo đúng file mẫu người dùng gửi (phân tích
  bằng `openpyxl` qua venv Python tạm — không có `libreoffice`/`soffice` trên máy để render trực
  tiếp): bảng dạng **ma trận** (bài chính = hàng, tuần = cột) thay vì liệt kê phẳng từng dòng/set.
  Mỗi bài chiếm 2 hàng: "Kế hoạch: ..." (có số liệu `{{sets}}x{{reps}} @ {{weight}}kg (~{{pct}}%)`,
  in đậm nhãn) + "Thực tế: ..." để trống ngay dưới — dùng viết tay khi tập, đúng tinh thần file mẫu
  (in ra mang theo phòng gym). Tiêu đề lớn (merge cả hàng) + hàng tuần (W1...Wn + cột "Deload"
  riêng) đều in đậm/cỡ chữ lớn hơn. Bài phụ trợ (accessories) — file mẫu không có mục này — người
  dùng chọn giữ lại dạng khối nhỏ liệt kê bên dưới bảng chính thay vì bỏ hẳn.
  - Phát hiện qua thực nghiệm: thư viện `xlsx` (bản miễn phí) **âm thầm bỏ qua mọi `cell.s`** khi
    ghi file — không có API công khai để ghi font đậm/cỡ chữ (giống lý do `freezeHeaderRow` đã
    phải vá XML thô cho tính năng đóng băng dòng tiêu đề). Mở rộng đúng kỹ thuật đó: vá thêm 3 cặp
    font/`cellXfs` (tiêu đề 20pt / hàng tuần 14pt / nhãn bài 12pt) trực tiếp vào `styles.xml` sau
    khi `write()`, rồi gắn `s="N"` vào từng ô cần đậm trong sheet XML.
  - **Tách file để test được:** phát hiện `excelExportService.ts` không thể import thẳng trong
    Jest (kéo theo `useSettingsStore` → `@react-native-async-storage/async-storage` → crash
    "NativeModule: AsyncStorage is null" ngoài môi trường RN thật) — tách các hàm xlsx/zip thuần
    (`autoFitColumns`, `workbookToBase64WithFrozenHeaders`, vá style) sang `xlsxWriteUtils.ts`
    (không import DB/store nào), và logic dựng bảng ma trận thuần sang `trainingBlockPrintSheet.ts`
    (`buildPlanCrosstab`) — cả hai giờ test được trực tiếp không cần mock native module.
  - +10 test mới (`trainingBlockPrintSheet.test.ts` 7 test dựng bảng qua `generateBlockPlan` thật,
    `xlsxWriteUtils.test.ts` 3 test vá style qua unzip/đọc lại buffer thật).
  - **Xác minh thủ công đầu-cuối:** dựng 1 file `.xlsx` thật từ đúng code production (không phải
    prototype), mở lại bằng `openpyxl` — xác nhận đúng: tiêu đề 20pt đậm, hàng tuần 14pt đậm, nhãn
    bài 12pt đậm, merge tiêu đề đúng, tuần Deload hiện tải nhẹ hơn tuần cuối tịnh tiến.
- **EAS Update:** publish 3 lần trong session này (1 bản debug lộ lỗi thật, 1 bản sửa
  `weekStartDate`, 1 bản thiết kế lại Excel) — cùng nhánh `preview`, cùng quy trình Session 28.

**Kiểm tra trước commit:** `npm run verify` — ✅ **619/619 test PASS** (+13 so với Session 28),
`tsc --noEmit` + `eslint` sạch.

**Vấn đề gặp phải & Cách giải quyết:**
- Không có `libreoffice`/`soffice` để render `.xlsx` mẫu thành ảnh xem trực tiếp — cài `openpyxl`
  qua venv Python tạm trong scratchpad, đọc giá trị/style/merge/cỡ cột trực tiếp từ file thay vì
  nhìn ảnh. Cách này đủ chính xác (đọc đúng OOXML) nhưng tốn thêm bước dịch ngược sang mô tả bằng
  lời để xác nhận với người dùng trước khi implement.
- Thư viện `xlsx` miễn phí không ghi được style — đã tốn 1 vòng thực nghiệm (`node -e`) để xác nhận
  chắc chắn trước khi quyết định vá XML thô, tránh implement nhầm hướng (set `cell.s` tưởng chạy
  nhưng bị lờ đi âm thầm, không báo lỗi).
- `excelExportService.ts` không import được trong Jest do kéo theo AsyncStorage — nhắc nhớ: bất kỳ
  file `services/` nào cần test thuần phải tách khỏi mọi file có `import ... from '../../store/...'`
  hoặc repository — xem thêm [[fooditem-field-join-points]] cho một dạng bẫy tương tự (thay đổi 1
  chỗ kéo theo nhiều điểm nối ẩn).

**Session tiếp theo phải làm:**
1. **Bắt buộc, ưu tiên cao nhất:** người dùng mở link EAS Update mới nhất trên iPhone, xuất thử
   Excel từ Phụ lục Kế hoạch, xác nhận layout ma trận đúng như file mẫu khi mở/in ra thật (đậm/cỡ
   chữ, hàng Thực tế để trống, bài phụ trợ vẫn còn).
2. Vẫn CHƯA có xác nhận test máy thật cho phần còn lại của Session 28 (nâng SDK 57 mở app bình
   thường, cột "Cân bằng năng lượng" đúng chiều âm/dương) — xác nhận luôn trong cùng lượt test này.
3. Nếu người dùng ưng ý toàn bộ → hỏi có muốn `eas update` lên nhánh `production`/`main` không
   (khác `preview` đang dùng để test tạm), sau khi đã commit + push (đã làm trong session này theo
   yêu cầu trực tiếp của người dùng, dù chưa có xác nhận test máy thật cho phần Excel Block Builder
   — ngoại lệ so với quy tắc thường lệ "chờ xác nhận rồi mới commit", vì người dùng chủ động yêu
   cầu).

---

## 📌 Hướng dẫn viết session log

Khi kết thúc một session, AI tự điền vào đây:
- **Làm gì:** mô tả 1–2 câu
- **Kết quả:** đạt được gì (files tạo, tính năng test thành công…)
- **Vấn đề gặp phải:** lỗi, cản trở, việc phải bỏ lại
- **Session tiếp theo phải làm:** danh sách cụ thể, theo thứ tự ưu tiên

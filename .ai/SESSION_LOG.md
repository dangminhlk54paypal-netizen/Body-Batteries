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

## 📌 Hướng dẫn viết session log

Khi kết thúc một session, AI tự điền vào đây:
- **Làm gì:** mô tả 1–2 câu
- **Kết quả:** đạt được gì (files tạo, tính năng test thành công…)
- **Vấn đề gặp phải:** lỗi, cản trở, việc phải bỏ lại
- **Session tiếp theo phải làm:** danh sách cụ thể, theo thứ tự ưu tiên

# 🧩 NEXT SESSIONS — Phân công công việc cho nhiều phiên Sonnet 4.6 chạy song song

> Mục tiêu: tách phần việc còn lại của dự án thành các **gói độc lập**, mỗi gói chỉ
> động vào **một nhóm file riêng**, để bạn có thể mở **nhiều cửa sổ chat Sonnet 4.6
> cùng lúc** mà chúng không sửa đè lên nhau (không bị "conflict").
>
> Cập nhật: 2026-06-18 (sau Session 4). Đọc kèm `.ai/CONTEXT.md` mục 10 và `.ai/SESSION_LOG.md`.

---

## 🔑 Luật vàng khi chạy song song (đọc trước)

1. **Mỗi phiên CHỈ được sửa các file trong mục "File ĐƯỢC sửa" của gói đó.** Tuyệt đối
   không đụng vào file của gói khác (xem cột "KHÔNG đụng").
2. **Không sửa các file dùng chung** trong đợt song song này: `.ai/SESSION_LOG.md`,
   `.ai/CONTEXT.md`, `docs/04-roadmap.md`, `App.tsx` (trừ gói S-D), `package.json`
   (trừ gói S-E), `src/store/energyStore.ts` (đã xong, đừng sửa).
3. **Báo cáo cuối phiên ghi vào file RIÊNG:** `.ai/parallel-reports/<mã-gói>.md`
   (vd `.ai/parallel-reports/S-B.md`). KHÔNG sửa `SESSION_LOG.md` trong lúc chạy song
   song — để tránh đụng nhau. Sau khi tất cả xong, chạy **1 phiên gộp** (mục cuối) để
   dồn các report vào `SESSION_LOG.md`.
4. **Trước khi báo "xong", mỗi phiên BẮT BUỘC chạy 2 lệnh kiểm tra:**
   ```bash
   cd /Users/minh/VSCode_Repo/BodyBatteries
   npx tsc --noEmit          # phải sạch (exit 0)
   export PATH="/opt/homebrew/bin:$PATH"
   npx expo export --platform ios --output-dir /tmp/check_<mã-gói>   # phải "Bundled ... modules"
   ```
   Nếu một trong hai fail → chưa được coi là xong.
5. **Stack cố định: Expo SDK 54** (đọc `AGENTS.md`). Không nâng SDK. Không thêm thư
   viện lớn mới mà chưa giải thích & xin phép người dùng. Nói tiếng Việt với người dùng,
   code + comment tiếng Anh (`.ai/CONTEXT.md` mục 1).

---

## 📋 Tổng quan các gói

| Mã | Tên việc | Agent | Chạy song song? | Phụ thuộc |
|----|----------|-------|-----------------|-----------|
| **S-A** | Test thật trên điện thoại (Phase 0/1/2) | qa-reviewer (+ người dùng) | ✅ luôn được | không |
| **S-B** | Biểu đồ xu hướng tuần (Phase 3) | mobile-frontend | ✅ | không |
| **S-C** | Nhắc nhở hàng ngày + ngưỡng cảnh báo thật (Phase 2) | logic-backend | ✅ | không |
| **S-D** | Tự xả pin theo thời gian + reset hàng ngày (Phase 2) | logic-backend | ✅ | không |
| **S-E** | Unit test cho domain logic | qa-reviewer | ✅ | không |
| **S-F** | Tích hợp Health: số bước chân (Phase 4) | architect + logic-backend | ⏸ làm SAU S-D | cần S-D xong (đụng `App.tsx`) |
| **S-G** | Lớp thông minh dự báo (Phase 5) | data-ml | ⏸ làm SAU CÙNG | cần ~1 tháng dữ liệu |
| **S-H** | Tích hợp "năng lượng tự xả" (metabolism) vào pin | logic-backend + mobile-frontend | ✅ **v1 XONG** (Hướng B) | xem `docs/06-energy-expenditure.md`; còn tinh chỉnh + nối Health (S-F) |

> **Đợt 1 (song song được ngay):** S-A, S-B, S-C, S-D, S-E — 5 gói này động vào các
> nhóm file rời nhau hoàn toàn. **Đợt 2 (sau):** S-F rồi S-G.

---

## S-A · Test thật trên điện thoại + chốt Phase 0/1/2

**Mục tiêu:** Xác nhận app chạy thật trên iPhone qua Expo Go (bundle đã verify build OK ở Session 4).

**File ĐƯỢC sửa:** chỉ `.ai/parallel-reports/S-A.md` (ghi kết quả test). **KHÔNG đụng** code `src/`.

**Các bước (AI hướng dẫn người dùng từng bước, người dùng bấm máy):**
1. `cd /Users/minh/VSCode_Repo/BodyBatteries && export PATH="/opt/homebrew/bin:$PATH" && npx expo start`
   (nếu wifi trường chặn thì thêm `--tunnel`).
2. iPhone mở Expo Go → quét QR (hoặc Safari `exp://<IP>:8081`).
3. Xác nhận **màn hình Home hiện 1 pin tổng + 6 pin nhỏ** (Protein, Carbs, Nước, Khoáng, Ngủ, Vận động).
4. Test Phase 1: bấm pin Protein → nạp 30 → pin đầy lên → **đóng hẳn app → mở lại → mức pin còn nguyên**.
5. Test Phase 2: đổi Mode sang "Tập luyện" → mục tiêu/sức chứa Protein tăng (pin % giảm vì capacity to hơn).
6. Test thông báo: nạp ít cho 1 pin xuống <20% → nhận thông báo "pin thấp" (Expo Go hỗ trợ local notification).

**Tiêu chí hoàn thành:** mục 3–5 chạy đúng. Ghi rõ máy gì, lỗi gì (kèm ảnh nếu có) vào report.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md (mục 10) và .ai/NEXT_SESSIONS.md (gói S-A).
Nhập vai agent qa-reviewer. Nhiệm vụ: hướng dẫn tôi test app thật trên iPhone qua Expo Go
theo đúng các bước gói S-A, từng bước một bằng tiếng Việt, chờ tôi xác nhận trước khi sang bước sau.
KHÔNG sửa code trong src/. Ghi kết quả test (máy gì, đúng/sai, lỗi gì) vào file mới
.ai/parallel-reports/S-A.md. Bắt đầu bằng việc cho tôi lệnh chạy expo start.
```

---

## S-B · Biểu đồ xu hướng tuần (Phase 3)

**Mục tiêu:** Màn Lịch sử có biểu đồ đường/cột thể hiện % năng lượng tổng 7 ngày.

**File ĐƯỢC sửa / tạo:**
- TẠO `src/components/TrendChart.tsx` (component biểu đồ).
- SỬA `src/screens/HistoryScreen.tsx` (chèn `<TrendChart>` lên đầu danh sách).

**KHÔNG đụng:** mọi file khác, đặc biệt `package.json`, `App.tsx`, các screen khác.

**Ràng buộc kỹ thuật:**
- **Dùng `react-native-svg`** (ĐÃ có sẵn trong dependencies — không cài thêm gì, không dùng
  `victory-native`). Vẽ thủ công: trục, các điểm `averagePercentage` theo ngày, đường nối.
- Dữ liệu lấy từ state `days` đã có trong `HistoryScreen` (mảng `{date, averagePercentage}`),
  truyền xuống `TrendChart` qua props. Không tự query DB trong component.
- Màu nền `#0d0d1a`, hợp tông tối hiện có. Xử lý trường hợp 0–1 ngày dữ liệu (hiện chữ "chưa đủ dữ liệu").

**Tiêu chí hoàn thành:** mở tab Lịch sử thấy biểu đồ 7 ngày phía trên các thẻ ngày; `tsc` sạch; `expo export` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-B). Nhập vai agent
mobile-frontend. Nhiệm vụ: làm biểu đồ xu hướng % năng lượng tổng 7 ngày cho màn Lịch sử.
CHỈ được tạo src/components/TrendChart.tsx và sửa src/screens/HistoryScreen.tsx — KHÔNG đụng
file nào khác, KHÔNG sửa package.json (dùng react-native-svg đã có sẵn, không dùng victory-native).
Trước khi báo xong phải chạy `npx tsc --noEmit` và `npx expo export --platform ios` cho sạch.
Ghi báo cáo vào file mới .ai/parallel-reports/S-B.md. Mô tả kế hoạch ngắn bằng tiếng Việt cho tôi duyệt trước khi code.
```

---

## S-C · Nhắc nhở hàng ngày + ngưỡng cảnh báo thật (Phase 2)

**Mục tiêu:** Nút "Bật thông báo" và "ngưỡng pin thấp" trong Settings hoạt động thật:
bật/tắt → đặt/huỷ 1 nhắc nhở hàng ngày; ngưỡng người dùng chọn được dùng để cảnh báo.

**File ĐƯỢC sửa / tạo:**
- SỬA `src/screens/SettingsScreen.tsx` (thêm chọn giờ nhắc; gọi schedule/cancel khi bật/tắt).
- SỬA `src/store/settingsStore.ts` (thêm `reminderHour`, `reminderMinute`).
- SỬA `src/services/notifications/notificationService.ts` (đã có `scheduleDailyReminder`/`cancelAllNotifications` — dùng lại, thêm hàm nếu cần).
- (Tuỳ chọn) SỬA `src/domain/rules/lowBatteryRules.ts` để nhận ngưỡng từ tham số thay vì hằng số `LOW_BATTERY_THRESHOLD`.

**KHÔNG đụng:** `App.tsx`, `HomeScreen.tsx`, `HistoryScreen.tsx`, `energyStore.ts`, `package.json`, các component pin.

**Ràng buộc:**
- `checkLowBattery` hiện hard-code `LOW_BATTERY_THRESHOLD`. Nếu sửa để nhận ngưỡng động, giữ
  **mặc định cũ** khi không truyền, để HomeScreen không vỡ (HomeScreen thuộc gói khác, KHÔNG sửa nó).
- Trên web, `notificationService.web.ts` là stub — đừng xoá, để nguyên.

**Tiêu chí hoàn thành:** tắt thông báo → huỷ nhắc nhở; bật lại → đặt nhắc nhở hàng ngày; đổi ngưỡng được lưu. `tsc` sạch; `expo export` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-C). Nhập vai agent
logic-backend. Nhiệm vụ: làm cho nút "Bật thông báo" và "ngưỡng pin thấp" trong màn Cài đặt
hoạt động thật (đặt/huỷ nhắc nhở hàng ngày, lưu ngưỡng). CHỈ được sửa SettingsScreen.tsx,
settingsStore.ts, notificationService.ts, và (tuỳ chọn) lowBatteryRules.ts — KHÔNG đụng App.tsx,
HomeScreen.tsx, energyStore.ts, package.json hay file khác. Giữ giá trị mặc định cũ để không
làm vỡ HomeScreen. Chạy `npx tsc --noEmit` + `npx expo export --platform ios` trước khi báo xong.
Ghi báo cáo vào .ai/parallel-reports/S-C.md. Mô tả kế hoạch ngắn cho tôi duyệt trước.
```

---

## S-D · Tự xả pin theo thời gian + reset hàng ngày khi mở app (Phase 2)

**Mục tiêu:** Pin giảm dần theo thời gian (`tickDrain` đã có sẵn trong store); và khi sang
ngày mới, mở app sẽ tự tạo pin của ngày mới.

**File ĐƯỢC sửa / tạo:**
- TẠO `src/hooks/useDrainTick.ts` (hook chạy `tickDrain` định kỳ khi app mở — foreground, dùng `setInterval` + `AppState`).
- SỬA `App.tsx` (gọi hook/khởi tạo sau khi DB sẵn sàng; gọi `resetForNewDay`/`loadToday` khi phát hiện ngày đổi).
- (Tuỳ chọn) TẠO `src/services/background/dailyResetCheck.ts` (hàm thuần kiểm tra "đã sang ngày mới chưa").

**KHÔNG đụng:** `src/store/energyStore.ts` (HÀM `tickDrain(elapsedHours, modeId)` và `resetForNewDay`
ĐÃ CÓ và đúng — chỉ GỌI, đừng sửa), `package.json`, mọi screen/component, các service khác.

**Ràng buộc:**
- Phase này KHÔNG cần `expo-task-manager`/background thật (phức tạp, để Phase sau). Chỉ cần
  **foreground**: app đang mở thì cứ ~mỗi 30 phút (hoặc khi quay lại từ nền) tính lượng xả theo
  thời gian đã trôi qua, gọi `tickDrain(elapsedHours, currentMode)`.
- Lấy `currentMode` từ `useSettingsStore`. Lấy hàm từ `useEnergyStore`.
- Cẩn thận memory leak: clear interval khi unmount.

**Tiêu chí hoàn thành:** để app mở một lúc → pin giảm nhẹ; đổi ngày (chỉnh giờ máy) mở lại → pin reset ngày mới. `tsc` sạch; `expo export` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-D). Nhập vai agent
logic-backend. Nhiệm vụ: làm pin tự xả theo thời gian khi app đang mở (foreground) và tự reset
khi sang ngày mới. CHỈ được tạo src/hooks/useDrainTick.ts (+ tuỳ chọn src/services/background/dailyResetCheck.ts)
và sửa App.tsx — KHÔNG sửa energyStore.ts (hàm tickDrain/resetForNewDay đã có, chỉ gọi), KHÔNG sửa
package.json hay screen/component. KHÔNG dùng expo-task-manager đợt này (chỉ foreground setInterval + AppState).
Clear interval khi unmount. Chạy `npx tsc --noEmit` + `npx expo export --platform ios` trước khi báo xong.
Ghi báo cáo vào .ai/parallel-reports/S-D.md. Mô tả kế hoạch ngắn cho tôi duyệt trước.
```

---

## S-E · Unit test cho domain logic (chất lượng)

**Mục tiêu:** Có test tự động cho phần "bộ não" thuần (không phụ thuộc React/DB), để các phiên
sau sửa logic không làm hỏng ngầm.

**File ĐƯỢC sửa / tạo:**
- TẠO `src/domain/battery/__tests__/batteryEngine.test.ts`, `src/domain/rules/__tests__/lowBatteryRules.test.ts`,
  `src/lib/__tests__/dateUtils.test.ts`, `src/domain/modes/__tests__/modeDefinitions.test.ts`.
- SỬA `package.json` (thêm devDeps `jest`, `jest-expo`, `@types/jest`, `ts-jest` nếu cần + script `"test": "jest"`).
- TẠO `jest.config.js` (preset `jest-expo`).

**KHÔNG đụng:** mọi file `src/` KHÁC ngoài việc TẠO file test (không sửa code nguồn —
nếu phát hiện bug trong code nguồn, GHI vào report, đừng tự sửa vì có thể đụng gói khác).

**Ràng buộc:**
- Chỉ test **hàm thuần**: `capacityForMode`, `clampLevel`, `toPercentage`, `applyIntake`,
  `applyDrain`, `computeMasterLevel`, `createDailyReading`, `checkLowBattery`, `getModeById`,
  `dateString/daysAgo`. KHÔNG test component/DB (cần thiết bị/mock nặng).
- `package.json` là file dùng chung — **chỉ gói S-E được sửa** trong đợt 1. Các gói khác đã được dặn không đụng.

**Tiêu chí hoàn thành:** `npm test` chạy xanh; `tsc` sạch.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-E). Nhập vai agent
qa-reviewer. Nhiệm vụ: viết unit test (jest-expo) cho các hàm thuần trong src/domain và src/lib.
CHỈ được tạo các file test trong thư mục __tests__, tạo jest.config.js, và sửa package.json để
thêm jest + script test — KHÔNG sửa bất kỳ code nguồn nào trong src (nếu thấy bug thì ghi vào
report chứ đừng sửa). Chạy `npm install` (cho devDeps mới) rồi `npm test` phải xanh, và `npx tsc --noEmit` sạch.
Ghi báo cáo (gồm bug phát hiện nếu có) vào .ai/parallel-reports/S-E.md.
```

---

## S-F · Tích hợp Health: số bước chân (Phase 4) — ⏸ làm SAU S-D

**Vì sao chờ:** gói này cần sửa `App.tsx` (xin quyền) → đụng với S-D. Chạy sau khi S-D xong.

**Phác thảo:** TẠO `src/services/health/` (đọc số bước qua HealthKit/Health Connect — SDK 54 cần
kiểm tra thư viện phù hợp, có thể phải xin phép cài), `src/data/repositories/healthRepository.ts`
(bảng `health_signals` đã có sẵn trong schema). Đưa số bước vào pin "Vận động". Đọc kỹ ranh giới
sức khoẻ trong `.ai/CONTEXT.md` mục 5. **Trước khi cài thư viện mới → giải thích & xin phép người dùng.**

---

## S-G · Lớp thông minh dự báo (Phase 5) — ⏸ làm SAU CÙNG

Cần ~1 tháng dữ liệu thật. Bắt đầu bằng rule-based, kèm disclaimer y tế (CONTEXT mục 5). Giao agent `data-ml`.

---

## S-H · Tích hợp "năng lượng tự xả" (metabolism) vào pin — ✅ v1 XONG (Hướng B)

Đã triển khai & verify (tsc sạch · 62 test PASS · bundle 1411 module). Chi tiết đầy đủ trong
`docs/06-energy-expenditure.md` mục 3. Tóm tắt: pin TỔNG giờ là pin "Năng lượng" (sức chứa = TDEE,
nạp khi ăn — tự từ Protein/Carbs + nút nhập tay, xả theo BMR + bước chân + buổi tập). Có form
"Hồ sơ cơ thể" trong Cài đặt.

**Còn lại cho phiên sau (S-H tiếp / hoặc gộp với S-F):**
- Vào Cài đặt sửa **tuổi + giới tính thật** (mặc định 30/nam).
- Nối Health/đồng hồ để **tự lấy bước chân** (gói S-F) thay vì nhập tay.
- Cho `logActivity` ghi vào lịch sử intake để xuất Excel đầy đủ.
- Tinh chỉnh: rải xả theo nhịp sinh học; hệ số/MET cá nhân hoá; cân nhắc "carry-over" qua ngày.

> ⚠️ Ranh giới sức khoẻ: luôn kèm disclaimer "chỉ tham khảo", không tạo mục tiêu cực đoan (`.ai/CONTEXT.md` mục 5).

---

## 🧷 Phiên GỘP (chạy sau khi các gói đợt 1 xong)

Khi S-A…S-E đã xong và ghi report riêng:
```
Đọc tất cả file trong .ai/parallel-reports/. Gộp thành 1 entry "Session 5" trong
.ai/SESSION_LOG.md, cập nhật .ai/CONTEXT.md mục 10 và tick các mục đã xong trong
docs/04-roadmap.md. Chạy `npx tsc --noEmit` + `npx expo export --platform ios` để xác nhận
toàn bộ vẫn build OK sau khi nhiều phiên cùng sửa. Báo cáo lại cho tôi bằng tiếng Việt.
```

# 🧩 NEXT SESSIONS — Phân công công việc cho nhiều phiên Sonnet 4.6 chạy song song

> Mục tiêu: tách phần việc còn lại của dự án thành các **gói độc lập**, mỗi gói chỉ
> động vào **một nhóm file riêng**, để bạn có thể mở **nhiều cửa sổ chat Sonnet 4.6
> cùng lúc** mà chúng không sửa đè lên nhau (không bị "conflict").
>
> Cập nhật: 2026-06-18 (sau Session 5 + tư vấn Opus + gói S-J gộp tài liệu — `.ai/CONTEXT.md`
> mục 10 và `.ai/SESSION_LOG.md` giờ đã khớp trạng thái thật, 7 commit local trên nhánh
> `session-5-demo-ready`, chưa push).

---

## 🔑 Luật vàng khi chạy song song (đọc trước)

1. **Mỗi phiên CHỈ được sửa các file trong mục "File ĐƯỢC sửa" của gói đó.** Tuyệt đối
   không đụng vào file của gói khác (xem cột "KHÔNG đụng").
2. **Không sửa các file dùng chung** ngoài đúng gói được giao chúng: `.ai/SESSION_LOG.md`,
   `.ai/CONTEXT.md`, `docs/04-roadmap.md` (chỉ gói **S-J**), `App.tsx` (chỉ gói S-D),
   `package.json` (chỉ gói S-E), `src/store/energyStore.ts` (gói **S-I** — chỉ thêm 1 dòng
   truyền `mealWindows` vào `logFood`; hoặc gói **S-K** — chỉ sửa lệnh gọi `burnPassive` trong
   `tickDrain`; hai gói đụng 2 hàm khác nhau trong cùng file nhưng vẫn nên làm xong 1 gói,
   commit, rồi mới chạy gói kia để tránh merge rối), `src/screens/SettingsScreen.tsx` (gói
   **S-F** hoặc **S-I**, không cả hai cùng lúc), `src/lib/metabolicConstants.ts` và
   `src/domain/energy/metabolismEngine.ts` (gói **S-F** hoặc **S-K**, không cả hai cùng lúc —
   cả hai cùng sửa các hàm tính `passiveDailyBurn`/`passiveBurnPerHour`).
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

| Mã | Tên việc | Trạng thái | Agent | Chạy song song? | Phụ thuộc |
|----|----------|------------|-------|-----------------|-----------|
| **S-A** | Test thật trên điện thoại (Phase 0/1/2) | ⏸ Chưa xong — người dùng sẽ test sau | qa-reviewer (+ người dùng) | ✅ luôn được | không |
| **S-B** | Biểu đồ xu hướng tuần (Phase 3) | ✅ XONG (code, chưa test máy) | mobile-frontend | ✅ | không |
| **S-C** | Nhắc nhở hàng ngày + ngưỡng cảnh báo thật (Phase 2) | ✅ XONG (code, chưa test máy) | logic-backend | ✅ | không |
| **S-D** | Tự xả pin theo thời gian + reset hàng ngày (Phase 2) | ✅ XONG (code, chưa test máy) | logic-backend | ✅ | không |
| **S-E** | Unit test cho domain logic | ✅ XONG | qa-reviewer | ✅ | không |
| **S-F** | Bước chân: v1 đặt mức trung bình/ngày (placeholder) | 🆕 Sẵn sàng làm — xem thiết kế bên dưới | logic-backend | ✅ | không |
| **S-G** | Lớp thông minh dự báo (Phase 5) | ⏸ làm sau cùng | data-ml | ⏸ làm SAU CÙNG | cần ~1 tháng dữ liệu |
| **S-H** | "Năng lượng tự xả" (metabolism) vào pin — Hướng B | ✅ v1 xong; Session 5 mở rộng thêm Food Log + pin xả mượt/giây | logic-backend + mobile-frontend | — | `docs/06-`, `docs/07-` |
| **S-I** | Khung giờ bữa ăn sửa được trong Cài đặt | 🆕 Sẵn sàng làm — xem thiết kế bên dưới | mobile-frontend | ⚠️ KHÔNG song song với S-F (cùng đụng `SettingsScreen.tsx`) | không |
| **S-J** | Dọn dẹp tài liệu / gộp báo cáo Session 4+5 | ✅ XONG (2026-06-18, qua tư vấn Opus) | (không cần agent riêng) | ✅ luôn được, không đụng code | không |
| **S-K** | Rải xả pin Năng lượng theo nhịp thức/ngủ (thay rải đều 24h) | 🆕 Sẵn sàng làm — quyết định 2026-06-18 | logic-backend | ⚠️ KHÔNG song song với S-F (cùng đụng `metabolicConstants.ts`/`metabolismEngine.ts`) | không |
| **S-L** | Ghi nhận cân nặng theo thời gian (tiền đề cho hiệu chỉnh cá nhân hoá thật) | 🆕 Sẵn sàng làm — quyết định 2026-06-18 | logic-backend | ✅ | không |

> **Đợt mới (song song được ngay, không đụng nhau):** S-J, S-L — và S-A (test máy) lúc nào
> cũng chạy được. **S-F, S-I, S-K mỗi gói đụng file dùng chung với 1+ gói khác** (xem cột
> "Chạy song song?" của từng gói) — chỉ chạy 1 trong số chúng cùng lúc, làm xong → commit →
> mới chạy gói tiếp theo trong nhóm này. S-G để sau cùng (cần dữ liệu cân nặng từ S-L, xem mục S-G).

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

## S-F · Bước chân v1: mức trung bình/ngày (placeholder cho Health thật)

**Quyết định đã chốt với người dùng (2026-06-18):** KHÔNG tích hợp HealthKit/Health Connect
ngay — lý do: app đang test qua **Expo Go**, mà HealthKit/Health Connect là native module
không chạy trong Expo Go (phải build "dev client" riêng qua EAS, đổi cả cách cài app lên máy).
Việc đó để **sau** (xem "S-F v2" cuối mục này). Cho **bây giờ**: người dùng tự nhập **số bước
trung bình/ngày của họ** 1 lần trong Hồ sơ cơ thể; app dùng số đó để tính hao năng lượng do đi
lại, **không cần thư viện mới, không cần xin quyền gì, chạy được ngay trong Expo Go hiện tại.**

**Vì sao đặt trong `passiveDailyBurn` (không phải một battery/action riêng):** model Hướng B
hiện có `energyCapacity(profile) = passiveDailyBurn(profile)` và pin xả mượt theo giờ qua
`passiveBurnPerHour` (đã có `burnPassive`, đã dùng trong `tickDrain` + `useLiveEnergyReading`
mới làm ở Session 5). Cộng thêm bước trung bình vào ngay công thức này nghĩa là: (a) sức chứa
ngày hôm đó tăng đúng bằng phần năng lượng dự kiến tiêu cho đi lại, và (b) pin tự xả mượt phần
đó luôn — **không cần viết lại bất kỳ cơ chế xả/hiển thị nào**, chỉ cộng thêm 1 số hạng vào 1
hàm thuần đã có test.

**File ĐƯỢC sửa / tạo:**
- SỬA `src/types/energy.ts` — thêm `averageDailySteps?: number` vào `UserProfile`.
- SỬA `src/lib/metabolicConstants.ts` — thêm giới hạn `PROFILE_LIMITS.averageDailySteps`
  (gợi ý: min 0, max ~30000 — tránh số vô lý).
- SỬA `src/domain/energy/profileValidation.ts` — validate giới hạn trên (theo đúng pattern các
  field khác đã có).
- SỬA `src/domain/energy/metabolismEngine.ts` — `passiveDailyBurn(profile)` cộng thêm
  `stepsKcal(profile.averageDailySteps ?? 0, profile.weightKg)` (hàm `stepsKcal` đã có, đã test).
- SỬA `src/components/BodyProfileCard.tsx` — thêm 1 `Field` "Số bước trung bình/ngày" cạnh
  cân nặng/chiều cao/tuổi; cộng vào object `preview` dùng để tính TDEE xem trước.
- SỬA test: `src/domain/energy/__tests__/metabolismEngine.test.ts` (case có/không
  `averageDailySteps`), `profileValidation.test.ts` nếu có thêm rule.

**KHÔNG đụng:** `App.tsx`, `energyStore.ts`, `SettingsScreen.tsx` (chỉ sửa component con
`BodyProfileCard.tsx`, không sửa file cha), nút "🏃 Vận động" / `EnergyActionsBar.tsx` (số bước
nhập tay ở đó vẫn giữ nguyên — coi là "vận động THÊM ngoài mức trung bình", không xoá/đổi).

**Ràng buộc:**
- Mặc định `averageDailySteps = 0` (hoặc không set) để KHÔNG đổi hành vi của hồ sơ cũ đã lưu —
  `?? 0` ở mọi nơi dùng tới.
- Đây là số TRUNG BÌNH cố định mỗi ngày (không phải số bước thật hôm đó) — ghi rõ trong UI
  (placeholder/label) đây là ước lượng tạm, sẽ thay bằng dữ liệu thật từ điện thoại sau.

**Tiêu chí hoàn thành:** nhập số bước trung bình → lưu hồ sơ → xem TDEE xem trước tăng đúng theo
`stepsKcal`; mở lại app, pin Năng lượng hôm sau có sức chứa lớn hơn tương ứng. `tsc` sạch;
`npx jest` xanh; `expo export --platform ios` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-F, bản v1 — bước chân
trung bình/ngày, KHÔNG phải HealthKit/Health Connect). Nhập vai agent logic-backend. Nhiệm vụ:
thêm field "số bước trung bình/ngày" vào hồ sơ cơ thể, cộng vào passiveDailyBurn qua stepsKcal
đã có. CHỈ sửa: types/energy.ts, lib/metabolicConstants.ts, domain/energy/profileValidation.ts,
domain/energy/metabolismEngine.ts, components/BodyProfileCard.tsx, và test liên quan — KHÔNG
đụng App.tsx, energyStore.ts, SettingsScreen.tsx, EnergyActionsBar.tsx, package.json. Mặc định
0, không đổi hành vi hồ sơ cũ. Chạy `npx tsc --noEmit` + `npx jest` + `npx expo export --platform
ios` trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-F.md. Mô tả kế hoạch ngắn cho
tôi duyệt trước khi code.
```

**S-F v2 (SAU, chưa làm — cần quyết định riêng lúc đó):** thay số trung bình ở trên bằng dữ
liệu thật. Hai hướng đã cân nhắc, người dùng sẽ chọn lại khi tới lúc làm:
- `expo-sensors` `Pedometer` — chạy ngay trong Expo Go, chỉ có tổng số bước thô (không nhịp
  tim/giấc ngủ, không đồng bộ Apple Watch/Health app khác).
- HealthKit (iOS) / Health Connect (Android) qua thư viện native — dữ liệu đầy đủ hơn nhưng
  **bắt buộc chuyển từ Expo Go sang custom dev client (EAS Build)**, đổi cả quy trình cài app
  lên máy hiện tại. Đọc ranh giới sức khoẻ ở `.ai/CONTEXT.md` mục 5 trước khi làm. Bảng
  `health_signals` (cột `source/type/value`) trong `schema.ts` đã có sẵn, để chứa dữ liệu nguồn
  nào cũng được — không cần đổi schema khi tới lúc làm v2.

---

## S-K · Rải xả pin Năng lượng theo nhịp thức/ngủ (thay rải đều 24h)

**Quyết định đã chốt với người dùng (2026-06-18):** chọn khung thức/ngủ **cố định** (không
đọc giờ ngủ thật từ pin "Ngủ" — đơn giản hơn, không phụ thuộc người dùng ghi ngủ đều đặn).
**Tổng kcal/ngày KHÔNG đổi** — gói này chỉ đổi *hình dạng* đường xả trong ngày (xả nhanh hơn
lúc thức, chậm hơn lúc ngủ), không đổi `passiveDailyBurn`/sức chứa.

**Vì sao cần đổi cách gọi hàm (không chỉ đổi 1 hằng số):** hiện `passiveBurnPerHour(profile)`
trả về 1 tốc độ kcal/giờ cố định, và `burnPassive(reading, profile, elapsedHours)` chỉ nhân
tốc độ đó với số giờ trôi qua — không biết khoảng thời gian đó rơi vào giờ nào trong ngày. Để
rải không đều, hàm cần biết **mốc thời gian thật** (giờ bắt đầu/kết thúc khoảng trôi qua), không
chỉ "số giờ". Cả `tickDrain` (store, mỗi ~30 phút) và `useLiveEnergyReading` (hiện mỗi giây trên
màn hình) đều gọi `burnPassive` — phải sửa **cả hai nơi gọi** đồng bộ để không bị lệch giữa số
hiển thị real-time và số lưu thật (xem comment trong `useLiveEnergyReading.ts` giải thích bất
biến này).

**File ĐƯỢC sửa:**
- SỬA `src/lib/metabolicConstants.ts` — thêm hằng số `CIRCADIAN_WINDOW = { wakeHour: 6, sleepHour: 23 }`
  (thức 6h–23h, còn lại = ngủ) và `SLEEP_BURN_MULTIPLIER` (gợi ý ~0.85 — trao đổi chất lúc ngủ
  thấp hơn lúc thức khoảng 10–15%, ghi rõ đây là số ước lượng chung, không phải số đo riêng).
- SỬA `src/domain/energy/metabolismEngine.ts` — thêm hàm thuần mới (ví dụ
  `passiveBurnKcalBetween(profile, fromMs, toMs)`) tính kcal xả thật giữa 2 mốc thời gian bất kỳ,
  bằng cách chia khoảng đó theo giờ trong ngày và áp tốc độ thức/ngủ tương ứng cho từng phần,
  sao cho **tổng đúng 1 ngày tròn vẫn bằng `passiveDailyBurn(profile)` y như trước** (viết test
  xác nhận đúng invariant này — đây là tiêu chí quan trọng nhất). Giữ `passiveBurnPerHour` lại
  (dùng cho nơi nào cần ước lượng tốc độ trung bình, ví dụ hiển thị "ước tính xả mỗi giờ") nhưng
  không dùng nó để tính lượng xả thật nữa.
- SỬA `src/domain/energy/energyBalanceEngine.ts` — đổi `burnPassive(reading, profile, elapsedHours)`
  thành nhận mốc thời gian thật, ví dụ `burnPassive(reading, profile, fromMs, toMs)`, gọi
  `passiveBurnKcalBetween` ở trên rồi `burnEnergy`.
- SỬA `src/store/energyStore.ts` — **CHỈ** trong hàm `tickDrain`: đổi lệnh gọi `burnPassive` để
  truyền `fromMs` (= `lastDrainSyncAt` hiện có trong state) và `toMs` (= `Date.now()`) thay vì
  `elapsedHours`. Không sửa gì khác trong file (đặc biệt không đụng `logFood`, để dành cho S-I).
- SỬA `src/hooks/useLiveEnergyReading.ts` — đổi lệnh gọi `burnPassive` tương tự, dùng
  `lastDrainSyncAt` và `now` đã có sẵn trong hook.
- SỬA test: `metabolismEngine.test.ts` (case tổng 1 ngày tròn không đổi; case khoảng thời gian
  cắt qua nửa đêm/qua ranh giới thức-ngủ), `energyBalanceEngine.test.ts` (cập nhật theo signature mới).

**KHÔNG đụng:** `App.tsx`, `useDrainTick.ts` (hook này chỉ gọi `tickDrain(elapsedHours, modeId)`
ở mức store — không cần sửa, vì việc đổi cách tính nằm bên trong `tickDrain`), `SettingsScreen.tsx`,
`BodyProfileCard.tsx`, mọi component UI. **KHÔNG chạy song song với S-F** (cả hai sửa
`metabolicConstants.ts` và `metabolismEngine.ts`).

**Ràng buộc:**
- Bất biến quan trọng nhất: với bất kỳ hồ sơ nào, tổng kcal xả trong đúng 24h liên tục = giá trị
  `passiveDailyBurn(profile)` cũ (sai số làm tròn cho phép) — nếu không giữ được, sức chứa pin
  "Năng lượng" sẽ lệch khỏi TDEE đã hiển thị cho người dùng, gây hiểu lầm.
- Khung giờ thức/ngủ ở v1 là **hằng số cố định cho mọi người** (không phải cấu hình riêng từng
  người) — nếu sau này muốn cho sửa trong Cài đặt, đó là một gói khác, không làm trong S-K.

**Tiêu chí hoàn thành:** mở app lúc 14h, để trôi 1 giờ → pin xả nhiều hơn mở lúc 1h sáng để trôi
1 giờ; cộng dồn xả đúng 24h (bất kỳ giờ bắt đầu nào) ra đúng số kcal như trước (test tự động xác
nhận). `tsc` sạch; `npx jest` xanh; `expo export --platform ios` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/06-energy-expenditure.md và
.ai/NEXT_SESSIONS.md (gói S-K). Nhập vai agent logic-backend. Nhiệm vụ: đổi cách rải xả thụ động
của pin Năng lượng từ "đều suốt 24h" sang "nhanh hơn lúc thức (6h-23h), chậm hơn lúc ngủ" — TỔNG
kcal/24h KHÔNG đổi, chỉ đổi hình dạng đường xả theo giờ. CHỈ sửa: lib/metabolicConstants.ts,
domain/energy/metabolismEngine.ts, domain/energy/energyBalanceEngine.ts, store/energyStore.ts
(chỉ lệnh gọi burnPassive trong tickDrain, không đụng gì khác trong file đó),
hooks/useLiveEnergyReading.ts, và test liên quan. KHÔNG đụng App.tsx, useDrainTick.ts,
SettingsScreen.tsx, BodyProfileCard.tsx. KHÔNG chạy cùng lúc với gói S-F (cùng đụng
metabolicConstants.ts/metabolismEngine.ts). Viết test xác nhận tổng kcal/24h tròn không đổi so
với trước — đây là tiêu chí quan trọng nhất. Chạy `npx tsc --noEmit` + `npx jest` + `npx expo
export --platform ios` trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-K.md. Mô tả kế
hoạch ngắn cho tôi duyệt trước khi code.
```

---

## S-L · Ghi nhận cân nặng theo thời gian (tiền đề cho hiệu chỉnh cá nhân hoá thật)

**Quyết định đã chốt với người dùng (2026-06-18):** cho mục "cá nhân hoá MET/hệ số công việc",
người dùng chọn hướng **hiệu chỉnh thật theo xu hướng cân nặng** (không phải thanh chỉnh % tự
chọn). Hướng đó cần so sánh cân nặng thực tế thay đổi theo thời gian với dự đoán của công thức —
nhưng app **hiện chưa ghi cân nặng theo thời gian ở đâu cả** (chỉ có 1 số `weightKg` hiện tại
trong hồ sơ, bị ghi đè mỗi lần sửa). Gói này làm **bước 1**: ghi nhận dữ liệu. **Bước 2** (so sánh
dự đoán vs thực tế, tự động điều chỉnh hệ số) cần vài tuần dữ liệu thật → gộp vào **S-G** (xem
mục S-G bên dưới), không làm trong gói này.

**File ĐƯỢC sửa / tạo:**
- TẠO `src/data/repositories/healthSignalsRepository.ts` — đọc/ghi bảng `health_signals` đã có
  sẵn trong `schema.ts` (cột `id/timestamp/source/type/value`, KHÔNG cần đổi schema). Ghi với
  `source = 'manual'`, `type = 'weight_kg'`. Hàm: `logWeight(kg: number)`,
  `getWeightHistory(limit?: number)` (trả về mảng `{timestamp, value}` sắp theo thời gian).
- TẠO `src/components/WeightLogCard.tsx` — 1 ô nhập số + nút "Ghi nhận cân nặng hôm nay", hiện
  danh sách/ngày gần nhất đã ghi (text đơn giản, KHÔNG cần vẽ biểu đồ ở gói này).
- SỬA `src/screens/HistoryScreen.tsx` — chèn `<WeightLogCard>` (vd dưới `<TrendChart>`).

**KHÔNG đụng:** `src/data/db/schema.ts` (bảng đã có, không cần đổi), `BodyProfileCard.tsx`,
`SettingsScreen.tsx`, `App.tsx`, `energyStore.ts`, `package.json`.

**Ràng buộc:**
- Đây CHỈ là ghi nhận dữ liệu — không tính toán hiệu chỉnh gì, không đổi `passiveDailyBurn` hay
  bất kỳ pin nào. An toàn tuyệt đối với mọi gói khác.
- Ghi rõ trong UI đây là ghi nhận **tự nguyện**, không bắt buộc, không gắn nhận xét/đánh giá về
  số cân nặng (ranh giới sức khoẻ — `.ai/CONTEXT.md` mục 5).

**Tiêu chí hoàn thành:** ghi cân nặng hôm nay → đóng/mở app vẫn thấy trong danh sách; ghi nhiều
ngày → thấy đủ các mốc theo thời gian. `tsc` sạch; `npx jest` xanh; `expo export --platform ios` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói S-L). Nhập vai agent
logic-backend. Nhiệm vụ: cho phép ghi nhận cân nặng theo thời gian, dùng bảng health_signals đã
có sẵn (source='manual', type='weight_kg'), KHÔNG đổi schema. CHỈ tạo:
data/repositories/healthSignalsRepository.ts, components/WeightLogCard.tsx; CHỈ sửa:
screens/HistoryScreen.tsx (chèn component mới). KHÔNG đụng schema.ts, BodyProfileCard.tsx,
SettingsScreen.tsx, App.tsx, energyStore.ts, package.json. Đây chỉ là ghi nhận dữ liệu, không
tính hiệu chỉnh gì. Chạy `npx tsc --noEmit` + `npx jest` + `npx expo export --platform ios` trước
khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-L.md. Mô tả kế hoạch ngắn cho tôi duyệt
trước khi code.
```

---

## S-G · Lớp thông minh dự báo (Phase 5) — ⏸ làm SAU CÙNG

Cần ~1 tháng dữ liệu thật. Bắt đầu bằng rule-based, kèm disclaimer y tế (CONTEXT mục 5). Giao agent `data-ml`.

**Bổ sung (quyết định 2026-06-18):** khi tới lúc làm, S-G cũng là nơi triển khai "hiệu chỉnh cá
nhân hoá thật" cho `OCCUPATION_FACTORS`/MET — so sánh xu hướng cân nặng thật (đọc từ
`healthSignalsRepository`, gói **S-L**) với mức tiêu hao công thức dự đoán trong cùng giai đoạn,
rồi đề xuất (không tự áp đặt) một hệ số điều chỉnh cá nhân. Cần đủ dữ liệu cân nặng từ S-L trước
khi bắt đầu — nếu S-L chưa chạy hoặc chưa có đủ tuần dữ liệu, làm bước đó sau.

---

## S-H · Tích hợp "năng lượng tự xả" (metabolism) vào pin — ✅ v1 xong + mở rộng Session 5

Đã triển khai & verify. Chi tiết đầy đủ trong `docs/06-energy-expenditure.md` mục 3 và
`docs/07-food-log.md`. Tóm tắt: pin TỔNG là pin "Năng lượng" (sức chứa = TDEE, nạp khi ăn — tự
từ Protein/Carbs + nút nhập tay + **Food Log chọn món từ `food_items.csv`**, xả theo BMR + bước
chân + buổi tập). Có form "Hồ sơ cơ thể" (đủ cân nặng/chiều cao/**tuổi/giới tính thật**) trong
Cài đặt. Session 5 thêm: Food Log (ghi món ăn có sẵn), "Hôm nay đã ăn" (xem/xoá theo bữa), và
pin Năng lượng **xả mượt theo giây** trên màn hình (`LiveMasterBattery` + `useLiveEnergyReading`).

**Còn lại, chưa thành gói riêng:**
- Bước chân thật (không phải nhập tay/trung bình) → xem **S-F** (và S-F v2).

**Đã thảo luận & quyết định với người dùng (2026-06-18) — không còn "chưa rõ spec":**
- Rải xả theo nhịp thức/ngủ → tách thành gói **S-K** (xem bên dưới).
- Hệ số/MET cá nhân hoá hơn (theo xu hướng cân nặng thật) → bước 1 là gói **S-L** (ghi dữ liệu),
  bước 2 (tính hiệu chỉnh) gộp vào **S-G** khi đủ dữ liệu.
- "Carry-over" năng lượng dư/thiếu qua ngày hôm sau → **quyết định KHÔNG làm**: giữ mỗi ngày là
  1 pin mới, không mang dư/thiếu qua ngày, để tránh tạo cảm giác "nợ năng lượng" dồn — đúng ranh
  giới sức khoẻ "không tạo mục tiêu cực đoan" (`.ai/CONTEXT.md` mục 5). Không cần làm gì thêm.

> ⚠️ Ranh giới sức khoẻ: luôn kèm disclaimer "chỉ tham khảo", không tạo mục tiêu cực đoan (`.ai/CONTEXT.md` mục 5).

---

## S-I · Khung giờ bữa ăn sửa được trong Cài đặt

**Mục tiêu:** `DEFAULT_MEAL_WINDOWS` (sáng 5–10h / trưa 10–14h / tối 17–21h, ngoài ra = bữa phụ)
hiện hard-code trong `src/lib/constants.ts`. Người dùng đã chọn ở Session 5 ("mặc định cố định,
sửa sau trong Cài đặt") — đây là phần "sửa sau" đó.

**File ĐƯỢC sửa / tạo:**
- SỬA `src/store/settingsStore.ts` — thêm state `mealWindows` (kiểu giống
  `Record<'breakfast'|'lunch'|'dinner', MealWindow>`, mặc định = `DEFAULT_MEAL_WINDOWS`), setter
  `setMealWindow(meal, window)`; persist như các field khác trong store.
- SỬA `src/domain/food/foodNutrition.ts` — `mealTypeForHour`/`mealTypeForTimestamp` nhận thêm
  tham số tuỳ chọn `windows` (mặc định `DEFAULT_MEAL_WINDOWS` nếu không truyền) — **giữ test cũ
  `foodNutrition.test.ts` chạy được KHÔNG sửa** vì có default.
- SỬA `src/store/energyStore.ts` — trong `logFood`, lấy `useSettingsStore.getState().mealWindows`
  và truyền vào `mealTypeForTimestamp(timestamp, mealWindows)`.
- SỬA `src/screens/SettingsScreen.tsx` — thêm section mới "KHUNG GIỜ BỮA ĂN", 3 dòng (sáng/trưa/
  tối) mỗi dòng 2 bộ đếm giờ bắt đầu/kết thúc (tái dùng đúng pattern stepper `+/−` đã có cho giờ
  nhắc nhở ở section THÔNG BÁO).

**KHÔNG đụng:** `App.tsx`, `BodyProfileCard.tsx`, `FoodLogModal.tsx`, `TodayMeals.tsx`,
`foodLogSummary.ts`, `package.json`. **Không chạy song song với gói S-F** (cả hai sửa
`SettingsScreen.tsx` — làm xong 1 gói, commit, rồi mới làm gói kia).

**Ràng buộc:**
- Validate `startHour < endHour`, cả hai trong `0–23`, không cho 3 khung giờ chính chồng lấn
  nhau (nếu chồng lấn, hiện cảnh báo nhẹ — không cần chặn cứng, đây là tool tự theo dõi).
- Đừng đổi `DEFAULT_MEAL_WINDOWS` trong `constants.ts` — nó vẫn là giá trị mặc định/fallback.

**Tiêu chí hoàn thành:** đổi khung giờ trưa trong Cài đặt → ghi món ăn lúc 15h trước đó được tính
"bữa phụ", giờ tính "bữa trưa" (hoặc tương tự, theo khung mới); đổi rồi đóng/mở app vẫn giữ. `tsc`
sạch; `npx jest` xanh; `expo export --platform ios` OK.

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/07-food-log.md và .ai/NEXT_SESSIONS.md (gói S-I).
Nhập vai agent mobile-frontend. Nhiệm vụ: cho phép sửa khung giờ phân loại bữa ăn (sáng/trưa/tối)
trong Cài đặt. CHỈ sửa: settingsStore.ts, domain/food/foodNutrition.ts (thêm tham số tuỳ chọn,
giữ test cũ chạy được), store/energyStore.ts (logFood truyền khung giờ từ settings),
screens/SettingsScreen.tsx (section mới). KHÔNG đụng App.tsx, BodyProfileCard.tsx,
FoodLogModal.tsx, TodayMeals.tsx, package.json. KHÔNG chạy cùng lúc với gói S-F (cùng đụng
SettingsScreen.tsx). Chạy `npx tsc --noEmit` + `npx jest` + `npx expo export --platform ios`
trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-I.md. Mô tả kế hoạch ngắn cho tôi
duyệt trước khi code.
```

---

## S-J · Dọn dẹp tài liệu / gộp báo cáo Session 4 + 5

**Mục tiêu:** `.ai/SESSION_LOG.md` và `.ai/CONTEXT.md` mục 10 hiện vẫn ghi "sau Session 4", chưa
có entry cho 5 báo cáo song song (`S-A`…`S-E`) lẫn Session 5 (Food Log, Today's Meals, pin xả
mượt/giây — 3 commit local). `docs/04-roadmap.md` cũng chưa tick các mục đã xong (biểu đồ xu
hướng, nhắc nhở, tự xả pin, unit test). Gói này chỉ viết lại tài liệu cho khớp code thật —
**không sửa code, không rủi ro conflict với gói nào khác.**

**File ĐƯỢC sửa:** `.ai/SESSION_LOG.md`, `.ai/CONTEXT.md` (chỉ mục 10), `docs/04-roadmap.md`,
`.ai/NEXT_SESSIONS.md` (tick các gói đã xong khi S-F/S-I hoàn thành sau này).

**KHÔNG đụng:** mọi file trong `src/`, `App.tsx`, `package.json`.

**Tiêu chí hoàn thành:** `SESSION_LOG.md` có entry tổng hợp S-A…S-E + Session 5; `CONTEXT.md`
mục 10 phản ánh đúng: 92 test PASS, bundle hiện tại, có Food Log + pin xả mượt/giây, 3 commit
local chưa push, S-A vẫn chưa test máy thật; `roadmap.md` tick đúng các Phase đã xong.

**Prompt copy-paste:**
```
Đọc .ai/parallel-reports/*.md, git log gần đây (5 commit cuối), CLAUDE.md, AGENTS.md. Nhiệm vụ:
gộp các báo cáo S-A…S-E và 3 commit Session 5 (Food Log, Today's Meals, pin xả mượt/giây) thành
1 entry trong .ai/SESSION_LOG.md, cập nhật .ai/CONTEXT.md mục 10 cho đúng trạng thái thật (số
test hiện tại qua `npx jest`, bundle qua `npx expo export --platform ios`, danh sách commit chưa
push), và tick các mục đã xong trong docs/04-roadmap.md. CHỈ sửa các file tài liệu này — KHÔNG
sửa bất kỳ file trong src/, App.tsx, hay package.json. Báo cáo lại cho tôi bằng tiếng Việt.
```

---

## 🔍 Ghi chú review tích hợp (Opus, 2026-06-18)

Đã rà soát chéo S-D (tick xả pin + reset ngày) + S-H (metabolism/energy battery) + Food Log +
pin xả mượt/giây, tìm lỗi kiểu đếm trùng kcal / lệch giữa hiển thị mượt và DB / lỗi khi sang
ngày mới. Kết quả:

- ✅ **Không đếm trùng kcal:** `addIntake` / `addCalories` / `logFood` trong `energyStore.ts`
  nạp năng lượng qua đúng 1 đường mỗi lần, không chồng nhau (đã có comment trong code xác nhận
  ý đó cho `logFood`).
- ✅ **Hiển thị mượt theo giây không lệch:** `useLiveEnergyReading` dùng lại đúng hàm thuần
  `burnPassive` và mốc `lastDrainSyncAt` mà tick thật (`tickDrain`) dùng — không thể lệch hoặc
  đếm trùng.
- ✅ Đã sửa 1 dòng tài liệu sai trong `docs/04-roadmap.md` (Phase 2): ghi nhầm là reset ngày mới
  dùng `resetForNewDay`, thực ra `resetForNewDay` hiện **không được gọi ở đâu cả** (dead code) —
  cơ chế thật là `App.tsx` tự dò đổi ngày (mỗi 15 phút + khi mở lại app) rồi gọi `loadToday`,
  một lựa chọn có chủ đích từ gói S-D gốc (xem `.ai/parallel-reports/S-D.md` dòng 28).
- ⚠️ **1 lỗi nhỏ, mức độ thấp, chưa cần vá gấp:** `tickDrain` (chạy mỗi 30 phút hoặc khi mở app
  từ nền) và việc dò đổi ngày trong `App.tsx` (mỗi 15 phút) là 2 timer **độc lập, không đồng bộ**.
  Nếu app đang mở đúng lúc qua nửa đêm, có một khoảng tối đa ~15 phút mà `tickDrain` vẫn xả tiếp
  vào dữ liệu **của ngày hôm trước** (vì state trong RAM chưa kịp đổi sang ngày mới) trước khi
  `loadToday` chạy và làm mới pin cho ngày mới. Hậu quả thực tế rất nhỏ:
  - Dữ liệu ngày hôm nay không bị ảnh hưởng (luôn được làm mới đúng khi `loadToday` chạy).
  - Mức pin "cuối ngày" lưu cho hôm trước có thể lệch thấp hơn vài kcal so với đúng 24h (không
    đáng kể, app chỉ "tham khảo" không phải thiết bị đo chính xác y tế).
  - Phần dễ thấy nhất (nếu có): nếu người dùng đang mở app đúng lúc giao thừa, pin có thể tiếp
    tục tụt thêm vài phút trước khi "nhảy" lên đầy cho ngày mới, thay vì làm mới ngay tại 0h.
  - **Đề xuất:** không cần gói riêng. Khi nào có session làm **S-K** (gói đó đã đổi `burnPassive`
    sang nhận `fromMs`/`toMs` thay vì `elapsedHours`), tiện thể có thể chặn `toMs` lại ở mốc nửa
    đêm cùng lúc — sửa miễn phí, không tốn thêm gói riêng. Nếu không ai đụng S-K trong thời gian
    dài, có thể bỏ qua vì mức độ ảnh hưởng quá nhỏ.

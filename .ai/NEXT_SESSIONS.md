# 🧩 NEXT SESSIONS — Phân công công việc cho nhiều phiên Sonnet 4.6 chạy song song

> Mục tiêu: tách phần việc còn lại của dự án thành các **gói độc lập**, mỗi gói chỉ
> động vào **một nhóm file riêng**, để bạn có thể mở **nhiều cửa sổ chat Sonnet 4.6
> cùng lúc** mà chúng không sửa đè lên nhau (không bị "conflict").
>
> Cập nhật: 2026-06-18 (Session 6 — Opus: review tích hợp + gộp `.ai/NEXT_SESSIONS_UX.md` vào
> đây rồi xoá file đó + **đã push hết lên `origin/main`**, không còn commit nào treo lại cục bộ).
>
> **Cập nhật tiếp (cùng ngày, lúc khép phiên):** trong lúc chốt tài liệu, phát hiện **nhiều phiên
> Sonnet/Opus khác đang chạy song song** trên cùng máy đã hoàn tất **S-L** (ghi cân nặng — xong)
> và chốt với người dùng một **quyết định lớn, đụng lõi**: lật mô hình pin Năng lượng từ "xả dần"
> sang "đã ăn / mục tiêu" (đếm lên) — xem gói mới **S-M** bên dưới. Quyết định này khiến **S-K bị
> tạm dừng** (mâu thuẫn với mô hình mới) và **U1 gộp vào S-M** (S-M viết đè toàn bộ hiển thị pin
> tổng). Đọc kỹ mục S-M trước khi mở phiên nào đụng tới pin Năng lượng.

---

## 🔑 Luật vàng khi chạy song song (đọc trước)

1. **Mỗi phiên CHỈ được sửa các file trong mục "File ĐƯỢC sửa" của gói đó.** Tuyệt đối
   không đụng vào file của gói khác (xem cột "KHÔNG đụng").
2. **Không sửa các file dùng chung** ngoài đúng gói được giao chúng: `.ai/SESSION_LOG.md`,
   `.ai/CONTEXT.md`, `docs/04-roadmap.md` (chỉ gói **S-J**), `App.tsx` (chỉ gói S-D),
   `package.json` (chỉ gói S-E), `src/store/energyStore.ts` (gói **S-M** — đợt lật mô hình pin
   Năng lượng, ưu tiên làm MỘT MÌNH; hoặc gói **U6** — chỉ thêm 1 dòng truyền `mealWindows` vào
   `logFood`; làm xong 1 gói, commit, rồi mới chạy gói kia. **S-K tạm dừng** nên hiện không còn
   đụng file này), `src/screens/SettingsScreen.tsx` (gói **S-F** hoặc **U6**, không cả hai cùng
   lúc — **U6 đã gộp gói S-I**, đừng mở S-I riêng nữa), `src/lib/metabolicConstants.ts` và
   `src/domain/energy/metabolismEngine.ts` (gói **S-F** — đọc, đừng sửa nếu **S-M** đang chạy,
   xem mục S-M).
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
| **S-F** | Bước chân: v1 đặt mức trung bình/ngày (placeholder) | ✅ XONG (code ~2026-06-19, commit 2026-07-03 — xem `.ai/parallel-reports/S-F.md`) | logic-backend | — | không |
| **S-G** | Lớp thông minh dự báo (Phase 5) | 🆕 Luồng "xu hướng dinh dưỡng" đã có spec chi tiết, sẵn sàng làm — xem `S-G-nutrition-trend-intelligence-spec.md` + mục S-G bên dưới (gói con S-G1/S-G2/S-G3a-e). Luồng "hiệu chỉnh MET" vẫn chờ như cũ. | data-ml | ✅ S-G1/S-G2/S-G3a-d có thể chạy song song (file riêng); S-G3e sau S-G1 | S-L (đã xong 2026-06-18) |
| **S-H** | "Năng lượng tự xả" (metabolism) vào pin — Hướng B | ✅ v1 xong; Session 5 mở rộng thêm Food Log + pin xả mượt/giây | logic-backend + mobile-frontend | — | `docs/06-`, `docs/07-` |
| **S-I** | Khung giờ bữa ăn sửa được trong Cài đặt | 🔁 Đã gộp vào **U6** (2026-06-18) — đừng chạy riêng, xem mục U6 | mobile-frontend | — | xem U6 |
| **S-J** | Dọn dẹp tài liệu / gộp báo cáo Session 4+5 | ✅ XONG (2026-06-18, qua tư vấn Opus) | (không cần agent riêng) | ✅ luôn được, không đụng code | không |
| **S-K** | Rải xả pin Năng lượng theo nhịp thức/ngủ (thay rải đều 24h) | ♻️ **HỒI SINH & GỘP vào S-O** (2026-07-04) — lõi kỹ thuật circadian nay là gói S-O. Đừng mở S-K riêng. | logic-backend | — | xem S-O |
| **S-L** | Ghi nhận cân nặng theo thời gian (tiền đề cho hiệu chỉnh cá nhân hoá thật) | ✅ XONG (2026-06-18) — xem `.ai/parallel-reports/S-L.md` | logic-backend | — | không |
| **S-M** | Lật pin Năng lượng sang "đã ăn / mục tiêu" (đếm lên) — đụng lõi | ✅ XONG code (2026-07-03, phiên song song — xem `.ai/parallel-reports/S-M.md`); ⚠️ chưa test máy, kiểm tra đã commit chưa trước khi mở gói đụng các file S-M | logic-backend + mobile-frontend | — | không |
| **U1** | Đợt UX: Pin tổng + con số năng lượng (hiển thị) | 🔁 **Đã gộp vào S-M** (2026-06-18) — đừng làm riêng, S-M viết đè toàn bộ hiển thị pin tổng | mobile-frontend | — | xem S-M |
| **U2** | Đợt UX: Nạp & ghi món (modal/bàn phím/luồng) | ✅ XONG (2026-06-18) — xem `.ai/parallel-reports/U2.md` | mobile-frontend | — | không |
| **U3** | Đợt UX: Lịch sử + biểu đồ | ✅ XONG (2026-06-18) — xem `.ai/parallel-reports/U3.md` | mobile-frontend | — | không |
| **U4** | Đợt UX: Nhật ký | ✅ XONG (2026-06-19) — xem `.ai/parallel-reports/U4.md` | mobile-frontend | ✅ | không |
| **U5** | Đợt UX: Onboarding lần đầu | ✅ XONG (2026-06-19) — xem `.ai/parallel-reports/U5.md` | mobile-frontend | ✅ | không |
| **U6** | Đợt UX: Cài đặt (UX) + khung giờ bữa ăn (gộp S-I) | ✅ XONG (2026-06-19) — xem `.ai/parallel-reports/U6.md` | mobile-frontend | — | không |
| **S-N** | Tích hợp dữ liệu dinh dưỡng USDA (FoodData Central) — pipeline offline, BỔ SUNG món Việt | ✅ XONG (2026-07-03) — xem `.ai/parallel-reports/S-N.md` | data-ml + logic-backend | ✅ | không |
| **U7** | 🆕 UI tra cứu USDA trong ghi món + cơ chế dịch `name_vi` theo nhu cầu | ✅ XONG (2026-07-07, vượt spec): cả 363 name_vi đã dịch trong `database/usda_names_vi.csv`; công tắc "Món Việt \| USDA" bị GỠ, thay bằng tìm kiếm gộp song ngữ `src/data/food/foodSearch.ts` (searchAllFoods — index bỏ dấu, ưu tiên khớp đúng dấu, món Việt trước) | mobile-frontend (+ data-ml cho Phần B) | ✅ | không |
| **L-1** | 🆕 Sửa 2 lint error tồn đọng (đưa baseline ESLint về 0) | ✅ XONG (2026-07-07): 0 lint error (lỗi HistoryScreen `loadHistory` hoisting đã sửa); còn 23 warning đang được dọn trong W-1 | logic-backend | ✅ | không |
| **S-O** | 🆕 Pin "no/đói" tụt dần theo nhịp sinh học (hồi sinh S-K) — engine thuần | 🆕 Sẵn sàng làm — xem spec `S-O-satiety-battery-spec.md` + mục S-O/S-P/S-Q bên dưới | logic-backend | ✅ với S-P (file rời) | không |
| **W-1** | Dọn 23 lint warning về 0 + vá lỗi tickDrain xả qua nửa đêm | ✅ XONG (2026-07-07): clamp `clampElapsedHoursAtMidnight` trong batteryEngine + test hồi quy 23:50→00:20; lint 0 error 0 warning | logic-backend | ✅ với G-1 (file rời) | không |
| **G-1** | Thêm tên tiếng Đức `name_de` cho danh mục món + tìm kiếm 3 ngôn ngữ | ✅ XONG (2026-07-07): 90+363 tên Đức (`food_items.csv` cột name_de + `database/usda_names_de.csv`); tìm được cả "brötchen/broetchen/brotchen" | data-ml | ✅ với W-1 (file rời) | không |
| **S-P** | 🆕 Mục tiêu cân nặng → mục tiêu kcal/ngày có thâm hụt an toàn | 🆕 Sẵn sàng làm — xem spec + mục S-O/S-P/S-Q bên dưới | logic-backend | ✅ với S-O (file rời) | không |
| **S-Q** | 🆕 Lắp ráp 2 đồng hồ (Pin no/đói + Sổ calo) + reset 6h + UI + nhắc nhẹ — ⚠️ đụng lõi | 🆕 Chờ S-O + S-P xong — xem spec + mục S-O/S-P/S-Q bên dưới | logic-backend + mobile-frontend | ⚠️ ĐƠN, sau S-O+S-P | S-O, S-P |
| **S-R** | 🆕 Pin vi chất THẬT (Đạm/Xơ/Sắt/Canxi… + Muối/Đường) dẫn xuất từ nhật ký món, tận dụng dữ liệu USDA/CSV có sẵn | 🆕 ĐỀ XUẤT (chưa chốt) — xem spec `S-R-micronutrient-batteries-spec.md` + mục S-R bên dưới | logic-backend + mobile-frontend | ⚠️ sau S-Q (chỉ vì đụng Home) | S-Q (chỉ tránh đụng Home) |
| **S-S** | "Cập nhật lịch sử" — ghi lùi món ăn cho ngày đã qua (backfill), 6 gói con S-S1…S-S6 | ✅ XONG code (2026-07-10, chạy cả 4 đợt trong 1 phiên điều phối — xem `.ai/parallel-reports/S-S1..S-S6.md`; QA tìm 2 bug double-tap → ĐÃ VÁ kèm test; tsc + jest 351/351 + eslint + expo export sạch). ⚠️ CHƯA test máy (checklist ở S-S6.md); ⚠️ chưa commit — cây làm việc còn lẫn thay đổi phiên khác (water-unit ml/L) | logic-backend + mobile-frontend + qa-reviewer | — | test máy theo S-S6.md |
| **S-T3** | Undo nút Vận động (movement event) in-app | ✅ **OBSOLETE/CLOSED (2026-07-16)** — quick-tap movement UI path REMOVED (S-PL session): small-battery pins (Protein/Carbs/Minerals/Movement) → DISPLAY-ONLY + BatterySourceSheet; IntakeModal stepType selector deleted. Un-undoable quick-tap không còn xảy ra từ UI. Store API addIntake('movement') giữ backward compat. | logic-backend | — | ✅ closed |

> **Cập nhật 2026-06-19:** U4, U5, U6 — **đã hoàn thành cả 3** (xem parallel-reports). S-A (test máy)
> lúc nào cũng chạy được. S-J và S-L **đã xong**. **S-M là việc lớn ưu tiên tiếp theo** (lật mô hình pin Năng
> lượng, quyết định 2026-06-18) — đề nghị làm **MỘT MÌNH 1 đợt riêng**, không xen với gói nào đụng
> `energyStore.ts`/`MasterBattery.tsx`. **S-F** có thể làm ngay song song với S-A. Trong lúc S-M chạy:
> **S-K tạm dừng hẳn** (mâu thuẫn mô hình mới), **U1 gộp vào S-M** (đừng mở riêng). S-G để sau cùng (cần
> dữ liệu cân nặng từ S-L, xem mục S-G).

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

> ♻️ **ĐÃ HỒI SINH & GỘP vào S-O (2026-07-04).** Ý tưởng "rải xả theo nhịp thức/ngủ" của gói này
> nay là **lõi của gói S-O** (Pin no/đói tụt dần) trong bộ nâng cấp **S-O + S-P + S-Q** — xem
> `.ai/parallel-reports/S-O-satiety-battery-spec.md` và mục **S-O/S-P/S-Q** ở cuối file này.
> **Đừng mở S-K riêng nữa.** Phần kỹ thuật `passiveBurnKcalBetween` + hằng số circadian + bất biến
> "tổng 24h = passiveDailyBurn" mô tả dưới đây vẫn đúng và được **tái dùng trực tiếp trong S-O**.
>
> _(Lịch sử: tạm dừng 2026-06-18 vì tưởng mâu thuẫn với S-M "không xả theo thời gian". 2026-07-04
> người dùng chốt mô hình 2 đồng hồ: Sổ calo đếm lên (S-M) + Pin no/đói tụt dần (S-K hồi sinh) —
> hai cái bổ sung nhau, không mâu thuẫn.)_

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

## S-M · Lật pin Năng lượng sang "đã ăn / mục tiêu" (đếm lên) — ⚠️ đụng lõi

> ✅ **XONG (2026-07-03) — xem `.ai/parallel-reports/S-M.md`.** ♻️ **2026-07-04: đổi vai.** Người
> dùng chốt mô hình **2 đồng hồ** (bộ nâng cấp **S-O + S-P + S-Q**): engine S-M này **được GIỮ
> LẠI** làm lớp **"Sổ calo hôm nay"** (đếm lên, nay reset **6h sáng** + mục tiêu từ cân nặng mong
> muốn), còn **pin chính (headline) chuyển sang "Pin no/đói" tụt dần** (gói S-O). Không vứt bỏ
> S-M — chỉ hạ nó xuống thành dòng phụ dưới pin no. Xem
> `.ai/parallel-reports/S-O-satiety-battery-spec.md`.

> ✅ **Hướng đã chốt với người dùng (2026-06-18).** Spec đầy đủ (định nghĩa số, hình UI, ảnh
> hưởng dây chuyền) đã viết sẵn ở **`.ai/parallel-reports/S-M-energy-redesign-spec.md`** — đọc
> file đó TRƯỚC, đây chỉ là phần đóng gói/điều phối. Lý do đổi: pin clamp 100% khiến ăn dư "biến
> mất" và app không bao giờ cho thấy người dùng ăn vượt nhu cầu (xem
> `.ai/parallel-reports/B1-energy-balance-spec.md` cho bối cảnh đầy đủ của vấn đề).

**Mục tiêu:** thanh pin Năng lượng đổi từ "còn lại, xả dần" sang "đã ăn hôm nay / mục tiêu ngày"
(đếm LÊN, đầy dần khi ăn). Thêm 1 con số sống "còn được ăn ngay" tăng dần theo thời gian (tái
dùng cơ chế tick/giây của Session 5, đổi mục đích — KHÔNG xoá).

**File sở hữu (theo spec mục 6):** `domain/energy/energyBalanceEngine.ts` (đổi semantics +
test), `domain/energy/metabolismEngine.ts` (chỉ ĐỌC `dailyExpenditure`, đừng đụng nếu S-F đang
chạy), `store/energyStore.ts` (eaten counters, bỏ `burnPassive` cho energy trong `tickDrain`,
`burnActivity` cộng vào goal thay vì trừ level), `hooks/useLiveEnergyReading.ts`,
`components/MasterBattery.tsx` + `LiveMasterBattery.tsx`, `types/energy.ts`/`types/battery.ts`
nếu cần.

**⚠️ Bắt buộc làm MỘT MÌNH 1 đợt (theo spec mục 4 & 6) — tạm hoãn trong lúc S-M chạy:**
- **S-K** — vô nghĩa với mô hình mới, đã đánh dấu tạm dừng ở mục S-K.
- **U1** — đã gộp hẳn vào S-M (S-M định nghĩa lại toàn bộ hiển thị pin tổng).
- **U6** — cùng đụng `energyStore.ts` (U6 sửa `logFood`, S-M sửa phần khác) → serialize, không
  song song.
- **S-F** — nếu S-F đang sửa `metabolismEngine.ts` cùng lúc, dễ đụng nhau ở `dailyExpenditure`.
- **An toàn chạy cùng S-M:** U2 (đã xong), U3 (chỉ hiển thị, đọc theo S-M không sửa engine), U4,
  U5, S-A.

**Trước khi code, cần người dùng xác nhận lại 3 điểm (spec mục 7):**
1. Hình UI mục 2 của spec (vị trí dòng "còn được ăn ngay") — ổn chưa?
2. Cảnh báo "pin thấp" hiện tại: bỏ hẳn, hay đổi thành "nhắc khi ăn vượt mục tiêu nhiều"?
3. Vận động (đi bộ/tập) cộng vào MỤC TIÊU (giả định trong spec) — đúng ý không?

**Ràng buộc sức khoẻ (BẮT BUỘC — CONTEXT mục 5):** pin rỗng buổi sáng là bình thường, KHÔNG tô đỏ
hù "pin yếu"; ăn vượt dùng từ ngữ trung tính ("ăn dư"), không "xấu/tệ"; không khuyến khích nhịn để
"giữ pin thấp"; kèm "Chỉ để tham khảo."

**Xong khi:** `tsc` sạch + `jest` xanh (cập nhật test `energyBalanceEngine`) + `expo export` OK +
test trên máy cùng người dùng (ăn → bar lên; để lâu không ăn → "còn được ăn" tăng; ăn vượt mục
tiêu → hiện "ăn dư").

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-M-energy-redesign-spec.md (spec
đầy đủ, ĐỌC TRƯỚC) và .ai/NEXT_SESSIONS.md (mục S-M). Nhập vai agent logic-backend + mobile-
frontend. Nhiệm vụ: lật pin Năng lượng từ "xả dần" sang "đã ăn/mục tiêu" (đếm lên) đúng theo spec
— level=eaten bắt đầu 0, capacity=dailyExpenditure (gồm vận động), bỏ burnPassive khỏi tickDrain
cho energy, thêm con số sống "còn được ăn ngay" tái dùng cơ chế tick/giây cũ. CHỈ sửa:
domain/energy/energyBalanceEngine.ts (+test), store/energyStore.ts, hooks/useLiveEnergyReading.ts,
components/MasterBattery.tsx + LiveMasterBattery.tsx, types liên quan nếu cần — chỉ ĐỌC
metabolismEngine.ts, đừng sửa nếu S-F đang chạy. Đây là việc đụng lõi — xác nhận lại 3 điểm ở mục
"7. Việc cần người dùng xác nhận" trong spec TRƯỚC khi code, đợi tôi duyệt. Tuân thủ ranh giới sức
khoẻ CONTEXT mục 5 (pin rỗng sáng = bình thường, không hù, từ ngữ trung tính khi ăn vượt). Chạy
`npx tsc --noEmit` + `npx jest` + `npx expo export --platform ios` trước khi báo xong. Ghi báo cáo
vào .ai/parallel-reports/S-M.md.
```

---

## S-N · Tích hợp dữ liệu dinh dưỡng USDA (FoodData Central) — pipeline offline

> ✅ **Hướng đã chốt với người dùng (2026-07-03, tư vấn Opus).** Spec đầy đủ (bảng ánh xạ chất,
> cảnh báo chất lượng dữ liệu, thuật toán script, cấu trúc thư mục) ở
> **`.ai/parallel-reports/S-N-food-data-usda-spec.md`** — **ĐỌC FILE ĐÓ TRƯỚC**, mục này chỉ đóng
> gói/điều phối.
>
> ⚠️ **TUYỆT ĐỐI KHÔNG mở/đọc file JSON 6.4MB bằng công cụ đọc file** (tốn hàng chục nghìn token).
> Chỉ chạm vào nó **qua Node** (`node -e ...` hoặc chính script sẽ viết). Đây là lý do cốt lõi của
> cả gói: file nặng chỉ được **script chạy máy** đọc, AI không bao giờ đọc.

**Mục tiêu:** biến `FoodData_Central_foundation_food_json_2026-04-30.json` (6.4MB, 363 nguyên liệu
Mỹ) thành một **danh sách tra cứu gọn nhẹ RIÊNG**, offline, **bổ sung** (không thay thế) danh sách
món Việt `food_items.csv`. Chỉ làm **pipeline dữ liệu** (script + file gọn + module loader + test),
**KHÔNG đụng UI** để chạy độc lập, không conflict gói nào.

**File ĐƯỢC sửa / tạo:**
- TẠO thư mục `database/` với `database/raw/` (chứa file nặng, KHÔNG commit) và `database/extract/`
  (file gọn, CÓ commit) + `database/README.md` (hướng dẫn cập nhật). **Chuyển** file JSON từ gốc
  repo vào `database/raw/`.
- SỬA `.gitignore` — thêm `database/raw/*.json` (đừng để git nuốt file 6.4MB). **Làm bước này ĐẦU
  TIÊN** trước khi bất kỳ `git add` nào.
- TẠO `scripts/generate-usda-db.js` (mô hình giống `scripts/generate-food-db.js`, xem spec mục 7).
- TẠO `database/extract/usda_foundation_foods.csv` (do script sinh — cùng header `food_items.csv`).
- TẠO `src/data/food/usdaFoods.generated.ts` (do script sinh — `USDA_FOOD_CSV_RAW`).
- TẠO `src/data/food/usdaFoods.ts` (loader: **tái dùng** `parseFoodCsv`, thêm `searchUsdaFoods`).
- TẠO `src/data/food/__tests__/usdaFoods.test.ts` (test loader parse đúng, có id `usda_`, energy
  Atwater đúng cho vài case).
- SỬA `package.json` — thêm script `"gen:usda": "node scripts/generate-usda-db.js"`.

**KHÔNG đụng:** `food_items.csv` (nguồn món Việt — GIỮ NGUYÊN), `src/data/food/foodDatabase.ts`,
`src/data/food/foodCsv.ts` (chỉ IMPORT `parseFoodCsv`, KHÔNG sửa), `src/data/food/foodDatabase.generated.ts`,
`src/store/energyStore.ts`, `App.tsx`, mọi screen/component (KHÔNG làm UI trong gói này — tab tra
cứu USDA là gói riêng về sau), `src/services/export/*`.

**Ràng buộc (đọc spec cho đầy đủ):**
- BỔ SUNG, không thay thế: USDA là module RIÊNG (`USDA_FOODS`), KHÔNG trộn vào `FOOD_ITEMS`.
- `.filter(Boolean)` bỏ 32 phần tử null trong `FoundationFoods` (395 → 363 hợp lệ).
- Energy: chỉ 95/363 món có #208 → thiếu thì tính **Atwater** `protein*4 + carb*4 + fat*9`, ghi
  `note = "kcal computed (Atwater)"`. Sugar/fiber thiếu → `0`, **đừng bịa số**.
- Đơn vị USDA Foundation đã per-100g; micro theo mg — khớp cột app, không cần scale.
- Offline, KHÔNG dùng API (spec mục 9). KHÔNG cài thư viện mới (xuất Excel dùng `xlsx` đã có).

**Trước khi code, xác nhận 3 điểm với người dùng (spec mục 10):** tên `database/` (chữ thường) OK
chưa; `gen:usda` chạy tay hay chain vào `npm start`; có xuất `.xlsx` không.

**Tiêu chí hoàn thành:** `npm run gen:usda` sinh ra CSV gọn + `usdaFoods.generated.ts`; `import`
`USDA_FOODS` cho ra ~363 món có nutrition hợp lệ; `npx tsc --noEmit` sạch; `npx jest` xanh (test
mới xanh); `npx expo export --platform ios` OK; file 6.4MB KHÔNG bị commit (nằm trong
`database/raw/`, đã gitignore).

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-N-food-data-usda-spec.md (SPEC
ĐẦY ĐỦ — ĐỌC TRƯỚC) và .ai/NEXT_SESSIONS.md (mục S-N). Nhập vai agent data-ml + logic-backend.
Nhiệm vụ: viết pipeline offline biến file USDA FoodData Central (database/raw/FoodData_Central_
foundation_food_json_2026-04-30.json, 6.4MB) thành danh sách tra cứu gọn nhẹ RIÊNG, BỔ SUNG (không
trộn vào) danh sách món Việt food_items.csv.

⚠️ TUYỆT ĐỐI KHÔNG đọc file JSON 6.4MB bằng công cụ đọc file — chỉ chạm qua Node (node -e ... hoặc
script). Đọc bằng công cụ đọc file sẽ tốn hàng chục nghìn token.

BƯỚC ĐẦU TIÊN: thêm `database/raw/*.json` vào .gitignore rồi chuyển file JSON vào database/raw/
(tránh commit nhầm 6.4MB). Sau đó: tạo scripts/generate-usda-db.js (mô hình giống scripts/generate-
food-db.js) lọc 13 chất theo bảng ánh xạ trong spec, tự tính energy Atwater khi thiếu #208, sinh
database/extract/usda_foundation_foods.csv (cùng header food_items.csv) + src/data/food/usdaFoods.
generated.ts; tạo src/data/food/usdaFoods.ts (tái dùng parseFoodCsv, KHÔNG sửa foodCsv.ts) +
test; thêm script gen:usda vào package.json.

CHỈ tạo/sửa các file liệt kê ở mục S-N. KHÔNG đụng food_items.csv, foodDatabase.ts, foodCsv.ts,
energyStore.ts, App.tsx, screen/component (KHÔNG làm UI đợt này). Xác nhận 3 điểm ở "mục 10" của
spec với tôi TRƯỚC khi code, đợi tôi duyệt. Chạy `npm run gen:usda` + `npx tsc --noEmit` + `npx
jest` + `npx expo export --platform ios` trước khi báo xong; xác nhận file 6.4MB KHÔNG bị git
theo dõi. Ghi báo cáo vào .ai/parallel-reports/S-N.md. Nói tiếng Việt với tôi, code tiếng Anh.
```

---

## U7 · UI tra cứu USDA khi ghi món + dịch `name_vi` theo nhu cầu

> 🆕 **Nối tiếp S-N (đã xong).** S-N đã tạo `USDA_FOODS` + `searchUsdaFoods` trong
> `src/data/food/usdaFoods.ts` (363 nguyên liệu Mỹ, tên tiếng Anh, `nameVi` để trống). Gói này
> để **lộ dữ liệu đó ra UI** cho người dùng tra cứu khi ghi món, và bổ sung **cơ chế dịch tên
> Việt theo nhu cầu** (chỉ dịch món thực sự dùng tới, không dịch cả 363 món).
>
> Chia **2 phần độc lập** — làm Phần A trước (có giá trị ngay), Phần B khi nào cần:

### Phần A — UI tra cứu USDA (ưu tiên, chỉ 1 file)

**Mục tiêu:** trong màn "Ghi món ăn", thêm công tắc nguồn **"Món Việt | Tra cứu USDA (EN)"**. Chọn
USDA → tìm trong `searchUsdaFoods`, hiện tên tiếng Anh. Chọn xong ghi món chạy y như món Việt.

**File ĐƯỢC sửa:** CHỈ `src/components/FoodLogModal.tsx`.

**⚠️ Cái bẫy BẮT BUỘC xử lý — tên rỗng:** `logFood` trong `energyStore.ts` chụp lại
`foodNameVi: item.nameVi` (dòng ~237). Món USDA có `nameVi` **rỗng** → nếu ghi thẳng, Nhật ký/
Lịch sử sẽ hiện **tên trống**. **Cách vá sạch (KHÔNG đụng `energyStore.ts`):** ngay trong modal,
trước khi gọi `logFood`, nếu `item.nameVi` rỗng thì truyền một bản sao `{ ...item, nameVi:
item.nameEn }` (hoặc tên Việt người dùng vừa nhập ở Phần B). Nhờ vậy file lõi giữ nguyên, gói
độc lập tuyệt đối.

**Ràng buộc:**
- CHỈ sửa `FoodLogModal.tsx`. Import thêm `searchUsdaFoods`/`USDA_FOODS` từ
  `../data/food/usdaFoods`. KHÔNG trộn `USDA_FOODS` vào `searchFoods`/`FOOD_ITEMS`.
- Khi nguồn = USDA: dòng danh sách + tiêu đề chi tiết hiện `item.nameEn` (vì `nameVi` rỗng);
  khi nguồn = Việt: giữ nguyên `item.nameVi` như hiện tại.
- `categoryLabel` đã có fallback `?? category` nên category tiếng Anh của USDA
  (`Beverages`, `Baked Products`…) vẫn hiện được — không cần sửa. Nếu thấy nhãn nào xấu
  (vd `fat_sugar`), **ghi vào report**, đừng tự thêm key vào `constants.ts` (file dùng chung).
- Giữ nguyên logic khẩu phần/giờ ăn/preview hiện có — USDA cũng là `FoodItem` nên dùng chung được
  (`defaultServingG = 100`, không có `servingPresets`).
- KHÔNG đụng `energyStore.ts`, `foodDatabase.ts`, `usdaFoods.ts`, `constants.ts`, `App.tsx`, hay
  file nào khác ngoài `FoodLogModal.tsx`.

**Tiêu chí hoàn thành:** gạt sang "USDA", gõ `beef`/`hummus` → hiện danh sách tiếng Anh; chọn +
nhập gram + ghi → món vào Nhật ký với **tên tiếng Anh (không rỗng)** + kcal đúng. Gạt về "Việt"
tìm `cơm` vẫn chạy như cũ. `npx tsc --noEmit` sạch; `npx jest` xanh; `npx expo export --platform
ios` OK.

**Prompt copy-paste — Phần A:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-N-food-data-usda-spec.md (mục 8)
và .ai/NEXT_SESSIONS.md (mục U7 Phần A). Nhập vai agent mobile-frontend. Nhiệm vụ: trong màn Ghi
món ăn, thêm công tắc nguồn "Món Việt | Tra cứu USDA (EN)"; khi chọn USDA thì tìm bằng
searchUsdaFoods (từ src/data/food/usdaFoods.ts, đã có sẵn từ S-N) và hiện tên tiếng Anh nameEn.
CHỈ được sửa src/components/FoodLogModal.tsx — KHÔNG đụng energyStore.ts, foodDatabase.ts,
usdaFoods.ts, constants.ts, App.tsx hay file khác. BẮT BUỘC xử lý bẫy tên rỗng: món USDA có nameVi
rỗng, mà logFood chụp foodNameVi=item.nameVi → trước khi gọi logFood, nếu nameVi rỗng thì truyền
{ ...item, nameVi: item.nameEn } để Nhật ký không hiện tên trống (KHÔNG sửa energyStore.ts). Đừng
trộn USDA vào FOOD_ITEMS. Mở app cùng tôi, đề xuất bố cục công tắc bằng tiếng Việt, đợi tôi duyệt
mới code. Chạy `npx tsc --noEmit` + `npx jest` + `npx expo export --platform ios` trước khi báo
xong. Ghi báo cáo vào .ai/parallel-reports/U7.md. Nói tiếng Việt, code tiếng Anh.
```

### Phần B — Dịch `name_vi` theo nhu cầu (build-time, tuỳ chọn, làm sau)

**Mục tiêu:** cho phép dịch dần tên Việt cho **chỉ những món USDA hay dùng**, không dịch cả 363.
Cơ chế **build-time** (không phải trình sửa trong app — xem "KHÔNG làm" bên dưới).

**Cách làm (file phủ + join lúc sinh):**
- TẠO `database/usda_names_vi.csv` — 2 cột `id,name_vi` (vd `usda_321358,Hummus (đậu gà nghiền)`).
  Bắt đầu rỗng/vài dòng mẫu. Đây là nơi dịch dần: cần món nào, thêm 1 dòng.
- SỬA `scripts/generate-usda-db.js` — **left-join** file phủ này khi sinh: món nào có `id` trong
  `usda_names_vi.csv` thì điền `name_vi` tương ứng vào cột `name_vi` của
  `usda_foundation_foods.csv`; không có thì để trống như hiện tại. Chạy lại `npm run gen:usda`
  **không mất bản dịch** (vì bản dịch nằm ở file phủ, không ở file sinh ra).
- (Tuỳ chọn) SỬA `searchUsdaFoods` trong `usdaFoods.ts` để tìm cả theo `nameVi` khi đã có bản dịch.

**Vì sao KHÔNG làm trình dịch trong app (chống gold-plating):** để người dùng gõ tên Việt ngay
trong app rồi lưu sẽ cần ghi xuống bộ nhớ thiết bị (AsyncStorage/DB) + đồng bộ với dữ liệu
build-time + xử lý xung đột — nặng và không xứng công. Luồng thực tế của dự án: người dùng nói
"dịch giúp món X" bằng tiếng Việt, một phiên AI thêm 1 dòng vào `usda_names_vi.csv` rồi regenerate.
Đúng tinh thần "AI biến mô tả tiếng Việt thành file" của CONTEXT mục 2.

**File ĐƯỢC sửa (Phần B):** `database/usda_names_vi.csv` (tạo), `scripts/generate-usda-db.js` (sửa
join), `src/data/food/usdaFoods.generated.ts` + `database/extract/usda_foundation_foods.csv` (do
script sinh lại), tuỳ chọn `src/data/food/usdaFoods.ts` (+ test). KHÔNG đụng `food_items.csv`,
`FoodLogModal.tsx` (Phần A), `energyStore.ts`.

**Tiêu chí hoàn thành (Phần B):** thêm 1 dòng vào `usda_names_vi.csv` → `npm run gen:usda` →
`USDA_FOODS` món đó có `nameVi` đúng; món chưa dịch vẫn trống; `tsc`/`jest`/`expo export` OK.

**Prompt copy-paste — Phần B:**
```
Đọc .ai/parallel-reports/S-N-food-data-usda-spec.md, .ai/parallel-reports/S-N.md và
.ai/NEXT_SESSIONS.md (mục U7 Phần B). Nhập vai agent data-ml. Nhiệm vụ: thêm cơ chế dịch name_vi
theo nhu cầu cho danh sách USDA bằng FILE PHỦ build-time (KHÔNG làm trình sửa trong app). Tạo
database/usda_names_vi.csv (cột id,name_vi, vài dòng mẫu) và sửa scripts/generate-usda-db.js để
left-join file này khi sinh usda_foundation_foods.csv + usdaFoods.generated.ts (món có id trong
file phủ thì điền name_vi, không có thì để trống; chạy lại không mất bản dịch). Tuỳ chọn cho
searchUsdaFoods tìm cả theo nameVi. CHỈ sửa các file này — KHÔNG đụng food_items.csv,
FoodLogModal.tsx, energyStore.ts. Chạy `npm run gen:usda` + `npx tsc --noEmit` + `npx jest` + `npx
expo export --platform ios` trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/U7.md (nối
tiếp Phần A nếu đã có). Nói tiếng Việt, code tiếng Anh.
```

---

## L-1 · Sửa 2 lint error tồn đọng (đưa baseline ESLint về 0)

> Bối cảnh: từ 2026-07-03 dự án có ESLint (`npm run lint`) + hook tự lint file vừa sửa
> (`.ai/scripts/lint-edited-file.js`, exit 2 khi file có error). Baseline hiện còn **2 error**
> tồn đọng — chừng nào chưa sửa, bất kỳ phiên nào chạm vào 2 file này sẽ bị hook chặn dù thay
> đổi vô can. Gói này dọn dứt điểm để hook chỉ còn bắt lỗi MỚI.

**2 lỗi (ESLint bắt được):**
1. `src/hooks/useDrainTick.ts:15` — `react-hooks/purity`: `useRef(Date.now())` gọi hàm không
   thuần trong render. Gợi ý: `useRef<number | null>(null)` rồi gán `Date.now()` trong
   `useEffect` lần đầu (hoặc lazy-init tương đương). GIỮ NGUYÊN hành vi tick hiện có.
2. `src/screens/HistoryScreen.tsx:50` — `react-hooks/immutability`: `loadHistory()` được gọi
   trong `useFocusEffect` TRƯỚC khi khai báo. Gợi ý: chuyển `loadHistory` thành `useCallback`
   khai báo phía trên `useFocusEffect`.

**File ĐƯỢC sửa:** `src/hooks/useDrainTick.ts`, `src/screens/HistoryScreen.tsx` (+ test liên
quan nếu có). **KHÔNG đụng:** mọi file khác — đặc biệt các file gói S-M vừa sửa
(`energyStore.ts`, `energyBalanceEngine.ts`, `useLiveEnergyReading.ts`, `MasterBattery.tsx`...).

**Lưu ý:** 22 warning còn lại (biến thừa, import trùng...) KHÔNG bắt buộc trong gói này —
sửa tiện tay CHỈ trong 2 file trên, đừng lan ra file khác.

**Tiêu chí hoàn thành:** `npm run verify` xanh (tsc + lint 0 error + jest); hành vi app không
đổi (drain tick vẫn chạy, màn Lịch sử vẫn load khi focus).

**Prompt copy-paste:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (gói L-1). Nhập vai agent
logic-backend. Nhiệm vụ: sửa dứt điểm 2 lint error tồn đọng (useDrainTick.ts:15
react-hooks/purity, HistoryScreen.tsx:50 react-hooks/immutability) để baseline ESLint về 0
error. CHỈ sửa 2 file đó (+ test liên quan), KHÔNG đụng file nào khác, GIỮ NGUYÊN hành vi.
Chạy `npm run verify` trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/L-1.md.
```

---

## S-G · Lớp thông minh dự báo (Phase 5)

Cần ~1 tháng dữ liệu thật trước khi **hiển thị** xu hướng cho người dùng (vẫn giữ nguyên tắc
này). Bắt đầu bằng rule-based, kèm disclaimer y tế (CONTEXT mục 5). Giao agent `data-ml`.
`S-L` (điều kiện chờ dữ liệu cân nặng) **đã xong từ 2026-06-18** — không còn chặn việc bắt đầu
xây engine/hạ tầng.

Gồm 2 luồng việc độc lập dưới cùng mã `S-G`:

**Luồng A — "Xu hướng dinh dưỡng ăn uống"** (🆕 2026-07-31, đã có spec chi tiết):
xem `.ai/parallel-reports/S-G-nutrition-trend-intelligence-spec.md`. Chia 3 lớp tăng dần, mỗi lớp
tự đứng được:
- **S-G1** — Rolling rule-based (trung bình động 7/30 ngày + streak), mở rộng
  `nutritionAssessment.ts`/`microBatteryEngine.ts`, thêm bảng `daily_nutrition_summary` bền vững
  (không bị `DATA_RETENTION_DAYS=35` xoá). Làm được ngay, không cần ML. `logic-backend`.
- **S-G2** — Thang điểm y văn công khai (HEI-2020/DASH), phụ thuộc S-G1. `logic-backend`.
- **S-G3a…S-G3e** — Model nhỏ pretrain trên NHANES (dữ liệu quần thể, KHÔNG train trên dữ liệu
  cá nhân), suy luận on-device bằng forward-pass JS thuần (không thêm dependency ONNX/TF.js).
  Subfolder mới `ml-nutrition-risk/` (mirror `database/`). S-G3a-d độc lập app, S-G3e cần S-G1.
  `data-ml`.

**Luồng B — "Hiệu chỉnh MET cá nhân hoá"** (quyết định 2026-06-18, chưa có spec riêng): so sánh
xu hướng cân nặng thật (đọc từ `healthSignalsRepository`, gói **S-L**) với mức tiêu hao công
thức dự đoán trong cùng giai đoạn, rồi đề xuất (không tự áp đặt) một hệ số điều chỉnh cá nhân cho
`OCCUPATION_FACTORS`/MET. Dữ liệu cân nặng từ S-L đã sẵn sàng — làm khi có phiên rảnh, độc lập
với Luồng A.

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

> 🔁 **Đã gộp vào gói U6 (2026-06-18)** — vì U6 (Cài đặt UX) cũng cần sửa đúng những file này.
> **Đừng mở S-I riêng nữa**, dùng prompt copy-paste của **U6** ở mục bên dưới (giữ nguyên kỹ
> thuật mô tả ở đây làm tài liệu tham khảo).

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

## 🎨 Đợt UX (U1–U6) — sửa "chưa hợp logic / khó nhìn" sau test máy thật

> Gộp từ `.ai/NEXT_SESSIONS_UX.md` (đã xoá file đó, 2026-06-18) — file đó tách riêng tạm thời vì
> lúc viết có 1 phiên khác đang biên tập trực tiếp file này (thêm S-K, S-L). Giờ đã gộp lại 1 chỗ.
>
> **Bối cảnh:** test trên iPhone thật cho thấy 3 vùng "chưa hợp góc nhìn người dùng": (1) pin
> tổng + con số năng lượng · (2) nạp & ghi món · (3) các màn khác. Song song, một "đợt polish
> nhấn" (press feedback + animation trượt sheet) đã quét qua toàn bộ component liên quan — **đã
> commit xong hoàn toàn** (`4499fab` + phần đuôi ở commit sau đó), nên **không còn gói U nào bị
> chặn vì lý do "chờ commit polish" nữa.**

**Bảng gói:**

| Mã | Vùng | File ĐƯỢC sửa (CHỈ những file này) | Trạng thái |
|----|------|-------------------------------------|------------|
| **U1** | Pin tổng + con số năng lượng (hiển thị) | `components/LiveMasterBattery.tsx`, `components/MasterBattery.tsx`, `hooks/useLiveEnergyReading.ts` | 🔁 Đã gộp vào **S-M** (2026-06-18) — đừng làm riêng, xem mục S-M |
| **U2** | Nạp & ghi món (modal/bàn phím/luồng) | `components/IntakeModal.tsx`, `components/FoodLogModal.tsx`, `components/EnergyActionsBar.tsx` | ✅ XONG — `.ai/parallel-reports/U2.md` |
| **U3** | Lịch sử + biểu đồ | `screens/HistoryScreen.tsx`, `components/TrendChart.tsx` | ✅ XONG — `.ai/parallel-reports/U3.md` |
| **U4** | Nhật ký | `screens/DiaryScreen.tsx` | 🆕 Sẵn sàng làm ngay |
| **U5** | Onboarding lần đầu | `screens/OnboardingScreen.tsx` | 🆕 Sẵn sàng làm ngay |
| **U6** | Cài đặt (UX) + khung giờ bữa ăn (**gộp S-I**) | `screens/SettingsScreen.tsx`, `store/settingsStore.ts`, `domain/food/foodNutrition.ts` (+param tuỳ chọn), `store/energyStore.ts` (1 dòng trong `logFood`) | 🆕 Sẵn sàng làm ngay |

**Đụng file chéo với gói khác (BẮT BUỘC đọc):**
- **U1 → đã gộp vào S-M** (2026-06-18, lật mô hình pin Năng lượng) — đừng mở U1 riêng, xem mục
  S-M (S-M viết đè toàn bộ hiển thị pin tổng, kể cả phần U1 định sửa).
- **U6 ↔ S-M:** cả hai sửa `store/energyStore.ts` → serialize, không chạy cùng lúc. Đề nghị làm
  S-M xong trước.
- **U6 ↔ S-F:** cả hai sửa `SettingsScreen.tsx` → không chạy đồng thời.
- **S-K:** tạm dừng hẳn (mâu thuẫn với S-M), xem mục S-K.

**Tổ hợp chạy song song an toàn gợi ý (1 đợt):** U4 · U5 · S-A. (S-M nên chạy **riêng một mình**
một đợt — xem mục S-M; S-F/U6 để đợt riêng hoặc xen kẽ sau khi S-M xong.)

**Ràng buộc chung cho mọi gói U:**
- Trước khi sửa: **mở app trên máy cùng người dùng, chỉ ra CỤ THỂ chỗ "chưa hợp logic"** trong
  vùng của mình, đề xuất cách sửa bằng tiếng Việt, **ĐỢI người dùng duyệt** rồi mới code
  (`.ai/CONTEXT.md` mục 3).
- KHÔNG đụng `package.json`, `App.tsx`, `HomeScreen.tsx`, hay file ngoài danh sách của gói.
- **U1:** chỉ sửa hiển thị/nhãn/màu/đơn vị. Số tính sai → ghi report, đừng sửa engine. Lưu ý sẵn
  có 1 phát hiện đã phân tích trước (chưa code) trong `.ai/parallel-reports/U1-FINDINGS.md` —
  đọc trước khi hỏi người dùng, để khỏi phân tích lại từ đầu.
- **U6:** giữ `mealTypeForHour`/`mealTypeForTimestamp` có **default** (để test cũ + `FoodLogModal`
  của U2 không vỡ); giữ chữ ký `logFood` KHÔNG đổi.
- Báo xong = `npx tsc --noEmit` sạch + `npx jest` xanh + `npx expo export --platform ios` OK +
  report `.ai/parallel-reports/<mã>.md`.

**Prompt copy-paste — U1 (Pin tổng + con số năng lượng):**
> 🔁 **Đã gộp vào S-M (2026-06-18) — dùng prompt copy-paste của mục S-M ở trên, đừng dùng prompt
> dưới đây.** Giữ lại làm tài liệu tham khảo (3 điểm A1/A2/A3 đã phân tích trong U1-FINDINGS.md
> vẫn còn giá trị — S-M nên đọc qua khi viết lại hiển thị).
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/06-energy-expenditure.md,
.ai/parallel-reports/U1-FINDINGS.md và .ai/NEXT_SESSIONS.md (mục U1). Nhập vai agent
mobile-frontend. Vùng: pin tổng "Năng lượng" + con số kcal/%. CHỈ được sửa:
components/LiveMasterBattery.tsx, components/MasterBattery.tsx, hooks/useLiveEnergyReading.ts —
KHÔNG đụng file khác, KHÔNG sửa engine domain (số sai thì ghi report). U1-FINDINGS.md đã phân
tích sẵn 3 điểm (A1 số lẻ rung, A2 thiếu chữ giải nghĩa, A3 màu đỏ ban đêm) — xác nhận lại với
tôi trên máy rồi mới chọn làm gì, đợi tôi duyệt mới code. Chạy tsc + jest + expo export trước khi
báo xong. Report vào .ai/parallel-reports/U1.md.
```

**Prompt copy-paste — U4 (Nhật ký):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (mục U4). Nhập vai agent
mobile-frontend. Vùng: màn Nhật ký. CHỈ được sửa: screens/DiaryScreen.tsx — KHÔNG đụng file khác.
Mở app cùng tôi, chỉ ra chỗ khó dùng rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy
tsc + jest + expo export trước khi báo xong. Report vào .ai/parallel-reports/U4.md.
```

**Prompt copy-paste — U5 (Onboarding):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS.md (mục U5). Nhập vai agent
mobile-frontend. Vùng: màn Onboarding lần đầu. CHỈ được sửa: screens/OnboardingScreen.tsx — KHÔNG
đụng file khác. Mở app cùng tôi (xoá app cài lại để thấy onboarding), chỉ ra chỗ khó hiểu rồi đề
xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy tsc + jest + expo export trước khi báo
xong. Report vào .ai/parallel-reports/U5.md.
```

**Prompt copy-paste — U6 (Cài đặt UX + khung giờ bữa ăn, gộp S-I):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/07-food-log.md và .ai/NEXT_SESSIONS.md (mục U6,
đã gộp S-I — đọc thêm mục "S-I" để biết chi tiết kỹ thuật khung giờ bữa ăn). Nhập vai agent
mobile-frontend. Hai việc: (a) chỉnh UX màn Cài đặt cho dễ nhìn; (b) cho sửa khung giờ phân loại
bữa ăn (sáng/trưa/tối) trong Cài đặt. CHỈ được sửa: screens/SettingsScreen.tsx,
store/settingsStore.ts (thêm mealWindows + persist), domain/food/foodNutrition.ts (thêm param
tuỳ chọn windows, GIỮ default để test cũ + FoodLogModal không vỡ), store/energyStore.ts (CHỈ 1
dòng: logFood lấy mealWindows từ settings, KHÔNG đổi chữ ký). KHÔNG đụng file khác. LƯU Ý: KHÔNG
chạy cùng lúc gói S-K hay S-F (cùng đụng energyStore.ts / SettingsScreen.tsx). Mở app cùng tôi,
đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy tsc + jest + expo export trước khi báo
xong. Report vào .ai/parallel-reports/U6.md.
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
  - **Đề xuất:** không cần gói riêng. Khi nào có session làm **S-K/S-O** (đã đổi drain sang nhận
    `fromMs`/`toMs` thay vì `elapsedHours`), tiện thể có thể chặn `toMs` lại ở mốc nửa đêm/6h cùng
    lúc — sửa miễn phí. Nếu không ai đụng thời gian dài, bỏ qua vì ảnh hưởng quá nhỏ.

---

## 🔋 S-O + S-P + S-Q · Nâng cấp "2 đồng hồ": Pin no/đói tụt dần + Sổ calo ngày + Mục tiêu cân nặng

> ✅ **Hướng đã chốt với người dùng (2026-07-04).** Spec đầy đủ (mô hình, công thức, cơ sở sinh
> học đã websearch, hình UI, ranh giới sức khoẻ) ở **`.ai/parallel-reports/S-O-satiety-battery-spec.md`**
> — **ĐỌC FILE ĐÓ TRƯỚC.** Mục này chỉ đóng gói/điều phối.
>
> **Bối cảnh 1 dòng:** app tách làm **2 thang đo**: (1) **Pin no/đói** (headline, %, TỤT DẦN theo
> giờ + nhịp sinh học, ăn để nạp, sàn 15-20%) — hồi sinh ý tưởng S-K; (2) **Sổ calo hôm nay**
> (đếm lên "đã ăn/mục tiêu", reset **6h sáng**, mục tiêu từ cân nặng mong muốn) — chính là engine
> **S-M** đã xong, đổi vai thành dòng phụ. Hai cái bổ sung nhau.
>
> **Thứ tự bắt buộc:** Đợt 1 chạy **S-O ∥ S-P** (song song, file rời tuyệt đối). Đợt 2 chạy
> **S-Q một mình** (cần satietyEngine của S-O + weightGoal của S-P). Sau đó **S-A** test máy.

### S-O · Pin no/đói engine + nhịp xả sinh học (thuần) — agent `logic-backend`

**Mục tiêu:** viết engine THUẦN cho pin no/đói: reserve kcal tụt theo nhịp thức/ngủ, ăn thì nạp,
ánh xạ ra % có sàn. Bất biến quan trọng nhất: **tích phân xả đúng 24h = `passiveDailyBurn`**.

**File ĐƯỢC tạo/sửa:**
- TẠO `src/domain/energy/satietyEngine.ts` — hàm thuần: `circadianBurnKcal(profile, fromMs, toMs)`
  (rải theo thức 6h-23h / ngủ ×0.85, tổng 24h = `passiveDailyBurn`), `chargeSatiety(reserve, kcal)`,
  `drainSatiety(reserve, profile, fromMs, toMs)`, `satietyPercentage(reserve)` (sàn `SATIETY_FLOOR_PCT`).
- TẠO `src/domain/energy/__tests__/satietyEngine.test.ts` — **test bất biến 24h** (bất kỳ giờ bắt
  đầu nào, tổng xả 1 ngày tròn = `passiveDailyBurn`, sai số làm tròn), test sàn/trần, test thức>ngủ.
- TẠO `src/types/satiety.ts` (nếu cần kiểu `SatietyState`).
- SỬA `src/lib/metabolicConstants.ts` — thêm `CIRCADIAN_WINDOW = { wakeHour: 6, sleepHour: 23 }`,
  `SLEEP_BURN_MULTIPLIER` (~0.85), `FULLNESS_CAPACITY_KCAL` (~900-1000), `SATIETY_FLOOR_PCT` (15-20).

**KHÔNG đụng:** `energyStore.ts`, `MasterBattery.tsx`, `useLiveEnergyReading.ts`, `types/battery.ts`,
`types/energy.ts` (của S-P), `weightGoalConstants.ts` (của S-P), `App.tsx`, mọi screen/component.
Chỉ ĐỌC `metabolismEngine.ts` (`passiveBurnPerHour`/`passiveDailyBurn`), đừng sửa.

**Xác nhận với người dùng trước khi code (spec mục 7):** `FULLNESS_CAPACITY_KCAL`, `SATIETY_FLOOR_PCT`,
hệ số ngủ 0.85.

**Prompt copy-paste — S-O:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-O-satiety-battery-spec.md (SPEC
ĐẦY ĐỦ — ĐỌC TRƯỚC) và .ai/NEXT_SESSIONS.md (mục S-O). Nhập vai agent logic-backend. Nhiệm vụ:
viết engine THUẦN cho pin no/đói (satietyEngine.ts): reserve kcal tụt theo nhịp thức/ngủ
(circadianBurnKcal, thức 6-23h / ngủ ×0.85), ăn nạp reserve, ánh xạ % có sàn. CHỈ tạo:
domain/energy/satietyEngine.ts (+test), types/satiety.ts; CHỈ sửa lib/metabolicConstants.ts (thêm
hằng số circadian + fullness). KHÔNG đụng energyStore.ts, MasterBattery.tsx, useLiveEnergyReading.ts,
types/battery.ts, types/energy.ts, App.tsx. Chỉ ĐỌC metabolismEngine.ts. Viết test BẤT BIẾN: tổng
xả đúng 24h tròn (bất kỳ giờ bắt đầu) = passiveDailyBurn — tiêu chí quan trọng nhất. Xác nhận
FULLNESS_CAPACITY_KCAL + SATIETY_FLOOR_PCT + hệ số ngủ với tôi trước khi code. Chạy tsc + jest +
expo export trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-O.md.
```

### S-P · Mục tiêu cân nặng → mục tiêu kcal/ngày an toàn — agent `logic-backend`

**Mục tiêu:** nhập cân nặng mong muốn → tính mục tiêu kcal/ngày có thâm hụt, **chặn cứng an toàn**
(không dưới BMR, thâm hụt ≤ 20% & ≤ 750 kcal). Đây thành `capacity` của Sổ calo (S-Q lắp sau).

**File ĐƯỢC tạo/sửa:**
- TẠO `src/domain/energy/weightGoal.ts` (+ `__tests__`) — `dailyCalorieTarget(profile, goal)`:
  maintenance = `passiveDailyBurn`, deficit = `7700 × Δkg / (goalWeeks×7)`, kẹp an toàn, floor BMR.
- TẠO `src/lib/weightGoalConstants.ts` — `MAX_DEFICIT_PCT` (0.20), `MAX_DEFICIT_KCAL` (750),
  giới hạn `goalWeeks`.
- SỬA `src/types/energy.ts` — thêm `goalWeightKg?: number`, `goalWeeks?: number` vào `UserProfile`.
- SỬA `src/domain/energy/profileValidation.ts` — validate goal (trong khoảng hợp lệ).
- SỬA `src/components/BodyProfileCard.tsx` — thêm ô "Cân nặng mong muốn" (+ "trong bao lâu"), hiện
  mục tiêu kcal/ngày tính ra + ghi chú nếu bị kẹp an toàn. Kèm "Chỉ để tham khảo."

**KHÔNG đụng:** `metabolicConstants.ts` (của S-O — dùng file `weightGoalConstants.ts` riêng),
`types/satiety.ts`, `satietyEngine.ts`, `energyStore.ts`, `SettingsScreen.tsx` (chỉ sửa component
con `BodyProfileCard.tsx`), `App.tsx`, `MasterBattery.tsx`.

**Xác nhận với người dùng trước khi code (spec mục 7):** ngưỡng an toàn (20%/750/không dưới BMR),
có nhập "thời gian mong muốn" hay app tự chọn tốc độ an toàn.

**Prompt copy-paste — S-P:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-O-satiety-battery-spec.md (SPEC
ĐẦY ĐỦ — ĐỌC TRƯỚC, mục 1C) và .ai/NEXT_SESSIONS.md (mục S-P). Nhập vai agent logic-backend.
Nhiệm vụ: tính mục tiêu kcal/ngày từ cân nặng mong muốn, CÓ CHẶN CỨNG AN TOÀN (không dưới BMR,
thâm hụt ≤20% & ≤750 kcal). CHỈ tạo: domain/energy/weightGoal.ts (+test), lib/weightGoalConstants.ts;
CHỈ sửa: types/energy.ts (thêm goalWeightKg/goalWeeks), domain/energy/profileValidation.ts,
components/BodyProfileCard.tsx. KHÔNG đụng metabolicConstants.ts (đó là của S-O — dùng file hằng số
riêng), satietyEngine.ts, energyStore.ts, SettingsScreen.tsx, App.tsx, MasterBattery.tsx. Tuân thủ
ranh giới sức khoẻ CONTEXT mục 5: kẹp mục tiêu an toàn, không cổ vũ nhịn, kèm "chỉ tham khảo". Xác
nhận ngưỡng an toàn với tôi trước khi code. Chạy tsc + jest + expo export trước khi báo xong. Ghi
báo cáo vào .ai/parallel-reports/S-P.md.
```

### S-Q · Lắp ráp 2 đồng hồ + reset 6h + UI + nhắc nhẹ — ⚠️ ĐƠN, sau S-O+S-P — agents `logic-backend + mobile-frontend`

**Mục tiêu:** ghép satietyEngine (S-O) + weightGoal (S-P) vào store + hook + UI. Pin chính hiển
thị **pin no/đói** (từ reserve, tick mỗi giây/mỗi 20 phút), dòng phụ hiển thị **Sổ calo** (S-M giữ
nguyên, đổi capacity sang mục tiêu S-P + reset 6h). Nhắc nhẹ khi pin no thấp lâu (không hù).

**File ĐƯỢC sửa:**
- `src/types/battery.ts` — thêm `satietyReserveKcal?: number` vào energy reading.
- `src/store/energyStore.ts` — lưu/cập nhật reserve (charge khi ăn/log món, drain trong `tickDrain`
  qua `drainSatiety`, trừ khi tập); Sổ calo dùng `energyDayString` (reset 6h) + capacity =
  `dailyCalorieTarget`.
- `src/lib/dateUtils.ts` — thêm `energyDayString(date, resetHour=6)` (**KHÔNG sửa** `todayString`).
- `src/hooks/useLiveEnergyReading.ts` — trả cả `satietyPct` (tick sống) + Sổ calo.
- `src/hooks/useDrainTick.ts` — gọi drain satiety định kỳ (đã có khung tick).
- `src/hooks/useLowEnergyWatch.ts` — đổi thành nhắc NHẸ khi pin no thấp lâu (giữ chống spam).
- `src/components/MasterBattery.tsx` + `LiveMasterBattery.tsx` — layout 2 đồng hồ (hình UI spec mục 2).
- `src/services/notifications/notificationService.ts` (+`.web.ts`) — hàm nhắc nhẹ "nên ăn".
- (Nếu cần) `App.tsx` — mốc kiểm tra sang "ngày năng lượng" theo 6h.

**KHÔNG đụng:** `satietyEngine.ts`/`metabolicConstants.ts` (S-O — chỉ gọi), `weightGoal.ts`/
`weightGoalConstants.ts`/`BodyProfileCard.tsx` (S-P — chỉ gọi), `FoodLogModal.tsx`, `settingsStore.ts`,
`SettingsScreen.tsx`, `foodDatabase.ts`/`usdaFoods.ts`.

**Xác nhận với người dùng trước khi code (spec mục 7):** hình UI 2 đồng hồ, reset 6h chỉ cho Sổ calo
(spec đề xuất) hay toàn app — **test mốc 6h trên máy**.

**Prompt copy-paste — S-Q:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-O-satiety-battery-spec.md (SPEC
ĐẦY ĐỦ — ĐỌC TRƯỚC), .ai/parallel-reports/S-M.md (engine Sổ calo giữ lại) và .ai/NEXT_SESSIONS.md
(mục S-Q). Nhập vai agent logic-backend + mobile-frontend. Điều kiện: S-O + S-P đã xong & commit.
Nhiệm vụ: lắp 2 đồng hồ — pin chính = pin no/đói (từ satietyEngine, tick sống), dòng phụ = Sổ calo
(engine S-M, capacity = dailyCalorieTarget của S-P, reset 6h qua energyDayString mới). Nhắc nhẹ khi
pin no thấp lâu (không hù). CHỈ sửa: types/battery.ts, store/energyStore.ts, lib/dateUtils.ts (thêm
energyDayString, KHÔNG sửa todayString), hooks/useLiveEnergyReading.ts + useDrainTick.ts +
useLowEnergyWatch.ts, components/MasterBattery.tsx + LiveMasterBattery.tsx,
services/notifications/notificationService.ts(+.web.ts), App.tsx nếu cần. KHÔNG sửa satietyEngine.ts,
metabolicConstants.ts, weightGoal.ts, BodyProfileCard.tsx, FoodLogModal.tsx, settingsStore.ts,
SettingsScreen.tsx (chỉ GỌI). Ranh giới sức khoẻ CONTEXT mục 5: pin sáng thấp có sàn = bình thường,
không đỏ/hù. Xác nhận hình UI + mốc 6h với tôi, tốt nhất mở app cùng tôi, đợi duyệt trước khi code.
Chạy tsc + jest + expo export trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-Q.md.
```

**Đụng file chéo (BẮT BUỘC đọc):**
- **S-O ∥ S-P** an toàn: S-O đụng `metabolicConstants.ts` + file mới `satietyEngine.ts`/`types/satiety.ts`;
  S-P đụng `weightGoalConstants.ts` (mới) + `types/energy.ts` + `weightGoal.ts` + `profileValidation.ts`
  + `BodyProfileCard.tsx`. **Không trùng file nào.**
- **S-Q ĐƠN:** đụng `energyStore.ts` + `MasterBattery.tsx` + nhiều hook → không chạy cùng bất kỳ gói
  nào khác đụng các file này (giống S-M trước đây). Chờ S-O+S-P commit xong mới mở S-Q.
- **U6/S-I** (nếu mở lại) đụng `energyStore.ts` → serialize với S-Q.

---

## S-R · Pin vi chất THẬT từ nhật ký món (tận dụng dữ liệu USDA/CSV) — agents `logic-backend + mobile-frontend`

> 🆕 ĐỀ XUẤT 2026-07-04 — **chưa chốt với người dùng**. Spec ĐẦY ĐỦ (đọc TRƯỚC):
> `.ai/parallel-reports/S-R-micronutrient-batteries-spec.md`. Ý tưởng: biến các "pin nhỏ" từ ý
> niệm thành pin vi chất thật, nạp bằng dữ liệu dinh dưỡng per-100g đã có sẵn (không cần đổi DB).

**Mục tiêu:** mỗi món đã ghi hôm nay → tra dinh dưỡng → cộng dồn → hiển thị dàn **pin vi chất**:
nhóm "nạp cho đủ" (Đạm/Chất xơ/Sắt/Canxi/Kali/Magie/Kẽm) + nhóm "giữ trong ngưỡng" (Muối/Đường).
Pin là **lớp dẫn xuất chỉ-hôm-nay**, reset theo ngày lịch — KHÔNG tạo reading DB mới, KHÔNG đổi schema.

**File ĐƯỢC sửa (gần như toàn file MỚI):**
- `src/types/nutrition.ts` (mới) — `MicronutrientId`, `NutrientTarget`, `MicroBatteryState`.
- `src/lib/nutrientTargets.ts` (mới) — mốc tham khảo ngày + loại (`goal`/`limit`) + hiển thị (tên VI, đơn vị, màu, icon).
- `src/domain/nutrition/microBatteryEngine.ts` (+ `__tests__/`, mới) — thuần: cộng dồn từ `FoodLogEntry[]`
  qua hàm `lookup(foodId)`, xuất `MicroBatteryState[]` (goal `current/target`, limit `current/cap`+`over`).
- `src/components/MicroBatteryStack.tsx` (mới) — render dàn pin (dùng lại hình BatteryCell), nhóm goal/limit + "Chỉ để tham khảo."
- `src/screens/HomeScreen.tsx` — CHỈ chèn: đọc nhật ký món hôm nay + hàm tra DB → truyền vào engine → render stack.

**KHÔNG đụng:** `energyStore.ts`, `satietyEngine.ts`, `weightGoal.ts`, `energyBalanceEngine.ts`,
`MasterBattery.tsx`/`LiveMasterBattery.tsx`, `dateUtils.ts` (KHÔNG dùng `energyDayString` — vi chất
theo ngày lịch), `types/battery.ts` (KHÔNG mở rộng `BatteryId`), DB schema/repositories,
`foodDatabase.ts`, `FoodLogModal.tsx`, `settingsStore.ts`.

**Xác nhận với người dùng trước khi code (spec mục 7):** danh sách pin nổi bật + trong "Xem thêm";
mốc cố định v1 hay theo giới/tuổi; chỗ đặt trên Home; xác nhận v1 KHÔNG lưu lịch sử vi chất (không đụng DB).

**Prompt copy-paste — S-R:**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-R-micronutrient-batteries-spec.md
(SPEC ĐẦY ĐỦ — ĐỌC TRƯỚC) và .ai/NEXT_SESSIONS.md (mục S-R). Nhập vai agent logic-backend +
mobile-frontend. Điều kiện: nên chạy SAU khi S-Q merge (chỉ để tránh đụng HomeScreen). Nhiệm vụ:
làm pin vi chất DẪN XUẤT từ nhật ký món hôm nay — engine thuần microBatteryEngine.ts cộng dồn
per-100g qua hàm lookup(foodId), 2 loại pin: "nạp cho đủ" (Đạm/Xơ/Sắt/Canxi/Kali/Magie/Kẽm) và
"giữ trong ngưỡng" (Muối/Đường). CHỈ tạo/sửa: types/nutrition.ts (mới), lib/nutrientTargets.ts
(mới), domain/nutrition/microBatteryEngine.ts + test (mới), components/MicroBatteryStack.tsx (mới),
chèn đọc dữ liệu vào screens/HomeScreen.tsx. KHÔNG đụng energyStore.ts, satietyEngine.ts,
weightGoal.ts, MasterBattery/LiveMasterBattery.tsx, dateUtils.ts, types/battery.ts (KHÔNG mở rộng
BatteryId), DB/repositories, foodDatabase.ts, FoodLogModal.tsx, settingsStore.ts. Ranh giới sức
khoẻ CONTEXT mục 5: goal dưới mốc = "còn trống" trung tính (không đỏ/không "thiếu chất"); limit
vượt mốc = "vượt ngưỡng gợi ý" trung tính (không "xấu"). Mọi màn kèm "Chỉ để tham khảo." Xác nhận
danh sách pin + chỗ đặt trên Home với tôi, tốt nhất mở app cùng tôi, đợi duyệt trước khi code. Chạy
tsc + jest + expo export trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-R.md.
```

**Đụng file chéo (BẮT BUỘC đọc):**
- Toàn bộ file mới, **chỉ chung `HomeScreen.tsx` với S-Q** → chạy S-R **sau khi S-Q merge**.
- KHÔNG đụng lõi năng lượng/satiety → an toàn với mọi gói khác miễn không mở cùng lúc gói sửa Home.
- Đây là bước 1 của hướng "chiều sâu dinh dưỡng"; "pin đa dạng" + "chất lượng bữa ăn 2 chiều"
  (Nutri-Score/NOVA) là các gói nối tiếp SAU S-R (chưa đóng gói — xem bản phân tích 2026-07-04).

---

## 🕓 S-S · "Cập nhật lịch sử" — ghi lùi món ăn cho ngày đã qua (backfill)

> ✅ **Hướng đã chốt với người dùng (2026-07-10).** Spec đầy đủ (ngữ nghĩa dữ liệu, cạnh khó
> 0h–6h, hợp đồng API, bất biến test) ở **`.ai/parallel-reports/S-S-backfill-spec.md`** —
> **ĐỌC FILE ĐÓ TRƯỚC.** Mục này chỉ đóng gói/điều phối + prompt.
>
> **Bối cảnh 1 dòng:** những ngày quên mở app vẫn ghi lại được món đã ăn: từ tab Lịch sử chạm
> vào ngày → thêm/xoá món; hoặc chọn ngày ngay trong FoodLogModal. Dữ liệu nạp vào readings
> CỦA NGÀY ĐÓ (vi chất theo ngày lịch, kcal theo energy-day 6h) — **tuyệt đối không đụng con
> số hôm nay**, không đụng satietyReserve.
>
> **Thứ tự bắt buộc:** ⚠️ **Bước 0: commit sạch branch `ui-upgrade`** (đang có file sửa dở,
> gồm cả `FoodLogModal.tsx` — phiên song song sẽ đè mất nếu không commit). Sau đó:
> Đợt 1 chạy **S-S1 ∥ S-S2 ∥ S-S3** (3 phiên song song, toàn file MỚI). Commit.
> Đợt 2 chạy **S-S4 một mình** (đụng `energyStore.ts`). Commit.
> Đợt 3 chạy **S-S5 một mình** (đụng `FoodLogModal.tsx` + `HistoryScreen.tsx`). Commit.
> Đợt 4 chạy **S-S6** (qa-reviewer, read-only). Sau mỗi đợt: `git diff --stat` soát xem có
> file NGOÀI phạm vi gói bị đổi không (bài học parallel-conflicts).

### S-S1 · Engine thuần backfill — agent `logic-backend` — model **Sonnet**

**Mục tiêu:** hàm thuần nạp/đảo dinh dưỡng 1 món vào bộ readings của MỘT ngày bất kỳ +
dựng readings cho ngày quên mở app + validate ngày. Không side-effect, không DB, không store.

**File ĐƯỢC tạo (KHÔNG sửa file nào có sẵn):**
- TẠO `src/domain/food/backfillEngine.ts` — đúng 4 chữ ký trong spec mục 3d:
  `validateBackfillDate`, `applyFoodToDayReadings`, `reverseFoodOnDayReadings`,
  `buildReadingsForMissedDay`.
- TẠO `src/domain/food/__tests__/backfillEngine.test.ts` — test bất biến spec mục 4
  (round-trip, satiety y nguyên, capacity ngày trống, validate future/too-old/invalid).

**KHÔNG đụng:** `energyStore.ts`, mọi repository, mọi screen/component, `dateUtils.ts`,
`constants.ts` (chỉ ĐỌC `DATA_RETENTION_DAYS`), `batteryEngine.ts`/`energyBalanceEngine.ts`/
`weightGoal.ts` (chỉ ĐỌC, tái dùng `createDailyReading`/`createEnergyReading`/`chargeEnergy`/
`applyIntake`/`dailyCalorieTarget`).

**Prompt copy-paste — S-S1 (Sonnet):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (SPEC ĐẦY
ĐỦ — ĐỌC TRƯỚC, nhất là mục 3d hợp đồng API và mục 4 bất biến) và .ai/NEXT_SESSIONS.md (mục
S-S1). Nhập vai agent logic-backend. Nhiệm vụ: viết engine THUẦN cho backfill món ăn ngày đã
qua. CHỈ TẠO 2 file mới: src/domain/food/backfillEngine.ts (đúng 4 chữ ký hàm trong spec 3d,
không tự đổi tên/đổi tham số — gói S-S4 sẽ code theo đúng hợp đồng này) và
src/domain/food/__tests__/backfillEngine.test.ts. Tái dùng hàm thuần có sẵn: createDailyReading,
createEnergyReading (batteryEngine/energyBalanceEngine), chargeEnergy, applyIntake,
dailyCalorieTarget — chỉ ĐỌC các file đó, KHÔNG sửa. KHÔNG đụng energyStore.ts, repositories,
screens, components, dateUtils.ts. Bất biến quan trọng nhất: applyFoodToDayReadings KHÔNG BAO
GIỜ đụng satietyReserveKcal/lastSatietySyncAt, và reverse là round-trip chính xác của apply
(viết test cả hai). Test validate: future / too-old (>DATA_RETENTION_DAYS) / invalid. Chạy
npx tsc --noEmit + npx jest + npx expo export --platform ios --output-dir /tmp/check_S-S1
trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-S1.md. KHÔNG commit — người dùng
tự commit sau khi soát đợt.
```

### S-S2 · PastDateField (chọn ngày quá khứ) — agent `mobile-frontend` — model **Haiku**

**Mục tiêu:** component rời, props-driven, chọn ngày đã qua: chip "Hôm nay / Hôm qua /
2 ngày trước" + ô nhập dd/mm; báo lỗi ngày tương lai / quá xa. KHÔNG import store/DB.

**File ĐƯỢC tạo (KHÔNG sửa file nào có sẵn):**
- TẠO `src/components/food/PastDateField.tsx` — props đúng spec mục 3d
  (`value: string YYYY-MM-DD`, `onChange`, `maxDaysBack: number`).

**KHÔNG đụng:** `FoodLogModal.tsx` (S-S5 sẽ nối), `dateUtils.ts` (chỉ ĐỌC — dùng
`todayString`/`daysAgo`/`formatDisplayDate` có sẵn), store, repositories, screens.

**Prompt copy-paste — S-S2 (Haiku):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (mục 3a +
3d) và .ai/NEXT_SESSIONS.md (mục S-S2). Nhập vai agent mobile-frontend. Nhiệm vụ NHỎ VÀ GỌN:
tạo DUY NHẤT 1 file mới src/components/food/PastDateField.tsx — component chọn ngày quá khứ,
props-driven đúng chữ ký trong spec 3d: { value: string (YYYY-MM-DD); onChange(date);
maxDaysBack: number }. UI: hàng chip nhanh "Hôm nay | Hôm qua | 2 ngày trước" + ô nhập dd/mm
(parse về YYYY-MM-DD của năm hiện tại, lùi 1 năm nếu ra tương lai); ngày ngoài khoảng
[hôm nay - maxDaysBack, hôm nay] thì hiện dòng lỗi đỏ nhẹ và KHÔNG gọi onChange. Style theo
src/lib/theme.ts (colors), nhìn khớp các field trong FoodLogModal.tsx (chỉ ĐỌC file đó tham
khảo, KHÔNG sửa). KHÔNG import store/DB/repository. KHÔNG sửa bất kỳ file có sẵn nào, kể cả
dateUtils.ts (dùng todayString/daysAgo/formatDisplayDate có sẵn). Lưu ý hook thuần: không gọi
Date.now()/new Date() trong render body — bọc qua helper module-level như FoodLogModal đang
làm (ESLint react-hooks/purity đang bật chế độ chặn). Chạy npx tsc --noEmit + npx expo export
--platform ios --output-dir /tmp/check_S-S2 trước khi báo xong. Ghi báo cáo vào
.ai/parallel-reports/S-S2.md. KHÔNG commit.
```

### S-S3 · DayDetailSheet (chi tiết 1 ngày) — agent `mobile-frontend` — model **Haiku**

**Mục tiêu:** bottom sheet rời hiện món đã ghi của 1 ngày (nhóm theo bữa, tổng kcal/đạm),
nút xoá từng món + nút "＋ Thêm món cho ngày này". Hoàn toàn props-driven, KHÔNG fetch.

**File ĐƯỢC tạo (KHÔNG sửa file nào có sẵn):**
- TẠO `src/components/DayDetailSheet.tsx` — props đúng spec mục 3d (`visible`, `date`,
  `entries`, `loading?`, `onClose`, `onAddFood`, `onDeleteEntry`). Dựng trên
  `src/components/ui/BottomSheet.tsx` có sẵn (chỉ ĐỌC/IMPORT, không sửa).

**KHÔNG đụng:** `HistoryScreen.tsx` (S-S5 sẽ nối), `BottomSheet.tsx`, store, repositories,
`FoodLogModal.tsx`. Nhãn bữa dùng `MEAL_LABELS` từ `lib/constants.ts` (chỉ ĐỌC).

**Prompt copy-paste — S-S3 (Haiku):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (mục 3a +
3d) và .ai/NEXT_SESSIONS.md (mục S-S3). Nhập vai agent mobile-frontend. Nhiệm vụ NHỎ VÀ GỌN:
tạo DUY NHẤT 1 file mới src/components/DayDetailSheet.tsx — bottom sheet chi tiết 1 ngày,
props-driven đúng chữ ký spec 3d: { visible; date (YYYY-MM-DD); entries: FoodLogEntry[];
loading?; onClose(); onAddFood(); onDeleteEntry(entry) }. Dựng trên component
src/components/ui/BottomSheet.tsx CÓ SẴN (import, không sửa). Nội dung: tiêu đề = ngày
(formatDisplayDate), tổng kcal + đạm của entries, danh sách nhóm theo mealType (nhãn từ
MEAL_LABELS trong lib/constants.ts), mỗi dòng: tên món, khẩu phần (grams hoặc count+portionUnit),
kcal, nút xoá (confirm bằng Alert trước khi gọi onDeleteEntry). Cuối sheet: nút "＋ Thêm món
cho ngày này" gọi onAddFood. entries rỗng → dòng trống trung tính "Chưa ghi món nào cho ngày
này". KHÔNG import store/DB/repository — mọi dữ liệu qua props. KHÔNG sửa file có sẵn nào.
Style theo lib/theme.ts. Chạy npx tsc --noEmit + npx expo export --platform ios --output-dir
/tmp/check_S-S3 trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-S3.md. KHÔNG commit.
```

### S-S4 · Store: logFoodForPastDate / removeFoodForPastDate — agent `logic-backend` — model **Sonnet** — ⚠️ CHẠY MỘT MÌNH (đợt 2)

**Mục tiêu:** 2 action mới trong `energyStore.ts` dùng backfillEngine (S-S1): ghi/xoá món cho
ngày quá khứ, đọc-sửa-ghi readings LỊCH SỬ qua repository, KHÔNG đụng con số hôm nay
(trừ nhánh chồng ngày 0h–6h — spec mục 3c).

**File ĐƯỢC sửa/tạo:**
- SỬA `src/store/energyStore.ts` — thêm đúng 2 action theo chữ ký spec 3d; mirror pattern
  `removeFood` FIX #1 sẵn có (so ngày đích với ngày đang load → store hay row DB rời);
  D = hôm nay → uỷ quyền `logFood`; `upsertDailyLog` cho ngày backfill.
- TẠO/SỬA `src/store/__tests__/energyStore.backfill.test.ts` — test bất biến spec mục 4
  (số hôm nay giữ nguyên từng số; chồng ngày 2h sáng; ngày trống tự dựng readings).

**KHÔNG đụng:** mọi screen/component, `backfillEngine.ts` (của S-S1 — nếu thấy thiếu hàm thì
BÁO trong report, đừng tự sửa), repositories (API sẵn có đủ: `getReadingsForDate`,
`upsertReadings`, `addFoodLogEntry`, `deleteFoodLogEntry`, `upsertDailyLog`, `getLogsInRange`),
`satietyEngine.ts`, `App.tsx`.

**Prompt copy-paste — S-S4 (Sonnet):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (SPEC ĐẦY
ĐỦ — ĐỌC KỸ mục 3b/3c/3d/4) và .ai/NEXT_SESSIONS.md (mục S-S4). Điều kiện tiên quyết: S-S1 đã
merge (src/domain/food/backfillEngine.ts phải tồn tại — kiểm tra trước, thiếu thì DỪNG và báo).
Nhập vai agent logic-backend. Nhiệm vụ: thêm 2 action vào src/store/energyStore.ts đúng chữ ký
spec 3d: logFoodForPastDate(item, grams, timestamp, portion?) và removeFoodForPastDate(entry).
Ngữ nghĩa theo spec 3b: vi chất nạp vào readings của NGÀY LỊCH của entry, kcal vào readings
của ENERGY-DAY (energyDayString(new Date(timestamp)), reset 6h) — ngày nào chưa có readings
(quên mở app) thì dựng bằng buildReadingsForMissedDay (mode lấy từ daily_logs của ngày đó qua
getLogsInRange, fallback mode hiện tại trong settingsStore) rồi upsertReadings + upsertDailyLog.
Ghi food_log entry với timestamp quá khứ + energyDayApplied. Nhánh đặc biệt PHẢI đúng (spec 3c):
đích trùng ngày đang load trong store (vd 2h sáng backfill 23h hôm qua → energy-day trùng) thì
áp vào store rồi persist, mirror đúng pattern removeFood FIX #1 sẵn có. timestamp thuộc hôm nay
→ uỷ quyền get().logFood. TUYỆT ĐỐI không đụng satietyReserveKcal/lastSatietySyncAt trên row
lịch sử, không đổi masterPercentage/foodLog khi ghi ngày quá khứ. KHÔNG sửa backfillEngine.ts
(thiếu gì báo trong report), KHÔNG sửa screen/component/repository nào. Viết test
src/store/__tests__/energyStore.backfill.test.ts theo spec mục 4: (1) mọi số của hôm nay giữ
nguyên từng số sau backfill, (2) case 2h sáng, (3) ngày trống tự dựng readings đúng capacity,
(4) remove round-trip. Chạy npx tsc --noEmit + npx jest + npx expo export --platform ios
--output-dir /tmp/check_S-S4 trước khi báo xong. Ghi báo cáo vào .ai/parallel-reports/S-S4.md.
KHÔNG commit.
```

### S-S5 · Nối UI: Lịch sử + FoodLogModal — agent `mobile-frontend` — model **Sonnet** — ⚠️ CHẠY MỘT MÌNH (đợt 3)

**Mục tiêu:** nối 2 lối vào: (1) HistoryScreen chạm thẻ ngày → DayDetailSheet (fetch
`getFoodLogForDate`, xoá qua `removeFoodForPastDate`, "＋ Thêm món" mở FoodLogModal ghim ngày);
(2) FoodLogModal thêm hàng PastDateField — chọn ngày ≠ hôm nay thì ghi qua `logFoodForPastDate`
và hiện rõ "🕓 Ghi cho ngày …".

**File ĐƯỢC sửa:**
- SỬA `src/screens/HistoryScreen.tsx` — thẻ ngày bấm được, state sheet + fetch, refresh
  `loadHistory` sau thêm/xoá.
- SỬA `src/components/FoodLogModal.tsx` — thêm prop tuỳ chọn `initialDate?: string`, hàng
  PastDateField, timestamp build từ ngày chọn + giờ:phút (mặc định 12:00 nếu trống), rẽ nhánh
  logFood/logFoodForPastDate, reset ngày khi đóng.

**KHÔNG đụng:** `energyStore.ts` (của S-S4 — chỉ GỌI action), `PastDateField.tsx`/
`DayDetailSheet.tsx` (của S-S2/S-S3 — nếu props không khớp nhu cầu thì BÁO, đừng tự đổi hợp
đồng một mình; được phép sửa nhỏ NẾU ghi rõ trong report), `TrendChart.tsx`, `App.tsx`,
navigation, `HomeScreen.tsx`.

**Prompt copy-paste — S-S5 (Sonnet):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (mục 3a +
3d + 4) và .ai/NEXT_SESSIONS.md (mục S-S5). Điều kiện tiên quyết: S-S1→S-S4 đã merge (kiểm tra
backfillEngine.ts, PastDateField.tsx, DayDetailSheet.tsx, và energyStore có logFoodForPastDate/
removeFoodForPastDate — thiếu cái nào DỪNG và báo). Nhập vai agent mobile-frontend. Nhiệm vụ:
nối UI backfill. (1) SỬA src/screens/HistoryScreen.tsx: thẻ ngày thành Pressable → mở
DayDetailSheet với entries từ getFoodLogForDate(date); onDeleteEntry → removeFoodForPastDate
rồi refetch + loadHistory; onAddFood → mở FoodLogModal với initialDate=ngày đó; đóng modal →
refetch để thấy món mới. (2) SỬA src/components/FoodLogModal.tsx: thêm prop tuỳ chọn
initialDate?: string (YYYY-MM-DD, mặc định hôm nay), render PastDateField (maxDaysBack =
DATA_RETENTION_DAYS) cạnh ô giờ:phút; ngày ≠ hôm nay → hiện dòng "🕓 Ghi cho ngày <thứ, dd/mm>"
(formatDisplayDate) ngay trên nút Ghi, timestamp = ngày chọn + giờ:phút nhập (trống → 12:00),
ghi qua logFoodForPastDate; ngày = hôm nay giữ nguyên luồng logFood cũ 100% (đừng làm hỏng
hành vi hiện tại — đây là tiêu chí số 1). reset() phải trả ngày về hôm nay. KHÔNG sửa
energyStore.ts; props của PastDateField/DayDetailSheet không khớp thì báo trong report thay vì
tự đổi hợp đồng. Giữ logic ngoài view: phần build timestamp từ (date, hour, minute) viết thành
helper thuần module-level có thể test. Chạy npx tsc --noEmit + npx jest + npx expo export
--platform ios --output-dir /tmp/check_S-S5 trước khi báo xong. Ghi báo cáo vào
.ai/parallel-reports/S-S5.md. KHÔNG commit.
```

### S-S6 · QA review + checklist test máy — agent `qa-reviewer` — model **Sonnet** (Haiku nếu chỉ cần checklist) — đợt 4, read-only

**File ĐƯỢC tạo:** chỉ `.ai/parallel-reports/S-S6.md`. **KHÔNG sửa code** — phát hiện bug thì
liệt kê trong report, đừng tự vá.

**Prompt copy-paste — S-S6 (Sonnet):**
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, .ai/parallel-reports/S-S-backfill-spec.md (mục 4 là
tiêu chí nghiệm thu) và .ai/NEXT_SESSIONS.md (mục S-S). Nhập vai agent qa-reviewer — READ-ONLY,
tuyệt đối không sửa code. Nhiệm vụ: rà soát cụm S-S vừa merge (backfillEngine.ts,
energyStore.ts phần logFoodForPastDate/removeFoodForPastDate, PastDateField.tsx,
DayDetailSheet.tsx, FoodLogModal.tsx, HistoryScreen.tsx). Soát kỹ: (1) backfill có đường nào
rò rỉ làm đổi số hôm nay không (kể cả satietyReserveKcal, masterPercentage, foodLog RAM);
(2) case 0h–6h spec 3c; (3) double-tap nút Ghi có tạo 2 entry không; (4) xoá món backfill có
đảo đúng cả vi chất lẫn kcal không; (5) Excel export tuần có món backfill đúng ngày không;
(6) luồng ghi món HÔM NAY còn nguyên hành vi cũ không. Chạy npx tsc --noEmit + npx jest + npx
eslint . để xác nhận baseline sạch. Kết thúc: ghi .ai/parallel-reports/S-S6.md gồm (a) danh
sách bug/nghi vấn kèm file:dòng, (b) CHECKLIST TEST MÁY tiếng Việt từng bước trên iPhone/Expo
Go theo spec mục 4 (mục "Kiểm thử tay") để người dùng tự bấm.
```

**Đụng file chéo (BẮT BUỘC đọc):**
- Đợt 1 (S-S1∥S-S2∥S-S3): toàn file MỚI, không gói nào sửa file có sẵn → an toàn tuyệt đối,
  nhưng vẫn `git diff --stat` sau đợt để chắc không phiên nào "tiện tay" sửa file chung.
- `energyStore.ts`: CHỈ S-S4. `FoodLogModal.tsx` + `HistoryScreen.tsx`: CHỈ S-S5.
- Không chạy S-S song song với S-Q/S-R (S-Q đụng energyStore, S-R đụng Home — tránh nhầm đợt).
- Hợp đồng props/chữ ký hàm ở spec mục 3d là NGUỒN SỰ THẬT chung — phiên nào thấy hợp đồng
  không đủ thì ghi vào report của mình, KHÔNG tự ý đổi để khỏi phá phiên khác.

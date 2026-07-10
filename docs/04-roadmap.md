# 04 — Lộ trình & Tiến độ (Roadmap)

> Nguyên tắc: **đi từng bước nhỏ, mỗi bước đều chạy được trên điện thoại**. Đừng làm tất cả cùng lúc. Mỗi Phase có "Tiêu chí hoàn thành" rõ ràng — xong mới sang Phase sau.

Cột "Agent phụ trách" trỏ tới các file trong `.ai/agents/`.

---

## 🔄 Phase 0 — Chuẩn bị môi trường (≈ 2–4 ngày)
**Mục tiêu:** máy tính & điện thoại sẵn sàng, app trống chạy được.

- [x] Cài Node.js LTS — **XONG** (v24.16.0)
- [x] Cài "Expo Go" trên điện thoại — **XONG** (đã kết nối thành công 1 lần)
- [x] AI tạo cấu trúc project TypeScript đầy đủ (`App.tsx`, `package.json`, `tsconfig.json`…)
- [x] Tạo cấu trúc thư mục theo `docs/03-architecture.md` — **XONG** (`src/` với 5 lớp)
- [ ] Chạy `npm install` rồi `npx expo start` — quét QR, thấy app trên điện thoại — **npm install xong. Session 4 tìm ra & vá nguyên nhân gốc khiến bundle luôn hỏng: `.watchmanconfig` bắt Watchman bỏ qua `node_modules`. Sau khi vá, `expo export` build thành công 1403 module (iOS) — app SẴN SÀNG hiện trên máy. Chỉ còn bước quét QR xác nhận.**

**Tiêu chí hoàn thành:** App hiện lên điện thoại (màn hình Home có viên pin), nạp được Protein rồi đóng/mở app vẫn còn dữ liệu.
**Agent phụ trách:** `architect`

> 🟢 **Trạng thái (2026-06-18, gói S-A):** Đã quét QR thật, app chạy được trên iPhone qua Expo Go
> (kể cả qua wifi trường có client isolation). Còn thiếu: xác nhận Home hiện đúng 1 pin tổng + 6
> pin nhỏ (việc này dừng giữa đường để bàn tính năng mới — xem `.ai/NEXT_SESSIONS.md` gói S-A).

---

## 🔄 Phase 1 — MVP: Màn hình pin (≈ 2–3 tuần)
**Mục tiêu:** thấy được các viên pin và nạp/xả thủ công.

- [x] Vẽ `BatteryCell` + `MasterBattery` + `BatteryStack` — **XONG** (`src/components/`)
- [x] Màn hình Home hiển thị Master Battery + 6 pin nhỏ (Protein, Carbs, Nước, Khoáng, Ngủ, Vận động)
- [x] SQLite schema + database init + seed dữ liệu mặc định — **XONG** (`src/data/db/`)
- [x] Nút "Nạp" thủ công qua `IntakeModal` → pin tăng, lưu vào DB — **XONG**
- [ ] **Test thực tế:** nạp Protein, đóng app, mở lại vẫn thấy mức pin đúng

**Tiêu chí hoàn thành:** Bạn nạp Protein, đóng app, mở lại vẫn thấy mức pin đúng.
**Agent phụ trách:** `mobile-frontend` + `logic-backend`

> 🟡 **Trạng thái:** Code xong 100% (+92 unit test PASS, gói S-E). Chưa xác nhận đầy đủ test thật
> trên điện thoại (gói S-A đang dừng giữa đường, xem Phase 0).

---

## 🔄 Phase 2 — Modes & Tự động hoá (≈ 2 tuần)
**Mục tiêu:** app bắt đầu "tự sống".

- [x] Định nghĩa Modes (Training / Maintain / Rest) — **XONG** (`src/domain/modes/modeDefinitions.ts`)
- [x] Mode thay đổi sức chứa (`capacityMultipliers`) & tốc độ xả (`drainRatePerHour`) — **XONG**
- [x] `ModeSelector` component + lưu vào `settingsStore` — **XONG**
- [x] Logic xả pin theo thời gian (`tickDrain` trong `energyStore`) — **XONG**, và giờ được GỌI
  thật theo định kỳ qua `useDrainTick` (mỗi 30 phút + khi quay lại từ nền) — gói **S-D**.
- [x] Reset hàng ngày khi mở app sang ngày mới (`App.tsx` tự dò đổi ngày mỗi 15 phút +
  khi mở lại app, rồi gọi `loadToday` — **không phải** `resetForNewDay`, hàm đó hiện
  chưa được gọi ở đâu cả, xem ghi chú review tích hợp 2026-06-18) — **XONG** (S-D)
- [x] Thông báo "pin sắp cạn" (`notificationService.ts`) — **XONG**, nút bật/tắt trong Settings đặt
  & huỷ nhắc nhở hàng ngày thật, ngưỡng cảnh báo người dùng chọn được dùng thật — gói **S-C**.
- [x] Màn hình Settings: đặt ngưỡng cảnh báo — **XONG** (`src/screens/SettingsScreen.tsx`)
- [ ] **Test thực tế:** đổi Mode Training → thấy mục tiêu Protein tăng; nhận thông báo thật

**Tiêu chí hoàn thành:** Đổi sang Mode Training thấy mục tiêu Protein tăng; nhận được 1 thông báo nhắc nhở thật.
**Agent phụ trách:** `logic-backend`

> 🟡 **Trạng thái:** Code xong đầy đủ (gồm nhắc nhở thật + tự xả pin định kỳ thật, không còn là
> placeholder). Chưa xác nhận test thật trên điện thoại (gói S-A).

---

## 🔄 Phase 3 — Excel, Diary & Dọn dẹp (≈ 1–2 tuần)
**Mục tiêu:** dữ liệu được lưu trữ và riêng tư.

- [x] Xuất Excel (`excelExportService.ts` dùng `xlsx` + `expo-file-system` + `expo-sharing`) — **XONG**
- [x] Tự xoá dữ liệu > 7 ngày (`cleanupService.ts`) — **XONG**
- [x] Màn hình Diary mã hoá write-only (`DiaryScreen.tsx` + `encryption.ts`) — **XONG**
- [x] Biểu đồ xu hướng tuần — **XONG** (`TrendChart.tsx`, vẽ bằng `react-native-svg` đã có sẵn,
  KHÔNG dùng `victory-native` như dự kiến ban đầu — gói **S-B**; gói E3 nối thêm đường pin Năng
  lượng vào cùng biểu đồ)
- [ ] **Test thực tế:** xuất file Excel ra điện thoại; ghi nhật ký riêng tư

**Tiêu chí hoàn thành:** Bạn xuất được 1 file Excel ra điện thoại; ghi được nhật ký riêng tư.
**Agent phụ trách:** `logic-backend` + `mobile-frontend`

> 🟡 **Trạng thái:** Code xong đủ 4/4 mục. Chưa xác nhận test thật trên điện thoại (gói S-A).
>
> **Đã vượt phạm vi Phase 3 ban đầu (Session 5, chưa có mục riêng trong roadmap):** Food Log
> (ghi món ăn từ `food_items.csv`, xem/xoá "Hôm nay đã ăn" theo bữa) và pin Năng lượng hiển thị
> **xả mượt theo giây** (`LiveMasterBattery` + `useLiveEnergyReading`) — xem `docs/07-food-log.md`
> và `docs/06-energy-expenditure.md`.
>
> **Bổ sung Session 9–10 (2026-06-19 → 07-03), chưa test máy:** (a) **S-F** — field "số bước
> trung bình/ngày" trong Hồ sơ cơ thể, cộng vào `passiveDailyBurn` (KHÔNG phải đọc bước chân thật
> — đó là Phase 4 bên dưới, vẫn `[ ]`); (b) **S-N** — pipeline offline USDA FoodData Central
> (`npm run gen:usda`, danh sách tra cứu `USDA_FOODS` BỔ SUNG món Việt); (c) **U7** — công tắc
> "Tra cứu USDA (EN)" trong màn ghi món + dịch `name_vi` theo nhu cầu. Xem
> `.ai/parallel-reports/S-N.md`, `U7.md`, `S-F.md`.
>
> **Nâng cấp lớn Session 11–12 (2026-07-03 → 07-04), CHƯA test máy:** pin Năng lượng đổi mô hình
> — headline giờ là **"Pin no/đói"** tụt dần theo nhịp sinh học (sàn 20%), dòng phụ **"Sổ calo hôm
> nay"** đếm lên reset **6h sáng**, mục tiêu tự tính từ cân nặng mong muốn (gói **S-M+S-O+S-P+S-Q**
> — xem `.ai/parallel-reports/S-M.md`/`S-O.md`/`S-P.md`/`S-Q.md`). Cùng lúc thêm dàn **"pin vi
> chất"** mới (Chất xơ/Sắt/Canxi/Chất béo/Kali/Magie/Kẽm/Natri/Đường) dẫn xuất từ nhật ký món,
> KHÔNG đổi DB (gói **S-R** — xem `.ai/parallel-reports/S-R.md`).
>
> **Session 14 (2026-07-08), ĐÃ COMMIT (`9da940a`) nhưng CHƯA test máy:** Excel đa-sheet mới
> ("Daily Totals"/"Food Entries") + món tự thêm khi ghi chưa khớp (`custom_foods`, bền qua
> restart) + **sửa thành phần dinh dưỡng món** qua bảng override (`food_overrides`, áp dụng khắp
> nơi qua `getAnyFoodById`) + pin **"Muối & điện giải"** (Muối suy từ Natri, tự cập nhật) + đổi
> nhãn macro "Tinh bột"→"Carbs (Carbohydrate)" (giữ nguyên tên nhóm món "grain") + quản lý TPCN
> (thêm/sửa/log) + cảnh báo vượt Upper-Limit tham khảo. Verify: 249 test PASS, tsc/lint sạch. Chi
> tiết đầy đủ + 5 bug đã vá: `.ai/SESSION_LOG.md` Session 14.
>
> **Session 16 (2026-07-09), ĐÃ COMMIT (`7d2e6dd`) nhưng CHƯA test máy — S-A, theo feedback thật
> của người dùng:** TPCN hỗ trợ nhập theo **Gói/Viên** với khối lượng riêng (không còn ép quy đổi
> mốc 100g) + **bảng `activity_log` độc lập** cho Vận động với **Sửa/Xoá hoàn tác đúng pin** +
> trường "khoảng thời gian diễn ra" + **Pin Vận động** (trước đây luôn = 0, nay được nạp đúng) và
> **Pin Carbs** (tự suy từ đường+xơ khi để trống) đồng bộ real-time. 1 lượt QA-reviewer + 1 lượt
> `/code-review` (8 finder + verify) vá tổng **9 bug tích hợp** trước commit, gồm 1 bài học dài hạn
> đã lưu lại (hoàn tác phải dùng delta tương đối, không recompute tuyệt đối — xem
> `.ai/skills/learned/`). Verify: **291/291 test**, tsc/lint sạch. Chi tiết: `.ai/SESSION_LOG.md`
> Session 16.

---

## 🟠 Phase 4 — Tích hợp dữ liệu ngoài (≈ 2–3 tuần)
**Mục tiêu:** app nhận tín hiệu từ điện thoại/đồng hồ.

- [ ] Xin quyền & đọc số bước chân
- [x] Tích hợp HealthKit (iOS): kcal đốt trong ngày (active + resting energy) — **S-F2, Session 19,
  CODE XONG chưa test máy thật.** Hiển thị cạnh kcal ăn (Home), KHÔNG ảnh hưởng tốc độ xả pin (xem
  dòng dưới — cố ý, chỉ hiển thị). Chưa làm: nhịp tim, giấc ngủ, Health Connect (Android).
- [ ] Đưa tín hiệu vào ảnh hưởng tốc độ xả pin — **quyết định thiết kế S-F2: KHÔNG làm ở v1**, kcal
  Apple Health chỉ hiển thị song song (Đã đốt/Đã ăn/Chênh lệch), không đụng `battery_readings
  .capacity`/`activityBonusKcal`/`satietyReserveKcal`. Có thể cân nhắc lại ở v1.1+ nếu người dùng
  muốn sau khi test thật.

**Tiêu chí hoàn thành:** Đi bộ nhiều → pin năng lượng xả nhanh hơn tương ứng.
**Agent phụ trách:** `architect` + `logic-backend`

---

## 🔴 Phase 5 — Lớp thông minh (liên tục, làm sau cùng)
**Mục tiêu:** dự báo xu hướng (KHÔNG chẩn đoán bệnh).

- [ ] Thu thập ~1 tháng dữ liệu trước khi bật
- [ ] Phát hiện mẫu hình đơn giản (rule-based) trước
- [ ] Mô hình hồi quy / TensorFlow Lite chạy trên máy
- [ ] Gợi ý cá nhân hoá, kèm cảnh báo "chỉ tham khảo, hãy gặp bác sĩ"

**Tiêu chí hoàn thành:** App đưa ra 1 gợi ý xu hướng có ích, có disclaimer y tế đầy đủ.
**Agent phụ trách:** `data-ml`

> ⚠️ Phase này nhạy cảm về sức khoẻ. Đọc lại ranh giới trong `docs/01-vision-and-features.md` trước khi làm.

---

## 📊 Bảng tổng quan tiến độ

| Phase | Tên | Code | Test thật | Ghi chú |
|-------|-----|------|-----------|---------|
| 0 | Chuẩn bị | ✅ | 🟡 | Đã quét QR thật trên iPhone qua Expo Go. Còn thiếu xác nhận Home đủ 7 pin |
| 1 | MVP màn hình pin | ✅ | ⏳ | Code + bundle OK (1424 module). Cần chạy thật: nạp pin + đóng/mở lại |
| 2 | Modes & tự động | ✅ | ⏳ | Nhắc nhở thật + tự xả pin định kỳ thật đã xong (S-C, S-D). Cần test thật |
| 3 | Excel, Diary, dọn dẹp | ✅ | ⏳ | Đủ 4/4 mục kể cả biểu đồ xu hướng (S-B). + Food Log/live drain (Session 5) + Excel đa-sheet/override/Muối/TPCN (Session 14) + TPCN Gói/Viên + Vận động Sửa/Xoá + đồng bộ pin nhỏ (Session 16, ngoài phạm vi gốc) |
| 4 | Tích hợp dữ liệu | 🔄 | ⬜ | S-F2 (Session 19): HealthKit kcal đốt/ngày — CODE XONG (377 test PASS), cần build dev client (`eas build --profile development`) mới test máy được, KHÔNG chạy qua Expo Go. Bước chân/nhịp tim/giấc ngủ/Android chưa làm |
| 5 | Lớp thông minh | ⬜ | ⬜ | Chưa bắt đầu — cần dữ liệu cân nặng từ S-L trước (xem `.ai/NEXT_SESSIONS.md`) |

**Ký hiệu:** ✅ Xong | 🔄 Đang làm/chưa đủ | ⏳ Chờ môi trường | 🟡 Một phần | ⬜ Chưa bắt đầu

> 🚨 **Việc đầu tiên của session tiếp theo (cập nhật Session 12, 2026-07-04):** **S-A — test máy
> thật** là ưu tiên số 1 hiện tại, vì code đã dồn khá nhiều đợt chưa hề chạy trên điện thoại: mô
> hình "2 đồng hồ" (S-M/S-O/S-P/S-Q — đặc biệt xác nhận mốc reset Sổ calo lúc 6h sáng) và dàn
> "pin vi chất" (S-R — xác nhận màu trung tính khi dưới/vượt mốc + chọn lại ngày cũ). Sau đó: nếu
> muốn làm tiếp vitamin cho S-R thì cần một gói tra cứu dinh dưỡng thật cho món Việt trước (xem
> `.ai/parallel-reports/S-R.md`). **L-1** (2 lint error tồn đọng) vẫn còn treo, gói nhỏ.
>
> 🟢 **(2026-06-18, Session 6)** Đã `git push` hết lên `origin/main` — không còn commit local nào
> treo lại. U2, U3 (đợt UX) đã xong.
>
> 🟢 **(2026-06-18, Session 7)** **S-L** (ghi cân nặng theo thời gian) đã xong.
>
> 🟢 **(2026-07-04, Session 11–12)** **S-M/S-O/S-P/S-Q** (nâng cấp "2 đồng hồ") và **S-R** (pin
> vi chất) đã xong code, commit xong — xem chi tiết ở khối "Nâng cấp lớn Session 11–12" trên.
>
> 🟢 **(2026-07-07, Session 13)** **U7 vượt spec** (toàn bộ 363 tên USDA dịch tiếng Việt, tìm kiếm gộp song ngữ), **L-1** (0 lint error), **Excel export 6 sheet** (thêm "Dinh dưỡng ngày", "Tổng kết tuần", "Bảng ngưỡng tham chiếu" + cột "Đánh giá"), **food_items.csv** (73→90 món + 3 category + 2 cột EPA/DHA), sửa bug pin vi chất (`foodLookup.ts`), thêm Omega-3 pin + nạp nhanh supplement. Verify: 188/188 test, 19 suite, 0 lint error. (Đã commit ở các commit riêng trước Session 14.)
>
> 🟢 **(2026-07-08, Session 14, ĐÃ COMMIT `9da940a`, chưa push)** Excel đa-sheet (Daily Totals/Food
> Entries), món tự thêm bền qua restart, sửa thành phần dinh dưỡng món (override), pin Muối & điện
> giải, đổi nhãn Carbs, quản lý TPCN, cảnh báo vượt Upper-Limit. 2 lượt QA vá **5 bug tích hợp**
> trước commit. Verify: **249/249 test**, tsc/lint sạch. Chi tiết: `.ai/SESSION_LOG.md` Session 14.
>
> 🟢 **(2026-07-09, Session 16, ĐÃ COMMIT `7d2e6dd`, chưa push)** S-A: TPCN theo Gói/Viên, bảng
> `activity_log` độc lập (Sửa/Xoá hoàn tác đúng pin qua thuật toán delta, trường giờ diễn ra), Pin
> Vận động/Carbs đồng bộ real-time. QA-reviewer + `/code-review` vá **9 bug tích hợp** trước commit.
> Verify: **291/291 test**, tsc/lint sạch. Chi tiết: `.ai/SESSION_LOG.md` Session 16.
> **Chưa test máy** — backlog test tay giờ gồm cả nội dung Session 11–16.

> 🟢 **(2026-07-09, Session 17, ĐÃ COMMIT `<TBD>`, chưa push)** 3 fix từ feedback thực tế: hoàn tác
> món ăn đúng energy-day (thêm `energyDayApplied`), sửa khối lượng/viên qua modal, hoàn tác nạp nhanh
> + component mới `TodayIntakes.tsx`. Lỗi #4 là báo động giả (đã có xác nhận). Verify: **299/299 test**,
> tsc/lint sạch. **Chưa test máy** — backlog test tay dồn Session 11–17.
>
> 🟡 **(2026-07-10, Session 18, CHƯA COMMIT, nhánh `ui-upgrade`)** S-A bước 3 test máy thật lộ 4 bug,
> đã vá: **(3a)** dữ liệu USDA thiếu đường/xơ do map sai nutrient number (bản Foundation Foods 2026
> đổi số phân tích) → sửa `generate-usda-db.js`. **(3b)** bàn phím che nút Lưu form Thêm món mới →
> thêm `flexShrink: 1` vào các sheet. **(3c)** chốt bất biến `carb_g >= sugar_g + fiber_g` ở mọi nơi
> nhập liệu (yêu cầu người dùng). **(3d, phát hiện ở lượt test lại)** modal "Sửa thành phần" không
> hiện gì do 2 `<Modal>` RN chồng nhau (giới hạn RN trên iOS) → ẩn BottomSheet khi modal sửa mở.
> Cộng tính năng mới: đổi đơn vị hiển thị/nhập ml↔L cho pin Nước (`src/lib/units.ts` + persist trong
> settingsStore), dữ liệu vẫn 1 biến ml duy nhất. Verify: **320/320 test**, tsc/lint sạch. **Bug 3d
> là hành vi runtime RN Modal — không có test tự động, bắt buộc test tay trên điện thoại để xác
> nhận trước khi commit.** Chi tiết: `.ai/SESSION_LOG.md` Session 18, `.ai/parallel-reports/S-A.md`.

> 💡 Cập nhật bảng này sau mỗi session để AI luôn biết đang ở đâu.

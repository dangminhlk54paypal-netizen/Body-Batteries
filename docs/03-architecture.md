# 03 — Cấu trúc hệ thống & Mô hình dữ liệu

## 🏗️ Kiến trúc theo lớp (Layered Architecture)

App được chia thành các lớp rõ ràng để bạn và AI luôn biết "code này nằm ở đâu":

```
┌─────────────────────────────────────────────┐
│  UI Layer (Màn hình & thành phần giao diện)   │  ← Pin, biểu đồ, nút bấm
│  screens/  components/                        │
├─────────────────────────────────────────────┤
│  State Layer (Trạng thái app)                 │  ← Zustand stores
│  store/                                       │
├─────────────────────────────────────────────┤
│  Domain Layer (Logic năng lượng - "bộ não")   │  ← Tính nạp/xả, reset, Mode
│  domain/  (battery engine, modes, rules)      │
├─────────────────────────────────────────────┤
│  Data Layer (Lưu trữ)                         │  ← SQLite, SecureStore
│  data/  (repositories, db)                    │
├─────────────────────────────────────────────┤
│  Services Layer (Dịch vụ nền & ngoài)         │  ← Thông báo, Excel, Health
│  services/  (notifications, export, health)   │
└─────────────────────────────────────────────┘
```

**Quy tắc vàng:** lớp trên chỉ gọi xuống lớp dưới, không bao giờ ngược lại. Giao diện (UI) không tự lưu dữ liệu — phải đi qua Domain → Data.

---

## 📁 Cấu trúc thư mục mã nguồn (cập nhật 2026-07-03 theo code thực tế)

```
src/
├── screens/            # Các màn hình (Home, History, Settings, Diary, Onboarding)
├── components/         # Khối tái sử dụng (BatteryCell, MasterBattery, TrendChart...); training/ = Sổ tập luyện
├── navigation/         # Điều hướng tab (React Navigation)
├── hooks/              # Hook React (useDrainTick, useLiveEnergyReading, useLowEnergyWatch)
├── store/              # Zustand: energyStore, settingsStore
├── types/              # Kiểu TypeScript dùng chung (battery, energy...)
├── domain/
│   ├── battery/        # "Battery engine": tính mức pin, nạp, xả
│   ├── energy/         # metabolismEngine (BMR/TDEE), energyBalanceEngine (sổ calo), satietyEngine (pin no/đói), weightGoal (mục tiêu kcal), profileValidation
│   ├── food/           # foodNutrition, foodLogSummary (quy đổi món ăn → dinh dưỡng)
│   ├── modes/          # Định nghĩa các Mode và ảnh hưởng
│   ├── training/       # Sổ tập luyện: trainingLogFormatter (dòng kiểu Notes), trainingLogIndex (block→tuần→ngày), trainingLogPage, entryEdit
│   └── rules/          # Quy tắc nhắc nhở/cảnh báo
├── data/
│   ├── db/             # Khởi tạo SQLite, schema
│   ├── food/           # Danh sách món ăn (CSV Việt + USDA generated) + loader
│   └── repositories/   # Đọc/ghi dữ liệu (batteryRepo, intakeRepo, healthSignalsRepo...)
├── services/
│   ├── notifications/  # Nhắc nhở, cảnh báo
│   ├── background/     # Kiểm tra sang ngày mới (dailyResetCheck)
│   ├── export/         # Xuất Excel
│   └── cleanup/        # Tự xoá dữ liệu > 1 tuần
├── i18n/               # Đa ngôn ngữ (Việt/Anh/Đức) — xem mục riêng bên dưới
└── lib/                # Tiện ích chung (ngày tháng, mã hoá, metabolicConstants)
```

**Ngoài `src/` (gốc repo):**
- `scripts/` — script Node sinh dữ liệu món ăn (`gen:food`, `gen:usda`), chạy trước khi start.
- `database/` — dữ liệu USDA: `raw/` (file gốc 6.4MB, KHÔNG commit) + `extract/` (CSV gọn, có commit).
- `.ai/` — luật dự án, skills, agents, báo cáo song song. `.claude/` — cấu hình Claude Code
  (native subagents + hooks lint tự động, xem `.ai/CONTEXT.md` mục 6).
- `services/health/` chưa tồn tại — sẽ tạo khi tích hợp HealthKit/Health Connect (S-F v2).

---

## 🔋 Pin theo GIỜ ĂN, không phải giờ ghi (Session 31, 2026-09-23)

**Nguyên tắc:** mỗi sự kiện tác động lên pin tại **thời điểm nó xảy ra**. Giá trị pin hiện tại = phát
lại (replay) mọi sự kiện có dấu thời gian theo thứ tự, trừ tiêu hao giữa các sự kiện. Ghi muộn và ghi
đúng giờ phải cho **cùng một kết quả**. Lý do không vá cục bộ: pin có trần và sàn nên hiệu ứng của một
sự kiện chèn vào quá khứ không cộng tuyến tính — phải biết quỹ đạo, tức là cần nhật ký.

| Pin | Cách tính | Hàm thuần | Nguồn |
|---|---|---|---|
| No/đói (headline) | replay 48h từ reserve 0, tiêu hao nhịp sinh học | `replaySatietyReserve` | `food_log`, `intake_events`, `activity_log` (DB ∪ log hôm nay trong bộ nhớ, khử trùng theo id) |
| protein/carbs/water/minerals | replay từ 0h của **ngày dòng pin**, tiêu hao tuyến tính `capacity × drainRatePerHour` | `replayDrainingPin` / `recomputeFoodPinLevels` | `foodLog` + `intakeLog` trong store |
| Sổ kcal (`energy.level`) | cộng dồn, **không** phụ thuộc thời gian | `chargeEnergy` / `burnEnergy` | — |
| movement, sleep | như cũ (tăng/giảm dần) — chưa chuyển | `applyIntake` / `applyDrain` | — |

- Giá trị lưu ở `battery_readings` của no/đói và 4 pin trên chỉ là **cache** của replay; store gọi lại
  (`recomputeSatiety`, `recomputeFoodPins`) sau `loadToday`, `logFood`, `removeFood`, backfill, `addIntake`,
  `removeIntake`, `addCalories`, `logActivity`, `removeActivity`, `resetForNewDay`. `tickDrain` giữ nguyên
  (drain tăng dần cho cùng kết quả).
- `recomputeSatiety` có token chống chạy chồng (`satietyRecomputeSeq`): chỉ lần bắt đầu muộn nhất được ghi.
- Xấp xỉ đã chấp nhận: pin dinh dưỡng replay bằng **mode hiện tại** cho cả ngày (đổi mode giữa ngày thì
  phần đã qua tính lại theo mode mới).
- UI: `FoodLogModal` chặn giờ ăn ở tương lai (`mealTimeStatus`) và gợi ý khi ghi muộn ≥ 30 phút.
- Hồ sơ lỗi + nhật ký sửa: `.ai/plans/2026-09-23-battery-late-logging-timing.md`.

---

## 📓 Sổ tập luyện — nhật ký bài tập kiểu Apple Notes (Session 32, 2026-09-23)

Tab **Tập luyện** có hai chế độ: **📓 Sổ tập** (mặc định) và **📋 Kế hoạch block** (màn Block Builder cũ,
`BlockPlanView`, không đổi hành vi). Sổ tập biến các buổi đã ghi ở **Xả** thành cuốn sổ đọc như file Notes
của người dùng: `26.08(77.7kg): S 130 4x3x115+3x100 PD 4x3x100`. Kế hoạch đầy đủ + nhật ký triển khai:
`.ai/plans/2026-09-23-training-log-notebook.md`.

**Nguyên tắc (đừng phá):**
1. **`activity_log` là nguồn sự thật, sổ không lưu chữ máy sinh.** Dòng được sinh lại mỗi lần hiển thị
   (`formatDayLine`), nên đổi ngôn ngữ / viết tắt / tuỳ chọn thì cả sổ cũ đổi theo. Chỉ phần **người dùng
   thêm** được lưu (`training_log_days`, `training_log_weeks`, `TrainingBlockConfig.name`).
2. **Sửa chữ ≠ sửa số liệu.** Sửa/ghi tay trong sổ **không bao giờ** đổi kcal hay pin. Muốn đổi số liệu phải
   mở lại sheet Powerlifting/Bodybuilding ("Sửa số liệu") → `energyStore.updateActivityForPastDate` (chỉ ghép
   `updateActivity` / `removeActivityForPastDate` + `logActivityForPastDate` dưới `timestamp` cũ; test chứng
   minh kết quả y hệt như ghi đúng từ đầu).
3. **Dòng ghi tay không tạo `activity_log`** và không gọi bất kỳ action nào của `energyStore` (người dùng hay
   quên Xả). Không bị giới hạn 3 ngày của Xả bù (`TRAINING_LOG_MAX_DAYS_BACK = 730`).
4. **Không bao giờ tự ghi đè chữ người dùng.** Dòng đã sửa/ghi tay được gắn `source_signature`; khi các buổi
   Xả của ngày đổi, `detectDayConflict` trả `sourceChanged` / `xaAddedToManual` / `sourceGone` và UI hỏi
   (Dùng dòng tự động / Giữ dòng của tôi / Gộp).

**Ký hiệu (từ sổ thật của người dùng)** — `trainingLogFormatter.ts`:
`90` (1 rep) · `3x100` (rep×tạ) · `5x5x72.5` (set×rep×tạ) · `6x4(+3)x75` (set cuối làm thêm 3 rep) ·
`110x(4+5+5+4+8)` (rep không đều) · cụm nối bằng `+`, sau top single là khoảng trắng (`130 4x3x115+3x100`).
Tên bài viết tắt (S/B/D, PS/PD/iC/LG…, đè được theo từng khoá `lift:`/`var:`/`cvar:`/`bb:`). Thập phân mặc
định là **dấu chấm**; ô nhập số dùng `parseDecimal` (chấp nhận `,`), dòng ghi tay chuẩn hoá `72,5`→`72.5`
(`normalizeManualBody`, chỉ với dòng tập, không với ghi chú).

**Dữ liệu → giao diện:**
```
activity_log ─┐
training_log_* ├→ buildTrainingLogIndex (thuần: block → tuần → ngày)  → trainingLogStore.periods
training_blocks ┘
tuần mở ra → tải activity_log + training_log_days + cân nặng của tuần → formatDayLine → TrainingLogDayLine
```
`TrainingLogView` sở hữu mọi sheet (soạn thảo, ghi chú tuần/tên block, định dạng ⚙︎, Trang 📄); các dòng chỉ
báo `TrainingLogActions`. `revision` của `trainingLogStore` tăng mỗi lần ghi hoặc mỗi lần tab được focus, để
tuần đang mở tải lại (màn hình tab không bị unmount). Kỳ mới nhất và tuần mới nhất mở sẵn, còn lại gập.

**Ghi biến thể khi Xả:** `WorkoutSession.variationId?` / `variationName?` (JSON, không migration).
`PowerliftingSheet` giữ danh sách *movement* (`liftingMovements.ts`) nên một ngày ghi được `B` + `iC`.
Kcal vẫn tính theo tạ × rep thật từng session.

**i18n:** đã phủ vi/en/de (namespace `trainingLog`, `components.powerliftingSheet.*`). Viết tắt là ký hiệu
quốc tế nên giống nhau ở cả 3 ngôn ngữ nhưng vẫn nằm trong file locale.

### Bổ sung Session 34 (2026-09-24): tiêu đề tuần đầy đủ, biểu đồ tiến độ, sửa ngược từ 📄 Trang

**Tiêu đề tuần** (`formatWeekHeading(week, period, …)`): tuần trong block ghi `B2W1: 07.09–13.09 76.3kg`
(số block + số tuần, khoảng ngày, lần cân đầu tiên của tuần), deload `B2 DELOAD: …`; tuần tập tự do vẫn là
`07.09–13.09 76.3kg` (không có block nên không có `B…W…`). Trang 📄 dùng cùng tiêu đề.

**Bộ đọc ngược ký hiệu** — `trainingLogParser.ts` (`parseDayBody`, `parseSetChain`, `buildLabelLookup`): đọc
dòng ngày thành bài + set theo đúng ngữ pháp trên. Nhãn tra theo thứ tự: nhãn của chính các buổi Xả hôm đó
(nên biến thể tự đặt tên vẫn nhận ra), viết tắt người dùng đè, viết tắt mặc định, tên đầy đủ; không phân biệt
hoa/thường (`pS` = `PS`). Ngoặc không phải ký hiệu (`(95 ❌)`, `(rpe9.2)`, `(test)`) và chữ gạch ngang/❌ là
**ghi chú của người dùng**, không bao giờ thành set. Phần đọc không được thì báo lại, không đoán.
Lưu ý: phiên song song (Kế hoạch block, Session 33) có `setNotation.ts` đọc cùng ký hiệu cho ô kế hoạch
(dễ dãi hơn: `5x5@72.5`, `(4x2+5)x90`). Hai bộ đọc nên gộp làm một khi cả hai đã commit.

**📈 Biểu đồ tiến độ** (`TrainingProgressChart`, dữ liệu `trainingLogProgress.buildLiftProgress`), ngay dưới
sổ: mỗi tuần (26 tuần gần nhất) một điểm = **set làm việc nặng nhất** của S/B/D **bài chuẩn** (biến thể như
Pause bị bỏ để ngày tập kỹ thuật không trông như tụt sức). Nút chuyển **kg** / **× cân nặng** (một trục mỗi
lần, không vẽ hai trục). Cân nặng của tuần = lần cân đầu tiên trong tuần, không có thì lần gần nhất trước đó,
không có nữa thì cân nặng hồ sơ. Ngày có dòng ghi tay/sửa tay thì **dòng đó thắng** (đọc bằng parser), nên buổi
quên Xả vẫn lên biểu đồ. Chạm biểu đồ để xem từng tuần (tên `B2W3`, kg, tỉ lệ, cao nhất đến tuần đó). Màu
S/B/D: token `liftSquat/liftBench/liftDeadlift` trong `theme.ts` (đã chạy kiểm tra mù màu; luôn kèm nhãn chữ).

**Sửa ngược từ 📄 Trang** — ngoại lệ có kiểm soát của nguyên tắc 2 ("sửa chữ ≠ sửa số liệu"). Trong Trang,
nút **✎ Sửa trang** biến cả kỳ thành một ô chữ. Luồng 2 bước, **không có gì chạm pin trước khi người dùng xem**:
```
chữ đã sửa ─→ parsePageText (thuần: so với PeriodPage của buildPeriodPage → DayEdit / ghi chú tuần / tên block)
           ─→ planPageEdit (service: tải buổi Xả + bản ghi sổ từng ngày → planDaySync) ─→ màn "Xem thay đổi"
           ─→ applyPageEdit ─→ energyStore.updateActivityForPastDate (tính lại kcal & pin) + trainingLogStore.writeNotebook
           ─→ màn "Đã cập nhật": từng mục ghi rõ vào đâu (Buổi Xả / Chữ trong sổ / Dòng ghi tay / Ghi chú…),
              trước → sau, kcal buổi tập trước → sau, và lý do nếu không áp dụng.
```
`planDaySync` (`trainingLogDaySync.ts`) bảo thủ: bài viết y như cũ giữ nguyên session (khởi động, phút, dữ
liệu bodybuilding); bài đổi số thì dựng lại set (giữ set khởi động cũ); bài bị xoá khỏi dòng thì bỏ khỏi entry.
**Không áp dụng vào Xả** (chỉ lưu chữ, có ghi lý do) khi: có phần không đọc được; sửa sẽ làm rỗng cả một entry
(đó là xoá, phải làm ở Lịch sử); dòng của ngày có Xả bị xoá/để trống (buổi Xả giữ nguyên). Ngày không có Xả →
dòng ghi tay như cũ (không tạo `activity_log`). Cân nặng trong `(77.7kg)` không sửa từ trang. Dòng có ghi chú
kiểu `(95 ❌)` vẫn cập nhật Xả, chữ của người dùng được giữ làm dòng của ngày và gắn chữ ký của buổi **mới**
(không bật banner xung đột). Service nhận các hàm ghi qua tham số (`PageEditWriters`), nên test không cần store.

**Bẫy đã gặp:** (a) `act(() => onPress())` trong test — nếu `onPress` trả Promise thì `act` thành bất đồng
bộ và làm test sau render rỗng; bọc `{ }`. (b) `PastDateField` chỉ ghi ngày khi ô mất focus và bàn phím
`decimal-pad` không có `/` → trình soạn thảo dùng ô ngày riêng (`parseDayMonthInput`). (c) Hai `<Modal>` lồng
nhau lỗi trên iOS → "Sửa số liệu" đóng trình soạn thảo rồi mới mở sheet Powerlifting.

---

## 🌐 Đa ngôn ngữ (Session 14, 2026-07-17)

Toàn bộ giao diện + file Excel xuất ra hỗ trợ **3 ngôn ngữ: Tiếng Việt (mặc
định) / English / Deutsch**, chọn từ mục "🌐 NGÔN NGỮ" đầu màn Cài đặt.

```
src/i18n/
├── types.ts       # Language ('vi'|'en'|'de'), LOCALE_TAGS (map sang 'vi-VN'/'en-US'/'de-DE')
├── translate.ts   # translate(language, key, vars?) — tra cứu theo đường dẫn "a.b.c" + nội suy {{var}}
├── useT.ts         # useT() hook cho component: { t, language } · useLanguage() · getCurrentLanguage()
├── index.ts        # barrel export
└── locales/
    ├── vi.ts        # nguồn gốc cấu trúc (mọi key phải xuất phát từ đây trước)
    ├── en.ts         # phải khớp CHÍNH XÁC cấu trúc vi.ts — tsc báo lỗi nếu thiếu key
    └── de.ts         # tương tự en.ts
```

**Cách hoạt động:**
- Lựa chọn ngôn ngữ lưu ở `settingsStore.language` — field Zustand bình
  thường, tự động lưu vào máy qua middleware `persist` (AsyncStorage) đã có
  sẵn từ trước, không cần thêm cơ chế lưu trữ mới.
- Component gọi `const { t, language } = useT();` rồi `t('settings.title')`.
  Hook này **chỉ theo dõi đúng field `language`** trong store — đổi ngôn ngữ
  chỉ vẽ lại những component có gọi `useT()`, không vẽ lại toàn app (app này
  vốn không dùng React Context cho theme/state toàn cục, xem `lib/theme.ts`)
  → đổi ngôn ngữ mượt, không giật/khựng.
- Hàm thuần (domain/service, không phải component — vd
  `nutritionAssessment.ts`, `excelExportService.ts`) nhận `language` như một
  tham số bình thường thay vì tự đọc store, giữ đúng nguyên tắc lớp Domain
  "thuần, dễ test" trong sơ đồ kiến trúc ở đầu file này.
- **An toàn kiểu dữ liệu:** `vi.ts` là cấu trúc gốc; `en.ts`/`de.ts` được ép
  kiểu theo đúng cấu trúc đó (`TranslationSchema = typeof vi`), nên `npx tsc
  --noEmit` sẽ báo lỗi ngay nếu ai đó thêm 1 chuỗi vào `vi.ts` mà quên thêm
  bản dịch tương ứng ở `en.ts`/`de.ts` — không thể "quên dịch" mà không bị
  phát hiện khi build.
- **Tên các pin** (Protein/Carbs/Nước...) vốn được lưu 1 lần trong SQLite
  (`battery_types.name`) lúc cài app lần đầu — thay vì đọc cột đó, màn hình
  luôn tra theo `id` pin qua `batteryTypeName(id, language)`
  (`src/lib/constants.ts`) nên tên pin vẫn đổi được theo ngôn ngữ dù dữ liệu
  gốc trong DB không đổi.
- **Cố ý KHÔNG dịch:** tên món ăn đã ghi vào Nhật ký ăn uống
  (`FoodLogEntry.foodNameVi`) — đây là snapshot tiếng Việt tại đúng lúc ghi
  món, đổi ngôn ngữ sau đó không viết lại lịch sử (xem thêm
  `docs/excel-report.md` mục 0).

**Luật bắt buộc khi sửa UI:** mọi thay đổi giao diện từ nay phải đi qua hệ
dịch này (không hardcode chuỗi) — luật đầy đủ nằm ở `AGENTS.md` mục
"MANDATORY RULE: UI text & i18n", được nạp tự động vào mọi phiên AI.

**Thêm ngôn ngữ mới (vd: Tiếng Pháp) — 4 bước, không cần thư viện:**
1. `src/i18n/types.ts`: thêm mã vào `Language`, `LANGUAGES`,
   `LANGUAGE_NAMES` (tên bản ngữ), `LOCALE_TAGS` (mã Intl, vd `fr-FR`).
2. Tạo `src/i18n/locales/fr.ts` — copy `en.ts`, giữ kiểu
   `: TranslationSchema`, dịch toàn bộ giá trị (tsc chặn build nếu thiếu key).
3. `src/i18n/translate.ts`: thêm locale mới vào `DICTIONARIES`.
4. Xong — nút chọn ở Cài đặt render tự động từ `LANGUAGES`.
Quy trình chi tiết: skill `.ai/skills/add-language.md`.

## 🎨 Giao diện Sáng/Tối (Light/Dark Theme — Session 2026-07-17)

Ứng dụng hỗ trợ chế độ **Sáng (Light)** và **Tối (Dark)** với khả năng chuyển đổi tức thì trong 
Cài đặt → mục GIAO DIỆN.

**Cơ chế:**
- Field `themeMode` ('light' | 'dark') trong Zustand `settingsStore` — giống hệt cách `language` đã làm.
- Không dùng React Context vì app theo quy ước không dùng Context; hook `useThemeColors()` / `useThemedStyles()` 
  trong `src/hooks/useThemeColors.ts` chỉ theo dõi field `themeMode` của store — đổi theme chỉ vẽ lại 
  component có gọi hook này, không vẽ lại toàn app.
- Hai palette màu `darkColors` / `lightColors` định nghĩa trong `src/lib/theme.ts`.
- Lựa chọn lưu tự động vào AsyncStorage qua middleware `persist`.

**Giới hạn v1:**
- Màu sắc là cố định (không tuning theo brand); nếu thêm màu tùy chỉnh sau, sửa trong `theme.ts`.
- Chế độ Tối (mặc định) giữ nguyên giao diện cũ; chế độ Sáng là bổ sung.

## 🔢 Parse số thập phân với dấu phẩy (src/lib/units.ts)

Bàn phím decimal-pad trên iPhone locale VI/DE sử dụng dấu phẩy (`,`) thay vì dấu chấm (`.`).
Hàm `parseDecimal()` trong `src/lib/units.ts` xử lý tự động: thay `,` thành `.` rồi gọi `parseFloat()`.

**Áp dụng:** tất cả ô nhập số thập phân trong app (cân nặng, chiều cao, khối lượng món ăn, gram, 
kcal thủ công, phút, bước, tạa/reps, form thêm món tùy chỉnh) phải dùng `parseDecimal()` để tránh 
mất dữ liệu sau dấu phẩy.

## 🗃️ Mô hình dữ liệu (Data Model)

Các "bảng" dữ liệu chính lưu trong SQLite. *Tên cột bằng tiếng Anh (theo luật code), mô tả bằng tiếng Việt.*

### `battery_types` — định nghĩa từng loại pin
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã định danh (vd: `protein`) |
| `name` | text | tên hiển thị |
| `unit` | text | đơn vị (g, ml, mg...) |
| `default_capacity` | number | sức chứa mặc định |
| `color` | text | màu hiển thị |
| `icon` | text | tên icon |
| `is_active` | boolean | đang bật hiển thị hay không |

### `daily_log` — mỗi ngày một bản ghi
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text (YYYY-MM-DD) | ngày |
| `mode_id` | text | Mode đang dùng hôm đó |

### `battery_readings` — mức pin theo ngày
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text | ngày |
| `battery_type_id` | text | loại pin |
| `level` | number | mức hiện tại |
| `capacity` | number | sức chứa hôm đó (tuỳ Mode) |

### `intake_events` — sự kiện nạp (ăn/uống)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã |
| `timestamp` | number | thời điểm |
| `battery_type_id` | text | nạp vào pin nào |
| `amount` | number | lượng nạp |
| `note` | text | ghi chú ngắn |

### `health_signals` — tín hiệu ngoài (giai đoạn sau)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `timestamp` | number | thời điểm |
| `source` | text | nguồn (watch, phone...) |
| `type` | text | steps / heart_rate / sleep / stress |
| `value` | number | giá trị |

### `food_log` — món ăn đã ghi trong ngày (Session 5+)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | text | mã |
| `timestamp` | number | thời điểm ghi |
| `meal_type` | text | bữa (sáng/trưa/tối/phụ) |
| `food_id` / `food_name_vi` | text | món nào (id trong danh sách món + tên tiếng Việt) |
| `grams` | number | lượng ăn (g) |
| `energy_kcal`, `protein_g`, `fat_g`, `carb_g`, `water_g`, `minerals_mg` | number | dinh dưỡng đã quy đổi theo lượng |

### `diary_entries` — nhật ký riêng tư (mã hoá, write-only)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` | text | ngày |
| `encrypted_content` | text | nội dung đã mã hoá — **app không tự giải mã để phân tích** |

### `training_log_days` / `training_log_weeks` — phần người dùng tự thêm vào Sổ tập luyện (Session 32)
| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `date` (days) / `week_start` (weeks) | text | ngày `YYYY-MM-DD` / Thứ 2 của tuần |
| `override_text` (days) | text, có thể NULL | dòng người dùng viết đè hoặc ghi tay; NULL = dùng dòng tự sinh |
| `note` | text, có thể NULL | ghi chú dưới ngày / ghi chú tuần |
| `source_signature` (days) | text, có thể NULL | dấu vân tay các buổi Xả lúc người dùng sửa; **NULL + có `override_text` = dòng ghi tay** |
| `updated_at` | number | thời điểm sửa |

Bản ghi rỗng (không dòng, không ghi chú) bị **xoá**, không lưu. Hai bảng này **không** nằm trong `cleanupService`.

---

## 🔁 Luồng dữ liệu chính (ví dụ: người dùng ăn 1 bữa)

```
Người dùng bấm "Nạp Protein 30g"
        │
        ▼
UI (màn hình Home) ──► store (energyStore.addIntake)
        │
        ▼
domain/battery (tính lại mức pin) ──► data/repositories (lưu intake_event + cập nhật reading)
        │
        ▼
domain/rules (kiểm tra: pin có sắp cạn không?)
        │
        ▼
services/notifications (nếu cần → lên lịch nhắc/cảnh báo)
        │
        ▼
UI cập nhật → viên pin Protein đầy lên
```

---

## ⏰ Tác vụ nền tự động

| Tác vụ | Khi nào chạy | Việc làm |
|--------|--------------|----------|
| **Daily reset** | Đầu mỗi ngày | Tạo pin ngày mới theo mục tiêu của Mode |
| **Depletion tick** | Định kỳ trong ngày | Giảm các pin nhỏ theo thời gian + Mode. ⚠️ S-M (2026-07-03): "Sổ calo" đếm LÊN, không tự xả. ♻️ S-O/S-P/S-Q (2026-07-04, đang làm): **Pin no/đói** (headline) TỤT DẦN lại theo nhịp sinh học (thức/ngủ), có sàn 15-20%; **Sổ calo** (dòng phụ) đếm lên, **reset 6h sáng** |
| **Low battery check** | Định kỳ | Nếu pin thấp → nhắc nhở |
| **Weekly export** | Mỗi tuần | Xuất Excel ra điện thoại |
| **Cleanup** | Sau export | Xoá dữ liệu cũ > 1 tuần khỏi app |

---

## 🔐 Nguyên tắc riêng tư

- Mặc định **mọi dữ liệu nằm trên máy**, không gửi đi đâu.
- Diary mã hoá, app không đọc lại để phân tích.
- Khi tích hợp Health: chỉ lấy khi người dùng đồng ý, và nêu rõ lấy gì.

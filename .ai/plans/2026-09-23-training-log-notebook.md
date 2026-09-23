# Kế hoạch: "Sổ tập luyện" — nhật ký bài tập kiểu Apple Notes trong tab Tập luyện (2026-09-23)

> **Trạng thái: ĐÃ LÀM W1–W7 + W9 (2026-09-23). W8 và W6b chủ ý bỏ (xem §9). CHƯA test máy thật, CHƯA commit.**
> Kế hoạch do Opus lập, Sonnet triển khai.
> Nhánh: `ui-upgrade`. Stack: Expo SDK 57 (không nâng/hạ). **Không thêm thư viện mới.**
> Mọi text UI mới đi qua `useT()` + 3 locale (vi → en → de), xem `AGENTS.md`.
> Sonnet PHẢI điền mục "§9 Nhật ký triển khai" ở cuối trong lúc làm.
> Bản 2 (cùng ngày): viết lại sau khi có ảnh chụp Notes thật của người dùng (§2).
> Bản 3 (cùng ngày), người dùng đã chốt 3 điểm:
> 1. Ký hiệu `6x4(+3)x75` = 6 set × 4 rep, **set cuối làm thêm 3 rep** → tự sinh (§4.3.3).
> 2. Hiển thị dùng **dấu chấm** thập phân, nhưng bàn phím số trên điện thoại (vi/de) **chỉ có
>    dấu phẩy** → mọi chỗ nhập phải chấp nhận cả `,` và `.` (§4.3.7).
> 3. Người dùng hay **quên Xả** vì bận → sổ phải cho **ghi tay một buổi** ngay trong sổ, độc
>    lập với Xả và pin (§4.4 "Tầng 0"). Pin là việc riêng, sổ chỉ lo ghi chép.

---

## 1. Phản ánh của người dùng

> Mỗi ngày tôi nhập bài tập vào ô **Xả**. Tôi muốn nó **tự động được ghi lại thành một
> cuốn nhật ký**, giống file Notes trên iPhone, để mở ra xem hôm trước / tuần trước tập
> thế nào. Luồng: nhập ở **Xả** → chuyển thành cách viết giống Notes của tôi → hiển thị ở
> tab **Tập luyện** như một cuốn sổ. Vì sẽ rất dài nên: **bấm vào block → hiện các tuần,
> bấm vào tuần → hiện hết**. Quan trọng: **người dùng sửa được** nếu máy chuyển sai hoặc
> chưa đúng ý.

---

## 2. Phân tích file Notes thật (nguồn chuẩn cho định dạng)

### 2.1 Trích nguyên văn (ảnh chụp Apple Notes của người dùng)

```
12.07: D 120 5x4x100() + PS 110 4x5x85

DELOAD:
15.07: S 80 4x5x62.5 D 95 4x5x75
17.07:B 75 4x5x60 +iC 4x6x50
———-oneweekHOLIDAYS———-

Block2——————————————
W1:
26.07: D 100 5x5x80 PS 90 5x5x70
27.07: B 90 5x5x72.5 iC 5x5x62.5
29.07: S 110 5x5x85 PD 120 5x6x85
31.07: B 95 5x5x77.5 LG 5x6x65
02.08: D 132.5 5x5x105 PS 110 5x5x80
Cảm giác quá tải thần kinh, có lẽ bởi khối bài tập PS cuối

W2:
03.08. B 90 5x5x70 iC 5x5x60
05.08. S 115 5x5x90 PD  100 4x3x80
...
W3:
14.08: B 90 (95 ❌)5x5x75 Lg 5x6x65
16.08: D 140 (rpe9.2) 6x4x110 pS 5x4x80

W4: 77.5kg
17.08: B 95 6x4(+3)x75 iC 4x6x60
19.08: S 120 110x(4+5+5+4+8)
PD 130 5x4x95
...
W5: 77.0kg
26.08(77.7kg): S 130 4x3x115+3x100
PD 130kg 4x3x100(+8)
28.08 : B 8x20+6x60+3x80 + 90+ 97.5 +1̶0̶2̶.̶5̶❌+ 100 (4x2+5)x90 - LG 3x6x70
30.08:warmU deadlift 6x60-3x100-125-142-150-155 (test)
122.5 x (2+2+2+5+6)
```

### 2.2 Ngữ pháp rút ra (bắt buộc bám theo)

| Thành phần | Cách người dùng viết | Ghi chú |
|---|---|---|
| Tiêu đề block | `Block2` (đậm, gạch chân) | Đánh số block |
| Tiêu đề tuần | `W1:` … `W5: 77.0kg`, `DELOAD:` | Có khi kèm **cân nặng** đầu tuần |
| Dòng ngày | `27.07: <bài> <bài> …` | Ngày dạng `DD.MM`, **không** có thứ. **Một dòng một ngày** |
| Cân nặng ngày | `26.08(77.7kg):` | Chỉ khi hôm đó có cân |
| Tên bài | `S` `B` `D` + biến thể `PS` `PD` `iC` `LG` `pS` `pD` | **Viết tắt**, không có "kg" |
| Top single | `B 90 …` | Set 1 rep chỉ ghi **mức tạ** |
| Set đều | `5x5x72.5` | **số set × số rep × mức tạ** (tạ đứng cuối) |
| Set 1 lần, nhiều rep | `+3x100`, `8x20` | **rep × tạ** |
| Set rep không đều | `110x(4+5+5+4+8)` | **tạ × (rep+rep+…)** |
| Nối các cụm | `4x3x115+3x100`, `8x20+6x60+3x80` | `+` không cách |
| Nối các bài trong ngày | khoảng trắng (đôi khi ` + `, ` - `) | Mặc định khoảng trắng |
| Số thập phân | `72.5`, `132.5` | **Dấu chấm** |
| Ghi chú cảm nhận | dòng chữ tự do ngay dưới ngày | Không có ký hiệu đầu dòng |
| Ngắt quãng | `———-oneweekHOLIDAYS———-` | Tuần nghỉ |

| Set cuối làm thêm rep | `6x4(+3)x75` | **n × r (+thêm) × tạ**: các set đều r rep, set cuối r+thêm |

**Những thứ người dùng ghi mà app KHÔNG có dữ liệu cấu trúc** (không tự sinh được, người
dùng tự thêm bằng cách sửa dòng, §4.4): lần nâng hỏng `(95 ❌)`, gạch ngang `1̶0̶2̶.̶5̶`,
RPE `(rpe9.2)`, `(test)`, `()` trống, in đậm/gạch chân mốc PR.

### 2.3 Hệ quả thiết kế (khác bản 1)

1. Ký hiệu set là `n x r x w` (không phải `5x5@95` như file Excel). Dấu chấm thập phân.
2. **Tên viết tắt là bắt buộc** để giống sổ: cần bảng viết tắt, sửa được.
3. **Biến thể bài (PS/PD/iC/LG) là một nửa nội dung sổ**, nhưng app hiện **không ghi biến
   thể**. `PowerliftingSheet` chỉ có 1 ô cho mỗi lift, nên *không thể* ghi `B` + `iC`
   (cùng họ bench) trong một lần lưu. → Phải thêm **ghi biến thể khi Xả** (W2). Thiếu nó,
   sổ sẽ ghi `S` thay vì `PS`, và không có cách nhập ngày bench + incline.
4. Hiển thị phải **dày như Notes**: mỗi ngày một dòng chữ liền, không làm card to.
5. Tiêu đề tuần cần hiện được **cân nặng** (đã có dữ liệu cân trong `health_signals`).
6. Sửa tay là việc thường xuyên (❌, RPE, test), không phải ngoại lệ → sửa dòng phải
   nhanh (1 chạm), và **giữ được chữ đã sửa** khi dữ liệu gốc đổi (có cảnh báo).
7. Sổ **không chỉ là bản sao của Xả**: phải ghi được buổi chưa từng Xả (quên, bận, tập ở
   nơi khác), cho ngày bất kỳ trong quá khứ, **không** tính pin/kcal.

**Tên gọi**: tab "Nhật ký" (`nav.diary`) đã có (nhật ký cảm xúc, mã hoá). Tính năng mới tên
**"Sổ tập luyện"** / "Training log" / "Trainingstagebuch", namespace i18n `trainingLog`.

---

## 3. Hiện trạng code (đã rà, tại commit `8b4d1d2`)

- **Nguồn dữ liệu**: mỗi lần Xả lưu một dòng `activity_log`
  (`src/data/repositories/activityLogRepository.ts`, `ActivityLogEntry` trong
  `src/types/energy.ts`). `workouts` là JSON `WorkoutSession[]`, nên thêm trường tuỳ chọn
  **không cần migration**:
  - Powerlifting: `type` ∈ squat/bench_press/deadlift, `sets: LiftingSet[]`
    (`kind: 'warmup'|'working'`, `weightKg`, `reps`).
  - Bodybuilding: nhận diện bằng `bbMet != null` (**không** bằng `sets`), tên qua
    `bbExerciseName`.
  - Còn lại: `type` + `minutes` (+ `customName`).
- `totalWorkoutKcal` (`metabolismEngine.ts`) cộng từng session, nên nhiều session cùng
  `type` trong một entry (vd. squat + pause squat) **không** làm sai kcal.
- **Ngày của buổi**: repository nhóm theo `COALESCE(start_at, timestamp)` theo ngày lịch.
  Sổ tập dùng đúng quy tắc này, khớp màn Lịch sử.
- `runWeeklyCleanup` **không** xoá `activity_log`. Bảng mới của sổ cũng không được thêm vào.
- **Block**: `training_blocks`, `listTrainingBlocks()`. `config`/`weeks` là JSON, nên thêm
  `config.name?` không cần migration. `weeks[i]` có `startDate/endDate` (T2→CN),
  `weekNumber`, `isDeload`. Tạo block mới chỉ `is_active = 0` block cũ, không xoá.
- **Biến thể có sẵn**: `src/lib/powerliftingVariations.ts` (10 id: `squat_paused`,
  `deadlift_paused`, `bench_low_grip`, `bench_incline`, `bench_paused`, `deadlift_deficit`,
  `*_standard`, `bench_touch_and_go`). Nhãn ở `blockVariations.<id>.label`. Dùng ngay cho
  PS / PD / LG / iC.
- **`PowerliftingSheet`**: state `AllRows = Record<LiftingExercise, {warmup, working}>`,
  tức **mỗi lift đúng 1 bộ set**. `confirm()` đẩy 1 `WorkoutSession` mỗi lift. Có chế độ sửa
  (`editingEntry` + `onSaveEdit`), "buổi trước" (`findPrevSession` theo `exercise`), gợi ý
  khởi động, nạp mẫu buổi trước.
- **Helper nhãn** nằm trong file component: `activityLabel` (`EnergyActionsBar.tsx`),
  `bbExerciseName` (`BodybuildingSheet.tsx`), `workoutLabel` / `isLiftingEntry` /
  `isBodybuildingEntry` (private, `TodayActivities.tsx`). Domain không được import từ
  components, nên phải dời (W1).
- **Cân nặng**: `health_signals` (`source='manual'`, `type='weight_kg'`),
  `getWeightHistory(limit)`. Chưa có truy vấn theo khoảng ngày.
- `CollapsibleSection` **chỉ mount children khi mở**, nên tải tuần lười được miễn phí.
  `BottomSheet` có sẵn ở `src/components/ui/`.
- **Sửa buổi cũ**: `updateActivity` chỉ cho buổi hôm nay. Ngày cũ có
  `removeActivityForPastDate` + `logActivityForPastDate`.
- **Xả bù ngày cũ bị giới hạn**: `BACKFILL_MAX_DAYS_BACK = 3` (`src/lib/constants.ts`), vì
  nó chạm pin của ngày đó. Sổ ghi tay **không** bị giới hạn này (không chạm pin).
- **Chọn ngày quá khứ**: `src/components/food/PastDateField.tsx` (`value`, `onChange`,
  `maxDaysBack`). Nhận gõ `dd/mm` (regex chỉ chấp nhận `/`). Tái dùng cho sổ.
- **Số thập phân khi nhập**: `parseDecimal` (`src/lib/units.ts`) đã đổi `,` → `.`.
  `PowerliftingSheet` dùng nó, nên nhập `72,5` ở Xả đã đúng. Phải giữ nguyên điều này ở mọi ô
  số mới.
- **Plan song song**: `.ai/plans/2026-09-23-battery-late-logging-timing.md` sửa
  `logActivity` / `logActivityForPastDate`. Plan này **không đụng logic pin**, chỉ gọi action.
  Làm W6 (sửa số liệu ngày cũ) **sau** plan pin, hoặc chạy lại test W6 khi plan pin xong.

---

## 4. Thiết kế

### 4.1 Nguyên tắc

1. **Hai nguồn dòng ngày, một cuốn sổ.**
   - **Dòng tự động**: sinh từ `activity_log` (đã Xả). Sổ **không lưu** chữ máy sinh. Chữ
     được sinh lại mỗi lần hiển thị, nên đổi ngôn ngữ / viết tắt / tuỳ chọn thì cả sổ cũ đổi
     theo.
   - **Dòng ghi tay**: người dùng tự ghi cho ngày chưa Xả. Chỉ là chữ, lưu trong bảng sổ,
     **không** tạo `activity_log`, **không** tính pin/kcal.
   Cả hai hiển thị y hệt nhau, chỉ khác một dấu hiệu nhỏ.
2. **Chỉ lưu phần người dùng can thiệp**: dòng ghi tay, dòng viết đè, ghi chú dưới ngày,
   ghi chú tuần, tên block.
3. **Sửa chữ ≠ sửa số liệu.** Sửa chữ không bao giờ đổi kcal/pin. Sửa số liệu = mở lại sheet
   Xả của buổi đó. UI ghi rõ 1 dòng giải thích.
4. **Không đụng engine pin / kcal.** Ghi biến thể (W2) chỉ thêm nhãn cho session, kcal vẫn
   tính theo tạ × rep thật như cũ.
5. **Kế hoạch ≠ thực tế** (quy ước S-PL): block chỉ dùng để *nhóm* (và W8 tuỳ chọn để *hiện
   kèm* kế hoạch). Sổ không ghi ngược vào kế hoạch.

### 4.2 Cấu trúc Block → Tuần → Ngày

**Ngày vào sổ**: ngày lịch có ≥ 1 `activity_log` với `workouts` khác rỗng, **hoặc** có dữ
liệu sổ riêng (dòng ghi tay / ghi chú, §4.5). Entry chỉ có bước chân **không** vào sổ.

**Gán ngày vào kỳ** — hàm thuần `buildTrainingLogIndex` (W3):
- Ngày `d` thuộc block B nếu `B.weeks[0].startDate ≤ d ≤ B.weeks[last].endDate`. Chồng nhau
  thì chọn `createdAt` lớn nhất.
- Ngoài mọi block → kỳ **"Tập tự do · <tháng/năm>"** (tháng của Thứ 2 đầu tuần, để một tuần
  không bị cắt đôi).
- **Số block**: thứ tự theo `createdAt` tăng dần trong các block còn tồn tại (1, 2, 3…).
  Tiêu đề = `config.name` nếu người dùng đã đặt, ngược lại `Block {{n}}`. Dòng phụ nhỏ:
  nhãn focus + khoảng ngày + số buổi.
- **Tuần trong block**: nhãn `W{{n}}` theo `weeks[i].weekNumber`, tuần deload hiện
  `DELOAD`. Hiện **mọi tuần của block đến tuần hiện tại, kể cả tuần trống** (hiện `—`) để
  người dùng ghi chú "nghỉ lễ" như dòng `oneweekHOLIDAYS`. Tuần tương lai của block: ẩn.
- **Tuần tự do**: nhãn khoảng ngày `07.09–13.09`, chỉ hiện tuần có nội dung.
- **Thứ tự**: kỳ mới nhất trên cùng. **Trong kỳ, tuần và ngày theo thứ tự thời gian tăng
  dần** (W1 → W5, 26.07 → 02.08), giống đọc sổ Notes. Mặc định **chỉ kỳ mới nhất mở** và
  **chỉ tuần mới nhất của kỳ đó mở**. Bấm block → hiện tuần, bấm tuần → hiện hết.
- **Hiệu năng**: chỉ mục gồm ngày có tập (truy vấn nhẹ) + ngày có dữ liệu sổ + block. Nội
  dung tuần chỉ tải khi mở.

### 4.3 Định dạng dòng ngày — `trainingLogFormatter` (thuần, domain)

#### 4.3.1 Dòng ngày

```
{{date}}{{weight?}}: {{movement}} {{movement}} …
```
- `{{date}}` qua key `trainingLog.format.dayDate`: vi/de `{{dd}}.{{mm}}`, en `{{mm}}/{{dd}}`.
  Tuỳ chọn `showWeekday` (mặc định tắt) thêm thứ ngắn (`weekdayLabel(..., 'short')`) phía
  trước.
- `{{weight?}}` = `(77.7kg)` **chỉ khi có cân nặng ghi trong chính ngày đó** và
  `showBodyWeight` bật (mặc định bật).
- Các **movement** nối bằng **một khoảng trắng** (kiểu ngắn) hoặc ` · ` (kiểu tên đầy đủ).
  Thứ tự: entry theo thời gian, rồi thứ tự trong `workouts`.
- Ghi chú ngày (§4.4) là **các dòng riêng ngay dưới**, chữ thường, không ký hiệu, giống
  "Cảm giác quá tải thần kinh…".

#### 4.3.2 Movement

`{{label}} {{sets}}`, trong đó:

| Loại session | label | sets |
|---|---|---|
| lift có `sets` | viết tắt (§4.3.4) của biến thể, không có thì của lift | chuỗi set §4.3.3 |
| lift cũ không `sets` | viết tắt lift | `{{n}}'` (phút, key i18n) |
| bodybuilding (`bbMet != null`) | viết tắt nếu người dùng đặt, ngược lại `bbExerciseName` | chuỗi set §4.3.3 |
| custom | `customName` (fallback `activities.custom`) | phút |
| còn lại | `activityLabel` | phút |

#### 4.3.3 Chuỗi set (thuật toán, lấy set `working` theo thứ tự đã nhập)

1. Gom các set **liên tiếp cùng `weightKg`** thành cụm (run). Không gộp cụm không liền nhau.
2. Mỗi cụm:
   - 1 set, 1 rep → `{w}` (top single: `90`)
   - 1 set, nhiều rep → `{r}x{w}` (`3x100`)
   - ≥ 2 set, rep đều → `{n}x{r}x{w}` (`5x5x72.5`)
   - ≥ 2 set, **mọi set bằng r rep, chỉ set cuối nhiều hơn** (r + d, d > 0) →
     `{n}x{r}(+{d})x{w}` (`6x4(+3)x75` = 5 set × 4 + set cuối 7). `n` đếm **cả** set cuối.
   - ≥ 2 set, rep không đều kiểu khác (kể cả set cuối *ít* hơn) → `{w}x({r1}+{r2}+…)`
     (`110x(4+5+5+4+8)`)
3. Nối cụm: mặc định `+`. **Ngoại lệ**: ngay sau một cụm top-single mà cụm kế tiếp *không*
   phải top-single thì dùng **khoảng trắng** (`130 4x3x115+3x100`,
   `90+97.5+100 90x(2+2+2+2+5)`).
4. `showWarmups` (mặc định tắt): set khởi động in trước, mỗi set `{r}x{w}` (hoặc `{w}` nếu
   1 rep), nối `+`, rồi khoảng trắng: `8x20+6x60+3x80 90 5x5x72.5`.
5. Chỉ có set khởi động → in chuỗi khởi động.
6. **Số**: theo tuỳ chọn `decimal` (§4.3.5): `'dot'` (mặc định, như Notes) → `72.5`;
   `'locale'` → `Intl.NumberFormat(LOCALE_TAGS[language], { maximumFractionDigits: 2, useGrouping: false })`.
   Luôn bỏ `.0`. `showUnit` (mặc định tắt) thêm `kg` sau mức tạ.

Ký hiệu `x`, `+`, `(`, `)` là ký hiệu chuyên môn nên viết thẳng trong formatter. Mọi *chữ*
(nhãn, "phút", viết tắt mặc định, định dạng ngày, "kg") phải qua `translate(language, …)`.

#### 4.3.4 Viết tắt

- Mặc định trong locale `trainingLog.abbr.*` (giống nhau ở cả 3 ngôn ngữ, vì đây là ký hiệu
  powerlifting quốc tế, nhưng vẫn nằm trong file locale):
  `squat S`, `bench_press B`, `deadlift D`, `squat_standard S`, `bench_touch_and_go B`,
  `deadlift_standard D`, `squat_paused PS`, `deadlift_paused PD`, `bench_paused PB`,
  `bench_low_grip LG`, `bench_incline iC`, `deadlift_deficit DD`.
- **Người dùng đè được**: `settingsStore.trainingLogFormat.abbreviations: Record<string, string>`,
  key `lift:<exercise>` / `var:<variationId>` / `cvar:<tên biến thể tự đặt>` /
  `bb:<bbExerciseId>`. Chuỗi rỗng = xoá đè, quay về mặc định.
- `labelStyle: 'short' | 'full'` (mặc định `'short'`). `'full'` dùng tên đầy đủ
  (`activities.*` / `blockVariations.<id>.label`).
- Biến thể tự đặt tên (`variationName`, W2) không có viết tắt mặc định → hiện nguyên tên cho
  tới khi người dùng đặt viết tắt.

#### 4.3.5 Tuỳ chọn định dạng (`settingsStore`, có `persist`)

```ts
// src/types/trainingLog.ts
export interface TrainingLogFormat {
  labelStyle: 'short' | 'full';        // 'short'
  decimal: 'dot' | 'locale';           // 'dot' — đúng Notes của người dùng
  showWarmups: boolean;                // false
  showUnit: boolean;                   // false
  showBodyWeight: boolean;             // true
  showWeekday: boolean;                // false
  showKcal: boolean;                   // false — nếu bật: " · {{kcal}} kcal" cuối dòng ngày (tổng energyKcal các entry)
  abbreviations: Record<string, string>; // {}
}
export const DEFAULT_TRAINING_LOG_FORMAT: TrainingLogFormat = { … };
```
Đọc luôn qua `{ ...DEFAULT_TRAINING_LOG_FORMAT, ...stored }`, vì `persist` không có
`version/migrate`. `decimal: 'dot'` là **lựa chọn của người dùng**, không phải hardcode
locale: giá trị mặc định nằm trong hằng số, formatter không tự chọn.

#### 4.3.6 Bảng test vàng (lấy từ chính sổ của người dùng)

| Input (working sets, lift/biến thể) | Kỳ vọng |
|---|---|
| deadlift: 120×1, 100×4 ×5 | `D 120 5x4x100` |
| bench: 90×1, 72.5×5 ×5 | `B 90 5x5x72.5` |
| bench_incline: 62.5×5 ×5 | `iC 5x5x62.5` |
| squat: 110×1, 85×5 ×5 + deadlift_paused 85×6 ×5 (không top single) | `S 110 5x5x85 PD 5x6x85` |
| squat: 120×1, 110×4,5,5,4,8 | `S 120 110x(4+5+5+4+8)` |
| squat: 130×1, 115×3 ×4, 100×3 | `S 130 4x3x115+3x100` |
| deadlift: 140×1, 110×4 ×6 | `D 140 6x4x110` |
| bench: 95×1, 75×4,4,4,4,4,7 | `B 95 6x4(+3)x75` |
| bench: 90×1, 97.5×1, 100×1, 90×2,2,2,2,5 | `B 90+97.5+100 5x2(+3)x90` |
| cùng bench + warmups 20×8, 60×6, 80×3, `showWarmups` | `B 8x20+6x60+3x80 90+97.5+100 5x2(+3)x90` |
| 80×5,5,5,5,3 (set cuối ít hơn) | `80x(5+5+5+5+3)` |
| 100×5,8 (2 set) | `2x5(+3)x100` |
| 112.5×3 ×4, `decimal:'locale'`, vi / en | `4x3x112,5` / `4x3x112.5` |
| 100×5, 105×3, 100×5 (không liền nhau thì không gộp) | `5x100+3x105+5x100` |
| dòng ngày 26.08 có cân 77.7 | `26.08(77.7kg): S 130 4x3x115+3x100` |

(Lưu ý: PD 120 trong sổ gốc là top single của PD. Test hàng 4 cố tình không có top single để
kiểm tra nhánh.)

#### 4.3.7 Dấu phẩy khi nhập (điện thoại chỉ có `,`)

Bàn phím `decimal-pad` của iPhone theo vùng vi/de **chỉ có dấu phẩy**. Hiển thị vẫn là dấu
chấm (người dùng chốt). Quy tắc:
- **Mọi ô số** mới hoặc sửa (tạ, cân nặng) phải parse bằng `parseDecimal` (chấp nhận `72,5`
  và `72.5`). Không dùng `parseFloat` / `Number()` trực tiếp. Không đổi `keyboardType` để
  "ép" dấu chấm.
- **Ô chữ tự do của sổ** (dòng ghi tay, dòng viết đè): người dùng gõ `72,5` theo thói quen
  bàn phím. Khi **lưu**, nếu `format.decimal === 'dot'` thì chuẩn hoá bằng hàm thuần
  `normalizeDecimalCommas(text)`: chỉ đổi dấu phẩy **nằm giữa hai chữ số**
  (`/(\d),(\d)/g → '$1.$2'`). Không đổi dấu phẩy khác (`B 90, rồi…`). Áp **chỉ cho dòng
  tập**, **không** áp cho ghi chú cảm nhận (câu văn có thể có "3,4 lần").
  `decimal === 'locale'` thì giữ nguyên chữ người dùng gõ.
- Test: `72,5` → `72.5`. `5x5x72,5+3x100` → `5x5x72.5+3x100`. `B 90, S 100` giữ nguyên.
  Giới hạn đã biết: `1,2,3` → `1.2,3` (regex ăn cặp đầu rồi bỏ qua). Chấp nhận vì chuỗi
  `số,số,số` không có trong ký hiệu tập (rep nối bằng `+`). Ghi rõ trong comment hàm và có
  test khoá hành vi này.
- `PastDateField`: mở rộng regex nhận cả `dd.mm` (người dùng viết ngày kiểu `12.07`) ngoài
  `dd/mm`. Thay đổi nhỏ, có lợi cho mọi chỗ đang dùng. Thêm test nếu component có test,
  hoặc tách `parseDdMmInput` ra lib để test.

### 4.4 Ghi và sửa sổ — 3 tầng, thao tác nhanh

**Tầng 0: ghi tay buổi quên Xả (chỉ sổ, không đổi pin)** — nhu cầu chính người dùng nêu.
- Nút **"＋ Ghi buổi"** ở đầu Sổ tập, và nút **＋** nhỏ ở cuối mỗi tuần đang mở (ngày gợi ý =
  ngày sớm nhất trong tuần chưa có dòng và ≤ hôm nay).
- Mở `TrainingLogLineEditor` ở chế độ **thêm**:
  - Chọn ngày bằng `PastDateField`, `maxDaysBack = TRAINING_LOG_MAX_DAYS_BACK` (hằng số
    mới, **730** ngày), **không** dùng `BACKFILL_MAX_DAYS_BACK`. Ngày tương lai bị chặn
    (sẵn trong `PastDateField`).
  - Ô **dòng tập** nhiều dòng, gõ tự do đúng kiểu Notes (`S 120 5x4x100 PD 4x3x80`).
    Placeholder là một ví dụ ngắn qua `t()`.
  - Nút **"Chép buổi gần nhất"**: điền sẵn phần thân dòng của ngày gần nhất *trước* ngày
    đang chọn có nội dung (tự động hoặc ghi tay). Người dùng chỉ sửa số. Tiết kiệm gõ.
  - Ô **ghi chú dưới ngày**.
- Nếu ngày được chọn **đã có nội dung** → chuyển sang chế độ sửa của ngày đó (không tạo
  trùng).
- Lưu = `training_log_days` với `override_text` = thân dòng (đã `normalizeDecimalCommas`),
  `source_signature = NULL`. **NULL chính là dấu hiệu "dòng ghi tay"** (chưa từng gắn với
  buổi Xả nào).
- Hiển thị giống hệt dòng tự động. Dấu hiệu nhỏ phân biệt: `✍` = ghi tay, `✎` = sửa tay dòng
  tự động. Dấu mờ, ở cuối dòng.
- Dòng ghi tay **không** tính pin/kcal và **không** hiện kcal kể cả khi `showKcal` bật.
  Trong editor có 1 dòng chú thích: "Dòng ghi tay chỉ lưu trong sổ, không tính vào pin
  năng lượng."
- (Tuỳ chọn, W6b) Nút phụ **"Nhập chi tiết set (tính cả pin)"**, chỉ hiện khi ngày chọn nằm
  trong `BACKFILL_MAX_DAYS_BACK`: mở `PowerliftingSheet` với prop mới `logDate` → `confirm()`
  gọi `logActivityForPastDate` (timestamp = trưa ngày đó, như `EnergyActionsBar`) thay vì
  `logActivity`. Ngoài 3 ngày → không hiện nút (pin là việc riêng).

**Tầng A: sửa chữ (chỉ sổ, không đổi pin)** — chạm vào **một dòng ngày** → cùng
`TrainingLogLineEditor` ở chế độ sửa:
- Ô 1 dòng/nhiều dòng **điền sẵn phần sau dấu `:`** của dòng hiện tại. Người dùng thêm
  `(95 ❌)`, `(rpe9.2)`, `(+3)`, đổi tên bài… rồi **Lưu** → `override_text`. Phần ngày +
  cân nặng trước dấu `:` luôn do máy sinh.
- Ô **"Ghi chú dưới ngày"** (nhiều dòng) → `note`. Hiện thành dòng chữ thường ngay dưới.
- **"Khôi phục dòng tự động"** (có `Alert` xác nhận) → xoá `override_text`.
- Dòng đã sửa tay có dấu hiệu kín đáo (chấm nhỏ ✎ màu mờ ở cuối dòng). Không làm to.
- **Phát hiện lệch**: sửa tay dòng tự động thì lưu kèm `source_signature` =
  `trainingDaySignature(entries)` (hash djb2 base36 của chuỗi đã sắp xếp
  `id|timestamp|startAt|JSON(workouts)`). Hàm `detectDayConflict({ record, entries })`
  (thuần) trả một trong:
  - `none`: không có override, hoặc chữ ký khớp.
  - `sourceChanged`: override có chữ ký, entries hiện tại có chữ ký khác (Xả thêm / sửa /
    xoá buổi của ngày đó). Banner: "Buổi tập ngày này đã đổi sau khi bạn sửa tay".
  - `xaAddedToManual`: dòng **ghi tay** (chữ ký NULL) nhưng giờ ngày đó **có entry Xả**
    (người dùng Xả bù sau). Banner: "Ngày này vừa có buổi ghi từ Xả".
  - `sourceGone`: override có chữ ký nhưng không còn entry nào. Chú thích "Không còn buổi tập
    nào trong mục Xả cho ngày này", **không** coi là lỗi. Dòng vẫn hiện như dòng ghi tay.
  Banner có 3 nút: **[Dùng dòng tự động]** (xoá override) · **[Giữ dòng của tôi]** (cập
  nhật chữ ký) · **[Gộp]** (override = dòng của tôi + `' '` + thân dòng tự động, rồi cập nhật
  chữ ký). Trong editor hiện "Bản tự động hiện tại: …" để chép phần mới. **Không bao giờ tự
  ghi đè chữ người dùng.**
- Nút **"Xoá dòng này khỏi sổ"** (Alert xác nhận): xoá bản ghi sổ của ngày. Ngày có entry Xả
  thì dòng tự động hiện lại (không xoá buổi Xả, muốn xoá buổi Xả phải vào Lịch sử / Home).

**Chạm tiêu đề tuần** → sửa **ghi chú tuần** (vd. "oneweekHOLIDAYS", "ngủ ít, giảm tạ").
Hiện ngay dưới tiêu đề tuần khi mở.
**Giữ lâu tiêu đề block** → đổi tên block (`config.name`, W4) hoặc xoá tên để về
`Block {{n}}`.

**Tầng B: sửa số liệu (có tính lại pin)** — trong `TrainingLogLineEditor`, liệt kê entry của
ngày. Entry lift / bodybuilding có nút **"Sửa số liệu"** → mở `PowerliftingSheet` /
`BodybuildingSheet` chế độ sửa (`editingEntry`, `key={entry.id}`). `onSaveEdit` →
`energyStore.updateActivityForPastDate(entry, { workouts })`.
- Kiểm tra `isBodybuildingEntry` **trước** `isLiftingEntry` (bẫy đã biết).
- Entry chỉ có phút **không** có nút này. Form phút của `TodayActivities` dùng
  `parseTimeHHmmToday`, sai với ngày cũ. Chú thích chỉ sang màn Lịch sử.

### 4.5 Lưu trữ (SQLite, 2 bảng mới, `CREATE TABLE IF NOT EXISTS`)

```sql
CREATE TABLE IF NOT EXISTS training_log_days (
  date TEXT PRIMARY KEY,          -- YYYY-MM-DD, ngày lịch (cùng quy tắc activity_log)
  override_text TEXT,             -- NULL = dùng dòng máy sinh; có giá trị = dòng ghi tay / viết đè
  note TEXT,                      -- ghi chú dưới ngày
  source_signature TEXT,          -- chữ ký entries lúc lưu override_text; NULL + override = dòng GHI TAY
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_log_weeks (
  week_start TEXT PRIMARY KEY,    -- Thứ 2 YYYY-MM-DD
  note TEXT,
  updated_at INTEGER NOT NULL
);
```
- Hai trường rỗng hết → **xoá dòng**. Không mã hoá. **Không** đưa vào `cleanupService`.
  `database.web.ts` là stub, để nguyên.
- Tên block: `config.name?: string` trong JSON `training_blocks.config`, nên không cần
  migration.

### 4.6 Giao diện — "trang Notes", không phải danh sách card

`TrainingScreen` có thanh 2 chế độ: **📓 Sổ tập** (mặc định) | **📋 Kế hoạch block**
(màn hình cũ, giữ nguyên hành vi). Bên phải có nút ⚙︎ (định dạng) và 📄 (xem/chia sẻ trang).

```
┌ Tập luyện ─────────────────────────────────┐
│ [📓 Sổ tập] [📋 Kế hoạch block]     ⚙︎  📄 │
│ [＋ Ghi buổi]                               │  ← ghi tay buổi quên Xả
│                                             │
│ ▾ Block 2                                   │  ← đậm, gạch chân như Notes
│   Tích luỹ · 26.07–31.08 · 18 buổi          │  ← dòng phụ mờ
│   › W1                                      │
│   › W2                                      │
│   › W3                                      │
│   › W4: 77.5kg                              │
│   ▾ W5: 77.0kg                              │  ← tuần mới nhất: mở
│     24.08: B 95 5x3x82.5 iC 4x6x65          │  ← chữ liền, cỡ 15,
│     26.08(77.7kg): S 130 4x3x115+3x100      │    lineHeight ~22,
│       PD 4x3x100                         ✎  │    selectable, xuống
│     28.08: B 90+97.5+100 5x2(+3)x90 …       │    dòng tự nhiên
│     Cảm giác nặng, ngủ ít                   │  ← ghi chú ngày (mờ)
│     30.08: D 6x60+3x100+125+155 (test)   ✍  │  ← dòng ghi tay (quên Xả)
│     ＋                                      │  ← ghi tay thêm ngày trong tuần
│ › Tập tự do · Tháng 7/2026                  │
│ › Block 1                                   │
└─────────────────────────────────────────────┘
```
- Dòng ngày: một `Text` (`selectable`), phần ngày đậm, phần còn lại thường, **tự xuống
  dòng** nếu dài (không cắt). Chạm → `TrainingLogLineEditor`.
- Tiêu đề tuần: `W5: 77.0kg` (cân = **lần cân đầu tiên trong tuần**, nếu `showBodyWeight`).
  Tuần deload: `DELOAD`. Tuần trống: dòng mờ `—`.
- Không card, không viền dày. Nền trang như tờ giấy (`c.bgCard`), padding thoải mái.
- **📄 Trang** (W7): mở `TrainingLogPageSheet` hiện **cả kỳ đang mở** thành một khối chữ duy
  nhất (dựng bằng `buildPeriodText`, thuần), `selectable`, cùng nút **Chia sẻ**
  (`Share.share({ message })` của React Native, có sẵn) để dán thẳng sang Apple Notes.
- Trống hoàn toàn → "Chưa có buổi tập nào. Bấm 🔥 Xả ở màn Pin hôm nay để ghi buổi đầu
  tiên, nó sẽ tự xuất hiện ở đây."
- Quy tắc lint (`react-hooks/purity`, `set-state-in-effect`): không gọi `Date.now()` /
  `todayString()` trong render (dùng wrapper cấp module như
  `EnergyActionsBar.getTodayString`). Tải dữ liệu bằng promise + cờ `cancelled` như
  `PowerliftingSheet`.

### 4.7 Ghi biến thể khi Xả (`PowerliftingSheet`)

- `WorkoutSession` thêm (JSON, không migration):
  `variationId?: string` (id trong `POWERLIFTING_VARIATIONS`, chỉ cho lift) và
  `variationName?: string` (biến thể tự đặt tên, cùng quy ước `customName`). Không có cả hai
  = bài chuẩn (thi đấu). Entry cũ vẫn đúng.
- State của sheet đổi từ `Record<LiftingExercise, ExerciseRows>` sang **danh sách
  movement**: `{ key, exercise, variationId?, variationName?, warmup, working }[]`.
  - Tab S/B/D giữ nguyên. Mỗi tab hiện các movement của lift đó (mặc định 1 movement chuẩn).
  - Mỗi movement có hàng chip biến thể ở trên: `Chuẩn` + các biến thể của lift đó
    (`variationsForExercise`) + `Tự đặt tên…` (TextInput).
  - Nút **"+ Thêm biến thể"** thêm movement thứ hai cùng lift (vd. B + iC), có nút xoá
    movement.
  - `confirm()`: mỗi movement có set → 1 `WorkoutSession { type: exercise, minutes, sets, variationId?, variationName? }`.
  - `rowsFromEntry`: mỗi workout có `sets` (và `bbMet == null`) → 1 movement.
  - "Buổi trước" / "Nạp mẫu buổi trước" / "Gợi ý khởi động": **theo từng movement**. Tìm
    buổi trước khớp `exercise` + `variationId` (+ `variationName`). Không có thì fallback
    theo `exercise` của bài chuẩn.
  - Tính kcal **không đổi** (`liftingSessionKcal(exercise, sets, …)` mỗi session).
- Nhãn biến thể ở nơi khác (nhỏ, cùng đợt): helper `liftingMovementLabel(session, language)`
  (tên đầy đủ biến thể, ngược lại `activityLabel`) dùng trong `TodayActivities.workoutLabel`,
  `BatterySourceSheet`, và mô tả buổi tập ở `excelSheets.ts` (nếu có cột mô tả).

---

## 5. Các đợt triển khai (tuần tự, `npm run verify` xanh sau MỖI đợt)

### W1: Dời helper nhãn + formatter thuần

- Tạo `src/lib/activityLabels.ts`: dời `activityLabel`, `bbExerciseName`, `workoutLabel`,
  `isLiftingEntry`, `isBodybuildingEntry`. Thêm `liftingMovementLabel`. **Cập nhật mọi
  import** (grep). Không để re-export thừa.
- `src/types/energy.ts`: thêm `variationId?`, `variationName?` vào `WorkoutSession` (có
  comment như các trường S-BB).
- `src/types/trainingLog.ts`: `TrainingLogFormat`, `DEFAULT_TRAINING_LOG_FORMAT`,
  `TrainingLogDayRecord`, `TrainingLogWeekRecord`.
- `src/domain/training/trainingLogFormatter.ts`:
  `formatSetSequence(sets, format, language)`, `formatMovement(session, format, language)`,
  `formatDayLine({ date, entries, bodyWeightKg?, format, language }) → { prefix, body }`
  (tách `prefix` = ngày+cân và `body` để override chỉ thay `body`),
  `resolveAbbreviation(key, format, language)`, `trainingDaySignature(entries)`,
  `detectDayConflict({ record, entries })` (§4.4), `normalizeDecimalCommas(text)` (§4.3.7).
  Chỉ nhận `language` làm tham số, **không đọc store**.
- Test `src/domain/training/__tests__/trainingLogFormatter.test.ts`: **toàn bộ bảng §4.3.6**,
  `labelStyle: 'full'`, viết tắt người dùng đè (`var:bench_incline → "IC"`), bodybuilding
  (nhận diện bằng `bbMet`), lift cũ không `sets`, custom, chữ ký ổn định khi đổi thứ tự đầu
  vào và đổi khi sửa 1 rep. Đủ 4 nhánh của `detectDayConflict`. Các ca của
  `normalizeDecimalCommas` ở §4.3.7.
- i18n (vi → en → de): `trainingLog.format.dayDate`, `trainingLog.format.minutes`,
  `trainingLog.format.weightSuffix` (`({{kg}}kg)`), `trainingLog.format.kcalSuffix`,
  `trainingLog.abbr.*` (§4.3.4).

### W2: Ghi biến thể khi Xả (§4.7)

Đặt sớm để dữ liệu người dùng nhập **trong lúc các đợt sau đang làm** đã có biến thể.
- Refactor `PowerliftingSheet` sang danh sách movement. Giữ nguyên mọi tính năng cũ (sửa,
  buổi trước, nạp mẫu, gợi ý khởi động, xem trước kcal/phút, e1RM).
- Áp `liftingMovementLabel` vào `TodayActivities` / `BatterySourceSheet` / Excel.
- i18n: `components.powerliftingSheet.variationStandard`, `.addVariation`,
  `.removeMovement`, `.customVariationPlaceholder`, `.customVariationChip`.
- Test: tách phần thuần của sheet (`movementsFromEntry`, `movementsToWorkouts`,
  `findPrevSessionForMovement`) ra `src/domain/energy/liftingMovements.ts` và test ở đó:
  round-trip entry → movements → workouts giữ nguyên set; B + iC cùng lúc ra 2 session; entry
  cũ không `variationId` → movement chuẩn; buổi trước khớp đúng biến thể.

### W3: Nhóm Block → Tuần → Ngày (thuần)

- `src/domain/training/trainingLogIndex.ts`:
  ```ts
  buildTrainingLogIndex(input: {
    trainingDays: { date: string; sessions: number }[];
    logDates: string[];               // ngày có dữ liệu sổ
    weekNoteStarts: string[];         // tuần có ghi chú
    blocks: GeneratedBlockPlan[];
    today: string;                    // truyền vào, không tự gọi todayString()
  }): TrainingLogPeriod[]
  // TrainingLogPeriod = { key, kind: 'block'|'free', blockId?, blockNumber?, blockName?,
  //   focus?, monthKey?, startDate, endDate, sessions, weeks: TrainingLogWeek[] }  // kỳ mới nhất trước
  // TrainingLogWeek = { weekStart, weekEnd, weekNumber?, isDeload?, sessions, dates: string[] } // tăng dần
  ```
  Chỉ trả dữ liệu. Nhãn do UI dựng bằng `t()`.
- Test: trong / ngoài block, block chồng nhau, số block theo `createdAt`, tuần trống trong
  block đến `today` được giữ và tuần tương lai bị ẩn, tuần vắt 2 tháng, deload, block bị xoá
  → rơi về tự do, thứ tự (kỳ giảm dần, tuần/ngày tăng dần), ngày chỉ có ghi chú.

### W4: Dữ liệu (schema + repository + store)

- `schema.ts`: 2 bảng §4.5 + `ALL_SCHEMAS`.
- `activityLogRepository.getTrainingDayCounts()`:
  `SELECT COALESCE(start_at, timestamp) AS t FROM activity_log WHERE workouts != '[]'`, gom
  theo `dateString(new Date(t))` **trong JS** (không dùng `date(..., 'localtime')`).
- `healthSignalsRepository.getWeightsInRange(fromDate, toDate)` (thủ công, tăng dần).
- `src/data/repositories/trainingLogRepository.ts`: `getTrainingLogDaysInRange`,
  `upsertTrainingLogDay` (tự xoá khi rỗng), `deleteTrainingLogDay`, `listTrainingLogDates`,
  `getTrainingLogWeeksInRange`, `upsertTrainingLogWeek`, `listTrainingLogWeekStarts`. Test
  theo mẫu mock `getDb` ở `src/data/repositories/__tests__`.
- `blockStore.renameBlock(id, name)` → `updateTrainingBlock` (đã có). `TrainingBlockConfig.name?`.
- `src/store/trainingLogStore.ts` (zustand, **không persist**): `periods`, `revision`,
  `loadIndex()`, `saveManualDay(date, body, note)` (chữ ký NULL),
  `saveDayOverride(date, body, signature)`, `clearDayOverride`,
  `acceptCurrentSignature(date, signature)`, `mergeAutoIntoOverride(date, autoBody, signature)`,
  `saveDayNote`, `deleteDay`, `saveWeekNote`, `findPreviousDayBody(beforeDate)` (cho "Chép
  buổi gần nhất"). Mọi ghi đều tăng `revision`. `Date.now()` chỉ trong action.
- `src/lib/constants.ts`: `TRAINING_LOG_MAX_DAYS_BACK = 730`.
- `PastDateField`: nhận thêm `dd.mm` (§4.3.7).
- `settingsStore.trainingLogFormat` + `setTrainingLogFormat(patch)` +
  `setTrainingLogAbbreviation(key, value)`.

### W5: UI đọc (trang Notes)

- Dời phần Block Builder của `TrainingScreen` sang
  `src/components/training/BlockPlanView.tsx` (**chỉ dời**).
- `TrainingScreen`: thanh 2 chế độ + ⚙︎ + 📄. `useFocusEffect` → `loadIndex()`.
- `src/components/training/TrainingLogView.tsx` → `TrainingLogPeriodSection` (tiêu đề
  block kiểu Notes + dòng phụ) → `TrainingLogWeekSection` (dùng `CollapsibleSection`, hoặc
  thêm prop `titleStyle`/`rightSlot` tối thiểu nếu cần hiện `W4: 77.5kg` đúng kiểu. Không phá
  chỗ dùng cũ).
- `TrainingLogWeekSection`: khi mount / `revision` đổi → tải `getActivityLogInRange` +
  `getTrainingLogDaysInRange` + `getTrainingLogWeeksInRange` + `getWeightsInRange` cho tuần.
  Render `TrainingLogDayLine`.
- `TrainingLogDayLine`: `prefix` đậm + (`override_text` ?? `body`) + ✎ nếu sửa tay + ghi chú
  + banner lệch.
- Toàn bộ chữ qua `t()`: `trainingLog.tabLog`, `.tabPlan`, `.blockTitle` (`Block {{n}}`),
  `.blockSubtitle`, `.freePeriodTitle`, `.weekLabel` (`W{{n}}`), `.deloadLabel` (`DELOAD`),
  `.emptyWeek`, `.emptyState`, `.sessionsCount`… Tháng dùng
  `toLocaleDateString(LOCALE_TAGS[language], { month: 'long', year: 'numeric' })`.

### W6: Sửa (Tầng A + B) + ⚙︎ định dạng

- `TrainingLogLineEditor.tsx`, 2 chế độ **thêm** (Tầng 0) / **sửa** (Tầng A + B), đủ §4.4:
  chọn ngày, dòng tập, "Chép buổi gần nhất", ghi chú, banner xung đột 3 nút, xoá dòng.
  Nút "＋ Ghi buổi" ở đầu và ＋ cuối tuần. `TrainingLogWeekNoteEditor` (sheet nhỏ). Đổi tên
  block (giữ lâu tiêu đề → `Alert.prompt` **không** dùng được trên Android, nên làm sheet nhỏ
  với `TextInput`).
- **W6b (tuỳ chọn)**: prop `logDate?: string` cho `PowerliftingSheet` + nút "Nhập chi tiết
  set (tính cả pin)" trong editor, chỉ khi ngày ≤ `BACKFILL_MAX_DAYS_BACK` (§4.4 Tầng 0).
  Nhánh hôm nay giữ nguyên `logActivity`.
- `energyStore.updateActivityForPastDate(entry, patch)`: `entry.id` có trong
  `get().activityLog` → `updateActivity`. Ngược lại → `removeActivityForPastDate(entry)` rồi
  `logActivityForPastDate({ steps: patch.steps ?? entry.steps, workouts: patch.workouts ?? entry.workouts, startAt: entry.startAt, endAt: entry.endAt }, entry.timestamp)`.
  **Chỉ ghép action có sẵn.** Test theo mẫu `energyStore.activityBackfill.test.ts`: nhánh
  hôm nay, nhánh ngày cũ, kcal ngày cũ sau sửa = như ghi mới.
- `TrainingLogFormatSheet.tsx` (⚙︎): các công tắc §4.3.5 + **bảng viết tắt** (một hàng cho
  mỗi lift + mỗi biến thể thư viện + mỗi `variationName` / bodybuilding đã xuất hiện trong
  90 ngày gần nhất, ô sửa ngắn). Có **dòng xem trước** dựng từ buổi mẫu cố định
  (`B 90+97.5+100 5x2(+3)x90 LG 3x6x70`), đổi tuỳ chọn thấy ngay.
- `Alert` xác nhận trước "Khôi phục dòng tự động" / "Xoá dữ liệu sổ của ngày". Chữ qua `t()`.

### W7: 📄 Trang + chia sẻ

- `src/domain/training/trainingLogPage.ts`:
  `buildPeriodText({ period, weeks: {week, days, weekNote, weekWeight}[], format, language }) → string`,
  đúng bố cục Notes:
  ```
  Block 2
  W1:
  26.07: D 100 5x5x80 PS 90 5x5x70
  …
  Cảm giác quá tải thần kinh, …

  W2:
  …
  ```
  Dùng lại `formatDayLine` và override, không có định dạng thứ hai. Test snapshot chuỗi.
- `TrainingLogPageSheet.tsx`: tải toàn bộ tuần của kỳ (một `getActivityLogInRange` cho cả
  kỳ), hiện `Text selectable`, nút Chia sẻ (`Share.share`, tiêu đề qua `t()`).

### W8 (tuỳ chọn, bỏ được nếu thiếu thời gian): kế hoạch cạnh thực tế

- Ngày thuộc block có buổi kế hoạch cho thứ đó → dòng mờ phía dưới
  `KH: D 100 5x5x80 PS 5x5x70`, dựng từ `ResolvedDayPlan.variations[].sets` bằng **cùng**
  `formatSetSequence` + viết tắt theo `variationId`. Chỉ với ngày ≤ hôm nay. Ngày có kế
  hoạch mà không tập → dòng mờ `27.07: —`.
- Tuỳ chọn `showPlanned` (mặc định tắt, vì sổ của người dùng không có dòng kế hoạch).

### W9: Tài liệu (tự làm, không cần hỏi)

- `docs/03-architecture.md`: mục "Sổ tập luyện" (luồng dữ liệu, 2 bảng, nguyên tắc "không
  lưu chữ máy sinh", ngữ pháp ký hiệu §2.2). `docs/08-powerlifting-engine.md`: biến thể khi
  Xả + sổ nhóm theo block. `docs/HUONG-DAN-SU-DUNG-APP.md` + `docs/USER-GUIDE-DE.md`:
  hướng dẫn ngắn. Ghi rõ "đã phủ i18n (vi/en/de)".
- Session log theo `.ai/skills/session-wrapup.md`.

---

## 6. Không được làm

- Không thêm thư viện (không `expo-clipboard`, không rich-text/markdown). Dùng `selectable`
  + `Share` có sẵn.
- Không lưu chữ máy sinh vào DB. Không cache theo ngôn ngữ.
- Không sửa công thức kcal / pin / `logActivity` / `logActivityForPastDate`. Không đổi
  `describeLiftingSets`.
- Không để sửa chữ trong sổ ảnh hưởng `activity_log` hay pin.
- Không đưa `training_log_*` / `activity_log` vào `runWeeklyCleanup`.
- Không đọc store trong `src/domain/**`. Không gọi `todayString()` trong hàm domain (truyền
  `today`).
- Không hardcode chữ UI, `'vi-VN'`, định dạng ngày. Dấu chấm thập phân chỉ đến từ
  `DEFAULT_TRAINING_LOG_FORMAT.decimal`.
- Không cố tự sinh ❌ / RPE / `(test)` / gạch ngang. Đó là việc của Tầng A. (`(+3)` **có** tự
  sinh, §4.3.3.)
- Dòng ghi tay **không** tạo `activity_log`, không gọi bất kỳ action nào của `energyStore`,
  không bị giới hạn `BACKFILL_MAX_DAYS_BACK`.
- Không parse số bằng `parseFloat` / `Number()` trực tiếp ở ô nhập. Dùng `parseDecimal`.
- Không đổi hành vi màn Kế hoạch block (W5 chỉ dời code).
- Không cho sửa số liệu buổi *theo phút* của ngày cũ từ sổ.

---

## 7. Checklist test trên máy thật (cho người dùng)

1. Xả Powerlifting: tab B, chuẩn, 90×1 rồi 5 set 72.5×5 → "+ Thêm biến thể" → `Incline`,
   5 set 62.5×5 → Lưu. Sổ tập hiện `27.07: B 90 5x5x72.5 iC 5x5x62.5`.
2. Xả D chuẩn + tab S chọn `Pause` → `D … PS …`.
3. Squat 120×1 rồi 110 với rep 4,5,5,4,8 → `S 120 110x(4+5+5+4+8)`.
4. Squat 130×1, 4 set 115×3, 1 set 100×3 → `S 130 4x3x115+3x100`.
5. Cân nặng hôm nay 77.7 → dòng ngày thành `26.08(77.7kg): …`. Tiêu đề tuần `W5: 77.7kg`.
6. Có block → ngày nằm dưới `Block N`, tuần `W1…`, deload `DELOAD`. Tuần trong block không
   tập hiện `—`. Chạm để ghi "oneweekHOLIDAYS".
7. Bấm block → gập/mở tuần. Bấm tuần → gập/mở ngày. Chỉ block và tuần mới nhất mở sẵn.
8. Chạm dòng → thêm `(95 ❌)` → Lưu → dòng giữ đúng chữ + ✎. **Pin/kcal không đổi.**
9. Sau đó Xả thêm cùng ngày → banner lệch. Thử cả 2 nút.
10. Thêm ghi chú dưới ngày "Cảm giác quá tải thần kinh…" → hiện dòng thường bên dưới.
11. ⚙︎: đổi viết tắt `iC` → `IC`, bật khởi động, đổi `decimal` sang theo ngôn ngữ → sổ cũ
    đổi ngay, dòng xem trước đúng.
12. Đổi ngôn ngữ EN/DE → nhãn tiêu đề/tháng đổi. Ký hiệu S/B/D giữ.
13. "Sửa số liệu" buổi **hôm qua** → sổ cập nhật. Kcal hôm qua ở Lịch sử đổi, pin hôm nay
    không nhảy.
14. 📄 → cả block thành một trang chữ → Chia sẻ → dán vào Apple Notes, bố cục giống sổ cũ.
15. Đổi tên block thành "Block2 Accumulation" → tiêu đề đổi. Xoá block ở Kế hoạch → các ngày
    rơi về "Tập tự do", không mất.
16. Buổi cũ đã ghi trước khi cập nhật (không có biến thể) vẫn hiện là `S`/`B`/`D`, sửa được.
17. Bench 95×1, rồi 6 set 75 với rep 4,4,4,4,4,7 → `B 95 6x4(+3)x75`.
18. **Quên Xả**: "＋ Ghi buổi" → chọn ngày 2 tuần trước (gõ `12.09`) → gõ
    `S 120 5x4x100 PD 4x3x80` → Lưu. Dòng hiện đúng tuần, có ✍. **Pin/kcal không đổi.**
19. Ghi tay với số gõ bằng dấu phẩy `5x5x72,5` → lưu thành `5x5x72.5`. Ghi chú "làm 3,4
    lần" giữ nguyên dấu phẩy.
20. "Chép buổi gần nhất" → điền sẵn dòng của buổi trước, sửa số rồi lưu.
21. Ghi tay hôm qua, sau đó Xả bù buổi hôm qua → banner "Ngày này vừa có buổi ghi từ Xả".
    Thử **Gộp** → dòng = chữ của bạn + dòng tự động.
22. Trên iPhone, ô tạ ở Xả chỉ có dấu phẩy → nhập `72,5` → sổ hiện `72.5`.

---

## 8. Câu hỏi mở / hướng sau này

- **Lần nâng hỏng / RPE / AMRAP thành dữ liệu thật**: thêm `LiftingSet.failed?`,
  `rpe?`. Formatter sinh được `(95 ❌)`, `(rpe9.2)`. Cần quyết định set hỏng có tính kcal
  không. v1: sửa tay.
- **Đã chốt (bản 3)**: `(+d)` = set cuối làm thêm d rep, tự sinh. `(4x2+5)x90` trong sổ cũ
  cùng nghĩa nên app ghi `5x2(+3)x90`.
- **Chuyển dòng ghi tay thành dữ liệu Xả**: parse dòng ghi tay theo ngữ pháp §2.2 thành set có
  cấu trúc (để sau này có biểu đồ e1RM / PR cho cả buổi quên Xả). Chỉ nên làm khi người dùng
  muốn. Nếu làm, **không** tính pin cho ngày cũ (cần một cờ "chỉ ghi, không tính pin" trong
  `activity_log`, thay đổi lớn).
- **Nạp sẵn kế hoạch khi Xả**: có block đang chạy → mở Powerlifting tự thêm các movement +
  biến thể của buổi kế hoạch hôm nay (comment "Phase 4" trong `trainingBlockRepository`).
  Rất hợp với W2.
- **Soạn thảo trực tiếp như Notes** (gõ thẳng trên trang, không qua sheet): cần xử lý bàn
  phím / cuộn phức tạp. Để v2 nếu người dùng thấy sheet chậm.
- **Nhập ngược từ Notes**: dán sổ cũ (Block 1–2) vào app. Nay đã có "dòng ghi tay", nên cách
  an toàn: tách theo dòng `DD.MM:` (chấp nhận `DD.MM.` / `DD.MM :`), mỗi ngày thành một dòng
  ghi tay. Dòng không có ngày thì gắn làm ghi chú của ngày trước. Không tạo `activity_log`,
  nên không chạm pin. Việc nhỏ, có thể làm ngay sau W6 nếu người dùng muốn.
- **Block bị xoá** làm mất tên nhóm và số block đổi. Nếu phiền: xoá mềm (`is_deleted`).
- **Ngắt quãng giữa 2 block** (`oneweekHOLIDAYS` nằm ngoài block): v1 ghi bằng một dòng ghi
  tay trong tuần đó ("＋ Ghi buổi" → gõ "nghỉ lễ"). Nếu cần dạng tiêu đề riêng: thêm "+ ghi
  chú tuần" cho tuần tự do trống.
- **Ngày năng lượng vs ngày lịch**: buổi 00:30 rơi sang ngày lịch sau (giống Lịch sử).

---

## 9. Nhật ký triển khai (Sonnet ĐIỀN trong lúc làm)

> Mỗi đợt ghi: file/hàm đã tạo/sửa; quyết định lệch khỏi kế hoạch + lý do; test mới (khẳng
> định gì); kết quả `npm run verify` (số test pass); điều bất ngờ phát hiện thêm.

### W1 — xong (2026-09-23)
- **Tạo**: `src/lib/activityLabels.ts` (`activityLabel`, `bbExerciseName`, `liftingMovementLabel`,
  `workoutLabel`, `isLiftingExercise`, `isLiftingEntry`, `isBodybuildingEntry`),
  `src/types/trainingLog.ts`, `src/domain/training/trainingLogFormatter.ts`
  (`formatSetSequence`, `formatMovement`, `movementLabel`, `abbreviationKeyOf`, `formatDayLine`,
  `trainingDaySignature`, `detectDayConflict`, `normalizeDecimalCommas`, `normalizeManualBody`),
  test `src/domain/training/__tests__/trainingLogFormatter.test.ts` (51 test).
- **Sửa**: `EnergyActionsBar.tsx` (bỏ `activityLabel`), `BodybuildingSheet.tsx` (bỏ
  `bbExerciseName`), `TodayActivities.tsx` + `BatterySourceSheet.tsx` (import từ lib, bỏ
  `workoutLabel` trùng lặp), `types/energy.ts` (`variationId?`, `variationName?`),
  `bodybuildingExercises.ts` (chỉ comment). 3 locale: thêm namespace `trainingLog`
  (`format.*`, `abbr.*`) ở cuối file.
- **Lệch kế hoạch**: (1) `trainingDaySignature` **bỏ `id`** khỏi chuỗi băm, vì
  `updateActivity` re-log dưới id mới nhưng cùng `timestamp`, nếu băm cả id thì sửa số liệu
  luôn báo "đã đổi" dù nội dung y hệt; cũng bỏ entry chỉ có bước chân. (2) `prefix` của
  `formatDayLine` **gồm cả dấu `:`** (`26.08(77.7kg):`), UI chỉ việc nối một khoảng trắng.
  (3) `workoutLabel` gộp hai bản trùng của TodayActivities/BatterySourceSheet; custom rỗng
  nay rơi về nhãn mặc định thay vì hiện chuỗi rỗng. (4) Thêm `trainingLog.format.weightUnit`.
  (5) Biến thể có `loadFactor === 1` (`bench_touch_and_go`, `*_standard`) dùng chung khoá viết
  tắt `lift:<exercise>` với bài chuẩn.
- **Số khớp bảng vàng §4.3.6**: mọi hàng trong bảng đều là một test; đạt ngay lần đầu.
- **verify**: tsc + lint sạch, 55 suite / 767 test đạt (trước W1: 716).
- **Ghi chú**: working tree đang có thay đổi dở của kế hoạch pin (locale, `energyStore`…). Đã
  chỉ dùng Edit từng chỗ, không đụng logic ngoài phạm vi.

### W2 — xong (2026-09-23)
- **Tạo**: `src/domain/energy/liftingMovements.ts` (mô hình thuần: `MovementDraft`,
  `movementsFromEntry`, `movementsToWorkouts`, `findPrevSessionForMovement`,
  `variationIdentity`, `selectableVariationIds`, `suggestNextVariationId`, `nextMovementKey`,
  `parseSetRows`, `movementSets`), test `__tests__/liftingMovements.test.ts` (20 test).
- **Sửa**: `PowerliftingSheet.tsx` viết lại state từ `Record<lift, rows>` sang danh sách
  movement. Mỗi tab S/B/D hiện các movement của lift đó, mỗi movement là một thẻ có hàng chip
  biến thể (`Chuẩn` + biến thể thư viện + `✍️ Tự đặt tên`), khởi động/bài chính, "buổi trước"
  và e1RM riêng. Nút "＋ Thêm biến thể" gợi ý sẵn biến thể chưa dùng đầu tiên. Giữ nguyên: sửa
  buổi, nạp mẫu, gợi ý khởi động, xem trước kcal/phút. `describeLiftingSets` không đổi.
  3 locale: thêm 6 key `components.powerliftingSheet.*` (`variationSectionTitle`,
  `variationStandard`, `customVariationChip`, `customVariationPlaceholder`, `addVariation`,
  `removeMovement`).
- **Lệch kế hoạch**: (1) Khi sửa buổi chỉ có bench, sheet mở đúng tab bench (trước đây luôn
  mở tab squat rồi phải chuyển). (2) Chip biến thể bỏ các id có `loadFactor === 1` (chỉ là bài
  chuẩn dưới tên khác) để khỏi trùng chip "Chuẩn". (3) Excel/Lịch sử không có cột mô tả từng
  bài nên không cần áp `liftingMovementLabel` thêm ở đó; `TodayActivities`/`BatterySourceSheet`
  đã dùng qua `workoutLabel` của W1.
- **Hành vi cần biết**: buổi trước của một biến thể chưa từng tập sẽ rơi về buổi **chuẩn** gần
  nhất cùng bài (đúng kế hoạch §4.7), dòng gợi ý có ghi ngày nên không nhầm là kỷ lục của
  biến thể. Bài chuẩn không bao giờ mượn buổi của biến thể.
- **kcal không đổi**: vẫn `liftingSessionKcal` từng session; tổng phút/kcal cộng theo từng
  set nên tách hai movement cùng lift không đổi tổng.
- **verify**: tsc + lint sạch, 56 suite / 787 test đạt (trước W2: 767).
- **Chưa kiểm tra trên máy thật**: UI thẻ movement/chip (không có môi trường chạy Expo ở
  đây). Cần test tay theo checklist §7 mục 1–2 và 16.

### W3 — xong (2026-09-23)
- **Tạo**: `src/domain/training/trainingLogIndex.ts` (`buildTrainingLogIndex`), test
  `__tests__/trainingLogIndex.test.ts` (19 test). Kiểu `TrainingLogWeek` / `TrainingLogPeriod`
  đặt trong `src/types/trainingLog.ts` (không để trong file domain).
- **Sửa**: `src/types/powerliftingBlock.ts`: thêm `TrainingBlockConfig.name?` sớm (W4 chỉ còn
  phải viết `renameBlock`).
- **Quyết định thêm so với kế hoạch**: (1) Tuần *rỗng* của block cũ bị **ẩn** nếu block mới hơn
  đã phủ tuần đó (tránh hai block chồng nhau cùng hiện tuần trống "—"); tuần có dữ liệu hoặc
  ghi chú thì luôn hiện. (2) Ngày chỉ có trong sổ (ghi tay/ghi chú, không có Xả) tính là 1
  buổi; nếu ngày đó cũng có Xả thì lấy số buổi của Xả, không cộng đôi. (3) Sắp kỳ theo
  `endDate` giảm dần (rồi `startDate`). (4) Ghi chú tuần trên một Monday nằm ngoài mọi block
  tạo ra tuần tự do rỗng để ghi chú không bị mất.
- **Giới hạn đã biết**: nếu block bắt đầu ở ngày không phải Thứ 2, một tuần lịch có thể hiện ở
  cả block lẫn "tập tự do". Block Builder luôn neo vào Thứ 2 nên hiếm.
- **verify**: tsc + lint sạch, 57 suite / 806 test đạt (trước W3: 787).

### W4 — xong (2026-09-23)
- **Tạo**: `src/data/repositories/trainingLogMapper.ts` (row↔record, `isEmptyDayRecord`,
  `cleanText`, `countSessionsByDay`), `trainingLogRepository.ts` (đủ hàm §W4 + `getTrainingLogDay`
  + `getLatestTrainingLogDayBefore`), `src/store/trainingLogStore.ts`,
  `src/hooks/useTrainingLogFormat.ts`, `src/domain/training/trainingLogWeights.ts`
  (`weightRecordedOn`, `firstWeightInRange`), `src/lib/dateInput.ts` (`parseDayMonthInput`).
  Test mới: `trainingLogMapper` (9), `trainingLogWeights` (4), `dateInput` (6),
  `trainingLogStore` (19), `blockStore.rename` (4), `settingsStore.trainingLogFormat` (6).
- **Sửa**: `schema.ts` (2 bảng + `ALL_SCHEMAS`, vòng `initDatabase` tự tạo trên máy đã cài, không
  cần migration cột), `activityLogRepository` (`getTrainingDayCounts`,
  `getLatestTrainingDateBefore`), `healthSignalsRepository` (`getWeightsInRange`),
  `blockStore.renameBlock`, `settingsStore` (`trainingLogFormat`, `setTrainingLogFormat`,
  `setTrainingLogAbbreviation`), `constants.ts` (`TRAINING_LOG_MAX_DAYS_BACK = 730`),
  `types/trainingLog.ts` (`resolveTrainingLogFormat`), `PastDateField.tsx`.
- **Lệch/bổ sung so với kế hoạch**: (1) **`PastDateField` không chỉ thêm `dd.mm`**: bàn phím
  `decimal-pad` của iPhone không có dấu `/`, nên ô ngày cũ gần như không gõ tay được. Tách
  `parseDayMonthInput` ra `lib/dateInput.ts`, nhận `/ . , -`, suy năm từ `today` (không đọc
  đồng hồ), và **từ chối ngày không tồn tại** (`31.02`; trước đây `new Date` tự nhảy sang
  tháng sau). Đổi này ảnh hưởng cả ô ngày của Xả bù/ghi bữa ăn (chỉ mở rộng chấp nhận, không
  bỏ cái cũ). (2) `useTrainingLogFormat()` là hook đọc format (hợp nhất với default, memo hoá)
  thay vì để từng chỗ tự spread. (3) `saveManualDay` **thay** ghi chú của ngày (không giữ ghi
  chú cũ); chế độ "thêm" chỉ mở cho ngày chưa có nội dung nên không mất gì. (4) `loadIndex`
  luôn tăng `revision` (kể cả khi mở tab), để tuần đang mở nạp lại sau khi Xả ở tab khác (màn
  hình tab không bị unmount). (5) Bảng ngày trống được **xoá** thay vì lưu (`upsert` tự xoá khi
  cả dòng lẫn ghi chú rỗng); chữ ký chỉ lưu khi có dòng.
- **Cân nặng**: dòng ngày lấy lần cân **đầu tiên trong ngày**, tiêu đề tuần lấy lần cân đầu tiên
  trong tuần (không carry-forward như `weightOnOrBefore`).
- **Giới hạn đã biết**: ô ngày vẫn chỉ đoán năm hiện tại hoặc năm trước, nên gõ ngày cũ hơn ~12
  tháng bằng tay không được (cần chip/ô có năm). Placeholder `dd/mm` của `PastDateField` là chữ
  cứng có từ trước, chưa đưa vào i18n (không thuộc phạm vi đợt này).
- **verify**: tsc + lint sạch, 63 suite / 854 test đạt (trước W4: 806).

### W5 — xong (2026-09-23)
- **Tạo** (`src/components/training/`): `BlockPlanView.tsx` (chuyển nguyên phần Block Builder
  cũ từ `TrainingScreen`, chỉ đổi đường dẫn import + `SafeAreaView` → `View`),
  `TrainingNotebookSection.tsx` (tiêu đề gập/mở kiểu Notes, chỉ mount con khi mở),
  `TrainingLogView.tsx`, `TrainingLogPeriodSection.tsx`, `TrainingLogWeekSection.tsx`,
  `TrainingLogDayLine.tsx`, test render `__tests__/TrainingLogDayLine.test.tsx` (9 test, dùng
  `react-test-renderer` có sẵn).
- **Sửa**: `TrainingScreen.tsx` viết lại thành thanh 2 chế độ (📓 Sổ tập mặc định | 📋 Kế hoạch
  block); `trainingLogFormatter.ts` thêm `formatDayDate`, `formatBodyWeight`; 3 locale thêm 20
  key `trainingLog.*` (tiêu đề, nhãn tuần, trạng thái trống, banner xung đột, xác nhận) +
  `format.weightPlain`.
- **Hành vi**: chỉ block/tháng mới nhất mở sẵn, và trong đó chỉ tuần mới nhất (cuối danh sách)
  mở. Tuần chỉ tải dữ liệu khi mở (`getActivityLogInRange` + ngày sổ + ghi chú tuần), cân
  nặng của cả kỳ tải một lần khi kỳ mở. `revision` của store đổi (ghi hoặc focus tab) thì tuần
  đang mở tải lại. Tiêu đề tuần: `W4: 77.5kg` / `DELOAD:` (block), `07.09–13.09` (tuần tự do).
  Tuần rỗng hiện `—` (chữ xám). Banner xung đột **đã có đủ 3 nút** ở W5 (Dùng dòng tự động có
  Alert xác nhận / Giữ dòng của tôi / Gộp), vì store W4 đã có sẵn action; W6 chỉ còn phải
  làm trình soạn thảo.
- **Chưa làm ở W5 (thuộc W6/W7)**: chạm vào dòng để sửa (`onPress` của `TrainingLogDayLine` đang
  bỏ trống), nút ＋ Ghi buổi, ghi chú tuần có thể sửa, nút ⚙︎ và 📄.
- **Lệch kế hoạch**: không dùng `CollapsibleSection` (dáng thẻ của màn Home) mà thêm
  `TrainingNotebookSection` riêng, để khỏi bẻ component dùng chung sang kiểu thứ hai.
- **Chưa thử trên máy thật**: bố cục, cỡ chữ, cuộn, gập/mở. Test render chỉ xác nhận chữ và nút
  bấm, không xác nhận hình.
- **verify**: tsc + lint sạch. **Có 1 test lỗi ngẫu nhiên không thuộc sổ tập**:
  `energyStore.backfill.test.ts › removeFoodForPastDate › round-trips a fully-past backfill`
  (khoảng nửa số lần chạy, cả khi chạy riêng file): `lastSatietySyncAt` lệch 1 ms vì test đọc
  đồng hồ thật. File đó và `energyStore.ts` đang có thay đổi chưa commit của kế hoạch pin
  (`2026-09-23-battery-late-logging-timing.md`) nên mình không đụng. Khi chạy hết: 64 suite,
  863 test, đạt cả 863 khi test này không nhảy sai.

### W6 — xong, trừ W6b (2026-09-23)
- **Tạo** (`src/components/training/`): `TrainingLogLineEditor.tsx` (thêm/sửa dòng ngày),
  `TrainingLogTextSheet.tsx` (ô nhập chữ chung cho ghi chú tuần + tên block),
  `TrainingLogFormatSheet.tsx` (⚙︎), `trainingLogActions.ts`; `src/domain/training/entryEdit.ts`
  (`mergeEditedWorkouts`). Test: `TrainingLogLineEditor.test.tsx` (19, render),
  `entryEdit.test.ts` (5), thêm vào `dateInput.test.ts`, `trainingLogIndex.test.ts`
  (`suggestEntryDate`), và `energyStore.updateActivityForPastDate.test.ts` (5).
- **Sửa**: `energyStore.ts` (+ `updateActivityForPastDate`, chỉ ghép `updateActivity` /
  `removeActivityForPastDate` / `logActivityForPastDate`, không thêm logic pin), `TrainingLogView`
  (chủ của mọi sheet, nút ＋ Ghi buổi, ⚙︎), `TrainingLogWeekSection` (hàng nút ＋ Ghi buổi /
  ✎ Ghi chú tuần dưới mỗi tuần mở, nhấn giữ tiêu đề tuần = sửa ghi chú tuần),
  `TrainingLogPeriodSection` (nhấn giữ tiêu đề block = đổi tên), `TrainingNotebookSection`
  (`onLongPress`), `trainingLogIndex.ts` (`suggestEntryDate`), `lib/dateInput.ts`
  (`formatDayMonthInput`, thứ tự tháng/ngày cho English, năm tuỳ chọn `dd.mm.yyyy`),
  3 locale (`trainingLog.editor.*`, `.textSheet.*`, `.formatSheet.*`, 3 key nút).
- **Lệch/bổ sung so với kế hoạch**:
  1. **Không dùng `PastDateField` trong trình soạn thảo**: nó chỉ ghi ngày khi ô mất focus
     (`onBlur`), nên bấm Lưu ngay sau khi gõ ngày có thể lưu nhầm ngày cũ. Thay bằng ô ngày
     riêng, parse trực tiếp mỗi lần gõ, hiện luôn ngày đã hiểu (thứ + ngày + năm) hoặc lỗi.
     Bàn phím `numbers-and-punctuation` (có `. , / -`). English gõ tháng/ngày.
  2. **Giữ lâu tiêu đề tuần/block, chạm dòng, và nút hiện sẵn**: kế hoạch ghi "chạm tiêu đề tuần
     → sửa ghi chú" trùng với "bấm tuần → mở", nên chạm = gập/mở (yêu cầu gốc của bạn), nhấn giữ
     hoặc nút ✎ Ghi chú tuần dưới tuần = sửa ghi chú.
  3. **Sửa số liệu không làm rơi buổi khác cùng entry**: sheet Powerlifting/Bodybuilding thay cả
     mảng `workouts`. Nếu entry có thêm một buổi chạy bộ, sửa số liệu ở nơi cũ (`TodayActivities`)
     sẽ làm mất buổi chạy. Sổ dùng `mergeEditedWorkouts` để giữ lại phần sheet không quản lý.
     **Lỗi này vẫn còn ở `TodayActivities`** (ngoài phạm vi), hiếm vì Xả thường ghi một loại
     mỗi entry.
  4. Trình soạn thảo lấy nội dung ban đầu theo kiểu "suy ra từ dữ liệu đã tải, chỉ lưu vào state
     khi người dùng gõ" (không copy vào state trong effect), nên đổi ngày ở chế độ thêm vẫn giữ
     chữ đã gõ.
  5. Sheet ghi chú tuần/tên block thay cho `Alert.prompt` (không có trên Android).
- **Kết quả đã kiểm chứng bằng test**: sửa số liệu buổi cũ cho ra đúng số như thể buổi đó được ghi
  đúng từ đầu (so sánh từng hàng pin của ngày, kể cả sửa đi rồi sửa lại), giữ nguyên `timestamp`
  nên buổi không nhảy ngày. Ghi tay không gọi bất kỳ action nào của `energyStore`.
- **Không làm (W6b, tuỳ chọn)**: nút "Nhập chi tiết set (tính cả pin)" cho ngày trong 3 ngày qua.
  Nó phụ thuộc đường ghi ngày cũ mà kế hoạch pin đang sửa dở; để lại.
- **Chưa thử trên máy thật**: cuộn/bàn phím trong sheet, chồng sheet (đóng trình soạn thảo rồi mở
  sheet Powerlifting để tránh hai Modal lồng nhau trên iOS).
- **verify**: tsc + lint sạch, 67 suite / 900 test đạt (trước W6: 863, đã cộng cả 9 test render
  của W5).

### W7 — xong (2026-09-23)
- **Tạo**: `src/domain/training/trainingLogPage.ts` (`buildPeriodText`),
  `src/components/training/TrainingLogPageSheet.tsx`, test `trainingLogPage.test.ts` (7) và
  `TrainingLogPageSheet.test.tsx` (2, render).
- **Sửa**: `trainingLogFormatter.ts` thêm `formatWeekLabel`, `formatWeekHeading`,
  `formatPeriodTitle` (một nguồn duy nhất cho tiêu đề tuần/kỳ, màn hình và trang cùng dùng);
  `TrainingLogWeekSection` / `TrainingLogPeriodSection` dùng lại chúng; `trainingLogActions.ts`
  (+ `openPage`); `TrainingLogView` (sở hữu sheet Trang); 4 key i18n (`pageButton`, `pageShare`,
  `pageShareTitle`, `pageEmpty`).
- **Lệch kế hoạch**: nút 📄 nằm **trong từng kỳ đang mở** ("📄 Trang / Chia sẻ", đầu danh sách
  tuần) thay vì một nút chung ở đầu màn hình, để rõ là trang của kỳ nào (kế hoạch ghi "kỳ đang mở"
  nhưng màn hình có thể mở nhiều kỳ cùng lúc).
- **Bố cục trang** đúng Notes: dòng tiêu đề kỳ, `W1:` ngay dưới, dòng ngày, ghi chú dưới ngày,
  dòng trống giữa các tuần; tuần trống in `—`; ngày chỉ có ghi chú in `30.07:` + ghi chú. Dùng
  `Share.share` của React Native (không thêm thư viện): iOS có sẵn "Ghi chú" / "Sao chép".
- **Giới hạn**: trang chụp lại kỳ lúc mở (số buổi/ngày của index tại thời điểm đó), chữ tải lại khi
  `revision` đổi.
- **verify**: tsc + lint sạch, 69 suite / 909 test đạt (trước W7: 900).

### W8 — bỏ qua (2026-09-23)
Tuỳ chọn trong kế hoạch, mặc định tắt (`showPlanned`), và sổ Notes thật của người dùng không có
dòng kế hoạch. Để lại; chỉ thêm khi người dùng cần so kế hoạch với thực tế ngay trong sổ (kế hoạch
đã có sẵn ở chế độ "Kế hoạch block", và bản in Excel `trainingBlockPrintSheet`).

### W9 — xong (2026-09-23)
- **Sửa**: `docs/03-architecture.md` (cây thư mục, 2 bảng, mục "Sổ tập luyện" gồm nguyên tắc, ký hiệu, luồng dữ
  liệu, bẫy đã gặp), `docs/08-powerlifting-engine.md` §9, `docs/HUONG-DAN-SU-DUNG-APP.md` + `docs/USER-GUIDE-DE.md`
  (mục 4b), `.ai/SESSION_LOG.md` (Session 32), `.ai/CONTEXT.md` mục 10, `docs/04-roadmap.md`. Ghi rõ đã phủ i18n vi/en/de.
- Không đánh dấu "Test thật ✅" và không `[x]` cho mục chưa test máy thật (theo `session-wrapup.md`).
- **Tổng kết cả kế hoạch**: 716 → 909 test (+193), tsc + eslint sạch. Toàn bộ checklist §7 còn chờ người dùng test máy
  thật. Việc để lại: sửa test lỗi ngẫu nhiên của Session 31, vá `TodayActivities` làm rơi buổi khác cùng entry, W8, W6b,
  nhập sổ Notes cũ dưới dạng dòng ghi tay.

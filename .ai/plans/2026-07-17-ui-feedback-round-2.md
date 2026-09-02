# KẾ HOẠCH: UI Feedback Round 2 — 6 hạng mục (2026-07-17)

> **Người điều phối (orchestrator):** Fable — đã khảo sát code + debug xong, viết plan này.
> **Người thực thi:** Sonnet — 4 wave TUẦN TỰ (W1 → W2 → W3 → W4), mỗi wave xong phải
> `npm run verify` pass rồi mới sang wave kế.
> **QA:** agent `qa-reviewer` chạy sau W4.
> **Chốt sổ:** Haiku — cập nhật docs, session log, commit & push lên GitHub
> (`origin/ui-upgrade`, repo https://github.com/dangminhlk54paypal-netizen/Body-Batteries.git)
> để user truy cập từ xa để test.
>
> Branch hiện tại: `ui-upgrade`. KHÔNG commit giữa chừng — Sonnet chỉ sửa working tree;
> Haiku commit cuối cùng (xem mục H).

---

## 0. QUY TẮC BẮT BUỘC CHO MỌI AGENT (chèn nguyên khối này vào prompt của từng agent)

1. **i18n bắt buộc (AGENTS.md):** App có 3 ngôn ngữ VI/EN/DE, hệ thống tự viết trong
   `src/i18n/` — KHÔNG thêm i18next hay thư viện nào khác. KHÔNG hardcode bất kỳ chuỗi
   hiển thị nào (kể cả `Alert.alert`, `placeholder`, `accessibilityLabel`). Key mới thêm
   vào `src/i18n/locales/vi.ts` TRƯỚC (source of truth), rồi mirror sang `en.ts` và
   `de.ts` — hai file này typed `TranslationSchema = typeof vi` nên thiếu key là
   `npx tsc --noEmit` fail; không được lách bằng `as const`/`any`/partial type.
   Component dùng `const { t, language } = useT()`; hàm pure trong domain/services nhận
   tham số `language: Language` — không đọc store từ domain. Ngày/số dùng
   `LOCALE_TAGS[language]`.
2. **Verify:** xong việc chạy `npm run verify` (= `tsc --noEmit` + eslint + jest) và dán
   kết quả vào báo cáo. Không được nói "xong" khi verify chưa pass.
3. **ESLint hook:** repo có PostToolUse hook chặn vi phạm `react-hooks/purity` và
   `set-state-in-effect` — viết component thỏa 2 rule này ngay từ đầu (không setState
   trong effect không điều kiện, không side-effect trong render).
4. **Expo SDK 54 pinned** (`react-native` 0.81.5, `react` 19.1.0) — không thêm dependency
   mới, không upgrade SDK. Mọi thứ trong plan này làm được bằng dependency có sẵn.
5. **Không scope creep:** chỉ làm đúng task được giao trong wave của mình. Thấy vấn đề
   ngoài scope → ghi vào báo cáo, không tự sửa.
6. **Code tiếng Anh, comment ngắn gọn** theo phong cách file xung quanh. Logic thuần để
   trong `src/domain`/`src/lib` (có test), UI không chứa logic tính toán.
7. **Báo cáo cuối:** liệt kê file đã sửa + tóm tắt diff, để orchestrator/user
   `git diff --stat` đối chiếu (đề phòng agent sau vô tình revert việc agent trước —
   đã từng xảy ra trong repo này).

---

## KẾT QUẢ DEBUG (Fable đã xác minh, Sonnet không cần điều tra lại)

### Bug cân nặng 79.4 → hiển thị 79.0 — ROOT CAUSE ĐÃ TÌM RA
- Nhập liệu dùng `keyboardType="decimal-pad"`; trên iPhone locale tiếng Việt/Đức, phím
  thập phân là **dấu phẩy** → user gõ `79,4`.
- [WeightLogCard.tsx:30](src/components/WeightLogCard.tsx#L30) parse bằng
  `parseFloat(weightText)` — `parseFloat("79,4")` dừng ở dấu phẩy, trả về `79`.
  `79` qua validate (trong PROFILE_LIMITS) → lưu DB `79` → hiển thị `79.0 kg`.
- Tầng lưu (`healthSignalsRepository.logWeight`) và tầng hiển thị (`toFixed(1)`) đều
  ĐÚNG — chỉ tầng parse sai. Lỗi này tồn tại ở **mọi input số thập phân** trong app
  (danh sách đầy đủ ở T1.1).

### Màu "Dinh Dưỡng" vs "Năng Lượng" gần trùng nhau
- [TrendChart.tsx:23-24](src/components/TrendChart.tsx#L23-L24):
  `NUTRIENT_COLOR = colors.accent` (#FFB020 cam hổ phách) và
  `ENERGY_COLOR = colors.warning` (#FFD93D vàng) — hai màu vàng-cam sát nhau → khó phân biệt.

### Hạ tầng đã có sẵn (tận dụng, không viết lại)
- Backfill món ăn (S-S5) đã chạy: `PastDateField` + `energyStore.logFoodForPastDate` /
  `removeFoodForPastDate` + flow thêm/xóa món cho ngày cũ từ HistoryScreen/DayDetailSheet.
- `energyStore.logActivity(payload, timestampOverride?)` đã có tham số override timestamp
  (dòng ~1017) nhưng CHƯA có đường "log vận động cho ngày quá khứ" đúng nghĩa (xem T2.2).
- Khuyến nghị dinh dưỡng: đã có `lib/nutrientTargets.ts` (DRI theo giới/tuổi),
  `domain/energy/weightGoal.ts` (`dailyCalorieTarget`), `metabolismEngine.ts`
  (`basalMetabolicRate`), `lib/weightGoalConstants.ts`. Thiếu: nước, carbs, protein,
  vận động, ngủ, cân nặng khuyến nghị → wave 3 bổ sung.
- Theme: `src/lib/theme.ts` là 1 palette dark duy nhất, **32 file** import tĩnh
  `colors` — wave 4 chuyển sang hook.

---

## WAVE 1 — Sửa bug + quick wins (1 agent Sonnet, model sonnet)

### T1.1 Fix parse số thập phân dấu phẩy (bug cân nặng 79,4 → 79.0)
- Thêm helper vào `src/lib/units.ts`:
  ```ts
  /** Parse a decimal typed on a comma-decimal keyboard ("79,4" → 79.4). */
  export function parseDecimal(text: string): number {
    return parseFloat(text.trim().replace(',', '.'));
  }
  ```
- Thay `parseFloat(...)` bằng `parseDecimal(...)` tại đúng các chỗ nhận input thập phân:
  - [WeightLogCard.tsx:30](src/components/WeightLogCard.tsx#L30)
  - [BodyProfileCard.tsx:54-61](src/components/BodyProfileCard.tsx#L54-L61) (weight,
    height, age, steps, goalWeightKg, goalWeeks)
  - [TodayMeals.tsx:78](src/components/TodayMeals.tsx#L78)
  - [FoodLogModal.tsx:245,247](src/components/FoodLogModal.tsx#L245) (grams, portionCount)
  - [EnergyActionsBar.tsx:127,179,215,216](src/components/EnergyActionsBar.tsx#L127)
    (kcal, MET, minutes, steps)
  - [TodayActivities.tsx:129-130](src/components/TodayActivities.tsx#L129-L130)
  - [IntakeModal.tsx:50](src/components/IntakeModal.tsx#L50)
  - [BodybuildingSheet.tsx:73-74](src/components/BodybuildingSheet.tsx#L73-L74)
  - [PowerliftingSheet.tsx:84-85](src/components/PowerliftingSheet.tsx#L84-L85)
  - [CustomFoodFields.tsx:87](src/components/food/CustomFoodFields.tsx#L87)
  - Các `parseInt` (giờ/phút, dd/mm) GIỮ NGUYÊN — không có dấu phẩy.
- Quy tắc làm tròn cân nặng GIỮ NGUYÊN (đã đúng yêu cầu user): lưu
  `Math.round(x*10)/10`, hiển thị `toFixed(1)` → `79,5674` → `79.6`; `79,23` → `79.2`.
- Unit test mới `src/lib/__tests__/units.test.ts` (hoặc file test units hiện có):
  `parseDecimal('79,4') === 79.4`, `('79.4') === 79.4`, `('79,5674')` → round 79.6,
  `('') → NaN`, `('abc') → NaN`.

**Acceptance:** gõ `79,4` vào "Cân nặng theo thời gian" → hiện `79.4 kg`; các form khác
nhận cả `,` lẫn `.`.

### T1.2 Tiêu đề mục trong Cài đặt to + đậm hơn
- [SettingsScreen.tsx:486-488](src/screens/SettingsScreen.tsx#L486-L488): hiện
  `sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1.5 }`.
- Đổi thành: `fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5`;
  `sectionIcon: fontSize 14 → 16`. `sectionDesc` giữ nguyên (13) để tạo tương phản
  tiêu đề ↔ nội dung như user yêu cầu.
- Grep `sectionTitle` ở các screen khác (Diary/History) — nếu có style header mục tương
  tự thì nâng đồng bộ (History `title` 26 là tiêu đề màn hình, không đụng).

**Acceptance:** NGÔN NGỮ / HỒ SƠ CƠ THỂ / SỨC KHOẺ / THÔNG BÁO / KHUNG GIỜ BỮA ĂN /
DỮ LIỆU / GIAO DIỆN nổi bật rõ so với chữ mô tả bên dưới.

### T1.3 Nút dưới pin chính: bỏ "Ăn thêm", đổi tên "Nạp" / "Xả"
- [EnergyActionsBar.tsx](src/components/EnergyActionsBar.tsx): xóa nút
  `addCaloriesButton` + toàn bộ modal calo tay (`calorieOpen`, state `kcal`,
  `confirmCalories`, sheet "Manual calories"). **Trước khi xóa:** grep `addCalories`
  toàn repo — hàm store `energyStore.addCalories` GIỮ NGUYÊN (Excel export/DayDetail có
  thể tham chiếu), chỉ gỡ UI ở EnergyActionsBar.
- Locale (sửa vi.ts trước, mirror en/de):
  - `components.energyActionsBar.logFoodButton`: `'🍱 Ghi món ăn (từ danh sách)'` → `'⚡ Nạp'`
    (EN `'⚡ Charge'`, DE `'⚡ Aufladen'`).
  - `components.energyActionsBar.activityButton`: `'🏃 Vận động'` → `'🔥 Xả'`
    (EN `'🔥 Burn'`, DE `'🔥 Verbrennen'`).
  - Xóa key `addCaloriesButton` + các key `calorieSheet*`/`kcalPlaceholder`/`chargeButton`
    CHỈ KHI không còn nơi nào dùng (grep từng key cả 3 file locale + src).
  - Cập nhật chuỗi nhắc tên nút cũ: `todayActivities.emptyText` (vi.ts:559 nhắc
    "Bấm '🏃 Vận động'") và `todayMeals.emptyText` (vi.ts:675 nhắc "🍱 Ghi món ăn")
    → đổi theo tên nút mới, cả 3 ngôn ngữ.
- Layout: còn 2 nút — giữ nút Nạp full-width phía trên, nút Xả vào hàng dưới, hoặc gộp
  2 nút 1 hàng 50/50 (đề xuất: 1 hàng 2 nút to ngang nhau — Nạp trái, Xả phải).

**Acceptance:** dưới pin chính chỉ còn 2 nút "⚡ Nạp" và "🔥 Xả"; bấm Nạp mở FoodLogModal,
bấm Xả mở sheet vận động; không còn đường vào modal "Ăn thêm (kcal)".

### T1.4 Lịch sử 7 ngày: 2 màu đối lập cho Dinh dưỡng vs Năng lượng
- Thêm 2 token semantic vào `src/lib/theme.ts` (để wave 4 mang sang light theme):
  ```ts
  trendNutrition: '#54A0FF', // blue — nutrition line/badge (đối lập với amber)
  trendEnergy: '#FFB020',    // amber — energy line/badge
  ```
  (Cặp xanh dương ↔ cam hổ phách là complementary, an toàn cho mù màu đỏ-lục.)
- [TrendChart.tsx:23-24](src/components/TrendChart.tsx#L23-L24):
  `NUTRIENT_COLOR = colors.trendNutrition`, `ENERGY_COLOR = colors.trendEnergy`.
- [HistoryScreen.tsx:200-214](src/screens/HistoryScreen.tsx#L200-L214): 2 badge
  `nutritionBadge`/`energyBadge` hiện cùng dùng `avgColor(pct)` — thêm viền/nền phân biệt:
  badge Dinh dưỡng viền `trendNutrition`, badge Năng lượng viền `trendEnergy` (giữ nền
  avgColor theo điểm số), để card ngày cũng phân biệt được 2 chỉ số như chart.

**Acceptance:** biểu đồ 7 ngày có 2 đường xanh dương / cam rõ ràng + legend khớp màu;
badge trên card ngày phân biệt được Dinh dưỡng vs Năng lượng.

**Wave 1 verify:** `npm run verify` pass; báo cáo diff.

---

## WAVE 2 — Nạp/Xả cho ngày quá khứ, tối đa 3 ngày (1 agent Sonnet)

> Yêu cầu user: nhập/bổ sung dữ liệu cho tối đa **3 ngày trước** (hôm qua, hôm kia,
> hôm kìa). Món ăn (Nạp) đã có backfill 35 ngày → SIẾT về 3 ngày cho thống nhất.

### T2.1 PastDateField: thêm chip "Hôm kìa" + hằng số giới hạn 3 ngày
- `src/lib/constants.ts`: thêm
  `export const BACKFILL_MAX_DAYS_BACK = 3; // user yêu cầu 2026-07-17: chỉ bù tối đa 3 ngày`
  (`DATA_RETENTION_DAYS = 35` giữ nguyên — đó là giới hạn LƯU, không phải giới hạn NHẬP).
- [PastDateField.tsx:93-99](src/components/food/PastDateField.tsx#L93-L99): thêm chip
  thứ 4 `{ label: t('common.threeDaysAgo'), days: 3 }`. Thêm key
  `common.threeDaysAgo`: vi `'Hôm kìa'`, en `'3 days ago'`, de `'Vor 3 Tagen'`
  (vi có từ riêng nên không dùng `daysAgo` generic).
- [FoodLogModal.tsx:612](src/components/FoodLogModal.tsx#L612):
  `maxDaysBack={DATA_RETENTION_DAYS}` → `maxDaysBack={BACKFILL_MAX_DAYS_BACK}`.
- Flow History → DayDetailSheet → "thêm món cho ngày cũ" (`initialDate`): với ngày cũ
  hơn 3 ngày, ẨN nút thêm món trong DayDetailSheet (điều kiện: `sheetDate` nằm trong
  `[today-3, today]`). Xóa món ngày cũ vẫn cho phép như hiện tại.

### T2.2 Xả (vận động) cho ngày quá khứ — phần rủi ro nhất wave, đọc kỹ
**Bước A — điều tra (bắt buộc, trước khi viết code):** đọc
`energyStore.logActivity` (dòng ~1017-1230) và `logFoodForPastDate` (dòng ~798) để trả
lời 3 câu hỏi:
1. `timestampOverride` hiện được dùng cho flow nào? (comment FIX #6 — có vẻ là edit
   trong ngày, không phải backfill ngày khác.)
2. `logActivity` có side effect "hôm nay" nào? (movement pin cộng dồn — comment FIX
   #2/#3/BUG A quanh dòng 1139-1147; `growGoalFromActivity` nới goal ăn hôm nay;
   ghi `intake_events` cho Excel.)
3. Food backfill (`logFoodForPastDate`) cập nhật daily_log/battery_readings ngày cũ
   bằng cơ chế nào → mirror đúng cơ chế đó.

**Bước B — implement:** tạo `energyStore.logActivityForPastDate(...)` THEO ĐÚNG PATTERN
`logFoodForPastDate` (không nhồi thêm nhánh if vào `logActivity` — giữ "one true
same-day path" như food):
- Ghi `activity_log` (+ `intake_events` nếu pattern food làm vậy) với timestamp thuộc
  ngày quá khứ được chọn.
- Cập nhật daily_log / battery_readings của NGÀY ĐÓ để Lịch sử 7 ngày đổi %.
- KHÔNG đụng movement pin hôm nay, KHÔNG `growGoalFromActivity` hôm nay, KHÔNG đổi
  satiety/energy hiện hành.
- Kèm hàm xóa ngược `removeActivityForPastDate` NẾU pattern food có tương đương
  (`removeFoodForPastDate`) — nếu quá phức tạp, ghi rõ trong báo cáo là chưa có đường
  xóa vận động ngày cũ, để user quyết sau.
- UI [EnergyActionsBar.tsx](src/components/EnergyActionsBar.tsx): trong sheet Xả, thêm
  `PastDateField` (maxDaysBack = `BACKFILL_MAX_DAYS_BACK`), state `activityDate` default
  hôm nay. `confirmActivity`: hôm nay → `logActivity` như cũ; ngày cũ → build timestamp
  giữa ngày (mirror `buildTimestampForDate` của FoodLogModal, tôn trọng startTime/endTime
  nếu user nhập) → `logActivityForPastDate`. Hiện dòng cảnh báo nhỏ như FoodLogModal
  `backfillNotice` khi đang chọn ngày cũ (key i18n mới ×3, ví dụ
  `energyActionsBar.backfillNotice`: vi `'Đang ghi cho ngày {{date}}'`).
- Test: jest cho logic mới ở mức store/domain nếu tách được hàm pure; tối thiểu toàn bộ
  test cũ + tsc + lint pass.

**Acceptance:**
- Ghi chạy bộ 30' cho "Hôm kìa" → card ngày đó trong Lịch sử 7 ngày tăng % Năng lượng.
- Pin Vận động HÔM NAY và mục tiêu ăn HÔM NAY không nhúc nhích.
- Không ghi được cho ngày cách đây ≥4 ngày hoặc tương lai (PastDateField chặn sẵn).
- Nạp (món ăn) giờ cũng chỉ cho lùi tối đa 3 ngày.

---

## WAVE 3 — Bấm pin chính → sheet "Khuyến nghị mỗi ngày" (1 agent Sonnet)

> User muốn: bấm vào viên pin chính thấy lượng đường, muối, carbs, protein, nước,
> vận động, giấc ngủ nên nạp mỗi ngày theo tuổi/giới/chiều cao/lối sống/cân nặng mong
> muốn + khuyến nghị cân nặng khỏe mạnh. **Số liệu căn cứ nguồn uy tín — Fable đã
> tổng hợp sẵn bên dưới, Sonnet KHÔNG cần tự nghiên cứu web, chỉ cần ghi nguồn vào
> comment + docs.**

### T3.1 Domain thuần: `src/domain/nutrition/dailyRecommendations.ts` (+ tests)
Hàm pure `dailyRecommendations(profile: UserProfile): DailyRecommendations` — KHÔNG đọc
store, KHÔNG i18n bên trong (UI dịch). Trả về các mục sau (nguồn ghi comment):

| Mục | Công thức / giá trị | Nguồn |
|---|---|---|
| Calo/ngày | dùng `dailyCalorieTarget(profile)` có sẵn (Mifflin-St Jeor + hoạt động + goal an toàn) | đã có trong repo |
| Protein | baseline RDA `0.8 g/kg` cân nặng; range khuyến nghị `1.2–1.6 g/kg` nếu có tập luyện (dựa occupation/averageDailySteps > ngưỡng hoặc luôn hiển thị dạng range 0.8–1.6 kèm chú thích) | IOM/NASEM DRI; WHO |
| Carbs | 45–65% năng lượng của targetKcal ÷ 4 kcal/g → range gram | IOM AMDR |
| Đường tự do | < 10% năng lượng (÷ 4 → gram), kèm mức "tốt hơn nữa" < 5% | WHO 2015 |
| Muối | < 5 g/ngày (≈ natri < 2000 mg) | WHO |
| Nước | `35 ml × kg cân nặng`, clamp 1.5–3.5 L; chú thích tham chiếu EFSA AI (nam ~2.5 L, nữ ~2.0 L tổng dịch) | EFSA 2010 |
| Vận động | 150–300 phút cường độ vừa/tuần (≈ 21–43 phút/ngày) + 2 buổi kháng lực/tuần | WHO 2020 |
| Giấc ngủ | 18–64 tuổi: 7–9 h; ≥ 65: 7–8 h (bracket theo `profile.age`) | National Sleep Foundation / AASM |
| Cân nặng khỏe | BMI 18.5–24.9 × (heightCm/100)² → range kg (1 số lẻ); trạng thái so với cân hiện tại: `below / within / above` | WHO BMI |

- Types đặt trong cùng file hoặc `src/types/nutrition.ts` theo convention có sẵn.
- Không mâu thuẫn với `nutrientTargets.ts` (bảng DRI vi chất giữ nguyên cho pin phụ);
  sheet mới dùng số WHO ở trên — 2 hệ quy chiếu khác mục đích, ghi comment nói rõ.
- **Ranh giới sức khỏe (convention repo):** đây là "Chỉ để tham khảo", KHÔNG phải tư vấn
  y tế — disclaimer bắt buộc trong UI, không dùng ngôn ngữ chẩn đoán/ra lệnh
  (qa-reviewer sẽ soát).
- Jest tests: profile nam 30t/78kg/168cm → khớp số kỳ vọng từng mục; bracket tuổi ≥65;
  nữ; BMI dưới/trong/trên range.

### T3.2 UI: `src/components/BodyRecommendationsSheet.tsx` + wiring
- Mở khi bấm viên pin chính: bọc `Pressable` quanh `<MasterBattery …/>` trong
  [LiveMasterBattery.tsx](src/components/LiveMasterBattery.tsx) (giữ HomeScreen sạch).
- Dạng bottom-sheet trượt lên có ScrollView (mirror pattern `useSheetSlide` của
  EnergyActionsBar hoặc `src/components/ui/BottomSheet.tsx` nếu tái dùng được — ưu tiên
  tái dùng BottomSheet có sẵn).
- Nội dung nhóm theo bảng T3.1: 🎯 Calo & cân nặng khuyến nghị → 🥩 Protein / 🍚 Carbs →
  ⚠️ Giới hạn (đường, muối) → 💧 Nước → 🏃 Vận động → 😴 Giấc ngủ. Mỗi dòng: tên, giá
  trị + đơn vị (format `LOCALE_TAGS[language]`), chú thích nguồn ngắn (WHO/EFSA/IOM).
  Footer: disclaimer "Chỉ để tham khảo, không phải tư vấn y tế" (key i18n).
- Mục cân nặng: hiện range khỏe mạnh + câu trạng thái (đang trong/dưới/trên range) +
  nếu có `goalWeightKg` thì nhắc goal hiện tại.
- Toàn bộ text qua `t()`, key mới dạng `components.bodyRecommendations.*` — vi trước,
  mirror en/de.

**Acceptance:** bấm pin chính → sheet hiện đủ 9 mục số liệu đúng với profile trong
Settings (đổi profile → số đổi theo); có disclaimer; 3 ngôn ngữ đầy đủ; `npm run verify` pass.

---

## WAVE 4 — Light/Dark theme (2 lượt Sonnet TUẦN TỰ: 4a hạ tầng → 4b refactor 32 file)

> Làm CUỐI CÙNG vì đụng cả 32 file dùng `colors` — tránh conflict với W1–W3.
> Ràng buộc kiến trúc (AGENTS.md): KHÔNG dùng React Context — theme đi qua Zustand
> `settingsStore` y như `language`.

### T4a — Hạ tầng theme (agent 1)
1. `src/lib/theme.ts`:
   - Đổi `export const colors` → `export const darkColors` (GIỮ NGUYÊN từng giá trị,
     kể cả `trendNutrition`/`trendEnergy` từ T1.4).
   - `export type ThemeColors = typeof darkColors;`
   - `export const lightColors: ThemeColors = { ... }` — palette sáng đề xuất
     (được phép tinh chỉnh nhẹ khi nhìn thực tế, giữ đúng ngữ nghĩa token):
     `bg #F5F5FA`, `bgCard #FFFFFF`, `bgElevated #E8E8F0`, `bgHighlight #EDF1FA`,
     `bgAlt #EFEFF5`; border `#CCC`/`#DDD`/`#D5D5E5`/divider `#E5E5EE`;
     text đảo bậc sáng→tối: `textPrimary #14142B`, `textBright #1E1E38`, `textLight
     #2A2A44`, `textSoft #3C3C55`, `textSecondary #55556E`, `textDim #666680`,
     `textTertiary #75758C`, `textSubtle #858599`, `textMuted #9595A8`, `textFaint
     #A5A5B5`, `textCool #8888A5`, `textPale #3A3A6E`;
     accent giữ `#FFB020`/`#6C5CE7` (đủ contrast nền trắng), `accentAltBg #E6E2FB`;
     `warning #C7900A` (vàng #FFD93D trên nền trắng không đọc được), `info/danger` giữ,
     `successBgSoft/warningBgSoft/dangerBgSoft` đổi alpha nền sáng (`#7ED95733` v.v. —
     chỉnh cho nhìn rõ); overdose: nền `#FBEFE7`, border `#E0B79E`, title `#C05621`,
     text `#8A5A3B`. `trendNutrition #2E7FE0`, `trendEnergy #D98A00` (đậm hơn cho nền trắng).
   - TẠM giữ `export const colors = darkColors;` để app còn compile trong lúc 4b refactor
     — 4b xóa dòng này ở bước cuối.
2. `src/store/settingsStore.ts`: thêm `themeMode: 'dark' | 'light'` (default `'dark'`)
   + `setThemeMode` — persist middleware tự lưu.
3. Hook mới `src/hooks/useThemeColors.ts`:
   ```ts
   export function useThemeColors(): ThemeColors  // đọc CHỈ themeMode từ settingsStore
   export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T
   // useMemo theo [factory, mode] — StyleSheet.create lại khi đổi theme là chấp nhận được
   ```
   Kèm `getCurrentThemeColors()` (non-React, mirror `getCurrentLanguage()` của i18n)
   nếu chỗ nào ngoài React cần màu — chỉ thêm khi thật sự có caller.
4. `App.tsx`: thêm `<StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />`
   (package `expo-status-bar` — kiểm tra đã có trong dependencies chưa, nếu chưa thì
   dùng `StatusBar` của react-native, KHÔNG cài mới); `NavigationContainer` nhận theme
   tùy mode (custom hóa từ `DarkTheme`/`DefaultTheme` của @react-navigation/native với
   token bg/card/text tương ứng).
5. `app.json` GIỮ `"userInterfaceStyle": "dark"` — app tự quản theme qua store, không
   theo hệ điều hành (đúng phạm vi user yêu cầu: một nút chỉnh sáng/tối trong app).
6. Settings UI: trong section GIAO DIỆN (`settings.interface`) thêm hàng chọn chủ đề:
   2 chip `🌙 Tối` / `☀️ Sáng` (pattern giống language selector hiện có). Key i18n mới
   `settings.interface.theme*` ×3 ngôn ngữ.

### T4b — Refactor 32 file sang hook (agent 2, chạy SAU khi 4a verify pass)
- Pattern chuẩn cho TỪNG file (thuần cơ học, KHÔNG đổi giá trị màu, không đổi layout):
  ```ts
  // trước:  import { colors } from '../lib/theme';
  //         const styles = StyleSheet.create({ box: { backgroundColor: colors.bgCard } });
  // sau:    import { type ThemeColors } from '../lib/theme';
  //         import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
  //         const createStyles = (c: ThemeColors) => StyleSheet.create({ box: { backgroundColor: c.bgCard } });
  //         trong component: const c = useThemeColors(); const styles = useThemedStyles(createStyles);
  //         mọi `colors.x` inline trong JSX → `c.x`
  ```
- Danh sách 32 file (lấy lại bằng `grep -rln "lib/theme" src/`): 22 file
  `src/components/*.tsx`, 3 file `src/components/food/` (PastDateField,
  CustomFoodFields, NutritionDetailSheet), `src/components/ui/BottomSheet.tsx`,
  5 screens, `src/navigation/AppNavigator.tsx`.
- Lưu ý case đặc biệt:
  - Module-level constants dùng colors (vd `TrendChart` NUTRIENT_COLOR, các mảng cấu
    hình) → chuyển thành lấy màu trong component hoặc hàm nhận `c: ThemeColors`.
  - Battery identity colors trong `lib/constants.ts` (`DEFAULT_BATTERIES`, màu từng
    loại pin) GIỮ NGUYÊN — là màu ngữ nghĩa dữ liệu, không phải chrome UI (comment đầu
    theme.ts đã nói rõ).
  - File helper không phải component (nếu có import colors) → nhận `ThemeColors` qua
    tham số.
- Bước cuối: xóa `export const colors = darkColors;` khỏi theme.ts, chạy
  `npm run verify` — tsc sẽ bắt mọi file còn sót.

**Acceptance wave 4:** Settings → GIAO DIỆN → bấm `☀️ Sáng`: TOÀN BỘ app (cả tab bar,
status bar, mọi màn) đổi nền trắng ngay lập tức, không cần restart; bấm `🌙 Tối` trở về
y hệt giao diện cũ (dark là default, pixel-tương-đương trước refactor); kill app mở lại
→ giữ lựa chọn; `npm run verify` pass.

---

## WAVE QA — agent `qa-reviewer` (sau W4, read-only)

Prompt cho qa-reviewer gồm:
1. Đối chiếu TỪNG acceptance criteria của W1–W4 ở trên với code thực tế.
2. Soát i18n: không chuỗi hardcode mới trong screens/components; key đủ 3 locale
   (tsc đã gác nhưng soát cả ngữ nghĩa bản dịch EN/DE có khớp VI không).
3. Soát ranh giới sức khỏe ở sheet khuyến nghị (W3): có disclaimer, không ngôn ngữ
   y lệnh/chẩn đoán.
4. Soát riêng W2 bước A/B: `logActivityForPastDate` có side effect nào lên "hôm nay"
   không (đọc diff energyStore kỹ).
5. Soát W4: file nào còn import `colors` tĩnh; light palette có token nào tương phản
   kém (text nhạt trên nền sáng).
6. Xuất **checklist test thủ công tiếng Việt** cho user chạy trên Expo Go (từng bước
   bấm gì, kỳ vọng thấy gì — bao gồm test gõ `79,4` và `79.4`).
Nếu qa-reviewer phát hiện lỗi: gọi lại Sonnet sửa (wave fix nhỏ) → verify → QA soát lại
phần sửa, RỒI mới sang Haiku.

---

## WAVE H — Haiku: docs + session log + commit + push

> Lưu ý orchestrator: Haiku hay "sáng tác" — prompt phải khóa chặt: *chỉ ghi những gì
> có trong plan này + `git diff`*, không tự bịa tính năng. Sau khi Haiku xong, user nên
> liếc `git log --stat` trước khi tin.

Nhiệm vụ tuần tự:
1. **Docs cập nhật** (quyền tự động theo AGENTS.md mục 5, không cần hỏi):
   - `docs/01-vision-and-features.md`: thêm các tính năng mới (Nạp/Xả rename, backfill
     3 ngày cho cả Nạp lẫn Xả, sheet khuyến nghị khi bấm pin chính, light/dark theme,
     fix bug nhập số dấu phẩy) — ghi rõ tất cả đã i18n-covered VI/EN/DE.
   - `docs/03-architecture.md`: mục mới "🎨 Theme sáng/tối" (cơ chế Zustand
     `themeMode` + `useThemeColors`/`useThemedStyles`, không Context, style-factory
     per-file; darkColors/lightColors trong `src/lib/theme.ts`); cập nhật mục Đa ngôn
     ngữ nếu có key section mới đáng nhắc; nhắc `parseDecimal` trong `lib/units.ts`
     là đường parse input thập phân bắt buộc từ nay.
   - `docs/HUONG-DAN-SU-DUNG-APP.md` (VI) + `docs/USER-GUIDE-DE.md` (DE): hướng dẫn
     dùng cho user cuối — 2 nút Nạp/Xả mới, cách ghi cho hôm qua/hôm kia/hôm kìa, bấm
     pin chính xem khuyến nghị, đổi chủ đề sáng/tối trong Cài đặt, ghi cân nặng nhận cả
     dấu phẩy. (2 file này hiện đang untracked — commit luôn cùng đợt docs.)
   - `docs/06-energy-expenditure.md`: bổ sung đoạn ngắn về `logActivityForPastDate`.
2. **Session log**: cập nhật `.ai/SESSION_LOG.md` theo format `.ai/skills/session-wrapup.md`.
3. **Commit** (đứng ở branch `ui-upgrade`, KHÔNG rebase/merge gì khác), tách 2 commit:
   - Commit 1 — toàn bộ code:
     `feat(ui): Nạp/Xả rename + backfill 3 ngày, sheet khuyến nghị dinh dưỡng, theme sáng/tối, fix parse dấu phẩy cân nặng`
   - Commit 2 — docs + session log (gồm cả 2 file docs untracked có sẵn):
     `docs: cập nhật hướng dẫn + kiến trúc cho round UI feedback 2026-07-17`
   - Message theo phong cách log hiện có của repo (tiếng Việt, conventional-commit
     prefix). Cuối message thêm dòng:
     `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
4. **Push**: `git push -u origin ui-upgrade` → user truy cập từ xa qua
   https://github.com/dangminhlk54paypal-netizen/Body-Batteries (branch `ui-upgrade`)
   để pull về máy khác / review và test qua Expo Go.
5. Báo cáo: hash 2 commit, kết quả push, danh sách file docs đã sửa.

---

## TRÌNH TỰ GỌI AGENT (cho orchestrator trong session này)

| # | Agent | subagent_type | Model | Nội dung prompt |
|---|-------|---------------|-------|------------------|
| 1 | W1 | `mobile-frontend` | sonnet | Khối QUY TẮC mục 0 + toàn văn WAVE 1 + phần "KẾT QUẢ DEBUG" |
| 2 | W2 | `logic-backend` | sonnet | Khối QUY TẮC mục 0 + toàn văn WAVE 2 (bắt buộc bước A điều tra trước) |
| 3 | W3 | `mobile-frontend` | sonnet | Khối QUY TẮC mục 0 + toàn văn WAVE 3 (bảng số liệu + nguồn đã cho sẵn) |
| 4 | W4a | `mobile-frontend` | sonnet | Khối QUY TẮC mục 0 + T4a |
| 5 | W4b | `mobile-frontend` | sonnet | Khối QUY TẮC mục 0 + T4b (chỉ chạy khi 4a verify pass) |
| 6 | QA | `qa-reviewer` | (mặc định) | Toàn văn WAVE QA + acceptance criteria các wave |
| 7 | H | `claude` | haiku | Toàn văn WAVE H, khóa phạm vi "chỉ ghi theo plan + diff" |

- **TUẦN TỰ tuyệt đối** — không chạy song song 2 agent trên cùng working tree
  (bài học cũ: agent song song revert việc của nhau dù không trùng file).
- Giữa mỗi wave: orchestrator/user chạy `git diff --stat` đối chiếu báo cáo của agent
  vừa xong; thấy file lạ bị đổi → dừng, điều tra trước khi tiếp.
- Sau QA pass → Haiku. Sau Haiku → user test trên Expo Go theo checklist QA.

# Kế hoạch — Nhập dinh dưỡng theo 100g HOẶC theo khẩu phần (2026-09-23)

> **Trạng thái: ĐÃ LÀM (2026-09-23, Session 30) — code + test đơn vị xong, CHỜ NGƯỜI DÙNG TEST MÁY THẬT (mục 4).**
> `tsc`/`eslint` sạch; `customFoodInput.test.ts` 77 test xanh. `npm run verify` toàn bộ chưa xanh vì 13 test
> `energyStore*` fail do công việc satiety dở dang của phiên khác (không thuộc kế hoạch này). Chưa commit.
> Sai khác so với kế hoạch: `buildCustomFoodItem` dùng `servingSizeOf(input)` (không clamp) làm mốc quy đổi thay vì
> `defaultServingG` đã clamp — để số lưu = số xem trước = số validate ở khẩu phần < 1 g.
> Bổ sung ngoài kế hoạch: `changePortionUnit` tự đặt basis mặc định (đếm→`perServing`, cân→`per100`) **chỉ khi chưa
> gõ số nào** — giữ hành vi cũ của luồng TPCN ("Viên = số theo viên") để khỏi đọc nhầm 9 kcal/viên thành 9 kcal/100 g.
> Nhánh: `ui-upgrade`. Expo SDK 57 (KHÔNG nâng/hạ SDK). Mọi text UI đi qua `useT()` + 3 locale
> (xem `AGENTS.md` — bắt buộc).

## Phản hồi gốc của người dùng

> "Mỗi lần nhập món vào, users thường sẽ nhập vào thành phần đồ ăn theo dạng 100 gram, và khẩu
> phần ăn là x gram gì đó sẽ nhân thêm 100g này. Nên có 2 hướng nhập vào: 1 là nhập hoàn toàn
> theo khẩu phần, 2 là nhập theo 100 gam sau đó sẽ điền khẩu phần vào và sẽ tự tính toán lại
> theo khẩu phần ăn."

---

## 1. Chẩn đoán — hiện trạng

Form "Thêm món mới" / "Sửa thành phần" (`src/components/food/CustomFoodFields.tsx`, dùng chung
cho `FoodLogModal` và `FoodNutritionEditModal`) đang **gộp 2 câu hỏi khác nhau thành 1**:

| Câu hỏi | Hiện đang quyết định bởi |
|---|---|
| (a) Món này **đếm** thế nào? (cân gram / gói / viên / hộp…) | chip `portionUnit` |
| (b) Số dinh dưỡng tôi đang gõ là **trên 100g hay trên 1 khẩu phần**? | CŨNG chip `portionUnit` (ngầm) |

Luật ngầm trong `buildCustomFoodItem` (`src/domain/food/customFoodInput.ts`):
- `portionUnit === 'gram'` → số gõ vào **luôn là /100g**. Không có cách nhập "1 tô phở 350g = 450 kcal".
- `portionUnit` là gói/viên/khẩu phần → số gõ vào **luôn là /1 khẩu phần**. Không có cách nhập
  "nhãn ghi /100g, nhưng tôi ăn theo hộp 180g".
- Không có bản xem trước: nhập /100g xong người dùng không thấy 1 khẩu phần ra bao nhiêu kcal.
- Đổi chip đơn vị → `resetNutritionForUnitChange` **xoá sạch** số đã gõ (FIX #1 cũ — hợp lý khi
  đơn vị ngầm đổi luôn cơ sở tính; sẽ không còn cần khi cơ sở tính tách riêng).

Phía **ghi món** (`FoodLogModal`, chế độ đã chọn món) đã đúng: lưu chuẩn `per100g`, nhân theo
gram (`nutritionForGrams`) hoặc theo số khẩu phần (`gramsForPortion`). **Không cần sửa luồng ghi món.**

## 2. Giải pháp

Tách (b) thành một lựa chọn riêng, **chỉ tồn tại trong form** (không lưu DB):

```
Nhập dinh dưỡng theo:   [ 100g ]  [ 1 khẩu phần (350g) ]
```

- **Theo 100g** (mặc định cho món mới): gõ đúng số in trên nhãn "/100g". Khi đã có kích cỡ khẩu
  phần, hiện ô xem trước: *"≈ 1 khẩu phần (350g): 450 kcal · Đạm 20g · Béo 15g · Carbs 55g"*.
- **Theo khẩu phần**: gõ tổng dinh dưỡng của 1 khẩu phần; app tự quy về /100g để lưu. Ô xem trước
  hiện chiều ngược lại: *"≈ Mỗi 100g: 128,6 kcal · …"*.
- **Đổi qua lại giữa 2 chế độ QUY ĐỔI số đã gõ** (không xoá) khi đã có kích cỡ khẩu phần > 0.
  Chưa có kích cỡ → không quy đổi được → xoá các ô dinh dưỡng (giữ tinh thần FIX #1).
- Cơ sở tính **trực giao** với đơn vị đếm: món cân gram vẫn nhập được theo khẩu phần; món đếm theo
  hộp vẫn nhập được theo /100g.

### Quyết định thiết kế (đã chốt — không bàn lại)
1. **KHÔNG thêm field vào `FoodItem`, KHÔNG migration.** Lưu trữ vẫn chỉ là `per100g` chuẩn.
   Lý do: tránh bẫy "FoodItem field join points" (phải vá `getAnyFoodById` merge +
   `FoodNutritionEditModal` edit + mappers/schema/migration + backup JSON). Khi mở lại để sửa, chế độ
   được **suy ra** (xem `inputFromFoodItem` bên dưới) và người dùng đổi được bằng 1 chạm vì quy đổi
   không mất dữ liệu.
2. "Kích cỡ 1 khẩu phần" dùng lại field sẵn có:
   - món cân gram → `defaultServingG` ("Khẩu phần mặc định")
   - món đếm (gói/viên/khẩu phần…) → `servingWeightG` ("Kích cỡ 1 hộp")
3. `nutritionBasisLabel()` trong `portionUnits.ts` **giữ nguyên chữ ký** (MyFoodsSheet dùng nó cho
   `FoodItem`). Thêm helper mới cho form.
4. Logic nằm trong domain thuần (`customFoodInput.ts`), view chỉ gọi hàm — đúng luật repo.

---

## 3. Công việc — theo thứ tự

### W1 — Domain: `src/domain/food/customFoodInput.ts`

1. Thêm kiểu (export):
   ```ts
   // Which scale the nutrition numbers in the form are typed on. Form-only —
   // never stored: FoodItem always keeps canonical per100g.
   export type NutritionBasis = 'per100' | 'perServing';
   ```
2. `CustomFoodInput` thêm `nutritionBasis: NutritionBasis`. `EMPTY_CUSTOM_FOOD_INPUT.nutritionBasis = 'per100'`.
   Sửa comment các field dinh dưỡng ("Per-100g macros … or per-serving when portionUnit is
   pack/capsule") → nói theo `nutritionBasis`.
3. Hằng `NUTRITION_KEYS` (15 khoá: energyKcal, waterG, proteinG, fatG, carbG, fiberG, sugarG,
   calciumMg, ironMg, sodiumMg, potassiumMg, magnesiumMg, zincMg, epaMg, dhaMg) — dùng chung cho
   clear/convert thay vì liệt kê tay nhiều lần.
4. `export function servingSizeOf(input: CustomFoodInput): number` — kích cỡ 1 khẩu phần đã parse:
   `isPortionCounted(input.portionUnit) ? parseNonNegative(servingWeightG) : parseNonNegative(defaultServingG)`.
   Trả 0 nếu trống/không hợp lệ. **Không** fallback 100 ở đây.
5. `formatInputNumber(n: number): string` (nội bộ) — bỏ nhiễu dấu phẩy động:
   `String(Number(n.toPrecision(6)))` (609.9999999 → "610", 128.5714285 → "128.571").
6. `export function changeNutritionBasis(input, next: NutritionBasis): CustomFoodInput`
   - `next === input.nutritionBasis` → trả nguyên `input`.
   - `size = servingSizeOf(input)`; nếu `size > 0`: với từng ô trong `NUTRITION_KEYS` — ô trống giữ
     trống; ô có số → nhân `size/100` (per100 → perServing) hoặc `100/size` (ngược lại), format bằng
     `formatInputNumber`. Parse bằng `parseDecimal` (chấp nhận "12,5").
   - nếu `size <= 0`: xoá trắng toàn bộ `NUTRITION_KEYS` (không quy đổi được → không đoán).
   - Luôn set `nutritionBasis: next`.
7. **Thay** `resetNutritionForUnitChange` bằng `export function changePortionUnit(input, next: PortionUnit)`:
   - Giữ quy tắc `servingLabel` hiện có (chỉ giữ khi `next === 'serving'`).
   - **Không xoá số dinh dưỡng nữa** — ý nghĩa của chúng giờ do `nutritionBasis` quyết định, không đổi khi đổi đơn vị.
   - Mang kích cỡ khẩu phần sang ô tương ứng để chế độ "theo khẩu phần" không mất mốc:
     gram → đếm: nếu `servingWeightG` trống thì `servingWeightG = defaultServingG`;
     đếm → gram: nếu `servingWeightG` > 0 thì `defaultServingG = servingWeightG`.
     Đếm → đếm (gói → viên…): giữ `servingWeightG`.
   - Xoá mọi tham chiếu `resetNutritionForUnitChange` (2 modal + test). Viết lại comment "FIX #1"
     giải thích vì sao không còn cần xoá.
8. `export function applyCustomFoodChange<K extends keyof CustomFoodInput>(prev, key: K, value): CustomFoodInput`
   — bộ điều phối dùng chung cho CẢ HAI modal (hiện mỗi modal tự viết `set`/`updateCustomField`):
   `portionUnit` → `changePortionUnit`; `nutritionBasis` → `changeNutritionBasis`; còn lại `{...prev, [key]: value}`.
9. `isValidCustomFoodInput`: giữ các luật cũ, thêm: `nutritionBasis === 'perServing'` → bắt buộc
   `servingSizeOf(input) > 0` (với món gram nghĩa là `defaultServingG` phải là số dương thật, không dựa vào fallback 100).
   Luật cũ "món đếm cần `servingWeightG > 0`" giữ nguyên, **không** phụ thuộc basis (cần cho quy đổi số lượng → gram khi ghi món).
10. `buildCustomFoodItem`: tách 2 khái niệm hiện đang dính trong `useServingConversion`:
    ```ts
    const portionCounted = isPortionCounted(input.portionUnit) && servingWeightG > 0; // metadata đếm
    const servingSize = portionCounted ? servingWeightG : defaultServingG;             // mốc quy đổi
    const per100g = input.nutritionBasis === 'perServing' && servingSize > 0
      ? scalePerServingToPer100g(enteredNutrition, servingSize)
      : enteredNutrition;
    ```
    `portionUnit`/`servingWeightG`/`servingLabel` trả về dựa trên `portionCounted` (như `useServingConversion` cũ).
    Chú ý: `defaultServingG` ở đây là giá trị đã clamp (`Math.max(1, … || 100)`) — hợp lệ vì validate đã chặn
    trường hợp perServing mà ô trống. Luật carb ≥ đường + xơ vẫn tính trên số gõ vào, TRƯỚC quy đổi (giữ nguyên).
11. `inputFromFoodItem`: suy ra `nutritionBasis = isServingBased ? 'perServing' : 'per100'` (giữ đúng
    hành vi hiện tại: món đếm mở ra ở dạng /khẩu phần, món gram ở dạng /100g). Thay `String(n)` bằng
    `formatInputNumber` cho các số dinh dưỡng để không hiện "609.9999999".
12. `export function nutritionPreview(input): NutritionPreview | null` — dữ liệu cho ô xem trước:
    ```ts
    export interface NutritionPreview {
      target: NutritionBasis;     // phía được TÍNH RA (ngược với input.nutritionBasis)
      servingSize: number;        // theo measureUnit
      energyKcal: number; proteinG: number; fatG: number; carbG: number; // đã làm tròn 1 chữ số
    }
    ```
    Trả `null` khi `servingSizeOf(input) <= 0` hoặc kcal trống/không hợp lệ. carbG áp cùng luật
    `max(carb, sugar + fiber)` như `buildCustomFoodItem` để xem trước khớp số sẽ lưu.
13. `export function formBasisLabel(input, language): string` — nhãn hậu tố cho ô nhập & phụ đề modal:
    - `per100` → `100g` / `100ml` (theo `measureUnit`)
    - `perServing` + món đếm → `formatPortionCount(1, portionUnit, servingLabel, language)` ("1 hộp")
    - `perServing` + món gram → `translate(language, 'units.portion.countFormat', {count: '1', unit: translate(language,'units.portion.serving')})` ("1 khẩu phần")
    Domain nhận `language` tường minh — KHÔNG đọc store.

### W2 — UI: `src/components/food/CustomFoodFields.tsx`

1. `unitSuffix()` dùng `formBasisLabel(input, language)` thay `nutritionBasisLabel(...)`.
2. Sau khối "kích cỡ khẩu phần / khẩu phần mặc định" và TRƯỚC các ô macro, thêm:
   - Nhãn `t('components.customFoodFields.basisLabel')`
   - 2 chip (tái dùng style `unitRow`/`unitChip`/`unitChipActive`):
     - `per100` → `t('…basisOptionPer100', { measure: input.measureUnit })`
     - `perServing` → `t('…basisOptionPerServing', { unit: <"hộp" hoặc "khẩu phần"> })`; nếu `servingSizeOf(input) > 0`
       thêm kích cỡ: dùng `basisOptionPerServingSized` với `{ unit, measure: formatMeasure(size, measureUnit) }`.
   - `onPress` → `onChange('nutritionBasis', key)` (modal chuyển qua `applyCustomFoodChange`).
   - Dòng gợi ý dưới chip (style `unitNote`): `basisHintPer100` hoặc `basisHintPerServing`.
   - Nếu `perServing` và `servingSizeOf(input) <= 0`: dòng cảnh báo `basisNeedsServingSize` (lý do nút Lưu bị mờ).
3. Ô xem trước (ngay sau ô Carbs/khối đường-xơ, trước ô Nước — hoặc cuối khối macro, chọn chỗ dễ nhìn):
   gọi `nutritionPreview(input)`; `null` → không render. Tiêu đề:
   - `target === 'perServing'` → `previewPerServingTitle` `{ serving: formBasisLabel(...perServing...), measure: formatMeasure(size) }`
   - `target === 'per100'` → `previewPer100Title` `{ measure: input.measureUnit }`
   Dòng số: `previewLine` `{ kcal, protein, fat, carb }`. Số hiển thị: `toLocaleString(LOCALE_TAGS[language], { maximumFractionDigits: 1 })`
   (luật i18n: không hardcode định dạng số). Style: khung nhẹ `bgElevated` + viền `accent` mỏng, chữ 13.
4. Cập nhật chuỗi `servingLabelHint` (vì giờ không bắt buộc nhập theo 1 hộp nữa) — xem W4.
5. Lưu ý ESLint hook (`react-hooks/purity`, `react-hooks/set-state-in-effect`): component này không
   có state; chỉ tính toán thuần trong render — không thêm `useEffect`.

### W3 — Hai modal gọi form

`src/components/FoodLogModal.tsx` và `src/components/FoodNutritionEditModal.tsx`:
1. Thay thân `updateCustomField` / `set` bằng `setX((prev) => applyCustomFoodChange(prev, key, value))`.
   Bỏ import `resetNutritionForUnitChange`.
2. Phụ đề (`addCustomSubtitle` / `subtitleAdd`): thay `nutritionBasisLabel(...)` bằng `formBasisLabel(input, language)`.
   Bỏ import `nutritionBasisLabel` nếu không còn dùng.
3. `FoodNutritionEditModal` nhánh `mode === 'edit'`: KHÔNG cần đổi (không thêm field `FoodItem`).
   Kiểm tra lại: `built.per100g` đã quy đổi đúng theo basis → override đúng.
4. Luồng ghi món sau khi lưu (`pickFood(item)` → ô gram mặc định = `defaultServingG`): không đổi. Món gram
   nhập "theo khẩu phần 350g" → ô gram tự điền 350 → ghi 1 chạm. Xác nhận bằng test tay.

### W4 — i18n (bắt buộc cả 3 file; `vi.ts` TRƯỚC)

Thêm vào `components.customFoodFields` (dịch giữ nghĩa, được chỉnh câu chữ cho tự nhiên):

| key | vi | en | de |
|---|---|---|---|
| `basisLabel` | Nhập dinh dưỡng theo | Enter nutrition per | Nährwerte eingeben pro |
| `basisOptionPer100` | 100{{measure}} | 100{{measure}} | 100{{measure}} |
| `basisOptionPerServing` | 1 {{unit}} | 1 {{unit}} | 1 {{unit}} |
| `basisOptionPerServingSized` | 1 {{unit}} ({{measure}}) | 1 {{unit}} ({{measure}}) | 1 {{unit}} ({{measure}}) |
| `basisHintPer100` | Gõ đúng số trên nhãn "/100{{measure}}". App tự nhân theo khẩu phần khi ghi món. | Type the "per 100{{measure}}" figures from the label. The app scales them to your portion when logging. | Gib die Werte „pro 100{{measure}}" vom Etikett ein. Die App rechnet beim Eintragen auf deine Portion um. |
| `basisHintPerServing` | Gõ tổng dinh dưỡng của 1 khẩu phần. App tự quy về /100{{measure}} để lưu. | Type the totals for one portion. The app converts them to per 100{{measure}} for storage. | Gib die Summe für eine Portion ein. Die App rechnet sie zum Speichern auf 100{{measure}} um. |
| `basisNeedsServingSize` | Nhập kích cỡ khẩu phần ở trên để lưu theo khẩu phần. | Enter the portion size above to save per portion. | Gib oben die Portionsgröße ein, um pro Portion zu speichern. |
| `previewPerServingTitle` | ≈ {{serving}} ({{measure}}): | ≈ {{serving}} ({{measure}}): | ≈ {{serving}} ({{measure}}): |
| `previewPer100Title` | ≈ Mỗi 100{{measure}}: | ≈ Per 100{{measure}}: | ≈ Pro 100{{measure}}: |
| `previewLine` | {{kcal}} kcal · Đạm {{protein}}g · Béo {{fat}}g · Carbs {{carb}}g | {{kcal}} kcal · Protein {{protein}}g · Fat {{fat}}g · Carbs {{carb}}g | {{kcal}} kcal · Eiweiß {{protein}}g · Fett {{fat}}g · KH {{carb}}g |

Sửa chuỗi cũ (cả 3 locale): `servingLabelHint` bỏ ý "nhập dinh dưỡng cho đúng 1 hộp" → vd vi:
*"Ví dụ hộp Yakult 65ml: gõ "hộp", chọn đơn vị đo ml, nhập kích cỡ 65 — rồi chọn nhập dinh dưỡng theo 100ml hoặc theo 1 hộp tuỳ nhãn."*

Kiểm tra `de.ts` hiện đang dùng dấu ngoặc kép nào cho chuỗi — nếu chuỗi chứa „…" phải escape/đổi quote cho hợp lệ TS.
`npx tsc --noEmit` phải báo lỗi nếu thiếu key ở en/de — KHÔNG dùng `as const`/`any`/partial để lách.

### W5 — Test: `src/domain/food/__tests__/customFoodInput.test.ts` (+ `portionUnits.test.ts` nếu đụng)

Viết/đổi các test sau (TDD: viết trước khi sửa code domain):
- `changeNutritionBasis`
  - per100 → perServing với `defaultServingG '350'`, kcal '100' → '350'; ô trống giữ trống; "12,5" parse đúng.
  - perServing → per100 với serving 350, kcal '450' → '128.571'.
  - khứ hồi per100 → perServing → per100 trả về số ban đầu (sai số ≤ 1e-3).
  - món đếm dùng `servingWeightG`, không dùng `defaultServingG`.
  - size = 0/trống → xoá trắng mọi ô dinh dưỡng, basis vẫn đổi.
  - cùng basis → trả nguyên object.
- `changePortionUnit` (thay cho các test `resetNutritionForUnitChange`)
  - **giữ** số dinh dưỡng khi đổi đơn vị.
  - gram → capsule: `servingWeightG` trống được lấy từ `defaultServingG`; không ghi đè nếu đã có.
  - capsule → gram: `defaultServingG` lấy từ `servingWeightG`.
  - quy tắc `servingLabel` cũ (giữ khi ở 'serving', xoá khi đổi sang đơn vị khác) vẫn đúng.
- `buildCustomFoodItem`
  - gram + perServing (350g, 450 kcal) → `per100g.energyKcal ≈ 128.571`, `portionUnit 'gram'`, `defaultServingG 350`.
  - serving 'hộp' 180g + **per100** (kcal 70) → `per100g.energyKcal === 70` (không quy đổi), `servingWeightG 180`, `portionUnit 'serving'`.
  - các test pack/capsule cũ: thêm `nutritionBasis: 'perServing'` vào input fixture để giữ nguyên kỳ vọng.
- `isValidCustomFoodInput`
  - gram + perServing + `defaultServingG ''` → false; `'350'` → true.
  - gram + per100 + `defaultServingG ''` → true (hành vi cũ, fallback 100 khi lưu).
- `inputFromFoodItem`: món đếm → `'perServing'`; món gram → `'per100'`; không còn chuỗi kiểu "609.9999999".
  Các test round-trip cũ vẫn phải pass.
- `nutritionPreview`: null khi thiếu size/kcal; per100 → target perServing với số đã nhân; carb áp luật sugar+fiber.
- `formBasisLabel`: 4 tổ hợp (per100 g/ml, perServing đếm "1 hộp", perServing gram "1 khẩu phần") với `'vi'`.

### W6 — Kiểm tra & tài liệu

1. `npm run verify` (typecheck + lint + test) phải pass hoàn toàn. Nếu fail: báo nguyên văn output, không lách.
2. `grep -rn "resetNutritionForUnitChange" src` → phải rỗng.
3. Docs (theo `AGENTS.md` §5 + `.ai/skills/session-wrapup.md`): cập nhật `docs/07-food-log.md` (mục thêm món
   tự tạo: 2 chế độ nhập, quy đổi, xem trước, không lưu basis), `docs/HUONG-DAN-SU-DUNG-APP.md` +
   `docs/USER-GUIDE-DE.md` (hướng dẫn người dùng), ghi session vào `.ai/SESSION_LOG.md`, ghi rõ "i18n-covered (vi/en/de)".
   Đổi dòng trạng thái đầu file kế hoạch này thành ĐÃ LÀM.

---

## 4. Checklist test tay trên iPhone (Expo Go) — cho người dùng

1. Thêm món → mặc định "Theo 100g". Gõ kcal 100, đạm 10; khẩu phần mặc định 250 → ô xem trước hiện ≈ 250 kcal · Đạm 25g.
2. Bấm chip "1 khẩu phần (250g)" → các ô tự đổi thành 250 / 25. Bấm lại "100g" → về 100 / 10.
3. Tạo "Phở bò" theo khẩu phần: khẩu phần mặc định 350, chế độ "1 khẩu phần", kcal 450 → Lưu → màn ghi món
   tự điền 350g → Ghi → pin năng lượng +450 kcal (±1).
4. Tạo "Sữa chua uống" đếm theo "Khẩu phần… → hộp", đo ml, kích cỡ 180, chế độ "100ml", kcal 70 → xem trước
   ≈ 126 kcal / 1 hộp → Lưu, ghi 1 hộp → +126 kcal.
5. Chọn chế độ "1 khẩu phần" nhưng để trống kích cỡ → có dòng nhắc, nút Lưu mờ.
6. Đổi chip đơn vị Gram ↔ Viên khi đã gõ số → số KHÔNG bị xoá; kích cỡ được mang sang.
7. "Sửa thành phần" một món TPCN cũ (vd. dầu cá) → mở ở chế độ "1 viên" với đúng số cũ, không có số lẻ dài.
8. Đổi ngôn ngữ sang English / Deutsch → toàn bộ nhãn, gợi ý, ô xem trước đều dịch; số dùng dấu thập phân đúng locale.

## 5. Ngoài phạm vi (không làm lần này)

- Lưu `nutritionBasis` vào `FoodItem` để mở lại đúng chế độ đã nhập với món gram (cần migration + vá 3 điểm
  nối `getAnyFoodById`/edit-modal/mappers — xem memory "FoodItem field join points"). Chỉ làm nếu người dùng
  phàn nàn khi sửa lại món gram đã nhập theo khẩu phần.
- Thay đổi màn ghi món (`FoodLogModal` chế độ đã chọn món) — đã đúng.
- Sửa dữ liệu catalog CSV/USDA — luôn là /100g, không liên quan.

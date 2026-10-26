# Kế hoạch: Nhập kết quả AI bên ngoài · Kể lại nhiều ngày · Món ghép (mẫu → bát → tên)

- **Ngày lập:** 2026-10-26 (sau Session 73–74)
- **Trạng thái:** đã được chủ app duyệt hướng đi. Một số điểm còn chờ chốt (mục 8). **Phải hỏi các điểm đó trước khi code.**
- **Người thực thi:** một session mới, đọc file này từ đầu đến cuối trước khi bắt tay.

---

## 1. Yêu cầu của chủ app (đã gộp và viết lại)

> App **không tích hợp AI**. Người dùng có thể nhờ AI bên ngoài (ChatGPT, Gemini, Claude…) phân tích món ăn từ ảnh
> hoặc từ số liệu có sẵn, rồi đưa kết quả vào app. App là **engine phân tích quá trình ăn uống và tập luyện**: nó nhận
> dữ liệu, cập nhật bộ tính toán và chạy ra kết quả.
>
> 1. **Câu lệnh nhất quán cho AI bên ngoài.** Có sẵn một câu lệnh chuẩn, dùng cho cả ảnh bữa ăn lẫn số liệu có sẵn
>    (nhãn, bảng dinh dưỡng). AI trả lời theo **một định dạng cố định** mà app đọc được ngay. Mỗi lần dùng đều như nhau
>    nên làm nhanh.
> 2. **Tách hai nguồn:** (A) **món do AI bên ngoài phân tích** rồi đưa vào app, và (B) **phần app tự phân tích** khi
>    người dùng kể trực tiếp vào app (gõ hoặc nói). Hai nguồn tách bạch về lối vào, về code và về nơi lưu.
> 3. **Món ghép, linh hoạt theo từng lần ăn.** Một món như phở mỗi lần một khác: nhiều thịt, nhiều rau, ít nước dùng…
>    Luôn có **mẫu** (template) khi nhập để người dùng chọn hoặc chỉnh. **Tên món tự đổi** theo hàm lượng thành phần
>    thật trong bát ("Phở bò · nhiều thịt, ít nước"). **Mẫu đầu tiên: phở bò.**
> 4. **Thành phần AI tách ra:** thành phần nào khớp kho của app thì **dùng số của kho**. Chỉ thành phần lạ mới dùng số
>    /100 g của AI.
> 5. **Bộ giải thông minh cho lời kể mơ hồ hoặc nói nhầm.** App truy từ khoá để nắm được ăn gì, lúc nào, bao nhiêu.
> 6. **Kể bù những ngày bận.** Ví dụ T7, CN không nhập được: thứ Hai đọc giọng nói (voice-to-text) kể lại chuyện ăn
>    uống, tập luyện, cả **suy nghĩ và cảm nhận sức khoẻ trong tuần**. App phân tích từng mục và tự điền vào engine.
>    Mục tiêu là người **không rành app hoặc lười** vẫn dùng được: chỉ kể, app lo phần còn lại.
> 7. **Đa ngôn ngữ:** chạy đúng ở vi/en/de ngay bây giờ, và đi đúng hướng để sau này thêm tiếng Pháp, Trung.

---

## 2. Điểm xuất phát: code đang có (kiểm tra lại bằng `git log` / `git status` trước khi làm)

| Phần | Trạng thái | File chính |
|---|---|---|
| ⌨️ Nạp bằng chữ: gõ, 🎤 bàn phím, 📤 Hỏi AI + 📋 Dán | Đã commit (Session 70) | `src/domain/food/mealText/*`, `src/components/food/TextMealEntry.tsx` |
| 🤖 Dán dinh dưỡng từ AI: JSON `per_100g` + chữ thường vi/en/de, chọn **Số app / Số AI / ＋ Món mới**, 💾 Lưu | Đã commit `37987dd` (Session 73) | `mealText/aiNutrition.ts`, `AiRow` + `aiSavePlan` trong `mapMealText.ts` |
| ⌨️ 🎤 **Kể cả ngày** (một ngày, món vào Nạp, tập vào Xả) | **Session 74 của phiên khác, chưa commit lúc lập kế hoạch** | `src/domain/dayText/parseDayText.ts`, `src/domain/energy/activityText/*`, `EnergyActionsBar.tsx` |
| Ghi bù ngày cũ | Tối đa **3 ngày** (`BACKFILL_MAX_DAYS_BACK`, chủ app chốt 2026-07-17) | `lib/constants.ts`, `logFoodForPastDate` / `logActivityForPastDate` |
| Nhật ký (Diary) | Có, mã hoá **yếu** (XOR, đã nằm trong danh sách việc trước khi lên store) | `screens/DiaryScreen.tsx`, `lib/encryption.ts` |
| Món ghép / công thức | **Chưa có.** "Phở bò" là một dòng /100 g cố định (`dish_pho_bo`, 90 kcal/100 g, bát 500 g) | `food_items.csv` |
| Thành phần phở trong kho | Có `rice_noodle_pho` (bánh phở chín), `beef_lean` (thịt bò nạc chín), `bean_sprouts` (giá). **Thiếu** nước dùng phở, rau thơm, hành; thiếu cách phân biệt bò tái / chín / nạm / gầu | `food_items.csv` |

**Lỗi đa ngôn ngữ đã biết** (tìm ra trong Session 73, chưa sửa):

1. App ở tiếng Đức: món mới từ AI hiện **tên tiếng Anh**. Nguyên nhân: `custom_foods` không có cột `name_de`,
   `customFoodMapper` luôn để `nameDe = ''`, còn `foodDisplayName('de')` lấy `nameDe → nameEn → nameVi`. Tên tiếng
   Đức đang bị cất nhầm vào `nameVi`.
2. Dấu phân cách hàng nghìn: "1.046 kJ" (de) và "1,046 kJ" (en) bị đọc thành 1,046. "Natrium 1.200 mg" bị đọc thành
   1,2 mg. Lỗi nằm ở `numberIn` / `energyIn` trong `aiNutrition.ts`. Cảnh báo `aiCheck` không bật.
3. Mẫu JSON nằm **trong chuỗi dịch** `components.textMealEntry.aiPrompt` của từng ngôn ngữ. Người dịch lỡ dịch tên
   khoá là gãy, và không có test nào bắt được.

---

## 3. Quy tắc bắt buộc (tóm tắt từ AGENTS.md và memory, đọc bản gốc khi cần)

- **Không AI trong app, không gửi dữ liệu ra ngoài.** Chỉ dùng share sheet (người dùng tự gửi) và clipboard (người
  dùng tự dán). Không backend, không tài khoản, không SDK phân tích hành vi.
- **i18n:** không có chữ cứng trong UI. Thêm khoá vào `vi.ts` trước, rồi `en.ts`, `de.ts`. Code thuần nhận
  `language` qua tham số. Khoá ghép động (`notes.${issue}`) phải có test riêng, như `textMealEntryKeys.test.ts`.
- **Giao diện gọn:** đọc `.ai/skills/mobile-ui-density.md`. Gập theo tầng, ⓘ / ✎ / ＋, hàng nút bằng nhau, kiểm tra
  độ rộng bằng **tiếng Đức**. Mẫu màn duyệt: `TextMealEntry` (§7b).
- **Ghi luôn là Insert:** không gộp, không ghi đè. Dòng trùng được giải thích rõ và để **bỏ tick** sẵn.
- **Nghiên cứu có trích dẫn:** số gram thành phần của mẫu phở và số dinh dưỡng của thành phần mới (nước dùng…)
  **không được tự đoán**. Phải làm báo cáo `docs/nghien-cuu/` theo `.ai/skills/research-report.md` (nguồn chính, `[n]`,
  URL, ngày truy cập).
- **Thêm trường cho FoodItem** phải sửa đủ các chỗ nối: `getAnyFoodById` (merge), nhánh edit của
  `FoodNutritionEditModal`, mapper + `schema.ts` + migration, `myFoodsBackup.ts`. Xem memory
  `fooditem-field-join-points`.
- **Tree dùng chung:** không bao giờ `git stash` / `git reset` / `git add -A`. Trước khi sửa `mealText/*`,
  `TextMealEntry.tsx`, `EnergyActionsBar.tsx`, `dayText/*`, `activityText/*` hoặc các file dịch: chạy `ListAgents` và
  nhắn phiên đang làm "Kể cả ngày" nếu nó còn chạy.
- **Kết thúc mỗi đợt:** `npm run verify` xanh, publish EAS nhánh `preview` (skill `eas-preview-publish`), thêm mục thử
  vào `docs/KIEM-TRA-TREN-MAY.md`, ghi `.ai/SESSION_LOG.md`, cập nhật `docs/03-architecture.md` / `docs/07-food-log.md`.
  Mẫu giao diện mới được chủ app duyệt thì ghi vào `mobile-ui-density.md`.

---

## 4. Thiết kế

### 4.1 Hai nguồn tách bạch

| | **(A) Kết quả AI bên ngoài** | **(B) App tự phân tích lời kể** |
|---|---|---|
| Ai phân tích | ChatGPT / Gemini / Claude… do người dùng tự hỏi | Bộ giải thuần trên máy (luật + từ khoá + lịch sử của người dùng) |
| Lối vào | **📤 Câu lệnh AI** (chọn: ảnh bữa ăn / nhãn và số liệu / tách món) → **📋 Dán kết quả AI** | **🎙️ Kể lại** (mở rộng "Kể cả ngày"), ⌨️ Nạp bằng chữ |
| Định dạng vào | **Hợp đồng cố định `bb.food.v1`** (mục 4.2). Chữ thường là đường phụ | Câu tự nhiên vi/en/de, có thể nhầm hoặc mơ hồ |
| Code | `src/domain/food/aiImport/*` (tách khỏi `mealText`; chuyển `aiNutrition.ts` sang đây) | `src/domain/dayText/*`, `mealText/*`, `activityText/*`, `feelingText/*` (mới) |
| Nơi lưu món mới | Nhóm riêng **"🤖 Từ AI"**, giữ nguồn gốc (`origin: 'ai'`) để xem, sửa, xoá riêng và để engine biết đây là ước tính | Không tạo món mới. Chỉ khớp kho, mẫu, món của tôi và từ điển cá nhân |
| Màn duyệt | Chung khuôn `TextMealEntry` / màn duyệt theo ngày | Chung khuôn |

💡 **Lý do tách:** số của AI là *ước tính của bên thứ ba*, còn lời kể là *dữ kiện của chính người dùng*. Tách ra
thì có thể xem, xoá hoặc so độ chính xác của từng nguồn, và engine phân tích xu hướng biết dòng nào kém chắc chắn
hơn.

### 4.2 Hợp đồng `bb.food.v1`: một định dạng cho mọi câu lệnh AI

- **Mẫu JSON là hằng số trong code** (ví dụ `src/domain/food/aiImport/aiContract.ts`), **không nằm trong file dịch**.
  File dịch chỉ chứa lời dặn ("Hãy xem ảnh…").
- Câu lệnh gửi đi = lời dặn (theo ngôn ngữ app) + khối JSON mẫu (cố định) + **"Chỉ trả lời bằng JSON đúng mẫu"**.
- **Ba biến thể câu lệnh, cùng một định dạng trả về:**
  1. **Ảnh bữa ăn:** liệt kê từng món, gram, thành phần chính nếu là món ghép, dinh dưỡng /100 g.
  2. **Nhãn hoặc số liệu có sẵn:** chép đúng số trên nhãn, khẩu phần, quy về /100 g.
  3. **Tách món:** từ ảnh hoặc mô tả một món ghép, trả về thành phần + gram (dùng cho mẫu và bát, mục 4.3).

```json
{
  "bb": "food.v1",
  "kind": "meal_photo | label | dish_breakdown",
  "items": [
    {
      "name": "Phở bò",
      "name_en": "Beef pho",
      "grams": 650,
      "time": "12:30",
      "confidence": "high | medium | low",
      "per_100g": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "sugar_g": 0, "sodium_mg": 0 },
      "components": [
        { "name": "bánh phở", "name_en": "rice noodles", "grams": 200 },
        { "name": "nước dùng", "name_en": "broth", "grams": 300, "per_100g": { "kcal": 0 } }
      ]
    }
  ]
}
```

- **App đọc:** có `"bb":"food.v1"` thì kiểm tra chặt (khoá, đơn vị, ngưỡng). Thiếu khoá `bb` thì vẫn đọc mềm như
  `parseMealJson` / `parseNutritionText` hiện tại. **Không bao giờ từ chối im lặng**: dòng không hiểu hiện ✗.
- **Thành phần** (yêu cầu 4): khớp kho thì dùng số của kho, không khớp thì dùng `per_100g` của thành phần, không có
  nữa thì để ⚠ cho người dùng chọn món.
- **Có phiên bản (`v1`):** khi đổi định dạng thì tăng lên `v2`, app vẫn đọc `v1`. Câu lệnh cũ người dùng đã lưu trong
  app AI vẫn dùng được.
- **Lối tắt:** 💡 nút "📋 Chép câu lệnh" để người dùng dán sẵn câu lệnh vào phần ghi nhớ hoặc "custom instructions"
  của app AI. Từ đó chỉ cần gửi ảnh là xong.

### 4.3 Món ghép: Mẫu → Bát → Tên

| Lớp | Là gì | Ví dụ |
|---|---|---|
| **Mẫu** | Công thức chuẩn: thành phần (`foodId` trong kho) + gram + vai trò (`base`, `protein`, `broth`, `veg`, `topping`) | Phở bò = bánh phở · bò · nước dùng · rau, hành · giá (số gram lấy từ báo cáo có trích dẫn) |
| **Bát** | Mẫu + phần chỉnh của lần ăn. **Lưu thành phần**, không lưu chữ | bò 160 g · nước dùng 120 g · + trứng |
| **Tên** | **Sinh ra lúc hiển thị** từ chênh lệch bát so với mẫu, theo ngôn ngữ đang dùng | "Phở bò · nhiều thịt, ít nước" / "Beef pho · extra meat, less broth" / "Pho Bo · mehr Fleisch, wenig Brühe" |

- **Luật tên** (hàm thuần, có test): thành phần ≥ +30 % thì "nhiều X", ≤ −30 % thì "ít X", 0 g thì "không X", thêm
  thành phần mới thì "thêm X", cả bát lệch nhiều thì "tô lớn / bát nhỏ". Tối đa 3 cụm trong tên, không lệch gì thì
  giữ tên mẫu. Ngưỡng 30 % là điểm xuất phát, chỉnh sau khi chủ app thử.
- **Engine:** dinh dưỡng của bát = Σ gram thành phần × /100 g của kho. Khi nạp, app **ép phẳng** bát thành một
  FoodItem có số /100 g đã tính sẵn, mang `templateId` và thành phần, rồi đi qua đường nạp hiện có. Pin, Excel và
  lịch sử **không phải sửa**. Bát đã ăn giữ số cố định. Hai bát cùng thành phần thì trùng id (băm thành phần), không
  sinh món thừa.
- **Nhóm theo mẫu:** engine đếm được "tuần này 4 bát phở, 3 bát nhiều thịt" dù tên khác nhau. Đây là dữ liệu cho
  phần phân tích xu hướng sau này.
- **Màn chọn và chỉnh** (một màn, cập nhật tức thì, theo `mobile-ui-density`):

```
🍜 Phở bò · nhiều thịt, ít nước         ⓘ   ⚡ … kcal
[Nhiều thịt✓] [Ít nước✓] [＋Trứng] [Không hành]      ← chip: một chạm cho người lười
bánh phở      −  200 g  ＋
thịt bò       −  160 g  ＋   ▲                       ← ▲▼ = khác mẫu
nước dùng     −  120 g  ＋   ▼
＋ thêm thành phần
        Huỷ          |        Nạp ⚡
```

- **Lối vào:**
  - ⚡ Nạp → tìm "phở".
  - Nạp bằng chữ / Kể lại với "phở nhiều thịt ít nước": app bật sẵn chip.
  - Dán `dish_breakdown` hoặc `components` từ AI: app điền sẵn gram.
  - "Như mọi khi": bát gần nhất của mẫu đó.
  - ⭐ "Giữ làm mẫu của tôi", ví dụ "Phở nhà mình".
- **Từ khoá biến thể** (vi/en/de): nhiều / ít / thêm / không / tô lớn / bát nhỏ + tên thành phần, để trong bảng có
  kiểu theo ngôn ngữ (mục 4.5).

### 4.4 Bộ giải lời kể (B) và "Kể lại" nhiều ngày

**Trải nghiệm:**
- Nút **🎙️ Kể lại** (mở rộng "⌨️ 🎤 Kể cả ngày" của Session 74, **không làm thêm nút thứ hai**).
- Trang chủ hiện chip **"Kể lại T7–CN?"** khi phát hiện ngày trống.
- Dưới ô kể có 3 chip gợi ý **Ăn gì? · Tập gì? · Thấy thế nào?**
- Màn duyệt **theo ngày**: mỗi ngày một thẻ (T7 · 3 món · 1.850 kcal · ⚠ 1), mở một ngày, dòng ⚠ lên đầu.
- Hỏi lại **tối đa 1–3 câu dạng chip**, không mở form.
- **Nạp n mục ✓** một chạm, sau đó **Hoàn tác** được một lần.

**Các tầng giải** (mỗi tầng chạy khi tầng trước chưa chắc):

| Vấn đề | Cách giải |
|---|---|
| Ngày nào: "thứ 7", "hôm kia", "25/10", "cuối tuần" | Tách đoạn theo mốc ngày. Mốc áp cho các đoạn sau đến khi gặp mốc khác. "Cuối tuần" thì hỏi T7 hay CN |
| Lúc nào: "trưa", "sau khi tập", "ăn khuya" | Giữa khung bữa của người dùng (đã có). "Sau khi tập" thì đặt sau buổi tập cùng ngày. Không nói thì theo thứ tự kể |
| Gõ sai hoặc đọc nhầm | So gần đúng, bớt dần chữ, ưu tiên món hay ăn (đã có) |
| Cách gọi riêng: "cơm nhà", "món của mẹ" | **Từ điển cá nhân**: bảng SQLite `text_aliases` (cụm đã chuẩn hoá → món / mẫu / bát, số lần dùng), học từ mỗi lần người dùng sửa |
| Lượng mơ hồ: "một ít", "hơi nhiều", "như mọi khi" | Lượng quen × hệ số (ít ≈ 0,5, nhiều ≈ 1,5), có ⚠ |
| Tự sửa khi nói: "3 bát, à không, 2 bát" / "nhầm, là bún" | Lời sửa sau cùng thắng |
| Phủ định: "không ăn sáng", "nghỉ tập" | Ghi là **bỏ bữa** hoặc **nghỉ** (khác với quên ghi) |
| Không hiểu | Dòng ✗ "chưa hiểu", không bỏ im lặng. Có ✎ tìm tay hoặc 📤 câu lệnh AI |

**Cảm nhận:**
- Nguyên văn đi vào **Nhật ký** của ngày đó.
- Rút thêm nhãn có cấu trúc: năng lượng 1–5, giấc ngủ, đau nhức ở đâu, stress, tâm trạng. Module
  `feelingText/*`, từ khoá vi/en/de.
- **Không đổi pin, không chẩn đoán** (ranh giới sức khoẻ). Nhãn chỉ dùng để đối chiếu xu hướng.
- **Cần nâng mã hoá Nhật ký** trước khi đưa cảm nhận sức khoẻ vào nhiều.

### 4.5 Đa ngôn ngữ: sửa ngay và chuẩn bị cho fr/zh

- **Sửa 3 lỗi ở mục 2:**
  - Thêm cột `name_de` cho `custom_foods` (đủ các chỗ nối) + hàm `withLocalName(food, language, name)` ghi tên AI vào
    đúng trường của ngôn ngữ app.
  - Đọc dấu phân cách hàng nghìn: phần nguyên 1–3 chữ số khác 0, sau dấu là đúng 3 chữ số, đơn vị kJ / kcal / mg / ml
    thì đó là hàng nghìn. Có test cho "1.046 kJ", "1,046 kJ", "0,125 g", "12,4 g".
  - Mẫu JSON ra khỏi file dịch (mục 4.2).
- **Từ khoá theo ngôn ngữ có kiểu bắt buộc:** nhãn dinh dưỡng, từ biến thể món ghép, từ cảm nhận đặt trong
  `Record<Language, …>`. Thêm `'fr'` vào `Language` thì `tsc` báo thiếu ngay. App vẫn đọc **mọi** ngôn ngữ cùng lúc.
- **Bộ chuẩn hoá Unicode:** `\p{L}` thay cho `a-z` trong `normaliseLabel`, dấu câu toàn khổ `：，；（）`, đơn vị bản địa.
  Đây là nền cho tiếng Trung (chữ Hán bị xoá hết ở `normaliseLabel` hiện tại, câu không có khoảng trắng).
  ❓ Từ ngữ và đơn vị trên nhãn của Pháp và Trung phải kiểm chứng ở nguồn chính khi làm.
- **Dài hạn** 💡: khi có ngôn ngữ thứ 4, cân nhắc chuyển `nameVi/nameEn/nameDe` sang bảng tên `(food_id, lang, name)`.
  Chưa làm bây giờ.

---

## 5. Các đợt (mỗi đợt: verify xanh → EAS preview → checklist → session log)

| Đợt | Việc | Đầu ra / tiêu chí xong |
|---|---|---|
| **0** | Đa ngôn ngữ: 3 lỗi + từ khoá `Record<Language>` + chuẩn hoá Unicode | Test hàng nghìn; app tiếng Đức hiện tên món mới bằng tiếng Đức; `tsc` báo thiếu khi thử thêm ngôn ngữ giả |
| **1** | Hợp đồng `bb.food.v1` + 3 biến thể câu lệnh + tách `aiImport/*` + nhóm "🤖 Từ AI" (`origin`) | Câu lệnh chép được; dán JSON v1 / không có `bb` / chữ thường đều đọc đúng; món AI nằm riêng trong Món của tôi; test hợp đồng |
| **2** | **Báo cáo nghiên cứu** mẫu phở bò: gram thành phần một bát chuẩn, dinh dưỡng nước dùng, rau và hành, phân biệt các loại thịt | `docs/nghien-cuu/2026-xx-xx-mau-pho-bo.md` có trích dẫn; dòng mới trong `food_items.csv` có `source` / `note` |
| **3** | Món ghép: kiểu dữ liệu, ép phẳng, băm thành phần, luật tên vi/en/de, mẫu phở bò | Hàm thuần có test (tên, ép phẳng, trùng id, lịch sử giữ nguyên); chưa đổi UI |
| **4** | Màn chọn và chỉnh bát (chip + −/＋ + tên và kcal tức thì), lối vào từ ⚡ Nạp và Nạp bằng chữ ("phở nhiều thịt ít nước") | Checklist máy thật; duyệt giao diện rồi ghi vào `mobile-ui-density.md` |
| **5** | AI `components` / `dish_breakdown` → khớp mẫu và kho → bát | Dán JSON có thành phần thì bát mở sẵn đúng gram; thành phần khớp kho dùng số của kho |
| **6** | 🎙️ Kể lại **nhiều ngày** (trên `dayText` của Session 74) + chip "Kể lại T7–CN?" + hỏi lại bằng chip | Kể T7 + CN trong một lần thì ra 2 thẻ ngày, nạp đúng ngày (trong giới hạn 3 ngày) |
| **7** | Bộ giải: từ điển cá nhân `text_aliases`, lời tự sửa, phủ định, lượng mơ hồ | Test từng luật; sửa một lần thì lần sau tự khớp |
| **8** | Cảm nhận → Nhật ký + nhãn; tóm tắt tuần | Nhãn tick hoặc bỏ được; không đổi pin |
| **9** | Chia sẻ mẫu qua file (xuất ra, nhập bằng "Nguồn của tôi") | Mẫu đi qua file, không cần máy chủ |

💡 **Thứ tự** ưu tiên những gì chủ app vừa chốt (câu lệnh AI nhất quán, tách nguồn, phở bò). Nếu chủ app muốn "Kể lại"
cho người lười sớm hơn thì có thể đưa Đợt 6–7 lên trước Đợt 3–5: chúng độc lập với nhau, chỉ cùng dùng từ điển cá nhân.

---

## 6. Điểm kỹ thuật cần cẩn thận

- **Thêm `origin` hoặc `templateId` / thành phần cho món** là thêm trường cho FoodItem: phải sửa đủ các chỗ nối.
  Cân nhắc **bảng riêng** (`recipe_templates`, `recipe_bowls`) thay vì nhồi cột vào `custom_foods`.
- **Thứ tự đọc khi dán:** JSON (`bb.food.v1` rồi JSON mềm) → phân tích dinh dưỡng chữ thường (cần kcal + ít nhất một
  macro) → câu thường. Giữ thứ tự này khi thêm lớp tách ngày hoặc cảm nhận phía trước.
- **Giới hạn ghi bù 3 ngày** áp cho số liệu nạp vào engine. Việc kể về những ngày xa hơn chờ chốt (mục 8).
- **Trong Expo Go:** chỉ dùng 🎤 của bàn phím. 🎤 trong app hay mô hình chạy trên máy cần development build: hỏi chủ
  app trước. ❓ Mô hình AI chạy trên máy của iOS phải kiểm chứng ở nguồn chính trước khi lên kế hoạch.

---

## 7. Ngoài phạm vi

- Gọi bất kỳ API AI nào từ trong app. Đồng bộ đám mây. Chẩn đoán y tế từ cảm nhận.

---

## 8. Còn chờ chủ app chốt (hỏi đầu session, mỗi câu có khuyến nghị)

1. **Kể về những ngày quá 3 ngày:** 💡 cảm nhận và ghi chú lùi được 7 ngày, còn số liệu nạp vào engine vẫn 3 ngày.
2. **Bữa không kể:** 💡 cho phép "Như thường lệ" (lấp bằng thói quen, đánh dấu *ước lượng*), không tự lấp khi chưa hỏi.
3. **Cảm nhận:** 💡 chỉ lưu và đối chiếu xu hướng, không tác động thẳng vào pin.
4. **Món "🤖 Từ AI"** hiện ở đâu: 💡 một nhóm riêng trong 🍽️ Món của tôi, có lọc và xoá hàng loạt.
5. **Ngưỡng tên "nhiều / ít"**: 💡 ±30 %, chỉnh sau khi thử.
6. **Thứ tự đợt:** giữ như mục 5, hay đưa "Kể lại" (Đợt 6–7) lên trước?

### 8b. Đã chốt (chủ app, 2026-10-26, đầu session thực thi)

1. Cảm nhận / ghi chú lùi được **7 ngày**; số liệu nạp vào engine vẫn **3 ngày**.
2. Bữa không kể: **hỏi bằng chip**, có "Như thường lệ" (đánh dấu *ước lượng*); không tự lấp.
3. Cảm nhận: **chỉ lưu + đối chiếu xu hướng**, không đổi pin.
4. Món "🤖 Từ AI": **nhóm riêng trong 🍽️ Món của tôi**, có lọc + xoá hàng loạt.
5. Ngưỡng tên "nhiều / ít": **±30 %**.
6. Thứ tự đợt: **giữ như mục 5**.
7. Session 74 chưa commit: làm chồng trên cây chung, đã nhắn các phiên khác; không stash/reset/add -A, không commit file
   của Session 74.

# database/ — USDA FoodData Central offline pipeline

This folder is the offline, build-time source for a **separate, additional**
ingredient lookup list (English names, US Foundation Foods) — it does **not**
replace `food_items.csv` (the Vietnamese-dish source of truth used by the app).
See the full spec: `.ai/parallel-reports/S-N-food-data-usda-spec.md`.

## Folders

- `raw/` — heavy USDA bulk JSON files. **Not committed** (gitignored — see
  `.gitignore`: `database/raw/*.json`). Git should never carry multi-MB bulk
  downloads.
- `extract/` — compact, generated CSV. **Committed** — small (~150 KB for 363
  foods x 13 nutrients).

## How to update to a newer USDA release

1. Download a newer "Foundation Foods" JSON bulk file from
   `https://fdc.nal.usda.gov/download-datasets` and drop it into `database/raw/`
   (keep the original filename — the script picks the file with the latest
   `YYYY-MM-DD` date embedded in its name, so old and new files can coexist).
2. Run `npm run gen:usda`. This regenerates:
   - `database/extract/usda_foundation_foods.csv`
   - `src/data/food/usdaFoods.generated.ts` (the app-bundled copy)
3. Run `npx tsc --noEmit` and `npx jest` to confirm nothing broke.

The raw JSON file is never read by the app or by an AI assistant directly —
only `scripts/generate-usda-db.js` (via Node) touches it, to avoid burning
tokens on a multi-MB file.

## Translating names to Vietnamese (`usda_names_vi.csv`)

USDA rows have no Vietnamese name by default — `name_vi` is left blank for
all 363 foods. Rather than translating everything up front, `database/usda_names_vi.csv`
(columns: `id,name_vi`) is a small **cover file** you add rows to on demand,
only for foods actually used in the app.

To translate one more food: add a line to `usda_names_vi.csv` (e.g.
`usda_321358,Hummus (đậu gà nghiền)`), then run `npm run gen:usda`. The
script left-joins this file onto the generated CSV/TS output by `id` — any
id present gets its `name_vi` filled in, everything else stays blank.
Translations live in the cover file, not the generated output, so
re-running the generator (e.g. after a newer USDA release) never loses them.

Every other language works the same way via its own cover file
(`usda_names_de.csv` etc. — see `TRAILING_LANGUAGES` in
`scripts/generate-usda-db.js`); as of 2026-07-31 both `vi` and `de` are
100% covered for all 363 current rows, and `food_items.csv`'s own
`name_vi`/`name_en`/`name_de` columns are 100% covered too — nothing is
pending. New gaps appear again after: (a) a newer USDA release adds rows
(see "How to update" above), or (b) someone adds a row to `food_items.csv`
without filling every `name_*` column, or (c) a new language is added (see
`.ai/skills/add-language.md`).

## Translating names in bulk (reusable prompt)

When a gap like that appears, hand the following prompt (swap `{LANGUAGE}`
for the target, e.g. "German") to a fresh session/agent — it's self-
contained and doesn't depend on any prior conversation:

```
Bạn đang làm việc trong repo BodyBatteries (React Native/Expo, app theo dõi
năng lượng, hỗ trợ 3 ngôn ngữ vi/en/de). Nhiệm vụ: bổ sung bản dịch tiếng
{LANGUAGE} còn thiếu cho catalog món ăn. KHÔNG sửa bất kỳ file/logic nào khác.

Đọc trước: database/README.md và comment đầu file scripts/generate-usda-db.js
để hiểu đúng cơ chế "cover file".

Có 2 nguồn cần kiểm tra:
1. food_items.csv (gốc, ~90 món tự soạn) — cột `name_{lang}` ở cuối mỗi dòng.
   Dòng nào cột này rỗng thì cần dịch.
2. database/usda_names_{lang}.csv (id,name_{lang}) — cover file cho 363 món
   USDA trong database/extract/usda_foundation_foods.csv. So sánh id giữa 2
   file này; id nào có trong usda_foundation_foods.csv mà KHÔNG có trong
   usda_names_{lang}.csv (hoặc có nhưng name_{lang} rỗng) thì cần dịch. Lấy
   tên gốc tiếng Anh (cột name_en / description) và category làm ngữ cảnh.

Cách dịch:
- Tên món ăn tự nhiên, ngắn gọn, đúng văn phong người dùng {LANGUAGE ngữ cảnh:
  ví dụ với Đức — người dùng gốc Việt sống ở Đức, hay đi siêu thị Đức, nên ưu
  tiên tên gọi thường thấy trên bao bì/siêu thị Đức hơn là dịch máy móc}.
- Giữ đúng dạng ngoặc mô tả cách chế biến nếu tên gốc có, ví dụ tiếng Đức:
  "Reis (gekocht)", "Cherrytomaten (roh)" — xem các dòng đã dịch sẵn trong
  cùng file làm mẫu văn phong.
- Nếu tên chứa dấu phẩy, PHẢI bọc trong ngoặc kép để không vỡ CSV (xem ví dụ:
  "Grüne Bohnen (Dose, abgetropft)").
- TUYỆT ĐỐI không sửa các cột khác (name_vi, name_en, số liệu dinh dưỡng...).

Sau khi điền xong:
1. Chạy `npm run gen:food` và `npm run gen:usda` để regenerate.
2. Chạy `npx tsc --noEmit` — phải sạch lỗi.
3. Chạy `npx jest src/data/food` — phải pass.
4. KHÔNG commit, không push. Chỉ để thay đổi ở working tree cho tôi review.
5. Báo cáo cuối: liệt kê đúng những id/món đã dịch (id + tên gốc + tên đã
   dịch), không diễn giải dài dòng.
```

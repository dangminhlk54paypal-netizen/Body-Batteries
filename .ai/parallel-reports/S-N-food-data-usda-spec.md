# S-N · Tích hợp dữ liệu dinh dưỡng USDA (FoodData Central) — SPEC

> **Trạng thái:** 🆕 Đã chốt hướng với người dùng (2026-07-03, tư vấn Opus). **CHƯA code** —
> đây là spec để một phiên sau (Sonnet) đọc rồi làm. Hướng đã chốt: **BỔ SUNG** (không thay thế),
> **offline bulk** (không dùng API trả phí), pipeline **build-time** kiểu giống `gen:food`.
>
> **⚠️ AI đọc spec này TRƯỚC. TUYỆT ĐỐI KHÔNG mở/đọc trực tiếp file JSON 6.4MB bằng công cụ đọc
> file** (tốn rất nhiều token). Chỉ chạm vào nó **qua script Node** (`node -e ...` hoặc
> `scripts/generate-usda-db.js`). Xem mục 8.

---

## 1. Bối cảnh & vấn đề

Người dùng tải về file **`FoodData_Central_foundation_food_json_2026-04-30.json`** (USDA
FoodData Central — "Foundation Foods"), đặt ở **gốc repo**. Đặc điểm đã kiểm tra bằng script:

- **Kích thước:** 6.4 MB. Đọc thẳng bằng công cụ đọc file → tốn hàng chục nghìn token mỗi lần.
- **Nội dung:** `{ "FoundationFoods": [ ... ] }` — **395 phần tử**, trong đó **363 hợp lệ** (một
  số phần tử là `null`, phải lọc bỏ). Mỗi món có tới ~119 chất dinh dưỡng.
- **Đây là NGUYÊN LIỆU MỸ, tên tiếng Anh** (Hummus, Broccoli, Beef…) — **không phải món ăn Việt**
  (cơm, phở, bún). Vì vậy nó **bổ sung/mở rộng**, không thay thế `food_items.csv` (nguồn món Việt
  do người dùng tự soạn, vẫn là nguồn CHÍNH).

**⚠️ Cảnh báo chất lượng dữ liệu (đã đo trên 363 món — phải xử lý, đừng bỏ qua):**

| Nhóm chất | Số món có dữ liệu / 363 | Ghi chú |
|-----------|------------------------|---------|
| Protein / Fat / Water / Calcium / Iron / Mg / K / Zn | 333–355 | ✅ Tốt |
| Carb (#205) | 321 | ✅ Ổn |
| Fiber (#291) | 185 | ⚠️ Chỉ một nửa |
| **Energy kcal (#208)** | **95** | ⚠️ **Đa số THIẾU** → phải tự tính (mục 5) |
| **Sugar (#269)** | **5** | ❌ Gần như không có → để trống (0), đừng bịa |

---

## 2. Hướng đã chốt (không bàn lại)

1. **Vai trò:** BỔ SUNG. `food_items.csv` (món Việt) giữ nguyên làm nguồn CHÍNH. USDA là một
   **danh sách tra cứu RIÊNG**, không trộn vào file CSV món Việt.
2. **Offline, không API trả phí.** USDA *có* API key **miễn phí** (`api.nal.usda.gov/fdc`, thậm
   chí `DEMO_KEY` chạy được với giới hạn lượt) — nhưng app pin năng lượng cần chạy **offline**,
   không phụ thuộc mạng/giới hạn lượt gọi. **File bulk tải sẵn là đúng hướng và rẻ nhất.** Ghi
   chú API để tương lai ở mục 9, **không làm bây giờ**.
3. **Pipeline build-time**, sao chép đúng mô hình `gen:food` đã hoạt động tốt: file nặng → script
   Node lọc → file gọn → app bundle **chỉ file gọn**. File 6.4MB **không bao giờ vào app**.

---

## 3. Cấu trúc thư mục mới (`database/`)

Người dùng muốn một folder riêng để cập nhật dữ liệu về sau. Đề xuất (đặt tên **`database/`** —
chữ thường, theo chuẩn đặt tên file/thư mục; đây là ý "dataBase" người dùng nêu):

```
database/
  raw/            ← file nguồn nặng, KHÔNG commit (xem .gitignore mục 7)
      FoodData_Central_foundation_food_json_2026-04-30.json   ← chuyển từ gốc repo vào đây
      (tương lai: thả file USDA mới hơn vào đây rồi chạy lại script)
  extract/        ← kết quả gọn nhẹ, CÓ commit
      usda_foundation_foods.csv    ← bảng gọn (cùng cột với food_items.csv → tái dùng parser)
      usda_foundation_foods.xlsx   ← (tuỳ chọn) bản Excel để người dùng xem offline
  README.md       ← hướng dẫn: thả file mới vào raw/, chạy `npm run gen:usda`
```

**Vì sao tách `raw/` (không commit) và `extract/` (commit):** git không nên nuốt file 6.4MB (làm
phình repo, chậm clone). Bản `extract/` nhỏ (~100–200 KB cho 363 món × 13 chất) → commit thoải mái.

---

## 4. Bảng ánh xạ chất dinh dưỡng (USDA nutrient number → cột app)

App chỉ cần **13 chất** (đúng bằng `Nutrition` trong `src/types/energy.ts` và header
`food_items.csv`). USDA đánh số chất theo chuẩn INFOODS (`foodNutrients[].nutrient.number`):

| Cột app (per 100 g) | USDA `nutrient.number` | Đơn vị USDA |
|---------------------|------------------------|-------------|
| `energy_kcal`   | **208** (fallback: tự tính, mục 5) | kcal |
| `water_g`       | 255 | g  |
| `protein_g`     | 203 | g  |
| `fat_g`         | 204 | g  |
| `carb_g`        | 205 | g  |
| `fiber_g`       | 291 | g  |
| `sugar_g`       | 269 | g  |
| `calcium_mg`    | 301 | mg |
| `iron_mg`       | 303 | mg |
| `sodium_mg`     | 307 | mg |
| `potassium_mg`  | 306 | mg |
| `magnesium_mg`  | 304 | mg |
| `zinc_mg`       | 309 | mg |

**Đơn vị:** giá trị USDA Foundation đã là **per 100 g** sẵn (không cần scale). Micro (Ca/Fe/…)
USDA cho bằng **mg** — khớp cột app. **Cẩn thận** nếu gặp `µg` cho chất nào (không nằm trong 13
chất trên, bỏ qua). Không cần đọc `foodPortions` (khẩu phần USDA theo tbsp/cup kiểu Mỹ — app
dùng khẩu phần Việt riêng; cứ đặt `default_serving_g = 100`, `serving_presets` rỗng).

---

## 5. Tự tính năng lượng khi thiếu #208 (BẮT BUỘC)

Vì chỉ 95/363 món có kcal sẵn, khi `#208` không có, tính bằng **hệ số Atwater**:

```
energy_kcal = protein_g * 4 + carb_g * 4 + fat_g * 9
```

- Làm tròn 0 chữ số thập phân.
- Khi tính bằng công thức, đặt `note = "kcal computed (Atwater)"` để minh bạch (đây là ước
  lượng, không phải số đo USDA). Khi lấy trực tiếp #208, `note = ""`.
- Sugar thiếu (#269) → để `0`, **không** bịa. Fiber thiếu → `0`.
- `source = "USDA-FDC"` cho mọi món.

---

## 6. Định dạng file `extract/usda_foundation_foods.csv`

**Dùng ĐÚNG header của `food_items.csv`** để tái dùng `parseFoodCsv` không sửa 1 dòng:

```
id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note
```

Quy ước từng cột cho 1 món USDA:

- `id`: `usda_<fdcId>` (vd `usda_321358`) — tiền tố `usda_` để không đụng id món Việt.
- `name_vi`: **để trống** (người dùng/phiên sau có thể dịch dần; đây là danh sách tra cứu tiếng Anh).
- `name_en`: `description` của món (nhớ bọc dấu ngoặc kép nếu có dấu phẩy — parser đã hỗ trợ).
- `category`: map `foodCategory.description` → enum app (grain/meat/fish/egg_dairy/legume_nut/
  vegetable/…) qua bảng nhỏ; **không map được thì giữ nguyên chuỗi English** (đừng để trống).
- `default_serving_g`: `100`. `serving_presets`: rỗng.
- 13 cột dinh dưỡng: theo mục 4 + mục 5.
- `source`: `USDA-FDC`. `note`: `""` hoặc `"kcal computed (Atwater)"`.

**Escape CSV:** bọc `"..."` cho field chứa dấu phẩy; nhân đôi `""` cho dấu ngoặc kép bên trong —
đúng như `splitCsvLine` trong `src/data/food/foodCsv.ts` mong đợi.

---

## 7. Script `scripts/generate-usda-db.js` (thiết kế — chưa viết)

Sao mô hình `scripts/generate-food-db.js`. Thuật toán:

1. Tìm file JSON **mới nhất** trong `database/raw/` khớp `FoodData_Central_*food*json*.json`
   (chọn theo ngày trong tên file, để tương lai thả bản mới vào là tự dùng bản mới).
2. `JSON.parse`, lấy `FoundationFoods`, **`.filter(Boolean)`** bỏ phần tử null.
3. Với mỗi món:
   - Quét `foodNutrients`, lập map `number → amount` (guard `n && n.nutrient && n.nutrient.number`).
   - Lấy 13 chất theo bảng mục 4; thiếu → `0`. Energy: #208, thiếu thì Atwater (mục 5).
   - Sinh 1 dòng CSV theo mục 6.
4. Ghi `database/extract/usda_foundation_foods.csv`.
5. (Tuỳ chọn) Ghi `database/extract/usda_foundation_foods.xlsx` bằng lib **`xlsx`** (ĐÃ có trong
   `package.json`, không cài thêm) — cho người dùng mở xem offline, thoả mãn ý "lưu vào Excel".
6. Sinh module bundle được cho app: `src/data/food/usdaFoods.generated.ts` chứa
   `export const USDA_FOOD_CSV_RAW = \`...\`;` (escape template literal y hệt `generate-food-db.js`:
   `\\` , `` ` `` , `${`).
7. In số dòng đã sinh (kiểu `gen:usda → … (363 food rows, 268 kcal computed)`).

**Thêm vào `package.json`** (file DÙNG CHUNG — chỉ gói S-N sửa trong đợt của nó):
```json
"gen:usda": "node scripts/generate-usda-db.js",
```
Có thể chain vào `start` như `gen:food` **hoặc** để chạy tay (khuyến nghị chạy tay: dữ liệu USDA
ít đổi, không cần regenerate mỗi lần `npm start`). Quyết định lúc code, ghi rõ trong report.

---

## 8. Cách app dùng (module tra cứu RIÊNG — không trộn vào món Việt)

Tạo `src/data/food/usdaFoods.ts` (song song `foodDatabase.ts`, **tái dùng** `parseFoodCsv`):

```ts
import { parseFoodCsv } from './foodCsv';
import { USDA_FOOD_CSV_RAW } from './usdaFoods.generated';
export const USDA_FOODS = parseFoodCsv(USDA_FOOD_CSV_RAW);
export function searchUsdaFoods(query: string) { /* lọc theo name_en/category */ }
```

- **KHÔNG** nhập USDA vào `FOOD_ITEMS` của `foodDatabase.ts` (giữ danh sách món Việt sạch).
- Nơi ghi món (FoodLogModal) về sau có thể thêm **tab/nút "Tra cứu USDA (tiếng Anh)"** để tìm
  nguyên liệu và chép số — nhưng **đó là gói UI riêng, KHÔNG thuộc S-N**. S-N chỉ làm **pipeline
  dữ liệu** (script + file gọn + module loader + test), không đụng UI, để chạy độc lập an toàn.

---

## 9. Ghi chú API (tương lai, KHÔNG làm bây giờ)

- USDA FoodData Central có REST API miễn phí: đăng ký key tại `https://fdc.nal.usda.gov/api-key-signup`
  (miễn phí, không thẻ tín dụng). `DEMO_KEY` dùng thử được nhưng giới hạn ~30 req/giờ.
- **Vì sao chưa dùng:** app cần offline; API thêm phụ thuộc mạng + giới hạn lượt + xử lý lỗi
  mạng. Bulk offline đơn giản và đủ dùng. Nếu sau này muốn cho người dùng tra cứu **online** món
  ngoài 363 món bulk, mới cân nhắc — lúc đó key vẫn **miễn phí**, không tốn tiền như người dùng lo.

---

## 10. Việc cần người dùng xác nhận trước khi phiên sau code

1. Tên thư mục `database/` (chữ thường) — OK, hay muốn đúng chữ `dataBase`?
2. `gen:usda` chạy **tay** (khuyến nghị) hay chain vào `npm start`?
3. Có cần xuất luôn bản `.xlsx` trong `database/extract/` không (mục 7 bước 5)?

---

## 11. Ranh giới sức khoẻ (CONTEXT mục 5)

Dữ liệu USDA chỉ là **con số tham khảo**. Energy tính bằng Atwater là **ước lượng**, phải ghi rõ
trong `note`. Không dùng số này để đưa ra khuyến nghị y tế/chẩn đoán.

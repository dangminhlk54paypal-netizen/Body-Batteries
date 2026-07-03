# S-N · Tích hợp dữ liệu dinh dưỡng USDA (FoodData Central) — pipeline offline

**Trạng thái:** ✅ XONG (2026-07-03, Sonnet 5). Chỉ làm pipeline dữ liệu, KHÔNG đụng UI, đúng như spec.

## Xác nhận với người dùng trước khi code (mục 10 spec)

1. Tên thư mục: **`database/`** (chữ thường) — đã chọn.
2. `gen:usda`: **chạy tay** (`npm run gen:usda`), không chain vào `npm start` — đã chọn.
3. Xuất `.xlsx`: **không cần**, chỉ CSV — đã chọn.

## Việc đã làm

- **`.gitignore`**: thêm `database/raw/*.json` (làm ĐẦU TIÊN, trước khi di chuyển file JSON).
- Di chuyển `FoodData_Central_foundation_food_json_2026-04-30.json` (6.4 MB) từ gốc repo vào
  `database/raw/`.
- Tạo `database/README.md`: hướng dẫn thả file USDA mới vào `raw/` rồi chạy `npm run gen:usda`.
- Tạo `scripts/generate-usda-db.js` (mô hình giống `scripts/generate-food-db.js`):
  - Tự tìm file `FoodData_Central_*food*json*.json` mới nhất trong `database/raw/` (theo ngày
    trong tên file).
  - `.filter(Boolean)` bỏ 32 phần tử `null` (395 → **363 món hợp lệ**).
  - Map 13 chất theo `nutrient.number` (đúng bảng mục 4 spec) — không cần scale đơn vị (đã kiểm
    tra bằng Node: 203/204/205/255/269/291 đều là `g`, 301/303/304/306/307/309 đều là `mg`, 208 là
    `kcal` — khớp hoàn toàn với cột app).
  - Thiếu `#208` (kcal) → tự tính Atwater `protein*4 + carb*4 + fat*9`, làm tròn, gắn
    `note = "kcal computed (Atwater)"`. Có sẵn `#208` → dùng thẳng, `note = ""`.
  - Category: map `foodCategory.description` (19 giá trị thực tế trong file) → enum app khi rõ
    nghĩa (vd `Beef Products/Pork Products/Poultry Products/Lamb.../Sausages...` → `meat`,
    `Legumes.../Nut and Seed...` → `legume_nut`, `Fats and Oils/Sweets` → `fat_sugar`, v.v.); giữ
    nguyên chuỗi tiếng Anh cho nhóm không map rõ (`Beverages`, `Baked Products`,
    `Restaurant Foods`, `Soups, Sauces, and Gravies`, `Spices and Herbs`) — đúng chỉ dẫn spec
    "không map được thì giữ nguyên English, đừng để trống".
  - Sinh `database/extract/usda_foundation_foods.csv` (đúng header `food_items.csv`, escape CSV
    theo cùng quy tắc `splitCsvLine`) và `src/data/food/usdaFoods.generated.ts`
    (`USDA_FOOD_CSV_RAW`, escape template literal giống `generate-food-db.js`).
  - In log: `gen:usda → ... (363 food rows, 268 kcal computed)`.
- Thêm `"gen:usda": "node scripts/generate-usda-db.js"` vào `package.json` (script riêng, không
  chain vào `start`).
- Tạo `src/data/food/usdaFoods.ts`: `USDA_FOODS` (tái dùng `parseFoodCsv`, KHÔNG sửa
  `foodCsv.ts`), `getUsdaFoodById`, `searchUsdaFoods` (tìm theo `nameEn`/`category`, không có
  `nameVi` vì cột này để trống cho món USDA). **Không import/trộn vào `FOOD_ITEMS`** của
  `foodDatabase.ts`.
- Tạo `src/data/food/__tests__/usdaFoods.test.ts`: kiểm tra đúng 363 món, mọi item có
  `id` tiền tố `usda_`/tên tiếng Anh/`source = 'USDA-FDC'`; case lấy kcal trực tiếp từ `#208`
  (Hummus, 229 kcal, note rỗng); case tự tính Atwater (`Beans, Dry, Medium Red`, 25.5g protein +
  0g carb + 1.04g fat → 111 kcal, note đúng); search theo tên tiếng Anh; và xác nhận **không có
  id `usda_` nào lẫn vào `FOOD_ITEMS`** (món Việt).

## Kết quả kiểm tra (bắt buộc trước khi báo xong)

- `npm run gen:usda` → `gen:usda → database/extract/usda_foundation_foods.csv +
  src/data/food/usdaFoods.generated.ts (363 food rows, 268 kcal computed)` ✅
- `npx tsc --noEmit` → sạch, exit 0 ✅
- `npx jest` → **100 test PASS / 12 suite** (tăng từ 92/11 — 8 test mới của `usdaFoods.test.ts`) ✅
- `npx expo export --platform ios` → `iOS Bundled ... (1426 modules)` — **không đổi** so với
  trước (đúng dự kiến: `usdaFoods.ts` chưa được UI nào import, đây là pipeline dữ liệu thuần) ✅
- File 6.4 MB **không bị commit**: `git check-ignore -v` xác nhận bị chặn bởi
  `.gitignore:database/raw/*.json`; `git add --dry-run database/` chỉ thêm `README.md` +
  `extract/usda_foundation_foods.csv` (52 KB) ✅

## File đã tạo/sửa (đúng danh sách S-N, không đụng file nào khác)

- SỬA: `.gitignore`, `package.json` (chỉ thêm 1 dòng script)
- TẠO: `database/README.md`, `database/raw/` (chứa file JSON đã chuyển vào, gitignored),
  `database/extract/usda_foundation_foods.csv`, `scripts/generate-usda-db.js`,
  `src/data/food/usdaFoods.generated.ts`, `src/data/food/usdaFoods.ts`,
  `src/data/food/__tests__/usdaFoods.test.ts`

**KHÔNG đụng:** `food_items.csv`, `foodDatabase.ts`, `foodCsv.ts` (chỉ import `parseFoodCsv`),
`foodDatabase.generated.ts`, `energyStore.ts`, `App.tsx`, mọi screen/component.

## Việc còn để ngỏ (không thuộc S-N, để phiên sau)

- **UI tra cứu USDA** (tab/nút "Tra cứu USDA (tiếng Anh)" trong FoodLogModal) — gói riêng, spec
  mục 8 đã nói rõ không làm trong S-N.
- **Dịch `name_vi`** cho 363 món USDA — hiện để trống, có thể dịch dần về sau (không bắt buộc,
  đây là danh sách tra cứu tiếng Anh theo đúng hướng đã chốt).
- API USDA online (mục 9 spec) — không làm, đã chốt dùng bulk offline.

# S-R — Spec: Pin vi chất (micronutrient batteries) từ dữ liệu USDA

> 🆕 Hướng đề xuất 2026-07-04 (Opus, sau khi websearch cách các app dinh dưỡng vận hành —
> Cronometer/Yuka/Nutri-Score/NOVA). Ý tưởng số 1 trong bản phân tích: **biến các "pin nhỏ"
> từ ý niệm thành pin vi chất THẬT, nạp bằng dữ liệu dinh dưỡng đã có.** Đây là cách khai thác
> tài sản lớn nhất đang bỏ ngỏ: pipeline USDA (S-N) + bảng dinh dưỡng per-100g đã đầy đủ.
> Nguồn sự thật duy nhất cho gói **S-R**. Mục trong `.ai/NEXT_SESSIONS.md` chỉ đóng gói/điều phối.
>
> ⚠️ **Chưa chốt với người dùng** — đây là spec ĐỀ XUẤT. Trước khi code phải xác nhận mục 7.

## 0. Vì sao làm việc này (bối cảnh)
- Các app dẫn đầu chia làm 3 trục: đếm calo (MyFitnessPal), **chiều sâu vi chất** (Cronometer,
  80–100+ chất từ USDA), và chất lượng định tính (Yuka/Nutri-Score). App ta mới mạnh trục 1.
- Khoa học: chất lượng ăn uống là **nhiều chiều** — không quy về một con số được. Mô hình
  **nhiều pin nhỏ** của ta là khung lý tưởng để thể hiện đúng điều đó (thứ Yuka điểm-đơn không làm được).
- **Tài sản sẵn có:** kiểu `Nutrition` (trong `src/types/food.ts`) đã có per-100g: `proteinG`,
  `fiberG`, `sugarG`, `calciumMg`, `ironMg`, `sodiumMg`, `potassiumMg`, `magnesiumMg`, `zincMg`.
  Hiện 6 khoáng đang bị **gộp thô** thành một số `mineralsMg` duy nhất (xem `nutritionForGrams`).
  S-R **tách** rollup thô đó ra thành pin vi chất thật, mỗi chất nạp về mốc tham khảo ngày.

## 1. Mô hình chốt (định nghĩa chính xác)

### 1A. Hai LOẠI pin vi chất (ngữ nghĩa khác nhau — QUAN TRỌNG cho ranh giới sức khoẻ)
- **Pin "nạp cho đủ" (goal-type):** ăn nhiều hơn = tốt hơn tới mốc. Dưới mốc = **"còn trống"**
  (trung tính), KHÔNG đỏ, KHÔNG "bạn đang thiếu chất/yếu". Gồm: **Đạm (protein), Chất xơ (fiber),
  Canxi, Sắt, Kali, Magie, Kẽm**.
- **Pin "giữ trong ngưỡng" (limit-type):** nên ở DƯỚI mốc. Vượt mốc hiển thị **trung tính**
  ("vượt ngưỡng gợi ý"), KHÔNG "xấu"/"tội lỗi". Gồm: **Natri (muối), Đường**.
- Cùng dùng lại hình pin (BatteryCell) nhưng khác cách đọc %: goal = `current/target`;
  limit = `current/cap` (vượt thì kẹp hiển thị 100% + nhãn "vượt", màu vẫn nhẹ nhàng).

### 1B. Nguồn số & cách tính (thuần, test được)
- **Tính từ nhật ký món của HÔM NAY**, không cần đổi DB. Mỗi `FoodLogEntry` giữ `foodId` + `grams`
  → tra `getFoodById(foodId)` (foodDatabase) → `nutritionForGrams`-style scale per-100g → cộng dồn.
- Engine nhận **hàm tra cứu** (`lookup: (foodId) => FoodItem | undefined`) để giữ thuần & test được
  (không import trực tiếp DB vào domain).
- Món không tra được (foodId lạ/đã xoá khỏi CSV) → bỏ qua an toàn (không làm vỡ tổng).
- **v1 KHÔNG lưu snapshot vi chất vào DB.** Pin vi chất là **lớp DẪN XUẤT chỉ-hôm-nay**, reset theo
  ngày lịch như các pin dinh dưỡng cũ. (Lưu snapshot đầy đủ để vẽ biểu đồ vi chất theo thời gian =
  nâng cấp bản sau, cần đổi `FoodLogEntry` + repo — KHÔNG làm ở S-R.)

### 1C. Ánh xạ % và mốc tham khảo
- `pct(goal) = clamp(0..100, 100 × current / target)`.
- `pct(limit) = clamp(0..100, 100 × current / cap)`; nếu `current > cap` → hiện 100% + cờ `over=true`.
- Mốc (`target`/`cap`) lấy từ `lib/nutrientTargets.ts` (mới) — **ước lượng chung dựa RDA/AI/UL
  người trưởng thành**, KHÔNG phải đơn thuốc. v1 dùng số cố định trung bình; ghi chú rõ có thể
  tinh chỉnh theo giới/tuổi ở bản sau (đã có `profile` trong store nếu muốn nâng).

## 2. Hình UI dự kiến (xác nhận trên máy khi làm)
```
   HÔM NAY ĐÃ NẠP (vi chất)            * Chỉ để tham khảo.
   ┌─────┬─────┬─────┬─────┐
   │Đạm  │Xơ   │Sắt  │Canxi│   ← pin "nạp cho đủ" (xanh dần khi đầy)
   │ 72% │ 40% │ 55% │ 30% │
   └─────┴─────┴─────┴─────┘
   ▸ Xem thêm: Kali · Magie · Kẽm
   ┌─────┬─────┐
   │Muối │Đường│              ← pin "giữ trong ngưỡng" (nhóm riêng, nhãn nhẹ)
   │ 80% │ vượt│
   └─────┴─────┘
```
- Nhóm goal hiển thị trước; nhóm limit tách riêng, nhãn nhẹ ("nên giữ dưới mốc").
- Curated: chỉ show vài pin nổi bật (Đạm/Xơ/Sắt/Canxi) + phần "Xem thêm" cho phần còn lại,
  tránh rối mắt (chốt danh sách ở mục 7).
- Dưới đói kèm **"Chỉ để tham khảo."**

## 3. Điểm tích hợp & ranh giới file (giữ rủi ro thấp)
- Pin vi chất là **DẪN XUẤT** — KHÔNG tạo thêm `BatteryReading` trong DB, KHÔNG mở rộng union
  `BatteryId`, KHÔNG đổi schema/repository. Chỉ đọc nhật ký món hôm nay + tra DB món → render.
- Reset theo **ngày lịch** (`todayString`) như pin dinh dưỡng cũ. **KHÔNG** dùng `energyDayString`
  (mốc 6h chỉ dành cho Sổ calo của S-Q — đừng đụng vào).
- Chạy **SAU khi S-Q merge** để tránh đụng file màn Home (S-Q cũng sửa layout Home). Ngoài Home,
  toàn bộ còn lại là file MỚI → không xung đột logic.

## 4. Đóng gói & phân công

| Gói | Nội dung | Agent | File sở hữu | Song song? |
|-----|----------|-------|-------------|------------|
| **S-R** | Pin vi chất dẫn xuất từ nhật ký món (thuần + UI) | logic-backend (engine) + mobile-frontend (UI) | `types/nutrition.ts` (mới), `lib/nutrientTargets.ts` (mới), `domain/nutrition/microBatteryEngine.ts`(+test, mới), `components/MicroBatteryStack.tsx` (mới), chèn vào `screens/HomeScreen.tsx` (điểm đọc nhật ký hôm nay) | ⚠️ sau S-Q (chỉ vì đụng Home) |

## 5. Cơ sở dinh dưỡng (websearch 2026-07-04 — ghi để tránh tra lại)
- **Cronometer** = chuẩn vàng chiều sâu vi chất: 80–100+ chất, dữ liệu USDA/NCCDB **verified**
  (không crowdsource như MyFitnessPal). Đây là mô hình tham chiếu cho S-R.
- **Nutri-Score vs NOVA** là **hai chiều tách biệt** (đậm độ dinh dưỡng vs mức chế biến) — củng cố
  lý do dùng nhiều pin thay vì một điểm. (Cambridge Public Health Nutrition.)
- **Đa dạng thực phẩm** liên quan tới đủ vi chất (NCBI) — nền cho "pin đa dạng" bản sau (ngoài S-R).
- Số RDA/AI/UL là **ước lượng chung người trưởng thành**, KHÔNG phải đo y tế — luôn "chỉ tham khảo".

## 6. Ranh giới sức khoẻ (BẮT BUỘC — CONTEXT mục 5)
- Pin goal dưới mốc = **"còn trống"**, trung tính. KHÔNG đỏ, KHÔNG "thiếu chất", KHÔNG hù.
- Pin limit vượt mốc = **"vượt ngưỡng gợi ý"**, trung tính. KHÔNG "xấu"/"có hại"/gán tội.
- Mốc là **tham khảo chung**, không cá nhân hoá y tế. KHÔNG tạo mục tiêu cực đoan, KHÔNG cổ vũ
  ăn kiêng để "ép pin". Mọi màn kèm **"Chỉ để tham khảo."**

## 7. Việc cần người dùng xác nhận TRƯỚC khi code
1. **Danh sách pin** hiện nổi bật (gợi ý 4: Đạm/Xơ/Sắt/Canxi) + pin trong "Xem thêm"
   (Kali/Magie/Kẽm) + nhóm limit (Muối/Đường). Có muốn thêm/bớt chất nào không?
2. **Mốc tham khảo** v1 dùng số cố định người trưởng thành (đơn giản trước) hay ngay từ đầu
   chỉnh theo giới/tuổi từ `profile`? (Spec đề xuất: cố định v1, nâng sau.)
3. **Chỗ đặt** khối pin vi chất trên Home (dưới "Hôm nay đã ăn"?) — chốt khi mở app cùng nhau.
4. Xác nhận **KHÔNG lưu lịch sử vi chất** ở v1 (chỉ hôm nay) — đồng ý để giữ đơn giản, không đụng DB?

## 8. Xong khi
`npx tsc --noEmit` sạch + `npx jest` xanh (test mới cho `microBatteryEngine`: cộng dồn đúng nhiều
món, goal vs limit clamp/`over`, nhật ký rỗng = 0, món foodId lạ bị bỏ qua an toàn) +
`npx expo export --platform ios` OK + **test trên máy cùng người dùng**: ghi vài món → các pin vi
chất nạp lên đúng hướng; dưới mốc hiện "còn trống" nhẹ nhàng; vượt mốc (muối/đường) hiện "vượt"
trung tính; sang ngày mới → reset về 0.

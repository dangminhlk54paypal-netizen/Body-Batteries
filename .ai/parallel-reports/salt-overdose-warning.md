# Salt (derived) + Upper-Limit overdose warning — báo cáo

Agent: logic-backend. Ngày: 2026-07-08.

## Việc #3 — Muối (Muối & điện giải)

Muối KHÔNG phải trường lưu riêng — được **suy ra** từ natri:
`salt (g) = sodium (mg) × 2.5 / 1000` (2.5 g NaCl / 1 g natri). Vì suy ra từ
natri, pin Muối **tự cập nhật** mỗi khi bất kỳ món ăn nào (có sẵn, USDA, hay
tự thêm) được ghi có natri — không cần sửa gì ở đường nhập liệu.

- `src/types/nutrition.ts`: thêm `'salt'` vào `MicronutrientId`.
- `src/domain/nutrition/microBatteryEngine.ts`: thêm case
  `'salt': return (p.sodiumMg * 2.5) / 1000;` trong `per100gValue`.
- `src/lib/nutrientTargets.ts`: thêm hàng `salt` vào `NUTRIENT_TABLE`
  (`kind: 'limit'`, `unit: 'g'`, mốc 5 g/ngày — WHO, chỉ để tham khảo, màu
  `#E17055`). Thêm `ELECTROLYTE_IDS = ['salt', 'sodium', 'potassium',
  'magnesium']`; bỏ `sodium` khỏi `LIMIT_IDS`, bỏ `potassium`/`magnesium`
  khỏi `MORE_GOAL_IDS` để mỗi chất chỉ hiện đúng 1 nhóm (test đã kiểm
  không trùng id).
- `src/components/MicroBatteryStack.tsx`: thêm section mới "Muối & điện
  giải" render `electrolytes = byIds(states, ELECTROLYTE_IDS)`, giữ nguyên
  các nhóm còn lại.
- `src/domain/nutrition/nutritionAssessment.ts`: bắt buộc phải thêm entry
  `salt` vào `ASSESSMENT_RULES`/`ASSESSMENT_ORDER` vì kiểu
  `Record<MicronutrientId, ...>` giờ đòi hỏi đủ key (nếu không `tsc` báo
  lỗi) — thêm lời khuyên nhẹ nhàng kiểu sodium/sugar hiện có, nguồn WHO
  salt-reduction. Đây là sửa tối thiểu, không đụng logic khác của file.

## Việc #6b — Cảnh báo vượt mức dung nạp tối đa (UL)

- **MỚI** `src/lib/upperLimits.ts`: bảng `UPPER_LIMITS` (chỉ để tham khảo,
  IOM/NASEM/EFSA/WHO):
  - `iron`: 45 mg
  - `calcium`: 2500 mg
  - `zinc`: 40 mg
  - `magnesium`: 350 mg (UL áp cho magie bổ sung, dùng làm mốc tham khảo
    chung)
  - `sodium`: 2300 mg (mốc "nạp cao", không phải UL nghiêm ngặt kiểu IOM)
  - `salt`: 5.75 g (suy ra từ mốc sodium 2300 mg × 2.5 / 1000)
  - Chất không có UL rõ ràng (fiber, omega3, fat, sugar, potassium)
    **không có trong bảng** → không bao giờ cảnh báo.
- **MỚI** `src/domain/nutrition/overdoseWarning.ts`: hàm thuần
  `computeOverdoseWarnings(micros: MicroBatteryState[]): OverdoseWarning[]`.
  Chỉ so `micro.current > UL.value`. Câu thông báo đúng mẫu:
  `"{nameVi}: đã nạp {current}{unit}, vượt mức dung nạp tối đa tham khảo
  ({limit}{unit}). Nếu bạn đang dùng nhiều thực phẩm chức năng cùng loại,
  cân nhắc giảm bớt. Chỉ để tham khảo, không thay lời khuyên y tế."`
- **MỚI** `src/components/OverdoseNotice.tsx`: nhận `states:
  MicroBatteryState[]` (tái dùng đúng mảng micro đã tính trong
  `MicroBatteryStack`, không tạo đường dữ liệu mới), tự gọi
  `computeOverdoseWarnings`, không render gì khi rỗng; card tối màu đồng bộ
  theme (nền `#2a1f1a`, viền `#5a4030`, chữ cam `#E17055`/`#c9a892`).
  Đã gắn vào cuối `MicroBatteryStack.tsx` (dưới nhóm "Muối & điện giải").

## Test (TDD — viết test trước khi code)

- `src/domain/nutrition/__tests__/microBatteryEngine.test.ts`: 2 test mới
  — muối = natri×2.5/1000, và pin muối tự xuất hiện/flag "vượt" khi natri
  cao, không cần đường nhập liệu riêng.
- `src/lib/__tests__/nutrientTargets.test.ts` (mới): không trùng id giữa
  các nhóm hiển thị, `ELECTROLYTE_IDS` đúng 4 phần tử, mốc muối = 5 g/ngày.
- `src/domain/nutrition/__tests__/overdoseWarning.test.ts` (mới): cảnh báo
  nổ khi vượt UL, im lặng khi trong ngưỡng, im lặng với chất không có UL
  (fiber), message chứa "tham khảo" và KHÔNG chứa "nguy hiểm"/"chẩn đoán",
  nhiều cảnh báo độc lập cùng lúc.

## Kết quả verify (chạy đúng lúc báo cáo)

```
npx tsc --noEmit   → sạch (0 lỗi)
npx jest           → Test Suites: 25 passed, 25 total / Tests: 239 passed, 239 total
npm run lint       → sạch (0 lỗi, 0 cảnh báo)
```

## Không đụng phạm vi của agent khác

Xác nhận qua `git status --short`: KHÔNG sửa `src/components/
SupplementQuickLog.tsx`, `src/components/FoodLogModal.tsx`, hay bất kỳ file
nào trong `src/services/export/*` — các thay đổi hiện có ở những file đó
(`FoodLogModal.tsx`, `excelExportService.ts`, `services/export/__tests__/`,
`monthRange.ts`, `monthlyAutoExport.ts`, `domain/nutrition/excelSheets.ts`)
là của (các) agent khác đang chạy song song, đã có mặt trước khi tôi bắt
đầu (kiểm chứng bằng `git stash`) và không bị tôi động vào.

## File đã thêm/sửa (đường dẫn tuyệt đối)

Mới:
- `/Users/minh/VSCode_Repo/BodyBatteries/src/lib/upperLimits.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/domain/nutrition/overdoseWarning.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/components/OverdoseNotice.tsx`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/lib/__tests__/nutrientTargets.test.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/domain/nutrition/__tests__/overdoseWarning.test.ts`

Sửa:
- `/Users/minh/VSCode_Repo/BodyBatteries/src/types/nutrition.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/lib/nutrientTargets.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/domain/nutrition/microBatteryEngine.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/domain/nutrition/nutritionAssessment.ts`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/components/MicroBatteryStack.tsx`
- `/Users/minh/VSCode_Repo/BodyBatteries/src/domain/nutrition/__tests__/microBatteryEngine.test.ts`

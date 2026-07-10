# S-S6 · QA review — "Cập nhật lịch sử" (backfill món ăn ngày đã qua)

> Vai trò: qa-reviewer, READ-ONLY (không sửa code). Đọc trước:
> `.ai/parallel-reports/S-S-backfill-spec.md` (mục 4 = tiêu chí nghiệm thu),
> `.ai/NEXT_SESSIONS.md` mục S-S. File soát: `src/domain/food/backfillEngine.ts` (+test),
> `src/store/energyStore.ts` (logFoodForPastDate/removeFoodForPastDate + modeIdForDate,
> +test `energyStore.backfill.test.ts`), `src/components/food/PastDateField.tsx`,
> `src/components/DayDetailSheet.tsx`, `src/components/FoodLogModal.tsx` (initialDate/logDate/
> buildTimestampForDate/nhánh chip gợi ý), `src/screens/HistoryScreen.tsx`.

## 0. Baseline (kết quả THẬT, không bịa)

```
npx tsc --noEmit    → sạch, exit 0
npx jest             → 350 PASS / 32 suite, 0 fail
npx eslint .          → sạch, 0 error / 0 warning
```

## 1. Danh sách bug / nghi vấn — xếp theo mức độ

### 🔴 Nghiêm trọng

**BUG-1 — Không có khoá chống double-tap trên nút "Ghi món 🍽️" và chip "Gợi ý cho bữa này",
có thể nạp dinh dưỡng SAI (thiếu hoặc thừa) một cách âm thầm.**

- File: `src/components/FoodLogModal.tsx`
  - `confirm()` dòng 255–286 — nút "Ghi món 🍽️" (dòng 616–627) chỉ `disabled={!validAmount}`,
    KHÔNG có cờ "đang lưu" để tự khoá trong lúc `await logFood(...)`/`await
    logFoodForPastDate(...)` đang chạy.
  - `logSuggestion()` dòng 293–323 — chip gợi ý (dòng 417–426) cũng không có khoá tương tự.
  - So sánh: `saveCustomFood()` (dòng 227–236) trong CÙNG FILE này lại CÓ đúng cơ chế
    (`savingCustomFood` state, dòng 116, 228–229, 384) — tức là pattern đúng đã tồn tại sẵn
    trong file, chỉ chưa được áp dụng cho 2 nút còn lại.
- Id của 1 dòng `food_log` là `food_${timestamp}_${item.id}` (deterministic, không có phần
  ngẫu nhiên) — xem `energyStore.ts` dòng 506 (`logFood`) và dòng 656 (`logFoodForPastDate`).
  `food_log.id` là `PRIMARY KEY` (`src/data/db/schema.ts` dòng 94), và
  `foodLogRepository.addFoodLogEntry` dùng `INSERT` thường (không `OR REPLACE`/`OR IGNORE`) —
  insert trùng id sẽ NÉM LỖI, bị `catch (e) { console.warn(...) }` **nuốt âm thầm**, người
  dùng không thấy thông báo gì, vẫn nhận haptic "success" + modal đóng như bình thường.
- Hậu quả cụ thể theo 2 luồng:
  - **Luồng HÔM NAY** (`logFood`, `energyStore.ts` dòng 477–538): phần `set({ readings,
    foodLog, ... })` chạy ĐỒNG BỘ trước `await` đầu tiên. Với 2 lần bấm rời nhau (2 sự kiện
    onPress riêng biệt), lần bấm thứ 2 chắc chắn đọc `get().readings`/`get().foodLog` ĐÃ bị
    lần 1 cập nhật rồi mới cộng tiếp — nghĩa là **pin bị nạp dư 2 lần chắc chắn xảy ra**
    (không phải may rủi), trong khi DB chỉ giữ được 1 dòng `food_log` (dòng thứ 2 insert lỗi,
    bị nuốt) → sau khi tắt/mở lại app, danh sách món ăn hiển thị đúng 1 món nhưng % pin đã bị
    cộng dư vĩnh viễn, không có cách nào tự sửa qua UI.
  - **Luồng NGÀY QUÁ KHỨ** (`logFoodForPastDate`, đoạn "Historical targets" dòng 700–729):
    đọc-sửa-ghi qua `getReadingsForDate` → tính toán → `upsertReadings`, KHÔNG bọc
    transaction/khoá giữa đọc và ghi → 2 lần gọi gần nhau (double-tap) **đua nhau (race)**:
    tuỳ thời điểm interleave có thể mất-cập-nhật (may mắn chỉ nạp 1 lần) HOẶC nạp đôi — không
    đảm bảo, và luôn có ít nhất 1 lần `addFoodLogEntry` lỗi trùng khoá bị nuốt âm thầm như
    trên. Đây chính là kịch bản người giao việc nêu: *"2 lần cùng MỘT món cùng ngày với giờ
    trống → cùng timestamp 12:00 → id TRÙNG"* — xác nhận **có thật**, không phải lo ngại suông.
  - **Trường hợp đặc biệt đáng chú ý nhất:** nếu double-tap rơi đúng lúc energy-day của ngày
    backfill trùng energy-day hôm nay (khung 0h–6h, spec 3c), phần nạp đôi sẽ áp thẳng vào
    `readings` **trong RAM của hôm nay** (nhánh "targeted" dòng 676–695) → tức là double-tap
    lúc đó CÓ THỂ làm sai số hiển thị trên Home ngay lập tức, dù về mặt thiết kế route đó
    đúng ý đồ (energy-day trùng hôm nay → nạp vào store) — chỉ sai vì bị nhân đôi.
- Đề xuất sửa (không tự làm, để agent logic-backend/mobile-frontend quyết định): (a) thêm
  state `submitting` disable nút Ghi + chip gợi ý, đúng pattern `savingCustomFood` đã có sẵn
  trong file; và/hoặc (b) đổi `food_log.id` sang có thêm hậu tố khó trùng (ví dụ số ngẫu nhiên
  nhỏ như `activity_log` đã làm ở dòng 878: `Math.round(Math.random() * 1e6)`); và/hoặc
  (c) đổi `INSERT` thành `INSERT OR IGNORE` + kiểm tra số dòng thực sự được ghi trước khi coi
  là thành công.

**BUG-2 — `removeFoodForPastDate` KHÔNG idempotent: gọi 2 lần cùng 1 entry (double-tap nút
xoá) sẽ ĐẢO (trừ) dinh dưỡng/kcal của cùng một món HAI LẦN trên dữ liệu ngày lịch sử.**

- File: `src/store/energyStore.ts` dòng 736–788 (`removeFoodForPastDate`).
- Với entry KHÔNG nằm trong `foodLog` (RAM hôm nay) — tức mọi trường hợp xoá món backfill từ
  `DayDetailSheet` cho ngày quá khứ — hàm này **tin tưởng hoàn toàn vào object `entry` được
  truyền vào**, không kiểm tra hàng đó còn tồn tại trong DB hay đã bị xoá trước đó. Gọi lần 2
  vẫn chạy y hệt: đọc lại readings của ngày đó (dòng 767–780), trừ tiếp một lần dinh dưỡng
  nữa qua `reverseFoodOnDayReadings`, rồi `deleteFoodLogEntry(entry.id)` lần 2 chỉ là
  `DELETE ... WHERE id = ?` không ảnh hưởng dòng nào — **không có lỗi nào để chặn lần gọi
  thứ 2 lại**.
- So sánh: `removeFood` (luồng hôm nay, dòng 544–599) tự bảo vệ được vì tìm entry trong
  `foodLog` STATE trước (`const entry = foodLog.find(...); if (!entry) return;`) — sau lần
  xoá đầu, entry đã bị `set()` lọc khỏi state, lần gọi 2 sẽ dừng ngay từ dòng đầu. Cơ chế bảo
  vệ tương đương này KHÔNG tồn tại cho nhánh lịch sử của `removeFoodForPastDate`.
- File liên quan: `src/components/DayDetailSheet.tsx` nút xoá (dòng 112–121) không có cờ
  "đang xoá" theo id để tự chặn double-tap; `Alert.alert` (dòng 91–100) hiển thị confirm
  trước khi gọi `onDeleteEntry`, nhưng nếu người dùng bấm ✕ nhiều lần liên tiếp trước khi
  Alert đầu tiên kịp hiện, native alert có thể xếp hàng và fire `onDeleteEntry` nhiều lần cho
  cùng 1 entry (chưa kiểm chứng được trên máy thật vì đây là hành vi runtime iOS — đưa vào
  checklist test tay bên dưới).
- Đề xuất sửa: kiểm tra hàng `food_log` còn tồn tại trước khi đảo readings (ví dụ đổi
  `deleteFoodLogEntry` trả về số dòng bị xoá, chỉ đảo readings nếu > 0), và/hoặc chặn
  double-tap ở `DayDetailSheet` bằng cờ "deleting" theo id (ẩn/disable nút ✕ ngay khi bấm).

### 🟡 Nên sửa

**ISSUE-3 — `PastDateField.tsx` `activeChip` gọi `daysAgo()` trực tiếp trong thân `useMemo`
chạy khi render, không qua wrapper module-level.**
- File: `src/components/food/PastDateField.tsx` dòng 129–136.
- File này đã tự đặt ra quy ước "wrapper module-level để giấu Date khỏi purity check"
  (`getTodayString`/`getCurrentYear`, dòng 14–20, đúng comment ghi ở dòng 12–13) nhưng
  `activeChip` lại gọi thẳng `daysAgo(chip.days)` (hàm đọc `new Date()` mỗi lần) ngay trong
  render. Hiện `npx eslint .` vẫn sạch (không bị chặn), rủi ro thực tế thấp (chỉ lệch nếu
  render đúng lúc vắt qua nửa đêm), nhưng không nhất quán với quy ước chính file này đề ra —
  nên đổi sang tính từ `today` đã memoized (dòng 76) thay vì gọi lại `daysAgo` sống.

**ISSUE-4 — Chuỗi ghi/xoá backfill không bọc transaction xuyên suốt, dễ mất đồng bộ nếu app
bị thoát giữa chừng.**
- File: `src/store/energyStore.ts`, `logFoodForPastDate` (dòng 632–731) và
  `removeFoodForPastDate` (dòng 736–788) — chuỗi tới 4–5 lệnh `await` tuần tự
  (`getReadingsForDate` → `upsertReadings` → `upsertDailyLog` → `addFoodLogEntry`/
  `deleteFoodLogEntry`), không có transaction bao ngoài. Nếu người dùng thoát app ngay sau
  khi bấm Ghi/Xoá (rất dễ xảy ra trên điện thoại thật), có thể để lại readings đã đổi nhưng
  `food_log` chưa ghi (hoặc ngược lại) — lệch vĩnh viễn, không có cơ chế tự phục hồi. Đây là
  rủi ro có sẵn từ pattern cũ (`logFood`/`removeFood` cũng vậy), không phải lỗi riêng của
  S-S, nhưng backfill có chuỗi dài hơn nên cửa sổ rủi ro dài hơn — ghi nhận để biết, không
  chặn "xong".

**ISSUE-5 — `backfillEngine.ts` chỉ charge đúng 4 loại pin vi chất (protein/carbs/water/
minerals) + energy — hiện KHỚP với `energyStore.logFood`, nhưng là điểm dễ vỡ về sau.**
- File: `src/domain/food/backfillEngine.ts` dòng 79–91 (`nutrientCharges`).
- Hiện tại không có bug (logFood ở `energyStore.ts` dòng 486–491 cũng chỉ charge đúng 4 loại
  này), nhưng nếu sau này có gói thêm pin vi chất mới nạp trực tiếp vào `readings` (ví dụ đổi
  muối/omega-3 từ "derived từ nhật ký" — `microBatteryEngine.ts` — sang pin riêng trong
  `readings`), bắt buộc phải patch ĐỒNG THỜI cả `backfillEngine.ts` lẫn
  `energyStore.logFood`/`removeFood`, nếu không backfill sẽ lặng lẽ bỏ sót loại pin mới. Đúng
  bài học đã ghi trong bộ nhớ dự án ("FoodItem field join points"). Ghi chú phòng ngừa cho
  phiên sau, không phải bug hiện tại.

### 🟢 Nhỏ nhặt

**ISSUE-6** — `DayDetailSheet.tsx` dòng 125: `renderSectionHeader = ({ section }: { section:
any }) => ...` dùng `any`. Không gây lỗi (dự án hiện không chặn `no-explicit-any`), nhưng nên
gõ kiểu `{ title: string; mealType: MealType; data: FoodLogEntry[] }` cho rõ ràng.

**Không phát hiện vi phạm ranh giới sức khoẻ** (CONTEXT mục 5): các dòng chữ mới —
"🕓 Ghi cho ngày…" (`FoodLogModal.tsx` dòng 604–606), "Chưa ghi món nào cho ngày này"
(`DayDetailSheet.tsx` dòng 131), "Bạn chắc chắn muốn xoá…" (dòng 92) — đều trung tính, không
phán xét, không hù doạ, không liên quan chẩn đoán sức khoẻ.

## 2. Trả lời trực tiếp 8 điểm được giao rà soát

1. **Rò rỉ đổi số hôm nay:** đã rà kỹ, mọi nhánh dùng đúng `calendarIsCurrent`/
   `energyIsCurrent` để quyết định ghi RAM hay ghi row rời; test snapshot xác nhận không đổi
   khi backfill đơn lẻ, đúng luồng. **Rủi ro duy nhất đổi số hôm nay là BUG-1** (double-tap
   rơi vào khung 0h–6h trùng energy-day hôm nay → nạp đôi thẳng vào RAM hôm nay).
2. **Case 0h–6h (spec 3c):** đúng cho cả chiều ghi (có test `energyStore.backfill.test.ts`
   "0h-6am overlap") lẫn chiều xoá (code mirror đúng, nhưng **chưa có test riêng cho chiều
   xoá trong khung 0h-6h** — chỉ có test round-trip ở giờ trưa bình thường; đề xuất bổ sung
   test cho phiên sau, rủi ro code sai thấp vì logic đối xứng rõ ràng).
3. **Double-tap tạo 2 entry trùng id:** **XÁC NHẬN CÓ BUG** — xem BUG-1.
4. **Xoá món backfill đảo đúng vi chất+kcal / xoá 2 lần có đảo 2 lần không:** đảo đúng cho 1
   lần xoá (test round-trip pass). **Xoá 2 lần: XÁC NHẬN CÓ BUG** — xem BUG-2.
5. **Excel export:** `excelExportService.ts`/`monthlyAutoExport.ts` đọc `getFoodLogInRange`
   thẳng từ bảng `food_log` (không qua RAM `store.foodLog`) → món backfill xuất hiện đúng
   ngày theo `timestamp`, không phát hiện bug riêng ở export. Phụ thuộc gián tiếp vào BUG-1
   (nếu double-tap làm mất 1 trong 2 lần ghi do trùng khoá, export vẫn "đúng" vì chỉ có 1 row
   thật tồn tại — export tự nó không sai, chỉ `readings`/pin % có thể sai).
6. **Luồng ghi món HÔM NAY còn nguyên hành vi cũ:** xác nhận qua đọc code — nhánh
   `if (isToday(logDate))` trong `confirm()`/`logSuggestion()` gọi `logFood`/
   `timestampForToday`/`nowTimestamp()` y hệt trước khi có S-S, chỉ thêm nhánh `else` mới bên
   cạnh. Custom food, suggestion chip vẫn hoạt động. Không thấy hồi quy — ngoại trừ BUG-1 vốn
   áp dụng cho CẢ 2 luồng (không phải lỗi riêng do S-S sinh ra, nhưng nằm chung nhóm vấn đề
   nên báo cáo gộp).
7. **Ranh giới sức khoẻ:** trung tính, không vi phạm — xem cuối mục 1.
8. **PastDateField parse dd/mm quanh giao thừa năm:** kiểm tra bằng tay logic
   `parseDdMmInput` (dòng 44–70) — ví dụ đang ở tháng 1/2026, nhập "31/12": `year =
   getCurrentYear() = 2026` → candidate = 31/12/2026 → so với `today` ("2026-01-xx") →
   candidate > today → lùi 1 năm → 31/12/2025. **Đúng như mong đợi.** Không phát hiện bug ở
   điểm này.

## 3. CHECKLIST TEST MÁY (tiếng Việt) — bấm thử trên iPhone qua Expo Go

Chạy `npx expo start` (hoặc `--tunnel` nếu wifi chặn), mở Expo Go, quét QR. Thực hiện lần
lượt, xác nhận từng bước trước khi qua bước sau. Ghi lại bước nào sai + ảnh chụp nếu có.

**A. Luồng cơ bản (bắt buộc — theo spec mục 4)**

1. Vào tab **Lịch sử** → chạm vào thẻ ngày **hôm qua** → bottom sheet "Chi tiết ngày" hiện ra.
   - Nếu hôm qua chưa có dữ liệu: hiện dòng "Chưa ghi món nào cho ngày này" (không lỗi/crash).
2. Bấm **"＋ Thêm món cho ngày này"** → modal Ghi món ăn mở ra, thấy dòng
   **"🕓 Ghi cho ngày [thứ, hôm qua]"** ngay trên nút Ghi. Chọn 1 món, nhập khối lượng, bấm
   **Ghi món 🍽️** đúng **1 LẦN** (không bấm 2 lần liên tiếp — sẽ test double-tap ở mục B).
3. Đóng modal → quay lại Lịch sử → thẻ ngày hôm qua đổi %, biểu đồ xu hướng (TrendChart) phía
   trên cũng đổi theo. Kéo xuống xem **màn Home (Trang chủ)** — pin hôm nay **KHÔNG đổi số**
   (so % trước/sau, phải y hệt).
4. Chạm lại thẻ ngày hôm qua → thấy món vừa thêm trong danh sách, đúng bữa (sáng/trưa/tối)
   theo giờ đã chọn.
5. Bấm nút **✕** cạnh món vừa thêm → hộp thoại xác nhận "Bạn chắc chắn muốn xoá..." → bấm
   **Xoá** → % của ngày hôm qua **quay về đúng như trước khi thêm** (so lại thẻ ngày).

**B. Ngày trống hoàn toàn (chưa từng mở app hôm đó)**

6. Chọn 1 ngày **3 ngày trước** mà chắc chắn chưa mở app (hoặc test trên máy mới cài) → vào
   Lịch sử, thẻ ngày đó KHÔNG tồn tại trong danh sách (bình thường, vì Lịch sử chỉ hiện ngày
   có dữ liệu).
   - Mở modal Ghi món từ Home (nút "+") → gõ ô ngày `dd/mm` đúng ngày 3 hôm trước (hoặc bấm
     chip "2 ngày trước" nếu gần đúng) → chọn món, Ghi.
   - Vào Lịch sử → ngày đó **xuất hiện** trong danh sách 7 ngày với % hợp lý (không phải 0%
     hay giá trị âm/vô lý).

**C. Nghi vấn BUG-1 — double-tap nút Ghi / chip gợi ý (QUAN TRỌNG NHẤT)**

7. Mở modal Ghi món, chọn ngày **hôm qua**, chọn 1 món, nhập khối lượng → **bấm nút "Ghi món
   🍽️" 2 LẦN THẬT NHANH** (gần như liên tiếp, trong vòng dưới nửa giây).
   - Kỳ vọng ĐÚNG: chỉ 1 món được ghi, pin ngày hôm qua chỉ tăng đúng 1 lần lượng dinh dưỡng
     của món đó.
   - Nếu SAI (đúng nghi vấn BUG-1): pin ngày hôm qua tăng gấp đôi (hoặc số liệu bất thường)
     dù trong danh sách chi tiết ngày chỉ thấy 1 dòng món ăn.
8. Lặp lại y hệt bước 7 nhưng cho **HÔM NAY** (không đổi ngày) — bấm "Ghi món 🍽️" 2 lần
   thật nhanh cho cùng 1 món. Kỳ vọng ĐÚNG: pin hôm nay chỉ tăng 1 lần. Nếu tăng gấp đôi →
   xác nhận BUG-1 cũng ảnh hưởng luồng hôm nay.
9. Mở modal, tìm món → khi thấy chip **"Gợi ý cho bữa này"** hiện ra, bấm **1 chip gợi ý 2 lần
   thật nhanh** → kỳ vọng chỉ ghi 1 lần; kiểm tra pin có tăng gấp đôi không.

**D. Nghi vấn BUG-2 — double-tap xoá món backfill**

10. Thêm 1 món cho ngày quá khứ (như bước 2), mở lại chi tiết ngày đó, bấm nút ✕ của món đó
    → khi hộp thoại "Bạn chắc chắn muốn xoá..." hiện ra, bấm nút **"Xoá" 2 lần thật nhanh**
    nếu máy cho phép (hoặc bấm ✕ 2 lần liên tiếp trước khi hộp thoại đầu tiên kịp hiện, xem
    có 2 hộp thoại xếp chồng không).
    - Kỳ vọng ĐÚNG: pin ngày đó quay về đúng % ban đầu (như trước khi thêm món), không âm/
      không lệch thêm.
    - Nếu SAI (đúng nghi vấn BUG-2): pin ngày đó bị **trừ quá tay** (thấp hơn cả mức trước
      khi thêm món) — đây là dấu hiệu bị đảo 2 lần.

**E. Cạnh khó 0h–6h sáng (spec 3c) — cần chỉnh giờ máy**

11. Chỉnh giờ điện thoại (Cài đặt → Cài đặt chung → Ngày giờ, tắt "Tự động") về khoảng **2 giờ
    sáng**. Mở app, vào Home xem % pin "Sổ calo" hiện tại (đây là energy-day của HÔM QUA vì
    chưa qua mốc 6h).
    - Mở modal Ghi món, chọn ngày **hôm qua**, đặt giờ ăn **23:00**, ghi 1 món.
    - Kỳ vọng ĐÚNG: pin "Sổ calo" trên Home **tăng ngay lập tức** (vì energy-day của món này
      trùng energy-day đang mở), còn các pin vi chất (Đạm/Carbs/Nước/Khoáng) trên Home
      **KHÔNG đổi** (vì món này thuộc ngày lịch hôm qua, không phải hôm nay).
    - Vào Lịch sử, xem thẻ ngày hôm qua — vi chất của ngày hôm qua có tăng đúng.
    - Chỉnh giờ máy về lại "Tự động" sau khi test xong.

**F. Ô nhập ngày dd/mm quanh giao thừa năm**

12. Vào modal Ghi món, ở ô "Ngày ghi" gõ tay `31/12` (nếu hiện tại đang ở tháng 1 hoặc tháng 2
    của năm mới) → kỳ vọng ô ngày nhảy về đúng **31/12 năm TRƯỚC** (không phải năm nay), dòng
    hiển thị bên dưới ghi đúng ngày đó. Nếu ngoài phạm vi 35 ngày cho phép, sẽ hiện dòng lỗi đỏ
    "Chỉ có thể ghi lùi tối đa 35 ngày" — đó là đúng, không phải bug.

**G. Excel export có món backfill**

13. Vào Cài đặt (hoặc nơi có nút xuất Excel tuần) → xuất file → mở file trên máy tính/điện
    thoại → tìm đúng ngày đã backfill ở bước 2/6 → xác nhận món ăn đó xuất hiện đúng dòng,
    đúng ngày, số kcal khớp với đã ghi trong app.

**H. Hồi quy luồng cũ (không được hỏng)**

14. Ghi 1 món cho **HÔM NAY** theo cách bình thường (không đổi ngày) — xác nhận mọi thứ y hệt
    trước khi có tính năng backfill: pin cập nhật, món hiện trong "Hôm nay đã ăn", sửa/xoá món
    vẫn hoạt động.
15. Bấm "➕ Thêm món mới" (custom food) cho **HÔM NAY** — xác nhận vẫn lưu được, không bị ảnh
    hưởng bởi thay đổi của gói S-S.
16. Bấm "✎ Sửa thành phần" cho 1 món — xác nhận modal vẫn mở đúng (đây là bug 3d đã vá ở
    session trước, kiểm tra lại không bị hồi quy do S-S đụng chung `FoodLogModal.tsx`).

---

**Tóm tắt cho người giao việc:** 2 bug nghiêm trọng (double-tap khi Ghi có thể nạp dư dinh
dưỡng âm thầm — BUG-1; double-tap khi Xoá món backfill có thể trừ dư dinh dưỡng âm thầm —
BUG-2), cả hai đều do thiếu khoá chống double-tap dù pattern đúng (`savingCustomFood`) đã có
sẵn ngay trong cùng file để tham khảo. 3 việc nên sửa mức thấp hơn (ISSUE-3/4/5), không chặn
"xong" nhưng nên biết. Baseline tự động (tsc/jest/eslint) hoàn toàn sạch — mọi bug ở trên đều
thuộc loại race-condition/UI-timing mà test tự động khó phủ hết, cần xác nhận qua checklist
test tay ở mục 3 (đặc biệt mục C và D).

---

## ✅ Cập nhật sau review (phiên điều phối, 2026-07-10)

Đã vá ngay trong phiên, xác minh lại tsc + jest (351/351) + eslint toàn repo + expo export sạch:
- **BUG-1 (vá):** thêm cờ `savingFood` khoá double-tap cho cả `confirm()` lẫn `logSuggestion()`
  trong `FoodLogModal.tsx` (mirror pattern `savingCustomFood`); nút "Ghi món 🍽️" disable +
  mờ khi đang lưu; reset trong `reset()`.
- **BUG-2 (vá):** `removeFoodForPastDate` thêm guard idempotence — kiểm tra entry còn trong
  `food_log` (`getFoodLogForDate`) trước khi đảo; gọi lần 2 thành no-op. Kèm test mới
  "is idempotent" trong `energyStore.backfill.test.ts` (351 test).
- **ISSUE-3 (vá):** `PastDateField.tsx` thêm helper thuần `dateDaysBefore(todayStr, n)`;
  `validateDate`/`handleQuickSelect`/`activeChip` đều neo vào `today` memoized, bỏ import
  `daysAgo` sống.
- **ISSUE-6 (vá):** `DayDetailSheet.tsx` thay `section: any` bằng interface `MealSection`.
- **ISSUE-4 (KHÔNG vá đợt này):** thiếu transaction xuyên suốt là pattern có sẵn của cả
  logFood/removeFood — để gói riêng nếu muốn làm, đừng vá lẻ một nhánh.
- **ISSUE-5 (ghi nhận):** đã bổ sung `backfillEngine.nutrientCharges` vào memory
  "FoodItem field join points" — pin vi chất mới trong tương lai phải patch đồng thời.

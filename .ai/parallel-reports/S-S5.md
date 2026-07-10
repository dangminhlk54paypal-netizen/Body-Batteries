# S-S5 — Nối UI: Lịch sử + FoodLogModal (backfill) (2026-07-10)

- Làm gì: nối 2 lối vào của tính năng "ghi lùi món ăn cho ngày đã qua" (backfill)
  đã có sẵn engine/store/component rời từ các gói S-S1→S-S4 (đã merge, verify
  trước khi bắt đầu: `backfillEngine.ts`, `PastDateField.tsx`, `DayDetailSheet.tsx`,
  `energyStore.logFoodForPastDate`/`removeFoodForPastDate` đều đã tồn tại, 350/350
  test PASS). Đợt này CHỈ nối UI, không sửa domain/store.

- File đã sửa (đúng 2 file được giao, không đụng file nào khác):
  - `src/screens/HistoryScreen.tsx` — mỗi thẻ ngày giờ là `Pressable` → mở
    `DayDetailSheet` (state `sheetDate`/`sheetVisible`/`sheetEntries`/`sheetLoading`).
    `fetchDayEntries(date)` gọi `getFoodLogForDate(date)` khi mở sheet, có loading
    state. `onDeleteEntry` → `useEnergyStore.getState().removeFoodForPastDate(entry)`
    rồi refetch entries + `loadHistory()` (để % thẻ ngày cập nhật). `onAddFood` →
    đóng sheet, mở `FoodLogModal` với `initialDate = sheetDate`; khi FoodLogModal
    đóng (`handleAddFoodModalClose`) → refetch entries + `loadHistory()` (chạy dù
    huỷ hay ghi thành công — rẻ và luôn đúng).
  - `src/components/FoodLogModal.tsx` — thêm prop tuỳ chọn `initialDate?: string`
    (mặc định hôm nay, không đổi hành vi mọi nơi gọi cũ như `EnergyActionsBar`).
    State `logDate` được seed bằng `initialDate ?? today` mỗi lần modal MỞ, dùng
    đúng pattern "adjust state during render" (so `visible` với `wasVisible` tracked
    trong state — giống `FoodNutritionEditModal`) để không vi phạm
    `react-hooks/set-state-in-effect`. `reset()` luôn trả `logDate` về hôm nay (mở
    tiếp từ Home không dính ngày cũ; mở lại từ History với `initialDate` mới vẫn
    seed lại đúng vì logic seed dựa trên transition `visible: false→true`, không
    phải so sánh giá trị `initialDate`). Render `PastDateField` (props
    `{value: logDate, onChange: setLogDate, maxDaysBack: DATA_RETENTION_DAYS}`)
    ngay dưới hàng giờ:phút trong màn hình chọn khối lượng. Khi `!isToday(logDate)`
    → hiện dòng "🕓 Ghi cho ngày {formatDisplayDate(logDate)}" ngay phía trên hàng
    nút Huỷ/Ghi món. `confirm()` và `logSuggestion()` (chip gợi ý) đều rẽ nhánh
    `isToday(logDate)`: nhánh hôm nay giữ NGUYÊN 100% code cũ (`logFood` +
    `timestampForToday`/`nowTimestamp`); nhánh ngày quá khứ gọi
    `useEnergyStore().logFoodForPastDate(item, grams, timestamp, portion)` với
    timestamp dựng bởi helper thuần module-level mới `buildTimestampForDate(dateStr,
    hourStr, minuteStr)` (export sẵn, có thể unit-test dù đợt này không viết test —
    khác `timestampForToday` cũ vì KHÔNG đọc ngày hiện tại, giờ/phút trống mặc định
    12:00 theo đúng spec 3b/3d).
  - Quyết định thêm ngoài lời giao việc theo nghĩa đen (đáng ghi lại): route CẢ
    suggestion-chip logging (`logSuggestion`) qua nhánh `isToday`/backfill, không
    chỉ nút "Ghi món" chính. Lý do: nếu để nguyên, bấm chip gợi ý khi đang chọn
    ngày quá khứ (từ History) sẽ âm thầm ghi vào HÔM NAY (chip cũ luôn dùng
    `nowTimestamp()`) — sai dữ liệu, đúng loại lỗi mà tính năng backfill này sinh
    ra để tránh. Vẫn tuân thủ "không đổi hành vi hôm nay" vì nhánh `isToday(logDate)
    === true` cho suggestion chip y hệt code gốc.

- Kết quả:
  - `npx tsc --noEmit` → sạch (exit 0).
  - `npx jest` → **350/350 test PASS / 32 suite** (không giảm so với trước khi bắt đầu).
  - `npx eslint src/screens/HistoryScreen.tsx src/components/FoodLogModal.tsx` →
    0 error, 0 warning. `npx eslint .` (toàn repo) cũng sạch.
  - Không chạy `expo export` theo đúng yêu cầu người giao việc (bỏ qua bước đó).
  - KHÔNG commit (theo yêu cầu).

- Bug/vấn đề phát hiện (không tự sửa file ngoài phạm vi):
  - Không phát hiện hợp đồng props nào của `PastDateField`/`DayDetailSheet` không
    khớp nhu cầu — cả hai dùng đúng như spec 3d, không cần sửa.
  - `DayDetailSheet` tự hiện `Alert.alert` xác nhận xoá trước khi gọi
    `onDeleteEntry` — HistoryScreen không cần tự thêm confirm dialog nữa (đã đúng
    hành vi mong muốn, không phải bug).

- Còn lại / bàn giao:
  - **QUAN TRỌNG — không có test tự động nào phủ 2 file UI vừa sửa** (component
    RN nối store thật + navigation qua bottom sheet) — bắt buộc người dùng test tay
    trên điện thoại trước khi commit. Checklist tối thiểu (theo spec mục 4 "Kiểm
    thử tay"):
    1. Lịch sử → chạm thẻ ngày hôm qua → sheet mở, hiện đúng danh sách món (hoặc
       "Chưa ghi món nào cho ngày này" nếu trống) → không văng lỗi.
    2. Trong sheet, bấm "＋ Thêm món cho ngày này" → sheet đóng, FoodLogModal mở,
       hiện đúng ngày (chip "Hôm qua" được tô sáng trong PastDateField) → chọn 1
       món, nhập gram, bấm "Ghi món 🍽️" → thấy dòng "🕓 Ghi cho ngày …" trước khi
       bấm → sau khi ghi, mở lại thẻ ngày đó thấy món mới + % thẻ ngày cập nhật;
       **Home (hôm nay) không đổi số nào**.
    3. Trong sheet, bấm ✕ xoá 1 món backfill vừa thêm → Alert xác nhận → xoá xong
       → % ngày đó quay lại như cũ, danh sách mất món đó.
    4. Backfill vào 1 ngày TRỐNG (chưa từng mở app, ví dụ 3 ngày trước) → ngày đó
       xuất hiện trong danh sách Lịch sử sau khi ghi (trước đó nó không có thẻ).
    5. Mở FoodLogModal từ nút "+" ở Home (không qua History) → mặc định vẫn là
       hôm nay, KHÔNG dính ngày quá khứ từ lần mở History trước đó.
    6. Thử chip gợi ý "Gợi ý cho bữa này" khi đang ở màn hình chọn ngày quá khứ
       (mở từ History) → xác nhận món được ghi vào ĐÚNG ngày đã chọn (dòng "🕓 Ghi
       cho ngày…" áp dụng ngay cả với luồng chip, xem ghi chú "Quyết định thêm" ở
       trên) — đây là điểm QA nên chú ý kỹ nhất vì không có test tự động.
    7. Luồng ghi món HÔM NAY bình thường (không qua History) — xác nhận không có
       hồi quy: chọn giờ, chip gram mặc định, "Thêm món mới", "Sửa thành phần" đều
       hoạt động y như trước.
  - Sau khi test tay ổn, gói kế tiếp theo kế hoạch là **S-S6** (qa-reviewer,
    read-only) rà soát toàn cụm rồi mới commit.

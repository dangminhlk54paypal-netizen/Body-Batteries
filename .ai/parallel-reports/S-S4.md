# S-S4 — Store: logFoodForPastDate / removeFoodForPastDate (2026-07-10)

- Làm gì: thêm 2 action backfill vào `src/store/energyStore.ts` đúng hợp đồng
  spec 3d, dùng backfillEngine (S-S1):
  - `logFoodForPastDate(item, grams, timestamp, portion?)` — vi chất nạp vào
    readings của NGÀY LỊCH của entry, kcal vào readings của ENERGY-DAY (reset
    6h); ngày chưa có readings → dựng bằng `buildReadingsForMissedDay` (mode
    lấy từ daily_logs của ngày đó qua `getDailyLog`, fallback
    `settingsStore.currentMode`); `upsertDailyLog` để History hiện ngày;
    entry ghi với `energyDayApplied`. Timestamp thuộc hôm nay (cả 2 khóa) →
    uỷ quyền `logFood`. Nhánh chồng ngày 0h–6h (spec 3c): đích trùng ngày đang
    load → áp vào store + persist (mirror pattern removeFood FIX #1); nếu
    calendar-day là hôm nay thì entry cũng được thêm vào `foodLog` RAM (đúng
    ngữ nghĩa "danh sách hôm nay theo ngày lịch" của loadToday).
  - `removeFoodForPastDate(entry)` — chiều đảo chính xác, target-by-target;
    entry đang nằm trong `foodLog` hôm nay → uỷ quyền `removeFood` (giữ
    nguyên xử lý satiety same-day sẵn có). Row ngày cũ đã bị cleanup xoá →
    bỏ qua reversal, vẫn xoá entry.
  - Cả 2 đường backfill KHÔNG BAO GIỜ đụng satietyReserveKcal/lastSatietySyncAt
    (test khẳng định pass-through từng byte).
- File đã tạo/sửa: SỬA `src/store/energyStore.ts` (import + interface + helper
  `modeIdForDate` + 2 action); TẠO `src/store/__tests__/energyStore.backfill.test.ts`.
- Kết quả: `tsc --noEmit` sạch ✅; jest riêng 7/7 pass ✅; **toàn bộ suite 32
  suites / 350 test pass** ✅ (không hồi quy). expo export chạy cuối cụm.
- Ghi chú vận hành: gói này do phiên điều phối (Fable) tự làm inline vì quota
  subagent bị khoá tới 18:50 (S-S1 từng bị đứt vì đúng giới hạn đó).
- Bug phát hiện: không.
- Còn lại / bàn giao cho S-S5: UI chỉ cần gọi
  `logFoodForPastDate`/`removeFoodForPastDate`; validate ngày ở UI bằng
  `validateBackfillDate` (backfillEngine) hoặc chặn sẵn trong PastDateField.

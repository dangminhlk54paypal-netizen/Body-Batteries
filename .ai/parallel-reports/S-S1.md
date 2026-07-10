# S-S1 — Engine thuần backfill (2026-07-10)

- Làm gì: TẠO `src/domain/food/backfillEngine.ts` (validateBackfillDate,
  applyFoodToDayReadings, reverseFoodOnDayReadings, buildReadingsForMissedDay —
  đúng hợp đồng spec 3d) + `src/domain/food/__tests__/backfillEngine.test.ts`.
- File đã tạo/sửa: chỉ 2 file trên (không sửa file có sẵn nào).
- Kết quả: `tsc --noEmit` sạch ✅; jest 23/23 pass ✅. (expo export để điều phối
  viên chạy cuối cụm S-S.)
- Ghi chú vận hành: phiên Sonnet chạy gói này bị đứt giữa chừng vì chạm session
  limit NGAY SAU khi code + tsc xong, trước bước jest + report; điều phối viên
  (phiên chính) đã chạy jest xác nhận 23/23 pass và ghi report này thay.
- Bug phát hiện: không.
- Còn lại / bàn giao cho S-S4: satietyReserveKcal/lastSatietySyncAt được
  buildReadingsForMissedDay CỐ Ý bỏ ngỏ (undefined) — caller quyết định có
  carry-over hay không (spec nói KHÔNG đụng); applyFoodToDayReadings không gọi
  eatIntoReserve — đúng bất biến.

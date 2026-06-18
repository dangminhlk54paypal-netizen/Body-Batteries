# S-B · Biểu đồ xu hướng tuần (Phase 3) — Báo cáo

**Trạng thái:** ✅ Hoàn thành

## File đã thay đổi
- TẠO `src/components/TrendChart.tsx` — component biểu đồ đường vẽ bằng `react-native-svg`
  (đã có sẵn trong dependencies, không cài thêm gì).
- SỬA `src/screens/HistoryScreen.tsx` — chèn `<TrendChart>` ngay dưới tiêu đề "Lịch sử 7 ngày",
  thêm hàm thuần `chronologicalTrend()` để đảo `days` (đang sắp mới→cũ cho danh sách thẻ)
  thành cũ→mới cho biểu đồ.

## Chi tiết kỹ thuật
- `TrendChart` nhận props `data: { date, averagePercentage }[]`, không tự query DB.
- Vẽ thủ công bằng `Svg`/`Line`/`Polyline`/`Circle`/`Text` của `react-native-svg`: 5 đường lưới
  mờ (0/25/50/75/100%), 1 đường polyline nối các điểm theo `averagePercentage`, mỗi điểm có
  nhãn ngày rút gọn (`formatDisplayDate` cắt 6 ký tự) phía dưới.
- Nếu `data.length < 2` → hiện "Chưa đủ dữ liệu để vẽ biểu đồ" (không vẽ trục để tránh chia 0
  hoặc biểu đồ vô nghĩa với 0–1 điểm).
- Màu nền card `#1a1a2e`, viền `#2d2d44`, đường biểu đồ `#00B894` — khớp tông tối + màu xanh
  "tốt" đã dùng trong `avgColor()` của màn Lịch sử.

## Kiểm tra
- `npx tsc --noEmit` → sạch, exit 0.
- `npx expo export --platform ios` → `iOS Bundled ... (1404 modules)` (tăng đúng 1 module so
  với mốc Session 4 là 1403, do thêm 1 file `TrendChart.tsx`). Không lỗi.

## Không đụng
Không sửa file nào ngoài 2 file nêu trên. Không sửa `package.json`, `App.tsx`,
`energyStore.ts`, các screen/component khác.

## Gợi ý cho phiên gộp sau
Khi chạy phiên gộp, có thể thêm dòng tick "Biểu đồ xu hướng tuần — Phase 3" đã xong trong
`docs/04-roadmap.md` và cập nhật `.ai/CONTEXT.md` mục 10.
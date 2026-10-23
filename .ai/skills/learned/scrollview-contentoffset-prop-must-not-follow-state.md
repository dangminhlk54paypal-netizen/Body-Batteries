# ScrollView `contentOffset` không được đi theo state → bấm sai ô, vuốt bị giật

**Bối cảnh:** Session 63, lịch tuần của trình tạo block (`components/training/BlockScheduleEditor.tsx`): dải T2…CN +
`ScrollView horizontal pagingEnabled`, mỗi ngày một trang.
**Triệu chứng:** bấm T4 thì ra T5, bấm T6 thì ra CN. Vuốt sang trong cùng ô thì trang bị kéo lệch trái/phải.
**Nguyên nhân gốc:** `contentOffset={{ x: page * width }}` với `page` được `onScroll` cập nhật liên tục. Trên iOS Fabric
(RN 0.88, `RCTScrollViewComponentView.mm` ~dòng 408) **mỗi lần prop `contentOffset` đổi là đặt lại vị trí cuộn ngay**,
không chờ ngón tay hay hiệu ứng. Nên đang kéo qua nửa trang thì offset bị giật về mép trang kế, còn khi bấm, hiệu ứng
cuộn đi qua ngày giữa sẽ kéo `page` (rồi offset) về ngày đó → dừng sai ô.
**Cách sửa đúng:**
- `contentOffset` chỉ đặt **một lần lúc mount**: `const [contentOffset] = useState(() => ({ x: initialPage * width, y: 0 }))`
  trong component pager riêng (`DayPager`). Pager remount (vd. sau khi đóng picker) thì lấy ngày đang mở lúc đó.
- Bấm dải ngày: ghi `tapTarget` ref, `setPage(i)`, `scrollTo({ animated: true })`; `onScroll` bỏ qua khi có `tapTarget`.
- `onScrollBeginDrag` xoá `tapTarget` (ngón tay giành quyền); `onMomentumScrollEnd` (chạy cả khi vuốt xong lẫn khi
  hiệu ứng `scrollTo` xong) chốt `page` và xoá `tapTarget`.
- Test hồi quy: `__tests__/BlockScheduleEditor.test.tsx` → `describe('BlockScheduleEditor pager')`.
**Dấu hiệu nhận biết lần sau:** bất kỳ `contentOffset={…state…}` nào trên ScrollView/FlatList — coi là bug cho tới khi
chứng minh state đó không đổi trong lúc cuộn.

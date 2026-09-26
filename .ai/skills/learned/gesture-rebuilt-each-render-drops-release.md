# Gesture tạo lại mỗi lần render → mất sự kiện "thả tay" (⚠ KHÔNG phải gốc lỗi bong bóng)

**Bối cảnh:** Session 53, thanh tab "sóng bong bóng" (`BubbleTabBar`) + vuốt dài đổi tab (`TabSwipe`).
**Triệu chứng:** lướt qua lại giữa các tab rồi thả tay, thanh tab/trang không về vị trí ban đầu; chỉ về khi chạm
chỗ khác.
**Nguyên nhân gốc — ⚠ giả thuyết, đã bị test phản bác một phần (Session 54):** `Gesture.Pan()` viết thẳng trong thân component → mỗi
render tạo gesture mới. Mỗi lần lướt qua một tab là điều hướng → thanh tab render lại ngay khi ngón tay còn trên màn →
`GestureDetector` gắn handler mới, handler cũ đang chạy bị bỏ → `onFinalize` (thả tay) không bao giờ tới.
**Cách sửa đúng:**
- Dựng gesture **một lần**: `useMemo(() => buildXGesture(sharedValues, …), [deps ổn định])`; callback JS phải ổn định
  (đọc trạng thái sống, vd. `navigation.getState()`, thay vì bắt `state` của lần render).
- Logic kết thúc đặt trong `onFinalize(e, success)` (luôn chạy, kể cả bị huỷ), không chỉ `onEnd`.
- Lint `react-hooks/immutability` cấm ghi `.value` của shared value đã nằm trong deps của hook → đặt hàm dựng gesture
  (và helper `setShared`) **ngoài component**.
**Dấu hiệu nhận biết lần sau:** gesture mà trong lúc kéo lại gây render (điều hướng, setState, store) — kiểm tra ngay
gesture có bị tạo lại không.

**Cập nhật Session 54:** sau bản sửa trên, người dùng báo bong bóng vẫn không hạ ngay. Test `SlideTabNavigator.test.tsx`
("keeps the same tab-bar gesture…") cho thấy gesture **không** bị dựng lại — lần "xác nhận" trước là do **mock**:
`useSharedValue` của `react-native-reanimated/mock` trả object mới mỗi render → mọi `useMemo` theo shared value đều
"đổi" trong jest. Test cần mock ổn định: `useSharedValue: (init) => React.useState(() => ({ value: init }))[0]`.
Cách xử lý thêm: hạ bong bóng ngay ở sự kiện chạm thô `onTouchesUp` (numberOfTouches === 0) + `onTouchesCancelled`,
không chờ máy trạng thái gesture, và dùng `withTiming` 180 ms thay cho spring khi hạ. Chờ xác nhận máy thật.

**Kết luận Session 56:** gốc thật của lỗi bong bóng là animated style đọc shared value qua hàm phụ — xem
`animated-style-must-read-shared-values-directly.md`. Nội dung file này (dựng gesture một lần, xử lý thả tay trong
`onFinalize`) vẫn là cách làm tốt, nhưng không phải nguyên nhân.

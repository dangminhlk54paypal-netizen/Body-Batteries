# Animated style phải đọc shared value TRỰC TIẾP — đọc qua hàm phụ thì UI "đứng hình"

**Bối cảnh:** Session 53–56, bong bóng thanh tab (`BubbleTabBar`) không hạ khi nhấc tay; mất 3 lượt sửa sai hướng
(dựng lại gesture, bắt `onTouchesUp`…) trước khi tìm ra gốc.
**Triệu chứng:** giá trị động (`active`) đã về 0 trên UI thread, nhưng hình vẫn đứng yên ở trạng thái cũ; chỉ cập nhật
khi component render lại (chạm lần sau, đổi tab). Lúc chạm thì "có vẻ chạy" vì mỗi lần đổi tab là một lần render.
**Nguyên nhân gốc:** Reanimated lấy danh sách phụ thuộc của `useAnimatedStyle` / `useAnimatedProps` từ closure của
chính hàm updater, và chỉ duyệt đệ quy object thường (`extractInputs` trong
`node_modules/react-native-reanimated/src/mappers.ts`). Một hàm worklet phụ (`const lift = () => { 'worklet'; …x.value }`)
là *function* → không được duyệt → các shared value bên trong không được theo dõi → style không bao giờ tự chạy lại.
**Cách sửa đúng:** trong updater đọc `.value` trực tiếp, rồi truyền **số** vào hàm worklet thuần ở cấp module:
`useAnimatedStyle(() => { const k = liftAmount(fingerX.value, active.value, barWidth.value, index, count); … })`.
(Mẫu đúng có sẵn: `MasterBattery.useParticleAnimatedProps` đọc `progress.value` trước rồi mới gọi `bezierPoint`.)
**Dấu hiệu nhận biết lần sau:** animation "chỉ chạy khi có render" / "đứng hình đến lần chạm sau" → kiểm tra ngay updater
có đọc `.value` trực tiếp không, trước khi nghi gesture.
**Cũng rút ra:** đừng "xác nhận" nguyên nhân bằng test jest khi mock Reanimated khác runtime thật (xem
`gesture-rebuilt-each-render-drops-release.md`).

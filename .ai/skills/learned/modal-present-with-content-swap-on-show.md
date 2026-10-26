# Bấm mở sheet thì app đơ: Modal hiện mà không vẽ gì (⚠ chờ xác nhận máy thật)

**Bối cảnh:** Session 74–76, nút ⌨️ 🎤 Kể cả ngày (`EnergyActionsBar` → `FoodLogModal` mở thẳng vào `TextMealEntry`).
**Triệu chứng:** bấm nút là đơ ngay trên Expo Go; Trang chủ vẫn sáng, không thấy lớp tối hay khung của `BottomSheet`, mọi
chạm bị nuốt, chờ mãi không hết, không red box. Cùng sheet đó mở bằng ⚡ Nạp rồi bấm "⌨️ Nạp bằng chữ" thì chạy ổn.
**Nguyên nhân (giả thuyết mạnh):** RN `Modal` đã present ở tầng native nhưng nội dung không bao giờ vẽ ra. Hai điểm chỉ có ở
đường bị lỗi: (1) **hai** `FoodLogModal` → hai RN `Modal` cùng cấp; (2) nội dung lúc present là ô `TextInput` **nhiều dòng
`autoFocus`** trong `KeyboardAvoidingView`, nên bàn phím bật lên đúng lúc Modal còn đang present.
Jest không bắt được: React render bình thường, không có vòng lặp.
**Cách sửa:** một sheet duy nhất (`foodSheet: 'closed' | 'search' | 'text'`). Present với nội dung đã chạy ổn (ô tìm món),
rồi đổi sang nội dung khác trong `onShow` của Modal (`BottomSheet` có prop `onShow`), **một lần mỗi lần mở**: Modal
present lại, vd. khi quay về từ một Modal khác, cũng gọi `onShow`.
**Dấu hiệu nhận biết lần sau:** lối vào mới mở thẳng một màn có ô `autoFocus` (nhất là `multiline`) trong `BottomSheet`,
hoặc thêm một instance Modal nữa cạnh cái đang có → đi qua đường đã chạy, đổi màn sau `onShow`.

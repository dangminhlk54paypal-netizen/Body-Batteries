# Tự động gập/mở không được đè lựa chọn tay của người dùng

**Bối cảnh:** Session 44–45, Kế hoạch block tự gập tuần đã cuộn qua ("cầu trượt nước").
**Triệu chứng:** người dùng tự gập B3W4, B3W5; cuộn nhẹ một chút là chúng tự mở lại.
**Nguyên nhân gốc:** mỗi lần tập "đã cuộn qua" đổi thì code xoá hết lựa chọn tay (`setOverrides({})`).
**Cách sửa đúng:** lựa chọn tay lưu riêng và **luôn thắng** luật tự động
(`open = handChoice ?? autoRule`). Chỉ bỏ lựa chọn tay ở một mốc có nghĩa với người dùng (tuần mới), và lưu trên máy
(`store/planFoldStore.ts`, `persist`, `key = blockId|tuầnHiệnTại`).
**Dấu hiệu nhận biết lần sau:** mọi tính năng "tự …" (tự gập, tự mở, tự chọn) đặt cạnh nút người dùng bấm được.

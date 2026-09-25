# Nút ⓘ bấm không hiện gì (mở rộng inline / Modal chồng Modal)

**Bối cảnh:** Session 40, nút ⓘ ở Kế hoạch block.
**Triệu chứng:** bấm ⓘ không hiện gì trên máy thật, dù test thấy nội dung.
**Nguyên nhân gốc:**
1. Panel mở rộng inline dựa vào `flexBasis: '100%'` trong hàng `flexWrap` → trên máy panel không bao giờ hiện.
2. (Bẫy liền kề) Hai RN `<Modal>` mở cùng lúc trên iOS → cái trên bị ẩn. Vì vậy `InfoPopover` (dùng Modal) không được
   đặt bên trong `BottomSheet` (cũng là Modal).
**Cách sửa đúng:** giải thích dùng `components/ui/InfoPopover` (Modal popup giữa màn). Bên trong sheet thì hiện chữ ngắn,
hoặc thay nội dung sheet tại chỗ (như picker trong `BlockScheduleEditor`), không mở Modal thứ hai.
**Dấu hiệu nhận biết lần sau:** thứ gì "mở ra" mà phụ thuộc layout của hàng cha, hoặc nằm trong sheet.

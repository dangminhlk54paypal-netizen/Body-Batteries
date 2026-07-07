# Hướng dẫn dùng Body Batteries trên iPhone/iPad

Tài liệu này viết cho người **không rành kỹ thuật**. Cứ làm theo từng bước,
đúng thứ tự, là dùng được app trên điện thoại.

Có 2 cách:

- **Cách A**: dùng được ngay hôm nay/ngày mai, nhưng cần bật máy Mac mỗi lần
  mở app.
- **Cách B**: không cần bật Mac sau khi đã làm xong bước chuẩn bị 1 lần, mở
  Expo Go trên iPhone là dùng được (kể cả khi Mac tắt hoặc không có mạng).

Nên làm Cách A trước để có app dùng ngay. Cách B làm sau khi rảnh.

---

## Cách A — Dùng ngay (cần Mac đang bật)

### Bước 1: Cài Expo Go trên iPhone/iPad

1. Mở **App Store** trên iPhone.
2. Tìm "**Expo Go**".
3. Bấm **Nhận** (Get) để cài. Miễn phí.

### Bước 2: Bật server trên Mac

1. Mở Terminal, vào đúng thư mục dự án (thư mục chứa app này).
2. Gõ lệnh:
   ```
   npm run start
   ```
3. Đợi vài giây, một mã QR sẽ hiện lên trong Terminal.
4. **Để Terminal/Mac mở nguyên đó** — đừng tắt, đừng ngủ máy — vì app cần Mac
   để chạy.

### Bước 3: Quét mã QR bằng iPhone

- **Nếu iPhone và Mac dùng chung Wi-Fi** (khuyên dùng cách này): mở app
  **Camera** (không phải Expo Go) trên iPhone, đưa vào mã QR trên màn hình
  Mac, bấm vào thông báo hiện lên trên cùng — app sẽ tự mở trong Expo Go.
- **Nếu iPhone dùng mạng khác** (4G/5G, Wi-Fi khác nhà, quán cà phê...): trên
  Mac, dừng lệnh cũ (bấm Ctrl+C trong Terminal) rồi chạy:
  ```
  npx expo start --tunnel
  ```
  Lệnh này chậm khởi động hơn (30 giây – 1 phút) nhưng quét QR được dù hai máy
  không cùng mạng.

### Lưu ý về dữ liệu (quan trọng)

- Toàn bộ dữ liệu ăn uống, cân nặng, nhật ký... được **lưu trực tiếp trên
  iPhone** (trong bộ nhớ của Expo Go), không lưu trên Mac, không lưu trên
  internet.
- **Tắt app** (thoát Expo Go, tắt máy, khởi động lại điện thoại...) → dữ liệu
  **vẫn còn nguyên**, mở lại là thấy.
- **Nếu XÓA app Expo Go khỏi iPhone** (gỡ cài đặt) → dữ liệu **mất hết**, vì
  dữ liệu nằm trong bộ nhớ riêng của Expo Go. Đừng xóa Expo Go nếu còn muốn giữ
  dữ liệu.

---

## Cách B — Không cần bật Mac mỗi lần

Làm 1 lần lúc rảnh, sau đó mở app trên iPhone không cần Mac nữa (Expo Go tự
lưu bản mới nhất, mở được cả lúc không có mạng).

### Bước 1: Tạo tài khoản Expo (miễn phí)

1. Vào trang **expo.dev** bằng trình duyệt (trên Mac hoặc điện thoại đều
   được).
2. Bấm **Sign Up**, tạo tài khoản bằng email — miễn phí, không cần thẻ tín
   dụng.

### Bước 2: Đăng nhập trên Mac

Mở Terminal, vào thư mục dự án, gõ lần lượt (mỗi lệnh Enter rồi mới gõ lệnh
tiếp theo):

```
npx eas-cli login
```

→ nhập email và mật khẩu vừa tạo ở Bước 1.

```
npx eas-cli init
```

→ lệnh này hỏi có muốn tạo project trên expo.dev không, chọn **Yes**.

```
npx eas-cli update:configure
```

→ lệnh này tự thêm cấu hình cần thiết vào project (không cần chỉnh sửa gì
thêm).

```
npx eas-cli update --branch main --message "ban dau"
```

→ lệnh này gửi (publish) bản app hiện tại lên expo.dev. Đợi tới khi thấy dòng
báo thành công.

### Bước 3: Mở app trên iPhone (không cần Mac)

1. Mở **Expo Go** trên iPhone.
2. Đăng nhập **cùng tài khoản** vừa tạo ở Bước 1 (bấm mục đăng nhập trong Expo
   Go).
3. Vào tab **Projects** trong Expo Go — sẽ thấy project "Body Batteries" hiện
   ra.
4. Bấm vào để mở. Xong — từ giờ mở app không cần Mac nữa.

**Mỗi khi có bản cập nhật mới** (sau này sửa app), chỉ cần chạy lại lệnh sau
trên Mac, không cần lặp lại 3 lệnh trên:

```
npx eas-cli update --branch main --message "mo ta thay doi"
```

Mở lại Expo Go trên iPhone (có mạng) là thấy bản mới.

---

## Giới hạn hiện tại (sẽ vá sau)

Vài điểm cần biết, không phải lỗi, chỉ là giới hạn của việc chạy app qua Expo
Go (chưa phải bản build App Store/TestFlight riêng):

- **Thông báo đẩy từ xa (remote push notification)** không chạy được trong
  Expo Go. **Thông báo cục bộ** (do máy tự nhắc, ví dụ nhắc uống nước, nhắc ăn
  — không qua internet) vẫn hoạt động bình thường.
- **Chạy nền (background fetch)** — việc app tự cập nhật dữ liệu khi không mở
  app — bị giới hạn trong Expo Go so với app cài đặt thật.
- Muốn có **bản build thật, độc lập** (tự cài từ App Store hoặc qua
  TestFlight, không cần Expo Go, không có 2 giới hạn trên) thì cần đăng ký
  **Apple Developer Program (99 USD/năm)**. Việc này **không cần thiết** cho
  mục tiêu hiện tại (dùng thử app ngay bằng Expo Go) — chỉ cần khi nào muốn
  phát hành chính thức.

# 02 — Công nghệ sử dụng (Tech Stack)

> Giải thích đơn giản cho người non-tech. Mỗi lựa chọn đều ưu tiên: **dễ cho AI viết code** + **dễ chạy thử trên điện thoại** + **không cần kiến thức sâu**.

---

## 🧱 Tổng quan: app này thuộc loại "local-first"

Phần lớn dữ liệu nằm **ngay trên điện thoại của bạn** (không cần server đắt tiền). Điều này tốt cho: riêng tư, chạy offline, miễn phí, và đơn giản. "Backend thông minh" ở giai đoạn đầu cũng **chạy trên máy** chứ chưa cần đám mây.

---

## 📦 Các thành phần chính

| Lớp | Công nghệ chọn | Vì sao chọn (giải thích đơn giản) |
|-----|----------------|------------------------------------|
| **Khung app di động** | **React Native + Expo** (TypeScript) | Viết 1 lần chạy cả iOS & Android. Expo cho phép **xem app ngay trên điện thoại** qua QR code mà không cần cài đặt phức tạp. AI rất giỏi viết code loại này. |
| **Ngôn ngữ** | **TypeScript** | Như JavaScript nhưng an toàn hơn — AI ít mắc lỗi hơn. |
| **Giao diện pin (đồ hoạ)** | **react-native-svg** + **Reanimated** | Vẽ các "viên pin" mượt mà, có hiệu ứng sạc/xả. |
| **Lưu dữ liệu trên máy** | **expo-sqlite** (cơ sở dữ liệu nhỏ) | Lưu lịch sử năng lượng, ăn uống một cách bền vững, có cấu trúc. |
| **Quản lý trạng thái** | **Zustand** | Cách đơn giản nhất để các màn hình "nhớ" dữ liệu. |
| **Thông báo / nhắc nhở** | **expo-notifications** | Gửi nhắc nhở "pin sắp cạn" ngay cả khi app đóng. |
| **Tác vụ nền (reset, dọn dẹp)** | **expo-task-manager** + **expo-background-task** | Reset pin mỗi ngày, tự xoá dữ liệu cũ sau 1 tuần. |
| **Xuất Excel** | **xlsx** (SheetJS) + **expo-file-system** + **expo-sharing** | Tạo file `.xlsx` và lưu/chia sẻ trên điện thoại. |
| **Đa ngôn ngữ (Việt/Anh/Đức)** | Tự viết (`src/i18n/`), KHÔNG dùng i18next | Nhẹ, không thêm thư viện, tận dụng luôn Zustand có sẵn để lưu lựa chọn ngôn ngữ — xem chi tiết bên dưới mục "Vì sao không chọn i18next". |
| **Bảo mật Diary** | **expo-secure-store** + mã hoá | Nhật ký riêng tư, app không đọc lại được. |
| **Biểu đồ xu hướng** | **victory-native** | Vẽ biểu đồ năng lượng theo ngày/tuần. |

---

## 🧠 Cho lớp "thông minh" (giai đoạn sau)

| Mục đích | Công nghệ | Ghi chú |
|----------|-----------|---------|
| Quy tắc đơn giản trước | Code thuần (rule-based) | Bắt đầu bằng "nếu... thì..." — đủ thông minh cho 80% nhu cầu, AI viết dễ. |
| Dự báo xu hướng | **TensorFlow Lite** / hồi quy đơn giản | Mô hình nhỏ chạy *trên máy* (on-device), giữ riêng tư. |
| Tích hợp sức khoẻ | **Apple HealthKit** / **Google Health Connect** | Lấy bước chân, nhịp tim, giấc ngủ (cần quyền của người dùng). |

> ⚠️ Đừng vội làm phần ML. Lộ trình (`04-roadmap.md`) để nó ở giai đoạn cuối. Quy tắc đơn giản trước, học máy sau.

---

## 🛠️ Công cụ làm việc (cài 1 lần)

1. **VS Code** — nơi bạn và AI làm việc.
2. **Node.js** (bản LTS) — để chạy Expo.
3. **Git** — lưu lịch sử code (AI sẽ giúp bạn dùng).
4. **Ứng dụng "Expo Go"** trên điện thoại — để xem app trực tiếp.
5. **Extension AI** trong VS Code (Claude hoặc Gemini).

> Toàn bộ bước cài đặt chi tiết sẽ do AI hướng dẫn từng dòng trong **Phase 0** của lộ trình.

---

## ❓ Tại sao KHÔNG chọn cái khác?

- **Flutter?** Cũng tốt, nhưng React Native + Expo có nhiều ví dụ hơn → AI viết chính xác hơn.
- **App native thuần (Swift/Kotlin)?** Phải viết 2 lần cho 2 hệ điều hành, khó cho người non-tech.
- **Server riêng + database đám mây?** Tốn tiền và phức tạp; chưa cần ở giai đoạn đầu vì ta đi "local-first".
- **Vì sao không chọn i18next/react-i18next cho đa ngôn ngữ?** App đã có sẵn Zustand
  (`settingsStore`, tự lưu vào máy qua AsyncStorage) — thêm 1 field `language` vào đó là đủ, khỏi
  cần thêm 2 thư viện mới (i18next + react-i18next) hay `expo-localization`. Bộ dịch chỉ là object
  TypeScript lồng nhau (`src/i18n/locales/{vi,en,de}.ts`), có `tsc` tự kiểm tra không thiếu chuỗi
  nào giữa 3 ngôn ngữ (xem `docs/03-architecture.md`). Đổi ngôn ngữ mượt vì hook `useT()` chỉ theo
  dõi đúng 1 field `language` — component nào không gọi `useT()` thì không bị vẽ lại khi đổi ngôn
  ngữ (app này vốn không dùng React Context, xem `src/lib/theme.ts`).

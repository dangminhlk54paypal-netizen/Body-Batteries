### BƯỚC 2: HỆ THỐNG AGENT (SKILLS) ĐỂ LÀM VIỆC VỚI AI
Để Vibe-coding hiệu quả, đừng yêu cầu AI "viết cả app đi". Hãy phân vai cho AI theo từng phiên làm việc (session). Khi bắt đầu một task, bạn hãy gõ lệnh gọi Agent. Dưới đây là 4 Agents bạn sẽ sử dụng:

**1. @Architect (Kiến trúc sư hệ thống)**
* **Khi nào dùng:** Khi bắt đầu dự án, tạo cấu trúc thư mục, cài đặt thư viện.
* **Prompt ví dụ:** *"Hãy đóng vai @Architect. Đọc file `PROJECT_PLAN.md`. Hãy giúp tôi khởi tạo dự án Expo React Native và cài đặt các thư viện cần thiết cho Phase 1 & 2. Nhớ code bằng tiếng Anh, giải thích bằng tiếng Việt."*

**2. @UI-Designer (Kỹ sư Giao diện)**
* **Khi nào dùng:** Khi cần vẽ màn hình cục pin, hiệu ứng tụt pin, các nút bấm chọn Mode.
* **Prompt ví dụ:** *"Hãy đóng vai @UI-Designer. Bây giờ chúng ta làm Phase 1. Hãy viết code cho component `MainBattery.tsx`. Tôi muốn nó hiển thị các cell nhỏ cho Protein, Sugar. Trông nó phải giống giao diện trên xe Tesla. Cứ dùng Mock data (dữ liệu giả) trước nhé."*

**3. @Logic-Master (Kỹ sư Backend & Dữ liệu)**
* **Khi nào dùng:** Khi cần xử lý Database, tính toán thuật toán trừ điểm năng lượng, reset qua ngày, xuất file Excel.
* **Prompt ví dụ:** *"Hãy đóng vai @Logic-Master. Giao diện xong rồi. Giờ hãy thiết lập SQLite để lưu trữ lượng Protein và Sugar nạp vào. Viết function tự động reset dữ liệu vào 12h đêm và function xuất ra file Excel. Lưu ý nguyên tắc bảo mật trong file Plan."*

**4. @Data-Scientist (Kỹ sư AI/Thuật toán - Dành cho tương lai)**
* **Khi nào dùng:** Khi bạn muốn kết nối với Apple Health/Google Fit để lấy bước chân, nhịp tim và xây dựng thuật toán dự báo.
* **Prompt ví dụ:** *"Hãy đóng vai @Data-Scientist. Dữ liệu đã có đủ trong 1 tuần. Hãy viết một thuật toán (algorithm) cơ bản để phân tích thói quen ăn uống và vận động hiện tại, trả về cảnh báo nếu pin của người dùng đang có dấu hiệu 'chai' do stress."*

---

### Lời khuyên "Thực tế" cho Non-Tech Founder khi Vibe-coding:
1. **Thiết kế "Backend" ngay trên điện thoại:** Vì bạn yêu cầu "chức năng đè lên diary, xoá sau 1 tuần, không ai có quyền truy cập", giải pháp tốt nhất là **không dùng Cloud Server (như Firebase hay AWS)**. Mọi thứ sẽ lưu thẳng vào bộ nhớ máy (Local Storage / SQLite). Điều này giúp app chạy cực nhanh, bảo mật tuyệt đối, và bạn không tốn 1 đồng tiền duy trì Server nào.
2. **Thuật toán "Neuron Netz cá nhân":** Trí tuệ nhân tạo học trên điện thoại là một tính năng nâng cao. Trong giai đoạn 1, hãy để AI giúp bạn viết **"Thuật toán quy tắc" (Rule-based algorithms)** trước. Ví dụ: `Nếu (Tuổi > 40) + (Bước chân < 2000) + (Nạp đường > 50g) => Cảnh báo bệnh lý`. Sau khi app có người dùng, chúng ta mới nâng cấp lên Machine Learning thật sự.

Bạn đã cài đặt sẵn VS Code, Expo và các AI extension chưa? Chúng ta có thể bắt đầu gọi **@Architect** để khởi tạo những dòng code đầu tiên ngay bây giờ!
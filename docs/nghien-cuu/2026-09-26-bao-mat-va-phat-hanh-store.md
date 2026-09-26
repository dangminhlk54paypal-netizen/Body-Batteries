# Báo cáo nghiên cứu: Bảo mật & kế hoạch phát hành BodyBatteries lên App Store / Google Play

| | |
|---|---|
| **Ngày** | 2026-09-26 (bản 2: đã kiểm chứng nguồn) |
| **Phạm vi** | Nghiên cứu & lập kế hoạch, chưa sửa code |
| **Nhánh khảo sát** | `ui-upgrade` (commit `3e96fba`) |
| **Mục tiêu** | Phát hành miễn phí, tự phát triển, hạn chế chi phí trả cho bên thứ 3; dữ liệu người dùng chỉ nằm trên máy họ; không ai lợi dụng app để lấy dữ liệu người khác hoặc phá hệ thống |

## Cách đọc các ký hiệu trong báo cáo

| Ký hiệu | Nghĩa | Cách kiểm tra lại |
|---|---|---|
| **[n]** | Thông tin trích từ nguồn web số *n* | Tra số *n* trong mục **Tài liệu tham khảo** cuối báo cáo |
| **[Mã: tên-file]** | Thông tin rút ra từ việc đọc code của dự án | Bấm link để mở file |
| **[Nội bộ: tên-file]** | Thông tin từ tài liệu nội bộ của dự án | Bấm link để mở file |
| **💡** | Nhận định hoặc khuyến nghị của người viết, không phải trích dẫn | Đây là ý kiến, cần anh tự cân nhắc |
| **❓** | Chưa kiểm chứng được bằng nguồn chính thức | Cần kiểm tra thêm trước khi dựa vào |

Mọi nguồn web được truy cập và đọc trực tiếp ngày **2026-09-26**. Chính sách của Apple, Google và Expo thay đổi thường xuyên, vì vậy trước mỗi mốc quan trọng (nộp app, trả phí) nên mở lại link để xác nhận.

---

## Tóm tắt

1. 💡 **Kiến trúc hiện tại đã đúng hướng.** App lưu toàn bộ dữ liệu trên máy (SQLite, AsyncStorage, Keychain), không server, không tài khoản, không analytics/quảng cáo [Mã: [database.ts](../../src/data/db/database.ts)]. Không có kho dữ liệu chung nên hacker không có mục tiêu tập trung, và một điện thoại bị chiếm quyền chỉ làm lộ dữ liệu của chính máy đó.
2. **Có 5 chỗ hở cần vá trước khi phát hành:**
   - database chưa mã hoá;
   - "mã hoá" nhật ký thực chất chỉ là làm rối (XOR + `Math.random`) [Mã: [encryption.ts](../../src/lib/encryption.ts)];
   - tính năng dịch MyMemory gửi tên món ăn ra ngoài [Mã: [foodNameTranslationService.ts](../../src/services/translation/foodNameTranslationService.ts)];
   - kênh cập nhật OTA chưa ký số [Mã: [app.json](../../app.json)];
   - log chưa được xoá trong bản production.
3. 💡 **Rủi ro lớn nhất nằm ở tài khoản của nhà phát triển, không phải ở điện thoại người dùng.** Ai chiếm được tài khoản Expo có thể đẩy code xuống mọi máy qua OTA. Ký số OTA **chỉ có ở gói EAS Production (199 USD/tháng)** [11][12]. Vì vậy khuyến nghị **tắt OTA ở bản production**, việc này miễn phí [31].
4. **Chi phí bắt buộc tối thiểu:** 99 USD/năm (Apple) [1] + 25 USD một lần (Google) [2]. 💡 Chi phí server: 0 đồng.
5. **Thời gian ước tính:** khoảng 7–10 tuần (💡 ước tính). Google Play bắt buộc tài khoản cá nhân tạo sau 13/11/2023 phải test kín với **≥ 12 người trong ≥ 14 ngày liên tục** [3].

---

## Đính chính so với bản đầu (bản trong chat, chưa kiểm chứng nguồn)

Khi đối chiếu với nguồn gốc, 6 điểm trong bản đầu cần sửa:

| # | Bản đầu nói | Nguồn gốc nói | Nguồn |
|---|---|---|---|
| 1 | Bật ký số OTA để bảo vệ kênh cập nhật | Ký số **chỉ có ở gói EAS Production/Enterprise**, gói Free và Starter không có | [11][12] |
| 2 | Bật SQLCipher | SQLCipher **không chạy trên Expo Go**, phải dùng development build | [14] |
| 3 | Phát hành theo giai đoạn khi ra mắt | Cả Apple lẫn Google **chỉ cho phép phát hành theo giai đoạn với bản cập nhật**, không dùng được cho lần phát hành đầu tiên | [24][25] |
| 4 | Giữ backup mặc định của hệ điều hành | Trên Android, dữ liệu trong SecureStore **mất khi gỡ app** [16], còn file database vẫn được Auto Backup sao lưu [22]. Nếu database mã hoá bằng khoá trong SecureStore, bản khôi phục trên máy mới **có thể không giải mã được** (💡 suy luận từ 2 nguồn trên) | [16][22] |
| 5 | Phí In-App Purchase 15% | Apple 15% với Small Business Program [28]. Google có biểu phí mới từ 2026, phức tạp hơn [29] | [28][29] |
| 6 | Khai báo trader status trên cả 2 store | Apple thì đúng [10]. ❓ Với Google, chưa tìm được trang chính thức mô tả tương đương | [10] |

Ngoài ra, ghi chú trong code nói MyMemory miễn phí "5,000 words/day" [Mã: [foodNameTranslationService.ts](../../src/services/translation/foodNameTranslationService.ts)], nhưng trang chính thức ghi **5.000 ký tự/ngày** [21].

---

## 1. Hiện trạng kỹ thuật (kết quả khảo sát code)

| Khía cạnh | Hiện trạng | Bằng chứng |
|---|---|---|
| Lưu trữ | SQLite `body_batteries.db` (WAL), Zustand persist qua AsyncStorage, khoá trong `expo-secure-store` | [Mã: [database.ts](../../src/data/db/database.ts)], [Mã: [settingsStore.ts](../../src/store/settingsStore.ts)] |
| Mã hoá database | Không có | [Mã: [database.ts](../../src/data/db/database.ts)] |
| Mã hoá nhật ký | XOR + khoá sinh bằng `Math.random`. Code tự ghi chú: "obfuscation-grade, NOT a CSPRNG" | [Mã: [encryption.ts](../../src/lib/encryption.ts)] |
| Kết nối mạng ra ngoài | Chỉ có MyMemory (`api.mymemory.translated.net`), gửi tên món tự nhập; bật/tắt bằng `autoTranslateCustomFoodNames` | [Mã: [foodNameTranslationService.ts](../../src/services/translation/foodNameTranslationService.ts)], [Mã: [settingsStore.ts](../../src/store/settingsStore.ts)] |
| Cập nhật OTA | `updates.url` trỏ tới `u.expo.dev`, không có `codeSigningCertificate` | [Mã: [app.json](../../app.json)] |
| Nhập file | Chỉ nhập backup "Món của tôi" (JSON), có bước kiểm tra `parseMyFoodsBackup` | [Mã: [myFoodsBackupService.ts](../../src/services/food/myFoodsBackupService.ts)] |
| Excel | `xlsx` 0.18.5, chỉ ghi, không đọc (tìm `XLSX.read` không có kết quả) | [Mã: [package.json](../../package.json)], [Mã: [excelExportService.ts](../../src/services/export/excelExportService.ts)] |
| Apple Health | Chỉ đọc (`NSHealthShareUsageDescription`) | [Mã: [app.json](../../app.json)], [Mã: [appleHealthSync.ts](../../src/services/health/appleHealthSync.ts)] |
| Secret trong bundle | Không tìm thấy API key, token hay biến `EXPO_PUBLIC_*` | Tìm toàn bộ `src/` và `app.json` |
| Deep link | Không khai báo `scheme` | [Mã: [app.json](../../app.json)] |
| Log | ~59 lệnh `console.*` ngoài thư mục test | Tìm toàn bộ `src/` |
| Quyền Android | `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `POST_NOTIFICATIONS`, mỗi quyền khai báo 2 lần | [Mã: [app.json](../../app.json)] |
| Rào cản build | `react-native-health` chưa được kiểm chứng trên New Architecture (bắt buộc từ SDK 55) | [Nội bộ: [AGENTS.md](../../AGENTS.md)] |
| Quy trình test hiện tại | Test qua Expo Go + EAS Update nhánh `preview` | [Nội bộ: [AGENTS.md](../../AGENTS.md)] |

---

## 2. Mô hình đe doạ

💡 Toàn bộ bảng dưới là phân tích của người viết, dựa trên hiện trạng ở mục 1.

| Kẻ tấn công | Mục tiêu | Mức rủi ro hiện tại | Lớp xử lý |
|---|---|---|---|
| Hacker từ xa muốn lấy dữ liệu hàng loạt | Server/database chung | ✅ Không có mục tiêu, vì không có server | Lớp 1 |
| **Kẻ chiếm tài khoản Expo/Apple/Google/GitHub** | Đẩy code độc xuống mọi người dùng | 🔴 Cao nhất | Lớp 5, 6 |
| Thư viện npm bị cài mã độc | Code độc lọt vào bản build | 🟠 Trung bình | Lớp 6 |
| Người nhặt được/mượn điện thoại | Xem nhật ký sức khoẻ | 🟠 Trung bình | Lớp 2 |
| Mã độc trên máy jailbreak/root | Đọc file của app | 🟡 Chỉ lộ dữ liệu của chính máy đó | Lớp 2 |
| File backup/Excel độc hại gửi cho người dùng | Làm hỏng dữ liệu hoặc crash app | 🟡 Đã có kiểm tra, cần siết thêm | Lớp 4 |
| Kẻ dịch ngược app | Tìm khoá bí mật | ✅ Không có bí mật trong app | Lớp 7 |

💡 **Nguyên tắc nền:** mọi tính năng mới đều phải trả lời được câu hỏi *"Có cần server hay bên thứ 3 không?"*. Nếu có, mặc định là không làm, hoặc chỉ làm khi người dùng tự bật và được thông báo rõ.

---

## 3. Bảy lớp bảo mật

### Lớp 1: Kiến trúc "không thu thập dữ liệu"

- Theo định nghĩa của Apple, dữ liệu **chỉ xử lý trên máy thì không bị coi là "thu thập"** và không phải khai báo trong nhãn quyền riêng tư [5]. Google có quy định tương tự cho Data safety [6]. Đây là cơ sở để nhãn store ghi "Data Not Collected".
- 💡 Không gắn SDK của bên thứ 3 (Firebase, Sentry, SDK quảng cáo…).
- Theo dõi crash trên Android: **Android vitals** lấy dữ liệu từ chính hệ điều hành, chỉ từ người dùng đã đồng ý chia sẻ chẩn đoán, **không cần tích hợp SDK** [27]. ❓ Phía iOS có báo cáo crash tương tự trong Xcode Organizer/App Store Connect, nhưng phiên này chưa kiểm chứng.
- 💡 Góp ý của người dùng: nút "Gửi góp ý" mở app Mail có soạn sẵn nội dung, không cần server.

### Lớp 2: Dữ liệu nằm trên máy (data at rest)

| Việc | Căn cứ | Đề xuất |
|---|---|---|
| Mã hoá database | `expo-sqlite` hỗ trợ SQLCipher qua config plugin `useSQLCipher`; đặt khoá bằng `PRAGMA key` ngay sau khi mở DB; **không hỗ trợ Expo Go** [14] | 💡 Làm, nhưng **sau** khi đã chuyển sang development build (xem P0), và **chỉ sau khi** đã có tính năng backup riêng (dòng "Backup" bên dưới) |
| Sinh khoá | `expo-crypto.getRandomBytes` sinh byte ngẫu nhiên an toàn cho mật mã [15] | Thay `Math.random` trong [Mã: [encryption.ts](../../src/lib/encryption.ts)] |
| Mã hoá nhật ký | `expo-crypto` có AES-GCM (`aesEncryptAsync`/`aesDecryptAsync`) [15] | 💡 Bỏ XOR. Nếu đã có SQLCipher thì bỏ hẳn lớp mã hoá riêng, còn không thì dùng AES-GCM |
| Nơi cất khoá | SecureStore: iOS lưu trong Keychain, Android lưu trong SharedPreferences mã hoá bằng Keystore [16] | Giữ nguyên |
| ⚠️ Backup | Android Auto Backup mặc định **bật**, sao lưu cả file database, tối đa 25 MB/app [22]; nhưng SecureStore trên Android **mất khi gỡ app** [16] | 💡 Nếu mã hoá DB thì khoá không theo DB sang máy mới. **Bắt buộc** làm tính năng "Xuất/Nhập toàn bộ dữ liệu" có mật khẩu do người dùng đặt, *trước khi* bật SQLCipher |
| Dữ liệu HealthKit | Apple cấm lưu thông tin sức khoẻ cá nhân lên iCloud (guideline 5.1.3(ii)) [4] | 💡 Không tự làm đồng bộ iCloud |
| Log | Plugin `babel-plugin-transform-remove-console` xoá mọi lệnh `console` khi build, có tuỳ chọn `exclude` để giữ lại `error` [18] | Dùng cho bản production |
| Khoá app | `expo-local-authentication` hỗ trợ Face ID/Touch ID/vân tay; cần `NSFaceIDUsageDescription`; Face ID **không test được trên Expo Go** [17] | 💡 Tuỳ chọn, có thể để bản 1.1 |

### Lớp 3: Dữ liệu rời khỏi máy

- **MyMemory** là đường duy nhất dữ liệu người dùng đi ra Internet [Mã: [foodNameTranslationService.ts](../../src/services/translation/foodNameTranslationService.ts)]. Hạn mức ẩn danh là 5.000 ký tự/ngày [21]. ❓ Trang hạn mức không nói MyMemory lưu trữ hay dùng văn bản gửi lên thế nào, nên phải coi đó là dữ liệu đã giao cho bên thứ 3.
  - Theo định nghĩa của Apple [5], gửi dữ liệu ra khỏi máy tới nơi có thể lưu lại lâu hơn thời gian xử lý thì có thể phải khai báo là "thu thập".
  - 💡 **Khuyến nghị: bỏ MyMemory khỏi bản phát hành chính thức**, để nhãn store ghi đúng "Data Not Collected".
- Apple Health: 💡 giữ chế độ chỉ đọc.
- 💡 Xuất Excel/ảnh/backup: chỉ khi người dùng tự bấm chia sẻ, như hiện tại.

### Lớp 4: Dữ liệu đi vào máy (file nhập)

- `xlsx` 0.18.5 có 2 lỗ hổng đã công bố:
  - **CVE-2023-30533** (prototype pollution): ảnh hưởng mọi bản đến 0.19.2, **chỉ khi đọc file**. Quy trình chỉ xuất file thì không bị ảnh hưởng [19].
  - **CVE-2024-22363** (ReDoS): ảnh hưởng mọi bản đến 0.20.1 [20].
  - Bản vá không có trên npm vì gói `xlsx` trên npm không còn được bảo trì; phải tải từ `cdn.sheetjs.com` [19].
  - 💡 App hiện chỉ ghi Excel nên rủi ro thấp. Nếu sau này có tính năng nhập Excel thì phải nâng SheetJS trước.
- 💡 Siết `parseMyFoodsBackup` [Mã: [myFoodsBackupService.ts](../../src/services/food/myFoodsBackupService.ts)]: giới hạn dung lượng file (ví dụ 5 MB), số bản ghi, độ dài chuỗi; loại bỏ trường lạ.
- 💡 Giữ app không có deep link [Mã: [app.json](../../app.json)].

### Lớp 5: Kênh cập nhật OTA (EAS Update), rủi ro lớn nhất

- **Cách ký số hoạt động:** tạo khoá bằng `npx expo-updates codesigning:generate`, khai báo `codeSigningCertificate` và `codeSigningMetadata` trong app config. App kiểm tra chữ ký của mỗi bản cập nhật và **từ chối** bản không hợp lệ [11].
- **Nhưng:** ký số chỉ có ở gói **EAS Production (199 USD/tháng) hoặc Enterprise** [11][12]. Điều này trái với mục tiêu hạn chế chi phí.
- **Tắt OTA:** đặt `updates.enabled: false` trong app config, app chỉ chạy bundle được đóng gói sẵn trong bản build [31].
- 💡 **Khuyến nghị:** tắt OTA ở bản production. Mọi cập nhật đi qua store review, chậm hơn nhưng được Apple/Google kiểm tra thêm một lớp, và không tốn phí. Vẫn giữ kênh `preview` cho giai đoạn test nội bộ.

### Lớp 6: Tài khoản nhà phát triển và chuỗi cung ứng

- 💡 Bật **2FA, tốt nhất là passkey hoặc khoá bảo mật phần cứng**, cho Apple ID, Google, Expo và GitHub.
- **Play App Signing:** app mới upload bằng AAB được tự động đăng ký. Google giữ khoá ký app, nhà phát triển giữ **upload key**. Nếu mất upload key, Google có thể đặt lại [23]. 💡 Vẫn nên backup upload key ở 2 nơi tách biệt.
- 💡 npm: build bằng `npm ci` với lockfile, chạy `npm audit` trước mỗi bản phát hành, bật Dependabot, hạn chế thêm thư viện mới.
- 💡 Không bao giờ đặt secret trong biến `EXPO_PUBLIC_*`, vì mọi thứ trong bundle đều đọc được.

### Lớp 7: Dịch ngược, jailbreak

💡 App không chứa bí mật nào (xem mục 1), nên dịch ngược không lấy được gì. Không nên thêm tính năng phát hiện root/jailbreak hay làm rối code. Những thứ đó làm phiền người dùng thật mà không bảo vệ thêm được ai.

---

## 4. Yêu cầu bắt buộc của cửa hàng

| Hạng mục | Apple App Store | Google Play |
|---|---|---|
| Phí nhà phát triển | 99 USD/năm. Miễn phí chỉ dành cho tổ chức phi lợi nhuận, trường học, cơ quan nhà nước [1] | 25 USD một lần [2] |
| Chính sách quyền riêng tư | 💡 Cần URL công khai (có thể host miễn phí trên GitHub Pages) | Bắt buộc, kể cả app không thu thập dữ liệu [6] |
| Nhãn dữ liệu | Privacy Nutrition Label. Dữ liệu chỉ xử lý trên máy không phải khai báo [5] | Data safety form: **mọi** app phải điền, kể cả app không thu thập gì [6] |
| Sức khoẻ | Guideline 5.1.3(ii): không ghi dữ liệu sai vào HealthKit, không lưu thông tin sức khoẻ lên iCloud [4] | Health apps declaration: mọi app phải điền, kể cả app không có tính năng sức khoẻ [7] |
| Tuyên bố y tế | Guideline 1.4.1: phải công khai phương pháp tính cho các tuyên bố về độ chính xác, và nên nhắc người dùng hỏi ý kiến bác sĩ [4] | ❓ Chưa kiểm chứng |
| Tài khoản người dùng | Guideline 5.1.1(v): app có tạo tài khoản thì phải cho xoá tài khoản trong app [4]. 💡 App không có tài khoản nên không áp dụng | Không có |
| Privacy manifest | Khai báo trong `ios.privacyManifests` của app config. Ví dụ UserDefaults (AsyncStorage dùng) có mã lý do `CA92.1` [8] | Không có |
| Mã hoá xuất khẩu | Khai báo `ITSAppUsesNonExemptEncryption`. Chỉ dùng mã hoá có sẵn trong hệ điều hành của Apple thì được miễn giấy tờ [9]. Expo cho đặt qua `usesNonExemptEncryption` [16]. 💡 SQLCipher là thư viện mã hoá ngoài hệ điều hành, cần đọc kỹ [9] trước khi khai báo | Không có |
| EU (luật DSA) | **Mọi** nhà phát triển phải khai báo trader status. Nếu là trader, **địa chỉ (hoặc hộp thư bưu điện), số điện thoại, email sẽ hiện công khai** trên trang app ở EU [10] | ❓ Chưa tìm được trang chính thức tương đương |
| Kiểm thử trước phát hành | TestFlight: tối đa 100 người nội bộ, 10.000 người bên ngoài; bản đầu cho nhóm bên ngoài phải qua duyệt; mỗi build test được 90 ngày [26] | Tài khoản cá nhân tạo sau 13/11/2023: test kín ≥ 12 người, ≥ 14 ngày liên tục [3] |

💡 **Lưu ý về quyền riêng tư của chính anh:** nếu khai báo là trader ở EU, thông tin liên lạc cá nhân sẽ hiện công khai [10]. Nên cân nhắc dùng hộp thư bưu điện và email riêng cho app.

**Rào cản kỹ thuật:** bản phát hành trên store là bản build thật, không phải Expo Go. `react-native-health` phải được kiểm chứng trên New Architecture bằng dev-client **trước tiên** [Nội bộ: [AGENTS.md](../../AGENTS.md)].

---

## 5. Chi phí

| Khoản | Chi phí | Nguồn |
|---|---|---|
| Apple Developer Program | 99 USD/năm (giá có thể khác theo khu vực) | [1] |
| Google Play Console | 25 USD, trả một lần | [2] |
| EAS gói Free | 0 USD: 15 build Android + 15 build iOS/tháng, 1.000 người dùng OTA/tháng, **không có ký số OTA** | [12] |
| EAS gói Starter | 19 USD/tháng, vẫn không có ký số OTA | [12] |
| EAS gói Production | 199 USD/tháng, có ký số OTA đầu cuối | [12] |
| Build trên máy mình | `eas build --local`; iOS cần macOS (Windows không hỗ trợ). ❓ Tài liệu không nói rõ build local có tính vào hạn mức EAS không | [13] |
| Server | 💡 0 đồng, vì không có server | Nhận định |

**Ủng hộ tài chính (nếu muốn sau này):**
- Apple: hoa hồng 15% cho nhà phát triển có doanh thu dưới 1 triệu USD/năm (Small Business Program) [28].
- Google: biểu phí từ 2026 phân theo loại giao dịch và khu vực, ví dụ "10% + 5% phí thanh toán" cho lượt cài mới trong 1 triệu USD đầu tiên [29]. Cần đọc kỹ trước khi làm.
- 💡 Tránh quảng cáo, vì SDK quảng cáo phá vỡ cam kết "không bên thứ 3".

---

## 6. Lộ trình triển khai

💡 Thời gian ước tính và thứ tự các bước là nhận định của người viết. Các bước có số nguồn là yêu cầu chính thức.

| Giai đoạn | Việc chính | Thời gian ước tính |
|---|---|---|
| **P0: Gia cố bảo mật** | (1) 2FA cho 4 tài khoản. (2) Chuyển sang **development build**, vì SQLCipher [14], Face ID [17] và HealthKit đều không chạy trên Expo Go. (3) Test `react-native-health` trên New Architecture. (4) Làm tính năng Xuất/Nhập toàn bộ dữ liệu có mật khẩu. (5) Bật SQLCipher [14] + chuyển dữ liệu cũ; bỏ XOR [15]. (6) Xoá `console` trong production [18]. (7) Bỏ MyMemory. (8) Tắt OTA ở production [31]. (9) Siết kiểm tra file nhập; dọn quyền Android bị lặp | 3–4 tuần |
| **P1: Pháp lý & nội dung** | Chính sách quyền riêng tư VI/EN/DE [6], nhắc hỏi ý kiến bác sĩ [4], privacy manifest [8], khai báo mã hoá [9], trader status [10], ảnh và mô tả store 3 ngôn ngữ | 1 tuần |
| **P2: Build production** | Profile `production` trong `eas.json`, gửi TestFlight nội bộ [26] và Play Internal testing | 1 tuần |
| **P3: Beta kín** | TestFlight bên ngoài (bản đầu phải qua duyệt) [26]. Play closed test ≥ 12 người × ≥ 14 ngày [3] | 2–3 tuần |
| **P4: Ra mắt** | Phát hành bản đầu cho 100% người dùng, vì phát hành theo giai đoạn không áp dụng cho lần đầu [24][25]. Từ bản cập nhật sau: Apple 7 ngày (1% → 100%) [24], Google tự chọn tỉ lệ và tăng thủ công [25] | 1–2 tuần |
| **P5: Vận hành** | Theo dõi Android vitals [27], trả lời đánh giá, `npm audit` định kỳ, cập nhật qua store | Liên tục |

### Tiếp cận người dùng (💡 nhận định)

- Thông điệp chính: **"Sổ tay cá nhân, dữ liệu không bao giờ rời máy bạn."** Có cơ sở từ định nghĩa "không thu thập" của Apple [5] và Google [6].
- Tối ưu store listing cho cả 3 ngôn ngữ.
- Giới thiệu trong các cộng đồng gym/powerlifting ở Việt Nam và Đức.

---

## 7. Các quyết định cần chủ dự án chốt

| # | Câu hỏi | 💡 Khuyến nghị |
|---|---|---|
| 1 | MyMemory: bỏ hẳn hay giữ dạng người dùng tự bật? | Bỏ khỏi bản phát hành |
| 2 | OTA ở production: trả 199 USD/tháng để ký số [12], hay tắt hẳn [31]? | Tắt hẳn |
| 3 | Trader status ở EU: là trader (thông tin liên lạc công khai) hay không? [10] | Tuỳ việc app có tạo thu nhập hay không; nên hỏi thêm tư vấn pháp lý nếu có thu phí |
| 4 | Mở mã nguồn? | Tuỳ chủ dự án: tăng niềm tin, nhưng dễ bị sao chép |
| 5 | Khoá Face ID ở bản 1.0 hay để sau? | Để bản 1.1 |

## 8. Năm việc ưu tiên nhất

1. Bật 2FA/passkey cho Apple ID, Google, Expo, GitHub.
2. Tắt OTA ở production [31] (vì ký số tốn 199 USD/tháng [12]).
3. Chuyển sang development build và test HealthKit trên New Architecture.
4. Làm tính năng Xuất/Nhập toàn bộ dữ liệu, **rồi mới** bật SQLCipher [14][16][22].
5. Bỏ MyMemory khỏi bản phát hành [5][21].

---

## Tài liệu tham khảo

Tất cả truy cập ngày **2026-09-26**.

**Apple**

| # | Tài liệu | Link | Dùng cho |
|---|---|---|---|
| [1] | Apple Developer Program: Enrollment | https://developer.apple.com/programs/enroll/ | Phí 99 USD/năm, điều kiện miễn phí |
| [4] | App Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ | 1.4.1 (y tế), 5.1.1(v) (xoá tài khoản), 5.1.3(ii) (HealthKit, iCloud) |
| [5] | App privacy details on the App Store | https://developer.apple.com/app-store/app-privacy-details/ | Định nghĩa "collect", dữ liệu chỉ xử lý trên máy |
| [9] | Overview of export compliance | https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance | `ITSAppUsesNonExemptEncryption`, mã hoá được miễn |
| [10] | Manage EU Digital Services Act trader requirements | https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements | Trader status, thông tin hiện công khai |
| [24] | Release a version update in phases | https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases | 7 ngày, chỉ áp dụng cho bản cập nhật |
| [26] | TestFlight overview | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview | 100 / 10.000 tester, duyệt bản đầu, 90 ngày |
| [28] | App Store Small Business Program | https://developer.apple.com/app-store/small-business-program/ | Hoa hồng 15% |

**Google**

| # | Tài liệu | Link | Dùng cho |
|---|---|---|---|
| [2] | Play Console: registration fee | https://support.google.com/googleplay/android-developer/answer/6112435 | Phí 25 USD một lần |
| [3] | Testing requirements for new personal developer accounts | https://support.google.com/googleplay/android-developer/answer/14151465 | 12 tester, 14 ngày, tài khoản tạo sau 13/11/2023 |
| [6] | Provide information for Google Play's Data safety section | https://support.google.com/googleplay/android-developer/answer/10787469 | Mọi app phải điền; bắt buộc có privacy policy; dữ liệu chỉ ở trên máy |
| [7] | Provide information for the Health apps declaration form | https://support.google.com/googleplay/android-developer/answer/14738291 | Mọi app phải khai báo (lấy từ kết quả tìm kiếm của Google Help) |
| [22] | Back up user data with Auto Backup | https://developer.android.com/identity/data/autobackup | Mặc định bật, sao lưu database, giới hạn 25 MB, `allowBackup` |
| [23] | Use Play App Signing | https://support.google.com/googleplay/android-developer/answer/9842756 | Tự đăng ký, upload key đặt lại được |
| [25] | Release app updates with staged rollouts | https://support.google.com/googleplay/android-developer/answer/6346149 | Chỉ áp dụng cho bản cập nhật, tăng tỉ lệ thủ công |
| [27] | Android vitals | https://developer.android.com/topic/performance/vitals | Theo dõi crash không cần SDK, người dùng tự đồng ý |
| [29] | Service fees | https://support.google.com/googleplay/android-developer/answer/112622 | Biểu phí 2026 |

**Expo**

| # | Tài liệu | Link | Dùng cho |
|---|---|---|---|
| [8] | Privacy manifests (Apple) | https://docs.expo.dev/guides/apple-privacy/ | `ios.privacyManifests`, mã lý do `CA92.1` |
| [11] | EAS Update: Code signing | https://docs.expo.dev/eas-update/code-signing/ | Cách ký số; chỉ có ở gói Production/Enterprise |
| [12] | Expo pricing | https://expo.dev/pricing | Free / Starter 19 USD / Production 199 USD |
| [13] | EAS Build: Local builds | https://docs.expo.dev/build-reference/local-builds/ | `eas build --local`, yêu cầu macOS cho iOS |
| [14] | expo-sqlite (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/ | `useSQLCipher`, `PRAGMA key`, không chạy trên Expo Go |
| [15] | expo-crypto (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ | `getRandomBytes`, AES-GCM |
| [16] | expo-secure-store (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/securestore/ | Keychain/Keystore, mất khi gỡ app trên Android, `usesNonExemptEncryption` |
| [17] | expo-local-authentication (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/ | Face ID/vân tay, không test Face ID được trên Expo Go |
| [30] | Expo SDK 57 reference (trang gốc) | https://docs.expo.dev/versions/v57.0.0/ | Tra cứu chung |
| [31] | expo-updates (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/updates/ | `updates.enabled: false` chỉ chạy bundle đóng gói sẵn |

**Khác**

| # | Tài liệu | Link | Dùng cho |
|---|---|---|---|
| [18] | babel-plugin-transform-remove-console | https://babeljs.io/docs/babel-plugin-transform-remove-console | Xoá `console` khi build, tuỳ chọn `exclude` |
| [19] | SheetJS advisory CVE-2023-30533 | https://cdn.sheetjs.com/advisories/CVE-2023-30533 | Prototype pollution, chỉ khi đọc file; npm không còn bảo trì (qua kết quả tìm kiếm) |
| [20] | SheetJS advisory CVE-2024-22363 | https://cdn.sheetjs.com/advisories/CVE-2024-22363 | ReDoS, bản ≤ 0.20.1 (qua kết quả tìm kiếm) |
| [21] | MyMemory API: usage limits | https://mymemory.translated.net/doc/usagelimits.php | 5.000 ký tự/ngày ẩn danh |

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-09-26 | 1 | Bản đầu, viết từ kiến thức có sẵn, chưa kiểm chứng nguồn |
| 2026-09-26 | 2 | Kiểm chứng từng thông tin với nguồn gốc; thêm đánh dấu trích dẫn và danh sách tài liệu tham khảo; đính chính 6 điểm (xem mục "Đính chính") |

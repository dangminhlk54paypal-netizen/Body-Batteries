# Báo cáo nghiên cứu: AI nhận diện món ăn & khối lượng từ ảnh chụp

| | |
|---|---|
| **Ngày** | 2026-10-23 (bản 1) |
| **Phạm vi** | Nghiên cứu & lập kế hoạch, chưa sửa code |
| **Nhánh khảo sát** | `ui-upgrade` (commit `4ef9d89`) |
| **Mục tiêu** | Chụp ảnh bữa ăn → AI đoán món + số gram → màn xác nhận (chỉnh gram, thanh scale, ＋ thêm món bị che) → ghi bằng engine có sẵn |

## Cách đọc ký hiệu

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* ở cuối báo cáo |
| `[Mã: file]` | Rút ra từ code của dự án |
| `[Nội bộ: file]` | Rút ra từ tài liệu nội bộ |
| 💡 | Nhận định / khuyến nghị của người viết |
| ❓ | Chưa kiểm chứng được |

Mọi nguồn web được mở và đọc ngày **2026-10-23**.

---

## Tóm tắt

1. 💡 **Ghép vào engine rất gọn.** AI chỉ cần trả về danh sách "tên món + số gram". App đã có sẵn hàm tìm món hai thứ tiếng `searchAllFoods` [Mã: [foodSearch.ts](../../src/data/food/foodSearch.ts)] và hàm ghi `logFood(item, grams, timestamp)` [Mã: [energyStore.ts](../../src/store/energyStore.ts)]. Pin, dinh dưỡng, lịch sử và Excel tự chạy như khi nhập tay.
2. **AI giỏi gọi tên món, nhưng kém ở số gram.** Một nghiên cứu năm 2025 đo sai số khối lượng trung bình khoảng **36–37 %** với ChatGPT-4o và Claude 3.5 Sonnet, còn Gemini 1.5 Pro sai nhiều hơn hẳn [6]. Mọi mô hình đều **đoán thiếu**, và đĩa càng to thì đoán thiếu càng nhiều [6]. Một bộ đánh giá năm 2026 gọi đây là "thất bại nghiêm trọng khi ước lượng khối lượng" [7]. 💡 Vì vậy ý tưởng thanh scale và ô chỉnh gram của anh/chị là **phần bắt buộc**, không phải phần phụ.
3. **Mâu thuẫn với nguyên tắc "dữ liệu chỉ nằm trên máy".** Ảnh phải gửi lên máy chủ của nhà cung cấp AI [Nội bộ: [bảo mật & phát hành](2026-09-26-bao-mat-va-phat-hanh-store.md)]. Nếu lên App Store, Apple bắt buộc **nói rõ dữ liệu được chia sẻ với AI bên thứ ba và xin phép rõ ràng trước khi gửi** [5]. 💡 Cách hợp lý: tính năng **tắt sẵn**, người dùng tự bật, và mỗi lần chỉ gửi đúng tấm ảnh.
4. **Chi phí rất thấp.** Với Claude, một ảnh khoảng 1000×1000 px tốn khoảng 1.296 token [1]. 💡 Ước tính khoảng **0,0004–0,014 USD mỗi ảnh**, tuỳ mô hình (xem mục 3).
5. 💡 **Làm được ngay trên Expo Go**, không cần bản build riêng: `expo-image-picker` có sẵn trong Expo Go SDK 58 [4], và gọi AI chỉ là một request mạng. Phương án chạy hẳn trên máy (Apple Foundation Models có thêm khả năng nhìn ảnh [10][11]) cần module native, nên để sau.

---

## Lưu ý quan trọng (đính chính giả định ban đầu)

| Giả định trong ý tưởng | Nguồn nói | Nguồn |
|---|---|---|
| AI nhận diện được khối lượng | Nhận diện **tên** món tốt, còn **khối lượng** sai trung bình khoảng 36 % trở lên và luôn đoán thiếu | [6][7] |
| Có thể dùng Gemini miễn phí | Ở bản miễn phí, Google dùng dữ liệu để cải thiện sản phẩm và **có người đọc** dữ liệu. Google cũng yêu cầu không gửi thông tin cá nhân. Người dùng ở EEA/UK/Thuỵ Sĩ **chỉ được dùng bản trả phí**, và người dùng phải từ 18 tuổi | [8] |
| Nhúng API key vào app | Expo cảnh báo biến `EXPO_PUBLIC_` **hiện nguyên văn trong app đã build**, nên không được chứa khoá bí mật | [3] |

---

## 1. Hiện trạng code liên quan

| Thành phần | Có sẵn | Bằng chứng |
|---|---|---|
| Tìm món vi/en/de | `searchAllFoods(query)`: tìm cả kho CSV, USDA và món tự tạo | [Mã: [foodSearch.ts](../../src/data/food/foodSearch.ts)] |
| Ghi món | `logFood(item, grams, timestamp, portion?)`, `logFoodForPastDate(...)` | [Mã: [energyStore.ts](../../src/store/energyStore.ts)] |
| Đơn vị đếm (gói, hộp…) | `gramsForPortion`, `ServingPreset` (chén = 150 g…) | [Mã: [foodNutrition.ts](../../src/domain/food/foodNutrition.ts)], [Mã: [food.ts](../../src/types/food.ts)] |
| Gram quen dùng của người dùng | Gợi ý món kèm `grams` từ lịch sử | [Mã: [foodSuggestions.ts](../../src/domain/food/foodSuggestions.ts)] |
| Lưu khoá an toàn | `expo-secure-store` đã cài | [Mã: [package.json](../../package.json)] |
| Tiền lệ gửi dữ liệu ra ngoài | Dịch tên món qua MyMemory | [Mã: [foodNameTranslationService.ts](../../src/services/translation/foodNameTranslationService.ts)] |
| Camera / chọn ảnh | **Chưa có** | — |

## 2. Luồng đề xuất

```
📷 Chụp/chọn ảnh ─► thu nhỏ ~1000 px ─► gửi AI (chỉ ảnh + lời nhắc cố định)
      ─► AI trả JSON: [{ tên_en, tên_vi, gram, độ_chắc }]
      ─► khớp từng món bằng searchAllFoods (chạy trên máy)
      ─► MÀN XÁC NHẬN ─► logFood() cho từng món đã tick
```

- 💡 **Khớp món chạy trên máy, không giao cho AI.** AI chỉ đưa ra tên gợi ý. App tự khớp vào kho món, vì vậy dinh dưỡng luôn lấy từ dữ liệu của app, không lấy số AI bịa ra.
- 💡 **Dùng "gram quen dùng" để sửa lỗi đoán thiếu.** Nếu người dùng đã từng ghi món này, hiện gợi ý "AI: 180 g · bạn hay ăn: 250 g" để chọn nhanh. Cách này bù đúng điểm yếu đoán thiếu mà [6] đã đo được.
- Mô hình có thể đếm sai và ước lượng không gian chỉ gần đúng [1]. 💡 Vì vậy luôn bắt người dùng xác nhận, không bao giờ tự ghi.

### Màn xác nhận (theo [mobile-ui-density](../../.ai/skills/mobile-ui-density.md))

```
┌ [ảnh nhỏ]   3 món · ~620 kcal       ⓘ ┐
│ Cơm trắng      [−] 180 g [+]   ✎       │
│ Thịt kho       [−] 120 g [+]   ✎       │
│ Rau muống xào  [−]  90 g [+]   ✎       │
│ Cả đĩa  ×0,5 ━━━━●━━━━ ×2   (1,0×)     │
│ ＋ Thêm món bị che / thiếu              │
│        [ Huỷ ]        [ Ghi 3 món ]     │
└─────────────────────────────────────────┘
```

- **Thanh "Cả đĩa"** nhân toàn bộ gram cùng một hệ số. Đây là đúng ý "scale theo thực tế" của anh/chị.
- **[−]/[+]** chỉnh từng món, có thể theo bước của preset (chén, bát).
- **✎** đổi sang món khác trong kho nếu khớp sai.
- **＋** mở ô tìm món có sẵn để thêm phần bị che (nước sốt, dầu, món dưới đáy).
- **ⓘ** giải thích "đây là ước lượng của AI, sai số thường 30–40 %" [6].

## 3. Chọn nhà cung cấp & chi phí

| | Claude API | Gemini API | Chạy trên máy (Apple) |
|---|---|---|---|
| Dùng dữ liệu để huấn luyện? | Mặc định **không** [9] | Bản miễn phí: **có**, kèm người đọc. Bản trả phí: không [8] | Không gửi đi đâu |
| Thời gian giữ dữ liệu | Tự xoá trong 30 ngày [2] | Bản trả phí: log trong "một thời gian giới hạn" [8] | — |
| Chạy trên Expo Go | Có (request mạng) 💡 | Có 💡 | **Không**, cần module native 💡 |
| Chất lượng ước lượng gram | Khoảng 37 % sai số (bản 3.5 Sonnet, 2024) [6] | Khoảng 64 % sai số trở lên (bản 1.5 Pro) [6] | ❓ chưa có số liệu |

**Chi phí Claude cho mỗi ảnh** (giá lấy từ [12]; số token ảnh lấy từ [1]; 💡 giả định khoảng 2.000 token vào và 300 token ra):

| Mô hình | Giá vào / ra (USD cho 1 triệu token) | 💡 USD mỗi ảnh | 💡 3 ảnh/ngày × 30 ngày |
|---|---|---|---|
| Claude Opus 5.5 | 4 / 20 | ≈ 0,014 | ≈ 1,3 USD |
| Claude Sonnet 5.5 | 2 / 10 | ≈ 0,007 | ≈ 0,6 USD |
| Claude Haiku 5.5 | 0,10 / 0,50 | ≈ 0,0004 | ≈ 0,03 USD |

💡 Các con số chính xác trong [6] được đo trên **mô hình đời cũ** (2024). Mô hình hiện nay có thể tốt hơn, nhưng [7] (2026) cho thấy ước lượng khối lượng vẫn là điểm yếu. Nên tự đo trên khoảng 20 bữa ăn **đã cân thật** của anh/chị trước khi chọn mô hình.

## 4. Quyền riêng tư & phát hành store

- **Khoá API:** không nhúng vào app [3]. 💡 Giai đoạn cá nhân: người dùng tự nhập khoá của mình (BYOK), lưu trong SecureStore. Không cần server, đúng nguyên tắc "không backend".
- 💡 **Cho người dùng đại trà:** BYOK khó dùng với người bình thường. Muốn ai cũng dùng được thì phải có server trung gian giữ khoá, mà như vậy là phá nguyên tắc "không backend" và tốn tiền. Đây là quyết định lớn, để sau.
- **App Store 5.1.2(i):** phải nói rõ dữ liệu được chia sẻ với AI bên thứ ba và xin phép rõ ràng trước khi gửi [5]. 💡 Lần đầu bật tính năng sẽ hiện màn đồng ý, ghi rõ tên nhà cung cấp và nói rằng chỉ ảnh được gửi đi, không kèm hồ sơ hay cân nặng.
- **App Store 1.4.1:** app sức khoẻ phải công khai dữ liệu và phương pháp khi đưa ra tuyên bố về độ chính xác [5]. 💡 Không quảng cáo "chính xác"; luôn gắn nhãn "ước lượng".
- 💡 **Không lưu ảnh** sau khi phân tích xong, chỉ lưu các dòng món đã ghi. Với Claude, ảnh gửi qua API không dùng để huấn luyện [1][9].

## 5. Lộ trình đề xuất 💡

| Đợt | Nội dung | Điều kiện |
|---|---|---|
| 1. Cá nhân (Expo Go) | Nhập khoá trong Cài đặt, nút 📷 trong Ghi món, gửi Claude, màn xác nhận, ghi qua `logFood`. i18n vi/en/de. Test cho phần đọc JSON và khớp món | `npm run verify` xanh, publish EAS `preview` |
| 2. Chính xác hơn | Gợi ý "gram quen dùng", thanh scale nhớ hệ số riêng của từng người, so sánh mô hình trên 20 bữa đã cân | Có dữ liệu cân thật |
| 3. Store | Màn đồng ý, chính sách quyền riêng tư, nhãn App Privacy; thử Apple Foundation Models có nhìn ảnh khi iOS 27 ra (cần bản build riêng) | Quyết định server hay BYOK |

❓ Hai điểm cần thử khi làm Đợt 1:
- `@anthropic-ai/sdk` chạy trên React Native có cần polyfill không.
- Thư viện thu nhỏ ảnh (`expo-image-manipulator`) có trong Expo Go SDK 58 không.

## 6. Quyết định cần chủ dự án chốt

1. **Có chấp nhận cho ảnh rời khỏi máy không** (tính năng tự bật, tắt sẵn)? 💡 Khuyến nghị: có, kèm màn đồng ý.
2. **Nhà cung cấp:** 💡 Claude: mặc định không huấn luyện bằng dữ liệu API [9] và không bị hạn chế EEA như Gemini miễn phí [8].
3. **Mô hình khởi đầu:** 💡 Opus 5.5 (khoảng 1,3 USD/tháng khi dùng nhiều). Sau đó đo xem Sonnet/Haiku có giữ được chất lượng trên bữa ăn đã cân không.
4. **Khoá API:** 💡 BYOK cho giai đoạn cá nhân; chuyện server để Đợt 3.

---

# Phần 2 (bản 2): Làm sao để không tốn tiền API

Câu hỏi của chủ dự án: (A) người dùng tự điền tài khoản AI miễn phí (Gemini, Claude, ChatGPT) và app "đi đường hầm" qua hãng AI; (B) nếu không được, có hướng thứ ba nào; (C) tự train model mã nguồn mở rồi nhúng vào app.

## Tóm tắt phần 2

1. **Đăng nhập tài khoản ChatGPT/Claude miễn phí vào app của mình: KHÔNG được.**
   - Anthropic ghi rõ: không cho nhà phát triển bên thứ ba cung cấp đăng nhập Claude.ai, gửi request bằng gói Free/Pro/Max thay người dùng, hay **thu thập, lưu, trung chuyển** thông tin đăng nhập/session của Claude.ai [13].
   - OpenAI: gói ChatGPT Plus không gồm API, API tính phí riêng (qua kết quả tìm kiếm) [14]. Điều khoản cấm "tự động hoặc bằng lập trình trích xuất dữ liệu hay Output" (qua kết quả tìm kiếm) [15].
   - 💡 "Đường hầm" lưu session đăng nhập sẽ vừa vi phạm điều khoản (tài khoản người dùng có thể bị khoá), vừa biến app thành nơi giữ mật khẩu của người khác. Đi ngược hẳn với định hướng "quyền riêng tư là trên hết".
2. **Hướng miễn phí hợp lệ nhất: mỗi người dùng tự tạo khoá Gemini miễn phí (BYOK).** Các model Gemini Flash/Flash-Lite có Free Tier, đầu vào kể cả ảnh là "Free of charge" [16]. Giới hạn tính theo từng project [17], nên mỗi người dùng một khoá riêng, không ai ăn chung quota. Đổi lại: ở bản miễn phí, Google dùng dữ liệu để cải thiện sản phẩm và có người đọc [8][16].
3. **Hướng thứ ba, 0 đồng và hợp lệ với mọi hãng: "cầu copy–paste".** App chuẩn bị sẵn ảnh và câu lệnh. Người dùng tự dán vào app ChatGPT/Gemini/Claude chính chủ của họ, rồi copy câu trả lời về. App đọc clipboard và mở màn xác nhận. Cả hai thư viện cần dùng (`expo-clipboard` [18], `expo-sharing` đã cài sẵn) đều chạy trong Expo Go.
4. **Tự train model: làm được cho phần "gọi tên món", không làm được cho phần "đoán gram".**
   - Bộ dữ liệu có cân khối lượng thật duy nhất là Nutrition5k: CC BY 4.0, 5.006 đĩa, nặng 181,4 GB, nhưng chỉ chụp ở canteen California [19].
   - Muốn chạy model trong app cần thư viện native như `react-native-fast-tflite` (MIT, cần prebuild) [20], tức **không chạy trên Expo Go**, phải làm development build [21].

## 7. So sánh 4 hướng

| Hướng | Chi phí của anh/chị | Hợp lệ? | Ảnh có rời máy? | Chạy Expo Go? | Ước lượng gram |
|---|---|---|---|---|---|
| A. Đăng nhập tài khoản AI miễn phí trong app | 0 | **Không** [13][15] | Có | — | — |
| B1. BYOK Gemini miễn phí | 0 (người dùng tự tạo khoá) | Có [16], ❓ xem lưu ý EEA bên dưới | Có, sang Google | Có 💡 | Yếu, giống mục 3 [6] |
| B2. BYOK khoá trả phí (Claude…) | 0 (người dùng tự trả) | Có [13] | Có | Có 💡 | Yếu [6] |
| B3. Cầu copy–paste | 0 | Có 💡 (người dùng tự dùng app chính chủ) | Có, do người dùng tự gửi | Có [18] | Yếu [6] |
| C. Model tự train trên máy | 0 tiền API; tốn thời gian train + cần build riêng | Có, nếu dữ liệu train có giấy phép rõ | **Không** | **Không** [20][21] | Rất yếu với món Việt 💡 |

### Lưu ý EEA cho Gemini miễn phí ❓
Điều khoản Gemini có hai câu cần đọc cùng nhau [8]:
- "chỉ được dùng Paid Services khi đưa API Client tới người dùng ở EEA/UK/Thuỵ Sĩ";
- ở các khu vực đó, điều khoản dữ liệu của bản trả phí áp dụng cho cả quota miễn phí.

❓ Chưa rõ trường hợp app cho người dùng EEA tự nhập khoá miễn phí của chính họ được xếp vào loại nào. Trước khi phát hành ở EU (app có tiếng Đức) cần đọc lại kỹ hoặc hỏi Google. 💡 Dùng cá nhân thì không vướng.

## 8. Hướng B3: "cầu copy–paste" chi tiết 💡

```
[📷 Chụp] → app lưu ảnh + copy sẵn câu lệnh:
   "Liệt kê món trong ảnh, trả JSON {items:[{name_en,name_vi,grams}]}"
→ nút "Mở chia sẻ" (expo-sharing) → người dùng chọn ChatGPT / Gemini / Claude
→ dán câu lệnh, gửi, bấm Copy câu trả lời
→ quay lại app: [📋 Dán kết quả] → app đọc clipboard → màn xác nhận như mục 2
```

- Ưu điểm: 0 đồng, không cần khoá, không giữ tài khoản ai, người dùng chọn AI nào cũng được. Dữ liệu chịu điều khoản tài khoản của chính họ.
- Nhược điểm: thêm khoảng 4 thao tác. Trên iOS 16+, nếu người dùng từ chối quyền dán thì clipboard trả về rỗng [18], nên app phải báo lỗi rõ ràng.
- ❓ Chưa kiểm chứng app ChatGPT/Gemini/Claude trên iOS có nhận cả ảnh lẫn chữ cùng lúc qua menu chia sẻ không. Phương án dự phòng: người dùng tự chọn ảnh trong app AI rồi dán câu lệnh.
- App phải đọc được JSON lẫn trong văn bản thừa, vì AI hay thêm lời dẫn. Phần đọc này là hàm thuần trong `src/domain/food/`, test được và dùng chung cho cả B1/B2.

## 9. Hướng C: tự train model 💡

**Chia bài toán làm hai, vì độ khó rất khác nhau:**

| Việc | Dữ liệu mở | Khả thi |
|---|---|---|
| Gọi tên món (phân loại ảnh) | Food-101: 101 món, 101.000 ảnh; trang gốc **không ghi giấy phép** ❓ [22]. VinaFood21: 21 món Việt, 13.950 ảnh; giấy phép ❓ chưa thấy (qua kết quả tìm kiếm) [23] | 💡 Khả thi: fine-tune một mạng nhỏ (MobileNet/EfficientNet), xuất `.tflite`, vài MB |
| Đoán gram | Nutrition5k (CC BY 4.0, có khối lượng từng nguyên liệu) [19] | 💡 Rất khó: một ảnh không cho biết độ sâu/kích thước thật, dữ liệu chỉ có món canteen Mỹ. Ngay cả AI lớn cũng sai khoảng 36 % [6] |

**Cách ghép vào app** (giữ nguyên engine):
1. Model trả ra nhãn, ví dụ `pho_bo`. Một bảng `nhãn → foodId` trỏ vào kho món sẵn có ([foodSearch.ts](../../src/data/food/foodSearch.ts)).
2. Gram: lấy "gram quen dùng" của người dùng ([foodSuggestions.ts](../../src/domain/food/foodSuggestions.ts)) hoặc preset (chén/bát), rồi chỉnh bằng thanh scale. Không bắt model đoán gram.
3. Chạy bằng `react-native-fast-tflite` (MIT, có config plugin Expo, có CoreML trên iOS) [20]. Việc này cần development build [21]. Theo [AGENTS.md](../../AGENTS.md), thêm module native thì không thử trên Expo Go được, phải build riêng.

**Rủi ro:**
- Giấy phép dữ liệu: Food-101 và VinaFood21 chưa rõ giấy phép ❓. Nếu phát hành trên store thì nên chỉ train trên dữ liệu có giấy phép rõ, hoặc ảnh tự chụp.
- 💡 Với 21–101 nhãn, model chỉ nhận được món nằm trong danh sách. Món lạ sẽ bị đoán nhầm sang món gần nhất, nên màn xác nhận càng cần thiết.

## 10. Khuyến nghị lộ trình mới (không tốn tiền) 💡

| Đợt | Làm gì | Ghi chú |
|---|---|---|
| 1 | **Cầu copy–paste (B3)** + màn xác nhận + phần đọc JSON | 0 đồng, Expo Go, hợp lệ với mọi hãng |
| 1b | Thêm ô **"Khoá AI của bạn"** (BYOK) trong Cài đặt, mặc định là Gemini Free Tier, lưu trong SecureStore | Dùng lại đúng phần đọc JSON và màn xác nhận của Đợt 1 |
| 2 | "Gram quen dùng" + thanh scale nhớ hệ số riêng | Bù lỗi đoán thiếu [6] |
| 3 | Model trên máy: Apple Foundation Models có nhìn ảnh (iOS 27) [10][11] hoặc model tự train | Cần development build; làm cùng lúc chuẩn bị lên store |

## Quyết định cần chốt (phần 2)

1. 💡 Bỏ hẳn hướng A (đăng nhập hộ tài khoản AI): vi phạm điều khoản [13][15] và trái với định hướng quyền riêng tư.
2. Bắt đầu bằng B3 (copy–paste) hay B1 (khoá Gemini miễn phí)? 💡 B3 trước, vì không phụ thuộc hãng nào; B1 là đường tắt cho người chịu tạo khoá.
3. Có đầu tư hướng C không? 💡 Để sau: Apple sắp có model nhìn ảnh miễn phí ngay trên máy [10], có thể không cần tự train.

---

# Phần 3 (bản 3): Ô "Nạp bằng chữ": một cửa cho giọng nói, gõ tay và kết quả AI

Ý của chủ dự án: một ô trống nhận chữ (gõ tay, đọc bằng giọng nói, hoặc dán câu trả lời của AI). Engine xử lý một chiều theo chuỗi **Parsing → Decoding → Mapping & Validation → Upsert**, đưa ra danh sách chờ, người dùng duyệt từng món rồi mới Nạp. Có thời điểm ăn và thời gian cập nhật.

## Tóm tắt phần 3

1. 💡 **Đây là kiến trúc đúng.** Ảnh và AI chỉ là một nguồn chữ. Cùng một bộ xử lý phục vụ cả gõ tay, giọng nói, cầu copy–paste (Phần 2) và sau này là model trên máy. Bộ xử lý chạy hoàn toàn trên máy và 0 đồng.
2. **Giọng nói làm được ngay, không cần thư viện.** Nút 🎤 trên bàn phím iPhone (Dictation) hỗ trợ **Vietnamese (Vietnam)** và **German (Germany)** [24]. Nó gõ chữ vào bất kỳ ô nhập nào, kể cả trong Expo Go. Nút 🎤 riêng trong app (`expo-speech-recognition`, MIT) thì cần development build [25].
3. **Engine đã có gần đủ mảnh ghép:**
   - tìm món chịu lỗi gõ (`searchFoods`, `fuzzyMatch`) [Mã: [foodSearch.ts](../../src/data/food/foodSearch.ts)], [Mã: [fuzzyMatch.ts](../../src/domain/food/fuzzyMatch.ts)];
   - preset chén/bát (`servingPresets`) và đơn vị đếm (`gramsForPortion`) [Mã: [foodNutrition.ts](../../src/domain/food/foodNutrition.ts)];
   - bữa theo giờ (`mealTypeForTimestamp`), ghi hôm nay (`logFood`) và ghi ngày cũ (`logFoodForPastDate`, `validateBackfillDate`) [Mã: [energyStore.ts](../../src/store/energyStore.ts)], [Mã: [backfillEngine.ts](../../src/domain/food/backfillEngine.ts)].

   💡 Phần thật sự phải viết mới là **Parsing và Decoding**.
4. 💡 **Đính chính thuật ngữ "Upsert":** mỗi lần ăn là một sự kiện mới, nên bước cuối nên là **Insert**, không gộp. Hai bát phở là hai bát. Việc chống trùng làm bằng **cảnh báo** ("Phở bò đã ghi lúc 7:30, vẫn nạp?"), không tự gộp hay ghi đè.

## 11. Chuỗi xử lý 💡

| Bước | Vào → Ra | Ví dụ | Dùng lại |
|---|---|---|---|
| **1. Parsing**: tách | Chữ thô → các đoạn | `"2 chén cơm, phở bò và 200g ức gà lúc 12h"` → 3 đoạn + gợi ý giờ `12h`. Nếu là JSON từ AI (lẫn lời dẫn, ```` ``` ````) thì đi nhánh có cấu trúc | — (mới) |
| **2. Decoding**: giải mã | Đoạn → `{số lượng, đơn vị, tên món, giờ}` | `"2 chén cơm"` → `{2, chén, "cơm"}`; `"nửa ổ bánh mì"` → `{0.5, ổ, "bánh mì"}`; `"sáng nay"`, `"hôm qua"`, `"gestern"`, `"7:30"` | `parseDecimal` [Mã: [units.ts](../../src/lib/units.ts)] |
| **3. Mapping**: ghép | Tên → món trong kho, đơn vị → gram | `"cơm"` → Cơm trắng; `chén` → preset 150 g × 2 = 300 g. Không có lượng → **gram quen dùng** của người dùng, nếu chưa có thì `defaultServingG` | `searchFoods`, `servingPresets`, `gramsForPortion`, [foodSuggestions.ts](../../src/domain/food/foodSuggestions.ts) |
| **3b. Validation**: kiểm | Gắn nhãn cho mỗi dòng | ✓ khớp chắc · ⚠ khớp gần đúng / lượng do đoán / gram bất thường (> 2 kg) / trùng món vừa ghi · ✗ không tìm thấy món / giờ ở tương lai / ngày quá cũ | `validateBackfillDate` |
| **4. Duyệt** | Danh sách chờ | Người dùng tick từng món, sửa ✎, thêm ＋ | — (mới, UI) |
| **5. Insert (Nạp)** | Món đã tick → nhật ký | Hôm nay → `logFood`; ngày cũ → `logFoodForPastDate` | Có sẵn |

**Đặt code theo lớp** (đúng quy tắc [AGENTS.md](../../AGENTS.md)):
- Bước 1–3b là **hàm thuần** trong `src/domain/food/mealText/`. Chúng nhận `language` và một hàm tìm món được truyền vào, không đọc store, nên test được từng bước.
- Từ khoá để hiểu chữ (`chén`, `bát`, `nửa`, `sáng nay`, `cup`, `Tasse`, `gestern`…) là **từ khoá phân tích, không hiển thị**. Chúng cùng loại với [foodSearchAliases.ts](../../src/data/food/foodSearchAliases.ts), nên để trong domain, theo từng ngôn ngữ, không đưa vào file dịch giao diện. Mọi chữ **hiển thị** (nhãn ⚠, nút, lỗi) vẫn đi qua `t()` và đủ 3 file vi/en/de.
- Danh sách chờ nhớ tạm theo mẫu "giữ nhập dở 5 phút" đã có [Mã: [activityDraftStore.ts](../../src/store/activityDraftStore.ts)].

## 12. Thời gian: hai khái niệm khác nhau

| | Nghĩa | Hiện có? |
|---|---|---|
| **Thời điểm ăn** | Lúc ăn thật. Quyết định món vào bữa nào và Pin ngày nào | Có: `FoodLogEntry.timestamp`, sửa được [Mã: [food.ts](../../src/types/food.ts)] |
| **Thời gian cập nhật** | Lúc bấm Nạp hoặc lần sửa cuối | **Chưa có.** Muốn lưu phải thêm cột vào bảng nhật ký món + migration 💡 |

💡 **Thời điểm ăn**, theo thứ tự ưu tiên:
1. giờ trong câu ("lúc 12h", "hôm qua");
2. ô 🕐 chung cho cả lượt ở đầu danh sách;
3. mặc định "bây giờ".

Mỗi dòng có thể sửa riêng giờ của mình.

## 13. Màn hình (theo [mobile-ui-density](../../.ai/skills/mobile-ui-density.md)) 💡

```
┌ ⚡ Nạp bằng chữ                          ⓘ ┐
│ ┌──────────────────────────────────────┐ │
│ │ 2 chén cơm, phở bò, 200g ức gà 12h   │ │  ← gõ / 🎤 bàn phím / dán từ AI
│ └──────────────────────────────────────┘ │
│              [ Phân tích ]               │
│ 🕐 Hôm nay 12:00 ▾          3 món · 980 kcal│
│ ☑ ✓ Cơm trắng     [−] 300 g [+]   ✎     │  ← cửa sổ cuộn cố định
│ ☑ ⚠ Phở bò        [−] 450 g [+]   ✎     │     (⚠ = lượng quen dùng)
│ ☐ ✗ "ức gà nướng mật ong"  ＋ tạo món    │
│        [ Huỷ ]        [ Nạp 2 món ]      │
└──────────────────────────────────────────┘
```

- Mục vào: nút "✎ Nạp bằng chữ" cạnh nút ⚡ Nạp hiện có (nhãn `logFoodButton`).
- Dòng ✗ không bao giờ được tick sẵn. Dòng ⚠ được tick sẵn nhưng có chấm vàng để người dùng để ý.

## 14. Lộ trình cập nhật 💡

| Đợt | Nội dung |
|---|---|
| **1** | Bước 1–3b (hàm thuần + bộ test lớn bằng câu thật vi/en/de) + màn Nạp bằng chữ + Nạp. Giọng nói dùng 🎤 bàn phím. Chạy Expo Go |
| **2** | Nhánh JSON cho cầu copy–paste AI (Phần 2, B3): nút "📋 Dán từ AI" đổ vào cùng ô |
| **3** | Lưu "thời gian cập nhật" (migration); nút 🎤 riêng + nhận giọng trên máy (development build) [25]; ảnh → model trên máy |

❓ Chưa kiểm chứng: đọc tiếng Việt bằng Dictation có xử lý ngay trên máy hay gửi âm thanh về Apple. Trang của Apple chỉ liệt kê tiếng Việt ở mục xử lý giọng nói của Siri [24].

## 15. Tiến độ Đợt 1 (dừng giữa chừng 2026-10-23)

Chủ dự án đã chốt: (1) "thời gian cập nhật" để Đợt 3; (2) trùng món thì **hiện nội dung cảnh báo** (món, lượng, giờ đã nạp) và dòng đó bắt đầu ở trạng thái bỏ tick, không trùng thì thêm như món mới; (3) làm Đợt 1.

**Đã xong** (typecheck và lint sạch, 49 test mới đều qua):
- [mealTextLexicon.ts](../../src/domain/food/mealText/mealTextLexicon.ts): từ khoá vi/en/de (giờ, bữa, số, đơn vị, từ đệm, từ nối).
- [parseMealText.ts](../../src/domain/food/mealText/parseMealText.ts): Parsing + Decoding.
- [mapMealText.ts](../../src/domain/food/mealText/mapMealText.ts): Mapping & Validation, phát hiện trùng trong ±3 giờ, các thao tác sửa dòng.
- [mealTextSearch.ts](../../src/data/food/mealTextSearch.ts): từ trơn → món cơ bản ("cơm" → Cơm trắng).
- [mealTextDraftStore.ts](../../src/store/mealTextDraftStore.ts): giữ chữ nhập dở 5 phút.
- [TextMealEntry.tsx](../../src/components/food/TextMealEntry.tsx): màn nhập, danh sách duyệt, sửa dòng, chọn món, đặt giờ cho cả danh sách, Nạp.
- [FoodLogModal.tsx](../../src/components/FoodLogModal.tsx): nút "⌨️ Nạp bằng chữ" ở đầu màn tìm món.
- Chữ hiển thị đủ vi/en/de (`components.textMealEntry.*`, `foodLogModal.textEntryButton`).
- Test: [parseMealText.test.ts](../../src/domain/food/mealText/__tests__/parseMealText.test.ts), [mapMealText.test.ts](../../src/domain/food/mealText/__tests__/mapMealText.test.ts), [mealTextSearch.test.ts](../../src/data/food/__tests__/mealTextSearch.test.ts).

**Còn lại khi làm tiếp:**
1. Test render cho `TextMealEntry`: gõ → Phân tích → tick → Nạp gọi `logFood`. Viết theo mẫu `src/components/__tests__/ActivityLogSheet.test.tsx`.
2. Chạy `npm run verify` toàn bộ.
3. Thử trên máy: độ rộng hàng bằng tiếng Đức, bàn phím che danh sách, 🎤 Dictation.
4. Cập nhật tài liệu: mẫu giao diện vào `.ai/skills/mobile-ui-density.md`, mục mới trong `docs/03-architecture.md` và `docs/HUONG-DAN-SU-DUNG-APP.md`, ghi nhật ký `.ai/SESSION_LOG.md`.
5. Publish EAS `preview` **từ bản sao tách riêng**, vì thư mục làm việc đang có phần dở của một phiên khác (nhập kho món từ file).
6. Chưa làm: món từ bảng người dùng tự nhập ("Nguồn của tôi") chưa được tìm trong Nạp bằng chữ, vì bảng đó tìm bất đồng bộ qua `useLibrarySearch`.

**Cập nhật cùng ngày (sau khi làm tiếp):**
- Mục 1–5 ở trên đã xong. Bản `preview` `a4429e44…` gồm Đợt 1. Việc kiểm tra trên máy được gom vào
  [`docs/KIEM-TRA-TREN-MAY.md`](../KIEM-TRA-TREN-MAY.md).
- **Đợt 2 xong:** 📤 Hỏi AI (share sheet + câu lệnh JSON) và 📋 Dán (`expo-clipboard`), bộ đọc JSON, tên tiếng Anh làm
  phương án dự phòng. Mục 6 cũng xong: món "Nguồn của tôi" đã được tìm.
- **Đợt 3a xong:** cột `food_log.logged_at` (thời gian cập nhật), 2 cột Excel, dòng "Ăn … · ghi …" trong ô sửa món.
- **Còn Đợt 3b:** 🎤 trong app và đọc ảnh bằng model trên máy, cả hai cần development build.

---

## Tài liệu tham khảo

**Anthropic**
- [1] Vision — https://platform.claude.com/docs/en/build-with-claude/vision — Dùng cho: công thức token ảnh, giới hạn 8000 px / 10 MB, hạn chế đếm và ước lượng không gian, "không dùng ảnh để huấn luyện". Truy cập 2026-10-23.
- [2] How long do you store my organization's data? — https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data — Dùng cho: xoá trong 30 ngày. Truy cập 2026-10-23.
- [9] Is my data used for model training? — https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training — Dùng cho: mặc định không huấn luyện bằng dữ liệu API. Truy cập 2026-10-23.
- [12] Pricing — https://platform.claude.com/docs/en/about-claude/pricing — Dùng cho: giá Opus/Sonnet/Haiku 5.5. Truy cập 2026-10-23.

**Expo**
- [3] Environment variables — https://docs.expo.dev/guides/environment-variables/ — Dùng cho: `EXPO_PUBLIC_` hiện nguyên văn trong app. Truy cập 2026-10-23.
- [4] ImagePicker (SDK 58) — https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/ — Dùng cho: có trong Expo Go, `quality`, `base64`, quyền camera. Truy cập 2026-10-23.

**Apple**
- [5] App Review Guidelines — https://developer.apple.com/app-store/review/guidelines/ — Dùng cho: mục 5.1.2(i) về AI bên thứ ba, mục 1.4.1 về độ chính xác. Truy cập 2026-10-23.
- [10] What's new in the Foundation Models framework (WWDC26) — https://developer.apple.com/videos/play/wwdc2026/241/ — Dùng cho: mô hình trên máy có thêm khả năng nhìn ảnh. Truy cập 2026-10-23.
- [11] What's new in iOS 27 — https://developer.apple.com/wwdc26/guides/ios/ — Dùng cho: prompt đa phương thức thuộc iOS 27. Truy cập 2026-10-23.

**Google**
- [8] Gemini API Additional Terms — https://ai.google.dev/gemini-api/terms — Dùng cho: bản miễn phí dùng dữ liệu và có người đọc, EEA/UK chỉ dùng bản trả phí, từ 18 tuổi. Truy cập 2026-10-23.

**Nghiên cứu khoa học**
- [6] Fridolfsson J. et al., *Performance Evaluation of 3 Large Language Models for Nutritional Content Estimation from Food Images*, Current Developments in Nutrition 9(10), 2025, DOI 10.1016/j.cdnut.2025.107556 — https://pmc.ncbi.nlm.nih.gov/articles/PMC12513282/ (đọc qua bản tóm tắt Europe PMC: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC12513282&resultType=core&format=json) — Dùng cho: sai số khối lượng 36,3 % / 37,3 %, Gemini 64,2–109,9 %, đoán thiếu tăng theo khẩu phần. Truy cập 2026-10-23.
- [7] Jiang Q. et al., *OmniFood-Bench: Evaluating VLMs for Nutrient Reasoning and Personalized Health Advice*, arXiv:2607.08423, 2026 — https://arxiv.org/abs/2607.08423 — Dùng cho: "catastrophic failure in mass estimation" (chỉ đọc phần tóm tắt; số MAPE chi tiết trong bài ❓ chưa đọc). Truy cập 2026-10-23.

**Phần 2: điều khoản, hướng miễn phí, tự train**
- [13] Claude Code docs — Legal and compliance (mục "Authentication and credential use") — https://code.claude.com/docs/en/legal-and-compliance — Dùng cho: cấm cung cấp đăng nhập Claude.ai, cấm dùng gói Free/Pro/Max thay người dùng, cấm thu thập/lưu credential. Truy cập 2026-10-23.
- [14] OpenAI Help — What is ChatGPT Plus? — https://help.openai.com/en/articles/6950777 — Dùng cho: API không nằm trong gói Plus, tính phí riêng. (Trang trả về 403 khi mở trực tiếp; nội dung lấy **qua kết quả tìm kiếm**.) Truy cập 2026-10-23.
- [15] OpenAI Terms of Use — https://openai.com/policies/terms-of-use/ — Dùng cho: cấm "automatically or programmatically extract data or Output". (403 khi mở trực tiếp; **qua kết quả tìm kiếm**.) Truy cập 2026-10-23.
- [16] Gemini Developer API pricing — https://ai.google.dev/gemini-api/docs/pricing — Dùng cho: Free Tier của Flash/Flash-Lite, đầu vào "Free of charge", bản miễn phí "Used to improve our products". Truy cập 2026-10-23.
- [17] Gemini API rate limits — https://ai.google.dev/gemini-api/docs/rate-limits — Dùng cho: giới hạn tính theo project, con số cụ thể xem trong AI Studio. Truy cập 2026-10-23.
- [18] Expo Clipboard (SDK 58) — https://docs.expo.dev/versions/v58.0.0/sdk/clipboard/ — Dùng cho: có trong Expo Go, iOS 16+ từ chối quyền dán thì trả chuỗi rỗng. Truy cập 2026-10-23.
- [19] Nutrition5k (GitHub, Google Research) — https://github.com/google-research-datasets/Nutrition5k — Dùng cho: CC BY 4.0, 5.006 đĩa, 181,4 GB, nhãn khối lượng, chỉ canteen California, repo lưu trữ từ 19/04/2026. Truy cập 2026-10-23.
- [20] react-native-fast-tflite — https://github.com/mrousavy/react-native-fast-tflite — Dùng cho: giấy phép MIT, config plugin Expo, CoreML delegate, cần prebuild. Truy cập 2026-10-23.
- [21] Expo — Introduction to development builds — https://docs.expo.dev/develop/development-builds/introduction/ — Dùng cho: development build là "bản Expo Go riêng" để dùng thư viện native tuỳ ý. Truy cập 2026-10-23.
- [22] Food-101 (ETH Zürich) — https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/ — Dùng cho: 101 món, 101.000 ảnh, trang không ghi giấy phép. Truy cập 2026-10-23.
- [23] VinaFood21 (arXiv 2108.02929) — https://arxiv.org/abs/2108.02929v1 — Dùng cho: 21 món Việt, 13.950 ảnh (**qua kết quả tìm kiếm**); giấy phép chưa rõ. Truy cập 2026-10-23.

**Phần 3: nhập bằng chữ / giọng nói**
- [24] Apple — iOS Feature Availability (mục Dictation; Siri On-Device Speech Processing) — https://www.apple.com/ios/feature-availability/ — Dùng cho: Dictation hỗ trợ Vietnamese (Vietnam), German (Germany/Austria/Switzerland). Truy cập 2026-10-23.
- [25] expo-speech-recognition — https://github.com/jamsch/expo-speech-recognition — Dùng cho: giấy phép MIT, cần development build, nhận giọng trên máy (iOS 17+, Android 13+), chọn ngôn ngữ `lang`. Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu: hiện trạng code, luồng, màn xác nhận, chi phí, quyền riêng tư, lộ trình |
| 2026-10-23 | 2 | Thêm Phần 2: không được đăng nhập hộ tài khoản AI; BYOK Gemini miễn phí; cầu copy–paste; tự train model (dữ liệu, giấy phép, cần development build); lộ trình 0 đồng |
| 2026-10-23 | 3 | Thêm Phần 3: ô Nạp bằng chữ (Parsing → Decoding → Mapping & Validation → Insert), Dictation bàn phím vi/de, hai loại thời gian, màn duyệt; đính chính Upsert → Insert + cảnh báo trùng |

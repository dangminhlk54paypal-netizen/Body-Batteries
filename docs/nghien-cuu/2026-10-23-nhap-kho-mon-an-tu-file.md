# Nhập kho món ăn của riêng người dùng từ file bảng (CSV / Excel)

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Định hướng: người dùng có bảng dinh dưỡng sạch của riêng họ (tải từ mạng hoặc tự làm), nhập vào app, app làm "máy tính" và nơi lưu trên máy |
| Nhánh / commit khảo sát | `ui-upgrade` @ `4ef9d89` (+ thay đổi chưa commit) |
| Mục tiêu | Bản 1: cách nghĩ, kiến trúc đề xuất, thứ tự làm. Bản 1.1: ghi quyết định của chủ app và cách xử lý file lớn. Chưa viết code |

Chú giải: `[n]` nguồn web số n (truy cập 2026-10-23) · `[Mã: file]` rút từ code · 💡 nhận định của AI · ❓ chưa kiểm chứng.

## Tóm tắt
1. 💡 Hướng này **hợp với app**: app đã chỉ chạy trên máy, đã có "động cơ" tính theo 100 g. Mọi món, dù từ đâu, đều về
   cùng một dạng `per100g`, rồi `nutritionForGrams` nhân theo khẩu phần [Mã: src/types/food.ts]. Việc của tính năng nhập
   chỉ là **đổi bảng của người dùng về dạng đó**. Phần tính toán đã có sẵn.
2. 💡 **Đừng đổ thẳng vào "Món của tôi"** (`custom_foods`). Danh sách đó nằm trong bộ nhớ, và chỉ mục tìm kiếm của nó được
   dựng lại ở **mỗi lần tìm**, vì code giả định "danh sách nhỏ" [Mã: src/data/food/foodSearch.ts]. Nếu thêm vài nghìn dòng,
   gõ tìm sẽ chậm. Nên làm một lớp mới là **"Nguồn của tôi"**: mỗi file nhập vào là một nguồn có tên, bật/tắt được, xoá
   được cả nguồn, nhập lại để cập nhật.
3. Đọc file Excel: thư viện `xlsx` app đang dùng là bản `^0.18.5` [Mã: package.json]. Mọi bản dưới 0.19.3 có lỗi bảo mật
   **khi đọc** file được làm cố ý (prototype pollution). Chỉ xuất file thì không bị ảnh hưởng [1]. Bản đã sửa **không có trên
   npm**, chỉ có trên CDN của SheetJS [1]. 💡 Vì vậy giai đoạn đầu **chỉ nhận CSV**: app đã có bộ đọc CSV tự viết, không cần
   thư viện thêm và đã có test [Mã: src/data/food/foodCsv.ts]. Excel thì người dùng chọn "Lưu dưới dạng CSV".
4. Chọn file: `expo-document-picker` đã cài [Mã: package.json] và có sẵn trong Expo Go. Nó trả về `uri`, `name`, `mimeType`,
   `size`, và mặc định chép file vào thư mục cache để app đọc ngay [3]. Như vậy làm được trên Expo Go, không cần bản build riêng.
5. Nguồn dữ liệu trên mạng: dữ liệu USDA FoodData Central thuộc phạm vi công cộng (CC0), dùng không cần xin phép [2].
   Open Food Facts dùng giấy phép ODbL: nếu **dùng công khai** thì phải ghi nguồn và chia sẻ lại bản đã sửa [4]. File CSV
   thực phẩm của Open Food Facts nặng khoảng 0,9 GB khi đã nén [4]. 💡 App không nên nhận nguyên file đó. Người dùng cần lọc
   trước. Thêm nữa, ❓ chuyện một người tự nhập file vào máy mình có tính là "dùng công khai" hay không chưa được kiểm chứng
   về mặt pháp lý. Nếu sau này app **tự gói sẵn** dữ liệu Open Food Facts thì chắc chắn phải theo ODbL [4].

## Quyết định của chủ app (2026-10-23)
| Câu hỏi | Quyết định |
|---|---|
| Định dạng | Nhận **CSV trước**, **.xlsx** làm ở đợt sau |
| Sửa món trong nguồn nhập | Theo đề xuất: không sửa trực tiếp, chỉnh bằng "bản sửa" (override) để lần nhập lại không xoá mất |
| Giới hạn kích thước | Do người dùng quyết định, app **hỏi họ**. Mặc định **10 MB** (đã là nhiều). Cho mở tới **vài trăm MB**. Tới GB thì không hỗ trợ |

## File lớn: 10 MB mặc định, tới vài trăm MB
- **CSV đọc được từng phần.** Trong Expo SDK 58, `File.open()` trả về `FileHandle`. Hàm `readBytes(length)` đọc tiếp từ
  vị trí `offset`, và tài liệu hướng dẫn gọi trong vòng lặp để đọc file lớn [5]. Ngoài ra còn có `readableStream()` [5].
  Còn `file.text()` / `bytes()` thì nạp **cả file** vào bộ nhớ [5]. 💡 Vậy với CSV: đọc từng khúc (ví dụ 1 MB), tách
  dòng, kiểm tra rồi ghi vào SQLite theo lô. Nhờ đó file vài trăm MB không phải nằm trọn trong RAM. Thanh tiến trình có
  thể tính theo `offset / size` [5]. Bộ đọc CSV hiện tại xử lý theo từng dòng [Mã: src/data/food/foodCsv.ts]. Riêng một ô
  có dấu ngoặc kép chứa xuống dòng thì phải tính chuyện nối qua ranh giới hai khúc.
- **.xlsx thì phải nạp cả file.** SheetJS đọc nguyên file vào bộ nhớ. Phần "stream" của nó chỉ dùng để ghi, không dùng để
  đọc [6]. File .xlsx là dạng nén, nên khi mở ra còn chiếm nhiều bộ nhớ hơn kích thước file trên đĩa. 💡 Vì vậy hạn của
  .xlsx nên **thấp hơn** CSV, ví dụ mặc định khoảng 10 MB. File lớn hơn thì app khuyên người dùng lưu sang CSV.
  ❓ Mức bộ nhớ thật trên iPhone chưa đo, phải thử trên máy.
- **Tìm kiếm khi có rất nhiều dòng.** 💡 Một dòng món trong CSV khoảng 200–500 byte, nên 10 MB ≈ 20 000–50 000 món, còn
  vài trăm MB ≈ cả triệu món. Danh mục gốc dựng chỉ mục tìm kiếm trong bộ nhớ [Mã: src/data/food/foodSearch.ts]. Cách đó
  ổn với vài chục nghìn món, nhưng không ổn với cả triệu. Đề xuất chia hai mức:
  - nguồn nhỏ (dưới một ngưỡng, ví dụ 50 000 món): chỉ mục trong bộ nhớ, tìm như danh mục gốc, có gợi ý khi gõ sai;
  - nguồn lớn: lưu thêm cột tên đã chuẩn hoá (bỏ dấu, chữ thường) trong SQLite, có index, rồi tìm bằng truy vấn và chỉ lấy
    vài chục kết quả đầu. ❓ Chưa kiểm tra `expo-sqlite` trên Expo Go có hỗ trợ FTS5 (tìm toàn văn) không. Nếu có thì dùng FTS5.
- **Hỏi người dùng.** Khi file lớn hơn mức mặc định, app hiện kích thước, số dòng ước tính và thời gian ước tính, rồi hỏi
  "Vẫn nhập?". Người dùng đổi được mức mặc định trong Cài đặt. Mức trần cứng khoảng vài trăm MB. File từ 1 GB trở lên thì
  từ chối và khuyên lọc trước.

## Cách nghĩ: app là "máy tính", người dùng là "chủ dữ liệu"
- 💡 Có ba loại món, nên ghi rõ loại nào ra loại nào. App đã ghi nguồn cho từng kết quả tìm kiếm (`mine` / `catalog` / `usda`)
  [Mã: src/domain/food/foodSource.ts]. Loại thứ tư nên là `library`, nghĩa là "nguồn bạn nhập":
  | Loại | Ai làm | Số lượng | Lưu ở đâu |
  |---|---|---|---|
  | Danh mục gốc / USDA | app gói sẵn | cố định | trong mã app |
  | Món của tôi | gõ tay từng món | ít | `custom_foods` |
  | **Nguồn của tôi** (mới) | nhập cả file | vài trăm đến vài chục nghìn | bảng SQLite mới, có `source_id` |
- 💡 App **không sửa dữ liệu** của người dùng mà chỉ đổi đơn vị và báo lỗi. Ai nhập thì người đó chịu trách nhiệm về độ
  đúng, và màn hình ghi rõ "Nguồn: <tên file>". Cách này đúng ranh giới "công cụ tự theo dõi, không phải thiết bị y tế"
  [Mã: src/types/food.ts].

## Các bước nhập (đề xuất)
1. **Chọn file** bằng bộ chọn file hệ thống [3]. Bộ chọn trả về `size` [3], nên app so ngay với mức người dùng đã chọn
   (mặc định 10 MB) và hỏi khi vượt (xem mục "File lớn").
2. **Đọc dòng tiêu đề, đoán cột.** Có một từ điển tên cột theo 3 thứ tiếng, ví dụ "Protein / Eiweiß / Đạm" → `proteinG`
   và "Energie / Năng lượng / kcal" → `energyKcal`. 💡 Từ điển này là dữ liệu của tầng domain, không phải chữ hiển thị, nên
   đặt trong `src/domain/food/`. Chữ trên màn hình vẫn đi qua `t()`.
3. **Màn ghép cột.** Mỗi trường của app có một menu chọn cột trong file, đã điền sẵn theo phần đoán. Phải chọn rõ:
   - giá trị tính **theo 100 g hay theo khẩu phần** (theo khẩu phần thì cần thêm cột hoặc ô nhập số gram của khẩu phần);
   - năng lượng là **kcal hay kJ** (1 kcal = 4,184 kJ, 💡 hằng số chuẩn);
   - khoáng chất tính bằng **mg hay g**;
   - dấu thập phân là **phẩy hay chấm**. 💡 File từ Đức hoặc Việt Nam hay dùng phẩy và ngăn cột bằng `;`. Bộ đọc hiện
     tại chỉ tách cột theo `,` [Mã: src/data/food/foodCsv.ts], nên cần nhận thêm `;` và tab.
4. **Xem trước 5 dòng và báo cáo kiểm tra trước khi lưu.** Báo cáo gồm: dòng thiếu tên, thiếu kcal, số âm, và bất biến
   `carb ≥ đường + xơ`. App đã ép bất biến này ở mọi chỗ nhập dữ liệu [Mã: src/types/food.ts], nên đường nhập file cũng phải
   theo. Người dùng chọn "bỏ dòng lỗi" hoặc "huỷ".
5. **Lưu vào SQLite** (bảng mới, ví dụ `library_foods` + `library_sources`). Chỉ mục tìm kiếm dựng **một lần** sau khi nhập
   và khi mở app, giống `SEARCH_INDEX` của danh mục gốc [Mã: src/data/food/foodSearch.ts]. Không dựng lại mỗi lần gõ.
6. **Nhớ cách ghép cột** của nguồn đó. Lần sau người dùng tải bản mới của cùng file thì chỉ cần một chạm để nhập lại.

## Ba điểm dễ hỏng (phải tính từ đầu)
- **Mã món phải ổn định.** Nhật ký món ăn lưu `foodId` rồi tra lại món thật để hiện tên theo ngôn ngữ (quy tắc
  `foodDisplayName` trong AGENTS.md). Vì vậy mỗi món nhập vào nên có id dạng `lib_<nguồn>_<khoá>`. Khoá lấy từ **cột mã
  trong file** nếu có (USDA có `fdc_id`), không thì lấy từ tên đã chuẩn hoá. Nhập lại mà id giữ nguyên thì nhật ký cũ vẫn
  trỏ đúng. Xoá cả nguồn thì nhật ký cũ dùng tên đã chụp lại (`foodNameVi`), cơ chế này đã có [Mã: src/types/food.ts].
- **Thêm trường cho món thì phải sửa đủ các điểm nối.** Nếu thêm trường vào `FoodItem` (ví dụ `sourceId`), phải sửa cả
  `getAnyFoodById`, màn sửa dinh dưỡng, mapper, schema và migration. Bỏ sót một chỗ thì dữ liệu hỏng mà không báo lỗi
  (bài học đã gặp, ghi trong memory). 💡 Cách an toàn hơn: không thêm trường, dùng tiền tố id `lib_` để nhận biết, như
  `foodSourceKind` đang làm với `custom_` / `usda_` [Mã: src/domain/food/foodSource.ts].
- **Bản sao lưu.** "Món của tôi" đã có file sao lưu JSON có số phiên bản [Mã: src/domain/food/myFoodsBackup.ts]. 💡 Nguồn
  nhập từ file thì người dùng đã giữ file gốc. Nên bản sao lưu chỉ cần lưu **cách ghép cột và tên nguồn**, không cần chép
  lại cả bảng. Nếu muốn khôi phục đủ khi không còn file gốc thì có thể thêm một nút "xuất nguồn ra CSV" riêng.

## Giao diện (theo quy tắc giao diện gọn)
- 💡 Đây là tính năng cho người dùng nâng cao, nên **không đưa lên màn chính**. Đặt ở Cài đặt › Món ăn › "Nguồn của tôi"
  với nút ＋. Mỗi nguồn là một dòng: tên · số món · công tắc bật/tắt · ✎ (ghép lại cột) · ⓘ (ngày nhập, số dòng lỗi).
- Trong kết quả tìm kiếm có một nhãn nhỏ cho biết món thuộc nguồn nào, giống nhãn mine/catalog/usda hiện nay.

## Thứ tự làm (đề xuất)
| Đợt | Nội dung | Lý do |
|---|---|---|
| 0 | Lớp "Nguồn của tôi": bảng SQLite, tiền tố id, tìm kiếm hai mức (bộ nhớ / SQLite), `foodSourceKind` = `library` | Nền móng. Thiếu nó thì nhập nhiều dòng sẽ làm tìm kiếm chậm |
| 1 | Nhập **CSV** đọc từng phần [5] + màn ghép cột + xem trước + báo cáo lỗi + hỏi khi vượt 10 MB | Không thêm thư viện, không có rủi ro bảo mật của `xlsx` khi đọc [1], chạy được với file vài trăm MB |
| 2 | Nhớ cách ghép cột, nhập lại để cập nhật, bật/tắt và xoá nguồn | Phục vụ người dùng có dữ liệu lâu dài |
| 3 | Đọc **.xlsx** trực tiếp, sau khi đã giải quyết bản `xlsx` an toàn [1]. Hạn thấp hơn CSV vì phải nạp cả file [6] | Chủ app đã duyệt. Cần quyết định riêng về cách lấy thư viện đã vá |
| 4 | Mẫu ghép cột sẵn cho các định dạng phổ biến (ví dụ CSV của USDA FDC [2]) | Bớt việc ghép cột cho người mới |

## Bản 2: đã làm (Session 69, 2026-10-23)
- Đợt 0 + Đợt 1 xong code, `npm run verify` xanh. Chi tiết kỹ thuật: `docs/03-architecture.md` § "📚 Nguồn của tôi".
- **Khác với bản 1:** không chia hai mức tìm kiếm. Mọi nguồn, lớn hay nhỏ, đều tìm bằng truy vấn SQLite
  (`name_norm LIKE` cho từng chữ), rồi bộ chấm điểm của catalog xếp lại vài chục dòng trả về. 💡 Cách này đơn giản hơn và
  không phải giữ hàng chục nghìn món trong bộ nhớ. Đổi lại, món của nguồn không có gợi ý khi gõ sai cả chữ. Nếu chậm trên
  máy thật với file lớn thì mới xét FTS5 (❓ vẫn chưa kiểm tra có trên Expo Go không).
- Đọc CSV từng khúc 1 MB bằng `FileHandle.readBytes` [5]. Tự giải mã UTF-8 (không dùng `TextDecoder`) để không phụ thuộc
  việc JS engine có sẵn hàm đó hay không 💡.
- Phần xem trước ban đầu chỉ gọi `readBytes` một lần, và coi "nhận ít hơn 256 KB" là đã hết file. Tài liệu chỉ nói
  hàm trả ít byte hơn khi tới cuối file [5]. 💡 Nhưng để an toàn, code giờ đọc lặp đến khi đủ 256 KB hoặc một lần đọc
  trả về rỗng. Test dùng file giả trả từng 7 byte một.
- Chưa test máy thật.

## Bản 3: Đợt 2 + Đợt 3 (2026-10-23)
- **Thư viện Excel:** trang cài đặt của SheetJS khuyên bản **0.20.3**, cài bằng tarball
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Trang này gọi CDN là "nguồn chính thức", còn npm "đã cũ, bản mới
  nhất trên đó là 0.18.5" [7]. Lỗi ReDoS CVE-2024-22363 ảnh hưởng mọi bản dưới 0.20.2, và bản vá không có trên npm [8].
  App đã chuyển `xlsx` sang tarball 0.20.3 [Mã: package.json]. Phần xuất Excel cũ vẫn chạy, 43 test xuất vẫn xanh
  [Mã: src/services/export/__tests__]. Sau khi đổi, `npm audit` không còn báo `xlsx`.
- **Trên Expo:** bản demo React Native của SheetJS dùng 0.20.3 với `expo-file-system` + `expo-document-picker`, và chép
  file vào cache khi chọn (`copyToCacheDirectory: true`) để tránh lỗi "Unsupported scheme" [9]. App đã làm đúng như vậy
  [Mã: src/services/food/libraryImportService.ts]. Trang demo không nói gì về Hermes [9]. ❓ Vì vậy phải thử trên iPhone.
- **Giới hạn .xlsx = 30 MB.** SheetJS đọc trọn file vào bộ nhớ [6]. 💡 30 MB là con số đoán, cần đo trên máy thật. File
  lớn hơn thì app khuyên lưu sang CSV.
- **↻ Cập nhật nguồn:** cột được ghép lại theo tên. Bản mới được nhập vào một nguồn tạm, rồi thay nguồn cũ trong một
  transaction, nên huỷ giữa chừng không làm hỏng nguồn cũ. Món có cùng khoá giữ nguyên id, nên chỗ người dùng đã sửa
  (override) không mất [Mã: src/data/repositories/libraryFoodsRepository.ts].

## Đính chính
| Trước đây nói | Nguồn gốc nói | Nguồn |
|---|---|---|
| "Bản `xlsx` 0.18.5 có lỗi bảo mật khi đọc file" (dựa trên GitHub Advisory [1]) | Trang cài đặt SheetJS nói các cảnh báo prototype pollution của Snyk là **báo nhầm** do lỗi công cụ Snyk [7]. Nhưng GitHub Advisory vẫn ghi mọi bản < 0.19.3 (prototype pollution) và < 0.20.2 (ReDoS) là có lỗi [1][8]. | [1][7][8] |

💡 Hai nguồn mâu thuẫn nhau về chuyện có lỗi hay không, nhưng cả hai đều cho cùng một cách làm: dùng 0.20.3 từ CDN. Bản
đó mới hơn mọi bản vá mà GitHub Advisory nêu.

## Còn mở
- Đo trên iPhone thật: tìm kiếm với file CSV lớn (có cần FTS5 không), và mức trần 30 MB cho .xlsx.
- "⌨️ Nạp bằng chữ" (Session 70) tìm cả món trong nguồn.

## Nguồn
1. GitHub Advisory GHSA-4r6h-8v6p-xvw6 (CVE-2023-30533, SheetJS prototype pollution) — https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 (truy cập 2026-10-23)
2. USDA FoodData Central — API Guide (mục giấy phép, CC0) — https://fdc.nal.usda.gov/api-guide/ (truy cập 2026-10-23)
3. Expo SDK 58 — DocumentPicker — https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/ (truy cập 2026-10-23)
4. Open Food Facts — Data (giấy phép ODbL, định dạng tải về) — https://world.openfoodfacts.org/data (truy cập 2026-10-23)
5. Expo SDK 58 — FileSystem (`FileHandle.readBytes`, `offset`, `size`, `readableStream`) — https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/ (truy cập 2026-10-23)
6. SheetJS — Large Datasets / Streaming — https://docs.sheetjs.com/docs/demos/bigdata/stream/ (truy cập 2026-10-23)
7. SheetJS — Installation / NodeJS (bản 0.20.3, CDN là nguồn chính thức, npm đã cũ) — https://docs.sheetjs.com/docs/getting-started/installation/nodejs (truy cập 2026-10-23)
8. GitHub Advisory GHSA-5pgg-2g8v-p4x9 (CVE-2024-22363, SheetJS ReDoS, < 0.20.2) — https://github.com/advisories/GHSA-5pgg-2g8v-p4x9 (truy cập 2026-10-23)
9. SheetJS — React Native demo (Expo, expo-file-system, expo-document-picker) — https://docs.sheetjs.com/docs/demos/mobile/reactnative (truy cập 2026-10-23)

# Caffeine, nước tăng lực & TPCN tập luyện — số liệu, mốc cảnh báo và nhật ký

| Mục | Nội dung |
|---|---|
| Ngày | 2026-10-26 |
| Phạm vi | Monster Energy (bản gốc), Monster Ultra / Zero Ultra, cà phê G7 3in1 (Trung Nguyên), cà phê đen/espresso/cola/Red Bull; caffeine, taurine, L-carnitine, creatine; mốc an toàn và cảnh báo lâu dài |
| Nhánh khảo sát | `ui-upgrade` (sau commit `5a97b4f`) |
| Mục tiêu | Ghi được các hoạt chất người tập hay dùng vào "pin" của app, có mốc cảnh báo theo nguồn chính thức và nhật ký 7 ngày để thấy thói quen lâu dài |

## Chú giải

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* trong mục Tài liệu tham khảo |
| `[Mã: link-file]` | Rút ra từ code của dự án |
| 💡 | Nhận định/khuyến nghị của người viết, không phải trích dẫn |
| ❓ | Chưa kiểm chứng được |

Mọi nguồn được mở trong phiên ngày 2026-10-26.

## Tóm tắt

1. **Caffeine:** người lớn khoẻ mạnh tới **400 mg/ngày** và tới **200 mg mỗi lần** (≈3 mg/kg) không gây lo ngại an toàn; mang thai tới 200 mg/ngày [1]. Chỉ **100 mg gần giờ ngủ** đã có thể ảnh hưởng giấc ngủ [1]; caffeine uống **6 giờ trước khi ngủ** vẫn làm giảm giấc ngủ [6].
2. **Một lon Monster 355 ml ≈ 114 mg caffeine** (32 mg/100 ml in trên nhãn) [3]; Monster Ultra 30 mg/100 ml ≈ 107 mg/lon [4]. Mỗi lon còn ~0,4 % taurine (≈1,4 g) [2][3][4].
3. **G7 3in1 không công bố caffeine.** App ước tính ≈ **65 mg/gói 16 g** từ tỉ lệ 13 % cà phê hoà tan [8] × 3.142 mg/100 g của USDA [10] — 💡 suy luận, cần nhãn thật để xác nhận.
4. **Mốc khác:** taurine — EFSA đánh giá mức tiêu thụ cao ~3 g/ngày từ nước tăng lực là không đáng lo [5]; L-carnitine — mức an toàn quan sát 2 g/ngày [11]; creatine — duy trì 3–5 g/ngày, nạp ~20 g/ngày 5–7 ngày [12].
5. **Đã làm trong app:** 4 hoạt chất là trường dữ liệu của món, 7 sản phẩm mới, dòng ☕ trên Home với cảnh báo theo ngày + thói quen 7 ngày, tự tính lại từ nhật ký món ăn (không thêm bảng mới) [Mã: [substanceEngine.ts](../../src/domain/nutrition/substanceEngine.ts)].

## Đính chính

| Trước đây nói | Nguồn gốc nói | Nguồn |
|---|---|---|
| Kết quả tìm kiếm ban đầu gợi ý Monster Zero Ultra Mỹ có 140 mg/lon 16 oz | Các nhà bán Mỹ ghi lệch nhau (105 / 150 mg); app dùng nhãn EU 30 mg/100 ml | [4] |
| Một trang bán hàng ghi G7 "sugar free" | Nhãn liệt kê đường 46,94 % là thành phần đầu tiên | [8] |
| Trang bán lẻ Anh ghi G7 "8 g đường/khẩu phần" | Cùng trang ghi 75,08 g/100 g (= 12 g/gói 16 g) — tự mâu thuẫn; app dùng số /100 g | [9] |
| Bản tóm tắt EFSA ghi 100 mg ≈ 1,4 mg/kg; một số bài báo ghi 1,5 mg/kg | Khác do giả định cân nặng; app chỉ dùng mốc 100 mg | [1] |

## 1. Hiện trạng trong code (trước khi làm)

- Đã có nhóm món `supplement` (dầu cá, whey…) và nút ghi nhanh [Mã: [SupplementQuickLog.tsx](../../src/components/SupplementQuickLog.tsx)].
- Đã có cảnh báo vượt ngưỡng vi chất (sắt, canxi, natri…) [Mã: [upperLimits.ts](../../src/lib/upperLimits.ts)], nhưng **không có caffeine** hay hoạt chất nào.
- Red Bull có trong danh mục, caffeine chỉ nằm trong ghi chú chữ, không được tính [Mã: `food_items.csv`].
- Nhật ký món ăn giữ theo lựa chọn lưu trữ của người dùng, nên **nhật ký món chính là nhật ký hoạt chất** — không cần bảng mới [Mã: [constants.ts](../../src/lib/constants.ts) `DATA_RETENTION_DAYS`].

## 2. Số liệu sản phẩm

Đơn vị: trên 100 ml (≈100 g). "Mỗi phần" = khẩu phần mặc định trong app.

| Sản phẩm | kcal | Đường | Caffeine | Taurine | L-carnitine | Mỗi phần | Nguồn |
|---|---|---|---|---|---|---|---|
| Monster Energy (bản gốc) | 47 | 11 g | 32 mg | 400 mg (0,4 %) | ≈27 mg 💡 | lon 355 ml: 167 kcal, 39 g đường, ≈114 mg caffeine | [2][3] |
| Monster Ultra / Zero Ultra | 2 | 0 g | 30 mg | 400 mg (0,4 %) | ≈10 mg 💡 | lon 355 ml: 8 kcal, ≈107 mg caffeine | [4] |
| G7 3in1 (gói 16 g) | 443 /100 g | 75,08 g /100 g | ≈408 mg/100 g 💡 | — | — | gói 16 g: ≈71 kcal, ≈12 g đường, ≈65 mg caffeine 💡 | [8][9][10] |
| Cà phê hoà tan đen (bột) | 353 /100 g | 0 | 3.142 mg/100 g | — | — | gói 2 g ≈ 63 mg | [10] |
| Cà phê đen pha (USDA) | 1 | 0 | 40 mg | — | — | tách 240 ml ≈ 96 mg | [10] |
| Espresso (USDA) | 9 | 0 | 212 mg | — | — | shot 30 ml ≈ 64 mg | [10] |
| Cola (USDA) | — | — | 9 mg | — | — | lon 330 ml ≈ 30 mg | [10] |
| Cola zero / diet (USDA) | — | — | 12 mg | — | — | lon 330 ml ≈ 40 mg | [10] |
| Red Bull | — | — | 80 mg/lon 250 ml (= 32 mg/100 ml) | ❓ không công bố số mg | — | | [13] |

Ghi chú cách tính:
- Nhãn Monster in **"High caffeine content… (32mg/100ml)"** và thành phần theo phần trăm: taurine 0,4 %, L-carnitine L-tartrate 0,04 % [3]. Taurine 0,4 % ≈ 400 mg/100 ml là 💡 suy luận (coi % theo khối lượng, 1 ml ≈ 1 g).
- L-carnitine L-tartrate chứa khoảng 68 % L-carnitine (tính từ khối lượng phân tử) → 40 mg × 0,68 ≈ 27 mg/100 ml — 💡 suy luận.
- G7: nhà bán Ireland ghi cà phê hoà tan 13 % và đường 46,94 % [8]; một nhãn khác (Úc) ghi cà phê 18 % (qua kết quả tìm kiếm) ❓. App chọn 13 %, nên số caffeine có thể **thấp hơn thực tế** tới ~40 % nếu gói bạn mua là công thức 18 % 💡. Hai nguồn bán lẻ đều không phải Trung Nguyên — ❓ cần đối chiếu bao bì bán ở Việt Nam.
- Monster bán ở Việt Nam: chưa tìm được nhãn tiếng Việt chính thức ❓. App dùng nhãn EU; nếu lon của bạn ghi khác, sửa bằng ✎ (giá trị sửa được ưu tiên ở mọi nơi).
- Cappuccino trong app: ước tính 1 shot 30 ml espresso trong ly 180 ml ≈ 35 mg/100 ml 💡.

## 3. Mốc cảnh báo app dùng

| Cảnh báo | Mốc | Nguồn |
|---|---|---|
| ⚠ Caffeine trong ngày | > 400 mg | [1][7] |
| ⚠ Một lần | > 200 mg trong bất kỳ 60 phút nào | 200 mg: [1]; gộp 60 phút: 💡 quy ước của app (2 lon uống liền = 1 lần) |
| 🌙 Sát giờ ngủ | ≥ 100 mg trong 6 giờ trước giờ ngủ bạn đặt (mặc định 23:00) | 100 mg: [1]; 6 giờ: [6] |
| Taurine | > 3 g/ngày | EFSA/SCF dùng 3 lon × 250 ml × 4.000 mg/L làm mức tiêu thụ cao cấp tính và kết luận không đáng lo [5]; vượt = vượt mức đã được đánh giá, không phải "độc" 💡 |
| L-carnitine | > 2 g/ngày | Mức an toàn quan sát (OSL) cho dùng lâu dài [11] |
| Creatine | > 20 g/ngày | Liều nạp ISSN 4 × 5 g [12]; ISSN còn ghi tới 30 g/ngày trong 5 năm vẫn an toàn [12] → đây là mốc "vượt thói quen thường dùng", không phải mốc an toàn 💡 |
| Thói quen | ≥ 3/7 ngày vượt 400 mg, hoặc ≥ 3/7 ngày 🌙 | 💡 ngưỡng của app |

Thông tin thêm hiển thị trong ⓘ:
- Thời gian bán thải caffeine ở người lớn trung bình ~4 giờ, dao động 2–8 giờ [1].
- Lâu dài: dùng caffeine quá nhiều liên quan đến vấn đề tim mạch; ngắn hạn gây gián đoạn giấc ngủ, lo âu, thay đổi hành vi [1]. Dấu hiệu quá liều: tim nhanh, hồi hộp, tăng huyết áp, mất ngủ, bồn chồn, khó chịu dạ dày, buồn nôn, đau đầu [7]. Khoảng 1.200 mg uống nhanh có thể gây co giật [7].
- Tập luyện: 3–6 mg/kg cải thiện thành tích, thường uống 60 phút trước tập; ~9 mg/kg gây nhiều tác dụng phụ [14]. App tự đổi ra mg theo cân nặng trong hồ sơ.
- EFSA: các thành phần khác của nước tăng lực ở nồng độ thường gặp không làm thay đổi độ an toàn của liều 200 mg [1].
- Creatine: tác dụng phụ hay gặp nhất là tăng cân (giữ nước); không có bằng chứng thuyết phục gây hại thận ở người khoẻ [12].
- Trẻ em và thanh thiếu niên: EFSA đề xuất 3 mg/kg/ngày [1]; FDA ghi giới chuyên môn khuyên không cho trẻ em và thanh thiếu niên dùng nước tăng lực [7]. App không có trường tuổi < 18 nên chỉ nhắc trong lời miễn trừ 💡.

## 4. Đã triển khai

| Phần | File |
|---|---|
| 4 trường `caffeineMg/taurineMg/carnitineMg/creatineMg` (mg/100 g, để trống = không khai báo) | [types/food.ts](../../src/types/food.ts), `food_items.csv` (4 cột mới), [foodCsv.ts](../../src/data/food/foodCsv.ts), mapper/repository món tự tạo + món đã sửa, [schema.ts](../../src/data/db/schema.ts) (cột + migration), [myFoodsBackup.ts](../../src/domain/food/myFoodsBackup.ts) |
| Form tự tạo/sửa món: mục "Hoạt chất" (creatine nhập g) | [customFoodInput.ts](../../src/domain/food/customFoodInput.ts), [CustomFoodFields.tsx](../../src/components/food/CustomFoodFields.tsx) |
| Bảng dinh dưỡng của món đã ghi hiện caffeine… | [nutritionDetail.ts](../../src/domain/food/nutritionDetail.ts) |
| Mốc + bộ máy thuần, có test | [substanceLimits.ts](../../src/lib/substanceLimits.ts), [substanceEngine.ts](../../src/domain/nutrition/substanceEngine.ts) |
| Nhật ký 7 ngày | [useSubstanceJournal.ts](../../src/hooks/useSubstanceJournal.ts) |
| Dòng ☕ trên Home: thanh caffeine/400 mg, chip cảnh báo, 3 ô taurine/carnitine/creatine, dải 7 ngày (chạm để xem nhật ký ngày đó), ghi nhanh đồ uống có caffeine, giờ đi ngủ −/＋ | [SubstancePanel.tsx](../../src/components/SubstancePanel.tsx), [HomeScreen.tsx](../../src/screens/HomeScreen.tsx) |
| Đủ 3 ngôn ngữ vi/en/de | `src/i18n/locales/*.ts` (`substances`, `components.substancePanel`) |

Creatine và L-carnitine thuộc nhóm `supplement` nên tự hiện trong nút ghi nhanh TPCN có sẵn. Whey đã có từ trước.

## 5. Quyết định cần chủ dự án chốt

1. **Mốc mang thai / dưới 18 tuổi:** app chưa có trường này trong hồ sơ. 💡 Khuyến nghị: thêm một công tắc "Đang mang thai/cho con bú" để đổi mốc 400 → 200 mg [1], chỉ khi bạn thấy cần.
2. **Mốc mỗi lần theo cân nặng** (3 mg/kg thay vì 200 mg cố định) [1]: 💡 giữ 200 mg cố định cho đơn giản; với 78 kg, 3 mg/kg = 234 mg nên mốc cố định thận trọng hơn.
3. **Nhật ký dài hơn 7 ngày** (ví dụ 30 ngày hoặc lưu tổng caffeine/ngày vào Kho "Thói quen ăn" để còn sau khi dọn dữ liệu): 💡 nên làm ở bước sau nếu bạn dùng tính năng thường xuyên.
4. **Nhãn Việt Nam:** nếu bạn chụp nhãn lon Monster và gói G7 mua ở Việt Nam, có thể thay số ước tính bằng số in trên nhãn.

## Tài liệu tham khảo

**EFSA (Cơ quan An toàn Thực phẩm châu Âu)**
- [1] EFSA explains risk assessment: Caffeine (2015) — https://www.efsa.europa.eu/sites/default/files/corporate_publications/files/efsaexplainscaffeine150527.pdf — Dùng cho: 400 mg/ngày, 200 mg/lần (≈3 mg/kg), mang thai 200 mg, 100 mg gần giờ ngủ, trẻ em 3 mg/kg, bán thải ~4 h, rủi ro lâu dài, thành phần nước tăng lực. Truy cập 2026-10-26. (Bản khoa học đầy đủ: https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2015.4102 — trang trả lỗi 403 khi mở, không đọc được trực tiếp.)
- [5] EFSA ANS Panel, *The use of taurine and D-glucurono-γ-lactone as constituents of the so-called "energy" drinks*, EFSA Journal (2009) 935 — https://focalpointbg.com/images/stories/efsa/contents/pdfdocs/ans_ej935_Taurine%20and%20D-glucuronolactone_op_en.pdf — Dùng cho: 4.000 mg/L, 3 lon/ngày, NOAEL 1.000 mg/kg, kết luận không đáng lo. Truy cập 2026-10-26 (bản sao PDF do bên thứ ba lưu).

**Monster Energy (nhãn sản phẩm)**
- [2] One Stop — Monster Energy Drink 500ml (EAN 5060166690007) — https://www.onestop.co.uk/wp-content/uploads/Monster-Energy-Drink-500ml-368651.pdf — Dùng cho: thành phần %, dinh dưỡng /100 ml. Truy cập 2026-10-26.
- [3] Monster Energy — Product Information Form (GB) — https://a.storyblok.com/f/43212/x/ea60a57828/monster-energy-gb.pdf — Dùng cho: cảnh báo 32 mg/100 ml, dinh dưỡng theo lon 355/440/500 ml. Truy cập 2026-10-26.
- [4] Monster Energy Ultra White — scheda prodotto (Italia, 2018) — https://cdn.winelivery.com/public/products/nutritional-values/monster-energy-zero-ultra-35-cl-monster-beverage.pdf — Dùng cho: 30 mg/100 ml, taurine 0,4 %, L-carnitine L-tartrate 0,015 %, 8 kcal/lon 355 ml. Truy cập 2026-10-26. Thêm: One Stop — Monster Ultra 500ml — https://www.onestop.co.uk/wp-content/uploads/Monster-Ultra-Energy-Drink-500ml-388160.pdf (cùng tỉ lệ thành phần).

**Cà phê G7 (nguồn phụ — nhà bán lẻ)**
- [8] Asia Market (Ireland) — Trung Nguyên G7 3in1 16g × 20 — https://www.asiamarket.ie/trung-hguyen-g7-instant-3in1-coffee-16g-x-20-320g.html — Dùng cho: thành phần (đường 46,94 %, cà phê hoà tan 13 %), dinh dưỡng /100 g. Truy cập 2026-10-26.
- [9] TukTuk Mart (UK) — Trung Nguyen G7 3in1 22×16g — https://tuktukmart.co.uk/products/trung-nguyen-g7-3in1-vietnamese-instant-coffee-22x16g — Dùng cho: đường 75,08 g/100 g, muối 0,67 g. Truy cập 2026-10-26.

**USDA FoodData Central (qua API chính thức)**
- [10] USDA FDC — 171893 (instant coffee powder, 3.142 mg), 2710480 (instant coffee, not reconstituted — dinh dưỡng đầy đủ), 171890 (brewed coffee, 40 mg), 171891 (espresso, 212 mg), 174852 (cola, 9 mg), 175099 (diet cola có caffeine, 12 mg) — https://api.nal.usda.gov/fdc/v1/food/171893 (thay số id cho các mục khác; trang xem: https://fdc.nal.usda.gov/food-details/171893/nutrients) — Truy cập 2026-10-26.

**FDA (Mỹ)**
- [7] FDA — Spilling the Beans: How Much Caffeine is Too Much? (cập nhật 08/28/2024) — https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much — Dùng cho: 400 mg/ngày, dấu hiệu quá liều, 1.200 mg gây co giật, trẻ em/thanh thiếu niên. Truy cập 2026-10-26.

**Nghiên cứu khoa học (PubMed)**
- [6] Drake C. et al., *Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed*, J Clin Sleep Med 2013;9(11):1195–200 — https://pubmed.ncbi.nlm.nih.gov/24235903/ — Dùng cho: khoảng 6 giờ trước khi ngủ. Truy cập 2026-10-26.
- [11] Hathcock JN, Shao A., *Risk assessment for carnitine*, Regul Toxicol Pharmacol 2006;46(1):23–8 — https://pubmed.ncbi.nlm.nih.gov/16901595/ — Dùng cho: OSL 2.000 mg/ngày. Truy cập 2026-10-26.
- [12] Kreider RB et al., *ISSN position stand: safety and efficacy of creatine supplementation*, JISSN 2017;14:18 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/ — Dùng cho: nạp 4 × 5 g trong 5–7 ngày, duy trì 3–5 g, tới 30 g/ngày 5 năm, tăng cân/giữ nước, thận. Truy cập 2026-10-26.
- [14] Guest NS et al., *ISSN position stand: caffeine and exercise performance*, JISSN 2021;18:1 — https://pubmed.ncbi.nlm.nih.gov/33388079/ — Dùng cho: 3–6 mg/kg, 60 phút trước tập, ~9 mg/kg nhiều tác dụng phụ. Truy cập 2026-10-26.

**Red Bull**
- [13] Red Bull — Energy Drink ingredients — https://www.redbull.com/int-en/energydrink/red-bull-energy-drink-ingredients-list — Dùng cho: 80 mg caffeine/lon 250 ml. Truy cập 2026-10-26.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-26 | 1 | Bản đầu: số liệu sản phẩm, mốc cảnh báo, phần đã triển khai |

# Ghi ít hơn, trang theo phong cách riêng, "lười mà vẫn thích"

| | |
|---|---|
| Ngày | 20/10/2026 |
| Phạm vi | Hướng nghiên cứu, chưa sửa code: (1) bớt nhập lặp lại mỗi ngày (cân nặng, giấc ngủ…); (2) người dùng tự sắp trang theo cách dùng của họ (tập trước hay ăn trước); (3) app dễ chịu với người lười, không ép ghi đều đặn |
| Nhánh / commit | `ui-upgrade`, `4ef9d89` |
| Mục tiêu | Chọn hướng đi có cơ sở trước khi làm tính năng, chia theo cái làm được ngay trong Expo Go và cái cần bản dev-client |

**Cách đọc trích dẫn** (nguồn truy cập 20/10/2026):

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* ở cuối bài |
| `[Mã: file]` | Rút ra từ code của dự án |
| `[Nội bộ: file]` | Rút ra từ tài liệu nội bộ |
| 💡 | Nhận định/khuyến nghị của người viết |
| ❓ | Chưa kiểm chứng được |

## Tóm tắt
1. **Ghi tay hiệu quả nhưng nặng.** Hướng được nghiên cứu ủng hộ là "bán tự động": máy lo phần đo được, người chỉ chạm phần máy không đo được [1]. Mức "nặng" chấp nhận được tuỳ động lực của từng người [1].
2. **Bỏ ghi là chuyện bình thường, không phải thất bại.** Người dùng bỏ ghi vì quên, vì phiền, vì cố ý bỏ qua, hoặc tạm dừng [2]. Lý do bỏ app hay gặp là tốn công (25%) và tốn thời gian (16%) [3]. 💡 App nên được thiết kế cho việc "quay lại sau vài ngày", không chỉ cho việc "ghi đủ mỗi ngày".
3. **Cho người dùng tự sắp, máy chỉ gợi ý.** Trong thí nghiệm, đa số người thích menu tự tuỳ chỉnh hơn menu tự thay đổi theo máy [4]. App đã có đúng kiểu này: máy chỉ *gợi ý* đổi cách xem, người dùng bấm mới đổi [Mã: [detailViewHabit.ts](../../src/domain/habits/detailViewHabit.ts)].
4. **Chuỗi ngày (streak) là con dao hai lưỡi.** Chuỗi bị đứt làm người ta bỏ cuộc nhiều hơn. Tác hại giảm khi người dùng được "sửa" chuỗi, và tăng khi họ tự trách mình [6]. 💡 Không dùng streak theo ngày; nếu cần, đếm theo tuần và cho phép bù.
5. **Đọc giấc ngủ, cân nặng tự động từ Apple Health / Health Connect là được** [12][13][14][15], nhưng cần bản dev-client, không chạy trong Expo Go [Nội bộ: [AGENTS.md](../../AGENTS.md)]. Việc làm được ngay trong Expo Go là "mang số cũ sang" và "xác nhận một chạm".

## Đính chính
Không có điều nào mâu thuẫn với báo cáo trước. Báo cáo này nối tiếp [Ghi vận động gọn & điền sẵn](2026-09-26-ghi-van-dong-gon-va-dien-san.md), nơi đã dùng nghiên cứu về thói quen (lỡ một ngày không làm hỏng thói quen).

## 1. Hiện trạng trong code
| Mục | Hiện nay | Bằng chứng |
|---|---|---|
| Giấc ngủ | Nhập tay mỗi ngày qua form sạc. Không ghi thì tổng = 0 giờ, và chip gợi ý báo "thiếu ngủ". | [Mã: [dailyBatteryTotals.ts](../../src/domain/battery/dailyBatteryTotals.ts)], [Mã: [homeKeywords.ts](../../src/domain/battery/homeKeywords.ts)] |
| Cân nặng | Nhập tay trong thẻ cân nặng. Công thức kcal dùng cân nặng của hồ sơ. | [Mã: [WeightLogCard.tsx](../../src/components/WeightLogCard.tsx)], [Mã: [energyStore.ts](../../src/store/energyStore.ts)] |
| Apple Health | Chỉ đọc năng lượng tiêu hao (active + nghỉ). Chưa đọc giấc ngủ, cân nặng. Tự tắt khi chạy trong Expo Go. | [Mã: [appleHealthSync.ts](../../src/services/health/appleHealthSync.ts)] |
| Đã có sẵn để tái dùng | Gợi ý món theo bữa, "lặp lại bữa hôm qua" một chạm; điền sẵn vận động theo thói quen giờ trong ngày. | [Mã: [foodSuggestions.ts](../../src/domain/food/foodSuggestions.ts)], [Mã: [activityHabit.ts](../../src/domain/energy/activityHabit.ts)] |
| Bố cục | 5 tab có thứ tự cố định. Các hàng "Chi tiết hôm nay" ở Home có thứ tự viết cứng. | [Mã: [mainTabs.ts](../../src/navigation/mainTabs.ts)], [Mã: [HomeScreen.tsx](../../src/screens/HomeScreen.tsx)] |

💡 Điểm cần sửa trước tiên: "không ghi" đang bị hiểu là "0 giờ ngủ". Người lười bị app báo thiếu ngủ dù thật ra họ ngủ đủ.

## 2. Hướng A — Ghi ít hơn: bậc thang tự động
Ý chính: dữ liệu ít thay đổi (cân nặng) hoặc lặp lại theo nếp (giờ ngủ) thì máy đoán trước, người chỉ xác nhận.

| Bậc | Cách làm | Cơ sở | Chạy được trong Expo Go? |
|---|---|---|---|
| A1. Mang số cũ sang | Cân nặng: dùng số gần nhất cho tới khi có số mới, ghi rõ "từ 3 ngày trước". Không cần cân mỗi ngày. | 💡 | Có |
| A2. Đoán theo nếp, chạm một lần | Giấc ngủ: sáng mở app thấy "Đêm qua ~23:30 → 6:45? ✓". Đoán từ các đêm trước, giống cách đã làm với vận động. | Cách làm sẵn có [Mã: [activityHabit.ts](../../src/domain/energy/activityHabit.ts)]; hành vi lặp lại trong cùng bối cảnh dần thành thói quen [Nội bộ: [báo cáo 26/09](2026-09-26-ghi-van-dong-gon-va-dien-san.md)] | Có |
| A3. Chỉ hỏi cái cần | Ghi đúng thông tin cần, bỏ chi tiết. Ví dụ SleepTight chỉ ghi "loại + giờ", không hỏi lượng caffeine, và vẫn đạt tỉ lệ ghi cao trong 4 tuần [1]. 40% người bỏ qua món quá khó nhập [3]. | [1][3] | Có |
| A4. Ghi từ ngoài app | Thông báo có nút ("Ngủ như thường lệ ✓"). Expo cho phép thông báo có nút và ô nhập chữ [10]. Thông báo cục bộ vẫn chạy trong Expo Go [10]. | [10]; trong Expo Go, nút trên thông báo có hoạt động không: ❓ cần thử trên máy | ❓ |
| A5. Widget màn hình khoá/chính | Chạm một biểu tượng để ghi, máy tự lấy giờ, như SleepTight [1]. `expo-widgets` làm được widget iOS có nút bấm (cần iOS 17+) [9]. | [1][9] | **Không**, cần dev-client [9]; chỉ có iOS [9] |
| A6. Đọc tự động | Thư viện đang dùng đã có sẵn hàm cho cả hai [11]. Giấc ngủ: `getSleepSamples` (trả về INBED/ASLEEP/DEEP/CORE/REM) [12]. Cân nặng: `getLatestWeight` [13]. Android: Health Connect có `SleepSessionRecord` và `WeightRecord` [15]. Nên lưu múi giờ kèm mẫu giấc ngủ [14]. | [12][13][14][15] | **Không**, cần dev-client; `react-native-health` chưa được kiểm trên New Architecture [Nội bộ: [AGENTS.md](../../AGENTS.md)] |

💡 Nguyên tắc chung: số đọc tự động hoặc đoán sẵn luôn **hiện là "đoán"** cho tới khi người dùng chạm ✓ hoặc sửa. Sửa tay luôn thắng, giống quy tắc điền sẵn vận động.

## 3. Hướng B — Trang theo phong cách của từng người
| Ý | Cơ sở |
|---|---|
| Người dùng tự sắp thì nhanh và được thích hơn máy tự đổi. Trong thí nghiệm 27 người, menu do máy tự đổi chậm hơn hẳn menu cố định, và đa số người thích menu tự tuỳ chỉnh [4]. | [4] |
| Máy tự cá nhân hoá chỉ hợp khi nhu cầu đơn giản và ít thay đổi [5]. | [5] |
| Nghiên cứu nhật ký ăn uống khuyên làm nhiều kiểu nhật ký cho nhiều mục tiêu, thay vì một công cụ ôm hết [3]. | [3] (qua tin bài của UW, xem [3]) |

**Đề xuất cụ thể 💡:**
1. **Chọn kiểu ngày** khi bắt đầu (sửa lại được trong Cài đặt): "Tập trước" / "Ăn trước" / "Chỉ theo dõi nhẹ". Mỗi kiểu là một thứ tự sẵn cho các hàng ở Home và tab mở đầu.
2. **Giữ để sắp xếp** các hàng "Chi tiết hôm nay" (✎ ở đầu mục, kéo để đổi chỗ, ẩn hàng không dùng). Lưu trong `settingsStore` giống `ringMetrics`.
3. **Máy chỉ gợi ý**: thấy người dùng hay mở Sổ tập trước bữa ăn thì gợi ý "Đưa Tập lên đầu?". Không tự đổi chỗ. Dùng đúng khuôn của [detailViewHabit.ts](../../src/domain/habits/detailViewHabit.ts).
4. Tuân theo quy tắc giao diện gọn: một hàng mở, ✎ để sửa [Nội bộ: [mobile-ui-density.md](../../.ai/skills/mobile-ui-density.md)].

## 4. Hướng C — "Lười mà vẫn thích", không ép đều đặn
| Ý | Cơ sở |
|---|---|
| Hành vi xảy ra khi có đủ Động lực, Khả năng và Lời nhắc cùng lúc (B=MAP) [8]. 💡 Với app này, tăng "khả năng" (bớt thao tác) dễ hơn tăng động lực. | [8] |
| Bỏ ghi có 4 kiểu: quên, phiền vì phải duy trì, cố ý bỏ qua, tạm dừng [2]. Nhiều người bỏ ghi vì "đã biết rồi, ghi làm gì" [2]. | [2] |
| Khi quay lại sau thời gian dài, xem lại lịch sử thất bại có thể làm nản [2]. | [2] |
| 13% người cố ý không ghi món "không lành mạnh" [3]. 💡 Cảm giác bị phán xét làm hỏng dữ liệu. | [3] |
| Chuỗi đứt làm giảm việc quay lại, nhất là khi người dùng tự trách mình. Cho "sửa" chuỗi thì tác hại giảm [6]. | [6] |
| Người ta dễ bắt đầu lại sau các "mốc thời gian": đầu tuần, đầu tháng, sinh nhật, ngày lễ… [7]. | [7] |
| Người động lực cao (vd. vận động viên) chịu được ghi chi tiết; người chỉ tò mò cần tự động nhiều hơn [1]. | [1] |

**Đề xuất cụ thể 💡:**
1. **"Chưa ghi" khác "0"**: pin không có dữ liệu hiện ô xám "—", không báo thiếu, không trừ điểm.
2. **Không có streak theo ngày.** Nếu muốn khích lệ, dùng "4/7 ngày tuần này" và cho bù.
3. **Màn quay lại thân thiện**: sau ≥ 3 ngày vắng, chào "Chào mừng trở lại" và hỏi nhanh 1 câu (vd. "Cân nặng vẫn ~78 kg?"). Không hiện danh sách ngày bị bỏ.
4. **Bắt đầu lại theo mốc**: đầu tuần hoặc đầu block mới (BxWy), gợi ý nhẹ "Tuần mới, bắt đầu lại?".
5. **Hai mức ghi**: "Nhanh" (ước lượng, một chạm) và "Chi tiết" (gram, set, rep). Người dùng chọn mặc định, đổi được lúc nào cũng được.

## 5. Lộ trình gợi ý 💡
| Đợt | Nội dung | Cần dev-client? | Công sức 💡 |
|---|---|---|---|
| 1 | "Chưa ghi" ≠ 0; mang cân nặng cũ sang; giấc ngủ đoán theo nếp + ✓ một chạm | Không | Nhỏ |
| 2 | Chọn kiểu ngày + sắp xếp/ẩn hàng ở Home; gợi ý đổi chỗ theo thói quen | Không | Vừa |
| 3 | Màn quay lại; đếm theo tuần; gợi ý bắt đầu lại theo mốc | Không | Nhỏ–vừa |
| 4 | Thông báo có nút "✓ như thường lệ" (thử trước trong Expo Go) | ❓ | Nhỏ |
| 5 | Dev-client: Apple Health đọc giấc ngủ/cân nặng; widget iOS; Health Connect cho Android | Có | Lớn |

Mọi đợt có giao diện đều phải theo quy tắc đa ngôn ngữ vi/en/de và giao diện gọn [Nội bộ: [AGENTS.md](../../AGENTS.md)]. Dữ liệu và việc học thói quen chỉ nằm trên máy, đúng mục tiêu riêng tư của app 💡.

**Đo hiệu quả (trên máy, không gửi đi) 💡:** số chạm để ghi một mục; tỉ lệ số đoán được chấp nhận không cần sửa; tỉ lệ người quay lại sau ≥ 3 ngày vắng.

## 6. Quyết định cần chủ dự án chốt
| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Ngày không ghi giấc ngủ: hiện "—" hay vẫn tính 0? | Hiện "—", không báo thiếu |
| Số đoán sẵn: tự lưu hay chờ ✓? | Chờ ✓ (hoặc tự lưu, ghi nhãn "đoán", sửa được) |
| Có streak không? | Không theo ngày; nếu có thì theo tuần, có bù |
| Kiểu ngày: hỏi lúc mới cài hay để trong Cài đặt? | Cả hai: hỏi 1 câu lúc mới cài, sửa được sau |
| Khi nào làm bản dev-client cho Apple Health/widget? | Sau Đợt 1–3, khi các đợt Expo Go đã ổn |

## Tài liệu tham khảo
**Nghiên cứu về ghi chép cá nhân**
- [1] E. K. Choe, S. Abdullah, M. Rabbi, E. Thomaz, D. A. Epstein và cộng sự, *Semi-Automated Tracking: A Balanced Approach for Self-Monitoring Applications*, IEEE Pervasive Computing 16(1), 2017. https://users.ece.utexas.edu/~ethomaz/papers/j1.pdf — Dùng cho: định nghĩa bán tự động; 3 yếu tố thiết kế; động lực cao/thấp; SleepTight ghi bằng widget màn hình khoá, chỉ ghi loại + giờ, tỉ lệ ghi cao trong 4 tuần. Truy cập 20/10/2026.
- [2] D. A. Epstein, A. Ping, J. Fogarty, S. A. Munson, *A Lived Informatics Model of Personal Informatics*, UbiComp 2015. https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf — Dùng cho: 4 kiểu bỏ ghi; bỏ ghi vì đã biết số; xem lịch sử khi quay lại có thể làm nản. Truy cập 20/10/2026.
- [3] F. Cordeiro, E. Bales, E. Cherry, J. Fogarty, *Rethinking the Mobile Food Journal: Exploring Opportunities for Lightweight Photo-Based Capture*, CHI 2015. https://homes.cs.washington.edu/~jfogarty/publications/chi2015-decaf.pdf — Dùng cho: lý do ngừng ghi (25% tốn công, 16% tốn thời gian…); 54% quên, 40% bỏ món khó nhập, 13% cố ý không ghi món không lành mạnh. Ý "nhiều kiểu nhật ký cho nhiều mục tiêu" lấy từ tin bài UW về bài *Barriers and Negative Nudges* (CHI 2015): https://news.cs.washington.edu/2015/04/16/barriers-and-negative-nudges-uw-cse-research-team-led-by-james-fogarty-co-authors-new-study-of-mobile-food-journaling/ (**qua kết quả tìm kiếm**). Truy cập 20/10/2026.

**Giao diện tuỳ chỉnh**
- [4] L. Findlater, J. McGrenere, *A Comparison of Static, Adaptive, and Adaptable Menus*, CHI 2004. https://www.cs.ubc.ca/labs/edapt/papers/findlater2004.pdf — Dùng cho: 27 người; menu do máy tự đổi chậm hơn menu cố định; đa số thích menu tự tuỳ chỉnh. Truy cập 20/10/2026.
- [5] J. Nielsen, *Personalization is Over-Rated*, Nielsen Norman Group, 03/10/1998. https://www.nngroup.com/articles/personalization-is-over-rated/ — Dùng cho: tuỳ chỉnh do người dùng điều khiển, cá nhân hoá do máy; cá nhân hoá chỉ hợp khi nhu cầu đơn giản, ít thay đổi. Truy cập 20/10/2026.

**Động lực, chuỗi ngày, bắt đầu lại**
- [6] J. Silverman, A. Barasch, *On or Off Track: How (Broken) Streaks Affect Consumer Decisions*, Journal of Consumer Research 49(6), 2023 (bản thảo đã duyệt). https://udspace.udel.edu/bitstreams/7e3e3b64-8bf2-4527-ac93-94a160358165/download — DOI: https://doi.org/10.1093/jcr/ucac029 — Dùng cho: chuỗi đứt giảm việc quay lại; mạnh hơn khi tự trách; giảm khi được sửa chuỗi. Truy cập 20/10/2026.
- [7] H. Dai, K. L. Milkman, J. Riis, *The Fresh Start Effect: Temporal Landmarks Motivate Aspirational Behavior*, Management Science, 2014. https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf — Dùng cho: tìm "diet", đi gym, cam kết mục tiêu tăng sau mốc thời gian (đầu tuần/tháng/năm, sinh nhật, ngày lễ). Truy cập 20/10/2026.
- [8] B. J. Fogg, *Fogg Behavior Model*. https://behaviormodel.org/ — Dùng cho: hành vi xảy ra khi Động lực, Khả năng, Lời nhắc cùng có mặt. Truy cập 20/10/2026.

**Expo (SDK 57)**
- [9] Expo, *Widgets (expo-widgets)*, SDK v57. https://docs.expo.dev/versions/v57.0.0/sdk/widgets/ — Dùng cho: chỉ iOS; không có trong Expo Go; widget có nút bấm cần iOS 17+. Truy cập 20/10/2026.
- [10] Expo, *Notifications*, SDK v57. https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ — Dùng cho: notification category có nút và ô nhập chữ (`setNotificationCategoryAsync`, `textInput`); thông báo cục bộ vẫn chạy trong Expo Go. Truy cập 20/10/2026.

**Apple Health / Health Connect**
- [11] agencyenterprise, *react-native-health* (README). https://github.com/agencyenterprise/react-native-health — Dùng cho: danh sách hàm có `getSleepSamples`, `getLatestWeight`, `getWeightSamples`. Truy cập 20/10/2026.
- [12] *getSleepSamples*. https://raw.githubusercontent.com/agencyenterprise/react-native-health/master/docs/getSleepSamples.md — Dùng cho: giá trị INBED/ASLEEP/DEEP/CORE/REM; các mẫu chồng nhau cho một đêm. Truy cập 20/10/2026.
- [13] *getLatestWeight*. https://raw.githubusercontent.com/agencyenterprise/react-native-health/master/docs/getLatestWeight.md — Dùng cho: lấy mẫu cân nặng gần nhất. Truy cập 20/10/2026.
- [14] Apple, *sleepAnalysis* (HKCategoryTypeIdentifier). https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepanalysis — Dùng cho: kiểu mẫu phân tích giấc ngủ; nên lưu múi giờ kèm mẫu. Đọc qua bản JSON của chính trang. Truy cập 20/10/2026.
- [15] Android Developers, *Health Connect data types*. https://developer.android.com/health-and-fitness/guides/health-connect/plan/data-types — Dùng cho: `SleepSessionRecord` (READ_SLEEP), `WeightRecord` (READ_WEIGHT). Truy cập 20/10/2026.

## Lịch sử chỉnh sửa
| Ngày | Bản | Thay đổi |
|---|---|---|
| 20/10/2026 | 1 | Bản đầu: hướng nghiên cứu, chưa triển khai |

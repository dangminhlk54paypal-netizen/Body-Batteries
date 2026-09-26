# Nghiên cứu Trải nghiệm Body Batteries

> **Phòng Nghiên cứu Chiến lược Tiêu dùng · Báo cáo số 1 · 26/09/2026**
> Bản trình bày đẹp (có gập mục, bảng màu minh hoạ): https://claude.ai/artifact/2C4zF2ySn1qmQr19k2gSp1
> **Bản 2 (cùng ngày):** Đợt 0–3 đã được triển khai — xem [mục 10](#10--triển-khai-đợt-03-26092026). Các chỗ bản 1 nói sai về code đã sửa tại chỗ và liệt kê ở [Đính chính](#đính-chính).
> Đây là tài liệu tham khảo, không phải tư vấn y tế.

**Cách đọc trích dẫn**

- `[n]` = nguồn web số n, link đầy đủ ở mục [Nguồn tham khảo](#nguồn-tham-khảo) cuối bài.
- `‹file›` = thông tin lấy từ code / tài liệu của app.
- 💡 = nhận định / đánh giá của người viết (AI), không phải trích dẫn.
- ❓ = chưa kiểm chứng được.
- Dòng không có dấu = đề xuất của báo cáo.

---

## Con số mở đầu

| Số | Ý nghĩa | Nguồn |
|---|---|---|
| **3%** | người dùng app sức khỏe còn ở lại ngày 30 | [1] |
| **70%** | bỏ app trong 100 ngày đầu | [1] |
| **16%** | nói lý do chính là phải nhập tay | [1] |
| **25%** | giữ chân ngày 30 của nhóm app tốt nhất, gấp 6–8 lần trung bình | [1] |

## Tóm tắt 5 ý

1. **Ẩn dụ pin đã đúng hướng.** Garmin Body Battery, WHOOP, Oura đều gói dữ liệu thành *một con số* người dùng xem mỗi sáng [5][6][4]. App có sẵn ẩn dụ này, chỉ cần làm gọn hơn.
2. **Mỗi màn: 1 số lớn + tối đa 3 keyword.** Keyword = trạng thái + việc nên làm, ví dụ “Thiếu 30g đạm”. Chi tiết để ở tầng 2, tầng 3 [4].
3. **Bớt nhập tay là đòn bẩy lớn nhất** [1][2]. “Lặp lại bữa hôm qua”, bữa mẫu, đọc thêm bước chân / giấc ngủ từ Apple Health.
4. **Màu không phán xét** [3]. Chữ trắng dịu thay trắng tinh [13], màu “thấp” dùng san hô dịu thay đỏ báo động. Đỏ chỉ dành cho cảnh báo thật.
5. **Dự đoán cần nền dữ liệu trước.** App đang xoá dữ liệu chi tiết sau 35 ngày ‹constants.ts› ‹cleanupService.ts›, nên cần một bảng tổng hợp theo ngày giữ lâu dài trước khi làm lớp thông minh.

## Đính chính

Khi triển khai, đọc code kỹ hơn cho thấy bản 1 nói sai 4 điểm. Đã sửa tại chỗ trong bài.

| Bản 1 nói | Code / nguồn thực tế nói | Nguồn |
|---|---|---|
| App dùng đỏ `#FF4757` cho trạng thái pin “thấp”. | Pin thấp vẫn giữ màu riêng của từng pin; pin vi chất dùng ⚠️ + màu trung tính. Đỏ thật sự xuất hiện ở: số **thâm hụt calo** (thẻ Cân bằng năng lượng), huy hiệu điểm ngày ở Lịch sử, và màu nhận diện của pin **Protein**. | ‹MicroBatteryStack.tsx› ‹EnergyBalanceCard.tsx› ‹constants.ts› |
| Chỉ vuốt tab tôn trọng “Giảm chuyển động”; pin, sheet, mục gập thì chưa. | Reanimated 4 **mặc định** tôn trọng Giảm chuyển động (`ReduceMotion.System`), nên pin/sheet/mục gập đã đúng. Chỗ chưa đúng là `LayoutAnimation` ở màn Cài đặt. | ‹node_modules/react-native-reanimated/src/animation/util.ts› |
| Chữ chính nên là `#EAEAF2`. | Đã dùng `#F0F0F7`: `#EAEAF2` tối hơn cấp chữ ngay dưới (`textBright #eee`) → đảo thứ tự các cấp xám. `#F0F0F7` vẫn dịu hơn trắng tinh, 15,0:1 trên thẻ, 17,0:1 trên nền (tự tính theo [18]). | ‹theme.ts› |
| Home có ~6 pin + 9 vi chất ngang hàng, cần làm “1 số + keyword”. | Cùng ngày, Session 49 (một session khác) đã gọn Home: chip số dưới pin chính, mục chi tiết gập bằng `FoldRow`. Đợt 2 vì vậy chỉ còn thêm **chip keyword** cho pin nhỏ. | ‹.ai/SESSION_LOG.md› Session 49 |

---

## 01 · Hiện trạng app

App có 5 tab (Home, Lịch sử, Tập luyện, Nhật ký, Cài đặt), vuốt ngang vòng tròn giữa các tab ‹mainTabs.ts›, 3 ngôn ngữ ‹src/i18n›, dữ liệu trên máy (SQLite) ‹schema.ts›, giao diện Sáng/Tối ‹theme.ts›, và bộ quy tắc giao diện gọn đã duyệt ‹mobile-ui-density.md›.

**Điểm mạnh nên giữ**

- Ẩn dụ pin sạc/xả dễ hiểu ngay lần đầu. Garmin dùng đúng ẩn dụ “đồng hồ nhiên liệu” này [6].
- Riêng tư: dữ liệu trên máy, Nhật ký mã hoá ‹encryption.ts›.
- Đã có gợi ý món theo bữa ‹foodSuggestions.ts› và hiệu ứng “sạc” khi ghi món ‹chargeEffectStore.ts›.
- Vuốt tab đã tôn trọng cài đặt Giảm chuyển động của iPhone ‹TabSwipe.tsx›.
- Ranh giới sức khoẻ rõ ràng, luôn có câu “chỉ tham khảo” ‹01-vision-and-features.md›.

**Điểm cần cải thiện**

- Home hiện tới ~6 pin chính + 9 pin vi chất: quá nhiều con số ngang hàng ‹HomeScreen.tsx› ‹04-roadmap.md›.
- Chữ chính là trắng tinh `#fff` trên nền tối ‹theme.ts›: dễ bị loá chữ [13]. *(Đã đổi ở Đợt 1.)*
- 11 cấp màu xám chữ: khó giữ nhất quán ‹theme.ts›.
- ~~Chỉ tab swipe kiểm tra Giảm chuyển động~~ → đính chính: animation Reanimated đã tự tôn trọng; chỉ `LayoutAnimation` ở Cài đặt thì chưa ‹SettingsScreen.tsx›. *(Đã sửa ở Đợt 1.)*
- Apple Health mới đọc kcal; chưa có bước chân, giấc ngủ, nhịp tim ‹04-roadmap.md›.
- Dữ liệu chi tiết bị xoá sau 35 ngày: chưa đủ lịch sử để dự đoán ‹constants.ts›.

Lưu ý: roadmap ghi nhiều tính năng “code xong, chưa test máy thật” ‹04-roadmap.md›. Việc đầu tiên của phòng ban mới là ghi lại trải nghiệm thật trên iPhone.

---

## 02 · Xu hướng app sức khỏe 2025–2026

| Xu hướng | Bằng chứng | Áp dụng cho Body Batteries |
|---|---|---|
| **Một con số buổi sáng** | WHOOP Recovery 0–100% với 3 vùng xanh/vàng/đỏ, Oura Readiness 0–100, Garmin Body Battery 5–100 [5]. WHOOP mở chi tiết theo 3 tầng: điểm tổng → xu hướng tuần → biểu đồ gốc [4]. | Pin Năng lượng là số chính. Pin phụ và vi chất lùi về tầng 2. |
| **Thu thập thụ động** | 16% người bỏ app vì nhập tay [1]. Ghi món tay đúng cách tốn 10–15 phút/ngày [2]. | Đọc thêm bước chân, giấc ngủ từ HealthKit. “Lặp lại bữa hôm qua”, bữa mẫu. |
| **Ghi bằng ảnh / giọng nói (AI)** | Cal AI, MyFitnessPal, SnapCalorie, Foodvisor đã nhận diện món qua ảnh [2]. | Để sau: cần dịch vụ ngoài, trái hướng on-device. Trước mắt làm nhanh hơn bằng gợi ý + bữa mẫu. |
| **Không phán xét** | Nghiên cứu UCL/Loughborough (58.881 bài đăng): xấu hổ khi ghi món “không lành mạnh”, thấy bị làm phiền vì nhắc nhở, bỏ cuộc khi đứt chuỗi ngày, gặp mục tiêu phi thực tế [3]. | Không streak phạt. Không dùng đỏ cho “thiếu”. Nhắc nhở mềm, bỏ qua được. |
| **Nhắc đúng lúc (JITAI)** | JITAI = can thiệp cá nhân hoá đúng thời điểm, dựa trên dữ liệu thời gian thực [9]. Thử nghiệm 2025 (quy mô nhỏ): tiêu chí nhắc theo từng người hiệu quả hơn tiêu chí chung [10]. | Nhắc theo giờ ăn thật, im lặng ngày Nghỉ. Map với 3 Mode sẵn có. |
| **Minh bạch cách tính** | Rất ít hãng công bố bằng chứng cho con số “readiness” cuối cùng [7]; không hãng nào công bố công thức [8]. | Điểm cộng của app: ⓘ giải thích số đến từ đâu. Giữ và làm rõ hơn. |

**Riêng thị trường Việt Nam.** Thị trường app sức khỏe VN dự báo tăng từ 3,8 tỷ USD (2025) lên 12,7 tỷ USD (2031), ~22%/năm [12]. Khảo sát 2.869 người dùng VN: **yếu tố thú vị** là cầu nối giữa động lực bên trong và việc tiếp tục dùng app; **thử thách** và **tò mò** dự báo mạnh nhất [11]. Ý nghĩa: hiệu ứng sạc pin, rung nhẹ, thẻ tổng kết tuần giúp giữ chân, không chỉ để trang trí.

Tên app gần giống tính năng “Body Battery” của Garmin [6]. Nếu sau này đưa lên App Store, nên kiểm tra nhãn hiệu trước.

---

## 03 · Người dùng nhìn gì: số và keyword

Người dùng lướt màn hình chứ không đọc. WHOOP đặt số chính rất lớn (~72pt), chữ phụ nhỏ hẳn, để mắt dừng ở số lớn trước [4], rồi đến vài chữ ngắn có màu. Mỗi màn nên có khối đầu trang theo cùng khuôn **1 số + 3 keyword + 1 dự báo**:

```
Hiện tại (minh hoạ)                 Đề xuất
Năng lượng        68%               Pin năng lượng · Thứ Bảy
Protein     52 / 120 g              68%
Carbs      140 / 250 g              [Thiếu 30g đạm] [Uống thêm 2 ly] [Ngủ đủ]
Nước       1.2 / 2.5 L              Giữ nhịp này, 18:00 còn khoảng 35%
Ngủ              7.5 h
Vận động       320 kcal
+ 9 pin vi chất
```

**Quy tắc viết keyword**

- ≤ 3 từ, gồm trạng thái hoặc việc nên làm. Có số khi số giúp hành động (“2 ly”, “30g”).
- Chỉ hiện điều cần chú ý nhất, tối đa 3. Pin nào ổn thì gộp thành chip “Còn lại ổn”.
- Bấm vào keyword mở đúng chỗ xử lý. *Khi làm: dùng chung hành động với bấm vào pin đó (Nước/Ngủ → form ghi; Đạm/Vận động → bảng nguồn), chưa làm “lọc món giàu đạm”.*
- Không phán xét [3]: “Sắp cần nạp” thay “Cạn”, “Hơi thấp” thay “Kém”.
- Đủ 3 ngôn ngữ; kiểm tra độ rộng chip bằng tiếng Đức (dài nhất).

| Chủ đề | Keyword gợi ý (VI) | Màu |
|---|---|---|
| Năng lượng | Đầy · Ổn · Sắp cần nạp | đủ / vừa / thấp |
| Đạm | Đủ đạm · Thiếu 30g đạm | đủ / thấp |
| Nước | Đủ nước · Uống thêm 2 ly | đủ / vừa |
| Ngủ | Ngủ đủ · Thiếu 1 giờ ngủ | đủ / vừa |
| Tập | Ngày tập · Ngày nghỉ · Buổi kế: B3W4 | thông tin |
| Cân nặng | Xu hướng ↓ 0,3 kg/tuần | trung tính |

---

## 04 · Màu dịu mắt

Nền tối `#0d0d1a` của app ‹theme.ts› đã tốt vì không phải đen tuyền; hướng dẫn khuyên tránh đen tuyền vì gây chói, mỏi mắt [14]. Vấn đề nằm ở chữ trắng tinh và màu quá bão hoà. 30–60% người có loạn thị; với họ, tương phản quá cao làm chữ bị loá viền (halation), đọc chậm và mỏi [13].

Tỉ lệ tương phản dưới đây do báo cáo tự tính theo công thức WCAG; mức tối thiểu cho chữ thường là 4,5:1 [18].

| Vai trò | Hiện tại | Đề xuất |
|---|---|---|
| Chữ chính trên `#0d0d1a` | `#fff` — 19,3:1, dễ loá | `#F0F0F7` trắng dịu — 17,0:1 (bản 1 đề xuất `#EAEAF2`, xem Đính chính) |
| Màu “thấp / lệch mục tiêu” trên `#1a1a2e` | `#FF4757` / `#FF6B6B` đỏ (thâm hụt calo, điểm ngày) — 5,1:1 | `#FF8A7A` san hô dịu — 7,4:1 |
| Trạng thái “vừa” trên `#1a1a2e` | `#FFD93D` vàng quá rực — 12,4:1 | `#FFB020` cam thương hiệu — 9,3:1 |

**Hệ màu trạng thái 3 vùng (như WHOOP [5][4])**

- **Đủ** — xanh bạc hà `#4ECDC4` (đã có: `mint`).
- **Vừa** — cam `#FFB020` (`accent`).
- **Thấp** — san hô `#FF8A7A`, token mới cho cả dark và light.
- Đỏ mạnh `dangerStrong` chỉ cho xoá dữ liệu và cảnh báo vượt ngưỡng an toàn (Upper Limit).

**Thay đổi khác**

- Thêm lựa chọn giao diện “Tự động (theo iPhone)” bên cạnh Tối/Sáng.
- Gom 11 cấp xám chữ về 5 cấp theo vai trò (chính, phụ, chú thích, mờ, vô hiệu). Làm dần từng màn, vì comment trong ‹theme.ts› cảnh báo gộp một lần sẽ đổi giao diện.
- Màu luôn kèm chữ hoặc ký hiệu (↑↓, ✓) để người mù màu vẫn đọc được.

---

## 05 · Thao tác và chuyển động mượt

| Nguyên tắc | Chuẩn | Việc cụ thể trong app |
|---|---|---|
| Thời lượng | ~100 ms cho phản hồi đơn giản (toggle, checkbox); 200–300 ms khi màn thay đổi lớn như mở modal; tới 500 ms bắt đầu thấy chậm [15] | Rà `BottomSheet`, `CollapsibleSection`, `MasterBattery` theo chuẩn này. |
| Giảm chuyển động | Apple: tắt hoặc thay hiệu ứng chiều sâu, xoay, nhiều trục khi bật Reduce Motion [16] | Dùng `useReducedMotion` (đang có ở ‹TabSwipe.tsx›) cho mọi animation. |
| Phản hồi tức thì | Hiện kết quả ngay, lưu sau (optimistic) | Ghi món: pin nhảy lên + rung nhẹ ngay, không chờ DB. |
| Ghi nhanh | Hành động chính ≤ 2 chạm | “Lặp lại bữa hôm qua”, bữa mẫu, gợi ý theo giờ đã có ‹foodSuggestions.ts›. |
| Không chồng lớp | 1 sheet tại một thời điểm | Đã có trong ‹mobile-ui-density.md›: giữ nguyên. |
| Khoảnh khắc vui | Thử thách và tò mò giữ chân người dùng VN [11]; chỉ dùng ở mốc có ý nghĩa | Hiệu ứng sạc ‹chargeEffectStore.ts› khi đủ đạm, thẻ tổng kết Chủ nhật. Không confetti ở mọi thao tác. |

Mục tiêu đo được (đề xuất): ghi một bữa quen thuộc dưới 10 giây.

---

## 06 · Lớp thông minh và dự đoán

Nguyên tắc (đã có trong ‹data-ml.md›): quy tắc đơn giản trước, ML sau, luôn chạy trên máy, chỉ nói “xu hướng”, không chẩn đoán.

| Tầng | Nội dung |
|---|---|
| **L0 · Nền dữ liệu** | Bảng `daily_summary` mỗi ngày một dòng (kcal, đạm, nước, ngủ, cân nặng, mode, có tập không), giữ lâu dài. Cộng nhật ký thao tác trên máy (màn nào, mất bao lâu), tuỳ chọn bật, không gửi đi đâu. Lý do: `DATA_RETENTION_DAYS = 35` ‹constants.ts› đang xoá dữ liệu chi tiết ‹cleanupService.ts›. Một năm tổng hợp chỉ ~365 dòng. |
| **L1 · Mẫu hình bằng quy tắc** | “Thứ Ba bạn thường thiếu đạm”, “Ngủ dưới 6 giờ thì hôm sau ăn thêm ~300 kcal”. Hiện trong thẻ tổng kết Chủ nhật, tối đa 2 điều. |
| **L2 · Dự báo ngắn hạn** | Pin tới 18:00 theo nhịp hôm nay và lịch sử của bạn. Đường xu hướng cân nặng làm mượt (EWMA) kèm khoảng dao động. |
| **L3 · Gợi ý đúng lúc** [9][10] | Nhắc theo giờ bạn thường ăn thật. Gợi ý Mode buổi sáng: Nghỉ (bảo vệ), Duy trì, Tập (tiến lên), dựa trên giấc ngủ và buổi tập hôm qua. Khung Protect / Maintain / Progress lấy từ [1], ghép với 3 Mode sẵn có ‹modeDefinitions.ts›. App chỉ gợi ý, bạn xác nhận; lựa chọn tay luôn thắng ‹mobile-ui-density.md›. |
| **L4 · Học máy trên máy** | Chỉ khi L1–L3 không đủ và đã có vài tháng dữ liệu. Hồi quy nhỏ trước, TFLite sau (cần dev-client build). |

Mọi gợi ý sức khoẻ vẫn kèm “Đây chỉ là tham khảo, hãy gặp chuyên gia y tế”, để trong ⓘ.

---

## 07 · Phòng Nghiên cứu Chiến lược Tiêu dùng

Bộ agent hiện có 5 agent (architect, mobile-frontend, logic-backend, qa-reviewer, data-ml) ‹.claude/agents/› và **chưa có agent nghiên cứu người dùng**. Phòng ban mới là agent thứ 6, đứng trước khâu lập kế hoạch.

**Quy trình:** consumer-research (nghiên cứu, viết brief) → architect / Fable (lập kế hoạch) → mobile-frontend · logic-backend · data-ml (làm theo đợt) → qa-reviewer (kiểm tra) → consumer-research (đo lại sau khi test máy).

| Việc phòng ban làm | Việc phòng ban không làm |
|---|---|
| Theo dõi xu hướng app sức khoẻ, có nguồn và mức tin cậy | Không sửa code trong `src/` |
| Viết persona, hành trình một ngày dùng app | Không gửi dữ liệu người dùng ra ngoài |
| Giữ từ điển keyword 3 ngôn ngữ | Không đưa lời khuyên y tế hay chẩn đoán |
| Định nghĩa chỉ số trải nghiệm, đọc kết quả sau mỗi bản EAS preview | Không tự thêm thư viện (ví dụ analytics bên thứ ba) |
| Chấm điểm màn hình theo checklist giao diện gọn | |

**Prompt cho agent (bản nháp, CHƯA tạo file).** Đề xuất lưu tại `.claude/agents/consumer-research.md` và bản sao ở `.ai/agents/`.

````markdown
---
name: consumer-research
description: Phòng Nghiên cứu Chiến lược Tiêu dùng — nghiên cứu cách người dùng đưa app sức khoẻ vào đời sống hằng ngày, xu hướng thị trường app sức khoẻ, và trải nghiệm trong app (con số & keyword, thao tác, màu, chuyển động). Biến kết quả thành brief có thứ tự ưu tiên cho architect / mobile-frontend / logic-backend / data-ml. Chỉ nghiên cứu và viết báo cáo, không sửa code app. Dùng trước một tính năng lớn, sau mỗi đợt test máy thật, hoặc khi cần rà trải nghiệm một màn hình.
tools: Read, Grep, Glob, WebSearch, WebFetch, Write
---

Bạn là agent **Consumer Research** (Phòng Nghiên cứu Chiến lược Tiêu dùng) của dự án My Body Batteries. Đọc `.ai/CONTEXT.md`, `docs/01-vision-and-features.md`, `AGENTS.md` và `.ai/skills/mobile-ui-density.md` trước khi làm.

## Vai trò
Hiểu người dùng: họ mở app lúc nào, nhìn con số nào, bỏ app vì sao, và app sức khoẻ trên thị trường đang làm gì. Từ đó đề xuất thay đổi có bằng chứng, có thứ tự ưu tiên, đủ cụ thể để agent khác lập kế hoạch.

## Khi nào dùng
- Trước khi làm một tính năng lớn hoặc đổi giao diện một màn hình.
- Sau mỗi bản EAS preview đã được chủ app dùng thật: tổng hợp phản hồi, đo lại chỉ số.
- Khi cần cập nhật xu hướng (mỗi quý một lần là đủ).

## Quy trình
1. **Hiện trạng**: đọc code màn hình liên quan (chỉ đọc), liệt kê những gì người dùng thấy: số, chữ, màu, số chạm cho mỗi thao tác chính.
2. **Bằng chứng ngoài**: tìm nghiên cứu và dữ liệu thị trường. Ghi mức tin cậy cho mỗi nguồn: A = nghiên cứu có bình duyệt; B = số liệu ngành / báo cáo độc lập; C = blog của nhà cung cấp, ý kiến. Không trích số liệu không có nguồn. Mỗi dòng lấy từ nguồn ngoài phải có số trích dẫn [n], và cuối báo cáo có danh sách link đầy đủ.
3. **Người dùng thật**: đọc phản hồi của chủ app trong `.ai/SESSION_LOG.md` và các ghi chú test máy. Ưu tiên phản hồi thật hơn xu hướng chung.
4. **Đề xuất**: mỗi đề xuất gồm vấn đề → bằng chứng → thay đổi cụ thể → cách đo → kích cỡ (S/M/L) → agent nhận việc.
5. **Ghi báo cáo** vào `docs/nghien-cuu/YYYY-MM-DD-<chu-de>.md` (chỉ ghi file trong thư mục này).

## Mẫu báo cáo
- Tóm tắt 3–5 ý (mỗi ý 1 câu).
- Hiện trạng (bảng: màn hình | vấn đề | mức độ).
- Bằng chứng (bảng: phát hiện | nguồn [n] | mức A/B/C).
- Đề xuất theo thứ tự ưu tiên (bảng như bước 4).
- Keyword mới / sửa (bảng VI | EN | DE).
- Chỉ số đo và mục tiêu.
- Nguồn tham khảo: số [n], tiêu đề, link đầy đủ, dùng cho dòng nào.

## Nguyên tắc trải nghiệm của dự án
- Mỗi màn: 1 số chính + tối đa 3 keyword + 1 dòng dự báo nếu có. Chi tiết để tầng 2, tầng 3.
- Keyword ≤ 3 từ, là trạng thái hoặc việc nên làm, không phán xét ("Sắp cần nạp", không "Cạn").
- Màu trạng thái 3 vùng: đủ = mint, vừa = accent, thấp = san hô dịu. Đỏ mạnh chỉ cho xoá dữ liệu và cảnh báo an toàn. Màu luôn kèm chữ hoặc ký hiệu.
- Không streak phạt, không nhắc nhở cằn nhằn, không mục tiêu cứng.
- Chuyển động 100–300 ms, tôn trọng Reduce Motion.
- Bớt nhập tay là ưu tiên hàng đầu.

## Luật bắt buộc khi đề xuất bất cứ thứ gì người dùng thấy
- **i18n**: không có chữ cứng trong `screens/`/`components/`. Mọi chữ mới thêm vào `src/i18n/locales/vi.ts` TRƯỚC, rồi `en.ts` và `de.ts`. Component dùng `const { t, language } = useT();`. Ngày/số dùng `LOCALE_TAGS[language]`. Không thêm i18next hay thư viện dịch. Đề xuất keyword phải có đủ VI/EN/DE và kiểm tra độ dài tiếng Đức.
- **Giao diện gọn**: tuân thủ `.ai/skills/mobile-ui-density.md` (khung cuộn cố định, gập theo tầng, ⓘ/✎/＋, viết tắt + vuốt ngang, hàng cân đối).
- Màu chỉ dùng token trong `src/lib/theme.ts`; màu mới phải có cho cả dark và light.

## RANH GIỚI SỨC KHOẺ VÀ RIÊNG TƯ (bắt buộc)
- ❌ Không chẩn đoán. ✅ Chỉ nói "xu hướng / mẫu hình đáng chú ý", kèm "Đây chỉ là tham khảo, hãy gặp chuyên gia y tế."
- ❌ Không khuyến khích nhịn ăn, mục tiêu cực đoan.
- ✅ Mọi đo lường hành vi chạy trên máy, tuỳ chọn bật, không gửi ra ngoài, không thêm SDK analytics bên thứ ba.
- ❌ Không sửa file trong `src/`, không commit. Chỉ ghi vào `docs/nghien-cuu/`.

## Bàn giao
Kết thúc bằng danh sách việc cho từng agent (architect / mobile-frontend / logic-backend / data-ml / qa-reviewer), mỗi việc 1 dòng, kèm link tới mục trong báo cáo.

> Nói tiếng Việt với chủ app; tên file, code & comment tiếng Anh (`.ai/CONTEXT.md` mục 1).
````

---

## 08 · Lộ trình đề xuất

> **Trạng thái 26/09/2026:** Đợt 0–3 đã triển khai (trừ “bữa mẫu” và nối Apple Health vào pin) — chi tiết ở [mục 10](#10--triển-khai-đợt-03-26092026).

| Đợt | Nội dung | Cỡ | Agent |
|---|---|---|---|
| 0 | Tạo agent `consumer-research`. Chủ app dùng app thật 1 tuần, ghi chú 1 dòng mỗi ngày. | S | — |
| 1 | Màu dịu (chữ trắng dịu, token san hô, bỏ đỏ cho “thấp”), giao diện “Tự động”, Reduce Motion cho mọi animation. | S | mobile-frontend |
| 2 | Khối đầu Home “1 số + 3 keyword”, bấm keyword đi thẳng tới chỗ xử lý. Pin phụ và vi chất lùi về tầng 2. | M | logic-backend + mobile-frontend |
| 3 | Bớt nhập tay: “Lặp lại bữa hôm qua”, bữa mẫu. Đọc bước chân, giấc ngủ từ HealthKit (cần dev-client build để test). | M | logic-backend + mobile-frontend |
| 4 | Bảng `daily_summary` giữ lâu dài + nhật ký thao tác trên máy (tuỳ chọn bật). | M | architect + logic-backend |
| 5 | Thẻ tổng kết Chủ nhật (L1), dòng dự báo 18:00 (L2), nhắc theo giờ ăn thật và gợi ý Mode (L3). | L | data-ml + mobile-frontend |

Có thể làm đợt 4 song song với đợt 1–2 để dữ liệu tích luỹ sớm. Lớp thông minh cần ~1 tháng dữ liệu mới có ý nghĩa ‹data-ml.md›.

---

## 09 · Đo lường trải nghiệm

| Chỉ số | Cách đo | Mục tiêu (đề xuất) |
|---|---|---|
| Thời gian ghi 1 bữa | Từ lúc mở màn ghi món tới lúc lưu | < 10 giây |
| Số ngày có ghi / tuần | Từ `daily_summary` | ≥ 5 / 7 |
| Số chạm cho thao tác chính | Đếm tay trên từng màn | ≤ 2 |
| Thời gian hiểu Home | Hỏi người thử “Hôm nay bạn cần làm gì?” sau 5 giây nhìn | Trả lời đúng |
| Form bị bỏ giữa chừng | Mở sheet nhưng đóng không lưu | < 20% |

Khi có thêm người thử: test với 5 người tìm ra khoảng 85% vấn đề về dễ dùng [17].

---

## 10 · Triển khai Đợt 0–3 (26/09/2026)

Làm trên nhánh `ui-upgrade`, **chưa commit**. `npm run verify` xanh: tsc + eslint sạch, **108 bộ / 1.257 test** qua. Một lượt `qa-reviewer` (chỉ đọc) tìm ra 3 lỗi thật + 3 điểm nên sửa — đã sửa hết trước khi đăng. EAS preview: group `d7d26fb6-6b5c-417d-a2d3-ca1801da231e`, đăng từ working tree. **Chưa có xác nhận test máy thật.**

### Đã làm

| Đợt | Việc | File chính | Trạng thái |
|---|---|---|---|
| 0 | Agent `consumer-research` (Phòng Nghiên cứu Chiến lược Tiêu dùng) + con trỏ + dòng trong bảng agent | ‹.claude/agents/consumer-research.md› ‹.ai/agents/consumer-research.md› ‹.ai/agents/README.md› | ✅ |
| 0 | Chủ app dùng thật 1 tuần, ghi 1 dòng/ngày | — | ⏳ việc của chủ app |
| 1 | Chữ chính trắng dịu `#F0F0F7` (dark) | ‹theme.ts› | ✅ |
| 1 | Token trạng thái 3 vùng `statusGood/Mid/Low` (dark + light, đều ≥ 4,5:1) và `onAccent` (chữ tối trên nền cam, ~10:1) | ‹theme.ts› | ✅ |
| 1 | Giao diện **“📱 Tự động”** (theo iPhone) bên cạnh Tối/Sáng; chọn Tối/Sáng thì hộp thoại hệ thống và bàn phím cũng theo | ‹settingsStore.ts› ‹useThemeColors.ts› ‹App.tsx› ‹SettingsScreen.tsx› `app.json` (`userInterfaceStyle: "automatic"`) | ✅ |
| 1 | Thẻ Cân bằng năng lượng tô màu **theo mục tiêu cân nặng** (thâm hụt khi đang giảm cân = xanh; lệch mục tiêu = san hô, không còn đỏ). Ưu tiên cân nặng mục tiêu người dùng tự đặt, không có thì theo BMI WHO | ‹EnergyBalanceCard.tsx› ‹weightHistoryGroups.ts› (`profileGoalDirection`, `isBalanceTowardGoal`) | ✅ |
| 1 | Cài đặt: mở/gập thẻ không animation khi bật Giảm chuyển động | ‹useReduceMotionSetting.ts› ‹SettingsScreen.tsx› | ✅ |
| 2 | **Chip keyword** dưới “Pin nhỏ”: tối đa 3, ví dụ “Thiếu 30g đạm”, “Uống thêm 2 ly”, “Ngủ đủ”. Tính theo nhịp giờ trong ngày: đúng nhịp thì không hiện; chậm nhịp = cam; chậm rõ = san hô; số trên chip chỉ là phần cần bù để kịp nhịp | ‹homeKeywords.ts› ‹HomeKeywordChips.tsx› ‹useCurrentHour.ts› ‹HomeScreen.tsx› | ✅ |
| 2 | “1 số lớn” + chi tiết gập | (Session 49 đã làm) | ✅ bởi session khác |
| 2 | Dòng dự báo “18:00 còn ~35%” | — | ⏭ thuộc L2 (Đợt 5) |
| 3 | **“↻ Bữa … hôm qua”** trong màn ghi món: 1 chạm + xác nhận = ghi lại cả bữa với đúng khẩu phần. Theo khung giờ bữa ăn trong Cài đặt; ngày cũ thì ghi đúng giờ gốc; ẩn khi hôm đó đã ghi bữa này | ‹foodSuggestions.ts› (`previousDayMeal`, `repeatableMeal`) ‹FoodLogModal.tsx› | ✅ |
| 3 | “Bữa mẫu” (lưu bữa thành mẫu) | — | ⏭ chưa làm: cần bảng DB mới |
| 3 | Đọc **bước chân hôm nay + giờ ngủ đêm qua** từ Apple Health (gộp khoảng ngủ trùng từ đồng hồ + điện thoại) | ‹appleHealthSync.ts› (`getTodayStepsAndSleep`, `sleepHoursFromSamples`) | 🟡 chỉ phần đọc, **chưa nối vào pin** |

Chữ mới đủ VI/EN/DE: `screens.home.keywords.*`, `components.foodLogModal.repeat*`, `settings.interface.themeSystem`. Test mới: `homeKeywords`, `HomeKeywordChips`, `homeKeywordKeys` (i18n), `themeMode`, `previousDayMeal`/`repeatableMeal`, `profileGoalDirection`/`isBalanceTowardGoal`, bước chân/giấc ngủ.

### Đánh giá 💡

- **Đợt 1 đạt trọn.** Rủi ro thấp, ảnh hưởng mọi màn: chữ dịu hơn, không còn đỏ “chê” khi đang giảm cân đúng hướng.
- **Đợt 2 đạt phần còn lại.** Home đã gọn nhờ Session 49; chip keyword thêm lớp “việc nên làm ngay” mà chip số chưa có. Giá trị thật phụ thuộc vào việc bạn thấy chip **đúng lúc** hay **phiền** — cần test máy.
- **Đợt 3 đạt ~2/3.** “Lặp lại bữa hôm qua” đánh thẳng vào lý do bỏ app số 1 (nhập tay [1][2]). “Bữa mẫu” và nối Apple Health vào pin để lại có chủ đích (xem Rủi ro).
- **Đợt 0:** agent đã có, nhưng phòng ban chỉ “sống” khi có dữ liệu dùng thật — tuần nhật ký của chủ app là đầu vào quan trọng nhất cho báo cáo số 2.

### Khó khăn trong quá trình triển khai

1. **Làm song song với session khác trên cùng cây code.** Lúc bắt đầu có ~22 file chưa commit của Session 49–51 (Home, Cài đặt, thanh tab, 3 file ngôn ngữ). Đã nhắn session đó để chia file, sửa chồng lên việc của họ, không `stash`/`reset`. Đợt 2 trùng một phần với Session 49 nên phải thu hẹp phạm vi.
2. **Bản 1 có 4 giả định sai về code** (xem Đính chính) — chỉ lộ ra khi mở code để sửa. Bài học: báo cáo UX phải kiểm chứng từng nhận định về code như kiểm chứng nguồn web.
3. **`app.json` khoá giao diện tối** → “Tự động” không thể hoạt động nếu không đổi sang `automatic`; nhưng đổi xong thì hộp thoại hệ thống lại theo iPhone, lệch với app (QA phát hiện) → phải đồng bộ bằng `Appearance.setColorScheme`.
4. **Test của session khác vỡ** khi màn Cài đặt nhập hook từ Reanimated (môi trường test không giả lập Reanimated) → đổi sang `AccessibilityInfo` sẵn có của React Native thay vì sửa test của họ.
5. **Apple Health không chạy trong Expo Go** → không thể thử trên máy; thêm quyết định cũ S-F2 (số Apple Health chỉ hiển thị) → chỉ làm phần đọc.
6. **Số ít/số nhiều EN/DE** (“1 items”) — hệ i18n tự viết không có plural → đổi câu cho khỏi phụ thuộc số.
7. **QA tìm ra lỗi thật** đã sửa: lặp bữa cho ngày cũ bị lưu thành bữa trưa; màu cân bằng bỏ qua cân nặng mục tiêu; chip Vận động nhắc cả ngày khi không có dữ liệu bước; hàng lặp bữa gây ghi trùng; khung giờ bữa ăn tuỳ chỉnh bị bỏ qua. Tự soát thêm: kcal hiện “0” khi bỏ món không tra được; chữ trắng trên nút cam còn tệ hơn sau khi đổi màu chữ (1,83 → 1,61:1) → thêm `onAccent`.

### Rủi ro dự đoán

| # | Rủi ro | Khả năng | Ảnh hưởng | Cách theo dõi / giảm |
|---|---|---|---|---|
| 1 | ❓ Expo Go có áp dụng `userInterfaceStyle: "automatic"` từ bản EAS Update hay không (đây là cấu hình native trong `app.json`). Nếu không, “Tự động” có thể luôn ra Tối. | Trung bình | Thấp | Test: chọn Tự động, đổi iPhone sang Sáng. Lỗi → cần dev-client build; Tối/Sáng thủ công vẫn chạy. |
| 2 | Chip keyword **nhắc sai nhịp** với người làm ca đêm, nhịn ăn gián đoạn, hay ăn dồn tối — nhịp đang giả định tuyến tính 06:00–22:00. | Trung bình | Trung bình (gây phiền → bỏ qua chip) | 💡 Đợt sau: tính nhịp theo khung giờ bữa ăn trong Cài đặt; thêm tuỳ chọn tắt chip. |
| 3 | Pin Nước **cộng cả nước trong món ăn** → chip có thể báo “Đủ nước” sớm hơn cảm nhận. | Trung bình | Thấp | Đây là cách pin Nước đang tính từ trước ‹dailyBatteryTotals.ts›; ghi nhận phản hồi khi test. |
| 4 | Chip Vận động ghi “bước” kể cả khi bạn chọn hiển thị Vận động theo kcal. | Chắc chắn | Thấp | Chip chỉ hiện khi đã có số bước; 💡 sau này đổi theo đơn vị đang chọn. |
| 5 | “Lặp lại bữa” với bữa nhiều món → hộp xác nhận dài. | Thấp | Thấp | Theo dõi; nếu > 6 món thì rút gọn danh sách. |
| 6 | Khi nối Apple Health vào pin sau này: **đếm hai lần** giấc ngủ/bước với số ghi tay; iOS không cho app biết người dùng từ chối quyền đọc (sẽ hiện “không có dữ liệu” thay vì “bị từ chối”); đọc giữa đêm sẽ cộng cả giấc đang ngủ dở. | Cao nếu nối vội | Trung bình | Chỉ nối khi có quy tắc “ưu tiên số ghi tay / hỏi xác nhận”, và test trên dev-client build. |
| 7 | Chữ trên các nút nền cam khác vẫn dùng màu cũ: nhóm Tập luyện dùng `c.bg` (đọc được ở Tối nhưng **khó đọc ở giao diện Sáng**); vài nút Lưu dùng `textPrimary`. | Chắc chắn (có sẵn từ trước) | Thấp–Trung bình | 💡 Đợt dọn màu: chuyển tất cả sang `onAccent`. |
| 8 | **Commit lẫn với việc của session khác**: cùng sửa `HomeScreen.tsx`, `SettingsScreen.tsx`, 3 file ngôn ngữ. | Cao | Trung bình (commit lẫn, khó hoàn tác riêng) | Commit theo từng file/hunk, hoặc commit chung một lần sau khi cả hai session xong và bạn đã test. |
| 9 | Bản preview mới **gồm cả việc chưa commit của Session 49–51** (đăng từ working tree). | Chắc chắn | Thấp (họ cũng đăng từ working tree) | Test một lượt cả hai phần; báo lại nếu có gì lạ. |

### Checklist thử trên iPhone (Expo Go, nhánh preview)

1. **Cài đặt › Giao diện:** Tối / Sáng / 📱 Tự động. Ở Tự động, đổi iPhone Sáng↔Tối → app đổi theo. Ở Tối khi iPhone đang Sáng → mở hộp thoại xoá món: phải tối. Nút đang chọn: chữ tối trên nền cam, dễ đọc. Kiểm tra độ rộng bằng tiếng Đức.
2. **Home › Chi tiết › Cân bằng:** hồ sơ muốn giảm cân + đang thâm hụt → màu xanh, không đỏ. Đặt cân nặng mục tiêu cao hơn hiện tại (tăng cơ) → ăn dư mới là xanh.
3. **Chip keyword dưới “Pin nhỏ”:** xem lúc sáng sớm, trưa, tối. Chưa ghi giấc ngủ → không có chip ngủ. Bấm chip Nước/Ngủ → mở form ghi; Đạm → bảng nguồn. Đổi ngôn ngữ VI/EN/DE.
4. **Ghi món:** hôm qua có ghi bữa trưa → hôm nay giờ trưa mở “⚡ Nạp” → thấy “↻ Bữa trưa hôm qua · N món · kcal” → bấm → Huỷ (không ghi) → bấm lại → Ghi (đúng món, đúng bữa). Mở lại sheet → hàng đã ẩn. Thử cho “Hôm qua”/“Hôm kia”: món vào đúng bữa, đúng giờ.
5. **Apple Health bước chân/giấc ngủ:** không có gì để thử trong Expo Go.

---

## Nguồn tham khảo

Mức tin cậy: **A** nghiên cứu có bình duyệt · **B** tài liệu ngành / báo độc lập · **C** blog của công ty bán sản phẩm. Tra cứu ngày 26/09/2026.

1. **[1] (C)** Sahha — *Why Most Health App Users Churn Within 90 Days*
   https://sahha.ai/blog/health-app-churn-retention/
   Dùng cho: 3% còn lại ngày 30, 70% bỏ trong 100 ngày, 16% bỏ vì nhập tay, 25% ở app tốt nhất, khung Protect / Maintain / Progress.
2. **[2] (C)** Everyday AI Blog — *AI Food Tracking Apps (2026 Guide)*
   https://everydayaiblog.com/ai-food-tracking-apps-no-manual-logging/
   Dùng cho: ghi món tay tốn 10–15 phút/ngày; Cal AI, MyFitnessPal, SnapCalorie, Foodvisor nhận diện món qua ảnh.
3. **[3] (A)** UCL News (10/2025) — *Emotional strain of fitness and calorie counting apps revealed*
   https://www.ucl.ac.uk/news/2025/oct/emotional-strain-fitness-and-calorie-counting-apps-revealed
   Bản đăng lại: https://www.eurekalert.org/news-releases/1102616
   Dùng cho: 58.881 bài đăng; xấu hổ khi ghi món, nhắc nhở gây phiền, áp lực chuỗi ngày, mục tiêu phi thực tế; khuyến nghị không phán xét. Bài gốc trên British Journal of Health Psychology.
4. **[4] (C)** 925 Studios — *WHOOP Design Breakdown: Data-Dense UI That Feels Simple*
   https://www.925studios.co/blog/whoop-design-breakdown
   Dùng cho: một con số chính, mở chi tiết 3 tầng, hệ 3 màu có nghĩa, số chính ~72pt, tránh thuật ngữ.
5. **[5] (C)** Sensai — *Garmin Body Battery vs WHOOP Recovery vs Oura Readiness (2026)*
   https://www.sensai.fit/blog/garmin-body-battery-vs-whoop-recovery-vs-oura-readiness-how-calculated-2026
   Dùng cho: thang điểm (WHOOP 0–100%, Oura 0–100, Garmin 5–100); ngưỡng WHOOP xanh ≥ 67%, vàng 34–66%, đỏ ≤ 33%.
6. **[6] (B)** Wareable — *Garmin Body Battery explained*
   https://www.wareable.com/garmin/garmin-body-battery-explained-how-it-works-8734
   Dùng cho: ẩn dụ “đồng hồ nhiên liệu”, tên tính năng Body Battery.
7. **[7] (B)** Gadgets & Wearables (21/09/2026) — *Readiness scores face the same evidence gap*
   https://gadgetsandwearables.com/2026/09/21/wearable-readiness-scores-science/
   Dùng cho: rất ít hãng công bố bằng chứng cho con số readiness cuối cùng.
8. **[8] (C)** Sahha — *How Is a Readiness Score Calculated?*
   https://sahha.ai/blog/how-readiness-scores-are-calculated/
   Dùng cho: các hãng không công bố công thức tính điểm.
9. **[9] (A)** Hsu et al. (2025) — *Personalized interventions for behaviour change: a scoping review of JITAIs*, British Journal of Health Psychology
   https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjhp.12766
   Dùng cho: định nghĩa JITAI.
10. **[10] (A)** JMIR Human Factors (2025) — *Personalized Intervention Criteria in a Mobile JITAI for Physical Activity* (pilot)
    https://humanfactors.jmir.org/2025/1/e66750
    Dùng cho: tiêu chí nhắc theo từng người hiệu quả hơn tiêu chí chung (thử nghiệm quy mô nhỏ).
11. **[11] (A)** *Intrinsic motivations in health and fitness app engagement: a mediation model of entertainment* (PMC)
    https://pmc.ncbi.nlm.nih.gov/articles/PMC11907615/
    Dùng cho: khảo sát 2.869 người dùng tại Việt Nam; yếu tố thú vị là cầu nối, thử thách và tò mò dự báo mạnh nhất.
12. **[12] (B)** Mobility Foresights — *Vietnam Fitness and Health Apps Market 2031*
    https://mobilityforesights.com/product/vietnam-fitness-and-health-apps-market
    Dùng cho: 3,8 tỷ USD (2025) → 12,7 tỷ USD (2031), CAGR 22,1%.
13. **[13] (B)** Accessibility Checker — *The Designer’s Guide to Dark Mode Accessibility*
    https://www.accessibilitychecker.org/blog/dark-mode-accessibility/
    Dùng cho: 30–60% người có loạn thị; hiện tượng loá viền chữ khi tương phản cao.
14. **[14] (B)** Smashing Magazine (04/2025) — *Inclusive Dark Mode*
    https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/
    Dùng cho: tránh nền đen tuyền; chữ sáng trên nền tối có thể nhoè viền.
15. **[15] (B)** Nielsen Norman Group — *Executing UX Animations: Duration and Motion Characteristics*
    https://www.nngroup.com/articles/animation-duration/
    Dùng cho: ~100 ms phản hồi đơn giản, 200–300 ms thay đổi lớn, 500 ms bắt đầu thấy chậm.
16. **[16] (B)** Apple Developer — *Reduced Motion evaluation criteria*
    https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/
    Dùng cho: tắt/thay hiệu ứng chiều sâu, xoay, nhiều trục khi bật Reduce Motion.
17. **[17] (B)** Nielsen Norman Group — *Why You Only Need to Test with 5 Users*
    https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/
    Dùng cho: 5 người thử tìm ra khoảng 85% vấn đề về dễ dùng.
18. **[18] (B)** W3C — *WCAG 2.1, Understanding 1.4.3 Contrast (Minimum)*
    https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
    Dùng cho: mức tương phản tối thiểu 4,5:1 và công thức tính tỉ lệ tương phản.

**Trong code dự án (‹…›)**

- `src/lib/theme.ts`, `src/lib/constants.ts`, `src/services/cleanup/cleanupService.ts`, `src/data/db/schema.ts`
- `src/screens/HomeScreen.tsx`, `src/navigation/mainTabs.ts`, `src/navigation/TabSwipe.tsx`
- `src/components/MasterBattery.tsx`, `src/components/ui/BottomSheet.tsx`, `src/components/ui/CollapsibleSection.tsx`
- `src/domain/food/foodSuggestions.ts`, `src/store/chargeEffectStore.ts`, `src/lib/encryption.ts`, `src/domain/modes/modeDefinitions.ts`
- `docs/01-vision-and-features.md`, `docs/04-roadmap.md`, `.ai/skills/mobile-ui-density.md`, `.claude/agents/data-ml.md`

---

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 26/09/2026 | 1 | Báo cáo nghiên cứu: hiện trạng, xu hướng, đề xuất, prompt agent, 18 nguồn có trích dẫn. |
| 26/09/2026 | 2 | Triển khai Đợt 0–3 (mục 10: đã làm, đánh giá, khó khăn, rủi ro, checklist). Thêm mục Đính chính (4 điểm), ký hiệu 💡/❓. |

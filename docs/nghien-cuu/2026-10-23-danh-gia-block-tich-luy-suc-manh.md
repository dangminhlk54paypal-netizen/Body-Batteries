# Đánh giá block "High-Volume Strength Accumulation" (07.09–25.10.2026) và trình độ người tập

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Bảng kế hoạch Excel chủ dự án gửi (ảnh chụp), 4 bài: bench thi đấu, squat, bench chạm ngực (TnG), deadlift |
| Nhánh khảo sát | `ui-upgrade` (sau commit `4ef9d89`) — chỉ dùng để đối chiếu với nhật ký của chủ dự án và quy tắc prime trong app |
| Mục tiêu | Phân tích cấu trúc kế hoạch, ước lượng sức mạnh và xếp hạng người tập so với chuẩn có nguồn |

**Chú giải:** `[n]` nguồn web số n · `[Mã: file]` rút từ code dự án · `[Nội bộ: file]` tài liệu nội bộ ·
💡 nhận định của người viết · ❓ chưa kiểm chứng. Mọi nguồn truy cập ngày 2026-10-23.

**Thuật ngữ nhanh:** *TM* (training max) = mức tạ gốc để tính % · *single* = 1 rep nặng · *back-off* = các set nhẹ hơn
sau single · *e1RM* = 1RM ước tính từ set nhiều rep · *taper* = giảm khối lượng trước ngày test/thi.

## Tóm tắt

1. **Đây không phải kế hoạch của bạn.** Nhật ký Block 0–2 của bạn: bench ~100 kg, deadlift test 155 kg, nặng 77 kg
   [Mã: [ownerNotesImport.ts](../../src/domain/training/ownerNotesImport.ts)]. Người trong ảnh mạnh hơn nhiều:
   TM squat 200 / bench 117,5 / deadlift 250 → **tổng ≈ 567,5 kg**, tuần 6 nhắm tới 587,5 kg 💡.
2. **Cấu trúc:** mỗi tuần 1 single nặng (92–102% TM) + back-off 2–6 rep (78–94% TM). % tăng ~2 điểm/tuần, rep giảm dần
   5 → 2. Đây là tuyến tính "tạ lên, khối lượng xuống", giống mô hình kinh điển 💡.
3. **Tên gọi "Accumulation" chưa khớp nội dung.** Theo định nghĩa phổ biến, block tích luỹ là volume cao, cường độ
   *vừa* [12]. Block này nặng (single 96–100% TM ở deadlift tuần 2–4) — gần với block sức mạnh/chuyển hoá hơn 💡.
4. **Trình độ:** khoảng **trung cấp cao → nâng cao** trong số người tập gym. Deadlift là điểm mạnh nhất, bench là điểm
   yếu tương đối. Nhưng **cân nặng không có trong bảng**, nên điểm IPF GL dao động **70–86** tuỳ cân nặng 75–105 kg
   [2] 💡. Cần biết cân nặng để chốt.
5. **Rủi ro chính:** deadlift quá nặng và quá dày (single 98–100% TM rồi 5×4 ở 84–86%), tuần 6 lại tăng volume sau
   mini-taper. Bench tuần 5 không giảm volume. Gợi ý: ghi RPE cho mọi single, giảm deadlift tuần 3–4 và tuần 6 💡.

## Đính chính

| Trước đây / nguồn khác nói | Nguồn gốc nói | Nguồn |
|---|---|---|
| Bản PDF hệ số IPF GL ghi hằng số C (nam, Classic 3 môn) = **0,09210** | Mã OpenPowerlifting dùng **0,009210**. Chỉ giá trị này cho ra ví dụ 700 kg / 90 kg = 93,06 điểm (đã tự tính lại). PDF có lỗi đánh máy | [1] [2] |
| Tiêu đề bảng gọi đây là block "Accumulation" | Accumulation = "high-volume, moderate-intensity", 2–6 tuần | [12] |
| Bảng ghi 07.09–25.10 nhưng chỉ có 6 cột tuần | 07.09 (thứ Hai) → 25.10 (Chủ nhật) = **49 ngày = 7 tuần**. Có thể có 1 tuần nghỉ/test không ghi ❓ | tự tính |

## 1. Kế hoạch nói gì (quy ra % TM)

Single in đậm là mức nặng nhất trong tuần. `(…?)` trong bảng gốc = lần thử PR tuỳ cảm giác.

| Bài (TM) | W1 | W2 | W3 | W4 | W5 mini-taper | W6 |
|---|---|---|---|---|---|---|
| Bench thi đấu (117,5) | **94%** · 5×5 @81% | — · 5×5 @83% | **96%** · 5×4 @85% | **96%** · 5×3 @87% | **98%** · 5×3 @89% | **102%** (104%?) · 5×2 @94% |
| Squat (200) | **93%** · 5×5 @78% | **95%** · 5×5 @80% | **98%** · 5×4 @83% | **99%** · 5×4 @85% | **95%** · 4×3 @88% | **100%** (103%?) · 4×3 @90% |
| Bench TnG (122,5) | **94%** · 5×6 @82% | **94%** · 5×5 @84% | **96%** · 5×4 @86% | **96%** · 5×3 @88% | **98%** · 5×3 @90% | **102%** (104%?) · 5×2 @94% |
| Deadlift (250) | **92%** · 4×5 @80% | **96%** · 4×5 @82% | **98%** · 5×4 @84% | **100%** · 5×4 @86% | **96%** · 3×3 @88% | **98%** (104%?) · 4×4 @90% |

**Số rep back-off mỗi tuần** (đo khối lượng):

| Bài | W1 | W2 | W3 | W4 | W5 | W6 | W4→W5 |
|---|---|---|---|---|---|---|---|
| Bench thi đấu | 25 | 25 | 20 | 15 | 15 | 10 | **0%** |
| Squat | 25 | 25 | 20 | 20 | 12 | 12 | −40% |
| Bench TnG | 30 | 25 | 20 | 15 | 15 | 10 | **0%** |
| Deadlift | 20 | 20 | 20 | 20 | 9 | **16** | −55%, rồi W6 tăng lại +78% |

**Thực tế đã ghi (chỉ tuần 1):** bench thi đấu 110×1, rồi 95 × 5-5-5-5-**6** (set cuối dư 1 rep).

## 2. Điểm mạnh của kế hoạch

- **Đúng chuyên môn.** Toàn bài thi đấu và biến thể gần (TnG). Single nặng mỗi tuần = luyện kỹ năng ở tạ gần tối đa 💡.
- **Tuyến tính rõ ràng.** Tạ lên đều, rep giảm đều. Mô hình "volume cao, cường độ thấp → volume giảm, cường độ tăng" là
  kiểu kinh điển, đã được tổng hợp trong báo cáo trước [Nội bộ: [tinh-tien-tuyen-tinh-block](2026-10-23-tinh-tien-tuyen-tinh-block.md)].
- **Khối lượng khá.** 4–5 set/bài/buổi, bench 2 buổi/tuần. Meta-analysis: nhiều set/tuần cho sức mạnh tăng hơn ít set
  (ES chênh 0,18) [16].
- **Có taper trước tuần test.** Squat −40%, deadlift −55% ở tuần 5 vẫn giữ cường độ 88–89%. Khớp hướng dẫn: giảm volume
  **30–70%**, giữ cường độ **≥ 85% 1RM**, trong **1–2 tuần** [9]. VĐV powerlifting ưu tú ở New Zealand giảm trung bình
  **58,9%** volume [8].
- **PR có dấu "?"** = thử tuỳ cảm giác ngày đó, không bắt buộc. Cách làm an toàn 💡.
- **TM có vẻ sát thực tế.** Set 95×6 nếu là gần tối đa thì e1RM ≈ 114 kg theo Epley (công thức app đang dùng) [Nội bộ: [08-powerlifting-engine.md](../08-powerlifting-engine.md)];
  phương trình Reynolds từ 5RM cho ≈ 108 kg [15]. Set chưa tới thất bại nên 1RM thật ≥ mức này → TM 117,5 hợp lý 💡.

## 3. Điểm cần xem lại

| Vấn đề | Vì sao | Gợi ý 💡 |
|---|---|---|
| **Deadlift quá dày** | Single 96–100% TM ở W2–W4 rồi 5×4 ở 82–86%. VĐV ưu tú nói deadlift **hồi phục chậm nhất** [8] | Single W3–W4 giữ ≤ 92–95%; hoặc 4×4 thay 5×4 |
| **W6 tăng volume deadlift** sau mini-taper | Thử 260 (104%) rồi còn 4×4 @90%. Taper nên giảm volume, không tăng lại [9] | Nếu thử PR thì bỏ hoặc cắt nửa back-off |
| **Bench không taper ở W5** | 15 rep W4 = 15 rep W5. Squat/deadlift có giảm, bench thì không | 3–4×3 thay 5×3 ở W5 |
| **Single quá nặng cho block "tích luỹ"** | Định nghĩa phổ biến: tích luỹ = cường độ vừa [12]. Single 92–102% mỗi tuần gần với block chuyển hoá. Mô hình block cũng còn tranh cãi [10][11] | Đổi tên cho đúng, hoặc hạ single về ~85–90% ở W1–W3 |
| **Chưa có RPE** | Thang RPE theo rep còn dư (RPE 9 = dư 1 rep) giúp chỉnh tạ hằng ngày [13] | Ghi RPE mỗi single: ≥ 9,5 ở mức ≤ 96% TM → hạ TM 2,5 kg |
| **Chỉ ghi thực tế tuần 1** | Hôm nay 23.10, block sắp hết. Không có dữ liệu W2–W6 thì không biết TM có đúng | Ghi đủ để làm block sau |

**So với app:** quy tắc prime của app gợi ý single **82–92% 1RM** [Nội bộ: [08-powerlifting-engine.md §11](../08-powerlifting-engine.md)].
Người này dùng **92–102% TM**, nặng hơn rõ. Đó là lựa chọn của người tập lâu, không phải chuẩn nghiên cứu 💡.

## 4. Đánh giá sức mạnh

### 4.1 Điểm quy đổi theo cân nặng

Bảng không có cân nặng, nên tính theo 5 mức giả định. Tổng = TM (567,5) và mục tiêu tuần 6 (587,5).
Công thức IPF GL, DOTS, Wilks lấy từ mã nguồn OpenPowerlifting [2][3][4]; IPF GL đối chiếu bản PDF [1].

| Cân nặng | IPF GL (567,5 → 587,5) | DOTS | Wilks |
|---|---|---|---|
| 75 kg | 82,7 → 85,7 | 407 → 422 | 404 → 419 |
| 83 kg | 78,6 → 81,3 | 383 → 397 | 379 → 392 |
| 93 kg | 74,2 → 76,9 | 361 → 374 | 357 → 369 |
| 105 kg | 70,1 → 72,5 | 342 → 354 | 339 → 351 |
| 120 kg | 66,0 → 68,3 | 326 → 337 | 326 → 338 |

**Mốc so sánh:** 11 VĐV raw ưu tú New Zealand có Wilks tốt nhất **431,9 ± 43,9** [8]. Người này chỉ chạm vùng đó nếu
nặng khoảng 75 kg; nếu ≥ 93 kg thì thấp hơn rõ 💡.

### 4.2 Từng bài so với chuẩn Strength Level

Strength Level: dữ liệu tự nhập của người dùng app (≈ 9,9 triệu kết quả nam). *Trung cấp* = mạnh hơn 50%, *Nâng cao* =
mạnh hơn 80%, *Ưu tú* = mạnh hơn 95% người dùng [5]. Đây là người tập gym, **không phải VĐV thi đấu** 💡.

| Cân nặng | Squat 200 [6] | Bench 117,5 [5] | Deadlift 250 [7] |
|---|---|---|---|
| 75 kg | Ưu tú (196) | Nâng cao (117) | Vượt ưu tú (228) |
| 85 kg | Nâng cao+ (177–216) | Trung cấp+ (104–130) | Ưu tú (250) |
| 95 kg | Nâng cao (194–235) | Trung cấp (115–143) | Nâng cao+ (224–270) |
| 105 kg | Trung cấp+ (170–211) | Dưới trung cấp (125) | Nâng cao+ (241–289) |

Số trong ngoặc = mốc của Strength Level ở cân nặng đó.

### 4.3 Nhận xét người tập

- **Hồ sơ "deadlift mạnh":** deadlift/squat = 1,25; bench/squat = 0,59 (tự tính). Ở cột *Nâng cao* của Strength Level,
  85 kg, các tỉ lệ là 1,16 và 0,73 [5][6][7]. Nghĩa là deadlift trội, bench tụt so với hai bài kia 💡.
- **Bench TnG hơn bench dừng 5 kg (4,3%).** Hợp lý: dừng ở ngực bỏ đà nảy, kết quả ổn định hơn — trong đo tốc độ–tải, sai số của
  kiểu không dừng cao hơn kiểu dừng 2 giây 37,9% ở bench [14]. Chênh 4% là mức thường gặp nhưng chưa có nghiên cứu đo trực tiếp ❓.
- **Trình độ lập kế hoạch:** biết dùng TM, top single + back-off, taper, thử PR tuỳ cảm giác → người tập **nhiều năm**,
  hiểu phương pháp 💡. TM kiểu 5/3/1 thường ≈ 90% 1RM (qua kết quả tìm kiếm, chưa đọc sách gốc) [17] ❓; ở đây single
  100–104% TM cho thấy TM ≈ 1RM thật, không phải 90%.
- **Tổng kết 💡:** nếu nặng ~83 kg → nâng cao trong số người tập gym, đủ thi giải phong trào/khu vực, chưa tới mức tuyển
  ưu tú. Điểm cần cải thiện nhất là bench.

## 5. So với bạn (chủ dự án)

| | Người trong ảnh | Bạn (cuối Block 2, 77 kg) |
|---|---|---|
| Bench | TM 117,5 | 100 (102,5 hỏng ngày 28.08) |
| Deadlift | TM 250 | 155 (test 30.08) |

Nguồn số liệu của bạn: [Mã: [ownerNotesImport.ts](../../src/domain/training/ownerNotesImport.ts)].
💡 Không nên chép nguyên kế hoạch này. Có thể mượn **khung %**: single ~92–96% + back-off 78–90%, rep 5 → 2, mini-taper
tuần 5. Nhưng cho deadlift nhẹ hơn, và tính % theo TM của bạn.

## 6. Các quyết định cần chủ dự án chốt

| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Người này nặng bao nhiêu kg? | Gửi cân nặng để chốt điểm GL và mức xếp hạng (mục 4) |
| Có muốn app hỗ trợ kiểu "top single 92–102% TM"? | App hiện giới hạn prime 82–92%. Có thể thêm tuỳ chọn "single nặng" cho người tập lâu |
| Có cần làm bản kế hoạch tương tự cho bạn? | Có thể dựng bằng trình tạo block, dùng TM của bạn |

## Tài liệu tham khảo

**IPF / OpenPowerlifting (công thức điểm)**
- [1] IPF. *The IPF GL Coefficients for Relative Scoring* (hiệu lực 01.03.2020–31.12.2023), bản PDF lưu trên trang bên thứ
  ba. https://benchpresschampion.com/FORMULES/FormuleGL.pdf — Dùng cho: dạng công thức GL = 100 / (A − B·e^(−C·BW)),
  hằng số A, B; phát hiện lỗi đánh máy C. Truy cập 2026-10-23.
- [2] OpenPowerlifting, `goodlift.rs`. https://gitlab.com/openpowerlifting/opl-data/-/raw/main/crates/coefficients/src/goodlift.rs —
  Dùng cho: hằng số nam Classic (1199.72839, 1025.18162, 0.009210), cách tính điểm. Truy cập 2026-10-23.
- [3] OpenPowerlifting, `dots.rs`. https://gitlab.com/openpowerlifting/opl-data/-/raw/main/crates/coefficients/src/dots.rs —
  Dùng cho: đa thức DOTS nam, giới hạn cân nặng 40–210 kg. Truy cập 2026-10-23.
- [4] OpenPowerlifting, `wilks.rs`. https://gitlab.com/openpowerlifting/opl-data/-/raw/main/crates/coefficients/src/wilks.rs —
  Dùng cho: đa thức Wilks nam. Truy cập 2026-10-23.

**Strength Level (chuẩn người tập gym, nguồn phụ)**
- [5] Bench press standards. https://strengthlevel.com/strength-standards/bench-press/kg — Dùng cho: mốc bench theo cân
  nặng, định nghĩa 5/20/50/80/95%, cỡ dữ liệu. Truy cập 2026-10-23.
- [6] Squat standards. https://strengthlevel.com/strength-standards/squat/kg — Dùng cho: mốc squat. Truy cập 2026-10-23.
- [7] Deadlift standards. https://strengthlevel.com/strength-standards/deadlift/kg — Dùng cho: mốc deadlift. Truy cập 2026-10-23.

**Nghiên cứu (tóm tắt đọc qua Europe PMC API)**
- [8] Pritchard HJ và cs. *Tapering Practices of New Zealand's Elite Raw Powerlifters*. J Strength Cond Res 2016;30(7):1796–1804.
  https://pubmed.ncbi.nlm.nih.gov/26670988/ — Dùng cho: Wilks 431,9 ± 43,9; giảm volume 58,9%; deadlift hồi phục chậm nhất.
  Truy cập 2026-10-23.
- [9] Travis SK và cs. *Tapering and Peaking Maximal Strength for Powerlifting Performance: A Review*. Sports 2020.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7552788/ (đọc toàn văn qua https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7552788/fullTextXML)
  — Dùng cho: giảm volume 30–70%, cường độ ≥ 85%, taper 1–2 tuần. Truy cập 2026-10-23.
- [10] Issurin VB. *New horizons for the methodology and physiology of training periodization*. Sports Med 2010;40(3):189–206.
  https://pubmed.ncbi.nlm.nih.gov/20199119/ — Dùng cho: block = tải tập trung vào ít năng lực, phát triển lần lượt.
  Truy cập 2026-10-23.
- [11] Kiely J. *Block Periodization: New horizon, or a false dawn?* (thư gửi Sports Med, bản thảo).
  https://knowledge.lancashire.ac.uk/id/eprint/5139/1/ADIS-S-10-00899.pdf — Dùng cho: block periodization là "premature
  and unsupported". Truy cập 2026-10-23.
- [12] HPRC (USUHS). *Plan your workouts with block periodization*.
  https://www.hprc-online.org/physical-fitness/training-performance/plan-your-workouts-block-periodization — Dùng cho:
  định nghĩa accumulation/transmutation/realization (nguồn phụ). Truy cập 2026-10-23.
- [13] Zourdos MC và cs. *Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve*. J Strength Cond
  Res 2016. https://pubmed.ncbi.nlm.nih.gov/26049792/ — Dùng cho: RPE 10 = 0 RIR, RPE 9 = 1 RIR; dùng để chỉnh tải hằng
  ngày. Truy cập 2026-10-23.
- [14] Pallarés JG và cs. *Imposing a pause between the eccentric and concentric phases increases the reliability of
  isoinertial strength assessments*. J Sports Sci 2014. https://pubmed.ncbi.nlm.nih.gov/24575723/ — Dùng cho: sai số kiểu
  không dừng cao hơn 37,9% ở bench. Truy cập 2026-10-23.
- [15] Reynolds JM và cs. *Prediction of one repetition maximum strength from multiple repetition maximum testing and
  anthropometry*. J Strength Cond Res 2006. https://pubmed.ncbi.nlm.nih.gov/16937972/ — Dùng cho: 1RM = 1,1307 × 5RM + 0,70
  (bench). Truy cập 2026-10-23.
- [16] Ralston GW và cs. *The Effect of Weekly Set Volume on Strength Gain: A Meta-Analysis*. Sports Med 2017.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5684266/ — Dùng cho: nhiều set/tuần tăng sức mạnh hơn (ES 0,18). Truy cập 2026-10-23.

**Nguồn phụ, chưa mở trang gốc**
- [17] BarBend về 5/3/1 (qua kết quả tìm kiếm). https://barbend.com/?p=152796 — Dùng cho: TM ≈ 90% 1RM. Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu: phân tích % TM, volume, taper, điểm GL/DOTS/Wilks theo 5 mức cân nặng, so với Strength Level và nhật ký chủ dự án |

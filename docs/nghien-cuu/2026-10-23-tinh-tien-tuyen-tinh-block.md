# Khung "Tịnh tiến" cho block powerlifting — bằng chứng và cách làm trong app

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Tăng tạ tuyến tính theo tuần (người mới), block tiếp theo từ block trước (người tập lâu) |
| Nhánh khảo sát | `ui-upgrade` (sau commit `4ef9d89`, cùng các thay đổi chưa commit của ngày 23.10) |
| Mục tiêu | Kiểm chứng khung chủ dự án đề xuất bằng nghiên cứu, rồi đưa vào trình tạo block |

**Chú giải:** `[n]` nguồn web số n · `[Mã: file]` rút từ code dự án · 💡 nhận định của người viết · ❓ chưa kiểm chứng.
Mọi nguồn truy cập ngày 2026-10-23.

## Tóm tắt

1. ACSM 2009 khuyên tăng tạ **2–10%** khi làm được dư 1–2 rep so với kế hoạch ở **2 buổi liên tiếp**. Mức thấp dành cho bài
   nhóm cơ nhỏ, mức cao cho bài nhóm cơ lớn [1]. Khung của chủ dự án (+5%/tuần, hoặc +2,5%) nằm gọn trong khoảng này 💡.
2. Mô hình tuyến tính kinh điển là volume cao, cường độ thấp lúc đầu, rồi volume giảm dần khi cường độ tăng [1]. Khung
   4×5 → 3×2 → test, đi từ 70% lên 95%, đúng dạng đó 💡.
3. Tuyến tính và dao động (undulating) **hiệu quả ngang nhau** khi so trực tiếp [3]. Khi cân bằng volume, dao động nhỉnh
   hơn nhưng **chỉ ở người đã tập** (ES 0,61); ở người chưa tập thì **không khác** (ES 0,06) [5]. Vì vậy 💡 "Tịnh tiến" hợp
   làm khung cho người mới, còn người tập lâu vẫn có kiểu "Bình thường" (dao động theo ngày) sẵn trong app
   [Mã: [blockEngine.ts](../../src/domain/energy/blockEngine.ts)].
4. Tập có chu kỳ (periodized) tăng 1RM hơn tập không chu kỳ (ES 0,43 [4]; ES 0,31 khi cân volume [5]). ACSM 2026 thận
   trọng hơn: chu kỳ "ít quan trọng hơn từng nghĩ" với người khoẻ mạnh, và tăng tiến không bắt buộc mới có lợi [2].
5. Lưu ý cho người mới: ACSM 2009 khuyên tải **60–70% 1RM cho 8–12 rep**, người nâng cao mới xoay vòng 80–100% [1]. Khung
   70% × 5 rep vì thế nặng hơn khuyến nghị cho người mới 💡. App ghi chú điều này ngay dưới khung và để người dùng tự
   hạ % tuần 1.

## 1. Khung chủ dự án đề xuất, đối chiếu với nguồn

| Tuần | Bài thẳng (chạm ngực) | Biến thể (dừng ngực) | Volume | Đối chiếu |
|---|---|---|---|---|
| W1 | 70% | 65% | 4×5 | Trong vùng 60–80% thường dùng [1] |
| W2 | 75% | 70% | 4×4 | Bước +5% nằm trong 2–10% [1] |
| W3 | 80% | 75% | 3×4 | |
| W4 | 85% | 80% | 3×3 | |
| W5 | 90% | 85% | 3×2 | 80–100% cho người nâng cao [1] |
| W6 | ~95% | | Test rep-max | 💡 Người dùng tự quyết có test hay không |

- Bước tăng có thể là **% 1RM** hoặc **kg** cố định mỗi tuần (ví dụ +2,5 kg). Cả hai đều có trong app.
- Mức biến thể thấp hơn 5 điểm % là quy ước chủ dự án đặt ra (dừng 65% bên cạnh chạm ngực 70%), không lấy từ nghiên cứu 💡.
- Số liệu NSCA kiểu "2,5–5% thân trên / 5–10% thân dưới" chỉ thấy qua tài liệu ôn thi, chưa mở được sách gốc ❓.

## 2. Đã làm trong app

- **Kiểu tập thứ 5 "Tịnh tiến"** ở bước Mục tiêu của trình tạo block
  [Mã: [LinearProgressionEditor.tsx](../../src/components/training/LinearProgressionEditor.tsx)]:
  - Chỉnh được: % tuần 1, bước tăng mỗi tuần (% hoặc kg), mức nhẹ hơn của biến thể, và **set × rep của từng tuần**.
  - Có nút "Tuần cuối test", "＋1 / −1 set mọi tuần" và "Mặc định".
- **Engine** [Mã: [linearProgression.ts](../../src/domain/energy/linearProgression.ts),
  [blockEngine.ts](../../src/domain/energy/blockEngine.ts)]:
  - Tạ = 1RM × % của tuần (trừ mức nhẹ hơn nếu là biến thể), làm tròn 2,5 kg. Chế độ kg thì cộng thêm kg mỗi tuần.
  - Tuần test là 1×1. Deload (nếu bật) = tuần làm việc cuối −10 điểm % và một nửa số set, cùng quy tắc với các kiểu khác.
  - Gợi ý vẫn chỉ là gợi ý: sau khi tạo, mọi ô sửa được (✎, hoặc lưới "Theo bài").
- **Block tiếp theo từ block trước** (bước Hồ sơ):
  - Lấy 1RM của block trước theo một trong các cách: giữ nguyên, **+5%** (làm tròn xuống 2,5 kg), **+5 kg**, hoặc theo
    lịch sử tập (e1RM).
  - Khung tịnh tiến của block trước được chép sang. "＋1 set mọi tuần" = cách "giữ tạ, tăng volume để tăng sức mạnh nền".

## 3. Các quyết định cần chủ dự án chốt

| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Người mới mặc định bắt đầu từ bao nhiêu %? | Giữ 70% như khung của bạn, có ghi chú ACSM 60–70% [1]; hoặc hạ xuống 65% khi 1RM là số ước tính |
| Mức +5% mỗi block có hợp với người tập lâu? | Hợp với 2–10% [1], nhưng người tập lâu tiến chậm hơn; nên dựa vào kết quả test cuối block (lịch sử tập) hơn là cộng cứng |
| Tuần test có bắt buộc? | Không; để người dùng tự bật hoặc tắt |

## Tài liệu tham khảo

**ACSM**
- [1] Ratamess NA, Alvar BA, Evetoch TK, Housh TJ, Kibler WB, Kraemer WJ, Triplett NT. *Progression Models in Resistance
  Training for Healthy Adults* (ACSM Position Stand). Med Sci Sports Exerc, 2009, tr. 687–708. Bản PDF đã đọc:
  https://sfu.ca/~ryand/kin343/ACSMresistance.pdf (bản lưu trên trang của một trường đại học, nguồn phụ của bài gốc).
  Dùng cho: quy tắc 2–10% + 2 buổi liên tiếp, 60–70% cho người mới, 80–100% cho người nâng cao, mô tả mô hình tuyến
  tính. Truy cập 2026-10-23.
- [2] ACSM Position Stand. *Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in
  Healthy Adults: An Overview of Reviews*. Med Sci Sports Exerc 2026;58(4):851–872.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823 — Dùng cho: tăng tiến không bắt buộc, chu kỳ ít quan trọng hơn từng
  nghĩ, tập ≥ 2 buổi/tuần. Truy cập 2026-10-23.

**Meta-analysis** (abstract đọc qua Europe PMC REST API, vì trang PubMed đòi bật cookie; mỗi dòng ghi đúng URL API đã gọi)
- [3] Harries SK, Lubans DR, Callister R. *Systematic review and meta-analysis of linear and undulating periodized
  resistance training programs on muscular strength*. J Strength Cond Res 2015. doi:10.1519/jsc.0000000000000712.
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:25268290%20AND%20SRC:MED&resultType=core&format=json (PMID 25268290) — Dùng cho: 17 nghiên cứu, 510 người, tuyến tính và dao động không khác về
  sức mạnh thân trên/dưới. Truy cập 2026-10-23.
- [4] Williams TD, Tolusso DV, Fedewa MV, Esco MR. *Comparison of Periodized and Non-Periodized Resistance Training on
  Maximal Strength: A Meta-Analysis*. Sports Med 2017. doi:10.1007/s40279-017-0734-y.
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:28497285%20AND%20SRC:MED&resultType=core&format=json (PMID 28497285) — Dùng cho: 18 nghiên cứu, có chu kỳ > không chu kỳ (ES 0,43). Truy cập
  2026-10-23.
- [5] Moesgaard L, Beck MM, Christiansen L, Aagaard P, Lundbye-Jensen J. *Effects of Periodization on Strength and Muscle
  Hypertrophy in Volume-Equated Resistance Training Programs*. Sports Med 2022. doi:10.1007/s40279-021-01636-1.
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:35044672%20AND%20SRC:MED&resultType=core&format=json (PMID 35044672) — Dùng cho: 35 nghiên cứu; có chu kỳ > không chu kỳ (ES 0,31); dao động >
  tuyến tính chỉ ở người đã tập (ES 0,61), không khác ở người chưa tập (ES 0,06). Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu, kèm phần đã làm trong app |

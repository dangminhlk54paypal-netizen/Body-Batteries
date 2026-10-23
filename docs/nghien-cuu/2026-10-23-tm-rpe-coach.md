# Training Max, ghi RPE và "huấn luyện viên RPE" cho block powerlifting

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Đổi tên bài theo cách gọi của chủ dự án, Training Max (TM) theo block, ghi RPE từng buổi, engine gợi ý tạ/volume từ RPE |
| Nhánh khảo sát | `ui-upgrade` (sau commit `4ef9d89`, cùng các thay đổi chưa commit của ngày 23.10) |
| Mục tiêu | Có nguồn cho từng quy tắc engine dùng, và sửa một nhận định sai trước đây về bench chạm ngực |

**Chú giải:** `[n]` nguồn web số n · `[Mã: file]` rút từ code dự án · 💡 nhận định của người viết · ❓ chưa kiểm chứng.
Mọi nguồn truy cập ngày 2026-10-23.

## Tóm tắt

1. **TM = 90% 1RM** là quy ước phổ biến (5/3/1); khoảng thường gặp là 80–90% [8]. App gợi ý TM = 90% × 1RM × hệ số
   biến thể, làm tròn xuống 2,5 kg. Người dùng tự sửa từng con số [Mã: [linearProgression.ts](../../src/domain/energy/linearProgression.ts)].
   Sách gốc của Wendler chưa mở được ❓.
2. **Thang RPE theo số rep còn dư (RIR)** dùng được cho cả người mới lẫn người đã tập [3]. Nhưng người mới đánh giá
   thấp hơn ở mức tối đa (RPE 9,35 so với 9,86 ở người đã tập khi nâng 1RM) [3].
3. RPE **sai nhiều khi còn xa thất bại**: sai trung bình 2,05 rep ở RPE 9, nhưng 5,15 rep ở RPE 5. Set càng nhiều rep
   càng kém chính xác; số năm tập không giúp dự đoán tốt hơn [4]. 💡 Vì vậy engine **không phản ứng theo một buổi
   lẻ**, mà cần **2 buổi liên tiếp** lệch cùng một hướng.
4. Quy tắc 2 buổi liên tiếp và mức tăng **2–10%** lấy từ ACSM 2009 [1]. Bước của app (+2,5 kg bench, +5 kg squat/deadlift)
   nằm trong khoảng đó với mức tạ thông thường 💡.
5. Tải theo RPE và tải theo %1RM **đều hiệu quả**; RPE có thể cho lợi thế 1RM nhỏ [5]. Meta-analysis mạng 2025 so sánh
   các cách tự điều chỉnh (APRE, RPE, theo vận tốc) [7].
6. Volume và cơ bắp có quan hệ liều–đáp ứng: mỗi set/tuần thêm vào tăng ES 0,023 (+0,37%); nhóm ≥ 10 set/nhóm cơ/tuần
   tăng nhiều hơn nhóm < 5 [6]. 💡 Engine chỉ đề nghị "＋1 set" khi bài đó còn dưới 10 set làm việc/tuần.

## Đính chính

- **Sai trước đây:** app từng ghi bench **chạm ngực đẩy luôn (TnG)** là kỹ thuật chuẩn thi đấu (trong comment code và lời
  giải thích ở cả 3 ngôn ngữ).
- **Đúng theo luật IPF:** bench thi đấu bắt buộc **giữ thanh đòn bất động trên ngực**, rồi trọng tài chính mới hô
  "Press" [2]. Vì vậy **Comp Bench = bench dừng ngực**, còn TnG Bench là biến thể tập luyện.
- **Đã sửa:** comment trong [powerliftingVariations.ts](../../src/lib/powerliftingVariations.ts) và lời giải thích
  TnG/Comp trong `vi.ts`, `en.ts`, `de.ts`.

## 1. Đổi tên bài (theo chủ dự án)

| Mã biến thể | Tên mới | Tên cũ (vẫn tìm được) |
|---|---|---|
| `bench_paused` | Comp Bench | Bench dừng ngực |
| `bench_press` | TnG Bench | Bench chạm ngực |
| `squat` / `deadlift` | Squat / Deadlift | — |
| các biến thể khác | Paused Squat, Close-grip Bench, Incline Bench, Paused/Deficit Deadlift | tên tiếng Việt cũ |

- Tên cũ giữ ở trường `aka`, nên ô tìm kiếm trong lịch tập vẫn khớp [Mã: [BlockScheduleEditor.tsx](../../src/components/training/BlockScheduleEditor.tsx)].
- File Excel ghi đúng dạng chủ dự án gửi: **"Planned Comp Bench (TM = 117,5)"** và **"Actual Comp Bench"**. Dòng Actual
  ghi thêm RPE nếu có [Mã: [trainingBlockPrintSheet.ts](../../src/services/export/trainingBlockPrintSheet.ts)].

## 2. Training Max

- **Bước "TM" mới** trong trình tạo block, chỉ hiện với kiểu "Tịnh tiến" [Mã: [BlockBuilderWizard.tsx](../../src/components/BlockBuilderWizard.tsx)]:
  - Mỗi biến thể trong lịch có một ô TM. Để trống là dùng gợi ý 90%.
  - Có chip "TM block trước" (giữ nguyên, +5%, +5 kg) cho người tập lâu.
- **Engine:** tạ tuần = TM × % của tuần. Biến thể có TM riêng thì dùng đủ %, không trừ mức nhẹ hơn
  [Mã: [blockEngine.ts](../../src/domain/energy/blockEngine.ts)].
- 💡 TM của chủ dự án (Comp 117,5 / TnG 122,5, tỉ lệ ≈ 0,96) cho thấy bench dừng ngực có thể gần TnG hơn hệ số 0,9
  app đang dùng. Hệ số này là ước lượng, chưa có nguồn ❓.

## 3. Ghi RPE và huấn luyện viên RPE

**Ghi RPE** [Mã: [RpeChips.tsx](../../src/components/training/RpeChips.tsx)]:
- Ngay trong ô kế hoạch (cả xem theo tuần lẫn lưới "Theo bài"): buổi đã tập có chip "RPE ?". Chạm vào để chọn 5–10, bước 0,5.
- Chạm lại số đã chọn để xoá. Dưới thang có dòng giải thích ngắn (10 = hết sức, 8 = còn 2 rep) [3].

**Quy tắc gợi ý** [Mã: [rpeCoach.ts](../../src/domain/energy/rpeCoach.ts)]:

| Điều kiện (2 buổi liên tiếp của cùng một bài) | Gợi ý | Nguồn |
|---|---|---|
| RPE thực ≤ mục tiêu − 1,5 | ＋2,5 kg (bench) / ＋5 kg (squat, deadlift) | 2–10%, 2 buổi liên tiếp [1] |
| như trên, và bài còn < 10 set/tuần | thêm lựa chọn "＋1 set" | liều–đáp ứng volume [6] |
| RPE thực ≥ mục tiêu + 1, hoặc ≥ 9,5 | −2,5 kg / −5 kg | 💡 giữ set làm việc xa thất bại |

- Ngưỡng "dễ" rộng hơn ngưỡng "khó" (1,5 so với 1) vì RPE thấp kém chính xác hơn [4] 💡.
- Buổi test (1×1) không tính.
- **Chỉ là gợi ý.** Không có gì đổi cho tới khi người dùng chạm "Áp dụng". Khi áp dụng, chỉ đổi các tuần **sau** buổi
  được ghi cuối cùng, và bỏ qua ngày/tuần nghỉ. "Bỏ qua" được nhớ lại, không hỏi lại.
- 💡 Các nghiên cứu RPE chủ yếu làm trên nam giới tuổi đại học đã tập [3][4]. Bằng chứng cho người mới hoàn toàn còn ít;
  quy tắc 2 buổi giảm rủi ro phản ứng nhầm.

## 4. Các quyết định đã chốt

| Câu hỏi | Chủ dự án chọn |
|---|---|
| Đổi tên những bài nào? | Đổi hết cho đồng bộ |
| TM gợi ý cho người mới? | 90% 1RM |
| Ghi RPE ở đâu? | Ngay trong ô kế hoạch |

Còn mở từ báo cáo trước: % tuần 1 mặc định khi 1RM là số ước tính (70% hay 65%), và tuần test có bật sẵn không.

## Tài liệu tham khảo

**Tổ chức / luật**
- [1] Ratamess NA và cs. *Progression Models in Resistance Training for Healthy Adults* (ACSM Position Stand). Med Sci
  Sports Exerc 2009. Bản PDF đã đọc: https://sfu.ca/~ryand/kin343/ACSMresistance.pdf (bản lưu trên trang trường đại
  học, nguồn phụ của bài gốc). Dùng cho: tăng 2–10% khi dư 1–2 rep ở 2 buổi liên tiếp. Truy cập 2026-10-23.
- [2] IPF. *Technical Rules Book 2026* (hiệu lực 01.03.2026, v3), mục Bench Press, luật 8.
  https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/2026_IPF_Technical_Rulebook__effective_01_March_2026__v3.pdf
  — Dùng cho: giữ thanh bất động trên ngực tới lệnh "Press". Truy cập 2026-10-23.

**Nghiên cứu** (abstract đọc qua Europe PMC REST API, vì trang PubMed đòi bật cookie; mỗi dòng ghi đúng URL đã gọi)
- [3] Ormsbee MJ và cs. *Efficacy of the Repetitions in Reserve-Based Rating of Perceived Exertion for the Bench Press in
  Experienced and Novice Benchers*. J Strength Cond Res 2019 (PMID 28301439).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:28301439%20AND%20SRC:MED&resultType=core&format=json
  — Dùng cho: thang RIR dùng được ở cả hai nhóm; RPE tại 1RM 9,86 so với 9,35; tương quan vận tốc–RPE r = 0,85. Truy cập 2026-10-23.
- [4] Zourdos MC và cs. *The Repetitions in Reserve-Based Rating of Perceived Exertion Scale: Accuracy of Prediction*.
  J Strength Cond Res 2021 (PMID 30747900).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:30747900%20AND%20SRC:MED&resultType=core&format=json
  — Dùng cho: sai 2,05 rep ở RPE 9 so với 5,15 rep ở RPE 5; nhiều rep thì kém chính xác; số năm tập không dự đoán. Truy cập 2026-10-23.
- [5] Helms ER và cs. *RPE vs. Percentage 1RM Loading in Periodized Programs Matched for Sets and Repetitions*. Front
  Physiol 2018 (PMID 29628895).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:29628895%20AND%20SRC:MED&resultType=core&format=json
  — Dùng cho: cả hai cách đều hiệu quả, RPE có thể nhỉnh 1RM. Truy cập 2026-10-23.
- [6] Schoenfeld BJ, Ogborn D, Krieger JW. *Dose-response relationship between weekly resistance training volume and
  increases in muscle mass*. J Sports Sci 2017 (PMID 27433992).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:27433992%20AND%20SRC:MED&resultType=core&format=json
  — Dùng cho: mỗi set/tuần thêm ES 0,023 (+0,37%); các nhóm < 5, 5–9, ≥ 10 set. Truy cập 2026-10-23.
- [7] Huang và cs. Network meta-analysis các phương pháp tự điều chỉnh tải (APRE, RPE, VBRT). J Exerc Sci Fit 2025 (PMID 40791980).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:40791980%20AND%20SRC:MED&resultType=core&format=json
  — Dùng cho: bối cảnh so sánh các cách tự điều chỉnh. Truy cập 2026-10-23.
- Helms ER và cs. *Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance
  Training*. Strength Cond J 2016 (PMID 27531969).
  https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:27531969%20AND%20SRC:MED&resultType=core&format=json
  — Đọc tham khảo cách áp dụng thang RIR. Truy cập 2026-10-23.

**Nguồn phụ**
- [8] Lift Vault. *5/3/1 Training Max: definition and examples*.
  https://liftvault.com/resources/531-training-max-definition-examples/ — Dùng cho: TM thường 80–90% 1RM, mặc định 90%.
  Trang tổng hợp, không phải sách gốc ❓. Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu, kèm Đính chính về bench chạm ngực |

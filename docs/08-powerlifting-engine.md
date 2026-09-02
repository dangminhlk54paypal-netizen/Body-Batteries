# 08 — Powerlifting Training Block Engine: Cơ sở Khoa học & Thiết kế
**Ngày lập:** 2026-09-02
**Trạng thái:** Bản nghiên cứu chính thức (thay thế bản nháp trước đó) — mọi con số đều có trích dẫn nguồn ở mục 8.

> ⚠️ Đây là **công cụ tự lập kế hoạch tập luyện, KHÔNG phải chương trình huấn luyện chuyên nghiệp hay tư vấn y tế**. Các hằng số dưới đây là ước lượng dựa trên y văn thể thao phổ biến (population-average), cần điều chỉnh theo phản hồi cá nhân (RPE, tiến độ thực tế).

## 1. Mục tiêu tài liệu
Cơ sở khoa học cho "Powerlifting Training Block Builder" (S-PL Block) — công cụ giúp người dùng tự thiết kế một block luyện tập SBD (Squat/Bench/Deadlift) N tuần tịnh tiến + 1 tuần deload, với 4 "phong cách tính toán" (Volume/Intensity/Normal/Peaking), tự động điều chỉnh khi đang giảm cân, và xuất ra một "Phụ lục Kế hoạch" minh bạch về khối lượng tạ và kcal tiêu hao.

## 2. Chu kỳ hoá theo Block (Block Periodization) — nguồn gốc lý thuyết
Mô hình Block Periodization (Issurin, 3 giai đoạn accumulation→transmutation→realization) là khung lý thuyết nền [1][2]. Chu kỳ hoá 16 tuần cải thiện SBD rõ rệt trên VĐV powerlifting thật trong nghiên cứu thực nghiệm [3]; mô hình volume thấp/cường độ cao gần thi đấu (70-93% 1RM) cũng cho kết quả tốt trong 10 tuần trước giải [4].

### 2.1. Bốn "phong cách tính toán" (Training Focus) — bảng %1RM × set × rep theo tuần
Dựa trên "repetition continuum" đã được y văn hiện đại xác nhận lại [5] và vùng cường độ theo giai đoạn chu kỳ hoá phổ biến trong huấn luyện sức mạnh [6][7]:

| Phong cách | Đầu block | Giữa block | Cuối block (trước deload) | Triết lý |
|---|---|---|---|---|
| **Volume** (Tích luỹ) | 65-70% × 4-5 set × 8-10 rep | 70-75% × 4-5 set × 6-8 rep | 75-80% × 3-4 set × 5-6 rep | Xây nền khối lượng, vùng 60-80%/8-12 rep [5] |
| **Intensity** (Sức mạnh) | 75-80% × 4 set × 4-6 rep | 80-85% × 3-4 set × 3-5 rep | 85-90% × 3 set × 2-3 rep | Thích nghi thần kinh, tối ưu 1RM, vùng 75-90%/3-6 rep [6][7] |
| **Normal** (Cân bằng, kiểu DUP) | Luân phiên trong TUẦN: 1 buổi nặng (80-85%×3-5), 1 buổi vừa (70-75%×6-8), 1 buổi nhẹ/kỹ thuật (60-70%×8-10) | Tổng tấn số tăng nhẹ theo tuần, vẫn giữ luân phiên 3 mức | Buổi nặng nhất trong tuần nhích lên 85-88% | Daily Undulating Periodization — nghiên cứu cho thấy DUP/RPE-autoregulation cho tăng sức mạnh ngang bằng hoặc nhỉnh hơn periodization tuyến tính cố định [8][9] |
| **Peaking** (Thi đấu) | 80-85% × 3 set × 3 rep | 85-90% × 2-3 set × 1-3 rep | 90-97% × 1-2 set × 1 rep, giảm mạnh volume tuần cuối | Loại mệt mỏi tích luỹ, giữ đỉnh thần kinh — mô hình "daily max" volume rất thấp trước thi đấu [4][10] |

**Bảng Prilepin (constraint bổ trợ, không phải nguồn chính):** rút ra từ nhật ký huấn luyện hàng nghìn VĐV cử tạ Olympic Liên Xô, là một khung tham khảo phổ biến để giới hạn tổng số rep hợp lý ở mỗi vùng %1RM — engine dùng nó như **giới hạn kiểm tra** (không cho tổng rep/tuần vượt quá "phạm vi cho phép"), KHÔNG dùng để thay thế bảng phong cách ở trên vì nguồn gốc là cử tạ Olympic chứ không phải powerlifting thuần [24]:

| %1RM | Rep/set khuyến nghị | Tổng rep tối ưu | Phạm vi cho phép |
|---|---|---|---|
| 55-65% | 3-6 | 24 | 18-30 |
| 70-75% | 3-6 | 18 | 12-24 |
| 80-85% | 2-4 | 15 | 10-20 |
| 90%+ | 1-2 | 4 | tối đa 10 |

**Deload week (bắt buộc, không thuộc 4 phong cách):** %1RM đỉnh giảm ~10 điểm % so với tuần cuối tịnh tiến, tổng số set giảm ~50% (tấn số tuần ≈ 40-50% tuần đầu). Tần suất phổ biến 4-8 tuần/lần trong thực hành thật [11][12]; khảo sát 2024 ghi nhận thời lượng deload trung bình 6.4±1.7 ngày, chu kỳ 5.6±2.3 tuần [11] — khớp với đề xuất "5 tuần chính + 1 tuần deload". Sắc thái từ RCT: deload giữa chu kỳ có thể khiến sức mạnh đo NGAY SAU đó giảm nhẹ so với nhóm không deload, nhưng không ảnh hưởng phì đại/công suất/sức bền [13] — deload là công cụ quản lý mệt mỏi dài hạn, không phải "buff" tức thời.

## 3. Autoregulation (RPE/RIR) — lớp điều chỉnh bổ trợ
Thang RPE dựa trên "Reps in Reserve" (RPE 10 = 0 RIR) do Zourdos et al. công bố và kiểm chứng 2016, tương quan nghịch mạnh với vận tốc thanh đòn ở cả người có kinh nghiệm (r=-0.88) lẫn người mới (r=-0.77) [14]. RCT 8 tuần của Helms et al. cho thấy nhóm tự điều chỉnh cường độ bằng RPE tăng sức mạnh squat/bench nhỉnh hơn nhóm dùng %1RM cố định [9]; autoregulation bằng RIR trong chương trình 12 tuần cũng vượt tải cố định [8]. **Ứng dụng:** %1RM ở bảng mục 2.1 là điểm khởi đầu tính toán, không phải luật cứng — Phụ lục Kế hoạch nên gợi ý khung RPE tương ứng (VD "80% ≈ RPE 7-8 với 5 rep") để người dùng tự điều chỉnh ±1 rep khi tạ cảm thấy quá nặng/nhẹ so với dự kiến.

**Chỉ báo mệt mỏi thần kinh phụ trợ — INOL:** ngoài RPE, engine có thể hiển thị thêm INOL (Intensity Number of Lifts, Hristov) = `Số rep / (100 − %1RM)` như một con số CẢNH BÁO tham khảo (không phải luật tính toán chính): dưới 2.0 = nhẹ (phù hợp deload), 2.0-3.0 = vùng tối ưu tăng sức mạnh, 3.0-4.0 = nặng (tối đa 1-2 tuần liên tiếp), trên 4.0 = rủi ro quá tải cao [24]. Đây là công cụ huấn luyện phổ biến trong cộng đồng powerlifting nhưng KHÔNG có RCT kiểm chứng độc lập — dùng như một "đèn cảnh báo" bổ trợ bên cạnh RPE, không thay thế bảng %1RM ở mục 2.1.

## 4. Ước lượng 1RM an toàn cho người mới bắt đầu
Self-reported max từ người chưa có kinh nghiệm dễ dẫn tới quá tải. Cơ sở: (a) bảng quy đổi %1RM↔rep chuẩn NSCA (Brzycki) [15]; (b) ngưỡng trình độ theo hệ số cân nặng cơ thể (ExRx/Symmetric Strength) — nam "beginner" bench <0.5×BW, "novice" 0.5-0.75×BW; nữ "beginner" <0.25×BW, "novice" 0.25-0.4×BW [16]; squat/deadlift dùng cùng phương pháp với hệ số cao hơn (nhiều nhóm cơ lớn hơn tham gia). **Công thức fallback:** khi thiếu 1RM khai báo, điểm xuất phát an toàn (KHÔNG phải 1RM thật) = hệ số %BW ở mức thấp dải "novice", nhân thêm hệ số an toàn ×0.85 (vì đây là trung vị dân số, không phải năng lực cá nhân đã kiểm chứng) — gắn cờ rõ "số ước lượng, nên test lại 1RM thật (có bảo hộ) sau 2-3 tuần làm quen kỹ thuật". Người mới thích nghi thần kinh rất nhanh trong 6-12 tuần đầu, tăng sức mạnh không cần tăng khối cơ trước [17][18] — lý do nên bắt đầu thấp và tịnh tiến nhanh thay vì áp %1RM cố định như người tập lâu năm.

## 5. Giảm cân & bảo toàn cơ/sức mạnh trong thâm hụt calo

### 5.1. Tốc độ giảm cân an toàn
RCT của Garthe et al. trên 24 VĐV: giảm 0.7%/tuần (chậm) giữ khối cơ nạc (LBM) và tăng sức mạnh/công suất tốt hơn rõ rệt so với 1.4%/tuần (nhanh); khuyến nghị 0.7%/tuần nếu ưu tiên giữ/tăng LBM, có thể tới 1.0-1.4%/tuần nếu chỉ cần "không mất thêm" LBM [19]. Đây là cơ sở numeric cho pace giảm cân khi Deficit Mode bật cùng lúc với block powerlifting (dùng lại `weightGoal.ts`, không tạo công thức pace thứ hai).

### 5.2. Đạm — liều lượng bảo toàn cơ khi thâm hụt
- Helms, Aragon & Fitschen (review 2014): khuyến nghị ~1.6-2.4g/kg thể trọng (tuỳ %mỡ) cho VĐV sức mạnh khi cắt calo [20].
- Longland et al. (RCT, AJCN 2016): thâm hụt sâu (~40%) kèm tập nặng 6 buổi/tuần, nhóm ăn 2.4g/kg đạm TĂNG khối cơ nạc (+1.2kg) và giảm mỡ nhiều hơn nhóm 1.2g/kg (chỉ +0.1kg LBM) — bằng chứng trực tiếp đạm cao có thể đảo ngược mất cơ ngay cả khi thâm hụt sâu [21].
- Murphy & Koehler (meta-analysis, Scand J Med Sci Sports 2022): thâm hụt năng lượng giảm mức TĂNG khối cơ nạc so với ăn đủ, **nhưng KHÔNG giảm mức tăng sức mạnh** — miễn duy trì đủ kích thích tập luyện (cường độ) [22]. Đây là bằng chứng trực tiếp nhất cho chiến lược Deficit Mode: giữ nguyên %1RM bài chính, chỉ cắt volume accessories.

### 5.3. Quy tắc "Deficit Mode" của engine
Khi `goalWeightKg < cân nặng hiện tại` (đọc từ hồ sơ có sẵn), engine tự bật Deficit Mode:
1. Tốc độ giảm cân mục tiêu neo quanh 0.5-1%/tuần (giữa khuyến nghị Garthe 0.7% [19] và ngưỡng an toàn chung của y văn dinh dưỡng thể thao).
2. Bài chính: **giữ nguyên %1RM** theo phong cách đã chọn — không giảm cường độ (theo [22]).
3. Bài phụ trợ: cắt 15-20% tổng số set — đóng góp ít vào thành tích SBD, chiếm phần lớn "chi phí phục hồi", nơi cắt giảm hợp lý nhất khi năng lượng phục hồi bị hạn chế.
4. Khuyến nghị đạm hiển thị trong Phụ lục: 1.6-2.4g/kg thể trọng/ngày [20][21].

## 6. Tiêu hao năng lượng buổi tập & EPOC
Mô hình kcal buổi tập powerlifting đã có sẵn trong `liftingEngine.ts` (công nâng vật lý set×rep×tạ + đốt lúc nghỉ, xem `docs/06-energy-expenditure.md` mục 1B) — Block Engine TÁI SỬ DỤNG nguyên hàm này, **không** thay bằng công thức MET×phút chung chung: dự án đã chủ động từ bỏ mô hình MET×phút cho ba bài SBD từ S-PL (2026-07-16) vì thời gian buổi tập phụ thuộc nhịp tim/tốc độ nghỉ nên khó tin cậy, còn tạ/rep/set là số đo chính xác nhất của buổi tập — xem lý do đầy đủ trong `docs/06-energy-expenditure.md` mục 1B. Bổ sung khoa học cho phần "sau buổi tập": tập kháng lực nặng tạo EPOC ("afterburn") lớn hơn cardio ở cùng mức tiêu hao trong buổi, thường thêm 6-15% kcal buổi tập, kéo dài đến 48h [23]. Engine KHÔNG cộng EPOC vào số kcal hiển thị chính (tránh double-estimate so với mô hình set-based đã có) nhưng Phụ lục nên có dòng chú thích minh bạch: "kcal hiển thị là trong-buổi (mô hình vật lý set×rep×tạ); cơ thể tiếp tục đốt thêm ước tính 6-15% trong 24-48h sau đó (EPOC)".

## 7. Bảng thiết kế Engine — đầu vào/đầu ra
**Đầu vào:** số tuần tịnh tiến + có/không deload; lịch tuần có cấu trúc (ngày × bài × biến thể); cân nặng hiện tại; 1RM SBD (hoặc để trống → ước lượng mục 4); phong cách (mục 2.1); mục tiêu giảm cân tuỳ chọn.
**Đầu ra:** Phụ lục Kế hoạch — mỗi tuần → mỗi ngày → mỗi bài (set×rep×%1RM×kg cụ thể, làm tròn theo đĩa tạ 2.5kg) → kcal buổi (tái dùng `liftingSessionKcal`) → tổng kcal tuần vs mục tiêu thâm hụt tuần (tái dùng `weightGoal.ts`). Mỗi biến thể kỹ thuật (paused bench, touch-and-go, low-grip, incline, deficit deadlift...) có nút "ⓘ" mở giải thích ngắn, neo vào mục 2-3 khi phù hợp (VD "touch-and-go" giải thích qua lăng kính stretch-shortening cycle, khác "paused" chủ động loại bỏ yếu tố này để luyện phát lực từ điểm chết — đúng tinh thần thi đấu).

## 8. Nguồn tham khảo
[1] Issurin, V.B. — Block Periodization theory (accumulation/transmutation/realization phases).
[2] BarBend — "3 Types of Training Periodization and How to Use Them to Make Gains." https://barbend.com/different-types-of-training-periodization/
[3] "Effect of 16 Weeks of Periodized Resistance Training on Strength Gains of Powerlifting Athletes." https://www.researchgate.net/publication/279298097
[4] "Reduced Volume 'Daily Max' Training Compared to Higher Volume Periodized Training in Powerlifters Preparing for Competition — A Pilot Study." PMC. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6162635/
[5] Schoenfeld, B.J. et al. — "Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum." Sports (MDPI), 2021. https://www.mdpi.com/2075-4663/9/2/32
[6] TuffWraps — tổng hợp vùng rep 1-6 cho sức mạnh powerlifting. https://www.tuffwraps.com/blogs/news/powerlifting-strength-training-building-unparalleled-strength
[7] Ironside Training — vùng rep theo giai đoạn (strength/hypertrophy/peaking). https://www.ironsidetraining.com/blog/how-many-reps-should-you-be-doing-for-powerlifting
[8] "Rating of Perceived Exertion as a Method of Volume Autoregulation Within a Periodized Program." PubMed. https://pubmed.ncbi.nlm.nih.gov/29786623/
[9] Helms et al. — so sánh 8 tuần RPE-autoregulation vs %1RM cố định (tổng hợp qua Stronger by Science). https://www.strongerbyscience.com/autoregulation/
[10] Stronger by Science — "Tapering and Peaking: Why and How." https://www.strongerbyscience.com/tapering/
[11] "Deloading Practices in Strength and Physique Sports: A Cross-sectional Survey." Sports Medicine - Open, 2024. https://link.springer.com/article/10.1186/s40798-024-00691-y
[12] "'You can't shoot another bullet until you've reloaded the gun': Coaches' perceptions, practices and experiences of deloading." Frontiers in Sports and Active Living, 2022. https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2022.1073223/full
[13] "Gaining more from doing less? The effects of a one-week deload period during supervised resistance training." PMC. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10809978/
[14] Zourdos, M.C. et al. — "Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training." Strength & Conditioning Journal, NSCA, 2016. https://journals.lww.com/nsca-scj/fulltext/2016/08000/application_of_the_repetitions_in_reserve_based.10.aspx
[15] NSCA — Training Load Chart chính thức (Brzycki). https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf
[16] Strength standards theo %BW — tổng hợp ExRx/Symmetric Strength. https://arvo.guru/resources/strength-standards
[17] Frontiers — "Neuromuscular adaptations to resistance training in elite versus recreational athletes," 2025. https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1598149/full
[18] Rippetoe, M. — "The Novice Effect," Starting Strength. https://startingstrength.com/article/the_novice_effect
[19] Garthe, I. et al. — "Effect of Two Different Weight-Loss Rates on Body Composition and Strength- and Power-Related Performance in Elite Athletes." Int J Sport Nutr Exerc Metab, 2011. https://pubmed.ncbi.nlm.nih.gov/21558571/
[20] Helms, E.R., Aragon, A.A., Fitschen, P.J. — "A Systematic Review of Dietary Protein During Caloric Restriction in Resistance Trained Lean Athletes: A Case for Higher Intakes." Int J Sport Nutr Exerc Metab, 2014. https://www.researchgate.net/publication/257350851
[21] Longland, T.S. et al. — "Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss: a randomized trial." American Journal of Clinical Nutrition, 2016. https://ajcn.nutrition.org/article/S0002-9165(22)06559-5/fulltext
[22] Murphy, C., Koehler, K. — "Energy deficiency impairs resistance training gains in lean mass but not strength: A meta-analysis and meta-regression." Scandinavian Journal of Medicine & Science in Sports, 2022. https://onlinelibrary.wiley.com/doi/10.1111/sms.14075
[23] ACE Fitness — "7 Things to Know About Excess Post-exercise Oxygen Consumption (EPOC)." https://www.acefitness.org/resources/pros/expert-articles/5008/7-things-to-know-about-excess-post-exercise-oxygen-consumption-epoc/
[24] Prilepin, A.S. (bảng gốc, huấn luyện cử tạ Olympic Liên Xô) — kiểm định lại trên powerlifting qua Pritchard, H. et al., "The effectiveness of Prilepin's chart for powerlifting strength improvements in resistance trained males," 2016 (4 tuần, cải thiện SBD rõ nhất ở squat/deadlift, giới hạn: mẫu gốc là cử tạ Olympic không phải powerlifting thuần); INOL: công thức của Hristo Hristov, tổng hợp qua PowerliftingTechnique.com/Torokhtiy — công cụ huấn luyện phổ biến, không có RCT độc lập kiểm chứng. https://www.researchgate.net/publication/304540647

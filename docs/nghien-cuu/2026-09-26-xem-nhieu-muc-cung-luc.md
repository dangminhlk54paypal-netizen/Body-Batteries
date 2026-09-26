# Xem nhiều mục cùng lúc trên Pin Hôm Nay

| | |
|---|---|
| Ngày | 26/09/2026 |
| Phạm vi | Danh sách "Chi tiết hôm nay" trên màn Pin Hôm Nay (6 dòng gập: Đã ăn, Vận động, Cân bằng, Vi chất, TPCN, Nạp nhanh) |
| Nhánh / commit | `ui-upgrade`, trên `3e96fba` + thay đổi chưa commit của Session 49–53 |
| Mục tiêu | Người dùng hay mở liên tiếp 2–3 mục để nhìn cùng lúc (vd. Gegessen + Aktivität). Tìm thao tác quen tay, có cơ sở nghiên cứu, để làm việc đó dễ hơn mà màn hình vẫn gọn. |

**Cách đọc trích dẫn** (nguồn truy cập ngày 26/09/2026)

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* ở mục Tài liệu tham khảo |
| `[Mã: file]` | Rút ra từ code của app |
| `[Nội bộ: file]` | Rút ra từ tài liệu nội bộ |
| 💡 | Nhận định / đề xuất của người viết (AI), không phải trích dẫn |
| ❓ | Chưa kiểm chứng được |

---

## Tóm tắt

1. **Hiện tại app chỉ cho mở một mục một lúc** [Mã: [HomeScreen.tsx](../../src/screens/HomeScreen.tsx)]. Nielsen Norman Group nói kiểu tự đóng mục khác này *"hạn chế khả năng kết hợp thông tin từ nhiều mục cùng lúc"* và khuyên cho mở nhiều mục [1].
2. **Mở lần lượt từng mục nghĩa là so sánh bằng trí nhớ.** Nghiên cứu về so sánh thị giác chỉ ra: xem tách rời theo thời gian (hết cái này mới tới cái kia) buộc người xem dựa vào trí nhớ [3]. Trí nhớ ngắn hạn chỉ giữ được khoảng 3–5 "khối" thông tin [6].
3. **Đúng thói quen số đông: "tổng quan trước, chi tiết khi cần"** [5]. Dòng gập đã có số chính ở tiêu đề (tầng tổng quan). Cái còn thiếu là cho 2–3 chi tiết nằm cạnh nhau trên cùng một màn.
4. **Cử chỉ ẩn thì khó tự khám phá** [8]. Apple khuyên cử chỉ tắt chỉ để *bổ sung*, không thay thao tác chuẩn [7]. Vì vậy mọi cử chỉ mới đều phải có nút nhìn thấy được đi kèm.
5. **Đề xuất 💡 (3 lớp):** (a) mở chồng tối đa 3 mục, mục cũ nhất tự gập; (b) nhấn giữ một dòng để **📌 ghim**, mục ghim luôn mở sẵn (giống "Pinned" của Apple Health [9]); (c) chụm/mở hai ngón để gập/mở hết, kèm nút ⊕/⊖ nhìn thấy được.

## Đính chính / điểm cần chủ dự án cân nhắc

| Trước đây | Nguồn nói | Nguồn |
|---|---|---|
| Skill giao diện gọn: màn nhiều mục ngang hàng thì "chỉ mở **một mục một lúc**" [Nội bộ: [mobile-ui-density.md](../../.ai/skills/mobile-ui-density.md)] | NN/g: tự đóng mục khác làm người dùng khó ghép thông tin, nên cho mở nhiều mục và có nút *Mở hết / Gập hết* [1] | [1] |

💡 Hai ý này không hẳn mâu thuẫn. Luật "một mục" sinh ra để chống màn dài vô tận. Chỉ cần giới hạn số mục mở (2–3) và thu nhỏ khung cuộn là vẫn gọn. Nếu anh/chị duyệt thì cần sửa lại luật trong skill.

---

## 1. Hiện trạng trong app

- 6 dòng `FoldRow`, mỗi dòng: icon · keyword · số chính · ⓘ · ⌄ [Mã: [FoldRow.tsx](../../src/components/ui/FoldRow.tsx)].
- Trạng thái mở là **một giá trị** `openDetail` → mở mục B thì mục A tự gập [Mã: [HomeScreen.tsx](../../src/screens/HomeScreen.tsx)].
- Khung cuộn khi mở: Đã ăn 360 px, Vận động 300 px [Mã: HomeScreen.tsx]. 💡 Hai mục cùng mở với khung hiện tại (~660 px) đã vượt chiều cao nhìn thấy của đa số iPhone sau khi trừ tiêu đề và thanh tab, nên phải cuộn giữa hai mục.

## 2. Nghiên cứu nói gì

### 2.1 Accordion (dòng gập) và việc xem nhiều mục
- Mỗi lần mở một mục tốn một "chi phí thao tác": cuộn, đọc tiêu đề, quyết định, bấm, chờ nội dung hiện ra [1].
- Tự đóng mục khác *"hạn chế khả năng kết hợp thông tin từ nhiều mục cùng lúc"*. Nội dung quan trọng nằm rải rác ở nhiều mục thì người dùng dễ mất ngữ cảnh [1].
- Khuyến nghị: cho mở/gập nhiều mục cùng lúc; cân nhắc nút *Expand All / Collapse All* [1].
- Trên điện thoại, nội dung một mục quá dài làm người dùng phải cuộn xa để tới mục sau hoặc để gập lại [2]. 💡 Khung cuộn cố định mà app đang dùng giải được đúng vấn đề này.

### 2.2 So sánh bằng mắt hay bằng trí nhớ
- Gleicher và cộng sự (2011) chia mọi cách so sánh trực quan thành 3 loại: **đặt cạnh nhau** (juxtaposition), **chồng lên nhau** (superposition) và **mã hoá chênh lệch** (explicit encoding) [3].
- Nếu không có hỗ trợ, người xem phải xem từng thứ một, *"và phải dựa vào trí nhớ để so sánh"* [3].
- Hiện ra lần lượt theo thời gian là "đặt cạnh nhau theo thời gian", chủ yếu dùng trí nhớ và việc chuyển sự chú ý [3].
- Cowan (2001): giới hạn trí nhớ ngắn hạn khoảng **3–5 khối**, trung bình **khoảng 4** [6]. 💡 Suy luận: đây là lý do để giới hạn số mục mở cùng lúc ở 2–3, không mở hết cả 6.

### 2.3 Tổng quan và chi tiết
- "Câu thần chú" của Shneiderman (1996): **tổng quan trước, phóng to và lọc, rồi chi tiết khi cần**. Trong 7 việc người dùng làm có *Relate* (xem quan hệ giữa các mục) [5].
- Cockburn, Karlson và Bederson (2008) tổng hợp 4 cách: tổng quan + chi tiết (tách theo không gian), phóng to (tách theo thời gian), focus+context và gợi ý thị giác [4].
  - Tách theo thời gian *"dễ tạo tải nhận thức lớn"*. Chuyển cảnh có animation giảm được tải này rất nhiều, nhưng phải chỉnh thời lượng cho khéo [4].
  - Tổng quan + chi tiết thường được người dùng ưa thích hơn. Điểm yếu là tốn diện tích màn hình, và có thể khắc phục bằng cách cho người dùng bật/tắt phần tổng quan [4].
  - Trên PDA, lịch kiểu fisheye (DateLens) tốt hơn cho việc phức tạp, còn giao diện thường nhanh hơn và được ưa hơn cho việc đơn giản [4]. 💡 Bài học: giữ mặc định đơn giản, chế độ xem nhiều mục là lựa chọn thêm.

### 2.4 Cử chỉ: cái nào người dùng đã quen
- Apple liệt kê cử chỉ chuẩn [7]:
  - **Chạm và giữ**: *hiện thêm điều khiển hoặc chức năng*.
  - **Zoom** (chụm/mở hai ngón): *phóng to một view, phóng đại nội dung*.
  - **Chạm hai lần**: phóng to/thu nhỏ.
- Apple khuyên: *"Dùng cử chỉ tắt để bổ sung cho cử chỉ chuẩn, không thay thế chúng"*. Người dùng vẫn cần cách đơn giản, quen thuộc, *"dù phải bấm thêm một hai lần"* [7].
- Nghiên cứu GhostUI (CHI '26): nhiều app dựa vào "tương tác ẩn" như nhấn giữ và vuốt, vốn không có dấu hiệu thị giác. Vì vậy phần lớn người dùng khó tự tìm ra [8].
- Apple Health có danh sách **Pinned**: người dùng tự chọn các mục hiện ở trang Tóm tắt, để thấy tình hình từng mục trong ngày (Sửa → chạm mục để thêm/bớt → Xong) [9]. 💡 Đây là tiền lệ gần nhất cho việc "luôn xem cùng lúc mấy mục mình quan tâm".

## 3. Đề xuất cho Pin Hôm Nay 💡

| # | Thao tác | Người dùng làm gì | Vì sao | Công sức |
|---|---|---|---|---|
| A | **Mở chồng (tối đa 3)** | Bấm dòng như bây giờ; mục trước **không** tự gập. Mở tới mục thứ 4 thì mục mở lâu nhất tự gập. | Hết mất ngữ cảnh [1]; giới hạn theo trí nhớ ngắn hạn [6]; không phải học gì mới | Nhỏ: `openDetail` → danh sách |
| B | **Khung co giãn** | Mở 1 mục: khung như cũ (300–360). Mở 2–3 mục: mỗi khung thu còn khoảng 200–220 để cùng nằm trên một màn. | Đặt cạnh nhau trong không gian thay vì theo thời gian [3][4] | Nhỏ |
| C | **📌 Ghim** | Nhấn giữ một dòng → "Ghim / Bỏ ghim". Mục ghim luôn mở sẵn mỗi lần vào app, nằm trên cùng, và được lưu lại. | Nhấn giữ = hiện thêm chức năng [7]; giống Pinned của Apple Health [9]; lựa chọn tay luôn thắng [Nội bộ: mobile-ui-density.md] | Vừa (store `persist`) |
| D | **Chụm/mở hai ngón** trên vùng Chi tiết | Mở hai ngón = mở hết 6 mục (khung nhỏ); chụm lại = gập hết (trừ mục ghim). Kèm nút nhỏ **⊕ / ⊖** cạnh tiêu đề "Chi tiết hôm nay". | Zoom = phóng to/thu nhỏ [7] → "tổng quan ↔ chi tiết" [5]; nút nhìn thấy được vì cử chỉ ẩn khó khám phá [8] và cử chỉ tắt chỉ để bổ sung [7]; *Mở hết / Gập hết* [1] | Vừa |
| E | (Để sau) **Dải so sánh** | Khi ≥ 2 mục mở, hiện một dải số cạnh nhau: `⚡ 1.450 kcal │ 🔥 320 kcal │ ⚖️ +250` | Mã hoá chênh lệch: so bằng mắt, không bằng trí nhớ [3] | Vừa–lớn |

**Thứ tự triển khai 💡:** A + B trước (vài giờ, không phải học gì mới). Rồi C (hợp thói quen "ngày nào cũng xem Đã ăn + Vận động"). D sau cùng, luôn đi kèm nút ⊕/⊖. E chỉ làm nếu thử thực tế vẫn thấy khó so.

**Lưu ý khi làm 💡:**
- Mở/gập có animation ngắn (~200–250 ms), để người dùng thấy nội dung "mọc ra" đúng chỗ, không bị lạc [4][2].
- Thao tác tay luôn thắng tự động: mục người dùng tự gập thì không để luật "tối đa 3" hay "ghim" mở lại ngay.
- Chữ mới (Ghim, Bỏ ghim, Mở hết, Gập hết) cần đủ vi / en / de.

## 4. Các quyết định cần chủ dự án chốt

| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Bỏ luật "một mục một lúc" trên Home, thay bằng "tối đa N mục"? | Có, N = 3 |
| Có làm ghim (C) không? Mặc định ghim sẵn mục nào? | Có; mặc định không ghim gì, để người dùng tự chọn |
| Có làm cử chỉ chụm/mở hai ngón (D) không? | Có, nhưng luôn kèm nút ⊕/⊖ |
| Áp dụng cách này cho màn khác (Cài đặt, Sổ tập) không? | Chưa; thử trên Home trước |

## 5. Triển khai thử nghiệm (bản 2, 26/09/2026)

**Chủ dự án chốt:** chưa đặt luật chung cho cả app (vẫn đang tìm hiểu thói quen người dùng). Mặc định giữ **một mục
mỗi lần**; thêm chế độ **xem tối đa 3 mục** cho ai có thói quen quan sát nhiều thông tin cùng lúc; máy học thói quen
thao tác rồi gợi ý, và đổi theo ý người dùng.

| Phần | Đã làm | Chỗ trong code |
|---|---|---|
| A — mở chồng | Chế độ "xem nhiều": tối đa 3 mục, mở mục thứ 4 thì mục mở lâu nhất tự gập. Mặc định vẫn 1 mục. | [Mã: [detailViewHabit.ts](../../src/domain/habits/detailViewHabit.ts)] `toggleOpen` |
| B — khung co giãn | Từ 2 mục mở trở lên, mỗi khung cuộn còn 220 px | [Mã: [HomeScreen.tsx](../../src/screens/HomeScreen.tsx)] `COMPACT_BODY_H` |
| Nút nhìn thấy được | Nút **⧉ 1 / ⧉ 3** cạnh tiêu đề "Chi tiết hôm nay" + ⓘ giải thích (cử chỉ ẩn khó khám phá [8]) | HomeScreen.tsx |
| Máy học thói quen | Ở chế độ 1 mục: ≥ 3 lần mở mục khác trong vòng 20 giây sau mục trước, rải trên ≥ 2 ngày trong 7 ngày → gợi ý "xem tối đa 3". Ở chế độ nhiều mục: 10 lần mở gần nhất (≥ 2 ngày) đều chỉ có 1 mục mở → gợi ý về 1 mục. | detailViewHabit.ts `suggestViewMode` 💡 (ngưỡng do người viết đặt, cần chỉnh theo dữ liệu thật) |
| Chỉ đổi khi đồng ý | Gợi ý là một dòng 💡 · [Đổi] · ✕. Bấm ✕ thì im 14 ngày. Tự đổi chế độ bằng tay thì bắt đầu học lại từ đầu. | [Mã: [homeDetailsStore.ts](../../src/store/homeDetailsStore.ts)], [DetailsViewSuggestion.tsx](../../src/components/DetailsViewSuggestion.tsx) |
| Riêng tư | Lịch sử mở chỉ lưu trên máy (AsyncStorage), giữ tối đa 14 ngày / 60 lần | homeDetailsStore.ts, detailViewHabit.ts |

**Chưa làm (để thảo luận tiếp) 💡:** C — 📌 ghim; D — chụm/mở hai ngón + ⊕/⊖; E — dải so sánh. Hướng mở rộng tiếp
của "máy hiểu thói quen": nhớ **cặp mục hay mở cùng nhau** (vd. Đã ăn + Vận động) rồi gợi ý "mở sẵn cặp này", và
gợi ý theo giờ trong ngày (sáng xem Vận động, tối xem Đã ăn) — cũng chỉ gợi ý, người dùng quyết.

---

## Tài liệu tham khảo

**Nielsen Norman Group**
- [1] Huei-Hsin Wang, *Accordions on Desktop: When and How to Use*, 30/07/2023. https://www.nngroup.com/articles/accordions-on-desktop/ — Dùng cho: tự đóng mục làm khó ghép thông tin, chi phí thao tác, Expand All / Collapse All, khi nào nên hiện hết. Truy cập 26/09/2026.
- [2] Raluca Budiu, *Accordions on Mobile*, 31/05/2015. https://www.nngroup.com/articles/mobile-accordions/ — Dùng cho: mất phương hướng khi mở/gập, cuộn dài trên điện thoại. Truy cập 26/09/2026.

**Bài báo khoa học**
- [3] M. Gleicher, D. Albers, R. Walker, I. Jusufi, C. D. Hansen, J. C. Roberts, *Visual comparison for information visualization*, Information Visualization (SAGE), 2011, DOI 10.1177/1473871611416549. PDF: https://graphics.cs.wisc.edu/Papers/2011/GAWJHR11/paper.pdf — Dùng cho: 3 loại so sánh; xem lần lượt phải dựa vào trí nhớ; đặt cạnh nhau theo thời gian. Truy cập 26/09/2026 (tên tạp chí và DOI lấy qua kết quả tìm kiếm).
- [4] A. Cockburn, A. Karlson, B. B. Bederson, *A Review of Overview+Detail, Zooming, and Focus+Context Interfaces*, ACM Computing Surveys 41(1), Article 2, 12/2008, DOI 10.1145/1456650.1456652. PDF: https://faculty.cc.gatech.edu/~stasko/7450/Papers/cockburn-surveys08.pdf — Dùng cho: 4 cách tổng quan/chi tiết; tách theo thời gian gây tải nhận thức; animation giảm tải; ví dụ DateLens trên PDA. Truy cập 26/09/2026.
- [5] B. Shneiderman, *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*, IEEE Symposium on Visual Languages, 1996. PDF: https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf — Dùng cho: câu "Overview first, zoom and filter, then details-on-demand" và việc *Relate*. Truy cập 26/09/2026 (tên hội nghị qua kết quả tìm kiếm).
- [6] N. Cowan, *The magical number 4 in short-term memory: A reconsideration of mental storage capacity*, Behavioral and Brain Sciences 24(1), 87–114, 2001. PDF: https://www.cambridge.org/core/services/aop-cambridge-core/content/view/44023F1147D4A1D44BDC0AD226838496/S0140525X01003922a.pdf/the-magical-number-4-in-short-term-memory-a-reconsideration-of-mental-storage-capacity.pdf — Dùng cho: giới hạn 3–5 khối, trung bình khoảng 4. Truy cập 26/09/2026 (số tập và trang qua kết quả tìm kiếm).
- [8] M. Kweon, S. Park, S. Lee, Y. B. Lee, J. Rhee, J. Seo, *GhostUI: Unveiling Hidden Interactions in Mobile UI*, CHI '26. https://arxiv.org/abs/2601.19258 — Dùng cho: cử chỉ ẩn (nhấn giữ, vuốt) không có dấu hiệu thị giác, khó khám phá. Truy cập 26/09/2026.

**Apple**
- [7] Apple, *Human Interface Guidelines — Gestures*. https://developer.apple.com/design/human-interface-guidelines/gestures — Dùng cho: bảng cử chỉ chuẩn (chạm và giữ, zoom, chạm hai lần); "cử chỉ tắt bổ sung chứ không thay thế". Truy cập 26/09/2026 (đọc qua bản dữ liệu JSON của chính trang này).
- [9] Apple Support, *Use the Health app on your iPhone or iPad*. https://support.apple.com/en-us/104997 — Dùng cho: danh sách Pinned ở trang Tóm tắt và các bước thêm/bớt. Truy cập 26/09/2026.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 26/09/2026 | 1 | Bản đầu |
| 26/09/2026 | 2 | Mục 5: chủ dự án chốt hướng thử nghiệm; triển khai A + B + nút ⧉ + máy học thói quen gợi ý đổi chế độ |

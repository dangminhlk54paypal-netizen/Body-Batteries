# Việc cần kiểm tra trên iPhone

Danh sách những gì đã code xong nhưng **chưa được chủ app thử trên máy thật**. Mỗi khi có thời gian cầm điện thoại,
mở file này, làm từ trên xuống. Thử xong mục nào thì đánh `[x]` và ghi kết quả ngắn (✅ ổn / ❌ lỗi + câu đã gõ).

- Cách mở bản mới nhất: Safari → link EAS bên dưới → mở bằng Expo Go. Hoặc: Expo Go → Body Batteries → nhánh `preview`.
- AI thêm mục vào đây mỗi khi publish một thay đổi người dùng nhìn hoặc chạm thấy được, kèm số Session.
- Thấy lỗi thì gửi lại cho AI **đúng câu đã gõ / bước đã bấm**. AI thêm nó vào bộ test trước khi sửa.

| Bản `preview` mới nhất | Gồm | Ngày |
|---|---|---|
| [`66d377c7…`](https://u.expo.dev/update/66d377c7-2eec-40f4-9511-fc0c25f02c75) | Đã commit `01f75c1` (Session 61–71 + SDK 58) — **dùng bản này** | 2026-10-23 |
| [`698588e2…`](https://u.expo.dev/update/698588e2-6079-4a88-9f7e-7934daad9a17) | Session 61–71 + SDK 58, Nạp bằng chữ Đợt 1–3a (cũ hơn, chưa commit) | 2026-10-23 |
| [`48281746…`](https://u.expo.dev/update/48281746-b08e-4a68-845b-dc852116e055) | Session 61–71, Nguồn của tôi Đợt 2–3 (cũ hơn) | 2026-10-23 |
| [`a4429e44…`](https://u.expo.dev/update/a4429e44-e8bd-48f1-9ae7-46c25cdca2ae) | Session 61–70 (cũ hơn) | 2026-10-23 |

---

## Session 70 — ⌨️ Nạp bằng chữ (Đợt 1)

Mở: Trang chủ → **⚡ Nạp** → nút **⌨️ Nạp bằng chữ** ở góc trên của màn "Ghi món ăn".

- [ ] **Đọc câu cơ bản.** Gõ `2 chén cơm, 200g ức gà lúc 12h` → **Phân tích**. Kỳ vọng: Cơm trắng 300g, Ức gà 200g,
      cả hai 12:00 · Trưa. Bấm **Nạp 2 món** → sheet đóng, pin tăng, hai món hiện trong "Hôm nay đã ăn".
- [ ] **Cảnh báo trùng.** Mở lại, gõ đúng câu trên lần nữa → **Phân tích**. Kỳ vọng: cả hai dòng có ⚠ và dòng chữ
      "Đã nạp Cơm trắng 300g lúc 12:00. Tick để nạp thêm", ô tick **trống sẵn**, nút ghi "Nạp 0 món" (mờ). Tick một
      dòng → nút thành "Nạp 1 món".
- [ ] **Giọng nói.** Chạm ô chữ → bấm 🎤 trên bàn phím iPhone → đọc "sáng nay hai quả trứng và một ly sữa" →
      **Phân tích**. Kỳ vọng: Trứng gà 100g và Sữa tươi, giờ 07:30 · Sáng.
- [ ] **Ngày hôm qua.** Gõ `hôm qua tối 1 tô bún bò huế`. Kỳ vọng: 19:00 · Hôm qua, 500g. Nạp → món nằm ở ngày hôm
      qua trong tab Lịch sử, không cộng vào hôm nay.
- [ ] **Không nói lượng.** Gõ `phở bò` (món đã từng ghi). Kỳ vọng: lượng = lần ăn trước, ghi chú "dùng lượng lần
      trước". Món chưa từng ghi → "dùng khẩu phần mặc định".
- [ ] **Món lạ.** Gõ `zzz, 1 quả chuối`. Kỳ vọng: dòng “zzz” có ✗, không tick được; Chuối 120g vẫn nạp được. Bấm ✎ ở
      dòng ✗ → hiện ô tìm món thay chỗ danh sách → chọn món → dòng thành ✓ và được tick.
- [ ] **Sửa dòng.** Bấm ✎ ở một dòng: sửa lượng (chip chén/bát), sửa giờ, chọn ngày → **Xong**. Thử "⇄ Đổi món" và
      "Bỏ dòng".
- [ ] **− / +.** 100g → bấm + thành 125g, − thành 90g. Món đếm theo hộp: 1 hộp → − thành 0,5 hộp.
- [ ] **Giờ cho cả danh sách.** Bấm "🕐 … ▾" trên danh sách → đặt 08:00, Hôm qua → **Đặt cho tất cả**.
- [ ] **＋ Thêm món** cuối danh sách → tìm, chọn → dòng mới xuất hiện.
- [ ] **Giờ tương lai.** Lúc trước 17h, gõ `tối nay phở bò`. Kỳ vọng: ✗ "Giờ ăn ở tương lai", không tick được.
- [ ] **ⓘ** cạnh tiêu đề mở/đóng đoạn hướng dẫn ngay tại chỗ (không có popup).
- [ ] **Nhập dở.** Gõ dở rồi vuốt đóng sheet → mở lại trong 5 phút → chữ còn. Bấm **Huỷ** → mở lại → ô trống.
- [ ] **Bàn phím.** Khi bàn phím đang mở, danh sách và nút **Nạp** có bị che không?
- [ ] **Tiếng Anh / Đức.** Cài đặt → Ngôn ngữ → English: gõ `1 bowl of rice and 2 eggs`. Deutsch: gõ
      `Reis mit Hähnchen, ein Glas Milch`. Kỳ vọng: món đúng, chữ trên hàng không tràn hay bị cắt xấu.
- [ ] **Dán tay câu trả lời AI.** Copy một câu trả lời bất kỳ của AI có tên món + gram → giữ ngón tay trong ô → Dán →
      **Phân tích**. Ghi lại câu nào bị đọc sai.

## Session 70 — ⌨️ Nạp bằng chữ (Đợt 2: 📤 Hỏi AI / 📋 Dán, Đợt 3a: giờ ghi)

- [ ] **📤 Hỏi AI.** Màn Nạp bằng chữ → **📤 Hỏi AI** → menu chia sẻ hiện ra → chọn ChatGPT (hoặc Gemini / Claude).
      Kỳ vọng: ô chat có sẵn câu lệnh dài bằng ngôn ngữ của app, kết thúc bằng mẫu `{"items":[…]}`.
- [ ] **Gửi ảnh.** Trong app AI: đính kèm ảnh một bữa ăn thật → gửi → AI trả JSON. Bấm copy câu trả lời.
- [ ] **📋 Dán.** Quay lại Body Batteries → **📋 Dán**. Lần đầu iPhone hỏi "Cho phép dán?" → Cho phép. Kỳ vọng: ô chữ
      đầy JSON, danh sách món hiện ngay (không cần bấm Phân tích), lượng = số gram AI đoán. So với lượng thật bạn ăn:
      AI đoán thiếu hay thừa bao nhiêu? (ghi lại để chỉnh sau)
- [ ] **Clipboard trống.** Copy một khoảng trắng → **📋 Dán**. Kỳ vọng: dòng vàng "Chưa có gì để dán…".
- [ ] **Món "Nguồn của tôi".** Nếu đã nhập bảng món từ file: gõ tên một món trong bảng đó, ví dụ `200g magerquark`.
      Kỳ vọng: khớp món của nguồn, không phải món catalog.
- [ ] **Ba nút đều nhau.** Hàng **📤 Hỏi AI | 📋 Dán | Phân tích** rộng bằng nhau, chữ không bị cắt ở cả
      vi / en / de ("KI fragen | Einfügen | Auswerten").
- [ ] **Giờ ghi.** Ghi một món cho tối hôm qua (bằng chữ hoặc ⚡ Nạp ngày cũ) → tab Lịch sử / Hôm nay → bấm vào món để
      sửa. Kỳ vọng: dòng nhỏ "Ăn 19:00 · ghi 08:02 (24/10)". Món cũ (trước bản này) không có dòng đó.
- [ ] **Excel.** Cài đặt → Dữ liệu → xuất Excel → sheet Món ăn có 2 cột cuối "Ngày ghi", "Giờ ghi"; món cũ để trống.

## Nâng cấp Expo SDK 58 (2026-10-23)

Expo Go trên iPhone đã lên SDK 58, app nâng theo (React Native 0.88, gesture-handler 3). Không có tính năng mới — chỉ
cần xác nhận mọi thứ vẫn chạy như trước.

- [ ] **Mở app.** Mở bản `preview` mới nhất. Kỳ vọng: app lên bình thường, không màn đỏ, không báo "SDK không khớp".
- [ ] **Vuốt đổi tab.** Vuốt ngang giữa các tab, và kéo ngón tay dọc thanh tab bong bóng. Kỳ vọng: trượt mượt, nhấc
      tay ra thì dừng đúng tab.
- [ ] **Bảng trượt.** Mở một bảng trượt từ dưới lên (vd. ⚡ Nạp → Ghi món ăn) → kéo xuống để đóng. Kỳ vọng: đóng được.
- [ ] **Giữ để lưu ảnh.** Giữ ngón tay trên vòng pin, thẻ món ăn trong ngày, đồ thị cân nặng, đồ thị sức mạnh. Kỳ vọng:
      menu chia sẻ hiện ra kèm ảnh đầy đủ (không bị cắt).
- [ ] **Kế hoạch block.** Tập luyện → Kế hoạch → vuốt qua lại giữa các tuần. Kỳ vọng: tự cuộn tới tuần đang chọn.
- [ ] **Sáng / tối.** Cài đặt → Giao diện → đổi sáng ↔ tối. Kỳ vọng: giờ, pin, sóng trên thanh trạng thái vẫn đọc được.

## Session 69, 71 — 📚 Nguồn của tôi (nhập bảng món ăn từ CSV / Excel, ↻ cập nhật)

Mở: Cài đặt → 💾 Dữ liệu → **🍽️ Món của tôi** → tab **📚 Nguồn**. Cần một file bảng trong app Tệp (Files): dòng đầu là
tên cột, mỗi dòng một món. Ví dụ CSV (Đức, `;` và dấu phẩy thập phân):
`Lebensmittel;Energie (kcal);Eiweiß;Fett;Kohlenhydrate` / `Magerquark;67;12,6;0,2;4` / `Apfel;52;0,3;0,2;14`.

- [ ] **Tab mới.** Kỳ vọng: hàng "🍽️ Món | 📚 Nguồn"; tab Nguồn có dòng "Chưa có nguồn nào…", hàng giới hạn
      10 / 50 / 100 / 300 / 500 MB (đang chọn 10) và nút **＋ Nhập file CSV / Excel**.
- [ ] **Nhập CSV.** Bấm ＋ → chọn file CSV trên. Kỳ vọng: cột tự ghép đúng (Tên món, Năng lượng, Đạm, Béo, Carb), "Dấu
      thập phân" đang ở **1,5**, xem trước "Magerquark — 67 kcal · Đ 12,6 · B 0,2 · C 4". Bấm **Nhập** → thanh tiến
      trình → "Đã nhập 2 món vào …".
- [ ] **Đổi cột.** Ở màn ghép cột, chạm một dòng (ví dụ Đạm) → danh sách cột hiện thay chỗ, kèm giá trị mẫu → chọn cột
      khác hoặc "— Không dùng" → xem trước đổi theo.
- [ ] **Tìm món.** "Ghi món ăn" → gõ `quark`. Kỳ vọng: Magerquark hiện ngay sau món "Của tôi", nhãn là tên nguồn. Ghi
      món đó → đóng hẳn app, mở lại → món vẫn đúng tên trong "Hôm nay đã ăn", pin vi chất vẫn tính.
- [ ] **Sửa món nguồn.** Trong "Ghi món ăn" chọn Magerquark → ✎ Sửa thành phần → đổi đạm → Lưu. Kỳ vọng: nhãn "· đã sửa".
- [ ] **Excel nhiều trang.** Tạo file .xlsx có 2 trang tính (trang 1 ghi chú, trang 2 là bảng món) → ＋ → chọn file.
      Kỳ vọng: hàng chip tên trang ở trên; chạm trang 2 → cột ghép lại, xem trước đúng → Nhập.
- [ ] **↻ Cập nhật nguồn.** Sửa file CSV: đổi chỗ 2 cột, đổi số của Magerquark, xoá dòng Apfel, thêm Birne → bấm ↻ ở
      nguồn → xác nhận → chọn file mới. Kỳ vọng: tiêu đề "↻ Cập nhật …", cột vẫn ghép đúng dù đã đổi chỗ → Nhập →
      "Đã cập nhật …: 2 món (trước: 2)". Magerquark vẫn giữ chỗ ✎ đã sửa, Apfel không còn khi tìm, bữa đã ghi vẫn nguyên.
- [ ] **Huỷ khi cập nhật.** Bấm ↻ → chọn file → Nhập → bấm **Huỷ** ngay (cần file lớn để kịp bấm). Kỳ vọng: nguồn cũ
      không đổi.
- [ ] **Bật/tắt, xoá.** Tắt công tắc của nguồn → `quark` không còn trong ô tìm. Bật lại → có lại. ✕ → xác nhận → nguồn
      mất, bữa đã ghi vẫn còn số cũ.
- [ ] **File lớn.** File lớn hơn mức đã chọn → hỏi "Vẫn nhập?" kèm số MB và số dòng. File .xlsx > 30 MB → khuyên lưu
      sang CSV. File không phải bảng (.pdf) → "App đọc được bảng trong file …". Ghi lại: file Excel vài MB có làm máy
      chậm/treo không, và CSV lớn (chục MB) tìm món có chậm không.
- [ ] **Ngôn ngữ.** English và Deutsch: màn ghép cột, nhãn "Dezimalzeichen", "Mineralstoffe" không bị cắt xấu; nút
      "＋ CSV- / Excel-Datei importieren" vừa khung.

---

## Các session khác đang chờ thử

Checklist chi tiết nằm trong `.ai/SESSION_LOG.md`, mục "Session tiếp theo phải làm" của từng session:

| Session | Tính năng | Ở đâu trong app |
|---|---|---|
| 61 | Nền đổi màu theo pin no + chọn tab mở đầu | Mọi tab; Cài đặt → Giao diện |
| 62 | Tab Tập luyện: đồ thị lên trên, cỡ chữ sổ tập | Tập luyện |
| 63 | Tên gọi người dùng in vào Excel; lịch tuần + kế hoạch linh hoạt | Cài đặt → Hồ sơ; Tập luyện → Kế hoạch |
| 64 | Lưu theo năm, tự sao lưu trước khi dọn, Kho dài hạn | Cài đặt → Dữ liệu |
| 65–68 | Kế hoạch block: lưới theo bài, Tịnh tiến, Training Max, RPE, chế độ Form | Tập luyện → Kế hoạch |

# Việc cần kiểm tra trên iPhone

Danh sách những gì đã code xong nhưng **chưa được chủ app thử trên máy thật**. Mỗi khi có thời gian cầm điện thoại,
mở file này, làm từ trên xuống. Thử xong mục nào thì đánh `[x]` và ghi kết quả ngắn (✅ ổn / ❌ lỗi + câu đã gõ).

- Cách mở bản mới nhất: Safari → link EAS bên dưới → mở bằng Expo Go. Hoặc: Expo Go → Body Batteries → nhánh `preview`.
- AI thêm mục vào đây mỗi khi publish một thay đổi người dùng nhìn hoặc chạm thấy được, kèm số Session.
- Thấy lỗi thì gửi lại cho AI **đúng câu đã gõ / bước đã bấm**. AI thêm nó vào bộ test trước khi sửa.

| Bản `preview` mới nhất | Gồm | Ngày |
|---|---|---|
| [`ae3f01e1…`](https://u.expo.dev/update/ae3f01e1-370a-4a42-9227-abc58b322801) | Session 77 🧱 Chi tiết hôm nay dạng tường gạch (chưa commit) + **có cả sửa lỗi đơ ⌨️ 🎤** (Session 76) + mọi thứ của `e7ef0d76…` — **dùng bản này** | 2026-10-26 |
| [`e7ef0d76…`](https://u.expo.dev/update/e7ef0d76-5354-4bb1-b3cb-a921013b9cb4) | Sửa lỗi đơ khi bấm ⌨️ 🎤 Kể cả ngày (Session 76) + mọi thứ của `16ab4e90…` | 2026-10-26 |
| [`16ab4e90…`](https://u.expo.dev/update/16ab4e90-ff27-4d80-9cef-e2cd02951951) | Session 75 Đợt 0 🌐 đa ngôn ngữ + ⚠ vi chất nhập nhằng + số /100 g 1 chữ số thập phân (chưa commit) + **có cả Session 74** ⌨️ 🎤 Kể cả ngày (chưa commit) + `b13f608` | 2026-10-26 |
| [`8ddee9ef…`](https://u.expo.dev/update/8ddee9ef-e229-414e-aa9f-ff336ec4214e) | Session 75 Đợt 0 🌐 đa ngôn ngữ (chưa commit) + **có cả Session 74** ⌨️ 🎤 Kể cả ngày (chưa commit) + `b13f608` | 2026-10-26 |
| [`0d4ef999…`](https://u.expo.dev/update/0d4ef999-1f2e-4511-bf5e-038c28c33122) | Session 74 ⌨️ 🎤 Kể cả ngày (chưa commit) + `b13f608` (Session 72b, 73 đã commit) | 2026-10-26 |
| [`61ec7443…`](https://u.expo.dev/update/61ec7443-23c5-4939-af7a-450b7500e303) | Session 73 🤖 Dán dinh dưỡng từ AI + Session 72b (cả hai chưa commit) + `097168b` | 2026-10-26 |
| [`52d2710f…`](https://u.expo.dev/update/52d2710f-fa2e-4866-9863-5b931a1efca8) | Đã commit `097168b` (Session 72) + Session 72b số theo khẩu phần 1 chữ số thập phân (bản cô lập, chưa có mealText AI) | 2026-10-26 |
| [`f7564860…`](https://u.expo.dev/update/f7564860-fb55-44ea-a8cb-79b7446e708f) | Session 72 ☕ Caffeine & hoạt chất (chưa commit) + mọi thứ đã commit | 2026-10-26 |
| [`66d377c7…`](https://u.expo.dev/update/66d377c7-2eec-40f4-9511-fc0c25f02c75) | Đã commit `01f75c1` (Session 61–71 + SDK 58) | 2026-10-23 |
| [`698588e2…`](https://u.expo.dev/update/698588e2-6079-4a88-9f7e-7934daad9a17) | Session 61–71 + SDK 58, Nạp bằng chữ Đợt 1–3a (cũ hơn, chưa commit) | 2026-10-23 |
| [`48281746…`](https://u.expo.dev/update/48281746-b08e-4a68-845b-dc852116e055) | Session 61–71, Nguồn của tôi Đợt 2–3 (cũ hơn) | 2026-10-23 |
| [`a4429e44…`](https://u.expo.dev/update/a4429e44-e8bd-48f1-9ae7-46c25cdca2ae) | Session 61–70 (cũ hơn) | 2026-10-23 |

---

## Session 77 — 🧱 Chi tiết hôm nay dạng tường gạch

Bản `ae3f01e1…`. Mở tab **Pin Hôm nay**, kéo xuống mục **Chi tiết hôm nay**.

- [ ] 7 mục hiện thành ô vuông xếp so le như gạch (tiếng Việt: hàng 2 ô · 3 ô · 2 ô), mỗi ô có icon, tên và số chính
- [ ] Bấm một ô → ô viền cam, khối chi tiết mở ngay dưới tường; bấm lại ô (hoặc ⌃ ở đầu khối) → gập
- [ ] ⓘ ở đầu khối (Cân bằng, Vi chất, TPCN, Caffeine) mở được giải thích
- [ ] Bật ⧉ 3 → mở được tối đa 3 khối, xếp theo thứ tự đã mở; mở thêm khối thứ 4 → khối cũ nhất tự gập
- [ ] Đổi ngôn ngữ EN / DE → ô vẫn vừa chữ, không có tên bị cắt khó đọc
- [ ] Số dài (vd. "1.450 kcal · 5 món") xuống tối đa 2 dòng trong ô, không tràn ra ngoài

## Session 76 — Sửa lỗi đơ khi bấm ⌨️ 🎤 Kể cả ngày

Lỗi cũ: bấm ⌨️ 🎤 thì Trang chủ đứng hình (vẫn sáng, không chạm được gì), phải thoát Expo Go.

- [ ] **Bấm nhiều lần.** Trang chủ → ⌨️ 🎤 Kể cả ngày → sheet hiện (lớp tối + khung), thoáng thấy ô tìm món rồi tự chuyển
      sang ô **Kể cả ngày** (📤 Hỏi AI | 📋 Dán | Phân tích). Đóng (✕ hoặc chạm ra ngoài) rồi bấm lại ≥ 5 lần: không đơ.
- [ ] **⚡ Nạp vẫn như cũ.** Bấm ⚡ Nạp → mở ô tìm món, không tự nhảy sang ô chữ. Bấm qua lại ⚡ Nạp và ⌨️ 🎤 vài lần.
- [ ] **Quay lại.** Trong Kể cả ngày bấm "‹ Quay lại" → ô tìm món; chọn một món → "Sửa thành phần" → lưu/huỷ → vẫn ở món
      đó, không nhảy về ô chữ.
- [ ] Sau đó làm tiếp các mục "Session 74" bên dưới.

## Session 75 — Đợt 0 🌐 Đa ngôn ngữ: tên món AI, số hàng nghìn, câu lệnh AI

Bản `8ddee9ef`. Mở: Trang chủ → ⚡ Nạp → ⌨️ Nạp bằng chữ (hoặc nút ⌨️ 🎤 Kể cả ngày).

- [ ] **Tên món AI bằng tiếng Đức.** Cài đặt → Ngôn ngữ → Deutsch. Bấm **📤 Hỏi AI**, gửi ảnh một món app chưa có (vd.
      gulasch) cho ChatGPT/Gemini, chép câu trả lời JSON → **📋 Dán**. Kỳ vọng: dòng 🤖 món mới hiện **tên tiếng Đức**
      (không phải tên tiếng Anh). Nạp → Món của tôi vẫn hiện tên tiếng Đức, **kể cả sau khi tắt hẳn app rồi mở lại**.
- [ ] **Đổi ngôn ngữ sau khi lưu.** Món vừa lưu ở trên: đổi sang English → hiện tên tiếng Anh AI đưa (`name_en`); đổi sang
      Tiếng Việt → hiện tên tiếng Đức (món chỉ có tên đó). Không có món nào bị trống tên.
- [ ] **Câu lệnh AI.** Bấm 📤 Hỏi AI ở cả 3 ngôn ngữ → chọn Ghi chú (Notes) để xem. Kỳ vọng: lời dặn đúng ngôn ngữ, khối
      JSON ở giữa giống hệt nhau ở cả 3 (`"items"`, `"name"`, `"name_en"`, `"per_100g"`…), câu cuối nói về `"name"`,
      `"name_en"`, `"time":"HH:MM"`.
- [ ] **Số hàng nghìn (chữ thường).** Chép vào clipboard rồi 📋 Dán:
      `Magerquark je 100 g: Brennwert 1.046 kJ, Eiweiß 12,4 g, Kohlenhydrate 4 g, Fett 0,2 g, Natrium 1.200 mg`.
      Kỳ vọng: khoảng **250 kcal/100 g** (không phải 0 kcal), natri **1200 mg**. Bản tiếng Anh `Energy 1,046 kJ` cũng ra
      250 kcal.
- [ ] **Cảnh báo số AI lệch.** Dán `Energie 1.046 kJ, Eiweiß 50 g, Kohlenhydrate 50 g, Fett 22 g pro 100 g`. Kỳ vọng:
      dòng có ghi chú ⚠ "Số AI không khớp…" (250 kcal nhưng đạm/bột/béo ra ~600 kcal).
- [ ] **Không hỏng đường cũ.** Dán lại một câu trả lời AI cũ (Session 73) và món tự tạo cũ: tên, số, nút Số app / Số AI /
      ＋ Món mới vẫn như trước.

**Bổ sung (bản `16ab4e90`):**

- [ ] **Người dùng tiếng Anh.** Cài đặt → Ngôn ngữ → English. 📤 Hỏi AI → gửi ảnh một món app chưa có → 📋 Paste. Kỳ
      vọng: dòng 🤖 tên tiếng Anh; Log → My foods hiện tên tiếng Anh, tắt app mở lại vẫn vậy. Dán
      `per 100 g: Energy 1,046 kJ, Protein 10 g, Carbohydrate 30 g, Fat 2 g, Sodium 1,200 mg` → ~250 kcal, sodium 1200 mg.
- [ ] **⚠ Vi chất nhập nhằng.** (tiếng Đức) Dán `pro 100 g: Brennwert 120 kcal, Eiweiß 10 g, Eisen 1,500 mg` cho một món
      app chưa có. Kỳ vọng: dòng có ghi chú "Eisen 1500 mg/100g wirkt zu hoch. Vielleicht 1,5 mg? …". Dán
      `per 100 g: Calories 330 kcal, Protein 18 g, Calcium 1,500 mg` → **không** có ghi chú này (phô mai có thật 1500 mg).
- [ ] **Số /100 g gọn 1 chữ số thập phân.** Món của tôi → ＋ tạo món: khẩu phần 30 g, nhập theo khẩu phần 103,1 kcal → Lưu.
      Kỳ vọng: khi chọn món để nạp, dòng dưới tên hiện **343,7 kcal / 100g** (không phải 343,666666667). Mở ✎ của món,
      chuyển sang "/100 g" → ô kcal hiện **343.7**.

---

## Session 74 — ⌨️ 🎤 Kể cả ngày (món vào Nạp, tập luyện vào Xả)

Mở: Trang chủ → nút **⌨️ 🎤 Kể cả ngày** (ngay dưới ⚡ Nạp | 🔥 Xả). Đọc bằng 🎤 trên bàn phím iPhone hoặc gõ.

- [ ] **Cả ngày một lần.** Gõ/đọc: `sáng 6h chạy bộ 30 phút, ăn phở bò. Trưa 2 chén cơm với ức gà 200g. Chiều 5h squat
      5x5 100kg, kéo xô 4x12 40kg. Tối ăn bún chả rồi đi bộ 8000 bước` → Phân tích. Kỳ vọng: danh sách món (phở, cơm, ức
      gà, bún chả) ở trên; dưới có dòng **🔥 Xả · 4 · … kcal** với Chạy bộ (06:00 · 30 phút), Squat (17:00 · 5x5x100),
      Kéo xô (17:00 · 4x12x40), Bước chân (8.000 bước). Dòng giờ tương lai hiện ✗ "Giờ ở tương lai" nếu bây giờ còn sớm.
- [ ] **Ghi.** Nút đáy ghi "Ghi n món + m Xả" → bấm. Kỳ vọng: món vào "Hôm nay đã ăn", buổi tập vào Xả (squat + kéo xô
      thành **một** buổi gym), Sổ tập có squat 5x5x100.
- [ ] **Chữ thời lượng.** `chạy 1 giờ` = 60 phút (không phải lúc 1 giờ); `lúc 6 giờ chạy 45 phút` = bắt đầu 06:00, 45
      phút; `từ 17h đến 18h30 đá bóng` = 90 phút từ 17:00; `tối tập gym 1 tiếng rưỡi` = 90 phút.
- [ ] **Hôm qua.** `hôm qua đá bóng từ 19h đến 20h` → Xả 1 🔥. Kỳ vọng: buổi nằm ở ngày hôm qua (Lịch sử).
- [ ] **Môn lạ.** `leo núi 2 tiếng` → dòng ✗ "Chưa biết môn này" → ✎ → chọn một môn (chip) → Xong → dòng thành ✓, ghi được.
- [ ] **✎ dòng tập.** Đổi phút / bước (2 ô Phút | Bước), giờ bắt đầu (để trống = không có giờ), ngày; dòng squat có ô
      **Set** (gõ `5x5x110`). Nút −/＋ trên dòng: ±5 phút, ±500 bước.
- [ ] **Trùng.** Đã ghi chạy bộ lúc 18:00 trong 🔥 Xả, rồi kể `18h30 chạy bộ 30 phút` → dòng bỏ tick sẵn, ghi "Đã có Chạy
      bộ lúc 18:00 trong Xả".
- [ ] **Không nhầm món.** `gà chạy bộ 1 con` vẫn là món (nếu kho có), `cơm chay` là món, `chạy bộ` là bài tập.
- [ ] **⌨️ Nạp bằng chữ** (trong ⚡ Nạp) cũng hiểu bài tập như trên. Đổi English/Deutsch: `ran 30 minutes, 2 eggs` /
      `45 Minuten joggen, danach Müsli` → đúng 2 danh sách; chữ nút đáy và tiêu đề không tràn.

## Session 73 — 🤖 Dán dinh dưỡng từ AI → lưu / cập nhật món → nạp theo lượng

Mở: ⚡ Nạp → **⌨️ Nạp bằng chữ**.

- [ ] **Hỏi AI có số dinh dưỡng.** **📤 Hỏi AI** → ChatGPT/Gemini/Claude → gửi ảnh bữa ăn → copy câu trả lời →
      **📋 Dán**. Kỳ vọng: câu lệnh giờ xin thêm `per_100g` (kcal, đạm, carbs, béo…). Món app chưa có: ghi chú
      "🤖 Món mới … kcal/100g". Món app đã có: ghi chú "🤖 AI … · app … kcal/100g · đang dùng số app".
- [ ] **So sánh & chọn.** Chạm ✎ ở một món app đã có. Kỳ vọng: bảng "🤖 Dinh dưỡng /100g" với 2 cột **App | AI**, 3 nút
      bằng nhau **Số app | Số AI | ＋ Món mới**. Chọn **Số AI** → Xong → Nạp. Sau đó mở món đó trong ⚡ Nạp → ✎: số
      đã đổi theo AI; khôi phục số cũ ở đó được.
- [ ] **Món mới + đổi tên.** Ở dòng "Món mới" → ✎ → sửa **Tên món mới** → Xong → Nạp. Kỳ vọng: món nằm trong
      🍽️ Món của tôi; lần sau gõ `300g <tên>` ở Nạp bằng chữ → khớp đúng món, kcal tính theo 300 g.
- [ ] **Dán chữ thường.** Hỏi AI theo cách của bạn (không dùng nút 📤), copy câu trả lời dạng "Calories: 520 kcal,
      Protein: 30 g, Carbs…, Fat…" có khẩu phần (vd. "Khẩu phần: 400 g") → 📋 Dán. Kỳ vọng: 1 dòng món, lượng 400 g, số
      /100 g đã chia ra. Không có khẩu phần → ghi chú "app hiểu là /100 g", lượng 100 g.
- [ ] **Chỉ lưu, chưa ăn.** Dán phân tích nhãn một sản phẩm → **💾 Lưu 1 món** (cạnh ＋ Thêm món). Kỳ vọng: không nạp
      gì, nút 💾 biến mất. Lần sau gõ `200g <tên món>` → app tính theo số đã lưu.
- [ ] **Số AI lệch.** Nếu kcal không khớp đạm/carbs/béo: dòng có ⚠ "Số AI chưa khớp". Vẫn nạp được.
- [ ] **Ngôn ngữ.** Đổi English / Deutsch: 3 nút "App numbers | AI numbers | ＋ New food" / "App-Werte | KI-Werte |
      ＋ Neu" không bị cắt chữ; nút 💾 vừa một dòng.

## Session 72b — Số theo khẩu phần làm tròn 1 chữ số thập phân

Mở: ⚡ Nạp → tìm "g7" → ✎ sửa dinh dưỡng của "Cà phê G7 3in1".

- [ ] **Đổi sang theo khẩu phần.** Trong form, chuyển "100 g" → "1 khẩu phần" (gói 16 g). Kỳ vọng: Carb `12.2`, Đường
      `12`, Béo `2.4`, Caffeine `65.3` — không còn số kiểu `12.1552`.
- [ ] **Món đếm theo viên/gói.** ✎ sửa "Dầu cá Omega-3" (mở sẵn theo viên). Kỳ vọng: EPA `600`, DHA `400`, kcal `11`,
      mọi ô tối đa 1 chữ số sau dấu phẩy.
- [ ] **Không mất vi chất.** ✎ "Espresso" → chuyển sang 1 shot (30 ml). Kỳ vọng: Kẽm hiện `0.01`, không phải `0`.

## Session 72 — ☕ Caffeine & hoạt chất (nước tăng lực, cà phê, TPCN)

Mở: Trang chủ → kéo xuống "Chi tiết hôm nay" → dòng **☕ Caffeine** (dưới 💊 TPCN).

- [ ] **Ghi nhanh.** Mở dòng ☕ → chạm chip **＋ Monster Energy (bản gốc…)** ở hàng cuộn ngang. Kỳ vọng: thanh
      caffeine lên **114 / 400 mg**, dòng gập hiện `114/400 mg`, nhật ký bên dưới có giờ hiện tại · Monster · 114 mg.
      Pin Đường tăng ~39 g.
- [ ] **Một lần quá 200 mg.** Chạm thêm một chip Monster ngay sau đó. Kỳ vọng: chip cam "⚠ 227 mg trong 1 giờ (> 200)",
      dòng gập có thêm ` · ⚠️ 1`.
- [ ] **Sát giờ ngủ.** Đặt 🌙 Giờ đi ngủ bằng −/＋ sao cho giờ hiện tại nằm trong 6 tiếng trước đó (vd. bây giờ 15:00 →
      đặt 20:00). Kỳ vọng: chip "🌙 … mg sau 14:00", cột hôm nay trên dải 7 ngày có 🌙, các dòng nhật ký có 🌙.
- [ ] **Dải 7 ngày.** Chạm một ngày khác (T2…CN). Kỳ vọng: thanh, chip và nhật ký đổi sang ngày đó; ngày không có
      caffeine ghi "Ngày này chưa ghi caffeine."
- [ ] **G7.** Ghi "Cà phê G7 3in1" (gói 16 g) qua ⚡ Nạp → tìm "g7". Kỳ vọng: ≈ 65 mg caffeine, ≈ 71 kcal.
- [ ] **Creatine / L-carnitine.** Ở dòng 💊 TPCN có chip Creatine monohydrate và L-Carnitine. Chạm Creatine → ô
      "Creatine" trong dòng ☕ thành `5 / 5 g`.
- [ ] **Món tự nhập.** ⚡ Nạp → ＋ món mới → "▸ Thêm vi chất" → cuối form có mục **Hoạt chất (nước tăng lực, TPCN)**:
      nhập Caffeine 80 cho 1 lon 250 ml → lưu → món này hiện trong hàng ghi nhanh của ☕ (mở lại app nếu chưa thấy).
- [ ] **ⓘ.** Chạm ⓘ của dòng ☕: 5 mục (mốc tham khảo, giấc ngủ, trước buổi tập với số mg theo cân nặng của bạn,
      taurine/carnitine/creatine, về lâu dài) + câu miễn trừ. Đổi sang English/Deutsch: chữ không tràn.
- [ ] **Chi tiết món.** Chạm một Monster đã ghi trong "Hôm nay đã ăn" → bảng dinh dưỡng có Caffeine 114 mg, Taurine
      1420 mg, L-carnitine 96 mg.

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

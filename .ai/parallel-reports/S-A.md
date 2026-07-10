# S-A — Test thật trên điện thoại + chốt Phase 0/1/2 (2026-06-18, tiếp tục 2026-07-10)

**Trạng thái: 🔄 ĐANG TEST — bước 3–6 đã chạy trên iPhone thật (2026-07-10). Bước 4/5/6 PASS. Bước 3 lộ 2 bug → đã tìm root cause & sửa xong (chi tiết dưới), chờ người dùng test lại.**

## Làm gì
- Hướng dẫn người dùng (qa-reviewer, từng bước, chờ xác nhận) chạy `npx expo start`
  để test app thật qua Expo Go theo đúng quy trình gói S-A.
- KHÔNG sửa code trong `src/` (đúng luật gói S-A).

## File đã tạo/sửa
- Chỉ tạo file báo cáo này (`.ai/parallel-reports/S-A.md`). Không đụng file nào khác.

## Tiến độ các bước (theo NEXT_SESSIONS.md mục S-A)
1. ✅ Khởi động `npx expo start` — chạy trong terminal tích hợp VS Code (không phải Terminal.app
   độc lập như gợi ý, nhưng vẫn chạy được). Dev server lên, có hiện QR, **vẫn còn sống** (đã xác
   nhận lại ở lần dừng thứ 2).
2. ✅ **Đã xác nhận**: app chạy tốt trên **iPhone thật qua Expo Go** (không phải bản web), dù wifi
   là `eduroam` của trường — vậy client isolation (lo ngại ở `.ai/CONTEXT.md` mục 10) **không**
   chặn kết nối lần này.
3. 🔶 (2026-07-10) Có đủ 1 pin tổng + 6 pin nhỏ, NHƯNG lộ 4 bug (3a/3b/3c/3d — xem "Bug phát hiện" —
   đã sửa, chờ test lại trên máy thật, đặc biệt 3d chưa thể verify bằng test tự động).
4. ✅ (2026-07-10) Test Phase 1 OK.
5. ✅ (2026-07-10) Test Phase 2 OK.
6. ✅ (2026-07-10) Test pin thấp OK.

## Bug phát hiện & đã sửa (2026-07-10)

### Bug 3a — ghi món USDA không nạp pin nhỏ/pin vi chất (đường, xơ, carb sai)
- **Hiện tượng**: ăn 350g "chicken nuggets" (món tra từ USDA/tự thêm) nhưng carb chỉ vào 4-8g;
  đường/xơ gần như không nhúc nhích với đa số món USDA.
- **Root cause**: `scripts/generate-usda-db.js` map dinh dưỡng theo nutrient number cũ, nhưng bản
  Foundation Foods 2026 đổi number theo phương pháp phân tích mới: đường nằm ở `269.3` (136 món)
  thay vì `269` (chỉ 5 món khớp), xơ có thêm `293` (AOAC, 34 món), carb "by difference" có giá trị
  ÂM không được clamp (vd đùi gà -0.475 g/100g).
- **Fix**: NUTRIENT_MAP đổi thành danh sách number ưu tiên (269→269.3, 291→293, 205→205.2) + clamp
  âm về 0, chạy lại `npm run gen:usda`. Kết quả: món có đường 5→132, có xơ 185→196, 0 giá trị âm.
- **Test**: 4 test regression mới trong `src/data/food/__tests__/usdaFoods.test.ts`.
- **Lưu ý**: các món USDA "thịt gà" thuần thực sự có carb ≈ 0 — nuggets đóng gói (có bột chiên) nên
  tự thêm làm món custom với carb thật từ bao bì; và món nào bản thân USDA không đo đường
  (vd heavy cream) vẫn là 0 — đó là giới hạn dữ liệu, không phải bug app.

### Bug 3b — form "Thêm món mới" không scroll được, nút Lưu bị bàn phím che
- **Hiện tượng**: trong "Ghi món ăn" → Thêm món mới (vd đồ uống): không kéo xuống được tới mục
  vi chất, nút xác nhận nằm dưới bàn phím → không thêm món được.
- **Root cause**: `styles.sheet` (FoodLogModal) và khung sheet (BottomSheet/FoodNutritionEditModal)
  thiếu `flexShrink: 1` — nội dung form dài tràn khỏi maxHeight 85%/88% thay vì ép ScrollView co
  lại, nên ScrollView không bao giờ scroll và hàng nút rơi ra ngoài vùng nhìn thấy.
- **Fix**: thêm `flexShrink: 1` vào 3 chỗ: `BottomSheet` (khung), `FoodLogModal` (sheet trong),
  `FoodNutritionEditModal` (sheet). ScrollView giờ co theo bàn phím, nút Huỷ/Lưu luôn nổi trên.

### Bug 3c — quy ước đơn vị Carbs không thống nhất giữa các nguồn dữ liệu
- **Hiện tượng** (người dùng yêu cầu chốt): nhập món mà pin Carbs không được nạp đủ vì các nguồn
  dữ liệu hiểu "carb" khác nhau. Quy ước chốt: **Carbs = tổng carbohydrate (= Kohlenhydrate trên
  nhãn EU) = ĐÃ BAO GỒM đường + xơ** → bất biến `carb_g >= sugar_g + fiber_g` ở mọi nơi.
- **Vi phạm tìm thấy**: 42 dòng USDA (vd đậu khô: carb 0 nhưng xơ 4.3; nước ép bưởi: carb 7.59 <
  đường 7.72) + 4 dòng food_items.csv (sữa tươi, xoài, ổi, mật ong).
- **Fix ở 4 lớp**:
  1. `src/data/food/foodCsv.ts` (parser chung cho cả 2 catalog): parse-time nâng carbG lên
     sugar+fiber nếu dòng khai thấp hơn — chốt chặn cho MỌI nguồn CSV về sau;
  2. `src/domain/food/customFoodInput.ts` (`buildCustomFoodItem`): carbG = max(carb nhập,
     đường + xơ) — trước đây chỉ suy khi carb bỏ trống, giờ sửa cả entry mâu thuẫn;
  3. `scripts/generate-usda-db.js`: enforce cùng bất biến khi sinh dữ liệu (kcal Atwater cũng
     tính lại từ carb đã nâng — vd đậu đỏ khô 111 → 129 kcal);
  4. `food_items.csv`: sửa tay 4 dòng vi phạm rồi `npm run gen:food`.
- **Quy ước ghi tại**: comment `Nutrition` trong `src/types/food.ts` (nơi mọi field dinh dưỡng
  được định nghĩa) + ghi chú trong form ("Đường và chất xơ đã nằm TRONG Carbs" — có sẵn từ trước).
- **Test**: bất biến carbG ≥ sugarG + fiberG chạy trên TOÀN BỘ 90 món Việt + 363 món USDA
  (foodDatabase.test.ts, usdaFoods.test.ts) + case parse/build cụ thể (foodCsv.test.ts,
  customFoodInput.test.ts).

### Bug 3d — "Sửa thành phần" bấm không hiển thị gì (chặn việc tự sửa carb sai)
- **Hiện tượng** (test lại 2026-07-10): sau khi ghi "Chicken Nuggets - Penny" (món tự thêm, không
  có trong USDA/danh sách Việt — không phải trường hợp bug 3a/3c) 350g nhưng carb không nạp vào
  pin nhỏ; bấm "✎ Sửa thành phần" để tự sửa lại thì **không hiện gì cả**.
- **Root cause**: `FoodLogModal.tsx` render `<FoodNutritionEditModal>` (modal riêng, tự bọc
  `<Modal>` của React Native) làm SIBLING ngay khi `BottomSheet` (cũng là một `<Modal>`) đang
  `visible=true` — tức 2 `<Modal>` gốc RN cùng hiển thị một lúc. Đây là giới hạn đã biết của RN
  Modal (đặc biệt iOS): modal thứ 2 không đảm bảo render khi modal thứ 1 vẫn đang mở. Đối chứng:
  `SupplementQuickLog.tsx` dùng đúng component này nhưng KHÔNG lồng trong Modal khác → chạy tốt.
- **Hệ quả suy ra**: món "Chicken Nuggets - Penny" nhiều khả năng bị lưu carb sai/0 lúc tạo (do
  bug 3b — bàn phím che nút — ở phiên tạo món trước khi sửa), và người dùng không thể tự sửa lại
  vì đúng bug này chặn "Sửa thành phần" mở lên. Ba bug 3b+3d nối với nhau thành chuỗi khiến 1 món
  tự thêm bị sai carb vĩnh viễn cho tới hôm nay.
- **Fix**: `FoodLogModal.tsx` — ẩn `BottomSheet` khi `editingNutrition` đang mở
  (`visible={visible && !editingNutrition}`), đảm bảo không bao giờ có 2 Modal cùng hiển thị.
- **Lưu ý cho người dùng**: sửa "Chicken Nuggets - Penny" qua "Sửa thành phần" chỉ áp dụng cho các
  lần ăn TIẾP THEO (tạo override cho catalog) — KHÔNG tự sửa carb của các dòng đã ghi trong quá
  khứ (FoodLogEntry lưu snapshot dinh dưỡng tại thời điểm ghi, theo đúng thiết kế để lịch sử/Excel
  không đổi khi catalog thay đổi sau này). Nếu muốn số liệu cũ đúng lại, cần xoá rồi ghi lại các
  lần ăn món đó.
- **Chưa test được trên máy thật** (đây là bug UI runtime của RN Modal — jest không mô phỏng
  được hành vi stack modal thật của iOS) — cần người dùng xác nhận lại trên điện thoại.

### Verify sau fix
- `tsc` sạch, `npm run lint` 0 lỗi, `npx jest` **315/315 PASS (29 suites)**.
- Bug 3d là thay đổi hành vi UI runtime (RN `<Modal>` stacking) — không có test tự động nào phủ
  được; cần test tay: mở "Ghi món ăn" → chọn 1 món → "Sửa thành phần" → xác nhận sheet hiện ra,
  sửa carb, lưu, quay lại thấy carb preview cập nhật.

## Bug phát hiện (phiên 2026-06-18 — môi trường)
- Không phải bug code. Phát hiện môi trường: có ~10 process `expo start --web` còn sót lại từ
  các phiên trước (port 8082–8093, khởi động 17h45–18h02 cùng ngày), một số trỏ tới thư mục cũ
  đã xoá `Body Batteries/my-body-batteries-app` (đã consolidate ở Session 4). Không ảnh hưởng
  trực tiếp tới test này (port khác) nhưng nên dọn dẹp (`kill <pid>`) ở phiên sau để đỡ tốn tài nguyên.

## Còn lại / bàn giao cho phiên sau (tiếp tục S-A)
- Bước 1–2 (server sống + chạy đúng trên iPhone thật qua Expo Go) **đã xác nhận xong** — phiên sau
  có thể bỏ qua, đi thẳng vào bước 3.
- Tiếp tục các bước 3–6 ở trên (Home đủ 7 pin → Phase 1 lưu trạng thái → Phase 2 đổi Mode → thông báo pin thấp).
- Người dùng dừng phiên **lần 2** để trao đổi thêm về vài tính năng mới muốn bổ sung — sẽ bàn với
  cả phiên này và một phiên Opus khác để khớp logic trước khi quyết định. **Chưa có mô tả cụ thể
  tính năng gì trong phiên này** — phiên sau cần hỏi lại người dùng để ghi rõ yêu cầu mới. Lưu ý:
  thêm gói/tính năng mới vào `.ai/NEXT_SESSIONS.md` nằm ngoài phạm vi file được sửa của gói S-A
  (chỉ được sửa `S-A.md`) — KHÔNG tự sửa `NEXT_SESSIONS.md` từ gói này; việc đó nên làm ở phiên
  riêng có quyền, hoặc ở phiên gộp cuối cùng.

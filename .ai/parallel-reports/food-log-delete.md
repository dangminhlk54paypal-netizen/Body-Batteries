# Xoá món ăn ghi nhầm — kiểm tra & xác nhận

## Bắt đầu (2026-06-18)

**Yêu cầu:** Người dùng muốn thêm chức năng xoá cho trường hợp ghi nhầm đồ ăn. Hỏi lại để xác
định phạm vi → người dùng chọn: món ghi qua **"🍱 Ghi món ăn (từ danh sách)"** (KHÔNG phải nạp
tay "Ăn thêm (kcal)" hay nạp trực tiếp pin nhỏ — 2 cái đó hiện chưa có log nên thật sự chưa xoá
được, nhưng không thuộc phạm vi lần này).

**Đã đọc trước khi code (đúng luật `.ai/CONTEXT.md` mục 3 — không code mà chưa hiểu hiện trạng):**
- `src/components/TodayMeals.tsx`
- `src/screens/HomeScreen.tsx`
- `src/store/energyStore.ts` (hàm `removeFood`)
- `docs/07-food-log.md` mục 3b

**Phát hiện:** Tính năng này **ĐÃ CÓ SẴN từ Session 5**, commit
`4f8c09f Food Log: today's meals view (grouped, daily kcal, delete)`:
- Home → cuộn xuống mục **"Hôm nay đã ăn"** → mỗi món có nút **"✕"** → bấm ra hộp xác nhận
  *"Xoá món đã ghi?"* → bấm **"Xoá"** → `removeFood(id)` (`energyStore.ts:265-295`):
  - Xoá entry khỏi `foodLog` (state + DB qua `deleteFoodLogEntry`).
  - **Hoàn lại pin Năng lượng** (`burnEnergy` nghịch — trừ đúng `entry.energyKcal` đã nạp).
  - **Hoàn lại các pin dinh dưỡng** (Protein/Carbs/Water/Minerals) bằng `applyIntake(r, -amt)`.
  - Có `try/catch` quanh phần persistence, không crash UI nếu lưu DB lỗi.
- Đọc kỹ không thấy bug trong logic hoàn pin hay xoá DB.

**Việc tiếp theo:** Hỏi người dùng test trực tiếp trên máy xem nút "✕" có hoạt động đúng như mô
tả không (xem câu hỏi gửi kèm trong hội thoại) — vì code đọc tĩnh không thấy lỗi, tránh sửa lại
một tính năng không hỏng.

## Kết thúc (2026-06-18, đóng phiên — chưa test được trên điện thoại)

**Lý do đóng phiên ở đây:** Người dùng hiện không thể cầm điện thoại để test (lý do cá nhân).
Vì tính năng có vẻ đã chạy đúng qua đọc code tĩnh, **không tự ý sửa code thêm** ("đừng sửa cái
chưa chắc đã hỏng") — để dành việc xác nhận + (nếu cần) debug cho phiên sau.

**Kết luận của phiên này — KHÔNG có code nào bị sửa cho yêu cầu "thêm nút xoá":**
Tính năng xoá món ăn ghi nhầm (qua "🍱 Ghi món ăn") **đã tồn tại đầy đủ từ Session 5**, không
phải làm mới. Phiên này chỉ xác nhận lại bằng đọc code, chưa xác nhận bằng máy thật.

**⚠️ Ghi chú quan trọng về git — để phiên sau không bối rối:**
Trong lúc phiên này đang chạy, có **nhiều phiên Sonnet 4.6 khác chạy song song trên cùng repo**
(đúng theo cơ chế `.ai/NEXT_SESSIONS_UX.md`/`NEXT_SESSIONS.md`) đã tự commit phần việc của họ:
- `3372fc7 UX U2: fix keyboard covering buttons in Food Log modal` — **trùng** với việc phiên này
  đã làm cho gói U2 trước đó (sửa `FoodLogModal.tsx` để bàn phím không che nút — bọc vùng nhập
  gram/giờ trong `ScrollView` + `flexShrink: 1`). Nội dung khớp nhau nên không mất gì, không có
  conflict — chỉ là 2 phiên trùng việc, file đã đúng trong working tree (đã `grep` lại xác nhận
  `entryScroll`/`flexShrink` còn nguyên trong `FoodLogModal.tsx`).
- `52a2656 UX U3: fix chart date labels...`, `3140f01 docs: reconcile session docs (S-J)...`,
  `da2acc9 Add B1 energy-balance spec...` — của các phiên khác, không liên quan việc xoá món ăn.
- **Vì lý do trên, phiên này CHỦ ĐỘNG KHÔNG sửa `.ai/SESSION_LOG.md` / `.ai/CONTEXT.md` mục 10**
  (file dùng chung, đang có khả năng một phiên khác — S-J — cũng đang ghi vào, thấy
  `.ai/NEXT_SESSIONS_UX.md` đang ở trạng thái "staged deleted" lúc đọc git status). Đúng luật
  vàng của dự án: mỗi phiên ghi report riêng ở `.ai/parallel-reports/`, để phiên GỘP dồn vào
  `SESSION_LOG.md` sau, tránh ghi đè nhau.

**Việc CHÍNH XÁC phiên sau cần làm (để đóng hẳn yêu cầu "xoá món ăn ghi nhầm"):**
1. Mở app trên điện thoại (Home screen).
2. Ghi 1 món ăn bất kỳ qua nút "🍱 Ghi món ăn (từ danh sách)" (xem `EnergyActionsBar.tsx`).
3. Cuộn xuống mục **"Hôm nay đã ăn"** (component `TodayMeals.tsx`, render trong
   `HomeScreen.tsx` ngay dưới `BatteryStack`) — xác nhận món vừa ghi xuất hiện, nhóm theo bữa.
4. Bấm nút **"✕"** cạnh món đó → xác nhận hộp thoại *"Xoá món đã ghi?"* hiện đúng tên món →
   bấm **"Xoá"**.
5. Kiểm tra: món biến mất khỏi danh sách; pin Năng lượng (`LiveMasterBattery`) tăng lại đúng
   bằng kcal của món vừa xoá; nếu món có ghi nhận đạm/tinh bột/nước/khoáng thì các pin nhỏ liên
   quan cũng tăng lại tương ứng (so trước/sau bằng mắt là đủ, không cần đo chính xác).
6. Tắt app hẳn rồi mở lại (đảm bảo `deleteFoodLogEntry` đã lưu xuống DB, không chỉ xoá trong
   RAM) → món đã xoá KHÔNG được hiện lại.

**Nếu bước nào ở trên SAI** (món không xoá được / vẫn hiện sau khi mở lại app / pin không hoàn
đúng), bắt đầu debug ở 3 chỗ này theo đúng thứ tự:
- `src/store/energyStore.ts:265-295` (hàm `removeFood`) — logic hoàn pin + xoá entry.
- `src/data/repositories/foodLogRepository.ts` (hàm `deleteFoodLogEntry`) — có xoá đúng bản ghi
  trong SQLite không (kiểm tra điều kiện `WHERE id = ?` dùng đúng `entry.id` không bị lệch định
  dạng).
- `src/screens/HomeScreen.tsx:67-77` (`handleDeleteFood`) — đảm bảo `id` truyền vào khớp với
  `entry.id` thật trong `foodLog` (không phải index hay giá trị khác).

**Nếu test ĐÚNG hết (kết quả mong đợi):** không cần code gì thêm cho yêu cầu này — chỉ cần ghi
1 dòng xác nhận vào `SESSION_LOG.md` lúc gộp tài liệu (S-J) rằng "xoá món ăn ghi nhầm — đã test
thật, hoạt động đúng", và có thể đóng hẳn item này.

**Phạm vi CHƯA làm (người dùng đã xác nhận KHÔNG cần lần này, chỉ ghi lại để biết):** xoá/sửa
cho 2 cách nạp tay khác — "🍽️ Ăn thêm (kcal)" và nạp trực tiếp pin nhỏ (`IntakeModal.tsx`) —
hiện CHƯA lưu log từng lần nạp nên chưa xoá được. Nếu sau này muốn làm, đây là việc LỚN HƠN
(cần thêm bảng/log lưu lịch sử nạp tay + UI xem lại, đụng `energyStore.ts`/DB schema), không
phải sửa nhỏ như phần Food Log.

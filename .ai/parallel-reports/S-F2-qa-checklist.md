# S-F2 — Checklist test tay: Tích hợp Apple Health (Phase 1–6, QA review)

> Viết bởi agent `qa-reviewer` (Phase 6, read-only). Tính năng này dùng
> `react-native-health` (native module) → **CHỈ test được qua bản build EAS
> dev-client** (`eas.json` profile `development`), **KHÔNG chạy được qua Expo
> Go thường**. Không có test tự động nào phủ được các bước dưới đây — Jest chỉ
> mock HealthKit, không gọi API thật.
>
> ⚠️ **Đã phát hiện 2 lỗi liên quan trực tiếp tới các bước test bên dưới** (xem
> mục "Kết quả review code" cuối file) — khi test tay, đặc biệt chú ý mục
> **5 (khởi động lại app)** và **4 (qua nửa đêm)**, khả năng cao sẽ thấy hành
> vi sai đúng như mô tả.

## Chuẩn bị
- [ ] Build & cài bản dev-client mới nhất qua EAS (`eas build --profile development`)
      hoặc chạy `npx expo run:ios` nếu đã có Xcode.
- [ ] Trên iPhone thật: mở app **Sức khoẻ (Health)** của Apple, xác nhận có ít
      nhất vài mục "Năng lượng hoạt động" / "Năng lượng khi nghỉ" hôm nay
      (đi bộ vài bước hoặc thêm thủ công 1 buổi tập trong app Sức khoẻ nếu
      máy còn trống dữ liệu).

## 1. Luồng xin quyền (permission grant)
- [ ] Xoá app khỏi máy rồi cài lại (đảm bảo prompt quyền HealthKit hiện lại
      từ đầu — iOS chỉ hỏi 1 lần/app).
- [ ] Mở app → vào màn Home → hộp thoại xin quyền Health của iOS phải hiện ra
      (không phải hộp thoại tự vẽ trong app — đây là hộp thoại hệ thống).
- [ ] Bấm **Cho phép/Allow** cho cả 2 mục "Năng lượng hoạt động" +
      "Năng lượng khi nghỉ".
- [ ] Trong vài giây, thẻ **"Cân bằng năng lượng"** trên Home phải hiện số
      kcal "Đã đốt hôm nay" khác 0, badge cạnh dòng đó hiện **"✓ Apple Health,
      đồng bộ vừa xong"** (nền xanh mint nhạt).
- [ ] Vào **Cài đặt → mục 🏥 SỨC KHOẺ** → dòng trạng thái phải hiện
      **"✓ Đã kết nối"**, "Lần đồng bộ gần nhất: vừa xong".

## 2. Từ chối quyền → rơi về ước tính BMR
- [ ] Cài lại app từ đầu (hoặc vào Cài đặt máy → Quyền riêng tư → Sức khoẻ →
      xoá quyền của app này rồi mở lại app).
- [ ] Khi hộp thoại quyền hiện ra, bấm **Không cho phép/Don't Allow**.
- [ ] Thẻ "Cân bằng năng lượng" trên Home vẫn phải hiện một số kcal (không
      phải 0, không bị treo/crash) — đây là số ước tính từ BMR hồ sơ cơ thể.
- [ ] Badge cạnh "Đã đốt hôm nay" phải đổi màu vàng/cam, chữ
      **"Ước tính (BMR) — Apple Health không khả dụng"**.
- [ ] Cài đặt → 🏥 SỨC KHOẺ → dòng trạng thái hiện
      **"⚠️ Ước tính — kiểm tra quyền Health trong Cài đặt máy"**.
- [ ] Xác nhận app **không crash**, không đứng hình khi bị từ chối quyền.

## 3. Ghi buổi tập thật trong Health.app → làm mới thủ công
- [ ] Với app đã có quyền (mục 1), mở app Sức khoẻ của Apple, thêm 1 buổi tập
      (ví dụ "Đi bộ 30 phút, 150 kcal") hoặc đi bộ thật ngoài đời cho đồng hồ
      ghi nhận.
- [ ] Quay lại app My Body Batteries → vào **Cài đặt → 🏥 SỨC KHOẺ** → bấm nút
      **"🔄 Làm mới dữ liệu Apple Health"**.
- [ ] Nút phải chuyển sang trạng thái "Đang đồng bộ…" (có vòng xoay), rồi trở
      lại bình thường, dòng "Lần đồng bộ gần nhất" đổi thành "vừa xong".
- [ ] Quay lại Home → số "Đã đốt hôm nay" phải **tăng thêm đúng khoảng** kcal
      của buổi tập vừa thêm (so với trước khi thêm).
- [ ] Test cả trường hợp bấm nút làm mới 2 lần liên tiếp thật nhanh — không
      được bị gọi API 2 lần chồng nhau / không bị lỗi giao diện (nút phải tự
      khoá lại — `disabled` khi đang `syncing`).

## 4. Ranh giới ngày (⚠️ nghi có lỗi — xem mục review code)
- [ ] Mở app lúc **23:50** (gần nửa đêm), để tự động đồng bộ 1 lần (Home tự
      load khi mở app).
- [ ] Để app **mở liên tục xuyên qua 00:00** (không kill, không background),
      quan sát tới khoảng 00:15–00:30.
- [ ] **Kỳ vọng đúng:** ngay sau nửa đêm, "Đã đốt hôm nay" phải reset về gần 0
      (ngày năng lượng mới) — không được tiếp tục hiện số kcal đã đốt của
      **ngày hôm qua**.
- [ ] **Nếu thấy:** sau nửa đêm, "Đã đốt hôm nay" vẫn giữ nguyên số to (của
      hôm qua) trong khi "Đã ăn hôm nay" đã về 0 → **đúng như nghi ngờ ở mục
      review code bên dưới, ghi lại là lỗi đã xác nhận bằng test tay.**
- [ ] Test thêm mốc 6h sáng (giờ reset "pin Năng lượng"/satiety chính của
      app) — xem thẻ "Cân bằng năng lượng" có đồng bộ với thời điểm reset của
      pin chính không, hay lệch nhịp với nó (2 khái niệm "ngày" khác nhau
      trong app: ngày lịch thường vs "ngày năng lượng" 6h sáng — xem
      `.ai/CONTEXT.md`/`dateUtils.ts`).

## 5. Tắt app rồi mở lại (⚠️ nghi có lỗi — xem mục review code)
- [ ] Đồng bộ 1 lần thành công (mục 1 hoặc mục 3), xác nhận "Đã đốt hôm nay"
      hiện số > 0 và badge "✓ ... đồng bộ vừa xong".
- [ ] **Kill hẳn app** (vuốt lên đóng hoàn toàn khỏi danh sách app đang chạy,
      không chỉ về Home).
- [ ] Mở lại app **trong vòng vài phút** (dưới 2 tiếng kể từ lần đồng bộ
      trước).
- [ ] **Kỳ vọng đúng:** "Đã đốt hôm nay" phải hiện lại đúng số kcal đã đồng bộ
      trước đó (không phải 0), badge vẫn hiện trạng thái đã biết ("✓ ..." hoặc
      "⚠️ Ước tính...").
- [ ] **Nếu thấy:** "Đã đốt hôm nay" hiện **0 kcal**, badge hiện dấu **"—"
      (Chưa đồng bộ / idle)** dù rõ ràng vừa đồng bộ thành công trước khi kill
      app → **đúng như nghi ngờ ở mục review code bên dưới, ghi lại là lỗi đã
      xác nhận bằng test tay.** (App sẽ tự "tự sửa" sau khi đủ 2 tiếng kể từ
      lần đồng bộ trước — có thể chờ và xác nhận nó tự đúng lại sau đó.)

## 6. Giao diện dark-mode
- [ ] App chỉ có giao diện tối (`app.json`) — xác nhận thẻ "Cân bằng năng
      lượng" và badge trạng thái Apple Health **đọc được rõ chữ** trên nền
      tối (không có chữ trắng trên nền trắng / chữ tối trên nền tối) ở cả 3
      trạng thái: đã đồng bộ (xanh mint), ước tính (vàng/cam), đang đồng bộ
      (vòng xoay).
- [ ] Kiểm tra màn **Cài đặt → 🏥 SỨC KHOẺ** tương tự — chữ trạng thái, nút
      làm mới đều đọc được rõ trên nền tối.

## 7. Hồi quy (regression) — các tính năng cũ không được ảnh hưởng
- [ ] Ghi 1 món ăn mới (Food Log) như bình thường → pin Năng lượng, pin
      Carbs/Protein/vi chất... vẫn cập nhật đúng như trước (không liên quan
      Apple Health).
- [ ] Ghi 1 hoạt động thủ công (Vận động → "Ghi hoạt động") như trước →
      **nút/luồng ghi vận động thủ công vẫn còn nguyên**, không bị Apple
      Health thay thế hay ẩn đi.
- [ ] % pin chính (MasterBattery) trên Home hiển thị đúng như trước khi có
      tính năng Apple Health — số kcal Apple Health **không được cộng/trừ**
      vào % pin chính hay pin phụ nào (đây chỉ là 1 thẻ hiển thị riêng, tách
      biệt).
- [ ] Sổ Nhật ký (History) hoạt động bình thường, không bị lỗi màn hình khi
      có dữ liệu Apple Health trong DB.
- [ ] Xuất Excel tuần/tháng vẫn chạy được bình thường (Apple Health không có
      mặt trong sheet nào, không được làm hỏng luồng xuất file).

---

## Kết quả review code (Phase 6 QA, không sửa file — chỉ báo lỗi)

**Nghiêm trọng — mục 5 ở trên (khởi động lại app không khôi phục số liệu):**
`src/store/energyStore.ts`, hàm `syncAppleHealthBurned` (khối `if (lastAppleHealthSync
!== null && now - lastAppleHealthSync < TWO_HOURS_MS) { set({ lastAppleHealthSync });
return; }`). Khi cache còn "mới" (<2 tiếng) — kể cả trường hợp đọc được từ DB lúc app
vừa mở lại (`getLastSyncTimestamp()`) — code chỉ cập nhật `lastAppleHealthSync`, **không
hề đọc lại `appleHealthBurnedKcal`/`appleHealthStatus` đã lưu trong DB** (hàm
`getAppleHealthBurnedForDate()` trong `healthSignalsRepository.ts` được viết ra nhưng
**không được gọi ở bất kỳ đâu** — export chết). Vì `energyStore` không dùng
`persist` middleware, state trong RAM reset về `appleHealthBurnedKcal: 0` /
`appleHealthStatus: 'idle'` mỗi lần app khởi động lại. Kết quả: mở lại app trong
vòng 2 tiếng sau lần đồng bộ trước → thẻ "Cân bằng năng lượng" hiện sai "Đã đốt hôm
nay: 0 kcal" + badge "— Chưa đồng bộ" trong suốt phần còn lại của cửa sổ 2 tiếng đó,
dù dữ liệu thật vẫn nằm trong DB. Điều này được chính bộ test mới thêm
(`src/store/__tests__/energyStore.appleHealth.test.ts`, ca "2-hour cache: a recent
in-memory lastAppleHealthSync skips re-fetching HealthKit") xác nhận gián tiếp: test
chỉ assert `appleHealthStatus` giữ nguyên `'idle'`, không hề assert lại
`appleHealthBurnedKcal` — tức đội viết code cũng chưa để ý khôi phục giá trị này.
**Đề xuất sửa:** trong nhánh cache-hit, gọi thêm `getAppleHealthBurnedForDate(todayString())`
(hàm đã có sẵn) để khôi phục `appleHealthBurnedKcal`, và suy ra `appleHealthStatus`
từ bản ghi `sync_event` gần nhất (`'synced'`/`'estimated'`) thay vì để nguyên `'idle'`.

**Nên sửa — mục 4 ở trên (cache 2 tiếng không nhận biết ranh giới ngày):**
Cùng hàm `syncAppleHealthBurned`, điều kiện cache chỉ so sánh
`now - lastAppleHealthSync < TWO_HOURS_MS` theo đồng hồ tường, **không kiểm tra xem
lần đồng bộ trước có cùng ngày lịch với hôm nay không**. Nếu app đồng bộ lần cuối
lúc 23:xx đêm hôm trước và người dùng vẫn mở app (hoặc mở lại) trong vòng 2 tiếng sau
nửa đêm, số "Đã đốt hôm nay" sẽ tiếp tục hiện tổng kcal đã đốt của **ngày hôm qua**
thay vì reset về gần 0 cho ngày mới, trong khi "Đã ăn hôm nay" (từ `foodLog`, vốn lọc
theo `todayString()`) đã đúng về ngày mới — tạo ra "Chênh lệch" sai lệch lớn, gây hiểu
lầm nghiêm trọng trong khung giờ đó. **Đề xuất sửa:** thêm điều kiện ngày lịch
(`todayString()` khớp với ngày của `lastAppleHealthSync`) vào điều kiện cache-hit,
hoặc đơn giản là luôn re-sync khi phát hiện đổi ngày kể cả cache còn "mới" theo giờ.

**Nhỏ nhặt:** `EnergyBalanceCard.tsx` tự tính `balance = eatenKcal - burnedKcal`
bằng phép trừ nội tuyến trong component thay vì gọi 1 hàm domain thuần (dự án đã có
`src/domain/energy/energyBalanceEngine.ts` làm tiền lệ cho việc này) — không sai,
chỉ là hơi lệch chuẩn "không đặt logic vào file giao diện" trong `.ai/CONTEXT.md` mục 4;
đây là phép tính rất đơn giản nên mức độ ảnh hưởng thấp, không bắt buộc sửa ngay.

**Không phát hiện vấn đề** ở: query tham số hoá trong `healthSignalsRepository.ts`
(không có string-concatenation SQL); ánh xạ trạng thái trong `appleHealthSync.ts`
(`success/permission_denied/unavailable/no_data/error` → tất cả nhánh khác `success`
đều gộp về `null` rồi rơi về ước tính BMR ở tầng store — đúng như comment mô tả, không
có nhánh nào bị nuốt mất); BMR fallback đọc `currentProfile()` **tại thời điểm gọi**
(không phải closure cũ) nên không bị "cứng" theo hồ sơ cũ nếu người dùng vừa sửa hồ
sơ; không có mutate `battery_readings.capacity`/`activityBonusKcal`/`satietyReserveKcal`
ở bất kỳ file mới/sửa nào (đã grep xác nhận); `logActivity()`/`TodayActivities` thủ
công vẫn nguyên vẹn trong `HomeScreen.tsx`; `Date.now()` không bị gọi trực tiếp lúc
render ở `EnergyBalanceCard.tsx`/`AppleHealthStatusBadge.tsx`/`SettingsScreen.tsx` —
đều dùng `useState(() => Date.now())` đúng pattern purity đã có; code 100% tiếng Anh,
chuỗi hiển thị 100% tiếng Việt, đúng luật; `tsc --noEmit` sạch, `npm run lint` sạch,
`npx jest` → **376/376 test PASS / 35 suite** (đã tự chạy lại, không phải số cũ suy
đoán).

**Lưu ý về việc badge "Xm trước" có thể lỗi thời khi app mở lâu:** cả
`EnergyBalanceCard.tsx` và `SettingsScreen.tsx` lấy `nowMs` một lần duy nhất lúc mount
qua `useState(() => Date.now())`, không có interval tick lại. Nếu người dùng để app mở
liên tục hàng giờ mà không có hành động nào khiến store re-render (đồng bộ mới, ghi
món ăn...), badge "đồng bộ Xm trước" sẽ đứng yên ở giá trị lúc mount thay vì tăng dần
theo thời gian thực. Đây là **đánh đổi UX chấp nhận được** (không sai dữ liệu, chỉ là
hiển thị "bao lâu trước" không tick theo giây/phút thật) — không cần sửa gấp, ghi chú
lại để người dùng biết khi test tay không cần coi là bug nếu thấy con số này đứng yên.

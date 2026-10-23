# Lưu trữ theo năm, tự sao lưu trước khi dọn, và Kho dữ liệu dài hạn

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Thời hạn lưu dữ liệu trong app, ước tính dung lượng, tự sao lưu + dọn, Kho (cân nặng / gym / thói quen ăn), nhắc trước hạn |
| Nhánh / commit khảo sát | `ui-upgrade` @ `4ef9d89` (+ thay đổi chưa commit) |
| Mục tiêu | Kế hoạch (bản 1) và ghi lại phần đã triển khai (bản 2) |

Chú giải: `[n]` nguồn web số n (truy cập 2026-10-23) · `[Mã: file]` rút từ code · 💡 nhận định của AI · ❓ chưa kiểm chứng.

## Tóm tắt
1. Hiện app **không tự xoá gì**. Nút "Dọn dữ liệu cũ" và lời hỏi sau bản Excel tháng chỉ xoá khi người dùng bấm, và chỉ xoá
   dữ liệu quá 35 ngày ở 4 bảng: chỉ số pin, nước/ngủ, nhật ký ngày, món ăn [Mã: src/services/cleanup/cleanupService.ts]
   [Mã: src/lib/constants.ts]. Cân nặng, vận động và sổ tập chưa bao giờ bị xoá [Mã: src/data/db/schema.ts].
2. Dữ liệu rất nhẹ. Mô phỏng đúng cấu trúc bảng của app, mỗi ngày ghi 10 món, 6 lần nước, 2 buổi vận động và 1 lần cân,
   ra khoảng **4 KB/ngày ≈ 1,5 MB/năm** (30 ngày 252 KB · 6 tháng 832 KB · 1 năm 1 528 KB · 2 năm 2 920 KB)
   [Mã: mô phỏng SQLite từ src/data/db/schema.ts]. 💡 Vì vậy dọn dữ liệu chủ yếu để gọn gàng và riêng tư, không phải để
   tiết kiệm bộ nhớ máy.
3. File sao lưu nằm trong thư mục Documents của app. iOS chỉ cho mở thư mục này trong app Tệp (Files) khi bật
   `enableFileSharing` / `UIFileSharingEnabled`, mặc định là tắt [1]. Muốn bật phải đổi cấu hình native [1], nên 💡 suy luận:
   trên Expo Go chưa làm được. Hệ quả: **xoá app là mất luôn bản sao lưu**, nên app phải nhắc người dùng chép file ra ngoài.
4. Có thể hẹn thông báo một lần vào đúng ngày (`SchedulableTriggerInputTypes.DATE`) và huỷ riêng từng thông báo theo id [2].
   Thông báo cục bộ vẫn dùng được trên Expo Go [2].
5. Lưu ý code hiện tại: hàm `cancelAllNotifications()` huỷ **mọi** thông báo đã hẹn [Mã: src/services/notifications/notificationService.ts].
   Nếu giữ nguyên, tắt nhắc nhở hằng ngày sẽ huỷ luôn nhắc hết hạn lưu trữ, nên phải sửa thành huỷ theo id.

## Đính chính
| Trước đây nói | Nguồn gốc nói | Nguồn |
|---|---|---|
| Comment trong `myFoodsBackupService.ts` / `excelExportService.ts`, và câu hướng dẫn nhập "Món của tôi" (`myFoods.import.*`): thư mục tài liệu của app "hiện trong app Files" | Documents chỉ hiện trong app Tệp khi bật `enableFileSharing` (mặc định `false`, cần đổi cấu hình native). `app.json` chưa bật [Mã: app.json] | [1] |

Đã sửa hai comment. Câu hướng dẫn nhập "Món của tôi" **chưa sửa**, vì phải đổi cả cách nhập (dùng bộ chọn file như phần Khôi phục) 💡.

## Cách hoạt động đề xuất (mặc định: lưu 1 năm, khi đầy giữ lại ½)
- **Ngày dọn** = ngày của dữ liệu cũ nhất còn trong app + thời hạn lưu.
- **Mốc cắt** = ngày dọn − phần giữ lại (mặc định ½ thời hạn = 6 tháng).
- Nhắc **3 tháng, 1 tháng, 1 tuần** trước ngày dọn. Mốc nào đã qua hoặc dài hơn cả chu kỳ thì bỏ qua (💡 ví dụ lưu 3 tháng,
  giữ ½ thì không có mốc "3 tháng trước").
- **Đến ngày dọn**, lần đầu mở app sẽ chạy theo thứ tự:
  1. Ghi Excel phần sắp xoá (dùng lại bản xuất có sẵn [Mã: src/services/export/excelExportService.ts]) và kiểm tra file
     đã có và dung lượng > 0.
  2. Nếu bật Kho thói quen ăn: chép bảng tóm tắt theo ngày của phần đó vào Kho.
  3. Xoá dữ liệu cũ hơn mốc cắt, trừ những mục nằm trong Kho.
  4. Báo đã dọn, kèm tên file và nút "Lưu bản sao ra ngoài" (mở bảng chia sẻ để chép sang iCloud Drive hoặc nơi khác).

  Nếu bước 1 lỗi thì **không xoá gì**, lần mở app sau thử lại. Nếu app không được mở thì cũng không xoá gì 💡.
- Ví dụ: dữ liệu bắt đầu 01/01/2026, lưu 1 năm, giữ ½. Nhắc vào 03/10, 02/12 và 25/12/2026. Ngày 01/01/2027 app sao lưu
  01/01–30/06/2026, xoá phần đó và giữ 07–12/2026. Lần dọn kế tiếp là 01/07/2027.

## Cài đặt (thẻ 💾 Dữ liệu, gọn theo `mobile-ui-density`)
- **Lưu trong app:** 3 tháng · 6 tháng · **1 năm** · 2 năm · Không giới hạn.
- **Khi đầy giữ lại:** ¼ · **½** · ¾ (hiện ra số tháng tương ứng).
- **Ước tính** (ⓘ giải thích cách tính): "≈ 1,5 MB trong app · lần dọn tới 01/01/2027". Cách tính: dung lượng thật của file
  DB (`PRAGMA page_count × page_size`) chia số ngày đã có dữ liệu, rồi nhân với thời hạn lưu 💡.
- **Kho dài hạn** (không bị dọn, dùng cho biểu đồ), 3 công tắc: ⚖️ Cân nặng · 🏋️ Tập gym (block, sổ tập, 1RM, buổi tập) ·
  🥗 Thói quen ăn.
- Lần đầu sau khi cập nhật, app hiện **một sheet hỏi** chọn thời hạn và các mục Kho, với cả 3 mục bật sẵn để không mất
  gì so với hiện nay. Sau đó vẫn sửa được trong Cài đặt.

## Được dọn / không bị dọn
| Dữ liệu | Khi dọn |
|---|---|
| Món ăn, chỉ số pin, nước & ngủ, nhật ký ngày | dọn |
| Kcal Apple Health | dọn |
| Cân nặng | giữ nếu bật Kho ⚖️ |
| Buổi tập trong Vận động, block, sổ tập, 1RM | giữ nếu bật Kho 🏋️ (dòng chỉ có bước chân vẫn bị dọn) |
| Tóm tắt ăn theo ngày (kcal, đạm/carb/béo, kcal theo nhóm món) | mới, giữ nếu bật Kho 🥗 |
| Nhật ký mã hoá, Món của tôi, sửa dinh dưỡng | không bao giờ dọn |

## Thay đổi so với hiện nay
- Nút "Dọn dữ liệu cũ (35 ngày)" đổi thành "Sao lưu & dọn ngay": chạy đúng quy trình trên, xin xác nhận một lần.
- Bản Excel tháng tự động vẫn giữ (đóng vai bản sao lưu hằng tháng), nhưng bỏ lời hỏi "xoá dữ liệu quá 35 ngày" ngay sau đó.
- Không động tới `DATA_RETENTION_DAYS` ở phần ghi bù ngày cũ và lịch sử vi chất, vì hai chỗ đó dùng con số này với nghĩa khác
  [Mã: src/components/food/PastDateField.tsx] [Mã: src/hooks/useMicroBatteryHistory.ts].

## Lộ trình 💡
- **Đợt 1:** cài đặt + ước tính, hàm tính lịch dọn thuần (có test), dịch vụ sao lưu-rồi-dọn, nhắc 3 tháng/1 tháng/1 tuần,
  sheet hỏi lần đầu, Kho (bảng tóm tắt ăn theo ngày). Đủ vi/en/de.
- **Đợt 2:** biểu đồ Thói quen ăn trong Lịch sử, đọc Kho + nhật ký hiện tại. Biểu đồ cân nặng đã có phạm vi "Tất cả", biểu đồ
  sức mạnh đã có sẵn.

## Đã chốt (2026-10-23) và đã làm
- Thói quen ăn: **tự tính từ món đã ghi**.
- Sao lưu: **Excel + file khôi phục `.json`**. Khôi phục bằng bộ chọn file `expo-document-picker`, thư viện có sẵn trong Expo
  Go [3]. File cũ thiếu cột mới vẫn nhập được; dòng đã có thì giữ nguyên (`INSERT OR IGNORE`).
- Xoá: **hỏi một lần**. Sau khi sao lưu xong, app hỏi **Chép bản sao lưu / Để sau / Dọn**. "Để sau" thì 7 ngày sau hỏi
  lại; vừa khôi phục xong thì 30 ngày sau mới hỏi.
- Code: `types/dataRetention.ts`, `domain/retention/` (lịch dọn, tóm tắt ăn, định dạng file khôi phục), `data/repositories/retentionRepository.ts`
  (danh sách bảng nào dọn hay giữ), `services/retention/retentionService.ts`, `components/settings/DataRetentionPanel.tsx` +
  `DataRetentionSetupSheet.tsx`, bảng mới `eating_daily_summary`. Thay thế `cleanupService.ts` (đã xoá).
- Chưa làm (Đợt 2): biểu đồ Thói quen ăn trong Lịch sử.

## Các quyết định cần chủ dự án chốt (bản 1)
1. Thói quen ăn tính tự động từ món đã ghi, hay người dùng tự gắn nhãn kiểu ăn? 💡 Đề xuất tự động. App chưa có nhóm
   "fast food", nên dùng tỷ lệ "Món chế biến + Bánh & ăn vặt + Dầu mỡ & đường" làm thước đo gần đúng.
2. Định dạng sao lưu: chỉ Excel (đọc được nhưng không nhập lại vào app), hay thêm file khôi phục được? 💡 Đề xuất Excel trước.
3. Đến hạn thì xoá hoàn toàn tự động sau khi sao lưu thành công, hay vẫn cần một lần bấm đồng ý? Code hiện có nguyên tắc
   "không bao giờ xoá âm thầm" [Mã: src/services/cleanup/cleanupService.ts].

## Tài liệu tham khảo
- [1] Expo SDK 58 — FileSystem, mục cấu hình `enableFileSharing`: https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
  (dùng cho: Documents chỉ hiện trong app Tệp khi bật `UIFileSharingEnabled`, mặc định `false`, cần đổi cấu hình native) —
  truy cập 2026-10-23.
- [2] Expo SDK 58 — Notifications: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/ (dùng cho: trigger `DATE`,
  `cancelScheduledNotificationAsync`, thông báo cục bộ dùng được trên Expo Go) — truy cập 2026-10-23.

- [3] Expo SDK 58 — DocumentPicker: https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/ (dùng cho: "Included in Expo Go",
  `getDocumentAsync` với `type` / `copyToCacheDirectory`, kết quả `canceled` / `assets[].uri`) — truy cập 2026-10-23.

## Lịch sử chỉnh sửa
| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản kế hoạch đầu tiên, chờ duyệt |
| 2026-10-23 | 2 | Ghi quyết định đã chốt + phần đã làm, thêm Đính chính (app Tệp) và nguồn [3] |

# Skill: mobile-ui-density (Giao diện gọn — chống ngợp thông tin)

## Mục đích
Người dùng nhìn app trên màn hình điện thoại nhỏ. **Quá nhiều chữ trên một màn = choáng ngợp.** Skill này gom các
nguyên tắc giao diện người dùng (chủ app) đã yêu cầu và duyệt qua nhiều lần tinh chỉnh (Session 40–48), kèm component
mẫu đã có sẵn trong code để dùng lại, không viết lại từ đầu.

Gọi skill này **mỗi khi** tạo hoặc sửa bất kỳ thứ gì người dùng nhìn thấy: màn hình, thẻ, danh sách, sheet, form.
Đi cùng luật i18n trong `AGENTS.md` (không chữ cứng, đủ 3 ngôn ngữ vi/en/de).

---

## 1. Nội dung dài → gói vào một "cửa sổ" nhỏ, cuộn bên trong
Bấm mở một mục **không được** làm nội dung đổ ào xuống dài vô tận.
- Đặt nội dung trong `ScrollView` có `maxHeight` cố định (≈ 1/2 màn hình) + `nestedScrollEnabled`. Người dùng kéo
  bên trong khung đó.
- Mẫu có sẵn:
  - `TrainingLogPeriodSection` (Sổ tập): tháng mở ra cao tối đa 320, đủ cho khoảng 2 tuần.
  - `BlockPlanView` (Kế hoạch block): `WEEK_WINDOW_HEIGHT = 380` cho mỗi tuần.
  - `BlockScheduleEditor` (Lịch tuần): khung cao 300.

## 2. Thông tin nhiều tầng → gập theo từng tầng
Ví dụ **Tháng › Tuần › Ngày**: mở tháng mới thấy tuần, mở tuần mới thấy ngày.
- **Accordion:** màn nhiều mục ngang hàng thì chỉ mở **một mục một lúc**, mặc định gập hết. Mẫu:
  `SettingsSection` + `openSection` trong `SettingsScreen`.
- **Tiêu đề khi gập vẫn phải có ích:** thêm một dòng tóm tắt giá trị hiện tại, ví dụ "Nhắc 20:00 · báo pin < 20%".
- **Tự gập:**
  - Mục không phải hiện tại tự gập sau 2 phút không chạm (`TrainingLogPeriodSection`: `onTouchStart` đặt lại bộ đếm).
  - Mục đã cuộn qua khỏi màn tự gập kiểu "cầu trượt nước": `domain/training/scrollFold.ts` +
    `maintainVisibleContentPosition` để màn không giật.
- **Thao tác tay luôn thắng tự động:** người dùng tự mở hoặc gập thì **nhớ lại**, không để cuộn làm mở lại. Chỉ bỏ
  lựa chọn khi có mốc mới (tuần mới). Mẫu: `store/planFoldStore.ts`, lưu trên máy bằng `persist`.
- **Mục "hiện tại" mở sẵn:** tuần này, tháng này. Mục quá khứ gập sẵn.
- **Danh sách khối chi tiết trên một màn tổng quan** → **tường gạch** `components/ui/BrickFoldGrid` (chủ app duyệt
  2026-10-26, thay `FoldRow` dạng danh sách): mỗi khối một ô vuông icon · keyword · **số chính** bên dưới; hàng 1–3 ô,
  số ô các hàng **so le** (2 · 3 · 2) để đường nối không thẳng hàng như xếp gạch, ô rộng theo độ dài tiêu đề
  (`lib/brickLayout.ts` — `packBrickRows`, thuần, có test). Bấm ô → khối mở thành khung **ngay dưới tường** (đầu khung:
  icon · tên · ⓘ · ⌃ để gập), `maxBodyHeight` cho danh sách dài; mở một ô một lúc hoặc tối đa 3 với ⧉. Khối bên
  trong nhận prop `embedded` để bỏ tiêu đề trùng. Số tóm tắt tính ở domain (mẫu: `HomeScreen` +
  `domain/battery/homeDetailsSummary.ts`).

## 3. Thông tin phụ → giấu sau một lớp biểu tượng
Chọn biểu tượng theo chức năng, không để chữ giải thích nằm sẵn trên màn:

| Biểu tượng | Dùng cho | Component / cách làm |
|---|---|---|
| **ⓘ** | giải thích, cách tính, lưu ý dài | `components/ui/InfoPopover` (popup Modal). ⚠ Không đặt trong `BottomSheet`: 2 Modal chồng nhau trên iOS sẽ ẩn cái trên. |
| **✎** | sửa | nút tròn nhỏ, chỉ có biểu tượng bút chì (không kèm chữ "Sửa trang/Chia sẻ") |
| **＋** | thêm | nút nhỏ, hoặc gộp vào menu của ✎ |
| **⌄ / ⌃** | mở / gập | cuối hàng tiêu đề |
| nhấn giữ | thao tác hiếm (đổi tên, xoá) | `Alert` menu |
| nhấn giữ (biểu đồ, vòng pin, thẻ bữa ăn) | lưu vào Ảnh / chia sẻ ảnh | `hooks/useHoldToShare` (destructure `{ ref, onLongPress }` — lint react-hooks/refs chặn `hold.ref`); view chụp cần `collapsable={false}` + nền đặc. Có poster đầy đủ (bữa ăn, sức mạnh) thì giữ = chia sẻ poster, không chụp khung đang cuộn |
| **⏰ ✓** | trạng thái (đã hẹn / đã ghi) | chip nhỏ màu; bấm vào để mở menu |

- Chữ in nhỏ (mô tả, công thức, disclaimer) để trong ⓘ. Trên màn chỉ còn một dòng ngắn, nếu thật cần.
- **Số liệu chính = một dòng số + chip keyword**, câu đầy đủ vào ⓘ. Ví dụ dưới pin tổng: `2.150 / 2.000 kcal` rồi
  chip `+150 dư` `🏃 +300` `🎯 ↓ 72 kg` ⓘ (mẫu: `MasterBattery`). Chip màu theo nghĩa (dư = warning, vận động = mint).
- Chữ nào dài quá thì **viết ngắn lại trước**, ví dụ "Xuất Excel 7 ngày gần nhất" thành "Excel 7 ngày". Chỉ khi thật
  sự dài mới đưa vào ⓘ.

## 4. Mục giống nhau lặp lại → viết tắt / số, và trượt ngang
- Thứ trong tuần: dải **T2 T3 … CN** / **Mo Tue …**, lấy từ `weekdayLabel(dow, language, 'short')` (Intl, không cần
  từ điển). Có chấm màu = có dữ liệu.
- Tuần hoặc block: chỉ **B3W4** (số do người dùng nhập), không kèm ngày dài trong tiêu đề. Ngày đưa xuống thân mục.
- Tên bài tập: viết tắt như Sổ tập (`movementLabel`: B, S, PB, iC…), in đậm màu xám. Tên đầy đủ để trong ⓘ.
- Chuyển giữa các mục ngang hàng bằng **trượt**: `ScrollView horizontal pagingEnabled` + dải chọn phía trên (bấm dải →
  `scrollTo`). Mẫu: `BlockScheduleEditor`.
  - ⚠ Trong `BottomSheet`, gesture kéo sheet phải là `activeOffsetY([-10,10]).failOffsetX([-15,15])` (đã có sẵn), nếu
    không vuốt ngang sẽ kéo cả sheet.

- **Chuyển giữa các tab chính:** vuốt dài ngang ở bất kỳ đâu trên màn (vòng tròn, hai chiều, kiểu pager: trang kề
  thật trượt vào theo tay), bấm tab vẫn giữ nguyên. Mọi lần đổi tab, **các màn trượt qua nhau** (không đổi đột ngột):
  `navigation/SlideTabNavigator.tsx` (navigator riêng) + `TabSwipe.tsx` (`withTabSwipe`) + `mainTabs.ts`. Dải trượt ngang bên trong màn tự thắng
  (bắt pan sớm hơn) — không cần làm gì thêm khi thêm `ScrollView horizontal` mới.

- **Thanh tab dưới = "sóng bong bóng":** chạm và lướt ngang trên thanh, icon phồng/nhấc theo đường cong quanh ngón
  tay, tab dưới ngón tay mở ngay (`navigation/BubbleTabBar.tsx` + `bubbleWave.ts`). Thêm tab mới: thêm vào
  `MAIN_TABS` / `MAIN_TAB_META` trong `mainTabs.ts`.
- **Khối tổng quan người dùng tự chọn nội dung (vòng pin nhỏ):** ✎ tròn nhỏ ở cuối hàng tiêu đề → sheet lưới chip
  bật/tắt rộng bằng nhau (3 cột, chia nhóm), áp dụng ngay, footer **Mặc định | Xong**. Hình tự chia đều theo số mục;
  chú thích chọn số cột cho hàng đều (4 → 2×2, 8 → 4×2). Mẫu: `RingMetricsSheet` + `domain/battery/ringMetrics.ts`.
  Màu trùng nhau (Carbs và Béo cùng vàng) → mục phụ đổi sang màu dự phòng.
  - **Không chặn im lặng:** bấm mà không có tác dụng (chạm giới hạn) phải hiện chữ báo, không chỉ rung — chủ app
    tưởng nút hỏng (Session 60: trần 8 mục làm Salt/Sodium/Iron "bấm không ăn").
  - **Nhóm phụ quá 3 mục → hình nhỏ ở góc** của hình to (vòng vi chất ở góc trên phải), chạm để đổi to/nhỏ; chú
    thích chỉ theo hình to. Thay cho giới hạn số mục.
  - **Số tổng ("x/y đạt") đếm mọi mục người dùng đã chọn**, kể cả mục kiểu "giới hạn" (đạt = còn dưới trần, sau khi
    đã có dữ liệu trong ngày).

- **Danh sách thẻ ngang hàng (Cài đặt…) xếp A–Z theo tiêu đề đã dịch**: `sortByLabel(items, labelOf, language)`
  (`lib/sortByLabel.ts`) — không xếp cứng theo tiếng Việt.

- **Hàng ô lặp lại (pin vi chất…) phải đều ở mọi ngôn ngữ:** ô rộng cố định, hàng `alignItems: 'flex-start'` (không
  `flex-end` — chữ dài bên dưới sẽ đẩy hình lên), dưới hình đúng N dòng `numberOfLines={1}` + `adjustsFontSizeToFit`,
  dùng **tên ngắn** (`nutrients.<id>.short`), gộp số thành `hiện/mục tiêu + đơn vị`; caption dài vào a11y label và sheet
  khi chạm. Mẫu: `MicroCell` trong `MicroBatteryStack`. Kiểm tra bằng tiếng Đức.

- **Form trong sheet/Modal:** thân cuộn (`ScrollView` maxHeight ~58% màn, `keyboardShouldPersistTaps="handled"`), nút
  **Huỷ | Lưu** ghim ở đáy ngoài vùng cuộn; ô nhập đi cặp hai cột với nhãn ngắn phía trên (Phút | Bước, Từ | Đến); chữ
  một dòng tự co. Nhập dở được giữ (lỡ tay đóng thì mở lại tiếp tục trong 5 phút), Huỷ mới xoá. Mẫu:
  `ActivityLogSheet` + `store/activityDraftStore.ts`.

## 4b. Ô số liệu (thẻ thống kê) — mắt thấy số quan trọng trước
Khi một thẻ so sánh vài đối tượng ngang hàng (S / B / D…), thay các dòng chữ bằng **một hàng ô rộng bằng nhau**:
- Viền trên 3px màu của đối tượng + nhãn viết tắt cùng màu (màu = nhận diện, không tô màu cho số chính).
- **Số chính to, đậm, màu chữ chính** (độ tương phản cao nhất), tự co một dòng.
- Thay đổi = **▲ xanh (`statusGood`) / ▼ cam san hô (`statusLow`) / = xám** — mũi tên luôn đi kèm màu.
- Số phụ (e1RM, ★ kỷ lục) nhỏ, mờ, mỗi thứ một dòng cố định (giữ chỗ bằng " " để các ô cao bằng nhau).
- Phụ đề, công thức, gợi ý thao tác → ⓘ cạnh tiêu đề; chế độ xem (kg | Ratio) là segmented nhỏ ở góc phải tiêu đề;
  hành động (⭐, ⤴) là nút tròn icon cạnh dòng ngữ cảnh. Mẫu: `TrainingProgressChart` + `liftDeltaAt`.
- Biểu đồ nào cũng có **⤴ nhìn thấy được** (không chỉ nhấn giữ — chủ app không tự tìm ra thao tác ẩn); ảnh chia sẻ là
  poster riêng (thương hiệu, ngày, số chính, biểu đồ), không chụp khung trên màn. Mẫu: `ShareWeightCard`.

## 5. Bảng / dòng thay vì đoạn văn
- Mỗi mục một dòng, theo cột: **tên | giá trị | ⓘ | ✎**. Mẫu: hàng bài tập trong `BlockPlanView` (`tableRow`).
- Không lặp nhãn trên mỗi dòng (bỏ "Kế hoạch:", "Tổng buổi:"…). Số phụ như kcal để nhỏ, bên phải.
- **Số dinh dưỡng app tự tính (theo khẩu phần lẫn /100 g): tối đa 1 chữ số thập phân** (chủ app, Session 72b cho khẩu
  phần — G7 16 g: carb `12.2`, không phải `12.1552`; Session 75 cho /100 g — 103,1 kcal / 30 g → `343.7` kcal/100 g,
  không phải `343.666666667`). Vi chất nhỏ tới mức làm tròn ra 0 thì giữ 1 chữ số có nghĩa (`0.01` mg) để lưu lại form
  không xoá mất nó. Chỉ làm tròn **số hiện ra**: số người dùng gõ được lưu nguyên, phép quy đổi lúc lưu vẫn đủ chính
  xác (ô đang hiện số đã làm tròn thì lưu đúng số đó). Mẫu: `formatNutritionNumber`
  trong `domain/food/customFoodInput.ts`; dòng chữ thì `toLocaleString(LOCALE_TAGS[language], { maximumFractionDigits: 1 })`
  (`FoodLogModal` "kcal / 100g", bảng xem trước của `LibrarySourcesPanel`).

## 6. Cân đối, đối xứng
- Mọi hàng cài đặt cùng một khuôn: **nhãn trái, điều khiển phải, cao tối thiểu 52** (`SettingRow` trong
  `SettingsScreen`).
- Lựa chọn 2–4 phương án thì dùng **segmented rộng bằng nhau** (`Segmented`), không dùng chip dài ngắn khác nhau.
- Nhóm nút hành động thì dùng **lưới ô vuông 2×2** (`Tile`), nút nguy hiểm viền đỏ.
- Hàng nhiều ô nhập có nhãn dài ngắn khác nhau: `justifyContent: 'flex-end'` để các ô nhập thẳng hàng ở đáy.
- Stepper nhỏ (nút 28) đặt cùng hàng với nhãn. Kiểm tra độ rộng với **tiếng Đức** (chữ dài nhất).
- Bật/tắt 3 mục ngang hàng (Kho ⚖️ 🏋️ 🥗): **một hàng chip bằng nhau**, icon trên chữ, bật = viền accent
  (`accessibilityRole="switch"`), thay cho 3 hàng `Switch` riêng. 5 phương án ngắn (3 th · 6 th · 1 năm · 2 năm · ∞):
  segmented với nhãn viết tắt, tên đầy đủ đọc qua `accessibilityLabel`. Mẫu: `components/settings/DataRetentionPanel.tsx`.
- Lưới `Tile` có 5–6 hành động thì xếp **2×3** cho đều, nút nguy hiểm đặt cuối.
- Câu hỏi chỉ cần hỏi một lần (thiết lập lần đầu): `BottomSheet` + chính panel trong Cài đặt + nút "Lưu lựa chọn". Vuốt
  xuống chỉ ẩn trong lần mở app này. Mẫu: `DataRetentionSetupSheet`.

## 7. Chọn từ danh sách dài → vừa gõ vừa cuộn
- Ô tìm kiếm + danh sách chia nhóm, cuộn được, lọc **không dấu, không cần đúng thứ tự từ**:
  `matchesSearch` / `foldSearchText` (`domain/energy/blockSchedule.ts`).
- Picker hiện **thay chỗ** khung đang xem (không mở thêm Modal chồng lên), có nút Huỷ.

## 7b. Danh sách duyệt trước khi ghi nhiều mục cùng lúc (Session 70)
Khi app đoán ra nhiều mục từ một câu (Nạp bằng chữ), người dùng duyệt rồi mới ghi. Mẫu: `components/food/TextMealEntry.tsx`.
- Mỗi dòng 2 tầng: **☑ · trạng thái · tên · ✎** / giờ · bữa · **− lượng +** · kcal. Tối đa 2 dòng ghi chú nhỏ bên dưới.
- Trạng thái bằng **ký hiệu + màu**: ✓ `statusGood` (chắc), ⚠ `statusMid` (cần để ý), ✗ `statusLow` (không ghi được, ô
  tick khoá). Không dùng đỏ.
- **Trùng:** luôn nói rõ trùng với cái gì ("Đã nạp Ức gà 150g lúc 11:30"), bỏ tick sẵn, người dùng tick lại được. Không
  tự gộp.
- Sửa một dòng, chọn món, đặt giờ cho cả danh sách: hiện **thay chỗ** danh sách, footer **Huỷ | Xong**.
- Dòng tóm tắt trên danh sách: **🕐 giờ chung ▾** (bấm để đặt cho tất cả) bên trái, **n món · kcal** bên phải. Nút chính
  ghi đúng số sẽ ghi: "Nạp n món ⚡".
- Hướng dẫn cú pháp nằm sau **ⓘ bật/tắt tại chỗ** (không dùng `InfoPopover` vì đang trong `BottomSheet`).
- Ô nhập có nhiều nguồn: **một hàng 3 nút rộng bằng nhau** ngay dưới ô (**📤 Hỏi AI | 📋 Dán | Phân tích**), nút
  chính viền `accent`, chữ một dòng tự co (kiểm tra bằng tiếng Đức). Dán mà clipboard trống → hiện một dòng chữ
  `statusMid` ("Chưa có gì để dán…"), không im lặng.
- **Lối vào nhanh bằng chữ / giọng nói cho cả Nạp lẫn Xả:** một nút **⌨️ 🎤** riêng, rộng hết hàng, kiểu nút phụ (viền
  `border`, nền `bgElevated`), đặt **ngay dưới** cặp nút chính ⚡ Nạp | 🔥 Xả — không giấu trong một nhánh (chủ app chọn,
  Session 74). Mẫu: `EnergyActionsBar` → `FoodLogModal startInText`.
- **Mục app không nhận ra** (món lạ, môn tập lạ): dòng ✗ khoá tick, ghi chú "Bấm ✎ để chọn", người dùng chọn — **không
  tự đoán, không tự tạo mục mới** (chủ app chọn, Session 74).

## 8. Màu & chủ đề
- Chỉ dùng token trong `lib/theme.ts` (`c.accent`, `c.textMuted`…). Màu mới thì thêm cho **cả dark lẫn light** và
  kiểm tra độ tương phản trong dark theme.
- Phân tầng bằng kiểu chữ trước khi thêm màu: tiêu đề đậm, ngày nghiêng, số phụ nhỏ mờ.
- **Màu mức độ = 3 vùng, không phán xét:** `c.statusGood` (đủ) / `c.statusMid` (hơi chậm) / `c.statusLow` (chậm rõ —
  san hô dịu). Không dùng `danger`/`dangerStrong` cho "thiếu" hay "thâm hụt": đỏ chỉ để xoá dữ liệu và cảnh báo an
  toàn thật. Màu luôn đi kèm chữ/ký hiệu. Cân bằng calo tô theo mục tiêu (`profileGoalDirection` +
  `isBalanceTowardGoal`), không theo dấu +/−.
- **Chữ trên nền cam** (`c.accent`, ví dụ segment đang chọn, nút Lưu): dùng `c.onAccent` (tối, ~10:1) — không dùng
  `textPrimary` (trắng, ~1,6:1) hay `c.bg` (hỏng ở giao diện Sáng).
- Chữ chính giao diện Tối là trắng dịu `#F0F0F7`, không phải `#fff`.
- **Nền đổi màu toàn app (Session 61, chủ app duyệt):** quầng màu dịu trôi chậm *sau* mọi tab, màu theo pin Năng
  lượng cơ thể (`lib/ambientBackground.ts`), loé hổ phách một nhịp khi ghi món. Vẽ **một lần** sau navigator
  (`components/AmbientBackground.tsx` trong `AppNavigator`), nên các trang trượt qua mà nền đứng yên. Màn/khối mới
  phủ kín màn hình phải thêm `useScreenBackground()` sau style nền (`style={[styles.container, screenBg]}`), nếu không
  nó che mất quầng màu. Thẻ (`bgCard`) giữ nền đặc cho dễ đọc. View dùng giữ-để-lưu-ảnh cần nền đặc **chỉ lúc chụp**
  (mẫu `BatteryRing`: bật nền đặc, chờ 2 frame, rồi chụp).
- **Cỡ chữ người dùng chỉnh được (Session 62):** khối chữ dày đặc (Sổ tập) có hàng chip **Nhỏ / Vừa / Lớn** trong sheet
  ⚙︎ của nó, mặc định **Nhỏ**; cỡ gốc giữ ở `createStyles`, áp hệ số inline bằng `notebookFontSize(base, size)`
  (sàn 11pt). Ô xem trước trong sheet đổi cỡ theo ngay.
- **Người dùng quyết định (Session 63):** gợi ý của app (plan, tạo tự động) chỉ là điểm xuất phát. Thao tác làm
  thay đổi phần còn lại (nghỉ một tuần) → `Alert` cho **chọn cách** ("Dời các tuần sau" / "Bỏ tuần này"), luôn có ↺ để
  bỏ ra. Mục đã bỏ vẫn hiện nhưng mờ (`opacity 0.45`) + chip nhỏ "Không tập · ↺". Cặp chip ngang hàng: `Nghỉ` | `✓ Sẽ tập`.
- **Ô tự gõ có gợi ý không bắt buộc:** gõ ≥ 2 ký tự → tối đa 4 chip gợi ý từ thư viện ngay dưới ô; bấm chip điền tên,
  không bấm vẫn lưu đúng chữ người dùng gõ (mẫu `BlockAccessoriesSheet`).
- **Màu trạng thái của ô kế hoạch (Session 65, chủ app duyệt):** đã làm = xanh lá **nhạt** (`c.planDoneBg` + viền
  `c.planDoneBorder`), chưa làm = màu mặc định của thẻ (trắng ở theme Sáng), bỏ = xám (`c.planSkippedBg`, mờ nhẹ). Màu
  nền đặc, không dùng alpha, để chữ trên ô giữ độ tương phản.
- **Hai cách nhìn cùng dữ liệu (Session 65):** segmented "📅 Theo tuần | 🏋️ Theo bài" ở đầu khối. "Theo bài" = chip
  chọn mục → lưới hàng × cột (ô vuông, khung cao tối đa 360, cột hẹp thì cuộn ngang); bấm ô → khung sửa **ngay dưới
  lưới** (không mở sheet), ô đang sửa viền cam. Phần nhập tách thành component dùng chung cho cả sheet lẫn khung inline
  (mẫu `BlockLiftGrid` + `VariationSetsEditor`).
- **Thứ tự trong tab:** thứ hút mắt (đồ thị tiến độ) đặt **trên**, chi tiết dài (sổ tập) bên dưới.
- **Tab mở đầu:** chọn bằng hàng icon tab trong Cài đặt → Giao diện (`Segmented` icon-only kèm `a11yLabel`). Áp dụng từ
  lần mở app sau, không kéo người dùng khỏi trang đang xem.

- **Đánh giá nhanh trong ô (RPE):** buổi đã tập có một chip nhỏ "RPE ?" (hoặc số đã chọn); chạm mới mở hàng chip số
  ngay trong ô, chạm lại số đã chọn để xoá. Thang giải thích 1 dòng nhỏ dưới chip (mẫu `RpeChips`).
- **Gợi ý của engine = thẻ có nút, không tự đổi:** 1 câu lý do + nút hành động ngắn (＋2,5 kg, ＋1 set) + "Bỏ qua" xám;
  bỏ qua thì nhớ, không hỏi lại (mẫu `RpeCoachCard`).

- **Sửa cả block theo một bài ("Form"):** chip chọn bài vuốt ngang → 1 ô số gốc (TM) + "Áp dụng" + ⓘ cách gõ → danh sách
  dòng trong cửa sổ cuộn cố định, mỗi dòng 1 ô gõ + dòng kết quả nhỏ (kg + %). Nhiều dòng sửa rồi lưu một lần
  ("Lưu 3 dòng"), dòng đang sửa viền màu nhấn, lỗi viền đỏ (mẫu `BlockFormView`).

## 9. Chip keyword "trạng thái + việc nên làm"
- Tối đa **3 chip**, mỗi chip ≤ 3 từ, có số khi số giúp hành động ("Thiếu 30g đạm", "Uống thêm 2 ly"). Chỉ hiện điều
  cần chú ý; thứ đúng nhịp thì không hiện. Mẫu: `HomeKeywordChips` + logic thuần `domain/battery/homeKeywords.ts`.
- Nhắc theo **nhịp trong ngày**, không đòi cả phần còn lại từ sáng sớm; "chưa có dữ liệu" (0 bước, chưa ghi ngủ)
  ≠ "thiếu" → không hiện chip.
- Bấm chip = mở đúng chỗ xử lý (dùng lại hành động sẵn có, ví dụ bấm vào pin).
- Cùng hình dạng chip với `MasterBattery` (cỡ 12, đậm 600, nền `bgElevated`, bo 10) — một kiểu chip cho cả Home.
- Khoá dịch ghép động (`keywords.${id}Short`) không được `usedKeys.test.ts` bắt → thêm test riêng như
  `i18n/__tests__/homeKeywordKeys.test.ts`.

---

## Checklist trước khi báo "xong" một thay đổi UI
- [ ] Mở mục bất kỳ: nội dung có nằm trong khung cố định, không chảy dài vô tận?
- [ ] Có tầng nào nên gập mà đang mở hết? Mục hiện tại có mở sẵn không?
- [ ] Còn đoạn giải thích nào nằm sẵn trên màn mà nên vào ⓘ không?
- [ ] Nhãn lặp lại (thứ, tuần, bài) đã viết tắt chưa? Có cần trượt ngang không?
- [ ] Hàng/nút có cân đối (cùng chiều cao, cùng độ rộng)?
- [ ] Thao tác tay của người dùng có bị tự động ghi đè không?
- [ ] i18n: chữ mới có đủ vi/en/de. `src/i18n/__tests__/usedKeys.test.ts` xanh (bắt khoá đặt nhầm mục).
- [ ] `npm run verify` xanh → đẩy EAS preview + checklist test cho người dùng (xem `eas-preview-publish`).

## Cập nhật skill này
Mỗi khi người dùng duyệt hoặc tinh chỉnh một kiểu hiển thị mới, thêm nó vào mục tương ứng ở trên (kèm tên component
mẫu). Đây là bước bắt buộc của `session-wrapup` (Bước 5b).

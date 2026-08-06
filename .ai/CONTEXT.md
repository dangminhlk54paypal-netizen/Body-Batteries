# 🧭 AI CONTEXT — Luật làm việc của dự án My Body Batteries

> **AI: đọc file này TRƯỚC KHI làm bất cứ việc gì.** Đây là luật bắt buộc cho mọi phiên làm việc.

---

## 1. Ngôn ngữ (QUAN TRỌNG NHẤT)

- 💬 **Nói chuyện với người dùng: 100% tiếng Việt.** Giải thích, hỏi, đề xuất — đều bằng tiếng Việt, đơn giản, dễ hiểu cho người non-tech.
- 💻 **Code & comment trong code: 100% tiếng Anh.** Tên biến, hàm, file, commit message, comment — tất cả tiếng Anh.
- Không trộn lẫn: đừng viết comment tiếng Việt trong code, đừng giải thích cho người dùng bằng tiếng Anh.

## 2. Người dùng là ai

- Người dùng **không biết lập trình** (non-tech).
- Họ mô tả mong muốn bằng tiếng Việt; việc của AI là biến thành code.
- Khi cần họ làm thao tác (cài đặt, bấm nút), hãy **hướng dẫn từng bước rất cụ thể**, không giả định kiến thức.
- Luôn giải thích "vì sao làm vậy" ngắn gọn, không dùng thuật ngữ khó mà không giải thích.

## 3. Quy trình làm việc mỗi session

1. Đọc `CONTEXT.md` (file này) — đặc biệt mục **10. Trạng thái hiện tại**.
2. Đọc `.ai/SESSION_LOG.md` → xem "Session tiếp theo phải làm" của session gần nhất.
3. Đọc `docs/04-roadmap.md` → xác nhận đang ở Phase nào.
4. Báo cho người dùng: "Chúng ta đang ở Phase X, việc tiếp theo là Y. Bắt đầu nhé?"
5. Làm **từng bước nhỏ**, mỗi bước cho người dùng chạy thử trên điện thoại rồi mới đi tiếp.
6. **Kết thúc session:** gọi skill `session-wrapup` để cập nhật tài liệu.

## 4. Nguyên tắc code

- Ngôn ngữ: **TypeScript**. Stack: **React Native + Expo** (xem `docs/02-tech-stack.md`).
- Tuân thủ cấu trúc thư mục trong `docs/03-architecture.md`. Không đặt logic vào file giao diện.
- Code rõ ràng hơn là code "thông minh". Ưu tiên dễ đọc.
- Mỗi file một nhiệm vụ. Hàm ngắn, đặt tên rõ.
- **Đa ngôn ngữ (BẮT BUỘC từ Session 14):** mọi chữ hiển thị cho người dùng
  (UI, Alert, Excel) phải đi qua hệ dịch `src/i18n/` — KHÔNG hardcode chuỗi
  vào component; key mới thêm vào `locales/vi.ts` trước rồi dịch đủ
  `en.ts`/`de.ts`. Luật đầy đủ (đọc trước khi đụng UI): `AGENTS.md` mục
  "MANDATORY RULE: UI text & i18n". Thêm ngôn ngữ mới: skill `add-language`.
- Khi tạo file mới, nói rõ cho người dùng: file tên gì, nằm ở đâu, làm gì.
- Trước khi viết tính năng lớn, mô tả kế hoạch ngắn bằng tiếng Việt để người dùng duyệt.

## 5. Ranh giới về sức khoẻ (BẮT BUỘC)

App này **KHÔNG phải thiết bị y tế**. Khi làm bất kỳ tính năng "sức khoẻ/dự báo":
- Không bao giờ đưa ra **chẩn đoán bệnh**. Chỉ nói về **xu hướng / mẫu hình**.
- Luôn kèm disclaimer: *"Đây chỉ là tham khảo, hãy gặp chuyên gia y tế."*
- Không tạo mục tiêu dinh dưỡng cực đoan, không khuyến khích nhịn ăn / rối loạn ăn uống.
- Nếu người dùng đặt mục tiêu có vẻ nguy hiểm cho sức khoẻ, nhẹ nhàng nêu lo ngại.

## 6. Hệ thống Agents & Skills

> **Nâng cấp 2026-07-03:** hệ agents được "bắc cầu" sang Claude Code native — bản đầy đủ của
> mỗi agent giờ nằm ở **`.claude/agents/`** (nguồn sự thật DUY NHẤT); `.ai/agents/` chỉ còn
> con trỏ. Trong Claude Code, agent được spawn tự động chạy song song, mỗi agent context riêng
> (giải đúng bài toán mục 9). Cần **khởi động lại Claude Code** sau khi sửa file agent/hook.

- **Agents** (`.claude/agents/` — 5 vai: architect, mobile-frontend, logic-backend, data-ml,
  qa-reviewer): cách gọi *"Dùng agent mobile-frontend làm X"*. Riêng `qa-reviewer` không có
  quyền sửa file (chỉ báo lỗi — đúng luật "không sửa thầm lặng").
- **Skills** (`.ai/skills/`): quy trình tái sử dụng (session-wrapup, learn-pattern, ...). Xem
  `.ai/skills/README.md`. Bài học từ bug lặp lại ghi ở `.ai/skills/learned/`.
- **Hooks tự động** (`.claude/settings.json`): (1) mỗi lần AI sửa file `.ts` trong `src/` →
  tự chạy ESLint đúng file đó, có lỗi thì bắt sửa ngay; (2) khi kết phiên mà `src/` có thay
  đổi → nhắc chạy verify + session-wrapup.
- **Cổng kiểm tra trước khi báo "xong":** `npm run verify` (= tsc + eslint + jest, 1 lệnh).

## 7. Điều KHÔNG được làm

- Không tự ý cài thêm thư viện lớn mà không giải thích lý do cho người dùng.
- Không xoá dữ liệu/file của người dùng mà chưa hỏi.
- Không bỏ qua các bước test trên điện thoại để "chạy nhanh".
- Không viết code tiếng Việt; không nói chuyện tiếng Anh.
- Không đánh dấu `[x]` hoặc "Test thật ✅" khi chưa có xác nhận từ người dùng.

## 8. Kết thúc session — BẮT BUỘC

Sau mỗi session (hoặc sau `git push` / `git merge`), AI chạy skill:

```
Chạy skill session-wrapup
```

Skill tự đọc git log và cập nhật đồng bộ:
- `.ai/SESSION_LOG.md` — thêm entry mới cho session
- `.ai/CONTEXT.md` mục 10 — cập nhật trạng thái
- `docs/04-roadmap.md` — cập nhật checklist

**Cài git hooks** (nhắc nhở tự động sau commit/push) — chạy 1 lần:
```bash
bash .ai/scripts/install-hooks.sh
```

---

## 📌 Tóm tắt dự án (để AI nắm nhanh)

**My Body Batteries** = app di động theo dõi năng lượng cơ thể, hiển thị như pin xe điện. Có pin tổng + các pin nhỏ (Protein, Đường, Khoáng chất...). Có Modes (tập/duy trì/nghỉ), tự reset hàng ngày, nhắc nhở khi pin cạn, xuất Excel hàng tuần rồi tự dọn dữ liệu, nhật ký riêng tư, và (về sau) lớp thông minh dự báo xu hướng từ dữ liệu cá nhân + đồng hồ thông minh.

---

## 9. Tối ưu Tokens & Chống suy giảm ngữ cảnh (QUAN TRỌNG)

Để đảm bảo AI chạy nhanh và không bị quên (context rot):
- **Giới hạn đọc file (Subagent Scoping):** Chỉ đọc các file trực tiếp liên quan đến tính năng đang làm. KHÔNG yêu cầu AI đọc toàn bộ file kiến trúc hoặc các file của component khác nếu không thật sự cần thiết.
- **Dọn dẹp bộ nhớ (Strategic Compacting):** Cứ sau 4-5 prompts hoặc sau khi chốt một file lớn, hãy chủ động tóm tắt lại và ngừng nhắc lại các lỗi đã sửa thành công để tiết kiệm token.
- **Tự động học hỏi (Continuous Learning):** Gặp bug lặp lại, hãy gọi skill `learn-pattern` để ghi chép vào `.ai/skills/learned/`.

---

## 10. Trạng thái hiện tại ← AI ĐỌC MỤC NÀY ĐẦU TIÊN

> Mục này do skill `session-wrapup` tự cập nhật sau mỗi session.

**Cập nhật lần cuối: 2026-08-06 (Session 23, xem `.ai/SESSION_LOG.md`).** **Powerlifting: nút
"Dùng làm mẫu" nạp set buổi tập trước.** Người dùng phản ánh mỗi buổi ghi squat/bench/deadlift phải
gõ lại toàn bộ set từ đầu, dù hôm sau thường chỉ đổi chút tạ/rep. `PowerliftingSheet.tsx` — mỗi tab
giờ có nút "📋 Dùng làm mẫu" cạnh dòng "Buổi trước": nạp khởi động + bài chính của buổi gần nhất
**đúng tab đang chọn** vào form đang nhập, ghi đè rows hiện tại. Cố ý nạp **thủ công theo từng tab**
(không tự động cả 3 bài khi mở sheet) để tránh ghi khống bài không tập hôm đó khi lưu. Không cần
bảng lưu trữ mới — tái dùng lịch sử `activity_log` sẵn có (60 ngày). `npm run verify` PASS (tsc +
eslint sạch, **540/540 test**). **CHƯA commit, CHƯA TEST MÁY THẬT.** Lưu ý: va chạm 2 session Claude
Code song song **lần thứ 2** khi ghi session log (1 cửa sổ khác vừa thêm Session 22 — Excel
auto-fit-cột cùng lúc) — đã đọc lại state mới nhất và đổi số phiên này thành Session 23, không mất
dữ liệu; xem chi tiết Session 23 trong SESSION_LOG.

**Trước đó — Session 22 (2026-08-06, xem `.ai/SESSION_LOG.md`).** **Excel: tự động fit độ
rộng cột theo nội dung.** Người dùng phản hồi cột Excel xuất ra không fit nội dung. Thêm hàm
`autoFitColumns()` trong `excelExportService.ts` — đo độ dài thật của header + mọi giá trị mỗi cột,
set `wch` tương ứng, cận dưới 8 ký tự, cận trên **64 ký tự (~12cm, theo yêu cầu người dùng nâng từ
mốc 6cm ban đầu)**. Áp dụng cho toàn bộ 8 sheet (trước đó chỉ 2/8 sheet có width cố định đoán tay,
6 sheet còn lại không có width nào). `npm run verify` PASS (tsc + eslint sạch, **540/540 test**).
**CHƯA commit, CHƯA test tay** (mở file Excel thật xem cột có fit không).

**Trước đó — Session 21 (2026-08-01, xem `.ai/SESSION_LOG.md`).** **UI: nâng cấp khả năng
tiếp cận (accessibility) + phân cấp thông tin Home**, theo hướng "thân thiện với đa số người dùng
mọi lứa tuổi/giới tính/nghề nghiệp" (ưu tiên accessibility hơn chạy theo trend thẩm mỹ 2026).
`accessibilityRole`/`accessibilityLabel`/`accessibilityState` cho `BatteryCell`/`MasterBattery`/
`ModeSelector`/2 nút CTA chính (`EnergyActionsBar`) — trước đó VoiceOver không đọc được gì từ SVG
pin. Đo contrast ratio thật (WCAG) phát hiện `textCool`(2 theme)/`warning`(sáng) dưới ngưỡng AA
4.5:1 → sửa hex (giữ hue, đổi độ sáng); 3 chỗ hiển thị số liệu thật đổi từ `textMuted`/`textFaint`
sang `textDim` (không đụng token gốc — dùng ở ~20 chỗ khác ngoài phạm vi). Cỡ chữ 10px→12px ở 3 chỗ
đó + `maxFontSizeMultiplier={1.5}` cho nhãn dán sát đồ hoạ SVG cố định. Thêm hiệu ứng scale-down khi
giữ nút (mode chip + 2 CTA). Component mới `src/components/ui/CollapsibleSection.tsx` gom các khối
"xem thêm" trên Home vào 1 khối "Chi tiết hôm nay" thu gọn được, mặc định mở. `npm run verify` PASS
(tsc + eslint sạch, **540/540 test**). **CHƯA commit/push, CHƯA TEST MÁY THẬT.** Lưu ý: giữa session
có va chạm với 1 cửa sổ Claude Code khác chạy song song (xoá mất bản nháp qua `git reset`) — đã xử
lý, xem chi tiết + cách nhận diện nhanh trong SESSION_LOG Session 21.

**Trước đó — Session 20 (2026-07-29, xem `.ai/SESSION_LOG.md`).** **Fix: pin nhỏ hiện tổng
đã log hôm nay, không phải mức đã xả.** Người dùng phát hiện pin Protein hiện "101g (56%)" trong
khi "Hôm nay đã ăn" hiện "139.8g" — do MỌI pin phụ bị xả dần theo giờ (`tickDrain`) giống pin Năng
lượng, đúng cho ẩn dụ "cạn dần" nhưng sai khi đọc dưới nhãn tưởng là "đã ăn hôm nay". Sửa cho cả 6
pin (Protein/Carbs/Nước/Khoáng chất/Ngủ/Vận động): file mới `src/domain/battery/
dailyBatteryTotals.ts` tính tổng THẬT từ `foodLog`/`activityLog`/`intakeLog` (không đụng
`battery_readings.level`); `BatteryStack.tsx` hiện nhãn `đã log/capacity` (vd `139.8/180g`,
`1.5/2.5L`, `6000/8000 bước`) thay level đã xả, **% giữ nguyên như cũ** theo yêu cầu; sheet "xem
nguồn" (`BatterySourceSheet.tsx`) có cùng lỗi ở dòng "Tổng hôm nay", cũng đã sửa; kcal Vận động giờ
lấy THẬT từ `activityLog.energyKcal` thay vì ước lượng từ mức đã xả. `npm run verify` PASS (tsc +
eslint sạch, **519/519 test**). Đã `git push` lên `origin/ui-upgrade` (commit `759cdf7`).
**CHƯA TEST MÁY THẬT** — việc tiếp theo là mở app qua Expo Go và kiểm tra cả 6 pin.

**Trước đó — Session 18 (2026-07-29, xem `.ai/SESSION_LOG.md`).** **Tap-to-see-sources cho
10 pin vi chất:** bấm vào bất kỳ pin nào trong `MicroBatteryStack` (fiber/sắt/canxi/fat/kẽm/omega3/
đường/muối/natri/kali/magiê) giờ mở `MicroBatterySourceSheet` — liệt kê đúng những món ăn đã ghi
trong ngày đang xem (kể cả 6 ngày trước qua date-picker, không chỉ hôm nay) đóng góp bao nhiêu vào
pin đó, tính lại trực tiếp từ per-100g của từng món (hàm `microBatterySourceRows()` trong
`microBatteryEngine.ts`) vì `FoodLogEntry` không snapshot vi chất — giống hệt hành vi
`BatterySourceSheet` đã có cho Protein/Carbs/Khoáng chất/Vận động. i18n đủ VI/EN/DE. `npm run
verify` PASS (tsc + eslint sạch, **507/507 test**). **CHƯA TEST MÁY THẬT.**

**Trước đó — Session 17 (2026-07-17, xem `.ai/SESSION_LOG.md`).** UI feedback round 3: đổi tên nút
"⚡ Nạp"/"🔥 Xả" (bỏ modal ăn thêm kcal tay), giao diện Sáng/Tối, sheet khuyến nghị hàng ngày khi bấm
pin Năng lượng, fix parse dấu phẩy thập phân (`parseDecimal()`), màu biểu đồ Dinh dưỡng/Năng lượng
phân biệt rõ, ghi vận động cho tối đa 3 ngày quá khứ. `npm run verify` PASS, **503/503 test**.
**CHƯA TEST MÁY THẬT.**

**Trước đó — Session 16 (2026-07-17, xem `.ai/SESSION_LOG.md`).** **Popup minh bạch công
thức** ở Cài đặt → Hồ sơ cơ thể: 2 con số kcal ("Nhu cầu năng lượng ước tính" và "Mục tiêu
calo/ngày") giờ **bấm được** (gạch chân + ⓘ) → mở popup nhỏ giữa màn hình giải thích từng bước
tính với đúng số liệu đang nhập (BMR Mifflin-St Jeor → × hệ số vận động → + kcal bước chân;
mức duy trì → Δkg×7 700 → chia ngày → chặn an toàn ≤20%/≤750 kcal/không dưới BMR). Số hiển thị
lấy từ chính hàm engine nên luôn khớp; i18n đủ VI/EN/DE. `npm run verify` PASS (tsc + eslint sạch,
**460/460 test**). **CHƯA TEST MÁY THẬT.** Cùng ngày trước đó: **Session 15 — S-BB Bodybuilding
theo nhóm cơ** (MET-tier × cường độ × set, ~45 bài/8 nhóm cơ, đã commit `eaf1de0`, cũng chưa test
máy thật — checklist 17 bước trong SESSION_LOG Session 15).

**Trước đó — Session 14 (2026-07-17, xem `.ai/SESSION_LOG.md`):** Tích hợp **đa ngôn
ngữ (Việt/Anh/Đức)** cho toàn bộ giao diện + file Excel xuất ra, chọn từ mục "🌐 NGÔN NGỮ" đầu màn
Cài đặt. Module mới `src/i18n/` — tự viết (không dùng i18next), dựa trên `settingsStore.language`
(Zustand + AsyncStorage có sẵn) + hook `useT()` chỉ theo dõi đúng field `language` nên đổi ngôn
ngữ không vẽ lại cả app, không giật/khựng. `en.ts`/`de.ts` được `tsc` ép kiểu khớp chính xác cấu
trúc `vi.ts` — không thể "quên dịch" 1 chuỗi mà không bị `tsc` báo lỗi. Migrate toàn bộ ~460 chuỗi
trên 33 file giao diện (4 màn hình + ~29 component) qua 1 lượt tự làm phần lõi/domain nhạy cảm +
4 wave `mobile-frontend` subagent tuần tự. Cố ý giữ nguyên tiếng Việt cho tên món ăn ĐÃ GHI vào
Nhật ký (snapshot lịch sử, không viết lại). Verify: `tsc`/`eslint` sạch toàn dự án, **444/444 test
PASS**, `expo export --platform web` bundle sạch 1104 module. **CHƯA TEST MÁY THẬT** (đổi ngôn ngữ
mượt, không giật — cần người dùng xác nhận trên điện thoại). Chi tiết đầy đủ:
`.ai/SESSION_LOG.md` Session 14 (2026-07-17), `docs/02-tech-stack.md`, `docs/03-architecture.md`
mục "🌐 Đa ngôn ngữ", `docs/excel-report.md` mục 0.

**Trước đó — Session 12/13 (2026-07-15 → 07-16, chưa từng cập nhật vào mục này — xem
`.ai/SESSION_LOG.md` để biết chi tiết):** Xem chi tiết dinh dưỡng món ăn (bottom sheet vi chất),
đồng bộ 2 chiều pin Vận động ↔ pin Năng lượng, 3 bài powerlifting (squat/bench/deadlift MET), rồi
**S-PL** (ghi powerlifting theo set×rep×tạ, mô hình năng lượng hybrid) + 6 hạng mục UX (custom
activities, hiển thị nguồn nạp pin, khuyến nghị nước/ngủ, muối & vi chất, thu gọn micro section).
**443 test PASS** lúc đó, CHƯA test máy thật.

**Trước đó — Cập nhật 2026-07-10 (Session 19).** Gói **S-F2 — tích hợp Apple Health** (tự động lấy
kcal đốt trong ngày, hiện cạnh kcal đã ăn): thiết kế kiến trúc qua agent Fable (5 quyết định — đồng
bộ lúc mở app + nút tay, giữ ghi vận động thủ công làm dự phòng, breakdown để v1.1, chỉ hiện tổng
kcal ở v1.0, fallback về ước tính BMR nếu Apple Health từ chối quyền/lỗi), triển khai qua 3 subagent
tuần tự (`logic-backend`→`mobile-frontend`→`qa-reviewer`). **CODE XONG, ĐÃ VERIFY, ĐÃ COMMIT** (xem
chi tiết `.ai/SESSION_LOG.md` Session 19, `.ai/parallel-reports/S-F2.md`/`S-F2-ui.md`/
`S-F2-qa-checklist.md`). Thư viện `react-native-health` (mới, `package.json`) bridge native HealthKit
→ **không chạy được qua Expo Go**, bắt buộc build dev client (`eas build --profile development
--platform ios`, `eas.json` đã có sẵn profile). Chỉ hiển thị — không đụng `battery_readings.capacity`/
`activityBonusKcal`/`satietyReserveKcal`, hệ pin/satiety hiện có giữ nguyên. QA agent tìm 1 bug
nghiêm trọng (cache-restore không khôi phục `appleHealthBurnedKcal` sau khi mở lại app → hiện sai
0 kcal) đã tự sửa + thêm test. Verify: `tsc` sạch · `npm run lint` sạch · **377 test PASS / 35 suite**
(từ 320). **CHƯA TEST MÁY THẬT** (cần build dev client trước — xem checklist
`.ai/parallel-reports/S-F2-qa-checklist.md`).

**Trước đó — Cập nhật 2026-07-10 (Session 18).** Tiếp tục S-A (test máy thật, bước 3) — người dùng
báo 2 đợt feedback thật khi ăn "chicken nuggets" tự thêm 350g: pin Carbs/pin vi chất không nạp
đúng + form "Thêm món mới" bị bàn phím che nút Lưu; sau khi vá, người dùng test lại và lộ thêm modal
"Sửa thành phần" bấm không hiện gì. **ĐÃ COMMIT** (commit `c0f2dd9`, nhánh `ui-upgrade`).
4 bug đã sửa: **(3a)** `scripts/generate-usda-db.js` map sai nutrient number cho đường/xơ (bản
Foundation Foods 2026 đổi số phân tích mới: đường 269→269.3, xơ thêm 293) + carb "by difference" âm
chưa clamp → sửa NUTRIENT_MAP ưu tiên số mới + clamp 0, chạy lại `npm run gen:usda`. **(3b)**
`BottomSheet`/`FoodLogModal`/`FoodNutritionEditModal` thiếu `flexShrink: 1` → ScrollView không co
theo bàn phím, nút Lưu bị đẩy khuất → thêm `flexShrink: 1` cả 3 chỗ. **(3c)** chốt quy ước
**Carbs = tổng carbohydrate LUÔN chứa đường+xơ** (bất biến `carb_g >= sugar_g + fiber_g`) — enforce ở
`foodCsv.ts`, `customFoodInput.ts`, `generate-usda-db.js` + sửa tay 4 dòng vi phạm trong
`food_items.csv`. **(3d) — phát hiện ở lượt test lại:** 2 `<Modal>` React Native chồng nhau
(`BottomSheet` + `FoodNutritionEditModal` cùng `visible=true`) khiến modal "Sửa thành phần" không
render (giới hạn đã biết của RN trên iOS) — fix: ẩn `BottomSheet` khi modal sửa đang mở. Bug 3b+3d
nối chuỗi: món tự thêm bị lưu carb sai lúc tạo (3b) rồi không tự sửa lại được vì "Sửa thành phần"
bị chặn (3d). **Tính năng mới (yêu cầu người dùng cuối session):** đổi đơn vị hiển thị/nhập ml↔L cho
pin Nước — dữ liệu vẫn 1 biến ml duy nhất, chỉ thêm `src/lib/units.ts` (pure, có test) +
`waterDisplayUnit` persist trong `settingsStore` + nhãn pin Nước bấm được để đổi đơn vị + 2 chip
ml/L khi nạp nước trong `IntakeModal`. Verify: `tsc` sạch · `npm run lint` sạch ·
**320 test PASS / 30 suite** (từ 299). **Bug 3d là hành vi runtime RN Modal — KHÔNG có test tự động
phủ được, bắt buộc người dùng test tay trên điện thoại để xác nhận.** Ghi chú thêm: một phiên song
song khác đã thêm `.ai/parallel-reports/S-S-backfill-spec.md` (spec "ghi lùi món ăn ngày đã qua",
chưa code) — không phải việc của session này. Chi tiết đầy đủ: `.ai/SESSION_LOG.md` Session 18,
`.ai/parallel-reports/S-A.md`.

**Trước đó — Cập nhật 2026-07-09 (Session 17).** 3 fix từ feedback thực tế của người dùng, **ĐÃ COMMIT** (commit `<TBD>`,
nhánh `session-5-demo-ready`, **chưa push origin — ahead nhiều commit**): (1) **Fix #1 — Hoàn tác món ăn đúng energy-day**
(mốc reset 6h sáng) — thêm `energyDayApplied` vào `FoodLogEntry`, snapshot ngày năng lượng khi log; `removeFood` hoàn tác
trên đúng sổ ngày lịch sử nếu khác ngày hiện tại (cùng nguyên nhân, cùng cách sửa với Fix #5 Vận động từ Session 16 nhưng
bị bỏ sót cho thực phẩm). (2) **Fix #2 — Sửa món ăn** — thêm `updateFood()` vào store (reverse-then-relog), nút ✎ + modal
trong `TodayMeals.tsx`. (3) **Fix #3 — Hoàn tác nạp nhanh** — thêm `intakeLog` + `removeIntake()` vào store, component mới
`TodayIntakes.tsx` với danh sách + nút ✕. Lỗi #4 (xoá không xác nhận) → báo động giả, đã có `Alert.alert` xác nhận trong
HomeScreen từ trước → không vá. Verify: `tsc` sạch · `npm run lint` sạch · **299 test PASS / 28 suite**. **CHƯA test máy thật**
— backlog test tay dồn từ Session 11–17 chưa chạy trên điện thoại lần nào. Ghi chú kỹ thuật: chi tiết 3 fix + học hỏi từ lỗi
#1 chẩn đoán sai chỗ xem `.ai/SESSION_LOG.md` Session 17.

**Trước đó — Cập nhật 2026-07-07 (Session 13).** Hoàn tất **U7 vượt spec** (363 tên USDA dịch tiếng Việt toàn bộ trong `database/usda_names_vi.csv`, tìm kiếm gộp song ngữ `foodSearch.ts` — index bỏ dấu, ưu tiên khớp đúng dấu, món Việt trước), sửa dứt điểm **L-1** (0 lint error, 2 lỗi hoisting đã sửa), **Excel export 6 sheet** (thêm "Dinh dưỡng ngày", "Tổng kết tuần", "Bảng ngưỡng tham chiếu" + cột "Đánh giá"), mở rộng **`food_items.csv`** (73→90 món + 3 category mới + 2 cột EPA/DHA), sửa bug pin vi chất (`foodLookup.ts` getAnyFoodById bắt buộc), thêm **Omega-3 pin** (EPA+DHA 500mg) + **ô nạp nhanh supplement**. Khởi động **W-1** (dọn 23 warning) + **G-1** (thêm `name_de` 3 ngôn ngữ) chạy song parallel, agent nền. Verify trước commit: **188 test PASS / 19 suite**, 0 lint error. **TẤT CẢ CHƯA COMMIT.**

Trước đó — **Session 12 (2026-07-04):** Nâng cấp "2 đồng hồ" **XONG CODE + ĐÃ COMMIT** (`S-M`·`S-O`·`S-P`·`S-Q`): pin chính = **"Pin no/đói"** tụt dần (sàn 20%, thức 6h–23h/ngủ); dòng phụ = **"Sổ calo"** đếm lên reset 6h sáng, mục tiêu từ cân nặng mong muốn (thâm hụt an toàn). **Chưa test máy.** Cùng lúc **S-R** (pin vi chất dẫn xuất từ nhật ký) hoàn tất code. Chi tiết: `.ai/parallel-reports/S-M.md`/`S-O.md`/`S-P.md`/`S-Q.md`/`S-R.md`.

**Cập nhật lần cuối:** 2026-07-03 (Session 11 — nâng cấp quy trình: 5 native subagent trong
`.claude/agents/`, hooks tự lint + nhắc wrapup, ESLint (`npm run verify` = tsc+lint+jest), gói
**L-1** mới dọn 2 lint error tồn đọng. Cùng ngày, một phiên song song **làm xong code S-M** —
xem `.ai/parallel-reports/S-M.md`, lúc ghi dòng này **chưa commit, chưa test máy**. Chi tiết:
SESSION_LOG mục Session 11.)

**Trước đó — Session 10** (cùng ngày, Opus: tuyến dữ liệu thực phẩm USDA + chốt commit
tồn đọng. Xong **S-N** (pipeline USDA offline, BỔ SUNG món Việt), **U7 A+B** (UI tra cứu USDA
trong ghi món + dịch `name_vi` theo nhu cầu), và commit nốt **S-F** (bước chân trung bình/ngày,
làm ~2026-06-19). Verify xanh: `tsc` sạch · **103 test PASS / 12 suite** · `expo export` OK. Đã
commit tách theo gói. **Trước đó — Session 9, 2026-06-19:** xong **U4** (Nhật ký), **U5**
(Onboarding), **U6** (Cài đặt UX + khung giờ bữa ăn, gộp S-I).)

**⚠️ Việc lớn còn treo (cập nhật Session 11):** **S-M** đã **XONG CODE** (phiên song song
2026-07-03, xem `.ai/parallel-reports/S-M.md`) nhưng **chưa commit + chưa test máy** — ưu tiên
số 1: verify rồi commit S-M, sau đó test máy. **S-A** (test máy thật) nay gồm cả luồng S-M mới
lẫn **U7/USDA** (đều chưa hề chạy trên điện thoại).

**Tóm tắt 1 dòng:** App build OK (`tsc` sạch, **92 unit test PASS** / 11 suite). Pin tổng = pin
"Năng lượng" (Hướng B, sức chứa = TDEE). Session 5 đã thêm **Food Log**, pin Năng lượng **xả mượt
theo giây**, và UI polish (hiệu ứng nhấn + slide-up). Session 6 (Opus, hôm nay): (1) chốt hướng
cho 3 mục "tinh chỉnh" S-H còn treo với người dùng → viết spec đầy đủ gói **S-K** (rải xả theo
nhịp thức/ngủ) và **S-L** (ghi cân nặng theo thời gian), quyết định **không làm carry-over**;
(2) review tích hợp toàn bộ energy model — không thấy đếm trùng kcal, không lệch hiển thị
mượt/DB, chỉ thấy 1 lỗi rất nhỏ (lệch vài kcal nếu app mở đúng lúc qua nửa đêm, xem cuối
`.ai/NEXT_SESSIONS.md`); (3) phát hiện + commit hộ phần việc của một đợt UX riêng (`U1-U6`) đang
chạy song song — đã xong **U2** (sửa bàn phím che nút modal ghi món) và **U3** (sửa nhãn ngày
biểu đồ + tên pin bị cắt chữ), cộng phần đuôi đợt "polish nhấn" còn sửa dở; gộp
`.ai/NEXT_SESSIONS_UX.md` vào `.ai/NEXT_SESSIONS.md` rồi xoá file tạm đó; (4) **đã `git push` hết
lên `origin/main`** — nhánh `session-5-demo-ready` và `main` giờ giống nhau, **không còn commit
nào treo lại cục bộ**.

**Session 7 (hôm nay, tiếp nối Session 6):** Xác nhận lại gói **U3** (đề xuất 3 chỗ sửa cho người
dùng duyệt qua phân tích code + tính thử bằng Node — không có điện thoại để mở app trực tiếp lần
này) và làm xong gói **S-L** (ghi nhận cân nặng theo thời gian): `src/data/repositories/
healthSignalsRepository.ts` (`logWeight`/`getWeightHistory`, dùng bảng `health_signals` có sẵn,
không đổi schema) + `src/components/WeightLogCard.tsx` (ô nhập + danh sách text, có disclaimer
"tự nguyện, không đánh giá"), chèn vào `HistoryScreen.tsx`. Bundle tăng lên **1426 module** (2 file
mới). Đây là bước 1 cho hướng cá nhân hoá MET theo xu hướng cân nặng thật (bước 2 gộp vào S-G, cần
vài tuần dữ liệu). Ngoài ra, một phiên song song khác viết 2 spec
(`.ai/parallel-reports/B1-energy-balance-spec.md` xử lý ăn dư/overeating, rồi
`.ai/parallel-reports/S-M-energy-redesign-spec.md` đề xuất chi tiết) và **người dùng đã CHỐT
xong**: lật pin Năng lượng từ "xả dần từ đầy" sang **"đã ăn / mục tiêu" (đếm lên)**. Đã đăng ký
thành gói chính thức **S-M** trong `.ai/NEXT_SESSIONS.md` (đụng lõi `energyStore.ts` +
`energyBalanceEngine.ts` + `MasterBattery.tsx`, đề nghị làm MỘT MÌNH 1 đợt). Hệ quả: **S-K tạm
dừng** (mâu thuẫn với mô hình không-xả-theo-thời-gian mới) và **U1 gộp vào S-M** (đừng mở riêng).
S-M **CHƯA code** — đây là việc lớn ưu tiên của phiên kế tiếp.

**⚠️ Người dùng cần làm:** vào Cài đặt → Hồ sơ cơ thể, sửa **tuổi + giới tính thật** (mặc định
vẫn đang là 30/nam — `DEFAULT_USER_PROFILE` trong `settingsStore.ts`) để BMR đúng. Và hoàn tất
test thật trên máy (gói **S-A** — đã xác nhận server chạy + kết nối được iPhone qua Expo Go, còn
thiếu: xác nhận Home hiện đủ 7 pin, test Phase 1 lưu dữ liệu, test Phase 2 đổi Mode, test thông
báo pin thấp — phiên dừng giữa đường để bàn tính năng mới, chưa quay lại).

**Môi trường máy:**
- Node.js ✅ v24.16.0 / npm 11.13.0 · Homebrew + Watchman ✅ · `maxfiles` ✅ 65536 · Expo SDK ✅ 54.0.35 · `npm install` ✅
- **Bundle build:** ✅ verify OK ở Session 7 — iOS **1426 module** (`expo export --platform ios`,
  tăng từ 1424 do 2 file mới của gói S-L).
- Mạng: eduroam có "client isolation" → dùng Personal Hotspot hoặc `--tunnel`.
- Git: repo có remote `origin` (GitHub, `dangminhlk54paypal-netizen/Body-Batteries`). **Cập nhật
  2026-07-09 (Session 16): nhánh `session-5-demo-ready` đang ahead nhiều commit so với
  `origin/session-5-demo-ready` (mới nhất `7d2e6dd`, chưa push)** — đoạn "giống nhau, không còn commit nào
  treo" bên dưới đã LỖI THỜI kể từ đây, giữ lại chỉ để tham khảo lịch sử.
- **Cập nhật 2026-07-10 (Session 18):** nhánh hiện tại đã đổi thành **`ui-upgrade`** (không còn
  `session-5-demo-ready` — không rõ khi nào/tại sao đổi, ngoài phạm vi session này để điều tra).
  Toàn bộ việc của Session 18 (4 bug S-A + tính năng ml/L pin Nước) đang **CHƯA COMMIT** trên nhánh
  này — 22 file sửa + 3 file mới (`src/lib/units.ts` + test + `S-S-backfill-spec.md` từ phiên khác).
- Git hooks: ✅ Đã cài (nhắc SESSION_LOG sau commit — xác nhận hoạt động 2026-07-03). Hooks
  Claude Code (tự lint file vừa sửa + nhắc wrapup) cũng đã bật trong `.claude/settings.json`.
- Dọn dẹp môi trường (không gấp): S-A ghi nhận ~10 process `expo start --web` cũ còn sót trên các
  cổng 8082–8093, một số trỏ thư mục cũ đã xoá — có thể `kill` cho gọn, không ảnh hưởng chức năng.

**⚠️ Cấu trúc thư mục (QUAN TRỌNG):** Chỉ còn **MỘT** bản: `/Users/minh/VSCode_Repo/BodyBatteries`. Bản trùng cũ `Body Batteries/my-body-batteries-app` và symlink `BodyBatteriesApp` đã xoá. App nằm ở gốc repo. Ghi chú/ảnh tham khảo cũ ở `docs/_reference/`.

**Việc phải làm KẾ TIẾP (cập nhật Session 22 mới, 2026-08-06):** Người dùng **test tay** file Excel
xuất ra (Session 22 — auto-fit độ rộng cột, xem mục 10 phía trên) → nếu ổn, cùng lúc cân nhắc test
tay + commit luôn phần UI accessibility còn treo từ Session 21 (2026-08-01, chưa test máy/chưa
commit). Cả 2 việc đang nằm chung trên `ui-upgrade`, chưa commit gì. Backlog bên dưới (Session 16
trở về trước) là các mục CŨ HƠN, ưu tiên thấp hơn 2 việc trên:

**Việc phải làm (cập nhật Session 16 mới, 2026-07-17):** Người dùng **test tay trên điện
thoại** 2 việc mới nhất: (1) 2 popup minh bạch công thức ở Hồ sơ cơ thể (Session 16 mới — bấm
"X kcal/ngày ⓘ" và "Y kcal ⓘ", đổi số liệu/giới tính/ngôn ngữ xem popup đổi theo) → test ổn thì
commit; (2) S-BB Bodybuilding (Session 15 mới — checklist 17 bước, đã commit `eaf1de0`). Sau đó
tiếp tục backlog cũ bên dưới (đánh số theo track cũ của SESSION_LOG):

**Backlog cũ (cập nhật Session 18 track cũ, 2026-07-10):** Người dùng cần **test tay trên điện
thoại** 4 bug vừa vá + tính năng ml/L (checklist cụ thể ở cuối Session 18 trong `.ai/SESSION_LOG.md`
và `.ai/parallel-reports/S-A.md`) — đặc biệt bug 3d (modal "Sửa thành phần") là hành vi RN Modal
runtime, không có test tự động nào phủ được. Sau khi test tay ổn → **commit** (hiện toàn bộ CHƯA
COMMIT trên `ui-upgrade`) rồi tiếp tục checklist S-A còn lại. Backlog test tay vẫn còn dồn từ nhiều
session trước đó (S-M/S-O/S-P/S-Q, S-R, Session 14, Session 15, Session 16 — TPCN Gói/Viên + Vận
động Sửa/Xoá + đồng bộ pin, Session 17 — hoàn tác món ăn xuyên ngày + sửa/xoá nạp nhanh). Checklist test tay chi tiết cho Session 17
nằm cuối mục Session 17 trong `.ai/SESSION_LOG.md`; Session 16 xem cuối mục Session 16; các session
trước xem Session 14. Sau khi test tay ổn → `git push` (hiện ahead nhiều commit, chưa push).
`.ai/NEXT_SESSIONS.md` (hệ thống gói S-x/U-x cũ) **đã lỗi thời một phần** — từ Session 14 trở đi làm
việc trực tiếp theo feedback người dùng, không theo gói cũ. **S-G** vẫn để sau cùng (cần vài tuần
dữ liệu cân nặng).

**Những gì ĐÃ có trong code (không viết lại):** types, lib (constants/dateUtils/encryption/
metabolicConstants/upperLimits), domain (battery/modes/rules/energy — metabolismEngine +
energyBalanceEngine + profileValidation/food — foodNutrition + foodLogSummary + customFoodInput/
nutrition — dailyNutritionSummary + nutritionAssessment + microBatteryEngine + overdoseWarning +
excelSheets), data/db + repositories (+ food CSV loader + customFoodsRepository + foodOverrides
Repository + healthSignalsRepository), data/food (customFoodRegistry + foodOverrideRegistry +
foodLookup + foodSearch), store (energy/settings), services (notifications/export — excelExport
Service + monthlyAutoExport + monthRange/cleanup), hooks (useDrainTick, useLiveEnergyReading,
useLowEnergyWatch), components (BatteryCell/MasterBattery/LiveMasterBattery/BatteryStack/
ModeSelector/IntakeModal/EnergyActionsBar/BodyProfileCard/TrendChart/FoodLogModal/
FoodNutritionEditModal/OverdoseNotice/SupplementQuickLog/TodayMeals/WeightLogCard/
MicroBatteryStack/TodayActivities), screens (Home/History/Diary/Settings/Onboarding), navigation.
Phase 0–3 đầy đủ kể cả biểu đồ xu hướng; Phase 2 đầy đủ (nhắc nhở thật + tự xả pin + reset ngày
mới). UX: U2 (bàn phím modal ghi món) + U3 (nhãn biểu đồ/Lịch sử) + **U4** (Nhật ký: sửa lỗi ghi đè
+ UI glassmorphism) + **U5** (Onboarding) + **U6** (Cài đặt UX + khung giờ bữa ăn, gộp S-I) đã sửa
xong. Ghi nhận cân nặng theo thời gian (S-L) đã xong. **Session 14** thêm: Excel đa-sheet, món tự
thêm + sửa thành phần (override), pin Muối & điện giải, quản lý TPCN, cảnh báo vượt Upper-Limit.
**Session 16** thêm: TPCN theo Gói/Viên (`portionUnit`/`servingWeightG`), bảng `activity_log` độc
lập với Sửa/Xoá hoàn tác đúng pin (thuật toán delta) + trường giờ diễn ra, Pin Vận động/Carbs đồng
bộ real-time — xem chi tiết `.ai/SESSION_LOG.md` Session 16 (và bài học
`.ai/skills/learned/undo-reversal-must-be-delta-not-absolute-recompute.md`).
**Session 17** thêm: Hệ thống hoàn tác xuyên ngày — fix #1 hoàn tác món ăn đúng energy-day (thêm
`energyDayApplied` vào `FoodLogEntry`, bảng migration), fix #2 sửa khối lượng/số viên qua modal
(thêm `updateFood()` + nút ✎ trong `TodayMeals.tsx`), fix #3 hoàn tác nạp nhanh (thêm `intakeLog`
+ `removeIntake()` + component mới `TodayIntakes.tsx` với Alert xác nhận).

**Session 8 (Opus, cuối ngày 2026-06-18 — sau khi người dùng đóng hết các phiên song song khác):**
Kiểm tra lại toàn bộ trạng thái trước khi kết ngày. Xác nhận: không có gói nào bị bỏ dở giữa code
(mọi gói đang ✅ xong / 🆕 sẵn sàng chờ người dùng-điện thoại / ⏸ tạm dừng có lý do); 4 file tài
liệu chính (`NEXT_SESSIONS.md`, `SESSION_LOG.md`, `CONTEXT.md`, `docs/04-roadmap.md`) nhất quán,
không mâu thuẫn nhau. Chạy lại để xác nhận "xanh" tại thời điểm đóng ngày: `npx tsc --noEmit`
sạch · `npx jest` → **92 test PASS / 11 suite** · `npx expo export --platform ios` → build OK
(exit 0). Dọn 6 tiến trình `expo start --web` mồ côi còn sót từ trước Session 4 (trỏ thư mục cũ đã
xoá, ~1 ngày tuổi) sau khi xin phép người dùng — giữ lại tiến trình port 8093 (trỏ đúng project
hiện tại). Chi tiết đầy đủ quá trình chốt quyết định S-M ở `.ai/SESSION_LOG.md` mục "Session 8".

**Việc còn thiếu / sẵn sàng giao phiên sau (chi tiết & prompt copy-paste trong `.ai/NEXT_SESSIONS.md`):**
- **S-M — lật pin Năng lượng sang "đã ăn/mục tiêu"** (đã chốt 2026-06-18, đụng lõi, CHƯA code) —
  việc lớn ưu tiên nhất, xem spec đầy đủ trong `.ai/parallel-reports/S-M-energy-redesign-spec.md`
- Test thật trên điện thoại — chưa chốt (S-A)
- Bước chân v1 (nhập số trung bình/ngày, KHÔNG phải HealthKit/Health Connect) (S-F)
- ✅ U4 (Nhật ký) — xong 2026-06-19 | ✅ U5 (Onboarding) — xong | ✅ U6 (Cài đặt + khung giờ bữa ăn) — xong
- U1 đã gộp vào S-M (đừng mở riêng)
- Tích hợp Health thật (HealthKit/Health Connect, cần đổi sang dev client EAS) (S-F v2, làm sau)
- Lớp thông minh dự báo + hiệu chỉnh cá nhân hoá thật từ dữ liệu cân nặng (S-G, làm SAU CÙNG — cần
  ~1 tháng dữ liệu; bước 1 ghi dữ liệu cân nặng — S-L — đã xong)
- ⏸️ S-K (rải xả theo nhịp thức/ngủ) tạm dừng — mâu thuẫn với mô hình S-M, xem mục S-K trong
  `.ai/NEXT_SESSIONS.md`
- (Mức độ thấp, không gấp) Lệch nhỏ khi app mở đúng lúc qua nửa đêm — xem "Ghi chú review tích
  hợp" cuối `.ai/NEXT_SESSIONS.md` (lưu ý: đề xuất vá cũ gắn vào S-K nay không còn áp dụng vì S-K
  tạm dừng — cân nhắc lại khi S-M xong)

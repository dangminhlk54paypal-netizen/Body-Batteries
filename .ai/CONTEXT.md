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
- Khi tạo file mới, nói rõ cho người dùng: file tên gì, nằm ở đâu, làm gì.
- Trước khi viết tính năng lớn, mô tả kế hoạch ngắn bằng tiếng Việt để người dùng duyệt.

## 5. Ranh giới về sức khoẻ (BẮT BUỘC)

App này **KHÔNG phải thiết bị y tế**. Khi làm bất kỳ tính năng "sức khoẻ/dự báo":
- Không bao giờ đưa ra **chẩn đoán bệnh**. Chỉ nói về **xu hướng / mẫu hình**.
- Luôn kèm disclaimer: *"Đây chỉ là tham khảo, hãy gặp chuyên gia y tế."*
- Không tạo mục tiêu dinh dưỡng cực đoan, không khuyến khích nhịn ăn / rối loạn ăn uống.
- Nếu người dùng đặt mục tiêu có vẻ nguy hiểm cho sức khoẻ, nhẹ nhàng nêu lo ngại.

## 6. Hệ thống Agents & Skills

- **Agents** (`.ai/agents/`): các "vai trò" AI có thể nhập vai khi cần loại việc chuyên biệt.
- **Skills** (`.ai/skills/`): các quy trình tái sử dụng cho việc lặp đi lặp lại.
- Cách gọi: *"Chạy skill session-wrapup"* hoặc *"Dùng agent mobile-frontend"*
- Xem `.ai/skills/README.md` để biết toàn bộ danh sách.

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

## 10. Trạng thái hiện tại ← AI ĐỌC MỤC NÀY ĐẦU TIÊN

> Mục này do skill `session-wrapup` tự cập nhật sau mỗi session.

**Cập nhật lần cuối:** 2026-06-18 (Session 7 — tiếp nối Session 6: xong U3 + S-L; quyết định lớn
S-M đã CHỐT xong với người dùng, đăng ký thành gói chính thức trong `.ai/NEXT_SESSIONS.md`)

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
- Git: repo có remote `origin` (GitHub, `dangminhlk54paypal-netizen/Body-Batteries`). Nhánh
  **`session-5-demo-ready`** và **`main`** giờ **giống nhau** (đã push 2026-06-18) — không còn
  commit local nào chưa lên `origin`.
- Git hooks: ❌ Chưa cài.
- Dọn dẹp môi trường (không gấp): S-A ghi nhận ~10 process `expo start --web` cũ còn sót trên các
  cổng 8082–8093, một số trỏ thư mục cũ đã xoá — có thể `kill` cho gọn, không ảnh hưởng chức năng.

**⚠️ Cấu trúc thư mục (QUAN TRỌNG):** Chỉ còn **MỘT** bản: `/Users/minh/VSCode_Repo/BodyBatteries`. Bản trùng cũ `Body Batteries/my-body-batteries-app` và symlink `BodyBatteriesApp` đã xoá. App nằm ở gốc repo. Ghi chú/ảnh tham khảo cũ ở `docs/_reference/`.

**Việc phải làm KẾ TIẾP:** Xem **`.ai/NEXT_SESSIONS.md`** (file DUY NHẤT chứa mọi gói). **S-M**
(lật mô hình pin Năng lượng, đã chốt 2026-06-18) là việc lớn ưu tiên tiếp theo — đọc
`.ai/parallel-reports/S-M-energy-redesign-spec.md` trước, đề nghị làm MỘT MÌNH 1 đợt (đụng
`energyStore.ts`/`energyBalanceEngine.ts`/`MasterBattery.tsx`). Sẵn sàng làm song song ngay,
không đụng ai: **S-A** (test máy, luôn ưu tiên), **U4 / U5**. **S-K đang tạm dừng** (mâu thuẫn
S-M) và **U1 đã gộp vào S-M** — đừng mở riêng. Cần làm tuần tự sau khi S-M xong (đụng file chung):
**S-F / U6**. **S-G** để sau cùng (S-L đã xong bước 1 ghi dữ liệu, vẫn cần vài tuần dữ liệu thật
trước khi dùng).

**Những gì ĐÃ có trong code (không viết lại):** types, lib (constants/dateUtils/encryption/
metabolicConstants), domain (battery/modes/rules/energy — metabolismEngine + energyBalanceEngine
+ profileValidation/food — foodNutrition + foodLogSummary), data/db + repositories (+ food CSV
loader), store (energy/settings), services (notifications/export/cleanup), hooks (useDrainTick,
useLiveEnergyReading, useLowEnergyWatch), components (BatteryCell/MasterBattery/LiveMasterBattery/
BatteryStack/ModeSelector/IntakeModal/EnergyActionsBar/BodyProfileCard/TrendChart/FoodLogModal/
TodayMeals/WeightLogCard), screens (Home/History/Diary/Settings/Onboarding), repositories (+
healthSignalsRepository), navigation. Phase 0–3 đầy đủ kể cả biểu đồ xu hướng; Phase 2 đầy đủ
(nhắc nhở thật + tự xả pin + reset ngày mới). UX: U2 (bàn phím modal ghi món) + U3 (nhãn biểu
đồ/Lịch sử) đã sửa xong. Ghi nhận cân nặng theo thời gian (S-L) đã xong.

**Việc còn thiếu / sẵn sàng giao phiên sau (chi tiết & prompt copy-paste trong `.ai/NEXT_SESSIONS.md`):**
- **S-M — lật pin Năng lượng sang "đã ăn/mục tiêu"** (đã chốt 2026-06-18, đụng lõi, CHƯA code) —
  việc lớn ưu tiên nhất, xem spec đầy đủ trong `.ai/parallel-reports/S-M-energy-redesign-spec.md`
- Test thật trên điện thoại — chưa chốt (S-A)
- Bước chân v1 (nhập số trung bình/ngày, KHÔNG phải HealthKit/Health Connect) (S-F)
- Khung giờ bữa ăn sửa được trong Cài đặt + UX Cài đặt (U6, gộp S-I)
- Đợt UX còn lại: U4 (Nhật ký), U5 (Onboarding). U1 đã gộp vào S-M (đừng mở riêng)
- Tích hợp Health thật (HealthKit/Health Connect, cần đổi sang dev client EAS) (S-F v2, làm sau)
- Lớp thông minh dự báo + hiệu chỉnh cá nhân hoá thật từ dữ liệu cân nặng (S-G, làm SAU CÙNG — cần
  ~1 tháng dữ liệu; bước 1 ghi dữ liệu cân nặng — S-L — đã xong)
- ⏸️ S-K (rải xả theo nhịp thức/ngủ) tạm dừng — mâu thuẫn với mô hình S-M, xem mục S-K trong
  `.ai/NEXT_SESSIONS.md`
- (Mức độ thấp, không gấp) Lệch nhỏ khi app mở đúng lúc qua nửa đêm — xem "Ghi chú review tích
  hợp" cuối `.ai/NEXT_SESSIONS.md` (lưu ý: đề xuất vá cũ gắn vào S-K nay không còn áp dụng vì S-K
  tạm dừng — cân nhắc lại khi S-M xong)

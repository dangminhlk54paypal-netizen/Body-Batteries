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

**Cập nhật lần cuối:** 2026-06-18 (sau Session 5 + đợt song song S-A…S-E + E1-E4 + tư vấn Opus)

**Tóm tắt 1 dòng:** App build OK (bundle **1424 module** iOS, **92 unit test PASS** / 11 suite,
`tsc` sạch). Pin tổng = pin "Năng lượng" (Hướng B, sức chứa = TDEE). Session 5 thêm **Food Log**
(ghi món từ `food_items.csv` + xem/xoá "Hôm nay đã ăn"), pin Năng lượng **xả mượt theo giây**
trên màn hình, và 1 đợt **UI polish** (hiệu ứng nhấn + slide-up cho bottom sheet, chưa có báo cáo
riêng — commit `4499fab`, tác giả ghi "Claude Opus 4.8"). Đợt song song S-A…S-E + E1-E4 đã chạy
xong (chi tiết bên dưới). Một phiên Opus (2026-06-18) đã thảo luận với người dùng và chốt hướng
cho phần "tinh chỉnh" S-H còn treo → 2 gói mới **S-K** (rải xả theo nhịp thức/ngủ) và **S-L** (ghi
cân nặng theo thời gian) đã được viết spec đầy đủ trong `.ai/NEXT_SESSIONS.md`, sẵn sàng giao
phiên sau; quyết định **không làm carry-over** (giữ mỗi ngày 1 pin mới). **7 commit local trên
nhánh `session-5-demo-ready`, CHƯA push lên `origin/main`.**

**⚠️ Người dùng cần làm:** vào Cài đặt → Hồ sơ cơ thể, sửa **tuổi + giới tính thật** (mặc định
vẫn đang là 30/nam — `DEFAULT_USER_PROFILE` trong `settingsStore.ts`) để BMR đúng. Và hoàn tất
test thật trên máy (gói **S-A** — đã xác nhận server chạy + kết nối được iPhone qua Expo Go, còn
thiếu: xác nhận Home hiện đủ 7 pin, test Phase 1 lưu dữ liệu, test Phase 2 đổi Mode, test thông
báo pin thấp — phiên dừng giữa đường để bàn tính năng mới, chưa quay lại).

**Môi trường máy:**
- Node.js ✅ v24.16.0 / npm 11.13.0 · Homebrew + Watchman ✅ · `maxfiles` ✅ 65536 · Expo SDK ✅ 54.0.35 · `npm install` ✅
- **Bundle build:** ✅ verify OK — iOS **1424 module** (`expo export --platform ios`, 2026-06-18).
- Mạng: eduroam có "client isolation" → dùng Personal Hotspot hoặc `--tunnel`.
- Git: repo có remote `origin` (GitHub, `dangminhlk54paypal-netizen/Body-Batteries`). Đang ở nhánh
  **`session-5-demo-ready`**, **7 commit chưa push** so với `origin/main` (Consolidate Session 4 →
  parallel plan → Session 5 energy/E1-E4 → Food Log (2 commit) → live drain → UI polish).
- Git hooks: ❌ Chưa cài.
- Dọn dẹp môi trường (không gấp): S-A ghi nhận ~10 process `expo start --web` cũ còn sót trên các
  cổng 8082–8093, một số trỏ thư mục cũ đã xoá — có thể `kill` cho gọn, không ảnh hưởng chức năng.

**⚠️ Cấu trúc thư mục (QUAN TRỌNG):** Chỉ còn **MỘT** bản: `/Users/minh/VSCode_Repo/BodyBatteries`. Bản trùng cũ `Body Batteries/my-body-batteries-app` và symlink `BodyBatteriesApp` đã xoá. App nằm ở gốc repo. Ghi chú/ảnh tham khảo cũ ở `docs/_reference/`.

**Việc phải làm KẾ TIẾP:** Xem **`.ai/NEXT_SESSIONS.md`** — bảng tổng quan đã cập nhật trạng thái
từng gói. Sẵn sàng làm ngay: **S-A** (test máy, luôn ưu tiên), **S-J** (đang làm — chính là việc
gộp tài liệu này), **S-L** (ghi cân nặng, không đụng ai). Cần làm tuần tự (đụng file chung):
**S-F / S-I / S-K** — chỉ chạy 1 trong 3 cùng lúc. **S-G** để sau cùng (cần dữ liệu thật từ S-L).

**Những gì ĐÃ có trong code (không viết lại):** types, lib (constants/dateUtils/encryption/
metabolicConstants), domain (battery/modes/rules/energy — metabolismEngine + energyBalanceEngine
+ profileValidation/food — foodNutrition + foodLogSummary), data/db + repositories (+ food CSV
loader), store (energy/settings), services (notifications/export/cleanup), hooks (useDrainTick,
useLiveEnergyReading, useLowEnergyWatch), components (BatteryCell/MasterBattery/LiveMasterBattery/
BatteryStack/ModeSelector/IntakeModal/EnergyActionsBar/BodyProfileCard/TrendChart/FoodLogModal/
TodayMeals), screens (Home/History/Diary/Settings/Onboarding), navigation. Phase 0–3 đầy đủ kể cả
biểu đồ xu hướng; Phase 2 đầy đủ (nhắc nhở thật + tự xả pin + reset ngày mới).

**Việc còn thiếu / sẵn sàng giao phiên sau (chi tiết & prompt copy-paste trong `.ai/NEXT_SESSIONS.md`):**
- Test thật trên điện thoại — chưa chốt (S-A)
- Bước chân v1 (nhập số trung bình/ngày, KHÔNG phải HealthKit/Health Connect) (S-F)
- Khung giờ bữa ăn sửa được trong Cài đặt (S-I)
- Rải xả pin Năng lượng theo nhịp thức/ngủ (S-K, mới — quyết định 2026-06-18)
- Ghi nhận cân nặng theo thời gian (S-L, mới — quyết định 2026-06-18)
- Tích hợp Health thật (HealthKit/Health Connect, cần đổi sang dev client EAS) (S-F v2, làm sau)
- Lớp thông minh dự báo + hiệu chỉnh cá nhân hoá thật từ dữ liệu cân nặng (S-G, làm SAU CÙNG — cần ~1 tháng dữ liệu)
- (Mức độ thấp, không gấp) Lệch nhỏ khi app mở đúng lúc qua nửa đêm — xem "Ghi chú review tích
  hợp" cuối `.ai/NEXT_SESSIONS.md`; tiện thể vá khi làm S-K, không cần gói riêng

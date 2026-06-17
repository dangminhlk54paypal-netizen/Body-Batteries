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

**Cập nhật lần cuối:** 2026-06-16

**Tóm tắt 1 dòng:** Toàn bộ source code đã viết xong (Phase 0–3), chờ cài Node.js để chạy thật.

**Môi trường máy:**
- Node.js: ❌ Chưa cài
- Expo Go (điện thoại): chưa xác nhận
- `npm install`: ❌ Chưa chạy
- Git hooks: ❌ Chưa cài (`bash .ai/scripts/install-hooks.sh`)

**Việc phải làm KẾ TIẾP (theo thứ tự):**
1. Cài **Node.js LTS** tại nodejs.org (cần wifi ~5 phút)
2. Mở terminal VS Code → `cd my-body-batteries-app` → `npm install`
3. `npx expo start` → quét QR trên điện thoại bằng Expo Go
4. Test màn hình Home: thấy pin hiện lên, bấm pin để nạp
5. Test đóng app → mở lại → dữ liệu vẫn còn
6. Báo lỗi cho AI nếu có (thường gặp: thiếu thư viện, lỗi import)

**Những gì ĐÃ có trong code (không cần viết lại):**
- `src/types/` — BatteryType, DailyLog, IntakeEvent, ModeDefinition
- `src/lib/` — constants, dateUtils, encryption
- `src/domain/` — batteryEngine, modeDefinitions (Training/Maintain/Rest), lowBatteryRules
- `src/data/db/` — SQLite schema + database init + seed 6 pin mặc định
- `src/data/repositories/` — battery, intake, dailyLog repos
- `src/store/` — energyStore (Zustand), settingsStore
- `src/services/` — notifications, export Excel, cleanup
- `src/components/` — BatteryCell, MasterBattery, BatteryStack, ModeSelector, IntakeModal
- `src/screens/` — Home, History, Diary, Settings
- `src/navigation/` — AppNavigator (bottom tabs: ⚡📊📔⚙️)
- `App.tsx`, `package.json`, `tsconfig.json`, `babel.config.js`, `app.json`

**Việc còn thiếu (chưa viết code):**
- Biểu đồ xu hướng tuần (`victory-native`) — Phase 3
- Background task tự xả pin định kỳ (`expo-task-manager`) — Phase 2 nâng cao
- Tích hợp Health (HealthKit/Health Connect) — Phase 4
- Lớp thông minh ML — Phase 5

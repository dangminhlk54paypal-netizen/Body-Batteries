# 🎨 ĐỢT UX — sửa "chưa hợp logic / khó nhìn" sau test máy thật

> File này TÁCH RIÊNG khỏi `.ai/NEXT_SESSIONS.md` vì lúc viết (2026-06-18) có **một phiên khác
> đang biên tập trực tiếp `NEXT_SESSIONS.md`** (thêm gói S-K, S-L). Để tránh hai phiên ghi đè
> lên nhau, các gói UX (U1…U6) nằm ở đây. Khi gộp tài liệu (gói S-J) hãy dồn file này vào
> `NEXT_SESSIONS.md` rồi xoá.
>
> **Đọc kèm:** `.ai/NEXT_SESSIONS.md` mục "🔑 Luật vàng" (áp dụng y nguyên: mỗi phiên chỉ sửa
> file của gói mình; report vào `.ai/parallel-reports/<mã>.md`; trước khi báo xong chạy
> `npx tsc --noEmit` + `npx jest` + `npx expo export --platform ios`).

---

## Bối cảnh

Test trên iPhone thật (2026-06-18) cho thấy 3 vùng "chưa hợp góc nhìn người dùng":
**(1) pin tổng + con số năng lượng · (2) nạp & ghi món · (3) các màn khác.**

Song song, một "đợt polish nhấn" (press feedback + animation trượt sheet) đang quét qua các
component. Đã commit 6 file (`4499fab UI polish: press feedback…`). Còn ~5 file ĐANG SỬA DỞ
(chưa commit): `BodyProfileCard.tsx, DiaryScreen.tsx, OnboardingScreen.tsx, SettingsScreen.tsx,
MasterBattery.tsx`.

**⚠️ ĐIỀU KIỆN MỞ GÓI có dấu (\*):** phải **commit xong đợt polish nhấn** (nền sạch) rồi mới mở
gói đụng các file đó. **U2, U3 mở được NGAY** (file của chúng đã sạch).

---

## Bảng gói UX

| Mã | Vùng | File ĐƯỢC sửa (CHỈ những file này) | Mở khi |
|----|------|-----------------------------------|--------|
| **U1\*** | Pin tổng + con số năng lượng (hiển thị) | `components/LiveMasterBattery.tsx`, `components/MasterBattery.tsx`, `hooks/useLiveEnergyReading.ts` | sau commit polish |
| **U2** | Nạp & ghi món (modal/bàn phím/luồng) | `components/IntakeModal.tsx`, `components/FoodLogModal.tsx`, `components/EnergyActionsBar.tsx` | **NGAY** |
| **U3** | Lịch sử + biểu đồ | `screens/HistoryScreen.tsx`, `components/TrendChart.tsx` | **NGAY** |
| **U4\*** | Nhật ký | `screens/DiaryScreen.tsx` | sau commit polish |
| **U5\*** | Onboarding lần đầu | `screens/OnboardingScreen.tsx` | sau commit polish |
| **U6\*** | Cài đặt (UX) + khung giờ bữa ăn (**gộp S-I**) | `screens/SettingsScreen.tsx`, `store/settingsStore.ts`, `domain/food/foodNutrition.ts` (+param tuỳ chọn), `store/energyStore.ts` (1 dòng trong `logFood`) | sau commit polish |

7 gói này (U1–U6 + **S-F** ở `NEXT_SESSIONS.md`) **rời file nhau → song song được**, TRỪ các
điểm đụng file chéo dưới đây.

---

## ⚠️ Đụng file CHÉO với các gói trong NEXT_SESSIONS.md (BẮT BUỘC đọc)

Phiên kia vừa thêm S-K (rải xả theo nhịp thức/ngủ) và S-L (cân nặng). Quy tắc né nhau:

- **U6 ↔ S-K:** cả hai sửa `store/energyStore.ts` (U6 sửa `logFood`, S-K sửa lệnh gọi trong
  `tickDrain`). Hai hàm khác nhau nhưng **cùng file → làm xong 1 gói, commit, rồi mới chạy gói
  kia.** KHÔNG chạy U6 và S-K cùng lúc.
- **U6 = S-I:** U6 đã **gộp** gói S-I. Đừng mở S-I song song với U6 (sẽ trùng).
- **S-F ↔ S-K:** đã ghi ở `NEXT_SESSIONS.md` (cùng đụng `metabolismEngine.ts`/
  `metabolicConstants.ts`) → không chạy đồng thời. (Không liên quan U-gói nào.)
- **U1 vs S-F/S-K/S-L:** U1 chỉ sửa **hiển thị**, không sửa engine → an toàn chạy cùng. Nếu U1
  thấy CON SỐ tính sai, GHI report cho S-F/S-K xử lý, **đừng tự sửa engine**.

**Tổ hợp chạy song song an toàn gợi ý (1 đợt):** U1 · U2 · U3 · U4 · U5 · U6 · S-J · S-A.
(S-F, S-K, S-L để đợt riêng hoặc xen kẽ theo ràng buộc trên — vì chúng đụng `energyStore.ts` /
`metabolismEngine.ts` với U6.)

---

## Ràng buộc chung cho mọi gói U

- Trước khi sửa: **mở app trên máy cùng người dùng, chỉ ra CỤ THỂ chỗ "chưa hợp logic"** trong
  vùng của mình, đề xuất cách sửa bằng tiếng Việt, **ĐỢI người dùng duyệt** rồi mới code
  (`.ai/CONTEXT.md` mục 3).
- KHÔNG đụng `package.json`, `App.tsx`, `HomeScreen.tsx`, hay file ngoài danh sách của gói.
- **U1:** chỉ sửa hiển thị/nhãn/màu/đơn vị. Số tính sai → ghi report, đừng sửa engine.
- **U6:** giữ `mealTypeForHour`/`mealTypeForTimestamp` có **default** (để test cũ + `FoodLogModal`
  của U2 không vỡ); giữ chữ ký `logFood` KHÔNG đổi.
- Báo xong = `npx tsc --noEmit` sạch + `npx jest` xanh + `npx expo export --platform ios` OK +
  report `.ai/parallel-reports/<mã>.md`.

---

## Prompt copy-paste

### U1 — Pin tổng + con số năng lượng (chờ commit polish)
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/06-energy-expenditure.md và
.ai/NEXT_SESSIONS_UX.md (gói U1). Nhập vai agent mobile-frontend. Vùng: pin tổng "Năng lượng" +
con số kcal/%. CHỈ được sửa: components/LiveMasterBattery.tsx, components/MasterBattery.tsx,
hooks/useLiveEnergyReading.ts — KHÔNG đụng file khác, KHÔNG sửa engine domain (số sai thì ghi
report). Trước khi bắt đầu kiểm tra `git status` sạch. Mở app cùng tôi, chỉ ra chỗ con số/nhãn
khó hiểu rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy tsc + jest + expo export
trước khi báo xong. Report vào .ai/parallel-reports/U1.md.
```

### U2 — Nạp & ghi món — MỞ ĐƯỢC NGAY
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/07-food-log.md và .ai/NEXT_SESSIONS_UX.md (gói
U2). Nhập vai agent mobile-frontend. Vùng: luồng nạp calo / ghi món / nút "Vận động". CHỈ được
sửa: components/IntakeModal.tsx, components/FoodLogModal.tsx, components/EnergyActionsBar.tsx —
KHÔNG đụng file khác, KHÔNG đổi chữ ký logFood/addCalories. Mở app cùng tôi, chỉ ra chỗ khó dùng
(bàn phím che ô, nút khó bấm, chọn khẩu phần rối…) rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt
mới code. Chạy tsc + jest + expo export trước khi báo xong. Report vào .ai/parallel-reports/U2.md.
```

### U3 — Lịch sử + biểu đồ — MỞ ĐƯỢC NGAY
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS_UX.md (gói U3). Nhập vai agent
mobile-frontend. Vùng: màn Lịch sử + biểu đồ xu hướng tuần. CHỈ được sửa: screens/HistoryScreen.tsx,
components/TrendChart.tsx — KHÔNG đụng file khác. Mở app cùng tôi, chỉ ra chỗ biểu đồ/thẻ ngày khó
đọc rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy tsc + jest + expo export trước
khi báo xong. Report vào .ai/parallel-reports/U3.md.
```

### U4 — Nhật ký (chờ commit polish)
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS_UX.md (gói U4). Nhập vai agent
mobile-frontend. Vùng: màn Nhật ký. CHỈ được sửa: screens/DiaryScreen.tsx — KHÔNG đụng file khác.
Trước khi bắt đầu kiểm tra `git status` sạch (đợt polish nhấn đã commit). Mở app cùng tôi, chỉ ra
chỗ khó dùng rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code. Chạy tsc + jest + expo export
trước khi báo xong. Report vào .ai/parallel-reports/U4.md.
```

### U5 — Onboarding (chờ commit polish)
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md và .ai/NEXT_SESSIONS_UX.md (gói U5). Nhập vai agent
mobile-frontend. Vùng: màn Onboarding lần đầu. CHỈ được sửa: screens/OnboardingScreen.tsx — KHÔNG
đụng file khác. Trước khi bắt đầu kiểm tra `git status` sạch. Mở app cùng tôi (xoá app cài lại để
thấy onboarding), chỉ ra chỗ khó hiểu rồi đề xuất sửa bằng tiếng Việt, đợi tôi duyệt mới code.
Chạy tsc + jest + expo export trước khi báo xong. Report vào .ai/parallel-reports/U5.md.
```

### U6 — Cài đặt UX + khung giờ bữa ăn (gộp S-I) (chờ commit polish)
```
Đọc CLAUDE.md, AGENTS.md, .ai/CONTEXT.md, docs/07-food-log.md và .ai/NEXT_SESSIONS_UX.md (gói U6,
đã gộp S-I). Nhập vai agent mobile-frontend. Hai việc: (a) chỉnh UX màn Cài đặt cho dễ nhìn; (b)
cho sửa khung giờ phân loại bữa ăn (sáng/trưa/tối) trong Cài đặt. CHỈ được sửa:
screens/SettingsScreen.tsx, store/settingsStore.ts (thêm mealWindows + persist),
domain/food/foodNutrition.ts (thêm param tuỳ chọn windows, GIỮ default để test cũ + FoodLogModal
không vỡ), store/energyStore.ts (CHỈ 1 dòng: logFood lấy mealWindows từ settings, KHÔNG đổi chữ
ký). KHÔNG đụng file khác. LƯU Ý: KHÔNG chạy cùng lúc gói S-K (cùng đụng energyStore.ts). Trước
khi bắt đầu kiểm tra `git status` sạch. Mở app cùng tôi, đề xuất sửa bằng tiếng Việt, đợi tôi
duyệt mới code. Chạy tsc + jest + expo export trước khi báo xong. Report vào
.ai/parallel-reports/U6.md.
```

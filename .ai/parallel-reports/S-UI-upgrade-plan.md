# S-UI — Kế hoạch nâng cấp giao diện (UI/UX Upgrade Plan)

## Tiến độ (cập nhật 2026-07-09, nhánh `ui-upgrade`)

- [x] **P0** — `src/lib/theme.ts` tạo xong, migrate 24 file (23 UI + AppNavigator) sang token màu.
  Commit `a5cb5f5`. Verify pass (28 suites/299 tests).
- [x] **P1** — palette ấm: `accent` teal→amber `#FFB020`, `successBgSoft`→xanh lá mạ `#7ED95722`.
- [x] **P2** — `src/lib/haptics.ts` (tapLight/success/warning, dùng `.catch()` chứ KHÔNG
  `try/catch` quanh promise chưa await — bug đã phát hiện & sửa). Gắn tại IntakeModal,
  FoodLogModal, SupplementQuickLog, ModeSelector, 3 luồng xoá/hoàn tác trong HomeScreen.
- [x] **P6** — copy thấu cảm: notificationService.ts (2 chuỗi) + 3 empty-state
  (TodayMeals/TodayActivities/TodayIntakes).
- P1+P2+P6 commit chung: `2ce639c`.
- **Bài học quan trọng khi điều phối song song**: dù đã phân tích "không đụng file" giữa
  P1/P2/P6 trước khi dispatch, agent P2 (haptics) đã tự ý chạy lệnh git revert diện rộng
  ("dọn các thay đổi ngoài ý muốn") và xoá mất luôn thay đổi hợp lệ của P1 + P6 đang chạy
  song song (theme.ts về lại teal, 5 chuỗi copy P6 mất sạch). Phát hiện được nhờ luôn
  `git status`/`git diff` đối chiếu lại báo cáo của agent trước khi commit — KHÔNG tin
  báo cáo "verify pass" của agent là đủ. Đã tái tạo lại thủ công từ diff trong báo cáo
  agent thay vì dispatch lại (tiết kiệm quota). **Áp dụng cho các phase sau**: nếu buộc
  phải chạy song song nhiều agent chỉnh sửa trên cùng working tree, cân nhắc
  `isolation: "worktree"` cho từng agent, hoặc kiểm tra kỹ diff ngay sau khi mỗi agent
  báo xong thay vì đợi cả loạt.
- **Còn lại**: P3 (BottomSheet), P4 (hiệu ứng sạc), P5 (gợi ý món) — chạy TUẦN TỰ (không
  song song) vì cả ba đều đụng `FoodLogModal.tsx`/battery components lặp lại nhiều lần.


> Bản thiết kế điều phối cho các model nhỏ (Sonnet 5 / Haiku 4.5) thực thi từng bước.
> Người điều phối: Claude (Fable/Opus) hoặc user tự dispatch từng task.
> Ngày lập: 2026-07-09. Nhánh đề xuất: `ui-upgrade` (tách từ `session-5-demo-ready` sau khi commit S-A).

---

## 0. Hiện trạng & ràng buộc (executor PHẢI đọc)

- **Expo SDK 54 pinned** (Expo Go trên iPhone thật). Mọi package mới phải cài bằng
  `npx expo install <pkg>` và phải nằm trong Expo Go SDK 54. Được phép:
  `expo-haptics`, `expo-linear-gradient`, `react-native-gesture-handler`.
  **KHÔNG** cài `@gorhom/bottom-sheet`, không nâng SDK.
- `react-native-reanimated ~4.1.1` đã có sẵn và đã dùng trong `FoodLogModal`
  (sheet trượt lên bằng `withTiming` — KHÔNG viết lại từ đầu, chỉ nâng cấp).
- **ESLint hook chặn commit**: `react-hooks/purity` và `react-hooks/set-state-in-effect`
  ở mức error qua PostToolUse hook. Không gọi `Date.now()`/`Math.random()` trong render,
  không `setState` đồng bộ trong `useEffect`.
- ~41 mã màu hex hardcode rải trong 23 file UI, **chưa có theme module**.
  Nền tối `#0d0d1a`, card `#1a1a2e`/`#2d2d44`, accent hiện tại: teal `#00B894`,
  tím `#6C5CE7`, đỏ `#FF6B6B`, xanh `#54A0FF`/`#0984e3`, vàng `#FFD93D`.
- Kiến trúc: logic KHÔNG nằm trong file view (`src/domain`, `src/data`, `src/lib`);
  UI ở `src/components`, `src/screens`.
- Lệnh nghiệm thu bắt buộc cho MỌI task: `npm run verify` (typecheck + lint + jest) phải pass.
- Code/comment tiếng Anh; chuỗi hiển thị cho người dùng tiếng Việt.

## 0b. Quyết định thiết kế đã chốt

- **Giữ nền tối, đổi accent sang dải "năng lượng ấm"**: amber/cam làm màu sạc chính,
  xanh lá mạ cho trạng thái đầy, đỏ ấm cho cạn pin. KHÔNG chuyển sang nền sáng
  (đập lại toàn bộ 23 file + identity "cục pin" hiện có; để làm ở phase tương lai nếu muốn).
- Bottom sheet tự viết (`components/ui/BottomSheet.tsx`) bằng reanimated + gesture-handler,
  không thêm lib ngoài.
- Hiệu ứng "nạp pin": bản 1 = glow/pulse + haptic (rẻ, chắc chắn mượt trong Expo Go).
  Particle bay vào pin = task tùy chọn cuối cùng, chỉ làm khi bản 1 chạy tốt.
- Blur backdrop: dùng overlay bán trong suốt (`rgba`) + bo góc lớn + shadow mềm.
  KHÔNG dùng `expo-blur` cho backdrop (hiệu năng kém trên Android/Expo Go).

---

## 1. Sơ đồ phụ thuộc

```
P0 theme.ts (Sonnet) ──► P1 palette ấm (Haiku) ──► P4 hiệu ứng sạc (Sonnet)
                     └──► P3 BottomSheet (Sonnet) ──► P5 giảm ma sát FoodLog (Sonnet)
P2 haptics (Haiku)   ──────────────────────────────► P4
P6 copy thấu cảm (Haiku)   — độc lập, chạy song song lúc nào cũng được
Sau mỗi P*: QA gate (qa-reviewer) + npm run verify + test tay trên iPhone
```

Chạy song song được: (P0 → P1) ∥ P2 ∥ P6. P3 chờ P0. P4 chờ P1+P2. P5 chờ P3.

---

## P0 — Nền móng: theme tokens (BẮT BUỘC LÀM ĐẦU TIÊN)

- **Agent**: `mobile-frontend`, model **sonnet**
- **Việc**:
  1. Tạo `src/lib/theme.ts` export `colors`, `spacing`, `radii`, `shadows`
     (plain object, không context/provider — app chỉ có 1 theme).
     Token đặt tên theo vai trò: `bg`, `bgCard`, `bgElevated`, `textPrimary`,
     `textSecondary`, `textMuted`, `accent`, `accentCharge`, `success`, `danger`,
     `warning`, `info`, `border`… Giá trị ban đầu = màu hiện tại (KHÔNG đổi màu ở task này).
  2. Migrate toàn bộ file trong `src/components` + `src/screens` sang import theme
     (grep từng hex, thay bằng token; hex chỉ còn được phép xuất hiện trong `theme.ts`
     và các màu data-driven như màu riêng của từng loại pin trong `constants.ts`).
  3. Thêm lint guard nhẹ nếu tiện (không bắt buộc).
- **Nghiệm thu**: `npm run verify` pass; `grep -rE "#[0-9a-fA-F]{3,8}" src --include="*.tsx" | grep -v theme` gần như rỗng; UI không đổi pixel nào (diff chỉ là refactor).
- Ước lượng: 1 phiên agent (~30–60'), diff lớn nhưng máy móc.

## P1 — Dải màu năng lượng ấm

- **Agent**: `mobile-frontend`, model **haiku** (chỉ sửa 1 file `theme.ts`)
- **Việc**: đổi giá trị token: `accent`/`accentCharge` → amber `#FFB020` / cam `#FF8C42`;
  `success` → xanh lá mạ `#7ED957`; `danger` → đỏ ấm `#FF6B5E`; giữ nền tối hiện tại;
  chỉnh `bgCard` ấm hơn một chút (vd `#1c1a26`). Kiểm tra tương phản chữ/nền ≥ 4.5:1
  cho text chính.
- **Nghiệm thu**: verify pass; screenshot Home/Diary/Settings để user duyệt màu.
- Ước lượng: 10–20'.

## P2 — Haptic feedback

- **Agent**: `mobile-frontend`, model **haiku**
- **Việc**: `npx expo install expo-haptics`; tạo `src/lib/haptics.ts`
  (`tapLight()`, `success()`, `warning()` — wrap try/catch, no-op trên web);
  gọi tại: xác nhận nạp pin (IntakeModal), lưu món ăn (FoodLogModal),
  TPCN quick-log (SupplementQuickLog), xoá/hoàn tác (confirm destructive),
  đổi Mode (ModeSelector).
- **Nghiệm thu**: verify pass; không import expo-haptics trực tiếp trong component
  (chỉ qua `src/lib/haptics.ts`).
- Ước lượng: 20–30'.

## P3 — BottomSheet dùng chung + swipe-to-dismiss

- **Agent**: `mobile-frontend`, model **sonnet**
- **Việc**:
  1. `npx expo install react-native-gesture-handler`; bọc root trong
     `GestureHandlerRootView` (App.tsx).
  2. Tạo `src/components/ui/BottomSheet.tsx`: reanimated slide-up (tái dùng pattern
     `SHEET_OFFSET`/`withTiming` sẵn có trong FoodLogModal), vuốt xuống để đóng
     (Gesture.Pan + threshold), backdrop `rgba(0,0,0,0.55)` bấm để đóng,
     bo góc trên 28, handle bar, tôn trọng bàn phím (KeyboardAvoidingView giữ nguyên).
  3. Migrate `FoodLogModal` và `IntakeModal` sang dùng BottomSheet (giữ nguyên toàn bộ
     logic form bên trong — chỉ thay vỏ Modal).
- **Nghiệm thu**: verify pass; mở/đóng mượt trên iPhone; vuốt xuống đóng được;
  không regress luồng thêm món/sửa thành phần/món custom (checklist qa-reviewer).
- Ước lượng: 1 phiên (~45–90').
- **Rủi ro**: gesture-handler cần restart Metro với cache clear; nhắc user chạy
  `npx expo start -c` sau khi cài.

## P4 — Hiệu ứng "sạc pin" + haptic success

- **Agent**: `mobile-frontend`, model **sonnet** (phụ thuộc P1 + P2)
- **Việc**: khi tổng kcal nạp tăng (log món/TPCN thành công):
  glow pulse quanh `LiveMasterBattery` (scale 1→1.06→1 + shadow/gradient amber,
  reanimated `withSequence`), con số % đếm mượt, kèm `haptics.success()`.
  Trigger đặt ở nơi đã biết sự kiện thành công (callback sau `logFood`),
  KHÔNG so sánh state trong effect để suy ra "vừa ăn xong".
- **Nghiệm thu**: verify pass; hiệu ứng chạy 60fps trên thiết bị; không vi phạm
  rule purity (mọi giá trị random/time nằm trong worklet/handler, không trong render).
- Ước lượng: 1 phiên.

## P5 — Giảm ma sát nhập liệu (low-friction logging)

- **Agent**: `logic-backend` (phần domain) rồi `mobile-frontend` (phần UI), model **sonnet**
- **Việc**:
  1. Domain: `src/domain/food/foodSuggestions.ts` — `suggestFoods(recentLog, hour)`:
     trả về ≤6 món gợi ý = món hay log gần đây theo cùng buổi (dùng `mealTypeForHour`
     sẵn có), fallback món log gần nhất. Kèm unit test.
  2. UI: hàng chip "Gợi ý cho bữa này" trên đầu FoodLogModal khi query rỗng —
     bấm 1 chạm là chọn món với khẩu phần lần trước. Nút chạm tối thiểu 44×44.
  3. Lịch sử log để gợi ý: đọc từ repository sẵn có (7 ngày gần nhất) — không thêm bảng mới.
- **Nghiệm thu**: verify pass + test mới cho `suggestFoods`; log 1 món quen chỉ còn
  2 chạm (mở sheet → chạm chip → lưu).
- Ước lượng: 1–1.5 phiên. **Lưu ý memory**: tra cứu món phải qua `getAnyFoodById`.

## P6 — Ngôn ngữ thấu cảm (độc lập, chạy bất kỳ lúc nào)

- **Agent**: `logic-backend`, model **haiku**
- **Việc**: rà chuỗi thông báo trong `src/services/notifications/notificationService.ts`
  + empty state các list (TodayMeals/TodayIntakes/TodayActivities): đổi giọng cảnh báo
  khô khan → khích lệ ("Pin nước đang thấp — nhấp một ngụm nhé 💧" thay vì "Cảnh báo: ...").
  Không đổi logic, chỉ đổi copy. Giữ ranh giới sức khỏe: không hứa hẹn y tế.
- **Nghiệm thu**: verify pass; bảng before/after các chuỗi để user duyệt.
- Ước lượng: 20–30'.

## P7 (tùy chọn, sau khi P4 ổn) — Particle bay vào pin

- **Agent**: `mobile-frontend`, model **sonnet**. Chỉ làm khi user nghiệm thu P4 và muốn thêm.
- 6–8 chấm SVG bay theo đường cong vào pin bằng reanimated worklet; tắt được qua Settings.

---

## QA gate (sau mỗi phase)

- **Agent**: `qa-reviewer` (read-only), model mặc định của agent.
- Input: diff của phase. Output: lỗi logic/edge case + checklist test tay tiếng Việt
  cho user bấm trên iPhone. Orchestrator chỉ merge phase khi verify pass + user test OK.

## Mẫu prompt dispatch (orchestrator dùng với Agent tool)

```
subagent_type: mobile-frontend   (hoặc logic-backend / qa-reviewer)
model: sonnet | haiku
prompt: |
  Đọc .ai/parallel-reports/S-UI-upgrade-plan.md, thực hiện ĐÚNG phase P<n>,
  tuân thủ mục 0 (ràng buộc). Không làm ngoài phạm vi phase.
  Kết thúc: chạy `npm run verify`, báo cáo diff + kết quả verify.
```

## Ước lượng tổng

| Phase | Model | Thời lượng agent | Ghi chú |
|---|---|---|---|
| P0 | Sonnet | 30–60' | diff lớn, máy móc |
| P1 | Haiku | 10–20' | 1 file |
| P2 | Haiku | 20–30' | + expo-haptics |
| P3 | Sonnet | 45–90' | + gesture-handler |
| P4 | Sonnet | 45–60' | reanimated |
| P5 | Sonnet | 60–90' | domain + UI + test |
| P6 | Haiku | 20–30' | copy only |
| QA ×6 | qa-reviewer | 6×10–15' | read-only |

Tổng ≈ 4–6 giờ agent-time, trải 2–3 buổi làm việc (mỗi buổi 2–3 phase + test tay).

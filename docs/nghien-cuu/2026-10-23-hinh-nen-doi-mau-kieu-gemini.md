# Hình nền đổi màu kiểu Gemini — làm thế nào, có nên áp dụng?

| | |
|---|---|
| Ngày | 2026-10-23 |
| Phạm vi | Hình nền gradient chuyển động của app Gemini trên điện thoại; cách dựng tương tự trong BodyBatteries (Expo SDK 58) |
| Nhánh khảo sát | `ui-upgrade` (sau commit `4ef9d89`) |
| Mục tiêu | Hiểu Gemini làm gì, cách làm được như vậy, và áp vào app này có đáng không |

**Chú giải:** `[n]` nguồn web số n · `[Mã: file]` rút từ code dự án · 💡 nhận định của người viết · ❓ chưa kiểm chứng. Mọi nguồn truy cập ngày 2026-10-23.

## Tóm tắt

1. Gemini thay nền tĩnh bằng **gradient (dải màu loang) chuyển động**. Màu **"đập nhẹ như nhịp tim" khi app đang xử lý câu hỏi** [3]. Ở chế độ ẩn danh, hiệu ứng vẫn còn nhưng đổi sang tông xám [3]. Tức là màu nền **báo trạng thái**, không chỉ để trang trí.
2. Google giải thích: gradient gợi cảm giác "truyền năng lượng và có hướng" [2], và "mỗi chuyển động có điểm bắt đầu và kết thúc rõ ràng" [1].
3. App mình làm được **mà không cần thêm thư viện**. App đã có `react-native-svg` (có sẵn `LinearGradient`/`RadialGradient`) và Reanimated, và đang dùng chúng để chạy hiệu ứng nạp pin [Mã: [MasterBattery.tsx](../../src/components/MasterBattery.tsx)].
4. 💡 **Có hiệu quả nếu màu nền gắn với ý nghĩa.** Ví dụ: màu theo mức pin no (đầy → xanh, vơi → hổ phách), và nền "đập" một nhịp khi vừa ghi bữa ăn. Còn để nền chạy liên tục chỉ cho đẹp thì tốn pin, làm chữ khó đọc và trái quy tắc giao diện gọn.
5. 💡 Đề xuất: chỉ dùng ở **vùng đầu màn Hôm Nay**, chuyển màu rất chậm, độ đậm thấp, dừng khi rời màn hình, và đứng yên khi người dùng bật "Giảm chuyển động".

## 1. Gemini làm gì (hiện trạng bên ngoài)

| Điểm | Chi tiết | Nguồn |
|---|---|---|
| Khi nào chuyển động | Khi Gemini đang xử lý câu hỏi; trước đây màn hình đứng yên, chỉ có chữ "Thinking…" | [3][4] |
| Màu | Bản tin rò rỉ đoán là 4 màu chính của Google (xanh dương, đỏ, vàng, xanh lá); video chưa cho thấy rõ | [4] (rò rỉ) |
| Ẩn danh | Vẫn chuyển động, nhưng dùng tông xám | [3] |
| Phát hành | Bắt đầu tung ra toàn cầu, theo bài ngày 19/05/2026 | [3] |
| Ý đồ thiết kế | Gradient là "người dẫn đường" cho mắt, giúp người dùng thấy AI đang "nghĩ" | [1][2] |

💡 Bài học chính: Gemini **không đổi màu ngẫu nhiên**. Họ dùng chuyển động để trả lời câu hỏi "app đang làm gì?", và chuyển động có điểm đầu, điểm cuối rõ ràng.

## 2. Cách làm được như vậy (kỹ thuật)

Nguyên lý 💡: chồng 3 lớp lên nhau.
1. **Nền phẳng**: màu `bg` của theme hiện tại [Mã: [theme.ts](../../src/lib/theme.ts)].
2. **2–3 "đốm màu" mờ**: mỗi đốm là một `RadialGradient`, đậm ở tâm và trong suốt dần ra rìa.
3. **Chuyển động**: Reanimated trượt chậm vị trí các đốm, đồng thời pha màu giữa hai trạng thái bằng `interpolateColor` [5]. Nên chọn không gian màu `'LAB'` (Oklab) [5] để màu chuyển êm, không bị xám đục ở giữa 💡.

Ba cách dựng:

| Cách | Có trong Expo Go SDK 58? | Thêm thư viện? | Nhận xét 💡 |
|---|---|---|---|
| **A. `react-native-svg` + Reanimated `useAnimatedProps`** | Đã chạy trong app [Mã: [MasterBattery.tsx](../../src/components/MasterBattery.tsx)] | Không | Đủ đẹp cho nền dịu; cùng kiểu với hiệu ứng pin hiện có. **Khuyên dùng.** `useAnimatedProps` dùng được cho component SVG [6] |
| B. `expo-linear-gradient` | Có [7] | Có (`npx expo install expo-linear-gradient`) [7] | Chỉ có dải thẳng. Muốn loang kiểu Gemini phải chồng nhiều lớp |
| C. `@shopify/react-native-skia` | Có [8] | Có, nặng hơn [8] | Đẹp nhất (shader, làm mờ thật). Đáng dùng nếu sau này cần hiệu ứng phức tạp |

Phác thảo cách A (chưa viết vào app):

```tsx
// AmbientBackground.tsx — vẽ sau nội dung, pointerEvents="none"
const AnimatedStop = Animated.createAnimatedComponent(Stop);
const t = useSharedValue(0);
useEffect(() => {
  if (reduceMotion) return;                    // đứng yên khi bật Giảm chuyển động
  t.value = withRepeat(withTiming(1, { duration: 10000 }), -1, true);
}, [reduceMotion]);
const props = useAnimatedProps(() => ({
  stopColor: interpolateColor(t.value, [0, 1], [colorA, colorB], 'LAB'),
}));
// <Svg><Defs><RadialGradient id="blob">…<AnimatedStop animatedProps={props}/>…</Defs>
//   <Circle r="60%" fill="url(#blob)" opacity={0.25}/></Svg>
```

App đã đọc được cài đặt "Giảm chuyển động" của máy theo hai cách: hook `useReducedMotion` của Reanimated [9], và hook riêng [Mã: [useReduceMotionSetting.ts](../../src/hooks/useReduceMotionSetting.ts)]. Lưu ý: `useReducedMotion` chỉ đọc giá trị **lúc mở app**, nên đổi cài đặt khi app đang chạy thì nó không cập nhật [9].

## 3. Áp vào BodyBatteries — có hiệu quả không?

**Nên làm (gắn với ý nghĩa)** 💡
- Màu đốm nền phía sau Pin no đi theo mức pin, tức là nhìn **màu là biết tình trạng** trước cả khi đọc số. Hợp với triết lý "pin" của app.
- Khi vừa ghi bữa ăn, nền "đập" một nhịp rồi lặng lại, có điểm đầu và điểm cuối như Gemini [1]. Có thể nối vào kho hiệu ứng nạp sẵn có [Mã: [chargeEffectStore.ts](../../src/store/chargeEffectStore.ts)].
- Mỗi Mode một tông nền, giống cách Gemini đổi sang xám khi ẩn danh [3]. Nhờ vậy người dùng nhận ra ngay mình đang ở chế độ nào.

**Không nên** 💡
- Chạy nền ở mọi màn hình, mọi lúc: rối mắt, trái quy tắc giao diện gọn [Nội bộ: [AGENTS.md](../../AGENTS.md)].
- Để màu đậm sau chữ: chữ mất độ tương phản. Theme sáng đã phải chỉnh màu cho đạt 4.5:1 [Mã: [theme.ts](../../src/lib/theme.ts)].
- Dùng 4 màu của Google: dễ bị nhìn như bắt chước Gemini. Nên dùng màu riêng của app: hổ phách `#FFB020` và tím `#6C5CE7` [Mã: [theme.ts](../../src/lib/theme.ts)].

**Tốn pin không?** ❓ Không tìm được số đo chính thức cho trường hợp này. 💡 Ước tính tốn ít, vì hoạt ảnh Reanimated chạy trên luồng giao diện, không tốn JS mỗi khung hình. Điều kiện: dừng khi màn hình không hiển thị và chỉ dùng 2–3 đốm. Cần thử trên iPhone thật.

**Đa ngôn ngữ:** hiệu ứng không có chữ. Chỉ khi thêm công tắc bật/tắt trong Cài đặt mới cần key mới ở `vi.ts` → `en.ts`/`de.ts` [Nội bộ: [AGENTS.md](../../AGENTS.md)].

## 4. Quyết định cần chủ dự án chốt

| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Màu nền gắn với gì? | Mức Pin no (và một nhịp khi ghi bữa) |
| Đặt ở đâu? | Chỉ vùng đầu màn Hôm Nay |
| Có công tắc tắt trong Cài đặt? | Có, mặc định bật, tự tắt khi máy bật Giảm chuyển động |
| Cách dựng | A (svg + Reanimated, không thêm thư viện) |

## Tài liệu tham khảo

**Google**
- [1] Google Design — "Gemini AI visual design". https://design.google/library/gemini-ai-visual-design — Dùng cho: mục đích gradient, "mỗi chuyển động có điểm đầu và cuối". Truy cập 2026-10-23.

**Báo công nghệ (nguồn phụ)**
- [2] 9to5Google — "Gemini gradient design" (17/01/2026). https://9to5google.com/2026/01/17/gemini-gradient-design/ — Dùng cho: trích lời Google về "truyền năng lượng", nơi dùng gradient. Truy cập 2026-10-23.
- [3] Android Headlines — "Google's New Gemini UI Rolling Out with Gradient Vibes, Pulsing Animations…" (19/05/2026). https://www.androidheadlines.com/2026/05/google-gemini-new-ui-rollout-overlay-gradients-pulsing.html — Dùng cho: nền chuyển động khi xử lý, nhịp tim, ẩn danh xám, phát hành. Truy cập 2026-10-23.
- [4] Android Police — "Google Gemini is planning a welcome visual upgrade for your chats" (27/04/2026). https://www.androidpolice.com/google-gemini-animated-backgrounds-queries/ — Dùng cho: chuyển động khi xử lý (rò rỉ), phỏng đoán 4 màu. Truy cập 2026-10-23.

**Reanimated (Software Mansion)**
- [5] `interpolateColor`. https://docs.swmansion.com/react-native-reanimated/docs/utilities/interpolateColor — Dùng cho: chữ ký hàm, không gian màu RGB/HSV/LAB (Oklab). Truy cập 2026-10-23.
- [6] `useAnimatedProps`. https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedProps — Dùng cho: hoạt ảnh thuộc tính component SVG. Truy cập 2026-10-23.
- [9] `useReducedMotion`. https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/ — Dùng cho: đọc cài đặt Giảm chuyển động, chỉ lấy giá trị lúc mở app. Truy cập 2026-10-23.

**Expo SDK 58**
- [7] LinearGradient. https://docs.expo.dev/versions/v58.0.0/sdk/linear-gradient/ — Dùng cho: có trong Expo Go, lệnh cài, thuộc tính. Truy cập 2026-10-23.
- [8] Skia. https://docs.expo.dev/versions/v58.0.0/sdk/skia/ — Dùng cho: có trong Expo Go, lệnh cài. Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu |
| 2026-10-23 | 2 | Chủ dự án chốt: màu theo pin Năng lượng cơ thể, **toàn app** (không chỉ Hôm Nay), có công tắc. Đã làm theo cách A |

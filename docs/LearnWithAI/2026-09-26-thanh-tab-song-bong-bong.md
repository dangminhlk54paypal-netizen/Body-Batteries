# Bài giảng: Thanh tab "sóng bong bóng" và màn hình trượt qua nhau

> **Dành cho:** sinh viên năm nhất, đã biết JavaScript cơ bản và từng viết một component React.
> Chưa cần biết gì về animation hay cử chỉ trên điện thoại.
> **Học xong bạn làm được:** một thanh tab mà khi đặt ngón tay lên và lướt ngang, các icon phồng lên như bong bóng
> theo một đường cong quanh ngón tay (giống Dock của máy Mac), tab dưới ngón tay mở ngay, nhấc tay thì bong bóng hạ
> xuống. Kèm theo đó là hiệu ứng các màn hình trượt qua nhau khi đổi tab.
> **Thời gian:** khoảng 3–4 buổi tự học.
> **Code thật trong app:** [`BubbleTabBar.tsx`](../../src/navigation/BubbleTabBar.tsx),
> [`bubbleWave.ts`](../../src/navigation/bubbleWave.ts), [`SlideTabNavigator.tsx`](../../src/navigation/SlideTabNavigator.tsx),
> [`slideTransition.ts`](../../src/navigation/slideTransition.ts).

**Cách đọc trích dẫn** (nguồn web truy cập ngày 26/09/2026)

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Lấy từ nguồn số *n* ở cuối bài |
| `[Mã: file]` | Lấy từ code của app BodyBatteries |
| 💡 | Nhận định / kinh nghiệm của người viết (AI), không phải trích dẫn |
| ❓ | Chưa kiểm chứng được |

---

## Mục lục
0. [Ý tưởng đến từ đâu (và AI đã làm thế nào)](#0-ý-tưởng-đến-từ-đâu-và-ai-đã-làm-thế-nào)
1. [Bốn khái niệm nền](#1-bốn-khái-niệm-nền)
2. [Phần toán: đường cong hình chuông](#2-phần-toán-đường-cong-hình-chuông)
3. [Làm từng bước: thanh tab sóng bong bóng](#3-làm-từng-bước-thanh-tab-sóng-bong-bóng)
4. [Mở rộng: màn hình trượt qua nhau](#4-mở-rộng-màn-hình-trượt-qua-nhau)
5. [Câu chuyện gỡ lỗi: 3 lần đoán sai, 1 lần đúng](#5-câu-chuyện-gỡ-lỗi-3-lần-đoán-sai-1-lần-đúng)
6. [Kiểm thử](#6-kiểm-thử)
7. [Bài tập tự làm](#7-bài-tập-tự-làm)
8. [Từ điển thuật ngữ](#8-từ-điển-thuật-ngữ)
9. [Nguồn tham khảo](#9-nguồn-tham-khảo)

---

## 0. Ý tưởng đến từ đâu (và AI đã làm thế nào)

### 0.1 Nguồn gốc ý tưởng
- **Yêu cầu của chủ app:** "chạm vào thanh tab, lướt lên xuống như lướt qua các bong bóng, cuộn cong cong".
  AI đưa ra 2 cách hiểu: *sóng bong bóng* hoặc *bánh xe vòng cung*. Chủ app chọn sóng bong bóng.
- **Dock của macOS:** Apple có tuỳ chọn *Magnification*: *"Phóng to biểu tượng khi bạn di con trỏ lên chúng"* [1].
  Icon gần con trỏ to nhất, icon xa nhỏ dần. Đây chính là hình mẫu.
- **Nghiên cứu giao diện:** Cockburn và cộng sự (2008) xếp Dock của Mac OS X vào nhóm giao diện *fisheye* (mắt cá):
  phóng to chỗ đang nhìn nhưng vẫn giữ ngữ cảnh xung quanh [2].
- **Toán học:** "nhỏ dần theo khoảng cách" được mô tả gọn nhất bằng **hàm Gauss**, tức đường cong hình chuông [3].

> **Không có repo GitHub nào được sao chép.** Thanh tab này được viết mới, dựa trên tài liệu chính thức của các thư
> viện [4]–[9]. Nguồn GitHub duy nhất giữ vai trò quyết định là *mã nguồn* của thư viện Reanimated: đọc file đó mới
> tìm ra lỗi khó nhất (xem [mục 5](#5-câu-chuyện-gỡ-lỗi-3-lần-đoán-sai-1-lần-đúng)) [10].

### 0.2 Kiến thức của AI đến từ đâu (nói thẳng)
| Loại kiến thức | Nguồn |
|---|---|
| Cách dùng Gesture Handler, Reanimated, React Navigation | Chủ yếu từ **dữ liệu huấn luyện** của AI (tài liệu công khai của các thư viện). Hôm nay đã **mở lại tài liệu chính thức** để kiểm tra từng câu trích trong bài này [4]–[9]. |
| Vì sao bottom-tabs v6 không trượt được | **Đọc code thư viện** trong `node_modules` của app ngay trong phiên làm việc [Mã: `node_modules/@react-navigation/bottom-tabs/src/views/BottomTabView.tsx`, `ScreenFallback.tsx`] |
| Gốc lỗi bong bóng không hạ | **Đọc mã nguồn Reanimated** (`mappers.ts`) [10] |
| Con số (22 px, 180 ms…) | 💡 Tự chọn rồi chỉnh theo cảm nhận của chủ app khi thử trên iPhone |

### 0.3 Quy trình AI đã làm (bạn có thể làm y hệt)
```
Yêu cầu → hỏi lại cho rõ (2 phương án) → đọc code hiện có → tách phần "toán thuần" ra file riêng + viết test
→ viết component → chạy kiểm tra (tsc + eslint + jest) → đẩy bản thử lên điện thoại (EAS Update)
→ chủ app thử và báo lỗi → giả thuyết → sửa → thử lại … (lặp đến khi đúng) → ghi bài học
```

---

## 1. Bốn khái niệm nền

### 1.1 Hai "luồng" (thread): JS và UI
- **Luồng JavaScript** chạy code React của bạn [7].
- **Luồng UI** (còn gọi là luồng chính) lo cập nhật giao diện [7].
- Animation mượt (60 khung hình/giây) cần chạy **trên luồng UI**. Nếu chạy trên luồng JS thì chỉ cần React bận vẽ một
  màn hình nặng là animation bị giật 💡.

### 1.2 Shared value (giá trị dùng chung)
- *"Yếu tố điều khiển mọi animation"* trong Reanimated. Dữ liệu trong shared value tự đồng bộ giữa luồng JS và luồng
  UI [7].
- Đọc/ghi bằng `.value` [6]. Lưu ý: đọc `.value` trên luồng JS sẽ **chặn** luồng JS cho tới khi lấy được giá trị từ
  luồng UI [6].

```ts
const active = useSharedValue(0); // 0 = bong bóng nằm, 1 = bong bóng nhô
active.value = withSpring(1);     // nhô lên theo kiểu lò xo
```

### 1.3 Worklet (hàm chạy được trên luồng UI)
- Worklet là *"hàm JavaScript chạy ngắn, có thể chạy trên luồng UI"* [7].
- Đánh dấu bằng chuỗi `'worklet';` ở dòng đầu hàm. Plugin Babel tự "workletize" nhiều hàm dùng với Reanimated [7].
  Trong Expo SDK 57, plugin này được cài sẵn qua `babel-preset-expo` [9].
- Khi đã cài Reanimated, các callback của cử chỉ (`onBegin`, `onUpdate`…) **tự động** thành worklet và chạy trên
  luồng UI [5].
- Muốn từ worklet gọi một hàm JS thường (ví dụ đổi tab), phải bọc bằng `runOnJS(hàm)(thamSố)` 💡.

### 1.4 Vòng đời một cử chỉ (gesture)
Thư viện Gesture Handler 2.x gọi các callback theo thứ tự [5]:

```
chạm xuống ──► onBegin ──► (đủ điều kiện) onStart ──► onUpdate … onUpdate ──► onEnd ──► onFinalize
     │                                                                                     ▲
     └──────────────── (không đủ điều kiện, ví dụ chỉ chạm rồi nhấc) ───────────────────────┘
nhấc từng ngón ──► onTouchesUp
```
- `onBegin`: khi bắt đầu nhận chạm [5].
- `onStart`: khi cử chỉ được nhận ra và chuyển sang trạng thái hoạt động [5].
- `onEnd`: khi cử chỉ **đã hoạt động** kết thúc [5].
- `onFinalize`: khi xử lý xong, dù cử chỉ thành công hay không được nhận ra [5]. 💡 Nên dọn dẹp ở đây, vì nó
  luôn chạy nếu đã có `onBegin`.
- `onTouchesUp`: mỗi lần một ngón tay rời màn hình [5].

---

## 2. Phần toán: đường cong hình chuông

### 2.1 Công thức
Hàm Gauss: `f(x) = a · exp(−(x − b)² / (2c²))` [3]
- `a` = độ cao đỉnh, `b` = vị trí đỉnh, `c` = độ rộng "quả chuông" [3].

Trong app ta dùng bản rút gọn (đỉnh cao 1, đặt tại ngón tay) [Mã: [bubbleWave.ts](../../src/navigation/bubbleWave.ts)]:

```ts
// 1 ngay dưới ngón tay, nhỏ dần mượt mà khi ra xa.
export function bubbleInfluence(distance: number, spread: number): number {
  'worklet';
  if (spread <= 0) return 0;
  const r = distance / spread;
  return Math.exp(-(r * r) / 2);
}
```
- `distance` = khoảng cách từ ngón tay tới **tâm** icon.
- `spread` = độ rộng một tab. Nhờ vậy hai tab kế bên cũng nhô lên một chút, tạo thành "đường cong".

### 2.2 Làm tay một ví dụ
iPhone rộng 390 điểm, có 5 tab, nên mỗi tab rộng 78 và `spread = 78`. Ngón tay đặt ở `x = 195` (giữa tab số 2).

| Tab | Tâm | Khoảng cách | r | ảnh hưởng `k` | Nhô lên `22·k` | Phóng to `1 + 0.5·k` |
|---|---|---|---|---|---|---|
| 2 | 195 | 0 | 0 | 1,000 | 22,0 | 1,50 |
| 1 và 3 | 117 / 273 | 78 | 1 | 0,607 | 13,4 | 1,30 |
| 0 và 4 | 39 / 351 | 156 | 2 | 0,135 | 3,0 | 1,07 |

Nối đỉnh các icon lại, bạn được một "quả đồi" mượt đi theo ngón tay. Đó là sóng bong bóng.

### 2.3 Hai hàm phụ
```ts
// Ngón tay đang ở tab nào (ra ngoài thanh thì lấy tab ở mép gần nhất).
export function tabIndexAt(x: number, barWidth: number, count: number): number {
  'worklet';
  if (barWidth <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor((x / barWidth) * count)));
}
// Tâm của tab số `index`.
export function tabCenterX(index: number, barWidth: number, count: number): number {
  'worklet';
  return ((index + 0.5) * barWidth) / count;
}
```
💡 Để phần toán trong một file riêng, không import React. Như vậy bạn test được bằng Jest trong vài mili giây
(xem [mục 6](#6-kiểm-thử)).

---

## 3. Làm từng bước: thanh tab sóng bong bóng

**Chuẩn bị** (Expo SDK 57): `npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler` [9].
Bọc app trong `<GestureHandlerRootView style={{ flex: 1 }}>`.

### Bước 1: Thay thanh tab mặc định
React Navigation cho phép truyền component riêng qua prop `tabBar` [Mã: [AppNavigator.tsx](../../src/navigation/AppNavigator.tsx)]:
```tsx
<Tab.Navigator tabBar={(props) => <BubbleTabBar {...props} />}>
```

### Bước 2: Khai báo 4 shared value
```ts
const fingerX = useSharedValue(0);   // ngón tay đang ở đâu (theo trục ngang)
const active = useSharedValue(0);    // 0 = nằm, 1 = đang chạm (sóng nhô)
const barWidth = useSharedValue(0);  // chiều rộng thanh, đo bằng onLayout
const lastIndex = useSharedValue(-1); // tab vừa mở; -1 = không chạm
```

### Bước 3: Cử chỉ Pan (kéo)
`minDistance(0)`: chạm là bắt đầu luôn, không cần kéo xa [4].
```ts
const pan = Gesture.Pan()
  .minDistance(0)
  .onBegin((e) => {                       // chạm xuống
    fingerX.value = e.x;
    active.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.6 });
    const i = tabIndexAt(e.x, barWidth.value, count);
    lastIndex.value = i;
    runOnJS(selectTab)(i);                // đổi tab là việc của JS → runOnJS
  })
  .onUpdate((e) => {                      // đang lướt
    fingerX.value = e.x;
    const i = tabIndexAt(e.x, barWidth.value, count);
    if (i !== lastIndex.value) {          // chỉ đổi tab khi sang tab mới
      lastIndex.value = i;
      runOnJS(selectTab)(i);
    }
  })
  .onTouchesUp((e) => { if (e.numberOfTouches === 0) settle(); }) // ngón cuối rời màn
  .onFinalize(() => settle());            // lưới an toàn: luôn chạy [5]
```
`settle()` là một worklet: trượt đỉnh sóng về giữa tab đã chọn và hạ `active` về 0 trong 180 ms
[Mã: `settleBubbles` trong [BubbleTabBar.tsx](../../src/navigation/BubbleTabBar.tsx)].

### Bước 4: Mỗi icon tự tính độ nhô ⚠ (chỗ dễ sai nhất)
```ts
// ĐÚNG: đọc .value NGAY TRONG hàm tạo style, rồi đưa SỐ vào hàm toán.
const iconStyle = useAnimatedStyle(() => {
  const k = liftAmount(fingerX.value, active.value, barWidth.value, index, count);
  return { transform: [{ translateY: -22 * k }, { scale: 1 + 0.5 * k }] };
});

function liftAmount(fx: number, act: number, w: number, i: number, n: number) {
  'worklet';
  if (w <= 0) return 0;
  return bubbleInfluence(Math.abs(fx - tabCenterX(i, w, n)), w / n) * act;
}
```
```ts
// SAI (app từng viết thế này và bị lỗi, xem mục 5):
const lift = () => { 'worklet'; return ... fingerX.value ... active.value ...; };
const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -22 * lift() }] }));
```
Lý do: Reanimated chỉ tự cập nhật style khi một shared value **gắn với** hàm tạo style thay đổi [8]. Nó tìm các shared
value đó bằng cách quét closure của hàm, và chỉ quét sâu vào **object thường**, không quét vào **hàm** [10]. Giấu
`.value` trong hàm `lift()` thì Reanimated không thấy, nên style không tự chạy lại.

### Bước 5: Vẽ icon
Mỗi tab gồm: một hình tròn nền (bong bóng, `opacity = k`) nằm sau icon, icon (nhô và to lên), và nhãn chữ (mờ đi khi
nhô). Thanh cần `overflow: 'visible'` để bong bóng được nhô lên trên mép thanh
[Mã: `BubbleItem`, `createStyles` trong BubbleTabBar.tsx].

### Bước 6: Chạm, rung, trợ năng
- **Rung nhẹ** mỗi lần sang tab mới: `Haptics.selectionAsync()` (expo-haptics) [Mã: [haptics.ts](../../src/lib/haptics.ts)].
- **VoiceOver:** mỗi tab là một phần tử `accessibilityRole="tab"`, có `accessibilityState={{ selected }}` và
  `onAccessibilityTap` [Mã: BubbleTabBar.tsx].
- **Giảm chuyển động:** nếu iPhone bật *Reduce Motion* (`useReducedMotion()`) thì không nhô, chỉ đổi tab.

### Bước 7: Giữ cử chỉ ổn định
Dựng gesture một lần bằng `useMemo`. Hàm đổi tab đọc trạng thái mới nhất qua `navigation.getState()`, không dùng biến
`state` của lần render cũ 💡 [Mã: BubbleTabBar.tsx].

---

## 4. Mở rộng: màn hình trượt qua nhau

### 4.1 Vì sao thanh tab mặc định không làm được
Trong `@react-navigation/bottom-tabs` v6, màn không được chọn nhận `activityState` 0, tức bị ẩn **ngay lập tức**
[Mã: `node_modules/@react-navigation/bottom-tabs/src/views/ScreenFallback.tsx`]. Màn cũ biến mất trước khi kịp trượt.

### 4.2 Tự viết một navigator nhỏ
React Navigation cho sẵn `useNavigationBuilder`, trả về `state`, `navigation`, `descriptors` và `NavigationContent`,
cùng `createNavigatorFactory` để đóng gói [11]. Ta tự vẽ các màn:

```
mỗi tab có một "offset" tính theo bề rộng màn hình:
   -1 = nằm ngay bên trái    0 = đang hiện    +1 = nằm ngay bên phải
translateX = offset × chiều rộng màn hình
```
Khi đổi tab theo hướng `d` (+1 = sang phải), dùng hàm thuần `slidePlan` [Mã: [slideTransition.ts](../../src/navigation/slideTransition.ts)]:
- **Màn mới:** nếu đang khuất thì đặt ở `d`, rồi trượt về 0.
- **Màn đang hiện** (dù chỉ một phần): trượt về `−d`.
- **Màn khuất:** giữ nguyên chỗ.

| Trước (Pin, Lịch sử, Tập, Nhật ký, Cài đặt) | Bấm "Tập" (d = +1) | Sau |
|---|---|---|
| `0, 1, 1, 1, 1` | Pin → −1, Tập: 1 → 0 | `−1, 1, 0, 1, 1` |

Mọi offset được animate bằng `withTiming(…, 300 ms)` trên luồng UI [Mã: [SlideTabNavigator.tsx](../../src/navigation/SlideTabNavigator.tsx)].
💡 Vì offset nằm trong shared value dùng chung, cử chỉ vuốt dài trên màn ([TabSwipe.tsx](../../src/navigation/TabSwipe.tsx))
kéo được cả màn hiện tại lẫn màn kế bên theo ngón tay, và navigator "trượt nốt" từ đúng chỗ ngón tay dừng.

---

## 5. Câu chuyện gỡ lỗi: 3 lần đoán sai, 1 lần đúng

**Triệu chứng chủ app báo:** lướt thanh tab rồi nhấc tay, bong bóng **không hạ**; chạm chỗ khác thì mới hạ.

| Lần | Giả thuyết | Đã làm | Kết quả |
|---|---|---|---|
| 1 | Mỗi lần đổi tab, thanh tab render lại, tạo gesture mới và làm mất sự kiện "nhấc tay" | Dựng gesture một lần (`useMemo`) | ❌ Vẫn lỗi |
| 2 | Vẫn là gesture bị dựng lại. Test Jest "xác nhận" điều này | Đổi cách truyền callback | ❌ Test đó **sai**: bản giả lập `useSharedValue` của Reanimated tạo object mới mỗi lần render. Trên máy thật không như vậy. |
| 3 | `onFinalize` tới chậm | Hạ bong bóng ngay ở `onTouchesUp`, dùng timing 180 ms thay lò xo | ❌ Vẫn lỗi |
| 4 | **Style không tự chạy lại** vì Reanimated không "thấy" shared value | Đọc `mappers.ts` của Reanimated [10], sửa như Bước 4 | ✅ |

**Manh mối quyết định:** "chỉ cập nhật khi có render". Lúc lướt thì mỗi lần đổi tab là một lần render, nên *trông như*
animation vẫn chạy. Lúc nhấc tay thì không có render nào, nên hình đứng yên.

**Bài học** 💡
1. **Đọc mã nguồn thư viện** khi tài liệu chỉ nói chung chung. Tài liệu nói "shared value **gắn với** style" [8],
   nhưng phải đọc code mới biết "gắn với" nghĩa là gì [10].
2. **Mock có thể nói dối.** Bản giả lập trong Jest khác bản thật chạy trên máy. Đừng "xác nhận" giả thuyết về
   runtime bằng test chạy trên mock.
3. **Tìm điểm khác biệt:** lúc nào chạy đúng, lúc nào sai? Ở đây: có render thì đúng, không render thì sai.
4. **Ghi lại** thành bài học để lần sau không mất công: [animated-style-must-read-shared-values-directly.md](../../.ai/skills/learned/animated-style-must-read-shared-values-directly.md).

---

## 6. Kiểm thử

| Loại | Kiểm tra được | Ví dụ trong app |
|---|---|---|
| Unit test hàm thuần | Toán đúng: đỉnh = 1, đối xứng, tab dưới ngón tay, kế hoạch trượt | [bubbleWave.test.ts](../../src/navigation/__tests__/bubbleWave.test.ts), [slideTransition.test.ts](../../src/navigation/__tests__/slideTransition.test.ts) |
| Test render (mock) | Bấm tab thì điều hướng đúng; tab đang chọn có `selected` | [BubbleTabBar.test.tsx](../../src/navigation/__tests__/BubbleTabBar.test.tsx), [SlideTabNavigator.test.tsx](../../src/navigation/__tests__/SlideTabNavigator.test.tsx) |
| **Thử trên máy thật** | Animation có chạy đúng không, cảm giác mượt không | Bắt buộc. Lỗi ở mục 5 chỉ lộ ra trên máy thật. |

Lệnh: `npm run verify` (gồm `tsc` + `eslint` + `jest`).

---

## 7. Bài tập tự làm

1. **(Dễ)** Tính bảng ở mục 2.2 cho ngón tay ở `x = 156` (ranh giới giữa tab 1 và tab 2). Tab nào nhô cao nhất?
   *Gợi ý: hai tab bằng nhau.*
2. **(Dễ)** Đổi `LIFT` thành 30 và `SWELL` thành 0.3. Chạy thử và mô tả cảm giác khác đi thế nào.
3. **(Vừa)** Viết test cho `tabIndexAt` khi `barWidth = 0`. Hàm trả về gì và vì sao như vậy là an toàn?
4. **(Vừa)** Cố tình viết lại lỗi ở Bước 4 (dùng hàm `lift()`), chạy trên điện thoại và quan sát. Sau đó sửa lại.
   *Đây là cách nhớ lâu nhất.*
5. **(Khó)** Làm hiệu ứng tương tự cho một danh sách **dọc**: ngón tay lướt dọc cạnh phải màn hình, các chữ cái A–Z
   phóng to quanh ngón tay. *Gợi ý: đổi `x` thành `y`, giữ nguyên `bubbleInfluence`.*
6. **(Khó)** Thêm vào `slidePlan` một trường hợp: đổi tab khi đang giữa chừng một lần trượt khác. Viết test trước, code sau.

---

## 8. Từ điển thuật ngữ

| Thuật ngữ | Nghĩa ngắn |
|---|---|
| Thread (luồng) | Một "làn" chạy code. App có luồng JS và luồng UI [7] |
| Shared value | Biến dùng chung giữa hai luồng, điều khiển animation [7] |
| Worklet | Hàm có `'worklet'`, chạy được trên luồng UI [7] |
| Gesture (cử chỉ) | Một thao tác chạm/kéo, có vòng đời `onBegin` … `onFinalize` [5] |
| `runOnJS` | Từ luồng UI gọi một hàm chạy trên luồng JS |
| Spring / Timing | Animation kiểu lò xo / theo thời lượng cố định |
| Fisheye | Kiểu giao diện phóng to chỗ đang xem, vẫn giữ phần xung quanh [2] |
| Mock | Bản giả lập thư viện dùng trong test; có thể khác bản thật |

---

## 9. Nguồn tham khảo

**Ý tưởng**
- [1] Apple Support, *Change Desktop & Dock settings on Mac* (mục Magnification). https://support.apple.com/guide/mac-help/change-desktop-dock-settings-mchlp1119/mac — Dùng cho: Dock phóng to biểu tượng dưới con trỏ. Truy cập 26/09/2026.
- [2] A. Cockburn, A. Karlson, B. B. Bederson, *A Review of Overview+Detail, Zooming, and Focus+Context Interfaces*, ACM Computing Surveys 41(1), 2008. https://faculty.cc.gatech.edu/~stasko/7450/Papers/cockburn-surveys08.pdf — Dùng cho: Dock của Mac OS X là một dạng fisheye. Truy cập 26/09/2026.
- [3] Wikipedia, *Gaussian function*. https://en.wikipedia.org/wiki/Gaussian_function — Dùng cho: công thức và ý nghĩa a, b, c. Truy cập 26/09/2026.

**Thư viện (tài liệu chính thức)**
- [4] Software Mansion, *Pan gesture* (Gesture Handler 2.x). https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/pan-gesture/ — Dùng cho: `minDistance`, `activeOffsetX`, `failOffsetY`, các callback, tự workletize khi có Reanimated. Truy cập 26/09/2026.
- [5] Software Mansion, *Gesture callbacks & events*. https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/callbacks-events/ và trang Pan 2.x ở [4] — Dùng cho: vòng đời `onBegin`/`onStart`/`onEnd`/`onFinalize`/`onTouchesUp`; khác biệt `onEnd` và `onFinalize` (qua kết quả tìm kiếm cho bản 2.x; trang callbacks hiện là API mới nhất, có tên `onActivate`). Truy cập 26/09/2026.
- [6] Software Mansion, *useSharedValue* (Reanimated). https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/ — Dùng cho: đọc/ghi `.value`, đọc trên luồng JS sẽ chặn luồng. Truy cập 26/09/2026.
- [7] Software Mansion, *Glossary* (Reanimated). https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/glossary/ — Dùng cho: định nghĩa worklet, shared value, luồng UI/JS, plugin Babel. Truy cập 26/09/2026.
- [8] Software Mansion, *useAnimatedStyle* (Reanimated). https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle/ — Dùng cho: style tự cập nhật khi shared value gắn với nó thay đổi. Truy cập 26/09/2026.
- [9] Expo, *Reanimated* (SDK 57). https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/ — Dùng cho: có sẵn trong Expo Go, lệnh cài, plugin Babel tự cấu hình qua `babel-preset-expo`. Truy cập 26/09/2026.
- [11] React Navigation, *Custom navigators* (6.x). https://reactnavigation.org/docs/6.x/custom-navigators — Dùng cho: `useNavigationBuilder`, `createNavigatorFactory`, `TabRouter`. Truy cập 26/09/2026.

**Mã nguồn (GitHub)**
- [10] software-mansion/react-native-reanimated, `packages/react-native-reanimated/src/mappers.ts`, hàm `extractInputs`. https://github.com/software-mansion/react-native-reanimated/blob/main/packages/react-native-reanimated/src/mappers.ts — Dùng cho: chỉ quét sâu vào object thường, không quét vào hàm (gốc lỗi ở mục 5). Truy cập 26/09/2026. Bản đang cài trong app: `node_modules/react-native-reanimated/src/mappers.ts`.

## Lịch sử chỉnh sửa
| Ngày | Bản | Thay đổi |
|---|---|---|
| 26/09/2026 | 1 | Bản đầu, viết theo skill [`learn-with-ai`](../../.ai/skills/learn-with-ai.md) |

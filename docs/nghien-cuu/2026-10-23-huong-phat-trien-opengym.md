# Hướng phát triển của openGym và bài học cho BodyBatteries

| Mục | Nội dung |
|---|---|
| Ngày | 2026-10-23 |
| Đối tượng khảo sát | Repo GitHub `DuarteSantos8/openGym`: nhánh `main` (commit mới nhất 2026-10-13), các nhánh đang làm `release-1.4.3`, `store-shots`, `account-delete`, `coach-consent`, `onboarding-perms` |
| So với | BodyBatteries nhánh `ui-upgrade` (commit `4ef9d89`) |
| Mục tiêu | Hiểu openGym đang đi về đâu, vì sao phát triển nhanh, và lấy được gì cho BodyBatteries |

**Chú giải** (nguồn truy cập ngày 2026-10-23):

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* ở cuối bài |
| `[Mã: file]` | Rút ra từ code BodyBatteries |
| `[Nội bộ: file]` | Rút ra từ tài liệu nội bộ |
| 💡 | Nhận định của người viết |
| ❓ | Chưa kiểm chứng được |

## Tóm tắt

1. openGym là app theo dõi tập gym **tự host** (chạy trên máy chủ của người dùng), web + Android, giấy phép AGPL-3.0. Repo tạo ngày 2026-07-18, đến nay khoảng 15.000 sao và gần 2.000 fork [1].
2. Hướng đi rõ nhất lúc này: **lên App Store và Google Play**. Các nhánh đang làm đều là việc "dọn đường" cho store: xoá tài khoản ngay trong app, hỏi ý trước khi gửi dữ liệu cho AI, ảnh chụp màn hình store, app Apple Watch qua TestFlight [6][9]. Đây đúng là những điều khoản Apple yêu cầu [11].
3. Sau store là chuỗi tính năng tập luyện: **Programme (gom buổi thành block nhiều tuần)** → động cơ tăng tạ (%1RM, RPE, 5/3/1) → cardio → chia sẻ/phòng gym → huấn luyện viên → đồng hồ thông minh → giao diện/mạng xã hội; cuối cùng mới chuyển từ file JSON sang cơ sở dữ liệu [3][6].
4. Cách làm đáng học: **phát hành 2 tuần/lần, mỗi bản một chủ đề, ngày không dời** — việc chưa xong thì sang bản sau [3]. Phần lớn code được viết bằng Claude Code với một file `CLAUDE.md` làm bối cảnh [2][4], giống cách BodyBatteries đang làm.
5. 💡 BodyBatteries đã đi trước openGym ở **block nhiều tuần** (S-PL) và **liên kết tập–ăn–năng lượng**. Thứ đáng mượn nhất là: đồng hồ nghỉ giữa hiệp, nhập dữ liệu từ Strong/Hevy, giải thích "vì sao số tạ này", và nhịp phát hành theo chủ đề.

## Đính chính

Trong chính repo openGym, các tài liệu đang **mâu thuẫn nhau**. Nên tin nguồn mới nhất (milestones trên GitHub).

| Tài liệu cũ nói | Nguồn mới hơn nói | Nguồn |
|---|---|---|
| README: v1.4.0 (kho bài tập mới) ra tháng 11/2026 | Đã phát hành ngày 2026-10-09 | README [2] vs Releases [7] |
| ROADMAP.md: v1.4.1 = "Programmes & phases" (29/11) | v1.4.1 thực tế là bản sửa lỗi (10/10); Programme dời sang milestone v1.4.4 (hạn 15/11) | [3] vs [6][7] |
| ROADMAP.md: app iOS là v1.4.8 (03/2027) | Milestone v1.4.2 "App Store, Apple Watch" hạn 18/10/2026 — đã quá hạn nhưng nhánh đang build TestFlight | [3] vs [6][9] |
| README: "openGym cố ý không lên Play Store" | Milestone v1.4.5 tên "Google Play & progression engine I"; CLA nói rõ mục đích "để app ở lại App Store và Google Play lâu dài" | [2] vs [5][6] |

💡 Kết luận: hướng đi đã **đổi trong tháng 10** — từ "tự host, tránh store" sang "lên cả hai store". ROADMAP.md và README chưa được cập nhật theo.

## 1. openGym là gì

| Khía cạnh | Thực tế | Nguồn |
|---|---|---|
| Kiến trúc | React 19 + Vite + Zustand (frontend); Node `node:http` thuần, chỉ 2 thư viện (backend); dữ liệu là file JSON trong `./data` | [2][4] |
| Điện thoại | Cùng một code, đóng gói bằng Capacitor. Android: tải APK trên GitHub. iPhone: dùng PWA hoặc tự build bằng Xcode | [2] |
| Đồng bộ | Mỗi hồ sơ là một tài liệu có số "revision"; hai máy sửa cùng lúc thì gộp theo từng trường, xoá thì giữ xoá | [2] |
| Đăng nhập | Passkey (Face ID/vân tay); mật khẩu là tuỳ chọn | [2] |
| Tính năng chính | Hơn 5.600 bài tập có ảnh động, siêu hiệp/drop set/khởi động, đồng hồ nghỉ, tính đĩa tạ, quy tắc tăng tạ (linear, double, triple progression), e1RM, bản đồ cơ (khối lượng/đang hồi/bỏ lâu), cân nặng, ảnh tiến độ | [2] |
| Nhập/xuất | Nhập từ FitNotes, Strong, Hevy, Apple Health (cân nặng); xuất JSON, PDF, Garmin `.fit` | [2][8] |
| AI | "AI coach" tuỳ chọn (dùng khoá API của người dùng); máy chủ MCP chỉ đọc cho Claude Desktop | [2] |
| Ngôn ngữ | 19 ngôn ngữ, có tiếng Ả Rập viết phải-sang-trái | [2] |
| Giấy phép | Code: AGPL-3.0. **Ảnh động bài tập không thuộc AGPL** — bản quyền Gym visual, chỉ dùng trong openGym | [2] |

## 2. Hướng phát triển (theo milestones thật)

| Milestone | Hạn | Chủ đề | Nguồn |
|---|---|---|---|
| v1.4.2 | 18/10 | App Store, Apple Watch, chất lượng ảnh động | [6] |
| v1.4.3 | 01/11 | Nhắc khi tới phòng gym (theo vị trí), dữ liệu sức khoẻ (Health Connect đọc cân nặng), khôi phục tài khoản | [6] |
| v1.4.4 | 15/11 | **Programme** (gom routine thành block nhiều tuần, có tuần xả/nghỉ), các pha buổi tập (giãn cơ/chính/phụ/hạ nhiệt), bài thay thế khi máy bận, thành phần cơ thể | [6] |
| v1.4.5 | 29/11 | Google Play, động cơ tăng tạ I (khoảng rep, AMRAP), widget màn hình khoá | [6] |
| v1.4.6 | 13/12 | Động cơ tăng tạ II: %1RM, RPE/RIR mục tiêu, kiểu 5/3/1, tự sinh hiệp khởi động | [6] |
| v1.4.7 – v1.4.12 | 12/2026 – 03/2027 | Cardio interval, tìm kiếm, OIDC, vai trò huấn luyện viên, Wear OS/Garmin, skin + mạng xã hội | [6] |
| Sau đó | — | Chuyển từ JSON sang cơ sở dữ liệu — lần duy nhất phá tương thích | [3][6] |

Các issue mới nhất cho thấy người dùng đang hỏi gì: tốc độ tăng/giảm cân mỗi tuần theo một "hành lang" mục tiêu (#759), hoàn tác khi xoá lần cân (#756), ghi hiệp từ Apple Watch (#752), nghỉ theo nhịp tim (#749), file `.ipa` cho iPhone (#750) [10].

## 3. Vì sao openGym lớn nhanh

| Yếu tố | Bằng chứng | Nguồn |
|---|---|---|
| Nhịp phát hành cố định | "Một bản mỗi 2 tuần, vào Chủ nhật… việc chưa test xong trước thứ Sáu thì sang bản sau, ngày không dời" | [3] |
| Mỗi bản một chủ đề | Ví dụ v1.3.2–1.3.3 "Cleaner workout": giảm ~10 nút dưới mỗi thẻ xuống còn một nút "⋯" | [3] |
| Cộng đồng đóng góp | 406 PR tổng cộng (gồm cả PR của chủ repo); 176 PR của người ngoài đã được merge trên GitHub; bản v1.3.9 gộp 39 PR cộng đồng | [1][7][12] |
| Thông điệp rõ | "Không tài khoản trên máy chủ người khác, không thu phí, không quảng cáo, không theo dõi" | [2] |
| AI hỗ trợ code | "Phần lớn code, test và tài liệu được viết nháp trong các phiên Claude Code" | [2] |

💡 Điểm thứ 2 rất gần với quy tắc "giao diện gọn" của BodyBatteries [Nội bộ: [AGENTS.md](../../AGENTS.md)]: openGym cũng đi đến kết luận "mỗi thứ một menu, phần phụ cách một lần chạm".

## 4. So sánh với BodyBatteries

| Chủ đề | openGym | BodyBatteries | 💡 Nhận xét |
|---|---|---|---|
| Lưu dữ liệu | Máy chủ tự host (JSON) hoặc chỉ trên máy [2] | Chỉ trên máy (SQLite) [Nội bộ: [public-store launch](2026-09-26-bao-mat-va-phat-hanh-store.md)] | BB không có tài khoản → không vướng luật xoá tài khoản 5.1.1(v) [11] |
| Block nhiều tuần | Chưa có, dự kiến v1.4.4 [6] | Đã có (S-PL, `BxWy`, tuần xả) [Mã: [blockSchedule.ts](../../src/domain/energy/blockSchedule.ts)] | BB đi trước |
| Tăng tạ tự động | Có, nhiều kiểu, mỗi mục tiêu tự giải thích lý do [2] | Có e1RM và biểu đồ tiến bộ [Mã: [TrainingProgressChart.tsx](../../src/components/training/TrainingProgressChart.tsx)] | Có thể mượn ý "giải thích vì sao số này" (sau ⓘ) |
| Đồng hồ nghỉ | Có, thông báo trên màn khoá, chọn âm báo [2][8] | Chưa có (tìm `restTimer`/`countdown` trong `src/` chỉ ra bộ đếm tự gập, không phải đồng hồ nghỉ) [Mã: [TrainingLogPeriodSection.tsx](../../src/components/training/TrainingLogPeriodSection.tsx)] | Ứng viên tốt nhất để mượn |
| Nhập từ app khác | FitNotes/Strong/Hevy [2] | Chỉ nhập Notes của chủ dự án (tạm) [Mã: [ownerNotesImport.ts](../../src/domain/training/ownerNotesImport.ts)] | Mở rộng thành nhập CSV Strong/Hevy giúp người mới chuyển sang |
| Ăn uống / năng lượng | Không có [2] | Là trọng tâm (Pin, thực phẩm, Excel) | Khác biệt lớn nhất của BB — giữ |
| Apple Health | iOS app đang làm [6][9] | Có code, chỉ chạy khi build dev-client [Mã: [appleHealthSync.ts](../../src/services/health/appleHealthSync.ts)] | Cùng nút thắt: cần bản native |
| Đa ngôn ngữ | 19 ngôn ngữ [2] | vi/en/de, hệ thống tự viết [Nội bộ: [AGENTS.md](../../AGENTS.md)] | Đủ cho giai đoạn này |
| AI trong app | Coach tuỳ chọn, hỏi ý trước khi gửi dữ liệu [2][9] | Không có | Nếu sau này thêm, phải hỏi ý trước — Apple 5.1.2(i) bắt buộc [11] |

## 5. Gợi ý cho BodyBatteries

| Ưu tiên | Gợi ý | Lý do |
|---|---|---|
| 1 | **Đồng hồ nghỉ giữa hiệp** gắn với buổi tập trong block | Tính năng được dùng mỗi hiệp; openGym đầu tư nhiều bản cho nó [3][8] 💡 |
| 2 | **Nhập CSV từ Strong/Hevy** (chạy trên máy, không mạng) | Hạ rào cản cho người mới khi lên store [2] 💡 |
| 3 | **"Vì sao số tạ này"** sau nút ⓘ trong kế hoạch block | openGym: "mỗi mục tiêu giải thích vì sao là con số đó" [2]; khớp quy tắc ⓘ của BB 💡 |
| 4 | **Hành lang tăng/giảm cân mỗi tuần** | Người dùng openGym đang xin (#759) [10]; BB đã có biểu đồ cân nặng [Mã: [WeightTrendChart.tsx](../../src/components/WeightTrendChart.tsx)] 💡 |
| 5 | **Nhịp phát hành 2 tuần, mỗi đợt một chủ đề** cho bản preview | Giữ phạm vi nhỏ, dễ test trên máy thật [3] 💡 |
| — | Không nên mượn: máy chủ tự host, passkey, đồng bộ nhiều máy | Trái với ràng buộc "chỉ lưu trên máy" của BB 💡 |

**Cảnh báo khi tham khảo code openGym:**
- Code openGym là **AGPL-3.0** [2]. 💡 Chép code sang BB sẽ kéo theo nghĩa vụ AGPL. Chỉ nên học ý tưởng, tự viết lại.
- **Không dùng ảnh động bài tập** của openGym: thuộc bản quyền Gym visual, chỉ cấp cho openGym [2].

## 6. Cộng đồng đóng góp gì (bản 2)

Dữ liệu: 176 PR của người ngoài đã merge trên GitHub, từ 30/07 đến 23/10/2026 [12]. Nhóm theo từ khoá trong tiêu đề PR; một PR có thể rơi vào hai nhóm nên số chỉ là ước lượng 💡.

| Nhóm tính năng | ≈ PR | Ví dụ tiêu biểu | Nguồn |
|---|---|---|---|
| AI Coach + MCP (cho trợ lý AI đọc lịch sử tập) | ~29 | Chuỗi "Coach 1/6 … 6/6" (máy chủ, kiểm tra kết quả AI, giao diện, 11 ngôn ngữ); MCP chỉ-đọc #19 | [12] |
| Dịch ngôn ngữ, tên bài tập | ~23 | Tên 1.324 bài tập tiếng Nga (#266), Tây Ban Nha (#245), Ý/Đức/Pháp (#254), Ukraina, Bengal, Trung phồn thể | [12] |
| Sửa buổi đã lưu, lịch sử | ~20 | Sửa buổi đã lưu + gỡ xung đột đồng bộ (#203), đổi ngày giờ buổi tập (#263), lưu buổi đã tập thành routine (#211) | [12] |
| Kiểu hiệp, tạ | ~18 | Hiệp kim tự tháp (#367, #446), back-off (#475), từng bên cho bài giữ (#322), RIR (#21), tính đĩa tạ từng hàng (#194) | [12] |
| Đồng hồ nghỉ, âm báo | ~14 | Thông báo đếm ngược nghỉ trên điện thoại "không thêm thư viện" (#49), Android (#296), âm iOS (#183) | [12] |
| Bản đồ cơ: mỏi / hồi / bỏ lâu | ~13 | Chế độ Mỏi + Sức mạnh (giảm khi bỏ tập) (#44), mô hình khối lượng theo cường độ (#55), mỏi theo số hiệp + hồi phục từng cơ (#436), so khối lượng kế hoạch vs thực tế (#333) | [12] |
| Tự host (Helm, Nix, Kubernetes, non-root…) | ~12 | #418, #452, #304, #466 | [12] |
| Nhập/xuất, sức khoẻ | ~11 | Health Connect ghi buổi tập + cân nặng (#371), chia sẻ buổi tập thành ảnh (#455), ảnh tiến độ trước/sau (#361), số đo cơ thể (#82) | [12] |
| Khởi động | ~9 | Tách pha khởi động (#48), nghỉ riêng cho hiệp khởi động (#164) | [12] |

**Người đóng góp nổi bật** [12]:
- `kurktchiev` — 57 PR. Phần lớn là sửa lỗi và rà chất lượng (12 lỗi bảo mật từ đợt "Astra" #166), cộng thêm **hàng đợi xoay vòng** (#167): buổi tiếp theo là buổi chưa tập, bất kể thứ mấy.
- `Space-Hermes` — 26 PR. Trải nghiệm trong buổi tập (siêu hiệp, khởi động, điền sẵn) và **bản đồ cơ Mỏi/Sức mạnh**.
- `alexpcosta` — 9 PR: toàn bộ AI Coach.

**Fork nổi bật:** gần như mọi fork chỉ có 1–3 sao [13]. Ngoại lệ duy nhất là `alexpcosta/opengym` (894 sao, 214 fork): fork này sinh ra để làm **AI Coach**, với commit "AI Coach: functional plan + implementation plan" do Claude viết ngày 01/08/2026 [14]. Sau đó tính năng được đưa ngược vào repo gốc qua chuỗi PR "Coach 1/6–6/6" [12]. 💡 Tức là fork ở đây không tách nhánh cạnh tranh, mà là "phòng thí nghiệm" rồi trả về repo gốc.

💡 **Điểm chung:** người dùng góp nhiều nhất vào những thứ **chạm tay mỗi hiệp** (đồng hồ nghỉ, khởi động, kiểu hiệp, sửa sai) và **giải thích cơ thể** (bản đồ cơ mỏi/hồi). Họ góp ít vào biểu đồ hay trang thống kê thuần.

## 7. Vì sao người dùng tải về

**Số lượt tải APK** (tổng lượt tải file `.apk` của từng bản) [7]:

| Bản | Ngày | Lượt tải APK |
|---|---|---|
| v1.3.7 | 12/09 | 431 |
| v1.3.8 | 20/09 | 880 |
| v1.3.9 | 28/09 | 4.798 |
| v1.3.10 | 07/10 | 1.639 |
| v1.4.0 | 09/10 | 2.403 |
| v1.4.1 | 10/10 | 24.525 |

⚠️ **Đừng đọc số này là "người dùng mới".** Từ 10/10, app tự kiểm tra bản mới trên GitHub và tự tải APK về [8]. Vì vậy v1.4.1 gồm cả lượt người cũ cập nhật 💡 suy luận. Bản v1.4.1 cũng nằm lâu nhất ở vị trí "mới nhất" (từ 10/10 đến nay).

**Thời điểm bùng nổ:** ngày 04–06/10/2026, repo đứng **#1 trong nhóm JavaScript** và #3 toàn GitHub trên Trendshift [15]. AlternativeTo thêm openGym vào ngày 09/10 [16]. 💡 Suy luận: lượt tải tăng mạnh là nhờ được lên bảng xếp hạng xu hướng của GitHub, cộng với bản v1.4.0 có 5.632 bài tập [3] ra đúng lúc đó.

**Lý do người dùng nêu ra** (bằng lời của chính họ):

| Lý do | Bằng chứng | Nguồn |
|---|---|---|
| Miễn phí, không quảng cáo, không thuê bao, không theo dõi | Đánh giá 5 sao trên AlternativeTo khen "không thuê bao, quảng cáo hay theo dõi" | [16] |
| Dữ liệu thuộc về mình | Cả hai đánh giá trên AlternativeTo đều nhắc đến tự host / kiểm soát dữ liệu tập | [16] |
| Ghi nhanh trong phòng gym | Khen "tạ của buổi trước đã điền sẵn", đồng hồ nghỉ có sẵn, theo dõi tiến bộ | [16] |
| Lịch không phạt khi lỡ buổi | Khen lịch xoay vòng: "lỡ một ngày thì cứ tập buổi tiếp theo" | [16] |
| Chuyển từ app khác dễ | Khen nhập từ Strong, Hevy, FitNotes; có API mở | [16] |
| Android chạy được mà không cần máy chủ | "Không tài khoản, không máy chủ, mọi thứ ở trên điện thoại" | [2] |

**Người dùng muốn gì tiếp** (issue có nhiều 👍 nhất) [10]: app iOS + Apple Health/Watch (#90, 10👍); lên F-Droid (#325, 7👍); Health Connect (#200); xuất Garmin `.fit` (#447). Trong Discussions, ý tưởng được bình chọn nhiều nhất là tích hợp Garmin và đồng hồ thể thao (#24, 16↑) [17].

## 8. Diễn đàn đánh giá thế nào

| Nơi | Thấy được gì | Nguồn |
|---|---|---|
| Discord | Nơi trao đổi chính: CHANGELOG ghi "Discord là nơi phần lớn việc diễn ra"; nhiều lỗi và tính năng ghi nguồn là "Discord" | [18] |
| GitHub Discussions | 65 chủ đề; được bình chọn nhiều nhất là tích hợp Garmin (16↑) | [17] |
| AlternativeTo | 19 lượt thích, 2 đánh giá 5 sao, được so với 54 app khác (Hevy, wger, Kenko…) | [16] |
| Trendshift | #1 JavaScript 04–06/10; vẫn trong top 25 JavaScript đến 20/10 | [15] |
| Hacker News | Chỉ có 1 bài đăng (23/09/2026), 1 điểm, 1 bình luận — **không** phải nơi tạo ra độ nổi tiếng | [19] |
| Reddit | ❓ Không kiểm chứng được: công cụ không truy cập được reddit.com, và tìm kiếm web không trả về chủ đề nào | — |

**Vì sao được đánh giá cao** 💡 (tổng hợp từ [2][15][16][17]):
1. **Đúng nỗi đau:** app tập phổ biến bắt thuê bao hoặc giữ dữ liệu. openGym hứa ngược lại, và các đánh giá nhắc lại đúng lời hứa đó.
2. **Đủ sâu cho người tập thật:** RIR/RPE, nhiều kiểu tăng tạ, tính đĩa, bản đồ cơ. Không chỉ là cuốn sổ ghi.
3. **Phản hồi nhanh:** 2 tuần một bản, và CHANGELOG ghi rõ yêu cầu nào đến từ Discord hay issue nào. Người góp ý thấy ý mình được làm.
4. **Dễ góp code:** kho bài tập để mỗi bài một file trong repo, ai cũng sửa/dịch được bằng PR [3]; tác giả nói rõ dùng Claude Code [2].

**Lời phê bình** (để BB tránh):
- Phải tự chạy và cập nhật máy chủ: "không hợp với người chỉ muốn tải app về là dùng" [16].
- Issue #491 "lần đầu thấy app có cảm giác AI làm" — số liệu giữa các thẻ thống kê không khớp nhau (bản đồ nhiệt 12 tháng chỉ hiện 4 tháng trên điện thoại, cân bằng cơ báo "không có dữ liệu" trong khi thẻ khác có) [20]. 💡 Cái giá của tốc độ ra bản quá nhanh: nhiều thẻ trùng ý, khó tin.

**Đính chính bổ sung:** ngày 01/08/2026, tác giả viết trong Discussions rằng openGym "**không** lên app store" và "**không** theo dõi dinh dưỡng/macro — đó là một app khác với bài toán dữ liệu khác" [17]. Về store, hướng này đã đảo ngược trong tháng 10 (xem mục Đính chính ở đầu). Về dinh dưỡng, chưa thấy thay đổi [6].

## 9. Ý tưởng để BodyBatteries tự làm và mở rộng (không chép code)

| Ý tưởng từ openGym | Cách BB mở rộng theo kiểu riêng 💡 | Liên hệ BB |
|---|---|---|
| Bản đồ cơ: mỏi / đang hồi / bỏ lâu [2][12] | **"Pin cơ"**: mỗi nhóm cơ là một viên pin, sạc lại theo thời gian nghỉ và tụt khi tập. Đúng ngôn ngữ "Pin" sẵn có của app | [Mã: [blockSchedule.ts](../../src/domain/energy/blockSchedule.ts)] |
| Hàng đợi xoay vòng: lỡ buổi thì tập buổi kế tiếp [12][16] | Thêm chế độ "buổi tiếp theo chưa tập" cho block, không dời cả tuần, không báo "trễ" | Khớp hướng "không streak ngày" [Nội bộ: [2026-10-20](2026-10-20-ghi-it-hon-va-trang-tuy-chinh.md)] |
| Ghi chú cho ngày không tập; lời nhắc lỡ buổi "cho qua ngày đó" [8] | Ngày nghỉ có ghi chú ngắn (ốm, bận) và được tính vào Pin hồi phục thay vì "trống" | Khớp "chưa ghi ≠ 0" [Nội bộ: [2026-10-20](2026-10-20-ghi-it-hon-va-trang-tuy-chinh.md)] |
| Điền sẵn tạ từ lần trước [2][16] | Mở rộng cơ chế điền sẵn đã có cho Vận động sang từng hiệp tạ | [Nội bộ: [2026-09-26](2026-09-26-ghi-van-dong-gon-va-dien-san.md)] |
| Đồng hồ nghỉ có thông báo [12] | Thời gian nghỉ gợi ý theo loại hiệp (nặng/nhẹ), hiển thị gọn trên thẻ buổi tập | Chưa có trong BB |
| Sửa buổi đã lưu, kỷ lục được tính lại [2][12] | Sửa hiệp đã lưu thì e1RM và biểu đồ tiến bộ tự cập nhật | [Mã: [entryEdit.ts](../../src/domain/training/entryEdit.ts)] |
| Nhập từ Strong/Hevy/FitNotes [2][16] | Nhập CSV hoàn toàn trên máy, kèm bước xem trước trước khi lưu | Hạ rào cản khi lên store |
| Chia sẻ buổi tập thành ảnh [12] | BB đã có giữ-để-lưu-ảnh; thêm thẻ "buổi hôm nay + Pin" | [Mã: [ShareProgressCard.tsx](../../src/components/training/ShareProgressCard.tsx)] |
| **Khoảng trống:** openGym tuyên bố không làm dinh dưỡng [17] | Đây là lợi thế riêng của BB: nối buổi tập với ăn uống và năng lượng trong cùng một Pin | Trọng tâm hiện có của BB |
| Thông điệp "không tài khoản, không quảng cáo, không theo dõi" [2][16] | Dùng làm câu mở đầu trang store của BB (BB còn mạnh hơn: không cần cả máy chủ) | [Nội bộ: [store](2026-09-26-bao-mat-va-phat-hanh-store.md)] |
| Bài học từ #491 [20] | Mỗi con số chỉ hiện ở một chỗ; thẻ nào cũng ghi rõ khoảng thời gian | Khớp quy tắc giao diện gọn [Nội bộ: [AGENTS.md](../../AGENTS.md)] |

## Các quyết định cần chủ dự án chốt

1. Có làm **đồng hồ nghỉ** trong đợt tới không? 💡 Khuyến nghị: có — nhỏ, dùng hằng ngày, không cần thư viện native mới nếu chỉ chạy khi app mở (❓ thông báo khi app chạy nền cần kiểm tra lại trên Expo SDK 58).
2. Có làm **nhập CSV Strong/Hevy** trước khi lên store không? 💡 Khuyến nghị: để sau đồng hồ nghỉ, vì cần lấy file mẫu thật để kiểm tra định dạng.
3. Có muốn theo **nhịp phát hành 2 tuần/chủ đề** không? 💡 Khuyến nghị: thử 1–2 đợt.
4. (Bản 2) Có muốn làm **"Pin cơ"** (bản đồ cơ theo kiểu pin) không? 💡 Khuyến nghị: có, nhưng cần một đợt nghiên cứu riêng về cách tính thời gian hồi phục từng nhóm cơ, có nguồn khoa học, trước khi viết code.
5. (Bản 2) Có thêm **chế độ xoay vòng** ("buổi tiếp theo chưa tập") cho block không? 💡 Khuyến nghị: có — nhỏ, hợp với người hay lỡ buổi.

## Tài liệu tham khảo

**GitHub — openGym** (đọc qua GitHub API bằng `gh`, ngày 2026-10-23)

- [1] Thông tin repo (ngày tạo, sao, fork, giấy phép, ngôn ngữ) — https://github.com/DuarteSantos8/openGym — Dùng cho: tuổi repo, ~15.038 sao, 1.955 fork, số PR.
- [2] README.md — https://github.com/DuarteSantos8/openGym/blob/main/README.md — Dùng cho: kiến trúc, tính năng, đồng bộ, giấy phép và bản quyền ảnh, ghi chú "phát triển bằng Claude Code", câu "không lên Play Store".
- [3] ROADMAP.md — https://github.com/DuarteSantos8/openGym/blob/main/ROADMAP.md — Dùng cho: nhịp phát hành 2 tuần, các chủ đề đã phát hành, thứ tự lộ trình cũ, chuyển sang cơ sở dữ liệu.
- [4] CLAUDE.md — https://github.com/DuarteSantos8/openGym/blob/main/CLAUDE.md — Dùng cho: cấu trúc thư mục, không TypeScript/linter.
- [5] CLA.md — https://github.com/DuarteSantos8/openGym/blob/main/CLA.md — Dùng cho: mục đích "ở lại App Store và Google Play lâu dài".
- [6] Milestones — https://github.com/DuarteSantos8/openGym/milestones — Dùng cho: lộ trình thật v1.4.2–v1.4.12 và hạn từng bản.
- [7] Releases — https://github.com/DuarteSantos8/openGym/releases — Dùng cho: ngày phát hành v1.3.x–v1.4.1, 39 PR cộng đồng ở v1.3.9.
- [8] Lịch sử commit `main` — https://github.com/DuarteSantos8/openGym/commits/main — Dùng cho: âm báo hết giờ nghỉ, xuất Garmin .fit, triple progression.
- [9] Các nhánh đang làm — https://github.com/DuarteSantos8/openGym/branches (`release-1.4.3`, `store-shots`, `account-delete`, `coach-consent`, `onboarding-perms`) — Dùng cho: xoá tài khoản, hỏi ý chia sẻ dữ liệu cho AI, TestFlight Apple Watch, ảnh store.
- [10] Issues đang mở — https://github.com/DuarteSantos8/openGym/issues — Dùng cho: 119 issue mở, các yêu cầu mới #749–#759.

- [12] Danh sách PR đã merge (lọc người ngoài) — https://github.com/DuarteSantos8/openGym/pulls?q=is%3Apr+is%3Amerged — Dùng cho: 176 PR cộng đồng, nhóm tính năng, người đóng góp (đọc qua `gh api`, 2026-10-23).
- [13] Danh sách fork theo số sao — https://github.com/DuarteSantos8/openGym/forks?sort=stargazers — Dùng cho: hầu hết fork có 1–3 sao. Truy cập 2026-10-23.
- [14] Fork `alexpcosta/opengym` — https://github.com/alexpcosta/opengym — Dùng cho: 894 sao, 214 fork, các commit AI Coach ngày 01/08/2026. Truy cập 2026-10-23.
- [17] GitHub Discussions, đặc biệt #37 "What's next — and what openGym is deliberately not going to be" (01/08/2026) — https://github.com/DuarteSantos8/openGym/discussions/37 — Dùng cho: 65 chủ đề, ý tưởng Garmin 16↑, tuyên bố không lên store và không làm dinh dưỡng. Truy cập 2026-10-23.
- [18] CHANGELOG.md — https://github.com/DuarteSantos8/openGym/blob/main/CHANGELOG.md — Dùng cho: Discord là nơi trao đổi chính. Truy cập 2026-10-23.
- [20] Issue #491 "first time i got AIish feeling from this app v1.4.0" — https://github.com/DuarteSantos8/openGym/issues/491 — Dùng cho: lời phê bình số liệu không khớp. Truy cập 2026-10-23.

**Trang bên ngoài**

- [15] Trendshift — https://trendshift.io/repositories/88268 — Dùng cho: #1 JavaScript 04–06/10/2026, #3 toàn GitHub 04/10. Truy cập 2026-10-23.
- [16] AlternativeTo — https://alternativeto.net/software/opengym/about/ — Dùng cho: 19 lượt thích, 2 đánh giá 5 sao và nội dung khen/chê, 54 app thay thế, ngày thêm vào 09/10/2026. Truy cập 2026-10-23.
- [19] Tìm kiếm Hacker News (Algolia API) — https://hn.algolia.com/api/v1/search?query=opengym&tags=story — Dùng cho: chỉ có 1 bài (id 49814241, 23/09/2026, 1 điểm). Truy cập 2026-10-23.

**Apple**

- [11] App Store Review Guidelines — https://developer.apple.com/app-store/review/guidelines/ — Dùng cho: 5.1.1(v) "nếu app cho tạo tài khoản thì phải cho xoá tài khoản trong app"; 5.1.2(i) phải nói rõ và xin phép trước khi chia sẻ dữ liệu cá nhân với AI bên thứ ba; 5.1.3 dữ liệu sức khoẻ. Truy cập 2026-10-23.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-23 | 1 | Bản đầu |
| 2026-10-23 | 2 | Thêm mục 6–9: đóng góp cộng đồng và fork, lý do tải về, đánh giá trên diễn đàn, ý tưởng mở rộng cho BB. Sửa con số "hơn 400 PR" thành 406 PR tổng / 176 PR cộng đồng đã merge |

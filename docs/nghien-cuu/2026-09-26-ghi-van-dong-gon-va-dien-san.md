# Ghi vận động: gọn hơn, điền sẵn theo thói quen, giữ phần nhập dở

| | |
|---|---|
| Ngày | 26/09/2026 |
| Phạm vi | Màn "🔥 Xả / Verbrennen → Ghi vận động / Aktivität eintragen" |
| Nhánh / commit | `ui-upgrade`, sau `6591899` (chưa commit) |
| Mục tiêu | (1) Gọn, chữ vừa khung ở vi/en/de; (2) tự điền hoạt động hay làm vào khung giờ này; (3) giữ phần nhập dở khi lỡ tay thoát, nút Huỷ để thoát thật, nhập dở quá 5 phút thì làm mới |

**Cách đọc trích dẫn** (nguồn truy cập 26/09/2026): `[n]` nguồn web · `[Mã: file]` code app · 💡 nhận định của người viết · ❓ chưa kiểm chứng.

## Tóm tắt
1. **Mặc định tốt tiết kiệm công sức.** Người dùng hiếm khi tuỳ chỉnh và thường giữ nguyên giá trị mặc định. Vì vậy nên chọn mặc định "thường gặp nhất" [1]. Giá trị mặc định cũng đóng vai trò hướng dẫn tại chỗ: nhìn vào là biết ô này điền gì [1].
2. **Thói quen gắn với bối cảnh.** Một hành vi lặp lại trong cùng bối cảnh (ví dụ "sau bữa sáng") thì dần thành tự động. Lỡ một lần không làm hỏng quá trình hình thành thói quen [3]. 💡 Giờ trong ngày là bối cảnh dễ đo nhất trong app, nên dùng nó để đoán "như thường lệ".
3. **Luôn có cách thoát rõ ràng, và đừng làm mất nội dung người dùng đã nhập** [2].
4. **Màn cũ** [Mã: [EnergyActionsBar.tsx](../../src/components/EnergyActionsBar.tsx) trước khi sửa]:
   - Nút Huỷ không xoá gì, nên nội dung cũ nằm lại mãi.
   - Nhập dở chỉ nằm trong bộ nhớ, mất khi app bị tắt.
   - Chip Powerlifting/Bodybuilding đóng màn này, là một kiểu "lỡ tay thoát".
   - Nút Huỷ/Ghi nằm cuối một form dài, không cuộn được.
   - Tab nhóm "Fitnessstudio/Gewichte" không vừa một phần tư màn hình.

## Đã làm
| Việc | Cách làm | Nguồn / lý do |
|---|---|---|
| Gọn và vừa khung | Bỏ dòng hướng dẫn dài. Tab nhóm dùng nhãn ngắn (`categoryTabs`: Gym, Sonstige…) và tự co chữ. Phút và Bước chân đứng cạnh nhau, có nhãn ngắn phía trên. Hai ô Từ/Đến cũng đứng cạnh nhau. Chip, nút và nhãn đều một dòng, tự co chữ. Phần thân cuộn trong khung khoảng 58% chiều cao màn hình. Nút **Huỷ \| Ghi** luôn cố định ở đáy. | [Nội bộ: [mobile-ui-density.md](../../.ai/skills/mobile-ui-density.md)] |
| Tự tính phút | Điền Từ và Đến → ô Phút tự tính, kể cả khi qua nửa đêm. Không bao giờ ghi đè số phút người dùng tự gõ. | [Mã: `withTimes` trong [activityDraft.ts](../../src/domain/energy/activityDraft.ts)] |
| Điền sẵn "như thường lệ" | Xét 4 tuần gần nhất, bỏ qua hôm nay. Tìm hoạt động hay làm trong khoảng ±2 giờ quanh khung giờ đó, có ở **ít nhất 2 ngày khác nhau**. Tuần gần hơn và cùng thứ trong tuần được tính nặng hơn. Điền môn, số phút (trung vị, làm tròn 5) và giờ bắt đầu/kết thúc thường gặp. Hiện một dòng 💡 kèm ✕ để bỏ. Gõ tay luôn thắng. | [1][3]; ngưỡng 💡 [Mã: [activityHabit.ts](../../src/domain/energy/activityHabit.ts)] |
| Giữ phần nhập dở | Mỗi lần sửa đều lưu trên máy. Chạm ra ngoài, nút Back của Android, hoặc mở Powerlifting đều **giữ lại** nội dung. Mở lại trong vòng **5 phút** thì tiếp tục đúng chỗ, kèm dòng "↺ Tiếp tục…". | [2]; [Mã: [activityDraftStore.ts](../../src/store/activityDraftStore.ts)] |
| Nút Huỷ | Xoá phần nhập dở và thoát ngay, không hỏi lại (theo yêu cầu của chủ dự án). | 💡 HIG gợi ý xác nhận trước khi đóng nếu có thể mất nội dung [2]. Ở đây chủ dự án chọn "Huỷ là thoát luôn", còn các kiểu thoát lỡ tay thì đã được giữ lại. |
| Làm mới sau 5 phút | Nội dung nhập dở cũ hơn 5 phút tính từ lần sửa cuối thì mở ra form mới, có điền sẵn nếu tìm được thói quen. | Yêu cầu của chủ dự án. 💡 Giúp người ít rành công nghệ không bị kẹt với nội dung cũ. |
| Riêng tư | Chỉ dùng lịch sử của chính người dùng, trên máy. Không dùng dữ liệu của người khác. | 💡 |

**Chưa làm / để sau 💡:**
- Điền sẵn cả số bước chân.
- Gợi ý theo "sau bữa sáng" (bối cảnh là một sự kiện, không phải giờ).
- Nhiều môn trong một lần ghi.

## Quyết định cần chủ dự án chốt
| Câu hỏi | Khuyến nghị 💡 |
|---|---|
| Ngưỡng thói quen: ±2 giờ, ≥ 2 ngày trong 4 tuần | Giữ, chỉnh sau khi có dữ liệu thật |
| Huỷ có cần hỏi lại khi đã nhập nhiều không? | Chưa cần; theo dõi xem có ai lỡ tay bấm Huỷ không |

## Tài liệu tham khảo
- [1] Jakob Nielsen, *The Power of Defaults*, Nielsen Norman Group, 25/09/2005. https://www.nngroup.com/articles/the-power-of-defaults/ — Dùng cho: người dùng giữ mặc định; chọn mặc định hữu ích; mặc định là hướng dẫn tại chỗ. Truy cập 26/09/2026.
- [2] Apple, *Human Interface Guidelines — Modality*. https://developer.apple.com/design/human-interface-guidelines/modality — Dùng cho: "Always give people an obvious way to dismiss a modal view"; tránh mất nội dung người dùng tạo khi đóng view. Đọc qua bản dữ liệu JSON của chính trang. Truy cập 26/09/2026.
- [3] P. Lally, C. H. M. van Jaarsveld, H. W. W. Potts, J. Wardle, *How are habits formed: Modelling habit formation in the real world*, European Journal of Social Psychology, 2010. https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674 — Dùng cho: 96 người làm một hành vi mỗi ngày trong cùng bối cảnh; mức tự động tăng theo đường cong; lỡ một lần không ảnh hưởng đáng kể; 18–254 ngày. Truy cập 26/09/2026 (**qua kết quả tìm kiếm**; trang Wiley trả lỗi 403).

## Lịch sử chỉnh sửa
| Ngày | Bản | Thay đổi |
|---|---|---|
| 26/09/2026 | 1 | Bản đầu, cùng lúc triển khai |

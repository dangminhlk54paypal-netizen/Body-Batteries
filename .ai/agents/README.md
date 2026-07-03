# 🤖 Agents — Hướng dẫn sử dụng

> 🔁 **Nâng cấp 2026-07-03:** bản đầy đủ của mỗi agent đã chuyển sang **`.claude/agents/`**
> (chuẩn Claude Code native — nguồn sự thật DUY NHẤT). Các file trong thư mục này chỉ còn là
> **con trỏ** sang bản native, để tránh hai bản trùng nhau bị lệch dần.

## Agent là gì?

Một **agent** là một "vai trò chuyên gia" mà AI nhập vào để làm tốt một loại việc. Trong
Claude Code, agent còn hơn thế: nó được **spawn thành phiên con riêng** — chạy song song được,
có bộ nhớ ngữ cảnh riêng (không làm phiên chính "quên"), và bị giới hạn công cụ đúng vai
(vd `qa-reviewer` không có quyền sửa file).

## Cách GỌI một agent (trong Claude Code)

Gõ tự nhiên bằng tiếng Việt:

```
Dùng agent mobile-frontend: làm màn hình Home với các viên pin.
```

Claude Code tự spawn agent tương ứng từ `.claude/agents/`. Muốn chạy nhiều việc độc lập
cùng lúc, cứ nói rõ — các agent chạy song song, mỗi cái một context.

> Dùng công cụ AI khác (không phải Claude Code)? Mở file trong `.claude/agents/` và dán nội
> dung làm vai — cách "nhập vai thủ công" cũ vẫn hoạt động.

## Danh sách agents hiện có

| Agent | Khi nào dùng | Quyền đặc biệt |
|-------|--------------|----------------|
| [`architect`](../../.claude/agents/architect.md) | Cấu trúc, quyết định kỹ thuật lớn, thiết kế trước tính năng lớn | có WebSearch để tra cứu |
| [`mobile-frontend`](../../.claude/agents/mobile-frontend.md) | Giao diện: màn hình, viên pin, biểu đồ, animation | — |
| [`logic-backend`](../../.claude/agents/logic-backend.md) | Logic năng lượng, lưu trữ, thông báo, tác vụ nền | — |
| [`data-ml`](../../.claude/agents/data-ml.md) | Phân tích & dự báo (Phase 5, làm sau cùng) | — |
| [`qa-reviewer`](../../.claude/agents/qa-reviewer.md) | Soát lỗi, review chất lượng, checklist test | **read-only** — không sửa được file |

## Cách TẠO agent mới

1. Copy một file trong `.claude/agents/` làm mẫu (giữ khung frontmatter `name/description/tools`).
2. `description` viết **tiếng Anh** (Claude Code dùng nó để tự chọn agent); thân file tiếng Việt.
3. Giới hạn `tools` đúng vai (vai chỉ-đọc thì bỏ Edit/Write).
4. Thêm 1 file con trỏ trong `.ai/agents/` + thêm dòng vào bảng trên.
5. **Khởi động lại Claude Code** để agent mới được nạp.

> Mọi agent tuân luật chung `.ai/CONTEXT.md` (nói tiếng Việt, code tiếng Anh, ranh giới sức khoẻ).

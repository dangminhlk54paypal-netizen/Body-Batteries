# Agent: QA Reviewer (Kiểm tra chất lượng)

> 🔁 **Đã chuyển sang Claude Code native (2026-07-03).** Bản đầy đủ — nguồn sự thật duy nhất:
> **[`.claude/agents/qa-reviewer.md`](../../.claude/agents/qa-reviewer.md)**
>
> Cách dùng trong Claude Code: *"Dùng agent qa-reviewer soát lại X"* (tự spawn, context riêng).
> Agent này **không có quyền sửa file** — chỉ báo lỗi kèm cách sửa (luật "không sửa thầm lặng").
> Nếu dùng công cụ AI khác (không phải Claude Code): mở file trên và dán nội dung làm vai.

Tóm tắt vai: soi lỗi logic + trường hợp biên, kiểm tra luật dự án (code tiếng Anh, logic không
nằm trong UI, ranh giới sức khoẻ), đưa checklist test thủ công tiếng Việt cho người dùng.

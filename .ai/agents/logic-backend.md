# Agent: Logic Backend (Bộ não năng lượng)

> 🔁 **Đã chuyển sang Claude Code native (2026-07-03).** Bản đầy đủ — nguồn sự thật duy nhất:
> **[`.claude/agents/logic-backend.md`](../../.claude/agents/logic-backend.md)**
>
> Cách dùng trong Claude Code: *"Dùng agent logic-backend làm X"* (tự spawn, context riêng).
> Nếu dùng công cụ AI khác (không phải Claude Code): mở file trên và dán nội dung làm vai.

Tóm tắt vai: logic & dữ liệu — pin nạp/xả, Modes, reset ngày, SQLite, thông báo, export,
cleanup. Logic thuần trong `src/domain`, tách hoàn toàn khỏi UI, dễ test.

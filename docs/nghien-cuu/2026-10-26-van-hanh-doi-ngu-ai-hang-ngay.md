# Vận hành "đội ngũ dev AI" hằng ngày — 2 phiên × 3 giờ trên Claude

| Mục | Nội dung |
|---|---|
| Ngày | 2026-10-26 |
| Phạm vi | Cách tổ chức Claude Code thành một đội dev chạy đều mỗi ngày (2 phiên × 3 giờ) để nâng cấp, chạy app, bảo hành và phát triển BodyBatteries |
| Nhánh khảo sát | `ui-upgrade` (sau commit `097168b`, cây làm việc đang có thay đổi chưa commit của tính năng Nạp bằng chữ/AI) |
| Mục tiêu | Biết cần chuẩn bị gì (một lần, mỗi ngày, mỗi tuần), chạy ở đâu (máy Mac hay đám mây), ai làm vai gì, và chỗ nào chủ dự án vẫn phải có mặt |

## Chú giải

| Ký hiệu | Nghĩa |
|---|---|
| `[n]` | Trích từ nguồn web số *n* trong mục Tài liệu tham khảo |
| `[Mã: link-file]` | Rút ra từ code/cấu hình của dự án |
| `[Nội bộ: link-file]` | Rút ra từ tài liệu nội bộ |
| 💡 | Nhận định/khuyến nghị của người viết, không phải trích dẫn |
| ❓ | Chưa kiểm chứng được |

Mọi nguồn được mở trong phiên ngày 2026-10-26.

## Tóm tắt

1. **Bộ khung đội ngũ đã có sẵn 70 %:** 6 agent theo vai trò, skill quy trình, hook kiểm lỗi, `npm run verify`, xuất bản EAS `preview` [Mã: [.claude/agents/](../../.claude/agents/)] [Mã: [.claude/settings.json](../../.claude/settings.json)]. Cái còn thiếu là **quy trình**, không phải công cụ: hàng việc (backlog) rõ ràng, mỗi việc một nhánh + PR, CI tự kiểm, và một "kịch bản phiên" cố định. 💡
2. **Hai phiên 3 giờ nên chạy trên máy Mac (VS Code / Desktop), không phải trên đám mây.** Phiên đám mây của Projects không nạp agent, skill, hook và quyền trong `.claude/` của repo [3]; Expo/EAS cũng cần cấu hình máy. Đám mây dùng cho việc **chạy không cần người**: kiểm tra ban đêm, review PR tự động [1][4]. 💡
3. **Gói dùng:** Pro và Max đều có giới hạn theo **phiên 5 giờ** và **giới hạn tuần**, dùng chung giữa Claude và Claude Code; Max có thêm giới hạn tuần riêng cho Fable [2]. Trang hỗ trợ **không** công bố giới hạn tính bằng giờ [2] — nên đo thực tế 1 tuần ở `claude.ai/settings/usage` [1] rồi mới chốt Max 5x hay 20x. ❓ 💡
4. **Nút thắt thật là chủ dự án:** chỉ bạn thử được trên iPhone và duyệt quyết định sản phẩm. Đội AI chạy 6 giờ/ngày vẫn cần bạn ~20–30 phút/ngày để thử bản preview và duyệt PR, nếu không việc sẽ dồn ứ. 💡
5. **Rủi ro số 1 là các phiên giẫm lên nhau** trên cùng một thư mục (đã xảy ra 4 lần) [Nội bộ: memory `parallel-subagent-file-conflicts`]. Cách chữa chuẩn: mỗi phiên/agent một **git worktree** riêng [5], chỉ gộp qua PR.

## Đính chính

Không có thông tin ngoài nào mâu thuẫn với điều đã nói trước đây. Ghi chú nội bộ: [`.ai/NEXT_SESSIONS.md`](../../.ai/NEXT_SESSIONS.md) vẫn ghi "Expo SDK 54" và "Sonnet 4.6" — đã cũ so với [`AGENTS.md`](../../AGENTS.md) (SDK 58). File này nên được thay bằng backlog mới (xem mục 5).

## 1. Hiện trạng: đã có gì, thiếu gì

| Thành phần của một đội dev | Đã có | Thiếu |
|---|---|---|
| Vai trò (người) | `architect`, `mobile-frontend`, `logic-backend`, `qa-reviewer`, `consumer-research`, `data-ml` [Mã: [.claude/agents/](../../.claude/agents/)] | Vai **điều phối/PM** (chia việc, ưu tiên) và **release manager** (gom bản, ghi changelog) — hiện do phiên chính kiêm 💡 |
| Luật làm việc | i18n, UI gọn, nghiên cứu có nguồn, EAS preview [Nội bộ: [AGENTS.md](../../AGENTS.md)] | — |
| Kiểm tra chất lượng | Hook lint sau mỗi lần sửa, nhắc `verify` khi dừng [Mã: [.claude/settings.json](../../.claude/settings.json)]; `npm run verify` = tsc + eslint + jest [Mã: [package.json](../../package.json)] | **CI trên GitHub** (repo chưa có thư mục `.github/`) → không có gì tự chặn code đỏ khi gộp 💡 |
| Hàng việc (backlog) | [`.ai/NEXT_SESSIONS.md`](../../.ai/NEXT_SESSIONS.md) (1.406 dòng), [`.ai/plans/`](../../.ai/plans/) | Một danh sách ngắn, có ưu tiên, đánh dấu được "đang làm / xong" — ví dụ GitHub Issues 💡 |
| Trí nhớ dự án | [`.ai/SESSION_LOG.md`](../../.ai/SESSION_LOG.md) (3.211 dòng), [`.ai/CONTEXT.md`](../../.ai/CONTEXT.md) (546 dòng) | Bản tóm tắt "trạng thái hiện tại" ≤ 1 trang; log dài làm mỗi phiên tốn token khi đọc lại 💡 |
| Cách ly giữa các phiên | Luật "không stash/reset, stage theo tên file" | Worktree riêng cho mỗi phiên; hiện tất cả dùng chung một thư mục [Nội bộ: memory] |
| Phát hành | EAS `preview` cho Expo Go [Nội bộ: [.ai/skills/eas-preview-publish.md](../../.ai/skills/eas-preview-publish.md)] | Nhịp phát hành cố định (vd. gom bản thứ Sáu) và kênh nhận phản hồi lỗi từ điện thoại 💡 |

## 2. Chạy ở đâu: 4 lựa chọn

| | Phiên tương tác trên Mac (VS Code/CLI) | Tác vụ hẹn giờ Desktop (máy Mac) | Tác vụ hẹn giờ đám mây | Projects (đám mây) |
|---|---|---|---|---|
| Cần bật máy | Có | Có — app mở, máy thức; ngủ thì lỡ lượt, khi thức chạy bù **1** lượt gần nhất [6] | Không [1] | Không [3] |
| Thấy file chưa commit | Có | Có (mặc định chạy trên thư mục hiện tại; có thể chọn Worktree) [6] | Không — clone mới mỗi lần [1] | Không |
| Agent/skill/hook của repo | Có đủ | Có (chạy như phiên thường trên máy) 💡 | Skill đã commit trong repo: có [1]; agent/hook: ❓ | `CLAUDE.md` có; skill, agent, hook, quyền trong `.claude/`: **không** [3] |
| Kích hoạt | Bạn mở | Lịch (tối thiểu 1 giờ qua form) [6] | Lịch ≥ 1 giờ, API, sự kiện GitHub [1] | Bạn giao việc trong hội thoại |
| Đẩy code | Tuỳ bạn | Commit/PR như phiên thường [6] | Nhánh `claude/…`, mang tên GitHub của bạn [1] | Mỗi thread một nhánh + PR [3] |

💡 **Khuyến nghị:** hai phiên 3 giờ chạy **trên Mac** (đủ agent, hook, Expo, EAS). Đám mây chỉ làm 2 việc không cần người: (a) kiểm tra ban đêm, (b) review PR khi mở. Projects hấp dẫn (giao việc từ điện thoại, nhiều thread song song [3]) nhưng hiện mất toàn bộ agent/hook của dự án [3] — để sau, khi luật dự án đã chuyển hết vào `CLAUDE.md`/`AGENTS.md`.

## 3. Mô hình đội ngũ (ai làm gì)

| Vai | Ai đảm nhận | Việc |
|---|---|---|
| Product owner | **Bạn** | Chọn ưu tiên tuần, thử bản preview trên iPhone, duyệt/gộp PR |
| Tech lead / điều phối | Phiên chính (Opus hoặc Fable) | Đọc backlog, lập kế hoạch, chia việc, kiểm diff sau mỗi đợt |
| Kiến trúc | `architect` | Thiết kế trước tính năng lớn, chọn thư viện |
| Dev giao diện | `mobile-frontend` (Sonnet) | Màn hình, component — kèm luật i18n + UI gọn |
| Dev logic/dữ liệu | `logic-backend` (Sonnet) | `src/domain`, `src/data`, `src/services` |
| QA | `qa-reviewer` + `npm run verify` + CI | Tìm lỗi, viết checklist thử máy tiếng Việt |
| Nghiên cứu người dùng | `consumer-research` | Trước tính năng lớn / sau đợt thử máy |
| Thư ký | Haiku | Session log, docs, commit — phải đối chiếu số liệu [Nội bộ: memory `orchestration-workflow`] |

💡 Lưu ý chi phí: Max có **giới hạn tuần riêng cho Fable** [2] — nếu tech lead chạy Fable cả 6 giờ/ngày, giới hạn này có thể chạm trước. Dùng Fable cho phần lập kế hoạch/review, Sonnet cho phần code.

## 4. Lịch một ngày (đề xuất)

💡 Hai phiên nên cách nhau **≥ 5 giờ** để mỗi phiên rơi vào một cửa sổ phiên 5 giờ riêng [2] — suy luận; trang hỗ trợ không nói rõ cửa sổ bắt đầu tính từ lúc nào ❓. Ví dụ: **08:00–11:00** và **14:00–17:00**.

### Phiên A — sáng: "Xây" (tính năng mới)

| Thời gian | Việc |
|---|---|
| 0:00–0:15 | Đọc `STATUS.md` + phản hồi thử máy hôm qua + kết quả kiểm tra đêm; chọn 1–2 việc từ đầu backlog |
| 0:15–0:45 | Kế hoạch (plan mode) → **bạn duyệt** (5 phút) |
| 0:45–2:15 | Các agent làm theo đợt, mỗi agent một worktree [5]; tech lead kiểm diff giữa các đợt |
| 2:15–2:40 | `qa-reviewer` + `npm run verify` |
| 2:40–3:00 | Mở PR, publish EAS `preview`, gửi link + checklist thử máy |

### Phiên B — chiều: "Bảo hành & phát hành"

| Thời gian | Việc |
|---|---|
| 0:00–0:20 | Gom phản hồi thử máy của bạn → tạo issue lỗi |
| 0:20–1:50 | Sửa lỗi (ưu tiên lỗi P0/P1), xử lý nhận xét review trên PR |
| 1:50–2:30 | Nợ kỹ thuật nhỏ: test thiếu, dọn code, cập nhật docs |
| 2:30–3:00 | Gộp PR đã duyệt, cập nhật `STATUS.md` + session log, chọn việc cho sáng mai |

### Ngoài giờ (không cần người)

- **Đêm, mỗi ngày — tác vụ đám mây:** clone `main`, `npm ci`, `npm run verify`, `npx expo-doctor`; nếu đỏ thì mở issue. Tác vụ đám mây chạy được kể cả khi máy tắt [1], nhưng mạng mặc định chỉ cho các domain trong danh sách cho phép [1] — cần kiểm tra npm registry có trong đó không ❓.
- **Khi mở PR — trigger GitHub `pull_request.opened`:** review theo checklist dự án (i18n, UI gọn, không logic trong UI) [1]. Cần cài Claude GitHub App vào repo [1].
- **Mỗi tuần (thứ Hai):** `npm outdated`, `npm audit`, rà backlog, báo cáo tuần.

## 5. Cần chuẩn bị gì

### Một lần (tuần 0) — ~2 phiên

1. **Dọn nền:** commit xong việc đang dở trên `ui-upgrade`, gộp vào `main`; từ đó **mỗi việc một nhánh + PR**, không ai sửa thẳng `main`. 💡
2. **Bật bảo vệ nhánh `main` trên GitHub** (bắt buộc CI xanh trước khi gộp). Tác vụ đám mây chịu luật bảo vệ nhánh của quyền GitHub bạn đã cấp [1]. 💡
3. **CI:** thêm `.github/workflows/verify.yml` chạy `npm ci && npm run verify` trên mỗi PR. 💡
4. **Backlog:** chuyển phần còn sống của `NEXT_SESSIONS.md` sang **GitHub Issues** với nhãn `bug`/`feature`/`chore`, `P0`–`P2`, `area:ui|logic|data`; mỗi tuần một milestone. Bạn tạo issue được ngay từ app GitHub trên điện thoại khi thử máy. 💡
5. **Rút gọn trí nhớ:** tạo `.ai/STATUS.md` ≤ 1 trang (đang làm gì, việc tiếp theo, lỗi đã biết); chuyển `SESSION_LOG.md` cũ vào `.ai/archive/`. 💡
6. **Kịch bản phiên:** viết `.ai/skills/daily-session.md` (mở phiên → chọn việc → kế hoạch → làm → QA → PR → preview → đóng phiên) để mỗi phiên chạy giống nhau. 💡
7. **Worktree:** mỗi phiên/agent chạy trong worktree riêng (`claude --worktree <tên>`) [5]; khai báo file bị gitignore cần chép sang (vd. `.env`) bằng `.worktreeinclude` [5]. Mỗi worktree cần `npm ci` riêng (thư mục `node_modules`). 💡
8. **Tạo 2 tác vụ tự động:** kiểm tra đêm (đám mây) và review PR (trigger GitHub) — tạo bằng `/schedule` hoặc tại `claude.ai/code/routines` [1].
9. **Gói & ngân sách:** chạy thử 1 tuần, xem `claude.ai/settings/usage` [1]; nếu chạm giới hạn thường xuyên thì nâng gói [2]. Chỉ bật "usage credits" (trả thêm khi vượt) nếu chấp nhận chi phí phát sinh [2]. 💡

### Mỗi ngày — phần của bạn (~20–30 phút) 💡

- Sáng: duyệt kế hoạch phiên A (5 phút).
- Chiều/tối: mở link preview trên Expo Go, đi theo checklist, ghi lỗi thành issue (15 phút).
- Cuối ngày: bấm gộp các PR đã xanh và đã thử (5 phút).

### Mỗi tuần 💡

- Thứ Hai: chọn 3–5 việc ưu tiên cho milestone tuần.
- Thứ Sáu: một bản "release" gom các PR đã gộp, ghi changelog, publish preview tổng.

## 6. Luật an toàn cho đội AI 💡

| Việc | Đội AI tự làm | Cần bạn duyệt |
|---|---|---|
| Sửa code trên nhánh riêng, mở PR, publish EAS `preview` | ✅ | |
| Gộp vào `main` | | ✅ |
| Thêm thư viện, nâng Expo SDK, sửa `app.json`/`eas.json`/`package.json` | | ✅ |
| Publish EAS nhánh khác `preview`, nộp App Store/Play | | ✅ |
| `git stash`, `reset`, `push --force`, `add -A` trên cây dùng chung | ❌ cấm | |

Lưu ý: lời nhắc của tác vụ hẹn giờ **không được coi là sự đồng ý** cho các hành động trong lúc chạy [1] — nên các bước cần duyệt ở trên vẫn dừng lại chờ bạn.

## 7. Các quyết định cần chủ dự án chốt

| # | Quyết định | Khuyến nghị 💡 |
|---|---|---|
| 1 | Giờ hai phiên | 08:00–11:00 và 14:00–17:00 (cách ≥ 5 giờ) |
| 2 | Phiên chạy tay hay hẹn giờ Desktop | Tuần đầu chạy tay để chỉnh kịch bản; sau đó hẹn giờ Desktop với Worktree [6] |
| 3 | Backlog ở đâu | GitHub Issues (tạo được từ điện thoại) |
| 4 | Model tech lead | Fable lập kế hoạch/review, Sonnet viết code, Haiku ghi chép |
| 5 | Bật trả thêm khi vượt giới hạn | Không, cho tới khi có số đo 1 tuần |

## Tài liệu tham khảo

**Claude Code (Anthropic)**
- [1] *Automate work with scheduled tasks* — https://code.claude.com/docs/en/routines — Dùng cho: chạy trên đám mây khi máy tắt, trigger lịch/API/GitHub, lịch tối thiểu 1 giờ, clone mới, nhánh `claude/`, mang tên GitHub của bạn, mạng mặc định theo danh sách cho phép, skill đã commit được nạp, cần Claude GitHub App, tính vào giới hạn gói, xem usage tại `claude.ai/settings/usage`, lời nhắc không phải sự đồng ý. Truy cập 2026-10-26.
- [3] *Let Claude coordinate ongoing work with Projects* — https://code.claude.com/docs/en/claude-projects.md — Dùng cho: thread song song trên đám mây, điều khiển từ điện thoại, mỗi thread một nhánh + PR, chỉ nạp `CLAUDE.md` chứ không nạp skill/agent/hook/quyền trong `.claude/`, dùng chung giới hạn gói. Truy cập 2026-10-26.
- [4] *Run prompts on a schedule* (bảng so sánh Cloud / Desktop / `/loop`) — https://code.claude.com/docs/en/scheduled-tasks.md — Dùng cho: so sánh ba cách hẹn giờ, `/loop` hết hạn sau 7 ngày. Truy cập 2026-10-26.
- [5] *Common workflows* — mục "Run parallel sessions with worktrees" — https://code.claude.com/docs/en/common-workflows.md — Dùng cho: `claude --worktree <tên>`, `.worktreeinclude`. Truy cập 2026-10-26.
- [6] *Schedule recurring tasks in Claude Code Desktop* — https://code.claude.com/docs/en/desktop-scheduled-tasks.md — Dùng cho: tác vụ chạy trên máy khi app mở và máy thức, chạy bù 1 lượt, tuỳ chọn Worktree, chế độ quyền theo từng tác vụ, có thể commit/mở PR. Truy cập 2026-10-26.

**Claude Help Center**
- [2] *Using Claude Code with your Pro or Max plan* — https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan — Dùng cho: giới hạn phiên 5 giờ + giới hạn tuần, dùng chung Claude và Claude Code, giới hạn tuần riêng cho Fable trên Max, usage credits, không công bố giới hạn theo giờ. Truy cập 2026-10-26.

## Lịch sử chỉnh sửa

| Ngày | Bản | Thay đổi |
|---|---|---|
| 2026-10-26 | 1 | Bản đầu: hiện trạng, 4 nơi chạy, mô hình vai trò, lịch ngày, checklist chuẩn bị, luật an toàn |

---
name: cloud-session
description: Use at the start of, and throughout, any Claude Code cloud session on BodyBatteries (claude.ai/code, Claude app, no Mac). How to start from the current app instead of old code, work directly like the IDE, and get a preview build to the owner's iPhone.
---

# Làm việc qua phiên cloud (không có Mac)

Chủ app giao việc qua điện thoại/trình duyệt và **muốn vào việc ngay như trong IDE**: không hỏi lại những gì repo đã trả lời,
xong việc thì có link thử trên iPhone. Hook `.ai/scripts/cloud-session-start.sh` đã chạy `npm ci` và nạp `.ai/CLOUD_MEMORY.md`.

## 1. Trước khi đọc hay sửa code — đứng đúng gốc
Code hiện hành là **`ui-upgrade`**, không phải `main` (`main` dừng ở 18/06/2026: SDK 54, chưa đa ngôn ngữ).
```bash
git fetch origin ui-upgrade && git merge-base --is-ancestor origin/ui-upgrade HEAD && echo OK
```
Không in `OK` và nhánh chưa có commit riêng → `git reset --hard origin/ui-upgrade`.
Có commit riêng → `git rebase origin/ui-upgrade`. Hai nhánh tách từ `main` năm 2026-11-01 từng phải viết lại vì bước này.

## 2. Trong lúc làm
Giữ nguyên mọi luật trong `AGENTS.md` (i18n 3 thứ tiếng, UI gọn, nghiên cứu có nguồn) và quy trình trong `.ai/skills/`.
Đọc `.ai/CONTEXT.md` và mục gần nhất của `.ai/SESSION_LOG.md` nếu việc nối tiếp việc cũ.
- Đổi pin / nhật ký: đi qua action của `energyStore` (có sẵn bản `...ForPastDate`), **không** tự cộng trừ `battery_readings`.
- Không có điện thoại trong phiên: chỉ `npm run verify` là chưa đủ để nói "đã chạy tốt" — ghi rõ "chưa test máy".
- Việc cần chủ app quyết thì hỏi; việc còn lại tự chốt theo code hiện có và nói lại một dòng.

## 3. Khi xong: đưa bản thử lên iPhone
Không chạy `eas-cli` (máy ảo không có token, mạng không vào expo.dev). Sau khi `npm run verify` xanh:
```bash
git fetch origin ui-upgrade && git rebase origin/ui-upgrade
npm run verify                     # lại lần nữa nếu rebase kéo code mới về
git push -u origin HEAD            # nhánh của phiên
git push origin HEAD:ui-upgrade    # đưa vào code chung, như commit trong IDE
```
Chỉ fast-forward: bị từ chối thì rebase lại, **không** `--force`. Không đụng `main`.
Push kích hoạt `.github/workflows/eas-preview.yml` (verify → `eas update --branch preview`). Chờ và lấy link bằng REST
(`gh pr`, `gh issue` dùng GraphQL nên bị proxy chặn):
```bash
SHA=$(git rev-parse HEAD); REPO=dangminhlk54paypal-netizen/Body-Batteries
gh api "repos/$REPO/actions/runs?head_sha=$SHA" --jq '.workflow_runs[] | [.status,.conclusion,.html_url] | @tsv'
gh api "repos/$REPO/commits/$SHA/comments" --jq '.[].body'
```
Gửi chủ app link + checklist theo Bước 3 của `.ai/skills/eas-preview-publish.md`, rồi ghi `docs/KIEM-TRA-TREN-MAY.md` và
`.ai/skills/session-wrapup.md` như thường lệ (đừng quên push các file đó).

Workflow đỏ ở `Check EXPO_TOKEN` → repo chưa có secret: báo chủ app thêm `EXPO_TOKEN`, không tự xoay token.
Cần native module không có trong Expo Go → nói rõ cần dev build, EAS Update không chở được.

## 4. Ghi nhớ
`~/.claude` của máy ảo mất khi phiên hết. Điều đáng nhớ cho phiên sau → sửa `.ai/CLOUD_MEMORY.md` và commit.
Repo **public**: không ghi token, số đo cơ thể hay nhật ký cá nhân vào đó.

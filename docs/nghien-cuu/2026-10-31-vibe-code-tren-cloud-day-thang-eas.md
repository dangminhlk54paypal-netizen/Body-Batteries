# Vibe code trên Claude cloud, tự đẩy bản EAS để thử trên iPhone

| Mục | Nội dung |
|---|---|
| Ngày | 2026-10-31 |
| Phạm vi | 1 tuần tới: code qua phiên **cloud** của Claude Code (claude.ai/code, app Claude trên điện thoại), mỗi lần xong thì tự có bản mới trên EAS Update nhánh `preview` → mở bằng Expo Go, không cần MacBook |
| Hiện trạng | Đang publish từ Mac bằng `npx eas-cli update --branch preview --environment preview` [Nội bộ: [eas-preview-publish](../../.ai/skills/eas-preview-publish.md)]; repo GitHub **public** [Mã: `gh repo view`]; chưa có `.github/` hay `.eas/` |

Ký hiệu: `[n]` nguồn web · `[Mã: …]` code · `[Nội bộ: …]` tài liệu dự án · 💡 nhận định · ❓ chưa kiểm chứng. Mọi nguồn mở ngày 2026-10-31.

## Tóm tắt

1. **Làm được.** Phiên cloud chạy trên máy ảo của Anthropic, clone repo từ GitHub và **push nhánh** lên GitHub [1]. Chỉ cần một cầu nối "push → `eas update`".
2. **Cách nên dùng (A): GitHub Actions.** Phiên cloud push nhánh → workflow chạy `npm ci`, `npm run verify`, `eas update --branch preview` với `EXPO_TOKEN` cất trong GitHub Secrets [3][4]. Repo public nên runner chuẩn của GitHub **miễn phí** [6]. Token không bao giờ vào máy ảo của Claude. 💡
3. **Cách nhanh hơn nhưng kém an toàn (B): chạy `eas update` ngay trong phiên cloud.** Cần (a) mạng **Custom** thêm tên miền Expo — danh sách mặc định "Trusted" có npm nhưng **không có** Expo [2]; (b) `EXPO_TOKEN` làm biến môi trường — biến này đọc được bởi mọi lệnh trong phiên [2]. Tên miền upload asset chính xác của EAS ❓ — phải thử ở phiên đầu.
4. **Không nên dùng EAS Workflows** (CI của Expo) ở gói Free: chỉ 60 phút CI/tháng, hàng đợi ưu tiên thấp, có thể chờ 90+ phút giờ cao điểm [5].
5. **Bẫy lớn nhất:** cloud chỉ thấy những gì **đã push**. Hiện nhánh `ui-upgrade` đang *ahead 2* commit và có việc dở chưa commit (Walk tracker, Stopwatch, `expo-sensors`) [Mã: `git status`] — phải commit + push trước khi rời Mac, nếu không bản cloud đầu tiên sẽ **xoá** các tính năng đó khỏi `preview`.

## Cách A — GitHub Actions (khuyến nghị)

Việc một lần (làm được trên trình duyệt điện thoại):
1. Tạo token tại expo.dev → Access tokens; nên bật **Limit access** chỉ tài khoản `bodybuilder007` [3].
2. GitHub repo → Settings → Secrets → Actions → `EXPO_TOKEN` [4].
3. Cài Claude GitHub App cho repo (để phiên cloud clone/push) [1].
4. Thêm file `.github/workflows/eas-preview.yml`: chạy khi push nhánh (không phải `main`), `expo/expo-github-action@v8` với `token: ${{ secrets.EXPO_TOKEN }}` [7], rồi `npm ci` → `npm run verify` → `npm run gen:food` → `eas update --branch preview --environment preview --non-interactive`.

**Đã làm (2026-10-31):** [`.github/workflows/eas-preview.yml`](../../.github/workflows/eas-preview.yml) — push mọi nhánh trừ `main`; link update được ghi vào commit comment để phiên cloud đọc lại bằng `gh api` (REST đi qua proxy GitHub; GraphQL bị chặn) [2].

Mỗi lần dùng: nói với phiên cloud "xong thì commit + push". ~vài phút sau mở Expo Go → Body Batteries → nhánh `preview`. 💡 Thời gian chạy CI cụ thể ❓ (chưa đo).

## Cách B — publish thẳng từ phiên cloud

- Môi trường cloud → Network access **Custom**, giữ "default list", thêm `*.expo.dev` (+ host upload asset ❓) [2].
- Biến môi trường `EXPO_TOKEN=…`; script cài đặt chạy trước khi biến được set, nên đừng gọi eas trong setup script [2].
- "Network secret" (proxy gắn khoá, máy ảo không thấy) [2] **chưa chắc** dùng được: eas-cli cần thấy `EXPO_TOKEN` để coi là đã đăng nhập [3] ❓.
- Rủi ro: token đọc được trong phiên → sau 1 tuần **xoá token** ở expo.dev [3].

## Giới hạn chung

- EAS Update chỉ chở JS: thêm native module không có trong Expo Go thì vẫn cần dev build [Nội bộ: [eas-preview-publish](../../.ai/skills/eas-preview-publish.md)].
- Free plan EAS Update: 1.000 người dùng/tháng, update không giới hạn — đủ cho 1 người thử [5].
- Phiên cloud dùng chung hạn mức với Claude/Claude Code [1].

## Đính chính

- Báo cáo [Vận hành đội ngũ AI](2026-10-26-van-hanh-doi-ngu-ai-hang-ngay.md) ghi phiên cloud "không nạp agent/hook của repo" — điều đó đúng với **Projects**; phiên cloud thường (một repo, ngoài Projects) có nạp `.claude/agents/` và đọc `.claude/settings.json` của repo [1].

## Tài liệu tham khảo

1. https://code.claude.com/docs/en/claude-code-on-the-web — truy cập 2026-10-31
2. https://code.claude.com/docs/en/cloud-environments — truy cập 2026-10-31
3. https://docs.expo.dev/accounts/programmatic-access/ — truy cập 2026-10-31
4. https://docs.expo.dev/eas-update/github-actions/ — truy cập 2026-10-31
5. https://expo.dev/pricing — truy cập 2026-10-31
6. https://docs.github.com/en/billing/concepts/product-billing/github-actions — truy cập 2026-10-31
7. https://github.com/expo/expo-github-action — truy cập 2026-10-31

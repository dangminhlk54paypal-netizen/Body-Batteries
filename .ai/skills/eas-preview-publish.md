# Skill: eas-preview-publish (Đẩy bản test lên EAS cloud để thử trên điện thoại)

> ⏳ **TẠM THỜI — chỉ áp dụng khi team phát triển có MỘT người** (chủ dự án, từ 2026-09-24).
> Khi có thêm người vào team: **dừng dùng skill này nguyên trạng** và xem mục
> "Khi team có thêm người" ở cuối file trước khi publish bất cứ thứ gì.

## Mục đích
Sau khi sửa code xong, đẩy bản JS mới lên **EAS Update** (nhánh `preview`) để người dùng mở
thẳng trên iPhone qua Expo Go — không cần Mac bật `npm start`, không cần cùng Wi-Fi.
Hạ tầng đã có sẵn từ Session 28: `app.json` → `updates.url` + `runtimeVersion.policy: sdkVersion`,
`eas.json` có channel `preview`, CLI đã đăng nhập tài khoản `bodybuilder007`.

## Khi nào chạy (tự động, không cần hỏi)
Chạy ở **cuối mọi lượt sửa có thay đổi người dùng nhìn/chạm thấy được trên app**, sau khi:
1. Tính năng/sửa lỗi đã xong, và
2. `npm run verify` **xanh toàn bộ** (tsc + eslint + jest).

Người dùng đã cho phép sẵn việc này cho nhánh **`preview`** — không cần hỏi lại từng lần.

**KHÔNG chạy** khi:
- `npm run verify` còn đỏ → sửa trước, hoặc báo người dùng và hỏi có muốn đẩy bản lỗi để xem thử không.
- Chỉ sửa docs/test/tooling, không đổi gì chạy trên máy → bỏ qua, ghi rõ "không cần EAS update".
- Thay đổi cần **native module mới** (vd. thêm package có code native, sửa plugin trong
  `app.json`, HealthKit) → EAS Update chỉ chở JS, Expo Go sẽ không có module đó. Báo người dùng
  cần `eas build --profile development` thay vì update.

**Luôn hỏi trước** khi muốn đẩy lên nhánh khác `preview` (`main`, `production`…).

---

## Các bước

### Bước 1 — Kiểm tra working tree có "sạch về phạm vi" không
`eas update` đóng gói **đúng những gì đang nằm trên đĩa**, kể cả file chưa commit. Nếu working
tree đang lẫn sửa dở của phiên/agent khác (xem memory `parallel-subagent-file-conflicts`), chạy
thẳng sẽ đẩy cả code chưa xong lên điện thoại.

```bash
git status --short
```

- Mọi file thay đổi đều thuộc việc vừa làm → sang Bước 2, publish tại chỗ.
- Có file lạ không thuộc việc này: **trước hết hỏi các phiên đang chạy** (`ListAgents` rồi `SendMessage`: "phần của
  bạn có ổn định để đẩy lên máy không?"). Nếu họ trả lời "ok publish" và `npm run verify` xanh → publish thẳng từ
  working tree, để điện thoại nhận việc của mọi phiên (Session 70, 2026-10-23). Bản cô lập từ HEAD sẽ **xoá** khỏi
  `preview` mọi tính năng chưa commit của phiên khác.
- Chỉ khi phiên khác đang dở và không chờ được → publish từ **bản cô lập**: dựng thư mục tạm bằng
  `git archive HEAD` rồi áp lại đúng các file/hunk của việc này, `npm install`, chạy
  `npm run verify` trong đó, rồi publish với `EAS_NO_VCS=1` (cách đã làm ở Session 30).
  **Tuyệt đối không** `git stash` / `git reset` / `git add -A` trên working tree chung.

### Bước 2 — Publish
```bash
npm run gen:food   # đảm bảo foodDatabase.generated.ts khớp food_items.csv
npx eas-cli update --branch preview --environment preview --non-interactive \
  --message "<mô tả ngắn thay đổi, tiếng Việt không dấu cũng được>"
```

Ghi chú:
- Không có `eas` cài toàn cục — luôn dùng `npx eas-cli` (đã được allow trong `.claude/settings.json`).
- Từ SDK 55 trở lên **bắt buộc** có `--environment`, thiếu là lỗi ngay.
- Lỗi đăng nhập → báo người dùng chạy `npx eas-cli login` (cần mật khẩu, AI không tự làm).

### Từ phiên cloud (claude.ai/code, app Claude) — thay cho Bước 1–2
Máy ảo cloud không có `EXPO_TOKEN` và không vào được expo.dev → **không chạy `eas-cli`**. Thay vào đó:
1. `npm run verify` xanh → commit → `git push` nhánh hiện tại (khác `main`).
2. [`.github/workflows/eas-preview.yml`](../../.github/workflows/eas-preview.yml) tự chạy verify + `eas update --branch preview`
   (token ở GitHub Secrets). Chờ bằng `gh api repos/{owner}/{repo}/actions/runs?head_sha=<sha>` (REST; `gh run`/`gh pr`
   dùng GraphQL bị proxy chặn).
3. Link nằm trong commit comment: `gh api repos/{owner}/{repo}/commits/<sha>/comments` → sang Bước 3.
Push từ Mac cũng kích hoạt workflow này — đừng publish tay thêm lần nữa. Nghiên cứu:
[docs/nghien-cuu/2026-10-31-vibe-code-tren-cloud-day-thang-eas.md](../../docs/nghien-cuu/2026-10-31-vibe-code-tren-cloud-day-thang-eas.md).

### Bước 3 — Gửi link cho người dùng
Từ output của lệnh, lấy **update group ID** và gửi:

```
📱 Đã đẩy bản mới lên EAS (nhánh preview).
Mở trên iPhone (Safari → mở bằng Expo Go): https://u.expo.dev/update/<group-id>
Hoặc: Expo Go → Projects → Body Batteries → nhánh preview.

Cần thử:
1. <bước kiểm tra cụ thể 1>
2. <bước kiểm tra cụ thể 2>
```

Checklist thử phải cụ thể theo đúng việc vừa sửa (màn hình nào, bấm gì, kỳ vọng thấy gì), gồm
cả bước đổi ngôn ngữ VI/EN/DE nếu có chữ mới trên UI.

### Bước 3b — Ghi checklist vào `docs/KIEM-TRA-TREN-MAY.md`
Chủ app không phải lúc nào cũng cầm máy thử ngay (2026-10-23: "ghi hết nội dung cần kiểm tra lại vào đâu đó"). Mỗi lần
publish: cập nhật bảng "Bản `preview` mới nhất" và thêm một mục `## Session N — …` với các ô `- [ ]` cụ thể (mở ở đâu,
gõ/bấm gì, kỳ vọng thấy gì). Không xoá mục của session khác; mục chủ app đã đánh `[x]` thì giữ nguyên.

### Bước 4 — Ghi lại
Trong mục session của `.ai/SESSION_LOG.md` (lúc chạy `session-wrapup`), ghi 1 dòng:
nhánh, update group ID, bản publish từ working tree hay bản cô lập, và **"chưa có xác nhận test
máy thật"** cho đến khi người dùng báo lại. Không đánh dấu "Test thật ✅" chỉ vì đã publish.

---

## Khi team có thêm người (việc phải làm trước khi publish tiếp)
Skill này dựa trên giả định "một người, một điện thoại, một nhánh `preview`". Khi có người thứ hai:
- Nhánh `preview` dùng chung sẽ bị các bản của nhiều người ghi đè lẫn nhau → chuyển sang nhánh
  theo người/tính năng (vd. `preview-<ten>` hoặc theo git branch) hoặc preview theo PR.
- Bỏ quyền "tự động không cần hỏi": ai publish gì cần được thống nhất trong team.
- Cân nhắc publish từ CI (EAS Workflows / GitHub Actions) thay vì từ máy cá nhân.
- Cập nhật hoặc xoá skill này, và xoá mục tương ứng trong `AGENTS.md`.

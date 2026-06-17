#!/bin/bash
# Cài đặt git hooks nhắc nhở chạy session-wrapup
# Chạy 1 lần: bash .ai/scripts/install-hooks.sh

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "❌ Không tìm thấy git repo. Hãy chạy lệnh này từ trong thư mục dự án."
  exit 1
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"

# --- post-commit hook ---
cat > "$HOOKS_DIR/post-commit" << 'EOF'
#!/bin/bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Commit thành công!"
echo ""
echo "  💡 Nhớ ghi chép session khi xong việc:"
echo "     Gõ trong Claude: Chạy skill session-wrapup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
EOF
chmod +x "$HOOKS_DIR/post-commit"
echo "✅ Đã cài post-commit hook"

# --- post-merge hook (sau git pull / merge) ---
cat > "$HOOKS_DIR/post-merge" << 'EOF'
#!/bin/bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔀 Merge/Pull thành công!"
echo ""
echo "  💡 Có thay đổi mới — cập nhật tài liệu:"
echo "     Gõ trong Claude: Chạy skill session-wrapup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
EOF
chmod +x "$HOOKS_DIR/post-merge"
echo "✅ Đã cài post-merge hook"

# --- pre-push hook (nhắc trước khi push) ---
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Chuẩn bị push code..."
echo ""
echo "  📝 Session log đã cập nhật chưa?"
echo "     Nếu chưa: Gõ Chạy skill session-wrapup"
echo "     Nếu rồi : Nhấn Enter để tiếp tục push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
# Không chặn push — chỉ nhắc nhở
exit 0
EOF
chmod +x "$HOOKS_DIR/pre-push"
echo "✅ Đã cài pre-push hook"

echo ""
echo "🎉 Xong! Git hooks đã được cài đặt tại: $HOOKS_DIR"
echo "   Từ giờ mỗi khi commit/push sẽ có nhắc nhở tự động."

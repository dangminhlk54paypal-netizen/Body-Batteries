#!/bin/bash
# SessionStart hook. Mac sessions exit at once; a Claude cloud session gets its
# dependencies installed and everything the IDE has that the clone lacks
# (stdout becomes session context). See .claude/skills/cloud-session/SKILL.md.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

hashes=node_modules/.cloud-install.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if npm ci --no-audit --no-fund >/tmp/cloud-npm-ci.log 2>&1; then
    sha256sum package.json package-lock.json > "$hashes"
  else
    echo "⚠️ npm ci failed — see /tmp/cloud-npm-ci.log"
  fi
fi

git fetch -q origin ui-upgrade 2>/dev/null
behind=$(git rev-list --count HEAD..origin/ui-upgrade 2>/dev/null || echo '?')
echo "☁️ Cloud session on branch $(git branch --show-current), $behind commit(s) behind origin/ui-upgrade."
if [ "$behind" != "0" ]; then
  echo "⚠️ Run the cloud-session skill's first step before touching code: this checkout is not on the current app."
fi
echo "Follow .claude/skills/cloud-session/SKILL.md. Project memory:"
cat .ai/CLOUD_MEMORY.md
exit 0

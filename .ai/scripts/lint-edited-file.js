#!/usr/bin/env node
// PostToolUse hook: lint ONLY the file Claude just edited (fast, deterministic).
// Reads the hook event JSON from stdin, extracts the touched file path.
// - Lint errors  -> exit 2 (feeds output back to Claude so it fixes them).
// - Lint warnings -> print, exit 0 (informational, non-blocking).
// - Non-TS / out-of-scope file -> silent exit 0.
const { execSync } = require('node:child_process');
const path = require('node:path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let filePath;
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path;
  } catch {
    process.exit(0); // malformed payload — never block the edit
  }
  if (!filePath) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = path.relative(root, filePath);
  // Only lint source TS/TSX we actually own; skip generated/build/vendor files.
  if (!/^src\/.*\.(ts|tsx)$/.test(rel) || rel.includes('.generated.')) {
    process.exit(0);
  }

  try {
    execSync(`npx eslint "${rel}"`, { cwd: root, stdio: 'pipe' });
    process.exit(0); // clean (or warnings-only, which eslint exits 0 for)
  } catch (err) {
    const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
    if (out) process.stderr.write(`ESLint found issues in ${rel}:\n${out}\n`);
    process.exit(2); // surface errors back to Claude
  }
});

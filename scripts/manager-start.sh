#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[manager] Earthly session start"
echo "[manager] repo: $ROOT_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "[manager] WARNING: working tree is not clean."
  echo "[manager] Commit/stash before changing branches or running merges."
fi

if ! git fetch origin; then
  echo ""
  echo "[manager] WARNING: failed to fetch origin (network/auth issue)."
  echo "[manager] Continuing with local repository state."
fi

echo ""
echo "[manager] Current branch: $(git branch --show-current)"
echo "[manager] origin/main: $(git rev-parse --short origin/main)"
echo "[manager] local HEAD:  $(git rev-parse --short HEAD)"

echo ""
echo "[manager] Recent commits:"
git log --oneline -n 5 --decorate

echo ""
echo "[manager] Agent handoff files:"
ls -1 docs/TEMP_AGENT_*_PROGRESS.md 2>/dev/null || echo "(none found)"

echo ""
echo "[manager] Suggested broadcast:"
cat <<'MSG'
Base snapshot is on origin/main.
Rebase your task branch now: git fetch origin && git rebase origin/main
Follow docs/AGENT_GUIDE.md and docs/PARALLEL_AGENT_PLAYBOOK.md.
Do not edit integrator-owned files: apps/web/src/App.tsx, apps/server/src/app.ts, apps/server/src/index.ts.
If out-of-scope conflict appears, stop and escalate with file list.
MSG

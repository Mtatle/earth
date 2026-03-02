#!/usr/bin/env bash
set -euo pipefail

AGENT_NAME="${1:-Agent}"
TASK_IDS="${2:-T-001}"

cat <<MSG
[$AGENT_NAME] Earthly v0.1 brief

1) Read AGENT.md for project contract and quality bar.
2) If AGENT.md is unavailable, use docs/AGENT_GUIDE.md.
3) Read TASKS.md and claim tasks: $TASK_IDS.
4) If TASKS.md is unavailable, use docs/TASKS_V0_1.md.
5) Work only in your claimed task scope.
6) Keep changes small and atomic; avoid broad refactors.
7) Do not edit integrator-owned files unless explicitly assigned:
   - apps/web/src/App.tsx
   - apps/server/src/app.ts
   - apps/server/src/index.ts
8) Rebase before start and before handoff:
   - git fetch origin && git rebase origin/main
9) If you detect concurrent edits in your target file, stop and escalate.
10) Before finishing, include:
   - what changed
   - files touched
   - what remains
   - blockers (if any)

Implementation rules:
- Use real public feeds only (no fake data in production paths).
- Preserve source attribution and timestamps in all layer work.
- Do not remove or weaken error/fallback handling.
- Keep premium UX standards (legible, polished, intentional).
MSG

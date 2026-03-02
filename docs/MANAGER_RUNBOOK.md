# Earthly Manager Runbook

## Purpose
Use this runbook when resuming work with multiple parallel agents after a pause.

## Manager Responsibilities
1. Keep `main` as the single source of truth.
2. Ensure all agents rebase onto the same `origin/main` commit.
3. Enforce ownership boundaries from `docs/AGENT_GUIDE.md`.
4. Merge in controlled order with validation gates.

## Start-of-Session Checklist
1. Run manager helper:
```bash
./scripts/manager-start.sh
```
2. Review handoff files under `docs/` (`TEMP_AGENT_*_PROGRESS.md`).
3. Confirm current `origin/main` commit hash.
4. Broadcast resume instructions to all agents.

## Agent Resume Message (Copy/Paste)
"Base snapshot is on origin/main. Rebase your task branch now: `git fetch origin && git rebase origin/main`. Follow docs/AGENT_GUIDE.md and docs/PARALLEL_AGENT_PLAYBOOK.md. Do not edit integrator-owned files (`apps/web/src/App.tsx`, `apps/server/src/app.ts`, `apps/server/src/index.ts`). If out-of-scope conflict appears, stop and escalate with file list."

## Integration Order
1. Config + shared contracts.
2. Server adapters/routes.
3. Web features.
4. Integrator-only composition files last.

## Validation Gates
After each merge:
```bash
npm run typecheck
npm test
```
Before release candidate:
```bash
npm run test:e2e
npm run test:smoke
```

## Conflict Policy
1. If two branches touch the same ownership boundary, manager resolves.
2. Preserve both intents by moving logic into feature modules where possible.
3. Never force agents to resolve conflicts in integrator-owned files.

## Naming Convention For Handoffs
Keep using:
- `docs/TEMP_AGENT_A_T002_PROGRESS.md`
- `docs/TEMP_AGENT_B_T010_PROGRESS.md`
- `docs/TEMP_AGENT_C_T020_PROGRESS.md`
- `docs/TEMP_AGENT_D_T021_PROGRESS.md`

When task is finished, rename to `docs/HANDOFF_<agent>_<task>.md`.

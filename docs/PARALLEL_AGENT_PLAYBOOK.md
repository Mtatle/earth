# Earthly Parallel Agent Playbook

## Why this exists
Parallel agents are fast, but only if file ownership and integration order are explicit.

## Standard Operating Model
1. One task family per agent branch.
2. Rebase before start and before handoff.
3. Keep commits small and scoped.
4. Integrator merges in sequence and runs validations between merges.

## Branch Template
- `task/T-002-runtime-config`
- `task/T-010-stream-contract`
- `task/T-020-cesium-foundation`
- `task/T-021-layer-manager`

## File Ownership Guardrails
### Integrator-owned choke points
- `apps/web/src/App.tsx`
- `apps/server/src/app.ts`
- `apps/server/src/index.ts`

### Schema owner only
- `packages/shared/src/**`

### Agent-owned areas by task type
- UI tasks: `apps/web/src/features/**`, `apps/web/src/components/**`, `apps/web/src/styles/**`
- Server tasks: `apps/server/src/adapters/**`, `apps/server/src/routes/**`, `apps/server/src/domain/**`, `apps/server/src/config/**`

## Freeze Protocol
1. Stop all agents.
2. Each agent commits WIP and reports changed files.
3. Integrator creates merge plan and merge order.
4. Agents resume only after integrator issues new boundaries.

## Integration Order
1. Config and shared contracts first.
2. Backend adapters/routes second.
3. Frontend feature modules third.
4. Integrator updates choke-point composition files last.

## Validation Gate After Each Merge
```bash
npm run typecheck
npm test
```

Before release candidate:
```bash
npm run test:e2e
npm run test:smoke
```

## Copy/Paste Message To Resume Agents
"Resume with strict ownership mode. Do not edit integrator-owned files (`App.tsx`, `server app/index`). Rebase from latest main first. If you hit out-of-scope conflicts, stop and escalate with file list."

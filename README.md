# Earthly

Earthly is a browser-native geospatial operations platform that fuses public real-time data layers into a premium tactical interface.

## Monorepo Layout
- `apps/web` - React + Cesium frontend
- `apps/server` - Node adapter/stream service
- `packages/shared` - shared schemas and contracts
- `docs` - PRD and architecture docs
- `scripts` - local orchestration and agent helpers

## Local Setup
```bash
npm install
npm run dev
```

Web defaults to `http://localhost:5173` and server defaults to `http://localhost:4000`.

## Environment
Create a local env file from the template before running the server:

```bash
cp .env.example .env
```

Server env keys (from `.env.example`):
- `PORT`
- `STRICT_ADAPTER_KEYS`
- `OPENSKY_USERNAME`
- `OPENSKY_PASSWORD`
- `ADSBX_API_KEY`
- `ENABLE_LAYER_SATELLITES`
- `ENABLE_LAYER_FLIGHTS`
- `ENABLE_LAYER_EARTHQUAKES`

Strict mode note: with `STRICT_ADAPTER_KEYS=false` (default), flights run in demo mode and self-disable when credentials are missing; with `STRICT_ADAPTER_KEYS=true`, startup fails fast if `ENABLE_LAYER_FLIGHTS=true` and no flight credentials are provided.

## Workspace Commands
```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
```

## Testing and Troubleshooting
```bash
npm run doctor
npm run install:browsers
npm run test:e2e
npm run test:all
```

## Planning/Execution Docs
- `docs/AGENT_GUIDE.md` (tracked agent execution contract)
- `docs/TASKS_V0_1.md` (tracked parallel task board)
- `docs/PARALLEL_AGENT_PLAYBOOK.md`
- `docs/MANAGER_RUNBOOK.md`
- `docs/PRD-v0.1.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/TESTING_STACK.md`

Local-only mirrors:
- `AGENT.md` (ignored)
- `TASKS.md` (ignored)

## Manager Session Helper
```bash
./scripts/manager-start.sh
```

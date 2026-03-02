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
- `docs/PRD-v0.1.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/TESTING_STACK.md`

Local-only mirrors:
- `AGENT.md` (ignored)
- `TASKS.md` (ignored)

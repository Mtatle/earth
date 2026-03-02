# Earthly Project Structure (v0.1)

## Principles
1. Separate product surfaces (`apps`) from reusable logic (`packages`).
2. Keep docs close to execution (`docs`) and automation in `scripts`.
3. Design for parallel agent work with clear ownership boundaries.
4. Keep shared contracts in one place to avoid schema drift.

## Top-Level Layout
- `apps/`
  - `web/` -> React + Cesium interface
  - `server/` -> adapters, normalization, stream API
- `packages/`
  - `shared/` -> cross-app schema and type contracts
- `docs/`
  - product strategy, PRD, architecture notes
- `scripts/`
  - local orchestration, agent helper scripts
- `tsconfig.base.json` -> shared TS standards

## Ownership Boundaries
1. `apps/web`
- Owns rendering, controls, layer UX, entity inspection UI.
- Must not define source contracts independently.

2. `apps/server`
- Owns adapter integrations and source normalization.
- Must emit only shared schema types to clients.

3. `packages/shared`
- Owns canonical cross-service contracts.
- Any schema changes require web/server compatibility review.

## Recommended Internal Structure Per App
### `apps/server/src`
- `adapters/` source integrations
- `domain/` normalization and business rules
- `streams/` SSE/WS transport handlers
- `routes/` health and API endpoints
- `config/` env and feature flags
- `infra/` logging/retry/cache helpers

### `apps/web/src`
- `app/` shell layout and bootstrap
- `features/` layer manager, entity drawer, presets
- `components/` reusable UI building blocks
- `scene/` Cesium primitives, camera tools, LOD rules
- `state/` app store and selectors
- `styles/` tokens and global themes
- `lib/` API clients and utilities

## Naming and Convention Rules
1. Use `kebab-case` for folders and files except React components (`PascalCase.tsx`).
2. Keep each feature module small and self-contained.
3. Prefer `index.ts` export barrels at feature boundaries only.
4. Keep all source enums/schemas in `packages/shared`.

## Agent Parallelization Guidance
1. Agents should avoid touching `packages/shared` unless working on schema tasks.
2. UI and adapter agents can move in parallel after schema contract is stable.
3. Reserve one owner for integration and merge conflict resolution.
4. Use task IDs in commit messages (e.g., `T-021: layer toggles`).

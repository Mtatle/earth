# Earthly v0.1 Parallel Task List

Status legend: `todo`, `in_progress`, `blocked`, `done`

## Platform Setup

### T-001 Repo bootstrap
- Status: `done`
- Goal: Scaffold frontend + backend workspace with shared TypeScript config.
- Deliverables:
  - `apps/web` and `apps/server` (or equivalent structure)
  - package manager + scripts (`dev`, `build`, `test`, `lint`)
  - baseline README run instructions
- Acceptance:
  - `npm run dev` (or selected package manager) starts both services.
  - Typecheck passes on clean clone.
 - Notes:
  - Monorepo scaffold added with `apps/web`, `apps/server`, and `packages/shared`.
  - Root workspace scripts and shared TypeScript base config are in place.

### T-002 Environment and config contract
- Status: `done`
- Goal: Define env schema for all data adapters and feature flags.
- Deliverables:
  - `.env.example`
  - typed config loader with runtime validation
  - fail-fast startup messages for missing required keys
- Acceptance:
  - app boots in demo mode without secrets
  - adapters requiring keys self-disable with explicit UI notice
- Notes:
  - Added `apps/server/src/config/env.ts` with typed env parsing, boolean coercion, and runtime validation via `zod`.
  - Added strict-vs-demo handling for credentialed adapters (flights self-disable in demo mode with explicit notice).
  - Wired startup fail-fast messaging via `RuntimeConfigError` and covered behavior with server config/health tests.

## Data Layer Engine

### T-010 Unified entity schema + stream contract
- Status: `done`
- Goal: Implement normalized event/entity format shared by adapters and client.
- Deliverables:
  - server-side normalized schema types
  - SSE/WS payload contract
  - serializer and validation tests
- Acceptance:
  - all adapters emit normalized entities with source + timestamps
  - malformed payloads are rejected and logged
- Notes:
  - Hardened `EarthEntity` normalization schema with strict validation for coordinates, velocity fields, IDs, and timestamps.
  - Added canonical stream event contract (`bootstrap`, `heartbeat`, `entity_upsert`, `entity_snapshot`, `entity_delete`, `error`) with protocol versioning in `packages/shared`.
  - Implemented server stream serializer/validator utilities and wired `/api/stream/publish` to reject malformed events and log validation issues.
  - Added shared and server test coverage for schema parsing, SSE serialization format, and malformed payload rejection behavior.

### T-011 Satellite adapter
- Status: `todo`
- Goal: Integrate public satellite feed and stream live positions.
- Candidate sources: CelesTrak/NORAD catalogs.
- Deliverables:
  - adapter polling job
  - position propagation and entity updates
  - source metadata in payload
- Acceptance:
  - satellites render and refresh on cadence
  - stale data is flagged

### T-012 Flights adapter
- Status: `todo`
- Goal: Integrate live civil flight feed (OpenSky baseline).
- Deliverables:
  - adapter + normalization
  - altitude/speed/callsign mapping (if available)
  - rate-limit aware polling
- Acceptance:
  - flights appear globally and can be toggled
  - entity details show source and observed time

### T-013 Earthquakes adapter
- Status: `todo`
- Goal: Integrate USGS seismic feed.
- Deliverables:
  - adapter + normalization
  - magnitude/depth metadata mapping
  - freshness handling
- Acceptance:
  - quake events render at correct coordinates
  - metadata drawer includes magnitude + event time

## Frontend Experience

### T-020 Globe foundation
- Status: `done`
- Goal: Set up Cesium globe and camera control baseline.
- Deliverables:
  - base terrain/globe rendering
  - smooth zoom and camera transitions
  - camera state helper utilities
- Acceptance:
  - app opens with stable globe scene at target FPS in default mode
- Notes:
  - Added `CesiumGlobe` scene bootstrap with controlled init/teardown, 60 FPS target, and non-fatal loading/error/unsupported banners.
  - Implemented camera state helpers (`capture`, `sanitize`, `format`, `flyTo`) for future preset and tracking workflows.
  - Added camera preset controls for smooth fly-to transitions and updated web/e2e tests to cover the new globe baseline.

### T-021 Layer manager + toggles
- Status: `done`
- Goal: Build toggle system for data layers with health status.
- Deliverables:
  - side panel with toggle states
  - layer badges (`live`, `stale`, `error`, `off`)
  - per-layer counts
- Acceptance:
  - toggles instantly affect rendering
  - health state reflects backend stream status
- Notes:
  - Added web layer manager state with per-layer toggles and counts.
  - Wired SSE stream health (`/api/stream`) into layer badges and topbar stream indicator.
  - Added unit coverage for toggle behavior and stream-driven `live`/`stale`/`error` transitions.

### T-022 Entity interaction
- Status: `todo`
- Goal: Click/select entities and inspect details.
- Deliverables:
  - pick handling
  - details drawer
  - optional track/follow camera action
- Acceptance:
  - selected entity metadata is accurate and readable
  - no UI crashes on rapid selection changes

### T-023 Scene presets (shots)
- Status: `todo`
- Goal: Save/load camera + layer + style states.
- Deliverables:
  - create/update/delete preset UX
  - local persistence (v0.1)
  - quick load actions
- Acceptance:
  - saved preset restores state reliably
  - edge cases handled (missing layer, changed schema)

### T-024 Premium HUD styling
- Status: `todo`
- Goal: Ship a premium, legible tactical UI baseline.
- Deliverables:
  - tokenized design system variables
  - CRT/NVG/FLIR-inspired style presets
  - polished loading/empty/error states
- Acceptance:
  - UI is cohesive on desktop and mobile
  - text contrast and interaction clarity pass basic accessibility checks

## Reliability and Performance

### T-030 Render performance guardrails
- Status: `todo`
- Goal: Prevent browser overload under dense entity counts.
- Deliverables:
  - zoom-based density throttling
  - entity caps and LOD rules
  - frame-time instrumentation
- Acceptance:
  - no tab crashes in 20-minute stress run
  - FPS stays usable under normal loads

### T-031 Error handling and resilience
- Status: `todo`
- Goal: Handle adapter failures gracefully.
- Deliverables:
  - retry strategy with backoff
  - frontend error banners and fallback states
  - adapter-specific diagnostics
- Acceptance:
  - one adapter failure does not break others
  - user can see what failed and when

## Productization

### T-040 Source provenance panel
- Status: `todo`
- Goal: Make trust visible for every layer.
- Deliverables:
  - source list with links
  - refresh cadence + last success timestamp
  - terms/compliance notes placeholder
- Acceptance:
  - user can verify where each layer comes from
  - stale/unknown state is explicit

### T-041 Demo scenarios and smoke tests
- Status: `todo`
- Goal: Add 3 reusable scenario presets and smoke validation.
- Deliverables:
  - scenario JSON definitions (e.g., global overview, city zoom, orbit focus)
  - smoke script that checks stream and layer mount
- Acceptance:
  - scenarios load consistently
  - smoke check catches broken adapters before demo/use

## Suggested Agent Assignment (Parallel)
1. Agent A: T-001, T-002
2. Agent B: T-010, T-011
3. Agent C: T-012, T-013
4. Agent D: T-020, T-021
5. Agent E: T-022, T-023
6. Agent F: T-024, T-030
7. Agent G: T-031, T-040, T-041

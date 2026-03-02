# Earthly Agent Guide (v0.1)

## Product Intent
Earthly is a functional geospatial operations platform, not just a visual demo.

Core value for v0.1:
1. Fuse multiple public geospatial feeds into one browser surface.
2. Keep provenance visible (source, timestamp, refresh health).
3. Make the system fast enough for real usage and repeatable workflows.
4. Deliver a premium feel in interaction design and visual polish.

## Non-Negotiables
1. Every data layer must display source attribution and last-updated time.
2. No fake data passed off as real data in production mode.
3. Prefer reliability and clarity over flashy effects when there is a tradeoff.
4. Keep legal/privacy posture clean: public feeds only, terms-compliant integration.
5. Keep frame rate stable under realistic load.

## v0.1 Scope
In scope:
1. 3D globe base experience.
2. Layer toggles for at least satellites, flights, and earthquakes.
3. Entity click + details drawer (ID, source, timestamp, basic metadata).
4. Saved shots/scenes and quick load.
5. UI controls for style presets and tactical HUD.
6. Data health and refresh status panel.

Out of scope:
1. Enterprise auth/tenant management.
2. Proprietary classified data sources.
3. Predictive ML models.
4. Full incident workflow/alerting stack.

## Architecture Direction
Suggested stack:
1. Frontend: TypeScript + React + CesiumJS.
2. Backend: Node/TypeScript adapter service for normalization/caching.
3. Transport: SSE or WebSocket stream for live updates.
4. Data model: Unified entity schema with per-source metadata + TTL.

Data adapters should normalize into a common shape:
1. `entity_id`
2. `entity_type` (`flight`, `satellite`, `quake`, ...)
3. `position` (lat, lon, alt)
4. `velocity` (if available)
5. `source`
6. `observed_at`
7. `updated_at`
8. `confidence` (optional)

## Working Model For Parallel Agents
1. Pick one task ID from `TASKS.md`.
2. Comment status inline in that task block.
3. Keep each PR/patch scoped to one task family.
4. If API keys are needed, add placeholder env variables only.
5. Do not block on polish if core functionality is not done.

## Parallel Agent Protocol (Mandatory)
### Branch and sync rules
1. One task family per branch. Branch naming: `task/T-XXX-short-name`.
2. Rebase from `main` before coding and before handoff:
   - `git fetch origin`
   - `git rebase origin/main`
3. Commit early and often (small commits).
4. Do not force-push shared integration branches.

### Ownership rules to prevent conflicts
1. Integrator-only files (agents do not edit unless explicitly assigned):
   - `apps/web/src/App.tsx`
   - `apps/server/src/app.ts`
   - `apps/server/src/index.ts`
2. Schema contract files (`packages/shared/src/**`) should be edited only by schema-assigned tasks.
3. If your task requires touching out-of-scope files, stop and escalate instead of editing anyway.

### Conflict escalation rules
1. If you detect unexpected concurrent edits in your target file:
   - stop coding immediately
   - commit or stash your current scoped work
   - report conflict with file path and task ID
2. Do not “auto-resolve” by deleting others’ changes.
3. Integrator decides merge order and final resolution.

### Freeze and resume protocol
1. On freeze signal: stop, commit WIP, and post changed files.
2. On resume signal: rebase from latest `main`, then continue in scope.
3. If rebase conflicts occur outside your assigned area, abort rebase and escalate.

### Handoff format (required)
1. Task ID and branch name.
2. Files changed.
3. What was completed.
4. What remains.
5. Blockers and risks.

## Definition of Done (v0.1)
1. App runs locally with one command path documented in README.
2. At least 3 real data layers are live and toggleable.
3. Clicking entities shows trustworthy metadata and source attribution.
4. Scene presets can be saved and reloaded.
5. Basic performance guardrails are enforced (entity caps/LOD/throttling).
6. Errors are user-visible but non-fatal (graceful degradation).

## Premium Experience Principles
1. Typography and spacing feel intentional.
2. Motion is useful, not noisy.
3. HUD is cinematic but legible.
4. Empty/loading/error states feel designed, not default.
5. Surface trust: visibly communicate what is real, stale, or unavailable.

# Earthly Product Requirements Document (PRD)

## 1. Document Metadata
- Product: Earthly
- Version: v0.1
- Date: 2026-03-02
- Stage: Execution-ready for initial build

## 2. Product Vision
Earthly is a browser-native geospatial operations platform that fuses public live data layers into a premium, trustworthy tactical interface. v0.1 prioritizes functional utility over cinematic novelty while preserving a premium user experience.

## 3. Problem Statement
Current geospatial investigation workflows require users to jump across multiple disconnected tools for flights, satellites, seismic events, cameras, and map context. This causes context switching, poor signal correlation, weak provenance visibility, and slow briefing workflows.

Earthly solves this by providing one composable operational surface for detection, inspection, and briefing.

## 4. Goals and Non-Goals
### Goals (v0.1)
1. Deliver one unified globe experience with live multi-source overlays.
2. Make source provenance and data freshness explicit.
3. Enable click-to-inspect and track workflows on entities.
4. Provide reusable scene presets for repeatable monitoring/briefing.
5. Ship with stable performance under realistic data density.

### Non-Goals (v0.1)
1. Enterprise auth and multi-tenant controls.
2. Proprietary/closed intelligence feeds.
3. Predictive analytics and alerting automation.
4. Full enterprise workflow orchestration.

## 5. Target Users
1. OSINT researchers and creators.
2. Journalists and independent analysts.
3. Geo/data enthusiasts building monitoring views.
4. Small operations teams needing real-time context.

## 6. Primary Jobs To Be Done
1. Understand what is happening around a location now.
2. Correlate entities across layers quickly.
3. Move from global overview to focused context in seconds.
4. Generate reusable visual briefings from saved scenes.

## 7. Core User Flows
1. Global situational scan:
   - Open Earthly -> toggle layers -> inspect hotspots.
2. Entity drilldown:
   - Click entity -> open metadata drawer -> follow/track.
3. Briefing setup:
   - Configure camera + layers + style -> save shot -> replay.
4. Trust verification:
   - Open provenance panel -> verify source + freshness.

## 8. Functional Requirements
### FR-1 Globe and camera foundation
- The app must load a stable 3D globe scene.
- Camera movement must support global-to-local transitions.

### FR-2 Layer management
- Users must toggle each layer independently.
- Layer health states: `live`, `stale`, `error`, `off`.

### FR-3 Data ingestion and normalization
- Backend must normalize all feeds into a shared schema.
- Each entity must include source and timestamps.

### FR-4 Entity interaction
- User can click/select entities.
- Details panel shows metadata, source, and observation time.

### FR-5 Scene presets
- User can save, load, update, and delete scene presets.
- Presets include camera state, active layers, and style mode.

### FR-6 Trust and provenance
- Every layer must expose source attribution.
- UI must show last successful refresh time per layer.

### FR-7 Error handling
- Layer-level failures must not crash the app.
- User-facing errors must be explicit and recoverable.

## 9. Non-Functional Requirements
1. Performance:
   - Target usable frame rate under normal load.
   - Density throttling and LOD must prevent browser crashes.
2. Reliability:
   - Adapter retries with backoff.
   - Stale data visibly marked.
3. Usability:
   - Primary actions reachable in 1-2 clicks.
   - Premium but legible tactical UI.
4. Accessibility baseline:
   - Contrast-aware HUD and controls.
   - Keyboard reachable controls for main panel interactions.

## 10. Data Sources (v0.1 baseline)
1. Satellites: CelesTrak/NORAD-derived public datasets.
2. Civil Flights: OpenSky baseline.
3. Seismic activity: USGS feed.

Optional/phase-next feeds:
1. Weather overlays (NOAA/Open weather datasets).
2. Public traffic datasets.
3. Public CCTV feeds (region-limited and policy-compliant).

## 11. Success Metrics
### Primary
1. Time to first useful view (TTFUV).
2. Weekly active users creating saved scenes.
3. Scene replay/share rate.

### Secondary
1. Layer uptime and freshness reliability.
2. Selection-to-inspection latency.
3. Crash-free session rate.

## 12. Milestones
1. M1 - Platform bootstrap (T-001/T-002)
2. M2 - Data contract + first adapters (T-010/T-013)
3. M3 - Core UX and interaction (T-020/T-023)
4. M4 - Performance and resilience (T-030/T-031)
5. M5 - Provenance + scenario packaging (T-040/T-041)

## 13. Risks and Mitigations
1. Data terms risk:
   - Mitigation: maintain source registry and terms notes.
2. High-density rendering instability:
   - Mitigation: strict caps, LOD, progressive loading.
3. Demo-first drift away from utility:
   - Mitigation: prioritize core workflows and quality gates.
4. Trust ambiguity from stale feeds:
   - Mitigation: explicit freshness indicators and stale banners.

## 14. Open Decisions
1. SSE vs WebSocket as default transport in v0.1.
2. Minimum viable mobile support depth.
3. First paid/premium boundary after v0.1.
4. Which optional feeds enter v0.2.

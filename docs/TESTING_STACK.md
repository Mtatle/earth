# Earthly Testing Stack (v0.1)

## Objective
Give every agent a consistent local workflow for validation, debugging, and regression checks.

## Included Tooling
1. Unit/component tests: Vitest
2. React UI tests: Testing Library + JSDOM
3. Server integration tests: Supertest
4. End-to-end browser tests: Playwright (Chromium)
5. Local smoke validation: `scripts/smoke.mjs`
6. Environment sanity checks: `scripts/doctor.mjs`

## Install Steps
```bash
npm install
npm run install:browsers
```

If browser/system dependencies are missing:
```bash
npm run install:browsers:deps
```

## Command Reference
```bash
npm run doctor
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:smoke
npm run test:all
```

## Agent Workflow
1. Run `npm run doctor` once per terminal/session.
2. For feature work, run relevant workspace tests before handoff.
3. For merge-ready branches, run `npm run test:all`.
4. Attach failing command output and affected files in handoff notes.

## Notes
- Playwright config auto-starts local dev services via `npm run dev`.
- HTML Playwright reports output to `playwright-report/`.
- Keep tests deterministic; avoid real network dependency inside unit tests.

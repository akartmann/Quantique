# Story 1.1: Project bootstrap and verification harness

Status: ready-for-dev

## Story

As a delivery team,
I want a reproducible browser-game starter and verification harness,
so that the Young validation slice can be built and tested without bundling setup into an interaction story.

## Acceptance Criteria

1. **Given** a greenfield repository, **when** bootstrap is complete, **then** it is initialized from Phaser’s official Vite + TypeScript template with the approved dependencies and a committed generated lockfile pinning the exact Vite patch; **and** production-build, unit, browser-E2E, offline-reload, cross-browser, and accessibility test commands are available.
2. **Given** the boot shell, **when** it loads from cached production assets, **then** the first meaningful interaction is reachable within five seconds; **and** the app remains a static hosted web application with no account, telemetry, advertising, cloud save, remote configuration, or network-critical play dependency.

## Tasks / Subtasks

- [ ] Bootstrap the official Phaser Vite + TypeScript starter (AC: 1)
  - [ ] Use Phaser’s official generator; do not hand-roll a Vite/Phaser scaffold.
  - [ ] Keep the generated starter structure unless a change is required for the harness.
  - [ ] Set the project’s approved package versions: Phaser `4.2.1`; Vite `8.1.x`; `idb` `8.0.3`; Zod `4.4.3`; Vitest `4.1.10`; Playwright `1.61.1`; and `@axe-core/playwright` `4.12.1`.
  - [ ] Commit the generated `package-lock.json`, ensuring it pins the actual installed Vite 8.1 patch.
  - [ ] Update `.gitignore` to stop ignoring `package-lock.json`; preserve ignores for dependency folders, build output, and caches.
- [ ] Add only the minimal, testable boot shell (AC: 2)
  - [ ] Provide a semantic, keyboard-operable primary boot-shell interaction with a stable accessible role/name for E2E tests.
  - [ ] Keep Phaser as the visual starter layer; do not build the Young case contract, store, case loading, persistence, laboratory controls, or gameplay in this story.
  - [ ] Ensure the production build is static-hostable and has no auth, analytics, advertising, cloud save, remote configuration, backend, or runtime dependency that blocks core play.
- [ ] Configure the verification harness and stable scripts (AC: 1, 2)
  - [ ] Provide scripts for production build, TypeScript checking, unit tests, general browser E2E, offline reload, cross-browser E2E, and axe accessibility E2E.
  - [ ] Configure Playwright projects for Chromium, Firefox, and WebKit and document the required version-matched browser install command (`npx playwright install`).
  - [ ] Implement an offline-reload test against a served production build: load/cache the artifact online, switch the browser context offline, reload, then assert the semantic boot interaction remains usable.
  - [ ] Add an axe Playwright test for the boot shell. Use semantic roles/labels and public interaction assertions; do not inspect Phaser internals or pixels.
  - [ ] Add a cached-launch readiness measurement/assertion for the first meaningful semantic interaction (target: <5 seconds). Keep the threshold/reporting deterministic and suitable for CI; this is not the later low-end-laptop 60-FPS release gate.
- [ ] Verify and document the delivered baseline (AC: 1, 2)
  - [ ] Run the production build, type check, unit, accessibility, offline-reload, and all three browser projects.
  - [ ] Record the exact commands and prerequisites in the project README or equivalent developer documentation.
  - [ ] Confirm the lockfile is tracked by Git and no generated build artifacts are tracked.

## Dev Notes

### Scope and sequencing

- This is the foundation prerequisite for every remaining Epic 1 story and the Young validation slice. Its job is a reproducible starter plus test harness—not a partial implementation of Story 1.2 or later.
- Do **not** introduce a case schema, app store, case repository, IndexedDB implementation, domain calculator, laboratory controls, service worker, or application-level persistence merely to satisfy this bootstrap. Later stories own those behaviors.
- The repository is presently documentation-only: no existing application source, package manifest, tests, or previous story implementation must be preserved. The sole implementation-adjacent update is `.gitignore`, which currently rejects `package-lock.json` and must be corrected.

### Technical requirements and architecture compliance

- Use Node.js `20.18.1+`, npm, the official Phaser Vite + TypeScript generator, and the exact approved dependency versions above. Do not silently upgrade project pins based on currently available packages.
- Vite transpiles TypeScript but does not type-check it; expose an explicit `tsc --noEmit` (or equivalent) script in addition to the Vite production build.
- Vite’s production output must be deployable as static files. Future deployment must serve `index.html` appropriately for cache-versioned hashed assets; do not add a server/backend to solve this.
- Phaser is only the visual laboratory renderer. Establish no bootstrap shortcut that makes canvas the sole essential surface. The boot interaction must be semantic HTML, labelled, focusable, and usable by keyboard.
- Preserve future architecture boundaries without prematurely implementing them: a project-owned immutable typed store will become authoritative; DOM and Phaser will dispatch the same typed intents; `src/domain/` must stay pure; adapters will own browser effects; renderer factories will own Phaser lifecycle and cleanup.
- Avoid per-frame DOM work, IndexedDB/fetch/JSON work, logging, or transient allocations. The boot shell should be deliberately small to protect the five-second cached-launch target.
- Do not add physics simulation, a freeform sandbox, accounts, cloud features, multiplayer, UGC, LLM dialogue, telemetry, ads, premium gates, randomized rewards, or remote configuration.

### File structure requirements

**UPDATE**

- `.gitignore` — remove the `package-lock.json` ignore rule so the generated lockfile can be committed. Do not weaken other dependency/build/cache ignores.

**NEW (generator/harness-owned; exact generated starter filenames may vary)**

- `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, and the official Phaser Vite + TypeScript starter source/assets.
- `src/main.ts` and the minimal boot-shell implementation in the generator-compatible source structure.
- Vitest configuration/setup and unit test location.
- `playwright.config.ts` and E2E specs for baseline, offline reload, browser projects, and accessibility.
- README or equivalent developer documentation for install, browser binaries, and every verification command.

Do not create generic `services/`, `managers/`, or `helpers/` folders. When later work adds domain code, follow the architecture’s domain-driven hybrid layout exactly. Use PascalCase for classes/components, camelCase for non-class modules, and public-facing test selectors based on roles/labels.

### Testing requirements

- Unit harness: Vitest `4.1.10`; it may begin with a small deterministic smoke test but must execute successfully through a documented command.
- Browser harness: Playwright `1.61.1` with Chromium, Firefox, and WebKit projects. The normal E2E command and dedicated cross-browser command must be clear and CI-ready.
- Accessibility: `@axe-core/playwright` `4.12.1` verifies the semantic boot shell. This is a baseline only; manual release acceptance later still requires keyboard-only flow, focus recovery, screen-reader announcements, touch/pointer parity, and non-colour scientific encoding.
- Offline reload: test the built, served production artifact after a successful cached load; mocks of browser APIs alone do not meet this requirement.
- Cached launch: assert/record time to the meaningful semantic interaction, not merely `load` or first canvas paint.
- Later release gates remain out of scope but must not be blocked: 60 FPS at 1280×720 on a low-end school laptop, full Young completion flow, and cross-browser/manual accessibility verification.

### Git intelligence

- Recent commits are planning and readiness artifacts only; no implementation convention exists yet. Preserve the approved planning constraints rather than inventing incompatible project configuration.
- The working tree may contain the workflow’s sprint-status update. Do not overwrite it while implementing this story.

### Latest technical information

- Phaser’s official project templates support Vite and TypeScript variants; use that route as the bootstrap source rather than an unofficial scaffold. [Source: Phaser project templates — https://docs.phaser.io/phaser/getting-started/project-templates]
- `vite build` produces a static production bundle; Vite also requires a separate type-check because transpilation does not type-check TypeScript. [Source: Vite build guide — https://vite.dev/guide/build; Vite features guide — https://vite.dev/guide/features]
- Playwright browser binaries must match its installed version, and Playwright projects are the supported mechanism for Chromium, Firefox, and WebKit coverage. [Source: Playwright browsers — https://playwright.dev/docs/browsers]

### Project Context Rules

- Phaser must never become the authoritative state or accessibility UI. Every essential visual interaction later requires an equivalent semantic control.
- Keep core play offline-first and local-only; no network dependency may block use after a successful load.
- Case definitions/assets will be immutable under `public/cases/` and `public/assets/`; player progress will be separate. Do not create a competing storage convention.
- Future tests must assert public actions, selectors, semantic roles, and labels—not renderer-private state or incidental pixels.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1; requirements inventory]
- [Source: `_bmad-output/game-architecture.md` — Engine & Framework, Project Structure, Implementation Patterns, Test and Release Readiness, Development Environment]
- [Source: `_bmad-output/project-context.md` — Technology Stack & Versions, Testing Rules, Platform & Build Rules, Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Technical Specifications, Controls and Input, Out of Scope]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/reconcile-gdd.md` and `reconcile-research.md`]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Story context creation: planning artifacts, architecture, project context, UX reconciliations, repository state, Git history, and official technology documentation analyzed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/1-1-project-bootstrap-and-verification-harness.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story and Epic 1 statuses updated)

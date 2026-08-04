---
baseline_commit: d356cb51ee85280634ef3470307700f77494ef18
---

# Story 1.3: Accessible dual-surface laboratory controls

Status: review

## Story

As a player,
I want to adjust an authored laboratory control through semantic HTML, keyboard, pointer, or touch,
so that I can perform experiments regardless of my input method.

## Acceptance Criteria

1. **Given** the minimal Young case contract, **when** its authored slit-spacing control is selected, **then** the semantic application shell and Phaser laboratory surface render that control from the same authoritative state; **and** this story does not establish a laboratory performance release gate.
2. **Given** an authored numeric apparatus control with a label, unit, allowed range, and step, **when** the laboratory loads, **then** semantic HTML exposes its name, current value, unit, instructions, and a keyboard-operable value input or stepper; **and** no essential action depends solely on the Phaser canvas.
3. **Given** a player changes the control through its semantic HTML input, Phaser pointer/touch gesture, or keyboard interaction, **when** the change is accepted, **then** every path dispatches the same typed `apparatus.controlSet` intent to the authoritative store; **and** the resulting stored value and visible readouts are identical regardless of input origin.
4. **Given** a requested value is below the minimum, above the maximum, or off the configured step, **when** the player submits it, **then** the domain layer applies the documented validation or normalization rule deterministically; **and** the semantic UI announces the resulting value without relying on colour or sound.
5. **Given** the Phaser laboratory surface is rendered from state, **when** the authoritative control value changes, **then** the renderer mirrors the new value without owning or directly mutating application state; **and** scene shutdown removes its subscriptions and display objects.
6. **Given** the control implementation, **when** automated tests run, **then** unit tests cover validation and the pure state transition; **and** an integration test proves DOM and Phaser intent paths result in the same authoritative state.

## Scope and sequencing

- Story 1.2 is complete and is the sole source of Young’s authored apparatus metadata. Load it through `loadCaseDefinition`; do not duplicate, loosen, fetch, or mutate the strict case contract.
- Implement the vertical slice for **`slitSpacingMm` only**. Its authored values are label `Slit spacing`, unit `mm`, min `0.10`, max `0.50`, step `0.05`, and default `0.25`. Preserve the authored `screenDistanceM` definition unchanged for the later Young experiment story.
- This story establishes the store-mediated dual-surface pattern, not a freeform physics sandbox, run calculation, measurement notebook, persistence, source UI, prediction entry, completion gate, performance release gate, or full Young case flow. Story 2.2 owns the scientific experiment/output and its three-second target.
- Keep the existing finite phase model (`context → prediction → experiment → synthesis → review → debrief`) authoritative in `src/domain/cases/`; neither a scene nor an input handler may infer or advance it.

## Tasks / Subtasks

- [x] Establish minimal authoritative apparatus state and typed intents (AC: 1, 3, 4)
  - [x] Add a small project-owned immutable store under `src/core/store/` (for example `AppState.ts`, `AppAction.ts`, `createStore.ts`, and `selectors.ts`). It must expose read-only state, `dispatch`, and subscribe/unsubscribe; it must not use global mutable singletons.
  - [x] Define exactly one apparatus action shape: `{ type: 'apparatus.controlSet', controlId, value, origin }`, where `origin` is `'dom' | 'phaser'`. `origin` is diagnostic metadata only: it must not affect normalized values, results, or progression.
  - [x] Initialize active control values from the frozen case definition defaults. Store mutable active values separately from the immutable `CaseDefinition`.
  - [x] Keep expected rejected/invalid actions recoverable through the existing typed `Result` convention; never throw from the reducer or expose raw error text to players.

- [x] Implement pure authored-control validation and transition (AC: 3, 4)
  - [x] Add a focused pure module under `src/domain/apparatus/` (for example `ApparatusControl.ts`) that accepts an authored `PrimaryControl` plus a requested finite number and returns the accepted value/transition deterministically.
  - [x] Document and test one normalization rule: clamp below/above-range values to the authored min/max, then snap an in-range off-step value to the nearest valid step relative to the authored min. Resolve an exact midpoint consistently (choose and document one direction); use a tolerance or integer-step calculation that avoids floating-point drift.
  - [x] Reject `NaN` and non-finite input as a typed recoverable result; do not silently choose a value. The DOM adapter must pass raw input through this domain rule rather than treating browser constraint validation as the authority.
  - [x] Preserve the authored `label`, `unit`, `min`, `max`, and `step`; no hard-coded Young range exists outside fixtures/assertions.
  - [x] Keep this module pure TypeScript. It must not import Phaser, DOM/browser APIs, `fetch`, IndexedDB, or Zod.

- [x] Compose the case, store, semantic shell, and Phaser lab around the same state (AC: 1–5)
  - [x] Update `src/main.ts` only as needed to load `young-interference` through `loadCaseDefinition`, create the store after a successful validated load, compose both surfaces with the same store, and retain `registerOfflineCache()` as a non-blocking enhancement.
  - [x] Provide neutral semantic recovery copy if the case cannot load; the existing boot shell must remain usable and must not be replaced by raw exceptions.
  - [x] Retain `#boot-shell`, `#game-container`, the accessible button name `Enter laboratory`, `#boot-status` with `role="status"`/polite live behavior, and the existing cached-launch/offline contract unless a test is deliberately updated to cover the same public behaviour.
  - [x] Do not use the starter scenes’ pointer-driven `MainMenu → Game → GameOver` progression as application or case state. Replace or isolate template-only interaction as required, but do not make its clicks the source of truth.

- [x] Build the semantic control first-class (AC: 1–4)
  - [x] Add a focused semantic apparatus UI module under `src/ui/apparatus/` (for example `ApparatusControls.ts`) that reads selectors and dispatches only typed actions.
  - [x] Render a real associated `<label>` and keyboard-operable native numeric input/stepper with authored `min`, `max`, and decimal `step`; show the readable current value and unit, valid range, and concise instructions in text. Use the exact scientific words visible in the UI for the accessible name and announcement.
  - [x] Provide an `aria-live="polite"` status region that announces the **normalized stored value** after an accepted change, including its unit. DOM readout, live announcement, and Phaser readout must agree on that same value.
  - [x] Keyboard arrows/stepper use and manual number entry must dispatch the same `apparatus.controlSet` intent as the visual path. Never require hover, drag, canvas targeting, colour, or sound.
  - [x] Apply the UX design spine: semantic control panel/background/border, stable numeric readout, visible 2px focus treatment, text contrast of at least 4.5:1, normal 16px control gap, and 44×44 CSS px touch-operable affordances when touch is available. Respect zoom/text scaling and `prefers-reduced-motion`.
  - [x] Use calm factual feedback (for example, “Slit spacing set to 0.25 mm.”). Do not say the learner is wrong, imply a scientific conclusion, use score/speed language, or rely on red failure styling for science feedback.

- [x] Build a state-projection Phaser laboratory renderer (AC: 1, 3, 5)
  - [x] Add focused adapter-owned Phaser files under `src/adapters/phaser/` (for example `PhaserStoreAdapter.ts`, `scenes/LaboratoryScene.ts`, and `renderers/ApparatusRenderer.ts`). Renderer factories create and own all display objects; domain types never extend or import Phaser classes.
  - [x] Render a bounded visual slit-spacing affordance and a labelled visual readout from the store selector. It may support pointer/touch selection or gesture, but must convert it to the same typed `apparatus.controlSet` intent; it must not write state directly.
  - [x] Ensure a Phaser-originated request follows the identical domain normalizer/reducer path as a DOM request. The renderer reflects the resulting store value only after the transition.
  - [x] Subscribe once when the laboratory scene is created. On `shutdown`, unsubscribe and destroy/clear renderer-owned display objects and references. Do not retain stale scene objects when a scene restarts.
  - [x] Keep `update()` empty or absent for this slice. Do not add per-frame domain calculation, DOM work, JSON parsing, IndexedDB, logging, transient allocations, physics, pooling, or a model result.

- [x] Verify public behaviour and preserve the baseline (AC: 6)
  - [x] Add Vitest unit fixtures/specs for valid authored controls, clamp behavior, off-step normalization including a tie, non-finite rejection, and immutable pure reducer/store transitions. Test public values, not implementation-private fields.
  - [x] Add an integration test that drives one DOM intent and one simulated Phaser intent from the same initial state and asserts identical authoritative state plus matching formatted readouts. This may use the injected Phaser-store adapter/dispatch seam; it must not require canvas pixels or Phaser private state.
  - [x] Extend browser E2E/a11y coverage through semantic roles, labels, values, and status text: keyboard adjustment works, the announced/readable value updates, and the essential control is available outside canvas. Keep the existing boot-shell, production cache, offline-reload, and cross-browser tests green.
  - [x] Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:a11y`, `npm run test:e2e:offline`, and `npm run test:e2e:cross-browser` when browser binaries are installed. Manually verify keyboard-only operation, visible focus, text scaling/zoom, non-colour meaning, semantic announcements, pointer/touch parity, and scene restart cleanup; axe alone is insufficient.

## Developer guardrails

### Architecture compliance

```text
semantic HTML input / Phaser pointer or touch
  → typed apparatus.controlSet intent
  → pure domain normalization + immutable store transition
  → selectors
  → semantic readout + live announcement + Phaser renderer projection
```

- The store is the only mutable application authority. UI and Phaser may read selectors and dispatch typed actions only; they never mutate each other, the store state, or the case definition directly.
- `src/domain/` remains pure. Browser effects belong in adapters, and `loadCaseDefinition` remains the only repository that fetches/parses/validates case JSON. Do not re-parse or import Zod in the control domain.
- Preserve Story 1.2’s review fixes: case content uses Vite `BASE_URL`, the sidecar manifest is validated, protocol-relative assets are rejected, and returned definitions are recursively frozen.
- Static/offline requirements still apply: no account, telemetry, remote configuration, backend, cloud save, or network-critical path. A failed cache registration or case-load attempt must not prevent a semantic recovery surface.
- Keep the exact dependency pins already installed: Phaser `4.2.1`, Vite `8.1.5`, Zod `4.4.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`. Node.js remains `20.18.1+`. Do not upgrade packages in this story.

### File structure and current-code intelligence

**New, focused files expected**

- `src/core/store/AppState.ts`, `AppAction.ts`, `createStore.ts`, `selectors.ts` — minimum authoritative immutable store seam.
- `src/domain/apparatus/ApparatusControl.ts` — pure authored-control validation/normalization and state transition.
- `src/ui/apparatus/ApparatusControls.ts` — semantic labelled control, public readout, and announcement projection.
- `src/adapters/phaser/PhaserStoreAdapter.ts`, `scenes/LaboratoryScene.ts`, `renderers/ApparatusRenderer.ts` — adapter-owned subscription, intent mapping, and renderer lifecycle.
- Focused `tests/unit/` and `tests/integration/` specs for domain/store and dual-surface parity.

**Update only when needed**

- `src/main.ts` — currently starts `createBootShell`, the independent Phaser starter, and non-blocking offline registration. Replace independent composition with one shared case/store composition while retaining the boot-shell recovery contract.
- `src/game/main.ts` — currently registers only template scenes; configure/inject the laboratory adapter without letting the generated scene tree own app state.
- `src/ui/BootShell.ts`, `index.html`, and `public/style.css` — extend rather than discard the semantic shell; preserve existing E2E roles/names/IDs and static-host behavior.
- Existing `src/game/scenes/*` are generated placeholders. Do not put domain/store authority there or preserve their pointer-to-next-scene handlers as gameplay.
- `tests/e2e/boot-shell.spec.ts`, `accessibility.spec.ts`, `offline-reload.spec.ts`, and `tests/unit/BootShell.test.ts` — update only for stable public behaviour, never renderer internals.

### Previous story and Git intelligence

- Story 1.2 (`601e373`, reviewed by `95b642d`) completed the strict Young contract, repository boundary, immutable authored JSON, and adjacent phase reducer. Reuse these modules; do not recreate contract types or make an alternate case-content path.
- Its review specifically caught manifest validation, Vite-base URL handling, protocol-relative asset paths, and runtime immutability. Treat those as regression-sensitive integration points.
- Story 1.1 established the semantic `#boot-shell`, service-worker cache, production static build, and public-role E2E/a11y/offline tests. Preserve those harnesses and update expectations only to reflect intentional user-visible behaviour.
- Recent Git history is `95b642d Review 1.2`, `601e373 Dev 1.2`, `8463578 Story 1.2`, `e50b600 Review 1.1`, and `29266cd feat: bootstrap Phaser verification harness`.

### Latest technical information

- Phaser documents `shutdown` as the place to free scene resources; a shutdown scene may later start again, so clear store subscriptions and renderer references explicitly. [Source: Phaser scene shutdown event](https://docs.phaser.io/api-documentation/4.0.0/event/scenes-events); [scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes)
- Native `<input type="number">` is a keyboard-operable spinbutton and supports authored `min`, `max`, and `step`; its step base is `min` when provided. Browser validation is complementary only—the domain normalizer remains the source of truth for DOM, Phaser, and programmatic requests. [Source: MDN number input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number); [MDN step](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/step)
- No library upgrade is warranted: the repository’s pinned stack is the compatibility target for this implementation.

### Project Context Rules

- Phaser is a visual laboratory renderer, never the authoritative state or accessibility UI. Each essential visual gesture must have an equivalent semantic HTML action dispatching the same typed intent.
- Do not use Arcade/Matter physics or derive scientific results in a scene. Experiment calculation is deterministic and versioned; it belongs to later domain work.
- No freeform sandbox, canvas-only control, hard fail, irreversible wrong choice, speed reward, score, learner-data logging, unaudited historical claim/asset, or premature pooling/streaming/middleware.
- Use PascalCase for classes/components and class/component files; camelCase for other modules/functions/properties; `noun.verb` for domain events; camelCase JSON; and kebab-case case IDs/assets.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3; requirements inventory and dependent Stories 1.2/1.4]
- [Source: `_bmad-output/game-architecture.md` — State Management, User Interface and Rendering Boundary, Project Structure, Architectural Boundaries, Dual-Surface Interaction, Phaser Object Patterns, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Engine-Specific Rules, Performance Rules, Code Organization Rules, Testing Rules, Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay, Controls and Input, Young apparatus constraints, Technical Specifications]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Foundation, Component Patterns, Accessibility Floor, Input Schemes, Key Flows]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — Colors, Layout & Spacing, Component visual specification, Do's and Don'ts]
- [Source: `_bmad-output/implementation-artifacts/1-2-minimal-young-case-contract-and-authored-loop.md` — completed contract, review findings, implementation notes]
- [Source: `src/main.ts`, `src/ui/BootShell.ts`, `src/game/main.ts`, `src/game/scenes/*`, `src/domain/cases/*`, `src/adapters/content/loadCaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, and existing test specs — current integration state]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Implementation Plan

- Load the validated Young case once, initialize immutable active-control values, and compose semantic HTML plus Phaser from one project-owned store.
- Normalize every control request in a pure domain module: clamp, snap to authored steps, and choose upward on exact ties.
- Verify parity through unit, integration, keyboard, pointer, touch, a11y, offline, and cross-browser tests.

### Debug Log References

- Ultimate context engine analysis completed: full planning/design/architecture/project-context review, previous-story and Git intelligence, current source inspection, parallel design/architecture analysis, and current official Phaser/HTML documentation review.
- RED: new domain/store test suite failed before `ApparatusControl` and store modules existed.
- GREEN: 45 Vitest tests, TypeScript checking, production build, Chromium/a11y/offline suites, and Chromium/Firefox/WebKit browser suite passed. Offline assertions intentionally skip Firefox and WebKit.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- Implemented the immutable store-mediated `apparatus.controlSet` path and pure authored-value normalizer; exact step ties snap upward.
- Added a labelled native slit-spacing input with factual live announcements and a Phaser projection that cleans subscriptions/display objects on shutdown.
- Added DOM/Phaser state-parity unit and integration coverage plus browser keyboard, pointer, touch, accessibility, offline, and cross-browser regression coverage.

### File List

- `_bmad-output/implementation-artifacts/1-3-accessible-dual-surface-laboratory-controls.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)
- `index.html` (semantic apparatus mount point)
- `public/style.css` (accessible control panel and focus styles)
- `src/adapters/phaser/PhaserStoreAdapter.ts` (typed Phaser intent adapter)
- `src/adapters/phaser/renderers/ApparatusRenderer.ts` (state-projection visual affordance)
- `src/adapters/phaser/scenes/LaboratoryScene.ts` (subscription lifecycle)
- `src/core/store/AppAction.ts` (typed apparatus action)
- `src/core/store/AppState.ts` (immutable authoritative state and reducer)
- `src/core/store/createStore.ts` (project-owned store)
- `src/core/store/selectors.ts` (control selectors/readout formatting)
- `src/domain/apparatus/ApparatusControl.ts` (pure normalization)
- `src/game/main.ts` (laboratory scene composition)
- `src/main.ts` (validated case/store bootstrap)
- `src/ui/apparatus/ApparatusControls.ts` (semantic control surface)
- `src/ui/BootShell.ts` (neutral recovery status)
- `tests/e2e/accessible-control.spec.ts` (keyboard, pointer, and touch coverage)
- `tests/e2e/boot-shell.spec.ts` (stable boot-status assertion)
- `tests/e2e/offline-reload.spec.ts` (stable boot-status assertion)
- `tests/integration/DualSurfaceControl.test.ts` (DOM/Phaser intent parity)
- `tests/unit/ApparatusControl.test.ts` (normalization coverage)
- `tests/unit/AppStore.test.ts` (immutable state transitions)
- `vitest.config.ts` (integration-test discovery)

### Change Log

- 2026-08-04: Implemented accessible dual-surface slit-spacing controls and marked the story ready for review.

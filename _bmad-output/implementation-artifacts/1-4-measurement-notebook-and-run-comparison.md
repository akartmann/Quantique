---
baseline_commit: 83faa95159c2458083ccb56c38d684cc21df18d6
---

# Story 1.4: Measurement notebook and run comparison

Status: ready-for-dev

## Story

As a player,
I want to save observations from my experiment and compare two recorded runs,
so that I can use my own evidence to reason about a scientific claim.

## Acceptance Criteria

1. **Given** an authored experiment definition and validated apparatus controls, **when** I record a run, **then** the pure domain calculation produces an immutable run record containing an ID, case ID, controls, calculated result, timestamp, and experiment-model version; **and** the record does not depend on Phaser, DOM, or browser APIs.
2. **Given** a recorded run, **when** I open the semantic notebook, **then** I can read its settings, values and units, timestamp/order, observed result, and linked evidence; **and** all information is available without interpreting colour or canvas pixels.
3. **Given** at least two saved runs, **when** I select any two runs for comparison, **then** the notebook displays their settings and results side-by-side; **and** I can save an associated comparison note.
4. **Given** I reset or alter the current apparatus after recording a run, **when** I revisit that record, **then** it retains the original controls, result, timestamp, and model version; **and** it is never recalculated from a newer model implicitly.
5. **Given** a save request fails or the record is invalid, **when** the error is handled, **then** valid in-memory evidence remains available; **and** the player receives a neutral semantic recovery message rather than raw error text.
6. **Given** the notebook and comparison capability, **when** tests run, **then** unit tests cover deterministic run creation and comparison selection; **and** integration tests assert the notebook through public semantic controls and selectors.

## Scope and sequencing

- Extend the completed Story 1.3 store-mediated pattern; do not create a second state store, content path, UI-local notebook state, or Phaser-owned evidence state.
- Deliver an in-memory immutable run record, semantic notebook, two-run comparison, and associated note. This story does **not** introduce IndexedDB, migrations, offline restore, export/import, or print; Story 1.8 owns those persistence and portability responsibilities.
- Story 2.2 owns the actual Young double-slit/fringe-spacing formula, run animation/execution, the three-second target, reset semantics, both-control laboratory UI, and optional wavelength comparison. Story 1.4 must provide a narrow pure and deterministic record/calculation seam that accepts an authored or injected calculated result; do not hard-code, claim, or duplicate the Young physics model here.
- The existing strict Young case definition intentionally has `experiment.modelVersion`, fixed `wavelengthNm: 550`, and bounded control metadata but no result contract or formula. Do not widen the case schema or alter immutable `public/cases/` content merely to solve this story unless a minimal, reviewed result-contract field is demonstrably indispensable.
- Keep linked-evidence data structurally compatible with later stable source IDs, but do not implement source inspection or Curated Record UI (Story 1.5), conclusion readiness (Story 1.6), consultation/review (Story 1.7), or persistence (Story 1.8).

## Tasks / Subtasks

- [ ] Define pure immutable evidence records and a narrow calculation seam (AC: 1, 4, 5)
  - [ ] Add focused pure TypeScript modules under `src/domain/evidence/`, including `RunRecord.ts` for a `RunRecord` and factory/validator inputs. A record must contain a stable ID, `caseId`, an immutable snapshot of **both** active control values, the stored calculated/observed result, ISO timestamp, `experimentModelVersion`, and linked evidence IDs (initially empty or explicitly supplied).
  - [ ] The run factory receives the ID and timestamp as arguments (or through an injected pure interface). It must never call `crypto.randomUUID()`, `Date`, IndexedDB, DOM, Phaser, `fetch`, or any other browser API from `src/domain/`.
  - [ ] Add only the narrow pure result-calculation contract needed to build a deterministic record. It must be parameterized/injected from composition or a fixture until Story 2.2 supplies `calculateExperimentResult`; it must not embed Young fringe mathematics, canvas output, timers, or a freeform physics sandbox.
  - [ ] Clone and freeze the controls, result, linked-evidence array, and record. Reject an invalid ID, timestamp, controls/result payload, duplicate ID, or non-finite scientific numeric value with the existing typed `Result` convention; never mutate an existing run after creation.
  - [ ] Store the calculated result and `experimentModelVersion` in the record at creation. Every historic notebook rendering and comparison reads that stored snapshot—never recalculates it from current controls or a newer model.

- [ ] Extend the authoritative store with typed evidence and comparison transitions (AC: 1, 3–5)
  - [ ] Extend `src/core/store/AppAction.ts` with a discriminated action union for recording a prepared run, selecting/unselecting comparison run IDs, and saving an associated comparison note. Preserve `apparatus.controlSet` exactly, including diagnostic-only `origin` semantics.
  - [ ] Refactor `reduceAppState` in `src/core/store/AppState.ts` to switch exhaustively by action type before accessing action-specific fields. The current reducer assumes every action has `controlId`; that must not leak into run/note actions.
  - [ ] Add frozen run collection and comparison state to `AppState`. Preserve `caseDefinition` and `activeControlValues` immutability, and return a fresh frozen state only after a successful transition.
  - [ ] Reject unknown or duplicate runs, selecting fewer/more than two runs for a side-by-side comparison, selecting the same run twice, and notes not associated with a valid selected pair as recoverable `Result` failures. A failed action must retain all previously valid in-memory runs/notes and must not notify subscribers through `createStore`.
  - [ ] Add public selectors in `src/core/store/selectors.ts` for ordered notebook observations, record metadata/formatting, selected comparison pair, and its saved note. UI code must render selectors rather than owning copies of run data.
  - [ ] Do not use a scene, UI visibility, or phase history to determine a record's validity or progression. Preserve the pure `context → prediction → experiment → synthesis → review → debrief` phase model; this story does not advance it.

- [ ] Build the semantic Measurement Notebook and comparison surface (AC: 2, 3, 5)
  - [ ] Add focused `src/ui/notebook/NotebookPanel.ts` and, if it keeps selection/presentation clearer, `src/ui/notebook/RunComparison.ts`. Mount them from `src/main.ts` with the same shared store used by the apparatus and Phaser adapter.
  - [ ] Extend `index.html` and `public/style.css`; preserve `#boot-shell`, `#boot-status`, the accessible `Enter laboratory` button, `#apparatus-controls`, `#game-container`, cached-launch behavior, and the existing phone read-only lab-control behavior. The notebook stays readable on phones; it must not re-enable laboratory controls.
  - [ ] Use semantic headings, ordered observations, associated labels/values/units, native buttons/inputs, and a polite status/recovery region. Expose the record's order, timestamp, model version, both controls, observed result, and linked evidence as text; no notebook fact may be canvas-only, colour-only, or sound-only.
  - [ ] Provide a named semantic action to record the prepared experiment result and calm factual confirmation (for example, “Observation 2 recorded.”). On invalid input or failed save, use neutral actionable copy such as “This observation could not be recorded. Your existing observations are unchanged.” Never expose exception text or frame it as a learner error.
  - [ ] Once at least two runs exist, provide controls to select **any two distinct saved runs**, render their settings/results in a clearly labelled side-by-side comparison, and save/revisit one associated comparison note. Do not silently choose a pair or overwrite a note for a different pair.
  - [ ] Follow the UX/design spine: warm notebook/note presentation, stable numeric type for values/timestamps/results, 4.5:1+ text contrast, visible 2px focus treatment, 44×44 CSS-px touch targets where applicable, logical keyboard order, and reduced-motion-safe behavior. Feedback must be calm, precise, evidence-focused, and non-competitive.

- [ ] Preserve the Phaser boundary and performance characteristics (AC: 1, 2, 4)
  - [ ] Phaser remains a visual laboratory projection only. Do not put the notebook, run collection, comparison state, calculation authority, browser storage, or accessibility announcement logic in `src/adapters/phaser/`, `LaboratoryScene`, or `ApparatusRenderer`.
  - [ ] Leave the Story 1.3 typed `apparatus.controlSet` path, DOM/Phaser parity, semantic announcement for Phaser-originated control changes, phone read-only behavior, exponent-form normalization, and shutdown cleanup intact.
  - [ ] Do not add per-frame calculation, DOM work, JSON parsing, IndexedDB access, logging, transient collection allocation, pooling, physics, backend calls, analytics, or network-critical behavior. A current-control change or reset may change future run inputs but cannot mutate a saved record.

- [ ] Verify deterministic public behavior and regressions (AC: 1–6)
  - [ ] Add Vitest unit fixtures/specs for deterministic record creation using explicit IDs/timestamps; control/result/model-version snapshots; deep immutability; rejected invalid records; record preservation after later live-control changes; ordered selection of any two runs; duplicate/same-run selection rejection; and comparison-note association/preservation.
  - [ ] Add an integration test driven through public actions and selectors (not Phaser fields) that records at least two fixture results, verifies the semantic/selector notebook projection, compares both orders/pairs where applicable, saves a note, and proves current control changes do not alter historic values/results/model versions.
  - [ ] Add Playwright coverage through semantic roles, labels, values, and status text: record observations, inspect all required metadata, select two runs, see both columns side-by-side, save/read the comparison note, and receive neutral recovery copy while existing observations remain available. Run axe with the notebook exposed; manually verify keyboard-only operation, focus recovery, zoom/text scaling, non-colour encoding, and screen-reader announcements.
  - [ ] Keep and run the existing boot-shell, accessible-control (keyboard/pointer/touch and phone), production build, offline-reload, and cross-browser tests. Do not loosen their public assertions to accommodate the notebook.

## Developer guardrails

### Required data flow

```text
prepared deterministic result + active-control snapshot + injected ID/timestamp
  → pure immutable RunRecord factory
  → typed run.record / comparison intent
  → immutable store transition + selectors
  → semantic notebook and comparison projection
```

- The store remains the sole mutable application authority. Semantic UI and Phaser only read selectors and dispatch typed actions; neither directly mutates a record, the other layer, active controls, or the immutable case definition.
- Treat a run as historical evidence. Its `controls`, `result`, `timestamp`, and `experimentModelVersion` are the facts observed at recording time; never compute a displayed historic result from the live apparatus.
- `src/domain/` remains pure TypeScript. Expected failures return `Result`; reducers must not throw. Browser effects belong only to adapters, and this story deliberately does not add a persistence adapter.
- Do not re-fetch/re-parse case content, import Zod into pure domain code, create an alternate content path, mutate `public/cases/`, or relax Story 1.2's strict/recursive-frozen content boundary.
- Do not build a freeform sandbox, outcome scoring, hard fail, irreversible loss, speed reward, learner-data logging, raw-error UI, or canvas-only notebook interaction.

### Existing files to read and update deliberately

| Path | Current responsibility and required preservation |
| --- | --- |
| `src/core/store/AppAction.ts` | Only `apparatus.controlSet` exists. Extend with a discriminated action union; do not make `origin` affect result/progression. |
| `src/core/store/AppState.ts` | Currently freezes authored definition and active controls; refactor the reducer by action type and add frozen evidence/comparison state without mutating existing values. |
| `src/core/store/createStore.ts` | Notify subscribers only on successful pure transitions; a rejected record/save must preserve state and emit no false update. |
| `src/core/store/selectors.ts` | Keep authored-control formatting; add notebook/comparison selectors instead of UI-local copies. |
| `src/domain/cases/CaseDefinition.ts` | Reuse `id`, controls, fixed 550 nm metadata, and `experiment.modelVersion`; do not turn the strict Young contract into a generic future-case schema. |
| `src/main.ts`, `index.html`, `public/style.css` | Compose/extend the semantic shell; retain boot IDs/roles, cache/offline behavior, and accessible control public behavior. |
| `src/ui/apparatus/ApparatusControls.ts` | Preserve native labelled control, normalized announcements, and <=767px read-only lab behavior. |
| `src/adapters/phaser/*` | Keep adapter-only state projection and lifecycle cleanup; do not make it notebook/calculation authority. |

### Expected focused additions

- `src/domain/evidence/RunRecord.ts` — pure immutable types/factory and any small validation helpers.
- `src/domain/evidence/` comparison helper only if it remains pure and avoids duplicating store authority.
- `src/ui/notebook/NotebookPanel.ts` and optionally `RunComparison.ts` — semantic record list, pair selection, side-by-side output, note, and status.
- Focused tests under `tests/unit/`, `tests/integration/`, and `tests/e2e/`.

### Library and framework requirements

- Use the installed compatibility pins; do **not** upgrade packages: Phaser `4.2.1`, Vite `8.1.5`, TypeScript `~5.7.2`, Zod `4.4.3`, `idb` `8.0.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`.
- `idb` is installed but intentionally unused in this story; IndexedDB schemas, database lifecycle handling, migrations, offline restoration, and persistence failure recovery are Story 1.8 work.
- If a boundary schema is genuinely needed for a non-domain input, use Zod 4 `safeParse` and map failure to `Result`; do not use exception flow or Zod v3-only APIs. A record created solely inside the typed store need not invent a browser-content/persistence boundary.
- Vitest tests should inject fixed IDs/timestamps (or use controlled fake time) so run fixtures are deterministic. Playwright tests should prefer `getByRole`/`getByLabel` and assert public semantic text/values rather than canvas pixels/private state.

### Previous-story and Git intelligence

- Story 1.2 established the validated, Vite-base-aware, manifest-checked, recursively frozen Young definition plus the pure phase reducer. Reuse it; no alternative definition, source loader, or phase authority is allowed.
- Story 1.3 established the shared immutable store, pure control normalizer, semantic numeric input, and Phaser projection. Its review patches are regression-sensitive: phone laboratory controls are read-only, accepted Phaser changes announce semantically, duplicate commits/announcements are avoided, and exponent-form authored values normalize deterministically.
- The five most recent commits are `83faa95 Review 1.3`, `5444378 Dev 1.3`, `d356cb5 Story 1.3`, `95b642d Review 1.2`, and `601e373 Dev 1.2`. Preserve their public test contracts instead of rewriting prior foundations.

### Project Context Rules

- Essential notebook work, values, evidence, notes, focus, and announcements belong to semantic HTML; Phaser is visual-only.
- Use immutable state, typed `noun.verb` actions/events, PascalCase for classes/components and their files, camelCase for non-class modules/functions/properties, and camelCase JSON. Case IDs/assets remain kebab-case.
- Target current desktop Chrome, Firefox, Safari, and Edge with tablet-equivalent keyboard/pointer/touch outcomes. Phones remain laboratory-read-only, but records must stay readable.
- Preserve static offline-first constraints: no account, telemetry, cloud save, remote configuration, backend, or network requirement blocks core play. Case definitions/assets remain immutable; player state is local only.
- Unit-test pure domain/store behavior without Phaser/browser/IndexedDB. Browser tests use public semantic roles, labels, and selectors. Axe is necessary but not sufficient: manually verify keyboard, focus, non-colour encoding, and screen-reader usability.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4; FR9–FR10; Stories 1.2–1.8 and 2.2]
- [Source: `_bmad-output/game-architecture.md` — State Management, User Interface and Rendering Boundary, Deterministic Experiment Record, Error Handling, Project Structure, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Technology Stack & Versions; Engine-Specific, Performance, Code Organization, Testing, Platform, and Critical Don't-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay, Measurement Notebook, Controls and Input, Core Puzzle Mechanics, Technical Specifications]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Information Architecture, Component Patterns, State Patterns, Accessibility Floor, Key Flows]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — Colors, Typography, Components, Do's and Don'ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/mockups/measurement-notebook.html` — visual composition reference only; EXPERIENCE/DESIGN behavioral rules prevail]
- [Source: `_bmad-output/implementation-artifacts/1-2-minimal-young-case-contract-and-authored-loop.md` — completed contract, review findings, and implementation notes]
- [Source: `_bmad-output/implementation-artifacts/1-3-accessible-dual-surface-laboratory-controls.md` — completed shared-store/control pattern, review findings, and regression contracts]
- [Zod v4 release notes](https://zod.dev/v4) — retain v4 boundary validation conventions when a boundary schema is necessary.
- [Vitest date mocking](https://vitest.dev/guide/mocking/dates) — deterministic timestamp tests.
- [Playwright locators](https://playwright.dev/docs/locators) and [accessibility testing](https://playwright.dev/docs/accessibility-testing) — public semantic locators and the limits of automated axe coverage.

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete planning/GDD/architecture/project-context/UX review; prior-story and source inspection; recent Git intelligence; parallel artifact, source, and official-documentation research.
- Validation checklist applied: the story prevents duplicate persistence/physics work, preserves the store and prior public behavior, specifies exact update/new paths, and makes testing/accessibility/regression expectations actionable.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- The Story 1.4 / Story 2.2 calculation boundary is explicit: record a pure injected result now; deliver Young fringe physics and execution timing later.
- Story 1.8 remains the sole owner of IndexedDB persistence and portable records.

### File List

- `_bmad-output/implementation-artifacts/1-4-measurement-notebook-and-run-comparison.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

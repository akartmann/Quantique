---
baseline_commit: c66607605eeccb29cf2e799a9576ec7e10542573
---

# Story 2.1: Young contextual record and prediction

Status: done

## Story

As a player,
I want to inspect the Young case context and record a prediction before experimentation,
so that my later conclusion begins with a testable expectation.

## Acceptance Criteria

1. **Given** the Young case is selected, **when** its context phase loads, **then** I can inspect at least two required contextual artifacts before recording a prediction; **and** the phase, source inspections, and prediction are stored through typed actions.
2. **Given** I have not met the context requirement, **when** I attempt to enter experimentation, **then** the semantic UI identifies the missing context action; **and** it preserves all valid work and offers no hard fail.

## Tasks / Subtasks

- [x] Make contextual evidence and prediction authoritative state (AC: 1, 2)
  - [x] Add a narrow typed `noun.verb` prediction action in `src/core/store/AppAction.ts`; do not introduce untyped UI state or a second store.
  - [x] Extend the deeply frozen `AppState` with an initially empty, revisable prediction. Add a pure reducer that accepts a non-blank trimmed prediction, preserves all unrelated progress, and clears stale consultation/review projections as other successful evidence edits do.
  - [x] Add pure domain context/prediction-readiness helpers if needed. The store must use them to gate `context → prediction` on both required, reviewed contextual artifacts and `prediction → experiment` on a recorded prediction. Keep `caseReducer.ts` adjacency-only or refactor it deliberately; a UI/Phaser guard is insufficient.
  - [x] Return distinct typed, neutral recoverable failures for missing contextual sources and missing prediction. A rejected action must leave state unchanged and must not notify subscribers.
  - [x] Expose public selectors for the saved prediction, contextual readiness, and human-readable missing artifact labels. Components must not inspect or mutate raw state directly.

- [x] Build the semantic context-and-prediction interaction (AC: 1, 2)
  - [x] Add a focused semantic component under `src/ui/context/` (for example `CaseContextAndPrediction.ts`) and mount it from `src/main.ts` after the Curated Record/store are available.
  - [x] Reuse `src/ui/sources/CuratedRecord.ts` for source cards and the existing `source.inspected` action. Do not duplicate source validation, provenance rendering, or inspection state in the new panel.
  - [x] Present the opening dispute/context, a visible two-source readiness summary, a labelled prediction field, an explicit **Record a prediction** action, and a semantic continue action. Prediction is tentative and revisable; never label it correct/wrong.
  - [x] Put status and gate feedback in an existing or new initially empty polite live region. Copy must identify the next missing action (for example, inspect a named artifact or record a prediction), retain valid text/inspections, and never imply punishment or failure.
  - [x] Preserve keyboard focus across state-driven rerenders; use native labelled controls and `textContent`, never `innerHTML`, for authored or learner-entered strings. Retain the established Curated Record focus-restoration/teardown pattern.
  - [x] Keep this entire flow semantic HTML first-class. Phaser may mirror phase/state but must not own prediction entry or progression; no Phaser renderer/scene change is required unless it only mirrors the resulting state.

- [x] Preserve prediction in local progress and portability (AC: 1)
  - [x] Add prediction to `CaseRecordProjection.ts`, `CaseRecordSchema.ts`, and `createAppStateFromCaseRecord` so save, restore, export, and import retain it.
  - [x] Explicitly migrate existing schema-v1 records to the new record version with an empty prediction. Reject unsupported future/invalid records as a typed `Result`; failed import/restore must leave the last valid state intact and show neutral semantic recovery.
  - [x] Do not mutate `public/cases/young-interference/case.json`, add a separate persistence mechanism, or add historical source assertions. The existing case contract already defines exactly two reviewed Young artifacts and `prediction.required: true`.

- [x] Keep phase presentation coherent and test the complete public flow (AC: 1, 2)
  - [x] Update `src/ui/theory/TheoryBoard.ts` or its callers so it cannot provide an unguarded context/prediction shortcut. The context/prediction panel owns the forward actions; all rendered phase labels still derive from selectors.
  - [x] Update existing tests that directly advance `context → prediction → experiment` so they establish the required inspected sources and prediction through public actions first.
  - [x] Add unit coverage for prediction validation, each gate failure, successful progression, deep immutability, and record schema/migration/hydration.
  - [x] Add integration coverage for source inspection → prediction → phase transition, failed attempts preserving source/prediction work, and public selector/action behavior.
  - [x] Add Playwright coverage for the semantic context/prediction flow, named missing-context feedback, keyboard focus/live status, and prediction persistence across reload/export/import. Include the new semantic panel in the relevant axe check; manual release acceptance still covers keyboard-only and screen-reader behavior.

### Review Findings

- [x] [Review][Patch] Migrate legacy progressed records back to prediction while retaining saved work [src/schemas/migrations/migrateCaseRecord.ts:18]
- [x] [Review][Patch] Block recording a prediction until required contextual artifacts are inspected [src/core/store/AppState.ts:229]
- [x] [Review][Patch] Synchronize the prediction draft after a successful progress import [src/ui/context/CaseContextAndPrediction.ts:39]
- [x] [Review][Patch] Expect the schema-v2 export filename in progress-portability E2E coverage [tests/e2e/progress-portability.spec.ts:24]

## Dev Notes

### Story boundaries and sequencing

- This is the first Young validation-slice story and owns FR4: two contextual artifacts/sources plus a prediction before the first substantive experiment. It prepares Story 2.2's bounded double-slit run, then Story 2.3's synthesis/debrief.
- Reuse Epic 1 foundations: Story 1.2’s frozen/validated Young contract and finite phase model; Story 1.5’s semantic Curated Record and typed source inspections; Story 1.6’s authoritative readiness philosophy; and Story 1.3’s typed, dual-surface pattern. Do not reimplement schemas, source cards, Phaser controls, or a phase machine.
- The intended learning flow is disputed observation → inspect both contextual artifacts → record a tentative prediction → bounded laboratory. The whole Young run targets 20–30 minutes; context should be concise (about 3–5 minutes), never a freeform archive or physics sandbox.
- Keep production order distinct from campaign order: Young is the first production/validation slice even though Morley–Miller is later the first campaign case.

### Current code intelligence — read before editing

**UPDATE — authoritative state and phase gate**

- `src/core/store/AppAction.ts`, `AppState.ts`, `createStore.ts`, and `selectors.ts`: the store already owns deeply frozen immutable state and only notifies after a successful reducer result. `source.inspected` is typed and clears stale consultation/peer review. Extend these patterns; never bypass the reducer.
- `src/domain/cases/caseReducer.ts`: currently permits adjacent phase transitions only. At the app boundary, it is therefore possible to reach experiment without inspected context or prediction. This story must make the missing-context/prediction checks pure and authoritative without placing progression rules in a component or a Phaser scene.
- `src/core/store/CaseRecordProjection.ts`, `src/schemas/CaseRecordSchema.ts`, and `src/schemas/migrations/migrateCaseRecord.ts`: progress portability is already versioned/validated. Prediction must participate in projection, validation, migration, hydration, IndexedDB restoration, import, and export; preserve the existing atomic replacement/recovery behavior.

**UPDATE — semantic presentation**

- `src/ui/sources/CuratedRecord.ts`: it already renders semantic source cards with title, origin, type, provenance, non-colour category marker, rights state, an inspect button, polite status, and focus preservation. Its only eligible sources have `rightsStatus === 'reviewed'`; retain its duplicate/unknown/ineligible neutral-error behavior.
- `src/ui/theory/TheoryBoard.ts`: inspect its current “continue investigation” controls. Do not leave a path that dispatches phase advance before context/prediction requirements are met.
- `src/main.ts`, `index.html`, and `public/style.css`: preserve startup order—offline cache registration, repository load/freeze, validated restore or fresh state, semantic mounts, then Phaser. Add only the semantic root/style needed for this panel; use established responsive focus/44px/reduced-motion conventions.
- `src/adapters/phaser/scenes/LaboratoryScene.ts` and renderer code: preserve as visual-only. It must not receive prediction state ownership, per-frame checks, DOM work, or a new progression shortcut.

**UNCHANGED content contract**

- `public/cases/young-interference/case.json`, `src/domain/cases/CaseDefinition.ts`, and `src/schemas/CaseDefinitionSchema.ts` already provide the correct bounded case data: `young-lecture-1801` (Thomas Young’s 1801 lecture record) and `newton-opticks` (the earlier corpuscular account) are the two reviewed contextual artifacts; `prediction.required` is true. Do not invent excerpts, claims, or new source material.
- Only `src/adapters/content/loadCaseDefinition.ts` fetches/parses case JSON and freezes it after Zod validation. Do not move fetching/parsing into UI/domain code or mutate case definitions with player progress.

### Architecture compliance and implementation guardrails

- Maintain the one-way flow: semantic HTML interaction → typed action → pure immutable store transition → selectors/subscriptions → DOM and Phaser projections. UI and Phaser never mutate each other or state directly.
- Keep `src/domain/` free of Phaser, DOM, fetch, IndexedDB, and browser APIs. Adapters own browser effects; use typed `Result` failures for expected invalid/incomplete input.
- Semantic HTML is the authoritative interaction surface for source inspection, prediction entry, focus behavior, and announcements. Ensure keyboard, pointer, and touch achieve the same authoritative outcome; Phaser canvas is never required.
- Use no new libraries or upgrades. Keep project pins: Phaser 4.2.1, TypeScript 5.7.x, Vite 8.1.5, Zod 4.4.3, idb 8.0.3, Vitest 4.1.10, Playwright 1.61.1, and `@axe-core/playwright` 4.12.1.
- Do not add a backend, telemetry, analytics, account, remote configuration, external critical-play API, logging of learner-entered prediction text, hard fail, irreversible wrong choice, scoring, speed reward, or scientific claim unsupported by reviewed case content.
- Source provenance/rights information stays visible in text and non-colour markers. Errors are for system/input conditions—not for a tentative scientific prediction. Never make colour or sound the sole carrier of meaning.
- Keep `LaboratoryScene.update()` free of phase/prediction/domain work, fetch/IndexedDB/JSON parsing, DOM manipulation, logging, and per-frame allocations.

### Testing and verification

- Use Vitest for pure readiness/reducer/schema/migration behavior; use fixtures and public actions/selectors rather than Phaser objects.
- Use Playwright role/label locators and public semantic state. Run `AxeBuilder.analyze()` only after the relevant UI is exposed; axe is automated coverage, not a substitute for manual keyboard, focus, screen-reader, and non-colour checks.
- Verify the affected suite proportionately: `npm run typecheck`, `npm test`, `npm run build`, relevant E2E/axe/offline suites, and the cross-browser command when feasible. Existing Playwright setup covers Chromium, Firefox, and WebKit; browser binaries must match the installed Playwright version.

### Project Structure Notes

- Add the focused panel under `src/ui/context/`; do not add generic `services/`, `helpers/`, or `managers/` directories.
- Keep PascalCase for class/component files and camelCase for non-class modules/functions. Domain events/actions remain `noun.verb`; JSON stays camelCase.
- Keep shipped case content/assets immutable under `public/cases/` / `public/assets/`; player prediction belongs in the versioned local progress record only.

### Latest technical information

- Phaser scene subscriptions and display objects must be cleaned up at `shutdown` because a scene may restart; this story should not add lifecycle work to the laboratory scene. [Source: Phaser Scene concepts](https://docs.phaser.io/phaser/concepts/scenes)
- Use a polite live region for recoverable, non-urgent gate feedback; it must exist before content is inserted. [Source: MDN ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- Prefer native semantic controls and Playwright role/label locators; test the accessible interaction before running axe analysis. [Source: Playwright locators](https://playwright.dev/docs/locators), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- Zod’s existing `safeParse` repository boundary remains sufficient; Story 2.1 needs no dependency/schema API upgrade solely for prediction UI. [Source: Zod basics](https://zod.dev/basics)

### Project Context Rules

- Phaser is a visual companion—not application state or accessibility UI. Scenes mirror the finite `context → prediction → experiment → synthesis → review → debrief` phase only.
- Core play remains local/offline-first after initial successful load; valid progress must survive rejected import/save handling without silent loss.
- Tests assert public roles, labels, actions, and selectors, never private renderer fields or pixels. Preserve manual accessibility acceptance requirements beyond axe.
- If a durable conflict appears, choose the more restrictive architecture/project-context rule and record the decision rather than creating a competing pattern.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1; requirements inventory FR4; Epic 1 Stories 1.2, 1.3, 1.5, and 1.6]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay Loop; Controls and Input; Puzzle Game Specific Design; Out of Scope]
- [Source: `_bmad-output/game-architecture.md` — State Management; User Interface and Rendering Boundary; Architectural Boundaries; Dual-Surface Interaction; State Patterns; Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Engine-Specific Rules; Code Organization Rules; Testing Rules; Platform & Build Rules; Critical Don’t-Miss Rules]
- [Source: `public/cases/young-interference/case.json` — existing Young contextual artifacts and required prediction]
- [Source: `src/core/store/AppState.ts`, `src/core/store/AppAction.ts`, `src/core/store/selectors.ts`, `src/domain/cases/caseReducer.ts`, `src/ui/sources/CuratedRecord.ts`, and `src/main.ts` — current patterns to extend]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: planning artifacts, GDD, architecture, project context, existing Young case contract, relevant source/store/UI code, Git history, and current official technical guidance were analyzed.
- Recent commits completed Epic 1 and reinforce narrow, test-backed changes built around public semantic controls/selectors; no new dependency pattern is required for this story.
- Added authoritative context/prediction readiness gates, portable-record schema v2 migration, semantic panel, and public acceptance coverage without changing the immutable Young content contract.

### Implementation Plan

- Keep source inspection and prediction in the single frozen store; use pure readiness helpers at the reducer boundary so neither semantic UI nor Phaser can bypass the gates.
- Preserve the established semantic-first/focus-restoration pattern, retain the Curated Record as the sole source-card renderer, and version progress records explicitly for prediction portability.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- Implemented typed prediction storage, pure context/prediction gates, public selectors, schema-v1-to-v2 migration, semantic context/prediction UI, and print-record visibility.
- Verified with `npm run typecheck`, `npm test` (118 tests), `npm run build`, Playwright Chromium, automated axe, and the Chromium/Firefox/WebKit suite.

### File List

- `_bmad-output/implementation-artifacts/2-1-young-contextual-record-and-prediction.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Story 2.1 status)
- `index.html`
- `public/style.css`
- `src/core/store/AppAction.ts`
- `src/core/store/AppState.ts`
- `src/core/store/CaseRecordProjection.ts`
- `src/core/store/selectors.ts`
- `src/domain/cases/contextPredictionReadiness.ts` (new)
- `src/main.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/schemas/migrations/migrateCaseRecord.ts`
- `src/ui/context/CaseContextAndPrediction.ts` (new)
- `src/ui/print/CaseRecordPrintView.ts`
- `src/ui/theory/TheoryBoard.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/context-prediction.spec.ts` (new)
- `tests/e2e/offline-reload.spec.ts`
- `tests/e2e/progress-portability.spec.ts`
- `tests/e2e/theory-board.spec.ts`
- `tests/integration/ReviewFlow.test.ts`
- `tests/integration/TheoryBoard.test.ts`
- `tests/unit/CaseRecordRepository.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/ContextPrediction.test.ts` (new)
- `tests/unit/ReviewRules.test.ts`
- `tests/unit/TheoryStore.test.ts`

## Change Log

- 2026-08-05: Implemented authoritative Young context/prediction gating, semantic interaction, schema-v2 progress portability, and cross-browser accessibility coverage; moved story to review.
- 2026-08-05: Code review completed; repaired legacy-progress migration, context-gated prediction recording, imported prediction hydration, and portability coverage.

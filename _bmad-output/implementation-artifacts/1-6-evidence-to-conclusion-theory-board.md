---
baseline_commit: 4a3a941f4d84c40b46a30f7364e3035b8ad352c7
---

# Story 1.6: Evidence-to-conclusion theory board

Status: ready-for-dev

## Story

As a player,
I want to connect my observations, sources, prediction, and a stated limitation into a conclusion,
so that I can make only the scientific claim that my evidence supports.

## Acceptance Criteria

1. **Given** recorded runs and inspected sources, **when** I open the semantic theory board, **then** I can select and review the observations and sources that support my prediction and conclusion; **and** I can enter a conclusion and at least one limitation or alternative explanation.
2. **Given** a case definition with minimum evidence requirements, **when** conclusion readiness is evaluated, **then** a pure domain evaluator checks required runs, required sources, and a non-empty limitation; **and** it returns explicit missing requirements without inspecting scene state or UI visibility.
3. **Given** my conclusion is incomplete, **when** I attempt to enter review, **then** the semantic interface explains which evidence is missing and provides a next-action path; **and** it does not permanently block, punish, or discard my work.
4. **Given** my conclusion meets the defined readiness requirements, **when** I submit it for review, **then** the store transitions through the defined case phase using a typed domain action; **and** Phaser only mirrors the resulting phase.
5. **Given** I change supporting evidence, the conclusion text, or its limitation, **when** readiness is evaluated again, **then** the result reflects the authoritative current evidence state; **and** the evaluator remains deterministic and independently unit-testable.
6. **Given** the theory board implementation, **when** tests run, **then** unit tests cover every missing-evidence combination and valid readiness; **and** integration tests use semantic roles, labels, public actions, and selectors rather than Phaser internals.

## Scope and sequencing

- Deliver the smallest reusable theory-board and evidence-readiness capability. Reuse Story 1.4 immutable run records and Story 1.5 inspected-source evidence; do **not** create parallel evidence, source, or selection stores.
- The readiness threshold comes only from the immutable authored case definition: Young currently requires two runs and two sources. Do not hard-code `2` in UI, reducers, or tests except within intentional fixtures.
- Completion/readiness is not a scoring puzzle and must never become a hard fail. A missing requirement is recoverable guidance; retain the entire draft and current selections.
- Story 1.7 owns consultation, peer-review rules, revision history, and additional hint layers. Story 2.1 owns contextual-record/prediction flow; Story 2.2 owns real Young experiment calculation; Story 2.3 owns Young debrief/replay; Story 1.8 owns persistence/export. Do not pre-build them here.
- Existing phase logic is disconnected from `AppState`. Connect it through the authoritative store in this story. Preserve the finite adjacent sequence `context → prediction → experiment → synthesis → review → debrief`; never add a scene/UI-only phase mutation, a skip, or a reverse transition to make tests convenient.
- The current application has no full semantic prediction/synthesis flow yet. Do not invent a fake completion shortcut. The theory board may expose its current phase and an actionable readiness message; review submission must remain governed by the same typed adjacent-phase rule, with integration tests preparing an authoritative synthesis state through public store actions/fixtures as appropriate.

## Tasks / Subtasks

- [ ] Create the pure conclusion-readiness domain contract (AC: 2, 5)
  - [ ] Add a focused pure module under `src/domain/theory/` (for example `conclusionReadiness.ts`); do not put this logic in a DOM component, Phaser scene, store selector, or adapter.
  - [ ] Define immutable, typed theory-board draft/support state: selected run IDs, selected source IDs, conclusion text, and limitation text. Keep it separate from notebook comparison selection; a comparison pair is not automatically conclusion support.
  - [ ] Implement `evaluateConclusionReadiness(definition, authoritativeEvidence, draft)` (exact names may vary). It must derive readiness solely from explicit inputs: authored `minimumRuns`/`minimumSources`, recorded runs, inspected source IDs, selected support, and trimmed limitation. Return a discriminated immutable result with `ready`/`incomplete` and stable, explicit missing-requirement codes/messages suitable for semantic UI.
  - [ ] Treat blank or whitespace-only limitations as missing. Validate selected IDs against current authoritative runs/inspected sources and report/reject unknown or duplicate selections deterministically. Never mutate a `RunRecord`, source record, or authored case definition.
  - [ ] Keep conclusion text editable and preserve it even though this story's minimum readiness gate is run/source/limitation based. Do not infer readiness from a Phaser scene, DOM visibility, click history, timestamps, browser APIs, or an external service.

- [ ] Make phase and theory-board state authoritative store state (AC: 2–5)
  - [ ] Update `src/core/store/AppState.ts`, `AppAction.ts`, and `selectors.ts`. Add one frozen authoritative theory-board state and one authoritative phase representation; do not retain an unsynchronised `AppState` phase plus standalone `CaseProgress` phase.
  - [ ] Refactor/reuse `src/domain/cases/CaseProgress.ts` and `caseReducer.ts` so the existing pure adjacent-phase reducer remains the single phase-transition rule. The store must call it; it must not be bypassed by UI or Phaser.
  - [ ] Introduce typed `noun.verb` actions for selecting/unselecting conclusion support, setting conclusion/limitation draft values, and requesting review. Use the existing discriminated-union reducer pattern. Action names must describe facts/intents, not component events.
  - [ ] On review request, evaluate current authoritative state first. If incomplete, return the typed recoverable failure/readiness result, retain all evidence and draft work, and allow `createStore` to avoid notifying subscribers. If ready, perform the legal `synthesis → review` transition through the domain phase rule and notify normally.
  - [ ] Extend `freezeState` for every new nested array/object. Preserve current controls, inspected source IDs, immutable runs, comparison state, and source eligibility behavior on both success and failure.
  - [ ] Add public selectors for phase, theory draft, selected supporting run/source records, and computed readiness. The selector/UI layer must not cache or own its own selected IDs. Never throw raw errors from reducers for player input.

- [ ] Build the semantic Theory Board surface (AC: 1, 3, 5)
  - [ ] Add `src/ui/theory/TheoryBoard.ts`, modelled on the store subscription, polite `role="status"`, neutral recovery, and rerender focus-restoration patterns in `src/ui/notebook/NotebookPanel.ts` and `src/ui/sources/CuratedRecord.ts`.
  - [ ] Render a labelled semantic region with: current phase/readiness guidance; recorded observation selection controls; inspected-source selection controls; readable run details (order, settings, timestamp, result, model version, linked evidence); source provenance labels; labelled conclusion and limitation fields; and a review-submission control.
  - [ ] Only offer authored, currently recorded runs and currently inspected, reviewed sources as selectable support. Explain unavailable/missing evidence in plain text. Do not allow an ineligible/incomplete/unavailable source to enter conclusion support, and do not retrofit a later-inspected source into an earlier historical run.
  - [ ] On an incomplete review attempt, provide the evaluator's next actionable missing requirement in a calm, polite status message. Do not clear inputs, disable the player permanently, say that a choice is wrong, imply a correct conclusion, or auto-solve the investigation.
  - [ ] Use stable `data-*` focus keys and element lookup for focus restoration; never interpolate authored IDs into CSS selectors. Preserve keyboard focus after rerenders, including rejected selection/review actions.
  - [ ] Compose the panel from `src/main.ts`, add a dedicated `#theory-board` mount after the measurement notebook in `index.html`, and extend the paper-panel/responsive styles in `public/style.css`. Keep 44×44 CSS-pixel interactive targets, visible 2px+ focus treatment, 4.5:1+ text contrast, sequential narrow layout, and `prefers-reduced-motion` behavior.

- [ ] Keep Phaser as a projection only (AC: 4)
  - [ ] Do not add theory-board state, readiness calculation, conclusion entry, source selection, or phase authority to Phaser scenes, renderer, or `PhaserStoreAdapter`.
  - [ ] If the current phase needs a visible laboratory reflection, subscribe to the store and render it in the existing Phaser renderer lifecycle only. Update scene/render code only where necessary; it must read selectors/state and clean subscriptions on shutdown.
  - [ ] Preserve Story 1.3's single DOM/Phaser apparatus-control intent path, semantic announcements, phone laboratory read-only behavior, and renderer lifecycle cleanup.

- [ ] Cover the domain, store, UI, and browser contracts (AC: 2–6)
  - [ ] Add focused Vitest coverage for the evaluator: each individual missing prerequisite; all combined missing states; valid readiness; whitespace limitation; source/run selection changes; conclusion/limitation changes; determinism; and immutable inputs/outputs.
  - [ ] Extend `tests/unit/EvidenceStore.test.ts` (or add a narrowly scoped store spec) for typed theory actions, unknown/duplicate support rejection, retained draft after failed review, adjacent phase enforcement, correct `synthesis → review` success, frozen state, and no subscriber notification after rejected actions.
  - [ ] Add `tests/integration/TheoryBoard.test.ts` using only public actions and selectors. Verify support selection, explicit readiness recovery, review transition, and preservation of existing runs, linked evidence snapshots, source state, and notebook comparison state.
  - [ ] Add `tests/e2e/theory-board.spec.ts` using `getByRole`/`getByLabel`: semantic board fields, keyboard selection, focus restoration, polite incomplete guidance, and a valid review submission flow. Do not assert canvas pixels, Phaser private fields, or incidental DOM structure.
  - [ ] Extend `tests/e2e/accessibility.spec.ts` with an Axe scan of the exposed Theory Board after it reaches the intended state. Manually verify keyboard-only operation, focus recovery, screen-reader announcements, non-colour understanding of scientific/provenance information, and responsive touch target sizing; Axe alone is insufficient.
  - [ ] Run the existing unit, integration, production-build, cached/offline, Curated Record, notebook, dual-surface parity, and Chromium/Firefox/WebKit Playwright regressions. Do not loosen prior public assertions.

## Dev Notes

### Required data flow

```text
immutable case requirements + authoritative runs/inspected sources + frozen theory draft
  → pure conclusion-readiness evaluator
  → public selectors
  → semantic Theory Board / neutral next-action status
  → typed review intent
  → pure adjacent phase transition in authoritative store
  → optional Phaser phase projection
```

### Architecture and guardrails

- `src/domain/` is pure TypeScript. It must not import Phaser, DOM, browser storage, `fetch`, `Date`, `crypto`, or adapters. Expected/recoverable failures use the existing typed `Result` convention; reducers never throw for incomplete player work.
- `AppState` is the only mutable authority. UI and Phaser may dispatch typed actions/read selectors but may not mutate each other, the store, case content, source evidence, or phase directly.
- `public/cases/young-interference/case.json` already provides the frozen requirements (`minimumRuns: 2`, `minimumSources: 2`). Do not expand the case schema or add a second content boundary unless a new authored field is demonstrably required by an acceptance criterion.
- Existing runs are immutable historical snapshots: controls, calculated result, timestamp, experiment model version, and linked evidence IDs must remain unchanged. Theory selection references these records; it does not recompute results or backfill linked evidence.
- Existing inspected-source state is safety-critical: only reviewed sources can be inspected; unknown, duplicate, unavailable, or rights-incomplete sources must not become evidence. Reuse its selector/reducer boundary.
- No account, telemetry, analytics, backend, remote configuration, external critical-play integration, freeform physics, scoring, speed pressure, irreversible choice, or unreviewed historical claim/asset is permitted.

### Files to read and update deliberately

| Path | Responsibility for this story |
| --- | --- |
| `src/domain/cases/CaseDefinition.ts` | Read the frozen `requirements` contract; do not duplicate its thresholds. |
| `src/domain/cases/CaseProgress.ts`, `src/domain/cases/caseReducer.ts` | Reuse/refactor the existing pure finite phase sequence into the store transition path; preserve adjacent-only transitions. |
| `src/domain/evidence/RunRecord.ts` | Preserve immutable historical evidence snapshots; never calculate historical output from live state. |
| `src/core/store/AppAction.ts`, `AppState.ts`, `selectors.ts`, `createStore.ts` | Add typed/frozen theory and phase state while retaining successful-transition-only notification semantics. |
| `src/ui/notebook/NotebookPanel.ts`, `src/ui/sources/CuratedRecord.ts` | Follow established semantic status and focus patterns; do not couple or replace their existing state. |
| `src/main.ts`, `index.html`, `public/style.css` | Mount/style the semantic board without removing existing shell, control, Curated Record, notebook, or cached-launch elements. |
| `src/adapters/phaser/*` | Read before any change; projection only, no new authority. |
| `tests/unit/EvidenceStore.test.ts`, `tests/integration/*`, `tests/e2e/*` | Extend public-contract coverage without loosening prior regression expectations. |

### Previous-story intelligence

- Story 1.5 established strict immutable source records, a single Vite-base-aware `loadCaseDefinition` safe-parse/freeze boundary, authoritative `source.inspected`, and semantic source cards. Reuse those selectors and evidence IDs; do not fetch/parse source data from the board.
- Its review fixes are non-negotiable: validate linked evidence against inspected state, display provenance references, avoid authored IDs in CSS selector interpolation, retain neutral recovery for ineligible sources, and keep fixtures compliant with the strict source contract.
- Story 1.4 established immutable run snapshots, notebook comparison, public selectors, collision-safe pair keys, semantic status/recovery, and rerender focus restoration. Theory-board selections must not repurpose comparison state or alter historic records.
- Story 1.3 established identical DOM/Phaser control outcomes. Do not alter the shared apparatus intent path or move accessibility behavior to the canvas.

### Library and current technical requirements

- Stay on project-pinned versions: Phaser `4.2.1`, TypeScript `~5.7.2`, Vite `8.1.5`, Zod `4.4.3`, `idb` `8.0.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`. This story needs no dependency upgrade or new framework.
- Retain Zod `safeParse` at the existing content boundary; the official Zod v4 package supports the project’s `safeParse` pattern. [Source](https://zod.dev/packages/zod)
- Phaser scenes have distinct lifecycle states; renderer/store subscriptions must continue to be created/cleaned through the existing lifecycle, rather than owning scientific progression. [Source](https://docs.phaser.io/phaser/concepts/scenes)
- Use Axe in Playwright after the board is exposed in its interactive state, then manually assess gaps that automated scanning cannot detect. [Source](https://playwright.dev/docs/accessibility-testing)

### Project Context Rules

- Semantic HTML owns theory-board controls, source inspection, conclusion entry, focus, and announcements. Colour and sound cannot be the sole scientific-information channel.
- Maintain desktop-browser support and equivalent tablet input outcomes; phones remain laboratory read-only. The semantic board remains readable and keyboard-operable.
- Use PascalCase for component/type files, camelCase for non-class modules/functions/properties, `UPPER_SNAKE_CASE` for constants, camelCase JSON fields, kebab-case case IDs/assets, and `noun.verb` typed actions/events.
- Keep `update()` free of domain evaluation, browser IO, JSON parsing, DOM manipulation, logging, and transient allocation. The readiness evaluator runs only through explicit state/action/selector paths, never every frame.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.6; FR12–FR16; NFR6–NFR13]
- [Source: `_bmad-output/game-architecture.md` — Evidence-to-Conclusion Gate, State Management, User Interface and Rendering Boundary, Architectural Boundaries, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Engine-Specific Rules, Code Organization, Testing, Platform, and Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay Loop, Primary Mechanics, Win/Loss Conditions, Controls and Input]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/reconcile-gdd.md` — carried-forward accessibility and evidence-led UX spines]
- [Source: `_bmad-output/implementation-artifacts/1-4-measurement-notebook-and-run-comparison.md` — immutable run, comparison, semantic notebook, and review-fix contracts]
- [Source: `_bmad-output/implementation-artifacts/1-5-curated-record-and-source-labels.md` — inspected-source authority, source safety, focus/recovery, and regression contracts]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete epic, GDD, architecture, project-context, UX reconciliation, previous-story, current-code, git-history, and official technical-documentation review.
- Parallel GDD/UX and code/history analysis identified the essential constraints: bounded evidence reasoning, semantic accessibility, immutable evidence reuse, and currently disconnected phase logic that must become store-authoritative.
- Validation checklist applied: tasks prevent duplicate evidence/selection stores, UI/Phaser-owned readiness, phase skips, historical-run mutation, unsafe source support, and regressions to notebook/Curated Record/dual-surface controls.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- The story is deliberately incremental: it establishes a reusable pure readiness gate and semantic board now while reserving prediction, peer-review/history, debrief/replay, persistence, and full Young simulation for their dedicated stories.

### File List

- `_bmad-output/implementation-artifacts/1-6-evidence-to-conclusion-theory-board.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

## Change Log

- 2026-08-04: Ultimate context engine analysis completed - comprehensive developer guide created; status set to ready-for-dev.

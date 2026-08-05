---
baseline_commit: 1740311a42a21923b9ca7f27f9aeaeb2d2afc959
---

# Story 2.2: Young double-slit experiment

Status: ready-for-dev

## Story

As a player,
I want to set slit spacing and screen distance and observe the resulting fringe spacing,
so that I can test how each variable affects the interference pattern.

## Acceptance Criteria

1. **Given** the Young case definition, **when** the laboratory loads, **then** slit spacing permits **0.10–0.50 mm** in **0.05 mm** steps and screen distance permits **1.0–4.0 m** in **0.25 m** steps; **and** each control is available through the shared dual-surface interaction path.
2. **Given** a valid configuration, **when** I run the apparatus, **then** a deterministic **550 nm** model produces and records fringe spacing within three seconds; **and** reset is immediate and does not erase saved observations.
3. **Given** I choose the optional advanced wavelength comparison after the minimum Young path, **when** I select one of the authored wavelength values, **then** the value, result, and versioned deterministic-model inputs are recorded with the run; **and** wavelength remains optional and cannot alter the fixed-550-nm minimum-path history.
4. **Given** DOM and Phaser interactions, **when** they set the same Young configuration, **then** the resulting run record is identical; **and** unit and integration tests cover the calculation and input parity.

## Tasks / Subtasks

- [ ] Replace the prepared-observation seam with the pure Young model (AC: 2, 3, 4)
  - [ ] Add a focused pure module under `src/domain/apparatus/` (for example, `calculateYoungFringeSpacing.ts`). It must have no Phaser, DOM, browser, clock, UUID, persistence, or store imports.
  - [ ] Calculate adjacent fringe spacing with the authored small-angle model: `fringeSpacingMm = (wavelengthNm * 1e-3 * screenDistanceM) / slitSpacingMm`. Convert inputs only at the calculation boundary: wavelength is nm, screen distance is m, slit separation is mm, and the returned value is mm. The baseline 550-nm equivalent is `0.55 * screenDistanceM / slitSpacingMm`; the defaults (0.25 mm, 2 m) must return **4.4 mm** before the chosen stored-display rounding policy.
  - [ ] Define one deterministic output precision/rounding rule in the calculator and persist the resulting number, unit, label, complete model-input snapshot, and model version in the run. Never derive a notebook/theory/print value by recalculating a saved run.
  - [ ] Replace `calculatePreparedObservation` in `src/main.ts`; the semantic production path must no longer create `Prepared observation` / `relative units` records. UUID and timestamp creation remain at composition/browser boundaries, while the calculator and record validation stay pure.
  - [ ] The run action must be authoritative: it may execute only in the `experiment` phase, use the currently validated store configuration, and reject a stale/malformed/mismatched calculated record with a typed neutral `Result` while preserving existing state. Phaser and DOM must never decide progression or independently calculate a different result.

- [ ] Extend the immutable authored Young experiment contract deliberately (AC: 1, 3)
  - [ ] Update `public/cases/young-interference/case.json`, `src/domain/cases/CaseDefinition.ts`, and `src/schemas/CaseDefinitionSchema.ts` together. Preserve strict Zod validation and repository-only loading; do not put player selections in case JSON.
  - [ ] Keep the two existing primary controls exactly as authored. Add a separate bounded optional wavelength-comparison configuration to the immutable experiment definition: fixed minimum-path wavelength **550 nm** and advanced choices **450 nm** and **650 nm**. These are an explicit story-level authoring decision because the planning artifacts require authored values but do not name them; present them as model inputs, not new historical claims.
  - [ ] Keep 550 nm as the initial/reset selection. The advanced selector/action is unavailable until at least two saved fixed-550-nm Young runs exist. It must not be needed to reach synthesis, review, or debrief, and later changing it cannot mutate prior fixed-path records.
  - [ ] Keep the existing authored assumptions, confound, reset path, sources, and phase flow. Surface the model assumptions in semantic text beside the result; do not invent source excerpts, physics claims, a sandbox, or an unbounded wavelength input.

- [ ] Make the active setup, reset, and saved snapshots authoritative (AC: 2, 3)
  - [ ] Extend the single deeply frozen `AppState`, `AppAction.ts`, reducers, selectors, and freeze/hydration paths with narrowly typed experiment-selection/run/reset actions. Continue using `apparatus.controlSet` for both primary controls; do not create per-surface state or a second store.
  - [ ] Add a typed reset action that immediately restores both primary controls to their authored defaults and the current selection to fixed 550 nm. It must preserve `runs`, comparison selections/notes, inspected sources, prediction, theory draft, decision history, consultations/review projections, and recognition unless an existing successful-evidence-edit rule explicitly says otherwise. Reset is recoverable, not a hard fail.
  - [ ] Model every saved physical run as an immutable snapshot including slit spacing, screen distance, wavelength, wavelength mode (`minimum` or `advanced`), calculated fringe spacing, timestamp, and experiment-model version. Do not hide wavelength in transient UI state or infer it later from the current case definition.
  - [ ] Decide and document the record type cleanly: either widen the immutable `RunRecord` controls to include a dedicated model-input snapshot, or add a named immutable `modelInputs` field. Update all consumers consistently; do not overload labels or leave an unvalidated `Record<string, number>` escape hatch.
  - [ ] Preserve the current store invariant: failed reducers leave the exact state unchanged and do not notify subscribers; successful records clear only the same stale projections that the existing evidence-edit pattern clears.

- [ ] Preserve portable progress and historical-run integrity (AC: 2, 3)
  - [ ] Update `CaseRecordProjection.ts`, `CaseRecordSchema.ts`, `createAppStateFromCaseRecord`, and any notebook/theory/print projections to carry the complete run snapshot end-to-end.
  - [ ] Bump the portable-record schema only if required by the new field, then add an explicit supported migration from the current schema v2. Safely inferred legacy fixed-wavelength input may be recorded as 550 nm only where it is actually known; never replace a stored result, timestamp, or model version with a newly calculated value.
  - [ ] Account for the strict current `caseDefinitionVersion` and `experimentModelVersion` compatibility checks before changing a case/model version. Define a compatibility policy that keeps old snapshots inspectable or rejects them as a typed recoverable import/restore result without overwriting the last valid local record. Do not silently strand all saved progress after the contract update.
  - [ ] Treat legacy `Prepared observation` records as pre-model data rather than passing them off as physical Young measurements. Preserve valid portable data according to the compatibility policy, but do not count a non-physics placeholder as an eligible fixed-550-nm run for the advanced gate or evidence completion.
  - [ ] Failed migration, import, validation, or save must retain the last valid in-memory/local progress and show neutral semantic recovery text—never raw errors or learner data.

- [ ] Deliver the complete accessible dual-surface laboratory (AC: 1, 2, 4)
  - [ ] Refactor `src/ui/apparatus/ApparatusControls.ts` so it renders both authored primary controls from the definition. Each control must retain native labelled input/stepper semantics, current value and unit, min/max/step instructions, ArrowUp/ArrowDown behavior, focus restoration, and an initially empty polite status region. Do not hard-code only slit spacing.
  - [ ] Add an explicit semantic **Run experiment** action, readable fringe-spacing result, formula/model-assumption explanation, and **Reset apparatus** action. A successful run is immediate deterministic work (therefore within three seconds); do not introduce timers, per-frame calculation, loading spinners, or artificial delay. Results and recovery announcements must not move focus.
  - [ ] Add the advanced wavelength selector as semantic HTML with its own label, current value/unit, availability explanation, and polite status. It is optional—not a canvas-only gesture—and must remain disabled/unavailable until the two fixed runs are saved.
  - [ ] Extend `ApparatusRenderer.ts`, `PhaserStoreAdapter.ts`, and only the necessary scene wiring so Phaser mirrors both primary controls and their shared `apparatus.controlSet` intents. It may visualize the resulting pattern but may not own run records, model inputs, selection, reset, accessibility status, or phase rules. Keep the canvas `aria-hidden`.
  - [ ] Preserve the existing phone read-only behavior at `max-width: 767px` for every laboratory interaction, and maintain keyboard/pointer/touch equivalence at tablet/desktop widths. Clean up all scene subscriptions, input handlers, display objects, and resize listeners at `shutdown`; Phaser scenes can restart.
  - [ ] Add only focused UI/CSS roots needed for the experiment surface. Follow the UX spines: labelled numeric values, non-colour result meaning, 44px touch targets, visible focus, no score/correctness language, `prefers-reduced-motion`, and no essential sound.

- [ ] Update evidence presentation and regression coverage (AC: 2, 3, 4)
  - [ ] Update `NotebookPanel.ts`, `TheoryBoard.ts`, `CaseRecordPrintView.ts`, and relevant selectors so every saved run exposes its exact model inputs, fringe-spacing result, unit, timestamp/order, and model version. Historical entries remain stable after subsequent control/wavelength/reset changes.
  - [ ] Update all affected fixtures rather than relying on generic relative-unit observations. Any remaining fixture seam must be clearly non-production and must not weaken validation of the real calculation path.
  - [ ] Add Vitest table coverage for default, both ends of each primary-control range, advanced wavelengths, unit conversion, expected monotonic relationships (larger screen distance/wavelength → larger spacing; larger slit spacing → smaller spacing), finite/malformed input rejection, and deterministic rounding.
  - [ ] Add unit/store coverage for experiment-phase gating, immutable input snapshots, reset preservation, advanced-wavelength gate, no-origin effect, migration/compatibility, failed save/import recovery, and deep freezing.
  - [ ] Extend integration coverage so the exact same controlled UUID/timestamp/configuration set through DOM and Phaser paths produces byte-identical run records/results for **both** primary controls. Assert public actions/selectors, not Phaser private fields or pixels.
  - [ ] Update Playwright flows that currently record before prediction: establish both inspected sources → saved prediction → authoritative transition to `experiment` first. Cover both labels/ranges/steps/readouts/statuses, keyboard focus, pointer and touch parity, accessible result/assumption text, run/record, reset retention, advanced gating/selection, reload/export/import/offline persistence, and axe after the new semantic UI is exposed.
  - [ ] Verify proportionately with `npm run typecheck`, `npm test`, `npm run build`, relevant Chromium E2E/axe/offline suites, and `npm run test:e2e:cross-browser` when browsers are available. Manually verify keyboard-only flow, screen-reader announcements, non-colour interpretation, zoom/text scaling, tablet touch, reduced motion, and the 10-minute 1280×720 low-end-laptop performance target.

## Dev Notes

### Story boundaries and sequence

- This story owns the bounded Young experiment: exact primary controls, deterministic fringe-spacing calculation, recorded scientific inputs/results, reset, and optional advanced wavelength comparison. It completes FR7 and FR8 and supplies physical evidence for Story 2.3.
- Story 2.1 is complete and already owns the prerequisite context/prediction gate. Preserve its path: `context → prediction → experiment`; Story 2.2 may run only after the store has authoritatively entered `experiment`. Story 2.3 owns comparison-led synthesis, conclusion, debrief, and replay—not this story.
- The Young slice is a 20–30 minute evidence investigation. It requires two-to-four experiment cycles but must not become a freeform physics sandbox, an optimization game, a scored activity, or a hard-fail state.

### Physics and authored-model contract

- Use the small-angle adjacent-fringe model \(\Delta y = \lambda L / d\). OpenStax derives double-slit constructive interference from \(d\sin\theta=m\lambda\); the story model uses the standard far-screen approximation to expose adjacent spacing. [Source: OpenStax, *Understanding Diffraction and Interference*](https://openstax.org/books/physics/pages/17-1-understanding-diffraction-and-interference)
- The model is educational, deterministic, bounded, and inspectable. Its existing assumptions—monochromatic light plus narrow, identical slits—must be visible with the result. Do not simulate particles/physics or overstate the result as proof.
- Minimum path: fixed 550 nm, primary controls only, at least two saved runs before advanced comparison becomes selectable. Advanced options: 450 nm and 650 nm, chosen here because upstream artifacts require authored options but name none. Retain the chosen wavelength/mode inside every advanced record.
- Do not recalculate a historical record against later code/case data. The stored output plus model input/version are the scientific record.

### Current code intelligence — read before editing

**UPDATE — model and record seam**

- `src/main.ts` currently injects `calculatePreparedObservation`, which always yields `Prepared observation: 1 relative units`; replace this composition seam with the pure Young calculator. `src/domain/evidence/RunRecord.ts` already validates immutable IDs, timestamps, controls, results, versions, and linked evidence, but currently has no wavelength/model-input field.
- `src/core/store/AppState.ts`, `AppAction.ts`, `createStore.ts`, and `selectors.ts` are the sole immutable state boundary. Existing `run.record` accepts a prepared record; extend it so the production result cannot be stale or mismatched with active validated configuration. Preserve successful-only subscriber notifications.
- `src/core/store/CaseRecordProjection.ts`, `src/schemas/CaseRecordSchema.ts`, `src/schemas/migrations/migrateCaseRecord.ts`, and `createAppStateFromCaseRecord` currently preserve schema-v2 player records. Strict version matching is a regression risk when changing the case/model contract; read all of them before selecting the migration policy.

**UPDATE — current laboratory and presentation**

- `src/ui/apparatus/ApparatusControls.ts`, `src/adapters/phaser/renderers/ApparatusRenderer.ts`, and `PhaserStoreAdapter.ts` presently expose only `slitSpacingMm`, despite both authored primary controls being in case content. Extend these components; do not create a parallel screen-distance implementation.
- `src/ui/notebook/NotebookPanel.ts`, `src/ui/theory/TheoryBoard.ts`, and `src/ui/print/CaseRecordPrintView.ts` already render results/history. Update them to render the stored snapshot, never a fresh calculation.
- `src/adapters/phaser/scenes/LaboratoryScene.ts` subscribes and cleans up at `shutdown`. Retain that lifecycle pattern; add no domain logic to `update()`.
- `index.html` and `public/style.css` provide the semantic roots and responsive/reduced-motion baseline. Keep semantic app surfaces primary and canvas visual-only.

**UNCHANGED foundations**

- Only `src/adapters/content/loadCaseDefinition.ts` may fetch/parse `public/cases/young-interference/case.json`; Zod must validate before domain use. Shipped content/assets remain immutable after loading; player progress belongs only in IndexedDB/portable records.
- Reuse `normalizeControlValue` from `src/domain/apparatus/ApparatusControl.ts` for authored primary-control range/step normalization. Use `noun.verb` typed actions, constructor injection, and focused domain modules—never generic `services/`, `helpers/`, or `managers/`.
- Keep no backend, account, telemetry, analytics, cloud save, remote configuration, external critical-play dependency, raw learner-text logging, new package, or package upgrade.

### Architecture and UX guardrails

- One-way flow is mandatory: semantic HTML or Phaser gesture → typed action → pure immutable store/domain result → selectors/subscriptions → DOM and Phaser projections. `origin` is diagnostics-only; it must not affect scientific result or progression.
- `src/domain/` cannot import Phaser, DOM, `fetch`, IndexedDB, or browser APIs. Repositories alone fetch/validate content; adapters alone perform browser effects. No per-frame calculations, DOM work, storage, JSON parsing, logging, or transient allocations.
- Semantic HTML owns controls, values/units, instructions, result, model assumptions, focus, and announcements. Visual patterns must have labelled numerical/text equivalents; colour/sound are never sole meaning carriers.
- Use native controls and an initially present `role="status"` / polite live region for non-urgent result/recovery updates; do not focus the status region. [Source: MDN, *ARIA status role*](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role)
- Each Phaser shutdown must release resources because a shutdown scene may later restart. [Source: Phaser, *Scene shutdown event*](https://docs.phaser.io/api-documentation/4.0.0/event/scenes-events)
- Test UI through semantic roles/labels and public selectors/actions; Playwright recommends user-facing locators. Axe is necessary automated coverage but does not replace manual assistive-technology checks. [Source: Playwright, *Locators*](https://playwright.dev/docs/locators), [*Accessibility testing*](https://playwright.dev/docs/accessibility-testing)

### Project Structure Notes

- Expected new production module: `src/domain/apparatus/calculateYoungFringeSpacing.ts` (or an equivalently focused camelCase module in that domain). Do not create a generic calculation/service layer.
- Expected updates: `public/cases/young-interference/case.json`; `src/domain/cases/CaseDefinition.ts`; `src/schemas/CaseDefinitionSchema.ts`; `src/domain/evidence/RunRecord.ts`; `src/core/store/AppAction.ts`, `AppState.ts`, `selectors.ts`, `CaseRecordProjection.ts`; `src/schemas/CaseRecordSchema.ts`, `src/schemas/migrations/migrateCaseRecord.ts`; `src/ui/apparatus/ApparatusControls.ts`, `src/ui/notebook/NotebookPanel.ts`, `src/ui/theory/TheoryBoard.ts`, `src/ui/print/CaseRecordPrintView.ts`; `src/adapters/phaser/PhaserStoreAdapter.ts`, `renderers/ApparatusRenderer.ts`, `scenes/LaboratoryScene.ts`; `src/main.ts`; and focused test files. Modify `index.html`/`public/style.css` only for the semantic experiment surface.
- Maintain PascalCase class/component filenames, camelCase non-class modules/functions/properties, `UPPER_SNAKE_CASE` constants, camelCase JSON, and kebab-case case/assets.

### Previous Story Intelligence and Git History

- Story 2.1 (`2-1-young-contextual-record-and-prediction.md`) is done. Its review corrected legacy phase migration, required inspected context before prediction, synchronized imported drafts, and updated v2 export coverage. Do not reintroduce those failures.
- Recent commits are `c666076` (story), `2b769ec` (development), and `1740311` (review). Their pattern is narrow, test-backed, semantic-first work built around public state/actions—not renderer-owned behavior or new dependencies.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2; Epic 1 Stories 1.2–1.9]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay Loop; Apparatus calibration; Experimental run; Controls and Input; Puzzle Game Specific Design]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — Apparatus control and experiment-result specifications]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Laboratory flow, State Patterns, Accessibility Floor, Game Feel]
- [Source: `_bmad-output/game-architecture.md` — Deterministic Experiment Record; Dual-Surface Interaction; State Patterns; Phaser Object Patterns; Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Engine-Specific, Performance, Organization, Testing, Platform, and Critical Don’t-Miss Rules]
- [Source: `public/cases/young-interference/case.json`, `src/main.ts`, `src/domain/evidence/RunRecord.ts`, `src/core/store/AppState.ts`, `src/ui/apparatus/ApparatusControls.ts`, `src/adapters/phaser/renderers/ApparatusRenderer.ts` — current implementation seams to extend]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete sprint status, epics, GDD, architecture, UX spines, project context, Story 2.1, current code/test seams, Git history, and current technical guidance were analyzed.
- The developer guide explicitly closes the missing authored-wavelength and run-snapshot decisions, and calls out record-version compatibility so implementation does not silently corrupt or strand learner evidence.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/2-2-young-double-slit-experiment.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Story 2.2 status)

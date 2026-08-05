---
baseline_commit: f40373f19ff96043bed2ce45663cb92e0bc4846d
---

# Story 2.3: Young synthesis, debrief, and replay

Status: done

## Story

As a player,
I want to compare Young runs, submit a limited conclusion, and read a sourced debrief,
so that I understand both what interference evidence supports and its limits.

## Acceptance Criteria

1. **Given** I have two recorded Young configurations, required sources, and a stated limitation, **when** I submit my conclusion, **then** the evidence evaluator permits review and the debrief phase, **and** feedback distinguishes supported inference from overclaiming.
2. **Given** the debrief is displayed, **when** I read it, **then** it provides a sourced historical comparison and optional deeper theory, **and** it does not rewrite historical outcomes around player choices.
3. **Given** I complete Young, **when** I replay it, **then** previous completion remains recorded while a new investigation can be run, **and** recognition reflects inquiry actions rather than speed.
4. **Given** a Young replay or alternate configuration, **when** it explores a different variable or evidence-collection order, **then** it is explicitly labelled counterfactual and distinct from the recorded historical result, **and** it preserves the completed historical record and campaign unlock state.

## Tasks / Subtasks

- [x] Make synthesis-to-debrief completion authoritative and evidence-bounded (AC: 1)
  - [x] Extend the existing pure readiness/evaluation path; do not infer completion from a visible panel, scene transition, or dialogue branch.
  - [x] Require two *model-backed, distinct* Young configurations, two reviewed inspected sources, selected supporting evidence, a non-blank conclusion, and a stated limitation. The critical Young path also requires an intentional saved comparison of the two selected run snapshots; give neutral recovery guidance for each missing prerequisite.
  - [x] Reuse `evaluateConclusionReadiness`, `evaluatePeerReview`, typed `AppAction`s, immutable `AppState`, and selectors. Extend them narrowly rather than creating duplicate completion, review, or comparison logic.
  - [x] Preserve the current non-punitive peer-review model: it reports missing evidence, unavailable support, and authored overreach phrases; it must not provide the conclusion, hard-fail a draft, erase work, or block unlimited revision.
  - [x] Permit the authoritative `review → debrief` transition only after a reviewed revision has been saved. Capture the final reviewed decision, supporting run/source IDs, peer feedback, recognition, and completion timestamp as an immutable completion snapshot.

- [x] Author and validate the historical debrief contract (AC: 2)
  - [x] Extend the immutable `CaseDefinition` contract, Zod definition schema, and `public/cases/young-interference/case.json` together. Add only the focused data needed for: a source-resolved historical comparison, layered optional deeper theory, and counterfactual/replay labels.
  - [x] Keep historical copy fact-bound and provenance-aware. Every debrief source reference must resolve to an existing reviewed contextual artifact; do not invent a quotation, source excerpt, rights status, or historical claim.
  - [x] Clearly separate: the learner's evidence-bounded inference; the fixed historical record; any reconstruction/interpretation; and an alternate replay. The learner's variables, conclusion, or evidence order must never alter the historical narrative.
  - [x] Keep fixed 550 nm evidence as the minimum path. The optional 450/650 nm comparison remains optional and must never rewrite or become a prerequisite for the historical record or case completion.

- [x] Build semantic debrief, completion, and replay surfaces (AC: 2, 3, 4)
  - [x] Add a focused semantic HTML `HistoricalDebriefPanel` (or equivalently named component under `src/ui/debrief/`) and mount it from `src/main.ts`/`index.html`. Phaser may mirror a non-essential transition only; it must not own debrief text, completion, replay state, focus, announcements, or progression.
  - [x] Render the completed evidence snapshot, sourced historical comparison, optional deeper-theory disclosure, inquiry recognition, and a clearly named replay action. Use native semantic controls, stable IDs/labels, an initially present polite status region, visible focus restoration, and no focus move to status updates.
  - [x] Present peer feedback as calm scope/evidence guidance, not a red failure state, score, "correct" answer, speed reward, or celebratory burst. Preserve keyboard, pointer, and touch parity; colour, sound, Phaser canvas, or motion must not be the sole carrier of meaning.
  - [x] On replay, retain the immutable completed snapshot, decision history, recognition at completion, and any existing campaign unlock state. Start a separate fresh investigation workspace at `context`; label all new configuration/order exploration **Counterfactual replay — not the recorded historical result**. Do not mutate shipped case content, historical run snapshots, or completion data.
  - [x] Retain the current phone reading-only behavior below 767px, 44px touch targets where applicable, responsive tablet/desktop layout, reduced-motion behavior, and semantic print/export surfaces.

- [x] Persist, migrate, validate, export, and print the new state safely (AC: 3, 4)
  - [x] Update `CaseRecordProjection`, `CaseRecordSchema`, and `migrateCaseRecord` with an explicit schema-version migration for existing valid v2 local/exported records. Migration/import/save failure must preserve last valid in-memory and IndexedDB progress and show neutral recovery text—never raw errors or learner-entered conclusion text.
  - [x] Validate all snapshot/run/source references, chronology, debrief eligibility, replay state, and derived recognition against the current immutable case definition. Reject a record that bypasses the evaluator, alters saved runs/results/model versions, claims an unknown source, or treats a legacy prepared observation as physical Young evidence.
  - [x] Extend the semantic print view and portable projection so a completed record visibly preserves the historical completion snapshot and relevant decision history. Never recalculate historical experiment results from current controls or a later model version.

- [x] Cover the authoritative behaviour and release paths (AC: 1–4)
  - [x] Add Vitest coverage for every completion prerequisite, distinct-configuration/comparison requirement, phase-transition rejection, overreach feedback, immutable completion snapshot, replay isolation, record validation, and schema migration/failed-import recovery.
  - [x] Add integration coverage through public typed actions/selectors for the full Young path: inspected sources → prediction → two physical runs → comparison → bounded conclusion → peer review/revision → debrief → counterfactual replay. Assert that the original completed history, recognition, and unlock state are unchanged.
  - [x] Add Playwright coverage using semantic roles/labels for debrief content, optional deeper theory, source labels, status/focus, revision, replay label, offline reload, export/import, and print. Run axe on new surfaces, then manually verify keyboard-only flow, screen-reader announcements, non-colour encoding, zoom/text scaling, tablet touch, reduced motion, and Chromium/Firefox/WebKit where available.
  - [x] Repair affected legacy test fixtures instead of relying on `Prepared observation` or unphase-gated `run.record` seams. Use physical, phase-gated fixed-550-nm records for Young evidence; in particular inspect the unresolved Story 2.2 fixture work in `tests/unit/EvidenceStore.test.ts` and older review/theory E2E/integration fixtures.
  - [x] Verify proportionately with `npm run typecheck`, `npm test`, `npm run build`, relevant Playwright/axe/offline suites, and `npm run test:e2e:cross-browser` when the browser set is available.

## Dev Notes

### Story boundaries and dependencies

- This story completes the Young evidence loop: comparison-led synthesis, bounded conclusion/revision, historical debrief, and safe counterfactual replay. It fulfils FR9, FR10, and FR24. It does **not** implement Story 2.4's moderated validation gate, telemetry, campaign redesign, a future generic case framework, new physics, or new packages.
- Story 2.1 already owns two inspected reviewed artifacts and a recorded prediction before `experiment`. Story 2.2 owns deterministic, immutable 550 nm/optional-wavelength physical runs. Preserve both gates; synthesis must consume their authoritative records rather than reconstructing them.
- Story 1.4 owns selection and side-by-side comparison of any two saved run snapshots. Story 2.3 should extend the readiness contract to require the existing comparison evidence, not fork a second comparison UI/store.
- Story 1.6 owns theory readiness; Story 1.7 owns consultations, peer feedback, revision history; Story 1.8 owns local offline persistence/export/import/print; Story 1.9 owns non-gating inquiry recognition. Reuse these foundations.

### Current code intelligence — read before editing

**UPDATE — authoritative state and phase flow**

- `src/domain/cases/CaseProgress.ts` and `caseReducer.ts` define the only phase chain: `context → prediction → experiment → synthesis → review → debrief`. `src/core/store/AppState.ts` is the deep-frozen authority; invalid transitions are typed `Result` failures that preserve state.
- `AppState.ts` already has comparison, theory, peer-review, decision-history, and derived-recognition state. `theory.reviewRequested` evaluates pure readiness and moves `synthesis → review`; `peerReview.requested` is review-only; `revision.saved` appends chronological immutable evidence/feedback snapshots. There is currently no authoritative review-to-debrief completion action, completion archive, replay state/action, or debrief UI—add each deliberately.
- `src/domain/theory/conclusionReadiness.ts` currently verifies model-backed runs, inspected sources, conclusion, and limitation but not distinct configurations or a saved comparison note. Strengthen the existing evaluator and all consumers coherently; do not add a UI-only check.
- `src/domain/review/peerReviewRules.ts` matches the authored missing-evidence, unsupported-support, and overreach rules. `src/domain/recognition/recognitionRules.ts` derives inquiry recognition; keep it non-gating and never add speed scoring.

**UPDATE — authored content, persistence, and presentation**

- `public/cases/young-interference/case.json` currently has reviewed Young/Newton sources, two primary controls, model version `young-double-slit-v1`, authoritative consultation/review rules, and only a minimal debrief summary/source reference. Update it with the definition/schema in lockstep and keep JSON camelCase.
- `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/core/store/CaseRecordProjection.ts`, `src/schemas/CaseRecordSchema.ts`, and `src/schemas/migrations/migrateCaseRecord.ts` are the definition/progress compatibility seam. Current portable records are schema v2; retain valid v2 data through a tested migration rather than rejecting or silently overwriting it.
- `src/ui/notebook/NotebookPanel.ts` already selects two runs and saves comparison notes; `src/ui/theory/TheoryBoard.ts`, `src/ui/review/ConclusionReviewPanel.ts`, `src/ui/review/DecisionHistoryPanel.ts`, `src/ui/recognition/InquiryRecognitionPanel.ts`, `src/ui/persistence/CaseProgressPanel.ts`, and `src/ui/print/CaseRecordPrintView.ts` already expose the adjacent workflow. Extend their public semantic projections only as needed and preserve their focus/re-render patterns.
- `src/main.ts`, `index.html`, and `public/style.css` are the existing semantic roots/style baseline. Add a focused debrief root/style; do not create a parallel application shell or generic `services/`, `managers/`, or `helpers/` layer.

### Architecture, UX, and project rules

- Stack is pinned: Phaser 4.2.1, TypeScript, Vite 8.1.x, Zod 4.4.3, idb 8.0.3, Vitest 4.1.10, Playwright 1.61.1, and `@axe-core/playwright` 4.12.1. Use installed versions; add or upgrade no dependency.
- One-way flow is mandatory: semantic HTML or optional Phaser intent → typed action → pure immutable domain/store → selectors/subscriptions → DOM/Phaser projections. `origin` is diagnostics-only and cannot change progression or scientific result.
- `src/domain/` must not import Phaser, DOM, `fetch`, IndexedDB, or browser APIs. Only repositories load and validate case JSON; only adapters perform browser effects. Shipped case definitions/assets are immutable; player progress is local IndexedDB/portable JSON only.
- Semantic HTML owns controls, evidence, conclusion, debrief, focus, and announcements. Use labels, roles, value/unit text, logical reading order, visible focus, and polite non-urgent updates. Do not focus a status region after it changes. Current technical guidance confirms a Phaser scene can restart after `shutdown`, so retain renderer cleanup and do not let a debrief transition leak subscriptions or display objects.
- Do not do storage, JSON parsing, DOM work, logging, scientific calculation, or transient collection allocation in Phaser `update()`. Keep 60 FPS at 1280×720 on a representative low-end school laptop; profile before adding polish.
- No backend, account, analytics, cloud save, remote configuration, or network-critical flow. Offline reload after a successful load remains a release gate. Do not log learner-entered conclusions by default.
- Voice is calm, precise, and invitational: say what evidence or scope is missing and identify the next action. Never use hard-fail, irreversible wrong choice, raw error, pressure, score, currency, inventory, premium gate, advertising, or randomized reward.

### Previous story intelligence and git history

- Story 2.2 established the pure `calculateYoungFringeSpacing` model, phase-gated authoritative `experiment.run`, frozen model-input snapshots, two-control semantic apparatus, optional advanced wavelength gate, and saved-result projections. Keep physical records immutable and do not count legacy `Prepared observation` data as eligible Young evidence.
- Story 2.2 review patches closed phase/mismatched-record, legacy-record, advanced-gate, reset-preservation, and historical-rendering regressions. Do not reopen those paths while adding completion/replay.
- Recent commits (`d7815db` Dev 2.2, `d72c5ae` Review 2.2, `2b769ec` Dev 2.1, `1740311` Review 2.1) use narrow semantic-first changes with pure domain/reducer/schema invariants backed by unit, integration, and E2E tests. Review patches specifically catch persistence and state-invariant gaps.
- Note the Story 2.2 file still records an unresolved legacy-fixture follow-up even though sprint status marks 2.2 done. Resolve impacted fixtures as part of Story 2.3's regression work; do not regress the real calculator path to satisfy an old test seam.

### Project Structure Notes

- Expected updates: `public/cases/young-interference/case.json`; `src/domain/cases/CaseDefinition.ts` and focused pure completion/replay domain modules if needed; `src/schemas/CaseDefinitionSchema.ts`, `CaseRecordSchema.ts`, and `migrations/migrateCaseRecord.ts`; `src/core/store/AppAction.ts`, `AppState.ts`, `selectors.ts`, and `CaseRecordProjection.ts`; `src/ui/notebook/NotebookPanel.ts`, `TheoryBoard.ts`, review/history/recognition/persistence/print panels only where their projections change; `src/main.ts`, `index.html`, `public/style.css`; and focused test suites.
- Expected new semantic component: `src/ui/debrief/HistoricalDebriefPanel.ts` (or a comparably focused location). Do not add Phaser domain logic or a generic orchestration layer.
- Naming: PascalCase for classes/components and their files; camelCase for modules/functions/properties; UPPER_SNAKE_CASE constants; camelCase JSON; kebab-case case IDs/assets; `noun.verb` event/action names.

### Latest technical information

- No upgrade is required for this bounded story: follow the project-pinned stack. Current official guidance supports the existing patterns: use a pre-existing polite `status` live region for advisory updates without moving focus; free Phaser scene resources during `shutdown` because a shutdown scene may be restarted; and keep accessibility tests semantic while retaining manual assistive-technology checks. [Source: MDN ARIA status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role); [Source: Phaser Scene shutdown event](https://docs.phaser.io/api-documentation/4.0.0/event/scenes-events); [Source: Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3; Epic 1 Stories 1.4–1.9]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay Loop, Theory Board, Peer Review, Replayability, Young validation slice]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Information Architecture, State Patterns, Accessibility Floor, Young key flow]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — Peer review, provenance, evidence, non-score visual rules]
- [Source: `_bmad-output/game-architecture.md` — Evidence-to-Conclusion Gate, Deterministic Experiment Record, Dual-Surface Interaction, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — technology, engine, performance, organization, testing, platform, and critical rules]
- [Source: `_bmad-output/implementation-artifacts/2-2-young-double-slit-experiment.md` — deterministic record, 2.2 review findings, and implementation seams]
- [Source: `src/core/store/AppState.ts`, `src/domain/cases/caseReducer.ts`, `src/domain/theory/conclusionReadiness.ts`, `src/domain/review/peerReviewRules.ts`, `src/domain/recognition/recognitionRules.ts`, `src/ui/notebook/NotebookPanel.ts`, `src/ui/theory/TheoryBoard.ts` — current extension points]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: sprint status, epics, GDD, UX spines, architecture, project context, Stories 2.1–2.2, current code/test seams, Git history, and current official technical guidance were analyzed.
- The story explicitly closes the completion/replay persistence gap and the distinct-run/comparison ambiguity so implementation cannot treat a UI transition, duplicate configuration, or overwritten history as completion.
- Implemented typed, immutable completion/replay transitions, debrief contract/schema content, semantic debrief surface, schema-v3 migration, and portable completion validation.
- Verification passed: `npm run typecheck`, `npm test` (134 tests), `npm run build`, Chromium Playwright E2E, and axe accessibility suite.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- Completion is authoritative: it requires a saved reviewed revision plus distinct physical Young support and a saved comparison before freezing the historical snapshot.
- Replay uses a separate counterfactual workspace while preserving the original completion archive, decision history, completion-time recognition, and sourced historical debrief.
- Added schema-v3 portable records with explicit v2 migration and validation of archived scientific results, history, references, chronology, replay state, and recognition.

### File List

- `_bmad-output/implementation-artifacts/2-3-young-synthesis-debrief-and-replay.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Story 2.3 status)
- `index.html` (semantic debrief root)
- `public/cases/young-interference/case.json` (sourced historical debrief content)
- `public/style.css` (debrief and counterfactual replay styles)
- `src/core/store/AppAction.ts` (completion and replay actions)
- `src/core/store/AppState.ts` (immutable completion archive and replay reducer)
- `src/core/store/CaseRecordProjection.ts` (schema-v3 completion projection)
- `src/core/store/selectors.ts` (completion and replay selectors)
- `src/domain/cases/CaseDefinition.ts` (debrief contract)
- `src/domain/review/peerReviewRules.ts` (recovery guidance coverage)
- `src/domain/theory/conclusionReadiness.ts` (distinct configuration and saved-comparison readiness)
- `src/main.ts` (debrief panel mount)
- `src/schemas/CaseDefinitionSchema.ts` (debrief contract validation)
- `src/schemas/CaseRecordSchema.ts` (completion/replay validation)
- `src/schemas/migrations/migrateCaseRecord.ts` (v2 → v3 migration)
- `src/ui/debrief/HistoricalDebriefPanel.ts` (semantic completion and replay UI)
- `src/ui/print/CaseRecordPrintView.ts` (historical completion print surface)
- `tests/e2e/debrief-replay.spec.ts` (semantic completion/replay E2E)
- `tests/e2e/progress-portability.spec.ts` (schema-v3 portability expectations)
- `tests/unit/CompletionReplay.test.ts` (completion/replay and archive-validation coverage)
- `tests/unit/CaseDefinition.test.ts` (expanded immutable debrief contract fixture)
- `tests/unit/CaseRecordRepository.test.ts` (schema-v3 fixture)
- `tests/unit/CaseRecordSchema.test.ts` (v2 migration coverage)

## Change Log

- 2026-08-05: Implemented Young synthesis, historical debrief, immutable completion archive, counterfactual replay, and schema-v3 progress migration; marked ready for review.

### Review Findings

- [x] [Review][Patch] Prevent generic phase advancement from bypassing authoritative completion [src/core/store/AppState.ts:406]
- [x] [Review][Patch] Enforce physical, distinct, compared runs before review [src/core/store/AppState.ts:422]
- [x] [Review][Patch] Restore phase-gating for every recorded observation [src/core/store/AppState.ts:205]
- [x] [Review][Patch] Persist a completed counterfactual replay coherently [src/core/store/AppState.ts:496]
- [x] [Review][Patch] Reject a completion timestamp before its reviewed revision [src/core/store/AppState.ts:483]
- [x] [Review][Patch] Validate completion-run model inputs against archived controls [src/schemas/CaseRecordSchema.ts:261]
- [x] [Review][Patch] Derive and verify archived completion recognition [src/schemas/CaseRecordSchema.ts:249]
- [x] [Review][Patch] Deep-freeze restored completion evidence [src/core/store/AppState.ts:90]

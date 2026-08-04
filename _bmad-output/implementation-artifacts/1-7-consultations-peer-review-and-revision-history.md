---
baseline_commit: e5530f8
---

# Story 1.7: Consultations, peer review, and revision history

Status: done

## Story

As a player,
I want evidence-responsive guidance and revisable peer feedback,
so that I can improve my reasoning without being given the answer or losing my decision history.

## Acceptance Criteria

1. **Given** a case definition with consultation and peer-review rules, **when** it is loaded, **then** the rules are validated case data with explicit predicates and feedback content; **and** they do not encode a scene-specific completion path.
2. **Given** my current evidence state, **when** I request a consultation, **then** the selected prompt points to a missing observation, source, alternative test, or limit; **and** it never supplies the final conclusion verbatim.
3. **Given** I submit a conclusion for peer review, **when** the review rules evaluate it, **then** feedback identifies unsupported claims, missing evidence, or overreach in neutral language; **and** it offers a revision path rather than a hard-fail state.
4. **Given** I revise a reviewed conclusion, **when** I save the revision, **then** the authoritative progress retains the prior conclusion, review feedback, revision timestamp, and current version as decision history; **and** a revision never overwrites or silently discards earlier reasoning.
5. **Given** a consultation or review rule cannot be evaluated, **when** the system handles that failure, **then** the player receives a recoverable semantic message and keeps their valid work; **and** raw errors and learner-entered conclusion text are not logged by default.
6. **Given** a player needs help, **when** a prompt is requested, **then** the case provides an in-play observation prompt, a plain-language explanation, and an optional technical/source-detail layer; **and** the structured hint path preserves the player’s final conclusion with no mandatory skip in the first case.
7. **Given** an accessibility accommodation is enabled, **when** a next step is revealed, **then** it identifies only the next actionable step; **and** it does not auto-solve the case or write the player’s conclusion.
8. **Given** a player resumes investigation, **when** they inspect assistance surfaces, **then** they can use unlimited consultations, reset, run comparison, decision-history review, and neutral auto-summaries; **and** those surfaces never punish or lock valid work.
9. **Given** consultation and review behavior, **when** tests run, **then** unit tests cover predicate selection, unsupported-claim feedback, and revision-history preservation; **and** integration tests verify the semantic consultation and revision flow through public actions.

## Scope and sequencing

- Deliver the smallest reusable, data-driven consultation, peer-review, and append-only decision-history capability on top of Story 1.6. This is **not** a free-text AI adviser, an external service, a scoring system, a completion bypass, or a new gameplay scene.
- Reuse the authoritative `AppState`, theory draft, current runs, inspected sources, comparison state, and the pure conclusion-readiness evaluator. Do not create parallel evidence, conclusion, case-progress, consultation, or history stores.
- Story 1.6 already allows a ready theory draft to request the legal `synthesis → review` transition. Preserve that action/phase rule. Story 1.7 evaluates peer-review feedback *after* review is reached; it must not infer progression from UI visibility or allow a UI/Phaser phase bypass.
- Use authored predicates and authored neutral feedback content from the immutable Young case definition. The evaluator may derive facts from authoritative evidence and the current frozen theory draft; it must not inspect the DOM, Phaser, event history, timestamp, network, local storage, or browser APIs.
- A review can flag unsupported claims, missing evidence, or overreach, but it never declares a final answer correct/incorrect, writes a learner conclusion, hides prior work, imposes a penalty, locks a valid action, or makes completion depend on taking a consultation.
- Story 1.8 owns IndexedDB persistence, reload restoration, import/export, and print. Keep this story’s history wholly in authoritative in-memory state, designed for later persistence, without adding browser storage, migrations, or export formats.
- Story 1.9 owns global recognition, audio, and wider feedback systems. Do not add achievement/reward logic, sound cues, or unrelated accessibility settings here. Story 2.1 owns the contextual prediction flow; Story 2.2 owns the real Young experiment; Story 2.3 owns final Young synthesis/debrief/replay.

## Tasks / Subtasks

- [x] Extend the validated, immutable authored case contract (AC: 1, 2, 3, 6–8)
  - [x] Extend `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, and `public/cases/young-interference/case.json` with only the types/fields consumed by this story: consultation rules, peer-review rules, and the progressive/help layers they display. Keep JSON fields camelCase, case IDs/content immutable, and schema objects strict.
  - [x] Model every rule as data with a stable ID, explicit ordered predicate(s), and authored content. A rule must identify the kind of evidence condition it evaluates (for example: missing run, missing inspected source, missing limitation, selected-support mismatch, or an authored overreach signal) and what it may reveal. Do not embed callbacks, UI strings assembled from learner text, scene names, or route/phase shortcuts in case content.
  - [x] Author the smallest complete Young fixture: consultations covering a missing observation, missing source, alternative test, and stated limitation; three progressive layers (in-play observation, plain-language, optional technical/source detail); and neutral peer-review feedback for missing evidence/unsupported support/overreach. Content must point to an observable, source, or test and must never give a final conclusion verbatim.
  - [x] Validate duplicate rule IDs, blank content, unsupported predicate kinds, missing progressive layers, invalid references to source/control/rule IDs, and any authored text that attempts to encode a phase/scene completion path. Invalid content returns the existing typed recoverable `Result` at the repository boundary before it reaches domain logic.
  - [x] Preserve every prior Young contract requirement: exactly two contextual artifacts, reviewed-source eligibility, primary apparatus controls/ranges, deterministic model/version, immutable asset manifest, two-run/two-source requirements, flow, confound/reset path, and sourced debrief. Do not loosen the existing schemas or fixtures to make the new fields convenient.

- [x] Implement pure consultation and peer-review domain contracts (AC: 2, 3, 5–8)
  - [x] Add focused pure modules under `src/domain/review/` (for example `ConsultationRule.ts` and `peerReviewRules.ts`). They may import domain/core types only; never import Phaser, DOM, `fetch`, IndexedDB, `Date`, `crypto`, adapters, or UI modules.
  - [x] Define frozen input/projection types that take the authored rules, authoritative runs, inspected sources, and the current theory draft. Implement deterministic consultation selection: only eligible authored prompts are considered; select the first applicable rule in case-authored order, then return its bounded prompt and next actionable target. Requesting it repeatedly is always allowed and must not mutate evidence or phase.
  - [x] Implement a pure peer-review evaluator returning a frozen discriminated result such as `reviewed` or recoverable `unavailable`, with stable issue codes and neutral feedback references. It must identify which supported claim/evidence condition is inadequate without echoing or logging the player’s conclusion text.
  - [x] Treat rule-evaluation impossibility as an expected `Result` failure with a safe, semantic-ready message. Preserve current draft, evidence, comparison notes, and history. Never throw raw errors for authored/user input failures.
  - [x] Keep review predicates fact-bound. A consultation/review may point to a missing observation, inspected source, alternative test, limitation, or evidence-to-claim mismatch; it cannot calculate science, create a run, mark a source inspected, mutate selections, provide the answer, or transition the case phase.
  - [x] Introduce an append-only, frozen decision-history model. Each saved entry must retain its own version number, prior/current conclusion snapshot, limitation snapshot, selected run/source ID snapshots, immutable review-feedback snapshot, and explicit timestamp supplied through the action/adapter boundary. Never derive historical entries from current mutable draft later and never backfill historical evidence.

- [x] Extend authoritative store state/actions/selectors without breaking Story 1.6 (AC: 3–5, 7–9)
  - [x] Update `src/core/store/AppAction.ts`, `AppState.ts`, and `selectors.ts`. Use typed `noun.verb` actions for consultation request, peer-review evaluation/request, and revision save; action names express an intent/fact, not a DOM event. Add frozen consultation/review projection state and append-only history only as required by the story.
  - [x] Continue to use `createStore`’s successful-transition-only notification behavior. A rejected or unavailable consultation/review/revision must leave the exact prior authoritative state intact and must not notify subscribers.
  - [x] A peer-review request must read the existing authoritative theory draft and evidence. It must preserve the established readiness/phase contract; it does not replace `theory.reviewRequested`, hard-code the two-run/two-source threshold, or turn comparison selection into conclusion support.
  - [x] Saving a revision appends a new frozen history entry rather than mutating the prior entry. Define an unambiguous first-review/revision sequence: review feedback is evaluated from the current draft; save stores that reviewed snapshot; subsequent edits keep editable current draft; each later save appends a new incremented version. Keep previous review feedback/timestamps/snapshots addressable through selectors.
  - [x] Validate all referenced run/source IDs against current authoritative evidence before writing a history snapshot. Reuse source eligibility and immutable run-record constraints. Do not accept duplicates, unknowns, unavailable/ineligible sources, or historical record mutation.
  - [x] Expose selectors for the current consultation result, current peer-review result, and decision history. UI code reads these public selectors only; it must not independently determine predicate eligibility, calculate feedback, copy history, or cache selected IDs.
  - [x] Do not put player-entered conclusion text in default logs, diagnostics, event payloads, or recoverable messages. If a stable diagnostic is needed, log only a `noun.verb` event name, rule/result code, case ID, and schema version under the existing local-development policy.

- [x] Build the semantic assistance, review, and history surface (AC: 2–8)
  - [x] Add semantic UI under `src/ui/review/` (for example `ConsultationPanel.ts`, `ConclusionReviewPanel.ts`, and `DecisionHistoryPanel.ts`) and compose it from `src/main.ts`. Keep Phaser as an optional visual projection only; no consultation/review/history state, progression, or answer logic belongs in Phaser scenes/renderers.
  - [x] Follow the established `TheoryBoard`, `NotebookPanel`, and `CuratedRecord` pattern: subscribe to the authoritative store, render from selectors, use a labelled semantic landmark and a polite `role="status"` recovery region, clear stale messages when the authoritative state changes, and unsubscribe/clear the mount on teardown.
  - [x] Provide a clearly labelled consultation control with in-play observation, plain-language, and optional technical/source-detail disclosure. The practical next step must be explicit, but must never write, reveal, or infer a final learner conclusion. Repeated requests stay available and non-punitive.
  - [x] Render peer-review feedback as neutral, inspectable semantic text with a revision path back to the existing Theory Board. Never call a result “wrong,” suppress the learner’s draft, demand a mandatory skip, or use colour/sound as the only feedback channel.
  - [x] Render a decision-history list in chronological/version order. Each entry must visibly distinguish prior/current snapshot content, feedback, timestamp, and supporting evidence references; it must be readable without canvas pixels or colour interpretation. History is a record, not an editable form: editing the current theory draft must not rewrite a displayed historical entry.
  - [x] Use stable `data-*` focus keys and element lookup for rerender focus restoration. Never interpolate authored IDs into CSS selectors. Keep focus after keyboard activation, recoverable failures, review submission, history save, and disclosure changes.
  - [x] Extend `index.html` only if a dedicated semantic mount is necessary, and update `public/style.css` without removing current boot shell, Curated Record, controls, notebook, or Theory Board behavior. Preserve 44×44 CSS-pixel interactive targets, visible 2px+ focus treatment, 4.5:1+ text contrast, non-colour meaning, narrow sequential layout, and `prefers-reduced-motion` behavior. Phones remain laboratory read-only while semantic review/help remains readable and keyboard-operable.
  - [x] The existing reset, run comparison, theory board, and source surfaces must remain usable. This story may surface neutral auto-summaries of existing state, but must not mutate reset behavior, erase evidence/history, alter saved run snapshots, or lock valid work.

- [x] Verify the complete public contract and regressions (AC: 1–9)
  - [x] Add Vitest schema/content tests for valid authored consultation/review data and expected typed failures for duplicate IDs, unsupported predicates, missing layers, invalid references, and malformed content. Keep all strict existing case fixture requirements.
  - [x] Add exhaustive pure-domain tests for consultation precedence/selection, unlimited repeat request, each actionable target, all progressive layers, peer-review issue codes for missing evidence/unsupported claims/overreach, deterministic output, frozen inputs/outputs, and the recoverable unavailable-rule path. Assert the evaluator never reads UI/scene state or emits learner text.
  - [x] Add store tests for typed actions, frozen state, no subscriber notifications after every rejected action, valid-work retention, adjacent phase preservation, append-only version increments, explicit action-supplied timestamps, and historical snapshot immutability after later edits/reviews. Cover unknown/duplicate run/source protection and independent notebook comparison state.
  - [x] Add integration coverage using only public actions and selectors. Assert consultation/review/revision flows retain existing controls, runs (including controls/result/timestamp/model version/linked evidence), inspected source IDs, comparison notes, theory draft, and phase rules. Do not test private renderer fields or incidental DOM structures.
  - [x] Add Playwright coverage using `getByRole`/`getByLabel`: keyboard activation with Space/Enter, visible and polite recoverable messages, all three help layers, neutral review feedback, revision saving, versioned decision-history display, focus restoration, and repeated consultation. Do not assert canvas pixels or Phaser internals. Keep the exact Theory Board conclusion locator where needed (`getByLabel('Conclusion', { exact: true })`).
- [x] Extend the accessibility spec with Axe after the new semantic review surfaces reach an interactive state. Manually verify keyboard-only operation, focus recovery, screen-reader announcements, disclosure semantics, non-colour understanding, responsive target sizing, and touch/pointer equivalence; Axe alone is insufficient.
  - [x] Run and retain the existing regression suite: `npm test`, `npm run typecheck`, `npm run build`, cached/offline E2E, Curated Record, measurement-notebook, dual-surface controls, Theory Board, accessibility, and Chromium/Firefox/WebKit Playwright suites. Do not loosen prior public assertions.

### Review Findings

- [x] [Review][Patch] Connect the authorized player flow to peer review and revision [src/ui/theory/TheoryBoard.ts:186] — The only semantic review request is issued while the app remains in `context`, but peer feedback is gated to `review`; no UI or renderer dispatches the intervening legal phase transitions. Players therefore cannot receive feedback, save a revision, or populate decision history (AC 3, 4, 9).
- [x] [Review][Patch] Reject incomplete consultation predicates at the schema boundary [src/schemas/CaseDefinitionSchema.ts:44] — `missing-source` rules may omit `sourceId` and consequently always apply; `alternative-test` rules may omit `controlId` and never apply. Require the relevant ID for each predicate kind before content reaches domain logic (AC 1, 5).
- [x] [Review][Patch] Represent an unavailable peer-review evaluation safely [src/domain/review/peerReviewRules.ts:13] — The evaluator can only return `reviewed`, so a rule-evaluation failure cannot be surfaced as the required recoverable semantic result while preserving valid work (AC 5).
- [x] [Review][Patch] Invalidate peer feedback after evidence changes and after saving [src/core/store/AppState.ts:121] — New runs or inspected sources retain a previously evaluated review, and a save does not consume that review. A subsequent history entry can therefore pair changed evidence or an unchanged draft with stale feedback; clear the projection and require a fresh review before every appended revision (AC 3, 4).
- [x] [Review][Patch] Clear obsolete consultation guidance after authoritative state changes [src/core/store/AppState.ts:121] — Completing the advised run, source, or limitation step does not clear the stored consultation projection, so the panel can display guidance whose predicate is no longer true.
- [x] [Review][Patch] Validate revision timestamps as real chronological UTC instants [src/core/store/AppState.ts:265] — Regex validation accepts impossible dates/times and does not prevent an earlier timestamp than the prior history entry, compromising the ordered decision record (AC 4).
- [x] [Review][Patch] Make overreach matching deterministic and boundary-aware [src/domain/review/peerReviewRules.ts:41] — Substring matching falsely flags words such as “improves,” and `toLocaleLowerCase()` makes evaluation locale-dependent. Match normalized token/phrase boundaries with locale-independent casing.
- [x] [Review][Patch] Require a conclusion before review and history save [src/domain/theory/conclusionReadiness.ts:64] — Readiness does not check a blank conclusion, permitting an empty “conclusion” to enter peer review and decision history once other evidence requirements are met (AC 3, 4).
- [x] [Review][Patch] Render required observation and plain-language help directly [src/ui/review/ConsultationPanel.ts:44] — Both required help layers are hidden in closed disclosures alongside optional technical detail. Show the observation and plain-language guidance immediately, reserving optional disclosure for technical/source detail (AC 6).
- [x] [Review][Patch] Cover the real review and revision path with public tests [tests/e2e/theory-board.spec.ts:47] — Current browser coverage deliberately ends at a failed phase transition, while unit coverage omits unsupported-support and unavailable evaluation. Add public-action and browser coverage for reaching review, feedback, revision saving/history, focus recovery, repeated consultation, and recoverable failures (AC 9).
- [x] [Review][Defer] Provide a player-facing non-destructive reset surface [src/domain/cases/caseReducer.ts:27] — deferred, pre-existing. The project has only a pure phase-reset helper; this change neither introduces nor removes an authoritative/UI reset path, though AC 8 expects one.

## Dev Notes

### Required data flow

```text
validated immutable case consultation/review rules
  + authoritative runs / inspected sources / frozen theory draft
  → pure consultation selector + peer-review evaluator
  → typed store action and frozen projection/history state
  → public selectors
  → semantic assistance/review/history panels with neutral status
  → player edits the existing Theory Board draft
  → typed revision-save action appends immutable history
  → optional Phaser phase projection only
```

### Existing code to preserve and deliberately extend

| Path | Current behavior to preserve | Story 1.7 responsibility |
| --- | --- | --- |
| `src/domain/cases/CaseDefinition.ts` | Immutable minimal Young contract, reviewed-source eligibility, exact requirements | Add typed authored rule contracts only; do not duplicate thresholds or weaken prior types. |
| `src/schemas/CaseDefinitionSchema.ts` and `public/cases/young-interference/case.json` | Strict Zod boundary / immutable served content | Validate and author strict consultation/review/prompt data before domain use. |
| `src/domain/theory/conclusionReadiness.ts` | Pure, deterministic readiness and selected evidence validation | Reuse unchanged as evidence fact input; peer review is a separate pure evaluator. |
| `src/core/store/AppState.ts`, `AppAction.ts`, `createStore.ts`, `selectors.ts` | Sole mutable authority; frozen nested state; failed actions do not notify | Add typed/frozen review projections and append-only history through the same reducer pattern. |
| `src/domain/cases/caseReducer.ts` | Adjacent finite sequence `context → prediction → experiment → synthesis → review → debrief` | Preserve as sole phase authority; no review/consultation bypass or scene logic. |
| `src/ui/theory/TheoryBoard.ts` | Semantic support/draft/review request; status/focus restoration | Keep it as the editable conclusion source; link review feedback back to it without duplicating fields. |
| `src/ui/notebook/NotebookPanel.ts`, `src/ui/sources/CuratedRecord.ts` | Evidence/comparison/source safety and focus/recovery patterns | Reuse only through selectors/state; do not replace or couple their state. |
| `src/main.ts`, `index.html`, `public/style.css` | Current semantic composition and accessibility baseline | Compose/style review surfaces without regressions. |
| `src/adapters/phaser/*` | Renderer-only visual laboratory, scene cleanup | Read before touching; normally no change is needed. Never make it authoritative. |
| `tests/unit/*`, `tests/integration/*`, `tests/e2e/*` | Public-contract regression suite | Add narrow behaviour tests; retain all existing assertions. |

### Architecture and project-context guardrails

- `src/domain/` remains pure TypeScript. The only state authority is the project-owned immutable store. UI and Phaser read selectors and dispatch typed actions; neither layer mutates the other, case data, or state directly.
- Validate new case content at the repository boundary with Zod `safeParse` and return typed `Result` failures. Zod’s current v4 documentation describes `safeParse` as its non-throwing discriminated result, matching the current content-loader pattern. [Source](https://zod.dev/basics?id=handling-errors)
- Keep case definitions/shared assets immutable under `public/cases/` and `public/assets/`. Do not introduce local persistence, account, telemetry, analytics, backend, remote configuration, or a network-critical integration.
- Scientific evidence remains deterministic and historical: never recalculate/mutate run output, controls, timestamp, experiment-model version, or linked evidence. History snapshots must be equally append-only and immutable.
- Phaser scenes mirror state only and must clean subscriptions/display objects on shutdown. The official Phaser scene model makes shutdown/restart lifecycle distinct; do not retain subscriptions or place progress logic in a scene. [Source](https://docs.phaser.io/phaser/concepts/scenes)
- No freeform physics, scoring, currency, speed reward, hard fail, irreversible choice, answer revelation, unreviewed historical claim/asset, or learner-conclusion logging. Consultations point to evidence/test/limit only.
- Preserve semantic labels, values/units, keyboard access, focus behaviour, announcements, non-colour encoding, caption/text equivalence, desktop-browser support, and equivalent tablet outcomes. `update()` must not perform domain evaluation, DOM work, JSON parsing, logging, IndexedDB work, or transient allocation.
- Project-pinned dependencies are Phaser `4.2.1`, TypeScript `~5.7.2`, Vite `8.1.5`, `idb` `8.0.3`, Zod `4.4.3`, Vitest `4.1.10`, Playwright `1.61.1`, and `@axe-core/playwright` `4.12.1`. Add no dependency and perform no upgrade for this story.

### Previous-story intelligence and git patterns

- Story 1.6 is the direct baseline (`929e6ee` story, `d08938c` implementation, `e5530f8` review). Build on its pure evaluator/store/UI; do not replace it with a separate review state or custom phase flow.
- Its review fixed stale status clearing, unique conclusion labelling, readable recorded control settings, exhaustive evaluator combinations, keyboard selection, and successful `synthesis → review` coverage. Preserve each contract.
- Story 1.5 established strict source content validation, a base-URL-aware safe-parse/deep-freeze loading boundary, source provenance display, source eligibility protection, and safe focus restoration without authored ID CSS interpolation.
- Story 1.4 established immutable run records and comparison selections. Consultation/review/history must not alter their controls/results/timestamps/model version/linked evidence or confuse comparison selection with theory support.
- Existing successful commits use narrow source/test changes and retain tests for public actions, selectors, semantic roles, labels, and browser behaviour. Follow that pattern; do not weaken assertions to accommodate new UI.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.7; FR14–FR16, FR22–FR23; NFR5–NFR13, NFR18]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay Loop, consultation/peer feedback, accessibility, no-hard-fail, and history requirements]
- [Source: `_bmad-output/game-architecture.md` — Evidence-to-Conclusion Gate, Event System, Architectural Boundaries, Project Structure, State/Data/UI patterns, test readiness]
- [Source: `_bmad-output/project-context.md` — Engine-Specific, Organization, Testing, Platform, and Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/reconcile-gdd.md` — carried-forward semantic, accessible, evidence-led UX constraints]
- [Source: `_bmad-output/implementation-artifacts/1-6-evidence-to-conclusion-theory-board.md` — authoritative theory draft/readiness/phase, UI/focus patterns, and review fixes]
- [Source: `_bmad-output/implementation-artifacts/1-5-curated-record-and-source-labels.md` — source validation, provenance, recovery, and focus contracts]
- [Source: `_bmad-output/implementation-artifacts/1-4-measurement-notebook-and-run-comparison.md` — immutable evidence, comparison, and notebook contracts]
- [Zod safe parsing](https://zod.dev/basics?id=handling-errors)
- [Phaser scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes)

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Ultimate context engine analysis completed: complete Epic 1/GDD/UX/architecture/project-context/current-code/previous-story/git-history and current official technical-documentation review.
- Parallel analysis confirmed no consultation, peer-review, or decision-history implementation exists yet; Story 1.6 provides the authority and semantic patterns that Story 1.7 must extend.
- Validation checklist applied: the task list prevents duplicate state, UI/Phaser progression, hidden answer revelation, historical overwrites, invalid content entering domain logic, learner-text logging, and accessibility/test regressions.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.
- The story is intentionally in-memory and append-only; persistence, import/export, and print remain Story 1.8 scope.
- Implemented immutable authored consultation/peer-review rules, pure selectors/evaluator, typed store actions, and append-only frozen decision history.
- Added semantic consultation, peer-review, and decision-history panels without adding Phaser authority or external dependencies.
- Validated with 99 Vitest tests, typecheck, production build, offline/a11y E2E, and Chromium/Firefox/WebKit Playwright suites.

### File List

- `_bmad-output/implementation-artifacts/1-7-consultations-peer-review-and-revision-history.md` (updated story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)
- `src/domain/cases/CaseDefinition.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `public/cases/young-interference/case.json`
- `src/domain/review/ConsultationRule.ts`
- `src/domain/review/peerReviewRules.ts`
- `src/core/store/AppAction.ts`
- `src/core/store/AppState.ts`
- `src/core/store/selectors.ts`
- `src/ui/review/ConsultationPanel.ts`
- `src/ui/review/ConclusionReviewPanel.ts`
- `src/ui/review/DecisionHistoryPanel.ts`
- `src/main.ts`
- `index.html`
- `public/style.css`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/ReviewRules.test.ts`
- `tests/integration/ReviewFlow.test.ts`
- `tests/e2e/theory-board.spec.ts`
- `tests/e2e/accessibility.spec.ts`

## Change Log

- 2026-08-04: Ultimate context engine analysis completed - comprehensive developer guide created; status set to ready-for-dev.
- 2026-08-04: Implemented consultations, peer review, and revision history; status set to review.

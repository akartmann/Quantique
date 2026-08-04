---
baseline_commit: e50b6004bb83f91209a7b1f529fc7d2d162d27ef
---

# Story 1.2: Minimal Young case contract and authored loop

Status: ready-for-dev

## Story

As a Young content author,
I want the smallest validated contract needed for the first playable case,
so that Young content and its case loop exist before dependent foundation features without pre-building every later-case field.

## Acceptance Criteria

1. **Given** the initial Young case contract, **when** it is loaded through a repository, **then** Zod validates only its case ID/version, two required contextual artifacts, prediction requirement, bounded Young control definitions, deterministic experiment-model version, minimum evidence requirements, sourced debrief, and immutable asset manifest; **and** invalid content returns a typed recoverable `Result` before domain logic.
2. **Given** a fresh Young case, **when** the player proceeds through it, **then** the finite phase machine is `context → prediction → experiment → synthesis → review → debrief`; **and** the case requires opening dispute, Curated Record, lab setup, two-to-four experiment cycles, theory-board review, historical debrief, and optional replay.
3. **Given** every required case puzzle including Young, **when** it begins from reset, **then** it has one authored confound or initially misleading result discoverable by replication, a control change, or source comparison; **and** its reset-solvable path and physical-model assumptions are inspectable.

## Tasks / Subtasks

- [ ] Define the minimal case contract and strict boundary schema (AC: 1, 3)
  - [ ] Add `src/core/errors/Result.ts` with a generic discriminated `Result<T>` type. Expected load failures must be returned, never thrown from the repository or reducer.
  - [ ] Add `src/domain/cases/CaseDefinition.ts` with pure TypeScript types only; add `src/schemas/CaseDefinitionSchema.ts` as the matching Zod 4.4.3 boundary schema.
  - [ ] Make every contract object `.strict()` (and reject unrecognised top-level fields). This story intentionally supports only the minimal listed fields; Epic 3.1 owns later, reusable-contract expansion.
  - [ ] Define `CaseDefinition` with exactly the fields needed by this story: `id`, `version`, `openingDispute`, `contextualArtifacts`, `prediction`, `apparatus`, `experiment`, `requirements`, `flow`, `debrief`, and `assets`. Use camelCase JSON names and `young-interference` as the case ID.
  - [ ] Require exactly two contextual artifacts, each with a stable ID and minimum author-facing display/provenance reference. Do not build Curated Record UI or the complete source/rights ledger (Stories 1.5 and 3.3).
  - [ ] Require `prediction.required === true`; two bounded primary controls; `experiment.modelVersion`; inspectable `experiment.assumptions`; exactly one authored `experiment.confound`; and an inspectable `experiment.resetPath` that identifies replication, control change, or source comparison as the recovery route.
  - [ ] Require `requirements.minimumRuns === 2` and `requirements.minimumSources === 2`. Do not implement run records, saving, comparison, completion evaluation, or persistence here.
  - [ ] Require a sourced debrief with a non-empty plain-language summary and at least one stable source reference. Do not invent unreviewed historical claims, source excerpts, or rights statuses.
  - [ ] Require an immutable asset manifest with stable asset IDs, type, and static path. The definition and manifest are authored content; neither is ever mutated at runtime.

- [ ] Author and load the initial Young definition through the content boundary (AC: 1, 3)
  - [ ] Add immutable JSON under `public/cases/young-interference/`: `case.json` and the declared asset-manifest JSON (use `sources.json` only if required by the chosen minimal schema). Keep case content separate from player progress and never write into `public/` at runtime.
  - [ ] Put the Young control constraints in authored data: `slitSpacingMm` 0.10–0.50 in 0.05 steps, `screenDistanceM` 1.0–4.0 in 0.25 steps, and fixed `wavelengthNm: 550`. Wavelength comparison is explicitly out of scope.
  - [ ] Add `src/adapters/content/loadCaseDefinition.ts`. It is the only code that fetches/parses case JSON; it returns `Promise<Result<CaseDefinition>>` and maps missing, unreadable, malformed, or schema-invalid content to neutral recoverable codes/messages such as `case-not-found`, `content-unavailable`, or `invalid-case-definition`.
  - [ ] Do not fetch, parse JSON, call browser APIs, or import Zod/Phaser in `src/domain/`. Do not add a backend, remote configuration, analytics, or network-critical path.

- [ ] Implement the pure, authoritative case-phase transition model (AC: 2)
  - [ ] Add `src/domain/cases/CaseProgress.ts` and `src/domain/cases/caseReducer.ts` with `CasePhase = 'context' | 'prediction' | 'experiment' | 'synthesis' | 'review' | 'debrief'` and an explicit adjacent-transition table.
  - [ ] Initialize a fresh case in `context`; reject skips, reverse transitions, and transitions after `debrief` with a typed recoverable `Result`. Reset returns to `context` without deleting authored definition data.
  - [ ] Make `flow` validated authored metadata: it must identify the opening dispute, Curated Record, lab setup, `minimumExperimentCycles: 2`, `maximumExperimentCycles: 4`, theory-board review, historical debrief, and `optionalReplay: true`. This resolves AC 2 without inventing UI or later-feature schemas.
  - [ ] Keep phase authority entirely in the pure domain reducer. Do **not** make a Phaser scene, DOM view, pointer handler, or dialogue branch infer or advance progression. There is no renderer, store composition, or UI flow to build in this story.

- [ ] Add focused verification and preserve the 1.1 baseline (AC: 1–3)
  - [ ] Add Vitest fixtures for one valid Young definition and malformed variants (bad version/ID, not exactly two artifacts, unbounded/off-step controls, missing model version, missing debrief source, mutable/invalid asset manifest, missing confound/assumptions/reset path, invalid flow).
  - [ ] Unit-test schema success/failure, repository `Result` mapping with mocked fetch, initial phase, every valid adjacent transition, every invalid skip/reverse/terminal transition, and reset behavior. Assert public types and values only.
  - [ ] Run `npm run typecheck`, `npm test`, and `npm run build`. Run the established Playwright/a11y/offline/cross-browser suite if source changes affect boot, service-worker, or public loading behavior; retain the semantic boot shell and its cached offline behavior.

## Dev Notes

### Scope and sequencing

- Story 1.2 is the contract and loop foundation for the Young validation slice. It follows the completed bootstrap/harness in Story 1.1 and must not reimplement it.
- It is deliberately narrower than a universal case framework. Stories 1.3–1.9 own controls, notebook/run records, source inspection, conclusion readiness, consultation/review, persistence/export, and feedback; Epic 3.1 later hardens the contract for other cases.
- AC 1's minimal field list and ACs 2–3 require a small amount of authored flow/puzzle metadata. Treat `flow`, `experiment.confound`, `experiment.assumptions`, and `experiment.resetPath` as required Young-minimum fields—not future generic schema fields. No additional optional catch-all metadata is allowed.
- “Sourced” means stable source references in the data, not fabricated citations. If reviewed Young source text/rights data is unavailable, use a clearly author-supplied reference identifier/URL and a neutral summary; do not invent quotations or asset provenance.

### Required contract decisions

| Concern | Required decision |
| --- | --- |
| Unknown content | Zod strict objects reject it. This prevents silently accepting unimplemented later-case fields. |
| Content identity | `id: 'young-interference'`; version is an explicit non-empty schema/version string. |
| Context gate data | Exactly two required artifact records; their stable IDs can later be stored as inspected evidence. |
| Prediction | Explicit `required: true`; text entry/state is a later story. |
| Apparatus | Two authored numeric definitions with label, unit, min, max, step, and default. No freeform inputs or physics sandbox. |
| Experiment | Fixed 550 nm model input, version, assumptions, one discoverable confound, and reset-solvable recovery description. Calculating fringe output belongs to Story 2.2. |
| Evidence | Minimum two runs and two sources only; no records/evaluator yet. |
| Flow | Exact finite phase sequence plus named required experience beats and 2–4 experiment-cycle range. |
| Debrief / assets | Debrief includes a source reference; asset manifest contains immutable static declarations. UI loading and rendering are later work. |

### Architecture compliance

- Use the approved pinned stack: Phaser 4.2.1, TypeScript, Vite 8.1.5, Zod 4.4.3, Vitest 4.1.10. Do not upgrade dependencies as part of this story.
- Respect dependency direction: `domain/` is pure; adapters may depend inward; the repository alone owns `fetch` and `safeParse`; future UI/Phaser layers will consume selectors/actions rather than mutate state.
- The project-owned store becomes the final app authority, but do not prematurely build unrelated store, event-bus, IndexedDB, renderer, DOM adapter, or scene architecture merely to host this reducer. Keep the reducer independently testable and ready to integrate.
- Phaser remains a visual companion. Preserve the existing starter scenes and semantic `#boot-shell`; current template pointer transitions are not the case phase machine and must not be repurposed as one.
- Preserve offline/static-host characteristics: all content paths must work as same-origin static files after a successful load; cache writes/fetch failures must never make the boot shell unusable.
- Avoid per-frame domain work, JSON parsing, DOM mutation, IndexedDB, logging, pooling, or runtime physics. This story has no frame loop.

### File structure requirements

**NEW**

- `src/core/errors/Result.ts` — typed recoverable success/failure boundary.
- `src/domain/cases/CaseDefinition.ts` — pure minimal contract types.
- `src/domain/cases/CaseProgress.ts` — phase/progress types.
- `src/domain/cases/caseReducer.ts` — pure initial/reset/adjacent phase transition functions.
- `src/schemas/CaseDefinitionSchema.ts` — strict Zod schema and inferred/compatible contract type.
- `src/adapters/content/loadCaseDefinition.ts` — injected/mocked-fetch repository; no global mutable service locator.
- `public/cases/young-interference/case.json` and asset-manifest JSON — immutable authored Young content.
- `tests/unit/` fixtures and specs for schema, repository, and phase reducer.

**UPDATE ONLY IF NECESSARY**

- `src/main.ts`, `index.html`, `public/style.css`, and E2E specs — only for a minimal semantic loading/recovery surface required to exercise repository loading. Do not replace the boot-shell contract or make canvas loading/status authoritative.
- Do not modify `src/game/scenes/*` for phase progression. Do not add generic `services/`, `managers/`, or `helpers/` directories.

### Testing requirements

- Use unit fixtures; neither schema/reducer tests nor calculation-free contract tests may require Phaser, DOM, a browser, IndexedDB, or network.
- Test malformed values at the boundary and assert `Result.ok === false`; do not expect errors to escape to callers.
- Test all six valid transitions and representative invalid paths: skip (`context → experiment`), reverse, and terminal advance. Reset must preserve the definition reference/value and return phase to `context`.
- Repository tests must prove that only validated `CaseDefinition` values cross into the domain. Include malformed JSON and failed HTTP/network cases.
- Existing browser tests remain public semantic-role tests; do not assert Phaser private fields, canvas pixels, or scene sequence. Axe is necessary but not sufficient for later UI work.

### Previous story and Git intelligence

- Story 1.1 is complete. It established a Phaser Vite TypeScript starter, semantic boot shell, production static cache, and verification commands. Preserve those integration points; the prior review specifically fixed cache-write resilience and cached-launch timing.
- Recent commits are `e50b600 Review 1.1` and `29266cd feat: bootstrap Phaser verification harness`. Existing app source is still starter-level: `src/main.ts` starts Phaser and the boot shell, `src/adapters/OfflineCache.ts` safely registers the service worker, and `src/game/scenes/*` are not domain authority.

### Latest technical information

- Zod 4's `safeParse` returns a discriminated success/error result, fitting the required repository `Result` mapping; use it rather than `parse`/exception control flow. [Source: Zod basics — https://zod.dev/basics]
- Phaser scene lifecycle treats shutdown as a resource-cleanup point. This story should not introduce a case scene, but later renderers must clean subscriptions/display objects rather than retaining state across scene restarts. [Source: Phaser Scenes — https://docs.phaser.io/phaser/concepts/scenes]
- Vite serves `public/` assets at the root and copies them unchanged to production output. Use static, root-safe case content paths; do not rely on runtime-generated case files. [Source: Vite static asset handling — https://vite.dev/guide/assets.html]

### Project Context Rules

- Semantic HTML—not Phaser—owns essential controls, values, instructions, notebook, theory board, source inspection, conclusions, focus, and announcements. Every later visual gesture dispatches the same typed action as the semantic control.
- Case definitions/assets are immutable under `public/cases/` / `public/assets/`; player progress belongs in IndexedDB only when Story 1.8 implements it.
- Domain events use `noun.verb`; use PascalCase for classes/types/files and camelCase for non-class modules/functions/properties. Case IDs/assets are kebab-case; JSON fields are camelCase.
- Never add hard failure, irreversible wrong choice, speed reward, score, canvas-only action, unaudited historical asset/claim, or learner-data logging. Sound/colour must never be essential information.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — requirements inventory; Epic 1; Story 1.2 and dependent Stories 1.3–1.9]
- [Source: `_bmad-output/game-architecture.md` — Content Model, Error Handling, Project Structure, Architectural Boundaries, State/Data Patterns, Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — Technology Stack & Versions, Engine-Specific Rules, Code Organization Rules, Testing Rules, Critical Don’t-Miss Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` — Core Gameplay, Young controls, Core Puzzle Mechanics, Level Structure, Technical Specifications]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — Information Architecture, State Patterns, Accessibility Floor]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/DESIGN.md` — component and scientific-legibility constraints]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Story context creation reviewed the complete epics, GDD, architecture, project context, UX spine/reconciliations, prior Story 1.1, repository source tree, Git history, and current official Phaser/Zod/Vite documentation.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status set to `ready-for-dev`.

### File List

- `_bmad-output/implementation-artifacts/1-2-minimal-young-case-contract-and-authored-loop.md` (new story context)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

---
baseline_commit: 0757ac98d7eb3f2ba7ba8cc0f4d3cd9a90d28ad8
---

# Story 2.5: Rival-lab critique and revision

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a rival lab to challenge an unsupported conclusion,
so that the stakes feel real while I still get to revise my choice.

## Acceptance Criteria

**AC1 — An unsupported conclusion is met by an authored critique.**
**Given** I choose a conclusion whose proposal ID is not in the evaluator's defensible set,
**When** the choice is submitted,
**Then** the `RivalLabScene` presents an authored critique line that names the unsupported claim, missing evidence, or overreach in a pointed-but-fair voice,
**And** it routes me back to a revisable conclusion choice.

**AC2 — The critique is never a punishment, and it is recorded.**
**Given** the rival-lab critique,
**When** it is shown,
**Then** it never applies a score, timer, setback, progress loss, or lockout,
**And** the decision record retains the rejected choice and the critique.

**AC3 — Revising is inquiry, not failure.**
**Given** I revise to a defensible conclusion,
**When** the choice is re-evaluated,
**Then** the critique clears and the case is free to proceed through review to the debrief phase,
**And** recognition reflects the revision as inquiry, not failure — no recognition item is lost or withheld because a critique occurred.

**AC4 — Behaviour is covered by tests.**
**Given** the rival-lab behavior,
**When** tests run,
**Then** unit tests cover critique selection for each indefensible proposal,
**And** an integration test verifies the choose→critique→revise→proceed flow through public store actions.

**AC5 — EN + FR from launch (NFR19, ADR-010).**
**Given** any string this story adds,
**When** it is rendered,
**Then** every authored critique line and rival-lab identity string carries both `en` and `fr` and is Zod-validated for locale completeness,
**And** every interface string this story adds exists in both `src/core/i18n/locales/en.ts` and `fr.ts`,
**And** the French rival-lab surface renders without truncation or overlap at 1280×720.

> **Note on AC3's wording.** The epic says "the case proceeds to the debrief phase". Taken literally that would bypass the review → `revision.saved` → `case.debriefCompleted` chain that Story 2.3 built and that `validateCaseRecordForDefinition` enforces on every load. This story reads "proceeds" as "the critique stops blocking progression"; the existing path to the debrief is untouched. See Open Question 1.

## Tasks / Subtasks

- [x] **Task 1 — Authored content: the rival lab and its critiques (AC1, AC5)**
  - [x] Add a top-level `rivalLab` object to `public/cases/young-interference/case.json`: `{ name, accentColor, critiques[] }`. `name` is the canonical proper noun `"Mr. Arthur Bell"` (a proper noun, never translated — follows `colleagues[].name` and `creatorOrOrigin`). `accentColor` is a lower-case `#rrggbb` silhouette accent, distinct from all four colleague accents.
  - [x] Author **at least one critique per conclusion proposal** — four minimum. Each is `{ id, proposalId, line: LocalizedText }`. The line names the unsupported claim, the missing evidence, or the overreach; pointed but fair; no score, threat, or lockout language; never supplies the right answer.
  - [x] **Do not** add Arthur Bell to `colleagues[]`. He is the rival, not the cast (project-context, Guided-Adventure rules). Nothing may attribute a proposal or dialogue beat to him.
  - [x] Bump `case.json` `version` `1.8.0` → `1.9.0`.
  - [x] Do **not** touch `dist/` or `.claude/worktrees/**`; `public/cases/…` is the only editable copy.

- [x] **Task 2 — Case-definition types and schema (AC1, AC5)**
  - [x] `src/domain/cases/CaseDefinition.ts`: add `RivalLabCritique` and `RivalLab` types and a required `rivalLab: RivalLab` field. Pure types only — no Zod here.
  - [x] `src/schemas/CaseDefinitionSchema.ts`: add `RivalLabCritiqueSchema` / `RivalLabSchema`, both `.strict()`. `critiques: z.array(...).min(1)`.
  - [x] Add these refinements in the top-level `superRefine`:
    - critique IDs are unique;
    - every `critique.proposalId` names an authored `conclusionProposals` entry;
    - **every conclusion proposal has at least one critique** — this is what makes selection total and removes any need for a generic fallback line;
    - `encodesPath(critique.line)` is rejected (a critique must not name a scene, phase, or route);
    - `accentColor` matches the same lower-case `/^#[0-9a-f]{6}$/` rule the colleague silhouette uses.
  - [x] Reuse `LocalizedTextSchema` for `line`. Do **not** use `DetectionPhraseListSchema` — this is display prose, not detection phrases.

- [x] **Task 3 — Pure critique selection (AC1, AC4)**
  - [x] New `src/domain/review/rivalLabRules.ts`, pure and dependency-free (no Phaser, no store, no locale, no Zod).
  - [x] `selectRivalLabCritique(definition, proposalId): RivalLabCritiqueSelection | undefined` returns `{ critiqueId, proposalId }` for the first authored critique matching the proposal, in authored order. Deterministic; returns `undefined` only for a proposal ID the definition does not carry.
  - [x] It carries **stable IDs, never prose**. The presentation resolves the line by ID against the case definition. This is deliberate — see the `peerReviewRules` trap in Dev Notes.

- [x] **Task 4 — Store state, actions, and reducers (AC1, AC2, AC3)**
  - [x] `AppState`: add transient `rivalLabCritique?: RivalLabCritiqueSelection` (same lifetime class as `consultation` / `peerReview`) and persisted `critiqueHistory: readonly RivalLabCritiqueEntry[]` where an entry is `{ proposalId, critiqueId, timestamp }`. Declare `RivalLabCritiqueEntry` in `AppState.ts` next to `DecisionHistoryEntry` (it is store state, not domain content); `RivalLabCritiqueSelection` comes from `rivalLabRules.ts`.
  - [x] Freeze both in `freezeState` (a `freezeCritique` helper mirroring `freezeDecision`); initialise `critiqueHistory: []` in `createInitialAppState`.
  - [x] `CompletionSnapshot` gains `critiqueHistory: readonly RivalLabCritiqueEntry[]`, frozen in `freezeCompletion` and captured in `reduceDebriefComplete` from `state.critiqueHistory` — the snapshot already mirrors `decisionHistory`, and without it a completed record loses its critique record the moment a counterfactual replay clears the live list.
  - [x] New action `theory.conclusionSubmitted { timestamp }` (`AppAction.ts` + the `reduceAppState` switch):
    - fails `conclusion-submission-unavailable` unless `phase` is `synthesis` or `review` (the two phases the theory board hosts — same gate as `theory.conclusionProposalChosen`);
    - fails `conclusion-choice-required` when `selectedConclusionProposalId` is undefined;
    - validates `timestamp` with the existing `isTimestamp` helper and requires it to be later than the last `critiqueHistory` entry — mirror `reduceRevisionSave`'s timestamp discipline;
    - computes the defensible set with `selectDefensibleConclusionIds(definition, { runs, inspectedSourceIds, comparisonNotes })`;
    - **not defensible** → sets `rivalLabCritique` and appends a `critiqueHistory` entry. **It does not change `phase`.**
    - **defensible** → clears `rivalLabCritique` and changes nothing else. It must **not** advance the phase, save a revision, or complete the case.
  - [x] New action `rivalLab.revisionRequested` (no params): fails `rival-lab-critique-unavailable` when no critique is live; otherwise clears `rivalLabCritique` only. `selectedConclusionProposalId` and the theory draft are **preserved** — the player returns to the board with their rejected choice still visible and revisable.
  - [x] Clear `rivalLabCritique` everywhere `peerReview` is already cleared, and additionally in `reduceTheoryConclusionProposalChosen`.
  - [x] `reduceReplayStart` clears **both** `rivalLabCritique` and `critiqueHistory`, alongside the fields it already clears.
  - [x] No score, timer, counter, penalty, lockout, or progress rollback anywhere in this task. Nothing this story adds may make any other action fail.

- [x] **Task 5 — Selectors (AC1, AC5)**
  - [x] `selectRivalLabCritique(state)` → the raw selection or `undefined`. Note the name collision: `rivalLabRules.ts` exports a `selectRivalLabCritique(definition, proposalId)` too. `selectors.ts` does not need to import the domain one (the reducer calls it), so no alias is required — but if you do import it, alias it, the way the codebase keeps `selectConsultation` distinct between `ConsultationRule.ts` and `selectors.ts`.
  - [x] `selectLocalizedRivalLabCritique(state)` → `{ speaker, line, accentColor } | undefined`, where `speaker` is `formatAttribution(t, { colleagueName: definition.rivalLab.name, roleLabel: t('rivalLab.role') })` and `line` is `resolveLocalizedText(critique.line, selectLocale(state))`.
  - [x] `selectCritiqueHistory(state)`.
  - [x] **The rival-lab projection must never expose the defensible set** — only the critique for the proposal that was already submitted. A surface that could read defensibility could mark the "right" answer (ADR-006; the rule `ColleagueRenderer` and `ProposalChoice` are both built around).

- [x] **Task 6 — Scene routing (AC1)**
  - [x] `src/domain/cases/ScenarioScript.ts`: **leave `SCENE_KEYS` unchanged.** Add `export const RIVAL_LAB_SCENE_KEY = 'RivalLab' as const;`, `export const ROUTABLE_SCENE_KEYS = [...SCENE_KEYS, RIVAL_LAB_SCENE_KEY] as const;` and `export type RoutableSceneKey = typeof ROUTABLE_SCENE_KEYS[number];`.
  - [x] `SceneRouter.ts`: type `SceneRouterTarget` and `getActiveSceneKey` on `RoutableSceneKey`. In `route()`, resolve `selectRivalLabCritique(store.getState()) ? RIVAL_LAB_SCENE_KEY : resolveSceneKey(scenarioScript, phase)`. Leave `resolveSceneKey` itself phase-only, and leave the `try/catch`, `isActive`, and `onceCreated` behaviour exactly as it is. The router still never dispatches.
  - [x] `src/game/main.ts`: change `Record<SceneKey, Scene>` to `Record<RoutableSceneKey, Scene>`, register the new scene, and iterate `ROUTABLE_SCENE_KEYS`.
  - [x] `src/main.ts`: the `onSceneActivated` callback's parameter type widens to `RoutableSceneKey`; `data-active-scene` then reports `RivalLab`. No other change.

- [x] **Task 7 — `RivalLabScene` and its renderer (AC1, AC2, AC5)**
  - [x] New `src/adapters/phaser/scenes/RivalLabScene.ts`. It must **not** extend `PhasePlaceholderScene` (that is a development marker for unbuilt scenes). Follow `TheoryBoardScene`'s shape: construct the renderer in `create()`, subscribe to the store, render once, and release everything on `shutdown`.
  - [x] New `src/adapters/phaser/renderers/RivalLabRenderer.ts` following the renderer contract — `create()` / `render(state)` / `destroy()`, owning every display object it makes.
    - Heading, accent stripe, speaker attribution, the critique line, and one interactive "revise" control.
    - **Create every text object empty and write it in `render()`** through `createTranslator(selectLocale(state))` — `create()` runs once and the locale can change.
    - The revise control dispatches `rivalLab.revisionRequested` and surfaces a refused dispatch through `selectLocalizedError`, the way `ColleagueRenderer.chooseProposal` does (an exclusive progress operation legitimately refuses a dispatch; swallowing it leaves the control silently inert).
    - Place the critique body against a measured wrap width and place anything below it under the body's **measured** height — never against a fixed constant. Both prior reviews (1.11, 1.12) found exactly that defect.
    - Export the wrap widths / font sizes the browser tests need, rather than restating them as literals in the spec.
    - No animation. If one is ever added it inherits the `prefers-reduced-motion` obligation.
  - [x] `src/game/main.ts`: add `rivalLabScene.setInputEnabled(!visible)` to the `LectureBookScene` overlay-suppression callback alongside the laboratory and the two proposal scenes. The book is reachable in every phase and the critique surface covers the canvas — omitting this reproduces the exact click-through defect 1.12 fixed for the proposal cards.

- [x] **Task 8 — Persistence (AC2)**
  - [x] `CaseRecordSchema`: add **optional additive** `critiqueHistory?: z.array(RivalLabCritiqueEntrySchema)` at the top level and inside `completion`. Keep `schemaVersion: 3` and leave `migrateCaseRecord` untouched — this is the same additive precedent as `selectedPredictionProposalId` (a pre-2.5 record simply omits the field).
  - [x] Persist **IDs and a timestamp only**. Never persist the critique prose and never recompute-and-string-compare it on load.
  - [x] `validateCaseRecordForDefinition`: for each entry, require that `proposalId` names an authored conclusion proposal, that `critiqueId` names an authored critique **whose `proposalId` matches**, and that timestamps strictly increase. Nothing else. Do not extend the recomputation contract.
  - [x] Extend the compatibility allowlist with `definition.version === '1.9.0' && ['1.2.0','1.3.0','1.4.0','1.5.0','1.6.0','1.7.0','1.8.0']`. This story changes **no** canonical English `feedback` / `revisionPath` string, so the byte-identity assumption the allowlist rests on still holds — state that in the code comment.
  - [x] `createCaseRecordProjection` and `createAppStateFromCaseRecord` carry `critiqueHistory` in both directions.

- [x] **Task 9 — i18n (AC5)**
  - [x] Add to **both** `en.ts` and `fr.ts`, in a new `--- Rival lab ---` block near the colleagues block: `rivalLab.role`, `rivalLab.heading`, `rivalLab.guide`, `rivalLab.revise`.
  - [x] Add the new error keys: `error.conclusion-submission-unavailable`, `error.conclusion-choice-required`, `error.rival-lab-critique-unavailable`. Every code a reducer can return needs one, or the player sees the dev-facing English fallback.
  - [x] `fr` is typed `keyof typeof en`, so a gap is a `tsc` error. Verify with `npm run typecheck`.
  - [x] The critique **lines** are content and live in `case.json` as `LocalizedText` — never in `en.ts`.

- [x] **Task 10 — Tests (AC4, AC5)**
  - [x] `tests/unit/RivalLabRules.test.ts` — selection for **each of the four** conclusion proposals; determinism across repeated calls; `undefined` for an unknown proposal ID.
  - [x] `tests/unit/CaseDefinition.test.ts` — rejects a missing `rivalLab`, empty `critiques`, a critique naming an unauthored proposal, a conclusion proposal with no critique, duplicate critique IDs, a path-encoding line, a non-`#rrggbb` accent, and an unknown `rivalLab` field. **The existing `'an unknown scene key'` case that mutates a `sceneKey` to `'RivalLab'` must still pass** — under Task 6 `SCENE_KEYS` is unchanged, so `RivalLab` correctly remains un-authorable. If you find yourself editing that case, the design has drifted: re-read Dev Notes §Scene-key vocabulary.
  - [x] `tests/unit/CaseRecordSchema.test.ts` — a `critiqueHistory` round-trip; rejection of an unknown `critiqueId`, a mismatched `proposalId`/`critiqueId` pair, and out-of-order timestamps; a pre-2.5 record with no `critiqueHistory` still loads.
  - [x] `tests/unit/SceneRouter.test.ts` — routes to `RivalLab` when a critique is live and back to the phase's scene when it clears, through the injected `SceneRouterTarget` slice. No real `Phaser.Game`.
  - [x] `tests/integration/RivalLabCritique.test.ts` — the whole choose→submit→critique→revise→proceed flow through **public store actions and selectors only**. Include: the critique appears for an indefensible choice; no state is lost; `critiqueHistory` grows; revising to a defensible proposal clears the critique; a second submit of a defensible proposal produces no critique; `case.replayStarted` clears both fields.
  - [x] `tests/integration/ProposalSelection.test.ts` — update the `authored overreach the current rules cannot detect (pending Story 2.5)` block. `conclusion-universal-optics` now draws a critique on submit; keep its peer-review assertions unchanged and rewrite the comment to record that 2.5 landed. **Do not widen `overreachPhrases`** (see Dev Notes §The `peerReviewRules` trap).
  - [x] Recognition test (AC3): choose `conclusion-wave-settled` → submit → critique → revise to `conclusion-spacing-varies` → complete → `calibrated-conclusion` is achieved and no item regressed.
  - [x] `tests/e2e/rival-lab.spec.ts` — asserts `data-active-scene="RivalLab"` after submitting an unsupported conclusion and the phase scene again after revising. Add an FR case with `test.use({ locale: 'fr-FR' })` importing the expected strings from `src/core/i18n/locales/fr`.
  - [x] `tests/e2e/french-typography.spec.ts` — extend to the new surface, deriving bounds from the renderer's exported constants.
  - [x] Establish the e2e baseline on `26dcaf9` before attributing any failure to this story — `deferred-work.md` lists specs that already fail there.

- [x] **Task 11 — Verify (all ACs)**
  - [x] `npm run typecheck`, `npm test`, `npm run test:e2e` all green apart from the documented baseline failures. Record the baseline comparison in the Dev Agent Record.
  - [x] Manual: at 1280×720, in both EN and FR, submit each of the four conclusions from a thin-evidence state and confirm a critique appears, reads fairly, and returns to the board with the choice intact.

## Dev Notes

### Scope, dependencies, and non-goals

- **In scope:** the critique trigger, its authored content, the scene, the route in and out, the record of what was critiqued, and the tests.
- **Not in scope, and must not be built here:**
  - the **significant-measure gate and colleague hints** — Story 2.6. `conclusionReadiness.ts` has no significance concept and `case.json` has no `significanceRule`; do not invent one. This story's defensibility check uses `selectDefensibleConclusionIds`, which already exists and is already correct.
  - widening `peerReviewRules` overreach detection;
  - retiring or editing any `src/ui/*` panel;
  - `LibraryScene` / `DebriefScene` content (both are still `PhasePlaceholderScene`; leave them);
  - accessibility parity (ADR-008), analytics, a new dependency, a new phase, or a new recognition item.
- **No blocking dependency.** Everything this story needs already exists: the evaluator (`selectDefensibleConclusionIds`), the router, the proposal system, the dialogue/choice widgets, and the i18n layer.
- **Story 2.4 is blocked on this one.** `docs/validation/young-validation-plan.md` forbids scheduling any moderated session until 2.5 and 2.6 ship, and `young-release-decision-template.md` / `young-bilingual-completeness-template.md` both carry a **Blocked** row for it. Do not edit those templates here; 2.6 shipping is what unblocks them.

### Read before editing — current behaviour that must survive

| Path | What it does today | This story's change boundary |
| --- | --- | --- |
| `src/domain/theory/conclusionProposals.ts` | Pure predicate interpreter; `selectDefensibleConclusionIds` returns the defensible set in authored order. | **Read only.** Do not change the predicate language or the evaluator. |
| `src/domain/theory/conclusionReadiness.ts` | Pre-pivot draft readiness (support runs/sources, saved comparison, non-empty conclusion + limitation). Gates `theory.reviewRequested` and `case.debriefCompleted`. | Untouched. This is **not** the significance gate. |
| `src/domain/review/peerReviewRules.ts` | Emits canonical `.en` feedback that is persisted and **recomputed + `JSON.stringify`-compared on every load**. | Untouched. See the trap below. |
| `src/core/store/AppState.ts:503` `reduceTheoryConclusionProposalChosen` | Records the choice and only the choice; revisable, phase-gated to `synthesis`/`review`, never evaluates defensibility. | Add the `rivalLabCritique` clear. Keep it revisable — re-choosing must stay a no-op success. |
| `src/core/store/AppState.ts:597` `reduceRevisionSave` | The only writer of `decisionHistory`; requires a `reviewed` peer review and a strictly-later timestamp. | Untouched. Copy its timestamp discipline for the new action. |
| `src/core/store/AppState.ts:661` `reduceReplayStart` | Clears progress for a counterfactual replay, preserving `locale` and `completion`. | Add the two new fields to the clear list. |
| `src/adapters/phaser/SceneRouter.ts` | Read-only over the store; never dispatches; swallows routing throws so `dispatch`'s `Result` contract holds. | Add the critique override in `route()` **only**. Preserve the `try/catch` and the `isActive` short-circuit verbatim. |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts` | Four unmarked proposal cards; deliberately blind to defensibility; measured layout with a clamp so cards can never leave the canvas. | Read only — but it is the reference for the new renderer's measured layout, empty-create, and refused-dispatch handling. |
| `src/game/main.ts:56-67` | The auto-started `LectureBookScene` overlay suppresses input on every scene that owns canvas input. | Add `RivalLabScene` to that list. |
| `src/schemas/CaseRecordSchema.ts:145` `validateCaseRecordForDefinition` | Revalidates untrusted progress; sanitizes a stale proposal ID rather than discarding the investigation. | Add ID-only checks for `critiqueHistory`; extend the version allowlist. |
| `tests/unit/CaseDefinition.test.ts:396` | Pins that `'RivalLab'` is **not** a valid authored `sceneKey`. | Must stay green. |
| `tests/integration/ProposalSelection.test.ts:370` | A `pending Story 2.5` block pinning that `conclusion-universal-optics` completes with no finding. | Update the block and its comment — this is the behaviour 2.5 exists to change. |

### Scene-key vocabulary: `RivalLab` is routable but not authorable

`SCENE_KEYS` is the **content vocabulary** — the scenes a case's `scenarioScript` may map a phase to, and `ScenarioScriptSchema` requires the script to cover every phase exactly once. `RivalLab` is not a phase; it is a state the theory board enters and leaves without the phase moving. Adding it to `SCENE_KEYS` would let a case author route, say, `debrief` to the rival lab, and would force an edit to the test that currently proves `RivalLab` is rejected.

So: keep `SCENE_KEYS` as it is, and introduce a wider `ROUTABLE_SCENE_KEYS` that the *router and the game registry* are typed on. The content contract stays narrow; the runtime registry is what widens. This also keeps `resolveSceneKey` a pure phase lookup, which is what ADR-009 describes.

### Why the critique lives in the store, not in the scene

ADR-001/ADR-009 and project-context all say the same thing: a scene mirrors authoritative state and never defines it. If `RivalLabScene` decided when to show itself, the critique would be scene-local, invisible to tests that use public actions (AC4 requires exactly those), and lost on reload. `rivalLabCritique` in `AppState` makes the router's decision a projection of state, which is the pattern the whole codebase already uses.

`rivalLabCritique` is **transient** (like `consultation` and `peerReview`) and `critiqueHistory` is **persisted**. A reload therefore returns the player to the theory board with their choice intact and the critique recorded — not stranded on a critique screen. That is the correct behaviour: the critique is a beat, the record of it is the fact.

### The `peerReviewRules` trap — do not repeat it

`PeerReviewIssue` persists English prose (`feedback`, `revisionPath`) into `DecisionHistoryEntry`, and `validateCaseRecordForDefinition` recomputes it and `JSON.stringify`-compares it on every load. The consequence, spelled out in that file's comments: **any copy edit to an authored feedback string silently invalidates every saved record**, and adding a French detection phrase was only safe because no record could have contained one.

`critiqueHistory` must not inherit this. Persist `{ proposalId, critiqueId, timestamp }` and nothing else. The line is resolved from `case.json` at display time, so an author can rewrite a critique without costing a single player their investigation.

For the same reason: **do not widen `overreachPhrases` in this story.** The rival-lab critique is the mechanism that was chosen (1.11 review, decision 1d) precisely so the detection set would not have to grow.

### Recognition: satisfy AC3 without a fifth recognition item

Tempting and wrong: adding a `revision-after-critique` entry to `RECOGNITION_IDS`. `CurrentRecognitionSchema` pins `items` to `.length(RECOGNITION_IDS.length)` and requires each label/description to match the authored contract, and `migrateCaseRecord` has no path from four items to five. Every saved four-item record would fail to load, and `CaseProgressPanel` autosaves on the first dispatch of the recovered session — so the failure would not merely refuse the record, it would overwrite it. That is a silent progress wipe on upgrade, against NFR12.

AC3 is satisfied without it:
- nothing this story adds can reduce, withhold, or gate a recognition item — verify by test;
- the existing `calibrated-conclusion` item already fires for "a reviewed revision that makes a bounded claim without an overreach finding", which is exactly the path a player walks when they revise away from an overreaching proposal after the critique. Pin that path with the test in Task 10.

If a dedicated item is genuinely wanted, it is a `schemaVersion` 4 migration and its own story. See Open Question 2.

### Content authoring notes for the critique lines

- Voice: a respected corpuscular-theory natural philosopher who demands a reproducible, intelligible account — public critique, counter-explanation, a demand for demonstration. His scepticism exposes weak communication; it is never contempt (`narrative-design.md` §Mr. Arthur Bell — Young).
- Each line names one specific thing: the claim that outruns the evidence, the measurement that was never taken, or the reach past the apparatus. Generic disapproval is not a critique.
- It never states the defensible conclusion, never ranks the four proposals, and never tells the player which card to click.
- No score, timer, "attempt", "failed", "penalty", or "locked" language in any locale.
- `encodesPath` will reject a line naming a scene, phase, or route — in English by word (`scene`, `phase`, `route`, and any arrow), and in French by phrase (`ouvrez`/`allez`/`passez` … `scène`/`phase`/`étape`/`écran`). Write "come back with another measurement", not "return to the lab scene".
- The four authored conclusions differ in kind, and the critiques should too: `conclusion-spacing-varies` and `conclusion-both-settings` are *defensible given enough evidence*, so their critiques are about **missing evidence**; `conclusion-wave-settled` and `conclusion-universal-optics` carry `supportPredicate: { kind: 'never' }`, so theirs are about **overreach**.

### Architecture compliance

- `src/domain/` stays pure TypeScript — no Phaser, DOM, `fetch`, IndexedDB, browser APIs, **or Zod**. `rivalLabRules.ts` and the `CaseDefinition` types obey this; the schema lives in `src/schemas/`.
- Scenes read through selectors and write only typed actions. No scene→scene reach-in. The `LectureBookScene` → other-scene coupling is a documented deferral, not a pattern to copy — the new scene is wired through the same existing callback, not by reaching into another scene.
- Every Zod object `.strict()`. Every fallible operation returns `Result<T, ResultError>` and never throws. Error codes resolve to localized copy; a raw error never reaches the player.
- Typed actions are `domain.verbPastTense` (`theory.conclusionSubmitted`, `rivalLab.revisionRequested`). Files: `PascalCase.ts` for classes, `camelCase.ts` for non-class modules. Constants `UPPER_SNAKE_CASE`. JSON fields `camelCase`.
- Case content under `public/cases/` is immutable authored content; player progress lives only in IndexedDB. Bump `CaseDefinition.version` on the contract change and keep the record-compatibility allowlist honest.
- Renderer contract: `create()` / `render(state)` / `destroy()`, with the renderer owning every display object, tween, timer, and listener it creates and releasing all of them on `destroy()`.
- Performance: no logging, JSON parsing, IndexedDB access, or transient allocation in a render path; text resolution stays capped through `textStyles.textResolution()`.

### Deviation from the architecture document, stated explicitly

`game-architecture.md` §Content Model lists `rivalLabCritiques[]` as a flat top-level array. This story groups them under a `rivalLab` object instead, because the rival's identity (`name`, `accentColor`) has to live somewhere and project-context forbids putting him in `colleagues[]`. This is the same kind of realization as `ConclusionSupportPredicate`, which the architecture sketches as a function and the code implements as authored data — the intent is preserved, the shape is what JSON can carry. Note it in the Completion Notes so review does not read it as drift.

### Testing requirements

- Unit-test all pure logic with Vitest and fixtures. Never require Phaser or a browser to test critique selection, schema validation, or reducers.
- For Phaser-adjacent logic, inject the structural slice — `SceneRouterTarget` is the reference pattern. Vitest has no canvas.
- Assert public actions, selectors, and rendered text. Never Phaser private fields, pixel snapshots, or internal store shape.
- Never assert a magic number that a test shares with source unless both read one exported constant — export the renderer's wrap bounds and font sizes for the browser tests.
- Playwright runs with `PLAYWRIGHT_BROWSERS_PATH=0`. Establish the baseline on `26dcaf9` first; `deferred-work.md` lists specs that fail there (the stale `Record prepared observation` button in ~6 specs; the `young-experiment.spec.ts` disabled-state mismatch; and six firefox/webkit baseline failures recorded in `docs/validation/young-technical-evidence.md`).
- Keep the reduced-motion / no-flashing check. Add no new a11y-parity assertions and delete no existing a11y specs.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1. `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Zod 4's `z.lazy` inference gap is why `ConclusionSupportPredicateSchema` writes its depth out explicitly — the new schemas are flat and need nothing similar.

### Project Structure Notes

- **New:** `src/domain/review/rivalLabRules.ts`, `src/adapters/phaser/scenes/RivalLabScene.ts`, `src/adapters/phaser/renderers/RivalLabRenderer.ts`, `tests/unit/RivalLabRules.test.ts`, `tests/integration/RivalLabCritique.test.ts`, `tests/e2e/rival-lab.spec.ts`.
- **Revised:** `public/cases/young-interference/case.json`, `src/domain/cases/CaseDefinition.ts`, `src/domain/cases/ScenarioScript.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/schemas/CaseRecordSchema.ts`, `src/core/store/{AppState,AppAction,selectors,CaseRecordProjection}.ts`, `src/adapters/phaser/SceneRouter.ts`, `src/game/main.ts`, `src/main.ts`, `src/core/i18n/locales/{en,fr}.ts`, `tests/unit/{CaseDefinition,CaseRecordSchema,SceneRouter}.test.ts`, `tests/integration/ProposalSelection.test.ts`, `tests/e2e/french-typography.spec.ts`.
- **Do not touch:** any `src/ui/*` panel, `src/game/scenes/*` (orphaned template leftovers), `src/domain/theory/conclusionReadiness.ts`, `src/domain/review/peerReviewRules.ts`, `src/domain/recognition/recognitionRules.ts`, `docs/validation/*`, `dist/`, `.claude/worktrees/**`.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.0) — the rules that bind this story:

- **Engine:** Phaser scenes own all interactive presentation; the only non-Phaser surfaces are the boot frame and `src/ui/print/CaseRecordPrintView.ts` + `src/adapters/export/`. Never add semantic HTML to reach parity with a Phaser control. `src/ui/*` panels are retired-but-mounted — do not extend or restyle them. `src/game/scenes/*` are orphaned leftovers. Never author player-facing copy in `create()`. A routing failure must never escape the store subscriber. Honour `prefers-reduced-motion` in any animated renderer.
- **Guided adventure:** everything is authored. The rival lab (Mr. Arthur Bell) critiques an unsupported claim and routes back to revision — **narrative dressing, never a fail state**, and he is **not** a member of `colleagues[]`. Defensibility is evaluator/critique-only; never expose a proposal as "correct" up front and never leak a defensibility field into a display projection. No hard fail, score, speed reward, or reward for overclaiming. Authored copy must not name a scene, phase, or route.
- **i18n:** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface carries the EN+FR requirement as part of its own acceptance criteria** — the project's most-repeated defect, and rival-lab critiques are named on the checklist. Prose the player reads is `LocalizedText`; interface strings go through `translate`/`createTranslator`; proper nouns stay plain strings. Never give `locale` an optional `DEFAULT_LOCALE` default. Do not add a webfont.
- **Organization:** `src/domain/` pure (no Phaser/DOM/browser APIs/Zod); `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No `services/`, `managers/`, or `helpers/`. Case definitions immutable under `public/cases/`; progress only in IndexedDB. Bump `CaseDefinition.version` on a contract change. Every Zod object `.strict()`. Fallible operations return `Result`.
- **Platform:** static web app; no analytics, cloud save, or remote config. Offline reload is a release gate. Never expose a raw error to the player; never log learner-entered conclusions.
- **Testing:** unit-test pure domain logic with Vitest and never require a browser for it; inject structural slices rather than a real `Phaser.Game`; check the baseline before blaming your change; verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.

### Previous story intelligence (2.4, and the 1.11/1.12 reviews)

- **2.4 shipped the validation instrument, not the gate.** The gate itself stays Blocked until 2.5 and 2.6 ship. Nothing in `docs/validation/` needs editing here.
- **Localize as you build, not after.** 2.4's single real code defect was an English-only surface shipped months after the i18n foundation. Every string this story adds is bilingual on the first commit.
- **Measured layout, never a constant.** Both the 1.11 and 1.12 reviews found the same class of bug — one object positioned against a fixed offset while the object above it grew with French copy, producing overlap or off-canvas content. The new renderer measures.
- **A refused dispatch must be visible.** `createStore` short-circuits every dispatch during an exclusive progress operation, so a click during an export legitimately fails. `ColleagueRenderer` surfaces that as a transient message; the new control does the same.
- **Hit areas do not resize themselves.** If the revise control is ever repositioned or resized, write `input.hitArea.width/height` directly — `setInteractive` a second time only re-enables, it does not rebuild the shape (`ProposalChoice.resizeHitArea`).
- **Do not import Phaser at module scope in anything a Playwright spec imports.** Phaser touches `window` at import time and the specs run in Node — that is why `ProposalChoice` duck-types its hit area instead of using `instanceof`.

### Git intelligence

Recent commits (`Review 2.4`, `Dev 2.4`, `Story 2.4`, `Review 1.12`, `Dev 1.12`, `Review 1.11`) establish the working rhythm: story → dev → review, one commit each, with review findings folded back into the story file and unowned items pushed to `deferred-work.md`. 1.11 and 1.12 are the closest technical precedents — they built the proposal system and the dialogue/choice widgets this story renders alongside. Read `ColleagueRenderer`, `ProposalChoice`, and `DialogueBox` before writing the new renderer; every guard in them exists because a review found the defect it prevents.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.5` — the four authored ACs; §Story 2.3 for the "indefensible choice routes to the rival-lab critique" contract; §Story 2.6 for what is *not* in scope]
- [Source: `_bmad-output/game-architecture.md` — §Dialogue, Colleague Proposals, and Rival-Lab Critique; §Evidence-to-Conclusion Gate; ADR-001 v1.1, ADR-003, ADR-006, ADR-008, ADR-009, ADR-010; §Directory Structure; §System Location Mapping; §Architectural Boundaries; §Consistency Rules]
- [Source: `_bmad-output/project-context.md` — revision 2.0; engine, guided-adventure, i18n, organization, testing, platform, and don't-miss rules]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md` — decision C, "narrative dressing, no hard fail"; §2.5 technical impact ("Extend" the `CaseDefinition` schema with rival-lab lines)]
- [Source: `_bmad-output/narrative-design.md` §Mr. Arthur Bell — Young — voice, goals, methods, sympathetic elements]
- [Source: `src/domain/theory/conclusionProposals.ts`, `src/core/store/selectors.ts:171-182` — the evaluator and the defensible-set selector, both already built for this story]
- [Source: `src/core/store/AppState.ts:499-522,597-626,661-678` — the choice reducer's documented boundary, the revision-save timestamp discipline, and the replay clear list]
- [Source: `src/adapters/phaser/SceneRouter.ts`, `src/domain/cases/ScenarioScript.ts`, `src/game/main.ts:26-67`, `src/main.ts:127-144` — routing, the scene-key vocabulary, the registry, and the overlay-suppression wiring]
- [Source: `src/adapters/phaser/renderers/ColleagueRenderer.ts`, `src/adapters/phaser/ui/ProposalChoice.ts`, `src/adapters/phaser/ui/DialogueBox.ts` — the renderer patterns and every guard to preserve]
- [Source: `src/schemas/CaseDefinitionSchema.ts:229-235,255-289,393-537` — proposal/scenario schemas and the `superRefine` block the new rules join; `encodesPath` at :302-321]
- [Source: `src/schemas/CaseRecordSchema.ts:51-65,98-133,145-204` — the optional-additive precedent, the allowlist, and the proposal-ID sanitization]
- [Source: `src/domain/review/peerReviewRules.ts:21-31,69-83` — the persisted-prose trap this story must not repeat]
- [Source: `src/domain/recognition/recognitionRules.ts`, `src/schemas/CaseRecordSchema.ts:67-96` — why a fifth recognition item is a migration, not an addition]
- [Source: `public/cases/young-interference/case.json` — `version 1.8.0`; the four `conclusionProposals` and their `supportPredicate`s; the `colleagues` cast and accent colours; the `scenarioScript`]
- [Source: `tests/integration/ProposalSelection.test.ts:317-390` — the `pending Story 2.5` block to update; `tests/unit/CaseDefinition.test.ts:385-410` — the `RivalLab` scene-key rejection to preserve]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — baseline-failing e2e specs; the allowlist-honesty carry-forward; the `SceneRouter` console carry-forward]
- [Source: `_bmad-output/implementation-artifacts/2-4-young-learning-and-educator-validation-gate.md` — the 2.5/2.6 dependency and the "build the instrument, block the gate" split]
- [Source: `docs/validation/young-validation-plan.md`, `young-release-decision-template.md`, `young-bilingual-completeness-template.md` — the Blocked rows this story is a prerequisite for]

### Open questions for the reviewer (do not block implementation)

1. **AC3's "proceeds to the debrief phase."** Implemented as "the critique clears and the existing review → revision → debrief path is unobstructed", because advancing the phase directly from a defensible submit would bypass `evaluateConclusionReadiness`, `revision.saved`, and the completion contract that `validateCaseRecordForDefinition` enforces. Confirm this reading, or specify what a defensible submit should advance.
2. **Recognition signal for revision.** AC3 is met by "nothing is lost, and `calibrated-conclusion` still fires". A dedicated `revision-after-critique` item would need a `schemaVersion` 4 migration — worth its own story if the design wants an explicit positive signal.
3. **Submit control on the theory board.** `theory.conclusionSubmitted` implies an explicit submit affordance next to the four cards. This story adds the action and the rival-lab surface; if the theory board should instead treat *choosing* as submitting, say so — it removes a control but makes the choice no longer freely revisable without a critique, which reads as a worse fit for the design.
4. **`rivalLab` object vs. flat `rivalLabCritiques[]`.** Grouped so the rival's identity has a home outside `colleagues[]`. Confirm, and fold the decision back into `game-architecture.md` §Content Model if accepted.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via `gds-dev-story`.

### Debug Log References

- **e2e baseline on `26dcaf9`** (git worktree, chromium): **7 failed / 34 passed**. The failures are exactly the ones `deferred-work.md` records — `accessibility`, `curated-record:179`, `inquiry-recognition`, `offline-reload:72`, `progress-portability`, `theory-board` (all six clicking the retired `Record prepared observation` button) and `young-experiment:12` (the hard-`disabled` "Run experiment" mismatch).
- **e2e on this branch**: **7 failed / 38 passed** — the *same* seven specs, plus the four new passing cases (three in `rival-lab.spec.ts`, one in `french-typography.spec.ts`). No regression.
- `npm run typecheck` clean. `npm test` **507 passed / 0 failed** (was 428 before this story).
- Two test fixtures needed the new required field rather than a behaviour change: `tests/unit/CaseDefinition.test.ts`'s `validYoungCase` gained a `rivalLab`, and `tests/integration/DialogueAndChoice.test.ts`'s exact record/state field lists gained `critiqueHistory` (and `rivalLabCritique` for the state list).
- `validCritiqueHistory` short-circuits on an absent or empty log. Without that, several partial `CaseDefinition` fixtures that legitimately omit `conclusionProposals` threw on every record validation.

### Completion Notes List

**What shipped.** The rival lab (Mr. Arthur Bell) as authored content in `case.json` v1.9.0 with one critique per conclusion proposal; pure critique selection in `src/domain/review/rivalLabRules.ts`; `theory.conclusionSubmitted` and `rivalLab.revisionRequested` in the store; a transient `rivalLabCritique` plus a persisted `critiqueHistory`; the router override; `RivalLabScene` + `RivalLabRenderer`; optional-additive persistence; EN+FR for every string; and unit, integration, and browser coverage.

**Deviations and decisions the reviewer should look at:**

1. **A submit control was added to the theory board — beyond the literal task list.** AC1 is written as "when the choice is submitted", and Task 10/11 require an e2e and a manual pass that submit a conclusion, but no task adds an affordance that dispatches `theory.conclusionSubmitted`. Without one the whole feature is unreachable in the running game and AC1 is unverifiable. So `ColleagueRenderer` grows a submit control **on the conclusion board only**, in the heading row (the heading's wrap width narrows to make space) rather than in a band below the cards, which would have taken height out of `cardGeometry`'s already-tight budget. This is the "explicit submit affordance" of **Open Question 3**, implemented the way that question's first reading describes: choosing stays freely revisable and draws nothing; submitting is the deliberate act that invites the challenge. If the reviewer prefers choose-as-submit, this control and `theoryBoard.submit` are what to remove.
2. **A fourth error code, `invalid-critique-timestamp`.** Task 4 asks for `reduceRevisionSave`'s timestamp discipline but Task 9 lists only three error keys. Since "every code a reducer can return needs one", the fourth was added to both locale bundles.
3. **`rivalLab` object rather than a flat `rivalLabCritiques[]`** (Open Question 4), as the story directs, so the rival's identity has a home outside `colleagues[]`. `game-architecture.md` §Content Model still describes the flat array; folding this in is a documentation follow-up, not drift.
4. **AC3 implemented as Open Question 1 describes** — a defensible submit clears the critique and changes nothing else; the existing review → `revision.saved` → `case.debriefCompleted` chain is untouched. Pinned by a test that a defensible submit leaves the phase at `synthesis` and `theory.reviewRequested` then succeeds.
5. **No fifth recognition item** (Open Question 2). AC3 is met by proof rather than by a new signal: `tests/integration/RivalLabCritique.test.ts` asserts the post-critique completion's `recognition` is **deep-equal** to the same completion with no critique, and that `calibrated-conclusion` is achieved on the revised path.
6. **The revise control is anchored to the canvas floor**, not measured from the critique body. The body is unbounded by design (truncating the objection is the one thing this surface must not do), so a control trailing it has no ceiling — and a control past y=768 on a fixed `Scale.FIT` surface is a player with no way back, which is precisely the fail state this story exists to avoid. The prose above it is measured-stacked, and the guide is clamped to sit just above the control so a refused dispatch stays legible beside the control that refused it.
7. **`SCENE_KEYS` is unchanged.** `ROUTABLE_SCENE_KEYS` widens the runtime registry only, and `tests/unit/CaseDefinition.test.ts` now pins `RivalLab`-as-authored-`sceneKey` rejection explicitly as well as through the pre-existing case.
8. **`peerReviewRules` and `overreachPhrases` untouched**, as directed. `tests/integration/ProposalSelection.test.ts`'s `pending Story 2.5` block was rewritten to record that 2.5 landed, with its peer-review assertions unchanged and one new case for the critique the submit now draws.

**Not done — needs a human:** Task 11's *manual* visual pass at 1280×720 ("confirm a critique appears, reads fairly, and returns to the board with the choice intact"). Everything mechanical about it is automated — `tests/integration/RivalLabCritique.test.ts` submits all four conclusions in both locales from a thin-evidence state and asserts the authored line for that locale plus the absence of punitive vocabulary, and `tests/e2e/rival-lab.spec.ts` walks the canvas route in EN and FR — but "reads fairly" is an editorial judgement, and no automated check substitutes for looking at the rendered surface.

### File List

**New**

- `src/domain/review/rivalLabRules.ts`
- `src/adapters/phaser/scenes/RivalLabScene.ts`
- `src/adapters/phaser/renderers/RivalLabRenderer.ts`
- `tests/unit/RivalLabRules.test.ts`
- `tests/integration/RivalLabCritique.test.ts`
- `tests/e2e/rival-lab.spec.ts`

**Modified**

- `public/cases/young-interference/case.json`
- `src/domain/cases/CaseDefinition.ts`
- `src/domain/cases/ScenarioScript.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/core/store/AppState.ts`
- `src/core/store/AppAction.ts`
- `src/core/store/selectors.ts`
- `src/core/store/CaseRecordProjection.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/adapters/phaser/SceneRouter.ts`
- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `src/game/main.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/SceneRouter.test.ts`
- `tests/integration/ProposalSelection.test.ts`
- `tests/integration/DialogueAndChoice.test.ts`
- `tests/e2e/french-typography.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

`src/main.ts` needed no edit: its `onSceneActivated` callback and `SceneRouterTarget` literal are inline, so both widened to `RoutableSceneKey` by inference.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-06 | 1.0 | Story created — comprehensive context for the rival-lab critique and revision loop. | Alexis (via create-story) |
| 2026-08-06 | 1.1 | Implemented: authored rival lab in case.json 1.9.0, pure critique selection, store actions and critique history, router override and `RivalLabScene`, additive persistence, EN+FR strings, and unit/integration/e2e coverage. Added a theory-board submit control (Open Question 3) so AC1 is reachable. | Amelia (dev agent) |

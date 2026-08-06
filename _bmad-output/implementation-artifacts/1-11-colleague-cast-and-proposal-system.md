# Story 1.11: Colleague cast and proposal system

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a cast of colleagues who offer predictions, hints, and conclusions,
so that the reasoning is delivered as an authored, character-driven experience.

## Acceptance Criteria

Verbatim from `epics.md` (Story 1.11), numbered for traceability:

1. **Given** a case definition with `colleagues[]`, `predictionProposals[]`, and `conclusionProposals[]`,
   **When** the content is loaded,
   **Then** Zod validates each colleague (id, role, portrait/silhouette asset), each prediction proposal, and each conclusion proposal (claim, limitation, `supportPredicate`),
   **And** invalid content returns a typed recoverable `Result` before domain logic.

2. **Given** the prediction phase,
   **When** the ColleaguesScene presents the four predictions,
   **Then** each is attributed to a colleague and the player's choice is recorded through a typed action,
   **And** the choice is revisable and never blocks progress.

3. **Given** the evaluator's defensible-conclusion set,
   **When** the theory board presents the four conclusions,
   **Then** each conclusion is attributed to a colleague and selecting one records the chosen proposal ID,
   **And** the proposal system exposes which proposals are defensible only to the evaluator/critique, never as an up-front "correct" marker.

4. **Given** the proposal system,
   **When** tests run,
   **Then** unit tests cover proposal validation and support-predicate evaluation,
   **And** integration tests verify prediction/conclusion selection through public store actions.

## Scope and implementation decisions

This story builds **the system** — content contract, validation, typed actions, pure defensibility evaluation, persistence — plus the **minimum in-scene presentation** the ACs require (attributed proposals that dispatch the typed action). It does **not** build the surrounding flow.

### IN scope

- `colleagues[]`, `predictionProposals[]`, `conclusionProposals[]` in the `CaseDefinition` type, the Zod schema, and the Young `case.json` (Task 1–2).
- A **declarative, JSON-authorable** `supportPredicate` plus a pure evaluator returning the defensible-conclusion ID set (Task 3).
- Two typed actions (`prediction.proposalChosen`, `theory.conclusionProposalChosen`), their reducers, state fields, selectors, and record persistence (Task 4–5).
- A `ColleagueRenderer` used by `ColleaguesScene` and `TheoryBoardScene` to render four attributed proposals and dispatch the choice (Task 6).
- EN+FR for every new string (Task 7).

### OUT of scope — do NOT build here

| Not this story | Owner |
|---|---|
| Reusable Phaser `DialogueBox` / `ProposalChoice` widgets, dialogue beats | Story 1.12 |
| LibraryScene reading + the full Young prediction flow / gating copy | Story 2.1 |
| Significant-measure gate, colleague **hints**, conclusion unlock timing | Story 2.3 / 2.6 |
| RivalLabScene critique on an indefensible pick, revision routing | Story 2.5 |
| `significanceRule`, `rivalLabCritiques[]` case fields | Story 2.6 / 2.5 |
| **Retiring any `src/ui/*` DOM panel** | Stories 2.1, 2.3, 2.5 |

The ACs mention "hints" in the user-story sentence only; every hint AC lives in Story 2.6. Build the cast and the proposals — not the hint selector.

### Decision — `supportPredicate` is authored data, never a function

`game-architecture.md` §"Evidence-to-Conclusion Gate" sketches `c.supportPredicate(progress)` as a call. **That is pseudo-code.** Case content is versioned JSON validated by Zod (ADR-003); a JSON file cannot carry a function, and `eval`/`new Function` is out of the question. Author `supportPredicate` as a **discriminated-union predicate object**, exactly like the existing `ConsultationPredicate` (`src/domain/cases/CaseDefinition.ts:109-113`), and interpret it in a pure evaluator.

Predicate kinds to ship (keep this set — later cases extend it, Story 3.1):

```ts
type ConclusionSupportPredicate =
    | Readonly<{ kind: 'never' }>                                   // an overreaching claim no evidence defends
    | Readonly<{ kind: 'minimum-runs'; count: number }>
    | Readonly<{ kind: 'varied-control'; controlId: PrimaryControl['id'] }>  // ≥2 distinct values recorded
    | Readonly<{ kind: 'inspected-source'; sourceId: string }>
    | Readonly<{ kind: 'all-of'; predicates: readonly ConclusionSupportPredicate[] }>;
```

`all-of` nests, so keep the recursion depth bounded in the schema (`z.lazy` with a max depth of 3) and reject an empty `predicates` array — an empty `all-of` is vacuously true and would silently make an overreaching claim defensible.

### Decision — the new choice actions *also* write the existing canonical text fields

The pre-pivot free-text `prediction` (`AppState.prediction`) and `theory.conclusion` / `theory.limitation` are load-bearing far beyond the theory board: `evaluatePredictionReadiness`, `evaluateConclusionReadiness`, `evaluatePeerReview`, `DecisionHistoryEntry`, the print view, and `validateCaseRecordForDefinition` all read them. Ripping them out would break every phase gate and every saved record.

So each new reducer writes **both**:

| Action | Sets | Also sets (canonical `.en`) |
|---|---|---|
| `prediction.proposalChosen` | `selectedPredictionProposalId` | `prediction` = proposal `text.en` |
| `theory.conclusionProposalChosen` | `selectedConclusionProposalId` | `theory.conclusion` = `claim.en`, `theory.limitation` = `limitation.en` |

`.en` on purpose — it is the canonical locale the domain and every persisted record use (`docs/i18n-authoring.md` §"Canonical-value traps"). A French player's saved record must revalidate byte-identically in English.

**The inverse invariant must hold too.** The DOM panels still dispatch `prediction.recorded`, `theory.conclusionSet`, and `theory.limitationSet`. Each of those must **clear** the corresponding `selected*ProposalId`, or a hand-typed conclusion would keep claiming to be proposal `c-2`. Record validation then enforces: *if a proposal ID is present, the text fields equal that proposal's canonical text.*

### Decision — silhouettes, not new binary art

`portrait` is a discriminated union so the Young case can ship without new image files:

```ts
type ColleaguePortrait =
    | Readonly<{ kind: 'asset'; assetId: string }>     // must exist in assets.entries
    | Readonly<{ kind: 'silhouette'; accentColor: string }>;  // /^#[0-9a-f]{6}$/
```

Young authors four `silhouette` portraits. **Do not add image files**: `loadCaseDefinition.ts:10-16` (`manifestsMatch`) requires `case.json`'s `assets` block and `public/cases/young-interference/asset-manifest.json` to match exactly, so any added asset means editing both files in lockstep for art that does not exist yet. A `kind: 'asset'` portrait whose `assetId` is absent from `assets.entries` must be a Zod failure.

### Decision — `colleague.name` is canonical, `colleague.role` is a stable enum

`name` is a proper noun and follows the existing `creatorOrOrigin` precedent (`CaseDefinition.ts:72`) — a single string, not `LocalizedText`. `role` is a stable enum (`'lead' | 'builder' | 'analyst' | 'communicator'`, per the narrative doc's voice distinctions) resolved for display through `t('colleague.role.<role>')`. Everything a player *reads as prose* — proposal text, claim, limitation — is `LocalizedText`.

### Decision — the Young cast

From `narrative-design.md` §Characters (§141, §278-300):

| id | name | role |
|---|---|---|
| `thea-young` | Dr. Thea Young | `lead` |
| `elias-wren` | Elias Wren | `builder` |
| `marianne-cole` | Marianne Cole | `analyst` |
| `samuel-hart` | Samuel Hart | `communicator` |

Four colleagues, four prediction proposals, four conclusion proposals — one voice each. **Mr. Arthur Bell is the rival lab, not a colleague** (Story 2.5); do not add him to `colleagues[]`.

## Tasks / Subtasks

- [ ] **Task 1 — Domain types for the cast and proposals (AC: 1)**
  - [ ] New file `src/domain/cases/ColleagueCast.ts`: `ColleagueRole`, `ColleaguePortrait`, `Colleague`, `PredictionProposal`, `ConclusionProposal`, `ConclusionSupportPredicate`. Pure TypeScript — no Phaser, DOM, or Zod import.
  - [ ] Shapes: `Colleague { id: string; name: string; role: ColleagueRole; portrait: ColleaguePortrait }`; `PredictionProposal { id: string; colleagueId: string; text: LocalizedText }`; `ConclusionProposal { id: string; colleagueId: string; claim: LocalizedText; limitation: LocalizedText; supportPredicate: ConclusionSupportPredicate }`.
  - [ ] Add three fields to `CaseDefinition` (`src/domain/cases/CaseDefinition.ts`): `colleagues: readonly Colleague[]`, `predictionProposals: readonly PredictionProposal[]`, `conclusionProposals: readonly ConclusionProposal[]`.

- [ ] **Task 2 — Zod validation and Young content (AC: 1)**
  - [ ] Extend `src/schemas/CaseDefinitionSchema.ts` with `ColleagueSchema`, `PredictionProposalSchema`, `ConclusionProposalSchema`, `ConclusionSupportPredicateSchema`. Every object `.strict()`, matching the file's existing style.
  - [ ] Wire into `CaseDefinitionSchema`: `colleagues: z.array(ColleagueSchema).min(1)`, `predictionProposals: z.array(...).length(4)`, `conclusionProposals: z.array(...).length(4)`. Use `.length(4)` **not** `.min(4)` — the pivot is explicitly 1-of-4 for both.
  - [ ] Cross-field rules in the top-level `superRefine` (that is where every other cross-field rule already lives, `CaseDefinitionSchema.ts:303`):
    - colleague IDs unique; proposal IDs unique **within each set**;
    - every `colleagueId` resolves to an authored colleague;
    - every `portrait.kind === 'asset'` `assetId` exists in `assets.entries`;
    - every `inspected-source` predicate's `sourceId` is an authored artifact; every `varied-control` predicate's `controlId` is an authored control (mirror `CaseDefinitionSchema.ts:336-342`);
    - an `all-of` with an empty `predicates` array is rejected;
    - **at least one conclusion proposal has a predicate other than `never`** — otherwise the case is uncompletable by construction.
    - apply the existing `encodesPath` check to every proposal `text` / `claim` / `limitation`: authored copy must not name a scene, phase, or route.
  - [ ] Author the four colleagues and both proposal sets in `public/cases/young-interference/case.json`. Bump `version` `1.6.0 → 1.7.0`. **Edit only `public/cases/…`** — `dist/` is build output and `.claude/worktrees/**` is a stale copy.
  - [ ] Author exactly one conclusion proposal that is defensible on the minimum Young path (`all-of`: `minimum-runs: 2` + `varied-control: slitSpacingMm` + both `inspected-source`s), one that additionally needs a second varied control, and two that overreach (`never`).
  - [ ] **Extend the save-compat allowlist** in `validateCaseRecordForDefinition` (`src/schemas/CaseRecordSchema.ts:142-144`) so `1.7.0` accepts `1.2.0`–`1.6.0` records. Skipping this discards every saved investigation on upgrade (NFR12).
  - [ ] **Bump `CACHE_NAME` in `public/sw.js`** (`v2 → v3`). The schema is `.strict()` with three new required fields, so a cached pre-1.11 `case.json` boots into "content unavailable" with no offline recovery.
  - [ ] Unit tests in `tests/unit/CaseDefinition.test.ts`: the valid fixture parses (assert on `parsed.data`, not the input object); each cross-field rule above rejects independently.

- [ ] **Task 3 — Pure defensibility evaluator (AC: 3, 4)**
  - [ ] New file `src/domain/theory/conclusionProposals.ts`. Export `evaluateSupportPredicate(predicate, evidence): boolean` and `selectDefensibleConclusionIds(definition, evidence): readonly string[]`, where `evidence` is the existing `AuthoritativeEvidence` shape (`src/domain/theory/conclusionReadiness.ts:11`).
  - [ ] Predicate semantics: `never` → false; `minimum-runs` → `evidence.runs.length >= count`; `varied-control` → `new Set(runs.map(r => r.controls[controlId])).size >= 2`; `inspected-source` → `inspectedSourceIds.includes(sourceId)`; `all-of` → every child true. Freeze the returned array (`Object.freeze`), matching the file's conventions.
  - [ ] Do **not** import Phaser, the store, or `AppState`. Do **not** add the significant-measure count (Story 2.6) or any rival-lab selection (Story 2.5).
  - [ ] Unit tests `tests/unit/ConclusionProposals.test.ts`: each predicate kind true and false; nested `all-of`; the Young authored set yields a non-empty defensible set at the minimum evidence path and an empty one at zero evidence.

- [ ] **Task 4 — Typed actions, reducers, and state (AC: 2, 3)**
  - [ ] `src/core/store/AppAction.ts`: add `PredictionProposalChosenAction { type: 'prediction.proposalChosen'; proposalId: string }` and `TheoryConclusionProposalChosenAction { type: 'theory.conclusionProposalChosen'; proposalId: string }`; add both to the `AppAction` union.
  - [ ] `src/core/store/AppState.ts`: add `selectedPredictionProposalId?: string` and `selectedConclusionProposalId?: string`; carry them through `freezeState`, `createInitialAppState` (absent), `createAppStateFromCaseRecord`, and `reduceReplayStart` (cleared on replay, alongside `prediction`/`theory`).
  - [ ] `reducePredictionProposalChosen`: fail `unknown-prediction-proposal` when the ID is not authored; reuse `reducePredictionRecord`'s context-readiness guard (`AppState.ts:387-391`) so the same gate applies; set `selectedPredictionProposalId` **and** `prediction` = proposal `text.en`; clear `consultation`/`peerReview` as the neighbouring reducers do. Re-choosing is allowed — the choice is revisable (AC2) and must never fail on "already chosen".
  - [ ] `reduceTheoryConclusionProposalChosen`: fail `unknown-conclusion-proposal` for an unauthored ID; set `selectedConclusionProposalId` **and** `theory.conclusion` = `claim.en`, `theory.limitation` = `limitation.en`. **Do not** advance the phase, evaluate defensibility, or block on it here — the choice records; the gate and the critique are Stories 2.3/2.5/2.6.
  - [ ] **Clear the IDs on the free-text paths**: `prediction.recorded` clears `selectedPredictionProposalId`; `theory.conclusionSet` and `theory.limitationSet` clear `selectedConclusionProposalId`. Without this the record carries a proposal ID whose text no longer matches.
  - [ ] Add both cases to the `reduceAppState` switch.
  - [ ] Add `error.unknown-prediction-proposal` / `error.unknown-conclusion-proposal` keys to `en.ts` **and** `fr.ts` (`selectLocalizedError` resolves by code).

- [ ] **Task 5 — Persistence and selectors (AC: 2, 3)**
  - [ ] `src/schemas/CaseRecordSchema.ts`: add `selectedPredictionProposalId: text.optional()` and `selectedConclusionProposalId: text.optional()`. **Keep `schemaVersion: 3`** — optional additive fields need no bump and no migration (the same precedent as `selectedWavelengthNm`, `CaseRecordSchema.ts:99`). `migrateCaseRecord.ts` is untouched.
  - [ ] In `validateCaseRecordForDefinition`, reject a record whose `selectedPredictionProposalId` is not authored, or whose `prediction` differs from that proposal's `text.en`; likewise for the conclusion proposal against `theory.conclusion` / `theory.limitation`.
  - [ ] `src/core/store/CaseRecordProjection.ts`: project both new fields.
  - [ ] `src/core/store/selectors.ts`: add `selectPredictionProposals`, `selectConclusionProposals`, `selectColleagueById`, `selectSelectedPredictionProposalId`, `selectSelectedConclusionProposalId`, and `selectDefensibleConclusionProposalIds` (delegating to the Task 3 evaluator with the same evidence shape `selectConclusionReadiness` already builds).
  - [ ] Add a **localized proposal projection** selector for the renderer — `{ proposalId, colleagueName, roleLabel, text }` with the active locale applied via `resolveLocalizedText` — carrying **no defensibility field** (AC3).
  - [ ] Unit tests `tests/unit/CaseRecordSchema.test.ts`: a record with a mismatched proposal ID / text pair is rejected; a pre-1.11 record without the fields still loads.

- [ ] **Task 6 — In-scene attributed proposals (AC: 2, 3)**
  - [ ] New `src/adapters/phaser/renderers/ColleagueRenderer.ts` (this exact path is in the architecture target tree, `game-architecture.md:392`). Renderer-factory shape matching `ApparatusRenderer`: `create()`, `render(state)`, `destroy()`; the factory owns every display object it makes.
  - [ ] It renders a heading, the silhouette accent, `name — role`, and the proposal text for each of the four proposals, plus a visible selected-state indicator that is **not colour alone** (a label/marker), and dispatches the typed action on click.
  - [ ] Keep the visual treatment deliberately plain. Story 1.12 extracts the generic `DialogueBox` / `ProposalChoice` widgets and this renderer becomes their consumer — do not invent a widget framework here.
  - [ ] Wire it into `ColleaguesScene` (prediction proposals) and `TheoryBoardScene` (conclusion proposals). Both currently extend `PhasePlaceholderScene`; convert them to real `Scene` subclasses following `LaboratoryScene`'s lifecycle exactly — store the `unsubscribe`, `this.events.once('shutdown', this.shutdown, this)`, and destroy the renderer in `shutdown()`. `LibraryScene` and `DebriefScene` stay placeholders.
  - [ ] `TheoryBoardScene` hosts both `synthesis` and `review`; render the conclusion proposals in both, unmarked. **The renderer must never call `selectDefensibleConclusionProposalIds`** — that set is for the evaluator and the (later) critique only.
  - [ ] Resolve every string at **render** time from `selectLocale(state)`, never captured in `create()` or the constructor (`docs/i18n-authoring.md` §"Rendering text").

- [ ] **Task 7 — EN + FR for every new surface (AC: 1–3)**
  - [ ] `src/core/i18n/locales/en.ts`: a new `// --- Colleagues and proposals ---` block with `colleague.role.lead|builder|analyst|communicator`, the scene headings, the selected-state label, and the two new `error.*` codes. Add the identical keys to `fr.ts` — `tsc` will demand them.
  - [ ] Author `fr` for every new `LocalizedText` in `case.json`: all four prediction `text`s, and all four conclusion `claim`s **and** `limitation`s. A missing `fr` is a base-parse Zod failure, not a warning.
  - [ ] Add the new colleague/proposal surfaces to `tests/e2e/french-typography.spec.ts` — French runs 15–25% longer than English and overflow is the likelier failure. Give every authored-copy `Text` a `wordWrap`.
  - [ ] Surface checklist before calling i18n done: role labels · prediction proposal text · conclusion claim · conclusion limitation · scene chrome/headings · selected-state label · both new error codes.

- [ ] **Task 8 — Integration tests through public store actions (AC: 4)**
  - [ ] New `tests/integration/ProposalSelection.test.ts` using a real `createStore`: choosing a prediction proposal sets both the ID and the canonical `prediction`; re-choosing replaces it and never fails; an unauthored ID returns a typed `Result` failure and leaves state untouched; a subsequent `prediction.recorded` clears the ID; the same three cases for the conclusion proposal; a record round-trip through `selectPortableCaseRecord` → `createAppStateFromCaseRecord` preserves both IDs.
  - [ ] Assert public actions and selectors only — never renderer internals or Phaser private fields.

- [ ] **Task 9 — Verify (AC: 1–4)**
  - [ ] `npm run typecheck` clean; `npm run test` all green; `npm run test:e2e` shows **no new failures beyond the tracked baseline** (see Regression baseline below).
  - [ ] Confirm the pre-pivot DOM flow still completes end to end — the prediction and theory-board panels are untouched by this story.

## Dev Notes

### Read these files before writing code

Every one of these is modified or directly constrains this story:

| File | Why |
|---|---|
| `src/domain/cases/CaseDefinition.ts` | `LocalizedText`, the `ConsultationPredicate` union to mirror, and the `CaseDefinition` shape to extend |
| `src/schemas/CaseDefinitionSchema.ts` | `.strict()` + top-level `superRefine` conventions; `encodesPath`; the `ScenarioScript` coverage rule as the model for a new cross-field check |
| `src/core/store/AppState.ts` | Every reducer's `Result` + `freezeState` discipline; `reducePredictionRecord` (:387) and `withTheory` (:400) are the two you extend |
| `src/schemas/CaseRecordSchema.ts` | The optional-field precedent (:99), the compat allowlist (:142), and where the new consistency check goes |
| `src/domain/theory/conclusionReadiness.ts` | `AuthoritativeEvidence` — reuse it, do not define a parallel evidence type |
| `src/adapters/phaser/scenes/LaboratoryScene.ts` | The scene lifecycle/cleanup pattern to copy exactly |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts` | The renderer-factory contract `ColleagueRenderer` must match |
| `docs/i18n-authoring.md` | The canonical-value traps. Read §"⚠️ Canonical-value traps" in full before touching any text field |

### What must not break

The DOM panels in `src/ui/*` are **still the surface the E2E suite drives the flow through**. Story 1.10 kept them deliberately; 2.1/2.3/2.5 retire them scene by scene. This story is **purely additive** to them:

- `src/ui/context/CaseContextAndPrediction.ts` keeps its free-text prediction.
- `src/ui/theory/TheoryBoard.ts` keeps its free-text conclusion and limitation.
- Do not delete, rewire, or localize either. They read authored text as canonical `.en` and use `selectCanonicalSourceLabel` / `selectCanonicalControlValue` on purpose (mixing locale-aware selectors into them produces half-French output).

`LectureBookScene` is auto-started and always active — the game already has ≥2 live scenes, so "the active scene" is not single-valued. Converting `ColleaguesScene` / `TheoryBoardScene` from placeholders must not disturb it, and `tests/e2e/scene-router.spec.ts` asserts `data-active-scene` on `#game-container`; that signal comes from real Phaser activation, so a scene whose `create()` throws will surface there.

### Architecture compliance

- **ADR-003** — case content is versioned JSON validated at runtime; invalid content returns a typed `Result` **before** domain logic. `loadCaseDefinition` already does this; your job is to make the schema reject correctly.
- **ADR-006** — colleague proposals are *data predicates* over authoritative evidence. Rules vary lines and guidance; they never change a case's outcome or bypass required observations and sources.
- **ADR-010** — no display string is hard-coded in a scene, widget, or renderer.
- **Layering** — `src/domain/` stays free of Phaser, DOM, `fetch`, and IndexedDB. `src/adapters/phaser/` reads selectors and dispatches typed actions; it never mutates state.
- **Naming** — `PascalCase.ts` for classes/scenes/renderers, `camelCase.ts` for function modules (`conclusionProposals.ts`), `kebab-case` for case/asset IDs, `noun.verb` for action types.
- **Evaluator is the sole authority** — "Do not hard-code completion in a scene or dialogue branch." A scene must never decide, display, or imply which conclusion is correct.

### Testing standards

- Vitest for `tests/unit/**` and `tests/integration/**` (`npm run test`); Playwright chromium for `tests/e2e/**` (`npm run test:e2e`, which runs `npm run build && npm run preview` on `127.0.0.1:4173`).
- Unit-test every pure calculator, validator, and predicate evaluator. Use fixtures for case definitions; never require Phaser or a browser to test the proposal logic.
- Integration tests assert **public actions and selectors**, not renderer internals or incidental pixels.
- Invalid case content is tested as an expected `Result` failure, and valid local progress must survive a failed load.
- **Regression baseline** — `npm run test:e2e` currently reports **7 pre-existing failures** tracked in `deferred-work.md` (six on the removed `Record prepared observation` notebook button; `young-experiment.spec.ts:19` on the hard-`disabled` Run experiment control). Measure the baseline with `git stash` before you start, and match it exactly afterwards. Do not fix them here.
- Write tests that **can fail**. The 1.10 review found three that could not — one asserted the input fixture rather than `parsed.data`, one asserted the initial phase it had just set, one forged state with `Object.assign` instead of the function under test.

### Project structure notes

- New files: `src/domain/cases/ColleagueCast.ts`, `src/domain/theory/conclusionProposals.ts`, `src/adapters/phaser/renderers/ColleagueRenderer.ts`, `tests/unit/ConclusionProposals.test.ts`, `tests/integration/ProposalSelection.test.ts`.
- The architecture target tree also shows `src/app/`, `createPhaserGame.ts`, `BootScene`, `CaseLoadScene`, and `RivalLabScene`. **None of those exist and none are this story's job** — 1.10 deliberately left that divergence. Add files under the existing `src/adapters/phaser/` layout.
- `dist/` is build output. `.claude/worktrees/**` holds a stale copy of the case content — not the active source.

### Project context rules

`_bmad-output/project-context.md` is dated **2026-08-04, before the 2026-08-05 pivot**. Its engine rules still describe the dual-surface model ("Semantic HTML owns all essential controls…", "Every essential Phaser gesture needs an equivalent semantic HTML control", "Do not make canvas interaction the only way to… conclude"). **Those are superseded by ADR-001 v1.1 / ADR-008 — Phaser is the sole interactive surface and accessibility is de-scoped from the MVP.** Where the two conflict, the pivot wins. Do not build DOM equivalents for the proposal choice.

Rules from that file that **do** still bind this story:

- Phaser 4.2.1 · TypeScript · Vite 8.1.x · `idb` 8.0.3 · **Zod 4.4.3** · Vitest 4.1.10 · Playwright 1.61.1. Do not add a dependency.
- Domain code never imports Phaser. Phaser objects are created, updated, and destroyed only by renderer factories under `src/adapters/phaser/`.
- Scenes mirror case phase; they never define or infer progression.
- No generic `services/` · `managers/` · `helpers/` catch-all directory.
- Only repositories fetch and validate case JSON; case definitions under `public/cases/` are immutable and never mixed with player progress.
- Keep `update()` minimal — prefer store subscriptions over per-frame work; no JSON parsing, IndexedDB access, or transient allocation in render hot paths.
- Do not let consultations or proposals provide the final answer. No hard-fail states, no irreversible wrong choices, no rewards for overclaiming.
- Do not add unreviewed historical assets or claims — the four authored conclusions are in-fiction character positions, not new historical assertions, and the debrief remains the source of historical record.

### Previous-story intelligence

**From 1.10 (scene router)** — the review found eight patterns worth not repeating:

- A scene's `create()` runs **synchronously inside `dispatch()` → `notify()`**, and `createStore` has no try/catch on that chain. A throw in `ColleagueRenderer.create()` leaves the phase advanced, skips every later subscriber, and makes `dispatch` throw instead of returning its contracted `Result`. The router now contains activation failures — keep renderer construction defensive and cheap.
- Exhaustiveness that the type system does not enforce is a runtime stuck-state. `Record<K, V>` over a key union beats an array of tuples.
- Any signal written from *intent* rather than from the real event drifts from reality. Assert on rendered artifacts, not on "we called start".
- Documentation drift was caught in review: test counts that did not reconcile, and a Debug Log claim contradicted by a reproducible baseline. State only what you measured.

**From 1.1b (i18n)** — read `docs/i18n-authoring.md`; it is the durable output of that story. The two traps most likely to bite here:

- **`${localizedText}` inside a template literal compiles fine and prints `[object Object]`.** `tsc` catches the assignment sites, not the interpolation sites. Grep your own diff for it.
- A required field added to the strict case schema means **three** coordinated edits: bump `case.json` `version`, extend the compat allowlist in `validateCaseRecordForDefinition`, bump `CACHE_NAME` in `public/sw.js`. Missing the third boots a returning offline player into "content unavailable".

Adding the French list to `overreachPhrases` was only safe because no French build had saved a record. Your authored conclusion claims now flow into `theory.conclusion`, which `evaluatePeerReview` matches against those phrases — an authored overreaching claim will legitimately trip the overreach rule. That is the intended behaviour (it is the pre-rival-lab critique mechanism), but assert it in a test so a later copy edit cannot silently change which issues a saved record recomputes to.

**Git patterns** — the last three commits are `Story 1.1b` → `Dev 1.1b` → `Review 1.1b`, matching 1.10's `Story` → `Dev` → `Review`. The repo is clean on `main`; branch before committing.

### Latest technical information

- **Zod 4.4.3** — recursive schemas use `z.lazy(() => Schema)` with an explicit `z.ZodType<T>` annotation; Zod 4 infers nothing through `lazy`. Keep the `all-of` nesting shallow and annotated.
- **Zod 4 skips `superRefine` once the base parse fails.** This is why the file has no `.min()` on `scenarioScript.scenes` (`CaseDefinitionSchema.ts:191-193`) and why `LocalizedTextSchema` requires `fr` in the object rather than a refinement. Put a rule where its message will actually surface: `.length(4)` on the proposal arrays is fine (a wrong count is unambiguous), but a rule that needs an authored message belongs in the base object or the top-level refinement.
- **Zod 4 issue construction** is `{ code: 'custom', message, path }` — the shape already used throughout the file. Do not import legacy `ZodIssueCode`.
- **Phaser 4.2.1** — `Phaser.GameObjects.Text` renders through canvas 2D, so glyph coverage is the browser's font resolution. Use the stacks in `src/adapters/phaser/textStyles.ts` (`uiTextStyle` for chrome, `monoTextStyle` for dev markers only). Do not add a webfont — it works against NFR2's cached five-second first interaction and the offline gate.
- Node.js 20.18.1+ is required by the toolchain.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.11: Colleague cast and proposal system] — ACs, verbatim.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.12 / 2.1 / 2.3 / 2.5 / 2.6] — the scope boundary: widgets, library flow, gate, critique, hints.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md#2.1] — guided-adventure step ↔ phase ↔ gate table; §2.5 keep/extend/retire verdicts.
- [Source: _bmad-output/game-architecture.md#Content Model] — `colleagues[]`, `predictionProposals[]`, `conclusionProposals[]`, `significanceRule`, `rivalLabCritiques[]`.
- [Source: _bmad-output/game-architecture.md#Dialogue, Colleague Proposals, and Rival-Lab Critique] — proposals as case data over authoritative evidence.
- [Source: _bmad-output/game-architecture.md#Evidence-to-Conclusion Gate] — defensible-conclusion responsibility (the `supportPredicate` call there is pseudo-code; see the decision above).
- [Source: _bmad-output/game-architecture.md#ADR-001, ADR-003, ADR-006, ADR-008, ADR-010] — single Phaser surface, validated data-driven cases, evidence-driven narrative rules, a11y de-scope, bilingual foundation.
- [Source: _bmad-output/game-architecture.md#Directory structure] — `renderers/ColleagueRenderer.ts`, `ui/{DialogueBox,ProposalChoice}.ts` (1.12).
- [Source: _bmad-output/narrative-design.md#Young Team, #Dr. Thea Young, #Mr. Arthur Bell] — the authored cast and voice distinctions.
- [Source: docs/i18n-authoring.md#Canonical-value traps, #Adding case content] — `.en` canonical rule; the version/allowlist/`CACHE_NAME` triad.
- [Source: src/domain/cases/CaseDefinition.ts] — `LocalizedText`, `ConsultationPredicate` union to mirror.
- [Source: src/schemas/CaseDefinitionSchema.ts] — `.strict()` + `superRefine` conventions, `encodesPath`.
- [Source: src/core/store/AppState.ts#reducePredictionRecord, #withTheory] — the reducers to extend.
- [Source: src/schemas/CaseRecordSchema.ts#validateCaseRecordForDefinition] — compat allowlist and the record consistency check.
- [Source: src/domain/theory/conclusionReadiness.ts#AuthoritativeEvidence] — the evidence shape to reuse.
- [Source: src/domain/review/ConsultationRule.ts] — the projection pattern (carry both locales, resolve at the surface).
- [Source: src/adapters/phaser/scenes/LaboratoryScene.ts] — scene lifecycle and cleanup.
- [Source: src/adapters/content/loadCaseDefinition.ts#manifestsMatch] — why portraits are silhouettes, not new assets.
- [Source: _bmad-output/implementation-artifacts/1-10-scene-router-and-adventure-flow.md#Review Findings] — the failure patterns not to repeat.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the 7-spec E2E baseline.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date       | Version | Description                                    | Author |
|------------|---------|------------------------------------------------|--------|
| 2026-08-06 | 0.1     | Initial story draft created (gds-create-story) | Alexis |

## Open Questions (for author confirmation — do not block dev)

1. **1.11 before 1.12.** This story renders proposals with a plain `ColleagueRenderer`; 1.12 then extracts the reusable `DialogueBox` / `ProposalChoice` widgets and refactors it. Running 1.12 first would avoid one refactor but leaves 1.12's widgets with no content to render. Confirm the 1.11 → 1.12 order, or swap them.
2. **Is Dr. Thea Young a proposing colleague or the player?** She is the case protagonist in `narrative-design.md`. The cast above makes her the `lead` who voices one of the four proposals, with the player as an unnamed investigator. Confirm, or replace her with a fourth supporting character.
3. **Free-text prediction and conclusion after the pivot.** This story keeps both fields as the canonical persisted text so no gate or saved record breaks, writing them from the chosen proposal. Once 2.1 and 2.3 retire the DOM panels, is free text removed entirely, or retained as an authored-plus-annotation path?
4. **`synthesis` → scene, still open from 1.10.** `TheoryBoardScene` renders the conclusion proposals in both `synthesis` and `review`. Story 2.6 may prefer `synthesis → LaboratoryScene` (stay in the lab to gather significant measures). It is a one-line `case.json` edit either way.
5. **Case-version compatibility policy** (carried from 1.1b Open Question 5). `1.7.0` extends the ad-hoc allowlist in `validateCaseRecordForDefinition` for the third time. Replace it with a declared compatibility range before Epic 3 adds more case versions?

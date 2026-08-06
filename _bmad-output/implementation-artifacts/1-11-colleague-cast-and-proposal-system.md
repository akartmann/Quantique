---
baseline_commit: f66a078e446a308e580bc50464f690d634ec6ac9
---

# Story 1.11: Colleague cast and proposal system

Status: done

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

- [x] **Task 1 — Domain types for the cast and proposals (AC: 1)**
  - [x] New file `src/domain/cases/ColleagueCast.ts`: `ColleagueRole`, `ColleaguePortrait`, `Colleague`, `PredictionProposal`, `ConclusionProposal`, `ConclusionSupportPredicate`. Pure TypeScript — no Phaser, DOM, or Zod import.
  - [x] Shapes: `Colleague { id: string; name: string; role: ColleagueRole; portrait: ColleaguePortrait }`; `PredictionProposal { id: string; colleagueId: string; text: LocalizedText }`; `ConclusionProposal { id: string; colleagueId: string; claim: LocalizedText; limitation: LocalizedText; supportPredicate: ConclusionSupportPredicate }`.
  - [x] Add three fields to `CaseDefinition` (`src/domain/cases/CaseDefinition.ts`): `colleagues: readonly Colleague[]`, `predictionProposals: readonly PredictionProposal[]`, `conclusionProposals: readonly ConclusionProposal[]`.

- [x] **Task 2 — Zod validation and Young content (AC: 1)**
  - [x] Extend `src/schemas/CaseDefinitionSchema.ts` with `ColleagueSchema`, `PredictionProposalSchema`, `ConclusionProposalSchema`, `ConclusionSupportPredicateSchema`. Every object `.strict()`, matching the file's existing style.
  - [x] Wire into `CaseDefinitionSchema`: `colleagues: z.array(ColleagueSchema).min(1)`, `predictionProposals: z.array(...).length(4)`, `conclusionProposals: z.array(...).length(4)`. Use `.length(4)` **not** `.min(4)` — the pivot is explicitly 1-of-4 for both.
  - [x] Cross-field rules in the top-level `superRefine` (that is where every other cross-field rule already lives, `CaseDefinitionSchema.ts:303`):
    - colleague IDs unique; proposal IDs unique **within each set**;
    - every `colleagueId` resolves to an authored colleague;
    - every `portrait.kind === 'asset'` `assetId` exists in `assets.entries`;
    - every `inspected-source` predicate's `sourceId` is an authored artifact; every `varied-control` predicate's `controlId` is an authored control (mirror `CaseDefinitionSchema.ts:336-342`);
    - an `all-of` with an empty `predicates` array is rejected;
    - **at least one conclusion proposal has a predicate other than `never`** — otherwise the case is uncompletable by construction.
    - apply the existing `encodesPath` check to every proposal `text` / `claim` / `limitation`: authored copy must not name a scene, phase, or route.
  - [x] Author the four colleagues and both proposal sets in `public/cases/young-interference/case.json`. Bump `version` `1.6.0 → 1.7.0`. **Edit only `public/cases/…`** — `dist/` is build output and `.claude/worktrees/**` is a stale copy.
  - [x] Author exactly one conclusion proposal that is defensible on the minimum Young path (`all-of`: `minimum-runs: 2` + `varied-control: slitSpacingMm` + both `inspected-source`s), one that additionally needs a second varied control, and two that overreach (`never`).
  - [x] **Extend the save-compat allowlist** in `validateCaseRecordForDefinition` (`src/schemas/CaseRecordSchema.ts:142-144`) so `1.7.0` accepts `1.2.0`–`1.6.0` records. Skipping this discards every saved investigation on upgrade (NFR12).
  - [x] **Bump `CACHE_NAME` in `public/sw.js`** (`v2 → v3`). The schema is `.strict()` with three new required fields, so a cached pre-1.11 `case.json` boots into "content unavailable" with no offline recovery.
  - [x] Unit tests in `tests/unit/CaseDefinition.test.ts`: the valid fixture parses (assert on `parsed.data`, not the input object); each cross-field rule above rejects independently.

- [x] **Task 3 — Pure defensibility evaluator (AC: 3, 4)**
  - [x] New file `src/domain/theory/conclusionProposals.ts`. Export `evaluateSupportPredicate(predicate, evidence): boolean` and `selectDefensibleConclusionIds(definition, evidence): readonly string[]`, where `evidence` is the existing `AuthoritativeEvidence` shape (`src/domain/theory/conclusionReadiness.ts:11`).
  - [x] Predicate semantics: `never` → false; `minimum-runs` → `evidence.runs.length >= count`; `varied-control` → `new Set(runs.map(r => r.controls[controlId])).size >= 2`; `inspected-source` → `inspectedSourceIds.includes(sourceId)`; `all-of` → every child true. Freeze the returned array (`Object.freeze`), matching the file's conventions.
  - [x] Do **not** import Phaser, the store, or `AppState`. Do **not** add the significant-measure count (Story 2.6) or any rival-lab selection (Story 2.5).
  - [x] Unit tests `tests/unit/ConclusionProposals.test.ts`: each predicate kind true and false; nested `all-of`; the Young authored set yields a non-empty defensible set at the minimum evidence path and an empty one at zero evidence.

- [x] **Task 4 — Typed actions, reducers, and state (AC: 2, 3)**
  - [x] `src/core/store/AppAction.ts`: add `PredictionProposalChosenAction { type: 'prediction.proposalChosen'; proposalId: string }` and `TheoryConclusionProposalChosenAction { type: 'theory.conclusionProposalChosen'; proposalId: string }`; add both to the `AppAction` union.
  - [x] `src/core/store/AppState.ts`: add `selectedPredictionProposalId?: string` and `selectedConclusionProposalId?: string`; carry them through `freezeState`, `createInitialAppState` (absent), `createAppStateFromCaseRecord`, and `reduceReplayStart` (cleared on replay, alongside `prediction`/`theory`).
  - [x] `reducePredictionProposalChosen`: fail `unknown-prediction-proposal` when the ID is not authored; reuse `reducePredictionRecord`'s context-readiness guard (`AppState.ts:387-391`) so the same gate applies; set `selectedPredictionProposalId` **and** `prediction` = proposal `text.en`; clear `consultation`/`peerReview` as the neighbouring reducers do. Re-choosing is allowed — the choice is revisable (AC2) and must never fail on "already chosen".
  - [x] `reduceTheoryConclusionProposalChosen`: fail `unknown-conclusion-proposal` for an unauthored ID; set `selectedConclusionProposalId` **and** `theory.conclusion` = `claim.en`, `theory.limitation` = `limitation.en`. **Do not** advance the phase, evaluate defensibility, or block on it here — the choice records; the gate and the critique are Stories 2.3/2.5/2.6.
  - [x] **Clear the IDs on the free-text paths**: `prediction.recorded` clears `selectedPredictionProposalId`; `theory.conclusionSet` and `theory.limitationSet` clear `selectedConclusionProposalId`. Without this the record carries a proposal ID whose text no longer matches.
  - [x] Add both cases to the `reduceAppState` switch.
  - [x] Add `error.unknown-prediction-proposal` / `error.unknown-conclusion-proposal` keys to `en.ts` **and** `fr.ts` (`selectLocalizedError` resolves by code).

- [x] **Task 5 — Persistence and selectors (AC: 2, 3)**
  - [x] `src/schemas/CaseRecordSchema.ts`: add `selectedPredictionProposalId: text.optional()` and `selectedConclusionProposalId: text.optional()`. **Keep `schemaVersion: 3`** — optional additive fields need no bump and no migration (the same precedent as `selectedWavelengthNm`, `CaseRecordSchema.ts:99`). `migrateCaseRecord.ts` is untouched.
  - [x] In `validateCaseRecordForDefinition`, reject a record whose `selectedPredictionProposalId` is not authored, or whose `prediction` differs from that proposal's `text.en`; likewise for the conclusion proposal against `theory.conclusion` / `theory.limitation`.
  - [x] `src/core/store/CaseRecordProjection.ts`: project both new fields.
  - [x] `src/core/store/selectors.ts`: add `selectPredictionProposals`, `selectConclusionProposals`, `selectColleagueById`, `selectSelectedPredictionProposalId`, `selectSelectedConclusionProposalId`, and `selectDefensibleConclusionProposalIds` (delegating to the Task 3 evaluator with the same evidence shape `selectConclusionReadiness` already builds).
  - [x] Add a **localized proposal projection** selector for the renderer — `{ proposalId, colleagueName, roleLabel, text }` with the active locale applied via `resolveLocalizedText` — carrying **no defensibility field** (AC3).
  - [x] Unit tests `tests/unit/CaseRecordSchema.test.ts`: a record with a mismatched proposal ID / text pair is rejected; a pre-1.11 record without the fields still loads.

- [x] **Task 6 — In-scene attributed proposals (AC: 2, 3)**
  - [x] New `src/adapters/phaser/renderers/ColleagueRenderer.ts` (this exact path is in the architecture target tree, `game-architecture.md:392`). Renderer-factory shape matching `ApparatusRenderer`: `create()`, `render(state)`, `destroy()`; the factory owns every display object it makes.
  - [x] It renders a heading, the silhouette accent, `name — role`, and the proposal text for each of the four proposals, plus a visible selected-state indicator that is **not colour alone** (a label/marker), and dispatches the typed action on click.
  - [x] Keep the visual treatment deliberately plain. Story 1.12 extracts the generic `DialogueBox` / `ProposalChoice` widgets and this renderer becomes their consumer — do not invent a widget framework here.
  - [x] Wire it into `ColleaguesScene` (prediction proposals) and `TheoryBoardScene` (conclusion proposals). Both currently extend `PhasePlaceholderScene`; convert them to real `Scene` subclasses following `LaboratoryScene`'s lifecycle exactly — store the `unsubscribe`, `this.events.once('shutdown', this.shutdown, this)`, and destroy the renderer in `shutdown()`. `LibraryScene` and `DebriefScene` stay placeholders.
  - [x] `TheoryBoardScene` hosts both `synthesis` and `review`; render the conclusion proposals in both, unmarked. **The renderer must never call `selectDefensibleConclusionProposalIds`** — that set is for the evaluator and the (later) critique only.
  - [x] Resolve every string at **render** time from `selectLocale(state)`, never captured in `create()` or the constructor (`docs/i18n-authoring.md` §"Rendering text").

- [x] **Task 7 — EN + FR for every new surface (AC: 1–3)**
  - [x] `src/core/i18n/locales/en.ts`: a new `// --- Colleagues and proposals ---` block with `colleague.role.lead|builder|analyst|communicator`, the scene headings, the selected-state label, and the two new `error.*` codes. Add the identical keys to `fr.ts` — `tsc` will demand them.
  - [x] Author `fr` for every new `LocalizedText` in `case.json`: all four prediction `text`s, and all four conclusion `claim`s **and** `limitation`s. A missing `fr` is a base-parse Zod failure, not a warning.
  - [x] Add the new colleague/proposal surfaces to `tests/e2e/french-typography.spec.ts` — French runs 15–25% longer than English and overflow is the likelier failure. Give every authored-copy `Text` a `wordWrap`.
  - [x] Surface checklist before calling i18n done: role labels · prediction proposal text · conclusion claim · conclusion limitation · scene chrome/headings · selected-state label · both new error codes.

- [x] **Task 8 — Integration tests through public store actions (AC: 4)**
  - [x] New `tests/integration/ProposalSelection.test.ts` using a real `createStore`: choosing a prediction proposal sets both the ID and the canonical `prediction`; re-choosing replaces it and never fails; an unauthored ID returns a typed `Result` failure and leaves state untouched; a subsequent `prediction.recorded` clears the ID; the same three cases for the conclusion proposal; a record round-trip through `selectPortableCaseRecord` → `createAppStateFromCaseRecord` preserves both IDs.
  - [x] Assert public actions and selectors only — never renderer internals or Phaser private fields.

- [x] **Task 9 — Verify (AC: 1–4)**
  - [x] `npm run typecheck` clean; `npm run test` all green; `npm run test:e2e` shows **no new failures beyond the tracked baseline** (see Regression baseline below).
  - [x] Confirm the pre-pivot DOM flow still completes end to end — the prediction and theory-board panels are untouched by this story.

### Review Findings

Code review 2026-08-06 (gds-code-review, three parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Every finding below was independently verified against the tree before being recorded; three further findings were dismissed as noise.

**Decisions resolved by Alexis, 2026-08-06 — each became a patch**

| # | Finding | Decision |
|---|---|---|
| 1 | `conclusion-universal-optics` earns the calibrated-conclusion recognition | **(d)** Accept until Story 2.5's rival-lab critique lands, but pin the current behaviour by test now |
| 2 | An English copy-edit destroys saved records | **(a)** Degrade — drop the stale proposal ID and keep the record |
| 3 | Re-recording identical free text destroys the attribution | **(a)** Clear the ID only when the normalized text actually differs from the proposal's canonical text |
| 4 | `reduceTheoryConclusionProposalChosen` has no phase guard | **(a)** Add a phase guard now |
| 5 | Counterfactual replay loses the attribution | **(a)** Add the proposal ID to `CompletionSnapshot` and `DecisionHistoryEntry` now |

- [x] [Review][Patch] **(decision 1d)** `conclusion-universal-optics` escapes every critique gate and *earns* the calibrated-conclusion recognition — Resolution: leave the content and the gates as authored; Story 2.5's rival-lab critique is the intended mechanism. Add a test now that pins the present behaviour (this proposal produces `issues: []` and therefore satisfies `calibrated-conclusion`) so that when 2.5 lands, or any copy edit touches the claim, the change in outcome is visible rather than silent. Original finding: — Its claim ("Every optical effect anyone will ever record…") contains none of the authored `overreachPhrases` (`en: proves, certainly, without question` — `case.json:1333`), and its limitation string ("None is offered: …") is non-empty, so it satisfies `evaluateConclusionReadiness`'s `limitation` requirement and the `missing-evidence` rule. `evaluatePeerReview` returns `issues: []`, and `recognitionRules.ts:69-70` then awards `calibrated-conclusion` — "a bounded claim without an overreach finding" — for the most unbounded claim in the case, one the evaluator can never defend. This contradicts the binding rule "no rewards for overclaiming". `conclusion-wave-settled` is caught only incidentally, because it happens to contain "proves". Options: (a) reword the claim to contain a detection phrase — but `peerReviewRules.ts:73-78` documents that widening detection invalidates saved records; (b) make the limitation gate reject an authored no-limitation string; (c) gate the recognition on the defensible set; (d) accept until Story 2.5's rival-lab critique lands, and pin it by test.
- [x] [Review][Patch] **(decision 2a)** An English copy-edit to any authored proposal string hard-rejects every saved record that chose it, and the autosave then overwrites it — Resolution: degrade instead of rejecting. When a record's `selected*ProposalId` no longer matches its stored canonical text, drop the ID and keep the record; reject only when the ID names a proposal that does not exist at all. This preserves the NFR12 intent the surrounding compat allowlist was written for. Original finding: — The new consistency check (`src/schemas/CaseRecordSchema.ts:169-185`) demands byte-equality between the record's stored text and the *current* authored `.en`, and its only failure mode is total rejection (`invalid-case-record`); it does not degrade by dropping the now-stale proposal ID. The version-compatibility allowlist immediately above is explicitly designed to let authors change display text freely across versions (NFR12). Worse, `CaseProgressPanel.ts:108-116` calls `persist()` on the *first* dispatch of the recovered session, writing an empty record over the same IndexedDB key — so the investigation is destroyed, not merely refused. Options: (a) degrade — drop the mismatched `selected*ProposalId` and keep the record; (b) keep strict rejection but suppress the autosave overwrite after a rejected load; (c) version-gate the equality check.
- [x] [Review][Patch] **(decision 3a)** Re-recording byte-identical free text silently destroys the attribution, and the DOM panel feeds a French player the English canonical text — Resolution: in `reducePredictionRecord` and `withHandWrittenTheory`, clear the proposal ID only when the normalized incoming text actually differs from the chosen proposal's canonical text. Identical text keeps the attribution, so pressing "Record" no longer un-chooses a proposal. The French-textarea friction is inherent to the DOM/Phaser double surface and stays until 2.1/2.3 retire the panels. Original finding: — `reducePredictionRecord` (`src/core/store/AppState.ts:406-411`) clears `selectedPredictionProposalId` unconditionally, so recording text that has not changed by a single byte drops the ID: the Phaser marker flips from "✓ Chosen" back to "Choose this" with no explanation, and the colleague's verbatim words are attributed to the player. The clearing rule's own justification ("would carry text the record consistency check then rejects") does not apply when the text is unchanged. `CaseContextAndPrediction.ts:150-155` then copies the canonical `.en` into the textarea, so a French player who picked a French-rendered card sees English and records English. Identical via `withHandWrittenTheory` for the conclusion. Options: (a) clear only when the normalized text actually differs from the proposal's canonical text; (b) leave as-is and accept the DOM/Phaser double surface until 2.1/2.3 retire the panels.
- [x] [Review][Patch] **(decision 4a)** `reduceTheoryConclusionProposalChosen` carries no phase or readiness guard while its prediction sibling does — Resolution: add a phase guard now, so the store is the authority rather than whichever scene happens to be mounted. Guard on phase only — the *evidence* gate stays with Stories 2.3/2.6 exactly as the spec directs. Original finding: — `src/core/store/AppState.ts:459` validates only that the ID is authored, then writes `theory.conclusion`, `theory.limitation`, and wipes `consultation`/`peerReview` from any phase; `reducePredictionProposalChosen` (`:424`) applies `evaluateContextReadiness`. The spec deliberately deferred the *evidence* gate to 2.3/2.6, but it did not rule on a phase guard, and the asymmetry means only which scene is mounted prevents an out-of-phase conclusion. Options: (a) add a phase guard now; (b) leave the store permissive and let 2.3 own it.
- [x] [Review][Patch] **(decision 5a)** A counterfactual replay permanently loses the completed run's attribution — Resolution: carry the chosen proposal ID into `CompletionSnapshot` and `DecisionHistoryEntry` now, so attribution survives replay and the debrief/print view can credit the colleague. Both are persisted shapes — confirm whether this needs a `schemaVersion` bump or lands as optional additive fields (the `selectedWavelengthNm` precedent suggests additive-optional is enough). Original finding: — `case.replayStarted` (`src/core/store/AppState.ts:597-625`) clears both proposal IDs while keeping `completion`, and neither `CompletionSnapshot` (`AppState.ts:38-46`) nor `DecisionHistoryEntry` carries a proposal ID. The debrief, decision-history panel, and `CaseRecordPrintView` present a colleague's verbatim claim as the player's own words, unrecoverably. This story created the provenance problem but did not specify where provenance lives. Options: (a) add the proposal ID to the snapshot and history entry now; (b) defer to the story that owns debrief attribution.

**Patches (fix is unambiguous)**

- [x] [Review][Patch] Neither new scene suppresses its input while the reference-book overlay is open, so book clicks rewrite the recorded prediction or conclusion [src/adapters/phaser/scenes/ColleaguesScene.ts:19-27, src/adapters/phaser/scenes/TheoryBoardScene.ts:19-27, src/game/main.ts:19,54] — `ColleagueRenderer` makes each card a full-width interactive rectangle (x 40–984, tops 132/285/438/591, height 143 — nearly the whole 1024×768 canvas, `ColleagueRenderer.ts:113-121`) with no enable/disable path. `LaboratoryScene.ts:12-25` exists precisely for this hazard and documents it; `main.ts` wires `isOverlayVisible` / `setApparatusInputEnabled` only to `laboratoryScene`. The book is reachable in every phase (`CuratedRecord.ts:96-118` has no phase gate) and its own `interactionSurface` is disabled through `animateOpen`/`animateTurn`/`hide`'s fade while still painted (`LectureBookRenderer.ts:87-94, 311-343`). A page-turn double-click at the theory board dispatches `theory.conclusionProposalChosen` and replaces the conclusion, the limitation, and clears `peerReview`. Violates Task 6's "following `LaboratoryScene`'s lifecycle **exactly**".
- [x] [Review][Patch] The scene-router happy-path E2E now silently records an authored conclusion instead of the one it typed [tests/e2e/scene-router.spec.ts:11,67] — `clickApparatusIncrease` clicks design coordinate (540, 603) to prove the laboratory was torn down. With `TheoryBoard` active (asserted line 62), that coordinate lands inside card index 3 — `conclusion-universal-optics` — so the click overwrites the conclusion and limitation filled at lines 57-58 before the spec requests review, saves the revision, and completes the debrief. The suite stays green (7 failed / 30 passed) because nothing asserts the conclusion survived. Task 9's "confirm the pre-pivot DOM flow still completes end to end" therefore passed for the wrong reason.
- [x] [Review][Patch] `conclusion-both-settings` is not the specified superset — it drops both `inspected-source` requirements [public/cases/young-interference/case.json:1154-1172] — Task 2 asks for "one that **additionally** needs a second varied control". The authored predicate is `all-of: [minimum-runs 2, varied-control slitSpacingMm, varied-control screenDistanceM]` with no `inspected-source` children, where `conclusion-spacing-varies` has both. The evaluator will call it defensible on evidence with zero inspected sources, which ADR-006 forbids ("never bypass required observations and sources"), and the second tier is no longer strictly more demanding than the first. `ConclusionProposals.test.ts:2126-2135` only ever evaluates it with both sources already inspected, so the omission is untested.
- [x] [Review][Patch] The conclusion card's claim and limitation share a fixed window with ~3px of slack and no measurement [src/adapters/phaser/renderers/ColleagueRenderer.ts:97-102,125,131] — At 768px the four cards resolve to 143px each. `body` is top-anchored at `top + 36` with `wordWrap` and no `maxLines`; `limitation` is bottom-anchored at `top + height - 34` with `setOrigin(0, 1)` and grows upward. Today's French claim and limitation each wrap to two lines and very nearly meet. One more wrapped line in either — a copy edit, a longer future translation, a third locale — draws them directly on top of each other. Nothing measures either object's rendered height, and the new `french-typography` check compares only single-token widths, so it cannot detect line-count or vertical overflow.
- [x] [Review][Patch] The conclusion-projection AC3 guard cannot fail for any leak not literally named `isDefensible` [tests/integration/ProposalSelection.test.ts:208-209] — `toMatchObject` ignores extra keys, so it is paired with a one-name blacklist against a key that has never existed. Adding `supportPredicate`, `defensible`, or `isCorrect` to `selectLocalizedConclusionProposals` would let the renderer mark the right answer and both assertions would still pass. (The prediction-projection test at `:192` is sound — it uses exact `toEqual`; only the conclusion one is weak.)
- [x] [Review][Patch] The unattributed fallback renders a dangling separator [src/core/store/selectors.ts:203-205, src/adapters/phaser/renderers/ColleagueRenderer.ts:151] — `projectAttribution` returns `roleLabel: ''`, and the renderer interpolates it unconditionally into the two-part template `'{name} — {role}'`. In the degraded cached-`case.json` scenario the guard was written for, the card reads `Unattributed proposal — ` (`Proposition sans autrice ni auteur — `) with a trailing em dash and no operand. The dedicated `colleague.unattributed` key can never render correctly as a standalone attribution.
- [x] [Review][Patch] A rejected `chooseProposal` is silently swallowed on a premise that is false [src/adapters/phaser/renderers/ColleagueRenderer.ts:116-121] — The handler discards the `Result` under the comment "the only reachable failure here is an unauthored id, which authored content cannot produce". `progress-operation-active` is also reachable: `CaseProgressPanel.ts:63-94` holds `acquireExclusiveOperation()` across `await importCaseRecord(file)` and `await repository.save(...)`, and `createStore.ts:32-34` short-circuits every dispatch in that window. Clicking a card during a progress import is a complete no-op with no feedback anywhere.
- [x] [Review][Patch] The French overflow test samples only the longest string per set, but its pass condition is per-token width [tests/e2e/french-typography.spec.ts:99-101,209] — `longestFrench` picks one string per set by total character count; the other three proposals are never measured. The widest unbreakable token does not have to live in the longest string, so a short proposal containing one long token slips through the check and clips out of the 744px card at runtime — exactly the class of bug this test exists to catch.

**Patch verification, 2026-08-06 — all 13 applied**

- `npm run typecheck` clean.
- `npm run test` **372 passed / 31 files**, up from the 360 the Dev Agent Record measured. The delta is net: new coverage for each decision (identical-text re-record keeps the attribution for both prediction and conclusion, the conclusion phase guard, the sanitize-not-reject path and its carry into app state, `conclusionProposalId` through save/replay/round-trip, the `conclusion-universal-optics` pin), minus the three reject-on-text-mismatch cases that decision 2a converted into degrade cases.
- `npm run test:e2e` **7 failed / 30 passed** — the identical seven specs tracked in `deferred-work.md` (`accessibility`, `curated-record:179`, `inquiry-recognition`, `offline-reload:72`, `progress-portability`, `theory-board`, `young-experiment:12`). No new failures.
- The restructured `scene-router` probe **confirmed the collision was real**: its new `expect(conclusionField).not.toHaveValue(TYPED_CONCLUSION)` assertion passes, i.e. the apparatus-teardown click does adopt `conclusion-universal-optics`. The spec now asserts that and restores the typed conclusion, so the review and debrief below it exercise what they claim to.

Two things worth carrying forward, both found while applying rather than while reviewing:

- **`createAppStateFromCaseRecord` was discarding the validated record.** It called `validateCaseRecordForDefinition(record, …)` and then read `record.*` for every field instead of `compatible.value`. Harmless while validation only ever returned its input unchanged — and a silent no-op the moment it sanitizes anything, which decision 2a makes it do. Fixed at the same time and pinned by test; worth remembering as a shape ("validate, then read the argument again") that hides a whole class of future bug.
- **The identical-text guard initially broke 29 tests** across 12 files, because many older fixtures cast a partial `caseDefinition` and so have no `predictionProposals` array at runtime. The fix — short-circuit on the selected ID before consulting the authored set — is better code anyway: with nothing chosen there is no attribution to preserve.

**Dismissed as noise (recorded so a later review does not re-raise them)**

- `ColleagueRenderer` reads `state.caseDefinition` instead of `selectColleagueById` — the stated evidence ("imported nowhere in `src/`") is false; it is used at `selectors.ts:200`. The direct read is needed for the accent colour, which is not text and so is deliberately absent from the localized projection.
- Inverted `minimum-runs` case labels in `ConclusionProposals.test.ts:51-53` — the labels describe the *evidence* relative to the threshold and are consistent under that reading, and the `>=` boundary is genuinely covered by the `count === runs.length` row.
- No rule requires four distinct colleagues per proposal set — Task 2 prescribes `.min(1)` explicitly, the shipped content uses four distinct colleagues, and nothing fails today.

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

claude-opus-5 (Claude Code, gds-dev-story)

### Debug Log References

- **E2E regression baseline, measured on a clean tree at `f66a078` before any change:** 7 failed / 29 passed. The seven are exactly the specs tracked in `deferred-work.md` (`accessibility`, `curated-record:179`, `inquiry-recognition`, `offline-reload:72`, `progress-portability`, `theory-board`, `young-experiment:12`).
- **E2E after the story:** 7 failed / 30 passed — the identical seven specs, plus one new passing test (`french-typography` → authored French proposal copy). No new failures.
- `npm run typecheck` clean; `npm run test` 360 passed / 31 files, against a re-measured baseline of 287 passed / 29 files (`git stash push --include-untracked`, run, `git stash pop`) — **73 new vitest tests**, plus one new E2E test.
- **Two story instructions were stale against the tree and were followed in substance, not in letter:**
  - `public/sw.js` `CACHE_NAME` was already at `v4`, not `v2`. Bumped `v4 → v5` with the same reasoning.
  - The task text names the depth bound as `z.lazy` with a max depth of 3. Implemented as three explicit nested schema levels instead — same bound, and it sidesteps Zod 4's `lazy` inference gap entirely, so no `z.ZodType<T>` annotation is needed and the inferred type stays a real discriminated union.

### Completion Notes List

- **AC1 — validation.** `colleagues`, `predictionProposals` (`.length(4)`), and `conclusionProposals` (`.length(4)`) are strict-parsed by `CaseDefinitionSchema`, with every cross-field rule in the existing top-level `superRefine`: unique colleague IDs, proposal IDs unique within each set, attribution resolving to an authored colleague, asset portraits naming a manifest entry, `inspected-source` / `varied-control` predicates naming authored content, no empty `all-of`, at least one conclusion defensible on some evidence, and `encodesPath` over every proposal string. Invalid content still returns the typed `Result` from `loadCaseDefinition` before any domain logic runs.
- **AC2 — prediction.** `ColleaguesScene` is now a real `Scene` rendering four attributed proposals through `ColleagueRenderer`, dispatching `prediction.proposalChosen`. Re-choosing succeeds rather than failing on "already chosen", so the choice is revisable; the reducer reuses `reducePredictionRecord`'s context-readiness guard and never gates on anything else.
- **AC3 — conclusion.** `TheoryBoardScene` renders the four attributed conclusions in both `synthesis` and `review`, unmarked. `selectDefensibleConclusionProposalIds` exists but is deliberately *not* reachable from the localized projection the renderer consumes — `LocalizedProposalProjection` carries no defensibility field, and the renderer never imports the evaluator.
- **AC4 — tests.** New `tests/unit/ConclusionProposals.test.ts` (13) covers every predicate kind true and false, nested `all-of`, and the authored Young set at zero / minimum / both-controls-varied evidence. New `tests/integration/ProposalSelection.test.ts` (20) drives only public actions and selectors. `tests/unit/CaseDefinition.test.ts` gained 29 proposal cases and `tests/unit/CaseRecordSchema.test.ts` 11 — 73 in total, reconciled against the measured baseline rather than counted by hand.
- **Cross-field rules are asserted by their authored message, not by a bare `success: false`.** Several mutations trip a neighbouring rule as well — the `varied-control` case necessarily breaks the apparatus contract too — so a boolean assertion could not tell which rule fired, nor fail if the rule under test were deleted.
- **The authored overreach interaction is pinned by test.** `conclusion-wave-settled` contains "proves", an authored `overreachPhrases` entry, so choosing it legitimately raises the overreach finding. Two integration tests hold that behaviour (and its absence for the bounded conclusion) so a later copy edit cannot silently change which issues a saved record recomputes to.
- **Save compatibility.** `selectedPredictionProposalId` / `selectedConclusionProposalId` are optional additive record fields, so `schemaVersion` stays 3 and `migrateCaseRecord` is untouched. `1.7.0` accepts `1.2.0`–`1.6.0` records; `validateCaseRecordForDefinition` additionally rejects a record whose proposal ID no longer matches its canonical `.en` text.
- **Not built, per the scope table:** no `DialogueBox` / `ProposalChoice` widgets (1.12), no significance gate or colleague hints (2.6), no rival-lab critique (2.5), no `src/ui/*` panel retired. The DOM panels are untouched by this diff.

### File List

**New**

- `src/domain/cases/ColleagueCast.ts`
- `src/domain/theory/conclusionProposals.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `tests/unit/ConclusionProposals.test.ts`
- `tests/integration/ProposalSelection.test.ts`

**Modified**

- `public/cases/young-interference/case.json`
- `public/sw.js`
- `src/domain/cases/CaseDefinition.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/core/store/AppAction.ts`
- `src/core/store/AppState.ts`
- `src/core/store/CaseRecordProjection.ts`
- `src/core/store/selectors.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/scenes/ColleaguesScene.ts`
- `src/adapters/phaser/scenes/TheoryBoardScene.ts`
- `src/adapters/phaser/scenes/PhasePlaceholderScene.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/e2e/french-typography.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date       | Version | Description                                    | Author |
|------------|---------|------------------------------------------------|--------|
| 2026-08-06 | 0.1     | Initial story draft created (gds-create-story) | Alexis |
| 2026-08-06 | 1.0     | Implemented the colleague cast and proposal system: content contract + Zod validation, Young `case.json` 1.7.0, pure defensibility evaluator, two typed actions with persistence, `ColleagueRenderer` in both scenes, EN+FR. 73 new vitest tests + 1 E2E; E2E matches the 7-spec baseline exactly. | Amelia (dev-story) |
| 2026-08-06 | 1.1     | Code review (3 adversarial layers): 5 decisions resolved, 13 patches applied, 3 findings dismissed. Overlay input gating for both new scenes; `scene-router` teardown probe no longer silently adopts an authored conclusion; `conclusion-both-settings` made a strict superset; record sanitization replaces rejection on a text mismatch; attribution kept on identical-text re-record and carried into the saved revision; conclusion phase guard; card layout, unattributed fallback, refused-click feedback, and two weak tests strengthened. 372 vitest passing; E2E at the 7-spec baseline. | Link Freeman (code-review) |

## Open Questions (for author confirmation — do not block dev)

1. **1.11 before 1.12.** This story renders proposals with a plain `ColleagueRenderer`; 1.12 then extracts the reusable `DialogueBox` / `ProposalChoice` widgets and refactors it. Running 1.12 first would avoid one refactor but leaves 1.12's widgets with no content to render. Confirm the 1.11 → 1.12 order, or swap them.
2. **Is Dr. Thea Young a proposing colleague or the player?** She is the case protagonist in `narrative-design.md`. The cast above makes her the `lead` who voices one of the four proposals, with the player as an unnamed investigator. Confirm, or replace her with a fourth supporting character.
3. **Free-text prediction and conclusion after the pivot.** This story keeps both fields as the canonical persisted text so no gate or saved record breaks, writing them from the chosen proposal. Once 2.1 and 2.3 retire the DOM panels, is free text removed entirely, or retained as an authored-plus-annotation path?
4. **`synthesis` → scene, still open from 1.10.** `TheoryBoardScene` renders the conclusion proposals in both `synthesis` and `review`. Story 2.6 may prefer `synthesis → LaboratoryScene` (stay in the lab to gather significant measures). It is a one-line `case.json` edit either way.
5. **Case-version compatibility policy** (carried from 1.1b Open Question 5). `1.7.0` extends the ad-hoc allowlist in `validateCaseRecordForDefinition` for the third time. Replace it with a declared compatibility range before Epic 3 adds more case versions?

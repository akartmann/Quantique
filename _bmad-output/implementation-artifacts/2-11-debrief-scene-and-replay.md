---
baseline_commit: 3bd19b7ca11f3123d6a4e78cda749a650d401f52
---

# Story 2.11: Debrief scene — historical comparison, recognition, and replay

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to read how my bounded conclusion compares with the historical record and choose to replay,
So that the case closes with understanding rather than a placeholder.

## Acceptance Criteria

AC1–AC4 and AC8 are `epics.md` §Story 2.11 verbatim. **AC5, AC6 and AC7 are additions**, each traceable
to a recorded decision that named this story as the owner — see `deferred-work.md` §"Assigned at code
review of 2-8" (AC5), §"Deferred from: code review of 2-7" (AC6), and §"Deferred from: development of
2-7" (AC7). They are not scope creep; without them Story 2.12's completion check cannot pass and the
`review → debrief` chain becomes unreachable the moment 2.12 deletes the DOM panels.

**AC1 — The debrief exists.**
**Given** the `debrief` phase,
**When** `DebriefScene` activates,
**Then** it renders the authored sourced historical comparison and the optional deeper-theory layer in-scene in the active locale, and no placeholder marker,
**And** `PhasePlaceholderScene` is no longer its base class — and, with `LibraryScene` converted in 2.8, the class itself is removed.

**AC2 — It reports the record; it does not rewrite it.**
**Given** the debrief,
**When** it is read,
**Then** it never rewrites the historical outcome around the player's choice,
**And** provenance labels distinguish primary artifact, reconstruction, interpretation, and fiction.

**AC3 — Challenge as inquiry, recognition without a score.**
**Given** the player's decision history including any rival-lab critique,
**When** the debrief renders,
**Then** the retained `critiqueHistory` is presented as inquiry rather than failure (this closes the tracked Story 2.5 deferral whose stated owner is "whichever story builds the debrief surface"),
**And** recognition reflects replication, source checking, optional-variable testing, and bounded claims — never speed, score, or perfect play, and it never gates completion.

**AC4 — Finishing and replaying, both from the canvas.**
**Given** the debrief is complete,
**When** the player chooses to finish or replay,
**Then** `case.debriefCompleted` and `case.replayStarted` are both dispatchable from the canvas,
**And** a replay preserves the completed historical record and campaign unlock state,
**And** counterfactual exploration is explicitly labelled distinct from the recorded historical result.

**AC5 — The four assigned `review → debrief` gating intents reach the canvas.**
**Given** `theory.supportRunSelected` / `theory.supportRunUnselected`, `theory.supportSourceSelected` / `theory.supportSourceUnselected`, `peerReview.requested` and `revision.saved`, whose only dispatchers today are `src/ui/theory/TheoryBoard.ts` and `src/ui/review/ConclusionReviewPanel.ts`,
**When** this story lands,
**Then** each is dispatchable from the Phaser canvas without touching a DOM panel,
**And** `tests/e2e/canvas-transitions.spec.ts`'s header table lists no remaining unowned gating intent, and its walk completes the Young case with canvas clicks only,
**And** the surface that carries them never reads the defensible-conclusion set (ADR-006).

**AC6 — `invalid-completion-timestamp` stops describing a field the player has never seen.**
**Given** a completion timestamp earlier than the saved reviewed revision — reachable in normal play through a progress import from another device, or a backwards clock correction between `revision.saved` and the advance click,
**When** "Close the case" is refused,
**Then** the refusal carries its own error code with device-clock copy in both locales, the way `reduceTheoryConclusionSubmit`'s `critique-timestamp-not-later` already does,
**And** the malformed-stamp code keeps its own message for the case it actually describes.

**AC7 — `error.conclusion-not-ready` stops pointing at a surface that does not exist.**
**Given** the copy "The theory board shows what is missing" / "Le tableau de théorie indique ce qui manque", which today describes only the retired DOM panel,
**When** the significant-measure-cleared player is refused `synthesis → review`,
**Then** the canvas theory board does show what is missing, in the active locale, from `selectConclusionReadiness(state).missing` through the existing `conclusion.missing.*` keys,
**And** the readiness list reports the player's own record (observations, sources, limitation) and never which conclusion the evidence defends.

**AC8 — Tests.**
**Given** the debrief scene,
**When** tests run,
**Then** integration tests cover completion and replay through public store actions,
**And** an E2E test reaches the debrief and replays using canvas clicks only,
**And** every new player-facing string is asserted present in English **and** French,
**And** each guard this story claims is proven by **mutation** — broken once, confirmed failing, restored — because the 2.9 and 2.10 reviews each found a whole painted state that no assertion could see.

## Tasks / Subtasks

- [x] **Task 1 — Selectors and error codes the surfaces need (AC2, AC3, AC6).**
  - [x] `selectLocalizedRecognition(state, items)` in `src/core/store/selectors.ts`: recognition items resolved through the **eight `recognition.<id>.label` / `.description` keys that already ship in both bundles and that nothing resolves today**. `deriveRecognition` emits canonical English `label`/`description` inside the persisted record and must stay that way (`CaseRecordSchema` re-validates it); the display resolves by stable `id`. **Take the items as an argument rather than reading `state.recognition`** — the debrief needs `completion.recognition` (the snapshot), and a selector that read the live field would show the *replay's* recognition on a completed record (D2). Verify with `grep -rn "'recognition\." src` that this is the first consumer; a dead key shipped in both bundles was a 2.10 review patch.
  - [x] `selectLocalizedCritiqueHistory(state)`: over **`completion.critiqueHistory`**, not `state.critiqueHistory` (see D2). Each entry resolves its `critiqueId` against `caseDefinition.rivalLab.critiques[].line` (`LocalizedText`) and the rival's canonical name plus `t('rivalLab.role')` through `formatAttribution`, exactly as `selectLocalizedRivalLabCritique` does. A `critiqueId` a degraded cached `case.json` no longer authors is **dropped**, not rendered as an attributed heading with nothing under it — the same rule that selector states.
  - [x] `selectLocalizedPeerReview(state)`: `PeerReviewIssue.feedback` and `.revisionPath` are canonical `.en`, persisted inside `DecisionHistoryEntry.feedback`, and recomputed-and-string-compared on load. **Never render them.** Resolve `caseDefinition.peerReviewRules` by `ruleId` to the authored `LocalizedText`, and resolve `status: 'unavailable'` through the existing `review.unavailable` key rather than `projection.message`. A rule id the case no longer authors falls back to the canonical `.en` string — that is the one place it is the right answer, because the alternative is silence.
  - [x] `selectLocalizedDebrief(state)`: `debrief.summary`, `historicalComparison.{title,text}`, its two cited sources (name + provenance category + source type + rights status, all through the existing `source.*` families), `deeperTheory.{title,text}`, `replayLabel`. **`debrief.summary` is authored EN+FR and rendered by nothing today** — this is where it lands. Cite from `historicalComparison.sourceIds`, which the schema validates against `contextualArtifacts`; **do not read `debrief.sourceRefs`**, whose two ids (`young-1801-lecture`, `newton-opticks-1730`) match no artifact and are validated only as non-empty strings (Open Question 3).
  - [x] **AC6:** split `reduceDebriefComplete`'s ordering failure out of `invalid-completion-timestamp` into its own code — `completion-timestamp-not-later`, named after the one `reduceTheoryConclusionSubmit` already gets right — copying that treatment verbatim in shape: new code, new `error.*` key in **both** locales with device-clock copy ("Check the device clock, then try again", per `en.ts:267-269`), malformed-stamp message left describing the malformed case. `advanceView.ts` derives `LocalizedErrorCode` from `TranslationKey`, so the new code is type-checked against the bundle for free. Extend `tests/unit/CompletionReplay.test.ts:51`, which currently pins the merged code.

- [x] **Task 2 — Phaser-free debrief geometry (AC1, AC8).**
  - [x] `src/adapters/phaser/scenes/debriefGeometry.ts`, **importing Phaser not at all** (`libraryGeometry.ts` is the precedent and states why: Vitest and Playwright run in Node and Phaser touches `window` at import time). Re-export `ADVANCE_CONTROL_WIDTH`/`HEIGHT` from the widget rather than restating them.
  - [x] Every function takes `canvasWidth` / `canvasHeight`. Nothing closes over `1024` / `768`; the scene reads its own `scale`. `designSurface.ts` exists for the specs.
  - [x] Export: the summary band, the historical-comparison band, the cited-sources band, the deeper-theory band (collapsed and expanded), the recognition band, the critique-history band, the counterfactual label band, the replay control bounds, and `debriefAdvanceControlCentre(w, h)`. The two bands whose content is unbounded authored prose are **measured up from the canvas floor**, never placed against a constant above them — that is the defect the 1.11, 1.12, 2.5, 2.6, 2.7, 2.8 and 2.9 reviews each found in a different scene.
  - [x] `tests/unit/DebriefGeometry.test.ts`, run against **two canvas sizes** so a memorised dimension fails (2.8's `LibraryGeometry.test.ts` is the pattern): every rectangle inside the canvas, no band overlapping another, the replay control clear of the counterfactual label. **No vacuous assertions** — the 2.7 review rejected four of exactly the shape `expect(y).toBeGreaterThan(0)` on a coordinate built from positive offsets, and the 2.8 review rejected three more that were true by construction.

- [x] **Task 3 — `DebriefRenderer` (AC1, AC2, AC3).**
  - [x] `src/adapters/phaser/renderers/DebriefRenderer.ts`, `create()` / `render(state)` / `destroy()`, owning every display object it makes. `RivalLabRenderer` is the closest precedent: one scene, unbounded authored prose, a floor-anchored control, no animation.
  - [x] Text created **empty** in `create()` and written in `render(state)` through `createTranslator(locale)`. Never author player-facing copy in `create()`.
  - [x] The deeper-theory layer is **optional and collapsed by default** (AC1 says "optional"). The open/closed flag is widget-local and ephemeral — `DialogueBox`'s beat index and `LectureBookRenderer`'s summary toggle are the precedent. **No new `AppState` field**; the 2.8 review ratified exactly this reading (Decision 4).
  - [x] Every growable text block gets a clamp that **restores its font size before measuring** — `LibraryRenderer.clampRelationship` shipped without that and shrank permanently across artifacts and locales (2.8 review patch). Shrink to a floor, then crop; state the band's worst case against the content schema's maximum, not against the shipped copy.
  - [x] No animation at all is the cheapest correct option. If any is added it inherits the whole contract: subscribe to `prefers-reduced-motion`, register **no** update loop under `reduce`, paint a static frame from `render()`, animate on elapsed time, and release every tween in `destroy()` **including tweens whose target is the renderer itself**.
  - [x] Character staging is **out of scope** — `CharacterStage` is not used here. See §Scope boundary.
  - [x] **Guard the degraded case.** `selectCompletionSnapshot` is `undefined` outside a completed case, and `debrief` is only reachable through `case.debriefCompleted`, which always writes one — but a restored record carries both the phase and the snapshot from IndexedDB, and a `critiqueId` or `ruleId` a cached `case.json` no longer authors resolves to nothing. Render the authored comparison and deeper theory regardless, omit the block that has no data, and **never throw**: `create()` and `render()` run synchronously inside `dispatch() → notify()`, so a throw advances the phase, skips every later subscriber and strands the router with no visible error (the 1.10 failure mode, reproduced in 2.8's Debug Log).

- [x] **Task 4 — `DebriefScene` (AC1, AC4).**
  - [x] `DebriefScene extends Scene` — **not** `PhasePlaceholderScene`. `LibraryScene` is the reference lifecycle, including the ordering the 2.8 review corrected: `this.events.once('shutdown', …)` **first**, before `registerCanvasBoundsRefresh` and before `store.subscribe`. A throw in the first render otherwise leaks the scroll listener and a subscription that keeps rendering a half-built scene forever, because `SceneRouter`'s catch clears `activeSceneKey` and nothing ever stops it.
  - [x] `registerCanvasBoundsRefresh(this)` in `create()`, disposed in `shutdown()`. Exactly one routed scene runs at a time.
  - [x] The replay affordance is the existing `AdvanceControl` + `advanceTransitionForPhase('debrief')` → `debrief-replay` → `case.replayStarted`. **Do not build a second control and do not read `debrief.replayLabel` for it**: the control's label is `advance.replay` ("Investigate it again"), an interface string measured by the French whole-string sweep. `replayLabel` is authored prose and is where the counterfactual warning belongs (Task 5).
  - [x] Refusals through `TransientMessageSlot` with the `AppState`-identity lifetime and `resolveAdvanceRefusal({ …, colleagueAnswers: false })`. **One rule, not two** — do not write a second precedence path here. `colleagueAnswers: false` is honest: no gate reachable from the debrief has an authored colleague line, and a host routing a gate refusal to a hint slot it does not have answers with nothing, which is the one thing the refusal rule forbids.
  - [x] `case.debriefCompleted` is **already** canvas-dispatchable — Story 2.7 put it on the theory board's `review` control as `advance.closeTheCase`. AC4 is satisfied for that half by keeping it working, not by rebuilding it. Say so in the Completion Notes rather than claiming new work.

- [x] **Task 5 — The counterfactual label and the preserved record (AC2, AC4).**
  - [x] Read `selectReplayState(state).isCounterfactual` and paint the authored `debrief.replayLabel` as the counterfactual warning when it is set. That authored string already reads as a warning in both locales ("…not the recorded historical result" / "…il ne s'agit pas du résultat historique enregistré"); the retired DOM panel used it as a *button* label and hard-coded a separate English-only warning line. Use the authored prose for the warning and the interface key for the control.
  - [x] **The warning is only visible on the second pass, and that is the honest reading of AC4.** `reduceReplayStart` sets `isCounterfactual` and moves the phase to `context`, so the debrief shuts down immediately; the flag is next seen when the player completes the replay and returns. Label it there. A *session-wide* counterfactual marker across every scene would be new cross-scene chrome no AC asks for and no scene owns — flagged as Open Question 6 rather than built. Do not attempt it.
  - [x] The debrief reads `selectCompletionSnapshot(state)` for the decision, the recognition and the critique history. `reduceDebriefComplete` **deliberately keeps the original snapshot** across a counterfactual replay (`state.replay.isCounterfactual && state.completion ? state.completion : {…}`), so the historical record the debrief shows never changes with the player's later choices. That is AC2's "never rewrites the historical outcome" and AC4's "preserves the completed historical record" — **both hold by the reducer, not by the surface**. Assert it; do not re-implement it.
  - [x] "Campaign unlock state" (AC4): there is no campaign state in this build — one case ships and `reduceReplayStart` resets case progress only. Satisfy the clause by asserting `completion` survives `case.replayStarted` and re-completion, and record that reading rather than inventing an unlock field.

- [x] **Task 6 — The case file: an overlay on the theory board (AC5, AC7).**
  - [x] `src/adapters/phaser/renderers/CaseFilePresenter.ts` + `src/adapters/phaser/renderers/caseFileGeometry.ts`. An overlay the player opens from `TheoryBoardScene`, owned by the scene, suppressing the board's input while it is up — `NotebookRenderer` (Story 2.10, D3) and `ReferenceBookPresenter` (Story 2.8, D1) are the two established instances of this shape. **The theory board has no band left for this** (§The theory board's space budget). No scene→scene reach-in.
  - [x] Contents, in both phases the board hosts:
    - The recorded observations, each with a pin/unpin affordance → `theory.supportRunSelected` / `theory.supportRunUnselected`. Read `state.theory.selectedRunIds` **first** and dispatch only the transition that changes something — the reducer answers a repeat with `duplicate-theory-run` and `theory-run-not-selected`, and a surface must not provoke a refusal the player did nothing to earn. That rule is stated on `PhaserStoreAdapter.inspectSource` and on `selectComparisonRun`; `NotebookRenderer.toggleSelection` implements it.
    - The inspected references, same treatment → `theory.supportSourceSelected` / `theory.supportSourceUnselected`. Only artifacts in `state.inspectedSourceIds` are offered; the reducer's `uninspected-theory-source` must be unreachable from the surface.
    - **AC7's readiness list:** `selectConclusionReadiness(state).missing`, localized through the existing `conclusion.missing.*` keys by `code` — never `missing[].message`, which is the dev-facing English. This is a fact about the player's own record; it carries no defensibility (`ConclusionReadiness` has no defensible field and the selector that does is a different one). Reaching for `selectDefensibleConclusionProposalIds` here is the ADR-006 violation.
  - [x] `review` phase only: request peer feedback → `peerReview.requested`; the returned issues rendered through `selectLocalizedPeerReview`; save the reviewed revision → `revision.saved`, timestamp stamped in the **adapter**, never in the reducer. `reducePeerReviewRequest` refuses outside `review` with `peer-review-unavailable` and `reduceRevisionSave` refuses without reviewed feedback with `revision-review-required` — surface both localized rather than swallowing them.
  - [x] Widen `PhaserStoreAdapter` with the six dispatchers (`selectSupportRun` / `unselectSupportRun`, `selectSupportSource` / `unselectSupportSource`, `requestPeerReview`, `saveRevision`). Scenes go through the adapter; none calls `store.dispatch` directly.
  - [x] Suppress the board's input at creation **and** on every visibility change, and hand it back on close — the rule `LibraryScene` states and `NotebookRenderer` follows, because a click meant for the overlay that fell through would choose a conclusion.
  - [x] **`ColleagueRenderer` has no `setInputEnabled` any more** — the 2.8 review deleted three dead ones (Colleague, TheoryBoard, RivalLab) precisely because they were "an open invitation for a later story to re-wire cross-scene suppression through them", and `applyInputState()` now hard-codes `true` and is called only from `create()`. You must re-add it: an `inputEnabled` field, `applyInputState()` reading it instead of the literal, and a call from `render`/`layoutAndRenderCards` so a rebuilt card cannot come back live under an open overlay. Copy `LibraryRenderer.setInputEnabled` (`:283`) exactly. **Intra-scene only** — the caller is `TheoryBoardScene`'s own presenter callback, never another scene — and it ships with a test, which is what the review asked for in exchange.
  - [x] No `matchMedia` / sub-768px check. `LibraryRenderer.applyInputState` has none and the boards have none; only the bench does, and re-deciding that is 2.12's.
  - [x] `caseFileGeometry.ts` is Phaser-free, takes the canvas size, and is unit-tested (`tests/unit/CaseFileGeometry.test.ts`). Paging is required if the observation count can exceed the rows one page holds — `NOTEBOOK_ROWS_PER_PAGE` and `notebookRowBand` are the pattern; note that `flow.maximumExperimentCycles` is declared and **read by no reducer**, so there is no cap on `runs` (recorded in `selectSignificantMeasureCount`'s docstring, review 2026-08-06).
  - [x] The open control lives in the board's existing right-hand control column, stacked under the submit and advance controls, or the column's geometry moves to make room. Whatever you choose, `advanceControlCentreOnBoard` and `submitConclusionControlCentre` must keep returning what the board actually paints — three specs read them.

- [x] **Task 7 — Delete `PhasePlaceholderScene` (AC1).**
  - [x] Delete `src/adapters/phaser/scenes/PhasePlaceholderScene.ts` and `src/adapters/phaser/scenes/phasePlaceholderGeometry.ts`. `DebriefScene` was its last subclass; `grep -rn "PhasePlaceholderScene\|phasePlaceholderGeometry" src tests` must come back empty.
  - [x] Update `project-context.md` §Engine: the rule "never introduce a scene as a `PhasePlaceholderScene` subclass without a story in the same epic that replaces it" now describes a class that does not exist. Rewrite it as the durable rule it stands for — a placeholder scene needs a replacing story in the same epic — and delete the two `deferred-work.md` items about the shell carrying player-facing behaviour.
  - [x] `tests/e2e/canvas-transitions.spec.ts`: `SHELL_ADVANCE` becomes `debriefAdvanceControlCentre(…)`; the comment at `:113-121` predicting exactly this change is updated rather than left describing a class that is gone.
  - [x] `npm run typecheck` is the proof no reachable code imports either deleted module.

- [x] **Task 8 — Localization (AC1, AC2, AC3, AC8).**
  - [x] Every new key in **both** `en.ts` and `fr.ts`. `TranslationKey` is derived from `en`, so a missing French key is a `tsc` error — do not work around it.
  - [x] New families: `debrief.*` (room chrome, section headings, the deeper-theory toggle, the recognition intro, the critique-history intro, the empty states) and `caseFile.*` (the overlay's chrome, the pin/unpin labels, the readiness heading, the peer-review controls). Nothing in either may name a scene, a phase, or a route (`encodesPath`): "the case file" and "the historical record" are furniture; `Debrief` and `TheoryBoard` are scene keys.
  - [x] Authored prose stays in `case.json` as `LocalizedText`: the summary, the comparison, the deeper theory, the critique lines, the peer-review feedback, the replay warning. Interface labels go through `translate`. **Do not mix the two**, and do not move authored prose into `en.ts` — the reasoning is in `ScenarioScript.ts`'s `ScenarioDialogueBeat` docstring.
  - [x] Every new fixed-height control goes in `FIXED_HEIGHT_CONTROLS` in `french-typography.spec.ts` — the **whole-string** check. The per-token sweep provably cannot catch a two-line wrap inside a fixed-height rectangle, and the 2.10 review caught `notebook.releaseOneFirst` at 440px against a 364px slot the day it was written. Shorten the copy in both locales rather than relaxing a bound.
  - [x] Read the exported font sizes and wrap bounds; do not restate them. Six private `LibraryRenderer` font sizes copied into the sweep were a 2.8 review patch.
  - [x] **How AC8's "asserted present in EN and FR" is met:** canvas text cannot be read from the DOM, so do not try to assert it in Playwright. Assert bundle completeness and non-emptiness in `tests/unit/I18n.test.ts` for every new key; assert the authored `debrief` strings carry both locales in `tests/unit/CaseDefinition.test.ts`; assert the French widths in `french-typography.spec.ts`. That is the division `canvas-transitions.spec.ts` documents in its own header.
  - [x] **AC2's four provenance categories:** both shipped Young artifacts are `primary-material`, so shipped content exercises one of the four. Cover the vocabulary by deriving from the schema's `.options` — `I18n.test.ts` transcribing three Zod enum families instead of deriving from them was a 2.8 review patch — and add a fixture case in the unit test exercising `reconstruction`, `later-interpretation` and `deliberate-fiction`.

- [x] **Task 9 — Tests (AC8).**
  - [x] `tests/unit/DebriefGeometry.test.ts`, `tests/unit/CaseFileGeometry.test.ts` (Tasks 2, 6).
  - [x] `tests/unit/DebriefRenderer.test.ts` and `tests/unit/CaseFileRenderer.test.ts` through `tests/unit/sceneSlice.ts`. That harness records `text`, `visible`, `alpha`, `destroyed`, `interactive`, `commands` and `clears`, and keys listeners **by identity** — all of which exist because the 2.10 review found the harness itself was the blind spot. Use `pressable()` to press a control the way a player does rather than calling a private method.
  - [x] `tests/integration/DebriefSurface.test.ts` — **public actions and selectors only**: completion refused before a reviewed revision and accepted after; the ordering refusal returning the new AC6 code; `case.replayStarted` refused outside `debrief`; after a replay, `completion` unchanged, `runs`/`decisionHistory`/`critiqueHistory` cleared, `completion.critiqueHistory` intact; re-completion after a counterfactual replay leaving `completion` byte-identical.
  - [x] `tests/integration/ConclusionSupport.test.ts` — the four support intents and the two review intents through public actions, including that a re-select is the reducer's refusal (which is why the surface must not dispatch it) and that `selectConclusionReadiness(state).missing` empties as support is pinned. `ReviewFlow.test.ts` and `TheoryBoard.test.ts` already cover the store; what is new is the projection the overlay reads.
  - [x] `tests/unit/ReviewRules.test.ts` / a new case: `selectLocalizedPeerReview` resolves by `ruleId` to the authored `LocalizedText` and **never** returns `PeerReviewIssue.feedback`. Assert against a French store so an English leak fails.
  - [x] `tests/e2e/debrief-replay.spec.ts` — **rewritten canvas-only**. It currently drives thirteen DOM controls including `Run experiment`; every one of them is deleted by 2.12. Every click target derived from exported geometry. Use `clickUntilScene` where a relabel lockout or an overlay fade is in play (`ADVANCE_RELABEL_LOCKOUT_MS` is 400ms and the theory board survives `synthesis → review`, so a spec clicking at machine speed is correctly ignored — this exact trap cost the 2.8 build a day).
  - [x] **Reuse the walk, do not copy it.** `canvas-transitions.spec.ts` and the rewritten `debrief-replay.spec.ts` both need the same canvas journey to the debrief (read both references → leave → choose → two runs at different throws via `startTheLightUntilRecorded` and `dragDesignUntil` → notebook comparison → advance → pin support → peer review → close the case). Extract it into `tests/e2e/canvasHelpers.ts` — `artifactAt` was copy-pasted between two specs in the very commit that created that file to stop exactly this, and it became a 2.8 review patch. `youngExperimentHelpers.ts` is the DOM walk and is not the answer.
  - [x] `tests/e2e/canvas-transitions.spec.ts` — remove the four `board.getByRole('checkbox').check()` calls and the two `peerReview` button clicks, replacing them with case-file clicks; update the header table to record that no gating intent is left unowned, and the "So this is honestly…" paragraph, which explicitly says 2.11 closes both rows.
  - [x] `npm run typecheck`, `npm test`, `npm run test:e2e`. **Measure the baseline first** — see §Baseline. Record the before/after comparison in the Dev Agent Record, and account for every change in the test count arithmetically the way 2.8's Completion Notes do.
  - [x] **Mutation proofs (AC8).** At minimum: the no-dispatch-on-repeat guard in the case file (remove it → an e2e or renderer test must fail); the counterfactual label (force `isCounterfactual` false → a test must fail); the recognition localization (return the canonical `.en` → a French test must fail); the peer-review localization (return `issue.feedback` → a French test must fail); the preserved completion snapshot (drop the `isCounterfactual` branch → an integration test must fail). Record each in a table: guard, mutation, result before, result after.
  - [x] Manual at 1280×720, EN and FR, with screenshots: the debrief is legible and un-truncated, no band overlaps another, the deeper-theory layer opens and closes, the counterfactual warning is visible after a replay, the case file opens over the board and hands input back on close, and under `prefers-reduced-motion: reduce` both surfaces paint a static frame with no update loop registered. **Screenshot before claiming rendering work is done** — depth-order and split-scale defects pass every test, and a whole room painted over everything shipped green in 2.9.

### Review Findings

Code review of 2026-08-07. Three parallel layers — Blind Hunter (diff only), Edge Case Hunter (diff +
project), Acceptance Auditor (diff + spec + context). Every finding below was re-verified against the
working tree before being written down; three were dismissed as noise and are listed at the end.

**Independently re-measured:** `npm run typecheck` clean; `npm test` **1125 passing across 67 files**,
matching the Completion Notes exactly; the baseline at `3bd19b7` re-measured in a clean worktree at
**997 / 61**, so the 128-test arithmetic holds line for line. Eight of the nine mutation rows were
reproduced by actually breaking the guard and re-running. The scope boundary held: no `src/ui/*`,
`src/game/*`, `src/domain/**`, `public/cases/**`, `src/schemas/**`, `advanceView.ts`,
`NotebookRenderer.ts` or `SceneRouter.ts` is touched, `AppState.ts` is one hunk inside
`reduceDebriefComplete`, and neither new surface imports the defensible-set selector.

**The theme of this review is the same one seven previous reviews found, in the one place this story's
own guards do not reach: text measured against a reserve that cannot hold it.** The story clamped
diligently and tested the clamps — but `sceneSlice.ts` reports a constant `height: 18` for every text
object, so no unit test can see a shrink, a crop, or a stack against a measured neighbour, and
`french-typography.spec.ts` measures fixed-height *control labels* only. Between those two blind spots
sit every finding numbered 1–16.

#### Decisions needed

- [x] [Review][Decision] **Pinning support silently discards a standing peer review** — In `review`:
  request feedback → issues render and "Save the revision" arms → pin or unpin one observation →
  `reduceTheorySupportRun` succeeds → `withTheory` (`src/core/store/AppState.ts:517-520`) clears
  `peerReview`, `consultation` and `rivalLabCritique`. On the next paint the issues pane reverts to
  "No feedback has been asked for on this draft yet" and the save control goes dead. The player loses
  work they just did, with **no message at all**: `CaseFilePresenter.report` returns early on success
  and only ever writes the status slot on a refusal. The reducer is correct and is on this story's
  do-not-touch list, so the answer has to be on the surface. Options: (a) warn in the status slot when
  a successful pin cleared a standing review, (b) disarm the pins while a review stands, (c) accept as
  known behaviour and record it. Note the guided-adventure rule covers refusals, not destructive
  successes — so this is genuinely a new call, not an existing rule being broken.
- [x] [Review][Decision] **`error.conclusion-not-ready` still names the theory board, and the board
  still lists nothing** — AC7 is titled "stops pointing at a surface that does not exist". The copy is
  unchanged by this diff (`src/core/i18n/locales/en.ts:441`, `src/core/i18n/locales/fr.ts:333`) and
  still reads "The theory board lists what is still missing" / "Le tableau de théorie indique ce qui
  manque", while the list now lives inside an overlay reached by a separate control labelled "Open the
  case file" (`src/adapters/phaser/renderers/ColleagueRenderer.ts:934-945`). A refused player who reads
  the message and looks at the board sees nothing enumerating what is missing. Task 6 did direct the
  list into the case file, so this is the story's own design rather than a deviation — but the
  Completion Note "It is in the case file, which is the surface the copy has been pointing at since
  Story 2.7" overstates it. Options: (a) re-point the copy at the case file in both locales, (b) accept
  the indirection, (c) also surface the missing count on the board itself.
- [x] [Review][Decision] **Ratify the shared lower band** — Task 2 asked for a deeper-theory band **and**
  a critique-history band; the build ships one shared band (`debriefLowerBand`,
  `src/adapters/phaser/scenes/debriefGeometry.ts:430-439`), so AC1's optional layer and AC3's challenge
  history are mutually exclusive on screen. The deviation is stated in §Implementation Plan, the
  404-character French critique arithmetic reproduces by hand at 1024×768, and it is asserted rather
  than left in prose (`tests/unit/DebriefGeometry.test.ts:206-216`). Recorded and justified — but it is
  a design consequence worth ratifying explicitly rather than inheriting silently.

#### Patches

- [x] [Review][Patch] `CaseFilePresenter.clamp` neither crops nor hides when the room is zero or
  negative, so the text is left painted at full size outside its band — `DebriefRenderer.clamp` hides in
  the identical situation. Same name, same docstring lineage, one branch apart; this is the copy-paste
  seam between the two new renderers and one of the two is wrong. [src/adapters/phaser/renderers/CaseFilePresenter.ts:740]
- [x] [Review][Patch] Every reference row's provenance line is drawn cropped. The row is 44px with an
  8px inset top and bottom and a title clamped to an 18px line, leaving `44 − 8 − 26 = 10px`; the clamp
  floor is 11px, where a single line is ≈15px, so `setCrop(0, 0, w, 10)` fires unconditionally in both
  locales with no long string and no degraded content required. [src/adapters/phaser/renderers/caseFileGeometry.ts:107]
- [x] [Review][Patch] The observation detail is a three-part interpolation
  (`{slitSpacing} · {screenDistance} · {result}`) wrapping at 368px into a 22px reserve whose docstring
  calls it a single "settings-and-result line". FR is ~85 chars, EN ~73 — both wrap to two lines and are
  cropped. [src/adapters/phaser/renderers/CaseFilePresenter.ts:398-415]
- [x] [Review][Patch] **AC7's readiness list is cut mid-sentence in French.** Measured in the real
  browser at the renderer's own font size and wrap bound, four of the eleven `conclusion.missing.*`
  strings exceed the 372px column — `distinct-run-configurations` 470px, `non-physical-young-run` 442px,
  `saved-comparison` 436px, `conclusion` 383px — and two lines at the 11px floor cost 30px against an
  18px crop. `saved-comparison` and `conclusion` are on the ordinary path to `synthesis → review`. Per
  §Layout constraints, shorten the copy in both locales rather than relax the bound, and add the
  readiness lines to the sweep. [src/adapters/phaser/renderers/caseFileGeometry.ts:117]
- [x] [Review][Patch] The French sweep guards the two recognition status markers against
  `debriefToggleStateWrap()` = 150px, but they are drawn at `DEBRIEF_RECOGNITION_STATUS_WIDTH` = 96px —
  a guard 56% looser than the surface it guards, on the exact constant whose own docstring says "the
  strip's 150 was a control's reserve, not a one-word status's". Today's copy fits either way, so the
  test is green and worthless. [tests/e2e/french-typography.spec.ts:967-968]
- [x] [Review][Patch] Two assertions compare a pure function's output to itself
  (`expect(debriefSummaryBand(width).height).toBe(debriefSummaryBand(width).height)`), so the half of
  the test named "leaves the reserves above it fixed" proves nothing — the shape Task 2 explicitly
  rejects and that the 2.7 and 2.8 reviews rejected seven times between them. [tests/unit/DebriefGeometry.test.ts:197-198]
- [x] [Review][Patch] `deeperTheory.title` — unbounded authored `LocalizedText`, no `.max()` in the
  schema — is the one text in `DebriefRenderer` that is never clamped, painted into a fixed 36px strip.
  Two French lines end 10px below it; three cross into the shared lower band. [src/adapters/phaser/renderers/DebriefRenderer.ts:398]
- [x] [Review][Patch] `observationDetail` hard-codes `'slitSpacingMm'` / `'screenDistanceM'` and
  dereferences `selectPrimaryControl` unguarded — and that selector **throws** on an unknown id
  (`src/core/store/selectors.ts:29-35`). A restored record against a cached `case.json` that no longer
  authors either control throws inside `render()`, which the class's own header calls fatal: it advances
  the phase, skips later subscribers and strands the router. `DebriefRenderer` guards this class of
  degradation explicitly; the case file does not. [src/adapters/phaser/renderers/CaseFilePresenter.ts]
- [x] [Review][Patch] `comparisonText` can be hidden by the clamp and is never re-shown — no
  `setVisible(true)` on its path, unlike every other clamped text in the renderer. Once a long title
  hides it, the historical comparison stays blank for the life of the scene even after a locale change
  to shorter copy. One setter along from the permanent-shrink defect the clamp's docstring says it
  fixed. [src/adapters/phaser/renderers/DebriefRenderer.ts:313-320]
- [x] [Review][Patch] The stacking guarantee does not hold: `clamp` shrinks-then-crops and never forces
  one line, but `Text.height` is unchanged by `setCrop`, so `row.detail.setY(row.title.y + row.title.height)`
  places the detail two lines down whenever the title still wraps at the 11px floor. The docstring's
  stated invariant — "The title is clamped to a single line first, so the detail always has its own line
  to sit on" — is not what the code produces. [src/adapters/phaser/renderers/CaseFilePresenter.ts:649-654]
- [x] [Review][Patch] `createRow`'s comment says the row texts are "deliberately **not** pushed onto
  `this.objects`", but they are built through `this.text()`, which pushes (`:726`). `allObjects()`
  therefore returns each twice and `destroy()` destroys each twice. Phaser tolerates it, so nothing
  fails — what is broken is the invariant the comment asserts, and the next reader will trust it.
  [src/adapters/phaser/renderers/CaseFilePresenter.ts:612-618]
- [x] [Review][Patch] The case file's heading, guide, four section headings, page counter and status
  line are the only text family in the overlay outside its own clamp discipline. The FR guide is ~157
  chars against an 896px wrap — two lines at ≈35px in a 34px reserve — and the status slot renders
  arbitrary `selectLocalizedError` output, including the new 121-char FR
  `completion-timestamp-not-later`, vertically centred against a hard-coded single-line `18`.
  [src/adapters/phaser/renderers/CaseFilePresenter.ts:304-318]
- [x] [Review][Patch] The debrief's refusal message is unclamped in a 340×40 band. FR
  `replay-unavailable` is already two lines; three run into `debriefCounterfactualBand` — and
  `debriefRefusalBand`'s own docstring says the two are explicitly not exclusive ("a player on their
  second pass can be shown the warning and refused at the same moment"). [src/adapters/phaser/scenes/DebriefScene.ts]
- [x] [Review][Patch] The test that reserves room for that refusal derives it as `2 * DEBRIEF_REFUSAL_FONT_SIZE`
  = 26, but two rendered lines at 13px are `2 * ceil(13 * 1.35)` = 36 — under-derived by 27%, in a suite
  that defines and uses `lineHeight(fontSize)` for every equivalent claim. [tests/unit/AdvanceControlGeometry.test.ts]
- [x] [Review][Patch] `CASE_FILE_GUIDE_HEIGHT = 34` against its own stated worst case of "two lines of a
  French guide at `CASE_FILE_ROW_FONT_SIZE`" = 36, and the reserve is referenced by no test. The 2px
  lands inside the band gap so nothing is visibly damaged today — but this is the `GATE_BAND_HEIGHT`
  defect §Previous story intelligence warns about, verbatim. [src/adapters/phaser/renderers/caseFileGeometry.ts:78-79]
- [x] [Review][Patch] Recognition `row.status` is never clamped, and the recognition label's wrap is
  computed inline as `row.width - DEBRIEF_RECOGNITION_STATUS_WIDTH - DEBRIEF_TOGGLE_GAP` rather than
  through an exported `*Wrap()` helper — borrowing the toggle strip's gutter for the recognition row's,
  which contradicts `DEBRIEF_RECOGNITION_STATUS_WIDTH`'s own docstring. Every other wrap in the module
  is exported precisely so the sweep can read it; this is the one bound the 1280×720 pass found broken
  and no test can assert. [src/adapters/phaser/renderers/DebriefRenderer.ts:215-217]
- [x] [Review][Patch] `debriefRefusalBand` is painted by the scene but absent from the `bands()` list the
  overlap sweep runs over, so the Completion Notes' "No band overlaps another" excludes the one band the
  module added last. Computed by hand it is clear at 1024×768 — nothing checks that it stays so.
  [tests/unit/DebriefGeometry.test.ts:126-136]
- [x] [Review][Patch] Both "registers no update loop and starts no tween" tests assert nothing about
  tweens: the harness stubs `tweens.add` as `() => undefined` and records nothing
  (`tests/unit/sceneSlice.ts:235`). Neither renderer has a tween today, so this is an unsupported claim
  rather than a defect — but the Dev Agent Record says it "is asserted directly", and the assertion a
  later story would have to break does not exist. [tests/unit/DebriefRenderer.test.ts:383]
- [x] [Review][Patch] `requestSurface` is armed unconditionally in `review` while every pin reads store
  state first "so only the transition that changes something is sent", and `saveSurface` is gated on
  `reviewed`. Pressing request twice without an intervening save dispatches against a store that already
  holds a reviewed projection — a refusal earned by clicking a control the surface drew as live, which
  the class docstring forbids. No test exercises the repeat. [src/adapters/phaser/renderers/CaseFilePresenter.ts:492]
- [x] [Review][Patch] "Withholds the peer-review pane outside the review phase" passes with the pane
  fully visible and armed: `pressable()` returns 11 controls and `storeAtTheBoard(2)` already hides four,
  so `filter(...).length < pressable.length` can never fail regardless of the review controls. Assert
  `REQUEST` and `SAVE` by index instead. [tests/unit/CaseFileRenderer.test.ts]
- [x] [Review][Patch] `WALK_TO_DEBRIEF_COST_MS` is still `4 * RUN_STEP_COST_MS` — byte-identical to the
  pre-2.11 budget — while the header edited in the same commit claims "Story 2.11 added a case file
  opened twice. It does more, so it takes longer… Derived rather than rounded." Two hunks of one diff
  contradict each other, and the failure mode is a timeout attributed to the product rather than to the
  budget. [tests/e2e/canvasHelpers.ts:349]
- [x] [Review][Patch] `caseFileRightTextWrap` and `caseFileContentFits` are imported by no source file —
  only by their own tests — and the wrap's assertion is `K === K` (`caseFileReadinessBand(width).width`
  *is* `CASE_FILE_RIGHT_COLUMN_WIDTH`). A predicate exported as a safety property and consulted nowhere
  in the path it protects is documentation with a return type. [src/adapters/phaser/renderers/caseFileGeometry.ts:232]
- [x] [Review][Patch] `caseFile.pin` / `caseFile.close` / `caseFile.open` are **longer in English than in
  French** ("Pin as support" 14 vs "Épingler" 8), inverting the assumption the whole-string sweep is
  built on — and the sweep is French-only, so it would report green for an English label of any length.
  `caseFile.pin` at 13px is ≈95px against a 104px wrap inside a 30px box. Measure `max(en, fr)`.
  [src/core/i18n/locales/en.ts:262]
- [x] [Review][Patch] `if (openCaseFile)` is a dead runtime branch inside the conclusion-only narrowing,
  guarding the one line that makes the control live. The constructor docstring argues the discriminated
  union exists so "the compiler asks the right question" — this restores, as a branch the compiler
  cannot see through, exactly the drawn-live-but-dead control the union was chosen to make impossible.
  [src/adapters/phaser/renderers/ColleagueRenderer.ts]
- [x] [Review][Patch] The boot-title assertion now runs *after* the entire walk, where it asserts an
  incidental fact about a still-mounted DOM shell instead of the "the app booted before we start
  clicking" precondition it was. If boot fails, the walk fails several frames of noise later.
  [tests/e2e/canvas-transitions.spec.ts]
- [x] [Review][Patch] Two adjacent tests assert the same contract, differing only in closing through the
  control versus through `close()`, and neither name says which — so a future edit will delete the wrong
  one. [tests/unit/CaseFileRenderer.test.ts]
- [x] [Review][Patch] `completion-timestamp-not-later` is raised on a strictly-earlier comparison
  (`<`), so a completion stamped *equal* to the reviewed revision is accepted. The player-facing copy
  ("no earlier than") matches the code; only the identifier the next reducer author will copy says
  otherwise. [src/core/store/AppState.ts:791]

#### Deferred

- [x] [Review][Defer] **`tests/unit/sceneSlice.ts` reports a constant `height: 18` for every text object
  and stubs `setFontSize` / `setCrop` permissively** — deferred, pre-existing and already recorded by the
  developer under §Carried forward. No unit test can reach either clamp's shrink loop, its crop branch,
  or its `available <= 0` branch, and no measured-stacking assertion is possible. This harness gap is
  the direct cause of findings 1–16 being invisible to a 1125-test green suite, which makes it the
  highest-value item in this list even though it is not this story's defect. [tests/unit/sceneSlice.ts:235]
- [x] [Review][Defer] **`CASE_FILE_READINESS_ROWS = 11` silently drops a twelfth missing requirement** —
  deferred, pre-existing class. `renderReadiness` iterates the eleven rows rather than the `missing`
  array, and `I18n.test.ts` concedes `MissingConclusionRequirementCode` is "a type union with no runtime
  counterpart, so the roster cannot be swept" — so nothing verifies 11 is the enum's size. A twelfth code
  compiles, ships, and hides a requirement AC7 promised to show. [src/adapters/phaser/renderers/caseFileGeometry.ts:117]
- [x] [Review][Defer] **The canvas e2e walks are load-sensitive** — deferred, pre-existing contention
  class documented at length in `playwright.config.ts`, amplified rather than caused by this story. The
  claimed 53/7 does reproduce on an idle machine and was confirmed twice; under load,
  `canvas-transitions:102`, `debrief-replay:54` and `young-canvas-experiment` drop out with
  `expectActiveScene` timing out, and all three pass in isolation (17.4s and 17.5s against a 30s budget).
  2.11 adds two overlay open/close cycles and six `waitForInputToSettle` pauses to a walk whose timeout
  constant did not move. [tests/e2e/canvasHelpers.ts:349]

#### How the three decisions were resolved

Taken by Alexis, 2026-08-07, all three as recommended.

1. **The cleared peer review is reported, not prevented.** `CaseFilePresenter.report` now writes
   `caseFile.review.clearedBySupport` into the status slot when a *successful* support change cleared a
   standing review — and only then, by comparing `state.peerReview` against the state after the
   dispatch. Reported rather than warned about in advance, because the player is allowed to change
   their support and must not be talked out of it; the reducer is untouched.
2. **`error.conclusion-not-ready` now names the case file** in both locales ("The case file lists what
   is still missing." / "Le dossier indique ce qui manque."). Neither string names a scene, a phase or
   a route — "the case file" is furniture, the same way "the historical record" is — so `encodesPath`
   is satisfied. AC7's own title is now true of the copy.
3. **The shared lower band is ratified as built.** The deeper theory is optional and closed by default,
   so the band shows the challenges until the player opens it: a disclosure they drive rather than
   content silently overflowing. The 404-character French critique arithmetic reproduces by hand at
   1024×768 and is asserted in `DebriefGeometry.test.ts:206-216` rather than left in prose.

#### Review patch verification

`npm run typecheck` clean. `npm test` **1126 passing across 67 files** (1125 → 1124 when the two
duplicate close tests were folded into one, → 1126 with the two new case-file guards). `npm run test:e2e`
**53 passed / 7 failed on an idle machine**, the same seven carried retired-DOM names Story 2.12 owns —
identical to baseline.

A note on measuring that last number: three earlier runs of the suite reported 8 and 10 failures, with
`canvas-transitions:102`, `debrief-replay:54` and `young-canvas-experiment` dropping in and out. That
was **CPU contention from the review itself** — load average 46 on 18 cores while three review agents
ran — not the code. All three pass in isolation, and the suite returns the baseline 53/7 once the
machine is idle. It is recorded here because `playwright.config.ts` justifies `workers: 5` with "three
consecutive runs identical", and that claim holds only on an unloaded machine; the deferred item about
the walk budget is the honest version of it.

Six guards introduced or corrected by these patches were proven by mutation — broken, confirmed
failing, restored, and the restored suite re-run green.

| Guard | Mutation | Result |
| --- | --- | --- |
| The request control disarms once feedback stands | `armControl(requestSurface, true)` | fail (caught) |
| A pin that clears a standing review says so | drop the `peerReview` comparison | fail (caught) |
| The peer-review pane is withheld outside `review` | `setVisible(true)` unconditionally | fail (caught) |
| "Starts no tween" | add a tween in `DebriefRenderer.create()` | fail (caught) |
| The readiness lines fit their 372px column | restore the 80-character French string | fail (caught) — **470px > 372px** |
| The recognition status fits its **96px** column | lengthen `debrief.recognition.notRecorded` | fail (caught) — **129px > 96px** |

The last row is the one worth keeping: 129px **passed** against the old `debriefToggleStateWrap()`
bound of 150 and fails against the 96 the renderer actually paints. That is the difference between a
sweep and a sweep that can fail.

Two patches are deliberately *not* mutation-proven, and neither is provable with today's harness:
`CaseFilePresenter.clamp`'s hide-on-no-room branch and the row-stacking bound, because
`tests/unit/sceneSlice.ts` reports a constant `height: 18` for every text object and no fake text can
be made to overflow. Both are covered by the geometry suite's reserve arithmetic instead — which is the
second-best answer, and the reason the harness gap is the first deferred item.

#### Dismissed as noise (3)

- `readFileSync` reported as a missing import in `canvasHelpers.ts` — false positive; it is imported at
  line 1 and pre-dates this story.
- Four DOM assertions "deleted rather than re-pointed" in `debrief-replay.spec.ts` — explicitly
  authorized by Task 8 ("canvas text cannot be read from the DOM, so do not try to assert it in
  Playwright"), and all four have unit-level replacements in `DebriefRenderer.test.ts`.
- The Completion Notes say the `PhasePlaceholderScene` grep returns "two historical mentions in prose";
  it returns one (`tests/unit/AdvanceControlGeometry.test.ts:28`). Trivial overcount — AC1's deletion
  clause is met.

## Dev Notes

### Scope boundary — read this first

**In scope:** `DebriefScene` and its renderer and geometry; the case-file overlay on `TheoryBoardScene`
carrying the four assigned support/review intents and AC7's readiness list; the four new selectors; the
AC6 error-code split (a reducer change, deliberately authorized here — see D5); the deletion of
`PhasePlaceholderScene` and `phasePlaceholderGeometry.ts`; both locales; the tests.

**Explicitly not in scope:**

- **Character staging in the debrief or the case file.** `CharacterStage` is Story 2.9's and belongs to
  the boards and the rival lab. The debrief is a record being read, not a conversation; the
  `scenarioScript` authors **zero** dialogue beats for the `debrief` phase, so there is no beat to stage
  and adding one is a `case.json` content change nobody asked for.
- **`apparatus.reset`.** Still unowned (`deferred-work.md` §"Deferred from: development of 2-10"), and
  the bench is not this story's surface. Open Question 2 asks for the decision, which must be taken
  before 2.12 starts.
- **Deleting, restyling or extending any `src/ui/*` panel** — Story 2.12. `HistoricalDebriefPanel`,
  `TheoryBoard`, `ConclusionReviewPanel`, `ConsultationPanel`, `DecisionHistoryPanel` and
  `InquiryRecognitionPanel` all stay mounted and unchanged. They are several specs' only readable
  projection of canvas state, which is why 2.12 must replace those observations rather than merely
  delete the panels.
- **Porting `prediction.recorded`, `theory.conclusionSet` or `theory.limitationSet` to the canvas.**
  Story 2.12 **removes** them: the 1-of-4 choices supersede them, and leaving both live is the
  "free text must clear the proposal ID" hazard. Do not give any of the three a canvas dispatcher.
- **`consultation.requested`.** Its only dispatcher is `src/ui/review/ConsultationPanel.ts`, it is not
  in the assigned set, and it is not required to complete a case (`reduceConsultationRequest` refuses
  with `consultation-unavailable` and nothing gates on it). Flagged as Open Question 1 so 2.12 inherits
  a decision rather than a surprise — do not build it.
- **Re-deciding the sub-768px input suppression.** Story 2.12 owns it; this is the fourth
  `deferred-work.md` entry about the same unowned rule. Preserve today's behaviour: the bench suppresses,
  the library and the boards do not.
- **The ineligible-artifact context dead end** — Story 3.1.
- **`scenarioScript.scenes[].cast?`** — Story 3.4.
- **Any new persisted store field.** The deeper-theory toggle, the case file's open state and its page
  index are all ephemeral and widget-local, exactly as `DialogueBox`'s beat index is. The 2.8 review
  ratified that reading (Decision 4): a value meaningless five seconds later must not become persisted,
  exported, re-validated and replay-reset.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

**D1 — The four assigned intents go in an overlay on the theory board, not on the board itself.**
Measured, not preferred. The conclusion board spends `4 × 84 + 3 × 10` = 366px on cards anchored to the
canvas floor, 54px on the guide band and its gaps, and gives its whole top-right column to the submit and
advance controls — leaving a 332px room band that the dialogue panel overlays and that `proposalStageBand`
already reports as giving out at a four-line French beat. There is no band for an observation list with
two selection sets, a readiness list and a peer-review pane. `NotebookRenderer` (2.10 D3) reached the same
conclusion about the bench from the same arithmetic, and `ReferenceBookPresenter` (2.8 D1) established the
shape: the **scene** owns the overlay and suppresses its own input while it is up. Follow both, including
the suppression, which exists because a click meant for the overlay that fell through would choose a
conclusion.

**D2 — The debrief reads `completion`, never the live state.** `reduceDebriefComplete` snapshots
`decisionHistory`, `runs`, `inspectedSourceIds`, `comparison`, `critiqueHistory` and `recognition` at
completion, and preserves the *original* snapshot across a counterfactual replay. So the historical record
the debrief shows is fixed at first completion and cannot be rewritten by anything the player does
afterwards — which is AC2 and half of AC4, held by the reducer. Reading `state.critiqueHistory` instead
would show an empty list after a replay and the second run's challenges after a re-completion: both are
the failure AC2 names. Assert the reducer's behaviour; do not duplicate it.

**D3 — Recognition and peer review are localized by stable id, and the canonical English stays in the
record.** `deriveRecognition` emits English `label`/`description` and `evaluatePeerReview` emits `.en`
`feedback`/`revisionPath` because both are persisted and recomputed-and-string-compared on load
(`validateCaseRecordForDefinition`) — emitting the active locale would reject every record saved in the
other language. Both files say so in their own docstrings. The display therefore resolves by
`RecognitionId` (interface keys, already shipped) and by `ruleId` (authored `LocalizedText` in
`case.json`). This is the project's most-repeated defect class, and both surfaces currently render the
canonical English straight to the player from the retired DOM panels.

**D4 — The readiness list is not a defensibility leak.** `ConclusionReadiness` carries `status` and
`missing[]`, both derived from the player's own record; the defensible set lives in a *different*
selector (`selectDefensibleConclusionProposalIds`) that the boards deliberately cannot reach.
`LibraryScene` already reads `selectContextualReadiness` for its advance control's `isReady` on exactly
this reasoning: ADR-006 bars a surface from holding an opinion about a *conclusion*, not from reporting
what the player has recorded. Do not import the defensible-set selector into either new surface;
`CharacterStageView.test.ts` sweeps at source level for precisely that and the sweep should be extended
to cover the case file.

**D5 — AC6 is a reducer change and it is authorized.** Story 2.7 deferred it explicitly because its own
scope boundary forbade touching `AppState.ts`, and named "whichever story next touches the debrief
transition (2.11)" as the owner. This is that story. The change is one new failure code plus one key per
locale, patterned on `critique-timestamp-not-later`, which the same file already got right. Keep it to
that: no other reducer edit, and no widening of the compatibility allowlist.

**D6 — No `CaseDefinition` version bump, unless you change `case.json`.** Every authored string this
story renders — `debrief.summary`, the comparison, the deeper theory, `replayLabel`, the critique lines,
the peer-review feedback — is **already authored in both locales at version 1.14.0**. If you find you need
new content, bump the version and extend the record-compatibility allowlist with a comment saying why the
field is not progress-bearing; note the allowlist already carries three dead clauses (each bump adds one)
and the 2.8 review asked for it to be kept honest rather than widened on assumption.

### Read before editing — current behaviour that must survive

| Path | What it does today | Your change boundary |
| --- | --- | --- |
| `src/adapters/phaser/scenes/DebriefScene.ts` (18 lines) | An 18-line `PhasePlaceholderScene` subclass painting `Debrief (placeholder)` plus the phase, carrying 2.7's advance control (the replay). | **Replaced.** Keep the replay affordance's behaviour verbatim; lose the marker and the base class. |
| `src/adapters/phaser/scenes/PhasePlaceholderScene.ts` (154 lines) | The shell: marker, `AdvanceControl`, `TransientMessageSlot`, `resolveAdvanceRefusal(colleagueAnswers: false)`, `registerCanvasBoundsRefresh`, `shutdown` registered **after** the subscription (unlike `LibraryScene`, which the 2.8 review corrected — do not copy this ordering). | **Deleted** (Task 7). Read it first: its `create`/`render`/`requestAdvance`/`shutdown` is the exact behaviour `DebriefScene` must reproduce. |
| `src/adapters/phaser/scenes/phasePlaceholderGeometry.ts` | `placeholderAdvanceControlCentre` + the marker gaps. Read by `canvas-transitions.spec.ts`. | **Deleted**, replaced by `debriefGeometry.ts`. |
| `src/adapters/phaser/scenes/TheoryBoardScene.ts` (48 lines) | Hosts `synthesis` **and** `review` with one `ColleagueRenderer('conclusion')`; registers canvas bounds; `shutdown` releases both. | **Extended** with the case-file presenter and its suppression wiring. Register `shutdown` first. Do not split the scene. |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts` (978 lines) | Heading, guide slot (three tenants: the standing guide, a transient refusal, the chosen limitation), submit control, advance control, four cards floor-anchored, the room, the cast. The whole surface is measured; `ColleagueGeometry.test.ts` drives the real functions. **No public `setInputEnabled`** — deleted as dead by the 2.8 review; `applyInputState()` hard-codes `true` and runs only from `create()`. | **Add the case-file open control, and re-add `setInputEnabled` (Task 6).** Do not add a band, do not re-tenant the guide slot, and keep `advanceControlCentreOnBoard`/`submitConclusionControlCentre`/`lastProposalCardProbe` returning what the board paints — three specs read them. |
| `src/adapters/phaser/renderers/NotebookRenderer.ts` (761 lines) | The bench overlay: depth 9 000, backdrop, panel, paged rows, two selections, a keyboard-fed note field, key capture, `TransientMessageSlot`, `applyVisibility`. | **The pattern to copy** for the case file, including the depth constant, the paging, and the no-dispatch-on-repeat guard. Do not touch it. |
| `src/adapters/phaser/renderers/advanceView.ts` | `ADVANCE_TRANSITION_BY_PHASE` (total over `CasePhase`; `debrief` → `debrief-replay`), `GATE_REFUSAL_CODES`, `resolveAdvanceRefusal`, `resolveAdvanceView`, the relabel lockout. | **Untouched.** No gate reachable from the debrief has an authored colleague line, so no code joins the register. |
| `src/adapters/phaser/PhaserStoreAdapter.ts` | `advanceCase` maps six named moves to actions; three of the six are *not* `case.phaseAdvance` and each fails differently if a surface guesses. Timestamps are stamped here, never in a reducer. | **Widened** with the six new dispatchers. Keep the timestamp rule. |
| `src/core/store/AppState.ts` `reduceDebriefComplete` (`:777`) | `debrief-review-required` → timestamp validity → readiness → `reviewed-revision-required` (a four-field comparison against the last `decisionHistory` entry) → ordering → phase advance → snapshot (preserved when counterfactual) → clears `rivalLabCritique`. | **One change only:** split the ordering failure out of `invalid-completion-timestamp` (AC6). Nothing else. |
| `src/core/store/AppState.ts` `reduceReplayStart` (`:815`) | Refuses outside `debrief` or without `completion`; resets phase, controls, wavelength, inspections, prediction, runs, comparison, theory draft, both proposal ids, consultation, peer review, `decisionHistory` and `critiqueHistory`; sets `isCounterfactual`; **deliberately does not reset `locale`**. | **Untouched.** |
| `src/core/store/AppState.ts` `reduceTheorySupportRun` / `reduceTheorySupportSource` (`:574`, `:588`) | `unknown-theory-run` / `duplicate-theory-run` / `theory-run-not-selected`; `uninspected-theory-source` / `duplicate-theory-source` / `theory-source-not-selected`. **No phase gate** — support is adjustable in `synthesis` and `review` alike. | **Untouched.** The surface reads state first and never provokes a duplicate. |
| `src/core/store/AppState.ts` `reducePeerReviewRequest` / `reduceRevisionSave` (`:669`, `:676`) | Peer review requires phase `review`; a revision requires `peerReview.status === 'reviewed'`, a valid stamp later than the previous revision, and unique known support ids. On success it appends a `DecisionHistoryEntry` capturing `conclusionProposalId` and clears `peerReview` **and** `rivalLabCritique`. | **Untouched.** Note the clear: after a save, requesting feedback again is a fresh request, not a no-op. |
| `src/domain/recognition/recognitionRules.ts` | `deriveRecognition` over four `RecognitionId`s; English `label`/`description` inside the persisted `RecognitionState`. | **Untouched.** Localize at the selector by id. |
| `src/domain/review/peerReviewRules.ts` | `.en` `feedback`/`revisionPath`, `CANONICAL_UNAVAILABLE_MESSAGE` kept in sync with `review.unavailable` by convention. | **Untouched.** Localize at the selector by `ruleId`. |
| `src/adapters/phaser/SceneRouter.ts` | Read-only over the store; phase → scene from `scenarioScript`; rival-lab override; a routing throw must never escape the subscriber. | **Untouched.** A scene mirrors the phase and never advances it. |
| `src/game/main.ts` | `Record<RoutableSceneKey, Scene>`, exhaustive, `ROUTABLE_SCENE_KEYS` registered inactive; the router owns which runs. | **Untouched** — `DebriefScene`'s constructor signature does not change. |
| `public/cases/young-interference/case.json` | `version 1.14.0`. `debrief` fully authored EN+FR. `scenarioScript` maps `debrief → Debrief` with **zero** dialogue beats. `debrief.sourceRefs` cites two ids that match no artifact. | **Read only**, unless D6's condition fires. |
| `tests/e2e/debrief-replay.spec.ts` (46 lines) | Drives thirteen DOM controls end to end. Currently **passes** — it is not one of the seven carried failures. | **Rewritten canvas-only.** Do not delete an assertion to make a suite green; re-point it. |

### The theory board's space budget — measure, do not guess

From `ColleagueRenderer`'s own exported geometry, at 1024×768 with four proposals:

- Cards: floor-anchored, `4 × PROPOSAL_CARD_HEIGHT(84) + 3 × CARD_GAP(10)` = **366px**, plus
  `CANVAS_BOTTOM_MARGIN(16)`.
- Below the room: `GUIDE_BAND_HEIGHT(40) + GUIDE_TO_CARDS_GAP(8) + STAGE_TO_CARDS_GAP(6)` = **54px**.
- Room band: `768 − 16 − 366 − 54` = **332px**, of which the dialogue panel overlays the top and the
  remainder must clear a three-line plaque (49) plus the legibility floor (96).
- Top-right column: `SUBMIT_HEIGHT(34) + CONTROL_ROW_GAP(8) + ADVANCE_CONTROL_HEIGHT(40)` = **82px** at
  `SUBMIT_WIDTH(232)`, and the heading and guide wrap against `BOARD_TEXT_WRAP` = `944 − 232 − 16` = **696**.

**None of these numbers are asserted in prose anywhere** — `ColleagueGeometry.test.ts` drives the real
functions, because the previous revision of that same comment was wrong in five places and three
thresholds elsewhere had been justified against the wrong totals. If you add the open control to the
column, extend that test; do not restate an arithmetic result in a docstring and call it verified.

### Layout constraints

The canvas is a fixed **1024×768 `Scale.FIT`** surface that does not scroll. A surface that outgrows its
band is a defect, not a responsive state.

- **Measure, never assume.** Seven consecutive reviews found the same defect: an object placed against a
  constant while the object above it grew with French copy. Place every band against a measured
  neighbour or against the canvas floor.
- French runs 15–25% longer than English. The debrief's longest strings are unbounded authored prose —
  `historicalComparison.text` and `deeperTheory.text` have **no `.max()` in the schema**. Where two
  objects share a vertical budget, clamp the one that can grow, and state the band's worst case against
  the schema rather than the shipped copy.
- Read `768` / `1024` from `scene.scale`; geometry helpers take the canvas size as arguments; specs read
  `designSurface.ts`. Two specs (`accessible-control`, `scene-router`) still restate the pair — they are
  the tail of a tracked item and neither is yours unless you touch it.
- A fixed-height control's label must fit **on one line in French** at its authored size.
- **Diegetic never means hidden** (`EXPERIENCE.md` §HUD): every provenance label, every recognition line
  and the counterfactual warning are readable text at full size. Scientific and archival legibility
  outrank atmosphere.
- **Hit areas do not resize themselves.** `setInteractive` a second time only re-enables an existing hit
  area; `ProposalChoice.resizeHitArea` and `Zone.setSize(w, h, true)` are the two patterns. `Shape.setSize`
  throws, and a throw inside `render()` runs inside `dispatch() → notify()` — it advances the phase and
  then strands the router with no visible error (2.8's Debug Log).

### Animation and reduced motion

The cheapest correct option for both new surfaces is **no motion at all**. If any is added — an overlay
fade, a deeper-theory reveal — it inherits the whole contract: subscribe to the media query, register
**no** update loop under `reduce`, paint a static frame from `render()`, animate on elapsed time and never
on frame counters, and release every tween in `destroy()` **including tweens whose target is the renderer
itself**. `AdvanceControl`'s docstring states why it has none, and the two overlays that already exist
(`LectureBookRenderer`, `NotebookRenderer`) show what the obligation costs. Note also that an overlay
animation disables input for its duration, which is correct for a player and invisible to a spec clicking
at machine speed — export the durations if you add any, the way `BOOK_OPEN_MS` / `BOOK_TURN_MS` /
`BOOK_CLOSE_FADE_MS` are exported for `canvasHelpers.ts`.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011):** Phaser scenes own all interactive presentation; `CaseRecordPrintView`
  is the only non-Phaser exemption and dispatches nothing. **A feature is not done until the canvas can
  dispatch its intent** — before marking complete, `grep` for every dispatcher of every action touched; if
  the only one is under `src/ui/`, the story is unfinished no matter how green the unit tests are. Never
  add semantic HTML to mirror a Phaser gesture. `src/ui/*` panels are retired and are **not** a working
  fallback. `src/game/scenes/*` are orphaned template leftovers — real scenes live in
  `src/adapters/phaser/scenes/`. Scenes **mirror** the phase and must never define, infer, or advance it;
  the router (ADR-009) is read-only and never dispatches. **No scene→scene reach-in.** A routing failure
  must never escape the store subscriber. **Never author player-facing copy in `create()`** — create empty,
  populate in `render(state)` through `createTranslator(locale)`. Renderer contract: `create()` /
  `render(state)` / `destroy()`, releasing every object, tween, timer and listener. **Sticky canvas:**
  refresh `scale.updateBounds()` from a passive `window` scroll listener registered and removed by the
  scene lifecycle; browser tests must scroll before exercising in-canvas controls. Reading, paging and
  closing stay ephemeral — they never inspect evidence or alter progression. Never introduce a placeholder
  scene without a story in the same epic that replaces it.
- **Guided adventure:** everything is authored. Every forward transition has an in-scene affordance; a
  transition reachable only from outside the canvas does not exist. Authored copy must not name a scene,
  a phase, or a route (`encodesPath`). **A refused action always says why, and the message survives until a
  real state change replaces it. A gate the player can act on is answered by the authored colleague hint;
  anything else by the localized error. Never a raw error, never silence, never erased by an unrelated
  redraw.** Choices stay revisable; re-choosing must never fail on "already chosen". No hard fail, score,
  timer, or speed reward — **the rival lab included**. The evaluator is the sole completion authority.
  Defensibility is evaluator/critique-only and must never leak into a display projection (ADR-006).
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector.
  **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria** —
  the project's most-repeated defect, and the debrief is the last surface on `EXPERIENCE.md`'s own list of
  places it recurs. Interface strings through `translate`/`createTranslator`; prose the player reads is
  `LocalizedText`; proper nouns (colleague names, the rival's name, `creatorOrOrigin`) stay plain strings.
  Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont. Scientific values are
  canonical across locales — localize only for display, via `formatNumber`/`formatMeasurement`.
- **Organization:** `src/domain/` pure (no Phaser, DOM, `fetch`, IndexedDB, browser APIs, or Zod);
  `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side
  effects; the dependency direction never reverses. No `services/`/`managers/`/`helpers/` catch-all.
  Every Zod object is `.strict()`. Fallible operations return `Result<T, ResultError>`; error codes
  resolve to localized copy. **Never recalculate a saved historical run against a newer model.** Bump
  `CaseDefinition.version` on any contract change and keep the record-compatibility allowlist honest.
  Case definitions are immutable under `public/cases/` — **edit only `public/cases/…`**; `dist/` is build
  output and `.claude/worktrees/**` is a stale copy. Naming: `PascalCase` classes/files, `camelCase`
  modules, `UPPER_SNAKE_CASE` constants, actions `domain.verbPastTense`, events `noun.verb`.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal; no logging,
  JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. Cap text resolution
  at `min(devicePixelRatio, 2)` (`textStyles.textResolution()` already does). Prefer pre-rendered/atlas
  geometry over regenerating `Graphics` each frame — paint scenery **once**, as `ReadingRoomDecor` and
  `LaboratoryDecor` do. NFR1's 10-minute re-profile is **owned by Alexis, due before Story 2.12 is marked
  done** — do not clear that trigger, and do not add a scenery-heavy composition here without measuring.
- **Platform:** static web app; offline reload is a release gate. Never expose a raw error to the player.
  Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it.
  To test Phaser-adjacent logic, inject the structural slice (`sceneSlice.ts`, `SceneRouterTarget`).
  Assert public actions, selectors and rendered text — never Phaser private fields or incidental pixels.
  **Never assert a magic number a test shares with source unless both read one exported constant.** Some
  e2e specs already fail on baseline — check before attributing a failure to your change. axe and manual
  a11y are no longer gates; keep the reduced-motion check and delete no existing a11y spec.
  **`tsconfig.json` includes only `src`, so `npm run typecheck` does not type-check `tests/`** — a spec
  error passes typecheck and surfaces only when Playwright runs it (2.8 review).

### Previous story intelligence (2.10's review, and the 2.9 / 2.8 / 2.7 findings)

- **Two of 2.10's load-bearing defects were found by mutation, not by reading**, and both were "a green
  suite that cannot see the thing it claims": `const dark = false` erased AC4's entire painted dark state
  and a doubled `step()` erased AC3's one-step-per-press, and **each left 982/982 tests green**. AC8's
  mutation requirement exists because of this. Break each guard, confirm the failure, restore it, and
  record it.
- **The test harness itself was the blind spot.** `tests/unit/sceneSlice.ts` used to swallow `clear`, every
  `Graphics` fill, `setInteractive`/`disableInteractive`/`removeCapture`, and keyed listeners by event name
  alone — so dark vs lit, locked vs usable, and leaked vs released were all indistinguishable. It now
  records all four. If you need to assert something it cannot see, **extend the harness** rather than
  asserting a private field.
- **2.9 shipped a conclusion board that staged zero figures at every panel height, with a green suite**,
  because every staging test fabricated its own band instead of driving the renderer's geometry. The fix
  was `ColleagueGeometry.test.ts` driving the real functions at the real canvas size. Put the debrief's and
  the case file's decidable geometry in Phaser-free modules and drive **those**.
- **2.8's two library e2e tests passed with their feature deleted.** One asserted a summary it could not
  observe; one proved close rather than open. Both were rewritten and mutation-verified using only
  `data-active-scene`, because an open overlay suppresses the way out — so "the overlay opened" and "it did
  not" produce different routing. Use that technique; **do not add an observability hook to the product to
  make a test pass.**
- **The relabel lockout will bite the new e2e walk.** The theory board survives `synthesis → review`, the
  control relabels from "To your reviewers" to "Close the case", and `ADVANCE_RELABEL_LOCKOUT_MS` is 400ms.
  Two fast clicks land inside it and the second is correctly ignored. `clickUntilScene` is bounded and is
  the answer; a fixed sleep is not (2.10's review rejected a `RUN_ANIMATION_MS + 400` sleep for
  reintroducing the flake class the same file claimed to have removed).
- **A per-token typography sweep is not a wrap check.** Every new fixed-height label goes in the
  whole-string test. 2.10's sweep caught new copy the day it was written; the copy was shortened in both
  locales rather than the bound relaxed.
- **Do not import Phaser at module scope in anything a Vitest or Playwright spec imports.**
  `apparatusGeometry.ts`, `phasePlaceholderGeometry.ts`, `libraryGeometry.ts` and `instrumentView.ts` all
  exist for this; `debriefGeometry.ts` and `caseFileGeometry.ts` are the next two. Nothing enforces the
  boundary yet (tracked in `deferred-work.md`), so it is a convention you must hold.
- **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y` was 130 on
  grounds that were wrong in normal play; `GATE_BAND_HEIGHT` was 108 against its own 111px worst case.
  State why each number is what it is, and let a test compute the worst case rather than a comment.
- **Discard no `Result`.** `report()` treating "dispatched" as "committed" desynced the knob from the store
  for the rest of the session; `NotebookRenderer.toggleSelection` had the same shape. Every dispatch in the
  case file either surfaces its refusal or is guarded so the refusal is unreachable.
- **Localize as you build, not after.** The one real code defect in 2.4 was an English-only surface shipped
  months after the i18n foundation. Two of this story's surfaces currently render canonical English to the
  player from retired panels; do not carry that across.

### Git intelligence

`3bd19b7 Review 2.10`, `19d1329 Dev 2.10`, `569f4be Story 2.10`, `0db285a Review 2.9` establish the
rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned
items pushed to `deferred-work.md`. Read `517b8d4 Dev 2.8` first — it is the closest diff to this story's
shape: a `PhasePlaceholderScene` subclass replaced by a real scene, a reusable scene-owned overlay, a
Phaser-free geometry module, a new canvas dispatcher for a previously DOM-only intent, and five specs
re-pointed without deleting an assertion. `52d6412 Review 2.8` is what hardened it, and its 32 patches are
the defect catalogue this story is most likely to repeat.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5,
`idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`, `workers: 5`).
`@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the
lockfile is committed to pin exact patches. **No web research was needed for this story** — it introduces
no library, and every API it touches (`Phaser.Scene` lifecycle, `Graphics`/`Rectangle`/`Zone` input,
`Text` measurement and wrapping, `ScaleManager.updateBounds`, depth ordering) is already used in the files
listed in §Read before editing. Copy those call sites rather than a general Phaser 4 example. Context7 MCP
is available for documentation lookup and is documentation-only.

### Project Structure Notes

- **New:** `src/adapters/phaser/renderers/DebriefRenderer.ts`,
  `src/adapters/phaser/renderers/CaseFilePresenter.ts`,
  `src/adapters/phaser/renderers/caseFileGeometry.ts`,
  `src/adapters/phaser/scenes/debriefGeometry.ts`,
  `tests/unit/DebriefGeometry.test.ts`, `tests/unit/CaseFileGeometry.test.ts`,
  `tests/unit/DebriefRenderer.test.ts`, `tests/unit/CaseFileRenderer.test.ts`,
  `tests/integration/DebriefSurface.test.ts`, `tests/integration/ConclusionSupport.test.ts`.
- **Revised:** `src/adapters/phaser/scenes/{DebriefScene,TheoryBoardScene}.ts`,
  `src/adapters/phaser/renderers/ColleagueRenderer.ts`, `src/adapters/phaser/PhaserStoreAdapter.ts`,
  `src/core/store/{selectors,AppState}.ts`, `src/core/i18n/locales/{en,fr}.ts`,
  `_bmad-output/project-context.md`, `_bmad-output/implementation-artifacts/deferred-work.md`,
  and the specs named in Task 9.
- **Deleted:** `src/adapters/phaser/scenes/PhasePlaceholderScene.ts`,
  `src/adapters/phaser/scenes/phasePlaceholderGeometry.ts`.
- **Do not touch:** any `src/ui/*` file, `src/game/*`, `src/domain/**`, `docs/validation/*`, `dist/`,
  `.claude/worktrees/**`. `public/cases/**` and `src/schemas/**` only if D6's condition fires.
  `src/core/store/AppState.ts` is opened for **one** change and one only, the AC6 code split (D5) — the
  four new selectors live in `selectors.ts`, which adds no store field, action, or persisted value.

### Baseline

Measured by the 2.10 review at HEAD `3bd19b7`, twice, identically:

- `npm run typecheck` — clean.
- `npm test` — **997 passing across 61 files**.
- `npm run test:e2e` — **53 passed / 7 failed** on chromium at `workers: 5`, in 1.7–1.8 min.

The seven failures are the **same seven carried retired-DOM names** — `accessibility`, `curated-record`,
`inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment` — all
of which fail on a DOM control (`Record prepared observation` and friends) that Story 2.12 owns.
**Re-measure before your first change** and record the before/after. `debrief-replay.spec.ts` is **not**
among the seven: it passes today and you are rewriting it, so a new failure there is yours.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.11` — the five ACs; §Story 2.3's superseded-implementation note (what `done` did *not* mean); §Story 2.12 for what this story must not build; §Story 2.5 for the `critiqueHistory` origin]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §1 (the dispatcher inventory and item 1b — the debrief placeholder nobody reported because nobody reached it), §3 (2.7 first, 2.12 last), §4.1 (ACs), §4.3 (ADR-011/012)]
- [Source: `_bmad-output/project-context.md` revision 2.1 — engine, guided-adventure, i18n, organization, performance, platform, testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — §User Interface and Rendering Boundary ("Surface completeness"), §State Patterns (the phase machine), §Phaser Object Patterns, §Consistency Rules, ADR-001 v1.1, ADR-003, ADR-006, ADR-007, ADR-009, ADR-011]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` revision 2.0 — §Information Architecture ("Debrief (`debrief`): compare the bounded conclusion with the historical record; recognition, layered explanation, provenance, and replay"); §Case flow ("Replays preserve the historical record while allowing counterfactual exploration clearly labelled as such"); §Key Flows step 9; §HUD & Diegetic UI; the EN+FR content-surface list, whose last entry is the debrief]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` §Core Loop step 7 and §Debrief space — "historical comparison, provenance, and optional deeper theory"; §Length targets — "optional replay after debrief"]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — §"Assigned at code review of 2-8" (the four intents, AC5); §"Deferred from: code review of 2-7" (`invalid-completion-timestamp`, AC6); §"Deferred from: development of 2-7" (`error.conclusion-not-ready`, AC7; and the `PhasePlaceholderScene` player-facing-behaviour item Task 7 closes); §"Deferred from: code review of 2-5" (`critiqueHistory` persisted but displayed nowhere — "Owner: whichever story builds the debrief surface", AC3); §"Deferred from: development of 2-10" (`apparatus.reset`, Open Question 2)]
- [Source: `_bmad-output/implementation-artifacts/2-8-library-reading-room-and-reference-book.md` — the whole file is the nearest precedent; §Decisions D1–D4, §Read before editing, §Spec fallout, and all 32 review patches]
- [Source: `_bmad-output/implementation-artifacts/2-10-physical-apparatus-and-player-started-light.md` §Review Findings (the mutation-testing discipline and the harness findings), §Decisions D3 (the overlay) and D6 (why a bespoke control is not `AdvanceControl`)]
- [Source: `src/adapters/phaser/scenes/PhasePlaceholderScene.ts` — the behaviour `DebriefScene` reproduces and the file Task 7 deletes; its own docstring names this story as the one that removes it]
- [Source: `src/adapters/phaser/scenes/LibraryScene.ts` — the reference lifecycle, including `shutdown` registered first and the intra-scene overlay suppression]
- [Source: `src/adapters/phaser/renderers/RivalLabRenderer.ts:1-80` — one scene, unbounded authored prose, a floor-anchored control, a measured heading, no animation]
- [Source: `src/adapters/phaser/renderers/NotebookRenderer.ts:1-140` — the overlay contract, `NOTEBOOK_DEPTH`, paging, the no-dispatch-on-repeat guard, and why depth is stated rather than left to creation order]
- [Source: `src/adapters/phaser/renderers/ColleagueRenderer.ts:58-400` — the board's exported geometry and the space budget; `:840-902` `submitConclusion` / `chooseProposal` / `requestAdvance`, the refusal patterns to reuse]
- [Source: `src/adapters/phaser/renderers/advanceView.ts:40-70` — `ADVANCE_TRANSITION_BY_PHASE`, total over `CasePhase`, `debrief` → the replay; `:105-166` the refusal register; `:168-196` the relabel lockout]
- [Source: `src/adapters/phaser/PhaserStoreAdapter.ts:7-131` — why three of six transitions are not `case.phaseAdvance`, and the timestamp-in-the-adapter rule]
- [Source: `src/core/store/AppState.ts:754-830` — `reduceDebriefComplete` (the AC6 split, and the preserved snapshot) and `reduceReplayStart`; `:574-600` the support reducers; `:669-705` peer review and revision; `:707-760` `reduceTheoryConclusionSubmit`, whose `critique-timestamp-not-later` is AC6's pattern]
- [Source: `src/core/store/AppState.ts:63-120` — `CompletionSnapshot`, `ReplayState`, and `DecisionHistoryEntry.conclusionProposalId`'s docstring on why provenance must outlive the live selection]
- [Source: `src/core/store/selectors.ts:376-462` — `selectLocalizedColleagueHint` / `selectLocalizedReadingGateHint` / `selectLocalizedRivalLabCritique`, the projection shape the four new selectors mirror, including the degraded-content rules; `:466-476` `selectPeerReview` / `selectRecognition` / `selectCompletionSnapshot` / `selectReplayState`]
- [Source: `src/domain/recognition/recognitionRules.ts` and `src/domain/review/peerReviewRules.ts` — why both emit canonical English, and why the display resolves by stable id]
- [Source: `src/core/i18n/locales/en.ts:204-213` — the eight `recognition.*` keys that ship in both bundles and that nothing resolves; `:273` `review.unavailable`; `:162-203` the `source.provenance*` / `source.type.*` / `source.rights.*` families; `:283-295` `conclusion.missing.*` (AC7); `:374-378` the debrief/replay error codes]
- [Source: `public/cases/young-interference/case.json` — `version 1.14.0`, the fully authored `debrief` block, `rivalLab.critiques`, `peerReviewRules`, and `scenarioScript.scenes` (the `debrief` entry has no dialogue beats)]
- [Source: `src/schemas/CaseDefinitionSchema.ts:528-538` the `debrief` schema; `:588-591` the `historicalComparison.sourceIds` cross-check and the absence of one for `sourceRefs`]
- [Source: `src/ui/debrief/HistoricalDebriefPanel.ts` — the surface being superseded: read it for the content inventory, not for the layout or the copy. Note it renders `item.label` and `completion.finalDecision` raw, and hard-codes English status lines]
- [Source: `src/ui/theory/TheoryBoard.ts:120-177` and `src/ui/review/ConclusionReviewPanel.ts:28-66` — the six intents AC5 moves, and their current refusal handling (`statusMessage = transition.error.message`, a raw untranslated English string — the defect not to reproduce)]
- [Source: `tests/unit/sceneSlice.ts` — the harness, and its docstrings on what it records and why]
- [Source: `tests/e2e/canvas-transitions.spec.ts` — the header table AC5 empties, the walk's DOM reach-ins to replace, and `canvasHelpers.ts`'s `clickDesign` / `clickUntilScene` / `expectActiveScene`]
- [Source: `tests/e2e/debrief-replay.spec.ts` — the assertions to re-point onto the canvas]
- [Source: `tests/unit/CompletionReplay.test.ts` — completion and replay through public actions, and `:51`, which pins the merged AC6 code]
- [Source: `docs/i18n-authoring.md` — the canonical-value traps and the `LocalizedText` vs `translate` split]

### Open questions for the reviewer (do not block implementation)

1. **`consultation.requested` has no canvas dispatcher and no owner.** Its only dispatcher is
   `src/ui/review/ConsultationPanel.ts`, which 2.12 deletes. It was **not** in the four intents assigned
   to this story, it is not required to complete a case, and nothing gates on it — so it is not an
   ADR-011 blocker. Three options, the same three `apparatus.reset` has: give the case file a "ask a
   colleague" control (cheap — the overlay is already there and `selectConsultation` already projects),
   assign it to 2.12 with the panel deletion, or declare the intent retired and remove it from
   `AppAction`. **Decide before 2.12 starts**, so 2.12 inherits a decision rather than a surprise.
2. **`apparatus.reset` is still unowned** (`deferred-work.md`, raised by 2.10's own open question 6 and
   deferred with "assign it before 2.12 starts"). Not this story's surface. Same three options.
3. **`debrief.sourceRefs` cites two ids that match no artifact** (`young-1801-lecture`,
   `newton-opticks-1730` against `young-lecture-1801`, `newton-opticks`), and the schema validates them
   only as non-empty strings while `historicalComparison.sourceIds` gets a real cross-check. Nothing reads
   the field. Either validate it against `contextualArtifacts` and fix the content, or delete it as a
   vestigial authoring field — but not silently, and not here unless you are told to.
4. **Is one overlay right for both phases, or two?** D1 puts the support selections, the readiness list
   and the peer-review pane in one case file, with the review pane appearing only in `review`. The
   alternative is two overlays. One is cheaper and reads as a single object the player picks up; two would
   let each be laid out for its own content. Confirm.
5. **Does the recognition list belong in the case file as well as in the debrief?** AC3 places it in the
   debrief, where it is a closing account. A player mid-investigation currently has no surface for it at
   all once `InquiryRecognitionPanel` is deleted. The design forbids a progress score, and a live
   recognition list is close to one — which is the argument for leaving it in the debrief only. Confirm,
   because 2.12 deletes the only other surface it has.
6. **Should a counterfactual replay be marked outside the debrief?** `isCounterfactual` is set the moment
   the replay starts and the debrief closes immediately, so the warning this story paints is next read at
   the *end* of the second pass. Throughout the replay itself the player has no signal that they are not
   building the record. The retired `HistoricalDebriefPanel` had one only because it stayed mounted in
   every phase. A session-wide marker is new cross-scene chrome that no AC asks for and no scene owns;
   flagged rather than built. Decide whether it wants an owner.

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5[1m]`), via `gds-dev-story`.

### Implementation Plan

Built in the story's task order, because each task is the previous one's consumer: the selectors and
the AC6 code split first (nothing renders without them), then the two Phaser-free geometry modules,
then the surfaces they lay out, then the shell deletion once its last subclass was gone, then the
localization and the tests.

Two decisions were taken during development that the story left open, and both were forced by
measurement rather than preference:

**The debrief's lower band is shared between the challenge history and the deeper theory.** The story
asked for both as separate bands. They do not fit. A shipped French `rivalLab.critiques[].line` is up
to **404 characters** — three lines across the full 944px room width and *seven* in a 336px column —
so both need the whole width, and after the two columns and the toggle strip there are 132 design
pixels left at 1024×768, which holds one of them. The layer is optional and closed by default, so the
band shows the challenges until the player opens it: a disclosure they drive, not content silently
overflowing. The arithmetic is in `debriefGeometry.ts`'s header and asserted in its test.

**The challenges are paged, one at a time.** Same measurement: three lines at full width is a readable
objection and a seventh of one is not. `NotebookRenderer` established paging for exactly this.

### Debug Log References

**Two defects the manual 1280×720 pass found that no test could see**, which is the reason the story
demands screenshots before rendering work is called done:

1. **A two-line French reference name painted through its own provenance line in the case file.** Each
   row's detail was placed against a *constant* offset from the row's top while the title above it grew
   with French copy — the exact defect seven consecutive reviews have found in a different scene each
   time. `CaseFilePresenter.stackRow` now clamps the title to one line and places the detail against
   its **measured** bottom. `tests/unit/sceneSlice.ts` reports a constant `height: 18` for every text
   object, so the harness cannot distinguish "measured" from "constant" here at all — recorded in the
   Completion Notes as a harness follow-up rather than papered over with an assertion that would pass
   either way.
2. **The recognition labels ran into their status markers.** No gutter between the two, and the French
   labels ("Rigueur documentaire relevée") wrapped onto a second line inside a fixed 56px row, where
   the clamp cropped them mid-word. Fixed twice over: a `DEBRIEF_TOGGLE_GAP` gutter, a
   `DEBRIEF_RECOGNITION_STATUS_WIDTH` of 96 (the strip's 150 was a control's reserve, not a one-word
   status's), **and** the copy shortened in both locales — the trailing "recorded" / "relevée" was the
   same word the status column beside it already said.

**One defect the geometry test found before anything rendered:** the case file's reference rows wrapped
against the *right* column's bound while sitting in the left column, so French names broke earlier than
the row required. `caseFileRightTextWrap` now reserves no pin (nothing in that column is pinnable) and
the rows use `caseFileRowTextWrap`.

**One assertion that was proven not to prove what it claimed.** The shared canvas walk clicks the
board's advance control while the case file is open and asserts the router does not move. Mutating
`ColleagueRenderer.applyInputState` back to a hard-coded `true` left the whole walk **green**: the
overlay's backdrop is a full-canvas interactive rectangle at `CASE_FILE_DEPTH`, and Phaser hit-tests
topmost-first among interactive objects, so it swallows the click either way. The e2e comment now says
what that click actually proves, and the suppression's own job — a card rebuilt mid-overlay not coming
back live — is asserted in `ColleagueGeometry.test.ts`, where it is the only thing acting. That
mutation is caught there.

**Two source-level sweeps fired during development and were answered by rewriting prose, not by
weakening the sweep:** `CharacterStageView.test.ts`'s ADR-006 sweep (extended to the four new modules)
rejected `CaseFilePresenter`'s own docstring for naming the defensible-set selector, and the geometry
suite rejected `DEBRIEF_COMPARISON_BAND_HEIGHT` at 170 against its own stated 171px worst case — the
`GATE_BAND_HEIGHT` defect the story warns about, caught the day it was written.

### Completion Notes List

**AC1 — the debrief exists.** `DebriefScene` is a real `Phaser.Scene`; `PhasePlaceholderScene.ts` and
`phasePlaceholderGeometry.ts` are deleted and `grep -rn "PhasePlaceholderScene\|phasePlaceholderGeometry" src tests`
returns nothing but two historical mentions in prose. The room renders the authored summary, the
historical comparison, its cited sources, the optional deeper theory (collapsed by default), the
recognition account and the challenge history — all in the active locale, no marker anywhere.

**AC2 — it reports the record.** Every projection reads `completion`, never the live fields, so the
record is fixed at first completion; `reduceDebriefComplete` is what holds that and the tests assert
it rather than re-implementing it. Provenance category, source type and rights status are named beside
every citation.

**AC3 — challenge as inquiry, recognition without a score.** The challenge history's heading is "Where
your claim was tested" — the framing is the heading rather than a disclaimer under it. The recognition
band carries an explicit "Not a score" intro, reserved unconditionally so the band does not change
height between a player who recorded everything and one who recorded nothing.

**AC4 — finishing and replaying.** `case.debriefCompleted` was **already** canvas-dispatchable: Story
2.7 put it on the theory board's `review` control as `advance.closeTheCase`, and this story satisfies
that half by keeping it working, not by rebuilding it. `case.replayStarted` is the debrief's own
`AdvanceControl`. "Campaign unlock state" is satisfied by the completed record surviving both the
replay and the re-completion — there is no campaign state in this build, and that reading is recorded
rather than answered by inventing an unlock field.

**AC5 — the four assigned intents.** All six (`theory.supportRunSelected` / `Unselected`,
`theory.supportSourceSelected` / `Unselected`, `peerReview.requested`, `revision.saved`) dispatch from
the case-file overlay. `canvas-transitions.spec.ts`'s gating-intent table is **empty**, and its walk
completes the Young case with canvas clicks only. Neither new surface reads the defensible-conclusion
set; the ADR-006 source sweep now covers all four new modules.

**AC6 — the timestamp split.** `completion-timestamp-not-later`, patterned on
`critique-timestamp-not-later`, with device-clock copy in both locales. The malformed-stamp message
keeps describing the malformed case. One reducer change and nothing else.

**AC7 — the readiness list.** `selectLocalizedConclusionReadiness` resolves by requirement `code`
through the existing `conclusion.missing.*` keys and supplies both interpolated counts, so no call site
can leave a raw `{count}` on screen. It is in the case file, which is the surface
`error.conclusion-not-ready`'s copy has been pointing at since Story 2.7.

**AC8 — tests.** See the arithmetic and the mutation table below.

#### Test count, accounted for

| | Files | Tests |
| --- | --- | --- |
| Baseline (`3bd19b7`, re-measured) | 61 | 997 |
| Now | 67 | 1125 |

The 128 new tests: **112** in six new files — `DebriefGeometry` 33, `CaseFileGeometry` 24,
`CaseFileRenderer` 18, `DebriefRenderer` 16, `DebriefSurface` 12, `ConclusionSupport` 9; **12** new
`it(...)` in existing files — `ReviewRules` +4, `ColleagueGeometry` +3, `I18n` +3, `CaseDefinition` +1,
`AdvanceControlGeometry` +4−3; and **4** from extending `CharacterStageView`'s `it.each` source sweep
to the four new modules. 112 + 12 + 4 = 128.

`npm run test:e2e`: **53 passed / 7 failed**, identical to baseline, and the seven are the same carried
retired-DOM names. `debrief-replay.spec.ts` was rewritten canvas-only and passes; it is not one of the
seven.

#### Mutation proofs (AC8)

Each guard broken, the failure confirmed, the guard restored, and the restored suite re-run green.

| Guard | Mutation | Before | Mutated | Restored |
| --- | --- | --- | --- | --- |
| Case-file no-dispatch-on-repeat | dispatch `selectSupportRun` unconditionally | pass | fail (caught) | pass |
| The counterfactual warning | force `isCounterfactual` false | pass | fail (caught) | pass |
| Recognition localized by id | return the record's canonical `.en` | pass | fail (caught) | pass |
| Peer review localized by `ruleId` | return `issue.feedback` | pass | fail (caught) | pass |
| Readiness localized by `code` | return `missing[].message` | pass | fail (caught) | pass |
| The preserved completion snapshot | drop the `isCounterfactual` branch | pass | fail (caught) | pass |
| The AC6 error-code split | merge it back into `invalid-completion-timestamp` | pass | fail (caught) | pass |
| Board suppression under the overlay | hard-code `applyInputState`'s flag to `true` | pass | fail (caught) | pass |
| The French whole-string sweep | lengthen `caseFile.pin` past its bound | pass | fail (caught) | pass |

The eighth row is the one that matters most: it **survived** the e2e walk first (see the Debug Log) and
only became detectable once the guard was tested where it is the only thing acting.

#### Manual pass — 1280×720, EN and FR, screenshots taken

The debrief collapsed and expanded, the case file open over the board, the board after close, the
counterfactual warning on the second pass, and the whole room under `prefers-reduced-motion: reduce`.
Both defects in the Debug Log came from this pass and were fixed and re-shot. No band overlaps another,
nothing is truncated, and the reduced-motion frame is identical — neither surface registers an update
loop, starts a tween, or reads a clock, which is asserted directly as well as photographed.

#### Carried forward

- **`tests/unit/sceneSlice.ts` reports a constant `height: 18` for every text object**, so it cannot
  see a text placed against a measured neighbour versus a constant — the class of defect the manual
  pass caught twice in this story. Extending the fake to derive height from the wrapped text and font
  size would make it visible, and it is a change to a harness three suites share, so it belongs to its
  own pass rather than to this one.
- **Open Questions 1 and 2 stand.** `consultation.requested` and `apparatus.reset` are still DOM-only.
  Neither gates a transition and neither is required to complete a case, so neither blocks ADR-011 —
  but both need a decision **before Story 2.12 starts**, which is the same thing the 2.10 review said.
- **Open Question 3 stands.** `debrief.sourceRefs` still cites two ids that match no artifact. Nothing
  reads it; the debrief cites `historicalComparison.sourceIds`, which the schema cross-checks, and a
  test pins that it does.
- Open Questions 4, 5 and 6 were answered as the story proposed: one overlay for both phases, the
  recognition list in the debrief only, and no session-wide counterfactual marker.

### File List

**New**

- `src/adapters/phaser/scenes/debriefGeometry.ts`
- `src/adapters/phaser/renderers/DebriefRenderer.ts`
- `src/adapters/phaser/renderers/caseFileGeometry.ts`
- `src/adapters/phaser/renderers/CaseFilePresenter.ts`
- `tests/unit/DebriefGeometry.test.ts`
- `tests/unit/DebriefRenderer.test.ts`
- `tests/unit/CaseFileGeometry.test.ts`
- `tests/unit/CaseFileRenderer.test.ts`
- `tests/integration/DebriefSurface.test.ts`
- `tests/integration/ConclusionSupport.test.ts`

**Deleted**

- `src/adapters/phaser/scenes/PhasePlaceholderScene.ts`
- `src/adapters/phaser/scenes/phasePlaceholderGeometry.ts`

**Modified**

- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `src/adapters/phaser/scenes/ColleaguesScene.ts`
- `src/adapters/phaser/scenes/DebriefScene.ts`
- `src/adapters/phaser/scenes/TheoryBoardScene.ts`
- `src/adapters/phaser/scenes/LaboratoryScene.ts`
- `src/adapters/phaser/scenes/LibraryScene.ts`
- `src/adapters/phaser/scenes/RivalLabScene.ts`
- `src/adapters/phaser/scenes/libraryGeometry.ts`
- `src/core/store/AppState.ts`
- `src/core/store/selectors.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `tests/e2e/canvasHelpers.ts`
- `tests/e2e/canvas-transitions.spec.ts`
- `tests/e2e/debrief-replay.spec.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/unit/AdvanceControlGeometry.test.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CharacterStageView.test.ts`
- `tests/unit/ColleagueGeometry.test.ts`
- `tests/unit/CompletionReplay.test.ts`
- `tests/unit/I18n.test.ts`
- `tests/unit/ReviewRules.test.ts`
- `tests/integration/DialogueAndChoice.test.ts`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`

**Not touched**, as the scope boundary requires: every `src/ui/*` panel, `src/game/*`, `src/domain/**`,
`public/cases/**`, `src/schemas/**`, `src/adapters/phaser/SceneRouter.ts`,
`src/adapters/phaser/renderers/{advanceView,NotebookRenderer}.ts`. No `CaseDefinition` version bump was
needed — every authored string this story renders was already authored EN+FR at 1.14.0 (D6).

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 1.1 | Code review: three parallel layers, 33 findings triaged. 27 patches applied plus 2 from decisions; 3 deferred; 3 dismissed. The theme was text measured against a reserve that cannot hold it — the case file's reference row reserved 10px for a ~15px line and its observation row one line for a detail that wraps to two, both in EN and FR on every render; four French `conclusion.missing.*` lines (AC7) were cropped mid-sentence at 383–470px against a 372px column; `deeperTheory.title`, the recognition status, the overlay chrome and the debrief refusal were unclamped. Reserves are now derived from exported `caseFileLineHeight`/`debriefLineHeight` helpers rather than stated, rows hold both lines (`CASE_FILE_ROWS_PER_PAGE` 4→3 to pay for it), and both locales were shortened rather than any bound relaxed. Also: the two clamps agreed on no-room, `selectPrimaryControl` can no longer throw inside `render()`, the request control disarms on a repeat, a pin that clears standing feedback says so, `error.conclusion-not-ready` names the case file, two tautological assertions and one unfalsifiable pane test were replaced, `sceneSlice` records tweens, the sweep measures the real 96px status bound plus the readiness lines and English, and the walk budget was re-derived. Six guards mutation-proven. 1126 tests / 67 files; e2e 53/7, identical to baseline. | Game Developer |
| 2026-08-07 | 1.0 | Implemented. `DebriefScene` is a real scene and `PhasePlaceholderScene` is deleted; the case-file overlay on the theory board carries the last six DOM-only gating intents and AC7's readiness list; AC6's timestamp code is split; both locales extended; 128 tests added (997 → 1125) with nine guards proven by mutation; e2e unchanged at 53/7. | Game Developer |
| 2026-08-07 | 0.1 | Story context created from epics.md §Story 2.11, sprint-change-proposal-2026-08-06 §4.1, EXPERIENCE.md v2.0, gdd.md, game-architecture v1.2, project-context v2.1, deferred-work.md (five items, three of which name this story as owner), the 2.8 and 2.10 story files and reviews, and the live source. | Game Scrum Master |

---
baseline_commit: 11c582a5302842ac347821069bb0cda0a29e917d
---

# Story 2.8: Library scene — the reading room and the reference book

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to enter a library, find the reference on the shelf, and pick it up to read it,
So that the case opens as a place I am in rather than a list of source cards.

## Acceptance Criteria

**AC1 — The room exists.**
**Given** the `context` phase,
**When** `LibraryScene` activates,
**Then** it renders an authored reading room — shelving, a reading surface, and the case's contextual artifacts as physical objects the player can approach — and no placeholder marker,
**And** `PhasePlaceholderScene` is no longer its base class.

**AC2 — Picking an artifact up opens it and records it.**
**Given** a contextual artifact present in the room,
**When** the player picks it up,
**Then** the reference book opens on the existing `LectureBookRenderer` pagination without change to its authored-page contract,
**And** the scene dispatches `source.inspected` for that artifact through the store adapter,
**And** re-opening an already-inspected artifact is a no-op success, never an error the surface must explain away.

**AC3 — Provenance is readable in-scene, and an unusable artifact says so neutrally.**
**Given** each artifact in the room,
**When** the player inspects it,
**Then** its title, creator or originating context, source type, provenance category, rights status, and case relationship are readable in-scene as text,
**And** an artifact whose rights are unreviewed or whose rendition is missing gives a neutral in-scene explanation and is never presented as verified evidence.

**AC4 — The gate is answered by a colleague, in fiction.**
**Given** the case's required reading is incomplete,
**When** the player tries to leave the library,
**Then** a colleague names the missing artifact in-fiction in the active locale,
**And** all valid work is preserved with no hard fail.

**AC5 — Leaving works, and unblocks the prediction board.**
**Given** the required reading is complete,
**When** the player leaves,
**Then** the Story 2.7 affordance dispatches `context → prediction`,
**And** the prediction cards in `ColleaguesScene` are live rather than refusing on `missing-contextual-sources`.

**AC6 — The overlay scene and its reach-in are retired.**
**Given** the reference book is now owned by `LibraryScene`,
**When** this story lands,
**Then** the session-persistent `LectureBookScene` overlay and its `(visible) => laboratoryScene.setApparatusInputEnabled(!visible)` scene-to-scene reach-in are retired in favour of store-mediated presentation,
**And** the session-wide `scroll` → `scale.updateBounds()` listener it owns is relocated to a scene that always runs, or the sticky-canvas bounds go stale in every phase,
**And** the book stays reachable from the laboratory for re-reading during `experiment`.

**AC7 — One constant, not three.**
**Given** the book's control geometry,
**When** this story lands,
**Then** the button width, the label shrink bound, and every test assertion read one exported constant,
**And** the `768` / `1024` design dimensions are read from `scene.scale`, not restated.

**AC8 — Tests.**
**Given** the library scene,
**When** tests run,
**Then** unit tests cover artifact-to-object placement geometry as a Phaser-free module,
**And** an integration test proves the pickup path records `source.inspected` and satisfies context readiness through public actions,
**And** an E2E test reads both required Young artifacts and leaves the library using canvas clicks only,
**And** every new player-facing string is asserted present in English **and** French.

## Tasks / Subtasks

- [x] **Task 1 — Author the required-reading colleague lines as case content (AC4).**
  - [x] Add `ReadingGateHint` + `ReadingGateHintPredicate` to `src/domain/cases/ColleagueCast.ts`, mirroring `ColleagueHint` exactly: `{ id, colleagueId, predicate, line: LocalizedText }`, predicate `{ kind: 'missing-artifact'; artifactId: string } | { kind: 'any-missing-reading' }`.
  - [x] Add `readingGateHints: readonly ReadingGateHint[]` to `CaseDefinition`.
  - [x] Add `ReadingGateHintSchema` to `src/schemas/CaseDefinitionSchema.ts`, `.strict()`, `.min(1)`, with the same superRefine guarantees `colleagueHints` gets: unique ids, `colleagueId` ∈ `colleagues[]`, `artifactId` ∈ `contextualArtifacts[]`, EN+FR both non-empty, **and `any-missing-reading` authored and last** (the always-satisfiable floor, so the gate can never refuse with nothing to say).
  - [x] `src/domain/review/readingGateHints.ts` — pure, no Phaser/store/locale/Zod. `selectReadingGateHint(definition, inspectedSourceIds): ReadingGateHintProjection | undefined`, returning `undefined` when readiness is `ready`. Reuse `evaluateContextReadiness`; do not re-derive "missing".
  - [x] Author in `public/cases/young-interference/case.json`, EN+FR: one `missing-artifact` line per contextual artifact (naming that artifact in prose) plus the `any-missing-reading` floor. In-fiction, attributed to an existing `colleagues[]` member, naming a reading — never a scene, phase or route (`encodesPath`).
  - [x] Bump `case.json` `version` `1.11.0` → `1.12.0`, and add `'1.11.0'` to the compatible-version list in `src/schemas/CaseRecordSchema.ts` with a comment saying why (`readingGateHints` is not progress-bearing).
  - [x] `selectLocalizedReadingGateHint(state)` in `src/core/store/selectors.ts`, shaped exactly like `selectLocalizedColleagueHint` (`{ hintId, speaker, line }`, speaker via `formatAttribution`/`projectAttribution`).

- [x] **Task 2 — Route `missing-contextual-sources` to the colleague register (AC4).**
  - [x] Add `'missing-contextual-sources'` to `GATE_REFUSAL_CODES` in `src/adapters/phaser/renderers/advanceView.ts` and update its docstring (it currently says "exactly one today").
  - [x] Library passes `colleagueAnswers: selectLocalizedReadingGateHint(state) !== undefined` to `resolveAdvanceRefusal`, and paints the hint through `resolveAdvanceView`. Do not add a second rule — `advanceView.ts` already owns precedence, the transient-error override, and the hint's self-withdrawal.
  - [x] Extend `tests/unit/AdvanceView.test.ts`: the new code lands on the `'gate'` register, and with `colleagueAnswers: false` it still falls back to the localized error (the 2.7 review patch that made this code path reachable).

- [x] **Task 3 — Phaser-free room geometry (AC1, AC8).**
  - [x] `src/adapters/phaser/scenes/libraryGeometry.ts` (or `renderers/`), Phaser imported **as a type only or not at all** — Vitest and Playwright run in Node and Phaser touches `window` at import time. `apparatusGeometry.ts` and `phasePlaceholderGeometry.ts` are the precedent.
  - [x] Export: artifact-object placement for N artifacts across the shelf band (total, deterministic, no overlap, inside the canvas), the detail-panel band, the advance-control bounds, and the gate-line band. Every function takes `canvasWidth`/`canvasHeight` — never closes over `1024`/`768` (AC7).
  - [x] `tests/unit/LibraryGeometry.test.ts`: placement for 1, 2, and 4 artifacts; no object overlaps another or the detail panel; every rectangle is inside the canvas; the advance control clears the gate-line band. **No vacuous assertions** — the 2.7 review rejected four (`expect(y).toBeGreaterThan(0)` on a coordinate built from positive offsets, comparisons that reduce to `PADDING > 0`).

- [x] **Task 4 — Reusable reference-book presenter (AC2, AC6).**
  - [x] `src/adapters/phaser/renderers/ReferenceBookPresenter.ts` — owns one `LectureBookRenderer`, the `LecturePagination` for the open artifact, and the ephemeral spread index. API: `create()`, `open(artifact, locale)`, `close()`, `render(state)` (re-publish on locale change), `get isOpen`, `destroy()`. Follows the `create/render/destroy` renderer contract and releases everything.
  - [x] Move `src/ui/sources/lecturePagination.ts` → `src/domain/cases/lecturePagination.ts` (pure, no DOM). Re-point the single import in `src/ui/context/CaseContextAndPrediction.ts`. **That import line is the only permitted `src/ui/*` edit in this story.**
  - [x] Rendition selection uses `resolveRendition(source.textualRendition, locale)` — the book is read in the active language and falls back to the transcription of record. Never capture the locale.
  - [x] A locale change while the book is open must re-publish the presentation (the chrome, the reader label, the source label, the summary, and the translated-rendition notice are all locale-derived).

- [x] **Task 5 — Build `LibraryScene` (AC1, AC2, AC3, AC5).**
  - [x] `LibraryScene extends Scene` — **not** `PhasePlaceholderScene`. Store subscription stored, `shutdown` registered once, renderer destroyed there (`LaboratoryScene` is the reference lifecycle).
  - [x] `LibraryRenderer` under `src/adapters/phaser/renderers/`: shelving + reading surface drawn with `Graphics`/rectangles (no image asset, no loader entry, no rights-ledger entry — the same constraint 2.9 works under), one object per `selectContextualArtifacts(state)`, the detail panel, the gate-line slot, and the `AdvanceControl`.
  - [x] Text is created **empty** in `create()` and written in `render(state)` through `createTranslator(locale)`.
  - [x] Pickup: if `selectIsSourceInspected(state, id)` → open the book only (**no dispatch** — the store would refuse `duplicate-inspected-source`, and AC2 forbids an error the surface must explain away). Otherwise dispatch `source.inspected` through the adapter, then open the book on success; on failure show the localized error in the transient slot and do not open.
  - [x] Widen `PhaserStoreAdapter` with `inspectSource(sourceId)`. Do not let the scene call `store.dispatch` directly — every other scene goes through the adapter.
  - [x] Detail panel (AC3) renders, for the focused artifact: `displayName` (`resolveLocalizedText`), `creatorOrOrigin` (canonical), `t('source.type.<sourceType>')`, `t('source.provenanceName.<category>')` **as text, never colour alone**, `t('source.rights.<rightsStatus>')`, and `caseRelationship` (`resolveLocalizedText`). Reuse the existing `source.*` key families; author new `library.*` keys for room chrome only.
  - [x] AC3's unusable artifact: `!isSourceEligibleForInspection(a) || !a.textualRendition` → the object is present and its metadata readable, the pickup shows a neutral localized line (`library.artifact.unavailable` / `library.artifact.noRendition`), the book does **not** open, and nothing presents it as verified evidence.
  - [x] Advance control: reuse `AdvanceControl` + `advanceTransitionForPhase(phase)` exactly as `PhasePlaceholderScene` does. `isReady` is the honest gate read here — `selectContextualReadiness(state).status === 'ready'` — because it is a fact about the player's own record, not a judgement about a conclusion (ADR-006 bars only the latter).
  - [x] Transient refusals use `TransientMessageSlot` with the `AppState`-identity lifetime (Story 2.7's rule). Do not clear a message inside the render that draws it.
  - [x] Suppress the scene's own input while its book is open, at creation **and** on every visibility change — a scene rebuilt underneath an open or still-fading book must suppress before the first pointer event (`LectureBookRenderer.isOverlayVisible` stays true for the whole 180 ms closing fade, deliberately).

- [x] **Task 6 — Reference reading in the laboratory (AC6).**
  - [x] `LaboratoryScene` owns its own `ReferenceBookPresenter` and gains one in-scene reference affordance that opens an artifact for re-reading during `experiment`.
  - [x] Reading in the laboratory dispatches nothing and changes no progression — reading, paging, and closing stay ephemeral.
  - [x] Book-open suppression of the apparatus stays, but is now **intra-scene** (`ApparatusRenderer.setInputEnabled` driven by the scene's own presenter), not a callback from another scene.

- [x] **Task 7 — Retire `LectureBookScene` and its reach-in (AC6).**
  - [x] Delete `src/adapters/phaser/scenes/LectureBookScene.ts` and the `LECTURE_BOOK_SCENE_KEY` export.
  - [x] `src/game/main.ts`: delete the whole `onLectureBookReady` / `isOverlayVisible` / suppression-callback block; `StartGame(parent, store)`.
  - [x] Drop the now-dead `isOverlayVisible` constructor parameter from `ColleaguesScene`, `TheoryBoardScene`, `RivalLabScene`, `PhasePlaceholderScene` and `DebriefScene` — no book can be open in their phases once the overlay is gone. Keep each renderer's `setInputEnabled` (the laboratory and the library still need it). **Do not** leave a `() => false` default behind: the 2.7 review flagged exactly that as making a wiring omission a compile-time success.
  - [x] `src/main.ts`: delete `lectureBookController` / `pendingLectureBookPresentation` / `projectLectureBook`; pass `onLectureBookPresentationChange: () => {}` to `mountCaseContextAndPrediction` so the retired panel still compiles and still dispatches `source.inspected`. Keep the `LectureBookPresentation` type export path that `CaseContextAndPrediction` imports.
  - [x] Relocate the sticky-canvas listener: `src/adapters/phaser/canvasBounds.ts` exporting `registerCanvasBoundsRefresh(scene): () => void` (passive `window` `scroll` → `scene.scale.updateBounds()`, returns its own disposer). Call it in **every** routed scene's `create()` and dispose on `shutdown`. With the always-on overlay gone, exactly one routed scene is active at a time, so exactly one listener exists. Delete the stale comment at `LaboratoryScene.ts:26-27`.

- [x] **Task 8 — One book-control constant (AC7).**
  - [x] `LectureBookRenderer`: export `BOOK_CONTROL_WIDTH` and `bookControlLabelWrap()`; `drawControl`'s literal `150`, the `CONTROL_WIDTH - 16` shrink bound, and `activateControl`'s hit test all read them.
  - [x] Start the shrink loop below the authored size — the first iteration currently measures at 15px and then calls `setFontSize(15)`, one wasted measure/reflow per control per redraw.
  - [x] `tests/e2e/french-typography.spec.ts`: replace `const CONTROL_INNER_WIDTH = 134` with the exported bound.
  - [x] Replace the restated `1024`/`768` in `tests/e2e/canvas-transitions.spec.ts` (and any spec this story touches) with values derived from the canvas bounding box or from exported geometry. Closes the remaining half of the `deferred-work.md` "unlinked book-control coordinate" item.

- [x] **Task 9 — Localization (AC3, AC4, AC8).**
  - [x] Every new key in **both** `src/core/i18n/locales/en.ts` and `fr.ts`. `TranslationKey` is derived from `en`, so a missing French key is a `tsc` error — do not work around it.
  - [x] Room chrome, artifact-metadata labels, pickup refusals, and the unusable-artifact lines are interface strings (`translate`). The colleague's gate line is authored prose in `case.json` (`LocalizedText`). Do not mix the two.
  - [x] Add any new fixed-height control to `FIXED_HEIGHT_CONTROLS` in `french-typography.spec.ts` — the **whole-string** check. The per-token sweep provably cannot catch a two-line wrap inside a fixed-height rectangle.
  - [x] **How AC8's "asserted present in EN and FR" is actually met:** canvas text cannot be read from the DOM, so do **not** try to assert it in Playwright. Assert bundle completeness and non-emptiness in `tests/unit/I18n.test.ts` for every new `library.*` key, assert the authored `readingGateHints` lines carry both locales in `tests/unit/ReadingGateHints.test.ts` (or the schema test), and assert the French widths in `french-typography.spec.ts`. That is the same division `canvas-transitions.spec.ts` documents in its header.

- [x] **Task 10 — Tests (AC8).**
  - [x] `tests/unit/LibraryGeometry.test.ts` (Task 3).
  - [x] `tests/unit/ReadingGateHints.test.ts` — predicate selection over fixtures: nothing inspected → the first missing artifact's line; one inspected → the other's; both inspected → `undefined`; a case whose specific predicates all miss → the floor.
  - [x] `tests/unit/CaseDefinition.test.ts` — schema rejects a `readingGateHints` with an unknown `colleagueId`, an unknown `artifactId`, a missing floor, or a floor that is not last.
  - [x] `tests/integration/LibraryReading.test.ts` — **public actions and selectors only**: `source.inspected` for both artifacts moves `selectContextualReadiness` to `ready`; `case.phaseAdvance { nextPhase: 'prediction' }` is refused with `missing-contextual-sources` before and succeeds after; a re-inspect is the store's `duplicate-inspected-source` refusal, which is why the scene must not dispatch it.
  - [x] `tests/e2e/library-reading.spec.ts` — canvas clicks only: open artifact 1, page, close, open artifact 2, close, leave the library, assert `data-active-scene` becomes `Colleagues` (the observable hook `src/main.ts:138` sets), and assert a prediction card is live (the AC5 Blocker-A proof — today all four refuse on a canvas-only path). Every click target derived from exported geometry, never restated. Use `clickUntilScene` for the first click after the book closes (the 180 ms fade suppression). One negative test: an advance click with nothing read must leave the scene on `Library`.
  - [x] Reconcile the specs the retirement breaks — see §Spec fallout. Do not delete an assertion to make a suite green; re-point it.
  - [x] `npm run typecheck`, `npm test`, `npm run test:e2e`. **Measure the baseline first** (stash and run at `4ef6b83`) — seven chromium e2e specs already fail. Record the before/after comparison in the Dev Agent Record.
  - [x] Manual at 1280×720, EN and FR: the room is legible and un-truncated, the detail text does not overflow, the gate line is answered rather than silent, and `prefers-reduced-motion: reduce` paints a static frame with no update loop registered.

## Dev Notes

### Scope boundary — read this first

**In scope:** the `LibraryScene` reading room and its renderer, the reusable reference-book presenter, a canvas dispatcher for `source.inspected`, the authored required-reading colleague lines (a `CaseDefinition` contract change and a version bump), the retirement of `LectureBookScene` and its scene→scene reach-in, the relocated scroll listener, the book-control constant, both locales, and the tests.

**Explicitly not in scope:**

- Colleague or rival-lab **character staging** — Story 2.9. The gate line is text with an attributed speaker; do not draw a figure.
- The physical knob, the player-started light, `experiment.run`, `run.record`, or the in-scene notebook — Story 2.10. Task 6 adds only a reference affordance to the laboratory.
- Debrief content or `DebriefScene`'s replacement — Story 2.11. `PhasePlaceholderScene` **stays** for `DebriefScene`; it is deleted by 2.11 once it has no subclasses.
- Deleting, restyling or extending any `src/ui/*` panel — Story 2.12. The one permitted edit is re-pointing the `lecturePagination` import (Task 4).
- Re-deciding the sub-768px suppression — Story 2.12 owns it. Preserve today's behaviour.
- Any new store field or persisted state. Reading position is ephemeral and widget-local, exactly as `DialogueBox`'s beat index is.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

**D1 — Book ownership is scene-local; nothing reaches into another scene.** AC6 says "store-mediated presentation". What that closes is the defect: an un-routed always-on scene plus a `laboratoryScene.setApparatusInputEnabled(...)` reach-in. The build here is a `ReferenceBookPresenter` **owned by each scene that can host a book** (`LibraryScene`, `LaboratoryScene`). Everything cross-cutting — the artifacts, the locale, the inspection state — comes from the store; only the ephemeral spread index is widget-local. That is the `DialogueBox` precedent stated in its own docstring ("which line is showing is widget-local, it is never persisted"), and putting a page number in `AppState` would contradict it. Result: no reach-in, no always-on scene, no new store field. Flag it for the reviewer (Open Question 1) rather than reinterpreting AC6 silently.

**D2 — The colleague's line is authored case content, not an interface string.** Project rule: prose the player reads is `LocalizedText` in case data; interface strings go through `translate`. A named colleague's spoken line is prose. `colleagueHints` cannot be reused as-is — `selectColleagueHint` short-circuits on the significant-measure gate and its predicates read `runs`, not `inspectedSourceIds` — so this is a sibling collection with its own pure selector, mirroring the existing shape rather than inventing one. Story 2.7 explicitly deferred this line to "Story 2.8's AC4" and confirmed the reading in its Completion Notes.

**D3 — The scroll listener moves into every routed scene's lifecycle**, via one shared helper, because `project-context.md` prescribes exactly that ("registered and removed by the scene lifecycle"). A game-level listener would outlive the scenes it serves and reintroduce the "never released" half of the deferred item.

**D4 — The DOM reading path retires with the overlay.** `CuratedRecord` keeps dispatching `source.inspected` (2.12 deletes it), but its "read" projection had nowhere to draw once the overlay scene is gone. That is intended, and it is what makes several e2e specs need re-pointing — see below. Do not build a second book to keep the panel whole.

### Read before editing — current behaviour that must survive

| Path | What it does today | Your change boundary |
| --- | --- | --- |
| `src/adapters/phaser/scenes/LibraryScene.ts` (15 lines) | Nine-line `PhasePlaceholderScene` subclass painting `Library (placeholder)` plus the phase, carrying 2.7's advance control. | **Replaced.** Keep the advance affordance's behaviour verbatim; lose the marker and the base class. |
| `src/adapters/phaser/scenes/PhasePlaceholderScene.ts` | The shell: marker, `AdvanceControl`, `TransientMessageSlot`, `resolveAdvanceRefusal(colleagueAnswers: false)`, `setInputEnabled`. Its `requestAdvance` docstring names this story as the one that changes the `colleagueAnswers` argument. | **Keep** — `DebriefScene` still extends it until 2.11. Drop only the now-dead `isOverlayVisible` parameter. |
| `src/adapters/phaser/renderers/LectureBookRenderer.ts` (378 lines) | Full-canvas overlay, spread/summary drawing, page fitting, open/turn/close tweens, reduced-motion paths, `bookCloseControlCentre()`. **`isOverlayVisible` stays true for the whole 180 ms close fade, deliberately.** | **Reuse unchanged** except the exported control constant (Task 8). Do not touch the authored-page contract, the fitting loops, or the tween lifecycle. |
| `src/adapters/phaser/renderers/advanceView.ts` | `ADVANCE_TRANSITION_BY_PHASE`, `GATE_REFUSAL_CODES`, `resolveAdvanceRefusal`, `resolveAdvanceView`, the relabel lockout. | Add one code to the register. **One rule, not two** — do not write a second precedence path in the library. |
| `src/adapters/phaser/renderers/transientMessage.ts` | `AppState`-identity message lifetime (2.7). | Reuse. Never clear inside the render that draws the message. |
| `src/core/store/AppState.ts` `reduceSourceInspection` (`:443`) | `unknown-source-id` / `source-not-eligible` / `duplicate-inspected-source`; on success clears `consultation`, `peerReview`, `rivalLabCritique`. | **Untouched.** |
| `src/domain/cases/contextPredictionReadiness.ts` | `evaluateContextReadiness` — an artifact counts as missing if it is **ineligible or uninspected**. | **Untouched.** Note the consequence in AC3: an unreviewed artifact makes readiness permanently incomplete. Unreachable with shipped Young content (both are `reviewed`); do not "fix" the domain here — raise it (Open Question 2). |
| `src/core/store/selectors.ts` `selectLocalizedError` (`:80`) | The single presentation boundary for a `Result` failure; supplies `missing-contextual-sources`'s `{label}` itself. | Extend with the new hint selector. Never render `error.message` — that is the dev-facing English string. |
| `src/adapters/phaser/SceneRouter.ts` | Read-only over the store, maps phase → scene from `scenarioScript`, rival-lab override, a routing throw must never escape. | **Untouched.** The scene mirrors the phase and never advances it. |
| `src/game/main.ts` `:17-88` | Scene registry, auto-started overlay, the suppression callback. | Gutted by Task 7. Keep `ROUTABLE_SCENE_KEYS` exhaustiveness and the `Record<RoutableSceneKey, Scene>` shape. |
| `public/cases/young-interference/case.json` | `version: 1.11.0`; two `contextualArtifacts`, both `rightsStatus: 'reviewed'` with a `textualRendition`; `colleagues[]`; `scenarioScript.scenes` maps `context → Library`. | Add `readingGateHints`, bump the version. Change nothing else. `dist/` and `.claude/worktrees/**` are copies — edit only `public/cases/…`. |

### Spec fallout from retiring the overlay — reconcile all of it

Specs that use the DOM `Inspect {name}` buttons **only to satisfy the context gate** keep working untouched (the panel still dispatches): `accessibility`, `young-experiment`, `theory-board`, `scene-router`, `debrief-replay`, `progress-portability`, `inquiry-recognition`, `youngExperimentHelpers`.

Specs that open or close the **book** must be re-pointed:

| Spec | What breaks | Fix |
| --- | --- | --- |
| `tests/e2e/curated-record.spec.ts` | Three tests assert the DOM inspect → book open/summary/reduced-motion path. | Keep the DOM inspection-record assertions. Move the book assertions onto the canvas library path (or into the new spec). |
| `tests/e2e/french-typography.spec.ts` | "opens the reference book in French" opens it from the DOM; `CONTROL_INNER_WIDTH = 134`. | Open the book from the library; read the exported bound (Task 8). |
| `tests/e2e/dialogue-advance.spec.ts:33,75,103` | `const BOOK_CLOSE = { x: 512, y: 678 }` clicked after a DOM inspect — the book will no longer be open, so the click lands on live canvas. **A stray click on a proposal board is exactly the side effect the 2.7 review called out.** | Delete the stray clicks, or route the walk through the library. |
| `tests/e2e/canvas-transitions.spec.ts` | The `context → prediction` step inspects from the DOM then clicks `BOOK_CLOSE`; `DESIGN_WIDTH`/`DESIGN_HEIGHT` literals. | Replace with canvas library clicks — this spec's own header says 2.8 is what makes the walk honest. Update the "what is not a canvas click" table: `source.inspected` leaves it. |
| `tests/e2e/rival-lab.spec.ts` | Walk-in helper clicks `BOOK_CLOSE` after a DOM inspect. | Same. |
| `tests/e2e/offline-reload.spec.ts:121-135` | Drives a stale DOM reader (`Read the lecture record`, `.contextual-text-section`) that no longer exists. | **Already failing on baseline.** Verify against the stash before attributing it to this change. |

### Layout constraints

The canvas is a fixed **1024×768 `Scale.FIT`** surface that does not scroll. A surface that outgrows its band is a defect, not a responsive state.

- **Measure, never assume.** The 1.11, 1.12, 2.5, 2.6 and 2.7 reviews each found the same defect: an object placed against a constant while the object above it grew with French copy. Place the detail panel and the gate line against measured neighbours or against the canvas floor.
- French runs 15–25% longer than English. Unbounded prose (the case relationship, the colleague line) grows into empty space; where two objects share a vertical budget, clamp the one that can grow.
- Read `768` / `1024` from `scene.scale`. Geometry helpers take the canvas size as arguments (AC7).
- A fixed-height control's label must fit **on one line in French** at its authored size.
- Do not paint the advance control or the gate line over an artifact object or its detail text.
- **Diegetic never means hidden** (`EXPERIENCE.md` §HUD): every artifact object carries its readable label; scientific legibility outranks atmosphere.

### Animation and reduced motion

The book already honours `prefers-reduced-motion` and this story must not regress it. If the room adds any motion of its own (a pickup transition — `EXPERIENCE.md` calls for "a restrained transition into the reading surface"), it inherits the whole contract: subscribe to the media query, register **no** update loop under `reduce`, paint a static frame from `render()`, and release every tween in `destroy()` — **including tweens whose target is the renderer itself**. Animate on elapsed time, never frame counters. The cheapest correct option is to add no motion at all beyond the book's existing open/close.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011):** Phaser scenes own all interactive presentation; `CaseRecordPrintView` is the only non-Phaser exemption and dispatches nothing. **A feature is not done until the canvas can dispatch its intent** — before marking complete, grep for every dispatcher of every action touched. Never add semantic HTML to mirror a Phaser gesture. `src/ui/*` panels are retired and are not a working fallback. `src/game/scenes/*` are orphaned template leftovers — real scenes live in `src/adapters/phaser/scenes/`. Scenes **mirror** the phase and must never define, infer, or advance it; the router (ADR-009) is read-only and never dispatches. **No scene→scene reach-in** — the existing `LectureBookScene`→`LaboratoryScene` coupling is a story-owned deferral this story closes, not a pattern to copy. A routing failure must never escape the store subscriber. **Never author player-facing copy in `create()`** — create empty, populate in `render(state)` through `createTranslator(locale)`. Renderer contract: `create()` / `render(state)` / `destroy()`, releasing every object, tween, timer, and listener. **Sticky canvas:** refresh `scale.updateBounds()` from a passive `window` scroll listener registered and removed by the scene lifecycle; browser tests must scroll before exercising in-canvas controls. Archival book: one leaf is one authored printed page from the same pure pagination; **reading, paging, and closing stay ephemeral — they never inspect evidence or alter progression.** Never introduce a `PhasePlaceholderScene` subclass without a story in the same epic that replaces it.
- **Guided adventure:** everything is authored. Every forward transition has an in-scene affordance; a transition reachable only from outside the canvas does not exist. Authored copy must not name a scene, phase, or route (`encodesPath`). **A refused action always says why, and the message survives until a real state change replaces it. A gate the player can act on is answered by the authored colleague hint; anything else by the localized error. Never a raw error, never silence, never erased by an unrelated redraw.** Consultations and hints point at missing evidence, a source, an observable, or a test — they never supply the answer. Choices stay revisable. No hard fail, score, timer, or speed reward. The evaluator is the sole completion authority. Defensibility is evaluator/critique-only — never leak it into a display projection (ADR-006).
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria** — the project's most-repeated defect. Interface strings go through `translate`/`createTranslator`; prose the player reads is `LocalizedText`; proper nouns (`creatorOrOrigin`, colleague names) stay plain strings. Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont.
- **Organization:** `src/domain/` pure (no Phaser, DOM, fetch, IndexedDB, browser APIs, or Zod); `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No `services/`/`managers/`/`helpers/`. Every Zod object is `.strict()`. Fallible operations return `Result<T, ResultError>`. **Bump `CaseDefinition.version` on any contract change and keep the record-compatibility allowlist honest.** Case definitions immutable under `public/cases/`. Naming: `PascalCase` classes/files, `camelCase` modules, `UPPER_SNAKE_CASE` constants, actions `domain.verbPastTense`.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal; no logging, JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. Cap text resolution at `min(devicePixelRatio, 2)` (`textStyles.textResolution()` already does). Prefer pre-rendered/atlas geometry over regenerating `Graphics` each frame.
- **Platform:** static web app; offline reload is a release gate. Never expose a raw error to the player. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it. To test Phaser-adjacent logic, inject the structural slice (`SceneRouterTarget` is the reference). Assert public actions, selectors, and rendered text — never Phaser private fields or incidental pixels. **Never assert a magic number a test shares with source unless both read one exported constant.** Some e2e specs already fail on baseline — check before attributing a failure to your change. axe/manual a11y are no longer gates; keep the reduced-motion check and delete no existing a11y spec.

### Previous story intelligence (2.7, and the 2.6 / 2.5 / 1.12 reviews)

- **2.7 built the affordance you inherit, and its review produced twelve patches.** Read `2-7-in-scene-phase-transitions.md` §Review Findings before starting — four of them constrain this story directly:
  - The refusal register was bypassed by four of five hosts. It is now shared; **use it, do not re-implement it.** The review named your AC4 as the reason it had to be fixed.
  - A gate refusal with no applicable hint used to be completely silent. The fix routes through `colleagueAnswers`; the review notes that **this story is what makes that path reachable.** Authoring the always-satisfiable floor hint (Task 1) is the second guard.
  - Three tests substituted a different width for the one the board draws, because the constant was private. That is why Task 8 exports the book-control constant instead of adding a fourth copy.
  - Dead default parameters (`isOverlayVisible = () => false`) made a wiring omission a compile-time success. Task 7 removes the parameter rather than defaulting it.
- **2.6 shipped its whole rendering path with no automated coverage** — the manual check ran through a temporary Playwright spec that was then deleted. `advanceView.ts` and its unit tests exist because of that finding. Do not regress it: put the room's decidable logic in Phaser-free modules and test them there.
- **A per-token typography sweep is not a wrap check.** Every new fixed-height label goes in the whole-string test.
- **Do not import Phaser at module scope in anything a Vitest or Playwright spec imports.** This is why `apparatusGeometry.ts` and `phasePlaceholderGeometry.ts` exist; `libraryGeometry.ts` is the third for the same reason.
- **Hit areas do not resize themselves.** `setInteractive` a second time only re-enables an existing hit area; `ProposalChoice.resizeHitArea` is the pattern if a target must change size.
- **Localize as you build, not after.** The one real code defect in 2.4 was an English-only surface shipped months after the i18n foundation.
- **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y` was 130 on grounds that were wrong in normal play. State why each number is what it is.

### Git intelligence

`4ef6b83 Review 2.7`, `470bac6 Dev 2.7`, `bfdf246 Story 2.7`, `dad7ce3 Correct course` establish the rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned items pushed to `deferred-work.md`. `470bac6` is the diff to read first — it created `AdvanceControl`, `advanceView`, `transientMessage`, and `phasePlaceholderGeometry`, all of which this story extends rather than replaces. `4ef6b83` is the review that hardened them.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`). `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the lockfile is committed to pin exact patches. No web research was needed for this story — it introduces no library, and every API it touches (`Phaser.Scene` lifecycle, `Graphics`/`Rectangle`/`Zone` input, `ScaleManager.updateBounds`) is already used in this codebase in the files listed above; copy those call sites rather than a general Phaser 4 example.

### Project Structure Notes

- **New:** `src/adapters/phaser/renderers/LibraryRenderer.ts`, `src/adapters/phaser/renderers/ReferenceBookPresenter.ts`, `src/adapters/phaser/scenes/libraryGeometry.ts`, `src/adapters/phaser/canvasBounds.ts`, `src/domain/review/readingGateHints.ts`, `tests/unit/LibraryGeometry.test.ts`, `tests/unit/ReadingGateHints.test.ts`, `tests/integration/LibraryReading.test.ts`, `tests/e2e/library-reading.spec.ts`.
- **Moved:** `src/ui/sources/lecturePagination.ts` → `src/domain/cases/lecturePagination.ts`.
- **Revised:** `src/adapters/phaser/scenes/{LibraryScene,LaboratoryScene,ColleaguesScene,TheoryBoardScene,RivalLabScene,DebriefScene,PhasePlaceholderScene}.ts`, `src/adapters/phaser/renderers/{LectureBookRenderer,advanceView,ApparatusRenderer}.ts`, `src/adapters/phaser/PhaserStoreAdapter.ts`, `src/game/main.ts`, `src/main.ts`, `src/core/store/selectors.ts`, `src/core/i18n/locales/{en,fr}.ts`, `src/domain/cases/{CaseDefinition,ColleagueCast}.ts`, `src/schemas/{CaseDefinitionSchema,CaseRecordSchema}.ts`, `public/cases/young-interference/case.json`, and the specs in §Spec fallout.
- **Deleted:** `src/adapters/phaser/scenes/LectureBookScene.ts`.
- **Do not touch:** any other `src/ui/*` file, `src/game/scenes/*`, `docs/validation/*`, `dist/`, `.claude/worktrees/**`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.8` — the seven ACs; §Story 1.5 and §Story 2.1 superseded-implementation notes (what `done` did *not* mean); §Story 2.9/2.10/2.11/2.12 for what this story must not build; NFR20 and FR30]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §1 (Blocker A and the dispatcher inventory), §2 (impact), §3 (2.7 first, 2.12 last), §4.1 (ACs), §4.3 (ADR-011/012), §4.4 (the reworked `EXPERIENCE.md`)]
- [Source: `_bmad-output/project-context.md` revision 2.1 — engine, guided-adventure, i18n, organization, performance, platform, testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — §User Interface and Rendering Boundary ("Surface completeness"), §Communication Patterns, §Naming Conventions, ADR-001 v1.1, ADR-003, ADR-006, ADR-007, ADR-009, ADR-011]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` revision 2.0 — §Information Architecture ("Library (`context`): a reading room… take contextual artifacts off the shelf"); the **Source object** and **Step advance** component rows; §Layout contract; §Key Flows steps 1–2; §HUD & Diegetic UI]
- [Source: `_bmad-output/implementation-artifacts/2-7-in-scene-phase-transitions.md` §Review Findings, §Answering a refusal (AC4), §The transient lifetime fix, §Layout constraints]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — the `LectureBookScene` coupling item (Story 1.10 review), the book-control width triple and the `768`/`1024` restatement (1.1b and 2.5 reviews), the `PhasePlaceholderScene` player-facing-behaviour item (2.7)]
- [Source: `src/adapters/phaser/scenes/PhasePlaceholderScene.ts:113-141` — `requestAdvance`, whose docstring names this story as the one that supplies both the colleague line and the slot]
- [Source: `src/adapters/phaser/renderers/advanceView.ts:88-149` — `GATE_REFUSAL_CODES`, `resolveAdvanceRefusal`, and the `colleagueAnswers` contract written for this story]
- [Source: `src/adapters/phaser/renderers/LectureBookRenderer.ts` — the whole overlay to reuse; `:39-57` the geometry constants; `:282-320` `drawControl`/`activateControl` (the width triple); `:68` `bookCloseControlCentre`]
- [Source: `src/adapters/phaser/scenes/LectureBookScene.ts` — the scene being deleted, including the scroll-listener ownership its own docstring warns about]
- [Source: `src/game/main.ts:17-88` — the registry and the suppression callback to gut; `src/main.ts:88-144` — the controller wiring to remove and `data-active-scene`]
- [Source: `src/ui/sources/CuratedRecord.ts:96-136` — the inspect-once-then-open flow to reproduce on the canvas, including the already-inspected short-circuit]
- [Source: `src/ui/context/CaseContextAndPrediction.ts:77-135,237-247` — pagination, spread movement, and rendition resolution to lift into the presenter]
- [Source: `src/domain/cases/CaseDefinition.ts:68-81` `ContextualArtifact` + `isSourceEligibleForInspection`; `:44-66` `TextualRendition`; `src/domain/cases/ColleagueCast.ts:88-113` `ColleagueHint` — the shape to mirror]
- [Source: `src/domain/cases/contextPredictionReadiness.ts` — `evaluateContextReadiness` and the ineligible-artifact consequence]
- [Source: `src/core/store/AppState.ts:443-454` `reduceSourceInspection`; `:601-646` `reduceCasePhaseAdvance` (the `missing-contextual-sources` gate at `:610`)]
- [Source: `src/core/store/selectors.ts:51-113` (artifact/inspection/label selectors, `selectLocalizedError`); `:315-334` `selectLocalizedColleagueHint` — the projection shape to mirror]
- [Source: `src/schemas/CaseDefinitionSchema.ts:440-460,620-700` — `colleagueHints` validation and its floor-must-be-last superRefine; `src/schemas/CaseRecordSchema.ts:190-238` — the compatible-version allowlist]
- [Source: `src/adapters/phaser/ui/DialogueBox.ts` and `src/adapters/phaser/ui/AdvanceControl.ts` — the store-agnostic reusable-widget contract, exported geometry, and the ephemeral-view-state precedent]
- [Source: `src/adapters/phaser/scenes/LaboratoryScene.ts` — the reference scene lifecycle; `ColleaguesScene.ts` — the same shape with a renderer]
- [Source: `public/cases/young-interference/case.json` — `version 1.11.0`, `contextualArtifacts` (two, both reviewed), `colleagues[]`, `colleagueHints` (the authoring pattern to copy), `scenarioScript.scenes`]
- [Source: `tests/e2e/canvas-transitions.spec.ts` — the canvas-walk pattern, `clickDesign`/`expectActiveScene`/`clickUntilScene`, and the header table this story updates]
- [Source: `tests/e2e/french-typography.spec.ts:470-525` — the whole-string `FIXED_HEIGHT_CONTROLS` and `BOOK_CONTROLS` tests to extend]
- [Source: `tests/integration/CuratedRecord.test.ts` — the fixture-and-public-actions integration pattern to follow]
- [Source: `docs/i18n-authoring.md` — the canonical-value traps and the `LocalizedText` vs `translate` split]

### Open questions for the reviewer (do not block implementation)

1. **Does scene-local book ownership satisfy AC6's "store-mediated presentation"?** D1 argues it satisfies the intent (no reach-in, no un-routed scene, every cross-cutting fact from the store) while keeping ephemeral view state out of `AppState`, per the `DialogueBox` precedent. Confirm, or ask for an `AppState` reading field.
2. **An ineligible contextual artifact makes context readiness permanently incomplete** (`evaluateContextReadiness` counts it as missing), so AC3's neutral explanation would sit in front of a gate the player cannot open. Unreachable with shipped Young content — both artifacts are `reviewed` — but it is a real dead end for a future case. Fix in Story 3.1's contract hardening, or here?
3. **Two intents in the `review → debrief` chain are still unowned** (`theory.supportRunSelected`/`theory.supportSourceSelected`, `peerReview.requested`/`revision.saved`) and block Story 2.12's completion check. Carried from 2.7; still needs an owner — 2.11 or a new 2.13.
4. **Does the laboratory's reference affordance need an artifact chooser, or should it reopen the last-read artifact?** Task 6 assumes a chooser over the case's artifacts (two, today). A single "reopen" control is cheaper; confirm which reads better.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (`claude-opus-4-6`), via the `gds-dev-story` workflow.

### Implementation Plan

Built in the story's task order, because the dependencies run that way: the authored content and its
selector first (Tasks 1–2), then the Phaser-free geometry the renderer and every spec read (Task 3),
then the reusable presenter (Task 4), then the two scenes that own one (Tasks 5–6), then the retirement
the new owners make possible (Task 7), then the constants, the locales, and the tests (Tasks 8–10).

Four decisions taken during the build that the story did not pre-decide:

1. **`libraryGeometry.ts` imports Phaser not at all**, not even as a type. `apparatusGeometry.ts` and
   `phasePlaceholderGeometry.ts` import `AdvanceControl` (type-only Phaser); this one needed nothing,
   so it takes nothing. It re-exports `ADVANCE_CONTROL_WIDTH`/`HEIGHT` from the widget rather than
   restating them.
2. **`ReferenceBookPresenter` takes a `getLocale` reader**, not a `locale` argument per call. The
   project rule bars a defaulted locale because it converts a forgotten call site into a silent English
   render; a live reader supplied by the owning scene has no call site to forget and lets the book's
   own internal chrome redraws read the current language too.
3. **`designSurface.ts`** was added so the specs stop restating `1024`/`768`. A spec cannot import
   `game/main.ts` (it constructs a `Phaser.Game`), so the two numbers live in a module with no imports
   and both sides read it. This closes the second half of the `deferred-work.md` coordinate item.
4. **The bench's reference controls are measured, not fixed-height.** Their labels are authored
   artifact display names, and the French one wraps to two lines where the English fits on one. Each
   control is sized to its own measured label and the next is stacked under it.

### Debug Log References

Three defects found while building, each worth recording because none was visible from the code:

- **`Shape.setSize` throws, and the throw escaped into the store's notify loop.** The bench's reference
  controls were `Rectangle`s resized per render. `Cannot set properties of null (setting 'width')` was
  raised inside `ApparatusRenderer.render`, which runs inside the router's `start`, which runs inside
  `dispatch`'s notify — so `prediction → experiment` advanced the phase and then stranded the router,
  leaving `data-active-scene` on the previous scene with no visible error. Rebuilt on a shared
  `Graphics` for the fill and a `Zone` per control: `Zone.setSize(w, h, true)` is the one Phaser API
  that resizes a hit area with the object.
- **The book's three animations each disable input for their whole duration**, which is correct for a
  player and invisible to a spec clicking at machine speed. `BOOK_OPEN_MS`, `BOOK_TURN_MS`, and
  `BOOK_CLOSE_FADE_MS` are now exported and `canvasHelpers.ts` waits on the real numbers.
- **`canvas-transitions.spec.ts`'s `review → debrief` step was already flaky at baseline.** The two DOM
  clicks between the board's two advances take ~125ms, inside `ADVANCE_RELABEL_LOCKOUT_MS` (400ms), so
  the second click is correctly ignored. Measured at 125ms at HEAD *and* at the story's baseline
  commit, where the test also fails when run alone — it passed in the full baseline run only because
  nine parallel workers slowed the machine past 400ms. Fixed with the bounded `clickUntilScene`, which
  the file already uses for the book fade.

### Completion Notes List

**Baseline, measured before any change** (HEAD `11c582a`, whose only diff from the story's stated
baseline `4ef6b83` is this story file and `sprint-status.yaml`): `typecheck` clean, `npm test`
668 passing across 46 files, `npm run test:e2e` **43 passed / 7 failed** on chromium.

**After**: `typecheck` clean, `npm test` **764 passing across 49 files**, `npm run test:e2e`
**47 passed / 7 failed**. The seven failures are the **same seven test names** as baseline —
`accessibility`, `curated-record` (snapshots inspected source labels), `inquiry-recognition`,
`offline-reload`, `progress-portability`, `theory-board`, `young-experiment` — all of which fail on a
missing DOM control (`Record prepared observation` and friends) that this story never touches.
`offline-reload` specifically dies at line 89, well before the stale reader at 121–135 the story asked
about, so that reader was never reached at baseline either.

The test count moved 50 → 54, and the arithmetic accounts for every one: **+6** in the new
`library-reading.spec.ts`, **−2** from `curated-record.spec.ts` (the summary toggle and the
reduced-motion open/close, re-pointed onto the canvas path), **−1** from `canvas-transitions.spec.ts`
(the book-suppression test, moved to the room it is about), **+1** in `french-typography.spec.ts` (the
reading room's authored content). No assertion was deleted to make a suite green.

**Per acceptance criterion:**

- **AC1** — `LibraryScene extends Scene`, not `PhasePlaceholderScene`. `LibraryRenderer` draws shelving,
  a plank, a reading surface, one object per contextual artifact, and a detail panel — all coded
  geometry, no asset, no loader or rights-ledger entry. The placeholder marker is gone.
- **AC2** — Pickup opens the book on the unchanged `LectureBookRenderer` and dispatches `source.inspected`
  through the new `PhaserStoreAdapter.inspectSource`. An already-read artifact **re-opens without
  dispatching**, so the store's `duplicate-inspected-source` refusal is never provoked.
- **AC3** — The detail panel renders display name, `creatorOrOrigin` (canonical), source type,
  provenance category, rights status, and case relationship — **as text**, through the shared `source.*`
  key families. An ineligible artifact or one with no rendition gets a neutral localized line, does not
  open, and is never recorded.
- **AC4** — `readingGateHints` is a new `CaseDefinition` collection with the same validation
  `colleagueHints` gets (unique ids, cast attribution, real artifact ids, `encodesPath`, and a floor
  authored last). `missing-contextual-sources` joined `GATE_REFUSAL_CODES`; the room passes
  `colleagueAnswers` and paints through the shared `resolveAdvanceView`. No second precedence rule.
- **AC5** — Proven end to end by canvas clicks only in `library-reading.spec.ts`: both references read,
  the room left, a prediction card chosen, and `prediction → experiment` taken on it.
- **AC6** — `LectureBookScene` deleted, along with `LECTURE_BOOK_SCENE_KEY`, the suppression callback,
  the `isOverlayVisible` parameter on five scenes (**removed, not defaulted**), the `main.ts` controller
  wiring, and the now-dead `LectureBookController`. The scroll listener is
  `canvasBounds.registerCanvasBoundsRefresh`, registered and disposed by every routed scene. The book
  stays reachable at the bench through the laboratory's own presenter and reference shelf.
- **AC7** — `BOOK_CONTROL_*` and `bookControlLabelWrap()` exported and read by the draw call, the shrink
  bound, the hit test, and the spec; the control row's three x positions named; `designSurface.ts`
  removes the last restated `1024`/`768`.
- **AC8** — `LibraryGeometry.test.ts` (47 assertions, run against two canvas sizes so a memorised
  dimension fails), `ReadingGateHints.test.ts`, `LibraryReading.test.ts` (public actions and selectors
  only), `library-reading.spec.ts` (canvas clicks only), and EN+FR coverage split across
  `I18n.test.ts`, `CaseDefinition.test.ts`, and `french-typography.spec.ts`.

**Manual check at 1280×720, EN and FR** (screenshots taken through Playwright): the room is legible and
un-truncated in both, the detail text does not overflow its panel, the read state is carried by a
marker *and* a stroke rather than by colour alone, the gate line is answered by the attributed colleague
rather than left silent, the bench's reference shelf and the laboratory hint coexist without collision,
and under `prefers-reduced-motion: reduce` the book opens and closes as a static frame.
`LibraryRenderer` registers no update loop, starts no tween, and owns no timer.

**Open questions answered, for the reviewer:**

1. **Scene-local book ownership (D1) is what shipped.** No reach-in, no un-routed scene, every
   cross-cutting fact from the store, and only the spread index widget-local. Flagging rather than
   reinterpreting AC6 silently, as the story asked.
2. **The ineligible-artifact dead end was not fixed here.** `evaluateContextReadiness` is untouched, so
   an unreviewed artifact still makes context readiness permanently incomplete. Unreachable with shipped
   Young content; `ReadingGateHints.test.ts` pins that the colleague and the readiness rule at least
   agree about it. Still needs an owner — Story 3.1 or here on review.
3. **The two unowned `review → debrief` intents are still unowned.** Carried from 2.7, untouched.
4. **The laboratory's reference affordance is a chooser**, as Task 6 assumed — one control per readable
   artifact. Worth a second opinion: a single "reopen the last one" control would be cheaper, and with
   two artifacts the chooser is only marginally more useful.

### File List

**New**

- `src/adapters/phaser/canvasBounds.ts`
- `src/adapters/phaser/designSurface.ts`
- `src/adapters/phaser/renderers/LibraryRenderer.ts`
- `src/adapters/phaser/renderers/ReadingRoomDecor.ts`
- `src/adapters/phaser/renderers/ReferenceBookPresenter.ts`
- `src/adapters/phaser/scenes/libraryDecorGeometry.ts`
- `src/adapters/phaser/scenes/libraryGeometry.ts`
- `src/domain/review/readingGateHints.ts`
- `tests/e2e/canvasHelpers.ts`
- `tests/e2e/library-reading.spec.ts`
- `tests/integration/LibraryReading.test.ts`
- `tests/unit/LibraryDecorGeometry.test.ts`
- `tests/unit/LibraryGeometry.test.ts`
- `tests/unit/ReadingGateHints.test.ts`

**Moved**

- `src/ui/sources/lecturePagination.ts` → `src/domain/cases/lecturePagination.ts`

**Deleted**

- `src/adapters/phaser/scenes/LectureBookScene.ts`

**Modified**

- `public/cases/young-interference/case.json`
- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/renderers/ApparatusRenderer.ts`
- `src/adapters/phaser/renderers/LectureBookRenderer.ts`
- `src/adapters/phaser/renderers/advanceView.ts`
- `src/adapters/phaser/renderers/apparatusGeometry.ts`
- `src/adapters/phaser/scenes/ColleaguesScene.ts`
- `src/adapters/phaser/scenes/DebriefScene.ts`
- `src/adapters/phaser/scenes/LaboratoryScene.ts`
- `src/adapters/phaser/scenes/LibraryScene.ts`
- `src/adapters/phaser/scenes/PhasePlaceholderScene.ts`
- `src/adapters/phaser/scenes/RivalLabScene.ts`
- `src/adapters/phaser/scenes/TheoryBoardScene.ts`
- `src/adapters/phaser/ui/AdvanceControl.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/core/store/selectors.ts`
- `src/domain/cases/CaseDefinition.ts`
- `src/domain/cases/ColleagueCast.ts`
- `src/game/main.ts`
- `src/main.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/ui/context/CaseContextAndPrediction.ts`
- `tests/e2e/canvas-transitions.spec.ts`
- `tests/e2e/curated-record.spec.ts`
- `tests/e2e/dialogue-advance.spec.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/rival-lab.spec.ts`
- `tests/unit/AdvanceView.test.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/I18n.test.ts`
- `tests/unit/lecturePagination.test.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 0.1 | Story context created from epics.md §Story 2.8, sprint-change-proposal-2026-08-06, EXPERIENCE.md v2.0, game-architecture v1.2, project-context v2.1, the 2.7 story and review, deferred-work.md, and the live source. | Game Scrum Master |
| 2026-08-07 | 1.1 | Reading-room visual direction revised after author review ("too basic", with three reference photographs of period reading rooms). Palette moved off the laboratory's teals to warm walnut and lamplight; wall bays packed floor to ceiling with deterministically generated shelving; the shelf became a joined bookcase with cornice, uprights, picture lights and pockets of filler books; the references became bound volumes with gilt work, fore-edges, corner fleurons, a read ribbon, and the title on a bookplate centred on the front board; the desk gained a green leather blotter and a lamp pool; the dead lower third became panelled wainscot over a floorboard strip. `SHELF_INSET` widened 76→118 to give the bays depth. Scenery split into `ReadingRoomDecor` + `libraryDecorGeometry` so no hit target can move with a repaint; `AdvanceControl` gained an optional palette, defaulting to Story 2.6's exact fills. Still no asset, no loader entry, and no motion. Unit tests 764→798. | Game Developer |
| 2026-08-07 | 1.0 | Implemented all ten tasks. Reading room and reference book on the canvas; `source.inspected` canvas-dispatchable; `readingGateHints` authored EN+FR at `case.json` 1.12.0; `LectureBookScene`, its scene→scene reach-in, and the `isOverlayVisible` parameter retired; scroll listener relocated to the scene lifecycle; book-control and design-surface constants exported. Three `deferred-work.md` items closed. E2E fallout reconciled across five specs, none by deleting an assertion. | Game Developer |

---
baseline_commit: 0db285a
---

# Story 2.10: Physical apparatus instruments and the player-started light

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to turn a real knob and then press to start the light,
so that setting up and running the experiment feels like operating an instrument.

## Acceptance Criteria

**AC1 — The control is an instrument, not a stepper**

**Given** an authored `primaryControl` with a label, unit, range, and step,
**When** `LaboratoryScene` renders,
**Then** it draws a physical instrument — a knob or dial with a body, an indicator, and a travel arc bounded by the authored range — with its current value and unit legible beside it,
**And** the `+` / `−` text buttons are replaced.

**AC2 — Drag follows the pointer and dispatches only on-step values**

**Given** the player drags the knob,
**When** the drag moves,
**Then** the indicator follows the pointer within the bounded travel,
**And** the dispatched value snaps to the authored `step`, so an off-step value is never dispatched and the domain normalization rule stays invisible,
**And** the value is dispatched through `apparatus.controlSet`; the renderer never mutates state.

**AC3 — Discrete steps and keyboard reach the same record**

**Given** the same control,
**When** the player uses the discrete step affordances or arrow keys with the knob focused,
**Then** the value moves exactly one authored step,
**And** a pointer drag and a keyboard step to the same value produce an identical run record.

**AC4 — The apparatus is dark until the player starts it**

**Given** the apparatus at rest,
**When** no run has been started,
**Then** the source is **dark**, no wavefronts propagate, and no screen pattern is painted beyond a static unlit screen,
**And** an in-scene line invites the player to start the light.

**AC5 — Starting the light is the run**

**Given** the player presses the start-the-light control,
**When** the run begins,
**Then** the source ignites, light propagates from source to slits to screen, the interference pattern resolves on the screen, and the run completes within three seconds,
**And** the scene dispatches `experiment.run` and the run is recorded through `run.record`,
**And** the recorded value comes from the deterministic model — never from anything the animation computes.

**AC6 — Changing the setup returns the bench to darkness**

**Given** a completed run,
**When** the player changes a control,
**Then** the readout marks the recorded result as stale against the new setup,
**And** the light returns to its unlit idle state until the player starts it again.

**AC7 — The optional wavelength comparison is chosen in-scene**

**Given** the optional advanced wavelength comparison,
**When** the player selects an authored wavelength in-scene,
**Then** `apparatus.wavelengthSet` is dispatched from the canvas,
**And** wavelength remains optional and cannot alter the fixed 550 nm minimum-path history.

**AC8 — The notebook is readable and comparable in-scene**

**Given** the notebook,
**When** the player reviews or compares runs,
**Then** settings, values with units, timestamp/order, and observed result are readable in-scene, and any two saved runs can be compared with a note saved,
**And** no saved run is ever recalculated against a newer model version.

**AC9 — Reduced motion gets the resolved frame, not the journey**

**Given** `prefers-reduced-motion: reduce`,
**When** the player starts a run,
**Then** the result appears immediately as a static resolved frame with no propagation animation,
**And** the run is recorded identically.

**AC10 — Tests**

**Given** the apparatus,
**When** tests run,
**Then** unit tests cover drag-angle → stepped-value conversion as a Phaser-free module, at both range ends and across every step,
**And** unit tests assert the run value is model-derived and independent of animation state,
**And** an integration test proves start-the-light records a run through public actions,
**And** an E2E test records two significant Young measurements from the canvas alone,
**And** NFR1 is re-profiled at 1280×720 over a 10-minute lab loop with drag, staging, and propagation all active.

## Tasks / Subtasks

- [ ] **Task 1 — The Phaser-free instrument geometry and value conversion (AC1, AC2, AC3, AC10)**
  - [ ] New `src/adapters/phaser/renderers/instrumentView.ts`, following `advanceView.ts` and `characterStageView.ts` exactly: pure, **no Phaser import at all** (not even as a type), no store import, no selectors import. It is what the unit tests and the e2e click targets both read.
  - [ ] `resolveKnobValue({ min, max, step, angleRad })` (or `pointer → angle → value`): convert a pointer position relative to the knob centre into a **stepped, clamped** value. Export the travel arc's start and sweep angles so the painter, the indicator, and the tests read one set of numbers.
  - [ ] **Snap before dispatch, never after.** `normalizeControlValue` in `src/domain/apparatus/ApparatusControl.ts` already clamps and snaps — it is the reducer's guarantee, not the surface's. If the renderer dispatches a raw drag value and lets the reducer snap it, the reducer's *snapped* value comes back through `render()` and the indicator jumps under the cursor: the normalization rule becomes visible, which is exactly what ADR-012 forbids. Use the same tie rule the domain uses (`Math.floor(((v - min) / step) + 0.5)`, exact halves snap **up**) so the two can never disagree, and add a unit test asserting `resolveKnobValue` and `normalizeControlValue` agree across every step and at both ends.
  - [ ] Do **not** dispatch a value equal to the current one. A drag emits a pointer event per frame; dispatching an unchanged value mints a new frozen `AppState` on every one of them, which re-renders every subscriber, restarts the transient-message lifetime clock (`transientMessage.ts` keys on state object identity, and a new object clears the slot), and allocates in a hot path. Guard on `value !== state.activeControlValues[id]`.
  - [ ] Also export the bench's placement rectangles from `apparatusGeometry.ts` (see Task 2), not from here: this module owns the *conversion*, that one owns *where things are*. `libraryGeometry.ts` / `LibraryRenderer` is the precedent for the split.

- [ ] **Task 2 — Place the bench, in `apparatusGeometry.ts` (AC1, AC7, AC8, AC10)**
  - [ ] Every new coordinate goes in `src/adapters/phaser/renderers/apparatusGeometry.ts`, which imports Phaser **not at all** — that is why it exists (`ApparatusRenderer` imports `BlendModes` as a value, Phaser touches `window` at import time, and both Vitest and Playwright run in Node). A click target restated in a spec is the defect class the 2.5 and 2.8 reviews closed three times.
  - [ ] Export a centre-point helper per click target, in the shape `advanceToSynthesisControlCentre()` already has: `knobCentre(controlId | index)`, `stepAffordanceCentre(index, -1 | 1)`, `startTheLightControlCentre()`, `wavelengthChoiceCentre(index)`, `notebookControlCentre()`, and the notebook overlay's own row / selection / note-field / save targets. `canvas-transitions.spec.ts` and the new lab spec derive from these.
  - [ ] Extend `tests/unit/ApparatusGeometry.test.ts` with the same class of invariant it already pins for the advance control: **no bench object may overlap the screen bar at any authored distance.** `screenXForDistance(4) = 700` and `SIDE_COLUMN_LEFT = 680`, so the right-hand edge of the bench is genuinely constrained. Read the authored `min`/`max` from `case.json` as that test already does — do not restate 1 and 4.
  - [ ] Read `768` / `1024` from `scene.scale` in the renderer and from `designSurface.ts` in a spec. Geometry helpers take the canvas size as arguments.

- [ ] **Task 3 — Draw and drive the instruments (AC1, AC2, AC3)**
  - [ ] In `ApparatusRenderer`, replace `createButton` / `createControl`'s `+` / `−` pair with one instrument per authored `primaryControl`. Keep the readout: it is the "current value and unit legible beside it" AC1 asks for, and `selectFormattedControlValue` already localizes the number.
  - [ ] Body, travel arc, and tick marks are `Graphics` fill/stroke commands **drawn once** in `create()`; only the indicator moves, by `setRotation` / `setPosition` on its own object. `ReadingRoomDecor` and `LaboratoryDecor` are the precedent, and §Performance forbids regenerating `Graphics` in a render path.
  - [ ] Drag: `pointerdown` on the knob body arms the drag, `scene.input.on('pointermove')` tracks it, `pointerup` / `pointerupoutside` disarms. **Track on the scene, not on the knob** — a pointer that leaves the knob body mid-turn must keep turning it, which is what a real knob does and what `gameObject.on('pointermove')` cannot give you. `pointer.x` / `pointer.y` are already in design space (Phaser's `Scale.FIT` manager transforms them), so no manual mapping is needed.
  - [ ] Discrete step affordances stay, redrawn as part of the instrument rather than as the retired 27px `+` / `−` text buttons. They dispatch through the same path as the drag.
  - [ ] Keyboard: `scene.input.keyboard?.on('keydown-LEFT' | '-RIGHT' | '-UP' | '-DOWN')` moves the **focused** instrument by exactly one authored step. Focus is a renderer-local `focusedControlId`, set by clicking or dragging an instrument, with a **visible** focus treatment (`EXPERIENCE.md` §Controls asks for one). There is no DOM focus on a canvas.
  - [ ] **Arrow keys must not reach an instrument while the notebook's note field has focus** (Task 6) or while a run is in flight (Task 4). One `inputMode` field, checked in one place, rather than three independent guards.
  - [ ] `destroy()` must remove every keyboard listener and the scene-level `pointermove` listener. A listener on `scene.input` outlives the renderer if it is not removed, and the renderer contract calls this out for exactly this reason.

- [ ] **Task 4 — The light is dark until the player starts it (AC4, AC5, AC6, AC9)**
  - [ ] Delete the always-on propagation. `syncAnimationLoop()` today runs on `motionAllowed && inputEnabled` and registers from `create()`; ADR-012 and §Engine's don't-miss table forbid that. It now runs **only while a run is in flight**, and stops when the run resolves.
  - [ ] At rest: `sourceGlow` / `sourceCore` unlit, `beamGraphics` and `wavefrontGraphics` cleared, `fringeGraphics` cleared, and the screen painted as a static unlit bar. The `previewSpacingPx` preview path in `renderApparatusGeometry` is part of "no screen pattern beyond a static unlit screen" — **it must not paint fringes at rest.** Keep the *textual* preview line (`lab.preview`) if it still reads true after the copy rewrite in Task 7; the painted preview goes.
  - [ ] A new start-the-light control (its own widget or a rectangle+label in the renderer — not `AdvanceControl`, which is the phase-transition widget and must stay one thing). On press it calls a new `storeAdapter.runExperiment()`.
  - [ ] **`runExperiment()` dispatches `experiment.run` and nothing else.** `reduceExperimentRun` (`AppState.ts:366-400`) builds the `RunRecord` from `calculateYoungFringeSpacing` and hands it to `reduceRecordRun` itself — that *is* AC5's "recorded through `run.record`". A scene that also dispatches `run.record` gets `duplicate-run-id` on the second, or worse, two runs. Stamp `crypto.randomUUID()` and `new Date().toISOString()` in the adapter, never in the reducer — `submitConclusion` sets that precedent and the adapter's own docstring states the rule.
  - [ ] **Dispatch on press, animate afterwards.** The record is then a pure function of the state at press time, and a refusal (`experiment-phase-required`, `advanced-wavelength-locked`) is answered immediately with no animation to unwind. `render()` already detects a new run (`latest.id !== this.lastRunId`) and calls `animateRecordedRun()` — that hook is where the ignition sequence goes.
  - [ ] Lock the instruments, the wavelength chooser, and the start control for the duration of the run, and unlock on completion. A control change mid-flight would otherwise contradict AC6's stale rule against a run already recorded.
  - [ ] Total run animation ≤ **3 s**, wall-clock, and export the duration as a constant so the e2e spec waits it out rather than guessing (`BOOK_OPEN_MS` and its siblings are the precedent). Animate on elapsed time, never on frame counters.
  - [ ] AC6: on `apparatus.controlSet` or `apparatus.wavelengthSet`, the light returns to unlit idle. `latestMatchesActiveSetup` in `render()` already computes exactly the "stale" condition — reuse it; do not write a second one.
  - [ ] AC9: under `reduce`, no propagation tween and no update loop; `render()` paints the resolved frame directly and the same `experiment.run` is dispatched. The record must be byte-identical to the motion path — assert it, do not argue it.
  - [ ] Refusals go through the existing register: `resolveAdvanceRefusal` is the *advance* control's, so the start control needs its own two-register answer. A gate the player can act on gets the authored line; anything else gets `selectLocalizedError`. Hold it in a `TransientMessageSlot` so it survives until a real state change — a bare field is the defect Story 2.7 fixed.

- [ ] **Task 5 — The wavelength chooser (AC7)**
  - [ ] Three in-scene choices from the authored `experiment.wavelengthComparison`: `fixedMinimumPathNm` (550) plus `advancedChoicesNm` (450, 650). **Read them from the case, never as literals** — `reduceWavelengthSet` rejects an unauthored value with `unavailable-wavelength`.
  - [ ] New `storeAdapter.setWavelength(nm)` dispatching `apparatus.wavelengthSet`.
  - [ ] The advanced choices are locked until `minimumRuns` (2) fixed-550 nm runs exist. Draw the locked state and, on a click, say why through `error.advanced-wavelength-locked` — **which already exists in both locales**. Do not author a second string for it.
  - [ ] Selecting 550 nm is always permitted and is the reset path back to the minimum path. Nothing here may recalculate or re-label a saved run.

- [ ] **Task 6 — The bench notebook (AC8)**
  - [ ] New `src/adapters/phaser/renderers/NotebookRenderer.ts` on the standard contract, opened from a bench control and presented **over** the bench, following `ReferenceBookPresenter`'s ownership shape: the scene owns it, the scene suppresses apparatus input while it is open (`setInputEnabled(false)`), and there is **no scene→scene reach-in**. The bench has no room for an always-on ledger (see §The bench's space budget) and an overlay is the shape this codebase already has for "a second surface in the same room".
  - [ ] Each observation is readable in-scene: recorded order, timestamp, both control settings **with their units**, the observed result with its unit, the wavelength and mode, and the experiment model version. `selectNotebookObservations`, `selectRunObservation`, `selectPrimaryControl`, `formatRecordedValue` and `formatNumber` already supply every one of these — `src/ui/notebook/NotebookPanel.ts` shows exactly which selector answers which field. **Read it for the field list; do not import from it, extend it, or restyle it.**
  - [ ] Selection: two saved runs, through `comparison.runSelected` / `comparison.runUnselected`. The reducer refuses a third (`too-many-comparison-runs`) and a duplicate (`duplicate-comparison-run`); the surface must not provoke either — check `state.comparison.selectedRunIds` before dispatching, the same rule `inspectSource`'s docstring states for `duplicate-inspected-source`.
  - [ ] The comparison note: **an in-canvas text field**, see D5 for the decision and its stated limitation. Saved through `comparison.noteSaved`. The reducer refuses a blank note (`invalid-comparison-note`) and a pair that is not exactly two (`comparison-pair-required`) — answer both with the existing localized errors.
  - [ ] **No saved run is ever recalculated.** The notebook renders `record.result` and `record.experimentModelVersion` as stored. There is no call to `calculateYoungFringeSpacing` anywhere in this renderer, and a source-level sweep in the test task pins it.
  - [ ] New adapter methods for the three comparison intents. They are the last of Story 2.10's four unowned intents from `canvas-transitions.spec.ts`'s header table.

- [ ] **Task 7 — Locales, both files, same edit (AC1, AC4, AC5, AC7, AC8)**
  - [ ] Every new player-facing string goes in **both** `src/core/i18n/locales/en.ts` and `fr.ts` in the same edit. This is the project's most-repeated defect.
  - [ ] **Three existing `lab.*` strings name a surface that is being deleted and must be rewritten**, in both locales:
    - `lab.guide` — "Use the semantic laboratory controls or these matching visual step controls." There are no semantic laboratory controls after this story; the canvas is the surface.
    - `lab.result.emptyHint` — "…use Run experiment in the semantic controls." This is AC4's "in-scene line invites the player to start the light", currently pointing at a retired DOM button.
    - `lab.preview` — "Run experiment for an exact recorded fringe spacing." Same problem, and it must agree with whatever the painted preview does after Task 4.
    - Also read `lab.title` ("visual laboratory surface") against the `encodesPath` rule and the diegetic rule before leaving it.
  - [ ] `lab.control.decrease` / `lab.control.increase` (`−` / `+`) survive only if the step affordances still carry those glyphs. If they become arrows or are drawn, retire the keys rather than leaving dead entries — `tests/unit/I18n.test.ts` asserts key parity between the bundles, so a removal must be symmetric.
  - [ ] New strings needed, at minimum: the start-the-light control's label, the idle invitation, the in-flight state, the notebook control's label, the notebook's own headings and column labels, the wavelength chooser's label and its locked explanation, and the comparison note's field label and save control. Keep every **fixed-height control label** short enough that the French holds on one line at its authored size.
  - [ ] Scientific values stay canonical; localize only for display through `formatNumber` / `formatRecordedValue`. A recorded 4.95 mm is 4.95 in both locales and reads `4,95` in French.

- [ ] **Task 8 — Tests (AC10)**
  - [ ] `tests/unit/InstrumentView.test.ts`: drag-angle → stepped value at **both range ends and across every authored step**, for both controls, at two canvas sizes; the clamp beyond each end; the exact-half tie rule; and the agreement test against `normalizeControlValue` described in Task 1.
  - [ ] Extend `tests/unit/ApparatusGeometry.test.ts` with the bench/screen non-overlap invariant (Task 2).
  - [ ] A unit test asserting **the run value is model-derived and independent of animation state** (AC10, second bullet). Make it non-vacuous: drive `experiment.run` through a real store with the authored case, then assert the recorded `result.value` equals `calculateYoungFringeSpacing(...)` for the same inputs — and add a **source-level sweep** (the `readFileSync` pattern `CharacterStageView.test.ts` uses for ADR-006) asserting `ApparatusRenderer.ts` and the new notebook renderer never mention `calculateYoungFringeSpacing`, `interferenceIntensity`-derived values feeding a record, or `run.record`. Break it once and confirm it fails.
  - [ ] `tests/integration/YoungExperimentBench.test.ts` (or extend `tests/integration/MeasurementNotebook.test.ts`): start-the-light records a run **through public actions**, two runs at different screen distances satisfy `selectSignificantMeasureGate`, the comparison pair and note round-trip, and the advanced wavelength is refused before two minimum-path runs and permitted after. Build the store from the authored Young case, as `RivalLabCritique.test.ts` does.
  - [ ] A reduced-motion test on the renderer, injecting the structural scene slice (`{ tweens: { add, killTweensOf }, events, input, add: { graphics, text, … } }`) rather than a real `Phaser.Game` — `tests/unit/CharacterStage.test.ts` is the reference. Assert: no `events.on('update')` under `reduce`, no propagation tween, and the **same** recorded run as the motion path.
  - [ ] `tests/e2e/young-canvas-experiment.spec.ts` (new): reach the laboratory through the canvas walk `canvas-transitions.spec.ts` already establishes, then **record two significant measurements with canvas clicks only** — turn a knob (or step it), start the light, wait the exported run duration, change the throw, start it again — and prove the significant-measure gate opens by taking `experiment → synthesis` from the canvas. Every click target derived from `apparatusGeometry.ts`.
  - [ ] **Update `canvas-transitions.spec.ts`.** Its header table lists `experiment.run` and `comparison.runSelected` / `comparison.noteSaved` as owned by Story 2.10 — they are now canvas-dispatchable, so those rows leave the table and the DOM reach-ins at lines 117-120 and 131-135 are replaced with canvas clicks. `theory.supportRunSelected` / `theory.supportSourceSelected` and `peerReview.requested` / `revision.saved` stay in the table, and their owner is now **Story 2.11**, not "unowned" (assigned by the 2.8 review, `deferred-work.md` §Assigned).
  - [ ] `tests/e2e/french-typography.spec.ts`: add every new **fixed-height** control label to the **whole-string** `FIXED_HEIGHT_CONTROLS` sweep, reading each bound from the exported geometry. A per-token sweep provably cannot catch a wrap; this is recorded in three previous reviews.
  - [ ] Do not delete or weaken `young-experiment.spec.ts`, `measurement-notebook.spec.ts`, or `accessible-control.spec.ts`. They drive the retired DOM panel, they fail on baseline, and **Story 2.12 owns rewriting them.** Leaving them failing with the same names is the correct outcome here.

- [ ] **Task 9 — Verify, profile, and decide the suite's budget (AC9, AC10, and the standing gates)**
  - [ ] `npm run typecheck`, `npm test`, `npm run test:e2e`. **Measure your own baseline first** and compare failure *names*, not counts — see §Baseline.
  - [ ] **Screenshot the running game at 1280×720 in EN and FR, and under `prefers-reduced-motion: reduce`.** Rendering work is not done until it has been looked at: Story 2.9 shipped invisible figures, a rival drawn at 24% size, and a room painted over the entire surface, none of which any assertion could see. Check: both instruments legible with value and unit, no label truncated in French, nothing painted over the screen bar at the longest throw, the bench clear of the side column, the notebook overlay covering the bench cleanly, and the apparatus genuinely **dark** before the first press.
  - [ ] **NFR1 re-profile (AC10's last bullet).** 10 minutes at 1280×720 on a representative low-end laptop, with drag, character staging, and propagation all active. `docs/validation/young-performance-template.md` is the gate's form and it says in as many words: *do not substitute an automated test or a rendered FPS estimate for this manual gate*. Fill a dated copy into `docs/validation/`.
  - [ ] **Decide the `canvas-transitions.spec.ts` worker budget**, with the measurement attached. The 2.9 review recorded it exceeding its 30 s budget at the default `--workers=9` (49/7 at `--workers=5`, 48/8 at 9) and deliberately did not raise the number, because that is a decision about the suite's budget rather than a review patch. It is listed against this story in `deferred-work.md`. This story adds a ≤3 s animation to that walk **twice**, so the question is now unavoidable: raise the timeout, cap the workers, or split the spec — and record which, and why, with the numbers.
  - [ ] Confirm by grep that no update loop registers for the light outside a run, that `destroy()` removes the keyboard and scene-`pointermove` listeners, and that nothing under `src/ui/` was touched.

## Dev Notes

### Scope boundary — read this first

**In scope:** the two instruments and their drag / step / keyboard input, the start-the-light control and the run animation, the unlit idle state, the in-scene wavelength chooser, the bench notebook with comparison and note, the `lab.*` copy rewrite in both locales, the new adapter methods, and the tests.

**Explicitly not in scope:**

- **Deleting, restyling, or extending any `src/ui/*` panel.** Story 2.12. The DOM apparatus and notebook panels keep working alongside the canvas until then; that is the transitional state, not a bug to fix here.
- **`DebriefScene`, `theory.supportRunSelected` / `theory.supportSourceSelected`, `peerReview.requested` / `revision.saved`** — Story 2.11 (assigned by the 2.8 review; see `deferred-work.md` §Assigned).
- **The sub-768px suppression decision.** Story 2.12 owns it and there are now four entries in `deferred-work.md` about the same unowned rule. **Preserve today's behaviour**: put the new instruments, the start control, the wavelength chooser and the notebook control through the existing `updatePhoneReadOnlyMode` gate so the bench is consistent with itself, and add nothing that re-decides the rule.
- **`scenarioScript.scenes[].cast?` and `apparatus.primaryControls[].affordance?`** — Story 3.4 owns both authoring fields (`sprint-change-proposal-2026-08-06.md` §4.1.9). Draw a knob unconditionally; do not add the descriptor, do not read one, and do not bump `CaseDefinition.version` for it.
- **Character staging at the bench.** Story 2.9's Dev Notes rule it out explicitly: `scenarioScript` authors beats only for `prediction`, `synthesis` and `review`, the laboratory's colleague *hint* is attributed text rather than a dialogue beat, and the bench is the one scene with a live animation loop and an NFR1 budget. Do not stage figures here.
- **Décor for the bench.** The 2.9 Completion Notes offer it (*"say the word and I will take the bench on as part of 2.10"*) — **not taken**. This story already spends the bench's entire remaining space on instruments, and `LaboratoryDecor` composes into a *band above cards*, which the laboratory does not have. Raise it as a separate change if the bench looks bare after the instruments land.
- **A new store field, a new action, or a new persisted value.** Every intent this story needs already exists in `AppAction.ts`. Focus, drag state, the note draft, and the run's in-flight state are all ephemeral and renderer-local, exactly as the dialogue reading position is.
- **Any change to `calculateYoungFringeSpacing`, `normalizeControlValue`, `significantMeasures.ts`, or any reducer.** The domain is correct and this story is a surface.
- **`src/main.ts`'s boot guard and its thirteen required DOM roots.** Tracked in `deferred-work.md` and owned by Story 2.12.

**One intent this story does not claim, and should not silently leave behind:** `apparatus.reset` (`src/ui/apparatus/ApparatusControls.ts`'s "Reset apparatus"). It is not in AC1–AC10, it is not required to complete a case, and it is therefore not an ADR-011 blocker — but Story 2.12 deletes its only dispatcher. Do not build it here; **do** raise it so 2.12 inherits a decision rather than a surprise (open question 6).

### Decisions taken for you (with the reasoning, so you do not relitigate them)

**D1 — Snap in the surface, using the domain's own tie rule.** ADR-012 says the drag value snaps *before* dispatch and that the normalization rule must stay invisible. Dispatching raw and letting `normalizeControlValue` snap would work — and would look wrong, because the snapped value returns through `render()` and the indicator jumps out from under the cursor. So the conversion is duplicated on purpose, and the duplication is made safe by a unit test asserting the two agree across the whole authored range rather than by a comment claiming they do.

**D2 — `experiment.run` is dispatched on press; the animation is the consequence, never the source.** The alternative — animate first, dispatch on completion — makes the record a function of the state three seconds *after* the player asked, opens a window in which a control change silently changes what gets recorded, and makes a refusal arrive after a spectacle that implied success. Dispatching first also means `render()`'s existing `latest.id !== this.lastRunId` hook is the ignition trigger, so the animation is driven by the recorded fact rather than racing it. The instruments lock for the run's duration, which closes the same window from the other side.

**D3 — The notebook is an overlay the player opens, not a permanent panel.** Measured, not preferred: after the tableau, the readout, and the side column, the bench has roughly 620×360 of usable surface (§The bench's space budget) and two instruments plus a start control plus a wavelength chooser consume it. A run list with two selections and a note field does not fit alongside them on a 1024×768 surface that does not scroll. `ReferenceBookPresenter` is the established shape for "a second surface in the same room, owned by the scene, suppressing what it covers" — follow it, including the suppression, which exists because a click meant for the overlay that fell through would move a slit.

**D4 — Keyboard focus is renderer-local and visible.** There is no DOM focus on a canvas and this story must not introduce one (§Engine forbids a semantic control mirroring a Phaser gesture). One `focusedControlId`, set by clicking or dragging an instrument, drawn as a visible ring. `EXPERIENCE.md` §Controls asks for "a visible focus treatment on the active in-scene control" in as many words, and AC3's "with the knob focused" is unsatisfiable without one.

**D5 — The comparison note is typed into an in-canvas field, and its one limitation is written down.** `comparison.noteSaved` takes free text, the reducer rejects a blank one, and the note is carried into the exported record and the print view — so it cannot become a choice from a list without a store and content change this story does not own. A DOM `<input>` over the canvas is the other option and it is the one §Engine forbids. So: a Phaser `Text` field fed by `scene.input.keyboard`, accepting `event.key.length === 1` plus `Backspace`, `Enter` (save) and `Escape` (cancel), with a drawn caret and a length bound.

  **The limitation, stated rather than discovered later:** a dead-key accent (typing `´` then `e` on a US-International layout) arrives as a `Dead` keydown followed by the base letter, so it inserts `e` rather than `é`. An AZERTY keyboard — the realistic French player's — has `é è à ç ù` as dedicated keys and is unaffected. Record this in Completion Notes and in the field's docstring; do not paper over it with a DOM element. If it turns out to matter, it is a follow-up with a named cost, not a silent gap.

**D6 — The start control is its own widget, not `AdvanceControl`.** They look similar and mean opposite things: one takes the player *out* of the phase, the other is the phase's whole activity. `AdvanceControl` carries a relabel lockout, a readiness fill tied to the significant-measure gate, and a contract that says its owner resolves a phase transition from the live phase. Reusing it would put "start the light" inside the widget that must never define a phase. Share the type sizes if you like; do not share the class.

**D7 — Keep the readout, retire the painted preview.** AC1 wants the value and unit legible beside the instrument, which the existing localized `lab.control.readout` already does. AC4 forbids "a screen pattern beyond a static unlit screen", and `renderApparatusGeometry`'s `previewSpacingPx` branch paints fringes for an unrecorded setup — that is a painted pattern with no run behind it, so it goes. Whether the *textual* preview line survives is a copy decision you take in Task 7 and record.

### Read before editing — current behaviour that must survive

| Path | What it does today | Your change boundary |
| --- | --- | --- |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts` (739 lines) | The whole bench. Owns the tableau (`createRichPattern`), the bottom-anchored `resultReadout` with its shrink loop (`fitResultReadout`), the two `+`/`−` control rows, the side column (`AdvanceControl` + measured floor-anchored hint), the reference shelf, `updatePhoneReadOnlyMode`, a `TransientMessageSlot`, the reduced-motion flag with its `change` listener, and `syncAnimationLoop` — which **registers an update loop from `create()`**. | Replace the step buttons with instruments; add the start control, the wavelength chooser and the notebook control; gate the animation loop on a run. **Do not** touch the side column, the hint's measured floor-anchored stacking, the reference shelf's `Zone.setSize(w, h, true)` hit-area rule, `fitResultReadout`'s bottom anchoring, or the `TransientMessageSlot` lifetime. This file is already 739 lines — extract the instruments and the notebook into their own modules rather than growing it. |
| `src/adapters/phaser/renderers/apparatusGeometry.ts` (154 lines) | Every laboratory coordinate a spec needs, with **no Phaser import**. `ADVANCE_CONTROL_Y = 360` carries the review's rationale for why it is not 130. `referenceShelfFloor` yields to the *measured* hint top. | Add the bench's placement here. **Do not** move a number out of it into the renderer, and do not add a Phaser import — the file's whole purpose is that Playwright can read it in Node. |
| `src/adapters/phaser/scenes/LaboratoryScene.ts` (81 lines) | Registers `shutdown` **before** anything it releases exists (deliberate: a throw would otherwise leak the subscription and the scroll listener). Owns `ReferenceBookPresenter` and passes `openReference`; suppresses apparatus input while the book is open; `registerCanvasBoundsRefresh`. | Add the notebook overlay on the same ownership shape, and suppress apparatus input while it is open. **Keep the `shutdown` registration first.** No scene→scene reach-in. |
| `src/core/store/AppState.ts` `reduceExperimentRun` (`:366-400`) | Refuses outside `experiment`; refuses an unauthored or locked wavelength; calls `calculateYoungFringeSpacing`; builds the `RunRecord` with `linkedEvidenceIds: state.inspectedSourceIds`; **calls `reduceRecordRun` itself**. | **Untouched.** Dispatch `experiment.run` only — never `run.record` alongside it. |
| `src/core/store/AppState.ts` `reduceWavelengthSet` (`:335-354`) | 550 always permitted and resets to `minimum` mode; an advanced choice needs `minimumRuns` fixed-550 runs first, else `advanced-wavelength-locked`; an unauthored value is `unavailable-wavelength`. | **Untouched.** Read the authored choices from the case; answer both refusals with the existing localized errors. |
| `src/core/store/AppState.ts` comparison reducers (`:402-441`) | `unknown-run-id`, `duplicate-comparison-run`, `too-many-comparison-runs`, `comparison-run-not-selected`, `comparison-pair-required`, `invalid-comparison-note`. A note replaces the existing note for the same pair. | **Untouched.** Check state before dispatching so the surface does not provoke a refusal the player did nothing to earn. |
| `src/domain/apparatus/ApparatusControl.ts` `normalizeControlValue` | Clamps then snaps at a decimal scale derived from `min`/`max`/`step`/value; exact halves snap **up**. | **Untouched.** Mirror its tie rule in `instrumentView.ts` and unit-test the agreement. |
| `src/adapters/phaser/PhaserStoreAdapter.ts` | `setControlValue`, `chooseProposal`, `submitConclusion`, `requestRivalLabRevision`, `inspectSource`, `advanceCase`. Timestamps are stamped **here**, never in a reducer. | Add `runExperiment`, `setWavelength`, `selectComparisonRun` / `unselectComparisonRun`, `saveComparisonNote`. Same docstring discipline: say what each is for and which refusal the caller must not provoke. |
| `src/adapters/phaser/renderers/transientMessage.ts` | Anchors a message to the `AppState` object it was set against; a successful dispatch mints a new frozen object, which is precisely "a real state change happened". | Use it for the start control's refusals. **Do not** hold a refusal in a bare field — that is the defect Story 2.7 fixed in both renderers at once. |
| `src/ui/apparatus/ApparatusControls.ts`, `src/ui/notebook/NotebookPanel.ts` | The retired DOM panels this story supersedes. `NotebookPanel` shows exactly which selector answers which notebook field. | **Read for the field list. Never import, extend, restyle, or delete.** Story 2.12 deletes them. |
| `tests/e2e/canvas-transitions.spec.ts` | Header table naming four gating intents with no canvas dispatcher; lines 117-120 and 131-135 reach into the DOM for the run and the notebook comparison. | Move `experiment.run` and the two `comparison.*` rows out of the table, replace both DOM reach-ins with canvas clicks, and correct the remaining two rows' owner to Story 2.11. |

### The bench's space budget — measure, do not guess

The canvas is a fixed **1024×768 `Scale.FIT`** surface that does not scroll. A surface that outgrows its band is a defect, not a responsive state. What is already spoken for:

| Region | Occupant | Bound |
| --- | --- | --- |
| y 28–90, x 40–940 | `lab.title` (24px) and `lab.guide` (15px), both wrapping | fixed |
| y 92–342, x 36–710 | the tableau: source (x 92), barrier (x 260), screen bar (`screenXForDistance`: **x 480 at 1 m, x 700 at 4 m**), screen label to y≈342 | **moves with the throw** |
| y 348–~400, x 40–660 | `visualGuidance` (13px, wrap 620) | grows with French |
| y 468–564, x 40–660 | `resultReadout`, bottom-anchored at `controlsTop − 14`, max height 96 | grows **upward** |
| x 680–984, y 360–floor | the side column: advance control (y 360–400), reference heading (y 428), shelf, and the hint growing up from the floor | fixed left edge |

So the bench gets roughly **x 40–660 by y 400–768** — about **620 × 368** — and the right-hand bound is hard: `SIDE_COLUMN_LEFT = 680` and the screen bar reaches **x 707** at the longest authored throw. `ADVANCE_CONTROL_Y = 360` is what it is for exactly that reason, and `ApparatusGeometry.test.ts` already pins the invariant for the side column. Add the bench to that test.

An indicative allocation, which you must then verify by screenshot and by the geometry test — not a specification:

- **Instruments**, y ≈ 408–548: two knobs of ≈96 px body plus travel arc, each with its readout and unit beside or beneath it. The readouts are authored control labels (`Écartement des fentes`, `Distance à l'écran`) and French runs 15–25% longer, so a readout is **measured**, never placed against a constant.
- **Wavelength chooser**, in the same row to the right, x ≈ 400–660: three small choices plus a locked-state line.
- **Result readout**, y ≈ 556–650, keeping its bottom anchoring.
- **Start the light** and **the notebook control**, y ≈ 660–744, both fixed-height and therefore both in the whole-string French sweep.

The rules that bind, independent of the numbers:

- **Measure, never assume.** The 1.11, 1.12, 2.5, 2.6, 2.7, 2.8 and 2.9 reviews each found the same defect: an object placed against a constant while the object above it grew with French copy.
- A **fixed-height control's label must fit on one line in French** at its authored size. The whole-string sweep is the arbiter; a per-token sweep provably cannot catch a wrap.
- 16 px is the body floor: at 1280×720 a 1024×768 `FIT` surface renders every design size at **93.75%**, so 16 lands at ≈15 CSS px.
- **Diegetic never means hidden** (`EXPERIENCE.md` §HUD): every instrument shows its current setting with its unit, in text, beside the object it belongs to.
- Do not paint anything over the screen bar at any authored distance, over the side column, or over the hint.

### Animation, reduced motion, and NFR1

`ApparatusRenderer` is the codebase's reference for reduced motion and this story changes what it gates on:

- Today: `syncAnimationLoop()` runs on `motionAllowed && inputEnabled`, registered from `create()`. **That is the thing ADR-012 removes** — §Engine's don't-miss table lists "register an animation loop for the experiment's light in `create()`" as a costly mistake in as many words, and the sprint change counts gating the light on a run as an NFR1 *reduction*.
- After: the loop registers when a run starts and unregisters when it resolves. Under `reduce`, no loop registers at all and `render()` paints the resolved frame.
- Keep the cached `motionAllowed` flag and the `change` subscription — toggling the OS setting at runtime must take effect mid-session.
- `destroy()` must kill `targets: this` tweens (`measurementBoost` is one), every object tween, the media listener, the keyboard listeners, and the scene-level `pointermove` listener. The `targets: this` case is called out in the renderer contract because this codebase has been bitten by it.
- Animate on **elapsed time**, never frame counters. No per-frame logging, JSON parsing, or allocation — `drawPropagation` already avoids allocating its slit array per frame; keep that discipline in anything you add.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011, ADR-012):** Phaser scenes own all interactive presentation; the only non-Phaser surface is the print/export view. **A feature is not done until the canvas can dispatch its intent** — this story closes four of them (`experiment.run`, `comparison.runSelected`, `comparison.runUnselected`, `comparison.noteSaved`) and moves `apparatus.controlSet` and `apparatus.wavelengthSet` onto real instruments. Never add semantic HTML to mirror a Phaser gesture. `src/ui/*` panels are retired and are **not** a working fallback. `src/game/scenes/*` are orphaned template leftovers. Scenes **mirror** the phase and never define, infer, or advance it. **No scene→scene reach-in.** Never author player-facing copy in `create()` — create empty, populate in `render(state)` through `createTranslator(locale)`. Renderer contract: `create()` / `render(state)` / `destroy()`, releasing every object, tween, timer and listener — **including tweens whose target is the renderer itself**. Honour `prefers-reduced-motion`: no update loop under `reduce`, static frame from `render()`. **The apparatus is unlit until the player starts it — no animation loop may register from `create()` for the experiment's light.** **Drag input snaps to the authored step before dispatch, in a Phaser-free module unit-tested at both range ends and across every step; every draggable instrument also keeps a discrete step affordance and keyboard stepping, and the two paths produce identical run records.** No Arcade or Matter physics — drag is an input mapping (ADR-004 stands). Sticky canvas bounds already handled by `registerCanvasBoundsRefresh`.
- **Guided adventure:** everything is authored — apparatus bounds, valid values, confounds, outcomes. The evaluator is the sole completion authority; never hard-code completion in a scene. Hints point at missing evidence and never supply the answer. No hard fail, score, timer, or speed reward. Authored copy must not name a scene, phase, or route (`encodesPath`) — **which is why three `lab.*` strings naming "the semantic controls" have to change**. A refused action always says why, in the active locale, and the message survives until a real state change replaces it.
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria** — the project's most-repeated defect. Interface strings go through `translate` / `createTranslator`; prose the player reads is `LocalizedText`. **Scientific run values are canonical across locales** — localize only for display, via `formatNumber` / `formatMeasurement` / `formatRecordedValue`. Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont.
- **Organization:** `src/domain/` pure (no Phaser, DOM, fetch, IndexedDB, browser APIs, or Zod); `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No `services/` / `managers/` / `helpers/`. Fallible operations return `Result<T, ResultError>`. Case definitions immutable under `public/cases/` — **and untouched by this story**. **Never recalculate a saved historical run against a newer experiment model.** Naming: `PascalCase` classes/files (`NotebookRenderer.ts`), `camelCase` modules (`instrumentView.ts`), `UPPER_SNAKE_CASE` constants.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop; **profile the Young lab before adding polish** — and this story owns the re-profile. Keep `update()` minimal. No logging, JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. **Prefer pre-rendered geometry over regenerating `Graphics` each frame.** Cap text resolution at `min(devicePixelRatio, 2)` (`textStyles.textResolution()` already does). Pool only after profiling proves allocation pressure.
- **Platform:** static web app; offline reload is a release gate; never expose a raw error to the player. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it. To test Phaser-adjacent logic, **inject the structural slice** (`SceneRouterTarget` is the reference). Assert public actions, selectors, and rendered text — never Phaser private fields or incidental pixels. **Never assert a magic number a test shares with source unless both read one exported constant.** Some e2e specs already fail on baseline — check before attributing a failure to your change. axe/manual a11y are no longer gates; keep the reduced-motion check and delete no existing a11y spec.

### Previous story intelligence (2.9's review, and the 2.8 / 2.7 / 2.6 findings)

- **2.9's review applied 25 patches, and the load-bearing one was invisible to a green suite.** Every staging test fabricated its band instead of calling the real geometry, so the conclusion board staged **zero** figures at every panel height while the tests asserted four. The lesson for this story: your geometry tests must drive the **real exported functions at the real canvas size**, the way the new `ColleagueGeometry.test.ts` does. A test that builds its own rectangle is testing arithmetic, not the bench.
- **Three defects in 2.9 were found only by screenshotting the running game**: figures behind opaque card backgrounds, the rival drawn at 24% of his placed size, and a `Graphics` joining the display list at `add.graphics()` rather than at fill time, putting the whole room on top of everything. **A `Graphics` created in `create()` paints under objects created later, and one created during a render paints over them.** Creation order is the only depth mechanism these renderers use. Screenshot before you claim AC1, AC4 or AC5.
- **Mutation-prove your guards.** 2.8 and 2.9 both had findings survive triage because the reviewer broke the source and the test still passed. Break the model-derivation sweep and the French whole-string check once each, confirm they fail, and record it.
- **A spec that restates a source constant stops covering it.** The book-control width triple and the `1024`/`768` restatements each took three reviews to close. `designSurface.ts`, `canvasHelpers.ts` and `apparatusGeometry.ts` exist for this.
- **Dead default parameters turn a wiring omission into a compile-time success.** `DialogueBox.render(…, accents = {})` and `isOverlayVisible = () => false` were both found this way. Default an *option* to today's value; never default a required wiring argument to a no-op.
- **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y = 130` was justified on grounds that were wrong in normal play; `MIN_COMPOSABLE_HEIGHT = 130` was one off the sum its own comment claimed. State why each number is what it is, with the measurement.
- **Do not import Phaser at module scope in anything a Vitest or Playwright spec imports.** This is why `advanceView.ts`, `apparatusGeometry.ts`, `libraryGeometry.ts`, `libraryDecorGeometry.ts` and `characterStageView.ts` exist. `instrumentView.ts` is the next one.
- **Hit areas do not resize themselves.** `Zone.setSize(width, height, true)` is the one Phaser API that resizes a hit area with the object; `Shape.setSize` throws on a shape built at another size, **and the throw lands inside the store's notify loop**, where an escaping error breaks `dispatch`'s `Result` contract and strands the router mid-transition. `ApparatusRenderer.renderReferenceShelf` was found exactly that way. `ProposalChoice.resizeHitArea` is the other pattern.
- **A renderer's `create()` runs synchronously inside `dispatch() → notify()`.** A throw there advances the phase, skips later subscribers, and breaks the `Result` contract (1.10 review). Construction stays cheap and defensive.
- **Localize as you build, not after.**

### Git intelligence

`0db285a Review 2.9`, `6c5951a Dev 2.9`, `10a90af Story 2.9`, `52d6412 Review 2.8`, `517b8d4 Dev 2.8` establish the rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned items pushed to `deferred-work.md`.

Two diffs are worth reading before you start:

- **`6c5951a` / `0db285a` (Story 2.9)** — 4,487 insertions across 28 files, and the closest existing example of "draw a physical thing out of `Graphics` with a Phaser-free geometry module, a structural-slice renderer test, and a source-level reachability sweep". `CharacterStage.ts` + `characterStageView.ts` + `CharacterStage.test.ts` + `CharacterStageView.test.ts` is the four-file shape this story's instrument work should take.
- **`517b8d4` (Story 2.8)** — created `LibraryRenderer`, `ReadingRoomDecor`, `libraryGeometry`, `libraryDecorGeometry`, `canvasBounds`, `designSurface` and `canvasHelpers`, and is where `ReferenceBookPresenter`'s scene-owned-overlay pattern was established. The notebook overlay follows it.

### Stack, and the one API this codebase has never used

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`). `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the lockfile is committed.

Almost every API here is already in use in the files listed above: `Graphics` fill/stroke commands drawn once (`ReadingRoomDecor.ts`, `LaboratoryDecor.ts`), `scene.tweens.add` / `killTweensOf` including a `targets: this` case (`ApparatusRenderer.ts:346-366, :273-296`), `Zone.setSize(w, h, true)` for a resizing hit area (`ApparatusRenderer.ts:688`), `window.matchMedia('(prefers-reduced-motion: reduce)')` plus its `change` event (`:168-192`), `scene.events.on('update')` (`:195-204`), and `scene.scale.{width,height}`.

**Two are new to this codebase**, so verify them against Phaser 4.2.1 rather than a Phaser 3 example — the tween and input APIs differ and Phaser 3 examples dominate search results. `Context7` is configured for exactly this (`game-architecture.md` §Development Documentation Tooling); the local type definitions in `node_modules/phaser/types/phaser.d.ts` are the other authority and they are the one that cannot be out of date:

- **Pointer drag.** `Phaser.Input.InputPlugin.setDraggable(gameObject)` plus `gameObject.on('drag', …)` exists (`phaser.d.ts:83843`, `:81841`), but its `dragX`/`dragY` are a *translation*, which is the wrong model for a rotary control. Prefer `pointerdown` on the knob to arm, `scene.input.on('pointermove')` to track, and `pointerup` / `pointerupoutside` to disarm — a pointer that leaves the body mid-turn must keep turning the knob. **`pointer.x` / `pointer.y` are already in design space**: the `Scale.FIT` manager transforms them, so no manual bounding-box mapping is needed inside the game (only Playwright needs that, and `clickDesign` already does it).
- **Keyboard.** `scene.input.keyboard?.on('keydown-LEFT', …)` and friends; `addKeys` / `createCursorKeys` are at `phaser.d.ts:84859-84886`. `input.keyboard` is optional in the types — handle `undefined` rather than asserting. Be deliberate about capture: capturing the arrow keys stops the page scrolling, which is correct while an instrument is focused and wrong otherwise.

### Project Structure Notes

- **New:** `src/adapters/phaser/renderers/instrumentView.ts`, `src/adapters/phaser/renderers/NotebookRenderer.ts`, `tests/unit/InstrumentView.test.ts`, `tests/integration/YoungExperimentBench.test.ts`, `tests/e2e/young-canvas-experiment.spec.ts`, a dated `docs/validation/young-performance-*.md`. An `InstrumentRenderer.ts` (or a `ui/` widget) if the instruments do not sit comfortably inside `ApparatusRenderer` — at 739 lines it should not grow.
- **Revised:** `src/adapters/phaser/renderers/ApparatusRenderer.ts`, `src/adapters/phaser/renderers/apparatusGeometry.ts`, `src/adapters/phaser/scenes/LaboratoryScene.ts`, `src/adapters/phaser/PhaserStoreAdapter.ts`, `src/core/i18n/locales/{en,fr}.ts`, `tests/unit/{ApparatusGeometry,I18n,PhaserStoreAdapter}.test.ts`, `tests/e2e/{canvas-transitions,french-typography}.spec.ts`, `_bmad-output/implementation-artifacts/deferred-work.md` (the `canvas-transitions` budget item, and the four intents this story closes).
- **Check, likely untouched:** `src/adapters/phaser/renderers/{ReferenceBookPresenter,LectureBookRenderer,transientMessage,advanceView}.ts`, `src/adapters/phaser/ui/AdvanceControl.ts`.
- **Do not touch:** `public/cases/**`, `src/schemas/**`, `src/domain/**`, any `src/ui/*` file, `src/game/scenes/*`, `src/core/store/AppState.ts`, `dist/`, `.claude/worktrees/**`.

### Baseline

At `0db285a` the 2.9 review measured, after its 25 patches: `typecheck` clean, `npm test` **911 passing across 55 files**, `npm run test:e2e` **49 passed / 7 failed at `--workers=5`** on chromium. The seven failures are the same seven names carried since before 2.8 — `accessibility`, `curated-record`, `inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment` — all on retired-DOM controls that Story 2.12 owns.

**At the default `--workers=9` it is 48 / 8, the extra failure being `canvas-transitions` exceeding its 30 s budget.** That is this story's to decide (Task 9), not to inherit silently.

**Measure your own baseline before the first edit, at a stated worker count, and compare failure names rather than counts.** Six known firefox/webkit baseline failures are Story 2.12's to fix or re-record.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.10` — the ten ACs verbatim; §Story 2.9 and §Story 2.11/2.12 for what this story must not build; §Epic 2 reopening note]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §1 item 4 and §2 row 4a (the non-physical-controls finding, `ApparatusRenderer.ts:504-525`), §3 D2 (drag **plus** discrete steps), §3 effort table (2.10 = Large / Medium, depends on 2.7), §4.1.2 (new FR30), §4.1.9 (the `affordance?` descriptor belongs to Story 3.4), §4.2.1 (the GDD's controls amendment), §4.3 (ADR-012), risk table row on NFR1]
- [Source: `_bmad-output/project-context.md` revision 2.1 — §Engine (ADR-011, ADR-012, the unlit-apparatus and drag-snapping rules), §Guided-Adventure, §i18n, §Performance, §Organization, §Testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — ADR-004 (deterministic model, no physics), ADR-011, ADR-012; §User Interface and Rendering Boundary "Interaction fidelity (v1.2)"; §Deterministic Experiment Record ("never recalculate a historical run using an unrecorded newer model"); §Phaser Object Patterns; §Consistency Rules]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` revision 2.0 — the **Apparatus instrument**, **Experiment run** and **Notebook observation** component rows; §Emotional states "Apparatus idle" ("the source is dark… an in-scene line invites the player to start the light"); §Controls ("a visible focus treatment on the active in-scene control", "no essential interaction relies on drag **alone**"); §Feedback ("starting the light is the scene's one moment of real spectacle"); §Key Flows steps 4–5; §Layout contract]
- [Source: `_bmad-output/implementation-artifacts/2-9-colleague-and-rival-lab-characters.md` §Review Findings (25 patches; the fabricated-band finding and the three screenshot-only defects), §Completion Notes (the offer of bench décor, declined here), §Change Log 1.4]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — the `canvas-transitions` worker-budget item assigned to this story with its measurement; the four `updatePhoneReadOnlyMode` sub-768px entries this story must not re-decide; the `review → debrief` intents assigned to Story 2.11]
- [Source: `src/adapters/phaser/renderers/ApparatusRenderer.ts:106-231` (fields, `syncAnimationLoop`, `create`); `:233-296` (`render`, `destroy`); `:306-327` (`createRichPattern` and its layer order); `:329-343` (`fitResultReadout`); `:345-366` (`animateRecordedRun`, the `targets: this` tween); `:368-418` (`renderApparatusGeometry`, `previewSpacingPx`, `paintFringes`); `:420-466` (`onUpdate`, `drawPropagation`); `:474-595` (the side column and the measured hint); `:597-700` (the reference shelf and the `Zone.setSize` rule); `:702-738` (`createControl`, `createButton`, `updatePhoneReadOnlyMode`)]
- [Source: `src/adapters/phaser/renderers/apparatusGeometry.ts` — the whole file: why it has no Phaser import, `screenXForDistance`, `SIDE_COLUMN_LEFT`, the `ADVANCE_CONTROL_Y = 360` rationale, and `referenceShelfFloor`'s measured ceiling]
- [Source: `src/adapters/phaser/scenes/LaboratoryScene.ts` — the `shutdown`-first registration, `ReferenceBookPresenter` ownership, and the input suppression the notebook overlay copies]
- [Source: `src/adapters/phaser/renderers/ReferenceBookPresenter.ts` — the scene-owned overlay pattern]
- [Source: `src/core/store/AppState.ts:275-296` (`reduceControlSet`); `:298-329` (`reduceRecordRun` and every check it makes); `:331-354` (`minimumPathRunCount`, `reduceWavelengthSet`); `:356-364` (`reduceApparatusReset`); `:366-400` (`reduceExperimentRun` — it calls `reduceRecordRun` itself); `:402-441` (the three comparison reducers and their refusal codes)]
- [Source: `src/domain/apparatus/ApparatusControl.ts` — `normalizeControlValue`, the decimal scale, and the documented halfway-snaps-up tie rule the surface must mirror]
- [Source: `src/domain/apparatus/calculateYoungFringeSpacing.ts` — Δy = λL/d, rounded to four places; the only source of a recorded value]
- [Source: `src/domain/apparatus/opticalVisualModel.ts` — `wavelengthToRgb`, `rgbToInt`, `interferenceIntensity`: visual only, and its header states it never alters a recorded result]
- [Source: `src/domain/evidence/RunRecord.ts:102-122` — `validateModelInputs`, and why a `minimum` mode must carry 550 nm]
- [Source: `src/domain/evidence/significantMeasures.ts` — `configurationKey` / `countSignificantMeasures`: two runs at the same setting are a replication, not two significant measures, which is why the e2e walk must **change the throw** between its two runs]
- [Source: `src/adapters/phaser/PhaserStoreAdapter.ts` — the adapter contract, the "timestamps are stamped here, never in a reducer" rule, and `inspectSource`'s "do not provoke a refusal the player did nothing to earn" docstring]
- [Source: `src/adapters/phaser/renderers/transientMessage.ts` and `advanceView.ts` — the message-lifetime helper and the Phaser-free view-resolution pattern]
- [Source: `src/adapters/phaser/renderers/characterStageView.ts` + `CharacterStage.ts` — the four-file shape (pure resolver, renderer, both tested) this story's instruments follow]
- [Source: `src/adapters/phaser/scenes/libraryGeometry.ts` — exported geometry constants, `(canvasWidth, canvasHeight) => Rect` helpers, and the "bands that can grow are anchored to the floor" argument]
- [Source: `src/adapters/phaser/designSurface.ts` and `src/adapters/phaser/textStyles.ts` — the 1024×768 statement of record, and `uiTextStyle` / `textResolution()` / the no-webfont argument]
- [Source: `src/core/i18n/locales/en.ts:31-48` and `fr.ts:27-42` — the `lab.*` family, including the three strings naming the retired semantic controls; `en.ts:273-297` for the apparatus, wavelength and comparison error codes that already exist in both bundles]
- [Source: `src/ui/apparatus/ApparatusControls.ts` and `src/ui/notebook/NotebookPanel.ts` — the field lists and selector mappings the canvas surfaces must match. Read only.]
- [Source: `tests/e2e/canvas-transitions.spec.ts:26-66` — the header table naming this story's four intents, and `:114-135` the two DOM reach-ins it replaces]
- [Source: `tests/e2e/canvasHelpers.ts` — `clickDesign` / `expectActiveScene` / `clickUntilScene`, `waitForInputToSettle`, and the "import every animation duration from the renderer that runs it" rule the run animation inherits]
- [Source: `tests/unit/ApparatusGeometry.test.ts` — the existing non-overlap invariant, and its habit of reading the authored range out of `case.json` rather than restating it]
- [Source: `tests/unit/CharacterStage.test.ts` and `tests/unit/SceneRouter.test.ts` — structural-slice injection for testing Phaser-adjacent logic without a real `Phaser.Game`]
- [Source: `tests/e2e/french-typography.spec.ts:97-140` — `FIXED_HEIGHT_CONTROLS`, `WRAPPED_SURFACES`, `longestFrench`, and the import discipline for reading bounds from source]
- [Source: `docs/validation/young-performance-template.md` — the NFR1 gate's form, and its instruction not to substitute an automated FPS estimate for the manual check]
- [Source: `docs/i18n-authoring.md` — the canonical-value traps and the `LocalizedText` vs `translate` split]
- [Source: `public/cases/young-interference/case.json` — `version 1.14.0`; `apparatus.primaryControls` (slit spacing 0.1–0.5 mm step 0.05 default 0.25; screen distance 1–4 m step 0.25 default 2); `experiment.wavelengthComparison` (fixed 550, advanced 450/650); `requirements` (2 runs, 2 sources, 2 significant runs); `significanceRule`. **Untouched by this story.**]

### Open questions for the reviewer (do not block implementation)

1. **Is the typed in-canvas comparison note the right call (D5)?** It keeps the surface rule intact and covers an AZERTY player, but a dead-key accent on a US-International layout inserts the unaccented letter. The alternatives are a hidden DOM input (breaks §Engine) or authored note choices (a store and content change this story does not own). Confirm, or name the follow-up.
2. **Should the textual preview line survive (D7)?** The painted fringe preview must go — AC4 forbids a screen pattern before a run. Whether `lab.preview`'s *sentence* still earns its place once the bench shows both settings beside their instruments is a copy call.
3. **Does the notebook belong behind a control (D3), or should the bench trade something else away for a permanent ledger?** The measurement says there is no room; the cost is one more click between a run and its record.
4. **The `canvas-transitions` budget (Task 9):** raise the timeout, cap the workers in `playwright.config.ts`, or split the spec? This story makes the walk longer by two run animations, so it is the last moment the question is cheap.
5. **Bench décor.** Story 2.9 offered to paint the laboratory and this story declines it on scope grounds. If the bench reads bare beside the reading room and the boards, say so and it becomes its own change.
6. **`apparatus.reset` has no canvas dispatcher and no owner.** Not an AC here and not required to complete a case, so not built — but Story 2.12 deletes the DOM button that is its only dispatcher. Assign it to 2.12, to a bench control in a follow-up, or declare it retired.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Change | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 1.0 | Story created from `epics.md` §Story 2.10, the 2026-08-06 sprint change proposal (FR30, ADR-012), and the 2.7/2.8/2.9 review findings. | Alexis (via `gds-create-story`) |

---
baseline_commit: bfdf24635e7d9263104680110a4b12a8d1357973
---

# Story 2.7: In-scene phase transitions and the adventure's forward path

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to move to the next step of the investigation from the scene I am standing in,
So that the adventure flows without me leaving the Phaser view.

_Build this first in the 2.7–2.12 sequence: it delivers the reusable advance affordance that Stories 2.8, 2.10, and 2.11 all consume, and it consolidates Story 2.6's ad-hoc control into it._

## Acceptance Criteria

**AC1 — the affordance exists in every scene with a forward transition**

**Given** the case is at any phase with a forward transition,
**When** the scene mirroring that phase renders,
**Then** a reusable Phaser advance affordance is present in-scene, labelled in the active locale with what the player is moving *toward* in fiction (never a scene, phase, or route name — the `encodesPath` rule),
**And** it dispatches only the typed action for that transition and never infers or advances the phase itself.

**AC2 — every forward transition is dispatchable from the canvas**

**Given** the full Young flow,
**When** the player walks it from a cold boot using the canvas alone,
**Then** `context → prediction`, `prediction → experiment`, `experiment → synthesis`, `synthesis → review`, `review → debrief`, and a post-debrief replay are each reachable,
**And** no DOM panel is touched at any point.

> **Read §Scope boundary before implementing AC2.** Five *non-transition* intents that gate these transitions still have no canvas dispatcher and are owned by Stories 2.8 / 2.10 / (two are unowned). AC2 is delivered here as **"each transition is dispatchable from the canvas"** — the affordance is mounted in every phase's scene and dispatches the correct typed action. The end-to-end *walk* becomes completable when 2.8 and 2.10 land, and is verified in full by 2.12. Do not build a library room, an apparatus instrument, a notebook, or a debrief surface here to make the walk finish.

**AC3 — Story 2.6's ad-hoc control is consolidated, losing nothing**

**Given** Story 2.6's `advanceToSynthesis` control in `ApparatusRenderer`,
**When** this story lands,
**Then** it is replaced by the reusable affordance with no loss of the significant-measure gate behavior or the colleague hint that answers a refusal,
**And** the hint and the transient error keep the *measured*, floor-anchored layout they have now.

**AC4 — a refusal always says why, in the right register**

**Given** a transition the store refuses,
**When** the refusal is a gate the player can act on (missing sources, missing significant measures),
**Then** the answer is the authored in-fiction colleague line for that gate, in the active locale,
**And** when it is anything else (for example the store short-circuiting during a progress export), the answer is the localized error — never a raw error string, and never silence.

**AC5 — a transient message has an explicit lifetime**

**Given** a transient refusal message,
**When** any later render occurs,
**Then** the message survives until a real state change replaces it,
**And** the same explicit lifetime applies in `ColleagueRenderer` and `ApparatusRenderer`, so the two renderers do not disagree.

**AC6 — tests**

**Given** the advance affordance,
**When** tests run,
**Then** unit tests cover the affordance's enabled/refused view resolution as a Phaser-free module in the `sideColumnView` pattern,
**And** an integration test drives every transition through public store actions,
**And** an E2E test completes the Young case using canvas clicks only,
**And** `french-typography.spec.ts` asserts the whole French label fits the control at its authored width — as a whole string, not token-by-token.

> **AC6's E2E clause is bounded by §Scope boundary.** The canvas cannot yet dispatch `source.inspected`, `experiment.run`, or `run.record`, so a *pure* canvas walk cannot complete Young in this story. Deliver the canvas-transition E2E described in Task 9 and record the bound honestly in the Completion Notes; do not weaken the claim into "passes" and do not simulate the missing intents from the spec.

## Tasks / Subtasks

- [x] **Task 1 — Widen `PhaserStoreAdapter` with one dispatcher per forward transition** (AC1, AC2)
  - [x] Add dispatchers for all six transitions. Use the **exact** actions in §The six transitions — three of them are *not* `case.phaseAdvance`, and getting this wrong is either a permanent refusal or a bypassed evidence check.
  - [x] Rename/replace `advanceToSynthesis` with the generalized surface. Keep the adapter the only place a timestamp is stamped (`case.debriefCompleted` follows `submitConclusion`'s precedent: `new Date().toISOString()` in the adapter, never in a reducer).
  - [x] Do **not** add store fields, actions, reducers, or phases. Every action this story needs already exists in `AppAction.ts`.

- [x] **Task 2 — Phaser-free transition resolution module** (AC1, AC2, AC4, AC6)
  - [x] New module beside `sideColumnView.ts` (suggested `src/adapters/phaser/renderers/advanceView.ts`) that maps the live `CasePhase` to `{ labelKey, dispatch }` and resolves the affordance's view: enabled/ready state, the answer text for a refusal, and the speaker attribution slot.
  - [x] Reuse and generalize `resolveSideColumnView`'s three-part rule (hint only after an actual refusal; the hint withdraws itself; a non-gate error outranks and takes the whole slot with no speaker attribution). Fold `sideColumnView.ts` into the generalized module or keep it as the laboratory's specialization — either is fine, but there must be **one** rule, not two.
  - [x] No Phaser import, not even as a type value. Vitest runs in Node and Phaser touches `window` at import time.

- [x] **Task 3 — Explicit transient-message lifetime, shared by both renderers** (AC5)
  - [x] Implement the state-identity anchor described in §The transient lifetime fix, as a small Phaser-free helper both renderers use.
  - [x] Apply it in `ApparatusRenderer` (replacing the clear-inside-render at the top of `renderSideColumn`) **and** in `ColleagueRenderer` (replacing the `this.transientError = undefined; this.transientNotice = undefined;` pair in `render`).
  - [x] `transientNotice` (`theoryBoard.submitAcknowledged`) gets the same lifetime — it is the same slot and the same defect.
  - [x] Closes the `deferred-work.md` item "`transientError` is cleared inside the render that draws it". Say so in the Completion Notes.

- [x] **Task 4 — The reusable Phaser widget** (AC1, AC3)
  - [x] New widget in `src/adapters/phaser/ui/` (suggested `AdvanceControl.ts`), following `DialogueBox` / `ProposalChoice`: **store-agnostic** — it takes resolved strings, geometry, and an `onAdvance` callback, never a `PhaserStoreAdapter`, a selector, or a locale.
  - [x] `create()` / `render(...)` / `destroy()`; text created empty in `create()` and written in `render`; `setInputEnabled(enabled)`; `destroy()` releases every object, tween, timer, and listener it made.
  - [x] Export the geometry constants and a `…ControlCentre()` helper so browser specs derive the click target instead of restating it (the rule `apparatusGeometry.ts` exists to satisfy). Export the label wrap bound for `french-typography.spec.ts`.
  - [x] If the control is ever repositioned or resized, write `input.hitArea.width/height` directly — `setInteractive` a second time only re-enables (see `ProposalChoice.resizeHitArea`).

- [x] **Task 5 — Wire the affordance into every phase's scene** (AC1, AC2, AC3)
  - [x] `LaboratoryScene` / `ApparatusRenderer`: replace the 2.6 control in place. Keep `advanceToSynthesisControlCentre()` working (or re-export an equivalent) — `rival-lab.spec.ts` and `ApparatusGeometry.test.ts` both read it.
  - [x] `ColleaguesScene` / `ColleagueRenderer`: `prediction → experiment`.
  - [x] `TheoryBoardScene` / `ColleagueRenderer`: **phase-aware** — this one scene hosts `synthesis` *and* `review`, and the two dispatch different actions. Read `selectCasePhase(state)`, never a captured value.
  - [x] `LibraryScene` and `DebriefScene`: they are still `PhasePlaceholderScene` subclasses (2.8 and 2.11 replace them). Host the affordance so `context → prediction` and the post-debrief replay are dispatchable now — see §Where the affordance lives for the two acceptable placements. Do not build room or debrief content.
  - [x] `RivalLabScene` gets **no** advance affordance: the rival lab is not a phase and its only exit is the existing revise control.
  - [x] Never place the affordance over the painted apparatus — `ADVANCE_CONTROL_Y = 360` exists because it was at 130 and painted across the interference screen at long throws.

- [x] **Task 6 — Reference-book input suppression for every new host** (AC1)
  - [x] Extend `src/game/main.ts`'s `onOverlayVisibilityChange` callback to `LibraryScene` and `DebriefScene`, and give each a `setInputEnabled` pass-through, exactly as `LaboratoryScene` / `ColleaguesScene` / `TheoryBoardScene` / `RivalLabScene` already have.
  - [x] Each scene must also apply suppression **at creation** from `isOverlayVisible()`, not only from the edge-triggered callback: the router rebuilds the scene while the book may already be open.
  - [x] Without this, a page-turn click falls through the book and advances the phase — the exact defect 1.12, 2.5, and 2.6 each had to fix. The book is reachable in **every** phase, including `context`.

- [x] **Task 7 — Interface copy, both locales** (AC1, AC6)
  - [x] Add one `advance.*` key per transition to `src/core/i18n/locales/en.ts` **and** `fr.ts`. Retire `lab.advance` into the family (it has exactly two consumers: `ApparatusRenderer` and `french-typography.spec.ts`).
  - [x] Each label names the destination **in the fiction** — a place, a person, or an act — never a scene key, a phase name, a route, or an arrow. `Colleagues`, `Laboratory`, `TheoryBoard`, `Debrief`, `Library` are scene keys; "the theory board", "the bench", "your colleagues" are fiction. `lab.advance` = `'To the theory board'` is the calibration point.
  - [x] Keep every label short enough to fit its fixed-height control **as a whole string in French**, at its authored font size. French runs 15–25% longer.
  - [x] No case content, no `case.json` edit, no `CaseDefinition.version` bump: these are interface strings, not authored case prose.

- [x] **Task 8 — Unit tests** (AC6)
  - [x] Phase→action/label resolution: all six transitions, plus a phase with no forward transition if the mapping admits one.
  - [x] View resolution, extending `tests/unit/SideColumnView.test.ts`'s coverage to the generalized module: ready vs not-ready; hint drawn only after an actual refusal; hint (and the refusal with it) withdrawing when it stops applying; a non-gate error outranking the hint and carrying no speaker attribution; a frozen return value.
  - [x] Transient lifetime: a message survives an unrelated repaint with the same state object and is cleared by a new one. Assert on the helper, not on a renderer.
  - [x] No vacuous tests. Do not compute an expectation with the implementation's own predicate, and do not write a determinism test over a frozen fixture that cannot fail (both named by the 2.5 review).

- [x] **Task 9 — Integration and E2E** (AC2, AC6)
  - [x] **Integration** (`tests/integration/`): drive all six transitions through **public store actions and selectors only**. This *can* be complete today — the store has every action; only the canvas is missing dispatchers. Walk `context → prediction → experiment → synthesis → review → debrief → replay`, asserting the phase after each, and assert the two refusal registers (gate code vs. `progress-operation-active` via `acquireExclusiveOperation`). Reuse `tests/integration/SignificantMeasureGate.test.ts`'s authored-case-parsing setup and `tests/integration/ReviewFlow.test.ts` for the support/peer-review/revision chain.
  - [x] **E2E** (`tests/e2e/`): a canvas-transition spec on `rival-lab.spec.ts`'s pattern — derive every click target from exported geometry, assert `data-active-scene` after each transition, scroll before clicking (sticky canvas). Every *transition* click is a canvas click; the intents the canvas cannot yet dispatch stay on their current DOM path and are annotated with the story that closes each.
  - [x] Establish the e2e baseline **before** attributing any failure: seven chromium specs and six firefox/webkit specs already fail (`deferred-work.md`, `docs/validation/young-technical-evidence.md`).
  - [x] `french-typography.spec.ts`: add every new `advance.*` key to the `FIXED_HEIGHT_CONTROLS` **whole-string** test (not only to the per-token `WRAPPED_SURFACES` sweep — the per-token sweep provably cannot catch a two-line wrap inside a fixed-height rectangle), reading each bound from the widget's exported constant.

- [x] **Task 10 — Repair, don't weaken** (AC3, AC6)
  - [x] Anything asserting against `lab.advance` or `advanceToSynthesisControlCentre` must keep meaning what it meant: `tests/e2e/rival-lab.spec.ts`, `tests/e2e/french-typography.spec.ts`, `tests/unit/ApparatusGeometry.test.ts`, `tests/unit/SideColumnView.test.ts`.
  - [x] Never assert a magic number a test shares with source unless both read one exported constant.
  - [x] If a test's meaning genuinely changes, change the test and say so in the Completion Notes. Do not delete an assertion to make a suite pass.

- [x] **Task 11 — Verify** (all ACs)
  - [x] `npm run typecheck`, `npm test`, `npm run test:e2e`; record the baseline comparison in the Dev Agent Record.
  - [x] Manual at 1280×720, EN and FR: in each phase, confirm the affordance is present, legible, un-truncated, does not paint over the apparatus at `screenDistanceM = 4.0`, and that a refusal is answered rather than silent.
  - [x] Confirm `prefers-reduced-motion: reduce` is unaffected — this story adds no animation. If you add one, it inherits the whole media-query/static-frame contract.

## Dev Notes

### Scope boundary — read this before AC2

**In scope:** one reusable in-scene advance affordance, its Phaser-free view/mapping module, adapter dispatchers for all six forward transitions, wiring into all five phase scenes, the shared transient-message lifetime, both locales, and the tests.

**Explicitly not in scope, and must not be built here:**

- The library reading room, the reference-book pickup, or a canvas dispatcher for `source.inspected` — **Story 2.8**.
- Colleague/rival-lab character staging — **Story 2.9**.
- The physical knob, the player-started light, `experiment.run`, `run.record`, `apparatus.wavelengthSet`, or the in-scene notebook/comparison — **Story 2.10**.
- Debrief content, `case.debriefCompleted`'s *surface*, recognition display, or `critiqueHistory` display — **Story 2.11**. (This story adds the *dispatcher* for `case.debriefCompleted`; 2.11 builds the scene it belongs to.)
- Deleting, editing, or restyling any `src/ui/*` panel — **Story 2.12**. Until then they stay mounted and keep working. Do not treat one as a fallback and do not extend one.
- Re-deciding the sub-768px suppression — **Story 2.12** owns it explicitly. Preserve today's behaviour.
- Any new store field, action, phase, scene key, dependency, or `case.json` change.

**Why the full canvas-only walk cannot finish in this story.** Six transitions are being delivered; five *other* intents gate them and are still DOM-only:

| Gating intent | Only dispatcher today | Which transition it unblocks | Owner |
| --- | --- | --- | --- |
| `source.inspected` | `src/ui/sources/CuratedRecord.ts` | `context → prediction` | Story 2.8 |
| `experiment.run` | `src/ui/apparatus/ApparatusControls.ts` | `experiment → synthesis` | Story 2.10 |
| `run.record` | `src/ui/notebook/NotebookPanel.ts` | `experiment → synthesis` | Story 2.10 |
| `comparison.runSelected` / `comparison.noteSaved` | `src/ui/notebook/NotebookPanel.ts` | `synthesis → review` | Story 2.10 |
| `theory.supportRunSelected` / `theory.supportSourceSelected` | `src/ui/theory/TheoryBoard.ts` | `synthesis → review` | **unowned** |
| `peerReview.requested` / `revision.saved` | `src/ui/review/ConclusionReviewPanel.ts` | `review → debrief` | **unowned** |

The last two rows are a coverage gap in the 2.7–2.12 plan, not something to close here. Note it in the Completion Notes so it reaches the 2.12 readiness check; do not build surfaces for them.

### The six transitions — exact actions, gates, and traps

`CASE_PHASES = ['context','prediction','experiment','synthesis','review','debrief']`; `NEXT_CASE_PHASE` is **one-way** and nothing maps backwards.

| From → to | Dispatch **exactly** this | Store gate on refusal | Answer register (AC4) |
| --- | --- | --- | --- |
| `context → prediction` | `case.phaseAdvance { nextPhase: 'prediction' }` | `missing-contextual-sources` (≥2 inspected artifacts) | localized error today; Story 2.8 authors the colleague line |
| `prediction → experiment` | `case.phaseAdvance { nextPhase: 'experiment' }` | `missing-prediction` — already satisfied by the canvas `prediction.proposalChosen` | localized error |
| `experiment → synthesis` | `case.phaseAdvance { nextPhase: 'synthesis' }` | `significant-measures-required` | **authored colleague hint** (`selectLocalizedColleagueHint`) |
| `synthesis → review` | **`theory.reviewRequested`** | `conclusion-not-ready` | localized error |
| `review → debrief` | **`case.debriefCompleted { timestamp }`** | `debrief-review-required`, `reviewed-revision-required`, `conclusion-not-ready`, `invalid-completion-timestamp` | localized error |
| post-debrief replay | **`case.replayStarted`** | `replay-unavailable` | localized error |

**Three traps, each of which produces a plausible-looking but wrong implementation:**

1. **`case.phaseAdvance { nextPhase: 'debrief' }` is explicitly refused** (`AppState.ts:602`, code `debrief-completion-required`) — it is the first check in `reduceCasePhaseAdvance`, before `advanceCasePhase`. A uniform "always dispatch `case.phaseAdvance`" mapping makes the last transition permanently unreachable.
2. **`case.phaseAdvance { nextPhase: 'review' }` would *succeed* and be wrong.** `advanceCasePhase` permits `synthesis → review`, and `reduceCasePhaseAdvance` has no gate for it — so it silently **bypasses `evaluateConclusionReadiness`**, which `theory.reviewRequested` exists to enforce. This is the most dangerous of the three: it looks like it works.
3. **`case.debriefCompleted` needs a timestamp.** Stamp it in the adapter, never in a reducer — a reducer that reads the clock is not a pure function of its arguments, and `submitConclusion` already sets the precedent. The reducer also refuses a timestamp earlier than the saved reviewed revision.

### Read before editing — current behaviour that must survive

| Path | What it does today | This story's change boundary |
| --- | --- | --- |
| `src/core/store/AppState.ts` `reduceCasePhaseAdvance` (`:601`) | Refuses `review → debrief`; delegates to `advanceCasePhase`; applies the source gate, the prediction gate, and the significant-measure gate; clears `rivalLabCritique` on success. | **Untouched.** The gates are correct and correctly placed. This story only reaches them from the canvas. |
| `src/core/store/AppState.ts` `reduceTheoryReviewRequest` (`:648`) / `reduceDebriefComplete` (`:780`) / `reduceReplayStart` (`:812`) | The real `synthesis → review`, `review → debrief`, and replay transitions, each with its own preconditions. | **Untouched.** Read them so the affordance's refusal handling covers every code they emit. |
| `src/adapters/phaser/PhaserStoreAdapter.ts` | Six dispatchers, `advanceToSynthesis` among them. | Widen. Keep every existing member's behaviour; keep the timestamp discipline. |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts` `:407-502` | `createSideColumn` / `advanceToSynthesis` / `renderSideColumn`: the 2.6 control, the measured floor-anchored hint panel, the ready/not-ready fill, the `advanceRefused` flag. | Replace the control with the widget. **Preserve** the measured floor-anchored hint layout verbatim (AC3), the reduced-motion subscription, and the whole `destroy()` release list. |
| `src/adapters/phaser/renderers/apparatusGeometry.ts` | `ADVANCE_CONTROL_Y = 360` and the hint geometry, Phaser-free so specs can import it. Its docstring records why 130 was wrong. | Generalize or keep. Do not raise `ADVANCE_CONTROL_Y`: at `screenDistanceM ≥ 3.75` the screen bar reaches x 693–707 and its label y≈342, inside the column. `tests/unit/ApparatusGeometry.test.ts` pins the invariant. |
| `src/adapters/phaser/renderers/sideColumnView.ts` | The Phaser-free three-part rule the laboratory paints. Fully unit-tested. | Generalize into the shared module, or keep as a specialization of it. One rule, not two. |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts` `:252-279` | Heading, guide, transient error/notice in the guide slot, measured layout, the `cardGeometry` clamp, the submit control. **Never reads the defensible set.** | Add the affordance and the shared transient lifetime. Do not let anything new read `selectDefensibleConclusionProposalIds` (ADR-006). |
| `src/adapters/phaser/SceneRouter.ts` | Read-only over the store; maps phase → scene from `scenarioScript`; a standing `rivalLabCritique` overrides the phase's scene; a routing throw must never escape the subscriber. | **Untouched.** The affordance dispatches; the router reacts. The scene never starts another scene. |
| `src/game/main.ts` `:56-80` | Registers the routable scenes, auto-starts `LectureBookScene` last, and suppresses input on the four scenes that own canvas input. Sets `data-active-scene`. | Extend the suppression callback to the two new hosts. Do not restructure the registry. |
| `src/ui/*` panels | Retired-but-mounted; still the only dispatcher for nine intents. | **Do not touch.** Not to fix the untranslated theory-board gate message, not to remove a duplicate route. Story 2.12. |

### Where the affordance lives

Scene ownership follows `scenarioScript`, which maps: `context → Library`, `prediction → Colleagues`, `experiment → Laboratory`, `synthesis → TheoryBoard`, `review → TheoryBoard`, `debrief → Debrief`.

Three scenes already own real renderers and take the affordance directly. `TheoryBoard` hosts **two** phases and must resolve its transition from the live phase on every render — the same trap `DialogueBox`'s `conversationId` exists for.

`LibraryScene` and `DebriefScene` are nine-line `PhasePlaceholderScene` subclasses. Two acceptable placements, both fine:

- **(a)** Mount the affordance in `PhasePlaceholderScene` itself, so both inherit it. Smallest diff; the base class is deleted by 2.11 and the widget survives into the real scenes. Keep the dev marker as-is.
- **(b)** Give each of the two scenes its own thin `create()` that mounts the widget over the inherited marker.

Either way: subscribe to the store, render on notification, destroy on `shutdown`, and add the `setInputEnabled` pass-through Task 6 needs. Do not author player-facing room or debrief copy — the placeholder marker stays un-localized on purpose and its replacements are 2.8 and 2.11.

`RivalLabScene` is deliberately excluded. The rival lab is a state the theory board enters and leaves while the phase stands still; its exit is `rivalLab.revisionRequested`, which already exists on the canvas.

### The transient lifetime fix (AC5)

Today both renderers clear the message inside the render that draws it:

- `ApparatusRenderer.renderSideColumn` `:469` — `this.transientError = undefined;`
- `ColleagueRenderer.render` `:260-261` — `this.transientError = undefined; this.transientNotice = undefined;`

So the message paints once and the next `render(state)` erases it — and both renderers re-render for reasons that are *not* state changes (a dialogue advance, a card relayout, the refusal's own follow-up render). The player is left with a control that refused for a reason they can no longer read.

**The rule that fixes it, and why it is exact.** `createStore` replaces `state` with a **new frozen object** only on a successful `dispatch` or `replaceWithValidatedRecord`, and notifies only then. A refused dispatch returns a failure and leaves the object identity untouched. So:

> When a transient message is set, capture the current `AppState` object alongside it. On every subsequent `render(state)`, clear the message **iff** `state !== capturedState`. Otherwise keep painting it.

That gives "survives until a real state change replaces it" precisely, with no timers, no frame counting, and nothing to tune. Put it in one small Phaser-free helper both renderers use, and unit-test the helper rather than the renderers.

Note the consequence and accept it: a locale change *is* a state change and clears the message. That is correct — the message would otherwise be stranded in the previous language.

### Answering a refusal (AC4)

Two registers, and they are not interchangeable:

- **A gate the player can act on** → the authored in-fiction colleague line, via `selectLocalizedColleagueHint(state)`, with the attributed speaker above it. Today exactly one gate has authored lines: the significant-measure gate (`case.json` `colleagueHints`, four entries, EN+FR). Do not invent a fifth predicate kind — that is a `CaseDefinition` contract change and a version bump, and the missing-sources colleague line is **Story 2.8's AC4**.
- **Anything else** → `selectLocalizedError(state, error)`. It is the single presentation boundary for a `Result` failure and it supplies interpolation parameters itself (`missing-contextual-sources` gets its `{label}` there), so a surface cannot leave a raw `{label}` on screen. Never render `error.message` — that is the dev-facing English string, and rendering it is exactly the defect `deferred-work.md` records against the retired theory-board panel.

Precedence: a non-gate error takes the whole slot and carries **no** speaker attribution — an attribution line above an unrelated message reads as the colleague having said it. That precedence is already encoded and tested in `sideColumnView.ts`; carry it forward.

Never silent. `createStore` short-circuits every dispatch during an exclusive progress operation (`progress-operation-active`), so a click during a progress export legitimately fails with nothing to do with the evidence — and swallowing it leaves the control indistinguishable from a dead one.

### Layout constraints

The canvas is a fixed **1024×768 `Scale.FIT`** surface with no scroll. A surface that outgrows its band is a defect, not a responsive state.

- **Measure, never assume.** The 1.11, 1.12, 2.5, and 2.6 reviews each found the same defect: one object placed against a constant while the object above it grew with French copy. 2.5 reintroduced it in the same diff it was cited in. Place the affordance against measured neighbours or against the canvas floor.
- The laboratory hint panel is bottom-anchored and grows **upward** from `scene.scale.height - HINT_BOTTOM_MARGIN`, sized from the measured text. Keep it exactly so (AC3).
- Read `768` / `1024` from `scene.scale`, never as literals — a rule Story 2.8 makes explicit and this story should not violate first.
- The label must fit its fixed-height control **on one line in French**. The per-token typography sweep cannot detect a two-line wrap inside a 40px rectangle; the whole-string test is what does.
- Do not paint the affordance over content the player is reading or measuring, and do not let it swallow pointer events over the apparatus.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011):** Phaser scenes own all interactive presentation; `CaseRecordPrintView` is the only non-Phaser exemption and dispatches nothing. **A feature is not done until the canvas can dispatch its intent** — before marking complete, grep for every dispatcher of every action touched. Never add semantic HTML to mirror a Phaser gesture. `src/ui/*` panels are retired and are not a working fallback. `src/game/scenes/*` are orphaned template leftovers — real scenes live in `src/adapters/phaser/scenes/`. Scenes **mirror** the phase and must never define, infer, or advance it; the router (ADR-009) is read-only and never dispatches. No scene→scene reach-in. A routing failure must never escape the store subscriber. **Never author player-facing copy in `create()`** — create empty, populate in `render(state)` through `createTranslator(locale)`. Renderer contract: `create()` / `render(state)` / `destroy()`, releasing every object, tween, timer, and listener — including tweens whose target is the renderer itself. Sticky canvas: browser tests must scroll before exercising in-canvas controls.
- **Guided adventure:** everything is authored. **"Every forward transition has an in-scene affordance. The scenario advances from the scene the player is standing in. A transition reachable only from outside the canvas does not exist."** — this story's rule, verbatim, with the complete set enumerated. **"Authored copy must not name a scene, phase, or route (the `encodesPath` check) — including an advance affordance's label, which names what the player is moving *toward in fiction*."** **"A refused action always says why, and the message survives until a real state change replaces it. A gate the player can act on is answered by the authored colleague hint; anything else by the localized error. Never a raw error, never silence, never erased by an unrelated redraw."** The evaluator is the sole completion authority; never hard-code completion in a scene. Defensibility is evaluator/critique-only — never leak it into a display projection (ADR-006). Choices stay revisable. No hard fail, score, timer, or speed reward.
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria** — the project's most-repeated defect. Interface strings go through `translate` / `createTranslator`; prose the player reads is `LocalizedText`; proper nouns stay plain strings. Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont.
- **Organization:** `src/domain/` pure (no Phaser, DOM, fetch, IndexedDB, browser APIs, or Zod); `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No `services/`/`managers/`/`helpers/`. Case definitions immutable under `public/cases/` — and this story edits none. Fallible operations return `Result<T, ResultError>`; error codes resolve to localized copy. Naming: `PascalCase` classes/files, `camelCase` modules, `UPPER_SNAKE_CASE` constants, actions `domain.verbPastTense`.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal; no logging, JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. Animate on elapsed time, never frame counters. Cap text resolution at `min(devicePixelRatio, 2)`. **Honour `prefers-reduced-motion`** in any animated renderer — this story should add no animation at all.
- **Platform:** static web app; offline reload is a release gate. Never expose a raw error to the player; never log learner-entered conclusions. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it. To test Phaser-adjacent logic, inject the structural slice (`SceneRouterTarget` is the reference). Assert public actions, selectors, and rendered text — never Phaser private fields or incidental pixels. Never assert a magic number a test shares with source unless both read one exported constant. Some e2e specs already fail on baseline — check before attributing a failure to your change. axe/manual a11y are no longer gates; keep the reduced-motion check and delete no existing a11y spec.

### Previous story intelligence (2.6, and the 2.5 / 1.12 reviews)

- **The affordance is part of the feature, and 2.6 proved the shape.** 2.6 built exactly one of these controls, ~100 lines against the existing adapter, because `src/ui/theory/TheoryBoard.ts` was the only `synthesis` dispatcher. Its source comment says so at `ApparatusRenderer.ts:56-62`. This story generalizes that fix; read the 2.6 diff (`0844fb2`) before starting.
- **2.6 shipped its whole rendering path with no automated coverage.** The review found `createSideColumn`, `renderSideColumn`, the `advanceRefused` lifecycle, and the hint panel entirely unasserted — the manual check had run through a temporary Playwright spec that was then deleted. `sideColumnView.ts` and `tests/unit/SideColumnView.test.ts` exist because of that finding. Do not regress it: the generalized module carries the same obligation, six times over.
- **A per-token typography sweep is not a wrap check.** 2.6's Completion Note claimed `lab.advance` was pinned against a two-line wrap; it was not. The whole-string `FIXED_HEIGHT_CONTROLS` test was added in review for exactly that. Every new label goes in it.
- **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y` was 130 on the stated grounds that "nothing measured pushes the column around" — `lab.guide` wraps straight through it, and the screen bar slides into it at long throws. Both were reachable in normal play.
- **Localize as you build, not after.** The one real code defect in 2.4 was an English-only surface shipped months after the i18n foundation.
- **Do not import Phaser at module scope in anything a Playwright spec imports.** Phaser touches `window` at import time and specs run in Node. This is why `apparatusGeometry.ts` and `sideColumnView.ts` are separate files.
- **Hit areas do not resize themselves.** `setInteractive` a second time only re-enables.
- **A refused dispatch must be visible**, and a refusal now has more than one meaning per transition.

### Git intelligence

`dad7ce3 Correct course` (the change that created this story), `0844fb2 Dev 2.6`, `d55309b Story 2.6`, `28db29a Review 2.5` establish the rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned items pushed to `deferred-work.md`. `dad7ce3` also carries the review remediation for 2.6 — including `sideColumnView.ts`, `tests/unit/SideColumnView.test.ts`, `tests/unit/ApparatusGeometry.test.ts`, and the `french-typography.spec.ts` whole-string test — all of which this story extends rather than replaces.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`). `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the lockfile is committed to pin exact patches.

### Project Structure Notes

- **New:** `src/adapters/phaser/ui/AdvanceControl.ts` (or equivalent widget name), a Phaser-free view/mapping module beside `sideColumnView.ts`, a Phaser-free transient-lifetime helper, plus their unit tests and one integration spec and one e2e spec.
- **Revised:** `src/adapters/phaser/PhaserStoreAdapter.ts`, `src/adapters/phaser/renderers/{ApparatusRenderer,ColleagueRenderer,apparatusGeometry,sideColumnView}.ts`, `src/adapters/phaser/scenes/{ColleaguesScene,TheoryBoardScene,LibraryScene,DebriefScene,PhasePlaceholderScene}.ts`, `src/game/main.ts`, `src/core/i18n/locales/{en,fr}.ts`, `tests/unit/{SideColumnView,ApparatusGeometry}.test.ts`, `tests/e2e/{french-typography,rival-lab}.spec.ts`.
- **Do not touch:** any `src/ui/*` panel, `src/game/scenes/*`, `src/domain/**` (no domain change is needed), `src/schemas/**`, `public/cases/**`, `docs/validation/*`, `dist/`, `.claude/worktrees/**`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.7` — the six ACs; §Epic 2 for the reopening note; NFR20, FR30, and the amended FR6/FR8; §Story 2.8/2.10/2.11 for what this story must *not* build]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §1 (the dispatcher inventory and the two blockers), §2.4 (technical impact and the eight deferred items), §3 (sequencing: 2.7 first, 2.12 last), §4.1.6, §4.3.4 (ADR-011/012), §4.4.2 (the "Step advance" component pattern)]
- [Source: `_bmad-output/project-context.md` revision 2.1 — engine, guided-adventure, i18n, organization, performance, platform, testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — §User Interface and Rendering Boundary ("Surface completeness"), ADR-001 v1.1, ADR-006, ADR-009, **ADR-011**, ADR-012; §Naming Conventions]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` — the "Step advance" component row; §Case flow ("every transition between these steps is advanced from within the scene the player is standing in"); §Layout (the fixed 1024×768 non-scrolling surface; narrow-viewport suppression must not make a transition unreachable); §Avoid-as-of-2026-08-06]
- [Source: `src/domain/cases/caseReducer.ts` — `NEXT_CASE_PHASE`, the one-way phase machine; `src/domain/cases/CaseProgress.ts` — `CASE_PHASES`]
- [Source: `src/core/store/AppState.ts:601-646` `reduceCasePhaseAdvance` (the `review → debrief` refusal, the three gates); `:648-658` `reduceTheoryReviewRequest`; `:780-810` `reduceDebriefComplete`; `:812-833` `reduceReplayStart`]
- [Source: `src/core/store/createStore.ts:31-43` — state identity changes only on a successful dispatch; `:60-75` `acquireExclusiveOperation`, the source of `progress-operation-active`]
- [Source: `src/core/store/selectors.ts:80-86` `selectLocalizedError` (the single `Result`-failure presentation boundary); `:299-334` `selectSignificantMeasureGate` and `selectLocalizedColleagueHint`]
- [Source: `src/adapters/phaser/PhaserStoreAdapter.ts` — the adapter surface to widen and its timestamp discipline]
- [Source: `src/adapters/phaser/renderers/ApparatusRenderer.ts:401-502` — the 2.6 control, `advanceToSynthesis`, and the measured floor-anchored hint panel to preserve; `:527-535` — the sub-768px suppression 2.12 re-decides]
- [Source: `src/adapters/phaser/renderers/sideColumnView.ts` — the three-part rule and why it is a separate Phaser-free module]
- [Source: `src/adapters/phaser/renderers/apparatusGeometry.ts` — exported geometry, `ADVANCE_CONTROL_Y = 360` and why it is not 130]
- [Source: `src/adapters/phaser/renderers/ColleagueRenderer.ts:239-294,349-372` — the transient slot, the measured layout, the `cardGeometry` clamp; `:296-302` — nothing reads the defensible set]
- [Source: `src/adapters/phaser/ui/DialogueBox.ts` — the store-agnostic reusable-widget contract to copy, including exported geometry and `dialogueAdvanceControlCentre`]
- [Source: `src/adapters/phaser/SceneRouter.ts` — read-only routing, the rival-lab override, and why a throw must not escape]
- [Source: `src/game/main.ts:56-80` — scene registration and the book-overlay suppression callback to extend; `src/main.ts:127-144` — `data-active-scene`]
- [Source: `public/cases/young-interference/case.json` — `scenarioScript.scenes` (the phase→scene map), `colleagueHints` (four entries, the only authored gate lines), `requirements.minimumSignificantRuns: 2`]
- [Source: `tests/e2e/rival-lab.spec.ts` — the canvas-walk pattern: derived click targets, `clickDesign`, `expectActiveScene`]
- [Source: `tests/e2e/french-typography.spec.ts:443-473` — the whole-string `FIXED_HEIGHT_CONTROLS` test to extend]
- [Source: `tests/unit/SideColumnView.test.ts`, `tests/integration/SignificantMeasureGate.test.ts`, `tests/integration/ReviewFlow.test.ts` — the coverage patterns to extend]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — the three 2.6 items, two of which this story closes or bounds]
- [Source: `_bmad-output/implementation-artifacts/2-6-significant-measure-gate-and-colleague-hints.md` §Review Findings, §The advance control does not exist yet, §Why the hint is derived, not stored]

### Open questions for the reviewer (do not block implementation)

1. **Two intents in the `review → debrief` chain have no owner.** `theory.supportRunSelected` / `theory.supportSourceSelected` and `peerReview.requested` / `revision.saved` are DOM-only and are not claimed by 2.8–2.12. Story 2.12's completion check ("every player intent is dispatchable from the canvas") cannot pass without them. Do they belong to 2.11, or to a new 2.13?
2. **Does the missing-sources gate get an authored colleague line here or in 2.8?** This story routes it to the localized error and Story 2.8 AC4 authors the in-fiction line. Confirm that reading of AC4.
3. **`lab.advance` retirement.** Folding it into the `advance.*` family costs a small churn in two test files. Accept, or keep the existing key for the synthesis transition and accept an inconsistent family?

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5[1m]`) — Game Developer (Link Freeman), 2026-08-07.

### Implementation Plan

Built in the story's task order, red-green-refactor per pure module (test written and confirmed failing before the implementation).

1. **`PhaserStoreAdapter.advanceCase(transition)`** replaced `advanceToSynthesis`. A named `AdvanceTransitionId` union plus an exhaustive `Record` of dispatchers, so the three non-`phaseAdvance` moves cannot be guessed. `case.debriefCompleted`'s timestamp is stamped here, following `submitConclusion`.
2. **`renderers/advanceView.ts`** — Phaser-free. Holds the total `CasePhase → { transition, labelKey }` map, `advanceRefusalRegister(code)`, and `resolveAdvanceView`. `sideColumnView.ts` was **folded into it and deleted**, so there is one rule rather than two.
3. **`renderers/transientMessage.ts`** — the `AppState`-identity anchor, used by both renderers.
4. **`ui/AdvanceControl.ts`** — the store-agnostic widget, owning the control's geometry. `apparatusGeometry.ts` keeps the *placement* and re-exports the widget's dimensions.
5. **Wiring** — laboratory (widget replaces the 2.6 control in place), both boards, and `PhasePlaceholderScene`.
6. **Suppression, copy, tests, spec repairs.**

### Debug Log References

- **Two new e2e tests failed on first run, both at the same step: the Library advance click immediately after closing the reference book.** Not a defect in the affordance. `LectureBookRenderer.isOverlayVisible` stays `true` for the whole 180 ms closing fade *by design* — `hide()` disables the book's own input at once but keeps the overlay painted, and everything underneath must stay suppressed until `destroyOverlay`. So the click was correctly ignored. `rival-lab.spec.ts` never hit this because its next action after closing the book is a DOM click. Resolved with a bounded retrying click (`clickUntilScene`) for that one window, which is what a player does; the suppression itself is asserted directly, not tolerated, in the third test of `canvas-transitions.spec.ts`.
- **`placeholderAdvanceControlCentre` could not live in `PhasePlaceholderScene`.** That class *extends* `Phaser.Scene`, so it imports Phaser as a value and Phaser touches `window` at import time; the first unit run died inside `phaser.esm.js`. Split into `scenes/phasePlaceholderGeometry.ts`, following `apparatusGeometry.ts`'s precedent for exactly the same reason.
- **The `encodesPath` unit check caught two stale label keys** (`advance.toPeerReview`, `advance.toHistoricalAccount`) left in the mapping after the copy was renamed — the "labels every transition in both locales" assertion failed rather than the app silently falling back to English at runtime.

### Completion Notes List

**What was built.** One reusable Phaser advance affordance, mounted in all five phase scenes, dispatching six typed actions through one adapter surface. All six forward transitions — `context → prediction`, `prediction → experiment`, `experiment → synthesis`, `synthesis → review`, `review → debrief`, and the post-debrief replay — are now dispatchable from the canvas. `RivalLabScene` deliberately has none.

**AC2 is delivered as bounded, and the bound is real.** Every *transition* is canvas-dispatchable and `tests/e2e/canvas-transitions.spec.ts` walks all six with canvas clicks. A **pure** canvas walk still cannot complete Young: `source.inspected`, `experiment.run`, the notebook comparison, the theory-board support selections, and the peer-review chain have no canvas dispatcher and are out of this story's scope. The e2e spec takes each of those on its current DOM path and annotates it inline with the story that closes it. This is not a "passes" claim for the full walk — 2.8 and 2.10 make it true and 2.12 verifies it.

**The unowned-coverage gap is real and reaches 2.12.** `theory.supportRunSelected` / `theory.supportSourceSelected` and `peerReview.requested` / `revision.saved` are claimed by no story in the 2.7–2.12 plan, and 2.12 deletes their only dispatchers. Recorded in `deferred-work.md` under this story. **Story 2.12 cannot pass its own completion check until these are owned** — decide 2.11 or a new 2.13 before scheduling it.

**Deferred items closed.** ✅ "`transientError` is cleared inside the render that draws it" — closed in *both* renderers in one pass, as the item asked, via `transientMessage.ts`. ✅ "A fourth unlinked copy of the book-control coordinate" — partly closed: `bookCloseControlCentre()` is now exported and both specs derive it (the `768`/`1024` restatement remains open). ✅ The whole-string fixed-height typography test now covers every fixed-height control, not just the newest.

**Decisions taken on the story's three open questions.** (1) Left for the reviewer, and recorded in `deferred-work.md` as above. (2) Followed the story's reading: the missing-sources gate is answered here by the localized error, and Story 2.8 AC4 authors the in-fiction colleague line. (3) Retired `lab.advance` into the `advance.*` family — the churn was two test files and the family is now consistent.

**Changes to existing behaviour, stated rather than buried.**
- `CONCLUSION_HEADING_WRAP` was **renamed** to `BOARD_TEXT_WRAP` and now bounds the heading *and* the guide on *both* boards, not the conclusion heading alone. The number is unchanged (696); what changed is that the right-hand control column is now a permanent feature of both boards rather than the conclusion board's exception. `french-typography.spec.ts` measures all four texts against it.
- `ColleagueRenderer.dialogueTop()` now also clears the control column, not just the guide. On the conclusion board the column's floor (112) sits within 6 px of `DIALOGUE_TOP` (118); measuring against it rather than trusting that margin is the same rule the guide already had.
- `ColleagueRenderer`'s two transient fields (`transientError`, `transientNotice`) became **one** slot carrying `{ text, tone }`. They were always one line of text differing only in colour, and holding them in two fields is what let `render` clear both on every paint.
- `PhasePlaceholderScene` now takes `isOverlayVisible` and carries player-facing behaviour. Its un-localized development marker is unchanged.

**No test assertion was deleted or weakened.** `tests/unit/SideColumnView.test.ts` was renamed to `tests/unit/AdvanceView.test.ts` when its module was folded in; every one of its assertions is carried forward verbatim, with new coverage added around them. The one added tolerance — the retrying click in the e2e — is bounded and is paired with a test that asserts the suppression it tolerates.

**Verification.** `npm run typecheck` clean. `npm test`: **46 files / 660 tests pass** (baseline `bfdf246`: 42 / 614). `npm run test:e2e` (chromium): **7 failed, 43 passed**. The baseline was **measured, not assumed** — the working tree was stashed and the suite run at `bfdf246`, giving **7 failed, 40 passed** with an identical failure set by spec title. All seven are the documented pre-existing failures (six from the stale `Record prepared observation` notebook flow, one from the `aria-disabled`/`disabled` mismatch); the delta is exactly the three new passing tests. No new failure, and none of the seven is attributable to this change.

**Manual check at 1280×720, EN and FR** (screenshots taken through a throwaway capture spec, deleted afterwards; the permanent assertions live in `canvas-transitions.spec.ts` and `french-typography.spec.ts`). In every phase the affordance is present, legible, and un-truncated in both locales. At `screenDistanceM = 4.0` the laboratory control at y=360 clears the screen bar (y ≤ 308) and its label (y ≤ 342), and the colleague hint remains floor-anchored. Refusals are answered, not silent: the library shows the localized missing-sources error with the French source name interpolated (no raw `{label}`), the laboratory shows the authored colleague hint, and the theory board shows the localized `conclusion-not-ready` error. In `review` the same board control correctly relabels itself from "To your reviewers" to "Close the case", which is the phase-awareness Task 5 asks for.

**`prefers-reduced-motion` is unaffected: this story adds no animation at all.** `AdvanceControl` registers no tween, timer, or update loop, and neither does the shell; `grep` over the four new modules finds no animation call. The laboratory's existing reduced-motion subscription and static-frame path are untouched.

**One observation worth a reviewer's eye.** `error.conclusion-not-ready` tells the player "the theory board shows what is missing", but only the retired DOM panel enumerates the missing requirements — the canvas board shows nothing of the kind, and will show nothing at all once 2.12 deletes the panel. Localized and non-raw, so AC4 holds, but the copy promises a surface that does not exist. Recorded in `deferred-work.md`.

### File List

**New**

- `src/adapters/phaser/ui/AdvanceControl.ts`
- `src/adapters/phaser/renderers/advanceView.ts`
- `src/adapters/phaser/renderers/transientMessage.ts`
- `src/adapters/phaser/scenes/phasePlaceholderGeometry.ts`
- `tests/unit/AdvanceView.test.ts`
- `tests/unit/AdvanceControlGeometry.test.ts`
- `tests/unit/TransientMessage.test.ts`
- `tests/unit/PhaserStoreAdapter.test.ts`
- `tests/integration/PhaseTransitions.test.ts`
- `tests/e2e/canvas-transitions.spec.ts`

**Modified**

- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/renderers/ApparatusRenderer.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `src/adapters/phaser/renderers/LectureBookRenderer.ts`
- `src/adapters/phaser/renderers/apparatusGeometry.ts`
- `src/adapters/phaser/scenes/PhasePlaceholderScene.ts`
- `src/adapters/phaser/scenes/LibraryScene.ts`
- `src/adapters/phaser/scenes/DebriefScene.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/game/main.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/rival-lab.spec.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-7-in-scene-phase-transitions.md`

**Deleted**

- `src/adapters/phaser/renderers/sideColumnView.ts` — folded into `advanceView.ts` (one rule, not two)
- `tests/unit/SideColumnView.test.ts` — renamed to `tests/unit/AdvanceView.test.ts`, every assertion carried forward

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-06 | 0.1 | Story context created from epics.md §Story 2.7, sprint-change-proposal-2026-08-06, game-architecture v1.2, project-context v2.1, and the live source. | Game Scrum Master |
| 2026-08-07 | 1.0 | Implemented all eleven tasks. Reusable `AdvanceControl` widget mounted in all five phase scenes; `PhaserStoreAdapter.advanceCase` dispatching all six forward transitions; `sideColumnView` folded into `advanceView`; explicit `AppState`-identity lifetime for transient messages in both renderers; six `advance.*` labels in EN+FR with `lab.advance` retired; book-overlay suppression extended to Library and Debrief. Net +46 Vitest tests (614 → 660) across four new unit/integration files, plus three new e2e tests. Closes two `deferred-work.md` items. | Game Developer (Link Freeman) |

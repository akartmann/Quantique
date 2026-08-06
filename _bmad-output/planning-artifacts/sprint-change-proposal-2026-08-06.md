---
title: "Sprint Change Proposal — Playable Phaser surface"
project: Quantique
author: Alexis
prepared_by: "Link Freeman (Game Developer)"
date: 2026-08-06
status: proposed
scope_classification: Moderate
supersedes: null
builds_on: sprint-change-proposal-2026-08-05.md
---

# Sprint Change Proposal — Playable Phaser surface

**Date:** 2026-08-06
**Trigger:** Play-testing the Young slice after Story 2.6 shipped
**Change scope:** Moderate — backlog reorganization within Epic 2, plus artifact amendments. No re-architecture.

---

## 1. Issue Summary

### Problem statement

The 2026-08-05 pivot made Phaser the sole interactive surface. Epic 1 and Epic 2 then delivered the
routing spine, the store contracts, the evaluator, the dialogue widget, the proposal cards, the rival
lab, and the significant-measure gate — all correct, all tested, all satisfying their acceptance
criteria as written.

What no story required was that **the Phaser surface actually carry the player's intent**. So the
pivot shipped a correct spine over placeholder rooms, while the retired-but-mounted DOM panels
remained the only way to play the game.

Of the 14 player intents needed to complete a Young case, the canvas dispatches 5. Nine are
dispatchable only from `src/ui/*` panels the pivot declared retired.

### How it was discovered

Alexis played the slice from a cold boot on 2026-08-06 and reported four observations:

1. The app opens on a **Library placeholder**; there is no library and no way to pick up the reference book.
2. **Colleague and rival-lab interaction is text only** — no characters to interact with.
3. **Step transitions are not available from the Phaser view**, unlike NPC interactions.
4. The apparatus animation is good but **interaction is not physical** (no knobs or moving parts), and
   **the light animation runs unattended** instead of starting when the player pushes a button —
   which should replace the "Run experiment" button.

All four are confirmed in code. They are four symptoms of one cause.

### Evidence — the dispatcher inventory

| Player intent | Action | Only dispatcher | Surface |
|---|---|---|---|
| Inspect a contextual source | `source.inspected` | `src/ui/sources/CuratedRecord.ts:109,120` | DOM — retired |
| Advance `context → prediction` | `case.phaseAdvance` | `src/ui/context/CaseContextAndPrediction.ts:213` | DOM — retired |
| Advance `prediction → experiment` | `case.phaseAdvance` | `src/ui/context/CaseContextAndPrediction.ts:213` | DOM — retired |
| **Run the experiment** | `experiment.run` | `src/ui/apparatus/ApparatusControls.ts:111` | DOM — retired |
| Record a run in the notebook | `run.record` | `src/ui/notebook/NotebookPanel.ts:91` | DOM — retired |
| Advance `synthesis → review` | `theory.reviewRequested` | `src/ui/theory/TheoryBoard.ts:207` | DOM — retired |
| Advance `review → debrief` | `case.debriefCompleted` | `src/ui/debrief/HistoricalDebriefPanel.ts:31` | DOM — retired |
| Start a replay | `case.replayStarted` | `src/ui/debrief/HistoricalDebriefPanel.ts:66` | DOM — retired |
| Set a wavelength (optional path) | `apparatus.wavelengthSet` | `src/ui/apparatus/ApparatusControls.ts` | DOM — retired |
| Adjust a primary control | `apparatus.controlSet` | `ApparatusRenderer` | **Phaser** |
| Choose a prediction | `prediction.proposalChosen` | `ColleagueRenderer` | **Phaser** |
| Choose a conclusion | `theory.conclusionProposalChosen` | `ColleagueRenderer` | **Phaser** |
| Submit a conclusion | `theory.conclusionSubmitted` | `ColleagueRenderer` | **Phaser** |
| Request rival-lab revision | `rivalLab.revisionRequested` | `RivalLabRenderer` | **Phaser** |
| Advance `experiment → synthesis` | `case.phaseAdvance` | `ApparatusRenderer` (Story 2.6) | **Phaser** |

Story 2.6 already hit this wall and solved one instance of it. Its own source comment states the
reason the control had to exist at all: *"`src/ui/theory/TheoryBoard.ts` was the only dispatcher of
`nextPhase: 'synthesis'` in the codebase, and it is a retired-but-mounted DOM panel. Without a canvas
affordance the gate would refuse on a surface the pivot retired"*
(`src/adapters/phaser/renderers/ApparatusRenderer.ts:56-62`). This proposal generalises that fix.

### Two hard playability blockers, not just missing polish

**Blocker A — the Colleagues scene refuses every click on a canvas-only path.**
`reducePredictionProposalChosen` (`src/core/store/AppState.ts:498-501`) refuses with
`missing-contextual-sources` until context readiness is met. Readiness is satisfied only by
`source.inspected`, whose only dispatcher is the DOM `CuratedRecord`. So on the canvas alone, all four
prediction cards are permanently inert.

**Blocker B — the experiment cannot be run from the canvas at all.**
`experiment.run` has no Phaser dispatcher. The `ApparatusRenderer` animation loop starts in
`create()` via `syncAnimationLoop()` and runs unconditionally, decoupled from any run — which is
exactly the "light always on, run button elsewhere" behaviour reported.

### Confirmation of each reported item

| Item | Finding | Location |
|---|---|---|
| 1 — Library placeholder | `LibraryScene` is nine lines extending `PhasePlaceholderScene`; it paints the literal string `"Library (placeholder)"` plus the phase name. Reading happens in a session-persistent `LectureBookScene` overlay the router never manages, plus the DOM source cards. No room, no shelf, no pickup. | `src/adapters/phaser/scenes/LibraryScene.ts`, `PhasePlaceholderScene.ts:26-31` |
| 1b — **Debrief also placeholder** | `DebriefScene` is likewise a `PhasePlaceholderScene`, despite Story 2.3 being marked `done`. Not reported (likely unreached), same class of gap. | `src/adapters/phaser/scenes/DebriefScene.ts` |
| 2 — Text-only NPCs | Colleague presence is a 4px accent stripe derived from `portrait.accentColor`. The renderer concedes it: *"an `asset` portrait's image is not preloaded by these scenes, and portrait art is still out of scope."* No figures, no staging, no speaker positioning, no reaction. | `src/adapters/phaser/renderers/ColleagueRenderer.ts:141-149` |
| 3 — Transitions off-canvas | Inventory above: 4 of 5 phase transitions plus replay live only in DOM panels. Already-tracked corollary: below 768px the advance control is suppressed, leaving the DOM panel as the *only* route to synthesis. | `deferred-work.md` §2.6 |
| 4a — Non-physical controls | Controls are `+`/`−` text buttons at fixed `x = 390` / `x = 510` with `padding` styling. No drag, no rotation, no instrument body. | `ApparatusRenderer.ts:504-525` |
| 4b — Unattended light | `syncAnimationLoop()` is called from `create()` and gated only on `motionAllowed && inputEnabled`. Never on a player-initiated run. | `ApparatusRenderer.ts:132-142, 166-167` |

### Consequence for the release gate

Story 2.4's Young validation gate is `Blocked` and requires the slice to be playable. As of today a
moderated learner session would be conducted against the surface the pivot retired. Fixing this is a
precondition for the gate meaning anything.

---

## 2. Impact Analysis

### 2.1 Epic impact

**Epic 2 — Young validation slice: reopen.** Its stated outcome ("players can complete a 20–30 minute
double-slit investigation") is not met on the intended surface. All six existing stories remain
`done` — they satisfied their acceptance criteria — but the epic needs six new stories to close the
gap between "the contracts are correct" and "the game is playable in Phaser."

**Epic 1 — Phaser guided-adventure foundation: no reopen.** Stories 1.3–1.12 built the reusable
substrate (store adapter, scene router, dialogue widget, proposal choice widget, renderer contract).
That substrate is sound and is what makes the new work incremental rather than a rebuild. The
*completeness* rule the epic should have carried is added as a new NFR rather than by reopening
stories.

**Epic 3 — Reusable case authoring: amend one story.** Story 3.4 (scenario and proposal authoring
contract) must additionally cover per-scene cast staging and apparatus-affordance descriptors, so
cases 2–4 author their characters and instruments rather than inheriting hardcoded Young geometry.

**Epics 4, 5, 6 — no scope change, real dependency change.** Each authors a new laboratory with new
controls. They now inherit the direct-manipulation control pattern and the colleague-staging renderer
from Epic 2 instead of the `+`/`−` stepper pattern. This *reduces* their per-case cost, but they must
not begin before Epic 2's renderers stabilise — which the existing "no later case begins production
until Young's gates are met" rule already enforces.

**Epic 7 — Classroom release readiness: no scope change.** Story 7.3 (cross-browser verification)
gains surface area but no new requirement. Note that retiring the DOM panels invalidates several e2e
specs it depends on; that reconciliation is assigned to Story 2.12 below, not deferred into Epic 7.

**Epic ordering:** unchanged. Epic 2 stays before Epic 3.

### 2.2 Story impact

**Six new stories in Epic 2 (2.7 – 2.12).** Full acceptance criteria in §4.1.

| Story | Title | Closes |
|---|---|---|
| 2.7 | In-scene phase transitions and the adventure's forward path | Item 3; Blocker B's transition half |
| 2.8 | Library scene — the reading room and the reference book | Item 1; Blocker A |
| 2.9 | Colleague and rival-lab characters on stage | Item 2 |
| 2.10 | Physical apparatus instruments and the player-started light | Item 4 |
| 2.11 | Debrief scene — historical comparison, recognition, and replay | Item 1b |
| 2.12 | Retire the DOM presentation panels | The dual-surface contradiction |

**No story is rolled back.** No existing story's acceptance criteria are edited — they were met. Two
existing stories are annotated with a superseded-implementation note (§4.1.7) so a future reader does
not mistake `done` for "delivered on the canvas."

### 2.3 Artifact conflicts

| Artifact | Conflict | Action |
|---|---|---|
| `gdd.md` — Controls and Input | Says controls "expose current value and units on-screen" — silent on direct manipulation and on who starts the experiment. | Amend (§4.2) |
| `gdd.md` — Art Style | Already asks for colleagues as "first-class on-screen characters… present through portraits or silhouettes." **Aligned; implementation did not meet it.** | No edit needed; cited as authority |
| `gdd.md` — Out of Scope | "high-fidelity full animation" is out of scope. Risks being read as excluding physical knobs. | Amend to draw the boundary (§4.2) |
| `gdd.md` — Asset Requirements | Does not state that the cast is deliverable without commissioned art. | Amend (§4.2) |
| `game-architecture.md` — UI/Rendering Boundary | Correctly says scenes are the sole surface, but states no *completeness* obligation, which is precisely the gap. | Amend + new ADR-011 (§4.3) |
| `game-architecture.md` — Content Model | `colleagues[]` and `scenarioScript` lack per-scene staging and control-affordance fields. | Amend (§4.3) |
| `game-architecture.md` — Physics row | "None by default — the apparatus is a visual/interaction model." Still correct; drag input is not physics. | No edit; clarified in ADR-012 |
| `EXPERIENCE.md` — HUD & Diegetic UI | **Direct contradiction:** "controls, measurement values, instructions, and conclusions remain non-diegetic semantic UI." The opposite of what is now required. | Rework section (§4.4) |
| `EXPERIENCE.md` — Component Patterns / Accessibility Floor | Pre-pivot semantic-HTML model, already flagged "pending full rework." This change makes the rework blocking. | Rework (§4.4) |
| `project-context.md` | No rule preventing a feature from shipping with its only dispatcher off-canvas. | Add 4 rules + 2 don't-miss entries (§4.5) |
| `epics.md` — Requirements Inventory | No requirement covers canvas intent completeness, direct manipulation, or player-initiated runs. | Add NFR20, FR30; amend FR6, FR8 (§4.1) |
| `epics.md` — FR Coverage Map | Already carries known stale entries (tracked in `deferred-work.md`). | Update for new FRs only; full reconciliation stays deferred |
| `sprint-status.yaml` | Epic 2 marked `in-progress` with all stories `done`. | Add 6 stories (§4.6) |
| `docs/validation/*` | The 2.4 gate templates assume a playable candidate. | No edit; gate stays `Blocked` until 2.12 |

### 2.4 Technical impact

**No re-architecture.** Every layer the change touches is presentation. The store, domain, evaluator,
schemas, and persistence are correct and stay untouched, with two exceptions, both additive:

- `PhaserStoreAdapter` gains dispatchers for the nine off-canvas intents.
- `CaseDefinition` gains optional authoring fields (per-scene cast, control affordance). Additive and
  optional, so existing content parses — but `CaseDefinition.version` bumps and the record-compat
  allowlist must be extended honestly, per the standing rule.

**Retirements this unlocks.** Story 2.12 deletes `src/ui/*` except `print/CaseRecordPrintView.ts` and
`BootShell.ts` / `ValidationSessionDisclosure.ts`. That requires:

- Rewriting `src/main.ts`'s 15-clause boot guard, which today requires thirteen retired-panel roots
  and fails **silently** — already tracked as blocking "the documented pivot step of deleting the
  retired panels."
- Relocating the session-wide `scroll` → `scale.updateBounds()` listener out of `LectureBookScene`
  before that scene retires, or Phaser's cached document-space bounds go stale in every phase.
- Reconciling the e2e suite: ~8 specs drive DOM panels, several already failing on baseline.
- Re-establishing the validation-isolation spec's precondition, which currently reaches
  `CaseProgressPanel`'s "Save progress" button as the suite's only save affordance.

**Deferred-work items this closes (8):** the `LectureBookScene` → `LaboratoryScene` reach-in; the
stale e2e notebook button; the run-experiment disabled-state mismatch; the retired theory-board
panel's untranslated gate message; the sub-768px single-route problem; the `critiqueHistory` display
owner; the `transientError` lifetime inconsistency; the book-control magic-number quadruplication.

**Risks.**

| Risk | Severity | Mitigation |
|---|---|---|
| Six new renderers on a fixed 1024×768 `Scale.FIT` surface with no scroll; French runs 15–25% longer. Story 1.12's review already found cards leaving the canvas. | High | Every new renderer measures and clamps, per the established `cardGeometry` pattern. Extend `french-typography.spec.ts` to each new surface — and close its known whole-string gap while there. |
| NFR1 (60 FPS, low-end laptop): idle character sway plus knob drag plus the existing wavefront loop. | Medium | Profile before polish, per the standing rule. Silhouettes are pre-rendered to a texture once, not re-stroked per frame. Gating the light on a run *reduces* baseline cost. |
| Deleting 13 panels while ~8 e2e specs drive them. | Medium | 2.12 is sequenced last, after every canvas affordance exists and is covered. |
| `prefers-reduced-motion` regressions across six new animated surfaces. | Medium | Retained photosensitivity guard. Each renderer's ACs require a static frame under `reduce`. |
| Content-version bump breaking saved records. | Low | Extend the allowlist only with verified-identical canonical strings, per the standing rule. |

### 2.5 Two dead paths to retire rather than port

- **`prediction.recorded` (free-text).** Superseded by `prediction.proposalChosen`, which sets
  `state.prediction = proposal.text.en` and therefore already satisfies
  `evaluatePredictionReadiness`. It needs no canvas surface — Story 2.12 removes the action, not
  ports it.
- **`theory.conclusionSet` / `theory.limitationSet` (free-text conclusion).** Superseded by the
  1-of-4 conclusion choice. Same treatment; note the standing rule that a free-text path must clear
  the proposal ID, which is why leaving both paths live is a correctness hazard, not just dead code.

---

## 3. Recommended Approach

### Options evaluated

**Option 1 — Direct Adjustment.** Add stories to Epic 2; amend artifacts; no rollback.
Effort **High**, Risk **Low**. **Viable.**

**Option 2 — Rollback.** Revert 2.1 / 2.3 / 1.11 / 1.12 and rebuild.
Effort **High**, Risk **High**. **Not viable.** Nothing shipped is wrong. The store contracts, the
evaluator, the router, and both reusable widgets are the substrate the new work builds on; reverting
would destroy correct, tested code to re-derive it. The gap is additive, not corrective.

**Option 3 — MVP Review.** Reduce scope — accept text-only colleagues, keep the DOM panels as the
play surface for MVP.
Effort **Low**, Risk **High**. **Not viable as stated.** It would retract the 2026-08-05 pivot one
day after `project-context.md` v2.0 codified it, and leave the 2.4 gate validating a surface the
project has declared retired. *Partially adopted:* the NPC fidelity decision below is an Option-3
style scope reduction, taken deliberately.

### Selected path: **Hybrid — Option 1 with a scoped fidelity decision on Option 3 terms**

Six new stories in Epic 2, no rollback, artifact amendments — with character representation
deliberately scoped **down** from commissioned art to coded vector silhouettes.

### Rationale

- **The substrate is sound; the gap is additive.** Story 2.6 already proved a canvas transition
  control is ~100 lines against the existing adapter. The remaining eight follow the same shape.
- **The fidelity decision removes the only genuinely expensive dependency.** Painted portraits mean
  an art commission, a rights/provenance ledger entry per asset (FR26/FR27, NFR11), and a preload
  budget against NFR2's five-second first interaction. Coded silhouettes need none of that: the
  `portrait: { kind: 'silhouette', accentColor }` shape **already exists and is already validated**
  (`CaseDefinitionSchema.ts:225`), so the cast ships from case data alone. It also honours the GDD's
  own wording — "portraits **or silhouettes**" — rather than reinterpreting it.
- **It converts eight deferred items from debt into delivery.** Several are already blocking; the
  panel retirement in particular is named in `deferred-work.md` as obstructed.
- **It unblocks the 2.4 release gate**, which is the current critical path to everything after Epic 2.
- **Momentum is preserved.** No developer's completed work is discarded. The framing is honest: the
  stories were verified against the wrong altitude of acceptance criteria, and the fix is a new NFR
  plus six stories — not a reversal.

### Decisions taken (Alexis, 2026-08-06)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Coded vector silhouettes** for colleagues and the rival lab — Phaser `Graphics`, no image assets. | No art commission, no rights review, no loader cost. Uses the existing validated schema shape. |
| D2 | **Drag *plus* discrete steps** for apparatus controls. | Knob drag snaps to the authored `step`; `◂ ▸` and arrow keys step by one. Off-step values remain impossible, so the domain normalization rule is untouched and invisible. |
| D3 | **Full scope** — the four reported items, plus the Debrief placeholder, plus retiring the DOM panels. | Six stories. Makes the slice genuinely playable and unblocks the 2.4 gate. |
| D4 | **Batch review** of artifact edits. | This document is the single review artifact. |

### Effort, risk, and timeline

| Story | Effort | Risk | Depends on |
|---|---|---|---|
| 2.7 In-scene transitions | Medium | Low | — |
| 2.8 Library room and book | Large | Medium | 2.7 |
| 2.9 Characters on stage | Medium | Low | 2.7 |
| 2.10 Physical apparatus | Large | Medium | 2.7 |
| 2.11 Debrief and replay | Medium | Low | 2.7 |
| 2.12 Retire DOM panels | Medium | **High** | 2.7 – 2.11 all done |

**Sequencing.** 2.7 first: it delivers the reusable advance affordance every other story consumes,
and consolidates Story 2.6's ad-hoc control into it. Then 2.8, 2.9, 2.10, 2.11 — independent of each
other and parallelisable. 2.12 strictly last.

**Timeline impact:** Epic 2 extends by six stories. Epic 3 slips by the same amount. Epics 4–6 slip
but get cheaper per case. The 2.4 release gate moves from *blocked indefinitely* to *runnable after
2.12* — a net improvement to the critical path.

---

## 4. Detailed Change Proposals

### 4.1 `epics.md`

#### 4.1.1 New NFR20 — canvas intent completeness

> **NFR20: [new — 2026-08-06]** Every player intent required to reach a case conclusion must be
> dispatchable from the Phaser canvas. No non-Phaser surface may be the sole dispatcher of any
> player intent. A story that introduces or gates an intent is not complete until the canvas can
> issue it; the retained CSS print/export view is the sole exemption, and it dispatches nothing.

*Rationale:* this is the requirement whose absence caused the issue. ADR-001 v1.1 said Phaser is the
sole surface; nothing said the canvas must be *sufficient*. Six stories were verifiable and complete
without it.

#### 4.1.2 New FR30 — physical apparatus interaction and player-started experiments

> **FR30: [new — 2026-08-06]** Apparatus controls are direct-manipulation physical instruments —
> a knob, dial, or slider the player grasps and moves — whose travel is bounded by the authored range
> and whose value snaps to the authored step. The experiment does not run unattended: the light source
> is dark until the player starts it, the run animation plays through, and the measurement resolves
> from the deterministic model. Starting the light is the same act as running the experiment.

#### 4.1.3 Amend FR6

```
OLD:
FR6: Provide authored, bounded apparatus controls, never a freeform physics sandbox.

NEW:
FR6: Provide authored, bounded apparatus controls, never a freeform physics sandbox. Controls are
     operated by direct manipulation of a physical instrument in-scene (see FR30); bounds, steps, and
     validation remain authored and deterministic.
```

#### 4.1.4 Amend FR8

```
OLD:
FR8: Run the apparatus and present visual output; Young resolves within three seconds and resets
     immediately.

NEW:
FR8: Run the apparatus on an explicit player action that starts the light source, and present visual
     output; Young resolves within three seconds and resets immediately. The apparatus is visibly
     unlit and idle before the player starts a run.
```

#### 4.1.5 Amend the Epic 2 outcome statement

```
OLD:
Players can complete a 20–30 minute double-slit investigation: inspect context, make a prediction,
run experiments, compare measurements, issue a bounded conclusion, and receive a historical debrief.

NEW:
Players can complete a 20–30 minute double-slit investigation **entirely within the Phaser scenes**:
read the reference in the library, debate and choose a prediction with characters who are present
on-screen, operate physical instruments and start the light to run experiments, compare measurements,
issue a bounded conclusion, answer the rival lab, and receive a historical debrief. Every transition
between steps is reachable from the canvas, and no DOM panel remains in the play path.

**FRs covered:** FR1, FR2, FR4, FR7, FR8, FR10, FR13, FR16–FR18, FR24, FR25, FR30 (+ NFR20).
```

#### 4.1.6 Six new stories

---

##### Story 2.7: In-scene phase transitions and the adventure's forward path [new — 2026-08-06]

As a player,
I want to move to the next step of the investigation from the scene I am standing in,
So that the adventure flows without me leaving the Phaser view.

**Acceptance Criteria:**

**Given** the case is at any phase with a forward transition,
**When** the scene mirroring that phase renders,
**Then** a reusable Phaser advance affordance is present in-scene, labelled in the active locale with
what the player is moving *toward* in fiction (never a scene, phase, or route name — the `encodesPath`
rule),
**And** it dispatches only the typed action for that transition and never infers or advances the phase
itself.

**Given** the full Young flow,
**When** the player walks it from a cold boot using the canvas alone,
**Then** `context → prediction`, `prediction → experiment`, `experiment → synthesis`,
`synthesis → review`, `review → debrief`, and a post-debrief replay are each reachable,
**And** no DOM panel is touched at any point.

**Given** Story 2.6's `advanceToSynthesis` control in `ApparatusRenderer`,
**When** this story lands,
**Then** it is replaced by the reusable affordance with no loss of the significant-measure gate
behaviour or the colleague hint that answers a refusal,
**And** the hint and the transient error keep the *measured*, floor-anchored layout they have now.

**Given** a transition the store refuses,
**When** the refusal is a gate the player can act on (missing sources, missing significant measures),
**Then** the answer is the authored in-fiction colleague line for that gate, in the active locale,
**And** when it is anything else (for example the store short-circuiting during a progress export),
the answer is the localized error — never a raw error string, and never silence.

**Given** a transient refusal message,
**When** any later render occurs,
**Then** the message survives until a real state change replaces it,
**And** the same explicit lifetime applies in `ColleagueRenderer` and `ApparatusRenderer`, so the two
renderers do not disagree (closes the tracked `transientError` inconsistency).

**Given** the advance affordance,
**When** tests run,
**Then** unit tests cover the affordance's enabled/refused view resolution as a Phaser-free module in
the `sideColumnView` pattern,
**And** an integration test drives every transition through public store actions,
**And** an e2e test completes the Young case using canvas clicks only,
**And** `french-typography.spec.ts` asserts the whole French label fits the control at its authored
width — as a whole string, not token-by-token.

---

##### Story 2.8: Library scene — the reading room and the reference book [new — 2026-08-06]

As a player,
I want to enter a library, find the reference on the shelf, and pick it up to read it,
So that the case opens as a place I am in rather than a list of source cards.

**Acceptance Criteria:**

**Given** the `context` phase,
**When** `LibraryScene` activates,
**Then** it renders an authored reading room — shelving, a reading surface, and the case's contextual
artifacts as physical objects the player can approach — and no placeholder marker,
**And** `PhasePlaceholderScene` is no longer its base class.

**Given** a contextual artifact present in the room,
**When** the player picks it up,
**Then** the reference book opens on the existing `LectureBookRenderer` pagination without change to
its authored-page contract,
**And** the scene dispatches `source.inspected` for that artifact through the store adapter,
**And** re-opening an already-inspected artifact is a no-op success, never an error the surface must
explain away.

**Given** each artifact in the room,
**When** the player inspects it,
**Then** its title, creator or originating context, source type, provenance category, rights status,
and case relationship are readable in-scene as text,
**And** an artifact whose rights are unreviewed or whose rendition is missing gives a neutral in-scene
explanation and is never presented as verified evidence.

**Given** the case's required reading is incomplete,
**When** the player tries to leave the library,
**Then** a colleague names the missing artifact in-fiction in the active locale,
**And** all valid work is preserved with no hard fail.

**Given** the required reading is complete,
**When** the player leaves,
**Then** the Story 2.7 affordance dispatches `context → prediction`,
**And** the prediction cards in `ColleaguesScene` are live rather than refusing on
`missing-contextual-sources`.

**Given** the reference book is now owned by `LibraryScene`,
**When** this story lands,
**Then** the session-persistent `LectureBookScene` overlay and its
`(visible) => laboratoryScene.setApparatusInputEnabled(!visible)` scene-to-scene reach-in are retired
in favour of store-mediated presentation (closes the tracked Story 1.10 deferral),
**And** the session-wide `scroll` → `scale.updateBounds()` listener it owns is relocated to a scene
that always runs, or the sticky-canvas bounds go stale in every phase,
**And** the book stays reachable from the laboratory for re-reading during `experiment`.

**Given** the book's control geometry,
**When** this story lands,
**Then** the button width, the label shrink bound, and every test assertion read one exported
constant (closes the tracked four-way magic-number duplication),
**And** the `768` / `1024` design dimensions are read from `scene.scale`, not restated.

**Given** the library scene,
**When** tests run,
**Then** unit tests cover artifact-to-object placement geometry as a Phaser-free module,
**And** an integration test proves the pickup path records `source.inspected` and satisfies context
readiness through public actions,
**And** an e2e test reads both required Young artifacts and leaves the library using canvas clicks only,
**And** every new player-facing string is asserted present in EN **and** FR.

---

##### Story 2.9: Colleague and rival-lab characters on stage [new — 2026-08-06]

As a player,
I want to see the colleagues and the rival lab as characters in the room,
So that the investigation feels like a conversation with people rather than a wall of text.

**Acceptance Criteria:**

**Given** a case's `colleagues[]` with `portrait: { kind: 'silhouette', accentColor }`,
**When** a scene hosting dialogue renders,
**Then** a reusable staging renderer draws each present colleague as a vector silhouette figure built
from Phaser `Graphics` and the authored accent colour — **no image asset, no loader entry, no rights
ledger entry**,
**And** each figure carries its colleague's name and role in the active locale.

**Given** a dialogue beat attributed to a `speakerId`,
**When** the beat is shown,
**Then that** colleague's figure is visibly foregrounded and the others recede,
**And** the speaker is identified by position, scale, and label together — not by colour alone,
**And** the dialogue panel keeps its measured, unbounded-body layout so no beat can truncate.

**Given** the prediction and conclusion boards,
**When** the four proposals render,
**Then** each proposal is visually connected to its proposing colleague's figure,
**And** nothing in the staging can distinguish a defensible proposal from an indefensible one — the
renderer must not read the defensible set (ADR-006).

**Given** the rival lab,
**When** `RivalLabScene` presents a critique,
**Then** Mr. Arthur Bell is staged as a character with his authored accent, visually distinct from the
colleague cast,
**And** he is never rendered as a member of `colleagues[]`,
**And** the critique carries no score, timer, setback, or failure treatment.

**Given** authored story beats,
**When** a character enters, is addressed, or reacts,
**Then** the movement is restrained and short, and scientific legibility takes priority over the
motion,
**And** under `prefers-reduced-motion: reduce` no update loop registers and `render()` paints a static
staged frame.

**Given** the staging renderer,
**When** it is destroyed,
**Then** every figure, tween, timer, and listener it created is released — including tweens whose
target is the renderer itself.

**Given** character staging,
**When** tests run,
**Then** unit tests cover the stage-position and speaker-emphasis resolution as a Phaser-free module,
**And** an integration test proves a beat change re-stages the speaker,
**And** a test asserts the staging renderer cannot reach the defensible-conclusion set,
**And** the reduced-motion static frame is asserted.

---

##### Story 2.10: Physical apparatus instruments and the player-started light [new — 2026-08-06]

As a player,
I want to turn a real knob and then press to start the light,
So that setting up and running the experiment feels like operating an instrument.

**Acceptance Criteria:**

**Given** an authored `primaryControl` with a label, unit, range, and step,
**When** `LaboratoryScene` renders,
**Then** it draws a physical instrument — a knob or dial with a body, an indicator, and a travel arc
bounded by the authored range — with its current value and unit legible beside it,
**And** the `+` / `−` text buttons are replaced.

**Given** the player drags the knob,
**When** the drag moves,
**Then** the indicator follows the pointer within the bounded travel,
**And** the dispatched value snaps to the authored `step`, so an off-step value is never dispatched
and the domain normalization rule stays invisible,
**And** the value is dispatched through `apparatus.controlSet`; the renderer never mutates state.

**Given** the same control,
**When** the player uses the `◂ ▸` step affordances or arrow keys with the knob focused,
**Then** the value moves exactly one authored step,
**And** a pointer drag and a keyboard step to the same value produce an identical run record.

**Given** the apparatus at rest,
**When** no run has been started,
**Then** the source is **dark**, no wavefronts propagate, and no screen pattern is painted beyond a
static unlit screen,
**And** an in-scene line invites the player to start the light.

**Given** the player presses the start-the-light control,
**When** the run begins,
**Then** the source ignites, light propagates from source to slits to screen, the interference pattern
resolves on the screen, and the run completes within three seconds (FR8/NFR-perf),
**And** the scene dispatches `experiment.run` and the run is recorded through `run.record`,
**And** the recorded value comes from the deterministic model — never from anything the animation
computes.

**Given** a completed run,
**When** the player changes a control,
**Then** the readout marks the recorded result as stale against the new setup as it does today,
**And** the light returns to its unlit idle state until the player starts it again.

**Given** the optional advanced wavelength comparison,
**When** the player selects an authored wavelength in-scene,
**Then** `apparatus.wavelengthSet` is dispatched from the canvas,
**And** wavelength remains optional and cannot alter the fixed 550 nm minimum-path history.

**Given** the notebook,
**When** the player reviews or compares runs,
**Then** settings, values with units, timestamp/order, and observed result are readable in-scene,
and any two saved runs can be compared with a note saved,
**And** no saved run is ever recalculated against a newer model version.

**Given** `prefers-reduced-motion: reduce`,
**When** the player starts a run,
**Then** the result appears immediately as a static resolved frame with no propagation animation,
**And** the run is recorded identically.

**Given** the apparatus,
**When** tests run,
**Then** unit tests cover drag-angle → stepped-value conversion as a Phaser-free module, at both range
ends and across every step,
**And** unit tests assert the run value is model-derived and independent of animation state,
**And** an integration test proves start-the-light records a run through public actions,
**And** an e2e test records two significant Young measurements from the canvas alone,
**And** NFR1 is re-profiled at 1280×720 over a 10-minute lab loop with drag, staging, and propagation
all active.

---

##### Story 2.11: Debrief scene — historical comparison, recognition, and replay [new — 2026-08-06]

As a player,
I want to read how my bounded conclusion compares with the historical record and choose to replay,
So that the case closes with understanding rather than a placeholder.

**Acceptance Criteria:**

**Given** the `debrief` phase,
**When** `DebriefScene` activates,
**Then** it renders the authored sourced historical comparison and the optional deeper-theory layer
in-scene in the active locale, and no placeholder marker,
**And** `PhasePlaceholderScene` is no longer its base class — and, with `LibraryScene` converted in
2.8, the class itself is removed.

**Given** the debrief,
**When** it is read,
**Then** it never rewrites the historical outcome around the player's choice,
**And** provenance labels distinguish primary artifact, reconstruction, interpretation, and fiction.

**Given** the player's decision history including any rival-lab critique,
**When** the debrief renders,
**Then** the retained `critiqueHistory` is presented as inquiry rather than failure (closes the
tracked Story 2.5 deferral, whose stated owner is "whichever story builds the debrief surface"),
**And** recognition reflects replication, source checking, optional-variable testing, and bounded
claims — never speed, score, or perfect play, and it never gates completion.

**Given** the debrief is complete,
**When** the player chooses to finish or replay,
**Then** `case.debriefCompleted` and `case.replayStarted` are both dispatchable from the canvas,
**And** a replay preserves the completed historical record and campaign unlock state,
**And** counterfactual exploration is explicitly labelled distinct from the recorded historical result.

**Given** the debrief scene,
**When** tests run,
**Then** integration tests cover completion and replay through public store actions,
**And** an e2e test reaches the debrief and replays using canvas clicks only,
**And** every new player-facing string is asserted present in EN and FR.

---

##### Story 2.12: Retire the DOM presentation panels [new — 2026-08-06]

As a developer,
I want the retired DOM panels deleted,
So that one surface answers each player action and the pivot is actually complete.

**Acceptance Criteria:**

**Given** Stories 2.7 – 2.11 are done,
**When** every player intent is dispatchable from the canvas,
**Then** `src/ui/` retains only `print/CaseRecordPrintView.ts` (ADR-007), `BootShell.ts`, and
`ValidationSessionDisclosure.ts`,
**And** all thirteen other panel modules and their `index.html` roots are deleted,
**And** `npm run typecheck` proves no reachable code imports a deleted module.

**Given** the deletion,
**When** `src/main.ts` boots,
**Then** its boot guard requires only the roots that still exist,
**And** a missing required root **fails loudly** — a visible boot message and a dev-log line — rather
than silently leaving the page on static markup (closes the tracked silent-boot-guard item).

**Given** the pre-pivot free-text paths,
**When** the panels are deleted,
**Then** `prediction.recorded`, `theory.conclusionSet`, and `theory.limitationSet` are removed rather
than ported, since the 1-of-4 choices supersede them and leaving both live is the "free text must
clear the proposal ID" hazard,
**And** `CaseDefinition.version` is bumped and the record-compatibility allowlist is extended only
across versions whose canonical strings are verified byte-identical.

**Given** the e2e suite,
**When** the panels are gone,
**Then** every spec driving a deleted panel is rewritten against the canvas — including the ~6 specs
clicking the nonexistent `Record prepared observation` button and the run-experiment disabled-state
mismatch, both already failing on baseline,
**And** the validation-isolation spec keeps a real precondition: a non-panel progress-seeding path
replaces its reliance on `CaseProgressPanel`'s "Save progress" button,
**And** its assertions do not become trivially true on every route once the panel is absent,
**And** its IndexedDB probe reads the database name, version, and store name from exported adapter
constants rather than restating them.

**Given** the retired theory-board panel is gone,
**When** the significant-measure gate refuses,
**Then** exactly one surface answers, in the active locale, through
`error.significant-measures-required` (closes the tracked dual-answer defect).

**Given** narrow viewports,
**When** the advance affordance is suppressed below 768px,
**Then** the suppression is re-decided now that no DOM fallback exists — either the affordance stays
available or the narrow viewport is explicitly declared unsupported with a visible message
(resolves the tracked sub-768px item).

**Given** the retirement,
**When** verification runs,
**Then** `npm run typecheck`, `npm test`, and `npm run test:e2e` pass,
**And** the six known firefox/webkit baseline failures are either fixed or explicitly re-recorded as
owned, since Story 7.3 cannot mean anything until they are,
**And** offline reload still restores locally saved progress with no network.

---

#### 4.1.7 Superseded-implementation notes on two existing stories

Appended, not edited — the acceptance criteria were met.

> **Story 1.5 / Story 2.1 — implementation note (2026-08-06):** these stories' library acceptance
> criteria were satisfied by the DOM `CuratedRecord` panel plus a session-persistent
> `LectureBookScene` overlay, not by `LibraryScene`, which remained a placeholder. Story 2.8 delivers
> the canvas library and retires both. See `sprint-change-proposal-2026-08-06.md`.

> **Story 2.3 — implementation note (2026-08-06):** the debrief and replay criteria were satisfied by
> the DOM `HistoricalDebriefPanel`; `DebriefScene` remained a placeholder. Story 2.11 delivers the
> canvas debrief. See `sprint-change-proposal-2026-08-06.md`.

#### 4.1.8 FR Coverage Map additions

```
FR30: Epic 2 Story 2.10.
NFR20: Epic 2 Stories 2.7–2.12 (all six); enforced thereafter by project-context.md.
```

*Note:* the map's pre-existing stale entries (FR11, FR17, FR28, and a reference to a then-nonexistent
Story 1.10) remain tracked in `deferred-work.md` for a dedicated traceability pass. This change does
not widen that debt.

#### 4.1.9 Amend Story 3.4 (Epic 3)

> **Added to Story 3.4 — Scenario and proposal authoring contract:**
>
> **Given** a case authoring its cast and instruments,
> **When** the scenario contract is defined,
> **Then** `scenarioScript.scenes[]` may declare an optional `cast` — the colleague IDs present in
> that scene — defaulting to the full cast when absent,
> **And** an authored apparatus control may declare an optional affordance descriptor (`knob`,
> `dial`, `slider`) defaulting to `knob`,
> **And** both are additive and optional so existing content parses unchanged,
> **And** a case authors its characters and instruments without editing scene code.

---

### 4.2 `gdd.md`

#### 4.2.1 Controls and Input

```
OLD:
- Interactive controls live in the Phaser scene; each exposes its current value and units on-screen so
  the setting is always legible.

NEW:
- Interactive controls live in the Phaser scene as physical instruments — knobs, dials, and sliders the
  player grasps and moves directly — and each exposes its current value and units on-screen so the
  setting is always legible. Instrument travel is bounded by the authored range and snaps to the
  authored step, so direct manipulation never produces a value the case did not author.
- The experiment does not run unattended. The apparatus sits unlit and idle until the player starts
  the light; starting the light is the act of running the experiment, and the measurement resolves
  from the deterministic model rather than from anything the animation computes.
- Every step of the scenario is advanced from within the scene the player is standing in. No
  transition between steps lives outside the Phaser surface.
```

#### 4.2.2 Asset Requirements

```
OLD:
- Each case now also authors a **colleague cast**, a **scenario script** (scene order and dialogue
  beats), **four prediction proposals**, **four conclusion proposals** (each with a support rule), a
  **significance rule**, and **rival-lab critique lines**.

NEW:
- Each case now also authors a **colleague cast**, a **scenario script** (scene order, per-scene cast
  presence, and dialogue beats), **four prediction proposals**, **four conclusion proposals** (each
  with a support rule), a **significance rule**, and **rival-lab critique lines**.
- The cast ships **without commissioned art**. A colleague is staged as a vector silhouette drawn from
  an authored accent colour, so the cast carries no image asset, no loader budget, and no rights-ledger
  entry. Painted portrait art is a possible later enhancement, not a requirement for a case to ship.
```

#### 4.2.3 Out of Scope — bound the animation exclusion

```
OLD:
- Native mobile laboratory controls, localization **beyond English and French**, relativity/entanglement
  implementation in the first validation release, and high-fidelity full animation.

NEW:
- Native mobile laboratory controls, localization **beyond English and French**, relativity/entanglement
  implementation in the first validation release, and high-fidelity full animation — meaning
  cinematic cutscenes, full character animation rigs, and frame-by-frame art. It does **not** exclude
  direct-manipulation instrument controls, a player-started light source, or restrained character
  staging and reaction, all of which are required (see Controls and Input, and Art Style).
```

*No change to Art Style.* It already requires colleagues as "first-class on-screen characters …
present through portraits **or silhouettes**". Cited as the authority for Story 2.9 rather than
amended.

---

### 4.3 `game-architecture.md` (→ v1.2)

#### 4.3.1 User Interface and Rendering Boundary — add the completeness obligation

> **Appended:**
>
> **Surface completeness.** Being the sole surface is not the same as being a sufficient one. Every
> player intent required to reach a case conclusion must be dispatchable from the canvas. A feature
> whose only dispatcher is a non-Phaser surface is incomplete regardless of how well its store
> contract is tested — the store may be correct while the game is unplayable. The retained CSS
> print/export view is the one exemption and dispatches nothing. See ADR-011.

#### 4.3.2 Content Model — additive authoring fields

> **Appended to the pivot field list:**
>
> - `scenarioScript.scenes[].cast?` — the colleague IDs present in that scene, defaulting to the full
>   cast. Lets a case stage who is in the room without scene code.
> - `apparatus.primaryControls[].affordance?` — `knob` | `dial` | `slider`, defaulting to `knob`.
>   Selects the instrument the scene draws; the authored range, step, and validation are unchanged.
>
> Both are optional and additive, so existing case content parses unchanged. Adding them bumps
> `CaseDefinition.version`, and the record-compatibility allowlist is extended only across versions
> whose canonical strings are verified byte-identical.

#### 4.3.3 Decision Summary — amend the UI row

```
OLD:
| UI | Phaser scenes + renderer factories | Phaser 4.2.1 | Library, colleagues, lab, theory-board, and
  debrief scenes are the sole interactive surface; a CSS print view is the only DOM surface (record
  export) |

NEW:
| UI | Phaser scenes + renderer factories | Phaser 4.2.1 | Library, colleagues, lab, theory-board, and
  debrief scenes are the sole **and sufficient** interactive surface — every player intent is
  dispatchable from the canvas (ADR-011); a CSS print view is the only DOM surface (record export) |
```

#### 4.3.4 Two new ADRs

> **ADR-011 — Canvas intent completeness (new v1.2):** Every player intent required to complete a case
> must be dispatchable from the Phaser canvas; no non-Phaser surface may be the sole dispatcher of any
> intent. ADR-001 v1.1 established Phaser as the sole *presentation* surface but stated no
> completeness obligation, which allowed six stories to be verified complete while nine of fourteen
> player intents remained reachable only through DOM panels the pivot had retired. A story that
> introduces or gates an intent is not done until the canvas can issue it. The CSS print/export view
> (ADR-007) is the sole exemption and dispatches nothing.
>
> **ADR-012 — Direct-manipulation instruments over stepper controls (new v1.2):** Apparatus controls
> are drawn as physical instruments the player grasps and moves; drag input is converted to a value
> that snaps to the authored step before dispatch, so no off-step value ever reaches the store. This
> is an **input mapping, not physics** — ADR-004 stands unchanged and no Arcade or Matter body is
> introduced. Discrete step affordances and keyboard stepping remain alongside the drag so that
> pointer and keyboard produce identical run records. Corollary: the experiment run is
> player-initiated; the light source is dark and no propagation loop runs until the player starts it,
> which also removes a continuous idle animation cost from the NFR1 baseline.

---

### 4.4 `EXPERIENCE.md` — rework (blocking, no longer pending)

This spine has carried a "pending its full rework for the Phaser guided adventure" note since the
pivot. This change makes the rework blocking, because one section now states the opposite of the
requirement.

#### 4.4.1 HUD & Diegetic UI — replace the section

```
OLD:
The apparatus visualisation is an explanatory laboratory object, not an authoritative UI layer. It may
communicate the physical setup and outcome, but controls, measurement values, instructions, and
conclusions remain non-diegetic semantic UI. No combat-style persistent HUD is assumed.

The historical atmosphere lives in the instrument field, archival materials, and restrained team
silhouettes. It never turns team presence into a required UI interaction or hides analytical
information in-world.

NEW:
The scene *is* the interface. Controls, measurement values, instructions, source records, dialogue,
and the conclusion choice are all diegetic and in-canvas: the player turns a knob on an instrument,
starts a light, picks a book off a shelf, and hears a colleague standing in the room. No non-diegetic
semantic UI layer mirrors any of it. No combat-style persistent HUD is assumed.

Diegetic never means hidden. Every value carries its unit as legible text beside the object it belongs
to; every instrument shows its current setting; every gate that refuses says why, in fiction, in the
player's language. An in-world affordance that a player cannot find, read, or understand has failed —
scientific legibility outranks atmosphere every time they conflict.

The historical atmosphere lives in the instrument field, the archival materials, and the staged
characters. Character presence is required interaction — a colleague voices a proposal the player must
choose between, and the rival lab challenges a claim — but it never conceals analytical information
in-world or makes a required value reachable only through a conversation.
```

#### 4.4.2 Component Patterns — replace three rows

```
OLD:
| Apparatus control | Every visual gesture has a labelled semantic control and a keyboard-adjustable
  alternative. Current value, units, valid range, and state change are exposed; keyboard focus uses
  {colors.focus}. |

NEW:
| Apparatus instrument | A physical knob, dial, or slider in-scene. Drag travel is bounded by the
  authored range and snaps to the authored step; discrete step affordances and arrow keys move exactly
  one step, and both paths produce an identical run record. Current value, units, and valid range are
  legible beside the instrument. |
```

```
OLD:
| Experiment result | Visual output is paired with readable values, labels, and an explanation of the
  model's assumptions. The {colors.signal} pattern is never its only meaning carrier. |

NEW:
| Experiment run | The apparatus is unlit and idle until the player starts the light; starting it is
  the run. Visual output is paired with readable values, labels, and an explanation of the model's
  assumptions. The measurement resolves from the deterministic model, never from the animation. Under
  reduced motion the resolved frame appears immediately and the record is identical. |
```

```
NEW ROW:
| Character on stage | A colleague or the rival lab, staged as a vector silhouette from the authored
  accent colour. The current speaker is foregrounded by position, scale, and label together. Movement
  is short and restrained and never competes with the reading. Nothing about the staging can reveal
  which conclusion the evidence defends. |
```

```
NEW ROW:
| Step advance | One in-scene affordance per forward transition, labelled with what the player is
  moving toward in fiction — never a scene, phase, or route name. A refusal it cannot satisfy is
  answered by the authored colleague line for that gate; any other refusal by the localized error.
  Never silent, never a raw error. |
```

#### 4.4.3 Accessibility Floor and Interaction Primitives

Rewrite both against ADR-008: mouse/keyboard primary through the canvas, touch secondary; retain
`prefers-reduced-motion`, no-flashing safety, and the EN+FR requirement (both current and both
non-negotiable); remove the semantic-HTML, screen-reader, and WCAG-AA acceptance language as
de-scoped-not-wrong, with a pointer to ADR-008 for the post-MVP reintroduction path.

#### 4.4.4 Key Flows — rewrite "Leo investigates a Young interference claim"

Rewrite as a canvas-only walkthrough: Leo enters the library, takes the reference off the shelf and
reads two artifacts, leaves the library, hears four colleagues propose predictions and picks one,
turns the slit-spacing knob and starts the light, records a second differing measurement, is nudged by
a colleague when he tries to leave early, chooses a conclusion at the board, is challenged by Bell,
revises, and reads the debrief. Not one DOM interaction in the flow.

#### 4.4.5 Foundation and Information Architecture

Remove the retired dual-surface sentence ("Phaser renders the visual laboratory, while semantic HTML
owns essential controls…"). Replace the mockup pointers — `curated-record.html`,
`measurement-notebook.html`, `theory-board.html` — with a note that they document the retired DOM
model and are retained for historical reference only, superseded by the scene renderers.

Remove the "pending rework" note once the above is applied.

---

### 4.5 `project-context.md` (→ revision 2.1)

#### 4.5.1 New rules — Engine-Specific section

```
NEW:
- **Canvas completeness (ADR-011): a feature is not done until the canvas can dispatch its intent.**
  Before marking any story complete, grep for every dispatcher of every action it touches. If the only
  dispatcher is under `src/ui/`, the story is unfinished no matter how green its unit tests are — this
  is exactly how nine of fourteen player intents ended up reachable only from retired panels. The one
  exemption is `CaseRecordPrintView`, which dispatches nothing.
- **The apparatus is unlit until the player starts it.** No animation loop may register from `create()`
  for the experiment's light. `syncAnimationLoop`-style gating gates on a player-initiated run, not on
  scene lifecycle. Idle animation that nobody asked for is both a design defect and an NFR1 cost.
- **Drag input snaps to the authored step before dispatch.** Convert pointer travel to a stepped value
  in a Phaser-free module and unit-test it at both range ends. Never dispatch a raw drag value and let
  the domain normalize it — that makes the normalization rule visible as the value jumping under the
  cursor.
- **Character staging must not be able to read the defensible set.** A staging renderer gets the cast,
  the speaker, and the accent colour. Nothing more. Same rule as `ColleagueRenderer`, and for the same
  reason (ADR-006).
```

#### 4.5.2 New rule — Guided-Adventure section

```
NEW:
- **Every forward transition has an in-scene affordance.** The scenario advances from the scene the
  player is standing in. A transition reachable only from outside the canvas does not exist. The
  affordance's label names what the player is moving toward in fiction, never a scene, phase, or route
  (the `encodesPath` check).
```

#### 4.5.3 Two new Critical Don't-Miss rows

```
| Ship a feature whose only dispatcher is under src/ui/ | The store is correct and the game is
  unplayable — this caused the 2026-08-06 correction | Engine |
| Register an animation loop for the experiment's light in create() | The light runs unattended and
  costs NFR1 budget for nothing | Engine |
```

#### 4.5.4 Amend the retired-panel rule

```
OLD:
- `src/ui/*` interactive panels are **retired but still mounted** by `src/main.ts`. Do not extend,
  restyle, or add to them — build the feature as a scene/renderer and let the panel be superseded.

NEW:
- `src/ui/*` interactive panels are **retired and being deleted** by Story 2.12. Do not extend,
  restyle, or add to them, and do not treat one as a working fallback — until 2.12 lands they are the
  sole dispatcher for several intents, which is the defect, not the design.
```

#### 4.5.5 Amend the `PhasePlaceholderScene` note

Once Stories 2.8 and 2.11 land, `PhasePlaceholderScene` has no subclasses and is deleted. Add a rule
that a new scene must never be introduced as a placeholder subclass without an owning story that
replaces it in the same epic.

---

### 4.6 `sprint-status.yaml`

```
OLD:
  epic-2: in-progress
  ...
  2-6-significant-measure-gate-and-colleague-hints: done  # new (pivot); implemented + reviewed …
  epic-2-retrospective: optional

NEW:
  epic-2: in-progress  # reopened 2026-08-06 by sprint-change-proposal-2026-08-06.md
  ...
  2-6-significant-measure-gate-and-colleague-hints: done  # new (pivot); implemented + reviewed …
  # ---- Added 2026-08-06 (playable-Phaser-surface correction). Build 2.7 first: it delivers the
  # reusable advance affordance 2.8/2.10/2.11 consume. 2.12 strictly last.
  2-7-in-scene-phase-transitions: backlog  # new; unblocks every story below
  2-8-library-reading-room-and-reference-book: backlog  # new; retires LectureBookScene overlay
  2-9-colleague-and-rival-lab-characters: backlog  # new; coded vector silhouettes, no art assets
  2-10-physical-apparatus-and-player-started-light: backlog  # new; knob drag + start-the-light
  2-11-debrief-scene-and-replay: backlog  # new; retires the last PhasePlaceholderScene
  2-12-retire-dom-presentation-panels: backlog  # new; LAST — requires 2.7–2.11 done
  epic-2-retrospective: optional
```

Also update the header block:

```
NEW HEADER NOTE:
# ============================================================================
# SPRINT CHANGE (approved 2026-08-06): Playable Phaser surface.
# See planning-artifacts/sprint-change-proposal-2026-08-06.md
# - Epic 2 reopened: Stories 2.7–2.12 added. No story rolled back.
# - Cause: nine of fourteen player intents were dispatchable only from the
#   retired src/ui/* DOM panels. New NFR20 (canvas intent completeness) and
#   ADR-011 prevent recurrence.
# - Decisions: coded vector silhouettes for the cast (no art assets); knob drag
#   plus discrete steps; full scope including Debrief and panel retirement.
# - Story 2.4's release gate stays Blocked until 2.12 ships.
# ============================================================================
```

---

## 5. Implementation Handoff

### Scope classification: **Moderate**

Backlog reorganization plus artifact amendments. Not Minor — six new stories, two new ADRs, a new NFR
and FR, and a UX spine rework are beyond direct implementation. Not Major — no re-architecture, no
rollback, no MVP redefinition; the store, domain, evaluator, and persistence layers are untouched.

### Routing

| Recipient | Responsibility |
|---|---|
| **Developer (Link Freeman)** — primary | Apply every §4 edit. Then `gds-create-story` for 2.7 and implement in sequence. Owns the six stories and the eight deferred items they close. |
| **Game Designer (Samus Shepard)** | Confirm the GDD §4.2 amendments — especially the Out of Scope boundary. Author the per-scene cast presence and the colleague reaction/entrance beats for the Young case. |
| **Game Architect (Cloud Dragonborn)** | Confirm ADR-011 and ADR-012 and the architecture bump to v1.2. Confirm the optional `cast` / `affordance` content fields before 2.10 needs them. |
| **UX Designer (Sally)** | Own the `EXPERIENCE.md` rework (§4.4). Blocking for 2.8 and 2.10 — the diegetic contradiction must be resolved before those renderers are designed. |
| **Release owner** | Note that the 2.4 gate stays `Blocked` until 2.12. Do not schedule moderated sessions before then. |

### Success criteria

1. A player completes the Young case from a cold boot **using only the Phaser canvas** — verified by
   an e2e spec that touches no DOM control.
2. `src/ui/` contains only `print/CaseRecordPrintView.ts`, `BootShell.ts`, and
   `ValidationSessionDisclosure.ts`.
3. No `PhasePlaceholderScene` remains; the class is deleted.
4. `grep -rn "store.dispatch" src/ui/` returns nothing.
5. Every new player-facing string exists in EN and FR, asserted by test — the project's most-repeated
   defect.
6. NFR1 re-profiled at 1280×720 over a 10-minute lab loop with knob drag, character staging, and
   propagation all active.
7. `npm run typecheck`, `npm test`, and `npm run test:e2e` pass; the six known firefox/webkit baseline
   failures are fixed or explicitly re-owned.
8. Story 2.4's gate is runnable — every blocking non-accessibility precondition is satisfiable.
9. The eight named `deferred-work.md` items are closed and removed from that file.

### Explicitly out of scope

- Painted portrait art (D1 — reconsider in Epic 3 alongside the source/rights ledger).
- Reintroducing accessibility as a gate (ADR-008 stands).
- Audio (FR28) — unchanged and unaddressed here.
- The `epics.md` FR-coverage-map traceability pass (stays deferred).
- The production offline-readiness pre-cache race (stays deferred; unrelated).

---

## Approval

- [ ] Alexis approves this Sprint Change Proposal for implementation.

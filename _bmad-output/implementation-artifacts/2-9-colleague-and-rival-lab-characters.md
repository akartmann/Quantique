---
baseline_commit: 10a90af194d1594b63e375f3eee4a09e8dc58b2d
---

# Story 2.9: Colleague and rival-lab characters on stage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see the colleagues and the rival lab as characters in the room,
so that the investigation feels like a conversation with people rather than a wall of text.

## Acceptance Criteria

**AC1 — The cast is drawn from case data, with no asset**

**Given** a case's `colleagues[]` with `portrait: { kind: 'silhouette', accentColor }`,
**When** a scene hosting dialogue renders,
**Then** a reusable staging renderer draws each present colleague as a vector silhouette figure built from Phaser `Graphics` and the authored accent colour — **no image asset, no loader entry, no rights-ledger entry**,
**And** each figure carries its colleague's name and role in the active locale.

**AC2 — The speaker is foregrounded**

**Given** a dialogue beat attributed to a `speakerId`,
**When** the beat is shown,
**Then** that colleague's figure is visibly foregrounded and the others recede,
**And** the speaker is identified by position, scale, and label together — not by colour alone,
**And** the dialogue panel keeps its measured, unbounded-body layout so no beat can truncate.

**AC3 — Proposals connect to their proposer, and reveal nothing**

**Given** the prediction and conclusion boards,
**When** the four proposals render,
**Then** each proposal is visually connected to its proposing colleague's figure,
**And** nothing in the staging can distinguish a defensible proposal from an indefensible one — the renderer must not read the defensible set (ADR-006).

**AC4 — Mr. Arthur Bell is staged, and is not one of the cast**

**Given** the rival lab,
**When** `RivalLabScene` presents a critique,
**Then** Mr. Arthur Bell is staged as a character with his authored accent, visually distinct from the colleague cast,
**And** he is never rendered as a member of `colleagues[]`,
**And** the critique carries no score, timer, setback, or failure treatment.

**AC5 — Restrained motion, and none at all under `reduce`**

**Given** authored story beats,
**When** a character enters, is addressed, or reacts,
**Then** the movement is restrained and short, and scientific legibility takes priority over the motion,
**And** under `prefers-reduced-motion: reduce` no update loop registers and `render()` paints a static staged frame.

**AC6 — Full release on destroy**

**Given** the staging renderer,
**When** it is destroyed,
**Then** every figure, tween, timer, and listener it created is released — including tweens whose target is the renderer itself.

**AC7 — Tests**

**Given** character staging,
**When** tests run,
**Then** unit tests cover the stage-position and speaker-emphasis resolution as a Phaser-free module,
**And** an integration test proves a beat change re-stages the speaker,
**And** a test asserts the staging renderer cannot reach the defensible-conclusion set,
**And** the reduced-motion static frame is asserted.

## Tasks / Subtasks

- [x] **Task 1 — Carry the speaker's identity to the surface (AC2)**
  - [x] `src/core/store/selectors.ts`: add `speakerId: beat.speakerId` to `DialogueBeatProjection`. Keep `speaker` (the formatted attribution) exactly as it is — `DialogueBox` and `formatAttribution` both depend on it. **This is the load-bearing change of the story:** the projection today drops the `colleagueId` and keeps only the formatted string, so there is no way to know *whose* figure to foreground. Do not try to reverse-match the formatted string to a cast member.
  - [x] `src/adapters/phaser/ui/DialogueBox.ts`: add `speakerId: string` to `DialogueBeatView` (it is documented as structurally `DialogueBeatProjection`; keep them matched), and expose the reading position so the owner can resolve the current speaker — `public getCurrentBeat(): DialogueBeatView | undefined`. It joins `getBottomY()` and `isComplete()` as an accessor; **do not** make the widget aware of the stage, the cast, or the store.
  - [x] Verify the beat index is readable at the two moments the owner needs it: after `render()` (index 0 on a new conversation, clamped otherwise) and inside the existing `onAdvance` callback. `ColleagueRenderer.relayoutCards()` is already the `onAdvance` handler — re-stage from there.
  - [x] A `speakerId` absent from `colleagues[]` (degraded cached `case.json`) must foreground nothing and throw nothing. `projectAttribution` already handles the label side via `colleague.unattributedSpeaker`.

- [x] **Task 2 — The Phaser-free staging resolver (AC1, AC2, AC3, AC7)**
  - [x] New `src/adapters/phaser/renderers/characterStageView.ts`, following `advanceView.ts` exactly: pure, no Phaser value import, no selectors import, no store import. It is what the unit tests drive.
  - [x] Input: the already-resolved cast (`{ colleagueId, accentColor, name, roleLabel }[]` — resolved strings, never `LocalizedText`), the current `speakerColleagueId | undefined`, the row bands to stage into, the column geometry, and `motionAllowed`.
  - [x] Output per figure: `{ colleagueId, x, y, width, height, scale, alpha, isSpeaker }`, plus the emphasis targets the renderer tweens toward. Freeze the result (`Object.freeze`) as every other projection here does.
  - [x] Export every geometry constant. **Nothing in this module may accept, return, or reference a defensibility field** — that is what AC3 and ADR-006 pin, and Task 7's source-level test enforces it.
  - [x] Positions are **total over the row count**: given N rows, every row gets a figure band, so a coordinate derived for four never lands in a gap at three. `libraryArtifactCentre` is the precedent.

- [x] **Task 3 — The staging renderer (AC1, AC5, AC6)**
  - [x] New `src/adapters/phaser/renderers/CharacterStage.ts` on the standard renderer contract: `create()` / `render(state)` / `destroy()`.
  - [x] `create()`: one `Graphics` silhouette per figure plus its name/role label, **drawn once**. Flat display objects, not a `Container` (see `DialogueBox`'s docstring for why). Text created empty; every string written in `render(state)` through `createTranslator(locale)` — never in `create()`.
  - [x] Draw the silhouette with fill commands only (head, shoulders, torso taper) tinted from the authored accent. Never re-stroke per frame: emphasis is applied with `setScale` / `setAlpha` / position, which reuse the existing geometry. No `loader` entry, no texture, no `assets.entries` addition.
  - [x] Emphasis: `motionAllowed` → one short tween (≈160–200 ms, `Cubic.easeOut`) on scale/alpha/x. `reduce` → apply the target values immediately, register **no** update loop, start **no** tween. Subscribe to `window.matchMedia('(prefers-reduced-motion: reduce)')` and its `change` event; `ApparatusRenderer.ts:168-205` is the reference for the cached flag plus the `change` handler.
  - [x] `destroy()`: remove the media-query listener, `scene.tweens.killTweensOf(this)` **and** `killTweensOf` every figure object, destroy all display objects, clear the arrays. The `targets: this` case is called out in AC6 and in the renderer contract because it is the one the codebase has already been bitten by.
  - [x] No `update()` loop under any condition — tweens only. That is what makes AC5's "no update loop registers" true by construction rather than by a flag.

- [x] **Task 4 — Stage the boards (AC1, AC2, AC3)**
  - [x] `ColleagueRenderer` owns one `CharacterStage`, constructed in `create()` and destroyed in `destroy()` alongside `dialogueBox` and `advanceControl` (it owns its own objects, so it is deliberately **not** pushed onto `this.objects` — follow the `AdvanceControl` precedent at line 276).
  - [x] Reserve a **left figure column** inside the proposal band. Each figure occupies the row of the card whose proposal that colleague authored, so the connection in AC3 is adjacency plus a shared accent plus a shared name. **Row order is proposal order, not cast order** — the two differ: prediction is `thea, elias, marianne, samuel`; conclusion is `marianne, elias, thea, samuel`.
  - [x] `ProposalChoice` gains two options with exported defaults so the board can reserve the column without the widget knowing why: `contentInset` (today's `TEXT_LEFT_OFFSET = 26`) and `markerGutter` (today's `MARKER_GUTTER = 200`). `proposalTextWrapWidth` takes them rather than restating them. Do not fork the widget.
  - [x] **`proposalTextWrapWidth` is imported by `tests/e2e/french-typography.spec.ts`.** Widening its signature ripples there: the spec must pass the values the *board* passes, not the widget's defaults, or it measures a rectangle that is never painted and keeps passing through exactly the truncation it exists to catch. That failure mode is recorded verbatim in `ColleagueRenderer.ts:70-81` about `SUBMIT_WIDTH` vs `ADVANCE_CONTROL_WIDTH` — the cheapest guard is to export the board's resolved bound as a named function and have both read it.
  - [x] Re-stage on `render()` **and** on the dialogue advance (`relayoutCards`), because the card bands move with the panel's measured height and the speaker changes without any state change.
  - [x] **Figures are never interactive.** Do not call `setInteractive` on a figure, its label, or any backing shape. Phaser draws in creation order and hit-tests topmost-first, so an interactive object over a card would swallow the click that chooses that proposal — an inert card with a live hand cursor, which is the exact defect class the 1.12 review found in `DialogueBox`.
  - [x] **Create the stage before the cards**, so a figure can never paint over card text even if a future geometry change makes the column and the card overlap. The column is reserved, so this should be belt-and-braces — write it down as the reason, since creation order is the only depth mechanism these renderers use.
  - [x] **Read the width budget below before choosing a single number.** Getting this wrong truncates authored claims silently.

- [x] **Task 5 — Stage Mr. Arthur Bell (AC4)**
  - [x] `RivalLabRenderer` reserves a right-hand stage column and narrows its prose by passing the reduced width to the existing `rivalLabTextWrapWidth(width)` helper — which already takes a width, so no new restatement.
  - [x] Stage Bell through a **distinct input path**, not through the cast array: `selectLocalizedRivalLabCritique` already returns `{ speaker, line, accentColor }` and carries no defensibility field. He must never be pushed into `colleagues[]`, never resolved through `selectColleagueById`, and never counted by anything iterating the cast.
  - [x] Make him visually distinct as a *silhouette*, not as a colour: a different build (taller, frock coat, hat brim) and a plinth or lectern. His accent is the authored `#8c3b3b`. Colour alone is explicitly insufficient (AC2's rule applies to the whole surface).
  - [x] No score, timer, counter, setback, red failure treatment, or shake. The one control stays the floor-anchored revise control, unchanged.
  - [x] Vertical space is available here: the body is unbounded prose and the guide is clamped above a floor-anchored control, so narrowing the wrap costs height that the existing clamp already absorbs. Do not anchor Bell to the prose's measured bottom — anchor him to the canvas, for the same reason the revise control is.
  - [x] **Decide the 8px accent stripe explicitly.** `RivalLabRenderer` already draws a full-height accent rectangle in Bell's colour (`:98`, `:191-192`). Once he is a figure, keep it as a framing device *or* retire it — but say which and why in Completion Notes. Leaving two unrelated things carrying the same colour for no stated reason is what the reviews keep finding.

- [x] **Task 6 — Locales (AC1, AC2)**
  - [x] Every new player-facing string goes in **both** `src/core/i18n/locales/en.ts` and `fr.ts` in the same edit. The figure label reuses `colleague.attribution` / `colleague.role.*` / `rivalLab.role` — do not author a second attribution format.
  - [x] Add a small speaking marker for the foregrounded figure (suggested key `stage.speaking`) so AC2's "label" is a real label rather than the dialogue panel's speaker slot doing double duty. Keep it short: it sits in a fixed-width column and the French must fit on one line.
  - [x] ~~**No `case.json` change and no `CaseDefinition.version` bump.**~~ **Superseded by the design revision of 2026-08-07 and the review that followed.** The second revision added the optional authored `figure` vocabulary, which is a `case.json` change and a schema change — additive, every field optional, and covered by Change Log 1.3. The review then bumped `1.13.0 → 1.14.0`, because two different file contents both claiming one version defeat the only job `caseDefinitionVersion` has. `scenarioScript.scenes[].cast?` was **not** added and still belongs to Story 3.4.

- [x] **Task 7 — Tests (AC7)**
  - [x] `tests/unit/CharacterStageView.test.ts`: stage positions at 3 and 4 rows and at two canvas sizes (so a memorised dimension fails); speaker emphasis; no speaker; a `speakerId` not in the cast; the `motionAllowed` split.
  - [x] `tests/unit/CharacterStageView.test.ts` (or a sibling): the **ADR-006 reachability test**. Read `characterStageView.ts` and `CharacterStage.ts` with `readFileSync` and assert neither mentions `selectDefensibleConclusionProposalIds`, `selectDefensibleConclusionIds`, `supportPredicate`, or `defensible`. `tests/e2e/canvasHelpers.ts` is the precedent for reading a project file inside a test. An argument in a comment is not an assertion.
  - [x] The **reduced-motion assertion**: inject the structural slice (`{ tweens: { add, killTweensOf } }`, `{ add: { graphics, text } }`) rather than a real `Phaser.Game` — `SceneRouterTarget` is the reference pattern. Assert `tweens.add` is never called under `reduce`, and that the final scale/alpha/position match the motion path's targets.
  - [x] `tests/integration/CharacterStaging.test.ts`: build the store from the authored Young case (as `RivalLabCritique.test.ts` does), and prove through public actions and selectors that (a) `selectDialogueBeats` carries `speakerId` for every beat in `prediction`, `synthesis`, and `review`, and that the phase transitions swap the conversation; (b) resolving the stage at successive reading positions foregrounds successively different colleagues, for a conversation whose speakers actually differ (`prediction` and `synthesis` each have three distinct speakers); (c) the accents come from `portrait.accentColor`. **Be honest about the seam:** the reading position is widget-local and is deliberately *not* in the store, so no public action can move it — the test drives the store for the beats and the resolver for the position, and asserts the pair. Do not add an `AppState` beat-index field to make a test easier; that contradicts `DialogueBox`'s stated contract and would have to be cleared on every phase move and replay.
  - [x] `tests/e2e/french-typography.spec.ts`: update `CARD_TEXT_WRAP_WIDTH` to the new derived bound, add the narrowed marker wrap and any new fixed-height label to the **whole-string** `FIXED_HEIGHT_CONTROLS` sweep, and **add the truncation guard**: the longest French proposal text and conclusion claim must still wrap to no more than `BODY_MAX_LINES` lines at the new wrap. A per-token sweep provably cannot catch this. `BODY_MAX_LINES` must be exported so the spec reads it rather than restating `2`.
  - [x] `tests/unit/DialogueBox.test.ts:119` builds its beats through a `beats(...ids)` helper — extend the fixture with `speakerId` and add coverage for `getCurrentBeat()` across a conversation change (index resets) and a shorter list (the defensive clamp). `tests/unit/DialogueBeats.test.ts` covers the projection side.
  - [x] Check `tests/e2e/dialogue-advance.spec.ts` and `canvas-transitions.spec.ts` still land inside the cards: `lastProposalCardProbe` uses the band's centre x, which the figure column shifts content within but does not move — verify rather than assume.

- [x] **Task 8 — Verify (AC5, AC6, and the standing gates)**
  - [x] `npm run typecheck`, `npm test`, `npm run test:e2e`. **Measure your own baseline first** and compare failure *names*, not counts — see §Baseline below.
  - [x] Manual check at 1280×720 in **EN and FR**: figures legible, no label truncated, no figure painted over card text or the advance control, Bell distinct from the cast, and under `prefers-reduced-motion: reduce` the boards paint a static staged frame with no tween.
  - [x] Confirm by grep that `CharacterStage` registers no `scene.events.on('update')` and that `destroy()` removes the media listener and kills `targets: this` tweens.
  - [x] NFR1 spot check only. The full 10-minute re-profile at 1280×720 with drag, staging, and propagation together is **Story 2.10's AC**, not this one — but note if staging visibly costs frames.

## Dev Notes

### Scope boundary — read this first

**In scope:** the `speakerId` projection, a `DialogueBox` reading-position accessor, one Phaser-free staging resolver, one staging renderer, the figure column on both proposal boards, Bell on the rival-lab stage, the two locale files, and the tests.

**Explicitly not in scope:**

- **The library and the laboratory.** Colleague *hints* there (`LibraryRenderer`'s gate line, `ApparatusRenderer`'s hint panel) are attributed text, not dialogue beats. `scenarioScript` authors beats only for `prediction`, `synthesis`, and `review`. Do not stage figures at the bench — it collides with Story 2.10's apparatus work and adds NFR1 cost in the one scene that already has an animation loop.
- **`DebriefScene`** — Story 2.11. It authors no beats and stays a `PhasePlaceholderScene` until then.
- **The knob, the player-started light, `experiment.run`, `run.record`, the in-scene notebook** — Story 2.10.
- **Deleting, restyling, or extending any `src/ui/*` panel** — Story 2.12.
- **`scenarioScript.scenes[].cast?`** — Story 3.4 owns that field (`sprint-change-proposal-2026-08-06.md` §2.1 and §4.3.2). Derive presence instead; see D2.
- **Any new store field or persisted state.** The reading position stays ephemeral and widget-local, exactly as it is today.
- **Commissioned portrait art, an `asset` portrait path, or any `assets.entries` addition.** D1 of the sprint change scoped character representation *down* to coded silhouettes on purpose.
- **Re-deciding the sub-768px suppression** — Story 2.12.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

**D1 — The figures live in a left column of the proposal band, one per card row.** AC3 wants each proposal "visually connected to its proposing colleague's figure", and the UX component row asks for the speaker "foregrounded by position, scale, and label together". A separate group stage *above* the cards is the obvious reading and it is the one thing the surface cannot afford: vertical space on both boards is already exhausted (see §The width and height budget). A column costs width, of which there is some, and adjacency gives the connection for free. Row order follows the proposals, so a colleague stands beside their own draft.

**D2 — "Present" is derived, not authored.** Until Story 3.4 ships `scenarioScript.scenes[].cast?`, the present set is: the colleagues who author the proposals on this board, unioned with the beat speakers of the live phase, defaulting to the full cast. For the shipped Young case all three are the same four people, so this is not observable today — write it as a small pure function anyway, so 3.4 replaces one call rather than hunting a rule spread across two renderers.

**D3 — Bell is staged through the critique projection, never through the cast.** `selectLocalizedRivalLabCritique` already returns exactly what a figure needs (`speaker`, `line`, `accentColor`) and carries no defensibility field by construction. Reusing the cast path would make him a member of `colleagues[]` in the one place it matters — the thing AC4 forbids and `project-context.md` restates. Share the *silhouette drawing* if you like; do not share the input path.

**D4 — Motion is tweens only, no update loop, ever.** AC5 asks that no update loop register under `reduce`. The cheapest correct way to satisfy that is to need no loop in either case: emphasis is a short tween on scale/alpha/x, and under `reduce` the target values are applied directly. `ReadingRoomDecor` took the same position for the same reason and says so in its docstring.

**D5 — One `Graphics` per figure, drawn once in `create()`.** The sprint change's own risk table commits to this: "Silhouettes are pre-rendered to a texture once, not re-stroked per frame." Scaling and fading reuse existing geometry, so a redraw is never needed. Do **not** regenerate `Graphics` in `render()`, and do not add a `generateTexture` path — there is no precedent for one in this codebase and `ReadingRoomDecor` proves fill commands drawn once are enough.

### Read before editing — current behaviour that must survive

| Path | What it does today | Your change boundary |
| --- | --- | --- |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts` (510 lines) | Hosts both boards. Owns heading, guide, the `TransientMessageSlot`, the submit control (conclusion only), the `AdvanceControl`, the `DialogueBox`, and four `ProposalChoice` cards. `accentOf` already parses `portrait.accentColor` with a `NEUTRAL_ACCENT` fallback for an `asset` portrait. `cardGeometry` **clamps** the cards' top: "overlap beats absence". `dialogueTop()` measures against the guide *and* the control column. | Add the stage; reserve the column; re-stage on render and on advance. **Do not** touch the clamp, the measured `dialogueTop`, or the transient-message lifetime. Reuse `accentOf` rather than writing a second colour parse. |
| `src/adapters/phaser/ui/ProposalChoice.ts` (213 lines) | `ACCENT_WIDTH 8`, `TEXT_LEFT_OFFSET 26`, `MARKER_GUTTER 200`, `MARKER_WRAP 160`, `BODY_MAX_LINES 2`, `LIMITATION_MAX_LINES 2`. `resizeHitArea()` writes hit-area geometry directly because `setInteractive` a second time only re-enables. | Add `contentInset` / `markerGutter` options with today's values as defaults. **`BODY_MAX_LINES` stays 2** — the docstring explains that 3 overflows onto the next colleague's card. Keep `resizeHitArea`. |
| `src/adapters/phaser/ui/DialogueBox.ts` (327 lines) | Store-agnostic. `conversationId` (the phase) is what makes `render` idempotent — **not** the beat ids, which the schema lets repeat across scenes. Body is unbounded with no `maxLines`. `completed` is separately observable from `isLast`. | Add `speakerId` to the view type and one accessor. **Do not** derive the conversation id from the beats, add `maxLines` to the body, or let the widget see the store. |
| `src/adapters/phaser/renderers/RivalLabRenderer.ts` (211 lines) | Reads exactly one projection. Prose stacks against measured neighbours; the revise control is floor-anchored **deliberately**, and the guide is clamped just above it because it doubles as the refusal slot. `transientError` is a bare field, cleared in the render that draws it. | Reserve the right column and pass the narrowed width. **Do not** move the revise control off the floor or unclamp the guide. Leaving the bare `transientError` field as-is is acceptable; converting it to `TransientMessageSlot` is out of scope. |
| `src/core/store/selectors.ts` `selectDialogueBeats` (`:255`) | Keyed on **phase**, not scene key, because `TheoryBoard` hosts `synthesis` and `review`. Returns frozen projections; `NO_DIALOGUE_BEATS` for a scene with no conversation. | Add `speakerId`. Keep the freeze, the phase keying, and the empty-array sentinel. |
| `src/core/store/selectors.ts` `selectDefensibleConclusionProposalIds` (`:181`) | The defensible set, for the evaluator and the critique only. | **Never imported by anything you write.** Task 7 asserts this at source level. |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts` `:168-205, :268-280` | The reduced-motion reference: cached flag, `change` listener, `syncAnimationLoop`, and a `destroy` that kills `targets: this` tweens. | **Untouched.** Copy the pattern, do not import from it. |
| `src/adapters/phaser/scenes/{ColleaguesScene,TheoryBoardScene,RivalLabScene}.ts` | Identical lifecycle: build renderer in `create()`, `registerCanvasBoundsRefresh`, subscribe, render once, release everything on `shutdown`. | Likely **untouched** — the stage is owned by the renderer, not the scene. If a scene changes, something has been put at the wrong layer. |
| `public/cases/young-interference/case.json` | `version 1.13.0`. Four `colleagues[]`, all `silhouette` with distinct accents. `rivalLab.name`/`accentColor`/`critiques[]`. `scenarioScript` authors beats for `prediction` (3), `synthesis` (3), `review` (2). | **Untouched.** No new field, no version bump. |

### The width and height budget — measure, do not guess

The canvas is a fixed **1024×768 `Scale.FIT`** surface that does not scroll. A surface that outgrows its band is a defect, not a responsive state.

**Vertical space on the boards is already spent.** With today's constants: the conclusion board's control column floors at 112, so `dialogueTop()` returns 124; a two-line beat panel measures ≈98, putting the cards' top at ≈234; that leaves 518px for four cards at ≈119 each, against the ≈114px of measured card content the `ProposalChoice` docstring records. **≈5px of slack per card.** This is why D1 puts the figures in a column and not in a strip above the cards, and why nothing in this story may add vertical chrome to either board.

**Horizontal space is what you spend, and the constraint is silent truncation.** `BODY_MAX_LINES = 2` **clips** — a claim that needs a third line simply loses it, with no error and nothing visible in a per-token typography sweep. Today's numbers:

- card width 944, `MARKER_GUTTER` 200 → text wrap **744**
- longest French prediction text: **177 characters**; longest French claim: 152; longest French limitation: 143

At ≈7.6px per character for 16px UI text, 744 fits ≈98 characters per line — so 177 characters is two lines with roughly 19 characters to spare. That margin is the entire budget for the figure column.

**Suggested starting split, which you must then verify:** figure column ≈**56px** (a ≈44px-wide bust plus a gap), funded partly by narrowing `MARKER_WRAP` from 160 to ≈132 and `MARKER_GUTTER` from 200 to ≈172 — the longest French marker is `Retenir celle-ci`, ≈115px at 15px, so 132 still holds. That leaves text wrap ≈**716**, ≈94 characters per line, ≈188 of capacity against 177 needed.

**The rule, not the numbers:** the truncation guard in Task 7 is the arbiter. If the longest French string no longer fits two lines, **narrow the figure column** — do not raise `BODY_MAX_LINES`, do not shrink the body font (16px is already the floor: at 1280×720 a 1024×768 `FIT` surface renders every design size at 93.75%, so 16 lands at ≈15 CSS px), and do not clip. Record the numbers you measured in Completion Notes; a geometry constant needs a rationale that survives inspection.

Other standing layout rules that bind here:

- **Measure, never assume.** The 1.11, 1.12, 2.5, 2.6, 2.7 and 2.8 reviews each found the same defect: an object placed against a constant while the object above it grew with French copy.
- French runs 15–25% longer than English. A fixed-height control's label must fit **on one line in French** at its authored size.
- Read `768` / `1024` from `scene.scale`, or from `src/adapters/phaser/designSurface.ts` in a spec. Geometry helpers take the canvas size as arguments.
- Do not paint a figure over card text, the advance control, the submit control, or the transient refusal line.
- **Diegetic never means hidden** (`EXPERIENCE.md` §HUD): every figure carries its readable name and role. Scientific legibility outranks atmosphere.

### Animation and reduced motion

`ApparatusRenderer` is the only animated renderer in the codebase and it is the pattern: a cached `motionAllowed` flag, a `change` subscription on the media query, motion gated on it, and a `destroy()` that removes the listener and kills `targets: this` tweens. `LibraryRenderer`, `ReadingRoomDecor`, `DialogueBox`, `ProposalChoice`, and `AdvanceControl` all took the other option — no motion at all — and each says so in its docstring precisely so a later story inherits the obligation knowingly. This story is the first to add motion to a *board*, so:

- Animate on **elapsed time** (a tween), never on frame counters.
- Restrained and short: ≈160–200 ms on scale, alpha, and a small lateral offset. No bounce, no sway, no idle loop, no entrance choreography. The reading is what matters.
- Under `reduce`: no tween, no loop, target values applied in `render()`.
- Toggling the OS setting at runtime must take effect — that is what the `change` listener is for.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011):** Phaser scenes own all interactive presentation. **A feature is not done until the canvas can dispatch its intent** — this story adds no new intent, so the check here is that it breaks none of the existing dispatchers on the two boards and the rival lab. Never add semantic HTML to mirror a Phaser gesture. `src/ui/*` panels are retired and are not a working fallback. `src/game/scenes/*` are orphaned template leftovers — real scenes live in `src/adapters/phaser/scenes/`. Scenes **mirror** the phase and never define, infer, or advance it; the router is read-only. **No scene→scene reach-in.** Never author player-facing copy in `create()` — create empty, populate in `render(state)` through `createTranslator(locale)`. Renderer contract: `create()` / `render(state)` / `destroy()`, releasing every object, tween, timer, and listener — **including tweens whose target is the renderer itself**. Honour `prefers-reduced-motion` in every animated renderer: no update loop under `reduce`, and `render()` paints a static frame. **Character staging must not be able to read the defensible set — a staging renderer gets the cast, the speaker, and the accent colour, and nothing more (ADR-006).** Sticky canvas: `scale.updateBounds()` from a passive scroll listener owned by the scene lifecycle (already handled by `registerCanvasBoundsRefresh`).
- **Guided adventure:** everything is authored. Prediction and conclusion are each 1-of-4 colleague proposals; schemas use `.length(4)`. Choices stay revisable. **Defensibility is evaluator/critique-only — never leak it into a display projection.** The evaluator is the sole completion authority. The rival lab is **narrative dressing, never a fail state** — no score, game-over, or penalty — and Bell is **not** a member of `colleagues[]`. Hints point at missing evidence and never supply the answer. No hard fail, score, timer, or speed reward. Authored copy must not name a scene, phase, or route (`encodesPath`). A refused action always says why and the message survives until a real state change replaces it.
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria** — the project's most-repeated defect, and the one real code defect found in 2.4. Interface strings go through `translate`/`createTranslator`; prose the player reads is `LocalizedText`; **proper nouns — colleague names, `rivalLab.name` — stay plain strings**. Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont.
- **Organization:** `src/domain/` pure (no Phaser, DOM, fetch, IndexedDB, browser APIs, or Zod); `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No `services/`/`managers/`/`helpers/`. Fallible operations return `Result<T, ResultError>`. Case definitions immutable under `public/cases/` — and untouched by this story. Naming: `PascalCase` classes/files (`CharacterStage.ts`), `camelCase` modules (`characterStageView.ts`), `UPPER_SNAKE_CASE` constants.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal — this story registers none. No logging, JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. **Prefer pre-rendered geometry over regenerating `Graphics` each frame.** Cap text resolution at `min(devicePixelRatio, 2)` (`textStyles.textResolution()` already does).
- **Platform:** static web app; offline reload is a release gate; never expose a raw error to the player. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it. To test Phaser-adjacent logic, **inject the structural slice** (`SceneRouterTarget` is the reference). Assert public actions, selectors, and rendered text — never Phaser private fields or incidental pixels. **Never assert a magic number a test shares with source unless both read one exported constant.** Some e2e specs already fail on baseline — check before attributing a failure to your change. axe/manual a11y are no longer gates; keep the reduced-motion check and delete no existing a11y spec.

### Previous story intelligence (2.8, and the 2.7 / 2.6 / 2.5 / 1.12 reviews)

- **2.8's review applied 32 patches.** Read `2-8-library-reading-room-and-reference-book.md` §Review Findings before starting. The recurring findings that constrain this story:
  - **Test honesty was proven by mutation, not argument.** Two findings survived triage because the reviewer broke the source and the test still passed. Write the ADR-006 reachability test and the truncation guard so that they *fail* when the thing they protect is removed — then verify that by actually breaking it once.
  - **A spec that restates a source constant is a spec that stops covering it.** The book-control width triple and the `1024`/`768` restatements each took three reviews to close. `designSurface.ts` and `canvasHelpers.ts` exist for this; export your geometry and have the specs read it.
  - **Dead default parameters made a wiring omission a compile-time success** (`isOverlayVisible = () => false`). If `ProposalChoice` gains options, default them to today's values so behaviour is unchanged — but do not default a *required* wiring argument to a no-op.
  - **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y = 130` was justified on grounds that were wrong in normal play. State why each number is what it is, with the measurement.
- **2.6 shipped its whole rendering path with no automated coverage** — the manual check ran through a temporary Playwright spec that was then deleted. `advanceView.ts` and its unit tests exist because of that finding. Put the decidable logic in a Phaser-free module and test it there.
- **Do not import Phaser at module scope in anything a Vitest or Playwright spec imports.** This is why `advanceView.ts`, `apparatusGeometry.ts`, `libraryGeometry.ts` and `libraryDecorGeometry.ts` exist. `characterStageView.ts` is the next one, for the same reason. `AdvanceControl` and `ProposalChoice` import Phaser **as a type only** — follow that if a widget needs the types.
- **A per-token typography sweep is not a wrap check.** Every new fixed-height label goes in the whole-string test.
- **Hit areas do not resize themselves.** If a figure becomes clickable — it should not need to be — `ProposalChoice.resizeHitArea` is the pattern.
- **Localize as you build, not after.**
- **`ColleagueRenderer.create()` runs synchronously inside `dispatch() → notify()`.** A throw there would advance the phase, skip later subscribers, and break `dispatch`'s `Result` contract (1.10 review). Construction stays cheap and defensive: a missing colleague, an `asset` portrait, or an unresolvable `speakerId` must degrade, not throw.

### Git intelligence

`52d6412 Review 2.8`, `517b8d4 Dev 2.8`, `11c582a Story 2.8`, `4ef6b83 Review 2.7`, `470bac6 Dev 2.7` establish the rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned items pushed to `deferred-work.md`.

`517b8d4` is the diff to read first — it created `LibraryRenderer`, `ReadingRoomDecor`, `libraryGeometry`, `libraryDecorGeometry`, `canvasBounds`, `designSurface`, and `canvasHelpers`, and it is the closest existing example of "draw a room out of `Graphics` with a Phaser-free geometry module and test the geometry". `470bac6` created `AdvanceControl`, `advanceView`, and `transientMessage`. `52d6412` is the review that hardened all of it — including the two mutation-proven test-honesty patches.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`). `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the lockfile is committed to pin exact patches.

No web research was needed. This story introduces no library, and every API it touches is already used in this codebase in the files listed above: `Phaser.GameObjects.Graphics` fill commands (`ReadingRoomDecor.ts`), `scene.tweens.add` / `killTweensOf` with a `targets: this` case (`ApparatusRenderer.ts:268-280`), `setScale` / `setAlpha` / `setPosition` on flat display objects, `window.matchMedia('(prefers-reduced-motion: reduce)')` plus its `change` event (`ApparatusRenderer.ts:168-229`), and `scene.scale.{width,height}`. Copy those call sites rather than a general Phaser 4 example — Phaser 4's tween and `Graphics` APIs differ from the Phaser 3 examples that dominate search results.

### Project Structure Notes

- **New:** `src/adapters/phaser/renderers/characterStageView.ts`, `src/adapters/phaser/renderers/CharacterStage.ts`, `tests/unit/CharacterStageView.test.ts`, `tests/integration/CharacterStaging.test.ts`.
- **Revised:** `src/core/store/selectors.ts`, `src/adapters/phaser/ui/DialogueBox.ts`, `src/adapters/phaser/ui/ProposalChoice.ts`, `src/adapters/phaser/renderers/ColleagueRenderer.ts`, `src/adapters/phaser/renderers/RivalLabRenderer.ts`, `src/core/i18n/locales/{en,fr}.ts`, `tests/unit/{DialogueBox,DialogueBeats,I18n}.test.ts`, `tests/e2e/french-typography.spec.ts`.
- **Check, likely untouched:** `src/adapters/phaser/scenes/{ColleaguesScene,TheoryBoardScene,RivalLabScene}.ts`, `tests/e2e/{dialogue-advance,canvas-transitions,rival-lab,theory-board}.spec.ts`.
- **Do not touch:** `public/cases/**`, `src/schemas/**`, `src/domain/**`, any `src/ui/*` file, `src/game/scenes/*`, `docs/validation/*`, `dist/`, `.claude/worktrees/**`.

### Baseline

At `52d6412` the 2.8 review measured, after its patches: `typecheck` clean, `npm test` **808 passing across 50 files**, `npm run test:e2e` **47 passed / 7 failed** on chromium. The seven failures are the same seven names carried since before 2.8 — `accessibility`, `curated-record`, `inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment` — all failing on missing retired-DOM controls that Story 2.12 owns. **Measure your own baseline before the first edit and compare failure names, not counts.** Six known firefox/webkit baseline failures are Story 2.12's to fix or re-record.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.9` — the seven ACs; §Story 2.10/2.11/2.12 for what this story must not build; §Epic 2 reopening note]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §1 item 2 (the text-only-NPC finding and the `ColleagueRenderer:141-149` concession), §2.1 (Story 3.4 owns per-scene cast staging), §3 D1 (coded vector silhouettes), §3 effort table (2.9 = Medium / Low, depends on 2.7), §4.1.1 NFR20, §4.2.2 (cast ships without commissioned art), §4.2.3 (the animation exclusion is bounded and does *not* exclude restrained staging), §4.3.2 (`cast?` is additive and later), §4.5.1 (character staging must not read the defensible set)]
- [Source: `_bmad-output/project-context.md` revision 2.1 — engine, guided-adventure, i18n, organization, performance, platform, testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — ADR-001 v1.1, ADR-006, ADR-009, ADR-011; §Phaser Object Patterns ("renderer factories own Phaser object lifecycle and cleanup"); §Consistency Rules]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md` §Art Style — colleagues as "first-class on-screen characters … present through portraits **or silhouettes**", the cited authority for this story; §Out of Scope for the bounded animation exclusion]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md` revision 2.0 — the **Character on stage** and **Conclusion proposal card** component rows; §HUD & Diegetic UI ("hears a colleague standing in the room", "diegetic never means hidden"); §Key Flows steps 3, 7, 8; §Emotional beats ("no celebratory burst and no red failure treatment")]
- [Source: `_bmad-output/narrative-design.md` §Young Team — Thea Young (lead), Elias Wren (builder), Marianne Cole (analyst), Samuel Hart (communicator); §Mr. Arthur Bell — Young ("a respected natural philosopher committed to corpuscular explanations", "public critique … demands for demonstration"), the character reference for a distinct silhouette]
- [Source: `_bmad-output/implementation-artifacts/2-8-library-reading-room-and-reference-book.md` §Review Findings (32 patches, the two mutation-proven test-honesty findings), §Layout constraints, §Completion Notes]
- [Source: `_bmad-output/implementation-artifacts/2-7-in-scene-phase-transitions.md` §Review Findings — the shared refusal register and the transient-lifetime rule this story must not disturb]
- [Source: `src/adapters/phaser/renderers/ColleagueRenderer.ts:48-207` (the surface geometry, `accentOf`, `NEUTRAL_ACCENT`); `:256-309` (`create`); `:311-342` (`render`); `:442-499` (`dialogueTop`, `cardGeometry`, `relayoutCards` — the clamp and the measured band)]
- [Source: `src/adapters/phaser/ui/ProposalChoice.ts:28-67` (the constants to parameterise, and the `BODY_MAX_LINES = 2` rationale); `:142-167` (`resizeHitArea`)]
- [Source: `src/adapters/phaser/ui/DialogueBox.ts:36-46` (`DialogueBeatView`, structurally `DialogueBeatProjection`); `:157-179` (the `conversationId` idempotence rule); `:246-254` (`getBottomY`/`isComplete`, the accessor precedent); `:272-302` (`loadBeats`/`advance`)]
- [Source: `src/adapters/phaser/ui/AdvanceControl.ts:1-58` — the store-agnostic reusable-widget contract, type-only Phaser import, and exported derived wrap bounds]
- [Source: `src/adapters/phaser/renderers/RivalLabRenderer.ts:27-77` (geometry and `rivalLabTextWrapWidth(width)`); `:158-193` (`layout`, and why the revise control is floor-anchored)]
- [Source: `src/adapters/phaser/renderers/ApparatusRenderer.ts:168-229` (reduced-motion flag, `change` listener, `syncAnimationLoop`); `:268-280` (`destroy`, including `killTweensOf(this)`)]
- [Source: `src/adapters/phaser/renderers/ReadingRoomDecor.ts:28-120` — the "Graphics fill commands, drawn once, no asset, no motion, no store" pattern and its layer-order argument]
- [Source: `src/adapters/phaser/renderers/advanceView.ts` — the Phaser-free view-resolution module pattern this story's resolver follows]
- [Source: `src/adapters/phaser/scenes/libraryGeometry.ts` and `libraryDecorGeometry.ts` — exported geometry constants and `(canvasWidth, canvasHeight) => Rect` helpers; `libraryArtifactCentre` for placement total over a count]
- [Source: `src/core/store/selectors.ts:158-236` (cast and proposal projections, `projectAttribution`, `LocalizedProposalProjection`); `:238-267` (`DialogueBeatProjection`, `selectDialogueBeats`); `:175-186` (`selectDefensibleConclusionProposalIds` — the one selector nothing here may import); `:380-410` (`selectLocalizedRivalLabCritique`)]
- [Source: `src/domain/cases/ColleagueCast.ts:18-38` — `ColleagueRole`, `ColleaguePortrait` (the `silhouette | asset` union), `Colleague`]
- [Source: `src/domain/cases/ScenarioScript.ts:20-53` — `RIVAL_LAB_SCENE_KEY` (routable, not authorable), `ScenarioDialogueBeat.speakerId`, and why beat ids may repeat across scenes]
- [Source: `src/core/i18n/locales/en.ts:165-206` and `fr.ts:136-154` — the `colleague.*`, `proposal.*`, `dialogue.*`, `rivalLab.*` key families and the French label lengths the budget is measured against]
- [Source: `src/adapters/phaser/textStyles.ts` — `uiTextStyle`, `textResolution()`, and the no-webfont argument]
- [Source: `public/cases/young-interference/case.json` — `version 1.13.0`; four silhouette colleagues with distinct accents; `rivalLab.name`/`accentColor`; the prediction/conclusion `colleagueId` orderings (they differ); the eight authored dialogue beats]
- [Source: `tests/e2e/canvasHelpers.ts` — `clickDesign`/`expectActiveScene`/`clickUntilScene`, `artifactAt`, and the precedent for reading a project file inside a test]
- [Source: `tests/e2e/french-typography.spec.ts:97-410` — `CARD_TEXT_WRAP_WIDTH`, `WRAPPED_SURFACES`, `FIXED_HEIGHT_CONTROLS`, `longestFrench`, and the `measure` helper to extend]
- [Source: `tests/integration/RivalLabCritique.test.ts` — the "drive the authored Young case through public actions" integration pattern]
- [Source: `tests/unit/SceneRouter.test.ts` — `SceneRouterTarget`, the structural-slice injection pattern for testing Phaser-adjacent logic without a real `Phaser.Game`]
- [Source: `docs/i18n-authoring.md` — the canonical-value traps and the `LocalizedText` vs `translate` split]

### Open questions for the reviewer (do not block implementation)

1. **Is the per-row figure column the right reading of AC3?** D1 chose it because the boards have no vertical budget for a group stage above the cards (≈5px of slack per card). The cost is that the cast appears to reorder between the prediction and the conclusion board, since the two proposal sets attribute in different orders. Confirm, or ask for a fixed cast order with a drawn connector to each card.
2. **Should the figure column be suppressed below some width?** Story 2.12 owns the sub-768px advance-affordance decision and this story preserves today's behaviour, but a 56px column plus narrowed marker gutter is the first thing that would want re-deciding there. Flagging rather than pre-empting.
3. **Is a `stage.speaking` badge the right way to satisfy AC2's "label"?** The dialogue panel already names the speaker in its own slot. The badge makes emphasis non-colour-only at the figure itself, at the cost of one more string in a narrow column.
4. **Bell's silhouette shares drawing code with the cast but not the input path (D3).** Confirm that is the right seam, or ask for two entirely separate draw functions so no future change can accidentally route him through the cast.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via `gds-dev-story`.

### Debug Log References

**Baseline, measured at `10a90af` before the first edit** — names, not counts, as §Baseline requires:

- `npm run typecheck` — clean.
- `npm test` — **808 passing across 50 files**.
- `npm run test:e2e` — **47 passed / 7 failed** on chromium. Failure names: `accessibility`, `curated-record`, `inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment` — exactly the seven carried since before 2.8, all on retired-DOM controls that Story 2.12 owns.

**Final:** typecheck clean; `npm test` **859 passing across 53 files**; `npm run test:e2e` **48 passed / 7 failed**, the same seven names. The extra pass is this story's truncation guard.

**Two defects found by screenshotting the running game, neither reachable by any assertion in the suite.** Both are recorded here because the story's own guidance pointed the wrong way on the first and had no opinion on the second:

1. **Every figure was invisible.** Task 4 says to create the stage *before* the cards so a figure can never paint over card text. But the figure column is reserved *inside* each card, out of its content inset, and a card paints an opaque background across its whole width — so a stage created first is a stage behind four rectangles. The figures were resolved, positioned and tweened correctly the entire time. The stage is now created **after** the cards; what actually protects the card text is the reserved inset, and what protects the click is that a figure is never interactive (Phaser hit-tests topmost-first among *interactive* objects only). The reasoning is written into `ColleagueRenderer.create()`.
2. **Mr. Arthur Bell rendered at 24% of his intended size.** The figure-size override lived only on `CharacterStage` while `resolveCharacterStage` went on capping at the boards' 44×78, so the renderer's fit ratio came out at 78/330 and he was drawn at a quarter of the space he was placed in. `maxFigure` now lives in `CharacterStageInput` and both halves read one maximum. Regression-tested on both sides of the seam (`CharacterStageView.test.ts`, `CharacterStage.test.ts`).

A third, smaller one: the shared rim light guessed at the silhouette's left edge and hung in the air beside Bell where his coat narrows at the waist. Each build now paints its own rim.

**Mutation-proven, as §Previous story intelligence requires — both were broken on purpose and confirmed to fail:**

- **ADR-006 reachability.** Adding `selectDefensibleConclusionProposalIds` to `CharacterStage.ts` fails `CharacterStageView.test.ts`; removing it passes. It also fired for real while being written, on the word "defensible" in `characterStageView.ts`'s own docstring — the prose was rewritten rather than the test weakened, which is why that module explains the rule without naming the terms.
- **The truncation guard.** Widening `PROPOSAL_FIGURE_COLUMN_WIDTH` from 56 to 140 fails it on the longest French prediction text (`3 lines > 2 at 630px`); restoring it passes.

**Manual check at 1280×720, EN and FR, driven through the real app.** ⚠️ **This paragraph described the first implementation and was left unamended through two rewrites; the review corrected it.** The "reserved column" was retired by the design revision below, and the `Parle` badge it claims to have verified **did not exist in the code** — `stage.speaking` was authored in both locales and rendered by nothing until the review wired it. What is true, and re-verified by screenshot at 1280×720 in EN, FR and under `reduce` after the review's patches: prediction board four figures in a row on the painted floor, speaker foregrounded, lifted **and badged**, others receded; advancing the conversation re-stages to the new speaker (FR beat 2 → Marianne Cole, badge `Parle`). Rival lab: Bell full height at the right, hat, flared coat, plinth, name plaque, clear of both the prose and the floor-anchored revise control. Under `prefers-reduced-motion: reduce` both boards paint a complete static staged frame with no tween. No label truncated, no figure over card text or a control in either locale.

### Completion Notes List

## Second design revision, 2026-08-07 — one silhouette recoloured is not four people

Alexis supplied a design board of the narrative cast — twenty-four painted vignettes covering the
Merrow, Young, Hale and Voss teams and their four challengers — and asked for the people to be
redrawn against it. It named the defect the first revision had left standing.

The revision below got the *size* right: full-length figures in a painted room, not busts in a margin.
It got the *picture* wrong. Every figure was **one body, tinted per colleague**. That satisfies AC2's
letter on the cards, where the attribution line names the author in words, and breaks it on the stage,
where colour was doing all the work: a reader who cannot tell teal from plum could not tell Elias Wren
from Marianne Cole. AC2 says in as many words that identity must not rest on colour alone. It was
resting on colour alone, and no test caught it because the tests asserted placement, not appearance.

### What the board specifies, and what was built from it

Five of the board's twenty-four vignettes are this case's cast. They are specific people: Wren wears
spectacles and carries a clipboard at a blackboard; Cole is gowned with her hair pinned up, reading a
sheet; Hart has a moustache and an arm out mid-explanation; Young holds a lens up to the light; Bell
stands with his arms folded in tweed. Take every colour out of that description and all five are still
distinguishable — which is the specification.

A figure is now assembled from an authored appearance rather than tinted:

- **A closed authored vocabulary.** `portrait.figure` on a colleague and `figure` on `rivalLab`, both
  optional, both validated by one schema: `build` (suited/gowned), `pose` (five), `hair`, `hairColor`,
  `skinTone`, `spectacles`, `moustache`. Enums and booleans only — **no authored colour beyond the
  accent already there**. The room is lit warm and dark and a free `hairColor` would eventually carry
  one that does not sit in that light; the ramps are curated for the lamp. Four skin tones, spaced to
  survive the amber cast, because the wider cast includes Priya Sen, Maya Rao and David Lin and a
  single default tone would need correcting the moment their case ships rather than now.
- **Additive, so nothing that validated before stops validating.** Every field and the whole block are
  optional, and a case authoring nothing still gets four people who differ, because the **role implies
  the pose** — an instrument maker holds a clipboard, a communicator explains with their hands. What a
  role must *not* imply is build, hair or face: nothing about being an analyst implies a gown, and
  inferring a character's presentation from their role or their name is how a named character gets
  drawn wrong. Two tests pin that distinction in both directions.
- **`figureAppearance.ts` is Phaser-free**, for the reason `characterStageView.ts` is: `CharacterStage`
  imports Phaser, Phaser touches `window` at import time, and Vitest runs in Node. The palette and the
  defaults are the assertable part, so they live outside the file that draws.
- **Four tones of one accent per garment** — coat, trousers/skirt, linen, and a lit edge — derived
  rather than authored, so a recoloured colleague stays consistent and no author can write a highlight
  darker than their own shadow. Asserted as an *ordering* over six accents including pure black and
  pure white, not as four literals.
- **The plaque follows the board's typography**: the name in amber serif, the role beneath in a muted
  warm grey.

### Defects this pass found, all of them only reachable by looking

- **`shade()` lightened a near-black accent and `tint()` darkened a white one.** Both targets are
  colours rather than pure black and pure white — a shadow in this room keeps a trace of cold blue, a
  highlight stays oil-lamp warm — so a naive mix inverts at the ends of the ramp. Invisible on the four
  accents this case ships; the property test over six accents is what surfaced it. Each channel is now
  clamped to the direction the function names.
- **The presenting arm reached 13px past its own sleeve** and read as a stub, then as a T-pose against
  the vertical resting arm. The forearm now drops from a bent elbow and reaches `0.92 × width`.
- **The blackboard closed its brass frame around Elias Wren's head.** Décor is not told where the cast
  stands and should not be — but the cast is laid out in equal slots across the same surface, so the
  middle is the one place a prop that size is guaranteed to fall *between* two people. Moved there,
  narrowed, and its frame dimmed: at the brightness it had, a rectangle behind the cast out-read every
  face in front of it.
- **Shoulders were a hard horizontal edge four-fifths of the figure's width**, above a much narrower
  body — every colleague had wings. Narrowed to 0.35, sloped, and the deltoid caps set inside the
  shoulder line instead of centred on it, which had been adding their own radius to the silhouette.
- **The neck was painted in a shade of the coat**, leaving a dark bar under every chin; and it was four
  fifths of a head-radius long, so everyone craned. It is skin now, and half that.
- **The head was correctly proportioned and therefore illegible.** A board's band gives a colleague
  around 130px, not the 230 the figure is stroked at, so a classical eighth-of-the-height head is 16px
  across — too small to carry hair, spectacles or a moustache, which is to say too small to carry the
  identity the whole revision is for. Nudged to a sixth, the same stylization the board uses.
- **The conclusion board's room read as a rendering fault.** Its props are fractions of the strip,
  which composes correctly right up until the strip is shorter than the props are tall: at ~60px the
  sash windows were nine pixels high and the blackboard a bright line. `LaboratoryDecor` now refuses to
  compose below 130px and paints flat wall instead — the same judgement `MIN_LEGIBLE_FIGURE_HEIGHT`
  already makes about the cast, in the same place and for the same reason.
- **Bell's coat stopped just above his plinth** and he read as robed. Raised to 0.26, so the longer-coat
  cue survives and he has legs to stand on. His folded hands were two full-size discs sitting on his
  chest like buttons; folded arms tuck each hand under the opposite elbow, so what shows is small and
  at the ends of the bar.

### AC4 after the change

Bell's distinction from the cast is still four cues and still none of them his colour: he is taller, he
stands on a plinth, his coat falls to a fuller skirt, and he is authored **arms-folded** — the one
posture on the stage that reads as judgement rather than work, and one no colleague's role produces
(asserted). The **top hat was dropped**: nobody in the reference wears one indoors and it read as
caricature. What he *is* — the folded arms, the grey hair, the moustache — is authored on
`rivalLab.figure` in the same vocabulary a colleague uses, because there is no reason for a second one.

### Verification

Typecheck clean. **891 unit and integration tests** across 54 files (870 before). E2E **49 passed /
7 failed** — the same seven baseline names, unchanged. Screenshotted on the running game in EN, FR and
under `reduce`, on the prediction board, the conclusion board and the rival lab; the French plaque
carries `Constructrice ou constructeur d'appareils` on one line.

### Still not done, and still the reviewer's call

Both open items from the revision below stand unchanged. The conclusion board still withholds its cast
below the legibility floor, and the only lever is where the stated limitation lives. The laboratory
bench and the debrief still have no décor, for the reasons given there.

---

## Design revision, 2026-08-07 — the first implementation was rejected

Alexis rejected the first pass on sight ("le design est catastrophique") against a reference mock of a
classic point-and-click adventure: full-length characters standing in a rendered Victorian optics
laboratory, and a dialogue panel where each speaker's name carries their own colour. The rejection was
correct. What shipped first was four 44×78 shoulders-up busts in a 74px column carved out of each
proposal card — decorative tokens in a margin, not colleagues in a room.

Three decisions were taken with Alexis before rewriting: **décor band with full-length figures over
compact cards**; **décor on every scene**; and the reference's **SCUMM verb bar and inventory grid are
visual reference only** — this game has no takeable objects and no verbs, its fourteen player intents
are investigative acts, and a verb bar would be a whole new interaction model (a sprint change, not
this story).

**What changed**

- **Figures are full-length and stand in a row**, ≈76×230 at a 1:3 proportion, on one floor line, in a
  painted laboratory. `resolveCharacterStage` lays them across a band instead of one-per-card-row.
- **The layout inverted.** Cards used to hang off the dialogue panel's measured bottom and be clamped
  when it grew ("overlap beats absence"). Cards are now **anchored to the canvas floor** at a fixed
  height derived from their own content, and the **room takes what is above them**. A long French beat
  now costs the room some ceiling rather than costing the cards their place — the clamp's failure mode
  is removed rather than bounded, and the thing the player must click can no longer move.
- **The row bought AC1 outright.** Each figure gets a slot ≈236px wide, so its **name and role are
  written on a plaque beneath it** — the thing the 74px column could not afford and that the first pass
  had to argue its way around. The longest French role measures ≈210px at 11px against 236.
- **The cards got their full width back**: `contentInset` and `markerGutter` return to the widget
  defaults and the text wrap goes from 714 back to **744px**.
- **Each speaker's name is written in their own accent** in the dialogue panel — the reference's best
  idea, taken wholesale. Reinforcement, never the signal: the attribution names them in words anyway.
- **AC3's connection is now made by acting.** With the figures in a row rather than beside their own
  card, choosing a proposal brings its author forward. That is the player's own choice reflected back,
  never an evaluation of it — the ADR-006 source sweep still passes and now covers `LaboratoryDecor`
  too.
- **New `LaboratoryDecor`**: sash windows onto a grey city, a blackboard carrying the chromatic-
  aberration diagram in chalk (no text — a painted string would be a surface outside the i18n layer),
  panelled dado, boards in perspective, a brass optical rail, and one warm lamp. `ReadingRoomDecor`'s
  pattern exactly: fill commands only, no asset, no store, no motion, painted once.
- **The dialogue panel narrowed** to `DIALOGUE_PANEL_WIDTH` so the control column sits *beside* it
  rather than above it, and the guide line moved down beside the cards. Those two reclaims are what
  bought the room its height — the panel used to spend 104px clearing a column standing in a corner.

**Three defects found by screenshotting the running game, none reachable by any assertion**

1. **Every figure invisible.** Task 4 says to create the stage before the cards. But the column was
   *inside* each card and a card paints an opaque background across its full width, so the stage sat
   behind four rectangles. Fixed by creating it after the cards; the reserved inset is what protects
   the card text, and non-interactivity is what protects the click.
2. **The rival at 24% of his size.** The figure-size override lived only on `CharacterStage` while the
   resolver kept capping at the boards' maximum. `maxFigure` now lives in `CharacterStageInput`;
   regression-tested on both sides of the seam.
3. **The whole room on top of everything.** A `Graphics` joins the display list when
   `scene.add.graphics()` runs, not when it is filled — so painting the room on first render (needed,
   because it composes against the panel's measured height) put every layer above the chrome, the
   cards and the cast. Fixed by separating `reserve()` from `create()`.

**The one thing this layout cannot do, and what would fix it**

The **conclusion board cannot host the cast.** Its four cards each carry a claim *and* a stated
limitation — 488px of a 768px surface — so after the panel and the guide there is ≈60px of room. Four
people drawn into 60px are four dots with names under them. `MIN_LEGIBLE_FIGURE_HEIGHT` withholds them:
the room is painted and the cast is not, because a stage that cannot be legible is not a stage. The
prediction board, whose cards carry no limitation, gets ≈150px figures and reads as intended.

This is a property of the card layout, not a preference. Freeing the stated limitation from the card —
showing it for the *chosen* proposal only — returns ≈140px and would let the cast stand on both boards.
That is a content/UX decision and is left to the reviewer rather than taken here.

**Décor scope, honestly**

Done on the three surfaces Story 2.9 owns: both proposal boards and the rival lab. Not done on the
other two, and deliberately: `DebriefScene` is a `PhasePlaceholderScene` that **Story 2.11 deletes and
rebuilds**, so a room painted into it is work thrown away; and the laboratory bench is Story 2.10's
surface, already draws its own optical apparatus across the full canvas, and is the one scene with a
live animation loop and an NFR1 budget. The reading room has had its own décor since 2.8. Say the word
and I will take the bench on as part of 2.10.

---


**The width budget, measured rather than assumed** (the numbers §The width and height budget asks to be recorded):

| | Before | After |
| --- | --- | --- |
| Card content inset | 26 | **82** (26 + a 56px figure column) |
| Marker gutter, from the card's right edge | 174 | **148** |
| Card text wrap | 744 | **714** |
| Marker wrap | 160 | **132** |

At ≈7.6px per character for 16px UI text, 714 carries ≈94 characters a line and ≈188 over two, against the longest French prediction text's **177**. The longest French marker, `Retenir celle-ci`, is ≈115px at 15px against 132. The arbiter is not this arithmetic but the whole-string truncation guard, which measures every authored claim and limitation at the board's real wrap in both locales and passes; the mutation above shows it failing at 140.

`proposalTextWrapWidth` was also made honest while it was widened: it took only the width and subtracted one constant, which could not notice a widened content inset at all — the text would start further in and keep its old bound, and `BODY_MAX_LINES = 2` clips silently. It now takes both gutters, and `PROPOSAL_MARKER_GUTTER` is measured from the card's right edge (174 = the old 200 less the inset it had folded in), so the defaults return exactly today's 744.

**Decisions taken, with their reasons:**

- **The 8px rival-lab accent stripe is kept, in Bell's colour** (Task 5 asks for this to be decided explicitly). It is not a second thing carrying the same signal, because the two identify different things: the stripe frames the *surface*, which belongs to the rival laboratory, and the figure is the *person*. `TEXT_LEFT` is also derived from its width, so retiring it would shift every text on the surface and move the derived click targets for no gain. His plinth is deliberately painted in neutral stone rather than his accent, for the opposite reason — it is furniture he stands on, not part of him.
- **A figure's name and role are the attribution line beside it**, not a second plaque in the column — on the boards. This is the story's own Task 4 reading ("adjacency plus a shared accent plus a shared name") and the measurement forces it: the column is 74px, which at 11px is ≈13 characters a line, so `Dr. Thea Young` wraps to two lines and `Constructrice ou constructeur d'appareils` to four, against a card row a 78px figure already stands in. Widening the column to fit them costs the claims their clipped second line. On the **rival lab** the trade reverses — one figure, a 200px column, and his attribution 900px away at the far left — so his badge carries his name at the speaker line's own size. The choice is an explicit `labelMode` option rather than something inferred from `build`. **This is open question 3 and the reviewer should confirm it.**
- **Presence is derived** through `presentColleagueIds` (proposers in proposal order, then any beat speaker who authored nothing, then the whole cast), so Story 3.4 replaces one call. Not observable in the shipped Young case, where all three sets are the same four people — which the integration test states rather than hides.
- **Row order is proposal order**, so a colleague stands beside their own draft. The two boards genuinely differ (`thea, elias, marianne, samuel` vs `marianne, elias, thea, samuel`), and there is a test asserting they differ so the pairing is provably doing work.
- **Motion is a duration, not a flag.** The resolver returns `transitionMs: 0` under `reduce` with *identical* figure targets, so the static frame is the frame the tween would have ended on — asserted by running both paths and comparing, rather than by trusting a branch.
- **`roleLabel` was removed from the staging types.** It would have been carried through two modules and read by nothing, which is dead weight pretending to be a contract.

**Honest about the seam:** the dialogue reading position is widget-local and deliberately not in the store, so no public action can move it. `CharacterStaging.test.ts` drives the *store* for the beats and the *resolver* for the position and asserts the pair; it does not pretend to be an end-to-end play. No `AppState` beat-index field was added. Its `advanceTo` helper also asserts the phase it claims to have reached — an earlier draft let a refused `review` transition fall on the floor and read `synthesis`'s conversation while believing it was reading `review`'s.

**Not done, and why:** NFR1 was spot-checked only — the full 10-minute re-profile is Story 2.10's AC, not this one. No `src/ui/*` panel was touched, no scene file changed, and no dependency was added.

⚠️ **Corrected by the review:** this paragraph previously read "`case.json` is untouched and unversioned", which contradicted the File List three paragraphs above it and the second design revision that added five authored `figure` blocks. `case.json` **is** changed, and is now at **1.14.0**. The "staging cost no visible frames" claim was also too strong — see the review's §Verification for what the conclusion board's cast actually costs now that it is drawn rather than withheld.

### File List

**New**

- `src/adapters/phaser/renderers/characterStageView.ts`
- `src/adapters/phaser/renderers/CharacterStage.ts`
- `src/adapters/phaser/renderers/LaboratoryDecor.ts`
- `src/adapters/phaser/renderers/figureAppearance.ts`
- `tests/unit/FigureAppearance.test.ts`
- `tests/unit/CharacterStageView.test.ts`
- `tests/unit/CharacterStage.test.ts` — a sibling for the reduced-motion and destroy assertions, which need the structural scene slice
- `tests/integration/CharacterStaging.test.ts`

**Modified**

- `public/cases/young-interference/case.json` — five authored `figure` blocks; no other field touched
- `src/domain/cases/ColleagueCast.ts`
- `src/domain/cases/CaseDefinition.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/core/store/selectors.ts`
- `src/adapters/phaser/ui/DialogueBox.ts`
- `src/adapters/phaser/ui/ProposalChoice.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `src/adapters/phaser/renderers/RivalLabRenderer.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/adapters/phaser/renderers/LaboratoryDecor.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CharacterStage.test.ts`
- `tests/unit/DialogueBox.test.ts`
- `tests/unit/DialogueBeats.test.ts`
- `tests/unit/I18n.test.ts`
- `tests/integration/DialogueAndChoice.test.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/dialogue-advance.spec.ts`
- `_bmad-output/implementation-artifacts/2-9-colleague-and-rival-lab-characters.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Review Findings

Three parallel layers, 2026-08-07: Blind Hunter (diff only, no spec, no project), Edge Case Hunter
(diff + project read), Acceptance Auditor (diff + spec + context docs). All three completed. Every
finding below was re-verified against the working tree before it was written down.

### Decisions — resolved by Alexis, 2026-08-07

All four were put to Alexis at the end of the review and answered. Each is now a patch; the call taken
is recorded on the bullet so a later reader sees the reasoning and not just the result.

- [x] **[Review][Patch] (Decision resolved: take the remedy — free the stated limitation from the conclusion card, showing it for the *chosen* proposal only, and let the cast stand on both boards.)** The legibility floor withholds the cast on the conclusion board, always — AC1, AC2 and AC3 are unmet on two of the three surfaces this story owns** — `proposalStageBand('conclusion', 768, 4)` = `768 − 16 − (4×116 + 3×10) − 40 − 6` = **212**, and `stageBand()` floors the top at `controlColumnBottom('conclusion') + 8 = 120`, so the tallest stage the board can ever produce is **92px** against `MIN_LEGIBLE_FIGURE_HEIGHT (96) + figureLabelHeight() (35) = 131`. Zero figures for *every* panel height, including a zero-height panel. The conclusion board hosts **`synthesis` and `review`** — two of the three authored conversations — so no speaker is foregrounded there either, and AC3's "the prediction **and conclusion** boards" is half-satisfied. The same mechanism is conditional on prediction: measured, `panelBottom=176` gives four 105px figures, `panelBottom=200` gives **zero**, with no floor and no guard — the "absence" failure mode the deleted `cardGeometry` clamp existed to prevent, relocated to the cast. Completion Notes name the remedy (free the stated limitation from the conclusion card, showing it for the chosen proposal only, returning ≈140px) and leave it to the reviewer. **Your call: take that content/UX change, accept the conclusion board without a cast, or something else.** [`src/adapters/phaser/renderers/characterStageView.ts:110`, `src/adapters/phaser/renderers/ColleagueRenderer.ts:620-633`]
- [x] **[Review][Patch] (Decision resolved: "do your best" — draw the badge. It goes on the foregrounded figure's plaque, reads `stage.speaking` through `createTranslator(locale)` in `render()`, is sized so the French `Parle` holds on one line in the slot, and joins the whole-string `FIXED_HEIGHT_CONTROLS` sweep. The en.ts comment describing "a fixed-width figure column beside the cards" is rewritten to the shipped layout.)** AC2's third signal does not exist: `stage.speaking` is authored in both locales, key-tested, and rendered by nothing — the only occurrences in the tree are `en.ts:199`, `fr.ts:156` and `I18n.test.ts:94-96`. `CharacterStage.create()` makes exactly two `Text` objects per figure (name, role) and there is no third. On the stage the speaker is distinguished only by scale (1 vs 0.88), alpha (1 vs 0.55), a 6px lift and plaque alpha — four non-textual magnitude cues. AC2 says in as many words "position, scale, **and label** together — not by colour alone", and Task 6 asked for the marker precisely so the dialogue panel's speaker slot would not do double duty. The story's own **open question 3** asked the reviewer to confirm the badge, so this is yours to settle: **draw the badge as specified, or choose a different non-colour label** (the plaque itself could carry the state). The en.ts comment also still describes "a fixed-width figure column beside the cards", a layout this story retired.
- [x] **[Review][Patch] (Decision resolved: bump it. The `figure` vocabulary is additive and every field is optional, so this is a minor: `1.13.0` → `1.14.0`. The save-compat allowlist in `CaseRecordSchema` must be extended to accept the previous version, or a record exported at 1.13.0 stops loading.)** `case.json` content changed but `version` did not — two different contents both claim `1.13.0` — five `figure` blocks were added to `public/cases/young-interference/case.json` while `"version": "1.13.0"` stayed put. Task 6 forbade a bump *on the assumption the file would not change*; once it did, that instruction stopped applying and was applied anyway. `CaseRecordProjection.ts:10` stamps `caseDefinitionVersion` into every exported record, so an export made before this commit and one made after are indistinguishable. **Your call: bump the version (and decide patch vs minor), or accept that a content-only additive edit does not warrant one.** The schema change itself is sound — `figure` and every field optional, `.strict()` retained, `CaseDefinition.test.ts` proves a pre-vocabulary fixture still validates — so this is about the version contract, not the vocabulary.
- [x] **[Review][Patch] (Decision resolved: back the prose opaquely. A panel behind the objection column, in the same idiom as `DialogueBox`'s, so the room reads as a room behind it and the objection is never competing with a lit window. Screenshot both locales after, per the standing rule that rendering work is not done until it has been looked at.)** The rival lab's prose is painted directly over the room, with no opaque backing — `RivalLabRenderer.create()` calls `decor.create(scene.scale.width, …)` across the **full canvas width**, then adds `heading`/`speaker`/`body`/`guide` as bare `Text` at `TEXT_LEFT = 66` wrapping at 744, i.e. spanning x 66→810. Nothing backs them: the only rectangles are the 8px accent strip and the revise control. Geometrically the objection body runs down through the two lit sash windows (x 36–329) and the brass-framed blackboard (x 407–617). `ColleagueRenderer` escapes this because its prose lives inside the opaque `DialogueBox` panel and inside opaque cards; the rival lab has neither. The file's own docstring says obscuring the objection is "the one thing this surface must never do". **Screenshot it, then pick the remedy: clear the décor behind the text column, dim the props under it, or back the prose.** [`src/adapters/phaser/renderers/RivalLabRenderer.ts:150-176`]

### Patches

- [x] [Review][Patch] Emphasis tweens are never killed before a new one starts, and a reduced-motion toggle does not cancel in-flight tweens — `applyEmphasis` calls `tweens.add` unconditionally on every render (every store notification *and* every dialogue advance) with no `killTweensOf(figure.graphics)` first, so overlapping tweens fight over `x`/`y`/`scale`/`alpha`; and `onReducedMotionChange` re-renders with `transitionMs: 0` while the running tween keeps writing for up to 180ms after the user asked for no motion. `killTweensOf` appears only in `destroy()`. Every motion-path test renders exactly once, so the suite cannot see it. [`src/adapters/phaser/renderers/CharacterStage.ts:284-306`]
- [x] [Review][Patch] `roomPainted` latches to `true` *before* the paint, so a degenerate first band leaves the room permanently unpainted — and `LaboratoryDecor.create` returns before clearing — `paintRoomOnce` sets the flag, then calls `decor.create`, which early-returns on `height <= 0` *ahead of* `cursor = 0` and `layers.forEach(clear)`. A first render whose panel fills the band paints nothing (not even the flat wall) and never retries, even when the panel later shrinks. Set the flag on a successful paint, and move the guard below the clear. [`src/adapters/phaser/renderers/ColleagueRenderer.ts:606-611`, `src/adapters/phaser/renderers/LaboratoryDecor.ts:130-135`]
- [x] [Review][Patch] The last speaker stays foregrounded for the rest of the phase — advancing past the last beat sets `completed` and fires `onComplete` but never moves `index`, so `getCurrentBeat()` keeps returning the final beat and `stageFigures` keeps one colleague at `SPEAKER_SCALE`/`SPEAKER_ALPHA` and the other three at 0.88/0.55 forever. `characterStageView.ts:146-147` documents the neutral state this contradicts. `DialogueBox.isComplete()` already exists for exactly this and is never called. [`src/adapters/phaser/renderers/ColleagueRenderer.ts:589`, `src/adapters/phaser/ui/DialogueBox.ts:297-304`]
- [x] [Review][Patch] The ADR-006 source sweep omits `figureAppearance.ts` — new in this story, imported by both `CharacterStage` and `ColleagueRenderer`, and it resolves what every figure looks like: squarely staging code. Worth deciding whether `ColleagueRenderer.ts` joins it too — it is the only one of these files that touches the store, and therefore the only realistic place a defensibility selector could be wired into staging. The mechanism itself is sound and non-vacuous. [`tests/unit/CharacterStageView.test.ts:372-376`]
- [x] [Review][Patch] Every staging test measures a fabricated band, so nothing exercises the real board geometry — `const BAND = { top: 120, height: FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 }` in `CharacterStaging.test.ts`, and the same shape in both unit specs. `proposalStageBand` and `stageBand` are never called. `'pairs the synthesis row with the proposals, in proposal order'` asserts four figures for a board that renders zero. This is why the conclusion-board decision above is invisible to a green suite — and it is the same class as the constant-restating specs the 2.8 review closed three times. [`tests/integration/CharacterStaging.test.ts`]
- [x] [Review][Patch] `CharacterStaging.test.ts` re-implements the private path it claims to test — `boardCast` copies `ColleagueRenderer.stageCast`'s body and then asserts the copy agrees with the proposals it was derived from, so swapping `predictionProposals` for `conclusionProposals` in the real `stageCast` breaks nothing. The copy also uses `colleagues.find(...)!` where production uses `colleague?.name ?? t('colleague.unattributedSpeaker')`, leaving the unresolvable-colleague path — the one whose docstring warns a throw inside `dispatch() → notify()` would advance the phase — with zero coverage; and it omits `appearance`, so `appearanceOf` is never exercised from the store side. [`tests/integration/CharacterStaging.test.ts`]
- [x] [Review][Patch] Plaque strings are written in `create()` and never re-written, against Task 3 and the Engine rule — `CharacterStage.create()` does `scene.add.text(0, 0, member.name, …)` and `… member.roleLabel …`; `render()` has no `setText` anywhere. `RivalLabRenderer` resolves `t('rivalLab.role')` inside `create()`. Every other string on both surfaces is created empty and written in `render()`, with the reason stated verbatim in this same file. Not observable today (no store action changes `locale`), which is exactly why it will ship and surprise later. [`src/adapters/phaser/renderers/CharacterStage.ts:200-215`, `src/adapters/phaser/renderers/RivalLabRenderer.ts:200-206`]
- [x] [Review][Patch] `MIN_COMPOSABLE_HEIGHT = 130` is one off the value its own comment says it matches, and it is copied rather than derived — the comment says "matched to `MIN_LEGIBLE_FIGURE_HEIGHT` plus the plaque"; that sum is `96 + 35 = 131`. At exactly 130 the room composes and the cast is withheld: a fully painted laboratory with nobody in it, the state the comment asserts is impossible. `LaboratoryDecor` imports nothing from `characterStageView`, so the two can never track each other. [`src/adapters/phaser/renderers/LaboratoryDecor.ts:80`]
- [x] [Review][Patch] The legibility gate tests height only — `width = max(0, min(maxFigure.width, slotWidth − 20, height × ratio))` clamps to 0 when a slot is 20px or narrower, but the withhold branch reads `height`. The renderer then computes `fit = min(0, …)` and calls `setScale(0)`, while `render()` still does `name.setVisible(true); role.setVisible(true)` — four invisible figures with four plaques floating on the floor line. A `maxFigure.width` of 0 divides to `NaN` into `setScale`. [`src/adapters/phaser/renderers/characterStageView.ts:269-275`, `src/adapters/phaser/renderers/CharacterStage.ts:285`]
- [x] [Review][Patch] The guide band reserves 40px but the guide is placed with an 8px gap the reservation does not count — the room's floor is `cardsTop − GUIDE_BAND_HEIGHT − STAGE_TO_CARDS_GAP = cardsTop − 46`, while the guide occupies `[cardsTop − 8 − h, cardsTop − 8]`, so it clears only if `h ≤ 38`. Two lines of 15px French measure ≈38–40px: on the boundary with zero slack, and the three-line French transient refusal this slot is documented to carry needs ≈65px against 46 — 19px straight across the name-and-role plaques. Separately, `STAGE_TO_CARDS_GAP = 6` is documented as the gap the guide sits in but the guide is positioned by `GUIDE_TO_CARDS_GAP = 8`: two constants for one gap, free to drift. [`src/adapters/phaser/renderers/ColleagueRenderer.ts:61,257,266,294,766`]
- [x] [Review][Patch] `showRole` is a dead option and its docstring is contradicted by the only rival caller and by its own test — documented as "the rival carries only his name", never passed by anyone; `RivalLabRenderer` supplies a real `roleLabel: t('rivalLab.role')` and `CharacterStage.test.ts` asserts the role *is* drawn. Even if passed, `figureLabelHeight()` reserves the role's height unconditionally, so it would waste ≈15–18px without shrinking the reservation. Remove it or wire it. [`src/adapters/phaser/renderers/CharacterStage.ts:100,208`]
- [x] [Review][Patch] `CharacterStageRender.t` is a dead parameter threaded through every call site — declared, documented as "deliberately unused", stored in `lastRender`, read by nothing. The story removed `roleLabel` from the staging types on precisely this argument ("dead weight pretending to be a contract") and kept `t`. It also makes the missing `stage.speaking` wiring look present. [`src/adapters/phaser/renderers/CharacterStage.ts`]
- [x] [Review][Patch] `DialogueBox.render(…, accents: SpeakerAccents = {})` defaults a required wiring argument to a no-op — the exact trap `ProposalChoice`'s new docstring names two files away ("default an option to today's value, never default a required wiring argument to a no-op"). A host that forgets the fourth argument compiles, runs, and silently prints all four voices in `DEFAULT_SPEAKER_COLOR`. Make it required. While there: `DEFAULT_SPEAKER_COLOR = '#f4d35e'` is a new literal asserted to be "the slot's original gold" — `setColor` now runs on every paint, so the speaker Text's own style colour is dead and any difference between the two changed the panel silently. [`src/adapters/phaser/ui/DialogueBox.ts:198-209`]
- [x] [Review][Patch] `boardProposalTextWrapWidth()` ignores the gutters it exists to track — it is `proposalTextWrapWidth(PROPOSAL_SURFACE_WIDTH)` with no gutter argument, i.e. the widget default with an extra call, while its docstring claims it is "the bound the board actually draws its card text at" as distinct from the default. The moment the board passes a `contentInset`, `french-typography.spec.ts` goes on measuring a rectangle nothing paints — reproducing the `SUBMIT_WIDTH` vs `ADVANCE_CONTROL_WIDTH` defect the indirection was written to prevent. Have the board hold one gutters object that both the widget call and this helper read. (No `ProposalChoiceGutters` call site passes either option today.) [`src/adapters/phaser/renderers/ColleagueRenderer.ts:278`]
- [x] [Review][Patch] `paintTorso` re-derives `gowned` and shoulder depth from measurements instead of reading the appearance it was built from — `const gowned = m.waistHalf < m.width * 0.25` and `m.hemHalf > m.width * 0.45`, recovering a categorical fact that `appearance.build` already carries and that `paintFigure` branches on one frame earlier. Widen a gowned figure's waist to `0.25 × width` in a tuning pass and every gowned colleague silently gets a frock coat painted over her skirt; `'draws two figures differently'` only asserts the op logs are unequal, so nothing fails. [`src/adapters/phaser/renderers/CharacterStage.ts:562-592`]
- [x] [Review][Patch] `build: 'rival'` and `maxFigure` are independent knobs that must agree, with nothing enforcing it — `paintFigure` computes the plinth as `RIVAL_PLINTH_HEIGHT × this.maxHeight`, and `RIVAL_FIGURE_MAX_WIDTH/HEIGHT` are constants the caller must remember to pass alongside `build: 'rival'`. The `maxFigure` docstring records that getting this wrong once already drew the rival at 24% of his space; the fix stopped one step short of having `build === 'rival'` default `maxFigure` inside the class. The regression test pins the current caller, not the class. [`src/adapters/phaser/renderers/CharacterStage.ts:133-167`]
- [x] [Review][Patch] `RivalLabRenderer.STAGE_TOP` is a fixed constant while the heading above it is measured French text — `stageBand()` returns `{ top: 78, … }` with no reference to `heading.height`, while `layout()` correctly measures everything else from it. A heading translation that wraps to two lines puts its bottom at ≈94, 16px into the composed room, and the band does not move. This is the "object placed against a constant while the object above it grew with French copy" defect the same file's docstring records being found twice. [`src/adapters/phaser/renderers/RivalLabRenderer.ts:71,249-251`]
- [x] [Review][Patch] Two of three assertions in the colour-clamping test are tautologies, and the ordering test is weakened for every accent but one — `expect(shade(0x000000, 1)).toBeGreaterThanOrEqual(0)` holds for any implementation, and `expect((tint(0x00ff00, 1) >> 16) & 0xff).toBeLessThanOrEqual(0xff)` is forced true by its own mask — including for the `colour + 0x101010` carry bug the comment names as the target. Separately, `garmentTones`' strict ordering is asserted for `0x4f8a8b` only; the "every accent" version uses `≤`, which passes while a white accent collapses `linen === highlight === 0xffffff` and a black one collapses `deep === base` — four tones become three and the figure reverts to the flat cut-out the module exists to prevent. `#ffffff` is schema-legal. [`tests/unit/FigureAppearance.test.ts`]
- [x] [Review][Patch] Task 7's whole-string `FIXED_HEIGHT_CONTROLS` sweep for the narrowed marker was not done — `proposal.selected` / `proposal.choose` were re-pointed at `CARD_MARKER_WRAP` inside `WRAPPED_SURFACES` (the per-token sweep) but never added to the whole-string sweep, which the story's own §Previous story intelligence says is the only one that can catch a wrap. No live clipping (`Retenir celle-ci` ≈115px against 158). [`tests/e2e/french-typography.spec.ts`]
- [x] [Review][Patch] Stale docstrings and wrong arithmetic across the changed files — (a) the stage-band doc computes `768 − 16 − (4 × 92 + 3 × 8)` and `(4 × 120 + 3 × 8)` against constants that are **88/116** and `CARD_GAP` **10**, and omits `GUIDE_BAND_HEIGHT + STAGE_TO_CARDS_GAP` (46) entirely — real values are **324** and **212**, not 360 and 240, and the conclusion line is not even internally consistent. Those wrong numbers are what `MIN_COMPOSABLE_HEIGHT`, `MIN_LEGIBLE_FIGURE_HEIGHT` and the "about 60px of room" claim are all justified against. (b) `ColleagueRenderer.ts:454` links `{@link PROPOSAL_CARD_GUTTERS}`, which exists nowhere. (c) `ProposalChoice.ts:65` cites `MIN_CARD_HEIGHT`, deleted by this diff. (d) `french-typography.spec.ts` claims the wrap was "narrowed from 744" and that mutation was verified by widening `PROPOSAL_FIGURE_COLUMN_WIDTH` to 140 — the wrap is still 744, and that constant does not exist; an engineer following the documented remedy would find no knob and reach for `BODY_MAX_LINES`, which the same docstring forbids.
- [x] [Review][Patch] The story record and the sprint-status comment contradict the shipped code — Task 6's subtask is still ticked `[x] **No case.json change and no CaseDefinition.version bump**` while five `figure` blocks were added; Completion Notes still assert "`case.json` is untouched and unversioned" three paragraphs after the File List says it carries five authored blocks; the Debug Log claims a manual verification of "four figures in the reserved column … speaker foregrounded **and badged** (verified FR beat 2 → Marianne Cole, badge `Parle`)" — the reserved column was retired by this story's own revision and no badge exists; and `sprint-status.yaml:103` still describes a "56px figure column on both boards" and "no case.json change". Amend the Tasks and the Notes to match what shipped, and drop the verification claim for the badge until the badge exists.

### Deferred

- [x] [Review][Defer] `cardGeometry` has no clamp — a case with more or taller proposals pushes the first card off the top of the canvas and zeroes the room [`src/adapters/phaser/renderers/ColleagueRenderer.ts:755-760`] — deferred: unreachable today, `CaseDefinitionSchema.ts:512-513` pins both proposal arrays at `.length(4)`. The old `MIN_CARD_HEIGHT` clamp bounded the analogous failure; the inverted layout removed the clamp without replacing the bound. Worth a guard if a case ever authors a different count.
- [x] [Review][Defer] `CharacterStage.create()` runs once per scene, so the theory board's cast never rebuilds across `synthesis → review` [`src/adapters/phaser/renderers/ColleagueRenderer.ts:464-465`] — deferred: latent. `stageCast()` derives presence from `selectCasePhase(state)` at *create* time and `SceneRouter` does not restart a scene whose key is unchanged, so a `review` beat spoken by someone who authored no conclusion proposal would never be staged. Every shipped review speaker is also a conclusion proposer, so it is not observable. `CharacterStage.create`'s docstring justifies writing names once on the grounds that "the owner rebuilds this stage when the cast changes" — the owner does not. Story 3.4's authored `scenes[].cast` will trip it.
- [x] [Review][Defer] `FIGURE_SLOT_WIDTH` in the typography spec is derived from `colleagues.length` while the renderer derives its label wrap from `presentColleagueIds(...).length` [`tests/e2e/french-typography.spec.ts:120-124`] — deferred: equal for the shipped Young case, divergent the moment Story 3.4 lands the authored per-scene cast, which is exactly the change `presentColleagueIds` was written to accommodate.

### Review outcome — what changed, and what it cost

All 25 patches applied (the four decisions Alexis resolved among them). Three deferred, two dismissed.

**The load-bearing change: the conclusion board can host its cast, because the limitation left the card.**
Measured rather than argued — `ColleagueGeometry.test.ts` drives the real functions at the real canvas
size, and the numbers are these:

| | Before | After |
| --- | --- | --- |
| Card height (prediction / conclusion) | 88 / 116 | **84 / 84** |
| Card block, four cards | 382 / 494 | **366** |
| Reserved below the room (guide + its gap + clearance) | 46 — *missing the 8px gap* | **54** |
| Room band | 316 / 204 | **332** |
| Stage height at a two-line beat | 156 / **44** | **172** |
| Needed (96 legibility floor + 49 plaque) | 145 | 145 |
| **Figures staged on the conclusion board** | **0, at every panel height** | **4** |

The stated limitation is now drawn for the **chosen** proposal in the guide slot — a band already
reserved, directly above the cards, and idle once a choice is made. It costs no new pixels, which is
what made it the only option that fits: a 48px limitation block anywhere below the dialogue panel takes
the stage back below its floor, and I checked each alternative rather than assuming.

The plaque gained a third line for the `stage.speaking` badge (AC2's label), costing 14px, which the
card block's over-reserved bottom inset paid for: 88 → 84 reserves 10px below content that ends at 74.
Both boards now survive a **three**-line beat, where the old geometry gave out at two.

**Verified, not asserted:**

- `npm run typecheck` clean. `npm test` **911 passing across 55 files** (891/54 before).
- `npm run test:e2e` **49 passed / 7 failed at `--workers=5`** — the same seven baseline names carried
  since before 2.8, all on retired-DOM controls Story 2.12 owns. No new failure.
- Screenshotted on the running game at 1280×720 in **EN, FR and under `reduce`**: both boards and the
  rival lab. French plaques hold on one line (`Constructrice ou constructeur d'appareils`), the French
  stated limitation holds on one line in the guide slot, the badge reads `Parle`, and `reduce` paints a
  complete static staged frame with the speaker foregrounded.
- Three guards **mutation-proven**, per §Previous story intelligence: removing the colour working band
  fails the strict-ordering test on `#ffffff` and `#000000`; swapping the two proposal arrays in
  `boardProposerIds` fails the row-ordering tests; adding `defensible` to `ColleagueRenderer` fails the
  extended ADR-006 sweep (it fired for real on that file's own prose, which was rewritten rather than
  the sweep weakened).

**One cost, stated plainly.** At `--workers=9` — the default — `canvas-transitions.spec.ts` now exceeds
its 30s test budget and fails; at `--workers=5` it passes, and it passes in isolation under repetition.
It is not logically broken: the conclusion board now draws four figures and their plaques where it
previously drew none, and that test walks the whole case on a machine running nine browsers. **I did not
raise the timeout** — making a test pass is not a reviewer's call to take silently. It is recorded in
`deferred-work.md` against Story 2.10, which owns the NFR1 re-profile, with the measurement attached.

### Dismissed as noise

- `LaboratoryDecor` sitting outside the story's stated in-scope list — agreed with Alexis after the first rejection, recorded in Change Log 1.2, and it respects every binding constraint (fill commands only, no asset, no store read, no motion, no `update()`, destroyed by its owner, swept by the ADR-006 test).
- `DIALOGUE_PANEL_WIDTH = BOARD_TEXT_WRAP` reusing a value named as a text-wrap bound as a box width — verified benign: it is consumed as raw available pixels and `DialogueBox` subtracts its own gutters, and the spec imports the same symbol rather than restating it.

## Change Log

| Date | Version | Change | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 1.4 | **Code review — 25 patches applied, 3 deferred, 2 dismissed.** The load-bearing finding: the conclusion board staged **zero** figures at every panel height, so AC1, AC2 and AC3 were unmet on the two phases it hosts, and no test could see it because every staging test fabricated its band. Alexis resolved the four decisions: free the stated limitation from the card (it now shows for the *chosen* proposal, in the guide slot), draw the `stage.speaking` badge (authored in both locales and rendered by nothing until now — AC2's label), bump `case.json` to **1.14.0** with the save-compat allowlist extended, and back the rival-lab prose opaquely. Also: emphasis tweens killed before each new one and on a reduced-motion toggle; the speaker cleared when a conversation completes; plaque strings moved out of `create()` so a locale change reaches them; the cast re-resolved per render (which closed a deferred item); the legibility gate guarded on width; `MIN_COMPOSABLE_HEIGHT` derived rather than copied; the colour ramp given a working band so four tones stay four at every accent; `showRole` and the dead `t` removed; the ADR-006 sweep extended to `figureAppearance.ts` and `ColleagueRenderer.ts`; `resolveStageCast`/`boardProposerIds` extracted so the integration test drives production code instead of a copy of it; two tautological assertions replaced; new `ColleagueGeometry.test.ts` drives the real board geometry. Three guards mutation-proven. 911 unit tests across 55 files; e2e 49/7 at `--workers=5`, unchanged baseline names. | Link Freeman (via `gds-code-review`) |
| 2026-08-07 | 1.0 | Story created from `epics.md` §Story 2.9, the 2026-08-06 sprint change proposal, and the 2.7/2.8 review findings. | Alexis (via `gds-create-story`) |
| 2026-08-07 | 1.3 | **Second design revision, against the supplied cast design board.** Figures are no longer one silhouette recoloured: a new optional authored vocabulary (`portrait.figure` / `rivalLab.figure` — build, pose, hair, skin, spectacles, moustache; enums and booleans only, no authored colour) drives a rebuilt painter, with role-derived pose defaults so a case authoring nothing still gets people who differ. New Phaser-free `figureAppearance.ts` resolves it and derives four garment tones per accent. Amber-serif plaques per the board. Seven defects found by property test and screenshot — inverted `shade`/`tint` at the ends of the ramp, a 13px "reach", the blackboard framing Wren's head, winged shoulders, a cloth-coloured neck, a head too small to carry a face at the size the band allows, and a conclusion-board room that composed into a bright line — all fixed. Bell keeps four non-colour cues; his top hat dropped. | Amelia (via `gds-dev-story`) |
| 2026-08-07 | 1.2 | **Design revision after rejection.** Figures rewritten full-length in a row on a painted laboratory floor, each with a name-and-role plaque; board layout inverted so cards anchor to the floor and the room takes what is above; dialogue panel narrowed and speaker names coloured by accent; guide moved beside the cards; new `LaboratoryDecor`; cards recover their full 744px text wrap. Three defects found by screenshot (figures behind card backgrounds, rival at 24% size, décor painted over the entire surface) fixed with regression tests. Conclusion board's cast withheld below a legibility floor — see Completion Notes. | Amelia (via `gds-dev-story`) |
| 2026-08-07 | 1.1 | Implemented. `speakerId` added to the dialogue projection and a `getCurrentBeat()` accessor to `DialogueBox`; new Phaser-free `characterStageView` resolver and `CharacterStage` renderer drawing coded vector silhouettes with no asset; a 56px figure column on both proposal boards funded by narrowing the marker gutter; Mr. Arthur Bell staged off the rival-lab record with a distinct build, plinth and name plaque; `stage.speaking` authored EN+FR. Two defects found by screenshotting the running game (figures hidden behind card backgrounds; the rival drawn at 24% of his placed size) and fixed with regression tests. ADR-006 reachability and the French truncation guard both mutation-proven. | Amelia (via `gds-dev-story`) |

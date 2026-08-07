# Story 2.9: Colleague and rival-lab characters on stage

Status: ready-for-dev

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

- [ ] **Task 1 — Carry the speaker's identity to the surface (AC2)**
  - [ ] `src/core/store/selectors.ts`: add `speakerId: beat.speakerId` to `DialogueBeatProjection`. Keep `speaker` (the formatted attribution) exactly as it is — `DialogueBox` and `formatAttribution` both depend on it. **This is the load-bearing change of the story:** the projection today drops the `colleagueId` and keeps only the formatted string, so there is no way to know *whose* figure to foreground. Do not try to reverse-match the formatted string to a cast member.
  - [ ] `src/adapters/phaser/ui/DialogueBox.ts`: add `speakerId: string` to `DialogueBeatView` (it is documented as structurally `DialogueBeatProjection`; keep them matched), and expose the reading position so the owner can resolve the current speaker — `public getCurrentBeat(): DialogueBeatView | undefined`. It joins `getBottomY()` and `isComplete()` as an accessor; **do not** make the widget aware of the stage, the cast, or the store.
  - [ ] Verify the beat index is readable at the two moments the owner needs it: after `render()` (index 0 on a new conversation, clamped otherwise) and inside the existing `onAdvance` callback. `ColleagueRenderer.relayoutCards()` is already the `onAdvance` handler — re-stage from there.
  - [ ] A `speakerId` absent from `colleagues[]` (degraded cached `case.json`) must foreground nothing and throw nothing. `projectAttribution` already handles the label side via `colleague.unattributedSpeaker`.

- [ ] **Task 2 — The Phaser-free staging resolver (AC1, AC2, AC3, AC7)**
  - [ ] New `src/adapters/phaser/renderers/characterStageView.ts`, following `advanceView.ts` exactly: pure, no Phaser value import, no selectors import, no store import. It is what the unit tests drive.
  - [ ] Input: the already-resolved cast (`{ colleagueId, accentColor, name, roleLabel }[]` — resolved strings, never `LocalizedText`), the current `speakerColleagueId | undefined`, the row bands to stage into, the column geometry, and `motionAllowed`.
  - [ ] Output per figure: `{ colleagueId, x, y, width, height, scale, alpha, isSpeaker }`, plus the emphasis targets the renderer tweens toward. Freeze the result (`Object.freeze`) as every other projection here does.
  - [ ] Export every geometry constant. **Nothing in this module may accept, return, or reference a defensibility field** — that is what AC3 and ADR-006 pin, and Task 7's source-level test enforces it.
  - [ ] Positions are **total over the row count**: given N rows, every row gets a figure band, so a coordinate derived for four never lands in a gap at three. `libraryArtifactCentre` is the precedent.

- [ ] **Task 3 — The staging renderer (AC1, AC5, AC6)**
  - [ ] New `src/adapters/phaser/renderers/CharacterStage.ts` on the standard renderer contract: `create()` / `render(state)` / `destroy()`.
  - [ ] `create()`: one `Graphics` silhouette per figure plus its name/role label, **drawn once**. Flat display objects, not a `Container` (see `DialogueBox`'s docstring for why). Text created empty; every string written in `render(state)` through `createTranslator(locale)` — never in `create()`.
  - [ ] Draw the silhouette with fill commands only (head, shoulders, torso taper) tinted from the authored accent. Never re-stroke per frame: emphasis is applied with `setScale` / `setAlpha` / position, which reuse the existing geometry. No `loader` entry, no texture, no `assets.entries` addition.
  - [ ] Emphasis: `motionAllowed` → one short tween (≈160–200 ms, `Cubic.easeOut`) on scale/alpha/x. `reduce` → apply the target values immediately, register **no** update loop, start **no** tween. Subscribe to `window.matchMedia('(prefers-reduced-motion: reduce)')` and its `change` event; `ApparatusRenderer.ts:168-205` is the reference for the cached flag plus the `change` handler.
  - [ ] `destroy()`: remove the media-query listener, `scene.tweens.killTweensOf(this)` **and** `killTweensOf` every figure object, destroy all display objects, clear the arrays. The `targets: this` case is called out in AC6 and in the renderer contract because it is the one the codebase has already been bitten by.
  - [ ] No `update()` loop under any condition — tweens only. That is what makes AC5's "no update loop registers" true by construction rather than by a flag.

- [ ] **Task 4 — Stage the boards (AC1, AC2, AC3)**
  - [ ] `ColleagueRenderer` owns one `CharacterStage`, constructed in `create()` and destroyed in `destroy()` alongside `dialogueBox` and `advanceControl` (it owns its own objects, so it is deliberately **not** pushed onto `this.objects` — follow the `AdvanceControl` precedent at line 276).
  - [ ] Reserve a **left figure column** inside the proposal band. Each figure occupies the row of the card whose proposal that colleague authored, so the connection in AC3 is adjacency plus a shared accent plus a shared name. **Row order is proposal order, not cast order** — the two differ: prediction is `thea, elias, marianne, samuel`; conclusion is `marianne, elias, thea, samuel`.
  - [ ] `ProposalChoice` gains two options with exported defaults so the board can reserve the column without the widget knowing why: `contentInset` (today's `TEXT_LEFT_OFFSET = 26`) and `markerGutter` (today's `MARKER_GUTTER = 200`). `proposalTextWrapWidth` takes them rather than restating them. Do not fork the widget.
  - [ ] **`proposalTextWrapWidth` is imported by `tests/e2e/french-typography.spec.ts`.** Widening its signature ripples there: the spec must pass the values the *board* passes, not the widget's defaults, or it measures a rectangle that is never painted and keeps passing through exactly the truncation it exists to catch. That failure mode is recorded verbatim in `ColleagueRenderer.ts:70-81` about `SUBMIT_WIDTH` vs `ADVANCE_CONTROL_WIDTH` — the cheapest guard is to export the board's resolved bound as a named function and have both read it.
  - [ ] Re-stage on `render()` **and** on the dialogue advance (`relayoutCards`), because the card bands move with the panel's measured height and the speaker changes without any state change.
  - [ ] **Figures are never interactive.** Do not call `setInteractive` on a figure, its label, or any backing shape. Phaser draws in creation order and hit-tests topmost-first, so an interactive object over a card would swallow the click that chooses that proposal — an inert card with a live hand cursor, which is the exact defect class the 1.12 review found in `DialogueBox`.
  - [ ] **Create the stage before the cards**, so a figure can never paint over card text even if a future geometry change makes the column and the card overlap. The column is reserved, so this should be belt-and-braces — write it down as the reason, since creation order is the only depth mechanism these renderers use.
  - [ ] **Read the width budget below before choosing a single number.** Getting this wrong truncates authored claims silently.

- [ ] **Task 5 — Stage Mr. Arthur Bell (AC4)**
  - [ ] `RivalLabRenderer` reserves a right-hand stage column and narrows its prose by passing the reduced width to the existing `rivalLabTextWrapWidth(width)` helper — which already takes a width, so no new restatement.
  - [ ] Stage Bell through a **distinct input path**, not through the cast array: `selectLocalizedRivalLabCritique` already returns `{ speaker, line, accentColor }` and carries no defensibility field. He must never be pushed into `colleagues[]`, never resolved through `selectColleagueById`, and never counted by anything iterating the cast.
  - [ ] Make him visually distinct as a *silhouette*, not as a colour: a different build (taller, frock coat, hat brim) and a plinth or lectern. His accent is the authored `#8c3b3b`. Colour alone is explicitly insufficient (AC2's rule applies to the whole surface).
  - [ ] No score, timer, counter, setback, red failure treatment, or shake. The one control stays the floor-anchored revise control, unchanged.
  - [ ] Vertical space is available here: the body is unbounded prose and the guide is clamped above a floor-anchored control, so narrowing the wrap costs height that the existing clamp already absorbs. Do not anchor Bell to the prose's measured bottom — anchor him to the canvas, for the same reason the revise control is.
  - [ ] **Decide the 8px accent stripe explicitly.** `RivalLabRenderer` already draws a full-height accent rectangle in Bell's colour (`:98`, `:191-192`). Once he is a figure, keep it as a framing device *or* retire it — but say which and why in Completion Notes. Leaving two unrelated things carrying the same colour for no stated reason is what the reviews keep finding.

- [ ] **Task 6 — Locales (AC1, AC2)**
  - [ ] Every new player-facing string goes in **both** `src/core/i18n/locales/en.ts` and `fr.ts` in the same edit. The figure label reuses `colleague.attribution` / `colleague.role.*` / `rivalLab.role` — do not author a second attribution format.
  - [ ] Add a small speaking marker for the foregrounded figure (suggested key `stage.speaking`) so AC2's "label" is a real label rather than the dialogue panel's speaker slot doing double duty. Keep it short: it sits in a fixed-width column and the French must fit on one line.
  - [ ] **No `case.json` change and no `CaseDefinition.version` bump.** `portrait: { kind: 'silhouette', accentColor }` and `rivalLab.accentColor` already exist and are already validated. `scenarioScript.scenes[].cast?` belongs to **Story 3.4** — do not add it here.

- [ ] **Task 7 — Tests (AC7)**
  - [ ] `tests/unit/CharacterStageView.test.ts`: stage positions at 3 and 4 rows and at two canvas sizes (so a memorised dimension fails); speaker emphasis; no speaker; a `speakerId` not in the cast; the `motionAllowed` split.
  - [ ] `tests/unit/CharacterStageView.test.ts` (or a sibling): the **ADR-006 reachability test**. Read `characterStageView.ts` and `CharacterStage.ts` with `readFileSync` and assert neither mentions `selectDefensibleConclusionProposalIds`, `selectDefensibleConclusionIds`, `supportPredicate`, or `defensible`. `tests/e2e/canvasHelpers.ts` is the precedent for reading a project file inside a test. An argument in a comment is not an assertion.
  - [ ] The **reduced-motion assertion**: inject the structural slice (`{ tweens: { add, killTweensOf } }`, `{ add: { graphics, text } }`) rather than a real `Phaser.Game` — `SceneRouterTarget` is the reference pattern. Assert `tweens.add` is never called under `reduce`, and that the final scale/alpha/position match the motion path's targets.
  - [ ] `tests/integration/CharacterStaging.test.ts`: build the store from the authored Young case (as `RivalLabCritique.test.ts` does), and prove through public actions and selectors that (a) `selectDialogueBeats` carries `speakerId` for every beat in `prediction`, `synthesis`, and `review`, and that the phase transitions swap the conversation; (b) resolving the stage at successive reading positions foregrounds successively different colleagues, for a conversation whose speakers actually differ (`prediction` and `synthesis` each have three distinct speakers); (c) the accents come from `portrait.accentColor`. **Be honest about the seam:** the reading position is widget-local and is deliberately *not* in the store, so no public action can move it — the test drives the store for the beats and the resolver for the position, and asserts the pair. Do not add an `AppState` beat-index field to make a test easier; that contradicts `DialogueBox`'s stated contract and would have to be cleared on every phase move and replay.
  - [ ] `tests/e2e/french-typography.spec.ts`: update `CARD_TEXT_WRAP_WIDTH` to the new derived bound, add the narrowed marker wrap and any new fixed-height label to the **whole-string** `FIXED_HEIGHT_CONTROLS` sweep, and **add the truncation guard**: the longest French proposal text and conclusion claim must still wrap to no more than `BODY_MAX_LINES` lines at the new wrap. A per-token sweep provably cannot catch this. `BODY_MAX_LINES` must be exported so the spec reads it rather than restating `2`.
  - [ ] `tests/unit/DialogueBox.test.ts:119` builds its beats through a `beats(...ids)` helper — extend the fixture with `speakerId` and add coverage for `getCurrentBeat()` across a conversation change (index resets) and a shorter list (the defensive clamp). `tests/unit/DialogueBeats.test.ts` covers the projection side.
  - [ ] Check `tests/e2e/dialogue-advance.spec.ts` and `canvas-transitions.spec.ts` still land inside the cards: `lastProposalCardProbe` uses the band's centre x, which the figure column shifts content within but does not move — verify rather than assume.

- [ ] **Task 8 — Verify (AC5, AC6, and the standing gates)**
  - [ ] `npm run typecheck`, `npm test`, `npm run test:e2e`. **Measure your own baseline first** and compare failure *names*, not counts — see §Baseline below.
  - [ ] Manual check at 1280×720 in **EN and FR**: figures legible, no label truncated, no figure painted over card text or the advance control, Bell distinct from the cast, and under `prefers-reduced-motion: reduce` the boards paint a static staged frame with no tween.
  - [ ] Confirm by grep that `CharacterStage` registers no `scene.events.on('update')` and that `destroy()` removes the media listener and kills `targets: this` tweens.
  - [ ] NFR1 spot check only. The full 10-minute re-profile at 1280×720 with drag, staging, and propagation together is **Story 2.10's AC**, not this one — but note if staging visibly costs frames.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Change | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 1.0 | Story created from `epics.md` §Story 2.9, the 2026-08-06 sprint change proposal, and the 2.7/2.8 review findings. | Alexis (via `gds-create-story`) |

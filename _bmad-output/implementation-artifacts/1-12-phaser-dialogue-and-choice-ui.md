---
baseline_commit: 099f945
---

# Story 1.12: Phaser dialogue and choice UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want readable dialogue and clear choice controls inside the scenes,
so that I can follow the story and make decisions without leaving the Phaser surface.

## Acceptance Criteria

Verbatim from `epics.md` (Story 1.12), numbered for traceability:

1. **Given** a scene presenting colleague dialogue,
   **When** it renders,
   **Then** a reusable Phaser dialogue widget shows speaker, text, and an advance control,
   **And** the text is legible at 1280×720 and reflows without truncation.

2. **Given** a scene presenting a 1-of-N choice (prediction or conclusion),
   **When** it renders,
   **Then** a reusable Phaser choice widget shows each option's text and records the selection as a typed intent,
   **And** the selected option is visibly indicated by more than colour alone (label/state), with the choice remaining revisable.

3. **Given** the dialogue and choice widgets,
   **When** tests run,
   **Then** integration tests verify that selecting an option dispatches the expected intent and updates authoritative state.

## Scope and implementation decisions

This story is the **presentation layer** the pivot promised: two reusable Phaser widgets under
`src/adapters/phaser/ui/`, the minimum authored dialogue content to make the dialogue widget real, and
the refactor of `ColleagueRenderer` into the choice widget's first consumer. It adds **no new typed
action, no new state field, and no new record field** — the choice intents already exist from Story
1.11 (`prediction.proposalChosen`, `theory.conclusionProposalChosen`).

### IN scope

- `src/adapters/phaser/ui/DialogueBox.ts` and `src/adapters/phaser/ui/ProposalChoice.ts` — reusable,
  scene-agnostic widgets (Task 2–3).
- `ScenarioDialogueBeat.textKey` → `text: LocalizedText` (Task 1) — the current shape cannot be
  rendered at all; see the decision below.
- Authored dialogue beats for the `prediction`, `synthesis`, and `review` scenario scenes in the Young
  `case.json`, plus the version/allowlist/`CACHE_NAME` triad (Task 1, Task 6).
- `ColleagueRenderer` refactored to compose `DialogueBox` + `ProposalChoice`, preserving every 1.11
  review fix (Task 4).
- Overlay input suppression extended to the new advance control (Task 4).
- EN+FR for every new string, widget chrome and authored beat alike (Task 6).
- Unit tests for the pure beat selection, integration tests for choice dispatch (Task 7).

### OUT of scope — do NOT build here

| Not this story | Owner |
|---|---|
| `SceneNav.ts` (the third widget in the architecture tree) | No AC here — and a scene-owned "next" control invites a scene to advance the phase. Leave it unbuilt. |
| LibraryScene / DebriefScene content, and therefore *their* dialogue beats | Stories 2.1 / 2.3 |
| Significant-measure gate, colleague **hints**, conclusion unlock timing | Stories 2.3 / 2.6 |
| Rival-lab critique presentation, `rivalLabCritiques[]` | Story 2.5 |
| A general authoring contract for `scenarioScript` (branching, conditions, portraits) | Story 3.4 |
| Retiring any `src/ui/*` DOM panel | Stories 2.1, 2.3, 2.5 |
| Any new typed action, state field, or `CaseRecord` field | Nothing here needs one |
| Colleague portrait **images** (`portrait.kind === 'asset'`) | Still no art; keep the silhouette accent |

Author beats **only** for scenes that are real today. `LibraryScene` and `DebriefScene` are still
`PhasePlaceholderScene` subclasses (`src/adapters/phaser/scenes/PhasePlaceholderScene.ts`) — beats
authored for them would validate and render nowhere, which is worse than absent.

### Decision — `textKey` must become `text: LocalizedText`

`ScenarioDialogueBeat` today is `{ id, speakerId, textKey }` (`src/domain/cases/ScenarioScript.ts:13-17`),
a Story 1.10 placeholder whose comment says beats "reference localized copy by key". **That design
cannot be implemented**, for two independent reasons:

1. `translate(locale, key)` takes `key: TranslationKey`, which is `keyof typeof en`
   (`src/core/i18n/translate.ts:52-64`). A key authored in `case.json` is a plain `string`; passing it
   requires a cast, and the cast defeats the only mechanism that guarantees `fr.ts` has the key too.
2. It puts **case prose into the application bundle**. Every other authored string a player reads —
   `openingDispute`, proposal `text`/`claim`/`limitation`, source labels, debrief — is `LocalizedText`
   inside `case.json`. Case content is versioned and immutable (ADR-003); `en.ts`/`fr.ts` are interface
   chrome and ship with the build. Splitting one case's dialogue across both is a contract violation
   that Story 3.4 would have to undo.

So: `ScenarioDialogueBeat` becomes `{ id: string; speakerId: string; text: LocalizedText }`.
`speakerId` resolves to an authored `colleagues[]` entry (a new cross-field rule), so the dialogue box
can render the attribution through the same `projectAttribution` path the proposal cards use.

This is a case-contract change, which means **three coordinated edits, not one** (the trap from 1.1b,
`docs/i18n-authoring.md` §"Adding case content"):

| Edit | File | Miss it and |
|---|---|---|
| Bump `version` `1.7.0` → `1.8.0` | `public/cases/young-interference/case.json` | the contract change is untracked |
| Add `definition.version === '1.8.0' && ['1.2.0'…'1.7.0']` | `src/schemas/CaseRecordSchema.ts:154-156` | every saved investigation is discarded on upgrade (NFR12) |
| Bump `CACHE_NAME` `v5` → `v6` | `public/sw.js:13` | a returning offline player boots on stale content |

No `CaseRecord` change and no `schemaVersion` bump: dialogue beats are authored content, and nothing
about reading them is persisted (see the next decision).

### Decision — beat advancement is ephemeral, never store state

Which beat is showing is **widget-local state**. It is not in `AppState`, not in `CaseRecord`, and it
never touches the phase.

The precedent is explicit in `_bmad-output/project-context.md` §Engine: the archival book's "reading,
paging, and closing stay ephemeral — they never inspect evidence or alter progression." Dialogue
reading is the same class of thing. Putting a beat index in the store would mean a record field, a
migration, and a new way for a scene to look like it is driving progression — for a value whose only
correct behaviour on reload is "start the conversation again".

Consequences to honour:

- Reloading mid-conversation restores to the scene (the router already does that from the persisted
  phase) and to **beat 0**. That is correct, not a bug.
- Advancing past the last beat **does not** advance the phase, start a scene, or dispatch anything. The
  dialogue simply reaches its end and the widget reports "done" to its owner. The existing DOM panel
  buttons still drive every phase transition in this story.
- `DialogueBox` therefore never imports the store, never dispatches, and takes no `PhaserStoreAdapter`.
  It takes resolved strings and a callback. That is what makes it reusable.

### Decision — flat display objects, not `Phaser.GameObjects.Container`

Both widgets own a flat list of display objects and are positioned by their caller, exactly like
`ApparatusRenderer` and today's `ColleagueRenderer`. Do **not** wrap them in a `Container`:

- A `Container` has no natural hit area, so `setInteractive()` with no arguments does nothing — it
  needs an explicit `new Phaser.Geom.Rectangle(...)` plus `Phaser.Geom.Rectangle.Contains`. Verified
  against the installed typings: `Phaser.GameObjects.Container` (`node_modules/phaser/types/phaser.d.ts:20994`)
  declares `setSize`, `iterate`, `removeAll`, and `getBounds`, and inherits `setInteractive` from
  `GameObject` with no shape of its own.
- Container destruction, depth, and input-enable semantics are a second lifecycle to get right on top
  of the one the renderer contract already prescribes.

There is no benefit here that offsets that. Keep the pattern the codebase already proves.

### Decision — widget shape

Both widgets follow the established renderer-factory contract (`create()` / `render(...)` /
`destroy()`, the factory owns every display object it makes) but are **not** store-aware:

```ts
// src/adapters/phaser/ui/DialogueBox.ts
export type DialogueBeatView = Readonly<{ speaker: string; text: string }>;

export type DialogueBoxOptions = Readonly<{
    x: number; y: number; width: number;
    onAdvance?: (index: number) => void;   // fired after the index moves; ephemeral, never dispatches
    onComplete?: () => void;               // fired when the last beat is advanced past
}>;

export class DialogueBox {
    constructor(scene: Phaser.Scene, options: DialogueBoxOptions);
    create(): void;
    /** Re-renders from resolved strings. Re-supplying the same beats must NOT reset the index. */
    render(beats: readonly DialogueBeatView[], t: Translator): void;
    setInputEnabled(enabled: boolean): void;
    /** Measured, so the owner can lay out beneath it instead of guessing. */
    getBottomY(): number;
    isComplete(): boolean;
    destroy(): void;
}
```

```ts
// src/adapters/phaser/ui/ProposalChoice.ts
export type ProposalChoiceOptions = Readonly<{
    x: number; y: number; width: number; height: number;
    accentColor: number;
    onChoose: () => void;   // the owner dispatches; the widget does not know the store exists
}>;

export class ProposalChoice {
    constructor(scene: Phaser.Scene, options: ProposalChoiceOptions);
    create(): void;
    render(projection: LocalizedProposalProjection, isSelected: boolean, t: Translator): void;
    setInputEnabled(enabled: boolean): void;
    destroy(): void;
}
```

`render` taking a `Translator` rather than a `Locale` keeps the "never author copy in `create()`" rule
trivially satisfiable and the widget free of `selectLocale`.

**`render` must be idempotent on unchanged input.** `ColleagueRenderer` re-renders on *every* store
notification, so a `render` that reset the dialogue index would snap the conversation back to beat 0
whenever any unrelated action dispatched.

### Decision — dialogue is static; no reveal animation

No typewriter effect, no fade, no tween. `_bmad-output/project-context.md` §Engine requires every
animated renderer to subscribe to `prefers-reduced-motion`, register no update loop under `reduce`,
and paint a static frame — a reveal animation buys nothing here and costs that whole apparatus plus a
test. If a later story adds one, it inherits that requirement.

### Decision — the layout budget, and why it is measured

Adding a dialogue box above the four proposal cards takes vertical space the cards currently divide.
`ColleagueRenderer` computes `available = scale.height - CARDS_TOP - 24` with `CARDS_TOP = 132`
(`ColleagueRenderer.ts:40,110`). **Do not replace 132 with a second magic number.** Derive the cards'
top from `dialogueBox.getBottomY()` plus a named gap constant, so a longer French beat pushes the
cards down instead of drawing on top of them.

**Legibility at 1280×720 (AC1) is a scale calculation, not a font-size preference.** The game is a
1024×768 design surface with `Scale.FIT` and `CENTER_BOTH` (`src/game/main.ts:34-47`). In a 1280×720
viewport, FIT is height-bound: 720/768 = **0.9375**. Every design-space font size renders at 93.75% of
its nominal CSS pixels. A 15px design size lands at ~14.1 CSS px; **do not author dialogue body text
below 16px design size** (≈15 CSS px rendered). `tests/e2e/french-typography.spec.ts` already runs at
exactly this viewport and locale (`test.use({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' })`).

"Reflows without truncation" and `maxLines` are in tension. Prefer a **measured** dialogue body — give
the text a `wordWrap` width and let the box grow to the measured height, then place the cards beneath
it — over clipping with `maxLines`. Truncation is the failure mode the AC names.

## Tasks / Subtasks

- [x] **Task 1 — Beat content contract (AC: 1)**
  - [x] `src/domain/cases/ScenarioScript.ts`: change `ScenarioDialogueBeat` to
        `{ id: string; speakerId: string; text: LocalizedText }`. Import the `LocalizedText` type from
        `./CaseDefinition`. Pure TypeScript — no Zod, no Phaser. Replace the now-wrong "reference
        localized copy by key" comment.
  - [x] `src/schemas/CaseDefinitionSchema.ts:255-259`: `ScenarioDialogueBeatSchema` becomes
        `{ id: stableId, speakerId: stableId, text: LocalizedTextSchema }`, still `.strict()`.
  - [x] Add cross-field rules in the **existing top-level `superRefine`** (`CaseDefinitionSchema.ts:303`,
        where every other cross-field rule already lives — not in `ScenarioScriptSchema`'s own
        refinement, which cannot see `colleagues`):
    - every beat `speakerId` resolves to an authored `colleagues[]` id;
    - beat `id`s are unique **within a scene** (across scenes they may repeat — a scene is the unit);
    - apply the existing `encodesPath` check to every beat `text` in both locales, as Task 2 of Story
      1.11 did for proposal copy. Authored copy must not name a scene, phase, or route.
  - [x] Unit tests in `tests/unit/CaseDefinition.test.ts`: the valid fixture parses (assert on
        `parsed.data`, never the input object); each new rule rejects **independently**, asserted by its
        authored message rather than a bare `success: false` — several mutations trip a neighbouring
        rule too, and a boolean assertion could not tell which rule fired nor fail if the rule under
        test were deleted (1.11 review).

- [x] **Task 2 — `DialogueBox` widget (AC: 1)**
  - [x] New `src/adapters/phaser/ui/DialogueBox.ts` — first file in a new directory that the
        architecture target tree already names (`game-architecture.md:391`). It is not a generic
        catch-all; do not put anything store-aware or case-specific in it.
  - [x] Implement the shape in the decision above. Own every display object, tween, timer, and listener
        it creates; release all of them in `destroy()`.
  - [x] Render: a panel background, the speaker attribution line, the beat body (wrapped, measured), a
        beat counter (`{index} / {total}`), and an interactive advance control.
  - [x] The advance control must show its **end state** as a label, not by disappearing silently — the
        last beat's control reads "done"-style copy and further clicks are no-ops.
  - [x] `setInputEnabled(false)` calls `disableInteractive()` on the advance control, mirroring
        `ColleagueRenderer.applyInputState` (`ColleagueRenderer.ts:134-139`).
  - [x] `getBottomY()` returns the measured bottom edge (panel top + measured content height), so the
        owner lays out beneath it rather than against a constant.
  - [x] No animation, no `update()` loop, no per-frame work.
  - [x] Text objects are created **empty** and populated in `render` — `create()` runs once and the
        locale can change (`project-context.md` §Engine).

- [x] **Task 3 — `ProposalChoice` widget (AC: 2)**
  - [x] New `src/adapters/phaser/ui/ProposalChoice.ts`. Extract, do not reinvent: every behaviour
        below already exists in `ColleagueRenderer.createCard`/`render` and is there because a review
        found the bug it prevents. Moving it must not lose it.
    - the interactive background rectangle and `useHandCursor`;
    - the coloured accent stripe with the `NEUTRAL_ACCENT` fallback for a non-silhouette portrait;
    - the attribution line, with the **unattributed fallback** that renders the standalone label instead
      of `'{name} — {role}'` with an empty role (`ColleagueRenderer.ts:200-202`);
    - the body text with `wordWrap` and `BODY_MAX_LINES`;
    - the optional limitation line placed under the body's **measured** height (`LIMITATION_TOP_GAP`),
      never bottom-anchored — the 1.11 review found ~3px of slack against today's French copy;
    - the selected-state **label** marker (`✓ Chosen` / `Choose this`) as the carrier of state, with
      tint and fill as reinforcement only (AC2: more than colour alone);
    - `setInputEnabled`.
  - [x] The widget calls `onChoose()` and nothing else. It does not import the store, the adapter, any
        selector, or `selectDefensibleConclusionProposalIds`. A widget that could read the defensible
        set could mark the "right" answer, which ADR-006 and Story 1.11 AC3 both forbid.

- [x] **Task 4 — `ColleagueRenderer` composes both widgets (AC: 1, 2)**
  - [x] Refactor `src/adapters/phaser/renderers/ColleagueRenderer.ts` to own one `DialogueBox` and four
        `ProposalChoice` instances instead of building cards inline. This is the consumer Story 1.11
        deliberately deferred ("Story 1.12 extracts the reusable `DialogueBox` / `ProposalChoice`
        widgets and this renderer becomes their consumer", `ColleagueRenderer.ts:21-23`).
  - [x] Keep in the renderer (they are store concerns, not widget concerns): the heading, the guide
        line, the **transient error on a refused click** (`ColleagueRenderer.ts:151-162,184-188` — a
        `chooseProposal` during an exclusive progress operation legitimately fails and must not be
        silent), and the localized projection lookups.
  - [x] Resolve the beats for the current scenario scene and pass them to the dialogue box as resolved
        strings. Beats come from the scene entry matching the **live phase** — `TheoryBoardScene` hosts
        both `synthesis` and `review`, which are separate scenario-script entries with their own beats.
  - [x] Lay the cards out from `dialogueBox.getBottomY() + CARDS_GAP`, replacing the `CARDS_TOP = 132`
        constant. Keep the `Math.max(72, …)` floor so four conclusion cards with a limitation line still
        fit 768px.
  - [x] `setInputEnabled` must now cover the dialogue advance control **as well as** the cards. Missing
        this reintroduces the exact 1.11 review defect: the reference book is reachable in every phase,
        its own surface is disabled during its open/turn/fade animations while still painted, and a
        page-turn click falls through to whatever is underneath.
  - [x] `destroy()` destroys both widgets and clears every reference. No tween, listener, or display
        object outlives it.
  - [x] Construction stays cheap and defensive: `create()` runs synchronously inside
        `dispatch() → notify()`, so a throw advances the phase, skips every later subscriber, and breaks
        `dispatch`'s `Result` contract (Story 1.10 review).

- [x] **Task 5 — Beat selection (AC: 1)**
  - [x] Add `selectDialogueBeats(state)` to `src/core/store/selectors.ts`, returning the beats of the
        scenario scene matching the current phase, projected to `{ id, speaker, text }` with the active
        locale applied via `resolveLocalizedText`, and the speaker attributed through the existing
        `projectAttribution` helper (`selectors.ts:198-206`) so the unattributed fallback is shared
        rather than duplicated. Return a frozen empty array when the scene authors no beats.
  - [x] Unit-test it in `tests/unit/` against fixtures: beats for the live phase only; both locales;
        empty for a scene with no beats; the unattributed fallback for a degraded definition.

- [x] **Task 6 — Content and EN + FR (AC: 1, 2)**
  - [x] Author `dialogueBeats` in `public/cases/young-interference/case.json` for the `prediction`,
        `synthesis`, and `review` scenario scenes. Two to four beats each — enough to prove speaker
        rotation and paging, short enough to stay inside the layout budget. Voices per
        `narrative-design.md` §Young Team: Thea Young (lead) frames, Elias Wren (builder) is practical,
        Marianne Cole (analyst) is precise and unwilling to accept beauty as proof, Samuel Hart
        (communicator) clarifies.
  - [x] Beat copy must **point at the choice, never at the answer**: consultations and dialogue may
        name an observable, a source, an alternative test, or a limitation, and never supply the
        conclusion. No beat may imply which proposal is correct.
  - [x] Bump `version` `1.7.0` → `1.8.0`; extend the allowlist in `validateCaseRecordForDefinition`
        (`src/schemas/CaseRecordSchema.ts:154-156`) so `1.8.0` accepts `1.2.0`–`1.7.0`; bump
        `CACHE_NAME` `quantique-bootstrap-v5` → `v6` (`public/sw.js:13`). All three, or a returning
        player loses their investigation or boots on stale content.
  - [x] `src/core/i18n/locales/en.ts`: a `// --- Dialogue ---` block with the advance-control label, its
        end-state label, and the beat counter (`'{index} / {total}'`). Add the identical keys to
        `fr.ts` — `tsc` will demand them.
  - [x] Author `fr` for every new beat `text`. A missing `fr` is a base-parse Zod failure, not a
        warning.
  - [x] Extend `WRAPPED_SURFACES` in `tests/e2e/french-typography.spec.ts` with every new wrapped
        surface, using the widget's real font size and wrap bound. Note the 1.11 review finding: that
        spec's pass condition is **per-token width** while its sampling picks one string per set by
        total length, so a short string containing one long token can slip through. Sample the authored
        beats accordingly.
  - [x] i18n surface checklist before calling this done: dialogue beat body · speaker attribution ·
        advance label · advance end-state label · beat counter · every string the refactor moved into a
        widget. Content translation is this project's most-repeated defect — enumerate, do not assume.

- [x] **Task 7 — Tests (AC: 3)**
  - [x] Integration test (extend `tests/integration/ProposalSelection.test.ts` or add a sibling) using a
        **real `createStore`**: choosing a prediction option dispatches `prediction.proposalChosen` and
        the authoritative state carries both the proposal ID and the canonical `prediction`; the same
        for the conclusion; re-choosing succeeds and replaces (revisable, AC2); an unauthored ID returns
        a typed `Result` failure and leaves state untouched.
  - [x] Assert **public actions and selectors** — never widget internals, Phaser private fields, or
        incidental pixels.
  - [x] Write tests that **can fail**. The 1.10 review found three that could not: one asserted the
        input fixture rather than `parsed.data`, one asserted the initial phase it had just set, one
        forged state with `Object.assign` instead of the function under test.
  - [x] Never assert a magic number that a test shares with source unless both read one exported
        constant (the book-control width is three unlinked literals today — do not add a fourth case).

- [x] **Task 8 — Verify (AC: 1–3)**
  - [x] `npm run typecheck` clean.
  - [x] `npm test` green, reconciled against a **measured** baseline (`git stash push --include-untracked`,
        run, `git stash pop`) — 372 passing at `099f945`. State what you measured, not what you counted.
  - [x] `npm run test:e2e` shows **no new failures beyond the tracked 7-spec baseline** (see below).
  - [x] **Re-check `tests/e2e/scene-router.spec.ts`.** `clickApparatusIncrease` clicks design coordinate
        (540, 603) to prove the laboratory was torn down (`scene-router.spec.ts:14`). With `TheoryBoard`
        active, that coordinate currently lands inside a proposal card — the 1.11 review found and
        restructured this. **Moving the cards down moves what that coordinate hits.** Re-verify the
        spec's assertions still test what they claim; fix the probe rather than letting it pass for a
        new wrong reason.
  - [x] Confirm the pre-pivot DOM flow still completes end to end. This story does not touch
        `src/ui/*`.

## Dev Notes

### Read these files before writing code

Every one is modified by, or directly constrains, this story:

| File | Why |
|---|---|
| `src/domain/cases/ScenarioScript.ts` | The beat shape you are changing; `SCENE_KEYS` and the phase→scene contract |
| `src/schemas/CaseDefinitionSchema.ts` | `ScenarioDialogueBeatSchema` (:255), `LocalizedTextSchema` (:15), `encodesPath`, and the top-level `superRefine` (:303) where cross-field rules go |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts` | **Read every line.** Each constant and guard encodes a 1.11 review finding; the refactor must carry all of them |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts` | The renderer-factory contract, the `setInputEnabled` pattern, and the `reducedMotionQuery` precedent (:64) |
| `src/adapters/phaser/scenes/ColleaguesScene.ts` / `TheoryBoardScene.ts` | The scene lifecycle and the overlay-suppression wiring the widgets plug into |
| `src/game/main.ts` | Canvas 1024×768 + `Scale.FIT` (the 0.9375 factor), and the `isOverlayVisible` / `setProposalInputEnabled` wiring (:56-67) |
| `src/core/store/selectors.ts` | `LocalizedProposalProjection` (:189) and `projectAttribution` (:198) — reuse, do not parallel |
| `src/core/i18n/translate.ts` | Why `textKey` cannot work: `TranslationKey = keyof typeof en` (:52) |
| `src/schemas/CaseRecordSchema.ts` | The compat allowlist (:154) and the proposal-text sanitization the version bump must not disturb |
| `docs/i18n-authoring.md` | Read §"⚠️ Canonical-value traps" and §"Adding case content" in full before touching any text field |

### What must not break

- **The DOM panels in `src/ui/*` are still the surface the E2E suite drives the flow through.** Story
  1.10 kept them deliberately; 2.1/2.3/2.5 retire them scene by scene. This story is purely additive
  to them. Do not delete, rewire, or localize `CaseContextAndPrediction.ts` or `TheoryBoard.ts` — they
  read authored text as canonical `.en` and use `selectCanonicalSourceLabel` /
  `selectCanonicalControlValue` on purpose (mixing locale-aware selectors in produces half-French
  output).
- **`LectureBookScene` is auto-started and always active**, so the game always has ≥2 live scenes and
  "the active scene" is not single-valued. Its overlay covers the whole canvas and is reachable in
  every phase. Every new interactive surface must be suppressible through the existing
  `setProposalInputEnabled` path.
- **The proposal ID ↔ canonical text invariant.** `validateCaseRecordForDefinition` sanitizes a record
  whose `selected*ProposalId` no longer matches its stored `.en` text. Nothing in this story changes
  proposal text — keep it that way, or saved attributions silently drop.
- **`createAppStateFromCaseRecord` reads `compatible.value`, not the argument.** The 1.11 review fixed a
  "validate, then read the argument again" bug there. Do not reintroduce the shape.

### Architecture compliance

- **ADR-001 v1.1** — Phaser is the sole interactive presentation surface. **Never add a semantic HTML
  control to mirror a Phaser gesture.** The DOM-parity requirement was retired 2026-08-05.
- **ADR-003** — case content is versioned JSON validated at runtime; invalid content returns a typed
  `Result` **before** domain logic. `loadCaseDefinition` already does this; your job is to make the
  schema reject correctly.
- **ADR-006** — dialogue and proposals are case data over authoritative evidence. Rules may vary lines
  and guidance; they never change a case's outcome or bypass required observations and sources.
- **ADR-008** — accessibility is de-scoped from MVP. Do **not** add new a11y-parity assertions; do
  **not** delete the existing a11y specs either. The reduced-motion / no-flashing guard is retained.
- **ADR-009** — the `scenarioScript` owns the phase→scene map; scenes **mirror** phase and must never
  define, infer, or advance it. Dialogue advancement is not phase advancement.
- **ADR-010** — no display string is hard-coded in a scene, widget, or renderer.
- **Layering** — `src/domain/` stays pure TypeScript: no Phaser, DOM, `fetch`, IndexedDB, **and no
  Zod**. Phaser objects exist only under `src/adapters/phaser/`. `src/core/` holds the store, i18n,
  errors, and `Result`. `src/schemas/` owns every Zod schema. The dependency direction never reverses.
- **The evaluator is the sole completion authority.** A widget must never decide, display, or imply
  which conclusion is correct.
- **Naming** — `PascalCase.ts` for classes/scenes/renderers/widgets, `camelCase.ts` for function
  modules, `kebab-case` for case/asset IDs, `noun.verb` for domain events, `domain.verbPastTense` for
  typed actions, `camelCase` for JSON fields.

### Previous-story intelligence

**From 1.11 (colleague cast) — the review found 13 patchable defects. Five are directly reachable from
this refactor:**

- **Full-canvas interactive surfaces with no enable/disable path.** The cards span x 40–984 across
  nearly the whole canvas. Every new interactive object needs `setInputEnabled` from day one.
- **A swallowed `Result` on a premise that was false.** `chooseProposal` was assumed to fail only on an
  unauthored ID; `progress-operation-active` is also reachable, because `CaseProgressPanel` holds
  `acquireExclusiveOperation()` across an `await`ed import/save and `createStore` short-circuits every
  dispatch in that window. Keep the transient-error path.
- **Two objects sharing a fixed window with ~3px of slack and no measurement.** Measure; do not
  bottom-anchor against a computed top.
- **`toMatchObject` ignores extra keys**, so pairing it with a one-name blacklist tested nothing. Use
  exact `toEqual` for "this projection carries nothing more".
- **A test that passed for the wrong reason.** The scene-router probe's coordinate landed inside a
  proposal card and silently rewrote the conclusion; nothing asserted the conclusion survived. Task 8
  makes re-checking it explicit.

**From 1.10 (scene router):**

- A scene's `create()` runs **synchronously inside `dispatch() → notify()`**. A throw leaves the phase
  advanced, skips every later subscriber, and makes `dispatch` throw instead of returning its
  contracted `Result`. Keep widget construction cheap and defensive.
- Exhaustiveness the type system does not enforce is a runtime stuck-state. `Record<K, V>` over a key
  union beats an array of tuples.
- Any signal written from *intent* rather than from the real event drifts from reality. Assert on
  rendered artifacts, not on "we called start".
- Documentation drift was caught in review — test counts that did not reconcile, a Debug Log claim
  contradicted by a reproducible baseline. **State only what you measured.**

**From 1.1b (i18n):**

- **`${localizedText}` inside a template literal compiles fine and prints `[object Object]`.** `tsc`
  catches the assignment sites, not the interpolation sites. Grep your own diff for it.
- A required field added to the strict case schema means **three** coordinated edits (version,
  allowlist, `CACHE_NAME`). Missing the third boots a returning offline player into "content
  unavailable".
- **Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback.** It converts a
  forgotten call site from a `tsc` error into a French player silently reading English. Widget `render`
  taking a `Translator` avoids the question entirely.

**Git patterns** — the last three commits are `Story 1.11` → `Dev 1.11` → `Review 1.11`, matching 1.10
and 1.1b. The repo is clean on `main`; branch before committing.

### Testing standards

- Vitest for `tests/unit/**` and `tests/integration/**` (`npm test`); Playwright chromium for
  `tests/e2e/**` (`npm run test:e2e`, which runs `npm run build && npm run preview` on
  `127.0.0.1:4173`, with `PLAYWRIGHT_BROWSERS_PATH=0`).
- **Never require Phaser or a browser to test logic that is not Phaser's.** Vitest has no canvas. Beat
  selection is a pure selector — test it directly. To test Phaser-adjacent logic, inject the structural
  slice you need; `SceneRouterTarget` (`src/adapters/phaser/SceneRouter.ts:10-20`) is the reference
  pattern.
- Integration tests assert public actions and selectors, not renderer internals or incidental pixels.
- Invalid case content is tested as an expected `Result` failure; valid local progress must survive a
  failed import or save.
- **Regression baseline** — `npm run test:e2e` currently reports **7 pre-existing failures** tracked in
  `_bmad-output/implementation-artifacts/deferred-work.md`: `accessibility`, `curated-record:179`,
  `inquiry-recognition`, `offline-reload:72`, `progress-portability`, `theory-board`, and
  `young-experiment:12` (six on the removed `Record prepared observation` notebook button, one on the
  hard-`disabled` Run experiment control). Measure the baseline with `git stash` before you start and
  match it exactly afterwards. **Do not fix them here** — and check the baseline before attributing any
  failure to your change.

### Project structure notes

- **New files:** `src/adapters/phaser/ui/DialogueBox.ts`, `src/adapters/phaser/ui/ProposalChoice.ts`,
  plus the unit test for beat selection.
- `src/adapters/phaser/ui/` is new but architecture-prescribed (`game-architecture.md:391`). It is
  **not** a generic catch-all — the "no `services/` / `managers/` / `helpers/`" rule still stands, and
  only scene-agnostic Phaser widgets belong here.
- **Do not confuse `src/adapters/phaser/ui/` with `src/ui/`.** The latter holds the retired DOM panels
  (still mounted by `src/main.ts`, not to be extended) plus the one surviving DOM surface,
  `src/ui/print/CaseRecordPrintView.ts`.
- `src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` are **orphaned Phaser-template
  leftovers referenced nowhere.** They are not the scene layer. Do not wire, extend, or imitate them.
- The architecture tree also shows `src/app/`, `createPhaserGame.ts`, `BootScene`, `CaseLoadScene`, and
  `RivalLabScene`. **None exist and none are this story's job** — 1.10 deliberately left that
  divergence. Add files under the existing `src/adapters/phaser/` layout.
- **Edit only `public/cases/…`.** `dist/` is build output and `.claude/worktrees/**` is a stale copy.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.0, 2026-08-06 — current, post-pivot; it
supersedes any artifact dated before 2026-08-05, including the UX designs).

**Stack — do not add a dependency.** Phaser 4.2.1 · TypeScript ~5.7.2 · Vite 8.1.5 · Node 20.18.1+ ·
`idb` 8.0.3 · Zod 4.4.3 · Vitest 4.1.10 · Playwright 1.61.1. `@axe-core/playwright` 4.12.1 remains
installed but is no longer a release gate.

**Engine:**
- Phaser scenes own all interactive presentation; the only non-Phaser surface is the portable record.
- Never add a semantic HTML control to mirror a Phaser gesture.
- Do not extend, restyle, or add to `src/ui/*` panels; build the feature as a scene/renderer/widget.
- The store is authoritative: read through selectors, write only typed actions through `dispatch`. No
  direct state mutation, **no scene→scene reach-in**.
- Renderer contract: `create()` / `render(state)` / `destroy()`; the renderer owns every display
  object, tween, timer, and listener it creates, and `destroy()` releases all of them — including
  tweens whose target is the renderer itself.
- **Never author player-facing copy in `create()`.** Create text empty, populate in `render`.
- Honour `prefers-reduced-motion` in every animated renderer. (This story authors no animation, which
  satisfies it trivially — if you add one, you inherit the requirement.)
- Cap text resolution at `min(devicePixelRatio, 2)` — `textStyles.textResolution()` already does.
- Sticky canvas: `this.scale.updateBounds()` from a *passive* window scroll listener registered and
  removed by the scene lifecycle. Browser tests must scroll before exercising in-canvas controls.

**Guided adventure:**
- Everything is authored; nothing is freeform.
- Prediction and conclusion are each 1-of-4; schemas use `.length(4)`, not `.min(4)`.
- Choices are revisable — re-choosing must never fail on "already chosen".
- Defensibility is evaluator/critique-only. Never expose a proposal as correct up front, and never leak
  a defensibility field into a display projection.
- Consultations and dialogue point at missing evidence, a source, an observable, or a test. They never
  supply the answer.
- No hard-fail states, irreversible wrong choices, speed rewards, or rewards for overclaiming.
- Authored copy must not name a scene, phase, or route (the `encodesPath` check).

**i18n:** EN+FR from launch; locale from the browser, held in the store, **no player-facing language
selector**. Every new content surface inherits the EN+FR requirement as part of its own acceptance
criteria — this is the project's most-repeated defect. Player prose is `LocalizedText` resolved with
`resolveLocalizedText`; interface strings go through `translate`/`createTranslator`; proper nouns stay
plain strings. **Do not add a webfont** — the stacks in `textStyles.ts` already cover the French
repertoire, and a download costs NFR2's cached five-second first interaction plus an offline-gate
asset.

**Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal — prefer store
subscriptions and Phaser events over per-frame work. No logging, JSON parsing, IndexedDB access, DOM
manipulation, or transient allocation in render hot paths. Pool only after profiling.

**Organization:** every Zod object is `.strict()`. Fallible operations return `Result<T, ResultError>`
rather than throwing; error codes resolve to localized copy. Bump `CaseDefinition.version` on any
contract change and keep the record-compatibility allowlist honest. Case definitions under
`public/cases/` are immutable and never mixed with player progress.

**Build:** static hosted app; offline reload is a release gate; no network request may block core play.
Never expose a raw error to the player. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.

### Latest technical information

- **Phaser 4.2.1** — verified against the installed typings, not from memory:
  - `Phaser.GameObjects.Text` supports `setWordWrapWidth`, `setMaxLines`, `setFixedSize`,
    `getWrappedText`, and `displayHeight`. There is **no `getLineCount()`** — measure via
    `getWrappedText(...).length` or `height`/`displayHeight`.
  - `Phaser.GameObjects.Container` (`phaser.d.ts:20994`) has `setSize`, `iterate`, `removeAll`,
    `getBounds`, and inherits `setInteractive` from `GameObject` — it declares no hit area of its own,
    so `setInteractive()` with no shape does nothing on a Container. This story uses flat display
    objects instead; see the decision above.
  - `Phaser.GameObjects.Text` renders through the canvas 2D API, so glyph coverage is the browser's
    font resolution. Use the stacks in `src/adapters/phaser/textStyles.ts` (`uiTextStyle` for chrome,
    `bookTextStyle` for the archival book, `monoTextStyle` for dev markers only).
  - Phaser word-wrap **cannot break inside a word**, so a single token wider than its bound is the
    overflow that actually clips — which is what `french-typography.spec.ts` measures.
- **Zod 4.4.3** — `superRefine` is **skipped once the base parse fails**, so put a rule where its
  message will actually surface: a cross-field rule needing an authored message belongs in the base
  object or the top-level refinement. Issue construction is `{ code: 'custom', message, path }`; do not
  import legacy `ZodIssueCode`. Recursive schemas need `z.lazy` with an explicit `z.ZodType<T>`
  annotation — not needed here, beats are flat.
- **Scale factor at the NFR1 viewport:** 1024×768 design surface, `Scale.FIT`, 1280×720 viewport →
  height-bound at **0.9375**. Design font sizes render at 93.75% of nominal CSS pixels.

### Notes on stale artifacts

- `_bmad-output/planning-artifacts/ux-designs/` is dated **2026-08-04, before the pivot**. It contains
  no dialogue-widget guidance and its dual-surface/accessibility patterns are superseded. Do not mine
  it for this story's UI.
- `_bmad-output/implementation-artifacts/epic-1-context.md` describes the pre-pivot Epic 1 ("semantic
  HTML is authoritative", dual-surface parity, manual a11y checks). Superseded by
  `project-context.md` v2.0 and `game-architecture.md` v1.1.
- `epics.md` FR/NFR coverage-map story references are known-stale (tracked in `deferred-work.md`).

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.12: Phaser dialogue and choice UI] — ACs, verbatim.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10 / 1.11 / 2.1 / 2.3 / 2.5 / 2.6 / 3.4] — the scope boundary: router, cast, library, gate, critique, hints, authoring contract.
- [Source: _bmad-output/planning-artifacts/epics.md#FR22, #UX-DR5] — dialogue carries the observation prompt and explanation layer; dialogue and hints never auto-solve the case.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md] — the pivot to a Phaser guided adventure.
- [Source: _bmad-output/game-architecture.md#Directory structure] — `adapters/phaser/ui/{DialogueBox.ts,ProposalChoice.ts,SceneNav.ts}`.
- [Source: _bmad-output/game-architecture.md#Dialogue, Colleague Proposals, and Rival-Lab Critique] — dialogue is case data; rules vary lines but never the outcome.
- [Source: _bmad-output/game-architecture.md#Content Model] — `scenarioScript` owns the ordered scene flow and its dialogue beats.
- [Source: _bmad-output/game-architecture.md#ADR-001, ADR-003, ADR-006, ADR-008, ADR-009, ADR-010] — single Phaser surface, validated data-driven cases, evidence-driven narrative rules, a11y de-scope, scene-router flow, bilingual foundation.
- [Source: _bmad-output/narrative-design.md#Young Team, #Dialogue Framework, #Branching Dialogue System] — the four voices; mostly linear dialogue with evidence-responsive feedback; micro-cutscenes are skippable; weak evidence never hard-fails.
- [Source: _bmad-output/project-context.md] — revision 2.0, the binding rule set.
- [Source: docs/i18n-authoring.md#Canonical-value traps, #Adding case content] — the `.en` canonical rule and the version/allowlist/`CACHE_NAME` triad.
- [Source: src/domain/cases/ScenarioScript.ts] — the beat shape being replaced.
- [Source: src/schemas/CaseDefinitionSchema.ts#ScenarioDialogueBeatSchema, #superRefine] — where the new rules go.
- [Source: src/core/i18n/translate.ts#translate] — `TranslationKey = keyof typeof en`, why `textKey` cannot work.
- [Source: src/adapters/phaser/renderers/ColleagueRenderer.ts] — every behaviour the extraction must preserve.
- [Source: src/adapters/phaser/renderers/ApparatusRenderer.ts] — the renderer-factory contract and `setInputEnabled` pattern.
- [Source: src/adapters/phaser/scenes/ColleaguesScene.ts, #TheoryBoardScene.ts] — the scene lifecycle the widgets plug into.
- [Source: src/game/main.ts] — canvas 1024×768 + `Scale.FIT`; the overlay-suppression wiring.
- [Source: src/core/store/selectors.ts#LocalizedProposalProjection, #projectAttribution] — the projection to reuse.
- [Source: src/schemas/CaseRecordSchema.ts#validateCaseRecordForDefinition] — the compat allowlist the version bump must extend.
- [Source: tests/e2e/french-typography.spec.ts] — the 1280×720 / fr-FR measurement harness to extend.
- [Source: tests/e2e/scene-router.spec.ts] — the coordinate probe a layout change invalidates.
- [Source: _bmad-output/implementation-artifacts/1-11-colleague-cast-and-proposal-system.md#Review Findings] — the 13 defects this refactor must not reintroduce.
- [Source: _bmad-output/implementation-artifacts/1-10-scene-router-and-adventure-flow.md#Review Findings] — the failure patterns not to repeat.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the 7-spec E2E baseline.

## Dev Agent Record

### Agent Model Used

Opus 5 (`claude-opus-5[1m]`), via `gds-dev-story`.

### Debug Log References

**Measured baselines, taken with `git stash push --include-untracked` before any change:**

| Suite | Baseline at `099f945` | After this story |
|---|---|---|
| `npm test` | 372 passing, 31 files | 405 passing, 33 files |
| `npm run test:e2e` | 30 passed, **7 failed** | 33 passed, **7 failed** — the same seven |
| `npm run typecheck` | clean | clean |

The seven e2e failures are the ones tracked in `deferred-work.md` (`accessibility`,
`curated-record:179`, `inquiry-recognition`, `offline-reload:72`, `progress-portability`,
`theory-board`, `young-experiment:12`). They were reproduced on a stashed tree, so the match is
measured rather than assumed. No new failure. The three extra passing e2e tests are one new French
typography check plus the two in `dialogue-advance.spec.ts`.

**Two defects found by looking at the running game, which every unit and integration test passed
through.** Both are recorded because they are the class of bug this layer produces:

1. **`DialogueBox.advance()` moved the beat index without repainting.** The counter stayed at `1 / 3`
   and the conversation looked frozen. `render` had been split so the owner could re-lay-out the cards
   without clearing its transient error, and the repaint went with it. Fixed by extracting `paint()`,
   retaining the last `Translator`, and painting *before* notifying the owner — the owner lays out
   against `getBottomY()`, which only `paint` updates. `tests/e2e/dialogue-advance.spec.ts` now fails
   if the repaint is removed (verified by reverting the fix).
2. **`ProposalChoice.setBounds` resized the card background but left its Phaser hit area stale.** Phaser
   derives the hit area from the object's size at the moment `setInteractive` runs and never resizes it,
   so cards built at their pre-dialogue height (145px) stayed clickable ~19px below where they are
   drawn. Fixed by re-applying the interactive state from `setBounds`. Verified in the browser: a click
   in the gap between two cards now records nothing, and a click inside a card still records the
   proposal. Deliberately **not** pinned with a coordinate assertion — locating a 10px gap needs the
   very layout arithmetic AC1 requires to move, and that is the brittleness the 1.11 review objected to.

**Layout budget, measured rather than chosen.** With `DIALOGUE_TOP = 118` and the panel's measured
height, a one-line beat leaves 126px per card and a two-line French beat 121px, against ≈114px of
conclusion-card content (attribution, a two-line claim at 16px, a two-line limitation at 13px placed
under the claim's measured height). Verified visually at 1280×720 in both locales: nothing truncated,
nothing drawn outside its card, and the four French conclusion cards — the tightest case in the
content — fit with ≈7px to spare.

**`tests/e2e/scene-router.spec.ts` re-checked, and its probe fixed.** The `clickApparatusIncrease`
coordinate (540, 603) still lands inside the third proposal card — but with **two pixels** to spare, and
only because a one-line beat happens to be authored. The spec passed, and would have kept passing, for a
reason a beat re-wording would silently flip into a confusing conclusion-field failure. The
`not.toHaveValue(TYPED_CONCLUSION)` assertion was replaced with the layout-independent invariant: the
field holds either the player's own words or one authored claim adopted verbatim, never anything else.
The unconditional restore that the 1.11 review added is kept.

### Completion Notes List

- **AC1 satisfied.** `src/adapters/phaser/ui/DialogueBox.ts` renders speaker, beat prose, an
  `{index} / {total}` counter, and an advance control whose end state is a *label*
  (`dialogue.end`), not a disappearance. The body is wrapped and **measured** — no `maxLines`, because
  truncation is the failure mode the AC names — and the panel grows to the wrapped height. Body type is
  16 design px, which is ≈15 CSS px after the 0.9375 height-bound `Scale.FIT` factor at 1280×720.
- **AC2 satisfied.** `src/adapters/phaser/ui/ProposalChoice.ts` renders each option and reports the
  choice through an `onChoose` callback; the owner dispatches the existing typed intents. Selection is
  carried by a label (`✓ Chosen` / `Choose this`), with tint and accent alpha as reinforcement only.
  Re-choosing replaces and never fails.
- **AC3 satisfied.** `tests/integration/DialogueAndChoice.test.ts` drives a real `createStore` through
  `PhaserStoreAdapter.chooseProposal` — the exact seam `onChoose` uses — and asserts the authoritative
  state, including that an unauthored ID returns a typed `Result` failure and leaves state identical by
  reference.
- **No new typed action, state field, or `CaseRecord` field**, as scoped. Beat position is widget-local
  and ephemeral; reloading mid-conversation restores to beat 0, which is the intended behaviour.
- `ScenarioDialogueBeat.textKey` became `text: LocalizedText`, with the case-contract triad done in
  full: `version` 1.7.0 → 1.8.0, the `validateCaseRecordForDefinition` allowlist extended so 1.8.0
  accepts 1.2.0–1.7.0, and `CACHE_NAME` v5 → v6.
- **i18n surface checklist, all EN+FR:** beat body (authored, 8 beats × 2 locales) · speaker attribution
  (shared `formatAttribution`) · advance label · advance end-state label · beat counter · every string
  the refactor moved into a widget. Verified in a `fr-FR` session on the canvas, not assumed.
- `SceneNav.ts` left unbuilt, no beats authored for the placeholder Library/Debrief scenes, and no
  `src/ui/*` panel touched (`git diff --stat -- src/ui/` is empty) — all as scoped.
- **Two deliberate refinements to the story's prescribed shapes**, both to make a property the story
  demands actually hold: `DialogueBeatView` carries `id` as well as `speaker`/`text`, so `render`'s
  required idempotence keys on authored identity rather than on resolved prose (which would restart the
  conversation on a locale change); and `ProposalChoice` gained `setBounds`, because the cards' vertical
  band is no longer fixed for their lifetime once a growing dialogue panel sits above them.
- `formatAttribution` was extracted into `selectors.ts` so the unattributed fallback is shared between
  the dialogue speaker line and the proposal cards rather than written twice.
- Wrap bounds and the advance-control centre are now **derived** from the widgets by the e2e specs
  (`proposalTextWrapWidth`, `dialogueBodyWrapWidth`, `dialogueSpeakerWrapWidth`,
  `dialogueAdvanceControlCentre`, `PROPOSAL_SURFACE_WIDTH`), replacing the literal `744`/`944` the
  typography spec restated.
- New unit and integration tests were mutation-checked: reverting the phase-keyed beat lookup fails
  `DialogueBeats.test.ts`, and reverting the repaint fails `dialogue-advance.spec.ts`.

### File List

**New**

- `src/adapters/phaser/ui/DialogueBox.ts`
- `src/adapters/phaser/ui/ProposalChoice.ts`
- `tests/unit/DialogueBeats.test.ts`
- `tests/integration/DialogueAndChoice.test.ts`
- `tests/e2e/dialogue-advance.spec.ts`

**Modified**

- `src/domain/cases/ScenarioScript.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/core/store/selectors.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/adapters/phaser/renderers/ColleagueRenderer.ts`
- `public/cases/young-interference/case.json`
- `public/sw.js`
- `tests/unit/CaseDefinition.test.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/scene-router.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Deleted** — none.

## Change Log

| Date       | Version | Description                                    | Author |
|------------|---------|------------------------------------------------|--------|
| 2026-08-06 | 0.1     | Initial story draft created (gds-create-story) | Alexis |
| 2026-08-06 | 1.0     | Implemented Tasks 1–8: `DialogueBox` and `ProposalChoice` widgets under `src/adapters/phaser/ui/`, `ColleagueRenderer` refactored as their consumer, `ScenarioDialogueBeat.textKey` → `text: LocalizedText` with the case-version/allowlist/`CACHE_NAME` triad (1.8.0 / v6), `selectDialogueBeats` selector, authored EN+FR beats for `prediction`/`synthesis`/`review`, and new unit, integration, and canvas e2e coverage | Alexis |
| 2026-08-06 | 1.1     | Fixed two defects found while verifying in the browser: an advance that moved the beat index without repainting the panel, and a proposal-card hit area left stale by a resize | Alexis |
| 2026-08-06 | 1.2     | Re-checked and fixed the `scene-router.spec.ts` coordinate probe, which was passing on a 2px margin; its assertion is now layout-independent | Alexis |

## Open Questions (for author confirmation — do not block dev)

1. **Beat placement.** Beats are authored for `prediction`, `synthesis`, and `review` — the three
   phases whose scene is real today. `context` (Library) and `experiment` (Laboratory) get theirs from
   Stories 2.1 and 2.2/2.6 respectively. Confirm, or ask for a laboratory beat now.
2. **Ephemeral beat index.** Reloading mid-conversation restarts the conversation from beat 0, matching
   the archival book's ephemeral paging. If beat position should instead survive a reload, it becomes a
   record field with a migration — a materially larger change, and one that hands a scene something
   that looks like progression state.
3. **Skippable micro-cutscenes.** `narrative-design.md` §Micro-cutscenes says conversations are
   skippable. This story ships advance-only paging (no "skip all"). Add a skip control now, or when a
   case authors a conversation long enough to need one?
4. **`SceneNav.ts`.** The architecture tree names a third widget with no AC anywhere in Epic 1. It is
   left unbuilt deliberately — an in-scene "continue" control is the most likely route to a scene
   advancing the phase, which ADR-009 forbids. Confirm it stays unbuilt until a story owns the
   phase-advance intent.
5. **Case-version compatibility policy** (carried from 1.1b Q5 and 1.11 Q5, now due). `1.8.0` extends
   the ad-hoc allowlist in `validateCaseRecordForDefinition` for the **fourth** time. Replace it with a
   declared compatibility range before Epic 3 adds more case versions.

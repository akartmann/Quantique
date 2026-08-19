---
baseline_commit: 6ee85f01b0345a2066b4657d4d8e13399b44e269
---

<!--
  Story context engineered 2026-08-19 against:
    - _bmad-output/planning-artifacts/epics.md §Epic 3 / Story 3.4 (including the 2026-08-06 amendment)
    - _bmad-output/project-context.md revision 2.6 (READ IT — see Dev Notes §0)
    - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md §4.1.9, §4.3.2, §4.3.4
    - the shipped source at HEAD 9ddb45a ("Review 3.3")
  Every file:line in this document was read, not inferred.
-->

# Story 3.4: Scenario and proposal authoring contract

Status: done

## Story

As a content author,
I want to author a case's scenario script, colleague cast, and proposal sets as validated data,
so that new cases become guided adventures without touching engine code.

## Acceptance Criteria

### AC1 — The authoring contract is stated, complete, and provably enforced

**Given** the hardened case contract,
**When** an author defines a case,
**Then** they can specify a `scenarioScript` (ordered scenes and dialogue beats), a `colleagues[]` cast, four `predictionProposals[]`, four `conclusionProposals[]` with support predicates, a `significanceRule`, and `rivalLabCritiques[]` — all as versioned JSON,
**And** Zod validates each field and rejects an incomplete scenario before domain logic.

> **Almost all of this already ships.** See Dev Notes §3. The deliverable for AC1 is **not new schema** — it is a written, tested inventory that maps each of the six named field groups to the schema that shapes it and the refinements that enforce it, so that a future author (and a future reviewer) can find the rule rather than rediscover it. Any gap the inventory exposes is in scope; any field already enforced is documented, not rebuilt.

### AC2 — A scene may author who is in the room

**Given** a case authoring its cast,
**When** the scenario contract is defined,
**Then** `scenarioScript.scenes[]` may declare an optional `cast` — the colleague IDs present in that scene — defaulting to the full cast when absent,
**And** the authored cast is what the figure column stages, replacing the derived fallback at the single seam that exists for it (`presentColleagueIds`),
**And** every authored cast ID resolves to an authored `colleagues[]` entry, at load, with the offending path named,
**And** every dialogue beat's `speakerId` in that scene is a member of that scene's cast, at load, with the offending path named,
**And** a `cast` authored on a scene that stages no figures is refused at load rather than shipped as content nothing reads.

### AC3 — A control may author which instrument it is

**Given** a case authoring its instruments,
**When** the scenario contract is defined,
**Then** an authored apparatus control may declare an optional affordance descriptor (`knob`, `dial`, `slider`) defaulting to `knob`,
**And** the bench draws three **genuinely distinct** instruments — distinct geometry and distinct pointer→value conversion, not one instrument with three labels (Dev Notes §7 fixes what each one is),
**And** the authored range, step, `defaultValue` and every existing validation are unchanged by the choice,
**And** every affordance keeps its discrete step affordances and keyboard stepping, and the drag path and the step path produce **identical run records** (ADR-012),
**And** the pointer→value conversion for each affordance snaps to the authored step **before** dispatch, in a Phaser-free module, unit-tested at both range ends and across every step.

### AC4 — Both new fields are additive

**Given** the two new fields,
**When** existing content is loaded,
**Then** both shipped cases parse unchanged with neither field authored,
**And** the absence of `cast` and the absence of `affordance` each produce exactly today's behaviour, asserted by test rather than assumed.

### AC5 — The router drives the full flow from the script

**Given** an authored scenario,
**When** it is loaded,
**Then** the SceneRouter can drive the full flow from the script without case-specific code,
**And** a second case can be authored reusing the same scenes, evaluator, and widgets.

> This is **already true** as of Story 3.2 (Dev Notes §8). The deliverable is a test that *pins* it — one that fails if a case ID is written into a scene, a renderer, or the router — not a rewrite of the router. Do not build a registry.

### AC6 — The authoring documentation exists

**Given** the authoring contract,
**When** documentation is produced,
**Then** `docs/content-authoring/` describes how to author scenarios, proposals, significance rules, and rival-lab lines,
**And** it states the load-time rules that will refuse content, each with the message an author will actually see,
**And** it states the EN+FR obligation as a property of authoring, not as follow-up work.

### AC7 — An example fixture demonstrates a minimal valid scenario

**Given** the authoring documentation,
**When** an author needs a starting point,
**Then** an example fixture demonstrates a minimal valid scenario — a complete case definition that passes `CaseDefinitionSchema` with **no top-level field removable and no bounded array shortenable** *(clause narrowed by the code review of 2026-08-19. "Nothing removable" was not true of the fixture and was not what the test measured: the sweep never descends, and every `dialogueBeats` array can be deleted with the example still parsing, because dialogue is optional in the schema and an example without it would demonstrate none of the cast rules. Nested optional content is now named as an explicit exception list in the test rather than claimed away)*,
**And** a unit test parses that fixture through the production schema, so the example cannot rot into an invalid one,
**And** the fixture exercises both new fields, including at least one non-default `affordance` and one authored per-scene `cast`.

### AC8 — Bilingual from the start

**Given** any authored prose this story adds — fixture content included —
**When** it is authored,
**Then** it carries both `en` and `fr`,
**And** the French is French, not English with accents (project-context.md §i18n; this is the project's most-repeated defect).

### AC9 — Verification

**Given** the change,
**When** verification runs,
**Then** `npm run typecheck` is clean, `npm test` passes, `npm run build` succeeds, and `npm run test:e2e` passes on an **idle** machine across three identical runs,
**And** `npm run typecheck:tests` is **at or below 114 errors across 60 files** — the count is the metric and it may only go down *(the file count was carried as 59 and was wrong at the story-creation commit; measured at 60 on a clean tree before any edit, independently re-derived at review, and corrected here rather than left standing as a false AC. The error count, which is the metric, is unchanged)*,
**And** offline reload still restores locally saved progress with no network,
**And** every guard this story adds whose failure would be *silent* carries a recorded mutation proof (Dev Notes §13).

## Tasks / Subtasks

- [x] **Task 0 — Read before writing** (blocks everything)
  - [x] Read `_bmad-output/project-context.md`. It exists, it is 215 lines, and it is revision 2.6. Story 3.3's review opened with the finding that the story had twice asserted this file did not exist and had therefore crossed two of its rules. Do not repeat that.
  - [x] Read the files in Dev Notes §3. Every one is a file this story changes or must not break.

- [x] **Task 1 — The authored per-scene cast** (AC2, AC4)
  - [x] Add `cast?: readonly string[]` to `ScenarioScene` in `src/domain/cases/ScenarioScript.ts`, documented in the file's existing voice.
  - [x] Add `cast: z.array(stableId).optional()` to `ScenarioSceneSchema` in `src/schemas/CaseDefinitionSchema.ts:650`. **No `.min(1)`** — see Dev Notes §5 for why the floor belongs in the top-level refinement and not in the shape.
  - [x] Add the four load-time refinements of Dev Notes §5.1 to the existing `--- Scenario dialogue beats ---` block at `CaseDefinitionSchema.ts:1501`, each naming its own path.
  - [x] Extend `PresentColleaguesInput` and `presentColleagueIds` in `src/adapters/phaser/renderers/characterStageView.ts:365-396` to take the authored cast, and replace the "Story 3.4 owns this" docstring with what the rule now is. Preserve the ordering guarantee of Dev Notes §6 — proposal order is load-bearing for 2.9's AC3.
  - [x] Thread the scene's authored cast through `resolveStageCast` (`ColleagueRenderer.ts:543`) and `stageCast` (`ColleagueRenderer.ts:843`). One call site each; that split exists precisely so this story changes a call and not a rule spread across two renderers.
  - [x] Update the `Story 3.4 owns…` forward references at `characterStageView.ts:377` and `ColleagueRenderer.ts:834` — they are now history, not a plan.
  - [x] Close `deferred-work.md:84` (the `CharacterStage.create` rebuild note) and `deferred-work.md:85` (`FIGURE_SLOT_WIDTH`) — Dev Notes §14.

- [x] **Task 2 — The authored control affordance** (AC3, AC4)
  - [x] Add `affordance?: 'knob' | 'dial' | 'slider'` to `PrimaryControl` (`src/domain/cases/CaseDefinition.ts:208`) and to `PrimaryControlSchema` (`CaseDefinitionSchema.ts:125`), as a `z.enum` derived from one exported constant so the type and the schema cannot drift.
  - [x] Implement the linear (`slider`) and full-circle (`dial`) pointer→value conversions in `src/adapters/phaser/renderers/instrumentView.ts`, beside the rotary one. **Conversions only** — "where it is drawn" belongs in `apparatusGeometry.ts`, and that split is already documented in `instrumentView.ts`'s header.
  - [x] Add the geometry for each affordance to `apparatusGeometry.ts`, inside the existing `INSTRUMENT_SLOT_WIDTH = 168` slot so the bench layout does not move.
  - [x] Make the non-overlap sweep at `apparatusGeometry.ts:405-431` **affordance-aware**. It currently derives every band from `knobCentre`/`stepAffordanceCentre`; leaving it is the FIGURE_SLOT_WIDTH defect one layer down — a sweep measuring a band nothing paints.
  - [x] Make `ApparatusInstrument` select its drawing and its conversion from `control.affordance ?? 'knob'`, keeping `ApparatusInstrumentOptions` / `ApparatusInstrumentView` intact so `ApparatusRenderer` is unchanged above the instrument.
  - [x] Verify the arrow-key capture release (2.10's fix) and `prefers-reduced-motion` still hold for every affordance, and that no affordance registers an update loop from `create()` (ADR-012).

- [x] **Task 3 — Shipped content adopts the affordances** (AC3; see Open Question 1 for the fallback)
  - [x] `public/cases/morley-miller/case.json`: author `rotationDeg` as `dial` and `bathTempC` as `slider`. Bump the case `version`.
  - [x] Leave `public/cases/young-interference/case.json` on the default. Young's two controls stay knobs, its version is untouched, and its e2e walks and typography sweep do not move.
  - [x] Re-point the prototype's e2e drag walk at the new instruments. Keep the 0°/90° pair — the story-3.2 review chose those values because they *differ under the model* (0° and 180° are both 0.11), and re-deriving from the authored range would reintroduce that defect.
  - [x] Confirm `npm run audit:ledger` still exits as it did — the ledger reads rights, not controls, but confirm rather than assume.

- [x] **Task 4 — Pin AC5 rather than build it** (AC5)
  - [x] Add the test of Dev Notes §8: a `case.json`-free, fixture-driven walk proving the router resolves all six phases from an authored script alone, plus a source-level assertion that no case ID appears in `src/adapters/phaser/**` or `src/domain/**` outside the two sanctioned seams.
  - [x] Do **not** add a plugin or registry layer. project-context.md says this twice, for two different mechanisms.

- [x] **Task 5 — The example fixture** (AC7, AC8)
  - [x] Author `docs/content-authoring/minimal-scenario.case.json` — a complete, minimal, bilingual case definition. Dev Notes §9 lists every required field and the four that will trip you.
  - [x] Add a unit test that parses it through `CaseDefinitionSchema`. Route the file read through `tests/shippedCases.ts` (or extend it) rather than importing `node:fs` in a new file — Dev Notes §12.
  - [x] The fixture authors one non-default `affordance` and one per-scene `cast`, so both new fields have a worked example.

- [x] **Task 6 — The authoring documentation** (AC1, AC6)
  - [x] Write `docs/content-authoring/README.md` following the shape of `docs/source-rights/README.md`: what the contract is, how to author each part, what will refuse you and with which message.
  - [x] Include the AC1 inventory: each of the six named field groups → its schema symbol → its refinements.
  - [x] Cross-reference `docs/i18n-authoring.md` rather than restating it.

- [x] **Task 7 — Verification and record** (AC9)
  - [x] Run the four gates. Record the exact counts, and measure `typecheck:tests` against a **stashed clean baseline** — the story-3.2 review found the carried figure was already stale.
  - [x] Record each mutation proof: break the guard, name the test that goes red, restore, state both.
  - [x] Update `deferred-work.md` with what this story closed, what it opened, and what it checked and left alone.

### Review Findings

Adversarial code review, 2026-08-19, three parallel layers over `6ee85f0..e59e678` (31 files, +3864/−176).
Blind Hunter (diff only), Edge Case Hunter (diff + tree), Acceptance Auditor (diff + spec + project-context 2.6).
All three layers completed. 45 raw findings → 35 after dedup: 6 decisions, 27 patches, 1 deferred, 1 dismissed.

**Verified independently of the layers:** the `1.3.0` record-allowlist break (read at `CaseRecordSchema.ts:465`),
the arrow-key capture test, the step-affordance average, and the two vacuous assertions.
The Auditor re-ran mutation proofs 2, 4, 6, 7, 8, 12, 14, 15 and 16 in an isolated worktree — every one goes red as recorded,
and it re-derived `typecheck:tests` at 114/60, `typecheck` clean, 1497 tests / 79 files, e2e 61, `audit:ledger` blocked 7 and 2.
**The story's own work is largely sound.** What this review found concentrates in two places: a version bump whose
consequences were traced through the service worker but not through the record allowlist, and a set of new tests
whose names describe guards they do not exercise.

#### Decisions — all six resolved by Alexis, 2026-08-19

Every decision took the review's recommendation. Each is checked off below with the option chosen and what it commits to; the resulting work is carried as patches in the next section.

- [x] [Review][Decision] **The closed dial on a control whose ends are distinct authored values** — `rotationDeg` is 0–180 step 15, authored `dial`. A dial's travel closes, so `dialFractionForAngle` maps a full turn back to `0`. Three confirmed consequences, all on shipped content: (i) **AC3's "the drag path and the step path produce identical run records" is violated** — stepping up from 165° records `180`, dragging to the 180° graduation records `0`; the story's own test pins it (`tests/unit/InstrumentView.test.ts:599`) and the agreement sweep carves the dial an exception (`:575`, `slice(0, -2)` for `dial` against `slice(0, -1)`). (ii) `significantMeasures.ts:40` keys `runSignature` on the control **value**, so `0` and `180` count as two configurations and unlock the conclusion gate on one physical reading taken twice — and the dial now draws both at the same graduation, so the player cannot see the collision. (iii) `dialTickAngles` emits `knobStepCount + 1 = 13` angles that paint 12 visible graduations, one under the index mark, and the end detents are half the angular width of every other. Options: give the dial a half-open travel with a seam at the index mark; keep `rotationDeg` a `knob`; make `significanceRule` cyclicity-aware; or amend AC3 and record the dial as a cyclic-only affordance. The authoring guide already states the rule as unenforceable-by-schema; this is asking whether shipped content should be the first to break it. **RESOLVED — option 1A: seam the dial.** Spread the authored values over `stepCount/(stepCount+1)` of the circle, leaving one detent-width gap at the index mark, so the travel still reads as a closed ring but `fraction` 0 and 1 no longer land on the same angle. This makes `control.max` reachable by drag (AC3 holds, unamended, and the `slice(0, -2)` carve-out in the agreement sweep is removed), and makes the tick count and the painted graduations agree. The `cos(2θ)` alias — 0° and 180° being one physical reading that `configurationKey` counts as two configurations — is **not** closed here: it predates this story, lives in `significantMeasures.ts`, and goes to `deferred-work.md` for the significance rule's owner.
- [x] [Review][Decision] **`docs/content-authoring/` promises refusal messages the load path never surfaces** — the guide's central offer is "the message an author will actually see" (`README.md:5, 27, 229`), and its prescribed workflow is to drop a case under `public/cases/`, add the id to `KNOWN_CASE_IDS` and load `?case=<id>`. `loadCaseDefinition.ts:81` discards `parsed.error` entirely and returns the fixed string `'Case content does not match the case contract.'` — no path, no console output. None of the ~34 quoted messages and none of the promised paths (`scenarioScript.scenes.1.cast.0`) is reachable that way. The new guard checks the strings are real, not that anyone can see them. Options: surface the Zod issue path on the load-error path (player-facing error handling, so it needs your call), or correct the guide's workflow to say the messages come from calling `safeParse` directly. **RESOLVED — option 3A: log the issues, leave the player message alone.** `loadCaseDefinition.ts:81` gains a `console.error` carrying the full Zod issue list including every path; the returned player-facing string is unchanged, so no player-facing error handling moves. The guide's workflow section says where to look.
- [x] [Review][Decision] **`case.json` changed at a stable URL with no `CACHE_NAME` bump** — Dev Notes §11 reasoned the bump was unnecessary and is right for the stale-content→new-bundle direction. The reverse breaks: `contentPath` builds `cases/morley-miller/case.json` with no version query, `sw.js` is a per-response fetch-through cache with no atomic swap (its own header says a mixed-version cache is reachable in either direction), and `PrimaryControlSchema` is `.strict()`. A returning player whose `case.json` request reaches the network while the hashed bundle does not — the ordinary mid-deploy partial-connectivity state — gets the new file parsed by the pre-3.4 schema, which has no `affordance` key: `invalid-case-definition`, content unavailable, no recovery offline. v10 was bumped for a change where no field became required at all. Options: bump `CACHE_NAME` (costs every returning player their cache) or accept the window and record the reasoning. **RESOLVED — option 2A: bump.** `public/sw.js` goes to v11 with the reason added to its header changelog. Dev Notes §11's reasoning was right for the stale-content→new-bundle direction and the bump covers the reverse, which is the one that strands an offline player with no recovery. One cache refill is the price.
- [x] [Review][Decision] **No load-time rule requires a board's proposers to be in that board's cast** — the five new refinements cover speakers only (`CaseDefinitionSchema.ts:1606-1613`). `characterStageView.ts:336` matches `member.colleagueId === selectedColleagueId`, so selecting a proposal whose author the scene's `cast` excludes foregrounds nobody — 2.9's AC3 ("choosing a proposal brings its author forward") becomes a silent no-op, with no fallback, where the speaker path has an explicit `hasSpeaker` guard at `:295-296`. `README.md:141` documents the gap as intentional ("the card is not the figure") without noting that selection emphasis dies with it. Options: add a sixth refinement requiring every proposer on a staged board to be in that scene's cast; add a fallback to the emphasis resolver; or keep it authorable and say so in the guide. (The fixture's own instance of this is a separate patch below.) **RESOLVED — option 4A: a sixth refinement.** Every proposer attributed on a figure-staging board must be a member of that scene's authored cast, refused at load with the offending path named, consistent with the other five. Fail-closed rather than a renderer fallback, because the guide already promises load-time refusal.
- [x] [Review][Decision] **AC7's "nothing removable" is not true of the fixture and is not what the test measures** — `ScenarioAuthoringContract.test.ts:219-248` sweeps top-level key deletion and shortens eight named top-level arrays; it never descends. Deleting **every `dialogueBeats` array** from `minimal-scenario.case.json` still parses. The docstring at `:215-217` claims "the only survivors permitted are the two fields this story adds … the exception list is exactly two entries long and is stated" — no exception list exists in the code (`expect([...removable, ...shortenable]).toEqual([])`), and neither new field is top-level so neither ever entered the sweep. `README.md:16-18` repeats the claim to authors. Options: descend the sweep and strip the fixture to literal minimality (which costs the dialogue the cast rules are there to demonstrate); or narrow AC7's claim to top-level minimality and make the docstring and README say what is actually measured. **RESOLVED — option 5A: narrow the claim to what is measured.** Literal minimality is unreachable while the example still demonstrates the cast rules, because `dialogueBeats` is genuinely optional in the schema and will always be removable. AC7, the test docstring and `README.md:16-18` are corrected to claim **top-level** minimality plus a named exception list — and that exception list, which the docstring already claims exists, is made real in the code.
- [x] [Review][Decision] **AC2's "defaulting to the full cast when absent" is not what absence does** — with no authored cast, `presentColleagueIds` returns the derived set (proposers ∪ speakers), falling back to `castIds` only when both are empty. That is correct against AC4 ("absence produces exactly today's behaviour") and the docstrings say so, but it contradicts AC2 clause 1 as written, and neither the ACs nor the Completion Notes record that the two clauses conflict or which was taken. Story 3.3's precedent was to amend the AC. Options: amend AC2's wording to match the shipped (and correct) behaviour, or state the divergence in the Completion Notes. **RESOLVED — option 6A: amend AC2.** The shipped behaviour is correct against AC4 and stays; AC2 clause 1's wording is amended to describe the derived set with the full cast as the empty-set fallback. Story 3.3's precedent.

#### Patches

- [x] [Review][Patch] **Seam the dial's travel so its ends stop aliasing** (decision 1A) [src/adapters/phaser/renderers/instrumentView.ts:219-233] — `dialAngleForFraction` spreads `[0,1]` over a full `2π`, so fraction 0 and 1 always coincide; `dialFractionForAngle` takes a modulo over `2π` and so returns `[0,1)`, making `control.max` unreachable by drag on any dial for any content. Spread over `stepCount/(stepCount+1)` instead, leaving one detent-width seam at the index mark. Both conversions then need the control's step count, which `dialAngleForFraction` does not currently take. Remove the `slice(0, -2)` dial carve-out at `tests/unit/InstrumentView.test.ts:575` and the `expect(pointerAt('dial', control, control.max, ...)).toBe(control.min)` assertion at `:599` — they pin the defect. Fixes the 13-angles-into-12-graduations mismatch and the half-width end detents at the same time.
- [x] [Review][Patch] **Bump `CACHE_NAME` to v11** (decision 2A) [public/sw.js] — add the reason to the header changelog: `case.json` moved at a stable URL while `PrimaryControlSchema` is `.strict()`, so a new `case.json` paired with a cached pre-3.4 bundle fails the old strict parse into `invalid-case-definition`. Correct Dev Notes §11 and the Completion Notes, which both state no bump is required.
- [x] [Review][Patch] **Log the Zod issue list on a failed case parse** (decision 3A) [src/adapters/content/loadCaseDefinition.ts:81] — `console.error` the full `parsed.error` issues, paths included; leave the returned player-facing message exactly as it is. Then make `docs/content-authoring/README.md:5, 27, 229` say where the quoted messages and paths actually appear, so the guide's central promise becomes true.
- [x] [Review][Patch] **Refuse a proposer who is not in the staged board's cast** (decision 4A) [src/schemas/CaseDefinitionSchema.ts:1606-1613] — a sixth load-time refinement beside the five, naming the offending path. Then fix the authoring example, which is the case that exposed it. Mutation-proof it like the other five.
- [x] [Review][Patch] **Make AC7's minimality claim match what is measured** (decision 5A) [tests/unit/ScenarioAuthoringContract.test.ts:215-248] — the docstring claims "the exception list is exactly two entries long and is stated" and no such list exists in the code (`expect([...removable, ...shortenable]).toEqual([])`). Introduce the real exception list, state that the sweep measures top-level keys and eight named arrays and does not descend, and correct AC7 and `docs/content-authoring/README.md:16-18` to claim exactly that. Neither new field is top-level, so neither ever entered the sweep — say so.
- [x] [Review][Patch] **Amend AC2 clause 1 to describe the derived set** (decision 6A) [story:AC2] — "defaulting to the full cast when absent" is not what absence does and conflicts with AC4. Reword to: absent `cast`, the staged set is the derived one (proposers ∪ speakers), falling back to the full cast only when that is empty. Note the amendment in the Completion Notes.
- [x] [Review][Patch] **The 1.3.0 bump discards every saved Morley–Miller investigation** [src/schemas/CaseRecordSchema.ts:465] — the prototype's last allowlist clause stops at `definition.version === '1.2.0'`; Task 3 bumped the case to `1.3.0`, so every record saved at 1.0.0/1.1.0/1.2.0 now fails `compatibleDefinitionVersion` and returns `incompatible-case-record` — "This progress record is for a different version of this investigation." Nothing the affordance changes is persisted. The comment three lines above names this exact failure ("a player's prototype investigation discarded by a content edit that changed nothing they had recorded"); it happened at 1.1.0, was fixed with a per-version clause, and has recurred. Confirmed by execution and by reading. Note this touches `CaseRecordSchema.ts`, which Dev Notes §1 lists as out of scope — but that rule's stated reason is "neither new field is persisted … if you find yourself writing a migration, stop". Extending the allowlist is neither a migration nor a persisted field; it is the unhandled consequence of the version bump Task 3 mandated.
- [x] [Review][Patch] **The arrow-key capture release is verified by a test that cannot fail** [tests/unit/ApparatusAffordances.test.ts:161-174] — asserts `capturedKeys()).toEqual([])` before `destroy()` and again after. Nothing focuses an instrument, so the capture is never taken and its release is never exercised; both sides compare `[]` to `[]`. Mutation-verified: deleting `removeCapture(ARROW_KEY_CAPTURE)` at `ApparatusRenderer.ts:459` leaves 1497/1497 green. Nothing asserts "armed" either, despite the test's name. This is 2.10's fix, unguarded.
- [x] [Review][Patch] **A slider can lose both discrete step affordances with the suite green** [tests/unit/ApparatusAffordances.test.ts:177-185] — `ui.ofKind('rectangle').length / controls.length >= 2` averages across the whole bench and counts every non-instrument rectangle. The real value is 8.5 (17 rectangles, 2 controls), ~6.5 of slack. Mutation-verified: skipping the `[-1, 1].forEach(...)` construction for `'slider'` at `ApparatusInstrument.ts:273` leaves 1497/1497 green. An ADR-012 guard with no working test and no entry in the 17-proof table. Count per instrument, not per bench.
- [x] [Review][Patch] **The reduced-motion test asserts nothing about reduced motion** [tests/unit/ApparatusAffordances.test.ts:189-196] — flipping `stub.setReducedMotion(true)` to `false` leaves it green: the idle bench registers no update handler and starts no tween in either mode, so the assertions are insensitive to the branch they are named for.
- [x] [Review][Patch] **The affordance vocabulary test is a tautology and never touches the schema** [tests/unit/ApparatusAffordances.test.ts:213] — `it.each(CONTROL_AFFORDANCES)(...)` asserts `expect(CONTROL_AFFORDANCES).toContain(affordance)`, true by construction for any array. Its comment claims "the schema's `z.enum` reads this same list", but neither `CaseDefinitionSchema` nor `PrimaryControlSchema` is imported into the assertion. Narrowing the schema to `z.enum(['knob','dial'])` passes.
- [x] [Review][Patch] **A vacuous assertion standing where its own comment says the vacuity guard is** [tests/unit/ScenarioAuthoringContract.test.ts:113] — `expect(checked).toBeGreaterThanOrEqual(0)` on a non-negative counter can never fail. Its comment defers the real floor to "the vocabulary test above" — which is the tautology in the finding above, so the guard appeals to a guard that does not guard. Remove `"affordance": "dial"` from the prototype and this `it.each` body executes zero assertions and still reports green: the 3.3 zero-assertion sweep, inside the describe block that warns about it.
- [x] [Review][Patch] **The SceneRouter reuse test tests neither half of its name** [tests/integration/SceneRouter.test.ts:396] — `reuses one scene for two phases when the script says so, without restarting it` constructs a router at a single phase and asserts `scenes.calls === ['start:TheoryBoard']`. `storeReporting(phase)` returns a no-op `subscribe` over a frozen state, so the `synthesis → review` transition can never reach the router. A router calling `scenes.start(key)` unconditionally on every notification passes.
- [x] [Review][Patch] **The instrument helpers index off a construction order nothing pins, and their stated rationale is false** [tests/unit/ApparatusAffordances.test.ts:71-97] — `graphics[graphics.length - (3 * (controlCount - index)) + 2]` with a comment claiming "the count assertion below is what keeps that honest". No assertion on `ofKind('graphics').length` exists anywhere in the file. The tail-indexing holds only because `mount()` omits `openReference`: `ApparatusRenderer.create()` calls `createReferenceShelf()` after the instrument loop and adds `referenceShelfFills` at `:1294`, so on the bench players actually use the arithmetic is already off by one. A fourth graphics in `ApparatusInstrument.create` slides every index silently.
- [x] [Review][Patch] **A non-finite pointer slams the slider to its minimum where the knob and dial hold** [src/adapters/phaser/renderers/instrumentView.ts, `sliderFractionForOffset`] — `trackWidth <= 0 || !Number.isFinite(dx) ? 0 : …` dispatches `control.min` (18 °C) instead of holding. Both rotary branches route non-finite input through `Number.isFinite` → `undefined` → `steppedControlValue(control, currentValue)`, i.e. hold; the slider branch never consults `currentValue`. Reachable from a `Scale.FIT` transform computed against zero-width bounds (tab restore, un-minimise). The docstring conflates the degenerate-`trackWidth` case with the non-finite-pointer case, which is a different decision. The unit sweep samples only finite `dx`.
- [x] [Review][Patch] **The dial's index mark is painted outside its own hit area** [src/adapters/phaser/renderers/ApparatusInstrument.ts + apparatusGeometry.ts:246-249] — the hit zone is `DIAL_RING_RADIUS * 2` = 80 square (half-extent 40); the index mark runs from `DIAL_INDEX_INNER_RADIUS` 42 to `DIAL_INDEX_OUTER_RADIUS` 48. Every pixel of it is outside the zone, so pressing the feature the class docstring calls "the affordance that tells a player the travel does not stop" arms no drag and does not even focus the instrument.
- [x] [Review][Patch] **The dial-cyclicity guard skips the one file the guide tells authors to copy** [tests/unit/ScenarioAuthoringContract.test.ts:87] — `it.each(KNOWN_CASE_IDS)` never evaluates `minimal-scenario.case.json`, which authors `"affordance": "dial"` and is deliberately not a shipped case. Change the example's `rotationDeg` to `min: 0, max: 90` and every test stays green while the worked example teaches the exact mistake the guide warns about. Second, weaker half: the shipped check evaluates the model with all other controls at their defaults, so a model whose end-equality depends on a second control passes at defaults and fails in play. Sweep `[...KNOWN_CASE_IDS]` plus `loadAuthoringExample()`.
- [x] [Review][Patch] **The FR sweep cites an assertion that does not exist, and hard-codes the pairing it claims is guarded** [tests/e2e/french-typography.spec.ts:~222] — the comment says the `Colleagues`→prediction / `TheoryBoard`→conclusion pairing is "asserted against the source in `ScenarioAuthoringContract`". That file asserts only *which* scenes construct a `ColleagueRenderer`, never with which `kind`. Meanwhile `stagedFigureCounts` selects the proposal set by scene key, while `stageCast` and `CharacterStaging.test.ts` both key on **phase** and both carry comments saying key-based lookup is wrong — and `SceneRouter.test.ts` proves the schema accepts a script routing `prediction → Laboratory`. A third case routing `prediction → TheoryBoard` makes the sweep derive `FIGURE_SLOT_WIDTH` from the wrong proposal set and go on passing: verbatim the failure the `deferred-work.md:85` rewrite was done to close. Add the scene→kind assertion the comment promises, or key on phase.
- [x] [Review][Patch] **Dead geometry exports, and a thumb assertion that is true by construction** [src/adapters/phaser/renderers/apparatusGeometry.ts:252,272 + instrumentView.ts] — `dialCentre` has zero references anywhere; `sliderFractionForValue` likewise within the diff; `sliderCentre` has exactly one, in a test. `ApparatusInstrument.create()` and `paintValue()` call `knobCentre(...)` for all three affordances, so the aliases are documentation shaped like an API — "author a field nothing reads", one layer down. Worse, the test asserting the thumb's offset compares against `sliderCentre(1)`, which the code under test never calls: nothing links `paintSliderFace`'s placement to the geometry module. Delete the dead aliases and make the painter call the helper the test measures.
- [x] [Review][Patch] **The dial arm of the affordance-aware band sweep is unfalsifiable** [src/adapters/phaser/renderers/apparatusGeometry.ts:1673 + tests/unit/ApparatusGeometry.test.ts] — `DIAL_FOCUS_RADIUS = DIAL_RING_RADIUS + 8 + 6` = 54, which the source comment notes is the same 54 the knob focuses at, so `instrumentBand('dial', i)` is numerically identical to `instrumentBand('knob', i)`. Return `KNOB_FOCUS_RADIUS` unconditionally and every assertion passes: `new Set(bands).size > 1` is satisfied by the slider alone, the `not.toEqual` pair never mentions the dial, and `toMatchObject(instrumentBand('dial', 1))` compares the production value against itself. The test whose stated purpose is "so measuring the wrong one is detectable" cannot detect it for the dial — which is Task 2's named trap, one affordance short.
- [x] [Review][Patch] **`sceneSlice.setRotation` records into state but never writes back onto the object** [tests/unit/sceneSlice.ts:~4335] — `setRotation: (value) => { state.rotation = value; return chain; }`, against `setX`'s `self.x = value; state.x = self.x;`. `self` is typed with `rotation?: number` but never assigned, so the proxy's `if (property in target)` misses and reading `.rotation` returns `() => chain`. Any read-modify-write (`setRotation(indicator.rotation + delta)`, a nudge, a reduced-motion snap-back) yields `NaN` under test while behaving correctly in Phaser, and every `toBeCloseTo` then fails as `NaN`. The same silent-swallow class this hunk's own JSDoc says it exists to end.
- [x] [Review][Patch] **No e2e or real-input coverage of the slider at all** [tests/e2e/] — `varyingInstrument`/`bathTempC` appear in no spec; only `rotationDeg` is walked, and only `morley-miller-prototype.spec.ts` loads the prototype. `accessibility.spec.ts` never sees a dial or a slider. So the slider's pointer path — the one affordance with a genuinely new conversion and the one whose non-finite guard is missing — is never exercised through real Phaser input.
- [x] [Review][Patch] **`varyingInstrument`'s default drag target resolves to the dial's minimum** [tests/e2e/canvasHelpers.ts:~625-665] — `destination = targetValue ?? control.max`; for a dial `fraction = 1` and `dialAngleForFraction(1)` returns the index mark, which `dialFractionForAngle` reads back as `0`. A caller omitting `targetValue` drags to where the dial reads `min` while `maxReadout` asserts the max — a walk failing at a readout mismatch with no hint the target was the bug. The helper computes `affordance` two lines above and knows the travel closes; the rule is left in prose ("a caller must pass `targetValue` … always for a `dial`"). Refuse `destination === control.max` for a dial.
- [x] [Review][Patch] **A tick-count comment whose own numbers contradict it** [tests/unit/ApparatusAffordances.test.ts:133] — "The prototype's two differ from each other (12 steps against 12), so a hard-coded tick count would not satisfy both cases at once." `rotationDeg` is (180−0)/15 = 12 and `bathTempC` is (24−18)/0.5 = 12; they are identical, so both expect 13 graduations and the literal `13` satisfies the entire prototype arm. The comment is the only thing standing between a reader and that conclusion.
- [x] [Review][Patch] **A comment credits an assertion to a file that does not contain it** [tests/unit/InstrumentView.test.ts:593] — "`MorleyMillerPrototype.test.ts` pins that the shipped case obeys it against its own model". That file contains no occurrence of `dial`, `affordance` or `cyclic`, is absent from the diff and from the File List; the check lives in `ScenarioAuthoringContract.test.ts:87-114`. "A comment claiming a guarantee is not a guarantee" — the finding three stories running.
- [x] [Review][Patch] **Misreport: "28 quoted refusal messages"** [story:556 + sprint-status.yaml] — applying the test's own regex (`ScenarioAuthoringContract.test.ts:332`) to `docs/content-authoring/README.md` yields **34**.
- [x] [Review][Patch] **A new hard-coded `550` added to the register project-context says must only shrink** [tests/unit/ScenarioAuthoringContract.test.ts:93] — `selectedWavelengthNm: definition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? 550`. Story 3.2 is recorded as having added none and removed one; this adds one, unmentioned in the record and in `deferred-work.md`. Read the exported constant.
- [x] [Review][Patch] **The 17-proof table omits the snap-before-dispatch proof Dev Notes §13 names explicitly** [story:520-540] — §13 item 6 requires mutating each new conversion to return the raw pointer value. Proofs 9-13 cover the face painters and `paintValue`; none does this. The guard *is* covered — dropping `steppedControlValue` from the slider branch turns 3 tests red, verified — so this is a hole in the record, not in coverage. AC9 asks for the recorded proof.
- [x] [Review][Patch] **AC9's file count left standing at 59** [story:AC9] — independently re-derived at **114 errors / 60 files**, matching the story's report and 3.3's sprint-status note, so the measurement and the Debug Log disclosure are honest. AC9's own text was never amended and remains false. Task 7's "measure against a stashed clean baseline" is asserted but no baseline output is recorded.
- [x] [Review][Patch] **The authoring example attributes prediction proposals to a colleague its own cast excludes** [docs/content-authoring/minimal-scenario.case.json:~700] — `prediction` authors `"cast": ["ada-reeve"]` while `example-predict-none` and `example-predict-thermal` are attributed to `owen-blake`, so selecting either brings nobody forward. The worked example the guide tells authors to copy demonstrates the hole rather than the feature. (The schema-rule half is a decision above; the fixture is wrong either way.)
- [x] [Review][Patch] **`Math.max(...stagedFigureCounts())` has no non-empty guard** [tests/e2e/french-typography.spec.ts:~2387] — an empty array yields `-Infinity` and `FIGURE_SLOT_WIDTH` becomes `-0`, so every downstream bound compares against `-0`. Sibling sweeps in this same diff guard exactly this shape three times (`ScenarioAuthoringContract` twice, `InstrumentView` once); this one does not.
- [x] [Review][Dismissed] **`dialFractionForAngle`'s `undefined` return is unreachable and its handler is dead** — **WITHDRAWN at apply time, false positive.** The branch is reachable and is load-bearing: `resolveAffordanceValueForPointer` guards on `Math.hypot(dx, dy) < KNOB_MIN_TRACKING_RADIUS`, and `NaN < x` is `false`, so a non-finite pointer falls *through* that guard and arrives at this function — where the `undefined` return is exactly what holds the value. It is the guard whose absence on the slider is a separate, confirmed finding above. Raised by the layer with no project access, which read the radius check as excluding NaN. The docstring now says why it is not dead. [src/adapters/phaser/renderers/instrumentView.ts] — the only production caller passes `pointerAngleRad(dx, dy)` after a finite-radius check, and the test confirms all 360 sampled angles return a number. The `number | undefined` signature forces the dial through a hold-current-value branch it can never take, which reads as "the dial has a dead zone" — contradicting the module header and the whole point of the affordance.
- [x] [Review][Patch] **A hard-coded `0.9999` probe that only holds for today's step counts** [tests/unit/InstrumentView.test.ts:~3661] — reaching `max` requires `1 − fraction < step / (2 × (max − min))`. A control authored `min: 0, max: 10000, step: 1` resolves `0.9999` to `9999` and the test fails blaming the conversion. The surrounding JSDoc claims the sweep protects against Young-shaped assumptions while carrying a constant that holds only because every shipped control has ≤ 12 steps. Derive it as `1 - (step / (2 * (max - min)))`.

#### Deferred

- [x] [Review][Defer] **The unit harness discards every hit-area dimension** [tests/unit/sceneSlice.ts:256] — deferred, joins the standing harness gap. `zone: () => makeObject('zone', drawn)` drops all constructor arguments (x, y, width, height), and zones are positioned by constructor rather than by `setPosition`, so `state.x/y` stay 0. This diff sizes three different hit areas — `SLIDER_HALF_WIDTH*2 × SLIDER_HALF_HEIGHT*2`, `DIAL_RING_RADIUS*2` square, `KNOB_TRAVEL_RADIUS*2` square — and asserts none of them: a slider built with the knob's 92×92 area, or centred on the wrong slot, passes everything. Related, and the reason this is deferred rather than patched: `commandNames` records names only by design, so the *coordinates* the three `paintXFace` methods draw at are equally invisible — `paintSliderFace` hard-coded to `knobCentre(0)` would be green. Closing this properly means recording constructor geometry and draw-command arguments, which is the same harness work as the standing text-height item (`height: 18`, `measureText ≈ length * 7`) and belongs with it rather than inside this story.

#### Dismissed

- **"No screenshot accompanies a new rendering surface."** The Completion Notes record the bench confirmed by eye at 1280×720 in EN and FR, which is the project's stated requirement. Raised by a layer that had not read the story.

## Dev Notes

### §0. `_bmad-output/project-context.md` exists — read it first

Revision 2.6, 216 lines, 136 rules, dated 2026-08-19. **The first finding of Story 3.3's code review was that the story asserted twice that this file did not exist**, when it had existed at the story-creation commit and had been expanded before dev — so that work was done against unread governing rules and crossed two of them, costing a retired surface and a re-worded AC. The rules most likely to bite this story are extracted into §Project Context Rules below, but that extract is a pointer, not a substitute.

### §1. Scope boundary — read this before writing anything

**In scope:** two new optional authored fields and the code that reads them; a test pinning what AC5 asserts; an authoring guide; an example fixture; the prototype adopting the new affordances.

**Out of scope, and each is out of scope for a stated reason:**

- **No new scene, no new phase, no change to `CASE_PHASES` or `SCENE_KEYS`.** The router's contract (ADR-009) is that content owns the phase→scene map and the router obeys it. That already holds.
- **No registry or plugin layer.** project-context.md §Guided-Adventure states this for case-specific rules ("at two cases a branch is the whole mechanism") and again for experiment models ("Two entries, and still no registry layer"). Three affordances is a switch in an instrument factory.
- **No change to `CaseRecordSchema` and no record migration.** Neither new field is persisted. `affordance` changes how a control is *drawn*; the run record stores the control's value, which is unchanged. If you find yourself writing a migration, stop — you have made one of these fields persist and that is a different story.
- **No fourth module in `src/ui/`.** It holds exactly three and that is the whole non-Phaser surface set. A new on-canvas widget belongs in `src/adapters/phaser/ui/`; a new instrument belongs beside `ApparatusInstrument.ts` in `src/adapters/phaser/renderers/`.
- **Do not fix `formatMeasurement`'s separator-before-every-unit gap** (the prototype's bench reads `0 °` rather than `0°`). It is shared with Young's rendering and fixing it inside this story would move Young's typography as a side effect. **Owner: Story 4.2.** You will notice it while looking at a rotation dial. Leave it.
- **Do not touch the 1887 excerpts' provenance, the unassigned scholarly reviewer, or the five dead Phaser template scenes.** Each is carried in `deferred-work.md` with an owner or an explicit "unassigned".

### §2. What "authoring contract" means here, and what it does not

AC1 reads like a large schema story. It is not: **six of the six named field groups already ship and are already validated.** The pivot's Stories 1.10, 1.11, 1.12, 2.5, 2.6 and 3.1 built them incrementally, and Story 3.2 proved them against a second case. What 3.4 adds is (a) the two fields the 2026-08-06 sprint change appended, (b) the *statement* of the contract as documentation and a runnable example, and (c) a test that pins the case-agnosticism AC5 claims.

The risk in this story is therefore **not** under-building. It is:

1. **Rebuilding what exists.** Read §3 before writing a schema line.
2. **Authoring a field nothing reads.** Both new fields must be genuinely consumed — a `cast` that changes staging, and an `affordance` that changes what is drawn. project-context.md lists "Author a case field that nothing reads" in the Don't-Miss table: *shipped-and-dead content, the same defect class as an unreachable intent*.
3. **A documentation deliverable that goes stale on the next commit.** That is what AC7's parsed fixture is for.

### §3. What exists today — read these before writing anything

| File | Why you must read it |
|---|---|
| `src/schemas/CaseDefinitionSchema.ts:643-688` | `ScenarioDialogueBeatSchema`, `ScenarioSceneSchema`, `ScenarioScriptSchema`. The two comments about *why there is no `.min`* are the design; §5 explains how they apply to `cast`. |
| `src/schemas/CaseDefinitionSchema.ts:1501-1532` | The `--- Scenario dialogue beats ---` refinement block. Your cast rules go here, for the reason its own header gives: `ScenarioScriptSchema` cannot see `colleagues`. |
| `src/schemas/CaseDefinitionSchema.ts:125-157` | `PrimaryControlSchema`. Note `inlineLabel`'s docstring: *required rather than optional-with-fallback, because falling back is precisely the silent degradation that shipped the broken sentence*. `affordance` is the opposite case — optional with a default is correct, because there is a real default and no locale hiding in it. |
| `src/schemas/CaseDefinitionSchema.ts:777-899` | The whole `CaseDefinitionSchema` object. This is the field list your minimal fixture must satisfy. |
| `src/domain/cases/ScenarioScript.ts` | `SCENE_KEYS`, `RIVAL_LAB_SCENE_KEY`, `ScenarioScene`, `ScenarioScript`. Read the `RIVAL_LAB_SCENE_KEY` docstring before you consider adding a scene key. |
| `src/adapters/phaser/SceneRouter.ts` | Already pure, already read-only, already driven by the script. AC5 is a test against this file, not a change to it. |
| `src/adapters/phaser/renderers/characterStageView.ts:365-396` | `PresentColleaguesInput` / `presentColleagueIds`. **This is the one seam.** Its docstring names this story. |
| `src/adapters/phaser/renderers/ColleagueRenderer.ts:543-568, 825-852` | `resolveStageCast` (pure, exported, tested) and `stageCast` (the store lookup that feeds it). Change the input, not the shape. |
| `src/adapters/phaser/renderers/ApparatusInstrument.ts` | The current instrument. `ApparatusInstrumentOptions` (`:81-104`) and `ApparatusInstrumentView` (`:106+`) are the contract with `ApparatusRenderer`; keep both. Read `onValueChange`'s docstring — it returns whether the store *committed*, and the instrument believes the answer. Every new affordance inherits that. |
| `src/adapters/phaser/renderers/instrumentView.ts` | The rotary conversion, Phaser-free by design. Its header states the split with `apparatusGeometry.ts` explicitly: *a number that answers "where is it" goes there; a number that answers "what does turning it mean" goes here.* Honour it. |
| `src/adapters/phaser/renderers/apparatusGeometry.ts:204-260, 405-431` | Slot geometry and the non-overlap sweep. The sweep is the trap — see Task 2. |
| `src/core/store/selectors.ts:380-400` | `selectDialogueBeats`, keyed on **phase** not scene key, because `TheoryBoard` hosts both `synthesis` and `review` as separate script entries. Your cast lookup must key the same way, or the two boards will read one cast. |
| `tests/integration/CharacterStaging.test.ts:109-120, 345-390` | Drives `resolveStageCast` directly rather than restating the rule — the 2.9 review's requirement. Extend it; do not write a parallel copy. |
| `tests/e2e/french-typography.spec.ts:185-194` | `FIGURE_SLOT_WIDTH`, divided by `colleagues.length`. `deferred-work.md:85` says this diverges *the moment this story lands*. See §14. |
| `docs/source-rights/README.md` | The shape your `docs/content-authoring/README.md` should follow. |
| `tests/shippedCases.ts` | How a test reads content without adding to the `typecheck:tests` backlog. §12. |

### §4. The two new fields — author exactly these

From `sprint-change-proposal-2026-08-06.md` §4.3.2, verbatim:

> - `scenarioScript.scenes[].cast?` — the colleague IDs present in that scene, defaulting to the full cast. Lets a case stage who is in the room without scene code.
> - `apparatus.primaryControls[].affordance?` — `knob` | `dial` | `slider`, defaulting to `knob`. Selects the instrument the scene draws; the authored range, step, and validation are unchanged.
>
> Both are optional and additive, so existing case content parses unchanged.

Two shapes, and no third. If a field feels missing, it belongs to a later story — record it in `deferred-work.md` with an owner rather than authoring it here.

### §5. Schema refinements — all load-time, all fail-closed, each naming its path

#### §5.1 The four `cast` rules

Add these to the block at `CaseDefinitionSchema.ts:1501`, inside the existing `definition.scenarioScript.scenes.forEach`:

1. **Every cast ID resolves to an authored colleague.** Path: `['scenarioScript','scenes',i,'cast',j]`. The set `colleagueIds` is already built at `:1234`. This also stops an author staging the rival lab, who is deliberately not a member of `colleagues[]` — the same reasoning the colleague-hint rule at `:1341` gives in its own comment.
2. **No duplicate IDs within a scene's cast.** Path: `['scenarioScript','scenes',i,'cast']`. A duplicate would stage one figure twice and halve the slot width for everyone.
3. **An authored cast is not empty.** Path: `['scenarioScript','scenes',i,'cast']`. **In the refinement, not as `.min(1)` on the shape** — and the reason is written two lines above in the same file: a base-parse failure makes Zod skip the whole `superRefine`, silencing every authored-content message at once, so an author fixes one problem at a time from a message that names none of them (the 1.12 review). Note the deliberate asymmetry with `dialogueBeats`, where `[]` and absent are treated *identically* because "no conversation yet" is a thing an author means. `cast: []` is not: absence already says "everyone", and "nobody" is not a state any figure-staging scene can render.
4. **Every beat speaker in a scene is a member of that scene's cast.** Path: `['scenarioScript','scenes',i,'dialogueBeats',j,'speakerId']`. This is the rule that makes the feature safe: `deferred-work.md:84` describes exactly the defect — a beat spoken by somebody not staged plays with nobody on stage — and notes it is unobservable today only because Young's proposers, speakers and cast are the same four people. The existing speaker rule at `:1516` checks membership of `colleagues`; this one narrows it to the scene when a cast is authored.

#### §5.2 The staging-scene rule (AC2, final clause)

A `cast` authored on a scene that stages no figures is content nothing reads. Today exactly two scene keys stage a figure column — the two that construct a `ColleagueRenderer` (`ColleaguesScene` for `prediction`, `TheoryBoardScene` for `synthesis` and `review`). `LibraryScene`, `LaboratoryScene` and `DebriefScene` construct none; `RivalLabScene` stages its own cast of one from `rivalLab`, not from the script.

Export that set as a single constant in `src/domain/cases/ScenarioScript.ts`, beside `SCENE_KEYS`, and refine against it with the offending path named.

> **The constant needs a consumer beyond the schema, or it is a second copy of a rule.** project-context.md: *"Write a case constant (550, a control id, a count) into code twice → two copies of one rule drift, and the surface then paints a state the reducer refuses."* Give the renderers' owning scenes a reason to read it, or add a test that fails when a scene starts or stops staging a cast without the constant moving. Which seam you pick is your call — that it exists is not.

#### §5.3 The `affordance` rule

One `z.enum` over one exported constant, shared by `PrimaryControl`'s type and `PrimaryControlSchema`. That is the whole schema-side rule: every other control validation (`max > min`, default in range and on step) is affordance-independent and must stay that way, which is AC3's "the authored range, step, and validation are unchanged".

**No default in the schema.** Resolve `control.affordance ?? 'knob'` at the one place that draws — a schema default writes `knob` into the parsed object, which then reads as authored content the author did not write, and `.strict()` round-trips stop being faithful.

### §6. The cast seam — one call, and the ordering rule that must survive it

`presentColleagueIds` today (`characterStageView.ts:392-396`):

```ts
const present = [...new Set([...proposerIds, ...speakerIds])];
return Object.freeze(present.length > 0 ? present : [...castIds]);
```

Order is load-bearing and documented twice. `ColleagueRenderer.stageCast`'s docstring (`:827-831`): *"Proposal order, not cast order, which is what makes AC3's adjacency mean anything: the two boards attribute in different orders — prediction is `thea, elias, marianne, samuel`, conclusion is `marianne, elias, thea, samuel` — so a fixed cast order would put three of the four colleagues beside somebody else's draft on the conclusion board."*

So the authored cast decides **presence**, and proposal order still decides **sequence**:

> When a scene authors a `cast`, the staged set is exactly that cast. Order it proposal-order-first (the members that authored a proposal on this board, in proposal order), then the remaining authored cast members in their authored order. When no `cast` is authored, behaviour is exactly today's.

Write that rule in the function's docstring, and assert both halves — presence *and* order — in `CharacterStaging.test.ts`. The AC4 half ("absence produces today's behaviour") needs its own named test; it is the one an author will rely on and the one a refactor will silently break.

### §7. The affordance seam — three instruments, and what makes them three

A review will ask whether `dial` is a knob with a different label. Fix the answer now:

| Affordance | Travel | Pointer→value conversion | Physically right for |
|---|---|---|---|
| `knob` (default) | 270° arc from 135°, with a dead zone | Angle within the arc → fraction → stepped value. **Exists**, in `instrumentView.ts`, with hysteresis at the dead zone (2.10's fix for a drag flipping max→min ~46° past the end). | A bounded setting with a hard stop — Young's two. |
| `dial` | Full circle, no dead zone, graduations read against a fixed index mark | Angle → fraction over 2π → stepped value. **No dead zone means no hysteresis** — which is the point for an angular quantity, where the knob's stop is an artefact of the widget rather than of the instrument. | `rotationDeg`, read off a divided circle. |
| `slider` | Linear travel along a track with a draggable thumb | Distance along the track → fraction → stepped value. | `bathTempC`, read off a linear scale. |

Three constraints on all three:

- **Snap before dispatch, never after** (ADR-012, and `instrumentView.ts`'s own header explains why: the reducer *would* snap for us, and then the normalization rule becomes visible as the value jumping under the cursor).
- **Discrete step affordances and keyboard stepping stay**, and both paths produce identical run records. `steppedNeighbour` already exists and is affordance-independent — reuse it rather than writing a per-affordance stepper.
- **Everything fits `INSTRUMENT_SLOT_WIDTH = 168`** in the existing slot band, so `INSTRUMENT_READOUT_Y` and the bench layout do not move.

**The trap in this task** is `apparatusGeometry.ts:405-431`. That sweep derives every band it checks from `knobCentre` and `stepAffordanceCentre`. Ship a slider without touching it and the sweep measures a knob that is not drawn while the slider overlaps its neighbour unmeasured — the same defect shape as `FIGURE_SLOT_WIDTH` (§14) and the same shape as story 2.11's sixteen text-into-a-too-small-reserve findings. Make the sweep affordance-aware, and remember that the harness cannot see text height (§13), so **confirm the bench by eye at 1280×720 in both locales** before calling it done.

### §8. AC5 is already true — pin it, do not build it

Everything AC5 asks for shipped with Story 3.2. The evidence, all read at HEAD:

- `SceneRouter.resolveSceneKey` is a pure phase lookup over the authored script; the router never dispatches and never infers a phase.
- Grepping `src/` for a case ID outside `src/schemas/` returns exactly two hits, and both are sanctioned: `src/adapters/content/resolveCaseId.ts` (the `?case=` route gate against `KNOWN_CASE_IDS`) and `src/domain/apparatus/experimentModels.ts` (the closed model list, keyed on `modelId` and deliberately **not** on case ID).
- Case-specific *rules* live in `if (definition.id === YOUNG_CASE_ID)` inside one `superRefine`; case-specific *physics* is a keyed lookup on `experiment.modelId`. Both mechanisms are documented in project-context.md §Guided-Adventure and neither is a scene concern.

So the deliverable is a test with two halves:

1. **A fixture-driven router walk.** Drive `createSceneRouter` against `SceneRouterTarget` (the reference injection pattern — Vitest has no canvas) using the §9 fixture's script, and assert all six phases resolve to the authored scene keys with no shipped case loaded.
2. **A source-level assertion** that no case ID string appears under `src/adapters/phaser/**` or `src/domain/**` outside the two sanctioned seams. Name the seams in the test so a future addition is a deliberate edit rather than a silent one.

Half 2 is the one that earns its keep: half 1 passes today and would keep passing while somebody wrote `young-interference` into a renderer.

### §9. The example fixture — every required field, and the four that will trip you

AC7's "minimal valid scenario" means a **complete `CaseDefinition`** that parses and from which nothing can be removed. That is the honest demonstration of "a new case can be authored without touching engine code" — a fragment would demonstrate nothing.

The full required set, from `CaseDefinitionSchema.ts:777-899`: `id`, `version`, `title`, `openingDispute`, `contextualArtifacts` (**exactly 2** — min 2, max `MAX_CONTEXTUAL_ARTIFACTS` = 2), `prediction`, `apparatus.primaryControls` (1–2), `experiment` (`modelId`, `modelVersion`, `assumptions`, `confound`, `resetPath`), `requirements` (three counts, each ≥ 2), `significanceRule`, `colleagueHints` (≥1), `readingGateHints` (≥1), `colleagues` (≥1), `predictionProposals` (**exactly 4**), `conclusionProposals` (**exactly 4**), `rivalLab`, `consultationRules` (≥4), `peerReviewRules` (≥3), `flow`, `autoSummary`, `scenarioScript`, `debrief`, `assets`, `ledger`.

**The four that will trip you:**

1. **`experiment.modelId` must be one this build implements.** `EXPERIMENT_MODEL_IDS` is a closed exported list of two (`young-double-slit`, `morley-miller-interferometer`), refined at load with the offending path named. **The fixture cannot invent a third model.** Pick one and author the controls its `requiredControlIds` demands — a model fed controls the case does not author is refused at load too.
2. **`encodesPath` applies to every authored string, in both locales.** Arrows (`→ ⇒ ⟶ -> =>`) are rejected in both; the English word list is `scene|phase|route`; French is guarded at phrase level. Writing "move to the next scene" in an example is the exact mistake the guide is meant to prevent an author making.
3. **`ledger` is required** and every row must be honest. A fixture ledger must not claim `reviewerState: 'reviewed'` for something nobody reviewed — project-context.md is explicit that `rightsStatus: 'reviewed'` asserts the material *is* public-domain, not that somebody looked at it. Author the fixture's rows as `pending` with no reviewer name and no date. A blocked example ledger is the correct example.
4. **`rivalLab.critiques` must cover all four conclusion proposals**, and **at least one conclusion proposal must be satisfiable** (`isSatisfiablePredicate`) or the case is uncompletable by construction and refused at load. An `all-of` with an empty `predicates` array is vacuously true and separately refused.

**Where it lives:** `docs/content-authoring/minimal-scenario.case.json`. **Not** under `public/cases/` — that directory is shipped, immutable content, and `resolveCaseId` gates on `KNOWN_CASE_IDS` anyway, so a fixture there would be dead weight in the bundle. Give it a `kebab-case` `id` that is obviously an example and is *not* a member of `KNOWN_CASE_IDS`.

**Its test** parses it through the production schema — same reasoning as `tests/shippedCases.ts`'s docstring: *"a test that reads content and asserts on it is only a statement about the release if the content also validates."* Here it is stronger: parsing *is* the assertion, because the fixture's whole job is to be valid.

### §10. `docs/content-authoring/` — what it must contain

Follow `docs/source-rights/README.md`'s shape: what this is, how to do it, what will refuse you.

- **The AC1 inventory.** Six field groups → schema symbol → refinements. This is what turns AC1 from "already done" into a deliverable.
- **How to author a scenario script**: the six phases, the scene vocabulary, why array order carries no meaning (`resolveSceneKey` looks up by phase), why `RivalLab` is routable but not authorable.
- **How to author proposals**: 1-of-4 both times and why `.length(4)` is the design; attribution to a colleague; the support-predicate vocabulary including the three nesting levels and the pinned-vs-unscoped distinction (`unvaried-control-pinned` reads the pinned runs; every other support predicate reads the whole notebook — the story-3.2 near-miss is worth two sentences here, because an author who gets it wrong makes a conclusion unreachable).
- **How to author a significance rule**: `criticalControlIds` against the case's own controls, `criticalModelInputIds` against the model's input names, and the reachability question — *can an author fill this in a way that makes the case unfinishable?*
- **How to author rival-lab lines**: full coverage of the four conclusions, the 700-character editorial bound and why it is enforced at load, and that he is narrative dressing and never a fail state.
- **The two new fields**, with the fixture as the worked example.
- **The refusal messages an author will actually see**, quoted from the schema, so a search for the message lands here.
- **A pointer to `docs/i18n-authoring.md`**, not a restatement of it.

Written in English (it is authoring guidance, not player-facing content). The EN+FR obligation applies to what an author *writes*, and the guide must say so in its own voice: every localizable string carries both, `fr` is not optional, and the French is French.

### §11. Service worker, versions, and what does **not** need bumping

The rule is: *whenever you make a case-JSON or manifest field **required**, bump `CACHE_NAME` in the same commit.* Both new fields are **optional**, so a cached older `case.json` still strict-parses under the new schema — the failure mode v3/v5/v6/v8 each record does not arise.

`manifestsMatch` (`src/adapters/content/loadCaseDefinition.ts:26-34`) compares `assets.manifestVersion` and the entries, **not** `case.version`. So bumping the prototype's `version` for Task 3 does not create a manifest mismatch either, provided you do not touch `asset-manifest.json`.

**Conclusion: no `CACHE_NAME` bump is required by this story as scoped.** State that reasoning in the PR rather than bumping defensively — a bump costs every returning player their cache. If the scope changes such that a field becomes required or the manifest moves, bump `public/sw.js` and add the reason to its header list, which is a genuine changelog and not decoration.

`CaseDefinition.version` **is** bumped on the prototype, per the standing rule that any contract change bumps it.

### §12. `typecheck:tests` — the count is the metric

`npm run typecheck:tests` is red at **114 errors across 59 files**, deliberately not gated in CI so the pipeline stays publishable, and **it may only go down**. The single most common entry is `TS2307` from `node:` imports, because `@types/node` is deliberately not a dependency — 26 files carry exactly that one error.

So: **do not import `node:fs` in a new test file.** Read the fixture through `tests/shippedCases.ts`, extending it if its current shape does not fit. That module exists for precisely this and says so.

Also: `tsconfig.test.json`'s own header comment still claims 106/56. That figure was stale when written. Correct it while you are in the file, and measure the real number against a stashed clean baseline rather than trusting any carried figure.

### §13. Testing requirements

**Where each test goes.** Pure rules → `tests/unit`. Anything driving `resolveStageCast` or the router with an injected slice → `tests/integration` (that is where `CharacterStaging.test.ts` lives). Canvas walks → `tests/e2e`.

**What the harness can and cannot see.** `tests/unit/sceneSlice.ts` now records Graphics draw commands since the last `clear()`, every tween config, and every `killTweensOf` target — so "paints nothing" and "starts no tween" can genuinely fail. What it **still cannot see is text height**: every text object reports a constant `height: 18` and `measureText` approximates width as `length * 7`. Any "the readout fits" or "the bands do not overlap" claim proven only in the harness is an assertion about arithmetic, not about what is painted. Derive reserves from the exported `*LineHeight` helpers and confirm by eye at 1280×720 in both locales.

**Mutation proofs — required, and this project's record makes the case.** 982, 1125, 1293 and 1334 green suites each hid a load-bearing defect, and mutation is what found them, every time. For each guard below: disable it, confirm the test named for it goes red, restore it, record both.

1. The cast→colleague resolution refinement.
2. The speaker-in-cast refinement (the `deferred-work.md:84` defect).
3. The non-empty-cast refinement.
4. The staging-scene refinement.
5. `affordance ?? 'knob'` — break the default and watch the AC4 "absence produces today's behaviour" test fail. If it stays green, that test is not covering the default.
6. Each new snap-before-dispatch conversion. Return the raw pointer value and the run-record-identity test must fail; if it passes, it is comparing a dispatch to itself.

**Tests that cannot fail read as coverage and are worse than none.** The reviews of 2.11, 3.2 and 3.3 found, all real: two `expect(x).toBe(x)`, a pane test that passed with the pane fully armed, two "starts no tween" tests that asserted nothing, a rounding test that compared its output to itself, a length assertion that was a tautology under a comment claiming it caught exactly that, and a sweep executing zero assertions for the prototype. When you write an assertion, name the change to `src/` that would break it.

**Baselines at HEAD `9ddb45a`, to measure your arithmetic against:** **1403 unit tests across 77 files**, **61 e2e passed** (three identical idle runs), `typecheck` clean, `typecheck:tests` **114 errors / 59 files**. State your own counts as deltas against these, and measure the `typecheck:tests` figure against a stashed clean baseline rather than trusting the carried number — the 3.2 review found the carried figure was already stale.

**E2E.** The canvas walks are frame-timed and load-sensitive. Judge a failure on an **idle** machine before attributing it to your change — three earlier runs during the 2.11 review showed 8–10 failures purely from CPU contention. Wait on the thing the gesture was supposed to achieve, never on a fixed sleep.

### §14. Deferred-work items this story owns

Both are in `deferred-work.md` and both name this story:

- **`deferred-work.md:84`** — `CharacterStage.create` and the never-rebuilt cast. The *rebuild* half was closed during the 2.9 review (`CharacterStage.render` now takes the cast every render and rebuilds when the **set** changes), so `synthesis → review` inside one scene is already safe. What remains is the note's own last sentence: *"Story 3.4 lands the authored `scenarioScript.scenes[].cast` that makes the derived set genuinely vary — resolve it there."* Verify the rebuild actually fires for an authored cast change, then strike the item.
- **`deferred-work.md:85`** — `FIGURE_SLOT_WIDTH` in `tests/e2e/french-typography.spec.ts:192`. The spec divides the proposal surface by `colleagues.length`; the renderer divides it by `presentColleagueIds(...).length`. Equal for Young today and **divergent the moment this story lands**, at which point the spec measures a plaque slot nothing paints — *"the failure mode this file has already been patched for twice."* Derive the spec's bound from the same rule the renderer uses, taking the **narrowest** staged slot across the shipped scenes, since the narrow case is the one that clips.

Record anything this story opens in the same file, with an owner. project-context.md: *what cannot be re-stated goes in `deferred-work.md` as newly reachable, with an owner.*

### §15. Lessons from 3.1, 3.2 and 3.3 that apply directly here

- **A comment claiming a guarantee is not a guarantee.** Three of story 3.1's four un-re-stated shapes shipped with a comment asserting the check existed — one claimed a validation loop rejected an unauthored key, and the loop iterates the definition, so such a key is structurally invisible to it. The test named for that case passed for a different reason. **Third story running that this has been the finding.** When you write "still rejected" in a comment, break the guard and watch the named test go red.
- **A graceful degradation is the defect shape a green suite keeps.** Story 3.2's bench read "dark at 0 slit spacing and 22 screen distance" for the prototype: nothing threw, 1293 tests stayed green, and the bench lied. A `cast` silently ignored, or an `affordance` silently drawn as a knob, is the same shape.
- **When two code paths answer the same question, change them together.** Before you guard one, grep for the others. Your `cast` question is asked in at least three places — the schema refinement, `presentColleagueIds`, and the typography spec's slot width.
- **Make the list of things you touched explicit and tick each one off.** Story 3.1 re-stated one guarantee exemplarily and left four unstated; its review found all four. For this story the list is short: two fields, five refinements, one seam each, one spec bound.
- **Read the governing rules before dev, not after.** Story 3.3's first review finding. §0.

### Project Structure Notes

**Where each deliverable lands, and why:**

| Deliverable | Path | Rule that decides it |
|---|---|---|
| `cast` type | `src/domain/cases/ScenarioScript.ts` | `src/domain/` is pure TypeScript — no Phaser, DOM, fetch, IndexedDB, **and no Zod**. |
| Staging-scene constant | `src/domain/cases/ScenarioScript.ts` | Beside `SCENE_KEYS`, which is the content vocabulary it qualifies. |
| `affordance` type | `src/domain/cases/CaseDefinition.ts` | Same rule; `PrimaryControl` already lives there. |
| Both schemas + refinements | `src/schemas/CaseDefinitionSchema.ts` | `src/schemas/` owns every Zod schema. Every object is `.strict()`. |
| Pointer→value conversions | `src/adapters/phaser/renderers/instrumentView.ts` | Phaser-free by design so Vitest can drive it; the module's header states the "what does turning it mean" split. |
| Instrument geometry | `src/adapters/phaser/renderers/apparatusGeometry.ts` | The "where is it" half of the same split. |
| Instrument drawing | `src/adapters/phaser/renderers/ApparatusInstrument.ts` | Renderer contract: `create()` / `render(state)` / `destroy()`, owning every display object, tween, timer and listener it creates. |
| Authoring guide + fixture | `docs/content-authoring/` | AC6 names the directory. |
| Prototype content | `public/cases/morley-miller/case.json` | Edit only `public/cases/…` — `dist/` is build output and `.claude/worktrees/**` is a stale copy. |

**Naming:** `PascalCase` for classes and their files, `camelCase` for non-class modules and JSON fields, `UPPER_SNAKE_CASE` for constants, `kebab-case` for case IDs and asset paths. Fallible operations return `Result<T, ResultError>` rather than throwing.

**Do not create:** a `services/`, `managers/`, or `helpers/` catch-all; a fourth module in `src/ui/`; an affordance registry; a new scene. And do not wire, extend, or imitate `src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` — they are orphaned Phaser-template leftovers referenced nowhere.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` revision 2.6 — the rules that bear on *this* story. The file is governing; this is a pointer to the parts you will cross.

**Engine (ADR-001 v1.1, ADR-011, ADR-012)**
- Phaser 4.2.1 is the sole interactive presentation surface. Never add semantic HTML to mirror a Phaser gesture.
- Canvas completeness: a feature is not done until the canvas can dispatch its intent. Grep for every dispatcher of every action this story touches.
- `src/ui/` holds exactly three modules. **Do not add a fourth.** Phaser widgets live in `src/adapters/phaser/ui/`, which is not `src/ui/`.
- Never author player-facing copy in `create()` — it runs once and the locale can change. Create text empty, populate in `render(state)` through `createTranslator(locale)`.
- Honour `prefers-reduced-motion` in every animated renderer. The apparatus is unlit until the player starts it: **no animation loop may register from `create()`** for the experiment's light.
- Drag snaps to the authored step before dispatch, in a Phaser-free module, unit-tested at both range ends and across every step. Every draggable instrument keeps a discrete step affordance and keyboard stepping, and both paths produce identical run records.
- Leave no tween, listener, or display object alive after `destroy()`.
- The store is authoritative: scenes read through selectors and write only typed actions. No scene→scene reach-in. The router never dispatches, and a routing failure must never escape the store subscriber.
- Every affordance stays available at every width. Do not reintroduce a viewport gate.

**Guided adventure**
- Everything is authored; nothing is freeform.
- **Do not build a plugin or registry layer** for case-specific rules — a branch on `id` is the whole mechanism at two cases. Case *physics* is a keyed lookup on `modelId`; do not mix the two mechanisms.
- **No authored content may leave a gate unsatisfiable**, and a gate can be made unsatisfiable by code as well as by content. Ask it of every predicate you write.
- **Author no case field that nothing reads.** Shipped-and-dead content is the same defect class as an unreachable intent.
- When you relax or add a schema shape, find out what it holds and state it. Make the list explicit and tick each item off.
- Prediction and conclusion are each 1-of-4; `.length(4)` is the design. Choices are revisable. Defensibility is evaluator/critique-only, and character staging must not be able to read the defensible set — a staging renderer gets the cast, the speaker, and the accent colour, nothing more (ADR-006).
- Authored copy must not name a scene, phase, or route (`encodesPath`).
- Never write a control id into a renderer — compose from `apparatus.primaryControls` and each control's authored `inlineLabel`.
- A refused action always says why, and the message survives until a real state change replaces it.

**i18n (ADR-010, NFR19)**
- EN + FR from launch; locale from the browser; **no player-facing language selector**.
- Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria. **Build the surface list by grepping for the read, not from the story's file list** — that is exactly how story 3.2 missed `CaseFilePresenter`.
- **Never compose a French phrase by joining a preposition or article to an authored label.** Author the joined form.
- No webfont. Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback.

**Performance**
- 60 FPS at 1280×720 on a representative low-end school laptop. Keep `update()` minimal; no logging, JSON parsing, IndexedDB, DOM work or transient allocation in render/update hot paths. Animate on elapsed time. Pool only after profiling.
- NFR1's profile has **never been run** — do not treat 60 FPS as verified, and do not substitute an automated figure for it.

**Organization**
- `src/domain/` is pure TypeScript, no Zod. `src/schemas/` owns every Zod schema, all `.strict()`. `src/adapters/` owns all side effects. The dependency direction never reverses.
- Case definitions are immutable under `public/cases/`; player progress lives only in IndexedDB. Bump `CaseDefinition.version` on any contract change.
- Never recalculate a saved historical run against a newer experiment model.

**Testing**
- Unit-test all pure domain logic with Vitest; never require Phaser or a browser to test scientific logic. Inject the structural slice (`SceneRouterTarget` is the reference pattern).
- Never assert a magic number that a test shares with source unless both read one exported constant.
- **Break the guard and watch a named test go red** — the project's highest-yield practice.
- a11y acceptance is no longer a gate (ADR-008). Keep the reduced-motion / no-flashing check. Do not add new a11y-parity assertions, and do not delete the existing a11y specs.

**Platform**
- Offline reload is a release gate. A schema change that makes an older cached response unparseable is a `CACHE_NAME` bump — see §11 for why this story is not one.
- Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.

### References

- [epics.md §Story 3.4](../planning-artifacts/epics.md) — lines 1130–1158, including the 2026-08-06 amendment that adds the per-scene cast and the affordance descriptor.
- [sprint-change-proposal-2026-08-06.md §4.1.9](../planning-artifacts/sprint-change-proposal-2026-08-06.md) — the amendment as approved, lines 733–742.
- [sprint-change-proposal-2026-08-06.md §4.3.2](../planning-artifacts/sprint-change-proposal-2026-08-06.md) — the two field definitions verbatim, lines 818–828.
- [sprint-change-proposal-2026-08-06.md §4.3.4](../planning-artifacts/sprint-change-proposal-2026-08-06.md) — ADR-011 and ADR-012 in full, lines 846–860.
- [project-context.md](../project-context.md) — revision 2.6, governing. §Engine, §Guided-Adventure, §i18n, §Organization, §Testing.
- [deferred-work.md:84–85](deferred-work.md) — the two items this story owns.
- [3-3-source-and-rights-ledger.md](3-3-source-and-rights-ledger.md) — the immediately preceding story; its Review Findings open with the unread-project-context finding.
- [3-2-reviewable-morley-miller-prototype.md](3-2-reviewable-morley-miller-prototype.md) — the second case, and the three Young-shaped walls that were green in 1293 tests.
- [docs/source-rights/README.md](../../docs/source-rights/README.md) — the documentation shape to follow.
- [docs/i18n-authoring.md](../../docs/i18n-authoring.md) — cross-reference, do not restate.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (`claude-opus-4-6`), via the `gds-dev-story` workflow.

### Debug Log References

**Four open questions answered by Alexis before implementation**, all taking the story's stated
recommendation:

1. **The prototype adopts the affordances** (Task 3 as written), rather than proving them through the
   fixture alone. `rotationDeg` is authored `dial` and `bathTempC` `slider`; Young is untouched.
2. **`dial` is full-circle with no dead zone**, read against a fixed index mark — §7's definition.
3. **`cast: []` is refused at load**, the deliberate opposite of `dialogueBeats: []`.
4. **The AC1 inventory is documentation *plus* a non-tautological test** — one that proves each field
   group is *refined*, not merely present.

**Two measurements that contradicted the story, both recorded rather than worked around:**

- **`typecheck:tests` is 114 errors across *60* files, not 59.** Measured at HEAD `6ee85f0` on a clean
  tree before any edit. AC9's "114 errors across 59 files" carried the wrong file count; Story 3.3's own
  sprint-status note already said 114/60. The error count — which is the metric — is met exactly.
  `tsconfig.test.json`'s header still claimed 106/56 and is corrected, with the command to reproduce it.
- **`project-context.md` is 216 lines, not 215.** Read in full before any code was written (Task 0), per
  §0 and Story 3.3's first review finding.

**Two mutation proofs that failed to fail, and what that exposed.** Both are recorded because the
green result was the finding:

- **`controlAffordance`'s `?? 'knob'`.** Breaking it to `?? 'slider'` left the whole suite green. The
  AC4 test compared two *defaulted* controls, so the mutation moved both sides equally — precisely the
  "test that cannot fail" shape §13 predicts for this guard. Rewritten to compare the absent case
  against an **explicit** `'knob'`; the mutation now fails three tests.
- **The dial indicator's conversion.** Replacing `dialAngleForValue` with `knobAngleForValue` in
  `paintValue` left everything green: the indicator still turned, and still turned differently for
  different values — it simply pointed at the wrong graduation. Nothing could see it, because
  `tests/unit/sceneSlice.ts` swallowed `setPosition`/`setX`/`setY`/`setRotation` entirely. **The harness
  was the defect**, so the harness was fixed (below) and the assertion added.

**Two harness gaps closed in `tests/unit/sceneSlice.ts`**, both of which were blocking real assertions:

- **Draw commands are now recorded by name**, not only counted. A count cannot distinguish a closed
  graduated ring from a 270° arc, so AC3's "genuinely distinct instruments" was unassertable — `arc`
  versus `strokeCircle` settles it.
- **Position and rotation are recorded.** An instrument whose moving part never moved was
  indistinguishable from a working one; `paintValue` could have been a no-op under a green suite, which
  is 2.10's `const dark = false` at the instrument layer.

The text-height gap (`height: 18`, `measureText ≈ length * 7`) is **not** closed and stays the top
deferred harness item.

**One design consequence surfaced by a sweep, not by review.** A `dial`'s travel closes, so its
minimum and maximum are drawn at the same angle and it cannot distinguish them. Correct for a cyclic
quantity, wrong for anything else, and unverifiable by any schema because cyclicity belongs to the
*model*. Held three ways: stated in the authoring guide, checked against every shipped dial's own model
output at both ends, and guarded against going vacuous. Recorded in `deferred-work.md` as newly
reachable, owner unassigned.

**Seventeen mutation proofs, each broken, observed red, and restored.** Every guard whose failure
would be silent:

| # | Guard broken | Named test that went red |
|---|---|---|
| 1 | The cast→colleague refinement | `rejects a cast member who is not an authored colleague, at the offending index` |
| 2 | The speaker-in-cast refinement | `rejects a beat spoken by somebody the scene does not stage` |
| 3 | The non-empty-cast refinement | `rejects an authored empty cast rather than reading it as "nobody"` |
| 4 | The staging-scene refinement | `rejects a cast on a scene that stages no figure column` |
| 5 | The duplicate-cast refinement | `rejects a repeated cast member, which would stage one figure twice` |
| 6 | `if (!this.stagesSameCast(cast)) this.buildFigures(cast)` | `rebuilds its figures when an authored cast shortens the staged set` |
| 7 | The sweep's per-control affordance → a hard-coded `'knob'` | `measures each control by its own affordance, not by the knob` |
| 8 | `control.affordance ?? 'knob'` → `?? 'slider'` | `draws a control with no authored affordance exactly as a knob` **+ 2 more** |
| 9 | The dial's face painter → the knob's | `paints a knob as an arc with a gap, and a dial as a closed ring` |
| 10 | The slider's face painter → the knob's | `paints a slider as a track, with no circle anywhere in it` |
| 11 | `paintValue`'s slider branch disabled | `rotates a dial indicator, and slides a slider thumb, on the same bench` **+ 1 more** |
| 12 | `dialAngleForValue` → `knobAngleForValue` in `paintValue` | `draws the dial's indicator at the dial's angle, not the knob's` |
| 13 | `sliderOffsetForValue(...)` → `0` in `paintValue` | 3 tests in `ApparatusAffordances.test.ts` |
| 14 | A case ID written into `LibraryScene.ts` | `finds none, in any scene, renderer or domain module` |
| 15 | `resolveSceneKey` → a hard-coded conventional phase→scene map | `follows a permuted map, so no phase→scene pairing is written into the engine` |
| 16 | A refusal message mis-quoted in the guide | `quotes only messages the schema actually emits` |
| 17 | An inventory row naming a renamed schema symbol | `carries the AC1 inventory: every named field group, mapped to its schema symbol` |

**Added at code review, 2026-08-19.** Proofs 18–20 are the guards the review's patches introduced or
repaired; 21 is the one Dev Notes §13 item 6 asked for and the original table omitted.

| # | Guard broken | Named test that went red |
|---|---|---|
| 18 | The slider's `([-1, 1]).forEach(...)` step-affordance construction | `keeps two discrete step affordances per instrument, whatever it is drawn as` — **which it did not before**: the old assertion averaged rectangles over the whole bench (8.5 against a floor of 2) and stayed green with the slider's pair deleted outright. |
| 19 | `this.scene.input.keyboard?.removeCapture(ARROW_KEY_CAPTURE)` in `ApparatusRenderer.destroy()` | `keeps every instrument armed and releases the arrow-key capture on destroy` — **also newly able to fail**: the test asserted `[]` before and after `destroy()` without ever focusing an instrument, so the capture was never taken and 2.10's fix was unguarded. It now arms a zone first. |
| 20 | The sixth cast refinement (a board's proposers must be staged) | `rejects a cast that leaves out a colleague whose proposal the board shows`, and `holds the same rule for the conclusion board, which the theory board stages` |
| 21 | `steppedControlValue` dropped from the slider branch of `resolveAffordanceValueForPointer` | 3 tests in `InstrumentView.test.ts` — **Dev Notes §13 item 6's snap-before-dispatch proof**, which the original 17 did not record even though the coverage existed |

**One guard the review could not make falsifiable, recorded rather than claimed.** `instrumentBand`'s
dial arm is a ternary between `DIAL_FOCUS_RADIUS` and `KNOB_FOCUS_RADIUS`, and the two are **both 54 by
design** so the bench row does not move. Hard-coding the dial's band to the knob's is therefore
undetectable by any value-based assertion, and the test that claimed to make "measuring the wrong one
detectable" could not do so for the dial. `ApparatusGeometry.test.ts` now asserts each band against its
own constants *and pins the equality*, with a comment saying plainly that the mutation is invisible
today and that the test becomes live the moment the two radii diverge.

Proofs 1–5 were **run twice**: the first pass restored the file with `git checkout`, which reverted the
whole schema change, so proofs 2–5 had run against a file with no cast rules at all and were failing for
the wrong reason. Re-run with a copy-based restore, each mutation site confirmed present exactly once
before mutating.

### Completion Notes List

**Scope held.** No new scene, no new phase, no `CASE_PHASES` or `SCENE_KEYS` change, no registry or
plugin layer, no `CaseRecordSchema` change and no record migration, no fourth module in `src/ui/`.
`formatMeasurement`'s separator-before-every-unit gap was seen on the rotation dial (`0 °`) and left
alone — owner Story 4.2, as instructed.

**AC1 — the contract is stated and provably enforced.** `docs/content-authoring/README.md` carries the
six-field-group inventory (field group → schema symbol → refinements). Backed by tests rather than
trusted as prose: every refusal message the guide quotes is checked against the schema that emits it
(28 of them), and every inventory row is checked to name a symbol the schema still defines.

**AC2 — a scene may author who is in the room.** `scenarioScript.scenes[].cast?`, with five load-time
refinements each naming its own path, all five mutation-proved. `presentColleagueIds` is the single seam
and now takes the authored cast; the ordering guarantee survives — an authored cast decides **presence**,
proposal order still decides **sequence**, asserted in both halves.

**AC3 — a control may author which instrument it is.** Three genuinely distinct instruments: a `knob`
(270° arc, hard stop, dead zone), a `dial` (closed graduated ring, fixed index mark, no dead zone) and
a `slider` (linear track and thumb). Distinct geometry *and* distinct pointer→value conversion — the
knob refuses its dead zone where the dial reads every angle, and the slider reads a distance rather
than a direction, all asserted. Every conversion is Phaser-free and unit-tested at both range ends and
across every step, for **both** shipped cases' controls. Every affordance keeps its two step
affordances and keyboard stepping, and drag and step agree by construction — no affordance owns a
stepper. Confirmed by eye at 1280×720 in EN and FR.

**AC4 — both fields are additive.** Both shipped cases parse unchanged with neither field authored, and
absence produces today's behaviour by test rather than by assumption — the AC4 tests were the ones the
mutation exposed as hollow and were rewritten.

**AC5 — pinned, not rebuilt.** Two halves: a fixture-driven router walk resolving all six phases from
the authoring example alone with no shipped case loaded, and a source-level sweep proving no case ID
appears under `src/adapters/phaser/**` or `src/domain/**`. The sweep distinguishes the **model** id
`morley-miller-interferometer` from the **case** id `morley-miller` — a substring match would have
reported it and been silenced with an exemption that then hid a real one. The router walk **permutes**
the phase→scene map, because resolving the conventional map proves only that the map is conventional.

**AC6/AC7 — the guide and the worked example.** `docs/content-authoring/minimal-scenario.case.json` is a
complete case definition. Its minimality is *measured*: every required top-level field is deleted in
turn and every bounded array shortened by one, and the only survivors permitted are the two optional
fields the example exists to demonstrate.

**AC8 — bilingual.** Every authored string in the example carries both locales, and a walk over the
parsed tree asserts no French value is byte-identical to its English sibling.

**AC9 — verification.** *(Re-measured after the code review's 32 patches, 2026-08-19.)* `typecheck`
clean · **1503 unit tests / 79 files** (from 1497/79 at dev, 1403/77 at story start) · `build` succeeds ·
**e2e 62 passed on three identical runs** (from 61 — the new one is the slider walk the review added) ·
`typecheck:tests` **114 / 60, still exactly at the measured cap**, verified by diffing the error list
against a stashed clean baseline rather than by counting: the two errors the patches introduced were
found that way and removed · `audit:ledger` unchanged, both cases still blocked at 7 and 2 — held by routing every new file read through `tests/shippedCases.ts`
rather than importing `node:` again. Offline reload still restores saved progress with no network
(`offline-reload.spec.ts`, green in all three runs).

**`CACHE_NAME` bumped to v11 at review (decision 2A).** The reasoning recorded here — both fields are
optional, so a cached older `case.json` still strict-parses under the new schema, and `manifestsMatch`
compares `assets.manifestVersion` rather than `case.version` — is correct for the *stale-content →
new-bundle* direction and was the only direction considered. The reverse is the one that breaks:
`contentPath` builds `cases/<id>/case.json` with no version query and `sw.js` is a per-response
fetch-through cache with no atomic swap, so mid-deploy a returning player can fetch the **new**
`case.json` while the hashed bundle still comes from cache, and `PrimaryControlSchema` is `.strict()`
with no `affordance` key before this story — `invalid-case-definition`, content unavailable, no
recovery offline. The rule now written into `sw.js`'s header: **an additive optional field is still a
bump, because `.strict()` makes every schema change breaking in the old-bundle direction.**

**Code review, 2026-08-19 — what changed after the fact.** Six decisions, all taking the review's
recommendation, and 33 patches applied. The story's own work held: the scope boundary was not crossed
on any of §1's eight items, and nine of the seventeen mutation proofs were independently re-run in a
clean worktree and every one went red as recorded. What the review found concentrated in two places.

*A version bump traced through the service worker but not through the record allowlist.* Task 3 bumped
the prototype to `1.3.0` and `CaseRecordSchema`'s prototype clause stopped at `1.2.0`, so **every saved
Morley–Miller investigation was refused** with `incompatible-case-record`. The comment three lines above
the break names that exact failure from when it happened at `1.1.0`. Fixed, with the rule stated at the
site: bumping `CaseDefinition.version` and extending the allowlist are one action, not two.

*New tests whose names described guards they did not exercise.* Six, four of them mutation-verified
green with the guard deleted: the arrow-key capture release (2.10's fix, never taken so never released),
the slider's step affordances (averaged over the bench at 8.5 against a floor of 2), the reduced-motion
check (insensitive to the flag), the affordance vocabulary (a tautology that never imported the schema),
the router-reuse test (never moved the phase), and an `expect(checked).toBeGreaterThanOrEqual(0)` whose
comment deferred its floor to the tautology. All six now fail under the mutations they are named for.

*Also corrected:* the dial's travel aliased its ends, so `control.max` was unreachable by drag on any
dial while the keyboard could step onto it — an ADR-012 violation the drag/step sweep had been shaped
around with a `slice(0, -2)` carve-out. The travel is now seamed at `stepCount / (stepCount + 1)` of the
circle and the carve-out is gone. The slider slammed to its minimum on a non-finite pointer where both
rotary affordances hold. The dial's index mark was painted entirely outside its own hit area. A sixth
cast refinement now refuses a board whose proposers the scene does not stage. `docs/content-authoring/`
promised refusal messages the loader discarded; the Zod issues are now logged with their paths.

**`npm run audit:ledger` confirmed rather than assumed**: still exits 1, both cases still blocked with
the same blocker counts (7 and 2). The two prototype reports are regenerated because they print the
case version, which moved.

**Deferred-work closed:** the `CharacterStage.create` rebuild note (verified against a genuinely varying
cast, then struck) and the `FIGURE_SLOT_WIDTH` divergence (the spec now derives its bound from the
production rule over both cases, taking the narrowest staged slot). **Opened:** the dial-cyclicity
authoring rule, the prototype's unmeasured bench prose, and the two harness notes.

### File List

**Source**

- `src/domain/cases/ScenarioScript.ts` — `ScenarioScene.cast`, `FIGURE_STAGING_SCENE_KEYS`, `stagesFigureColumn`
- `src/domain/cases/CaseDefinition.ts` — `CONTROL_AFFORDANCES`, `ControlAffordance`, `controlAffordance`, `PrimaryControl.affordance`
- `src/schemas/CaseDefinitionSchema.ts` — the `cast` and `affordance` shapes and the five cast refinements
- `src/adapters/phaser/renderers/characterStageView.ts` — `presentColleagueIds` takes the authored cast
- `src/adapters/phaser/renderers/ColleagueRenderer.ts` — `resolveStageCast` and `stageCast` thread it
- `src/adapters/phaser/renderers/instrumentView.ts` — the dial and slider conversions, and `resolveAffordanceValueForPointer`
- `src/adapters/phaser/renderers/apparatusGeometry.ts` — dial and slider geometry, `instrumentBand`, the affordance-aware sweep
- `src/adapters/phaser/renderers/ApparatusInstrument.ts` — three painters, `paintValue`, the affordance switch

**Content**

- `public/cases/morley-miller/case.json` — `rotationDeg` as `dial`, `bathTempC` as `slider`; version 1.2.0 → **1.3.0**
- `docs/source-rights/morley-miller-ledger.en.md`, `…fr.md` — regenerated (they print the case version)

**Documentation and fixture (new)**

- `docs/content-authoring/README.md`
- `docs/content-authoring/minimal-scenario.case.json`

**Tests (new)**

- `tests/unit/ScenarioAuthoringContract.test.ts`
- `tests/unit/ApparatusAffordances.test.ts`

**Tests (modified)**

- `tests/shippedCases.ts` — `loadAuthoringExample`, `readRepoFile`, `listRepoFiles`, `listRepoSourceFiles`
- `tests/unit/sceneSlice.ts` — records draw-command **names**, position and rotation
- `tests/unit/CaseDefinition.test.ts` — the twelve cast-refinement tests
- `tests/unit/CharacterStageView.test.ts` — the authored-cast branch and the AC4 absence test
- `tests/unit/CharacterStage.test.ts` — the cast-set rebuild verification
- `tests/unit/InstrumentView.test.ts` — dial and slider conversions, both cases' controls
- `tests/unit/ApparatusGeometry.test.ts` — `instrumentBand`, the affordance-aware sweep, the AC4 default
- `tests/integration/CharacterStaging.test.ts` — authored cast through the production resolver
- `tests/integration/SceneRouter.test.ts` — the fixture-driven and permuted router walks
- `tests/e2e/french-typography.spec.ts` — `FIGURE_SLOT_WIDTH` derived from the production rule
- `tests/e2e/canvasHelpers.ts` — `varyingInstrument` derives its drag target per affordance
- `tests/e2e/morley-miller-prototype.spec.ts` — docstring: the rotation control is now a dial

**Configuration**

- `tsconfig.test.json` — the stale 106/56 figure corrected to a measured 114/60, with the command

**Process**

- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-4-scenario-and-proposal-authoring-contract.md`

## Change Log

| Date | Version | Change | By |
|---|---|---|---|
| 2026-08-19 | 0.1 | Story context created from epics.md §3.4 (with the 2026-08-06 amendment), project-context.md rev 2.6, the sprint change proposal, and the source at HEAD `9ddb45a`. | Scrum Master |
| 2026-08-19 | 1.1 | **Code reviewed.** Three parallel layers over `6ee85f0..e59e678`; 45 raw findings, 35 after dedup. Six decisions, all taking the recommendation: the dial's travel seamed so its ends stop aliasing, `CACHE_NAME` bumped to v11, Zod issue paths logged at the load boundary, a sixth cast refinement requiring a board's proposers to be staged, AC7's minimality claim narrowed to what is measured, AC2's clause 1 amended to match shipped behaviour. 32 patches applied, 1 withdrawn as a false positive, 2 items deferred. The severest finding was a saved-progress regression: the `1.3.0` bump was never added to `CaseRecordSchema`'s allowlist, so every saved prototype investigation was refused. Four new tests were mutation-verified green with their guard deleted before repair. Gates re-measured: typecheck clean, 1503 tests / 79 files, build ok, e2e 62 × 3 runs, `typecheck:tests` held at 114/60. | Code Review |
| 2026-08-19 | 1.0 | Implemented. Two optional authored fields — `scenarioScript.scenes[].cast` (five load-time refinements) and `apparatus.primaryControls[].affordance` (three genuinely distinct instruments) — plus `docs/content-authoring/` with a parsed, minimality-measured example, a two-part test pinning AC5, and the prototype adopting `dial` and `slider` at case version 1.3.0. Two `deferred-work.md` items closed, four opened. 1497 tests / 79 files, e2e 61 × 3 idle runs, `typecheck:tests` held at 114/60. 17 mutation proofs; two of them initially stayed green and the resulting harness and test gaps were fixed. | Dev Agent (Link Freeman) |

## Open Questions for Alexis

Saved for the end, as the workflow requires. None blocks the start of implementation; #1 has a stated default so the dev agent can proceed either way.

1. **Should shipped content adopt the new affordances, or is the fixture demonstration enough?**
   The story as written says yes: the prototype authors `rotationDeg` as `dial` and `bathTempC` as `slider` (Task 3), so all three vocabulary members are live in real, playable, reviewable content and none of them is a field only a fixture reads. Young stays untouched, so its e2e walks and its French typography sweep do not move. The cost is re-pointing the prototype's drag walk at two new instruments.
   **Fallback if that proves to exceed the story:** keep both shipped cases on the default, prove all three affordances through the fixture and unit tests, and record the prototype's adoption in `deferred-work.md` with **owner Story 4.2**, which already owns the prototype bench work. Say which you want and the dev agent will take it; absent an answer it will build the recommendation and fall back only if Task 3 turns out to be its own story.

2. **`dial` versus `knob` — is the distinction I have fixed in §7 the one you want?**
   I have defined `dial` as full-circle travel with no dead zone, read against a fixed index mark, and `knob` as the existing 270° arc with a hard stop and 2.10's hysteresis. That makes the two genuinely different instruments rather than two skins, and it removes the dead-zone artefact for an angular quantity — which is the physically right call for `rotationDeg`. If your intent for `dial` was something else (a graduated *readout* rather than a graspable control, say), it is cheaper to say so now than at review.

3. **`cast: []` — refused, or "nobody on stage"?**
   §5.1 rule 3 refuses it, on the reasoning that absence already means "everyone" and no figure-staging scene renders "nobody" meaningfully. This is deliberately the *opposite* of the `dialogueBeats: []` decision, where empty and absent are identical because "no conversation yet" is something an author means. If you want an authored empty cast to mean a deliberately empty room, that is a coherent design and the refinement flips easily — but it needs a renderer answer for what an empty proposal board looks like.

4. **AC1's inventory — documentation, or also a test?**
   §10 puts the six-field-group inventory in `docs/content-authoring/README.md`. A prose inventory can go stale. The stronger version is a unit test asserting each named field group is present and refined in `CaseDefinitionSchema`, with the doc pointing at it. I did not put that in the tasks because it risks being a test that restates the schema rather than covering it — the "test that cannot fail" shape. Worth a decision.

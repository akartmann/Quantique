---
epic: 4
story: 2
key: 4-2-thermal-drift-investigation-tutorial
status: ready-for-dev
created: 2026-08-20
baseline: 771adca
baseline_commit: 771adca
inputs:
  - _bmad-output/planning-artifacts/epics.md §Epic 4 / Story 4.2, §FR19, §FR18, §FR23, §FR30, §NFR8
  - _bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md §Case slices (line 121)
  - _bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md §Controls, §Feedback, §Diegetic never means hidden
  - _bmad-output/project-context.md revision 2.6
  - _bmad-output/game-architecture.md v1.2 (ADR-001, ADR-004, ADR-006, ADR-009, ADR-011, ADR-012)
  - _bmad-output/implementation-artifacts/4-1-morley-miller-historical-case-record.md
  - _bmad-output/implementation-artifacts/deferred-work.md (lines 216, 224, 269, 277, 278)
  - docs/case-reviews/morley-miller-case-review.md §3, §6
  - docs/case-prototypes/morley-miller-prototype.md §8 gaps 1 and 3
---

# Story 4.2: Thermal-drift investigation tutorial

Status: ready-for-dev

## Story

As a player,
I want to rotate an interferometer, observe the temperature trend, and repeat a stable-window measurement,
so that I can distinguish a time-dependent confound from the predicted orientation signal.

## Acceptance Criteria

The two epic ACs are AC1–AC2 and AC4 below. AC3 and AC5–AC7 are the four `deferred-work.md` items that
name **Story 4.2** as owner and that the case review artifact lists as residual gaps — they are this
story's by prior assignment, not by scope creep. AC8–AC11 are the project's standing hygiene gates.

### AC1 — The bench a player stands at is this case's apparatus, not Young's

**Given** the Morley–Miller case in its `experiment` phase,
**When** I enter the laboratory,
**Then** the tableau shows a rotating interferometer — a turning bench carrying the split-and-recombined
light path, its arms, and the temperature bath — and **not** Young's light source, barrier and two slits,
**And** the bench's rotation is visibly at the authored `rotationDeg` and turns when I move the dial,
**And** Young's bench is unchanged for the Young case, pixel intent and text alike,
**And** which artwork is drawn is resolved from the case's authored `experiment.modelId` through a closed,
exhaustive lookup — never from a case id, never from a `modelVersion`, and never by sniffing whether a
Young control value happens to be finite (§SS3 has the exact defect this clause forbids).

_Closes `deferred-work.md:216` and `:278` (bench artwork), and gap #1 of
`docs/case-prototypes/morley-miller-prototype.md` §8._

### AC2 — Thermal drift and orientation evidence are separately inspectable

**Given** valid authored Morley–Miller controls,
**When** I rotate the bench, log observations, and test a stable window,
**Then** the deterministic model lets me hold one control and vary the other, so the temperature
contribution and the orientation contribution can each be isolated from recorded evidence alone,
**And** the bench tells me, in-fiction and in my language, what the stable window is — so "repeat a
stable-window measurement" is an instruction I can follow rather than a number I have to guess,
**And** the notebook rows for this case carry the rotation, the bath temperature and the displacement
together, so a temperature trend across observations is readable from the record,
**And** the case's authored `experiment.assumptions`, `experiment.confound.description` and
`experiment.resetPath.description` reach a surface the player can open in-scene, in both locales
(§SS6 — these three are authored, schema-validated, and today rendered **nowhere** in `src/`),
**And** reset, notebook, reference shelf, advance and revisit all work on this case exactly as they do on
Young, through the shared framework and with no second implementation.

### AC3 — The model constants are anchored, or the docstring stops claiming they will be

**Given** `src/domain/apparatus/calculateInterferometerDrift.ts`,
**When** its constants are read,
**Then** `ORIENTATION_AMPLITUDE`, `THERMAL_COEFFICIENT` and `STABLE_WINDOW_C` are each either derived from
a number the case's own 1907 transcription states, or documented with the design reason they are not —
in a docstring that no longer says *"Calibrating them against the published numbers … is Story 4.2's
work"*, because that sentence becomes false the moment this story lands either way,
**And** whatever is decided is stated in `docs/case-reviews/morley-miller-case-review.md` §6, where the
gap is currently recorded against this story,
**And** no run record's numeric result changes without `experiment.modelVersion` being bumped and the
record-compatibility consequence in §SS7 being handled.

_Closes the `deferred-work.md:278` clause on the invented constants. §SS4 has the two published numbers
and a recommended derivation._

### AC4 — Synthesis feedback directs, and never concludes

**Given** I reach `synthesis` on this case,
**When** I compare observations and ask a colleague,
**Then** the feedback names replication or a missing variable when one applies — the bath left where it
was found, the bench never turned, the same arrangement recorded twice, nothing recorded at all —
**And** it never states which conclusion the evidence supports, never ranks the proposals, and never
marks one correct,
**And** every authored branch it can take is reachable from a state a player can actually be in, proved
by a test that constructs that state (§SS5 enumerates the branches and the one gap in them).

### AC5 — `formatMeasurement`'s separator is decided by the unit, not by the locale alone

**Given** a measured value rendered beside its unit,
**When** the unit is an **arc degree** (`°`),
**Then** no separator is written in either locale — the bench reads `0°`, not `0 °`,
**And when** the unit is spelled-out prose rather than a symbol (`fringe widths`, `largeurs de frange`),
**Then** French uses a separator wide enough to read as a space — today's U+202F renders
`0,11largeurs de frange`,
**And** every unit Young ships (`mm`, `m`, `nm`, `°C`) formats **byte-identically** to today in both
locales, proved by the existing `I18n.test.ts` expectations passing unchanged,
**And** the two `ApparatusCaseVoice.test.ts` expectations that pin the current wrong output — and the
comments above them that say why they pin it — are updated rather than deleted.

_Closes `deferred-work.md:224` and `:277`._

### AC6 — `flow.minimumExperimentCycles` / `maximumExperimentCycles` stop being shipped-and-dead

**Given** both fields are authored on both shipped cases, validated by two refinements that read only each
other, and read by **nothing** that affects play,
**When** this story completes,
**Then** the fields are either read by something the player experiences, or re-documented as advisory
design metadata at the authoring site (`docs/content-authoring/`), in the schema, and in the case review
artifact — with the sentence *"nothing caps the player's runs"* stated where an author will meet it,
**And** whichever is chosen, `caseFileGeometry.ts:40` and `selectors.ts:410` — the two source comments
that currently record the gap — agree with the decision rather than contradicting it,
**And** if the cap is made real, no reachable player state becomes unfinishable (§SS8 shows that the
obvious cap **does** strand a player, which is why the recommendation is the other branch).

_Closes `deferred-work.md:269`. Open Question 4 of Story 4.1 put this to Alexis; §SS8 carries a
recommendation the dev agent may proceed on absent an answer._

### AC7 — Every surface this story adds or changes is bilingual from the start

**Given** every string this story introduces — part labels on the new tableau, an assumptions/confound
surface, any new refusal or guidance line,
**When** the case is loaded and rendered,
**Then** each carries both `en` and `fr`, localized lists carry equal lengths across locales, and no
player-readable string exists in one language only,
**And** the surface list is built by **grepping for the read**, not from this story's file list — the
defect Story 3.2 committed by localizing three of four settings surfaces (§SS9),
**And** the new prose is measured by `tests/e2e/french-typography.spec.ts`, which since Story 4.1 sweeps
every case in `SHIPPED_CASE_IDS`.

### AC8 — The new tableau costs no asset and no rights row

**Given** the case is ledger-**BLOCKED** and every laboratory backdrop in this project is `Graphics` fill
commands,
**When** the interferometer artwork ships,
**Then** it loads no texture, adds no entry to `case.json`'s `assets.entries`, and adds no row to the
rights ledger,
**And** it generates its geometry in a create pass rather than regenerating `Graphics` per frame
(`ReadingRoomDecor` and `LaboratoryDecor` are the two precedents and the rule that licenses them),
**And** it honours `prefers-reduced-motion` and registers **no** update loop except while a
player-initiated run is in flight (ADR-012).

### AC9 — Layout is measured, in both locales, at the real surface size

**Given** the unit harness reports a constant `height: 18` for every text object and approximates width
as `length × 7`,
**When** a layout claim is made about the new tableau or any new panel,
**Then** it is derived from an exported geometry constant that a test and the renderer both read, and the
non-overlap invariant is extended to cover every new band — `benchObjectBands` is the function that
exists for exactly this and it must not be left measuring a bench that is no longer drawn,
**And** the claim is confirmed **by eye at 1280×720 in EN and FR**, with the screenshots recorded in the
Dev Agent Record.

### AC10 — Contract, version and cache hygiene

**Given** any change to `public/cases/morley-miller/case.json`,
**When** the change is committed,
**Then** its `version` is bumped from `1.4.0`,
**And** `CaseRecordSchema`'s prototype clause gains a clause for the new version listing every prior
version it accepts (`1.0.0`–`1.4.0`), in the same commit,
**And** `public/sw.js` `CACHE_NAME` is bumped from `quantique-bootstrap-v13` in the same commit with its
reason appended to the header list — **whether or not** a field becomes required, because a returning
player's cached copy is the one that boots and offline reload is a release gate,
**And** `npm run audit:ledger` is re-run if any ledger-bearing field moves,
**And** if `experiment.modelVersion` is bumped (AC3), the record consequence in §SS7 is handled and
stated.

### AC11 — Verification

**Given** the story is complete,
**When** the gates are run,
**Then** `npm run typecheck` is clean, `npm test` passes, `npm run build` and `npm run build:subpath`
succeed, and `npm run test:e2e` passes on an idle machine,
**And** `npm run typecheck:tests` is at or below **106 errors across 60 files** (measured at baseline
`771adca`, 2026-08-20) — the count is the metric and it may only go down,
**And** every guard this story adds whose failure would be **silent** is mutation-proved: broken, its
named test observed red, restored, and the proof recorded (§SS10 names the minimum set),
**And** `deferred-work.md` items this story closes are struck, and items it opens are recorded with a
**named owner story** — not "Epic 4", not "unassigned".

---

## Tasks / Subtasks

- [ ] **Task 1 — Read the governing rules and the code you are about to change** (blocks everything)
  - [ ] Read `_bmad-output/project-context.md` in full. Revision 2.6, governing. §Project Context Rules below is a pointer, not a substitute.
  - [ ] Read `src/adapters/phaser/renderers/ApparatusRenderer.ts` **completely** (1452 lines). You are going to change its tableau; you must know what else it owns — the instruments, the wavelength chooser, the start/notebook/reset row, the side column, the reference shelf, the hint panel, the readouts, the key handling, the reduced-motion contract and the run animation. §SS2 is a map, not a substitute.
  - [ ] Read `src/adapters/phaser/renderers/apparatusGeometry.ts` completely (686 lines) — the bench is an absolute layout on a fixed 1024×768 design surface and every number in it is spent out of a measured budget.
  - [ ] Read `src/domain/apparatus/calculateInterferometerDrift.ts`, `experimentModels.ts`, `src/core/i18n/formatNumber.ts`, `src/core/store/selectors.ts:60-90` and `:155-175`.
  - [ ] Read `docs/case-reviews/morley-miller-case-review.md` §3 and §6, and `docs/case-prototypes/morley-miller-prototype.md` §8.
  - [ ] Read the five `deferred-work.md` entries naming this story: lines 216, 224, 269, 277, 278.
  - [ ] Confirm the baseline numbers before you change anything: `npm test` (1527 passing), `npm run typecheck:tests` (106 errors / 60 files), `case.json` at `1.4.0`, `sw.js` at `v13`.

- [ ] **Task 2 — Decide the two open decisions, and record them** (AC3, AC6)
  - [ ] Read §SS4 and §SS8. Each carries a recommendation you may proceed on if Alexis has not answered.
  - [ ] Write the decision, its reasoning and its consequence into the story's Dev Agent Record **before** implementing it, so the review can check the reasoning rather than reverse-engineer it.

- [ ] **Task 3 — Introduce the bench-artwork seam** (AC1)
  - [ ] Add a pure geometry module for the interferometer tableau beside `apparatusGeometry.ts`, following the geometry/painting split every other surface here draws (`libraryGeometry.ts`, `characterStageView.ts`, `debriefGeometry.ts`). No Phaser import as a value.
  - [ ] Select the artwork from `experiment.modelId` through an **exhaustive** `Record<ExperimentModelId, …>` so that adding a third model without artwork is a `tsc` error, not a blank screen. Mirror `experimentModels.ts`'s shape and its docstring's reasoning. **Two entries; no registry, no factory, no plugin layer.**
  - [ ] Delete the `hasOpticalGeometry` duck-type guard (`ApparatusRenderer.ts:957`) and everything that branches on it. It is the "case-shape guard diverging from the lit/dark decision" defect the 3.2 review found, kept alive one more story. Its two consumers — the slit/screen placement and the choice between `paintFringes` and `paintDisplacedFringes` — both become artwork-owned.
  - [ ] Young's path must be **behaviourally identical** afterwards. Prove it with the existing Young specs and unit tests passing untouched, and by eye.

- [ ] **Task 4 — Draw the rotating interferometer** (AC1, AC8, AC9)
  - [ ] Graphics fill commands only, generated once in the create pass. No texture, no asset entry, no ledger row.
  - [ ] The parts the case's fiction names: a turning bench/stone carrying a beam splitter, two perpendicular arms with their end mirrors, the recombined path to the observing screen, and the temperature bath. `paintDisplacedFringes` already paints the screen correctly and is **not** part of this gap — do not rewrite it.
  - [ ] Bind the visible rotation to `activeControlValues.rotationDeg` and the bath's visual state to `bathTempC`. Both come from the store; neither is inferred.
  - [ ] The run animation is the same three acts (`RUN_IGNITION_MS` / `RUN_PROPAGATION_MS` / `RUN_RESOLVE_MS`, 2.4 s total) driven by elapsed time. The light is **dark until the player starts it** and no loop registers from `create()`.
  - [ ] Reduced motion paints the resolved frame directly and registers no loop, exactly as Young's path does. `ApparatusRun.test.ts` is the pattern.
  - [ ] Extend `benchObjectBands` (or its interferometer counterpart) so the all-pairs non-overlap sweep measures what is **actually drawn**. A sweep that keeps measuring Young's slits on this case is the 2.9 fabricated-band defect committed inside the function written to prevent it — and `instrumentBand` already carries that lesson in its docstring.
  - [ ] Part labels are interface strings in `en.ts`/`fr.ts` (chrome, not case content). `lab.source` (`'source'`) and `lab.screen` (`'screen'`) exist and are Young's tableau labels — decide per model rather than reusing them by default.

- [ ] **Task 5 — Make the two contributions separable and inspectable** (AC2)
  - [ ] Verify from a test, not by reading the formula, that holding `rotationDeg` and varying `bathTempC` isolates the thermal term, and that holding `bathTempC` at the stable window and varying `rotationDeg` isolates the orientation term. Assert the recorded results, not the arithmetic.
  - [ ] The stable window must be **legible in-fiction**. `STABLE_WINDOW_C` is 20 and `bathTempC` defaults to 22 with a 18–24 range; a player told to "bring the bath back to its steady window" has no way to know which value that is. Prefer authored case content over a new interface string, and prefer an existing surface over a new one.
  - [ ] Surface `experiment.assumptions`, `experiment.confound.description` and `experiment.resetPath.description` in-scene (§SS6). The cheapest honest home is the bench's existing reference shelf opening the existing `ReferenceBookPresenter` shape — reuse before you build.
  - [ ] Walk reset, notebook, reference shelf, advance and revisit on **this** case and record what you saw. AC2's last clause is a verification clause; "the framework is shared so it must work" is precisely the assumption Story 3.2's three walls each falsified.

- [ ] **Task 6 — Close and prove the synthesis feedback** (AC4)
  - [ ] Read §SS5. Confirm by test which of the four `consultationRules` fires in which state, and which of the four `colleagueHints` fires in which state — for a player who actually reaches that state, not for a hand-built projection.
  - [ ] Close the **replication** gap: the case's confound is `discoverableBy: 'replication'` and its `resetPath.recoveryRoute` is `'replication'`, and no consultation rule and no hint tells the player to repeat a stable-window reading. `hint-repeated` says the opposite. Prefer authored content over a new predicate kind; if a new kind is needed, it lands in `ConsultationRule.ts` + `CaseDefinitionSchema` + a unit test, bilingual, and Young must remain unaffected.
  - [ ] Confirm none of the authored `layers`/`nextStep` blocks names a proposal, ranks the proposals, or asserts a conclusion. Assert it, do not eyeball it.
  - [ ] Prove reachability for every branch, including `consult-no-runs`' `< 2` threshold against `requirements.minimumRuns: 2`.

- [ ] **Task 7 — Anchor or honestly document the model constants** (AC3)
  - [ ] Apply the §SS4 decision. Rewrite the docstring so it states what is true after this story, and delete the forward reference to this story from it.
  - [ ] If any recorded value changes, bump `experiment.modelVersion` and handle §SS7. If nothing changes numerically, say so explicitly in the Dev Agent Record — a "no change" that is not stated reads as an omission.
  - [ ] Update `docs/case-reviews/morley-miller-case-review.md` §6.

- [ ] **Task 8 — Fix the unit separator** (AC5)
  - [ ] Change `formatMeasurement` so the separator is a function of `(locale, unit)`. Keep it pure, keep it in `src/core/i18n/formatNumber.ts`, and keep `Intl` the only platform dependency.
  - [ ] Young's four units must be byte-identical. `I18n.test.ts:425-447` is the regression fence — it must pass **unchanged**.
  - [ ] Update `ApparatusCaseVoice.test.ts:74-88` and `:104-113` and their explanatory comments. Two of those comments are duplicated verbatim in the same test; collapse them while you are there.
  - [ ] Check every caller before you claim it is fixed: `selectors.ts:79` (the composed idle sentence), `selectors.ts:167` (`selectCanonicalControlValue` — see §SS11), `NotebookRenderer.ts:455`, `CaseFilePresenter.ts:510`, `CaseRecordPrintView.ts:95`, `ApparatusRenderer.ts:866` and `:904`, and `tests/e2e/canvasHelpers.ts:7`. The e2e helper imports the real function, so a change here moves what the walks assert.
  - [ ] Mutation-prove it: revert the degree branch and watch the named test go red.

- [ ] **Task 9 — Resolve the cycle fields** (AC6)
  - [ ] Apply the §SS8 decision.
  - [ ] Whichever branch: reconcile `caseFileGeometry.ts:40` and `selectors.ts:410`, the schema docstrings at `CaseDefinitionSchema.ts:906-907` / `:985` / `:1042` / `:1093`, and `docs/case-reviews/morley-miller-case-review.md` §3, so no comment contradicts the decision.
  - [ ] Do **not** touch the `morley-drift-bench` fixture's `2/6` in `tests/unit/CaseDefinition.test.ts:342` / `:1419`. It exists to prove the shared shape is not one case's literal, and breaking it undoes Story 3.1.

- [ ] **Task 10 — Localize, then prove the localization** (AC7)
  - [ ] Build the surface list by grepping for the *read* of each string you add.
  - [ ] Extend the French typography sweep to cover the new prose. It already sweeps `SHIPPED_CASE_IDS`; add samples, do not add a second Young-only parse.
  - [ ] Mutation-prove the extension: author a deliberately over-long French string and watch the sweep fail.

- [ ] **Task 11 — Tests, mutation proofs, and the visual pass** (AC9, AC11)
  - [ ] Unit: the artwork lookup's exhaustiveness, the geometry constants, the separator rule at every unit class, the two-contribution separability, the reduced-motion frame, the non-overlap sweep on the new bands.
  - [ ] E2E: extend `morley-miller-prototype.spec.ts` rather than adding a parallel walk. Take control values from the **model's behaviour**, never from the authored range's ends — `rotationDeg` spans 0–180 against `cos(2θ)`, so 0° and 180° are one reading, and the walk already carries that correction at `ROTATION = varyingInstrument('morley-miller', 'rotationDeg', 90)`.
  - [ ] Wait on the thing the gesture was supposed to achieve (`startTheLightUntilRecorded`, `dragDesignUntil`, `clickUntilScene`), never on a fixed sleep.
  - [ ] Screenshot the running app at 1280×720 in EN and FR, on **both** cases, and record the paths. The memory of this project is explicit: depth-order, split-scale and fixed-layer occlusion defects pass every test.
  - [ ] Record the mutation proofs individually — what was broken, which named test went red, that it was restored.

- [ ] **Task 12 — Close the books** (AC10, AC11)
  - [ ] `case.json` version bump + `CaseRecordSchema` clause + `sw.js` `CACHE_NAME` bump **in the same commit**, with the reason appended to the worker's header list.
  - [ ] `npm run audit:ledger` if any ledger-bearing field moved.
  - [ ] Strike the five closed `deferred-work.md` entries; record what you open with a named owner story.
  - [ ] Update `sprint-status.yaml` in the same commit as the work, not afterwards.
  - [ ] Run the full gate set and record the numbers.

---

## Dev Notes

### §SS0. `_bmad-output/project-context.md` exists and is governing — read it first

Revision 2.6, 2026-08-19. Where an older artifact contradicts it, it wins, together with
`game-architecture.md` v1.2. Everything in §Project Context Rules below is a **pointer** to the parts you
will cross; it is not a substitute, and the first review finding of Story 3.3 was that the file had not
been read before dev.

Two of its rules are about to be tested by this story specifically:

- *"A renderer's case-shape guard and its 'is this running?' decision must be the same decision."* You are
  removing the last such guard.
- *"Assume nothing is Young-shaped — in a control id, a guard, a readiness rule, or a walk."* This is the
  first story whose job is literally to un-Young a surface.

### §SS1. Scope boundary — read this before writing anything

**In scope.** The bench tableau for this case; the artwork seam that selects it; the model constants; the
`formatMeasurement` separator; the cycle-field decision; the assumptions/confound/reset-path surface; the
synthesis feedback verification; the localization and typography sweep for whatever you add.

**Out of scope, owned elsewhere — do not touch:**

| Item | Owner |
|---|---|
| The bounded conclusion, the overclaim refusal, the debrief's revision feedback | Story 4.3 |
| `reduceRecordRun` re-deriving a result for a run without `modelInputs` | Story 4.3 |
| `experiment.wavelengthNm` authored-and-unread | Story 4.3 |
| The persisted `450 \| 550 \| 650` unions and the two minimum-mode `550` literals | Story 4.3 |
| `CaseRecordPrintView` unit coverage (needs a DOM environment — a new dependency, a HALT condition) | Story 4.3 |
| `citation.reuseStatement` authored everywhere and rendered nowhere | Story 4.3 |
| `walkToDebrief` reaching Young's debrief only | Story 4.3 |
| The debrief comparison band's exhausted height margin | Story 4.3 |
| `isCampaignCase` / `isCampaignCaseUnlocked` called by nothing; the completed-case-unreachable problem; the campaign e2e walk | Story 4.3 |
| `debrief.sourceRefs` validated-but-unread; the unexercised `reconstruction` rendition kind | Epic 5's first story |
| The scholarly reviewer and the educator context sheet (the ledger is BLOCKED and stays BLOCKED) | Alexis |
| NFR1's unrun 60 FPS profile | Alexis |

**HALT conditions.** Adding an npm dependency; adding a fourth module to `src/ui/`; adding a scene or a
phase; introducing a case-rule registry or plugin layer; changing `CaseRecordSchema`'s `schemaVersion` or
writing a record migration. Stories 3.2, 3.3 and 3.4 each met a gap a new dependency would have closed
and each worked with the constraint instead.

### §SS2. What already ships — do not rebuild it

The prototype is **not** a stub. Story 3.2 built the case, 3.4 gave it real instruments, 4.1 fixed its
record and flipped the campaign boot default to it. What exists and works:

- **The instruments.** `ApparatusInstrument.ts` + `instrumentView.ts` draw a `dial` for `rotationDeg` and
  a `slider` for `bathTempC` from the authored `affordance`, with drag snapping to the authored step in a
  Phaser-free module, discrete `+`/`−` step affordances, arrow-key stepping, and a focus treatment.
  **Both paths produce an identical run record.** None of this is the gap.
- **The physics.** `experiment.modelId: 'morley-miller-interferometer'` resolves through
  `experimentModels.ts`'s closed list to `calculateInterferometerDrift`, whose `requiredControlIds` are
  checked against the case's own `apparatus.primaryControls` at load.
- **The screen.** `paintDisplacedFringes` paints a fringe field displaced by the recorded drift,
  unexaggerated, with no diffraction envelope. Delivered and mutation-proven by the 3.2 review. **This is
  explicitly not part of the artwork gap** — the prototype doc's gap #1 was narrowed in writing to say so.
- **The readouts.** The result label and unit are localized by key off the model
  (`experiment.result.fringeDisplacement`, `experiment.unit.fringeWidths`), and the composed idle sentence
  is built from `apparatus.primaryControls` with each control's authored per-locale `inlineLabel`.
- **The bench chrome.** Start / notebook / reset row, side column with advance + revisit + reference shelf
  + colleague hint, the notebook overlay, the reference book overlay, the bench message slot. All shared.
- **The wavelength chooser draws nothing here.** `selectWavelengthChoices` returns an empty list when the
  case authors no `experiment.wavelengthComparison`, and this case authors none. But its **band is still
  reserved** in `benchObjectBands` at a hard-coded `WAVELENGTH_CHOICE_COUNT_BOUND = 3` — 250 × ~150 px of
  the bench held empty on a case that will never fill it. That is free space you may spend, and the
  reserve's own docstring explains why it is not read from the case; if you spend it, say why the
  docstring's reasoning still holds for Young.

What is **left**, and is this story's: the apparatus *around* the screen.

### §SS3. The exact defect AC1's last clause forbids

`ApparatusRenderer.renderApparatusGeometry` currently decides which case it is drawing like this:

```ts
const slitSpacing = state.activeControlValues.slitSpacingMm;
const screenDistance = state.activeControlValues.screenDistanceM;
const hasOpticalGeometry = Number.isFinite(slitSpacing) && Number.isFinite(screenDistance);
```

Two Young control ids written into a renderer, read off a case that does not author them, and turned into
a boolean that stands in for "is this Young?". The project has now paid for this shape three times:

1. `lab.idle` composed from Young's two control names — the bench read *"dark at 0 slit spacing and 22
   screen distance"* while 1293 tests stayed green.
2. `renderApparatusGeometry` returning at this very guard **before** its own `paintFringes()` call, while
   `paintLight`'s `dark` flag had already decided the bench was lit — a full 2.4 s ignition resolving onto
   an empty screen.
3. `conclusionReadiness`' two Young-shaped rules, permanently unsatisfiable for a case recording no
   `modelInputs`.

Every one was a *graceful degradation*: nothing threw, nothing failed, the surface simply lied. The
project-context rule is stated in three places and this is the last live instance of it in the bench.

**So the seam is: the case's `experiment.modelId` selects the artwork, through an exhaustive record keyed
on `ExperimentModelId`.** The same key the physics uses, for the same reason — and *not* the case id
(that would put a per-case branch in a renderer, the layer Story 3.1 kept one out of) and *not*
`modelVersion` (the per-run provenance stamp; bumping it must never change what is drawn any more than it
changes which physics runs). Exhaustiveness matters: a third model arriving without artwork should be a
compile error, because the alternative is a blank tableau that no test can see.

Note the shape this is **not**: `experimentModels.ts`'s docstring says in as many words that at two models
the list *is* the mechanism and that a plugin layer here would be the all-purpose framework Epic AC1
forbids. Same ruling applies to the artwork.

### §SS4. The model constants, and the two numbers the case already carries

Today (`calculateInterferometerDrift.ts`):

```
displacement = ORIENTATION_AMPLITUDE * cos(2θ) + THERMAL_COEFFICIENT * (bathTempC − STABLE_WINDOW_C)
ORIENTATION_AMPLITUDE = 0.01   THERMAL_COEFFICIENT = 0.05   STABLE_WINDOW_C = 20
```

and the docstring says, correctly and unhappily: *"nothing here is sourced from the 1887 paper or the 1907
final report. Calibrating them against the published numbers … is **Story 4.2's** work."*

**The case's own 1907 transcription supplies both published numbers**, verbatim, in
`contextualArtifacts[1].textualRendition.renditions[0].sections[0].paragraphs[0]`:

> "The expected drift would produce a displacement of the interference fringes of **1.53 wave-lengths**;
> the above result is probably certain to **one eightieth part** of the whole."

So the historical record states two things a model can be anchored to:

- **What a stationary ether demanded:** 1.53 fringe widths. This is the counterfactual the prediction
  proposals argue about; it is not what the apparatus reads.
- **What the observations could exclude:** about 1/80 of that — ≈ **0.019 fringe widths**. The measured
  result is a *bound*, not a zero, and Story 4.1 made that distinction legible in the record.

**Recommendation.** Anchor rather than invent, and say what each anchor means:

- Export the ether-demanded displacement as a named constant (1.53) even though the model does not add it
  — it is the number the case's fiction and its debrief both quote, and having it in one place stops a
  third copy appearing. If nothing reads it, do not add it; a constant nothing reads is the very defect
  AC6 exists to close.
- Derive `ORIENTATION_AMPLITUDE` from the published bound rather than choosing it: today's `0.01` already
  sits inside 1/80 of 1.53, which is why the case is honest — but that is a coincidence the docstring
  cannot claim. Express it as a stated fraction of the bound, with the arithmetic in the docstring, so
  the number and its justification fail together.
- Keep `THERMAL_COEFFICIENT` and `STABLE_WINDOW_C` **teaching-chosen** and say so plainly. The 1907
  report says only that *"the temperature effects could never be entirely eliminated"* — it publishes no
  coefficient — so a derivation would be a fabrication dressed as a citation, which is worse than an
  honest design constant. What the docstring owes is the design requirement they satisfy: the thermal
  term must swamp the orientation term at the authored default (22 °C → 0.10 against ±0.01) and vanish at
  the window, because that gap **is** the teaching loop of FR19.

**The trap to avoid.** Do not "calibrate" by making the numbers bigger so the fringe field visibly moves.
`paintDisplacedFringes`' docstring already forbids the amplified version in writing: *"Amplifying it for
legibility would be a physics lie painted onto the one observation the case is about."*

**If any recorded number changes, §SS7 applies.** If none changes, that is a legitimate outcome — the
work is the anchoring and the docstring, and the Dev Agent Record must say the values were unchanged and
why, so the pass over them is traceable rather than looking like an omission. That is the same standard
Story 4.1 held itself to for these three constants.

### §SS5. AC4 — what the synthesis feedback actually is, and the one gap in it

Two distinct authored mechanisms answer "feedback at synthesis", and they are not interchangeable:

**1. Colleague hints** (`colleagueHints[]`, `src/domain/review/colleagueHints.ts`) — delivered in the
laboratory's side column when the significant-measure gate is unmet. The case authors four:
`no-recorded-runs`, `repeated-configuration`, `unvaried-control` on `rotationDeg`, and
`below-significant-measures`. All bilingual.

**2. Consultations** (`consultationRules[]`, `src/domain/review/ConsultationRule.ts`) — reached from the
case file, which `TheoryBoardScene` hosts in **both** `synthesis` and `review`. The consultation occupies
the band the peer-review pane holds during `review`, so in `synthesis` it is the live surface. The case
authors four, in priority order (`rules.find`, first match wins):

| Rule | Predicate | Fires when |
|---|---|---|
| `consult-no-runs` | `missing-run` | fewer than 2 runs |
| `consult-unread-report` | `missing-source: morley-miller-1907-final-report` | the 1907 report has not been inspected |
| `consult-vary-bath` | `alternative-test: bathTempC` | ≥2 runs, all at one bath temperature |
| `consult-no-limitation` | `missing-limitation` | the draft states no limitation |

Read against AC4's two clauses:

- *"directs me to replication or a missing variable"* — **the missing variable is covered**
  (`consult-vary-bath`, whose `technicalDetail` reads *"Hold the orientation and move the bath alone;
  whatever moves is not the orientation"*). **Replication is not.** `experiment.confound.discoverableBy`
  and `experiment.resetPath.recoveryRoute` are both `'replication'`, the reset path tells the player to
  *"Bring the bath back to its steady window and take the reading again"*, and **no consultation rule and
  no colleague hint says that.** The nearest is `hint-repeated`, which says the opposite — it warns the
  player *off* a repeated arrangement. Closing this is authored content plus, if no existing predicate
  kind fits, one new predicate kind in `ConsultationRule.ts` + its schema + its unit test. Prefer reusing
  a predicate kind; `alternative-test` on `rotationDeg` is a near fit for "you never held the bench still
  and moved only the bath", but check the semantics rather than assuming.
- *"does not assert a conclusion for me"* — structurally guaranteed and worth confirming rather than
  asserting: the evaluator is the sole completion authority (ADR-006), defensibility is never exposed as
  a display projection, and the neutral auto-summary states what the player did and never evaluates it.
  Read the four authored `layers` and `nextStep` blocks and confirm none of them names a proposal.

**The reachability obligation.** AC4's last clause exists because `conclusionReadiness` shipped two rules
that were *permanently unsatisfiable* for this exact case. Ask of each of the four consultation rules and
each of the four hints: can a player reach the state that fires it? `consult-no-runs` fires at fewer than
**2** runs despite being named "no runs" — check that against `requirements.minimumRuns: 2` and make sure
the branch you think fires is the one that does.

### §SS6. Three authored fields that reach no player surface

Grep for the read, not for the write:

```
experiment.assumptions        → CaseDefinition.ts:410 (type), CaseDefinitionSchema (validation). No renderer.
experiment.confound.description → CaseDefinition.ts:411 (type), schema. No renderer.
experiment.resetPath.description → CaseDefinition.ts:412 (type), schema. No renderer.
```

Both cases author all three, bilingually, and `CaseDefinition.test.ts` proves the schema rejects them
missing and rejects a locale mismatch — so they are *validated* thoroughly and *rendered* nowhere.

This matters more than a tidiness point. **FR18** requires every case to have *"one discoverable confound
or misleading result, a reset-solvable required puzzle, and inspectable model assumptions"*, and
`docs/case-reviews/morley-miller-case-review.md` §1 lists all three as satisfied, naming the authored
field for each. That table is true about the *authoring* and misleading about the *player*: today a player
can complete this case without ever being shown the confound, the reset path, or the model's assumptions.
It is the "author a case field that nothing reads" shape, three times, on the three fields FR18 is about.

**This is a new find** — it is in no previous story, in no review, and in `deferred-work.md` nowhere. It
predates this story and applies to Young equally.

**Why it lands here rather than being deferred again.** AC2's *"the deterministic model makes thermal
drift and orientation evidence separately inspectable"* is unsatisfiable in spirit while the case's own
statement of its confound and its recovery route is invisible, and this is the story that owns the bench.

**Reuse before you build.** The laboratory already owns a reference shelf in its side column that opens
`ReferenceBookPresenter` over the bench, suppressing bench input while it is up. An "apparatus notes"
entry on that shelf, rendering the three fields, is one control and one content projection — no new
overlay, no new suppression rule, no new scene. The alternative homes each cost more: the case file's
bands are measured to their content, and the bench has no spare vertical strip.

Whatever you choose, `fitBodyText` **shrinks to a floor and then silently overflows with no crop** — so
AC9's by-eye confirmation at 1280×720 in both locales is the check that matters, not the unit harness,
which reports a constant `height: 18` for every text object.

### §SS7. If `experiment.modelVersion` moves

`RunRecord.experimentModelVersion` is a per-run provenance stamp and **saved runs are never recalculated
against a newer model**. Three consequences, all of them already implemented and none of them optional:

- `ApparatusRenderer.matchedModel` returns `undefined` when a run's `experimentModelVersion` does not
  match the case's, and the readout then shows the run's **own canonical English label and unit** rather
  than this build's localized ones. A French player with a pre-bump run in the notebook reads
  `Fringe displacement … fringe widths`. That is the honest rendering of a reading whose provenance is
  something else — but it is a visible consequence you must see and describe, not discover in review.
- `conclusionReadiness`' `foreign-model-run` rule asks `experimentModelVersion`. A bump makes every saved
  run foreign, which can move a case from "conclusion available" back to "not ready" for a returning
  player. Check what that does to a restored record before you bump.
- `reduceRecordRun` compares `experimentModelVersion` outside the `modelInputs` guard (Story 3.2's
  hoist), so a bump is enforced at record time for this case too.

Therefore: **bump only if a number the player sees actually changes.** If AC3's anchoring is
documentation and derivation with identical outputs, do not bump, and say so.

### §SS8. The cycle fields — the decision, with a recommendation

`flow.minimumExperimentCycles` and `flow.maximumExperimentCycles` are authored on both cases (`2`/`4` each
since Story 4.1) and read by exactly two things, both of which are the schema validating them against
each other:

- `CaseDefinitionSchema.ts:985` — min ≤ max, a general refinement.
- `CaseDefinitionSchema.ts:1042` / `:1093` — the Young and Morley–Miller branches pinning `2`/`4`.

Nothing else. Two source comments already say so: `caseFileGeometry.ts:40` (*"the observation list is
paged because nothing caps `runs`"*) and `selectors.ts:410`, which records that an earlier version of its
own comment wrongly justified a cost with the cap.

**Branch A — make the cap real.** Refuse a run past `maximumExperimentCycles`.

**This branch is a trap, and the trap is decisive.** `requirements.minimumSignificantRuns` is 2 and a
*significant* run is a distinct configuration over `significanceRule.criticalControlIds`
(`rotationDeg`, `bathTempC`). A player who records four observations at one arrangement — which the case's
own confound invites, since the confound is *discoverable by replication* — would hit a hard cap with
**zero** distinct configurations and no way to record a third. Nothing clears `runs`: `reduceApparatusReset`
resets the controls to their defaults and touches nothing else, deliberately, because Story 2.2's shipped
acceptance criterion is *"reset is immediate and does not erase saved observations"*. That is a gate made
unsatisfiable **by code**, which project-context names as its own rule with this exact case as the worked
example. It also collides with NFR8 (no hard fail, no irreversible wrong choice) and FR23 (unlimited
reset and comparison).

**Branch B — re-document as advisory design metadata. Recommended.** The fields describe the *authored
session shape* FR25 and NFR14 talk about (a 20–45 minute case, two to four cycles of work), not a runtime
quota. State that at the authoring site in `docs/content-authoring/`, in the schema field's own
documentation, and in the case review artifact — in the words *"nothing caps the player's runs, and
nothing should"*, with the strand-the-player reasoning above so the next author does not re-litigate it.
The load-time refinement stays: it stops a future author shipping a range FR25 forbids, which is real
value and is the field being read for a real purpose.

Branch B does **not** leave the fields dead in the sense the Don't-Miss table means. A field read by a
load-time refinement that refuses invalid content is read; a field read by nothing at all is not. Say
that distinction out loud in the docs so the deferred-work entry can be struck honestly rather than
re-opened by the next reader of the same table.

Absent an answer from Alexis, **take Branch B.** It is reversible in a way Branch A is not.

### §SS9. Bilingual — build the list by grepping the read

The project's most-repeated defect, and it has a named worked example in this exact area: Story 3.2
localized three of the four surfaces that render a run's apparatus settings — `ApparatusRenderer`,
`NotebookRenderer`, `CaseRecordPrintView` — and missed `CaseFilePresenter`, **for the single reason that
it was the only one of the four absent from the story's file list.**

So for each string you add, grep for who reads it. The surfaces that can render this story's content:

`ApparatusRenderer` · `NotebookRenderer` · `CaseFilePresenter` · `CaseRecordPrintView` ·
`ReferenceBookPresenter` · `LibraryRenderer` · `DebriefRenderer` · `ColleagueRenderer` · `RivalLabRenderer`

Three rules that will bite:

- **Never author player-facing copy in `create()`** — it runs once and the locale can change. Create text
  empty; populate in `render(state)` through `createTranslator(locale)`.
- **Never join a French preposition or article to an authored label.** Elision is control-dependent; the
  preposition lives in the data (`inlineLabel`). English tolerating the composition is not evidence that
  French will.
- **Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback** — it turns a forgotten
  call site from a `tsc` error into a French player silently reading English.

### §SS10. Testing requirements, and the minimum mutation set

- Unit-test all pure logic with Vitest and fixtures. `src/domain/` is Zod-free; `src/schemas/` owns
  validation. **Never require Phaser or a browser to test scientific or content logic.**
- To test Phaser-adjacent logic, inject the structural slice (`tests/unit/sceneSlice.ts`). It **can** see
  Graphics draw commands since the last `clear()`, every tween config, and every `killTweensOf` target —
  so "paints nothing", "starts no tween" and "releases its tweens" can genuinely fail. It **cannot** see
  text height: every text object reports `height: 18` and `measureText` approximates width as
  `length × 7`. Any "the text fits" claim proved only there is arithmetic, not painting.
- **Break the guard and watch a named test go red.** The record is unambiguous: 982, 1125 and 1334-green
  suites each hid a load-bearing defect, and 3.4's review found six tests whose names described guards
  they did not exercise, four of them still green with the guard deleted.
- **Minimum mutation set for this story:** the artwork lookup (make it return Young's artwork for the
  interferometer and watch a named test go red); the removed `hasOpticalGeometry` branch; the degree
  separator; the word-unit separator; the new non-overlap bands; the extended typography sweep; any new
  consultation predicate.
- **Name the change to `src/` that would break each assertion you write.** If you cannot, it is the
  "test that cannot fail" shape — the review found two `expect(x).toBe(x)`, two "starts no tween" tests
  that asserted nothing, and a rounding test that compared its output to itself.
- Never assert a magic number a test shares with source unless both read one exported constant.
- The canvas walks are frame-timed and load-sensitive. Judge a failure on an idle machine.
- `npm run typecheck:tests` is red at **106 / 60** and deliberately not gated. Diff against a stashed
  baseline rather than eyeballing it.

### §SS11. Two dead selectors in the blast radius

`selectCanonicalSourceLabel` and `selectCanonicalControlValue` (`selectors.ts:162`, `:165`) are exported,
called by **nothing** in `src/`, and consumed only by `tests/integration/LocaleProjection.test.ts`. Their
docstring justifies them by the retired DOM panels — *"Those panels are deliberately not localized … they
read authored text as `.en` directly"* — and those panels were **deleted in Story 2.12**.

`selectCanonicalControlValue` calls `formatMeasurement`, so it is inside AC5's blast radius and you will
meet it. Two honest options: delete both (the justification names a surface that no longer exists, and
`LocaleProjection.test.ts:102` / `:105` come with them), or record them in `deferred-work.md` with a named
owner. Deleting is cheap and in the spirit of the Don't-Miss table; if you delete, say so explicitly
rather than letting a test disappear quietly.

**Found while tracing `formatMeasurement`'s callers for AC5.** Not a blocker; do not let it grow the
story.

### §SS12. Deferred-work items this story owns

Five entries name **Story 4.2**. Each must be struck or rewritten, not carried forward verbatim:

- **`deferred-work.md:216`** — the bench artwork is Young's; *"attempting it here would double the story
  and land renderer work in a content-and-contract story."* Tasks 3–4.
- **`deferred-work.md:224`** — `formatMeasurement` writes its locale separator before every unit; wrong
  for an arc degree. Task 8.
- **`deferred-work.md:277`** — the second manifestation of the same defect: U+202F before a spelled-out
  multi-word unit renders `0,11largeurs de frange`. Same owner, same fix. Task 8.
- **`deferred-work.md:269`** — `flow.minimumExperimentCycles` / `maximumExperimentCycles` read by nothing;
  *"it needs a decision before a third case authors a range expecting it to bind."* Task 9.
- **`deferred-work.md:278`** — the roll-up entry recording that the bench artwork, the invented constants
  and the degree separator were all met and left untouched by Story 4.1. Tasks 4, 7, 8.

Items this story will likely open, each needing a **named owner story**:

- Whatever the new tableau's layout cannot hold in French.
- The two dead canonical selectors, if not deleted (§SS11).
- Any consultation predicate kind added for replication that a second case would want generalized.
- The `WAVELENGTH_CHOICE_COUNT_BOUND` reserve, if it is spent for this case but not re-derived for Young.

*Do not* touch items owned by 4.3 or Epic 5 (§SS1).

### §SS13. Lessons from 3.1–4.1 that apply directly here

- **A graceful degradation is the defect shape a green suite keeps.** Three times on this exact case.
  Nothing threw; the surface lied. Every guard you write for the new tableau needs to fail *loudly*.
- **A comment claiming a guarantee is not a guarantee.** Five stories running. `renderApparatusGeometry`'s
  own comment asserted the opposite of what the code did, in writing, and was believed for a story.
- **When two code paths answer the same question about a case, change them together.** Before you change
  one place that asks "which case is this?", grep for the others.
- **Make the list of things you relaxed or replaced explicit and tick each one off.** Story 3.1 re-stated
  one guarantee exemplarily and left four unstated; its review found all four. You are replacing a guard
  that was silently holding the slit/screen placement, the fringe-painter choice, and the geometry test's
  band derivation — three things. List them.
- **Take values from the model's behaviour, not from the authored range's ends.** `rotationDeg` spans
  0–180 against `cos(2θ)`; the endpoints are one reading.
- **A version bump and its record allowlist are one action.** Story 3.4's severest finding: a `1.3.0` bump
  landed without its `CaseRecordSchema` clause and every saved prototype investigation was refused.
- **Screenshot before you claim a rendering surface is done.** This project's own recorded memory:
  depth-order, split-scale and fixed-layer occlusion defects pass every test.

### §SS14. Recent work, and the dependency posture

**Baseline is `771adca` ("Review 4.1").** The rhythm is three commits per story — `Story N`, `Dev N`,
`Review N` — so this story's dev commit lands on a reviewed tree.

`771adca` is worth reading for its shape: 23 files, **twelve of them tests**, `sprint-status.yaml` and
`deferred-work.md` updated in the same commit as the work, `public/sw.js` bumped for a *behavioural*
worker change rather than a schema one, and no `dist/` (gitignored build output). A story that changes a
rendering surface and touches four files is a story that has not yet written its proofs.

Also visible across 3.2 → 4.1: `sw.js` moved in three consecutive review commits, which is the bump rule
being applied late three times. Apply it in the dev commit.

**No dependency changes.** Every version is pinned by a committed lockfile with a stated reason,
`playwright-core` is held by an `overrides` entry, and the ES2020 `target`/`lib` is deliberate —
`.at()` and `Object.hasOwn` are unavailable; write `[length - 1]`. This story needs nothing new: it is
`Graphics` fill commands, one pure geometry module, one lookup, one formatter rule, authored JSON, and
tests. If you reach for a package, stop and say why.

### Project Structure Notes

| Deliverable | Path | Rule that decides it |
|---|---|---|
| Interferometer tableau geometry (pure) | `src/adapters/phaser/renderers/` beside `apparatusGeometry.ts` | Geometry/painting split — a spec deriving a coordinate reads the numbers, it does not construct a renderer. No Phaser value import. |
| Interferometer tableau painting | `src/adapters/phaser/renderers/` | Renderer contract: `create()` / `render(state)` / `destroy()`, owning every display object, tween, timer and listener it creates. |
| Artwork lookup keyed on `ExperimentModelId` | `src/adapters/phaser/renderers/` | Presentation choice, so it belongs in the adapter — but keyed on the **domain's** closed model id list so it is exhaustive. |
| Model constants | `src/domain/apparatus/calculateInterferometerDrift.ts` | `src/domain/` is pure TypeScript — no Phaser, DOM, fetch, IndexedDB, **and no Zod**. |
| Unit separator | `src/core/i18n/formatNumber.ts` | `src/core/` holds the store, i18n, errors and `Result`. `Intl` is a built-in, so `core/` stays platform-free. |
| New on-canvas control (if any) | `src/adapters/phaser/ui/` | Phaser widgets live here — **not** `src/ui/`, which holds exactly three modules and must not gain a fourth. |
| Interface strings | `src/core/i18n/locales/{en,fr}.ts` | Interface strings go through `translate` / `createTranslator`; authored prose is `LocalizedText` via `resolveLocalizedText`. |
| Case content | `public/cases/morley-miller/case.json` | **Edit only `public/cases/…`** — `dist/`, `dist-subpath/` and `.claude/worktrees/**` are build output or stale copies. |
| Schema changes | `src/schemas/CaseDefinitionSchema.ts` | Every Zod object `.strict()`. Case-specific *rules* branch on `id`; a case's *physics* and its artwork are keyed lookups. |
| Record allowlist | `src/schemas/CaseRecordSchema.ts` | Scoped by case id; keep it honest rather than widening it. |
| Service-worker bump | `public/sw.js` | Same commit as the content change, reason appended to the header list. |
| Case review artifact | `docs/case-reviews/morley-miller-case-review.md` | Story 4.1 created it; §3 and §6 are this story's to update. |
| Authoring guidance | `docs/content-authoring/` | Where an author meets the cycle-field decision (AC6). |
| Unit tests | `tests/unit/` | Pure logic, Vitest, fixtures, no browser. |
| E2E | `tests/e2e/morley-miller-prototype.spec.ts`, `french-typography.spec.ts` | Extend; do not add a parallel walk. |

**Naming:** `PascalCase` for classes and their files; `camelCase` for non-class modules, functions,
properties and JSON fields; `UPPER_SNAKE_CASE` for constants; `kebab-case` for case ids, assets and
experiment model ids. Domain events `noun.verb`; typed actions `domain.verbPastTense`. Fallible operations
return `Result<T, ResultError>` rather than throwing; error codes resolve to localized copy.

**Do not create:** a third contextual artifact; a `services/`/`managers/`/`helpers/` catch-all; a fourth
module in `src/ui/`; a case-rule registry, model factory or artwork plugin layer; a new scene or phase; a
second notebook, reset or advance implementation for this case. And do not wire, extend or imitate
`src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` — orphaned Phaser-template leftovers
referenced nowhere.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` revision 2.6 — the rules that bear on *this* story. The
file is governing; this is a pointer to the parts you will cross.

**Stack**
- Phaser 4.2.1, the **sole interactive presentation surface**. TypeScript ~5.7.2 `strict` with
  `target`/`lib` **ES2020 deliberately** — post-ES2020 members are unavailable; that trade has been
  considered and lost twice.
- Vite 8.1.5, Node 20.18.1+, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1. Lockfile committed.
  Every e2e script runs through `cross-env PLAYWRIGHT_BROWSERS_PATH=0`.
- Content is **two cases**: `young-interference` at `1.22.0`, `morley-miller` at `1.4.0`. `sw.js` at
  `quantique-bootstrap-v13`. **Assume nothing is Young-shaped.**

**Engine (ADR-001 v1.1, ADR-004, ADR-009, ADR-011, ADR-012)**
- A feature is not done until the **canvas** can dispatch its intent. If the only dispatcher is under
  `src/ui/`, the story is unfinished no matter how green its unit tests are.
- `src/ui/` holds exactly three modules and must not gain a fourth. Phaser widgets live in
  `src/adapters/phaser/ui/`, which is not bound by that rule.
- Renderer contract: `create()` / `render(state)` / `destroy()`; `destroy()` releases every display
  object, tween, timer and listener — including tweens whose target is the renderer itself.
- **Never author player-facing copy in `create()`.** Create empty; populate in `render(state)`.
- **Honour `prefers-reduced-motion`** in every animated renderer: no update loop when `reduce` is set, and
  `render()` paints a static frame.
- **The apparatus is unlit until the player starts it.** No animation loop registers from `create()` for
  the experiment's light. Idle animation is both a design defect and an NFR1 cost.
- **Drag snaps to the authored step before dispatch**, in a Phaser-free module, unit-tested at both range
  ends and across every step. Every draggable instrument keeps a discrete step affordance and keyboard
  stepping, and both paths produce identical run records.
- **A renderer's case-shape guard and its "is this running?" decision must be the same decision.**
- **Never write a control id into a renderer** — compose from `apparatus.primaryControls`.
- The store is authoritative: scenes read through selectors and write only typed actions. No scene→scene
  reach-in. Scenes **mirror** the phase; the router obeys the case's `scenarioScript` and never dispatches.
- No Arcade or Matter physics for scientific results — deterministic, versioned domain calculation only.
  Direct-manipulation drag is an input mapping, not a physics body.
- **Narrow viewports suppress nothing.** Every affordance stays available at every width.

**Guided adventure & gating**
- Everything is authored; nothing is freeform. The shared contract holds only what every case shares;
  per-case invariants live in a refinement branched on `id`. **Do not build a plugin or registry layer.**
- Case-specific *rules* branch on `id`; a case's *physics* is a keyed lookup on `experiment.modelId`.
  Mixing the two mechanisms up is the trap.
- **A gate can be made unsatisfiable by code, not only by content.** Ask it of every predicate you write.
- **No authored content may leave a gate unsatisfiable.** Refine at load, with the offending path named.
- **Author a case field that nothing reads** is shipped-and-dead content, the same defect class as an
  unreachable intent.
- The evidence evaluator is the sole completion authority. Defensibility is evaluator/critique-only.
  The neutral auto-summary states what the player did and never evaluates it.
- No hard-fail states, irreversible wrong choices, speed rewards, or rewards for overclaiming.
- **A refused action always says why**, and the message survives until a real state change replaces it.

**i18n (ADR-010, NFR19)**
- EN + FR from launch, locale from the browser, no player-facing selector. Every new content surface
  inherits the EN+FR requirement as part of its own acceptance criteria.
- Scientific run values are canonical across locales; localize only for display.
- **Do not add a webfont.** **Never** join a French preposition or article to an authored label.
- **Normalize negative zero where you round, not where you format.**
- The `formatMeasurement` separator gap is recorded here with this story as owner — AC5.

**Performance**
- 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal. No logging, JSON parsing,
  IndexedDB access, DOM work or transient allocation in render/update hot paths. Animate on elapsed time.
- **Scenery is generated once in the create pass, and that is what keeps it legal.** Prefer atlases and
  pre-rendered assets over regenerating `Graphics` geometry each frame; bake with `generateTexture` if a
  measurement says the fill count does not hold.
- Cap text resolution at `min(devicePixelRatio, 2)`.
- **NFR1's profile has never been run** — do not treat 60 FPS as verified, and do not substitute an
  automated figure for it.

**Organization**
- `src/domain/` is pure TypeScript — no Phaser, DOM, `fetch`, IndexedDB, browser APIs, **and no Zod**.
  `src/core/` holds the store, i18n, errors and `Result`. `src/schemas/` owns every Zod schema.
  `src/adapters/` owns all side effects. The dependency direction never reverses.
- Case definitions and shared assets are immutable under `public/`; player progress lives only in
  IndexedDB. Bump `CaseDefinition.version` on any contract change.
- **Never recalculate a saved historical run against a newer experiment model.**
- Every Zod object `.strict()`. Fallible operations return `Result<T, ResultError>`.

**Testing**
- Unit-test all pure domain logic with fixtures; never require Phaser or a browser for scientific logic.
- **Break the guard and watch a named test go red** for any guard whose failure would be silent.
- **A test that cannot fail is worse than none.** Know what the scene harness can and cannot see.
- Canvas text cannot be read from a spec — a string assertion belongs in a `sceneSlice` unit test or in
  `french-typography.spec.ts`.
- An e2e walk asserting two *distinguishing* runs must pick values that differ **under the model**.

**Platform & build**
- Static hosted web app; offline reload is a release gate.
- **A schema change that makes an older cached response unparseable is a `CACHE_NAME` bump** — same
  commit, reason appended to the header list.
- All three CI workflows run `npm run typecheck`, `npm test`, `npm run build`, then
  `npm run test:e2e -- --workers=1`. `typecheck:tests` is deliberately not among them.
- Two gitignored build outputs: `dist/` and `dist-subpath/`. Edit neither.

### References

- [epics.md §Epic 4 / Story 4.2](../planning-artifacts/epics.md) — the two epic ACs, verbatim in AC1/AC2/AC4.
- [epics.md §FR19, §FR18, §FR23, §FR25, §FR30, §NFR8, §NFR14](../planning-artifacts/epics.md) — rotation and temperature logging, the confound/reset/assumptions triple, unlimited reset, the two-to-four cycle structure, direct-manipulation instruments, no hard fail, session length.
- [gdd.md line 121](../planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md) — *"Rotate the interferometer, log fringe change and temperature trend, repeat a stable-window observation."*
- [EXPERIENCE.md §Controls, §Feedback](../planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md) — instrument contract, *"starting the light is the scene's one moment of real spectacle"*, *"diegetic never means hidden"*.
- [project-context.md revision 2.6](../project-context.md) — governing.
- [game-architecture.md v1.2](../game-architecture.md) — ADR-001, ADR-004, ADR-006, ADR-009, ADR-011, ADR-012; §Project Structure; §Phaser Object Patterns.
- [4-1-morley-miller-historical-case-record.md](4-1-morley-miller-historical-case-record.md) — the previous story, its review findings, and §SS13's lessons.
- [deferred-work.md](deferred-work.md) lines 216, 224, 269, 277, 278 — the five entries this story owns.
- [morley-miller-case-review.md §3, §6](../../docs/case-reviews/morley-miller-case-review.md) — the cycle-field caveat and the residual-gap table.
- [morley-miller-prototype.md §8](../../docs/case-prototypes/morley-miller-prototype.md) — gaps 1 and 3.
- `src/adapters/phaser/renderers/ApparatusRenderer.ts:941-1010` — `renderApparatusGeometry`, `paintDisplacedFringes`, `paintFringes`.
- `src/adapters/phaser/renderers/apparatusGeometry.ts:162-576` — the bench's measured layout and `benchObjectBands`.
- `src/domain/apparatus/calculateInterferometerDrift.ts` · `experimentModels.ts` · `src/core/i18n/formatNumber.ts`.
- `src/domain/review/ConsultationRule.ts` · `src/domain/review/colleagueHints.ts` · `src/domain/evidence/significantMeasures.ts`.

---

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-08-20 | Story created — context engine analysis over epics, GDD, UX, architecture, project-context 2.6, Story 4.1 and its review, `deferred-work.md`, the case review artifact, and the bench/model/formatter source. | Create-story workflow |

---

## Open Questions for Alexis

Saved for the end, as the workflow requires. None blocks the start of implementation — each has a stated
default so the dev agent can proceed either way.

1. **`flow.minimumExperimentCycles` / `maximumExperimentCycles` — real cap, or advisory metadata?**
   Carried forward unanswered from Story 4.1's Open Question 4, and this story owns it. §SS8 recommends
   **advisory**, and the reason is stronger than tidiness: a hard cap at four runs strands a player who
   spends all four at one arrangement — which the case's own confound, *discoverable by replication*,
   actively invites — because `minimumSignificantRuns` is 2, nothing clears `runs`, and reset deliberately
   preserves observations. That is a gate made unsatisfiable by code, plus a collision with NFR8 and FR23.
   Absent an answer the dev agent will take the advisory branch and document it at the authoring site.

2. **How far should the model constants be "calibrated"?**
   The 1907 transcription publishes two numbers — a stationary ether demanded **1.53 wave-lengths**, and
   the observations were certain to **one eightieth** of that (≈ 0.019 fringe widths). §SS4 recommends
   deriving the orientation amplitude from the published bound and keeping the thermal coefficient and the
   stable window as *stated* teaching constants, because the report publishes no coefficient and inventing
   a derivation would be a fabrication dressed as a citation. The alternative — leaving all three as they
   are and rewriting only the docstring — is defensible but means the case ships numbers whose only
   justification is that they teach well. Either way the docstring stops promising a future calibration.

3. **Where should the confound, the reset path and the model's assumptions be shown?**
   §SS6 reports a new find: all three are authored, bilingual, schema-validated, and rendered on **no**
   player surface — on both cases — while `docs/case-reviews/morley-miller-case-review.md` §1 lists all
   three as satisfying FR18. The recommendation is an "apparatus notes" entry on the laboratory's existing
   reference shelf, reusing `ReferenceBookPresenter`. If you would rather this became its own story, say
   so and it will be recorded in `deferred-work.md` with 4.3 as owner — but note that AC2's *"separately
   inspectable"* is hard to claim honestly while the case's own statement of its confound is invisible.

4. **The ledger stays BLOCKED.**
   Not a question this story can answer, restated because it is the epic's release gate: the scholarly
   reviewer and the educator context sheet are still unassigned, and `evaluateLedgerReleaseApproval`
   resolves `morley-miller` to **BLOCKED** on both. This story authors no name to clear a row.

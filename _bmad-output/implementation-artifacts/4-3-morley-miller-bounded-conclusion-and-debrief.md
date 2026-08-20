# Story 4.3: Morley–Miller bounded conclusion and debrief

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
  Context engine notes, 2026-08-21. This story closes Epic 4. Its two AC clauses are short and its
  substance is not: the authored content the ACs describe **already exists** (Story 3.2 wrote the four
  conclusion proposals, the three peer-review rules, the four rival critiques and the whole debrief;
  Story 4.1 re-anchored the debrief's historical comparison to the verified 1907 report). What does
  *not* exist is the property the ACs assert. Verified against source before this file was written:

  * `peer-overreach` — ten authored phrases, EN and FR — matches **none of this case's four conclusion
    claims**. The rule is authored, schema-validated, and unreachable. §SS3 has the proof.
  * The one authored limitation that is not a limitation ("None offered.") satisfies the `limitation`
    readiness requirement, because the requirement asks `.trim()`.
  * No spec or screenshot has ever reached this case's debrief. `walkToDebrief` is hard-wired to Young.
  * The peer-review issue band is a shrink-then-crop surface that nothing measures, in either case.
  * Because the overreach rule cannot fire, `deriveRecognition` awards **"Calibrated conclusion
    recorded"** to a player who concluded the ether is disproved — a reward for overclaiming, which
    NFR8 forbids by name, painted on the debrief this story is supposed to deliver.

  So this is not a content-polish story. It is the story that makes two authored refusals real, gets a
  route to the surface that closes the case, and measures three bands nobody has looked at.
-->

## Story

As a player,
I want to submit an upper-bounded conclusion and read the historical debrief,
so that I learn what the evidence constrains without treating it as standalone proof of relativity.

## Acceptance Criteria

Epic 4's authored criterion, verbatim:

> **Given** the required Morley–Miller evidence,
> **When** I submit a conclusion,
> **Then** review requires an explicit limitation and rejects overclaiming with neutral revision feedback,
> **And** the debrief explains the historical interpretation with sources.

Each clause is decomposed below into something a reviewer can hold the build to. AC1–AC3 are the first
`Then`; AC4–AC5 are the `And`; AC6–AC11 are the project's standing obligations for any story that
touches authored content and a rendering surface.

### AC1 — The overclaim refusal fires on this case's overclaiming conclusion

**Given** the Morley–Miller case at `review` with its evidence complete,
**When** I have chosen the conclusion that claims the ether is disproved and ask for feedback,
**Then** the reviewers return the authored `peer-overreach` issue — its `feedback` and its
`revisionPath`, resolved in my language by `ruleId` — and not an empty list,
**And** the same is true whichever locale I am reading in, because detection runs against the canonical
English draft (`reduceTheoryConclusionProposalChosen` writes `proposal.claim.en`),
**And** a named test fails if the phrase set and the authored claim stop agreeing — not a fixture claim
containing a fixture phrase, but **this case's shipped content** put through `evaluatePeerReview`,
**And** the same test states, for each of the four shipped conclusions, whether overreach is expected of
it and why, so a later copy edit that drifts them apart goes red rather than quiet.

**Given** any record a player has already saved,
**When** it is loaded after this change,
**Then** it is neither refused nor overwritten: `validateCaseRecordForDefinition` recomputes
`evaluatePeerReview` over `entry.conclusion` — the text the *record* holds — and string-compares it
against the stored issues, so the change must be one no persisted draft can be affected by,
**And** the argument for that is written down at the site, in the form the existing comment in
`peerReviewRules.ts` demands ("Any future addition needs the same argument, or a version-gated
detection set").

**Given** the overclaiming conclusion carried through to a reviewed revision,
**When** recognition is derived,
**Then** `calibrated-conclusion` is **not** achieved — `deriveRecognition` awards it to any reviewed
revision with `feedback.issues.length === 0`, so today an overclaiming draft earns *"Calibrated
conclusion recorded"* on the debrief and in `completion.recognition`, which is a reward for overclaiming
and NFR8 forbids one by name,
**And** a named test asserts that on the shipped case, both ways: not achieved on the overclaim path,
achieved on `conclude-bounded-null`,
**And** no already-completed record loses its recognition retroactively —
`validateCaseRecordForDefinition` checks only `completion.recognition.version === 1` and never
recomputes the flags, which is the safe direction and is worth stating in the record.

### AC2 — "Requires an explicit limitation" is load-bearing, or it is honestly re-stated

**Given** a draft with no limitation,
**When** I ask to move it to review,
**Then** `evaluateConclusionReadiness` refuses with `limitation` and the colleague answers with the
authored `consult-no-limitation` guidance — both of which already hold and are already tested.

**Given** the conclusion whose authored limitation is the string "None offered.",
**When** that draft is reviewed,
**Then** the build does **not** present it as having met a limitation requirement — either because the
requirement is made able to tell a limitation from a declaration that there is none, or because the
requirement's real scope (the pre-choice draft) is stated in the code and in this story, with the
overclaim refusal named as the mechanism that answers the post-choice case,
**And** whichever of those two is chosen, the decision and its reason are recorded in the Dev Agent
Record, and no comment anywhere is left claiming the guarantee that was not built.

Do **not** close this by making the case unfinishable. FR16 and NFR8 are explicit: a weak conclusion
earns revision feedback, never a hard fail, a penalty or a lockout. `reduceDebriefComplete` deliberately
does not inspect the standing issues, and it must keep not doing so.

### AC3 — The rival lab answers both undefendable conclusions and routes back

**Given** either conclusion whose `supportPredicate` is `never`,
**When** I submit it,
**Then** the authored critique for that proposal is selected and stands, `case.phaseRetreat` is refused
while it stands, `rivalLab.revisionRequested` clears it, and my chosen proposal and draft survive
untouched,
**And** there is no score, counter, timer or penalty anywhere on the path,
**And** submitting `conclude-bounded-null` on the evidence the case's own `experiment.resetPath` teaches
is **defensible** and raises no critique — including its `unvaried-control-pinned` clause on
`bathTempC`, which reads the pinned set and fails closed,
**And** this is proven on the shipped case, not on a fixture.

### AC4 — This case's debrief is reachable, and its historical interpretation and sources are read

**Given** the Morley–Miller case completed through the reviewed revision,
**When** the case closes,
**Then** a browser spec reaches `Debrief` on **this** case — `walkToDebrief` takes a case id, the way
`walkToTheBoard` already does — and the helpers it needs stop being module-private,
**And** the debrief renders the authored summary, the historical comparison with both of the 1907
report's own numbers, the deeper-theory layer, and the two cited sources with their provenance,
source-type and rights labels,
**And** the two citations resolve: they come from `historicalComparison.sourceIds`, which the schema
cross-checks against `contextualArtifacts` — not from `debrief.sourceRefs`, whose two ids match no
artifact and which nothing reads,
**And** the recognition account it paints is read: four rows, localized by stable id, with
`calibrated-conclusion` reading achieved on the bounded conclusion and not-recorded on the overclaim,
**And** the frame is captured at 1280×720 in **both** locales, by a committed spec with an
`outputPath`, following the pattern `young-canvas-experiment.spec.ts` established for by-eye evidence.

**Given** `docs/case-reviews/morley-miller-case-review.md` §4,
**When** that capture exists,
**Then** §4's claim that the debrief was *"confirmed by eye at 1280×720 in English and French"* is
either made true by the new frames or corrected — there was no route to this case's debrief when it was
written, and the sprint record for 4.1 says so in as many words ("debrief not reachable — recorded for
4.3").

### AC5 — Three unmeasured bands are measured, at the real surface size, in both locales

**Given** the debrief's comparison band,
**When** this case's French prose is drawn into it,
**Then** it fits the **stated reserve** rather than the renderer's shrink-then-crop clamp, and
`DEBRIEF_COMPARISON_BAND_HEIGHT`'s docstring stops recording an exhausted margin as a residual: either
the band holds the content or the content is authored down, and which one was done is written there.

**Given** the case file's peer-review pane at `review`,
**When** this case's issues stand — one, and then the worst combination ordinary play can reach —
**Then** they are legible inside `CASE_FILE_ISSUES_HEIGHT` at `CASE_FILE_META_FONT_SIZE` across
`CASE_FILE_RIGHT_COLUMN_WIDTH`, in both locales, confirmed by eye and not by the unit harness,
**And** `french-typography.spec.ts` gains the peer-review prose — `feedback`, `revisionPath` and the
`caseFile.review.issue` composition — for **both** shipped cases, which it currently sweeps for
neither. Young's French `review-overreach` line composes to 234 characters and Young's
`review-missing-evidence` to 204; this case's are 184 and 162.

**Given** the debrief's cited-source rows,
**When** the two artifacts' names and provenance lines are drawn in French,
**Then** they hold `DEBRIEF_SOURCE_ROW_HEIGHT` across `debriefLeftTextWrap`, measured the same way.

A height claim proven only in `tests/unit/sceneSlice.ts` is arithmetic, not a measurement: every text
object there reports a constant `height: 18` and `measureText` approximates width as `length * 7`.

### AC6 — Every intent on this path is dispatchable from the canvas

**Given** the whole conclusion → review → debrief path on this case,
**When** every action it needs is traced to its dispatcher,
**Then** each one has a Phaser dispatcher (ADR-011 / NFR20), and the trace is recorded — not asserted
from the file list. Grep for the dispatcher of each: `theory.conclusionProposalChosen`,
`theory.conclusionSubmitted`, `rivalLab.revisionRequested`, `theory.reviewRequested`,
`peerReview.requested`, `revision.saved`, `case.debriefCompleted`, `case.replayStarted`,
`consultation.requested`.

`consultation.requested` and `apparatus.reset` were recorded as **unowned** before Story 2.12 and the
note has been carried since; say plainly whether that is still true of the review path.

### AC7 — Every surface this story adds or changes is bilingual from the start

**Given** any string this story authors, rewords or newly draws,
**When** the case is played in French,
**Then** there is no English fallback anywhere on the conclusion, review, critique or debrief surfaces,
**And** the list of surfaces was built by **grepping for the read**, not from this story's file list —
the omission that shipped `CaseFilePresenter` showing no settings at all for this case in Story 3.2.
Surfaces that render conclusion, limitation, peer-review or debrief text: `CaseFilePresenter`,
`ColleagueRenderer`, `RivalLabRenderer`, `DebriefRenderer`, `CaseRecordPrintView`, `selectors.ts`'s
`selectLocalizedPeerReview` / `selectLocalizedDebrief`.
**And** no French phrase is composed by joining a preposition or an article to authored text.

### AC8 — Contract, version and cache hygiene

**Given** any change to `public/cases/morley-miller/case.json`,
**When** it lands,
**Then** `version` is bumped from 1.6.0, `CaseRecordSchema`'s prototype allowlist gains the matching
clause **in the same commit**, and the clause's comment states which of the recomputed canonical strings
moved and which did not — bumping the version and extending the allowlist are one action, and Story
3.4's severest finding was the time they were two,
**And** `public/sw.js`'s `CACHE_NAME` moves from `quantique-bootstrap-v15` in the same commit with its
reason appended to the header list,
**And** if a conclusion `claim.en` or `limitation.en` changes, the consequence is stated: a saved record
holding the old text keeps its `selectedConclusionProposalId` **sanitized away** rather than being
refused (`CaseRecordSchema.ts` — the `proposal.claim.en !== record.theory.conclusion` branch), so the
returning player loses the highlighted card and keeps the investigation.

### AC9 — Every deferred item naming this story is closed or re-owned, by name

**Given** the eighteen entries in `deferred-work.md` whose owner is Story 4.3,
**When** this story lands,
**Then** each one is struck as closed, or rewritten with a **named owner story** and the reason it is
not this story's — "Epic 5" and "later" are not owners, on this project's own rule,
**And** the list is reproduced in the Dev Agent Record with a tick against each, because Story 3.1
re-stated one guarantee exemplarily, left four unstated, and its review found all four.

§SS12 carries the full list with a recommendation for each. Do not silently carry an item forward.

### AC10 — Layout is measured, in both locales, at the real surface size

**Given** every band this story draws into,
**When** it is verified,
**Then** the evidence is a frame captured at 1280×720 in EN and FR by a committed spec with a stated
route to re-take it, not a claim in a completion note. This project's recorded memory is explicit:
depth-order, split-scale and fixed-layer occlusion defects pass every test.

### AC11 — Verification

**Given** this story's implementation,
**When** the gates run,
**Then** `npm run typecheck` is clean, `npm test` passes with the file and test counts recorded against
the 1614 / 83 baseline, `npm run build` and `npm run build:subpath` succeed, `npm run test:e2e` passes
with its count recorded against the 70 baseline on an **idle** machine, and `npm run typecheck:tests`
is **no worse than 105 errors across 59 files** — the count is the metric and may only go down,
**And** for every guard whose failure would be *silent*, the guard is broken, the test named for it is
observed red, the guard is restored, and the proof is recorded in a table. The minimum set is in §SS10.

## Tasks / Subtasks

- [ ] **Task 1 — Read before writing, and record the two decisions (AC1, AC2, AC9)**
  - [ ] Read `_bmad-output/project-context.md` revision 2.6 in full. It is governing.
  - [ ] Read, completely, every file §SS2 and §Project Structure Notes mark UPDATE. For each, write down
        in the Dev Agent Record: what it does today, what this story changes, and what must not break.
  - [ ] Record **D1**: how AC1's overclaim refusal is made to fire — reword the authored claim, widen
        the phrase set, or version-gate the detection. §SS4 has the analysis and a recommendation.
  - [ ] Record **D2**: how AC2's limitation requirement is resolved — made discriminating, or re-stated
        with its real scope. §SS5 has the analysis and a recommendation.
  - [ ] Neither decision is a judgement call to be made mid-implementation. Write it, then build it.

- [ ] **Task 2 — Prove the current state, before changing it (AC1, AC3)**
  - [ ] Write the shipped-content test first: load both cases through `tests/unit/shippedCases.ts`, run
        `evaluatePeerReview` over each conclusion proposal's canonical `.en` claim with the case's own
        rules, and assert the expected issue codes per proposal.
  - [ ] Watch it **fail** on `conclude-ether-disproved` before you fix anything. That red is the story's
        premise; if it is green, stop and re-read §SS3, because something else is true.
  - [ ] Do the same for `conclude-bounded-null` on the evidence the `resetPath` teaches: defensible, no
        critique, no issues.
  - [ ] And for recognition: assert `calibrated-conclusion` on both paths and watch the overclaim one
        fail before the fix. That red is the NFR8 half of the premise.

- [ ] **Task 3 — Make the overclaim refusal real (AC1, AC8)**
  - [ ] Apply D1.
  - [ ] Write the record-compatibility argument at the site, in the shape the existing comment in
        `peerReviewRules.ts` demands. If the argument is "no persisted draft can contain this phrase",
        prove it against the pre-edit claim text of **both** shipped cases and say so.
  - [ ] If `case.json` moved: version bump + `CaseRecordSchema` clause + `sw.js` bump, one commit.

- [ ] **Task 4 — Resolve the limitation requirement (AC2)**
  - [ ] Apply D2.
  - [ ] Whichever branch: delete or correct every comment that claims the other one.
  - [ ] Add the test that fails if the resolution stops holding, and name in its docstring the change to
        `src/` that would break it.

- [ ] **Task 5 — A route to this case's debrief (AC4, AC6)**
  - [ ] Give `walkToDebrief` a required `caseId` and the parameters the walk needs; export
        `pinTheSupport` and `closeTheCase`, or give the walk the seams they hold.
  - [ ] Read the beat count and the colleague index **from the case**, not from a literal. Young's
        `synthesis` authors 3 beats and its `review` 2; this case authors **1 each**. And
        `chooseProposalThroughColleague`'s default `colleagueIndex = 3` selects `nils-abrahamsen` here —
        `conclude-ether-disproved`, the overclaim. §SS7 has the mapping.
  - [ ] Assert the debrief is reached, the record's completion projection stands, and the replay leaves
        it standing — the same three things `debrief-replay.spec.ts` asserts for Young.
  - [ ] Name Young explicitly at the existing callers rather than leaving a default behind.

- [ ] **Task 6 — Measure the three bands (AC5, AC10)**
  - [ ] Extend `french-typography.spec.ts`: peer-review `feedback`, `revisionPath` and the composed
        `caseFile.review.issue` line, both cases, both locales, at the pane's real font size and wrap.
  - [ ] Capture the debrief at 1280×720 in EN and FR from the new walk, through `testInfo.outputPath`.
  - [ ] Capture the case file's peer-review pane at `review` with this case's issues standing, EN and FR.
  - [ ] Look at all four frames. Then decide whether a band grows or content is authored down, and
        record the measurement — not the intention — at the constant.

- [ ] **Task 7 — Close or re-own every 4.3 deferred item (AC9)**
  - [ ] Work §SS12's table top to bottom. Tick each row.
  - [ ] `deferred-work.md` and `sprint-status.yaml` move in the **same commit** as the work.

- [ ] **Task 8 — The bilingual sweep, built by grepping the read (AC7)**
  - [ ] `grep -rn` for every read of `peerReviewRules`, `conclusionProposals`, `rivalLab.critiques` and
        `debrief` under `src/`. Enumerate the surfaces. Check each one in French.
  - [ ] Include `CaseRecordPrintView` — it is the one non-Phaser surface and it resolves by `ruleId`.

- [ ] **Task 9 — Update the case-review artifact (AC4)**
  - [ ] `docs/case-reviews/morley-miller-case-review.md` §4 (the bounded near-null) and §6 (residual
        gaps, each with an owner) are this story's to update. §4's debrief claim is the one to settle.

- [ ] **Task 10 — Gates and mutation proofs (AC11)**
  - [ ] Run every gate in §SS10. Record the counts against the stated baselines.
  - [ ] Break each guard in §SS10's minimum set, observe the named test red, restore it, record it.
  - [ ] Judge any e2e failure on an idle machine before attributing it to a change.

## Dev Notes

### §SS0. `_bmad-output/project-context.md` exists and is governing — read it first

Revision 2.6, 2026-08-19. Where an older artifact contradicts it, it wins, together with
`game-architecture.md` v1.2. §Project Context Rules below is a **pointer** to the parts you will cross,
not a substitute. The first review finding of Story 3.3 was that the file had not been read before dev.

Three of its rules are about to be tested by this story specifically:

- *"Author a case field that nothing reads → shipped-and-dead content."* You are holding a
  `peerReviewRule` with ten authored phrases that matches nothing, in a case whose whole point is the
  refusal it was written for.
- *"A comment claiming a guarantee is not a guarantee."* Sixth story running as of 4.2's review.
  `docs/case-reviews/morley-miller-case-review.md` §4 says the debrief was confirmed by eye; there was
  no route to it.
- *"A test that cannot fail is worse than none."* Every overreach assertion in the suite is a fixture
  claim containing the fixture's own phrase. None reads a shipped case.

### §SS1. Scope boundary — read this before writing anything

**In scope.** The overclaim refusal on this case; the limitation requirement's resolution; the rival-lab
path's verification on shipped content; a case-parameterised route to this case's debrief; the by-eye
verification and typography sweep of the debrief bands and the peer-review pane; the bilingual sweep for
everything above; the deferred-work triage; the case-review artifact's §4 and §6.

**Out of scope, owned elsewhere — do not touch:**

| Item | Recommended owner (record it in `deferred-work.md`) |
|---|---|
| `reduceRecordRun` re-deriving a result for a run without `modelInputs` | Story 5.1 — a third model makes it load-bearing |
| `experimentModelVersion`'s unconditional equality and the missing record-migration path | Story 5.1, with the above; a migration is a HALT condition mid-story |
| `experiment.wavelengthNm` authored-and-unread; the persisted `450 \| 550 \| 650` unions; the six French `nm` ASCII spaces | One spec story — they are one seam |
| `CaseRecordPrintView` unit coverage (needs a DOM environment — a new dependency) | One spec story, applying `SourceRightsLedger.ts`'s pure/mount split |
| `citation.reuseStatement` authored everywhere and rendered nowhere | §SS12 — decide and re-own; **do not render it here**, see §SS9 |
| The campaign entry gate, the completed-case-unreachable problem, the campaign e2e walk | One spec story — an in-game route back to a finished case is a new surface |
| The reference shelf's truncation behind a maximum-length hint; AC2's missing shelf walk | One spec story — same instrument, do them together |
| The `WAVELENGTH_CHOICE_COUNT_BOUND` reserve | Closeable here as a docstring re-statement — see §SS12 |
| Young's two unreachable consultations | Story 7.1 — Young content authoring plus a Young version bump |
| `debrief.sourceRefs` validated-but-unread; the unexercised `reconstruction` rendition kind | Epic 5's first story (assigned by Story 4.2) |
| The scholarly reviewer and the educator context sheet; the ledger stays **BLOCKED** | Alexis |
| NFR1's unrun 60 FPS profile | Alexis |
| Young's bench, its optical model, its case content | Nothing here touches them — if you are editing `young-interference/case.json` for any reason other than AC5's sweep, stop |

**HALT conditions.** Adding an npm dependency; adding a fourth module to `src/ui/`; adding a scene or a
phase; introducing a case-rule registry or plugin layer; changing `CaseRecordSchema`'s `schemaVersion`
or writing a record migration; adding a new `PeerReviewRule` predicate **kind** without first reading
§SS6 on what that costs a persisted record. Stories 3.2, 3.3 and 3.4 each met a gap a new dependency
would have closed and each worked with the constraint instead.

### §SS2. What already ships — do not rebuild it

The conclusion → review → debrief path is **not** a stub. Do not write a second one.

- **The evaluator.** `evaluateConclusionReadiness` (`src/domain/theory/conclusionReadiness.ts`) is the
  sole completion authority (ADR-006). Eleven `MissingConclusionRequirementCode`s, including
  `limitation`. `foreign-model-run` and `configurationKey` are already un-Younged (Story 3.2).
- **Defensibility.** `selectDefensibleConclusionIds` / `evaluateSupportPredicate`
  (`src/domain/theory/conclusionProposals.ts`). `unvaried-control-pinned` reads
  `evidence.selectedRunIds` and **fails closed** when absent — that is deliberate and load-bearing for
  this case's `conclude-bounded-null`.
- **Peer review.** `evaluatePeerReview` (`src/domain/review/peerReviewRules.ts`). Three predicate kinds.
  Emits canonical `.en` in `PeerReviewIssue.feedback` on purpose, because the issue is persisted and
  recomputed-and-compared on load; the surfaces localize by `ruleId`.
- **The rival lab.** `selectRivalLabCritique` (`src/domain/review/rivalLabRules.ts`) — stable ids, never
  prose. `RivalLabScene` + `RivalLabRenderer` are real. `reduceTheoryConclusionSubmit` evaluates
  defensibility and *nothing else*: it never advances a phase, saves, or completes.
- **The board and the case file.** `TheoryBoardScene` hosts `synthesis` **and** `review` — the scene does
  not change at that transition. `CaseFilePresenter` owns the readiness list, the request/save controls,
  the issues text and the consultation. All shared, all working.
- **The debrief.** `DebriefScene` + `DebriefRenderer` + `debriefGeometry.ts` are complete since Story
  2.11: summary, historical comparison, cited sources with provenance, the optional deeper-theory layer,
  the recognition account, the critique history with paging, the counterfactual warning, the replay.
  `selectLocalizedDebrief` resolves it all. **None of this is the gap.**
- **This case's authored content.** Four conclusion proposals with claims *and* limitations, three peer
  review rules, four rival critiques, four three-layer consultations, a full debrief — all bilingual,
  all schema-validated. Story 4.1 re-anchored `historicalComparison.text` to the 1907 report's own
  words (1.53 wave-lengths, one eightieth) and it is 289 French characters.

What is **left**, and is this story's: two authored refusals that do not fire, one route that does not
exist, and three bands nobody has looked at.

### §SS3. The exact defect AC1 names, with the proof

`reduceTheoryConclusionProposalChosen` (`src/core/store/AppState.ts:537`) writes
`theory.conclusion = proposal.claim.en` — **always English**, in every locale, because the draft is
persisted and string-compared on load. `isApplicable`'s `overreach` branch then tests the union of both
locales' `overreachPhrases` against that draft, lower-cased, on a word boundary.

Run the union against this case's four English claims and nothing matches:

| Proposal | `supportPredicate` | Overreach phrases found in `claim.en` |
|---|---|---|
| `conclude-bounded-null` | `all-of` | — (correct: it is the bounded claim) |
| `conclude-thermal-confound` | `all-of` | — (correct: it is a confound claim) |
| **`conclude-ether-disproved`** | **`never`** | **— (wrong: this is the overclaim)** |
| `conclude-instrument-broken` | `never` | — (a different error, not overclaiming) |

The claim reads *"The ether does not exist, and this bench has settled the matter for good."* The
authored EN phrases are `proves`, `settles it`, `once and for all`, `no doubt`, `disproved`. *"has
settled the matter"* is not *"settles it"*; *"for good"* is not *"once and for all"*; the word
*"disproved"* is in the proposal's **id** and not in its text.

Three consequences, all worth stating out loud:

0. **It is not only a content-honesty defect; it is an NFR8 violation.**
   `deriveRecognition` (`src/domain/recognition/recognitionRules.ts`) awards `calibrated-conclusion` —
   *"A reviewed revision makes a bounded claim without an overreach finding"* — to any reviewed revision
   whose `feedback.issues` is empty. On the ordinary path a player reaches `review` with readiness
   satisfied, asks for feedback, and gets **zero issues whatever they concluded**. So the debrief tells
   a player who concluded *"the ether does not exist, and this bench has settled the matter for good"*
   that they recorded a calibrated conclusion, and `completion.recognition` persists it. NFR8: *"no
   reward for overclaiming"*. AC1 fixes the cause; AC4 asserts the effect on the surface.
1. **The French half of the union is dead for both cases.** Detection runs against `.en`, so no French
   phrase can ever match. This case's French claim *does* contain `une fois pour toutes` — and it is
   never read. The comment in `peerReviewRules.ts` explaining why the union is deterministic is
   correct; the implication a reader takes from it, that the French list participates, is not.
2. **Nothing in the suite would have caught it.** Every overreach assertion in `ReviewRules.test.ts`,
   `ReviewFlow.test.ts` and `ConclusionProposals.test.ts` is a fixture rule with
   `overreachPhrases: { en: ['proves'] }` against a fixture claim containing *"proves"*. No test reads a
   shipped case's phrase set against a shipped case's claim. Young's `conclusion-wave-settled` happens
   to say *"proves"*, which is why the class has been invisible — and Young's *other* overclaim,
   `conclusion-universal-optics`, has the same hole. It is out of scope here (§SS1) but it is the same
   defect, so do not "fix" it silently while you are in the file, and do record it.

### §SS4. D1 — how to make the refusal fire, and what each option costs

The constraint is `validateCaseRecordForDefinition` (`src/schemas/CaseRecordSchema.ts`): for every
`decisionHistory` entry it re-runs `evaluatePeerReview` over **`entry.conclusion`** — the text the
record itself holds — and refuses the whole record if the recomputed issues differ from the stored ones
by so much as a JSON byte. `attachAutosave` then saves on the first dispatch of the recovered session,
so a refusal *overwrites* the record it refused.

| Option | Effect on a saved record | Cost |
|---|---|---|
| **A. Author the claim to say what it is claiming** — reword `conclude-ether-disproved` in both locales so the EN text contains an already-authored phrase (`disproved`, `once and for all`) and the FR text its FR counterpart | **Safe.** Recomputation reads the record's *old* text, which contains no phrase, so recomputed = stored. The only loss is `selectedConclusionProposalId`, sanitized away by the `claim.en` comparison — the card stops being highlighted; the investigation survives | A `case.json` bump, its allowlist clause, an `sw.js` bump. Content work, which is what this project prefers over new predicate kinds |
| **B. Widen the EN phrase set** to cover the claim as written (`settled the matter`, `for good`, `does not exist`) | **Safe only under a checkable argument**: a new phrase must appear in *no* pre-edit authored claim of *either* case, since those are the only texts a persisted draft can hold (free-text was retired in Story 2.12). `does not exist` fails that test if any other claim contains it — check, do not assume | Same bumps. Also widens detection for every future claim, which is a larger promise than the AC asks for |
| **C. Version-gate the detection set** | Safe by construction | The mechanism the existing comment offers as a last resort, and it is a new persisted-behaviour seam for one sentence of content. Disproportionate here |

**Recommendation: A, with B only for the phrase the reworded claim actually needs.** It keeps detection
deterministic, needs no new mechanism, is provably record-safe, and it fixes the honest problem —
a proposal named `conclude-ether-disproved` whose text carefully avoids saying so, which is why the rule
written to catch it does not.

Whichever you take: write the safety argument at the site and prove it. "No persisted draft can contain
this phrase" is checkable in one command over both `case.json` files. Run it, and quote it.

### §SS5. D2 — the limitation requirement, and what it currently guarantees

`evaluateConclusionReadiness` pushes `limitation` when `!draft.limitation.trim()`. Since Story 2.12 the
**only** writer of `theory.limitation` is `reduceTheoryConclusionProposalChosen`, which writes
`proposal.limitation.en`. `CaseDefinitionSchema` requires every proposal to author one. So:

- Before a proposal is chosen the limitation is `''`, the requirement fires, and
  `consult-no-limitation` (predicate `missing-limitation`) answers it in fiction. **This half works and
  is already tested** — `MorleyMillerFeedback.test.ts` proves that consultation reachable from a state a
  player can be in ("asks for a limitation once a reading has actually been repeated"). Do not rebuild
  it and do not claim it is broken.
- After a proposal is chosen the limitation is whatever the author wrote. `conclude-ether-disproved`
  authors **"None offered."** — a non-empty string that satisfies a requirement meant to ask for a
  limitation. Young does the same thing twice ("None is offered: …").

So the AC clause *"review requires an explicit limitation"* is true of the draft the player writes and
false of the one the content hands them. Two honest resolutions:

| Option | What it means |
|---|---|
| **A. Re-state the requirement's scope.** The `limitation` requirement guards the *pre-choice* draft; the post-choice case is the overclaim refusal's job, and after AC1 it does that job. Say so at the requirement, in the story, and in the case-review artifact. Delete any comment implying otherwise | No code change beyond comments and a test that pins the two mechanisms to their two states. Smallest honest change |
| **B. Make the requirement discriminating.** Give the `overreach` predicate — or a sibling — the limitation field to look at, so "None offered." is detected as a declared absence | A second detection surface over persisted text, with the same record-recomputation constraint as §SS4, for content the author already marked undefendable with `supportPredicate: never` |

**Recommendation: A.** The design already refuses these two proposals, twice: the evaluator declares
them undefendable and the rival lab answers them by name. A third refusal reading the limitation string
would be defence in depth over content whose author has already said what it is — and B's cost is
another persisted-recomputation seam, which §SS4 shows is the expensive kind.

If you take A, AC2 is met by *stating the truth precisely*, and the test that holds it is: the
requirement fires on the empty draft, `consult-no-limitation` answers it, and the overclaim refusal
answers the "None offered." draft. All three on shipped content.

### §SS6. What a new `PeerReviewRule` predicate kind costs

`PeerReviewIssue.code` is `PeerReviewRule['predicate']['kind']`, and the issue is persisted inside
`DecisionHistoryEntry.feedback` and recomputed-and-JSON-compared on load. Adding a kind is safe for
existing records **only** if no existing record's draft would produce it — the same argument shape as
§SS4, one layer up. `PeerReviewProjection`'s shape is persisted and cannot gain a field without a
`schemaVersion` bump, which is a HALT condition. Read `peerReviewRules.ts`'s own docstring on
`CANONICAL_UNAVAILABLE_MESSAGE` before you touch the type at all.

### §SS7. The route to this case's debrief — the exact shape of the gap

`tests/e2e/canvasHelpers.ts`:

- `walkToTheBoard(page, caseId, instrument)` **is** case-parameterised (Story 3.2), and Story 4.1's
  review made `caseId` required so an implicit Young default could not survive.
- `walkToDebrief(page)` calls `walkToTheBoard(page)` with **no case id** — so it is Young, always.
- `pinTheSupport` and `closeTheCase` are **module-private**. There is no route to this case's debrief
  from a spec at all, which is why Story 4.1's review verified AC3/AC4 on the reading room and the case
  file but not on the debrief.

Three case-shaped literals inside the private helpers, each of which must come from the case:

| Literal | Young | Morley–Miller | Where it comes from |
|---|---|---|---|
| `chooseProposalThroughColleague`'s `dialogueBeatCount` | `synthesis` 3, `review` 2 | **1 and 1** | `scenarioScript.scenes[phase].dialogueBeats.length` |
| `colleagueIndex` (default **3**) | `samuel-hart` → `conclusion-universal-optics` (`never`) | `nils-abrahamsen` → **`conclude-ether-disproved`** (`never`) | `colleagues[]` index of the `conclusionProposal`'s `colleagueId` |
| `ARTIFACT_COUNT` | 2 | 2 | `artifactCountFor(caseId)` — already exists; use it |

Note what the middle row says about the existing Young walk: it completes the case on a conclusion the
evidence does not defend, and always has. For **this** story you need both routes — the defensible one
(`conclude-bounded-null` → `edith-vance`, index 0) for AC4's happy path and AC3's no-critique clause,
and the overclaim one (index 3) for AC1 and AC3's critique clause. Derive both from the case; do not
write the index.

The beat count is the one that will bite quietly. `chooseProposalThroughColleague` clicks
`dialogueBeatCount + 1` times inside a polling `expect`, and the aims it clicks are
`boardDialogueAdvanceControlAims` — so over-clicking a 1-beat scene keeps pressing a control that has
already relabelled to the board's advance. `ADVANCE_RELABEL_LOCKOUT_MS` will absorb some of that and it
is timing-dependent, which is the worst kind of green.

Also: `closeTheCase` uses `clickUntilScene`, not a bare click, for the `ADVANCE_RELABEL_LOCKOUT_MS`
reason its own docstring gives. Keep that. And `WALK_TO_DEBRIEF_COST_MS` is the budget the debrief specs
set their timeout from — a second case's walk will need its own accounting; 4.2's review recorded the
Young walks running ~11–17 s against a 30 s allowance.

**Four existing callers** must name Young explicitly when the parameter becomes required — the change
Story 4.1's review made to `gotoCase` at seventeen sites, for the reason it gave there (an implicit
default is how a Young assumption survives a review):

- `tests/e2e/debrief-replay.spec.ts:60`
- `tests/e2e/inquiry-recognition.spec.ts:42`
- `tests/e2e/scene-router.spec.ts:54`
- `tests/e2e/canvas-transitions.spec.ts:117`

`inquiry-recognition.spec.ts` is the one to read while you are there: it walks to the debrief and
asserts recognition is carried into the record, that the vocabulary resolves for every
`RECOGNITION_ID`, and that no score, points, grade or rank appears anywhere in the document — but it
never asserts *which* recognitions were earned, which is why §SS3's item 0 has been invisible to it.
The Young walk it drives picks `colleagueIndex = 3` → `conclusion-universal-optics`, whose
`supportPredicate` is `never` and whose claim trips no phrase, so that spec has been earning
`calibrated-conclusion` on an undefendable Young conclusion since 2.11. **Out of scope (§SS1) — record
it, do not fix it here**, and do not let the new Morley–Miller assertion be written in a way that only
holds because Young happens to behave differently.

### §SS8. The three bands, with the numbers that are already known

**The debrief comparison band.** `DEBRIEF_COMPARISON_BAND_HEIGHT = 152` reserves a two-line French title
at 17px over **four** prose lines at 14px across `debriefLeftTextWrap`'s 560px on the shipped 1024×768
surface. Story 4.1 authored this case's French comparison up from Young's 222 characters to **289**, and
the constant's docstring — corrected by 4.1's review — records that the "line spare" it used to promise
is gone. Past four lines `DebriefRenderer` clamps toward `DEBRIEF_MIN_FONT_SIZE = 11` and then
`setCrop`s, with no visible clipping. `DebriefGeometry.test.ts` asserts the reserve holds four lines;
nothing asserts the content fits inside it, and nothing can while the harness reports `height: 18`.

**The case file's peer-review pane.** `CASE_FILE_ISSUES_HEIGHT = 106`, `CASE_FILE_META_FONT_SIZE = 12`,
`CASE_FILE_RIGHT_COLUMN_WIDTH = 372`, and `CaseFilePresenter.renderPeerReview` joins one
`caseFile.review.issue` line — `'{feedback} — {revisionPath}'` — per standing issue with `\n`, then
`this.clamp(...)`: shrink toward the floor, then crop. Composed lengths, measured:

| Rule | EN | FR |
|---|---|---|
| `peer-missing-evidence` | 135 | **162** |
| `peer-unsupported-support` | 132 | 145 |
| `peer-overreach` | 155 | **184** |
| Young `review-missing-evidence` | 157 | **204** |
| Young `review-unsupported-support` | 179 | 183 |
| Young `review-overreach` | 199 | **234** |

**One issue is the ordinary case; two is reachable and nothing forbids it.** `reduceTheorySupportRun`
and `reduceTheorySupportSource` carry **no phase gate**, so a player standing at `review` can unpin an
observation — `withTheory` clears the standing feedback and `caseFile.review.clearedBySupport` says so —
and then ask again, at which point `missing-evidence` (`minimum-runs`) and `overreach` both stand. That
is the worst combination AC5 asks you to measure: 162 + 184 French characters for this case, 204 + 234
for Young. Three at once needs an `unsupported-support` code, which ordinary play cannot produce (there
is no way to delete a recorded run), so treat three as the reserve's obligation rather than the walk's.

`french-typography.spec.ts` sweeps **none** of this prose for **either** case — grep it for
`peerReview`, `feedback` or `revisionPath` and you get nothing. That gap is squarely AC5's.

**The debrief's cited-source rows.** `DEBRIEF_SOURCE_ROW_HEIGHT = 36` holds a source name at 14px over a
provenance line at 12px, `DEBRIEF_CITED_SOURCE_ROWS = 2` because `historicalComparison.sourceIds` is a
two-tuple. The provenance line composes three translated labels (`source.provenanceName.*`,
`source.type.*`, `source.rights.*`) beside a French display name. Unmeasured.

What the sweep *does* already cover, so you extend rather than duplicate: `DEBRIEF_PROSE` (added by
4.1's review) sweeps both cases' `debrief.summary`, comparison title and text, and deeper-theory title
and text, **per token against `debriefLeftTextWrap`** — a width guarantee, not a height one. The height
half is what the by-eye capture is for.

**Expect the new sweep to go red on Young first.** Young's `review-overreach` composes to 234 French
characters against a 372px wrap at 12px, and Young reaches two standing issues today. If it fails, that
is a **pre-existing defect on the validated case**, not something this story caused, and there are only
two honest moves: grow the reserve (which helps both cases and is the recommendation, since the band is
shared and shrink-then-crop is the failure it prevents), or scope the sweep to this case and record the
Young half with a named owner. Do **not** loosen the bound to make the assertion pass — 2.11's review
found `debriefToggleStateWrap()` making a guard 56% looser than the surface it guarded, on this very
scene, and that is the shape to avoid.

### §SS9. Why `citation.reuseStatement` is not rendered here

Story 4.1's review assigned it to this story as "reading-room/debrief rendering work". Read the item
before deciding: the natural home is the debrief's cited-source rows, which already draw exactly this
kind of provenance metadata — and those rows sit in a column whose comparison band has **no height
margin left** (§SS8). Adding authored prose of unbounded length to a band above an exhausted one is the
overflow shape AC5 exists to catch, in the same story that is trying to measure it.

So: record the conflict, re-own the item with a named owner, and note that Story 4.1 *added* prose to
this dead field (the 1887 facsimile-verification sentence) which therefore reaches no surface — which
means `morley-miller-case-review.md` §2.1's record of that verification is the only place it exists.
That is a provenance-honesty point worth stating in §6 of the artifact, not a renderer change to make
under time pressure.

### §SS10. Testing requirements, and the minimum mutation set

Layout is `tests/unit`, `tests/integration`, `tests/e2e`. Vitest for pure logic — never require Phaser
or a browser to test scientific logic. Read shipped cases through `tests/unit/shippedCases.ts`, **never**
with your own `readFile`: `tsconfig.test.json` declares no `@types/node`, so every file importing
`node:fs/promises` adds a `TS2307` to a count that may only go down.

Assert public actions, selectors and rendered text — not Phaser private fields. Never assert a magic
number that a test shares with source unless both read one exported constant. When you write an
assertion, name the change to `src/` that would break it.

**Minimum mutation set.** For each: break it, watch the *named* test go red, restore it, record it.

1. Revert D1's change to the claim or the phrase set → the shipped-content overreach test goes red.
2. Delete the `overreach` branch from `isApplicable` → the same test goes red for a different reason;
   assert both, because a phrase set and its evaluator are two things.
3. Make `unvaried-control-pinned` fail open on an absent `selectedRunIds` → `conclude-bounded-null`
   becomes defensible on no pinned evidence; a named test must catch it.
4. Remove `limitation` from `evaluateConclusionReadiness`'s requirements → the empty-draft test and the
   `consult-no-limitation` test both go red.
5. Hard-code `walkToDebrief`'s case id back to Young → the new debrief spec fails on the wrong case
   rather than passing quietly.
6. Change one cited `sourceId` in `historicalComparison.sourceIds` to an id no artifact matches →
   `selectLocalizedDebrief` drops it, and the citation count assertion goes red.
7. Shrink `CASE_FILE_ISSUES_HEIGHT` (or `DEBRIEF_COMPARISON_BAND_HEIGHT`) below what AC5 measured → the
   new typography assertion goes red. If it does not, the assertion is measuring arithmetic.
8. Whatever D2 resolved: break it and watch the test named for it fail. If nothing goes red, D2 was
   recorded as a comment and not as a guarantee.
9. Revert D1 and watch the **recognition** test go red as well as the overreach one — two different
   claims about the same cause, and `calibrated-conclusion` is the one a player actually reads.

**Gate baselines to record against:** typecheck clean; `npm test` at **1614 unit / 83 files**; `npm run
build` and `npm run build:subpath` ok; `npm run test:e2e` at **70**; `npm run typecheck:tests` at
**105 errors / 59 files** (the ceiling; it may only go down). The canvas walks are frame-timed and
load-sensitive — three earlier stories recorded phantom e2e failures from review-agent CPU contention.
Judge on an idle machine.

### §SS11. Two things that look like defects and are not

Check these before reporting them, so the review does not spend a layer on them:

- **`reducePeerReviewRequest` passes no `comparisonNotes`.** So inside `evaluatePeerReview`,
  readiness's `foreign-model-run`, `distinct-run-configurations` and `saved-comparison` checks — all
  gated on `evidence.comparisonNotes &&` — are skipped, even though `missing-evidence`'s applicable-code
  list names them. That is not a hole: peer review is only requestable at `review`, and `review` is only
  reachable through `reduceTheoryReviewRequest`, which already required full readiness *with* the notes.
  The three codes in the list are inert rather than wrong. Say so if you touch the list; do not "fix" it
  by threading the notes through without checking what that changes on the record-recomputation path,
  which calls the same evaluator with the same two-field evidence.
- **`reduceDebriefComplete` does not inspect the standing issues.** Deliberate, and required: FR16 and
  NFR8 forbid a hard fail, and a weak conclusion earns feedback, not a lockout. It requires a *saved
  reviewed revision*, which is a different thing. Leave it alone.

### §SS12. Deferred-work items this story owns — the full list, with a recommendation each

Eighteen entries in `deferred-work.md` name **Story 4.3**. AC9 requires each to be struck or rewritten
with a named owner. Line numbers are as of `4b2b60f` and will drift; match on the text.

| # | Item | Recommendation |
|---|---|---|
| 226 | `reduceRecordRun` re-derives the result only for a run carrying `modelInputs` | Re-own → **Story 5.1**. A third model makes it load-bearing; closing it needs the session values the `run.record` action does not carry |
| 227 | `experiment.wavelengthNm` authored, validated, read by nothing | Re-own → **one spec story** with 228 and 323 |
| 228 | The persisted `450 \| 550 \| 650` unions and the two minimum-mode `550` literals | Re-own → same spec story. Needs a record migration: HALT here |
| 263 | `CaseRecordPrintView` has no unit coverage | Re-own → same or its own spec story, applying `SourceRightsLedger.ts`'s pure/mount split, which needs no new dependency |
| 271 | `citation.reuseStatement` authored everywhere, rendered nowhere | Re-own, with §SS9's reasoning recorded. Do not render it here |
| 279 | The bounded conclusion, the overclaim refusal, the debrief's revision feedback | **Close.** These are this story's ACs |
| 293 | `walkToDebrief` reaches Young's debrief only | **Close** — AC4/Task 5 |
| 294 | The debrief comparison band's height margin is exhausted | **Close** — AC5/Task 6. Either the band grows or the content is authored down; record which |
| 295 | `isCampaignCase` / `isCampaignCaseUnlocked` called by nothing | Re-own → **campaign-navigation spec story**, with 296 and 297 |
| 296 | A completed campaign case becomes unreachable once the boot target advances | Re-own → same. This is the one with real player cost: this case's own debrief, replay and export go out of reach the moment it is finished |
| 297 | No e2e walks the campaign progression end to end | Re-own → same |
| 304 | `experimentModelVersion`'s unconditional equality: no model bump without discarding player work | Re-own → **Story 5.1** with 226 |
| 306 | The reference shelf truncates one control earlier behind a maximum-length hint | Re-own → **one spec story** with 331 |
| 311 | The wavelength chooser's band is reserved on a case that draws nothing there | **Close by re-statement.** A conservative reserve cannot cause the overlap defect the sweep exists to catch; say that at the constant and strike the row |
| 323 | Six French interface strings write an ASCII space before `nm` | Re-own → the spec story with 227/228 |
| 330 | Young's `observe-two-runs` and `inspect-young-source` consultations are unreachable | Re-own → **Story 7.1**. Authoring plus a Young version bump and its allowlist clause |
| 331 | AC2's reference-shelf clause has no test on either case | Re-own → the spec story with 306 |
| — | Anything this story opens | Give it a named owner in the same commit |

Items this story will likely open, each needing a named owner:

- Whatever the peer-review pane's band cannot hold in French, if AC5's measurement says it cannot.
- Young's `conclusion-universal-optics` — the same unreachable-overreach shape as §SS3, on the other
  case. Record it; do not fix it here.
- The dead French half of every `overreachPhrases` list, if D1 leaves it dead.

### §SS13. Lessons from 3.1–4.2 that apply directly here

- **Author a case field that nothing reads and you have shipped dead content.** You are about to close
  one instance (`peer-overreach`) and you must not open another. Every phrase you leave in the union
  should be reachable by something, or annotated as deliberately not.
- **A comment claiming a guarantee is not a guarantee.** Sixth story running as of 4.2's review, which
  found four docstrings naming test files that do not exist and two citing stale line numbers. Before
  you write "still refused" or "confirmed by eye", break the guard or take the screenshot.
- **A test that cannot fail reads as coverage.** 4.2's review found **nine** assertions that could not
  fail, including a third `expect(x).toBe(x)` in a story that reported removing two. Every overreach
  assertion in this suite is currently a fixture testing itself.
- **When two code paths answer the same question, change them together.** `evaluatePeerReview` is called
  from `reducePeerReviewRequest` **and** from `validateCaseRecordForDefinition`'s recomputation walk.
  Any change to detection changes both. Grep before you edit.
- **A version bump and its record allowlist are one action.** Story 3.4's severest finding.
- **Take the measurement, not the arithmetic.** 2.11 shipped sixteen instances of text drawn into a
  reserve too small to hold it under 1125 green tests, because `sceneSlice` reports `height: 18`.
- **Screenshot before you claim a rendering surface is done** — and give the capture an address. 4.2's
  review found nine screenshots with no route to re-take them and committed a capture spec in answer.
  `young-canvas-experiment.spec.ts`'s "AC1 by eye" describe block is the pattern.
- **Settle the open layout question in a browser rather than deferring it.** 4.2 did, and found a real
  regression at a length the shipped case authors.

### §SS13b. What Story 4.2 and its review changed under you

Concrete deltas landed at `4b2b60f` that this story will meet. None is a surprise if you know it.

- **`public/cases/morley-miller/case.json` is at 1.6.0**, with an allowlist clause accepting 1.0.0
  through 1.5.0 (and `recordNamesRetiredArtifact` carried forward for the older ones). Your bump starts
  from there, and the clause you add must keep that predicate for the versions it also accepts.
- **`public/sw.js` is at `quantique-bootstrap-v15`.** Three of the last four bumps landed in a *review*
  commit rather than the dev commit. Do better.
- **`sceneSlice` now records `setOrigin`**, plus Graphics draw commands, tween configs and
  `killTweensOf` targets. It still reports a constant `height: 18` per text object and approximates
  width as `length * 7` — that gap is the standing top harness item, and it is exactly why AC5 is a
  by-eye AC.
- **`formatMeasurement`'s separator is now decided by the unit**, not by the locale alone, and the
  degree class is classified *and refused at load* by codepoint (U+00BA and U+02DA are rejected). If you
  author a degree or a temperature into any new string, it goes through the formatter.
- **The typography sweep's `SAMPLE_PARAMS` now holds one parameter set per case** and the debrief and
  consultation prose are measured — the extension you are building on.
- **A capture spec is committed** (`young-canvas-experiment.spec.ts`, "AC1 by eye"). Copy its shape:
  `test.use({ viewport, locale })`, drive the real state, `testInfo.outputPath`, attach, and
  `console.log` the path so a reader can go and look.
- **`ApparatusNotesRenderer` gained a bilingual overflow notice** instead of silently dropping authored
  prose. That is the pattern for any band you find cannot hold its content: raise a localized notice,
  do not swallow it, and do not let a heading paint over the way out.
- **One AC1 layout exception was accepted on Alexis's call**: the reference shelf loses a control behind
  a maximum-length hint. It is recorded at `NOTES_CONTROL_Y` and is deferred-work item 306 — out of
  scope here (§SS1), and not something to re-litigate.

### §SS14. Recent work, and the dependency posture

**Baseline is `4b2b60f` ("Review 4.2").** The rhythm is three commits per story — `Story N`, `Dev N`,
`Review N` — so this story's dev commit lands on a reviewed tree.

`4b2b60f` is worth reading for its shape: ~35 files, more than half of them tests, `case.json`
`sw.js`, `deferred-work.md` and `sprint-status.yaml` all moving with the work. Across 3.2 → 4.1 `sw.js`
moved in three consecutive *review* commits, which is the bump rule being applied late three times.
Apply it in the dev commit.

**No dependency changes.** Phaser 4.2.1, TypeScript ~5.7.2 with `target`/`lib` **ES2020 deliberately**
(`.at()` and `Object.hasOwn` are unavailable — write `[length - 1]`), Vite 8.1.5, Zod 4.4.3, `idb`
8.0.3, Vitest 4.1.10, Playwright 1.61.1 with `playwright-core` held by an `overrides` entry. Every
version is pinned by a committed lockfile with a stated reason. This story needs nothing new: it is
authored JSON, one or two domain predicates, comments that stop lying, e2e helper parameters, and
tests. If you reach for a package, stop and say why.

**On version currency.** Nothing this story touches is version-sensitive: the work is pure TypeScript
predicates, `LocalizedText` JSON, Playwright helper signatures and Vitest assertions — no new engine
API, no new Zod construct, no new browser capability. So there is no upgrade to research and no
migration to plan, and the two version facts that *do* constrain you are already stated: the **ES2020**
`target`/`lib` (so no `.at()`, no `Object.hasOwn` — that trade has been considered and lost twice), and
`tsconfig.test.json` declaring no `@types/node` (so read shipped cases through
`tests/unit/shippedCases.ts`, never with your own `readFile`). Do not upgrade anything as a side effect
of this story; a dependency bump is its own change with its own gates.

### Project Structure Notes

| Deliverable | Path | Rule that decides it |
|---|---|---|
| Overreach detection / peer-review evaluation | `src/domain/review/peerReviewRules.ts` (UPDATE) | `src/domain/` is pure TypeScript — no Phaser, DOM, fetch, IndexedDB, **and no Zod** |
| Readiness requirements incl. `limitation` | `src/domain/theory/conclusionReadiness.ts` (UPDATE, comments at minimum) | Same. The evaluator is the sole completion authority (ADR-006) |
| Defensibility predicates | `src/domain/theory/conclusionProposals.ts` (read; change only if D2 demands it) | Same |
| Rival-lab critique selection | `src/domain/review/rivalLabRules.ts` (read) | Stable ids, never prose |
| Recognition derivation | `src/domain/recognition/recognitionRules.ts` (read; test) | Pure. `calibrated-conclusion` reads `feedback.issues.length === 0`, so AC1 changes its outcome — assert it, do not edit it |
| Record compatibility + recomputation | `src/schemas/CaseRecordSchema.ts` (UPDATE) | Every Zod object `.strict()`. Allowlist scoped by case id; keep it honest rather than widening it |
| Case content | `public/cases/morley-miller/case.json` (UPDATE) | **Edit only `public/cases/…`** — `dist/`, `dist-subpath/` and `.claude/worktrees/**` are build output or stale copies |
| Service-worker bump | `public/sw.js` (UPDATE) | Same commit as the content change, reason appended to the header list |
| Peer-review / consultation pane | `src/adapters/phaser/renderers/CaseFilePresenter.ts` (UPDATE if AC5 moves a band) | Renderer contract: `create()` / `render(state)` / `destroy()`. Never author player-facing copy in `create()` |
| Case-file band geometry | `src/adapters/phaser/renderers/caseFileGeometry.ts` (UPDATE if AC5 moves a band) | Geometry/painting split — a spec deriving a coordinate reads the numbers |
| Debrief geometry | `src/adapters/phaser/scenes/debriefGeometry.ts` (UPDATE — at minimum the comparison-band docstring) | Same |
| Debrief painting | `src/adapters/phaser/renderers/DebriefRenderer.ts` (read; UPDATE only if a band moves) | Renderer contract; owns every display object, tween, timer and listener it creates |
| Display projections | `src/core/store/selectors.ts` (read) | `selectLocalizedPeerReview` resolves `ruleId`; `selectLocalizedDebrief` cites `historicalComparison.sourceIds` |
| Interface strings | `src/core/i18n/locales/{en,fr}.ts` | Interface strings go through `translate` / `createTranslator`; authored prose is `LocalizedText` via `resolveLocalizedText` |
| Printable record | `src/ui/print/CaseRecordPrintView.ts` (read / bilingual check) | ADR-007's sole non-Phaser surface; `src/ui/` holds exactly three modules and must not gain a fourth |
| Unit tests | `tests/unit/` — extend `ReviewRules.test.ts`, `ConclusionProposals.test.ts`, `MorleyMillerPrototype.test.ts`, `DebriefGeometry.test.ts`, `CaseFileGeometry.test.ts` | Pure logic, Vitest, shipped cases through `tests/unit/shippedCases.ts` |
| Integration tests | `tests/integration/` — `ReviewFlow.test.ts`, `RivalLabCritique.test.ts`, `ConclusionSupport.test.ts`, `DebriefSurface.test.ts` | Store-level, no browser |
| E2E | `tests/e2e/canvasHelpers.ts`, `debrief-replay.spec.ts`, `morley-miller-prototype.spec.ts`, `french-typography.spec.ts` | Extend; do not add a parallel walk |
| Case review artifact | `docs/case-reviews/morley-miller-case-review.md` §4 and §6 | Story 4.1 created it; 4.2 updated §3 and §6 |

**Naming:** `PascalCase` for classes and their files; `camelCase` for non-class modules, functions,
properties and JSON fields; `UPPER_SNAKE_CASE` for constants; `kebab-case` for case ids, assets and
experiment model ids. Domain events `noun.verb`; typed actions `domain.verbPastTense`. Fallible
operations return `Result<T, ResultError>` rather than throwing; error codes resolve to localized copy.

**Do not create:** a `services/`/`managers/`/`helpers/` catch-all; a fourth module in `src/ui/`; a
case-rule registry or predicate plugin layer; a new scene or phase; a fifth conclusion proposal; a
second peer-review evaluator; a parallel debrief walk. And do not wire, extend or imitate
`src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` — orphaned Phaser-template leftovers
referenced nowhere. Real scenes live in `src/adapters/phaser/scenes/`; Phaser widgets in
`src/adapters/phaser/ui/`.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` revision 2.6 — the rules that bear on *this* story.
The file is governing; this is a pointer to the parts you will cross.

**Engine / surface (ADR-001 v1.1, ADR-009, ADR-011)**

- Phaser scenes own all interactive presentation. `src/ui/` holds exactly three modules; do not add a
  fourth. Phaser widgets live in `src/adapters/phaser/ui/`, which is not `src/ui/`.
- **Canvas completeness:** a feature is not done until the canvas can dispatch its intent. Grep for
  every dispatcher of every action this story touches. AC6 is this rule, applied.
- The store is authoritative: scenes read through selectors and write only typed actions. No scene→scene
  reach-in. The router obeys `scenarioScript` and never dispatches; scenes mirror the phase and never
  define, infer or advance it.
- Renderer contract: `create()` / `render(state)` / `destroy()`, owning every display object, tween,
  timer and listener. Never author player-facing copy in `create()` — it runs once and the locale can
  change. Honour `prefers-reduced-motion` in every animated renderer.
- **Narrow viewports suppress nothing.** Every affordance stays available at every width.
- Anything the DOM draws over the canvas is in a canvas screenshot — the entry notice is the live
  instance. A spec comparing canvas pixels must wait the overlay out and say so.

**Guided adventure and gating (ADR-006)**

- Everything is authored; nothing is freeform. Per-case invariants live in a refinement branched on
  `id`; a case's *physics* is a keyed lookup on `experiment.modelId`. Two mechanisms — do not mix them.
- Prediction and conclusion are each **1 of 4** colleague proposals. Schemas use `.length(4)`.
  Choosing sets both the proposal ID and the canonical text; a present ID must match its proposal's
  text. Choices are revisable — re-choosing must never fail on "already chosen".
- **Defensibility is evaluator/critique-only.** Never expose a proposal as "correct" up front, and never
  leak a defensibility field into a display projection.
- The evidence evaluator is the **sole completion authority**. Never hard-code completion in a scene or
  a dialogue branch.
- The rival lab is **narrative dressing, never a fail state** — no score, game-over or penalty — and he
  is not a member of `colleagues[]`.
- Consultations and hints point at missing evidence, a source, an observable or a test. They never
  supply the answer.
- **No hard-fail states, irreversible wrong choices, speed rewards, or rewards for overclaiming.**
- **No authored content may leave a gate unsatisfiable**, and a gate can be made unsatisfiable by
  *code* as well as by content. Ask it of every predicate you write.
- **A refused action always says why**, and the message survives until a real state change replaces it.
- Authored copy must not name a scene, phase or route (the `encodesPath` check).
- **When you relax or change a shape, find out what it was silently holding and re-state it** — and make
  the list explicit, ticking each one off.

**i18n (ADR-010, NFR19)**

- EN + FR from launch. Locale comes from the browser; there is **no player-facing language selector**.
- **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria.**
  Build the surface list by **grepping for the read**, not from the story's file list.
- Prose the player reads is `LocalizedText` via `resolveLocalizedText`; interface strings go through
  `translate` / `createTranslator`. Proper nouns stay plain strings.
- **Never compose a French phrase by joining a preposition or article to an authored label.**
- No webfont. Never give `locale` an optional `DEFAULT_LOCALE` fallback.
- Scientific values are canonical across locales; localize only for display.

**Organization**

- `src/domain/` is pure TypeScript — no Phaser, DOM, fetch, IndexedDB, **and no Zod**. `src/core/` holds
  the store, i18n, errors and `Result`. `src/schemas/` owns every Zod schema. `src/adapters/` owns all
  side effects. The dependency direction never reverses.
- Case definitions are immutable under `public/cases/`; player progress lives only in IndexedDB.
- Bump `CaseDefinition.version` on any contract change and keep the record-compatibility allowlist
  honest rather than widening it on the assumption that canonical strings are byte-identical.
- Never recalculate a saved historical run against a newer experiment model.
- Every Zod object `.strict()`. Fallible operations return `Result`.
- Case content carries the provenance and rights status of every historical asset and claim.
  `rightsStatus: 'reviewed'` asserts the material **is** public-domain.

**Testing**

- Unit-test all pure domain logic with Vitest; never require Phaser or a browser for scientific logic.
- **Break the guard and watch a named test go red.** The project's highest-yield practice.
- A test that cannot fail is worse than none. Name the change to `src/` that would break each assertion.
- Know what the structural harness cannot see: **text height** (`height: 18` for every text object),
  `measureText` as `length * 7`, permissive `setFontSize`/`setCrop`. Confirm layout by eye at 1280×720
  in both locales.
- Canvas text cannot be read from a spec — a string assertion belongs in a `sceneSlice`-driven unit test
  or in `french-typography.spec.ts`.
- The canvas walks are frame-timed and load-sensitive. Judge a failure on an idle machine.
- axe and manual a11y acceptance are no longer gates; keep the reduced-motion / no-flashing check, and
  do not delete the existing a11y specs.

**Platform and build**

- Static hosted web app; current desktop Chrome, Firefox, Safari, Edge. Offline reload is a release gate.
- **A schema change that makes an older cached response unparseable is an `sw.js` `CACHE_NAME` bump, in
  the same commit.** Currently `quantique-bootstrap-v15`.
- Two build outputs, both gitignored: `dist/` and `dist-subpath/`. Edit neither.
- All three CI workflows run `typecheck`, `test`, `build`, `test:e2e --workers=1`, in that order.
  `typecheck:tests` is deliberately not gated.
- Never expose a raw error to the player, and never log learner-entered conclusions by default (NFR18).

### References

Requirements and design:

- [Epic 4 and Story 4.3](../planning-artifacts/epics.md) — `epics.md`, "Epic 4: Morley–Miller tutorial case"
- FR13, FR15, FR16, FR19, FR24, FR25 and the FR coverage map — `epics.md` §Requirements Inventory
- NFR8 (no reward for overclaiming), NFR12, NFR18, NFR19, NFR20 — `epics.md` §NonFunctional Requirements
- UX-DR5 (agency preserved; never auto-solve) — `epics.md` §UX Design Requirements
- ADR-006, ADR-007, ADR-009, ADR-011 — [game-architecture.md](../../_bmad-output/game-architecture.md) §Architecture Decision Records
- The Evidence-to-Conclusion Gate pattern — `game-architecture.md` §Implementation Patterns

Governing rules:

- [project-context.md](../../_bmad-output/project-context.md) revision 2.6 — governing, read in full

Prior work on this case:

- [Story 4.2](4-2-thermal-drift-investigation-tutorial.md) — §SS1 scope table names this story as owner
  of the bounded conclusion, the overclaim refusal and the debrief's revision feedback
- [Story 4.1](4-1-morley-miller-historical-case-record.md) — §SS4 the 1907 anchor; the debrief's
  historical comparison and the campaign order
- [Story 3.2](3-2-reviewable-morley-miller-prototype.md) — the case's original authored content
- [Story 2.11](2-11-debrief-scene-and-replay.md) — the debrief scene, its bands, and its clamps
- [Story 2.3](2-3-young-synthesis-debrief-and-replay.md) — Young's equivalent of this story
- [deferred-work.md](deferred-work.md) — the eighteen entries AC9 covers
- [docs/case-reviews/morley-miller-case-review.md](../../docs/case-reviews/morley-miller-case-review.md)
  — §4 (bounded near-null) and §6 (residual gaps) are this story's to update

Source read while writing this story (verified, not inferred):

- `src/domain/review/peerReviewRules.ts` — `isApplicable`'s `overreach` branch and the union comment
- `src/domain/theory/conclusionReadiness.ts` — the `limitation` requirement
- `src/domain/theory/conclusionProposals.ts` — `unvaried-control-pinned` failing closed
- `src/domain/recognition/recognitionRules.ts` — `calibrated-conclusion`'s zero-issues condition
- `src/domain/review/ConsultationRule.ts` — the `missing-limitation` predicate
- `tests/unit/MorleyMillerFeedback.test.ts` — proves all four consultations reachable, including
  `consult-no-limitation`; do not rebuild what it already holds
- `tests/unit/ReviewRules.test.ts`, `tests/integration/ReviewFlow.test.ts` — every overreach assertion
  is a fixture rule containing its own fixture phrase
- `src/core/store/AppState.ts:537` — `theory.conclusion = proposal.claim.en`
- `src/core/store/AppState.ts` — `reduceTheoryReviewRequest`, `reducePeerReviewRequest`,
  `reduceRevisionSave`, `reduceTheoryConclusionSubmit`, `reduceDebriefComplete`
- `src/schemas/CaseRecordSchema.ts` — the `claim.en` comparison, the `evaluatePeerReview` recomputation,
  the prototype allowlist clauses through 1.6.0
- `src/core/store/selectors.ts` — `selectLocalizedPeerReview`, `selectLocalizedDebrief`
- `src/adapters/phaser/renderers/CaseFilePresenter.ts` — `renderPeerReview` and its clamp
- `src/adapters/phaser/renderers/caseFileGeometry.ts` — `CASE_FILE_ISSUES_HEIGHT` and the right column
- `src/adapters/phaser/scenes/debriefGeometry.ts` — `DEBRIEF_COMPARISON_BAND_HEIGHT` and its docstring
- `tests/e2e/canvasHelpers.ts` — `walkToTheBoard`, `walkToDebrief`, `pinTheSupport`, `closeTheCase`,
  `chooseProposalThroughColleague`
- `tests/e2e/french-typography.spec.ts` — `DEBRIEF_PROSE` and the absence of any peer-review sweep
- `public/cases/morley-miller/case.json` 1.6.0 and `public/cases/young-interference/case.json` 1.22.0

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Decisions taken before implementation (Task 1)

#### D1 — AC1, how the overclaim refusal is made to fire

_Record the choice from §SS4's three options, the record-safety argument, and the command that proves
it._

#### D2 — AC2, how the limitation requirement is resolved

_Record the choice from §SS5's two options and the test that holds it._

### Files read before writing (Task 1)

_For each UPDATE file: what it does today, what this story changes, what must not break._

### Debug Log References

### Completion Notes List

### Deferred-work triage (AC9)

_The eighteen rows of §SS12, each ticked closed or re-owned with a named owner._

### Mutation proofs

_Each guard broken, the named test observed red, the guard restored._

### By-eye captures (AC4, AC5, AC10)

_Four frames at 1280×720 — the debrief EN and FR, the peer-review pane EN and FR — with the spec and
the output path that re-takes each._

### File List

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-21 | 0.1 | Story context created — Epic 4's closing story | Context engine |

## Open Questions for Alexis

Not blocking. Answer at review time if you prefer.

1. **`conclude-ether-disproved`'s wording.** §SS4 recommends rewording the claim so it says the thing
   it is claiming, rather than widening the phrase set around a claim that avoids saying it. It is your
   content and your teaching; if you would rather the claim stayed as written and the phrase set grew,
   say so and the dev takes option B.
2. **The limitation requirement.** §SS5 recommends re-stating its scope rather than teaching it to read
   "None offered." as a declared absence. The second is buildable; it costs another
   persisted-recomputation seam for content that `supportPredicate: never` already marks.
3. **The campaign-navigation items (295–297).** Once this case is finished, `/` resolves to Young and
   this case's debrief, replay and record export are unreachable — there is no picker and `?case=` is a
   reviewer route. This story re-owns it to a spec story rather than adding a surface inside an
   epic-closing story. Confirm that is the call you want, or say the word and it becomes an AC here.
4. **The ledger stays BLOCKED.** The scholarly reviewer and the educator context sheet are still
   unassigned, which is the two rows that hold it. Unchanged by this story, and still yours.
5. **Young's `conclusion-universal-optics`** has the same unreachable-overreach shape as §SS3, on the
   validated case. Out of scope here and recorded. Worth a story of its own before release?

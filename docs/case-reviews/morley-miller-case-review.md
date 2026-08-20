# Morley–Miller — pre-production case review

**Case:** `morley-miller` · content `1.4.0` · reviewed at Story 4.1 (2026-08-20)
**Reviewer-readable artifact for Epic 4, Story 4.1, AC5.** Every claim below names the authored field
that carries it, so a reviewer can check it rather than take it.

**Verdict: the loop is complete and traceable; the case is not releasable.**
`evaluateLedgerReleaseApproval` resolves `morley-miller` to **BLOCKED** on `scholarly-review-pending`
and `educator-context-sheet-pending`, and that is the correct verdict — two roles nobody has been
assigned to. §6 lists every residual gap with its owner. A review artifact that reported a green case
would be the defect the ledger exists to prevent.

This does **not** supersede [`docs/case-prototypes/morley-miller-prototype.md`](../case-prototypes/morley-miller-prototype.md),
which is Story 3.2's *authoring* review — how the case was written and what the framework had to grow to
carry it. This is the *case* review: whether the loop the epic requires is actually there.

---

## 1. The full loop, clause by clause

Epic 4 AC requires `context → prediction → experiment → synthesis → review → debrief`, an opening
dispute, the Curated Record, lab setup, **two-to-four cycles**, a theory-board conclusion, a historical
debrief, and optional replay.

| AC5 clause | Authored where | Verified how |
|---|---|---|
| Six phases, in order | `scenarioScript.scenes[].phase` — six scenes; `CASE_PHASES`; ADR-009 | `SceneRouter` obeys the authored map and never infers a phase. `scene-router.spec.ts` walks the sequence; `morley-miller-prototype.spec.ts` walks this case from the review route to the conclusion choice. |
| Opening dispute | `openingDispute`, `flow.openingDispute: true` | Rendered before the record; the prose states the question as a question ("Was there nothing to find, or was something else in the way?"), not as a result. |
| Curated Record | `contextualArtifacts[]` (two), `flow.curatedRecord: true` | Both artifacts readable, bilingual, cited, archived. §2. |
| Lab setup | `apparatus.primaryControls[]` — `rotationDeg` (`dial`), `bathTempC` (`slider`); `flow.labSetup: true` | Story 3.4's direct-manipulation instruments; `morley-miller-prototype.spec.ts` records an observation by dragging the slider. |
| **Two-to-four cycles** | `flow.minimumExperimentCycles: 2`, `flow.maximumExperimentCycles: 4` | Corrected by this story from `2/6`, which was out of spec against FR25 and the epic AC. Pinned by a `MORLEY_MILLER_CASE_ID` branch in `CaseDefinitionSchema`'s `superRefine`. **See the caveat in §3 — this is a contract correction, not a behavioural cap.** |
| Theory-board conclusion | `conclusionProposals[]` (`.length(4)`), `requirements.minimumSignificantRuns: 2`, `significanceRule`, `flow.theoryBoardReview: true` | The evaluator is the sole completion authority (ADR-006). Walked to the debrief by eye for this review, both locales. |
| Historical debrief | `debrief.summary`, `debrief.historicalComparison`, `debrief.deeperTheory`, `flow.historicalDebrief: true` | §4. Verified rendered and uncropped at 1280×720 in EN and FR. |
| Optional replay | `debrief.replayLabel`, `flow.optionalReplay: true`, `replay.isCounterfactual` | The label reads as a counterfactual warning in both locales, and is never the control's own label (`advance.replay` is). |
| Confound | `experiment.confound` — `thermal-drift`, `discoverableBy: 'replication'` | Named by the 1907 source itself: *"The temperature effects could never be entirely eliminated."* |
| Reset-solvable path | `experiment.resetPath` — `recoveryRoute: 'replication'` | `bathTempC` is in `significanceRule.criticalControlIds`, so the pair the reset path teaches is not refused as one configuration (Story 3.2 review). |
| Model assumptions | `experiment.assumptions` — three, bilingual | Equal-length arms, reading taken at a fixed position of the turn, bath temperature standing for every thermal difference. |
| Counterfactual labels | `debrief.replayLabel`; `print.completion.text`; `error.replay-unavailable`; `AppState.startReplay` | |
| History-preserving campaign replay | `AppState.ts` — a counterfactual replay keeps the saved `completion` snapshot and clears the live selection; `CaseRecordSchema` states the snapshot's shape | |
| **Campaign lock order** | `src/domain/cases/campaignOrder.ts` (new) | §5. |

---

## 2. The record, and what it now claims

Two artifacts, which is the ceiling: `MAX_CONTEXTUAL_ARTIFACTS = 2`, and its docstring states the cost
of a third — it would be readable, would count toward the reading gate, and could never be pinned as
supporting evidence. Raising it is renderer work across three surfaces, each of which reserves rows
(`caseFileGeometry`, `libraryGeometry`, `debriefGeometry`), and `ApparatusGeometry.test.ts` asserts the
ceiling against the real geometry so the bound and its justification fail together.

### 2.1 `michelson-morley-1887` — primary, and now genuinely verified

`published-book` / `primary-material`, `rightsStatus: 'reviewed'`, `ledgerEntry.reviewerState: 'pending'`.
Michelson & Morley (1887), *American Journal of Science* 34(203), 333–345.

Story 4.1 checked the excerpts against a facsimile of the exact cited issue — the Internet Archive scan
`sim_american-journal-of-science_1887-11_34_203` — read against its printed running heads. **The check
was owed rather than a formality: it found three divergences.**

1. The opening section's second paragraph was a **paraphrase**, not a transcription. It dropped
   *"in view of the experiments just cited"*, changed *"the motion of the earth in its orbit"* to
   *"the motion of the particles of the body"* — a change of meaning, not of wording — and stopped
   before the sentence's second half. Now verbatim.
2. The concluding excerpt had lost the source's commas: *"It appears, from all that precedes,
   reasonably certain…"*. Restored, with the printed apostrophe in *Fresnel's*.
3. The opening section spans **two** printed pages. Its first paragraph is on 333, its second on
   **334** — the running head for 334 falls between them. `sourcePages` is now `[333, 334]` and the leaf
   says so. **341 was correct** and is now verified rather than assumed.

The French renditions were re-translated against the corrected English. `citation.reuseStatement`
records the verification in both locales.

*What is still open for the scholarly reviewer is the **reading** — whether these are the right excerpts,
fairly framed — not the wording or the pages.*

### 2.2 `morley-miller-1907-final-report` — re-anchored by this story

`published-book` / `primary-material`, `rightsStatus: 'reviewed'`, `ledgerEntry.reviewerState: 'pending'`.
Morley, E. W., & Miller, D. C. (1907). *Final Report on Ether-drift Experiments.* **Science**, New
Series, Vol. XXV, p. 525 (April 5, 1907). Public domain (published before 1931).

This slot previously held `morley-miller-1905-reconstruction` — editorial prose *about* a 1905 report.
Story 3.2's review had renamed that artifact from 1907 to 1905 because the citation was genuinely 1905,
which was the right call on the evidence then available. The resolution is not to reinstate a 1907 title
over a 1905 citation but to use the **real 1907 report**, which the GDD names twice
(`gdd.md:121`, `decision-log.md:18`) and which the epic AC names directly. It earns the slot four ways:

1. **It is one paragraph and public domain**, so a genuine `kind: 'transcription'` of `primary-material`
   is available — the reconstruction workaround is no longer forced. Transcribed in full.
2. **It supplies the bounded-null distinction in the authors' own words** (§4).
3. **It names the confound the case teaches** — *"satisfactory observations could only be made on a
   cloudy evening following a cloudy day… The temperature effects could never be entirely eliminated."*
4. **It explains the rival lab** — the apparatus was *"mounted on high ground near Cleveland"*, and the
   case's rival lab is already "The Cleveland bench".

**One citation discrepancy, recorded rather than averaged.** The archive page renders the issue as
*"No. 2"* and the date as April 5, 1907; the commonly cited form is *Science* 25(641), 12 April 1907.
`citationText` carries only what the linked page states — volume XXV, page 525, April 5, 1907 — and
omits the issue number, because averaging two sources into a citation neither supports would be worse
than an incomplete one. **A reviewer should settle the issue number against a print copy.**

### 2.3 The rename swept to completion

Every reference moved: the artifact `id` and `displayName`, `provenance.reference`, `citationText` and
`archiveUrl`, the rendition section ids, `readingGateHints[].artifactId` and its line, both
`inspected-source` support predicates, the `consultationRules` `missing-source` predicate,
`debrief.sourceRefs`, and `debrief.historicalComparison` (title, text and `sourceIds`). `grep -rn 1905`
over `public/cases/morley-miller/case.json` returns nothing.

Two of the retained code comments still name 1905 **deliberately**, because they record *why* the
`reconstruction` rendition kind exists and 1905 is the case that motivated it
(`CaseDefinitionSchema.ts`, `resolveLocalizedText.ts`). Both now also say that no shipped case exercises
that kind any more.

**The risk this rename carried was silence, not failure.** A stale `sourceId` in an `inspected-source`
predicate never matches, so the headline conclusion would quietly stop being defensible with nothing
failing. It surfaced loudly instead: the store refuses an unknown `sourceId` outright, and the
prototype's own unit walk failed with `Refused source.inspected: unknown-source-id` until every
dispatch site moved.

---

## 3. Two-to-four cycles — and the field nothing reads

`flow.maximumExperimentCycles` went from **6** to **4**, and a `MORLEY_MILLER_CASE_ID` branch in
`CaseDefinitionSchema`'s top-level `superRefine` now pins `2`/`4` beside the existing Young branch. It is
a branch on `id` rather than a `z.literal` in the shared shape, because the shared contract holds only
what every case shares.

**State plainly: this change has no behavioural effect.** Nothing in `src/` reads either cycle field.
Two comments already say so — `caseFileGeometry.ts:40` ("the observation list is paged because nothing
caps `runs`") and `selectors.ts:410`, which records that an earlier version of its own comment wrongly
justified a cost with the cap. So this is a **content-and-contract correction** that brings the authored
value in line with FR25 and makes a load-time refinement enforce it for the next author; it does not cap
anything a player does.

That was the *"author a case field that nothing reads"* shape from the Don't-Miss table. It **predates
this story** and applies to Young equally, and it was recorded in `deferred-work.md` with **Story 4.2** as
candidate owner.

### Resolved by Story 4.2 (2026-08-20): advisory design metadata

**Nothing caps the player's runs, and nothing should.** Both fields are now documented as the authored
*session shape* FR25 and NFR14 size a 20–45 minute case around — two to four cycles of work — and not as a
runtime quota. The load-time refinement stays and is what makes them read fields rather than dead ones: it
refuses a range FR25 forbids, with the offending path named. A field read by a refinement that rejects
invalid content is read; a field read by nothing at all is not, and that distinction is stated at each of
the four sites so this entry can be struck honestly rather than re-opened by the next reader of the table.

The alternative was considered and it is a trap. A hard cap at `maximumExperimentCycles` would strand a
player who spends every cycle at **one** arrangement — which this case's own confound, `discoverableBy:
'replication'`, actively invites. `requirements.minimumSignificantRuns` is 2 and a significant measure is a
*distinct configuration*, so that player needs a third observation and cannot take one: nothing clears
`runs`, because `reduceApparatusReset` resets the controls and the wavelength and deliberately touches
nothing else — Story 2.2's shipped criterion is *"reset is immediate and does not erase saved
observations."* That is a gate made unsatisfiable **by code**, which `project-context.md` names as its own
rule with this exact case as the worked example, plus a collision with NFR8 (no hard fail) and FR23
(unlimited reset and comparison). Branch B is also reversible in a way Branch A is not.

Reconciled so that no comment contradicts the decision: the `flow` shape's own documentation in
`CaseDefinitionSchema.ts` (which carries the full reasoning), both case-id refinements,
`caseFileGeometry.ts`'s paging rationale, `selectors.ts`'s significant-measure-count docstring, and
`docs/content-authoring/README.md`, where an author actually meets it.

Deliberately **not** applied to the `morley-drift-bench` fixture, which carries `2/6` to prove the
shared shape is not Young's literal. Both directions are under test: the branch fires on this id
(`'fails the Morley–Miller cycle-range refinement the moment it claims to be Morley–Miller'`) and on
nothing else (`'leaves a case that is not Morley–Miller free to author its own cycle range'`). Both were
mutation-proved.

---

## 4. A bounded near-null, never a perfect zero

The case must state what displacement a stationary ether *demanded* and what fraction of it the
measurement could exclude, and must never present the result as a perfect zero, a disproof of the ether,
or proof of relativity. The 1907 report supplies both numbers in the authors' own words:

> *"The expected drift would produce a displacement of the interference fringes of 1.53 wave-lengths;
> the above result is probably certain to one eightieth part of the whole."*

Reachable in **both** required places, confirmed by eye at 1280×720 in English and French:

- **The curated record.** The transcription is one leaf of the reading-room book and renders in full,
  uncropped, in both locales — the sentence above is on the page the player reads. The artifact's
  `summary` states it again in plain words and ends *"A bound, not a perfect zero."*
  `caseRelationship` names it a third time, on the case file, the shelf and the debrief.
- **The debrief.** `historicalComparison.text` carries both numbers and closes *"The bound moved down,
  not to zero and not to a disproof."* `debrief.summary` states the residue is bounded rather than
  zero. `deeperTheory` already argued why a bounded null is worth having.

No `conclusionProposal`, `peerReviewRule` or `rivalLabCritique` was added or reworded — those are Story
4.3's ACs. `predict-nothing-at-all` still carries the perfect-zero *prediction*, deliberately: it is a
choice the player may make and be shown to be wrong about, which is the teaching.

**Two authored-content defects this review's own by-eye pass found, both fixed:**

- The 1907 leaf's heading wrapped to two lines and its second line **collided with** the printed-page
  line beneath it. `drawPage` places the heading at y=166 and the reference at y=195 — a fixed 29px gap
  that assumes a one-line heading. Heading shortened to fit one line. *Nothing automated could have
  caught this: `fitBodyText` shrinks to a floor and then overflows with no crop, and the unit harness
  reports a constant `height: 18` for every text object.*
- The debrief's comparison and summary prose overran their bands. `DEBRIEF_COMPARISON_BAND_HEIGHT` is
  sized for four lines at 14px across a 560px wrap (~315 characters) and the first draft was 477; the
  summary band is two lines at 16px (~140 characters) and the draft was 290. Both were authored down to
  fit the **stated reserve** rather than left to the renderer's shrink-then-crop clamp — a cropped
  sentence is not content the player reaches. *The prototype's summary was already over its reserve
  before this story at 222 characters; it is now 126.*

---

## 5. Campaign lock order

`src/domain/cases/campaignOrder.ts` — pure TypeScript, no Zod, no Phaser, no I/O:

```
CAMPAIGN_ORDER = [MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID]
```

**Morley–Miller precedes Young**, which is FR2's order and not the order the cases were built in — Young
was the first production slice *and* the validated one. The two ids are imported from
`CaseDefinitionSchema` rather than restated. Three code comments previously said this story owned the
decision (`resolveCaseId.ts`, `KNOWN_CASE_IDS`, `MorleyMillerPrototype.test.ts`); all now state what it
was.

**The campaign *order* is read by `src/`, not only by tests** — a `CAMPAIGN_ORDER` that only tests consume
would be the same shipped-and-dead shape as an unread case field. `resolveCaseId` resolves the campaign
entry, and `main.ts` builds the repository before resolving the case id so the completed set is
available. *Two of the module's five exports are **not** read by `src/`, and this section claimed
otherwise until the code review of 4.1: `isCampaignCase` and `isCampaignCaseUnlocked` are called only
from `CampaignOrder.test.ts`, so nothing gates **entry** to a locked case — `?case=` opens Young on a
fresh profile by design. Kept deliberately rather than gated inside a review, and recorded in §6 with
Story 4.3 as owner.* Three
routes, in precedence order:

1. **`?case=` — the reviewer route.** Allowlisted, and it outranks the campaign: a reviewer opening a
   case is not a player progressing through one.
2. **`?mode=validation` — the moderated route, which stays on Young** and is not campaign-gated. This is
   *not* a Young-shaped assumption left standing: `docs/validation/young-validation-plan.md` names this
   route as the entry point for validating *the Young laboratory* specifically, so a facilitator's
   existing link must keep opening Young. `?mode=validation&case=morley-miller` still works.
3. **The campaign entry** — the first case in order the player has not completed.

Completions come from `readCompletedCampaignCaseIds` (an adapter — `src/domain/` may not touch
IndexedDB): one `repository.load` per campaign case, because the repository is keyed by case id with no
enumeration and widening that boundary contract for a two-element list is not worth it. A record that
fails to load is **not** counted as a completion, which keeps the player at that case rather than routing
them past it on the strength of a record nothing could read.

AC6's three clauses are unit-tested against `CAMPAIGN_ORDER` rather than against repeated strings, and
each was mutation-proved (reversing the order, and flipping the unlock predicate's `every` to `some`).

**The boot default flipped, and that is a behavioural change.** `/` no longer means Young. About forty
e2e sites said `page.goto('/')` while asserting Young's content, and they were the Young-shaped
assumption the project's top Don't-Miss rule warns about; they now name the case through a
`gotoCase`/`caseRoute` helper. *(As shipped, `gotoCase` took `caseId: string = YOUNG_CASE` and all
seventeen converted sites passed nothing, so this sentence was false at every one of them and the
implicit-Young binding had merely moved into a default argument. The code review of 4.1 made the
parameter required and named Young at each site, and `canvasHelpers`' `YOUNG_CASE` now aliases the
exported `YOUNG_CASE_ID` instead of restating the literal.)* The sites that assert *boot* behaviour — the boot frame, the three
locale-resolution tests, subpath hosting, the moderated route — deliberately stay at the root, because
the root is what they are about.

Two consequences the flip surfaced, which is the argument for having made it:

- `offline-reload.spec.ts`'s progress walk waits on **Thea's portrait**, a Young asset a Morley–Miller
  boot never fetches. Its warm-up now names the case.
- `subpath-hosting.spec.ts` asserted a hand-copied list of Young's five portraits against
  `page.goto(SUBPATH)`. It now reads each case's **own** manifest and sweeps `KNOWN_CASE_IDS`, plus one
  test that the *campaign entry* resolves under the deploy subpath — which is what a real visitor to the
  published site actually loads, and which nothing checked before.

**Until Story 4.2 re-skins the bench, a fresh boot shows Morley–Miller on Young's optical bench.** That
window is inside this epic, and the case is ledger-BLOCKED so it cannot reach a player either way.

---

## 6. Residual gaps, each with an owner

| Gap | Owner |
|---|---|
| ~~The bench artwork is Young's — light source, slits, barrier~~ **CLOSED by Story 4.2** — `InterferometerTableau` draws a stone floating in a temperature bath, carrying a splitter, two perpendicular arms with end mirrors and the recombined path to the observing screen. Rotation bound to `rotationDeg`, bath colour to `bathTempC`, `Graphics` fills only, no asset and no ledger row. The `hasOpticalGeometry` duck-type guard is deleted; artwork is now keyed on `experiment.modelId` through an exhaustive record | — |
| ~~The model constants are invented and say so; not calibrated against the 1907 numbers~~ **ADDRESSED by Story 4.2, and the values did not move.** The two published figures are named constants (1.53 wave-lengths; one eightieth), and `ORIENTATION_AMPLITUDE` is now asserted to lie *inside* the published residual bound — the historical-honesty property, executable. Deriving it exactly would change every recorded value, which needs an `experiment.modelVersion` bump, and a bump refuses every saved record outright (see the new deferred item) | — |
| ~~`formatMeasurement` writes a separator before every unit~~ **CLOSED by Story 4.2** — the separator is a function of `(locale, unit)`: none before an arc degree, U+202F before a symbol, U+00A0 before a spelled-out unit. Young's four units are byte-identical | — |
| ~~`flow.minimumExperimentCycles` / `maximumExperimentCycles` are read by nothing (§3)~~ **CLOSED by Story 4.2** — advisory design metadata, decided and documented at four sites. See §3 | — |
| ~~The thermal-drift teaching loop, stable-window replication, feedback directing to replication~~ **CLOSED by Story 4.2** — separability asserted on recorded results rather than on the formula; the stable window named in the authored `resetPath` prose in both locales *and* rung on the bath in-fiction; a new `missing-replication` consultation predicate closes the gap where the case taught a recovery route it never mentioned | — |
| **Two of the four shipped `consultationRules` could never fire** — found by Story 4.2 and repurposed rather than deleted. `consult-no-runs` asked `runs.length < 2` where the case file is only reachable past a gate requiring two significant measures; `consult-unread-report` asked for an unread source where `minimumSources` equals the authored artifact count. Every branch is now reachable and proven so against the real store | — |
| **FR18's three fields reached no player surface** — `experiment.assumptions`, `confound.description` and `resetPath.description` were authored on both cases, schema-validated, and rendered by nothing, while §1 of this document listed all three as satisfied. Closed by Story 4.2's apparatus-notes surface; §1's table is true about the player now, not only about the authoring | — |
| The bounded conclusion, the overclaim refusal, the debrief's revision feedback | **Story 4.3** |
| `citation.reuseStatement` is authored in both locales for every artifact and rendered nowhere — and §2.1 below offers it as the record of the 1887 verification, so that record reaches no surface | **Story 4.3** |
| `debrief.sourceRefs` is validated only as non-empty strings and read by nothing; its `provenance.reference` vocabulary now collides with the 1907 artifact's own id, so an author confusing the two vocabularies gets silence from both | **Epic 5's first story** |
| No shipped case exercises the `reconstruction` rendition kind any more | **Epic 5's first story** |
| The unit harness cannot see text height, so no "the text fits" claim can be automated | unassigned |
| **`isCampaignCase` and `isCampaignCaseUnlocked` are exported, unit-tested, and called by nothing in `src/`** — the campaign *order* is read (`resolveCaseId.ts:42`) and the boot default resolves through it, so AC6's three `Then` clauses hold, but nothing gates entry: `?case=` opens a locked case by design, and that bypass is deliberate. Kept by review decision rather than gated inside a review | **Story 4.3** |
| **A completed campaign case becomes unreachable once the boot target advances** — no picker, and `?case=` has no in-game surface, so the finished case's debrief, optional replay and record export cannot be reached | **Story 4.3** |
| The 1907 citation's issue number (archive says "No. 2"; commonly cited as 641) | the scholarly reviewer |
| **The scholarly reviewer is unassigned** | **Alexis** |
| **The educator context sheet is unassigned** | **Alexis** |

The last two are why the ledger says **BLOCKED**, and this story deliberately authored no name to clear
a row: a name nobody supplied is exactly the defect the ledger exists to prevent. Scholarly sign-off is
a person, not a patch.

**Owners assigned by the code review of 4.1** (2026-08-20), replacing four `unassigned` rows: AC10 and
§SS12 require a named owner story and reject "unassigned" and "Epic 4". They are split by nature —
navigation and rendering residuals to **Story 4.3**, which closes the epic; contract traps to **Epic 5's
first story**, where the next case's author is who the trap actually catches. The two new rows are that
review's own findings.

---

## 7. Verification behind this review

- `npm run typecheck` clean · `npm test` 1523+ passing · `npm run build` and `npm run build:subpath`
  succeed · `npm run test:e2e` passing on an idle machine.
- `npm run typecheck:tests` **106 errors across 60 files**, down from 114/60. Not gated, and the count
  may only go down.
- `npm run audit:ledger` re-run; both generated `morley-miller-ledger.{en,fr}.md` files match the
  authored `ledger` block and both report **BLOCKED**.
- `public/sw.js` `CACHE_NAME` bumped to `quantique-bootstrap-v12` in the same commit, with its reason
  appended to the header list. This change fails in **both** directions, which is stated there.
- `CaseRecordSchema`'s prototype clause for `1.4.0` deliberately lists **no** prior version, because the
  artifact id moved and a saved record holds it. That exclusion is asserted by name in
  `MorleyMillerPrototype.test.ts` so it is a decision under test rather than an absence.
- Every guard whose failure would be silent was mutation-proved; the proofs are recorded in the story's
  Dev Agent Record.
- Layout confirmed **by eye at 1280×720 in both locales** — the reading room, both book leaves, the
  detail panel, the case file, and the debrief — because the harness cannot see text height. Two defects
  were found that way and fixed (§4).

---
epic: 4
story: 1
key: 4-1-morley-miller-historical-case-record
status: review
created: 2026-08-20
baseline: 62b65b2
baseline_commit: d657713fbe2d641c961746f779667962efa0860e
inputs:
  - _bmad-output/planning-artifacts/epics.md §Epic 4 / Story 4.1
  - _bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md §Case slices, §decision-log 0.3
  - _bmad-output/project-context.md revision 2.6
  - _bmad-output/game-architecture.md v1.2
  - _bmad-output/implementation-artifacts/3-4-scenario-and-proposal-authoring-contract.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - docs/case-prototypes/morley-miller-prototype.md
---

# Story 4.1: Morley–Miller historical case record

Status: review

## Story

As a player,
I want to inspect the Morley–Miller dispute and its sourced record,
so that I understand the question before I interpret an instrument reading.

## Acceptance Criteria

### AC1 — The secondary artifact is the 1907 final report, anchored to a verifiable citation

**Given** the Morley–Miller case,
**When** I enter its context phase,
**Then** its second contextual artifact is the **1907 Morley–Miller final report**, not the 1905 report the prototype shipped,
**And** its `citationText` and `archiveUrl` name a real, public-domain, reachable source,
**And** every authored string, id, `provenance.reference`, `readingGateHints[].artifactId`, `supportPredicate.sourceId`, `debrief.sourceRefs` and `debrief.historicalComparison.sourceIds` that referred to 1905 refers to the new anchor with no stale survivor (§SS4 has the complete enumeration).

### AC2 — The 1887 excerpts are either verified or honestly de-claimed

**Given** the 1887 artifact's rendition of record is authored `kind: 'transcription'` and its sections carry printed `sourcePages`,
**When** the case is reviewed,
**Then** each excerpt's wording matches the archived text it claims to transcribe **verbatim, punctuation included**,
**And** each section's `sourcePages` value is either verified against a facsimile or replaced with a page attribution that the cited source itself supports,
**And** `deferred-work.md:217` and `deferred-work.md:247` are struck or restated with what actually remains unverified — not silently carried forward.

### AC3 — The record distinguishes a bounded near-null from a claim of perfect zero

**Given** the curated record and the debrief,
**When** I read them,
**Then** the case states what displacement a stationary ether *demanded* and what fraction of it the measurement could exclude,
**And** it never represents the result as a perfectly zero reading, a disproof of the ether, or proof of relativity,
**And** the distinction is legible in authored content the player actually reaches — not only in a comment or in this story.

### AC4 — Provenance labels reach the player on every context surface

**Given** the case's two artifacts,
**When** I meet them in the reading room, on the case file, and in the debrief,
**Then** each shows its provenance category and source type as prose in the active locale,
**And** the reconstruction is never presented as a transcription of the original.

_This is a verification AC, not a build AC. `LibraryRenderer`, `CaseFilePresenter` and `DebriefRenderer` already render `source.provenanceName.*`; confirm the re-anchored artifact still resolves through all three rather than adding a surface._

### AC5 — The case loop is reviewed against the epic's full-loop requirement before production

**Given** the Morley–Miller case loop,
**When** it is reviewed before production,
**Then** it requires `context → prediction → experiment → synthesis → review → debrief`, opening dispute, Curated Record, lab setup, **two-to-four cycles**, theory-board conclusion, historical debrief, and optional replay,
**And** its confound, reset-solvable path, model assumptions, counterfactual labels, and history-preserving campaign replay are each explicit and each traceable to the authored field that carries it,
**And** the review is a named artifact a reviewer can read (§SS7).

_`flow.maximumExperimentCycles` ships at **6** and the epic AC and FR25 both say two-to-four. See §SS6._

### AC6 — Campaign lock order is declared, enforced, and read

**Given** campaign progression,
**When** the first campaign case is unlocked,
**Then** Morley–Miller precedes Young even though Young was the first production and validation slice,
**And** completing or validating Young never changes that campaign lock order,
**And** the order lives in exactly one pure module that the boot path reads — not a comment, not a constant nothing consumes.

### AC7 — The prototype's authored prose is measured by the French typography sweep

**Given** `tests/e2e/french-typography.spec.ts`,
**When** it sweeps longest-string samples,
**Then** it draws them from **every** shipped case rather than from `young-interference` alone,
**And** the samples cover the surfaces the prototype's own review found overflowing: source names, control labels and inline labels, colleague names, prediction texts, conclusion claims and limitations, dialogue beats, colleague hints, reading-gate lines, rival-lab critiques, and the debrief prose,
**And** a deliberately over-long authored French string in the prototype makes the sweep fail (mutation-proved).

### AC8 — Bilingual from the start

**Given** every string this story adds or changes,
**When** the case is validated at load,
**Then** each carries both `en` and `fr`,
**And** localized lists carry equal lengths across locales,
**And** the generated ledger renders in both languages.

### AC9 — Contract, version and cache hygiene

**Given** the case content changes,
**When** the change is committed,
**Then** `public/cases/morley-miller/case.json` `version` is bumped,
**And** `CaseRecordSchema`'s prototype clause gains a clause for the new version listing every prior version it accepts,
**And** `public/sw.js` `CACHE_NAME` is bumped in the same commit with its reason appended to the header list,
**And** `npm run audit:ledger` is re-run so both generated ledger files match the authored `ledger` block.

### AC10 — Verification

**Given** the story is complete,
**When** the gates are run,
**Then** `npm run typecheck` is clean, `npm test` passes, `npm run build` succeeds, and `npm run test:e2e` passes on an idle machine,
**And** `npm run typecheck:tests` is at or below **114 errors across 60 files**,
**And** every guard whose failure would be silent is mutation-proved: broken, its named test observed red, restored, and the proof recorded,
**And** `deferred-work.md` items this story closes are struck and items it opens are recorded with a named owner story.

## Tasks / Subtasks

- [x] **Task 1 — Read the governing rules and the code you are about to change** (blocks everything)
  - [x] Read `_bmad-output/project-context.md` in full. It is revision 2.6 and it is governing. §Project Context Rules below is a pointer, not a substitute.
  - [x] Read `docs/case-prototypes/morley-miller-prototype.md` — especially §4 (provenance), §8 (the gap list) and the code-review section at the foot.
  - [x] Read `public/cases/morley-miller/case.json` end to end. It is 38 KB and every clause you touch has a sibling that references it by id.
  - [x] Read `src/schemas/CaseDefinitionSchema.ts` lines 25–100 (the case-id constants and the two `MAX_*` ceilings) and 337–420 (the rendition schema and its four refinements).
  - [x] Read `src/adapters/content/resolveCaseId.ts` in full — 24 lines, and its docstring names this story.

- [x] **Task 2 — Re-anchor the secondary artifact to the 1907 final report** (AC1, AC3, AC8)
  - [x] Replace the `morley-miller-1905-reconstruction` artifact with the 1907 final report. Keep `contextualArtifacts.length === 2` — `MAX_CONTEXTUAL_ARTIFACTS` is 2 and raising it is renderer work across three surfaces (§SS3).
  - [x] Decide `sourceType` / `provenance.category` / rendition `kind` from what the text **actually is**. The 1907 report is short enough to quote in full and is public domain, so a genuine `transcription` of `primary-material` is available here in a way it was not for 1905 (§SS4).
  - [x] Author the rendition sections, `summary`, `readerLabel`, `caseRelationship`, `citation.reuseStatement` in EN + FR. Every rendition must cover the same `sourcePages` in the same order with the same paragraph counts across locales — the schema refines this.
  - [x] Sweep every reference listed in §SS4's table. Nothing may still say 1905 except the historical prose that deliberately mentions the earlier repetition.
  - [x] Update `readingGateHints` id/`artifactId`, both `conclusionProposals` `inspected-source` predicates, `debrief.sourceRefs`, `debrief.historicalComparison` (title, text, `sourceIds`), and the `provenance.reference`.

- [x] **Task 3 — Resolve the 1887 excerpts' fidelity and page attribution** (AC2)
  - [x] Compare each authored paragraph against the archived text at the artifact's own `archiveUrl`. §SS5 records two divergences already found — treat them as a floor, not a list.
  - [x] Decide each section's `sourcePages` by §SS5's rule: keep only what the cited source supports; the schema requires at least one positive integer, so the honest fallback is the article's own first page rather than an unverifiable interior page.
  - [x] Restate the outcome in `deferred-work.md` — struck if closed, rewritten with what remains if not. Do not carry the entry forward verbatim.
  - [x] Update `docs/case-prototypes/morley-miller-prototype.md` §4's ⚠ block and §8 item 2 to say what is now true.

- [x] **Task 4 — Make the bounded-null distinction explicit in authored content** (AC3, AC8)
  - [x] Carry the 1907 report's own arithmetic into the reader-facing content: the demanded displacement, and the fraction of it the observations could exclude. §SS4 quotes the source.
  - [x] Check `openingDispute`, the 1907 artifact's `summary` and `caseRelationship`, `debrief.summary`, `debrief.historicalComparison.text`, `debrief.deeperTheory` and the `context` dialogue beat. The distinction must be reachable in at least the curated record **and** the debrief.
  - [x] Do **not** add or reword a `conclusionProposal`. Bounded-conclusion wording and its overclaim refusal are **Story 4.3's** ACs; `predict-nothing-at-all` already carries the perfect-zero prediction and needs no change.

- [x] **Task 5 — Bring the authored cycle range to two-to-four** (AC5)
  - [x] Set `flow.maximumExperimentCycles` to `4` in `public/cases/morley-miller/case.json`.
  - [x] Add a `MORLEY_MILLER_CASE_ID` clause to `CaseDefinitionSchema`'s top-level `superRefine` pinning `minimumExperimentCycles === 2 && maximumExperimentCycles === 4`, beside the existing `YOUNG_CASE_ID` branch — not as a `z.literal` in the shared shape.
  - [x] **Leave `cloneSecondCase()` in `tests/unit/CaseDefinition.test.ts` at 2/6.** Its id is `morley-drift-bench`, the new branch does not fire for it, and its 6 exists to prove the shared shape is not Young's literal. `CaseDefinition.test.ts:1419` asserts that 6 and must keep passing.
  - [x] Add a test that the new branch fires for `morley-miller` and does not fire for anything else, mirroring the Young-branch test.

- [x] **Task 6 — Declare and wire the campaign lock order** (AC6)
  - [x] Create `src/domain/cases/campaignOrder.ts`: pure TypeScript, no Zod, no Phaser, no I/O. It exports the ordered campaign, a predicate for whether a case is unlocked, and a resolver for the campaign entry.
  - [x] Order is `[MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID]`, imported from `CaseDefinitionSchema`'s existing constants — do not restate either string.
  - [x] Unit-test the three invariants AC6 names: Morley–Miller's index is lower than Young's; a completed or validated Young does not reorder or unlock anything ahead of Morley–Miller; unlocking is monotonic in the completed set.
  - [x] Wire it into the boot path per §SS8's decision. Whichever branch is taken, the module must be **read** by `src/` — a constant nothing consumes is the "authored content nothing reads" defect the Don't-Miss table names.
  - [x] Update `resolveCaseId.ts`'s docstring: it currently says this story owns the decision. Say what the decision was.

- [x] **Task 7 — Extend the French typography sweep to both shipped cases** (AC7)
  - [x] In `tests/e2e/french-typography.spec.ts`, turn the module-level Young-only `caseDefinition` parse (line ~447) into a per-case sweep over `SHIPPED_CASE_IDS` (line 197), following the `CASE_TITLES` (line 492) and `stagedFigureCounts` (line 213) patterns already in the file.
  - [x] Convert each content sample constant to a cross-case sweep: `SOURCE_NAME`, `CONTROL_LABEL`, `CONTROL_INLINE_LABEL`, `IDLE_SETTINGS_CLAUSE`, `NOTEBOOK_SETTINGS_ROW`, `COLLEAGUE_NAME`, `FIGURE_PLAQUE_NAMES`, `PROPOSAL_TEXTS`, `CONCLUSION_CLAIMS`, `CONCLUSION_LIMITATIONS`, `FRENCH_LIMITATIONS`, `DIALOGUE_BEATS`, `RIVAL_LAB_CRITIQUES`, the colleague-hint sweep, and the reading-gate lines.
  - [x] Label each sample with its case id, so a failure names which case overflowed.
  - [x] **Mutation-prove it.** Lengthen one authored French string in the prototype past its band, watch the sweep go red, restore it, record the proof. Without this the whole task is a change that reads as coverage.
  - [x] Fix any real overflow the extended sweep finds in authored prose by shortening the **content**, not by widening the band. If a band is genuinely wrong, that is renderer work — record it with an owner.
  - [x] Strike `deferred-work.md:84` and `:220`.

- [x] **Task 8 — Versions, cache, ledger** (AC9)
  - [x] Bump `public/cases/morley-miller/case.json` `version` to `1.4.0`.
  - [x] Add `|| (isPrototype && definition.version === '1.4.0' && ['1.0.0', '1.1.0', '1.2.0', '1.3.0'].includes(record.caseDefinitionVersion))` to `CaseRecordSchema`, with a comment stating what changed. **This is the finding 3.4's review rated severest** — the 1.3.0 bump shipped without its clause and every saved prototype investigation was refused.
  - [x] Consider whether a saved record can survive the artifact id change at all: `inspectedSourceIds`, `theory.selectedSourceIds` and the record's source references may hold `morley-miller-1905-reconstruction`. If a saved record cannot be honestly accepted, the clause must **exclude** the older versions rather than list them — say which, and why, in the comment.
  - [x] Bump `public/sw.js` `CACHE_NAME` to `quantique-bootstrap-v12` and append the reason. The v11 header states the rule: **an additive optional field is still a bump, because `.strict()` makes every schema change breaking in the old-bundle direction.** This story changes content *and* adds a refinement, so it is unambiguously a bump.
  - [x] Run `npm run audit:ledger` and commit both regenerated `docs/source-rights/morley-miller-ledger.{en,fr}.md`.

- [x] **Task 9 — Produce the loop review artifact** (AC5)
  - [x] Write the review per §SS7 — a reviewer-readable document mapping each clause of AC5 to the authored field that carries it, with the residual gaps named and owned.
  - [x] It supersedes nothing: `docs/case-prototypes/morley-miller-prototype.md` stays as the 3.2 authoring review. This is the pre-production **case** review.

- [x] **Task 10 — Verification and bookkeeping** (AC10)
  - [x] Run all four gates. Record the test and file counts, the e2e pass count, and the `typecheck:tests` measurement.
  - [x] Record every mutation proof: what was broken, which named test went red, that it was restored.
  - [x] Strike closed `deferred-work.md` items; record new ones with a named owner story (not "Epic 4" — 3.2's review rejected that).
  - [x] Fill the Dev Agent Record, File List and Change Log.

## Dev Notes

### §SS0. `_bmad-output/project-context.md` exists and is governing — read it first

Revision 2.6, dated 2026-08-19. Story 3.3's first review finding was that the story asserted twice that this file did not exist, when it had existed at story-creation and had been expanded before dev — so that work was done against unread governing rules, crossed two of them, and cost a retired surface and a re-worded AC. §Project Context Rules below extracts what bears on this story. It is a pointer.

Two of its rules **name this story as owner**:

> *"Unverified provenance is recorded, never hidden, and never quoted as verified. The Morley–Miller 1887 excerpts are authored `kind: 'transcription'` and are public-domain text, but their page attributions (333, 341) have not been checked against a facsimile. Nothing there may be cited as a verified transcription until it is. Owner: Story 4.1, before any scholarly sign-off."*

> *"The French typography sweep measures Young's prose, not the prototype's. … Owner: Story 4.1, with the tuned case content."*

And a third rule is the reason Task 2 exists:

> *"Name a historical artifact after its verifiable anchor — that same artifact was labelled 1907 throughout, against a genuine 1905 citation."*

### §SS1. Scope boundary — read this before writing anything

**In scope:** the case's *record* — its two contextual artifacts, their provenance, the prose that frames the dispute, the authored cycle range, the campaign lock order, the typography sweep, and the pre-production loop review.

**Out of scope, each for a stated reason:**

- **The bench artwork.** The prototype draws Young's light source, slits and barrier. That is prototype gap #1, **owner Story 4.2**, and `ApparatusRenderer.ts:246` and `:995` both say so. A reviewer opening the case sees an optical bench with a rotation dial on it. Leave it.
- **The physics constants.** `A = 0.01`, `k = 0.05/°C`, `T₀ = 20.0 °C` in `calculateInterferometerDrift.ts` are invented and its docstring says so. Calibrating them against published numbers is **Story 4.2**. AC3 asks the *record* to distinguish a bound from a zero; it does not ask the model to reproduce 1907's numbers.
- **`formatMeasurement`'s separator before every unit** — the bench reads `0 °` rather than `0°`. Shared with Young's rendering, **owner Story 4.2**. You will see it while looking at the rotation dial. Leave it.
- **The bounded conclusion, the overclaim refusal, and the debrief's revision feedback.** Those are **Story 4.3**'s ACs. Do not add or reword a `conclusionProposal`, a `peerReviewRule`, or a `rivalLabCritique`.
- **The thermal-drift teaching loop, the stable-window replication, feedback directing to replication or a missing variable.** **Story 4.2.**
- **No third contextual artifact.** `MAX_CONTEXTUAL_ARTIFACTS = 2` and raising it is renderer work across the case file, the reading room and the debrief — see §SS3.
- **No new scene, no new phase, no fourth module in `src/ui/`, no registry layer, no `services/`/`managers/`/`helpers/` catch-all.**
- **Do not assign a reviewer.** The scholarly reviewer and the educator context sheet are `pending` and the case is ledger-**BLOCKED** on both. Authoring a name nobody supplied is the defect the ledger exists to prevent. It stays blocked; Open Question #3 asks Alexis to assign.
- **Do not touch the five orphaned `src/game/scenes/*` template files.**

### §SS2. What already ships — do not rebuild it

The framework carries this case end to end as of Story 3.2, and 3.3 and 3.4 extended it. Verified at baseline `62b65b2`:

| Already ships | Where |
|---|---|
| Two contextual artifacts with bilingual renditions, citations, archive URLs | `public/cases/morley-miller/case.json` |
| Provenance category and source type rendered as localized prose | `LibraryRenderer.ts:660`, `CaseFilePresenter.ts:553`, `DebriefRenderer.ts:345`, `source.provenance.*` / `source.provenanceName.*` in `locales/{en,fr}.ts` |
| Reading-room book with page-for-page bilingual renditions, printed page lines | `LectureBookRenderer.ts:321–325`, `lecturePagination.ts` |
| The context reading gate | `contextPredictionReadiness.ts` — counts **every** authored artifact |
| Reading-gate hints, colleague hints | `readingGateHints.ts`, `colleagueHints.ts` |
| Confound, reset path, model assumptions, counterfactual replay labels | `experiment.confound`, `experiment.resetPath`, `experiment.assumptions`, `debrief.replayLabel`, `replay.isCounterfactual` |
| Source-and-rights ledger, release approval, generated bilingual report | `caseLedger.ts`, `releaseApproval.ts`, `ledgerReport.ts`, `npm run audit:ledger` |
| Scene routing across all six phases from the authored script | `SceneRouter.ts` (ADR-009) |
| `?case=morley-miller` reviewer route, allowlisted | `resolveCaseId.ts`, `KNOWN_CASE_IDS` |
| A rotation `dial` and a temperature `slider` as direct-manipulation instruments | Story 3.4; `ApparatusInstrument.ts`, `instrumentView.ts` |

**The risk in this story is not under-building.** It is (a) rebuilding a surface that exists, (b) leaving a stale 1905 reference that nothing crashes on, and (c) shipping a "test that cannot fail" for the typography sweep.

### §SS3. Why the case keeps exactly two artifacts

`MAX_CONTEXTUAL_ARTIFACTS = 2` in `CaseDefinitionSchema.ts:82`, and its docstring states the cost of a third:

> *"A third source would be readable, would count toward the reading gate (`evaluateContextReadiness` counts every authored artifact), and could never be pinned as supporting evidence — authored content the player cannot use, and with `minimumSources: 3` an unrecoverable dead end. Raising it is renderer work — the case file, the reading room and the debrief each reserve rows."*

The three reservations are real and each is proved against the constant: `caseFileGeometry.ts:149` (`CASE_FILE_SOURCE_ROWS`), `libraryGeometry.ts:255` (`libraryArtifactPlacements`), `debriefGeometry.ts:188`. `ApparatusGeometry.test.ts` asserts the ceiling against the real geometry so the bound and its justification fail together.

**Therefore AC1 is a replacement, not an addition.** The 1907 report takes the second slot. The 1905 report remains in the *prose* — the debrief's historical comparison is exactly the place to say the experiment was repeated, at greater length, twenty years apart — but it stops being an artifact with its own id, rendition and reading gate.

### §SS4. The 1907 anchor — the source, verified

The GDD anchors this tutorial on 1907, twice, and the epic AC names "the 1907 report":

> `gdd.md:121` — *"Morley–Miller ether-drift tutorial (1907)"*
> `decision-log.md:18` — *"Campaign tutorial anchors in the 1907 Morley–Miller ether-drift follow-up."*
> `.archive/epics.md:10` — *"the 1907 report and 1887 source context are reviewed."*

Story 3.2 shipped a **1905** artifact, and its code review renamed the artifact from 1907 to 1905 *because the citation was genuinely 1905* — the right call on the evidence available, and the reason a 1907-titled artifact is not simply reinstated. The resolution is that a real 1907 final report exists and is a better fit than the 1905 one:

**Morley, E. W., & Miller, D. C. (1907). Final Report on Ether-Drift Experiments. _Science_, N.S. Vol. XXV, p. 525 (April 1907).**
Archive: `https://en.wikisource.org/wiki/Final_Report_on_Ether-drift_Experiments` — marked public domain (published before 1931).

The report is a single paragraph. Its full text, from that archive page:

> *"At the Philadelphia meeting an account was given of experiments to detect ether drift. These observations gave no indications of a drift of the ether. It has been suggested that the negative results are due to the influence of the heavy stone walls of the building within which the apparatus was mounted. The interferometer has, therefore, been mounted on high ground near Cleveland, and covered in such a manner that there is nothing but glass in the direction of the expected drift. It was much more difficult to make observations in this location than in the building; satisfactory observations could only be made on a cloudy evening following a cloudy day, when the temperature changed very slowly. The temperature effects could never be entirely eliminated. The conclusion from many observations is that there was no indication of a drift of the ether through the interferometer. The expected drift would produce a displacement of the interference fringes of 1.53 wave-lengths; the above result is probably certain to one eightieth part of the whole."*

**Why this is the right anchor, in four ways this story needs:**

1. **It is short and public domain**, so a genuine `kind: 'transcription'` of `sourceType: 'published-book'` / `provenance.category: 'primary-material'` is available — the reconstruction workaround 3.2 needed is no longer forced. Choose from what the text *is*, not from what is convenient; that rule is in §Organization.
2. **It supplies AC3 directly.** *"The expected drift would produce a displacement of the interference fringes of 1.53 wave-lengths; the above result is probably certain to one eightieth part of the whole."* That is a demanded value and a bound on the residue — a near-null with an explicit fraction, in the authors' own words, and the opposite of a claim of perfect zero. Carry both numbers into the reader-facing content.
3. **It names the confound the case teaches.** *"satisfactory observations could only be made on a cloudy evening following a cloudy day, when the temperature changed very slowly. The temperature effects could never be entirely eliminated."* The case's `experiment.confound` is `thermal-drift`. The source says it.
4. **It explains the rival lab.** The apparatus was *"mounted on high ground near Cleveland"* and the case's rival lab is already "The Cleveland bench".

**Two cautions on the citation.** The archive page renders the issue as *"No. 2"* and the date as April 5; the commonly cited form is *Science* 25(641), 12 April 1907. Cite what the archive page you link states, and if you cannot reconcile volume/issue/date, put the reconcilable part in `citationText` and record the discrepancy — do not average two sources into a citation neither supports. And **the `sourcePages` question applies here too**: the archive page gives page 525 for the report; a single-page report has a page attribution you can actually support.

**Complete rename surface.** Every site, from `grep -rn 1905` at baseline. Sweep it and re-grep afterwards:

| File | Lines | What |
|---|---|---|
| `public/cases/morley-miller/case.json` | 115, 117–118 | artifact `id`, `displayName.{en,fr}` |
| | 124 | `provenance.reference` |
| | 142 | `citationText` (and the sibling `archiveUrl`) |
| | 163, 174, 192, 203 | rendition section ids, **both locales** — the schema requires identical section shape across renditions |
| | 364, 368 | `readingGateHints[].id` and `.artifactId` |
| | 521, 550 | `conclude-bounded-null` and `conclude-thermal-confound` `inspected-source` `sourceId` |
| | 661 | `consultationRules` `sourceId` |
| | 909 | `debrief.sourceRefs` — this vocabulary is `provenance.reference`, **not** the artifact id |
| | 913–914 | `debrief.historicalComparison.title.{en,fr}` |
| | 922 | `debrief.historicalComparison.sourceIds` — this vocabulary **is** the artifact id |
| `tests/unit/MorleyMillerPrototype.test.ts` | 67, 104, 129, 149, 185, 204, 239, 254, 329 | dispatched `sourceId`s and one comment about the reconstruction |
| `docs/case-prototypes/morley-miller-prototype.md` | 70, 133, 137, 170, 309, 311 | the authoring review's own record |
| `docs/source-rights/morley-miller-ledger.{en,fr}.md` | 19 | **generated** — do not hand-edit, re-run `npm run audit:ledger` |
| `src/core/i18n/resolveLocalizedText.ts` | 42 | comment referring to "the prototype's 1905 artifact" |
| `src/schemas/CaseDefinitionSchema.ts` | 349 | same, in the rendition-`kind` docstring |
| `src/domain/cases/CaseDefinition.ts` | 87 | comment referring to the 1905 reconstruction as the open item |
| `src/domain/apparatus/calculateInterferometerDrift.ts` | 10 | *"the 1905 report. Calibrating them against the published numbers…"* — **owner 4.2**; update only the year if the anchor moves, do not touch the constants |

Two of those comments describe history that stays true. A comment that records *why the `reconstruction` rendition kind exists* should keep naming 1905 as the case that motivated it — the vocabulary was added for that artifact and the record of why should survive it. Judge each; do not blanket-replace.

**If the `reconstruction` kind ends up read by nothing after this story**, that is worth recording. Do not delete it — it is a legitimate vocabulary member and `docs/content-authoring/README.md` documents it — but note in `deferred-work.md` that no shipped case exercises it, so the next case author knows the branch is untested against real content.

### §SS5. The 1887 excerpts — what a check already found

The 1887 artifact stays. What must be resolved is whether its two authored sections are what they claim.

**The claim being made.** `renditions[0].kind === 'transcription'` and each section carries `sourcePages: [333]` / `[325, 328]`-style printed page numbers, which `LectureBookRenderer.ts:325` prints to the player as *"Printed page 333"*. That is a provenance assertion on screen, which is why `deferred-work.md` says nothing here may be quoted as verified until it is checked.

**Two divergences found against the artifact's own `archiveUrl`** (`https://en.wikisource.org/wiki/On_the_Relative_Motion_of_the_Earth_and_the_Luminiferous_Ether`), reading the archived text at story creation:

1. **Section `mm-1887-p333`, second paragraph is a paraphrase, not a transcription.** Authored: *"If the earth were a transparent body, it might perhaps be conceded that the intermolecular ether should be at rest in space, notwithstanding the motion of the particles of the body."* Archived: *"If the earth were a transparent body, it might perhaps be conceded, in view of the experiments just cited, that the inter-molecular ether was at rest in space…"* — a dropped clause, a changed tense, and a changed hyphenation.
2. **Section `mm-1887-p341`'s quotation drops the source's commas.** Authored: *"It appears from all that precedes reasonably certain that…"* Archived: *"It appears, from all that precedes, reasonably certain that…"*

Treat these two as a **floor**. Check every paragraph, both sections, character by character, and the French translations against the corrected English.

**On the page numbers.** The Wikisource transcription carries no printed page markers, so 333 and 341 cannot be confirmed from the artifact's own archive link. What *is* supported by the citation itself is the article's page range, 333–345 — so 333 is defensible for the opening sentence (it is the article's first page) and 341 is not defensible from any source currently linked. `sourcePages` is `z.array(z.number().int().positive()).min(1)`, so it cannot be emptied; the honest options are:

- **(a)** verify against a facsimile and keep or correct the numbers — the strongest outcome, and the one the deferred item asks for; or
- **(b)** attribute only what the cited source supports, and say in `citation.reuseStatement` (both locales) that the excerpt's printed page is the article's opening page rather than a verified interior page.

Do **not** leave an unverifiable number in place with a comment saying it is unverified. The number is on the player's screen; the comment is not. Whichever option is taken, `deferred-work.md:217` and `:247` must be rewritten to say what is now true.

*Note that `ajsonline.org` returns 403 to automated fetches; if you need a facsimile, another archive is required.*

### §SS6. Two-to-four cycles, and the field nothing reads

`public/cases/morley-miller/case.json` ships `flow.minimumExperimentCycles: 2, maximumExperimentCycles: 6`. Young ships 2/4, pinned by the `YOUNG_CASE_ID` branch in `CaseDefinitionSchema.ts:1037`. AC5 and FR25 both say **two-to-four**, so the prototype's 6 is out of spec.

**Two things must not be conflated.** Change the **shipped case** to 4. Leave the **fixture** at 6: `cloneSecondCase()` in `tests/unit/CaseDefinition.test.ts:320` has `id = 'morley-drift-bench'`, the new branch will not fire for it, and `CaseDefinition.test.ts:1419` asserts its 6 precisely to prove the shared shape is not Young's literal. Breaking that assertion would undo Story 3.1's work.

**Say plainly, in the review artifact, that this change has no behavioural effect.** Nothing in `src/` reads `maximumExperimentCycles`; two comments say so in as many words — `caseFileGeometry.ts:40` (*"the observation list is paged because nothing caps `runs`"*) and `selectors.ts:410`, which records that an earlier version of its own comment wrongly justified a cost with the cap. So this is a content-and-contract correction that brings the authored value in line with FR25 and makes a load-time refinement enforce it; it does not cap anything the player does. That is exactly the "author a case field that nothing reads" shape in the Don't-Miss table, it predates this story, it applies equally to Young, and **it needs an owner** — record it in `deferred-work.md` (candidate owner: Story 4.2, which owns the experiment loop).

Adding the refinement is still worth doing: it stops a future case author from authoring a range FR25 forbids, and it fails at load with the path named.

### §SS7. The loop review artifact (AC5)

AC5's *"when it is reviewed before production"* wants a document a reviewer reads, not a passing test. Write `docs/case-reviews/morley-miller-case-review.md` (a new directory; `docs/case-prototypes/` holds the 3.2 *authoring* review and is not superseded).

It must map every clause of AC5 to the authored field carrying it, so a reviewer can check the claim rather than take it:

| AC5 clause | Where it is authored |
|---|---|
| `context → prediction → experiment → synthesis → review → debrief` | `scenarioScript.scenes[].phase`, six scenes; `CASE_PHASES`; ADR-009 |
| Opening dispute | `openingDispute`, `flow.openingDispute` |
| Curated Record | `contextualArtifacts[]`, `flow.curatedRecord` |
| Lab setup | `apparatus.primaryControls[]`, `flow.labSetup` |
| Two-to-four cycles | `flow.minimumExperimentCycles` / `maximumExperimentCycles` — **and the note from §SS6 that nothing reads the cap** |
| Theory-board conclusion | `conclusionProposals[]`, `requirements.minimumSignificantRuns`, `significanceRule`, `flow.theoryBoardReview` |
| Historical debrief | `debrief.summary` / `historicalComparison` / `deeperTheory`, `flow.historicalDebrief` |
| Optional replay | `debrief.replayLabel`, `flow.optionalReplay`, `replay.isCounterfactual` |
| Confound | `experiment.confound` (`thermal-drift`, `discoverableBy: 'replication'`) |
| Reset-solvable path | `experiment.resetPath` (`recoveryRoute: 'replication'`) |
| Model assumptions | `experiment.assumptions` (three, bilingual) |
| Counterfactual labels | `debrief.replayLabel`; `print.completion.text`; `error.replay-unavailable`; `AppState.startReplay` |
| History-preserving campaign replay | `AppState.ts:797` — a counterfactual replay keeps the saved `completion` snapshot and clears the live selection; `CaseRecordSchema.ts:708` |
| Campaign lock order | `src/domain/cases/campaignOrder.ts` (new), and what reads it |

State the residual gaps honestly, each with its owner: the bench artwork (4.2), the invented model constants (4.2), `formatMeasurement`'s degree separator (4.2), the bounded conclusion (4.3), the unassigned scholarly reviewer and educator context sheet (unassigned — Open Question #3), and the ledger verdict, which is and should remain **BLOCKED**. A review artifact that reports a green case would be the defect the ledger exists to prevent.

### §SS8. Campaign lock order — the design, and the one decision in it

**Nothing named "campaign" exists in the codebase.** There is no picker, no menu, no cross-case progression, and `caseRecordRepository` is keyed by case id with `read`/`write` only — no enumeration. `resolveCaseId.ts` returns `YOUNG_CASE_ID` unless `?case=` names an allowlisted id, and three separate places say this story owns the decision: `resolveCaseId.ts:9`, `CaseDefinitionSchema.ts:42`, `MorleyMillerPrototype.test.ts:279`, plus `docs/case-prototypes/morley-miller-prototype.md:235`.

**The module (not in question).** `src/domain/cases/campaignOrder.ts` — pure, no Zod, no Phaser, no I/O, per §Organization. Order imported from the existing constants:

```
CAMPAIGN_ORDER = [MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID]
```

with an unlock predicate over the set of completed case ids and a resolver for the campaign entry (the first case in order the player has not completed). Because the repository cannot enumerate, the completed set is assembled by the boot path loading each campaign case's record — two `repository.load()` calls, which is honest and cheap. `CaseRecord` carries a `completion` snapshot; `CaseRecordSchema.ts:708` is where its shape is stated.

Three invariants to unit-test, matching AC6's three clauses:
- Morley–Miller's index is lower than Young's, asserted against `CAMPAIGN_ORDER` rather than against a repeated string.
- A completed **or** validated Young does not reorder the campaign and does not unlock anything ahead of Morley–Miller. Assert the `?mode=validation` route too — AC6 says *"completing **or validating** Young"*, and validation is a distinct route (`main.ts:63`).
- Unlocking is monotonic: adding a completed case never locks a case that was unlocked.

**The decision.** Whether the boot default flips.

- **Flip it.** `resolveCaseId` resolves the campaign entry when no `?case=` is given, so a fresh profile boots Morley–Miller and AC6 is true of behaviour, not only of a module. Cost: ~40 `page.goto('/')` sites across the e2e suite that mean "Young" implicitly. The fix is one helper in `canvasHelpers.ts` — which already has the shape at line 1090, `caseId === YOUNG_CASE ? '/' : '/?case=${caseId}'` — plus a mechanical replacement in the specs that assert Young content. The specs about the boot frame, offline reload and subpath hosting can stay on `/`; they assert boot behaviour, not Young. **This is arguably better than the status quo regardless of the flip**: `goto('/')` meaning Young is a Young-shaped assumption baked into forty test sites, and *"assume nothing is Young-shaped"* is the project's top Don't-Miss rule. The other cost is that until Story 4.2 lands the bench artwork, a fresh boot shows Morley–Miller on Young's optical bench. On `main` that is a known intra-epic window; it is not a release, and the case is ledger-BLOCKED so it cannot be publicly released either way.
- **Declare it and pin the entry.** Ship the module, have `resolveCaseId` read it, and keep the boot default on Young behind one named, dated constant whose removal is an AC of Story 4.3 — the last story in this epic. Cost: no e2e churn, and the seam is a fig leaf that must be named as one in the code, in `deferred-work.md`, and in the review artifact.

**Recommendation: flip it**, on the reasoning above — AC6 asks for behaviour, the e2e change removes an implicit assumption rather than adding one, and the artwork window closes inside the same epic. Open Question #1 puts it to Alexis with the fallback, and the fallback is a one-line switch either way. **Build the module and its tests first**, so the decision only affects the last wiring step.

Whichever way it goes: **the module must be read by `src/`.** A `CAMPAIGN_ORDER` that only tests consume is *"author a case field that nothing reads"* wearing a different hat, and the Don't-Miss table calls that shipped-and-dead content, the same defect class as an unreachable intent.

### §SS9. The typography sweep — exactly what to change

`tests/e2e/french-typography.spec.ts` is 78 KB and already sweeps **both** cases for two things: `CASE_TITLES` (line 492) and `stagedFigureCounts` (line 213), both via `SHIPPED_CASE_IDS` (line 197, `= KNOWN_CASE_IDS`). Everything else comes from a single Young-only parse at line ~447:

```
const caseDefinition = JSON.parse(readFileSync(new URL('../../public/cases/young-interference/case.json', ...)))
```

Every content sample listed in Task 7 derives from that one binding. The change is to make them per-case, using the two patterns the file already contains — so this is an extension of an established shape, not a new one.

**Three things this file's own history says not to get wrong:**

- **`longestFrench` by character count is not enough where the pass condition is per-token pixel width.** The file records this twice (lines ~523, ~929): *"Sampling by character count let a short proposal carrying one long token through unmeasured."* Where the existing code sweeps *every* string rather than the longest — proposals, dialogue beats, rival-lab critiques — keep sweeping every string, now across both cases.
- **Sweep both locales, not just French.** The file's reason (line ~553): the pass condition is per-token pixel width and an unbreakable token overflows in whatever language it was written; width measurement does not depend on the page locale.
- **Derive a bound from the production rule, never from a literal.** The `FIGURE_SLOT_WIDTH` history at lines 205–247 is the cautionary tale — three patches for the same defect shape, a spec measuring a slot nothing paints.

**The prototype's own review already found a real overflow of this class**: a French readiness line at 425px against a 372px column, and `Température du bain : 22,0 °C` wrapping to two lines at 1280×720 inside `INSTRUMENT_READOUT_HEIGHT` with nothing asserting the fit (`deferred-work.md:84`). Expect the extended sweep to find more, and fix them in the content.

**And the harness limit that decides where a fit claim can live.** From §Testing: the structural scene harness reports a constant `height: 18` for every text object and approximates `measureText` width as `length * 7`. *"Any 'the text fits' or 'the bands do not overlap' claim proven only in the harness is an assertion about arithmetic, not about what is painted."* Confirm layout by eye at 1280×720 in both locales, and say in the record that you did.

### §SS10. Bilingual — the surfaces to check, built by grepping the read

§i18n names this the project's most-repeated defect and says how to avoid it: **build the surface list by grepping for the read, not from the story's file list.** Story 3.2 localized three of the four surfaces that render a run's apparatus settings and missed `CaseFilePresenter` for the single reason that it was absent from the story's file list.

For this story the artifact-bearing surfaces are: the reading room (`LibraryRenderer`), the archival book (`LectureBookRenderer`), the case file (`CaseFilePresenter`), the debrief (`DebriefRenderer`), the printable record (`CaseRecordPrintView`), the auto-summary (`caseSummary.ts` — it composes `sourceNames`), the reading-gate hints, and the generated ledger (`ledgerReport.ts`, both files). Grep each for the field you changed before declaring AC8 met.

Also: **never join a French preposition or article to an authored label.** Elision is control-dependent; `'de ' + label.fr` shipped as *"de Ecartement des fentes"* for two epics. Each control authors its own `inlineLabel` for use inside running prose — use it.

### §SS11. Testing requirements

- Unit-test all pure logic with Vitest, with fixtures — never require Phaser or a browser to test scientific or content logic. `src/domain/` is Zod-free; `src/schemas/` owns validation.
- **Break the guard and watch a named test go red.** The record: 2.10's entire painted dark state and its one-step-per-arrow-press each left 982/982 green; 2.11 shipped sixteen text-overflow instances under 1125 green; 3.2's blank-screen ignition and its silently-discarded completed record were both invisible to 1334 green; 3.4's review found six new tests whose names described guards they did not exercise, four of them green with the guard deleted. **For every guard this story adds whose failure would be silent, mutation-prove it and record the proof.** At minimum: the new cycle-range refinement, the record-allowlist clause, the campaign-order invariants, and the extended typography sweep.
- **Name the change to `src/` that would break each assertion you write.** If you cannot, the assertion is the "test that cannot fail" shape.
- Never assert a magic number a test shares with source unless both read one exported constant.
- E2E: `morley-miller-prototype.spec.ts` is the prototype's walk and its `sourceId` dispatches move with the rename. The canvas walks are frame-timed and load-sensitive — judge a failure on an idle machine, and wait on the thing the gesture was supposed to achieve (`clickUntilScene`, `startTheLightUntilRecorded`), never on a fixed sleep.
- Canvas text cannot be read from a spec. A string assertion belongs in a `sceneSlice`-driven unit test or in `french-typography.spec.ts`.
- `npm run typecheck:tests` is red at **114 errors / 60 files** and is deliberately not gated. **The count is the metric: it may only go down.** Diff against a stashed baseline rather than eyeballing it; 3.4 did exactly that.

### §SS12. Deferred-work items this story owns

Four name this story. Each must be struck or rewritten, not carried forward verbatim:

- **`deferred-work.md:217`** — the 1887 excerpts' transcription fidelity and page attribution, *"before any scholarly sign-off"*. Task 3.
- **`deferred-work.md:247`** — the same item as restated by Story 3.3, which authored no rendition text and checked no facsimile; the ledger row is `reviewerState: 'pending'` and the case is BLOCKED, *"so this can no longer be forgotten by a release."* Task 3.
- **`deferred-work.md:220`** — the French typography sweep measuring interface chrome and Young's content only. Task 7.
- **`deferred-work.md:84`** — the prototype's bench prose measured against no band, including `Température du bain : 22,0 °C` wrapping inside `INSTRUMENT_READOUT_HEIGHT`; *"confirmed by eye in both locales for this story; not automated."* Task 7.

Items this story will likely open, each needing a named owner story (not "Epic 4" — 3.2's review rejected that as not being a story):

- `flow.maximumExperimentCycles` and `flow.minimumExperimentCycles` are read by nothing in `src/`. Predates this story, applies to both cases. Candidate owner: 4.2.
- The `reconstruction` rendition kind, if no shipped case exercises it after Task 2.
- Whatever the extended typography sweep finds that is a band problem rather than a content problem.
- Whatever the 1887 verification cannot close.

*Do not* touch items owned by 4.2 or 4.3 (§SS1).

### §SS13. Lessons from 3.1–3.4 that apply directly here

- **A comment claiming a guarantee is not a guarantee.** Fourth story running that this has been a finding. Three of 3.1's four un-re-stated shapes shipped with a comment asserting a check that did not exist; 3.4's review found six tests whose names described guards they did not exercise. When you write "verified" or "still rejected", break it and watch the named test go red.
- **A graceful degradation is the defect shape a green suite keeps.** 3.2's bench read *"dark at 0 slit spacing and 22 screen distance"* for this very case: nothing threw, 1293 tests stayed green, and the bench lied. A stale `morley-miller-1905-reconstruction` `sourceId` in a support predicate is the same shape — the predicate simply never matches, the conclusion silently stops being defensible, and nothing fails.
- **When two code paths answer the same question about a case, change them together.** Before you change one reference to the artifact, grep for the others. §SS4's table is that grep at baseline; re-run it after.
- **Make the list of things you relaxed or renamed explicit and tick each one off.** 3.1 re-stated one guarantee exemplarily and left four unstated; its review found all four.
- **A version bump and its record allowlist are one action.** 3.4's severest finding: the 1.3.0 bump landed without its `CaseRecordSchema` clause and every saved prototype investigation was refused with `incompatible-case-record` — the failure the comment three lines above it already named from when it happened at 1.1.0.
- **Take values from the model's behaviour, not from the authored range's ends.** 3.2's walk dragged `rotationDeg` 0° and 180° while asserting two *distinguishing* runs; against `cos(2θ)` those are one reading. Relevant if any walk you touch picks control values.
- **Read the governing rules before dev, not after.** 3.3's first review finding. §SS0.

### §SS14. Recent work, and the dependency posture

**Baseline is `62b65b2` ("Review 3.4").** The recent history is three commits per story — `Story N` (context), `Dev N` (implementation), `Review N` (code review and patches) — so this story's dev commit lands directly on a reviewed tree with no half-finished work under it.

`62b65b2` is the shape to expect for a content-and-contract story: 22 files, and the distribution is instructive. Content and contract were two files (`case.json` via `docs/content-authoring/`, `CaseDefinitionSchema.ts`), the service worker was one, `CaseRecordSchema.ts` was one — **and nine of the twenty-two were tests**. A story that changes authored content and touches four files is a story that has not yet written its proofs.

Also visible in the last four commits, and worth carrying: `sprint-status.yaml` and `deferred-work.md` are updated in the same commit as the work, not afterwards; `public/sw.js` moved in both 3.3's and 3.4's review commits, which is the bump rule being applied late twice; and `dist/` and `dist-subpath/` never appear, because they are gitignored build output.

**No dependency changes.** Every version is pinned by a committed lockfile with a stated reason, `playwright-core` is held by an `overrides` entry so it cannot drift, and the ES2020 target is deliberate. Adding a dependency mid-story is a HALT condition — 3.2, 3.3 and 3.4 each met a gap that a new dependency would have closed (`jsdom` for `CaseRecordPrintView` coverage) and each worked with the constraint instead. This story needs nothing new: it is authored JSON, one pure module, two schema clauses, a test-file extension, and two markdown artifacts. If you find yourself reaching for a package, stop and say why.

### Project Structure Notes

| Deliverable | Path | Rule that decides it |
|---|---|---|
| Campaign order + unlock predicate | `src/domain/cases/campaignOrder.ts` | `src/domain/` is pure TypeScript — no Phaser, DOM, fetch, IndexedDB, **and no Zod**. Beside `CaseDefinition.ts`, whose vocabulary it orders. |
| Cycle-range refinement | `src/schemas/CaseDefinitionSchema.ts` (the `superRefine` branch, beside the Young branch) | `src/schemas/` owns every Zod schema; every object `.strict()`. Case-specific *rules* branch on `id` — not a `z.literal` in the shared shape, and not a registry. |
| Record-compatibility clause | `src/schemas/CaseRecordSchema.ts` | The allowlist is scoped by case id; keep it honest rather than widening it. |
| Boot wiring | `src/main.ts` + `src/adapters/content/resolveCaseId.ts` | Only adapters touch I/O; only repositories touch IndexedDB. |
| Case content | `public/cases/morley-miller/case.json` | **Edit only `public/cases/…`** — `dist/`, `dist-subpath/` and `.claude/worktrees/**` are build output or stale copies. |
| Service-worker bump | `public/sw.js` | A case-JSON change is a `CACHE_NAME` bump, in the same commit, with the reason in the header list. |
| Generated ledger | `docs/source-rights/morley-miller-ledger.{en,fr}.md` | Generated by `npm run audit:ledger`. Never hand-edited. |
| Loop review artifact | `docs/case-reviews/morley-miller-case-review.md` | New; `docs/case-prototypes/` holds the 3.2 authoring review and is not superseded. |
| Typography sweep | `tests/e2e/french-typography.spec.ts` | Layout is `tests/unit` / `tests/integration` / `tests/e2e`. |
| Campaign-order tests | `tests/unit/` | Pure domain logic, Vitest, fixtures, no browser. |

**Naming:** `PascalCase` for classes and their files, `camelCase` for non-class modules, functions, properties and JSON fields, `UPPER_SNAKE_CASE` for constants, `kebab-case` for case ids, assets and experiment model ids. Domain events `noun.verb`; typed actions `domain.verbPastTense`. Fallible operations return `Result<T, ResultError>` rather than throwing; error codes resolve to localized copy.

**Do not create:** a third contextual artifact; a `services/`/`managers/`/`helpers/` catch-all; a fourth module in `src/ui/`; a case-rule registry or plugin layer; a new scene or phase; a picker or menu UI. And do not wire, extend or imitate `src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` — orphaned Phaser-template leftovers referenced nowhere.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` revision 2.6 — the rules that bear on *this* story. The file is governing; this is a pointer to the parts you will cross.

**Stack**
- Phaser 4.2.1 (sole interactive surface), TypeScript ~5.7.2 `strict` with **`target`/`lib` ES2020 deliberately** — `.at()` and `Object.hasOwn` are unavailable; write `[length - 1]` rather than bumping the target, a trade already considered and lost twice.
- Vite 8.1.5, Node 20.18.1+, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1. Lockfile committed. Every e2e script runs through `cross-env PLAYWRIGHT_BROWSERS_PATH=0`.
- Content is **two cases**: `young-interference` at 1.22.0, `morley-miller` at 1.3.0. **Assume nothing is Young-shaped** — in a control id, a guard, a readiness rule, or a walk.

**Engine (ADR-001 v1.1, ADR-009, ADR-011, ADR-012)**
- Phaser scenes own all interactive presentation; the only non-Phaser surface is the portable record. Never add semantic HTML to mirror a Phaser gesture.
- **Canvas completeness:** a feature is not done until the canvas can dispatch its intent. Grep for every dispatcher of every action this story touches. If the only dispatcher is under `src/ui/`, it is unfinished no matter how green the unit tests are.
- `src/ui/` holds exactly three modules. Phaser widgets live in `src/adapters/phaser/ui/`, which is *not* `src/ui/`.
- **SceneRouter:** the case's `scenarioScript` owns the phase→scene map; the router only obeys it, is read-only over the store, and never dispatches. Scenes never define, infer, or advance the phase, and never reach into another scene.
- **Never author player-facing copy in `create()`** — it runs once and the locale can change. Create text empty, populate in `render(state)` through `createTranslator(locale)`.
- Honour `prefers-reduced-motion` in every animated renderer. Retained no-flashing guard; survives the a11y de-scope.
- A renderer's case-shape guard and its "is this running?" decision must be the same decision. Never write a control id into a renderer — compose from `apparatus.primaryControls`.

**Guided-adventure & gating**
- Everything is authored; nothing is freeform.
- The shared contract holds only what every case shares; **per-case invariants live in a refinement branched on `id`.** At two cases a branch is the whole mechanism — do not build a plugin or registry layer.
- **No authored content may leave a gate unsatisfiable.** Ask of every field: can an author fill this in a way that makes the case unfinishable? If yes, refine it at load, with the offending path named.
- **A gate can be made unsatisfiable by code, not only by content** — ask it of every predicate you write. A stale `sourceId` in an `inspected-source` predicate is exactly this.
- The evidence evaluator is the **sole completion authority**. Never hard-code completion. Defensibility is evaluator/critique-only; never expose a proposal as "correct" up front.
- Proposal arrays use `.length(4)` — the count is the design. Choices are revisable. Choosing sets both the id and the canonical text; a present id must match its proposal's text.
- No hard fails, irreversible wrong choices, speed rewards, or rewards for overclaiming. The rival lab is narrative dressing, never a fail state, and is not a member of `colleagues[]`.
- Every forward transition has an in-scene affordance. Authored copy must not name a scene, phase or route (`encodesPath`).
- A refused action always says why, in localized copy, and the message survives until a real state change replaces it.
- **The neutral auto-summary states what the player did and never evaluates it.** Its placeholder vocabulary is closed and validated at load, **on braces, not on `\w+`**.
- **Never author a case field that nothing reads** — shipped-and-dead content, same defect class as an unreachable intent.

**Organization & content**
- `src/domain/` is pure TypeScript: no Phaser, DOM, `fetch`, IndexedDB, browser APIs, **and no Zod**. `src/schemas/` owns every Zod schema, all `.strict()`. `src/adapters/` owns all side effects. Dependency direction never reverses.
- Case definitions and assets are immutable under `public/cases/` and `public/assets/`; player progress lives only in IndexedDB. **Edit only `public/cases/…`.**
- **Bump `CaseDefinition.version` on any contract change, and keep the record-compatibility allowlist honest rather than widening it.**
- Never recalculate a saved historical run against a newer experiment model.
- **A rendition's `kind` describes how the text came to be, not which schema slot is convenient** — `transcription`, `translation`, or `reconstruction`. **`rightsStatus: 'reviewed'` asserts the material *is* public-domain**, not merely that somebody looked at it. And **name a historical artifact after its verifiable anchor.**
- **Unverified provenance is recorded, never hidden, and never quoted as verified.** This story owns the 1887 instance.
- Case content carries the provenance and rights status of every historical asset and claim. Do not add an unreviewed one.

**i18n (ADR-010, NFR19)**
- EN + FR from launch, locale from the browser, no player-facing selector.
- **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria.** Build the surface list by **grepping for the read**, not from the story's file list.
- Prose the player reads is `LocalizedText` via `resolveLocalizedText`; interface strings via `translate`/`createTranslator`; proper nouns stay plain strings. Scientific values are canonical across locales — localize only for display via `formatNumber`/`formatMeasurement`/`formatRecordedValue`.
- **No webfont.** **Never join a French preposition or article to an authored label.**

**Testing**
- **Break the guard and watch a named test go red** — the project's highest-yield practice. A test that cannot fail is worse than none, because it reads as coverage.
- Know what the structural scene harness can and cannot see: **not text height.** Confirm layout claims by eye at 1280×720 in both locales.
- `typecheck:tests` at 114/60 — the count may only go down, and must not be gated in CI.
- The chromium e2e suite is green; the canvas walks are frame-timed. Never a fixed sleep.

**Platform & build**
- Offline reload is a release gate. **A schema change that makes an older cached response unparseable is a `CACHE_NAME` bump, in the same commit**, and *an additive optional field is still a bump, because `.strict()` makes every schema change breaking in the old-bundle direction.*
- All three CI workflows run the same four gates in order: `typecheck`, `test`, `build`, `test:e2e -- --workers=1`.
- Two gitignored build outputs, `dist/` and `dist-subpath/`. Edit neither.
- Never expose a raw error to the player; never log learner-entered conclusions by default.

**Performance**
- NFR1's 60 FPS profile has **never been run** — do not treat it as verified, and do not substitute an automated figure. Recorded as blocked in `docs/validation/young-performance-2026-08-07-story-2-12.md`, owned by Alexis.

### References

- Epic and story requirements — [epics.md](_bmad-output/planning-artifacts/epics.md) §Epic 4, Story 4.1; §Requirements Inventory FR2, FR4, FR5, FR18, FR19, FR24, FR25, FR26, FR27; NFR9, NFR10, NFR11, NFR19
- Case anchor and the near-null framing — [gdd.md](_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md) lines 121, 128; [decision-log.md](_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/decision-log.md) entry 0.3
- Governing rules — [project-context.md](_bmad-output/project-context.md) rev 2.6, §Engine, §Guided-Adventure, §i18n, §Organization, §Testing, §Platform, §Critical Don't-Miss Rules
- Architecture — [game-architecture.md](_bmad-output/game-architecture.md) v1.2 §Content Model, §Architectural Decisions (ADR-006 defensibility, ADR-007 portable record, ADR-008 a11y de-scope, ADR-009 SceneRouter, ADR-010 i18n, ADR-011 canvas completeness, ADR-012 direct manipulation)
- Prototype authoring review — [morley-miller-prototype.md](docs/case-prototypes/morley-miller-prototype.md) §4 provenance, §8 gap list, §Code review 2026-08-19
- Previous story — [3-4-scenario-and-proposal-authoring-contract.md](_bmad-output/implementation-artifacts/3-4-scenario-and-proposal-authoring-contract.md) §1 scope boundary, §11 service worker, §12 typecheck:tests, §15 lessons; Review Findings
- Open items — [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) lines 84, 217, 220, 247 (this story), 215, 219 (Story 4.2), 221–224, 258 (Story 4.3)
- Case content — [case.json](public/cases/morley-miller/case.json) v1.3.0; [asset-manifest.json](public/cases/morley-miller/asset-manifest.json)
- Schema — [CaseDefinitionSchema.ts](src/schemas/CaseDefinitionSchema.ts) lines 25–100 (case ids, `MAX_PRIMARY_CONTROLS`, `MAX_CONTEXTUAL_ARTIFACTS`), 186–187 (provenance/type enums), 337–420 (renditions), 824–830 (artifact/apparatus shapes), 980–1090 (`superRefine`, Young branch)
- Record compatibility — [CaseRecordSchema.ts](src/schemas/CaseRecordSchema.ts) lines 242–260, 448–478 (prototype clauses)
- Campaign-order seams — [resolveCaseId.ts](src/adapters/content/resolveCaseId.ts); [main.ts](src/main.ts) lines 60–100; [caseRecordRepository.ts](src/adapters/persistence/caseRecordRepository.ts)
- Context gate and reading — [contextPredictionReadiness.ts](src/domain/cases/contextPredictionReadiness.ts); [lecturePagination.ts](src/domain/cases/lecturePagination.ts); [LectureBookRenderer.ts](src/adapters/phaser/renderers/LectureBookRenderer.ts) lines 321–325
- Provenance rendering — [LibraryRenderer.ts](src/adapters/phaser/renderers/LibraryRenderer.ts) line 660; [CaseFilePresenter.ts](src/adapters/phaser/renderers/CaseFilePresenter.ts) line 553; [DebriefRenderer.ts](src/adapters/phaser/renderers/DebriefRenderer.ts) line 345; [en.ts](src/core/i18n/locales/en.ts) lines 163–213
- Ledger — [caseLedger.ts](src/domain/sources/caseLedger.ts); [releaseApproval.ts](src/domain/sources/releaseApproval.ts); [morley-miller-ledger.en.md](docs/source-rights/morley-miller-ledger.en.md)
- Geometry ceilings — [caseFileGeometry.ts](src/adapters/phaser/renderers/caseFileGeometry.ts) lines 40, 137–149; [libraryGeometry.ts](src/adapters/phaser/scenes/libraryGeometry.ts) line 255; [debriefGeometry.ts](src/adapters/phaser/scenes/debriefGeometry.ts) line 188
- Typography sweep — [french-typography.spec.ts](tests/e2e/french-typography.spec.ts) lines 197, 205–247, 440–560, 492
- Prototype tests and walk — [MorleyMillerPrototype.test.ts](tests/unit/MorleyMillerPrototype.test.ts); [morley-miller-prototype.spec.ts](tests/e2e/morley-miller-prototype.spec.ts); [CaseDefinition.test.ts](tests/unit/CaseDefinition.test.ts) lines 320–350, 1396–1425
- Service worker — [sw.js](public/sw.js) header list, `CACHE_NAME` v11
- External sources verified at story creation: [Final Report on Ether-drift Experiments (Wikisource)](https://en.wikisource.org/wiki/Final_Report_on_Ether-drift_Experiments); [On the Relative Motion of the Earth and the Luminiferous Ether (Wikisource)](https://en.wikisource.org/wiki/On_the_Relative_Motion_of_the_Earth_and_the_Luminiferous_Ether)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (`claude-opus-4-6`), via the `gds-dev-story` workflow.

### Debug Log References

**Mutation proofs — six guards broken, each named test observed red, each restored.** Every guard this
story added whose failure would have been silent is here.

| # | Mutation applied to `src/` (or content) | Named test that went red | Restored |
|---|---|---|---|
| A | Deleted the `MORLEY_MILLER_CASE_ID` cycle-range refinement entirely | `a second case > fails the Morley–Miller cycle-range refinement the moment it claims to be Morley–Miller` (1 failed / 291 passed) | ✅ |
| B | Removed the refinement's `definition.id ===` guard, making it unconditional | 8 tests including `a second case > carries its own control set, evidence floor and cycle range through to the parsed output` (the fixture's deliberate 2/6) and `leaves a case that is not Morley–Miller free to author its own cycle range` | ✅ |
| C | Widened `CaseRecordSchema` with `(isPrototype && version === '1.4.0' && ['1.0.0','1.1.0','1.2.0','1.3.0'].includes(...))` | `refuses a record saved before the artifact was re-anchored, as incompatible rather than invalid` | ✅ |
| D | Reversed `CAMPAIGN_ORDER` to build order (`[YOUNG, MORLEY_MILLER]`) | 7 tests across `CampaignOrder.test.ts` and `MorleyMillerPrototype.test.ts`, including `puts Morley–Miller before Young, against FR2 rather than build order` and `opens the campaign entry when no case is named, not Young` | ✅ |
| E | Flipped `isCampaignCaseUnlocked`'s `every` to `some` | `unlocks the first case with nothing completed, and nothing after it`; `does not let a completed Young unlock or reorder anything ahead of Morley–Miller` | ✅ |
| F | Lengthened one authored **French** string in the prototype (`displayName.fr`) past its band | `keeps the reading room's authored content inside the bands that hold it, in both locales` — and the failure named the case: `morley-miller artifact name morley-miller-1907-final-report [fr]: "…" (554px > 206px)` | ✅ |

**A mutation that did *not* fail, recorded because it is information.** The first attempt at proof F
lengthened a *reading-gate line* instead, and the sweep stayed green — legitimately: `LIBRARY_GATE_WRAP`
is the widest prose band in the room and a 76-character unbreakable token still fits inside it. The
proof was redone against `LIBRARY_ARTIFACT_LABEL_WRAP` (206px), the narrowest. The sweep is not blind;
that band is simply generous.

**`typecheck:tests` measured against a stashed baseline**, not eyeballed:
`git stash push --include-untracked` → measure → `git stash pop`. **Baseline 114 errors / 60 files →
106 errors / 60 files.** The count went down by 8 and the file count did not move. It briefly went to 61
files when `CampaignOrder.test.ts` was first written with an inline storage literal whose `ok: boolean`
widened past `Result<void>`; typing the fake through the exported `CaseRecordStorage` closed it.

**Two authored-content defects found by eye that no automated check could have caught** — the harness
reports a constant `height: 18` for every text object, and `LectureBookRenderer.fitBodyText` shrinks to
a floor and then overflows with **no crop**:

1. The 1907 leaf's heading (`"Printed page 525 — the final report, in full"`) wrapped to two lines at
   18px bold across the 372px page width, and its second line **collided with** the "Source page 525."
   line beneath it — `drawPage` places the heading at y=166 and the reference at y=195, a fixed 29px gap
   that assumes one line. Heading shortened in both locales; re-screenshotted clean.
2. The debrief's comparison and summary prose overran their bands. `DEBRIEF_COMPARISON_BAND_HEIGHT` is
   sized for four lines at 14px across a 560px wrap (~315 chars) and the first draft was **477**; the
   summary band is two lines at 16px (~140 chars) and the draft was **290**. Both authored down to fit
   the stated reserve rather than left to the renderer's shrink-then-crop clamp, because a cropped
   sentence is not content the player reaches. *(The prototype's summary was already over its reserve
   before this story, at 222 chars; it is now 126.)*

**The stale-`sourceId` risk surfaced loudly rather than silently**, which is worth recording because
§SS13 predicted the opposite shape: the store refuses an unknown `sourceId`, so the prototype's unit
walk failed with `Refused source.inspected: unknown-source-id` until every dispatch site moved. Nine
tests in one file, no silent degradation.

**The boot-default flip surfaced two genuine Young-shaped assumptions** that no amount of reading would
have found — both were green before and failed the moment `/` stopped meaning Young:
`offline-reload.spec.ts`'s warm-up waits on *Thea's portrait*, a Young asset a Morley–Miller boot never
fetches; and `subpath-hosting.spec.ts` asserted a hand-copied list of Young's five portraits against a
bare-root navigation.

**Verification of external sources.** The 1887 excerpts were checked against the Internet Archive
facsimile of the exact cited issue (`sim_american-journal-of-science_1887-11_34_203`, *AJS* vol. 34
no. 203, November 1887), read against its printed running heads — which is how pages 333/334/341 were
established. The 1907 text and its public-domain status were checked against the linked Wikisource page.

### Completion Notes List

**All 10 ACs met. The case is complete and, correctly, still ledger-BLOCKED.**

- **AC1 — the secondary artifact is the 1907 final report.** `morley-miller-1905-reconstruction` is
  replaced by `morley-miller-1907-final-report`: Morley & Miller (1907), *Science* N.S. XXV, p. 525,
  public domain, transcribed **in full** (the report is one paragraph) as `published-book` /
  `primary-material` — so the `reconstruction` workaround 3.2 needed is no longer forced. Two artifacts
  still, per `MAX_CONTEXTUAL_ARTIFACTS`. Every reference in §SS4's table swept; `grep -rn 1905` over the
  case file returns nothing. **One citation discrepancy recorded rather than averaged:** the archive page
  says issue "No. 2" where the common form is 25(641), so `citationText` carries only volume, page and
  date, and the review artifact asks a reviewer to settle it.
- **AC2 — the 1887 excerpts are verified, not de-claimed.** Open Question #2's default was option (b)
  (de-claim honestly); a facsimile of the *cited issue* turned out to be reachable, so **option (a) was
  achieved instead** — the strictly better outcome the deferred item actually asked for. Three
  divergences found and fixed: a paraphrase that had changed the sentence's meaning (*"the motion of the
  particles of the body"* for *"the motion of the earth in its orbit"*, plus a dropped clause and a
  truncated second half), lost commas in the concluding excerpt, and a section that spans **two** printed
  pages rather than one (`sourcePages: [333, 334]`). **341 was correct** and is now genuinely verified.
  French renditions re-translated against the corrected English. `deferred-work.md:217` and `:247` struck
  with what was found.
- **AC3 — a bounded near-null, never a perfect zero.** The authors' own numbers (1.53 wave-lengths
  demanded; certain to one eightieth) reach the player in the curated record *and* the debrief, verified
  by eye in both locales. No `conclusionProposal` added or reworded — that is 4.3's.
- **AC4 — provenance on every context surface.** Verified rather than built, as the AC directs:
  screenshots confirm the re-anchored artifact resolving through `LibraryRenderer` (detail panel:
  *"Ouvrage publié · Source primaire"*), `CaseFilePresenter` (pinned source rows) and `DebriefRenderer`
  (cited-sources band) in French, and the reconstruction is no longer presented as anything.
- **AC5 — the loop is reviewed before production.** `docs/case-reviews/morley-miller-case-review.md`
  maps every clause to the field that carries it, and `flow.maximumExperimentCycles` is 6 → **4** with a
  load-time refinement. It says plainly that **nothing in `src/` reads either cycle field**, so the
  change is a contract correction and not a cap.
- **AC6 — campaign lock order declared, enforced and read.** `src/domain/cases/campaignOrder.ts` (pure);
  `resolveCaseId` reads it; **the boot default flipped** per Open Question #1. `?mode=validation` stays
  on Young deliberately — `young-validation-plan.md` names that route as validating *the Young
  laboratory*, so it is the route's purpose rather than a leftover assumption.
- **AC7 — the sweep measures both cases.** The single Young-only parse in
  `french-typography.spec.ts` is now `SHIPPED_CASES` over `KNOWN_CASE_IDS`, covering every surface the
  task named, in both locales, with the case id in every label. Mutation-proved. **No overflow was found
  in the prototype's prose** at the current bounds; the two defects that *were* found are height claims
  the sweep cannot make, found by eye and fixed. `deferred-work.md:84` and `:220` struck.
- **AC8 — bilingual.** Every added or changed string carries `en` and `fr`; localized lists are equal
  length; the generated ledger renders in both. Surfaces checked by grepping for the *read*, per §SS10.
- **AC9 — contract, version, cache, ledger.** `case.json` 1.3.0 → **1.4.0**; `sw.js` →
  **`quantique-bootstrap-v12`** with its reason appended; `npm run audit:ledger` re-run and both
  generated files committed. **The `1.4.0` record clause deliberately lists no prior version** — the
  artifact id moved and a saved record holds it in `inspectedSourceIds`, which `CaseRecordSchema` already
  cross-checks and rejects, so listing 1.0.0–1.3.0 would only downgrade an honest
  `incompatible-case-record` into `invalid-case-record`. The exclusion is asserted by name.
- **AC10 — verification.** Four gates green: `typecheck` clean, **1523** unit tests passing (80 files),
  `build` and `build:subpath` succeed, **64/64** e2e passing on an idle machine.
  `typecheck:tests` **106 / 60**, down from 114 / 60. Six mutation proofs recorded above.

**Answers to the story's Open Questions.** #1 — the boot default **flipped**, as recommended; #2 —
resolved as option **(a)**, better than its default, because a facsimile of the cited issue was
reachable; #3 — the reviewer and educator context sheet remain **unassigned** and the case is reported
**BLOCKED**, with no name authored to clear a row; #4 — recorded in `deferred-work.md` with **Story 4.2**
as candidate owner and put to Alexis in the review artifact.

**Deliberately not done** (§SS1, each owned elsewhere): the bench artwork, the model constants and
`formatMeasurement`'s separator (**4.2** — a second manifestation of the separator gap was found on this
case and added to that item); the bounded conclusion, the overclaim refusal and revision feedback
(**4.3**); no third artifact, no new scene or phase, no fourth `src/ui/` module, no registry; the five
orphaned `src/game/scenes/*` files untouched. **Four new items recorded with owners**, three of which are
"authored field nothing reads" instances found while working: the cycle fields, `citation.reuseStatement`
(which is why AC2 was verified rather than de-claimed — a caveat there would never reach the player),
`debrief.sourceRefs`, and the now-unexercised `reconstruction` rendition kind.

### File List

**New**

- `src/domain/cases/campaignOrder.ts`
- `src/adapters/persistence/completedCampaignCases.ts`
- `tests/unit/CampaignOrder.test.ts`
- `docs/case-reviews/morley-miller-case-review.md`

**Modified — source**

- `src/main.ts`
- `src/adapters/content/resolveCaseId.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/core/i18n/resolveLocalizedText.ts` (comment)
- `src/domain/cases/CaseDefinition.ts` (comment)
- `src/domain/apparatus/calculateInterferometerDrift.ts` (comment)

**Modified — content, worker, generated**

- `public/cases/morley-miller/case.json`
- `public/sw.js`
- `docs/source-rights/morley-miller-ledger.en.md` (generated)
- `docs/source-rights/morley-miller-ledger.fr.md` (generated)

**Modified — tests**

- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/MorleyMillerPrototype.test.ts`
- `tests/e2e/canvasHelpers.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/subpath-hosting.spec.ts`
- `tests/e2e/canvas-transitions.spec.ts`
- `tests/e2e/dialogue-advance.spec.ts`
- `tests/e2e/library-reading.spec.ts`
- `tests/e2e/offline-reload.spec.ts`
- `tests/e2e/rival-lab.spec.ts`
- `tests/e2e/scene-router.spec.ts`
- `tests/e2e/validation-route.spec.ts`
- `tests/e2e/young-canvas-experiment.spec.ts`

**Modified — docs and tracking**

- `docs/case-prototypes/morley-miller-prototype.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-morley-miller-historical-case-record.md`

## Change Log

| Date | Version | Change | By |
|---|---|---|---|
| 2026-08-20 | 0.1 | Story context created from epics.md §Epic 4 Story 4.1, gdd.md and its decision log, project-context.md rev 2.6, the 3.2 prototype artifact, deferred-work.md, and the source at HEAD `62b65b2`. The 1907 anchor and the 1887 excerpt divergences were verified against the cited archives at creation time. | Scrum Master |
| 2026-08-20 | 1.0 | Story implemented. The secondary artifact is re-anchored from the 1905 reconstruction to a full transcription of the genuine **1907** final report (*Science* N.S. XXV, p. 525), with the complete rename swept and re-grepped. The 1887 excerpts were **verified against a facsimile of the cited issue** rather than de-claimed — three divergences found and corrected, including a paraphrase that had changed the sentence's meaning and a section spanning two printed pages (`[333, 334]`). The bounded-null distinction (1.53 wave-lengths demanded, certain to one eightieth) now reaches the player in the curated record and the debrief. `flow.maximumExperimentCycles` 6 → 4 with a `MORLEY_MILLER_CASE_ID` refinement. New `src/domain/cases/campaignOrder.ts` puts Morley–Miller before Young and **the boot default flipped** to the campaign entry, with `?mode=validation` deliberately held on Young. The French typography sweep now measures **every** shipped case. `case.json` 1.4.0, `sw.js` v12, ledger regenerated (still **BLOCKED**, correctly). Six guards mutation-proved; `typecheck:tests` 114 → **106** errors. Two authored-content layout defects found by eye and fixed. | Dev Agent (Link Freeman) |

## Open Questions for Alexis

Saved for the end, as the workflow requires. None blocks the start of implementation — #1 and #2 each have a stated default so the dev agent can proceed either way.

1. **Does the boot default flip to Morley–Miller in this story, or in 4.3?**
   AC6 asks for the campaign lock order, and three separate code comments say this story owns it. §SS8 sets out both branches. The recommendation is to **flip it now**: it makes AC6 true of behaviour rather than of a module, and the e2e cost — replacing about forty `page.goto('/')` sites with a helper that names the case — removes a Young-shaped assumption baked into the suite rather than adding one, which is the project's top Don't-Miss rule. The cost is that until Story 4.2 re-skins the bench, a fresh boot shows Morley–Miller on Young's optical bench; that window is inside this epic, and the case is ledger-BLOCKED so it cannot reach a player either way. The fallback keeps the default on Young behind one named, dated constant whose removal is an AC of 4.3 — no e2e churn, but the seam is a fig leaf and must be named as one in three places. The dev agent will build the pure module and its tests first, so this only affects the final wiring step; absent an answer it will take the recommendation.

2. **If the 1887 page attributions cannot be verified against a facsimile, which fallback do you want?**
   §SS5 found the excerpts are close paraphrases rather than transcriptions, and Wikisource carries no printed page markers, so 333/341 cannot be confirmed from the artifact's own archive link. The default is **(b)**: correct the wording to the archived text verbatim, attribute only the page the citation itself supports, and say so in `citation.reuseStatement` in both locales — because the page number is printed on the player's screen and a caveat in a code comment is not. **(a)** — find a facsimile and verify — is strictly better if you have one, or know where one is; `ajsonline.org` refuses automated fetches. Say if you would rather the excerpt be dropped to one verified section than carry two.

3. **The scholarly reviewer and the educator context sheet are still unassigned.**
   `evaluateLedgerReleaseApproval` resolves this case to **BLOCKED** on `scholarly-review-pending` and `educator-context-sheet-pending`, and that is the honest verdict for two roles nobody has been assigned to. The story deliberately does not author a name to clear a row. AC1's *"reviewed 1907-report and 1887-source context"* is met at the level of `rightsStatus` — the material is public domain and the citation is real — but *scholarly sign-off* is a person, not a patch, and it gates release rather than this story. If you want epic 4 to close with a green ledger, the assignment needs to happen; the story will report the case as BLOCKED and say why.

4. **`flow.minimumExperimentCycles` / `maximumExperimentCycles` are read by nothing in `src/`.**
   §SS6 brings the prototype's authored range to FR25's two-to-four and adds a load-time refinement so a future author cannot violate it, but nothing caps the player's runs — two code comments say so explicitly, and the condition applies to Young equally. Should the cap become real (the notebook already pages, so it is a gating change, not a layout one), or should the fields be documented as advisory content metadata? Either way it needs an owner story; the candidate is 4.2, which owns the experiment loop.

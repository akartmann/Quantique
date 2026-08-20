# Morley–Miller prototype — authoring review

**Story 3.2 · 2026-08-19 · baseline `efaf980` · `public/cases/morley-miller/case.json` v1.0.0**

The first case this framework has carried that is not Young's. It exists to be *compared with* Young by
a content author and a scholarly reviewer, and its value is almost entirely in what that comparison
exposes — so this document is written as an inventory of three things: what had to be authored, what was
reused without a line of change, and what the framework refused until it was changed.

It is a **prototype**, not the tutorial. Epic 4 owns the calibrated model, the thermal-drift teaching
loop, the scholarly-reviewed narrative and the bounded conclusion. This is complete enough to load,
play, and review.

---

## 1. The headline: three walls, all of them green

None of the three things that stopped a second case was a crash, and none was caught by the 1293 tests
passing at baseline. Each was a **silent or misdirected refusal** that only existed for a case that did
not yet exist.

| # | Where | What the player got | Was it in the backlog? |
|---|---|---|---|
| 1 | `AppState.ts` `reduceExperimentRun` | Every run refused with `invalid-young-model-input` — *"The selected apparatus inputs cannot produce a fringe spacing"* — for an apparatus that has no fringe spacing. Two hard-coded control names read `undefined`. | Yes, owner: this story |
| 2 | `conclusionReadiness.ts` | The theory board could **never** unlock. `non-physical-young-run` refused every selected run because `modelInputs` is `YoungModelInputs`; `distinct-run-configurations` compared three `modelInputs` names that were all `undefined`, so its `.some(...)` was false whatever the player did. | **No** — found writing the story |
| 3 | `ApparatusRenderer.ts` | *"The bench is dark at 0 slit spacing and 22 screen distance"* — the rotation angle printed as a slit spacing. `selectFormattedControlValue` is total, so it degraded rather than throwing. Nothing failed; the sentence was simply false. | No |

Wall 2 is the deepest: `evaluateConclusionReadiness` is the sole completion authority (ADR-006), so a
second case could reach synthesis, pin two runs, save a comparison — and read two English sentences
about Young in front of a conclusion list that would never open.

All three are now covered by tests that go red when the guard is broken. Seven mutation proofs were run,
each broken and restored (§5).

---

## 2. What was authored

`public/cases/morley-miller/case.json` (37 KB) and `asset-manifest.json`. Everything below is content;
none of it required a contract change beyond §3.

- **Two primary controls** — `rotationDeg` (0–180°, step 15) and `bathTempC` (18–24 °C, step 0.5).
- **A deterministic model** — `morley-miller-interferometer`, `displacement = A·cos(2θ) + k·(T − T₀)`.
- **Two contextual artifacts**, both `reviewed`, both with a bilingual textual rendition (§4).
- **Four colleagues** as coded silhouettes (D5) — Edith Vance, Tomás Reyes, Harriet Lowe, Nils
  Abrahamsen. **No new art**; the asset manifest carries the shared logo alone.
- **Four prediction proposals, four conclusion proposals**, two of them defensible and two authored
  `never` (an overreach and a blame-the-instrument).
- **A rival lab** — "The Cleveland bench" — with one critique per conclusion proposal.
- **Four consultation rules, three peer-review rules** (including an overreach rule with bilingual
  detection phrases), **four colleague hints**, **three reading-gate lines**.
- **A significance rule** over `rotationDeg` alone, with **no** `criticalModelInputIds` — this case
  records no model inputs, and the schema rejects an empty list.
- **A scenario script** mapping all six phases, a debrief, an auto-summary, and a `title`.
- **Every string in both EN and FR**, validated for locale completeness by Zod (AC6).

### The physics, and what it is not

```
displacement = ORIENTATION_AMPLITUDE · cos(2θ) + THERMAL_COEFFICIENT · (bathTempC − STABLE_WINDOW_C)
               A = 0.01                          k = 0.05 / °C        T₀ = 20.0 °C
```

`cos(2θ)` gives the orientation term its physical period — 90° reverses the sign, 180° returns to the
start — which is what makes two orientations at the stable window a genuinely distinguishing pair. At
22 °C the thermal term is 0.10 and swamps the ±0.01 orientation term entirely; at 20.0 °C it vanishes
and what remains is the near-null signal the historical result actually was.

> **These constants are invented, not sourced.** They are a defensible *shape* for the FR19 teaching
> loop. Calibrating them against the 1907 final report's published numbers, and having that agreement
> reviewed, is **Story 4.2's** work. The docstring on `calculateInterferometerDrift.ts` says so too, so
> nobody later reads them as historical. Raised as story Open Question 4.

---

## 3. What required a framework change, and why

Five changes, each one a guarantee that Young had been holding for the whole system by being the only
case. Each is stated here with where the guarantee now lives.

1. **A per-case experiment model seam.** `src/domain/apparatus/experimentModels.ts` — a closed exported
   list and a lookup. Keyed on an authored `experiment.modelId`, **never** on the case ID (which would
   put a second per-case branch in the *store*, the layer Story 3.1 deliberately kept one out of) and
   never on `modelVersion` (which is the per-run provenance stamp: bumping it must not change which
   physics runs). Two entries, **no registry** — at two models the list is the whole mechanism (D3).
   *Guarantee moved:* "the bench runs the right physics" was held by there being one physics. It is now
   held by the schema, at load.

2. **`experiment.modelId` validated at load, with its path named.** An unimplemented model is refused
   when the case is read, not when the player presses start — "no authored content may leave a gate
   unsatisfiable", applied to the model itself. **Extended beyond the story's ask:** each model also
   declares `requiredControlIds`, checked against the case's `apparatus.primaryControls`, because a
   model fed controls the case does not author is wall 1 one layer down. This *tightens* the contract:
   a one-control apparatus is still a valid shape, but is now rejected while it names a two-control
   model. `CaseDefinition.test.ts` states both halves.

3. **Two evaluator rules re-expressed** (wall 2). `non-physical-young-run` → **`foreign-model-run`**,
   asking `run.experimentModelVersion !== definition.experiment.modelVersion` — the provenance stamp
   every run carries, for any case. A hand-built fixture run, which is what the rule existed to keep
   out, still fails it. `distinct-run-configurations` is now decided by `configurationKey(...)` from
   `significantMeasures.ts` — **reused, not re-derived**, because two answers to "are these the same
   configuration?" would drift and the gate would count two where the board refused one.

4. **`reduceRecordRun`'s bench-match and model-version checks hoisted** out of `if (modelInputs)`. Both
   are claims about the *run*, not about Young's optical inputs; inside the branch a case recording none
   was validated strictly **less** than Young. A no-op for Young, a strengthening for everyone else —
   and it is what makes `RunRecord.modelInputs` genuinely optional rather than nominally optional (D4).

5. **The bench, notebook and printable record de-Younged** (wall 3, and two more found alongside it).
   `lab.idle` composes from `apparatus.primaryControls`; the result readout reports the run's own
   labelled value instead of falling to "nothing recorded yet"; `lab.pattern.recorded` reports the run's
   own quantity; the notebook's settings row is a list over the apparatus rather than a two-slot
   sentence naming Young's controls; and `print.observations.preModel` — *"not treated as a physical
   Young measurement"* — is replaced, because for this case it was printed over **every** observation
   the player made, in the record they take away.
   *Guarantee moved:* result labels are canonical English in the record, so each model now declares a
   `resultLabelKey` and the bench, notebook and print view all localize through it. Reading
   `result.label` directly put English prose on a French screen.

Plus the review route (`?case=`, allowlisted, §6) and Young's version bump (§7).

---

## 4. Provenance and rights (AC7)

Both artifacts are `reviewed`, both carry a real citation and an HTTPS archive URL, and **their
provenance category and source type describe what they actually are** — which is the operative rule,
and the reason the two are not the same kind of thing.

| Artifact | Type / provenance | Citation | Archive |
|---|---|---|---|
| `michelson-morley-1887` | `published-book` / `primary-material` | Michelson & Morley (1887), *American Journal of Science* 34(203), 333–345 | Wikisource (public domain, published 1887) |
| `morley-miller-1907-final-report` (was `morley-miller-1905-reconstruction`, re-anchored by **Story 4.1**) | `published-book` / `primary-material` | Morley & Miller (1907), *Science* N.S. XXV, p. 525 | Wikisource (public domain, published 1907) |

**Why the second *was* a reconstruction, and why it is no longer one.** The schema requires the English
rendition to be the single rendition of record. For the 1887 paper the excerpts are genuine passages of
the published text. For the **1905** report they were **not**: the prose was written for this
investigation, and labelling it a transcription of the original would have been a provenance claim
nobody had reviewed — exactly what AC7 forbids. So that artifact declared itself a reconstruction, its
`creatorOrOrigin` said so, its `reuseStatement` told the reader in both languages, and the citation
pointed at the original it restated. The vocabulary has a `reconstruction` category precisely for that.

**Story 4.1 removed the need for the workaround** rather than keeping it. The GDD anchors this tutorial
on **1907**, and the 1907 *Final Report on Ether-drift Experiments* is a single paragraph in the public
domain — short enough to transcribe in full. So the slot now holds a genuine `transcription` of
`primary-material`, quoting the authors' own numbers (a demanded displacement of 1.53 wave-lengths,
certain to about one eightieth of it) instead of prose restating them. The `reconstruction` vocabulary
member remains legitimate and documented, but **no shipped case exercises it any more**; that is
recorded in `deferred-work.md` for the next case author.

> **✅ Verified by Story 4.1 (2026-08-20).** The 1887 excerpts and their page attributions **were**
> checked against a facsimile — the scanned issue on the Internet Archive
> (`sim_american-journal-of-science_1887-11_34_203`), which is the very issue the citation names, read
> against its printed running heads. Three corrections came out of it, and they are the reason the check
> was owed rather than assumed:
>
> 1. The second excerpt of the opening section was a **paraphrase**, not a transcription — it dropped
>    the clause *"in view of the experiments just cited"*, changed *"the motion of the earth in its
>    orbit"* to *"the motion of the particles of the body"*, and stopped short of the sentence's second
>    half. It is now verbatim.
> 2. The concluding excerpt had lost the source's commas: *"It appears, from all that precedes,
>    reasonably certain…"*. Restored.
> 3. The opening section spans **two** printed pages, not one. Its first paragraph is on 333 and its
>    second on **334** (the running head for 334 falls between them), so `sourcePages` is `[333, 334]`
>    and the leaf now says so. **341 was correct** and is now genuinely verified: the running head for
>    page 341 immediately precedes the concluding excerpt.
>
> What remains open for the scholarly reviewer is the *reading* — whether these are the right excerpts,
> fairly framed — not the wording or the pages. The role is still unassigned and this case is still
> ledger-**BLOCKED** on it.

**Accessibility reviewer:** the epic's acceptance criteria name one. That role is **de-scoped by
ADR-008**, not silently dropped. No new accessibility-parity assertion was added and no existing a11y
spec was deleted.

### Sign-off

**Fed by the ledger** (Story 3.3; regenerated by the code review of 3.3). Run `npm run audit:ledger` and
read `docs/source-rights/morley-miller-ledger.en.md`, which is written from this case's authored `ledger`
block. The rows below are a convenience copy of that file and **not** the record — the generated file is.
The Sign-off and References
tables below are that surface's own rows, read from this case's authored `ledger` block rather than
transcribed here, and the ledger is the evidence reference for each.

| Role | Name | Date | Status | Evidence |
|---|---|---|---|---|
| Content author | Claude (Story 3.2 development) | 2026-08-19 | Signed off | `morley-miller-ledger.en.md` — Sign-off |
| Scholarly reviewer | *unassigned* | — | **Pending** — see the transcription-fidelity gap | `morley-miller-ledger.en.md` — Sign-off |
| Accessibility reviewer | — | — | De-scoped (ADR-008) | `morley-miller-ledger.en.md` — Sign-off |
| Educator context sheet | *unassigned* | — | **Pending** | `morley-miller-ledger.en.md` — References |
| Accessible-controls reference | — | — | De-scoped (ADR-008) | `morley-miller-ledger.en.md` — References |

**What Story 3.3 actually did.** It built the ledger and pointed it at this table. The prototype's
`case.json` went to 1.1.0: each source gained a `ledgerEntry` — the 1887 paper `primary`, the then-1905
reconstruction `secondary` — its one manifest asset gained a `rights` block, and the case gained the
`ledger` block the five rows above are read from. `evaluateLedgerReleaseApproval` resolves this case to
**BLOCKED** on two named rows, `scholarly-review-pending` and `educator-context-sheet-pending`, which is
the honest verdict for the two roles nobody has been assigned to yet. Its single asset is the cleared
`quantique-logo` and both sources are `reviewed`, so neither contributes a blocker.

Nothing was authored `reviewed` to close a row: a name nobody supplied would be the defect AC7 forbids,
and the two open roles stay open until Alexis assigns them. The reconstruction's `rightsStatus:
'reviewed'` is likewise untouched — whether that is correct is the assigned scholarly reviewer's call,
carried in `deferred-work.md`.

---

## 5. What was reused unchanged

This table is the story's real argument. Every row was verified definition-driven at baseline and
carried the prototype with **no change at all**.

| Concern | Where |
|---|---|
| Control bounds, steps, normalisation | `reduceControlSet`, `normalizeControlValue` |
| Run snapshot validity, against the case's own authored controls | `RunRecord.ts` `validateControls` / `runControlContract` |
| Significance counting and configurations | `significantMeasures.ts` |
| Colleague hints and reading-gate hints | `colleagueHints.ts`, `readingGateHints.ts` |
| Rival-lab critique selection | `rivalLabRules.ts` |
| Conclusion support predicates | `conclusionProposals.ts` |
| Recognition | `recognitionRules.ts` |
| Scene routing | `SceneRouter.ts` |
| Wavelength chooser (correctly absent) | `selectWavelengthChoices` returns `[]` |
| Auto-summary | `caseSummary.ts` |
| Asset preload, record repository (both keyed by case ID) | `preloadCaseAssets`, `caseRecordRepository` |
| Peer review, consultation, revision history | `peerReviewRules.ts`, `ConsultationRule.ts` |
| The whole Phaser scene layer, every renderer, every overlay | `src/adapters/phaser/**` |

The `550 nm` baseline the store initialises for **every** case was confirmed inert here, as the story
asked rather than assumed: the chooser is not drawn, `reduceWavelengthSet` refuses every advanced value
against an empty `advancedChoicesNm`, and no `550` reaches the prototype's run records, its printable
record or its auto-summary. **Only the auto-summary half is asserted in the e2e walk**
(`expect(recordedAutoSummary(page)).not.toContainText('550')`); the run-record and printable-record
halves are not asserted anywhere. (Corrected in review 2026-08-19 — the sentence claimed all three.)

### Verification

- `npm run typecheck` — clean.
- `npm test` — **1334 tests / 74 files** (baseline 1293 / 71).
- `npm run test:e2e` (chromium) — green on an idle machine.
- **Seven mutation proofs**, each broken and restored: the `foreign-model-run` guard, the
  `distinct-run-configurations` guard, the `reduceRecordRun` hoist, the model seam, the `modelId`
  load-time refusal, and the required-control pairing. A seventh was run against the **e2e walk**
  itself — reverting the readiness rule to its Young-shaped form makes the walk fail, so it is not
  passing vacuously.

---

## 6. The review route

`?case=morley-miller`, allowlisted in `src/adapters/content/resolveCaseId.ts`, defaulting to
`young-interference` — following the established `?mode=validation` precedent for a reviewer-facing
entry point that is not a game feature.

An unknown or unlisted value **falls back to the default** rather than reaching `loadCaseDefinition`,
which composes a `contentPath` from it: a reviewer-supplied string reaching that call would be a fetch
built from a query parameter.

This is **not campaign selection**. No picker, no menu, no unlock order — Story 4.1 owns those, and FR2
puts Morley–Miller *before* Young in the campaign, so a picker built here would pre-empt that decision.
The record repository is already scoped by case ID (`repository.load(caseResult.value.id)`), so the two
cases cannot cross-contaminate saved progress; that is now asserted rather than assumed.

---

## 7. Young is unchanged

`public/cases/young-interference/case.json` → **1.19.0**, adding exactly two fields: `title` and
`experiment.modelId: "young-double-slit"`. Verified **by diffing the file**, not assumed: the whole
document apart from `version`, `title` and `experiment.modelId` compares byte-identical to 1.18.0.

`modelVersion` is untouched at `young-double-slit-v1`, so every persisted run's `experimentModelVersion`
still matches and no saved reading is recalculated — which is exactly why `modelId` and `modelVersion`
are two different fields. `CaseRecordSchema.schemaVersion` stays `3` and `migrateCaseRecord.ts` is
untouched.

**The compatibility allowlist is now scoped by case ID.** Its clauses are Young's changelog, and since
Story 3.1 two cases share one version namespace — so an unscoped list would have let `morley-miller` at
some future `1.2.0` silently inherit Young's `['1.0.0', '1.1.0']` reasoning, about a file it has never
been part of.

---

## 8. What remains Young-specific — the gap list

Every one of these is mirrored into `deferred-work.md` with a named owner.

1. ~~**The bench artwork is Young's** — light source, slits, barrier, the run animation.~~ **CLOSED by
   Story 4.2** (2026-08-20). A reviewer opening this case now sees a rotating interferometer: a stone
   floating in a temperature bath, carrying a beam splitter, two perpendicular arms with their end
   mirrors, and the recombined path out to the observing screen. The rotation is bound to
   `activeControlValues.rotationDeg` and the bath's colour to `bathTempC`; both come from the store and
   neither is inferred. `Graphics` fill commands only, generated in the create pass — no texture, no
   `assets.entries` row, no ledger row, which this case being ledger-**BLOCKED** made a requirement
   rather than a preference.

   The load-bearing part is *how* the artwork is chosen. `renderApparatusGeometry` used to decide which
   case it was drawing from `Number.isFinite(slitSpacingMm) && Number.isFinite(screenDistanceM)` — two of
   Young's control ids read off a case that does not author them. That guard is **deleted**, and the
   tableau is selected from the case's own `experiment.modelId` through an exhaustive
   `Record<ExperimentModelId, …>`, so a third model shipped without artwork is a `tsc` error rather than a
   blank screen no test can see. The three things the guard was silently holding — the slit/screen
   placement, the choice between the two fringe painters, and the geometry test's apparatus floor — are
   each re-stated where they belong.

   The screen was already not part of this gap: the code review of 2026-08-19 (decision D1) delivered
   `paintDisplacedFringes` after finding that the prototype ignited for the full 2.4 s and resolved onto a
   screen nothing had painted. That painter moved into the new tableau essentially unchanged — **with one
   exception the code review of 4.2 found recorded here as "verbatim"**: the fringe field's colour was
   wavelength-derived (550 nm, green) and is now a fixed off-white, because this apparatus authors no
   wavelength for a player to choose or see. The change was kept on Alexis's call and is noted here because
   it is the story's one player-visible pixel change and was, until then, written down as not existing.
2. ~~**Transcription fidelity and page attribution** of the 1887 excerpts~~ — **closed by Story 4.1**
   (2026-08-20): verified against the facsimile of the cited issue, three corrections applied, pages now
   `[333, 334]` and `[341]`. See the ✅ block in §4. What is still open is the reviewer's *reading*, not
   the transcription.
3. ~~**`formatMeasurement` puts its locale separator before every unit**~~ — **CLOSED by Story 4.2**
   (2026-08-20). The separator is now a function of `(locale, unit)` across three classes: **none** before
   an arc degree (`0°`, in both locales), U+202F before an SI symbol, and a full U+00A0 before a
   spelled-out unit — which closes the converse manifestation the 4.1 review found by eye, the case file's
   `0,11largeurs de frange`. Young's four units (`mm`, `m`, `nm`, `°C`) format **byte-identically** to
   before, and `I18n.test.ts`'s original `formatMeasurement` expectations pass unchanged as the regression
   fence. Three mutation proofs, including the near-miss the rule has to survive: classifying on a prefix
   rather than on equality would have taken the space off every `°C`.
4. ~~**The French typography sweep covers interface chrome and Young's authored content only.**~~ —
   **closed by Story 4.1** (2026-08-20): `tests/e2e/french-typography.spec.ts` now sweeps every case in
   `SHIPPED_CASE_IDS` for source names, control and inline labels, the composed idle and notebook rows,
   colleague names, proposal texts, conclusion claims and limitations, dialogue beats, colleague hints,
   reading-gate lines, rival-lab critiques and the reading-room bands, in both locales, with the case id
   in every sample label. No overflow was found in the prototype's prose.
4b. **The model constants are teaching-chosen, and now say what they owe.** Story 4.2 named the two
   figures the case's own 1907 transcription publishes — a demanded displacement of 1.53 wave-lengths,
   certain to one eightieth of it — as constants the model reads, and asserts `ORIENTATION_AMPLITUDE`
   *inside* that published residual bound. The values themselves did **not** move, and the reason is worth
   a reviewer's attention: deriving the amplitude exactly (`1.53 / 80` ≈ 0.019) changes every recorded
   number, which requires bumping `experiment.modelVersion` — and `validateCaseRecordForDefinition`
   compares that stamp with unconditional equality and refuses the *whole* saved record, with no allowlist
   mechanism and no migration. So the anchoring is a bound rather than a derivation, and the missing
   record-compatibility path is recorded in `deferred-work.md` with an owner.

5. **`reduceRecordRun` re-derives the result only for a run carrying `modelInputs`.** A prototype run's
   result is validated for bench-match and model version but not recomputed from the model — **Epic 4**.
6. **`experiment.wavelengthNm` is still authored-and-unread** for Young; the prototype omits it. The
   seam did not consume it — **Epic 4**.
7. **The persisted `450|550|650` unions and the two minimum-mode `550` literals** remain; both need a
   record migration — **Epic 4**. This story added no eleventh `550`, and removed one by passing
   `selectedWavelengthMode` through the model session rather than deriving it from `=== 550`.
8. **`CaseRecordPrintView` still has no unit coverage** — the unit suite has no DOM and adding one is a
   new dependency. Its new settings line is covered end-to-end instead.


## Code review, 2026-08-19

Three parallel review layers over `efaf9802..08c0977`. Six decisions resolved by Alexis, twenty-one
patches applied, one item deferred, three findings dismissed as false. What the review changed in this
prototype's own content and contract:

- **The screen paints.** `paintDisplacedFringes` — see gap 1 above. The bench previously ignited for the
  full 2.4 s onto an empty `fringeGraphics`.
- **A completed investigation survives a reload.** The completion walk in `validateCaseRecordForDefinition`
  hard-required Young's `modelInputs` and then recomputed against Young's calculator unconditionally, so
  finishing the prototype discarded the whole saved case on the next boot.
- **`rotationDeg` 0–180 against a `cos(2θ)` model makes the travel endpoints one reading.** 0° and 180°
  both read 0.11 at 22 °C. The e2e walk dragged exactly that pair while asserting two *distinguishing*
  runs; it now varies to 90° (0.11 vs 0.09). `bathTempC` joined `significanceRule.criticalControlIds`, so
  the same-rotation/different-temperature pair the `resetPath` teaches stops being refused as one setup.
- **The 1905 artifact declares what it is.** Its rendition of record was `kind: 'transcription'` over prose
  its own `reuseStatement` says was written for this investigation. A `reconstruction` rendition kind now
  exists and it uses it. The artifact was also named **1907** throughout against a genuine **1905**
  citation (Morley & Miller, *Proc. Amer. Acad. Arts & Sci.* 41(12), 321–328, with a matching Wikisource
  URL); the naming was aligned to the citation, because that is the verifiable anchor. `rightsStatus`
  is unchanged and left to the scholarly reviewer.
  *(Story 4.1 resolved this the other way round: rather than keep a 1905 artifact, it re-anchored the slot
  to the genuine **1907** final report the GDD names — short, public domain, and a real transcription. The
  reasoning above is why a 1907 title was not simply reinstated over the 1905 citation.)*
- **`conclude-bounded-null` now enforces the steady bath it claims** — through
  `unvaried-control-pinned bathTempC`, scoped to the runs the player pinned. Scoping matters: asking it of
  every recorded run would have made the claim unreachable for anyone following the `resetPath`.
- **Localized copy.** `unit: 'fringe widths'` reached French readers unchanged (now keyed on the model);
  the case-file observation row showed *no apparatus settings at all* for the prototype; `rotationDeg 135`
  at the stable window rendered **"-0"**; and each control now authors an `inlineLabel` so the composed
  bench sentence reads correctly in both languages.

Still open, and still needing a person rather than a patch: the 1887 excerpts' transcription fidelity and
page attribution, and the scholarly sign-off. AC7 is PARTIAL until those are done.

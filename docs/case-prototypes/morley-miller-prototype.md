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
> loop. Calibrating them against the 1905 report's published numbers, and having that agreement
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
| `morley-miller-1905-reconstruction` | `reconstruction` / `reconstruction` | Morley & Miller (1905), *Proc. Amer. Acad. Arts & Sci.* 41(12), 321–328 | Wikisource (public domain) |

**Why the second is a reconstruction, and why that matters.** The schema requires the English rendition
to be the single `transcription` of record. For the 1887 paper the excerpts are genuine passages of the
published text. For the 1905 report they are **not**: the prose was written for this investigation, and
labelling it a transcription of the original would be a provenance claim nobody has reviewed — exactly
what AC7 forbids. So the artifact declares itself a reconstruction, its `creatorOrOrigin` says so, its
`reuseStatement` tells the reader in both languages, and the citation points at the original it
restates. The vocabulary has a `reconstruction` category precisely for this.

> **⚠ Open for the scholarly reviewer.** The 1887 excerpts are reproduced from memory of a public-domain
> text and their **page attributions (333, 341) have not been checked against a facsimile**. That
> verification is a named gap below, owned by Story 4.1. Nothing here should be quoted as a verified
> transcription until it is done.

**Accessibility reviewer:** the epic's acceptance criteria name one. That role is **de-scoped by
ADR-008**, not silently dropped. No new accessibility-parity assertion was added and no existing a11y
spec was deleted.

### Sign-off

**Fed by the ledger** (Story 3.3). Open `?ledger=1&case=morley-miller` — the Sign-off and References
tables below are that surface's own rows, read from this case's authored `ledger` block rather than
transcribed here, and the ledger is the evidence reference for each.

| Role | Name | Date | Status | Evidence |
|---|---|---|---|---|
| Content author | Claude (Story 3.2 development) | 2026-08-19 | Signed off | `?ledger=1&case=morley-miller` — Sign-off |
| Scholarly reviewer | *unassigned* | — | **Pending** — see the transcription-fidelity gap | `?ledger=1&case=morley-miller` — Sign-off |
| Accessibility reviewer | — | — | De-scoped (ADR-008) | `?ledger=1&case=morley-miller` — Sign-off |
| Educator context sheet | *unassigned* | — | **Pending** | `?ledger=1&case=morley-miller` — References |
| Accessible-controls reference | — | — | De-scoped (ADR-008) | `?ledger=1&case=morley-miller` — References |

**What Story 3.3 actually did.** It built the ledger and pointed it at this table. The prototype's
`case.json` went to 1.1.0: each source gained a `ledgerEntry` — the 1887 paper `primary`, the 1905
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

1. **The bench artwork is Young's** — light source, slits, barrier, the run animation. **The screen is
   not part of this gap any more:** the code review of 2026-08-19 (decision D1) found that the prototype
   ignited for the full 2.4 s and resolved onto a screen nothing had painted — `renderApparatusGeometry`
   returned at its Young-geometry guard before reaching its own `paintFringes()` call — and delivered
   `paintDisplacedFringes`, a fringe field shifted by the recorded drift. The shift is deliberately not
   exaggerated: a reading at the stable window is a fraction of a fringe width, and the readout carries
   the precision. What remains for 4.2 is the apparatus around the screen.
   A reviewer opening the prototype sees an optical bench with rotation and temperature knobs on it.
   That is honest for a framework prototype and would be dishonest for a case review; re-skinning it is
   **Story 4.2** (D8). Young's `recordedResultValue → bandSpacingPx` mapping (`× 4.6`, clamped 8–31 px)
   is its millimetres and is no longer applied to the prototype, which paints on its own path.
2. **Transcription fidelity and page attribution** of the 1887 excerpts — **Story 4.1**, before any
   scholarly sign-off.
3. **`formatMeasurement` puts its locale separator before every unit**, which is right for `°C` and
   wrong for an arc degree: the bench reads `0 °`. Shared with Young's rendering, so not changed in a
   content story — **Story 4.2**, with the bench work.
4. **The French typography sweep covers interface chrome and Young's authored content only.** The
   prototype's authored prose is bilingual and schema-validated but is not measured against the bands
   that hold it — **Story 4.1**.
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
- **`conclude-bounded-null` now enforces the steady bath it claims** — through
  `unvaried-control-pinned bathTempC`, scoped to the runs the player pinned. Scoping matters: asking it of
  every recorded run would have made the claim unreachable for anyone following the `resetPath`.
- **Localized copy.** `unit: 'fringe widths'` reached French readers unchanged (now keyed on the model);
  the case-file observation row showed *no apparatus settings at all* for the prototype; `rotationDeg 135`
  at the stable window rendered **"-0"**; and each control now authors an `inlineLabel` so the composed
  bench sentence reads correctly in both languages.

Still open, and still needing a person rather than a patch: the 1887 excerpts' transcription fidelity and
page attribution, and the scholarly sign-off. AC7 is PARTIAL until those are done.

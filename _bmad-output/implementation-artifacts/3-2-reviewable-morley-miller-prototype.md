---
baseline_commit: efaf9802ed15509eb4c064a75a7d37867cd13d19
---

# Story 3.2: Reviewable Morley–Miller prototype

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a content author,
I want to author a reviewable Morley–Miller prototype using the hardened framework,
so that scholarly and content reviewers can verify second-case authoring without duplicating the Young loop.

_Second story of Epic 3. Story 3.1 made a second case **parse**; nothing yet makes one **run**. This story is the first time the framework is asked to carry a case that is not Young, and its value is almost entirely in what that exposes. Baseline `case.json` is **1.18.0**; `main.ts` still hard-codes `young-interference`._

## Acceptance Criteria

**AC1 — The prototype is real, loadable content** _(epic AC1)_

**Given** the hardened case contract and shared domains,
**When** the Morley–Miller prototype is authored,
**Then** `public/cases/morley-miller/case.json` and `asset-manifest.json` exist, parse through `CaseDefinitionSchema`, and supply this case's own rotation and bath-temperature controls, deterministic model, evidence requirements, colleague cast and proposals, consultations, peer review, rival-lab critiques, sources, debrief and auto-summary,
**And** it authors **no** Young field — no `wavelengthNm`, no `wavelengthComparison`, no `slitSpacingMm`/`screenDistanceM`,
**And** it is a **prototype**: authored to prove the contract carries a second case, not to be the tuned, scholarly-signed-off tutorial (that is Epic 4).

> This is real content under `public/cases/`, not a test fixture. Story 3.1 already proved a second case *parses* with an in-memory fixture. Epic AC1's second clause — "reuses the same store, evaluator, notebook, critique, persistence, and **Phaser-scene behavior**" — cannot be proved by anything that never loads.
>
> **On "assets" in the epic AC:** the prototype ships a valid asset manifest and reviewed source renditions, and its cast uses coded silhouettes (D5). **No new art.** Case-specific artwork is Epic 4's and is named in the gap list rather than half-authored here.

**AC2 — The bench runs the case's own experiment model** _(deferred-work.md, owner: this story; NFR9, NFR17)_

**Given** a case whose apparatus is not Young's,
**When** the player starts the light,
**Then** `reduceExperimentRun` computes the result through the model the **case** declares, not through `calculateYoungFringeSpacing` fed from two written-down control names,
**And** the model is selected by an authored `experiment.modelId` resolved against a closed, exported list of implemented models, so a case naming a model that does not exist is **rejected at load** with that path named — never at the moment the player presses start,
**And** a Morley–Miller run records a labelled, unit-carrying result and lands in the notebook.

**AC3 — A run with no Young model inputs keeps every guarantee a Young run has** _(NFR9)_

**Given** `modelInputs` is `YoungModelInputs` and a second case records none,
**When** a run is recorded and later used as conclusion support,
**Then** the bench-match and `experimentModelVersion` checks in `reduceRecordRun` apply to **every** run, not only to runs carrying `modelInputs` — today both sit inside `if (validated.value.modelInputs)`, so a case without them is validated *less*,
**And** `evaluateConclusionReadiness`'s two Young-shaped rules are re-expressed over the case's own contract: `non-physical-young-run` becomes "a run this case's model produced" (`experimentModelVersion`), and `distinct-run-configurations` is decided by `configurationKey` from `significanceRule` rather than by comparing `slitSpacingMm`/`screenDistanceM`/`wavelengthNm`,
**And** both rules are proven **unsatisfiable before and satisfiable after** for the prototype — they are why the theory board can never unlock for a second case today.

**AC4 — The prototype is reachable for review, without a case picker**

**Given** `main.ts` hard-codes `young-interference`,
**When** a reviewer opens the app with the prototype's review route,
**Then** the case ID is read from an allowlisted `?case=` query parameter defaulting to `young-interference`, following the existing `?mode=validation` precedent,
**And** an unknown or unlisted value falls back to the default rather than reaching `loadCaseDefinition` with reviewer-supplied text,
**And** this is **not** campaign selection: no in-game picker, no unlock order, no menu (Story 4.1 owns campaign order and requires Morley–Miller to precede Young).

**AC5 — The laboratory describes this case's apparatus, not Young's**

**Given** the bench chrome names Young's quantities in written-down literals,
**When** the prototype is on the bench,
**Then** `lab.idle` states the case's **own** authored controls, composed from `apparatus.primaryControls` rather than from `'slitSpacingMm'` / `'screenDistanceM'`,
**And** a recorded run reports its own `result.label` / `value` / `unit` — today a run without `modelInputs` falls through to `lab.result.emptyHint`, so the bench says nothing was recorded when something was,
**And** the case authors its own `title` (bilingual `LocalizedText`), which the laboratory shows in place of the hard-coded `'lab.title'`,
**And** the **bench artwork stays Young's** — source, slits, screen, fringe painting. Re-skinning the apparatus is Story 4.2 and is recorded as gap #1, not attempted here.

**AC6 — Bilingual from the same commit** _(NFR19, ADR-010)_

**Given** every authored string in the prototype and every interface string this story adds or changes,
**When** it ships,
**Then** it carries complete EN **and** FR content, Zod validates locale completeness, and no player-readable string exists in one language only,
**And** any new interface string has keys in both `src/core/i18n/locales/en.ts` and `fr.ts`,
**And** the prototype's two textual renditions satisfy the page-alignment rule: same section IDs, same `sourcePages`, same paragraph counts in both locales, with the English rendition as the single `transcription` of record.

**AC7 — Only reviewed material is represented as reviewed** _(FR27, NFR11)_

**Given** the prototype ships historical source text,
**When** an artifact is authored `rightsStatus: 'reviewed'`,
**Then** it is public-domain material with a real `citationText` and an HTTPS `archiveUrl`, and its provenance category and source type describe what it actually is,
**And** nothing unreviewed is authored as reviewed to satisfy the load-time readiness rule,
**And** this story supplies the reviewed data; **Story 3.3 builds the ledger that audits it** — do not build a ledger here.

**AC8 — The review produces a named prototype artifact and named backlog** _(epic AC2)_

**Given** the prototype is compared with Young by a content author and a scholarly reviewer,
**When** the review is recorded,
**Then** `docs/case-prototypes/morley-miller-prototype.md` states: what was authored, what was reused **unchanged**, what required a framework change and why, and what remains Young-specific,
**And** every remaining gap is mirrored into `deferred-work.md` with a **named owner story** — the whole point of epic AC2's "documented authoring gaps become backlog items rather than ad-hoc duplication",
**And** the accessibility-reviewer role in the epic's AC is recorded as **de-scoped by ADR-008**, not silently dropped.

**AC9 — Young is unchanged, and the contract change is carried honestly** _(NFR10, NFR12)_

**Given** `case.json` gains `experiment.modelId` and `title`,
**When** it lands,
**Then** Young's `case.json` is bumped to **1.19.0** with a compatibility clause that states what changed and what was verified byte-identical, not assumed,
**And** every existing behavioural test still passes unchanged and no saved record is rejected — `CaseRecordSchema.schemaVersion` stays `3` and `migrateCaseRecord.ts` is untouched,
**And** the compatibility allowlist is **scoped by case ID**: its clauses are a Young changelog, and since Story 3.1 two cases share one version namespace, so `morley-miller` at some future `1.2.0` would silently inherit Young's `['1.0.0','1.1.0']` reasoning.

**AC10 — Verification**

**Given** the change is complete,
**When** the gates run,
**Then** `npm run typecheck` is clean, `npm test` is green with **at least 1330** tests across **at least 73** files, and `npm run test:e2e` (chromium) is green on an idle machine,
**And** one new e2e spec walks the prototype far enough to prove the framework carries it: load via the review route → read both sources → choose a prediction → record two distinguishing runs → reach the conclusion choice,
**And** no new accessibility-parity assertion is added and no existing a11y spec is deleted (ADR-008),
**And** `deferred-work.md` is updated: close what this story closes, carry what it does not, with reasons.

## Tasks / Subtasks

- [ ] **Task 1 — Measure the baseline, then walk the wall (AC1, AC2, AC3)**
  - [ ] Record `npm run typecheck`, `npm test` (file/test counts) and `npm run test:e2e` on an idle machine **before** touching anything, so a pre-existing failure is not attributed to you.
  - [ ] Read §The three walls before writing code. Every one of them refuses the prototype *silently or with Young's voice*; none is a crash.
  - [ ] Write the throwaway proof first: parse a minimal non-Young definition, build an `AppState`, dispatch `experiment.run`, and watch it fail. Keep the failure text — it is your regression baseline for AC2.

- [ ] **Task 2 — The per-case experiment model seam (AC2)**
  - [ ] Add `src/domain/apparatus/experimentModels.ts`: an exported `EXPERIMENT_MODEL_IDS` list and `resolveExperimentModel(modelId): CalculateExperimentResult | undefined`. Two entries — `young-double-slit` and `morley-miller-interferometer`. Pure; no Zod, no store.
  - [ ] Add `src/domain/apparatus/calculateInterferometerDrift.ts` — the prototype's deterministic model. See §The prototype's physics for the authored form, the constants, and what Epic 4.2 owns instead of you.
  - [ ] `CaseDefinitionSchema`: add required `experiment.modelId` (a `stableId`) refined against `EXPERIMENT_MODEL_IDS`, with the offending path named. Case-scoped refinement pins Young to `young-double-slit`.
  - [ ] `src/domain/cases/CaseDefinition.ts`: add the matching type field.
  - [ ] `AppState.ts` `reduceExperimentRun`: replace the direct `calculateYoungFringeSpacing({ slitSpacingMm: …, screenDistanceM: … })` call with the resolved model over `state.activeControlValues`. Keep `modelInputs` authored **only** where the model needs them — Young keeps its; the prototype records none.
  - [ ] Young's run must be **bit-identical** to before. Assert it: same label, same value, same unit, same `modelInputs`, from a test that would fail if the seam changed the arithmetic.

- [ ] **Task 3 — Close the two evaluator rules that lock a second case out of its own conclusion (AC3)**
  - [ ] `conclusionReadiness.ts:83` — `non-physical-young-run` refuses any selected run without `modelInputs`. Re-express as "produced by this case's model": compare `run.experimentModelVersion` to `definition.experiment.modelVersion`. Rename the code and its two locale keys accordingly; keep the old key working for saved records only if a test proves one needs it (it should not — nothing persists a readiness code).
  - [ ] `conclusionReadiness.ts:88-92` — `distinct-run-configurations` compares Young's three `modelInputs` names, so for a case with none the `.some(...)` is always false and the requirement can never clear. Decide it with `configurationKey(definition.significanceRule, run)` from `significantMeasures.ts` — the same question, already answered there. **Reuse it; do not write a second one.**
  - [ ] `AppState.ts` `reduceRecordRun` — hoist `matchesBench` and the `experimentModelVersion` comparison **out** of the `if (validated.value.modelInputs)` block. The model-input cross-checks stay inside it.
  - [ ] Mutation-prove all three: break each guard, watch a named test go red, restore it. A comment claiming a guarantee is not a guarantee.

- [ ] **Task 4 — Author the prototype content (AC1, AC6, AC7)**
  - [ ] `public/cases/morley-miller/case.json` at `version: "1.0.0"`, `id: "morley-miller"`. Work outward from a copy of Young's **structure** — never its prose.
  - [ ] Two `primaryControls`: `rotationDeg` (0–180, step 15, default 0, unit `°`) and `bathTempC` (18–24, step 0.5, default 22, unit `°C`). Both bilingual labels. `MAX_PRIMARY_CONTROLS` is 2 — do not add a third.
  - [ ] Two `contextualArtifacts`, both `reviewed`, each with a `textualRendition`: the 1887 Michelson–Morley paper and the 1907 Morley–Miller report. Excerpt them — a handful of paragraphs across a few pages is a legitimate prototype rendition and Young's 166 KB of source text is not the bar. Both locales, identical section shape.
  - [ ] `colleagues` with `portrait.kind: 'silhouette'` and an authored accent — **no PNG assets**, so no new art and no manifest churn. `asset-manifest.json` carries the shared logo alone (`entries` is `.min(1)`).
  - [ ] Four `predictionProposals`, four `conclusionProposals` with satisfiable `supportPredicate`s, a `rivalLab` critique per conclusion proposal, ≥4 `consultationRules`, ≥3 `peerReviewRules`, ≥1 `colleagueHints` (with the floor/order rules the refinement enforces), `readingGateHints`, `significanceRule` over `rotationDeg`, `requirements`, `flow`, `scenarioScript` mapping all six phases, `debrief`, `autoSummary`, `title`.
  - [ ] `autoSummary` may name only `AUTO_SUMMARY_PLACEHOLDERS`. `apparatusSettingCount` and `configurationCount` are equal for this case (no `criticalModelInputIds`) — say one thing, not two.
  - [ ] Run it through `CaseDefinitionSchema` after every section. The refinement ladder is long and its messages name paths; use them.

- [ ] **Task 5 — The review route (AC4)**
  - [ ] `main.ts`: read `?case=` beside the existing `?mode=validation` read, allowlist it against the known case IDs, default to `young-interference`. Never pass an unlisted value to `loadCaseDefinition`.
  - [ ] Confirm the record repository already scopes by case (`repository.load(caseResult.value.id)`) so the two cases cannot cross-contaminate saved progress. Assert it.
  - [ ] No picker, no menu, no unlock logic. If you find yourself writing campaign order, stop — that is Story 4.1.

- [ ] **Task 6 — De-Young the laboratory's voice (AC5)**
  - [ ] `ApparatusRenderer` `lab.idle`: compose the settings clause from `apparatus.primaryControls` (label + `selectFormattedControlValue`) instead of the two literals at `:820-821`. One authored sentence, both locales, list-joined with the locale's own separator.
  - [ ] The result readout: a recorded run with no `modelInputs` currently renders `lab.result.emptyHint`. Report `latest.result` — label, formatted value, unit — and keep the wavelength clause only where `modelInputs` exist.
  - [ ] `lab.pattern.recorded` reads a Young fringe spacing; make the pattern line read the run's own labelled result or say nothing, rather than describing a quantity this case does not measure.
  - [ ] `title`: new bilingual `LocalizedText` on the definition, shown in place of the hard-coded `'lab.title'`. `encodesPath` applies to it like every other authored string.
  - [ ] Sweep the remaining Young-named interface keys and decide each explicitly: `print.observations.preModel`, `error.invalid-run-model-inputs`, `error.invalid-young-model-input`. Fix what is generic; record what is genuinely Young's. `boot.intro` and `validation.session.title` belong to the Young validation route and stay.

- [ ] **Task 7 — Version, allowlist, and the case-ID scoping (AC9)**
  - [ ] Young `case.json` → `1.19.0` (adds `experiment.modelId` and `title`). Extend the allowlist with one clause that states what changed and what was verified byte-identical **by diffing the file**.
  - [ ] Scope every allowlist clause by `definition.id === YOUNG_CASE_ID`. The clauses are Young's changelog and the version namespace is now shared.
  - [ ] Confirm `schemaVersion` stays `3` and `migrateCaseRecord.ts` is untouched. If you need a migration, you have made a breaking change by accident.

- [ ] **Task 8 — Tests (AC10)**
  - [ ] Unit: the model resolver (both models, and the unknown-id load rejection); the prototype's model at range ends and at the stable window; `reduceExperimentRun` for both cases; the three re-expressed guards with their mutation proofs; a full `CaseDefinitionSchema` parse of the shipped prototype (follow the dominant `readFile(public/cases/…)` fixture pattern); the review-route allowlist.
  - [ ] The prototype's parse test must assert the theory board **can** unlock — the exact thing that was impossible before Task 3.
  - [ ] e2e: one new spec walking the prototype through the review route to the conclusion choice. Wait on achieved state (`clickUntilScene`, `startTheLightUntilRecorded`), never on a fixed sleep. Canvas text is unreadable from a spec — assert scene keys and the printable record.
  - [ ] Do not fork `canvasHelpers.ts` for a second case; parameterise what you need.

- [ ] **Task 9 — The prototype artifact and the backlog (AC8)**
  - [ ] Write `docs/case-prototypes/morley-miller-prototype.md`: authored inventory, reused-unchanged inventory, framework changes with reasons, remaining Young-specific surfaces, provenance of both sources, and the reviewer sign-off lines (content author, scholarly reviewer; accessibility de-scoped per ADR-008).
  - [ ] Mirror every remaining gap into `deferred-work.md` with a named owner — bench artwork (4.2), the persisted `450|550|650` unions and the two minimum-mode `550` literals, `experiment.wavelengthNm` if the seam has not consumed it, and anything the walk surfaced.
  - [ ] Close in `deferred-work.md` what this story closes, by name.

## Dev Notes

### Scope boundary — read this first

**In scope:** `public/cases/morley-miller/**` (new), `public/cases/young-interference/case.json` (version + two fields), `src/domain/apparatus/` (the resolver and the second model), `src/domain/theory/conclusionReadiness.ts`, the model-shaped reads in `src/core/store/AppState.ts`, `src/schemas/CaseDefinitionSchema.ts` and `src/schemas/CaseRecordSchema.ts` (allowlist scoping), `src/domain/cases/CaseDefinition.ts`, `src/main.ts` (the review route), `src/adapters/phaser/renderers/ApparatusRenderer.ts` (its Young-named copy only), both locale bundles, `docs/case-prototypes/` (new), and the tests for all of it.

**Explicitly not in scope:**

- **A second bench.** The apparatus artwork — light source, slits, screen, fringe painting, the run animation — stays Young's. Re-skinning it is **Story 4.2**. This story proves the *framework* carries a second case; it does not draw an interferometer.
- **The source and rights ledger.** **Story 3.3.** AC7 supplies reviewed data; it does not build the audit surface.
- **`scenarioScript` authoring surface, `scenes[].cast?`, `primaryControls[].affordance?`, `docs/content-authoring/`.** All **Story 3.4**. You author a `scenarioScript` as *content*; you do not extend its contract.
- **Campaign order, unlocks, or a case picker.** **Story 4.1** — and FR2 puts Morley–Miller *before* Young in the campaign, so a picker built now would pre-empt a decision that story owns.
- **The full Morley–Miller tutorial.** Epic 4 owns the calibrated model, the thermal-drift teaching loop, the scholarly-reviewed narrative and the bounded conclusion. This is a prototype: complete enough to load, play and review; not the shipped case.
- **`migrateCaseRecord.ts` and `schemaVersion`.** Nothing here breaks a persisted shape.
- **Widening the persisted `450|550|650` unions.** That needs a record migration and is recorded, not taken.
- **New accessibility assertions, and deleting existing a11y specs.** ADR-008: de-scoped, not wrong.

### The three walls — what actually stops a second case today

Verified against the code at baseline `efaf980`. None of these is a crash; each is a silent or misdirected refusal, which is why 1293 green tests do not see them.

**Wall 1 — the bench refuses every run.** `AppState.ts:386-390`:

```ts
const result = calculateYoungFringeSpacing({
    slitSpacingMm: state.activeControlValues.slitSpacingMm,
    screenDistanceM: state.activeControlValues.screenDistanceM,
    wavelengthNm: state.selectedWavelengthNm
});
```

For a case authoring `rotationDeg`/`bathTempC` both reads are `undefined` (`tsconfig.json` sets no `noUncheckedIndexedAccess`, so it type-checks), the calculator's own input guard fires, and the player gets `invalid-young-model-input` — "The selected apparatus inputs cannot produce a fringe spacing" — for an apparatus that has no fringes. Recorded in `deferred-work.md` with **this story as owner**.

**Wall 2 — the theory board can never unlock.** `conclusionReadiness.ts:83-92`, and this one is *not* in `deferred-work.md`; it was found writing this story.

- `non-physical-young-run` pushes a missing requirement for any selected run without `modelInputs`. `modelInputs` is `YoungModelInputs` — a second case records none, so **every** selected run is refused.
- `distinct-run-configurations` reads `first.modelInputs.slitSpacingMm` / `.screenDistanceM` / `.wavelengthNm`. With `first.modelInputs` undefined the `.some(...)` is false and the requirement is pushed unconditionally.

Both are permanently unsatisfiable for a second case. The player reaches synthesis, pins two runs, saves a comparison, and the conclusion list stays shut with two English sentences about Young. The evaluator is the sole completion authority (ADR-006), so this is the deepest of the three.

**Wall 3 — the bench speaks Young.** `ApparatusRenderer.ts:820-821` names `'slitSpacingMm'` / `'screenDistanceM'` as literals. Since the Story 3.1 review those go through `selectFormattedControlValue`, which is **total** — it no longer throws, it degrades. So the prototype's bench renders "The bench is dark at 0 slit spacing and 22 screen distance", with the rotation angle printed as a slit spacing. A graceful degradation is exactly the shape of defect that survives a test suite: nothing fails, the sentence is just false.

Alongside it, `:803-810`: the result readout is gated on `latest?.modelInputs`, so a recorded run without them falls to `lab.result.emptyHint` — the bench reports "nothing recorded yet" over a run that is in the notebook.

**Also expect, and confirm rather than assume:** `createInitialAppState` (`AppState.ts:204-212`) initialises `selectedWavelengthNm: 550` / `selectedWavelengthMode: 'minimum'` for **every** case, and `reduceApparatusReset` writes them back. For a case authoring no `wavelengthComparison` this should be inert — the chooser is not drawn, `reduceWavelengthSet` refuses every advanced value against an empty `advancedChoicesNm`, and `isAdvancedWavelengthUnlocked` yields 0. Prove that it is: no `550` may reach the prototype's run records, its printable record, or its auto-summary. If one does, you have found the eleventh `550` literal, and it is in scope.

### What the framework already carries unchanged — do not touch these

Verified definition-driven at baseline. Re-implementing any of them is a review finding.

| Concern | Already case-agnostic | Where |
|---|---|---|
| Control bounds, steps, normalisation | Reads `apparatus.primaryControls` | `reduceControlSet`, `normalizeControlValue` |
| Run snapshot validity | Takes the authored control ids by parameter | `RunRecord.ts` `validateControls` / `runControlContract` |
| Significance counting, configurations | `significanceRule` + `configurationKey` | `significantMeasures.ts` |
| Colleague hints, reading-gate hints | Authored predicates | `colleagueHints.ts`, `readingGateHints.ts` |
| Rival-lab critique selection | `rivalLab.critiques[].proposalId` | `rivalLabRules.ts` |
| Conclusion support | Authored `supportPredicate` trees | `conclusionProposals.ts` |
| Recognition | `definition.apparatus` / `contextualArtifacts` | `recognitionRules.ts` |
| Scene routing | `scenarioScript` phase→scene map | `SceneRouter.ts` |
| Wavelength chooser | Absent when no `wavelengthComparison` is authored | `selectWavelengthChoices` returns `[]`; `ApparatusRenderer:488` guards on it |
| Auto-summary | Closed placeholder vocabulary, definition-driven | `caseSummary.ts` |
| Asset preload, record repository | Keyed by case ID | `preloadCaseAssets`, `caseRecordRepository` |

That table is the story's real argument: the framework is mostly there. Three walls and some copy stand between it and a second case.

### The prototype's physics — authored, deterministic, and Epic 4.2's to calibrate

Two controls and one result. Displacement in fringe widths:

```
displacement = ORIENTATION_AMPLITUDE * cos(2 * rotationDeg in radians)
             + THERMAL_COEFFICIENT * (bathTempC - STABLE_WINDOW_C)
```

with `ORIENTATION_AMPLITUDE ≈ 0.01`, `THERMAL_COEFFICIENT ≈ 0.05` per °C, `STABLE_WINDOW_C = 20.0`. Round for stored display exactly the way `calculateYoungFringeSpacing` does, through the same 4-decimal helper.

Why this shape: FR19 and Story 4.2 need a **time-independent orientation signal that is near-null** and a **temperature-dependent confound that dominates it**, separable by holding the bath at the stable window. At 22 °C the thermal term is 0.10 and swamps the ±0.01 orientation term; at 20.0 °C it vanishes and what remains is the near-null signal the historical result actually is. `cos(2θ)` gives the orientation term its physical period — rotating 90° flips the sign, 180° returns to start — which is what makes two rotations at the stable window a genuinely distinguishing pair.

**What is yours and what is not.** The *shape*, the seam, and the determinism are yours. The calibrated constants, their agreement with the 1907 report's numbers, and the scholarly review of the claim are **Story 4.2's** — say so in the model's docstring and in the prototype artifact, so nobody later reads these constants as historically sourced. `experiment.confound` should name the thermal drift and `resetPath.recoveryRoute` should be `replication`.

`significanceRule.criticalControlIds: ['rotationDeg']`, and **no `criticalModelInputIds`** — this case records no model inputs, and an empty list is rejected by the schema. Reachable configurations: 13 rotation positions against a `minimumSignificantRuns` of 2, comfortably inside the refinement's product bound.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

- **D1 — Real content under `public/cases/`, not a fixture.** Story 3.1's fixture proved parsing. Epic AC1 asks for reuse of "store, evaluator, notebook, critique, persistence, **and Phaser-scene behavior**", and the three walls above are all things only a load-and-play proves. The cost is authoring; the alternative is a story that cannot fail.
- **D2 — `experiment.modelId`, resolved against a closed exported list, validated at load.** Not keyed on case ID (that would put a second `if (id === …)` ladder in the *store*, where D1 of Story 3.1 deliberately kept one out of the schema), and not keyed on `modelVersion` (which is the per-run provenance stamp — bumping it must never change which model runs). A closed list validated in the schema means the reducer never needs a runtime failure path for an unknown model: "no authored content may leave a gate unsatisfiable", applied to the model itself.
- **D3 — Two entries, no registry.** Same reasoning the case-scoped refinement rests on: at two models a lookup is the whole mechanism. Do not build a plugin layer, a model factory, or a per-case module loader.
- **D4 — The prototype records no `modelInputs`.** `YoungModelInputs` is the Young optical model's own shape, and widening it into a per-case union would drag `CaseRecordSchema`'s persisted shape and the `450|550|650` union into this story — a record migration, which §Scope boundary forbids. Instead, Task 3 makes `modelInputs`-absence a first-class state: the bench check, the model-version check and both readiness rules stop treating "no Young inputs" as "not a real observation". That is the smaller and more honest change, and it is the one that makes `RunRecord.modelInputs` genuinely optional rather than nominally optional.
- **D5 — Silhouette portraits, no new art.** `ColleaguePortraitSchema` already accepts `kind: 'silhouette'` with an accent colour, which is how the whole cast shipped before the PNG work. A prototype that needs five new portraits is a prototype nobody authors. Epic 4 can add assets; the manifest stays at the shared logo.
- **D6 — The review route is a query parameter, not a picker.** `?mode=validation` is the established precedent for a reviewer-facing entry that is not a game feature. An allowlist rather than a passthrough, because a reviewer-supplied string reaching `contentPath` is a fetch built from user input.
- **D7 — Excerpted renditions.** Young ships 166 KB of source text (87% of its `case.json`). The schema requires `sections.min(1)` and page-for-page alignment across locales — not completeness. A few pages of each paper, correctly cited and aligned, proves the contract and keeps the story authorable.
- **D8 — The bench artwork is out of scope and named as gap #1.** A reviewer will see it immediately, so the artifact must name it before they do. Attempting it here would double the story and land renderer work in a content-and-contract story.

### Read before editing — current behaviour that must survive

- **`reduceRecordRun`'s guards are asymmetric.** `matchesBench` and the `experimentModelVersion` comparison are inside `if (validated.value.modelInputs)`. Hoisting them is a **strengthening** for the second case and a no-op for Young — but it is still a behaviour change to a reducer with saved records behind it. Prove Young's path is unchanged with a test that fails if the hoist alters any refusal.
- **`selectFormattedControlValue` is total and `selectPrimaryControl` throws.** The Story 3.1 review added `findPrimaryControl` as the fallible seam and re-pointed the render paths at it. Anything you add under `src/adapters/phaser/` uses `findPrimaryControl`. A throw inside `render()` is inside `dispatch() → notify()` — the Story 1.10 stranded-router door.
- **`loadCaseDefinition` cross-checks the asset manifest.** `manifestsMatch` compares `definition.assets` against the fetched `asset-manifest.json` field by field. The two files must agree exactly, including `manifestVersion`.
- **`deepFreeze` is what makes the definition immutable.** Do not weaken it; the prototype inherits it for free.
- **`case.json` is 212 KB and `_bmad-output`/`dist/` copies are not authored content.** Edit only `public/cases/…`.
- **Zod skips a `superRefine` once the base parse has failed.** This is why cross-field rules with authored messages live in the top-level refinement rather than as `.min()` on the field — and why a base-parse failure in your new content will hide every authored message at once. Fix base-shape errors first, then read the refinement messages.
- **The compatibility allowlist is a list of reasons, not a list of numbers.** Follow the 1.17.0/1.18.0 clauses exactly: state what changed, state what you diffed, and say explicitly whether the changed strings are in the recomputed canonical set (`peerReviewRules.feedback`, `revisionPath`, proposal claims and limitations).

### Reuse, do not reinvent

Verified present at baseline. Writing a second one of any of these is a review finding.

| Need | Use this | Location |
|---|---|---|
| Decide whether two runs are distinct configurations | `configurationKey(rule, run)` | `src/domain/evidence/significantMeasures.ts:39` |
| Count significant measures / apparatus settings | `countSignificantMeasures`, `countApparatusSettings` | same file, `:60`, `:75` |
| Round a calculated result for storage | the 4-decimal helper pattern in `calculateYoungFringeSpacing.ts:12` | mirror it, do not invent a second precision |
| Resolve an authored bilingual string / list | `resolveLocalizedText`, `resolveLocalizedTextList` | `src/core/i18n/resolveLocalizedText.ts` |
| Interface chrome | `translate` / `createTranslator` | `src/core/i18n/translate.ts` |
| Format a number / measurement / recorded value | `formatNumber`, `formatMeasurement`, `formatRecordedValue` | `src/core/i18n/formatNumber.ts` |
| An authored control, safely, in a renderer | `findPrimaryControl` | `src/core/store/selectors.ts:45` |
| The run-validation control contract | `runControlContract(definition)` | `src/domain/evidence/RunRecord.ts:57` |
| Reject copy naming a scene/route/phase | `encodesPath` | `src/schemas/CaseDefinitionSchema.ts:521` |
| The calculation seam type | `CalculateExperimentResult` | `src/domain/evidence/RunRecord.ts:61` — it already exists for exactly this |

### Testing requirements

- **Pure domain logic → Vitest, no Phaser, no browser.** The model, the resolver, the readiness rules, every refinement. Hard rule (project-context, Testing).
- **The dominant fixture pattern is "parse the shipped case"** — `readFile('public/cases/…/case.json')` through `CaseDefinitionSchema`. Add the prototype to that pattern; it becomes its own regression net.
- **Extend `validYoungCase` in `tests/unit/CaseDefinition.test.ts:39`; do not fork it.** There is no `src/test-support/` despite the architecture doc.
- **Test layout is flat**: `tests/unit/*.test.ts`, `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts`.
- **Mutation-test every re-expressed guard.** The 2.10 and 2.11 reviews both found load-bearing defects invisible to ~1000 green tests, caught only by breaking the code and checking a test went red. Task 3's three guards are exactly that class: each currently *passes* while being wrong for a case that does not exist yet.
- **Never assert a magic number shared with source** unless both read one exported constant. The prototype's model constants are exported and asserted from the export.
- **e2e:** the canvas walks are frame-timed and load-sensitive; judge a failure on an idle machine. Canvas text cannot be read from a spec — assert `#game-container[data-active-scene]` and the printable record, or put the string assertion in a `sceneSlice`-driven unit test.
- **Invalid content must surface as an expected `Result` failure**, and valid local progress must survive a failed import or save.

### Previous story intelligence — the failure modes this project keeps producing

From the Epic 2 and Story 3.1 reviews, in descending cost:

1. **Green tests over an unusable product.** Nine of fourteen player intents once shipped dispatchable only from retired DOM panels while every test passed. **The analogue here is the sharpest yet:** all three walls are green today. The prototype's job is to be the test that a second case is playable, so if you finish this story without having *played* it end to end, you have not done it.
2. **A guarantee held by the wrong layer.** Story 3.1 relaxed five shapes and re-stated four only after review. This story relaxes nothing but *discovers* three guarantees Young was holding for the whole system by being the only case. Each one you move, state where it now lives.
3. **A comment claiming a guarantee is not a guarantee.** Three of Story 3.1's four gaps shipped with a comment asserting the check existed. Break each guard and watch the named test go red.
4. **English-only content.** The project's most-repeated defect. AC6 is not follow-up work — and this story adds an entire case's worth of prose.
5. **Copies of a rule that drift.** `deferred-work.md` counts ~10 surviving `550` literals. Do not add an eleventh, and prefer deleting one where the seam lets you.

### Git intelligence

Baseline `efaf980` ("Review 3.1"), immediately after `0e26a44` ("Dev 3.1") and `3d1c982` ("Story 3.1"). The Story 3.1 review is the most recent contract work and the direct predecessor: it de-Younged `id`, `caseId`, `primaryControls`, `contextualArtifacts`, the three `requirements` counts, `criticalModelInputIds` and `activeControlValues`, added `MAX_PRIMARY_CONTROLS`, the auto-summary and its placeholder validation, and left the file:line references in this story accurate as read. Re-confirm before editing.

It also left `tsconfig.test.json` red at **106 errors across 56 files** by design — `npm run typecheck:tests` is not gated in CI and is **not** your gate. Do not "fix" it as a side effect; closing it is its own story, assigned to Alexis. Do not make it worse either: new test files should typecheck.

### Stack

Phaser 4.2.1 · TypeScript ~5.7.2 · Vite 8.1.5 · Zod **4.4.3** · `idb` 8.0.3 · Vitest 4.1.10 · Playwright 1.61.1 · Node 20.18.1+. Versions are pinned exactly and the lockfile is committed — **do not upgrade anything, and do not add a dependency** (a new devDependency mid-story is a HALT condition; it is why `CaseRecordPrintView` still has no unit coverage). Zod 4 idioms in use here: `.strict()` on every object, `context.addIssue({ code: 'custom', … })`, `z.discriminatedUnion`, two-argument `z.record`, and the deliberate reliance on Zod skipping a `superRefine` after a base-parse failure.

### Project Structure Notes

- `src/domain/` is pure TypeScript: **no Phaser, DOM, `fetch`, IndexedDB, browser APIs — and no Zod.** The model and the resolver go in `src/domain/apparatus/`; their validation goes in `src/schemas/`. The schema may import the exported model-ID list — it already imports `CASE_PHASES` and `SCENE_KEYS` from `src/domain/cases/`.
- Only repositories fetch and validate case JSON; only persistence adapters touch IndexedDB.
- No generic `services/`, `managers/`, or `helpers/`.
- `src/ui/` holds exactly three modules. Do not add a fourth.
- `src/game/scenes/*` are orphaned Phaser-template leftovers. Not the scene layer.
- Naming: `PascalCase.ts` for class/type modules, `camelCase.ts` for function modules, `camelCase` JSON fields, kebab-case case IDs and assets, `Result<T, ResultError>` for fallible operations.
- **Known doc/code divergences** (follow the code): `game-architecture.md` lists `src/app/`, `src/config/`, `src/core/events/`, `src/domain/sources/`, `src/test-support/`, `sources.json`/`assets.json` — none exist. Actual: `src/main.ts` boots, artifacts live inside `case.json`, the manifest is `asset-manifest.json`, tests are flat. `docs/content-authoring/` and `docs/source-rights/` do not exist yet and belong to Stories 3.4 and 3.3.
- `_bmad-output/implementation-artifacts/epic-1-context.md` is pre-pivot and stale. Ignore it.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.3, 2026-08-07) — the rules that bind *this* story:

- **The shared contract holds only what every case shares; per-case invariants live in a refinement branched on `id`.** At two cases a branch is the whole mechanism — **do not build a plugin or registry layer** for case-specific rules. The same rule governs the model resolver: a lookup, not a framework.
- **Everything is authored; nothing is freeform.** Scene order, dialogue beats, apparatus bounds, valid values, confounds and outcomes all come from case data.
- **Author a case field that nothing reads and you have shipped dead content** — the same defect class as an unreachable intent. `experiment.wavelengthNm` is the live instance; resolve or record it.
- **No authored content may leave a gate unsatisfiable.** Ask of every field: *can an author fill this in a way that makes the case unfinishable?* An unknown `modelId` is exactly that, so it fails at load with its path named.
- **When you relax or move a guarantee, find out what it was holding and re-state it.** What cannot be re-stated goes in `deferred-work.md` as newly reachable, with an owner.
- **A comment claiming a guarantee is not a guarantee.** Break the guard, watch the named test go red.
- **Never write a case constant (`550`, a control id, a count) into code twice.** ~10 `550` literals survive; do not add an eleventh.
- **Defensibility is evaluator/critique-only.** Never expose a proposal as "correct"; never leak a defensibility field into a display projection. The rival lab is narrative dressing, never a fail state.
- **The evidence evaluator is the sole completion authority.** Never hard-code completion in a scene or dialogue branch.
- **Every forward transition has an in-scene affordance** (ADR-011/NFR20). The prototype must be advanceable from the canvas at every phase — if a transition works for Young only because of authored Young content, that is a finding.
- **Authored copy must not name a scene, phase, or route** (`encodesPath`), including advance-affordance labels and the new `title`.
- **A refused action always says why**, and the message survives until a real state change replaces it.
- **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria — not as follow-up i18n work.** Surfaces: UI chrome, curated records, book content, reference summaries, colleague dialogue, proposal text, hint text, rival-lab critiques, sources, debrief, auto-summary, and the new `title`.
- **Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback.** Scientific run values stay canonical across locales; localize only for display.
- **Case definitions and assets are immutable under `public/cases/`; player progress lives only in IndexedDB.** Edit only `public/cases/…`.
- **Never recalculate a saved historical run against a newer experiment model.** Every run preserves its controls, output, timestamp and model version — which is exactly why `modelId` and `modelVersion` are two different fields.
- **Case content carries the provenance and rights status of every historical asset and claim. Do not add an unreviewed one.**
- **Bump `CaseDefinition.version` on any contract change, and keep the record-compatibility allowlist honest** rather than widening it on the assumption that canonical strings are byte-identical.
- **Every Zod object is `.strict()`; fallible operations return `Result`; never expose a raw error to the player.**
- **Renderer contract:** `create()` / `render(state)` / `destroy()`; never author player-facing copy in `create()`; release every tween, listener and display object.
- **Honour `prefers-reduced-motion`** in every animated renderer; the no-flashing guard survives the a11y de-scope.
- **Unit-test all pure domain logic with Vitest** — never require Phaser or a browser to test scientific logic. Inject a structural slice for Phaser-adjacent logic (`SceneRouterTarget` is the reference pattern).
- **axe and manual accessibility acceptance are no longer gates (ADR-008).** Add no new a11y-parity assertions; delete no existing a11y specs.
- **Verify with `npm run typecheck`, `npm test`, and `npm run test:e2e`.**

### Baseline

Measured at `efaf980` on an idle machine, immediately before this story was written:

```
npm run typecheck   → clean
npm test            → 71 files, 1293 tests, all passing (1.11s)
case.json version   → 1.18.0
record schemaVersion → 3
npm run typecheck:tests → RED by design (106 errors / 56 files) — not a gate, not yours
```

`npm run test:e2e` (chromium) was reported green at 59 passed in the Story 3.1 review. **Re-measure it yourself before you start.**

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2: Reviewable Morley–Miller prototype`] — the two acceptance criteria reproduced as AC1/AC8 (lines 1094–1112).
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 3: Reusable case authoring and provenance`] — epic goal; FR3, FR6, FR18, FR25–FR27.
- [Source: `_bmad-output/planning-artifacts/epics.md#Functional Requirements`] — FR2 (Young is the validation slice, Morley–Miller the first campaign case), FR18, FR19, FR25, FR27; NFR9, NFR10, NFR11, NFR12, NFR17, NFR19, NFR20.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.3 / Story 3.4 / Story 4.1 / Story 4.2`] — the scope boundaries this story must not cross.
- [Source: `_bmad-output/game-architecture.md#Content Model`] — the authored-field inventory; the v1.2 additive fields belong to Story 3.4.
- [Source: `_bmad-output/game-architecture.md#Architecture Decision Records`] — ADR-003 (validated data-driven cases), ADR-004 (deterministic model), ADR-006 (evidence-driven narrative rules), ADR-008 (a11y de-scoped — the epic AC's accessibility reviewer), ADR-009 (scene router), ADR-010 (EN+FR), ADR-011 (canvas intent completeness).
- [Source: `_bmad-output/game-architecture.md#Architectural Boundaries`] — domain purity, Zod at boundaries, `public/cases/` immutability.
- [Source: `_bmad-output/project-context.md#Critical Implementation Rules`] — every rule reproduced in §Project Context Rules.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`, "Deferred from: code review of 3-1…"] — `reduceExperimentRun`'s hard-coded Young model, **owner: this story**; `experiment.wavelengthNm` authored-and-unread; the persisted `450|550|650` unions; the two minimum-mode `550` literals.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`, "Newly reachable, or still held elsewhere"] — the non-550 baseline recording gap, to be resolved with the second experiment model.
- [Source: `_bmad-output/implementation-artifacts/3-1-incremental-reusable-case-contract-hardening.md`] — the immediate predecessor; its §Scope boundary names this story four times, and its version-bump and allowlist discipline is the pattern to copy.
- Code read at baseline: `src/core/store/AppState.ts`, `src/core/store/selectors.ts`, `src/domain/evidence/RunRecord.ts`, `src/domain/evidence/significantMeasures.ts`, `src/domain/evidence/caseSummary.ts`, `src/domain/theory/conclusionReadiness.ts`, `src/domain/apparatus/calculateYoungFringeSpacing.ts`, `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/schemas/CaseRecordSchema.ts`, `src/adapters/content/loadCaseDefinition.ts`, `src/adapters/phaser/preloadCaseAssets.ts`, `src/adapters/phaser/renderers/ApparatusRenderer.ts`, `src/core/i18n/locales/{en,fr}.ts`, `src/main.ts`, `public/cases/young-interference/{case.json,asset-manifest.json}`.

## Open Questions for Alexis

These do **not** block the story — each has a decision recorded in §Decisions taken for you. Raise them if you disagree.

1. **Story sizing — this is the largest Epic 3 story.** It authors a full case, adds a model seam, re-expresses two evaluator rules, changes the bench copy and adds a review route. It is coherent (it is all "make a second case actually work"), but a clean split exists: **3.2a** = the three walls (model seam, evaluator rules, bench copy) proven against an in-memory fixture; **3.2b** = the authored prototype, the review route and the review artifact. Say if you want it split — the walls are the engineering risk and the authoring is the volume.
2. **Scholarly review sequencing (AC7/AC8).** The epic wants a scholarly reviewer to sign off the prototype, and Story 3.3 builds the ledger that records such sign-offs. Doing the sign-off here means recording it in a prose artifact that 3.3 will then have to import. **My reading:** the prototype artifact carries the provenance and the reviewer's name now, and 3.3 migrates it into the ledger — because a prototype nobody reviewed is not what epic AC2 asks for. Confirm, or defer the sign-off to 3.3 and mark the prototype "authored, review pending".
3. **Wall 2 was not in the backlog.** The two Young-shaped rules in `conclusionReadiness.ts` are not recorded anywhere — they were found reading the code for this story. They are the hardest blocker (the evaluator is the sole completion authority) and I have put them in AC3 rather than deferring them, because a prototype that cannot reach its conclusion cannot be reviewed against Young. Flagging it because it grows the story beyond what the epic AC's wording implies.
4. **The prototype's constants are invented, not sourced.** §The prototype's physics gives a defensible shape with placeholder constants and assigns their historical calibration to Story 4.2. If you would rather the prototype carry no numbers a reviewer could mistake for sourced values, the alternative is authoring the model with deliberately abstract units — say which you prefer before the scholarly review, not after.
5. **The bench stays visually Young (D8).** A reviewer opening the prototype sees an optical bench with rotation and temperature knobs on it. That is honest for a framework prototype and dishonest-looking for a case review. If the review audience needs it to *look* like an interferometer, that is Story 4.2 pulled forward and roughly doubles this story.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-08-19 | 0.1 | Story drafted from epics.md, game-architecture.md, project-context.md, deferred-work.md, Story 3.1, and code read at baseline `efaf980`. | Alexis |

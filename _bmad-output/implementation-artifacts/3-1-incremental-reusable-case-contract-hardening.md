---
baseline_commit: 713012e4f7b9fb5c1d89f9fc66cf35f420e24f77
---

# Story 3.1: Incremental reusable case-contract hardening

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a content author,
I want to define a complete case in versioned JSON,
so that later cases can add only the fields they consume without changing core behavior.

_First story of Epic 3, and the gate on Story 3.2 (Morley–Miller prototype) and Story 3.4 (scenario/proposal authoring contract). Epic 1 and Epic 2 are done; the shipped Young contract is `case.json` **1.16.0**._

## Acceptance Criteria

**AC1 — The contract carries every reusable field a later case consumes** _(epic AC1)_

**Given** the already-shipped minimal Young contract,
**When** case-framework hardening is applied,
**Then** it incrementally adds only reusable fields needed by later cases: confound, inspectable assumptions, colleague hints, neutral auto-summary, counterfactual/replay labels, cycle rules, the significance rule, and case-specific bounded conclusion rules (including the four conclusion proposals with their support predicates),
**And** it does not make Young depend on a future all-purpose schema.

> **Read §Gap analysis before writing code.** Eight of those nine fields already shipped in Epics 1–2. The **only missing field is the neutral auto-summary.** The epic's list was written in 2026-08-04, before the pivot delivered the rest. Do not re-add what exists; do not treat the list as a design brief.

**AC2 — Validation, immutability, and typed failure** _(epic AC2)_

**Given** a hardened case definition,
**When** its JSON is loaded through the repository,
**Then** Zod validates the relevant incremental fields and yields an immutable domain definition,
**And** invalid content returns a typed `Result` before domain logic while player progress cannot mutate shipped case content.

**AC3 — A second case parses, and Young is unchanged**

**Given** the hardened contract,
**When** a minimal non-Young case definition is validated,
**Then** it parses successfully **without authoring any Young-specific field** — no `young-interference` id, no `slitSpacingMm`/`screenDistanceM` control pair, no `wavelengthNm`,
**And** the shipped `public/cases/young-interference/case.json` still parses and every existing behavioural test still passes unchanged,
**And** the second-case fixture is a test fixture only — this story authors **no** new `public/cases/*` directory (that is Story 3.2).

**AC4 — Young's authored bounds stay guaranteed, case-scoped rather than shape-wide** _(FR7)_

**Given** the control set is no longer a fixed pair of named controls,
**When** validation runs,
**Then** Young's exact bounds — 0.10–0.50 mm in 0.05 mm steps, 1.0–4.0 m in 0.25 m steps, and its two control ids — are still rejected when wrong, enforced by a refinement scoped to `id === 'young-interference'`,
**And** every guarantee the removed `z.tuple` was silently holding for the bench renderer is re-stated explicitly (see §The tuple was load-bearing), so `ApparatusRenderer.create()` still cannot receive a control set it would throw on.

**AC5 — The neutral auto-summary** _(FR23)_

**Given** a case authors a neutral auto-summary,
**When** it is composed from the player's own recorded evidence,
**Then** the case contract carries the authored template as bilingual `LocalizedText`, Zod validates it, and a **pure domain module** composes the filled summary from runs, inspected sources, and decision history,
**And** the summary states what the player did — counts, configurations, sources read — and never evaluates it: no "correct", no "well done", no defensibility, no proposal ranking (ADR-006, UX-DR5),
**And** its placeholder set is validated at load, so an authored template naming an unknown placeholder fails with a typed `Result` rather than rendering a literal `{token}`,
**And** the composed summary is **reachable** — it appears as one new section in the retained printable record (`src/ui/print/CaseRecordPrintView.ts`), which dispatches nothing and is ADR-011's sole exemption — so the field is not shipped-and-dead.

**AC6 — No authored content can leave a gate unsatisfiable** _(deferred-work.md:75, assigned to this story by review decision 2026-08-07)_

**Given** a case authors its contextual artifacts,
**When** validation runs,
**Then** content that makes context readiness permanently unreachable is rejected at load with the offending artifact's own path — specifically an artifact whose `rightsStatus` is not `reviewed`, which `evaluateContextReadiness` counts as forever-missing while `reduceSourceInspection` refuses `source-not-eligible`, so no surface can ever clear it,
**And** the rule is stated as the general shape ("readiness can never become ready"), not as a second special case bolted next to the `reviewed`-needs-`textualRendition` rule already at `CaseDefinitionSchema.ts:583-595`,
**And** `tests/unit/ReadingGateHints.test.ts` — which currently pins the looping behaviour as *correct* at the selector layer — is reconciled: the selector stays right, the content becomes unauthorable.

**AC7 — The schema-owned defects this story inherits are closed**

**Given** this story owns `CaseDefinitionSchema.ts`, `AppState.ts`, and `case.json` content,
**When** it lands,
**Then** all three assigned carry-overs are closed:

| Item | Location | Obligation |
|---|---|---|
| Asset path regex accepts `/\` and `..` | `CaseDefinitionSchema.ts:467` (deferred-work.md:146) | Tighten to reject a leading `/\` and any `..` segment; add both hostile paths as rejection fixtures |
| `selectAdvancedWavelengthUnlocked` is a second copy of the reducer gate with `550` written down | `selectors.ts:170-172` + `AppState.ts:331-333` (deferred-work.md:99) | Parameterise **both halves together** from `experiment.wavelengthComparison.fixedMinimumPathNm`. This story is what makes the exposure real |
| `state-a-limit` consultation copy describes two acts where there is now one | `case.json` → `consultationRules[3]`, both locales (deferred-work.md:128) | Re-word in EN **and** FR, and re-word the compatibility-allowlist clause that claims byte-identity |

**AC8 — Persisted shapes relax; they never break** _(NFR12, NFR10)_

**Given** `activeControlValues` and `caseId` are schema-validated persisted fields,
**When** they are widened,
**Then** every record saved by an older build still loads — the change is a **relaxation**, so `CaseRecordSchema`'s `schemaVersion` stays `3` and `migrateCaseRecord.ts` is untouched,
**And** `validateCaseRecordForDefinition` still rejects a record from a different case and still checks every authored control's value against its authored bounds,
**And** `CaseDefinition.version` is bumped to `1.17.0` and the record-compatibility allowlist is extended **only** with a clause whose byte-identity claim was verified by diffing the file, not assumed.

**AC9 — Bilingual from the same commit** _(NFR19, ADR-010)_

**Given** every new authored field this story adds,
**When** it ships,
**Then** it carries complete EN **and** FR content in `case.json`, Zod validates locale completeness, and no new player-readable string exists in one language only,
**And** any new interface string goes through `translate`/`createTranslator` with keys in both `src/core/i18n/locales/en.ts` and `fr.ts`.

**AC10 — Verification**

**Given** the change is complete,
**When** the gates run,
**Then** `npm run typecheck` is clean, `npm test` is green with **at least 1196** tests across **at least 69** files, and `npm run test:e2e` (chromium) is green on an idle machine,
**And** no new accessibility-parity assertion is added and no existing a11y spec is deleted (ADR-008),
**And** `deferred-work.md` is updated: close what this story closes, carry what it does not, with reasons.

## Tasks / Subtasks

- [x] **Task 1 — Confirm the gap, then de-Young the case identity (AC1, AC3)**
  - [x] Re-read §Gap analysis and confirm against the code before writing anything. If a field you were about to add already exists, stop and record it in Completion Notes instead.
  - [x] `src/domain/cases/CaseDefinition.ts:211` — `id: 'young-interference'` → `id: string`.
  - [x] `src/schemas/CaseDefinitionSchema.ts:476` — `z.literal('young-interference')` → a kebab-case `z.string()` (`/^[a-z0-9]+(-[a-z0-9]+)*$/`, per the naming convention "case IDs are kebab-case").
  - [x] `src/schemas/CaseRecordSchema.ts:115` — `caseId: z.literal('young-interference')` → the same kebab-case string. **Relaxation only**: existing records carry `young-interference` and still parse, so `schemaVersion` stays `3`.
  - [x] Leave `src/main.ts:85` loading `'young-interference'`. Case *selection* is not this story.
  - [x] Verify `validateCaseRecordForDefinition` (`CaseRecordSchema.ts:290`) still rejects a foreign `caseId` — it compares against `definition.id`, so it should already generalise. Add a test that proves it.

- [x] **Task 2 — Generalise the control set, and re-state what the tuple was holding (AC3, AC4)**
  - [x] `PrimaryControl['id']`: the two-member union → `string`. `PrimaryControlSchema.id` (`:186`) `z.enum([...])` → stable-id string.
  - [x] `apparatus.primaryControls` (`:481`): `z.tuple([PC, PC])` → `z.array(PC).min(1).max(2)`. **Keep the max at 2** — see §The tuple was load-bearing.
  - [x] Add to the top-level refinement: control ids unique; and a bench-geometry bound proving instrument slots cannot collide with the wavelength chooser.
  - [x] Move the Young-exact bounds check (`:547-557`) inside an `id === 'young-interference'` branch. Keep both messages verbatim — they are asserted by name in tests.
  - [x] Widen the four `z.enum(['slitSpacingMm','screenDistanceM'])` predicate sites to stable-id strings, keeping the existing cross-field checks that they name an authored control: `:158` (`alternative-test`), `:204` (`unvaried-control`), `:306` (`varied-control`), `:197` (`significanceRule.criticalControlIds`).
  - [x] `SignificanceRuleSchema.criticalModelInputIds` (`:198`): `z.enum(['wavelengthNm'])` → stable-id string, still `.min(1).optional()`.

- [x] **Task 3 — Follow the control-set ripple to every consumer (AC4, AC8)**
  - [x] `src/domain/evidence/RunRecord.ts:4` — `RunControls` becomes `Readonly<Record<string, number>>`.
  - [x] `src/domain/evidence/RunRecord.ts:73-88` — `validateControls` hard-codes `Number.isFinite` on the two Young keys and rebuilds the snapshot from them, so a third control would be **silently dropped from the run record**. Make it validate against the authored control ids. Decide and record how they reach it (see §Decisions taken for you, D3).
  - [x] `src/schemas/CaseRecordSchema.ts:118` — `activeControlValues` strict two-key object → `z.record(z.string(), z.number().finite())`. Relaxation, so `schemaVersion` stays `3`. The exact-key guarantee is preserved by the loop at `:295`, which already iterates `definition.apparatus.primaryControls`.
  - [x] `src/core/store/AppState.ts:91` and `:360` — the `Record<PrimaryControl['id'], number>` annotations and the `as` cast follow the type.
  - [x] `src/core/store/AppState.ts:309-312` — four hard-coded reads of `slitSpacingMm`/`screenDistanceM` comparing run controls and model inputs against `activeControlValues`. Make definition-driven.
  - [x] Run `npm run typecheck` and fix every site it surfaces. **The compiler is the inventory here** — do not hand-search.

- [x] **Task 4 — Make Young's optical model fields case-scoped (AC1, AC3)**
  - [x] `experiment.wavelengthNm` (`:484`) and `experiment.wavelengthComparison` (`:485-488`): make `wavelengthNm` optional, and require both in the Young-scoped refinement from Task 2. `wavelengthComparison` is already optional. Verified: **no code in `src/` reads `definition.experiment.wavelengthNm`** — only `wavelengthComparison` is read — so this is nearly free.
  - [x] Leave `calculateYoungFringeSpacing.ts`, `opticalVisualModel.ts`, and `YoungModelInputs` **alone**. The experiment model is already an injected seam (`CalculateExperimentResult`, `RunRecord.ts:42`). A second case's model belongs to Story 3.2, not here.

- [x] **Task 5 — Relax the remaining Young-shaped counts, keeping the ones that are design (AC1, AC3)**
  - [x] `contextualArtifacts` (`:479`): `z.tuple([A, A])` → `z.array(A).min(2)`. FR4 requires *two* artifacts as a floor, not a ceiling. Update the id-uniqueness check at `:559` (currently `size !== 2`) to compare against the array length.
  - [x] `requirements` (`:501-505`): `minimumRuns`/`minimumSources`/`minimumSignificantRuns` `z.literal(2)` → `z.number().int().min(2)`, with the Young-scoped refinement pinning all three at exactly 2.
  - [x] `flow.minimumExperimentCycles`/`maximumExperimentCycles` (`:528-529`): literals `2`/`4` → positive ints with `min <= max`, and FR3's two-to-four range enforced case-scoped for Young.
  - [x] `debrief.historicalComparison.sourceIds` (`:540`): keep the 2-tuple. Two cited sources is the authored design and the existing distinctness check depends on it.
  - [x] **Do NOT relax `predictionProposals`/`conclusionProposals` `.length(4)` (`:518-519`).** Four is the design (project-context, Guided-Adventure rules) *and* the only thing keeping `ColleagueRenderer.cardGeometry` from drawing cards off-canvas (deferred-work.md:83). Relaxing it opens a live layout defect this story is not equipped to fix.
  - [x] **Do NOT touch `TextualRendition.renditions`' 2-tuple (`:108`).** It is arity-locked to the two shipped locales; widening is explicitly deferred while EN+FR is hard-scoped (deferred-work.md:25).

- [x] **Task 6 — Add the neutral auto-summary (AC5, AC9)**
  - [x] Add the authored template to the contract as bilingual `LocalizedText` with named `{placeholder}` tokens, following the existing interpolation convention (`print.completion.text` in `en.ts:433`).
  - [x] Validate the placeholder set at load: an unknown token is a typed `invalid-case-definition` failure, never a literal `{token}` on screen.
  - [x] Add a **pure** domain composer under `src/domain/evidence/` (no Phaser, no DOM, no Zod) that fills the template from runs, inspected sources, and decision history. Scientific values stay canonical; localise for display only, via `formatNumber`/`formatMeasurement`/`formatRecordedValue`.
  - [x] Author the template in `case.json` in EN **and** FR.
  - [x] Unit-test the composer directly: zero runs, one run, the ≥2-significant case, and both locales.
  - [x] Render it as **one new `<section>` in `src/ui/print/CaseRecordPrintView.ts`** — the file already builds settings / observations / sources / prediction sections the same way (`:61-117`). The section heading is interface chrome (`translate`, new keys in **both** `en.ts` and `fr.ts`); the summary body is authored content (`resolveLocalizedText` on the template, filled by the composer). Add print-view unit coverage in both locales.
  - [x] **No new scene, renderer, overlay, or `src/ui/` module.** One section in a file that already exists. See §Decisions taken for you, D5.

- [x] **Task 7 — Close the assigned carry-overs (AC6, AC7)**
  - [x] AC6: reject artifacts whose `rightsStatus !== 'reviewed'`, stated as the general "readiness can never become ready" shape alongside the existing rule at `:583-595`. Reconcile `tests/unit/ReadingGateHints.test.ts`.
  - [x] AC7 row 1: tighten `AssetManifestSchema`'s path regex (`:467`); add `"/\\evil.com/x.png"` and a `..`-segment path as rejection fixtures.
  - [x] AC7 row 2: parameterise `selectors.ts:170-172` and `AppState.ts:331-333` **in the same change**, from `fixedMinimumPathNm`. Add a test with `fixedMinimumPathNm !== 550` — the case that currently fails silently.
  - [x] AC7 row 3: re-word `consultationRules[3]`'s `nextStep` and `layers.observation` in both locales.

- [x] **Task 8 — Prove the contract generalises (AC3)**
  - [x] Add a minimal non-Young `CaseDefinition` fixture to the unit tests: a different kebab-case id, a different control set, no `wavelengthNm`, its own significance rule and hints, four proposals, complete `scenarioScript`, both locales. It must parse clean.
  - [x] Add the negative pair: that same fixture with Young's id must fail Young's bounds refinement, and Young's content with a foreign control id must fail.
  - [x] Extend `tests/unit/CaseDefinition.test.ts`'s `validYoungCase` (the project's canonical inline fixture, `:39`) rather than starting a parallel one.

- [x] **Task 9 — Version, compatibility, docs, and gates (AC8, AC9, AC10)**
  - [x] Bump `CaseDefinition.version` to `1.17.0` in `case.json`.
  - [x] Extend the record-compatibility allowlist in `CaseRecordSchema.ts:270-289` with a `1.17.0` clause. **Diff the file to verify byte-identity of the recomputed canonical strings** — `peerReviewRules`' `feedback`/`revisionPath` and the proposal claims/limitations. Task 7 changes `consultationRules[3]` copy, which is *not* in that recomputed set: say so explicitly in the clause rather than leaving it implicit.
  - [x] Update `deferred-work.md`: close items 75, 99, 146 and 128; record the auto-summary surface deferral; note whether 83 and 100 are still held by the schema.
  - [x] Update `_bmad-output/project-context.md` if a durable new rule emerges (e.g. "case-scoped refinements hold per-case invariants; the shared shape holds only what every case shares").
  - [x] Run `npm run typecheck`, `npm test`, `npm run test:e2e`. Record exact counts against the baseline.

## Dev Notes

### Scope boundary — read this first

**In scope:** `src/domain/cases/CaseDefinition.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/schemas/CaseRecordSchema.ts`, `src/domain/evidence/RunRecord.ts`, the control-shaped reads in `src/core/store/AppState.ts` and `src/core/store/selectors.ts`, one new pure module under `src/domain/evidence/`, `public/cases/young-interference/case.json` (version + auto-summary + one consultation re-word), both locale bundles if a new interface string is needed, and the unit tests for all of it.

**Explicitly not in scope:**

- **Authoring a second case.** No new `public/cases/*` directory. Story 3.2 authors Morley–Miller; this story only makes it authorable. The proof here is a **test fixture**.
- **The experiment model.** `calculateYoungFringeSpacing.ts`, `opticalVisualModel.ts`, `YoungModelInputs`. Already an injected seam; a second model is 3.2/4.x.
- **`scenarioScript` authoring surface, `scenes[].cast?`, `primaryControls[].affordance?`.** Those are **Story 3.4** (epic AC4, 2026-08-06). Do not land them here even though they look like contract work.
- **The source and rights ledger.** **Story 3.3.** AC6 rejects unreviewable artifacts; it does not build a ledger.
- **`docs/content-authoring/`.** **Story 3.4 AC3** owns it.
- **Any new scene, renderer, overlay, or affordance.** Zero Phaser files change. If you find yourself opening `src/adapters/phaser/`, stop — except to *read* the geometry constants Task 2's bound needs. The one presentation change in scope is a new section inside the existing `src/ui/print/CaseRecordPrintView.ts` (D5); no new `src/ui/` module.
- **Relaxing `.length(4)` on either proposal array, or the `renditions` 2-tuple.** Task 5 says why.
- **`migrateCaseRecord.ts` and `schemaVersion`.** Every persisted change here is a relaxation. If you find yourself needing a migration, you have made a breaking change by accident — back up and re-read §Persisted shapes.
- **Case selection / a case picker.** `main.ts` keeps its hard-coded load.

### Gap analysis — eight of AC1's nine fields already shipped

Verified against the code at baseline `713012e`. **Do not re-implement these.**

| AC1 field | Status | Where |
|---|---|---|
| Confound | **Exists** | `CaseDefinition.experiment.confound` (`CaseDefinition.ts:223`); schema `:489-493` |
| Inspectable assumptions | **Exists** | `experiment.assumptions: LocalizedTextList` (`:222`) |
| Colleague hints | **Exists** | `colleagueHints: ColleagueHint[]` + full refinement ladder incl. shadowing/floor rules (Story 2.6) |
| Neutral auto-summary | **MISSING — this story adds it** | Nothing in `src/`. FR23's only unmet clause |
| Counterfactual / replay labels | **Exists** | `debrief.replayLabel` + `ReplayState.isCounterfactual` (`AppState.ts:81`), rendered by `DebriefRenderer` |
| Cycle rules | **Exists** | `flow.minimumExperimentCycles`/`maximumExperimentCycles` — but pinned as literals; Task 5 relaxes |
| Significance rule | **Exists** | `significanceRule: SignificanceRule` (Story 2.6), with the order-independence design already reasoned out in its docstring |
| Conclusion proposals + support predicates | **Exists** | `conclusionProposals` `.length(4)` with a 3-deep `ConclusionSupportPredicate` union and satisfiability refinement |
| Case-specific bounded conclusion rules | **Exists** | `conclusionReadiness.ts`, `conclusionProposals.ts`, `rivalLabRules.ts` |

**So what is this story actually?** Two things the ACs imply rather than enumerate, plus one field:

1. **The de-Younging.** `id: z.literal('young-interference')` alone makes Story 3.2 impossible. The user story ("later cases can add only the fields they consume") is the real requirement, and the shared contract currently hard-codes Young's identity, control pair, wavelength, artifact count, and requirement counts.
2. **The neutral auto-summary** — the one genuinely missing field.
3. **Four schema-owned carry-overs** that landed on this story by name (AC7, AC6).

### The tuple was load-bearing — what you must re-state when you remove it

`deferred-work.md:100` records a live crash path that is **currently unreachable only because the schema pins the control set**:

> Three controls place instrument slot 2 at x 404–572, straight through the wavelength chooser at x 410–660; a control with `step: 0` makes `knobStepCount` return `Infinity` into `Array.from({ length: Infinity + 1 })` inside `create()` — and **a throw in `create()` lands inside `dispatch() → notify()`, which breaks the `Result` contract and strands the router mid-transition** (the Story 1.10 failure mode).

`PrimaryControlSchema`'s own refinement (`:193-200`) already covers `max > min`, `step > 0` (via `.positive()`), and default-in-range-and-on-step. What the **tuple** was holding, and you must replace:

- **The count.** `z.array(...).min(1).max(2)`. `instrumentSlotLeft(index) = BENCH_LEFT + index * (INSTRUMENT_SLOT_WIDTH + INSTRUMENT_SLOT_GAP)` with `INSTRUMENT_SLOT_WIDTH = 168`, `INSTRUMENT_SLOT_GAP = 14` (`apparatusGeometry.ts:204-207`). Slot 2 collides with the chooser. Keeping the max at 2 keeps the defect closed **and** still unblocks a case with a *different* pair or a single control — which is what 3.2 needs.
- **Duplicate ids.** The tuple plus the Young-exact `min`/`max`/`step` check made a duplicate pair impossible. An array of one schema does not. Add the uniqueness check.
- **If you raise the max above 2, you own `deferred-work.md:100`.** Don't. Record it instead.

Same shape of reasoning applies to `deferred-work.md:83`: `ColleagueRenderer.cardGeometry` (`:755-760`) has no clamp on `top`, so a proposal count other than 4 draws cards off-canvas and zeroes the room. It is unreachable **because** `:518-519` pin `.length(4)`. Task 5 keeps them pinned.

### Persisted shapes — why nothing here needs a migration

`CaseRecordSchema`'s `schemaVersion` is `3` (`:114`). The established precedent (`:56`, `:123`, `:133`) is that **additive-optional and relaxing changes keep `schemaVersion` at 3** and leave `migrateCaseRecord.ts` untouched.

Both persisted fields this story touches are **relaxations**:

- `caseId: z.literal('young-interference')` → kebab-case string. Every saved record carries `young-interference`, which still matches. Cross-case protection is not lost: `validateCaseRecordForDefinition` (`:290`) compares `record.caseId !== definition.id`.
- `activeControlValues: z.object({ slitSpacingMm, screenDistanceM }).strict()` → `z.record(z.string(), z.number().finite())`. Every saved record has exactly those two keys, which a record schema still accepts. The exact-key guarantee moves nowhere: the loop at `:295` already iterates `definition.apparatus.primaryControls` and normalises each value against its authored control.

> **Zod 4 note (4.4.3 is pinned).** `z.record` requires **two** arguments in Zod 4 — `z.record(keySchema, valueSchema)`. With a `z.string()` key it yields `Record<string, T>`; with an enum key it yields a *complete* record requiring every member. Use the string key. Prove the inferred type with a `tsc` check, not by assumption.

The `SignificanceRule` docstring (`CaseDefinition.ts:170-190`) warns that widening `RunControls` "would change a persisted, schema-validated shape and demand a `schemaVersion` migration, which would fail every saved record on load and let autosave overwrite it — a silent progress wipe against NFR12." **That warning is about widening the record schema in a way old records fail.** Relaxing an object to a record does not do that. Verify it rather than trusting either the docstring or this note: add a test that loads a record fixture written with the two-key object shape and asserts it still validates.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

- **D1 — Case-scoped refinement, not a generic all-purpose schema.** Epic AC1's second clause ("does not make Young depend on a future all-purpose schema") is satisfied by keeping the *shared* shape narrow and putting per-case invariants in a refinement branch keyed on `id`. Young keeps FR7's exact numbers enforced; a second case is not dragged into them. Do **not** invent a plugin/registry layer for case-specific rules — one `if (definition.id === 'young-interference')` branch is the whole mechanism at two cases.
- **D2 — `max(2)` on the control array.** Reasoned in §The tuple was load-bearing. It unblocks 3.2 without opening a `create()` throw.
- **D3 — `validateControls` gets the authored control ids by parameter.** `createRunRecord`'s callers already have the definition in reach. Threading a parameter keeps `src/domain/` pure and avoids the alternative (validating "any finite-valued keys"), which would let a typo'd control id into a persisted run record silently — exactly the class of defect this story exists to close. Check every call site with `tsc`.
- **D4 — `contextualArtifacts` becomes `.min(2)`, not a wider tuple.** FR4 says "two contextual artifacts or sources" as a *precondition*, so two is a floor.
- **D5 — The auto-summary is rendered in the printable record, not deferred and not given a new surface.** An authored field nothing renders is the "unreachable content" defect this codebase's refinements exist to catch, so deferring the surface would ship dead weight and leave FR23 unmet. But every *canvas* host (the notebook, the case file, the debrief) belongs to a story that already shipped, and a new scene or overlay breaches §Scope boundary.

  `src/ui/print/CaseRecordPrintView.ts` resolves both problems at once. It is the **retained** portable record (ADR-007), it is ADR-011/NFR20's sole exemption **because it dispatches nothing**, and a read-only summary dispatches nothing either — so no canvas-completeness obligation is created. It already renders settings, observations, sources and prediction from selectors through `translate`, so the summary is one more section in an established pattern (~15 lines, two i18n keys, no new module). Project-context's "`src/ui/` holds exactly three modules — do not add a fourth" is respected: this adds a section to one of the three, not a fourth module.

  **What is still deferred:** an *in-play* summary surface, if Alexis wants the player to see it during the investigation rather than only in their record. Record that in `deferred-work.md` with a named owner. Flagged in §Open Questions.
- **D6 — Version `1.17.0`, one allowlist clause.** Following the pattern at `CaseRecordSchema.ts:270-289` exactly, including the habit of stating *what* was verified byte-identical and how.

### Read before editing — current behaviour that must survive

- **`evaluateContextReadiness`** (`contextPredictionReadiness.ts:18-19`) counts an artifact missing if it is *ineligible or uninspected*, reading canonical `.en` names on purpose. AC6 makes the ineligible case unauthorable; it must **not** change the selector's logic — the selector is right, the content was wrong.
- **`loadCaseDefinition`** (`adapters/content/loadCaseDefinition.ts`) is the only boundary: fetch → `safeParse` → asset-manifest cross-check via `manifestsMatch` → `deepFreeze`. Its failure message currently reads "Case content does not match the **Young** case contract." Once a second case can load, that string is wrong — fix it, and check whether any test or spec asserts it.
- **`deepFreeze`** is what makes AC2's "immutable domain definition" true. Do not weaken it. AC2's "player progress cannot mutate shipped case content" holds because progress is a separate IndexedDB record; assert it, don't rebuild it.
- **`selectPrimaryControl` THROWS** (found in the 2.11 review, called unguarded inside `render()` — the Story 1.10 stranded-router door). If widening the control set changes when it can throw, you have re-opened that door. Check it.
- **Nothing pins the Young bounds check.** Verified: neither message ("Young slit spacing must be 0.10–0.50 mm in 0.05 mm steps.", `:552`; "Young screen distance must be 1.0–4.0 m in 0.25 m steps.", `:556`) appears anywhere in `tests/`, and no test mutates a control's `min`/`max`/`step` to prove the check fires. **So if Task 2 moves it into a branch that never runs, the whole of FR7's enforcement disappears silently.** Add the rejection tests *before* you move it — one per control, mutating `min`, `max` and `step` — so the move is proven rather than assumed.
- **Three tests use a duplicate control id as their invalidity lever.** `tests/unit/CaseDefinition.test.ts:626`, `:653`, `:815` each set `primaryControls[1].id = 'slitSpacingMm'`, relying on the Young refinement noticing `screenDistanceM` is gone. They keep working while the fixture's id stays `young-interference` — but they are *not* testing the uniqueness rule Task 2 adds. Give that rule its own test against the non-Young fixture, where the Young branch does not run.
- **`case.json` is 212 KB.** Edit it surgically. Only `public/cases/…` is authored content — `dist/` is build output and `.claude/worktrees/**` is a stale copy.

### Reuse, do not reinvent — everything the auto-summary needs already exists

Verified present at baseline. Writing a second one of any of these is a review finding.

| Need | Use this | Location |
|---|---|---|
| Resolve an authored bilingual string | `resolveLocalizedText(text, locale)` / `resolveLocalizedTextList` | `src/core/i18n/resolveLocalizedText.ts:17,28` |
| Interface chrome (section heading) | `translate` / `createTranslator` | `src/core/i18n/translate.ts:52,69` |
| Format a number / a measurement / a recorded value | `formatNumber`, `formatMeasurement`, `formatRecordedValue` | `src/core/i18n/formatNumber.ts:36,40,50` |
| Count distinguishing runs | `countSignificantMeasures(rule, runs)`, `isSignificantMeasureGateMet(definition, runs)` | `src/domain/evidence/significantMeasures.ts:53,62` |
| Read the player's evidence | `selectInspectedSourceIds`, `selectDecisionHistory`, `state.runs` | `src/core/store/selectors.ts:57,494` |
| Reject copy that names a scene/route/phase | `encodesPath` | `src/schemas/CaseDefinitionSchema.ts:458` |

**Two traps, both already documented in this codebase:**

1. **Do not route the authored template through `translate`.** `translate` takes `TranslationKey = keyof typeof en`; an authored string is a plain `string`, so it needs a cast — and the cast defeats the only mechanism that guarantees `fr.ts` carries the key. `ScenarioScript.ts:28-40` records this exact reasoning for why dialogue beats carry `LocalizedText` rather than a `textKey`. The auto-summary template is case content and follows dialogue beats, not chrome. The composer needs its **own** small interpolation over the resolved `LocalizedText`.
2. **`interpolate` leaves an unsupplied `{placeholder}` verbatim** — stated in its own docstring at `src/core/i18n/translate.ts:39`. That is precisely the "literal `{token}` on screen" failure AC5's load-time placeholder validation exists to prevent. Copy the behaviour (never render `undefined`), and make the *authored* case fail at load instead of degrading at render.

### Testing requirements

- **Pure domain logic → Vitest, no Phaser, no browser.** The auto-summary composer, every new validator, every refinement. This is a hard rule (project-context, Testing).
- **The dominant fixture pattern is "parse the shipped case".** Most unit tests `readFile('public/cases/young-interference/case.json')` and run it through `CaseDefinitionSchema` (see `tests/unit/SignificantMeasures.test.ts:19-20`). That means **any contract change is load-bearing across ~25 test files** — and it also means the shipped content is your regression net. Run the suite early and often.
- **The canonical hand-built fixture is `validYoungCase` in `tests/unit/CaseDefinition.test.ts:39`** (1421 lines, inline, with `bilingual()`/`bilingualList()` helpers at `:12-14`). Extend it; do not fork it. There is no `src/test-support/` directory despite what the architecture doc says.
- **Test layout is flat**: `tests/unit/*.test.ts`, `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts` — **not** the `tests/unit/{domain,schemas,core}/` nesting in `game-architecture.md:427`. Follow the code.
- **Invalid content must surface as an expected `Result` failure**, and valid local progress must survive a failed import or save.
- **Never assert a magic number shared with source** unless both read one exported constant.
- **e2e:** this story should need no spec changes. If it does, that is a signal you have left the contract layer. The chromium suite is green as of 2.12; the canvas walks are frame-timed and load-sensitive — judge a failure on an idle machine before attributing it to your change.
- **Mutation-test the new refinements.** The 2.10 and 2.11 reviews both found that the two load-bearing defects were invisible to ~1000 green tests and were caught only by deliberately breaking the code and checking a test went red. For each new refinement: break it, confirm a test fails, restore it.

### Previous story intelligence — the failure modes this project keeps producing

From the Epic 2 reviews (2026-08-06/07), in descending cost:

1. **Green tests over an unusable product.** Nine of fourteen player intents shipped dispatchable only from retired DOM panels while every unit test passed. For this story the analogue is **authorable content that validates and then cannot be played** — which is precisely what AC6 closes and what the "unsatisfiable gate" family of refinements exists to prevent. When you add a field, ask: *can an author fill this in a way that makes the case unfinishable?* If yes, refine it.
2. **A guarantee held by the wrong layer.** Repeatedly: the schema was holding a bound the renderer assumed. This story **removes** several such schema guarantees. Every one you remove, you must either re-state or explicitly record as newly-reachable.
3. **English-only content.** The project's most-repeated defect. AC9 is not follow-up work.
4. **Shadowing and unreachable authored content.** The `colleagueHints` floor/order rules (`:773-790`) exist because a first-match ladder silently collapsed. If the auto-summary gets any selection or ordering semantics, it needs the same treatment.
5. **Copies of a gate that drift.** AC7 row 2 is exactly this, and this story is what makes it bite.

### Git intelligence

Baseline `713012e`. The last schema-touching change was Story 2.12 (`64fa54e`, `case.json` → 1.16.0). Everything since is presentation and CI: character staging (`098e9cf`, `80e24e0`), PNG portraits (`9333dfc`…`48a8ca2`), GitHub Pages + `resolveAssetUrl` (`00104d3`), and e2e stabilisation (`3da9983`, `713012e`). **No schema or domain contract has moved since 1.16.0** — the file:line references in this story were read at baseline and should be accurate, but re-confirm before editing.

The Pages commit added `resolveAssetUrl` (a base-path prefix) and is the reason AC7 row 1's asset-path regex matters at a domain root rather than only at a subpath.

### Stack

Phaser 4.2.1 · TypeScript ~5.7.2 · Vite 8.1.5 · Zod **4.4.3** · `idb` 8.0.3 · Vitest 4.1.10 · Playwright 1.61.1 · Node 20.18.1+. Versions are pinned exactly and the lockfile is committed — **do not upgrade anything**. Zod 4 idioms already in use here and worth matching: `.strict()` on every object, `context.addIssue({ code: 'custom', ... })`, `z.discriminatedUnion`, and the deliberate reliance on **Zod skipping a `superRefine` once the base parse has failed** (see the comments at `:12-14`, `:406-416`) — which is why cross-field rules with authored messages live in the top-level refinement rather than as `.min()` on the field.

### Project Structure Notes

- `src/domain/` is pure TypeScript: **no Phaser, DOM, `fetch`, IndexedDB, browser APIs — and no Zod.** All Zod lives in `src/schemas/`. The auto-summary composer goes in `src/domain/`; its validation goes in `src/schemas/`.
- Only repositories fetch and validate case JSON; only persistence adapters touch IndexedDB. The dependency direction never reverses.
- No generic `services/`, `managers/`, or `helpers/`.
- Naming: `PascalCase.ts` for class/type modules, `camelCase.ts` for function modules, `camelCase` JSON fields, kebab-case case ids and assets, `Result<T, ResultError>` for fallible operations.
- **Known doc/code divergences** (follow the code): the architecture doc lists `src/app/`, `src/config/`, `src/core/events/`, `src/core/logging/`, `src/domain/sources/`, `src/test-support/`, `sources.json`/`assets.json` — **none exist**. Actual: `src/main.ts` boots, artifacts live inside `case.json`, the manifest is `asset-manifest.json`, and tests are flat.
- `_bmad-output/implementation-artifacts/epic-1-context.md` is **pre-pivot and stale** (it asserts semantic-HTML authority and a11y gates). Ignore it.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.3, 2026-08-07) — the rules that bind *this* story:

- **`src/domain/` carries no Zod.** Schemas live in `src/schemas/`, and validation happens at the boundary before data reaches domain logic.
- **Every Zod object is `.strict()`.** A new field must be added to the object that will receive it, or the parse rejects it.
- **Bump `CaseDefinition.version` on any contract change, and keep the record-compatibility allowlist honest rather than widening it on the assumption that canonical strings are byte-identical.**
- **Case definitions and assets are immutable under `public/cases/`; player progress lives only in IndexedDB. Edit only `public/cases/…`.**
- **Never recalculate a saved historical run against a newer experiment model.** Every run record preserves its controls, calculated output, timestamp, and model version.
- **Case content carries the provenance and rights status of every historical asset and claim. Do not add an unreviewed one.**
- **Everything is authored; nothing is freeform.** Bounds, steps, valid values, confounds and outcomes all come from case data.
- **Schemas use `.length(4)`, not `.min(4)`, for both proposal sets — the count is the design.**
- **Defensibility is evaluator/critique-only.** Never expose a proposal as "correct", and never leak a defensibility field into a display projection. The auto-summary must not evaluate.
- **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria — not as follow-up i18n work.** Surfaces to check: UI chrome, curated records, book content, reference summaries, colleague dialogue, proposal text, hint text, rival-lab critiques, sources, debrief — **and now the auto-summary.**
- **Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback.** It turns a forgotten call site from a `tsc` error into a French player silently reading English.
- **Scientific run values are canonical across locales**; localise only for display.
- **Authored copy must not name a scene, phase, or route** (the `encodesPath` check). If the auto-summary template is authored prose, it needs the same check.
- **Fallible operations return `Result`; error codes resolve to localized copy. Never expose a raw error to the player.**
- **A refused action always says why**, and the message survives until a real state change replaces it.
- **Unit-test all pure domain logic with Vitest** — calculators, reducers, validators, migrations, significance rules, support predicates. Never require Phaser or a browser to test scientific logic.
- **axe and manual accessibility acceptance are no longer gates (ADR-008).** Keep the reduced-motion / no-flashing check. Add no new a11y-parity assertions, and delete no existing a11y specs.
- **Verify with `npm run typecheck`, `npm test`, and `npm run test:e2e`.**

### Baseline

Measured at `713012e` on an idle machine, immediately before this story was written:

```
npm run typecheck   → clean
npm test            → 69 files, 1196 tests, all passing (1.47s)
case.json version   → 1.16.0
record schemaVersion → 3
```

`npm run test:e2e` (chromium) was green as of Story 2.12 and unchanged by the commits since; re-measure it yourself before you start, so a pre-existing failure is not attributed to your change.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.1: Incremental reusable case-contract hardening`] — the two acceptance criteria reproduced verbatim as AC1/AC2 (lines 1076–1094).
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 3: Reusable case authoring and provenance`] — epic goal; FRs FR3, FR6, FR18, FR25–FR27.
- [Source: `_bmad-output/planning-artifacts/epics.md#Functional Requirements`] — FR4, FR6, FR7, FR18, FR23 (the auto-summary), FR25; NFR10, NFR12, NFR17, NFR19.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2 / Story 3.3 / Story 3.4`] — the scope boundaries this story must not cross.
- [Source: `_bmad-output/game-architecture.md#Content Model`] — the authored-field inventory and the v1.2 additive fields (`scenes[].cast?`, `primaryControls[].affordance?` — both Story 3.4).
- [Source: `_bmad-output/game-architecture.md#Architecture Decision Records`] — ADR-003 (validated data-driven cases), ADR-004 (deterministic model), ADR-006 (evidence-driven narrative rules), ADR-009 (scene router), ADR-010 (EN+FR), ADR-011 (canvas intent completeness).
- [Source: `_bmad-output/game-architecture.md#Architectural Boundaries`] — domain purity, Zod at boundaries, `public/cases/` immutability.
- [Source: `_bmad-output/project-context.md#Critical Implementation Rules`] — every rule reproduced in §Project Context Rules.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:75`] — the ineligible-artifact context dead end, assigned to this story by review decision 2026-08-07 (AC6).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:99`] — `selectAdvancedWavelengthUnlocked`'s duplicated `550` gate, assigned to whichever story next owns `AppState.ts` (AC7).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:128`] — the `state-a-limit` consultation copy, assigned to whichever story next owns `case.json` content (AC7).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:146`] — `AssetManifestSchema`'s path regex, assigned to whichever story next owns the schema (AC7).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:83, :100`] — the two renderer defects currently held closed by schema pins (§The tuple was load-bearing).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:25`] — the locale-arity lock on `renditions`; out of scope.
- [Source: `_bmad-output/implementation-artifacts/2-12-retire-dom-presentation-panels.md`] — the previous contract-touching story: its version-bump and allowlist discipline is the pattern to copy.
- Code read at baseline: `src/domain/cases/CaseDefinition.ts`, `src/domain/cases/ColleagueCast.ts`, `src/domain/cases/ScenarioScript.ts`, `src/domain/cases/contextPredictionReadiness.ts`, `src/domain/evidence/RunRecord.ts`, `src/domain/apparatus/calculateYoungFringeSpacing.ts`, `src/schemas/CaseDefinitionSchema.ts`, `src/schemas/CaseRecordSchema.ts`, `src/schemas/migrations/migrateCaseRecord.ts`, `src/adapters/content/loadCaseDefinition.ts`, `src/core/store/AppState.ts`, `src/core/store/selectors.ts`, `src/adapters/phaser/renderers/apparatusGeometry.ts`, `tests/unit/CaseDefinition.test.ts`, `tests/unit/SignificantMeasures.test.ts`.

## Open Questions for Alexis

These do **not** block the story — each has a decision recorded in §Decisions taken for you. Raise them if you disagree.

1. **Where the auto-summary is read (D5).** It renders in the printable record — the one surface that is already retained, already fed by selectors, and already exempt from canvas-completeness because it dispatches nothing. That satisfies FR23 without a new scene and without dead content. **What it does not do is show the player a summary mid-investigation.** FR23 lists auto-summaries beside reset, comparison and decision-history review — all in-play assistance — so if you read it as an in-play surface, that is a second (canvas) story and I have recorded it as deferred rather than folding a new overlay into a contract story. Say if you want it in-play now.
2. **AC1's field list is eight-ninths already shipped.** This story therefore reads its user story ("later cases can add only the fields they consume") as the real requirement and spends most of its effort on de-Younging the contract. That is a re-interpretation of the written AC, not a literal reading. **Confirm the reading**, or the dev agent may deliver a much smaller story that satisfies AC1 verbatim and leaves Story 3.2 blocked.
3. **The `max(2)` control-count ceiling (D2).** It unblocks Morley–Miller's *pair* (rotation + temperature) but not a three-instrument case. Morley–Miller looks like it fits in two. If a later case needs three, `deferred-work.md:100` (bench geometry) has to be resolved first, and that is renderer work, not contract work.
4. **Story sizing.** This is a large story: two schema files, one domain type, one persisted schema, two store files, `case.json`, four inherited carry-overs, and a new fixture. It is coherent (it is all "the case contract"), but if you would prefer it split — say, de-Younging in 3.1a and the auto-summary plus carry-overs in 3.1b — that is a cleaner review surface.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, `gds-dev-story`).

### Debug Log References

Baseline re-measured at `713012e` before any edit, on an idle machine: `npm run typecheck` clean,
`npm test` **69 files / 1196 tests**, `npm run test:e2e` (chromium) **59 passed / 1.7 min**. The story's
recorded baseline said "53/7" for e2e; that figure predates Story 2.12's spec cleanup, and the suite is
green, so the pre-existing-failure allowance was not needed.

**Mutation proofs.** Every new or rewritten guard was broken and restored, and the test that had to go red
recorded. 18 in total:

| Guard | Mutation | Result |
|---|---|---|
| Young bounds moved into the `id` branch | branch condition → an id that never matches | 7 red (6 bounds + cycle range) |
| Primary control uniqueness | condition → `false` | 1 red |
| Cycle `min <= max` | condition → `false` | 1 red |
| `MAX_PRIMARY_CONTROLS` ceiling | `.max(2)` → `.max(9)`; constant → 3 | 1 red; 3 red |
| Young requirement counts | condition → `false` | 1 red |
| Young fixed 550 nm | condition → `false` | 1 red |
| Young cycle range | condition → `false` | 2 red |
| Asset path regex + `..` segments | reverted to the baseline regex | 4 red |
| AC6 readiness reachability | `if (blocksReadiness)` → `false &&` | 4 red |
| Run controls: extra-key rejection | condition → `false` | 1 red |
| Run controls: snapshot from authored ids | rebuilt from input keys instead | 1 red |
| `fixedMinimumPathNm` parameterisation | back to a literal `550` | 2 red |
| Selector shares the reducer's gate | selector back to its own copy | 1 red |
| Auto-summary placeholder validation | checks English only | 1 red |
| Auto-summary source ordering | authored order → inspection order | 1 red |
| French list conjunction | `' et '` → `' and '` | 1 red |
| Configuration count | `countSignificantMeasures` → `runs.length` | 1 red |
| Bench-agreement loop (rewritten) | `!matchesBench` → `false`; `.every` → `.some` | 1 red each |
| Model-input/controls agreement (rewritten) | each of the two lines → `false` | 1 red each |

**Three findings the story's own inventory did not contain**, each found by a failing test rather than by
reading:

1. **`RunRecordSchema.controls` was also pinned to Young's two keys** (`CaseRecordSchema.ts:26`). Task 3
   named `activeControlValues` only, and `tsc` could not surface this one — it is a Zod shape, not a type,
   so nothing failed to compile. Found by writing the AC8 test that persists a second case's run. Leaving
   it would have made the whole de-Younging cosmetic: a second case could load and run, and its first
   saved observation would fail to parse on the next load, with autosave overwriting it. Relaxed the same
   way, for the same reason, with `schemaVersion` still 3.
2. **`tsconfig.json` includes only `src`**, so "the compiler is the inventory" holds for `src/` alone.
   Threading the control contract produced 5 clean `tsc` errors and **11 silent runtime failures in
   `tests/`**. Carried in `deferred-work.md`.
3. **Two renderers call `selectPrimaryControl` with Young's control ids written down**, and it throws
   inside `render()` — the Story 1.10 stranded-router door the story told me to check. The compiler used to
   prevent it (`PrimaryControl['id']` was a two-member union); it no longer can. Still unreachable
   (`main.ts` hard-codes Young, and the case-scoped branch requires exactly those two ids), so recorded and
   **assigned to Story 3.2**, which will hit both on its first run. Not fixed here: §Scope boundary forbids
   opening `src/adapters/phaser/`.

**Two places where I judged the story's instruction to be wrong, and did not follow it:**

- **Task 4 says to require `wavelengthComparison` in the Young branch.** I required `wavelengthNm` only.
  `wavelengthComparison` was **already `.optional()`** before this story, and the code reads it
  absent-tolerantly (`wavelengthComparison?.advancedChoicesNm ?? []`) — so requiring it would *tighten*
  the contract rather than preserve it, and it immediately rejected `validYoungCase`, the project's
  canonical fixture, which has been valid since Story 1.x. AC4 asks that guarantees the tuple was holding
  be re-stated; it does not ask for new ones. Reasoning recorded at the branch.
- **AC5 asks for print-view unit coverage in both locales.** `vitest.config.ts` configures no
  `environment`, so `document` does not exist in `tests/unit`, and mounting `CaseRecordPrintView` needs
  `jsdom` or `happy-dom` — a new dependency, which is an explicit HALT condition. Rather than halt a
  finished story over a test harness gap, the section is proved **end-to-end in both locales** instead
  (`recordedAutoSummary`: English in `young-canvas-experiment.spec.ts`, French in `rival-lab.spec.ts`) and
  the composer is unit-tested directly, 12 tests. Carried in `deferred-work.md`. **This is the one AC
  clause not met as literally written** — flagged rather than quietly reinterpreted.

### Completion Notes List

**AC1 — Confirmed the gap before writing anything.** Eight of AC1's nine fields already existed at
baseline, exactly as §Gap analysis said; nothing was re-added. The one missing field, the neutral
auto-summary, is built. So the story's substance was the de-Younging and the four carry-overs, per the
reading recorded in Open Question 2.

**AC2 — Validation, immutability, typed failure.** Unchanged in kind and now case-general. `deepFreeze` is
untouched; `loadCaseDefinition` remains the only boundary. Its failure message no longer says "the **Young**
case contract" — it would have misreported which case failed once a second case can load, and nothing
asserted the old string (verified by grep before changing it).

**AC3 — A second case parses, and Young is unchanged.** `describe('a second case')` derives
`cloneSecondCase()` from `validYoungCase` rather than forking it — a parallel fixture is one that stops
tracking the contract. It authors a different kebab-case id, a rotation/temperature control pair, no
wavelength, its own significance rule, `minimumRuns: 3` and a 2-to-6 cycle range, and parses clean. The
negative pair runs in both directions: that fixture claiming Young's id fails five Young rules by name, and
Young content with a foreign control id fails Young's bounds. **No new `public/cases/*` directory.**

**AC4 — Young's bounds are case-scoped, and every tuple guarantee is re-stated.** The story warned that
nothing pinned the two bounds messages, so **the six rejection tests were written and passing before the
check moved**; flipping the branch to an id that never matches turns all six red. The tuple's other three
guarantees: the count is `MAX_PRIMARY_CONTROLS = 2`, exported and asserted in `ApparatusGeometry.test.ts`
against `benchObjectBands` — at 2 every band is disjoint, at 3 the instruments overlap the wavelength
chooser by name — so the bound and its justification fail together; duplicate ids are an explicit rule,
tested against the non-Young fixture where the Young branch does not run (the three existing duplicate-id
tests never exercised uniqueness, exactly as §Read before editing said); `step > 0` was already
`PrimaryControlSchema`'s and is untouched.

**AC5 — The neutral auto-summary.** `src/domain/evidence/caseSummary.ts` is pure — no Phaser, DOM, Zod
(grepped). Closed placeholder vocabulary, validated **per locale** at load, so a template naming an unknown
token fails with a typed `invalid-case-definition` rather than printing `{token}` into a player's record.
Authored EN+FR in `case.json`. Rendered as one `<section>` in the existing
`src/ui/print/CaseRecordPrintView.ts` — **no new `src/ui/` module**, no new scene, zero Phaser files
changed. A test asserts the summary contains no evaluative vocabulary in either language and quotes no
proposal's claim, since ranking by attention is the subtler ADR-006 leak. `Intl.ListFormat` would have been
the obvious way to join source names but needs `lib: ES2021` against a pinned ES2020, so the conjunction
follows `formatNumber.ts`'s own `UNIT_SEPARATOR` precedent instead.

**AC6 — Stated as the general shape, not a second special case.** One rule: every authored artifact must be
reachably inspectable, which needs `rightsStatus === 'reviewed'` *and* a `textualRendition`. Either alone
makes context readiness permanently unreachable. The failure names the artifact's own path and its own
reason. `contextPredictionReadiness.ts` is untouched — the selector was always right. The rights rule
("only reviewed sources may provide a rendition") is kept separate because it is about rights, not
readiness. `ReadingGateHints.test.ts` is reconciled rather than deleted: it keeps pinning the selector, now
with a note that the state it describes is unauthorable and why its in-memory fixture is deliberate.

**AC7 — All four carry-overs closed.** Asset path regex (146): `^\/(?![/\\])` plus segment-wise `..`
rejection, both hostile paths as fixtures, plus a positive test for `young..v2.png` because the rule is a
segment rule and a substring hunt would reject a legitimate filename. The duplicated `550` gate (99): it
was **four** copies, not two — one shared `wavelengthComparison.ts` now holds both the count and the
predicate, and the reducer and selector call the same predicate, which was the item's real point. Its
decisive test uses a baseline that is *not* 550, the case that passed silently before. `state-a-limit`
copy (128): re-worded in EN and FR to name choosing a conclusion, the single act that writes claim and
limitation together since 2.12.

**AC8 — Relaxations, verified rather than asserted.** `caseId`, `activeControlValues` and (finding 1
above) `runs[].controls` all widened; `schemaVersion` stays 3 and `migrateCaseRecord.ts` is untouched
(`git diff` empty). A test loads a record in the exact pre-3.1 shape and every saved
`caseDefinitionVersion` from 1.2.0 to 1.16.0 against a 1.17.0 definition. Cross-case protection is not
lost — it never lived in the literal; `validateCaseRecordForDefinition` compares against `definition.id`,
which is stronger, and both directions are tested. The four control-value rejections (off-step,
out-of-range, unauthored key, missing key) still fire, now against the case's own control set. The
Zod 4 `z.record` trap is pinned by reading a key the type cannot know, which only compiles under
`Record<string, number>`. The **1.17.0 allowlist clause states what was verified byte-identical and how**:
I diffed `HEAD:case.json` against the new file and compared the recomputed canonical set field by field —
`peerReviewRules`' `feedback`/`revisionPath` and the proposal claims/limitations are identical; the only
changes are `autoSummary` (new), `consultationRules` and `version`. The clause says **explicitly** that the
consultation re-word is *not* in that recomputed set, rather than leaving the 2.12 clause's byte-identity
claim quietly amended — which is what deferred the re-word in the first place.

**AC9 — Bilingual from this commit.** `autoSummary` and the re-worded consultation carry complete EN and FR;
`print.summary.heading` is in both bundles. The French e2e assertion checks a French fragment *and* that the
English one is absent, so an `fr` copied from `en` fails. `encodesPath` now covers the auto-summary too.

**AC10 — Verification.** `npm run typecheck` clean. `npm test` **1270 tests / 71 files** (baseline
1196/69 — above the ≥1196/≥69 floor). `npm run test:e2e` (chromium) **59 passed** on an idle machine,
identical to the pre-change baseline. No accessibility-parity assertion added, no a11y spec deleted
(`tests/e2e/accessibility.spec.ts` untouched). `deferred-work.md` records four items closed and six
carried, each with a reason and, where relevant, an owner.

**Scope boundaries, verified by `git diff --stat` rather than by intention:** zero files changed under
`src/adapters/phaser/`; `migrations/` untouched; no new `public/cases/*`; no fourth `src/ui/` module;
`calculateYoungFringeSpacing.ts`, `opticalVisualModel.ts`, `contextPredictionReadiness.ts`,
`scenarioScript` authoring, `scenes[].cast`, `primaryControls[].affordance` and `main.ts`'s hard-coded load
all untouched. `.length(4)` on both proposal arrays and the `renditions` 2-tuple are deliberately intact.

### File List

**New**

- `src/domain/evidence/caseSummary.ts`
- `src/domain/evidence/wavelengthComparison.ts`
- `tests/unit/CaseSummary.test.ts`
- `tests/unit/WavelengthComparison.test.ts`

**Modified — source**

- `public/cases/young-interference/case.json`
- `src/adapters/content/loadCaseDefinition.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/core/store/AppState.ts`
- `src/core/store/selectors.ts`
- `src/domain/cases/CaseDefinition.ts`
- `src/domain/evidence/RunRecord.ts`
- `src/domain/evidence/significantMeasures.ts`
- `src/domain/review/colleagueHints.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/ui/print/CaseRecordPrintView.ts`

**Modified — tests**

- `tests/e2e/canvasHelpers.ts`
- `tests/e2e/rival-lab.spec.ts`
- `tests/e2e/young-canvas-experiment.spec.ts`
- `tests/integration/CuratedRecord.test.ts`
- `tests/integration/MeasurementNotebook.test.ts`
- `tests/integration/RecognitionStore.test.ts`
- `tests/unit/ApparatusGeometry.test.ts`
- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/ConclusionProposals.test.ts`
- `tests/unit/ConclusionReadiness.test.ts`
- `tests/unit/EvidenceStore.test.ts`
- `tests/unit/ReadingGateHints.test.ts`
- `tests/unit/ReviewRules.test.ts`
- `tests/unit/RunRecord.test.ts`
- `tests/unit/TheoryStore.test.ts`
- `tests/unit/YoungRunRecord.test.ts`

**Modified — documents**

- `_bmad-output/implementation-artifacts/3-1-incremental-reusable-case-contract-hardening.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`

## Change Log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-08-19 | 1.0 | Story context created | Alexis (create-story) |
| 2026-08-19 | 1.1 | De-Younged the shared case contract: `id`, the control set, the wavelength, the artifact count, the requirement counts and the cycle range are no longer pinned in the shared shape; Young's own numbers are enforced in a refinement branched on `id === 'young-interference'` | claude-opus-5 (dev-story) |
| 2026-08-19 | 1.2 | Added the neutral auto-summary (FR23): closed placeholder vocabulary validated per locale at load, a pure domain composer, authored EN+FR template, rendered as one section in the existing printable record | claude-opus-5 (dev-story) |
| 2026-08-19 | 1.3 | Closed four assigned carry-overs (`deferred-work.md` 75, 99, 128, 146) and re-stated every guarantee the removed `z.tuple` was holding | claude-opus-5 (dev-story) |
| 2026-08-19 | 1.4 | `case.json` → 1.17.0 with a record-compatibility clause whose byte-identity claim was verified by diffing; `CaseRecordSchema` relaxations keep `schemaVersion` at 3 | claude-opus-5 (dev-story) |
| 2026-08-19 | 1.5 | Verification: typecheck clean, 1270 tests / 71 files, e2e 59 passed; 18 mutation proofs; `deferred-work.md` and `project-context.md` (rev 2.4) updated | claude-opus-5 (dev-story) |

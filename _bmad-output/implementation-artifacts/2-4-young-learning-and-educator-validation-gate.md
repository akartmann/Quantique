---
baseline_commit: 87f0ab5
rebaselined: '2026-08-06 — Phaser guided-adventure pivot (supersedes the 2026-08-05 pre-pivot story)'
pivot_reference: 'planning-artifacts/sprint-change-proposal-2026-08-05.md §2.3, §2.4'
---

# Story 2.4: Young learning and educator validation gate

Status: done

## Story

As a release owner,
I want a moderated Young validation gate before later-case production,
so that later cases build on demonstrated learning, bilingual completeness, and educator value rather than an untested slice.

> **Deviation from `epics.md` (deliberate).** The epic's "So that" still reads "demonstrated learning, **accessibility**, and educator value". ADR-008 removed accessibility acceptance from the MVP gate, and the epic's own AC5 already carries the note "_Accessibility acceptance is removed from this gate per the pivot._" The benefit line is corrected here to name the gate that replaced it: **EN+FR completeness (NFR19)**. Everything else in AC1–AC6 traces to `epics.md` Story 2.4 plus the pivot's revised metric.

## Acceptance Criteria

1. **Given** a Young release candidate, **when** validation is scheduled before any Morley, Hafele–Keating, or Delft production work, **then** 15–30 moderated learner sessions are run with no product telemetry, **and** a facilitator-owned observation rubric records only consented, de-identified session evidence outside player progress, **and** each session record carries the interface locale it was run in (`en` or `fr`).

2. **Given** the completed moderated sessions, **when** the gate is evaluated, **then** at least 60% of participants can explain *why* they chose their conclusion **by referencing a measurement they saw in the lab**, **and** at least 60% voluntarily test at least one variable **beyond what the conclusion gate required of them**.

3. **Given** educator review of the Young candidate, **when** the gate is evaluated, **then** at least five educators state they would share or use the case, **and** the evidence artifacts name the session owner, rubric, de-identified aggregate (split by locale), educator responses, bilingual-completeness findings, reduced-motion/no-flashing findings, recorded (non-blocking) accessibility findings, and the release decision.

4. **Given** a learner needs validation access, **when** the candidate is launched for a moderated session, **then** a non-campaign validation route grants Young access without changing campaign locks or player progression, **and** it does not unlock, relock, or expose later cases, **and** its facilitator disclosure renders in the browser's resolved locale (EN and FR) with no score, right/wrong, or speed language.

5. **Given** the bilingual release requirement (NFR19, ADR-010), **when** the gate is evaluated, **then** every player-facing Young surface is complete in **both** EN and FR — interface chrome, curated record, book content, colleague dialogue, prediction and conclusion proposal text, hint text, rival-lab critique lines, source labels and attributions, debrief, error/recovery copy, the validation disclosure, and the print/export view — **and** the moderated sample includes at least one session run in each locale, **and** an EN-only sample cannot satisfy AC2.

6. **Given** any target, the scholarly source/rights review, the bilingual-completeness check, the reduced-motion / no-flashing check, the low-end-laptop 60-FPS 10-minute lab-loop check, or the cached offline-reload check is unmet — **or** Stories 2.5 and 2.6 have not shipped — **when** the Young gate is reviewed, **then** later-case production and Young public validation are blocked with no waiver, **and** the recorded release decision identifies the owner and required remediation. _(Manual accessibility acceptance is **not** a blocking row per ADR-008; findings are still recorded, marked non-blocking, and carried to the post-MVP a11y owner.)_

## Tasks / Subtasks

- [x] **Task 1 — Re-baseline the facilitator materials for the pivot** (AC: 1, 2, 3, 6)
  - [x] `docs/validation/young-observation-rubric.md` — rewrite **both** binary fields. They currently encode the retired player-authored-conclusion model.
    - Field A (was "Recorded-evidence explanation"): the conclusion is now **1 of 4 authored colleague proposals**, so "cites a recorded observation" is trivially satisfiable by reading the proposal card aloud. Redefine: **Yes** only when the participant, unprompted and in their own words, names a *specific measurement or apparatus setting from their own run* as the reason that proposal beat the others. **No** when they restate the proposal's text, cite a colleague's authority, cite the source reading alone, or give a general impression. Add both as explicit non-credit examples — this is the single distinction the gate now rests on.
    - Field B ("Beyond-minimum variable test"): the minimum path is no longer "2 runs" but "**≥2 significant measures** per the case's significance rule" (Story 2.6). Redefine "beyond-minimum" as any apparatus variation the participant initiates that was **not needed to unlock the conclusion** — a further run after unlock, varying the second primary control, or the optional advanced wavelength comparison (`experiment.wavelengthComparison.advancedChoicesNm`, currently `[450, 650]`). Do not define it by run count.
    - Add a **per-session locale field** (`en` / `fr`) and state that the aggregate reports each measure both overall and split by locale.
  - [x] `docs/validation/young-validation-plan.md` — add the locale protocol (how a facilitator runs an FR session: the locale comes from the browser's language preferences, **there is no in-product language selector**, so the facilitator configures the browser before the session). Remove the accessibility gate from the workflow's step list; keep an "accessibility findings — recorded, non-blocking, post-MVP" step. Add the 2.5/2.6 prerequisite from AC6: **no moderated session may be scheduled until the rival-lab critique and the significant-measure gate have shipped**, because both revised metrics are undefined without them.
  - [x] `docs/validation/young-validation-aggregate-template.md` — add locale columns/rows and the split-by-locale calculation; keep totals-only (no names, no raw conclusions).
  - [x] `docs/validation/young-release-decision-template.md` — restructure the gate table:
    - **Remove** "Manual accessibility acceptance" from the blocking rows.
    - **Add** blocking rows: `Stories 2.5 and 2.6 shipped` (prerequisite), `EN+FR content completeness across every Young surface`, `Reduced-motion / no-flashing check on the Phaser scenes`, `Moderated sample includes ≥1 EN and ≥1 FR session`.
    - **Add** a clearly separated non-blocking section for recorded accessibility findings with a named post-MVP carry-forward owner.
    - Keep: no waiver field, no override path, no partial approval; decision defaults to **Blocked**.
  - [x] `docs/validation/young-accessibility-findings-template.md` — retitle/reframe as **recorded, non-blocking, post-MVP** (ADR-008). Do **not** delete it, and do not delete the existing a11y specs. **Move** the reduced-motion and no-flashing/photosensitivity rows out into a new `docs/validation/young-motion-safety-template.md` as a **blocking** check — that guard survives the a11y de-scope and is the one motion rule the project still enforces.
  - [x] Add `docs/validation/young-bilingual-completeness-template.md`: one row per surface named in AC5, each with reviewer, evidence reference, Pass/Blocked, remediation owner, follow-up date. This is the project's most-repeated defect class — enumerate the surfaces rather than writing "all content".
  - [x] `docs/validation/young-technical-evidence.md` — **the recorded 2026-08-05 all-Pass table is stale** (12 stories have landed since; baseline is now `87f0ab5`). Reset every row to unrecorded, restamp against the current commit, and add a line naming the **known baseline-failing e2e specs** from `implementation-artifacts/deferred-work.md` so a pre-existing failure is never recorded as a Pass or attributed to this story.

- [x] **Task 2 — Localize the validation disclosure (live NFR19 defect)** (AC: 4, 5)
  - [x] `src/ui/ValidationSessionDisclosure.ts` hardcodes four English strings including its `aria-label`. Change the signature to `mountValidationSessionDisclosure(root: HTMLElement, locale: Locale)` — **required parameter, no `DEFAULT_LOCALE` fallback** (project-context: a silent default turns a forgotten call site from a `tsc` error into a French player silently reading English).
  - [x] Resolve every string through `createTranslator(locale)`. Add keys to `src/core/i18n/locales/en.ts` **and** `fr.ts` in a new `// --- Validation session ---` group: `validation.session.title`, `validation.session.facilitatorHeld`, `validation.session.noCollection`. `fr.ts` is typed as `keyof typeof en`, so a missing FR key is a `tsc` failure and `tests/unit/I18n.test.ts` already asserts key parity — no new completeness test is needed.
  - [x] Follow `docs/i18n-authoring.md` for key placement, FR typography (`«  »` guillemets with non-breaking spaces, `’` apostrophe), and the app-text-vs-case-content split. This disclosure is **app-owned interface text**, so it belongs in the locale files, not in `case.json`.
  - [x] `src/main.ts:80` — pass the already-resolved `locale` into the mount call.
  - [x] FR copy must stay calm and non-evaluative: no score, correctness, grading, or speed language, and no implication that the product is assessing the learner.
  - [x] Keep the existing `.validation-session-disclosure` class contract in `public/style.css` and the `#validation-session-disclosure` root in `index.html` unchanged — FR copy is longer than EN, so verify it does not overflow or clip at 1280×720.

- [x] **Task 3 — Keep the validation route's product isolation intact** (AC: 4)
  - [x] Verify (do not rebuild) the existing `?mode=validation` behaviour in `src/main.ts:26,63-80`: mode is read **before** any repository exists; the route builds a fresh `createInitialAppState`, never calls `CaseRecordRepository.load`, and gates `mountCaseProgressPanel` + `mountCaseRecordPrintView` behind `if (repository)`. That ordering is the whole isolation guarantee — do not move the flag read after the `await`, and do not add an `else` branch that constructs a repository.
  - [x] Validation mode must still write nothing to IndexedDB, `localStorage`, the network, console, analytics, or error telemetry, and must create no `CaseRecord`.
  - [x] Add **no** validation/consent/educator/session fields to `CaseDefinition`, `AppState`, `CaseRecordProjection`, `CaseRecordSchema`, exports, imports, migrations, or the print view. Do not mutate `public/cases/young-interference/case.json` (currently `1.8.0`) for process evidence.
  - [x] Do not invent campaign state, later-case routes, or generic routing. The product ships one case; AC4's "does not unlock, relock, or expose later cases" is satisfied by the absence of that machinery, not by building locks to leave alone.

- [x] **Task 4 — Re-point the validation e2e coverage at the Phaser-era contract** (AC: 4, 5)
  - [x] `tests/e2e/validation-route.spec.ts` currently asserts through retired DOM panels — `region "Curated Record"`, `region "Save, export, import, and print"`, `"Inspection recorded"`. Per `deferred-work.md`, several specs in this family already fail on baseline. Rewrite the isolation assertions against surfaces that are current: `#game-container[data-active-scene]` (see `tests/e2e/scene-router.spec.ts` for the reference helper), the retained `data-testid="enter-laboratory"` / `#boot-status` boot contract, and the **absence** of the progress region and the printable-record article.
  - [x] Keep the cross-route isolation proof, which is the test's real value: seed a saved record on the normal route, visit `/?mode=validation`, interact, return to `/`, and assert the saved record is byte-for-byte untouched.
  - [x] Keep the later-case leak assertions for AC4 — no link and no body text matching `/Morley|Hafele|Delft/i` on the validation route.
  - [x] Add an FR case with `test.use({ locale: 'fr-FR' })` (the pattern in `tests/e2e/french-typography.spec.ts:37`) asserting the disclosure renders the FR strings, imported from `src/core/i18n/locales/fr` rather than restated as literals.
  - [x] `tests/e2e/accessibility.spec.ts:56-64` — keep the existing validation-disclosure spec (de-scoped, not wrong). Add no new a11y-parity assertions. Its axe result is **supporting evidence only** and must not be recorded as a gate.
  - [x] `tests/e2e/offline-reload.spec.ts:137-149` — keep cached validation-route startup; update any assertion that reaches through a retired panel.
  - [x] Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:e2e:offline`, `npm run test:e2e:cross-browser`, and `npm run test:e2e:a11y`. **Capture the baseline result on `87f0ab5` first**, then compare — record pre-existing failures as pre-existing, name unavailable browsers, and never fabricate a pass.

- [x] **Task 5 — Leave the human gates honestly open** (AC: 1, 2, 3, 5, 6)
  - [x] Every facilitator- and reviewer-owned row stays **unrecorded and Blocked**. This story delivers the *instrument*; it cannot deliver the 15–30 sessions, five educator responses, source/rights review, bilingual review, motion-safety check, low-end-laptop 60-FPS loop, or human offline acceptance.
  - [x] No automated test, rendered FPS estimate, or axe run may be presented as any of those. State in the completion notes that release remains blocked and which named owners must supply what.

### Review Findings

_Code review 2026-08-06 against baseline `87f0ab5`. Three layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), all completed. 4 decisions, 12 patches, 8 deferred, 10 dismissed as noise. Every finding below was independently verified against the files; the dev record's test claims were re-run and hold exactly (typecheck Pass; `npm test` 35 files / 428 tests; e2e 7 failed / 34 passed with the identical pre-existing failure set)._

**All 4 decisions resolved by Alexis and all 12 patches applied 2026-08-06.** How the decisions went:

1. **Field A — an apparatus setting is meant to count.** The rubric keeps "measurement **or** apparatus setting". A deliberate-deviation block was added recording that AC2's narrower "a measurement they saw in the lab" is superseded here, with the reasoning (setting a control and seeing its effect *is* the measurement act in this case) so nobody "corrects" it back later.
2. **Automated technical evidence — reframed as a no-regression gate.** A green-suite reading made the row permanently Blocked on unowned work. It now passes when the candidate introduces no failure that is not already enumerated and every failure is named and classified; the pre-existing set is not forgiven but carried by two new blocking prerequisite rows (`baseline failures are owned`, `the enumerated list has not grown without the release owner's signature`), so laundering a regression into the baseline table costs a signature.
3. **Disclosure mount moved above the content load.** `mountValidationSessionDisclosure` now runs immediately after `createBootShell`, before `await loadCaseDefinition`, so a content failure can no longer leave a moderated session live with no AC4 privacy statement. The mode flag is still read at the top of the function before any repository exists, so the Task 3 isolation ordering is untouched.
4. **Explicit restore content assertion added.** Asserted on the retained print view (ADR-007) rather than a retiring panel: the restored record must list the inspected source and must not render `print.sources.empty`.

**Two patches changed shape once measured, rather than being applied as written.**

- The FR "no clipping" check was replaced with a *fits-in-viewport* check, because the original risk does not exist. Measured directly: `scrollHeight - clientHeight` stays 0 on both the disclosure and `.boot-shell` even at 60× the real copy — the page simply grows and scrolls, so nothing can clip and every containment assertion passes for any text. My first replacement (measuring against the ancestor frame) was **also** vacuous and was discarded after it failed to catch the mutant. What longer FR copy genuinely breaks is readability without scrolling: the disclosure sits below the entry button, real FR copy clears the fold by ~283px, and 60× the copy misses it by ~1031px. The test is renamed to say what it now asserts.
- The baseline-failure tables are now keyed by **spec title**, not line number, because this story's own added import moved `accessibility.spec.ts:4` to `:6` — the documented procedure would have classified a known pre-existing failure as a candidate regression. Four of the seven titles I first wrote were wrong and were corrected against the files; all seven now match Playwright's reported titles verbatim.

**Every repaired guard was mutation-tested to prove it can fail**, since three of the defects were assertions that could not:

| Mutation | Before | After |
| --- | --- | --- |
| `fr['validation.session.title']` set to the English string | passed | fails — `fr title must not fall back to the English string` |
| `fr['validation.session.title']` set to `''` (→ silent English fallback via `translate`'s `length > 0` gate) | passed | fails, same assertion |
| FR copy set to `Une évaluation de vos réponses est enregistrée.` | passed | fails — `/(^\|[^\p{L}])évalu/iu` |
| FR `facilitatorHeld` × 60 | passed | fails — `pixelsBelowFold` received `1031` |
| `main.ts` restore silently dropped (`initialState = initialState`), record left intact on disk | passed — byte-equality alone did not catch it | fails — print view renders `No sources inspected.` |

**Verification after the review changes** — every suite matches the pre-review result, so no patch introduced a regression: typecheck Pass; `npm test` 35 files / 428 tests Pass; `npm run build` Pass; `test:e2e` chromium **7 failed / 34 passed** (the same 7 enumerated pre-existing specs); `test:e2e:cross-browser` **31 failed / 92 passed**; `test:e2e:offline` **1 failed / 4 passed**; `test:e2e:a11y` **1 failed / 1 passed**.

**The release gate itself is unchanged by this review: still Blocked.** Nothing human-owned was signed, and the two new prerequisite rows add to the blocking set rather than relaxing it.

- [x] [Review][Decision] **Rubric Field A grants a Yes for an apparatus setting alone, which AC2 does not** — Field A credits "a specific measurement **or apparatus setting** from their own run", but AC2 and the GDD metric both require "referencing **a measurement** they saw in the lab". "I set the slits to 0.10 mm" names a setting and no observed measurement, earns a Yes, and does not satisfy AC2 — the instrument can record a Pass the acceptance criterion does not grant, which is the exact failure mode the rewrite existed to close. Tighten the rubric to require the setting be tied to an observed outcome, or re-read AC2/GDD as intending settings to count. Alexis owns the metric. [docs/validation/young-observation-rubric.md:30-31]
- [x] [Review][Decision] **"Automated technical evidence" is a blocking, non-waivable row that can never be recorded Pass** — `young-technical-evidence.md:73-75` forbids recording a suite as passed when its only failures are pre-existing ("the row result reflects the suite"), and 7 chromium specs fail on baseline with 6 further firefox/webkit failures this story surfaced as unowned. The row is therefore permanently Blocked, so the conjunctive gate blocks the release on work nobody is assigned. Options: (a) add a blocking remediation row with a named owner for the baseline-failing specs, (b) reword the row to "no candidate regressions against baseline" rather than "suite green", (c) accept a permanently-blocked row. [docs/validation/young-release-decision-template.md, docs/validation/young-technical-evidence.md:73-75]
- [x] [Review][Decision] **The validation route renders no privacy disclosure when case content fails to load, and Enter then overwrites the error with "Laboratory shell ready."** — `createBootShell` (main.ts:51) attaches the Enter listener and renders text unconditionally, then `loadCaseDefinition` failure returns at main.ts:58 before the disclosure mounts at main.ts:80. On a cold cache with no network, or any content-parse failure, the facilitator sees a live-looking boot frame with **no** AC4 privacy statement, and clicking Enter replaces the content error with `boot.status.ready`. Pre-existing ordering, but the disclosure is this story's surface and AC4 requires it. Fix options: mount the disclosure before the content load (the mode flag is already read at main.ts:26, so isolation ordering is preserved), make the error status sticky, or both — this exceeds the story's "one argument" scope for `main.ts`, so it needs a call. [src/main.ts:51-58,80]
- [x] [Review][Decision] **The cross-route restore proof was lost in the e2e rewrite** — the old spec asserted `Inspection recorded` survived the round trip back to `/`; the replacement asserts `expectActiveScene(page, 'Library')`. The seed is taken at the `context` phase, and a completely fresh state also routes to `Library`, so the assertion cannot distinguish restored from not-restored. Byte-equality on disk proves the record is intact, never that the app read it back — and main.ts:71 swallows a failed restore into a polite status message. Options: seed at a later phase (`experiment` → `Laboratory`, the pattern in `scene-router.spec.ts:141-163`) so the scene assertion discriminates, add an explicit restored-content assertion, or accept byte-equality only. [tests/e2e/validation-route.spec.ts:118-124]
- [x] [Review][Patch] Bilingual completeness sheet omits the laboratory surface and four other localized groups — `lab.*`, `experiment.result.*`, `recognition.*`, peer-review projection, and conclusion readiness have no row, so a reviewer can sign all 13 rows without ever looking at the apparatus, the fringe-spacing readout, or recognition text. AC5's leading clause says *every* player-facing surface [docs/validation/young-bilingual-completeness-template.md:20-33]
- [x] [Review][Patch] `/\bévalu/i` and `/\béchou/i` can never match — `\b` needs an ASCII word-char transition and `é` is not one, so the French words for *assessing* and *failing* are unguarded; `assess` and `test you` also have no FR counterpart [tests/unit/ValidationSessionDisclosure.test.ts:52-62]
- [x] [Review][Patch] The FR "does not overflow or clip" assertion cannot fail — proven by injecting ~18,000 chars of French copy: the measured section still reported 0/0 while the document overflowed. The element is auto-height `display:grid` with no `overflow` or `max-height`; the constrained boxes are its ancestors [tests/e2e/validation-route.spec.ts:157-162]
- [x] [Review][Patch] `title` is excluded from the FR-distinctness check, and `translate` treats `''` as absent — so an empty or EN-copied `fr['validation.session.title']` passes tsc and all four unit tests and yields an English `aria-label` and `<h2>` in a French session [tests/unit/ValidationSessionDisclosure.test.ts:34]
- [x] [Review][Patch] The baseline-failure table records `accessibility.spec.ts:4`, but this change's own import moved that test to line 6 — the documented procedure would classify a known pre-existing failure as a candidate regression. Add a stable spec-title column [docs/validation/young-technical-evidence.md:49]
- [x] [Review][Patch] `young-experiment.spec.ts` is cited at `:19` (story:131, deferred-work.md:14) and `:12` (story:201, technical-evidence:55) for the same failure — one of them will not match a candidate run [_bmad-output/implementation-artifacts/2-4-young-learning-and-educator-validation-gate.md:131,201]
- [x] [Review][Patch] The locale protocol claims "the first paint is already in the resolved language — there is no English-to-French flash", then instructs the facilitator to abort if the boot frame is in the wrong language. `index.html:15-24` ships English pre-hydration placeholders by design and says so in its own comment, so a correctly configured FR session can be aborted [docs/validation/young-validation-plan.md:47-49]
- [x] [Review][Patch] Field A's "unprompted" headline contradicts the neutral opener that plan step 6 prescribes and that Field A itself permits 20 lines later — two facilitators will score the same session differently on the single binary the 60% gate rests on [docs/validation/young-observation-rubric.md:30,49-51]
- [x] [Review][Patch] Rubric and aggregate instruct opposite row-level recordings for Measures A and B on a single-locale sample — the rubric says neither 60% target can be satisfied (→ Blocked), the aggregate makes them a pure overall-percentage test with locale coverage as a separate third row (→ Pass). Same final decision, but these are the figures quoted forward as the learning result [docs/validation/young-observation-rubric.md:90, docs/validation/young-validation-aggregate-template.md:53-63]
- [x] [Review][Patch] The aggregate's "per-locale denominators sum to the overall denominator" invariant has no bucket for a session whose locale went unrecorded — a case the rubric explicitly anticipates, and which the three exclusion categories do not cover, so the sheet cannot be completed [docs/validation/young-validation-aggregate-template.md:49-51]
- [x] [Review][Patch] "Do not record which locale an individual participant used" reads as forbidding the per-session locale field the rubric and plan both require — scope it to this sheet [docs/validation/young-validation-aggregate-template.md:66-67]
- [x] [Review][Patch] Trailing markdown hard line breaks were stripped from the release-decision header, collapsing Release owner / Decision date / Decision into one rendered line on a form meant to be signed [docs/validation/young-release-decision-template.md:3-5]
- [x] [Review][Defer] `?mode=validation` is exact case-sensitive equality, so `?mode=Validation` fails **open** into the autosaving route with no disclosure [src/main.ts:26] — deferred, pre-existing
- [x] [Review][Defer] `SceneRouter` `console.error` is not DEV-gated and the router is constructed in both modes, so Task 3's "writes nothing to console" is not strictly true [src/adapters/phaser/SceneRouter.ts:92] — deferred, pre-existing
- [x] [Review][Defer] The 15-clause boot guard requires all 13 retired-panel roots, including `#case-progress` and `#print-record` which validation mode never uses; removing any silently disables the disclosure with no status message [src/main.ts:27-45] — deferred, pre-existing
- [x] [Review][Defer] Six firefox/webkit baseline failures this story surfaced are untracked and unowned — carried into `deferred-work.md` as the story's Debug Log requested [docs/validation/young-technical-evidence.md:60-70] — deferred, pre-existing
- [x] [Review][Defer] `PROGRESS_REGION` count-0 assertions and the panel-based seeding path both die when `CaseProgressPanel` is deleted, and the suite has no alternative seeding path [tests/e2e/validation-route.spec.ts:18,60] — deferred, pre-existing
- [x] [Review][Defer] The new IndexedDB probe duplicates `'quantique-progress'` / version `1` / `'case-records'` from source rather than reading exported constants, against the project testing rule [tests/e2e/validation-route.spec.ts:34-36] — deferred, pre-existing
- [x] [Review][Defer] EN e2e assertions depend on an unpinned browser locale; could not reproduce (all three projects reported `en-US` on this host) but Playwright's `locale` defaults to the system locale [playwright.config.ts:8-11] — deferred, pre-existing
- [x] [Review][Defer] `docs/i18n-authoring.md` says the locale always comes from `selectLocale(state)` and never from a captured argument, conflicting with this story's mandated captured `locale` parameter — the doc is what is out of step [docs/i18n-authoring.md] — deferred, pre-existing

## Dev Notes

### Read this first: what changed since the last version of this story

The 2026-08-05 story file for 2.4 was written against the **retired** contract and was marked complete against it. Every one of these is now wrong and must not be carried forward:

| Retired assertion in the old story | Current rule |
| --- | --- |
| "Keep semantic HTML authoritative"; "Phaser remains a visual mirror" | Phaser scenes are the **sole** interactive surface (ADR-001 v1.1). Never add semantic HTML to mirror a Phaser gesture. |
| "Manual accessibility acceptance" as a blocking gate; 44px targets, screen-reader announcements, non-colour meaning | De-scoped from MVP (ADR-008). Recorded non-blocking. **Only** reduced-motion / no-flashing is retained, and it is blocking. |
| AC2 = "cites a recorded observation or setting when explaining their conclusion" | AC2 = explains *why they chose that proposal* by referencing a measurement they ran. The conclusion is authored now; the old wording is satisfied by reading a card aloud. |
| No i18n requirement anywhere | EN+FR from launch (NFR19, ADR-010) — and the validation disclosure this story owns is currently English-only. |
| Automated evidence table recorded all-Pass on 2026-08-05 | Stale by 12 stories. Some e2e specs fail on baseline (`deferred-work.md`). Re-verify. |

### Scope, dependencies, and non-goals

- This is a **release-governance** story. Most of it is facilitator documentation under `docs/validation/`; the code surface is deliberately tiny (one localization fix, one e2e re-point, one verification pass).
- **Hard dependency on unshipped work.** Stories 2.5 (rival-lab critique) and 2.6 (significant-measure gate + colleague hints) are `backlog`. Neither exists in `src/`: there is no `RivalLabScene`, and `src/domain/theory/conclusionReadiness.ts` has no significance concept — `case.json` carries only `requirements.minimumRuns: 2`, no significance rule. **Both revised AC2 metrics are undefined without them.** Build the instrument now; AC6 blocks *running* the gate until they land.
- Story 2.3 shipped the **pre-pivot** synthesis model (two distinct configurations + a saved comparison, and a DOM `HistoricalDebriefPanel`). Do not treat it as the significant-measure gate.
- **Not in scope:** player analytics, adaptive assessment, accounts, cloud save, a campaign system, later cases, a generic case framework, a hosted survey, a release dashboard, or any product instrumentation. Facilitator artifacts are project documentation, never game data.

### Current code intelligence — read before editing

| Path | Current behaviour to preserve | This story's change boundary |
| --- | --- | --- |
| `src/main.ts:26` | `?mode=validation` parsed **before** `loadCaseDefinition` and before any repository exists. | Pass `locale` to the disclosure mount at line 80. Nothing else. |
| `src/main.ts:61-78` | Non-validation only: constructs `CaseRecordRepository`, restores the saved record, sets boot status on unusable/unavailable progress. | Unchanged. Do not add an `else` branch. |
| `src/main.ts:105-108` | `mountCaseProgressPanel` + `mountCaseRecordPrintView` gated behind `if (repository)` — the isolation mechanism. | Unchanged. |
| `src/main.ts:88-104` | Mounts every retired `src/ui/*` panel in **both** modes. | Leave alone. This is the documented pivot deferral, not this story's to fix, and not a pattern to extend. |
| `src/ui/ValidationSessionDisclosure.ts` | Four hardcoded English strings incl. `aria-label`. | **The one real code defect.** Localize; require `locale`. |
| `src/ui/BootShell.ts` | Reference pattern: retained non-Phaser frame, localized via `createTranslator(locale)`, sets `document.documentElement.lang`. | Follow it. Do not restyle or extend the shell. |
| `src/core/i18n/locales/{en,fr}.ts` | Flat dotted keys; `fr` typed as `keyof typeof en`, so a gap is a `tsc` error. | Add the `validation.session.*` group to **both**. |
| `index.html:28`, `public/style.css:155-162` | `#validation-session-disclosure` root and its styles. | Keep the contract; verify FR length at 1280×720. |
| `public/cases/young-interference/case.json` | Immutable reviewed content, `1.8.0`. | Do not touch. No process evidence in case data. |
| `tests/e2e/validation-route.spec.ts` | Drives retired DOM panels. | Re-point at the Phaser-era contract; keep the cross-route isolation proof. |

### Why the disclosure stays in the boot shell rather than moving into a scene

Project-context forbids extending `src/ui/*` panels and forbids semantic HTML that mirrors a Phaser gesture. Neither applies here: the disclosure is **facilitator-facing static chrome adjacent to the boot frame** and mirrors no interactive gesture. `BootShell` is an explicitly retained non-Phaser surface. Keep the disclosure where it is and localize it — do not build a Phaser disclosure scene, and do not fold it into a retired panel.

### Privacy and gate rules — non-negotiable

- **Product telemetry is prohibited.** No `fetch`, beacons, analytics SDK, event logging, web form, cloud storage, `localStorage`, new IndexedDB table, product metric, or hidden instrumentation.
- Never log, save, export, print, or display learner-entered text outside the learner-owned record. In validation mode, create no portable record at all.
- **The 60% metrics are human observations, never derived product facts.** A test may prove route isolation and that the beyond-minimum interaction is *reachable*; it must never assert that a participant learned, cited evidence, or chose to explore.
- Named owners required in the release evidence: learning-validation lead / session owner, educator-review lead, scholarly-and-rights reviewer, bilingual reviewer, QA/release lead, release owner, and the post-MVP accessibility carry-forward owner.
- **All blocking gates are conjunctive and non-waivable.** One failure blocks both Young public validation and all later-case production.

### Testing requirements

- Unit tests only for extracted pure helpers, if any are introduced. Do not put browser APIs in `src/domain/`.
- E2E asserts public roles, labels, rendered text, and `data-active-scene` — never Phaser private fields, pixel snapshots, or internal store state.
- FR e2e uses `test.use({ locale: 'fr-FR' })` and imports expected strings from `src/core/i18n/locales/fr`. Never assert a magic string or number that source also owns unless both read one exported constant.
- Playwright runs with `PLAYWRIGHT_BROWSERS_PATH=0`. Establish the baseline on `87f0ab5` before comparing; `deferred-work.md` lists specs that fail there (stale `Record prepared observation` button in ~6 specs; the `young-experiment.spec.ts` disabled-state mismatch — the test declaration is at `:12` and the failing assertion at `:18`, which `deferred-work.md` cites as `:19`. Match these by spec title, not line number; `young-technical-evidence.md` carries the stable keys).
- 15–30 moderated sessions, the 60-FPS low-end-laptop loop, motion safety, bilingual review, and human cached-offline acceptance are **manual release evidence**. Automation cannot substitute.

### Stack

The stack is pinned and no upgrade is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1. `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). This story adds **no dependency** — a hosted survey, form service, or analytics SDK would each violate NFR5 and the privacy rules above.

### Project Structure Notes

- **New:** `docs/validation/young-bilingual-completeness-template.md`, `docs/validation/young-motion-safety-template.md`.
- **Revised:** `docs/validation/young-observation-rubric.md`, `young-validation-plan.md`, `young-validation-aggregate-template.md`, `young-release-decision-template.md`, `young-accessibility-findings-template.md`, `young-technical-evidence.md`.
- **Revised code:** `src/ui/ValidationSessionDisclosure.ts`, `src/core/i18n/locales/en.ts`, `src/core/i18n/locales/fr.ts`, `src/main.ts` (one argument), `tests/e2e/validation-route.spec.ts`, and `tests/e2e/offline-reload.spec.ts` only if it reaches through a retired panel.
- Validation docs stay under `docs/` — **never** under `public/`, and never in a test fixture.
- Naming: PascalCase for classes/components and their files, camelCase for functions/properties/JSON fields, `kebab-case` for docs and assets, dotted flat i18n keys.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.0) — the rules that bind this story:

- **Engine:** Phaser scenes own all interactive presentation. The only non-Phaser surfaces are the retained boot frame and `src/ui/print/CaseRecordPrintView.ts` + `src/adapters/export/`. Never add semantic HTML to reach parity with a Phaser control. `src/ui/*` panels are retired-but-mounted: do not extend, restyle, or add to them. `src/game/scenes/*` are orphaned template leftovers — ignore them.
- **i18n:** EN+FR from launch; locale is resolved from the browser and there is **no player-facing language selector**. Every new content surface carries the EN+FR requirement as part of its own acceptance criteria — this is the project's most-repeated defect. Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback. Do not add a webfont; `UI_FONT_STACK` already covers the French repertoire.
- **Guided adventure:** no hard fail, score, speed reward, or reward for overclaiming — the rival lab included. The evidence evaluator is the sole completion authority; never hard-code completion or mark a proposal "correct" outside it. Conclusion unlocks at ≥2 significant measures.
- **Organization:** `src/domain/` is pure TypeScript (no Phaser, DOM, `fetch`, IndexedDB, browser APIs, or Zod); `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. No generic `services/`, `managers/`, or `helpers/`. Case definitions under `public/cases/` are immutable; player progress lives only in IndexedDB. Every Zod object is `.strict()`. Fallible operations return `Result<T, ResultError>`.
- **Platform:** static hosted web app; no account, analytics, cloud save, remote config, or network request may block core play. **Offline reload is a release gate.** Never expose a raw error to the player; never log learner-entered conclusions by default.
- **Testing:** unit-test pure domain logic with Vitest and never require a browser for scientific logic; inject structural slices rather than a real `Phaser.Game`. Keep the reduced-motion / no-flashing check; add no new a11y-parity assertions and delete no existing a11y specs. Check the baseline before attributing an e2e failure to your change. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 2` — Story 2.4 AC1–AC5; Stories 2.5/2.6 dependency; FR25/FR26; NFR13, NFR19]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md#2.3` — "Story 2.4 (validation gate): success metrics revised — 'cites own observation' no longer applies to an authored conclusion"]
- [Source: `_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md#Success Metrics` — ≥60% explain *why* by referencing a measurement seen in the lab; ≥60% voluntary beyond-minimum test; ≥5 educators; scholarly review before public validation; Out of Scope — localization beyond EN/FR]
- [Source: `_bmad-output/game-architecture.md` — ADR-001 v1.1 (single Phaser surface), ADR-007 (print/export the only non-Phaser surface), ADR-008 (a11y de-scoped, retain no-flashing), ADR-010 (EN+FR), #Test and Release Readiness]
- [Source: `_bmad-output/project-context.md` — revision 2.0; engine, i18n, guided-adventure, organization, testing, platform, and don't-miss rules]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — baseline-failing e2e specs; optional-`locale` defaults carried forward from 1.1b review; `#game-container` `aria-hidden` a11y carry-forward]
- [Source: `_bmad-output/implementation-artifacts/2-3-young-synthesis-debrief-and-replay.md` — pre-pivot synthesis/completion/replay model; do not mistake it for the significance gate]
- [Source: `src/main.ts:26,61-80,105-108` — validation-mode ordering and the `if (repository)` isolation gate]
- [Source: `src/ui/ValidationSessionDisclosure.ts`, `src/ui/BootShell.ts`, `src/core/i18n/locales/{en,fr}.ts` — the English-only disclosure and the localized-frame pattern to follow]
- [Source: `public/cases/young-interference/case.json` — `version 1.8.0`; `requirements.minimumRuns: 2`; `experiment.wavelengthComparison.advancedChoicesNm: [450, 650]`; no significance rule yet]
- [Source: `tests/e2e/validation-route.spec.ts`, `tests/e2e/scene-router.spec.ts:5-8`, `tests/e2e/french-typography.spec.ts:37`, `tests/e2e/accessibility.spec.ts:56-64`, `tests/e2e/offline-reload.spec.ts:137-149` — current assertions and the Phaser-era / FR-locale patterns to adopt]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`) via Claude Code.

### Debug Log References

**Baseline captured first, on `87f0ab5`.** `HEAD` at the start of work was `b9d077f`, whose only
contents are this story file and `sprint-status.yaml` — `git diff 87f0ab5 HEAD --stat` shows no code or
test change — so the working tree baseline *is* the `87f0ab5` baseline.

| Suite | Baseline (`87f0ab5`) | After this story | Delta |
| --- | --- | --- | --- |
| `npm run typecheck` | Pass | Pass | — |
| `npm test` | Pass — 34 files, 424 tests | Pass — 35 files, 428 tests | +1 file, +4 tests (the new disclosure unit test) |
| `npm run build` | Pass | Pass | — |
| `npm run test:e2e` (chromium) | 7 failed, 33 passed | 7 failed, **34 passed** | +1 passing (new FR disclosure case). **Identical failure set.** |
| `npm run test:e2e:offline` (chromium) | 1 failed, 4 passed | 1 failed, 4 passed | Identical |
| `npm run test:e2e:a11y` (chromium) | 1 failed, 1 passed | 1 failed, 1 passed | Identical |
| `npm run test:e2e:cross-browser` | 31 failed, 89 passed | 31 failed, **92 passed** | +3 passing (new FR case × 3 browsers). Failure set diffed spec-by-spec and browser-by-browser: **identical**. |

All three browser projects (chromium, firefox, webkit) were available; none was skipped or unavailable.
`tests/e2e/validation-route.spec.ts` was additionally re-run against all three after the final edit:
**6 passed**.

**The 7 chromium failures are pre-existing on baseline and are not attributable to this story.** Six are
the stale `Record prepared observation` notebook button tracked in `deferred-work.md`
(`accessibility.spec.ts`, `curated-record.spec.ts:179`, `inquiry-recognition.spec.ts:4`,
`offline-reload.spec.ts:72`, `progress-portability.spec.ts:4`, `theory-board.spec.ts:3`); the seventh is
the `young-experiment.spec.ts:12` `aria-disabled`-vs-hard-`disabled` mismatch, also tracked there.
`accessibility.spec.ts:4` moved to `:6` because this story added an import line to that file; it is the
same pre-existing test and the same pre-existing failure.

**Found while establishing the cross-browser baseline, and not previously tracked anywhere:** six specs
fail on baseline in firefox and/or webkit only — `accessible-control.spec.ts:56`,
`dialogue-advance.spec.ts:68`, `dialogue-advance.spec.ts:98`, `scene-router.spec.ts:31` (both browsers),
plus `offline-reload.spec.ts:17` (French offline reload) and `offline-reload.spec.ts:137` (cached
validation route) in webkit only. `deferred-work.md` does not list them and they have no owner. They are
recorded in `docs/validation/young-technical-evidence.md` so the cross-browser row cannot be signed
without seeing them, but assigning them is outside this story's scope — flagging for the reviewer to
carry into `deferred-work.md`.

**Isolation verified rather than rebuilt (Task 3).** `?mode=validation` is still read at
`src/main.ts:26`, before `loadCaseDefinition` and before any repository exists; the route still builds a
fresh `createInitialAppState` and never reaches `CaseRecordRepository.load`, which stays inside
`if (!validationMode)`; `mountCaseProgressPanel` and `mountCaseRecordPrintView` stay behind
`if (repository)` and no `else` branch was added. Audited for side effects: no `localStorage` or
`sessionStorage` anywhere in `src/`; IndexedDB is reachable only through
`adapters/persistence/IndexedDbRepository`, whose only importers are `caseRecordRepository` and
`CaseProgressPanel` — both unreachable on the validation route; the single `fetch` in `src/` is the
static case-content load; the one i18n `console.warn` is gated on `import.meta.env.DEV` and
tree-shaken from production. `git diff --stat` confirms `src/main.ts` changed by exactly one argument
and that `case.json`, `index.html`, `public/style.css`, `CaseDefinition`, `AppState`,
`CaseRecordProjection`, `CaseRecordSchema`, the export/import/migration paths, and the print view are
untouched.

### Completion Notes List

**This story delivered the instrument. The gate itself remains Blocked, and nothing here changes that.**

- **Task 1 — facilitator materials re-baselined.** Both rubric fields were rewritten for the
  authored-conclusion model. Field A now credits a **Yes** only when the participant, unprompted and in
  their own words, names a specific measurement or apparatus setting **from their own run** as the reason
  that proposal beat the others; the four non-credit responses (restating the card, colleague authority,
  the source reading alone, a general impression) are spelled out with examples, because the old wording
  was satisfiable by reading a proposal card aloud. Field B is defined against the **≥2 significant
  measures** unlock rather than a run count, and names the three qualifying variations (a further run
  after unlock, the second primary control, the optional advanced wavelength comparison
  `[450, 650]` against `fixedMinimumPathNm: 550`). A per-session locale field was added, and the
  aggregate now reports both measures overall **and** split by locale.
- **Task 1 — gate structure.** `young-release-decision-template.md` lost "Manual accessibility
  acceptance" from the blocking rows and gained four: `Stories 2.5 and 2.6 shipped`, `EN + FR content
  completeness`, `Reduced-motion / no-flashing`, and `sample includes ≥1 en and ≥1 fr session`. Recorded
  accessibility findings moved to a clearly separated non-blocking section with a **required** post-MVP
  carry-forward owner. No waiver field, no override path, no partial approval; the decision still
  defaults to **Blocked**.
- **Task 1 — two new templates.** `young-motion-safety-template.md` carries reduced motion and
  no-flashing/photosensitivity as **blocking** checks against the Phaser scenes, so the a11y de-scope
  cannot quietly take the one motion rule the project still enforces.
  `young-bilingual-completeness-template.md` enumerates **13 player-facing surfaces** from AC5 plus two
  locale-formatting checks, one signed row each — the project's most-repeated defect class does not get a
  single "all content translated" line. Its rows 7 and 8 (hint text, rival-lab critique) stay **Blocked**
  rather than "N/A", because those surfaces do not exist until 2.6 and 2.5 ship.
  `young-accessibility-findings-template.md` was reframed as recorded/non-blocking/post-MVP and uses
  **Met / Gap / Not assessed** instead of Pass / Blocked, so a Gap cannot be misread as a release stop. It
  was not deleted, and no a11y spec was deleted.
- **Task 1 — stale evidence reset.** `young-technical-evidence.md`'s 2026-08-05 all-Pass table was reset
  to unrecorded and restamped against baseline `87f0ab5`, with the measured baseline totals and the
  named baseline-failing specs recorded so a pre-existing failure can never be signed as a Pass or
  charged to a candidate change.
- **Task 2 — the one real code defect is fixed.** `ValidationSessionDisclosure.ts` no longer hardcodes
  four English strings. `mountValidationSessionDisclosure(root, locale)` takes `locale` as a **required**
  parameter with **no `DEFAULT_LOCALE` fallback**, so a forgotten call site is a `tsc` error rather than a
  French session silently reading English. Three keys were added to a new `// --- Validation session ---`
  group in **both** `en.ts` and `fr.ts`; the heading and the `aria-label` share
  `validation.session.title`. `src/main.ts` passes the already-resolved `locale`. The disclosure stayed in
  the boot shell (static facilitator chrome, mirrors no Phaser gesture) and the
  `.validation-session-disclosure` / `#validation-session-disclosure` contract is unchanged — FR length is
  verified by measurement at 1280×720, not by a snapshot.
- **Task 4 — e2e re-pointed.** `validation-route.spec.ts` now asserts the retained boot contract
  (`data-testid="enter-laboratory"`, `#boot-status`), the routed canvas
  (`#game-container[data-active-scene]`: `Library` → `Colleagues`), and the absence of both the progress
  region and the printable-record article. The cross-route isolation proof was strengthened: the saved
  record is read **straight out of IndexedDB and JSON-serialised**, so "untouched" is a literal
  byte-for-byte string comparison that survives the retiring panel's deletion, and it is compared once
  rather than retried so an in-flight write cannot be stepped over. Later-case leak assertions kept. A new
  FR case (`test.use({ locale: 'fr-FR' })`) asserts the disclosure against strings imported from
  `locales/fr` and that no English disclosure string survives in a French session.
  `accessibility.spec.ts` kept its validation-disclosure spec with no new a11y assertions — its literals
  were swapped for the `en` imports so it cannot pass against text the app no longer renders, and a
  comment records that its axe result is supporting evidence only.
  `offline-reload.spec.ts:137` kept the cached validation-route startup and gained the retained
  print-view absence assertion, which still means something once the retired panel is gone.
- **Task 5 — the human gates are honestly open.** Every facilitator- and reviewer-owned row is
  **unrecorded and Blocked**. This story could not and did not deliver: the 15–30 moderated sessions
  (including the ≥1 `en` / ≥1 `fr` requirement), either 60% measure, the five educator responses, the
  scholarly source/rights review, the EN + FR completeness review, the motion-safety check, the
  10-minute 1280×720 low-end-laptop 60-FPS loop, or the human cached-offline acceptance. No automated
  test, rendered FPS estimate, or axe run was presented as any of them. **Release remains blocked.**
- **The gate cannot be run yet, by its own terms.** Stories 2.5 (rival-lab critique) and 2.6
  (significant-measure gate + colleague hints) are still `backlog`, and neither exists in `src/` — there is
  no `RivalLabScene`, and `case.json` still carries only `requirements.minimumRuns: 2` with no
  significance rule. Both revised AC2 metrics are undefined without them, so AC6's prerequisite row and
  the validation plan both block scheduling any session until they land.
- **Owners still to be named before a decision can be recorded:** learning-validation lead / session
  owner, educator-review lead, bilingual reviewer, scholarly-and-rights reviewer, QA / release lead,
  release owner, and the post-MVP accessibility carry-forward owner.

### File List

**New**

- `docs/validation/young-bilingual-completeness-template.md`
- `docs/validation/young-motion-safety-template.md`
- `tests/unit/ValidationSessionDisclosure.test.ts`

**Modified**

- `docs/validation/young-observation-rubric.md`
- `docs/validation/young-validation-plan.md`
- `docs/validation/young-validation-aggregate-template.md`
- `docs/validation/young-release-decision-template.md`
- `docs/validation/young-accessibility-findings-template.md`
- `docs/validation/young-technical-evidence.md`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/ui/ValidationSessionDisclosure.ts`
- `src/main.ts`
- `tests/e2e/validation-route.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/offline-reload.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-4-young-learning-and-educator-validation-gate.md`

**Deleted** — none.

## Change Log

- 2026-08-06: Implemented. Facilitator materials re-baselined for the authored-conclusion and
  significant-measure model (both rubric fields rewritten, per-session locale added, aggregate split by
  locale); release-decision gate table restructured — manual accessibility acceptance removed as
  blocking, and `Stories 2.5/2.6 shipped`, `EN + FR completeness`, `reduced-motion / no-flashing`, and
  `≥1 en + ≥1 fr session` added as blocking, with recorded a11y findings moved to a separated
  non-blocking section under a named post-MVP owner. Added `young-motion-safety-template.md` (blocking)
  and `young-bilingual-completeness-template.md` (13 enumerated surfaces). Reset the stale 2026-08-05
  all-Pass technical-evidence table to unrecorded and restamped it against baseline `87f0ab5` with the
  named baseline-failing specs. Fixed the live NFR19 defect: the validation disclosure is now localized
  EN + FR through a required `locale` parameter with no default. Re-pointed the validation e2e at the
  Phaser-era contract, with the cross-route isolation proof now read byte-for-byte from IndexedDB, plus a
  new FR disclosure case. All facilitator- and reviewer-owned gates remain unrecorded and **Blocked**;
  the gate cannot be run until Stories 2.5 and 2.6 ship.
- 2026-08-06: Re-baselined for the Phaser guided-adventure pivot. AC2 metric revised to the authored-conclusion model; AC5 added for EN+FR completeness; manual accessibility acceptance removed as a blocking gate (ADR-008) with reduced-motion/no-flashing retained as blocking; Stories 2.5/2.6 recorded as a prerequisite gate; the English-only validation disclosure and the stale technical-evidence table identified as the story's live defects. Supersedes the 2026-08-05 pre-pivot version, whose completion claims no longer hold.

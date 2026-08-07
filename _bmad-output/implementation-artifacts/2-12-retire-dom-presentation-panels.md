---
baseline_commit: 7feee79a7c5f6d651870fbc9e61baf84ba2ee535
---

# Story 2.12: Retire the DOM presentation panels

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the retired DOM panels deleted,
so that one surface answers each player action and the pivot is actually complete.

_Sequenced strictly last in Epic 2: it requires Stories 2.7 – 2.11 to be done. All five are._

## Acceptance Criteria

**AC1 — The deletion set, and nothing reachable importing it**

**Given** Stories 2.7 – 2.11 are done and every gating intent is canvas-dispatchable,
**When** the retirement lands,
**Then** `src/ui/` retains exactly three modules — `print/CaseRecordPrintView.ts` (ADR-007), `BootShell.ts`, and `ValidationSessionDisclosure.ts`,
**And** the **eleven** other panel modules, their eleven `index.html` roots, and their now-dead rules in `public/style.css` are deleted,
**And** `npm run typecheck` proves no reachable code imports a deleted module,
**And** no i18n key, error code, or CSS class is left shipped-and-dead by the deletion.

> The epic says "thirteen other panel modules". **It is eleven.** `find src/ui -name '*.ts'` returns 14 files; three are retained. The count of thirteen came from the 2.4 review's list of thirteen *`index.html` roots* required by the boot guard, which counted `#print-record` and `#validation-session-disclosure` — both retained. Build against the enumerated list in §The deletion set, not against either number.

**AC2 — The boot guard requires only what still exists, and fails loudly**

**Given** the deletion,
**When** `src/main.ts` boots,
**Then** its guard requires only `#boot-shell`, `#validation-session-disclosure`, `#print-record`, and `#game-container`,
**And** a missing required root **fails loudly** — a visible boot message and a dev-log line — rather than returning silently and leaving the page on static `index.html` markup.

**AC3 — Autosave, export, import, and print survive their panel**

**Given** `CaseProgressPanel` is the sole owner of the autosave subscription, the manual save, export, import, and the print-dialog trigger,
**When** it is deleted,
**Then** the autosave subscription is relocated so a normal-route session still persists to IndexedDB on every state change, and still reports a save failure without silent loss (NFR12),
**And** export, import, and print remain reachable by the player through affordances that are not a retired panel,
**And** the validation route still constructs no repository, writes nothing, and mounts no progress or print surface,
**And** the printable record (ADR-007) still renders and still dispatches nothing.

**AC4 — The pre-pivot free-text paths are removed, not ported**

**Given** the 1-of-4 choices supersede them,
**When** the panels are deleted,
**Then** `prediction.recorded`, `theory.conclusionSet`, and `theory.limitationSet` are **removed** from `AppAction`, the reducer, and the tests — not given a canvas dispatcher — since leaving both paths live is the "free text must clear the proposal ID" hazard,
**And** the invariant those paths protected ("choosing a proposal writes the claim **and** its limitation together; no blend, no partial write") is re-asserted at the store level, because its only current proof is a DOM probe in `scene-router.spec.ts`,
**And** `CaseDefinition.version` is bumped and the record-compatibility allowlist is extended only across versions whose canonical strings are verified byte-identical.

**AC5 — The e2e suite is rewritten against the canvas, not trimmed to green**

**Given** the panels are gone,
**When** the suite runs,
**Then** every spec driving a deleted panel is rewritten against the canvas — including the six specs clicking the nonexistent `Record prepared observation` button and `young-experiment.spec.ts`'s run-experiment disabled-state mismatch, both already failing on baseline,
**And** the validation-isolation spec keeps a **real** precondition: a non-panel progress-seeding path replaces its reliance on `CaseProgressPanel`'s "Save progress" button,
**And** its isolation assertions do not become trivially true on every route once the panel is absent,
**And** its IndexedDB probe reads the database name, version, and store name from constants exported by `IndexedDbRepository`, rather than restating them,
**And** no assertion is deleted to make a suite green — each is re-pointed at the surface that now owns it, or replaced by one that can fail.

**AC6 — Exactly one surface answers the significant-measure gate**

**Given** the retired theory-board panel is gone,
**When** the significant-measure gate refuses,
**Then** exactly one surface answers, in the active locale, through `error.significant-measures-required` or its authored colleague hint,
**And** no surface renders a reducer's dev-facing English message to the player.

**AC7 — The sub-768px suppression is re-decided**

**Given** narrow viewports and no DOM fallback,
**When** the advance affordance is suppressed below 768px,
**Then** the suppression is re-decided in **one** direction across every host — either the affordance stays available everywhere, or the narrow viewport is explicitly declared unsupported with a **visible, localized** message,
**And** the decision covers the bench's reference shelf as well as its advance control, since one flag currently gates both,
**And** the four `deferred-work.md` entries about this rule are closed by the decision.

**AC8 — The two orphan intents get a surface or a recorded retirement**

**Given** `apparatus.reset` and `consultation.requested` are dispatchable only from panels being deleted,
**When** the retirement lands,
**Then** each either gains a canvas affordance or is removed from `AppAction` with its rules, state field, and authored content handled in the same change,
**And** neither is left as an action with no dispatcher,
**And** the choice is recorded against the acceptance criterion it protects — Story 2.2's "reset is immediate and does not erase saved observations" for the first, FR22's authored consultation layer for the second.

**AC9 — Verification, and the two release gates this story closes**

**Given** the retirement,
**When** verification runs,
**Then** `npm run typecheck`, `npm test`, and `npm run test:e2e` pass with zero carried failures on chromium,
**And** the six known firefox/webkit baseline failures are either fixed or explicitly re-recorded as owned with a named owner and a reachable trigger, since Story 7.3 cannot mean anything until they are,
**And** offline reload still restores locally saved progress with no network,
**And** NFR1's 10-minute re-profile — owned by Alexis, triggered "before Story 2.12 is marked done" — is run and recorded before this story is marked done.

**AC10 — Both locales**

**Given** any player-facing string this story adds (the loud boot failure, a narrow-viewport message, a reset or consult affordance, any relocated status copy),
**When** the suite runs,
**Then** each is asserted present in English **and** French,
**And** each fixed-height control label fits on one line in French at its authored size, in the whole-string test — not the per-token sweep.

## Tasks / Subtasks

- [x] **Task 0 — Re-measure the baseline before touching anything** (AC9)
  - [x] Run `npm run typecheck`, `npm test`, `npm run test:e2e` at HEAD and record the numbers. Expected: typecheck clean; **1126 tests / 67 files**; e2e **53 passed / 7 failed** on chromium at `workers: 5`, ~1.7–1.8 min on an **idle** machine.
  - [x] The seven e2e failures are the carried retired-DOM names: `accessibility`, `curated-record`, `inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment`. **This story owns all seven.** Anything else that fails is yours.
  - [x] Do not run e2e under load. Three review runs of 2.11 showed 8–10 failures purely from CPU contention; the canvas walks are frame-timed.

- [x] **Task 1 — Take the two orphan-intent decisions and build them** (AC8)
  - [x] `apparatus.reset`: add a reset affordance to the bench (see D3). Geometry in `apparatusGeometry.ts`, driven by a real geometry test, label in the whole-string French test.
  - [x] `consultation.requested`: add a consult control to the theory board's case-file overlay (see D4), rendering `selectConsultation`'s three-part authored output localized by rule id.
  - [x] Both dispatch through `PhaserStoreAdapter`. Neither discards a `Result`.

- [x] **Task 2 — Relocate persistence off the panel** (AC3)
  - [x] Move the autosave subscription (`store.subscribe` → `selectPortableCaseRecord` → `repository.save`, serialized through the `pendingWrite` chain) out of `CaseProgressPanel` into a module the boot wires directly. Keep the serialization — concurrent writes to the same key are what it prevents.
  - [x] Give save-failure reporting a surface. It currently sets panel status text; it must not become silent (NFR12).
  - [x] Export: reachable from the canvas via `exportCaseRecord`. Print: reachable via `openPrintDialog()` — the printable record itself stays mounted and unchanged.
  - [x] Import: needs a file picker. Follow `exportCaseRecord`'s own pattern — it creates a transient hidden `<a>` in `document.body`, clicks it, and removes it. A transient hidden `<input type="file">` created and disposed inside an adapter is the same mechanism, not a panel. Keep the `acquireExclusiveOperation` lock and the neutral failure copy.
  - [x] Verify the `if (repository)` validation-route gate still governs all of it.

- [x] **Task 3 — Remove the three free-text actions** (AC4)
  - [x] Delete `PredictionRecordedAction`, `TheoryConclusionSetAction`, `TheoryLimitationSetAction` from `AppAction.ts` and the `AppAction` union; delete `reducePredictionRecord`, `withHandWrittenTheory`, and their three `case` arms in `AppState.ts`.
  - [x] Delete the now-dead `error.invalid-prediction` from both locales.
  - [x] Re-assert the proposal-write invariant in `tests/integration/ProposalSelection.test.ts` at the store level, replacing what `scene-router.spec.ts`'s DOM probe proved.
  - [x] Update the ~13 test files that use these actions as a state-seeding shortcut (see §Test fallout). Seed through `prediction.proposalChosen` / `theory.conclusionProposalChosen` instead.

- [x] **Task 4 — Bump the case definition version** (AC4)
  - [x] `public/cases/young-interference/case.json` 1.14.0 → 1.15.0. **Edit only under `public/cases/`** — `dist/` is build output, `.claude/worktrees/**` is a stale copy.
  - [x] Extend the allowlist in `CaseRecordSchema.ts` with a clause saying **why** the added field is not progress-bearing. The allowlist already carries three dead clauses; keep it honest rather than widening it on assumption.

- [x] **Task 5 — Delete the panels, the roots, and the styles** (AC1)
  - [x] Delete the eleven modules in §The deletion set. Remove their imports and mount calls from `src/main.ts`.
  - [x] Delete the eleven `<div>` roots from `index.html`. Keep `#boot-shell`, `#validation-session-disclosure`, `#print-record`, `#game-container`.
  - [x] Delete the panel rules from `public/style.css`. Keep the boot-shell block, `#boot-status`, `#app`, and the whole `@media print` block.
  - [x] `grep -rn "src/ui/" src tests` must return only the three retained modules and the unrelated `adapters/phaser/ui/` matches.

- [x] **Task 6 — Rewrite the boot guard** (AC2)
  - [x] Replace the 15-clause `if (!… ) return;` with a guard over the four surviving roots that renders a visible message and writes one dev-gated log line on failure.
  - [x] Note the ordering constraint already encoded in `main.ts`: the locale resolves synchronously before any `await`, and the validation disclosure mounts before `loadCaseDefinition` can return early. Preserve both.

- [x] **Task 7 — Re-point the e2e suite** (AC5)
  - [x] Work through §Spec fallout file by file. Every file has a stated verdict; none is "delete the spec".
  - [x] Export `PROGRESS_DATABASE_NAME`, `PROGRESS_DATABASE_VERSION`, `PROGRESS_STORE_NAME` from `IndexedDbRepository.ts` and read them in `validation-route.spec.ts`'s probe.
  - [x] Give `validation-route.spec.ts` a non-panel seeding path and make its isolation assertions fail-able — an assertion that is true on every route proves nothing.
  - [x] Fix `canvasHelpers.ts` first: `recordedObservations` (`getByRole('region', { name: 'Measurement notebook' })`), the `getByLabel('Screen distance (m)')` wait, and the `getByLabel('Comparison note')` assertion all read deleted panels, and three specs import them.

- [x] **Task 8 — Close the gate-answer and viewport items** (AC6, AC7)
  - [x] Confirm by grep that `advanceView.ts` / the colleague hint is the only remaining answer to `significant-measures-required`.
  - [x] Decide the sub-768px rule once and apply it to `ApparatusRenderer.updatePhoneReadOnlyMode` (which gates step controls, advance control **and** the reference shelf from one flag), `LibraryRenderer.applyInputState` (no check at all today), and the board/debrief controls (no check today). Record the decision and close the four tracked entries.

- [x] **Task 9 — Verification, gates, and bookkeeping** (AC9, AC10)
  - [x] Full suite green on chromium, twice, on an idle machine.
  - [x] Run `npm run test:e2e:cross-browser`. Fix the six firefox/webkit failures or re-record them with an owner and a **non-circular** trigger.
  - [x] Run `npm run test:e2e:offline` and confirm offline restore still works end to end.
  - [x] Run and record NFR1's 10-minute profile (owned by Alexis) in `docs/validation/`.
  - [x] Mutation-prove each new guard: break it, confirm a test fails, restore it, record the row.
  - [x] Update `deferred-work.md`: close what this story closes, carry what it does not.
  - [x] Update `project-context.md` — the `src/ui/*` rule now describes three retained modules, not a retirement in progress.

## Dev Notes

### Scope boundary — read this first

**In scope:** deleting eleven `src/ui` modules, their `index.html` roots and their CSS; rewriting `src/main.ts`'s boot guard and mount block; relocating autosave/export/import/print off `CaseProgressPanel`; removing three actions from `AppAction`/`AppState` and their i18n keys; a bench reset affordance and a case-file consult affordance; the `CaseDefinition` version bump and allowlist clause; the sub-768px decision across every host; roughly fourteen e2e specs and thirteen unit/integration test files; both locales; the cross-browser and NFR1 gates.

**Explicitly not in scope:**

- **Any new scene, renderer, or overlay.** Every affordance this story adds goes on a surface that already exists — the bench (2.10) and the case-file overlay (2.11).
- **Re-architecting persistence.** The autosave *moves*; it does not change shape. Same selector, same repository, same serialization chain.
- **`src/domain/**`, `src/adapters/phaser/SceneRouter.ts`, `src/game/*`.** Untouched.
- **`AppState.ts` beyond the three removed reducer arms.** No new store field, no new persisted value, no new phase gate.
- **Widening the compatibility allowlist on assumption.** One clause, one reason, verified byte-identical.
- **Raising `workers` in `playwright.config.ts`.** That was measured in 2.10 and is not this story's to reopen.
- **The `sceneSlice.ts` `height: 18` harness gap.** It is the top deferred item and the highest-value one, but it is a change to a harness three suites share and it belongs to its own pass. Do not fold it in here — this story is already the largest in the epic.
- **The ineligible-artifact context dead end** (Story 3.1), **`scenarioScript.scenes[].cast?`** (Story 3.4), **`selectAdvancedWavelengthUnlocked`'s duplicated gate** (whichever story next owns `AppState.ts` for a real change).

### The deletion set — enumerated, because the epic's count is wrong

**Delete (11 modules):**

| Module | Intents it is the sole DOM dispatcher of | Canvas owner today |
| --- | --- | --- |
| `src/ui/apparatus/ApparatusControls.ts` | `apparatus.controlSet`, `apparatus.reset` | bench (2.10); **`apparatus.reset` has none — Task 1** |
| `src/ui/context/CaseContextAndPrediction.ts` | `prediction.recorded` | **removed, not ported** (Task 3) |
| `src/ui/debrief/HistoricalDebriefPanel.ts` | — (projection only) | `DebriefScene` (2.11) |
| `src/ui/notebook/NotebookPanel.ts` | `comparison.*` | bench notebook (2.10) |
| `src/ui/persistence/CaseProgressPanel.ts` | **autosave, save, export, import, print** | **none — Task 2** |
| `src/ui/recognition/InquiryRecognitionPanel.ts` | — (projection only) | debrief (2.11) |
| `src/ui/review/ConclusionReviewPanel.ts` | `peerReview.requested`, `revision.saved` | case-file overlay (2.11) |
| `src/ui/review/ConsultationPanel.ts` | `consultation.requested` | **none — Task 1** |
| `src/ui/review/DecisionHistoryPanel.ts` | — (projection only) | debrief (2.11) |
| `src/ui/sources/CuratedRecord.ts` | `source.inspected` | reading room (2.8) |
| `src/ui/theory/TheoryBoard.ts` | `theory.support*`, `theory.conclusionSet`, `theory.limitationSet`, `theory.reviewRequested` | case-file overlay (2.11); free-text **removed** |

**Retain (3):** `src/ui/print/CaseRecordPrintView.ts` (ADR-007, dispatches nothing), `src/ui/BootShell.ts`, `src/ui/ValidationSessionDisclosure.ts`.

**Delete from `index.html` (11 roots):** `#curated-record`, `#case-context-prediction`, `#apparatus-controls`, `#measurement-notebook`, `#theory-board`, `#consultation-panel`, `#conclusion-review`, `#decision-history`, `#inquiry-recognition`, `#historical-debrief`, `#case-progress`.
**Keep (4):** `#boot-shell`, `#validation-session-disclosure`, `#print-record`, `#game-container`.

### Decisions taken for you (with the reasoning, so you do not relitigate them)

**D1 — `CaseProgressPanel` is not a projection panel, and deleting it naively breaks two release gates.**
This is the single hazard this story is most likely to ship. Read `src/ui/persistence/CaseProgressPanel.ts:108-117`: the panel's `store.subscribe` **is the autosave loop**. It is the only call site of `repository.save` outside the panel's own import handler, the only caller of `exportCaseRecord`, `importCaseRecord`, and `openPrintDialog` in the whole of `src/`. Delete it as written and:

- nothing persists, so **offline reload** — an explicit platform release gate and this story's own AC — restores nothing;
- **FR11** (export or print of a case record) has no trigger, even though ADR-007's print *view* is dutifully retained and still mounted;
- **NFR12** (progress survives failed imports and save failures without silent loss) has no failure surface;
- `offline-reload.spec.ts` and `progress-portability.spec.ts` cannot be re-pointed at anything, because the behaviour they test would not exist.

The epic's AC1 retains the print *view* and says nothing about its opener. That is the gap. Task 2 closes it. The autosave move is behaviour-preserving and small; the export/print triggers are canvas controls; import uses the transient-hidden-element pattern `exportCaseRecord` already establishes.

**D2 — Export, print, and import triggers do not violate ADR-001 or ADR-007.**
ADR-007 names the print/export *view* as the sole non-Phaser **surface** and says it dispatches nothing — it does not require the trigger to be non-Phaser. A canvas control calling an adapter is the same shape as the bench calling `PhaserStoreAdapter`. The transient `<input type="file">` is an adapter mechanism with no persistent DOM presence, exactly as `exportCaseRecord`'s transient `<a>` already is; it is not a panel and adds no semantic HTML mirror of a Phaser gesture.

**D3 — `apparatus.reset` gets a bench control; it is not retired.**
`deferred-work.md` offered three options and asked for a decision before this story started; it was never taken, so it is taken here. Retiring the action looks attractive — `reduceApparatusReset` only sets `activeControlValues` to `defaultValue` and the wavelength to 550/`minimum`, all of which the player can already reach by hand on the bench. But **Story 2.2 is `done` with an acceptance criterion that reads "reset is immediate and does not erase saved observations"**, and Story 1.7's review already recorded that FR23's reset access is expected and missing. Removing the action would retroactively un-satisfy a shipped AC. Build the control. Keep it cheap: one affordance in the existing instrument row, geometry in `apparatusGeometry.ts`, a real geometry test, and the label in the whole-string French test. Note 2.10's finding that re-choosing 550nm discarded consultation/peerReview/rivalLabCritique — reset must not resurrect that class; it touches control values and wavelength only, as the reducer already does.

**D4 — `consultation.requested` gets a control on the case-file overlay; it is not retired either.**
Same story: flagged three times, decided never. Retiring it is the larger change, not the smaller one — it would strand `consultationRules` in `case.json`, `selectConsultation` in the domain, the `consultation` state field that four reducers clear, and its persisted projection. And the authored content is **FR22's** in-play observation prompt, plain-language guidance, and optional technical/source-detail layer; `theory-board.spec.ts:8-14` shows all three rendered, and no canvas surface carries them. The case-file overlay already exists, already hosts the peer-review pane, and already has the shape for a three-part authored block. Add the control there. Localize by rule id — `selectConsultation` returns authored `LocalizedText`; never render a canonical English field to the player (D3 of Story 2.11, and the project's most-repeated defect).

**D5 — Removing the three free-text actions removes an invariant that must be re-homed, not just deleted.**
`withHandWrittenTheory` and `reducePredictionRecord` both carry the "attribution survives exactly as long as it stays true" rule — editing a proposal's words drops the proposal ID, re-recording them unchanged keeps it. That rule disappears with the actions, correctly: with no free-text path there is no way to desynchronise ID from text. But `tests/e2e/scene-router.spec.ts:112-126` currently proves a *different* and still-live property through those DOM fields — that choosing a proposal writes the claim **and** its limitation together, with no blend and no partial write. That property survives the deletion and its only proof does not. Re-assert it in `tests/integration/ProposalSelection.test.ts`, which already owns this area.

**D6 — The version bump is required, and the allowlist clause must state its own reason.**
The epic makes the bump unconditional. Bump `1.14.0 → 1.15.0` and add `definition.version === '1.15.0' && ['1.2.0' … '1.14.0']`. The clause's comment must say why the change is not progress-bearing — the allowlist already carries three clauses that can never fire, and the 2.8 review asked for it to be kept honest rather than widened on assumption. If you end up changing no authored field at all, bump anyway (the epic requires it) and say exactly that in the comment: the contract changed on the code side, not the content side.

**D7 — The sub-768px decision: pick one direction and apply it everywhere.**
Four `deferred-work.md` entries (2.6, 2.7, 2.8, and 2.11's scope boundary) all defer this to you, and each preserved today's inconsistency rather than extend it. Today: the bench suppresses step controls, the advance control **and** the reference shelf from one flag; the library, the boards and the debrief suppress nothing. The recommendation is **keep the affordances available and drop the suppression**, because (a) the flag's stated purpose was preventing accidental *mutation* on a phone and it now also blocks *reading*, which mutates nothing and whose own docstring says so; (b) NFR4 makes phones reading-only, and blocking reading inverts that; (c) with no DOM fallback, suppression means a player on a narrow viewport reaches a phase they cannot leave, which is the exact failure ADR-011 exists to prevent. If you take the other direction instead, the narrow viewport must be **declared unsupported with a visible, localized message** — not silently degraded. Either way the rule ends up stated once and applied in every host.

### Read before editing — current behaviour that must survive

| Path | What it does today | Your change boundary |
| --- | --- | --- |
| `src/main.ts` (145 lines) | 15 `querySelector` lookups, a 15-clause guard that **returns silently**, locale resolved synchronously before any `await`, validation disclosure mounted before `loadCaseDefinition` can fail out, 13 mount calls, `StartGame` + router on Phaser's `ready`, router disposed on `destroy`. | **Rewritten.** Preserve the locale-before-`await` ordering, the early disclosure mount, the `if (repository)` validation gate, and the `ready`/`destroy` router lifecycle verbatim. Only the guard and the mount block change. |
| `src/ui/persistence/CaseProgressPanel.ts:108-117` | The autosave: `store.subscribe` → `persist()` → `selectPortableCaseRecord` → `repository.save`, serialized through a `pendingWrite` promise chain; reports failure into panel status. | **Relocated, not rewritten.** Keep the chain — it is what stops two writes racing on one key. |
| `src/adapters/export/exportCaseRecord.ts` | Validates through `CaseRecordSchema`, builds a Blob, creates a **transient hidden `<a>`** in `document.body`, clicks, removes, revokes the object URL. | **Untouched.** It is also the precedent for the import picker. |
| `src/adapters/export/importCaseRecord.ts` | Takes a `Pick<File,'text'>`, parses and migrates. Never exposes raw contents. | **Untouched.** It needs a file, from somewhere. |
| `src/adapters/print/openPrintDialog.ts` | `window.print()` behind a `Result`. | **Untouched.** It needs a caller. |
| `src/adapters/persistence/IndexedDbRepository.ts:13-19` | `openDB('quantique-progress', 1, …)` with store `'case-records'` — three literals, restated by `validation-route.spec.ts`. | **Export the three as constants** and read them in both places (AC5). Do not change their values. |
| `src/core/store/AppAction.ts` | 27-member union. `PredictionRecordedAction`, `TheoryConclusionSetAction`, `TheoryLimitationSetAction` are the three going. | **Three members removed.** Nothing else. |
| `src/core/store/AppState.ts:456` `reducePredictionRecord`, `:527` `withHandWrittenTheory`, `:874-889` the three `case` arms | The free-text paths and their proposal-ID-clearing rule. | **Deleted.** Do not touch any other reducer. `state.prediction` and `state.theory` stay — `prediction.proposalChosen` and `theory.conclusionProposalChosen` write them. |
| `src/schemas/CaseRecordSchema.ts:192-264` | The compatibility allowlist, currently topping out at `1.14.0`. Comments explain each clause. | **One clause added,** with its reason. |
| `src/adapters/phaser/renderers/ApparatusRenderer.ts:1181-1182` | `updatePhoneReadOnlyMode` — one `enabled` flag from `inputEnabled && !matchMedia('(max-width: 767px)').matches`, applied to step controls, advance control **and** the reference hit areas. | **Re-decided (D7).** Whatever you decide, it applies here and in `LibraryRenderer.applyInputState`, the boards, and `DebriefScene`. |
| `src/adapters/phaser/renderers/advanceView.ts` | `GATE_REFUSAL_CODES` routes `significant-measures-required` and `missing-contextual-sources` to the `gate` register, answered by the authored colleague hint. | **Untouched.** Deleting `TheoryBoard.ts` is what makes it the sole answer (AC6). |
| `public/style.css` | Boot-shell block, `#boot-status`, then ~200 lines of panel rules, then `@media print` at `:255`. | **Panel rules deleted.** Keep the boot-shell block and the entire print block — the print view still renders. |
| `index.html` | 15 roots inside `#boot-shell`, plus `#game-container` (still `aria-hidden="true"` — a tracked item, not yours). | **Eleven roots removed.** The English placeholder markup is deliberate (ADR-010); `createBootShell` rehydrates it. |
| `tests/e2e/canvasHelpers.ts:249, :402` | `recordedObservations` reads the `Measurement notebook` region; a wait reads `getByLabel('Screen distance (m)')`; `:209` in `young-canvas-experiment` reads `Comparison note`. | **Re-pointed first.** Three specs import this file; fixing it before the specs saves a round of confusing failures. |

### Test fallout — thirteen files use the removed actions as a seeding shortcut

`prediction.recorded`, `theory.conclusionSet`, and `theory.limitationSet` are dispatched as a convenient way to reach a later state in:

`tests/unit/{ContextPrediction,TheoryStore,ReviewRules,EvidenceStore,CompletionReplay,YoungExperimentStore}.test.ts`
`tests/integration/{TheoryBoard,ReviewFlow,ProposalSelection,MeasurementNotebook,RecognitionStore,SceneRouter,DualSurfaceControl}.test.ts`

Seed through the proposal actions instead. Two cases need judgement rather than substitution:

- **`tests/unit/ContextPrediction.test.ts`** — its subject *is* `reducePredictionRecord` (`invalid-prediction`, trimming, the readiness gate). The readiness-gate assertions belong to `prediction.proposalChosen`, which applies the same gate; the trimming and `invalid-prediction` assertions go with the reducer.
- **`tests/integration/ProposalSelection.test.ts:179-202`** — this is the "free text must clear the proposal ID" suite. Its subject disappears with the actions. Replace it with D5's re-homed invariant rather than deleting the block.

Two files import a module being deleted:

- **`tests/unit/YoungExperimentStore.test.ts:7`** and **`tests/integration/DualSurfaceControl.test.ts:9`** both import `dispatchControlValueFromDom` from `ApparatusControls`. `DualSurfaceControl.test.ts` asserts the DOM-parity contract ADR-001 v1.1 retired on 2026-08-05; its property is now "pointer and keyboard produce identical run records", which lives on the bench (ADR-012) and is already covered there. Retire it deliberately and say so. `YoungExperimentStore.test.ts` needs only its seeding path re-pointed.

`tests/unit/{BootShell,ValidationSessionDisclosure}.test.ts` and `tests/unit/{AdvanceControlGeometry,DialogueBox}.test.ts` are unaffected — the latter two match `ui/` only through `adapters/phaser/ui/`.

### Spec fallout — every e2e file, with a verdict

**The seven carried baseline failures (this story owns all of them):**

| Spec | Why it fails today | Verdict |
| --- | --- | --- |
| `accessibility.spec.ts` | axe-scans `.curated-record`, `.case-context-prediction`, and clicks `Record prepared observation`. | **Reduce to the retained surfaces** — boot shell and printable record. Do not delete it: a11y specs are de-scoped, not wrong, and the reduced-motion check is a standing requirement. |
| `curated-record.spec.ts` (39 locators) | The whole file drives the deleted panel. | **Retire the file**; its live property (source inspection reaching context readiness) is already covered canvas-side by `library-reading.spec.ts`. Confirm that before removing, and say so in the commit. |
| `inquiry-recognition.spec.ts` | Drives the recognition panel and `Record prepared observation`. | **Re-point** at the debrief's recognition surface (2.11). |
| `offline-reload.spec.ts` (62 locators) | `Record prepared observation`, `Save progress`, and the progress region. | **Re-point** at Task 2's relocated autosave. This is the offline release gate — it must keep proving restore-after-reload, not merely pass. |
| `progress-portability.spec.ts` | Free-text prediction, `Record prepared observation`, and the progress panel's export/import. | **Re-point** at Task 2's export/import affordances. Keep the download-and-reimport round trip and the invalid-import recovery (NFR12). |
| `theory-board.spec.ts` (29 locators) | The whole file drives the deleted consultation and theory-board panels. | **Rewrite against the case-file overlay** (2.11) and Task 1's consult control. Its readiness-guidance and consultation assertions have real canvas homes now. |
| `young-experiment.spec.ts` (23 locators) | DOM apparatus inputs; `:18-19` asserts `aria-disabled='true'` then clicks a hard-`disabled` button, which Playwright cannot do. | **Retire the file** in favour of `young-canvas-experiment.spec.ts`, which covers the same loop on the bench. This closes the tracked disabled-state mismatch by removing the contradiction rather than papering over it. |

**Passing today, broken by the deletion:**

| Spec | Dependency | Verdict |
| --- | --- | --- |
| `canvasHelpers.ts` | `recordedObservations` → notebook region; `getByLabel('Screen distance (m)')`. | **Fix first.** Re-point at `data-active-scene` and the bench's own observable state; three specs depend on it. |
| `young-canvas-experiment.spec.ts` | Three DOM observations at `:135`, `:209`, `:231`. | **Replace the observations, do not merely drop them** (2.10's Dev Notes say so explicitly). The scene transitions survive as proof; the observation counts do not. |
| `canvas-transitions.spec.ts` | One DOM read via `recordedObservations`. | Follows the helper fix. **Update its header table** — the two-intent row is already empty; the two remaining DOM-only intents named in its prose are resolved by Task 1. |
| `validation-route.spec.ts` | `seedSavedProgressOnNormalRoute` uses `Save progress`; isolation asserts `PROGRESS_REGION` count 0; IndexedDB probe restates three constants. | **AC5's centrepiece.** New seeding path, fail-able isolation assertions, exported constants. Note `expect(entryButton).toHaveText(en['boot.enter'])` passes even when JS never hydrates, because the label is static in `index.html` — fix that too while you are here. |
| `scene-router.spec.ts` (43 locators) | Free-text prediction, four support checkboxes, and the typed conclusion/limitation probe. | **Rewrite canvas-only.** Move the proposal-write invariant to the store (D5). |
| `measurement-notebook.spec.ts` | DOM notebook and `Run experiment`. | **Retire** — the bench notebook (2.10) covers it; confirm coverage first. |
| `context-prediction.spec.ts` | The deleted context panel; also drives the removed free-text path. | **Retire** — `library-reading.spec.ts` + the colleague board cover the reading gate and the prediction choice. |
| `accessible-control.spec.ts` | `getByLabel('Slit spacing (mm)')`; asserts the DOM-parity contract ADR-001 v1.1 retired. Its click target was already re-pointed in 2.10. | **Retire or rewrite.** 2.10's Dev Notes name this story as the owner. Its live half — a canvas gesture producing the authored stepped value — belongs in `young-canvas-experiment.spec.ts`. Also restates the `1024`/`768` pair; read `designSurface.ts` if you keep it. |
| `rival-lab.spec.ts` | `Run experiment` at `:84`, `:94`. | **Re-point** at the bench run control. |
| `french-typography.spec.ts` | Sweeps some retired-panel strings. | **Prune the dead entries and add** every label Task 1 and the loud-boot message introduce — in the **whole-string** test, not the per-token sweep. |

**Unaffected:** `boot-shell`, `library-reading`, `debrief-replay`, `dialogue-advance`.

### Layout, i18n, and engine constraints that apply to the new affordances

- The canvas is a fixed **1024×768 `Scale.FIT`** surface that does not scroll. A surface that outgrows its band is a defect, not a responsive state. **Measure against a neighbour, never against a constant** — seven consecutive reviews found that same defect, and 2.11's review found it sixteen times in one story.
- **`tests/unit/sceneSlice.ts` reports a constant `height: 18` for every text object.** Until that harness gap is closed (deferred, not yours), *every* "the text fits" claim in a Phaser renderer is arithmetic, not evidence. **Screenshot the new affordances at 1280×720 in both locales** before claiming they render — this is a standing project lesson, and it is how 2.11's two real layout defects were caught.
- French runs 15–25% longer than English. A fixed-height control label must fit **on one line in French** at its authored size.
- **Hit areas do not resize themselves.** `setInteractive` a second time only re-enables an existing hit area. Use `resizeHitArea` / `Zone.setSize(w,h,true)`; `Shape.setSize` throws, and a throw inside `render()` runs inside `dispatch() → notify()` — it advances the phase and then strands the router with no visible error.
- **Never author player-facing copy in `create()`.** Create empty, populate in `render(state)` through `createTranslator(locale)`.
- **Discard no `Result`.** Every dispatch either surfaces its refusal or is guarded so the refusal is unreachable. Treating "dispatched" as "committed" desynced the knob for a whole session in 2.10.
- **A refused action always says why, and the message survives until a real state change replaces it.** Gate refusals the player can act on go to the authored colleague hint; everything else to the localized error. Never a raw error, never silence.
- Do not import Phaser at module scope in anything a Vitest or Playwright spec imports. `apparatusGeometry.ts` and the other geometry modules exist for this; nothing enforces it yet.
- **`tsconfig.json` includes only `src`, so `npm run typecheck` does not type-check `tests/`.** A spec error passes typecheck and surfaces only when Playwright runs it. Budget for that.

### Previous story intelligence — the failure modes this epic keeps producing

- **A green suite that cannot see the thing it claims.** 2.10's two load-bearing defects (`const dark = false` erasing an entire painted state; a doubled `step()` erasing one-step-per-press) each left **982/982 green**, and were found by mutation, not by reading. 2.11 shipped sixteen cropped-text defects under **1125 green**. Break each new guard, confirm the failure, restore it, record the row.
- **Do not add an observability hook to the product to make a test pass.** 2.8's two library specs passed with their feature deleted; the fix used only `data-active-scene`, because an open overlay suppresses the way out — so "opened" and "did not open" produce different routing.
- **Drive real geometry in tests.** 2.9 shipped a conclusion board staging zero figures at every panel height under a green suite, because every staging test fabricated its own band. `ColleagueGeometry.test.ts` driving the real functions is the fix and the pattern.
- **Localize as you build.** The one real defect in 2.4 was an English-only surface shipped months after the i18n foundation. Two surfaces render canonical English to the player from retired panels **right now** — do not carry that across when you re-home them.
- **A per-token typography sweep is not a wrap check.** Whole-string test, both locales, or the check is decorative.
- **The relabel lockout will bite a rewritten walk.** `ADVANCE_RELABEL_LOCKOUT_MS` is 400ms; two fast clicks land inside it and the second is correctly ignored. `clickUntilScene` is bounded and is the answer; a fixed sleep is not.
- **A geometry constant needs a rationale that survives inspection.** `ADVANCE_CONTROL_Y` was 130 on grounds that were wrong in normal play; `GATE_BAND_HEIGHT` was 108 against its own 111px worst case. Let a test compute the worst case rather than a comment asserting it.

### Git intelligence

`7feee79 Review 2.11`, `73febc7 Dev 2.11`, `ba0f3f8 Story 2.11`, `3bd19b7 Review 2.10` establish the rhythm: story → dev → review, one commit each, review findings folded back into the story file, unowned items pushed to `deferred-work.md`.

Read **`73febc7 Dev 2.11`** first — it is the closest diff in shape to Task 1 (two affordances added to existing surfaces, dispatching previously DOM-only intents, with geometry in Phaser-free modules and specs re-pointed rather than deleted). Read **`7feee79 Review 2.11`** next: its 29 patches are the defect catalogue this story is most likely to repeat, and its single theme — text measured against a reserve that cannot hold it — applies directly to every label Task 1 adds.

### Stack

Pinned; no upgrade and **no new dependency** is in scope: Phaser 4.2.1, TypeScript ~5.7.2, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 (`PLAYWRIGHT_BROWSERS_PATH=0`, `workers: 5`). `@axe-core/playwright` 4.12.1 stays installed but is no longer a release gate (ADR-008). Node 20.18.1+; the lockfile is committed to pin exact patches.

**No web research is required for this story.** It introduces no library and removes more code than it adds. The one API worth confirming against your own call site rather than a general example is the transient `<input type="file">` for import — mirror `exportCaseRecord`'s transient-`<a>` lifecycle (create, use, remove, and release) in the same adapter directory. Context7 MCP is available for documentation lookup and is documentation-only.

### Project Structure Notes

- **New:** an autosave/persistence wiring module under `src/adapters/persistence/` (not `src/ui/`); an import-picker adapter alongside `src/adapters/export/`; geometry for the two new affordances in the existing `apparatusGeometry.ts` / `caseFileGeometry.ts`; matching unit tests.
- **Revised:** `src/main.ts`, `index.html`, `public/style.css`, `src/core/store/{AppAction,AppState}.ts`, `src/core/i18n/locales/{en,fr}.ts`, `src/schemas/CaseRecordSchema.ts`, `public/cases/young-interference/case.json`, `src/adapters/persistence/IndexedDbRepository.ts`, `src/adapters/phaser/{PhaserStoreAdapter}.ts`, `src/adapters/phaser/renderers/{ApparatusRenderer,LibraryRenderer,CaseFilePresenter}.ts`, `_bmad-output/project-context.md`, `_bmad-output/implementation-artifacts/deferred-work.md`, and the specs named in §Spec fallout.
- **Deleted:** the eleven modules in §The deletion set, plus `tests/integration/DualSurfaceControl.test.ts` and the e2e files marked *Retire*.
- **Do not touch:** `src/domain/**`, `src/game/*`, `src/adapters/phaser/SceneRouter.ts`, `dist/`, `.claude/worktrees/**`. `src/adapters/phaser/renderers/NotebookRenderer.ts` and `advanceView.ts` are the reference patterns, not edit targets.
- Naming: `PascalCase` classes/files, `camelCase` modules, `UPPER_SNAKE_CASE` constants, actions `domain.verbPastTense`, events `noun.verb`. No `services/`, `managers/`, or `helpers/` catch-all.

### Project Context Rules

Extracted from `_bmad-output/project-context.md` (revision 2.1) — the rules binding this story:

- **Engine (ADR-001 v1.1, ADR-011):** Phaser scenes own all interactive presentation; `CaseRecordPrintView` is the only non-Phaser exemption and dispatches nothing. **A feature is not done until the canvas can dispatch its intent** — grep for every dispatcher of every action you touch before marking complete. Never add semantic HTML to mirror a Phaser gesture. `src/game/scenes/*` are orphaned template leftovers. Scenes mirror the phase and never advance it; the router is read-only. No scene→scene reach-in. A routing failure must never escape the store subscriber. Renderer contract: `create()` / `render(state)` / `destroy()`, releasing every object, tween, timer and listener. Sticky canvas: `scale.updateBounds()` from a passive scroll listener owned by the scene lifecycle; browser tests scroll before exercising in-canvas controls. Honour `prefers-reduced-motion`. **After this story, the `src/ui/*` rule changes meaning** — update it: three retained modules, not a retirement in progress.
- **Guided adventure:** everything is authored. Every forward transition has an in-scene affordance; a transition reachable only from outside the canvas does not exist. Authored copy must not name a scene, phase, or route (`encodesPath`). Choices stay revisable; re-choosing never fails on "already chosen". No hard fail, score, timer, or speed reward — the rival lab included. The evaluator is the sole completion authority. Defensibility is evaluator/critique-only and must never leak into a display projection (ADR-006).
- **i18n (ADR-010, NFR19):** EN + FR from launch; locale from the browser, no player-facing selector. **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria.** Interface strings through `translate`/`createTranslator`; player-read prose is `LocalizedText`; proper nouns stay plain strings. Never give `locale` an optional `DEFAULT_LOCALE` fallback. Do not add a webfont. Scientific values are canonical across locales.
- **Organization:** `src/domain/` pure (no Phaser, DOM, `fetch`, IndexedDB, browser APIs, or Zod); `src/core/` holds store/i18n/errors/`Result`; `src/schemas/` owns Zod; `src/adapters/` owns side effects; the dependency direction never reverses. Only persistence adapters touch IndexedDB. Every Zod object is `.strict()`. Fallible operations return `Result<T, ResultError>`; error codes resolve to localized copy. Never recalculate a saved historical run against a newer model. **Bump `CaseDefinition.version` on any contract change and keep the record-compatibility allowlist honest.** Edit only `public/cases/…`.
- **Performance:** 60 FPS at 1280×720 on a low-end school laptop. Keep `update()` minimal; no logging, JSON parsing, IndexedDB access, DOM work, or transient allocation in a render path. Cap text resolution at `min(devicePixelRatio, 2)`. **NFR1's 10-minute re-profile is owned by Alexis and is due before this story is marked done** — it is AC9, and its trigger was made non-circular precisely so it would come due here.
- **Platform:** static web app; **offline reload is a release gate**. Never expose a raw error to the player. Verify with `npm run typecheck`, `npm test`, `npm run test:e2e`.
- **Testing:** unit-test pure logic with Vitest and fixtures — never require Phaser or a browser for it. Inject the structural slice (`sceneSlice.ts`, `SceneRouterTarget`) for Phaser-adjacent logic. Assert public actions, selectors and rendered text — never Phaser private fields or incidental pixels. **Never assert a magic number a test shares with source unless both read one exported constant.** Keep the reduced-motion check; delete no existing a11y spec without saying what covers it now.

### Baseline

Measured at HEAD `7feee79` on 2026-08-07:

- `npm run typecheck` — **clean**.
- `npm test` — **1126 passing across 67 files**.
- `npm run test:e2e` — **53 passed / 7 failed** on chromium at `workers: 5`, ~1.7–1.8 min, **on an idle machine**. The seven are the carried retired-DOM names listed in §Spec fallout; this story is the one that owns them, so the target is **0 failed**.
- `npm run test:e2e:cross-browser` — six additional known failures: `accessible-control.spec.ts:56`, `dialogue-advance.spec.ts:68`, `dialogue-advance.spec.ts:98`, `scene-router.spec.ts:31` (firefox **and** webkit); `offline-reload.spec.ts:17` and `offline-reload.spec.ts:137` (webkit only, the latter an internal WebKit error at the offline step). AC9 requires these fixed or re-recorded with an owner.

**Re-measure before your first change** and record before/after.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.12` — the seven AC blocks; §Epic 2 overview ("no DOM panel remains in the play path"); §Story 2.2 (the reset AC that D3 protects); §FR6/FR8/FR11/FR22/FR23/FR30 and NFR4/NFR12/NFR20]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md` §2.4 (the four retirement prerequisites), §2.5 ("two dead paths to retire rather than port"), §3 (2.12 strictly last, effort M / risk **High**), §4.1 Story 2.12]
- [Source: `_bmad-output/project-context.md` revision 2.1 — engine, guided-adventure, i18n, organization, performance, platform, testing, and the Critical Don't-Miss table]
- [Source: `_bmad-output/game-architecture.md` v1.2 — §User Interface and Rendering Boundary ("Surface completeness"), §Export and Print, §Consistency Rules, ADR-001 v1.1, ADR-006, ADR-007, ADR-008, ADR-009, ADR-011, ADR-012]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — §2.4 review (the silent boot guard; the hollowed validation-isolation spec; the duplicated IndexedDB constants; the six cross-browser failures), §2.6 review (the untranslated gate answer; the sub-768px rule), §2.7 development (the inconsistent suppression), §2.8 review (the reference shelf caught by the same flag), §2.10 development (`apparatus.reset`; `accessible-control.spec.ts`; "replace those observations, not merely delete the panels"), §2.10 review (the NFR1 trigger assigned to Alexis, due before this story is done), §2.11 review (the `sceneSlice` height gap; the load-sensitive walks), §improve-reference-mechanism (the stale `Record prepared observation` button; the run-experiment disabled-state mismatch)]
- [Source: `_bmad-output/implementation-artifacts/2-11-debrief-scene-and-replay.md` — §Scope boundary (the five things it left to this story), §D6 (the version-bump condition), §Read before editing, and the 29 review patches]
- [Source: `_bmad-output/implementation-artifacts/2-10-physical-apparatus-and-player-started-light.md` §Review Findings — the mutation-testing discipline and the harness findings]
- [Source: `src/ui/persistence/CaseProgressPanel.ts` — the autosave subscription at `:108-117`, and the only call sites of `exportCaseRecord`, `importCaseRecord`, and `openPrintDialog` in `src/`]
- [Source: `src/main.ts:27-45` — the 15-clause silent boot guard, and the ordering constraints that must survive its rewrite]
- [Source: `tests/e2e/validation-route.spec.ts` — the seeding path, the isolation assertions, and the IndexedDB probe that AC5 names]

## Open Questions for Alexis

Answer before dev starts; each changes the shape of the work rather than a detail inside it.

1. **Scope.** As specified this is larger than the SCP's "effort M": eleven deletions, a persistence relocation, two new affordances, three actions removed, a version bump, and ~14 e2e specs. Is it one story, or should Task 1 (the two orphan intents, D3/D4) split into a 2.13 that lands **before** this one? Splitting keeps 2.12 a pure retirement and keeps its risk where the SCP assumed it was.
2. **`apparatus.reset` (D3).** Confirmed as a bench control? The alternative — retiring the action — is cheaper here but retroactively un-satisfies Story 2.2's shipped "reset is immediate" AC.
3. **`consultation.requested` (D4).** Confirmed as a case-file control? The alternative is retiring the intent along with `consultationRules`, `selectConsultation`, and the persisted `consultation` field, and accepting that FR22's authored consultation layer is covered by 2.6's colleague hints instead.
4. **Sub-768px (D7).** Recommendation is to drop the suppression everywhere. Confirm, or choose the explicit "unsupported viewport" message instead.
5. **The six cross-browser failures (AC9).** Fix in this story, or re-record as owned with a named owner? They are the last thing standing between Story 7.3 and meaning something, and the trigger has already slipped twice.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Debug Log References

**Baseline, re-measured at HEAD `7feee79` before the first change (Task 0):** `npm run typecheck` clean;
`npm test` **1126 passing / 67 files**; `npm run test:e2e` **53 passed / 7 failed** on chromium — the
seven carried retired-DOM names exactly as the story predicts (`accessibility`, `curated-record`,
`inquiry-recognition`, `offline-reload`, `progress-portability`, `theory-board`, `young-experiment`).

**After:** typecheck clean; `npm test` **1142 passing / 66 files**; `npm run test:e2e` **52 passed /
0 failed**, twice consecutively, at load averages 43 and 48 on 18 cores — so the green is not an
idle-machine artefact.

**Mutation proofs.** Each guard was broken, the failure confirmed, and the guard restored:

| # | Guard | Mutation | Result |
| --- | --- | --- | --- |
| 1 | The sub-768px suppression is gone (D7) | Restored `&& !matchMedia('(max-width: 767px)').matches` in `updateBenchInputState` | `ApparatusRun.test.ts` fails — the armed-control counts disagree |
| 2 | The reset control's no-op guard | Deleted the "already at the authored setup" early return | `ApparatusRun.test.ts` fails — a press that changes nothing mints a new state |
| 3 | Reset erases no evidence (Story 2.2's AC) | Made `reduceApparatusReset` clear `runs` | `YoungExperimentBench.test.ts` fails |
| 4 | The consultation and peer-review panes share one band | Made the consultation pane visible in `review` too | `CaseFileRenderer.test.ts` fails |
| 5 | The record row is drawn only with a repository | Replaced `if (this.options.record)` with `if (true)` | `CaseFileRenderer.test.ts` fails — the validation-route case sees a row |
| 6 | The consultation localizes by rule id | Rendered `layers.plainLanguage.en` instead of resolving the locale | `CaseFileRenderer.test.ts` fails — a French player reads English |

**Screenshots, 1280×720, both locales** (the standing project check, because `sceneSlice.ts` reports a
constant `height: 18` and no unit test in this project can measure a rendered label). The bench control
row, the case file with a live consultation, and the case file with a refused one were all inspected in
EN and FR. Every label fits: `Réinitialiser le montage` renders on one line in the 196px control, and
the four-block French consultation renders in full with no crop. The refusal
(`consultation-unavailable`) renders localized in the widened status band.

### Completion Notes List

**The decisions the story asked Alexis to confirm, and what was built.**

- **Scope** — built whole; Task 1 was not split into a 2.13.
- **D3 `apparatus.reset`** — a third control in the bench's control row. The row is re-cut rather than
  extended: three controls of one derived width across `BENCH_LEFT … BENCH_RIGHT`, and the height went
  44 → 50 because two French lines at 15px are 42px and 44 leaves one pixel of air.
- **D4 `consultation.requested`** — a control on the case-file overlay, in the band the peer-review pane
  occupies during `review`. The two are the same question asked of different colleagues at different
  moments, and the right column has room for exactly one of them.
- **D7 sub-768px** — the suppression is deleted, in one direction, everywhere. Four `deferred-work.md`
  entries closed.
- **Cross-browser (AC9)** — fixes attempted first, then re-recorded. See below.

**AC3 — the hazard D1 names, and how it was closed.** `CaseProgressPanel` was not a projection panel:
its `store.subscribe` *was* the autosave, and it was the only caller in `src/` of `exportCaseRecord`,
`importCaseRecord` and `openPrintDialog`. `attachAutosave` holds that subscription now — same selector,
same repository, same `pendingWrite` serialization, relocated rather than rewritten — and
`createCaseRecordOperations` holds the other three. **There is no manual save any more**, which is the
point: `offline-reload.spec.ts` walks the canvas, saves nothing explicitly, reloads offline and reads its
progress back, so the restore *is* the proof the subscription is wired. Save failure reports through
`#boot-status`, where the two other persistence messages already speak (NFR12) — a canvas surface would
have needed a store field, which the scope boundary rules out.

**AC4 — what the invariant re-homing cost.** Two `ProposalSelection.test.ts` suites were about rules that
existed *only* because two writers shared one pair of fields ("free text clears the ID", "re-writing the
same words keeps it"). With one writer they are correctly gone. What replaced them is the stronger
statement the deletion bought and D5 asked for: for every authored proposal, and after any sequence of
choices, `conclusion` and `limitation` both come from the proposal the ID names — no blend, no partial
write. `scene-router.spec.ts`'s DOM probe was its only previous proof.

**AC5 — what was retired, and what covers it now.** Six e2e files were retired, each against named
coverage: `curated-record` → `library-reading`; `young-experiment` and `measurement-notebook` →
`young-canvas-experiment`; `context-prediction` → `library-reading` + the colleague board;
`accessible-control` → its live half moved into `young-canvas-experiment` as a **touch** test, which is
the one input mode nothing else in the suite reached; `youngExperimentHelpers.ts` drove only deleted
controls. `DualSurfaceControl.test.ts` asserted the DOM-parity contract ADR-001 v1.1 retired on
2026-08-05 and is retired deliberately. **No assertion was deleted to make the suite green.**

The e2e suite lost its DOM window on the store, so every re-pointed observation now reads ADR-007's
**retained printable record** — a shipped feature that projects the store and dispatches nothing, not an
observability hook added for a test (the 2.8 review's rule).

**AC9 — the six cross-browser failures.** Four are fixed: `accessible-control.spec.ts:56` (file retired),
`scene-router.spec.ts:31` (rewritten canvas-only), `dialogue-advance.spec.ts:98` (re-pointed), and
`dialogue-advance.spec.ts:68` now passes on firefox. **Two engine-level causes remain, re-recorded with
an owner and a reachable trigger:**

| Failure | Cause | Owner | Trigger |
| --- | --- | --- | --- |
| `dialogue-advance.spec.ts:99` (webkit) | Two consecutive canvas screenshots of an un-advanced dialogue panel are not byte-identical on WebKit. A rendering-determinism property of the engine, not of the product; the spec's stability check is a `Buffer.compare` and there is no PNG decoder available without a new dependency (out of scope). | Alexis Kartmann | Before Story 7.3 signs off cross-browser release verification. Fix by giving the comparison a pixel tolerance, which needs a decoder or Playwright's snapshot machinery. |
| `offline-reload.spec.ts:30`, `:104`, `:152` (webkit) | `page.reload()` after `context.setOffline(true)` fails with *"WebKit encountered an internal error"* before the page is reached. Playwright/WebKit, upstream of anything this project renders. | Alexis Kartmann | Before Story 7.3. Re-test on each Playwright bump; if it persists, verify WebKit offline reload by hand and record it in `docs/validation/`. |

`:104` is the third instance of the same WebKit defect rather than a new one: it is the offline-restore
test, which the baseline listed among the *chromium* retired-DOM failures and which now also reaches the
WebKit reload path.

**What I could not complete, and why.** **NFR1's 10-minute re-profile is still Blocked.** It requires a
representative low-end school laptop and ten minutes of human observation, and the template forbids
substituting an automated figure in as many words: *"Do not substitute an automated test or rendered FPS
estimate for this manual gate."* This story was implemented on a developer workstation. The record is
written at `docs/validation/young-performance-2026-08-07-story-2-12.md` with the delta this story
introduces — which is a **reduction**: eleven DOM subtrees rebuilt on every dispatch are gone, four
`@keyframes` with them, and the per-keypress `matchMedia` read is gone with the suppression. Nothing this
story adds runs per frame. **This is the one clause of AC9 that is not satisfied, and it is Alexis's to
run.**

**Follow-up folded in after first completion, at Alexis's direction (2026-08-07).** Reviewing the running
app showed the panel retirement was only half visible: the eleven panels were gone, but **the column that
held them was not**. `#boot-shell` was still a two-column grid whose left cell — roughly a third of the
viewport, permanently — held a boot frame whose button only wrote a status string (the game booted on
load regardless, so "open the laboratory to begin" sat beside a laboratory that had already begun) and
ADR-007's printable record, rendering on screen because nothing had ever hidden it: the `@media print`
block existed only to hide everything *else*. Alexis chose to make the boot frame a real gate and to fold
the work into this story rather than open a 2.13.

*No acceptance criterion was added or altered.* What changed touches AC1's retained-module set (unchanged
— still three), AC3's "the printable record still renders and still dispatches nothing" (it renders, and
prints; it is no longer *displayed*), AC7's narrow-viewport clause, and AC9's gates, which were re-run in
full. Five decisions are worth the reviewer's attention:

- **The record is visually hidden, not removed.** The standard clip, not `display: none` or `hidden`, and
  the difference is load-bearing twice: `#game-container` is `aria-hidden="true"` and canvas a11y
  projection is still an open deferred item, so this record is the only readable account of the
  investigation; and it is the e2e suite's only window onto the store now the panels are gone. `display:
  none` would have taken it out of the accessibility tree and out of every re-pointed assertion at once.
- **The gate is an input gate, not a curtain — and that had to be found, not assumed.** Covering the
  canvas is not sufficient: Phaser binds its pointer listeners above the document rather than to the
  canvas element, so a click on the frame's background is hit-tested against the scene underneath and
  reaches it. Probed rather than reasoned about, and the probe recorded a reading taken off the reading
  room's shelf from the splash screen. `game.input.enabled = false` until entry closes it, and
  `boot-shell.spec.ts` asserts it against a *recorded consequence* — the reading appears on the record or
  it does not — with the same click succeeding after entry, so it proves suppression rather than a
  coordinate that was never going to hit anything.
- **The status line moved out of the frame, and grew a tone.** It is the only surface a failed autosave
  speaks from (NFR12) and a save can fail in any phase — that is, after the frame is dismissed — so a
  region scoped to the frame would have been unreachable exactly when it mattered. `alert` (every
  failure) persists; `notice` (the entry confirmation, which Alexis asked to have disappear) clears after
  `BOOT_NOTICE_MS`. A pending expiry is always cancelled before a new message is written, so a notice
  cannot wipe an alert that replaced it — the one way a timed message turns into silent loss.
- **A double-centring bug was found by measuring rather than by looking.** The Phaser config sets
  `autoCenter: Scale.CENTER_BOTH` and the CSS set `place-items: center`; the two composed, and at
  1280×720 the 960-wide canvas sat at x=240 instead of x=160. It was invisible while the parent was one
  narrow grid cell, because the margin Phaser computed there was near zero. Placement is now Phaser's
  alone, verified at 1280×720, 1920×1080 and 390×844.
- **The facilitator disclosure is now shown before entry rather than for the session's duration.** It
  rides on the frame, which the gate dismisses. It is a consent notice, and a consent notice is read
  before the thing it consents to — AC4's "on every render of the validation route" still holds, since it
  is mounted on every render — but the *duration* of its visibility did change, and that is a product
  judgement the reviewer may want to overturn. Called out in `validation-route.spec.ts` at the moved
  assertion as well as here.

**Two long-standing suite flakes were fixed on the way, and neither fix is a longer wait.** The gate made
them reproducible: `readTheReferences` and the reduced-motion library walk both clicked each shelf
reference **once**, behind fixed-duration waits, and verified nothing — so a click Phaser dropped because
it had not processed the previous frame left the room with one reading, and the failure surfaced at the
exit as a room correctly refusing to be left, five seconds of bounded retry that could never help, and a
routing error pointing nowhere near the lost click. Both now verify each reading against the record's own
count with a bounded retry, so a shelf that stops recording still fails, at the click. `library-reading`
and `inquiry-recognition` had been the suite's two most frequent contention failures and are green.

**Cross-browser is better than this story found it.** `npm run test:e2e:cross-browser` is **162 / 3**,
against six failures at first completion. The three are the recorded WebKit `page.reload`-after-offline
engine defect, unchanged and still owned. `dialogue-advance.spec.ts:99`'s WebKit screenshot-determinism
entry is green: it is the only spec that compares canvas pixels, `page.screenshot` captures the
*composited page*, and the entry notice is a fixed bar over the clip band — so that spec now waits the
notice out explicitly, and says why.

**One authored-content defect found and deferred rather than quietly fixed.** The `state-a-limit`
consultation still says "add a limitation or alternative explanation to the theory board", which
described two acts and now describes one. It is achievable, not broken. Fixing it means editing
`case.json` content, which would falsify the allowlist clause's "byte-identical apart from the version"
claim — so it is recorded in `deferred-work.md` for whichever story next owns case content.

### File List

**Added**

- `src/adapters/export/pickRecordFile.ts`
- `src/adapters/persistence/caseRecordOperations.ts`
- `docs/validation/young-performance-2026-08-07-story-2-12.md`

**Deleted (the eleven panels)**

- `src/ui/apparatus/ApparatusControls.ts`
- `src/ui/context/CaseContextAndPrediction.ts`
- `src/ui/debrief/HistoricalDebriefPanel.ts`
- `src/ui/notebook/NotebookPanel.ts`
- `src/ui/persistence/CaseProgressPanel.ts`
- `src/ui/recognition/InquiryRecognitionPanel.ts`
- `src/ui/review/ConclusionReviewPanel.ts`
- `src/ui/review/ConsultationPanel.ts`
- `src/ui/review/DecisionHistoryPanel.ts`
- `src/ui/sources/CuratedRecord.ts`
- `src/ui/theory/TheoryBoard.ts`

**Deleted (tests, each against named coverage)**

- `tests/e2e/accessible-control.spec.ts`
- `tests/e2e/context-prediction.spec.ts`
- `tests/e2e/curated-record.spec.ts`
- `tests/e2e/measurement-notebook.spec.ts`
- `tests/e2e/young-experiment.spec.ts`
- `tests/e2e/youngExperimentHelpers.ts`
- `tests/integration/DualSurfaceControl.test.ts`

**Modified (source)**

- `index.html`
- `public/style.css`
- `public/cases/young-interference/case.json`
- `src/main.ts`
- `src/ui/BootShell.ts`
- `src/game/main.ts`
- `src/adapters/persistence/IndexedDbRepository.ts`
- `src/adapters/phaser/PhaserStoreAdapter.ts`
- `src/adapters/phaser/renderers/ApparatusRenderer.ts`
- `src/adapters/phaser/renderers/CaseFilePresenter.ts`
- `src/adapters/phaser/renderers/apparatusGeometry.ts`
- `src/adapters/phaser/renderers/caseFileGeometry.ts`
- `src/adapters/phaser/scenes/TheoryBoardScene.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/core/store/AppAction.ts`
- `src/core/store/AppState.ts`
- `src/schemas/CaseRecordSchema.ts`

**Modified (tests)**

- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/boot-shell.spec.ts`
- `tests/e2e/canvas-transitions.spec.ts`
- `tests/e2e/canvasHelpers.ts`
- `tests/e2e/debrief-replay.spec.ts`
- `tests/e2e/dialogue-advance.spec.ts`
- `tests/e2e/french-typography.spec.ts`
- `tests/e2e/inquiry-recognition.spec.ts`
- `tests/e2e/library-reading.spec.ts`
- `tests/e2e/offline-reload.spec.ts`
- `tests/e2e/progress-portability.spec.ts`
- `tests/e2e/rival-lab.spec.ts`
- `tests/e2e/scene-router.spec.ts`
- `tests/e2e/theory-board.spec.ts`
- `tests/e2e/validation-route.spec.ts`
- `tests/e2e/young-canvas-experiment.spec.ts`
- `tests/integration/MeasurementNotebook.test.ts`
- `tests/integration/ProposalSelection.test.ts`
- `tests/integration/RecognitionStore.test.ts`
- `tests/integration/ReviewFlow.test.ts`
- `tests/integration/SceneRouter.test.ts`
- `tests/integration/TheoryBoard.test.ts`
- `tests/integration/YoungExperimentBench.test.ts`
- `tests/unit/ApparatusGeometry.test.ts`
- `tests/unit/ApparatusRun.test.ts`
- `tests/unit/CaseFileGeometry.test.ts`
- `tests/unit/CaseFileRenderer.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/CompletionReplay.test.ts`
- `tests/unit/ContextPrediction.test.ts`
- `tests/unit/EvidenceStore.test.ts`
- `tests/unit/ReviewRules.test.ts`
- `tests/unit/TheoryStore.test.ts`
- `tests/unit/YoungExperimentStore.test.ts`

**Modified (documentation)**

- `_bmad-output/project-context.md` (revision 2.2)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 1.1 | **Layout retirement, folded in at Alexis's direction after reviewing the running app.** The panels were gone but the two-column grid that held them was not, so a boot frame with a vestigial button and ADR-007's printable record still occupied a third of the viewport beside the laboratory. The canvas is now the page at every width; the boot frame covers it and is dismissed on entry; the record is visually hidden and revealed only by `@media print`, kept in the accessibility tree because `#game-container` is `aria-hidden` and canvas a11y projection has no owner yet. The gate is an **input** gate — Phaser binds pointer listeners above the document, so covering the canvas alone left the splash driving the hidden laboratory, found by probe and asserted against a recorded consequence. `#boot-status` moved out of the frame so a failed save can still speak after entry (NFR12), and gained `alert`/`notice` tones so the entry confirmation clears itself. Fixed a double-centring bug (`autoCenter` + `place-items: center`) that put the canvas 80px off centre, verified at three viewports. Two long-standing suite flakes fixed by making each shelf reading verify itself against the record rather than by waiting longer. No AC added or altered; the facilitator disclosure is now shown before entry rather than for the session, which is flagged for the reviewer. typecheck clean, **1142 tests / 66 files**, e2e **55 / 0**, cross-browser **162 / 3** — the three are the recorded WebKit `page.reload` engine defect, down from six. NFR1's manual profile is still Blocked. | Game Developer |
| 2026-08-07 | 1.0 | Implemented. Eleven panels, eleven `index.html` roots and ~200 lines of CSS deleted; three modules retained. `apparatus.reset` and `consultation.requested` given canvas affordances (D3, D4), so no player intent has a dispatcher only under `src/ui/` (ADR-011). Autosave, export, import and print relocated off `CaseProgressPanel` into `attachAutosave` / `createCaseRecordOperations`, with the save-failure surface on `#boot-status` (NFR12). The three free-text actions removed from `AppAction`, `AppState` and both locale bundles; D5's proposal-write invariant re-homed to `ProposalSelection.test.ts`. Boot guard rewritten over four roots and made to fail loudly (AC2). `case.json` 1.14.0 → 1.15.0 with an allowlist clause stating that no authored field changed. The sub-768px suppression deleted in one direction everywhere (D7), closing four deferred entries. Six e2e files retired against named coverage and eleven re-pointed at the canvas; the seven carried baseline failures are closed. typecheck clean, **1142 tests / 66 files**, e2e **52 / 0** twice consecutively. Four of the six cross-browser failures fixed; two engine-level causes re-recorded with an owner and a non-circular trigger. **NFR1's manual profile remains Blocked** — it needs Alexis and low-end hardware, and the template forbids substituting an automated figure. | Game Developer |
| 2026-08-07 | 0.1 | Story context created from epics.md §Story 2.12, sprint-change-proposal-2026-08-06 §2.4/§2.5/§4.1, project-context v2.1, game-architecture v1.2, deferred-work.md (nine items naming this story as owner), the 2.10 and 2.11 story files and reviews, and the live source. Three corrections to the epic's text are recorded in the ACs: the deletion set is eleven modules, not thirteen; `CaseProgressPanel` owns the autosave, export, import, and print trigger, so AC3 was added to keep the offline-reload gate and FR11 satisfiable; and the two orphan intents whose decision was owed before this story started are decided in D3/D4 and flagged for confirmation. | Game Scrum Master |

---
title: 'Improve the source reference mechanism'
type: 'refactor'
created: '2026-08-05'
baseline_commit: '090356b7b8f738cfa86ee31da41a4b33aa18c005'
status: 'done'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Each Curated Record source card exposes two competing controls — "Inspect {name}" (records evidence) and "Read the record" (opens the Phaser book) — and reading injects a full paginated HTML copy of the document into the context panel, which duplicates the book and feels clumsy. There is also no quick way to grasp a reference without paging through the whole book.

**Approach:** Three coupled improvements to the reference/book experience: (1) collapse the two controls into the single **"Inspect {name}"** button that records evidence AND opens the book for readable sources; (2) stop rendering the paginated HTML document, keeping only a compact attribution block so the Phaser book is the sole reader; (3) add an authored 1-page **summary per reference** and a **"Show summary"** control on the book view that reveals it as a Phaser overlay.

## Boundaries & Constraints

**Always:**
- One primary action button per source card. For a **readable** source (`textualRendition` present AND `rightsStatus === 'reviewed'`) the "Inspect {name}" button records evidence AND opens the book. Non-readable sources keep today's inspect-only behavior and error handling.
- Preserve the archive-facsimile external link, reuse statement, and citation text in an accessible HTML attribution block; keep `readerLabel` as the book/attribution identity.
- The Phaser book remains the reader and keeps its own navigation + close; closing it returns focus to the source card's "Inspect {name}" button.
- The summary is authored per reference in the case contract, is optional, and the "Show summary" control appears only when a summary exists. The summary overlay is modal within the book (paging suppressed while open) and dismissible back to the book.
- The context-readiness gate is still satisfied by inspection (unchanged); gate messaging still says "Inspect …".
- Extending `TextualRendition` and `LectureBookPresentation` with a `summary` field is an intended part of this work.
- Clicking a readable source's "Inspect" control always opens the book — even when the source is already inspected (then it does not re-record) and regardless of the current phase.

**Ask First:**
- Any change to the `source.inspected` action/reducer or the source-eligibility rule.
- Final wording/content of the authored summaries (I will draft them from the existing rendition text for human review before shipping).

**Never:**
- No second "Read"/reader button and no inline paginated `.contextual-text-section` HTML text.
- Do not change source eligibility semantics or the existing Phaser book page visuals/paging.
- Do not let a book opened during the context/prediction gate linger over the laboratory when experimentation begins — auto-close it as the experiment phase is entered (but a book the user deliberately re-opens later may stay until they close it).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Inspect a readable, not-yet-inspected source | Click "Inspect {name}" | Recorded as inspected evidence; "Inspection recorded" shown; Phaser book opens; status "{name} is recorded as inspected evidence." | N/A |
| Re-click a readable, already-inspected source | Click again (any phase, incl. experiment) | Book re-opens; evidence not re-recorded; no duplicate error | Swallow `duplicate-inspected-source`; still open book |
| Inspect a non-readable / ineligible source | `rightsStatus !== 'reviewed'`; click | No evidence recorded, no book; neutral recovery message; focus stays on button | Map `source-not-eligible` to existing neutral message |
| Show summary on an open book | Book open, summary authored; click "Show summary" | Phaser summary overlay appears over the book with the reference's 1-page summary; paging suppressed; "Close summary" returns to the book | N/A |
| Open a book whose reference has no summary | Book open, `summary` absent | No "Show summary" control shown | N/A |
| Enter experiment phase with book/summary open | Phase transitions into `experiment` | The lingering book (and any summary overlay) closes so it never blocks the laboratory | N/A |
| Switch to another source while a summary overlay is open | Book showing source A summary; inspect source B | Summary resets; source B's book spread shows (never a stale/empty summary panel) | N/A |

</frozen-after-approval>

## Code Map

- `src/domain/cases/CaseDefinition.ts` -- add optional `summary: readonly string[]` (paragraphs) to `TextualRendition`.
- `src/schemas/CaseDefinitionSchema.ts` -- validate the optional `summary` array (each entry trimmed, non-empty).
- `public/cases/young-interference/case.json` -- author a 1-page `summary` for the Young lecture and the Opticks reference (build copies to `dist/`).
- `src/ui/sources/CuratedRecord.ts` -- remove the "Read" button; "Inspect {name}" also opens the book for readable sources; `focusReaderTrigger` targets the inspect button.
- `src/ui/context/CaseContextAndPrediction.ts` -- replace `renderLectureReader` with a compact attribution block; drop HTML paging/status and the "does not record…" note; pass `summary` into the presentation; auto-close the book when the phase becomes `experiment`.
- `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- extend `LectureBookPresentation` with `summary?`; draw a "Show summary" control when present and a dismissible summary overlay drawn over the book.
- `tests/e2e/curated-record.spec.ts` -- rewrite to the merged single-button + attribution-block model; smoke-test Show-summary via canvas.
- `tests/e2e/context-prediction.spec.ts`, `accessibility.spec.ts`, `youngExperimentHelpers.ts` -- verify gate flows still pass with the book opening on inspect; adjust only if the overlay interferes.
- `tests/unit/CaseDefinition.test.ts` -- cover the new `summary` contract field.

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/cases/CaseDefinition.ts` + `src/schemas/CaseDefinitionSchema.ts` -- Add optional `summary: readonly string[]` to `TextualRendition` and validate it -- gives the summary an authored home in the case contract.
- [x] `public/cases/young-interference/case.json` -- Author a concise 1-page `summary` (paragraph list) for `young-lecture-1801` and `newton-opticks`, drafted from their rendition text -- content for the feature (human-reviewed per Ask First).
- [x] `src/ui/sources/CuratedRecord.ts` -- Delete the "Read the record" button; in the "Inspect {name}" handler, after a successful/duplicate inspection call `options.onReadLectureRecord(source)` for readable sources, opening the book without surfacing the duplicate error; point `focusReaderTrigger` at `inspect-${sourceId}` -- one button that inspects and opens the book.
- [x] `src/ui/context/CaseContextAndPrediction.ts` -- Replace `renderLectureReader` with a compact accessible attribution block (region labelled by `readerLabel`; reuse statement, citation text, archive-facsimile link); remove HTML paging buttons, spread status, reading note, and HTML-only `requestedFocusKey`s; include `summary` in `publishLectureBook`; close any open lecture record when the phase becomes `experiment` -- removes the redundant HTML document and wires the summary.
- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- Add `summary?: readonly string[]` to `LectureBookPresentation`; draw a "Show summary" control when a summary is present; render a modal summary overlay over the book (suppress paging while open) with a "Close summary" affordance; reset the overlay when the book closes -- the on-book summary popup.
- [x] `tests/**` -- Update `curated-record.spec.ts` to the merged model + attribution-block link assertion; add a unit test for the `summary` contract field; run the full suite and fix any flow the book overlay disrupts (rely on experiment-phase auto-close first).

**Acceptance Criteria:**
- Given a reviewed readable source, when the user clicks "Inspect {name}", then it is recorded as inspected evidence ("Inspection recorded" appears) and the Phaser book opens.
- Given the book is open, when the user reads it, then no paginated HTML document appears — only the compact attribution block with a working archive-facsimile link, reuse statement, and citation.
- Given a reference with an authored summary and an open book, when the user activates "Show summary", then its 1-page summary appears as a Phaser overlay over the book and can be dismissed back to the book; a reference without a summary shows no "Show summary" control.
- Given a non-readable/ineligible source, when the user clicks "Inspect {name}", then behavior and neutral error recovery are unchanged and no book opens.
- Given the book (or summary overlay) is open and the user advances to the experiment phase, then it closes and never blocks the laboratory.
- Given `npm run typecheck`, `npm test`, and `npm run test:e2e` are run, then all pass.

## Spec Change Log

- **Step-04 review (iteration 1).** Adversarial review (blind / edge-case / acceptance) + a human clarification.
  - **Human amendment:** "Even if the record was inspected, we should be able to open the book (even if we don't record the evidence)." Amended the frozen auto-close boundary and matrix so the book auto-closes only on *entering* the experiment phase (not on every render), keeping the reader re-openable in any phase. KEEP: `publishLectureBook(undefined)` already hides the overlay on close; do not reintroduce per-render suppression.
  - **Patch (summary panel):** switching sources while a summary overlay was open could render a stale/empty "Summary" panel (`changedSpread` compared only `.index`). Fixed by resetting `summaryOpen` on source change and only entering summary mode when `presentation.summary?.length`.
  - **Patch (summary overflow):** an over-long authored summary is now clipped to `SUMMARY_MAX_HEIGHT` rather than spilling over the Close control.
  - **Rejected as verified-false / accepted:** overlay-not-dismissed, CuratedRecord-not-subscribed, stale spread controls, dead `requestedFocusKey` (all have companion code that works, confirmed at `CaseContextAndPrediction.ts:206`, `CuratedRecord.ts:147`, `LectureBookRenderer` `this.pages`), and the aria-live spread-status removal (accepted product trade-off).
  - **Deferred (pre-existing, not this change):** ~6 e2e specs reference a removed "Record prepared observation" button; `young-experiment.spec.ts:19` asserts `aria-disabled` on a hard-`disabled` Run-experiment button. Both reproduce on baseline `090356b`.

## Design Notes

Readable = `textualRendition && rightsStatus === 'reviewed'`, exactly today's "Read" condition, which also implies `isSourceEligibleForInspection`. Avoid the duplicate-inspection error by checking `selectIsSourceInspected` before dispatching, then always opening the book for readable sources.

Summary is ephemeral view state inside `LectureBookRenderer` (a boolean), driven by the `summary` paragraphs carried on the presentation — no store/action changes. `summaryOpen` resets on a fresh open, a page turn, or a source change.

The experiment-phase auto-close is edge-triggered: `CaseContextAndPrediction` tracks `lastRenderedPhase` and dismisses the open book only on the `→ experiment` transition, so a reference the user re-opens later stays open until they close it.

Trade-offs (accepted by product): (1) the lecture text and the summary are Phaser-canvas only, not screen-reader accessible; the HTML attribution block keeps rights/citation/archive link accessible. (2) Removing the HTML spread status means e2e can no longer assert spread numbers via the DOM; book paging and the summary overlay are smoke-tested via canvas clicks plus manual verification, while contract/wiring logic is unit-tested.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no type errors
- `npm test` -- expected: all unit/integration pass, incl. the new `summary` contract test
- `npm run test:e2e` -- expected: curated-record, context-prediction, accessibility, and downstream gate flows pass

**Manual checks:**
- Inspect a readable source → book opens and evidence is recorded; "Show summary" reveals the 1-page summary overlay and dismisses back to the book; advancing to the experiment phase leaves the laboratory unobstructed.

## Suggested Review Order

**The merged control (start here)**

- One "Inspect" control: readable sources record once (or skip if already recorded) and open the book.
  [`CuratedRecord.ts:93`](../../src/ui/sources/CuratedRecord.ts#L93)

**Reference reading surface (HTML book → attribution only)**

- Full HTML document replaced by a compact `role="group"` attribution block (reuse, citation, archive link).
  [`CaseContextAndPrediction.ts:98`](../../src/ui/context/CaseContextAndPrediction.ts#L98)

- Edge-triggered auto-close: dismiss a lingering book only on entering `experiment`; reopening later stays allowed.
  [`CaseContextAndPrediction.ts:126`](../../src/ui/context/CaseContextAndPrediction.ts#L126)

- The authored summary is piped into the Phaser presentation.
  [`CaseContextAndPrediction.ts:87`](../../src/ui/context/CaseContextAndPrediction.ts#L87)

**On-book summary overlay (Phaser)**

- The modal summary panel, masked over the spine so text reads cleanly.
  [`LectureBookRenderer.ts:168`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L168)

- Hit-testing for the "Show summary" / "Close summary" controls; paging suppressed while open.
  [`LectureBookRenderer.ts:236`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L236)

- `summaryOpen` resets on a fresh open, page turn, or source switch — never a stale/empty panel.
  [`LectureBookRenderer.ts:77`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L77)

**Contract & authored content**

- Optional `summary` on `TextualRendition` and its Zod validation.
  [`CaseDefinition.ts:35`](../../src/domain/cases/CaseDefinition.ts#L35) · [`CaseDefinitionSchema.ts:55`](../../src/schemas/CaseDefinitionSchema.ts#L55)

- The two authored 1-page summaries (Young lecture, Opticks).
  [`case.json:24`](../../public/cases/young-interference/case.json#L24)

**Peripherals (styling, tests)**

- Attribution block styling.
  [`style.css:140`](../../public/style.css#L140)

- Merged-button + attribution e2e, and the reopen-in-experiment flow.
  [`curated-record.spec.ts:45`](../../tests/e2e/curated-record.spec.ts#L45) · [`curated-record.spec.ts:150`](../../tests/e2e/curated-record.spec.ts#L150)

- Summary contract unit tests.
  [`CaseDefinition.test.ts:163`](../../tests/unit/CaseDefinition.test.ts#L163)

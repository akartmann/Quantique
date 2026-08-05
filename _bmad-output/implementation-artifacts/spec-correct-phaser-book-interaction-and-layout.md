---
title: 'Correct Phaser book interaction and layout'
type: 'bugfix'
created: '2026-08-05'
baseline_commit: '9b5e54d3b50666074fd3b2e4fcf7a43fcdeaed1b'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-animated-phaser-lecture-book.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-fix-phaser-lecture-book-rendering.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Phaser Next and Close are inactive, and word-limit splitting turns a single printed archival page into several artificial book pages. The visual book also places its title and subtitle over the paper instead of separating game context from the reading surface.

**Approach:** Keep the source’s authored printed pages as the visual/semantic book leaves, dynamically reduce body typography to fit each leaf, and reserve the canvas area above the paper for the book’s title and source subtitle. Ensure only the visible book buttons accept Phaser input while underlying apparatus controls remain disabled.

## Boundaries & Constraints

**Always:** Keep local immutable content, authored section/source-page identity, semantic reader controls, ephemeral shared spread state, reduced-motion behavior, offline operation, and close/focus recovery. Show one source section/printed page per leaf, including a useful printed-page footer. Keep a two-page spread where available.

**Ask First:** Editing historical wording, source attribution, page ordering, persistence, pagination state, or the semantic HTML’s accessibility contract.

**Never:** Fetch text; use a canvas-only control path; let input reach apparatus controls beneath an open book; add global listeners, physics, or per-frame layout work; convert source pages into new authored content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Open archive | Player selects Read | Two leaves correspond to printed pages 12 and 13, with readable fitting text and printed-page footers | Semantic spread mirrors the same pages |
| Canvas Next / Close | Player selects visible Phaser button | Shared spread changes or book closes; apparatus remains unchanged | Buttons are above the passive dimmer and always receive pointer input |
| Long source page | A printed page contains the most words in the rendition | Renderer selects the smallest needed bounded font before drawing | No source page is split or truncated |
| First / final spread | Boundary navigation | Previous/Next is disabled or inert as appropriate | No out-of-range source page is displayed |

</frozen-after-approval>

## Code Map

- `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- Phaser layout, passive overlay, visual controls, text sizing, and printed-page labels.
- `src/ui/sources/lecturePagination.ts` -- pure projection from immutable authored sections to source-page leaves.
- `src/ui/context/CaseContextAndPrediction.ts` -- existing semantic reader projecting the same leaves.
- `tests/unit/lecturePagination.test.ts` -- verifies original source-page identity and order without artificial leaves.
- `tests/e2e/curated-record.spec.ts` -- public canvas navigation and close behavior.

## Tasks & Acceptance

**Execution:**

- [x] `src/ui/sources/lecturePagination.ts` and `tests/unit/lecturePagination.test.ts` -- produce exactly one leaf per authored source section and preserve the full section text/order/source-page reference.
- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- place title/subtitle above the paper, fit page text by bounded font adjustment, label the printed page footer, and keep controls inside the paper area.
- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` and `tests/e2e/curated-record.spec.ts` -- make the dimmer non-interactive, retain apparatus input gating, and exercise Phaser Next plus Close through public canvas coordinates.

**Acceptance Criteria:**

- Given a player opens the lecture, when the first spread is drawn, then it contains source pages 12 and 13—not arbitrary word-limit leaves—and each page’s full local text fits the paper.
- Given a player selects Phaser Next or Close, when the pointer is released, then the semantic spread advances or the book closes and focus returns to Read.
- Given the book is open, when the user clicks another canvas coordinate, then no apparatus value changes.
- Given any displayed spread, then the title and subtitle are visually outside the paper and every leaf has a useful printed-page footer.

## Spec Change Log

## Design Notes

The source’s printed page is the reader’s meaningful unit. Text fitting is computed once when the spread is redrawn, not continuously, and is bounded to preserve legibility.

## Verification

**Commands:**

- `rtk npm run typecheck` -- expected: renderer and pagination contracts compile.
- `rtk npm test -- --run tests/unit/lecturePagination.test.ts` -- expected: 37 source-page leaves, full ordered content, and bounded spreads.
- `rtk npm run test:e2e -- tests/e2e/curated-record.spec.ts` -- expected: public Phaser Next, Close, focus, and input-blocking flow pass.
- `rtk npm run test:e2e:offline` -- expected: source-page navigation remains local after reload.
- `rtk npm run build` -- expected: production build succeeds.

## Suggested Review Order

**Source-faithful pagination**

- Keeps every authored source section intact as one printed-page book leaf.
  [`lecturePagination.ts:28`](../../src/ui/sources/lecturePagination.ts#L28)

**Book layout and input**

- Creates a passive dimmer, a distinct paper surface, and title context above it.
  [`LectureBookRenderer.ts:105`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L105)

- Draws fitting source leaves, printed-page footers, and visual controls inside the paper.
  [`LectureBookRenderer.ts:126`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L126)

- Reduces body typography only when a freshly drawn authored page needs more space.
  [`LectureBookRenderer.ts:160`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L160)

**Public verification**

- Exercises the visual Next and Close coordinates against synchronized semantic state.
  [`curated-record.spec.ts:34`](../../tests/e2e/curated-record.spec.ts#L34)

- Proves pagination preserves all 37 source pages without word-limit fragmentation.
  [`lecturePagination.test.ts:18`](../../tests/unit/lecturePagination.test.ts#L18)

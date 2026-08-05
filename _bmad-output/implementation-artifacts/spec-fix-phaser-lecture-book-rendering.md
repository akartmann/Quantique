---
title: 'Fix Phaser lecture book rendering'
type: 'bugfix'
created: '2026-08-05'
baseline_commit: '4d9be63348007d659648ff3fd1a86bf8dc3295b1'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-animated-phaser-lecture-book.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The generated Phaser book can open as an empty shell and its visual page controls do not respond. That prevents the reader from communicating the locally stored lecture as part of the game experience.

**Approach:** Make the book renderer retain its own title and source-text references instead of discovering them through a runtime Phaser class check. Make visual control callbacks invoke their semantic projection action without depending on optional Phaser event metadata.

## Boundaries & Constraints

**Always:** Preserve the immutable local English text, semantic reader authority, synchronized ephemeral spread state, input blocking, reduced-motion behavior, close/focus recovery, and offline operation. Render a visible title, source reference, two pages of local text, and usable previous/next/close controls in Phaser.

**Ask First:** Changing lecture content, pagination rules, attribution, persistence, or the semantic reader’s accessible controls.

**Never:** Fetch content at runtime; make Phaser authoritative; add global browser listeners; expose raw runtime failures to players; mutate case or store state directly from Phaser; add per-frame work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Open book | Player activates the authored Read control | Phaser book shows title, source label, and first two populated local pages | Semantic reader remains equivalent and synchronized |
| Visual navigation | Player activates Phaser Next or Previous | Callback moves the shared bounded semantic spread and redraws matching Phaser pages | First/last action remains inert; underlying apparatus stays blocked |
| Phaser runtime event shape | Pointer callback has no event-data object | Visual control still invokes its action | No optional event method is called |

</frozen-after-approval>

## Code Map

- `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- owns overlay composition, drawn page objects, and visual control callbacks; defective runtime lookup is here.
- `tests/e2e/curated-record.spec.ts` -- public regression journey for opening and using the visible Phaser book.
- `src/ui/context/CaseContextAndPrediction.ts` -- existing semantic shared-spread owner to preserve, not duplicate.

## Tasks & Acceptance

**Execution:**

- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- retain explicit title/source text references when creating the overlay and use them to draw each spread; remove the runtime display-list type discovery.
- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- make the overlay and visible navigation callbacks safe when Phaser supplies no event-data object, while retaining overlay input blocking.
- [x] `tests/e2e/curated-record.spec.ts` -- existing public regression already asserts canvas Next advances the shared semantic spread while the reader exposes populated local content; no private Phaser or pixel assertions were added.

**Acceptance Criteria:**

- Given a player opens the Young lecture, when the book animation completes, then both generated pages visibly contain local lecture text with title and source reference.
- Given the book is open, when the player selects the Phaser Next or Previous controls, then the semantic reader announces the corresponding bounded spread.
- Given Phaser’s pointer callback omits event data, when a visual book control is activated, then it still works and no laboratory control receives the interaction.

## Spec Change Log

## Design Notes

The display list is a rendering implementation detail, not a safe source of semantic named references. Store the two static text objects at overlay creation so spread drawing has no runtime class-identity dependency.

## Verification

**Commands:**

- `rtk npm run typecheck` -- expected: renderer references and callbacks compile.
- `rtk npm run test:e2e -- tests/e2e/curated-record.spec.ts` -- expected: public visual navigation and semantic synchronization pass.
- `rtk npm run test:e2e:offline` -- expected: local reading remains available after an offline reload.
- `rtk npm run build` -- expected: production bundle builds successfully.
- `rtk git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Reliable book projection**

- Retains the overlay’s named text objects, eliminating fragile runtime display-list discovery.
  [`LectureBookRenderer.ts:36`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L36)

- Draws title and source text directly before rebuilding each populated two-page spread.
  [`LectureBookRenderer.ts:120`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L120)

**Pointer-safe navigation**

- Invokes visual navigation even when Phaser omits optional event data.
  [`LectureBookRenderer.ts:160`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L160)

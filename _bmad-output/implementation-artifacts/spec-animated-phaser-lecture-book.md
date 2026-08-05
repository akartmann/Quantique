---
title: 'Animate the Phaser lecture book'
type: 'feature'
created: '2026-08-05'
baseline_commit: '0b062a3db8163bca3ad85b1433293d0ef7cb7bba'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-improve-curated-record-lecture-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The locally rendered lecture is confined to a narrow HTML column, making it hard to read and visually disconnected from the laboratory. Its current presentation does not feel like an archival object in the game.

**Approach:** Present the Young lecture in the main Phaser laboratory as a generated, animated book that opens, turns pages, and closes. Keep an equivalent semantic reader and controls synchronized with the visual book so the canvas is an engaging projection, not the sole interaction or information path.

## Boundaries & Constraints

**Always:** Render a full-canvas Phaser book overlay from the immutable local English rendition; show a two-page spread, visible previous/next/close affordances, and page-turn/open/close animations that honor `prefers-reduced-motion`. Block laboratory pointer input behind the open book. Use deterministic pagination at word boundaries, retain source section IDs/page references, and keep all reading state ephemeral—never inspection evidence, progression, persistence, or domain state. Provide semantic Previous, Next, and Close controls with the same current spread and return focus to the originating Curated Record trigger.

**Ask First:** Replacing the textual rendition, adding illustrations/raster historical assets, changing the source attribution/rights status, adding audio, or making the book’s page/pagination state persistent.

**Never:** Put reading, pagination, close, focus, or accessibility authority solely in Phaser; mutate case content; fetch text at runtime; add a global browser event/listener; use physics or per-frame domain work; let clicks pass through the overlay to apparatus controls; claim opening the book inspects the source.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Open record | Player activates “Read the lecture record” | Phaser overlay animates an archival book open at the first spread; semantic reader announces and mirrors it | Reading does not inspect evidence or change phase |
| Page navigation | Phaser or semantic Previous/Next action | Both surfaces move to the same bounded spread and retain source-page references | First/last navigation is disabled or inert; no out-of-range state |
| Close record | Phaser or semantic Close action | Book closes; overlay is removed; laboratory input returns; focus returns to the original Read trigger | Repeated close/open is safe; no orphaned tweens or listeners |
| Reduced motion | OS requests reduced motion | Final book/spread state appears without decorative tweening | Pagination and close still work |
| Open overlay | Pointer targets former apparatus-control coordinates | Book consumes the interaction | Underlying semantic/Phaser controls remain unchanged |

</frozen-after-approval>

## Code Map

- `src/game/main.ts` -- Phaser game creation boundary; must expose a narrow book controller to composition.
- `src/adapters/phaser/scenes/LaboratoryScene.ts` -- owns Phaser renderer lifecycle and subscribes to store projection.
- `src/adapters/phaser/renderers/ApparatusRenderer.ts` -- existing visual laboratory and input behavior to preserve.
- `src/adapters/phaser/renderers/LectureBookRenderer.ts` -- new Phaser-only visual book/animation lifecycle.
- `src/ui/sources/lecturePagination.ts` -- pure deterministic segmentation of immutable lecture text into visual/semantic leaves.
- `src/main.ts` -- composes explicit DOM-to-Phaser and Phaser-to-DOM callbacks.
- `src/ui/sources/CuratedRecord.ts` -- maintains the authored Read trigger and its focus identity.
- `src/ui/context/CaseContextAndPrediction.ts` -- semantic current-spread reader and equivalent controls.
- `tests/unit/` and `tests/e2e/` -- pure pagination, public semantic flow, canvas overlay, input blocking, and offline coverage.

## Tasks & Acceptance

**Execution:**

- [x] `src/ui/sources/lecturePagination.ts` and unit tests -- add pure, frozen, word-boundary pagination that covers every local paragraph in order, preserves source references, and exposes bounded two-page spreads.
- [x] `src/adapters/phaser/renderers/LectureBookRenderer.ts` and `LaboratoryScene.ts` -- create/destroy a vector-paper book overlay with pointer blocking, open/turn/close tweens, visible controls, reduced-motion behavior, and no Phaser-owned domain truth.
- [x] `src/game/main.ts`, `src/main.ts`, `CuratedRecord.ts`, and `CaseContextAndPrediction.ts` -- provide narrow explicit controllers/callbacks so Read opens both projections, either surface changes the same ephemeral spread, and either Close restores input/focus safely.
- [x] `public/style.css` and focused tests -- keep the semantic spread readable and keyboard-operable while visually hiding the long reader outside its active spread; verify canvas interaction, input blocking, pagination, close/focus return, reduced-motion safety, and offline reading.

**Acceptance Criteria:**

- Given a player reads Young’s record, when they activate the existing Curated Record control, then an animated two-page book opens in the main Phaser laboratory while an equivalent semantic reader is available.
- Given either visual or semantic page controls, when a player moves forward or back, then both projections show the same valid spread with its source-page references and cannot exceed the first or final page.
- Given an open book, when a player closes it through either surface, then the overlay/tweens are fully cleaned up, apparatus interactions work again, and keyboard focus returns to the originating Read control.
- Given reduced motion or offline reload after a successful case load, when the player opens and pages the book, then reading remains local and functional without decorative motion or network access.
- Given the book is open, when a player clicks an apparatus-control coordinate beneath it, then no laboratory value changes.

## Spec Change Log

## Design Notes

Use generated Phaser shapes and text rather than a scan or texture: it keeps the object legible, local, resizable, and rights-safe. Page turns should be a short container offset/scale/alpha illusion, not a physics simulation. The semantic reader should project only the active spread, rather than the full 37-page text column, and use the same pagination helper.

## Verification

**Commands:**

- `rtk npm run typecheck` -- expected: controllers and pure pagination compile without Phaser leaking into domain code.
- `rtk npm test -- --run tests/unit/lecturePagination.test.ts tests/unit/CaseDefinition.test.ts` -- expected: all source text is ordered, immutable, and bounded into valid spreads.
- `rtk npm run test:e2e -- tests/e2e/curated-record.spec.ts tests/e2e/accessible-control.spec.ts` -- expected: public book, page, close, input-blocking, and focus journeys pass.
- `rtk npm run test:e2e:offline` -- expected: the local book can open/page/close offline after warm-up.
- `rtk npm run build` -- expected: production build completes successfully.

## Suggested Review Order

**Semantic-to-visual composition**

- Keeps the DOM as reading authority while projecting an ephemeral Phaser presentation.
  [`main.ts:69`](../../src/main.ts#L69)

- Owns shared spread state, semantic controls, focus restoration, and visual callbacks.
  [`CaseContextAndPrediction.ts:47`](../../src/ui/context/CaseContextAndPrediction.ts#L47)

**Local pagination and Phaser lifecycle**

- Creates deterministic word-bounded pages while retaining source references and immutable input.
  [`lecturePagination.ts:33`](../../src/ui/sources/lecturePagination.ts#L33)

- Renders the generated archival book, consumes pointers, and safely animates repeated close/open cycles.
  [`LectureBookRenderer.ts:50`](../../src/adapters/phaser/renderers/LectureBookRenderer.ts#L50)

- Wires renderer ownership to scene teardown and disables apparatus input beneath the overlay.
  [`LaboratoryScene.ts:18`](../../src/adapters/phaser/scenes/LaboratoryScene.ts#L18)

- Gates existing apparatus hit targets without altering laboratory state.
  [`ApparatusRenderer.ts:71`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L71)

**Regression coverage**

- Verifies page order, boundaries, and source-reference preservation without Phaser.
  [`lecturePagination.test.ts:18`](../../tests/unit/lecturePagination.test.ts#L18)

- Exercises synchronized canvas and semantic navigation, focus, motion, and input blocking.
  [`curated-record.spec.ts:34`](../../tests/e2e/curated-record.spec.ts#L34)

- Confirms locally cached content continues paging without a connection.
  [`offline-reload.spec.ts:3`](../../tests/e2e/offline-reload.spec.ts#L3)

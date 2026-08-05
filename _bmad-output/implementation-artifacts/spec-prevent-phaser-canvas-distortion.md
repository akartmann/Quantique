---
title: 'Prevent Phaser canvas distortion when semantic content grows'
type: 'bugfix'
created: '2026-08-05'
status: 'done'
baseline_commit: 'bac392f30d611ee2dabc1af0b0ffe442bbb6d845'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Adding or expanding semantic content in the left laboratory column causes the Phaser laboratory surface on the right to become vertically stretched. The distorted display makes the apparatus hard to read and means its visual geometry no longer matches the authored 1024×768 renderer.

**Approach:** Keep the right-side laboratory canvas sized from its intrinsic 4:3 dimensions rather than the grid row’s height, and lock that behavior down with a browser-level regression test that exercises the populated Curated Record view.

## Boundaries & Constraints

**Always:** Preserve the existing two-column desktop layout, its single-column layout at 720px and below, the 1024×768 Phaser renderer, and the semantic HTML/Phaser separation. The correction must preserve visual 4:3 proportions without changing authoritative state, gameplay, scene lifecycle, semantic controls, touch/keyboard behavior, accessibility labels, or printed output. Pointer and touch calculations must continue to use the canvas’s actual rendered bounds.

**Ask First:** Halt for approval before changing Phaser game dimensions, adding a Phaser scale manager/responsive rendering mode, redesigning the page grid, or altering the stated tablet/phone behavior.

**Never:** Do not move Curated Record content into Phaser, hide or truncate semantic content to control the grid height, add fixed viewport-height sizing that crops content, relax existing interaction coverage, change authored case data, or introduce dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Populated desktop laboratory | A 1280px desktop viewport with the Curated Record and other semantic panels rendered in the left grid column | The visible Phaser canvas remains within the right column and its rendered width-to-height ratio is 4:3, regardless of the taller shared grid row | No runtime error or visual clipping; semantic content remains fully scrollable/readable |
| Existing canvas interaction | Desktop pointer/touch coordinates calculated from the canvas’s displayed bounding box | The existing apparatus gesture continues to dispatch the same state change | Preserve existing public control/readout assertions |
| Narrow layout | Viewport at or below the existing 720px breakpoint | The semantic column and laboratory surface remain sequential; the canvas retains its native aspect ratio and existing phone read-only behavior | Preserve current disabled semantic control and no-op canvas gesture behavior |

</frozen-after-approval>

## Code Map

- `index.html` — The semantic laboratory shell and `#game-container` are sibling grid items, so tall left-side content participates in the same grid row as Phaser.
- `public/style.css` — Defines the desktop grid, narrow breakpoint, game container, and the current forced width/height canvas rules that stretch its axes independently.
- `src/game/main.ts` — Creates the fixed-size 1024×768 Phaser canvas whose intrinsic 4:3 ratio must be respected by CSS.
- `tests/e2e/accessible-control.spec.ts` — Exercises desktop pointer, touch, and phone controls through public elements; extend it with a focused visual-proportion assertion.

## Tasks & Acceptance

**Execution:**

- [x] `public/style.css` — Prevent `#game-container` from stretching to the height of its left-side grid sibling and size its nested canvas from width while retaining its intrinsic height ratio. Keep the desktop and narrow-breakpoint grid rules, the 20rem minimum laboratory area, and print behavior intact.
- [x] `tests/e2e/accessible-control.spec.ts` — Add a desktop regression assertion that obtains the visible canvas bounding box after the semantic Curated Record is populated and verifies its displayed ratio matches 1024:768. Retain the existing pointer, touch, and phone assertions as interaction regressions.

**Acceptance Criteria:**

- Given the laboratory at a desktop viewport with the Curated Record rendered, when its left-hand column is taller than the native Phaser canvas, then the visible canvas remains 4:3 and no text/content is cropped.
- Given a pointer or touch action is calculated from the displayed canvas bounds, when the user activates the existing apparatus affordance, then the same normalized semantic control and readout update occur.
- Given a viewport at or below 720px, when the page switches to its sequential layout, then the canvas remains proportionate and the current phone read-only apparatus behavior is unchanged.

## Spec Change Log

## Design Notes

The grid controls sibling placement; it should not control the renderer’s vertical scaling. The canvas already has an intrinsic 1024×768 ratio from Phaser, so CSS should be width-driven and allow its height to resolve automatically. Aligning the game container to the start of the shared grid row removes the height source that turned extra semantic content into canvas distortion. This is deliberately a CSS layout correction, not a Phaser rendering change.

## Verification

**Commands:**

- `npm run typecheck` — expected: TypeScript completes without errors.
- `npm test` — expected: all unit and integration tests pass unchanged.
- `npm run build` — expected: Vite creates a production build successfully.
- `npm run test:e2e` — expected: Chromium passes the aspect-ratio regression plus existing public interaction coverage.

**Manual checks:**

- At a desktop viewport, inspect the laboratory with both Curated Record cards present; the Phaser labels and apparatus must look normally proportioned while the left column may be taller.
- At the 720px breakpoint and a phone-sized viewport, confirm sequential reading order, proportional canvas, and the existing read-only semantic control message.

## Suggested Review Order

**Canvas sizing**

- Decouples the canvas from the grid row height while preserving its intrinsic dimensions.
  [`style.css:172`](../../public/style.css#L172)

**Regression coverage**

- Recreates a taller semantic column and proves the displayed laboratory remains 4:3.
  [`accessible-control.spec.ts:26`](../../tests/e2e/accessible-control.spec.ts#L26)

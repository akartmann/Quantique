/**
 * The design surface every scene is laid out in, stated once (Story 2.8, AC7).
 *
 * `src/game/main.ts` builds the Phaser config from these, and each scene reads its own `scale` — so at
 * runtime nothing restates them. What was still restating them was the **specs**: `canvas-transitions`
 * carried `DESIGN_WIDTH`/`DESIGN_HEIGHT` literals of its own to map a design coordinate onto the live
 * canvas, and `deferred-work.md` has tracked that half of the "unlinked coordinate" item since the 2.5
 * review. A spec cannot import `game/main.ts` — it constructs a `Phaser.Game`, and Phaser touches
 * `window` at import time in Node — so the numbers live here, in a module with no imports at all, and
 * both sides read them.
 *
 * These are a fixed `Scale.FIT` surface, not a viewport. The canvas is letterboxed into whatever the
 * browser window is; a click in a browser test is mapped through the live bounding box, never assumed.
 */
export const DESIGN_WIDTH = 1024;
export const DESIGN_HEIGHT = 768;

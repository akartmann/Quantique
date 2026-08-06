/**
 * The routing shell's layout, in its own module so a test can read it (Story 2.7).
 *
 * **This exists because `PhasePlaceholderScene` extends `Phaser.Scene`** — it imports Phaser as a
 * value by definition, Phaser touches `window` at import time, and both Vitest and the Playwright
 * specs run in Node. A spec that imported the scene to derive a click target would fail on the import
 * rather than the assertion. `apparatusGeometry.ts` exists for the same reason and set the precedent.
 *
 * Splitting the numbers out keeps the project rule intact — "never assert a magic number that a test
 * shares with source unless both read one exported constant" — without a Phaser-free refactor of a
 * class whose whole purpose is to be a Phaser scene.
 */

import { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH, advanceControlCentre } from '../ui/AdvanceControl';

/** Between the centred development marker and the control below it. */
export const PLACEHOLDER_CONTROL_TOP_GAP = 60;
/** Between the control and the refusal message beneath it. */
export const PLACEHOLDER_MESSAGE_TOP_GAP = 14;
export const PLACEHOLDER_MESSAGE_FONT_SIZE = 14;
export const PLACEHOLDER_MESSAGE_WRAP = 560;

/**
 * The design-space centre of the shell's advance control, so a browser spec can click it without
 * restating the layout.
 *
 * Takes the canvas size rather than closing over 1024×768: the scene reads its own `scale`, and the
 * rule this story must not be the first to break is that `768` and `1024` are read from `scene.scale`
 * and never written as literals.
 */
export const placeholderAdvanceControlCentre = (
    canvasWidth: number,
    canvasHeight: number
): Readonly<{ x: number; y: number }> => advanceControlCentre({
    x: (canvasWidth - ADVANCE_CONTROL_WIDTH) / 2,
    y: (canvasHeight / 2) + PLACEHOLDER_CONTROL_TOP_GAP,
    width: ADVANCE_CONTROL_WIDTH,
    height: ADVANCE_CONTROL_HEIGHT
});

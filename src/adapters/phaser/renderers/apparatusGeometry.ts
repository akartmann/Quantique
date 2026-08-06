/**
 * The laboratory's side-column geometry (Story 2.6), in its own module so a browser test can read it.
 *
 * **This exists because `ApparatusRenderer` imports Phaser as a value** — `BlendModes`, for the
 * additive blending on the beam and wavefront graphics — and it is the only renderer that does.
 * Phaser touches `window` at import time and Playwright specs run in Node, so a spec that imported
 * the renderer to derive a click target would fail on the import rather than the assertion. The
 * other renderers get away with exporting their own constants only because they import `Scene` as a
 * type. Splitting the numbers out keeps the project rule intact — "never assert a magic number that
 * a test shares with source unless both read one exported constant" — without a Phaser-free
 * refactor of the whole renderer.
 *
 * A column rather than a band, because the laboratory has no spare horizontal strip: `lab.title` and
 * `lab.guide` wrap to x=940 across the top, the painted apparatus runs to the screen at x≈612,
 * `resultReadout` and `visualGuidance` both wrap 620px from x=40 and end at 660, and the two control
 * rows occupy x=40–560 from y≈578 down. x≥680 below the guide is what is left.
 */

export const SIDE_COLUMN_LEFT = 680;
export const SIDE_COLUMN_WIDTH = 304;

export const ADVANCE_CONTROL_Y = 130;
export const ADVANCE_CONTROL_HEIGHT = 40;
export const ADVANCE_CONTROL_PADDING = 12;
export const ADVANCE_CONTROL_FONT_SIZE = 15;
export const ADVANCE_CONTROL_LABEL_WRAP = SIDE_COLUMN_WIDTH - (2 * ADVANCE_CONTROL_PADDING);

/** Between the hint's last line and the canvas floor. */
export const HINT_BOTTOM_MARGIN = 24;
/** Between the attributed speaker line and the hint prose under it. */
export const HINT_SPEAKER_GAP = 4;
export const HINT_PADDING = 12;
export const HINT_LINE_FONT_SIZE = 14;
export const HINT_SPEAKER_FONT_SIZE = 13;
export const HINT_TEXT_WRAP = SIDE_COLUMN_WIDTH - (2 * HINT_PADDING);

/**
 * The design-space centre of the control that leaves the laboratory, so a browser test can click it
 * without restating the column's gutters.
 *
 * Fixed rather than measured: it is anchored to the top of the side column, which nothing measured
 * pushes around. The hint below it is the piece that moves, and it grows *upward* from the floor.
 */
export const advanceToSynthesisControlCentre = (): Readonly<{ x: number; y: number }> => ({
    x: SIDE_COLUMN_LEFT + (SIDE_COLUMN_WIDTH / 2),
    y: ADVANCE_CONTROL_Y + (ADVANCE_CONTROL_HEIGHT / 2)
});

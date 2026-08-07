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
 * What is left here after Story 2.7 is the *placement* — where the laboratory puts a control that
 * every other scene also has. The control's own dimensions moved into `ui/AdvanceControl.ts` and are
 * re-exported below, so there is one set of numbers rather than two that agree by coincidence.
 *
 * A column rather than a band, because the laboratory has no spare horizontal strip: `lab.title` and
 * `lab.guide` wrap to x=940 across the top, `resultReadout` and `visualGuidance` both wrap 620px from
 * x=40 and end at 660, and the two control rows occupy x=40–560 from y≈578 down. x≥680 is what is
 * left — but only *below* the apparatus, which is the correction below.
 */

// `ADVANCE_CONTROL_HEIGHT` is imported as well as re-exported below: a bare `export … from` re-export
// does not bind the name locally, and the reference shelf's placement is derived from it.
import { ADVANCE_CONTROL_HEIGHT, advanceControlCentre, advanceControlLabelWrap } from '../ui/AdvanceControl';

/** The painted apparatus, in the same design space, so the column can be placed clear of it. */
export const CENTRE_Y = 200;
export const SCREEN_HALF_HEIGHT = 108;
export const SCREEN_BAR_HALF_WIDTH = 7;
/** The interference screen's baseline label, drawn under the bar. */
export const SCREEN_LABEL_Y = 322;
export const SCREEN_LABEL_HEIGHT = 20;

/**
 * Where the interference screen stands for a given throw.
 *
 * Here rather than in the renderer because the column's placement depends on it and a browser test
 * has to be able to check that they do not collide. It is pure arithmetic over an authored control
 * value; nothing about it needs Phaser.
 */
export const screenXForDistance = (screenDistanceM: number): number => 480 + ((screenDistanceM - 1) / 3) * 220;

export const SIDE_COLUMN_LEFT = 680;
export const SIDE_COLUMN_WIDTH = 304;

/**
 * The control's own geometry now belongs to the widget that draws it (Story 2.7) — every phase's
 * scene carries one, so its height, padding, and type size stopped being the laboratory's business.
 * Re-exported here so the specs and the renderer that already read them keep reading **one** constant
 * rather than a copy that could drift from the widget.
 */
export {
    ADVANCE_CONTROL_FONT_SIZE,
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_PADDING
} from '../ui/AdvanceControl';

/**
 * Below the apparatus, not beside it.
 *
 * This was 130 and it was wrong (review, 2026-08-06). The screen slides right with the throw —
 * `screenXForDistance(4) = 700`, so at the two longest authored distances the bar occupies x 693–707
 * and its label reaches y≈342, both inside a column that starts at x=680. An opaque control at y=130
 * painted a 40px band straight across the interference pattern the player is there to measure, and
 * swallowed pointer events over it into a phase advance. `createSideColumn()` runs after
 * `createRichPattern()`, so it was unambiguously on top. Reachable in normal play: the authored hints
 * ask the player to slide the screen back.
 *
 * 360 clears the screen bar (y≤308) and its label (y≤342) with room to spare, at every authored
 * distance. `apparatusGeometry.test.ts` pins the invariant rather than trusting this comment.
 *
 * Still a constant rather than a measurement, but now with a rationale that survives inspection: the
 * only thing above it in this column is `lab.guide` at y=62, and at 15px it would need roughly
 * fifteen wrapped lines to reach here. The *hint* below is the piece that genuinely moves, and it is
 * measured and grows upward from the floor.
 */
export const ADVANCE_CONTROL_Y = 360;
/** The laboratory's control fills the column, so its label bound is wider than the widget's default. */
export const ADVANCE_CONTROL_LABEL_WRAP = advanceControlLabelWrap(SIDE_COLUMN_WIDTH);

/**
 * The reference shelf in the side column (Story 2.8, Task 6 / AC6).
 *
 * The book has to stay reachable from the bench for re-reading during `experiment` — that is what the
 * retired always-on overlay was buying, and retiring it without replacing the affordance would take
 * the reference away rather than move it. So the laboratory owns a presenter of its own and a small
 * chooser over the case's artifacts.
 *
 * **Reading here dispatches nothing and changes no progression.** Paging and closing stay ephemeral,
 * exactly as the archival-book rule in `project-context.md` requires. The *record* of having read a
 * source is made in the reading room; the bench only re-opens what is already on the shelf.
 *
 * The controls are **not** fixed-height. Their labels are authored artifact display names, not
 * interface strings — "Le compte rendu de la conférence de Thomas Young de 1801" is 55 characters and
 * wraps to two lines at this width where its English counterpart fits on one — so each control is
 * sized to its own measured label and the next is stacked under the previous one's measured bottom.
 * A fixed height here would clip the French, which is the defect class the per-token typography sweep
 * provably cannot catch.
 */
export const REFERENCE_HEADING_GAP = 28;
export const REFERENCE_HEADING_FONT_SIZE = 13;
export const REFERENCE_HEADING_GAP_BELOW = 10;
export const REFERENCE_CONTROL_FONT_SIZE = 13;
export const REFERENCE_CONTROL_PADDING = 10;
export const REFERENCE_CONTROL_GAP = 8;

/** Where the reference shelf's heading sits: under the way out, never over the apparatus above it. */
export const REFERENCE_HEADING_Y = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT + REFERENCE_HEADING_GAP;

/** The bound a reference label wraps to, derived from the column rather than restated. */
export const REFERENCE_CONTROL_LABEL_WRAP = SIDE_COLUMN_WIDTH - (2 * REFERENCE_CONTROL_PADDING);

/**
 * Room kept clear between the lowest reference control and the tallest hint the content schema
 * permits: four wrapped lines at {@link HINT_LINE_FONT_SIZE} over an attributed speaker line, plus the
 * panel's own padding top and bottom.
 */
export const REFERENCE_SHELF_HINT_CLEARANCE = 120;

/** Between the hint's last line and the canvas floor. */
export const HINT_BOTTOM_MARGIN = 24;

/**
 * The ceiling the reference shelf must not grow past.
 *
 * The colleague's hint grows *upward* from the canvas floor and the shelf grows *downward* from the
 * control above it, so the two approach each other. This is the line where the renderer stops adding
 * controls — measured against the same floor margin the hint uses, so the two cannot be changed apart.
 */
export const referenceShelfFloor = (canvasHeight: number): number =>
    canvasHeight - HINT_BOTTOM_MARGIN - REFERENCE_SHELF_HINT_CLEARANCE;
/** Between the attributed speaker line and the hint prose under it. */
export const HINT_SPEAKER_GAP = 4;
export const HINT_PADDING = 12;
export const HINT_LINE_FONT_SIZE = 14;
export const HINT_SPEAKER_FONT_SIZE = 13;
export const HINT_TEXT_WRAP = SIDE_COLUMN_WIDTH - (2 * HINT_PADDING);

/**
 * The design-space centre of the control that leaves the laboratory, so a browser test can click it
 * without restating the column's gutters.
 */
export const advanceToSynthesisControlCentre = (): Readonly<{ x: number; y: number }> =>
    advanceControlCentre({ x: SIDE_COLUMN_LEFT, y: ADVANCE_CONTROL_Y, width: SIDE_COLUMN_WIDTH });

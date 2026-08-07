/**
 * The reading room's layout, in its own module so a test can read it (Story 2.8).
 *
 * **Phaser is not imported here at all** — not even as a type. `LibraryScene` extends `Phaser.Scene`
 * and `LibraryRenderer` builds display objects, so both import Phaser as a value; Phaser touches
 * `window` at import time and both Vitest and the Playwright specs run in Node. A spec that imported
 * either to derive a click target would fail on the import rather than the assertion.
 * `apparatusGeometry.ts` and `phasePlaceholderGeometry.ts` exist for the same reason and set the
 * precedent; this is the third.
 *
 * **Every function takes the canvas size.** Nothing here closes over `1024` or `768` (AC7): the scene
 * reads its own `scale` and passes it down, so the design dimensions are stated once, by Phaser's
 * config, and never restated in a renderer or a spec.
 *
 * ## Why the bands are where they are
 *
 * The canvas is a fixed `Scale.FIT` surface that does not scroll, so a surface that outgrows its band
 * is a defect rather than a responsive state. The room is four horizontal bands, stacked and disjoint,
 * and the two that can grow are anchored to the *floor* rather than to a constant above them — which
 * is the defect the 1.11, 1.12, 2.5, 2.6 and 2.7 reviews each found in a different scene:
 *
 * 1. **The shelf** holds one object per contextual artifact. Its top is a constant because the only
 *    thing above it is the room's two-line heading, which at 22px and 15px cannot reach it.
 * 2. **The reading surface** carries the detail panel for the focused artifact.
 * 3. **The advance control**, and
 * 4. **the gate line** below it, are both measured *up from the canvas floor*. French prose runs
 *    15–25% longer than English and the colleague's line is the longest unbounded string in the room,
 *    so it gets the reserved band and the control sits above it — never the reverse, which would let a
 *    two-line French line push the control off the bottom of a surface that cannot scroll.
 */

import { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH } from '../ui/AdvanceControl';

/** A rectangle in design space, top-left anchored — the shape every band and object comes back as. */
export type LibraryRect = Readonly<{ x: number; y: number; width: number; height: number }>;

// --- The shelf ----------------------------------------------------------------------------------

/**
 * How far every band sits in from the canvas edge.
 *
 * One inset for the whole room, not one per band: the shelf, the reading surface, and the colleague's
 * line are a single composition, and a band that started at a different x would read as a separate
 * panel that had wandered in. Named for the shelf because that is the band that establishes it.
 *
 * It is also, by construction, the depth of the wall bays either side — see
 * {@link libraryLeftBayBand}. The room used to sit 76px in and the margin was empty; widening it is
 * what gave the shelving behind the furniture somewhere to be. The per-token French sweep in
 * `french-typography.spec.ts` measures against bounds derived from this number, so narrowing the room
 * made that check stricter rather than looser.
 */
export const SHELF_INSET = 118;
/** Clear of the heading (22px) and the guide line (15px) above it, with room for both to wrap once. */
export const SHELF_TOP = 104;
export const SHELF_HEIGHT = 232;
/** Between the shelf's own edge and the first object standing on it. */
export const SHELF_ROW_INSET = 24;
/**
 * Between the shelf's top edge and the top of an object standing on it.
 *
 * Chosen so a reference's *foot* lands exactly on {@link libraryCasePlank}: `SHELF_TOP_INSET +
 * ARTIFACT_HEIGHT` equals `SHELF_HEIGHT - CASE_PLANK_HEIGHT`. Books that float above the plank they
 * are drawn standing on is the single tell that gives away a room made of rectangles, and it is worth
 * the two constants being chosen together rather than independently.
 */
export const ARTIFACT_TOP_INSET = 34;
export const ARTIFACT_HEIGHT = 182;
export const ARTIFACT_GAP = 28;
/**
 * A single artifact does not become a slab the width of the shelf.
 *
 * The bound is what makes the row read as objects on furniture rather than as a filled band, and it
 * is the reason placement centres the row rather than stretching it. Young ships two; a later case
 * with one must not look like a different room.
 */
export const ARTIFACT_MAX_WIDTH = 300;
/**
 * The spine, which is also what the title plaque is centred against.
 *
 * It lives here rather than with the renderer's other binding constants because the *label* has to be
 * centred on the front board, and the board is "the placement, less the spine". Two modules needing
 * one number means the number has one home.
 */
export const ARTIFACT_SPINE_WIDTH = 30;

/**
 * The readable title plaque, laid onto the middle of the front board like a bookplate.
 *
 * It sat at the foot of the volume until the author review: a strip along the bottom edge reads as a
 * caption stuck underneath a picture, where a panel inset into the middle of the board reads as part
 * of the binding. Diegetic never means hidden either way — the title is on the object at full size in
 * both, and this is only about which one looks bound on.
 *
 * The box holds the shipped French title's two wrapped lines with a third line's clearance spare, so
 * a case with a longer name grows into the plaque instead of clipping against it.
 */
export const ARTIFACT_LABEL_HEIGHT = 48;
/** Between the text box and the plaque's own edge. */
export const ARTIFACT_LABEL_PADDING = 10;
/**
 * Between the plaque's edge and the hinge on one side, the fore-edge on the other.
 *
 * Wide enough that the gilt rules and the read ribbon have somewhere to be: a plaque run out to the
 * full width of the board leaves the binding's own detailing nowhere, and the ribbon ends up pinched
 * into a gap too narrow to read.
 */
export const ARTIFACT_LABEL_INSET = 22;
/**
 * Where the plaque's middle sits down the board, as a fraction of the volume's height.
 *
 * Slightly above the geometric centre, because a panel placed at exactly half sits visibly low —
 * optical centring is a real effect, and every bound volume in the reference photographs shows it.
 */
export const ARTIFACT_LABEL_CENTRE_FRACTION = 0.46;

// --- The reading surface and its detail panel -----------------------------------------------------

/** Between the shelf's lower edge and the reading surface below it. */
export const DETAIL_TOP_GAP = 24;
/** Between the detail panel's lower edge and the advance control below it. */
export const DETAIL_BOTTOM_GAP = 20;
export const DETAIL_PADDING = 20;

// --- The advance control and the gate line --------------------------------------------------------

/** Between the advance control and the gate line's reserved band under it. */
export const ADVANCE_GAP_ABOVE_GATE = 16;

/**
 * The control's own dimensions belong to the widget that draws it, and are re-exported rather than
 * restated — the same arrangement `apparatusGeometry.ts` makes, and for the same reason: a second copy
 * that agreed by coincidence is exactly the drift the project rule about shared magic numbers exists
 * to prevent. `AdvanceControl.ts` imports Phaser as a *type* only, so reading it here keeps this module
 * importable from Node.
 */
export { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH } from '../ui/AdvanceControl';

/**
 * The clearance reserved for the colleague's line, measured up from the canvas floor.
 *
 * Sized for the worst case the content schema permits rather than for the shipped copy: a
 * `readingGateHint` line is capped at 320 characters per locale, which at
 * {@link GATE_LINE_FONT_SIZE} wrapped to {@link gateLineTextWrap} is three lines, over an attributed
 * speaker line, a {@link GATE_SPEAKER_GAP}, and {@link GATE_PADDING} at the top and the foot.
 *
 * 118px, not the 108 this shipped with. The 2.8 review recomputed the reserve against what
 * `renderGate` actually spends and found the band 3px short of its own stated worst case — the test
 * guarding it had omitted both paddings and the speaker gap, so it demanded 75px and passed. 118 holds
 * the schema maximum at the authored size *and* the clamped maximum under a two-line French
 * attribution, with 6px still clear of the advance control above.
 *
 * `LibraryRenderer.clampGateLine` shrinks to {@link GATE_LINE_MIN_FONT_SIZE} and then crops, so the
 * band is a guarantee rather than an estimate even past that: this canvas does not scroll, and the
 * alternative is authored prose painting over the way out of the room.
 */
export const GATE_BAND_HEIGHT = 118;
export const GATE_BOTTOM_MARGIN = 20;
export const GATE_PADDING = 16;
export const GATE_LINE_FONT_SIZE = 14;
/** The floor `clampGateLine` shrinks to before it crops instead. */
export const GATE_LINE_MIN_FONT_SIZE = 11;
export const GATE_SPEAKER_FONT_SIZE = 13;
/** Between the attributed speaker line and the prose under it. */
export const GATE_SPEAKER_GAP = 4;
/**
 * Everything the renderer spends inside the band before the colleague's prose starts, plus the foot
 * padding under it: `GATE_PADDING` at the top, the attributed speaker line, `GATE_SPEAKER_GAP`, and
 * `GATE_PADDING` again at the bottom. Exported so the band's clearance test measures what the renderer
 * actually does rather than a looser model of it.
 */
export const gateLineChromeHeight = (speakerLines = 1): number =>
    (2 * GATE_PADDING) + (Math.ceil(GATE_SPEAKER_FONT_SIZE * 1.35) * speakerLines) + GATE_SPEAKER_GAP;

// --- Bands ----------------------------------------------------------------------------------------

export const libraryShelfBand = (canvasWidth: number): LibraryRect => Object.freeze({
    x: SHELF_INSET,
    y: SHELF_TOP,
    width: canvasWidth - (2 * SHELF_INSET),
    height: SHELF_HEIGHT
});

/** The band's own width, so the wrap bound below does not have to invent a canvas height to read it. */
const gateLineBandWidth = (canvasWidth: number): number => canvasWidth - (2 * SHELF_INSET);

export const libraryGateLineBand = (canvasWidth: number, canvasHeight: number): LibraryRect => Object.freeze({
    x: SHELF_INSET,
    y: canvasHeight - GATE_BOTTOM_MARGIN - GATE_BAND_HEIGHT,
    width: gateLineBandWidth(canvasWidth),
    height: GATE_BAND_HEIGHT
});

/** The bound the gate line's prose wraps to, derived from its band rather than restated. */
export const gateLineTextWrap = (canvasWidth: number): number =>
    gateLineBandWidth(canvasWidth) - (2 * GATE_PADDING);

/** Top-left bounds, as {@link AdvanceControl} takes them. Sits above the gate band, never over it. */
export const libraryAdvanceControlBounds = (canvasWidth: number, canvasHeight: number): LibraryRect => Object.freeze({
    x: (canvasWidth - ADVANCE_CONTROL_WIDTH) / 2,
    y: libraryGateLineBand(canvasWidth, canvasHeight).y - ADVANCE_GAP_ABOVE_GATE - ADVANCE_CONTROL_HEIGHT,
    width: ADVANCE_CONTROL_WIDTH,
    height: ADVANCE_CONTROL_HEIGHT
});

/** The design-space centre of the control that leaves the room, so a browser spec can click it. */
export const libraryAdvanceControlCentre = (
    canvasWidth: number,
    canvasHeight: number
): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = libraryAdvanceControlBounds(canvasWidth, canvasHeight);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

/**
 * The reading surface, filling everything between the shelf and the advance control.
 *
 * Derived from its neighbours in both directions rather than given a height of its own: it is the
 * band that absorbs the slack, so a change to the shelf or to the reserved gate clearance moves it
 * automatically instead of leaving a gap or an overlap nobody measured.
 */
export const libraryReadingSurfaceBand = (canvasWidth: number, canvasHeight: number): LibraryRect => {
    const shelf = libraryShelfBand(canvasWidth);
    const top = shelf.y + shelf.height + DETAIL_TOP_GAP;
    const bottom = libraryAdvanceControlBounds(canvasWidth, canvasHeight).y - DETAIL_BOTTOM_GAP;
    return Object.freeze({ x: SHELF_INSET, y: top, width: canvasWidth - (2 * SHELF_INSET), height: bottom - top });
};

/** The detail panel, inset on the reading surface. */
export const libraryDetailPanelBand = (canvasWidth: number, canvasHeight: number): LibraryRect => {
    const surface = libraryReadingSurfaceBand(canvasWidth, canvasHeight);
    return Object.freeze({
        x: surface.x + DETAIL_PADDING,
        y: surface.y + DETAIL_PADDING,
        width: surface.width - (2 * DETAIL_PADDING),
        height: surface.height - (2 * DETAIL_PADDING)
    });
};

/** The bound the detail panel's text wraps to, derived from the panel rather than restated. */
export const detailTextWrap = (canvasWidth: number, canvasHeight: number): number =>
    libraryDetailPanelBand(canvasWidth, canvasHeight).width - (2 * DETAIL_PADDING);

// --- Objects on the shelf ---------------------------------------------------------------------------

/**
 * One rectangle per artifact, laid out across the shelf as a centred row.
 *
 * **Total and deterministic for any count ≥ 1.** The width divides the shelf's inner span between the
 * objects and their gutters, then clamps to {@link ARTIFACT_MAX_WIDTH}; the row is centred on whatever
 * that leaves. So two objects and four objects are the same room with different furniture, and no
 * count produces an overlap or an object outside the shelf.
 *
 * `count <= 0` returns an empty list rather than dividing by zero. Shipped content cannot reach it —
 * `contextualArtifacts` is a two-tuple in both the type and the schema — but a renderer mapping over
 * a list should not have to know that.
 */
export const libraryArtifactPlacements = (count: number, canvasWidth: number): readonly LibraryRect[] => {
    if (count <= 0) return Object.freeze([]);
    const shelf = libraryShelfBand(canvasWidth);
    const span = shelf.width - (2 * SHELF_ROW_INSET);
    const width = Math.min(ARTIFACT_MAX_WIDTH, (span - (ARTIFACT_GAP * (count - 1))) / count);
    const rowWidth = (width * count) + (ARTIFACT_GAP * (count - 1));
    const left = shelf.x + ((shelf.width - rowWidth) / 2);
    const y = shelf.y + ARTIFACT_TOP_INSET;

    return Object.freeze(Array.from({ length: count }, (_unused, index) => Object.freeze({
        x: left + (index * (width + ARTIFACT_GAP)),
        y,
        width,
        height: ARTIFACT_HEIGHT
    })));
};

/** The design-space centre of one object, so a browser spec can pick it up without restating a gutter. */
export const libraryArtifactCentre = (
    index: number,
    count: number,
    canvasWidth: number
): Readonly<{ x: number; y: number }> | undefined => {
    const placement = libraryArtifactPlacements(count, canvasWidth)[index];
    if (!placement) return undefined;
    return Object.freeze({ x: placement.x + (placement.width / 2), y: placement.y + (placement.height / 2) });
};

/**
 * The box the title is *typeset* in — the plaque drawn around it is this grown by
 * {@link ARTIFACT_LABEL_PADDING} on every side.
 *
 * Returning the text box rather than the plaque is deliberate: `french-typography.spec.ts` measures
 * French tokens against `libraryArtifactLabelBand(…).width`, and if this returned the plaque, that
 * check would be running against a bound wider than the one the text actually wraps to — passing
 * while the title clipped. This is the tightest wrap bound in the game, so it is the one place that
 * distinction has real teeth.
 *
 * Centred on the **front board**, not on the whole volume: the spine is not somewhere a bookplate
 * goes, and a plaque centred over it sits visibly off to the left of the panel it is meant to fill.
 */
export const libraryArtifactLabelBand = (placement: LibraryRect): LibraryRect => {
    const boardWidth = placement.width - ARTIFACT_SPINE_WIDTH;
    const margin = ARTIFACT_LABEL_INSET + ARTIFACT_LABEL_PADDING;
    return Object.freeze({
        x: placement.x + ARTIFACT_SPINE_WIDTH + margin,
        // `Math.max` so a case with enough references to make the boards very narrow still yields a
        // positive box. Unreachable with shipped content; a renderer mapping over a list should not
        // have to know that.
        width: Math.max(1, boardWidth - (2 * margin)),
        y: placement.y + (placement.height * ARTIFACT_LABEL_CENTRE_FRACTION) - (ARTIFACT_LABEL_HEIGHT / 2),
        height: ARTIFACT_LABEL_HEIGHT
    });
};

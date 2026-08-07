/**
 * The debrief's layout, in its own module so a test and a browser spec can read it (Story 2.11).
 *
 * **Phaser is not imported here at all** — not even as a type. `DebriefScene` extends `Phaser.Scene`
 * and `DebriefRenderer` builds display objects, so both import Phaser as a value; Phaser touches
 * `window` at import time and both Vitest and the Playwright specs run in Node. A spec that imported
 * either to derive a click target would fail on the import rather than the assertion.
 * `apparatusGeometry.ts` and `libraryGeometry.ts` set the precedent; this is the next one.
 *
 * **Every function takes the canvas size.** Nothing here closes over `1024` or `768`: the scene reads
 * its own `scale` and passes it down, so the design dimensions are stated once, by Phaser's config,
 * and never restated in a renderer or a spec.
 *
 * ## The shape, and why it is this one
 *
 * ```
 *  heading
 *  ┌──────────────────────────────┬─────────────────┐
 *  │ summary                      │ recognition     │
 *  │ historical comparison        │                 │
 *  │ cited sources                │                 │
 *  └──────────────────────────────┴─────────────────┘
 *   deeper-theory strip                              ← always visible, full width
 *  ┌──────────────────────────────────────────────────┐
 *  │ the lower band                                   │ ← the challenges, or the deeper theory
 *  └──────────────────────────────────────────────────┘
 *              replay control
 *          counterfactual warning
 * ```
 *
 * The canvas is a fixed `Scale.FIT` surface that does not scroll, so a surface that outgrows its band
 * is a defect rather than a responsive state — and the debrief carries more prose than any other room
 * in the game. The budget is what decided the shape, and it was measured rather than guessed:
 *
 * - The **floor stack** is measured up from the canvas floor — the counterfactual warning first, the
 *   replay control above it. `libraryGeometry` does the same, because seven consecutive reviews found
 *   an object placed against a constant while the object above it grew with French copy, and a
 *   control pushed off a surface that cannot scroll is the way out of the room disappearing.
 * - That leaves **572 design pixels** between the heading and the control at 1024×768. The left
 *   column's three reserves spend 376 of them and the recognition band fits beside them in 326, so
 *   the columns cost 376 and the toggle strip 36.
 * - The **132 that remain** are the lower band, and they are the reason it is *shared*. A shipped
 *   French `rivalLab.critiques[].line` is up to 404 characters — three lines at
 *   {@link debriefLowerTextWrap} across the full room width, and seven in a 336px column. The
 *   challenge history and the deeper theory therefore each need the full width, and what the band has
 *   under its own heading row holds one of them, not both — four lines of prose at
 *   {@link DEBRIEF_BODY_FONT_SIZE}, or an attribution over three lines of objection at
 *   {@link DEBRIEF_CRITIQUE_FONT_SIZE}. Neither is being read at the same time as the other, so the
 *   band shows the challenges by default and the deeper theory while the player has it open. That is
 *   a disclosure the player drives, not content silently overflowing. (The shipped French deeper
 *   theory is 245 characters — two lines — so the reserve is double what today's content needs, and
 *   the clamp holds anything past it.)
 * - The challenges are **paged, one at a time**, for the same reason: three lines at full width is a
 *   readable objection and a seventh of one is not. `NotebookRenderer` established paging here.
 *
 * Every reserve above the lower band is a stated worst case that the renderer clamps into — shrink to
 * {@link DEBRIEF_MIN_FONT_SIZE}, then crop — because the content schema puts **no `.max()`** on
 * `debrief.summary`, `historicalComparison.text`, `deeperTheory.text`, `replayLabel` or a critique
 * line. "The shipped copy fits" is a property of today's `case.json` and not a guarantee. The band is
 * the guarantee; the clamp is how it is kept.
 */

import { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH } from '../ui/AdvanceControl';

/** A rectangle in design space, top-left anchored — the shape every band comes back as. */
export type DebriefRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/**
 * The control's own dimensions belong to the widget that draws it, and are re-exported rather than
 * restated — the same arrangement `libraryGeometry.ts` makes, and for the same reason: a second copy
 * that agreed by coincidence is exactly the drift the project rule about shared magic numbers exists
 * to prevent. `AdvanceControl.ts` imports Phaser as a *type* only, so reading it here keeps this
 * module importable from Node.
 */
export { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH } from '../ui/AdvanceControl';

// --- The room ---------------------------------------------------------------------------------------

/** How far every band sits in from the canvas edge. One inset for the whole room. */
export const DEBRIEF_ROOM_INSET = 40;
export const DEBRIEF_TOP_MARGIN = 16;
/** One line of a French room heading at {@link DEBRIEF_HEADING_FONT_SIZE}, with clearance under it. */
export const DEBRIEF_HEADING_HEIGHT = 30;
/** Between the heading and the first band under it. */
export const DEBRIEF_HEADING_GAP = 8;
/** Between any two stacked bands. */
export const DEBRIEF_BAND_GAP = 14;
/** Between a band's own edge and the text inside it. */
export const DEBRIEF_BAND_PADDING = 12;
/** Between a section's title and the prose under it. */
export const DEBRIEF_TITLE_GAP = 6;
/** Between two rows inside the cited-sources or recognition band. */
export const DEBRIEF_ROW_GAP = 4;

/**
 * The right column's width is fixed and the **left** column absorbs the slack.
 *
 * The right column carries the recognition account, whose labels and descriptions are interface
 * strings this project authors and can therefore keep short; the left carries the unbounded authored
 * comparison. Giving the growable side the surplus is the same choice `libraryGeometry` makes when it
 * lets the reading surface absorb what the shelf and the reserved gate band leave.
 */
export const DEBRIEF_RIGHT_COLUMN_WIDTH = 336;
export const DEBRIEF_COLUMN_GAP = 24;

// --- The floor stack --------------------------------------------------------------------------------

export const DEBRIEF_FLOOR_MARGIN = 16;
/**
 * The clearance reserved for the counterfactual warning, measured up from the canvas floor.
 *
 * The warning is `debrief.replayLabel`, authored `LocalizedText` with no `.max()` in the schema. Two
 * lines at {@link DEBRIEF_WARNING_FONT_SIZE} plus a padding at the top and the foot is 62; the shipped
 * French string is 96 characters, which is one line at {@link debriefWarningTextWrap} on the shipped
 * surface, so the reserve holds it with a line spare before the clamp is reached at all.
 *
 * **Reserved unconditionally**, including on a first completion where no warning is shown. The
 * alternative moves every band in the room between the first pass and the second, for a surface whose
 * whole point is that the record does not change under the player.
 */
export const DEBRIEF_WARNING_BAND_HEIGHT = 62;
/** Between the replay control and the warning band beneath it. */
export const DEBRIEF_CONTROL_GAP_ABOVE_WARNING = 12;
/** Between the content region's floor and the replay control below it. */
export const DEBRIEF_CONTENT_BOTTOM_GAP = 12;

// --- Font sizes ---------------------------------------------------------------------------------------

export const DEBRIEF_HEADING_FONT_SIZE = 22;
export const DEBRIEF_SUMMARY_FONT_SIZE = 16;
export const DEBRIEF_SECTION_TITLE_FONT_SIZE = 17;
export const DEBRIEF_BODY_FONT_SIZE = 14;
/**
 * The challenge prose, one design pixel under the body size.
 *
 * 13 is the smallest size in this room and it is here on purpose: a 404-character French objection is
 * three lines at this size across the full room width and four at 14, and the lower band holds three.
 * At NFR1's 1280×720 viewport a 1024×768 `Scale.FIT` surface renders every design size at 93.75%, so
 * 13 lands at ≈12 CSS px — legible, and the floor this room goes to before the clamp takes over.
 */
export const DEBRIEF_CRITIQUE_FONT_SIZE = 13;
export const DEBRIEF_META_FONT_SIZE = 12;
export const DEBRIEF_WARNING_FONT_SIZE = 14;
export const DEBRIEF_TOGGLE_FONT_SIZE = 14;
export const DEBRIEF_RECOGNITION_LABEL_FONT_SIZE = 15;
/**
 * The status column beside each recognition label — its **own** reserve, not the toggle strip's.
 *
 * Narrower, because it holds one short interface word ("Recorded" / "Consigné", "Not this time" /
 * "Pas cette fois") rather than a control label, and every pixel it gives back is a pixel the label
 * beside it needs: the French labels wrapped onto a second line inside a fixed row against the
 * strip's 150, which the 1280×720 pass caught.
 */
export const DEBRIEF_RECOGNITION_STATUS_WIDTH = 96;
/** Between a recognition label and the status column beside it — its own gutter, not the strip's. */
export const DEBRIEF_RECOGNITION_GAP = 12;
/** The floor every clamp shrinks to before it crops instead. */
export const DEBRIEF_MIN_FONT_SIZE = 11;

/**
 * The line box Phaser gives a font size — the multiplier `uiTextStyle` renders with.
 *
 * Exported because three separate places were deriving room from a bare font size: the renderer's own
 * stacking, `DebriefGeometry.test.ts`'s private copy, and `AdvanceControlGeometry.test.ts`, which
 * reserved `2 × DEBRIEF_REFUSAL_FONT_SIZE` = 26 for two rendered lines that cost 36 (2.11 review).
 */
export const debriefLineHeight = (fontSize: number): number => Math.ceil(fontSize * 1.35);

// --- Reserved band heights ------------------------------------------------------------------------------

/** Two lines of French summary at {@link DEBRIEF_SUMMARY_FONT_SIZE}, plus both paddings. */
export const DEBRIEF_SUMMARY_BAND_HEIGHT = 68;
/**
 * A two-line French title at {@link DEBRIEF_SECTION_TITLE_FONT_SIZE} over four lines of prose at
 * {@link DEBRIEF_BODY_FONT_SIZE}, plus {@link DEBRIEF_TITLE_GAP} and both paddings.
 *
 * The shipped French comparison is 236 characters — three lines at {@link debriefLeftTextWrap} on the
 * shipped surface — so the reserve holds it with a line spare. Past four the clamp shrinks and then
 * crops; the schema authorises any length, so the reserve is the guarantee and not the content.
 */
export const DEBRIEF_COMPARISON_BAND_HEIGHT = 152;
/** A source's name at {@link DEBRIEF_BODY_FONT_SIZE} over its provenance line at the meta size. */
export const DEBRIEF_SOURCE_ROW_HEIGHT = 36;
/**
 * How many citations the band reserves.
 *
 * Two, because `debrief.historicalComparison.sourceIds` is a **two-tuple** in the schema and
 * cross-checked against `contextualArtifacts`. Stated as a constant rather than left implicit so the
 * geometry test and the renderer agree about it without either restating a literal.
 */
export const DEBRIEF_CITED_SOURCE_ROWS = 2;
/** A band heading, then one {@link DEBRIEF_SOURCE_ROW_HEIGHT} row per cited source. */
export const DEBRIEF_SOURCES_BAND_HEIGHT = 128;
/** A label at {@link DEBRIEF_RECOGNITION_LABEL_FONT_SIZE} over two description lines at the meta size. */
export const DEBRIEF_RECOGNITION_ROW_HEIGHT = 56;
/**
 * A band heading and its intro, then one {@link DEBRIEF_RECOGNITION_ROW_HEIGHT} row per
 * `RecognitionId`.
 *
 * The intro is what keeps the band from reading as a score (AC3, and §Guided adventure's "no hard
 * fail, score, timer, or speed reward"): four ticked lines with no framing is a tally, and a tally is
 * the one thing this list must not be. It is reserved rather than optional, so the band does not
 * change height between a player who recorded everything and one who recorded nothing.
 */
export const DEBRIEF_RECOGNITION_BAND_HEIGHT = 326;
/** The band heading inside a band, at {@link DEBRIEF_SECTION_TITLE_FONT_SIZE}. */
export const DEBRIEF_BAND_HEADING_HEIGHT = 22;
/** Two lines of a French intro at {@link DEBRIEF_META_FONT_SIZE}, and the gap under it. */
export const DEBRIEF_INTRO_HEIGHT = 38;
/** The deeper-theory strip: always visible, whichever way the layer is set (AC1 — it is optional). */
export const DEBRIEF_TOGGLE_HEIGHT = 36;

/**
 * The columns region: the taller of the two columns' stacks.
 *
 * Stated rather than derived from a `Math.max` over the two, because both are reserves and a reserve
 * that moved when the other one changed would make each column's budget depend on the other's. The
 * geometry test asserts the recognition band fits inside it, which is the invariant that matters.
 */
export const DEBRIEF_COLUMNS_HEIGHT = DEBRIEF_SUMMARY_BAND_HEIGHT + DEBRIEF_BAND_GAP
    + DEBRIEF_COMPARISON_BAND_HEIGHT + DEBRIEF_BAND_GAP + DEBRIEF_SOURCES_BAND_HEIGHT;

// --- Bands -----------------------------------------------------------------------------------------------

const roomWidth = (canvasWidth: number): number => canvasWidth - (2 * DEBRIEF_ROOM_INSET);

const contentTop = (): number => DEBRIEF_TOP_MARGIN + DEBRIEF_HEADING_HEIGHT + DEBRIEF_HEADING_GAP;

const leftColumnWidth = (canvasWidth: number): number =>
    roomWidth(canvasWidth) - DEBRIEF_COLUMN_GAP - DEBRIEF_RIGHT_COLUMN_WIDTH;

const rightColumnLeft = (canvasWidth: number): number =>
    DEBRIEF_ROOM_INSET + leftColumnWidth(canvasWidth) + DEBRIEF_COLUMN_GAP;

export const debriefHeadingBand = (canvasWidth: number): DebriefRect => Object.freeze({
    x: DEBRIEF_ROOM_INSET,
    y: DEBRIEF_TOP_MARGIN,
    width: roomWidth(canvasWidth),
    height: DEBRIEF_HEADING_HEIGHT
});

export const debriefHeadingTextWrap = (canvasWidth: number): number => roomWidth(canvasWidth);

/**
 * The counterfactual warning, measured up from the canvas floor and never against the content above
 * it. See {@link DEBRIEF_WARNING_BAND_HEIGHT} for why it is reserved even when nothing is shown.
 */
export const debriefCounterfactualBand = (canvasWidth: number, canvasHeight: number): DebriefRect => Object.freeze({
    x: DEBRIEF_ROOM_INSET,
    y: canvasHeight - DEBRIEF_FLOOR_MARGIN - DEBRIEF_WARNING_BAND_HEIGHT,
    width: roomWidth(canvasWidth),
    height: DEBRIEF_WARNING_BAND_HEIGHT
});

/** The bound the warning wraps to, derived from its band rather than restated. */
export const debriefWarningTextWrap = (canvasWidth: number): number =>
    roomWidth(canvasWidth) - (2 * DEBRIEF_BAND_PADDING);

/** Top-left bounds, as {@link AdvanceControl} takes them. Sits above the warning, never over it. */
export const debriefAdvanceControlBounds = (canvasWidth: number, canvasHeight: number): DebriefRect => Object.freeze({
    x: (canvasWidth - ADVANCE_CONTROL_WIDTH) / 2,
    y: debriefCounterfactualBand(canvasWidth, canvasHeight).y
        - DEBRIEF_CONTROL_GAP_ABOVE_WARNING - ADVANCE_CONTROL_HEIGHT,
    width: ADVANCE_CONTROL_WIDTH,
    height: ADVANCE_CONTROL_HEIGHT
});

/**
 * The design-space centre of the control that replays the case, so a browser spec can click it.
 *
 * This is what `canvas-transitions.spec.ts` reads in place of the retired shell's
 * `placeholderAdvanceControlCentre` (Task 7).
 */
export const debriefAdvanceControlCentre = (
    canvasWidth: number,
    canvasHeight: number
): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = debriefAdvanceControlBounds(canvasWidth, canvasHeight);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

const contentBottom = (canvasWidth: number, canvasHeight: number): number =>
    debriefAdvanceControlBounds(canvasWidth, canvasHeight).y - DEBRIEF_CONTENT_BOTTOM_GAP;

/** Between the replay control and a refusal answered beside it. */
export const DEBRIEF_REFUSAL_GAP = 16;
export const DEBRIEF_REFUSAL_FONT_SIZE = 13;

/**
 * Where a refused replay is answered — **beside** the control, not under it.
 *
 * The row the control sits in has 340 unused design pixels to its right at 1024×768, and the band
 * below it is already spoken for by the counterfactual warning. Putting the refusal under the control
 * would either overlay that warning or push the control up, and the two are not exclusive: a player
 * on their second pass can be shown the warning and refused at the same moment.
 *
 * Only two refusals are reachable from this room. `replay-unavailable` requires the `debrief` phase
 * and a completion, both of which hold by the time this scene runs; `progress-operation-active` is
 * `createStore` short-circuiting every dispatch during an export or import, and it is the one a
 * player actually meets. Neither has an authored colleague line, which is why the scene passes
 * `colleagueAnswers: false` — see `resolveAdvanceRefusal`.
 */
export const debriefRefusalBand = (canvasWidth: number, canvasHeight: number): DebriefRect => {
    const control = debriefAdvanceControlBounds(canvasWidth, canvasHeight);
    const left = control.x + control.width + DEBRIEF_REFUSAL_GAP;
    return Object.freeze({
        x: left,
        y: control.y,
        width: Math.max(1, canvasWidth - DEBRIEF_ROOM_INSET - left),
        height: control.height
    });
};

// --- The left column ---------------------------------------------------------------------------------------

/** The bound prose in the left column wraps to, derived from the column rather than restated. */
export const debriefLeftTextWrap = (canvasWidth: number): number =>
    leftColumnWidth(canvasWidth) - (2 * DEBRIEF_BAND_PADDING);

export const debriefSummaryBand = (canvasWidth: number): DebriefRect => Object.freeze({
    x: DEBRIEF_ROOM_INSET,
    y: contentTop(),
    width: leftColumnWidth(canvasWidth),
    height: DEBRIEF_SUMMARY_BAND_HEIGHT
});

export const debriefComparisonBand = (canvasWidth: number): DebriefRect => {
    const summary = debriefSummaryBand(canvasWidth);
    return Object.freeze({
        x: summary.x,
        y: summary.y + summary.height + DEBRIEF_BAND_GAP,
        width: summary.width,
        height: DEBRIEF_COMPARISON_BAND_HEIGHT
    });
};

export const debriefSourcesBand = (canvasWidth: number): DebriefRect => {
    const comparison = debriefComparisonBand(canvasWidth);
    return Object.freeze({
        x: comparison.x,
        y: comparison.y + comparison.height + DEBRIEF_BAND_GAP,
        width: comparison.width,
        height: DEBRIEF_SOURCES_BAND_HEIGHT
    });
};

/** One cited source's row inside {@link debriefSourcesBand}. See {@link DEBRIEF_CITED_SOURCE_ROWS}. */
export const debriefSourceRowBand = (index: number, canvasWidth: number): DebriefRect => {
    const band = debriefSourcesBand(canvasWidth);
    return Object.freeze({
        x: band.x + DEBRIEF_BAND_PADDING,
        y: band.y + DEBRIEF_BAND_PADDING + DEBRIEF_BAND_HEADING_HEIGHT + DEBRIEF_TITLE_GAP
            + (index * (DEBRIEF_SOURCE_ROW_HEIGHT + DEBRIEF_ROW_GAP)),
        width: band.width - (2 * DEBRIEF_BAND_PADDING),
        height: DEBRIEF_SOURCE_ROW_HEIGHT
    });
};

// --- The right column --------------------------------------------------------------------------------------

/** The bound prose in the right column wraps to. */
export const debriefRightTextWrap = (): number =>
    DEBRIEF_RIGHT_COLUMN_WIDTH - (2 * DEBRIEF_BAND_PADDING);

export const debriefRecognitionBand = (canvasWidth: number): DebriefRect => Object.freeze({
    x: rightColumnLeft(canvasWidth),
    y: contentTop(),
    width: DEBRIEF_RIGHT_COLUMN_WIDTH,
    height: DEBRIEF_RECOGNITION_BAND_HEIGHT
});

/** The framing line under the recognition heading — see {@link DEBRIEF_RECOGNITION_BAND_HEIGHT}. */
export const debriefRecognitionIntroBand = (canvasWidth: number): DebriefRect => {
    const band = debriefRecognitionBand(canvasWidth);
    return Object.freeze({
        x: band.x + DEBRIEF_BAND_PADDING,
        y: band.y + DEBRIEF_BAND_PADDING + DEBRIEF_BAND_HEADING_HEIGHT + DEBRIEF_TITLE_GAP,
        width: band.width - (2 * DEBRIEF_BAND_PADDING),
        height: DEBRIEF_INTRO_HEIGHT
    });
};

/** One recognition line's row. Four ship (`RECOGNITION_IDS`); the band reserves four. */
export const debriefRecognitionRowBand = (index: number, canvasWidth: number): DebriefRect => {
    const intro = debriefRecognitionIntroBand(canvasWidth);
    return Object.freeze({
        x: intro.x,
        y: intro.y + intro.height + (index * (DEBRIEF_RECOGNITION_ROW_HEIGHT + DEBRIEF_ROW_GAP)),
        width: intro.width,
        height: DEBRIEF_RECOGNITION_ROW_HEIGHT
    });
};

// --- The deeper-theory strip and the shared lower band ---------------------------------------------------

export const debriefDeeperTheoryToggleBand = (canvasWidth: number): DebriefRect => Object.freeze({
    x: DEBRIEF_ROOM_INSET,
    y: contentTop() + DEBRIEF_COLUMNS_HEIGHT + DEBRIEF_BAND_GAP,
    width: roomWidth(canvasWidth),
    height: DEBRIEF_TOGGLE_HEIGHT
});

/** The design-space centre of the strip, so a browser spec can open the layer without restating it. */
export const debriefDeeperTheoryToggleCentre = (canvasWidth: number): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = debriefDeeperTheoryToggleBand(canvasWidth);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

/**
 * The strip carries two texts, and they are **not** one interpolated string.
 *
 * On the left, the authored `deeperTheory.title` — `LocalizedText` from `case.json`. On the right,
 * the interface show/hide label through `translate`. Authored prose and interface strings stay in
 * their own objects (§Localization): a template mixing them would put a title with no `.max()` inside
 * a fixed-height control, and the whole-string French check would then be measuring authored content
 * it cannot shorten.
 */
export const DEBRIEF_TOGGLE_STATE_WIDTH = 150;
/** Between the authored title and the state label beside it. */
export const DEBRIEF_TOGGLE_GAP = 12;

/** The bound the toggle's state label wraps to — fixed height, so it must fit one French line. */
export const debriefToggleStateWrap = (): number => DEBRIEF_TOGGLE_STATE_WIDTH;

/**
 * The bound a recognition **status** marker wraps to — fixed height, so it must fit one French line.
 *
 * Its own helper, because the French sweep was measuring these two markers against
 * {@link debriefToggleStateWrap}'s 150 while the renderer painted them at 96: a guard 56% looser than
 * the surface it guards, on the very constant whose docstring explains why 150 was the wrong reserve
 * (2.11 review).
 */
export const debriefRecognitionStatusWrap = (): number => DEBRIEF_RECOGNITION_STATUS_WIDTH;

/**
 * What a recognition label has left once its status marker and their gutter have taken theirs.
 *
 * A row is `debriefRecognitionIntroBand`-wide, which is {@link debriefRightTextWrap}. Exported because
 * it was computed inline in the renderer from {@link DEBRIEF_TOGGLE_GAP} — the *toggle strip's* gutter
 * borrowed for the recognition row's — so the one bound the 1280×720 pass found broken was the one
 * bound no test could read (2.11 review).
 */
export const debriefRecognitionLabelWrap = (): number =>
    debriefRightTextWrap() - DEBRIEF_RECOGNITION_STATUS_WIDTH - DEBRIEF_RECOGNITION_GAP;

/** What the authored title on the strip has left after the state label takes its reserve. */
export const debriefToggleLabelWrap = (canvasWidth: number): number =>
    roomWidth(canvasWidth) - (2 * DEBRIEF_BAND_PADDING) - DEBRIEF_TOGGLE_STATE_WIDTH - DEBRIEF_TOGGLE_GAP;

/**
 * The full-width band under the strip, and the **one** region the challenge history and the deeper
 * theory share.
 *
 * See the module header for the measurement that forced it: a 404-character French objection is three
 * lines here and seven in a 336px column, so both surfaces need the whole room width, and 132 design
 * pixels at 1024×768 holds one of them. They are never read at the same time — the layer is closed by
 * default and the player opens it deliberately — so the band shows the challenges until they do.
 *
 * Derived from the floor rather than given a height of its own, which is what makes it the band that
 * absorbs every rounding in the reserves above it.
 */
export const debriefLowerBand = (canvasWidth: number, canvasHeight: number): DebriefRect => {
    const strip = debriefDeeperTheoryToggleBand(canvasWidth);
    const y = strip.y + strip.height + DEBRIEF_BAND_GAP;
    return Object.freeze({
        x: strip.x,
        y,
        width: strip.width,
        height: Math.max(0, contentBottom(canvasWidth, canvasHeight) - y)
    });
};

/** The bound prose in the lower band wraps to, derived from the band rather than restated. */
export const debriefLowerTextWrap = (canvasWidth: number): number =>
    roomWidth(canvasWidth) - (2 * DEBRIEF_BAND_PADDING);

// --- Inside the lower band ---------------------------------------------------------------------------------

export const DEBRIEF_PAGE_CONTROL_WIDTH = 130;
export const DEBRIEF_PAGE_CONTROL_HEIGHT = 24;
export const DEBRIEF_PAGE_CONTROL_GAP = 8;
export const DEBRIEF_PAGE_CONTROL_FONT_SIZE = 12;
/** The bound a paging control's label wraps to — fixed height, so it must fit one French line. */
export const debriefPageControlLabelWrap = (): number =>
    DEBRIEF_PAGE_CONTROL_WIDTH - (2 * DEBRIEF_BAND_PADDING);

/**
 * The two paging controls, laid out from the **right** edge of the lower band's heading row.
 *
 * `direction: -1` is the earlier challenge and sits left of `direction: 1`, so the pair reads in the
 * order it moves through the history. Right-aligned because the heading takes the left of the row and
 * is unbounded interface copy: a control placed after a measured heading would move with the
 * translation, and this row is the one place two objects share a horizontal budget.
 */
export const debriefPageControlBand = (
    direction: -1 | 1,
    canvasWidth: number,
    canvasHeight: number
): DebriefRect => {
    const band = debriefLowerBand(canvasWidth, canvasHeight);
    const right = band.x + band.width - DEBRIEF_BAND_PADDING;
    const offsetFromRight = direction === 1 ? 0 : DEBRIEF_PAGE_CONTROL_WIDTH + DEBRIEF_PAGE_CONTROL_GAP;
    return Object.freeze({
        x: right - DEBRIEF_PAGE_CONTROL_WIDTH - offsetFromRight,
        y: band.y + DEBRIEF_BAND_PADDING,
        width: DEBRIEF_PAGE_CONTROL_WIDTH,
        height: DEBRIEF_PAGE_CONTROL_HEIGHT
    });
};

/** The design-space centre of a paging control, so a browser spec can turn the page. */
export const debriefPageControlCentre = (
    direction: -1 | 1,
    canvasWidth: number,
    canvasHeight: number
): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = debriefPageControlBand(direction, canvasWidth, canvasHeight);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

/** What the lower band's heading has left once the paging controls have taken their reserve. */
export const debriefLowerHeadingWrap = (canvasWidth: number): number =>
    debriefLowerTextWrap(canvasWidth)
    - (2 * DEBRIEF_PAGE_CONTROL_WIDTH) - DEBRIEF_PAGE_CONTROL_GAP - DEBRIEF_BAND_GAP;

/**
 * Everything the lower band has under its own heading row — the challenge on show, or the deeper
 * theory's prose. One rectangle for both, because they occupy the band one at a time.
 */
export const debriefLowerBodyBand = (canvasWidth: number, canvasHeight: number): DebriefRect => {
    const band = debriefLowerBand(canvasWidth, canvasHeight);
    const top = band.y + DEBRIEF_BAND_PADDING + DEBRIEF_BAND_HEADING_HEIGHT + DEBRIEF_TITLE_GAP;
    return Object.freeze({
        x: band.x + DEBRIEF_BAND_PADDING,
        y: top,
        width: band.width - (2 * DEBRIEF_BAND_PADDING),
        height: Math.max(0, band.y + band.height - DEBRIEF_BAND_PADDING - top)
    });
};

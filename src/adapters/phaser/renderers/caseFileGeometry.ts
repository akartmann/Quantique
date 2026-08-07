/**
 * The case file's layout, in its own module so a test and a browser spec can read it (Story 2.11).
 *
 * **Phaser is not imported here at all.** `CaseFilePresenter` builds display objects, so it imports
 * Phaser as a value; Phaser touches `window` at import time and both Vitest and the Playwright specs
 * run in Node. `apparatusGeometry.ts`, `libraryGeometry.ts` and `debriefGeometry.ts` set the
 * precedent; this is the next one.
 *
 * **Every function takes the canvas size.** Nothing here closes over `1024` or `768`.
 *
 * ## Why the case file is an overlay, and not a band on the board (D1)
 *
 * Measured, not preferred. From `ColleagueRenderer`'s own exported geometry at 1024×768 with four
 * proposals: the cards are floor-anchored and spend `4 × 84 + 3 × 10` = 366px plus a 16px margin; the
 * guide band and its two gaps spend 54; and the top-right column belongs to the submit, advance and
 * case-file controls. That leaves a 332px room band which the dialogue panel already overlays and
 * which `proposalStageBand` reports as giving out at a four-line French beat. There is no band there
 * for an observation list with two selection sets, a readiness list and a peer-review pane.
 *
 * `NotebookRenderer` (Story 2.10, D3) reached the same conclusion about the bench from the same
 * arithmetic and `ReferenceBookPresenter` (Story 2.8, D1) established the shape: the **scene** owns the
 * overlay and suppresses its own input while it is up, because a click meant for the overlay that fell
 * through would choose a conclusion.
 *
 * ## The shape
 *
 * ```
 *  ┌─ heading ────────────────────────────────────────────────┐
 *  │  guide                                                   │
 *  │  ┌── observations (paged) ─────┬── what is still missing ─┤
 *  │  │  row + pin  × 4             │  one line per code       │
 *  │  │  earlier / later            ├──────────────────────────┤
 *  │  ├── references ───────────────┤  peer review (`review`)  │
 *  │  │  row + pin                  │  request / issues / save │
 *  │  └─────────────────────────────┴──────────────────────────┘
 *  │  close                                    status          │
 *  └──────────────────────────────────────────────────────────┘
 * ```
 *
 * The observation list is **paged** because nothing caps `runs`: `flow.maximumExperimentCycles` is
 * declared in the type, the schema and `case.json`, and no reducer reads it — `reduceExperimentRun`
 * applies no cap (recorded in `selectSignificantMeasureCount`'s docstring, review 2026-08-06). So the
 * list is unbounded and `NOTEBOOK_ROWS_PER_PAGE` is the pattern to follow rather than a count to trust.
 */

/** A rectangle in design space, top-left anchored. */
export type CaseFileRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/**
 * Above the board, and above nothing else.
 *
 * Depth rather than creation order, because creation order is a fact about one `create()` that a later
 * story can reorder without noticing — and the 2.9 review found a whole room painted over everything
 * for exactly that reason. It matches `NOTEBOOK_DEPTH`: the two overlays live on different scenes and
 * can never be up at once, so they are deliberately the same number rather than an invented ordering
 * between things that do not meet.
 */
export const CASE_FILE_DEPTH = 9_000;

/** How far the panel sits in from the canvas edge on every side. */
export const CASE_FILE_MARGIN = 40;
export const CASE_FILE_PADDING = 24;
/** Between two stacked bands inside the panel. */
export const CASE_FILE_BAND_GAP = 14;
/** Between a band's heading and the rows under it. */
export const CASE_FILE_TITLE_GAP = 6;
export const CASE_FILE_ROW_GAP = 6;

export const CASE_FILE_HEADING_FONT_SIZE = 22;
export const CASE_FILE_SECTION_FONT_SIZE = 15;
export const CASE_FILE_ROW_FONT_SIZE = 13;
export const CASE_FILE_META_FONT_SIZE = 12;
export const CASE_FILE_CONTROL_FONT_SIZE = 13;
/** The floor every clamp in this overlay shrinks to before it crops instead. */
export const CASE_FILE_MIN_FONT_SIZE = 11;

/**
 * The line box Phaser gives a font size, which is what every reserve in this module is built from.
 *
 * `1.35` is the multiplier `uiTextStyle` renders with, and it is exported rather than restated because
 * the 2.11 review found four reserves stated as round numbers that disagreed with their own docstrings —
 * `CASE_FILE_GUIDE_HEIGHT` at 34 against a stated two-line worst case of 36, a reference row reserving
 * 10px for a line that cannot render under 15, and an observation row reserving one line for a detail
 * that wraps to two. A reserve derived from this helper cannot drift from what is painted, and
 * `CaseFileGeometry.test.ts` reads the same function rather than keeping a private copy.
 */
export const caseFileLineHeight = (fontSize: number): number => Math.ceil(fontSize * 1.35);

export const CASE_FILE_HEADING_HEIGHT = 28;
/** Two lines of a French guide at {@link CASE_FILE_ROW_FONT_SIZE} — derived, not stated. */
export const CASE_FILE_GUIDE_HEIGHT = 2 * caseFileLineHeight(CASE_FILE_ROW_FONT_SIZE);
/** A band heading at {@link CASE_FILE_SECTION_FONT_SIZE}. */
export const CASE_FILE_SECTION_HEIGHT = 22;

/** How far a row's content sits in from the row's own edges. */
export const CASE_FILE_ROW_INSET_X = 10;
export const CASE_FILE_ROW_INSET_Y = 8;

/** The pin/unpin affordance beside every observation and every reference. */
export const CASE_FILE_PIN_WIDTH = 120;
export const CASE_FILE_PIN_HEIGHT = 30;
export const CASE_FILE_PIN_GAP = 12;
export const CASE_FILE_PIN_PADDING = 8;
/** The bound a pin label wraps to — fixed height, so it must fit one French line. */
export const caseFilePinLabelWrap = (): number => CASE_FILE_PIN_WIDTH - (2 * CASE_FILE_PIN_PADDING);

/**
 * An observation's title line over its settings-and-result line.
 *
 * **The detail takes two lines, and the reserve says so.** It is a three-part interpolation —
 * `{slitSpacing} · {screenDistance} · {result}`, each part a full `lab.control.readout` — which is
 * ~73 characters in English and ~85 in French against a {@link caseFileRowTextWrap} of 358 at 1024.
 * Neither fits one line, at the authored size or at {@link CASE_FILE_MIN_FONT_SIZE}. The 2.11 review
 * found this row reserving one line and cropping the second in both locales on every render; the
 * honest fix for content that needs two lines is a reserve that holds two, not shorter physics.
 */
export const CASE_FILE_ROW_HEIGHT = (2 * CASE_FILE_ROW_INSET_Y)
    + caseFileLineHeight(CASE_FILE_ROW_FONT_SIZE)
    + (2 * caseFileLineHeight(CASE_FILE_META_FONT_SIZE));
/**
 * How many observations one page holds.
 *
 * Paged because nothing caps `runs` — see the module header. **Three**, down from four when the row
 * grew to hold its own detail: `caseFileContentFits` is the arbiter, and four 68px rows put the
 * references band 4px from the way out at 1024×768. Paging already exists and is exercised, so the
 * cost of a shorter page is a click the player already has; the cost of a taller band was a reserve
 * that only just fits and would stop fitting the next time anything above it grew.
 */
export const CASE_FILE_ROWS_PER_PAGE = 3;
export const CASE_FILE_PAGE_CONTROL_WIDTH = 130;
export const CASE_FILE_PAGE_CONTROL_HEIGHT = 26;
export const CASE_FILE_PAGE_CONTROL_GAP = 8;
export const caseFilePageControlLabelWrap = (): number =>
    CASE_FILE_PAGE_CONTROL_WIDTH - (2 * CASE_FILE_PIN_PADDING);

/**
 * A reference's name line over its provenance line — derived, so the provenance line has a line to sit in.
 *
 * At 44 this reserved `44 − 8 − 26` = **10px** for a line that is ~15px at the clamp's own 11px floor,
 * so every provenance line on the surface was drawn cropped through its descenders, in both locales,
 * with no long string and no degraded content required (2.11 review).
 */
export const CASE_FILE_SOURCE_ROW_HEIGHT = (2 * CASE_FILE_ROW_INSET_Y)
    + caseFileLineHeight(CASE_FILE_ROW_FONT_SIZE)
    + caseFileLineHeight(CASE_FILE_META_FONT_SIZE);
/**
 * How many references the band reserves.
 *
 * Two, because `contextualArtifacts` is a two-tuple in the type **and** cross-checked as exactly two
 * in the schema. Unlike the observations there is nothing to page.
 */
export const CASE_FILE_SOURCE_ROWS = 2;

/** One line per missing requirement, clamped to it. */
export const CASE_FILE_READINESS_ROW_HEIGHT = 18;
/**
 * How many readiness lines the band reserves.
 *
 * Eleven — every member of `MissingConclusionRequirementCode`. Reserving the whole enum rather than
 * "the number the shipped case usually produces" is what makes the band a guarantee: the list is a
 * pure function of the player's record and several codes can hold at once.
 */
export const CASE_FILE_READINESS_ROWS = 11;

export const CASE_FILE_ACTION_HEIGHT = 30;
export const CASE_FILE_ACTION_WIDTH = 220;
export const CASE_FILE_ACTION_GAP = 8;
export const CASE_FILE_ACTION_PADDING = 10;
/** The bound an action label wraps to — fixed height, so it must fit one French line. */
export const caseFileActionLabelWrap = (): number => CASE_FILE_ACTION_WIDTH - (2 * CASE_FILE_ACTION_PADDING);

/** What the peer-review band has for the issues between its request and save controls. */
export const CASE_FILE_ISSUES_HEIGHT = 106;

export const CASE_FILE_CLOSE_HEIGHT = 36;
export const CASE_FILE_CLOSE_WIDTH = 220;

/** The right column is fixed; the observation list on the left absorbs the slack. */
export const CASE_FILE_RIGHT_COLUMN_WIDTH = 372;
export const CASE_FILE_COLUMN_GAP = 24;

// --- The panel ----------------------------------------------------------------------------------------

export const caseFilePanelBand = (canvasWidth: number, canvasHeight: number): CaseFileRect => Object.freeze({
    x: CASE_FILE_MARGIN,
    y: CASE_FILE_MARGIN,
    width: canvasWidth - (2 * CASE_FILE_MARGIN),
    height: canvasHeight - (2 * CASE_FILE_MARGIN)
});

const innerLeft = (): number => CASE_FILE_MARGIN + CASE_FILE_PADDING;
const innerWidth = (canvasWidth: number): number =>
    canvasWidth - (2 * CASE_FILE_MARGIN) - (2 * CASE_FILE_PADDING);

export const caseFileHeadingBand = (canvasWidth: number): CaseFileRect => Object.freeze({
    x: innerLeft(),
    y: CASE_FILE_MARGIN + CASE_FILE_PADDING,
    width: innerWidth(canvasWidth),
    height: CASE_FILE_HEADING_HEIGHT
});

export const caseFileGuideBand = (canvasWidth: number): CaseFileRect => {
    const heading = caseFileHeadingBand(canvasWidth);
    return Object.freeze({
        x: heading.x,
        y: heading.y + heading.height + CASE_FILE_TITLE_GAP,
        width: heading.width,
        height: CASE_FILE_GUIDE_HEIGHT
    });
};

/** The way out, measured up from the panel's own floor so nothing above it can push it off. */
export const caseFileCloseControlBand = (canvasWidth: number, canvasHeight: number): CaseFileRect => {
    const panel = caseFilePanelBand(canvasWidth, canvasHeight);
    return Object.freeze({
        x: innerLeft(),
        y: panel.y + panel.height - CASE_FILE_PADDING - CASE_FILE_CLOSE_HEIGHT,
        width: CASE_FILE_CLOSE_WIDTH,
        height: CASE_FILE_CLOSE_HEIGHT
    });
};

export const caseFileCloseControlCentre = (
    canvasWidth: number,
    canvasHeight: number
): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = caseFileCloseControlBand(canvasWidth, canvasHeight);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

/** A refused pin, a refused request, a saved revision — answered beside the way out. */
export const caseFileStatusBand = (canvasWidth: number, canvasHeight: number): CaseFileRect => {
    const close = caseFileCloseControlBand(canvasWidth, canvasHeight);
    const left = close.x + close.width + CASE_FILE_BAND_GAP;
    return Object.freeze({
        x: left,
        y: close.y,
        width: Math.max(1, innerLeft() + innerWidth(canvasWidth) - left),
        height: close.height
    });
};

const contentTop = (canvasWidth: number): number => {
    const guide = caseFileGuideBand(canvasWidth);
    return guide.y + guide.height + CASE_FILE_BAND_GAP;
};

const contentBottom = (canvasWidth: number, canvasHeight: number): number =>
    caseFileCloseControlBand(canvasWidth, canvasHeight).y - CASE_FILE_BAND_GAP;

const leftColumnWidth = (canvasWidth: number): number =>
    innerWidth(canvasWidth) - CASE_FILE_COLUMN_GAP - CASE_FILE_RIGHT_COLUMN_WIDTH;

const rightColumnLeft = (canvasWidth: number): number =>
    innerLeft() + leftColumnWidth(canvasWidth) + CASE_FILE_COLUMN_GAP;

/**
 * The bound a row's prose wraps to, once its pin has taken its reserve **and its own inset has taken
 * its own**. The inset was missing here, so a row's text was permitted 10px it does not have and could
 * wrap into the gap before the pin (2.11 review).
 */
export const caseFileRowTextWrap = (canvasWidth: number): number =>
    leftColumnWidth(canvasWidth) - CASE_FILE_PIN_WIDTH - CASE_FILE_PIN_GAP - CASE_FILE_ROW_INSET_X;

/**
 * The right column's own bound. **No pin reserve**: nothing over there is pinnable — the readiness
 * list reports and the peer-review pane acts through its own two controls — so subtracting one would
 * wrap French copy earlier than the column actually requires.
 *
 * The reference rows are in the *left* column, under the observations, and use
 * {@link caseFileRowTextWrap} like every other pinnable row. Getting that wrong is what
 * `CaseFileGeometry.test.ts` caught the day this was written.
 */
export const caseFileRightTextWrap = (): number => CASE_FILE_RIGHT_COLUMN_WIDTH;

export const caseFileGuideTextWrap = (canvasWidth: number): number => innerWidth(canvasWidth);

// --- The left column: observations, then references ---------------------------------------------------

export const CASE_FILE_OBSERVATIONS_BAND_HEIGHT = CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
    + (CASE_FILE_ROWS_PER_PAGE * CASE_FILE_ROW_HEIGHT) + ((CASE_FILE_ROWS_PER_PAGE - 1) * CASE_FILE_ROW_GAP)
    + CASE_FILE_ROW_GAP + CASE_FILE_PAGE_CONTROL_HEIGHT;

export const CASE_FILE_SOURCES_BAND_HEIGHT = CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
    + (CASE_FILE_SOURCE_ROWS * CASE_FILE_SOURCE_ROW_HEIGHT) + ((CASE_FILE_SOURCE_ROWS - 1) * CASE_FILE_ROW_GAP);

export const caseFileObservationsBand = (canvasWidth: number): CaseFileRect => Object.freeze({
    x: innerLeft(),
    y: contentTop(canvasWidth),
    width: leftColumnWidth(canvasWidth),
    height: CASE_FILE_OBSERVATIONS_BAND_HEIGHT
});

export const caseFileObservationRowBand = (index: number, canvasWidth: number): CaseFileRect => {
    const band = caseFileObservationsBand(canvasWidth);
    return Object.freeze({
        x: band.x,
        y: band.y + CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
            + (index * (CASE_FILE_ROW_HEIGHT + CASE_FILE_ROW_GAP)),
        width: band.width,
        height: CASE_FILE_ROW_HEIGHT
    });
};

/** The pin affordance for a row, right-aligned inside it and vertically centred. */
export const caseFileRowPinBand = (row: CaseFileRect): CaseFileRect => Object.freeze({
    x: row.x + row.width - CASE_FILE_PIN_WIDTH,
    y: row.y + ((row.height - CASE_FILE_PIN_HEIGHT) / 2),
    width: CASE_FILE_PIN_WIDTH,
    height: CASE_FILE_PIN_HEIGHT
});

export const caseFileObservationPinCentre = (
    index: number,
    canvasWidth: number
): Readonly<{ x: number; y: number }> => {
    const pin = caseFileRowPinBand(caseFileObservationRowBand(index, canvasWidth));
    return Object.freeze({ x: pin.x + (pin.width / 2), y: pin.y + (pin.height / 2) });
};

export const caseFilePageControlBand = (direction: -1 | 1, canvasWidth: number): CaseFileRect => {
    const band = caseFileObservationsBand(canvasWidth);
    const lastRow = caseFileObservationRowBand(CASE_FILE_ROWS_PER_PAGE - 1, canvasWidth);
    return Object.freeze({
        x: band.x + (direction === 1 ? CASE_FILE_PAGE_CONTROL_WIDTH + CASE_FILE_PAGE_CONTROL_GAP : 0),
        y: lastRow.y + lastRow.height + CASE_FILE_ROW_GAP,
        width: CASE_FILE_PAGE_CONTROL_WIDTH,
        height: CASE_FILE_PAGE_CONTROL_HEIGHT
    });
};

export const caseFilePageControlCentre = (
    direction: -1 | 1,
    canvasWidth: number
): Readonly<{ x: number; y: number }> => {
    const { x, y, width, height } = caseFilePageControlBand(direction, canvasWidth);
    return Object.freeze({ x: x + (width / 2), y: y + (height / 2) });
};

export const caseFileSourcesBand = (canvasWidth: number): CaseFileRect => {
    const observations = caseFileObservationsBand(canvasWidth);
    return Object.freeze({
        x: observations.x,
        y: observations.y + observations.height + CASE_FILE_BAND_GAP,
        width: observations.width,
        height: CASE_FILE_SOURCES_BAND_HEIGHT
    });
};

export const caseFileSourceRowBand = (index: number, canvasWidth: number): CaseFileRect => {
    const band = caseFileSourcesBand(canvasWidth);
    return Object.freeze({
        x: band.x,
        y: band.y + CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
            + (index * (CASE_FILE_SOURCE_ROW_HEIGHT + CASE_FILE_ROW_GAP)),
        width: band.width,
        height: CASE_FILE_SOURCE_ROW_HEIGHT
    });
};

export const caseFileSourcePinCentre = (
    index: number,
    canvasWidth: number
): Readonly<{ x: number; y: number }> => {
    const pin = caseFileRowPinBand(caseFileSourceRowBand(index, canvasWidth));
    return Object.freeze({ x: pin.x + (pin.width / 2), y: pin.y + (pin.height / 2) });
};

// --- The right column: what is missing, then peer review ------------------------------------------------

export const CASE_FILE_READINESS_BAND_HEIGHT = CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
    + (CASE_FILE_READINESS_ROWS * CASE_FILE_READINESS_ROW_HEIGHT);

export const CASE_FILE_PEER_REVIEW_BAND_HEIGHT = CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP
    + CASE_FILE_ACTION_HEIGHT + CASE_FILE_ACTION_GAP + CASE_FILE_ISSUES_HEIGHT
    + CASE_FILE_ACTION_GAP + CASE_FILE_ACTION_HEIGHT;

export const caseFileReadinessBand = (canvasWidth: number): CaseFileRect => Object.freeze({
    x: rightColumnLeft(canvasWidth),
    y: contentTop(canvasWidth),
    width: CASE_FILE_RIGHT_COLUMN_WIDTH,
    height: CASE_FILE_READINESS_BAND_HEIGHT
});

export const caseFileReadinessRowBand = (index: number, canvasWidth: number): CaseFileRect => {
    const band = caseFileReadinessBand(canvasWidth);
    return Object.freeze({
        x: band.x,
        y: band.y + CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP + (index * CASE_FILE_READINESS_ROW_HEIGHT),
        width: band.width,
        height: CASE_FILE_READINESS_ROW_HEIGHT
    });
};

export const caseFilePeerReviewBand = (canvasWidth: number): CaseFileRect => {
    const readiness = caseFileReadinessBand(canvasWidth);
    return Object.freeze({
        x: readiness.x,
        y: readiness.y + readiness.height + CASE_FILE_BAND_GAP,
        width: readiness.width,
        height: CASE_FILE_PEER_REVIEW_BAND_HEIGHT
    });
};

/** The control that asks for feedback, at the top of the peer-review band. */
export const caseFileRequestControlBand = (canvasWidth: number): CaseFileRect => {
    const band = caseFilePeerReviewBand(canvasWidth);
    return Object.freeze({
        x: band.x,
        y: band.y + CASE_FILE_SECTION_HEIGHT + CASE_FILE_TITLE_GAP,
        width: CASE_FILE_ACTION_WIDTH,
        height: CASE_FILE_ACTION_HEIGHT
    });
};

/** What the returned issues are read in, between the two controls. */
export const caseFileIssuesBand = (canvasWidth: number): CaseFileRect => {
    const request = caseFileRequestControlBand(canvasWidth);
    return Object.freeze({
        x: request.x,
        y: request.y + request.height + CASE_FILE_ACTION_GAP,
        width: CASE_FILE_RIGHT_COLUMN_WIDTH,
        height: CASE_FILE_ISSUES_HEIGHT
    });
};

/** The control that saves the reviewed revision, under the issues it answers. */
export const caseFileSaveControlBand = (canvasWidth: number): CaseFileRect => {
    const issues = caseFileIssuesBand(canvasWidth);
    return Object.freeze({
        x: issues.x,
        y: issues.y + issues.height + CASE_FILE_ACTION_GAP,
        width: CASE_FILE_ACTION_WIDTH,
        height: CASE_FILE_ACTION_HEIGHT
    });
};

const centreOf = (rect: CaseFileRect): Readonly<{ x: number; y: number }> =>
    Object.freeze({ x: rect.x + (rect.width / 2), y: rect.y + (rect.height / 2) });

export const caseFileRequestControlCentre = (canvasWidth: number): Readonly<{ x: number; y: number }> =>
    centreOf(caseFileRequestControlBand(canvasWidth));

export const caseFileSaveControlCentre = (canvasWidth: number): Readonly<{ x: number; y: number }> =>
    centreOf(caseFileSaveControlBand(canvasWidth));

/**
 * The floor the tallest column reaches, so a test can prove the whole overlay fits above the way out.
 *
 * Derived from the two columns rather than stated, because which one is taller is a consequence of
 * their reserves and not something to be written down twice.
 */
export const caseFileContentFloor = (canvasWidth: number): number => Math.max(
    caseFileSourcesBand(canvasWidth).y + caseFileSourcesBand(canvasWidth).height,
    caseFilePeerReviewBand(canvasWidth).y + caseFilePeerReviewBand(canvasWidth).height
);

/** Whether the reserves fit between the guide and the way out on this canvas. */
export const caseFileContentFits = (canvasWidth: number, canvasHeight: number): boolean =>
    caseFileContentFloor(canvasWidth) <= contentBottom(canvasWidth, canvasHeight);

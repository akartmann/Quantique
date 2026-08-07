import { describe, expect, it } from 'vitest';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import {
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_WIDTH,
    DEBRIEF_BAND_GAP,
    DEBRIEF_BAND_HEADING_HEIGHT,
    DEBRIEF_BAND_PADDING,
    DEBRIEF_BODY_FONT_SIZE,
    DEBRIEF_CITED_SOURCE_ROWS,
    DEBRIEF_COLUMN_GAP,
    DEBRIEF_COLUMNS_HEIGHT,
    DEBRIEF_COMPARISON_BAND_HEIGHT,
    DEBRIEF_CONTROL_GAP_ABOVE_WARNING,
    DEBRIEF_CRITIQUE_FONT_SIZE,
    DEBRIEF_FLOOR_MARGIN,
    DEBRIEF_META_FONT_SIZE,
    DEBRIEF_MIN_FONT_SIZE,
    DEBRIEF_PAGE_CONTROL_GAP,
    DEBRIEF_PAGE_CONTROL_HEIGHT,
    DEBRIEF_PAGE_CONTROL_WIDTH,
    DEBRIEF_RECOGNITION_LABEL_FONT_SIZE,
    DEBRIEF_RECOGNITION_ROW_HEIGHT,
    DEBRIEF_ROOM_INSET,
    DEBRIEF_ROW_GAP,
    DEBRIEF_SECTION_TITLE_FONT_SIZE,
    DEBRIEF_SOURCE_ROW_HEIGHT,
    DEBRIEF_SUMMARY_FONT_SIZE,
    DEBRIEF_TITLE_GAP,
    DEBRIEF_TOGGLE_GAP,
    DEBRIEF_TOGGLE_HEIGHT,
    DEBRIEF_TOGGLE_STATE_WIDTH,
    DEBRIEF_WARNING_FONT_SIZE,
    debriefAdvanceControlBounds,
    debriefAdvanceControlCentre,
    debriefComparisonBand,
    debriefCounterfactualBand,
    debriefDeeperTheoryToggleBand,
    debriefDeeperTheoryToggleCentre,
    debriefHeadingBand,
    debriefLeftTextWrap,
    debriefLowerBand,
    debriefLowerBodyBand,
    debriefLowerHeadingWrap,
    debriefLowerTextWrap,
    debriefPageControlBand,
    debriefPageControlCentre,
    debriefPageControlLabelWrap,
    debriefLineHeight,
    debriefRecognitionBand,
    debriefRecognitionIntroBand,
    debriefRefusalBand,
    debriefRecognitionRowBand,
    debriefRightTextWrap,
    debriefSourceRowBand,
    debriefSourcesBand,
    debriefSummaryBand,
    debriefToggleLabelWrap,
    debriefToggleStateWrap,
    debriefWarningTextWrap,
    type DebriefRect
} from '../../src/adapters/phaser/scenes/debriefGeometry';
import { RECOGNITION_IDS } from '../../src/domain/recognition/recognitionRules';

/**
 * The shipped surface, and a deliberately different one.
 *
 * Every assertion below runs against both. A single canvas size would let a function that closed over
 * `1024`/`768` pass every check — which is what Task 2 forbids, and what this pair detects.
 * `LibraryGeometry.test.ts` is the pattern.
 */
const CANVASES = [
    { name: `${DESIGN_WIDTH}×${DESIGN_HEIGHT} (the shipped design surface)`, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
    { name: '1280×800 (a surface the code must not have memorised)', width: 1280, height: 800 }
] as const;

/**
 * The invariants, written out here rather than imported from the module under test.
 *
 * A predicate supplied by the source it is checking can only prove the source agrees with itself: a
 * broken `overlaps` would make every no-overlap assertion below pass vacuously.
 */
const overlaps = (first: DebriefRect, second: DebriefRect): boolean =>
    first.x < second.x + second.width
    && second.x < first.x + first.width
    && first.y < second.y + second.height
    && second.y < first.y + first.height;

const within = (rect: DebriefRect, canvasWidth: number, canvasHeight: number): boolean =>
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvasWidth && rect.y + rect.height <= canvasHeight;

const contains = (outer: DebriefRect, inner: DebriefRect): boolean =>
    inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;

/**
 * What one wrapped line of text costs vertically — **the source's own helper**, not a copy of it.
 *
 * It used to be a private restatement of `Math.ceil(fontSize * 1.35)`, which is the "never assert a
 * magic number a test shares with source unless both read one exported constant" rule with the
 * multiplier standing in for the number (2.11 review).
 */
const lineHeight = debriefLineHeight;

describe('the invariants this suite is written in terms of', () => {
    it('detects an overlap, and does not report one for rectangles that merely touch', () => {
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
    });

    it('detects a rectangle that leaves the canvas on each edge', () => {
        expect(within({ x: 0, y: 0, width: 10, height: 10 }, 10, 10)).toBe(true);
        expect(within({ x: -1, y: 0, width: 10, height: 10 }, 10, 10)).toBe(false);
        expect(within({ x: 0, y: -1, width: 10, height: 10 }, 10, 10)).toBe(false);
        expect(within({ x: 1, y: 0, width: 10, height: 10 }, 10, 10)).toBe(false);
        expect(within({ x: 0, y: 1, width: 10, height: 10 }, 10, 10)).toBe(false);
    });

    it('detects a rectangle that escapes its container on any edge', () => {
        const outer = { x: 10, y: 10, width: 20, height: 20 };
        expect(contains(outer, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
        expect(contains(outer, { x: 9, y: 10, width: 20, height: 20 })).toBe(false);
        expect(contains(outer, { x: 10, y: 9, width: 20, height: 20 })).toBe(false);
        expect(contains(outer, { x: 10, y: 10, width: 21, height: 20 })).toBe(false);
        expect(contains(outer, { x: 10, y: 10, width: 20, height: 21 })).toBe(false);
    });
});

describe.each(CANVASES)('the debrief laid out on $name', ({ width, height }) => {
    /** Every band the room paints. The lower band is one region shared by two tenants, so it is one entry. */
    const bands = (): readonly DebriefRect[] => [
        debriefHeadingBand(width),
        debriefSummaryBand(width),
        debriefComparisonBand(width),
        debriefSourcesBand(width),
        debriefRecognitionBand(width),
        debriefDeeperTheoryToggleBand(width),
        debriefLowerBand(width, height),
        debriefAdvanceControlBounds(width, height),
        debriefRefusalBand(width, height),
        debriefCounterfactualBand(width, height)
    ];

    it('keeps every band and every row inside the canvas', () => {
        bands().forEach((band) => expect(within(band, width, height)).toBe(true));
        expect(within(debriefLowerBodyBand(width, height), width, height)).toBe(true);
        expect(within(debriefRecognitionIntroBand(width), width, height)).toBe(true);
        RECOGNITION_IDS.forEach((_id, index) => {
            expect(within(debriefRecognitionRowBand(index, width), width, height)).toBe(true);
        });
        Array.from({ length: DEBRIEF_CITED_SOURCE_ROWS }, (_unused, index) => index).forEach((index) => {
            expect(within(debriefSourceRowBand(index, width), width, height)).toBe(true);
        });
        ([-1, 1] as const).forEach((direction) => {
            expect(within(debriefPageControlBand(direction, width, height), width, height)).toBe(true);
        });
    });

    it('overlaps no band with any other', () => {
        const all = bands();
        all.forEach((band, index) => {
            all.slice(index + 1).forEach((other) => {
                expect(overlaps(band, other), `${JSON.stringify(band)} vs ${JSON.stringify(other)}`).toBe(false);
            });
        });
    });

    it('keeps the replay control clear of, and above, the counterfactual warning', () => {
        const control = debriefAdvanceControlBounds(width, height);
        const warning = debriefCounterfactualBand(width, height);
        expect(overlaps(control, warning)).toBe(false);
        // Above, specifically — not merely disjoint. A control under its own warning would put the way
        // out of the room beneath prose that can grow.
        expect(control.y + control.height).toBeLessThanOrEqual(warning.y);
    });

    /**
     * The floor stack is measured **up from the canvas floor**, which is the whole reason it is safe.
     *
     * Not `toBeGreaterThan(0)` on a coordinate built from positive offsets — the 2.7 review rejected
     * four assertions of exactly that shape, and the 2.8 review three more. This compares the derived
     * positions against the floor arithmetic the module claims, and then against a taller canvas: a
     * band re-anchored to a constant above it would not move, and fails here.
     */
    it('measures the floor stack up from the canvas floor rather than down from the content', () => {
        const warning = debriefCounterfactualBand(width, height);
        const control = debriefAdvanceControlBounds(width, height);
        expect(warning.y + warning.height).toBe(height - DEBRIEF_FLOOR_MARGIN);
        expect(control.y).toBe(warning.y - DEBRIEF_CONTROL_GAP_ABOVE_WARNING - ADVANCE_CONTROL_HEIGHT);

        expect(debriefCounterfactualBand(width, height + 100).y).toBe(warning.y + 100);
        expect(debriefAdvanceControlBounds(width, height + 100).y).toBe(control.y + 100);
    });

    /**
     * The lower band absorbs the surplus, which is what makes every reserve above it a fixed promise.
     * A band given a constant height would not grow with the canvas.
     */
    it('grows the shared lower band with the canvas and leaves the reserves above it fixed', () => {
        const lower = debriefLowerBand(width, height);
        expect(debriefLowerBand(width, height + 100).height).toBe(lower.height + 100);
        expect(debriefLowerBand(width, height + 100).y).toBe(lower.y);
        // **The reserves above it are fixed**, and this is the half of the claim that used to be two
        // assertions comparing a call to an identical call — true for every possible implementation,
        // including one that grew the reserves with the canvas (2.11 review; the shape Task 2 forbids
        // and the 2.7 and 2.8 reviews rejected seven times between them).
        //
        // Asserted as the composition rather than the signature: the summary and the toggle strip keep
        // their exact rectangles on a canvas 100px taller, and the strip still meets the lower band at
        // the gap. A reserve that started reading `canvasHeight` would move and fail here.
        const toggle = debriefDeeperTheoryToggleBand(width);
        expect(toggle.y + toggle.height + DEBRIEF_BAND_GAP).toBe(lower.y);
        expect(toggle.y + toggle.height + DEBRIEF_BAND_GAP).toBe(debriefLowerBand(width, height + 100).y);
        expect(debriefSummaryBand(width).y + debriefSummaryBand(width).height)
            .toBeLessThan(debriefLowerBand(width, height + 100).y);
    });

    /**
     * The band holds the tenant that needs it most: one challenge, at the size and wrap the room
     * actually paints. This is the arithmetic that decided the whole layout — see the module header —
     * so it is asserted rather than left in prose.
     */
    it('fits a paged challenge and the open deeper theory in the shared lower band', () => {
        const body = debriefLowerBodyBand(width, height);
        // A speaker attribution over three lines of objection.
        expect(body.height).toBeGreaterThanOrEqual(
            lineHeight(DEBRIEF_META_FONT_SIZE) + DEBRIEF_ROW_GAP + (3 * lineHeight(DEBRIEF_CRITIQUE_FONT_SIZE))
        );
        // Or four lines of the deeper theory, which is the other tenant of the same rectangle. The
        // shipped French text is two lines at this wrap, so the reserve is double the content.
        expect(body.height).toBeGreaterThanOrEqual(4 * lineHeight(DEBRIEF_BODY_FONT_SIZE));
        expect(contains(debriefLowerBand(width, height), body)).toBe(true);
    });

    it('right-aligns the two paging controls on the lower band heading row, earlier before later', () => {
        const band = debriefLowerBand(width, height);
        const earlier = debriefPageControlBand(-1, width, height);
        const later = debriefPageControlBand(1, width, height);
        expect(contains(band, earlier)).toBe(true);
        expect(contains(band, later)).toBe(true);
        expect(overlaps(earlier, later)).toBe(false);
        expect(later.x - (earlier.x + earlier.width)).toBe(DEBRIEF_PAGE_CONTROL_GAP);
        expect(later.x + later.width).toBe(band.x + band.width - DEBRIEF_BAND_PADDING);
        // Clear of the body underneath, so a control never sits over the objection it pages through.
        expect(overlaps(earlier, debriefLowerBodyBand(width, height))).toBe(false);
        expect(overlaps(later, debriefLowerBodyBand(width, height))).toBe(false);
        expect(debriefPageControlCentre(1, width, height)).toEqual({
            x: later.x + (DEBRIEF_PAGE_CONTROL_WIDTH / 2),
            y: later.y + (DEBRIEF_PAGE_CONTROL_HEIGHT / 2)
        });
    });

    it('puts the control centre at the middle of the bounds the widget is given', () => {
        const bounds = debriefAdvanceControlBounds(width, height);
        expect(debriefAdvanceControlCentre(width, height)).toEqual({
            x: bounds.x + (ADVANCE_CONTROL_WIDTH / 2),
            y: bounds.y + (ADVANCE_CONTROL_HEIGHT / 2)
        });
        expect(bounds.width).toBe(ADVANCE_CONTROL_WIDTH);
        expect(bounds.height).toBe(ADVANCE_CONTROL_HEIGHT);
        const strip = debriefDeeperTheoryToggleBand(width);
        expect(debriefDeeperTheoryToggleCentre(width))
            .toEqual({ x: strip.x + (strip.width / 2), y: strip.y + (strip.height / 2) });
    });

    /**
     * The rows the renderer builds fit the reserve their band states, at the row count the schema and
     * the domain actually produce: {@link DEBRIEF_CITED_SOURCE_ROWS} citations and one row per
     * `RECOGNITION_ID`.
     */
    it('fits every reserved row inside its own band, and none over another', () => {
        const sources = debriefSourcesBand(width);
        const sourceRows = Array.from({ length: DEBRIEF_CITED_SOURCE_ROWS },
            (_unused, index) => debriefSourceRowBand(index, width));
        sourceRows.forEach((row) => {
            expect(contains(sources, row)).toBe(true);
            expect(row.y + row.height).toBeLessThanOrEqual(sources.y + sources.height - DEBRIEF_BAND_PADDING);
        });
        expect(overlaps(sourceRows[0], sourceRows[1])).toBe(false);
        expect(sourceRows[1].y - sourceRows[0].y).toBe(DEBRIEF_SOURCE_ROW_HEIGHT + DEBRIEF_ROW_GAP);

        const recognition = debriefRecognitionBand(width);
        const intro = debriefRecognitionIntroBand(width);
        expect(contains(recognition, intro)).toBe(true);
        const rows = RECOGNITION_IDS.map((_id, index) => debriefRecognitionRowBand(index, width));
        rows.forEach((row) => {
            expect(contains(recognition, row)).toBe(true);
            // The intro is what keeps this list from reading as a tally, so no row may sit over it.
            expect(overlaps(row, intro)).toBe(false);
            expect(row.y + row.height).toBeLessThanOrEqual(recognition.y + recognition.height - DEBRIEF_BAND_PADDING);
        });
        expect(rows[1].y - rows[0].y).toBe(DEBRIEF_RECOGNITION_ROW_HEIGHT + DEBRIEF_ROW_GAP);
    });

    /**
     * Each reserve holds the number of lines its docstring claims, at the authored font size — the
     * check that fails if a band is shrunk without shrinking what it promises to hold. Arithmetic over
     * exported values, never a restated total.
     */
    it('reserves the line count each band claims, at the authored font sizes', () => {
        expect(debriefSummaryBand(width).height - (2 * DEBRIEF_BAND_PADDING))
            .toBeGreaterThanOrEqual(2 * lineHeight(DEBRIEF_SUMMARY_FONT_SIZE));

        const comparisonProse = DEBRIEF_COMPARISON_BAND_HEIGHT - (2 * DEBRIEF_BAND_PADDING)
            - (2 * lineHeight(DEBRIEF_SECTION_TITLE_FONT_SIZE)) - DEBRIEF_TITLE_GAP;
        expect(comparisonProse).toBeGreaterThanOrEqual(4 * lineHeight(DEBRIEF_BODY_FONT_SIZE));

        expect(debriefCounterfactualBand(width, height).height - (2 * DEBRIEF_BAND_PADDING))
            .toBeGreaterThanOrEqual(2 * lineHeight(DEBRIEF_WARNING_FONT_SIZE));

        // A source's name over its provenance line.
        expect(DEBRIEF_SOURCE_ROW_HEIGHT)
            .toBeGreaterThanOrEqual(lineHeight(DEBRIEF_BODY_FONT_SIZE) + lineHeight(DEBRIEF_META_FONT_SIZE));
        // A recognition label over two lines of its description.
        expect(DEBRIEF_RECOGNITION_ROW_HEIGHT).toBeGreaterThanOrEqual(
            lineHeight(DEBRIEF_RECOGNITION_LABEL_FONT_SIZE) + (2 * lineHeight(DEBRIEF_META_FONT_SIZE))
        );
    });

    it('derives every wrap bound from the band it belongs to rather than restating one', () => {
        const left = debriefSummaryBand(width);
        expect(debriefLeftTextWrap(width)).toBe(left.width - (2 * DEBRIEF_BAND_PADDING));
        expect(debriefRightTextWrap()).toBe(debriefRecognitionBand(width).width - (2 * DEBRIEF_BAND_PADDING));
        expect(debriefWarningTextWrap(width))
            .toBe(debriefCounterfactualBand(width, height).width - (2 * DEBRIEF_BAND_PADDING));
        expect(debriefLowerTextWrap(width))
            .toBe(debriefLowerBand(width, height).width - (2 * DEBRIEF_BAND_PADDING));
        // Narrower than the band's prose bound, by exactly what the state label beside it reserves.
        expect(debriefToggleLabelWrap(width) + DEBRIEF_TOGGLE_GAP + debriefToggleStateWrap())
            .toBe(debriefDeeperTheoryToggleBand(width).width - (2 * DEBRIEF_BAND_PADDING));
        expect(debriefToggleStateWrap()).toBe(DEBRIEF_TOGGLE_STATE_WIDTH);
        // The heading shares its row with both paging controls and wraps against what is left.
        expect(debriefLowerHeadingWrap(width)).toBeLessThan(debriefLowerTextWrap(width));
        expect(debriefLowerHeadingWrap(width)).toBeGreaterThan(0);
        expect(debriefPageControlLabelWrap()).toBe(DEBRIEF_PAGE_CONTROL_WIDTH - (2 * DEBRIEF_BAND_PADDING));
        // Wide enough that the clamp floor is a fallback rather than the normal case.
        expect(debriefLeftTextWrap(width)).toBeGreaterThan(20 * DEBRIEF_MIN_FONT_SIZE);
    });

    it('keeps the two columns side by side inside the room, with the gap the module states', () => {
        const left = debriefSummaryBand(width);
        const right = debriefRecognitionBand(width);
        expect(left.x).toBe(DEBRIEF_ROOM_INSET);
        expect(right.x - (left.x + left.width)).toBe(DEBRIEF_COLUMN_GAP);
        expect(right.x + right.width).toBe(width - DEBRIEF_ROOM_INSET);
        // The left column absorbs the surplus; the right one is fixed.
        expect(debriefRecognitionBand(width + 200).width).toBe(right.width);
        expect(debriefSummaryBand(width + 200).width).toBe(left.width + 200);
    });

    it('stacks the left column in reading order with the stated gap between bands', () => {
        const summary = debriefSummaryBand(width);
        const comparison = debriefComparisonBand(width);
        const sources = debriefSourcesBand(width);
        const strip = debriefDeeperTheoryToggleBand(width);
        expect(comparison.y - (summary.y + summary.height)).toBe(DEBRIEF_BAND_GAP);
        expect(sources.y - (comparison.y + comparison.height)).toBe(DEBRIEF_BAND_GAP);
        // The strip clears **both** columns, not only the one that happens to be taller today.
        expect(strip.y).toBeGreaterThanOrEqual(sources.y + sources.height + DEBRIEF_BAND_GAP);
        expect(strip.y).toBeGreaterThanOrEqual(
            debriefRecognitionBand(width).y + debriefRecognitionBand(width).height + DEBRIEF_BAND_GAP
        );
    });

    /**
     * The recognition column has to fit inside the region the *left* column's reserves define, because
     * {@link DEBRIEF_COLUMNS_HEIGHT} is stated from the left stack. This is the assertion that catches
     * a recognition reserve grown past the space the strip below it leaves.
     */
    it('fits the recognition column inside the columns region the left stack defines', () => {
        const recognition = debriefRecognitionBand(width);
        const summary = debriefSummaryBand(width);
        expect(recognition.y).toBe(summary.y);
        expect(recognition.height).toBeLessThanOrEqual(DEBRIEF_COLUMNS_HEIGHT);
        expect(DEBRIEF_COLUMNS_HEIGHT).toBe(
            debriefSourcesBand(width).y + debriefSourcesBand(width).height - summary.y
        );
    });

    it('keeps the strip and the shared lower band at the full room width', () => {
        const room = width - (2 * DEBRIEF_ROOM_INSET);
        expect(debriefDeeperTheoryToggleBand(width).width).toBe(room);
        expect(debriefLowerBand(width, height).width).toBe(room);
        expect(debriefDeeperTheoryToggleBand(width).height).toBe(DEBRIEF_TOGGLE_HEIGHT);
        expect(debriefLowerBand(width, height).y - (debriefDeeperTheoryToggleBand(width).y + DEBRIEF_TOGGLE_HEIGHT))
            .toBe(DEBRIEF_BAND_GAP);
        expect(debriefLowerBodyBand(width, height).y)
            .toBe(debriefLowerBand(width, height).y + DEBRIEF_BAND_PADDING + DEBRIEF_BAND_HEADING_HEIGHT + DEBRIEF_TITLE_GAP);
    });
});

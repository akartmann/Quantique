import { describe, expect, it } from 'vitest';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import {
    CASE_FILE_ACTION_GAP,
    CASE_FILE_ACTION_HEIGHT,
    CASE_FILE_ACTION_WIDTH,
    CASE_FILE_BAND_GAP,
    CASE_FILE_CONTROL_FONT_SIZE,
    CASE_FILE_MARGIN,
    CASE_FILE_META_FONT_SIZE,
    CASE_FILE_PADDING,
    CASE_FILE_PAGE_CONTROL_GAP,
    CASE_FILE_PAGE_CONTROL_WIDTH,
    CASE_FILE_PIN_GAP,
    CASE_FILE_PIN_HEIGHT,
    CASE_FILE_PIN_WIDTH,
    CASE_FILE_READINESS_ROWS,
    CASE_FILE_READINESS_ROW_HEIGHT,
    CASE_FILE_ROWS_PER_PAGE,
    CASE_FILE_ROW_FONT_SIZE,
    CASE_FILE_ROW_GAP,
    CASE_FILE_ROW_HEIGHT,
    CASE_FILE_SOURCE_ROWS,
    CASE_FILE_SOURCE_ROW_HEIGHT,
    caseFileActionLabelWrap,
    caseFileCloseControlBand,
    caseFileCloseControlCentre,
    caseFileContentFits,
    caseFileContentFloor,
    caseFileGuideBand,
    caseFileHeadingBand,
    caseFileIssuesBand,
    caseFileObservationPinCentre,
    caseFileObservationRowBand,
    caseFileObservationsBand,
    caseFilePageControlBand,
    caseFilePageControlCentre,
    caseFilePageControlLabelWrap,
    caseFilePanelBand,
    caseFilePeerReviewBand,
    caseFilePinLabelWrap,
    caseFileReadinessBand,
    caseFileReadinessRowBand,
    caseFileRequestControlBand,
    caseFileRequestControlCentre,
    caseFileRightTextWrap,
    caseFileRowPinBand,
    caseFileRowTextWrap,
    caseFileSaveControlBand,
    caseFileSaveControlCentre,
    caseFileSourcePinCentre,
    caseFileSourceRowBand,
    caseFileSourcesBand,
    caseFileStatusBand,
    type CaseFileRect
} from '../../src/adapters/phaser/renderers/caseFileGeometry';

/**
 * The shipped surface, and a deliberately different one — the same pair `LibraryGeometry.test.ts` and
 * `DebriefGeometry.test.ts` run against, and for the same reason: a single canvas size would let a
 * function that closed over `1024`/`768` pass every check.
 */
const CANVASES = [
    { name: `${DESIGN_WIDTH}×${DESIGN_HEIGHT} (the shipped design surface)`, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
    { name: '1280×800 (a surface the code must not have memorised)', width: 1280, height: 800 }
] as const;

const overlaps = (first: CaseFileRect, second: CaseFileRect): boolean =>
    first.x < second.x + second.width
    && second.x < first.x + first.width
    && first.y < second.y + second.height
    && second.y < first.y + first.height;

const within = (rect: CaseFileRect, canvasWidth: number, canvasHeight: number): boolean =>
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvasWidth && rect.y + rect.height <= canvasHeight;

const contains = (outer: CaseFileRect, inner: CaseFileRect): boolean =>
    inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;

const lineHeight = (fontSize: number): number => Math.ceil(fontSize * 1.35);

describe('the invariants this suite is written in terms of', () => {
    it('detects an overlap, and does not report one for rectangles that merely touch', () => {
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    });

    it('detects a rectangle that escapes its container on any edge', () => {
        const outer = { x: 10, y: 10, width: 20, height: 20 };
        expect(contains(outer, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
        expect(contains(outer, { x: 9, y: 10, width: 20, height: 20 })).toBe(false);
        expect(contains(outer, { x: 10, y: 10, width: 20, height: 21 })).toBe(false);
    });
});

describe.each(CANVASES)('the case file laid out on $name', ({ width, height }) => {
    const bands = (): readonly CaseFileRect[] => [
        caseFileHeadingBand(width),
        caseFileGuideBand(width),
        caseFileObservationsBand(width),
        caseFileSourcesBand(width),
        caseFileReadinessBand(width),
        caseFilePeerReviewBand(width),
        caseFileCloseControlBand(width, height)
    ];

    it('keeps the panel inside the canvas and every band inside the panel', () => {
        const panel = caseFilePanelBand(width, height);
        expect(within(panel, width, height)).toBe(true);
        bands().forEach((band) => {
            expect(within(band, width, height), JSON.stringify(band)).toBe(true);
            expect(contains(panel, band), JSON.stringify(band)).toBe(true);
        });
        expect(contains(panel, caseFileStatusBand(width, height))).toBe(true);
    });

    it('overlaps no band with any other', () => {
        const all = bands();
        all.forEach((band, index) => {
            all.slice(index + 1).forEach((other) => {
                expect(overlaps(band, other), `${JSON.stringify(band)} vs ${JSON.stringify(other)}`).toBe(false);
            });
        });
    });

    /**
     * The whole overlay has to fit between its own guide and its own way out — and the way out is
     * measured up from the panel's floor, so nothing above it can push it off.
     *
     * `caseFileContentFits` is the module's own claim about that; it is checked here rather than
     * trusted, and the arithmetic behind it is re-derived so a helper that always returned `true`
     * would fail.
     */
    it('fits both columns above the way out, which is measured up from the panel floor', () => {
        expect(caseFileContentFits(width, height)).toBe(true);
        const close = caseFileCloseControlBand(width, height);
        const panel = caseFilePanelBand(width, height);
        expect(close.y + close.height).toBe(panel.y + panel.height - CASE_FILE_PADDING);
        expect(caseFileContentFloor(width)).toBeLessThanOrEqual(close.y - CASE_FILE_BAND_GAP);

        // Growing the canvas moves the way out by exactly the growth: it is not pinned to the content.
        expect(caseFileCloseControlBand(width, height + 100).y).toBe(close.y + 100);
    });

    it('reserves one row per observation on a page, per cited reference, and per readiness code', () => {
        const observations = caseFileObservationsBand(width);
        const rows = Array.from({ length: CASE_FILE_ROWS_PER_PAGE },
            (_unused, index) => caseFileObservationRowBand(index, width));
        rows.forEach((row) => expect(contains(observations, row), JSON.stringify(row)).toBe(true));
        rows.slice(1).forEach((row, index) => {
            expect(overlaps(rows[index], row)).toBe(false);
            expect(row.y - rows[index].y).toBe(CASE_FILE_ROW_HEIGHT + CASE_FILE_ROW_GAP);
        });

        const sources = caseFileSourcesBand(width);
        const sourceRows = Array.from({ length: CASE_FILE_SOURCE_ROWS },
            (_unused, index) => caseFileSourceRowBand(index, width));
        sourceRows.forEach((row) => expect(contains(sources, row), JSON.stringify(row)).toBe(true));
        expect(sourceRows[1].y - sourceRows[0].y).toBe(CASE_FILE_SOURCE_ROW_HEIGHT + CASE_FILE_ROW_GAP);

        // Every member of `MissingConclusionRequirementCode`, not "the number the shipped case usually
        // produces": the list is a pure function of the record and several codes can hold at once.
        const readiness = caseFileReadinessBand(width);
        Array.from({ length: CASE_FILE_READINESS_ROWS }, (_unused, index) => index).forEach((index) => {
            expect(contains(readiness, caseFileReadinessRowBand(index, width)), `row ${index}`).toBe(true);
        });
        expect(caseFileReadinessRowBand(1, width).y - caseFileReadinessRowBand(0, width).y)
            .toBe(CASE_FILE_READINESS_ROW_HEIGHT);
    });

    /**
     * Each row holds what it claims at the authored sizes: a title over a detail line, with the pin
     * beside them rather than over them.
     */
    it('fits a title, a detail line and a pin inside every row', () => {
        [caseFileObservationRowBand(0, width), caseFileSourceRowBand(0, width)].forEach((row) => {
            const pin = caseFileRowPinBand(row);
            expect(contains(row, pin), JSON.stringify(row)).toBe(true);
            expect(pin.x + pin.width).toBe(row.x + row.width);
            expect(pin.height).toBe(CASE_FILE_PIN_HEIGHT);
            // The text has the row less the pin's reserve, and the row is tall enough for both lines.
            expect(row.height).toBeGreaterThanOrEqual(
                lineHeight(CASE_FILE_ROW_FONT_SIZE) + lineHeight(CASE_FILE_META_FONT_SIZE)
            );
            expect(pin.width + CASE_FILE_PIN_GAP).toBeLessThan(row.width);
        });
        expect(caseFileRowTextWrap(width))
            .toBe(caseFileObservationRowBand(0, width).width - CASE_FILE_PIN_WIDTH - CASE_FILE_PIN_GAP);
        // Both pinnable rows are in the **left** column, so both wrap against the same bound. The
        // right column's own bound reserves no pin, because nothing over there is pinnable — this
        // assertion is what caught the reference rows wrapping against it.
        expect(caseFileRowTextWrap(width))
            .toBe(caseFileSourceRowBand(0, width).width - CASE_FILE_PIN_WIDTH - CASE_FILE_PIN_GAP);
        expect(caseFileRightTextWrap()).toBe(caseFileReadinessBand(width).width);
    });

    it('centres every exported click target inside the control it names', () => {
        const pin = caseFileRowPinBand(caseFileObservationRowBand(2, width));
        expect(caseFileObservationPinCentre(2, width))
            .toEqual({ x: pin.x + (pin.width / 2), y: pin.y + (pin.height / 2) });
        const sourcePin = caseFileRowPinBand(caseFileSourceRowBand(1, width));
        expect(caseFileSourcePinCentre(1, width))
            .toEqual({ x: sourcePin.x + (sourcePin.width / 2), y: sourcePin.y + (sourcePin.height / 2) });

        const request = caseFileRequestControlBand(width);
        expect(caseFileRequestControlCentre(width))
            .toEqual({ x: request.x + (request.width / 2), y: request.y + (request.height / 2) });
        const save = caseFileSaveControlBand(width);
        expect(caseFileSaveControlCentre(width))
            .toEqual({ x: save.x + (save.width / 2), y: save.y + (save.height / 2) });
        const close = caseFileCloseControlBand(width, height);
        expect(caseFileCloseControlCentre(width, height))
            .toEqual({ x: close.x + (close.width / 2), y: close.y + (close.height / 2) });
        const later = caseFilePageControlBand(1, width);
        expect(caseFilePageControlCentre(1, width))
            .toEqual({ x: later.x + (later.width / 2), y: later.y + (later.height / 2) });
    });

    it('lays the paging controls under the last row, earlier before later, inside the band', () => {
        const band = caseFileObservationsBand(width);
        const earlier = caseFilePageControlBand(-1, width);
        const later = caseFilePageControlBand(1, width);
        expect(contains(band, earlier)).toBe(true);
        expect(contains(band, later)).toBe(true);
        expect(overlaps(earlier, later)).toBe(false);
        expect(later.x - (earlier.x + earlier.width)).toBe(CASE_FILE_PAGE_CONTROL_GAP);
        // Under the last row rather than over it.
        const lastRow = caseFileObservationRowBand(CASE_FILE_ROWS_PER_PAGE - 1, width);
        expect(earlier.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height);
        expect(overlaps(earlier, lastRow)).toBe(false);
    });

    /**
     * The peer-review pane stacks request → issues → save, and the issues have room for what the
     * shipped case can actually return: `peerReviewRules` authors three, each two lines at the meta
     * size.
     */
    it('stacks the peer-review pane with room for the issues it can return', () => {
        const band = caseFilePeerReviewBand(width);
        const request = caseFileRequestControlBand(width);
        const issues = caseFileIssuesBand(width);
        const save = caseFileSaveControlBand(width);
        [request, issues, save].forEach((rect) => expect(contains(band, rect), JSON.stringify(rect)).toBe(true));
        expect(issues.y - (request.y + request.height)).toBe(CASE_FILE_ACTION_GAP);
        expect(save.y - (issues.y + issues.height)).toBe(CASE_FILE_ACTION_GAP);
        expect(overlaps(request, issues)).toBe(false);
        expect(overlaps(issues, save)).toBe(false);
        expect(issues.height).toBeGreaterThanOrEqual(3 * 2 * lineHeight(CASE_FILE_META_FONT_SIZE));
        expect(request.height).toBe(CASE_FILE_ACTION_HEIGHT);
        expect(save.width).toBe(CASE_FILE_ACTION_WIDTH);
    });

    it('derives every label bound from the control it belongs to rather than restating one', () => {
        expect(caseFilePinLabelWrap()).toBeLessThan(CASE_FILE_PIN_WIDTH);
        expect(caseFilePageControlLabelWrap()).toBeLessThan(CASE_FILE_PAGE_CONTROL_WIDTH);
        expect(caseFileActionLabelWrap()).toBeLessThan(CASE_FILE_ACTION_WIDTH);
        [caseFilePinLabelWrap(), caseFilePageControlLabelWrap(), caseFileActionLabelWrap()]
            .forEach((bound) => expect(bound).toBeGreaterThan(4 * CASE_FILE_CONTROL_FONT_SIZE));
    });

    it('keeps the two columns side by side inside the panel, with the left one absorbing the surplus', () => {
        const left = caseFileObservationsBand(width);
        const right = caseFileReadinessBand(width);
        expect(left.x).toBe(CASE_FILE_MARGIN + CASE_FILE_PADDING);
        expect(right.x + right.width).toBe(width - CASE_FILE_MARGIN - CASE_FILE_PADDING);
        expect(right.x).toBeGreaterThan(left.x + left.width);
        expect(caseFileReadinessBand(width + 200).width).toBe(right.width);
        expect(caseFileObservationsBand(width + 200).width).toBe(left.width + 200);
    });

    it('puts the status line beside the way out rather than under it', () => {
        const close = caseFileCloseControlBand(width, height);
        const status = caseFileStatusBand(width, height);
        expect(overlaps(close, status)).toBe(false);
        expect(status.x).toBeGreaterThan(close.x + close.width);
        expect(status.y).toBe(close.y);
        expect(status.width).toBeGreaterThan(0);
    });
});

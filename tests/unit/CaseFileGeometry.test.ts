import { describe, expect, it } from 'vitest';

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import {
    CASE_FILE_ISSUES_HEIGHT,
    CASE_FILE_ISSUES_LINES,
    CASE_FILE_MIN_FONT_SIZE,
    CASE_FILE_ACTION_GAP,
    CASE_FILE_ACTION_HEIGHT,
    CASE_FILE_ACTION_WIDTH,
    CASE_FILE_BAND_GAP,
    CASE_FILE_CONSULTATION_LINES,
    CASE_FILE_CONSULTATION_MIN_HEIGHT,
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
    CASE_FILE_RECORD_CONTROL_COUNT,
    CASE_FILE_STATUS_LINES,
    CASE_FILE_READINESS_ROW_HEIGHT,
    CASE_FILE_ROWS_PER_PAGE,
    CASE_FILE_RIGHT_COLUMN_WIDTH,
    CASE_FILE_ROW_FONT_SIZE,
    CASE_FILE_ROW_INSET_X,
    CASE_FILE_ROW_INSET_Y,
    CASE_FILE_ROW_GAP,
    CASE_FILE_ROW_HEIGHT,
    CASE_FILE_SOURCE_ROWS,
    CASE_FILE_SOURCE_ROW_HEIGHT,
    caseFileActionLabelWrap,
    caseFileCloseControlBand,
    caseFileCloseControlCentre,
    caseFileConsultControlBand,
    caseFileConsultationBand,
    caseFileConsultationTextBand,
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
    caseFileRecordControlBand,
    caseFileRecordControlLabelWrap,
    caseFileLineHeight,
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

/** The source's own helper, not a copy of its multiplier (2.11 review). */
const lineHeight = caseFileLineHeight;

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
            expect(pin.width + CASE_FILE_PIN_GAP).toBeLessThan(row.width);
        });

        /**
         * **Both insets, both lines.** The reserve has to hold the row's own top and bottom inset as
         * well as its text, which is what the 2.11 review found neither row doing: the reference row
         * left `44 - 8 - 26` = 10px for a provenance line that cannot render under ~15, and the
         * observation row left one line for a detail that wraps to two in both locales. Asserted as an
         * equality against the derivation rather than a `toBeGreaterThanOrEqual`, because a floor a
         * reserve already clears by 20px is a test that cannot fail for the reason it was written.
         */
        expect(caseFileObservationRowBand(0, width).height).toBe(
            (2 * CASE_FILE_ROW_INSET_Y)
            + lineHeight(CASE_FILE_ROW_FONT_SIZE)
            + (2 * lineHeight(CASE_FILE_META_FONT_SIZE))
        );
        expect(caseFileSourceRowBand(0, width).height).toBe(
            (2 * CASE_FILE_ROW_INSET_Y)
            + lineHeight(CASE_FILE_ROW_FONT_SIZE)
            + lineHeight(CASE_FILE_META_FONT_SIZE)
        );

        // The wrap reserves the pin, the gap **and the row's own left inset** — the text starts at
        // `row.x + CASE_FILE_ROW_INSET_X`, so a bound that ignored it let a row wrap into the gap.
        expect(caseFileRowTextWrap(width)).toBe(
            caseFileObservationRowBand(0, width).width
            - CASE_FILE_PIN_WIDTH - CASE_FILE_PIN_GAP - CASE_FILE_ROW_INSET_X
        );
        // Both pinnable rows are in the **left** column, so both wrap against the same bound. The
        // right column's own bound reserves no pin, because nothing over there is pinnable — this
        // assertion is what caught the reference rows wrapping against it.
        expect(caseFileRowTextWrap(width)).toBe(
            caseFileSourceRowBand(0, width).width
            - CASE_FILE_PIN_WIDTH - CASE_FILE_PIN_GAP - CASE_FILE_ROW_INSET_X
        );
        // The right column's bound is the width of the row that actually consumes it, reached through
        // `caseFileReadinessRowBand` rather than through the helper's own definition. The previous form
        // compared it to `caseFileReadinessBand(width).width`, which *is* the constant the helper
        // returns — `K === K`, true for any implementation (2.11 review).
        expect(caseFileRightTextWrap()).toBe(caseFileReadinessRowBand(0, width).width);
        // And it carries **no pin reserve**, unlike the left column's rows: this is the difference the
        // reference rows got wrong by wrapping against the wrong one of the two.
        expect(caseFileRightTextWrap() - caseFileRowTextWrap(width))
            .toBe(CASE_FILE_RIGHT_COLUMN_WIDTH - caseFileObservationRowBand(0, width).width
                + CASE_FILE_PIN_WIDTH + CASE_FILE_PIN_GAP + CASE_FILE_ROW_INSET_X);
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
     * The peer-review pane stacks request → issues → save, and the issues band holds the reserve it
     * states.
     *
     * **The "three rules, each two lines" figure this docstring used to carry was wrong**, and the
     * browser is what said so (Story 4.3, AC5). Measured against `caseFileRightTextWrap`'s 372px at the
     * meta size, the composed `caseFile.review.issue` lines run to **three** French lines on
     * Morley–Miller and **four** on Young, so the two an ordinary player can have standing at once are
     * six and eight — not six across all three. The old bound, `3 × 2 × lineHeight`, came to 102 and the
     * band was 106, so it passed with 4px to spare while the surface it described needed 136 for Young.
     * A reserve asserted against a line count nobody had measured, which is this project's most-repeated
     * shape.
     *
     * It now asserts two different things, and Story 4.3's code review is why there are two. Deriving the
     * expected height from {@link CASE_FILE_ISSUES_LINES} and {@link CASE_FILE_MIN_FONT_SIZE} — the same
     * two constants `CASE_FILE_ISSUES_HEIGHT` is *defined* from — proves only that
     * `caseFilePeerReviewBand` forwards the constant: set the line count to 1 and both sides move
     * together, so neither "named change that breaks this" broke it. That assertion is kept for the
     * forwarding property and is no longer the guard.
     *
     * The guard is the **absolute** floor beside it. 120px is not arithmetic over these constants; it is
     * what `french-typography.spec.ts` measured in a real browser as Young's worst reachable French pair
     * (eight wrapped lines at the clamp's floor), and it stays 120 when the constants move, which is the
     * whole point. Why the floor rather than the authored size is at `CASE_FILE_ISSUES_HEIGHT`: eight
     * authored-size lines need 136px, and the panel's headroom is now 0.
     *
     * **Named change that breaks this:** lowering `CASE_FILE_ISSUES_LINES` (8 → 5 gives 75px and fails the
     * absolute floor), or lowering `CASE_FILE_MIN_FONT_SIZE`.
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
        // The band forwards the reserve rather than computing its own.
        expect(issues.height).toBe(CASE_FILE_ISSUES_HEIGHT);

        // The guard: the measured requirement, in pixels, independent of the constants above. Young's
        // worst reachable French pair wraps to eight lines at the clamp's floor — measured in a real
        // browser by `french-typography.spec.ts`, not derived here — and that is 120px. A change to
        // `CASE_FILE_ISSUES_LINES` or `CASE_FILE_MIN_FONT_SIZE` moves the expression above with it and
        // fails here, which is what the previous form could not do.
        const YOUNG_WORST_FRENCH_PAIR_PX = 120;
        expect(issues.height).toBeGreaterThanOrEqual(YOUNG_WORST_FRENCH_PAIR_PX);
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

    /**
     * The status line moved above the bottom row and took the whole panel width (Story 2.12).
     *
     * It used to sit beside the way out, in whatever was left of that row. The record actions now
     * occupy that space, and the honest answer was not to shrink a slot that already renders arbitrary
     * `selectLocalizedError` output — a French `completion-timestamp-not-later` is 121 characters — into
     * a narrower one. It gets its own band, two lines tall, spanning the panel.
     */
    it('gives the status line its own two-line band above the bottom row', () => {
        const close = caseFileCloseControlBand(width, height);
        const status = caseFileStatusBand(width, height);
        expect(overlaps(close, status)).toBe(false);
        expect(status.x).toBe(close.x);
        expect(status.y + status.height).toBeLessThanOrEqual(close.y);
        expect(status.width).toBe(width - (2 * CASE_FILE_MARGIN) - (2 * CASE_FILE_PADDING));
        expect(status.height).toBe(CASE_FILE_STATUS_LINES * caseFileLineHeight(CASE_FILE_META_FONT_SIZE));
    });

    /**
     * The three record actions share the bottom row with the way out and clear both it and each other.
     *
     * `CaseProgressPanel` owned export, import and print and is deleted; ADR-007's print *view* was
     * retained with nothing left to open it (D1). All-pairs rather than pairwise-by-hand, because the
     * row's width is derived from the panel and a margin change is exactly what would push the last one
     * off the edge without anybody noticing.
     */
    it('spends the bottom row on the way out and the three record actions, without overlap', () => {
        const close = caseFileCloseControlBand(width, height);
        const records = Array.from(
            { length: CASE_FILE_RECORD_CONTROL_COUNT },
            (_unused, index) => caseFileRecordControlBand(index, width, height)
        );

        expect(records).toHaveLength(3);
        records.forEach((band) => {
            expect(band.y).toBe(close.y);
            expect(band.height).toBe(close.height);
            expect(overlaps(close, band)).toBe(false);
        });
        records.forEach((band, index) => records.slice(index + 1)
            .forEach((other) => expect(overlaps(band, other)).toBe(false)));
        // The row ends on the panel's inner edge, to within the pixel the flooring leaves — derived, so
        // a margin change moves it rather than pushing the last control outside the panel.
        const innerRight = width - CASE_FILE_MARGIN - CASE_FILE_PADDING;
        const rowRight = records[records.length - 1]!.x + records[records.length - 1]!.width;
        expect(rowRight).toBeLessThanOrEqual(innerRight);
        expect(innerRight - rowRight).toBeLessThan(CASE_FILE_RECORD_CONTROL_COUNT);
        expect(caseFileRecordControlLabelWrap(width)).toBeGreaterThan(4 * CASE_FILE_CONTROL_FONT_SIZE);
    });

    /**
     * The consultation gets the band the peer-review pane leaves empty outside `review`, and enough of it.
     *
     * `caseFileContentFits` is the arbiter for both. The height assertion is deliberately *not* against
     * the band's own value — that would be tautological, since the band is defined as the remainder of
     * its column — but against the reserve four two-line authored blocks actually need.
     */
    it('gives the consultation the right column below the readiness list, with room for its four blocks', () => {
        const readiness = caseFileReadinessBand(width);
        const consultation = caseFileConsultationBand(width, height);
        const peerReview = caseFilePeerReviewBand(width);

        expect(consultation.x).toBe(readiness.x);
        expect(consultation.width).toBe(readiness.width);
        expect(consultation.y).toBe(peerReview.y);
        expect(overlaps(readiness, consultation)).toBe(false);
        expect(consultation.height).toBeGreaterThanOrEqual(CASE_FILE_CONSULTATION_MIN_HEIGHT);

        const control = caseFileConsultControlBand(width, height);
        const text = caseFileConsultationTextBand(width, height);
        expect(overlaps(control, text)).toBe(false);
        expect(control.y).toBeGreaterThan(consultation.y);
        expect(text.y + text.height).toBeLessThanOrEqual(consultation.y + consultation.height);
        // Room for the eight lines the reserve is stated in, at the authored size.
        expect(text.height)
            .toBeGreaterThanOrEqual(CASE_FILE_CONSULTATION_LINES * caseFileLineHeight(CASE_FILE_META_FONT_SIZE));
        // And it clears the way out and the status line below it.
        expect(overlaps(text, caseFileStatusBand(width, height))).toBe(false);
        expect(overlaps(text, caseFileCloseControlBand(width, height))).toBe(false);
    });
});

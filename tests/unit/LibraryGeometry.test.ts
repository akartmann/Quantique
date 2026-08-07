import { describe, expect, it } from 'vitest';

import {
    ADVANCE_CONTROL_HEIGHT,
    ARTIFACT_GAP,
    ARTIFACT_MAX_WIDTH,
    GATE_LINE_FONT_SIZE,
    GATE_SPEAKER_FONT_SIZE,
    detailTextWrap,
    gateLineTextWrap,
    libraryAdvanceControlBounds,
    libraryAdvanceControlCentre,
    libraryArtifactCentre,
    libraryArtifactLabelBand,
    libraryArtifactPlacements,
    libraryDetailPanelBand,
    libraryGateLineBand,
    libraryReadingSurfaceBand,
    libraryShelfBand,
    type LibraryRect
} from '../../src/adapters/phaser/scenes/libraryGeometry';

/**
 * The shipped surface, and a deliberately different one.
 *
 * Every assertion below runs against both. A single canvas size would let a function that closed over
 * `1024`/`768` pass every check — which is precisely what AC7 forbids and what this pair detects.
 */
const CANVASES = [
    { name: '1024×768 (the shipped design surface)', width: 1024, height: 768 },
    { name: '1280×800 (a surface the code must not have memorised)', width: 1280, height: 800 }
] as const;

/**
 * The invariants, written out here rather than imported from the module under test.
 *
 * A predicate supplied by the source it is checking can only prove the source agrees with itself: a
 * broken `rectanglesOverlap` would make every no-overlap assertion below pass vacuously. These are
 * four lines each and they are the whole point of the test.
 */
const overlaps = (first: LibraryRect, second: LibraryRect): boolean =>
    first.x < second.x + second.width
    && second.x < first.x + first.width
    && first.y < second.y + second.height
    && second.y < first.y + first.height;

const within = (rect: LibraryRect, canvasWidth: number, canvasHeight: number): boolean =>
    rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvasWidth && rect.y + rect.height <= canvasHeight;

/** Proof the invariant predicates are live rather than unfalsifiable. */
describe('the invariants this suite is written in terms of', () => {
    it('detects an overlap, and does not report one for rectangles that merely touch', () => {
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    });

    it('detects a rectangle that leaves the canvas on each edge', () => {
        expect(within({ x: 0, y: 0, width: 10, height: 10 }, 10, 10)).toBe(true);
        expect(within({ x: -1, y: 0, width: 10, height: 10 }, 10, 10)).toBe(false);
        expect(within({ x: 0, y: 0, width: 11, height: 10 }, 10, 10)).toBe(false);
        expect(within({ x: 0, y: 1, width: 10, height: 10 }, 10, 10)).toBe(false);
    });
});

describe.each(CANVASES)('the reading room laid out on $name', ({ width, height }) => {
    const bands = (): readonly LibraryRect[] => [
        libraryShelfBand(width),
        libraryReadingSurfaceBand(width, height),
        libraryAdvanceControlBounds(width, height),
        libraryGateLineBand(width, height)
    ];

    it('keeps every band inside the canvas', () => {
        bands().forEach((band) => expect(within(band, width, height), JSON.stringify(band)).toBe(true));
    });

    it('stacks the four bands without any two overlapping', () => {
        const all = bands();
        all.forEach((band, index) => {
            all.slice(index + 1).forEach((other) => {
                expect(overlaps(band, other), `${JSON.stringify(band)} overlaps ${JSON.stringify(other)}`).toBe(false);
            });
        });
    });

    it('puts the advance control clear of the gate line band, above it', () => {
        const control = libraryAdvanceControlBounds(width, height);
        const gate = libraryGateLineBand(width, height);

        // Not `toBeGreaterThan(0)` on a coordinate built from positive offsets — the vacuous shape the
        // 2.7 review rejected four of. This is the relationship the layout has to hold: the control
        // ends before the reserved line clearance begins, so a two-line French line never paints over
        // the way out of the room.
        expect(control.y + control.height).toBeLessThanOrEqual(gate.y);
        expect(control.height).toBe(ADVANCE_CONTROL_HEIGHT);
    });

    it('anchors the gate line band and the control above it to the canvas floor', () => {
        const gate = libraryGateLineBand(width, height);
        const control = libraryAdvanceControlBounds(width, height);
        const taller = libraryGateLineBand(width, height + 200);
        const tallerControl = libraryAdvanceControlBounds(width, height + 200);

        // The check that catches a band pinned to a fixed top: give the canvas 200 more pixels and both
        // have to move down by exactly 200, keeping their margin from the floor rather than their
        // distance from the ceiling. That is the "measure from the floor" rule five reviews have now
        // asked for, stated as arithmetic instead of as a comment.
        expect(taller.y - gate.y).toBe(200);
        expect(tallerControl.y - control.y).toBe(200);
        expect(height - (gate.y + gate.height)).toBe((height + 200) - (taller.y + taller.height));
    });

    it('gives the reading surface the slack between the shelf and the control, never a negative height', () => {
        const shelf = libraryShelfBand(width);
        const surface = libraryReadingSurfaceBand(width, height);
        const control = libraryAdvanceControlBounds(width, height);

        expect(surface.height).toBeGreaterThan(0);
        expect(surface.y).toBeGreaterThan(shelf.y + shelf.height);
        expect(surface.y + surface.height).toBeLessThan(control.y);
    });

    it('keeps the detail panel inside the reading surface it sits on', () => {
        const surface = libraryReadingSurfaceBand(width, height);
        const panel = libraryDetailPanelBand(width, height);

        expect(panel.x).toBeGreaterThan(surface.x);
        expect(panel.y).toBeGreaterThan(surface.y);
        expect(panel.x + panel.width).toBeLessThan(surface.x + surface.width);
        expect(panel.y + panel.height).toBeLessThan(surface.y + surface.height);
    });

    it('wraps text to bounds narrower than the band that holds it, in both bands', () => {
        // A wrap wider than its own band is the defect: the text would run to the band edge and past it.
        expect(detailTextWrap(width, height)).toBeLessThan(libraryDetailPanelBand(width, height).width);
        expect(gateLineTextWrap(width)).toBeLessThan(libraryGateLineBand(width, height).width);
    });

    it('reserves enough gate clearance for the longest line the content schema permits', () => {
        // `readingGateHints` caps a line at 320 characters per locale. A conservative average advance
        // of 6.2px per character at 14px UI type — French runs wider than English, and this is above
        // the measured mean for both — gives the wrapped line count the band has to hold, over an
        // attributed speaker line and two paddings.
        const MAX_AUTHORED_CHARACTERS = 320;
        const AVERAGE_ADVANCE_PX = 6.2;
        const lineHeight = Math.ceil(GATE_LINE_FONT_SIZE * 1.35);
        const wrappedLines = Math.ceil((MAX_AUTHORED_CHARACTERS * AVERAGE_ADVANCE_PX) / gateLineTextWrap(width));
        const needed = (wrappedLines * lineHeight) + Math.ceil(GATE_SPEAKER_FONT_SIZE * 1.35);

        expect(libraryGateLineBand(width, height).height).toBeGreaterThanOrEqual(needed);
    });
});

describe.each(CANVASES)('artifact placement on $name', ({ width, height }) => {
    // 1, 2, and 4: the single-object case the max width exists for, the two Young ships, and a count a
    // later case could carry. Placement is total over all three.
    it.each([1, 2, 4])('places %i artifact(s) inside the shelf, without overlapping each other', (count) => {
        const placements = libraryArtifactPlacements(count, width);
        const shelf = libraryShelfBand(width);

        expect(placements).toHaveLength(count);
        placements.forEach((placement) => {
            expect(within(placement, width, height), JSON.stringify(placement)).toBe(true);
            expect(overlaps(placement, shelf), 'an object must stand on the shelf').toBe(true);
            expect(placement.x).toBeGreaterThanOrEqual(shelf.x);
            expect(placement.x + placement.width).toBeLessThanOrEqual(shelf.x + shelf.width);
            expect(placement.y).toBeGreaterThanOrEqual(shelf.y);
            expect(placement.y + placement.height).toBeLessThanOrEqual(shelf.y + shelf.height);
        });
        placements.forEach((placement, index) => {
            placements.slice(index + 1).forEach((other) => {
                expect(overlaps(placement, other), `object ${index} overlaps another`).toBe(false);
            });
        });
    });

    it.each([1, 2, 4])('keeps %i artifact(s) clear of the detail panel and the way out', (count) => {
        const panel = libraryDetailPanelBand(width, height);
        const control = libraryAdvanceControlBounds(width, height);
        const gate = libraryGateLineBand(width, height);

        libraryArtifactPlacements(count, width).forEach((placement, index) => {
            expect(overlaps(placement, panel), `object ${index} covers the detail panel`).toBe(false);
            expect(overlaps(placement, control), `object ${index} covers the advance control`).toBe(false);
            expect(overlaps(placement, gate), `object ${index} covers the colleague's line`).toBe(false);
        });
    });

    it.each([2, 4])('leaves exactly the authored gutter between %i adjacent objects', (count) => {
        const placements = libraryArtifactPlacements(count, width);

        placements.slice(1).forEach((placement, index) => {
            const previous = placements[index]!;
            expect(placement.x - (previous.x + previous.width)).toBeCloseTo(ARTIFACT_GAP, 6);
        });
    });

    it('centres the row on the shelf at every count', () => {
        const shelf = libraryShelfBand(width);

        [1, 2, 4].forEach((count) => {
            const placements = libraryArtifactPlacements(count, width);
            const leftGap = placements[0]!.x - shelf.x;
            const last = placements.at(-1)!;
            const rightGap = (shelf.x + shelf.width) - (last.x + last.width);

            expect(leftGap).toBeCloseTo(rightGap, 6);
        });
    });

    it('clamps a lone object rather than stretching it the width of the shelf', () => {
        const [only] = libraryArtifactPlacements(1, width);

        expect(only!.width).toBe(ARTIFACT_MAX_WIDTH);
        expect(only!.width).toBeLessThan(libraryShelfBand(width).width);
    });

    it('narrows objects as the count grows, rather than letting them collide', () => {
        const widthAt = (count: number): number => libraryArtifactPlacements(count, width)[0]!.width;

        expect(widthAt(4)).toBeLessThan(widthAt(3));
        expect(widthAt(3)).toBeLessThanOrEqual(widthAt(2));
    });

    it('returns nothing for a count of zero rather than dividing by it', () => {
        expect(libraryArtifactPlacements(0, width)).toStrictEqual([]);
        expect(libraryArtifactPlacements(-1, width)).toStrictEqual([]);
    });

    it('keeps every readable title strip inside the object it belongs to', () => {
        libraryArtifactPlacements(4, width).forEach((placement, index) => {
            const label = libraryArtifactLabelBand(placement);

            expect(label.x).toBeGreaterThan(placement.x);
            expect(label.y).toBeGreaterThan(placement.y);
            expect(label.x + label.width).toBeLessThan(placement.x + placement.width);
            expect(label.y + label.height).toBeLessThanOrEqual(placement.y + placement.height);
            expect(label.height, `object ${index} has no room for its title`).toBeGreaterThan(0);
        });
    });
});

describe('the click targets a browser spec derives from this module', () => {
    const { width, height } = CANVASES[0];

    it('centres on the object it names, at every count', () => {
        [1, 2, 4].forEach((count) => {
            libraryArtifactPlacements(count, width).forEach((placement, index) => {
                const centre = libraryArtifactCentre(index, count, width);

                expect(centre).toStrictEqual({
                    x: placement.x + (placement.width / 2),
                    y: placement.y + (placement.height / 2)
                });
            });
        });
    });

    it('returns nothing for an object that is not on the shelf', () => {
        expect(libraryArtifactCentre(2, 2, width)).toBeUndefined();
        expect(libraryArtifactCentre(-1, 2, width)).toBeUndefined();
    });

    it('centres on the advance control the scene actually draws', () => {
        const bounds = libraryAdvanceControlBounds(width, height);

        expect(libraryAdvanceControlCentre(width, height)).toStrictEqual({
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2)
        });
    });
});

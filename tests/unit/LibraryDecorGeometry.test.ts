import { describe, expect, it } from 'vitest';

import {
    CASE_CORNICE_HEIGHT,
    CASE_PLANK_HEIGHT,
    FLOOR_STRIP_HEIGHT,
    SPINE_TINT_COUNT,
    libraryCaseAlcoves,
    libraryCaseCornice,
    libraryCaseInterior,
    libraryCasePilasters,
    libraryCasePlank,
    libraryFilledShelves,
    libraryFloorBand,
    libraryLeftBayBand,
    libraryRightBayBand,
    libraryShelfLights,
    libraryWainscotBand
} from '../../src/adapters/phaser/scenes/libraryDecorGeometry';
import {
    ARTIFACT_HEIGHT,
    ARTIFACT_TOP_INSET,
    SHELF_HEIGHT,
    SHELF_INSET,
    libraryAdvanceControlBounds,
    libraryArtifactPlacements,
    libraryGateLineBand,
    libraryReadingSurfaceBand,
    libraryShelfBand,
    type LibraryRect
} from '../../src/adapters/phaser/scenes/libraryGeometry';

/**
 * The reading room's scenery (Story 2.8, design revision).
 *
 * The scenery is decoration, so almost nothing here is about how it *looks* — that is a judgement a
 * test cannot make. What it is about is the two ways decoration can actually break the game: by
 * escaping the surface it is drawn on, and by moving something the player has to click. Both are
 * arithmetic, and both are checked below at two canvas sizes.
 */

const CANVASES = [
    { name: '1024×768 (the shipped design surface)', width: 1024, height: 768 },
    { name: '1280×800 (a surface the code must not have memorised)', width: 1280, height: 800 }
] as const;

/** Written out here rather than imported, so a broken predicate cannot make the suite pass vacuously. */
const overlaps = (first: LibraryRect, second: LibraryRect): boolean =>
    first.x < second.x + second.width
    && second.x < first.x + first.width
    && first.y < second.y + second.height
    && second.y < first.y + first.height;

const contains = (outer: LibraryRect, inner: LibraryRect): boolean =>
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;

describe('the invariants this suite is written in terms of', () => {
    it('detects an overlap, and does not report one for rectangles that merely touch', () => {
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
        expect(overlaps({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    });

    it('detects containment, and rejects a rectangle that pokes out of any edge', () => {
        const outer = { x: 0, y: 0, width: 10, height: 10 };
        expect(contains(outer, { x: 1, y: 1, width: 8, height: 8 })).toBe(true);
        expect(contains(outer, { x: -1, y: 1, width: 8, height: 8 })).toBe(false);
        expect(contains(outer, { x: 1, y: 1, width: 10, height: 8 })).toBe(false);
        expect(contains(outer, { x: 1, y: 1, width: 8, height: 10 })).toBe(false);
    });
});

describe('the featured references stand on the plank they are drawn standing on', () => {
    // `libraryGeometry.ts` says this in a comment; a comment is not a constraint. If either constant
    // moves independently the books float above the shelf or sink through it, which is the single tell
    // that gives away a room built from rectangles — and it is invisible to every other test here.
    it('lands the foot of a reference exactly on the case plank', () => {
        expect(ARTIFACT_TOP_INSET + ARTIFACT_HEIGHT).toBe(SHELF_HEIGHT - CASE_PLANK_HEIGHT);
    });
});

describe.each(CANVASES)('the wall bays on $name', ({ width, height }) => {
    it('fills the margin the room leaves, on both sides, floor to ceiling', () => {
        const left = libraryLeftBayBand(height);
        const right = libraryRightBayBand(width, height);

        // Derived from `SHELF_INSET`, never restated: the number that decides how far the furniture
        // sits in from the edge is the same number that decides how deep the wall behind it is.
        expect(left).toStrictEqual({ x: 0, y: 0, width: SHELF_INSET, height });
        expect(right).toStrictEqual({ x: width - SHELF_INSET, y: 0, width: SHELF_INSET, height });
    });

    it('never reaches any band the player can act on', () => {
        const actionable = [
            libraryShelfBand(width),
            libraryReadingSurfaceBand(width, height),
            libraryAdvanceControlBounds(width, height),
            libraryGateLineBand(width, height),
            ...libraryArtifactPlacements(2, width)
        ];
        [libraryLeftBayBand(height), libraryRightBayBand(width, height)].forEach((bay) => {
            actionable.forEach((band) => {
                expect(overlaps(bay, band), `${JSON.stringify(bay)} reaches ${JSON.stringify(band)}`).toBe(false);
            });
        });
    });
});

describe.each(CANVASES)('below the desk on $name', ({ width, height }) => {
    it('stacks wainscot then floor, with no gap and no overlap, down to the canvas edge', () => {
        const surface = libraryReadingSurfaceBand(width, height);
        const wainscot = libraryWainscotBand(width, height);
        const floor = libraryFloorBand(width, height);

        expect(wainscot.y).toBe(surface.y + surface.height);
        expect(wainscot.y + wainscot.height).toBe(floor.y);
        expect(floor.y + floor.height).toBe(height);
        expect(overlaps(wainscot, floor)).toBe(false);
    });

    it('keeps the floor strip pinned to the canvas floor rather than to a distance from the ceiling', () => {
        // Give the canvas 200 more pixels and the strip has to move down by exactly 200, keeping its
        // own height. This is the rule five story reviews have now asked for, stated as arithmetic.
        const floor = libraryFloorBand(width, height);
        const taller = libraryFloorBand(width, height + 200);

        expect(taller.y - floor.y).toBe(200);
        expect(floor.height).toBe(FLOOR_STRIP_HEIGHT);
        expect(taller.height).toBe(FLOOR_STRIP_HEIGHT);
    });
});

describe.each(CANVASES)('the case around the featured references on $name', ({ width, height }) => {
    const shelf = (): LibraryRect => libraryShelfBand(width);

    it('divides the case into a cornice, two uprights, an interior and a plank that do not overlap', () => {
        const parts = [
            libraryCaseInterior(shelf()),
            libraryCasePlank(shelf()),
            ...libraryCasePilasters(shelf())
        ];
        parts.forEach((part, index) => {
            parts.slice(index + 1).forEach((other) => {
                expect(overlaps(part, other), `${JSON.stringify(part)} overlaps ${JSON.stringify(other)}`).toBe(false);
            });
        });
        expect(libraryCaseInterior(shelf()).height).toBe(SHELF_HEIGHT - CASE_CORNICE_HEIGHT - CASE_PLANK_HEIGHT);
    });

    it('keeps every part of the case on the canvas, cornice overhang included', () => {
        const canvas = { x: 0, y: 0, width, height };
        [
            libraryCaseCornice(shelf()),
            libraryCaseInterior(shelf()),
            libraryCasePlank(shelf()),
            ...libraryCasePilasters(shelf())
        ].forEach((part) => expect(contains(canvas, part), JSON.stringify(part)).toBe(true));
    });

    it('puts both picture lights inside the case, under the cornice', () => {
        const lights = libraryShelfLights(shelf());

        expect(lights).toHaveLength(2);
        lights.forEach(({ x, y }) => {
            expect(x).toBeGreaterThan(shelf().x);
            expect(x).toBeLessThan(shelf().x + shelf().width);
            expect(y).toBe(shelf().y + CASE_CORNICE_HEIGHT);
        });
        expect(lights[0]!.x).toBeLessThan(lights[1]!.x);
    });

    it.each([1, 2])('fills the leftovers either side of %i reference(s) without touching one', (count) => {
        const placements = libraryArtifactPlacements(count, width);
        const alcoves = libraryCaseAlcoves(shelf(), placements);

        expect(alcoves.length).toBeGreaterThan(0);
        alcoves.forEach((alcove) => {
            expect(contains(libraryCaseInterior(shelf()), alcove), JSON.stringify(alcove)).toBe(true);
            placements.forEach((placement) => {
                expect(overlaps(alcove, placement), 'filler books must not sit under a reference').toBe(false);
            });
        });
    });

    it('gives the whole interior over to filler when the case holds no references at all', () => {
        // A degraded cached `case.json` can carry an empty list. An empty case should look like an
        // empty shelf, not like a hole in the furniture.
        expect(libraryCaseAlcoves(shelf(), [])).toStrictEqual([libraryCaseInterior(shelf())]);
    });

    it('leaves no filler when a high count fills the case, rather than a negative rectangle', () => {
        // Four references consume the interior end to end. The guard has to return nothing rather than
        // a rectangle with a negative width, which would paint backwards across the whole case.
        //
        // Asserted on the list, not on its members: at this count the list is empty, so a `forEach` over
        // it runs zero times and passes with zero assertions — which is how the 2.8 review found this
        // test passing against a function that could have returned `[]` unconditionally.
        expect(libraryCaseAlcoves(shelf(), libraryArtifactPlacements(4, width))).toStrictEqual([]);
    });

    it('never returns a negative or zero-width alcove at any count the case can hold', () => {
        // The property the test above is named for, asserted where it can actually fail: every count
        // from an empty case up to one that overfills it, with the non-empty results checked and the
        // empty ones required to be empty rather than silently skipped.
        for (let count = 0; count <= 6; count += 1) {
            const alcoves = libraryCaseAlcoves(shelf(), libraryArtifactPlacements(count, width));
            alcoves.forEach((alcove) => {
                expect(alcove.width, `count ${count}: ${JSON.stringify(alcove)}`).toBeGreaterThan(0);
                expect(alcove.height, `count ${count}: ${JSON.stringify(alcove)}`).toBeGreaterThan(0);
            });
        }
    });
});

describe('the generated shelving', () => {
    const BAY: LibraryRect = { x: 40, y: 0, width: 118, height: 768 };

    it('draws the identical room on every run, from the same seed', () => {
        // The whole reason `Math.random()` appears nowhere: a screenshot has to be comparable across
        // runs, no spec may be flaky because of the scenery, and a player who leaves the room and comes
        // back must not find the shelves rearranged.
        expect(libraryFilledShelves(BAY, { seed: 0x51b3 })).toStrictEqual(libraryFilledShelves(BAY, { seed: 0x51b3 }));
    });

    it('draws a different room from a different seed, so the two bays are not twins', () => {
        expect(libraryFilledShelves(BAY, { seed: 1 })).not.toStrictEqual(libraryFilledShelves(BAY, { seed: 2 }));
    });

    it('keeps every book inside the bay that holds it', () => {
        libraryFilledShelves(BAY, { seed: 7 }).forEach((row) => {
            [...row.spines, ...row.flat].forEach((book) => {
                expect(contains(BAY, book), JSON.stringify(book)).toBe(true);
            });
        });
    });

    it('stands every book on its own shelf, never through the one above', () => {
        // Compared against the *previous row*, which is the only comparison that can fail. Measuring a
        // spine against its own plank restates the constructor (`y = plank.y - height`), so the old
        // assertions here reduced to `0 >= -plank.height` and `plank.y <= plank.y + 0.001` — true for
        // any generator at all. Found by the 2.8 review.
        const rows = libraryFilledShelves(BAY, { seed: 7 });
        expect(rows.length).toBeGreaterThan(1);
        rows.forEach((row, index) => {
            const above = rows[index - 1];
            row.spines.forEach((spine) => {
                expect(spine.y + spine.height, JSON.stringify(spine)).toBeLessThanOrEqual(row.plank.y + 0.001);
                if (above) {
                    expect(spine.y, `row ${index}: ${JSON.stringify(spine)}`).toBeGreaterThanOrEqual(above.plank.y);
                }
            });
        });
    });

    it('never overlaps two books in the same row, and fills every row it reports', () => {
        // The non-emptiness guards are the load-bearing part. Every pairwise assertion below is skipped
        // for an empty or single-book row, so a generator that returned bare rows would satisfy the
        // overlap check by having nothing to overlap — the failure mode the 2.8 review found twice in
        // this file.
        const rows = libraryFilledShelves(BAY, { seed: 7 });
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach((row, rowIndex) => {
            expect(row.spines.length, `row ${rowIndex} is empty`).toBeGreaterThan(0);
            row.spines.forEach((spine, index) => {
                const next = row.spines[index + 1];
                if (!next) return;
                expect(next.x).toBeGreaterThanOrEqual(spine.x + spine.width - 0.001);
            });
        });
    });

    it('divides the bay evenly, so the bottom shelf lands on its floor rather than short of it', () => {
        const rows = libraryFilledShelves(BAY, { seed: 7 });
        const last = rows[rows.length - 1]!;

        expect(rows.length).toBeGreaterThan(1);
        expect(last.plank.y + last.plank.height).toBeCloseTo(BAY.y + BAY.height, 6);
    });

    it('only ever asks for a tint the palette actually has', () => {
        libraryFilledShelves(BAY, { seed: 7 }).forEach((row) => {
            [...row.spines, ...row.flat].forEach(({ tintIndex }) => {
                expect(Number.isInteger(tintIndex)).toBe(true);
                expect(tintIndex).toBeGreaterThanOrEqual(0);
                expect(tintIndex).toBeLessThan(SPINE_TINT_COUNT);
            });
        });
    });

    it('fills a bay rather than leaving one lonely book in it', () => {
        const rows = libraryFilledShelves(BAY, { seed: 7 });
        const total = rows.reduce((count, row) => count + row.spines.length, 0);

        // The bays exist to say "library" through sheer mass. A generator that produced a handful of
        // books would satisfy every containment check above and still miss the entire point.
        expect(total).toBeGreaterThan(30);
    });

    it('is total over rectangles too small to shelve, rather than dividing by zero', () => {
        expect(libraryFilledShelves({ x: 0, y: 0, width: 0, height: 100 }, { seed: 1 })).toStrictEqual([]);
        expect(libraryFilledShelves({ x: 0, y: 0, width: 100, height: 0 }, { seed: 1 })).toStrictEqual([]);
        // A bay shorter than one row still gets one, rather than none.
        expect(libraryFilledShelves({ x: 0, y: 0, width: 100, height: 30 }, { seed: 1 })).toHaveLength(1);
        // A row narrower than one book comes back empty rather than with a book hanging out of it.
        expect(libraryFilledShelves({ x: 0, y: 0, width: 14, height: 100 }, { seed: 1 })[0]!.spines).toStrictEqual([]);
    });
});

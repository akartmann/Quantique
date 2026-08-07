/**
 * The reading room's scenery, in its own Phaser-free module (Story 2.8, design revision).
 *
 * `libraryGeometry.ts` owns the bands the player can *act on* — the shelf, the desk, the way out. This
 * module owns everything that is only there to make the room a room: the wall bays packed floor to
 * ceiling, the case the featured references stand in, the floorboards, and the lamplight. The split is
 * deliberate rather than tidy-minded: a change to the scenery must never be able to move a hit target,
 * and keeping the two in one file is how that eventually happens.
 *
 * **Phaser is not imported here at all**, for the same reason it is absent from `libraryGeometry.ts`:
 * Phaser touches `window` at import time, and both Vitest and the Playwright specs run in Node.
 *
 * ## Why the shelves are generated rather than authored
 *
 * A library reads as a library because of the *mass* of books behind the few that matter — that is the
 * one thing every reference image has in common. Authoring three hundred spine rectangles by hand would
 * be unreadable and unmaintainable; generating them from a seeded sequence gives the same irregularity
 * for nine lines of arithmetic.
 *
 * **The sequence is deterministic.** `Math.random()` appears nowhere: every run of the game draws the
 * identical room, so a screenshot is comparable across runs, a spec is never flaky because of the
 * scenery, and a player who leaves the room and comes back does not find the shelves rearranged.
 *
 * ## Why colour is not decided here
 *
 * A spine comes back with a `tintIndex`, not a colour. This module is about *where things are*; the
 * renderer owns the palette. That keeps the whole file assertable from a unit test without a test
 * having to know what colour a book is, and it means a repaint is a one-line change in one place.
 */

import type { LibraryRect } from './libraryGeometry';
import { SHELF_INSET, libraryReadingSurfaceBand } from './libraryGeometry';

// --- The case the featured references stand in -----------------------------------------------------

/** The moulding across the top of the bookcase. Its underside is where the shelf lights sit. */
export const CASE_CORNICE_HEIGHT = 20;
/** The uprights at either end of the case. Wide enough to carry a gilt inlay and read as joinery. */
export const CASE_PILASTER_WIDTH = 16;
/** The plank the references stand on, front edge included. */
export const CASE_PLANK_HEIGHT = 16;
/** Between a filler alcove and the featured reference beside it. */
export const CASE_ALCOVE_GAP = 8;

// --- The wall bays ----------------------------------------------------------------------------------

/**
 * The bays are exactly the margin {@link SHELF_INSET} leaves, so they cannot collide with the room.
 *
 * Derived rather than given a width of their own: the one number that decides how far the furniture
 * sits in from the canvas edge also decides how deep the wall behind it is, and two numbers that had to
 * agree would eventually stop agreeing.
 */
export const libraryLeftBayBand = (canvasHeight: number): LibraryRect => Object.freeze({
    x: 0, y: 0, width: SHELF_INSET, height: canvasHeight
});

export const libraryRightBayBand = (canvasWidth: number, canvasHeight: number): LibraryRect => Object.freeze({
    x: canvasWidth - SHELF_INSET, y: 0, width: SHELF_INSET, height: canvasHeight
});

/** How tall one shelf of the wall bays is, before the module divides the bay evenly by it. */
export const BAY_ROW_HEIGHT = 104;
export const BAY_PLANK_HEIGHT = 7;

// --- Below the desk: wainscot, then floor -----------------------------------------------------------

/**
 * Everything under the desk is panelling, and only the last strip is floor.
 *
 * The first pass gave the whole lower third to floorboards and it read as a second blank wall: a
 * head-on camera flattens a floor into a band of horizontal lines, which is indistinguishable from
 * panelling seen straight on. Panelled wainscot with a dado rail is what is actually behind a desk in
 * every one of the reference rooms, it has vertical structure the eye can read, and it leaves the
 * floor doing the one job a narrow strip can do convincingly.
 */
export const FLOOR_STRIP_HEIGHT = 54;
/** The nearest board's depth. Boards further away are scaled down from it — see the renderer. */
export const FLOORBOARD_HEIGHT = 26;
/** How wide one field of the wainscot is, before the band is divided evenly by it. */
export const WAINSCOT_PANEL_WIDTH = 168;
export const WAINSCOT_RAIL_HEIGHT = 12;

/** The panelling, from the desk's foot down to the floor. Derived from where the desk actually is. */
export const libraryWainscotBand = (canvasWidth: number, canvasHeight: number): LibraryRect => {
    const surface = libraryReadingSurfaceBand(canvasWidth, canvasHeight);
    const top = surface.y + surface.height;
    return Object.freeze({
        x: 0, y: top, width: canvasWidth, height: Math.max(0, (canvasHeight - FLOOR_STRIP_HEIGHT) - top)
    });
};

export const libraryFloorBand = (canvasWidth: number, canvasHeight: number): LibraryRect => Object.freeze({
    x: 0, y: canvasHeight - FLOOR_STRIP_HEIGHT, width: canvasWidth, height: FLOOR_STRIP_HEIGHT
});

// --- Generated shelving --------------------------------------------------------------------------------

/**
 * One book seen end-on. `tintIndex` selects from the renderer's palette; the geometry does not know
 * what colour that is.
 */
export type LibraryBookSpine = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
    tintIndex: number;
    /** Whether it is wide enough to carry the two gilt rules that make a rectangle read as a book. */
    hasGiltBands: boolean;
}>;

/** A few volumes lying flat where a row runs out of standing room, as they do on a real shelf. */
export type LibraryFlatBook = Readonly<{
    x: number; y: number; width: number; height: number; tintIndex: number;
}>;

export type LibraryShelfRow = Readonly<{
    plank: LibraryRect;
    spines: readonly LibraryBookSpine[];
    flat: readonly LibraryFlatBook[];
}>;

/** How many distinct binding colours the renderer must supply. Asserted, so the two cannot drift. */
export const SPINE_TINT_COUNT = 8;

const SPINE_MIN_WIDTH = 9;
const SPINE_MAX_WIDTH = 21;
/** As a fraction of the row's clear interior height. Nothing reaches the shelf above it. */
const SPINE_MIN_FILL = 0.56;
const SPINE_MAX_FILL = 0.94;
const SPINE_GILT_MIN_WIDTH = 13;
const FLAT_BOOK_HEIGHT = 8;
/** Below this a leftover gap is simply left empty, which a real shelf also does. */
const FLAT_STACK_MIN_WIDTH = 26;

/**
 * A 32-bit linear congruential generator — the numbers are Numerical Recipes' and are not arbitrary.
 *
 * `Math.imul` rather than `*` because the product overflows the 53-bit float mantissa, and once it does
 * the low bits stop being the ones that vary. Sixteen lines of exactness beats a plausible-looking
 * generator whose sequence degenerates after a few hundred draws — and this one draws a few hundred.
 */
const createSequence = (seed: number): Readonly<{ unit: () => number; between: (low: number, high: number) => number; index: (count: number) => number }> => {
    let state = (seed >>> 0) || 1;
    const unit = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
    return Object.freeze({
        unit,
        between: (low: number, high: number): number => low + (unit() * (high - low)),
        index: (count: number): number => Math.min(count - 1, Math.floor(unit() * count))
    });
};

/**
 * Packs a rectangle with shelves of books.
 *
 * Total over any rectangle: a bay too short for one row still gets one, and a row too narrow for one
 * spine comes back empty rather than with a book hanging out of the case. Both are unreachable at the
 * shipped canvas size, and neither should be something a caller has to have checked.
 *
 * The row height is *divided into* the rectangle rather than laid out from the top, so the bottom shelf
 * always lands on the bay's floor instead of leaving a ragged remainder — the same "measure, don't
 * assume" rule the functional bands follow, applied to the scenery.
 */
export const libraryFilledShelves = (
    bay: LibraryRect,
    options: Readonly<{ seed: number; rowHeight?: number; plankHeight?: number; padding?: number }>
): readonly LibraryShelfRow[] => {
    const targetRowHeight = options.rowHeight ?? BAY_ROW_HEIGHT;
    const plankHeight = options.plankHeight ?? BAY_PLANK_HEIGHT;
    const padding = options.padding ?? 6;
    const innerX = bay.x + padding;
    const innerWidth = bay.width - (2 * padding);
    if (innerWidth <= 0 || bay.height <= 0) return Object.freeze([]);

    const rowCount = Math.max(1, Math.round(bay.height / targetRowHeight));
    const rowHeight = bay.height / rowCount;
    const random = createSequence(options.seed);

    return Object.freeze(Array.from({ length: rowCount }, (_unused, row) => {
        const rowTop = bay.y + (row * rowHeight);
        const interiorHeight = rowHeight - plankHeight;
        const floorY = rowTop + interiorHeight;
        const spines: LibraryBookSpine[] = [];
        const flat: LibraryFlatBook[] = [];

        let cursor = innerX;
        const rightEdge = innerX + innerWidth;
        while (cursor + SPINE_MIN_WIDTH <= rightEdge) {
            const width = Math.min(random.between(SPINE_MIN_WIDTH, SPINE_MAX_WIDTH), rightEdge - cursor);
            if (width < SPINE_MIN_WIDTH) break;
            const height = interiorHeight * random.between(SPINE_MIN_FILL, SPINE_MAX_FILL);
            spines.push(Object.freeze({
                x: cursor,
                y: floorY - height,
                width,
                height,
                tintIndex: random.index(SPINE_TINT_COUNT),
                hasGiltBands: width >= SPINE_GILT_MIN_WIDTH
            }));
            cursor += width;
            // A gap now and then, so the row reads as books that have been taken out and put back
            // rather than as a solid extruded bar.
            if (random.unit() < 0.14) cursor += random.between(2, 7);
        }

        // Whatever the standing books left behind becomes a short flat stack, the way a real shelf's
        // tail does. Below `FLAT_STACK_MIN_WIDTH` it stays empty — a two-pixel book is a smear.
        const tail = rightEdge - cursor;
        if (tail >= FLAT_STACK_MIN_WIDTH) {
            // `between` is half-open, so the floor already yields exactly 1, 2 or 3 — the clamps this
            // once carried could never fire and only made the range look uncertain.
            const stackHeight = Math.floor(random.between(1, 4));
            for (let level = 0; level < stackHeight; level += 1) {
                const width = tail - random.between(0, 6);
                flat.push(Object.freeze({
                    x: cursor + 1,
                    y: floorY - ((level + 1) * FLAT_BOOK_HEIGHT),
                    width,
                    height: FLAT_BOOK_HEIGHT - 1,
                    tintIndex: random.index(SPINE_TINT_COUNT)
                }));
            }
        }

        return Object.freeze({
            plank: Object.freeze({ x: bay.x, y: floorY, width: bay.width, height: plankHeight }),
            spines: Object.freeze(spines),
            flat: Object.freeze(flat)
        });
    }));
};

// --- Parts of the featured case ---------------------------------------------------------------------

export const libraryCaseCornice = (shelf: LibraryRect): LibraryRect => Object.freeze({
    x: shelf.x - 6, y: shelf.y, width: shelf.width + 12, height: CASE_CORNICE_HEIGHT
});

export const libraryCasePilasters = (shelf: LibraryRect): readonly LibraryRect[] => Object.freeze([
    Object.freeze({
        x: shelf.x, y: shelf.y + CASE_CORNICE_HEIGHT,
        width: CASE_PILASTER_WIDTH, height: shelf.height - CASE_CORNICE_HEIGHT
    }),
    Object.freeze({
        x: shelf.x + shelf.width - CASE_PILASTER_WIDTH, y: shelf.y + CASE_CORNICE_HEIGHT,
        width: CASE_PILASTER_WIDTH, height: shelf.height - CASE_CORNICE_HEIGHT
    })
]);

/** The shadowed back of the case, between the uprights and under the cornice. */
export const libraryCaseInterior = (shelf: LibraryRect): LibraryRect => Object.freeze({
    x: shelf.x + CASE_PILASTER_WIDTH,
    y: shelf.y + CASE_CORNICE_HEIGHT,
    width: shelf.width - (2 * CASE_PILASTER_WIDTH),
    height: shelf.height - CASE_CORNICE_HEIGHT - CASE_PLANK_HEIGHT
});

/**
 * The plank the featured references stand on, which is also what their feet are measured against.
 *
 * It spans the **interior**, not the whole case: a shelf is housed between the uprights, not laid
 * across their faces. The first pass ran it the full width and the unit test caught it overlapping
 * both pilasters — which on screen is a plank that appears to pass through the sides of its own case.
 */
export const libraryCasePlank = (shelf: LibraryRect): LibraryRect => {
    const interior = libraryCaseInterior(shelf);
    return Object.freeze({
        x: interior.x,
        y: shelf.y + shelf.height - CASE_PLANK_HEIGHT,
        width: interior.width,
        height: CASE_PLANK_HEIGHT
    });
};

/**
 * The two pockets of ordinary books either side of the featured references.
 *
 * They are what make the two that matter read as *pulled forward from a full shelf* rather than as the
 * only two books in the building. Derived from where the references actually landed, so a case with a
 * different count still fills its own leftovers — and comes back empty rather than negative when a high
 * count leaves no room, which is the state a four-artifact case reaches.
 */
export const libraryCaseAlcoves = (
    shelf: LibraryRect,
    placements: readonly LibraryRect[]
): readonly LibraryRect[] => {
    const interior = libraryCaseInterior(shelf);
    const first = placements[0];
    const last = placements[placements.length - 1];
    if (!first || !last) return Object.freeze([interior]);

    const candidates = [
        { x: interior.x, right: first.x - CASE_ALCOVE_GAP },
        { x: last.x + last.width + CASE_ALCOVE_GAP, right: interior.x + interior.width }
    ];
    return Object.freeze(candidates
        .filter(({ x, right }) => right - x >= SPINE_MIN_WIDTH + 2)
        .map(({ x, right }) => Object.freeze({ x, y: interior.y, width: right - x, height: interior.height })));
};

/**
 * Where the two shelf lights sit under the cornice, and how far their wash reaches.
 *
 * Two rather than one because a single centred source would light the middle of the case and leave both
 * featured references in the dark — which is the opposite of what a picture light is for.
 */
export const libraryShelfLights = (shelf: LibraryRect): readonly Readonly<{ x: number; y: number; radius: number }>[] => {
    const y = shelf.y + CASE_CORNICE_HEIGHT;
    const radius = shelf.height * 1.15;
    return Object.freeze([
        Object.freeze({ x: shelf.x + (shelf.width * 0.28), y, radius }),
        Object.freeze({ x: shelf.x + (shelf.width * 0.72), y, radius })
    ]);
};

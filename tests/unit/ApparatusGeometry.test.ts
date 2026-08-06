import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import {
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_Y,
    CENTRE_Y,
    HINT_BOTTOM_MARGIN,
    SCREEN_BAR_HALF_WIDTH,
    SCREEN_HALF_HEIGHT,
    SCREEN_LABEL_HEIGHT,
    SCREEN_LABEL_Y,
    SIDE_COLUMN_LEFT,
    SIDE_COLUMN_WIDTH,
    advanceToSynthesisControlCentre,
    screenXForDistance
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The laboratory side column must not sit on top of the apparatus it stands beside.
 *
 * Added in review (2026-08-06). The advance control shipped at y=130, which put an opaque 40px band
 * across the interference screen — and swallowed pointer events over it into a phase advance —
 * whenever the throw was long enough to slide the screen right into the column. Reachable in normal
 * play at the two longest authored distances, and the authored hints ask the player to slide the
 * screen back. The module's own comment asserted the apparatus stopped at x≈612, which is true only
 * at the default 2 m.
 *
 * The point of pinning it here rather than trusting a comment: the overlap is a *joint* property of
 * the column's constants and the screen's placement function, and neither file's numbers look wrong
 * on their own.
 *
 * Design space, not device pixels: the canvas is `Scale.FIT` over 1024×768.
 */
const DESIGN_WIDTH = 1024;
const DESIGN_HEIGHT = 768;

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** Every screen distance the player can actually select, from the authored bounds. */
const authoredScreenDistances = (): number[] => {
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM');
    if (!screen) throw new Error('The authored case must carry a screen-distance control.');
    const values: number[] = [];
    for (let d = screen.min; d <= screen.max + 1e-9; d += screen.step) values.push(Number(d.toFixed(4)));
    return values;
};

describe('the laboratory side column', () => {
    it('clears the interference screen at every authored throw', () => {
        const controlTop = ADVANCE_CONTROL_Y;
        const controlBottom = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT;
        const screenTop = CENTRE_Y - SCREEN_HALF_HEIGHT;
        const screenBottom = CENTRE_Y + SCREEN_HALF_HEIGHT;

        const overlapping = authoredScreenDistances()
            .map((screenDistanceM) => ({ screenDistanceM, screenX: screenXForDistance(screenDistanceM) }))
            .filter(({ screenX }) => {
                const overlapsHorizontally = screenX + SCREEN_BAR_HALF_WIDTH > SIDE_COLUMN_LEFT
                    && screenX - SCREEN_BAR_HALF_WIDTH < SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH;
                const overlapsVertically = controlTop < screenBottom && controlBottom > screenTop;
                return overlapsHorizontally && overlapsVertically;
            })
            .map(({ screenDistanceM, screenX }) => `${screenDistanceM} m puts the screen at x=${screenX}`);

        expect(overlapping).toEqual([]);
    });

    it('actually reaches into the screen\'s column at the longest throws, so the check above has a subject', () => {
        // Without this the assertion above would pass just as happily on a column the screen never
        // approaches, and would stop being a guard the moment someone widened the apparatus.
        const furthest = screenXForDistance(4);

        expect(furthest + SCREEN_BAR_HALF_WIDTH).toBeGreaterThan(SIDE_COLUMN_LEFT);
        expect(authoredScreenDistances()).toContain(4);
    });

    it('clears the screen label, which is drawn below the bar and offset left into the column', () => {
        expect(ADVANCE_CONTROL_Y).toBeGreaterThan(SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
    });

    it('leaves the hint room to grow upward from the canvas floor', () => {
        // The hint is bottom-anchored and unbounded in height; the control is fixed at the top of the
        // free column. They must not be able to meet.
        const controlBottom = ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT;
        const hintFloor = DESIGN_HEIGHT - HINT_BOTTOM_MARGIN;

        expect(hintFloor - controlBottom).toBeGreaterThan(200);
    });

    it('stays inside the canvas', () => {
        expect(SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH).toBeLessThanOrEqual(DESIGN_WIDTH);
        expect(ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT).toBeLessThan(DESIGN_HEIGHT);
    });

    it('centres the exported click target inside the control it names', () => {
        // The browser specs click this rather than restating coordinates, so a control moved without
        // its centre moving would send every canvas walk to empty space.
        const { x, y } = advanceToSynthesisControlCentre();

        expect(x).toBeGreaterThan(SIDE_COLUMN_LEFT);
        expect(x).toBeLessThan(SIDE_COLUMN_LEFT + SIDE_COLUMN_WIDTH);
        expect(y).toBeGreaterThan(ADVANCE_CONTROL_Y);
        expect(y).toBeLessThan(ADVANCE_CONTROL_Y + ADVANCE_CONTROL_HEIGHT);
    });
});

import { describe, expect, it } from 'vitest';

import {
    ADVANCE_CONTROL_HEIGHT,
    ADVANCE_CONTROL_WIDTH,
    advanceControlCentre,
    advanceControlLabelWrap
} from '../../src/adapters/phaser/ui/AdvanceControl';
import {
    BOARD_CONTROL_LEFT,
    BOARD_TEXT_WRAP,
    PROPOSAL_SURFACE_LEFT,
    PROPOSAL_SURFACE_WIDTH,
    advanceControlCentreOnBoard,
    submitConclusionControlCentre
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
// From `phasePlaceholderGeometry`, not the scene: `PhasePlaceholderScene` extends `Phaser.Scene`, so
// it imports Phaser as a value and Phaser touches `window` at import time. Vitest runs in Node.
import { placeholderAdvanceControlCentre } from '../../src/adapters/phaser/scenes/phasePlaceholderGeometry';

/**
 * Where the advance control lands on the hosts that are **not** the laboratory (Story 2.7).
 *
 * `ApparatusGeometry.test.ts` already pins the laboratory's column against the painted apparatus. The
 * same class of defect is available on the other hosts and is just as invisible in either file alone:
 * the control's size lives in the widget, its placement lives in the host, and neither set of numbers
 * looks wrong on its own. The 1.11, 1.12, 2.5, and 2.6 reviews each found exactly that shape.
 *
 * Design space, not device pixels: the canvas is `Scale.FIT` over 1024×768.
 */
const DESIGN_WIDTH = 1024;
const DESIGN_HEIGHT = 768;

/** Story 2.5's submit control, whose row the advance control now shares on the conclusion board. */
const SUBMIT_HEIGHT = 34;

describe('the board control column', () => {
    it('stays inside the proposal surface, so no control hangs off the canvas', () => {
        const right = BOARD_CONTROL_LEFT + ADVANCE_CONTROL_WIDTH;

        expect(BOARD_CONTROL_LEFT).toBeGreaterThan(PROPOSAL_SURFACE_LEFT);
        expect(right).toBeLessThanOrEqual(PROPOSAL_SURFACE_LEFT + PROPOSAL_SURFACE_WIDTH);
        expect(right).toBeLessThanOrEqual(DESIGN_WIDTH);
    });

    it('leaves the heading and guide a wrap bound that stops short of the column', () => {
        // The prose on the left and the controls on the right divide one row. If the bound reached the
        // column, a French heading — 15–25% longer than its English counterpart — would run underneath
        // a control rather than wrapping, and Phaser would draw it there rather than clipping it.
        expect(PROPOSAL_SURFACE_LEFT + BOARD_TEXT_WRAP).toBeLessThanOrEqual(BOARD_CONTROL_LEFT);
    });

    it('does not stack the conclusion board\'s two controls on top of one another', () => {
        // They are different acts — submit the claim, then move on — and the conclusion board is the
        // only surface that carries both.
        const submitBottom = submitConclusionControlCentre().y + (SUBMIT_HEIGHT / 2);
        const advanceTop = advanceControlCentreOnBoard('conclusion').y - (ADVANCE_CONTROL_HEIGHT / 2);

        expect(advanceTop).toBeGreaterThanOrEqual(submitBottom);
    });

    it('puts the prediction board\'s control in the row the conclusion board gives to submit', () => {
        // The prediction board has no submit control, so its column starts at the top rather than
        // leaving a gap where one would have been.
        expect(advanceControlCentreOnBoard('prediction').y)
            .toBeLessThan(advanceControlCentreOnBoard('conclusion').y);
    });

    it('centres each exported click target inside the control it names', () => {
        // The browser specs click these rather than restating coordinates, so a control moved without
        // its centre moving would send every canvas walk to empty space.
        (['prediction', 'conclusion'] as const).forEach((kind) => {
            const { x, y } = advanceControlCentreOnBoard(kind);

            expect(x).toBeGreaterThan(BOARD_CONTROL_LEFT);
            expect(x).toBeLessThan(BOARD_CONTROL_LEFT + ADVANCE_CONTROL_WIDTH);
            expect(y).toBeGreaterThan(0);
            expect(y + (ADVANCE_CONTROL_HEIGHT / 2)).toBeLessThan(DESIGN_HEIGHT);
        });
    });
});

describe('the routing shell\'s control', () => {
    it('sits below the centred development marker rather than over it', () => {
        const { y } = placeholderAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);

        expect(y - (ADVANCE_CONTROL_HEIGHT / 2)).toBeGreaterThan(DESIGN_HEIGHT / 2);
    });

    it('stays inside the canvas, with room beneath it for a refusal message', () => {
        const { x, y } = placeholderAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);

        expect(x - (ADVANCE_CONTROL_WIDTH / 2)).toBeGreaterThan(0);
        expect(x + (ADVANCE_CONTROL_WIDTH / 2)).toBeLessThan(DESIGN_WIDTH);
        expect(DESIGN_HEIGHT - (y + (ADVANCE_CONTROL_HEIGHT / 2))).toBeGreaterThan(60);
    });

    it('is horizontally centred, derived from the canvas rather than from a literal', () => {
        // Read from `scene.scale` in the scene itself, so the same helper has to answer for any size
        // the design surface is ever given.
        expect(placeholderAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT).x).toBe(DESIGN_WIDTH / 2);
        expect(placeholderAdvanceControlCentre(800, 600).x).toBe(400);
    });
});

describe('the widget\'s own geometry', () => {
    it('derives its label bound from the width it is given, not from the default', () => {
        // The laboratory fills a 304px column and the boards use the 232px default; one bound cannot
        // serve both, and `french-typography.spec.ts` measures each label against its own host's.
        expect(advanceControlLabelWrap(304)).toBeGreaterThan(advanceControlLabelWrap());
        expect(advanceControlLabelWrap()).toBeLessThan(ADVANCE_CONTROL_WIDTH);
    });

    it('centres on the bounds it is given', () => {
        expect(advanceControlCentre({ x: 100, y: 200, width: 300, height: 40 })).toEqual({ x: 250, y: 220 });
    });
});

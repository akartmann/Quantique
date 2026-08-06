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
    SUBMIT_HEIGHT,
    SUBMIT_WIDTH,
    advanceControlCentreOnBoard,
    boardAdvanceControlLabelWrap,
    submitConclusionControlCentre
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`, for the same reason.
import { SIDE_COLUMN_WIDTH } from '../../src/adapters/phaser/renderers/apparatusGeometry';
// From `phasePlaceholderGeometry`, not the scene: `PhasePlaceholderScene` extends `Phaser.Scene`, so
// it imports Phaser as a value and Phaser touches `window` at import time. Vitest runs in Node.
import {
    PLACEHOLDER_MESSAGE_FONT_SIZE,
    PLACEHOLDER_MESSAGE_TOP_GAP,
    placeholderAdvanceControlCentre
} from '../../src/adapters/phaser/scenes/phasePlaceholderGeometry';

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

describe('the board control column', () => {
    it('stays inside the proposal surface, so no control hangs off the canvas', () => {
        // `SUBMIT_WIDTH`, not `ADVANCE_CONTROL_WIDTH`: the boards draw their advance control at the
        // column's width, and the widget's default is what every *other* host uses. They are the same
        // number today, so reading the wrong one is invisible — and would leave this check green while
        // a widened column pushed the real control off the surface.
        const right = BOARD_CONTROL_LEFT + SUBMIT_WIDTH;

        expect(BOARD_CONTROL_LEFT).toBeGreaterThan(PROPOSAL_SURFACE_LEFT);
        expect(right).toBeLessThanOrEqual(PROPOSAL_SURFACE_LEFT + PROPOSAL_SURFACE_WIDTH);
        expect(right).toBeLessThanOrEqual(DESIGN_WIDTH);
    });

    it('leaves the heading and guide a wrap bound that stops short of the column, by a readable gutter', () => {
        // The prose on the left and the controls on the right divide one row. If the bound reached the
        // column, a French heading — 15–25% longer than its English counterpart — would run underneath
        // a control rather than wrapping, and Phaser would draw it there rather than clipping it.
        //
        // Asserted as a *gutter wide enough to read as one*, not as `<= BOARD_CONTROL_LEFT`: that
        // weaker form reduces, by the definitions of both constants, to `SUBMIT_GAP >= 0` and cannot
        // fail for any layout short of a negative gap.
        const gutter = BOARD_CONTROL_LEFT - (PROPOSAL_SURFACE_LEFT + BOARD_TEXT_WRAP);

        expect(gutter).toBeGreaterThanOrEqual(12);
    });

    it('does not stack the conclusion board\'s two controls on top of one another', () => {
        // They are different acts — submit the claim, then move on — and the conclusion board is the
        // only surface that carries both. `SUBMIT_HEIGHT` is read from the renderer rather than
        // restated: it is the number that pushes the advance control into the second row, so a test
        // holding its own copy would compute the old floor and pass straight through the collision.
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
        // its centre moving would send every canvas walk to empty space. Asserted as the exact centre
        // of the rectangle the board draws — a "somewhere inside the column" bound would still land a
        // click on the control's edge, and passing is not the same as clicking the middle of it.
        (['prediction', 'conclusion'] as const).forEach((kind) => {
            const { x, y } = advanceControlCentreOnBoard(kind);

            expect(x).toBe(BOARD_CONTROL_LEFT + (SUBMIT_WIDTH / 2));
            expect(y - (ADVANCE_CONTROL_HEIGHT / 2)).toBeGreaterThanOrEqual(0);
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
        // The room actually needed, derived from the message's own gap and font rather than from a
        // round number chosen to pass: two lines of it, which is what a French `missing-contextual-
        // sources` error with an interpolated source name takes at this wrap.
        const messageHeight = PLACEHOLDER_MESSAGE_TOP_GAP + (2 * PLACEHOLDER_MESSAGE_FONT_SIZE);

        expect(x - (ADVANCE_CONTROL_WIDTH / 2)).toBeGreaterThan(0);
        expect(x + (ADVANCE_CONTROL_WIDTH / 2)).toBeLessThan(DESIGN_WIDTH);
        expect(DESIGN_HEIGHT - (y + (ADVANCE_CONTROL_HEIGHT / 2))).toBeGreaterThanOrEqual(messageHeight);
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
        // Three hosts, three widths: the laboratory's side column, the boards' control column, and the
        // widget's own default for the two shells. One bound cannot serve all of them, and
        // `french-typography.spec.ts` measures each label against its own host's.
        expect(advanceControlLabelWrap(SIDE_COLUMN_WIDTH)).toBeGreaterThan(advanceControlLabelWrap());
        expect(boardAdvanceControlLabelWrap('conclusion')).toBe(advanceControlLabelWrap(SUBMIT_WIDTH));
        // Padding on both sides, and enough of it to be a margin rather than a rounding error.
        expect(ADVANCE_CONTROL_WIDTH - advanceControlLabelWrap()).toBeGreaterThanOrEqual(16);
    });

    it('centres on the bounds it is given', () => {
        expect(advanceControlCentre({ x: 100, y: 200, width: 300, height: 40 })).toEqual({ x: 250, y: 220 });
    });
});

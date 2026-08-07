import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    KNOB_ARC_END_RAD,
    KNOB_ARC_START_RAD,
    KNOB_ARC_SWEEP_RAD,
    knobAngleForValue,
    knobFractionForAngle,
    knobStepCount,
    knobTickAngles,
    pointerAngleRad,
    resolveKnobValue,
    resolveKnobValueForPointer,
    steppedControlValue,
    steppedNeighbour
} from '../../src/adapters/phaser/renderers/instrumentView';
import { normalizeControlValue } from '../../src/domain/apparatus/ApparatusControl';
import type { CaseDefinition, PrimaryControl } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The knob's conversion between a pointer position and an authored control value (Story 2.10, AC2/AC3).
 *
 * Driven against the **authored** controls rather than a fixture, for the reason
 * `ApparatusGeometry.test.ts` reads the case too: the conversion has to agree with the bounds the
 * player actually turns, and a fixture that restated `0.1 … 0.5 step 0.05` would stop covering them
 * the day the content moved.
 *
 * Every assertion here is about *values*, never about pixels: `instrumentView.ts` imports Phaser not at
 * all, and the placement of the knob it converts for lives in `apparatusGeometry.ts`. That split is
 * `characterStageView.ts` / `CharacterStage.ts` again, and it exists so a Vitest run can reach the rule.
 */

let controls: readonly PrimaryControl[];

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    controls = (parsed.data as CaseDefinition).apparatus.primaryControls;
});

/** Every value the player can actually select on a control, from its authored bounds. */
const authoredValues = (control: PrimaryControl): number[] => {
    const values: number[] = [];
    for (let index = 0; index <= knobStepCount(control); index += 1) {
        values.push(Number((control.min + (index * control.step)).toFixed(6)));
    }
    return values;
};

const eachControl = (assert: (control: PrimaryControl) => void): void => {
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach(assert);
};

describe('the knob travel arc', () => {
    it('sweeps clockwise from down-left to down-right, leaving the shaft a dead zone', () => {
        // The angle convention is the one `Math.atan2(dy, dx)` and Phaser's `Graphics.arc` share: 0 is
        // straight right and the angle grows clockwise, because canvas y grows downward.
        expect(KNOB_ARC_START_RAD).toBeCloseTo((135 * Math.PI) / 180, 12);
        expect(KNOB_ARC_SWEEP_RAD).toBeCloseTo((270 * Math.PI) / 180, 12);
        expect(KNOB_ARC_END_RAD).toBeCloseTo(KNOB_ARC_START_RAD + KNOB_ARC_SWEEP_RAD, 12);
        // A dead zone at all, or the two ends of the travel would touch and a drag past one would
        // wrap round to the other.
        expect(KNOB_ARC_SWEEP_RAD).toBeLessThan(Math.PI * 2);
    });

    it('reads the start of the travel as 0 and the end as 1', () => {
        expect(knobFractionForAngle(KNOB_ARC_START_RAD)).toBeCloseTo(0, 12);
        expect(knobFractionForAngle(KNOB_ARC_END_RAD)).toBeCloseTo(1, 12);
        expect(knobFractionForAngle(KNOB_ARC_START_RAD + (KNOB_ARC_SWEEP_RAD / 2))).toBeCloseTo(0.5, 12);
    });

    it('clamps a pointer inside the dead zone to whichever end of the travel it is nearer', () => {
        const deadZone = (Math.PI * 2) - KNOB_ARC_SWEEP_RAD;
        // Just past the end of the travel — still the end, not a wrap round to the start.
        expect(knobFractionForAngle(KNOB_ARC_END_RAD + (deadZone * 0.1))).toBe(1);
        // Just before the start.
        expect(knobFractionForAngle(KNOB_ARC_START_RAD - (deadZone * 0.1))).toBe(0);
    });
});

describe('resolveKnobValue', () => {
    it('never dispatches an off-step value, anywhere on the travel', () => {
        // The AC2 promise in its strongest form: sweep the whole arc densely and assert every single
        // answer is a value the authored step can actually produce.
        eachControl((control) => {
            const permitted = new Set(authoredValues(control));
            const offStep: number[] = [];
            for (let sample = 0; sample <= 720; sample += 1) {
                const angleRad = KNOB_ARC_START_RAD + ((sample / 720) * KNOB_ARC_SWEEP_RAD);
                const value = resolveKnobValue({ control, angleRad });
                if (!permitted.has(value)) offStep.push(value);
            }

            expect(offStep).toEqual([]);
        });
    });

    it('round-trips every authored step through its own angle, at both ends included', () => {
        eachControl((control) => {
            const values = authoredValues(control);
            const wrong = values
                .map((value) => ({ value, resolved: resolveKnobValue({ control, angleRad: knobAngleForValue(control, value) }) }))
                .filter(({ value, resolved }) => resolved !== value);

            expect(wrong).toEqual([]);
            expect(values[0]).toBe(control.min);
            expect(values[values.length - 1]).toBe(control.max);
        });
    });

    it('clamps beyond each end rather than wrapping to the other one', () => {
        eachControl((control) => {
            const deadZone = (Math.PI * 2) - KNOB_ARC_SWEEP_RAD;

            expect(resolveKnobValue({ control, angleRad: KNOB_ARC_END_RAD + (deadZone * 0.2) })).toBe(control.max);
            expect(resolveKnobValue({ control, angleRad: KNOB_ARC_START_RAD - (deadZone * 0.2) })).toBe(control.min);
        });
    });

    /**
     * The knob's size is not part of the conversion.
     *
     * "At two canvas sizes" means exactly this for a rotary control: the surface is `Scale.FIT`, so a
     * larger canvas gives a larger knob and a proportionally larger pointer offset — and the value must
     * not move. A conversion that used distance rather than angle would fail here.
     */
    it('gives the same value for the same direction at any knob radius', () => {
        eachControl((control) => {
            const disagreeing: string[] = [];
            for (let sample = 0; sample <= 120; sample += 1) {
                const angleRad = KNOB_ARC_START_RAD + ((sample / 120) * KNOB_ARC_SWEEP_RAD);
                const small = resolveKnobValueForPointer({ control, dx: Math.cos(angleRad) * 18, dy: Math.sin(angleRad) * 18 });
                const large = resolveKnobValueForPointer({ control, dx: Math.cos(angleRad) * 240, dy: Math.sin(angleRad) * 240 });
                if (small !== large) disagreeing.push(`${angleRad}: ${small} vs ${large}`);
            }

            expect(disagreeing).toEqual([]);
        });
    });

    it('maps a pointer offset through the same angle atan2 reports', () => {
        eachControl((control) => {
            const dx = 40;
            const dy = -40;

            expect(resolveKnobValueForPointer({ control, dx, dy }))
                .toBe(resolveKnobValue({ control, angleRad: pointerAngleRad(dx, dy) }));
        });
    });
});

/**
 * The duplication guard D1 asks for.
 *
 * `steppedControlValue` delegates to the domain's own `normalizeControlValue` rather than restating its
 * tie rule, so the two agree by construction — and this pins that they still do. A future change that
 * reintroduced a private copy in the surface would have to keep it identical or fail here.
 */
describe('the surface snaps exactly as the reducer would', () => {
    it('agrees with normalizeControlValue across every step and at both ends', () => {
        eachControl((control) => {
            const disagreeing: string[] = [];
            // Deliberately dense and deliberately *off* the steps: the interesting inputs are the raw
            // values a drag produces, not the ones a stepper does.
            for (let sample = -4; sample <= 404; sample += 1) {
                const requested = control.min + ((sample / 400) * (control.max - control.min));
                const domain = normalizeControlValue(control, requested);
                const surface = steppedControlValue(control, requested);
                if (!domain.ok || domain.value !== surface) {
                    disagreeing.push(`${requested}: ${surface} vs ${domain.ok ? domain.value : domain.error.code}`);
                }
            }

            expect(disagreeing).toEqual([]);
        });
    });

    it('snaps an exact halfway request upward, as the documented tie rule requires', () => {
        eachControl((control) => {
            const halfway = control.min + (control.step / 2);
            const domain = normalizeControlValue(control, halfway);
            // The second authored step, read off the same ladder the round-trip test walks, rather
            // than `min + step` — which is `0.15000000000000002` in binary floating point and would
            // make this assert against a value neither the surface nor the reducer can produce.
            const secondStep = authoredValues(control)[1]!;

            expect(steppedControlValue(control, halfway)).toBe(secondStep);
            expect(domain.ok && domain.value).toBe(secondStep);
            expect(secondStep).toBeGreaterThan(control.min);
        });
    });

    it('agrees with the reducer on every angle the arc can produce', () => {
        eachControl((control) => {
            const disagreeing: string[] = [];
            for (let sample = 0; sample <= 360; sample += 1) {
                const angleRad = KNOB_ARC_START_RAD + ((sample / 360) * KNOB_ARC_SWEEP_RAD);
                const dispatched = resolveKnobValue({ control, angleRad });
                const reducer = normalizeControlValue(control, dispatched);
                // The load-bearing half: a value the surface dispatches must come back out of the
                // reducer unchanged, or the indicator jumps out from under the cursor (ADR-012).
                if (!reducer.ok || reducer.value !== dispatched) disagreeing.push(`${angleRad}: ${dispatched}`);
            }

            expect(disagreeing).toEqual([]);
        });
    });
});

describe('steppedNeighbour', () => {
    it('moves exactly one authored step in each direction', () => {
        eachControl((control) => {
            const wrong = authoredValues(control)
                .slice(1, -1)
                .flatMap((value) => [
                    { value, direction: 1 as const, expected: steppedControlValue(control, value + control.step), got: steppedNeighbour(control, value, 1) },
                    { value, direction: -1 as const, expected: steppedControlValue(control, value - control.step), got: steppedNeighbour(control, value, -1) }
                ])
                .filter(({ expected, got }) => expected !== got);

            expect(wrong).toEqual([]);
        });
    });

    it('stops at each end rather than running past it', () => {
        eachControl((control) => {
            expect(steppedNeighbour(control, control.max, 1)).toBe(control.max);
            expect(steppedNeighbour(control, control.min, -1)).toBe(control.min);
        });
    });

    /** A step and a drag to the same place produce the same number, which is what AC3 turns on. */
    it('lands on the same value a drag to that angle would dispatch', () => {
        eachControl((control) => {
            const stepped = steppedNeighbour(control, control.min, 1);
            const dragged = resolveKnobValue({ control, angleRad: knobAngleForValue(control, stepped) });

            expect(dragged).toBe(stepped);
        });
    });
});

describe('the drawn detents', () => {
    it('draws one tick per authored step, at the angle that step turns to', () => {
        eachControl((control) => {
            const ticks = knobTickAngles(control);

            expect(ticks).toHaveLength(knobStepCount(control) + 1);
            expect(ticks[0]).toBeCloseTo(KNOB_ARC_START_RAD, 12);
            expect(ticks[ticks.length - 1]).toBeCloseTo(KNOB_ARC_END_RAD, 12);
            // Every tick is the angle its own value resolves at, so the detents the player sees are the
            // detents the knob actually has.
            const misplaced = authoredValues(control)
                .map((value, index) => ({ value, expected: knobAngleForValue(control, value), drawn: ticks[index]! }))
                .filter(({ expected, drawn }) => Math.abs(expected - drawn) > 1e-9);

            expect(misplaced).toEqual([]);
        });
    });
});

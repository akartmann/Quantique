import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    KNOB_ARC_END_RAD,
    KNOB_ARC_START_RAD,
    KNOB_ARC_SWEEP_RAD,
    DIAL_INDEX_ANGLE_RAD,
    dialTravelRad,
    KNOB_MIN_TRACKING_RADIUS,
    dialAngleForFraction,
    dialAngleForValue,
    dialFractionForAngle,
    dialTickAngles,
    knobAngleForValue,
    knobFractionForAngle,
    knobStepCount,
    knobTickAngles,
    pointerAngleRad,
    resolveAffordanceValueForPointer,
    resolveKnobValue,
    resolveKnobValueForPointer,
    sliderFractionForOffset,
    sliderOffsetForValue,
    sliderTickOffsets,
    steppedControlValue,
    steppedNeighbour
} from '../../src/adapters/phaser/renderers/instrumentView';
import { SLIDER_TRACK_WIDTH } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { normalizeControlValue } from '../../src/domain/apparatus/ApparatusControl';
import { CONTROL_AFFORDANCES, controlAffordance, type CaseDefinition, type ControlAffordance, type PrimaryControl } from '../../src/domain/cases/CaseDefinition';
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
/**
 * The prototype's controls too, from Story 3.4: they are the ones that actually author a `dial` and a
 * `slider`, and their bounds are nothing like Young's — 0…180 by 15 against 0.1…0.5 by 0.05. Sweeping
 * a conversion over one case's numbers only is how a Young-shaped assumption survives (revision 2.6).
 */
let prototypeControls: readonly PrimaryControl[];

const loadControls = async (caseId: string): Promise<readonly PrimaryControl[]> => {
    const content: unknown = JSON.parse(await readFile(`public/cases/${caseId}/case.json`, 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error(`The authored ${caseId} case must parse.`);
    return (parsed.data as CaseDefinition).apparatus.primaryControls;
};

beforeAll(async () => {
    controls = await loadControls('young-interference');
    prototypeControls = await loadControls('morley-miller');
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

    it('reads no fraction at all for a pointer inside the dead zone', () => {
        const deadZone = (Math.PI * 2) - KNOB_ARC_SWEEP_RAD;
        // `undefined` rather than a clamped end: choosing the nearer end moved the wrap to the bottom of
        // the knob instead of removing it. The caller holds the current value instead — see the arc note
        // in `instrumentView.ts` and the hysteresis tests below.
        expect(knobFractionForAngle(KNOB_ARC_END_RAD + (deadZone * 0.1))).toBeUndefined();
        expect(knobFractionForAngle(KNOB_ARC_START_RAD - (deadZone * 0.1))).toBeUndefined();
    });

    /**
     * The 90° split the old nearest-end rule broke on, and which the old samples could not reach.
     *
     * The dead zone runs 45° → 135° through straight-down, and the previous implementation split it at
     * exactly 90°: an angle one side resolved to the maximum, the other side to the **minimum**. This
     * sweeps the whole quadrant at one-degree resolution rather than sampling ±18° around the ends, which
     * is why the flip survived a green suite.
     */
    it('reads no fraction anywhere in the quadrant, not merely near the ends', () => {
        const reading: string[] = [];
        for (let degrees = 46; degrees <= 134; degrees += 1) {
            const angleRad = (degrees * Math.PI) / 180;
            if (knobFractionForAngle(angleRad) !== undefined) reading.push(`${degrees}°`);
        }

        expect(reading).toEqual([]);
        // Straight down, the old split point: the single angle that used to send a knob at maximum to
        // its minimum in one pointer move.
        expect(knobFractionForAngle(Math.PI / 2)).toBeUndefined();
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
                const value = resolveKnobValue({ control, angleRad, currentValue: control.defaultValue });
                if (!permitted.has(value)) offStep.push(value);
            }

            expect(offStep).toEqual([]);
        });
    });

    it('round-trips every authored step through its own angle, at both ends included', () => {
        eachControl((control) => {
            const values = authoredValues(control);
            const wrong = values
                .map((value) => ({ value, resolved: resolveKnobValue({ control, angleRad: knobAngleForValue(control, value), currentValue: control.defaultValue }) }))
                .filter(({ value, resolved }) => resolved !== value);

            expect(wrong).toEqual([]);
            expect(values[0]).toBe(control.min);
            expect(values[values.length - 1]).toBe(control.max);
        });
    });

    /**
     * The hysteresis the dead zone holds, swept across the **whole** quadrant from both ends.
     *
     * This is the regression that matters. Under the old nearest-end rule, a hand at the maximum that
     * kept dragging clockwise crossed 90° and the control jumped to its **minimum** — around 31 px of
     * further travel at r=40, and the exact failure `instrumentView.ts` says a bounded instrument must
     * not have. Holding the current value is total over the quadrant: from either end, at any angle in
     * it, the value the player set is the value that stays.
     */
    it('holds the value it came from anywhere in the dead zone, from either end', () => {
        eachControl((control) => {
            const drifted: string[] = [];
            for (let degrees = 46; degrees <= 134; degrees += 1) {
                const angleRad = (degrees * Math.PI) / 180;
                const fromMax = resolveKnobValue({ control, angleRad, currentValue: control.max });
                const fromMin = resolveKnobValue({ control, angleRad, currentValue: control.min });
                if (fromMax !== control.max) drifted.push(`${degrees}° from max → ${fromMax}`);
                if (fromMin !== control.min) drifted.push(`${degrees}° from min → ${fromMin}`);
            }

            expect(drifted).toEqual([]);
        });
    });

    it('holds a mid-range value too, rather than choosing an end', () => {
        eachControl((control) => {
            // The gesture that reaches this: press the knob body, slide down onto that knob's own step
            // affordance, which sits inside this quadrant directly beneath it. It used to slam the
            // control to an extreme on the way, and the affordance then added a step on top.
            const middle = steppedControlValue(control, (control.min + control.max) / 2);

            expect(resolveKnobValue({ control, angleRad: Math.PI / 2, currentValue: middle })).toBe(middle);
            expect(resolveKnobValue({ control, angleRad: (100 * Math.PI) / 180, currentValue: middle })).toBe(middle);
        });
    });

    /**
     * The centre singularity.
     *
     * `Math.atan2(0, 0)` is `0`, not `NaN`, so a finiteness guard never fires — and angle 0 is 225° along
     * this travel, i.e. 83.3 % of the range. Pressing the middle of a knob and moving one pixel set the
     * screen distance to 3.5 m. The radius samples elsewhere in this file are 18 and 240; neither is 0,
     * which is why this shipped.
     */
    it('reports no change for a pointer on or near the knob centre', () => {
        eachControl((control) => {
            const held = steppedControlValue(control, (control.min + control.max) / 2);

            expect(resolveKnobValueForPointer({ control, dx: 0, dy: 0, currentValue: held })).toBe(held);
            expect(resolveKnobValueForPointer({ control, dx: 1, dy: -1, currentValue: held })).toBe(held);
            // Just outside the dead radius, the conversion resumes and the angle is read normally.
            const outside = KNOB_MIN_TRACKING_RADIUS + 2;
            expect(resolveKnobValueForPointer({ control, dx: outside, dy: -outside, currentValue: held }))
                .toBe(resolveKnobValue({ control, angleRad: pointerAngleRad(outside, -outside), currentValue: held }));
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
                const small = resolveKnobValueForPointer({ control, dx: Math.cos(angleRad) * 18, dy: Math.sin(angleRad) * 18, currentValue: control.defaultValue });
                const large = resolveKnobValueForPointer({ control, dx: Math.cos(angleRad) * 240, dy: Math.sin(angleRad) * 240, currentValue: control.defaultValue });
                if (small !== large) disagreeing.push(`${angleRad}: ${small} vs ${large}`);
            }

            expect(disagreeing).toEqual([]);
        });
    });

    it('maps a pointer offset through the same angle atan2 reports', () => {
        eachControl((control) => {
            const dx = 40;
            const dy = -40;

            expect(resolveKnobValueForPointer({ control, dx, dy, currentValue: control.defaultValue }))
                .toBe(resolveKnobValue({ control, angleRad: pointerAngleRad(dx, dy), currentValue: control.defaultValue }));
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
                const dispatched = resolveKnobValue({ control, angleRad, currentValue: control.defaultValue });
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
            const dragged = resolveKnobValue({ control, angleRad: knobAngleForValue(control, stepped), currentValue: control.min });

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

/**
 * The dial and the slider (Story 3.4, AC3).
 *
 * Both are swept over **every authored control of both shipped cases**, at both range ends and across
 * every step, which is what AC3 asks for in as many words. `allControls` is the two cases together so a
 * conversion cannot pass by being right about 0.1…0.5 alone.
 */
const allControls = (): readonly PrimaryControl[] => [...controls, ...prototypeControls];

const eachAuthoredControl = (assert: (control: PrimaryControl) => void): void => {
    const all = allControls();
    expect(all.length).toBeGreaterThanOrEqual(4);
    all.forEach(assert);
};

describe('the dial travel', () => {
    it('reads zero at the index mark and comes back to it after a full turn', () => {
        eachAuthoredControl((control) => {
            // Straight up, in the shared `atan2` convention: `-π/2` points at twelve o'clock.
            expect(DIAL_INDEX_ANGLE_RAD).toBeCloseTo(-Math.PI / 2, 12);
            expect(dialFractionForAngle(control, DIAL_INDEX_ANGLE_RAD)).toBeCloseTo(0, 12);
            // Halfway round the *travel* is halfway through the values — not halfway round the circle,
            // since the seam holds a detent back.
            expect(dialFractionForAngle(control, DIAL_INDEX_ANGLE_RAD + (dialTravelRad(control) / 2))).toBeCloseTo(0.5, 12);
            // The travel still closes: a full turn is back at the index mark, which is what "no hard
            // stop" means. The seam changes where the *values* stop, not where the ring does.
            expect(dialFractionForAngle(control, DIAL_INDEX_ANGLE_RAD + (Math.PI * 2))).toBeCloseTo(0, 12);
            // And the maximum is a detent short of the index mark rather than on it.
            expect(dialFractionForAngle(control, DIAL_INDEX_ANGLE_RAD + dialTravelRad(control))).toBeCloseTo(1, 12);
        });
    });

    /**
     * The property that makes it a second instrument rather than a knob with a different label: there
     * is no angle a dial refuses to read. Break the wrap arithmetic and this sweep fails; leave the
     * knob's dead zone in it and it fails at 89 of these angles.
     */
    it('reads every direction, with no dead zone anywhere on the circle', () => {
        eachAuthoredControl((control) => {
            const unread: string[] = [];
            for (let degrees = 0; degrees < 360; degrees += 1) {
                if (dialFractionForAngle(control, (degrees * Math.PI) / 180) === undefined) unread.push(`${degrees}°`);
            }

            // Including the seam: it withholds *values*, never a reading. An angle in it resolves to the
            // nearer end, which is asserted by name in `reads every angle in the seam…` below.
            expect(unread).toEqual([]);
            // And the knob genuinely does refuse those angles, so the two are not the same function.
            expect(knobFractionForAngle(Math.PI / 2)).toBeUndefined();
            expect(dialFractionForAngle(control, Math.PI / 2)).toBeDefined();
        });
    });

    it('never resolves an off-step value, anywhere on the circle', () => {
        eachAuthoredControl((control) => {
            const permitted = new Set(authoredValues(control));
            const offStep: number[] = [];
            for (let sample = 0; sample < 720; sample += 1) {
                const angleRad = DIAL_INDEX_ANGLE_RAD + ((sample / 720) * Math.PI * 2);
                const value = resolveAffordanceValueForPointer({
                    affordance: 'dial',
                    control,
                    dx: Math.cos(angleRad) * 30,
                    dy: Math.sin(angleRad) * 30,
                    currentValue: control.defaultValue,
                    trackWidth: SLIDER_TRACK_WIDTH
                });
                if (!permitted.has(value)) offStep.push(value);
            }

            expect(offStep).toEqual([]);
        });
    });

    it('reaches both range ends', () => {
        eachAuthoredControl((control) => {
            const at = (fraction: number): number => {
                const angleRad = dialAngleForFraction(control, fraction);
                return resolveAffordanceValueForPointer({
                    affordance: 'dial',
                    control,
                    dx: Math.cos(angleRad) * 30,
                    dy: Math.sin(angleRad) * 30,
                    currentValue: control.defaultValue,
                    trackWidth: SLIDER_TRACK_WIDTH
                });
            };

            expect(at(0)).toBe(control.min);
            // Fraction 1 *is* the maximum now that the travel is seamed, so there is no "just short of"
            // constant to tune. The 0.9999 that stood here was arithmetically wrong for any control
            // with more than ~5000 steps — reaching the top needs `1 - fraction < step / (2 * range)` —
            // and it only ever passed because every shipped control has twelve.
            expect(at(1)).toBe(control.max);
        });
    });

    it('holds its value for a pointer on the centre, where there is no direction', () => {
        // `Math.atan2(0, 0)` is `0`, not `NaN`, so a finite-check never fires — the same trap the knob
        // carries `KNOB_MIN_TRACKING_RADIUS` for, and the dial inherits it because it reads a direction.
        eachAuthoredControl((control) => {
            const held = steppedNeighbour(control, control.min, 1);
            expect(resolveAffordanceValueForPointer({
                affordance: 'dial', control, dx: 0, dy: 0, currentValue: held, trackWidth: SLIDER_TRACK_WIDTH
            })).toBe(held);
        });
    });

    it('draws one tick per authored step, at the angle that step turns to', () => {
        eachAuthoredControl((control) => {
            const ticks = dialTickAngles(control);

            expect(ticks).toHaveLength(knobStepCount(control) + 1);
            expect(ticks[0]).toBeCloseTo(DIAL_INDEX_ANGLE_RAD, 12);
            const misplaced = authoredValues(control)
                .map((value, index) => ({ expected: dialAngleForValue(control, value), drawn: ticks[index]! }))
                .filter(({ expected, drawn }) => Math.abs(expected - drawn) > 1e-9);

            expect(misplaced).toEqual([]);
        });
    });
});

describe('the slider travel', () => {
    it('reads the left end as 0, the middle as 0.5 and the right end as 1', () => {
        expect(sliderFractionForOffset(-SLIDER_TRACK_WIDTH / 2, SLIDER_TRACK_WIDTH)).toBeCloseTo(0, 12);
        expect(sliderFractionForOffset(0, SLIDER_TRACK_WIDTH)).toBeCloseTo(0.5, 12);
        expect(sliderFractionForOffset(SLIDER_TRACK_WIDTH / 2, SLIDER_TRACK_WIDTH)).toBeCloseTo(1, 12);
    });

    it('clamps past either end rather than wrapping or refusing', () => {
        // A track has real ends, unlike a dial — and unlike a knob there is no direction to lose, so an
        // overshoot means the end of the track rather than "hold the current value".
        expect(sliderFractionForOffset(-SLIDER_TRACK_WIDTH, SLIDER_TRACK_WIDTH)).toBe(0);
        expect(sliderFractionForOffset(SLIDER_TRACK_WIDTH, SLIDER_TRACK_WIDTH)).toBe(1);
    });

    it('never resolves an off-step value, anywhere along the track', () => {
        eachAuthoredControl((control) => {
            const permitted = new Set(authoredValues(control));
            const offStep: number[] = [];
            for (let sample = -400; sample <= 400; sample += 1) {
                const value = resolveAffordanceValueForPointer({
                    affordance: 'slider',
                    control,
                    dx: sample / 4,
                    dy: 0,
                    currentValue: control.defaultValue,
                    trackWidth: SLIDER_TRACK_WIDTH
                });
                if (!permitted.has(value)) offStep.push(value);
            }

            expect(offStep).toEqual([]);
        });
    });

    it('reaches both range ends', () => {
        eachAuthoredControl((control) => {
            const at = (dx: number): number => resolveAffordanceValueForPointer({
                affordance: 'slider', control, dx, dy: 0, currentValue: control.defaultValue, trackWidth: SLIDER_TRACK_WIDTH
            });

            expect(at(-SLIDER_TRACK_WIDTH)).toBe(control.min);
            expect(at(SLIDER_TRACK_WIDTH)).toBe(control.max);
        });
    });

    it('reads a distance, not a direction — vertical pointer travel changes nothing', () => {
        // The property that makes it a third instrument. A rotary conversion would move the value here.
        eachAuthoredControl((control) => {
            const flat = resolveAffordanceValueForPointer({
                affordance: 'slider', control, dx: 20, dy: 0, currentValue: control.defaultValue, trackWidth: SLIDER_TRACK_WIDTH
            });
            const raised = resolveAffordanceValueForPointer({
                affordance: 'slider', control, dx: 20, dy: -80, currentValue: control.defaultValue, trackWidth: SLIDER_TRACK_WIDTH
            });

            expect(raised).toBe(flat);
        });
    });

    it('puts the thumb where the value is, and a tick at every detent', () => {
        eachAuthoredControl((control) => {
            expect(sliderOffsetForValue(control, control.min, SLIDER_TRACK_WIDTH)).toBeCloseTo(-SLIDER_TRACK_WIDTH / 2, 12);
            expect(sliderOffsetForValue(control, control.max, SLIDER_TRACK_WIDTH)).toBeCloseTo(SLIDER_TRACK_WIDTH / 2, 12);

            const ticks = sliderTickOffsets(control, SLIDER_TRACK_WIDTH);
            expect(ticks).toHaveLength(knobStepCount(control) + 1);
            const misplaced = authoredValues(control)
                .map((value, index) => ({ expected: sliderOffsetForValue(control, value, SLIDER_TRACK_WIDTH), drawn: ticks[index]! }))
                .filter(({ expected, drawn }) => Math.abs(expected - drawn) > 1e-9);

            expect(misplaced).toEqual([]);
        });
    });
});

/**
 * AC3's "the drag path and the step path produce identical run records", for **every** affordance.
 *
 * Asserted as an identity between two functions rather than by comparing a dispatch to itself, which is
 * the tautology shape reviews of 2.11 and 3.2 both found. `steppedNeighbour` is affordance-independent
 * by construction — no affordance owns a stepper — and this is what pins that it stays so.
 */
describe('every affordance dispatches the value a step would', () => {
    const pointerAt = (affordance: ControlAffordance, control: PrimaryControl, value: number, currentValue: number): number => {
        if (affordance === 'slider') {
            return resolveAffordanceValueForPointer({
                affordance, control, dx: sliderOffsetForValue(control, value, SLIDER_TRACK_WIDTH), dy: 0, currentValue, trackWidth: SLIDER_TRACK_WIDTH
            });
        }
        const angleRad = affordance === 'dial' ? dialAngleForValue(control, value) : knobAngleForValue(control, value);
        return resolveAffordanceValueForPointer({
            affordance,
            control,
            dx: Math.cos(angleRad) * 30,
            dy: Math.sin(angleRad) * 30,
            currentValue,
            trackWidth: SLIDER_TRACK_WIDTH
        });
    };

    it.each(CONTROL_AFFORDANCES)('agrees with steppedNeighbour on %s', (affordance) => {
        eachAuthoredControl((control) => {
            // No affordance is excused any of its authored values. The dial used to be — its last two
            // were skipped here, because a full-circle travel put the maximum at the index mark where
            // the minimum is and dragging there dispatched the minimum. That carve-out *was* the ADR-012
            // defect: keyboard and drag disagreed at the top of every dial's range, and the sweep that
            // exists to catch exactly that was shaped around it. Story 3.4's code review seamed the
            // travel; the carve-out goes with it, and this line failing again means the seam is gone.
            const stepsTaken = authoredValues(control).slice(0, -1);
            const disagreements = stepsTaken.map((value) => {
                const stepped = steppedNeighbour(control, value, 1);
                return { value, stepped, dragged: pointerAt(affordance, control, stepped, value) };
            }).filter(({ stepped, dragged }) => stepped !== dragged);

            expect(stepsTaken.length).toBeGreaterThan(0);
            expect(disagreements).toEqual([]);
        });
    });

    /**
     * The dial's defining property since Story 3.4's code review: **its travel closes, with a seam**.
     *
     * The ring is continuous to look at, but the authored values occupy `stepCount / (stepCount + 1)`
     * of it, so the maximum sits one detent *before* the index mark rather than on it. Every value is
     * therefore reachable by drag, which is what ADR-012 requires of the gesture and what the sweep
     * above no longer has to excuse.
     *
     * The authoring rule `docs/content-authoring/` carries is unchanged and is about the *model*, not
     * the widget: a dial's ends sit adjacent, so author one only where that adjacency is the truth.
     * `ScenarioAuthoringContract.test.ts` pins every shipped dial against its own model at both ends.
     */
    it('seams the dial travel before the index mark, and keeps the knob bounded', () => {
        eachAuthoredControl((control) => {
            // One detent of gap, and the two ends no longer share an angle.
            const travel = dialTravelRad(control);
            expect(dialAngleForValue(control, control.max) - dialAngleForValue(control, control.min)).toBeCloseTo(travel, 12);
            expect(travel).toBeLessThan(Math.PI * 2);
            expect(pointerAt('dial', control, control.max, control.defaultValue)).toBe(control.max);

            // The knob's ends are 270° apart and stay apart: the wrap a bounded instrument must not have.
            expect(pointerAt('knob', control, control.max, control.defaultValue)).toBe(control.max);
            expect(pointerAt('slider', control, control.max, control.defaultValue)).toBe(control.max);
        });
    });

    it('reads every angle in the seam as one of the two ends it lies between', () => {
        // The seam is a gap in the *values*, not a dead zone: an instrument that held its value here
        // would be a knob with extra steps, and the no-dead-zone property is the dial's whole point.
        eachAuthoredControl((control) => {
            const travel = dialTravelRad(control);
            const readings = Array.from({ length: 24 }, (_unused, index) => {
                const angleRad = DIAL_INDEX_ANGLE_RAD + travel + (((index + 0.5) / 24) * ((Math.PI * 2) - travel));
                return resolveAffordanceValueForPointer({
                    affordance: 'dial',
                    control,
                    dx: Math.cos(angleRad) * 30,
                    dy: Math.sin(angleRad) * 30,
                    // Deliberately neither end, so a "held the current value" bug cannot pass as a read.
                    currentValue: steppedNeighbour(control, control.min, 1),
                    trackWidth: SLIDER_TRACK_WIDTH
                });
            });

            expect(new Set(readings)).toEqual(new Set([control.min, control.max]));
        });
    });

    it.each(CONTROL_AFFORDANCES)('normalizes through the domain rule rather than a private copy on %s', (affordance) => {
        // If a branch ever grew its own rounding, this is the assertion that would catch it: every
        // answer must be one `normalizeControlValue` would give for the same request.
        eachAuthoredControl((control) => {
            authoredValues(control).forEach((value) => {
                const resolved = pointerAt(affordance, control, value, control.defaultValue);
                const normalized = normalizeControlValue(control, resolved);

                expect(normalized.ok && normalized.value).toBe(resolved);
            });
        });
    });
});

/**
 * AC4 at the conversion: a control that authors no affordance is converted exactly as a knob.
 *
 * Against an **explicit** `'knob'`, never against another defaulted control — comparing two defaulted
 * ones passes just as happily with the default flipped, which is what the first attempt at this did.
 */
describe('a control with no authored affordance', () => {
    it('converts a pointer exactly as an explicit knob does, across the whole travel', () => {
        eachAuthoredControl((control) => {
            const absent: PrimaryControl = { ...control, affordance: undefined };
            expect(controlAffordance(absent)).toBe('knob');

            const disagreements: string[] = [];
            for (let sample = 0; sample <= 360; sample += 1) {
                const angleRad = (sample * Math.PI) / 180;
                const dx = Math.cos(angleRad) * 30;
                const dy = Math.sin(angleRad) * 30;
                const defaulted = resolveAffordanceValueForPointer({
                    affordance: controlAffordance(absent), control: absent, dx, dy, currentValue: control.defaultValue, trackWidth: SLIDER_TRACK_WIDTH
                });
                const asKnob = resolveKnobValueForPointer({ control, dx, dy, currentValue: control.defaultValue });
                if (defaulted !== asKnob) disagreements.push(`${sample}°: ${defaulted} vs ${asKnob}`);
            }

            expect(disagreements).toEqual([]);
        });
    });

    it('still refuses the knob dead zone, which a dial or a slider would not', () => {
        // The sharpest form of the same assertion: the default has to pick the affordance whose dead
        // zone exists. A defaulted slider or dial would answer here rather than holding.
        eachAuthoredControl((control) => {
            const held = steppedNeighbour(control, control.min, 1);
            const straightDown = resolveAffordanceValueForPointer({
                affordance: controlAffordance({ ...control, affordance: undefined }),
                control,
                dx: 0,
                dy: 30,
                currentValue: held,
                trackWidth: SLIDER_TRACK_WIDTH
            });

            expect(straightDown).toBe(held);
        });
    });
});

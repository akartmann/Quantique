/**
 * The rotary instrument's conversion between where the pointer is and which authored value the knob
 * is turned to (Story 2.10).
 *
 * **Phaser is not imported here at all** — not even as a type. `ApparatusRenderer` imports it as a
 * *value* (`BlendModes`), Phaser touches `window` at import time, and both Vitest and Playwright run in
 * Node, so nothing inside that file can be reached by a test. `advanceView.ts`, `apparatusGeometry.ts`,
 * `libraryGeometry.ts` and `characterStageView.ts` each exist as the answer to that; this is the next
 * one, and `InstrumentView.test.ts` drives it directly.
 *
 * ## What lives here, and what does not
 *
 * This module owns the **conversion**: pointer offset → angle → authored value, and back. Where the
 * knob is drawn — its centre, its radius, its step affordances — is `apparatusGeometry.ts`'s, which is
 * the same split `libraryGeometry.ts` / `LibraryRenderer.ts` already draws. A number that answers
 * "where is it" goes there; a number that answers "what does turning it mean" goes here.
 *
 * ## Snap before dispatch, never after (ADR-012, D1)
 *
 * A drag emits a pointer event per frame at whatever angle the hand happens to be at, and almost none
 * of those angles land on an authored step. The reducer would snap the value for us —
 * `normalizeControlValue` clamps and snaps, and that is its guarantee — but the *snapped* value then
 * comes back through `render()` and the indicator jumps out from under the cursor. The normalization
 * rule becomes visible, which is precisely what ADR-012 forbids. So the surface snaps first, and
 * dispatches a value the reducer will hand straight back.
 *
 * **The snap is the domain's own function, not a copy of it.** The story's Task 1 allowed for
 * restating the tie rule here and pinning the agreement with a test; delegating to
 * {@link normalizeControlValue} is the same requirement taken to its end — the two cannot disagree
 * because there is only one of them. `InstrumentView.test.ts` keeps the agreement assertions anyway,
 * across every step and at both ends, so a future change that reintroduced a private copy would have
 * to keep it identical or fail.
 *
 * The authored {@link PrimaryControl} is passed in whole rather than as a loose `{min, max, step}` for
 * the same reason: it is what the domain function takes, and narrowing it here would mean a cast that
 * claims a shape the caller does not have.
 */

import { normalizeControlValue } from '../../../domain/apparatus/ApparatusControl';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';

const TWO_PI = Math.PI * 2;
const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The travel arc, in the one angle convention `Math.atan2(dy, dx)` and Phaser's `Graphics.arc` share:
 * 0 points straight right (+x), and the angle grows **clockwise on screen**, because canvas y grows
 * downward.
 *
 * 135° → 405° is the classic rotary sweep. The indicator starts pointing down-left, turns clockwise
 * through the top, and stops pointing down-right, which leaves a 90° dead zone at the bottom where a
 * real knob's shaft and mounting are. The dead zone is not decoration: without it the two ends of the
 * travel would touch, and a hand that dragged a fraction past the maximum would wrap the value round
 * to the minimum — the one failure a bounded instrument must not have.
 */
export const KNOB_ARC_START_DEG = 135;
export const KNOB_ARC_SWEEP_DEG = 270;
export const KNOB_ARC_START_RAD = degreesToRadians(KNOB_ARC_START_DEG);
export const KNOB_ARC_SWEEP_RAD = degreesToRadians(KNOB_ARC_SWEEP_DEG);
export const KNOB_ARC_END_RAD = KNOB_ARC_START_RAD + KNOB_ARC_SWEEP_RAD;
/** What is left of the circle once the travel has its 270°: the shaft's own quadrant. */
export const KNOB_DEAD_ZONE_RAD = TWO_PI - KNOB_ARC_SWEEP_RAD;

/** The angle from a knob's centre to a pointer, in the convention above. */
export const pointerAngleRad = (dx: number, dy: number): number => Math.atan2(dy, dx);

/**
 * How far along the travel an angle is, as 0…1.
 *
 * A pointer inside the dead zone is clamped to whichever end of the travel it is nearer, rather than
 * being ignored: a hand that overshoots the maximum expects the knob to sit at the maximum, and a
 * knob that stopped responding for a quadrant would read as broken.
 */
export const knobFractionForAngle = (angleRad: number): number => {
    if (!Number.isFinite(angleRad)) return 0;
    const offset = ((((angleRad - KNOB_ARC_START_RAD) % TWO_PI) + TWO_PI) % TWO_PI);
    if (offset <= KNOB_ARC_SWEEP_RAD) return offset / KNOB_ARC_SWEEP_RAD;
    return (offset - KNOB_ARC_SWEEP_RAD) < (KNOB_DEAD_ZONE_RAD / 2) ? 1 : 0;
};

export const knobAngleForFraction = (fraction: number): number =>
    KNOB_ARC_START_RAD + (clamp01(fraction) * KNOB_ARC_SWEEP_RAD);

/**
 * Where along the travel a value sits.
 *
 * A degenerate control whose bounds are equal would divide by zero, so it reads as fully anticlockwise
 * rather than as `NaN` — the renderer downstream would otherwise set the indicator's rotation to a
 * number Phaser cannot draw.
 */
export const knobFractionForValue = (control: PrimaryControl, value: number): number =>
    control.max === control.min ? 0 : clamp01((value - control.min) / (control.max - control.min));

export const knobAngleForValue = (control: PrimaryControl, value: number): number =>
    knobAngleForFraction(knobFractionForValue(control, value));

/**
 * Clamps to the authored range and snaps to the authored step — the reducer's own rule, applied
 * before dispatch rather than after it. See the module header for why that is not merely an
 * optimization.
 *
 * The fallback is unreachable through {@link resolveKnobValue}, which never produces a non-finite
 * request, and is here because the domain function correctly refuses one rather than guessing.
 */
export const steppedControlValue = (control: PrimaryControl, requestedValue: number): number => {
    const normalized = normalizeControlValue(control, requestedValue);
    return normalized.ok ? normalized.value : control.min;
};

/** The stepped, clamped value a knob turned to this angle means. Never off-step, never out of range. */
export const resolveKnobValue = ({ control, angleRad }: Readonly<{ control: PrimaryControl; angleRad: number }>): number =>
    steppedControlValue(control, control.min + (knobFractionForAngle(angleRad) * (control.max - control.min)));

/** The same, from a pointer offset relative to the knob's centre. Radius plays no part. */
export const resolveKnobValueForPointer = (
    { control, dx, dy }: Readonly<{ control: PrimaryControl; dx: number; dy: number }>
): number => resolveKnobValue({ control, angleRad: pointerAngleRad(dx, dy) });

/**
 * One authored step in a direction, clamped at the ends.
 *
 * Snapped on the way in as well as on the way out, so a step taken from a restored value that predates
 * a content change still lands on the grid the control has now.
 */
export const steppedNeighbour = (control: PrimaryControl, currentValue: number, direction: -1 | 1): number =>
    steppedControlValue(control, steppedControlValue(control, currentValue) + (direction * control.step));

/** How many steps the travel is divided into. At least one, so a degenerate control still draws. */
export const knobStepCount = (control: PrimaryControl): number =>
    Math.max(1, Math.round((control.max - control.min) / control.step));

/**
 * The angle of every detent, for the painter.
 *
 * Derived from the same conversion the drag uses rather than laid out independently, so the ticks the
 * player sees are the positions the knob actually stops at — a tick drawn anywhere else would be an
 * instrument lying about its own resolution.
 */
export const knobTickAngles = (control: PrimaryControl): readonly number[] =>
    Array.from({ length: knobStepCount(control) + 1 }, (_unused, index) =>
        knobAngleForValue(control, control.min + (index * control.step)));

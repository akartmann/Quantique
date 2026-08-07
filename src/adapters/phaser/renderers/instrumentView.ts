/**
 * The rotary instrument's conversion between where the pointer is and which authored value the knob
 * is turned to (Story 2.10).
 *
 * **Phaser is not imported here at all** — not even as a type, so a Node-hosted Vitest or Playwright
 * spec can import the rule without Phaser touching `window`. `advanceView.ts`, `apparatusGeometry.ts`,
 * `libraryGeometry.ts` and `characterStageView.ts` each exist for the same reason; this is the next one,
 * and `InstrumentView.test.ts` drives it directly.
 *
 * Story 2.10 also freed `ApparatusRenderer` itself of its one *value* import of Phaser (`BlendModes`,
 * now `setBlendMode('ADD')`), so `ApparatusRun.test.ts` reaches the renderer from Vitest. That does not
 * make this module redundant: a spec deriving a click target or a conversion should read numbers, not
 * construct a renderer.
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
 *
 * **The dead zone holds the value; it does not choose an end** (review 2026-08-07). Clamping a dead-zone
 * pointer to whichever end it was *nearer* moved the wrap rather than removing it: the quadrant splits
 * at 90°, so continuing the same clockwise drag ~46° past the maximum crossed the split and flipped the
 * control to its minimum in one `pointermove` — about 31 px of travel at r=40, and the exact failure the
 * paragraph above forbids. It also meant a press on the knob body followed by a slide down onto that
 * knob's own step affordance — which sits *inside* this quadrant, directly beneath it — slammed the
 * control to an extreme on the way. So a pointer with no travel under it changes nothing at all: the
 * knob holds where the hand left it, which is both what a real knob does when you grab its shaft and
 * what keeps a bounded instrument bounded from either direction.
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
 * The pointer offset below which a knob has no direction to read.
 *
 * `Math.atan2(0, 0)` returns `0` rather than `NaN`, so a `Number.isFinite` guard never fires for a
 * pointer sitting exactly on the centre — and angle 0 is 225° along this travel, i.e. **83.3 %** of the
 * range. Pressing the middle of a knob and moving one pixel therefore used to set the screen distance
 * to 3.5 m (review 2026-08-07). Inside this radius there is no meaningful direction, so there is no
 * value to report; 8 px is comfortably inside `KNOB_BODY_RADIUS` and larger than any rounding a
 * `Scale.FIT` transform introduces.
 */
export const KNOB_MIN_TRACKING_RADIUS = 8;

/**
 * How far along the travel an angle is, as 0…1 — or `undefined` when the angle lies in the shaft's dead
 * zone, where the travel says nothing about what the player means.
 *
 * `undefined` rather than a clamped end on purpose: see the travel-arc note above for why choosing the
 * nearer end reintroduced the wrap it was meant to prevent. The caller decides what "no reading" means,
 * and for a drag in progress the answer is "hold the current value".
 */
export const knobFractionForAngle = (angleRad: number): number | undefined => {
    if (!Number.isFinite(angleRad)) return undefined;
    const offset = ((((angleRad - KNOB_ARC_START_RAD) % TWO_PI) + TWO_PI) % TWO_PI);
    return offset <= KNOB_ARC_SWEEP_RAD ? offset / KNOB_ARC_SWEEP_RAD : undefined;
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

/**
 * The stepped, clamped value a knob turned to this angle means. Never off-step, never out of range.
 *
 * `currentValue` is where the control is now, and it is **required** rather than defaulted: it is what
 * the knob holds when the angle carries no reading, and a default would turn a wiring omission into a
 * silent jump to some fixed point on the travel. Pass the value the store holds, snapped on the way out
 * so a restored value predating a content change still lands on the grid the control has now.
 */
export const resolveKnobValue = (
    { control, angleRad, currentValue }: Readonly<{ control: PrimaryControl; angleRad: number; currentValue: number }>
): number => {
    const fraction = knobFractionForAngle(angleRad);
    if (fraction === undefined) return steppedControlValue(control, currentValue);
    return steppedControlValue(control, control.min + (fraction * (control.max - control.min)));
};

/**
 * The same, from a pointer offset relative to the knob's centre.
 *
 * Radius plays no part in the *conversion* — a `Scale.FIT` surface gives a larger knob and a
 * proportionally larger offset for the same gesture, and the value must not move. It plays one part in
 * whether there is a conversion to do at all: see {@link KNOB_MIN_TRACKING_RADIUS}.
 */
export const resolveKnobValueForPointer = (
    { control, dx, dy, currentValue }: Readonly<{ control: PrimaryControl; dx: number; dy: number; currentValue: number }>
): number => {
    if (Math.hypot(dx, dy) < KNOB_MIN_TRACKING_RADIUS) return steppedControlValue(control, currentValue);
    return resolveKnobValue({ control, angleRad: pointerAngleRad(dx, dy), currentValue });
};

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

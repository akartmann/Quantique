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
import type { ControlAffordance, PrimaryControl } from '../../../domain/cases/CaseDefinition';

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

// --- The dial (Story 3.4) -----------------------------------------------------------------------
//
// A full circle read against a fixed index mark, and the deliberate opposite of the knob above: no
// dead zone, so no wrap to guard against and no hysteresis to tune. That is not a simplification of
// the knob, it is the right instrument for a *cyclic* quantity — a rotation angle has no hard stop,
// and the knob's 90° shaft quadrant is an artefact of the widget rather than of the thing measured.
//
// The consequence an author has to know, and which `docs/content-authoring/` states: the travel
// closes, so the minimum and the maximum meet at the index mark. Author `dial` only where they really
// are the same reading. For the prototype's `rotationDeg` they are — its model is `cos(2θ)`, and 0°
// and 180° give the identical fringe displacement.

/**
 * Where a dial reads zero: straight up, in the same convention {@link pointerAngleRad} uses.
 *
 * The top rather than the knob's down-left start, because a divided circle is read against an index
 * mark at twelve o'clock — and because there is no shaft quadrant to keep clear of.
 */
export const DIAL_INDEX_ANGLE_RAD = -Math.PI / 2;

/**
 * How far round the dial an angle is, as 0…1.
 *
 * Never `undefined` for a finite angle, which is the whole difference from
 * {@link knobFractionForAngle}: every direction from the centre is a reading, so there is nowhere for
 * the value to be held. The centre itself is still not a direction — {@link KNOB_MIN_TRACKING_RADIUS}
 * guards that for both instruments, for the `Math.atan2(0, 0) === 0` reason recorded on it.
 */
export const dialFractionForAngle = (angleRad: number): number | undefined => {
    if (!Number.isFinite(angleRad)) return undefined;
    return ((((angleRad - DIAL_INDEX_ANGLE_RAD) % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI;
};

export const dialAngleForFraction = (fraction: number): number =>
    DIAL_INDEX_ANGLE_RAD + (clamp01(fraction) * TWO_PI);

export const dialAngleForValue = (control: PrimaryControl, value: number): number =>
    dialAngleForFraction(knobFractionForValue(control, value));

/** The angle of every detent round the dial, for the painter. Derived from the drag's own conversion. */
export const dialTickAngles = (control: PrimaryControl): readonly number[] =>
    Array.from({ length: knobStepCount(control) + 1 }, (_unused, index) =>
        dialAngleForValue(control, control.min + (index * control.step)));

// --- The slider (Story 3.4) ---------------------------------------------------------------------
//
// Linear travel along a track. The conversion reads a *distance*, not a direction, which is what makes
// it a third instrument rather than a knob drawn flat.

/**
 * How far along a track a pointer is, as 0…1, from its offset relative to the track's centre.
 *
 * Clamped rather than refused at either end: unlike a rotary travel there is no direction to lose and
 * no wrap to fall through, so a hand that overshoots the end of the track means the end of the track.
 * A degenerate track reads as fully left rather than as `NaN`, the same guard
 * {@link knobFractionForValue} carries for degenerate bounds.
 */
export const sliderFractionForOffset = (dx: number, trackWidth: number): number =>
    trackWidth <= 0 || !Number.isFinite(dx) ? 0 : clamp01((dx + (trackWidth / 2)) / trackWidth);

/** Where along the track a value sits, as 0…1. The same fraction the knob and the dial read. */
export const sliderFractionForValue = knobFractionForValue;

/** The thumb's offset from the track centre for a value, for the painter. */
export const sliderOffsetForValue = (control: PrimaryControl, value: number, trackWidth: number): number =>
    (knobFractionForValue(control, value) - 0.5) * trackWidth;

/** The offset of every detent along the track, for the painter. Derived from the drag's conversion. */
export const sliderTickOffsets = (control: PrimaryControl, trackWidth: number): readonly number[] =>
    Array.from({ length: knobStepCount(control) + 1 }, (_unused, index) =>
        sliderOffsetForValue(control, control.min + (index * control.step), trackWidth));

// --- One entry point per gesture ------------------------------------------------------------------

/**
 * The stepped, clamped value a pointer means, for whichever instrument this control is drawn as.
 *
 * One seam rather than three call sites in `ApparatusInstrument`, so "snap before dispatch" is a
 * property of the *bench* and not of each instrument remembering to. Every branch ends in
 * {@link steppedControlValue}, which is the domain's own `normalizeControlValue`: there is one snap
 * rule and none of these three owns a copy of it.
 *
 * `currentValue` is required for the same reason {@link resolveKnobValue}'s is — it is what the
 * instrument holds when the pointer carries no reading (inside the centre radius, or in the knob's
 * dead zone). A default would turn a wiring omission into a silent jump.
 */
export const resolveAffordanceValueForPointer = (
    { affordance, control, dx, dy, currentValue, trackWidth }: Readonly<{
        affordance: ControlAffordance;
        control: PrimaryControl;
        dx: number;
        dy: number;
        currentValue: number;
        /** The slider's track width. Unread by the two rotary affordances. */
        trackWidth: number;
    }>
): number => {
    if (affordance === 'slider') {
        return steppedControlValue(control, control.min + (sliderFractionForOffset(dx, trackWidth) * (control.max - control.min)));
    }

    if (Math.hypot(dx, dy) < KNOB_MIN_TRACKING_RADIUS) return steppedControlValue(control, currentValue);

    const angleRad = pointerAngleRad(dx, dy);
    const fraction = affordance === 'dial' ? dialFractionForAngle(angleRad) : knobFractionForAngle(angleRad);
    if (fraction === undefined) return steppedControlValue(control, currentValue);
    return steppedControlValue(control, control.min + (fraction * (control.max - control.min)));
};

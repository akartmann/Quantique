import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';
import {
    INSTRUMENT_READOUT_FONT_SIZE,
    INSTRUMENT_READOUT_WRAP,
    INSTRUMENT_READOUT_Y,
    KNOB_BODY_RADIUS,
    KNOB_FOCUS_RADIUS,
    KNOB_INDICATOR_LENGTH,
    KNOB_TICK_LENGTH,
    KNOB_TRAVEL_RADIUS,
    STEP_AFFORDANCE_FONT_SIZE,
    STEP_AFFORDANCE_HEIGHT,
    STEP_AFFORDANCE_WIDTH,
    instrumentSlotLeft,
    knobCentre,
    stepAffordanceCentre
} from './apparatusGeometry';
import {
    KNOB_ARC_START_RAD,
    KNOB_ARC_SWEEP_RAD,
    knobAngleForValue,
    knobTickAngles,
    resolveKnobValueForPointer,
    steppedNeighbour
} from './instrumentView';

/**
 * One physical instrument on the bench: a knob with a body, an indicator and a bounded travel arc,
 * its two discrete step affordances, and the readout that names what it is set to (Story 2.10, AC1).
 *
 * It replaces the `+` / `−` text button pair, which was a stepper drawn as two buttons — the
 * non-physical-controls finding the 2026-08-06 sprint change recorded against
 * `ApparatusRenderer.ts:504-525`, and what ADR-012 exists to answer.
 *
 * ## It knows nothing about the store
 *
 * It takes the authored {@link PrimaryControl}, a resolved readout string, and two callbacks. Never a
 * `PhaserStoreAdapter`, a selector, or a locale — the same contract `AdvanceControl`, `DialogueBox`
 * and `ProposalChoice` follow, and what lets the value it reports be dispatched by its owner rather
 * than mutated by it. **The renderer never mutates state** (AC2).
 *
 * ## Why the drag is tracked on the scene and not on the knob
 *
 * `pointerdown` on the knob arms the drag, `scene.input.on('pointermove')` tracks it, and
 * `pointerup` / `pointerupoutside` disarms. A pointer that leaves the knob body mid-turn must keep
 * turning it — which is what a real knob does, and what `gameObject.on('pointermove')` cannot give
 * you, because it stops firing the moment the pointer is outside the hit area. `pointer.x` / `y` are
 * already in design space: the `Scale.FIT` manager transforms them, so there is no mapping to do here.
 *
 * `Phaser.Input.InputPlugin.setDraggable` plus a `drag` handler was the other candidate and is the
 * wrong model — its `dragX`/`dragY` are a *translation*, and a rotary control is not translated.
 *
 * ## Snapped before it is reported, never after
 *
 * {@link resolveKnobValueForPointer} returns a value already clamped and snapped to the authored step,
 * so the indicator moves in detents and the reducer hands back exactly what was dispatched. Reporting
 * the raw angle and letting `normalizeControlValue` snap would work and would *look* wrong: the
 * snapped value returns through `render()` and the indicator jumps out from under the cursor, which
 * makes the normalization rule visible — the thing ADR-012 forbids.
 *
 * ## What is drawn once, and what moves
 *
 * The body, the travel arc, the detents and the focus ring are `Graphics` fill/stroke commands issued
 * **once** in {@link create}; only the indicator moves, by `setRotation` on its own object. §Performance
 * forbids regenerating `Graphics` in a render path, and `ReadingRoomDecor` and `LaboratoryDecor` are
 * the precedent.
 */

const BODY_FILL = 0x1d4451;
const BODY_RIM = 0x8db7c2;
const TRAVEL_ARC = 0x4d7f8c;
const TICK = 0x6f9aa6;
const INDICATOR = 0xf4d35e;
const FOCUS_RING = 0xf4d35e;
const AFFORDANCE_FILL = 0x1d4451;
const AFFORDANCE_LABEL = '#f7f4ef';

export type ApparatusInstrumentOptions = Readonly<{
    /** Which slot on the bench, which is also this instrument's place in the authored control order. */
    index: number;
    control: PrimaryControl;
    /**
     * A new, already-stepped value the player has turned or stepped to.
     *
     * Only fired when the value actually **changes**. A drag emits a pointer event per frame, and
     * reporting an unchanged value would mint a new frozen `AppState` on every one of them — which
     * re-renders every subscriber, restarts the transient-message lifetime clock (`transientMessage.ts`
     * keys on state object identity, and a new object clears the slot), and allocates in a hot path.
     *
     * **Returns whether the store committed the value**, and the instrument believes the answer rather
     * than the request (review 2026-08-07). Treating "dispatched" as "committed" desynchronised the knob
     * from the store on any refusal — `createStore` refuses *every* action with `progress-operation-active`
     * while an export or import holds the exclusive lock, and a refused dispatch mints no new state, so no
     * `render()` ever arrives to correct the instrument. It then stepped from a value the store did not
     * hold, and turning the knob *back* was swallowed by the unchanged-value guard, leaving the control
     * silently stuck.
     */
    onValueChange: (value: number) => boolean;
    /** The player has touched this instrument, so keyboard stepping should now reach it (D4). */
    onFocus: () => void;
}>;

export type ApparatusInstrumentView = Readonly<{
    /** The authored value the control is set to, from the store. Never from anything drawn here. */
    value: number;
    /** The already-localized `"{label}: {value}"` line. Resolved by the owner; this holds no locale. */
    readout: string;
    decreaseLabel: string;
    increaseLabel: string;
    /**
     * Whether keyboard stepping currently reaches this instrument.
     *
     * There is no DOM focus on a canvas and this story must not introduce one, so focus is a
     * renderer-local fact drawn as a visible ring — which `EXPERIENCE.md` §Controls asks for in as many
     * words, and without which AC3's "with the knob focused" is unsatisfiable.
     */
    focused: boolean;
}>;

export class ApparatusInstrument {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private focusRing?: Phaser.GameObjects.Graphics;
    private indicator?: Phaser.GameObjects.Graphics;
    private hitArea?: Phaser.GameObjects.Zone;
    private readout?: Phaser.GameObjects.Text;
    private readonly affordances: Readonly<{ surface: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>[] = [];
    private inputEnabled = true;
    private dragging = false;
    /**
     * Which pointer armed the drag.
     *
     * The move handler is on the scene (see the header), so without this it turned this knob for
     * *whatever* pointer the scene handed it: on a touch surface a second finger anywhere on the bench
     * rewrote the setup through the absolute arc, because the conversion reads a direction rather than a
     * delta (review 2026-08-07).
     */
    private dragPointerId?: number;
    /**
     * Which step affordance the current press began on, so a release over one only steps if the press
     * started there.
     *
     * Phaser dispatches an up-event by the current hit test rather than by where the down happened, and
     * the affordances sit inside the knob's dead-zone quadrant directly beneath it — so a press on the
     * knob body slid down onto `−` released *on the affordance* and applied a step on top of the drag
     * (review 2026-08-07). Set on the affordance's own `pointerdown` and cleared by any other press,
     * which makes this ordinary click semantics rather than a guess about event order.
     */
    private affordancePressed?: -1 | 1;
    /** The last value reported, so a drag across one detent reports once rather than once per frame. */
    private reportedValue?: number;

    public constructor(private readonly scene: Scene, private readonly options: ApparatusInstrumentOptions) {}

    public create(): void {
        const centre = knobCentre(this.options.index);

        // Drawn once. Nothing below is reissued on a render — see the header.
        // Held only as a local: it is pushed onto `objects` and released there, and nothing after
        // `create()` ever writes to it again — which is the whole point of drawing it once.
        const dial = this.scene.add.graphics();
        dial.lineStyle(4, TRAVEL_ARC, 1);
        dial.beginPath();
        dial.arc(centre.x, centre.y, KNOB_TRAVEL_RADIUS, KNOB_ARC_START_RAD, KNOB_ARC_START_RAD + KNOB_ARC_SWEEP_RAD, false);
        dial.strokePath();
        // One detent per authored step, at the angle that step actually turns to: the instrument must
        // not claim a resolution it does not have.
        dial.lineStyle(2, TICK, 0.9);
        knobTickAngles(this.options.control).forEach((angleRad) => {
            const inner = KNOB_TRAVEL_RADIUS - KNOB_TICK_LENGTH;
            dial.lineBetween(
                centre.x + (Math.cos(angleRad) * inner),
                centre.y + (Math.sin(angleRad) * inner),
                centre.x + (Math.cos(angleRad) * KNOB_TRAVEL_RADIUS),
                centre.y + (Math.sin(angleRad) * KNOB_TRAVEL_RADIUS)
            );
        });
        dial.fillStyle(BODY_FILL, 1);
        dial.fillCircle(centre.x, centre.y, KNOB_BODY_RADIUS);
        dial.lineStyle(2, BODY_RIM, 1);
        dial.strokeCircle(centre.x, centre.y, KNOB_BODY_RADIUS);

        // Its own object so it can be shown and hidden without redrawing anything.
        const focusRing = this.scene.add.graphics();
        focusRing.lineStyle(2, FOCUS_RING, 0.9);
        focusRing.strokeCircle(centre.x, centre.y, KNOB_FOCUS_RADIUS);
        focusRing.setVisible(false);
        this.focusRing = focusRing;

        // Drawn along +x from the origin and then rotated, so `setRotation` is the only per-render
        // write and the angle convention is the same one `instrumentView` converts in.
        const indicator = this.scene.add.graphics();
        indicator.fillStyle(INDICATOR, 1);
        indicator.fillRect(KNOB_BODY_RADIUS - KNOB_INDICATOR_LENGTH, -2.5, KNOB_INDICATOR_LENGTH, 5);
        indicator.fillCircle(0, 0, 4);
        indicator.setPosition(centre.x, centre.y);
        this.indicator = indicator;

        this.hitArea = this.scene.add.zone(centre.x, centre.y, KNOB_TRAVEL_RADIUS * 2, KNOB_TRAVEL_RADIUS * 2).setOrigin(0.5, 0.5);
        this.hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.inputEnabled) return;
            // Arming focuses, and focusing alone changes no value: a click that does not move must not
            // turn the knob, or a player reaching for the keyboard would nudge the setup to get there.
            this.options.onFocus();
            this.dragging = true;
            this.dragPointerId = pointer.id;
            // This press is not an affordance press, whatever it ends up over.
            this.affordancePressed = undefined;
        });

        // On the scene, not on the knob: a pointer that leaves the body mid-turn keeps turning it.
        this.scene.input.on('pointermove', this.onPointerMove, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);
        this.scene.input.on('pointerupoutside', this.onPointerUp, this);

        ([-1, 1] as const).forEach((direction) => {
            const affordanceCentre = stepAffordanceCentre(this.options.index, direction);
            const surface = this.scene.add
                .rectangle(affordanceCentre.x, affordanceCentre.y, STEP_AFFORDANCE_WIDTH, STEP_AFFORDANCE_HEIGHT, AFFORDANCE_FILL)
                .setOrigin(0.5, 0.5);
            // Authored empty and written in `render`: `create()` runs once and the locale can change.
            const label = this.scene.add.text(affordanceCentre.x, affordanceCentre.y, '', uiTextStyle({
                color: AFFORDANCE_LABEL, fontSize: `${STEP_AFFORDANCE_FONT_SIZE}px`, align: 'center'
            })).setOrigin(0.5, 0.5);
            surface.on('pointerdown', () => {
                if (!this.inputEnabled) return;
                this.affordancePressed = direction;
            });
            surface.on('pointerup', () => {
                if (!this.inputEnabled) return;
                // A release here that did not begin here is the end of a drag passing over, not a click.
                if (this.affordancePressed !== direction) return;
                this.affordancePressed = undefined;
                this.options.onFocus();
                // The same path the drag takes, which is what makes AC3's "identical run record" true
                // by construction rather than by two code paths agreeing.
                this.report(steppedNeighbour(this.options.control, this.currentValue(), direction));
            });
            this.affordances.push({ surface, label });
            this.objects.push(surface, label);
        });

        this.readout = this.scene.add.text(instrumentSlotLeft(this.options.index), INSTRUMENT_READOUT_Y, '', uiTextStyle({
            color: '#f7f4ef',
            fontSize: `${INSTRUMENT_READOUT_FONT_SIZE}px`,
            wordWrap: { width: INSTRUMENT_READOUT_WRAP }
        }));

        this.objects.push(dial, focusRing, indicator, this.hitArea, this.readout);
        this.applyInputState();
    }

    public render(view: ApparatusInstrumentView): void {
        this.reportedValue = view.value;
        this.indicator?.setRotation(knobAngleForValue(this.options.control, view.value));
        this.readout?.setText(view.readout);
        this.focusRing?.setVisible(view.focused);
        this.affordances[0]?.label.setText(view.decreaseLabel);
        this.affordances[1]?.label.setText(view.increaseLabel);
    }

    /** One authored step from wherever the control is now — the keyboard path (AC3). */
    public step(direction: -1 | 1): void {
        if (!this.inputEnabled) return;
        this.report(steppedNeighbour(this.options.control, this.currentValue(), direction));
    }

    /**
     * Suppression, from the overlay that covers the bench or from a run in flight.
     *
     * Disarms any drag as it goes: a pointer held down when the notebook opens would otherwise keep
     * turning a knob under the overlay, and the run in flight would be recorded against a setup the
     * player changed after pressing.
     */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        if (!enabled) {
            this.dragging = false;
            this.dragPointerId = undefined;
            this.affordancePressed = undefined;
        }
        this.applyInputState();
    }

    public destroy(): void {
        // Scene-level listeners outlive this object if they are not removed, and the renderer contract
        // calls that out for exactly this reason.
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.affordances.length = 0;
        this.focusRing = undefined;
        this.indicator = undefined;
        this.hitArea = undefined;
        this.readout = undefined;
        this.dragging = false;
        this.dragPointerId = undefined;
        this.affordancePressed = undefined;
        this.reportedValue = undefined;
    }

    private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
        if (!this.dragging || !this.inputEnabled) return;
        // Only the pointer that armed this drag turns this knob.
        if (pointer.id !== this.dragPointerId) return;
        const centre = knobCentre(this.options.index);
        this.report(resolveKnobValueForPointer({
            control: this.options.control,
            dx: pointer.x - centre.x,
            dy: pointer.y - centre.y,
            // What the knob holds when the pointer carries no reading — in the dead zone or on the
            // centre. Without it a dead-zone pointer chose an end and the value jumped there.
            currentValue: this.currentValue()
        }));
    };

    private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
        if (pointer.id !== this.dragPointerId) return;
        this.dragging = false;
        this.dragPointerId = undefined;
    };

    private currentValue(): number {
        return this.reportedValue ?? this.options.control.defaultValue;
    }

    /**
     * Reports only a real change, and only keeps it if the store took it.
     *
     * See {@link ApparatusInstrumentOptions.onValueChange} for why the refusal has to come back here:
     * a refused dispatch mints no new state, so `render()` never arrives to correct a `reportedValue`
     * written optimistically, and the instrument would step from a value the store does not hold.
     */
    private report(value: number): void {
        if (value === this.reportedValue) return;
        const previous = this.reportedValue;
        this.reportedValue = value;
        if (this.options.onValueChange(value)) return;
        // Refused. Fall back to what we last knew to be true, and put the indicator back under the
        // cursor's old position rather than leaving it where the refused request would have put it.
        this.reportedValue = previous;
        this.indicator?.setRotation(knobAngleForValue(this.options.control, this.currentValue()));
    }

    private applyInputState(): void {
        if (this.inputEnabled) {
            this.hitArea?.setInteractive({ useHandCursor: true });
            this.affordances.forEach(({ surface }) => surface.setInteractive({ useHandCursor: true }));
        } else {
            this.hitArea?.disableInteractive();
            this.affordances.forEach(({ surface }) => surface.disableInteractive());
        }
    }
}

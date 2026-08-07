import type { Scene } from 'phaser';

import { acceptsAdvanceClick } from '../renderers/advanceView';
import { uiTextStyle } from '../textStyles';

/**
 * The reusable in-scene control that takes the adventure forward one step (Story 2.7).
 *
 * **It knows nothing about the store.** It takes an already-resolved label, a readiness flag, and a
 * callback — never a `PhaserStoreAdapter`, a selector, or a locale. That is what lets one widget serve
 * the laboratory, both boards, and the two placeholder scenes without any of them sharing state, and
 * it is the same contract `DialogueBox` and `ProposalChoice` follow.
 *
 * It also **never decides anything about the phase**. It reports a click; its owner resolves the move
 * from the live phase and dispatches the typed action, and the router reacts. A scene mirrors the
 * phase and must never define, infer, or advance it (ADR-009).
 *
 * Flat display objects rather than a `Phaser.GameObjects.Container`: a Container declares no hit area
 * of its own, so `setInteractive()` with no shape does nothing on one. Every other widget and renderer
 * here owns a flat list; this follows them.
 *
 * No animation, deliberately. Every animated renderer has to subscribe to `prefers-reduced-motion`,
 * register no update loop under `reduce`, and paint a static frame; a hover or reveal effect buys
 * nothing here and costs that whole apparatus. A later story that adds one inherits the requirement.
 * The one thing here that reads a clock — the relabel lockout, see {@link acceptsAdvanceClick} — moves
 * nothing on screen, registers no tween or timer, and so inherits none of it.
 *
 * Phaser is imported **as a type only**, so `french-typography.spec.ts` can read the geometry below
 * without Phaser touching `window` at import time in Node.
 */

/**
 * The default width, used by every host that does not have a column of its own to fill.
 *
 * Wide enough for the longest French label at {@link ADVANCE_CONTROL_FONT_SIZE} with room to spare.
 * The control is a fixed hit target, so the label is the thing that has to fit rather than the
 * reverse — and a label that wraps to two lines inside a fixed-height rectangle clips, which is the
 * defect class the per-token typography sweep provably cannot catch.
 */
export const ADVANCE_CONTROL_WIDTH = 232;
export const ADVANCE_CONTROL_HEIGHT = 40;
export const ADVANCE_CONTROL_PADDING = 12;
export const ADVANCE_CONTROL_FONT_SIZE = 15;

/** The bound the French whole-string typography check measures against, derived rather than restated. */
export const advanceControlLabelWrap = (width: number = ADVANCE_CONTROL_WIDTH): number =>
    width - (2 * ADVANCE_CONTROL_PADDING);

/**
 * The design-space centre of a control placed at these bounds, so a browser spec can click it without
 * restating its host's gutters as literals that would drift the moment the layout moved.
 */
export const advanceControlCentre = (
    bounds: Readonly<{ x: number; y: number; width?: number; height?: number }>
): Readonly<{ x: number; y: number }> => ({
    x: bounds.x + ((bounds.width ?? ADVANCE_CONTROL_WIDTH) / 2),
    y: bounds.y + ((bounds.height ?? ADVANCE_CONTROL_HEIGHT) / 2)
});

/** Story 2.6's fills, kept verbatim so the laboratory looks exactly as it did. */
const ADVANCE_FILL = 0x1d4451;
const ADVANCE_FILL_READY = 0x276b55;

/**
 * A host's own two fills, for a room whose palette is not the laboratory's.
 *
 * Optional, and defaulting to Story 2.6's exact values, so adding this changed nothing on any of the
 * five surfaces that already draw the control. The reading room passes walnut and bottle green: the
 * teal above is the laboratory's, and against warm wood it read as a web button that had been dropped
 * into the picture.
 *
 * Only the fills are a host's to choose. The dimensions, the label's colour, the relabel lockout and
 * the readiness *rule* stay the widget's, because those are what make it one control rather than five
 * that look alike.
 */
export type AdvanceControlPalette = Readonly<{ fill: number; fillReady: number }>;

export type AdvanceControlOptions = Readonly<{
    /** Top-left of the control, in design space. */
    x: number;
    y: number;
    width?: number;
    height?: number;
    palette?: AdvanceControlPalette;
    /** Fired on a click. The owner decides what that means and dispatches it. */
    onAdvance: () => void;
}>;

export type AdvanceControlView = Readonly<{
    label: string;
    /**
     * Whether the way on is open, as far as the host can honestly tell.
     *
     * The one thing the control says about the evidence, and it is a fact about the player's own
     * notebook rather than a judgement about a conclusion. Hosts with no cheap, honest readiness to
     * read pass `true` and let the store answer on the click; nothing here can reach the defensible
     * set (ADR-006).
     */
    isReady: boolean;
}>;

export class AdvanceControl {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private surface?: Phaser.GameObjects.Rectangle;
    private label?: Phaser.GameObjects.Text;
    private inputEnabled = true;
    /** When the label last changed under the cursor, on the scene clock. See {@link acceptsAdvanceClick}. */
    private relabelledAt?: number;

    public constructor(private readonly scene: Scene, private readonly options: AdvanceControlOptions) {}

    public create(): void {
        const { x, y } = advanceControlCentre(this.options);
        const width = this.options.width ?? ADVANCE_CONTROL_WIDTH;
        const height = this.options.height ?? ADVANCE_CONTROL_HEIGHT;

        this.surface = this.scene.add.rectangle(x, y, width, height, this.palette().fill).setOrigin(0.5, 0.5);
        // Authored empty here and written in `render`: `create()` runs once, but the locale can change
        // at any time, so every string has to arrive through the store subscription.
        this.label = this.scene.add.text(x, y, '', uiTextStyle({
            color: '#f7f4ef',
            fontSize: `${ADVANCE_CONTROL_FONT_SIZE}px`,
            align: 'center',
            wordWrap: { width: advanceControlLabelWrap(width) }
        })).setOrigin(0.5, 0.5);

        this.surface.on('pointerup', () => {
            // A click aimed at the label that was on screen a moment ago is not a click on this one.
            if (!acceptsAdvanceClick({ relabelledAt: this.relabelledAt, now: this.scene.time.now })) return;
            this.options.onAdvance();
        });
        this.objects.push(this.surface, this.label);
        // Made interactive here rather than at construction, so a scene starting underneath an open
        // reference book can suppress input before the first pointer event reaches the control.
        this.applyInputState();
    }

    /**
     * Repaints from resolved strings.
     *
     * The bounds never move after `create()`, which is why there is no `setBounds` here: `setInteractive`
     * a second time only re-enables an existing hit area, so a host that ever did reposition or resize
     * this control would have to write `input.hitArea.width/height` directly, the way
     * `ProposalChoice.resizeHitArea` does.
     */
    public render(view: AdvanceControlView): void {
        const previous = this.label?.text;
        this.label?.setText(view.label);
        const { fill, fillReady } = this.palette();
        this.surface?.setFillStyle(view.isReady ? fillReady : fill);
        // `previous === ''` is the first render after `create()` writing the label in for the first
        // time, which is not a change under anyone's cursor. A locale change is, and locking there is
        // correct for the same reason: the control now says something the player has not read yet.
        if (previous !== undefined && previous !== '' && previous !== view.label) {
            this.relabelledAt = this.scene.time.now;
        }
    }

    /** Lets the overlaying reference book suppress this control while it is open. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.surface = undefined;
        this.label = undefined;
        this.relabelledAt = undefined;
    }

    private palette(): AdvanceControlPalette {
        return this.options.palette ?? { fill: ADVANCE_FILL, fillReady: ADVANCE_FILL_READY };
    }

    private applyInputState(): void {
        if (!this.surface) return;
        if (this.inputEnabled) this.surface.setInteractive({ useHandCursor: true });
        else this.surface.disableInteractive();
    }
}

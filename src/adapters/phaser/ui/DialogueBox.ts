import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import type { Translator } from '../../../core/i18n/translate';

/**
 * A reusable, scene-agnostic dialogue panel: speaker, one beat of authored prose, a position counter,
 * and an advance control.
 *
 * **It knows nothing about the store.** It takes already-resolved strings and a callback, never a
 * `PhaserStoreAdapter`, a selector, or a locale. That is what makes it reusable, and it is also what
 * keeps beat advancement out of the authoritative state: which line is showing is widget-local, it is
 * never persisted, and advancing past the last beat does **not** advance the case phase (ADR-009 — a
 * scene mirrors the phase and never drives it). Reloading mid-conversation therefore restores to the
 * scene and to beat 0, which is correct rather than a bug.
 *
 * Flat display objects, not a `Phaser.GameObjects.Container`: a Container declares no hit area of its
 * own, so `setInteractive()` with no shape does nothing on one, and its destruction/depth/input
 * semantics are a second lifecycle to get right on top of the renderer contract. `ApparatusRenderer`
 * and `ColleagueRenderer` both own flat lists; this follows them.
 *
 * No reveal animation, deliberately. Every animated renderer here has to subscribe to
 * `prefers-reduced-motion`, register no update loop under `reduce`, and paint a static frame; a
 * typewriter effect buys nothing and costs that whole apparatus. A later story that adds one inherits
 * the requirement.
 */

/**
 * One beat, already resolved to the active locale by the caller.
 *
 * Structurally this is `DialogueBeatProjection`, which the owner passes straight through — `id` is
 * carried for that structural match and for diagnostics, **not** as the idempotence key. What makes
 * `render` idempotent is the `conversationId` the owner supplies; see {@link DialogueBox.render} for why
 * deriving it from these ids is unsound.
 *
 * `speakerId` is carried for the same structural reason and is **not read by this widget at all**: the
 * panel prints {@link speaker}, the already-formatted attribution, and knows nothing about a cast. It
 * is here so an owner reading {@link DialogueBox.getCurrentBeat} can resolve who is speaking without
 * reverse-matching a localized string (Story 2.9).
 */
export type DialogueBeatView = Readonly<{ id: string; speakerId: string; speaker: string; text: string }>;

/**
 * The accent each speaker's attribution is written in, keyed by `speakerId` (Story 2.9, design
 * revision).
 *
 * Supplied by the owner, because the accents live in `case.json` and this widget knows nothing about
 * the store. A speaker missing from the map — a degraded cached case — falls back to
 * {@link DEFAULT_SPEAKER_COLOR} rather than throwing or printing nothing.
 *
 * **This is reinforcement, never the signal.** The attribution already names the speaker in words, so
 * a reader who cannot separate the four colours loses nothing: colour tells them *faster*, not
 * *instead*. That is the same rule the proposal card's choice marker follows.
 */
export type SpeakerAccents = Readonly<Record<string, string>>;

/** Speaker colour when a beat names someone the case no longer authors. The slot's original gold. */
export const DEFAULT_SPEAKER_COLOR = '#f4d35e';

export type DialogueBoxOptions = Readonly<{
    x: number;
    y: number;
    width: number;
    /** Fired after the index moves. Ephemeral: it must never dispatch or persist anything. */
    onAdvance?: (index: number) => void;
    /** Fired once, when the last beat is advanced past. */
    onComplete?: () => void;
}>;

const PADDING_X = 18;
const PADDING_Y = 12;

/**
 * Wide enough for the longest French control label at {@link DIALOGUE_CONTROL_FONT_SIZE}. The advance
 * control is a fixed hit target, so its label is the thing that has to fit rather than the reverse.
 */
const CONTROL_WIDTH = 196;
const CONTROL_HEIGHT = 26;
const CONTROL_LABEL_PADDING = 8;

const COUNTER_WIDTH = 90;
const COUNTER_GAP = 10;

/** Below the top row, which holds the speaker on the left and the counter plus control on the right. */
const BODY_TOP_GAP = 6;

const PANEL_FILL = 0x14343d;
const CONTROL_FILL = 0x1d4451;
const CONTROL_FILL_ENDED = 0x18333b;

export const DIALOGUE_SPEAKER_FONT_SIZE = 15;
/**
 * 16 design pixels, and not lower. The game is a 1024×768 surface under `Scale.FIT` with
 * `CENTER_BOTH`; at NFR1's 1280×720 viewport, FIT is height-bound at 720/768 = **0.9375**, so every
 * design size renders at 93.75% of its nominal CSS pixels. 16 lands at ≈15 CSS px; 15 would land at
 * ≈14.1, which is below what AC1 calls legible.
 */
export const DIALOGUE_BODY_FONT_SIZE = 16;
export const DIALOGUE_COUNTER_FONT_SIZE = 13;
export const DIALOGUE_CONTROL_FONT_SIZE = 14;

/** The bounds the French typography check measures against, derived rather than restated. */
export const dialogueBodyWrapWidth = (width: number): number => width - (2 * PADDING_X);
export const dialogueSpeakerWrapWidth = (width: number): number =>
    width - (2 * PADDING_X) - CONTROL_WIDTH - COUNTER_WIDTH - (2 * COUNTER_GAP);
export const DIALOGUE_CONTROL_LABEL_WRAP = CONTROL_WIDTH - (2 * CONTROL_LABEL_PADDING);
export const DIALOGUE_COUNTER_WRAP = COUNTER_WIDTH;

/**
 * The design-space centre of the advance control, so a browser test can click it without restating the
 * panel's gutters as literals that would drift the moment the layout moved.
 */
export const dialogueAdvanceControlCentre = (
    options: Readonly<{ x: number; y: number; width: number }>
): Readonly<{ x: number; y: number }> => ({
    x: options.x + options.width - PADDING_X - (CONTROL_WIDTH / 2),
    y: options.y + PADDING_Y + (CONTROL_HEIGHT / 2)
});

export class DialogueBox {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private panel?: Phaser.GameObjects.Rectangle;
    private speaker?: Phaser.GameObjects.Text;
    private body?: Phaser.GameObjects.Text;
    private counter?: Phaser.GameObjects.Text;
    private control?: Phaser.GameObjects.Rectangle;
    private controlLabel?: Phaser.GameObjects.Text;

    private beats: readonly DialogueBeatView[] = [];
    /** Speaker accents from the last `render`, so `advance` can recolour without the owner's help. */
    private accents: SpeakerAccents = {};
    /**
     * Which conversation is loaded, so `render` can tell "same again" from "a new one". Supplied by the
     * owner; never derived from the beats. See {@link render}.
     */
    private conversationId?: string;
    /** The translator of the last `render`, so `advance` can repaint the new beat by itself. */
    private translator?: Translator;
    private index = 0;
    private completed = false;
    private inputEnabled = true;
    /** Measured in `render`, so the owner can lay out beneath the panel instead of guessing. */
    private bottomY: number;
    /**
     * The panel's top edge. Starts at `options.y` and can be moved by {@link setTop}, because the owner
     * measures the chrome above the panel and the panel must not be drawn over it.
     */
    private top: number;

    public constructor(private readonly scene: Scene, private readonly options: DialogueBoxOptions) {
        this.top = options.y;
        this.bottomY = options.y;
    }

    public create(): void {
        const { x, y, width } = this.options;
        this.panel = this.scene.add.rectangle(x, y, width, CONTROL_HEIGHT, PANEL_FILL).setOrigin(0, 0);
        // Every string is authored empty here and written in `render`: `create()` runs once, but the
        // locale can change at any time.
        this.speaker = this.scene.add.text(x + PADDING_X, y + PADDING_Y, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${DIALOGUE_SPEAKER_FONT_SIZE}px`, wordWrap: { width: dialogueSpeakerWrapWidth(width) }
        }));
        this.body = this.scene.add.text(x + PADDING_X, y + PADDING_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${DIALOGUE_BODY_FONT_SIZE}px`, wordWrap: { width: dialogueBodyWrapWidth(width) }
        }));
        this.counter = this.scene.add.text(0, 0, '', uiTextStyle({
            color: '#8fb3bd', fontSize: `${DIALOGUE_COUNTER_FONT_SIZE}px`, align: 'right', wordWrap: { width: COUNTER_WIDTH }
        })).setOrigin(1, 0);
        this.control = this.scene.add.rectangle(0, 0, CONTROL_WIDTH, CONTROL_HEIGHT, CONTROL_FILL).setOrigin(0, 0);
        this.controlLabel = this.scene.add.text(0, 0, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${DIALOGUE_CONTROL_FONT_SIZE}px`, align: 'center', wordWrap: { width: DIALOGUE_CONTROL_LABEL_WRAP }
        })).setOrigin(0.5, 0.5);

        this.control.on('pointerup', () => this.advance());
        this.objects.push(this.panel, this.speaker, this.body, this.counter, this.control, this.controlLabel);
        // Made interactive here rather than at construction, so a scene starting underneath an open
        // reference book can suppress input before the first pointer event reaches the control.
        this.applyInputState();
    }

    /**
     * Re-renders from resolved strings.
     *
     * **Idempotent on unchanged input.** Its owner re-renders on every store notification, so a
     * `render` that reset the index would snap the conversation back to the first line whenever any
     * unrelated action dispatched. Only a genuinely different conversation restarts it.
     *
     * `conversationId` is what identifies "the same conversation", and it is the owner's to supply
     * because only the owner knows which scenario-script entry these beats came from. It must not be
     * derived from the beats themselves: the case schema **deliberately permits a beat id to repeat
     * across scenes** (`prediction` and `review` may both open with `intro`), and `TheoryBoard` hosts
     * both `synthesis` and `review` — `SceneRouter` does not restart a scene whose key is unchanged, so
     * one widget instance renders both in sequence. Keyed on the ids, two same-length conversations
     * sharing them would make the second open on its *last* beat, already labelled `dialogue.end`, with
     * its earlier beats unreachable (1.12 review).
     */
    public render(
        beats: readonly DialogueBeatView[],
        t: Translator,
        conversationId: string,
        // Required, not defaulted to `{}`. It carries the whole speaker-colour feature, so a host that
        // forgot it would compile, run, and quietly print four voices in one gold — which is exactly
        // the "default a required wiring argument to a no-op" trap `ProposalChoice`'s own docstring
        // names two files away (2.9 review).
        accents: SpeakerAccents
    ): void {
        this.loadBeats(beats, conversationId);
        this.accents = accents;
        // Retained so advancing can repaint without the owner having to hand the translator back. The
        // locale cannot change without a `render`, so this is never stale.
        this.translator = t;
        this.paint();
    }

    /** Draws the current beat. Separate from `render` so `advance` can repaint on its own. */
    private paint(): void {
        const t = this.translator;
        if (!t) return;

        const visible = this.beats.length > 0;
        this.setVisible(visible);
        this.applyInputState();
        if (!visible) {
            // No conversation authored for this scene: the panel takes no vertical space at all, so the
            // owner lays its own content out exactly as it would without a dialogue box.
            this.bottomY = this.top;
            return;
        }

        const { x, width } = this.options;
        const y = this.top;
        const beat = this.beats[this.index];
        const isLast = this.index >= this.beats.length - 1;

        this.speaker?.setText(beat.speaker);
        // The speaker's own accent, so four voices in one panel are told apart at a glance — the one
        // idea worth taking wholesale from the reference art.
        this.speaker?.setColor(this.accents[beat.speakerId] ?? DEFAULT_SPEAKER_COLOR);
        this.body?.setText(beat.text);
        this.counter?.setText(t('dialogue.counter', { index: this.index + 1, total: this.beats.length }));
        // The end-state label appears on the last beat, as the story asks — the control keeps its place
        // and says so rather than vanishing. `completed` is what distinguishes "reading the last line"
        // from "finished reading it", and it has to be visible in its own right: keyed on `isLast` alone,
        // a one-beat conversation painted its end state before the reader had clicked anything, and the
        // click that completed it produced a pixel-identical frame — a live hand cursor over a control
        // with no response (1.12 review).
        this.controlLabel?.setText(isLast ? t('dialogue.end') : t('dialogue.advance'));

        // The top row is as tall as the taller of its two halves, measured rather than assumed: a long
        // French speaker attribution can wrap to a second line.
        const rowHeight = Math.max(this.speaker?.height ?? 0, CONTROL_HEIGHT);
        const controlLeft = x + width - PADDING_X - CONTROL_WIDTH;
        this.control?.setPosition(controlLeft, y + PADDING_Y);
        // Spent only once the conversation is actually finished, so completing it changes something the
        // reader can see. Further clicks are no-ops.
        this.control?.setFillStyle(this.completed ? CONTROL_FILL_ENDED : CONTROL_FILL);
        this.controlLabel?.setAlpha(this.completed ? 0.65 : 1);
        this.controlLabel?.setPosition(controlLeft + (CONTROL_WIDTH / 2), y + PADDING_Y + (CONTROL_HEIGHT / 2));
        this.counter?.setPosition(controlLeft - COUNTER_GAP, y + PADDING_Y + 4);

        this.body?.setY(y + PADDING_Y + rowHeight + BODY_TOP_GAP);
        // Measured, never clipped with `maxLines`: truncation is the failure mode AC1 names, so the
        // panel grows to the wrapped height of the beat and the owner lays out below it.
        const height = PADDING_Y + rowHeight + BODY_TOP_GAP + (this.body?.height ?? 0) + PADDING_Y;
        this.panel?.setSize(width, height);
        this.bottomY = y + height;
    }

    /** Mirrors `ColleagueRenderer.applyInputState`: the overlaying reference book suppresses input. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    /**
     * Moves the panel's top edge, for an owner that measures the chrome above it rather than assuming a
     * constant clears it. Takes effect on the next paint, so the caller renders after setting it.
     */
    public setTop(y: number): void {
        this.top = y;
    }

    /** The measured bottom edge of the panel, or its top when no conversation is authored. */
    public getBottomY(): number {
        return this.bottomY;
    }

    /**
     * The beat currently on screen, or `undefined` when no conversation is authored for this scene.
     *
     * An accessor alongside {@link getBottomY} and {@link isComplete}, and deliberately nothing more:
     * the reading position is widget-local and ephemeral, and an owner that needs to know *whose* line
     * is showing — to stage that colleague — has no other way to ask. It stays a read: this widget
     * knows nothing about the stage, the cast, or the store, and adding the index to `AppState` to make
     * the question easier would contradict the contract in this file's header and have to be cleared on
     * every phase move and every replay.
     *
     * Valid at the two moments the owner needs it: after `render()` (index 0 on a new conversation,
     * clamped otherwise) and inside `onAdvance`, which fires after `paint()`.
     */
    public getCurrentBeat(): DialogueBeatView | undefined {
        return this.beats[this.index];
    }

    /** True once the last beat has been advanced past — the same moment `onComplete` fires. */
    public isComplete(): boolean {
        return this.beats.length === 0 || this.completed;
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.panel = undefined;
        this.speaker = undefined;
        this.body = undefined;
        this.counter = undefined;
        this.control = undefined;
        this.controlLabel = undefined;
        this.beats = [];
        this.accents = {};
        this.conversationId = undefined;
        this.translator = undefined;
        this.index = 0;
        this.completed = false;
    }

    private loadBeats(beats: readonly DialogueBeatView[], conversationId: string): void {
        this.beats = beats;
        if (conversationId !== this.conversationId) {
            this.conversationId = conversationId;
            this.index = 0;
            this.completed = false;
            return;
        }
        // Same conversation, but a defensive clamp: a shorter list must never leave the index past the
        // end and read `undefined.text`.
        this.index = Math.max(0, Math.min(this.index, beats.length - 1));
    }

    private advance(): void {
        if (this.beats.length === 0) return;
        if (this.index < this.beats.length - 1) {
            this.index += 1;
            // Repaint before notifying: the new beat changes the panel's measured height, and the owner
            // lays its own content out against `getBottomY()`, which only `paint` updates.
            this.paint();
            this.options.onAdvance?.(this.index);
            return;
        }
        // Advancing past the last beat reports completion to the owner and nothing else. It does not
        // dispatch, start a scene, or move the phase.
        if (!this.completed) {
            this.completed = true;
            this.paint();
            this.options.onComplete?.();
        }
    }

    /**
     * Named fields rather than a walk over {@link objects}: `GameObject` does not itself declare
     * `setVisible`, so a loop would need a cast that the typings correctly reject.
     */
    private setVisible(visible: boolean): void {
        this.panel?.setVisible(visible);
        this.speaker?.setVisible(visible);
        this.body?.setVisible(visible);
        this.counter?.setVisible(visible);
        this.control?.setVisible(visible);
        this.controlLabel?.setVisible(visible);
    }

    /**
     * The advance control drops its hand cursor once the conversation is finished, which is the other
     * half of making `completed` observable: a control that still invites a click but cannot do anything
     * is what the 1.12 review found here.
     */
    private applyInputState(): void {
        if (!this.control) return;
        if (this.inputEnabled && this.beats.length > 0 && !this.completed) this.control.setInteractive({ useHandCursor: true });
        else this.control.disableInteractive();
    }
}

import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import type { Translator } from '../../../core/i18n/translate';
import { formatAttribution } from '../../../core/i18n/formatAttribution';
// Type-only, and deliberately so: a `type` import is erased at compile time, so the selectors module
// stays out of this widget's runtime graph. See `formatAttribution` for why that matters.
import type { LocalizedProposalProjection } from '../../../core/store/selectors';

/**
 * One attributed proposal card: accent, speaker, claim, optional stated limitation, and a choice
 * marker. Reusable and scene-agnostic.
 *
 * **It calls `onChoose()` and nothing else.** It does not import the store, the adapter, or any
 * selector that could tell it which proposal the evidence defends — a surface that could read the
 * defensible set could mark the "right" answer, which ADR-006 and Story 1.11 AC3 both forbid. Whether
 * the choice succeeds, and what to say when it does not, is the owner's business.
 *
 * Every behaviour here was extracted from `ColleagueRenderer`, where each one was already there
 * because a review found the defect it prevents. Extraction must not lose them; see the individual
 * comments.
 *
 * Flat display objects rather than a `Phaser.GameObjects.Container`, for the reason set out in
 * {@link DialogueBox}: a Container has no hit area of its own, so the interactive background has to be
 * a real rectangle.
 */

const ACCENT_WIDTH = 8;
const MARKER_RIGHT_INSET = 16;

/**
 * The card's two horizontal gutters, as **defaults** a host may narrow (Story 2.9).
 *
 * They were private constants until a host needed to reserve a figure column inside the card without
 * the widget learning what a figure is. They are options rather than a fork of the widget, and they
 * default to the geometry the card already had, so a host that passes neither draws exactly what it
 * drew before. That is the shape the 2.8 review asked for and the trap it warned about in the same
 * breath: default an *option* to today's value, never default a required wiring argument to a no-op.
 *
 * `PROPOSAL_MARKER_GUTTER` is measured **from the card's right edge**, which is what it geometrically
 * is: the strip the choice marker owns. The private constant it replaces was `200` measured from the
 * card's left, which folded the content inset into the same number and so could not notice a widened
 * inset at all — widening the inset would have moved the text right without narrowing its wrap, and
 * `BODY_MAX_LINES = 2` clips silently. `200 - 26 = 174` is the same strip written honestly, and
 * `proposalTextWrapWidth` returns the identical 744 for a 944-wide card.
 */
export const PROPOSAL_CONTENT_INSET = 26;
export const PROPOSAL_MARKER_GUTTER = 174;

export type ProposalChoiceGutters = Readonly<{
    /** From the card's left edge to the text. The figure column, when a host reserves one, lives here. */
    contentInset?: number;
    /** From the card's right edge to the text: the strip the choice marker owns. */
    markerGutter?: number;
}>;

/**
 * Where the stated limitation is drawn — in the card, or by the host somewhere else (Story 2.9 review).
 *
 * `'in-card'` is the default and is what every host drew before, so a host that passes nothing is
 * unchanged. `'suppressed'` means the widget renders no limitation at all and the **host has taken
 * responsibility for showing it**; it is not a way to hide authored content, and a host that suppresses
 * without drawing it elsewhere has dropped a claim's caveat on the floor.
 *
 * It exists because the limitation is the most expensive thing on the conclusion board: reserving two
 * 13px lines in every one of four cards costs ≈140px of a 768px surface that does not scroll, which is
 * the whole reason the cast could not stand there. `ColleagueRenderer` suppresses it and writes the
 * **chosen** proposal's limitation into the guide slot instead — a band that is already reserved, sits
 * directly above the cards, and has nothing to say once a choice has been made.
 */
export type LimitationMode = 'in-card' | 'suppressed';

const ATTRIBUTION_TOP = 10;
const BODY_TOP = 32;
/**
 * The claim and the limitation share one card, so both are line-bounded and the limitation is placed
 * under the claim's *measured* height at render time. Bottom-anchoring the limitation instead left
 * roughly three pixels of slack against today's French copy — one extra wrapped line, from a copy edit
 * or a longer future translation, drew the two strings on top of each other (1.11 review).
 *
 * **Two claim lines, matching the card budget that was actually measured** (see
 * `PROPOSAL_CARD_HEIGHT` in `ColleagueRenderer`): attribution at y+10 and a two-line claim at 16px from
 * y+32 is ≈74px against a card of 88px. A *third* claim line adds ≈21px and runs past the card's bottom
 * edge, and because nothing here clips against the card, the overflow paints into `CARD_GAP` and onto
 * the **next** colleague's card, attaching a claim's tail to the wrong author. This was 3 until the
 * 1.12 review. Keeping it at 2 makes the overflow unreachable by construction rather than something a
 * clamp has to catch.
 *
 * The limitation used to share this budget and no longer does on the board that authors one — see
 * {@link LimitationMode} for where it went and what it bought.
 *
 * Exported since Story 2.9 so `french-typography.spec.ts` can assert the longest French claim still
 * wraps within it at the board's real bound, rather than restating `2` beside a constant it would then
 * stop tracking. That guard is the arbiter of the figure column's width: a per-token sweep provably
 * cannot catch this, because every individual token fits and it is the *count of lines* that overflows.
 */
export const BODY_MAX_LINES = 2;
/** Also clipped, also line-bounded, and exported for the same guard as {@link BODY_MAX_LINES}. */
export const LIMITATION_MAX_LINES = 2;
const LIMITATION_TOP_GAP = 6;

const FILL_IDLE = 0x16323b;
const FILL_SELECTED = 0x1d4451;
const ACCENT_ALPHA_IDLE = 0.55;

export const PROPOSAL_ATTRIBUTION_FONT_SIZE = 15;
export const PROPOSAL_BODY_FONT_SIZE = 16;
export const PROPOSAL_LIMITATION_FONT_SIZE = 13;
export const PROPOSAL_MARKER_FONT_SIZE = 15;

/**
 * The in-card wrap bound the French typography check measures against, derived rather than restated.
 *
 * **Both gutters, because both narrow it.** Its predecessor took only the width and subtracted a
 * single constant, which was exactly true while the content inset never moved — and silently wrong the
 * moment a host reserved space on the left, since the text would start further in and keep its old
 * bound. `BODY_MAX_LINES = 2` clips rather than overflows, so that error has no visible symptom at all
 * until a French claim loses its third line. A host must therefore pass the same pair it passes the
 * widget, and `french-typography.spec.ts` reads the *board's* resolved bound rather than these
 * defaults — `SUBMIT_WIDTH` vs `ADVANCE_CONTROL_WIDTH` in `ColleagueRenderer` is the recorded case of
 * a spec measuring a rectangle nothing paints and passing through the very clipping it existed to
 * catch.
 */
export const proposalTextWrapWidth = (
    width: number,
    { contentInset = PROPOSAL_CONTENT_INSET, markerGutter = PROPOSAL_MARKER_GUTTER }: ProposalChoiceGutters = {}
): number => width - contentInset - markerGutter;

/**
 * The marker's own wrap, derived from the gutter it lives in rather than declared beside it.
 *
 * The two were independent constants (`MARKER_GUTTER 200`, `MARKER_WRAP 160`) that happened to agree,
 * and a host narrowing one without the other would have left the marker wrapping into the claim. The
 * marker is right-anchored at {@link MARKER_RIGHT_INSET} from the card's edge, so the clear space it
 * has is precisely the gutter less that inset — 158 at the default, against a longest French marker
 * (`Retenir celle-ci`) of ≈115px at 15px.
 */
export const proposalMarkerWrap = (markerGutter: number = PROPOSAL_MARKER_GUTTER): number =>
    markerGutter - MARKER_RIGHT_INSET;

export type ProposalChoiceOptions = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
    accentColor: number;
    /** Defaults to `'in-card'`: a host that passes nothing draws exactly what it drew before. */
    limitationMode?: LimitationMode;
    /** The owner dispatches. The widget does not know the store exists. */
    onChoose: () => void;
} & ProposalChoiceGutters>;

export class ProposalChoice {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private background?: Phaser.GameObjects.Rectangle;
    private accent?: Phaser.GameObjects.Rectangle;
    private attribution?: Phaser.GameObjects.Text;
    private body?: Phaser.GameObjects.Text;
    private limitation?: Phaser.GameObjects.Text;
    private marker?: Phaser.GameObjects.Text;

    private top: number;
    private height: number;
    private inputEnabled = true;

    public constructor(private readonly scene: Scene, private readonly options: ProposalChoiceOptions) {
        this.top = options.y;
        this.height = options.height;
    }

    public create(): void {
        const { x, width, contentInset = PROPOSAL_CONTENT_INSET, markerGutter = PROPOSAL_MARKER_GUTTER } = this.options;
        const textLeft = x + contentInset;
        const wrapWidth = proposalTextWrapWidth(width, { contentInset, markerGutter });

        this.background = this.scene.add.rectangle(x, this.top, width, this.height, FILL_IDLE).setOrigin(0, 0);
        this.background.on('pointerup', () => this.options.onChoose());
        this.accent = this.scene.add.rectangle(x, this.top, ACCENT_WIDTH, this.height, this.options.accentColor).setOrigin(0, 0);
        // Text is created empty and written in `render`: `create()` runs once, but the locale can change.
        this.attribution = this.scene.add.text(textLeft, 0, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${PROPOSAL_ATTRIBUTION_FONT_SIZE}px`, wordWrap: { width: wrapWidth }
        }));
        this.body = this.scene.add.text(textLeft, 0, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${PROPOSAL_BODY_FONT_SIZE}px`, wordWrap: { width: wrapWidth }, maxLines: BODY_MAX_LINES
        }));
        // Always created, even for a prediction proposal that carries no limitation: whether one is
        // authored is content, and `create()` must not depend on content it may be re-rendered without.
        // An absent limitation renders as the empty string, which draws nothing.
        this.limitation = this.scene.add.text(textLeft, 0, '', uiTextStyle({
            color: '#a9c3ca', fontSize: `${PROPOSAL_LIMITATION_FONT_SIZE}px`, wordWrap: { width: wrapWidth }, maxLines: LIMITATION_MAX_LINES
        })).setOrigin(0, 0);
        // The choice marker is a label, never colour alone (AC2).
        this.marker = this.scene.add.text(x + width - MARKER_RIGHT_INSET, 0, '', uiTextStyle({
            color: '#c7d7d9', fontSize: `${PROPOSAL_MARKER_FONT_SIZE}px`, align: 'right', wordWrap: { width: proposalMarkerWrap(markerGutter) }
        })).setOrigin(1, 0);

        this.objects.push(this.background, this.accent, this.attribution, this.body, this.limitation, this.marker);
        // Made interactive here rather than at construction, so a scene that starts underneath an open
        // reference book can suppress input before the first pointer event.
        this.applyInputState();
    }

    /**
     * Repositions the card. The owner divides the space left below the dialogue box, which grows and
     * shrinks with the beat being read, so the vertical band is not fixed for the card's lifetime.
     * Followed by a `render`, which places the measured text inside the new bounds.
     */
    public setBounds(top: number, height: number): void {
        this.top = top;
        this.height = height;
        this.background?.setPosition(this.options.x, top).setSize(this.options.width, height);
        this.accent?.setPosition(this.options.x, top).setSize(ACCENT_WIDTH, height);
        this.resizeHitArea();
    }

    /**
     * Resizes the input hit area to match the background's new size.
     *
     * Phaser fixes a hit area at the moment `setInteractive` runs and never resizes it, so a resized
     * background would keep testing clicks against its old height — leaving a card clickable in the gap
     * below where it is actually drawn.
     *
     * **Calling `setInteractive` again does not fix that**, which is what the 1.12 review caught this
     * code claiming: `InputPlugin.enable` is `if (gameObject.input) { gameObject.input.enabled = true }`,
     * so a second call on an already-interactive object only re-enables it and never rebuilds the shape.
     * `Rectangle.setSize` does update `input.hitArea` — but only `if (input && !input.customHitArea)`,
     * so the correctness was incidental and would have vanished silently the first time anyone passed an
     * explicit hit area to inset a click target. Writing the geometry directly is what actually holds,
     * and it holds either way.
     *
     * Duck-typed rather than `instanceof Phaser.Geom.Rectangle`, deliberately: `instanceof` needs a
     * *value* import of Phaser, and Phaser touches `window` at import time. This module is imported by
     * the Playwright specs for its exported font sizes and wrap bounds, in Node, where that throws.
     * Setting `width`/`height` is exactly what `Geom.Rectangle.setSize` does anyway.
     */
    private resizeHitArea(): void {
        const hitArea = this.background?.input?.hitArea as { width?: number; height?: number } | undefined;
        if (!hitArea || typeof hitArea.width !== 'number' || typeof hitArea.height !== 'number') return;
        hitArea.width = this.options.width;
        hitArea.height = this.height;
    }

    public render(projection: LocalizedProposalProjection, isSelected: boolean, t: Translator): void {
        // A degraded cached `case.json` can leave a proposal unattributed. The two-part template would
        // then render a trailing em dash with nothing after it, so `formatAttribution` falls back to the
        // standalone label — shared with the dialogue speaker line rather than duplicated here.
        this.attribution?.setText(formatAttribution(t, projection)).setY(this.top + ATTRIBUTION_TOP);
        this.body?.setText(projection.text).setY(this.top + BODY_TOP);
        if (this.limitation && this.body) {
            // `'suppressed'` draws nothing here because the host draws it elsewhere — see
            // {@link LimitationMode}. The object still exists and is still positioned, so switching
            // modes at runtime needs no rebuild and an empty string draws nothing either way.
            this.limitation.setText(projection.limitation === undefined || this.options.limitationMode === 'suppressed'
                ? ''
                : t('proposal.limitation', { limitation: projection.limitation }));
            // Under the body's *measured* height, never anchored to the card's bottom edge.
            this.limitation.setY(this.body.y + this.body.height + LIMITATION_TOP_GAP);
        }
        this.marker?.setText(isSelected ? t('proposal.selected') : t('proposal.choose'))
            .setY(this.top + ATTRIBUTION_TOP);
        // The marker carries the state; the tint and the accent are reinforcement, not the signal.
        this.marker?.setColor(isSelected ? '#f4d35e' : '#8fb3bd');
        this.background?.setFillStyle(isSelected ? FILL_SELECTED : FILL_IDLE);
        this.accent?.setAlpha(isSelected ? 1 : ACCENT_ALPHA_IDLE);
    }

    /** Lets the overlaying reference book suppress the card while it is open. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.background = undefined;
        this.accent = undefined;
        this.attribution = undefined;
        this.body = undefined;
        this.limitation = undefined;
        this.marker = undefined;
    }

    private applyInputState(): void {
        if (!this.background) return;
        if (this.inputEnabled) this.background.setInteractive({ useHandCursor: true });
        else this.background.disableInteractive();
    }
}

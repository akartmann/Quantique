import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import type { Translator } from '../../../core/i18n/translate';
import { formatAttribution, type LocalizedProposalProjection } from '../../../core/store/selectors';

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
const TEXT_LEFT_OFFSET = 26;
/** Leaves the choice marker its own right-hand column so the body never wraps underneath it. */
const MARKER_GUTTER = 200;
const MARKER_WRAP = 160;
const MARKER_RIGHT_INSET = 16;

const ATTRIBUTION_TOP = 10;
const BODY_TOP = 32;
/**
 * The claim and the limitation share one card, so both are line-bounded and the limitation is placed
 * under the claim's *measured* height at render time. Bottom-anchoring the limitation instead left
 * roughly three pixels of slack against today's French copy — one extra wrapped line, from a copy edit
 * or a longer future translation, drew the two strings on top of each other (1.11 review).
 */
const BODY_MAX_LINES = 3;
const LIMITATION_MAX_LINES = 2;
const LIMITATION_TOP_GAP = 6;

const FILL_IDLE = 0x16323b;
const FILL_SELECTED = 0x1d4451;
const ACCENT_ALPHA_IDLE = 0.55;

export const PROPOSAL_ATTRIBUTION_FONT_SIZE = 15;
export const PROPOSAL_BODY_FONT_SIZE = 16;
export const PROPOSAL_LIMITATION_FONT_SIZE = 13;
export const PROPOSAL_MARKER_FONT_SIZE = 15;

/** The in-card wrap bound the French typography check measures against, derived rather than restated. */
export const proposalTextWrapWidth = (width: number): number => width - MARKER_GUTTER;
export const PROPOSAL_MARKER_WRAP = MARKER_WRAP;

export type ProposalChoiceOptions = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
    accentColor: number;
    /** The owner dispatches. The widget does not know the store exists. */
    onChoose: () => void;
}>;

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
        const { x, width } = this.options;
        const textLeft = x + TEXT_LEFT_OFFSET;
        const wrapWidth = proposalTextWrapWidth(width);

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
            color: '#c7d7d9', fontSize: `${PROPOSAL_MARKER_FONT_SIZE}px`, align: 'right', wordWrap: { width: MARKER_WRAP }
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
        // Phaser derives the input hit area from the object's size *at the moment* `setInteractive` runs
        // and does not resize it afterwards, so a resized background would keep testing against its old
        // height — leaving a card clickable in the gap below where it is actually drawn. Re-applying the
        // interactive state rebuilds the hit area from the new size.
        this.applyInputState();
    }

    public render(projection: LocalizedProposalProjection, isSelected: boolean, t: Translator): void {
        // A degraded cached `case.json` can leave a proposal unattributed. The two-part template would
        // then render a trailing em dash with nothing after it, so `formatAttribution` falls back to the
        // standalone label — shared with the dialogue speaker line rather than duplicated here.
        this.attribution?.setText(formatAttribution(t, projection)).setY(this.top + ATTRIBUTION_TOP);
        this.body?.setText(projection.text).setY(this.top + BODY_TOP);
        if (this.limitation && this.body) {
            this.limitation.setText(projection.limitation === undefined
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

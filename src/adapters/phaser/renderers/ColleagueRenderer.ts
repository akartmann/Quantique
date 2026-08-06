import type { Scene } from 'phaser';

import type { PhaserStoreAdapter, ProposalKind } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import { DialogueBox } from '../ui/DialogueBox';
import { ProposalChoice } from '../ui/ProposalChoice';
import type { AppState } from '../../../core/store/AppState';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import {
    selectDialogueBeats,
    selectLocale,
    selectLocalizedConclusionProposals,
    selectLocalizedPredictionProposals,
    selectLocalizedError,
    selectSelectedConclusionProposalId,
    selectSelectedPredictionProposalId,
    type LocalizedProposalProjection
} from '../../../core/store/selectors';
import type { Colleague } from '../../../domain/cases/ColleagueCast';

/**
 * The scene-facing consumer of the two reusable widgets: one {@link DialogueBox} above four
 * {@link ProposalChoice} cards, dispatching the player's choice.
 *
 * What stays here is what is a *store* concern rather than a widget concern — the heading, the guide
 * line, the transient error on a refused click, and the localized projection lookups. What moved into
 * the widgets is presentation, and every guard moved with it.
 *
 * **It never reads the defensible-conclusion set.** That set belongs to the evaluator and the later
 * rival-lab critique; a surface that could see it could mark the "right" answer, which ADR-006 and
 * Story 1.11 AC3 both rule out.
 *
 * Construction is cheap and defensive on purpose: `create()` runs synchronously inside
 * `dispatch() → notify()`, so a throw here would advance the phase, skip every later subscriber, and
 * break `dispatch`'s `Result` contract (Story 1.10 review).
 */

/**
 * Where every surface this renderer lays out sits — the chrome, the dialogue panel, and the cards.
 * Exported so the browser tests derive their wrap bounds and click targets from the real values
 * instead of restating them as literals that can silently drift.
 */
export const PROPOSAL_SURFACE_LEFT = 40;
export const PROPOSAL_SURFACE_WIDTH = 944;
const CARD_LEFT = PROPOSAL_SURFACE_LEFT;
const CARD_WIDTH = PROPOSAL_SURFACE_WIDTH;

const HEADING_Y = 30;
const GUIDE_Y = 68;
/** Below a two-line French guide at {@link CARD_WIDTH}, which is the taller of the two cases. */
export const DIALOGUE_TOP = 118;
/** Between the measured bottom of the dialogue panel and the first card. */
const CARDS_GAP = 12;
const CARD_GAP = 10;
const CANVAS_BOTTOM_MARGIN = 16;
/**
 * The floor that keeps four cards on a 768px canvas even if the dialogue panel grows unexpectedly.
 *
 * The budget it protects, measured at the authored content: a one-line beat leaves ≈126px per card and
 * a two-line French beat ≈121px, against ≈114px of conclusion card content — attribution, a two-line
 * claim at 16px, and a two-line stated limitation at 13px placed under the claim's measured height.
 * Authoring a beat long enough to wrap three times is what would eat that margin, which is why the
 * beats in `case.json` are deliberately short.
 */
const MIN_CARD_HEIGHT = 72;

/** A colleague with no silhouette accent of their own still gets a legible, neutral stripe. */
const NEUTRAL_ACCENT = 0x6f8f99;

const accentOf = (colleague: Colleague | undefined): number => colleague?.portrait.kind === 'silhouette'
    // Authored as a validated lower-case `#rrggbb`, so the parse cannot fail on valid content.
    ? Number.parseInt(colleague.portrait.accentColor.slice(1), 16)
    // An `asset` portrait's image is not preloaded by these scenes, and portrait art is still out of
    // scope. It reads as the same neutral stripe rather than a missing texture.
    : NEUTRAL_ACCENT;

type ProposalCard = Readonly<{ proposalId: string; choice: ProposalChoice }>;

export class ColleagueRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly cards: ProposalCard[] = [];
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private dialogueBox?: DialogueBox;
    private inputEnabled = true;
    /** Shown in place of the guide line until the next render, so a refused click is not silent. */
    private transientError?: string;

    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly kind: ProposalKind
    ) {}

    private project(state: AppState): readonly LocalizedProposalProjection[] {
        return this.kind === 'prediction'
            ? selectLocalizedPredictionProposals(state)
            : selectLocalizedConclusionProposals(state);
    }

    private selectedId(state: AppState): string | undefined {
        return this.kind === 'prediction'
            ? selectSelectedPredictionProposalId(state)
            : selectSelectedConclusionProposalId(state);
    }

    public create(): void {
        const state = this.storeAdapter.getState();
        // Text is authored empty here and populated by render(): create() runs once, but the
        // language can change at any time, so every string comes from the store subscription.
        this.heading = this.scene.add.text(CARD_LEFT, HEADING_Y, '', uiTextStyle({ color: '#f7f4ef', fontSize: '25px', wordWrap: { width: CARD_WIDTH } }));
        this.guide = this.scene.add.text(CARD_LEFT, GUIDE_Y, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', wordWrap: { width: CARD_WIDTH } }));
        this.objects.push(this.heading, this.guide);

        this.dialogueBox = new DialogueBox(this.scene, {
            x: CARD_LEFT,
            y: DIALOGUE_TOP,
            width: CARD_WIDTH,
            // Advancing changes the panel's measured height, so the cards below it have to move. It
            // dispatches nothing and touches no state: beat position is widget-local and ephemeral.
            onAdvance: () => this.relayoutCards()
        });
        this.dialogueBox.create();

        const proposals = this.project(state);
        const { top, height } = this.cardGeometry(proposals.length);
        proposals.forEach((proposal, index) => {
            const choice = new ProposalChoice(this.scene, {
                x: CARD_LEFT,
                y: top + (index * (height + CARD_GAP)),
                width: CARD_WIDTH,
                height,
                accentColor: this.accentFor(state, proposal.proposalId),
                onChoose: () => this.chooseProposal(proposal.proposalId)
            });
            choice.create();
            this.cards.push({ proposalId: proposal.proposalId, choice });
        });
        this.applyInputState();
    }

    /**
     * Lets the overlaying reference book suppress this surface while it is open — the same contract
     * `ApparatusRenderer.setInputEnabled` provides, and it now covers the dialogue advance control as
     * well as the cards. Without it, a click meant for the book's page controls fell through to the
     * card underneath and rewrote the player's prediction or conclusion: the book's own full-canvas
     * surface is disabled for the whole of its open, turn, and fade animations while the overlay is
     * still painted.
     */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    public render(state: AppState): void {
        const t = createTranslator(selectLocale(state));
        this.heading?.setText(t(this.kind === 'prediction' ? 'colleagues.heading' : 'theoryBoard.heading'));
        this.guide?.setText(this.transientError ?? t(this.kind === 'prediction' ? 'colleagues.guide' : 'theoryBoard.guide'));
        this.guide?.setColor(this.transientError ? '#f4d35e' : '#c7d7d9');
        // Cleared after drawing, so a refused click stays legible until the next real state change
        // replaces it rather than vanishing on the same frame.
        this.transientError = undefined;

        // The beats of the scene mirroring the *live* phase: TheoryBoard hosts both `synthesis` and
        // `review`, which are separate scenario-script entries with their own conversations.
        this.dialogueBox?.render(selectDialogueBeats(state), t);
        this.layoutAndRenderCards(state, t);
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.cards.forEach(({ choice }) => choice.destroy());
        this.cards.length = 0;
        this.dialogueBox?.destroy();
        this.dialogueBox = undefined;
        this.heading = undefined;
        this.guide = undefined;
        this.transientError = undefined;
    }

    /** The accent is the one thing the localized projection does not carry, because it is not text. */
    private accentFor(state: AppState, proposalId: string): number {
        const authored: Readonly<{ colleagueId: string }> | undefined = this.kind === 'prediction'
            ? state.caseDefinition.predictionProposals.find(({ id }) => id === proposalId)
            : state.caseDefinition.conclusionProposals.find(({ id }) => id === proposalId);
        return accentOf(state.caseDefinition.colleagues.find(({ id }) => id === authored?.colleagueId));
    }

    private chooseProposal(proposalId: string): void {
        const result = this.storeAdapter.chooseProposal(this.kind, proposalId);
        // Not unreachable. `createStore` short-circuits every dispatch while an exclusive progress
        // operation is in flight, so a click during a progress export or import legitimately fails —
        // and swallowing that left the card silently inert with no way to tell "refused" from "not
        // clickable".
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientError = selectLocalizedError(current, result.error);
        this.render(current);
    }

    /**
     * The vertical band the cards divide, taken from the dialogue panel's *measured* bottom rather than
     * a constant: a longer French beat pushes the cards down instead of being drawn over by them.
     */
    private cardGeometry(count: number): Readonly<{ top: number; height: number }> {
        const top = (this.dialogueBox?.getBottomY() ?? DIALOGUE_TOP) + CARDS_GAP;
        const available = this.scene.scale.height - top - CANVAS_BOTTOM_MARGIN;
        return { top, height: Math.max(MIN_CARD_HEIGHT, Math.floor(available / Math.max(count, 1)) - CARD_GAP) };
    }

    private layoutAndRenderCards(state: AppState, t: Translator): void {
        const { top, height } = this.cardGeometry(this.cards.length);
        const projections = new Map(this.project(state).map((proposal) => [proposal.proposalId, proposal]));
        const selectedId = this.selectedId(state);

        this.cards.forEach((card, index) => {
            const proposal = projections.get(card.proposalId);
            if (!proposal) return;
            card.choice.setBounds(top + (index * (height + CARD_GAP)), height);
            card.choice.render(proposal, card.proposalId === selectedId, t);
        });
    }

    /**
     * Re-lays the cards out after a dialogue advance, without touching the heading, the guide, or the
     * transient error: an advance is not a state change, so a refused click's message must survive it.
     */
    private relayoutCards(): void {
        const state = this.storeAdapter.getState();
        this.layoutAndRenderCards(state, createTranslator(selectLocale(state)));
    }

    private applyInputState(): void {
        this.cards.forEach(({ choice }) => choice.setInputEnabled(this.inputEnabled));
        this.dialogueBox?.setInputEnabled(this.inputEnabled);
    }
}

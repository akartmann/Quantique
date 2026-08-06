import type { Scene } from 'phaser';

import type { PhaserStoreAdapter, ProposalKind } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import type { AppState } from '../../../core/store/AppState';
import { createTranslator } from '../../../core/i18n/translate';
import {
    selectLocale,
    selectLocalizedConclusionProposals,
    selectLocalizedPredictionProposals,
    selectSelectedConclusionProposalId,
    selectSelectedPredictionProposalId,
    type LocalizedProposalProjection
} from '../../../core/store/selectors';
import type { Colleague } from '../../../domain/cases/ColleagueCast';

/**
 * Renders the four attributed proposals of one proposal set and dispatches the player's choice.
 *
 * Deliberately plain. Story 1.12 extracts the reusable `DialogueBox` / `ProposalChoice` widgets and
 * this renderer becomes their consumer — inventing a widget framework here would be work 1.12 has
 * to undo.
 *
 * **It never reads the defensible-conclusion set.** That set belongs to the evaluator and the later
 * rival-lab critique; a surface that could see it could mark the "right" answer, which ADR-006 and
 * AC3 both rule out.
 *
 * Construction is cheap and defensive on purpose: `create()` runs synchronously inside
 * `dispatch() → notify()`, so a throw here would advance the phase, skip every later subscriber, and
 * break `dispatch`'s `Result` contract (Story 1.10 review).
 */

const CARD_LEFT = 40;
const CARD_WIDTH = 944;
const ACCENT_WIDTH = 8;
const TEXT_LEFT = CARD_LEFT + 26;
/** Leaves room for the choice marker on the right without wrapping under it. */
const TEXT_WRAP_WIDTH = CARD_WIDTH - 200;
const CARDS_TOP = 132;
const CARD_GAP = 10;

/** A colleague with no silhouette accent of their own still gets a legible, neutral stripe. */
const NEUTRAL_ACCENT = 0x6f8f99;

const accentOf = (colleague: Colleague | undefined): number => colleague?.portrait.kind === 'silhouette'
    // Authored as a validated lower-case `#rrggbb`, so the parse cannot fail on valid content.
    ? Number.parseInt(colleague.portrait.accentColor.slice(1), 16)
    // An `asset` portrait's image is not preloaded by these scenes; picture support arrives with the
    // 1.12 widgets. Until then it reads as the same neutral stripe rather than a missing texture.
    : NEUTRAL_ACCENT;

type ProposalCard = Readonly<{
    proposalId: string;
    background: Phaser.GameObjects.Rectangle;
    accent: Phaser.GameObjects.Rectangle;
    attribution: Phaser.GameObjects.Text;
    body: Phaser.GameObjects.Text;
    limitation?: Phaser.GameObjects.Text;
    marker: Phaser.GameObjects.Text;
}>;

export class ColleagueRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly cards: ProposalCard[] = [];
    private heading?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;

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
        this.heading = this.scene.add.text(CARD_LEFT, 34, '', uiTextStyle({ color: '#f7f4ef', fontSize: '25px', wordWrap: { width: CARD_WIDTH } }));
        this.guide = this.scene.add.text(CARD_LEFT, 74, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', wordWrap: { width: CARD_WIDTH } }));
        this.objects.push(this.heading, this.guide);

        const proposals = this.project(state);
        // The card height is divided from the space actually left below the guide, so the four
        // conclusion cards — which carry a limitation line as well — still fit the canvas.
        const available = this.scene.scale.height - CARDS_TOP - 24;
        const cardHeight = Math.max(72, Math.floor(available / Math.max(proposals.length, 1)) - CARD_GAP);

        proposals.forEach((proposal, index) => {
            const top = CARDS_TOP + (index * (cardHeight + CARD_GAP));
            this.cards.push(this.createCard(state, proposal, top, cardHeight));
        });
    }

    private createCard(state: AppState, proposal: LocalizedProposalProjection, top: number, height: number): ProposalCard {
        // The accent is the one thing the localized projection does not carry, because it is not
        // text: read it from the authored content, by the same stable id.
        const authored: Readonly<{ colleagueId: string }> | undefined = this.kind === 'prediction'
            ? state.caseDefinition.predictionProposals.find(({ id }) => id === proposal.proposalId)
            : state.caseDefinition.conclusionProposals.find(({ id }) => id === proposal.proposalId);
        const colleague = state.caseDefinition.colleagues.find(({ id }) => id === authored?.colleagueId);

        const background = this.scene.add.rectangle(CARD_LEFT, top, CARD_WIDTH, height, 0x16323b)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });
        background.on('pointerup', () => {
            // A rejected choice is a no-op the surface does not need to explain: the only reachable
            // failure here is an unauthored id, which authored content cannot produce.
            this.storeAdapter.chooseProposal(this.kind, proposal.proposalId);
        });

        const accent = this.scene.add.rectangle(CARD_LEFT, top, ACCENT_WIDTH, height, accentOf(colleague)).setOrigin(0, 0);
        const attribution = this.scene.add.text(TEXT_LEFT, top + 12, '', uiTextStyle({ color: '#f4d35e', fontSize: '15px', wordWrap: { width: TEXT_WRAP_WIDTH } }));
        const body = this.scene.add.text(TEXT_LEFT, top + 36, '', uiTextStyle({ color: '#f7f4ef', fontSize: '16px', wordWrap: { width: TEXT_WRAP_WIDTH } }));
        // The choice marker is a label, never colour alone.
        const marker = this.scene.add.text(CARD_LEFT + CARD_WIDTH - 16, top + 12, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', align: 'right', wordWrap: { width: 160 } }))
            .setOrigin(1, 0);
        const limitation = proposal.limitation === undefined
            ? undefined
            : this.scene.add.text(TEXT_LEFT, top + height - 34, '', uiTextStyle({ color: '#a9c3ca', fontSize: '13px', wordWrap: { width: TEXT_WRAP_WIDTH } })).setOrigin(0, 1);

        const card: ProposalCard = { proposalId: proposal.proposalId, background, accent, attribution, body, limitation, marker };
        this.objects.push(background, accent, attribution, body, marker);
        if (limitation) this.objects.push(limitation);
        return card;
    }

    public render(state: AppState): void {
        const t = createTranslator(selectLocale(state));
        this.heading?.setText(t(this.kind === 'prediction' ? 'colleagues.heading' : 'theoryBoard.heading'));
        this.guide?.setText(t(this.kind === 'prediction' ? 'colleagues.guide' : 'theoryBoard.guide'));

        const projections = new Map(this.project(state).map((proposal) => [proposal.proposalId, proposal]));
        const selectedId = this.selectedId(state);

        this.cards.forEach((card) => {
            const proposal = projections.get(card.proposalId);
            if (!proposal) return;
            const isSelected = card.proposalId === selectedId;
            card.attribution.setText(t('colleague.attribution', { name: proposal.colleagueName, role: proposal.roleLabel }));
            card.body.setText(proposal.text);
            card.limitation?.setText(proposal.limitation === undefined ? '' : t('proposal.limitation', { limitation: proposal.limitation }));
            card.marker.setText(isSelected ? t('proposal.selected') : t('proposal.choose'));
            // The marker carries the state; the tint and the border are reinforcement, not the signal.
            card.marker.setColor(isSelected ? '#f4d35e' : '#8fb3bd');
            card.background.setFillStyle(isSelected ? 0x1d4451 : 0x16323b);
            card.accent.setAlpha(isSelected ? 1 : 0.55);
        });
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.cards.length = 0;
        this.heading = undefined;
        this.guide = undefined;
    }
}

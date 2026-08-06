import type { Scene } from 'phaser';

import type { PhaserStoreAdapter, ProposalKind } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import { DialogueBox } from '../ui/DialogueBox';
import { ProposalChoice } from '../ui/ProposalChoice';
import type { AppState } from '../../../core/store/AppState';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import {
    selectCasePhase,
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

/**
 * The submit control, on the conclusion board only (Story 2.5).
 *
 * Choosing and submitting are deliberately separate acts: choosing stays freely revisable and draws no
 * challenge, and submitting is what puts the claim in front of the rival lab. Without this the
 * `theory.conclusionSubmitted` action would have no way in, and AC1's "when the choice is submitted"
 * would be unreachable in the running game.
 *
 * It sits in the heading row rather than under the cards, and the heading's wrap width narrows to make
 * room. The alternative — a band below the cards — would take height out of `cardGeometry`'s budget,
 * which the 1.12 review already found to be the tightest thing on this surface.
 */
const SUBMIT_WIDTH = 232;
const SUBMIT_HEIGHT = 34;
const SUBMIT_GAP = 16;
const SUBMIT_LABEL_PADDING = 10;
const SUBMIT_FILL = 0x1d4451;

export const SUBMIT_CONTROL_FONT_SIZE = 15;
export const SUBMIT_CONTROL_LABEL_WRAP = SUBMIT_WIDTH - (2 * SUBMIT_LABEL_PADDING);
/** The conclusion heading shares its row with the submit control, so it wraps against what is left. */
export const CONCLUSION_HEADING_WRAP = PROPOSAL_SURFACE_WIDTH - SUBMIT_WIDTH - SUBMIT_GAP;

/**
 * The design-space centre of the submit control, so a browser test can click it without restating the
 * heading row's gutters. Fixed, unlike the cards: it is anchored to the top of the surface, which
 * nothing measured pushes around.
 */
export const submitConclusionControlCentre = (): Readonly<{ x: number; y: number }> => ({
    x: PROPOSAL_SURFACE_LEFT + PROPOSAL_SURFACE_WIDTH - (SUBMIT_WIDTH / 2),
    y: HEADING_Y + (SUBMIT_HEIGHT / 2)
});
/**
 * Where the dialogue panel sits when the guide above it has not been measured yet — `create()` builds
 * the panel before the first `render` writes any copy into the guide, so there is nothing to measure.
 * Sized for a two-line French guide at {@link CARD_WIDTH}, the taller of the two cases.
 *
 * From the first render on, the real top is **measured** from the guide's wrapped height by
 * {@link ColleagueRenderer.dialogueTop}. Leaving it a constant left ~11px of unmeasured slack between a
 * two-line French guide and the panel — the same "two objects sharing a fixed window with no
 * measurement" defect the 1.11 review found one layer down, and the guide slot also carries the
 * transient error, so a three-line refusal message shared that budget (1.12 review).
 */
export const DIALOGUE_TOP = 118;
/** Between the measured bottom of the guide line and the dialogue panel. */
const DIALOGUE_GAP = 12;
/** Between the measured bottom of the dialogue panel and the first card. */
const CARDS_GAP = 12;
const CARD_GAP = 10;
const CANVAS_BOTTOM_MARGIN = 16;
/**
 * The floor on a card's height.
 *
 * The budget it protects, measured at the authored content: a one-line beat leaves ≈126px per card and
 * a two-line French beat ≈121px, against ≈114px of conclusion card content — attribution, a two-line
 * claim at 16px, and a two-line stated limitation at 13px placed under the claim's measured height.
 *
 * On its own this floor is **not** what keeps the cards on the canvas: it bounds each card's height, and
 * an unbounded panel above them pushes their *top* down regardless, so past roughly eighteen wrapped
 * beat lines the last cards began below y=768 — on a fixed 1024×768 `Scale.FIT` surface with no scroll,
 * that is a phase the player cannot complete, because the card they must click is not merely ugly but
 * absent. The clamp in {@link ColleagueRenderer.cardGeometry} is what actually bounds the top, and this
 * floor is the budget it clamps against (1.12 review).
 */
const MIN_CARD_HEIGHT = 72;

/**
 * A design-space point that lies inside the **last** proposal card, whatever the dialogue panel above it
 * measures to — for a browser test that needs to click a card without restating the band as literals.
 *
 * Anchored to the canvas floor rather than the band's top, which is the whole point: the top moves with
 * the beat being read, and a fixed mid-surface coordinate silently lands in a {@link CARD_GAP} the moment
 * a beat wraps one line further (1.12 review found exactly that in `dialogue-advance.spec.ts`, under a
 * comment asserting the cards divide the space continuously — they do not, there are gaps between them).
 *
 * The cards always fill down to within `CARD_GAP` of the bottom margin: integer division of the
 * available height leaves at most that much unused, and the {@link MIN_CARD_HEIGHT} clamp only ever makes
 * the last card taller relative to the floor. So a point one inset above that is inside it either way.
 */
export const lastProposalCardProbe = (
    canvasHeight: number
): Readonly<{ x: number; y: number }> => ({
    x: PROPOSAL_SURFACE_LEFT + (PROPOSAL_SURFACE_WIDTH / 2),
    y: canvasHeight - CANVAS_BOTTOM_MARGIN - CARD_GAP - 4
});

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
    /** Conclusion board only: choosing is revisable, submitting is what invites the rival lab. */
    private submitControl?: Phaser.GameObjects.Rectangle;
    private submitLabel?: Phaser.GameObjects.Text;
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
        // The conclusion board gives its heading row to the submit control, so the heading wraps
        // against the space that is actually left rather than running underneath it.
        const headingWrap = this.kind === 'conclusion' ? CONCLUSION_HEADING_WRAP : CARD_WIDTH;
        this.heading = this.scene.add.text(CARD_LEFT, HEADING_Y, '', uiTextStyle({ color: '#f7f4ef', fontSize: '25px', wordWrap: { width: headingWrap } }));
        this.guide = this.scene.add.text(CARD_LEFT, GUIDE_Y, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', wordWrap: { width: CARD_WIDTH } }));
        this.objects.push(this.heading, this.guide);

        if (this.kind === 'conclusion') {
            const { x, y } = submitConclusionControlCentre();
            this.submitControl = this.scene.add.rectangle(x, y, SUBMIT_WIDTH, SUBMIT_HEIGHT, SUBMIT_FILL).setOrigin(0.5, 0.5);
            this.submitLabel = this.scene.add.text(x, y, '', uiTextStyle({
                color: '#f7f4ef', fontSize: `${SUBMIT_CONTROL_FONT_SIZE}px`, align: 'center', wordWrap: { width: SUBMIT_CONTROL_LABEL_WRAP }
            })).setOrigin(0.5, 0.5);
            this.submitControl.on('pointerup', () => this.submitConclusion());
            this.objects.push(this.submitControl, this.submitLabel);
        }

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
        this.submitLabel?.setText(t('theoryBoard.submit'));
        // Cleared after drawing, so a refused click stays legible until the next real state change
        // replaces it rather than vanishing on the same frame.
        this.transientError = undefined;

        // Set before rendering the panel, because the guide's height is only known once its copy is in.
        this.dialogueBox?.setTop(this.dialogueTop());
        // The beats of the scene mirroring the *live* phase: TheoryBoard hosts both `synthesis` and
        // `review`, which are separate scenario-script entries with their own conversations. The phase
        // is therefore the conversation's identity, and it is what the widget keys its reading position
        // on — the beat ids cannot serve, because the schema lets them repeat across scenes and this one
        // renderer instance survives the `synthesis → review` transition (1.12 review).
        this.dialogueBox?.render(selectDialogueBeats(state), t, selectCasePhase(state));
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
        this.submitControl = undefined;
        this.submitLabel = undefined;
        this.transientError = undefined;
    }

    /** The accent is the one thing the localized projection does not carry, because it is not text. */
    private accentFor(state: AppState, proposalId: string): number {
        const authored: Readonly<{ colleagueId: string }> | undefined = this.kind === 'prediction'
            ? state.caseDefinition.predictionProposals.find(({ id }) => id === proposalId)
            : state.caseDefinition.conclusionProposals.find(({ id }) => id === proposalId);
        return accentOf(state.caseDefinition.colleagues.find(({ id }) => id === authored?.colleagueId));
    }

    /**
     * Puts the chosen conclusion in front of the rival lab. It surfaces a refusal for the same reason
     * {@link chooseProposal} does — "choose a conclusion first" is a message the player needs, not a
     * dispatch to swallow — and it never decides anything itself: whether a challenge follows is the
     * evaluator's and the store's business.
     */
    private submitConclusion(): void {
        const result = this.storeAdapter.submitConclusion();
        if (result.ok) return;
        const current = this.storeAdapter.getState();
        this.transientError = selectLocalizedError(current, result.error);
        this.render(current);
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
     * The dialogue panel's top edge: below the guide line's *measured* bottom, and never above
     * {@link DIALOGUE_TOP}.
     *
     * The floor is what keeps this a safety net rather than a layout change. Today's guide — one line in
     * English, two in French — measures to at or above the constant, so the panel does not move and the
     * click target the browser tests derive stays where it was. What the measurement adds is the case the
     * constant could not survive: a three-line guide, or a three-line French transient error in the same
     * slot, now pushes the panel down instead of being drawn over by it.
     */
    private dialogueTop(): number {
        const guideBottom = (this.guide?.y ?? GUIDE_Y) + (this.guide?.height ?? 0);
        return Math.max(DIALOGUE_TOP, guideBottom + DIALOGUE_GAP);
    }

    /**
     * The vertical band the cards divide, taken from the dialogue panel's *measured* bottom rather than
     * a constant: a longer French beat pushes the cards down instead of being drawn over by them.
     *
     * The measured top is **clamped**, because the panel it is measured from has no ceiling of its own —
     * the beat body is deliberately unbounded so it can never truncate (AC1), and `LocalizedTextSchema`
     * sets no maximum length. Past the clamp the panel and the cards overlap, which is a legible layout
     * fault an author can see and fix; unclamped, the cards silently leave the canvas and the phase
     * becomes uncompletable, which an author cannot see at all. Overlap beats absence.
     */
    private cardGeometry(count: number): Readonly<{ top: number; height: number }> {
        const measuredTop = (this.dialogueBox?.getBottomY() ?? DIALOGUE_TOP) + CARDS_GAP;
        const cards = Math.max(count, 1);
        const limit = this.scene.scale.height - CANVAS_BOTTOM_MARGIN
            - (cards * MIN_CARD_HEIGHT) - ((cards - 1) * CARD_GAP);
        const top = Math.min(measuredTop, Math.max(DIALOGUE_TOP, limit));
        const available = this.scene.scale.height - top - CANVAS_BOTTOM_MARGIN;
        return { top, height: Math.max(MIN_CARD_HEIGHT, Math.floor(available / cards) - CARD_GAP) };
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
        if (this.inputEnabled) this.submitControl?.setInteractive({ useHandCursor: true });
        else this.submitControl?.disableInteractive();
    }
}

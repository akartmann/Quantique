import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ColleagueRenderer } from '../renderers/ColleagueRenderer';

/**
 * Hosts both `synthesis` and `review`, and renders the four attributed conclusion proposals in
 * either — unmarked. Which of them the evidence defends is the evaluator's business and, later, the
 * rival lab's (Story 2.5); the significant-measure gate that decides *when* the conclusion unlocks
 * is Story 2.6. Neither is this scene's to display.
 */
export class TheoryBoardScene extends Scene {
    private unsubscribe?: () => void;
    private colleagueRenderer?: ColleagueRenderer;

    /**
     * @param isOverlayVisible Reads the reference book's live visibility, for the same reason
     * {@link LaboratoryScene} does. The book is reachable from the curated record in every phase, so
     * without this a page-turn click at the theory board fell through to the card underneath and
     * replaced the player's conclusion and limitation with an authored proposal's.
     */
    public constructor(private readonly store: AppStore, private readonly isOverlayVisible: () => boolean = () => false) {
        super('TheoryBoard');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.colleagueRenderer = new ColleagueRenderer(this, createPhaserStoreAdapter(this.store), 'conclusion');
        this.colleagueRenderer.create();
        this.colleagueRenderer.setInputEnabled(!this.isOverlayVisible());

        this.unsubscribe = this.store.subscribe(() => this.colleagueRenderer?.render(this.store.getState()));
        this.colleagueRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    /** Lets the overlaying reference book suppress proposal input while it is open. */
    public setProposalInputEnabled(enabled: boolean): void {
        this.colleagueRenderer?.setInputEnabled(enabled);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.colleagueRenderer?.destroy();
        this.colleagueRenderer = undefined;
    }
}

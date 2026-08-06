import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ColleagueRenderer } from '../renderers/ColleagueRenderer';

/**
 * The prediction step: the colleague cast's four attributed predictions, one of which the player
 * chooses (Story 1.11).
 *
 * The lifecycle mirrors {@link LaboratoryScene} exactly — the subscription is stored, `shutdown`
 * is registered once, and the renderer is destroyed there — because the router stops and restarts
 * this scene on every phase change.
 */
export class ColleaguesScene extends Scene {
    private unsubscribe?: () => void;
    private colleagueRenderer?: ColleagueRenderer;

    /**
     * @param isOverlayVisible Reads the reference book's live visibility, for the same reason
     * {@link LaboratoryScene} does: the cards are rebuilt every time the router starts this scene, so
     * the book's edge-triggered suppression callback is not enough on its own — a scene that starts
     * underneath an open (or still fading) book must suppress its own input at creation, or clicks
     * meant for the book choose a proposal.
     */
    public constructor(private readonly store: AppStore, private readonly isOverlayVisible: () => boolean = () => false) {
        super('Colleagues');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.colleagueRenderer = new ColleagueRenderer(this, createPhaserStoreAdapter(this.store), 'prediction');
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

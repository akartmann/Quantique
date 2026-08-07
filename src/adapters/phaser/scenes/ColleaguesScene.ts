import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { preloadCaseAssets } from '../preloadCaseAssets';
import { ColleagueRenderer } from '../renderers/ColleagueRenderer';

/**
 * The prediction step: the colleague cast's four attributed predictions, one of which the player
 * chooses (Story 1.11).
 *
 * The lifecycle mirrors {@link LaboratoryScene} exactly — the subscription is stored, `shutdown`
 * is registered once, and the renderer is destroyed there — because the router stops and restarts
 * this scene on every phase change.
 *
 * It took an `isOverlayVisible` reader and a `setProposalInputEnabled` hook until Story 2.8. Both
 * existed because an always-running book scene could be open over this one; there is no such scene
 * now, no book is reachable in `prediction`, and a parameter defaulted to `() => false` would have
 * left a wiring omission looking like a compile-time success (2.7 review). What it gained instead is
 * the sticky-canvas bounds refresh the retired scene used to own for the whole session.
 */
export class ColleaguesScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private colleagueRenderer?: ColleagueRenderer;

    public constructor(private readonly store: AppStore) {
        super('Colleagues');
    }

    public preload(): void {
        preloadCaseAssets(this, this.store.getState().caseDefinition);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.colleagueRenderer = new ColleagueRenderer(this, createPhaserStoreAdapter(this.store), { kind: 'prediction' });
        this.colleagueRenderer.create();
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => this.colleagueRenderer?.render(this.store.getState()));
        this.colleagueRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
        this.colleagueRenderer?.destroy();
        this.colleagueRenderer = undefined;
    }
}

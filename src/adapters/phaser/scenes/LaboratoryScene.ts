import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';

export class LaboratoryScene extends Scene {
    private unsubscribe?: () => void;
    private apparatusRenderer?: ApparatusRenderer;

    /**
     * @param isOverlayVisible Reads the reference book's live visibility. The apparatus is rebuilt
     * every time the router starts this scene, so the book's edge-triggered suppression callback is
     * not enough: a scene that starts underneath an open (or still fading) book must suppress its own
     * input at creation, or clicks meant for the book mutate the apparatus.
     */
    public constructor(private readonly store: AppStore, private readonly isOverlayVisible: () => boolean = () => false) {
        super('Laboratory');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.apparatusRenderer = new ApparatusRenderer(this, createPhaserStoreAdapter(this.store));
        this.apparatusRenderer.create();
        this.apparatusRenderer.setInputEnabled(!this.isOverlayVisible());
        // Canvas input bounds are refreshed by the always-running LectureBookScene, which owns the
        // shared ScaleManager's scroll listener for the whole session.

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.apparatusRenderer?.render(state);
        });
        this.apparatusRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    /** Lets the overlaying reference book suppress apparatus input while it is open. */
    public setApparatusInputEnabled(enabled: boolean): void {
        this.apparatusRenderer?.setInputEnabled(enabled);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.apparatusRenderer?.destroy();
        this.apparatusRenderer = undefined;
    }
}

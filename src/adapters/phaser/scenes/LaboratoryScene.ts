import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';

export class LaboratoryScene extends Scene {
    private unsubscribe?: () => void;
    private apparatusRenderer?: ApparatusRenderer;
    private readonly refreshCanvasInputBounds = (): void => this.scale.updateBounds();

    public constructor(private readonly store: AppStore) {
        super('Laboratory');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.apparatusRenderer = new ApparatusRenderer(this, createPhaserStoreAdapter(this.store));
        this.apparatusRenderer.create();
        // The canvas is sticky. Phaser caches bounds in document coordinates, so refresh them
        // whenever document scrolling changes the canvas viewport position.
        window.addEventListener('scroll', this.refreshCanvasInputBounds, { passive: true });

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
        window.removeEventListener('scroll', this.refreshCanvasInputBounds);
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.apparatusRenderer?.destroy();
        this.apparatusRenderer = undefined;
    }
}

import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';

export class LaboratoryScene extends Scene {
    private unsubscribe?: () => void;
    private apparatusRenderer?: ApparatusRenderer;

    public constructor(private readonly store: AppStore) {
        super('Laboratory');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.apparatusRenderer = new ApparatusRenderer(this, createPhaserStoreAdapter(this.store));
        this.apparatusRenderer.create();

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.apparatusRenderer?.render(state);
        });
        this.apparatusRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.apparatusRenderer?.destroy();
        this.apparatusRenderer = undefined;
    }
}

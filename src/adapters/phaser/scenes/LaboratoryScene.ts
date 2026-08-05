import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';
import { LectureBookRenderer, type LectureBookController } from '../renderers/LectureBookRenderer';

export class LaboratoryScene extends Scene {
    private unsubscribe?: () => void;
    private apparatusRenderer?: ApparatusRenderer;
    private lectureBookRenderer?: LectureBookRenderer;

    public constructor(private readonly store: AppStore, private readonly onLectureBookReady?: (controller: LectureBookController) => void) {
        super('Laboratory');
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.apparatusRenderer = new ApparatusRenderer(this, createPhaserStoreAdapter(this.store));
        this.apparatusRenderer.create();
        this.lectureBookRenderer = new LectureBookRenderer(this, (visible) => this.apparatusRenderer?.setInputEnabled(!visible));
        this.onLectureBookReady?.(this.lectureBookRenderer.controller);

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
        this.lectureBookRenderer?.destroy();
        this.lectureBookRenderer = undefined;
    }
}

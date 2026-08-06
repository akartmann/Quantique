import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { RIVAL_LAB_SCENE_KEY } from '../../../domain/cases/ScenarioScript';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { RivalLabRenderer } from '../renderers/RivalLabRenderer';

/**
 * The rival lab's standing challenge.
 *
 * It mirrors state and never defines it: whether a challenge stands is `rivalLabCritique` in the
 * store, and the router activates this scene as a projection of that. If the scene decided when to
 * show itself, the challenge would be scene-local — invisible to the tests AC4 requires to run through
 * public actions, and lost on reload.
 *
 * It is **not** a `PhasePlaceholderScene`: that is the development marker for scenes not yet built.
 * The shape here follows `TheoryBoardScene` — build the renderer in `create()`, subscribe, render once,
 * and release everything on `shutdown`.
 *
 * `RivalLab` is a routable key but not an authorable one, so no `scenarioScript` entry maps to it. See
 * `ScenarioScript.ts`.
 */
export class RivalLabScene extends Scene {
    private unsubscribe?: () => void;
    private rivalLabRenderer?: RivalLabRenderer;

    /**
     * @param isOverlayVisible Reads the reference book's live visibility, for the same reason
     * {@link TheoryBoardScene} does. The book is reachable in every phase and this surface covers the
     * canvas, so without it a page-turn click would fall through to the revise control underneath and
     * dismiss the challenge the player was still reading.
     */
    public constructor(private readonly store: AppStore, private readonly isOverlayVisible: () => boolean = () => false) {
        super(RIVAL_LAB_SCENE_KEY);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x1a1113);
        this.rivalLabRenderer = new RivalLabRenderer(this, createPhaserStoreAdapter(this.store));
        this.rivalLabRenderer.create();
        this.rivalLabRenderer.setInputEnabled(!this.isOverlayVisible());

        this.unsubscribe = this.store.subscribe(() => this.rivalLabRenderer?.render(this.store.getState()));
        this.rivalLabRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    /** Lets the overlaying reference book suppress the revise control while it is open. */
    public setInputEnabled(enabled: boolean): void {
        this.rivalLabRenderer?.setInputEnabled(enabled);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.rivalLabRenderer?.destroy();
        this.rivalLabRenderer = undefined;
    }
}

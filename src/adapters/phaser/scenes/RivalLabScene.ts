import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { RIVAL_LAB_SCENE_KEY } from '../../../domain/cases/ScenarioScript';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
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
 *
 * Its `isOverlayVisible` reader and `setInputEnabled` hook went with the always-running book scene in
 * Story 2.8; the renderer keeps its own `setInputEnabled`, which nothing in this phase now calls.
 */
export class RivalLabScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private rivalLabRenderer?: RivalLabRenderer;

    public constructor(private readonly store: AppStore) {
        super(RIVAL_LAB_SCENE_KEY);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x1a1113);
        this.rivalLabRenderer = new RivalLabRenderer(this, createPhaserStoreAdapter(this.store));
        this.rivalLabRenderer.create();
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => this.rivalLabRenderer?.render(this.store.getState()));
        this.rivalLabRenderer.render(this.store.getState());

        this.events.once('shutdown', this.shutdown, this);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
        this.rivalLabRenderer?.destroy();
        this.rivalLabRenderer = undefined;
    }
}

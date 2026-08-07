import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { RIVAL_LAB_SCENE_KEY } from '../../../domain/cases/ScenarioScript';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { preloadCaseAssets } from '../preloadCaseAssets';
import { RivalLabRenderer } from '../renderers/RivalLabRenderer';

/**
 * The rival lab's standing challenge.
 *
 * It mirrors state and never defines it: whether a challenge stands is `rivalLabCritique` in the
 * store, and the router activates this scene as a projection of that. If the scene decided when to
 * show itself, the challenge would be scene-local — invisible to the tests AC4 requires to run through
 * public actions, and lost on reload.
 *
 * It is **not** a routing shell: that was the development marker for scenes not yet built, and Story
 * 2.11 deleted it once the debrief became the last real scene.
 * The shape here follows `TheoryBoardScene` — build the renderer in `create()`, subscribe, render once,
 * and release everything on `shutdown`.
 *
 * `RivalLab` is a routable key but not an authorable one, so no `scenarioScript` entry maps to it. See
 * `ScenarioScript.ts`.
 *
 * Its `isOverlayVisible` reader and its renderer's `setInputEnabled` hook both went with the
 * always-running book scene in Story 2.8. Nothing suppresses this phase, because no book can be open
 * in it — and the hook was removed rather than left in place, so a later story cannot quietly re-wire
 * cross-scene suppression through a method with no callers.
 */
export class RivalLabScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private rivalLabRenderer?: RivalLabRenderer;

    public constructor(private readonly store: AppStore) {
        super(RIVAL_LAB_SCENE_KEY);
    }

    public preload(): void {
        preloadCaseAssets(this, this.store.getState().caseDefinition);
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

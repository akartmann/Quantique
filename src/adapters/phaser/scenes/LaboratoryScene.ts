import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { selectLocale } from '../../../core/store/selectors';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';
import { ReferenceBookPresenter } from '../renderers/ReferenceBookPresenter';

/**
 * The bench, and the references kept beside it.
 *
 * **The book is owned by this scene** since Story 2.8, through its own {@link ReferenceBookPresenter}.
 * It used to be an always-running overlay scene that suppressed this one by calling
 * `laboratoryScene.setApparatusInputEnabled(...)` across a scene boundary — the reach-in AC6 retires.
 * The suppression itself has not changed and must not: an open book covers the apparatus, and a click
 * meant for a page control that fell through would move a slit. What changed is who makes the call.
 *
 * Reading here records nothing. The reading is put on the record once, in the reading room; the bench
 * only re-opens what is already on the shelf, and paging and closing stay ephemeral.
 */
export class LaboratoryScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private apparatusRenderer?: ApparatusRenderer;
    private referenceBook?: ReferenceBookPresenter;

    public constructor(private readonly store: AppStore) {
        super('Laboratory');
    }

    public create(): void {
        // Registered before anything it releases exists. A throw anywhere below would otherwise
        // leak the scroll listener and a store subscription that keeps rendering a half-built scene:
        // `SceneRouter` catches the throw and clears `activeSceneKey`, so nothing ever stops this scene
        // and nothing ever fires the handler that would have disposed them. `PhasePlaceholderScene`
        // has always had this order; these two did not.
        this.events.once('shutdown', this.shutdown, this);

        this.cameras.main.setBackgroundColor(0x10252c);
        const presenter = new ReferenceBookPresenter(
            this,
            () => selectLocale(this.store.getState()),
            (visible) => this.apparatusRenderer?.setInputEnabled(!visible)
        );
        presenter.create();
        this.referenceBook = presenter;

        this.apparatusRenderer = new ApparatusRenderer(this, createPhaserStoreAdapter(this.store), {
            openReference: (artifact) => presenter.open(artifact)
        });
        this.apparatusRenderer.create();
        // Suppressed at creation as well as on every visibility change. A scene-local presenter is
        // always closed at `create()`, so this cannot currently be false — but it states the rule that
        // mattered when the book outlived the scene, and it costs one call.
        this.apparatusRenderer.setInputEnabled(!presenter.isOpen);
        // The sticky canvas's bounds refresh, which the retired overlay scene used to own for the whole
        // session. Every routed scene registers its own now, and exactly one routed scene runs at a time.
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.apparatusRenderer?.render(state);
            // Re-publishes an open book so a locale change reaches its chrome and its rendition.
            this.referenceBook?.render();
        });
        this.apparatusRenderer.render(this.store.getState());

    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
        this.referenceBook?.destroy();
        this.referenceBook = undefined;
        this.apparatusRenderer?.destroy();
        this.apparatusRenderer = undefined;
    }
}

import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { selectLocale } from '../../../core/store/selectors';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { LibraryRenderer } from '../renderers/LibraryRenderer';
import { ReferenceBookPresenter } from '../renderers/ReferenceBookPresenter';

/**
 * The reading room: where the `context` phase actually happens (Story 2.8).
 *
 * It is **not** a routing shell any more. It was one across two epics while Stories 1.5 and
 * 2.1 were marked done, because both delivered their reading through the retired `CuratedRecord` DOM
 * panel and an always-running `LectureBookScene` overlay — the shape of defect the 2026-08-06
 * correction and ADR-011 exist to prevent. The lifecycle here follows `LaboratoryScene`: the
 * subscription is stored, `shutdown` is registered once, and everything the scene created is released
 * there.
 *
 * **The book is owned by this scene**, through its own {@link ReferenceBookPresenter}. Nothing reaches
 * into another scene and nothing runs un-routed: the presenter tells *this* renderer to suppress *its*
 * input, which is the whole of AC6. What is cross-cutting — the artifacts, the locale, what has been
 * inspected — comes from the store, and the only thing that is neither is which page you are on, which
 * is ephemeral and widget-local exactly as `DialogueBox`'s beat index is.
 */
export class LibraryScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private libraryRenderer?: LibraryRenderer;
    private referenceBook?: ReferenceBookPresenter;

    public constructor(private readonly store: AppStore) {
        super('Library');
    }

    public create(): void {
        // Registered before anything it releases exists. A throw anywhere below would otherwise
        // leak the scroll listener and a store subscription that keeps rendering a half-built scene:
        // `SceneRouter` catches the throw and clears `activeSceneKey`, so nothing ever stops this scene
        // and nothing ever fires the handler that would have disposed them. The retired routing
        // shell always had this order; these two did not.
        this.events.once('shutdown', this.shutdown, this);

        const presenter = new ReferenceBookPresenter(
            this,
            () => selectLocale(this.store.getState()),
            // Intra-scene suppression: this scene's book silencing this scene's room. The retired
            // arrangement reached across a scene boundary to do the same job for the laboratory.
            (visible) => this.libraryRenderer?.setInputEnabled(!visible)
        );
        presenter.create();
        this.referenceBook = presenter;

        this.libraryRenderer = new LibraryRenderer(this, createPhaserStoreAdapter(this.store), {
            openBook: (artifact) => presenter.open(artifact)
        });
        this.libraryRenderer.create();
        // Suppressed at creation as well as on every visibility change. A scene-local presenter is
        // always closed at `create()`, so this cannot currently be false — but the rule it states is
        // the one that mattered when the book outlived the scene, and stating it costs one call.
        this.libraryRenderer.setInputEnabled(!presenter.isOpen);
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.libraryRenderer?.render(state);
            // Re-publishes an open book so a locale change reaches its chrome, its reader label, its
            // summary, and the rendition itself. A no-op when nothing is open.
            this.referenceBook?.render();
        });
        this.libraryRenderer.render(this.store.getState());

    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
        this.referenceBook?.destroy();
        this.referenceBook = undefined;
        this.libraryRenderer?.destroy();
        this.libraryRenderer = undefined;
    }
}

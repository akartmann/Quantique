import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import { selectLocale } from '../../../core/store/selectors';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { preloadCaseAssets } from '../preloadCaseAssets';
import { ApparatusNotesRenderer } from '../renderers/ApparatusNotesRenderer';
import { ApparatusRenderer } from '../renderers/ApparatusRenderer';
import { NotebookRenderer } from '../renderers/NotebookRenderer';
import { ReferenceBookPresenter } from '../renderers/ReferenceBookPresenter';

/**
 * The bench, the references kept beside it, and the notebook the observations go into.
 *
 * **The notebook is a second scene-owned overlay** (Story 2.10, AC8), built on exactly the shape the
 * book established: this scene owns it, this scene suppresses its *own* apparatus input while it is
 * open, and nothing reaches across a scene boundary. Two overlays over one bench means the
 * suppression has to be a fact about *either* being up rather than about whichever one changed last —
 * see {@link suppressApparatus}.
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
    private notebook?: NotebookRenderer;
    /** The case's own apparatus notes (Story 4.2, AC2) — a third scene-owned overlay on the same rule. */
    private apparatusNotes?: ApparatusNotesRenderer;

    public constructor(private readonly store: AppStore) {
        super('Laboratory');
    }

    public preload(): void {
        preloadCaseAssets(this, this.store.getState().caseDefinition);
    }

    /**
     * The apparatus accepts input only while **no** overlay is up.
     *
     * Independent `setInputEnabled(!visible)` calls would race: closing the book while the notebook is
     * still open would hand input back to a bench nobody can see, and a click meant for a notebook row
     * would fall through and move a slit. One rule, read from every presenter — which is why adding the
     * apparatus notes (Story 4.2) is one more clause here rather than a fourth call somewhere else. The
     * rule was written for two overlays and states the property for any number: *no* overlay open.
     */
    private suppressApparatus(): void {
        const overlayOpen = (this.referenceBook?.isOpen ?? false)
            || (this.notebook?.isOpen ?? false)
            || (this.apparatusNotes?.isOpen ?? false);
        this.apparatusRenderer?.setInputEnabled(!overlayOpen);
    }

    public create(): void {
        // Registered before anything it releases exists. A throw anywhere below would otherwise
        // leak the scroll listener and a store subscription that keeps rendering a half-built scene:
        // `SceneRouter` catches the throw and clears `activeSceneKey`, so nothing ever stops this scene
        // and nothing ever fires the handler that would have disposed them. the retired routing shell
        // has always had this order; these two did not.
        this.events.once('shutdown', this.shutdown, this);

        this.cameras.main.setBackgroundColor(0x10252c);
        const adapter = createPhaserStoreAdapter(this.store);
        const presenter = new ReferenceBookPresenter(
            this,
            () => selectLocale(this.store.getState()),
            () => this.suppressApparatus()
        );
        presenter.create();
        this.referenceBook = presenter;

        this.apparatusRenderer = new ApparatusRenderer(this, adapter, {
            openReference: (artifact) => presenter.open(artifact),
            // Resolved through the field rather than captured, because the notebook is constructed
            // *after* this renderer — see below. The apparatus notes are the same, for the same reason.
            openNotebook: () => this.notebook?.open(),
            openApparatusNotes: () => this.apparatusNotes?.openNotes()
        });
        this.apparatusRenderer.create();

        // Built after the bench, and on its own depth on top of that. Creation order is the only depth
        // mechanism most of these renderers use, and an overlay built before the bench would be painted
        // over by it — which is one of the three defects the 2.9 review found only by screenshotting.
        // Belt and braces, because a later story reordering this block must not silently bury it.
        const notebook = new NotebookRenderer(this, adapter, {
            onVisibilityChange: () => this.suppressApparatus()
        });
        notebook.create();
        this.notebook = notebook;
        // On its own depth above the bench, for the reason stated above the notebook: creation order is
        // the depth mechanism here, and an overlay built before the bench is painted over by it.
        const notes = new ApparatusNotesRenderer(this, adapter, { onVisibilityChange: () => this.suppressApparatus() });
        notes.create();
        this.apparatusNotes = notes;
        // Suppressed at creation as well as on every visibility change. Both scene-local overlays are
        // closed at `create()`, so this cannot currently be false — but it states the rule that
        // mattered when the book outlived the scene, and it costs one call.
        this.suppressApparatus();
        // The sticky canvas's bounds refresh, which the retired overlay scene used to own for the whole
        // session. Every routed scene registers its own now, and exactly one routed scene runs at a time.
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.apparatusRenderer?.render(state);
            // Re-publishes an open book so a locale change reaches its chrome and its rendition.
            this.referenceBook?.render();
            // The notebook is a live projection of the runs and the comparison, so it repaints on
            // every dispatch rather than only on a locale change — a run recorded, a selection made or
            // a note saved all change what it shows. It is a no-op while closed.
            this.notebook?.render(state);
            // A no-op while closed, and a locale change while open must reach every heading it draws.
            this.apparatusNotes?.render(state);
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
        this.notebook?.destroy();
        this.notebook = undefined;
        this.apparatusNotes?.destroy();
        this.apparatusNotes = undefined;
        this.apparatusRenderer?.destroy();
        this.apparatusRenderer = undefined;
    }
}

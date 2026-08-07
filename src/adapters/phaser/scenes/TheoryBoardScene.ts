import { Scene } from 'phaser';

import type { AppStore } from '../../../core/store/createStore';
import type { CaseRecordOperations } from '../../persistence/caseRecordOperations';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter } from '../PhaserStoreAdapter';
import { CaseFilePresenter } from '../renderers/CaseFilePresenter';
import { ColleagueRenderer } from '../renderers/ColleagueRenderer';

/**
 * Hosts both `synthesis` and `review`, and renders the four attributed conclusion proposals in
 * either — unmarked. Which of them the evidence defends is the evaluator's business and, later, the
 * rival lab's (Story 2.5); the significant-measure gate that decides *when* the conclusion unlocks
 * is Story 2.6. Neither is this scene's to display.
 *
 * **It hosts the case file** (Story 2.11), through its own {@link CaseFilePresenter}. That overlay is
 * where the four support and review intents reach the canvas — `theory.supportRunSelected` and its
 * three siblings, `peerReview.requested` and `revision.saved` — and where AC7's readiness list lives.
 * Nothing reaches into another scene: the presenter tells *this* renderer to suppress *its* input,
 * which is the same arrangement `LibraryScene` makes with its reference book. The board has no band
 * left for that content; `caseFileGeometry`'s header has the measurement.
 *
 * The `isOverlayVisible` reader and the `setProposalInputEnabled` hook went with the always-running
 * book scene in Story 2.8. No book is reachable in these phases, and the parameter was removed rather
 * than defaulted — see `ColleaguesScene` for why. It registers the sticky-canvas bounds refresh the
 * retired scene used to own instead.
 */
export class TheoryBoardScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private colleagueRenderer?: ColleagueRenderer;
    private caseFile?: CaseFilePresenter;

    /**
     * @param record Export, import and print, when the session has a repository. Absent on the
     * validation route, where the case file simply draws no record row (Story 2.12).
     */
    public constructor(
        private readonly store: AppStore,
        private readonly record?: CaseRecordOperations
    ) {
        super('TheoryBoard');
    }

    public create(): void {
        // Registered **first**, before anything it releases exists — the ordering the 2.8 review
        // corrected on `LibraryScene` and `LaboratoryScene`. A throw anywhere below would otherwise
        // leak the scroll listener and a store subscription that keeps rendering a half-built scene:
        // `SceneRouter` catches the throw and clears `activeSceneKey`, so nothing ever stops this scene
        // and nothing ever fires the handler that would have disposed them.
        this.events.once('shutdown', this.shutdown, this);

        this.cameras.main.setBackgroundColor(0x10252c);
        const adapter = createPhaserStoreAdapter(this.store);

        const caseFile = new CaseFilePresenter(this, adapter, {
            // Intra-scene suppression: this scene's overlay silencing this scene's board. A click meant
            // for the overlay that fell through would choose a conclusion.
            onVisibilityChange: (visible) => this.colleagueRenderer?.setInputEnabled(!visible),
            record: this.record
        });
        caseFile.create();
        this.caseFile = caseFile;

        this.colleagueRenderer = new ColleagueRenderer(this, adapter, {
            kind: 'conclusion',
            openCaseFile: () => caseFile.open()
        });
        this.colleagueRenderer.create();
        // Suppressed at creation as well as on every visibility change — the rule `LibraryScene`
        // states. A scene-local presenter is always closed at `create()`, so this cannot currently be
        // false, but the rule it states is the one that mattered when an overlay outlived its scene.
        this.colleagueRenderer.setInputEnabled(!caseFile.isOpen);
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => {
            const state = this.store.getState();
            this.colleagueRenderer?.render(state);
            // Re-publishes an open case file so a locale change and every pin reach it. A no-op while
            // it is closed, so the scene calls it unconditionally rather than guarding here.
            this.caseFile?.render(state);
        });
        this.colleagueRenderer.render(this.store.getState());
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
        this.caseFile?.destroy();
        this.caseFile = undefined;
        this.colleagueRenderer?.destroy();
        this.colleagueRenderer = undefined;
    }
}

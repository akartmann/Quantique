import { Scene } from 'phaser';

import { LectureBookRenderer, type LectureBookController } from '../renderers/LectureBookRenderer';

/** The overlay scene key is deliberately outside SceneKey: no phase may route to it. */
export const LECTURE_BOOK_SCENE_KEY = 'LectureBook';

/**
 * Persistent overlay scene for the reference book.
 *
 * The book is opened from the curated record in the `context` phase and from the laboratory in
 * `experiment`, so it cannot live inside a phase-routed scene: the SceneRouter stops those. This
 * scene runs for the whole session, is registered last so it draws above the routed scene, and is
 * never started or stopped by the router. Story 2.1 folds the reading experience into LibraryScene.
 *
 * Because it is the one scene that always runs, it also owns the session-wide canvas input-bounds
 * refresh for the sticky canvas. Retiring this scene must relocate that listener, or Phaser's cached
 * document-space bounds go stale on scroll for every phase.
 */
export class LectureBookScene extends Scene {
    private lectureBookRenderer?: LectureBookRenderer;
    private readonly refreshCanvasInputBounds = (): void => this.scale.updateBounds();

    public constructor(
        private readonly onOverlayVisibilityChange: (visible: boolean) => void,
        private readonly onLectureBookReady?: (controller: LectureBookController) => void
    ) {
        super(LECTURE_BOOK_SCENE_KEY);
    }

    /** Lets a scene starting underneath the book re-apply input suppression (see LaboratoryScene). */
    public isOverlayVisible(): boolean {
        return this.lectureBookRenderer?.isOverlayVisible ?? false;
    }

    public create(): void {
        this.lectureBookRenderer = new LectureBookRenderer(this, this.onOverlayVisibilityChange);
        this.onLectureBookReady?.(this.lectureBookRenderer.controller);
        // The canvas is sticky. Phaser caches bounds in document coordinates, so refresh them
        // whenever document scrolling changes the canvas viewport position. This scene always runs,
        // so the book stays clickable in phases where the laboratory scene is stopped.
        window.addEventListener('scroll', this.refreshCanvasInputBounds, { passive: true });

        this.events.once('shutdown', this.shutdown, this);
    }

    private shutdown(): void {
        window.removeEventListener('scroll', this.refreshCanvasInputBounds);
        this.lectureBookRenderer?.destroy();
        this.lectureBookRenderer = undefined;
    }
}

import type { Scene } from 'phaser';

/**
 * The sticky canvas's input-bounds refresh, owned by the scene lifecycle (Story 2.8).
 *
 * ## Why it moved here
 *
 * Phaser caches the canvas bounds in *document* coordinates, so a page scroll leaves every in-canvas
 * hit area offset from where it is painted until `ScaleManager.updateBounds()` runs again. The
 * listener that did that used to belong to `LectureBookScene` — the one scene that always ran — and
 * that scene's own docstring warned that retiring it must relocate the listener or the bounds go stale
 * on scroll in every phase. AC6 retires it, so this is that relocation.
 *
 * ## Why per-scene rather than per-game
 *
 * `project-context.md` prescribes exactly this: "registered and removed by the scene lifecycle". A
 * game-level listener would outlive the scenes it serves and reintroduce the never-released half of
 * the `deferred-work.md` item — and it would have to be torn down from somewhere that knows when the
 * game dies, which is the coupling the retirement is removing.
 *
 * Registering it in every routed scene does **not** stack listeners: the router activates exactly one
 * routed scene at a time and stops the previous one, and `shutdown` disposes. With the always-on
 * overlay gone there is no second scene left to hold a second listener.
 *
 * `passive: true` because the handler never calls `preventDefault`, and a non-passive scroll listener
 * makes the browser wait on it before it can scroll.
 *
 * @returns Its own disposer. A caller that forgets to call it leaks a listener onto `window`, so the
 * return value is the whole API surface rather than a `sceneKey`-indexed registry to get out of sync.
 */
export const registerCanvasBoundsRefresh = (scene: Scene): (() => void) => {
    const refresh = (): void => scene.scale.updateBounds();
    window.addEventListener('scroll', refresh, { passive: true });
    return () => window.removeEventListener('scroll', refresh);
};
